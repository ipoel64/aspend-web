import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:googleapis/drive/v3.dart' as drive;
import 'package:googleapis/sheets/v4.dart' as sheets;
import 'package:shared_preferences/shared_preferences.dart';

import '../config/constants.dart';
import '../models/user_profile.dart';
import '../services/auth_service.dart';
import '../services/drive_service.dart';
import '../services/setup_service.dart';
import '../services/sheets_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  SheetsService? _sheetsService;
  DriveService? _driveService;
  SetupService? _setupService;

  bool _isLoading = false;
  String? _errorMessage;
  UserProfile? _userProfile;
  String? _spreadsheetId;
  bool _isProfileComplete = false;
  Uint8List? _signatureBytes;

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isSignedIn => _authService.currentUser != null;
  GoogleSignInAccount? get currentUser => _authService.currentUser;
  UserProfile? get userProfile => _userProfile;
  Uint8List? get signatureBytes => _signatureBytes;
  String? get spreadsheetId => _spreadsheetId;
  SheetsService? get sheetsService => _sheetsService;
  DriveService? get driveService => _driveService;
  bool get isProfileComplete => _isProfileComplete;
  AuthService get authService => _authService;

  Future<Map<String, dynamic>> getOAuthCredentials({bool forceRefresh = false, bool needServerAuthCode = false}) async {
    return await _authService.getOAuthCredentials(forceRefresh: forceRefresh, needServerAuthCode: needServerAuthCode);
  }

  static const String _prefPermanentLogin = 'user_has_logged_in_permanently';
  static const String _prefPermanentSpreadsheetId = 'cached_spreadsheet_id_permanent';

  Future<bool> tryAutoSignIn() async {
    _setLoading(true);
    final prefs = await SharedPreferences.getInstance();
    final wasLoggedIn = prefs.getBool(_prefPermanentLogin) ?? false;

    // Jika sebelumnya user sudah login, pulihkan ID spreadsheet dan profil lokal
    if (wasLoggedIn) {
      _spreadsheetId = prefs.getString(_prefPermanentSpreadsheetId);
      await loadProfile();
    }

    try {
      final account = await _authService.signInSilently();
      if (account != null) {
        // Force refresh native token if expired before initializing services
        await account.authentication;
        await _initializeServices();
        _setLoading(false);
        return true;
      }
    } catch (e) {
      debugPrint('Auto sign in silent refresh warning: $e');
    }

    // Jika user pernah login secara sah, sesi tetap aktif selamanya (tidak pernah auto-logout)
    if (wasLoggedIn) {
      try {
        final client = await _authService.getAuthClient(forceRefresh: false);
        if (client != null) {
          _sheetsService = SheetsService(sheets.SheetsApi(client));
          _driveService = DriveService(drive.DriveApi(client));
          _setupService = SetupService(_sheetsService!, _driveService!);
        }
      } catch (err) {
        debugPrint('Fallback initializeServices error: $err');
      }
      _setLoading(false);
      return true;
    }

    _setLoading(false);
    return false;
  }

  Future<bool> signIn() async {
    _setLoading(true);
    _errorMessage = null;

    try {
      final account = await _authService.signIn();
      if (account != null) {
        await _initializeServices();
        _setLoading(false);
        return true;
      } else {
        _errorMessage = 'Login dibatalkan';
      }
    } catch (e) {
      if (e is SocketException || e.toString().contains('SocketException') || e.toString().contains('Network') || e.toString().contains('Failed host lookup')) {
        _errorMessage = 'Koneksi Gagal: Perangkat Anda tidak terhubung ke internet. Pastikan koneksi Wi-Fi atau paket data aktif lalu coba lagi.';
      } else {
        _errorMessage = 'Gagal login: $e';
      }
    }

    _setLoading(false);
    return false;
  }

  Future<bool> refreshSession() async {
    try {
      final client = await _authService.getAuthClient(forceRefresh: true);
      if (client != null) {
        _sheetsService = SheetsService(sheets.SheetsApi(client));
        _driveService = DriveService(drive.DriveApi(client));
        _setupService = SetupService(_sheetsService!, _driveService!);
        return true;
      }
    } catch (e) {
      debugPrint('Failed to refresh session: $e');
    }
    return false;
  }

  /// Memastikan token Google Auth selalu segar sebelum operasi API penting (mencegah invalid_token)
  Future<bool> ensureFreshAuth({bool forceRefresh = false}) async {
    try {
      final client = await _authService.getAuthClient(forceRefresh: forceRefresh);
      if (client != null) {
        _sheetsService = SheetsService(sheets.SheetsApi(client));
        _driveService = DriveService(drive.DriveApi(client));
        if (_setupService != null) {
          _setupService = SetupService(_sheetsService!, _driveService!);
        }
        return true;
      }
    } catch (e) {
      debugPrint('ensureFreshAuth warning: $e');
    }
    return false;
  }

  Future<void> signOut() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefPermanentLogin, false);
      await prefs.remove(_prefPermanentSpreadsheetId);
      await prefs.remove('cached_user_profile_');
      final email = currentUser?.email ?? '';
      if (email.isNotEmpty) {
        await prefs.remove('cached_user_profile_$email');
      }
    } catch (_) {}

    await _authService.signOut();
    _sheetsService = null;
    _driveService = null;
    _setupService = null;
    _userProfile = null;
    _spreadsheetId = null;
    _signatureBytes = null;
    notifyListeners();
  }

  Future<void> _initializeServices() async {
    final client = await _authService.getAuthClient();
    if (client == null) throw Exception('Gagal mendapatkan AuthClient');

    _sheetsService = SheetsService(sheets.SheetsApi(client));
    _driveService = DriveService(drive.DriveApi(client));
    _setupService = SetupService(_sheetsService!, _driveService!);

    // Check if setup complete
    final currentEmail = _authService.currentUser!.email;
    final isSetup = await _setupService!.isSetupComplete(currentEmail);
    if (!isSetup) {
      _spreadsheetId = await _setupService!.setupNewUser(currentEmail);
    } else {
      _spreadsheetId = await _setupService!.getSpreadsheetId(currentEmail);
      if (_spreadsheetId != null) {
        await _setupService!.checkAndCreateKpmSheets(_spreadsheetId!);
        await _setupService!.checkAndCreatePengaduanAndNotaDinasSheets(_spreadsheetId!);
        await _setupService!.checkAndCreateWebSessionsSheet(_spreadsheetId!);
      }
    }

    if (_spreadsheetId == null) {
      throw Exception('Gagal mendapatkan Spreadsheet ID');
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefPermanentLogin, true);
      await prefs.setString(_prefPermanentSpreadsheetId, _spreadsheetId!);
    } catch (_) {}

    await loadProfile();


    await checkProfileComplete();
    await syncRiwayatPoin();
  }

  Future<void> loadProfile() async {
    final currentEmail = currentUser?.email ?? '';
    final cacheKey = 'cached_user_profile_${currentEmail.isNotEmpty ? currentEmail : "default"}';
    
    // 1. Immediately load from SharedPreferences if available
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedStr = prefs.getString(cacheKey) ?? prefs.getString('cached_user_profile_');
      if (cachedStr != null && cachedStr.isNotEmpty) {
        final data = jsonDecode(cachedStr);
        _userProfile = UserProfile.fromJson(data);
        notifyListeners();
        checkProfileComplete();
      }
    } catch (e) {
      debugPrint('Error reading cached user profile: $e');
    }

    if (_sheetsService == null || _spreadsheetId == null) return;

    try {
      final rows = await _sheetsService!.getAllRows(
        _spreadsheetId!,
        AppConstants.sheetProfile,
      );
      if (rows.isNotEmpty) {
        final fromSheet = UserProfile.fromSheetRow(rows[0]);
        _userProfile = UserProfile(
          email: fromSheet.email.isNotEmpty ? fromSheet.email : currentEmail,
          nama: fromSheet.nama.isNotEmpty ? fromSheet.nama : (_userProfile?.nama ?? ''),
          nip: fromSheet.nip.isNotEmpty ? fromSheet.nip : (_userProfile?.nip ?? ''),
          jabatan: fromSheet.jabatan.isNotEmpty ? fromSheet.jabatan : (_userProfile?.jabatan ?? 'Pendamping PKH'),
          kabupatenKota: fromSheet.kabupatenKota.isNotEmpty ? fromSheet.kabupatenKota : (_userProfile?.kabupatenKota ?? ''),
          signatureFileId: fromSheet.signatureFileId.isNotEmpty ? fromSheet.signatureFileId : (_userProfile?.signatureFileId ?? ''),
          photoFileId: fromSheet.photoFileId.isNotEmpty ? fromSheet.photoFileId : (_userProfile?.photoFileId ?? ''),
          logoFileId: fromSheet.logoFileId.isNotEmpty ? fromSheet.logoFileId : (_userProfile?.logoFileId ?? ''),
          jenisSdm: fromSheet.jenisSdm.isNotEmpty ? fromSheet.jenisSdm : (_userProfile?.jenisSdm ?? 'SDM PKH'),
          provinsi: fromSheet.provinsi.isNotEmpty ? fromSheet.provinsi : (_userProfile?.provinsi ?? ''),
          kecamatan: fromSheet.kecamatan.isNotEmpty ? fromSheet.kecamatan : (_userProfile?.kecamatan ?? ''),
          jabatanAsn: fromSheet.jabatanAsn.isNotEmpty ? fromSheet.jabatanAsn : (_userProfile?.jabatanAsn ?? ''),
        );

        try {
          final prefs = await SharedPreferences.getInstance();
          final jsonStr = jsonEncode(_userProfile!.toJson());
          await prefs.setString(cacheKey, jsonStr);
          await prefs.setString('cached_user_profile_', jsonStr);
        } catch (_) {}

        if (_userProfile!.signatureFileId.isNotEmpty && _driveService != null && _signatureBytes == null) {
          try {
            final sig = await _driveService!.downloadFile(_userProfile!.signatureFileId);
            if (sig != null) {
              _signatureBytes = Uint8List.fromList(sig);
            }
          } catch (e) {
            debugPrint('Error caching signature in loadProfile: $e');
          }
        }

        await checkProfileComplete();
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = 'Gagal memuat profil: $e';
      notifyListeners();
    }
  }

  Future<void> updateProfile({
    required String nama,
    required String nip,
    required String jabatan,
    required String kabupatenKota,
    String? jenisSdm,
    String? provinsi,
    String? kecamatan,
    String? jabatanAsn,
  }) async {
    final currentEmail = currentUser?.email ?? '';
    final cacheKey = 'cached_user_profile_${currentEmail.isNotEmpty ? currentEmail : "default"}';

    final base = _userProfile ?? UserProfile(
      email: currentEmail,
      nama: nama,
      nip: nip,
      jabatan: jabatan,
      kabupatenKota: kabupatenKota,
      signatureFileId: '',
      photoFileId: '',
      logoFileId: '',
      jenisSdm: jenisSdm ?? 'SDM PKH',
      provinsi: provinsi ?? '',
      kecamatan: kecamatan ?? '',
      jabatanAsn: jabatanAsn ?? '',
    );

    final updated = base.copyWith(
      nama: nama,
      nip: nip,
      jabatan: jabatan,
      kabupatenKota: kabupatenKota,
      jenisSdm: jenisSdm ?? (base.jenisSdm.isNotEmpty ? base.jenisSdm : 'SDM PKH'),
      provinsi: provinsi ?? base.provinsi,
      kecamatan: kecamatan ?? base.kecamatan,
      jabatanAsn: jabatanAsn ?? base.jabatanAsn,
    );

    _userProfile = updated;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = jsonEncode(updated.toJson());
      await prefs.setString(cacheKey, jsonStr);
      await prefs.setString('cached_user_profile_', jsonStr);
    } catch (e) {
      debugPrint('Error caching profile to prefs: $e');
    }

    if (_sheetsService != null && _spreadsheetId != null) {
      try {
        await _sheetsService!.updateRow(
          _spreadsheetId!,
          AppConstants.sheetProfile,
          2,
          updated.toSheetRow(),
        );
      } catch (e) {
        debugPrint('Error updating sheet profile: $e');
        throw Exception('Gagal mengupdate profil di Google Sheets: $e');
      }
    }

    await checkProfileComplete();
  }

  Future<void> uploadProfilePhoto(List<int> bytes, String mimeType) async {
    if (_driveService == null ||
        _sheetsService == null ||
        _spreadsheetId == null)
      return;

    try {
      final folderId = await _driveService!.getOrCreateFolder(
        AppConstants.driveFolderOutput,
      );
      final fileName = 'Profile_${currentUser?.email ?? 'User'}.jpg';

      final fileId = await _driveService!.uploadFile(
        folderId,
        fileName,
        bytes,
        mimeType,
      );
      await _driveService!.setPublicAccess(fileId);

      // Update sheet safely without force-unwrapping _userProfile
      final currentEmail = currentUser?.email ?? '';
      final base = _userProfile ?? UserProfile(
        email: currentEmail,
        nama: currentUser?.displayName ?? '',
        nip: '',
        jabatan: 'Pendamping PKH',
        kabupatenKota: '',
        signatureFileId: '',
        photoFileId: fileId,
        logoFileId: '',
        jenisSdm: 'SDM PKH',
        provinsi: '',
        kecamatan: '',
      );
      final updated = base.copyWith(photoFileId: fileId);
      await _sheetsService!.updateRow(
        _spreadsheetId!,
        AppConstants.sheetProfile,
        2,
        updated.toSheetRow(),
      );
      _userProfile = updated;
      try {
        final prefs = await SharedPreferences.getInstance();
        final cacheKey = 'cached_user_profile_${currentEmail.isNotEmpty ? currentEmail : "default"}';
        final jsonStr = jsonEncode(updated.toJson());
        await prefs.setString(cacheKey, jsonStr);
        await prefs.setString('cached_user_profile_', jsonStr);
      } catch (_) {}
      notifyListeners();
    } catch (e) {
      throw Exception('Gagal upload foto: $e');
    }
  }

  Future<void> uploadSignature(List<int> bytes, String mimeType) async {
    if (_driveService == null ||
        _sheetsService == null ||
        _spreadsheetId == null)
      return;

    try {
      final folderId = await _driveService!.getOrCreateFolder(
        AppConstants.driveFolderOutput,
      );
      final fileName = 'Signature_${currentUser?.email ?? 'User'}.png';

      final fileId = await _driveService!.uploadFile(
        folderId,
        fileName,
        bytes,
        mimeType,
      );
      await _driveService!.setPublicAccess(fileId);

      // Update sheet safely without force-unwrapping _userProfile
      final currentEmail = currentUser?.email ?? '';
      final base = _userProfile ?? UserProfile(
        email: currentEmail,
        nama: currentUser?.displayName ?? '',
        nip: '',
        jabatan: 'Pendamping PKH',
        kabupatenKota: '',
        signatureFileId: fileId,
        photoFileId: '',
        logoFileId: '',
        jenisSdm: 'SDM PKH',
        provinsi: '',
        kecamatan: '',
      );
      final updated = base.copyWith(signatureFileId: fileId);
      await _sheetsService!.updateRow(
        _spreadsheetId!,
        AppConstants.sheetProfile,
        2,
        updated.toSheetRow(),
      );
      _userProfile = updated;
      _signatureBytes = Uint8List.fromList(bytes);
      try {
        final prefs = await SharedPreferences.getInstance();
        final cacheKey = 'cached_user_profile_${currentEmail.isNotEmpty ? currentEmail : "default"}';
        final jsonStr = jsonEncode(updated.toJson());
        await prefs.setString(cacheKey, jsonStr);
        await prefs.setString('cached_user_profile_', jsonStr);
      } catch (_) {}
      await checkProfileComplete();
    } catch (e) {
      throw Exception('Gagal upload tanda tangan: $e');
    }
  }

  Future<void> uploadKopLogo(List<int> bytes, String mimeType) async {
    if (_driveService == null ||
        _sheetsService == null ||
        _spreadsheetId == null)
      return;

    try {
      final folderId = await _driveService!.getOrCreateFolder(
        AppConstants.driveFolderOutput,
      );
      final fileName = 'KopLogo_${currentUser?.email ?? 'User'}.png';

      final fileId = await _driveService!.uploadFile(
        folderId,
        fileName,
        bytes,
        mimeType,
      );
      await _driveService!.setPublicAccess(fileId);

      // Update sheet safely without force-unwrapping _userProfile
      final currentEmail = currentUser?.email ?? '';
      final base = _userProfile ?? UserProfile(
        email: currentEmail,
        nama: currentUser?.displayName ?? '',
        nip: '',
        jabatan: 'Pendamping PKH',
        kabupatenKota: '',
        signatureFileId: '',
        photoFileId: '',
        logoFileId: fileId,
        jenisSdm: 'SDM PKH',
        provinsi: '',
        kecamatan: '',
      );
      final updated = base.copyWith(logoFileId: fileId);
      await _sheetsService!.updateRow(
        _spreadsheetId!,
        AppConstants.sheetProfile,
        2,
        updated.toSheetRow(),
      );
      _userProfile = updated;
      try {
        final prefs = await SharedPreferences.getInstance();
        final cacheKey = 'cached_user_profile_${currentEmail.isNotEmpty ? currentEmail : "default"}';
        final jsonStr = jsonEncode(updated.toJson());
        await prefs.setString(cacheKey, jsonStr);
        await prefs.setString('cached_user_profile_', jsonStr);
      } catch (_) {}
      notifyListeners();
    } catch (e) {
      throw Exception('Gagal upload logo Kop: $e');
    }
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  Future<bool> checkProfileComplete() async {
    if (_userProfile == null) {
      _isProfileComplete = false;
      notifyListeners();
      return false;
    }
    
    // 1. Check text fields & signature
    final isTksk = _userProfile!.jenisSdm == 'TKSK';
    final baseComplete = _userProfile!.nama.trim().isNotEmpty &&
        _userProfile!.nip.trim().isNotEmpty &&
        (isTksk || _userProfile!.jabatan.trim().isNotEmpty) &&
        _userProfile!.kabupatenKota.trim().isNotEmpty &&
        _userProfile!.jenisSdm.trim().isNotEmpty &&
        _userProfile!.signatureFileId.trim().isNotEmpty;
        
    if (!baseComplete) {
      _isProfileComplete = false;
      notifyListeners();
      return false;
    }

    // 3. Connection Test is no longer mandatory for profile completeness
    _isProfileComplete = true;
    notifyListeners();
    return _isProfileComplete;
  }

  Future<void> syncRiwayatPoin() async {
    if (_sheetsService == null || _spreadsheetId == null) return;
    try {
      final rows = await _sheetsService!.getAllRows(
        _spreadsheetId!,
        AppConstants.sheetRiwayatPoin,
      );
      
      Map<String, List<String>> historyMap = {};
      
      for (var row in rows) {
        if (row.length >= 2) {
          final idRhk = row[0].toString();
          final text = row[1].toString();
          if (idRhk.isNotEmpty && text.isNotEmpty) {
            historyMap.putIfAbsent(idRhk, () => []);
            historyMap[idRhk]!.add(text);
          }
        }
      }
      
      final prefs = await SharedPreferences.getInstance();
      for (var entry in historyMap.entries) {
        final idRhk = entry.key;
        // Make unique, keeping the order
        final texts = entry.value.toSet().toList(); 
        // Reverse so the bottom rows (newest) appear at the top, take max 10
        final reversedTexts = texts.reversed.take(10).toList();
        await prefs.setStringList('poin_history_$idRhk', reversedTexts);
      }
    } catch (e) {
      debugPrint('Error syncing riwayat poin: $e');
    }
  }
}



