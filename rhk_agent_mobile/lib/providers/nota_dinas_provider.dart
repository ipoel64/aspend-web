import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/nota_dinas.dart';
import '../services/ai_service.dart';
import '../services/pdf_service.dart';
import '../services/ad_service.dart';
import 'auth_provider.dart';

class NotaDinasProvider extends ChangeNotifier {
  AuthProvider? _auth;
  final AiService _aiService = AiService();
  final PdfService _pdfService = PdfService();

  List<NotaDinas> _notaDinasList = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<NotaDinas> get notaDinasList => _notaDinasList;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  void updateAuth(AuthProvider auth) {
    _auth = auth;
    if (auth.isSignedIn && auth.spreadsheetId != null) {
      loadNotaDinasList();
    }
  }

  Future<void> loadNotaDinasList() async {
    if (_auth?.sheetsService == null || _auth?.spreadsheetId == null) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final rows = await _auth!.sheetsService!.getAllRows(
        _auth!.spreadsheetId!,
        AppConstants.sheetNotaDinas,
      );
      _notaDinasList = rows.map((row) => NotaDinas.fromSheetRow(row)).toList();
      _notaDinasList.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } catch (e) {
      _errorMessage = 'Gagal memuat Nota Dinas: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, String>> _getAiConfig() async {
    String apiKey = AppConstants.defaultOpenRouterApiKey;
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

  Future<String> generateAiNotaDinas({
    required String yth,
    required String dari,
    required String hal,
    required String tanggal,
    required String poinDraft,
  }) async {
    final aiConfig = await _getAiConfig();
    final apiKey = aiConfig['apiKey'] ?? '';
    final provider = aiConfig['provider'] ?? 'openrouter';
    final model = aiConfig['model'] ?? AppConstants.defaultOpenRouterModel;

    final prompt = '''Anda adalah asisten administrasi profesional di Kementerian Sosial RI.
Tugas Anda adalah menulis teks isi surat Nota Dinas resmi berdasarkan informasi berikut:
- Kepada Yth: $yth
- Dari: $dari
- Perihal (Hal): $hal
- Tanggal: $tanggal
- Poin-poin Draft Kegiatan/Isi:
$poinDraft

Aturan Penulisan:
1. Gunakan bahasa Indonesia yang baku, sangat formal, sopan, dan sesuai dengan tata bahasa birokrasi pemerintahan (Ejaan Yang Disempurnakan).
2. Mulai langsung dengan isi surat (paragraf pembuka, penjelasan poin draf secara deskriptif, dan paragraf penutup).
3. JANGAN menyertakan KOP, judul "NOTA DINAS", ataupun baris Nomor/Kepada/Dari/Hal/Tanggal di awal teks yang Anda hasilkan karena hal tersebut sudah dibuat oleh template PDF.
4. JANGAN menuliskan tanda tangan di akhir teks.
5. Format teks yang dihasilkan harus berupa paragraf-paragraf bersih tanpa formatting markdown seperti **bold** atau bullet points, agar rapi saat dicetak ke PDF.
''';

    return await _aiService.generateNarrative(
      provider: provider,
      apiKey: apiKey,
      model: model,
      prompt: prompt,
    );
  }

  Future<bool> saveNotaDinas({
    required String nomor,
    required String yth,
    required String dari,
    required String hal,
    required String lampiran,
    required String sifat,
    required String tanggal,
    required String poinDraft,
    required String isiNotaDinas,
    File? buktiDukungPhoto,
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
      final id = 'ND-$dateStr-$timeStr';

      final folderId = await _auth!.driveService!.getOrCreateFolder(AppConstants.driveFolderNotaDinas);

      String buktiDukungId = '';
      List<int>? buktiDukungBytes;
      if (buktiDukungPhoto != null) {
        buktiDukungBytes = await buktiDukungPhoto.readAsBytes();
        final ext = buktiDukungPhoto.path.split('.').last.toLowerCase();
        final mime = ext == 'png' ? 'image/png' : 'image/jpeg';
        buktiDukungId = await _auth!.driveService!.uploadFile(
          folderId,
          '${id}_bukti.$ext',
          buktiDukungBytes,
          mime,
        );
        await _auth!.driveService!.setPublicAccess(buktiDukungId);
      }

      // Create initial NotaDinas object
      var notaDinas = NotaDinas(
        id: id,
        email: _auth!.currentUser?.email ?? '',
        nomor: nomor,
        yth: yth,
        dari: dari,
        hal: hal,
        lampiran: lampiran,
        sifat: sifat,
        tanggal: tanggal,
        poinDraft: poinDraft,
        isiNotaDinas: isiNotaDinas,
        pdfFileId: '',
        createdAt: now.toIso8601String(),
        buktiDukung: buktiDukungId,
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

      // Compress bukti dukung for PDF to prevent OOM
      Uint8List? compressedBuktiDukung;
      if (buktiDukungBytes != null && buktiDukungBytes.isNotEmpty) {
        compressedBuktiDukung = await _pdfService.compressForPdf(buktiDukungBytes);
        buktiDukungBytes = null; // Release raw bytes immediately
      }

      final pdfBytes = await _pdfService.createNotaDinasPdf(
        notaDinas: notaDinas,
        userProfile: _auth!.userProfile!,
        logoBytes: logoBytes,
        signatureBytes: signatureBytes,
        buktiDukungBytes: compressedBuktiDukung,
      );

      final cleanHal = hal.replaceAll(RegExp(r'[^\w\s\-]'), '').replaceAll(RegExp(r'\s+'), '_');
      final pdfFileId = await _auth!.driveService!.uploadFile(
        folderId,
        'ND-$dateStr-${cleanHal}_nota_dinas.pdf',
        pdfBytes,
        'application/pdf',
      );
      await _auth!.driveService!.setPublicAccess(pdfFileId);

      // Update PDF ID
      notaDinas = notaDinas.copyWith(pdfFileId: pdfFileId);

      // Save row to Sheets
      await _auth!.sheetsService!.appendRow(
        _auth!.spreadsheetId!,
        AppConstants.sheetNotaDinas,
        notaDinas.toSheetRow(),
      );

      _notaDinasList.insert(0, notaDinas);

      // Trigger ad check after successful PDF save
      AdService.instance.onPdfSaved();

      return true;
    } catch (e) {
      _errorMessage = 'Gagal menyimpan Nota Dinas: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> deleteNotaDinas(String id) async {
    if (_auth?.sheetsService == null || _auth?.spreadsheetId == null) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final notaDinas = _notaDinasList.firstWhere((nd) => nd.id == id);
      final rowIndex = await _auth!.sheetsService!.findRowByValue(
        _auth!.spreadsheetId!,
        AppConstants.sheetNotaDinas,
        0,
        id,
      );

      if (rowIndex > 0) {
        await _auth!.sheetsService!.deleteRow(
          _auth!.spreadsheetId!,
          AppConstants.sheetNotaDinas,
          rowIndex,
        );

        // Delete PDF and attachments from Drive
        if (_auth!.driveService != null) {
          if (notaDinas.pdfFileId.isNotEmpty) {
            try {
              await _auth!.driveService!.deleteFile(notaDinas.pdfFileId);
            } catch (_) {}
          }
          if (notaDinas.buktiDukung.isNotEmpty) {
            try {
              await _auth!.driveService!.deleteFile(notaDinas.buktiDukung);
            } catch (_) {}
          }
        }

        _notaDinasList.removeWhere((nd) => nd.id == id);
      }
    } catch (e) {
      _errorMessage = 'Gagal menghapus Nota Dinas: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateNotaDinasContent(String id, String newContent) async {
    if (_auth?.sheetsService == null || _auth?.driveService == null || _auth?.spreadsheetId == null) {
      _errorMessage = 'Sistem belum siap';
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final index = _notaDinasList.indexWhere((nd) => nd.id == id);
      if (index == -1) throw Exception('Nota Dinas tidak ditemukan di memori');
      var notaDinas = _notaDinasList[index];

      // 1. Dapatkan baris di Google Sheets
      final rowIndex = await _auth!.sheetsService!.findRowByValue(
        _auth!.spreadsheetId!,
        AppConstants.sheetNotaDinas,
        0,
        id,
      );
      if (rowIndex == -1) throw Exception('Nota Dinas tidak ditemukan di Google Sheets');

      // 2. Download foto bukti dukung lama jika ada, compress for PDF
      Uint8List? compressedBuktiDukung;
      if (notaDinas.buktiDukung.isNotEmpty) {
        try {
          final rawBukti = await _auth!.driveService!.downloadFile(notaDinas.buktiDukung);
          if (rawBukti != null && rawBukti.isNotEmpty) {
            compressedBuktiDukung = await _pdfService.compressForPdf(rawBukti);
          }
        } catch (_) {}
      }

      // 3. Hapus PDF laporan lama di Drive
      if (notaDinas.pdfFileId.isNotEmpty) {
        try {
          await _auth!.driveService!.deleteFile(notaDinas.pdfFileId);
        } catch (_) {}
      }

      // 4. Update data objek lokal sementara
      notaDinas = notaDinas.copyWith(isiNotaDinas: newContent);

      // 5. Generate PDF baru dengan isi yang sudah diedit
      List<int>? signatureBytes = _auth!.signatureBytes;
      if (signatureBytes == null && _auth!.userProfile?.signatureFileId.isNotEmpty == true) {
        try {
          signatureBytes = await _auth!.driveService!.downloadFile(_auth!.userProfile!.signatureFileId);
        } catch (_) {}
      }

      final pdfBytes = await _pdfService.createNotaDinasPdf(
        notaDinas: notaDinas,
        userProfile: _auth!.userProfile!,
        logoBytes: null,
        signatureBytes: signatureBytes,
        buktiDukungBytes: compressedBuktiDukung,
      );

      final cleanHal = notaDinas.hal.replaceAll(RegExp(r'[^\w\s\-]'), '').replaceAll(RegExp(r'\s+'), '_');
      final parts = id.split('-');
      final datePart = parts.length > 1 ? parts[1] : DateFormat('yyyyMMdd').format(DateTime.now());

      // 6. Upload PDF baru ke Drive
      final folderId = await _auth!.driveService!.getOrCreateFolder(AppConstants.driveFolderNotaDinas);
      final pdfFileId = await _auth!.driveService!.uploadFile(
        folderId,
        'ND-$datePart-${cleanHal}_nota_dinas.pdf',
        pdfBytes,
        'application/pdf',
      );
      await _auth!.driveService!.setPublicAccess(pdfFileId);

      // 7. Update PDF ID di notaDinas
      notaDinas = notaDinas.copyWith(pdfFileId: pdfFileId);

      // 8. Update baris di Google Sheets
      await _auth!.sheetsService!.updateRow(
        _auth!.spreadsheetId!,
        AppConstants.sheetNotaDinas,
        rowIndex,
        notaDinas.toSheetRow(),
      );

      // 9. Update state lokal
      _notaDinasList[index] = notaDinas;

      // Trigger ad check after successful PDF re-generation
      AdService.instance.onPdfSaved();

      return true;
    } catch (e) {
      _errorMessage = 'Gagal memperbarui isi surat: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
