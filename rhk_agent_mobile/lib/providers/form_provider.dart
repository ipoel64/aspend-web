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
        physicalLokasi: '', // Will be filled by AI
        createdAt: now.toIso8601String(),
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
        narasiAI: '', // Reset narrative so it gets regenerated
        narasiEdited: '',
        status: 'Draft',
        pdfFileId: '', // Reset PDF ID since we deleted the old one
        fotoIds: photoIds,
        p2k2Data: p2k2Data,
        physicalLokasi: '', // Will be filled by AI
        createdAt: oldReport.createdAt,
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

      // 2. Get AI config (locked to OpenRouter & default API key, only model is configurable)
      final configRows = await auth.sheetsService!.getAllRows(
        auth.spreadsheetId!,
        AppConstants.sheetConfig,
      );
      String provider = 'openrouter';
      String apiKey = AppConstants.defaultOpenRouterApiKey;
      String model = AppConstants.defaultOpenRouterModel;

      for (var row in configRows) {
        if (row.isNotEmpty) {
          if (row[0] == 'AI_MODEL' && row.length > 1) {
            model = row[1].toString();
          }
        }
      }

      // 3. Build Prompt
      String prompt;
      if (report.p2k2Data != null && report.p2k2Data!.modul.isNotEmpty) {
        prompt = _aiService.buildP2K2ReportPrompt(
          jenisRHK: report.jenisRHK,
          rencanaAksi: report.rencanaAksi,
          tanggal: report.tanggal,
          pukul: report.pukul,
          poinKegiatan: report.poinKegiatan,
          p2k2Data: report.p2k2Data!,
          isLlama: model.toLowerCase().contains('llama'),
        );
      } else {
        prompt = _aiService.buildReportPrompt(
          jenisRHK: report.jenisRHK,
          rencanaAksi: report.rencanaAksi,
          tanggal: report.tanggal,
          pukul: report.pukul,
          poinKegiatan: report.poinKegiatan,
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
      String location = '';
      final locRegex = RegExp(r'<lokasi>(.*?)</lokasi>', dotAll: true, caseSensitive: false);
      final locMatch = locRegex.firstMatch(narrative);
      if (locMatch != null) {
        location = locMatch.group(1)?.trim() ?? '';
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
      _errorMessage = 'Gagal generate narasi: $e';
      _isGeneratingNarrative = false;
      notifyListeners();
      return null;
    }
  }

  // 3. Save Edited Narrative
  Future<bool> saveNarrative({
    required AuthProvider auth,
    required String reportId,
    required String narrative,
  }) async {
    if (auth.sheetsService == null || auth.spreadsheetId == null) return false;

    try {
      final rowIndex = await auth.sheetsService!.findRowByValue(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        0,
        reportId,
      );

      if (rowIndex == -1) return false;

      // Write edited narrative to column I and update status to column J
      await auth.sheetsService!.writeCell(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        'I$rowIndex',
        narrative,
      );

      // Update status to Selesai (Col 9 / J)
      await auth.sheetsService!.writeCell(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        'J$rowIndex',
        'Selesai',
      );

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
      );
      await auth.driveService!.setPublicAccess(pdfFileId);

      // Update sheet with PDF ID
      final updatedReport = report.copyWith(pdfFileId: pdfFileId);
      await auth.sheetsService!.updateRow(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        rowIndex,
        updatedReport.toSheetRow(),
      );

      _isGeneratingPdf = false;
      notifyListeners();

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
