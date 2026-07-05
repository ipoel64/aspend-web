/**
 * ==========================================
 * PdfService.gs - Layanan Pembuatan PDF
 * ==========================================
 * Menghasilkan laporan PDF resmi menggunakan Google Docs
 * sebagai template perantara, kemudian mengekspor ke PDF.
 * 
 * Fitur:
 * - Kop surat resmi Kemensos
 * - Header laporan dengan judul dan periode
 * - Isi narasi dengan format yang rapi
 * - Tabel data P2K2 (jika laporan P2K2)
 * - Blok tanda tangan
 * - Lampiran dokumentasi foto kegiatan
 */

// ============================================
// KONSTANTA
// ============================================

/** URL logo Kemensos untuk kop surat */
var KEMENSOS_LOGO_BASE64 = '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';

/** Nama hari dalam bahasa Indonesia */
var NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Nama bulan dalam bahasa Indonesia */
var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// ============================================
// MANAJEMEN FOLDER
// ============================================

/**
 * Mengambil atau membuat folder output 'RHK-agent_Output' di Drive
 * @returns {GoogleAppsScript.Drive.Folder} Folder output
 */
function getOrCreateOutputFolder() {
  var folderName = 'RHK-agent_Output';
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  Logger.log('Membuat folder output baru: ' + folderName);
  return DriveApp.createFolder(folderName);
}

/**
 * Mengambil atau membuat folder bukti dukung 'RHK-agent_Bukti_Dukung' di Drive
 * @returns {GoogleAppsScript.Drive.Folder} Folder foto bukti dukung
 */
function getOrCreatePhotosFolder() {
  var folderName = 'RHK-agent_Bukti_Dukung';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    Logger.log('Membuat folder bukti dukung baru: ' + folderName);
    folder = DriveApp.createFolder(folderName);
  }
  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e) {
    Logger.log('Error sharing photos folder: ' + e.message);
  }
  return folder;
}

/**
 * Mengambil atau membuat folder template 'RHK-agent_Templates' di Drive
 * @returns {GoogleAppsScript.Drive.Folder} Folder template
 */
function getOrCreateTemplateFolder() {
  var folderName = 'RHK-agent_Templates';
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  Logger.log('Membuat folder template baru: ' + folderName);
  return DriveApp.createFolder(folderName);
}

// ============================================
// FUNGSI UTAMA PEMBUATAN PDF
// ============================================

/**
 * Fungsi utama: membuat laporan PDF dari data laporan
 * Alur: Buat Google Doc → Isi konten → Konversi ke PDF → Simpan ke Drive
 * @param {string} reportId - ID laporan
 * @returns {Object} {pdfUrl, pdfFileId} URL dan ID file PDF
 */
function createReportPDF(reportId) {
  try {
    // Ambil data laporan
    var reportData = getReportById(reportId);
    if (!reportData) {
      throw new Error('Laporan dengan ID ' + reportId + ' tidak ditemukan.');
    }

    // Ambil data pengguna
    var email = reportData.Email;
    var userRowIndex = findRowByKey('Users', email, 1);
    var userData = {};
    if (userRowIndex !== -1) {
      var userSheet = getSheet('Users');
      var lastCol = userSheet.getLastColumn();
      var userRow = userSheet.getRange(userRowIndex, 1, 1, lastCol).getValues()[0];
      userData = {
        email: userRow[0] || '',
        nama: userRow[1] || '',
        nip: userRow[2] || '',
        jabatan: userRow[3] || '',
        kabupatenKota: userRow[4] || '',
        signatureFileId: userRow[5] || '',
        photoFileId: userRow[6] || ''
      };
    }

    // Tentukan nama file PDF dengan sequence number jika ada laporan di tanggal dan jenis kegiatan yang sama
    var idRHK = reportData.IdRHK || getIdRHKFromJenis(reportData.JenisRHK);
    var tanggalStr = Utilities.formatDate(new Date(reportData.Tanggal), Session.getScriptTimeZone(), 'yyyyMMdd');
    var rencanaAksiShort = (reportData.RencanaAksi || 'Laporan').substring(0, 60);

    // Cari urutan sequence untuk laporan pada tanggal dan RHK yang sama untuk user ini
    var allLogs = getAllData('Laporan_Log');
    var matchingLogs = allLogs.filter(function(r) {
      if (!r.Email || r.Email.toLowerCase().trim() !== email.toLowerCase().trim()) {
        return false;
      }
      if (!r.Tanggal) return false;
      var rTanggalStr = Utilities.formatDate(new Date(r.Tanggal), Session.getScriptTimeZone(), 'yyyyMMdd');
      if (rTanggalStr !== tanggalStr) return false;
      
      var rIdRHK = r.IdRHK || getIdRHKFromJenis(r.JenisRHK);
      return rIdRHK === idRHK;
    });

    // Urutkan berdasarkan waktu pembuatan CreatedAt
    matchingLogs.sort(function(a, b) {
      return new Date(a.CreatedAt || 0) - new Date(b.CreatedAt || 0);
    });

    // Cari index posisi reportId saat ini (jika laporan baru disubmit, data sudah ada di sheet)
    var seqIndex = 1;
    for (var idx = 0; idx < matchingLogs.length; idx++) {
      if (matchingLogs[idx].ReportId === reportId) {
        seqIndex = idx + 1;
        break;
      }
    }
    
    var seqStr = ('0' + seqIndex).slice(-2);
    var docTitle = tanggalStr + '-' + seqStr + '-' + idRHK + '-' + rencanaAksiShort;

    // Buat Google Doc baru
    var doc = DocumentApp.create(docTitle);
    var body = doc.getBody();

    // Atur margin halaman (dalam poin, 72 poin = 1 inci)
    body.setMarginTop(18); // Rapatkan batas atas
    body.setMarginBottom(36);
    body.setMarginLeft(54);
    body.setMarginRight(54);

    // Sisipkan konten laporan
    insertKopSurat(body);
    insertReportHeader(body, reportData);

    // Gunakan narasi yang sudah diedit, jika tidak ada gunakan narasi AI
    var narrative = reportData.NarasiEdited || reportData.NarasiAI || '';
    insertReportBody(body, narrative);

    // Sisipkan tabel P2K2 jika laporan terkait P2K2
    if (isP2K2RelatedRHK(reportData.JenisRHK) && reportData.P2K2Data) {
      var p2k2Data = reportData.P2K2Data;
      if (typeof p2k2Data === 'string') {
        try { p2k2Data = JSON.parse(p2k2Data); } catch (e) { p2k2Data = null; }
      }
      if (p2k2Data) {
        insertP2K2Table(body, p2k2Data);
      }
    }

    // Sisipkan blok tanda tangan
    insertSignatureBlock(body, userData, reportData);

    // Sisipkan lampiran dokumentasi foto jika ada
    var fotoIds = reportData.FotoIds;
    if (typeof fotoIds === 'string') {
      try { fotoIds = JSON.parse(fotoIds); } catch (e) { fotoIds = []; }
    }
    if (fotoIds && fotoIds.length > 0) {
      insertDocumentationAppendix(body, fotoIds);
    }

    // Simpan dan tutup dokumen
    doc.saveAndClose();

    // Konversi ke PDF
    var pdfBlob = convertDocToPdf(doc.getId());

    // Simpan PDF ke folder output
    var outputFolder = getOrCreateOutputFolder();
    var pdfFile = savePdfToDrive(pdfBlob, docTitle + '.pdf', outputFolder.getId());

    // Hapus dokumen Google Doc sementara (opsional, bisa dikomentari jika ingin disimpan)
    DriveApp.getFileById(doc.getId()).setTrashed(true);

    Logger.log('PDF berhasil dibuat: ' + pdfFile.getName());

    return {
      pdfUrl: pdfFile.getUrl(),
      pdfFileId: pdfFile.getId()
    };
  } catch (e) {
    Logger.log('Error createReportPDF: ' + e.message);
    throw new Error('Gagal membuat PDF: ' + e.message);
  }
}

// ============================================
// KOMPONEN DOKUMEN
// ============================================

/**
 * Menyisipkan kop surat resmi Kemensos di bagian atas dokumen
 * Termasuk logo, nama instansi, alamat, dan garis pemisah
 * @param {GoogleAppsScript.Document.Body} body - Body dokumen
 */
/**
 * Mengambil ID file logo Kemensos dari database Config
 * @returns {string} ID file logo di Google Drive atau kosong
 */
function getKemensosLogoId() {
  try {
    var rowIndex = findRowByKey('Config', 'LOGO_KEMENSOS_ID', 1);
    if (rowIndex !== -1) {
      var sheet = getSheet('Config');
      return sheet.getRange(rowIndex, 2).getValue();
    }
  } catch (e) {
    Logger.log('Error getKemensosLogoId: ' + e.message);
  }
  return '';
}

function insertKopSurat(body) {
  try {
    var logoFileId = getKemensosLogoId();
    var logoBlob = null;
    
    if (logoFileId) {
      try {
        var logoFile = DriveApp.getFileById(logoFileId);
        logoBlob = logoFile.getBlob();
      } catch (logoError) {
        Logger.log('Gagal memuat logo dari Drive, mencoba fallback: ' + logoError.message);
      }
    }
    
    // Fallback ke Base64 bawaan jika belum ada logo terunggah di Drive
    if (!logoBlob && typeof KEMENSOS_LOGO_BASE64 !== 'undefined' && KEMENSOS_LOGO_BASE64) {
      try {
        logoBlob = Utilities.newBlob(Utilities.base64Decode(KEMENSOS_LOGO_BASE64), 'image/webp', 'logo_kemensos.webp');
      } catch (fallbackError) {
        Logger.log('Gagal memuat logo fallback: ' + fallbackError.message);
      }
    }

    // Buat tabel 1 baris, 2 kolom untuk menaruh logo di samping teks kop
    var table = body.appendTable();
    var row = table.appendTableRow();
    var logoCell = row.appendTableCell();
    var textCell = row.appendTableCell();

    // Sembunyikan border tabel
    table.setBorderWidth(0);

    // Atur lebar kolom (lebar area cetak A4 portrait berkisar 480pt)
    logoCell.setWidth(120);
    textCell.setWidth(360);

    // Atur padding ke 0 agar rapat
    logoCell.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);
    textCell.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);

    // Atur vertical alignment ke tengah agar sejajar
    logoCell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
    textCell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);

    if (logoBlob) {
      try {
        var logoParagraph = logoCell.appendParagraph('');
        logoParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        var logoImage = logoParagraph.appendInlineImage(logoBlob);
        // Atur ukuran logo (lebar 110pt, tinggi proporsional)
        var originalWidth = logoImage.getWidth();
        var originalHeight = logoImage.getHeight();
        var newWidth = 110;
        var newHeight = Math.round((newWidth / originalWidth) * originalHeight);
        logoImage.setWidth(newWidth);
        logoImage.setHeight(newHeight);
      } catch (insertError) {
        Logger.log('Gagal menyisipkan logo ke dokumen: ' + insertError.message);
        logoCell.appendParagraph('');
      }
    } else {
      logoCell.appendParagraph('');
    }

    // Nama instansi - baris 1
    var line1 = textCell.appendParagraph('KEMENTERIAN SOSIAL REPUBLIK INDONESIA');
    line1.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    line1.setBold(true);
    line1.setItalic(false);
    line1.setFontSize(13);
    line1.setFontFamily('Times New Roman');
    line1.setSpacingBefore(0);
    line1.setSpacingAfter(2);

    // Nama direktorat jenderal - baris 2
    var line2 = textCell.appendParagraph('DIREKTORAT JENDERAL PERLINDUNGAN DAN JAMINAN SOSIAL');
    line2.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    line2.setBold(true);
    line2.setItalic(false);
    line2.setFontSize(11);
    line2.setFontFamily('Times New Roman');
    line2.setSpacingBefore(0);
    line2.setSpacingAfter(2);

    // Nama direktorat - baris 3
    var line3 = textCell.appendParagraph('DIREKTORAT PERLINDUNGAN SOSIAL NON KEBENCANAAN');
    line3.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    line3.setBold(true);
    line3.setItalic(false);
    line3.setFontSize(10);
    line3.setFontFamily('Times New Roman');
    line3.setSpacingBefore(0);
    line3.setSpacingAfter(2);

    // Alamat dan kontak - baris 4
    var line4 = textCell.appendParagraph('Jl. Salemba Raya No. 28 Jakarta Pusat 10430 Telp. (021) 3103591 http://www.kemsos.go.id');
    line4.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    line4.setBold(false);
    line4.setItalic(false);
    line4.setFontSize(7.5);
    line4.setFontFamily('Times New Roman');
    line4.setSpacingBefore(0);
    line4.setSpacingAfter(0);

    // Bersihkan paragraf kosong bawaan di sel
    [logoCell, textCell].forEach(function(c) {
      if (c.getNumChildren() > 0 && c.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH) {
        var firstChild = c.getChild(0).asParagraph();
        if (firstChild.getText() === '') {
          c.removeChild(firstChild);
        }
      }
    });

    // Tambahkan horizontal rule di dalam paragraf rapat agar tidak ada jarak berlebih di bawah tabel kop
    var hrParagraph = body.appendParagraph('');
    hrParagraph.setSpacingBefore(0);
    hrParagraph.setSpacingAfter(0);
    hrParagraph.setLineSpacing(1.0);
    hrParagraph.setFontSize(1);
    var hr = hrParagraph.appendHorizontalRule();

    // Rapatkan paragraf yang otomatis terbentuk setelah tabel kop
    try {
      var tableIndex = body.getChildIndex(table);
      var hrParagraphIndex = body.getChildIndex(hrParagraph);
      if (tableIndex !== -1 && hrParagraphIndex !== -1) {
        for (var idx = tableIndex + 1; idx < hrParagraphIndex; idx++) {
          var child = body.getChild(idx);
          if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
            var p = child.asParagraph();
            p.setSpacingBefore(0);
            p.setSpacingAfter(0);
            p.setFontSize(1);
            p.setLineSpacing(1.0);
          }
        }
      }
    } catch(e) {}

    // Jarak sangat rapat setelah kop surat
    var spacer = body.appendParagraph('');
    spacer.setFontSize(1);
    spacer.setSpacingBefore(0);
    spacer.setSpacingAfter(2);
  } catch (e) {
    Logger.log('Error insertKopSurat: ' + e.message);
  }
}

/**
 * Menyisipkan header laporan (judul, subtitle, periode, waktu)
 * @param {GoogleAppsScript.Document.Body} body - Body dokumen
 * @param {Object} reportData - Data laporan
 */
function insertReportHeader(body, reportData) {
  try {
    var idRHK = reportData.IdRHK || getIdRHKFromJenis(reportData.JenisRHK);
    var tanggal = new Date(reportData.Tanggal);

    // Judul laporan
    var title = body.appendParagraph('LAPORAN RENCANA HASIL KERJA (' + idRHK + ')');
    title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    title.setBold(true);
    title.setItalic(false);
    title.setFontSize(14);
    title.setFontFamily('Times New Roman');
    title.setSpacingAfter(4);

    // Subtitle - deskripsi jenis RHK
    if (reportData.JenisRHK) {
      var subtitle = body.appendParagraph(reportData.JenisRHK);
      subtitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      subtitle.setFontSize(11);
      subtitle.setFontFamily('Times New Roman');
      subtitle.setBold(false);
      subtitle.setItalic(true);
      subtitle.setSpacingAfter(4);
    }

    // Periode (Bulan Tahun)
    var periode = body.appendParagraph('(Periode: ' + formatBulanTahun(tanggal) + ')');
    periode.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    periode.setFontSize(11);
    periode.setFontFamily('Times New Roman');
    periode.setBold(false);
    periode.setItalic(false);
    periode.setSpacingAfter(10);

    // Rencana Aksi
    var raParagraph = body.appendParagraph('Rencana Aksi : ' + (reportData.RencanaAksi || '-'));
    raParagraph.setFontSize(11);
    raParagraph.setFontFamily('Times New Roman');
    raParagraph.setBold(false);
    raParagraph.setItalic(false);
    raParagraph.setSpacingAfter(2);

    // Waktu kegiatan
    var waktuText = 'Waktu : ' + formatTanggalIndonesia(tanggal);
    if (reportData.Lokasi) {
      waktuText += ', Pukul ' + reportData.Lokasi;
    }
    var waktuParagraph = body.appendParagraph(waktuText);
    waktuParagraph.setFontSize(11);
    waktuParagraph.setFontFamily('Times New Roman');
    waktuParagraph.setBold(false);
    waktuParagraph.setItalic(false);
    waktuParagraph.setSpacingAfter(24);

  } catch (e) {
    Logger.log('Error insertReportHeader: ' + e.message);
  }
}

function preprocessNarrative(narrative) {
  if (!narrative) return '';
  
  // Pra-bersihkan: hapus karakter Unicode tak terlihat yang bisa mengganggu deteksi regex
  narrative = narrative.replace(/[\u200B\u200C\u200D\uFEFF\u00AD\uFFFD]/g, '');
  
  // 1. Konversi SEMUA simbol aneh di AWAL baris menjadi dash standar (-)
  narrative = narrative.replace(/^(\s*)[^\w\s\d\(\)\[\]"'.\-a-zA-Z]\s+/gm, '$1- ');
  
  // 2. Konversi asterisk (*) di awal baris menjadi dash (-)
  narrative = narrative.replace(/^(\s*)\*\s+/gm, '$1- ');

  // 3. NUKLIR: Hapus SEMUA karakter Unicode yang bukan ASCII standar atau tanda baca wajar
  narrative = narrative.replace(/[^\x20-\x7E\n\r\t“”‘’—–]/g, '');
  
  var rawLines = narrative.split('\n');
  var processedLines = [];
  
  for (var i = 0; i < rawLines.length; i++) {
    // Trim dan normalisasi spasi internal (spasi ganda → spasi tunggal)
    var line = rawLines[i].trim().replace(/  +/g, ' ');
    if (line === '') {
      processedLines.push('');
      continue;
    }
    
    // Normalisasi: jika baris dimulai dengan huruf list dengan spasi berlebihan
    // di depannya (sudah di-trim), atau memiliki format aneh, perbaiki
    // Contoh: "   a.  Teks" → "a. Teks", "a)  Teks" → "a) Teks"
    line = line.replace(/^([a-z])([\.\)])\s{2,}/i, '$1$2 ');
    
    // Deteksi awal blok baru (dengan toleransi case-insensitive untuk list alfabet)
    var isMainHeading = /^[A-E]\.\s/.test(line);
    var isSubHeading = /^\d+\.\s/.test(line);
    var isAlphaList = /^[a-z][.\)]\s/i.test(line);
    var isBulletPoint = /^[-•]\s/.test(line);
    var isNewBlock = isMainHeading || isSubHeading || isAlphaList || isBulletPoint;
      
    if (isNewBlock) {
      processedLines.push(line);
    } else {
      // Jika bukan awal blok baru, gabungkan dengan baris sebelumnya jika memungkinkan
      if (processedLines.length > 0) {
        var lastIdx = processedLines.length - 1;
        var prevLine = processedLines[lastIdx];
        if (prevLine !== '') {
          // Jangan gabungkan paragraf ke dalam Heading Utama atau Sub-heading
          var isPrevHeader = /^[A-E]\.\s/.test(prevLine) || /^\d+\.\s/.test(prevLine);
          if (!isPrevHeader) {
            processedLines[lastIdx] = prevLine + ' ' + line;
            continue;
          }
        }
      }
      processedLines.push(line);
    }
  }
  // Buang baris kosong dan gabungkan kembali dengan newline
  return processedLines.filter(function(l) { return l !== ''; }).join('\n');
}

function formatAndAppendParagraph(body, line, style) {
  var regex = /\*\*([^*]+)\*\*/g;
  var match;
  var boldRanges = [];
  var offset = 0;
  
  while ((match = regex.exec(line)) !== null) {
    var matchText = match[1];
    var originalStart = match.index;
    
    var cleanStart = originalStart - offset;
    var cleanEnd = cleanStart + matchText.length - 1;
    
    boldRanges.push({
      start: cleanStart,
      end: cleanEnd
    });
    
    offset += 4; // Each ** pair removed adds 4 to the offset
  }
  
  var cleanText = line.replace(/\*\*([^*]+)\*\*/g, '$1');
  // Hapus sisa karakter * atau ** yang tidak berpasangan agar tidak tampil di PDF
  cleanText = cleanText.replace(/\*/g, '');
  
  var paragraph = body.appendParagraph(cleanText);
  paragraph.setFontFamily('Times New Roman');
  paragraph.setFontSize(style.fontSize || 11);
  paragraph.setLineSpacing(style.lineSpacing || 1.15);
  
  if (style.bold !== undefined) paragraph.setBold(style.bold);
  if (style.italic !== undefined) paragraph.setItalic(style.italic);
  if (style.indentStart !== undefined) paragraph.setIndentStart(style.indentStart);
  if (style.indentFirstLine !== undefined) paragraph.setIndentFirstLine(style.indentFirstLine);
  if (style.spacingBefore !== undefined) paragraph.setSpacingBefore(style.spacingBefore);
  if (style.spacingAfter !== undefined) paragraph.setSpacingAfter(style.spacingAfter);
  if (style.alignment !== undefined) paragraph.setAlignment(style.alignment);
  if (style.keepWithNext !== undefined) {
    try { paragraph.setKeepWithNext(style.keepWithNext); } catch(e) {}
  }
  
  if (boldRanges.length > 0) {
    var textElement = paragraph.editAsText();
    boldRanges.forEach(function(range) {
      try {
        textElement.setBold(range.start, range.end, true);
      } catch(e) {
        Logger.log('Error bolding range: ' + e.message);
      }
    });
  }
  
  return paragraph;
}

/**
 * Menyisipkan isi narasi laporan (bagian A-E)
 * Melakukan parsing teks narasi dan menerapkan format yang sesuai
 * (heading tebal, bullet points, paragraf)
 * @param {GoogleAppsScript.Document.Body} body - Body dokumen
 * @param {string} narrative - Teks narasi laporan
 */
function insertReportBody(body, narrative) {
  try {
    if (!narrative || narrative.trim() === '') {
      body.appendParagraph('[Narasi belum tersedia]')
        .setFontFamily('Times New Roman')
        .setFontSize(11)
        .setBold(false)
        .setItalic(true);
      return;
    }

    // Pra-proses narasi untuk menggabungkan baris yang terpotong
    var cleanNarrative = preprocessNarrative(narrative);
    var lines = cleanNarrative.split('\n');

    // Cari baris pertama yang diawali dengan "A." untuk membuang judul duplikat
    var startIndex = 0;
    for (var k = 0; k < lines.length; k++) {
      if (/^A\.\s/i.test(lines[k].trim())) {
        startIndex = k;
        break;
      }
    }

    for (var i = startIndex; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line === '') {
        continue;
      }

      // Deteksi dan lewati baris tabel markdown mentah
      if (line.indexOf('|') !== -1 || /^[|\s\-+:]{3,}$/.test(line)) {
        continue;
      }

      var style = {
        fontSize: 11,
        lineSpacing: 1.15,
        spacingBefore: 0,
        spacingAfter: 0,
        alignment: DocumentApp.HorizontalAlignment.JUSTIFY
      };

      // Deteksi heading bagian utama (A., B., C., D., E.)
      if (/^[A-E]\.\s/.test(line)) {
        style.bold = true;
        style.italic = false;
        style.fontSize = 12;
        style.indentStart = 0;
        style.indentFirstLine = 0;
        style.spacingBefore = 18;
        style.spacingAfter = 0; // Rapat dengan isi di bawahnya
        style.alignment = DocumentApp.HorizontalAlignment.LEFT;
        style.keepWithNext = true;
        
        formatAndAppendParagraph(body, line, style);
      }
      // Deteksi sub-heading bernomor (1., 2., 3., dst.)
      else if (/^\d+\.\s/.test(line)) {
        style.italic = false;
        style.fontSize = 11;
        style.indentStart = 36;
        style.indentFirstLine = 18; // Absolute indent: nomor mulai di 18pt, teks di 36pt (hanging indent)
        style.spacingBefore = 0;
        style.spacingAfter = 0; // Rapat
        style.alignment = DocumentApp.HorizontalAlignment.JUSTIFY;
        style.keepWithNext = true;
        
        var paragraph = formatAndAppendParagraph(body, line, style);
        
        // Tebalkan bagian nomor/judul sub-heading
        var textElement = paragraph.editAsText();
        var cleanText = paragraph.getText();
        if (line.indexOf('**') === -1) {
          var match = cleanText.match(/^(\d+\.\s*[^-\:]+(?:[\-\:]\s*)?)(.*)$/);
          if (match) {
            var headerLength = match[1].length;
            textElement.setBold(0, headerLength - 1, true);
          } else {
            textElement.setBold(true);
          }
        } else {
          // Jika mengandung **, tebalkan nomor di depannya (misal: "1. ")
          var matchNum = cleanText.match(/^(\d+\.\s*)/);
          if (matchNum) {
            textElement.setBold(0, matchNum[1].length - 1, true);
          }
        }
      }
      // Deteksi list alfabet (a., b., c., dst. atau a), b), c))
      else if (/^[a-z][\.\)]\s/i.test(line)) {
        style.bold = false;
        style.italic = false;
        style.indentStart = 54; // Indent penuh teks: teks sejajar di 54pt
        style.indentFirstLine = 36; // Absolute indent: huruf list mulai di 36pt (hanging indent)
        style.spacingBefore = 0;
        style.spacingAfter = 0; // Rapat
        
        formatAndAppendParagraph(body, line, style);
      }
      // Deteksi bullet point (dimulai dengan - atau •)
      else if (/^[-•]\s/.test(line)) {
        style.bold = false;
        style.italic = false;
        style.indentStart = 54; // Indent penuh teks: teks sejajar di 54pt
        style.indentFirstLine = 36; // Absolute indent: simbol bullet mulai di 36pt (hanging indent)
        style.spacingBefore = 0;
        style.spacingAfter = 0; // Rapat
        
        formatAndAppendParagraph(body, line, style);
      }
      // Paragraf biasa
      else {
        style.bold = false;
        style.italic = false;
        style.indentStart = 36; // Indent penuh teks: teks sejajar di 36pt
        style.indentFirstLine = 54; // Absolute indent: baris pertama paragraf menjorok di 54pt
        style.spacingBefore = 0;
        style.spacingAfter = 0; // Rapat
        
        formatAndAppendParagraph(body, line, style);
      }
    }
  } catch (e) {
    Logger.log('Error insertReportBody: ' + e.message);
  }
}

/**
 * Menyisipkan tabel data P2K2 ke dalam dokumen
 * Kolom: KPM Hadir | Dari Total | Modul P2K2 | Sesi P2K2
 * @param {GoogleAppsScript.Document.Body} body - Body dokumen
 * @param {Object} p2k2Data - Data P2K2 {jumlahHadir, jumlahKPM, modul, sesi}
 */
function insertP2K2Table(body, p2k2Data) {
  try {
    // Judul tabel
    var tableTitle = body.appendParagraph('Data Pelaksanaan P2K2:');
    tableTitle.setBold(true);
    tableTitle.setFontSize(11);
    tableTitle.setFontFamily('Times New Roman');
    tableTitle.setSpacingBefore(8);
    tableTitle.setSpacingAfter(4);

    // Ambil nilai secara defensif dengan penanganan kasus penamaan properti
    var hadir = String(p2k2Data.jumlahHadir || p2k2Data.jumlah_hadir || p2k2Data.hadir || '-');
    var kpm = String(p2k2Data.jumlahKPM || p2k2Data.jumlahKpm || p2k2Data.jumlah_kpm || p2k2Data.kpm || '-');
    var modul = String(p2k2Data.modul || '-');
    var sesi = String(p2k2Data.sesi || '-');

    // Buat data tabel 2D
    var cells = [
      ['KPM Hadir', 'Dari Total', 'Modul P2K2', 'Sesi P2K2'],
      [hadir, kpm, modul, sesi]
    ];

    // Buat tabel di dokumen
    var table = body.appendTable(cells);

    // Format Baris Header (Baris 0)
    var headerRow = table.getRow(0);
    for (var h = 0; h < 4; h++) {
      var cell = headerRow.getCell(h);
      cell.setBackgroundColor('#1A5276'); // Menggunakan Navy Blue dari tema aplikasi
      var p = cell.getChild(0).asParagraph();
      p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      var text = p.editAsText();
      text.setBold(true);
      text.setFontSize(10);
      text.setFontFamily('Times New Roman');
      text.setForegroundColor('#FFFFFF');
    }

    // Format Baris Data (Baris 1)
    var dataRow = table.getRow(1);
    for (var d = 0; d < 4; d++) {
      var cell = dataRow.getCell(d);
      var p = cell.getChild(0).asParagraph();
      p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      var text = p.editAsText();
      text.setBold(false);
      text.setItalic(false);
      text.setFontSize(10);
      text.setFontFamily('Times New Roman');
    }

    // Spasi setelah tabel
    body.appendParagraph('').setSpacingAfter(6);

  } catch (e) {
    Logger.log('Error insertP2K2Table: ' + e.message);
  }
}

/**
 * Menyisipkan blok tanda tangan di bagian bawah kanan dokumen
 * Termasuk tempat, tanggal, jabatan, gambar tanda tangan, nama, dan NIP
 * @param {GoogleAppsScript.Document.Body} body - Body dokumen
 * @param {Object} userData - Data pengguna {nama, nip, jabatan, kabupatenKota, signatureFileId}
 * @param {Object} reportData - Data laporan
 */
function insertSignatureBlock(body, userData, reportData) {
  try {
    // Spasi sebelum blok tanda tangan
    body.appendParagraph('').setSpacingAfter(6);

    var tanggal = new Date(reportData.Tanggal || new Date());
    var tanggalFormatted = Utilities.formatDate(tanggal, Session.getScriptTimeZone(), 'dd/MM/yyyy');

    // Buat tabel 2 kolom untuk mengatur posisi kanan (kolom kiri kosong, kolom kanan berisi data)
    var table = body.appendTable();
    var row = table.appendTableRow();
    var leftCell = row.appendTableCell();
    var rightCell = row.appendTableCell();

    // Hilangkan border tabel agar tidak terlihat
    table.setBorderWidth(0);

    // Atur lebar kolom (Total lebar area cetak berkisar 480pt)
    leftCell.setWidth(260);
    rightCell.setWidth(220);

    // Atur padding ke 0 agar rapat
    leftCell.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);
    rightCell.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);

    var dibuatDi = rightCell.appendParagraph('Dibuat di     : ' + (userData.kabupatenKota || '......................'));
    dibuatDi.setFontSize(11);
    dibuatDi.setFontFamily('Times New Roman');
    dibuatDi.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    dibuatDi.setSpacingAfter(2);

    var padaTanggal = rightCell.appendParagraph('Pada Tanggal  : ' + tanggalFormatted);
    padaTanggal.setFontSize(11);
    padaTanggal.setFontFamily('Times New Roman');
    padaTanggal.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    padaTanggal.setSpacingAfter(6);

    // Jabatan
    var jabatanPar = rightCell.appendParagraph(userData.jabatan || 'Koordinator Kab/Kota PKH');
    jabatanPar.setFontSize(11);
    jabatanPar.setFontFamily('Times New Roman');
    jabatanPar.setBold(true);
    jabatanPar.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    jabatanPar.setSpacingAfter(4);

    // Gambar tanda tangan jika ada
    if (userData.signatureFileId) {
      try {
        var sigFile = DriveApp.getFileById(userData.signatureFileId);
        var sigBlob = sigFile.getBlob();
        var sigParagraph = rightCell.appendParagraph('');
        sigParagraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
        var sigImage = sigParagraph.appendInlineImage(sigBlob);
        // Atur ukuran tanda tangan
        var sigWidth = 90;
        var sigOrigWidth = sigImage.getWidth();
        var sigOrigHeight = sigImage.getHeight();
        var sigHeight = Math.round((sigWidth / sigOrigWidth) * sigOrigHeight);
        sigImage.setWidth(sigWidth);
        sigImage.setHeight(sigHeight);
        sigParagraph.setSpacingAfter(4);
      } catch (sigError) {
        Logger.log('Gagal memuat tanda tangan: ' + sigError.message);
        // Sisipkan spasi sebagai pengganti tanda tangan
        var placeholder = rightCell.appendParagraph('\n\n\n');
        placeholder.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
      }
    } else {
      // Spasi kosong untuk tanda tangan manual
      var spaceSig = rightCell.appendParagraph('\n\n\n');
      spaceSig.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    }

    // Nama (tebal dan bergaris bawah)
    var namaPar = rightCell.appendParagraph(userData.nama || '.......................');
    namaPar.setFontSize(11);
    namaPar.setFontFamily('Times New Roman');
    namaPar.setBold(true);
    namaPar.editAsText().setUnderline(true);
    namaPar.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    namaPar.setSpacingAfter(2);

    // NIP
    var nipPar = rightCell.appendParagraph('NIP: ' + (userData.nip || '......................'));
    nipPar.setFontSize(11);
    nipPar.setFontFamily('Times New Roman');
    nipPar.setBold(false);
    nipPar.setItalic(false);
    nipPar.editAsText().setUnderline(false);
    nipPar.setAlignment(DocumentApp.HorizontalAlignment.LEFT);

    // Hapus paragraf kosong pertama di sel jika ada
    [leftCell, rightCell].forEach(function(c) {
      if (c.getNumChildren() > 0 && c.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH) {
        var firstChild = c.getChild(0).asParagraph();
        if (firstChild.getText() === '') {
          c.removeChild(firstChild);
        }
      }
    });

  } catch (e) {
    Logger.log('Error insertSignatureBlock: ' + e.message);
  }
}

/**
 * Menyisipkan lampiran dokumentasi foto kegiatan di halaman baru
 * @param {GoogleAppsScript.Document.Body} body - Body dokumen
 * @param {Array<string>} fotoIds - Array ID file foto di Google Drive
 */
function insertDocumentationAppendix(body, fotoIds) {
  try {
    if (!fotoIds || fotoIds.length === 0) return;

    // Halaman baru
    body.appendPageBreak();

    // Judul lampiran
    var lampiranTitle = body.appendParagraph('LAMPIRAN DOKUMENTASI');
    lampiranTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    lampiranTitle.setBold(true);
    lampiranTitle.setFontSize(14);
    lampiranTitle.setFontFamily('Times New Roman');
    lampiranTitle.setSpacingAfter(6);

    // Sub-judul
    var subTitle = body.appendParagraph('FOTO KEGIATAN');
    subTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    subTitle.setBold(true);
    subTitle.setFontSize(12);
    subTitle.setFontFamily('Times New Roman');
    subTitle.setSpacingAfter(12);

    // Sisipkan setiap foto
    for (var i = 0; i < fotoIds.length; i++) {
      try {
        var fotoFile = DriveApp.getFileById(fotoIds[i]);
        var fotoBlob = fotoFile.getBlob();

        var fotoParagraph = body.appendParagraph('');
        fotoParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

        var fotoImage = fotoParagraph.appendInlineImage(fotoBlob);

        // Atur ukuran foto agar proporsional dan maksimal (lebar 480 pt sesuai area cetak portrait)
        var targetWidth = 480; 
        var origWidth = fotoImage.getWidth();
        var origHeight = fotoImage.getHeight();
        var ratio = targetWidth / origWidth;
        fotoImage.setWidth(targetWidth);
        fotoImage.setHeight(Math.round(origHeight * ratio));

        // Keterangan foto
        var caption = body.appendParagraph('Foto ' + (i + 1));
        caption.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        caption.setFontSize(9);
        caption.setFontFamily('Times New Roman');
        caption.setItalic(true);
        caption.setSpacingAfter(10);

      } catch (fotoError) {
        Logger.log('Gagal memuat foto ' + (i + 1) + ': ' + fotoError.message);
        var errorMsg = body.appendParagraph('[Foto ' + (i + 1) + ' tidak dapat dimuat]');
        errorMsg.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        errorMsg.setFontSize(9);
        errorMsg.setItalic(true);
        errorMsg.setSpacingAfter(10);
      }
    }
  } catch (e) {
    Logger.log('Error insertDocumentationAppendix: ' + e.message);
  }
}

// ============================================
// FUNGSI KONVERSI DAN PENYIMPANAN
// ============================================

/**
 * Mengekspor Google Doc sebagai blob PDF
 * @param {string} docId - ID Google Doc
 * @returns {GoogleAppsScript.Base.Blob} Blob PDF
 */
function convertDocToPdf(docId) {
  try {
    var url = 'https://docs.google.com/document/d/' + docId + '/export?format=pdf';
    var token = ScriptApp.getOAuthToken();
    var response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('Gagal mengekspor PDF. Kode respons: ' + response.getResponseCode());
    }

    return response.getBlob().setName('report.pdf');
  } catch (e) {
    Logger.log('Error convertDocToPdf: ' + e.message);
    throw new Error('Gagal mengkonversi dokumen ke PDF: ' + e.message);
  }
}

/**
 * Menyimpan blob PDF ke folder tertentu di Google Drive
 * @param {GoogleAppsScript.Base.Blob} pdfBlob - Blob PDF
 * @param {string} fileName - Nama file PDF
 * @param {string} folderId - ID folder tujuan
 * @returns {GoogleAppsScript.Drive.File} File PDF yang disimpan
 */
function savePdfToDrive(pdfBlob, fileName, folderId) {
  try {
    pdfBlob.setName(fileName);
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(pdfBlob);
    // Atur akses agar bisa dilihat via link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('PDF disimpan: ' + fileName + ' di folder: ' + folderId);
    return file;
  } catch (e) {
    Logger.log('Error savePdfToDrive: ' + e.message);
    throw new Error('Gagal menyimpan PDF ke Drive: ' + e.message);
  }
}

// ============================================
// FUNGSI UTILITAS FORMAT
// ============================================

/**
 * Mengekstrak ID RHK (misal: 'RHK-2') dari teks jenis RHK
 * Mencari di data master berdasarkan kecocokan teks
 * @param {string} jenisRHK - Teks jenis RHK
 * @returns {string} ID RHK (contoh: 'RHK-2')
 */
function getIdRHKFromJenis(jenisRHK) {
  if (!jenisRHK) return 'RHK-X';

  try {
    var allRHK = getAllData('Master_RHK');
    for (var i = 0; i < allRHK.length; i++) {
      if (allRHK[i].JENIS_RHK === jenisRHK) {
        return allRHK[i].ID;
      }
    }
  } catch (e) {
    Logger.log('Error getIdRHKFromJenis: ' + e.message);
  }

  return 'RHK-X';
}

/**
 * Memformat tanggal ke format Indonesia lengkap
 * Contoh: 'Kamis, 21 Mei 2026'
 * @param {Date} date - Objek tanggal
 * @returns {string} Tanggal dalam format Indonesia
 */
function formatTanggalIndonesia(date) {
  try {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      date = new Date();
    }
    var hari = NAMA_HARI[date.getDay()];
    var tanggal = date.getDate();
    var bulan = NAMA_BULAN[date.getMonth()];
    var tahun = date.getFullYear();

    return hari + ', ' + tanggal + ' ' + bulan + ' ' + tahun;
  } catch (e) {
    Logger.log('Error formatTanggalIndonesia: ' + e.message);
    return new Date().toLocaleDateString('id-ID');
  }
}

/**
 * Memformat tanggal ke format 'Bulan Tahun'
 * Contoh: 'Mei 2026'
 * @param {Date} date - Objek tanggal
 * @returns {string} Format bulan dan tahun
 */
function formatBulanTahun(date) {
  try {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      date = new Date();
    }
    var bulan = NAMA_BULAN[date.getMonth()];
    var tahun = date.getFullYear();

    return bulan + ' ' + tahun;
  } catch (e) {
    Logger.log('Error formatBulanTahun: ' + e.message);
    return '';
  }
}

// ============================================
// PEMBUATAN PDF UNTUK NOTA DINAS
// ============================================

/**
 * Membuat PDF Nota Dinas Resmi dari spreadsheet log
 * @param {string} notaDinasId - ID Nota Dinas
 * @returns {Object} Hasil {success, pdfFileId, pdfUrl}
 */
function createNotaDinasPDFServer(notaDinasId) {
  try {
    var rowIndex = findRowByKey('Nota_Dinas', notaDinasId, 1);
    if (rowIndex === -1) {
      throw new Error('Nota Dinas tidak ditemukan.');
    }
    var sheet = getSheet('Nota_Dinas');
    var values = sheet.getRange(rowIndex, 1, 1, 14).getValues()[0];
    var data = {
      id: values[0],
      email: values[1],
      nomor: values[2],
      yth: values[3],
      dari: values[4],
      hal: values[5],
      lampiran: values[6],
      sifat: values[7],
      tanggal: values[8],
      poinDraft: values[9],
      isiNotaDinas: values[10],
      pdfFileId: values[11],
      createdAt: values[12],
      buktiDukung: values[13]
    };
    
    var userRowIndex = findRowByKey('Users', data.email, 1);
    var userData = {};
    if (userRowIndex !== -1) {
      var userSheet = getSheet('Users');
      var userRow = userSheet.getRange(userRowIndex, 1, 1, 9).getValues()[0];
      userData = {
        email: userRow[0],
        nama: userRow[1],
        nip: userRow[2],
        jabatan: userRow[3],
        kabupatenKota: userRow[4],
        signatureFileId: userRow[5],
        photoFileId: userRow[6]
      };
    }
    
    var docTitle = 'ND_' + data.id + '_' + data.hal.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    var doc = DocumentApp.create(docTitle);
    var body = doc.getBody();
    
    body.setMarginTop(18); // Rapatkan batas atas
    body.setMarginBottom(36);
    body.setMarginLeft(54);
    body.setMarginRight(54);
    
    insertKopSurat(body);
    
    body.appendParagraph('').setBorderWidth(1).setBorderColor('#000000');
    
    var titlePara = body.appendParagraph('NOTA DINAS');
    titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    titlePara.setFontFamily('Times New Roman');
    titlePara.setFontSize(14);
    titlePara.setBold(true);
    
    var tableCells = [
      ['Kepada Yth.', ': ' + data.yth],
      ['Dari', ': ' + data.dari],
      ['Nomor', ': ' + data.nomor],
      ['Sifat', ': ' + data.sifat],
      ['Lampiran', ': ' + data.lampiran],
      ['Tanggal', ': ' + data.tanggal],
      ['Hal', ': ' + data.hal]
    ];
    
    var table = body.appendTable();
    table.setBorderWidth(0);
    for (var r = 0; r < tableCells.length; r++) {
      var row = table.appendTableRow();
      var cell1 = row.appendTableCell(tableCells[r][0]);
      var cell2 = row.appendTableCell(tableCells[r][1]);
      
      cell1.setWidth(120);
      cell1.getChild(0).asParagraph().setFontFamily('Times New Roman').setFontSize(11);
      cell2.getChild(0).asParagraph().setFontFamily('Times New Roman').setFontSize(11);
    }
    
    var sepPara = body.appendParagraph('');
    sepPara.setSpacingAfter(12);
    sepPara.setBorderWidth(1).setBorderColor('#000000');
    
    var content = data.isiNotaDinas || '';
    var paragraphs = content.split('\n');
    for (var p = 0; p < paragraphs.length; p++) {
      var text = paragraphs[p].trim();
      if (text) {
        var pPara = body.appendParagraph(text);
        pPara.setFontFamily('Times New Roman').setFontSize(11);
        pPara.setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);
        pPara.setSpacingAfter(8);
      }
    }
    
    body.appendParagraph('').setSpacingAfter(24);
    
    var sigTable = body.appendTable();
    sigTable.setBorderWidth(0);
    var sigRow = sigTable.appendTableRow();
    sigRow.appendTableCell('').setWidth(300);
    var sigCell = sigRow.appendTableCell();
    sigCell.setWidth(200);
    
    var cellPara = sigCell.appendParagraph(userData.jabatan || 'Pendamping Sosial');
    cellPara.setFontFamily('Times New Roman').setFontSize(11).setBold(true);
    
    var signatureFileId = userData.signatureFileId;
    var signatureImageInserted = false;
    if (signatureFileId) {
      try {
        var imgBlob = DriveApp.getFileById(signatureFileId).getBlob();
        var img = sigCell.appendImage(imgBlob);
        img.setWidth(80); // Mengecilkan sedikit
        img.setHeight(40);
        signatureImageInserted = true;
      } catch (e) {
        Logger.log('Gagal menyisipkan tanda tangan di Nota Dinas: ' + e.message);
      }
    }
    
    if (!signatureImageInserted) {
      sigCell.appendParagraph('').setSpacingAfter(48);
    }
    
    var namePara = sigCell.appendParagraph(userData.nama || '');
    namePara.setFontFamily('Times New Roman').setFontSize(11).setUnderline(true).setBold(true);
    var nipPara = sigCell.appendParagraph('NIP. ' + (userData.nip || ''));
    nipPara.setFontFamily('Times New Roman').setFontSize(11);
    
    sigCell.removeChild(sigCell.getChild(0));
    
    if (data.buktiDukung) {
      body.appendPageBreak();
      var appTitle = body.appendParagraph('LAMPIRAN FOTO BUKTI DUKUNG');
      appTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      appTitle.setFontFamily('Times New Roman').setFontSize(12).setBold(true);
      body.appendParagraph('').setSpacingAfter(12);
      
      try {
        var appBlob = DriveApp.getFileById(data.buktiDukung).getBlob();
        var appImg = body.appendImage(appBlob);
        
        var maxW = 450;
        var appW = appImg.getWidth();
        var appH = appImg.getHeight();
        if (appW > maxW) {
          var ratio = maxW / appW;
          appImg.setWidth(maxW);
          appImg.setHeight(appH * ratio);
        }
      } catch (e) {
        Logger.log('Gagal menyisipkan foto lampiran di Nota Dinas: ' + e.message);
        body.appendParagraph('[Gagal memuat foto bukti dukung: ' + e.message + ']');
      }
    }
    
    doc.saveAndClose();
    
    var docFile = DriveApp.getFileById(doc.getId());
    var pdfBlob = docFile.getBlob().getAs('application/pdf');
    pdfBlob.setName(docTitle + '.pdf');
    
    var outputFolder = getOrCreateOutputFolder();
    var pdfFile = outputFolder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var pdfFileId = pdfFile.getId();
    var pdfUrl = 'https://drive.google.com/uc?export=view&id=' + pdfFileId;
    
    docFile.setTrashed(true);
    sheet.getRange(rowIndex, 12).setValue(pdfFileId);
    
    return { success: true, pdfFileId: pdfFileId, pdfUrl: pdfUrl };
  } catch (e) {
    Logger.log('Error createNotaDinasPDFServer: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ============================================
// PEMBUATAN PDF UNTUK VERKOM
// ============================================

/**
 * Membuat PDF Laporan VERKOM (Landscape) dari CSV data
 * @param {Array<Array>} csvData - 2D Array data CSV
 * @param {string} fileName - Nama file sumber CSV
 * @returns {Object} Hasil {success, pdfFileId, pdfUrl}
 */
function createVerkomPDFServer(csvData, fileName) {
  try {
    var email = Session.getActiveUser().getEmail();
    var userRowIndex = findRowByKey('Users', email, 1);
    var userData = {};
    if (userRowIndex !== -1) {
      var userSheet = getSheet('Users');
      var userRow = userSheet.getRange(userRowIndex, 1, 1, 9).getValues()[0];
      userData = {
        email: userRow[0],
        nama: userRow[1],
        nip: userRow[2],
        jabatan: userRow[3],
        kabupatenKota: userRow[4],
        signatureFileId: userRow[5]
      };
    }
    
    var docTitle = 'VERKOM_' + fileName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_csv$/i, '') + '_' + Date.now();
    var doc = DocumentApp.create(docTitle);
    var body = doc.getBody();
    
    body.setPageWidth(842);
    body.setPageHeight(595);
    
    body.setMarginTop(30);
    body.setMarginBottom(30);
    body.setMarginLeft(30);
    body.setMarginRight(30);
    
    insertKopSurat(body);
    
    body.appendParagraph('').setBorderWidth(1).setBorderColor('#000000');
    
    var titlePara = body.appendParagraph('LAPORAN HASIL VERIFIKASI KOMITMEN (VERKOM)');
    titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    titlePara.setFontFamily('Times New Roman').setFontSize(12).setBold(true);
    
    var subPara = body.appendParagraph('Sumber File: ' + fileName);
    subPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    subPara.setFontFamily('Times New Roman').setFontSize(10).setItalic(true);
    body.appendParagraph('').setSpacingAfter(8);
    
    var headers = csvData[0] || [];
    var rows = csvData.slice(1);
    
    var maxCols = 15;
    if (headers.length > maxCols) {
      headers = headers.slice(0, maxCols);
      for (var i = 0; i < rows.length; i++) {
        rows[i] = rows[i].slice(0, maxCols);
      }
    }
    
    var table = body.appendTable();
    table.setBorderWidth(0.5).setBorderColor('#CCCCCC');
    
    var headerRow = table.appendTableRow();
    headerRow.setBackgroundColor('#EAEAEA');
    for (var c = 0; c < headers.length; c++) {
      var cell = headerRow.appendTableCell(String(headers[c]));
      cell.getChild(0).asParagraph().setFontFamily('Times New Roman').setFontSize(7).setBold(true);
    }
    
    var numRowsLimit = Math.min(rows.length, 100);
    for (var r = 0; r < numRowsLimit; r++) {
      var dataRow = table.appendTableRow();
      for (var colVal = 0; colVal < headers.length; colVal++) {
        var cellVal = rows[r][colVal] !== undefined ? String(rows[r][colVal]) : '';
        var cell = dataRow.appendTableCell(cellVal);
        cell.getChild(0).asParagraph().setFontFamily('Times New Roman').setFontSize(6.5);
      }
    }
    
    body.appendParagraph('').setSpacingAfter(12);
    
    var sigTable = body.appendTable();
    sigTable.setBorderWidth(0);
    var sigRow = sigTable.appendTableRow();
    sigRow.appendTableCell('').setWidth(550);
    var sigCell = sigRow.appendTableCell();
    sigCell.setWidth(200);
    
    var placeStr = (userData.kabupatenKota || 'Kota Binjai') + ', ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMMM yyyy');
    sigCell.appendParagraph(placeStr).setFontFamily('Times New Roman').setFontSize(9);
    var rolePara = sigCell.appendParagraph(userData.jabatan || 'Pendamping Sosial');
    rolePara.setFontFamily('Times New Roman').setFontSize(9).setBold(true);
    
    var signatureFileId = userData.signatureFileId;
    var signatureImageInserted = false;
    if (signatureFileId) {
      try {
        var imgBlob = DriveApp.getFileById(signatureFileId).getBlob();
        var img = sigCell.appendImage(imgBlob);
        img.setWidth(80);
        img.setHeight(40);
        signatureImageInserted = true;
      } catch (e) {
        Logger.log('Gagal menyisipkan tanda tangan di VERKOM: ' + e.message);
      }
    }
    
    if (!signatureImageInserted) {
      sigCell.appendParagraph('').setSpacingAfter(36);
    }
    
    var namePara = sigCell.appendParagraph(userData.nama || '');
    namePara.setFontFamily('Times New Roman').setFontSize(9).setUnderline(true).setBold(true);
    var nipPara = sigCell.appendParagraph('NIP. ' + (userData.nip || ''));
    nipPara.setFontFamily('Times New Roman').setFontSize(9);
    
    sigCell.removeChild(sigCell.getChild(0));
    
    doc.saveAndClose();
    
    var docFile = DriveApp.getFileById(doc.getId());
    var pdfBlob = docFile.getBlob().getAs('application/pdf');
    pdfBlob.setName(docTitle + '.pdf');
    
    var outputFolder = getOrCreateOutputFolder();
    var pdfFile = outputFolder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var pdfFileId = pdfFile.getId();
    var pdfUrl = 'https://drive.google.com/uc?export=view&id=' + pdfFileId;
    
    docFile.setTrashed(true);
    
    return { success: true, pdfFileId: pdfFileId, pdfUrl: pdfUrl };
  } catch (e) {
    Logger.log('Error createVerkomPDFServer: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ============================================
// PEMBUATAN PDF UNTUK PENGADUAN
// ============================================

/**
 * Membuat PDF Pengaduan Resmi
 * @param {Object} data - Objek data Pengaduan
 * @returns {Object} Hasil {success, pdfFileId, pdfUrl}
 */
function createComplaintPDFServer(data) {
  try {
    var userRowIndex = findRowByKey('Users', data.email, 1);
    var userData = {};
    if (userRowIndex !== -1) {
      var userSheet = getSheet('Users');
      var userRow = userSheet.getRange(userRowIndex, 1, 1, 9).getValues()[0];
      userData = {
        email: userRow[0],
        nama: userRow[1],
        nip: userRow[2],
        jabatan: userRow[3],
        kabupatenKota: userRow[4],
        signatureFileId: userRow[5],
        photoFileId: userRow[6]
      };
    }
    
    var docTitle = 'LPM_' + data.id + '_' + data.nama.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    var doc = DocumentApp.create(docTitle);
    var body = doc.getBody();
    
    body.setMarginTop(18); // Rapatkan batas atas
    body.setMarginBottom(36);
    body.setMarginLeft(54);
    body.setMarginRight(54);
    
    insertKopSurat(body);
    
    body.appendParagraph('').setBorderWidth(1).setBorderColor('#000000');
    
    var titlePara = body.appendParagraph('LAPORAN PENGADUAN MASYARAKAT');
    titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    titlePara.setFontFamily('Times New Roman').setFontSize(14).setBold(true);
    body.appendParagraph('').setSpacingAfter(8);
    
    var tableCells = [
      ['ID Pengaduan', ': ' + data.id],
      ['NIK KPM', ': ' + data.nik],
      ['Nama KPM', ': ' + data.nama],
      ['Alamat KPM', ': ' + data.alamat + ', ' + data.desaKelurahan + ', ' + data.kecamatan + ', ' + data.kabKota],
      ['Isi Pengaduan', ': ' + data.aduan],
      ['Koordinat GPS', ': Lat: ' + data.latitude + ', Lng: ' + data.longitude],
      ['Hasil Analisa', ': ' + (data.hasilAnalisa || '—')]
    ];
    
    var table = body.appendTable();
    table.setBorderWidth(0.5).setBorderColor('#CCCCCC');
    for (var r = 0; r < tableCells.length; r++) {
      var row = table.appendTableRow();
      var cell1 = row.appendTableCell(tableCells[r][0]);
      var cell2 = row.appendTableCell(tableCells[r][1]);
      
      cell1.setWidth(120);
      cell1.getChild(0).asParagraph().setFontFamily('Times New Roman').setFontSize(10).setBold(true);
      cell2.getChild(0).asParagraph().setFontFamily('Times New Roman').setFontSize(10);
    }
    
    body.appendParagraph('').setSpacingAfter(18);
    
    var sigTable = body.appendTable();
    sigTable.setBorderWidth(0);
    var sigRow = sigTable.appendTableRow();
    sigRow.appendTableCell('').setWidth(300);
    var sigCell = sigRow.appendTableCell();
    sigCell.setWidth(200);
    
    var placeStr = (userData.kabupatenKota || 'Kota Binjai') + ', ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMMM yyyy');
    sigCell.appendParagraph(placeStr).setFontFamily('Times New Roman').setFontSize(10);
    var rolePara = sigCell.appendParagraph(userData.jabatan || 'Pendamping Sosial');
    rolePara.setFontFamily('Times New Roman').setFontSize(10).setBold(true);
    
    var signatureFileId = userData.signatureFileId;
    var signatureImageInserted = false;
    if (signatureFileId) {
      try {
        var imgBlob = DriveApp.getFileById(signatureFileId).getBlob();
        var img = sigCell.appendImage(imgBlob);
        img.setWidth(80); // Mengecilkan sedikit
        img.setHeight(40);
        signatureImageInserted = true;
      } catch (e) {
        Logger.log('Gagal menyisipkan tanda tangan di Pengaduan: ' + e.message);
      }
    }
    
    if (!signatureImageInserted) {
      sigCell.appendParagraph('').setSpacingAfter(48);
    }
    
    var namePara = sigCell.appendParagraph(userData.nama || '');
    namePara.setFontFamily('Times New Roman').setFontSize(10).setUnderline(true).setBold(true);
    var nipPara = sigCell.appendParagraph('NIP. ' + (userData.nip || ''));
    nipPara.setFontFamily('Times New Roman').setFontSize(10);
    
    sigCell.removeChild(sigCell.getChild(0));
    
    if (data.fotoKtp || data.screenshotSiks) {
      body.appendPageBreak();
      var appTitle = body.appendParagraph('LAMPIRAN DOKUMEN BUKTI DUKUNG');
      appTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      appTitle.setFontFamily('Times New Roman').setFontSize(12).setBold(true);
      body.appendParagraph('').setSpacingAfter(12);
      
      if (data.fotoKtp) {
        body.appendParagraph('Foto KTP KPM:').setFontFamily('Times New Roman').setFontSize(10).setBold(true);
        try {
          var ktpBlob = DriveApp.getFileById(data.fotoKtp).getBlob();
          var ktpImg = body.appendImage(ktpBlob);
          ktpImg.setWidth(300);
          ktpImg.setHeight(180);
        } catch (e) {
          body.appendParagraph('[Gagal memuat foto KTP]');
        }
        body.appendParagraph('').setSpacingAfter(12);
      }
      
      if (data.screenshotSiks) {
        body.appendParagraph('Screenshot SIKS-NG:').setFontFamily('Times New Roman').setFontSize(10).setBold(true);
        try {
          var siksBlob = DriveApp.getFileById(data.screenshotSiks).getBlob();
          var siksImg = body.appendImage(siksBlob);
          siksImg.setWidth(300);
          siksImg.setHeight(180);
        } catch (e) {
          body.appendParagraph('[Gagal memuat screenshot SIKS-NG]');
        }
      }
    }
    
    doc.saveAndClose();
    
    var docFile = DriveApp.getFileById(doc.getId());
    var pdfBlob = docFile.getBlob().getAs('application/pdf');
    pdfBlob.setName(docTitle + '.pdf');
    
    var outputFolder = getOrCreateOutputFolder();
    var pdfFile = outputFolder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var pdfFileId = pdfFile.getId();
    var pdfUrl = 'https://drive.google.com/uc?export=view&id=' + pdfFileId;
    
    docFile.setTrashed(true);
    
    return { success: true, pdfFileId: pdfFileId, pdfUrl: pdfUrl };
  } catch (e) {
    Logger.log('Error createComplaintPDFServer: ' + e.message);
    return { success: false, message: e.message };
  }
}
