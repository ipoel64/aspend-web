import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'subscription_service.dart';

/// Service untuk mengelola iklan Google AdMob.
/// Menampilkan iklan Interstitial setiap 5 kali penyimpanan PDF.
/// Iklan TIDAK akan ditampilkan jika pengguna berstatus Premium.
class AdService {
  // Singleton pattern
  AdService._internal();
  static final AdService instance = AdService._internal();

  // AdMob IDs
  static const String _adUnitId = 'ca-app-pub-6905639525940930/3476030945';

  // Counter key
  static const String _saveCountKey = 'pdf_save_count';
  static const int _adInterval = 5;

  InterstitialAd? _interstitialAd;
  bool _isAdLoaded = false;

  // Context untuk menampilkan dialog tawaran Premium setelah iklan
  BuildContext? _appContext;

  /// Daftarkan context aplikasi agar dialog Premium bisa ditampilkan.
  void setContext(BuildContext context) {
    _appContext = context;
  }

  /// Inisialisasi service dan mulai memuat iklan pertama.
  Future<void> init() async {
    await MobileAds.instance.initialize();
    
    // Terapkan filter ketat dari sisi aplikasi (Rating G = General/Semua Umur)
    // Ini secara paksa memblokir iklan judi, dewasa, kekerasan, dll.
    // tagForChildDirectedTreatment = true akan memblokir iklan dewasa & judi secara ekstra ketat.
    final RequestConfiguration requestConfiguration = RequestConfiguration(
      maxAdContentRating: MaxAdContentRating.g,
      tagForChildDirectedTreatment: TagForChildDirectedTreatment.yes,
      tagForUnderAgeOfConsent: TagForUnderAgeOfConsent.yes,
    );
    await MobileAds.instance.updateRequestConfiguration(requestConfiguration);

    await _loadInterstitialAd();
  }

  /// Memuat iklan Interstitial dari jaringan AdMob.
  Future<void> _loadInterstitialAd() async {
    // Jika user Premium, tidak perlu muat iklan
    if (SubscriptionService.instance.isPremium()) return;

    await InterstitialAd.load(
      adUnitId: _adUnitId,
      request: const AdRequest(
        keywords: ['education', 'social', 'government', 'office', 'productivity'],
        nonPersonalizedAds: true,
      ),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialAd = ad;
          _isAdLoaded = true;
          debugPrint('AdService: Interstitial ad loaded successfully.');

          // Set callback for when ad is dismissed
          _interstitialAd!.fullScreenContentCallback =
              FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              debugPrint('AdService: Ad dismissed.');
              ad.dispose();
              _interstitialAd = null;
              _isAdLoaded = false;
              // Pre-load next ad
              _loadInterstitialAd();
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              debugPrint('AdService: Ad failed to show: $error');
              ad.dispose();
              _interstitialAd = null;
              _isAdLoaded = false;
              // Retry loading
              _loadInterstitialAd();
            },
          );
        },
        onAdFailedToLoad: (error) {
          debugPrint('AdService: Failed to load interstitial ad: $error');
          _isAdLoaded = false;
        },
      ),
    );
  }

  /// Dipanggil setiap kali PDF berhasil disimpan/di-generate.
  /// Menaikkan counter dan menampilkan iklan jika sudah mencapai kelipatan 5.
  /// Jika pengguna Premium → langsung panggil [onComplete] tanpa iklan.
  ///
  /// [onComplete] callback dipanggil setelah iklan ditutup (atau langsung
  /// jika iklan tidak ditampilkan).
  Future<void> onPdfSaved({VoidCallback? onComplete}) async {
    try {
      // ── Cek status Premium terlebih dahulu ──
      if (SubscriptionService.instance.isPremium()) {
        debugPrint('AdService: User Premium, skipping ad.');
        onComplete?.call();
        return;
      }

      final prefs = await SharedPreferences.getInstance();
      int saveCount = (prefs.getInt(_saveCountKey) ?? 0) + 1;
      await prefs.setInt(_saveCountKey, saveCount);

      debugPrint('AdService: PDF save count = $saveCount / $_adInterval');

      if (saveCount >= _adInterval) {
        // Reset counter
        await prefs.setInt(_saveCountKey, 0);

        // Show ad if loaded
        if (_isAdLoaded && _interstitialAd != null) {
          debugPrint('AdService: Showing interstitial ad...');

          // Override dismiss callback to include onComplete + tawaran Premium
          _interstitialAd!.fullScreenContentCallback =
              FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              debugPrint('AdService: Ad dismissed after PDF save.');
              ad.dispose();
              _interstitialAd = null;
              _isAdLoaded = false;
              _loadInterstitialAd();
              onComplete?.call();
              // Tampilkan dialog tawaran Premium setelah iklan ditutup
              _showPremiumOfferDialog();
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              debugPrint('AdService: Ad failed to show: $error');
              ad.dispose();
              _interstitialAd = null;
              _isAdLoaded = false;
              _loadInterstitialAd();
              onComplete?.call();
            },
          );

          _interstitialAd!.show();
        } else {
          debugPrint('AdService: Ad not loaded, skipping. Reloading...');
          _loadInterstitialAd();
          onComplete?.call();
          // Tetap tampilkan dialog tawaran Premium meski iklan gagal tampil
          _showPremiumOfferDialog();
        }
      } else {
        onComplete?.call();
      }
    } catch (e) {
      debugPrint('AdService: Error in onPdfSaved: $e');
      onComplete?.call();
    }
  }

  /// Tampilkan dialog mini tawaran Premium setelah iklan ditutup.
  void _showPremiumOfferDialog() {
    final context = _appContext;
    if (context == null) return;
    // Pastikan context masih valid
    if (!context.mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFD700), Color(0xFFFFA500)],
                ),
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: Colors.amber.withOpacity(0.3), blurRadius: 16, spreadRadius: 3)],
              ),
              child: const Icon(Icons.workspace_premium_rounded, size: 32, color: Colors.white),
            ),
            const SizedBox(height: 14),
            const Text(
              'Lelah dengan Iklan?',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF1A3A5C)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              'Berlangganan Aspend Premium dan nikmati pembuatan laporan PDF tanpa gangguan iklan.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, color: Colors.black54, height: 1.5),
            ),
            const SizedBox(height: 6),
            const Text(
              'Mulai dari Rp 10.000/bulan',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1A6A4C)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Nanti Saja', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pushNamed(context, '/subscription');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1A3A5C),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Lihat Paket', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  /// Dispose resources saat aplikasi ditutup.
  void dispose() {
    _interstitialAd?.dispose();
  }
}
