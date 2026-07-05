/**
 * ==========================================
 * GeminiService.gs - Layanan Integrasi Gemini AI
 * ==========================================
 * Mengintegrasikan API Gemini untuk membuat narasi
 * laporan formal Kementerian Sosial secara otomatis.
 * 
 * Mendukung dua jenis laporan:
 * - Laporan RHK umum (non-P2K2)
 * - Laporan P2K2 dengan data tabel tambahan
 */

// ============================================
// KONFIGURASI API
// ============================================

/** URL endpoint Gemini API - gunakan model dengan kuota gratis lebih besar */
var GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

/** Daftar model yang akan dicoba (urutan prioritas) */
var GEMINI_MODELS = [
  'gemini-2.0-flash-lite',  // Kuota gratis paling besar (30 RPM)
  'gemini-1.5-flash',       // Fallback model (15 RPM)
  'gemini-2.0-flash'        // Model utama (jika tersedia)
];


// ============================================
// FUNGSI UTAMA
// ============================================

/**
 * Memanggil Gemini API dengan prompt yang diberikan
 * Menggunakan API key dari Script Properties 'GEMINI_API_KEY'
 * Akan mencoba beberapa model jika model utama kehabisan kuota
 * @param {string} prompt - Prompt/instruksi untuk Gemini
 * @returns {string} Teks respons dari Gemini
 */
/**
 * Memanggil Gemini API dengan prompt yang diberikan (Wrapper untuk kompatibilitas ke belakang)
 * @param {string} prompt - Prompt/instruksi untuk AI
 * @param {Array<Object>} [imageParts] - Array data gambar base64 (opsional)
 * @returns {string} Teks respons dari AI
 */
function callGeminiAPI(prompt, imageParts) {
  return callAIService(prompt, imageParts);
}

/**
 * Fungsi sentral untuk memanggil layanan AI berdasarkan provider terpilih.
 * @param {string} prompt - Prompt/instruksi
 * @param {Array<Object>} [imageParts] - Array data gambar base64 (opsional)
 * @returns {string} Teks hasil generate
 */
function callAIService(prompt, imageParts) {
  var props = PropertiesService.getScriptProperties();
  var provider = props.getProperty('AI_PROVIDER') || 'google';
  var modelOverride = props.getProperty('AI_MODEL') || '';

  Logger.log('Layanan AI dipanggil menggunakan provider: ' + provider);

  if (provider === 'google') {
    return callGoogleGeminiDirectly(prompt, modelOverride, props.getProperty('GEMINI_API_KEY'), imageParts);
  } else if (provider === 'groq') {
    return callGroqAPI(prompt, modelOverride, props.getProperty('GROQ_API_KEY'));
  } else if (provider === 'openrouter') {
    return callOpenRouterAPI(prompt, modelOverride, props.getProperty('OPENROUTER_API_KEY'));
  } else {
    throw new Error('Provider AI "' + provider + '" tidak dikenali.');
  }
}

/**
 * Memanggil Google Gemini API secara langsung menggunakan endpoint generativelanguage
 */
function callGoogleGeminiDirectly(prompt, modelOverride, apiKey, imageParts) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum diatur di Script Properties. Buka Pengaturan untuk menyiapkannya.');
  }

  var parts = [{ text: prompt }];
  if (imageParts && imageParts.length > 0) {
    parts = parts.concat(imageParts);
  }

  var payload = {
    contents: [
      {
        parts: parts
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 4096
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var modelsToTry = modelOverride ? [modelOverride.trim()] : GEMINI_MODELS;
  var lastError = '';

  for (var m = 0; m < modelsToTry.length; m++) {
    var model = modelsToTry[m];
    var versions = ['v1beta', 'v1'];
    
    for (var v = 0; v < versions.length; v++) {
      var version = versions[v];
      var url = 'https://generativelanguage.googleapis.com/' + version + '/models/' + model + ':generateContent?key=' + apiKey;
      
      try {
        Logger.log('Mencoba model Google: ' + model + ' (' + version + ')');
        var response = UrlFetchApp.fetch(url, options);
        var responseCode = response.getResponseCode();
        var responseBody = response.getContentText();

        if (responseCode === 429) {
          Logger.log('Kuota habis untuk model ' + model + ' (' + version + ')');
          lastError = 'Kuota habis untuk ' + model + ' (' + version + ')';
          continue;
        }

        if (responseCode === 404) {
          Logger.log('Model tidak ditemukan: ' + model + ' (' + version + ')');
          lastError = 'Model ' + model + ' tidak ditemukan di versi ' + version;
          continue;
        }

        if (responseCode !== 200) {
          var errorData = JSON.parse(responseBody);
          var errorMsg = errorData.error ? errorData.error.message : 'Kode respons: ' + responseCode;
          Logger.log('Error Gemini API (' + model + ' - ' + version + '): ' + errorMsg);
          lastError = errorMsg;
          continue;
        }

        var result = JSON.parse(responseBody);
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content &&
            result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
          Logger.log('Berhasil menggunakan model Google: ' + model + ' (' + version + ')');
          return result.candidates[0].content.parts[0].text;
        }

        lastError = 'Respons tidak valid dari model ' + model + ' (' + version + ')';
      } catch (e) {
        Logger.log('Error saat memanggil model Google ' + model + ' (' + version + '): ' + e.message);
        lastError = e.message;
        continue;
      }
    }
  }

  throw new Error('Semua model Google Gemini gagal. Error terakhir: ' + lastError);
}

/**
 * Memanggil Groq API menggunakan model Llama
 */
function callGroqAPI(prompt, modelOverride, apiKey) {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY belum diatur di Script Properties. Buka Pengaturan untuk menyiapkannya.');
  }

  var model = modelOverride ? modelOverride.trim() : 'llama-3.3-70b-versatile';
  var url = 'https://api.groq.com/openai/v1/chat/completions';
  
  var payload = {
    model: model,
    messages: [
      { role: 'system', content: 'Anda adalah penulis laporan resmi pemerintah Indonesia yang sangat detail dan komprehensif. ' +
        'ATURAN WAJIB: ' +
        '1) Tulis narasi yang PANJANG dan ELABORATIF untuk setiap bagian, terutama bagian B (Kegiatan) minimal 4-5 paragraf padat dan C (Hasil) minimal 3 paragraf padat, serta D (Kesimpulan dan Saran) minimal 2 paragraf padat. ' +
        '2) Untuk bagian Dasar di Pendahuluan, JANGAN gunakan UU atau peraturan resmi. Gunakan dasar operasional seperti: instruksi pimpinan, tupoksi pendamping, rencana kerja, jadwal rutin, hasil koordinasi, atau kebutuhan di lapangan. ' +
        '3) JANGAN gunakan format markdown apapun (tanpa **, ##, *, -, atau simbol formatting lainnya). Tulis dalam teks biasa (plain text) dengan penomoran angka/huruf saja. ' +
        '4) JANGAN gunakan karakter khusus seperti 【, 】, «, », •, ●, ►, ★, atau emoji apapun. ' +
        '5) Setiap paragraf minimal 4-5 kalimat lengkap.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 8192
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    Logger.log('Memanggil Groq API: ' + model);
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    if (responseCode !== 200) {
      var errorData = {};
      try { errorData = JSON.parse(responseBody); } catch(ex) {}
      var errorMsg = errorData.error ? errorData.error.message : 'Status ' + responseCode;
      throw new Error(errorMsg);
    }

    var result = JSON.parse(responseBody);
    if (result.choices && result.choices.length > 0 && result.choices[0].message) {
      return result.choices[0].message.content;
    }
    throw new Error('Format respon Groq tidak valid.');
  } catch (e) {
    Logger.log('Error callGroqAPI: ' + e.message);
    throw new Error('Gagal memanggil Groq: ' + e.message);
  }
}

/**
 * Memanggil OpenRouter API
 */
function callOpenRouterAPI(prompt, modelOverride, apiKey) {
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY belum diatur di Script Properties. Buka Pengaturan untuk menyiapkannya.');
  }

  var model = modelOverride ? modelOverride.trim() : 'openrouter/free';
  var url = 'https://openrouter.ai/api/v1/chat/completions';

  var payload = {
    model: model,
    messages: [
      { role: 'system', content: 'Anda adalah penulis laporan resmi pemerintah Indonesia. ' +
        'ATURAN FORMAT WAJIB DIPATUHI: ' +
        '1) DILARANG KERAS menggunakan format markdown apapun. Tidak boleh ada tanda ** (bold), ## (heading), * (italic), - (dash list), atau simbol markdown lainnya dalam output Anda. ' +
        '2) DILARANG KERAS menggunakan karakter khusus/simbol aneh seperti 【, 】, «, », •, ●, ►, ★, □, ■, ▪, ─, ═, atau karakter Unicode dekoratif lainnya. ' +
        '3) Gunakan HANYA huruf, angka, tanda baca standar (titik, koma, titik dua, titik koma, tanda kurung, tanda petik), dan penomoran biasa (1. 2. 3. atau a. b. c.). ' +
        '4) Tulis dalam paragraf-paragraf rapi tanpa indentasi berlebihan. Setiap paragraf baru cukup dipisahkan dengan satu baris kosong. ' +
        '5) Jangan memulai baris dengan spasi atau tab kecuali untuk sub-poin penomoran (maksimal 3 spasi). ' +
        '6) Untuk judul bagian gunakan format: A. PENDAHULUAN, B. KEGIATAN YANG DILAKSANAKAN, dst. (huruf kapital biasa, tanpa simbol tambahan).' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 8192
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'HTTP-Referer': 'https://github.com/google-gemini/rhk-agent',
      'X-Title': 'RHK-Agent'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    Logger.log('Memanggil OpenRouter API: ' + model);
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    if (responseCode !== 200) {
      var errorData = {};
      try { errorData = JSON.parse(responseBody); } catch(ex) {}
      var errorMsg = errorData.error ? errorData.error.message : 'Status ' + responseCode;
      throw new Error(errorMsg);
    }

    var result = JSON.parse(responseBody);
    if (result.choices && result.choices.length > 0 && result.choices[0].message) {
      return result.choices[0].message.content;
    }
    throw new Error('Format respon OpenRouter tidak valid.');
  } catch (e) {
    Logger.log('Error callOpenRouterAPI: ' + e.message);
    throw new Error('Gagal memanggil OpenRouter: ' + e.message);
  }
}

/**
 * Menyusun prompt untuk laporan RHK non-P2K2
 * Menginstruksikan Gemini untuk menulis laporan formal Kemensos
 * dengan struktur standar A sampai E
 * @param {Object} reportData - Data laporan dari Laporan_Log
 * @returns {string} Prompt lengkap
 */
function buildReportPrompt(reportData, cleanTanggal, cleanPukul) {
  var prompt = 'Anda adalah penulis laporan resmi di Kementerian Sosial Republik Indonesia, ' +
    'khususnya di lingkungan Program Keluarga Harapan (PKH). ' +
    'Buatkan narasi laporan Rencana Hasil Kerja (RHK) yang formal, profesional, dan sesuai dengan ' +
    'standar penulisan dokumen pemerintah Indonesia.\n\n';

  prompt += '=== DATA LAPORAN ===\n';
  prompt += 'Jenis RHK: ' + (reportData.JenisRHK || '-') + '\n';
  prompt += 'ID RHK: ' + (reportData.IdRHK || '-') + '\n';
  prompt += 'Rencana Aksi: ' + (reportData.RencanaAksi || '-') + '\n';
  prompt += 'Tanggal Kegiatan: ' + (cleanTanggal || '-') + '\n';
  prompt += 'Pukul Kegiatan (Jam): ' + (cleanPukul || '-') + '\n';
  prompt += 'Poin-poin Kegiatan (Berisi detail kegiatan, termasuk info lokasi fisik tempat kegiatan dilaksanakan): ' + (reportData.PoinKegiatan || '-') + '\n\n';

  prompt += '=== STRUKTUR LAPORAN ===\n';
  prompt += 'Susun laporan dengan struktur sebagai berikut:\n\n';

  prompt += 'A. PENDAHULUAN\n';
  prompt += '   1. Gambaran Umum - Jelaskan konteks dan latar belakang kegiatan terkait PKH\n';
  prompt += '   2. Maksud dan Tujuan - Uraikan tujuan pelaksanaan kegiatan\n';
  prompt += '   3. Ruang Lingkup - Jelaskan cakupan dan batasan kegiatan\n';
  prompt += '   4. Dasar - Sebutkan dasar pelaksanaan kegiatan secara fleksibel dan kontekstual. JANGAN selalu mengacu pada UU atau peraturan resmi. Gunakan dasar yang lebih operasional dan relevan, pilih 2-3 dari contoh berikut sesuai konteks kegiatan:\n';
  prompt += '      - Berdasarkan instruksi/arahan pimpinan (Koordinator Kabupaten/Kota atau Supervisor)\n';
  prompt += '      - Berdasarkan tugas pokok dan fungsi (Tupoksi) Pendamping PKH\n';
  prompt += '      - Berdasarkan rencana kerja/agenda kegiatan yang telah ditetapkan\n';
  prompt += '      - Berdasarkan jadwal rutin pelaksanaan kegiatan pendampingan\n';
  prompt += '      - Berdasarkan hasil koordinasi dengan pihak terkait\n';
  prompt += '      - Berdasarkan kebutuhan di lapangan dan kondisi wilayah dampingan\n';
  prompt += '      - Berdasarkan tindak lanjut dari kegiatan/pertemuan sebelumnya\n';
  prompt += '      Catatan: Boleh menyebutkan regulasi HANYA jika kegiatan memang secara langsung terkait pelaksanaan regulasi tertentu (misal: verifikasi komitmen).\n\n';

  prompt += 'B. KEGIATAN YANG DILAKSANAKAN\n';
  prompt += '   Uraikan secara DETAIL dan PANJANG kegiatan yang dilaksanakan. Bagian ini harus menjadi bagian TERPANJANG dari laporan (minimal 3-4 paragraf padat, masing-masing minimal 4-5 kalimat). Jelaskan secara naratif dan mengalir, meliputi:\n';
  prompt += '   - Waktu pelaksanaan: sebutkan hari, tanggal lengkap, dan pukul/jam kegiatan (WAJIB sesuai input)\n';
  prompt += '   - Tempat/lokasi pelaksanaan: sebutkan nama tempat spesifik (kantor, balai, rumah warga, dll.) beserta alamat/wilayahnya\n';
  prompt += '   - Peserta/sasaran kegiatan: sebutkan siapa saja yang terlibat, jumlah peserta jika ada, peran masing-masing pihak\n';
  prompt += '   - Metode/cara pelaksanaan: jelaskan bagaimana kegiatan dilaksanakan (diskusi, kunjungan rumah, sosialisasi, pendataan, dll.)\n';
  prompt += '   - Tahapan kegiatan secara kronologis: uraikan langkah demi langkah apa yang dilakukan dari awal hingga akhir\n';
  prompt += '   - Materi/substansi: jelaskan apa inti pembahasan, data yang dikumpulkan, atau informasi yang disampaikan\n';
  prompt += '   - Dinamika pelaksanaan: gambarkan suasana, respons peserta, kendala di lapangan, atau hal menarik selama kegiatan\n';
  prompt += '   PENTING: Kembangkan setiap poin kegiatan dari input menjadi narasi yang ELABORATIF. Jangan hanya menyebutkan poin singkat, tapi ceritakan prosesnya secara menyeluruh layaknya laporan resmi pemerintah yang komprehensif.\n\n';

  prompt += 'C. HASIL\n';
  prompt += '   Jelaskan hasil-hasil yang dicapai dari pelaksanaan kegiatan secara LENGKAP dan MENYELURUH (minimal 2-3 paragraf, masing-masing minimal 3-4 kalimat). Uraikan:\n';
  prompt += '   - Capaian utama: apa output konkret yang dihasilkan dari kegiatan\n';
  prompt += '   - Capaian kuantitatif: jumlah data yang berhasil dikumpulkan, jumlah KPM yang terlayani, jumlah peserta, dsb. (jika relevan)\n';
  prompt += '   - Capaian kualitatif: peningkatan pemahaman, perubahan sikap, respons positif dari sasaran/masyarakat\n';
  prompt += '   - Dampak kegiatan: manfaat langsung bagi KPM/masyarakat dan kontribusi terhadap tujuan program PKH\n';
  prompt += '   - Tindak lanjut yang diperlukan: langkah selanjutnya yang perlu dilakukan sebagai kelanjutan kegiatan\n';
  prompt += '   PENTING: Jangan menulis hasil secara singkat atau hanya satu paragraf pendek. Elaborasikan setiap hasil dengan penjelasan yang memadai.\n\n';

  prompt += 'D. KESIMPULAN DAN SARAN\n';
  prompt += '   Bagian ini harus ditulis secara LENGKAP (minimal 2 paragraf padat).\n';
  prompt += '   1. Kesimpulan - Rangkum temuan utama dari pelaksanaan kegiatan secara komprehensif. Jelaskan apa yang berhasil dicapai, bagaimana pelaksanaannya, dan apa makna hasilnya bagi program PKH. Tulis minimal 1 paragraf padat (4-5 kalimat).\n';
  prompt += '   2. Saran - Berikan rekomendasi konkret dan spesifik untuk perbaikan ke depan. Sebutkan minimal 2-3 poin saran yang actionable (dapat ditindaklanjuti), misalnya terkait peningkatan kualitas pelaksanaan, penguatan koordinasi, atau perbaikan metode kerja. Tulis minimal 1 paragraf padat (4-5 kalimat).\n\n';

  prompt += 'E. PENUTUP\n';
  prompt += '   Tutup dengan kalimat formal yang menyatakan bahwa laporan dibuat\n';
  prompt += '   dengan sebenar-benarnya untuk digunakan sebagaimana mestinya.\n\n';

  prompt += '=== INSTRUKSI PENULISAN ===\n';
  prompt += '- Gunakan bahasa Indonesia formal dan baku\n';
  prompt += '- Tulis dalam paragraf yang rapi dan koheren\n';
  prompt += '- Jangan menggunakan format markdown (tanpa #, *, dll)\n';
  prompt += '- Gunakan penomoran untuk sub-bagian\n';
  prompt += '- Pastikan setiap bagian memiliki isi yang substantif dan PANJANG, terutama bagian B (Kegiatan) dan C (Hasil)\n';
  prompt += '- Bagian B (Kegiatan) MINIMAL 3-4 paragraf padat. Bagian C (Hasil) MINIMAL 2-3 paragraf padat. Jangan pernah menulis kedua bagian ini secara singkat.\n';
  prompt += '- Kembangkan setiap poin input menjadi narasi deskriptif yang kaya detail, konteks, dan penjelasan proses\n';
  prompt += '- Sesuaikan konteks dengan Program Keluarga Harapan (PKH)\n';
  prompt += '- Jangan menuliskan judul laporan, nama instansi, atau sub-judul di awal teks. Langsung mulai menulis dari bagian "A. PENDAHULUAN".\n';
  prompt += '- PENTING: PERHATIKAN GAMBAR/FOTO LAMPIRAN! Kami melampirkan file gambar/foto bukti kegiatan asli yang diunggah. Anda WAJIB menganalisis visual foto tersebut secara saksama. Jika di dalam foto terdapat tabel data, nomor surat keputusan/dasar hukum, nama instansi, atau tulisan penting lainnya, Anda harus membaca, menyalin, dan mengintegrasikannya secara konkret ke dalam narasi laporan Anda (misalnya: sebagai data dukung di bagian Kegiatan atau Pendahuluan).\n';
  prompt += '- PENTING: Untuk penulisan waktu/pukul kegiatan di dalam narasi laporan (terutama bagian B. KEGIATAN), Anda WAJIB menggunakan waktu yang tertera pada bagian "Pukul Kegiatan (Jam)" di DATA LAPORAN (misal: "' + (cleanPukul || '-') + '"). Jangan pernah menggunakan waktu default seperti "07:00 WIB" jika waktu tersebut tidak sesuai dengan input "Pukul Kegiatan (Jam)"!\n';
  prompt += '- PENTING: Ekstrak lokasi fisik kegiatan (seperti nama desa/kelurahan, nama kecamatan, nama aula/kantor, kota/kabupaten) dan pukul kegiatan secara akurat berdasarkan isi data input atau hasil pembacaan foto. Letakkan lokasi fisik hasil ekstraksi tersebut di bagian paling akhir teks di baris baru dalam tag XML khusus, contoh: <lokasi>Aula Kantor Desa Merdeka, Kecamatan Rambutan</lokasi>. Tag ini diletakkan setelah bagian E. PENUTUP.\n';

  return prompt;
}

/**
 * Menyusun prompt untuk laporan P2K2
 * Mirip dengan prompt umum tetapi menyertakan data spesifik P2K2
 * dan instruksi untuk menyertakan tabel data P2K2
 * @param {Object} reportData - Data laporan dari Laporan_Log
 * @returns {string} Prompt lengkap untuk laporan P2K2
 */
function buildP2K2ReportPrompt(reportData, cleanTanggal, cleanPukul) {
  // Parse data P2K2 dari JSON
  var p2k2Data = {};
  if (reportData.P2K2Data) {
    if (typeof reportData.P2K2Data === 'string') {
      try { p2k2Data = JSON.parse(reportData.P2K2Data); } catch (e) { p2k2Data = {}; }
    } else {
      p2k2Data = reportData.P2K2Data;
    }
  }

  var prompt = 'Anda adalah penulis laporan resmi di Kementerian Sosial Republik Indonesia, ' +
    'khususnya di lingkungan Program Keluarga Harapan (PKH). ' +
    'Buatkan narasi laporan pelaksanaan Pertemuan Peningkatan Kemampuan Keluarga (P2K2) ' +
    'yang formal, profesional, dan sesuai standar penulisan dokumen pemerintah Indonesia.\n\n';

  prompt += '=== DATA LAPORAN ===\n';
  prompt += 'Jenis RHK: ' + (reportData.JenisRHK || '-') + '\n';
  prompt += 'ID RHK: ' + (reportData.IdRHK || '-') + '\n';
  prompt += 'Rencana Aksi: ' + (reportData.RencanaAksi || '-') + '\n';
  prompt += 'Tanggal Kegiatan: ' + (cleanTanggal || '-') + '\n';
  prompt += 'Pukul Kegiatan (Jam): ' + (cleanPukul || '-') + '\n';
  prompt += 'Poin-poin Kegiatan (Berisi detail kegiatan, termasuk info lokasi fisik tempat kegiatan dilaksanakan): ' + (reportData.PoinKegiatan || '-') + '\n\n';

  prompt += '=== DATA SPESIFIK P2K2 ===\n';
  prompt += 'Modul P2K2: ' + (p2k2Data.modul || '-') + '\n';
  prompt += 'Sesi P2K2: ' + (p2k2Data.sesi || '-') + '\n';
  prompt += 'Jumlah Total KPM: ' + (p2k2Data.jumlahKPM || '-') + '\n';
  prompt += 'Jumlah KPM Hadir: ' + (p2k2Data.jumlahHadir || '-') + '\n';
  prompt += 'Nama Kelompok: ' + (p2k2Data.namaKelompok || '-') + '\n';
  prompt += 'Ketua Kelompok: ' + (p2k2Data.ketuaKelompok || '-') + '\n\n';

  prompt += '=== STRUKTUR LAPORAN ===\n';
  prompt += 'Susun laporan dengan struktur sebagai berikut:\n\n';

  prompt += 'A. PENDAHULUAN\n';
  prompt += '   1. Gambaran Umum - Jelaskan konteks P2K2 dalam program PKH\n';
  prompt += '   2. Maksud dan Tujuan - Tujuan pelaksanaan pertemuan P2K2\n';
  prompt += '   3. Ruang Lingkup - Cakupan pertemuan (modul dan sesi)\n';
  prompt += '   4. Dasar - Sebutkan dasar pelaksanaan kegiatan P2K2 secara fleksibel dan kontekstual. JANGAN selalu mengacu pada UU atau peraturan resmi. Gunakan dasar yang lebih operasional dan relevan, pilih 2-3 dari contoh berikut sesuai konteks kegiatan:\n';
  prompt += '      - Berdasarkan instruksi/arahan pimpinan (Koordinator Kabupaten/Kota atau Supervisor)\n';
  prompt += '      - Berdasarkan tugas pokok dan fungsi (Tupoksi) Pendamping PKH\n';
  prompt += '      - Berdasarkan rencana kerja/agenda kegiatan P2K2 yang telah ditetapkan\n';
  prompt += '      - Berdasarkan jadwal rutin pelaksanaan pertemuan P2K2\n';
  prompt += '      - Berdasarkan hasil koordinasi dengan pihak terkait\n';
  prompt += '      - Berdasarkan kebutuhan peningkatan kapasitas KPM di wilayah dampingan\n';
  prompt += '      - Berdasarkan tindak lanjut dari pertemuan P2K2 sebelumnya\n';
  prompt += '      - Berdasarkan pedoman pelaksanaan P2K2\n';
  prompt += '      Catatan: Boleh menyebutkan regulasi HANYA jika kegiatan memang secara langsung terkait pelaksanaan regulasi tertentu.\n\n';

  prompt += 'B. KEGIATAN YANG DILAKSANAKAN\n';
  prompt += '   Uraikan pelaksanaan P2K2 secara DETAIL dan PANJANG (minimal 3-4 paragraf padat, masing-masing minimal 4-5 kalimat). Jelaskan secara naratif dan mengalir, meliputi:\n';
  prompt += '   - Waktu pelaksanaan: sebutkan hari, tanggal lengkap, dan pukul/jam kegiatan (WAJIB sesuai input)\n';
  prompt += '   - Tempat/lokasi pelaksanaan: sebutkan nama tempat spesifik beserta alamat/wilayahnya\n';
  prompt += '   - Modul dan sesi yang disampaikan: jelaskan secara rinci apa isi/substansi materi modul tersebut, tujuan pembelajaran, dan relevansinya bagi KPM\n';
  prompt += '   - Nama kelompok dan ketua kelompok\n';
  prompt += '   - SERTAKAN TABEL DATA P2K2 berikut:\n';
  prompt += '     | KPM Hadir | Dari Total KPM | Modul P2K2 | Sesi P2K2 |\n';
  prompt += '     | ' + (p2k2Data.jumlahHadir || '-') + ' | ' + (p2k2Data.jumlahKPM || '-') +
            ' | ' + (p2k2Data.modul || '-') + ' | ' + (p2k2Data.sesi || '-') + ' |\n';
  prompt += '   - Metode penyampaian materi: jelaskan teknik yang digunakan (ceramah, diskusi kelompok, simulasi, tanya jawab, praktik, dll.)\n';
  prompt += '   - Aktivitas dan partisipasi peserta: gambarkan bagaimana respons dan keterlibatan KPM selama pertemuan\n';
  prompt += '   - Dinamika pelaksanaan: ceritakan suasana pertemuan, antusiasme peserta, pertanyaan yang muncul, atau kendala di lapangan\n';
  prompt += '   PENTING: Kembangkan setiap poin kegiatan dari input menjadi narasi yang ELABORATIF. Jangan hanya menyebutkan poin singkat, tapi ceritakan prosesnya secara menyeluruh layaknya laporan resmi pemerintah yang komprehensif.\n\n';

  prompt += 'C. HASIL\n';
  prompt += '   Jelaskan hasil pertemuan P2K2 secara LENGKAP dan MENYELURUH (minimal 2-3 paragraf, masing-masing minimal 3-4 kalimat). Uraikan:\n';
  prompt += '   - Tingkat kehadiran dan partisipasi KPM: sebutkan angka konkret dan bandingkan dengan total anggota kelompok\n';
  prompt += '   - Pemahaman peserta terhadap materi: jelaskan indikator pemahaman (pertanyaan yang diajukan, kemampuan menjawab kuis, diskusi aktif, dll.)\n';
  prompt += '   - Capaian kualitatif: perubahan sikap, peningkatan kesadaran, komitmen peserta\n';
  prompt += '   - Capaian kuantitatif: data kehadiran, jumlah materi yang tersampaikan, dsb.\n';
  prompt += '   - Dampak kegiatan: manfaat langsung bagi KPM dan kontribusi terhadap tujuan program PKH\n';
  prompt += '   - Tindak lanjut yang diperlukan: langkah selanjutnya, rencana pertemuan berikutnya\n';
  prompt += '   PENTING: Jangan menulis hasil secara singkat atau hanya satu paragraf pendek. Elaborasikan setiap hasil dengan penjelasan yang memadai.\n\n';

  prompt += 'D. KESIMPULAN DAN SARAN\n';
  prompt += '   Bagian ini harus ditulis secara LENGKAP (minimal 2 paragraf padat).\n';
  prompt += '   1. Kesimpulan - Rangkum temuan utama pertemuan P2K2 secara komprehensif. Jelaskan apa yang berhasil dicapai, tingkat keberhasilan penyampaian materi, dan respon peserta secara keseluruhan. Tulis minimal 1 paragraf padat (4-5 kalimat).\n';
  prompt += '   2. Saran - Berikan rekomendasi konkret dan spesifik untuk pertemuan selanjutnya. Sebutkan minimal 2-3 poin saran yang actionable terkait peningkatan partisipasi, metode penyampaian, atau materi yang perlu diperdalam. Tulis minimal 1 paragraf padat (4-5 kalimat).\n\n';

  prompt += 'E. PENUTUP\n';
  prompt += '   Tutup dengan kalimat formal yang menyatakan bahwa laporan dibuat\n';
  prompt += '   dengan sebenar-benarnya untuk digunakan sebagaimana mestinya.\n\n';

  prompt += '=== INSTRUKSI PENULISAN ===\n';
  prompt += '- Gunakan bahasa Indonesia formal dan baku\n';
  prompt += '- Tulis dalam paragraf yang rapi dan koheren\n';
  prompt += '- Jangan menggunakan format markdown (tanpa #, *, dll)\n';
  prompt += '- Gunakan penomoran untuk sub-bagian\n';
  prompt += '- Sertakan data kuantitatif P2K2 dalam narasi bagian B\n';
  prompt += '- Pastikan setiap bagian memiliki isi yang substantif dan PANJANG, terutama bagian B (Kegiatan) dan C (Hasil)\n';
  prompt += '- Bagian B (Kegiatan) MINIMAL 3-4 paragraf padat. Bagian C (Hasil) MINIMAL 2-3 paragraf padat. Jangan pernah menulis kedua bagian ini secara singkat.\n';
  prompt += '- Kembangkan setiap poin input menjadi narasi deskriptif yang kaya detail, konteks, dan penjelasan proses\n';
  prompt += '- Sesuaikan konteks dengan P2K2 dalam Program Keluarga Harapan (PKH)\n';
  prompt += '- Jangan menuliskan judul laporan, nama instansi, atau sub-judul di awal teks. Langsung mulai menulis dari bagian "A. PENDAHULUAN".\n';
  prompt += '- PENTING: PERHATIKAN GAMBAR/FOTO LAMPIRAN! Kami melampirkan file gambar/foto bukti kegiatan asli yang diunggah. Anda WAJIB menganalisis visual foto tersebut secara saksama. Jika di dalam foto terdapat tabel data, nomor surat keputusan/dasar hukum, nama instansi, atau tulisan penting lainnya, Anda harus membaca, menyalin, dan mengintegrasikannya secara konkret ke dalam narasi laporan Anda (misalnya: sebagai data dukung di bagian Kegiatan atau Pendahuluan).\n';
  prompt += '- PENTING: Untuk penulisan waktu/pukul kegiatan di dalam narasi laporan (terutama bagian B. KEGIATAN), Anda WAJIB menggunakan waktu yang tertera pada bagian "Pukul Kegiatan (Jam)" di DATA LAPORAN (misal: "' + (cleanPukul || '-') + '"). Jangan pernah menggunakan waktu default seperti "07:00 WIB" jika waktu tersebut tidak sesuai dengan input "Pukul Kegiatan (Jam)"!\n';
  prompt += '- PENTING: Ekstrak lokasi fisik kegiatan (seperti nama desa/kelurahan, nama kecamatan, nama aula/kantor, kota/kabupaten) dan pukul kegiatan secara akurat berdasarkan isi data input atau hasil pembacaan foto. Letakkan lokasi fisik hasil ekstraksi tersebut di bagian paling akhir teks di baris baru dalam tag XML khusus, contoh: <lokasi>Aula Kantor Desa Merdeka, Kecamatan Rambutan</lokasi>. Tag ini diletakkan setelah bagian E. PENUTUP.\n';

  return prompt;
}

/**
 * Fungsi utama: membuat narasi laporan menggunakan Gemini AI
 * Menentukan jenis laporan (P2K2 atau umum), menyusun prompt yang sesuai,
 * memanggil API, dan menyimpan hasilnya ke kolom NarasiAI di Laporan_Log
 * @param {string} reportId - ID laporan yang akan dibuatkan narasinya
 * @returns {string} Teks narasi yang dihasilkan
 */
function generateReportNarrative(reportId) {
  try {
    // Ambil data laporan dari Laporan_Log
    var rowIndex = findReportRowIndex(reportId);
    if (rowIndex === -1) {
      throw new Error('Laporan dengan ID ' + reportId + ' tidak ditemukan.');
    }

    var sheet = getSheet('Laporan_Log');
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var rowData = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

    // Konversi ke objek
    var reportData = {};
    for (var i = 0; i < headers.length; i++) {
      reportData[headers[i]] = rowData[i];
    }

    // Ambil timezone dari spreadsheet untuk menghindari pergeseran waktu
    var tz = '';
    try {
      tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    } catch(tzErr) {
      tz = Session.getScriptTimeZone();
    }

    // Format Tanggal Kegiatan agar bersih dari timestamp ISO (mencegah Gemini membaca 07:00 WIB akibat offset GMT+7)
    var cleanTanggal = '';
    if (reportData.Tanggal) {
      try {
        var d = new Date(reportData.Tanggal);
        if (!isNaN(d.getTime())) {
          cleanTanggal = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
        } else {
          cleanTanggal = String(reportData.Tanggal);
        }
      } catch(e) {
        cleanTanggal = String(reportData.Tanggal);
      }
    }

    // Bersihkan Pukul Kegiatan dari format Date/Time objek jika diubah otomatis oleh Sheets
    var cleanPukul = '';
    if (reportData.Lokasi) {
      try {
        if (reportData.Lokasi instanceof Date) {
          cleanPukul = Utilities.formatDate(reportData.Lokasi, tz, 'HH:mm') + ' WIB';
        } else {
          cleanPukul = String(reportData.Lokasi).trim();
        }
      } catch(e) {
        cleanPukul = String(reportData.Lokasi);
      }
    } else {
      cleanPukul = '-';
    }

    // Tentukan jenis prompt berdasarkan apakah terkait P2K2
    var prompt;
    if (isP2K2RelatedRHK(reportData.JenisRHK)) {
      prompt = buildP2K2ReportPrompt(reportData, cleanTanggal, cleanPukul);
      Logger.log('Menggunakan prompt P2K2 untuk laporan: ' + reportId);
    } else {
      prompt = buildReportPrompt(reportData, cleanTanggal, cleanPukul);
      Logger.log('Menggunakan prompt umum untuk laporan: ' + reportId);
    }

    // Ambil foto dari Drive untuk dikonversi ke Base64
    var imageParts = [];
    var fotoIds = reportData.FotoIds;
    if (typeof fotoIds === 'string') {
      try { fotoIds = JSON.parse(fotoIds); } catch (e) { fotoIds = []; }
    }
    if (fotoIds && fotoIds.length > 0) {
      fotoIds.forEach(function(id) {
        try {
          var file = DriveApp.getFileById(id);
          var blob = file.getBlob();
          var base64Data = Utilities.base64Encode(blob.getBytes());
          var contentType = blob.getContentType();
          imageParts.push({
            inlineData: {
              mimeType: contentType,
              data: base64Data
            }
          });
          Logger.log('Foto ' + id + ' berhasil dikonversi untuk multimodal input.');
        } catch(fileErr) {
          Logger.log('Gagal mengonversi foto ' + id + ' untuk AI: ' + fileErr.message);
        }
      });
    }

    // Panggil Gemini API dengan parameter gambar
    var narrative = callGeminiAPI(prompt, imageParts);

    // Bersihkan narasi dari karakter aneh, markdown, dan formatting tidak konsisten
    narrative = sanitizeNarrativeOutput(narrative);

    // Ekstrak lokasi fisik dari tag <lokasi>...</lokasi>
    var physicalLokasi = '';
    var matchLokasi = narrative.match(/<lokasi>([\s\S]*?)<\/lokasi>/i);
    if (matchLokasi && matchLokasi[1]) {
      physicalLokasi = matchLokasi[1].trim();
      // Hapus tag dari narasi
      narrative = narrative.replace(/<lokasi>[\s\S]*?<\/lokasi>/gi, '').trim();
    }

    // Simpan narasi AI ke kolom NarasiAI (kolom 9)
    sheet.getRange(rowIndex, 9).setValue(narrative);
    Logger.log('Narasi AI berhasil disimpan untuk laporan: ' + reportId);

    // Simpan physicalLokasi ke kolom PhysicalLokasi secara dinamis
    if (physicalLokasi) {
      try {
        var physicalLokasiColIndex = getOrAddColumnIndex(sheet, 'PhysicalLokasi');
        sheet.getRange(rowIndex, physicalLokasiColIndex).setValue(physicalLokasi);
        Logger.log('Lokasi fisik berhasil disimpan ke kolom spreadsheet: ' + physicalLokasi);
      } catch (locErr) {
        Logger.log('Gagal menyimpan lokasi fisik ke spreadsheet: ' + locErr.message);
      }
    }

    return narrative;
  } catch (e) {
    Logger.log('Error generateReportNarrative: ' + e.message);
    throw new Error('Gagal membuat narasi laporan: ' + e.message);
  }
}

/**
 * Menguji koneksi Gemini API menggunakan API key tertentu (atau dari Script Properties jika kosong)
 * Wrapper untuk kompatibilitas ke belakang.
 * @param {string} [tempApiKey] - API Key sementara untuk dites sebelum disimpan (opsional)
 * @returns {Object} Hasil pengujian detail untuk setiap model
 */
function testGeminiAPIConnection(tempApiKey) {
  return testAIAPIConnection('google', tempApiKey);
}

/**
 * Menguji koneksi API untuk provider tertentu secara instan
 * @param {string} provider - Google, Groq, atau OpenRouter
 * @param {string} [tempApiKey] - API Key sementara (opsional)
 * @param {string} [tempModel] - Model AI yang dites (opsional)
 * @returns {Object} Hasil pengujian
 */
function testAIAPIConnection(provider, tempApiKey, tempModel) {
  var props = PropertiesService.getScriptProperties();
  provider = provider || props.getProperty('AI_PROVIDER') || 'google';
  var apiKey = tempApiKey || props.getProperty(provider === 'google' ? 'GEMINI_API_KEY' : (provider === 'groq' ? 'GROQ_API_KEY' : 'OPENROUTER_API_KEY'));
  var model = tempModel || props.getProperty('AI_MODEL') || '';

  if (!apiKey) {
    return {
      success: false,
      diagnosticCode: 'NO_KEY',
      summary: 'API Key kosong untuk provider ' + provider.toUpperCase() + '.',
      details: []
    };
  }

  apiKey = apiKey.trim();

  // Test payload
  var testPrompt = 'Katakan OK';
  var isSuccess = false;
  var statusCode = 200;
  var diagnosticCode = 'ERROR';
  var summary = '';
  var details = [];

  try {
    if (provider === 'google') {
      var testPayload = {
        contents: [{ parts: [{ text: testPrompt }] }],
        generationConfig: { maxOutputTokens: 10 }
      };
      var options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(testPayload),
        muteHttpExceptions: true
      };
      var modelsToTest = model ? [model] : GEMINI_MODELS;
      
      for (var i = 0; i < modelsToTest.length; i++) {
        var mName = modelsToTest[i];
        var versions = ['v1beta', 'v1'];
        for (var v = 0; v < versions.length; v++) {
          var ver = versions[v];
          var url = 'https://generativelanguage.googleapis.com/' + ver + '/models/' + mName + ':generateContent?key=' + apiKey;
          var detail = { model: mName + ' (' + ver + ')', success: false, status: '', message: '' };
          
          try {
            var response = UrlFetchApp.fetch(url, options);
            statusCode = response.getResponseCode();
            var body = response.getContentText();
            detail.status = statusCode;
            
            if (statusCode === 200) {
              var res = JSON.parse(body);
              if (res.candidates && res.candidates[0].content && res.candidates[0].content.parts) {
                detail.success = true;
                detail.message = 'Koneksi berhasil: ' + res.candidates[0].content.parts[0].text.trim();
                isSuccess = true;
              } else {
                detail.message = 'Respons tidak valid dari API';
              }
            } else {
              var errData = {};
              try { errData = JSON.parse(body); } catch(ex) {}
              detail.message = errData.error ? errData.error.message : 'Error ' + statusCode;
            }
          } catch(e) {
            detail.status = 'Error';
            detail.message = e.message;
          }
          details.push(detail);
          if (detail.success) break;
        }
        if (isSuccess) break;
      }
      
      if (isSuccess) {
        diagnosticCode = 'SUCCESS';
        summary = 'Koneksi Google Gemini berhasil!';
      } else {
        var firstMsg = details[0] ? details[0].message : '';
        if (firstMsg.indexOf('quota') !== -1 || firstMsg.indexOf('Limit') !== -1 || firstMsg.indexOf('limit') !== -1) {
          diagnosticCode = 'QUOTA_EXCEEDED';
          summary = 'KUOTA HABIS / NO QUOTA (LIMIT: 0 / QUOTA EXCEEDED).\n' +
                    'Penyebab Utama: Proyek Google Cloud Anda membatasi kuota menjadi 0 (billing nonaktif), atau Google membatasi akun ini.\n' +
                    'Solusi Alternatif Tercepat: Gunakan akun Gmail lain untuk membuat API Key Gemini baru di Google AI Studio, ATAU ganti provider ke Groq Cloud / OpenRouter.';
        } else if (firstMsg.indexOf('key') !== -1 || firstMsg.indexOf('API key') !== -1 || firstMsg.indexOf('invalid') !== -1) {
          diagnosticCode = 'INVALID_KEY';
          summary = 'API Key Google Gemini tidak valid.';
        } else {
          diagnosticCode = 'ERROR';
          summary = 'Gagal terhubung ke Google Gemini. Kesalahan: ' + firstMsg;
        }
      }
      
    } else if (provider === 'groq') {
      var activeModel = model ? model : 'llama-3.3-70b-versatile';
      var payload = {
        model: activeModel,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 10
      };
      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      
      var url = 'https://api.groq.com/openai/v1/chat/completions';
      var detail = { model: activeModel, success: false, status: '', message: '' };
      
      try {
        var response = UrlFetchApp.fetch(url, options);
        statusCode = response.getResponseCode();
        var body = response.getContentText();
        detail.status = statusCode;
        
        if (statusCode === 200) {
          var res = JSON.parse(body);
          if (res.choices && res.choices[0].message) {
            detail.success = true;
            detail.message = 'Koneksi berhasil: ' + res.choices[0].message.content.trim();
            isSuccess = true;
            diagnosticCode = 'SUCCESS';
            summary = 'Koneksi ke Groq API berhasil menggunakan model ' + activeModel + '.';
          } else {
            detail.message = 'Respons tidak valid dari Groq API';
          }
        } else {
          var errData = {};
          try { errData = JSON.parse(body); } catch(ex) {}
          detail.message = errData.error ? errData.error.message : 'Error ' + statusCode;
          diagnosticCode = 'ERROR';
          summary = 'Gagal terhubung ke Groq. Pesan kesalahan: ' + detail.message;
        }
      } catch(e) {
        detail.status = 'Error';
        detail.message = e.message;
        diagnosticCode = 'ERROR';
        summary = 'Gagal menghubungi Groq: ' + e.message;
      }
      details.push(detail);
      
    } else if (provider === 'openrouter') {
      var activeModel = model ? model : 'openrouter/free';
      var payload = {
        model: activeModel,
        messages: [{ role: 'user', content: testPrompt }]
      };
      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'HTTP-Referer': 'https://github.com/google-gemini/rhk-agent',
          'X-Title': 'RHK-Agent'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      
      var url = 'https://openrouter.ai/api/v1/chat/completions';
      var detail = { model: activeModel, success: false, status: '', message: '' };
      
      try {
        var response = UrlFetchApp.fetch(url, options);
        statusCode = response.getResponseCode();
        var body = response.getContentText();
        detail.status = statusCode;
        
        if (statusCode === 200) {
          var res = JSON.parse(body);
          if (res.choices && res.choices[0].message) {
            detail.success = true;
            detail.message = 'Koneksi berhasil: ' + res.choices[0].message.content.trim();
            isSuccess = true;
            diagnosticCode = 'SUCCESS';
            summary = 'Koneksi ke OpenRouter API berhasil menggunakan model ' + activeModel + '.';
          } else {
            detail.message = 'Respons tidak valid dari OpenRouter API';
          }
        } else {
          var errData = {};
          try { errData = JSON.parse(body); } catch(ex) {}
          detail.message = errData.error ? errData.error.message : 'Error ' + statusCode;
          diagnosticCode = 'ERROR';
          summary = 'Gagal terhubung ke OpenRouter. Pesan kesalahan: ' + detail.message;
        }
      } catch(e) {
        detail.status = 'Error';
        detail.message = e.message;
        diagnosticCode = 'ERROR';
        summary = 'Gagal menghubungi OpenRouter: ' + e.message;
      }
      details.push(detail);
    }
  } catch(globalErr) {
    diagnosticCode = 'ERROR';
    summary = 'Kesalahan sistem global: ' + globalErr.message;
  }

  return {
    success: isSuccess,
    diagnosticCode: diagnosticCode,
    summary: summary,
    details: details
  };
}

function getOrAddColumnIndex(sheet, headerName) {
  var lastCol = sheet.getLastColumn();
  if (lastCol <= 0) {
    sheet.getRange(1, 1).setValue(headerName);
    return 1;
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === headerName) {
      return i + 1;
    }
  }
  // Append new column
  var newColIndex = lastCol + 1;
  sheet.getRange(1, newColIndex).setValue(headerName)
    .setFontWeight('bold')
    .setBackground('#4285F4')
    .setFontColor('#FFFFFF');
  return newColIndex;
}


/**
 * Membersihkan output narasi AI dari karakter aneh, simbol markdown,
 * dan formatting yang tidak konsisten.
 * Mengatasi masalah output dari berbagai provider AI (terutama OpenRouter)
 * yang sering menyisipkan karakter Unicode dekoratif dan format markdown.
 * @param {string} text - Teks narasi mentah dari AI
 * @returns {string} Teks narasi yang sudah dibersihkan
 */
function sanitizeNarrativeOutput(text) {
  if (!text) return '';
  
  // 1. Konversi SEMUA simbol aneh di AWAL baris menjadi dash standar (-)
  //    Mendeteksi karakter apa pun yang BUKAN huruf, angka, atau tanda baca standar di awal baris
  text = text.replace(/^(\s*)[^\w\s\d\(\)\[\]"'.\-a-zA-Z]\s+/gm, '$1- ');

  // 2. Konversi asterisk (*) di awal baris menjadi dash (-) (fallback)
  text = text.replace(/^(\s*)\*\s+/gm, '$1- ');
  
  // 3. NUKLIR: Hapus SEMUA karakter Unicode yang bukan ASCII standar atau tanda baca wajar
  //    Ini menjamin tidak akan ada kotak (☒), simbol aneh, atau emoji yang lolos.
  //    Yang dipertahankan: Karakter ASCII (\x20-\x7E), enter/tab (\n\r\t), dan smart quotes/dashes (“”‘’—–)
  text = text.replace(/[^\x20-\x7E\n\r\t“”‘’—–]/g, '');
  
  // 4. Hapus simbol markdown: **bold**, *italic*, ##heading, ~~strikethrough~~
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');  // **bold** → bold
  text = text.replace(/\*([^*]+)\*/g, '$1');       // *italic* → italic
  text = text.replace(/~~([^~]+)~~/g, '$1');       // ~~strike~~ → strike
  text = text.replace(/^#{1,6}\s*/gm, '');         // ## heading → heading
  text = text.replace(/^>\s*/gm, '');              // > blockquote → plain text
  text = text.replace(/`([^`]+)`/g, '$1');         // `code` → code
  
  // (Catatan: Kita tidak lagi menghapus dash (-) di awal baris karena dash digunakan oleh PdfService
  // untuk mengenali list bullet dan memberikan indentasi yang benar)
  
  // 5. Hapus karakter kontrol dan zero-width characters
  text = text.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '');
  
  // 6. Hapus replacement character (kotak/tanda tanya)
  text = text.replace(/\uFFFD/g, '');
  
  // 7. Normalisasi format sub-poin alfabet (a., b., c., dll.)
  //    Perbaiki spasi berlebihan antara huruf marker dan teks
  //    Contoh: "a.   Teks panjang" → "a. Teks panjang"
  //    Contoh: "  a)   Teks" → "a) Teks"
  text = text.replace(/^\s*([a-z])\.\s{2,}/gmi, '$1. ');
  text = text.replace(/^\s*([a-z])\)\s{2,}/gmi, '$1) ');
  
  // 8. Pastikan setiap sub-poin alfabet dimulai di awal baris (tanpa indentasi berlebihan)
  //    Beberapa model AI menambahkan 3-8 spasi sebelum a., b., c. secara tidak konsisten
  text = text.replace(/^\s{1,8}([a-z][.\)])\s/gmi, '$1 ');
  
  // 9. Perbaiki indentasi yang berlebihan (lebih dari 6 spasi di awal baris)
  //    Tapi jangan sentuh baris yang dimulai dengan list alfabet (sudah dinormalisasi di atas)
  text = text.replace(/^(\s{7,})/gm, '   ');
  
  // 10. Perbaiki tab yang terkonversi menjadi banyak spasi
  text = text.replace(/\t/g, '   ');
  
  // 11. Hapus baris yang hanya berisi simbol/garis pemisah
  text = text.replace(/^[\s]*[=\-_*]{3,}[\s]*$/gm, '');
  
  // 12. Perbaiki multiple baris kosong berturut-turut (maks 2 baris kosong)
  text = text.replace(/\n{4,}/g, '\n\n\n');
  
  // 13. Hapus spasi berlebihan di akhir baris
  text = text.replace(/[ \t]+$/gm, '');
  
  // 14. Hapus spasi ganda di dalam kalimat
  text = text.replace(/  +/g, ' ');
  
  // 15. Bersihkan awal dan akhir teks
  text = text.trim();
  
  return text;
}
