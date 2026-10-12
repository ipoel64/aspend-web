import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:googleapis/sheets/v4.dart' as sheets;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/sdm_pkh.dart';
import 'sheets_service.dart';

class SdmPkhService {
  static final SdmPkhService instance = SdmPkhService._();
  SdmPkhService._();

  static const String _storageKey = 'master_sdm_pkh_list';
  static const String defaultSheetName = 'SDM_PKH';

  /// Membaca data SDM PKH dari cache lokal SharedPreferences
  Future<List<SdmPkh>> getList() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = prefs.getString(_storageKey);
      if (jsonStr == null || jsonStr.isEmpty) return [];

      final List<dynamic> decoded = jsonDecode(jsonStr);
      return decoded.map((e) => SdmPkh.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  /// Menyimpan data SDM PKH ke cache lokal SharedPreferences
  Future<void> saveList(List<SdmPkh> list) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = jsonEncode(list.map((e) => e.toJson()).toList());
      await prefs.setString(_storageKey, jsonStr);
    } catch (_) {}
  }

  /// Sinkronisasi 2 arah dengan Google Sheets (sheet 'SDM_PKH')
  /// Memastikan database SDM antara Aspend Web dan Aspend Mobile selalu sinkron 1 database yang sama.
  Future<List<SdmPkh>> syncWithSheets({
    SheetsService? sheetsService,
    String? spreadsheetId,
  }) async {
    if (sheetsService == null || spreadsheetId == null) {
      return getList();
    }

    try {
      await _ensureSheetExists(sheetsService, spreadsheetId);
      final resolvedName = await _resolveSheetName(sheetsService, spreadsheetId);
      final rows = await sheetsService.getAllRows(spreadsheetId, resolvedName);

      final List<SdmPkh> remoteList = [];
      for (int i = 0; i < rows.length; i++) {
        final r = rows[i];
        if (r.isEmpty) continue;

        String id = '';
        String nama = '';
        String nip = '';

        if (r.length >= 3) {
          id = r[0]?.toString().trim() ?? '';
          nama = r[1]?.toString().trim() ?? '';
          nip = r[2]?.toString().trim() ?? '';
        } else if (r.length == 2) {
          nama = r[0]?.toString().trim() ?? '';
          nip = r[1]?.toString().trim() ?? '';
          id = nip.isNotEmpty ? 'SDM-$nip' : 'SDM-${i + 1}';
        } else if (r.length == 1) {
          nama = r[0]?.toString().trim() ?? '';
          id = 'SDM-${i + 1}';
        }

        final lower = nama.toLowerCase();
        if (nama.isNotEmpty && lower != 'nama' && lower != 'nama sdm') {
          if (id.isEmpty) {
            id = 'SDM-${i + 1}';
          }
          remoteList.add(SdmPkh(id: id, nama: nama, nip: nip));
        }
      }

      await saveList(remoteList);
      return remoteList;
    } catch (e) {
      debugPrint('Error syncing SDM PKH with Sheets: $e');
      return getList();
    }
  }

  Future<SdmPkh> addSdm(
    String nama,
    String nip, {
    SheetsService? sheetsService,
    String? spreadsheetId,
  }) async {
    final cleanNama = nama.trim();
    final cleanNip = nip.trim();
    final newId = 'SDM-${DateTime.now().millisecondsSinceEpoch}';
    final newSdm = SdmPkh(
      id: newId,
      nama: cleanNama,
      nip: cleanNip,
    );

    final list = await getList();
    list.add(newSdm);
    await saveList(list);

    if (sheetsService != null && spreadsheetId != null) {
      try {
        await _ensureSheetExists(sheetsService, spreadsheetId);
        final resolvedName = await _resolveSheetName(sheetsService, spreadsheetId);
        await sheetsService.appendRow(spreadsheetId, resolvedName, [newId, cleanNama, cleanNip]);
      } catch (e) {
        debugPrint('Error appending SDM PKH to Sheets: $e');
      }
    }

    return newSdm;
  }

  Future<void> updateSdm(
    String id,
    String nama,
    String nip, {
    SheetsService? sheetsService,
    String? spreadsheetId,
  }) async {
    final cleanNama = nama.trim();
    final cleanNip = nip.trim();

    final list = await getList();
    final index = list.indexWhere((e) => e.id == id);
    if (index != -1) {
      list[index] = list[index].copyWith(
        nama: cleanNama,
        nip: cleanNip,
      );
      await saveList(list);
    }

    if (sheetsService != null && spreadsheetId != null) {
      try {
        final resolvedName = await _resolveSheetName(sheetsService, spreadsheetId);
        final rows = await sheetsService.getAllRows(spreadsheetId, resolvedName);
        int targetRowIndex = -1;

        for (int i = 0; i < rows.length; i++) {
          final r = rows[i];
          if (r.isEmpty) continue;
          if (r[0]?.toString().trim() == id ||
              (r.length > 1 && r[1]?.toString().trim() == cleanNama)) {
            targetRowIndex = i + 2; // +1 untuk header, +1 karena 1-based index
            break;
          }
        }

        if (targetRowIndex != -1) {
          await sheetsService.updateRow(
            spreadsheetId,
            resolvedName,
            targetRowIndex,
            [id, cleanNama, cleanNip],
          );
        }
      } catch (e) {
        debugPrint('Error updating SDM PKH in Sheets: $e');
      }
    }
  }

  Future<void> deleteSdm(
    String id, {
    SheetsService? sheetsService,
    String? spreadsheetId,
  }) async {
    final list = await getList();
    final toDelete = list.firstWhere(
      (e) => e.id == id,
      orElse: () => SdmPkh(id: '', nama: '', nip: ''),
    );
    list.removeWhere((e) => e.id == id);
    await saveList(list);

    if (sheetsService != null && spreadsheetId != null) {
      try {
        final resolvedName = await _resolveSheetName(sheetsService, spreadsheetId);
        final rows = await sheetsService.getAllRows(spreadsheetId, resolvedName);
        int targetRowIndex = -1;

        for (int i = 0; i < rows.length; i++) {
          final r = rows[i];
          if (r.isEmpty) continue;
          if (r[0]?.toString().trim() == id ||
              (toDelete.nama.isNotEmpty && r.length > 1 && r[1]?.toString().trim() == toDelete.nama)) {
            targetRowIndex = i + 2;
            break;
          }
        }

        if (targetRowIndex != -1) {
          await sheetsService.deleteRow(
            spreadsheetId,
            resolvedName,
            targetRowIndex,
          );
        }
      } catch (e) {
        debugPrint('Error deleting SDM PKH from Sheets: $e');
      }
    }
  }

  Future<void> _ensureSheetExists(SheetsService sheetsService, String spreadsheetId) async {
    try {
      final spreadsheet = await sheetsService.api.spreadsheets.get(spreadsheetId);
      final hasSheet = spreadsheet.sheets?.any(
        (s) => s.properties?.title == 'SDM_PKH' || s.properties?.title == 'Master_SDM_PKH',
      ) ?? false;

      if (!hasSheet) {
        await sheetsService.createSheet(spreadsheetId, 'SDM_PKH');
        await sheetsService.writeHeaders(spreadsheetId, 'SDM_PKH', ['ID', 'Nama SDM', 'NIP']);
      }
    } catch (_) {}
  }

  Future<String> _resolveSheetName(SheetsService sheetsService, String spreadsheetId) async {
    try {
      final spreadsheet = await sheetsService.api.spreadsheets.get(spreadsheetId);
      final found = spreadsheet.sheets?.firstWhere(
        (s) => s.properties?.title == 'SDM_PKH' || s.properties?.title == 'Master_SDM_PKH',
        orElse: () => sheets.Sheet(properties: sheets.SheetProperties(title: 'SDM_PKH')),
      );
      return found?.properties?.title ?? 'SDM_PKH';
    } catch (_) {
      return 'SDM_PKH';
    }
  }
}
