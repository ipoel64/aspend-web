import 'dart:typed_data';
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

      // Export as raw RGBA, then encode to JPEG via package:image.
      // This avoids the massive memory usage of PNG encoding and gives us
      // quality control for optimal PDF file size.
      final byteData = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
      
      if (byteData != null) {
        final img.Image imgImage = img.Image.fromBytes(
          width: image.width,
          height: image.height,
          bytes: byteData.buffer,
          order: img.ChannelOrder.rgba,
        );
        
        final jpegBytes = Uint8List.fromList(img.encodeJpg(imgImage, quality: quality));
        debugPrint('resizeImage: ${origWidth}x$origHeight (${inputBytes.length ~/ 1024}KB) → ${image.width}x${image.height} (${jpegBytes.length ~/ 1024}KB JPEG)');
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
  /// Uses lower quality (50) and smaller width (600) to keep PDF size
  /// manageable and prevent OOM on low-memory devices.
  /// PNG screenshots get extra-aggressive treatment since they have
  /// high pixel dimensions but low visual detail.
  Future<Uint8List> compressForPdf(List<int> inputBytes) async {
    final int effectiveQuality = _isPng(inputBytes) ? 45 : 50;
    final int effectiveWidth = _isPng(inputBytes) ? 500 : 600;
    return resizeImage(inputBytes, targetWidth: effectiveWidth, quality: effectiveQuality);
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
                    pw.Text('DIREKTORAT JENDERAL PERLINDUNGAN DAN JAMINAN SOSIAL', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                    pw.Text('DIREKTORAT PERLINDUNGAN SOSIAL NON KEBENCANAAN', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
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
      final periodeStr = formatPeriode(report.tanggal);
      final waktuStr = formatWaktu(report.tanggal, report.pukul);

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
                  report.jenisRHK,
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
                  pw.Text(report.rencanaAksi, style: const pw.TextStyle(fontSize: 10.5)),
                ],
              ),
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
      final List<pw.TextSpan> spans = [];
      final parts = text.split('**');
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
      final List<pw.Widget> widgets = [];
      final lines = text.split('\n');
      bool hasAddedP2K2Table = false;
      bool inListItem = false;
      List<pw.Widget> pendingHeaders = [];
      List<String> pendingHeaderTexts = [];

      // Table Widget Builder
      pw.Widget buildP2K2TableWidget(P2K2Data p2k2) {
        return pw.Table(
          border: pw.TableBorder.all(width: 0.8, color: PdfColors.black),
          columnWidths: {
            0: const pw.FixedColumnWidth(120),
            1: const pw.FlexColumnWidth(),
          },
          children: [
            pw.TableRow(
              decoration: const pw.BoxDecoration(color: PdfColors.grey100),
              children: [
                pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text('Keterangan P2K2', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9.5))),
                pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text('Detail', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9.5))),
              ]
            ),
            pw.TableRow(children: [
              pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text('Modul', style: const pw.TextStyle(fontSize: 9.5))),
              pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text(p2k2.modul, style: const pw.TextStyle(fontSize: 9.5))),
            ]),
            pw.TableRow(children: [
              pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text('Sesi', style: const pw.TextStyle(fontSize: 9.5))),
              pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text(p2k2.sesi, style: const pw.TextStyle(fontSize: 9.5))),
            ]),
            pw.TableRow(children: [
              pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text('Nama Kelompok', style: const pw.TextStyle(fontSize: 9.5))),
              pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text(p2k2.namaKelompok, style: const pw.TextStyle(fontSize: 9.5))),
            ]),
            pw.TableRow(children: [
              pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text('Ketua Kelompok', style: const pw.TextStyle(fontSize: 9.5))),
              pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text(p2k2.ketuaKelompok, style: const pw.TextStyle(fontSize: 9.5))),
            ]),
            pw.TableRow(children: [
              pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text('Kehadiran', style: const pw.TextStyle(fontSize: 9.5))),
              pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text('${p2k2.jumlahHadir} hadir dari total ${p2k2.jumlahKPM} KPM', style: const pw.TextStyle(fontSize: 9.5))),
            ]),
          ],
        );
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
          if (pendingHeaders.isEmpty) {
            flushPendingHeaders();
            widgets.add(pw.SizedBox(height: 6));
          }
          continue;
        }

        // Check if it is a main sub-header (e.g. A. PENDAHULUAN or **A. PENDAHULUAN**)
        final subHeaderRegExp = RegExp(r'^(?:\*\*)?([A-Z]\.)\s+(.*?)(?:\*\*)?$');
        if (subHeaderRegExp.hasMatch(trimmed)) {
          final match = subHeaderRegExp.firstMatch(trimmed)!;
          final letter = match.group(1)!;
          final title = match.group(2)!;
          final cleanHeader = '$letter $title';
          
          if ((cleanHeader.startsWith('C.') || cleanHeader.startsWith('D.') || cleanHeader.startsWith('E.')) && 
              !hasAddedP2K2Table && 
              report.p2k2Data != null && 
              report.p2k2Data!.modul.isNotEmpty) {
            flushPendingHeaders();
            widgets.add(pw.SizedBox(height: 10));
            widgets.add(buildP2K2TableWidget(report.p2k2Data!));
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

        // Check if it is a list item (e.g. 1. Gambaran Umum: ...)
        final pointRegExp = RegExp(r'^(\d+)\.\s+(.*)');
        final bulletRegExp = RegExp(r'^[-*•]\s+(.*)');
        
        pw.Widget? contentWidget;
        
        if (pointRegExp.hasMatch(trimmed)) {
          inListItem = true;
          final match = pointRegExp.firstMatch(trimmed)!;
          final num = match.group(1)!;
          final content = match.group(2)!;
          
          String pointTitle = '';
          String pointDesc = content;
          
          // Pattern: **Title**: Description OR Title: Description OR **Title** - Description
          final titleRegExp = RegExp(r'^(?:\*\*(.*?)\*\*(?:\s*[:\-]?\s*)?|([^*:\-]+?)(?:\s*:\s*|\s+-\s+))(.*)');
          if (titleRegExp.hasMatch(content)) {
            final titleMatch = titleRegExp.firstMatch(content)!;
            final boldTitle = titleMatch.group(1);
            final plainTitle = titleMatch.group(2);
            pointTitle = (boldTitle ?? plainTitle ?? '').trim();
            pointDesc = titleMatch.group(3)!.trim();
          }
          
          if (pointTitle.isNotEmpty) {
            contentWidget = pw.Padding(
              padding: const pw.EdgeInsets.only(left: 14, bottom: 6),
              child: pw.RichText(
                textAlign: pw.TextAlign.justify,
                text: pw.TextSpan(
                  style: const pw.TextStyle(fontSize: 10.5, lineSpacing: 1.9),
                  children: [
                    pw.TextSpan(
                      text: '$num. $pointTitle${pointDesc.isNotEmpty ? '\n' : ''}',
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                    ),
                    if (pointDesc.isNotEmpty) pw.TextSpan(text: '       '), // Indent untuk deskripsi
                    ...parseNarrativeSpans(pointDesc),
                  ],
                ),
              ),
            );
          } else {
            contentWidget = pw.Padding(
              padding: const pw.EdgeInsets.only(left: 14, bottom: 6),
              child: pw.RichText(
                textAlign: pw.TextAlign.justify,
                text: pw.TextSpan(
                  style: const pw.TextStyle(fontSize: 10.5, lineSpacing: 1.9),
                  children: [
                    pw.TextSpan(text: '$num. ', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                    ...parseNarrativeSpans(content),
                  ],
                ),
              ),
            );
          }
        } else if (bulletRegExp.hasMatch(trimmed)) {
          inListItem = true;
          final match = bulletRegExp.firstMatch(trimmed)!;
          final content = match.group(1)!;
          
          String bulletTitle = '';
          String bulletDesc = content;
          
          final titleRegExp = RegExp(r'^(?:\*\*(.*?)\*\*(?:\s*[:\-]?\s*)?|([^*:\-]+?)(?:\s*:\s*|\s+-\s+))(.*)');
          if (titleRegExp.hasMatch(content)) {
            final titleMatch = titleRegExp.firstMatch(content)!;
            final boldTitle = titleMatch.group(1);
            final plainTitle = titleMatch.group(2);
            bulletTitle = (boldTitle ?? plainTitle ?? '').trim();
            bulletDesc = titleMatch.group(3)!.trim();
          }
          
          if (bulletTitle.isNotEmpty) {
            contentWidget = pw.Padding(
              padding: const pw.EdgeInsets.only(left: 36, bottom: 0),
              child: pw.RichText(
                textAlign: pw.TextAlign.justify,
                text: pw.TextSpan(
                  style: const pw.TextStyle(fontSize: 10.5, lineSpacing: 1.9),
                  children: [
                    pw.TextSpan(
                      text: '- $bulletTitle${bulletDesc.isNotEmpty ? '\n' : ''}',
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                    ),
                    if (bulletDesc.isNotEmpty) pw.TextSpan(text: '    '), // Indent untuk deskripsi
                    ...parseNarrativeSpans(bulletDesc),
                  ],
                ),
              ),
            );
          } else {
            contentWidget = pw.Padding(
              padding: const pw.EdgeInsets.only(left: 36, bottom: 0),
              child: pw.RichText(
                textAlign: pw.TextAlign.justify,
                text: pw.TextSpan(
                  style: const pw.TextStyle(fontSize: 10.5, lineSpacing: 1.9),
                  children: [
                    pw.TextSpan(text: '- ', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                    ...parseNarrativeSpans(content),
                  ],
                ),
              ),
            );
          }
        } else {
          // Regular paragraph
          contentWidget = pw.Padding(
            padding: pw.EdgeInsets.only(left: inListItem ? 14 : 0, bottom: 6),
            child: pw.RichText(
              textAlign: pw.TextAlign.justify,
              text: pw.TextSpan(
                style: const pw.TextStyle(fontSize: 10.5, lineSpacing: 1.9),
                children: [
                  pw.TextSpan(text: '      '),
                  ...parseNarrativeSpans(trimmed),
                ],
              ),
            ),
          );
        }

        // Jika ada sub-judul pending, gabungkan sub-judul + konten pertama
        // menjadi SATU pw.RichText atomik. MultiPage tidak akan memecah
        // satu RichText, jadi sub-judul selalu bersama kontennya.
         if (pendingHeaders.isNotEmpty) {
          // Bungkus header dan konten pertama dalam Column di dalam Container
          // agar tidak terpecah oleh MultiPage, sekaligus mempertahankan padding masing-masing.
          widgets.add(
            pw.Wrap(
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  mainAxisSize: pw.MainAxisSize.min,
                  children: [
                    ...pendingHeaders,
                    contentWidget,
                  ],
                ),
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

      if (!hasAddedP2K2Table && report.p2k2Data != null && report.p2k2Data!.modul.isNotEmpty) {
        widgets.add(pw.SizedBox(height: 10));
        widgets.add(buildP2K2TableWidget(report.p2k2Data!));
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
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Text('${userProfile.kabupatenKota.isEmpty ? "Dibuat di" : userProfile.kabupatenKota}, ${DateFormat('d MMMM yyyy', 'id_ID').format(_safeParseDate(report.tanggal))}', style: const pw.TextStyle(fontSize: 10.5)),
                  pw.SizedBox(height: 4),
                  pw.Text(userProfile.jabatan.isNotEmpty ? userProfile.jabatan : 'Pendamping Sosial', style: const pw.TextStyle(fontSize: 10.5)),
                  pw.SizedBox(height: 2),
                  if (processedSignature != null)
                    pw.Image(pw.MemoryImage(processedSignature), width: 135, height: 75)
                  else
                    pw.SizedBox(height: 75),
                  pw.Text(userProfile.nama, style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold, decoration: pw.TextDecoration.underline)),
                  pw.Text('NIP. ${userProfile.nip}', style: const pw.TextStyle(fontSize: 9.5)),
                ]
              )
            ]
          )
        ],
      )
    );

    // Page 2: Photo Appendix
    if (processedPhotos.isNotEmpty) {
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
            
            // Layout photos in a grid/list, centered and slightly larger
            ...processedPhotos.map((bytes) {
              return pw.Column(
                children: [
                  pw.Center(
                    child: pw.Image(
                      pw.MemoryImage(bytes),
                      width: 450,
                      fit: pw.BoxFit.contain,
                    ),
                  ),
                  pw.SizedBox(height: 20),
                ]
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
  }) async {
    final pdf = pw.Document();

    List<pw.TextSpan> parseNarrativeSpans(String text) {
      String cleanText = text.replaceAll('**', '*').replaceAll('"', '').replaceAll('#', '');
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

    List<pw.Widget> buildPengaduanNarrative(String text) {
      final List<pw.Widget> finalWidgets = [];
      final lines = text.split('\n');
      
      double currentIndent = 0;
      double childIndent = 0;
      
      pw.Widget? pendingHeader;

      void flushPendingHeader() {
        if (pendingHeader != null) {
          finalWidgets.add(pendingHeader!);
          pendingHeader = null;
        }
      }

      for (var line in lines) {
        var cleanLine = line.trim();
        
        // Replace weird unicode bullets (like ➢, ✓, ▪, □) with standard dash
        cleanLine = cleanLine.replaceAll(RegExp(r'^([^\w\sa-zA-Z0-9(]+)\s+'), '- ');
        
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
          // Bullet points
          final match = bulletRegExp.firstMatch(cleanLine)!;
          final content = match.group(1)!;

          final bulletWidget = pw.Padding(
            padding: pw.EdgeInsets.only(left: childIndent, bottom: 4),
            child: pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('• ', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
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
    Uint8List? processedSiks;
    if (screenshotBytes != null && screenshotBytes.isNotEmpty) {
      processedSiks = await resizeImage(screenshotBytes, targetWidth: 600);
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
                    pw.Text('DIREKTORAT JENDERAL PERLINDUNGAN DAN JAMINAN SOSIAL', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                    pw.Text('DIREKTORAT PERLINDUNGAN SOSIAL NON KEBENCANAAN', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
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
                pw.Text(pengaduan.desaKelurahan, style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Kecamatan', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(pengaduan.kecamatan, style: const pw.TextStyle(fontSize: 10.5)),
              ]),
              pw.TableRow(children: [
                pw.Text('Kabupaten / Kota', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(':', style: const pw.TextStyle(fontSize: 10.5)),
                pw.Text(pengaduan.kabKota, style: const pw.TextStyle(fontSize: 10.5)),
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
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Text('Pembuat Laporan,', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                  pw.Text('${userProfile.kabupatenKota.isEmpty ? "Dibuat di" : userProfile.kabupatenKota}, ${DateFormat('d MMMM yyyy', 'id_ID').format(_safeParseDate(pengaduan.createdAt))}', style: const pw.TextStyle(fontSize: 10.5)),
                  pw.Text(userProfile.jabatan.isNotEmpty ? userProfile.jabatan : 'Pendamping Sosial', style: const pw.TextStyle(fontSize: 10.5)),
                  pw.SizedBox(height: 8),
                  if (processedSignature != null)
                    pw.Image(pw.MemoryImage(processedSignature), width: 100, height: 60)
                  else
                    pw.SizedBox(height: 60),
                  pw.SizedBox(height: 8),
                  pw.Text(userProfile.nama, style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold, decoration: pw.TextDecoration.underline)),
                  pw.Text('NIP. ${userProfile.nip}', style: const pw.TextStyle(fontSize: 9.5)),
                ]
              )
            ]
          )
        ],
      )
    );

    // Page 2: Appendix
    if (processedKtp != null || processedSiks != null) {
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
                    pw.Image(pw.MemoryImage(processedKtp), width: 350, fit: pw.BoxFit.contain),
                  ]
                )
              ),
              pw.SizedBox(height: 25),
            ],
            if (processedSiks != null) ...[
              pw.Center(
                child: pw.Column(
                  children: [
                    pw.Text('SCREENSHOT SIKS-NG / CEK BANSOS', style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 5),
                    pw.Image(pw.MemoryImage(processedSiks), width: 350, fit: pw.BoxFit.contain),
                  ]
                )
              ),
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
  }) async {
    final pdf = pw.Document();

    Uint8List? processedSignature;
    if (signatureBytes != null && signatureBytes.isNotEmpty) {
      processedSignature = await resizeImage(signatureBytes, targetWidth: 300);
    }

    Uint8List? processedBuktiDukung;
    if (buktiDukungBytes != null && buktiDukungBytes.isNotEmpty) {
      processedBuktiDukung = await resizeImage(buktiDukungBytes, targetWidth: 600);
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
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Text(userProfile.jabatan.isNotEmpty ? userProfile.jabatan : 'Pendamping Sosial', style: const pw.TextStyle(fontSize: 10.5)),
                  pw.SizedBox(height: 8),
                  if (processedSignature != null)
                    pw.Image(pw.MemoryImage(processedSignature), width: 100, height: 60)
                  else
                    pw.SizedBox(height: 60),
                  pw.SizedBox(height: 8),
                  pw.Text(userProfile.nama, style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold, decoration: pw.TextDecoration.underline)),
                  pw.Text('NIP. ${userProfile.nip}', style: const pw.TextStyle(fontSize: 9.5)),
                ]
              )
            ]
          )
        ],
      )
    );

    if (processedBuktiDukung != null) {
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
            pw.Center(
              child: pw.Image(
                pw.MemoryImage(processedBuktiDukung!),
                width: 450,
                fit: pw.BoxFit.contain,
              ),
            ),
          ]
        )
      );
    }

    return await pdf.save();
  }
}

