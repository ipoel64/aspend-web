import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/pengaduan.dart';
import '../services/ai_service.dart';
import '../services/pdf_service.dart';
import '../services/ad_service.dart';
import 'auth_provider.dart';

class PengaduanProvider extends ChangeNotifier {
  AuthProvider? _auth;
  final AiService _aiService = AiService();
  final PdfService _pdfService = PdfService();

  List<Pengaduan> _pengaduans = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<Pengaduan> get pengaduans => _pengaduans;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  void updateAuth(AuthProvider auth) {
    _auth = auth;
    if (auth.isSignedIn && auth.spreadsheetId != null) {
      loadPengaduans();
    }
  }

  Future<void> loadPengaduans() async {
    if (_auth?.sheetsService == null || _auth?.spreadsheetId == null) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final rows = await _auth!.sheetsService!.getAllRows(
        _auth!.spreadsheetId!,
        AppConstants.sheetPengaduan,
      );
      _pengaduans = rows.map((row) => Pengaduan.fromSheetRow(row)).toList();
      _pengaduans.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } catch (e) {
      _errorMessage = 'Gagal memuat aduan: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, String>> _getAiConfig() async {
    final prefs = await SharedPreferences.getInstance();
    final userEmail = _auth?.currentUser?.email ?? '';
    final storedKey = prefs.getString('ai_api_key_$userEmail');
    
    String apiKey = storedKey?.isNotEmpty == true ? storedKey! : AppConstants.defaultOpenRouterApiKey;
    String model = AppConstants.defaultOpenRouterModel;

    if (_auth?.sheetsService != null && _auth?.spreadsheetId != null) {
      try {
        final configRows = await _auth!.sheetsService!.getAllRows(
          _auth!.spreadsheetId!,
          AppConstants.sheetConfig,
        );
        for (var row in configRows) {
          if (row.isNotEmpty) {
            if (row[0] == 'AI_MODEL' && row.length > 1) {
              model = row[1].toString();
            }
          }
        }
      } catch (e) {
        debugPrint('Failed to load config from sheet: $e');
      }
    }

    return {
      'provider': 'openrouter',
      'apiKey': apiKey,
      'model': model,
    };
  }

  Future<Map<String, String>?> extractKtpData(File imageFile) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final aiConfig = await _getAiConfig();
      final apiKey = aiConfig['apiKey'] ?? '';
      final provider = aiConfig['provider'] ?? 'openrouter';
      // Force Gemini Flash model for OCR / vision tasks
      final model = 'google/gemini-3.5-flash';

      final extracted = await _aiService.extractDocumentData(
        imageFile: imageFile,
        provider: provider,
        apiKey: apiKey,
        model: model,
        isKtp: true,
      );
      return extracted;
    } catch (e) {
      _errorMessage = 'Gagal mengekstrak KTP: $e';
      return null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<String> generateAiAnalysis(String aduan) async {
    final aiConfig = await _getAiConfig();
    final apiKey = aiConfig['apiKey'] ?? '';
    final provider = aiConfig['provider'] ?? 'openrouter';
    final model = aiConfig['model'] ?? AppConstants.defaultOpenRouterModel;

    final prompt = '''Tugas Anda: Analisis aduan berikut secara sangat singkat dan berikan langkah tindak lanjut praktis.

Aduan: "$aduan"

ATURAN KETAT:
1. JANGAN menuliskan judul laporan, nama instansi, atau kata pengantar apapun.
2. LANGSUNG jawab sesuai format di bawah tanpa basa-basi.
3. Sangat singkat. Isi pokoknya saja, maksimal 1-2 kalimat per poin.

Format Respons:
**1. Analisa Singkat:**
(tulis inti masalah di sini)

**2. Tindak Lanjut:**
- (langkah 1)
- (langkah 2)
''';

    return await _aiService.generateNarrative(
      provider: provider,
      apiKey: apiKey,
      model: model,
      prompt: prompt,
    );
  }

  Future<String> generateFormalAnalysis(String aduan, String analisa) async {
    final aiConfig = await _getAiConfig();
    final apiKey = aiConfig['apiKey'] ?? '';
    final provider = aiConfig['provider'] ?? 'openrouter';
    final model = aiConfig['model'] ?? AppConstants.defaultOpenRouterModel;

    final prompt = _aiService.buildPengaduanAnalysisPrompt(
      aduan: aduan,
      analisa: analisa,
    );

    return await _aiService.generateNarrative(
      provider: provider,
      apiKey: apiKey,
      model: model,
      prompt: prompt,
    );
  }

  Future<bool> savePengaduan({
    required String nik,
    required String nama,
    required String alamat,
    required String desaKelurahan,
    required String kecamatan,
    required String kabKota,
    required String aduan,
    required String hasilAnalisa,
    required double latitude,
    required double longitude,
    File? ktpPhoto,
    File? screenshotSiks,
  }) async {
    if (_auth?.sheetsService == null || _auth?.driveService == null || _auth?.spreadsheetId == null) {
      _errorMessage = 'Sistem belum siap';
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final now = DateTime.now();
      final dateStr = DateFormat('yyyyMMdd').format(now);
      final timeStr = DateFormat('HHmmss').format(now);
      final id = 'ADU-$dateStr-$timeStr';

      String fotoKtpId = '';
      String screenshotSiksId = '';

      final folderId = await _auth!.driveService!.getOrCreateFolder(AppConstants.driveFolderPengaduan);

      // Upload KTP if any
      List<int>? ktpBytes;
      if (ktpPhoto != null) {
        ktpBytes = await ktpPhoto.readAsBytes();
        final ext = ktpPhoto.path.split('.').last.toLowerCase();
        final mime = ext == 'png' ? 'image/png' : 'image/jpeg';
        fotoKtpId = await _auth!.driveService!.uploadFile(
          folderId,
          '${id}_ktp.$ext',
          ktpBytes,
          mime,
        );
        await _auth!.driveService!.setPublicAccess(fotoKtpId);
      }

      // Upload Screenshot if any
      List<int>? screenshotBytes;
      if (screenshotSiks != null) {
        screenshotBytes = await screenshotSiks.readAsBytes();
        final ext = screenshotSiks.path.split('.').last.toLowerCase();
        final mime = ext == 'png' ? 'image/png' : 'image/jpeg';
        screenshotSiksId = await _auth!.driveService!.uploadFile(
          folderId,
          '${id}_screenshot.$ext',
          screenshotBytes,
          mime,
        );
        await _auth!.driveService!.setPublicAccess(screenshotSiksId);
      }

      // Create initial Pengaduan object
      var pengaduan = Pengaduan(
        id: id,
        email: _auth!.currentUser?.email ?? '',
        nik: nik,
        nama: nama,
        alamat: alamat,
        desaKelurahan: desaKelurahan,
        kecamatan: kecamatan,
        kabKota: kabKota,
        aduan: aduan,
        hasilAnalisa: hasilAnalisa,
        latitude: latitude,
        longitude: longitude,
        fotoKtp: fotoKtpId,
        screenshotSiks: screenshotSiksId,
        pdfFileId: '',
        createdAt: now.toIso8601String(),
      );

      // Render & Upload PDF
      // Get logo & signature
      List<int>? logoBytes; // Deprecated, logo is loaded locally from assets in PdfService

      List<int>? signatureBytes = _auth!.signatureBytes;
      if (signatureBytes == null && _auth!.userProfile?.signatureFileId.isNotEmpty == true) {
        try {
          signatureBytes = await _auth!.driveService!.downloadFile(_auth!.userProfile!.signatureFileId);
        } catch (_) {}
      }

      // Compress images for PDF to prevent OOM (especially for PNG screenshots)
      Uint8List? compressedKtp;
      if (ktpBytes != null && ktpBytes.isNotEmpty) {
        compressedKtp = await _pdfService.compressForPdf(ktpBytes);
        ktpBytes = null; // Release raw bytes immediately
      }
      Uint8List? compressedScreenshot;
      if (screenshotBytes != null && screenshotBytes.isNotEmpty) {
        compressedScreenshot = await _pdfService.compressForPdf(screenshotBytes);
        screenshotBytes = null; // Release raw bytes immediately
      }

      final pdfBytes = await _pdfService.createPengaduanPdf(
        pengaduan: pengaduan,
        userProfile: _auth!.userProfile!,
        logoBytes: logoBytes,
        signatureBytes: signatureBytes,
        ktpBytes: compressedKtp,
        screenshotBytes: compressedScreenshot,
      );

      final cleanNama = nama.replaceAll(RegExp(r'[^\w\s\-]'), '').replaceAll(RegExp(r'\s+'), '_');
      final pdfFileId = await _auth!.driveService!.uploadFile(
        folderId,
        'ADU-$dateStr-${cleanNama}_laporan.pdf',
        pdfBytes,
        'application/pdf',
      );
      await _auth!.driveService!.setPublicAccess(pdfFileId);

      // Update PDF ID
      pengaduan = pengaduan.copyWith(pdfFileId: pdfFileId);

      // Save row to Sheets
      await _auth!.sheetsService!.appendRow(
        _auth!.spreadsheetId!,
        AppConstants.sheetPengaduan,
        pengaduan.toSheetRow(),
      );

      _pengaduans.insert(0, pengaduan);

      // Trigger ad check after successful PDF save
      AdService.instance.onPdfSaved();

      return true;
    } catch (e) {
      _errorMessage = 'Gagal menyimpan pengaduan: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> deletePengaduan(String id) async {
    if (_auth?.sheetsService == null || _auth?.spreadsheetId == null) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final pengaduan = _pengaduans.firstWhere((p) => p.id == id);
      final rowIndex = await _auth!.sheetsService!.findRowByValue(
        _auth!.spreadsheetId!,
        AppConstants.sheetPengaduan,
        0,
        id,
      );

      if (rowIndex > 0) {
        await _auth!.sheetsService!.deleteRow(
          _auth!.spreadsheetId!,
          AppConstants.sheetPengaduan,
          rowIndex,
        );

        // Delete from Drive asynchronously
        if (_auth!.driveService != null) {
          if (pengaduan.fotoKtp.isNotEmpty) {
            try {
              await _auth!.driveService!.deleteFile(pengaduan.fotoKtp);
            } catch (_) {}
          }
          if (pengaduan.screenshotSiks.isNotEmpty) {
            try {
              await _auth!.driveService!.deleteFile(pengaduan.screenshotSiks);
            } catch (_) {}
          }
          if (pengaduan.pdfFileId.isNotEmpty) {
            try {
              await _auth!.driveService!.deleteFile(pengaduan.pdfFileId);
            } catch (_) {}
          }
        }

        _pengaduans.removeWhere((p) => p.id == id);
      }
    } catch (e) {
      _errorMessage = 'Gagal menghapus aduan: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updatePengaduanAnalysis(String id, String newAnalysis) async {
    if (_auth?.sheetsService == null || _auth?.driveService == null || _auth?.spreadsheetId == null) {
      _errorMessage = 'Sistem belum siap';
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final index = _pengaduans.indexWhere((p) => p.id == id);
      if (index == -1) throw Exception('Pengaduan tidak ditemukan di memori');
      var pengaduan = _pengaduans[index];

      // 1. Dapatkan baris di Google Sheets
      final rowIndex = await _auth!.sheetsService!.findRowByValue(
        _auth!.spreadsheetId!,
        AppConstants.sheetPengaduan,
        0,
        id,
      );
      if (rowIndex == -1) throw Exception('Pengaduan tidak ditemukan di Google Sheets');

      // 2. Download foto KTP dan Screenshot yang lama, compress for PDF
      Uint8List? compressedKtp;
      if (pengaduan.fotoKtp.isNotEmpty) {
        try {
          final rawKtp = await _auth!.driveService!.downloadFile(pengaduan.fotoKtp);
          if (rawKtp != null && rawKtp.isNotEmpty) {
            compressedKtp = await _pdfService.compressForPdf(rawKtp);
          }
        } catch (_) {}
      }

      Uint8List? compressedScreenshot;
      if (pengaduan.screenshotSiks.isNotEmpty) {
        try {
          final rawScreenshot = await _auth!.driveService!.downloadFile(pengaduan.screenshotSiks);
          if (rawScreenshot != null && rawScreenshot.isNotEmpty) {
            compressedScreenshot = await _pdfService.compressForPdf(rawScreenshot);
          }
        } catch (_) {}
      }

      // 3. Hapus PDF laporan lama di Drive
      if (pengaduan.pdfFileId.isNotEmpty) {
        try {
          await _auth!.driveService!.deleteFile(pengaduan.pdfFileId);
        } catch (_) {}
      }

      // 4. Update data objek lokal sementara
      pengaduan = pengaduan.copyWith(hasilAnalisa: newAnalysis);

      // 5. Generate PDF baru dengan analisa yang sudah diedit
      List<int>? signatureBytes = _auth!.signatureBytes;
      if (signatureBytes == null && _auth!.userProfile?.signatureFileId.isNotEmpty == true) {
        try {
          signatureBytes = await _auth!.driveService!.downloadFile(_auth!.userProfile!.signatureFileId);
        } catch (_) {}
      }

      final pdfBytes = await _pdfService.createPengaduanPdf(
        pengaduan: pengaduan,
        userProfile: _auth!.userProfile!,
        logoBytes: null,
        signatureBytes: signatureBytes,
        ktpBytes: compressedKtp,
        screenshotBytes: compressedScreenshot,
      );

      final cleanNama = pengaduan.nama.replaceAll(RegExp(r'[^\w\s\-]'), '').replaceAll(RegExp(r'\s+'), '_');
      final parts = id.split('-');
      final datePart = parts.length > 1 ? parts[1] : DateFormat('yyyyMMdd').format(DateTime.now());

      // 6. Upload PDF baru ke Drive
      final folderId = await _auth!.driveService!.getOrCreateFolder(AppConstants.driveFolderPengaduan);
      final pdfFileId = await _auth!.driveService!.uploadFile(
        folderId,
        'ADU-$datePart-${cleanNama}_laporan.pdf',
        pdfBytes,
        'application/pdf',
      );
      await _auth!.driveService!.setPublicAccess(pdfFileId);

      // 7. Update PDF ID di pengaduan
      pengaduan = pengaduan.copyWith(pdfFileId: pdfFileId);

      // 8. Update baris di Google Sheets
      await _auth!.sheetsService!.updateRow(
        _auth!.spreadsheetId!,
        AppConstants.sheetPengaduan,
        rowIndex,
        pengaduan.toSheetRow(),
      );

      // 9. Update state lokal
      _pengaduans[index] = pengaduan;

      // Trigger ad check after successful PDF re-generation
      AdService.instance.onPdfSaved();

      return true;
    } catch (e) {
      _errorMessage = 'Gagal memperbarui analisis: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

