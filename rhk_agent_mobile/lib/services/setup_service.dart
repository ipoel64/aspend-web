import 'package:shared_preferences/shared_preferences.dart';

import '../config/constants.dart';
import 'drive_service.dart';
import 'sheets_service.dart';

class SetupService {
  final SheetsService _sheetsService;
  final DriveService _driveService;

  SetupService(this._sheetsService, this._driveService);

  Future<String> setupNewUser(String email) async {
    // 1. Create Spreadsheet
    final spreadsheetId = await _sheetsService.createSpreadsheet(
      AppConstants.spreadsheetTitle,
    );

    // 2. Add Sheets
    await _sheetsService.createSheet(spreadsheetId, AppConstants.sheetProfile);
    await _sheetsService.createSheet(
      spreadsheetId,
      AppConstants.sheetLaporanLog,
    );
    await _sheetsService.createSheet(spreadsheetId, AppConstants.sheetConfig);

    // 3. Write Headers
    await _sheetsService.writeHeaders(
      spreadsheetId,
      AppConstants.sheetProfile,
      [
        'Email',
        'Nama',
        'NIP',
        'Jabatan',
        'KabupatenKota',
        'SignatureFileId',
        'PhotoFileId',
        'LogoFileId',
      ],
    );


    await _sheetsService
        .writeHeaders(spreadsheetId, AppConstants.sheetLaporanLog, [
          'ReportId',
          'Tanggal',
          'JenisRHK',
          'IdRHK',
          'RencanaAksi',
          'Pukul',
          'PoinKegiatan',
          'NarasiAI',
          'NarasiEdited',
          'Status',
          'PdfFileId',
          'FotoIds',
          'P2K2Data',
          'PhysicalLokasi',
          'CreatedAt',
        ]);

    await _sheetsService.writeHeaders(spreadsheetId, AppConstants.sheetConfig, [
      'Key',
      'Value',
    ]);

    // 4. Initial Profile Row
    await _sheetsService.appendRow(spreadsheetId, AppConstants.sheetProfile, [
      email,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    // 5. Initial Config Rows
    await _sheetsService.appendRow(spreadsheetId, AppConstants.sheetConfig, [
      'AI_PROVIDER',
      'openrouter',
    ]);
    await _sheetsService.appendRow(spreadsheetId, AppConstants.sheetConfig, [
      'AI_API_KEY',
      AppConstants.defaultOpenRouterApiKey,
    ]);
    await _sheetsService.appendRow(spreadsheetId, AppConstants.sheetConfig, [
      'AI_MODEL',
      AppConstants.defaultOpenRouterModel,
    ]);
    await _sheetsService.appendRow(spreadsheetId, AppConstants.sheetConfig, [
      'ADMIN_WHATSAPP',
      '+6283162019160',
    ]);

    // 6. Create Drive Folders
    await _driveService.getOrCreateFolder(AppConstants.driveFolderOutput);
    await _driveService.getOrCreateFolder(AppConstants.driveFolderBukti);

    // Create KPM sheets
    await checkAndCreateKpmSheets(spreadsheetId);

    // Create Pengaduan and Nota Dinas sheets
    await checkAndCreatePengaduanAndNotaDinasSheets(spreadsheetId);

    // (Auto-share with admin removed per user request for 100% independence)


    // 8. Save to SharedPreferences
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('spreadsheetId_$email', spreadsheetId);

    return spreadsheetId;
  }

  Future<void> checkAndCreateKpmSheets(String spreadsheetId) async {
    try {
      // 1. Get spreadsheet metadata to list sheets
      final spreadsheet = await _sheetsService.api.spreadsheets.get(spreadsheetId);
      final existingSheetNames = spreadsheet.sheets?.map((s) => s.properties?.title).toList() ?? [];

      // 2. Define our KPM sheets and headers
      final Map<String, List<String>> kpmSheets = {
        AppConstants.sheetKpmMaster: [
          'KpmId',
          'Nik',
          'NoKk',
          'Nama',
          'Status',
          'NamaKelompok',
          'Pekerjaan',
          'NoHp',
          'Provinsi',
          'KabKota',
          'Kecamatan',
          'DesaKelurahan',
          'Lingkungan',
          'FotoWajah',
          'FotoKtp',
          'FotoKk',
          'FotoBukuTabungan',
          'FotoKks',
          'TahunDapatBansos',
          'CreatedAt'
        ],
        AppConstants.sheetKpmKomponen: [
          'KomponenId',
          'KpmId',
          'Nama',
          'JenisKelamin',
          'HubunganKeluarga',
          'JenisKomponen',
          'Kelas',
          'Posyandu',
          'CreatedAt'
        ],
        AppConstants.sheetKpmRumahUsaha: [
          'RumahId',
          'KpmId',
          'PunyaUsaha',
          'NamaUsaha',
          'FotoUsaha',
          'FotoRumahLuar',
          'FotoRumahTamu',
          'FotoKamarMandi',
          'Latitude',
          'Longitude',
          'Pernyataan',
          'BansosLain',
          'CreatedAt'
        ],
      };

      // 3. Create KPM Document Folder
      await _driveService.getOrCreateFolder(AppConstants.driveFolderKpmDocs);

      // 4. Create sheets and write headers if they don't exist
      for (var entry in kpmSheets.entries) {
        final sheetName = entry.key;
        final headers = entry.value;

        if (!existingSheetNames.contains(sheetName)) {
          await _sheetsService.createSheet(spreadsheetId, sheetName);
          await _sheetsService.writeHeaders(spreadsheetId, sheetName, headers);
        }
      }
    } catch (e) {
      print('Error checking/creating KPM sheets: $e');
    }
  }

  Future<void> checkAndCreatePengaduanAndNotaDinasSheets(String spreadsheetId) async {
    try {
      final spreadsheet = await _sheetsService.api.spreadsheets.get(spreadsheetId);
      final existingSheetNames = spreadsheet.sheets?.map((s) => s.properties?.title).toList() ?? [];

      final Map<String, List<String>> newSheets = {
        AppConstants.sheetPengaduan: [
          'PengaduanId',
          'Email',
          'Nik',
          'Nama',
          'Alamat',
          'DesaKelurahan',
          'Kecamatan',
          'KabKota',
          'Aduan',
          'HasilAnalisa',
          'Latitude',
          'Longitude',
          'FotoKtp',
          'ScreenshotSiks',
          'PdfFileId',
          'CreatedAt'
        ],
        AppConstants.sheetNotaDinas: [
          'NotaDinasId',
          'Email',
          'Nomor',
          'Yth',
          'Dari',
          'Hal',
          'Lampiran',
          'Sifat',
          'Tanggal',
          'PoinDraft',
          'IsiNotaDinas',
          'PdfFileId',
          'CreatedAt'
        ],
        AppConstants.sheetRiwayatPoin: [
          'IdRHK',
          'PoinText',
          'CreatedAt'
        ],
      };

      // Create Drive folders
      await _driveService.getOrCreateFolder(AppConstants.driveFolderPengaduan);
      await _driveService.getOrCreateFolder(AppConstants.driveFolderNotaDinas);

      for (var entry in newSheets.entries) {
        final sheetName = entry.key;
        final headers = entry.value;

        if (!existingSheetNames.contains(sheetName)) {
          await _sheetsService.createSheet(spreadsheetId, sheetName);
          await _sheetsService.writeHeaders(spreadsheetId, sheetName, headers);
        }
      }
    } catch (e) {
      print('Error checking/creating Pengaduan and Nota Dinas sheets: $e');
    }
  }

  Future<bool> isSetupComplete(String email) async {
    final spreadsheetId = await getSpreadsheetId(email);
    return spreadsheetId != null;
  }

  Future<String?> getSpreadsheetId(String email) async {
    final prefs = await SharedPreferences.getInstance();
    final storedId = prefs.getString('spreadsheetId_$email');
    if (storedId != null && storedId.isNotEmpty) {
      return storedId;
    }

    final foundId = await _lookupSpreadsheetIdByEmail(email);
    if (foundId != null) {
      await prefs.setString('spreadsheetId_$email', foundId);
    }
    return foundId;
  }

  Future<String?> _lookupSpreadsheetIdByEmail(String email) async {
    final spreadsheetId = await _driveService.findSpreadsheetByTitle(
      AppConstants.spreadsheetTitle,
    );
    if (spreadsheetId == null) return null;

    try {
      final rows = await _sheetsService.getAllRows(
        spreadsheetId,
        AppConstants.sheetProfile,
      );
      if (rows.isNotEmpty &&
          rows.first.isNotEmpty &&
          rows.first[0].toString() == email) {
        return spreadsheetId;
      }
    } catch (_) {
      // If the lookup fails, fall back to creating a new sheet later.
    }
    return null;
  }
}
