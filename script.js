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

/* ==============================================================
   ASPEND — Client-Side JavaScript (JavaScript.html)
   ============================================================== */

// ── State ──────────────────────────────────────────────────────
const state = {
  clientEmail: localStorage.getItem('aspend_clientEmail') || '',
  currentPage: 'dashboard',
  user: null,
  isAdmin: false,
  reports: [],
  totalReports: 0,
  currentReportPage: 1,
  pageSize: 10,
  
  // Filters
  searchTerm: '',
  filterJenis: '',
  filterRencanaAksi: '',
  filterDate: '',
  filterMonth: '',
  
  // Selected Report/Aduan/Nota Dinas
  currentReportId: null,
  currentAduanId: null,
  currentNDId: null,
  
  // Master lists
  rhkOptions: [],
  p2k2ModulOptions: [],
  
  // Form Upload Cache
  selectedPhotos: [],         // { file, base64, name }
  selectedCSVRows: [],        // CSV parsed data rows
  selectedCSVFileName: '',
  ktpPhotoBase64: '',
  siksPhotoBase64: '',
  ndPhotoBase64: '',
  
  // Voice Input state
  isRecording: false,
  recognition: null,
  
  // Admin Panel Edit states
  editingMasterType: null,    // 'rhk' | 'p2k2'
  editingRowIndex: null,      // null = add, number = edit
  deleteTarget: { type: null, index: null },
  
  // AI Keys
  aiKeys: { google: '', groq: '', openrouter: '' },
  aiProvider: 'google',
  aiModel: '',
  
  // Cache data
  complaintsList: [],
  notaDinasList: []
};

// ── Initialization ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  state.clientEmail = localStorage.getItem('aspend_clientEmail');
  const token = localStorage.getItem('google_access_token');
  
  if (!state.clientEmail || !token || state.clientEmail === 'undefined') {
    localStorage.removeItem('aspend_clientEmail');
    localStorage.removeItem('google_access_token');
    document.getElementById('login-overlay').classList.remove('hidden');
    hideLoading();
    return;
  }
  showLoading('Menginisialisasi ASPEND...');
  
  try {
    // Validasi token terlebih dahulu (apakah sudah kedaluwarsa)
    const valRes = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token);
    if (!valRes.ok) {
       console.warn("Token expired atau tidak valid. Meminta login ulang...");
       throw new Error("Token expired");
    }
    
    // Tunggu profil dan GAPI selesai dimuat
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (typeof gapi !== 'undefined' && gapi.client && gapi.client.drive) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
    
    await loadUserProfile();
    await checkAdmin();
  } catch(err) {
    console.error("Gagal memulai sesi aman:", err);
    localStorage.removeItem('google_access_token');
    document.getElementById('login-overlay').classList.remove('hidden');
    hideLoading();
    return;
  }
  
  loadRHKOptions();
  // loadDashboardData sudah dipanggil secara otomatis oleh loadUserProfile jika di halaman dashboard
  // loadComplaintsData(); // (Ditunda hingga migrasi fase selanjutnya selesai)
  // loadNotaDinasData(); // (Ditunda hingga migrasi fase selanjutnya selesai)
  
  hideLoading();
  
  // Active dashboard by default
  navigateTo(state.currentPage || 'dashboard');
}

// ── Navigation ─────────────────────────────────────────────────
function navigateTo(pageId) {
  state.currentPage = pageId;
  
  // Hide all pages
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.add('hidden');
  });
  
  // Show target page
  var targetPage = document.getElementById('page-' + pageId);
  if (targetPage) {
    targetPage.classList.remove('hidden');
  }
  
  // Update nav item active styling
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.classList.remove('bg-white/25', 'text-white', 'font-bold', 'shadow-sm');
    item.classList.add('text-white/70', 'font-medium');
  });
  
  var activeNav = document.getElementById('nav-' + pageId);
  if (activeNav) {
    activeNav.classList.remove('text-white/70', 'font-medium');
    activeNav.classList.add('bg-white/25', 'text-white', 'font-bold', 'shadow-sm');
  }
  
  // Trigger loaders based on page
  if (pageId === 'dashboard') {
    loadDashboardData();
  } else if (pageId === 'pengaduan') {
    loadComplaintsData();
  } else if (pageId === 'nota-dinas') {
    loadNotaDinasData();
  } else if (pageId === 'settings') {
    loadProfileSettings();
  } else if (pageId === 'admin') {
    loadAdminData();
  }
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Close mobile sidebar backdrop if open
  var backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop && !backdrop.classList.contains('hidden')) {
    toggleSidebar();
  }
}

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar.classList.contains('-translate-x-full')) {
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }
}

// ── Profile and Admin Check ─────────────────────────────────────
async function loadUserProfile() {
  try {
    // 1. Pastikan GAPI Client diinisialisasi dengan token
    await initGoogleApiClient();
    
    // 2. Cari atau buat Spreadsheet di Google Drive
    let spreadsheetId = localStorage.getItem('aspend_spreadsheetId');
    if (!spreadsheetId) {
      spreadsheetId = await locateOrCreateSpreadsheet();
      localStorage.setItem('aspend_spreadsheetId', spreadsheetId);
    }
    state.spreadsheetId = spreadsheetId;
    
    // 3. Muat profil dasar dari Token Google (GSI)
    const email = localStorage.getItem('aspend_clientEmail') || '';
    let picture = localStorage.getItem('aspend_profile_photo') || localStorage.getItem('aspend_driveProfilePicture') || localStorage.getItem('aspend_clientPicture') || '';
    
    // Coba ambil foto profil spesifik ASPEND dari Google Drive pengguna (Aspend Output)
    try {
      if (email && gapi.client && gapi.client.drive) {
        // Gunakan nama depan email untuk pencarian agar lebih tahan terhadap filter tokenisasi Drive API
        const emailPrefix = email.split('@')[0];
        const response = await gapi.client.drive.files.list({
          q: `name contains 'Profile_' and name contains '${emailPrefix}' and mimeType contains 'image/' and trashed=false`,
          fields: 'files(id, name)',
          pageSize: 1
        });
        
        if (response.result.files && response.result.files.length > 0) {
          // Gunakan jalur thumbnail API untuk menghindari blokir kebijakan cross-site browser
          picture = `https://drive.google.com/thumbnail?id=${response.result.files[0].id}&sz=w128`;
          localStorage.setItem('aspend_driveProfilePicture', picture);
        }
        
        // Coba ambil Tanda Tangan
        if (!localStorage.getItem('aspend_signature_base64')) {
          const sigResponse = await gapi.client.drive.files.list({
            q: `name contains 'Signature_' and name contains '${emailPrefix}' and mimeType contains 'image/' and trashed=false`,
            fields: 'files(id, name)',
            pageSize: 1
          });
          if (sigResponse.result.files && sigResponse.result.files.length > 0) {
            const sigId = sigResponse.result.files[0].id;
            const token = gapi.client.getToken().access_token;
            const fetchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${sigId}?alt=media`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (fetchRes.ok) {
              const blob = await fetchRes.blob();
              const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
              localStorage.setItem('aspend_signature_base64', base64);
              console.log("Signature fetched from Drive");
            }
          }
        }
      }
    } catch (err) {
      console.warn("Gagal mengambil foto profil Aspend dari Drive", err);
    }

    let profile = {
       email: email,
       nama: localStorage.getItem('aspend_nama') || '', 
       jabatan: localStorage.getItem('aspend_jabatan') || '',
       nip: localStorage.getItem('aspend_nip') || '',
       kabupaten: localStorage.getItem('aspend_kabupaten') || '',
       picture: picture
    };
    
    try {
      // Sync from Google Sheets "Database"
      console.log("Fetching user profile from Google Sheets...");
      const sheetProfile = await fetchUserProfileClient(spreadsheetId, email);
      if (sheetProfile) {
        console.log("Profile sync success:", sheetProfile);
        profile = { ...profile, ...sheetProfile };
        // Save to localStorage so it persists
        localStorage.setItem('aspend_nama', profile.nama);
        localStorage.setItem('aspend_jabatan', profile.jabatan);
        localStorage.setItem('aspend_nip', profile.nip);
        localStorage.setItem('aspend_kabupaten', profile.kabupaten);
      }
    } catch (e) {
      console.warn("Failed to sync profile from Google Sheets", e);
    }
    
    state.user = profile;
    var initials = getInitials(profile.nama || profile.email || '');
    
    const avatarContainer = document.getElementById('sidebar-avatar-container');
    if (profile.picture) {
      avatarContainer.innerHTML = `<img src="${profile.picture}" alt="Profil" class="w-full h-full object-cover" onerror="this.outerHTML='<span id=\\'sidebar-avatar\\'>${initials}</span>'">`;
    } else {
      avatarContainer.innerHTML = `<span id="sidebar-avatar">${initials}</span>`;
    }
    
    document.getElementById('sidebar-user-name').textContent = profile.nama || profile.email;
    document.getElementById('sidebar-user-role').textContent = profile.jabatan;
    
    var fallbackLogo = document.getElementById('app-logo-fallback');
    if (fallbackLogo && profile.nama) {
      fallbackLogo.textContent = profile.nama.substring(0, 1).toUpperCase();
    }
    
    // 4. Langsung muat data-data jika ada di halaman yang tepat
    if (state.currentPage === 'dashboard') {
      loadDashboardData();
    }
  } catch(err) {
    console.error("Profile Load Error:", err);
    let errorMsg = err.message || "Unknown error";
    if (err.result && err.result.error) {
       errorMsg = err.result.error.message;
    }
    showToast('Gagal memuat profil / Database: ' + errorMsg, 'error');
  }
}

async function checkAdmin() {
  // Untuk migrasi awal Client-side, kita jadikan Admin by default atau cek daftar tertentu
  state.isAdmin = true;
  if (state.isAdmin) {
    // document.getElementById('nav-admin').classList.remove('hidden');
    var logoCard = document.getElementById('logo-instansi-card');
    if (logoCard) logoCard.classList.remove('hidden');
  }
}

// ── RHK Options Loader ──────────────────────────────────────────
function loadRHKOptions() {
  // Data Cadangan (Fallback) jika Spreadsheet gagal
  const defaultRhk = [
    {id: 'RHK-1', jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', rencana: 'Melaksanakan supervisi Kebijakan Bantuan Sosial Kepada ASN PPPK'},
    {id: 'RHK-1', jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', rencana: 'Melakukan edukasi dan sosialisasi pencairan secara tunai dan non tunai'},
    {id: 'RHK-1', jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', rencana: 'Melaksanakan Supervisi Permasalahan Bantuan Sosial'},
    {id: 'RHK-1', jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', rencana: 'Melaksanakan Monitoring/Pemantauan Penyaluran Bantuan Sosial'},
    {id: 'RHK-1', jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', rencana: 'Melaksanakan Penelitian penyaluran bantuan Sosial'},
    {id: 'RHK-2', jenis: 'Terlaksananya pertemuan P2K2 sesuai dengan ketentuan', rencana: 'Melaksanakan Pertemuan Peningkatan Kemampuan Keluarga (P2K2)'},
    {id: 'RHK-2', jenis: 'Terlaksananya pertemuan P2K2 sesuai dengan ketentuan', rencana: 'Melakukan Supervisi pelaksanaan P2K2 kepada ASN PPPK'},
    {id: 'RHK-3', jenis: 'Terlaksananya Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial secara akurat sesuai dengan ketentuan', rencana: 'Melaksanakan Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial'},
    {id: 'RHK-3', jenis: 'Terlaksananya Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial secara akurat sesuai dengan ketentuan', rencana: 'Melakukan pendampingan, mediasi, dan fasilitasi kepada KPM PKH dalam proses perubahan perilaku, pola pikir yang mandiri dan produktif'},
    {id: 'RHK-3', jenis: 'Terlaksananya Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial secara akurat sesuai dengan ketentuan', rencana: 'Melaksanakan supervisi Verifikasi Komitmen Kepada ASN PPPK'},
    {id: 'RHK-4', jenis: 'Tersedianya Data KPM graduasi yang disusun sesuai dengan instrumen dan ketentuan', rencana: 'Melakukan usulan KPM Graduasi mandiri dan Pemberdayaan PPSE'},
    {id: 'RHK-4', jenis: 'Tersedianya Data KPM graduasi yang disusun sesuai dengan instrumen dan ketentuan', rencana: 'Melaksanakan supervisi Graduasi Kepada ASN PPPK'},
    {id: 'RHK-5', jenis: 'Terlaksananya Verifikasi, Validasi dan Permutakhiran Data KPM secara akurat sesuai dengan ketentuan', rencana: 'Melaksanakan Pemutakhiran Data'},
    {id: 'RHK-5', jenis: 'Terlaksananya Verifikasi, Validasi dan Permutakhiran Data KPM secara akurat sesuai dengan ketentuan', rencana: 'Melaksanakan proses bisnis PKH yang meliputi verifikasi validasi calon penerima bantuan sosial'},
    {id: 'RHK-5', jenis: 'Terlaksananya Verifikasi, Validasi dan Permutakhiran Data KPM secara akurat sesuai dengan ketentuan', rencana: 'Melaksanakan supervisi Verifikasi, Validasi dan pemutakhiran Kepada ASN PPPK'},
    {id: 'RHK-6', jenis: 'Terlaksananya kegiatan kasus adaptif (Respon kasus/pengaduan/kebencanaan/kerentanan) disusun secara lengkap dan akurat', rencana: 'Melaksanakan Respon Kasus/Pengaduan/kebencanaan/Kerentanan'},
    {id: 'RHK-7', jenis: 'Tersedianya Data Analisis Laporan Bulanan yang disusun sesuai dengan Ketentuan', rencana: 'Membuat laporan bulanan pelaksanaan PKH dan laporan lainnya.'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Melaksanakan Tindak Lanjut Hasil Pemeriksaan (TLHP)'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Melakukan sosialisasi kebijakan dan bisnis proses PKH kepada aparat pemerintah tingkat kecamatan, desa/kelurahan, KPM PKH, dan masyarakat umum secara berkala melalui Pertemuan atau media sosial di'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Mengikuti Rapat Koordinasi,Sosialisasi Kebijakan Proses Bisnis PKH dan Penguatan Kapasitas SDM.'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Melakukan Pengawasan dan edukasi kepada Pendamping Sosial di Wilayah Kerja'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Melakukan koordinasi dan sinkronisasi dengan instansi terkait di tingkat Kabupaten Kota'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Berkoodinasi dengan ASN PPPK berkaitan dengan pelaksanaan program ke ASN PPPK'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Melakukan Evaluasi Kinerja dan Menyusun Pelaporan ASN PPPK'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Tugas Lainnya (Penugasan lainnya program Kementrian Sosial)'},
    {id: 'RHK-9', jenis: 'Terlaksananya Penyebaran Berita Baik Kementrian Sosial', rencana: 'Berperan aktif dalam memanfaatkan, menggunakan, melibatkan dan menyebarkan Media Sosial untuk menyampaikan semua program di Kementerian Sosial'}
  ];

  fetchAdminDataClient().then(data => {
    let rhkData = data.rhk && data.rhk.length > 0 ? data.rhk : defaultRhk;
    state.rhkOptions = rhkData.map(r => ({id: r.id, jenisRhk: r.jenis, rencanaAksi: r.rencana}));
    
    if (data.p2k2 && data.p2k2.length > 0) {
      state.p2k2ModulOptions = data.p2k2.map(p => ({modul: p.modul, sesi: p.sesi}));
    } else {
      // Default P2K2
      state.p2k2ModulOptions = [
        {modul: 'Modul Kesehatan dan Gizi', sesi: 'Sesi 1 - Pentingnya Gizi dan Layanan Kesehatan Ibu Hamil'},
        {modul: 'Modul Pengasuhan dan Pendidikan Anak', sesi: 'Sesi 1 - Menjadi Orang Tua yang Lebih Baik'},
        {modul: 'Modul Ekonomi', sesi: 'Sesi 1 - Mengelola Keuangan Keluarga'}
      ];
    }
    
    populateDropdowns();
  }).catch(err => {
    console.warn("Gagal memuat RHK dari Google Sheets. Menggunakan Data Cadangan Lokal.", err);
    state.rhkOptions = defaultRhk.map(r => ({id: r.id, jenisRhk: r.jenis, rencanaAksi: r.rencana}));
    state.p2k2ModulOptions = [
        {modul: 'Modul Kesehatan dan Gizi', sesi: 'Sesi 1 - Pentingnya Gizi dan Layanan Kesehatan Ibu Hamil'},
        {modul: 'Modul Pengasuhan dan Pendidikan Anak', sesi: 'Sesi 1 - Menjadi Orang Tua yang Lebih Baik'},
        {modul: 'Modul Ekonomi', sesi: 'Sesi 1 - Mengelola Keuangan Keluarga'}
    ];
    populateDropdowns();
  });
  
  function populateDropdowns() {
    var filterJenisSel = document.getElementById('filter-jenis-rhk');
    if (filterJenisSel) {
      filterJenisSel.innerHTML = '<option value="">Semua Jenis RHK</option>';
      var seen = {};
      state.rhkOptions.forEach(function(o) {
        if (!seen[o.jenisRhk]) {
          seen[o.jenisRhk] = true;
          filterJenisSel.innerHTML += '<option value="' + escapeHtml(o.id) + '">' + escapeHtml(o.id + ' — ' + o.jenisRhk) + '</option>';
        }
      });
    }

    var selectJenis = document.getElementById('select-jenis-rhk');
    if (selectJenis) {
      selectJenis.innerHTML = '<option value="">— Pilih Jenis RHK —</option>';
      var seenForm = {};
      state.rhkOptions.forEach(function(o) {
        if (!seenForm[o.jenisRhk]) {
          seenForm[o.jenisRhk] = true;
          selectJenis.innerHTML += '<option value="' + escapeHtml(o.id) + '">' + escapeHtml(o.id + ' — ' + o.jenisRhk) + '</option>';
        }
      });
    }
    
    // Memicu trigger agar Rencana Aksi terhubung langsung saat baru dimuat
    if (state.filterJenisRHK && filterJenisSel) {
        filterJenisSel.value = state.filterJenisRHK;
        onJenisRHKFilterChange();
    }
  }
}

// ── Dashboard Data & Table ──────────────────────────────────────
async function loadDashboardData(isSilent = false) {
  try {
    let ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) {
      // Bila belum ada ID, berarti belum selesai otentikasi/mencari sheet
      return;
    }
    
    const data = await fetchDashboardDataClient(ssId, state.clientEmail, {
      page: state.currentReportPage,
      pageSize: state.pageSize,
      searchTerm: state.searchTerm,
      filterJenis: state.filterJenis,
      filterDate: state.filterDate,
      filterRencanaAksi: state.filterRencanaAksi,
      filterMonth: state.filterMonth
    });
    
    const stats = data.stats;
    if (document.getElementById('dash-stat-total')) document.getElementById('dash-stat-total').textContent = stats.total || 0;
    if (document.getElementById('dash-stat-month')) document.getElementById('dash-stat-month').textContent = stats.month || 0;
    if (document.getElementById('dash-stat-draft')) document.getElementById('dash-stat-draft').textContent = stats.pending || 0;
    if (document.getElementById('dash-stat-final')) document.getElementById('dash-stat-final').textContent = stats.done || 0;
    
    const breakdownContainer = document.getElementById('dash-rhk-breakdown');
    if (breakdownContainer) {
      breakdownContainer.innerHTML = '';
      if (stats.rhkBreakdown && Object.keys(stats.rhkBreakdown).length > 0) {
        const rhkColors = [
          'bg-slate-500/15 text-slate-600 border-slate-500/20',     // default/0
          'bg-pink-500/15 text-pink-600 border-pink-500/20',       // 1
          'bg-slate-500/15 text-slate-600 border-slate-500/20',    // 2
          'bg-blue-500/15 text-blue-600 border-blue-500/20',       // 3
          'bg-purple-500/15 text-purple-600 border-purple-500/20', // 4
          'bg-indigo-500/15 text-indigo-600 border-indigo-500/20', // 5
          'bg-teal-500/15 text-teal-600 border-teal-500/20',       // 6
          'bg-cyan-500/15 text-cyan-600 border-cyan-500/20',       // 7
          'bg-rose-500/15 text-rose-600 border-rose-500/20',       // 8
          'bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-500/20' // 9
        ];
        
        // Sort keys like RHK-1, RHK-2, etc.
        const sortedKeys = Object.keys(stats.rhkBreakdown).sort((a, b) => {
          let numA = parseInt(a.replace(/\D/g, '')) || 0;
          let numB = parseInt(b.replace(/\D/g, '')) || 0;
          return numA - numB;
        });

        sortedKeys.forEach(key => {
          let num = parseInt(key.replace(/\D/g, '')) || 0;
          let colorClass = rhkColors[num % rhkColors.length];
          breakdownContainer.innerHTML += `<span class="inline-flex items-center justify-between ${colorClass} py-0.5 pl-2 pr-0.5 rounded-md border text-[9px] min-w-[55px] shadow-sm"><span class="font-medium mr-1.5 opacity-80 uppercase tracking-wide">${key}</span><span class="flex items-center justify-center w-4 h-4 rounded-full bg-white/60 border border-black/5 font-black text-[10px] leading-none">${stats.rhkBreakdown[key]}</span></span>`;
        });
      }
    }
    
    const newReports = data.list.data || [];
    const newTotal = data.list.total || 0;
    
    // Perbandingan cerdas untuk auto-refresh tanpa kedipan UI
    if (JSON.stringify(state.reports) !== JSON.stringify(newReports) || state.totalReports !== newTotal || state.statsTotal !== stats.total) {
      state.reports = newReports;
      state.totalReports = newTotal;
      state.statsTotal = stats.total;
      renderDashboardTable();
      
      // Update instan PDF jika sedang dibuka
      if (window.activeReportId && !document.getElementById('pdf-preview-pane').classList.contains('hidden')) {
         previewPdf(window.activeReportId);
      }
    }
    
    if (!isSilent) hideLoading();
  } catch(err) {
    console.error("Dashboard Load Error:", err);
    if (!isSilent) {
      let errorMsg = err.message || err;
      if (typeof err === 'object' && err.result && err.result.error) {
         errorMsg = err.result.error.message;
      }
      hideLoading();
      
      // Deteksi jika error karena otentikasi (Sesi Habis)
      if (typeof errorMsg === 'string' && (errorMsg.includes('invalid authentication') || errorMsg.includes('OAuth') || err.status === 401)) {
          showToast('Sesi login Google Anda telah habis. Silakan muat ulang halaman (Refresh) lalu Login kembali.', 'error');
      } else {
          showToast('Gagal memuat Dashboard: ' + errorMsg, 'error');
      }
    }
  }
}

function renderDashboardTable() {
  var container = document.getElementById('reports-list-container');
  if (!container) return;
  
  // Update info jumlah data filter
  let countInfo = document.getElementById('filter-count-info');
  if (countInfo) {
    if (state.searchTerm || state.filterJenis || state.filterRencanaAksi || state.filterDate || state.filterMonth) {
      countInfo.innerHTML = `${state.totalReports} Data`;
      countInfo.classList.remove('hidden');
    } else {
      countInfo.classList.add('hidden');
    }
  }

  container.innerHTML = '';

  if (!state.reports || state.reports.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-12 text-center border-t border-surface-variant">
        <span class="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">drafts</span>
        <p class="text-on-surface-variant/70 text-sm">Belum ada data laporan.</p>
      </div>
    `;
    return;
  }

  var tableHtml = `
    <div class="w-full bg-white border-0 shadow-none">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-surface-bright text-[9px] text-on-surface-variant/70 uppercase tracking-wider border-b border-surface-variant h-[34px]">
            <th class="px-1 font-semibold text-center w-24">Foto</th>
            <th class="px-1.5 font-semibold">Waktu & Tanggal</th>
            <th class="px-1.5 font-semibold">RHK & Rencana Aksi</th>
            <th class="px-1 font-semibold text-center w-16">Aksi</th>
          </tr>
        </thead>
        <tbody class="text-xs">
  `;

  // Sort descending by created at or date
  var sortedReports = [...state.reports].sort(function(a, b) {
    var pukulA = (a.Pukul && a.Pukul !== '-') ? a.Pukul.toString().trim().substring(0,5) : '00:00';
    var pukulB = (b.Pukul && b.Pukul !== '-') ? b.Pukul.toString().trim().substring(0,5) : '00:00';
    
    var timeA = parseRobustDate(a.Tanggal, pukulA);
    var timeB = parseRobustDate(b.Tanggal, pukulB);
    
    return timeB - timeA;
  });

    let totalItems = sortedReports.length;
    let totalPages = Math.ceil(totalItems / state.pageSize);
    if (state.currentReportPage < 1) state.currentReportPage = 1;
    if (state.currentReportPage > totalPages && totalPages > 0) state.currentReportPage = totalPages;
    
    let startIndex = (state.currentReportPage - 1) * state.pageSize;
    let endIndex = startIndex + state.pageSize;
    let paginatedReports = sortedReports.slice(startIndex, endIndex);

    let lastDateGroup = null;
  
    paginatedReports.forEach(function(r) {
        let formattedDate = r.Tanggal;
      let dateObj = new Date(r.Tanggal);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = new Intl.DateTimeFormat('id-ID', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        }).format(dateObj);
      }

      // Timeline Divider Logic
      if (formattedDate !== lastDateGroup) {
        let isFirstGroup = (lastDateGroup === null);
        lastDateGroup = formattedDate;
        let paddingClass = isFirstGroup ? "pt-2 pb-2" : "pt-6 pb-2";
        tableHtml += `
          <tr class="bg-surface-container-lowest border-t-0">
            <td colspan="4" class="px-3 ${paddingClass}">
              <div class="flex items-center gap-3">
                <div class="h-px bg-outline-variant flex-grow"></div>
                <span class="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded">${formattedDate}</span>
                <div class="h-px bg-outline-variant flex-grow"></div>
              </div>
            </td>
          </tr>
        `;
      }

      // Photo rendering (MENGGUNAKAN THUMBNAIL GOOGLE DRIVE)
      var photos = r.FotoIds;
      if (typeof photos === 'string') {
        try { photos = JSON.parse(photos); } catch(e) {}
      }
      var photoHtml = '';
      if (Array.isArray(photos) && photos.length > 0) {
        let thumbUrl = `https://drive.google.com/thumbnail?id=${photos[0]}&sz=w400`;
        let fullUrl = `https://drive.google.com/uc?id=${photos[0]}&export=view`;
        photoHtml = `
          <div class="relative group w-[80px] h-[56px] mx-auto rounded border border-surface-variant overflow-hidden">
            <img src="${thumbUrl}" class="w-full h-full object-cover" alt="Foto" onerror="this.src='${fullUrl}'; this.onerror=null;">
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span class="material-symbols-outlined text-white text-[20px]">zoom_in</span>
            </div>
          </div>
        `;
      } else {
        photoHtml = `<div class="rounded bg-surface flex items-center justify-center text-on-surface-variant/30 border border-surface-variant" style="width: 80px; height: 56px; flex-shrink: 0;"><span class="material-symbols-outlined text-[18px]">hide_image</span></div>`;
      }
      
      // Judul RHK
      var idText = r.IdRHK || r.JenisRHK || '';
      var angkaRHK = idText.replace(/\D/g, '') || '?';
      
      // Rencana Aksi sebagai Judul Utama (Lebih Besar, Tebal)
      var judulHTML = `<div class="font-bold text-on-surface mb-0.5 text-[11px] leading-tight line-clamp-2" title="${r.RencanaAksi || ''}">${r.RencanaAksi || '-'}</div>`;
      
      var statusText = (r.Status && r.Status.toLowerCase() !== 'draft') ? 'Selesai' : 'Draft';
      var statusClass = statusText === 'Selesai' 
          ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' 
          : 'bg-amber-500/15 text-amber-600 border-amber-500/30';
      var statusIcon = statusText === 'Selesai' ? 'check_circle' : 'edit_document';
      var statusBadge = `<span class="inline-flex items-center px-1 py-0.5 rounded border ${statusClass} font-bold text-[7px] uppercase tracking-wider shadow-sm" style="white-space: nowrap;"><span class="material-symbols-outlined text-[8px] mr-0.5">${statusIcon}</span>${statusText}</span>`;

      // Logika Warna RHK (Pelangi)
      var angkaRHKNum = parseInt(angkaRHK) || 0;
      var rhkColors = [
        'bg-slate-500/15 text-slate-600 border-slate-500/20',     // default/0
        'bg-pink-500/15 text-pink-600 border-pink-500/20',       // 1 (merah muda)
        'bg-slate-500/15 text-slate-600 border-slate-500/20',    // 2 (abu-abu)
        'bg-blue-500/15 text-blue-600 border-blue-500/20',       // 3
        'bg-purple-500/15 text-purple-600 border-purple-500/20', // 4
        'bg-indigo-500/15 text-indigo-600 border-indigo-500/20', // 5
        'bg-teal-500/15 text-teal-600 border-teal-500/20',       // 6
        'bg-cyan-500/15 text-cyan-600 border-cyan-500/20',       // 7
        'bg-rose-500/15 text-rose-600 border-rose-500/20',       // 8
        'bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-500/20' // 9
      ];
      var rhkClass = rhkColors[angkaRHKNum % rhkColors.length];

      // RHK sebagai Subjudul (Lebih Kecil, Biru)
      var subtitleHTML = `<div class="text-[9px] text-on-surface-variant font-medium leading-tight mt-1 line-clamp-2" title="${r.JenisRHK || ''}">
              <span class="inline-flex items-center ${rhkClass} px-1 py-0.5 rounded border mr-1 font-bold">
                <span class="material-symbols-outlined text-[9px] mr-0.5">adjust</span>
                RHK-${angkaRHK}
              </span>
              ${r.JenisRHK || '-'}
            </div>`;
      
      var downloadBtn = `<button class="mt-1 w-[54px] mx-auto flex items-center justify-center gap-1 px-1 py-1 rounded text-[9px] font-bold bg-primary text-white hover:bg-primary/80 transition-colors shadow-sm" onclick="event.stopPropagation(); downloadPdf('${r.ReportId}')" title="Unduh Laporan PDF">
        <span class="material-symbols-outlined text-[12px]">download</span> Unduh
      </button>`;

      tableHtml += `
        <tr id="row-${r.ReportId}" class="rhk-row hover:bg-primary/10 transition-all duration-300 ease-in-out group cursor-pointer border-b border-surface-variant/50 relative" onclick="previewPdf('${r.ReportId}')">
          <td class="px-1 py-2 align-top text-center" style="min-width: 90px;" onclick="event.stopPropagation(); ${(Array.isArray(photos)&&photos.length>0) ? `showLightbox('https://drive.google.com/thumbnail?id=${photos[0]}&sz=w1200')` : ''}">
            ${photoHtml}
          </td>
          <td class="px-1.5 py-2 align-top whitespace-normal" style="min-width: 95px;">
            <div class="font-bold text-[10px] leading-tight text-on-surface">${formattedDate}</div>
            <div class="flex items-center gap-1 mt-1 flex-nowrap">
              <div class="text-[7px] text-primary font-bold bg-primary/10 inline-flex items-center gap-0.5 px-1 py-0.5 rounded" style="white-space: nowrap;">
                <span class="material-symbols-outlined text-[8px]">schedule</span>
                ${(r.Pukul || '').replace(/WIB/gi, '').trim()}
              </div>
              ${statusBadge}
            </div>
          </td>
          <td class="px-1.5 py-2 align-top">
            ${judulHTML}
            ${subtitleHTML}
          </td>
          <td class="px-1 py-2 align-top text-center" onclick="event.stopPropagation()">
            <div id="action-group-${r.ReportId}" class="action-group opacity-30 grayscale pointer-events-none transition-all duration-300">
              <div class="flex items-center justify-center gap-1 flex-nowrap">
                <button class="text-on-surface-variant hover:text-primary transition-colors p-1 rounded bg-surface border border-surface-variant hover:border-primary/50 shadow-sm" onclick="editReportDraft('${r.ReportId}')" title="Edit Narasi & Perbarui PDF">
                  <span class="material-symbols-outlined text-[14px]">edit</span>
                </button>
                <button class="text-on-surface-variant hover:text-error transition-colors p-1 rounded bg-surface border border-surface-variant hover:border-error/50 shadow-sm" onclick="deleteReportLog('${r.ReportId}')" title="Hapus Laporan">
                  <span class="material-symbols-outlined text-[14px]">delete</span>
                </button>
              </div>
              ${downloadBtn}
            </div>
          </td>
        </tr>
      `;
  });

  tableHtml += `
        </tbody>
      </table>
    </div>
  `;

  // Pagination UI Professional
  let startItem = totalItems === 0 ? 0 : startIndex + 1;
  let endItem = Math.min(endIndex, totalItems);
  
  let paginationHtml = `
    <div class="flex items-center justify-between px-4 py-3 border border-t-0 border-surface-variant bg-surface-bright rounded-b-xl shadow-sm">
      <div class="text-[11px] text-on-surface-variant font-medium">
        Menampilkan <span class="font-bold text-on-surface">${startItem} - ${endItem}</span> dari <span class="font-bold text-on-surface">${totalItems}</span>
      </div>
      <div class="flex items-center gap-1">
        <button onclick="changePage(1)" class="w-7 h-7 flex items-center justify-center rounded border border-surface-variant bg-surface text-on-surface-variant hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${state.currentReportPage === 1 ? 'disabled' : ''} title="Halaman Pertama">
          <span class="material-symbols-outlined text-[14px]">keyboard_double_arrow_left</span>
        </button>
        <button onclick="changePage(${state.currentReportPage - 1})" class="w-7 h-7 flex items-center justify-center rounded border border-surface-variant bg-surface text-on-surface-variant hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${state.currentReportPage === 1 ? 'disabled' : ''} title="Halaman Sebelumnya">
          <span class="material-symbols-outlined text-[14px]">chevron_left</span>
        </button>
        
        <div class="px-2 flex gap-1">
  `;
  
  // Logic untuk angka pagination
  let startPage = Math.max(1, state.currentReportPage - 2);
  let endPage = Math.min(totalPages, state.currentReportPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    if (i === state.currentReportPage) {
      paginationHtml += `<button class="w-7 h-7 flex items-center justify-center rounded bg-primary text-on-primary text-[11px] font-bold shadow-sm">${i}</button>`;
    } else {
      paginationHtml += `<button onclick="changePage(${i})" class="w-7 h-7 flex items-center justify-center rounded border border-surface-variant bg-surface text-on-surface-variant text-[11px] font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all">${i}</button>`;
    }
  }

  paginationHtml += `
        </div>
        
        <button onclick="changePage(${state.currentReportPage + 1})" class="w-7 h-7 flex items-center justify-center rounded border border-surface-variant bg-surface text-on-surface-variant hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${state.currentReportPage === totalPages || totalPages === 0 ? 'disabled' : ''} title="Halaman Selanjutnya">
          <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        </button>
        <button onclick="changePage(${totalPages})" class="w-7 h-7 flex items-center justify-center rounded border border-surface-variant bg-surface text-on-surface-variant hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${state.currentReportPage === totalPages || totalPages === 0 ? 'disabled' : ''} title="Halaman Terakhir">
          <span class="material-symbols-outlined text-[14px]">keyboard_double_arrow_right</span>
        </button>
      </div>
    </div>
  `;

  container.innerHTML = tableHtml + paginationHtml;

  // Auto-preview laporan pertama di tabel saat ini
  if (paginatedReports && paginatedReports.length > 0) {
    setTimeout(() => {
      previewPdf(paginatedReports[0].ReportId);
    }, 50);
  }

  // Sembunyikan pagination lama jika ada
  let paginationInfo = document.getElementById('pagination-info');
  if (paginationInfo) {
    paginationInfo.style.display = 'none';
  }
}

// Tambahkan fungsi ganti halaman ke global window
window.changePage = function(page) {
  state.currentReportPage = page;
  renderDashboardTable();
};

// FUNGSI PREVIEW PDF BARU
async function previewPdf(reportId) {
  // Panggil auto-refresh diam-diam setiap kali baris diklik untuk memastikan data terbaru (Real-time manual force)
  loadDashboardData(true);

  let report = state.reports.find(r => String(r.ReportId) === String(reportId));
  if (!report) {
    console.error('Report not found for ID:', reportId);
    return;
  }

  // Highlight baris yang aktif
  window.activeReportId = reportId;
  
  // Nonaktifkan semua action group
  document.querySelectorAll('.action-group').forEach(group => {
    group.classList.add('opacity-30', 'grayscale', 'pointer-events-none');
    group.classList.remove('opacity-100', 'grayscale-0', 'pointer-events-auto');
  });

  document.querySelectorAll('tr.rhk-row').forEach(row => {
    row.classList.remove('bg-primary/15', 'shadow-md', '-translate-y-0.5', 'z-10');
  });
  
  let activeRow = document.getElementById('row-' + reportId);
  if (activeRow) {
    activeRow.classList.add('bg-primary/15', 'shadow-md', '-translate-y-0.5', 'z-10');
  }
  
  // Aktifkan action group pada baris yang dipilih
  let activeActionGroup = document.getElementById('action-group-' + reportId);
  if (activeActionGroup) {
    activeActionGroup.classList.remove('opacity-30', 'grayscale', 'pointer-events-none');
    activeActionGroup.classList.add('opacity-100', 'grayscale-0', 'pointer-events-auto');
  }

  var pane = document.getElementById('pdf-preview-pane');
  var placeholder = document.getElementById('pdf-placeholder');
  var iframe = document.getElementById('pdf-frame');
  
  if (pane) pane.classList.remove('hidden');
  if (placeholder) placeholder.innerHTML = '<span class="material-symbols-outlined text-4xl text-primary animate-spin mb-3 block">progress_activity</span><p class="font-body-sm text-body-sm text-on-surface-variant">Menyusun pratinjau PDF...</p>';
  if (iframe) iframe.classList.add('hidden');

  try {
    if (report.PdfFileId && report.PdfFileId.length > 5) {
      // Jika file sudah ada di Google Drive, tampilkan dari sana!
      let driveUrl = `https://drive.google.com/file/d/${report.PdfFileId}/preview`;
      if (placeholder) placeholder.style.display = 'none';
      if (iframe) {
        iframe.src = driveUrl;
        iframe.classList.remove('hidden');
      }
    } else {
      // Generate DataURL dari awal (Fallback)
      const dataUrl = await generateClientPDF(report, state.user, false, 'dataUrl');
      
      hideLoading(); // Matikan loading utama
      
      if (placeholder) placeholder.style.display = 'none';
      if (iframe) {
        iframe.src = dataUrl;
        iframe.classList.remove('hidden');
      }
    }
  } catch (err) {
    hideLoading(); // Pastikan loading utama juga mati saat terjadi error
    if (placeholder) placeholder.innerHTML = '<span class="material-symbols-outlined text-4xl text-error mb-3 block">error</span><p class="font-body-sm text-body-sm text-error">Gagal memuat pratinjau PDF.</p>';
    console.error('Preview Error:', err);
  }
}

// FUNGSI UNDUH PDF KE KOMPUTER
async function downloadPdf(reportId) {
  let report = state.reports.find(r => String(r.ReportId) === String(reportId));
  if (!report) {
    console.error('Report not found for ID:', reportId);
    return;
  }

  try {
    if (report.PdfFileId && report.PdfFileId.length > 5) {
      showToast('Membuka tautan unduhan dari Google Drive...', 'info');
      window.open(`https://drive.google.com/uc?id=${report.PdfFileId}&export=download`, '_blank');
    } else {
      await generateClientPDF(report, state.user, false, 'download');
    }
  } catch (err) {
    hideLoading();
    showToast('Gagal mengunduh PDF.', 'error');
    console.error('Download Error:', err);
  }
}

// --- FUNGSI LIGHTBOX FOTO ---
window.showLightbox = function(url) {
  const modal = document.getElementById('lightbox-modal');
  const img = document.getElementById('lightbox-image');
  const loader = document.getElementById('lightbox-loading');
  const container = document.getElementById('lightbox-content-container');
  
  if (!modal || !img) return;
  
  img.classList.add('opacity-0');
  img.removeAttribute('src');
  loader.classList.remove('hidden');
  
  img.src = url;
  
  modal.classList.remove('hidden');
  void modal.offsetWidth; // trigger reflow untuk animasi
  modal.classList.remove('opacity-0');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
  
  window.addEventListener('keydown', handleLightboxEsc);
};

window.closeLightbox = function() {
  const modal = document.getElementById('lightbox-modal');
  const container = document.getElementById('lightbox-content-container');
  if (!modal) return;
  
  modal.classList.add('opacity-0');
  if (container) {
    container.classList.remove('scale-100');
    container.classList.add('scale-95');
  }
  
  setTimeout(() => {
    modal.classList.add('hidden');
    document.getElementById('lightbox-image').removeAttribute('src');
  }, 300);
  
  window.removeEventListener('keydown', handleLightboxEsc);
};

function handleLightboxEsc(e) {
  if (e.key === 'Escape') closeLightbox();
}

let searchTimeout = null;
function onSearchInput(event) {
  state.searchTerm = event.target.value;
  state.currentReportPage = 1;
  
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadDashboardData();
  }, 600); // Tunggu 600ms setelah selesai mengetik agar tidak membebani server
}

function onJenisRHKFilterChange() {
  var filterJenisSel = document.getElementById('filter-jenis-rhk');
  var filterRencanaSel = document.getElementById('filter-rencana-aksi');
  
  state.filterJenis = filterJenisSel.value;
  state.filterRencanaAksi = ''; // Reset
  
  if (filterRencanaSel) {
    filterRencanaSel.innerHTML = '<option value="">Semua Rencana Aksi</option>';
    
    if (state.filterJenis) {
      // Cari Rencana Aksi yang sesuai dengan Jenis RHK yang dipilih
      var matched = (state.rhkOptions || []).filter(o => o.id === state.filterJenis);
      matched.forEach(o => {
        filterRencanaSel.innerHTML += '<option value="' + escapeHtml(o.rencanaAksi) + '">' + escapeHtml(o.rencanaAksi) + '</option>';
      });
    }
  }
  
  state.currentReportPage = 1;
  loadDashboardData();
}

function onFilterChange(event) {
  if (event.target.id === 'filter-rencana-aksi') {
    state.filterRencanaAksi = event.target.value;
  } else if (event.target.id === 'filter-date') {
    state.filterDate = event.target.value;
  } else if (event.target.id === 'filter-month') {
    state.filterMonth = event.target.value;
  }
  state.currentReportPage = 1;
  loadDashboardData();
}

function resetFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-jenis-rhk').value = '';
  document.getElementById('filter-rencana-aksi').innerHTML = '<option value="">Semua Rencana Aksi</option>';
  document.getElementById('filter-date').value = '';
  document.getElementById('filter-date').type = 'text';
  if(document.getElementById('filter-month')) {
    document.getElementById('filter-month').value = '';
    document.getElementById('filter-month').type = 'text';
  }
  state.searchTerm = '';
  state.filterJenis = '';
  state.filterRencanaAksi = '';
  state.filterDate = '';
  state.filterMonth = '';
  state.currentReportPage = 1;
  loadDashboardData();
}

// ── RHK Form Page & Dynamic Sections ────────────────────────────
function onJenisRHKChange() {
  var sel = document.getElementById('select-jenis-rhk');
  var rs = document.getElementById('select-rencana-aksi');
  if (!sel || !rs) return;
  
  rs.innerHTML = '<option value="">— Pilih Rencana Aksi —</option>';
  var p2k2Fields = document.getElementById('p2k2-fields');
  var selectedId = sel.value; // Ini adalah RHK-1, RHK-2, dll
  
  if (!selectedId) {
    if (p2k2Fields) p2k2Fields.classList.add('hidden');
    return;
  }
  
  // Ambil opsi dari state.rhkOptions
  var matchedOptions = state.rhkOptions.filter(o => o.id === selectedId);
  matchedOptions.forEach(o => {
    rs.innerHTML += '<option value="' + escapeHtml(o.rencanaAksi) + '">' + escapeHtml(o.rencanaAksi) + '</option>';
  });
  
  // Jika ini adalah modul P2K2
  var isP2K2 = matchedOptions.some(o => o.isP2K2 || (o.jenisRhk && o.jenisRhk.toLowerCase().includes('p2k2')));
  if (isP2K2) {
    if (p2k2Fields) p2k2Fields.classList.remove('hidden');
    loadP2K2ModulOptions();
  } else {
    if (p2k2Fields) p2k2Fields.classList.add('hidden');
  }
}

function loadP2K2ModulOptions() {
  var mod = document.getElementById('input-p2k2-modul');
  if (!mod) return;
  mod.innerHTML = '<option value="">Memuat Modul...</option>';
  
  // Gunakan data master P2K2 yang sudah tersimpan di opsi p2k2ModulOptions atau ambil ulang jika kosong
  if (state.p2k2ModulOptions && state.p2k2ModulOptions.length > 0) {
    populateModul(state.p2k2ModulOptions);
  } else {
    // Simulasi atau fallback
    populateModul([]);
  }
  
  function populateModul(list) {
    mod.innerHTML = '<option value="">— Pilih Modul —</option>';
    let seen = {};
    list.forEach(o => {
      if (!seen[o.modul]) {
        seen[o.modul] = true;
        mod.innerHTML += '<option value="' + escapeHtml(o.modul) + '">' + escapeHtml(o.modul) + '</option>';
      }
    });
  }
}

function onModulChange() {
  var mod = document.getElementById('input-p2k2-modul').value;
  var ses = document.getElementById('input-p2k2-sesi');
  if (!ses) return;
  ses.innerHTML = '<option value="">— Pilih Sesi —</option>';
  
  if (!mod) return;
  
  // Saring opsi dari state lokal
  var list = (state.p2k2ModulOptions || []).filter(o => o.modul === mod);
  list.forEach(o => {
    ses.innerHTML += '<option value="' + escapeHtml(o.sesi) + '">' + escapeHtml(o.sesi) + '</option>';
  });
}

// ── Voice Input (Web Speech API) ────────────────────────────────
function toggleVoiceInput() {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Browser Anda tidak mendukung Web Speech API.', 'error');
    return;
  }
  
  var voiceBtn = document.getElementById('btn-voice');
  var voiceIcon = document.getElementById('voice-icon');
  var voiceText = document.getElementById('voice-text');
  var voiceStatus = document.getElementById('voice-status');
  
  if (state.isRecording) {
    stopRecording();
  } else {
    state.isRecording = true;
    voiceBtn.classList.add('bg-error', 'text-white', 'pulse-recording');
    voiceIcon.textContent = 'stop';
    voiceText.textContent = 'Selesai';
    voiceStatus.textContent = 'Mendengarkan... Silakan bicara dalam Bahasa Indonesia.';
    
    state.recognition = new SpeechRecognition();
    state.recognition.lang = 'id-ID';
    state.recognition.continuous = true;
    state.recognition.interimResults = false;
    
    state.recognition.onresult = function(event) {
      var resultText = event.results[event.results.length - 1][0].transcript;
      var textarea = document.getElementById('input-poin');
      var oldVal = textarea.value.trim();
      textarea.value = oldVal ? oldVal + '; ' + resultText : resultText;
    };
    
    state.recognition.onerror = function(err) {
      showToast('Error pengenalan suara: ' + err.error, 'error');
      stopRecording();
    };
    
    state.recognition.onend = function() {
      if (state.isRecording) {
        try { state.recognition.start(); } catch(e) {}
      } else {
        stopRecording();
      }
    };
    
    state.recognition.start();
  }
}

function stopRecording() {
  if (!state.isRecording) return;
  state.isRecording = false;
  
  var voiceBtn = document.getElementById('btn-voice');
  var voiceIcon = document.getElementById('voice-icon');
  var voiceText = document.getElementById('voice-text');
  var voiceStatus = document.getElementById('voice-status');
  
  if (voiceBtn) {
    voiceBtn.classList.remove('bg-error', 'text-white', 'pulse-recording');
  }
  if (voiceIcon) voiceIcon.textContent = 'mic';
  if (voiceText) voiceText.textContent = 'Dikte Suara';
  if (voiceStatus) voiceStatus.textContent = 'Dikte selesai.';
  
  if (state.recognition) {
    try { state.recognition.stop(); } catch(e) {}
    state.recognition = null;
  }
}

// ── Photo Upload Handlers ──────────────────────────────────────
function handleFileUpload(event) {
  var files = event.target.files;
  if (!files || files.length === 0) return;
  
  if (state.selectedPhotos.length + files.length > 5) {
    showToast('Maksimum unggah 5 foto kegiatan.', 'error');
    return;
  }
  
  showLoading('Membaca foto...');
  var loadedCount = 0;
  
  for (var i = 0; i < files.length; i++) {
    (function(file) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var base64 = e.target.result;
        state.selectedPhotos.push({
          name: file.name,
          base64: base64
        });
        
        loadedCount++;
        if (loadedCount === files.length) {
          hideLoading();
          renderPhotoPreviews();
        }
      };
      reader.readAsDataURL(file);
    })(files[i]);
  }
}

function renderPhotoPreviews() {
  var container = document.getElementById('photo-previews');
  container.innerHTML = '';
  
  state.selectedPhotos.forEach(function(p, idx) {
    var div = document.createElement('div');
    div.className = 'photo-preview-item relative group w-20 h-20 rounded border border-outline-variant overflow-hidden';
    div.innerHTML = `
      <img src="${p.base64}" alt="Preview" class="w-full h-full object-cover">
      <button class="remove-photo absolute top-1 right-1 bg-error text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onclick="removePhoto(${idx})">✕</button>
    `;
    container.appendChild(div);
  });
}

function removePhoto(index) {
  state.selectedPhotos.splice(index, 1);
  renderPhotoPreviews();
}

// ── Submit RHK Laporan ──────────────────────────────────────────
async function submitForm() {
  var jenisRhkId = document.getElementById('select-jenis-rhk').value;
  var rencanaAksi = document.getElementById('select-rencana-aksi').value;
  var tanggal = document.getElementById('input-tanggal').value;
  var lokasi = document.getElementById('input-lokasi').value;
  var poin = document.getElementById('input-poin').value;
  
  if (!jenisRhkId || !rencanaAksi || !tanggal || !lokasi || !poin) {
    showToast('Mohon lengkapi semua field yang berbintang wajib (*)', 'error');
    return;
  }
  
  var payload = {
    reportId: state.currentReportId,
    jenisRhkId: jenisRhkId,
    rencanaAksi: rencanaAksi,
    tanggal: tanggal,
    lokasi: lokasi,
    poin: poin,
    photos: state.selectedPhotos
  };
  
  // Add P2K2 data if visible
  var p2k2Sec = document.getElementById('p2k2-section');
  if (p2k2Sec && !p2k2Sec.classList.contains('hidden')) {
    var modulId = document.getElementById('select-modul').value;
    var sesiId = document.getElementById('select-sesi').value;
    var jumlahKpm = document.getElementById('input-jumlah-kpm').value;
    var jumlahHadir = document.getElementById('input-jumlah-hadir').value;
    var namaKelompok = document.getElementById('input-nama-kelompok').value;
    var ketuaKelompok = document.getElementById('input-ketua-kelompok').value;
    
    if (!modulId || !sesiId) {
      showToast('Mohon lengkapi data Modul & Sesi P2K2.', 'error');
      return;
    }
    
    payload.p2k2 = {
      modulId: modulId,
      sesiId: sesiId,
      jumlahKpm: jumlahKpm,
      jumlahHadir: jumlahHadir,
      namaKelompok: namaKelompok,
      ketuaKelompok: ketuaKelompok
    };
  }
  
  showLoading('Mengunggah foto dan menyimpan draf laporan...');
  
  try {
    let ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) throw new Error("ID Spreadsheet tidak ditemukan. Coba refresh halaman.");
    
    // Panggil fungsi GAPI Client-side
    const result = await submitReportDataClient(ssId, state.clientEmail, payload);
    
    state.currentReportId = result.reportId;
    
    // Setelah sukses menyimpan data murni, baru susun narasi AI
    generateNarrativeText();
  } catch (err) {
    hideLoading();
    showToast('Gagal menyimpan laporan: ' + err.message, 'error');
  }
}

async function generateNarrativeText() {
  try {
    let ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) throw new Error("Spreadsheet ID belum siap.");
    
    const narasi = await generateNarrativeClient(ssId, state.currentReportId);
    
    hideLoading();
    document.getElementById('textarea-narasi').value = narasi;
    navigateTo('preview');
  } catch(err) {
    hideLoading();
    showToast('Gagal men-generate narasi AI: ' + err.message, 'error');
    navigateTo('dashboard');
  }
}

function regenerateNarrative() {
  showLoading('Menyusun ulang narasi...');
  generateNarrativeText();
}

async function saveAndRegeneratePDF() {
  var narrativeText = document.getElementById('textarea-edit-narasi').value;
  if (!narrativeText) {
    showToast('Teks narasi tidak boleh kosong!', 'error');
    return;
  }
  
  // Ambil Data Utama Baru
  var editTanggal = '';
  if (document.getElementById('edit-tanggal')) editTanggal = document.getElementById('edit-tanggal').value;
  var editWaktu = '';
  if (document.getElementById('edit-waktu')) editWaktu = document.getElementById('edit-waktu').value;
  
  showLoading('Menyiapkan pembaruan data...');
  
  try {
    let ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) throw new Error("Spreadsheet ID belum siap.");
    
    // Ambil report dari memori lokal
    let report = state.reports.find(r => String(r.ReportId) === String(state.currentReportId));
    if (!report) throw new Error("Data laporan menghilang dari memori.");
    
    let finalFotoIds = [];
    let hasChangesInPhotos = false;
    
    if (window.editModalPhotos) {
      for (let i = 0; i < window.editModalPhotos.length; i++) {
        let photo = window.editModalPhotos[i];
        if (photo.type === 'base64') {
          showLoading(`Mengunggah Foto Baru (${i+1}/${window.editModalPhotos.length})...`);
          let uploadedId = await uploadImageToDriveClient(photo.data, 'Foto_' + report.ReportId + '_Edit_' + i + '.jpg');
          if (uploadedId) {
            finalFotoIds.push(uploadedId);
            hasChangesInPhotos = true;
          }
        } else {
          finalFotoIds.push(photo.data);
        }
      }
    }
    
    let originalPhotosStr = JSON.stringify(report.FotoIds || []);
    let finalPhotosStr = JSON.stringify(finalFotoIds);
    if (originalPhotosStr !== finalPhotosStr) {
      hasChangesInPhotos = true;
    }
    
    showLoading('Menyimpan Perubahan ke Google Sheets...');
    
    let newData = {
      tanggal: editTanggal,
      pukul: editWaktu,
      narasiEdited: narrativeText,
      fotoIds: hasChangesInPhotos ? finalFotoIds : null
    };
    
    // 1. Simpan ke Google Sheet
    await saveEditedReportClient(ssId, state.currentReportId, newData);
    
    // Perbarui data secara lokal agar PDF engine memakai teks baru
    if (editTanggal) report.Tanggal = editTanggal;
    if (editWaktu) report.Pukul = editWaktu;
    report.NarasiEdited = narrativeText;
    if (hasChangesInPhotos) report.FotoIds = finalFotoIds;
    report.Status = 'Selesai';
    
    // 2. Rakit PDF dalam bentuk Blob rahasia
    if (!report.PdfFileId || report.PdfFileId.length < 5) {
        throw new Error("Laporan ini belum memiliki file PDF asli di Google Drive untuk ditimpa. Buat PDF dari HP terlebih dahulu.");
    }
    
    showLoading('Mencetak ulang PDF & Mengunggah ke Google Drive...');
    const pdfBlob = await generateClientPDF(report, state.user, false, 'blob');
    
    // 3. Timpa PDF lama di Google Drive
    await updatePdfInDrive(report.PdfFileId, pdfBlob);
    
    hideLoading();
    closeModal('modal-edit-narasi');
    showToast('Sukses! Data laporan tersimpan dan file PDF asli di Drive telah diperbarui.', 'success');
    
    // 4. Perbarui pratinjau dan tabel secara instan
    renderDashboardTable();
    previewPdf(state.currentReportId);
    
    // Refresh halaman paksa agar Google Drive Cache hilang (atas permintaan user)
    setTimeout(() => {
        window.location.reload();
    }, 1500);
    
  } catch(err) {
    hideLoading();
    console.error('Error saat Simpan & Perbarui PDF:', err);
    let errorMsg = err.message || 'Error tidak diketahui';
    if (err && err.result && err.result.error) {
      errorMsg = err.result.error.message;
    }
    showToast('Gagal memproses pembaruan: ' + errorMsg, 'error');
  }
}

function editReportDraft(reportId) {
  // Hanya ambil laporan dari memori lokal (tanpa loading panjang)
  let r = state.reports.find(rep  => String(rep.ReportId) === String(reportId));
  
  if (!r) {
    showToast('Laporan tidak ditemukan di memori.', 'error');
    return;
  }
  
  state.currentReportId = r.ReportId;
  
  // Prioritaskan Narasi yang sudah diedit. Jika belum pernah diedit, pakai Narasi AI. Jika kosong, pakai Uraian.
  let text = r.NarasiEdited || r.NarasiAI || r.Uraian || '';
  
  // Masukkan teks ke dalam textarea modal yang baru kita buat
  let textarea = document.getElementById('textarea-edit-narasi');
  if (textarea) {
    textarea.value = text;
  }
  
  // Populate Data Utama (Baru)
  if (window.editTanggalPicker && r.Tanggal) {
    let d = new Date(r.Tanggal);
    if (!isNaN(d.getTime())) {
      let month = (d.getMonth() + 1).toString().padStart(2, '0');
      let day = d.getDate().toString().padStart(2, '0');
      window.editTanggalPicker.setDate(`${d.getFullYear()}-${month}-${day}`);
    } else {
      window.editTanggalPicker.clear();
    }
  } else if (document.getElementById('edit-tanggal')) {
    // Fallback
    let d = new Date(r.Tanggal);
    if (!isNaN(d.getTime())) {
      let month = (d.getMonth() + 1).toString().padStart(2, '0');
      let day = d.getDate().toString().padStart(2, '0');
      document.getElementById('edit-tanggal').value = `${d.getFullYear()}-${month}-${day}`;
    } else {
      document.getElementById('edit-tanggal').value = '';
    }
  }
  
  if (window.editWaktuPicker) {
    if (r.Pukul) {
      window.editWaktuPicker.setDate(r.Pukul);
    } else {
      window.editWaktuPicker.clear();
    }
  } else if (document.getElementById('edit-waktu')) {
    document.getElementById('edit-waktu').value = r.Pukul || '';
  }
  

  
  // Clear image upload field
  if (document.getElementById('edit-foto')) document.getElementById('edit-foto').value = '';
  
  // Initialize multiple photos array
  window.editModalPhotos = [];
  let photos = r.FotoIds;
  if (typeof photos === 'string') {
    try { photos = JSON.parse(photos); } catch(e) { photos = [photos]; }
  }
  if (Array.isArray(photos)) {
    photos.forEach(p => {
      if (p && p.length > 5) {
        window.editModalPhotos.push({
          type: 'id',
          data: p
        });
      }
    });
  }
  renderEditPhotos();
  
  // Remove old temp photo state
  window.editModalTempPhoto = null;
  
  // Buka jendela popup baru
  openModal('modal-edit-narasi');
}

function deleteReportLog(reportId) {
  state.deleteTarget = { type: 'report', id: reportId };
  openModal('modal-delete');
}

function reprintPdf(reportId) {
  let report = state.reports.find(r  => String(r.ReportId) === String(reportId));
  if (!report) {
    showToast('Laporan tidak ditemukan.', 'error');
    return;
  }
  
  // IKLAN MOCK
  let pdfCount = parseInt(localStorage.getItem('aspend_pdf_count') || '0');
  pdfCount++;
  localStorage.setItem('aspend_pdf_count', pdfCount);
  
  let isPremium = localStorage.getItem('aspend_is_premium') === 'true';
  if (!isPremium && pdfCount % 5 === 0) {
    showAdModal(() => {
      generateClientPDF(report, state.user);
    });
  } else {
    generateClientPDF(report, state.user);
  }
}


function handleSiksUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  document.getElementById('siks-filename').textContent = file.name;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    state.siksPhotoBase64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Detect Location
function detectGPSLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation tidak didukung oleh browser Anda.', 'error');
    return;
  }
  
  showLoading('Mendeteksi koordinat GPS...');
  navigator.geolocation.getCurrentPosition(
    function(position) {
      hideLoading();
      document.getElementById('input-adu-lat').value = position.coords.latitude;
      document.getElementById('input-adu-lng').value = position.coords.longitude;
      showToast('GPS terdeteksi akurat.', 'success');
    },
    function(err) {
      hideLoading();
      showToast('Gagal mendeteksi lokasi GPS: ' + err.message, 'error');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function saveComplaint() {
  var nik = document.getElementById('input-adu-nik').value.trim();
  var nama = document.getElementById('input-adu-nama').value.trim();
  var alamat = document.getElementById('input-adu-alamat').value.trim();
  var desa = document.getElementById('input-adu-desa').value.trim();
  var kec = document.getElementById('input-adu-kecamatan').value.trim();
  var kab = document.getElementById('input-adu-kabkota').value.trim();
  var aduan = document.getElementById('input-adu-isi').value.trim();
  var lat = parseFloat(document.getElementById('input-adu-lat').value) || 0;
  var lng = parseFloat(document.getElementById('input-adu-lng').value) || 0;
  var analisa = document.getElementById('input-adu-analisa').value.trim();
  
  if (!nik || !nama || !alamat || !desa || !kec || !kab || !aduan) {
    showToast('Mohon isi semua bidang formulir yang diwajibkan.', 'error');
    return;
  }
  
  var btn = document.getElementById('btn-save-aduan');
  var originalHtml = btn.innerHTML;
  btn.innerHTML = '<span>Menyimpan...</span><div class="spinner"></div>';
  btn.disabled = true;
  
  var dataObj = {
    nik: nik, nama: nama, alamat: alamat, desa: desa, kec: kec, kab: kab,
    aduan: aduan, lat: lat, lng: lng, analisa: analisa
  };
  
  saveComplaintClient(dataObj)
    .then(function(res) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      showToast('Aduan berhasil disimpan!', 'success');
      document.getElementById('form-aduan').reset();
      state.ktpPhotoBase64 = '';
      loadComplaintsData();
      
      // Jika ingin print otomatis
      // state.selectedCSVRows = [dataObj];
      // generateVerkomPDF();
    })
    .catch(function(err) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      showToast('Gagal menyimpan: ' + err, 'error');
    });
}

function deleteComplaintLog(id) {
  state.deleteTarget = { type: 'complaint', id: id };
  openModal('modal-delete');
}

// ==============================================================
// ── MODULE: VERKOM Tools ──────────────────────────────────────
// ==============================================================
function handleCSVUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  document.getElementById('csv-filename').textContent = file.name;
  state.selectedCSVFileName = file.name;
  
  showLoading('Membaca file CSV...');
  
  var reader = new FileReader();
  reader.onload = function(e) {
    hideLoading();
    var text = e.target.result;
    var rows = parseCSV(text);
    
    if (rows.length === 0) {
      showToast('File CSV kosong atau tidak valid.', 'error');
      return;
    }
    
    state.selectedCSVRows = rows;
    renderCSVPreview();
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  var lines = text.split(/\r\n|\n/);
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    
    // Quick parse CSV supporting commas inside quotes
    var row = [];
    var inQuotes = false;
    var col = '';
    for (var j = 0; j < line.length; j++) {
      var c = line[j];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        row.push(col.trim().replace(/^"|"$/g, ''));
        col = '';
      } else {
        col += c;
      }
    }
    row.push(col.trim().replace(/^"|"$/g, ''));
    result.push(row);
  }
  return result;
}

function renderCSVPreview() {
  var card = document.getElementById('verkom-preview-card');
  var table = document.getElementById('verkom-preview-table');
  var countInfo = document.getElementById('verkom-row-count');
  
  card.classList.remove('hidden');
  table.innerHTML = '';
  
  var maxPreviewRows = 10;
  countInfo.textContent = `Menampilkan 10 baris pertama dari total ${state.selectedCSVRows.length} baris data CSV.`;
  
  // Render headers (row 0)
  var headers = state.selectedCSVRows[0] || [];
  var thead = document.createElement('thead');
  var headerTr = document.createElement('tr');
  headerTr.className = 'bg-surface-container-low border-b border-surface-variant font-label-md text-xs text-on-surface-variant uppercase';
  
  headers.forEach(function(h) {
    var th = document.createElement('th');
    th.className = 'p-3 font-medium';
    th.textContent = escapeHtml(h);
    headerTr.appendChild(th);
  });
  thead.appendChild(headerTr);
  table.appendChild(thead);
  
  // Render preview rows
  var tbody = document.createElement('tbody');
  tbody.className = 'font-body-md text-xs text-on-surface divide-y divide-surface-variant';
  
  var limit = Math.min(state.selectedCSVRows.length, maxPreviewRows + 1);
  for (var r = 1; r < limit; r++) {
    var tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low';
    
    var cols = state.selectedCSVRows[r];
    for (var c = 0; c < headers.length; c++) {
      var td = document.createElement('td');
      td.className = 'p-3';
      td.textContent = cols[c] !== undefined ? escapeHtml(cols[c]) : '';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
}

function generateVerkomPDF() {
  showToast('Sistem PDFMake untuk Verkom sedang dalam tahap perakitan.', 'info');
  // Nantinya di sini kita panggil pembuat template PDFMake
  // pdfMake.createPdf(docDefinition).download('Verkom.pdf');
}

// ==============================================================
// ── MODULE: Nota Dinas ────────────────────────────────────────
// ==============================================================
function loadNotaDinasData() {
  var listContainer = document.getElementById('nd-list-container');
  if (listContainer) {
    listContainer.innerHTML = '<div class="text-center p-8 text-on-surface-variant">Memuat Nota Dinas...</div>';
  }
  
  fetchNotaDinasDataClient()
    .then(data => {
      state.notaDinasList = data;
      renderNotaDinasTable();
    })
    .catch(err => {
      if (listContainer) {
        listContainer.innerHTML = '<div class="text-center p-8 text-error">Gagal memuat Nota Dinas.</div>';
      }
    });
}

function renderNotaDinasList() {
  var grid = document.getElementById('nota-dinas-grid');
  var emptyState = document.getElementById('nota-dinas-empty-state');
  grid.innerHTML = '';
  
  if (state.notaDinasList.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  
  state.notaDinasList.forEach(function(n) {
    var dateText = n.Tanggal || '—';
    var viewBtn = n.PdfFileId ? 
      `<button class="text-on-surface-variant hover:text-primary transition-colors p-1" onclick="viewPdfFile('${n.PdfFileId}')" title="Buka PDF"><span class="material-symbols-outlined text-[20px]">visibility</span></button>` : '';
      
    var div = document.createElement('div');
    div.className = 'bg-white rounded-xl shadow-sm border border-surface-variant p-5 flex flex-col justify-between';
    div.innerHTML = `
      <div>
        <div class="flex justify-between items-start mb-3">
          <div>
            <h4 class="font-bold text-primary text-sm">${escapeHtml(n.Nomor)}</h4>
            <p class="text-xs text-on-surface-variant font-medium">Sifat: ${escapeHtml(n.Sifat)}</p>
          </div>
        </div>
        <p class="text-xs text-on-surface font-semibold mb-1">Hal: ${escapeHtml(n.Hal)}</p>
        <p class="text-[10px] text-on-surface-variant italic mb-2">Kepada: ${escapeHtml(n.Yth)}</p>
      </div>
      <div class="border-t border-surface-variant pt-3 flex justify-between items-center mt-3">
        <span class="text-[10px] text-on-surface-variant">${dateText}</span>
        <div class="flex gap-2">
          ${viewBtn}
          <button class="text-error hover:text-error/80 transition-colors p-1" onclick="deleteNotaDinasLog('${n.Id}')" title="Hapus"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </div>
      </div>
    `;
    grid.appendChild(div);
  });
}

function openFormNotaDinas() {
  document.getElementById('input-nd-nomor').value = '';
  document.getElementById('input-nd-yth').value = '';
  document.getElementById('input-nd-dari').value = '';
  document.getElementById('input-nd-hal').value = '';
  document.getElementById('input-nd-lampiran').value = '1 berkas';
  document.getElementById('input-nd-sifat').value = 'Biasa';
  document.getElementById('input-nd-tanggal').value = formatDateIndo(new Date());
  document.getElementById('input-nd-poin').value = '';
  document.getElementById('nd-photo-filename').textContent = 'Belum ada foto';
  
  state.ndPhotoBase64 = '';
  
  navigateTo('form-nota-dinas');
}

function handleNDPhotoUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  document.getElementById('nd-photo-filename').textContent = file.name;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    state.ndPhotoBase64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

function generateMemoAI() {
  var hal = document.getElementById('input-nd-hal').value.trim();
  if (!hal) {
    showToast('Isi kolom "Hal" terlebih dahulu agar AI tahu konteksnya.', 'error');
    return;
  }
  
  var btn = document.getElementById('btn-generate-memo');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div><span>AI Berpikir...</span>';
  
  // Simulasi / Implementasi OpenRouter lokal
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">smart_toy</span><span>Buat Draf AI</span>';
    var draf = "Merujuk pada " + hal + ", bersama ini kami sampaikan bahwa...\n\nDemikian disampaikan untuk menjadi maklum.";
    document.getElementById('input-nd-isi').value = draf;
    showToast('Draf AI berhasil dibuat!', 'success');
  }, 1500);
}

function regenerateMemoAI() {
  generateMemoAI();
}

function saveAndGenerateNDPdf() {
  var tanggal = document.getElementById('input-nd-tanggal').value;
  var nomor = document.getElementById('input-nd-nomor').value.trim();
  var kepada = document.getElementById('input-nd-kepada').value.trim();
  var dari = document.getElementById('input-nd-dari').value.trim();
  var hal = document.getElementById('input-nd-hal').value.trim();
  var isi = document.getElementById('input-nd-isi').value.trim();
  
  if (!tanggal || !kepada || !dari || !hal || !isi) {
    showToast('Harap lengkapi semua isian Nota Dinas.', 'error');
    return;
  }
  
  var btn = document.getElementById('btn-save-nd');
  var originalHtml = btn.innerHTML;
  btn.innerHTML = '<span>Memproses...</span><div class="spinner"></div>';
  btn.disabled = true;
  
  var payload = {
    tanggal: tanggal,
    nomor: nomor,
    kepada: kepada,
    dari: dari,
    hal: hal,
    isi: isi
  };
  
  saveNotaDinasClient(payload)
    .then(res => {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      showToast('Nota Dinas berhasil disimpan ke dalam Log!', 'success');
      document.getElementById('form-nd').reset();
      state.ndPhotoBase64 = '';
      loadNotaDinasData();
      
      showToast('Sistem Cetak PDF Nota Dinas akan menggunakan PDFMake di tahap berikutnya.', 'info');
    })
    .catch(err => {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      showToast('Gagal menyimpan Nota Dinas: ' + err, 'error');
    });
}

function deleteNotaDinasLog(id) {
  state.deleteTarget = { type: 'nota-dinas', id: id };
  openModal('modal-delete');
}

// ==============================================================
// ── MODULE: Pengaturan & AI ───────────────────────────────────
// ==============================================================
function loadProfileSettings() {
  document.getElementById('input-email').value = state.user.email || '';
  var infoEmail = document.getElementById('info-email');
  if(infoEmail) infoEmail.textContent = state.user.email || 'Belum login';
  
  document.getElementById('input-nama').value = state.user.nama || '';
  document.getElementById('input-nip').value = state.user.nip || '';
  document.getElementById('input-jabatan').value = state.user.jabatan || '';
  document.getElementById('input-kabupaten').value = state.user.kabupaten || '';
  
  var initials = getInitials(state.user.nama || state.user.email || '');
  document.getElementById('profile-initials').textContent = initials;
  
  if (state.user.picture) {
    document.getElementById('profile-photo-preview').innerHTML = `<img src="${state.user.picture}" class="w-full h-full object-cover">`;
  }
  
  const signatureBase64 = localStorage.getItem('aspend_signature_base64');
  if (signatureBase64) {
    document.getElementById('signature-preview').innerHTML = `<img src="${signatureBase64}" class="max-w-full max-h-full object-contain">`;
  }
  
  // AI Settings
  let savedModel = localStorage.getItem('aspend_ai_model') || 'google/gemini-flash-1.5';
  let modelSelect = document.getElementById('select-ai-provider');
  if(modelSelect) modelSelect.value = savedModel;
  
  // Premium Status
  let isPremium = localStorage.getItem('aspend_is_premium') === 'true';
  let premToggle = document.getElementById('toggle-premium');
  if(premToggle) {
    premToggle.checked = isPremium;
    togglePremiumStatus({target: {checked: isPremium}});
  }
}

function handleProfilePhotoUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result;
    localStorage.setItem('aspend_profile_photo', base64);
    
    // Perbarui pratinjau di Pengaturan
    var preview = document.getElementById('profile-photo-preview');
    if (preview) {
      preview.innerHTML = '<img src="' + base64 + '" class="w-full h-full object-cover">';
    }
    
    // Perbarui foto di Sidebar (Dashboard)
    var avatarContainer = document.getElementById('sidebar-avatar-container');
    if (avatarContainer) {
      avatarContainer.innerHTML = '<img src="' + base64 + '" class="w-full h-full object-cover">';
    }
    state.user.picture = base64;
    
    showToast('Foto profil berhasil disimpan secara lokal.', 'success');
  };
  reader.readAsDataURL(file);
}

function handleSignatureUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result;
    localStorage.setItem('aspend_signature_base64', base64);
    
    var preview = document.getElementById('signature-preview');
    if (preview) {
      preview.innerHTML = '<img src="' + base64 + '" class="max-w-full max-h-full object-contain">';
    }
    
    showToast('Tanda tangan berhasil disimpan secara lokal.', 'success');
  };
  reader.readAsDataURL(file);
}


function saveSettings() {
  var prov = document.getElementById('select-ai-provider').value;
  var model = document.getElementById('input-ai-model').value.trim();
  var openrouter = document.getElementById('input-key-openrouter').value.trim();
  var google = document.getElementById('input-key-google').value.trim();
  var groq = document.getElementById('input-key-groq').value.trim();
  
  var nama = document.getElementById('input-nama').value.trim();
  var nip = document.getElementById('input-nip').value.trim();
  var jabatan = document.getElementById('input-jabatan').value.trim();
  var kabupaten = document.getElementById('input-kabupaten').value.trim();
  
  state.user.nama = nama;
  state.user.nip = nip;
  state.user.jabatan = jabatan;
  state.user.kabupaten = kabupaten;
  
  state.aiProvider = prov;
  state.aiModel = model;
  state.aiKeys.openrouter = openrouter;
  state.aiKeys.google = google;
  state.aiKeys.groq = groq;
  
  // Karena ini client-side, simpan saja langsung di localStorage!
  localStorage.setItem('aspend_nama', nama);
  localStorage.setItem('aspend_nip', nip);
  localStorage.setItem('aspend_jabatan', jabatan);
  localStorage.setItem('aspend_kabupaten', kabupaten);
  
  localStorage.setItem('aspend_aiProvider', prov);
  localStorage.setItem('aspend_aiModel', model);
  localStorage.setItem('aspend_aiKeys', JSON.stringify(state.aiKeys));
  
  showToast('Pengaturan lokal berhasil disimpan.', 'success');
}

// ==============================================================
// ── MODULE: Panel Admin ───────────────────────────────────────
// ==============================================================
function loadAdminData() {
  var rhkList = document.getElementById('admin-rhk-list');
  var p2k2List = document.getElementById('admin-p2k2-list');
  
  if (rhkList) rhkList.innerHTML = '<div class="text-center p-4">Memuat data RHK...</div>';
  if (p2k2List) p2k2List.innerHTML = '<div class="text-center p-4">Memuat data P2K2...</div>';
  
  fetchAdminDataClient()
    .then(data => {
      // Simpan juga ke state untuk dropdown
      state.rhkOptions = data.rhk.map(r => ({id: r.id, jenisRhk: r.jenis, rencanaAksi: r.rencana}));
      state.p2k2ModulOptions = data.p2k2.map(p => ({modul: p.modul, sesi: p.sesi}));
      
      renderAdminList('rhk', data.rhk, rhkList);
      renderAdminList('p2k2', data.p2k2, p2k2List);
    })
    .catch(err => {
      if (rhkList) rhkList.innerHTML = '<div class="text-error p-4">Gagal memuat RHK.</div>';
      if (p2k2List) p2k2List.innerHTML = '<div class="text-error p-4">Gagal memuat P2K2.</div>';
    });
}

function switchAdminTab(tab) {
  document.getElementById('tab-btn-rhk').className = tab === 'rhk' ?
    'py-3 px-6 border-b-2 border-primary font-bold text-primary text-sm focus:outline-none cursor-pointer' :
    'py-3 px-6 border-b-2 border-transparent font-medium text-on-surface-variant hover:text-primary text-sm focus:outline-none cursor-pointer';
    
  document.getElementById('tab-btn-p2k2').className = tab === 'p2k2' ?
    'py-3 px-6 border-b-2 border-primary font-bold text-primary text-sm focus:outline-none cursor-pointer' :
    'py-3 px-6 border-b-2 border-transparent font-medium text-on-surface-variant hover:text-primary text-sm focus:outline-none cursor-pointer';
    
  document.getElementById('tab-content-rhk');
  
  if (tab === 'rhk') {
    document.getElementById('tab-rhk').classList.remove('hidden');
    document.getElementById('tab-p2k2').classList.add('hidden');
  } else {
    document.getElementById('tab-rhk').classList.add('hidden');
    document.getElementById('tab-p2k2').classList.remove('hidden');
  }
}

function showAddModal(type) {
  state.editingMasterType = type;
  state.editingRowIndex = null;
  
  var title = document.getElementById('modal-admin-title');
  var body = document.getElementById('modal-admin-body');
  
  if (type === 'rhk') {
    title.textContent = 'Tambah Data RHK';
    body.innerHTML = `
      <div class="flex flex-col gap-2">
        <label class="text-xs font-bold text-on-surface-variant">ID (Format: RHK-X)</label>
        <input class="w-full rounded-lg border border-outline-variant py-2 px-3 outline-none" type="text" id="modal-input-id" placeholder="RHK-10">
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-xs font-bold text-on-surface-variant">Jenis RHK</label>
        <input class="w-full rounded-lg border border-outline-variant py-2 px-3 outline-none" type="text" id="modal-input-jenis" placeholder="Deskripsi Jenis RHK...">
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-xs font-bold text-on-surface-variant">Rencana Aksi</label>
        <input class="w-full rounded-lg border border-outline-variant py-2 px-3 outline-none" type="text" id="modal-input-aksi" placeholder="Rencana Aksi detail...">
      </div>
    `;
  } else {
    title.textContent = 'Tambah Data P2K2';
    body.innerHTML = `
      <div class="flex flex-col gap-2">
        <label class="text-xs font-bold text-on-surface-variant">ID (Format: p2k2XX)</label>
        <input class="w-full rounded-lg border border-outline-variant py-2 px-3 outline-none" type="text" id="modal-input-id" placeholder="p2k230">
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-xs font-bold text-on-surface-variant">Modul</label>
        <input class="w-full rounded-lg border border-outline-variant py-2 px-3 outline-none" type="text" id="modal-input-jenis" placeholder="MODUL 1: ...">
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-xs font-bold text-on-surface-variant">Sesi</label>
        <input class="w-full rounded-lg border border-outline-variant py-2 px-3 outline-none" type="text" id="modal-input-aksi" placeholder="Sesi X: ...">
      </div>
    `;
  }
  
  openModal('modal-admin');
}

function editAdminRow(type, rowIndex, id, field1, field2) {
  state.editingMasterType = type;
  state.editingRowIndex = rowIndex;
  
  var title = document.getElementById('modal-admin-title');
  var body = document.getElementById('modal-admin-body');
  
  title.textContent = type === 'rhk' ? 'Edit Data RHK' : 'Edit Data P2K2';
  
  var field1Label = type === 'rhk' ? 'Jenis RHK' : 'Modul';
  var field2Label = type === 'rhk' ? 'Rencana Aksi' : 'Sesi';
  
  body.innerHTML = `
    <div class="flex flex-col gap-2">
      <label class="text-xs font-bold text-on-surface-variant">ID (Read-only)</label>
      <input class="w-full bg-surface-container text-on-surface-variant border border-outline-variant py-2 px-3 rounded-lg outline-none" type="text" id="modal-input-id" value="${escapeHtml(id)}" readonly>
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-xs font-bold text-on-surface-variant">${field1Label}</label>
      <input class="w-full border border-outline-variant py-2 px-3 rounded-lg outline-none" type="text" id="modal-input-jenis" value="${escapeHtml(field1)}">
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-xs font-bold text-on-surface-variant">${field2Label}</label>
      <input class="w-full border border-outline-variant py-2 px-3 rounded-lg outline-none" type="text" id="modal-input-aksi" value="${escapeHtml(field2)}">
    </div>
  `;
  
  openModal('modal-admin');
}

function saveAdminData() {
  var btn = document.getElementById('btn-save-master');
  var type = state.editingMasterType;
  var idx = state.editingRowIndex;
  
  var values = [];
  if (type === 'rhk') {
    var id = document.getElementById('admin-rhk-id').value.trim();
    var jenis = document.getElementById('admin-rhk-jenis').value.trim();
    var aksi = document.getElementById('admin-rhk-aksi').value.trim();
    if (!id || !jenis || !aksi) {
      showToast('Harap lengkapi semua isian.', 'error'); return;
    }
    values = [id, jenis, aksi];
  } else if (type === 'p2k2') {
    var modul = document.getElementById('admin-p2k2-modul').value.trim();
    var sesi = document.getElementById('admin-p2k2-sesi').value.trim();
    if (!modul || !sesi) {
      showToast('Harap lengkapi semua isian.', 'error'); return;
    }
    values = [modul, sesi];
  } else {
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = 'Memproses...';
  
  let sheetName = type === 'rhk' ? 'Master_RHK' : 'Master_P2K2';
  
  saveMasterDataClient(sheetName, values, idx)
    .then(() => {
      btn.disabled = false;
      btn.innerHTML = 'Simpan';
      closeModal('modal-admin-form');
      showToast('Data master berhasil disimpan.', 'success');
      loadAdminData();
      // Perbarui opsi menu utama juga
      loadRHKOptions();
    })
    .catch(err => {
      btn.disabled = false;
      btn.innerHTML = 'Simpan';
      showToast('Gagal menyimpan: ' + err, 'error');
    });
}

function deleteAdminRow(type, rowIndex) {
  state.deleteTarget = { type: 'admin-' + type, rowIndex: rowIndex };
  openModal('modal-delete');
}

// ── Execute Delete Modal ────────────────────────────────────────
function executeDelete() {
  closeModal('modal-delete');
  var target = state.deleteTarget;
  if (!target || !target.type) return;
  
  showLoading('Menghapus data...');
  
  if (target.type === 'report') {
    // Implementasi Hapus Baris Klien
    deleteRowClient(target.id, 'Laporan_Log')
      .then(() => {
        hideLoading();
        showToast('Laporan berhasil dihapus.', 'success');
        loadDashboardData();
      })
      .catch(err => {
        hideLoading();
        showToast('Gagal menghapus: ' + err, 'error');
      });
  } else if (target.type === 'aduan') {
    deleteRowClient(target.id, 'Pengaduan_Log')
      .then(() => {
        hideLoading();
        showToast('Aduan berhasil dihapus.', 'success');
        loadComplaintsData();
      })
      .catch(err => {
        hideLoading();
        showToast('Gagal menghapus: ' + err, 'error');
      });
  } else if (target.type === 'notaDinas') {
    deleteRowClient(target.id, 'NotaDinas_Log')
      .then(() => {
        hideLoading();
        showToast('Nota Dinas berhasil dihapus.', 'success');
        loadNotaDinasData();
      })
      .catch(err => {
        hideLoading();
        showToast('Gagal menghapus: ' + err, 'error');
      });
  } else if (target.type === 'master') {
    // Delete Master (RHK atau P2K2)
    let sheetName = target.masterType === 'rhk' ? 'Master_RHK' : 'Master_P2K2';
    // Gunakan indeks baris asli yang disimpan di target.index
    deleteRowByIndexClient(target.index, sheetName)
      .then(() => {
        hideLoading();
        showToast('Master berhasil dihapus.', 'success');
        loadAdminData();
      })
      .catch(err => {
        hideLoading();
        showToast('Gagal menghapus master: ' + err, 'error');
      });
  }
}

// ==============================================================
// ── UTILITIES & UI HELPERS ────────────────────────────────────
// ==============================================================
function showLoading(msg) {
  var overlay = document.getElementById('loading-overlay');
  var text = document.getElementById('loading-text');
  if (overlay) {
    if (msg) text.textContent = msg;
    overlay.classList.add('show');
  }
}

function hideLoading() {
  var overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('show');
}

function showToast(msg, type) {
  var container = document.getElementById('toast-container');
  if (!container) return;
  
  var toast = document.createElement('div');
  var icon = 'info';
  var bgClass = 'toast-info';
  
  if (type === 'success') {
    icon = 'check_circle';
    bgClass = 'toast-success';
  } else if (type === 'error') {
    icon = 'error';
    bgClass = 'toast-error';
  } else if (type === 'warning') {
    icon = 'warning';
    bgClass = 'bg-amber-600';
  }
  
  toast.className = `toast ${bgClass}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined toast-icon">${icon}</span>
    <div class="toast-msg font-sans text-xs">${escapeHtml(msg)}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  
  container.appendChild(toast);
  
  // Auto remove toast after 5s
  setTimeout(function() {
    toast.classList.add('hide');
    setTimeout(function() {
      toast.remove();
    }, 400);
  }, 5000);
}

function openModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('show');
  }
}

function closeModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    setTimeout(function() {
      modal.classList.add('hidden');
    }, 100);
  }
}

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function getInitials(name) {
  if (!name) return '—';
  var parts = name.split(' ');
  var initials = '';
  for (var i = 0; i < Math.min(parts.length, 2); i++) {
    if (parts[i]) initials += parts[i].substring(0, 1);
  }
  return initials.toUpperCase() || '—';
}

function formatDateIndo(date) {
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

function logoutSession() {
  const keys = Object.keys(localStorage);
  for (let key of keys) {
    if (key.startsWith('aspend_') || key === 'google_access_token') {
      localStorage.removeItem(key);
    }
  }
  
  state.clientEmail = '';
  state.spreadsheetId = '';
  
  showToast('Sesi Anda berakhir.', 'info');
  document.getElementById('login-overlay').classList.remove('hidden');
}

function processLogin() {
  var emailInput = document.getElementById('login-email').value.trim();
  if (!emailInput) {
    showToast('Silakan masukkan Email / NIK.', 'error');
    return;
  }
  localStorage.setItem('aspend_clientEmail', emailInput);
  state.clientEmail = emailInput;
  document.getElementById('login-overlay').classList.add('hidden');
  initApp();
}

// ── SISTEM OTENTIKASI BARU (GSI & GAPI) ──────────────────────
const CLIENT_ID = '347823247350-cgre13fmjqu5rkuvs3ffqm3238u23shh.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly email profile';
let tokenClient;

function processGoogleLogin() {
  try {
    console.log("Tombol Login Google ditekan...");
    if (typeof google === 'undefined' || !google.accounts) {
      showToast('Pustaka Google belum dimuat sempurna. Harap tunggu beberapa detik atau pastikan koneksi internet stabil.', 'error');
      return;
    }
    
    if (!tokenClient) {
      console.log("Menginisialisasi Token Client...");
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          console.log("Menerima respon Token dari Google:", tokenResponse);
          if (tokenResponse && tokenResponse.access_token) {
            localStorage.setItem('google_access_token', tokenResponse.access_token);
            // Ambil email user via API
            showLoading("Mengidentifikasi profil Anda...");
            fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            })
            .then(res => {
              if (!res.ok) throw new Error("Gagal mengambil profil. Status: " + res.status);
              return res.json();
            })
            .then(data => {
              console.log("Profil didapatkan:", data);
              localStorage.setItem('aspend_clientEmail', data.email);
              if (data.picture) {
                localStorage.setItem('aspend_clientPicture', data.picture);
              }
              state.clientEmail = data.email;
              document.getElementById('login-overlay').classList.add('hidden');
              showToast('Berhasil otentikasi dengan Google!', 'success');
              initApp();
            })
            .catch(err => {
              console.error(err);
              hideLoading();
              showToast('Gagal memuat profil Google: ' + err.message, 'error');
            });
          } else {
             showToast('Otentikasi Google dibatalkan atau gagal.', 'error');
          }
        },
        error_callback: (err) => {
          console.error("GSI Error Callback:", err);
          showToast('Terjadi kesalahan otentikasi: ' + (err.type || 'Unknown Error'), 'error');
        }
      });
    }
    
    console.log("Meminta popup Access Token...");
    tokenClient.requestAccessToken();
  } catch(err) {
    console.error("Kesalahan proses login:", err);
    showToast('Terjadi kesalahan internal saat mencoba login.', 'error');
  }
}

function showLoginOverlay() {
  document.getElementById('spreadsheet-overlay').classList.add('hidden');
  localStorage.removeItem('aspend_clientEmail');
  localStorage.removeItem('google_access_token');
  state.clientEmail = '';
  document.getElementById('login-overlay').classList.remove('hidden');
}

function processSpreadsheetRegistration() {
  var ssIdInput = document.getElementById('reg-spreadsheet-id').value.trim();
  if (!ssIdInput) {
    showToast('Silakan masukkan Spreadsheet ID.', 'error');
    return;
  }

  var btn = document.getElementById('btn-register-ss');
  var originalText = btn.innerHTML;
  btn.innerHTML = '<span>Menghubungkan...</span><div class="spinner"></div>';
  btn.disabled = true;

  gapi.client.sheets.spreadsheets.get({
    spreadsheetId: ssIdInput
  }).then(function(response) {
    btn.innerHTML = originalText;
    btn.disabled = false;
    
    // Sukses, simpan ke local storage
    localStorage.setItem('aspend_spreadsheetId', ssIdInput);
    showToast('Database berhasil terhubung!', 'success');
    document.getElementById('spreadsheet-overlay').classList.add('hidden');
    
    // Lanjutkan inisialisasi
    showLoading('Mengambil data Anda...');
    loadUserProfile();
    loadDashboardData();
    // Pemuatan data lain ditunda atau disesuaikan
    hideLoading();
  }, function(err) {
    btn.innerHTML = originalText;
    btn.disabled = false;
    console.error("Gagal verifikasi SS:", err);
    showToast('Spreadsheet ID tidak valid atau akses ditolak!', 'error');
  });
}

// ── SISTEM PREMIUM PAYWALL ──────────────────────────────────
async function checkPremiumFeature(featureId) {
  if (featureId === 'create_rhk') {
    showLoading('Memeriksa status langganan...');
    try {
      const isPremium = await Promise.race([
        checkPremiumStatusClient(state.spreadsheetId, state.clientEmail),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Koneksi lambat saat memeriksa status langganan. Silakan coba lagi.')), 10000))
      ]);
      hideLoading();
      
      if (isPremium) {
        navigateTo('form');
      } else {
        const premiumModal = document.getElementById('modal-premium');
        if (premiumModal) {
          premiumModal.classList.remove('hidden');
          premiumModal.classList.add('show');
        }
      }
    } catch (err) {
      hideLoading();
      console.error('Error saat cek premium:', err);
      showToast(err.message || 'Terjadi kesalahan jaringan.', 'error');
    }
  }
}

// ── SISTEM IKLAN (AdMob Mock) ──────────────────────────────────
function showAdModal(onCloseCallback) {
  document.getElementById('modal-ad').classList.remove('hidden');
  
  let timerSpan = document.getElementById('ad-timer');
  let btnClose = document.getElementById('btn-close-ad');
  
  let timeLeft = 3;
  if(timerSpan) timerSpan.textContent = timeLeft;
  if(btnClose) {
    btnClose.disabled = true;
    btnClose.innerHTML = '<span class="material-symbols-outlined text-[18px]">hourglass_empty</span> Tunggu <span id="ad-timer">' + timeLeft + '</span> detik...';
  }
  
  let interval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      let tSpan = document.getElementById('ad-timer');
      if(tSpan) tSpan.textContent = timeLeft;
    } else {
      clearInterval(interval);
      let btn = document.getElementById('btn-close-ad');
      if(btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">close</span> Tutup Iklan & Lanjutkan';
        
        btn.onclick = function() {
          document.getElementById('modal-ad').classList.add('hidden');
          if (typeof onCloseCallback === 'function') {
            onCloseCallback();
          }
        };
      }
    }
  }, 1000);
}


function togglePremiumStatus(event) {
  let isPremium = event.target.checked;
  localStorage.setItem('aspend_is_premium', isPremium);
  let statusText = document.getElementById('premium-status-text');
  if(statusText) {
    statusText.textContent = isPremium ? 'Aktif (Premium)' : 'Tidak Aktif (Gratis)';
    statusText.className = isPremium ? 'text-xs text-primary font-bold' : 'text-xs text-on-surface-variant';
  }
}


// ── SISTEM KANVAS TANDA TANGAN ──────────────────────────────────
let canvas, ctx, isDrawing = false;
let lastX = 0, lastY = 0;

function initSignatureCanvas() {
  canvas = document.getElementById('signature-canvas');
  if (!canvas) return;
  
  ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#000f22'; // Warna tinta (primary)
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Mouse events
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  // Touch events
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);
}

function getPos(e) {
  let rect = canvas.getBoundingClientRect();
  let clientX = e.clientX;
  let clientY = e.clientY;
  
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }
  
  // Skala untuk menangani canvas di layar high DPI
  let scaleX = canvas.width / rect.width;
  let scaleY = canvas.height / rect.height;
  
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function startDrawing(e) {
  isDrawing = true;
  let pos = getPos(e);
  [lastX, lastY] = [pos.x, pos.y];
}

function handleTouchStart(e) {
  e.preventDefault();
  startDrawing(e);
}

function draw(e) {
  if (!isDrawing) return;
  let pos = getPos(e);
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  
  [lastX, lastY] = [pos.x, pos.y];
}

function handleTouchMove(e) {
  e.preventDefault();
  draw(e);
}

function stopDrawing() {
  isDrawing = false;
}

function clearSignatureCanvas() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function openSignatureCanvas() {
  document.getElementById('modal-canvas').classList.remove('hidden');
  if (!canvas) {
    initSignatureCanvas();
  } else {
    clearSignatureCanvas();
  }
}

function saveCanvasSignature() {
  if (!canvas) return;
  
  // Deteksi apakah canvas kosong (belum digambar)
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  if (canvas.toDataURL() === blank.toDataURL()) {
    showToast('Kanvas masih kosong! Silakan coretkan tanda tangan Anda.', 'error');
    return;
  }
  
  const dataUrl = canvas.toDataURL('image/png');
  
  // Simpan ke localStorage
  localStorage.setItem('aspend_signature_base64', dataUrl);
  
  // Tampilkan ke UI
  let previewBox = document.getElementById('signature-preview');
  if (previewBox) {
    previewBox.innerHTML = `<img src="${dataUrl}" class="max-w-full max-h-full object-contain">`;
  }
  
  closeModal('modal-canvas');
  showToast('Tanda Tangan digital berhasil disimpan!', 'success');
}


// ── SISTEM ALARM & NOTIFIKASI PUSAT ────────────────────────────
function initAlarmSystem() {
  // Minta izin notifikasi jika belum
  if ("Notification" in window) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }

  // Cek setiap menit
  setInterval(() => {
    let now = new Date();
    let day = now.getDay(); // 0 = Minggu, 1 = Senin, dst
    let hour = now.getHours();
    let minute = now.getMinutes();
    
    // Hanya hari kerja (Senin-Jumat) pukul 17:00
    if (day >= 1 && day <= 5 && hour === 17 && minute === 0) {
      // Cek apakah hari ini sudah buat laporan
      let todayStr = now.toISOString().split('T')[0];
      let alreadyReported = false;
      
      if (state.reports) {
        alreadyReported = state.reports.some(r => r.Tanggal === todayStr);
      }
      
      if (!alreadyReported) {
        let lastNotif = localStorage.getItem('aspend_last_notif_date');
        if (lastNotif !== todayStr) {
          localStorage.setItem('aspend_last_notif_date', todayStr);
          
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Waktunya Buat RHK!", {
              body: "Jangan lupa buat RHK hari ini ya... Buka ASPEND sekarang.",
              icon: "https://cdn-icons-png.flaticon.com/512/3233/3233483.png" // Ikon asisten default
            });
          } else {
            // Fallback: Tampilkan toast
            showToast('Waktunya buat RHK! Jangan lupa isi laporan hari ini ya...', 'info');
          }
        }
      }
    }
  }, 60000); // 60 ribu ms = 1 menit
}

// Inisialisasi saat aplikasi dimuat
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initAlarmSystem, 5000);
  
  // Initialize Flatpickr for Date and Time in edit modal
  if (typeof flatpickr !== 'undefined') {
    window.editTanggalPicker = flatpickr("#edit-tanggal", {
      altInput: true,
      altFormat: "d/m/Y",
      dateFormat: "Y-m-d",
      locale: "id"
    });
    
    window.editWaktuPicker = flatpickr("#edit-waktu", {
      enableTime: true,
      noCalendar: true,
      dateFormat: "H:i",
      time_24hr: true,
      locale: "id"
    });
  }
  
  // Event listener for edit-foto in edit modal
  const editFotoInput = document.getElementById('edit-foto');
  const dropZone = document.getElementById('drop-zone-edit-foto');
  
  if (editFotoInput) {
    const processFiles = (files) => {
      if (!files || files.length === 0) return;
      if (!window.editModalPhotos) window.editModalPhotos = [];
      
      Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
          window.editModalPhotos.push({
            type: 'base64',
            data: evt.target.result
          });
          renderEditPhotos();
        };
        reader.readAsDataURL(file);
      });
      editFotoInput.value = '';
    };

    editFotoInput.addEventListener('change', function(e) {
      processFiles(e.target.files);
    });
    
    if (dropZone) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
      });
      
      function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
          dropZone.classList.add('bg-primary/20', 'border-primary');
          dropZone.classList.remove('bg-primary/5', 'border-primary/40');
        }, false);
      });
      
      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
          dropZone.classList.remove('bg-primary/20', 'border-primary');
          dropZone.classList.add('bg-primary/5', 'border-primary/40');
        }, false);
      });
      
      dropZone.addEventListener('drop', (e) => {
        processFiles(e.dataTransfer.files);
      }, false);
    }
  }
});

// Fungsi untuk me-render kumpulan foto di edit modal
window.renderEditPhotos = function() {
  const container = document.getElementById('edit-foto-preview');
  if (!container) return;
  container.innerHTML = '';
  
  if (!window.editModalPhotos || window.editModalPhotos.length === 0) {
    return;
  }
  
  window.editModalPhotos.forEach((photo, index) => {
    let imgSrc = photo.type === 'id' ? `https://drive.google.com/thumbnail?id=${photo.data}&sz=w400` : photo.data;
    let fullSrc = photo.type === 'id' ? `https://drive.google.com/thumbnail?id=${photo.data}&sz=w1200` : photo.data;
    
    let wrapper = document.createElement('div');
    wrapper.className = 'relative group cursor-pointer';
    wrapper.onclick = function() { showLightbox(fullSrc); };
    
    let img = document.createElement('img');
    img.src = imgSrc;
    img.className = 'h-24 w-24 object-cover rounded border border-outline-variant shadow-sm';
    
    let deleteBtn = document.createElement('button');
    deleteBtn.className = 'absolute -top-2 -right-2 bg-error text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:scale-110';
    deleteBtn.innerHTML = '<span class="material-symbols-outlined text-[14px]">close</span>';
    deleteBtn.onclick = function(e) {
      e.stopPropagation();
      window.editModalPhotos.splice(index, 1);
      renderEditPhotos();
    };
    
    wrapper.appendChild(img);
    wrapper.appendChild(deleteBtn);
    container.appendChild(wrapper);
  });
};


// ── FUNGSI KTP (TERPULIHKAN) ──────────────────────────────────
function handleKtpUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  document.getElementById('ktp-filename').textContent = file.name;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    state.ktpPhotoBase64 = e.target.result;
    
    var loadingBox = document.getElementById('ktp-ai-loading');
    if (loadingBox) loadingBox.classList.remove('hidden');
    
    // Karena API lama terputus, gunakan dummy ekstraksi atau API OpenRouter
    setTimeout(() => {
      if (loadingBox) loadingBox.classList.add('hidden');
      // Simulasi OCR jika KTP diunggah
      let nikEl = document.getElementById('input-pengaduan-nik');
      let namaEl = document.getElementById('input-pengaduan-nama');
      if(nikEl) nikEl.value = "1234567890123456"; // Dummy NIK
      if(namaEl) namaEl.value = "Warga (Hasil AI OCR)"; // Dummy Nama
      
      showToast('Data KTP diekstrak oleh AI (Simulasi).', 'success');
    }, 1500);
  };
  reader.readAsDataURL(file);
}


// ── PENGADUAN DATA ─────────────────────────────────────────────
async function loadComplaintsData() {
  var listContainer = document.getElementById('aduan-list-container');
  if (listContainer) {
    listContainer.innerHTML = '<div class="text-center p-8 text-on-surface-variant">Memuat data pengaduan...</div>';
  }
  
  try {
    const data = await fetchComplaintsDataClient();
    state.complaintsList = data;
    renderComplaintsTable();
  } catch (err) {
    if (listContainer) {
      listContainer.innerHTML = '<div class="text-center p-8 text-error">Gagal memuat data pengaduan.</div>';
    }
  }
}

function renderComplaintsTable() {
  var container = document.getElementById('aduan-list-container');
  if (!container) return;
  
  if (!state.complaintsList || state.complaintsList.length === 0) {
    container.innerHTML = '<div class="text-center p-8 text-on-surface-variant bg-surface rounded-xl border border-surface-variant border-dashed">Belum ada data pengaduan.</div>';
    return;
  }
  
  var html = `
    <div class="overflow-x-auto rounded-xl border border-surface-variant/50 shadow-sm bg-surface">
      <table class="w-full text-left text-sm">
        <thead class="bg-surface-variant/30 text-xs uppercase text-on-surface-variant font-bold border-b border-surface-variant/50">
          <tr>
            <th class="px-4 py-3">Tanggal</th>
            <th class="px-4 py-3">Nama & NIK</th>
            <th class="px-4 py-3">Aduan</th>
            <th class="px-4 py-3 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-variant/50">
  `;
  
  state.complaintsList.forEach(function(a) {
    let dateObj = new Date(a.Tanggal);
    let formattedDate = isNaN(dateObj.getTime()) ? a.Tanggal : dateObj.toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'});
    
    html += `
      <tr class="hover:bg-surface-container-lowest transition-colors group">
        <td class="px-4 py-3 align-top whitespace-nowrap text-on-surface-variant">${formattedDate}</td>
        <td class="px-4 py-3 align-top">
          <div class="font-bold text-on-surface">${a.Nama}</div>
          <div class="text-[11px] text-on-surface-variant">NIK: ${a.NIK}</div>
        </td>
        <td class="px-4 py-3 align-top text-on-surface text-xs">${a.IsiAduan}</td>
        <td class="px-4 py-3 align-top text-center">
          <div class="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="text-on-surface-variant hover:text-error transition-colors p-1 rounded hover:bg-error/10" onclick="deleteAduanLog('${a.AduanId}')" title="Hapus Data">
              <span class="material-symbols-outlined text-[20px]">delete</span>
            </button>
            <!-- Fitur Cetak Verkom Menyusul -->
          </div>
        </td>
      </tr>
    `;
  });
  
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function deleteAduanLog(id) {
  state.deleteTarget = { type: 'aduan', id: id };
  openModal('modal-delete');
}

// ==========================================
// BACKGROUND POLLING (REAL-TIME AUTO REFRESH)
// ==========================================
setInterval(() => {
  // Hanya fetch data jika sudah login dan tidak ada loading modal yang menutupi
  let ssId = localStorage.getItem('aspend_spreadsheetId');
  let isLoadingHidden = document.getElementById('loading-overlay') && document.getElementById('loading-overlay').classList.contains('hidden');
  
  if (ssId && isLoadingHidden) {
    loadDashboardData(true); // true = mode silent (tanpa loading UI, tanpa pesan error)
  }
}, 15000); // 15 detik sekali

