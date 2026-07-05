/// Konstanta Aplikasi
class AppConstants {
  // Google Sheets
  static const String spreadsheetTitle = 'Aspend Database';
  static const String sheetProfile = 'Profile';
  static const String sheetLaporanLog = 'Laporan_Log';
  static const String sheetConfig = 'Config';
  static const String sheetKpmMaster = 'KPM_Master';
  static const String sheetKpmKomponen = 'KPM_Komponen';
  static const String sheetKpmRumahUsaha = 'KPM_RumahUsaha';
  static const String sheetPengaduan = 'Pengaduan';
  static const String sheetNotaDinas = 'Nota_Dinas';
  static const String sheetRiwayatPoin = 'Riwayat_Poin';

  // Google Drive
  static const String driveFolderOutput = 'Aspend_Output';
  static const String driveFolderBukti = 'Aspend_Bukti_Dukung';
  static const String driveFolderKpmDocs = 'Aspend_KPM_Dokumen';
  static const String driveFolderPengaduan = 'Aspend_Pengaduan';
  static const String driveFolderNotaDinas = 'Aspend_NotaDinas';

  // AI Default Configuration
  static const String defaultAiProvider = 'openrouter';
  static const String defaultAiApiKey = '[REDACTED_API_KEY]'; // Default locked key
  static const String defaultGroqModel = 'llama-3.3-70b-versatile';
  static const String defaultOpenRouterModel = 'google/gemini-3.5-flash';
  static const String defaultOpenRouterApiKey = '[REDACTED_API_KEY]';

  // App Meta
  static const String appVersion = '1.0.0';

  AppConstants._();
}
