import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:csv/csv.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';
import 'package:googleapis/drive/v3.dart' as google_drive;

import '../../config/app_theme.dart';
import '../../providers/auth_provider.dart';

class VerkomToolsScreen extends StatefulWidget {
  const VerkomToolsScreen({super.key});

  @override
  State<VerkomToolsScreen> createState() => _VerkomToolsScreenState();
}

class _VerkomToolsScreenState extends State<VerkomToolsScreen> {
  String? _fileName;
  List<List<dynamic>> _csvData = [];
  bool _isProcessing = false;

  void _loadCSVFromBytes(Uint8List bytes, String name) {
    String input = utf8.decode(bytes, allowMalformed: true);
    
    // Strip UTF-8 Byte Order Mark (BOM) if present
    if (input.startsWith('\uFEFF')) {
      input = input.substring(1);
    }
    
    // Normalize line endings to standard LF (\n)
    input = input.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    
    // Strip Excel 'sep=' line indicator if present at the start
    if (input.trimLeft().startsWith('sep=')) {
      final firstNewline = input.indexOf('\n');
      if (firstNewline != -1) {
        input = input.substring(firstNewline + 1);
      }
    }

    // Deteksi pembatas kolom secara cerdas (koma atau titik koma)
    final delimiter = input.contains(';') ? ';' : ',';
    final converter = CsvToListConverter(fieldDelimiter: delimiter, eol: '\n');
    final rows = converter.convert(input);

    debugPrint('VERKOM CSV Loaded: ${rows.length} rows');
    for (int i = 0; i < rows.length && i < 15; i++) {
      debugPrint('Row $i (len=${rows[i].length}): ${rows[i]}');
    }

    setState(() {
      _fileName = name;
      _csvData = rows;
    });
    _showSnackBar('CSV berhasil diimpor dengan ${rows.length} baris!', Colors.green);
  }


  Future<void> _pickFromGoogleDrive() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.driveService == null) {
      _showSnackBar('Layanan Google Drive belum siap.', Colors.orange);
      return;
    }

    setState(() => _isProcessing = true);
    try {
      List<google_drive.File> files;
      try {
        files = await auth.driveService!.listCsvFiles();
      } catch (e) {
        if (e.toString().contains('401') || e.toString().contains('403') || e.toString().contains('Credentials') || e.toString().contains('unauthorized')) {
          debugPrint('Drive API 401/403 error, attempting to refresh session...');
          final refreshed = await auth.refreshSession();
          if (refreshed && auth.driveService != null) {
            files = await auth.driveService!.listCsvFiles();
          } else {
            throw Exception('Sesi login Google Drive kedaluwarsa. Silakan lakukan logout lalu login kembali untuk memperbarui akses.');
          }
        } else {
          rethrow;
        }
      }

      debugPrint('Found ${files.length} CSV files in Drive');
      for (var f in files) {
        debugPrint('Drive File: ${f.name} (ID: ${f.id}, Size: ${f.size}, Mime: ${f.mimeType})');
      }

      if (files.isEmpty) {
        throw 'Tidak ditemukan berkas CSV di Google Drive Anda.';
      }

      if (!mounted) return;

      final selectedFile = await showModalBottomSheet<google_drive.File>(
        context: context,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (context) {
          return Container(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Pilih CSV dari Google Drive',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navyDark),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: ListView.separated(
                    itemCount: files.length,
                    separatorBuilder: (_, __) => const Divider(),
                    itemBuilder: (context, index) {
                      final f = files[index];
                      return ListTile(
                        leading: const Icon(Icons.insert_drive_file_rounded, color: AppColors.gold),
                        title: Text(f.name ?? 'Tanpa Nama', style: const TextStyle(fontSize: 13)),
                        subtitle: f.size != null
                            ? Text('${(int.parse(f.size!) / 1024).toStringAsFixed(1)} KB', style: const TextStyle(fontSize: 11))
                            : null,
                        onTap: () => Navigator.pop(context, f),
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      );

      if (selectedFile != null && selectedFile.id != null) {
        setState(() => _isProcessing = true);
        Uint8List? bytes;
        try {
          bytes = await auth.driveService!.downloadFile(selectedFile.id!);
        } catch (e) {
          if (e.toString().contains('401') || e.toString().contains('403') || e.toString().contains('Credentials') || e.toString().contains('unauthorized')) {
            debugPrint('Drive download 401/403 error, refreshing session...');
            final refreshed = await auth.refreshSession();
            if (refreshed && auth.driveService != null) {
              bytes = await auth.driveService!.downloadFile(selectedFile.id!);
            } else {
              throw Exception('Sesi login Google Drive kedaluwarsa. Silakan lakukan logout lalu login kembali untuk memperbarui akses.');
            }
          } else {
            rethrow;
          }
        }

        if (bytes != null) {
          _loadCSVFromBytes(bytes, selectedFile.name ?? 'Drive_CSV');
        } else {
          throw 'Gagal mengunduh berkas dari Google Drive.';
        }
      }
    } catch (e) {
      if (e.toString().contains('SocketException') || e.toString().contains('Failed host lookup')) {
        _showSnackBar('Koneksi Gagal: Perangkat Anda tidak terhubung ke internet. Silakan periksa koneksi internet Anda.', Colors.red);
      } else {
        _showSnackBar('Gagal: $e', Colors.red);
      }
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _savePDFToGoogleDrive(Uint8List pdfBytes, String defaultName) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.driveService == null) {
      _showSnackBar('Layanan Google Drive belum siap.', Colors.orange);
      return;
    }

    try {
      String folderId;
      try {
        folderId = await auth.driveService!.getOrCreateFolder('VERKOM_Laporan');
      } catch (e) {
        if (e.toString().contains('401') || e.toString().contains('403') || e.toString().contains('Credentials') || e.toString().contains('unauthorized')) {
          debugPrint('Drive getOrCreateFolder 401/403 error, refreshing session...');
          final refreshed = await auth.refreshSession();
          if (refreshed && auth.driveService != null) {
            folderId = await auth.driveService!.getOrCreateFolder('VERKOM_Laporan');
          } else {
            rethrow;
          }
        } else {
          rethrow;
        }
      }

      String fileId;
      try {
        fileId = await auth.driveService!.uploadFile(
          folderId,
          defaultName,
          pdfBytes,
          'application/pdf',
        );
      } catch (e) {
        if (e.toString().contains('401') || e.toString().contains('403') || e.toString().contains('Credentials') || e.toString().contains('unauthorized')) {
          debugPrint('Drive uploadFile 401/403 error, refreshing session...');
          final refreshed = await auth.refreshSession();
          if (refreshed && auth.driveService != null) {
            fileId = await auth.driveService!.uploadFile(
              folderId,
              defaultName,
              pdfBytes,
              'application/pdf',
            );
          } else {
            rethrow;
          }
        } else {
          rethrow;
        }
      }

      await auth.driveService!.setPublicAccess(fileId);
      _showSnackBar('PDF berhasil disimpan ke Google Drive folder "VERKOM_Laporan"!', Colors.green, duration: 4);
    } catch (e) {
      _showSnackBar('Gagal menyimpan ke Google Drive: $e', Colors.red);
    }
  }

  Future<void> _printPDF() async {
    if (_csvData.isEmpty) return;

    setState(() => _isProcessing = true);
    try {
      // Parse metadata from the first few lines of PKH CSV
      String title = 'FORM VERIFIKASI KOMITMEN PENDIDIKAN';
      String npsn = 'NPSN :';
      String schoolName = 'Nama Sekolah :';

      for (int i = 0; i < _csvData.length && i < 6; i++) {
        final row = _csvData[i];
        final rowStr = row.map((e) => e?.toString() ?? '').join(' ');
        if (rowStr.toUpperCase().contains('FORM VERIFIKASI')) {
          title = rowStr;
        } else if (rowStr.toUpperCase().contains('NPSN')) {
          npsn = rowStr;
        } else if (rowStr.toUpperCase().contains('NAMA SEKOLAH')) {
          schoolName = rowStr;
        }
      }

      // Clean up double colons and extra spaces in metadata
      npsn = npsn.replaceAll('::', ':').replaceAll(': :', ':').trim();
      schoolName = schoolName.replaceAll('::', ':').replaceAll(': :', ':').trim();

      // Parse Month names dynamically
      String month1Name = 'APRIL';
      String month2Name = 'MEI';
      String month3Name = 'JUNI';

      for (var row in _csvData) {
        final rowStr = row.join(' ').toUpperCase();
        if (rowStr.contains('NIK PENGURUS') && rowStr.contains('NAMA PENGURUS')) {
          final months = <String>[];
          for (var cell in row) {
            final cellStr = cell?.toString().trim() ?? '';
            final upper = cellStr.toUpperCase();
            if (upper == 'JANUARI' || upper == 'PEBRUARI' || upper == 'FEBRUARI' || upper == 'MARET' ||
                upper == 'APRIL' || upper == 'MEI' || upper == 'JUNI' || upper == 'JULI' ||
                upper == 'AGUSTUS' || upper == 'SEPTEMBER' || upper == 'OKTOBER' ||
                upper == 'NOPEMBER' || upper == 'NOVEMBER' || upper == 'DESEMBER') {
              months.add(cellStr);
            }
          }
          if (months.length >= 3) {
            month1Name = months[0];
            month2Name = months[1];
            month3Name = months[2];
            break;
          }
        }
      }

      // Filter rows that are actual data
      final dataRows = _csvData.where((row) {
        if (row.length < 10) return false;

        // Skip header rows by checking keywords
        final rowStr = row.join(' ').toUpperCase();
        if (rowStr.contains('NIK PENGURUS') ||
            rowStr.contains('NAMA PENGURUS') ||
            rowStr.contains('TINGKAT PENDIDIKAN') ||
            rowStr.contains('HARI EFEKTIF') ||
            rowStr.contains('ALPA') ||
            rowStr.contains('IZIN') ||
            rowStr.contains('SAKIT')) {
          return false;
        }

        // Also skip rows where essential fields like Nama Pengurus and Nama Siswa are all empty
        if (row.length > 5) {
          final namaPengurus = row[2]?.toString().trim() ?? '';
          final namaSiswa = row[5]?.toString().trim() ?? '';
          if (namaPengurus.isEmpty && namaSiswa.isEmpty) {
            return false;
          }
        }

        return true;
      }).map((row) {
        final padded = List<dynamic>.from(row);
        if (padded.length < 25) {
          padded.addAll(List.filled(25 - padded.length, ''));
        }
        return padded;
      }).toList();

      final pdf = pw.Document();

      // Custom cell helpers to support nested rowspan/colspan styles natively
      pw.Widget buildSubCell(String text, {bool isLast = false, bool isHeader = false, bool small = false}) {
        String displayVal = text;
        if (!isHeader && displayVal.length > 25) {
          displayVal = '${displayVal.substring(0, 22)}...';
        }
        return pw.Expanded(
          child: pw.Container(
            alignment: pw.Alignment.center,
            decoration: pw.BoxDecoration(
              border: isLast ? null : const pw.Border(right: pw.BorderSide(color: PdfColors.black, width: 0.5)),
            ),
            padding: pw.EdgeInsets.symmetric(vertical: isHeader ? 2 : 4),
            child: pw.Text(
              displayVal,
              style: pw.TextStyle(
                fontSize: small ? 5.0 : (isHeader ? 5.5 : 6.5),
                fontWeight: isHeader ? pw.FontWeight.bold : pw.FontWeight.normal,
              ),
            ),
          ),
        );
      }

      pw.Widget buildMonthHeader(String monthName) {
        return pw.SizedBox(
          height: 38,
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              pw.Container(
                height: 12,
                alignment: pw.Alignment.center,
                decoration: const pw.BoxDecoration(
                  border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 0.5)),
                ),
                child: pw.Text(monthName, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6.0)),
              ),
              pw.Container(
                height: 12,
                alignment: pw.Alignment.center,
                decoration: const pw.BoxDecoration(
                  border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 0.5)),
                ),
                child: pw.Text('Hari Efektif: ......', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 5.5)),
              ),
              pw.Expanded(
                child: pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.stretch,
                  children: [
                    buildSubCell('ALPA', isHeader: true, small: true),
                    buildSubCell('IZIN', isHeader: true, small: true),
                    buildSubCell('SAKIT', isHeader: true, small: true),
                    buildSubCell('JML', isHeader: true, small: true),
                    buildSubCell('%', isLast: true, isHeader: true, small: true),
                  ],
                ),
              ),
            ],
          ),
        );
      }

      pw.Widget buildMonthDataRow(List<dynamic> row, int startIndex) {
        return pw.SizedBox(
          height: 16,
          child: pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              buildSubCell(row[startIndex].toString()),
              buildSubCell(row[startIndex + 1].toString()),
              buildSubCell(row[startIndex + 2].toString()),
              buildSubCell(row[startIndex + 3].toString()),
              buildSubCell(row[startIndex + 4].toString(), isLast: true),
            ],
          ),
        );
      }

      final table = pw.Table(
        border: pw.TableBorder.all(color: PdfColors.black, width: 0.5),
        defaultVerticalAlignment: pw.TableCellVerticalAlignment.full,
        columnWidths: {
          0: const pw.FixedColumnWidth(15),  // NO
          1: const pw.FixedColumnWidth(60),  // NIK PENGURUS
          2: const pw.FixedColumnWidth(75),  // NAMA PENGURUS
          3: const pw.FixedColumnWidth(60),  // NIK SISWA
          4: const pw.FixedColumnWidth(50),  // NISN
          5: const pw.FixedColumnWidth(85),  // NAMA SISWA
          6: const pw.FixedColumnWidth(35),  // BENTUK PENDIDIKAN
          7: const pw.FixedColumnWidth(40),  // TINGKAT PENDIDIKAN
          8: const pw.FixedColumnWidth(80),  // Month 1
          9: const pw.FixedColumnWidth(80),  // Month 2
          10: const pw.FixedColumnWidth(80), // Month 3
          11: const pw.FixedColumnWidth(25), // KET
          12: const pw.FixedColumnWidth(75), // NAMA PENDAMPING
        },
        children: [
          // Header Row
          pw.TableRow(
            children: [
              pw.Container(
                alignment: pw.Alignment.center,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text('NO', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6.5)),
              ),
              pw.Container(
                alignment: pw.Alignment.center,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text('NIK PENGURUS', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6.5)),
              ),
              pw.Container(
                alignment: pw.Alignment.center,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text('NAMA PENGURUS', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6.5)),
              ),
              pw.Container(
                alignment: pw.Alignment.center,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text('NIK SISWA', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6.5)),
              ),
              pw.Container(
                alignment: pw.Alignment.center,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text('NISN', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6.5)),
              ),
              pw.Container(
                alignment: pw.Alignment.center,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text('NAMA SISWA', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6.5)),
              ),
              pw.Container(
                alignment: pw.Alignment.center,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text('BENTUK PENDIDIKAN', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 5.0)),
              ),
              pw.Container(
                alignment: pw.Alignment.center,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text('TINGKAT PENDIDIKAN', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 5.0)),
              ),
              buildMonthHeader(month1Name),
              buildMonthHeader(month2Name),
              buildMonthHeader(month3Name),
              pw.Container(
                alignment: pw.Alignment.center,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text('KET', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6.5)),
              ),
              pw.Container(
                alignment: pw.Alignment.center,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text('NAMA PENDAMPING', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6.5)),
              ),
            ],
          ),
          // Data Rows
          ...dataRows.map((row) {
            return pw.TableRow(
              children: [
                pw.Container(
                  alignment: pw.Alignment.center,
                  padding: const pw.EdgeInsets.all(4),
                  child: pw.Text(
                    row[0]?.toString().trim().isEmpty ?? true
                        ? (dataRows.indexOf(row) + 1).toString()
                        : row[0].toString(),
                    style: const pw.TextStyle(fontSize: 6.5),
                  ),
                ),
                pw.Container(
                  alignment: pw.Alignment.center,
                  padding: const pw.EdgeInsets.all(4),
                  child: pw.Text(row[1].toString(), style: const pw.TextStyle(fontSize: 6.5)),
                ),
                pw.Container(
                  alignment: pw.Alignment.centerLeft,
                  padding: const pw.EdgeInsets.all(4),
                  child: pw.Text(row[2].toString(), style: const pw.TextStyle(fontSize: 6.5)),
                ),
                pw.Container(
                  alignment: pw.Alignment.center,
                  padding: const pw.EdgeInsets.all(4),
                  child: pw.Text(row[3].toString(), style: const pw.TextStyle(fontSize: 6.5)),
                ),
                pw.Container(
                  alignment: pw.Alignment.center,
                  padding: const pw.EdgeInsets.all(4),
                  child: pw.Text(row[4].toString(), style: const pw.TextStyle(fontSize: 6.5)),
                ),
                pw.Container(
                  alignment: pw.Alignment.centerLeft,
                  padding: const pw.EdgeInsets.all(4),
                  child: pw.Text(row[5].toString(), style: const pw.TextStyle(fontSize: 6.5)),
                ),
                pw.Container(
                  alignment: pw.Alignment.center,
                  padding: const pw.EdgeInsets.all(4),
                  child: pw.Text(row[6].toString(), style: const pw.TextStyle(fontSize: 6.5)),
                ),
                pw.Container(
                  alignment: pw.Alignment.center,
                  padding: const pw.EdgeInsets.all(4),
                  child: pw.Text(row[7].toString(), style: const pw.TextStyle(fontSize: 6.5)),
                ),
                buildMonthDataRow(row, 8),
                buildMonthDataRow(row, 13),
                buildMonthDataRow(row, 18),
                pw.Container(
                  alignment: pw.Alignment.center,
                  padding: const pw.EdgeInsets.all(4),
                  child: pw.Text(row[23].toString(), style: const pw.TextStyle(fontSize: 6.5)),
                ),
                pw.Container(
                  alignment: pw.Alignment.centerLeft,
                  padding: const pw.EdgeInsets.all(4),
                  child: pw.Text(row[24].toString(), style: const pw.TextStyle(fontSize: 6.5)),
                ),
              ],
            );
          }),
        ],
      );

      String cityName = 'Binjai';
      if (schoolName.toLowerCase().contains('binjai')) {
        cityName = 'Binjai';
      } else if (schoolName.toLowerCase().contains('medan')) {
        cityName = 'Medan';
      }

      pdf.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4.landscape,
          margin: const pw.EdgeInsets.all(24),
          build: (pw.Context context) {
            return [
              pw.Text(title, style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: PdfColors.black)),
              pw.SizedBox(height: 2),
              pw.Text(npsn, style: const pw.TextStyle(fontSize: 8.5)),
              pw.Text(schoolName, style: const pw.TextStyle(fontSize: 8.5)),
              pw.SizedBox(height: 10),

              table,

              pw.SizedBox(height: 15),

              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.end,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('............ , ......................../20......', style: const pw.TextStyle(fontSize: 8.5)),
                      pw.SizedBox(height: 2),
                      pw.Text('Diketahui Oleh :', style: const pw.TextStyle(fontSize: 8.5)),
                      pw.Text('Kepala Sekolah/wakil/Kesiswaan', style: const pw.TextStyle(fontSize: 8.5)),
                      pw.SizedBox(height: 55),
                      pw.Container(
                        width: 140,
                        decoration: const pw.BoxDecoration(
                          border: pw.Border(bottom: pw.BorderSide(width: 0.8, color: PdfColors.black)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ];
          },
        ),
      );

      final pdfBytes = await pdf.save();
      String sourceName = _fileName ?? 'Laporan';
      if (sourceName.toLowerCase().endsWith('.csv')) {
        sourceName = sourceName.substring(0, sourceName.length - 4);
      }
      final defaultName = 'VERKOM_$sourceName.pdf';

      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.driveService != null) {
        await _savePDFToGoogleDrive(pdfBytes, defaultName);
      }

      await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) async => pdfBytes,
        format: PdfPageFormat.a4.landscape,
        name: defaultName,
      );
    } catch (e) {
      _showSnackBar('Gagal mencetak/menyimpan PDF: $e', Colors.red);
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  void _showSnackBar(String msg, Color color, {int duration = 2}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: color,
        duration: Duration(seconds: duration),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasData = _csvData.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('VERKOM Tools'),
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
      ),
      body: _isProcessing
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _buildUploadHeader(),
                if (hasData) _buildActionsBar(),
                Expanded(
                  child: !hasData
                      ? _buildEmptyState()
                      : _buildCsvTablePreview(),
                ),
              ],
            ),
    );
  }

  Widget _buildUploadHeader() {
    return Container(
      width: double.infinity,
      color: AppColors.navy,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const Text(
            'Verifikasi Komitmen CSV Converter',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            'Impor berkas CSV dari sistem PKH Kemensos untuk diubah menjadi format PDF siap cetak',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, fontSize: 11),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _pickFromGoogleDrive,
            icon: const Icon(Icons.cloud_download_rounded),
            label: const Text('Google Drive'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.gold,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
          ),
          if (_fileName != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withOpacity(0.3)),
              ),
              child: Text(
                'Aktif: $_fileName',
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ]
        ],
      ),
    );
  }

  Widget _buildActionsBar() {
    return Container(
      color: Colors.grey.shade100,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _printPDF,
          icon: const Icon(Icons.print_rounded),
          label: const Text('Cetak & Simpan PDF'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.navy,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.insert_drive_file_outlined, size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text(
            'Silakan impor berkas CSV terlebih dahulu',
            style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildCsvTablePreview() {
    if (_csvData.length < 5) return _buildEmptyState();

    final headers = _csvData[4];
    final rows = _csvData.sublist(5);

    return SingleChildScrollView(
      scrollDirection: Axis.vertical,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowColor: WidgetStateProperty.all(AppColors.navy.withOpacity(0.05)),
          dataRowMinHeight: 32,
          dataRowMaxHeight: 44,
          columns: headers
              .map((h) => DataColumn(
                    label: Text(
                      h.toString(),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.navyDark),
                    ),
                  ))
              .toList(),
          rows: rows
              .map((row) {
                final paddedRow = List<dynamic>.from(row);
                if (paddedRow.length < headers.length) {
                  paddedRow.addAll(List.filled(headers.length - paddedRow.length, ''));
                } else if (paddedRow.length > headers.length) {
                  paddedRow.removeRange(headers.length, paddedRow.length);
                }
                return DataRow(
                  cells: paddedRow
                      .map((cell) => DataCell(
                            Text(
                              cell?.toString() ?? '',
                              style: const TextStyle(fontSize: 11),
                            ),
                          ))
                      .toList(),
                );
              })
              .toList(),
        ),
      ),
    );
  }
}
