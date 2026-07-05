import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../config/constants.dart';
import '../models/dashboard_stats.dart';
import '../models/report.dart';
import 'auth_provider.dart';

class ReportProvider extends ChangeNotifier {
  AuthProvider? _auth;

  List<Report> _reports = [];
  List<Report> _filteredReports = [];
  DashboardStats _stats = const DashboardStats();

  bool _isLoading = false;
  String? _errorMessage;

  // Filters
  String _searchTerm = '';
  String? _filterJenis;
  String? _filterRencanaAksi;
  String? _filterMonth; // Format: 'YYYY-MM'
  String? _filterDate; // Format: 'YYYY-MM-DD'

  void updateAuth(AuthProvider auth) {
    _auth = auth;
  }

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<Report> get reports => _reports;
  List<Report> get filteredReports => _filteredReports;
  DashboardStats get stats => _stats;

  Future<void> loadReports() async {
    if (_auth?.sheetsService == null || _auth?.spreadsheetId == null) return;

    _setLoading(true);
    _errorMessage = null;

    try {
      final rows = await _auth!.sheetsService!.getAllRows(
        _auth!.spreadsheetId!,
        AppConstants.sheetLaporanLog,
      );

      _reports = rows.map((row) => Report.fromSheetRow(row)).toList();
      // Sort by report date (tanggal) newest first, secondary sort by creation time
      _reports.sort((a, b) {
        final dateA = _parseReportDate(a.tanggal) ?? DateTime.fromMillisecondsSinceEpoch(0);
        final dateB = _parseReportDate(b.tanggal) ?? DateTime.fromMillisecondsSinceEpoch(0);
        final comp = dateB.compareTo(dateA);
        if (comp == 0) {
          return b.createdAt.compareTo(a.createdAt);
        }
        return comp;
      });

      _applyFilters();
    } catch (e) {
      _errorMessage = 'Gagal memuat laporan: $e';
      print(_errorMessage);
    }

    _setLoading(false);
  }

  void _applyFilters() {
    _filteredReports =
        _reports.where((r) {
          // 1. Search term (in rencana aksi or poin)
          final matchSearch =
              _searchTerm.isEmpty ||
              r.rencanaAksi.toLowerCase().contains(_searchTerm.toLowerCase()) ||
              r.poinKegiatan.toLowerCase().contains(_searchTerm.toLowerCase());

          // 2. Jenis
          final matchJenis = _filterJenis == null || r.idRHK == _filterJenis;

          // 3. Rencana Aksi
          final matchRencana =
              _filterRencanaAksi == null || r.rencanaAksi == _filterRencanaAksi;

          // 4. Month
          final reportDate = _parseReportDate(r.tanggal);
          final matchMonth =
              _filterMonth == null ||
              (reportDate != null &&
                  '${reportDate.year}-${reportDate.month.toString().padLeft(2, '0')}' ==
                      _filterMonth);

          // 5. Date
          final matchDate =
              _filterDate == null ||
              (reportDate != null &&
                  '${reportDate.year}-${reportDate.month.toString().padLeft(2, '0')}-${reportDate.day.toString().padLeft(2, '0')}' ==
                      _filterDate);

          return matchSearch && matchJenis && matchRencana && matchMonth && matchDate;
        }).toList();

    _calculateStats();
    notifyListeners();
  }

  DateTime? _parseReportDate(String tanggal) {
    final cleaned = tanggal.trim();
    if (cleaned.isEmpty) return null;
    
    // 1. Try ISO parse
    final parsedIso = DateTime.tryParse(cleaned);
    if (parsedIso != null) return parsedIso;

    // 2. Try common formats
    final formats = [
      'dd/MM/yyyy',
      'yyyy-MM-dd',
      'd MMMM yyyy',
      'd MMM yyyy',
      'EEEE, d MMMM yyyy',
      'dd-MM-yyyy',
    ];

    for (var format in formats) {
      try {
        return DateFormat(format, 'id_ID').parse(cleaned);
      } catch (_) {}
      try {
        return DateFormat(format, 'en_US').parse(cleaned);
      } catch (_) {}
    }

    // 3. Try to clean up and parse
    try {
      final cleanedText = cleaned
          .replaceAll(RegExp(r'\s*-\s*\d{2}:\d{2}\s*(WIB)?'), '')
          .replaceAll(RegExp(r'•.*'), '')
          .trim();
      
      final parsedFallback = DateTime.tryParse(cleanedText);
      if (parsedFallback != null) return parsedFallback;
      
      for (var format in formats) {
        try {
          return DateFormat(format, 'id_ID').parse(cleanedText);
        } catch (_) {}
        try {
          return DateFormat(format, 'en_US').parse(cleanedText);
        } catch (_) {}
      }
    } catch (_) {}

    return null;
  }

  void _calculateStats() {
    final now = DateTime.now();
    final currentMonthPrefix =
        '${now.year}-${now.month.toString().padLeft(2, '0')}';

    int monthCount = 0;
    for (var r in _reports) {
      final reportDate = _parseReportDate(r.tanggal);
      if (reportDate != null) {
        final rowMonth =
            '${reportDate.year}-${reportDate.month.toString().padLeft(2, '0')}';
        if (rowMonth == currentMonthPrefix) {
          monthCount++;
        }
      }
    }

    _stats = DashboardStats(total: _reports.length, month: monthCount);
  }

  Future<void> deleteReport(String reportId) async {
    if (_auth?.sheetsService == null || _auth?.spreadsheetId == null) return;

    try {
      // 1. Find report
      final report = _reports.firstWhere((r) => r.id == reportId);

      // 2. Find row index in sheet (ID is in col 0)
      final rowIndex = await _auth!.sheetsService!.findRowByValue(
        _auth!.spreadsheetId!,
        AppConstants.sheetLaporanLog,
        0,
        reportId,
      );

      if (rowIndex > 0) {
        // 3. Delete from sheet
        await _auth!.sheetsService!.deleteRow(
          _auth!.spreadsheetId!,
          AppConstants.sheetLaporanLog,
          rowIndex,
        );

        // 4. Delete files from Drive
        if (_auth?.driveService != null) {
          if (report.pdfFileId.isNotEmpty) {
            try {
              await _auth!.driveService!.deleteFile(report.pdfFileId);
            } catch (_) {}
          }
          for (var photoId in report.fotoIds) {
            try {
              await _auth!.driveService!.deleteFile(photoId);
            } catch (_) {}
          }
        }

        // 5. Remove from local list
        _reports.removeWhere((r) => r.id == reportId);
        _applyFilters();
      }
    } catch (e) {
      print('Gagal menghapus laporan: $e');
    }
  }

  // Filter setters
  void setSearchTerm(String term) {
    _searchTerm = term;
    _applyFilters();
  }

  void setFilterJenis(String? jenis) {
    _filterJenis = jenis;
    _applyFilters();
  }

  void setFilterRencanaAksi(String? aksi) {
    _filterRencanaAksi = aksi;
    _applyFilters();
  }

  void setFilterMonth(String? month) {
    _filterMonth = month;
    _filterDate = null; // Reset date if month is selected
    _applyFilters();
  }

  void setFilterDate(String? date) {
    _filterDate = date;
    _filterMonth = null; // Reset month if date is selected
    _applyFilters();
  }

  void resetFilters() {
    _searchTerm = '';
    _filterJenis = null;
    _filterRencanaAksi = null;
    _filterMonth = null;
    _filterDate = null;
    _applyFilters();
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }
}
