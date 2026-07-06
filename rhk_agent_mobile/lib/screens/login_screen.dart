import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Login Screen — Google Sign-In with Animations & Disclaimer
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with TickerProviderStateMixin {
  late AnimationController _controller;
  late AnimationController _floatController;
  late Animation<double> _logoScale;
  late Animation<double> _textFade;
  late Animation<Offset> _cardSlide;
  late Animation<double> _cardFade;
  late Animation<Offset> _floatAnimation;

  String _appVersion = '';

  int _currentFeatureIndex = 0;
  late Timer _featureTimer;
  final List<Map<String, String>> _features = [
    {
      'title': 'Asisten Cerdas Laporan',
      'desc': 'Membuat narasi laporan resmi dalam hitungan detik'
    },
    {
      'title': 'Konverter PDF Verkom',
      'desc': 'Mengubah file CSV verifikasi komitmen PKH menjadi tabel PDF rapi siap cetak'
    },
    {
      'title': 'Penyimpanan Awan Pribadi',
      'desc': 'Semua data disimpan aman di Google Drive Anda secara langsung'
    },
    {
      'title': 'Keamanan & Privasi 100%',
      'desc': 'Data Anda tidak dikirim ke server developer, aman di akun Google Anda'
    },
  ];

  @override
  void initState() {
    super.initState();
    _initPackageInfo();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1400),
      vsync: this,
    );

    _floatController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat(reverse: true);

    _floatAnimation = Tween<Offset>(
      begin: const Offset(0, -0.05),
      end: const Offset(0, 0.05),
    ).animate(CurvedAnimation(
      parent: _floatController,
      curve: Curves.easeInOutSine,
    ));

    _logoScale = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.6, curve: Curves.elasticOut),
    );

    _textFade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.3, 0.7, curve: Curves.easeIn),
    );

    _cardSlide = Tween<Offset>(
      begin: const Offset(0.0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.5, 1.0, curve: Curves.fastOutSlowIn),
    ));

    _cardFade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.5, 1.0, curve: Curves.easeIn),
    );

    _controller.forward();

    _featureTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (mounted) {
        setState(() {
          _currentFeatureIndex = (_currentFeatureIndex + 1) % _features.length;
        });
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _floatController.dispose();
    _featureTimer.cancel();
    super.dispose();
  }

  Future<void> _initPackageInfo() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (mounted) {
        setState(() {
          _appVersion = 'v${info.version}';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _appVersion = 'v1.0.0'; // Fallback
        });
      }
    }
  }

  void _showDisclaimerDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
          title: Row(
            children: [
              const Icon(Icons.shield_outlined, color: AppColors.navy, size: 28),
              const SizedBox(width: 10),
              Text(
                'Komitmen Keamanan',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 17,
                  color: isDark ? Colors.white : AppColors.navyDark,
                ),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Aplikasi Aspend memerlukan akses ke Google Drive & Sheets Anda sebagai basis data pribadi. Berikut penjelasan penting:',
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.45,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.white70 : Colors.black87,
                  ),
                ),
                const SizedBox(height: 16),
                _buildDisclaimerPoint(
                  context,
                  Icons.vpn_key_rounded,
                  'Penyediaan API Key Premium',
                  'Aplikasi ini dilengkapi API Key premium default agar Anda langsung bisa mencoba fitur Asisten Pendamping. Namun, Anda juga bebas mengubahnya menggunakan API Key pribadi Anda di menu Pengaturan.',
                ),
                _buildDisclaimerPoint(
                  context,
                  Icons.storage_rounded,
                  'Penyimpanan Awan Mandiri',
                  'Aplikasi tidak menggunakan server pihak ketiga. Semua data tersimpan eksklusif di dalam Google Drive Anda sendiri.',
                ),
                _buildDisclaimerPoint(
                  context,
                  Icons.gpp_maybe_rounded,
                  'Peringatan Keamanan Google',
                  'Saat pertama kali login, pastikan Anda MENCENTANG KOTAK KOSONG di sebelah logo Google Drive, lalu klik tombol Lanjutkan di bagian bawah. Jika kotak tersebut tidak dicentang, aplikasi Aspend tidak akan bisa membuat laporan PDF dan menyimpan foto Anda.',
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Batal', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                _handleSignInActual(context);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.navy,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              child: const Text('Saya Mengerti, Lanjutkan', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  Widget _buildDisclaimerPoint(BuildContext context, IconData icon, String title, String desc) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.navy.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AppColors.navy, size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 12.5,
                    color: isDark ? Colors.white : AppColors.navyDark,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  desc,
                  style: TextStyle(
                    fontSize: 11,
                    height: 1.4,
                    color: isDark ? AppColors.textSecondaryDark : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.navyDark,
              AppColors.navy,
              Color(0xFF1E6A9E),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Staged Animation — Logo
                  ScaleTransition(
                    scale: _logoScale,
                    child: SlideTransition(
                      position: _floatAnimation,
                      child: Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(28),
                          border: Border.all(
                            color: Colors.white.withOpacity(0.4),
                            width: 2,
                          ),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(26),
                          child: Image.asset(
                            'assets/images/app_icon.png',
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Staged Animation — Title & Slideshow
                  FadeTransition(
                    opacity: _textFade,
                    child: Column(
                      children: [
                        // Animated Text Slideshow (Muncul bergantian, bergerak dari bawah ke atas)
                        Container(
                          height: 80,
                          alignment: Alignment.center,
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 600),
                            transitionBuilder: (Widget child, Animation<double> animation) {
                              return FadeTransition(
                                opacity: animation,
                                child: SlideTransition(
                                  position: Tween<Offset>(
                                    begin: const Offset(0.0, 0.3),
                                    end: Offset.zero,
                                  ).animate(animation),
                                  child: child,
                                ),
                              );
                            },
                            child: KeyedSubtree(
                              key: ValueKey<int>(_currentFeatureIndex),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    _features[_currentFeatureIndex]['title']!,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 16),
                                    child: Text(
                                      _features[_currentFeatureIndex]['desc']!,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.white.withOpacity(0.75),
                                        height: 1.4,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Staged Animation — Slide Up Card
                  SlideTransition(
                    position: _cardSlide,
                    child: FadeTransition(
                      opacity: _cardFade,
                      child: Container(
                        padding: const EdgeInsets.all(28),
                        decoration: BoxDecoration(
                          color: Theme.of(context).cardTheme.color ?? Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(Theme.of(context).brightness == Brightness.dark ? 0.4 : 0.2),
                              blurRadius: 30,
                              offset: const Offset(0, 15),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            // Welcome text
                            const Icon(
                              Icons.lock_open_rounded,
                              size: 40,
                              color: AppColors.navy,
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'Selamat Datang',
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                                color: AppColors.navy,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Masuk dengan akun Google Anda untuk mengakses Asisten Pendamping (Aspend)',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: Theme.of(context).brightness == Brightness.dark ? AppColors.textSecondaryDark : Colors.grey[600],
                                height: 1.5,
                              ),
                            ),
                            const SizedBox(height: 28),

                            // Google Sign-In Button
                            Consumer<AuthProvider>(
                              builder: (context, auth, _) {
                                if (auth.isLoading) {
                                  return Container(
                                    width: double.infinity,
                                    height: 52,
                                    decoration: BoxDecoration(
                                      color: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : Colors.grey[100],
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: const Center(
                                      child: SizedBox(
                                        width: 24,
                                        height: 24,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.5,
                                          valueColor: AlwaysStoppedAnimation(
                                            AppColors.navy,
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                }

                                return Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    onTap: () => _handleSignIn(context),
                                    borderRadius: BorderRadius.circular(14),
                                    child: Container(
                                      width: double.infinity,
                                      height: 52,
                                      decoration: BoxDecoration(
                                        color: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : Colors.white,
                                        borderRadius: BorderRadius.circular(14),
                                        border: Border.all(
                                          color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[800]! : Colors.grey[300]!,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withOpacity(0.06),
                                            blurRadius: 8,
                                            offset: const Offset(0, 2),
                                          ),
                                        ],
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          // Google "G" logo
                                          Container(
                                            width: 24,
                                            height: 24,
                                            decoration: BoxDecoration(
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: const Text(
                                              'G',
                                              style: TextStyle(
                                                fontSize: 22,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFF4285F4),
                                              ),
                                              textAlign: TextAlign.center,
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Text(
                                            'Masuk dengan Google',
                                            style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w600,
                                              color: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF444444),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                            const SizedBox(height: 16),

                            // Error message
                            Consumer<AuthProvider>(
                              builder: (context, auth, _) {
                                if (auth.errorMessage != null) {
                                  final isDark = Theme.of(context).brightness == Brightness.dark;
                                  return Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: isDark ? Colors.red[900]!.withOpacity(0.3) : Colors.red[50],
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isDark ? Colors.red[900]! : Colors.red[200]!,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.error_outline,
                                          color: isDark ? Colors.red[200] : Colors.red[700],
                                          size: 20,
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            auth.errorMessage!,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: isDark ? Colors.red[200] : Colors.red[700],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }
                                return const SizedBox.shrink();
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Info keamanan
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.shield_rounded,
                        size: 16,
                        color: Colors.white.withOpacity(0.6),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Data tersimpan di Google Drive Anda',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withOpacity(0.6),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _appVersion,
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withOpacity(0.4),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _handleSignIn(BuildContext context) {
    _showDisclaimerDialog(context);
  }

  Future<void> _handleSignInActual(BuildContext context) async {
    final auth = context.read<AuthProvider>();
    final success = await auth.signIn();

    if (success && mounted) {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }
}
