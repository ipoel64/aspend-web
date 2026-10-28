import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:image/image.dart' as img;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../models/report.dart';
import '../models/user_profile.dart';
import '../models/p2k2_data.dart';
import '../models/pengaduan.dart';
import '../models/nota_dinas.dart';
import '../utils/string_utils.dart';

class _EncodeRgbaParams {
  final Uint8List rgbaBytes;
  final int width;
  final int height;
  final int quality;

  const _EncodeRgbaParams({
    required this.rgbaBytes,
    required this.width,
    required this.height,
    required this.quality,
  });
}

Uint8List _encodeRgbaToJpgIsolate(_EncodeRgbaParams params) {
  final imgImage = img.Image.fromBytes(
    width: params.width,
    height: params.height,
    bytes: params.rgbaBytes.buffer,
    order: img.ChannelOrder.rgba,
  );
  return Uint8List.fromList(img.encodeJpg(imgImage, quality: params.quality));
}

class PdfService {
  /// Checks if the given bytes represent a PNG image (magic bytes: 0x89 P N G).
  bool _isPng(List<int> bytes) {
    if (bytes.length < 8) return false;
    return bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47;
  }

  /// Resizes an image using native Flutter engine (Skia) to keep memory usage minimal.
  /// 
  /// KEY FIX for OOM on screenshots: We now check actual pixel dimensions instead
  /// of file size. PNG screenshots can be tiny files (50-90KB) but have huge
  /// pixel dimensions (1080x2400). When PDF lib decodes them, each becomes ~10MB
  /// raw bitmap in RAM, causing OOM with just 3-4 images.
  /// 
  /// Output is always JPEG for PDF photos, which is 10-20x smaller than PNG.
  Future<Uint8List> resizeImage(List<int> inputBytes, {int targetWidth = 800, int quality = 70}) async {
    final input = Uint8List.fromList(inputBytes);
    
    ui.ImmutableBuffer? buffer;
    ui.ImageDescriptor? descriptor;
    ui.Codec? codec;
    ui.Image? image;
    
    try {
      buffer = await ui.ImmutableBuffer.fromUint8List(input);
      descriptor = await ui.ImageDescriptor.encoded(buffer);
      
      final int origWidth = descriptor.width;
      final int origHeight = descriptor.height;
      
      // Determine if we need to resize based on PIXEL DIMENSIONS, not file size.
      // Screenshots are often small PNG files with large pixel dimensions.
      final bool needsResize = origWidth > targetWidth || origHeight > targetWidth;
      
      // For small images that don't need resize AND aren't PNG, return as-is.
      // PNG images always need re-encoding to JPEG for memory efficiency in PDF.
      if (!needsResize && !_isPng(inputBytes)) {
        descriptor.dispose();
        buffer.dispose();
        return input;
      }
      
      int newWidth = origWidth;
      int newHeight = origHeight;
      
      if (needsResize) {
        // Scale down proportionally based on the larger dimension
        if (origWidth >= origHeight) {
          newHeight = (origHeight * targetWidth / origWidth).round();
          newWidth = targetWidth;
        } else {
          // For portrait screenshots (height > width), scale based on height
          newWidth = (origWidth * targetWidth / origHeight).round();
          newHeight = targetWidth;
        }
      }

      codec = await descriptor.instantiateCodec(targetWidth: newWidth, targetHeight: newHeight);
      final frame = await codec.getNextFrame();
      final originalImage = frame.image;

      // Draw the image onto a white background to prevent transparent PNGs from turning black
      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);
      canvas.drawRect(
        ui.Rect.fromLTWH(0, 0, originalImage.width.toDouble(), originalImage.height.toDouble()),
        ui.Paint()..color = const ui.Color(0xFFFFFFFF),
      );
      canvas.drawImage(originalImage, ui.Offset.zero, ui.Paint());
      final picture = recorder.endRecording();
      
      image = await picture.toImage(originalImage.width, originalImage.height);
      originalImage.dispose();
      picture.dispose();

      // Export as raw RGBA, then encode to JPEG via background isolate (compute)
      // so main UI thread never freezes even when processing 100 photos.
      final byteData = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
      
      if (byteData != null) {
        final int imgW = image.width;
        final int imgH = image.height;
        final rgbaUint8 = byteData.buffer.asUint8List(byteData.offsetInBytes, byteData.lengthInBytes);
        final jpegBytes = await compute(
          _encodeRgbaToJpgIsolate,
          _EncodeRgbaParams(
            rgbaBytes: rgbaUint8,
            width: imgW,
            height: imgH,
            quality: quality,
          ),
        );
        debugPrint('resizeImage: ${origWidth}x$origHeight (${inputBytes.length ~/ 1024}KB) → ${imgW}x$imgH (${jpegBytes.length ~/ 1024}KB JPEG)');
        return jpegBytes;
      }
    } catch (e) {
      debugPrint('Native resize failed: $e');
    } finally {
      // Always clean up native resources to prevent memory leaks
      try { image?.dispose(); } catch (_) {}
      try { codec?.dispose(); } catch (_) {}
      try { descriptor?.dispose(); } catch (_) {}
      try { buffer?.dispose(); } catch (_) {}
    }
    
    // Fallback to original bytes
    return input;
  }

  /// Compresses a photo specifically for PDF documentation.
  /// Uses balanced quality (75) and width (800) for sharp photos and low RAM footprint.
  Future<Uint8List> compressForPdf(List<int> inputBytes) async {
    const int effectiveQuality = 75;
    const int effectiveWidth = 800;
    return resizeImage(inputBytes, targetWidth: effectiveWidth, quality: effectiveQuality);
  }

  /// Sanitizes text to remove Unicode symbols and missing glyphs (like boxes with X ☒)
  /// that standard PDF Helvetica font cannot render.
  static String sanitizePdfText(String text) {
    if (text.isEmpty) return text;
    return text
        .replaceAll('\u2013', '-') // en-dash –
        .replaceAll('\u2014', '-') // em-dash —
        .replaceAll('\u2212', '-') // minus sign −
        .replaceAll('\u00A0', ' ') // non-breaking space
        .replaceAll('\u2022', '-') // bullet •
        .replaceAll('\u2026', '...') // ellipsis …
        .replaceAll('“', '"')
        .replaceAll('”', '"')
        .replaceAll('‘', "'")
        .replaceAll('’', "'");
  }

  DateTime _safeParseDate(String dateStr) {
    final cleaned = dateStr.trim();
    final parsed = DateTime.tryParse(cleaned);
    if (parsed != null) return parsed;

    try {
      final parts = cleaned.split(' ');
      if (parts.length == 2) {
        final datePart = parts[0];
        final timePart = parts[1];
        final timeSubparts = timePart.split(':');
        if (timeSubparts.length == 3) {
          final paddedHour = timeSubparts[0].padLeft(2, '0');
          final paddedMin = timeSubparts[1].padLeft(2, '0');
          final paddedSec = timeSubparts[2].padLeft(2, '0');
          final fixedDateStr = '$datePart $paddedHour:$paddedMin:$paddedSec';
          final fixedParsed = DateTime.tryParse(fixedDateStr);
          if (fixedParsed != null) return fixedParsed;
        }
      }
    } catch (_) {}

    return DateTime.now();
  }

  Future<List<int>> createReportPdf({
    required Report report,
    required UserProfile userProfile,
    List<int>? logoBytes,
    List<int>? signatureBytes,
    required List<Uint8List> photosBytes,
  }) async {
    final pdf = pw.Document();

    // Photos are already compressed by the caller (form_provider),
    // so we use them directly without re-processing.
    final List<Uint8List> processedPhotos = photosBytes;

    // Also resize signature to optimize memory, skipping if already small (<150KB)
    Uint8List? processedSignature;
    if (signatureBytes != null && signatureBytes.isNotEmpty) {
      if (signatureBytes.length < 150 * 1024) {
        processedSignature = Uint8List.fromList(signatureBytes);
      } else {
        processedSignature = await resizeImage(signatureBytes, targetWidth: 300);
      }
    }

    // Load local default logo
    List<int>? finalLogoBytes;
    try {
      final byteData = await rootBundle.load('assets/images/logo_kemensos.png');
      finalLogoBytes = byteData.buffer.asUint8List();
    } catch (e) {
      finalLogoBytes = logoBytes;
    }

    // Custom theme for consistent font
    final theme = pw.ThemeData.withFont(
      base: pw.Font.helvetica(),
      bold: pw.Font.helveticaBold(),
      italic: pw.Font.helveticaOblique(),
      boldItalic: pw.Font.helveticaBoldOblique(),
    );

    // Indonesian Month and Day helpers
    String getIndonesianMonth(int month) {
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return months[month - 1];
    }

    String getIndonesianDay(int dayOfWeek) {
      const days = [
        'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'
      ];
      return days[dayOfWeek - 1];
    }

    String formatPeriode(String dateStr) {
      try {
        final date = _safeParseDate(dateStr);
        final monthName = getIndonesianMonth(date.month);
        return '$monthName ${date.year}';
      } catch (_) {
        return '';
      }
    }

    String formatWaktu(String dateStr, String pukulStr) {
      try {
        final date = _safeParseDate(dateStr);
        final dayName = getIndonesianDay(date.weekday);
        final monthName = getIndonesianMonth(date.month);
        final timeStr = pukulStr.isNotEmpty ? 'Pukul $pukulStr' : '';
        return '$dayName, ${date.day} $monthName ${date.year}${timeStr.isNotEmpty ? ", $timeStr" : ""}';
      } catch (_) {
        return dateStr + (pukulStr.isNotEmpty ? ', Pukul $pukulStr' : '');
      }
    }

    pw.Widget buildHeader() {
      pw.Widget logoWidget;
      if (finalLogoBytes != null && finalLogoBytes.isNotEmpty) {
        logoWidget = pw.Container(
          width: 80,
          height: 80,
          child: pw.Image(
            pw.MemoryImage(Uint8List.fromList(finalLogoBytes)),
            fit: pw.BoxFit.contain,
          ),
        );
      } else {
        logoWidget = pw.Container(
          width: 80,
          height: 80,
          decoration: pw.BoxDecoration(
            shape: pw.BoxShape.circle,
            color: PdfColors.grey300,
          ),
          child: pw.Center(
            child: pw.Text(
              'LOGO',
              style: pw.TextStyle(color: PdfColors.grey600, fontSize: 10),
            ),
          ),
        );
      }

      return pw.Column(
        children: [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              logoWidget,
              pw.SizedBox(width: 5),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.center,
                  children: [
                    pw.Text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
                    if (userProfile.jenisSdm == 'TKSK') ...[
                      pw.Text('DIREKTORAT JENDERAL PEMBERDAYAAN SOSIAL', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                    ] else ...[
                      pw.Text('DIREKTORAT JENDERAL PERLINDUNGAN DAN JAMINAN SOSIAL', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                      pw.Text('DIREKTORAT PERLINDUNGAN SOSIAL NON KEBENCANAAN', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                    ],
                    pw.Text('Jl. Salemba Raya No. 28 Jakarta Pusat 10430 Telp. (021) 3103591 http://www.kemsos.go.id', style: pw.TextStyle(fontSize: 7.5)),
                  ],
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 3),
          pw.Divider(thickness: 2, color: PdfColors.black),
          pw.SizedBox(height: 8),
        ],
      );
    }

    // Title Section
    pw.Widget buildTitle() {
      final periodeStr = sanitizePdfText(formatPeriode(report.tanggal));
      final showTanggal = report.showTanggalInPdf;
      final showPukul = report.showPukulInPdf;
      String waktuStr = '';
      if (showTanggal && showPukul) {
        waktuStr = sanitizePdfText(formatWaktu(report.tanggal, report.pukul));
      } else if (showTanggal) {
        try {
          final date = _safeParseDate(report.tanggal);
          final dayName = getIndonesianDay(date.weekday);
          final monthName = getIndonesianMonth(date.month);
          waktuStr = sanitizePdfText('$dayName, ${date.day} $monthName ${date.year}');
        } catch (_) {
          waktuStr = sanitizePdfText(report.tanggal);
        }
      } else if (showPukul && report.pukul.isNotEmpty) {
        waktuStr = sanitizePdfText('Pukul ${report.pukul}');
      }

      return pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Center(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text(
                  'LAPORAN RENCANA HASIL KERJA (${report.idRHK})',
                  style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  sanitizePdfText(report.jenisRHK),
                  textAlign: pw.TextAlign.center,
                  style: pw.TextStyle(fontSize: 11, fontStyle: pw.FontStyle.italic),
                ),
                if (periodeStr.isNotEmpty) ...[
                  pw.SizedBox(height: 4),
                  pw.Text(
                    '(Periode: $periodeStr)',
                    style: const pw.TextStyle(fontSize: 11),
                  ),
                ],
              ],
            ),
          ),
          pw.SizedBox(height: 15),
          pw.Table(
            columnWidths: {
              0: const pw.FixedColumnWidth(80),
              1: const pw.FixedColumnWidth(10),
              2: const pw.FlexColumnWidth(),
            },
            children: [
              pw.TableRow(
                children: [
                  pw.Text('Rencana Aksi', style: pw.TextStyle(fontSize: 10.5, fontStyle: pw.FontStyle.italic)),
                  pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                  pw.Text(sanitizePdfText(report.rencanaAksi), style: const pw.TextStyle(fontSize: 10.5)),
                ],
              ),
              if (waktuStr.isNotEmpty)
                pw.TableRow(
                  children: [
                    pw.Text('Waktu', style: pw.TextStyle(fontSize: 10.5, fontStyle: pw.FontStyle.italic)),
                    pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                    pw.Text(waktuStr, style: const pw.TextStyle(fontSize: 10.5)),
                  ],
                ),
            ],
          ),
          pw.SizedBox(height: 15),
        ],
      );
    }

    // Parse narrative spans inside list elements
    List<pw.TextSpan> parseNarrativeSpans(String text) {
      final sanitized = sanitizePdfText(text);
      final List<pw.TextSpan> spans = [];
      final parts = sanitized.split('**');
      for (int i = 0; i < parts.length; i++) {
        if (i % 2 == 1) {
          spans.add(pw.TextSpan(text: parts[i], style: pw.TextStyle(fontWeight: pw.FontWeight.bold)));
        } else {
          spans.add(pw.TextSpan(text: parts[i]));
        }
      }
      return spans;
    }

    // Build narrative widgets with proper list and sub-header styling
    List<pw.Widget> buildNarrativeWidgets(String text) {
      final sanitizedText = sanitizePdfText(text);
      final List<pw.Widget> widgets = [];
      final lines = sanitizedText.split('\n');
      final bool isP2K2 = report.p2k2Data != null && report.p2k2Data!.modul.isNotEmpty;
      bool hasAddedP2K2Table = false;
      bool inListItem = false;
      bool skippingSectionBLines = false;
      String currentSection = '';
      List<pw.Widget> pendingHeaders = [];
      List<String> pendingHeaderTexts = [];

      final subHeaderRegExp = RegExp(r'^(?:\*\*)?([A-Z]\.)\s+(.*?)(?:\*\*)?$');

      // Pre-extract Section B lines for P2K2 table
      List<String> sectionBLines = [];
      if (isP2K2) {
        bool capturingB = false;
        for (var l in lines) {
          final t = l.trim();
          final match = subHeaderRegExp.firstMatch(t);
          if (match != null) {
            final letter = match.group(1)!;
            if (letter == 'B.') {
              capturingB = true;
              continue;
            } else if (capturingB) {
              break;
            }
          }
          if (capturingB && t.isNotEmpty) {
            sectionBLines.add(t);
          }
        }
      }

      // Comprehensive P2K2 Table Builder conforming to official template
      List<pw.Widget> buildP2K2TableWidgets(P2K2Data p2k2, List<String> bLines) {
        final tableWidgets = <pw.Widget>[];

        // Format No. Laporan (nama file RHK tanpa ekstensi)
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

        final rhkTag = report.idRHK.isNotEmpty ? report.idRHK : 'P2K2';
        final cleanRencanaAksi = report.rencanaAksi.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
        final noLaporan = '$fileDateStr - $timeStr - $rhkTag - $cleanRencanaAksi';

        // Format Tanggal Pengisian (sama dengan Tanggal Kegiatan)
        String tanggalPengisian;
        try {
          final parsed = _safeParseDate(report.tanggal);
          final monthName = getIndonesianMonth(parsed.month);
          tanggalPengisian = '${parsed.day.toString().padLeft(2, '0')} $monthName ${parsed.year}';
        } catch (_) {
          tanggalPengisian = report.tanggal;
        }

        // Format Tanggal Kegiatan with Day Name
        String tanggalKegiatanDenganHari;
        try {
          final parsed = _safeParseDate(report.tanggal);
          final dayName = getIndonesianDay(parsed.weekday);
          final monthName = getIndonesianMonth(parsed.month);
          tanggalKegiatanDenganHari = '$dayName, ${parsed.day.toString().padLeft(2, '0')} $monthName ${parsed.year}';
        } catch (_) {
          tanggalKegiatanDenganHari = report.tanggal;
        }

        // Pemateri
        final namaPemateri = (p2k2.isPemateriDiriSendiri || p2k2.namaPemateri.trim().isEmpty)
            ? userProfile.nama
            : p2k2.namaPemateri;
        final jabatanPemateri = (p2k2.isPemateriDiriSendiri || p2k2.jabatanPemateri.trim().isEmpty)
            ? (userProfile.jabatan.isNotEmpty ? userProfile.jabatan : 'Pendamping PKH')
            : p2k2.jabatanPemateri;

        // Kehadiran & Total Dampingan
        final hadir = int.tryParse(p2k2.jumlahHadir) ?? 0;
        final sakit = int.tryParse(p2k2.jumlahSakit) ?? 0;
        final alpa = int.tryParse(p2k2.jumlahAlpa) ?? 0;
        final totalDampingan = hadir + sakit + alpa;

        // Tempat Pelaksanaan
        final tempatPelaksanaan = p2k2.tempatPelaksanaan.isNotEmpty
            ? p2k2.tempatPelaksanaan
            : (report.physicalLokasi.isNotEmpty ? report.physicalLokasi : '-');

        // Helpers for tables
        pw.Widget buildSectionHeader(String title, {bool isCenter = false}) {
          return pw.Container(
            width: double.infinity,
            padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 3.5),
            decoration: const pw.BoxDecoration(
              color: PdfColor.fromInt(0xFFE8E8E8),
              border: pw.Border(
                top: pw.BorderSide(width: 0.8, color: PdfColors.black),
                left: pw.BorderSide(width: 0.8, color: PdfColors.black),
                right: pw.BorderSide(width: 0.8, color: PdfColors.black),
                bottom: pw.BorderSide(width: 0.8, color: PdfColors.black),
              ),
            ),
            child: isCenter
                ? pw.Center(child: pw.Text(title, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)))
                : pw.Text(title, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
          );
        }

        pw.Widget build4ColTable(List<List<String>> rows) {
          return pw.Table(
            border: const pw.TableBorder(
              left: pw.BorderSide(width: 0.8, color: PdfColors.black),
              right: pw.BorderSide(width: 0.8, color: PdfColors.black),
              bottom: pw.BorderSide(width: 0.8, color: PdfColors.black),
              horizontalInside: pw.BorderSide(width: 0.8, color: PdfColors.black),
              verticalInside: pw.BorderSide(width: 0.8, color: PdfColors.black),
            ),
            columnWidths: const {
              0: pw.FixedColumnWidth(110),
              1: pw.FlexColumnWidth(1),
              2: pw.FixedColumnWidth(110),
              3: pw.FlexColumnWidth(1),
            },
            children: rows.map((row) {
              return pw.TableRow(
                children: [
                  pw.Padding(padding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 3.5), child: pw.Text(sanitizePdfText(row[0]), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8.5))),
                  pw.Padding(padding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 3.5), child: pw.Text(sanitizePdfText(row[1]), style: const pw.TextStyle(fontSize: 8.5))),
                  pw.Padding(padding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 3.5), child: pw.Text(sanitizePdfText(row[2]), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8.5))),
                  pw.Padding(padding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 3.5), child: pw.Text(sanitizePdfText(row[3]), style: const pw.TextStyle(fontSize: 8.5))),
                ],
              );
            }).toList(),
          );
        }

        pw.Widget build2ColTable(List<List<dynamic>> rows) {
          return pw.Table(
            border: const pw.TableBorder(
              left: pw.BorderSide(width: 0.8, color: PdfColors.black),
              right: pw.BorderSide(width: 0.8, color: PdfColors.black),
              bottom: pw.BorderSide(width: 0.8, color: PdfColors.black),
              horizontalInside: pw.BorderSide(width: 0.8, color: PdfColors.black),
              verticalInside: pw.BorderSide(width: 0.8, color: PdfColors.black),
            ),
            columnWidths: const {
              0: pw.FixedColumnWidth(110),
              1: pw.FlexColumnWidth(1),
            },
            children: rows.map((row) {
              final label = sanitizePdfText(row[0].toString());
              final val = row[1];
              pw.Widget valWidget;
              if (val is pw.Widget) {
                valWidget = val;
              } else {
                valWidget = pw.Text(sanitizePdfText(val.toString()), style: const pw.TextStyle(fontSize: 8.5));
              }
              return pw.TableRow(
                children: [
                  pw.Padding(
                    padding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 3.5),
                    child: pw.Text(label, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8.5)),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 3.5),
                    child: valWidget,
                  ),
                ],
              );
            }).toList(),
          );
        }

        // 1. Table Title (clean centered text, outside table border)
        tableWidgets.add(
          pw.Container(
            width: double.infinity,
            margin: const pw.EdgeInsets.only(top: 4, bottom: 8),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text('LAPORAN KEGIATAN P2K2', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
                pw.SizedBox(height: 2),
                pw.Text('Pertemuan Peningkatan Kemampuan Keluarga', style: const pw.TextStyle(fontSize: 9.5)),
              ],
            ),
          ),
        );

        final bool isSupervisi = p2k2.isSupervisi || report.rencanaAksi.contains('Supervisi');

        // 2. A. INFORMASI UMUM
        tableWidgets.add(buildSectionHeader('A. INFORMASI UMUM'));
        tableWidgets.add(build4ColTable([
          ['No. Laporan', noLaporan, 'Tanggal Pengisian', tanggalPengisian],
        ]));

        if (isSupervisi) {
          final pendampingBase = p2k2.namaPendamping.isNotEmpty
              ? p2k2.namaPendamping
              : (p2k2.namaPemateri.isNotEmpty ? p2k2.namaPemateri : '-');
          final nipPart = p2k2.nipPendamping.trim().isNotEmpty
              ? ' (${p2k2.nipPendamping.trim()})'
              : '';
          final pendampingDisplay = '$pendampingBase$nipPart';
          final katimName = p2k2.namaKetuaTim.isNotEmpty ? p2k2.namaKetuaTim : userProfile.nama;
          final desa = formatTitleCase(p2k2.desaKelurahan.isNotEmpty ? p2k2.desaKelurahan : '-');
          final kec = formatTitleCase(p2k2.kecamatan.isNotEmpty
              ? p2k2.kecamatan
              : (userProfile.kecamatan.isNotEmpty ? userProfile.kecamatan : '-'));
          final kab = formatTitleCase(p2k2.kabupatenKota.isNotEmpty
              ? p2k2.kabupatenKota
              : (userProfile.kabupatenKota.isNotEmpty ? userProfile.kabupatenKota : '-'));
          final prov = formatTitleCase(p2k2.provinsi.isNotEmpty
              ? p2k2.provinsi
              : (userProfile.provinsi.isNotEmpty ? userProfile.provinsi : '-'));

          tableWidgets.add(build2ColTable([
            ['Nama Pendamping', pendampingDisplay],
            ['Nama Ketua Tim (Katim)', katimName],
          ]));
          tableWidgets.add(build4ColTable([
            ['Desa/Kelurahan', desa, 'Kecamatan', kec],
            ['Kabupaten / Kota', kab, 'Provinsi', prov],
          ]));
        } else {
          tableWidgets.add(build2ColTable([
            ['Nama Pendamping', userProfile.nama],
          ]));

          // 3. SESUAI WILAYAH TUGAS
          tableWidgets.add(buildSectionHeader('SESUAI WILAYAH TUGAS', isCenter: true));
          tableWidgets.add(build4ColTable([
            [
              'Kecamatan',
              formatTitleCase(userProfile.kecamatan.isNotEmpty ? userProfile.kecamatan : '-'),
              'Kabupaten / Kota',
              formatTitleCase(userProfile.kabupatenKota.isNotEmpty ? userProfile.kabupatenKota : '-'),
            ],
          ]));
          tableWidgets.add(build2ColTable([
            ['Provinsi', formatTitleCase(userProfile.provinsi.isNotEmpty ? userProfile.provinsi : '-')],
          ]));
        }

        // 4. B. WAKTU PELAKSANAAN
        tableWidgets.add(buildSectionHeader('B. WAKTU PELAKSANAAN'));
        tableWidgets.add(build2ColTable([
          ['Tanggal Kegiatan', report.showTanggalInPdf ? tanggalKegiatanDenganHari : '-'],
        ]));
        tableWidgets.add(build4ColTable([
          [
            'Jam Mulai',
            (report.showPukulInPdf && report.pukul.isNotEmpty) ? report.pukul : '-',
            'Jam Selesai',
            (report.showPukulInPdf && p2k2.jamSelesai.isNotEmpty) ? p2k2.jamSelesai : '-',
          ],
        ]));
        tableWidgets.add(build2ColTable([
          ['Tempat Pelaksanaan', tempatPelaksanaan],
        ]));

        // 5. C. PEMATERI
        tableWidgets.add(buildSectionHeader('C. PEMATERI'));
        tableWidgets.add(build2ColTable([
          ['Nama Pemateri', namaPemateri],
          ['Jabatan / Instansi', jabatanPemateri],
        ]));

        // 6. D. ISI MATERI
        tableWidgets.add(buildSectionHeader('D. ISI MATERI'));
        tableWidgets.add(build2ColTable([
          ['Materi', p2k2.sesi.isNotEmpty ? p2k2.sesi : '-'],
          ['Modul', p2k2.modul.isNotEmpty ? p2k2.modul : '-'],
        ]));

        // 7. E. ISI KEGIATAN
        tableWidgets.add(buildSectionHeader('E. ISI KEGIATAN'));
        tableWidgets.add(build2ColTable([
          [
            'Jumlah Peserta Hadir',
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('Total Dampingan : $totalDampingan orang', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8.5)),
                pw.SizedBox(height: 2),
                pw.Text('Hadir : $hadir orang', style: const pw.TextStyle(fontSize: 8.5)),
                pw.Text('Sakit : $sakit orang', style: const pw.TextStyle(fontSize: 8.5)),
                pw.Text('Alpa  : $alpa orang', style: const pw.TextStyle(fontSize: 8.5)),
              ],
            ),
          ],
        ]));

        // 8. Rangkuman Kegiatan
        final List<pw.Widget> bContentWidgets = [];
        final pReg = RegExp(r'^(\d+)\.\s+(.*)');
        final bReg = RegExp(r'^[-*•]\s+(.*)');
        for (final line in bLines) {
          final trimmed = line.trim();
          if (trimmed.isEmpty) continue;
          if (pReg.hasMatch(trimmed)) {
            final match = pReg.firstMatch(trimmed)!;
            final num = match.group(1)!;
            final content = match.group(2)!;
            bContentWidgets.add(
              pw.Padding(
                padding: const pw.EdgeInsets.only(left: 4, bottom: 2.5),
                child: pw.RichText(
                  textAlign: pw.TextAlign.justify,
                  text: pw.TextSpan(
                    style: const pw.TextStyle(fontSize: 8.5, lineSpacing: 1.3),
                    children: [
                      pw.TextSpan(text: '$num. ', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      ...parseNarrativeSpans(content),
                    ],
                  ),
                ),
              ),
            );
          } else if (bReg.hasMatch(trimmed)) {
            final match = bReg.firstMatch(trimmed)!;
            final content = match.group(1)!;
            bContentWidgets.add(
              pw.Padding(
                padding: const pw.EdgeInsets.only(left: 10, bottom: 2),
                child: pw.RichText(
                  textAlign: pw.TextAlign.justify,
                  text: pw.TextSpan(
                    style: const pw.TextStyle(fontSize: 8.5, lineSpacing: 1.3),
                    children: [
                      pw.TextSpan(text: '- ', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      ...parseNarrativeSpans(content),
                    ],
                  ),
                ),
              ),
            );
          } else if (RegExp(r'^([a-z])\.\s+(.*)').hasMatch(trimmed)) {
            final match = RegExp(r'^([a-z])\.\s+(.*)').firstMatch(trimmed)!;
            final letter = match.group(1)!;
            final content = match.group(2)!;
            bContentWidgets.add(
              pw.Padding(
                padding: const pw.EdgeInsets.only(left: 10, bottom: 2),
                child: pw.RichText(
                  textAlign: pw.TextAlign.justify,
                  text: pw.TextSpan(
                    style: const pw.TextStyle(fontSize: 8.5, lineSpacing: 1.3),
                    children: [
                      pw.TextSpan(text: '$letter. ', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      ...parseNarrativeSpans(content),
                    ],
                  ),
                ),
              ),
            );
          } else {
            bContentWidgets.add(
              pw.Padding(
                padding: const pw.EdgeInsets.only(bottom: 2.5),
                child: pw.RichText(
                  textAlign: pw.TextAlign.justify,
                  text: pw.TextSpan(
                    style: const pw.TextStyle(fontSize: 8.5, lineSpacing: 1.3),
                    children: parseNarrativeSpans(trimmed),
                  ),
                ),
              ),
            );
          }
        }
        if (bContentWidgets.isEmpty) {
          bContentWidgets.add(pw.Text('-', style: const pw.TextStyle(fontSize: 8.5)));
        }

        tableWidgets.add(build2ColTable([
          [
            'Rangkuman Kegiatan',
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: bContentWidgets,
            ),
          ],
        ]));

        // 9. Foto Kegiatan (foto geotagging)
        pw.Widget photoWidget;
        if (processedPhotos.isNotEmpty) {
          photoWidget = pw.Container(
            padding: const pw.EdgeInsets.all(4),
            alignment: pw.Alignment.center,
            child: pw.Image(
              pw.MemoryImage(processedPhotos.first),
              width: 250,
              height: 175,
              fit: pw.BoxFit.contain,
            ),
          );
        } else {
          photoWidget = pw.Padding(
            padding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 8),
            child: pw.Text('-', style: const pw.TextStyle(fontSize: 8.5)),
          );
        }

        tableWidgets.add(build2ColTable([
          ['Foto Kegiatan\n(foto geotagging)', photoWidget],
        ]));

        return tableWidgets;
      }

      void flushPendingHeaders() {
        if (pendingHeaders.isNotEmpty) {
          widgets.addAll(pendingHeaders);
          pendingHeaders.clear();
          pendingHeaderTexts.clear();
        }
      }

      for (var line in lines) {
        final trimmed = line.trim();
        if (trimmed.isEmpty) {
          if (pendingHeaders.isEmpty && !skippingSectionBLines) {
            flushPendingHeaders();
            widgets.add(pw.SizedBox(height: 6));
          }
          continue;
        }

        // Check if it is a main sub-header (e.g. A. PENDAHULUAN or **A. PENDAHULUAN**)
        if (subHeaderRegExp.hasMatch(trimmed)) {
          inListItem = false;
          final match = subHeaderRegExp.firstMatch(trimmed)!;
          final letter = match.group(1)!;
          final title = match.group(2)!;
          final cleanHeader = '$letter $title';
          currentSection = letter.replaceAll('.', '').trim();
          
          if (letter == 'B.' && isP2K2) {
            flushPendingHeaders();
            widgets.add(pw.NewPage());
            widgets.add(
              pw.Padding(
                padding: const pw.EdgeInsets.only(top: 8, bottom: 8),
                child: pw.Text(
                  cleanHeader,
                  style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold),
                ),
              ),
            );
            widgets.addAll(buildP2K2TableWidgets(report.p2k2Data!, sectionBLines));
            hasAddedP2K2Table = true;
            skippingSectionBLines = true;
            continue;
          }

          if (skippingSectionBLines) {
            skippingSectionBLines = false;
          }

          if ((cleanHeader.startsWith('C.') || cleanHeader.startsWith('D.') || cleanHeader.startsWith('E.')) && 
              !hasAddedP2K2Table && 
              isP2K2) {
            flushPendingHeaders();
            widgets.add(pw.NewPage());
            widgets.addAll(buildP2K2TableWidgets(report.p2k2Data!, sectionBLines));
            widgets.add(pw.SizedBox(height: 15));
            hasAddedP2K2Table = true;
          }

          pendingHeaders.add(
            pw.Padding(
              padding: const pw.EdgeInsets.only(top: 22, bottom: 8),
              child: pw.Text(
                cleanHeader,
                style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold),
              ),
            ),
          );
          pendingHeaderTexts.add(cleanHeader);
          continue;
        }

        if (skippingSectionBLines) {
          continue;
        }

        // Line spacing and padding: Section B & table are kept compact, other sections (A, C, D, E) are spaced out more
        final bool isSectionB = currentSection == 'B';
        final double activeLineSpacing = isSectionB ? 1.85 : 2.3;
        final double activeBottomPadding = isSectionB ? 5.0 : 7.5;

        // Check if it is a list item or sub-point
        final pointRegExp = RegExp(r'^(\d+)\.\s+(.*)');
        final bulletRegExp = RegExp(r'^[-*•]\s+(.*)');
        final alphaRegExp = RegExp(r'^([a-z])\.\s+(.*)');
        
        pw.Widget? contentWidget;
        
        if (pointRegExp.hasMatch(trimmed)) {
          final match = pointRegExp.firstMatch(trimmed)!;
          final num = match.group(1)!;
          final content = match.group(2)!;
          
          final aSubheadRegExp = RegExp(r'^(?:Gambaran\s+Umum|Umum|Maksud\s+dan\s+Tujuan|Ruang\s+Lingkup|Dasar)', caseSensitive: false);
          
          if (currentSection == 'A' && aSubheadRegExp.hasMatch(content.trim())) {
            inListItem = true;
            final colonIdx = content.indexOf(':');
            if (colonIdx != -1 && colonIdx < content.length - 1 && content.substring(colonIdx + 1).trim().isNotEmpty) {
              final subheadTitle = content.substring(0, colonIdx + 1).replaceAll('**', '').trim();
              final restDesc = content.substring(colonIdx + 1).trim();
              contentWidget = pw.Padding(
                padding: const pw.EdgeInsets.only(left: 14, top: 6, bottom: 6),
                child: pw.RichText(
                  textAlign: pw.TextAlign.justify,
                  text: pw.TextSpan(
                    style: pw.TextStyle(fontSize: 10.5, lineSpacing: activeLineSpacing),
                    children: [
                      pw.TextSpan(
                        text: '$num. $subheadTitle ',
                        style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                      ),
                      ...parseNarrativeSpans(restDesc),
                    ],
                  ),
                ),
              );
            } else {
              final cleanTitle = content.replaceAll('**', '').trim();
              contentWidget = pw.Padding(
                padding: const pw.EdgeInsets.only(left: 14, top: 6, bottom: 4),
                child: pw.Text(
                  '$num. $cleanTitle',
                  style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold),
                ),
              );
            }
          } else {
            // General numbered list item: clean, regular weight, hanging indent
            inListItem = true;
            final cleanContent = content.replaceAll('**', '').trim();
            contentWidget = pw.Padding(
              padding: pw.EdgeInsets.only(left: 28, bottom: isSectionB ? 3.0 : 4.5),
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.SizedBox(
                    width: 18,
                    child: pw.Text(
                      '$num. ',
                      style: const pw.TextStyle(fontSize: 10.5),
                    ),
                  ),
                  pw.Expanded(
                    child: pw.Text(
                      cleanContent,
                      textAlign: pw.TextAlign.justify,
                      style: pw.TextStyle(fontSize: 10.5, lineSpacing: activeLineSpacing),
                    ),
                  ),
                ],
              ),
            );
          }
        } else if (bulletRegExp.hasMatch(trimmed)) {
          inListItem = true;
          final match = bulletRegExp.firstMatch(trimmed)!;
          final content = match.group(1)!;
          final cleanContent = content.replaceAll('**', '').trim();
          
          contentWidget = pw.Padding(
            padding: pw.EdgeInsets.only(left: 28, bottom: isSectionB ? 3.0 : 4.5),
            child: pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.SizedBox(
                  width: 14,
                  child: pw.Text(
                    '- ',
                    style: const pw.TextStyle(fontSize: 10.5),
                  ),
                ),
                pw.Expanded(
                  child: pw.Text(
                    cleanContent,
                    textAlign: pw.TextAlign.justify,
                    style: pw.TextStyle(fontSize: 10.5, lineSpacing: activeLineSpacing),
                  ),
                ),
              ],
            ),
          );
        } else if (alphaRegExp.hasMatch(trimmed)) {
          inListItem = true;
          final match = alphaRegExp.firstMatch(trimmed)!;
          final letter = match.group(1)!;
          final content = match.group(2)!;
          final cleanContent = content.replaceAll('**', '').trim();
          
          contentWidget = pw.Padding(
            padding: pw.EdgeInsets.only(left: 28, bottom: isSectionB ? 3.0 : 4.5),
            child: pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.SizedBox(
                  width: 18,
                  child: pw.Text(
                    '$letter. ',
                    style: const pw.TextStyle(fontSize: 10.5),
                  ),
                ),
                pw.Expanded(
                  child: pw.Text(
                    cleanContent,
                    textAlign: pw.TextAlign.justify,
                    style: pw.TextStyle(fontSize: 10.5, lineSpacing: activeLineSpacing),
                  ),
                ),
              ],
            ),
          );
        } else {
          // Regular paragraph
          contentWidget = pw.Padding(
            padding: pw.EdgeInsets.only(left: inListItem ? 14 : 0, bottom: activeBottomPadding),
            child: pw.RichText(
              textAlign: pw.TextAlign.justify,
              text: pw.TextSpan(
                style: pw.TextStyle(fontSize: 10.5, lineSpacing: activeLineSpacing),
                children: [
                  pw.TextSpan(text: '      '),
                  ...parseNarrativeSpans(trimmed),
                ],
              ),
            ),
          );
        }

        // Bungkus header dan konten pertama dalam Column agar tidak terpecah oleh MultiPage
        if (pendingHeaders.isNotEmpty) {
          widgets.add(
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              mainAxisSize: pw.MainAxisSize.min,
              children: [
                ...pendingHeaders,
                contentWidget,
              ],
            ),
          );
          pendingHeaders.clear();
          pendingHeaderTexts.clear();
        } else {
          widgets.add(contentWidget);
        }
      }

      flushPendingHeaders();

      if (!hasAddedP2K2Table && isP2K2) {
        widgets.add(pw.SizedBox(height: 10));
        widgets.addAll(buildP2K2TableWidgets(report.p2k2Data!, sectionBLines));
        widgets.add(pw.SizedBox(height: 15));
      }
      
      return widgets;
    }

    // Build the main PDF pages (Kop and content start directly on Page 1, no repeating header on other pages)
    pdf.addPage(
      pw.MultiPage(
        theme: theme,
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.only(left: 54, right: 54, top: 35, bottom: 54),
        build: (context) => [
          buildHeader(),
          buildTitle(),
          
          // Narrative Content
          ...buildNarrativeWidgets(report.narasiEdited.isNotEmpty ? report.narasiEdited : report.narasiAI),
          
          pw.SizedBox(height: 20),

          // Signature Block
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.end,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Row(children: [
                    pw.SizedBox(width: 75, child: pw.Text('Dibuat di', style: const pw.TextStyle(fontSize: 10.5))),
                    pw.Text(': ${userProfile.kabupatenKota.isEmpty ? "-" : formatTitleCase(userProfile.kabupatenKota)}', style: const pw.TextStyle(fontSize: 10.5)),
                  ]),
                  pw.Row(children: [
                    pw.SizedBox(width: 75, child: pw.Text('Pada tanggal', style: const pw.TextStyle(fontSize: 10.5))),
                    pw.Text(': ${DateFormat('d MMMM yyyy', 'id_ID').format(_safeParseDate(report.tanggal))}', style: const pw.TextStyle(fontSize: 10.5)),
                  ]),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    userProfile.jabatanAsn.isNotEmpty
                        ? userProfile.jabatanAsn
                        : (userProfile.jabatan.isNotEmpty ? userProfile.jabatan : 'Pendamping Sosial'),
                    style: const pw.TextStyle(fontSize: 10.5),
                  ),
                  if (processedSignature != null)
                    pw.Image(pw.MemoryImage(processedSignature), width: 135, height: 75)
                  else
                    pw.SizedBox(height: 75),
                  pw.Text(userProfile.nama, style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold, decoration: pw.TextDecoration.underline)),
                  pw.Text('NIP. ${userProfile.nip}', style: const pw.TextStyle(fontSize: 9.5)),
                ],
              ),
            ],
          )
        ],
      )
    );

    // Page 2: Photo Appendix
    final appendixPhotos = (report.p2k2Data != null && report.p2k2Data!.modul.isNotEmpty)
        ? processedPhotos.skip(1).toList()
        : processedPhotos;

    if (appendixPhotos.isNotEmpty) {
      pdf.addPage(
        pw.MultiPage(
          theme: theme,
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.only(left: 54, right: 54, top: 35, bottom: 54),
          build: (context) => [
            pw.Center(
              child: pw.Text('LAMPIRAN DOKUMENTASI', style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold)),
            ),
            pw.SizedBox(height: 20),
            
            // Layout photos in a grid/list, centered and safely constrained to prevent MultiPage overflow
            ...appendixPhotos.map((bytes) {
              return pw.Column(
                children: [
                  pw.Center(
                    child: pw.ConstrainedBox(
                      constraints: const pw.BoxConstraints(
                        maxWidth: 420,
                        maxHeight: 500,
                      ),
                      child: pw.Image(
                        pw.MemoryImage(bytes),
                        fit: pw.BoxFit.contain,
                      ),
                    ),
                  ),
                  pw.SizedBox(height: 16),
                ],
              );
            }),
          ]
        )
      );
    }

    return await pdf.save();
  }

  Future<List<int>> createPengaduanPdf({
    required Pengaduan pengaduan,
    required UserProfile userProfile,
    List<int>? logoBytes,
    List<int>? signatureBytes,
    List<int>? ktpBytes,
    List<int>? screenshotBytes,
    List<List<int>>? screenshotBytesList,
  }) async {
    final pdf = pw.Document();

    List<pw.TextSpan> parseNarrativeSpans(String text) {
      // Strip problematic unicode symbols that PDF fonts cannot render
      String cleanText = text.replaceAll(RegExp(r'[☒☑✓✔✗✘▪▫□■◆◇►➢➤➜→←↑↓⇒⇨⚫⚪●○◉◎★☆✦✧✩✪✫✬✭✮✯✰✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋❌❍❎❏❐❑❒▶◀▲▼△▽◁▷♦♠♣♥♡♢♤♧]'), '');
      cleanText = cleanText.replaceAll('**', '*').replaceAll('"', '').replaceAll('#', '');
      final List<pw.TextSpan> spans = [];
      final parts = cleanText.split('*');
      for (int i = 0; i < parts.length; i++) {
        if (i % 2 == 1 && parts[i].isNotEmpty) {
          spans.add(pw.TextSpan(text: parts[i], style: pw.TextStyle(fontWeight: pw.FontWeight.bold)));
        } else if (parts[i].isNotEmpty) {
          spans.add(pw.TextSpan(text: parts[i]));
        }
      }
      return spans;
    }

    // Master regex to strip ALL known problematic unicode symbols
    final _badSymbols = RegExp(r'[☒☑✓✔✗✘▪▫□■◆◇►➢➤➜→←↑↓⇒⇨⚫⚪●○◉◎★☆✦✧✩✪✫✬✭✮✯✰✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋❌❍❎❏❐❑❒▶◀▲▼△▽◁▷♦♠♣♥♡♢♤♧]');

    List<pw.Widget> buildPengaduanNarrative(String text) {
      final List<pw.Widget> finalWidgets = [];
      
      // PHASE 1: Pre-clean entire text — replace unicode bullets with dash markers
      // This handles cases where ☒ is wrapped in bold (**☒**) or appears mid-line
      String cleanedText = text;
      // Replace symbol-at-line-start patterns (with optional markdown) to "- "
      cleanedText = cleanedText.replaceAllMapped(
        RegExp(r'(^|\n)\s*\**\s*[☒☑✓✔✗✘▪▫□■◆◇►➢➤➜●○◉◎❑❒❐❏❌❍❎]\s*\**\s*', multiLine: true),
        (m) => '${m.group(1) ?? '\n'}- ',
      );
      // Strip any remaining unicode symbols that are in the middle of text
      cleanedText = cleanedText.replaceAll(_badSymbols, '');
      
      final lines = cleanedText.split('\n');
      
      double currentIndent = 0;
      double childIndent = 0;
      int autoPointCounter = 0;
      
      pw.Widget? pendingHeader;

      void flushPendingHeader() {
        if (pendingHeader != null) {
          finalWidgets.add(pendingHeader!);
          pendingHeader = null;
        }
      }

      for (var line in lines) {
        var cleanLine = line.trim();
        
        // Normalize bullet points
        if (cleanLine.startsWith('* ')) {
          cleanLine = '- ' + cleanLine.substring(2);
        }
        
        // Strip out formatting characters for structural parsing
        cleanLine = cleanLine.replaceAll('*', '').replaceAll('"', '').replaceAll('#', '').trim();
        
        final upperText = cleanLine.toUpperCase();
        
        // Ignore useless AI titles and separators
        if (upperText.contains('LAPORAN PENANGANAN') || 
            upperText.contains('KEMENTERIAN SOSIAL') || 
            upperText == '-' || upperText == '--' || upperText == '---') {
          continue;
        }

        if (cleanLine.isEmpty) {
          if (pendingHeader == null) {
            finalWidgets.add(pw.SizedBox(height: 6));
          }
          continue;
        }

        final romanRegExp = RegExp(r'^([IVX]+|[A-Z])\.\s*(.*)');
        final pointRegExp = RegExp(r'^(\d+)\.\s*(.*)');
        final bulletRegExp = RegExp(r'^[-•]\s*(.*)');
        
        // Reset auto-counter when hitting a new section header
        if (romanRegExp.hasMatch(cleanLine)) {
          autoPointCounter = 0;
        }

        if (romanRegExp.hasMatch(cleanLine)) {
          // Roman Numeral or Alphabet Header (e.g., I. IDENTITAS, A. ANALISIS)
          currentIndent = 12;
          childIndent = 12;
          final match = romanRegExp.firstMatch(cleanLine)!;
          final num = match.group(1)!;
          final content = match.group(2)!;
          
          final headerWidget = pw.Padding(
            padding: pw.EdgeInsets.only(top: finalWidgets.isEmpty && pendingHeader == null ? 2 : 10, bottom: 4),
            child: pw.Text(
              '$num. $content',
              style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold),
            ),
          );
          
          if (pendingHeader != null) {
            pendingHeader = pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [pendingHeader!, headerWidget],
            );
          } else {
            pendingHeader = headerWidget;
          }
        } else if (pointRegExp.hasMatch(cleanLine)) {
          // Numbered List (e.g., 1. Tindak Lanjut)
          final match = pointRegExp.firstMatch(cleanLine)!;
          final num = match.group(1)!;
          final content = match.group(2)!;

          String pointTitle = content;
          String pointDesc = '';

          final colonStartRegExp = RegExp(r'^([^:\-]+?)\s*[:\-]\s*(.*)');
          if (colonStartRegExp.hasMatch(content)) {
            final m = colonStartRegExp.firstMatch(content)!;
            pointTitle = m.group(1)!.trim();
            pointDesc = m.group(2)!.trim();
          }

          final titleWidget = pw.Padding(
            padding: pw.EdgeInsets.only(left: currentIndent, top: 6, bottom: 2),
            child: pw.Text(
              '$num. $pointTitle',
              style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold),
            ),
          );

          childIndent = currentIndent + 12;

          if (pointDesc.isNotEmpty) {
            final descWidget = pw.Padding(
              padding: pw.EdgeInsets.only(left: childIndent, bottom: 4),
              child: pw.RichText(
                textAlign: pw.TextAlign.justify,
                text: pw.TextSpan(
                  style: const pw.TextStyle(fontSize: 10.5, lineSpacing: 1.9, color: PdfColors.black),
                  children: parseNarrativeSpans(pointDesc),
                ),
              ),
            );
            
            final colChildren = <pw.Widget>[];
            if (pendingHeader != null) {
              colChildren.add(pendingHeader!);
              pendingHeader = null;
            }
            colChildren.add(titleWidget);
            colChildren.add(descWidget);
            
            finalWidgets.add(pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: colChildren,
            ));
          } else {
            if (pendingHeader != null) {
              pendingHeader = pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [pendingHeader!, titleWidget],
              );
            } else {
              pendingHeader = titleWidget;
            }
          }
        } else if (bulletRegExp.hasMatch(cleanLine)) {
          // Bullet points → convert to auto-numbered points
          autoPointCounter++;
          final match = bulletRegExp.firstMatch(cleanLine)!;
          final content = match.group(1)!;

          final bulletWidget = pw.Padding(
            padding: pw.EdgeInsets.only(left: childIndent, bottom: 4),
            child: pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('$autoPointCounter. ', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                pw.Expanded(
                  child: pw.RichText(
                    textAlign: pw.TextAlign.justify,
                    text: pw.TextSpan(
                      style: const pw.TextStyle(fontSize: 10.5, lineSpacing: 1.9, color: PdfColors.black),
                      children: parseNarrativeSpans(content),
                    ),
                  ),
                ),
              ],
            ),
          );
          
          if (pendingHeader != null) {
            finalWidgets.add(pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [pendingHeader!, bulletWidget],
            ));
            pendingHeader = null;
          } else {
            finalWidgets.add(bulletWidget);
          }
        } else {
          // Regular paragraph
          final paraWidget = pw.Padding(
            padding: pw.EdgeInsets.only(left: childIndent, bottom: 6),
            child: pw.RichText(
              textAlign: pw.TextAlign.justify,
              text: pw.TextSpan(
                style: const pw.TextStyle(fontSize: 10.5, lineSpacing: 1.9, color: PdfColors.black),
                children: parseNarrativeSpans(line.trim()), // Use original line to preserve bold formatting
              ),
            ),
          );
          
          if (pendingHeader != null) {
            finalWidgets.add(pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [pendingHeader!, paraWidget],
            ));
            pendingHeader = null;
          } else {
            finalWidgets.add(paraWidget);
          }
        }
      }
      
      flushPendingHeader();

      return finalWidgets;
    }

    // Resize photos
    Uint8List? processedKtp;
    if (ktpBytes != null && ktpBytes.isNotEmpty) {
      processedKtp = await resizeImage(ktpBytes, targetWidth: 600);
    }
    List<Uint8List> processedSiksList = [];
    if (screenshotBytesList != null && screenshotBytesList.isNotEmpty) {
      for (final sb in screenshotBytesList) {
        processedSiksList.add(await resizeImage(sb, targetWidth: 600));
      }
    } else if (screenshotBytes != null && screenshotBytes.isNotEmpty) {
      processedSiksList.add(await resizeImage(screenshotBytes, targetWidth: 600));
    }

    Uint8List? processedSignature;
    if (signatureBytes != null && signatureBytes.isNotEmpty) {
      processedSignature = await resizeImage(signatureBytes, targetWidth: 300);
    }

    List<int>? finalLogoBytes;
    try {
      final byteData = await rootBundle.load('assets/images/logo_kemensos.png');
      finalLogoBytes = byteData.buffer.asUint8List();
    } catch (e) {
      finalLogoBytes = logoBytes;
    }

    final theme = pw.ThemeData.withFont(
      base: pw.Font.helvetica(),
      bold: pw.Font.helveticaBold(),
      italic: pw.Font.helveticaOblique(),
      boldItalic: pw.Font.helveticaBoldOblique(),
    );

    pw.Widget buildHeader() {
      pw.Widget logoWidget;
      if (finalLogoBytes != null && finalLogoBytes.isNotEmpty) {
        logoWidget = pw.Container(
          width: 80,
          height: 80,
          child: pw.Image(
            pw.MemoryImage(Uint8List.fromList(finalLogoBytes)),
            fit: pw.BoxFit.contain,
          ),
        );
      } else {
        logoWidget = pw.Container(
          width: 80,
          height: 80,
          decoration: pw.BoxDecoration(shape: pw.BoxShape.circle, color: PdfColors.grey300),
          child: pw.Center(child: pw.Text('LOGO', style: pw.TextStyle(color: PdfColors.grey600, fontSize: 10))),
        );
      }

      return pw.Column(
        children: [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              logoWidget,
              pw.SizedBox(width: 5),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.center,
                  children: [
                    pw.Text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
                    if (userProfile.jenisSdm == 'TKSK') ...[
                      pw.Text('DIREKTORAT JENDERAL PEMBERDAYAAN SOSIAL', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                    ] else ...[
                      pw.Text('DIREKTORAT JENDERAL PERLINDUNGAN DAN JAMINAN SOSIAL', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                      pw.Text('DIREKTORAT PERLINDUNGAN SOSIAL NON KEBENCANAAN', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                    ],
                    pw.Text('Jl. Salemba Raya No. 28 Jakarta Pusat 10430 Telp. (021) 3103591 http://www.kemsos.go.id', style: pw.TextStyle(fontSize: 7.5)),
                  ],
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 3),
          pw.Divider(thickness: 2, color: PdfColors.black),
          pw.SizedBox(height: 8),
        ],
      );
    }

    pdf.addPage(
      pw.MultiPage(
        theme: theme,
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(54),
        build: (context) => [
          buildHeader(),
          pw.Center(
            child: pw.Text(
              'LAPORAN PENGADUAN MASYARAKAT',
              style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold),
            ),
          ),
          pw.SizedBox(height: 15),
          
          pw.Text('IDENTITAS PENGADU / SASARAN:', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 5),
          pw.Table(
            columnWidths: {
              0: const pw.FixedColumnWidth(120),
              1: const pw.FixedColumnWidth(10),
              2: const pw.FlexColumnWidth(),
            },
            children: [
              pw.TableRow(children: [
                pw.Text('NIK', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(pengaduan.nik, style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
              ]),
              pw.TableRow(children: [
                pw.Text('Nama Lengkap', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(pengaduan.nama, style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Alamat', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(pengaduan.alamat, style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Desa / Kelurahan', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(formatTitleCase(pengaduan.desaKelurahan), style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Kecamatan', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(formatTitleCase(pengaduan.kecamatan), style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Kabupaten / Kota', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(formatTitleCase(pengaduan.kabKota), style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Koordinat GPS', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text('${pengaduan.latitude}, ${pengaduan.longitude}', style: const pw.TextStyle(fontSize: 10.5)),
              ]),
            ],
          ),
          pw.SizedBox(height: 15),

          pw.Text('ADUAN MASYARAKAT:', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 5),
          pw.Paragraph(
            text: pengaduan.aduan,
            textAlign: pw.TextAlign.justify,
            style: const pw.TextStyle(fontSize: 10.5, lineSpacing: 1.9),
          ),
          pw.SizedBox(height: 15),

          pw.Text('HASIL ANALISIS & TINDAK LANJUT:', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
          ...buildPengaduanNarrative(pengaduan.hasilAnalisa),
          pw.SizedBox(height: 20),

          pw.Text('Demikian disampaikan.', style: const pw.TextStyle(fontSize: 10.5)),
          pw.SizedBox(height: 15),

          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.end,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Row(children: [
                    pw.SizedBox(width: 75, child: pw.Text('Dibuat di', style: const pw.TextStyle(fontSize: 10.5))),
                    pw.Text(': ${userProfile.kabupatenKota.isEmpty ? "-" : formatTitleCase(userProfile.kabupatenKota)}', style: const pw.TextStyle(fontSize: 10.5)),
                  ]),
                  pw.Row(children: [
                    pw.SizedBox(width: 75, child: pw.Text('Pada tanggal', style: const pw.TextStyle(fontSize: 10.5))),
                    pw.Text(': ${DateFormat('d MMMM yyyy', 'id_ID').format(_safeParseDate(pengaduan.createdAt))}', style: const pw.TextStyle(fontSize: 10.5)),
                  ]),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    userProfile.jabatanAsn.isNotEmpty
                        ? userProfile.jabatanAsn
                        : (userProfile.jabatan.isNotEmpty ? userProfile.jabatan : 'Pendamping Sosial'),
                    style: const pw.TextStyle(fontSize: 10.5),
                  ),
                  if (processedSignature != null)
                    pw.Image(pw.MemoryImage(processedSignature), width: 100, height: 60)
                  else
                    pw.SizedBox(height: 60),
                  pw.Text(userProfile.nama, style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold, decoration: pw.TextDecoration.underline)),
                  pw.Text('NIP. ${userProfile.nip}', style: const pw.TextStyle(fontSize: 9.5)),
                ],
              ),
            ],
          )
        ],
      )
    );

    // Page 2: Appendix
    if (processedKtp != null || processedSiksList.isNotEmpty) {
      pdf.addPage(
        pw.MultiPage(
          theme: theme,
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(54),
          build: (context) => [
            pw.Center(
              child: pw.Text('LAMPIRAN DOKUMEN PENGADUAN', style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold)),
            ),
            pw.SizedBox(height: 20),
            if (processedKtp != null) ...[
              pw.Center(
                child: pw.Column(
                  children: [
                    pw.Text('FOTO KTP', style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 5),
                    pw.ConstrainedBox(
                      constraints: const pw.BoxConstraints(maxWidth: 350, maxHeight: 350),
                      child: pw.Image(pw.MemoryImage(processedKtp), fit: pw.BoxFit.contain),
                    ),
                  ]
                )
              ),
              pw.SizedBox(height: 25),
            ],
            if (processedSiksList.isNotEmpty) ...[
              ...processedSiksList.map((siksBytes) => pw.Column(
                children: [
                  pw.Center(
                    child: pw.Column(
                      children: [
                        pw.Text('SCREENSHOT SIKS-NG / CEK BANSOS', style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
                        pw.SizedBox(height: 5),
                        pw.ConstrainedBox(
                          constraints: const pw.BoxConstraints(maxWidth: 350, maxHeight: 450),
                          child: pw.Image(pw.MemoryImage(siksBytes), fit: pw.BoxFit.contain),
                        ),
                      ],
                    ),
                  ),
                  pw.SizedBox(height: 20),
                ],
              )),
            ],
          ]
        )
      );
    }

    return await pdf.save();
  }

  Future<List<int>> createNotaDinasPdf({
    required NotaDinas notaDinas,
    required UserProfile userProfile,
    List<int>? logoBytes,
    List<int>? signatureBytes,
    List<int>? buktiDukungBytes,
    List<List<int>>? buktiDukungBytesList,
  }) async {
    final pdf = pw.Document();

    Uint8List? processedSignature;
    if (signatureBytes != null && signatureBytes.isNotEmpty) {
      processedSignature = await resizeImage(signatureBytes, targetWidth: 300);
    }

    List<Uint8List> processedBuktiDukungList = [];
    if (buktiDukungBytesList != null && buktiDukungBytesList.isNotEmpty) {
      for (final bb in buktiDukungBytesList) {
        processedBuktiDukungList.add(await resizeImage(bb, targetWidth: 600));
      }
    } else if (buktiDukungBytes != null && buktiDukungBytes.isNotEmpty) {
      processedBuktiDukungList.add(await resizeImage(buktiDukungBytes, targetWidth: 600));
    }

    final theme = pw.ThemeData.withFont(
      base: pw.Font.helvetica(),
      bold: pw.Font.helveticaBold(),
      italic: pw.Font.helveticaOblique(),
      boldItalic: pw.Font.helveticaBoldOblique(),
    );

    pdf.addPage(
      pw.MultiPage(
        theme: theme,
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.only(top: 15, left: 54, right: 54, bottom: 54),
        build: (context) => [
          pw.Center(
            child: pw.Column(
              children: [
                pw.Text(
                  'NOTA DINAS',
                  style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold, decoration: pw.TextDecoration.underline),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  'Nomor: ${notaDinas.nomor}',
                  style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold),
                ),
              ]
            )
          ),
          pw.SizedBox(height: 20),
          
          pw.Table(
            columnWidths: {
              0: const pw.FixedColumnWidth(60),
              1: const pw.FixedColumnWidth(10),
              2: const pw.FlexColumnWidth(),
            },
            children: [
              pw.TableRow(children: [
                pw.Text('Kepada Yth.', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(notaDinas.yth, style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Dari', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(notaDinas.dari, style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Sifat', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(notaDinas.sifat, style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Lampiran', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(notaDinas.lampiran, style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Tanggal', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(notaDinas.tanggal, style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Hal', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(notaDinas.hal, style: const pw.TextStyle(fontSize: 10.5)),
              ]),
            ],
          ),
          pw.SizedBox(height: 8),
          pw.Divider(thickness: 1, color: PdfColors.black),
          pw.SizedBox(height: 15),

          ...notaDinas.isiNotaDinas.split('\n').where((p) => p.trim().isNotEmpty).map((para) {
            final trimmedPara = para.trim();
            return pw.Padding(
              padding: const pw.EdgeInsets.only(left: 70, bottom: 6),
              child: pw.RichText(
                textAlign: pw.TextAlign.justify,
                text: pw.TextSpan(
                  style: const pw.TextStyle(fontSize: 11, lineSpacing: 1.9, color: PdfColors.black),
                  children: [
                    pw.TextSpan(text: '      '),
                    pw.TextSpan(text: trimmedPara),
                  ],
                ),
              ),
            );
          }),
          pw.SizedBox(height: 30),

          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.end,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Row(children: [
                    pw.SizedBox(width: 75, child: pw.Text('Dibuat di', style: const pw.TextStyle(fontSize: 10.5))),
                    pw.Text(': ${userProfile.kabupatenKota.isEmpty ? "-" : formatTitleCase(userProfile.kabupatenKota)}', style: const pw.TextStyle(fontSize: 10.5)),
                  ]),
                  pw.Row(children: [
                    pw.SizedBox(width: 75, child: pw.Text('Pada tanggal', style: const pw.TextStyle(fontSize: 10.5))),
                    pw.Text(': ${DateFormat('d MMMM yyyy', 'id_ID').format(_safeParseDate(notaDinas.tanggal))}', style: const pw.TextStyle(fontSize: 10.5)),
                  ]),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    userProfile.jabatanAsn.isNotEmpty
                        ? userProfile.jabatanAsn
                        : (userProfile.jabatan.isNotEmpty ? userProfile.jabatan : 'Pendamping Sosial'),
                    style: const pw.TextStyle(fontSize: 10.5),
                  ),
                  if (processedSignature != null)
                    pw.Image(pw.MemoryImage(processedSignature), width: 100, height: 60)
                  else
                    pw.SizedBox(height: 60),
                  pw.Text(userProfile.nama, style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold, decoration: pw.TextDecoration.underline)),
                  pw.Text('NIP. ${userProfile.nip}', style: const pw.TextStyle(fontSize: 9.5)),
                ],
              ),
            ],
          )
        ],
      )
    );

    if (processedBuktiDukungList.isNotEmpty) {
      pdf.addPage(
        pw.MultiPage(
          theme: theme,
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(54),
          build: (context) => [
            pw.Center(
              child: pw.Text('LAMPIRAN DOKUMENTASI NOTA DINAS', style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold)),
            ),
            pw.SizedBox(height: 20),
            ...processedBuktiDukungList.map((bytes) => pw.Column(
              children: [
                pw.Center(
                  child: pw.ConstrainedBox(
                    constraints: const pw.BoxConstraints(
                      maxWidth: 420,
                      maxHeight: 500,
                    ),
                    child: pw.Image(
                      pw.MemoryImage(bytes),
                      fit: pw.BoxFit.contain,
                    ),
                  ),
                ),
                pw.SizedBox(height: 16),
              ],
            )),
          ]
        )
      );
    }

    return await pdf.save();
  }
}

