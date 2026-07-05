import 'package:flutter/material.dart';
import '../../config/app_theme.dart';
import '../../services/subscription_service.dart';

/// Halaman penawaran langganan Premium Aspend (Bebas Iklan).
class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  bool _isLoading = false;
  bool _isPremium = false;
  DateTime? _expiryDate;
  String _selectedPlan = SubscriptionService.kYearlyId; // default tahunan (lebih hemat)

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 700),
      vsync: this,
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeIn);
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero)
        .animate(CurvedAnimation(parent: _animController, curve: Curves.fastOutSlowIn));
    _animController.forward();
    _loadStatus();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    final expiry = await SubscriptionService.instance.getPremiumExpiry();
    if (mounted) {
      setState(() {
        _isPremium = SubscriptionService.instance.isPremium();
        _expiryDate = expiry;
      });
    }
  }

  Future<void> _subscribe() async {
    if (!SubscriptionService.instance.isAvailable) {
      _showMessage('Google Play Billing tidak tersedia di perangkat ini.', isError: true);
      return;
    }
    setState(() => _isLoading = true);
    final success = await SubscriptionService.instance.purchase(_selectedPlan);
    if (mounted) {
      setState(() => _isLoading = false);
      if (!success) {
        _showMessage('Gagal memulai proses pembayaran. Silakan coba lagi.', isError: true);
      }
    }
  }

  Future<void> _restore() async {
    setState(() => _isLoading = true);
    await SubscriptionService.instance.restorePurchases();
    await Future.delayed(const Duration(seconds: 2)); // beri waktu stream update
    await _loadStatus();
    if (mounted) {
      setState(() => _isLoading = false);
      _showMessage(_isPremium
          ? 'Pembelian berhasil dipulihkan! Selamat menikmati Aspend Premium.'
          : 'Tidak ditemukan pembelian aktif untuk akun ini.');
    }
  }

  void _showMessage(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? Colors.red[700] : Colors.green[700],
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : const Color(0xFFF5F7FA),
      appBar: AppBar(
        title: const Text('Aspend Premium'),
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _isPremium ? _buildActiveView(isDark) : _buildOfferView(isDark),
    );
  }

  // ─── Tampilan saat sudah Premium ──────────────────────────────────────────
  Widget _buildActiveView(bool isDark) {
    final formattedDate = _expiryDate != null
        ? '${_expiryDate!.day}/${_expiryDate!.month}/${_expiryDate!.year}'
        : '-';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFD700), Color(0xFFFFA500)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: Colors.amber.withOpacity(0.4), blurRadius: 30, spreadRadius: 5)],
              ),
              child: const Icon(Icons.workspace_premium_rounded, size: 60, color: Colors.white),
            ),
            const SizedBox(height: 24),
            const Text(
              'Anda Sudah Premium! 🎉',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.navyDark),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Aktif sampai $formattedDate',
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            const SizedBox(height: 32),
            _buildBenefitItem(Icons.block_rounded, 'Tidak Ada Iklan', 'Buat PDF tanpa gangguan iklan'),
            _buildBenefitItem(Icons.star_rounded, 'Fitur Prioritas', 'Nikmati semua fitur tanpa batas'),
            _buildBenefitItem(Icons.support_agent_rounded, 'Dukungan Prioritas', 'Keluhan Anda akan diproses lebih cepat'),
          ],
        ),
      ),
    );
  }

  // ─── Tampilan penawaran berlangganan ─────────────────────────────────────
  Widget _buildOfferView(bool isDark) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Hero banner
              _buildHeroBanner(),
              const SizedBox(height: 24),

              // Manfaat Premium
              const Text('Yang Anda Dapatkan:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.navyDark)),
              const SizedBox(height: 12),
              _buildBenefitItem(Icons.block_rounded, 'Bebas Iklan Selamanya', 'Tidak ada iklan muncul saat membuat PDF'),
              _buildBenefitItem(Icons.picture_as_pdf_rounded, 'PDF Tanpa Batas', 'Buat laporan sebanyak apapun tanpa jeda iklan'),
              _buildBenefitItem(Icons.mic_rounded, 'Semua Fitur Unlocked', 'Termasuk narasi AI, rekap, dan pencarian'),
              _buildBenefitItem(Icons.support_agent_rounded, 'Dukungan Prioritas', 'Keluhan Anda mendapat penanganan lebih cepat'),
              const SizedBox(height: 24),

              // Pilihan paket
              const Text('Pilih Paket:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.navyDark)),
              const SizedBox(height: 12),
              _buildPlanCard(
                id: SubscriptionService.kYearlyId,
                title: 'Tahunan',
                price: 'Rp 100.000 / tahun',
                sub: 'Hemat Rp 20.000 — Rp 8.333/bulan',
                badge: 'TERBAIK',
                badgeColor: const Color(0xFFFF6B35),
              ),
              const SizedBox(height: 12),
              _buildPlanCard(
                id: SubscriptionService.kMonthlyId,
                title: 'Bulanan',
                price: 'Rp 10.000 / bulan',
                sub: 'Bayar setiap bulan, bisa batalkan kapan saja',
              ),
              const SizedBox(height: 28),

              // Tombol Subscribe
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _subscribe,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.navy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 4,
                  ),
                  child: _isLoading
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                      : const Text('Berlangganan Sekarang', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 12),

              // Tombol Pulihkan Pembelian
              Center(
                child: TextButton(
                  onPressed: _isLoading ? null : _restore,
                  child: const Text('Pulihkan Pembelian', style: TextStyle(color: AppColors.navy, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text(
                  'Berlangganan dikelola melalui Google Play.\nAnda bisa batalkan kapan saja di setelan Google Play.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: Colors.grey[500], height: 1.5),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeroBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.navyDark, Color(0xFF1E6A9E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.workspace_premium_rounded, size: 40, color: Color(0xFFFFD700)),
          ),
          const SizedBox(height: 16),
          const Text(
            'Aspend Premium',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.5),
          ),
          const SizedBox(height: 6),
          Text(
            'Nikmati semua fitur tanpa gangguan iklan',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Colors.white.withOpacity(0.8)),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanCard({
    required String id,
    required String title,
    required String price,
    required String sub,
    String? badge,
    Color? badgeColor,
  }) {
    final isSelected = _selectedPlan == id;
    return GestureDetector(
      onTap: () => setState(() => _selectedPlan = id),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.navy.withOpacity(0.08) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.navy : Colors.grey[200]!,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [BoxShadow(color: AppColors.navy.withOpacity(0.15), blurRadius: 12, offset: const Offset(0, 4))]
              : [],
        ),
        child: Row(
          children: [
            // Radio indicator
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: isSelected ? AppColors.navy : Colors.grey[400]!, width: 2),
                color: isSelected ? AppColors.navy : Colors.transparent,
              ),
              child: isSelected ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
            ),
            const SizedBox(width: 14),
            // Plan info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.navyDark)),
                      if (badge != null) ...[ 
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: badgeColor ?? Colors.green, borderRadius: BorderRadius.circular(20)),
                          child: Text(badge, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(price, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.navy)),
                  Text(sub, style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBenefitItem(IconData icon, String title, String desc) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.navy.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: AppColors.navy),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.navyDark)),
                Text(desc, style: TextStyle(fontSize: 11, color: Colors.grey[600], height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
