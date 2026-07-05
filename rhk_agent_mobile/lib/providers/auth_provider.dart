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

  Future<bool> tryAutoSignIn() async {
    _setLoading(true);
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
      debugPrint('Auto sign in error: $e');
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
      final account = await _authService.signInSilently();
      if (account != null) {
        // Accessing authentication forces native token refresh if expired
        await account.authentication;
        await _initializeServices();
        return true;
      }
    } catch (e) {
      debugPrint('Failed to refresh session: $e');
    }
    return false;
  }

  Future<void> signOut() async {
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
      }
    }

    if (_spreadsheetId == null) {
      throw Exception('Gagal mendapatkan Spreadsheet ID');
    }

    await loadProfile();

    // Fetch and cache the AI API Key locally for fast offline check completeness
    try {
      final configRows = await _sheetsService!.getAllRows(_spreadsheetId!, 'Config');
      String apiKey = '';
      for (var row in configRows) {
        if (row.isNotEmpty && row[0] == 'AI_API_KEY' && row.length > 1) {
          apiKey = row[1].toString();
        }
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('ai_api_key_${currentUser!.email}', apiKey);
    } catch (e) {
      debugPrint('Error caching AI API Key during init: $e');
    }

    await checkProfileComplete();
    await syncRiwayatPoin();
  }

  Future<void> loadProfile() async {
    if (_sheetsService == null || _spreadsheetId == null) return;

    try {
      final rows = await _sheetsService!.getAllRows(
        _spreadsheetId!,
        AppConstants.sheetProfile,
      );
      if (rows.isNotEmpty) {
        _userProfile = UserProfile.fromSheetRow(rows[0]);
        
        // Cache signature bytes if file ID is present
        if (_userProfile!.signatureFileId.isNotEmpty && _driveService != null) {
          try {
            final sig = await _driveService!.downloadFile(_userProfile!.signatureFileId);
            if (sig != null) {
              _signatureBytes = Uint8List.fromList(sig);
            }
          } catch (e) {
            debugPrint('Error caching signature in loadProfile: $e');
          }
        }
        
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
  }) async {
    if (_sheetsService == null ||
        _spreadsheetId == null ||
        _userProfile == null)
      return;

    final updated = _userProfile!.copyWith(
      nama: nama,
      nip: nip,
      jabatan: jabatan,
      kabupatenKota: kabupatenKota,
    );

    try {
      await _sheetsService!.updateRow(
        _spreadsheetId!,
        AppConstants.sheetProfile,
        2, // Row 2, since Row 1 is header
        updated.toSheetRow(),
      );
      _userProfile = updated;
      await checkProfileComplete();
    } catch (e) {
      throw Exception('Gagal mengupdate profil: $e');
    }
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

      // Update sheet
      final updated = _userProfile!.copyWith(photoFileId: fileId);
      await _sheetsService!.updateRow(
        _spreadsheetId!,
        AppConstants.sheetProfile,
        2,
        updated.toSheetRow(),
      );
      _userProfile = updated;
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

      // Update sheet
      final updated = _userProfile!.copyWith(signatureFileId: fileId);
      await _sheetsService!.updateRow(
        _spreadsheetId!,
        AppConstants.sheetProfile,
        2,
        updated.toSheetRow(),
      );
      _userProfile = updated;
      _signatureBytes = Uint8List.fromList(bytes);
      await checkProfileComplete();
    } catch (e) {
      throw Exception('Gagal upload tanda tangan: $e');
    }
  }

  Future<void> uploadKopLogo(List<int> bytes, String mimeType) async {
    if (_driveService == null ||
        _sheetsService == null ||
        _spreadsheetId == null ||
        _userProfile == null)
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

      // Update sheet
      final updated = _userProfile!.copyWith(logoFileId: fileId);
      await _sheetsService!.updateRow(
        _spreadsheetId!,
        AppConstants.sheetProfile,
        2,
        updated.toSheetRow(),
      );
      _userProfile = updated;
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
    final baseComplete = _userProfile!.nama.trim().isNotEmpty &&
        _userProfile!.nip.trim().isNotEmpty &&
        _userProfile!.jabatan.trim().isNotEmpty &&
        _userProfile!.kabupatenKota.trim().isNotEmpty &&
        _userProfile!.signatureFileId.trim().isNotEmpty;
        
    if (!baseComplete) {
      _isProfileComplete = false;
      notifyListeners();
      return false;
    }

    // 2. Check and auto-initialize AI API Key in local SharedPreferences cache
    final prefs = await SharedPreferences.getInstance();
    String apiKey = prefs.getString('ai_api_key_${currentUser!.email}') ?? '';
    
    if (apiKey.trim().isEmpty) {
      apiKey = AppConstants.defaultOpenRouterApiKey;
      await prefs.setString('ai_api_key_${currentUser!.email}', apiKey);
      await prefs.setString('ai_provider_${currentUser!.email}', 'openrouter');
      await prefs.setString('ai_model_${currentUser!.email}', AppConstants.defaultOpenRouterModel);
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
