import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/kpm_model.dart';
import 'auth_provider.dart';

class KpmProvider extends ChangeNotifier {
  AuthProvider? _authProvider;
  List<KpmCaretaker> _kpmList = [];
  bool _isLoading = false;
  String? _errorMessage;

  static const String _prefCachedKpmKey = 'cached_kpm_list_permanent';

  KpmProvider() {
    _loadFromLocalCache();
  }

  List<KpmCaretaker> get kpmList => _kpmList;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  void updateAuth(AuthProvider authProvider) {
    _authProvider = authProvider;
    if (_kpmList.isEmpty) {
      _loadFromLocalCache();
    }
    // Otomatis fetch data jika user sudah masuk dan spreadsheet siap
    if (authProvider.isSignedIn && authProvider.spreadsheetId != null) {
      fetchKpmList();
    }
  }

  Future<void> _loadFromLocalCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final email = _authProvider?.currentUser?.email ?? '';
      final userKey = email.isNotEmpty ? '${_prefCachedKpmKey}_$email' : _prefCachedKpmKey;
      final cachedStr = prefs.getString(userKey) ?? prefs.getString(_prefCachedKpmKey);

      if (cachedStr != null && cachedStr.isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(cachedStr);
        _kpmList = decoded.map((row) => KpmCaretaker.fromSheetRow(List<dynamic>.from(row))).toList();
        notifyListeners();
        debugPrint('Loaded ${_kpmList.length} KPM from permanent local cache');
      }
    } catch (e) {
      debugPrint('Error loading cached KPM: $e');
    }
  }

  Future<void> _saveToLocalCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final email = _authProvider?.currentUser?.email ?? '';
      final userKey = email.isNotEmpty ? '${_prefCachedKpmKey}_$email' : _prefCachedKpmKey;
      final rowsToSave = _kpmList.map((k) => k.toSheetRow()).toList();
      final jsonStr = jsonEncode(rowsToSave);
      await prefs.setString(userKey, jsonStr);
      await prefs.setString(_prefCachedKpmKey, jsonStr);
    } catch (e) {
      debugPrint('Error saving cached KPM: $e');
    }
  }

  /// Memuat daftar singkat KPM dari Google Sheets
  Future<void> fetchKpmList() async {
    // 1. Muat dari cache lokal terlebih dahulu agar UI instan
    if (_kpmList.isEmpty) {
      await _loadFromLocalCache();
    }

    if (_authProvider == null) return;

    if (_authProvider!.sheetsService == null) {
      await _authProvider!.ensureFreshAuth();
    }

    final sheets = _authProvider?.sheetsService;
    final ssId = _authProvider?.spreadsheetId;
    if (sheets == null || ssId == null) return;

    _setLoading(true);
    _errorMessage = null;

    try {
      List<List<dynamic>> rows;
      try {
        rows = await sheets.getAllRows(ssId, AppConstants.sheetKpmMaster);
      } catch (e) {
        debugPrint('Fetch KPM failed ($e), refreshing token...');
        final refreshed = await _authProvider!.ensureFreshAuth(forceRefresh: true);
        if (refreshed && _authProvider!.sheetsService != null) {
          rows = await _authProvider!.sheetsService!.getAllRows(ssId, AppConstants.sheetKpmMaster);
        } else {
          rethrow;
        }
      }

      _kpmList = rows.map((row) => KpmCaretaker.fromSheetRow(row)).toList();
      await _saveToLocalCache();
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Gagal memuat daftar KPM: $e';
      debugPrint(_errorMessage);
    } finally {
      _setLoading(false);
    }
  }

  /// Memuat detail lengkap KPM (Caretaker + Komponen + Rumah Usaha)
  Future<KpmProfile?> fetchKpmProfileDetails(String kpmId) async {
    final sheets = _authProvider?.sheetsService;
    final ssId = _authProvider?.spreadsheetId;
    if (sheets == null || ssId == null) return null;

    _setLoading(true);
    _errorMessage = null;

    try {
      // 1. Ambil Caretaker
      final caretakerRow = await sheets.getRowByValue(ssId, AppConstants.sheetKpmMaster, 0, kpmId);
      if (caretakerRow == null) return null;
      final caretaker = KpmCaretaker.fromSheetRow(caretakerRow);

      // 2. Ambil Rumah Usaha
      final houseRow = await sheets.getRowByValue(ssId, AppConstants.sheetKpmRumahUsaha, 1, kpmId);
      KpmHouse house;
      if (houseRow != null) {
        house = KpmHouse.fromSheetRow(houseRow);
      } else {
        house = KpmHouse(
          rumahId: 'RMH-${kpmId.substring(4)}',
          kpmId: kpmId,
          punyaUsaha: 'T',
          namaUsaha: '',
          fotoUsaha: '',
          fotoRumahLuar: '',
          fotoRumahTamu: '',
          fotoKamarMandi: '',
          latitude: 0.0,
          longitude: 0.0,
          pernyataan: '',
          bansosLain: '',
          createdAt: '',
        );
      }

      // 3. Ambil Komponen
      final allKomponenRows = await sheets.getAllRows(ssId, AppConstants.sheetKpmKomponen);
      final list = allKomponenRows
          .map((row) => KpmComponent.fromSheetRow(row))
          .where((k) => k.kpmId == kpmId)
          .toList();

      return KpmProfile(
        caretaker: caretaker,
        komponenList: list,
        house: house,
      );
    } catch (e) {
      _errorMessage = 'Gagal memuat detail KPM: $e';
      return null;
    } finally {
      _setLoading(false);
    }
  }

  /// Menyimpan atau memperbarui data profil KPM lengkap ke Google Sheets
  Future<bool> saveKpmProfile(KpmProfile profile) async {
    final sheets = _authProvider?.sheetsService;
    final ssId = _authProvider?.spreadsheetId;
    if (sheets == null || ssId == null) return false;

    _setLoading(true);
    _errorMessage = null;

    try {
      final kpmId = profile.caretaker.kpmId;

      // 1. Simpan KPM Master
      final caretakerRowIndex = await sheets.findRowByValue(ssId, AppConstants.sheetKpmMaster, 0, kpmId);
      if (caretakerRowIndex == -1) {
        await sheets.appendRow(ssId, AppConstants.sheetKpmMaster, profile.caretaker.toSheetRow());
      } else {
        await sheets.updateRow(ssId, AppConstants.sheetKpmMaster, caretakerRowIndex, profile.caretaker.toSheetRow());
      }

      // 2. Simpan KPM Rumah Usaha
      final houseRowIndex = await sheets.findRowByValue(ssId, AppConstants.sheetKpmRumahUsaha, 1, kpmId);
      if (houseRowIndex == -1) {
        await sheets.appendRow(ssId, AppConstants.sheetKpmRumahUsaha, profile.house.toSheetRow());
      } else {
        await sheets.updateRow(ssId, AppConstants.sheetKpmRumahUsaha, houseRowIndex, profile.house.toSheetRow());
      }

      // 3. Hapus Komponen Lama dan Tulis yang Baru
      // sheets_service tidak mendukung hapus bersyarat secara instan, kita cari satu per satu row lalu hapus
      bool componentsCleaned = false;
      while (!componentsCleaned) {
        final compRowIndex = await sheets.findRowByValue(ssId, AppConstants.sheetKpmKomponen, 1, kpmId);
        if (compRowIndex != -1) {
          await sheets.deleteRow(ssId, AppConstants.sheetKpmKomponen, compRowIndex);
        } else {
          componentsCleaned = true;
        }
      }

      // Append new components
      for (final comp in profile.komponenList) {
        await sheets.appendRow(ssId, AppConstants.sheetKpmKomponen, comp.toSheetRow());
      }

      await fetchKpmList(); // Refresh list KPM
      return true;
    } catch (e) {
      _errorMessage = 'Gagal menyimpan profil KPM: $e';
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Menghapus data KPM dari Google Sheets
  Future<bool> deleteKpmProfile(String kpmId) async {
    final sheets = _authProvider?.sheetsService;
    final ssId = _authProvider?.spreadsheetId;
    if (sheets == null || ssId == null) return false;

    _setLoading(true);
    _errorMessage = null;

    try {
      // 1. Hapus KPM Master
      final idxMaster = await sheets.findRowByValue(ssId, AppConstants.sheetKpmMaster, 0, kpmId);
      if (idxMaster != -1) {
        await sheets.deleteRow(ssId, AppConstants.sheetKpmMaster, idxMaster);
      }

      // 2. Hapus KPM Rumah Usaha
      final idxHouse = await sheets.findRowByValue(ssId, AppConstants.sheetKpmRumahUsaha, 1, kpmId);
      if (idxHouse != -1) {
        await sheets.deleteRow(ssId, AppConstants.sheetKpmRumahUsaha, idxHouse);
      }

      // 3. Hapus semua KPM Komponen
      bool componentsCleaned = false;
      while (!componentsCleaned) {
        final compRowIndex = await sheets.findRowByValue(ssId, AppConstants.sheetKpmKomponen, 1, kpmId);
        if (compRowIndex != -1) {
          await sheets.deleteRow(ssId, AppConstants.sheetKpmKomponen, compRowIndex);
        } else {
          componentsCleaned = true;
        }
      }

      await fetchKpmList(); // Refresh list KPM
      return true;
    } catch (e) {
      _errorMessage = 'Gagal menghapus KPM: $e';
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Mengunggah berkas gambar KPM ke Drive dan mengembalikan fileId
  Future<String> uploadKpmDocument(
    String kpmId,
    String fileType, // 'Wajah', 'Ktp', 'Kk', 'Tabungan', 'Kks', 'Usaha', 'Luar', 'Tamu', 'Mandi'
    List<int> bytes,
    String mimeType,
  ) async {
    final drive = _authProvider?.driveService;
    if (drive == null) throw Exception('DriveService belum siap');

    try {
      await _authProvider?.ensureFreshAuth();
      final folderId = await drive.getOrCreateFolder(AppConstants.driveFolderKpmDocs);
      final fileName = 'KPM_${kpmId}_${fileType}_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final fileId = await drive.uploadFile(
        folderId,
        fileName,
        bytes,
        mimeType,
        onAuthExpired: () async {
          await _authProvider?.ensureFreshAuth();
        },
      );
      await drive.setPublicAccess(fileId);
      return fileId;
    } catch (e) {
      throw Exception('Gagal mengunggah berkas KPM ($fileType): $e');
    }
  }

  /// Menyusun KPM terkelompokkan: { DesaKelurahan: { NamaKelompok: [ KpmCaretaker ] } }
  Map<String, Map<String, List<KpmCaretaker>>> getGroupedKpm() {
    final Map<String, Map<String, List<KpmCaretaker>>> grouped = {};

    for (final caretaker in _kpmList) {
      final desa = caretaker.desaKelurahan.isEmpty ? 'Belum Diatur' : caretaker.desaKelurahan;
      final kelompok = caretaker.namaKelompok.isEmpty ? 'Belum Diatur' : caretaker.namaKelompok;

      if (!grouped.containsKey(desa)) {
        grouped[desa] = {};
      }

      if (!grouped[desa]!.containsKey(kelompok)) {
        grouped[desa]![kelompok] = [];
      }

      grouped[desa]![kelompok]!.add(caretaker);
    }

    // Urutkan alfabetis berdasarkan desa
    final sortedKeys = grouped.keys.toList()..sort();
    final Map<String, Map<String, List<KpmCaretaker>>> sortedGrouped = {};
    for (var key in sortedKeys) {
      sortedGrouped[key] = grouped[key]!;
    }

    return sortedGrouped;
  }

  /// Mengambil data Ketua Kelompok dari daftar KPM untuk kelompok tertentu
  KpmCaretaker? getGroupKetua(String desa, String kelompok) {
    return _kpmList.firstWhere(
      (k) => k.desaKelurahan == desa && k.namaKelompok == kelompok && k.status == 'Ketua',
      orElse: () => _kpmList.firstWhere(
        (k) => k.desaKelurahan == desa && k.namaKelompok == kelompok,
        orElse: () => KpmCaretaker(
          kpmId: '',
          nik: '',
          noKk: '',
          nama: 'Tidak Ada Ketua',
          status: 'Anggota',
          namaKelompok: kelompok,
          pekerjaan: '',
          noHp: '-',
          provinsi: '',
          kabKota: '',
          kecamatan: '',
          desaKelurahan: desa,
          lingkungan: '',
          fotoWajah: '',
          fotoKtp: '',
          fotoKk: '',
          fotoBukuTabungan: '',
          fotoKks: '',
          tahunDapatBansos: '',
          createdAt: '',
        ),
      ),
    );
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }
}
