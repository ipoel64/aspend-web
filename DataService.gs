/**
 * ==========================================
 * DataService.gs - Lapisan Basis Data
 * ==========================================
 * Mengelola semua operasi data menggunakan Google Sheets
 * sebagai database backend untuk aplikasi RHK-agent.
 * 
 * Struktur Sheet:
 * - Users: Data profil pengguna
 * - Master_RHK: Data master Rencana Hasil Kerja
 * - Master_P2K2: Data master modul & sesi P2K2
 * - Laporan_Log: Log laporan yang dibuat pengguna
 * - Config: Konfigurasi aplikasi
 */

// ============================================
// FUNGSI AKSES SPREADSHEET
// ============================================

/**
 * Mengambil objek Spreadsheet berdasarkan ID dari Script Properties
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} Objek spreadsheet
 */
function getSpreadsheet() {
  try {
    var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!ssId) {
      throw new Error('SPREADSHEET_ID belum diatur di Script Properties.');
    }
    return SpreadsheetApp.openById(ssId);
  } catch (e) {
    Logger.log('Error mengambil spreadsheet: ' + e.message);
    throw new Error('Gagal mengakses database. Pastikan SPREADSHEET_ID sudah benar.');
  }
}

/**
 * Mengambil sheet berdasarkan nama, buat baru jika belum ada
 * @param {string} sheetName - Nama sheet yang dicari
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Objek sheet
 */
function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    Logger.log('Sheet baru dibuat: ' + sheetName);
  }
  return sheet;
}

// ============================================
// INISIALISASI DATABASE
// ============================================

/**
 * Membuat semua sheet dengan header jika belum ada,
 * mengisi data master, dan menetapkan pengguna pertama sebagai admin
 */
function setupDatabase(clientEmail) {
  try {
    // Definisi header untuk setiap sheet
    var sheetHeaders = {
      'Users': ['Email', 'Nama', 'NIP', 'Jabatan', 'KabupatenKota', 'SignatureFileId', 'PhotoFileId', 'IsAdmin', 'CreatedAt'],
      'Master_RHK': ['ID', 'JENIS_RHK', 'RENCANA_AKSI'],
      'Master_P2K2': ['ID', 'MODUL', 'SESI'],
      'Laporan_Log': ['ReportId', 'Email', 'Tanggal', 'JenisRHK', 'IdRHK', 'RencanaAksi', 'Lokasi', 'PoinKegiatan', 'NarasiAI', 'NarasiEdited', 'Status', 'PdfUrl', 'PdfFileId', 'FotoIds', 'P2K2Data', 'ThumbnailId', 'CreatedAt'],
      'Config': ['Key', 'Value'],
      'KPM_Master': ['KpmId', 'Nik', 'NoKk', 'Nama', 'Status', 'NamaKelompok', 'Pekerjaan', 'NoHp', 'Provinsi', 'KabKota', 'Kecamatan', 'DesaKelurahan', 'Lingkungan', 'FotoWajah', 'FotoKtp', 'FotoKk', 'FotoBukuTabungan', 'FotoKks', 'TahunDapatBansos', 'CreatedAt'],
      'KPM_Komponen': ['KomponenId', 'KpmId', 'Nama', 'JenisKelamin', 'HubunganKeluarga', 'JenisKomponen', 'Kelas', 'Posyandu', 'CreatedAt'],
      'KPM_RumahUsaha': ['RumahId', 'KpmId', 'PunyaUsaha', 'NamaUsaha', 'FotoUsaha', 'FotoRumahLuar', 'FotoRumahTamu', 'FotoKamarMandi', 'Latitude', 'Longitude', 'Pernyataan', 'BansosLain', 'CreatedAt'],
      'Pengaduan': ['Id', 'Email', 'Nik', 'Nama', 'Alamat', 'DesaKelurahan', 'Kecamatan', 'KabKota', 'Aduan', 'HasilAnalisa', 'Latitude', 'Longitude', 'FotoKtp', 'ScreenshotSiks', 'PdfFileId', 'CreatedAt'],
      'Nota_Dinas': ['Id', 'Email', 'Nomor', 'Yth', 'Dari', 'Hal', 'Lampiran', 'Sifat', 'Tanggal', 'PoinDraft', 'IsiNotaDinas', 'PdfFileId', 'CreatedAt', 'BuktiDukung']
    };

    var ss = getSpreadsheet();

    // Buat setiap sheet dan tambahkan header jika belum ada
    for (var sheetName in sheetHeaders) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        // Tulis header di baris pertama
        sheet.getRange(1, 1, 1, sheetHeaders[sheetName].length).setValues([sheetHeaders[sheetName]]);
        // Format header: bold dan background warna
        sheet.getRange(1, 1, 1, sheetHeaders[sheetName].length)
          .setFontWeight('bold')
          .setBackground('#4285F4')
          .setFontColor('#FFFFFF');
        // Bekukan baris pertama
        sheet.setFrozenRows(1);
        Logger.log('Sheet dibuat dengan header: ' + sheetName);
      }
    }

    // Isi data master RHK dan P2K2
    initializeMasterRHK();
    initializeMasterP2K2();

    // Tetapkan pengguna pertama (yang menjalankan setup) sebagai admin
    var usersSheet = getSheet('Users');
    var email = clientEmail || Session.getActiveUser().getEmail();
    if (usersSheet.getLastRow() <= 1) {
      // Belum ada pengguna, tambahkan sebagai admin
      usersSheet.appendRow([email, '', '', '', '', '', '', true, new Date().toISOString()]);
      Logger.log('Admin pertama ditambahkan: ' + email);
    }

    Logger.log('Setup database selesai.');
    return { success: true, message: 'Database berhasil diinisialisasi.' };
  } catch (e) {
    Logger.log('Error setup database: ' + e.message);
    return { success: false, message: 'Gagal setup database: ' + e.message };
  }
}

/**
 * Mengisi sheet Master_RHK dengan data master Rencana Hasil Kerja
 * Hanya diisi jika sheet masih kosong (hanya ada header)
 */
function initializeMasterRHK() {
  var sheet = getSheet('Master_RHK');
  // Jika sudah ada data selain header, lewati
  if (sheet.getLastRow() > 1) {
    Logger.log('Master_RHK sudah memiliki data, lewati inisialisasi.');
    return;
  }

  var data = [
    ['RHK-1', 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', 'Melaksanakan supervisi Kebijakan Bantuan Sosial Kepada ASN PPPK'],
    ['RHK-1', 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', 'Melakukan edukasi dan sosialisasi pencairan secara tunai dan non tunai'],
    ['RHK-1', 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', 'Melaksanakan Supervisi Permasalahan Bantuan Sosial'],
    ['RHK-1', 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', 'Melaksanakan Monitoring/Pemantauan Penyaluran Bantuan Sosial'],
    ['RHK-1', 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', 'Melaksanakan Penelitian penyaluran bantuan Sosial'],
    ['RHK-2', 'Terlaksananya pertemuan P2K2 sesuai dengan ketentuan', 'Melaksanakan Pertemuan Peningkatan Kemampuan Keluarga (P2K2)'],
    ['RHK-2', 'Terlaksananya pertemuan P2K2 sesuai dengan ketentuan', 'Melakukan Supervisi pelaksanaan P2K2 kepada ASN PPPK'],
    ['RHK-3', 'Terlaksananya Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial secara akurat sesuai dengan ketentuan', 'Melaksanakan Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial'],
    ['RHK-3', 'Terlaksananya Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial secara akurat sesuai dengan ketentuan', 'Melakukan pendampingan, mediasi, dan fasilitasi kepada KPM PKH dalam proses perubahan perilaku, pola pikir yang mandiri dan produktif'],
    ['RHK-3', 'Terlaksananya Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial secara akurat sesuai dengan ketentuan', 'Melaksanakan supervisi Verifikasi Komitmen Kepada ASN PPPK'],
    ['RHK-4', 'Tersedianya Data KPM graduasi yang disusun sesuai dengan instrumen dan ketentuan', 'Melakukan usulan KPM Graduasi mandiri dan Pemberdayaan PPSE'],
    ['RHK-4', 'Tersedianya Data KPM graduasi yang disusun sesuai dengan instrumen dan ketentuan', 'Melaksanakan supervisi Graduasi Kepada ASN PPPK'],
    ['RHK-5', 'Terlaksananya Verifikasi, Validasi dan Permutakhiran Data KPM secara akurat sesuai dengan ketentuan', 'Melaksanakan Pemutakhiran Data'],
    ['RHK-5', 'Terlaksananya Verifikasi, Validasi dan Permutakhiran Data KPM secara akurat sesuai dengan ketentuan', 'Melaksanakan proses bisnis PKH yang meliputi verifikasi validasi calon penerima bantuan sosial'],
    ['RHK-5', 'Terlaksananya Verifikasi, Validasi dan Permutakhiran Data KPM secara akurat sesuai dengan ketentuan', 'Melaksanakan supervisi Verifikasi, Validasi dan pemutakhiran Kepada ASN PPPK'],
    ['RHK-6', 'Terlaksananya kegiatan kasus adaptif (Respon kasus/pengaduan/kebencanaan/kerentanan) disusun secara lengkap dan akurat', 'Melaksanakan Respon Kasus/Pengaduan/kebencanaan/Kerentanan'],
    ['RHK-7', 'Tersedianya Data Analisis Laporan Bulanan yang disusun sesuai dengan Ketentuan', 'Membuat laporan bulanan pelaksanaan PKH dan laporan lainnya.'],
    ['RHK-8', 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', 'Melaksanakan Tindak Lanjut Hasil Pemeriksaan (TLHP)'],
    ['RHK-8', 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', 'Melakukan sosialisasi kebijakan dan bisnis proses PKH kepada aparat pemerintah tingkat kecamatan, desa/kelurahan, KPM PKH, dan masyarakat umum secara berkala melalui Pertemuan atau media sosial di'],
    ['RHK-8', 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', 'Mengikuti Rapat Koordinasi,Sosialisasi Kebijakan Proses Bisnis PKH dan Penguatan Kapasitas SDM.'],
    ['RHK-8', 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', 'Melakukan Pengawasan dan edukasi kepada Pendamping Sosial di Wilayah Kerja'],
    ['RHK-8', 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', 'Melakukan koordinasi dan sinkronisasi dengan instansi terkait di tingkat Kabupaten Kota'],
    ['RHK-8', 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', 'Berkoodinasi dengan ASN PPPK berkaitan dengan pelaksanaan program ke ASN PPPK'],
    ['RHK-8', 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', 'Melakukan Evaluasi Kinerja dan Menyusun Pelaporan ASN PPPK'],
    ['RHK-8', 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', 'Tugas Lainnya (Penugasan lainnya program Kementrian Sosial)'],
    ['RHK-9', 'Terlaksananya Penyebaran Berita Baik Kementrian Sosial', 'Berperan aktif dalam memanfaatkan, menggunakan, melibatkan dan menyebarkan Media Sosial untuk menyampaikan semua program di Kementerian Sosial']
  ];

  // Tulis semua data master sekaligus untuk efisiensi
  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, 3).setValues(data);
    Logger.log('Master RHK berhasil diinisialisasi dengan ' + data.length + ' baris.');
  }
}

/**
 * Mengisi sheet Master_P2K2 dengan data master modul dan sesi P2K2
 * Hanya diisi jika sheet masih kosong (hanya ada header)
 */
function initializeMasterP2K2() {
  var sheet = getSheet('Master_P2K2');
  // Jika sudah ada data selain header, lewati
  if (sheet.getLastRow() > 1) {
    Logger.log('Master_P2K2 sudah memiliki data, lewati inisialisasi.');
    return;
  }

  var data = [
    ['p2k201', 'MODUL PENDIDIKAN DAN PENGASUHAN', 'Sesi 1 : Menjadi Orang Tua yang Lebih Baik'],
    ['p2k202', 'MODUL PENDIDIKAN DAN PENGASUHAN', 'Sesi 2 : Memahami Perilaku Anak'],
    ['p2k203', 'MODUL PENDIDIKAN DAN PENGASUHAN', 'Sesi 3 : Memahami Cara Anak Usia Dini Belajar'],
    ['p2k204', 'MODUL PENDIDIKAN DAN PENGASUHAN', 'Sesi 4 : Membantu Anak Sukses di Sekolah'],
    ['p2k205', 'MODUL KEUANGAN KELUARGA', 'Sesi 1 : Mengelola Keuangan Keluarga'],
    ['p2k206', 'MODUL KEUANGAN KELUARGA', 'Sesi 2 : Cermat Meminjam dan Menabung'],
    ['p2k207', 'MODUL KEUANGAN KELUARGA', 'Sesi 3 : Memulai Usaha'],
    ['p2k208', 'MODUL KESEHATAN DAN GIZI', 'Sesi 1 : 1000 hari Pertama Kehidupan'],
    ['p2k209', 'MODUL KESEHATAN DAN GIZI', 'Sesi 2 : Sesi 9: Anak dan Balita'],
    ['p2k210', 'MODUL KESEHATAN DAN GIZI', 'Sesi 3 : Sesi 10: Higinitas, Sanitasi dan Penyakit'],
    ['p2k211', 'MODUL PERLINDUNGAN ANAK', 'Sesi 1: Pencegahan Kekerasan terhadap Anak'],
    ['p2k212', 'MODUL PERLINDUNGAN ANAK', 'Sesi 2 : Pencegahan Penelantaran dan Eksploitasi terhadap Anak'],
    ['p2k213', 'MODUL KESEJAHTERAAN SOSIAL', 'Sesi 1 : Perlindungan Penyandang Disabilitas'],
    ['p2k214', 'MODUL KESEJAHTERAAN SOSIAL', 'Sesi 2 : Kesejahteraan Lansia'],
    ['p2k215', 'MODUL 2: PERMASALAHAN STUNTING', 'Sesi 1. Memahami Permasalahan Stunting'],
    ['p2k216', 'MODUL 3: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMENUHAN KESEJAHTERAAN IBU HAMIL', 'Sesi 2. Mendukung Ibu Hamil Mengakses Informasi Yang Tepat dan Layanan Yang Tersedia di Masyarakat'],
    ['p2k217', 'MODUL 3: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMENUHAN KESEJAHTERAAN IBU HAMIL', 'Sesi 3. Mendukung Perawatan Sehari-Hari Ibu Hamil'],
    ['p2k218', 'MODUL 3: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMENUHAN KESEJAHTERAAN IBU HAMIL', 'Sesi 4. Mendukung Ayah dan Ibu Untuk Memberikan Stimulasi Pada Janin'],
    ['p2k219', 'MODUL 4: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMENUHAN KESEJAHTERAAN BAYI BARU LAHIR DAN IBU MENYUSUI', 'Sesi 5. Mendukung Pemenuhan Kesejahteraan Bayi Baru Lahir dan Ibu Menyusui'],
    ['p2k220', 'MODUL 5: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMBERIAN STIMULASI PADA ANAK', 'Sesi 6. Mendukung Pemberian Stimulasi Pada Bayi Baru Lahir sampai Usia 6 Bulan'],
    ['p2k221', 'MODUL 5: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMBERIAN STIMULASI PADA ANAK', 'Sesi 7. Mendukung Pemberian Stimulasi Pada Bayi 6-12 Bulan'],
    ['p2k222', 'MODUL 5: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMBERIAN STIMULASI PADA ANAK', 'Sesi 8. Mendukung Pemberian Stimulasi Pada Anak Usia 1-2 tahun'],
    ['p2k223', 'MODUL 5: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMBERIAN STIMULASI PADA ANAK', 'Sesi 9. Mendukung Pemberian Stimulasi Pada Anak Usia 2-6 Tahun'],
    ['p2k224', 'MODUL 6: PEMANFAATAN BANTUAN SOSIAL DALAM PEMENUHAN GIZI BAGI ANAK DAN IBU HAMIL', 'Sesi 10. Mendukung Pemanfaatan Bantuan Sosial Dalam Pemenuhan Gizi Bagi Anak dan Ibu Hamil'],
    ['p2k225', 'MODUL 7: PENCEGAHAN & PENANGANAN STUNTING MELALUI KEBERSIHAN DIRI DAN LINGKUNGAN', 'Sesi 11. Mendukung Praktik Cuci tangan pakai Sabun'],
    ['p2k226', 'MODUL 7: PENCEGAHAN & PENANGANAN STUNTING MELALUI KEBERSIHAN DIRI DAN LINGKUNGAN', 'Sesi 12. Mendukung Pemanfaatan Jamban Sehat'],
    ['p2k227', 'MODUL 8: PEMETAAN POTENSI KELUARGA DAN RENCANA AKSI DALAM PENCEGAHAN DAN PENANGANAN STUNTING', 'Sesi 13. Pemetaan Potensi Diri, Keluarga dan Lingkungan Sekitar'],
    ['p2k228', 'MODUL 8: PEMETAAN POTENSI KELUARGA DAN RENCANA AKSI DALAM PENCEGAHAN DAN PENANGANAN STUNTING', 'Sesi 14. Mendukung keluarga Mengakses Sistem Rujukan Untuk Penanganan Anak Stunting'],
    ['p2k229', 'MODUL 8: PEMETAAN POTENSI KELUARGA DAN RENCANA AKSI DALAM PENCEGAHAN DAN PENANGANAN STUNTING', 'Sesi 15. Komitmen Melaksanakan rencana Tindak Lanjut']
  ];

  // Tulis semua data master sekaligus untuk efisiensi
  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, 3).setValues(data);
    Logger.log('Master P2K2 berhasil diinisialisasi dengan ' + data.length + ' baris.');
  }
}

// ============================================
// RESOLUSI SPREADSHEET PER-USER
// ============================================
// Mobile app membuat spreadsheet "Aspend Database" terpisah
// di Google Drive masing-masing user. Fungsi di bawah ini
// mencari dan memetakan spreadsheet milik setiap user agar
// Web App dapat membaca data dari spreadsheet yang benar.

/**
 * Mencari spreadsheet ID milik user dari mapping atau Drive.
 * Flow: 1) Cek cache di sheet User_Spreadsheets
 *       2) Jika tidak ada, cari di Drive (file shared "Aspend Database")
 *       3) Jika ditemukan, simpan ke cache
 * @param {string} clientEmail - Email user
 * @returns {string|null} Spreadsheet ID atau null jika tidak ditemukan
 */
function resolveUserSpreadsheet(clientEmail) {
  if (!clientEmail) return null;
  var email = normalizeEmail(clientEmail);
  
  // 1. Cek mapping cache
  var cached = getCachedSpreadsheetId(email);
  if (cached) return cached;
  
  // 2. Cari di Drive
  var found = findAspendDatabaseInDrive(clientEmail);
  if (found) {
    saveSpreadsheetMapping(clientEmail, found);
    return found;
  }
  
  return null;
}

/**
 * Mengambil spreadsheet ID dari cache (sheet User_Spreadsheets)
 */
function getCachedSpreadsheetId(normalizedEmail) {
  try {
    var ss = getSpreadsheet(); // Spreadsheet admin/terpusat
    var sheet = ss.getSheetByName('User_Spreadsheets');
    if (!sheet) {
      // Buat sheet mapping jika belum ada
      sheet = ss.insertSheet('User_Spreadsheets');
      sheet.getRange(1, 1, 1, 3).setValues([['Email', 'SpreadsheetId', 'RegisteredAt']]);
      sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#4285F4').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
      return null;
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return null;
    
    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      if (normalizeEmail(data[i][0]) === normalizedEmail) {
        var ssId = data[i][1];
        // Validasi apakah spreadsheet masih bisa diakses
        try {
          SpreadsheetApp.openById(ssId);
          return ssId;
        } catch (e) {
          Logger.log('Cached spreadsheet ' + ssId + ' tidak bisa diakses: ' + e.message);
          // Hapus cache yang sudah tidak valid
          sheet.deleteRow(i + 2);
          return null;
        }
      }
    }
    return null;
  } catch (e) {
    Logger.log('Error getCachedSpreadsheetId: ' + e.message);
    return null;
  }
}

/**
 * Mencari file spreadsheet bernama "Aspend Database" di Drive
 * yang telah di-share ke akun pemilik script.
 * @param {string} clientEmail - Email pemilik spreadsheet
 * @returns {string|null} Spreadsheet ID atau null
 */
function findAspendDatabaseInDrive(clientEmail) {
  try {
    // Cari semua spreadsheet bernama "Aspend Database" yang bisa diakses
    var files = DriveApp.searchFiles(
      "title = 'Aspend Database' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
    );
    
    while (files.hasNext()) {
      var file = files.next();
      var ssId = file.getId();
      
      try {
        var ss = SpreadsheetApp.openById(ssId);
        // Cek apakah ada sheet "Profile" yang berisi email user
        var profileSheet = ss.getSheetByName('Profile');
        if (profileSheet) {
          var lastRow = profileSheet.getLastRow();
          if (lastRow >= 2) {
            var profileData = profileSheet.getRange(2, 1, lastRow - 1, 1).getValues();
            for (var i = 0; i < profileData.length; i++) {
              if (normalizeEmail(profileData[i][0]) === normalizeEmail(clientEmail)) {
                Logger.log('Ditemukan Aspend Database milik ' + clientEmail + ': ' + ssId);
                return ssId;
              }
            }
          }
        }
        
        // Fallback: cek juga sheet "Users" (format web) 
        var usersSheet = ss.getSheetByName('Users');
        if (usersSheet) {
          var lastRow2 = usersSheet.getLastRow();
          if (lastRow2 >= 2) {
            var userData = usersSheet.getRange(2, 1, lastRow2 - 1, 1).getValues();
            for (var j = 0; j < userData.length; j++) {
              if (normalizeEmail(userData[j][0]) === normalizeEmail(clientEmail)) {
                Logger.log('Ditemukan Aspend Database (web format) milik ' + clientEmail + ': ' + ssId);
                return ssId;
              }
            }
          }
        }
      } catch (e) {
        // File tidak bisa dibuka, lewati
        Logger.log('Skip file ' + ssId + ': ' + e.message);
      }
    }
    
    Logger.log('Tidak ditemukan Aspend Database untuk ' + clientEmail);
    return null;
  } catch (e) {
    Logger.log('Error findAspendDatabaseInDrive: ' + e.message);
    return null;
  }
}

/**
 * Menyimpan mapping email → spreadsheetId ke sheet User_Spreadsheets
 */
function saveSpreadsheetMapping(clientEmail, spreadsheetId) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('User_Spreadsheets');
    if (!sheet) {
      sheet = ss.insertSheet('User_Spreadsheets');
      sheet.getRange(1, 1, 1, 3).setValues([['Email', 'SpreadsheetId', 'RegisteredAt']]);
      sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#4285F4').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([clientEmail, spreadsheetId, new Date().toISOString()]);
    Logger.log('Mapping disimpan: ' + clientEmail + ' → ' + spreadsheetId);
    return true;
  } catch (e) {
    Logger.log('Error saveSpreadsheetMapping: ' + e.message);
    return false;
  }
}

/**
 * Mendaftarkan spreadsheet ID user secara manual (dipanggil dari frontend)
 * @param {string} clientEmail - Email user
 * @param {string} spreadsheetId - ID Spreadsheet dari URL
 * @returns {Object} {success, message}
 */
function registerUserSpreadsheet(clientEmail, spreadsheetId) {
  try {
    if (!clientEmail || !spreadsheetId) {
      throw new Error('Email dan Spreadsheet ID wajib diisi.');
    }
    
    // Validasi: coba buka spreadsheet
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var title = ss.getName();
    
    // Validasi: cek apakah ada sheet Laporan_Log atau Profile
    var hasLaporan = ss.getSheetByName('Laporan_Log') !== null;
    var hasProfile = ss.getSheetByName('Profile') !== null;
    
    if (!hasLaporan && !hasProfile) {
      throw new Error('Spreadsheet ini bukan database Aspend yang valid. Pastikan Anda memasukkan ID yang benar dari spreadsheet "Aspend Database" di Google Drive Anda.');
    }
    
    // Simpan mapping
    saveSpreadsheetMapping(clientEmail, spreadsheetId);
    
    return { 
      success: true, 
      message: 'Spreadsheet "' + title + '" berhasil didaftarkan. Data Anda sekarang tersinkronisasi!' 
    };
  } catch (e) {
    Logger.log('Error registerUserSpreadsheet: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Mengambil semua data dari sheet di spreadsheet USER (bukan admin).
 * Otomatis mendeteksi format header (mobile vs web).
 * @param {string} spreadsheetId - ID Spreadsheet user
 * @param {string} sheetName - Nama sheet
 * @returns {Array<Object>} Array objek data dengan header sebagai key
 */
function getAllDataFromUserSS(spreadsheetId, sheetName) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var result = [];
    
    for (var i = 1; i < data.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      obj['_rowIndex'] = i + 1;
      result.push(obj);
    }
    return result;
  } catch (e) {
    Logger.log('Error getAllDataFromUserSS(' + spreadsheetId + ', ' + sheetName + '): ' + e.message);
    return [];
  }
}

// ============================================
// FUNGSI CRUD GENERIK
// ============================================

/**
 * Mengambil semua data dari sheet tertentu sebagai array objek
 * Baris pertama digunakan sebagai key/header
 * @param {string} sheetName - Nama sheet
 * @returns {Array<Object>} Array objek data
 */
function getAllData(sheetName) {
  try {
    var sheet = getSheet(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return []; // Hanya ada header atau kosong

    var data = sheet.getDataRange().getValues();
    var headers = data[0]; // Baris pertama = header
    var result = [];

    for (var i = 1; i < data.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      // Sertakan nomor baris asli (1-indexed) untuk referensi update/delete
      obj['_rowIndex'] = i + 1;
      result.push(obj);
    }
    return result;
  } catch (e) {
    Logger.log('Error getAllData(' + sheetName + '): ' + e.message);
    return [];
  }
}

/**
 * Mencari indeks baris berdasarkan nilai kunci pada kolom tertentu
 * @param {string} sheetName - Nama sheet
 * @param {*} key - Nilai yang dicari
 * @param {number} colIndex - Indeks kolom (1-indexed)
 * @returns {number} Indeks baris (1-indexed), atau -1 jika tidak ditemukan
 */
function findRowByKey(sheetName, key, colIndex) {
  try {
    var sheet = getSheet(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return -1;

    var colData = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
    var searchKey = String(key).trim().toLowerCase();
    for (var i = 0; i < colData.length; i++) {
      var cellVal = String(colData[i][0]).trim().toLowerCase();
      if (cellVal === searchKey) {
        return i + 2; // +2 karena mulai dari baris 2 (skip header)
      }
    }
    return -1;
  } catch (e) {
    Logger.log('Error findRowByKey: ' + e.message);
    return -1;
  }
}

/**
 * Menambahkan baris baru ke sheet
 * @param {string} sheetName - Nama sheet
 * @param {Array} rowArray - Array data untuk baris baru
 * @returns {boolean} True jika berhasil
 */
function appendRow(sheetName, rowArray) {
  try {
    var sheet = getSheet(sheetName);
    sheet.appendRow(rowArray);
    Logger.log('Baris baru ditambahkan ke ' + sheetName);
    return true;
  } catch (e) {
    Logger.log('Error appendRow(' + sheetName + '): ' + e.message);
    return false;
  }
}

/**
 * Memperbarui data pada baris tertentu
 * @param {string} sheetName - Nama sheet
 * @param {number} rowIndex - Indeks baris (1-indexed)
 * @param {Array} rowArray - Array data pengganti
 * @returns {boolean} True jika berhasil
 */
function updateRow(sheetName, rowIndex, rowArray) {
  try {
    var sheet = getSheet(sheetName);
    if (rowIndex < 2 || rowIndex > sheet.getLastRow()) {
      throw new Error('Indeks baris tidak valid: ' + rowIndex);
    }
    sheet.getRange(rowIndex, 1, 1, rowArray.length).setValues([rowArray]);
    Logger.log('Baris ' + rowIndex + ' diperbarui di ' + sheetName);
    return true;
  } catch (e) {
    Logger.log('Error updateRow(' + sheetName + ', ' + rowIndex + '): ' + e.message);
    return false;
  }
}

/**
 * Menghapus baris pada indeks tertentu
 * @param {string} sheetName - Nama sheet
 * @param {number} rowIndex - Indeks baris (1-indexed)
 * @returns {boolean} True jika berhasil
 */
function deleteRow(sheetName, rowIndex) {
  try {
    var sheet = getSheet(sheetName);
    if (rowIndex < 2 || rowIndex > sheet.getLastRow()) {
      throw new Error('Indeks baris tidak valid: ' + rowIndex);
    }
    sheet.deleteRow(rowIndex);
    Logger.log('Baris ' + rowIndex + ' dihapus dari ' + sheetName);
    return true;
  } catch (e) {
    Logger.log('Error deleteRow(' + sheetName + ', ' + rowIndex + '): ' + e.message);
    return false;
  }
}

// ============================================
// FUNGSI UTILITAS LAPORAN
// ============================================

/**
 * Membuat ID laporan unik dengan format RPT-YYYYMMDD-NNN
 * NNN adalah nomor urut harian berdasarkan laporan yang sudah ada
 * @returns {string} ID laporan unik
 */
function generateReportId() {
  var now = new Date();
  var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd');
  var prefix = 'RPT-' + dateStr + '-';

  // Cari nomor urut tertinggi untuk hari ini
  var reports = getAllData('Laporan_Log');
  var maxSeq = 0;
  for (var i = 0; i < reports.length; i++) {
    var id = reports[i].ReportId || '';
    if (id.indexOf(prefix) === 0) {
      var seq = parseInt(id.substring(prefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  // Format nomor urut 3 digit dengan leading zeros
  var nextSeq = ('000' + (maxSeq + 1)).slice(-3);
  return prefix + nextSeq;
}

// ============================================
// FUNGSI DROPDOWN & FILTER
// ============================================

/**
 * Mengambil nilai Jenis RHK unik untuk dropdown
 * @returns {Array<string>} Array nilai jenis RHK unik
 */
function getUniqueJenisRHK() {
  var data = getAllData('Master_RHK');
  var uniqueMap = {};
  var result = [];

  for (var i = 0; i < data.length; i++) {
    var jenis = data[i].JENIS_RHK;
    if (jenis && !uniqueMap[jenis]) {
      uniqueMap[jenis] = true;
      result.push(jenis);
    }
  }
  return result;
}

/**
 * Mengambil daftar Rencana Aksi berdasarkan Jenis RHK
 * @param {string} jenisRHK - Nilai Jenis RHK untuk filter
 * @returns {Array<string>} Array rencana aksi yang sesuai
 */
function getRencanaAksiByJenis(jenisRHK) {
  var data = getAllData('Master_RHK');
  var result = [];

  for (var i = 0; i < data.length; i++) {
    if (data[i].JENIS_RHK === jenisRHK) {
      result.push(data[i].RENCANA_AKSI);
    }
  }
  return result;
}

/**
 * Mengambil daftar Modul P2K2 unik untuk dropdown
 * @returns {Array<string>} Array nama modul unik
 */
function getUniqueModulP2K2() {
  var data = getAllData('Master_P2K2');
  var uniqueMap = {};
  var result = [];

  for (var i = 0; i < data.length; i++) {
    var modul = data[i].MODUL;
    if (modul && !uniqueMap[modul]) {
      uniqueMap[modul] = true;
      result.push(modul);
    }
  }
  return result;
}

/**
 * Mengambil daftar Sesi berdasarkan Modul P2K2
 * @param {string} modul - Nama modul untuk filter
 * @returns {Array<string>} Array sesi yang sesuai
 */
function getSesiByModul(modul) {
  var data = getAllData('Master_P2K2');
  var result = [];

  for (var i = 0; i < data.length; i++) {
    if (data[i].MODUL === modul) {
      result.push(data[i].SESI);
    }
  }
  return result;
}

/**
 * Memeriksa apakah Jenis RHK terkait dengan P2K2
 * Cek apakah teks mengandung kata 'P2K2'
 * @param {string} jenisRHK - Teks jenis RHK
 * @returns {boolean} True jika terkait P2K2
 */
function isP2K2RelatedRHK(jenisRHK) {
  if (!jenisRHK) return false;
  return jenisRHK.toString().toUpperCase().indexOf('P2K2') !== -1;
}

// ============================================
// FUNGSI CRUD KPM (KELUARGA PENERIMA MANFAAT)
// ============================================

/**
 * Menyimpan/memperbarui data profil KPM lengkap ke Spreadsheet
 * @param {Object} payload - Objek data KPM
 * @returns {Object} Hasil {success, kpmId, message}
 */
function saveKpmProfile(payload) {
  try {
    var kpmId = payload.kpmId || ('KPM-' + payload.nik);
    var masterRowData = [
      kpmId,
      payload.nik,
      payload.noKk,
      payload.nama,
      payload.status,
      payload.namaKelompok,
      payload.pekerjaan,
      payload.noHp,
      payload.provinsi,
      payload.kabKota,
      payload.kecamatan,
      payload.desaKelurahan,
      payload.lingkungan,
      payload.fotoWajah || '',
      payload.fotoKtp || '',
      payload.fotoKk || '',
      payload.fotoBukuTabungan || '',
      payload.fotoKks || '',
      payload.tahunDapatBansos || '',
      new Date().toISOString()
    ];

    var rowMaster = findRowByKey('KPM_Master', kpmId, 1);
    if (rowMaster === -1) {
      appendRow('KPM_Master', masterRowData);
    } else {
      updateRow('KPM_Master', rowMaster, masterRowData);
    }

    // Update KPM_RumahUsaha
    var rumahSheet = getSheet('KPM_RumahUsaha');
    var rowRumah = findRowByKey('KPM_RumahUsaha', kpmId, 2);
    var rumahId = rowRumah !== -1 ? rumahSheet.getRange(rowRumah, 1).getValue() : ('RMH-' + kpmId.substring(4));
    
    var rumahRowData = [
      rumahId,
      kpmId,
      payload.punyaUsaha || 'T',
      payload.namaUsaha || '',
      payload.fotoUsaha || '',
      payload.fotoRumahLuar || '',
      payload.fotoRumahTamu || '',
      payload.fotoKamarMandi || '',
      payload.latitude || 0,
      payload.longitude || 0,
      payload.pernyataan || '',
      payload.bansosLain || '',
      new Date().toISOString()
    ];

    if (rowRumah === -1) {
      appendRow('KPM_RumahUsaha', rumahRowData);
    } else {
      updateRow('KPM_RumahUsaha', rowRumah, rumahRowData);
    }

    // Update KPM_Komponen
    var komponenSheet = getSheet('KPM_Komponen');
    var lastRowK = komponenSheet.getLastRow();
    if (lastRowK > 1) {
      var values = komponenSheet.getRange(2, 2, lastRowK - 1, 1).getValues();
      for (var i = values.length - 1; i >= 0; i--) {
        if (values[i][0] === kpmId) {
          komponenSheet.deleteRow(i + 2);
        }
      }
    }

    if (payload.komponenList && payload.komponenList.length > 0) {
      for (var j = 0; j < payload.komponenList.length; j++) {
        var comp = payload.komponenList[j];
        var compId = 'KOMP-' + kpmId.substring(4) + '-' + j;
        var compRowData = [
          compId,
          kpmId,
          comp.nama,
          comp.jenisKelamin,
          comp.hubunganKeluarga,
          comp.jenisKomponen,
          comp.kelas || '',
          comp.posyandu || '',
          new Date().toISOString()
        ];
        appendRow('KPM_Komponen', compRowData);
      }
    }

    return { success: true, kpmId: kpmId, message: 'Profil KPM berhasil disimpan.' };
  } catch (e) {
    Logger.log('Error saveKpmProfile: ' + e.message);
    return { success: false, message: 'Gagal menyimpan KPM: ' + e.message };
  }
}

/**
 * Mengambil detail data KPM lengkap berdasarkan ID
 * @param {string} kpmId - ID KPM
 * @returns {Object} Hasil {success, kpmData, message}
 */
function getKpmDetails(kpmId) {
  try {
    var masterData = getAllData('KPM_Master');
    var kpm = null;
    for (var i = 0; i < masterData.length; i++) {
      if (masterData[i].KpmId === kpmId) {
        kpm = masterData[i];
        break;
      }
    }

    if (!kpm) {
      return { success: false, message: 'KPM tidak ditemukan.' };
    }

    var rumahData = getAllData('KPM_RumahUsaha');
    var rumah = {};
    for (var j = 0; j < rumahData.length; j++) {
      if (rumahData[j].KpmId === kpmId) {
        rumah = rumahData[j];
        break;
      }
    }

    var komponenData = getAllData('KPM_Komponen');
    var komponenList = [];
    for (var k = 0; k < komponenData.length; k++) {
      if (komponenData[k].KpmId === kpmId) {
        komponenList.push(komponenData[k]);
      }
    }

    return {
      success: true,
      kpmData: {
        kpmId: kpm.KpmId,
        nik: kpm.Nik,
        noKk: kpm.NoKk,
        nama: kpm.Nama,
        status: kpm.Status,
        namaKelompok: kpm.NamaKelompok,
        pekerjaan: kpm.Pekerjaan,
        noHp: kpm.NoHp,
        provinsi: kpm.Provinsi,
        kabKota: kpm.KabKota,
        kecamatan: kpm.Kecamatan,
        desaKelurahan: kpm.DesaKelurahan,
        lingkungan: kpm.Lingkungan,
        fotoWajah: kpm.FotoWajah,
        fotoKtp: kpm.FotoKtp,
        fotoKk: kpm.FotoKk,
        fotoBukuTabungan: kpm.FotoBukuTabungan,
        fotoKks: kpm.FotoKks,
        tahunDapatBansos: kpm.TahunDapatBansos,
        punyaUsaha: rumah.PunyaUsaha || 'T',
        namaUsaha: rumah.NamaUsaha || '',
        fotoUsaha: rumah.FotoUsaha || '',
        fotoRumahLuar: rumah.FotoRumahLuar || '',
        fotoRumahTamu: rumah.FotoRumahTamu || '',
        fotoKamarMandi: rumah.FotoKamarMandi || '',
        latitude: rumah.Latitude || 0,
        longitude: rumah.Longitude || 0,
        pernyataan: rumah.Pernyataan || '',
        bansosLain: rumah.BansosLain || '',
        komponenList: komponenList
      }
    };
  } catch (e) {
    Logger.log('Error getKpmDetails: ' + e.message);
    return { success: false, message: 'Gagal mengambil detail KPM: ' + e.message };
  }
}

/**
 * Menghapus data KPM beserta komponen dan rumah usahanya
 * @param {string} kpmId - ID KPM
 * @returns {Object} Hasil {success, message}
 */
function deleteKpmProfile(kpmId) {
  try {
    var rowM = findRowByKey('KPM_Master', kpmId, 1);
    if (rowM !== -1) {
      deleteRow('KPM_Master', rowM);
    }

    var rowR = findRowByKey('KPM_RumahUsaha', kpmId, 2);
    if (rowR !== -1) {
      deleteRow('KPM_RumahUsaha', rowR);
    }

    var komponenSheet = getSheet('KPM_Komponen');
    var lastRowK = komponenSheet.getLastRow();
    if (lastRowK > 1) {
      var values = komponenSheet.getRange(2, 2, lastRowK - 1, 1).getValues();
      for (var i = values.length - 1; i >= 0; i--) {
        if (values[i][0] === kpmId) {
          komponenSheet.deleteRow(i + 2);
        }
      }
    }

    return { success: true, message: 'Profil KPM berhasil dihapus.' };
  } catch (e) {
    Logger.log('Error deleteKpmProfile: ' + e.message);
    return { success: false, message: 'Gagal menghapus KPM: ' + e.message };
  }
}

/**
 * Mengambil daftar singkat semua KPM untuk daftar wilayah dampingan
 * @returns {Object} Hasil {success, reports, message}
 */
function getKpmList() {
  try {
    var master = getAllData('KPM_Master');
    var rumah = getAllData('KPM_RumahUsaha');
    
    var rumahMap = {};
    for (var j = 0; j < rumah.length; j++) {
      rumahMap[rumah[j].KpmId] = rumah[j];
    }
    
    var list = [];
    for (var i = 0; i < master.length; i++) {
      var m = master[i];
      var r = rumahMap[m.KpmId] || {};
      list.push({
        kpmId: m.KpmId,
        nik: m.Nik,
        noKk: m.NoKk,
        nama: m.Nama,
        status: m.Status,
        namaKelompok: m.NamaKelompok,
        pekerjaan: m.Pekerjaan,
        noHp: m.NoHp,
        provinsi: m.Provinsi,
        kabKota: m.KabKota,
        kecamatan: m.Kecamatan,
        desaKelurahan: m.DesaKelurahan,
        lingkungan: m.Lingkungan,
        fotoWajah: m.FotoWajah,
        fotoKtp: m.FotoKtp,
        fotoKk: m.FotoKk,
        fotoBukuTabungan: m.FotoBukuTabungan,
        fotoKks: m.FotoKks,
        tahunDapatBansos: m.TahunDapatBansos,
        latitude: r.Latitude || 0,
        longitude: r.Longitude || 0
      });
    }

    return { success: true, reports: list };
  } catch (e) {
    Logger.log('Error getKpmList: ' + e.message);
    return { success: false, reports: [], message: 'Gagal memuat list KPM: ' + e.message };
  }
}

// ============================================
// FUNGSI CRUD PENGADUAN
// ============================================

/**
 * Menyimpan atau memperbarui data Pengaduan
 * @param {Object} payload - Objek data Pengaduan
 * @returns {Object} Hasil {success, id, message}
 */
function savePengaduan(payload) {
  try {
    var id = payload.id || ('ADU-' + Date.now());
    var rowData = [
      id,
      payload.email || Session.getActiveUser().getEmail(),
      payload.nik || '',
      payload.nama || '',
      payload.alamat || '',
      payload.desaKelurahan || '',
      payload.kecamatan || '',
      payload.kabKota || '',
      payload.aduan || '',
      payload.hasilAnalisa || '',
      payload.latitude || 0,
      payload.longitude || 0,
      payload.fotoKtp || '',
      payload.screenshotSiks || '',
      payload.pdfFileId || '',
      payload.createdAt || new Date().toISOString()
    ];
    
    var rowIndex = findRowByKey('Pengaduan', id, 1);
    if (rowIndex === -1) {
      appendRow('Pengaduan', rowData);
    } else {
      updateRow('Pengaduan', rowIndex, rowData);
    }
    return { success: true, id: id };
  } catch (e) {
    Logger.log('Error savePengaduan: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Mengambil daftar semua Pengaduan
 * @returns {Object} Hasil {success, reports, message}
 */
function getPengaduanList(clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    
    // Cari spreadsheet milik user
    var userSSId = resolveUserSpreadsheet(email);
    var filteredList = [];
    
    if (userSSId) {
      // Baca dari spreadsheet user — semua data sudah milik user
      filteredList = getAllDataFromUserSS(userSSId, 'Pengaduan');
    } else {
      // Fallback: baca dari spreadsheet admin dan filter per email
      var rawList = getAllData('Pengaduan');
      filteredList = rawList.filter(function(r) {
        return r.Email && email && normalizeEmail(r.Email) === normalizeEmail(email);
      });
    }
    
    // Normalisasi nama kolom (mobile pakai PengaduanId, web pakai Id)
    filteredList = filteredList.map(function(r) {
      r.Id = r.Id || r.PengaduanId || '';
      return r;
    });
    
    return { success: true, reports: filteredList };
  } catch (e) {
    Logger.log('Error getPengaduanList: ' + e.message);
    return { success: false, reports: [], message: e.message };
  }
}

/**
 * Menghapus data Pengaduan beserta dokumen terkait di Drive
 * @param {string} id - ID Pengaduan
 * @returns {Object} Hasil {success, message}
 */
function deletePengaduan(id, clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    var rowIndex = findRowByKey('Pengaduan', id, 1);
    if (rowIndex !== -1) {
      var sheet = getSheet('Pengaduan');
      var rowValues = sheet.getRange(rowIndex, 1, 1, 16).getValues()[0];
      
      if (normalizeEmail(rowValues[1]) !== normalizeEmail(email)) {
        throw new Error('Akses ditolak. Anda hanya dapat menghapus data Anda sendiri.');
      }
      var fotoKtpId = rowValues[12];
      var screenshotSiksId = rowValues[13];
      var pdfFileId = rowValues[14];
      
      if (fotoKtpId) { try { DriveApp.getFileById(fotoKtpId).setTrashed(true); } catch(e) {} }
      if (screenshotSiksId) { try { DriveApp.getFileById(screenshotSiksId).setTrashed(true); } catch(e) {} }
      if (pdfFileId) { try { DriveApp.getFileById(pdfFileId).setTrashed(true); } catch(e) {} }
      
      deleteRow('Pengaduan', rowIndex);
      return { success: true };
    }
    return { success: false, message: 'Data tidak ditemukan' };
  } catch (e) {
    Logger.log('Error deletePengaduan: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ============================================
// FUNGSI CRUD NOTA DINAS
// ============================================

/**
 * Menyimpan atau memperbarui data Nota Dinas
 * @param {Object} payload - Objek data Nota Dinas
 * @returns {Object} Hasil {success, id, message}
 */
function saveNotaDinas(payload) {
  try {
    var id = payload.id || ('ND-' + Date.now());
    var rowData = [
      id,
      payload.email || Session.getActiveUser().getEmail(),
      payload.nomor || '',
      payload.yth || '',
      payload.dari || '',
      payload.hal || '',
      payload.lampiran || '',
      payload.sifat || '',
      payload.tanggal || '',
      payload.poinDraft || '',
      payload.isiNotaDinas || '',
      payload.pdfFileId || '',
      payload.createdAt || new Date().toISOString(),
      payload.buktiDukung || ''
    ];
    
    var rowIndex = findRowByKey('Nota_Dinas', id, 1);
    if (rowIndex === -1) {
      appendRow('Nota_Dinas', rowData);
    } else {
      updateRow('Nota_Dinas', rowIndex, rowData);
    }
    return { success: true, id: id };
  } catch (e) {
    Logger.log('Error saveNotaDinas: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Mengambil daftar semua Nota Dinas
 * @returns {Object} Hasil {success, reports, message}
 */
function getNotaDinasList(clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    
    // Cari spreadsheet milik user
    var userSSId = resolveUserSpreadsheet(email);
    var filteredList = [];
    
    if (userSSId) {
      // Baca dari spreadsheet user — semua data sudah milik user
      filteredList = getAllDataFromUserSS(userSSId, 'Nota_Dinas');
    } else {
      // Fallback: baca dari spreadsheet admin dan filter per email
      var rawList = getAllData('Nota_Dinas');
      filteredList = rawList.filter(function(r) {
        return r.Email && email && normalizeEmail(r.Email) === normalizeEmail(email);
      });
    }
    
    // Normalisasi nama kolom (mobile pakai NotaDinasId, web pakai Id)
    filteredList = filteredList.map(function(r) {
      r.Id = r.Id || r.NotaDinasId || '';
      r.Nomor = r.Nomor || '';
      r.Sifat = r.Sifat || '';
      r.Hal = r.Hal || '';
      r.Yth = r.Yth || '';
      r.Tanggal = r.Tanggal || '';
      r.PdfFileId = r.PdfFileId || '';
      return r;
    });
    
    return { success: true, reports: filteredList };
  } catch (e) {
    Logger.log('Error getNotaDinasList: ' + e.message);
    return { success: false, reports: [], message: e.message };
  }
}

/**
 * Menghapus data Nota Dinas beserta file PDF terkait di Drive
 * @param {string} id - ID Nota Dinas
 * @returns {Object} Hasil {success, message}
 */
function deleteNotaDinas(id, clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    var rowIndex = findRowByKey('Nota_Dinas', id, 1);
    if (rowIndex !== -1) {
      var sheet = getSheet('Nota_Dinas');
      var rowValues = sheet.getRange(rowIndex, 1, 1, 14).getValues()[0];
      
      if (normalizeEmail(rowValues[1]) !== normalizeEmail(email)) {
        throw new Error('Akses ditolak. Anda hanya dapat menghapus data Anda sendiri.');
      }
      var pdfFileId = rowValues[11];
      var buktiDukungId = rowValues[13];
      
      if (pdfFileId) { try { DriveApp.getFileById(pdfFileId).setTrashed(true); } catch(e) {} }
      if (buktiDukungId) { try { DriveApp.getFileById(buktiDukungId).setTrashed(true); } catch(e) {} }
      
      deleteRow('Nota_Dinas', rowIndex);
      return { success: true };
    }
    return { success: false, message: 'Data tidak ditemukan' };
  } catch (e) {
    Logger.log('Error deleteNotaDinas: ' + e.message);
    return { success: false, message: e.message };
  }
}
