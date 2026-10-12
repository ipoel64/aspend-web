import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../config/constants.dart';
import '../models/p2k2_data.dart';
import '../models/report.dart';
import '../services/ai_service.dart';
import '../services/pdf_service.dart';
import '../services/ad_service.dart';
import '../services/subscription_service.dart';
import 'auth_provider.dart';

class FormProvider extends ChangeNotifier {
  AuthProvider? _auth;
  final AiService _aiService = AiService();
  final PdfService _pdfService = PdfService();

  bool _isSubmitting = false;
  bool _isGeneratingNarrative = false;
  bool _isGeneratingPdf = false;
  String? _errorMessage;

  void updateAuth(AuthProvider auth) {
    _auth = auth;
  }

  AuthProvider? get auth => _auth;

  bool get isSubmitting => _isSubmitting;
  bool get isGeneratingNarrative => _isGeneratingNarrative;
  bool get isGeneratingPdf => _isGeneratingPdf;
  String? get errorMessage => _errorMessage;

  // 1. Submit Form & Upload Photos
  Future<String?> submitReport({
    required AuthProvider auth,
    required String jenisRHK,
    required String idRHK,
    required String rencanaAksi,
    required String tanggal,
    required String pukul,
    required String poinKegiatan,
    required List<XFile> photos,
    P2K2Data? p2k2Data,
    String? physicalLokasi,
    bool showTanggalInPdf = true,
    bool showPukulInPdf = true,
  }) async {
    if (auth.sheetsService == null ||
        auth.driveService == null ||
        auth.spreadsheetId == null) {
      _errorMessage = 'Sistem belum siap';
      notifyListeners();
      return null;
    }

    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await auth.ensureFreshAuth();

      // 1. Generate ID (menggunakan timestamp detik untuk menjamin keunikan instan)
      final now = DateTime.now();
      final dateStr = DateFormat('yyyyMMdd').format(now);
      final timeStr = DateFormat('HHmmss').format(now);
      final reportId = 'RPT-$dateStr-$timeStr';

      // 2. Upload photos
      final folderId = await auth.driveService!.getOrCreateFolder(
        AppConstants.driveFolderBukti,
      );
      List<String> photoIds = [];

      for (int i = 0; i < photos.length; i++) {
        final rawBytes = await photos[i].readAsBytes();
        // Resize and compress to JPEG (max 800px width) in background isolate before upload
        final bytes = await _pdfService.resizeImage(rawBytes, targetWidth: 800);
        final fileName = '${reportId}_foto${i + 1}.jpg';

        final fileId = await auth.driveService!.uploadFile(
          folderId,
          fileName,
          bytes,
          'image/jpeg',
          onAuthExpired: () async {
            await auth.ensureFreshAuth();
          },
        );
        await auth.driveService!.setPublicAccess(fileId);
        photoIds.add(fileId);
      }

      // 3. Create Report object
      final report = Report(
        id: reportId,
        tanggal: tanggal,
        jenisRHK: jenisRHK,
        idRHK: idRHK,
        rencanaAksi: rencanaAksi,
        pukul: pukul,
        poinKegiatan: poinKegiatan,
        narasiAI: '',
        narasiEdited: '',
        status: 'Draft',
        pdfFileId: '',
        fotoIds: photoIds,
        p2k2Data: p2k2Data,
        physicalLokasi: physicalLokasi ?? (p2k2Data?.tempatPelaksanaan ?? ''),
        createdAt: now.toIso8601String(),
        showTanggalInPdf: showTanggalInPdf,
        showPukulInPdf: showPukulInPdf,
      );

      // 4. Save to Sheets
      await auth.sheetsService!.appendRow(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        report.toSheetRow(),
      );

      _isSubmitting = false;
      notifyListeners();
      return reportId;
    } catch (e) {
      _errorMessage = 'Gagal menyimpan laporan: $e';
      _isSubmitting = false;
      notifyListeners();
      return null;
    }
  }

  // 1b. Update Form & Upload Photos (for editing)
  Future<bool> updateReport({
    required AuthProvider auth,
    required String reportId,
    required String jenisRHK,
    required String idRHK,
    required String rencanaAksi,
    required String tanggal,
    required String pukul,
    required String poinKegiatan,
    required List<String> existingPhotoIds,
    required List<XFile> newPhotos,
    P2K2Data? p2k2Data,
    String? physicalLokasi,
    bool showTanggalInPdf = true,
    bool showPukulInPdf = true,
  }) async {
    if (auth.sheetsService == null ||
        auth.driveService == null ||
        auth.spreadsheetId == null) {
      _errorMessage = 'Sistem belum siap';
      notifyListeners();
      return false;
    }

    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await auth.ensureFreshAuth();

      // 1. Find report row index
      final rowIndex = await auth.sheetsService!.findRowByValue(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        0,
        reportId,
      );
      if (rowIndex == -1) throw Exception('Laporan tidak ditemukan');

      // Fetch the old report row to keep other properties or PDF ID if we don't want to recreate yet
      final oldRowData = await auth.sheetsService!.getRowByValue(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        0,
        reportId,
      );
      if (oldRowData == null) throw Exception('Laporan tidak ditemukan');
      final oldReport = Report.fromSheetRow(oldRowData);

      // 2. Upload new photos
      final folderId = await auth.driveService!.getOrCreateFolder(
        AppConstants.driveFolderBukti,
      );
      List<String> photoIds = List.from(existingPhotoIds);

      for (int i = 0; i < newPhotos.length; i++) {
        final rawBytes = await newPhotos[i].readAsBytes();
        // Resize and compress to JPEG (max 800px width) in background isolate before upload
        final bytes = await _pdfService.resizeImage(rawBytes, targetWidth: 800);
        final fileName = '${reportId}_foto_edit_${DateTime.now().millisecondsSinceEpoch}_${i + 1}.jpg';

        final fileId = await auth.driveService!.uploadFile(
          folderId,
          fileName,
          bytes,
          'image/jpeg',
          onAuthExpired: () async {
            await auth.ensureFreshAuth();
          },
        );
        await auth.driveService!.setPublicAccess(fileId);
        photoIds.add(fileId);
      }

      // Delete old photos that were removed from existingPhotoIds
      for (var oldId in oldReport.fotoIds) {
        if (!existingPhotoIds.contains(oldId)) {
          try {
            await auth.driveService!.deleteFile(oldId);
          } catch (e) {
            debugPrint('Gagal menghapus foto lama: $e');
          }
        }
      }

      // Delete old PDF file if it exists, so we don't leak files in Drive
      if (oldReport.pdfFileId.isNotEmpty) {
        try {
          await auth.driveService!.deleteFile(oldReport.pdfFileId);
        } catch (e) {
          debugPrint('Gagal menghapus PDF lama: $e');
        }
      }

      // Create updated Report object
      final updatedReport = Report(
        id: reportId,
        tanggal: tanggal,
        jenisRHK: jenisRHK,
        idRHK: idRHK,
        rencanaAksi: rencanaAksi,
        pukul: pukul,
        poinKegiatan: poinKegiatan,
        narasiAI: oldReport.narasiAI,
        narasiEdited: oldReport.narasiEdited,
        status: 'Draft',
        pdfFileId: '', // Reset PDF ID since we deleted the old one
        fotoIds: photoIds,
        p2k2Data: p2k2Data,
        physicalLokasi: physicalLokasi ?? (p2k2Data?.tempatPelaksanaan ?? oldReport.physicalLokasi),
        createdAt: oldReport.createdAt,
        showTanggalInPdf: showTanggalInPdf,
        showPukulInPdf: showPukulInPdf,
      );

      // Save to Sheets
      await auth.sheetsService!.updateRow(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        rowIndex,
        updatedReport.toSheetRow(),
      );

      _isSubmitting = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Gagal memperbarui laporan: $e';
      _isSubmitting = false;
      notifyListeners();
      return false;
    }
  }

  // 2. Generate Narrative
  // 2. Generate Narrative (Stream)
  Stream<String> generateNarrativeStream({
    required AuthProvider auth,
    required String reportId,
  }) async* {
    if (auth.sheetsService == null || auth.spreadsheetId == null) {
      throw Exception('Konfigurasi tidak valid');
    }

    _isGeneratingNarrative = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final rowData = await auth.sheetsService!.getRowByValue(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        0,
        reportId,
      );
      if (rowData == null) throw Exception('Laporan tidak ditemukan');

      final report = Report.fromSheetRow(rowData);
      String apiKey = AppConstants.defaultOpenRouterApiKey;
      String model = AppConstants.defaultOpenRouterModel;
      String provider = 'openrouter';

      final profile = auth.userProfile;
      String prompt;
      if (report.p2k2Data != null && report.p2k2Data!.modul.isNotEmpty) {
        prompt = _aiService.buildP2K2ReportPrompt(
          jenisRHK: report.jenisRHK,
          rencanaAksi: report.rencanaAksi,
          tanggal: report.tanggal,
          pukul: report.pukul,
          poinKegiatan: report.poinKegiatan,
          p2k2Data: report.p2k2Data!,
          kecamatan: profile?.kecamatan,
          kabupatenKota: profile?.kabupatenKota,
          provinsi: profile?.provinsi,
          namaPetugas: profile?.nama,
          jabatanPetugas: profile?.jabatan,
          isLlama: model.toLowerCase().contains('llama'),
        );
      } else {
        prompt = _aiService.buildReportPrompt(
          jenisRHK: report.jenisRHK,
          rencanaAksi: report.rencanaAksi,
          tanggal: report.tanggal,
          pukul: report.pukul,
          poinKegiatan: report.poinKegiatan,
          lokasi: report.physicalLokasi,
          kecamatan: profile?.kecamatan,
          kabupatenKota: profile?.kabupatenKota,
          provinsi: profile?.provinsi,
          namaPetugas: profile?.nama,
          jabatanPetugas: profile?.jabatan,
          isLlama: model.toLowerCase().contains('llama'),
        );
      }

      try {
        yield* _aiService.generateNarrativeStream(
          provider: provider,
          apiKey: apiKey,
          model: model,
          prompt: prompt,
        );
      } catch (streamError) {
        debugPrint('Stream encountered error, fallback to standard call: $streamError');
        final fullNarrative = await _aiService.generateNarrative(
          provider: provider,
          apiKey: apiKey,
          model: model,
          prompt: prompt,
        );
        yield fullNarrative;
      }

    } catch (e) {
      _errorMessage = _formatAiErrorMessage(e);
      notifyListeners();
      rethrow;
    } finally {
      _isGeneratingNarrative = false;
      notifyListeners();
    }
  }

  Future<String?> generateNarrative({
    required AuthProvider auth,
    required String reportId,
  }) async {
    if (auth.sheetsService == null || auth.spreadsheetId == null) return null;

    _isGeneratingNarrative = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // 1. Fetch report details
      final rowIndex = await auth.sheetsService!.findRowByValue(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        0,
        reportId,
      );

      if (rowIndex == -1) throw Exception('Laporan tidak ditemukan');

      final rowData = await auth.sheetsService!.getRowByValue(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        0,
        reportId,
      );
      if (rowData == null) throw Exception('Laporan tidak ditemukan');

      final report = Report.fromSheetRow(rowData);

      // 2. Get AI config
      String apiKey = AppConstants.defaultOpenRouterApiKey;
      String model = AppConstants.defaultOpenRouterModel;
      String provider = 'openrouter';

      // AI config is fully controlled from AppConstants - no sheet reading needed

      final profile = auth.userProfile;
      String prompt;
      if (report.p2k2Data != null && report.p2k2Data!.modul.isNotEmpty) {
        prompt = _aiService.buildP2K2ReportPrompt(
          jenisRHK: report.jenisRHK,
          rencanaAksi: report.rencanaAksi,
          tanggal: report.tanggal,
          pukul: report.pukul,
          poinKegiatan: report.poinKegiatan,
          p2k2Data: report.p2k2Data!,
          kecamatan: profile?.kecamatan,
          kabupatenKota: profile?.kabupatenKota,
          provinsi: profile?.provinsi,
          namaPetugas: profile?.nama,
          jabatanPetugas: profile?.jabatan,
          isLlama: model.toLowerCase().contains('llama'),
        );
      } else {
        prompt = _aiService.buildReportPrompt(
          jenisRHK: report.jenisRHK,
          rencanaAksi: report.rencanaAksi,
          tanggal: report.tanggal,
          pukul: report.pukul,
          poinKegiatan: report.poinKegiatan,
          lokasi: report.physicalLokasi,
          kecamatan: profile?.kecamatan,
          kabupatenKota: profile?.kabupatenKota,
          provinsi: profile?.provinsi,
          namaPetugas: profile?.nama,
          jabatanPetugas: profile?.jabatan,
          isLlama: model.toLowerCase().contains('llama'),
        );
      }

      // 4. Optionally download photos for vision AI (skipped for basic version to save bandwidth)
      // Call AI
      final narrative = await _aiService.generateNarrative(
        provider: provider,
        apiKey: apiKey,
        model: model,
        prompt: prompt,
      );

      // 5. Extract location
      String location = report.physicalLokasi;
      final locRegex = RegExp(r'<lokasi>(.*?)</lokasi>', dotAll: true, caseSensitive: false);
      final locMatch = locRegex.firstMatch(narrative);
      if (locMatch != null) {
        final parsed = locMatch.group(1)?.trim() ?? '';
        if (location.isEmpty && parsed.isNotEmpty && parsed != 'Tidak disebutkan') {
          location = parsed;
        }
      }
      String cleanNarrative = narrative.replaceAll(locRegex, '').trim();
      
      // Clean up weird characters that Llama might generate
      cleanNarrative = cleanNarrative
          .replaceAll('“', '"')
          .replaceAll('”', '"')
          .replaceAll('‘', "'")
          .replaceAll('’', "'")
          .replaceAll('–', '-')
          .replaceAll('—', '-')
          .replaceAll('•', '-')
          .replaceAll('\u00AD', ''); // Soft hyphen

      // Strip preamble if any model decides to be chatty
      final preambleMatch = RegExp(r'(?:\*\*)?A\.\s+PENDAHULUAN(?:\*\*)?', caseSensitive: false).firstMatch(cleanNarrative);
      if (preambleMatch != null) {
        cleanNarrative = cleanNarrative.substring(preambleMatch.start);
      }

      // 6. Update sheet
      final updatedReport = report.copyWith(
        narasiAI: cleanNarrative,
        physicalLokasi: location,
      );

      await auth.sheetsService!.updateRow(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        rowIndex,
        updatedReport.toSheetRow(),
      );

      _isGeneratingNarrative = false;
      notifyListeners();
      return cleanNarrative;
    } catch (e) {
      _errorMessage = _formatAiErrorMessage(e);
      _isGeneratingNarrative = false;
      notifyListeners();
      return null;
    }
  }

  String _formatAiErrorMessage(dynamic e) {
    final str = e.toString().toLowerCase();
    if (str.contains('clientexception') ||
        str.contains('connection closed') ||
        str.contains('connection reset') ||
        str.contains('broken pipe') ||
        str.contains('socketexception') ||
        str.contains('timed out') ||
        str.contains('handshake') ||
        str.contains('network') ||
        str.contains('host lookup') ||
        str.contains('connection refused')) {
      return 'Koneksi internet terputus atau tidak stabil saat membuat narasi. Silakan periksa jaringan internet Anda dan tekan "Buat Ulang".';
    }
    return 'Gagal membuat narasi: $e';
  }

  // 3. Save Edited Narrative
  Future<bool> saveNarrative({
    required AuthProvider auth,
    required String reportId,
    required String narrative,
    String? location,
  }) async {
    if (auth.sheetsService == null || auth.spreadsheetId == null) return false;

    try {
      await auth.ensureFreshAuth();

      final rowIndex = await auth.sheetsService!.findRowByValue(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        0,
        reportId,
      );

      if (rowIndex == -1) return false;

      // Write edited narrative to column I
      await auth.sheetsService!.writeCell(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        'I$rowIndex',
        narrative,
      );

      if (location != null && location.isNotEmpty) {
        await auth.sheetsService!.writeCell(
          auth.spreadsheetId!,
          AppConstants.sheetLaporanLog,
          'N$rowIndex',
          location,
        );
      }

      return true;
    } catch (e) {
      _errorMessage = 'Gagal menyimpan narasi: $e';
      notifyListeners();
      return false;
    }
  }

  // 4. Generate PDF
  Future<bool> generatePdf({
    required AuthProvider auth,
    required String reportId,
  }) async {
    if (auth.sheetsService == null ||
        auth.driveService == null ||
        auth.spreadsheetId == null)
      return false;

    _isGeneratingPdf = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await auth.ensureFreshAuth();

      // 1. Cek limitasi pengguna gratis
      final hasReachedLimit = await SubscriptionService.instance.hasReachedDailyPdfLimit();
      if (hasReachedLimit) {
        throw Exception('LIMIT_REACHED');
      }

      // Fetch full report data
      final rowIndex = await auth.sheetsService!.findRowByValue(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        0,
        reportId,
      );

      if (rowIndex == -1) throw Exception('Laporan tidak ditemukan');

      final rowData = await auth.sheetsService!.getRowByValue(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        0,
        reportId,
      );
      if (rowData == null) throw Exception('Laporan tidak ditemukan');

      final report = Report.fromSheetRow(rowData);

      if (auth.userProfile == null) {
        throw Exception('Profil pengguna belum tersedia');
      }

      // Download signature, and photos (logo is loaded locally in pdf_service)
      List<int>? logoBytes; // Kept for method compatibility

      List<int>? signatureBytes = auth.signatureBytes;
      if (signatureBytes == null && auth.userProfile!.signatureFileId.isNotEmpty) {
        signatureBytes = await auth.driveService!.downloadFile(
          auth.userProfile!.signatureFileId,
        );
      }

      // Download & compress photos ONE AT A TIME to prevent OOM.
      // Each raw download is immediately compressed in a worker isolate,
      // then the raw bytes are released before downloading the next photo.
      List<Uint8List> photosBytes = [];
      for (int i = 0; i < report.fotoIds.length; i++) {
        final photoId = report.fotoIds[i];
        Uint8List? rawBytes = await auth.driveService!.downloadFile(photoId);
        if (rawBytes != null) {
          debugPrint('PDF foto ${i + 1}/${report.fotoIds.length}: raw ${rawBytes.length ~/ 1024}KB');
          final compressed = await _pdfService.compressForPdf(rawBytes);
          debugPrint('PDF foto ${i + 1}/${report.fotoIds.length}: compressed ${compressed.length ~/ 1024}KB');
          photosBytes.add(compressed);
          rawBytes = null; // Release raw bytes immediately
        }
      }

      // Generate PDF locally
      final pdfBytes = await _pdfService.createReportPdf(
        report: report,
        userProfile: auth.userProfile!,
        logoBytes: logoBytes,
        signatureBytes: signatureBytes,
        photosBytes: photosBytes,
      );

      // Upload PDF to Drive
      final folderId = await auth.driveService!.getOrCreateFolder(
        AppConstants.driveFolderOutput,
      );

      // Formatter tanggal untuk nama file
      String fileDateStr;
      try {
        String rawDate = report.tanggal.trim();
        final parts = rawDate.split(' ');
        if (parts.length == 2) {
          final timeParts = parts[1].split(':');
          if (timeParts.length == 3) {
            rawDate = '${parts[0]} ${timeParts[0].padLeft(2, '0')}:${timeParts[1].padLeft(2, '0')}:${timeParts[2].padLeft(2, '0')}';
          }
        }
        final parsedDate = DateTime.tryParse(rawDate) ?? DateTime.now();
        fileDateStr = DateFormat('yyyyMMdd').format(parsedDate);
      } catch (_) {
        fileDateStr = DateFormat('yyyyMMdd').format(DateTime.now());
      }

      String timeStr = '00.00';
      if (report.pukul.isNotEmpty) {
        timeStr = report.pukul.replaceAll(':', '.');
      }

      // Bersihkan nama rencana aksi dari karakter ilegal untuk penamaan file OS
      final cleanRencanaAksi = report.rencanaAksi.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
      final fileName = '$fileDateStr - $timeStr - ${report.idRHK} - $cleanRencanaAksi.pdf';

      final pdfFileId = await auth.driveService!.uploadFile(
        folderId,
        fileName,
        pdfBytes,
        'application/pdf',
        onAuthExpired: () async {
          await auth.ensureFreshAuth();
        },
      );
      await auth.driveService!.setPublicAccess(pdfFileId);

      // Update sheet with PDF ID and Selesai status
      final updatedReport = report.copyWith(
        pdfFileId: pdfFileId,
        status: 'Selesai',
      );
      await auth.sheetsService!.updateRow(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        rowIndex,
        updatedReport.toSheetRow(),
      );

      _isGeneratingPdf = false;
      notifyListeners();

      // Tambahkan hitungan limit
      await SubscriptionService.instance.incrementDailyPdfCount();

      // Trigger ad check after successful PDF save
      AdService.instance.onPdfSaved();

      return true;
    } catch (e) {
      _errorMessage = 'Gagal membuat PDF: $e';
      _isGeneratingPdf = false;
      notifyListeners();
      return false;
    }
  }
}

