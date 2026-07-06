import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/app_theme.dart';
import '../../config/constants.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/ai_service.dart';
import '../../services/notification_service.dart';
import '../../services/subscription_service.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'dart:typed_data';
import 'widgets/digital_signature_dialog.dart';

/// Settings Screen — Profil, Tanda Tangan, Konfigurasi AI
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _namaController = TextEditingController();
  final _nipController = TextEditingController();
  final _jabatanController = TextEditingController();
  final _kabupatenController = TextEditingController();
  bool _isLoading = false;
  bool _isSaving = false;
  
  String _adminWhatsapp = '+6283162019160';

  // AI Config State
  String _selectedProvider = 'openrouter';
  String _selectedModel = 'google/gemini-3.5-flash';
  final _apiKeyController = TextEditingController();
  bool _isLoadingConfig = false;
  bool _isSavingConfig = false;
  bool _isTestingConnection = false;
  bool _obscureApiKey = true;

  // Notification State
  bool _notificationEnabled = true;
  TimeOfDay _notificationTime = const TimeOfDay(hour: 17, minute: 0);

  String _appVersion = '';
  String _packageName = 'com.ipol.aspend';

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadAiConfig();
    _loadNotificationConfig();
  }

  Future<void> _loadNotificationConfig() async {
    final service = NotificationService();
    final enabled = await service.isNotificationEnabled();
    final time = await service.getScheduledTime();
    if (mounted) {
      setState(() {
        _notificationEnabled = enabled;
        _notificationTime = TimeOfDay(hour: time['hour']!, minute: time['minute']!);
      });
    }
  }



  void _loadProfile() {
    final auth = context.read<AuthProvider>();
    final profile = auth.userProfile;
    if (profile != null) {
      _namaController.text = profile.nama;
      _nipController.text = profile.nip;
      _jabatanController.text = profile.jabatan;
      _kabupatenController.text = profile.kabupatenKota;
    }
  }

  @override
  void dispose() {
    _namaController.dispose();
    _nipController.dispose();
    _jabatanController.dispose();
    _kabupatenController.dispose();
    _apiKeyController.dispose();
    super.dispose();
  }

  Future<void> _initPackageInfo() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (mounted) {
        setState(() {
          _appVersion = 'v${info.version}';
          if (info.packageName.isNotEmpty) {
            _packageName = info.packageName;
          }
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Pengaturan'),
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        actions: [
          // Logout
          IconButton(
            onPressed: _handleLogout,
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Keluar',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Consumer<AuthProvider>(
          builder: (context, auth, _) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!auth.isProfileComplete) ...[
                  _buildIncompleteWarningBanner(auth),
                  const SizedBox(height: 16),
                ],
                // Profile Card
                _buildProfileCard(auth),
                const SizedBox(height: 16),

                // Profile Form
                _buildProfileForm(auth),
                const SizedBox(height: 16),

                // Signature Section
                _buildSignatureSection(auth),
                const SizedBox(height: 16),

                // AI Config Section
                _buildAiConfigSection(),
                const SizedBox(height: 16),

                // ── Kartu Premium ──
                _buildPremiumCard(),
                const SizedBox(height: 16),

                // Contact Admin Section
                _buildContactAdminSection(auth),
                const SizedBox(height: 16),

                // Notification Settings
                _buildNotificationSection(),
                const SizedBox(height: 16),

                // Appearance Settings (Light/Dark Mode)
                _buildAppearanceSection(),
                const SizedBox(height: 16),

                // Account Info
                _buildAccountInfo(auth),
                const SizedBox(height: 16),

                // Update Button
                _buildUpdateAppVersion(),

                const SizedBox(height: 80),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildPremiumCard() {
    final isPremium = SubscriptionService.instance.isPremium();
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/subscription'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          gradient: isPremium
              ? const LinearGradient(
                  colors: [Color(0xFFFFD700), Color(0xFFFFA500)],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                )
              : const LinearGradient(
                  colors: [Color(0xFF1A3A5C), Color(0xFF1E6A9E)],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: isPremium
                  ? Colors.amber.withOpacity(0.3)
                  : AppColors.navy.withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Icon(
              isPremium ? Icons.workspace_premium_rounded : Icons.workspace_premium_outlined,
              color: Colors.white,
              size: 28,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isPremium ? '✓ Aspend Premium Aktif' : 'Aspend Premium',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    isPremium
                        ? 'Anda menikmati aplikasi tanpa iklan'
                        : 'Hapus iklan • Mulai Rp 10.000/bulan',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withOpacity(0.85),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: Colors.white.withOpacity(0.8),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileCard(AuthProvider auth) {
    return Stack(
      children: [
        Container(
          padding: const EdgeInsets.only(left: 20, right: 20, top: 24, bottom: 20),
          decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.navyDark, AppColors.navy],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          // Avatar
          GestureDetector(
            onTap: _isLoading ? null : () => _uploadProfilePhoto(auth),
            child: Stack(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: AppColors.gold.withOpacity(0.3),
                  child: _isLoading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation(Colors.white),
                          ),
                        )
                      : (auth.userProfile?.photoFileId.isNotEmpty == true
                          ? ClipOval(
                              child: Image.network(
                                'https://drive.google.com/thumbnail?id=${auth.userProfile!.photoFileId}&sz=w200',
                                width: 64,
                                height: 64,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => _buildAvatarInitial(auth),
                              ),
                            )
                          : _buildAvatarInitial(auth)),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppColors.gold,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.camera_alt, size: 12, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  auth.userProfile?.nama.isNotEmpty == true
                      ? auth.userProfile!.nama
                      : (auth.currentUser?.displayName ?? 'Pengguna'),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  auth.currentUser?.email ?? '',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withOpacity(0.7),
                  ),
                ),
                if (auth.userProfile?.jabatan.isNotEmpty == true) ...[
                  const SizedBox(height: 2),
                  Text(
                    auth.userProfile!.jabatan,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.gold.withOpacity(0.8),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    ),
    if (_appVersion.isNotEmpty)
      Positioned(
        top: 8,
        left: 14,
        child: Text(
          _appVersion,
          style: TextStyle(
            color: Colors.white.withOpacity(0.5),
            fontSize: 10,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    ],
    );
  }

  Widget _buildAvatarInitial(AuthProvider auth) {
    final name = auth.userProfile?.nama.trim().isNotEmpty == true
        ? auth.userProfile!.nama
        : (auth.currentUser?.displayName ?? 'U');
    final initial = name.trim().isEmpty ? 'U' : name.trim().substring(0, 1).toUpperCase();
    return Text(
      initial,
      style: const TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w700,
        color: AppColors.gold,
      ),
    );
  }

  Widget _buildProfileForm(AuthProvider auth) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Profil Pengguna',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.navyDark,
            ),
          ),
          const SizedBox(height: 16),

          _buildFormField('Nama Lengkap', _namaController, Icons.person_rounded),
          const SizedBox(height: 12),
          _buildFormField('NIP', _nipController, Icons.badge_rounded),
          const SizedBox(height: 12),
          _buildFormField('Jabatan', _jabatanController, Icons.work_rounded),
          const SizedBox(height: 12),
          _buildFormField('Kabupaten/Kota', _kabupatenController, Icons.location_city_rounded),
          const SizedBox(height: 20),

          // Save button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _isSaving ? null : () => _saveProfile(auth),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.navy,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSaving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation(Colors.white),
                      ),
                    )
                  : const Text('Simpan Profil', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormField(String label, TextEditingController controller, IconData icon) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(fontSize: 13, color: Colors.grey[600]),
        prefixIcon: Icon(icon, size: 20, color: AppColors.navy.withOpacity(0.5)),
        filled: true,
        fillColor: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : AppColors.bgLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
    );
  }

  Widget _buildSignatureSection(AuthProvider auth) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.draw_rounded, color: AppColors.navy, size: 20),
              SizedBox(width: 8),
              Text(
                'Tanda Tangan Digital',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Upload gambar tanda tangan (PNG/JPG, maks 1 MB)',
            style: TextStyle(fontSize: 12, color: Colors.grey[500]),
          ),
          const SizedBox(height: 8),

          // Signature preview
          if (auth.userProfile?.signatureFileId.isNotEmpty == true)
            Container(
              width: double.infinity,
              height: 100,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: AppColors.bgLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[200]!),
              ),
              child: Image.network(
                'https://drive.google.com/thumbnail?id=${auth.userProfile!.signatureFileId}&sz=w300',
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Center(
                  child: Icon(Icons.image_not_supported, color: Colors.grey[300]),
                ),
              ),
            ),

          // Signature buttons
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isLoading ? null : () async {
                    final Uint8List? signatureBytes = await showDialog<Uint8List>(
                      context: context,
                      builder: (ctx) => const DigitalSignatureDialog(),
                    );
                    if (signatureBytes != null) {
                      _uploadSignatureBytes(auth, signatureBytes);
                    }
                  },
                  icon: const Icon(Icons.draw_rounded, size: 18),
                  label: const Text('Buat Langsung'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.navy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isLoading ? null : () => _uploadSignature(auth),
                  icon: _isLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation(AppColors.navy),
                          ),
                        )
                      : const Icon(Icons.upload_file_rounded, size: 18),
                  label: Text(_isLoading ? 'Proses...' : 'Upload File'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.navy,
                    side: const BorderSide(color: AppColors.navy),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _launchWhatsApp() async {
    String cleanNumber = _adminWhatsapp.replaceAll(RegExp(r'[^\d]'), '');
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '62' + cleanNumber.substring(1);
    } else if (cleanNumber.startsWith('8')) {
      cleanNumber = '62' + cleanNumber;
    }
    final url = Uri.parse('https://wa.me/$cleanNumber?text=Halo%20Admin%20Aspend%2C%20saya%20memerlukan%20bantuan%20terkait%20aplikasi.');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tidak dapat membuka WhatsApp')),
        );
      }
    }
  }  Widget _buildContactAdminSection(AuthProvider auth) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.support_agent_rounded, color: AppColors.navy, size: 20),
              SizedBox(width: 8),
              Text(
                'Layanan Bantuan',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Hubungi admin aplikasi untuk pertanyaan atau kendala teknis.',
            style: TextStyle(fontSize: 12, color: Colors.grey[500]),
          ),
          const SizedBox(height: 16),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              backgroundColor: Colors.green.withOpacity(0.1),
              child: const Icon(Icons.chat_rounded, color: Colors.green),
            ),
            title: const Text('Admin Aspend', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            subtitle: Text(_adminWhatsapp, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
            trailing: ElevatedButton.icon(
              onPressed: _launchWhatsApp,
              icon: const Icon(Icons.open_in_new_rounded, size: 14),
              label: const Text('Chat WA', style: TextStyle(fontSize: 12)),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIncompleteWarningBanner(AuthProvider auth) {
    final missingItems = <String>[];
    final profile = auth.userProfile;
    if (profile == null) {
      missingItems.add('Data profil belum dimuat');
    } else {
      if (profile.nama.trim().isEmpty ||
          profile.nip.trim().isEmpty ||
          profile.jabatan.trim().isEmpty ||
          profile.kabupatenKota.trim().isEmpty) {
        missingItems.add('Data Profil (Nama, NIP, Jabatan, Kabupaten/Kota)');
      }
      if (profile.signatureFileId.trim().isEmpty) {
        missingItems.add('Tanda Tangan Digital');
      }
    }
    
    if (_apiKeyController.text.trim().isEmpty) {
      missingItems.add('API Key Asisten Pendamping');
    }
    
    final baseItemsFilled = profile != null &&
        profile.nama.trim().isNotEmpty &&
        profile.nip.trim().isNotEmpty &&
        profile.jabatan.trim().isNotEmpty &&
        profile.kabupatenKota.trim().isNotEmpty &&
        profile.signatureFileId.trim().isNotEmpty &&
        _apiKeyController.text.trim().isNotEmpty;
        


    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.shade300, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.gpp_maybe_rounded, color: Colors.red.shade700, size: 24),
              const SizedBox(width: 8),
              Text(
                'Konfigurasi Wajib Diisi!',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Colors.red.shade800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Lengkapi data berikut untuk mengaktifkan Dashboard & Pembuatan Laporan:',
            style: TextStyle(
              fontSize: 12,
              color: Colors.red.shade900,
            ),
          ),
          const SizedBox(height: 8),
          ...missingItems.map((item) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 2.0),
            child: Row(
              children: [
                Icon(Icons.fiber_manual_record, size: 8, color: Colors.red.shade700),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    item,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.red.shade800,
                    ),
                  ),
                ),
              ],
            ),
          )),
        ],
      ),
    );
  } 

  void _showApiKeyTutorial() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return DefaultTabController(
          length: 2,
          child: Container(
            height: MediaQuery.of(context).size.height * 0.75,
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Panduan API Key Asisten Pendamping',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navyDark,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const TabBar(
                  labelColor: AppColors.navy,
                  unselectedLabelColor: AppColors.textSecondary,
                  indicatorColor: AppColors.navy,
                  tabs: [
                    Tab(text: 'Groq (Rekomendasi)'),
                    Tab(text: 'OpenRouter'),
                  ],
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: TabBarView(
                    children: [
                      // Tab Groq
                      SingleChildScrollView(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 16),
                            _buildTutorialStep(1, 'Masuk ke Konsol Groq', 'Buka situs web resmi konsol Groq developer di browser.'),
                            _buildTutorialStep(2, 'Buat API Key Baru', 'Pilih menu "API Keys" di sebelah kiri, lalu klik tombol "Create API Key". Berikan nama bebas (misal: Aspend Mobile).'),
                            _buildTutorialStep(3, 'Salin & Simpan', 'Salin kunci API Key yang muncul (dimulai dengan "gsk_...") dan tempelkan di form pengaturan Aspend.'),
                            const SizedBox(height: 24),
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton.icon(
                                onPressed: () => launchUrl(Uri.parse('https://console.groq.com'), mode: LaunchMode.externalApplication),
                                icon: const Icon(Icons.open_in_browser_rounded),
                                label: const Text('Buka Konsol Groq'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.navy,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Tab OpenRouter
                      SingleChildScrollView(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 16),
                            _buildTutorialStep(1, 'Masuk ke OpenRouter', 'Buka situs resmi OpenRouter dan masuk/daftar dengan akun Google Anda.'),
                            _buildTutorialStep(2, 'Buat API Key', 'Buka menu di pojok kanan atas, pilih "Keys" di bawah bagian API, lalu klik "Create Key". Berikan nama (misal: Aspend Mobile).'),
                            _buildTutorialStep(3, 'Salin API Key', 'Salin kunci API Key yang muncul (dimulai dengan "sk-or-...") dan tempelkan di form pengaturan Aspend.'),
                            const SizedBox(height: 24),
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton.icon(
                                onPressed: () => launchUrl(Uri.parse('https://openrouter.ai/keys'), mode: LaunchMode.externalApplication),
                                icon: const Icon(Icons.open_in_browser_rounded),
                                label: const Text('Buka Konsol OpenRouter'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.navy,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTutorialStep(int stepNum, String title, String desc) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 12,
            backgroundColor: AppColors.navy.withOpacity(0.1),
            child: Text(
              '$stepNum',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.navy),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.navyDark),
                ),
                const SizedBox(height: 4),
                Text(
                  desc,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountInfo(AuthProvider auth) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Informasi Akun',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.navyDark,
            ),
          ),
          const SizedBox(height: 12),
          _buildInfoRow(Icons.email_rounded, 'Email', auth.currentUser?.email ?? '-'),
          const Divider(height: 20),
          _buildInfoRow(Icons.storage_rounded, 'Database', 'Google Sheets (Drive Anda)'),
          const Divider(height: 20),
          _buildInfoRow(Icons.shield_rounded, 'Keamanan', 'Data terenkripsi di akun Google Anda'),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 18, color: Colors.grey[400]),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[500])),
            const SizedBox(height: 2),
            Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          ],
        ),
      ],
    );
  }

  Future<void> _saveProfile(AuthProvider auth) async {
    setState(() => _isSaving = true);
    try {
      await auth.updateProfile(
        nama: _namaController.text,
        nip: _nipController.text,
        jabatan: _jabatanController.text,
        kabupatenKota: _kabupatenController.text,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Profil berhasil disimpan'),
            backgroundColor: Colors.green[700],
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal menyimpan: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _uploadProfilePhoto(AuthProvider auth) async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80, maxWidth: 500);
    if (image == null) return;

    setState(() => _isLoading = true);
    try {
      final bytes = await image.readAsBytes();
      await auth.uploadProfilePhoto(bytes, 'image/jpeg');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Foto profil berhasil diupload'),
            backgroundColor: Colors.green[700],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal upload: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _uploadSignature(AuthProvider auth) async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 90, maxWidth: 800);
    if (image == null) return;

    final bytes = await image.readAsBytes();
    if (bytes.length > 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ukuran file melebihi 1 MB'),
            backgroundColor: Colors.orange,
          ),
        );
      }
      return;
    }

    setState(() => _isLoading = true);
    try {
      await auth.uploadSignature(bytes, 'image/png');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Tanda tangan berhasil diupload'),
            backgroundColor: Colors.green[700],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal upload: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _uploadSignatureBytes(AuthProvider auth, Uint8List bytes) async {
    setState(() => _isLoading = true);
    try {
      await auth.uploadSignature(bytes, 'image/png');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Tanda tangan berhasil disimpan'),
            backgroundColor: Colors.green[700],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal menyimpan: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadAiConfig() async {
    setState(() => _isLoadingConfig = true);
    final auth = context.read<AuthProvider>();
    if (auth.sheetsService == null || auth.spreadsheetId == null) return;
    try {
      final rows = await auth.sheetsService!.getAllRows(
        auth.spreadsheetId!,
        'Config',
      );
      
      // Force selected provider and display censored API key
      setState(() {
        _selectedProvider = 'openrouter';
        _apiKeyController.text = 'sk-or-v1-61f329••••••••••••••••74f4ee26';
      });

      for (var row in rows) {
        if (row.isNotEmpty) {
          if (row[0] == 'AI_MODEL' && row.length > 1) {
            String loadedModel = row[1].toString();
            // Migrate deprecated model
            if (loadedModel == 'google/gemini-1.5-flash') {
              loadedModel = 'google/gemini-3.5-flash';
              setState(() => _selectedModel = loadedModel);
              _saveAiConfigSilent();
            } else {
              setState(() => _selectedModel = loadedModel);
            }
          }
          if (row[0] == 'ADMIN_WHATSAPP' && row.length > 1) {
            String val = row[1].toString();
            if (val != '+6283162019160') {
              setState(() => _adminWhatsapp = '+6283162019160');
              _updateAdminWhatsappInSheet(auth);
            } else {
              setState(() => _adminWhatsapp = val);
            }
          }
        }
      }
      await auth.checkProfileComplete();
    } catch (e) {
      debugPrint('Error loading AI config: $e');
    } finally {
      setState(() => _isLoadingConfig = false);
    }
  }

  Future<void> _updateAdminWhatsappInSheet(AuthProvider auth) async {
    if (auth.sheetsService == null || auth.spreadsheetId == null) return;
    try {
      int whatsappRow = await auth.sheetsService!.findRowByValue(
        auth.spreadsheetId!,
        'Config',
        0,
        'ADMIN_WHATSAPP',
      );
      if (whatsappRow != -1) {
        await auth.sheetsService!.writeCell(
          auth.spreadsheetId!,
          'Config',
          'B$whatsappRow',
          '+6283162019160',
        );
      }
    } catch (e) {
      debugPrint('Error updating admin whatsapp in sheet: $e');
    }
  }

  Future<void> _saveAiConfigSilent() async {
    final auth = context.read<AuthProvider>();
    if (auth.sheetsService == null || auth.spreadsheetId == null) return;
    
    // Find row for AI_PROVIDER
    int providerRow = await auth.sheetsService!.findRowByValue(
      auth.spreadsheetId!,
      'Config',
      0,
      'AI_PROVIDER',
    );
    if (providerRow == -1) {
      await auth.sheetsService!.appendRow(
        auth.spreadsheetId!,
        'Config',
        ['AI_PROVIDER', 'openrouter'],
      );
    } else {
      await auth.sheetsService!.writeCell(
        auth.spreadsheetId!,
        'Config',
        'B$providerRow',
        'openrouter',
      );
    }

    // Find row for AI_API_KEY
    int apiKeyRow = await auth.sheetsService!.findRowByValue(
      auth.spreadsheetId!,
      'Config',
      0,
      'AI_API_KEY',
    );
    if (apiKeyRow == -1) {
      await auth.sheetsService!.appendRow(
        auth.spreadsheetId!,
        'Config',
        ['AI_API_KEY', AppConstants.defaultOpenRouterApiKey],
      );
    } else {
      await auth.sheetsService!.writeCell(
        auth.spreadsheetId!,
        'Config',
        'B$apiKeyRow',
        AppConstants.defaultOpenRouterApiKey,
      );
    }

    // Find row for AI_MODEL
    int modelRow = await auth.sheetsService!.findRowByValue(
      auth.spreadsheetId!,
      'Config',
      0,
      'AI_MODEL',
    );
    if (modelRow == -1) {
      await auth.sheetsService!.appendRow(
        auth.spreadsheetId!,
        'Config',
        ['AI_MODEL', _selectedModel],
      );
    } else {
      await auth.sheetsService!.writeCell(
        auth.spreadsheetId!,
        'Config',
        'B$modelRow',
        _selectedModel,
      );
    }
  }

  Future<void> _saveAiConfig() async {
    setState(() => _isSavingConfig = true);
    final auth = context.read<AuthProvider>();
    if (auth.sheetsService == null || auth.spreadsheetId == null) return;
    try {
      await _saveAiConfigSilent();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('ai_provider_${auth.currentUser!.email}', 'openrouter');
      await prefs.setString('ai_api_key_${auth.currentUser!.email}', AppConstants.defaultOpenRouterApiKey);
      await prefs.setString('ai_model_${auth.currentUser!.email}', _selectedModel);

      await auth.checkProfileComplete();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Konfigurasi Asisten Pendamping berhasil disimpan'),
            backgroundColor: Colors.green[700],
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal menyimpan konfigurasi AI: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSavingConfig = false);
    }
  }

  Future<void> _testAiConnection() async {
    setState(() => _isTestingConnection = true);
    final auth = context.read<AuthProvider>();
    try {
      final res = await AiService().testConnection(
        'openrouter',
        AppConstants.defaultOpenRouterApiKey,
        _selectedModel,
      );
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_ai_connected_${auth.currentUser!.email}', res['success']);
      
      if (res['success']) {
        await prefs.setString('ai_provider_${auth.currentUser!.email}', 'openrouter');
        await prefs.setString('ai_api_key_${auth.currentUser!.email}', AppConstants.defaultOpenRouterApiKey);
        await prefs.setString('ai_model_${auth.currentUser!.email}', _selectedModel);
        
        // Silently save configuration to Sheets
        try {
          await _saveAiConfigSilent();
        } catch (sheetErr) {
          debugPrint('Error silent saving AI config: $sheetErr');
        }
      }
      
      await auth.checkProfileComplete();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['success']
                ? 'Koneksi Berhasil & Konfigurasi Disimpan!'
                : 'Koneksi Gagal: ${res['message']}'),
            backgroundColor: res['success'] ? Colors.green[700] : Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_ai_connected_${auth.currentUser!.email}', false);
      await auth.checkProfileComplete();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Koneksi Gagal: $e'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isTestingConnection = false);
    }
  }

  Widget _buildAiConfigSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_rounded, color: AppColors.navy, size: 20),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Konfigurasi Asisten Pendamping',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navyDark,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_isLoadingConfig)
            const Center(child: CircularProgressIndicator())
          else ...[
            const Text('Model Asisten', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : AppColors.bgLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedModel,
                  isExpanded: true,
                  items: const [
                    DropdownMenuItem(
                      value: 'google/gemini-3.5-flash',
                      child: Text(
                        'Narasi Sangat Detail (Rekomendasi)',
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'meta-llama/llama-3-8b-instruct',
                      child: Text(
                        'Narasi Sederhana',
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _selectedModel = val;
                      });
                    }
                  },
                ),
              ),
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isTestingConnection ? null : _testAiConnection,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.navy,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: _isTestingConnection
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation(Colors.white),
                      ),
                    )
                  : const Text('Simpan', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _handleLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Keluar'),
        content: const Text('Yakin ingin keluar dari akun?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<AuthProvider>().signOut();
              if (mounted) {
                Navigator.pushReplacementNamed(context, '/login');
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Keluar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(Theme.of(context).brightness == Brightness.dark ? 0.2 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
        border: Border.all(color: AppColors.navy.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.alarm_rounded, color: AppColors.navy, size: 20),
              SizedBox(width: 8),
              Text(
                'Pengingat Laporan (Alarm)',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Ingatkan saya untuk membuat RHK (Senin-Jumat).',
            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Aktifkan Pengingat', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
            value: _notificationEnabled,
            activeColor: AppColors.navy,
            onChanged: (val) async {
              setState(() => _notificationEnabled = val);
              await NotificationService().scheduleDailyNotification(enabled: val);
            },
          ),
          if (_notificationEnabled) ...[
            const Divider(height: 1),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Waktu Pengingat', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
              trailing: TextButton.icon(
                onPressed: () async {
                  final newTime = await showTimePicker(
                    context: context,
                    initialTime: _notificationTime,
                  );
                  if (newTime != null) {
                    setState(() => _notificationTime = newTime);
                    await NotificationService().scheduleDailyNotification(
                      hour: newTime.hour,
                      minute: newTime.minute,
                    );
                  }
                },
                icon: const Icon(Icons.access_time_rounded, size: 16, color: AppColors.navy),
                label: Text(
                  _notificationTime.format(context),
                  style: const TextStyle(color: AppColors.navy, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ]
        ],
      ),
    );
  }

  Widget _buildAppearanceSection() {
    final themeProvider = context.watch<ThemeProvider>();
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(Theme.of(context).brightness == Brightness.dark ? 0.2 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
        border: Border.all(color: AppColors.navy.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.palette_rounded, color: AppColors.navy, size: 20),
              SizedBox(width: 8),
              Text(
                'Tampilan Aplikasi',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Pilih tema terang atau gelap untuk kenyamanan mata Anda.',
            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Mode Gelap', style: TextStyle(fontWeight: FontWeight.w500)),
            secondary: Icon(
              themeProvider.isDarkMode ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
              color: AppColors.navy,
            ),
            value: themeProvider.isDarkMode,
            activeColor: AppColors.navy,
            onChanged: (val) {
              themeProvider.toggleTheme(val);
            },
          ),
        ],
      ),
    );
  Widget _buildUpdateAppVersion() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () async {
            final url = Uri.parse('https://play.google.com/store/apps/details?id=$_packageName');
            if (await canLaunchUrl(url)) {
              await launchUrl(url, mode: LaunchMode.externalApplication);
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.system_update_rounded, color: AppColors.primary),
                const SizedBox(width: 8),
                Text(
                  'Periksa Pembaruan Aplikasi',
                  style: TextStyle(
                    color: isDark ? Colors.white : AppColors.navy,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
