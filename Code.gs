/**
 * ==========================================
 * Code.gs - Entry Point Utama
 * ==========================================
 * Berisi fungsi-fungsi utama yang diekspos ke klien
 * melalui google.script.run untuk aplikasi RHK-agent.
 * 
 * Mencakup:
 * - Routing web app (doGet)
 * - Manajemen profil pengguna
 * - Upload file (tanda tangan, foto)
 * - Alur kerja laporan (submit, narasi AI, PDF)
 * - Operasi admin untuk data master
 */

// ============================================
// FUNGSI WEB APP
// ============================================

/**
 * Handler utama untuk HTTP GET request
 * Menyajikan halaman Index.html sebagai web application
 * @param {Object} e - Event parameter dari request
 * @returns {GoogleAppsScript.HTML.HtmlOutput} Output HTML
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('RHK-agent - Sistem Laporan RHK')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Handler utama untuk HTTP POST request (API Gateway)
 * Memungkinkan local server memanggil fungsi-fungsi server secara aman via CORS.
 * @param {Object} e - Event parameter dari request
 * @returns {ContentService.TextOutput} Output JSON
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var functionName = payload.functionName;
    var args = payload.arguments || [];
    
    // Daftar fungsi yang diizinkan untuk dipanggil secara remote
    var allowedFunctions = [
      'getUserProfile', 'isCurrentUserAdmin', 'getRHKOptions', 'getDashboardStats',
      'getUserReports', 'getP2K2Moduls', 'getP2K2Sessions', 'saveUserProfile',
      'updateUserProfile', 'saveNarrative', 'getReportNarrative', 'downloadReport',
      'savePdfToDrive', 'uploadSignature', 'uploadProfilePhoto', 'uploadKemensosLogo',
      'uploadReportPhotos', 'submitReportData', 'generateNarrative', 'createReportPDF',
      'registerUserSpreadsheet', 'saveMasterData', 'deleteMasterData', 'deleteReportData',
      'apiDeletePengaduan', 'apiDeleteNotaDinas', 'getAIConfigForAdmin', 'saveAIConfig',
      'getKemensosLogoUrl', 'testAIConnection', 'getAllMasterP2K2', 'callAIService',
      'apiSaveNotaDinasWithFiles', 'apiCreateNotaDinasPdf', 'apiGetNotaDinasList',
      'apiGetPengaduanList', 'apiSaveComplaintWithFiles', 'apiCreatePengaduanPdf',
      'getRencanaAksiByJenis', 'getUniqueModulP2K2', 'getSesiByModul', 'apiExtractKtpData',
      'apiCreateVerkomPdf', 'checkPremiumStatusBackend', 'getPremiumUsers', 'addPremiumUser', 'removePremiumUser',
      'setupDatabase'
    ];
    
    if (allowedFunctions.indexOf(functionName) === -1) {
      throw new Error('Fungsi "' + functionName + '" tidak diizinkan untuk dipanggil secara remote.');
    }
    
    // Jalankan fungsi secara dinamis pada context global
    var result = this[functionName].apply(this, args);
    
    var output = {
      success: true,
      data: result
    };
    
    return ContentService.createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Menyisipkan file HTML (untuk CSS/JS terpisah)
 * Digunakan di template dengan <?!= include('NamaFile') ?>
 * @param {string} filename - Nama file HTML tanpa ekstensi
 * @returns {string} Konten HTML dari file
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================
// MANAJEMEN PENGGUNA
// ============================================

/**
 * Mengambil email pengguna yang sedang aktif
 * @returns {string} Alamat email pengguna
 */
function getCurrentUserEmail(clientEmail) {
  return clientEmail || Session.getActiveUser().getEmail();
}

/**
 * Mengambil profil pengguna saat ini dari sheet Users
 * Jika pengguna baru, otomatis buat entri baru
 * @returns {Object} Data profil pengguna
 */
function getUserProfile(clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    if (!email) {
      throw new Error('Tidak dapat mengidentifikasi pengguna. Pastikan sudah login.');
    }
    
    var getFileUrl = function(fileId) {
      if (!fileId) return '';
      return 'https://drive.google.com/uc?export=view&id=' + fileId;
    };

    // Coba baca profil dari spreadsheet user (mobile format: sheet "Profile")
    var userSSId = resolveUserSpreadsheet(email);
    if (userSSId) {
      var profileData = getAllDataFromUserSS(userSSId, 'Profile');
      if (profileData.length > 0) {
        var p = profileData[0]; // Profile hanya ada 1 baris per user
        var sigId = p.SignatureFileId || '';
        var photoId = p.PhotoFileId || '';
        
        // Cek admin status dari spreadsheet admin
        var isAdmin = false;
        var adminRowIndex = findRowByKey('Users', email, 1);
        if (adminRowIndex !== -1) {
          var adminSheet = getSheet('Users');
          var adminRow = adminSheet.getRange(adminRowIndex, 1, 1, adminSheet.getLastColumn()).getValues()[0];
          isAdmin = adminRow[7] === true || adminRow[7] === 'TRUE';
        }
        
        return {
          email: p.Email || email,
          name: p.Nama || '',
          nama: p.Nama || '',
          nip: p.NIP || '',
          role: p.Jabatan || '',
          jabatan: p.Jabatan || '',
          kabupaten: p.KabupatenKota || '',
          kabupatenKota: p.KabupatenKota || '',
          signatureFileId: sigId,
          photoFileId: photoId,
          photoUrl: getFileUrl(photoId),
          signatureUrl: getFileUrl(sigId),
          isAdmin: isAdmin,
          isNewUser: false,
          userSpreadsheetId: userSSId
        };
      }
    }

    // Fallback: baca dari spreadsheet admin (sheet "Users")
    var rowIndex = findRowByKey('Users', email, 1);

    if (rowIndex === -1) {
      // Pengguna baru - buat entri dengan data default
      var newRow = [email, '', '', '', '', '', '', false, new Date().toISOString()];
      appendRow('Users', newRow);
      Logger.log('Pengguna baru ditambahkan: ' + email);
      return {
        email: email,
        name: '',
        nama: '',
        nip: '',
        role: '',
        jabatan: '',
        kabupaten: '',
        kabupatenKota: '',
        signatureFileId: '',
        photoFileId: '',
        photoUrl: '',
        signatureUrl: '',
        isAdmin: false,
        isNewUser: true,
        needsSpreadsheetRegistration: !userSSId
      };
    }

    // Pengguna sudah ada di spreadsheet admin - ambil datanya
    var sheet = getSheet('Users');
    var lastCol = sheet.getLastColumn();
    var rowData = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
    
    var signatureFileId = rowData[5] || '';
    var photoFileId = rowData[6] || '';

    return {
      email: rowData[0],
      name: rowData[1] || '',
      nama: rowData[1] || '',
      nip: rowData[2] || '',
      role: rowData[3] || '',
      jabatan: rowData[3] || '',
      kabupaten: rowData[4] || '',
      kabupatenKota: rowData[4] || '',
      signatureFileId: signatureFileId,
      photoFileId: photoFileId,
      photoUrl: getFileUrl(photoFileId),
      signatureUrl: getFileUrl(signatureFileId),
      isAdmin: rowData[7] === true || rowData[7] === 'TRUE',
      isNewUser: false,
      needsSpreadsheetRegistration: !userSSId
    };
  } catch (e) {
    Logger.log('Error getUserProfile: ' + e.message);
    throw new Error('Gagal memuat profil pengguna: ' + e.message);
  }
}

/**
 * Memperbarui profil pengguna (nama, NIP, jabatan, kabupaten/kota)
 * @param {Object} data - Objek berisi field yang akan diperbarui
 * @returns {Object} Hasil operasi {success, message}
 */
function updateUserProfile(data, clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    var rowIndex = findRowByKey('Users', email, 1);

    if (rowIndex === -1) {
      throw new Error('Profil pengguna tidak ditemukan.');
    }

    var sheet = getSheet('Users');
    var lastCol = sheet.getLastColumn();
    var currentRow = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

    // Perbarui field yang dikirim, pertahankan yang lama jika tidak dikirim
    var updatedRow = [
      email,
      data.nama || currentRow[1],
      data.nip || currentRow[2],
      data.jabatan || currentRow[3],
      data.kabupatenKota || currentRow[4],
      currentRow[5], // signatureFileId - diupdate lewat fungsi upload
      currentRow[6], // photoFileId - diupdate lewat fungsi upload
      currentRow[7], // isAdmin - tidak bisa diubah dari sini
      currentRow[8]  // createdAt - tidak berubah
    ];

    updateRow('Users', rowIndex, updatedRow);
    return { success: true, message: 'Profil berhasil diperbarui.' };
  } catch (e) {
    Logger.log('Error updateUserProfile: ' + e.message);
    return { success: false, message: 'Gagal memperbarui profil: ' + e.message };
  }
}

// ============================================
// UPLOAD FILE
// ============================================

/**
 * Upload gambar tanda tangan ke Google Drive
 * @param {string} base64Data - Data gambar dalam format base64
 * @param {string} mimeType - Tipe MIME (mis. 'image/png')
 * @returns {Object} Hasil {success, fileId, message}
 */
function uploadSignature(base64Data, mimeType, clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    var cleanBase64 = base64Data;
    if (base64Data.indexOf(',') !== -1) {
      var parts = base64Data.split(',');
      cleanBase64 = parts[1];
      if (!mimeType || mimeType.indexOf('/') === -1) {
        mimeType = parts[0].match(/:(.*?);/)[1];
      }
    }
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType || 'image/png', 'signature_' + email.replace('@', '_') + '.png');

    var folder = getOrCreateOutputFolder();
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();

    // Perbarui referensi di sheet Users
    var rowIndex = findRowByKey('Users', email, 1);
    if (rowIndex !== -1) {
      var sheet = getSheet('Users');
      // Hapus file lama jika ada
      var oldFileId = sheet.getRange(rowIndex, 6).getValue();
      if (oldFileId) {
        try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) { /* abaikan */ }
      }
      sheet.getRange(rowIndex, 6).setValue(fileId);
    }

    return { success: true, fileId: fileId, message: 'Tanda tangan berhasil diupload.' };
  } catch (e) {
    Logger.log('Error uploadSignature: ' + e.message);
    return { success: false, fileId: '', message: 'Gagal upload tanda tangan: ' + e.message };
  }
}

/**
 * Upload foto profil ke Google Drive
 * @param {string} base64Data - Data gambar dalam format base64
 * @param {string} mimeType - Tipe MIME
 * @returns {Object} Hasil {success, fileId, message}
 */
function uploadProfilePhoto(base64Data, mimeType, clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    var cleanBase64 = base64Data;
    if (base64Data.indexOf(',') !== -1) {
      var parts = base64Data.split(',');
      cleanBase64 = parts[1];
      if (!mimeType || mimeType.indexOf('/') === -1) {
        mimeType = parts[0].match(/:(.*?);/)[1];
      }
    }
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType || 'image/jpeg', 'photo_' + email.replace('@', '_') + '.jpg');

    var folder = getOrCreateOutputFolder();
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();

    // Perbarui referensi di sheet Users
    var rowIndex = findRowByKey('Users', email, 1);
    if (rowIndex !== -1) {
      var sheet = getSheet('Users');
      // Hapus file lama jika ada
      var oldFileId = sheet.getRange(rowIndex, 7).getValue();
      if (oldFileId) {
        try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) { /* abaikan */ }
      }
      sheet.getRange(rowIndex, 7).setValue(fileId);
    }

    return { success: true, fileId: fileId, message: 'Foto profil berhasil diupload.' };
  } catch (e) {
    Logger.log('Error uploadProfilePhoto: ' + e.message);
    return { success: false, fileId: '', message: 'Gagal upload foto profil: ' + e.message };
  }
}

/**
 * Upload banyak foto kegiatan untuk laporan ke Google Drive
 * @param {Array<string>} base64DataArray - Array data base64 foto-foto
 * @param {Array<string>} mimeTypes - Array tipe MIME untuk setiap foto
 * @returns {Object} Hasil {success, fileIds, message}
 */
function uploadReportPhotos(base64DataArray, mimeTypes) {
  try {
    var fileIds = [];
    var folder = getOrCreatePhotosFolder();

    for (var i = 0; i < base64DataArray.length; i++) {
      var decoded = Utilities.base64Decode(base64DataArray[i]);
      var blob = Utilities.newBlob(decoded, mimeTypes[i], 'foto_kegiatan_' + (i + 1) + '_' + Date.now() + '.jpg');
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileIds.push(file.getId());
    }

    return { success: true, fileIds: fileIds, message: fileIds.length + ' foto berhasil diupload.' };
  } catch (e) {
    Logger.log('Error uploadReportPhotos: ' + e.message);
    return { success: false, fileIds: [], message: 'Gagal upload foto: ' + e.message };
  }
}

// ============================================
// FUNGSI DROPDOWN
// ============================================

/**
 * Mengambil data Jenis RHK unik untuk dropdown di klien
 * @returns {Array<string>} Daftar jenis RHK unik
 */
function getRHKDropdownData() {
  return getUniqueJenisRHK();
}

/**
 * Mengambil pilihan Rencana Aksi berdasarkan Jenis RHK
 * @param {string} jenisRHK - Jenis RHK yang dipilih
 * @returns {Array<string>} Daftar rencana aksi
 */
function getRencanaAksiOptions(jenisRHK) {
  return getRencanaAksiByJenis(jenisRHK);
}

/**
 * Mengambil pilihan Modul P2K2 untuk dropdown
 * @returns {Array<string>} Daftar modul P2K2
 */
function getP2K2ModulOptions() {
  return getUniqueModulP2K2();
}

/**
 * Mengambil pilihan Sesi P2K2 berdasarkan modul
 * @param {string} modul - Modul yang dipilih
 * @returns {Array<string>} Daftar sesi P2K2
 */
function getP2K2SesiOptions(modul) {
  return getSesiByModul(modul);
}

/**
 * Memeriksa apakah Jenis RHK terkait P2K2
 * @param {string} jenisRHK - Teks jenis RHK
 * @returns {boolean} True jika P2K2
 */
function isP2K2(jenisRHK) {
  return isP2K2RelatedRHK(jenisRHK);
}

// ============================================
// MANAJEMEN LAPORAN
// ============================================

/**
 * Mengambil laporan pengguna dengan paginasi, pencarian, dan filter (status & bulan)
 * Dipanggil oleh client javascript: google.script.run.getUserReports()
 * @param {number} page - Nomor halaman (dimulai dari 1)
 * @param {number} pageSize - Jumlah item per halaman
 * @param {string} searchTerm - Kata kunci pencarian (opsional)
 * @param {string} filterJenis - Filter Jenis RHK (ID RHK) (opsional)
 * @param {string} filterRencanaAksi - Filter Rencana Aksi (opsional)
 * @param {string} filterMonth - Filter bulan format 'YYYY-MM' (opsional)
 * @returns {Object} {data, total, page, pageSize}
 */
function getUserReports(options, clientEmail) {
  try {
    var page = options.page || 1;
    var pageSize = options.pageSize || 10;
    var searchTerm = options.searchTerm || '';
    var filterJenis = options.filterJenis || '';
    var filterRencanaAksi = options.filterRencanaAksi || '';
    var filterMonth = options.filterDate || '';
    
    var email = clientEmail || Session.getActiveUser().getEmail();
    
    // Cari spreadsheet milik user (dari mobile app)
    var userSSId = resolveUserSpreadsheet(email);
    var allReports = [];
    
    if (userSSId) {
      // Baca dari spreadsheet user (format mobile)
      allReports = getAllDataFromUserSS(userSSId, 'Laporan_Log');
      // Mobile format: semua data sudah milik user ini, tidak perlu filter email
    } else {
      // Fallback: baca dari spreadsheet admin (format web) dan filter per email
      allReports = getAllData('Laporan_Log');
      allReports = allReports.filter(function(r) {
        return r.Email && email && normalizeEmail(r.Email) === normalizeEmail(email);
      });
    }

    // Filter berdasarkan Jenis RHK (ID RHK seperti RHK-1)
    if (filterJenis && filterJenis !== '' && filterJenis !== 'Semua') {
      allReports = allReports.filter(function(r) {
        return r.IdRHK === filterJenis;
      });
    }

    // Filter berdasarkan Rencana Aksi
    if (filterRencanaAksi && filterRencanaAksi !== '' && filterRencanaAksi !== 'Semua') {
      allReports = allReports.filter(function(r) {
        return r.RencanaAksi === filterRencanaAksi;
      });
    }

    // Filter berdasarkan bulan
    if (filterMonth && filterMonth !== '') {
      var targetMonth = String(filterMonth).substring(0, 7);
      allReports = allReports.filter(function(r) {
        if (!r.Tanggal && !r.CreatedAt) return false;
        var rDateStr = r.Tanggal || r.CreatedAt;
        var rDate = new Date(rDateStr);
        if (isNaN(rDate.getTime())) return false;
        var y = rDate.getFullYear();
        var m = ('0' + (rDate.getMonth() + 1)).slice(-2);
        return (y + '-' + m) === targetMonth;
      });
    }

    // Filter berdasarkan kata kunci pencarian
    if (searchTerm && searchTerm.trim() !== '') {
      var term = searchTerm.toLowerCase();
      allReports = allReports.filter(function(r) {
        return (r.JenisRHK && String(r.JenisRHK).toLowerCase().indexOf(term) !== -1) ||
               (r.RencanaAksi && String(r.RencanaAksi).toLowerCase().indexOf(term) !== -1) ||
               (r.IdRHK && String(r.IdRHK).toLowerCase().indexOf(term) !== -1) ||
               (r.Lokasi && String(r.Lokasi).toLowerCase().indexOf(term) !== -1) ||
               (r.PhysicalLokasi && String(r.PhysicalLokasi).toLowerCase().indexOf(term) !== -1) ||
               (r.PoinKegiatan && String(r.PoinKegiatan).toLowerCase().indexOf(term) !== -1);
      });
    }

    // Urutkan berdasarkan tanggal terbaru
    allReports.sort(function(a, b) {
      return new Date(b.CreatedAt || b.Tanggal || 0) - new Date(a.CreatedAt || a.Tanggal || 0);
    });

    var total = allReports.length;
    var startIndex = ((page || 1) - 1) * (pageSize || 10);
    var paginatedData = allReports.slice(startIndex, startIndex + (pageSize || 10));

    // Transformasi data ke format yang diharapkan client
    var clientData = paginatedData.map(function(r) {
      // Thumbnail: coba ambil dari FotoIds
      var thumbUrl = '';
      var tId = r.ThumbnailId || '';
      if (!tId && r.FotoIds) {
        try {
          var fIds = typeof r.FotoIds === 'string' ? JSON.parse(r.FotoIds) : r.FotoIds;
          if (fIds && fIds.length > 0) {
            tId = fIds[0];
          }
        } catch(e) {}
      }
      if (tId) {
        thumbUrl = 'https://drive.google.com/thumbnail?id=' + tId + '&sz=w150';
      }
      
      // Tanggal
      var tanggalStr = '';
      if (r.Tanggal) {
        if (r.Tanggal instanceof Date) {
          tanggalStr = r.Tanggal.toISOString();
        } else {
          var testDate = new Date(r.Tanggal);
          if (!isNaN(testDate.getTime())) {
            tanggalStr = testDate.toISOString();
          } else {
            tanggalStr = String(r.Tanggal);
          }
        }
      }
      
      // Lokasi (mobile pakai PhysicalLokasi, web pakai Lokasi)
      var lokasi = r.Lokasi || r.PhysicalLokasi || '';
      if (!lokasi) {
        lokasi = 'Tidak ada lokasi';
      }
      
      return {
        id: r.ReportId,
        ReportId: r.ReportId,
        thumbnail: thumbUrl,
        ThumbnailId: tId,
        tanggal: tanggalStr,
        Tanggal: tanggalStr,
        jenisRhk: r.IdRHK || r.JenisRHK || 'RHK',
        JenisRHK: r.JenisRHK || '',
        IdRHK: r.IdRHK || '',
        rencanaAksi: r.RencanaAksi,
        RencanaAksi: r.RencanaAksi || '',
        status: r.Status || 'Draft',
        Status: r.Status || 'Draft',
        pdfUrl: r.PdfUrl || '',
        PdfFileId: r.PdfFileId || '',
        lokasi: lokasi,
        Lokasi: lokasi,
        physicalLokasi: r.PhysicalLokasi || lokasi,
        PoinKegiatan: r.PoinKegiatan || '',
        NarasiAI: r.NarasiAI || '',
        NarasiEdited: r.NarasiEdited || '',
        FotoIds: String(r.FotoIds || ''),
        P2K2Data: typeof r.P2K2Data === 'object' ? JSON.stringify(r.P2K2Data) : String(r.P2K2Data || ''),
        Pukul: r.Pukul instanceof Date ? Utilities.formatDate(r.Pukul, Session.getScriptTimeZone(), "HH:mm") : String(r.Pukul || '')
      };
    });

    var folderUrl = '';
    try {
      folderUrl = getOrCreateOutputFolder().getUrl();
    } catch (fErr) {
      Logger.log('Error getting folder url: ' + fErr.message);
    }

    return {
      data: clientData,
      total: total,
      page: page || 1,
      pageSize: pageSize || 10,
      folderUrl: folderUrl
    };
  } catch (e) {
    Logger.log('Error getUserReports: ' + e.message);
    return { data: [], total: 0, page: page || 1, pageSize: pageSize || 10, folderUrl: '' };
  }
}

/**
 * Menghapus laporan RHK dari database dan membersihkan file terkait di Google Drive
 * @param {string} reportId - ID laporan
 * @returns {Object} Hasil operasi {success, message}
 */
function deleteReportLog(reportId, clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    var rowIndex = findReportRowIndex(reportId);
    if (rowIndex === -1) {
      throw new Error('Laporan tidak ditemukan.');
    }
    
    var sheet = getSheet('Laporan_Log');
    var rowEmail = sheet.getRange(rowIndex, 2).getValue();
    if (normalizeEmail(rowEmail) !== normalizeEmail(email)) {
      throw new Error('Akses ditolak. Anda hanya dapat menghapus laporan Anda sendiri.');
    }
    
    // Hapus file PDF di Drive jika ada
    var pdfFileId = sheet.getRange(rowIndex, 13).getValue();
    if (pdfFileId) {
      try { DriveApp.getFileById(pdfFileId).setTrashed(true); } catch(e) {}
    }
    
    // Hapus foto-foto kegiatan jika ada
    var fotoIdsStr = sheet.getRange(rowIndex, 14).getValue();
    if (fotoIdsStr) {
      try {
        var fotoIds = JSON.parse(fotoIdsStr);
        for (var i = 0; i < fotoIds.length; i++) {
          try { DriveApp.getFileById(fotoIds[i]).setTrashed(true); } catch(e) {}
        }
      } catch(e) {}
    }
    
    deleteRow('Laporan_Log', rowIndex);
    return { success: true, message: 'Laporan berhasil dihapus.' };
  } catch (e) {
    Logger.log('Error deleteReportLog: ' + e.message);
    return { success: false, message: 'Gagal menghapus laporan: ' + e.message };
  }
}

/**
 * Menyimpan data laporan baru ke Laporan_Log dengan status Draft
 * @param {Object} formData - Data formulir laporan
 * @returns {Object} Hasil {success, reportId, message}
 */
function submitReportData(formData, clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    var reportId = generateReportId();

    // Tentukan ID RHK dari data master
    var allRHK = getAllData('Master_RHK');
    var idRHK = '';
    for (var i = 0; i < allRHK.length; i++) {
      if (allRHK[i].JENIS_RHK === formData.jenisRHK) {
        idRHK = allRHK[i].ID;
        break;
      }
    }

    // Siapkan data P2K2 dalam format JSON jika ada
    var p2k2DataJson = '';
    if (formData.p2k2Data) {
      p2k2DataJson = JSON.stringify(formData.p2k2Data);
    }

    // Siapkan foto IDs dalam format JSON jika ada
    var fotoIdsJson = '';
    if (formData.fotoIds && formData.fotoIds.length > 0) {
      fotoIdsJson = JSON.stringify(formData.fotoIds);
    }

    var row = [
      reportId,
      email,
      formData.tanggal || new Date().toISOString(),
      formData.jenisRHK || '',
      idRHK,
      formData.rencanaAksi || '',
      formData.lokasi || '',
      formData.poinKegiatan || '',
      '',  // NarasiAI - akan diisi oleh Gemini
      '',  // NarasiEdited - akan diisi pengguna
      'Draft',
      '',  // PdfUrl
      '',  // PdfFileId
      fotoIdsJson,
      p2k2DataJson,
      formData.thumbnailId || '',
      new Date().toISOString()
    ];

    appendRow('Laporan_Log', row);
    return { success: true, reportId: reportId, message: 'Laporan berhasil disimpan sebagai Draft.' };
  } catch (e) {
    Logger.log('Error submitReportData: ' + e.message);
    return { success: false, reportId: '', message: 'Gagal menyimpan laporan: ' + e.message };
  }
}

/**
 * Memanggil GeminiService untuk membuat narasi laporan
 * @param {string} reportId - ID laporan
 * @returns {Object} Hasil {success, narrative, message}
 */
function generateNarrative(reportId) {
  try {
    var narrative = generateReportNarrative(reportId);
    return { success: true, narrative: narrative, message: 'Narasi berhasil dibuat oleh AI.' };
  } catch (e) {
    Logger.log('Error generateNarrative: ' + e.message);
    return { success: false, narrative: '', message: 'Gagal membuat narasi: ' + e.message };
  }
}

/**
 * Menyimpan narasi yang sudah diedit pengguna
 * @param {string} reportId - ID laporan
 * @param {string} editedNarrative - Narasi yang sudah diedit
 * @returns {Object} Hasil {success, message}
 */
function saveEditedNarrative(reportId, editedNarrative) {
  try {
    var rowIndex = findReportRowIndex(reportId);
    if (rowIndex === -1) {
      throw new Error('Laporan tidak ditemukan: ' + reportId);
    }

    var sheet = getSheet('Laporan_Log');
    // Kolom NarasiEdited = kolom 10
    sheet.getRange(rowIndex, 10).setValue(editedNarrative);
    return { success: true, message: 'Narasi berhasil disimpan.' };
  } catch (e) {
    Logger.log('Error saveEditedNarrative: ' + e.message);
    return { success: false, message: 'Gagal menyimpan narasi: ' + e.message };
  }
}

/**
 * Membuat PDF dari laporan, simpan ke Drive, update status
 * @param {string} reportId - ID laporan
 * @returns {Object} Hasil {success, pdfUrl, message}
 */
function generatePDF(reportId) {
  try {
    var result = createReportPDF(reportId);

    // Perbarui status laporan menjadi Selesai
    var rowIndex = findReportRowIndex(reportId);
    if (rowIndex !== -1) {
      var sheet = getSheet('Laporan_Log');
      sheet.getRange(rowIndex, 11).setValue('Selesai');    // Status
      sheet.getRange(rowIndex, 12).setValue(result.pdfUrl); // PdfUrl
      sheet.getRange(rowIndex, 13).setValue(result.pdfFileId); // PdfFileId
    }

    return { success: true, pdfUrl: result.pdfUrl, message: 'PDF berhasil dibuat.' };
  } catch (e) {
    Logger.log('Error generatePDF: ' + e.message);
    return { success: false, pdfUrl: '', message: 'Gagal membuat PDF: ' + e.message };
  }
}

/**
 * Menyalin file PDF ke folder Drive yang ditentukan pengguna
 * @param {string} reportId - ID laporan
 * @param {string} targetFolderId - ID folder tujuan di Drive
 * @returns {Object} Hasil {success, message}
 */
function downloadPdfToDrive(reportId, targetFolderId) {
  try {
    var rowIndex = findReportRowIndex(reportId);
    if (rowIndex === -1) {
      throw new Error('Laporan tidak ditemukan.');
    }

    var sheet = getSheet('Laporan_Log');
    var pdfFileId = sheet.getRange(rowIndex, 13).getValue();

    if (!pdfFileId) {
      throw new Error('PDF belum dibuat untuk laporan ini.');
    }

    var pdfFile = DriveApp.getFileById(pdfFileId);
    var targetFolder = DriveApp.getFolderById(targetFolderId);
    pdfFile.makeCopy(pdfFile.getName(), targetFolder);

    return { success: true, message: 'PDF berhasil disalin ke folder Drive Anda.' };
  } catch (e) {
    Logger.log('Error downloadPdfToDrive: ' + e.message);
    return { success: false, message: 'Gagal menyalin PDF: ' + e.message };
  }
}

/**
 * Mengambil detail laporan berdasarkan ID
 * @param {string} reportId - ID laporan
 * @returns {Object|null} Data laporan atau null jika tidak ditemukan
 */
function getReportById(reportId) {
  try {
    var rowIndex = findReportRowIndex(reportId);
    if (rowIndex === -1) return null;

    var sheet = getSheet('Laporan_Log');
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var rowData = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

    var report = {};
    for (var i = 0; i < headers.length; i++) {
      report[headers[i]] = rowData[i];
    }

    // Parse JSON fields
    if (report.FotoIds && typeof report.FotoIds === 'string') {
      try { report.FotoIds = JSON.parse(report.FotoIds); } catch (e) { report.FotoIds = []; }
    }
    if (report.P2K2Data && typeof report.P2K2Data === 'string') {
      try { report.P2K2Data = JSON.parse(report.P2K2Data); } catch (e) { report.P2K2Data = null; }
    }

    return report;
  } catch (e) {
    Logger.log('Error getReportById: ' + e.message);
    return null;
  }
}

// ============================================
// FUNGSI ADMIN
// ============================================

/**
 * Memeriksa apakah pengguna saat ini adalah admin
 * @returns {boolean} True jika admin
 */
function isCurrentUserAdmin(clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    var rowIndex = findRowByKey('Users', email, 1);
    if (rowIndex === -1) return false;
    var isAdmin = getSheet('Users').getRange(rowIndex, 8).getValue();
    return isAdmin === true || isAdmin === 'TRUE';
  } catch (e) {
    return false;
  }
}

/**
 * Admin: Menambah baris baru ke Master_RHK
 * @param {Object} data - {id, jenisRHK, rencanaAksi}
 * @returns {Object} Hasil operasi
 */
function addMasterRHKRow(data, clientEmail) {
  try {
    if (!isCurrentUserAdmin(clientEmail)) throw new Error('Akses ditolak. Hanya admin yang dapat mengubah data master.');
    appendRow('Master_RHK', [data.id, data.jenisRHK, data.rencanaAksi]);
    return { success: true, message: 'Data RHK berhasil ditambahkan.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Admin: Memperbarui baris di Master_RHK
 * @param {number} rowIndex - Indeks baris (1-indexed)
 * @param {Object} data - {id, jenisRHK, rencanaAksi}
 * @returns {Object} Hasil operasi
 */
function updateMasterRHKRow(rowIndex, data, clientEmail) {
  try {
    if (!isCurrentUserAdmin(clientEmail)) throw new Error('Akses ditolak.');
    updateRow('Master_RHK', rowIndex, [data.id, data.jenisRHK, data.rencanaAksi]);
    return { success: true, message: 'Data RHK berhasil diperbarui.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Admin: Menghapus baris dari Master_RHK
 * @param {number} rowIndex - Indeks baris (1-indexed)
 * @returns {Object} Hasil operasi
 */
function deleteMasterRHKRow(rowIndex, clientEmail) {
  try {
    if (!isCurrentUserAdmin(clientEmail)) throw new Error('Akses ditolak.');
    deleteRow('Master_RHK', rowIndex);
    return { success: true, message: 'Data RHK berhasil dihapus.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Admin: Menambah baris baru ke Master_P2K2
 * @param {Object} data - {id, modul, sesi}
 * @returns {Object} Hasil operasi
 */
function addMasterP2K2Row(data, clientEmail) {
  try {
    if (!isCurrentUserAdmin(clientEmail)) throw new Error('Akses ditolak.');
    appendRow('Master_P2K2', [data.id, data.modul, data.sesi]);
    return { success: true, message: 'Data P2K2 berhasil ditambahkan.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Admin: Memperbarui baris di Master_P2K2
 * @param {number} rowIndex - Indeks baris (1-indexed)
 * @param {Object} data - {id, modul, sesi}
 * @returns {Object} Hasil operasi
 */
function updateMasterP2K2Row(rowIndex, data, clientEmail) {
  try {
    if (!isCurrentUserAdmin(clientEmail)) throw new Error('Akses ditolak.');
    updateRow('Master_P2K2', rowIndex, [data.id, data.modul, data.sesi]);
    return { success: true, message: 'Data P2K2 berhasil diperbarui.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Admin: Menghapus baris dari Master_P2K2
 * @param {number} rowIndex - Indeks baris (1-indexed)
 * @returns {Object} Hasil operasi
 */
function deleteMasterP2K2Row(rowIndex, clientEmail) {
  try {
    if (!isCurrentUserAdmin(clientEmail)) throw new Error('Akses ditolak.');
    deleteRow('Master_P2K2', rowIndex);
    return { success: true, message: 'Data P2K2 berhasil dihapus.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Mengambil semua data Master RHK untuk panel admin
 * @returns {Array<Object>} Data master RHK
 */
function getMasterRHKData() {
  return getAllData('Master_RHK');
}

/**
 * Mengambil semua data Master P2K2 untuk panel admin
 * @returns {Array<Object>} Data master P2K2
 */
function getMasterP2K2Data() {
  return getAllData('Master_P2K2');
}

/**
 * Menjalankan proses setup database (inisialisasi semua sheet dan data master)
 * @returns {Object} Hasil setup
 */
function runSetup() {
  return setupDatabase();
}

// ============================================
// FUNGSI BRIDGE (Penghubung Client ↔ Server)
// ============================================
// Fungsi-fungsi di bawah ini menyelaraskan nama fungsi
// yang dipanggil oleh JavaScript.html (client) dengan
// fungsi-fungsi server yang sudah ada di atas.

/**
 * Mengambil statistik dashboard: total, bulan ini, draft, selesai
 * Dipanggil oleh: google.script.run.getDashboardStats()
 * @returns {Object} {total, month, pending, done}
 */
function getDashboardStats(clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    
    // Cari spreadsheet milik user (dari mobile app)
    var userSSId = resolveUserSpreadsheet(email);
    var userReports = [];
    
    if (userSSId) {
      // Baca dari spreadsheet user (format mobile) — semua data sudah milik user
      userReports = getAllDataFromUserSS(userSSId, 'Laporan_Log');
    } else {
      // Fallback: baca dari spreadsheet admin (format web) dan filter per email
      var allReports = getAllData('Laporan_Log');
      userReports = allReports.filter(function(r) {
        return r.Email && email && normalizeEmail(r.Email) === normalizeEmail(email);
      });
    }
    
    var now = new Date();
    var currentMonth = now.getMonth();
    var currentYear = now.getFullYear();
    
    var monthCount = 0;
    var draftCount = 0;
    var doneCount = 0;
    
    for (var i = 0; i < userReports.length; i++) {
      var r = userReports[i];
      // Hitung bulan ini
      var rDate = new Date(r.Tanggal || r.CreatedAt);
      if (!isNaN(rDate.getTime()) && rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear) {
        monthCount++;
      }
      // Hitung berdasarkan status
      if (r.Status === 'Draft') draftCount++;
      if (r.Status === 'Selesai') doneCount++;
    }
    
    return {
      total: userReports.length,
      month: monthCount,
      pending: draftCount,
      done: doneCount
    };
  } catch (e) {
    Logger.log('Error getDashboardStats: ' + e.message);
    return { total: 0, month: 0, pending: 0, done: 0 };
  }
}

/**
 * Mengambil semua data RHK untuk dropdown form dengan format yang diharapkan client
 * Dipanggil oleh: google.script.run.getRHKOptions()
 * @returns {Array<Object>} Array {id, jenisRhk, rencanaAksi, isP2K2}
 */
function getRHKOptions() {
  try {
    var data = getAllData('Master_RHK');
    return data.map(function(row) {
      return {
        id: row.ID,
        jenisRhk: row.JENIS_RHK,
        rencanaAksi: row.RENCANA_AKSI,
        isP2K2: isP2K2RelatedRHK(row.JENIS_RHK)
      };
    });
  } catch (e) {
    Logger.log('Error getRHKOptions: ' + e.message);
    return [];
  }
}

/**
 * Mengambil daftar modul P2K2 unik untuk dropdown
 * Dipanggil oleh: google.script.run.getP2K2Moduls()
 * @returns {Array<Object>} Array {id, modul}
 */
function getP2K2Moduls() {
  try {
    var data = getAllData('Master_P2K2');
    var seen = {};
    var result = [];
    for (var i = 0; i < data.length; i++) {
      var modul = data[i].MODUL;
      if (modul && !seen[modul]) {
        seen[modul] = true;
        result.push({ id: data[i].ID, modul: modul });
      }
    }
    return result;
  } catch (e) {
    Logger.log('Error getP2K2Moduls: ' + e.message);
    return [];
  }
}

/**
 * Mengambil daftar sesi P2K2 berdasarkan ID modul
 * Dipanggil oleh: google.script.run.getP2K2Sessions(modulId)
 * @param {string} modulId - ID modul yang dipilih (misal: 'p2k201')
 * @returns {Array<Object>} Array {id, sesi}
 */
function getP2K2Sessions(modulId) {
  try {
    var data = getAllData('Master_P2K2');
    // Ambil nama modul dari ID pertama yang cocok
    var modulName = '';
    for (var i = 0; i < data.length; i++) {
      if (data[i].ID === modulId) {
        modulName = data[i].MODUL;
        break;
      }
    }
    // Filter semua sesi yang sesuai modul
    var result = [];
    for (var j = 0; j < data.length; j++) {
      if (data[j].MODUL === modulName) {
        result.push({ id: data[j].ID, sesi: data[j].SESI });
      }
    }
    return result;
  } catch (e) {
    Logger.log('Error getP2K2Sessions: ' + e.message);
    return [];
  }
}

/**
 * Menyimpan/memperbarui profil pengguna dari halaman Pengaturan
 * Dipanggil oleh: google.script.run.saveUserProfile(data)
 * @param {Object} data - {name, nip, jabatan, kabupaten}
 * @returns {Object} Hasil operasi
 */
function saveUserProfile(data) {
  return updateUserProfile({
    nama: data.name,
    nip: data.nip,
    jabatan: data.jabatan,
    kabupatenKota: data.kabupaten
  });
}

// getUserProfile override removed as it is now integrated in the primary function.

/**
 * Menyimpan narasi yang sudah diedit
 * Dipanggil oleh: google.script.run.saveNarrative(reportId, narrative)
 * @param {string} reportId - ID laporan
 * @param {string} narrative - Narasi yang sudah diedit
 */
function saveNarrative(reportId, narrative) {
  return saveEditedNarrative(reportId, narrative);
}

/**
 * Mengambil narasi laporan untuk ditampilkan di preview
 * Dipanggil oleh: google.script.run.getReportNarrative(reportId)
 * @param {string} reportId - ID laporan
 * @returns {string} Narasi laporan
 */
function getReportNarrative(reportId) {
  try {
    var report = getReportById(reportId);
    if (!report) return '';
    return report.NarasiEdited || report.NarasiAI || '';
  } catch (e) {
    Logger.log('Error getReportNarrative: ' + e.message);
    return '';
  }
}

/**
 * Mengunduh/membuka PDF laporan
 * Dipanggil oleh: google.script.run.downloadReport(reportId)
 * @param {string} reportId - ID laporan
 * @returns {Object} {url} URL file PDF
 */
function downloadReport(reportId) {
  try {
    var report = getReportById(reportId);
    if (!report) throw new Error('Laporan tidak ditemukan.');
    
    if (!report.PdfUrl || !report.PdfFileId) {
      throw new Error('PDF belum dibuat untuk laporan ini.');
    }
    
    // Simpan salinan ke folder Drive user
    try {
      var outputFolder = getOrCreateOutputFolder();
      // PDF sudah ada di output folder, cukup return URL
    } catch (e) {
      Logger.log('Info: ' + e.message);
    }
    
    return { url: report.PdfUrl };
  } catch (e) {
    Logger.log('Error downloadReport: ' + e.message);
    throw new Error(e.message);
  }
}

/**
 * Simpan PDF ke Google Drive user
 * Dipanggil oleh: google.script.run.savePdfToDrive(reportId)
 * @param {string} reportId - ID laporan
 */
function savePdfToDrive(reportId) {
  try {
    var report = getReportById(reportId);
    if (!report || !report.PdfFileId) {
      throw new Error('PDF belum dibuat untuk laporan ini.');
    }
    // PDF sudah di Drive di folder RHK-agent_Output
    return { success: true, message: 'PDF sudah tersimpan di folder RHK-agent_Output di Google Drive Anda.' };
  } catch (e) {
    throw new Error(e.message);
  }
}

/**
 * Mengelola operasi simpan data master (tambah/edit) untuk panel admin
 * Dipanggil oleh: google.script.run.saveMasterData(payload)
 * @param {Object} payload - {type, rowIndex, field1, field2}
 */
function saveMasterData(payload, clientEmail) {
  try {
    if (!isCurrentUserAdmin(clientEmail)) throw new Error('Akses ditolak.');
    
    if (payload.type === 'rhk') {
      // Tentukan ID RHK otomatis
      var id = 'RHK-NEW';
      if (payload.rowIndex !== null && payload.rowIndex !== undefined) {
        // Edit - ambil ID dari baris yang ada
        var allRHK = getAllData('Master_RHK');
        if (allRHK[payload.rowIndex]) {
          id = allRHK[payload.rowIndex].ID;
        }
        updateMasterRHKRow(allRHK[payload.rowIndex]._rowIndex, { id: id, jenisRHK: payload.field1, rencanaAksi: payload.field2 }, clientEmail);
      } else {
        // Tambah baru - cari ID RHK yang sesuai dari jenis yang sama
        var existingRHK = getAllData('Master_RHK');
        var matchingId = '';
        for (var i = 0; i < existingRHK.length; i++) {
          if (existingRHK[i].JENIS_RHK === payload.field1) {
            matchingId = existingRHK[i].ID;
            break;
          }
        }
        if (!matchingId) {
          // Jenis RHK baru, buat ID baru
          var maxNum = 0;
          for (var j = 0; j < existingRHK.length; j++) {
            var num = parseInt(existingRHK[j].ID.replace('RHK-', ''), 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
          matchingId = 'RHK-' + (maxNum + 1);
        }
        addMasterRHKRow({ id: matchingId, jenisRHK: payload.field1, rencanaAksi: payload.field2 }, clientEmail);
      }
    } else if (payload.type === 'p2k2') {
      if (payload.rowIndex !== null && payload.rowIndex !== undefined) {
        var allP2K2 = getAllData('Master_P2K2');
        if (allP2K2[payload.rowIndex]) {
          var existingId = allP2K2[payload.rowIndex].ID;
          updateMasterP2K2Row(allP2K2[payload.rowIndex]._rowIndex, { id: existingId, modul: payload.field1, sesi: payload.field2 }, clientEmail);
        }
      } else {
        // Buat ID baru untuk P2K2
        var allP2 = getAllData('Master_P2K2');
        var maxP2Num = 0;
        for (var k = 0; k < allP2.length; k++) {
          var pNum = parseInt(allP2[k].ID.replace('p2k2', ''), 10);
          if (!isNaN(pNum) && pNum > maxP2Num) maxP2Num = pNum;
        }
        var newP2Id = 'p2k2' + ('00' + (maxP2Num + 1)).slice(-2);
        addMasterP2K2Row({ id: newP2Id, modul: payload.field1, sesi: payload.field2 }, clientEmail);
      }
    }
    
    return { success: true };
  } catch (e) {
    Logger.log('Error saveMasterData: ' + e.message);
    throw new Error(e.message);
  }
}

/**
 * Menghapus data master RHK atau P2K2
 * Dipanggil oleh: google.script.run.deleteMasterData(type, index)
 * @param {string} type - 'rhk' atau 'p2k2'
 * @param {number} index - Indeks dalam array data (0-based)
 */
function deleteMasterData(type, index, clientEmail) {
  try {
    if (!isCurrentUserAdmin(clientEmail)) throw new Error('Akses ditolak.');
    
    var sheetName = type === 'rhk' ? 'Master_RHK' : 'Master_P2K2';
    var allData = getAllData(sheetName);
    
    if (index < 0 || index >= allData.length) {
      throw new Error('Indeks data tidak valid.');
    }
    
    var rowIndex = allData[index]._rowIndex;
    deleteRow(sheetName, rowIndex);
    
    return { success: true };
  } catch (e) {
    Logger.log('Error deleteMasterData: ' + e.message);
    throw new Error(e.message);
  }
}

/**
 * Mengambil data Master RHK dalam format yang diharapkan client
 * Dipanggil oleh: google.script.run.getMasterRHK()
 * @returns {Array<Object>} Array {id, jenisRhk, rencanaAksi}
 */
function getMasterRHK() {
  try {
    var data = getAllData('Master_RHK');
    return data.map(function(row) {
      return {
        id: row.ID,
        jenisRhk: row.JENIS_RHK,
        rencanaAksi: row.RENCANA_AKSI
      };
    });
  } catch (e) {
    Logger.log('Error getMasterRHK: ' + e.message);
    return [];
  }
}

/**
 * Mengambil data Master P2K2 dalam format yang diharapkan client
 * Dipanggil oleh: google.script.run.getMasterP2K2()
 * @returns {Array<Object>} Array {id, modul, sesi}
 */
function getMasterP2K2() {
  try {
    var data = getAllData('Master_P2K2');
    return data.map(function(row) {
      return {
        id: row.ID,
        modul: row.MODUL,
        sesi: row.SESI
      };
    });
  } catch (e) {
    Logger.log('Error getMasterP2K2: ' + e.message);
    return [];
  }
}

/**
 * Override submitReportData untuk menerima format data dari client JavaScript
 * Client mengirim: {jenisRhkId, rencanaAksi, tanggal, lokasi, poin, photos[], p2k2{}}
 * Dipanggil oleh: google.script.run.submitReportData(formData)
 * @param {Object} formData - Data dari form client
 * @returns {Object} {reportId}
 */
var _originalSubmitReportData = submitReportData;
submitReportData = function(formData, clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    
    var isEdit = false;
    var rowIndex = -1;
    var fotoIds = [];
    var thumbnailId = '';
    
    if (formData.reportId) {
      rowIndex = findReportRowIndex(formData.reportId);
      if (rowIndex !== -1) {
        isEdit = true;
        var existingReport = getReportById(formData.reportId);
        if (existingReport) {
          fotoIds = existingReport.FotoIds || [];
          thumbnailId = existingReport.ThumbnailId || '';
        }
      }
    }
    
    var reportId = isEdit ? formData.reportId : generateReportId();
    
    // Resolve jenis RHK dari ID (e.g., 'RHK-2' -> full text)
    var allRHK = getAllData('Master_RHK');
    var jenisRHK = '';
    var idRHK = formData.jenisRhkId || '';
    for (var i = 0; i < allRHK.length; i++) {
      if (allRHK[i].ID === idRHK) {
        jenisRHK = allRHK[i].JENIS_RHK;
        break;
      }
    }
    
    // Upload foto jika ada
    if (formData.photos && formData.photos.length > 0) {
      try {
        var base64Array = [];
        var mimeTypes = [];
        for (var p = 0; p < formData.photos.length; p++) {
          // base64 dari client berformat "data:image/jpeg;base64,..."
          var parts = formData.photos[p].base64.split(',');
          var mime = parts[0].match(/:(.*?);/)[1];
          base64Array.push(parts[1]); // hanya bagian base64 tanpa header
          mimeTypes.push(mime);
        }
        var uploadResult = uploadReportPhotos(base64Array, mimeTypes);
        if (uploadResult.success) {
          // Hapus foto lama di Drive jika mengedit
          if (isEdit && fotoIds.length > 0) {
            for (var f = 0; f < fotoIds.length; f++) {
              try { DriveApp.getFileById(fotoIds[f]).setTrashed(true); } catch (e) { /* silent */ }
            }
          }
          fotoIds = uploadResult.fileIds;
          thumbnailId = fotoIds[0] || ''; // foto pertama sebagai thumbnail
        }
      } catch (photoErr) {
        Logger.log('Warning: gagal upload foto: ' + photoErr.message);
      }
    }
    
    // Siapkan data P2K2
    var p2k2DataJson = '';
    if (formData.p2k2) {
      // Resolve modul dan sesi dari ID
      var allP2K2 = getAllData('Master_P2K2');
      var modulName = '';
      var sesiName = '';
      for (var m = 0; m < allP2K2.length; m++) {
        if (allP2K2[m].ID === formData.p2k2.modulId) modulName = allP2K2[m].MODUL;
        if (allP2K2[m].ID === formData.p2k2.sesiId) sesiName = allP2K2[m].SESI;
      }
      p2k2DataJson = JSON.stringify({
        modul: modulName,
        sesi: sesiName,
        jumlahKPM: formData.p2k2.jumlahKpm || '',
        jumlahHadir: formData.p2k2.jumlahHadir || '',
        namaKelompok: formData.p2k2.namaKelompok || '',
        ketuaKelompok: formData.p2k2.ketuaKelompok || ''
      });
    }
    
    var row = [
      reportId,
      email,
      formData.tanggal || new Date().toISOString(),
      jenisRHK,
      idRHK,
      formData.rencanaAksi || '',
      formData.lokasi || '', // pukul jam
      formData.poin || '',
      '',  // NarasiAI
      '',  // NarasiEdited
      'Draft',
      '',  // PdfUrl
      '',  // PdfFileId
      JSON.stringify(fotoIds),
      p2k2DataJson,
      thumbnailId,
      new Date().toISOString()
    ];
    
    if (isEdit) {
      // Hapus PDF lama di Drive jika ada
      var existingReport = getReportById(reportId);
      if (existingReport && existingReport.PdfFileId) {
        try { DriveApp.getFileById(existingReport.PdfFileId).setTrashed(true); } catch (e) { /* silent */ }
      }
      updateRow('Laporan_Log', rowIndex, row);
    } else {
      appendRow('Laporan_Log', row);
    }
    
    return { reportId: reportId };
  } catch (e) {
    Logger.log('Error submitReportData (bridge): ' + e.message);
    throw new Error('Gagal menyimpan laporan: ' + e.message);
  }
};

/**
 * Override generateNarrative untuk return narasi langsung (bukan objek)
 * Client mengharapkan string narrative langsung
 * Dipanggil oleh: google.script.run.generateNarrative(reportId)
 * @param {string} reportId - ID laporan
 * @returns {string} Teks narasi
 */
var _originalGenerateNarrative = generateNarrative;
generateNarrative = function(reportId) {
  try {
    var narrative = generateReportNarrative(reportId);
    return narrative || '';
  } catch (e) {
    Logger.log('Error generateNarrative (bridge): ' + e.message);
    throw new Error('Gagal membuat narasi: ' + e.message);
  }
};

// getUserReports override removed as it is now integrated in the primary function.

/**
 * Mengambil Gemini API Key jika user adalah admin
 * @returns {string} API Key (atau kosong)
 */
function getGeminiAPIKeyForAdmin(clientEmail) {
  if (!isCurrentUserAdmin(clientEmail)) {
    throw new Error('Akses ditolak. Hanya admin yang dapat mengambil API Key.');
  }
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
}

/**
 * Menyimpan Gemini API Key jika user adalah admin
 * @param {string} apiKey - API Key yang baru
 * @returns {Object} Hasil operasi
 */
function saveGeminiAPIKey(apiKey, clientEmail) {
  if (!isCurrentUserAdmin(clientEmail)) {
    throw new Error('Akses ditolak. Hanya admin yang dapat menyimpan API Key.');
  }
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey ? apiKey.trim() : '');
  return { success: true, message: 'Gemini API Key berhasil disimpan.' };
}

/**
 * Menguji koneksi Gemini API
 * @param {string} [tempApiKey] - API Key sementara untuk dites (opsional)
 * @returns {Object} Hasil pengujian
 */
function testGeminiConnection(tempApiKey, clientEmail) {
  if (!isCurrentUserAdmin(clientEmail)) {
    throw new Error('Akses ditolak. Hanya admin yang dapat menguji koneksi API.');
  }
  if (typeof testGeminiAPIConnection !== 'function') {
    throw new Error('Fungsi testGeminiAPIConnection tidak ditemukan.');
  }
  return testGeminiAPIConnection(tempApiKey);
}

/**
 * Mengambil konfigurasi AI lengkap jika user adalah admin
 * @returns {Object} Konfigurasi AI
 */
function getAIConfigForAdmin(clientEmail) {
  if (!isCurrentUserAdmin(clientEmail)) {
    throw new Error('Akses ditolak. Hanya admin yang dapat melihat konfigurasi AI.');
  }
  var props = PropertiesService.getScriptProperties();
  return {
    provider: props.getProperty('AI_PROVIDER') || 'google',
    geminiKey: props.getProperty('GEMINI_API_KEY') || '',
    groqKey: props.getProperty('GROQ_API_KEY') || '',
    openrouterKey: props.getProperty('OPENROUTER_API_KEY') || '',
    model: props.getProperty('AI_MODEL') || ''
  };
}

/**
 * Menyimpan konfigurasi AI jika user adalah admin
 * @param {Object} config - Konfigurasi AI yang baru
 * @returns {Object} Hasil operasi
 */
function saveAIConfig(config, clientEmail) {
  if (!isCurrentUserAdmin(clientEmail)) {
    throw new Error('Akses ditolak. Hanya admin yang dapat menyimpan konfigurasi AI.');
  }
  var props = PropertiesService.getScriptProperties();
  props.setProperty('AI_PROVIDER', config.provider || 'google');
  props.setProperty('GEMINI_API_KEY', config.geminiKey ? config.geminiKey.trim() : '');
  props.setProperty('GROQ_API_KEY', config.groqKey ? config.groqKey.trim() : '');
  props.setProperty('OPENROUTER_API_KEY', config.openrouterKey ? config.openrouterKey.trim() : '');
  props.setProperty('AI_MODEL', config.model ? config.model.trim() : '');
  return { success: true, message: 'Konfigurasi AI berhasil disimpan.' };
}

/**
 * Menguji koneksi AI untuk provider tertentu
 * @param {string} provider - Google, Groq, atau OpenRouter
 * @param {string} apiKey - API Key sementara untuk dites
 * @param {string} model - Model AI yang dites
 * @returns {Object} Hasil pengujian
 */
function testAIConnection(provider, apiKey, model, clientEmail) {
  if (!isCurrentUserAdmin(clientEmail)) {
    throw new Error('Akses ditolak. Hanya admin yang dapat menguji koneksi API.');
  }
  if (typeof testAIAPIConnection !== 'function') {
    throw new Error('Fungsi testAIAPIConnection tidak ditemukan.');
  }
  return testAIAPIConnection(provider, apiKey, model);
}

/**
 * Upload logo Kemensos resmi ke Google Drive (Khusus Admin)
 * @param {string} base64Data - Data gambar dalam format base64
 * @param {string} mimeType - Tipe MIME
 * @returns {Object} Hasil {success, fileId, message}
 */
function uploadKemensosLogo(base64Data, mimeType, clientEmail) {
  try {
    if (!isCurrentUserAdmin(clientEmail)) {
      throw new Error('Akses ditolak. Hanya admin yang dapat mengganti logo kop surat.');
    }
    var cleanBase64 = base64Data;
    if (base64Data.indexOf(',') !== -1) {
      var parts = base64Data.split(',');
      cleanBase64 = parts[1];
      if (!mimeType || mimeType.indexOf('/') === -1) {
        mimeType = parts[0].match(/:(.*?);/)[1];
      }
    }
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType || 'image/png', 'logo_kemensos_kop.png');

    var folder = getOrCreateOutputFolder();
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();

    // Simpan ke sheet Config
    var sheet = getSheet('Config');
    var rowIndex = findRowByKey('Config', 'LOGO_KEMENSOS_ID', 1);
    if (rowIndex === -1) {
      appendRow('Config', ['LOGO_KEMENSOS_ID', fileId]);
    } else {
      sheet.getRange(rowIndex, 2).setValue(fileId);
    }

    return { success: true, fileId: fileId, message: 'Logo Kemensos berhasil diupload.' };
  } catch (e) {
    Logger.log('Error uploadKemensosLogo: ' + e.message);
    return { success: false, fileId: '', message: 'Gagal upload logo: ' + e.message };
  }
}

/**
 * Mengambil URL pratinjau logo Kemensos dari Drive
 * @returns {string} URL pratinjau logo
 */
function getKemensosLogoUrl() {
  var fileId = getKemensosLogoId();
  if (!fileId) return '';
  return 'https://drive.google.com/uc?export=view&id=' + fileId;
}

/**
 * Mencari indeks baris laporan berdasarkan ReportId secara dinamis (tanpa hardcode kolom ID)
 * @param {string} reportId - ID Laporan yang dicari
 * @returns {number} Indeks baris (1-indexed) atau -1 jika tidak ditemukan
 */
function findReportRowIndex(reportId) {
  try {
    var sheet = getSheet('Laporan_Log');
    var lastCol = sheet.getLastColumn();
    if (lastCol <= 0) return -1;
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    var idColIndex = 1; // fallback ke kolom 1
    for (var h = 0; h < headers.length; h++) {
      if (String(headers[h]).toLowerCase().replace(/[^a-z0-9]/g, '') === 'reportid') {
        idColIndex = h + 1;
        break;
      }
    }
    return findRowByKey('Laporan_Log', reportId, idColIndex);
  } catch (e) {
    Logger.log('Error findReportRowIndex: ' + e.message);
    return -1;
  }
}

function extractPhysicalLocationFallback(poin, narasi) {
  var text = (poin || '') + '\n' + (narasi || '');
  if (!text) return '';
  var matches = text.match(/(?:lokasi\s*kegiatan|lokasi fisik|lokasi)\s*[:\-]\s*([^\n\.,;]+)/i);
  if (matches && matches[1]) {
    return matches[1].trim();
  }
  return '';
}

/**
 * Menormalkan alamat email (khusus gmail.com, mengabaikan titik)
 * agar pencocokan data lebih akurat meskipun user salah ketik titik.
 */
function normalizeEmail(emailStr) {
  if (!emailStr) return '';
  var e = String(emailStr).toLowerCase().trim();
  var parts = e.split('@');
  if (parts.length === 2 && parts[1] === 'gmail.com') {
    return parts[0].replace(/\./g, '') + '@gmail.com';
  }
  return e;
}

// ============================================
// BRIDGE FUNGSI KPM UNTUK WEB APP / FRONTEND
// ============================================

function apiSaveKpmProfile(payload) {
  return saveKpmProfile(payload);
}

function apiGetKpmDetails(kpmId) {
  return getKpmDetails(kpmId);
}

function apiDeleteKpmProfile(kpmId) {
  return deleteKpmProfile(kpmId);
}

function apiGetKpmList() {
  return getKpmList();
}

// ============================================
// BRIDGE FUNGSI PENGADUAN UNTUK FRONTEND
// ============================================

function apiSavePengaduan(payload) {
  return savePengaduan(payload);
}

function apiGetPengaduanList(clientEmail) {
  return getPengaduanList(clientEmail);
}

function apiDeletePengaduan(id, clientEmail) {
  return deletePengaduan(id, clientEmail);
}

// ============================================
// BRIDGE FUNGSI NOTA DINAS UNTUK FRONTEND
// ============================================

function apiSaveNotaDinas(payload) {
  return saveNotaDinas(payload);
}

function apiGetNotaDinasList(clientEmail) {
  return getNotaDinasList(clientEmail);
}

function apiDeleteNotaDinas(id, clientEmail) {
  return deleteNotaDinas(id, clientEmail);
}

// ============================================
// BRIDGE FUNGSI EKSTRAKSI KTP DENGAN AI
// ============================================

/**
 * Ekstraksi NIK dan Nama dari gambar KTP base64
 * @param {string} base64Image - Data gambar base64
 * @param {string} mimeType - Tipe MIME gambar
 * @returns {Object} Hasil {success, nik, nama, message}
 */
function apiExtractKtpData(base64Image, mimeType) {
  try {
    var cleanBase64 = base64Image;
    if (base64Image.indexOf(',') !== -1) {
      var parts = base64Image.split(',');
      cleanBase64 = parts[1];
      if (!mimeType || mimeType.indexOf('/') === -1) {
        mimeType = parts[0].match(/:(.*?);/)[1];
      }
    }
    
    var imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanBase64
      }
    };
    
    var prompt = "Ekstrak data dari KTP ini. Kembalikan data dalam format JSON yang valid dengan format objek berikut: { \"nik\": \"16 digit NIK\", \"nama\": \"Nama lengkap sesuai KTP\" }. Jangan sertakan karakter formatting markdown (seperti ```json) atau penjelasan lain. Cukup kembalikan objek JSON mentah saja.";
    
    var responseText = callAIService(prompt, [imagePart]);
    Logger.log("KTP Extraction Response: " + responseText);
    
    // Bersihkan markdown jika ada
    var cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    var data = JSON.parse(cleanJson);
    
    return {
      success: true,
      nik: data.nik || '',
      nama: data.nama || ''
    };
  } catch (e) {
    Logger.log('Error apiExtractKtpData: ' + e.message);
    return { success: false, message: 'Gagal mengekstrak KTP: ' + e.message };
  }
}

// ============================================
// BRIDGE FUNGSI PEMBUATAN PDF UNTUK FRONTEND
// ============================================

function apiCreateNotaDinasPdf(notaDinasId, clientEmail) {
  return createNotaDinasPDFServer(notaDinasId, clientEmail);
}

function apiCreateVerkomPdf(csvData, fileName, clientEmail) {
  return createVerkomPDFServer(csvData, fileName, clientEmail);
}

// ============================================
// BRIDGE UNTUK PENGADUAN DENGAN BERKAS
// ============================================

function apiSaveComplaintWithFiles(payload, clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    var id = 'ADU-' + Date.now();
    
    var fotoKtpId = '';
    var screenshotSiksId = '';
    
    var folder = getOrCreatePhotosFolder();
    
    if (payload.fotoKtpBase64) {
      try {
        var ktpParts = payload.fotoKtpBase64.split(',');
        var ktpMime = ktpParts[0].match(/:(.*?);/)[1];
        var ktpDecoded = Utilities.base64Decode(ktpParts[1]);
        var ktpBlob = Utilities.newBlob(ktpDecoded, ktpMime, id + '_ktp.jpg');
        var ktpFile = folder.createFile(ktpBlob);
        ktpFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fotoKtpId = ktpFile.getId();
      } catch (err) {
        Logger.log('Gagal upload KTP: ' + err.message);
      }
    }
    
    if (payload.siksBase64) {
      try {
        var siksParts = payload.siksBase64.split(',');
        var siksMime = siksParts[0].match(/:(.*?);/)[1];
        var siksDecoded = Utilities.base64Decode(siksParts[1]);
        var siksBlob = Utilities.newBlob(siksDecoded, siksMime, id + '_siks.jpg');
        var siksFile = folder.createFile(siksBlob);
        siksFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        screenshotSiksId = siksFile.getId();
      } catch (err) {
        Logger.log('Gagal upload SIKS: ' + err.message);
      }
    }
    
    var complaintData = {
      id: id,
      email: email,
      nik: payload.nik,
      nama: payload.nama,
      alamat: payload.alamat,
      desaKelurahan: payload.desaKelurahan,
      kecamatan: payload.kecamatan,
      kabKota: payload.kabKota,
      aduan: payload.aduan,
      hasilAnalisa: payload.hasilAnalisa,
      latitude: payload.latitude,
      longitude: payload.longitude,
      fotoKtp: fotoKtpId,
      screenshotSiks: screenshotSiksId,
      pdfFileId: '',
      createdAt: new Date().toISOString()
    };
    
    try {
      var pdfResult = createComplaintPDFServer(complaintData);
      if (pdfResult.success) {
        complaintData.pdfFileId = pdfResult.pdfFileId;
      }
    } catch(pdfErr) {
      Logger.log('Warning: gagal membuat PDF pengaduan: ' + pdfErr.message);
    }
    
    return savePengaduan(complaintData);
  } catch (e) {
    Logger.log('Error apiSaveComplaintWithFiles: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ============================================
// BRIDGE UNTUK NOTA DINAS DENGAN BERKAS
// ============================================

function apiSaveNotaDinasWithFiles(payload, clientEmail) {
  try {
    var email = clientEmail || Session.getActiveUser().getEmail();
    var id = 'ND-' + Date.now();
    
    var buktiDukungId = '';
    if (payload.fotoBase64) {
      try {
        var folder = getOrCreatePhotosFolder();
        var parts = payload.fotoBase64.split(',');
        var mime = parts[0].match(/:(.*?);/)[1];
        var decoded = Utilities.base64Decode(parts[1]);
        var blob = Utilities.newBlob(decoded, mime, id + '_bukti.jpg');
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        buktiDukungId = file.getId();
      } catch (err) {
        Logger.log('Gagal upload bukti dukung Nota Dinas: ' + err.message);
      }
    }
    
    var ndData = {
      id: id,
      email: email,
      nomor: payload.nomor,
      yth: payload.yth,
      dari: payload.dari,
      hal: payload.hal,
      lampiran: payload.lampiran,
      sifat: payload.sifat,
      tanggal: payload.tanggal,
      poinDraft: payload.poinDraft,
      isiNotaDinas: payload.isiNotaDinas,
      pdfFileId: '',
      createdAt: new Date().toISOString(),
      buktiDukung: buktiDukungId
    };
    
    return saveNotaDinas(ndData);
  } catch (e) {
    Logger.log('Error apiSaveNotaDinasWithFiles: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ============================================
// BRIDGE ADMIN UNTUK FRONTEND
// ============================================

function getAllMasterP2K2() {
  return getAllData('Master_P2K2');
}

function saveMasterRowData(payload) {
  try {
    if (!isCurrentUserAdmin()) {
      throw new Error('Akses ditolak. Hanya admin yang dapat mengubah data master.');
    }
    
    var sheetName = payload.type === 'rhk' ? 'Master_RHK' : 'Master_P2K2';
    
    var rowData = [
      payload.id,
      payload.val1,
      payload.val2
    ];
    
    if (payload.rowIndex) {
      updateRow(sheetName, payload.rowIndex, rowData);
      return { success: true, message: 'Data master berhasil diperbarui.' };
    } else {
      var existingRow = findRowByKey(sheetName, payload.id, 1);
      if (existingRow !== -1) {
        return { success: false, message: 'ID ' + payload.id + ' sudah digunakan.' };
      }
      appendRow(sheetName, rowData);
      return { success: true, message: 'Data master berhasil ditambahkan.' };
    }
  } catch (e) {
    Logger.log('Error saveMasterRowData: ' + e.message);
    return { success: false, message: e.message };
  }
}

function deleteMasterRowData(masterType, rowIndex) {
  try {
    if (!isCurrentUserAdmin()) {
      throw new Error('Akses ditolak. Hanya admin yang dapat menghapus data master.');
    }
    
    var sheetName = masterType === 'rhk' ? 'Master_RHK' : 'Master_P2K2';
    deleteRow(sheetName, rowIndex);
    return { success: true, message: 'Data master berhasil dihapus.' };
  } catch (e) {
    Logger.log('Error deleteMasterRowData: ' + e.message);
    return { success: false, message: e.message };
  }
}


