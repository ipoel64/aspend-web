import os
import re
import sys
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
import socket

PORT = 8000

MOCK_JS = """
// ==============================================================
// ── GOOGLE APPS SCRIPT LOCAL MOCK & BRIDGE ENGINE ─────────────
// ==============================================================
(function() {
  console.log("Initializing ASPEND Google Apps Script Dev Bridge...");

  // Mock Database Layer (using localStorage)
  const mockDB = {
    getDB(key, defaultVal = []) {
      const val = localStorage.getItem('mock_db_' + key);
      return val ? JSON.parse(val) : defaultVal;
    },
    setDB(key, data) {
      localStorage.setItem('mock_db_' + key, JSON.stringify(data));
    },
    
    getUserProfile(email) {
      const profiles = this.getDB('users', []);
      let profile = profiles.find(p => p.email === email);
      if (!profile) {
        profile = {
          email: email || 'user@kemensos.go.id',
          nama: 'Syaiful Kholifah (Local Dev)',
          nip: '199208152020121001',
          jabatan: 'Penata Layanan Operasional',
          kabupatenKota: 'Kota Binjai',
          signatureUrl: '',
          photoUrl: '',
          needsSpreadsheetRegistration: false
        };
        profiles.push(profile);
        this.setDB('users', profiles);
      }
      
      const ssId = localStorage.getItem('mock_ss_id_' + email);
      if (!ssId) {
        profile.needsSpreadsheetRegistration = true;
      } else {
        profile.needsSpreadsheetRegistration = false;
      }
      return profile;
    },
    
    registerUserSpreadsheet(email, ssId) {
      localStorage.setItem('mock_ss_id_' + email, ssId);
      return { success: true, message: 'Spreadsheet berhasil dihubungkan.' };
    },
    
    isCurrentUserAdmin(email) {
      return true; 
    },
    
    getRHKOptions() {
      return this.getDB('master_rhk', [
        {id: "RHK-1", jenisRhk: "Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah", rencanaAksi: "Melakukan verifikasi komitmen dan pemutakhiran data KPM PKH", isP2K2: false},
        {id: "RHK-2", jenisRhk: "Terlaksananya pertemuan P2K2 sesuai dengan ketentuan", rencanaAksi: "Melakukan pendampingan Pertemuan Peningkatan Kemampuan Keluarga (P2K2)", isP2K2: true},
        {id: "RHK-3", jenisRhk: "Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementerian Sosial", rencanaAksi: "Mengikuti rapat koordinasi dan evaluasi di tingkat kabupaten/kota", isP2K2: false}
      ]);
    },
    
    getRencanaAksiByJenis(jenisRhk) {
      const list = this.getRHKOptions();
      return list.filter(o => o.jenisRhk === jenisRhk).map(o => o.rencanaAksi);
    },
    
    getP2K2Moduls() {
      return [
        {id: "p2k2-m1", modul: "MODUL 1: Pengasuhan dan Pendidikan Anak", sesi: "Sesi 1: Menjadi Orang Tua yang Lebih Baik"},
        {id: "p2k2-m1", modul: "MODUL 1: Pengasuhan dan Pendidikan Anak", sesi: "Sesi 2: Memahami Perilaku Anak"},
        {id: "p2k2-m1", modul: "MODUL 1: Pengasuhan dan Pendidikan Anak", sesi: "Sesi 3: Memahami Cara Anak Usia Dini Belajar"},
        {id: "p2k2-m1", modul: "MODUL 1: Pengasuhan dan Pendidikan Anak", sesi: "Sesi 4: Membantu Anak Sukses di Sekolah"},
        {id: "p2k2-m2", modul: "MODUL 2: Pengelolaan Keuangan dan Perencanaan Usaha", sesi: "Sesi 1: Mengelola Keuangan Keluarga"},
        {id: "p2k2-m2", modul: "MODUL 2: Pengelolaan Keuangan dan Perencanaan Usaha", sesi: "Sesi 2: Cermat Meminjam dan Menabung"},
        {id: "p2k2-m2", modul: "MODUL 2: Pengelolaan Keuangan dan Perencanaan Usaha", sesi: "Sesi 3: Memulai Usaha"},
        {id: "p2k2-m3", modul: "MODUL 3: Kesehatan dan Gizi", sesi: "Sesi 1: Pentingnya Gizi dan Layanan Ibu Hamil"},
        {id: "p2k2-m3", modul: "MODUL 3: Kesehatan dan Gizi", sesi: "Sesi 2: Pentingnya Gizi untuk Ibu Menyusui dan Balita"},
        {id: "p2k2-m3", modul: "MODUL 3: Kesehatan dan Gizi", sesi: "Sesi 3: Kesakitan pada Anak dan Kebersihan Lingkungan"},
        {id: "p2k2-m4", modul: "MODUL 4: Perlindungan Anak", sesi: "Sesi 1: Upaya Pencegahan Kekerasan dan Perlakuan Salah pada Anak"},
        {id: "p2k2-m4", modul: "MODUL 4: Perlindungan Anak", sesi: "Sesi 2: Penelantaran dan Eksploitasi pada Anak"},
        {id: "p2k2-m5", modul: "MODUL 5: Kesejahteraan Sosial", sesi: "Sesi 1: Pelayanan Bagi Penyandang Disabilitas Berat"},
        {id: "p2k2-m5", modul: "MODUL 5: Kesejahteraan Sosial", sesi: "Sesi 2: Upaya Peningkatan Kesejahteraan Lanjut Usia"}
      ];
    },
    
    getUniqueModulP2K2() {
      const list = this.getP2K2Moduls();
      const seen = new Set();
      return list.filter(m => {
        if (seen.has(m.modul)) return false;
        seen.add(m.modul);
        return true;
      }).map(m => m.modul);
    },
    
    getSesiByModul(modulName) {
      const list = this.getP2K2Moduls();
      return list.filter(m => m.modul === modulName).map(m => ({ id: m.id, sesi: m.sesi }));
    },
    
    saveUserProfile(data) {
      const email = localStorage.getItem('aspend_clientEmail') || 'user@kemensos.go.id';
      const profiles = this.getDB('users', []);
      let profile = profiles.find(p => p.email === email);
      if (!profile) {
        profile = { email: email };
        profiles.push(profile);
      }
      profile.nama = data.nama;
      profile.nip = data.nip;
      profile.jabatan = data.jabatan;
      profile.kabupatenKota = data.kabupatenKota;
      this.setDB('users', profiles);
      return { success: true, message: 'Profil berhasil diperbarui.' };
    },
    
    updateUserProfile(data) {
      return this.saveUserProfile(data);
    },
    
    getDashboardStats(email) {
      const reports = this.getDB('reports', []);
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      let monthCount = 0;
      let draftCount = 0;
      let doneCount = 0;
      
      reports.forEach(r => {
        const rDate = new Date(r.Tanggal || r.CreatedAt);
        if (!isNaN(rDate.getTime()) && rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear) {
          monthCount++;
        }
        if (r.Status === 'Draft') draftCount++;
        if (r.Status === 'Selesai') doneCount++;
      });
      
      return {
        total: reports.length,
        month: monthCount,
        pending: draftCount,
        done: doneCount
      };
    },
    
    getUserReports(options, email) {
      let reports = this.getDB('reports', []);
      
      reports.sort((a,b) => new Date(b.CreatedAt || 0) - new Date(a.CreatedAt || 0));
      
      if (options.filterJenis) {
        reports = reports.filter(r => r.IdRHK === options.filterJenis);
      }
      if (options.filterRencanaAksi) {
        reports = reports.filter(r => r.RencanaAksi === options.filterRencanaAksi);
      }
      if (options.filterDate) {
        const targetMonth = options.filterDate.substring(0, 7); 
        reports = reports.filter(r => {
          const d = r.Tanggal || r.CreatedAt;
          return d && d.startsWith(targetMonth);
        });
      }
      if (options.searchTerm) {
        const term = options.searchTerm.toLowerCase();
        reports = reports.filter(r => 
          (r.JenisRHK && r.JenisRHK.toLowerCase().includes(term)) ||
          (r.RencanaAksi && r.RencanaAksi.toLowerCase().includes(term)) ||
          (r.PoinKegiatan && r.PoinKegiatan.toLowerCase().includes(term)) ||
          (r.Lokasi && r.Lokasi.toLowerCase().includes(term))
        );
      }
      
      const total = reports.length;
      const page = options.page || 1;
      const pageSize = options.pageSize || 10;
      const start = (page - 1) * pageSize;
      const paginated = reports.slice(start, start + pageSize);
      
      return {
        data: paginated,
        total: total,
        page: page,
        pageSize: pageSize,
        folderUrl: '#'
      };
    },
    
    submitReportData(payload, email) {
      const reports = this.getDB('reports', []);
      let reportId = payload.reportId;
      let report = reports.find(r => r.ReportId === reportId);
      
      const dateStr = payload.tanggal || new Date().toISOString().substring(0, 10);
      const nowStr = new Date().toISOString();
      
      const rhkOpts = this.getRHKOptions();
      const matchedRhk = rhkOpts.find(o => o.id === payload.jenisRhkId);
      const jenisRhkText = matchedRhk ? matchedRhk.jenisRhk : 'Laporan RHK';
      
      let thumbId = '';
      if (payload.photos && payload.photos.length > 0) {
        thumbId = payload.photos[0]; 
      }
      
      if (!report) {
        reportId = 'REP-' + Date.now();
        report = {
          ReportId: reportId,
          Email: email,
          CreatedAt: nowStr
        };
        reports.push(report);
      }
      
      report.Tanggal = dateStr;
      report.JenisRHK = jenisRhkText;
      report.IdRHK = payload.jenisRhkId;
      report.RencanaAksi = payload.rencanaAksi;
      report.Lokasi = payload.lokasi;
      report.PoinKegiatan = payload.poin;
      report.Status = 'Draft';
      report.FotoIds = JSON.stringify(payload.photos || []);
      report.ThumbnailId = thumbId;
      report.P2K2Data = payload.p2k2 ? JSON.stringify(payload.p2k2) : '';
      
      this.setDB('reports', reports);
      return { success: true, reportId: reportId };
    },
    
    async generateNarrative(reportId) {
      const reports = this.getDB('reports', []);
      const report = reports.find(r => r.ReportId === reportId);
      if (!report) throw new Error('Laporan tidak ditemukan.');
      
      const config = this.getDB('ai_config', { provider: 'google', geminiKey: '' });
      if (config.provider === 'google' && config.geminiKey) {
        try {
          const prompt = `Buatkan narasi laporan Rencana Hasil Kerja (RHK) formal Kementerian Sosial RI.
Data:
Jenis RHK: ${report.JenisRHK}
Rencana Aksi: ${report.RencanaAksi}
Tanggal: ${report.Tanggal}
Lokasi: ${report.Lokasi}
Detail Kegiatan: ${report.PoinKegiatan}

Format Laporan Wajib:
A. PENDAHULUAN
B. KEGIATAN YANG DILAKSANAKAN
C. HASIL
D. KESIMPULAN DAN SARAN
E. PENUTUP`;

          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          });
          const resJson = await response.json();
          if (resJson.candidates && resJson.candidates[0].content.parts[0].text) {
            const text = resJson.candidates[0].content.parts[0].text;
            report.NarasiAI = text;
            this.setDB('reports', reports);
            return text;
          }
        } catch (err) {
          console.error("Gemini API call failed, falling back to mock:", err);
        }
      }
      
      const text = `A. PENDAHULUAN
1. Gambaran Umum
Dalam rangka meningkatkan kesejahteraan sosial masyarakat, Program Keluarga Harapan (PKH) menjadi pilar utama untuk pengentasan kemiskinan. Kegiatan pendampingan sosial ini dilakukan untuk mendukung pencapaian rencana kerja Kementerian Sosial RI.

2. Maksud dan Tujuan
Kegiatan ini bertujuan untuk memfasilitasi pendampingan dan pemantauan serta koordinasi program dengan sasaran KPM di wilayah dampingan.

3. Ruang Lingkup
Cakupan kegiatan meliputi wilayah kerja pendampingan di Kecamatan Kota Binjai.

4. Dasar
- Tugas Pokok dan Fungsi Pendamping PKH Kementerian Sosial RI.
- Rencana Kerja tahunan Pendamping PKH Kota Binjai.

B. KEGIATAN YANG DILAKSANAKAN
Kegiatan dilaksanakan pada tanggal ${report.Tanggal} bertempat di ${report.Lokasi}. Pertemuan dihadiri oleh perwakilan warga dampingan serta pihak desa setempat.
Proses pelaksanaan dimulai dari pembukaan, penyampaian pokok kegiatan, dan dilanjutkan dengan diskusi interaktif/tanya jawab mengenai kendala dan penyelesaian masalah di lapangan.
Detail Aktivitas:
${report.PoinKegiatan.split('\\n').map(line => '- ' + line).join('\\n')}

C. HASIL
Hasil yang didapatkan dari kegiatan ini antara lain:
1. Terjalinnya koordinasi yang baik dengan warga dampingan.
2. Tersosialisasikannya rencana aksi: ${report.RencanaAksi}.
3. Diperolehnya data langsung mengenai kendala di lapangan yang membutuhkan tindak lanjut lebih lanjut.

D. KESIMPULAN DAN SARAN
1. Kesimpulan
Kegiatan pendampingan sosial berjalan dengan tertib, lancar, dan tepat sasaran sesuai dengan target waktu yang ditentukan.
2. Saran
Disarankan untuk melakukan pemantauan berkala guna memastikan rencana aksi dapat terlaksana secara konsisten pada periode berikutnya.

E. PENUTUP
Demikian laporan pertanggungjawaban kegiatan ini dibuat dengan sebenar-benarnya untuk digunakan sebagaimana mestinya.

<lokasi>${report.Lokasi}</lokasi>`;

      report.NarasiAI = text;
      this.setDB('reports', reports);
      return text;
    },
    
    saveEditedNarrative(reportId, narrative) {
      const reports = this.getDB('reports', []);
      const report = reports.find(r => r.ReportId === reportId);
      if (report) {
        report.NarasiEdited = narrative;
        this.setDB('reports', reports);
      }
      return { success: true };
    },
    
    getReportNarrative(reportId) {
      const reports = this.getDB('reports', []);
      const report = reports.find(r => r.ReportId === reportId);
      return report ? (report.NarasiEdited || report.NarasiAI || '') : '';
    },
    
    createReportPDF(reportId) {
      const reports = this.getDB('reports', []);
      const report = reports.find(r => r.ReportId === reportId);
      if (report) {
        report.Status = 'Selesai';
        report.PdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf-test.pdf';
        report.PdfFileId = 'mock-pdf-file-id';
        this.setDB('reports', reports);
      }
      return { success: true, pdfUrl: report.PdfUrl };
    },
    
    downloadReport(reportId) {
      const reports = this.getDB('reports', []);
      const report = reports.find(r => r.ReportId === reportId);
      return { url: report ? (report.PdfUrl || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf-test.pdf') : '#' };
    },
    
    savePdfToDrive(reportId) {
      return { success: true, message: 'PDF berhasil disimpan ke folder RHK-agent_Output di Google Drive Anda.' };
    },
    
    uploadSignature(base64, mime) {
      const email = localStorage.getItem('aspend_clientEmail') || 'user@kemensos.go.id';
      const profiles = this.getDB('users', []);
      let profile = profiles.find(p => p.email === email);
      if (profile) {
        profile.signatureUrl = base64;
        this.setDB('users', profiles);
      }
      return { success: true, fileId: 'sig-' + Date.now(), url: base64 };
    },
    
    uploadProfilePhoto(base64, mime) {
      const email = localStorage.getItem('aspend_clientEmail') || 'user@kemensos.go.id';
      const profiles = this.getDB('users', []);
      let profile = profiles.find(p => p.email === email);
      if (profile) {
        profile.photoUrl = base64;
        this.setDB('users', profiles);
      }
      return { success: true, fileId: 'photo-' + Date.now(), url: base64 };
    },
    
    uploadKemensosLogo(base64, mime, email) {
      localStorage.setItem('mock_kemensos_logo', base64);
      return { success: true, fileId: 'logo-' + Date.now(), url: base64 };
    },
    
    getKemensosLogoUrl() {
      return localStorage.getItem('mock_kemensos_logo') || '';
    },
    
    uploadReportPhotos(base64Array, mimes) {
      return { success: true, fileIds: base64Array };
    },
    
    deleteReportData(id, email) {
      let reports = this.getDB('reports', []);
      reports = reports.filter(r => r.ReportId !== id);
      this.setDB('reports', reports);
      return { success: true };
    },
    
    getAIConfigForAdmin(email) {
      return this.getDB('ai_config', { provider: 'google', geminiKey: '', groqKey: '', openrouterKey: '', model: '' });
    },
    
    saveAIConfig(payload, email) {
      this.setDB('ai_config', payload);
      return { success: true, message: 'Konfigurasi AI berhasil disimpan.' };
    },
    
    async testAIConnection(provider, apiKey, model, email) {
      if (provider === 'google') {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "ping" }] }]
            })
          });
          const resJson = await response.json();
          if (response.ok) {
            return { success: true, message: 'Koneksi ke Gemini API sukses!' };
          } else {
            return { success: false, message: resJson.error ? resJson.error.message : 'Koneksi gagal.' };
          }
        } catch (err) {
          return { success: false, message: err.message };
        }
      }
      return { success: true, message: 'Koneksi simulasi sukses!' };
    },
    
    getAllMasterP2K2() {
      return this.getDB('master_p2k2', [
        {ID: "p2k2-01", MODUL: "MODUL 1: Pengasuhan dan Pendidikan Anak", SESI: "Sesi 1: Menjadi Orang Tua yang Lebih Baik", _rowIndex: 2},
        {ID: "p2k2-02", MODUL: "MODUL 1: Pengasuhan dan Pendidikan Anak", SESI: "Sesi 2: Memahami Perilaku Anak", _rowIndex: 3},
        {ID: "p2k2-03", MODUL: "MODUL 2: Pengelolaan Keuangan dan Perencanaan Usaha", SESI: "Sesi 1: Mengelola Keuangan Keluarga", _rowIndex: 4}
      ]);
    },
    
    getMasterRHKData() {
      const list = this.getRHKOptions();
      return list.map((o, idx) => ({ ...o, ID: o.id, JENIS_RHK: o.jenisRhk, RENCANA_AKSI: o.rencanaAksi, _rowIndex: idx + 2 }));
    },
    
    saveMasterData(payload, email) {
      if (payload.type === 'rhk') {
        const list = this.getRHKOptions();
        if (payload.rowIndex) {
          list[payload.rowIndex - 2] = { id: payload.id, jenisRhk: payload.val1, rencanaAksi: payload.val2 };
        } else {
          list.push({ id: payload.id, jenisRhk: payload.val1, rencanaAksi: payload.val2, isP2K2: payload.val1.toLowerCase().includes('p2k2') });
        }
        this.setDB('master_rhk', list);
      } else {
        const list = this.getDB('master_p2k2', []);
        if (payload.rowIndex) {
          const idx = list.findIndex(p => p._rowIndex === payload.rowIndex);
          if (idx !== -1) {
            list[idx] = { ID: payload.id, MODUL: payload.val1, SESI: payload.val2, _rowIndex: payload.rowIndex };
          }
        } else {
          const maxRow = list.reduce((max, p) => p._rowIndex > max ? p._rowIndex : max, 1);
          list.push({ ID: payload.id, MODUL: payload.val1, SESI: payload.val2, _rowIndex: maxRow + 1 });
        }
        this.setDB('master_p2k2', list);
      }
      return { success: true, message: 'Data master berhasil disimpan.' };
    },
    
    deleteMasterData(type, rowIndex, email) {
      if (type === 'rhk') {
        const list = this.getRHKOptions();
        list.splice(rowIndex - 2, 1);
        this.setDB('master_rhk', list);
      } else {
        const list = this.getDB('master_p2k2', []);
        const idx = list.findIndex(p => p._rowIndex === rowIndex);
        if (idx !== -1) {
          list.splice(idx, 1);
        }
        this.setDB('master_p2k2', list);
      }
      return { success: true, message: 'Data master berhasil dihapus.' };
    },
    
    // Nota Dinas
    apiGetNotaDinasList(email) {
      let list = this.getDB('nota_dinas', []);
      list.sort((a,b) => new Date(b.tanggal || 0) - new Date(a.tanggal || 0));
      return { reports: list };
    },
    
    apiSaveNotaDinasWithFiles(payload, email) {
      const list = this.getDB('nota_dinas', []);
      const id = 'ND-' + Date.now();
      const item = {
        Id: id,
        NotaDinasId: id,
        nomor: payload.nomor,
        yth: payload.yth,
        dari: payload.dari,
        hal: payload.hal,
        lampiran: payload.lampiran,
        sifat: payload.sifat,
        tanggal: payload.tanggal || new Date().toISOString().substring(0, 10),
        poinDraft: payload.poinDraft,
        isiNotaDinas: payload.isiNotaDinas,
        fotoBase64: payload.fotoBase64 || '',
        PdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf-test.pdf'
      };
      list.push(item);
      this.setDB('nota_dinas', list);
      return { success: true, id: id };
    },
    
    apiCreateNotaDinasPdf(id, email) {
      const list = this.getDB('nota_dinas', []);
      const item = list.find(n => n.Id === id);
      return { success: true, pdfUrl: item ? item.PdfUrl : 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf-test.pdf' };
    },
    
    apiDeleteNotaDinas(id, email) {
      let list = this.getDB('nota_dinas', []);
      list = list.filter(n => n.Id !== id);
      this.setDB('nota_dinas', list);
      return { success: true };
    },
    
    // Pengaduan
    apiGetPengaduanList(email) {
      let list = this.getDB('pengaduan', []);
      list.sort((a,b) => new Date(b.tanggalAduan || 0) - new Date(a.tanggalAduan || 0));
      return { reports: list };
    },
    
    apiSaveComplaintWithFiles(payload, email) {
      const list = this.getDB('pengaduan', []);
      const id = 'ADU-' + Date.now();
      const item = {
        Id: id,
        PengaduanId: id,
        namaKpm: payload.namaKpm,
        nik: payload.nik,
        npsn: payload.npsn,
        alamat: payload.alamat,
        lokasi: payload.lokasi,
        kasus: payload.kasus,
        uraian: payload.uraian,
        status: 'Open',
        tanggalAduan: payload.tanggal || new Date().toISOString().substring(0, 10),
        fotoBase64: payload.fotoBase64 || '',
        PdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf-test.pdf'
      };
      list.push(item);
      this.setDB('pengaduan', list);
      return { success: true, id: id };
    },
    
    apiCreatePengaduanPdf(id, email) {
      const list = this.getDB('pengaduan', []);
      const item = list.find(p => p.Id === id);
      return { success: true, pdfUrl: item ? item.PdfUrl : 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf-test.pdf' };
    },
    
    apiDeletePengaduan(id, email) {
      let list = this.getDB('pengaduan', []);
      list = list.filter(p => p.Id !== id);
      this.setDB('pengaduan', list);
      return { success: true };
    },
    
    async callAIService(prompt) {
      const config = this.getDB('ai_config', { provider: 'google', geminiKey: '' });
      if (config.provider === 'google' && config.geminiKey) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          });
          const resJson = await response.json();
          if (resJson.candidates && resJson.candidates[0].content.parts[0].text) {
            return resJson.candidates[0].content.parts[0].text;
          }
        } catch (err) {
          console.error("Gemini API call failed for memo:", err);
        }
      }
      return "MEMO DINAS (MOCK)\\n\\nBerikut adalah rancangan memo kedinasan yang disusun berdasarkan draf/poin-poin masukan Anda. Dokumen ini dibuat formal tanpa menggunakan format markdown agar rapi saat dicetak.\\n\\nDemikian memo dinas ini disampaikan untuk dapat dilaksanakan sebagaimana mestinya.";
    },
    
    apiExtractKtpData(base64, mime) {
      return { success: true, data: { nik: "1275010101900001", nama: "Syaiful Kholifah", alamat: "Kota Binjai" } };
    },
    
    apiCreateVerkomPdf(id, email) {
      return { success: true, pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf-test.pdf" };
    }
  };

  // Google Apps Script API Mock + Dev Bridge router
  window.google = {
    script: {
      run: {
        withSuccessHandler(onSuccess) {
          this._successHandler = onSuccess;
          return this;
        },
        withFailureHandler(onFailure) {
          this._failureHandler = onFailure;
          return this;
        },
        async _call(funcName, args) {
          const success = this._successHandler || (() => {});
          const failure = this._failureHandler || (() => {});
          this._successHandler = null;
          this._failureHandler = null;
          
          const isLiveMode = localStorage.getItem('aspend_dev_live_mode') === 'true';
          const liveGasUrl = localStorage.getItem('aspend_dev_live_url');
          
          if (isLiveMode && liveGasUrl) {
            console.log(`[Dev Bridge -> Live GAS] Calling ${funcName}`, args);
            try {
              const response = await fetch(liveGasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                  functionName: funcName,
                  arguments: args
                })
              });
              
              if (!response.ok) {
                throw new Error(`HTTP Error ${response.status}: Gagal menghubungi server Google Apps Script.`);
              }
              
              const res = await response.json();
              if (res.success) {
                success(res.data);
              } else {
                throw new Error(res.message || "Terjadi kesalahan di server Google Apps Script.");
              }
            } catch (err) {
              console.error(`[Dev Bridge -> Live GAS Error]`, err);
              showToast("Gagal memanggil GAS: " + err.message, "error");
              failure(err);
            }
          } else {
            try {
              console.log(`[Local Mock] Calling ${funcName}`, args);
              const res = await mockDB[funcName](...args);
              setTimeout(() => success(res), 50);
            } catch(err) {
              console.error(`[Local Mock Error]`, err);
              setTimeout(() => failure(err), 50);
            }
          }
        },
        getUserProfile(e) { this._call('getUserProfile', [e]); return this; },
        isCurrentUserAdmin(e) { this._call('isCurrentUserAdmin', [e]); return this; },
        getRHKOptions() { this._call('getRHKOptions', []); return this; },
        getDashboardStats(e) { this._call('getDashboardStats', [e]); return this; },
        getUserReports(o, e) { this._call('getUserReports', [o, e]); return this; },
        getP2K2Moduls() { this._call('getP2K2Moduls', []); return this; },
        getP2K2Sessions(m) { this._call('getP2K2Sessions', [m]); return this; },
        saveUserProfile(d) { this._call('saveUserProfile', [d]); return this; },
        updateUserProfile(d) { this._call('updateUserProfile', [d]); return this; },
        saveNarrative(r, n) { this._call('saveNarrative', [r, n]); return this; },
        getReportNarrative(r) { this._call('getReportNarrative', [r]); return this; },
        downloadReport(r) { this._call('downloadReport', [r]); return this; },
        savePdfToDrive(r) { this._call('savePdfToDrive', [r]); return this; },
        uploadSignature(b, m) { this._call('uploadSignature', [b, m]); return this; },
        uploadProfilePhoto(b, m) { this._call('uploadProfilePhoto', [b, m]); return this; },
        uploadKemensosLogo(b, m, e) { this._call('uploadKemensosLogo', [b, m, e]); return this; },
        uploadReportPhotos(b, m) { this._call('uploadReportPhotos', [b, m]); return this; },
        submitReportData(p, e) { this._call('submitReportData', [p, e]); return this; },
        generateNarrative(r) { this._call('generateNarrative', [r]); return this; },
        createReportPDF(r) { this._call('createReportPDF', [r]); return this; },
        registerUserSpreadsheet(e, s) { this._call('registerUserSpreadsheet', [e, s]); return this; },
        saveMasterData(p, e) { this._call('saveMasterData', [p, e]); return this; },
        deleteMasterData(t, r, e) { this._call('deleteMasterData', [t, r, e]); return this; },
        deleteReportData(i, e) { this._call('deleteReportData', [i, e]); return this; },
        apiDeletePengaduan(i, e) { this._call('apiDeletePengaduan', [i, e]); return this; },
        apiDeleteNotaDinas(i, e) { this._call('apiDeleteNotaDinas', [i, e]); return this; },
        getAIConfigForAdmin(e) { this._call('getAIConfigForAdmin', [e]); return this; },
        saveAIConfig(p, e) { this._call('saveAIConfig', [p, e]); return this; },
        getKemensosLogoUrl() { this._call('getKemensosLogoUrl', []); return this; },
        testAIConnection(pr, k, m, e) { this._call('testAIConnection', [pr, k, m, e]); return this; },
        getAllMasterP2K2() { this._call('getAllMasterP2K2', []); return this; },
        callAIService(p) { this._call('callAIService', [p]); return this; },
        apiSaveNotaDinasWithFiles(p, e) { this._call('apiSaveNotaDinasWithFiles', [p, e]); return this; },
        apiCreateNotaDinasPdf(i, e) { this._call('apiCreateNotaDinasPdf', [i, e]); return this; },
        apiGetNotaDinasList(e) { this._call('apiGetNotaDinasList', [e]); return this; },
        apiGetPengaduanList(e) { this._call('apiGetPengaduanList', [e]); return this; },
        apiSaveComplaintWithFiles(p, e) { this._call('apiSaveComplaintWithFiles', [p, e]); return this; },
        apiCreatePengaduanPdf(i, e) { this._call('apiCreatePengaduanPdf', [i, e]); return this; },
        getRencanaAksiByJenis(j) { this._call('getRencanaAksiByJenis', [j]); return this; },
        getUniqueModulP2K2() { this._call('getUniqueModulP2K2', []); return this; },
        getSesiByModul(m) { this._call('getSesiByModul', [m]); return this; },
        apiExtractKtpData(b, m) { this._call('apiExtractKtpData', [b, m]); return this; },
        apiCreateVerkomPdf(i, e) { this._call('apiCreateVerkomPdf', [i, e]); return this; }
      }
    }
  };

  // Inject Connection Manager Panel to UI
  window.addEventListener('DOMContentLoaded', () => {
    const isLive = localStorage.getItem('aspend_dev_live_mode') === 'true';
    const liveUrl = localStorage.getItem('aspend_dev_live_url') || '';
    
    const container = document.createElement('div');
    container.id = 'dev-bridge-panel';
    container.style.position = 'fixed';
    container.style.bottom = '16px';
    container.style.left = '16px';
    container.style.zIndex = '99999';
    container.style.fontFamily = 'Inter, sans-serif';
    container.innerHTML = `
      <div id="dev-panel-toggle" style="background:#000f22; color:#ffe088; width:42px; height:42px; border-radius:50%; display:flex; items-center:center; justify-content:center; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); border:2px solid #ffe088; transition:all 0.2s;">
        <span class="material-symbols-outlined" style="font-size:24px; line-height:38px; display:block; margin:auto;">settings_ethernet</span>
      </div>
      <div id="dev-panel-content" style="display:none; width:300px; background:#ffffff; border:1px solid #e0e3e6; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.15); padding:16px; margin-top:8px;">
        <h4 style="margin:0 0 8px 0; font-family:Outfit, sans-serif; font-size:14px; color:#000f22; display:flex; justify-content:space-between; align-items:center;">
          <span>🔌 ASPEND Dev Bridge</span>
          <span style="font-size:10px; background:#eceef1; padding:2px 6px; border-radius:4px; color:#43474d;">Local Dev</span>
        </h4>
        <p style="font-size:11px; color:#43474d; margin:0 0 12px 0; line-height:1.4;">Hubungkan frontend lokal Anda dengan database Google Drive & Sheets asli.</p>
        
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:bold; color:#191c1e; display:block; margin-bottom:4px;">Pilih Mode Database:</label>
          <select id="dev-select-mode" style="width:100%; font-size:12px; padding:6px; border-radius:6px; border:1px solid #c4c6ce; outline:none; background:#ffffff;">
            <option value="offline" ${!isLive ? 'selected' : ''}>Offline (localStorage Mock)</option>
            <option value="live" ${isLive ? 'selected' : ''}>Online (Google Drive / Sheets Asli)</option>
          </select>
        </div>
        
        <div id="dev-url-section" style="margin-bottom:12px; display:${isLive ? 'block' : 'none'};">
          <label style="font-size:11px; font-weight:bold; color:#191c1e; display:block; margin-bottom:4px;">Google Apps Script Web App URL:</label>
          <input type="text" id="dev-input-url" value="${liveUrl}" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%; font-size:11px; padding:8px; border-radius:6px; border:1px solid #c4c6ce; box-sizing:border-box; font-family:monospace; outline:none;" />
          <p style="font-size:9px; color:#74777e; margin:4px 0 0 0; line-height:1.2;">Salin URL Web App hasil deploy Anda di Langkah 6.</p>
        </div>
        
        <button id="dev-btn-save" style="width:100%; background:#000f22; color:#ffe088; border:none; padding:8px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer; transition:opacity 0.2s;">Simpan Konfigurasi</button>
      </div>
    `;
    
    document.body.appendChild(container);
    
    const toggleBtn = document.getElementById('dev-panel-toggle');
    const contentPanel = document.getElementById('dev-panel-content');
    const modeSelect = document.getElementById('dev-select-mode');
    const urlSection = document.getElementById('dev-url-section');
    const urlInput = document.getElementById('dev-input-url');
    const saveBtn = document.getElementById('dev-btn-save');
    
    // Toggle expand/collapse
    toggleBtn.addEventListener('click', () => {
      if (contentPanel.style.display === 'none') {
        contentPanel.style.display = 'block';
        toggleBtn.style.transform = 'rotate(90deg)';
      } else {
        contentPanel.style.display = 'none';
        toggleBtn.style.transform = 'rotate(0deg)';
      }
    });
    
    // Mode change handling
    modeSelect.addEventListener('change', () => {
      if (modeSelect.value === 'live') {
        urlSection.style.display = 'block';
      } else {
        urlSection.style.display = 'none';
      }
    });
    
    // Save configuration
    saveBtn.addEventListener('click', () => {
      const mode = modeSelect.value;
      const url = urlInput.value.trim();
      
      if (mode === 'live' && !url) {
        alert("Mohon masukkan Web App URL Google Apps Script Anda!");
        return;
      }
      
      localStorage.setItem('aspend_dev_live_mode', mode === 'live' ? 'true' : 'false');
      localStorage.setItem('aspend_dev_live_url', url);
      
      alert("Konfigurasi disimpan! Halaman akan dimuat ulang.");
      window.location.reload();
    });
  });
})();
"""

class LocalGASServer(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.endswith('.js') and self.path != '/':
            try:
                with open(self.path[1:], 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/javascript; charset=utf-8')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            except Exception as e:
                self.send_response(404)
                self.end_headers()
            return
            
        if self.path == '/' or self.path == '/index.html':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            
            # Read files
            try:
                with open('Index.html', 'r', encoding='utf-8') as f:
                    html = f.read()
                with open('Stylesheet.html', 'r', encoding='utf-8') as f:
                    css = f.read()
                with open('JavaScript.html', 'r', encoding='utf-8') as f:
                    js = f.read()
            except Exception as e:
                self.wfile.write(f"<h3>Error loading files: {str(e)}</h3><p>Make sure run_local.py is inside the project directory.</p>".encode('utf-8'))
                return

            # Clean up style and script tags in read files to prevent nesting errors
            css_clean = css.strip()
            if css_clean.startswith('<style>'):
                css_clean = css_clean[7:]
            if css_clean.endswith('</style>'):
                css_clean = css_clean[:-8]
                
            js_clean = js.strip()
            if js_clean.startswith('<script>'):
                js_clean = js_clean[8:]
            if js_clean.endswith('</script>'):
                js_clean = js_clean[:-9]

            # Replace includes
            html = html.replace("<?!= include('Stylesheet') ?>", f"<style>\n{css_clean}\n</style>")
            
            # Insert mock/bridge scripts before JavaScript.html
            script_block = f"<script>\n{MOCK_JS}\n{js_clean}\n</script>"
            html = html.replace("<?!= include('JavaScript') ?>", script_block)
            
            # Remove any residual GAS tags
            html = re.sub(r'<\?[\s\S]*?\?>', '', html)
            
            self.wfile.write(html.encode('utf-8'))
        else:
            # Serve other static files normally if requested
            filename = self.path.lstrip('/')
            if os.path.exists(filename) and os.path.isfile(filename):
                self.send_response(200)
                if filename.endswith('.js'):
                    self.send_header('Content-Type', 'application/javascript')
                elif filename.endswith('.css'):
                    self.send_header('Content-Type', 'text/css')
                elif filename.endswith('.png'):
                    self.send_header('Content-Type', 'image/png')
                elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
                    self.send_header('Content-Type', 'image/jpeg')
                else:
                    self.send_header('Content-Type', 'application/octet-stream')
                self.end_headers()
                with open(filename, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Not Found")

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    server_address = ('localhost', PORT)
    try:
        httpd = HTTPServer(server_address, LocalGASServer)
    except Exception as e:
        print(f"Error starting server on port {PORT}: {e}")
        print("Maybe port is already in use? Try closing other servers.")
        sys.exit(1)
        
    local_ip = get_local_ip()
    print("=" * 60)
    print(" ASPEND LOCAL DEV SERVER ".center(60, '='))
    print("=" * 60)
    print(f"Server is running on:")
    print(f" -> Local: http://localhost:{PORT}/")
    print(f" -> LAN:   http://{local_ip}:{PORT}/")
    print("-" * 60)
    print("Press Ctrl+C to stop the server.")
    print("=" * 60)
    
    # Auto-open browser
    webbrowser.open(f"http://localhost:{PORT}/")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()
        sys.exit(0)

if __name__ == '__main__':
    main()
