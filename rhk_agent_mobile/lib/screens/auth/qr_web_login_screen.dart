import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
// ignore: implementation_imports
import 'package:mobile_scanner/src/method_channel/mobile_scanner_method_channel.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/app_theme.dart';
import '../../config/constants.dart';
import '../../providers/auth_provider.dart';
import '../../services/subscription_service.dart';

/// Screen pemindai QR Code untuk login Aspend Web (WhatsApp Web model)
class QrWebLoginScreen extends StatefulWidget {
  const QrWebLoginScreen({super.key});

  @override
  State<QrWebLoginScreen> createState() => _QrWebLoginScreenState();
}

class _QrWebLoginScreenState extends State<QrWebLoginScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late MobileScannerController _scannerController;
  late AnimationController _animController;
  bool _isProcessing = false;
  bool _isTorchOn = false;
  bool _isStarting = false;
  bool _pausedByLifecycle = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // autoStart: false -> start dikendalikan penuh oleh layar ini agar tidak
    // terjadi double-start (penyebab error "An unexpected error occurred").
    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      torchEnabled: false,
      formats: const [BarcodeFormat.qrCode],
      autoStart: false,
    );

    _animController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);

    WidgetsBinding.instance.addPostFrameCallback((_) => _startScanner());
  }

  /// Reset paksa kamera native. Plugin mobile_scanner hanya melakukan ini di
  /// mode debug, sehingga di mode release kamera bisa "tersangkut" dalam
  /// status started dan setiap start() berikutnya gagal (AlreadyStarted).
  Future<void> _forceStopNative() async {
    final platform = MobileScannerPlatform.instance;
    if (platform is MethodChannelMobileScanner) {
      try {
        await platform.stop(force: true);
      } catch (_) {
        // Sudah berhenti - abaikan.
      }
    }
  }

  Future<void> _startScanner({bool forceReset = true}) async {
    if (_isStarting || !mounted) return;
    _isStarting = true;
    try {
      if (forceReset) await _forceStopNative();
      await _scannerController.start();

      // Jika masih gagal (misal kamera native belum benar-benar lepas), coba sekali lagi.
      final err = _scannerController.value.error;
      if (err != null && err.errorCode != MobileScannerErrorCode.permissionDenied && mounted) {
        await Future.delayed(const Duration(milliseconds: 400));
        await _forceStopNative();
        await _scannerController.start();
      }
    } catch (e) {
      debugPrint('QR scanner start error: $e');
    } finally {
      _isStarting = false;
      if (mounted) setState(() {});
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!mounted) return;
    // Hanya tangani paused/resumed. State "inactive" juga dipicu oleh dialog
    // izin kamera, dan menghentikan kamera di sana memicu race condition.
    if (state == AppLifecycleState.paused) {
      _pausedByLifecycle = true;
      unawaited(_scannerController.stop());
    } else if (state == AppLifecycleState.resumed && _pausedByLifecycle && !_isProcessing) {
      _pausedByLifecycle = false;
      unawaited(_startScanner());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _animController.dispose();
    unawaited(_scannerController.dispose());
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_isProcessing) return;

    final List<Barcode> barcodes = capture.barcodes;
    for (final barcode in barcodes) {
      final rawValue = barcode.rawValue?.trim();
      if (rawValue != null && rawValue.isNotEmpty) {
        _handleScannedData(rawValue);
        break;
      }
    }
  }

  Future<void> _handleScannedData(String data) async {
    setState(() => _isProcessing = true);
    await _scannerController.stop();

    // Parse session ID & endpoint
    String sessionId = data;
    String? apiEndpoint;
    String? scannedDevice;

    final trimmed = data.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        final json = jsonDecode(trimmed);
        sessionId = json['session'] ?? json['sessionId'] ?? data;
        apiEndpoint = json['endpoint'];
        scannedDevice = json['device'] ?? json['deviceInfo'];
      } catch (_) {}
    } else if (data.contains('session=')) {
      final uri = Uri.tryParse(data);
      sessionId = uri?.queryParameters['session'] ?? data;
      scannedDevice = uri?.queryParameters['device'];
      if (uri != null && uri.host.isNotEmpty) {
        apiEndpoint = uri.replace(path: '/api/auth/qr-session', query: '').toString();
      }
    } else if (data.startsWith('ASPEND_AUTH:')) {
      sessionId = data.replaceFirst('ASPEND_AUTH:', '').trim();
    } else if (data.startsWith('ASPEND_WEB_LOGIN:')) {
      sessionId = data.replaceFirst('ASPEND_WEB_LOGIN:', '').trim();
    }

    if (!mounted) return;

    final auth = context.read<AuthProvider>();
    final user = auth.currentUser;
    final profile = auth.userProfile;

    // Show Confirmation Bottom Sheet
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                width: 68,
                height: 68,
                decoration: BoxDecoration(
                  color: AppColors.navy.withOpacity(0.08),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.laptop_chromebook_rounded,
                  size: 38,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Tautkan ke Aspend Web?',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.navyDark,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Perangkat komputer/laptop Anda akan login secara otomatis dengan akun berikut:',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Colors.grey[600], height: 1.4),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey[200]!),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: AppColors.teal.withOpacity(0.2),
                      child: const Icon(Icons.person, color: AppColors.teal),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            profile?.nama.isNotEmpty == true
                                ? profile!.nama
                                : (user?.displayName ?? 'Pengguna Aspend'),
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            user?.email ?? '-',
                            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Batal', style: TextStyle(color: Colors.grey)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.teal,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Tautkan Perangkat',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );

    if (confirmed == true && mounted) {
      await _authorizeWebSession(sessionId, apiEndpoint: apiEndpoint, deviceInfo: scannedDevice);
    } else {
      if (mounted) {
        setState(() => _isProcessing = false);
        _startScanner();
      }
    }
  }

  Future<void> _authorizeWebSession(String sessionId, {String? apiEndpoint, String? deviceInfo}) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: Card(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(color: AppColors.teal),
                SizedBox(width: 16),
                Text('Menautkan ke Aspend Web...'),
              ],
            ),
          ),
        ),
      ),
    );

    try {
      final auth = context.read<AuthProvider>();
      await auth.ensureFreshAuth();

      final creds = await auth.getOAuthCredentials(forceRefresh: true, needServerAuthCode: true);
      String accessToken = creds['accessToken'] as String? ?? '';
      final idToken = creds['idToken'] as String? ?? '';
      final serverAuthCode = creds['serverAuthCode'] as String? ?? '';
      final refreshToken = creds['refreshToken'] as String? ?? '';
      final googleExpiresAt = creds['expiresAt'] as int? ?? (DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600);
      final expiresAt = DateTime.now().millisecondsSinceEpoch ~/ 1000 + 86400; // Sesi Web 24 Jam

      // Fallback jika belum terisi dari client
      if (accessToken.isEmpty) {
        final googleAuth = await auth.currentUser?.authentication;
        accessToken = googleAuth?.accessToken ?? '';
      }

      // 1. Post authentication payload directly to the Web server API
      final endpointsToTry = <String>[];
      if (apiEndpoint != null && apiEndpoint.isNotEmpty) {
        endpointsToTry.add(apiEndpoint);
        if (apiEndpoint.contains('localhost')) {
          endpointsToTry.add(apiEndpoint.replaceAll('localhost', '192.168.1.8'));
          endpointsToTry.add(apiEndpoint.replaceAll('localhost', '10.0.2.2'));
        }
      }
      endpointsToTry.add('http://192.168.1.8:3000/api/auth/qr-session');
      endpointsToTry.add('https://aspend-web.vercel.app/api/auth/qr-session');

      final isUserPremium = SubscriptionService.instance.isPremium(auth.currentUser?.email);
      final body = jsonEncode({
        'sessionId': sessionId,
        'email': auth.currentUser?.email ?? '',
        'nama': auth.userProfile?.nama ?? auth.currentUser?.displayName ?? '',
        'image': auth.userProfile?.photoFileId != null && auth.userProfile!.photoFileId.isNotEmpty
            ? 'https://drive.google.com/thumbnail?id=${auth.userProfile!.photoFileId}&sz=w200'
            : auth.currentUser?.photoUrl,
        'spreadsheetId': auth.spreadsheetId ?? '',
        'isPremium': isUserPremium,
        'accessToken': accessToken,
        'idToken': idToken,
        'serverAuthCode': serverAuthCode,
        'refreshToken': refreshToken,
        'googleExpiresAt': googleExpiresAt,
        'expiresAt': expiresAt,
      });

      // Always send to cloud relay so mobile on 4G/cellular data can authorize local PC web!
      final ntfyEndpoint = 'https://ntfy.sh/aspend_qr_$sessionId';
      try {
        await http.post(
          Uri.parse(ntfyEndpoint),
          headers: {'Content-Type': 'application/json'},
          body: body,
        ).timeout(const Duration(seconds: 4));
        debugPrint('QR Login: Successfully sent to cloud relay $ntfyEndpoint');
      } catch (e) {
        debugPrint('QR Login: Cloud relay failed: $e');
      }

      for (var ep in endpointsToTry) {
        try {
          final res = await http.post(
            Uri.parse(ep),
            headers: {'Content-Type': 'application/json'},
            body: body,
          ).timeout(const Duration(seconds: 4));
          if (res.statusCode == 200) {
            debugPrint('QR Login: Successfully authorized via $ep');
            break;
          }
        } catch (e) {
          debugPrint('QR Login: Could not reach $ep: $e');
        }
      }

      final effectiveDevice = (deviceInfo != null && deviceInfo.isNotEmpty)
          ? deviceInfo
          : 'Aspend Web (Browser Laptop/PC)';

      // 2. Simpan sesi aktif ke SharedPreferences secara instan
      final newSessionMap = {
        'sessionId': sessionId,
        'email': auth.currentUser?.email ?? '',
        'nama': auth.userProfile?.nama ?? auth.currentUser?.displayName ?? '',
        'spreadsheetId': auth.spreadsheetId ?? '',
        'status': 'AUTHORIZED',
        'createdAt': DateTime.now().toIso8601String(),
        'deviceInfo': effectiveDevice,
      };

      try {
        final prefs = await SharedPreferences.getInstance();
        final localSessionsStr = prefs.getString('local_web_sessions') ?? '[]';
        List<dynamic> localList = [];
        try {
          localList = jsonDecode(localSessionsStr) as List;
        } catch (_) {}
        localList.removeWhere((item) => item['sessionId'] == sessionId);
        localList.insert(0, newSessionMap);
        await prefs.setString('local_web_sessions', jsonEncode(localList));
        debugPrint('QR Login: Sesi berhasil disimpan ke penyimpanan lokal.');
      } catch (e) {
        debugPrint('QR Login: Save local session error: $e');
      }

      // 3. Simpan dan sinkronisasi ke tab Web_Sessions di Google Sheets
      if (auth.sheetsService != null && auth.spreadsheetId != null) {
        try {
          // Pastikan tab Web_Sessions sudah ada
          final sheetNames = await auth.sheetsService!.getSheetNames(auth.spreadsheetId!);
          if (!sheetNames.contains(AppConstants.sheetWebSessions)) {
            await auth.sheetsService!.createSheet(auth.spreadsheetId!, AppConstants.sheetWebSessions);
            await auth.sheetsService!.writeHeaders(
              auth.spreadsheetId!,
              AppConstants.sheetWebSessions,
              [
                'SessionId',
                'Email',
                'Nama',
                'SpreadsheetId',
                'Status',
                'CreatedAt',
                'DeviceInfo',
              ],
            );
          }

          final payload = [
            sessionId,
            auth.currentUser?.email ?? '',
            auth.userProfile?.nama ?? '',
            auth.spreadsheetId ?? '',
            'AUTHORIZED',
            DateTime.now().toIso8601String(),
            effectiveDevice,
          ];

          final existingRow = await auth.sheetsService!.findRowByValue(
            auth.spreadsheetId!,
            AppConstants.sheetWebSessions,
            0,
            sessionId,
          );

          if (existingRow > 0) {
            await auth.sheetsService!.updateRow(
              auth.spreadsheetId!,
              AppConstants.sheetWebSessions,
              existingRow,
              payload,
            );
          } else {
            await auth.sheetsService!.appendRow(
              auth.spreadsheetId!,
              AppConstants.sheetWebSessions,
              payload,
            );
          }
          debugPrint('QR Login: Sesi berhasil dicatat di tab Web_Sessions Google Sheets.');
        } catch (e) {
          debugPrint('Note: Web_Sessions sheet append status: $e');
        }

        // Sinkronisasi status Premium ke sheet Premium jika pengguna Premium di HP
        if (isUserPremium && auth.currentUser?.email != null) {
          try {
            final sheetNames = await auth.sheetsService!.getSheetNames(auth.spreadsheetId!);
            if (!sheetNames.contains('Premium')) {
              await auth.sheetsService!.createSheet(auth.spreadsheetId!, 'Premium');
              await auth.sheetsService!.writeHeaders(
                auth.spreadsheetId!,
                'Premium',
                ['Email', 'Status', 'Metode', 'TanggalAktif'],
              );
            }
            await auth.sheetsService!.appendRow(
              auth.spreadsheetId!,
              'Premium',
              [auth.currentUser!.email, 'Aktif', 'InAppPurchase', DateTime.now().toIso8601String()],
            );
          } catch (_) {}
        }
      }

      if (!mounted) return;
      Navigator.pop(context); // Close loading dialog

      // Show Success Dialog
      await showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 60,
                height: 60,
                decoration: const BoxDecoration(
                  color: Colors.green,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, color: Colors.white, size: 36),
              ),
              const SizedBox(height: 16),
              const Text(
                'Berhasil Tertaut!',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              const SizedBox(height: 8),
              const Text(
                'Anda sekarang telah login di Aspend Web. Silakan periksa layar laptop/komputer Anda.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.navy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Selesai'),
                ),
              ),
            ],
          ),
        ),
      );

      if (mounted) {
        Navigator.pop(context); // Return to previous screen
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context); // Close loading dialog
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal menautkan perangkat: $e'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() => _isProcessing = false);
        _startScanner();
      }
    }
  }

  Future<void> _pickAndScanFromGallery() => _scanFromImage(ImageSource.gallery);

  /// Fallback: ambil foto QR memakai aplikasi kamera bawaan HP, lalu dianalisis.
  Future<void> _scanFromCameraPhoto() async {
    // Lepaskan kamera live agar aplikasi kamera sistem bisa memakainya.
    await _scannerController.stop();
    await _forceStopNative();
    _pausedByLifecycle = false;
    await _scanFromImage(ImageSource.camera);
    if (mounted && !_isProcessing) {
      unawaited(_startScanner());
    }
  }

  Future<void> _scanFromImage(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(source: source, imageQuality: 95);
      if (image != null) {
        final capture = await _scannerController.analyzeImage(
          image.path,
          formats: const [BarcodeFormat.qrCode],
        );
        if (capture != null && capture.barcodes.isNotEmpty) {
          final code = capture.barcodes.first.rawValue;
          if (code != null && code.isNotEmpty) {
            _handleScannedData(code);
            return;
          }
        }
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Tidak ditemukan kode QR pada gambar tersebut. Pastikan barcode terlihat jelas & tidak buram.')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal membaca gambar: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final scanAreaSize = size.width * 0.72;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Tautkan Perangkat Web',
          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.photo_camera_outlined, color: Colors.white),
            tooltip: 'Foto QR Kamera',
            onPressed: _scanFromCameraPhoto,
          ),
          IconButton(
            icon: const Icon(Icons.photo_library_outlined, color: Colors.white),
            tooltip: 'Pilih QR dari Galeri',
            onPressed: _pickAndScanFromGallery,
          ),
          IconButton(
            icon: Icon(
              _isTorchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
              color: _isTorchOn ? Colors.amber : Colors.white,
            ),
            onPressed: () async {
              await _scannerController.toggleTorch();
              setState(() => _isTorchOn = !_isTorchOn);
            },
          ),
        ],
      ),
      body: Stack(
        alignment: Alignment.center,
        children: [
          // Camera Stream
          MobileScanner(
            controller: _scannerController,
            onDetect: _onDetect,
            errorBuilder: (context, error, child) {
              return Container(
                color: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Center(
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.amber.withOpacity(0.15),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.camera_alt_outlined,
                            color: Colors.amber,
                            size: 48,
                          ),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Kamera Belum Aktif',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          error.errorCode == MobileScannerErrorCode.permissionDenied
                              ? 'Izin akses kamera belum diberikan.\nSilakan ketuk tombol di bawah untuk meminta izin kamera.'
                              : 'Kamera live gagal dibuka.\n(${error.errorDetails?.code ?? error.errorCode.name}${error.errorDetails?.message != null ? ': ${error.errorDetails!.message}' : ''})\n\nGunakan tombol "Foto QR dengan Kamera" di bawah sebagai alternatif langsung.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey[400], fontSize: 12.5, height: 1.4),
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton.icon(
                          onPressed: () => _startScanner(),
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Coba Buka Kamera Lagi'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.teal,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                        const SizedBox(height: 10),
                        ElevatedButton.icon(
                          onPressed: _scanFromCameraPhoto,
                          icon: const Icon(Icons.photo_camera_rounded, color: Colors.black87),
                          label: const Text('Foto QR dengan Kamera HP', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.amber,
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextButton.icon(
                          onPressed: _pickAndScanFromGallery,
                          icon: const Icon(Icons.photo_library_rounded, color: Colors.white70),
                          label: const Text('Pindai dari Foto Galeri', style: TextStyle(color: Colors.white70)),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),

          // Overlay & Instructions (Hanya tampil jika scanner tidak error)
          ValueListenableBuilder<MobileScannerState>(
            valueListenable: _scannerController,
            builder: (context, state, _) {
              if (state.error != null) {
                return const SizedBox.shrink();
              }
              return Stack(
                alignment: Alignment.center,
                children: [
                  // Dark overlay with transparent cutout (No red box artifacts)
                  IgnorePointer(
                    ignoring: true,
                    child: CustomPaint(
                      size: Size(size.width, size.height),
                      painter: _QrCutoutOverlayPainter(
                        scanAreaSize: scanAreaSize,
                        borderRadius: 20,
                        overlayColor: Colors.black.withOpacity(0.65),
                      ),
                    ),
                  ),

                  // High-tech Corner Accents
                  IgnorePointer(
                    ignoring: true,
                    child: Center(
                      child: SizedBox(
                        width: scanAreaSize,
                        height: scanAreaSize,
                        child: Stack(
                          children: [
                            // Top-left
                            Positioned(
                              top: 0,
                              left: 0,
                              child: Container(
                                width: 28,
                                height: 28,
                                decoration: const BoxDecoration(
                                  border: Border(
                                    top: BorderSide(color: AppColors.teal, width: 4),
                                    left: BorderSide(color: AppColors.teal, width: 4),
                                  ),
                                  borderRadius: BorderRadius.only(topLeft: Radius.circular(20)),
                                ),
                              ),
                            ),
                            // Top-right
                            Positioned(
                              top: 0,
                              right: 0,
                              child: Container(
                                width: 28,
                                height: 28,
                                decoration: const BoxDecoration(
                                  border: Border(
                                    top: BorderSide(color: AppColors.teal, width: 4),
                                    right: BorderSide(color: AppColors.teal, width: 4),
                                  ),
                                  borderRadius: BorderRadius.only(topRight: Radius.circular(20)),
                                ),
                              ),
                            ),
                            // Bottom-left
                            Positioned(
                              bottom: 0,
                              left: 0,
                              child: Container(
                                width: 28,
                                height: 28,
                                decoration: const BoxDecoration(
                                  border: Border(
                                    bottom: BorderSide(color: AppColors.teal, width: 4),
                                    left: BorderSide(color: AppColors.teal, width: 4),
                                  ),
                                  borderRadius: BorderRadius.only(bottomLeft: Radius.circular(20)),
                                ),
                              ),
                            ),
                            // Bottom-right
                            Positioned(
                              bottom: 0,
                              right: 0,
                              child: Container(
                                width: 28,
                                height: 28,
                                decoration: const BoxDecoration(
                                  border: Border(
                                    bottom: BorderSide(color: AppColors.teal, width: 4),
                                    right: BorderSide(color: AppColors.teal, width: 4),
                                  ),
                                  borderRadius: BorderRadius.only(bottomRight: Radius.circular(20)),
                                ),
                              ),
                            ),
                            // Animated Scanning Laser
                            AnimatedBuilder(
                              animation: _animController,
                              builder: (context, child) {
                                return Positioned(
                                  top: _animController.value * (scanAreaSize - 4),
                                  left: 12,
                                  right: 12,
                                  child: Container(
                                    height: 2.5,
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                        colors: [
                                          Colors.transparent,
                                          AppColors.teal,
                                          Colors.cyanAccent,
                                          AppColors.teal,
                                          Colors.transparent,
                                        ],
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: AppColors.teal.withOpacity(0.8),
                                          blurRadius: 10,
                                          spreadRadius: 2,
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Instructions at Bottom
                  Positioned(
                    bottom: 40,
                    left: 24,
                    right: 24,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.75),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withOpacity(0.15)),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.qr_code_scanner_rounded, color: AppColors.teal, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'Pindai Kode QR Web',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          // Badge Alamat Web Jelas & Mencolok
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF0D9488), Color(0xFF0284C7)],
                              ),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.white.withOpacity(0.4), width: 1.2),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF0D9488).withOpacity(0.4),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.language_rounded, color: Colors.white, size: 16),
                                SizedBox(width: 8),
                                Text(
                                  'aspend-web.vercel.app',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 13.5,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Buka alamat web di atas pada laptop/PC Anda, lalu arahkan kamera ke kode QR untuk login otomatis.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.85),
                              fontSize: 11.5,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _QrCutoutOverlayPainter extends CustomPainter {
  final double scanAreaSize;
  final double borderRadius;
  final Color overlayColor;

  _QrCutoutOverlayPainter({
    required this.scanAreaSize,
    this.borderRadius = 20.0,
    this.overlayColor = const Color(0xAA000000),
  });

  @override
  void paint(Canvas canvas, Size size) {
    final fullRect = Rect.fromLTWH(0, 0, size.width, size.height);
    final center = Offset(size.width / 2, size.height / 2);
    final cutoutRect = Rect.fromCenter(
      center: center,
      width: scanAreaSize,
      height: scanAreaSize,
    );

    final backgroundPath = Path()..addRect(fullRect);
    final cutoutPath = Path()
      ..addRRect(RRect.fromRectAndRadius(cutoutRect, Radius.circular(borderRadius)));

    final overlayPath = Path.combine(PathOperation.difference, backgroundPath, cutoutPath);

    final paint = Paint()
      ..color = overlayColor
      ..style = PaintingStyle.fill;

    canvas.drawPath(overlayPath, paint);
  }

  @override
  bool shouldRepaint(covariant _QrCutoutOverlayPainter oldDelegate) {
    return oldDelegate.scanAreaSize != scanAreaSize ||
        oldDelegate.borderRadius != borderRadius ||
        oldDelegate.overlayColor != overlayColor;
  }
}
