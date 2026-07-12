function extractDriveId(str) {
  if (!str) return '';
  let match = str.match(/[-\w]{25,}/);
  return match ? match[0] : str;
}

function parseRobustDate(dateStr, timeStr) {
  if (!dateStr) return 0;
  if (!timeStr) timeStr = '00:00';
  let d = dateStr.toString().trim().toLowerCase();
  
  // Hapus nama hari bahasa Indonesia
  d = d.replace(/senin,?|selasa,?|rabu,?|kamis,?|jumat,?|jum\'at,?|sabtu,?|minggu,?/g, '').trim();
  
  const monthsId = {
      'januari': 0, 'jan': 0,
      'februari': 1, 'feb': 1,
      'maret': 2, 'mar': 2,
      'april': 3, 'apr': 3,
      'mei': 4, 
      'juni': 5, 'jun': 5,
      'juli': 6, 'jul': 6,
      'agustus': 7, 'agu': 7,
      'september': 8, 'sep': 8,
      'oktober': 9, 'okt': 9,
      'november': 10, 'nov': 10,
      'desember': 11, 'des': 11
  };
  
  for (let m in monthsId) {
      if (d.includes(m)) {
          d = d.replace(m, ' ' + monthsId[m] + ' ');
          let p = d.trim().split(/\s+/);
          if (p.length >= 3) {
              let day = parseInt(p[0]);
              let month = parseInt(p[1]);
              let year = parseInt(p[2]);
              let hour = parseInt(timeStr.split(':')[0]) || 0;
              let min = parseInt(timeStr.split(':')[1]) || 0;
              let res = new Date(year, month, day, hour, min, 0).getTime();
              if (!isNaN(res)) return res;
          }
          break;
      }
  }

  let parts = d.split(/[-/\\]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      year = parseInt(parts[0]); month = parseInt(parts[1]) - 1; day = parseInt(parts[2]);
    } else {
      day = parseInt(parts[0]); month = parseInt(parts[1]) - 1; year = parseInt(parts[2]);
      if (month > 11) { 
        let temp = day; day = month + 1; month = temp - 1; 
      }
      if (year < 100) year += 2000;
    }
    let hour = parseInt(timeStr.split(':')[0]) || 0;
    let min = parseInt(timeStr.split(':')[1]) || 0;
    let res = new Date(year, month, day, hour, min, 0).getTime();
    if (!isNaN(res)) return res;
  }
  let raw = new Date(dateStr + ' ' + timeStr).getTime();
  return isNaN(raw) ? 0 : raw;
}

/**
 * ==========================================
 * ClientServices.js - Pengganti Google Apps Script
 * ==========================================
 * Menangani logika interaksi langsung ke Google Sheets API 
 * dan Google Drive API (tanpa perantara Server/GAS)
 */

// URL Web App dari deployment Code.gs (Wajib diisi oleh Admin agar fitur Premium berjalan)
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyIvZiC8dqOsr6CWKtLkU8MfZzX5sLJRcX5L9seKAM7bAa9CsLld-OBY472d_7ILc-D_A/exec";

/**
 * Memanggil fungsi backend Code.gs via API (doPost)
 */
async function callGoogleScript(functionName, args, successCallback, errorCallback) {
  if (WEB_APP_URL === "ISI_DENGAN_URL_WEB_APP_ANDA") {
    console.warn("WEB_APP_URL belum diatur! Fitur backend (seperti Premium) tidak akan berjalan.");
    if (errorCallback) errorCallback(new Error("WEB_APP_URL belum diatur."));
    return;
  }
  
  try {
    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        functionName: functionName,
        arguments: args
      })
    });
    
    const result = await response.json();
    if (result.success) {
      if (successCallback) successCallback(result);
    } else {
      if (errorCallback) errorCallback(new Error(result.message));
    }
  } catch (err) {
    console.error("Gagal memanggil backend Code.gs:", err);
    if (errorCallback) errorCallback(err);
  }
}

// Konstanta API
const API_KEY = ''; // Kosongkan, kita menggunakan OAuth Token (GSI)
const DISCOVERY_DOCS = [
  'https://sheets.googleapis.com/$discovery/rest?version=v4',
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];

/**
 * Inisialisasi Google API Client (GAPI)
 * Dipanggil setelah script apis.google.com/js/api.js termuat
 */
function initGoogleApiClient() {
  return new Promise((resolve, reject) => {
    gapi.load('client', () => {
      gapi.client.init({
        discoveryDocs: DISCOVERY_DOCS
      }).then(() => {
        console.log('GAPI Client Initialized');
        // Set token jika sudah ada dari GSI
        const token = localStorage.getItem('google_access_token');
        if (token) {
          gapi.client.setToken({ access_token: token });
        }
        resolve();
      }).catch(err => {
        console.error('Error initializing GAPI client', err);
        reject(err);
      });
    });
  });
}

/**
 * Mencari atau membuat Spreadsheet Master "Aspend Database"
 * Fungsi ini setara dengan proses di DataService.gs (setupDatabase)
 */
async function locateOrCreateSpreadsheet() {
  try {
    const response = await gapi.client.drive.files.list({
      q: "name='Aspend Database' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and 'me' in owners",
      fields: 'files(id, name)'
    });
    
    let files = response.result.files;
    if (files && files.length > 0) {
      console.log('Spreadsheet ditemukan:', files[0].id);
      return files[0].id;
    } else {
      console.warn('Spreadsheet tidak ditemukan. Membatalkan inisialisasi.');
      throw new Error("ASPEND_DATABASE_NOT_FOUND");
    }
  } catch (err) {
    console.error('Error mencari spreadsheet:', err);
    throw err;
  }
}

// Inisialisasi GAPI saat script dimuat
if (typeof gapi !== 'undefined') {
  initGoogleApiClient();
} else {
  window.addEventListener('load', initGoogleApiClient);
}

/**
 * ============================================
 * ============================================
 * FUNGSI DASHBOARD & LAPORAN
 * ============================================
 */

/**
 * Mengambil profil dari Sheet Profile
 */
async function fetchUserProfileClient(spreadsheetId, userEmail) {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Profile!A2:E'
    });
    
    const rows = response.result.values || [];
    for (const row of rows) {
      if (row[0] && row[0].toString().trim().toLowerCase() === userEmail.toLowerCase()) {
        return {
          email: row[0] || '',
          nama: row[1] || '',
          nip: row[2] || '',
          jabatan: row[3] || '',
          kabupaten: row[4] || ''
        };
      }
    }
    return null; // Not found
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return null;
  }
}

/**
 * Mengambil pengaturan AI dari Sheet Config
 */
async function fetchConfigClient(spreadsheetId) {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Config!A2:B'
    });
    
    const rows = response.result.values || [];
    let config = {};
    for (const row of rows) {
      if (row[0]) {
        config[row[0]] = row[1] || '';
      }
    }
    return config;
  } catch (err) {
    console.warn("Error fetching config (Config sheet might not exist):", err);
    return null;
  }
}

/**
 * Menyimpan pengaturan AI ke Sheet Config
 */
async function saveConfigClient(spreadsheetId, configData) {
  try {
    // Siapkan data dalam bentuk array [Key, Value]
    const values = [
      ['AI_PROVIDER', configData.provider || 'openrouter'],
      ['AI_API_KEY', configData.apiKey || ''],
      ['AI_MODEL', configData.model || '']
    ];
    
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: 'Config!A2:B4',
      valueInputOption: 'RAW',
      resource: {
        values: values
      }
    });
    return true;
  } catch (err) {
    console.error("Error saving config:", err);
    return false;
  }
}

/**
 * Mengambil rekap statistik dan daftar laporan RHK
 */
async function fetchDashboardDataClient(spreadsheetId, userEmail, options = {}) {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Laporan_Log!A2:Q'
    });
    
    const rows = response.result.values || [];
    let reports = rows.map(row => ({
      ReportId: row[0] || ('TMP_' + Math.random().toString(36).substr(2,9)),
      Tanggal: row[1] || '',
      JenisRHK: row[2] || '',
      IdRHK: row[3] || '',
      RencanaAksi: row[4] || '',
      Pukul: row[5] || '',
      PoinKegiatan: row[6] || '',
      NarasiAI: row[7] || '',
      NarasiEdited: row[8] || '',
      Status: row[9] || '',
      PdfFileId: row[10] || '',
      FotoIds: (() => {
        let val = row[11];
        if (!val) return [];
        try { 
            let parsed = JSON.parse(val); 
            if (Array.isArray(parsed)) return parsed.map(extractDriveId);
        } catch(e) {} 
        return [extractDriveId(val)];
      })(),
      P2K2Data: (() => {
        try { return row[12] ? JSON.parse(row[12]) : null; } 
        catch(e) { return null; } 
      })(),
      Lokasi: row[13] || '',
      CreatedAt: row[14] || ''
    }));
    
    // TIDAK PERLU FILTER EMAIL KARENA FILE MILIK PRIBADI USER
    
    // Urutkan terbaru di atas
    reports.sort((a, b) => {
      let pukulA = (a.Pukul && a.Pukul !== '-') ? a.Pukul.toString().trim().substring(0,5) : '00:00';
      let pukulB = (b.Pukul && b.Pukul !== '-') ? b.Pukul.toString().trim().substring(0,5) : '00:00';
      let timeA = parseRobustDate(a.Tanggal, pukulA);
      let timeB = parseRobustDate(b.Tanggal, pukulB);
      // Fallback ke CreatedAt jika Tanggal juga kosong
      if (timeA === 0) timeA = new Date(a.CreatedAt || 0).getTime();
      if (timeB === 0) timeB = new Date(b.CreatedAt || 0).getTime();
      return timeB - timeA;
    });
    
    // Kalkulasi Statistik Keseluruhan (Sebelum Filter)
    const currentMonth = new Date().toISOString().substring(0, 7);
    const reportsThisMonth = reports.filter(r => r.Tanggal && r.Tanggal.startsWith(currentMonth));
    const monthCount = reportsThisMonth.length;
    
    // RHK Breakdown untuk bulan ini
    const rhkBreakdown = {};
    reportsThisMonth.forEach(r => {
      let id = r.IdRHK || r.JenisRHK || '';
      let angka = id.replace(/\D/g, '') || '?';
      let key = 'RHK-' + angka;
      if (key !== 'RHK-?') {
        rhkBreakdown[key] = (rhkBreakdown[key] || 0) + 1;
      }
    });

    const stats = {
      total: reports.length,
      month: monthCount,
      rhkBreakdown: rhkBreakdown,
      pending: reports.filter(r => (r.Status || '').toLowerCase() === 'draft').length,
      done: reports.filter(r => (r.Status || '').toLowerCase() !== 'draft').length
    };

    // Filter Pencarian Teks
    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      reports = reports.filter(r => 
        (r.JenisRHK || '').toLowerCase().includes(term) ||
        (r.RencanaAksi || '').toLowerCase().includes(term) ||
        (r.PoinKegiatan || '').toLowerCase().includes(term) ||
        (r.NarasiAI || '').toLowerCase().includes(term) ||
        (r.IdRHK || '').toLowerCase().includes(term)
      );
    }
    
    // Filter Jenis RHK
    if (options.filterJenis) {
      reports = reports.filter(r => r.IdRHK === options.filterJenis || r.JenisRHK === options.filterJenis);
    }
    
    // Helper format ISO Date
    function toISODate(dateStr) {
      let time = parseRobustDate(dateStr, '00:00');
      if (time === 0) return '';
      let d = new Date(time);
      let mm = String(d.getMonth() + 1).padStart(2, '0');
      let dd = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    }

    // Filter Rencana Aksi
    if (options.filterRencanaAksi) {
      const target = options.filterRencanaAksi.trim().toLowerCase();
      reports = reports.filter(r => (r.RencanaAksi || '').toLowerCase().includes(target));
    }
    
    // Filter Tanggal Spesifik
    if (options.filterDate) {
      reports = reports.filter(r => toISODate(r.Tanggal) === options.filterDate);
    }
    
    // Filter Bulan
    if (options.filterMonth) {
      reports = reports.filter(r => toISODate(r.Tanggal).startsWith(options.filterMonth));
    }

    return {
      stats: stats,
      list: { data: reports, total: reports.length }
    };
  } catch (err) {
    console.error('fetchDashboardDataClient error:', err);
    throw err;
  }
}

/**
 * Mengunggah gambar Base64 ke Google Drive dan mengembalikan File ID
 */
async function uploadImageToDriveClient(base64Data, fileName) {
  try {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    
    // Pecah mimeType dan Base64 string
    const match = base64Data.match(/^data:(image\/[a-zA-Z]*);base64,([^\"]*)$/);
    if (!match) throw new Error("Format gambar tidak didukung.");
    const mimeType = match[1];
    const base64Str = match[2];

    const metadata = {
      'name': fileName,
      'mimeType': mimeType
    };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + mimeType + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        base64Str +
        close_delim;

    const request = gapi.client.request({
        'path': '/upload/drive/v3/files',
        'method': 'POST',
        'params': {'uploadType': 'multipart'},
        'headers': {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
    });
    
    const response = await request;
    return response.result.id;
  } catch (err) {
    console.error('Gagal mengunggah gambar:', err);
    throw err;
  }
}

/**
 * Menyimpan Laporan Baru ke Google Sheets
 */
async function submitReportDataClient(spreadsheetId, userEmail, payload) {
  try {
    const dateStr = payload.tanggal || new Date().toISOString().substring(0, 10);
    const nowStr = new Date().toISOString();
    let reportId = payload.reportId || 'REP-' + Date.now();
    
    // Unggah foto jika ada
    const fotoIds = [];
    if (payload.photos && payload.photos.length > 0) {
      for (let i = 0; i < payload.photos.length; i++) {
         const p = payload.photos[i];
         // Jika foto sudah berupa ID (string bukan objek base64), lewati
         if (typeof p === 'string' && !p.startsWith('data:')) {
           fotoIds.push(p);
         } else if (p.base64) {
           const fId = await uploadImageToDriveClient(p.base64, 'Foto_' + reportId + '_' + i + '.jpg');
           fotoIds.push(fId);
         }
      }
    }
    const thumbnailId = fotoIds.length > 0 ? fotoIds[0] : '';
    
    // Susun array baris 15 kolom murni (sesuai toSheetRow Mobile App)
    const newRow = [
      reportId,                 // 0: id
      dateStr,                  // 1: tanggal
      'Laporan RHK',            // 2: jenisRHK
      payload.jenisRhkId,       // 3: idRHK
      payload.rencanaAksi,      // 4: rencanaAksi
      '-',                      // 5: pukul
      payload.poin,             // 6: poinKegiatan
      '',                       // 7: narasiAI
      '',                       // 8: narasiEdited
      'Draft',                  // 9: status
      '',                       // 10: pdfFileId
      JSON.stringify(fotoIds),  // 11: fotoIds
      payload.p2k2 ? JSON.stringify(payload.p2k2) : '', // 12: p2k2Data
      payload.lokasi,           // 13: physicalLokasi
      nowStr                    // 14: createdAt
    ];
    
    // Append ke Laporan_Log
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: 'Laporan_Log!A:O',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });
    
    return { success: true, reportId: reportId };
  } catch(err) {
    console.error('Gagal menyimpan laporan:', err);
    throw err;
  }
}

/**
 * Memanggil Gemini API langsung dari Browser
 */

async function generateNarrativeClient(spreadsheetId, reportId) {
  try {
    // 1. API Key OpenRouter Ditanam Secara Permanen (Hardcoded)
    const OPENROUTER_API_KEY = "sk-or-v1-xxxxxxxxxxxxxxxxx"; // <- Kunci API tersimpan di sini
    
    // 2. Ambil data spesifik dari Laporan
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Laporan_Log!A:O'
    });
    
    const rows = response.result.values || [];
    const reportRow = rows.find(r => r[0] === reportId);
    if (!reportRow) throw new Error("Data laporan belum masuk ke database.");
    
    // 3. Format Prompt Khusus (Ketentuan Teks Ketat)
    // Poin 1: Tanggal di-format, Poin 2: Dasar Hukum -> Dasar
    const prompt = `Buatkan narasi laporan kegiatan dengan aturan SANGAT KETAT:
1. JANGAN gunakan teks pengantar apa pun (langsung isinya).
2. Format tanggal sesuai nama hari (contoh: Jumat, 3 Juli 2026).
3. Gunakan sub-judul numerik (1., 2., 3.).
4. Judul poin referensi gunakan kata "Dasar" (bukan Dasar Hukum).
5. Sejajarkan bullet point dengan rapi menggunakan strip (-) jika ada rincian.

Data Kegiatan:
- Jenis Kegiatan: ${reportRow[2]}
- Rencana Aksi: ${reportRow[4]}
- Tanggal: ${reportRow[1]}
- Lokasi: ${reportRow[13]}
- Poin Uraian: ${reportRow[6]}`;

    // 4. Pilih Model dari Pengaturan (Gemini / Llama)
    let aiModel = localStorage.getItem('aspend_ai_model') || 'google/gemini-flash-1.5';
    let apiKey = '';
    try {
      const keys = JSON.parse(localStorage.getItem('aspend_aiKeys') || '{}');
      apiKey = keys.openrouter || '';
    } catch(e) { console.error('Failed parsing aiKeys'); }
    
    if (!apiKey) {
      throw new Error("Kunci API OpenRouter belum dikonfigurasi. Silakan atur di menu Pengaturan.");
    }
    
    // 5. Panggil OpenRouter API
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://aspend-web.app',
        'X-Title': 'ASPEND Web'
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const resJson = await aiResponse.json();
    if (resJson.choices && resJson.choices[0].message.content) {
      let narasi = resJson.choices[0].message.content.trim();
      
      // Simpan narasi ke Sheet (Kolom H = NarasiAI)
      const rowIndex = rows.findIndex(r => r[0] === reportId) + 1;
      if (rowIndex > 0) {
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId,
          range: `Laporan_Log!H${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [[narasi]] }
        });
      }
      return narasi;
    } else {
      throw new Error("Gagal mendapatkan respon dari AI.");
    }
  } catch (err) {
    console.error("AI Error:", err);
    throw err;
  }
}

/**
 * Menyimpan laporan yang telah diedit manual ke Google Sheets (Client-side)
 */
async function saveEditedReportClient(spreadsheetId, reportId, newData) {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Laporan_Log!A:O'
    });
    const rows = response.result.values || [];
    const rowIndex = rows.findIndex(r => r[0] === reportId) + 1;
    
    if (rowIndex > 0) {
      const existingRow = rows[rowIndex - 1];
      // Pastikan array memiliki panjang minimal 15 (sampai kolom O)
      while (existingRow.length < 15) existingRow.push('');
      
      existingRow[1] = newData.tanggal || existingRow[1];
      existingRow[2] = newData.jenisRHK || existingRow[2];
      existingRow[4] = newData.rencanaAksi || existingRow[4];
      existingRow[5] = newData.pukul || existingRow[5];
      existingRow[8] = newData.narasiEdited || existingRow[8];
      existingRow[9] = 'Selesai';
      if (newData.fotoIds) {
        existingRow[11] = Array.isArray(newData.fotoIds) ? JSON.stringify(newData.fotoIds) : newData.fotoIds;
      }
      
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `Laporan_Log!A${rowIndex}:O${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [existingRow] }
      });
      return true;
    }
    return false;
  } catch(err) {
    console.error("Gagal menyimpan narasi:", err);
    throw err;
  }
}


/**
 * Menimpa (Overwrite) File PDF di Google Drive
 */
async function updatePdfInDrive(fileId, blob) {
  try {
    const accessToken = localStorage.getItem('google_access_token');
    
    if (!accessToken) {
      throw new Error("Sesi Google tidak valid atau Token kedaluwarsa. Silakan masuk kembali.");
    }
    
    // Gunakan Fetch API langsung ke endpoint upload media Google Drive v3
    // Menggunakan PATCH akan memperbarui konten file tanpa mengubah ID-nya
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/pdf'
      },
      body: blob
    });
    
    if (!response.ok) {
      const errData = await response.json();
      console.error("Google Drive API Error:", errData);
      throw new Error("Gagal menimpa PDF ke Google Drive. Pastikan berkas lama belum dihapus.");
    }
    
    return await response.json();
  } catch(err) {
    console.error("Kesalahan updatePdfInDrive:", err);
    throw err;
  }
}


// ── FUNGSI PENGHAPUS MANDIRI (PENGGANTI GAS DELETE) ─────────────
async function getSheetIdByName(spreadsheetId, sheetName) {
  const response = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId
  });
  const sheet = response.result.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error("Sheet tidak ditemukan: " + sheetName);
  return sheet.properties.sheetId;
}

async function findRowIndexById(spreadsheetId, sheetName, idValue) {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!A:A`
  });
  const rows = response.result.values;
  if (!rows) throw new Error("Sheet kosong.");
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === idValue) {
      return i; // 0-based index for the batchUpdate API
    }
  }
  throw new Error("ID tidak ditemukan.");
}

async function deleteRowClient(idValue, sheetName) {
  const ssId = localStorage.getItem('aspend_spreadsheetId');
  const sheetId = await getSheetIdByName(ssId, sheetName);
  const rowIndex = await findRowIndexById(ssId, sheetName, idValue);
  
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: ssId,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
        }
      }]
    }
  });
}

async function deleteRowByIndexClient(rowIndex1Based, sheetName) {
  const rowIndex0Based = parseInt(rowIndex1Based) - 1;
  const ssId = localStorage.getItem('aspend_spreadsheetId');
  const sheetId = await getSheetIdByName(ssId, sheetName);
  
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: ssId,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: rowIndex0Based,
            endIndex: rowIndex0Based + 1
          }
        }
      }]
    }
  });
}

// ── MODUL PENGADUAN (VERKOM) KLIEN ──────────────────────────────
async function fetchComplaintsDataClient() {
  try {
    const ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) return [];

    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: 'Pengaduan_Log!A2:K'
    });

    const rows = response.result.values || [];
    let complaints = rows.map(row => ({
      AduanId: row[0] || '',
      Tanggal: row[1] || '',
      NIK: row[2] || '',
      Nama: row[3] || '',
      Desa: row[4] || '',
      Kecamatan: row[5] || '',
      KabKota: row[6] || '',
      IsiAduan: row[7] || '',
      HasilAnalisa: row[8] || '',
      GeoLocation: row[9] || '',
      Alamat: row[10] || ''
    }));

    // Urutkan terbaru di atas
    complaints.sort((a,b) => new Date(b.Tanggal || 0) - new Date(a.Tanggal || 0));
    return complaints;
  } catch (err) {
    console.error('Gagal memuat Data Pengaduan:', err);
    throw err;
  }
}

async function saveComplaintClient(data) {
  try {
    const ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) throw new Error("Spreadsheet ID belum diatur.");
    
    // Format tanggal
    const now = new Date();
    const tgl = now.toISOString();

    // ID unik
    const aduanId = "ADU-" + Date.now();
    
    const newRow = [
      aduanId,
      tgl,
      data.nik,
      data.nama,
      data.desa,
      data.kec,
      data.kab,
      data.aduan,
      data.analisa,
      data.lat + "," + data.lng,
      data.alamat
    ];

    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: ssId,
      range: 'Pengaduan_Log!A:K',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });

    return { success: true, AduanId: aduanId };
  } catch (err) {
    console.error('Gagal menyimpan Pengaduan:', err);
    throw err;
  }
}


// ── MODUL NOTA DINAS KLIEN ─────────────────────────────────────
async function fetchNotaDinasDataClient() {
  try {
    const ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) return [];

    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: 'NotaDinas_Log!A2:I'
    });

    const rows = response.result.values || [];
    let list = rows.map(row => ({
      NDId: row[0] || '',
      Tanggal: row[1] || '',
      Nomor: row[2] || '',
      Kepada: row[3] || '',
      Dari: row[4] || '',
      Hal: row[5] || '',
      Isi: row[6] || '',
      FotoIds: (() => {
        try { return row[7] ? JSON.parse(row[7]) : []; }
        catch(e) { return []; }
      })(),
      Status: row[8] || ''
    }));

    list.sort((a,b) => new Date(b.Tanggal || 0) - new Date(a.Tanggal || 0));
    return list;
  } catch (err) {
    console.error('Gagal memuat Data Nota Dinas:', err);
    throw err;
  }
}

async function saveNotaDinasClient(data) {
  try {
    const ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) throw new Error("Spreadsheet ID belum diatur.");
    
    const ndId = "ND-" + Date.now();
    
    const newRow = [
      ndId,
      data.tanggal,
      data.nomor,
      data.kepada,
      data.dari,
      data.hal,
      data.isi,
      "[]",
      "Draft"
    ];

    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: ssId,
      range: 'NotaDinas_Log!A:I',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });

    return { success: true, NDId: ndId };
  } catch (err) {
    console.error('Gagal menyimpan Nota Dinas:', err);
    throw err;
  }
}


// ── MODUL NOTA DINAS KLIEN ─────────────────────────────────────
async function fetchNotaDinasDataClient() {
  try {
    const ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) return [];

    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: 'NotaDinas_Log!A2:I'
    });

    const rows = response.result.values || [];
    let list = rows.map(row => ({
      NDId: row[0] || '',
      Tanggal: row[1] || '',
      Nomor: row[2] || '',
      Kepada: row[3] || '',
      Dari: row[4] || '',
      Hal: row[5] || '',
      Isi: row[6] || '',
      FotoIds: (() => {
        try { return row[7] ? JSON.parse(row[7]) : []; }
        catch(e) { return []; }
      })(),
      Status: row[8] || ''
    }));

    list.sort((a,b) => new Date(b.Tanggal || 0) - new Date(a.Tanggal || 0));
    return list;
  } catch (err) {
    console.error('Gagal memuat Data Nota Dinas:', err);
    throw err;
  }
}

async function saveNotaDinasClient(data) {
  try {
    const ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) throw new Error("Spreadsheet ID belum diatur.");
    
    const ndId = "ND-" + Date.now();
    
    const newRow = [
      ndId,
      data.tanggal,
      data.nomor,
      data.kepada,
      data.dari,
      data.hal,
      data.isi,
      "[]",
      "Draft"
    ];

    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: ssId,
      range: 'NotaDinas_Log!A:I',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });

    return { success: true, NDId: ndId };
  } catch (err) {
    console.error('Gagal menyimpan Nota Dinas:', err);
    throw err;
  }
}


// ── MODUL PENGATURAN ADMIN KLIEN ───────────────────────────────
async function fetchAdminDataClient() {
  try {
    const ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) return { rhk: [], p2k2: [] };

    const resRhk = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: 'Master_RHK!A2:C'
    });
    
    const resP2k2 = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: 'Master_P2K2!A2:B'
    });

    const rhkRows = resRhk.result.values || [];
    let rhkList = rhkRows.map((row, index) => ({
      index: index + 2, // 1-based index (header is 1)
      id: row[0] || '',
      jenis: row[1] || '',
      rencana: row[2] || ''
    }));

    const p2k2Rows = resP2k2.result.values || [];
    let p2k2List = p2k2Rows.map((row, index) => ({
      index: index + 2,
      modul: row[0] || '',
      sesi: row[1] || ''
    }));

    return { rhk: rhkList, p2k2: p2k2List };
  } catch (err) {
    console.error('Gagal memuat Data Admin:', err);
    throw err;
  }
}

async function saveMasterDataClient(sheetName, values, editIndex) {
  try {
    const ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) throw new Error("Spreadsheet ID belum diatur.");

    if (editIndex !== null) {
      // Update existing row
      let range = sheetName + '!A' + editIndex;
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: ssId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [values]
        }
      });
    } else {
      // Append new row
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: ssId,
        range: sheetName + '!A:C',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [values]
        }
      });
    }
  } catch (err) {
    console.error('Gagal menyimpan Master Data:', err);
    throw err;
  }
}

/**
 * Mengecek status Premium dari tab "Premium"
 */
async function checkPremiumStatusClient(spreadsheetId, userEmail) {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Premium!A2:C'
    });
    
    const rows = response.result.values || [];
    for (const row of rows) {
      if (row[0] && row[0].toString().trim().toLowerCase() === userEmail.toLowerCase()) {
        const status = (row[1] || '').toString().trim().toLowerCase();
        if (status === 'aktif') {
          return true;
        }
      }
    }
    return false;
  } catch (err) {
    // Auto-Heal: Jika error "Unable to parse range", sheet belum ada. Buatkan otomatis.
    if (err.result && err.result.error && err.result.error.message && err.result.error.message.includes('Unable to parse range')) {
      console.log("Info Premium: Tab 'Premium' belum ada. Membuat otomatis...");
      try {
        await gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: spreadsheetId,
          resource: { 
            requests: [
              { addSheet: { properties: { title: 'Premium' } } }
            ] 
          }
        });
        
        // Tulis header agar rapi
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId,
          range: 'Premium!A1:C1',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [['Email', 'Status', 'Metode']]
          }
        });
        console.log("Berhasil membuat tab Premium.");
      } catch (createErr) {
        console.error("Gagal membuat tab Premium:", createErr);
      }
    } else {
      console.warn("Error saat membaca tab Premium:", err.message);
    }
    return false;
  }
}

// ============================================
// PREMIUM USERS API WRAPPERS
// ============================================

/**
 * Mengecek status premium ke backend
 */
function apiCheckPremiumStatus(email, successCallback, errorCallback) {
  callGoogleScript('checkPremiumStatusBackend', [email], successCallback, errorCallback);
}

/**
 * Mengambil daftar pengguna premium (Hanya Admin)
 */
function apiGetPremiumUsers(adminEmail, successCallback, errorCallback) {
  callGoogleScript('getPremiumUsers', [adminEmail], successCallback, errorCallback);
}

/**
 * Menambahkan pengguna premium (Hanya Admin)
 */
function apiAddPremiumUser(adminEmail, targetEmail, successCallback, errorCallback) {
  callGoogleScript('addPremiumUser', [adminEmail, targetEmail], successCallback, errorCallback);
}

/**
 * Menghapus pengguna premium (Hanya Admin)
 */
function apiRemovePremiumUser(adminEmail, targetEmail, successCallback, errorCallback) {
  callGoogleScript('removePremiumUser', [adminEmail, targetEmail], successCallback, errorCallback);
}
