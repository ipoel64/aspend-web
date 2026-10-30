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
  String? _progressMessage;

  // Cache foto terkompresi di memori agar saat membuat PDF tidak perlu mengunduh ulang 100 foto dari Drive
  final Map<String, Uint8List> _cachedPhotoBytes = {};

  void _cacheUploadedPhoto(String fileId, Uint8List bytes) {
    if (fileId.isEmpty) return;
    if (_cachedPhotoBytes.length >= 120) {
      _cachedPhotoBytes.remove(_cachedPhotoBytes.keys.first);
    }
    _cachedPhotoBytes[fileId] = bytes;
  }

  void updateAuth(AuthProvider auth) {
    _auth = auth;
  }

  AuthProvider? get auth => _auth;

  bool get isSubmitting => _isSubmitting;
  bool get isGeneratingNarrative => _isGeneratingNarrative;
  bool get isGeneratingPdf => _isGeneratingPdf;
  String? get errorMessage => _errorMessage;
  String? get progressMessage => _progressMessage;

  /// Mengompres dan mengunggah banyak foto (hingga 100 foto) secara paralel terkontrol (6 foto sekaligus)
  /// sambil menjaga urutan asli foto dan memperbarui progress real-time.
  Future<List<String>> _uploadPhotosInBatches({
    required AuthProvider auth,
    required String folderId,
    required List<XFile> photos,
    required String filePrefix,
  }) async {
    if (photos.isEmpty) return [];

    final List<String> orderedIds = List.filled(photos.length, '');
    int completedCount = 0;
    const int batchSize = 6;
    final int targetWidth = photos.length > 25 ? 760 : 800;
    final int quality = photos.length > 25 ? 68 : 72;

    _progressMessage = 'Mengompres & mengunggah foto (0/${photos.length})...';
    notifyListeners();

    for (int start = 0; start < photos.length; start += batchSize) {
      final int end = (start + batchSize < photos.length) ? start + batchSize : photos.length;
      final List<Future<void>> batchFutures = [];

      for (int i = start; i < end; i++) {
        final int index = i;
        batchFutures.add(() async {
          List<int>? rawBytes = await photos[index].readAsBytes();
          final bytes = await _pdfService.resizeImage(
            rawBytes,
            targetWidth: targetWidth,
            quality: quality,
          );
          rawBytes = null; // Bebaskan memori foto mentah berukuran besar seketika
          final fileName = '${filePrefix}_${index + 1}.jpg';

          final fileId = await auth.driveService!.uploadFile(
            folderId,
            fileName,
            bytes,
            'image/jpeg',
            onAuthExpired: () async {
              await auth.ensureFreshAuth();
            },
          );
          // Set izin akses publik secara asinkron tanpa memblokir antrean upload
          auth.driveService!.setPublicAccess(fileId).catchError((_) {});
          orderedIds[index] = fileId;
          _cacheUploadedPhoto(fileId, bytes);

          completedCount++;
          final pct = ((completedCount / photos.length) * 100).round();
          _progressMessage = 'Mengompres & mengunggah foto ($completedCount/${photos.length}) $pct%...';
          notifyListeners();
        }());
      }

      await Future.wait(batchFutures);
    }

    return orderedIds.where((id) => id.isNotEmpty).toList();
  }

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
    _progressMessage = 'Menyiapkan penyimpanan Drive...';
    notifyListeners();

    try {
      await auth.ensureFreshAuth();

      // 1. Generate ID (menggunakan timestamp detik untuk menjamin keunikan instan)
      final now = DateTime.now();
      final dateStr = DateFormat('yyyyMMdd').format(now);
      final timeStr = DateFormat('HHmmss').format(now);
      final reportId = 'RPT-$dateStr-$timeStr';

      // 2. Upload photos in parallel batches (up to 100 photos fast & ordered)
      final folderId = await auth.driveService!.getOrCreateFolder(
        AppConstants.driveFolderBukti,
      );
      final List<String> photoIds = await _uploadPhotosInBatches(
        auth: auth,
        folderId: folderId,
        photos: photos,
        filePrefix: '${reportId}_foto',
      );

      _progressMessage = 'Menyimpan data laporan...';
      notifyListeners();

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
      _progressMessage = null;
      notifyListeners();
      return reportId;
    } catch (e) {
      _errorMessage = 'Gagal menyimpan laporan: $e';
      _isSubmitting = false;
      _progressMessage = null;
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
    _progressMessage = 'Memuat data laporan...';
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

      // 2. Upload new photos in parallel batches
      List<String> photoIds = List.from(existingPhotoIds);
      if (newPhotos.isNotEmpty) {
        final folderId = await auth.driveService!.getOrCreateFolder(
          AppConstants.driveFolderBukti,
        );
        final uploadedNewIds = await _uploadPhotosInBatches(
          auth: auth,
          folderId: folderId,
          photos: newPhotos,
          filePrefix: '${reportId}_foto_edit_${DateTime.now().millisecondsSinceEpoch}',
        );
        photoIds.addAll(uploadedNewIds);
      }

      _progressMessage = 'Menyimpan perubahan...';
      notifyListeners();

      // Delete old photos that were removed from existingPhotoIds (non-blocking in parallel)
      final removedOldIds = oldReport.fotoIds
          .where((oldId) => !existingPhotoIds.contains(oldId))
          .toList();
      if (removedOldIds.isNotEmpty) {
        Future.wait(
          removedOldIds.map((oldId) => auth.driveService!.deleteFile(oldId).catchError((_) {})),
        ).catchError((_) => <void>[]);
      }

      // Delete old PDF file if it exists, so we don't leak files in Drive
      if (oldReport.pdfFileId.isNotEmpty) {
        auth.driveService!.deleteFile(oldReport.pdfFileId).catchError((_) {});
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
      _progressMessage = null;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Gagal memperbarui laporan: $e';
      _isSubmitting = false;
      _progressMessage = null;
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

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  String _formatAiErrorMessage(dynamic e) {
    final str = e.toString().toLowerCase();
    if (str.contains('missing authentication header') ||
        str.contains('401') ||
        str.contains('unauthorized')) {
      return 'Koneksi autentikasi AI sedang diperbarui. Sistem otomatis menghubungkan ulang, silakan tekan "Buat Ulang".';
    }
    if (str.contains('certificate is not yet valid') ||
        str.contains('certificate has expired') ||
        str.contains('certificate_verify_failed')) {
      return 'Tanggal & Waktu di HP Anda belum sinkron dengan server. Silakan aktifkan "Tanggal & Waktu Otomatis" di pengaturan HP Anda, lalu tekan "Buat Ulang".';
    }
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
    _progressMessage = 'Menyiapkan data dokumen PDF...';
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

      // Download signature (logo is loaded locally in pdf_service)
      List<int>? logoBytes; // Kept for method compatibility

      List<int>? signatureBytes = auth.signatureBytes;
      if (signatureBytes == null && auth.userProfile!.signatureFileId.isNotEmpty) {
        signatureBytes = await auth.driveService!.downloadFile(
          auth.userProfile!.signatureFileId,
        );
      }

      // Gunakan foto dari _cachedPhotoBytes secara instan tanpa perlu mengunduh ulang dari Google Drive!
      // Hanya foto lama yang belum ada di cache yang diunduh secara paralel terkontrol (batch 6).
      final int totalPhotos = report.fotoIds.length;
      final List<Uint8List?> orderedPhotoBytes = List.filled(totalPhotos, null);
      final List<int> missingIndices = [];

      for (int i = 0; i < totalPhotos; i++) {
        final photoId = report.fotoIds[i];
        final cached = _cachedPhotoBytes[photoId];
        if (cached != null) {
          orderedPhotoBytes[i] = cached;
        } else {
          missingIndices.add(i);
        }
      }

      if (missingIndices.isNotEmpty) {
        int downloadedMissing = 0;
        const int batchSize = 6;
        _progressMessage = 'Menyiapkan foto dokumentasi (${totalPhotos - missingIndices.length}/$totalPhotos)...';
        notifyListeners();

        for (int start = 0; start < missingIndices.length; start += batchSize) {
          final int end = (start + batchSize < missingIndices.length)
              ? start + batchSize
              : missingIndices.length;
          final chunkIndices = missingIndices.sublist(start, end);

          await Future.wait(chunkIndices.map((idx) async {
            final photoId = report.fotoIds[idx];
            Uint8List? rawBytes = await auth.driveService!.downloadFile(photoId);
            if (rawBytes != null) {
              final compressed = await _pdfService.compressForPdf(rawBytes);
              rawBytes = null;
              orderedPhotoBytes[idx] = compressed;
              _cacheUploadedPhoto(photoId, compressed);
            }
            downloadedMissing++;
            final readyTotal = (totalPhotos - missingIndices.length) + downloadedMissing;
            _progressMessage = 'Menyiapkan foto dokumentasi ($readyTotal/$totalPhotos)...';
            notifyListeners();
          }));
        }
      }

      final List<Uint8List> photosBytes =
          orderedPhotoBytes.whereType<Uint8List>().toList();

      _progressMessage = 'Menyusun halaman PDF (${photosBytes.length} foto)...';
      notifyListeners();

      // Generate PDF locally
      final pdfBytes = await _pdfService.createReportPdf(
        report: report,
        userProfile: auth.userProfile!,
        logoBytes: logoBytes,
        signatureBytes: signatureBytes,
        photosBytes: photosBytes,
      );

      _progressMessage = 'Mengunggah PDF ke Google Drive...';
      notifyListeners();

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
      auth.driveService!.setPublicAccess(pdfFileId).catchError((_) {});

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
      _progressMessage = null;
      notifyListeners();

      // Tambahkan hitungan limit
      await SubscriptionService.instance.incrementDailyPdfCount();

      // Trigger ad check after successful PDF save
      AdService.instance.onPdfSaved();

      return true;
    } catch (e) {
      _errorMessage = 'Gagal membuat PDF: $e';
      _isGeneratingPdf = false;
      _progressMessage = null;
      notifyListeners();
      return false;
    }
  }

  /// Eksekusi kilat: kompres foto 1x & buat PDF secara lokal, lalu upload foto & PDF secara paralel terkontrol (batch 6),
  /// serta simpan 1 kali append ke Google Sheets (mendukung hingga 100 foto tanpa membebani jaringan/memori).
  Future<String?> submitAndGeneratePdfDirectly({
    required AuthProvider auth,
    required String jenisRHK,
    required String idRHK,
    required String rencanaAksi,
    required String tanggal,
    required String pukul,
    required String poinKegiatan,
    required String narrative,
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

    // 1. Cek limitasi pengguna gratis (3x sehari)
    final hasReachedLimit = await SubscriptionService.instance.hasReachedDailyPdfLimit();
    if (hasReachedLimit) {
      _errorMessage = 'LIMIT_REACHED';
      notifyListeners();
      return null;
    }

    _isSubmitting = true;
    _isGeneratingPdf = true;
    _errorMessage = null;
    _progressMessage = 'Memproses foto (0/${photos.length})...';
    notifyListeners();

    try {
      await auth.ensureFreshAuth();

      final now = DateTime.now();
      final dateStr = DateFormat('yyyyMMdd').format(now);
      final timeStr = DateFormat('HHmmss').format(now);
      final reportId = 'RPT-$dateStr-$timeStr';

      // 2. Kompresi foto sekali saja (hasil resize langsung dipakai untuk Drive dan PDF)
      final int targetWidth = photos.length > 25 ? 760 : 800;
      final int quality = photos.length > 25 ? 68 : 72;
      final List<Uint8List> resizedPhotos = List.filled(photos.length, Uint8List(0));
      int compressedCount = 0;
      const int compressBatchSize = 6;

      for (int start = 0; start < photos.length; start += compressBatchSize) {
        final int end = (start + compressBatchSize < photos.length)
            ? start + compressBatchSize
            : photos.length;
        final List<Future<void>> chunk = [];
        for (int i = start; i < end; i++) {
          final int idx = i;
          chunk.add(() async {
            final rawBytes = await photos[idx].readAsBytes();
            final resized = await _pdfService.resizeImage(
              rawBytes,
              targetWidth: targetWidth,
              quality: quality,
            );
            resizedPhotos[idx] = resized;
            compressedCount++;
            _progressMessage = 'Memproses foto ($compressedCount/${photos.length})...';
            notifyListeners();
          }());
        }
        await Future.wait(chunk);
      }

      // 3. Ambil tanda tangan pengguna (gunakan cache jika ada)
      List<int>? signatureBytes = auth.signatureBytes;
      if (signatureBytes == null && auth.userProfile != null && auth.userProfile!.signatureFileId.isNotEmpty) {
        try {
          signatureBytes = await auth.driveService!.downloadFile(auth.userProfile!.signatureFileId);
        } catch (e) {
          debugPrint('Gagal download tanda tangan: $e');
        }
      }

      if (auth.userProfile == null) {
        throw Exception('Profil pengguna belum tersedia');
      }

      // 4. Susun entitas Report awal untuk digenerate ke PDF secara lokal instan
      final initialReport = Report(
        id: reportId,
        tanggal: tanggal,
        jenisRHK: jenisRHK,
        idRHK: idRHK,
        rencanaAksi: rencanaAksi,
        pukul: pukul,
        poinKegiatan: poinKegiatan,
        narasiAI: narrative,
        narasiEdited: narrative,
        status: 'Selesai',
        pdfFileId: '',
        fotoIds: const [],
        p2k2Data: p2k2Data,
        physicalLokasi: physicalLokasi ?? (p2k2Data?.tempatPelaksanaan ?? ''),
        createdAt: now.toIso8601String(),
        showTanggalInPdf: showTanggalInPdf,
        showPukulInPdf: showPukulInPdf,
      );

      _progressMessage = 'Menyusun dokumen PDF...';
      notifyListeners();

      // 5. Buat PDF secara lokal
      final pdfBytes = await _pdfService.createReportPdf(
        report: initialReport,
        userProfile: auth.userProfile!,
        signatureBytes: signatureBytes,
        photosBytes: resizedPhotos,
      );

      // 6. Dapatkan Folder Drive Bukti & Output secara paralel
      final folders = await Future.wait([
        auth.driveService!.getOrCreateFolder(AppConstants.driveFolderBukti),
        auth.driveService!.getOrCreateFolder(AppConstants.driveFolderOutput),
      ]);
      final buktiFolderId = folders[0];
      final outputFolderId = folders[1];

      // 7. Upload foto dalam batch paralel terkontrol (6 sekaligus) & PDF bersamaan
      final List<String> photoIds = List.filled(resizedPhotos.length, '');
      int uploadedCount = 0;
      const int uploadBatchSize = 6;

      Future<void> uploadAllPhotosBatched() async {
        for (int start = 0; start < resizedPhotos.length; start += uploadBatchSize) {
          final int end = (start + uploadBatchSize < resizedPhotos.length)
              ? start + uploadBatchSize
              : resizedPhotos.length;
          final List<Future<void>> batchFutures = [];
          for (int i = start; i < end; i++) {
            final int idx = i;
            batchFutures.add(() async {
              final fileName = '${reportId}_foto${idx + 1}.jpg';
              final fId = await auth.driveService!.uploadFile(
                buktiFolderId,
                fileName,
                resizedPhotos[idx],
                'image/jpeg',
                onAuthExpired: () async => await auth.ensureFreshAuth(),
              );
              auth.driveService!.setPublicAccess(fId).catchError((_) {});
              photoIds[idx] = fId;
              _cacheUploadedPhoto(fId, resizedPhotos[idx]);
              uploadedCount++;
              _progressMessage = 'Mengunggah foto ($uploadedCount/${resizedPhotos.length})...';
              notifyListeners();
            }());
          }
          await Future.wait(batchFutures);
        }
      }

      String fileDateStr;
      try {
        final parsed = DateTime.tryParse(tanggal) ?? DateTime.now();
        fileDateStr = DateFormat('yyyyMMdd').format(parsed);
      } catch (_) {
        fileDateStr = DateFormat('yyyyMMdd').format(DateTime.now());
      }
      final timeFormatted = pukul.isNotEmpty ? pukul.replaceAll(':', '.') : '00.00';
      final cleanRencana = rencanaAksi.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
      final pdfFileName = '$fileDateStr - $timeFormatted - $idRHK - $cleanRencana.pdf';

      final pdfUploadFuture = auth.driveService!.uploadFile(
        outputFolderId,
        pdfFileName,
        pdfBytes,
        'application/pdf',
        onAuthExpired: () async => await auth.ensureFreshAuth(),
      ).then((fId) {
        auth.driveService!.setPublicAccess(fId).catchError((_) {});
        return fId;
      });

      final uploadResults = await Future.wait([
        uploadAllPhotosBatched(),
        pdfUploadFuture,
      ]);

      final pdfFileId = uploadResults[1] as String;

      // 8. Simpan laporan final ke Google Sheets dengan 1 kali append
      final finalReport = initialReport.copyWith(
        pdfFileId: pdfFileId,
        fotoIds: photoIds.where((id) => id.isNotEmpty).toList(),
      );

      await auth.sheetsService!.appendRow(
        auth.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        finalReport.toSheetRow(),
      );

      _isSubmitting = false;
      _isGeneratingPdf = false;
      _progressMessage = null;
      notifyListeners();

      // Tambahkan hitungan limit & periksa iklan
      await SubscriptionService.instance.incrementDailyPdfCount();
      AdService.instance.onPdfSaved();

      return reportId;
    } catch (e) {
      _errorMessage = 'Gagal memproses dan menyimpan laporan: $e';
      _isSubmitting = false;
      _isGeneratingPdf = false;
      _progressMessage = null;
      notifyListeners();
      return null;
    }
  }
}

