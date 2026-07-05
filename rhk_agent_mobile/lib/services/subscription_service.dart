import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Service untuk mengelola status langganan Premium Aspend.
/// Menggunakan Google Play Billing via paket in_app_purchase.
class SubscriptionService {
  // Singleton
  SubscriptionService._internal();
  static final SubscriptionService instance = SubscriptionService._internal();

  // Product IDs — harus sama persis dengan yang didaftarkan di Google Play Console
  static const String kMonthlyId = 'aspend_premium_monthly';
  static const String kYearlyId = 'aspend_premium_yearly';
  static const Set<String> _productIds = {kMonthlyId, kYearlyId};

  // SharedPreferences keys
  static const String _premiumKey = 'is_premium_active';
  static const String _premiumExpiryKey = 'premium_expiry_date';

  StreamSubscription<List<PurchaseDetails>>? _subscription;
  bool _isAvailable = false;
  bool _isPremium = false;
  List<ProductDetails> _products = [];

  bool get isAvailable => _isAvailable;
  List<ProductDetails> get products => _products;

  /// Inisialisasi service. Dipanggil sekali saat aplikasi dimulai.
  Future<void> init() async {
    // Cek status premium dari cache lokal terlebih dahulu
    await _loadPremiumFromCache();

    // Cek apakah Google Play Billing tersedia di perangkat
    _isAvailable = await InAppPurchase.instance.isAvailable();
    if (!_isAvailable) {
      debugPrint('SubscriptionService: Google Play Billing tidak tersedia.');
      return;
    }

    // Mulai listen stream pembelian
    final Stream<List<PurchaseDetails>> purchaseUpdated =
        InAppPurchase.instance.purchaseStream;
    _subscription = purchaseUpdated.listen(
      _onPurchaseUpdate,
      onDone: () => _subscription?.cancel(),
      onError: (error) => debugPrint('SubscriptionService: Stream error: $error'),
    );

    // Muat daftar produk dari Google Play
    await _loadProducts();

    // Pulihkan pembelian yang sudah ada (misal setelah reinstall)
    await InAppPurchase.instance.restorePurchases();
  }

  /// Muat daftar produk langganan dari Google Play Console.
  Future<void> _loadProducts() async {
    try {
      final ProductDetailsResponse response =
          await InAppPurchase.instance.queryProductDetails(_productIds);
      if (response.error != null) {
        debugPrint('SubscriptionService: Error loading products: ${response.error}');
        return;
      }
      _products = response.productDetails;
      debugPrint('SubscriptionService: Loaded ${_products.length} products.');
    } catch (e) {
      debugPrint('SubscriptionService: Exception loading products: $e');
    }
  }

  /// Menangani update dari stream pembelian Google Play.
  Future<void> _onPurchaseUpdate(List<PurchaseDetails> purchases) async {
    for (final PurchaseDetails purchase in purchases) {
      debugPrint('SubscriptionService: Purchase update: ${purchase.productID} - ${purchase.status}');

      if (purchase.status == PurchaseStatus.pending) {
        // Sedang diproses, tidak perlu aksi
        continue;
      }

      if (purchase.status == PurchaseStatus.error) {
        debugPrint('SubscriptionService: Purchase error: ${purchase.error}');
        if (purchase.pendingCompletePurchase) {
          await InAppPurchase.instance.completePurchase(purchase);
        }
        continue;
      }

      if (purchase.status == PurchaseStatus.purchased ||
          purchase.status == PurchaseStatus.restored) {
        // Validasi pembelian
        final bool isValid = _verifyPurchase(purchase);
        if (isValid) {
          await _activatePremium(purchase);
        }
      }

      if (purchase.status == PurchaseStatus.canceled) {
        debugPrint('SubscriptionService: Purchase canceled.');
      }

      // Selesaikan transaksi
      if (purchase.pendingCompletePurchase) {
        await InAppPurchase.instance.completePurchase(purchase);
      }
    }
  }

  /// Validasi dasar pembelian (untuk keamanan penuh gunakan server-side validation).
  bool _verifyPurchase(PurchaseDetails purchase) {
    // Untuk saat ini, validasi lokal: cukup cek status dan ID produk yang dikenal
    return _productIds.contains(purchase.productID) &&
        (purchase.status == PurchaseStatus.purchased ||
            purchase.status == PurchaseStatus.restored);
  }

  /// Aktifkan status premium setelah pembelian berhasil diverifikasi.
  Future<void> _activatePremium(PurchaseDetails purchase) async {
    _isPremium = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_premiumKey, true);

    // Simpan tanggal expiry berdasarkan jenis produk
    DateTime expiry;
    if (purchase.productID == kMonthlyId) {
      expiry = DateTime.now().add(const Duration(days: 31));
    } else {
      expiry = DateTime.now().add(const Duration(days: 366));
    }
    await prefs.setString(_premiumExpiryKey, expiry.toIso8601String());
    debugPrint('SubscriptionService: Premium activated until $expiry');
  }

  /// Muat status premium dari cache lokal.
  Future<void> _loadPremiumFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final isPremiumStored = prefs.getBool(_premiumKey) ?? false;
      final expiryStr = prefs.getString(_premiumExpiryKey);

      if (isPremiumStored && expiryStr != null) {
        final expiry = DateTime.tryParse(expiryStr);
        if (expiry != null && expiry.isAfter(DateTime.now())) {
          _isPremium = true;
          debugPrint('SubscriptionService: Premium aktif (cache) sampai $expiry');
        } else {
          // Sudah kadaluarsa
          _isPremium = false;
          await prefs.setBool(_premiumKey, false);
          debugPrint('SubscriptionService: Premium sudah kadaluarsa.');
        }
      }
    } catch (e) {
      debugPrint('SubscriptionService: Error loading cache: $e');
    }
  }

  /// Cek apakah pengguna saat ini berstatus Premium.
  bool isPremium() => _isPremium;

  /// Dapatkan tanggal kadaluarsa Premium (null jika tidak aktif).
  Future<DateTime?> getPremiumExpiry() async {
    final prefs = await SharedPreferences.getInstance();
    final expiryStr = prefs.getString(_premiumExpiryKey);
    return expiryStr != null ? DateTime.tryParse(expiryStr) : null;
  }

  /// Mulai proses pembelian langganan.
  /// [productId] — gunakan [kMonthlyId] atau [kYearlyId].
  Future<bool> purchase(String productId) async {
    if (!_isAvailable) {
      debugPrint('SubscriptionService: Billing tidak tersedia.');
      return false;
    }

    final ProductDetails? product = _products
        .cast<ProductDetails?>()
        .firstWhere((p) => p?.id == productId, orElse: () => null);

    if (product == null) {
      debugPrint('SubscriptionService: Produk $productId tidak ditemukan.');
      return false;
    }

    final PurchaseParam purchaseParam = PurchaseParam(productDetails: product);
    try {
      await InAppPurchase.instance.buyNonConsumable(purchaseParam: purchaseParam);
      return true;
    } catch (e) {
      debugPrint('SubscriptionService: Error saat purchase: $e');
      return false;
    }
  }

  /// Pulihkan pembelian (untuk user ganti HP / reinstall).
  Future<void> restorePurchases() async {
    if (!_isAvailable) return;
    await InAppPurchase.instance.restorePurchases();
  }

  void dispose() {
    _subscription?.cancel();
  }
}
