
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
  
  // Tunggu profil dan GAPI selesai dimuat
  await loadUserProfile();
  await checkAdmin();
  
  loadRHKOptions();
  // loadDashboardData sudah dipanggil secara otomatis oleh loadUserProfile jika di halaman dashboard
  // loadComplaintsData(); // (Ditunda hingga migrasi fase selanjutnya selesai)
  // loadNotaDinasData(); // (Ditunda hingga migrasi fase selanjutnya selesai)
  
  hideLoading();
  
  // Active dashboard by default
  if (!state.currentPage) {
    navigateTo('dashboard');
  }
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
    item.classList.remove('bg-secondary-fixed/10', 'text-secondary-fixed', 'border-l-4', 'border-secondary-fixed');
    item.classList.add('text-on-primary/70');
  });
  
  var activeNav = document.getElementById('nav-' + pageId);
  if (activeNav) {
    activeNav.classList.remove('text-on-primary/70');
    activeNav.classList.add('bg-secondary-fixed/10', 'text-secondary-fixed', 'border-l-4', 'border-secondary-fixed');
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
    const spreadsheetId = await locateOrCreateSpreadsheet();
    localStorage.setItem('aspend_spreadsheetId', spreadsheetId);
    state.spreadsheetId = spreadsheetId;
    
    // 3. Muat profil dasar dari Token Google (GSI)
    const email = localStorage.getItem('aspend_clientEmail') || '';
    const profile = {
       email: email,
       nama: email.split('@')[0], 
       jabatan: 'Pendamping PKH' // Default
    };
    
    state.user = profile;
    var initials = getInitials(profile.nama || profile.email || '');
    document.getElementById('sidebar-avatar').textContent = initials;
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
    document.getElementById('nav-admin').classList.remove('hidden');
    var logoCard = document.getElementById('logo-instansi-card');
    if (logoCard) logoCard.classList.remove('hidden');
  }
}

// ── RHK Options Loader ──────────────────────────────────────────
function loadRHKOptions() {
  const options = [
    {id: "RHK-1", jenisRhk: "Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah", rencanaAksi: "Melakukan verifikasi komitmen dan pemutakhiran data KPM PKH", isP2K2: false},
    {id: "RHK-2", jenisRhk: "Terlaksananya pertemuan P2K2 sesuai dengan ketentuan", rencanaAksi: "Melakukan pendampingan Pertemuan Peningkatan Kemampuan Keluarga (P2K2)", isP2K2: true},
    {id: "RHK-3", jenisRhk: "Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementerian Sosial", rencanaAksi: "Mengikuti rapat koordinasi dan evaluasi di tingkat kabupaten/kota", isP2K2: false}
  ];
  state.rhkOptions = options || [];
  
  // Populate dashboard filter dropdown
  var filterJenisSel = document.getElementById('filter-jenis-rhk');
  if (filterJenisSel) {
    filterJenisSel.innerHTML = '<option value="">Semua Jenis RHK</option>';
    var seen = {};
    options.forEach(function(o) {
      if (!seen[o.jenisRhk]) {
        seen[o.jenisRhk] = true;
        filterJenisSel.innerHTML += '<option value="' + escapeHtml(o.id) + '">' +
          escapeHtml(o.id + ' — ' + o.jenisRhk) + '</option>';
      }
    });
  }
  
  // Populate Form select dropdown
  var selectJenis = document.getElementById('select-jenis-rhk');
  if (selectJenis) {
    selectJenis.innerHTML = '<option value="">— Pilih Jenis RHK —</option>';
    var seenForm = {};
    options.forEach(function(o) {
      if (!seenForm[o.jenisRhk]) {
        seenForm[o.jenisRhk] = true;
        selectJenis.innerHTML += '<option value="' + escapeHtml(o.id) + '">' +
          escapeHtml(o.id + ' — ' + o.jenisRhk) + '</option>';
      }
    });
  }
}

// ── Dashboard Data & Table ──────────────────────────────────────
async function loadDashboardData() {
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
      filterDate: state.filterDate
    });
    
    const stats = data.stats;
    document.getElementById('dash-stat-total').textContent = stats.total || 0;
    document.getElementById('dash-stat-month').textContent = stats.month || 0;
    document.getElementById('dash-stat-draft').textContent = stats.pending || 0;
    document.getElementById('dash-stat-final').textContent = stats.done || 0;
    
    state.reports = data.list.data || [];
    state.totalReports = data.list.total || 0;
    renderDashboardTable();
    
  } catch(err) {
    showToast('Gagal memuat Dashboard (Pastikan akun Anda sudah terotentikasi Google): ' + err.message, 'error');
  }
}

function renderDashboardTable() {
  var container = document.getElementById('reports-list-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (state.reports.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-on-surface-variant w-full"><span class="material-symbols-outlined text-4xl block mb-2 opacity-50">drafts</span>Belum ada data laporan.</div>';
    document.getElementById('pagination-info').textContent = 'Menampilkan 0 dari 0 laporan';
    document.getElementById('pagination-pages').innerHTML = '';
    return;
  }
  
  // Sort descending by created at or date
  var sortedReports = [...state.reports].sort(function(a, b) {
    var dateA = new Date(a.Tanggal + (a.Pukul && a.Pukul !== '-' ? 'T' + a.Pukul : 'T00:00:00'));
    var dateB = new Date(b.Tanggal + (b.Pukul && b.Pukul !== '-' ? 'T' + b.Pukul : 'T00:00:00'));
    if (isNaN(dateA)) dateA = new Date(a.CreatedAt || 0);
    if (isNaN(dateB)) dateB = new Date(b.CreatedAt || 0);
    return dateB - dateA;
  });
  
  var tableHtml = `
    <div class="overflow-x-auto w-full bg-white rounded-xl border border-surface-variant shadow-sm">
      <table class="w-full text-sm text-left text-on-background">
        <thead class="text-[11px] uppercase bg-surface-container-low text-on-surface-variant border-b border-outline-variant/30 font-bold tracking-wider">
          <tr>
            <th scope="col" class="px-4 py-4 whitespace-nowrap w-36">Waktu & Tanggal</th>
            <th scope="col" class="px-4 py-4 text-center w-20">Foto</th>
            <th scope="col" class="px-4 py-4 min-w-[280px]">Laporan Kegiatan</th>
            <th scope="col" class="px-4 py-4 min-w-[160px]">Lokasi</th>
            <th scope="col" class="px-4 py-4 text-center w-28">Status</th>
            <th scope="col" class="px-4 py-4 text-center w-32">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-outline-variant/20">
  `;
  
  sortedReports.forEach(function(r) {
    // Tanggal & Jam
    var dateObj = r.Tanggal ? new Date(r.Tanggal) : null;
    var dateStr = dateObj ? formatDateIndo(dateObj) : '-';
    var timeStr = (r.Pukul && r.Pukul !== '-') ? r.Pukul + ' WIB' : '';
    
    // Foto dari array FotoIds (Kolom ke 12)
    var photoHtml = '<span class="text-[10px] text-on-surface-variant italic block py-2">Tidak Ada</span>';
    var thumbId = (r.FotoIds && r.FotoIds.length > 0) ? r.FotoIds[0] : null;
    if (thumbId) {
      var photoUrl = 'https://drive.google.com/uc?export=view&id=' + thumbId;
      photoHtml = `<img src="${photoUrl}" class="w-12 h-12 mx-auto rounded-lg object-cover border border-outline-variant/40 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" onclick="window.open('${photoUrl}', '_blank')" alt="Foto">`;
    }
    
    // Status
    var statusClass = 'bg-surface-variant text-on-surface-variant';
    if (r.Status === 'Selesai') {
      statusClass = 'bg-secondary-fixed/30 text-secondary-dark';
    }
    
    // Aksi
    var actionButtons = '';
    if (r.Status === 'Draft') {
      actionButtons = `
        <div class="flex items-center justify-center gap-1">
          <button class="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded bg-surface hover:bg-surface-container" onclick="editReportDraft('${r.ReportId}')" title="Edit Draft"><span class="material-symbols-outlined text-[20px]">edit</span></button>
          <button class="text-error/70 hover:text-error transition-colors p-1.5 rounded bg-surface hover:bg-error/10" onclick="deleteReportLog('${r.ReportId}')" title="Hapus"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </div>
      `;
    } else {
      var downloadBtn = r.PdfFileId ? 
        `<button class="text-primary hover:text-primary-dark transition-colors p-1.5 rounded bg-primary/10 hover:bg-primary/20" onclick="window.open('https://drive.google.com/file/d/${r.PdfFileId}/view', '_blank')" title="Buka PDF"><span class="material-symbols-outlined text-[20px]">visibility</span></button>` : 
        `<button class="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded bg-surface hover:bg-surface-container" onclick="reprintPdf('${r.ReportId}')" title="Cetak PDF"><span class="material-symbols-outlined text-[20px]">print</span></button>`;
      
      actionButtons = `
        <div class="flex items-center justify-center gap-1">
          ${downloadBtn}
          <button class="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded bg-surface hover:bg-surface-container" onclick="editReportDraft('${r.ReportId}')" title="Edit"><span class="material-symbols-outlined text-[20px]">edit</span></button>
          <button class="text-error/70 hover:text-error transition-colors p-1.5 rounded bg-surface hover:bg-error/10" onclick="deleteReportLog('${r.ReportId}')" title="Hapus"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </div>
      `;
    }
    
    var rhkText = escapeHtml(r.JenisRHK || 'RHK Umum');
    var aksiText = escapeHtml(r.RencanaAksi || '—');
    var lokasiText = escapeHtml(r.Lokasi || '—');
    
    tableHtml += `
      <tr class="hover:bg-primary-fixed/20 transition-colors bg-white group">
        <td class="px-4 py-4 align-top">
          <div class="font-medium text-xs sm:text-sm text-on-surface whitespace-nowrap">${dateStr}</div>
          <div class="text-[11px] text-primary font-bold mt-1 bg-primary/10 inline-block px-1.5 py-0.5 rounded">${timeStr}</div>
        </td>
        <td class="px-4 py-4 align-top text-center">
          ${photoHtml}
        </td>
        <td class="px-4 py-4 align-top">
          <div class="font-bold text-primary font-body-lg text-sm mb-1.5 line-clamp-2 leading-snug">${rhkText}</div>
          <div class="text-on-surface-variant text-xs leading-relaxed line-clamp-3">${aksiText}</div>
        </td>
        <td class="px-4 py-4 align-top">
          <div class="flex items-start gap-1.5 text-xs text-on-surface-variant bg-surface px-2 py-1.5 rounded-md">
            <span class="material-symbols-outlined text-[14px] mt-0.5 text-on-surface-variant/70">location_on</span>
            <span class="line-clamp-3 leading-relaxed">${lokasiText}</span>
          </div>
        </td>
        <td class="px-4 py-4 align-top text-center">
          <span class="badge ${statusClass} px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-block">${escapeHtml(r.Status)}</span>
        </td>
        <td class="px-4 py-4 align-top">
          ${actionButtons}
        </td>
      </tr>
    `;
  });
  
  tableHtml += `
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = tableHtml;
}

function goToReportPage(page) {
  state.currentReportPage = page;
  loadDashboardData();
}

function onSearchInput(event) {
  state.searchTerm = event.target.value;
  state.currentReportPage = 1;
  loadDashboardData();
}

function onJenisFilterChange(event) {
  var value = event.target.value;
  state.filterJenis = value;
  state.currentReportPage = 1;
  
  // Populate Rencana Aksi filter based on selected Jenis RHK
  var filterAksiSel = document.getElementById('filter-rencana-aksi');
  filterAksiSel.innerHTML = '<option value="">Semua Rencana Aksi</option>';
  
  if (value) {
    var rhkData = state.rhkOptions.find(function(o) { return o.id === value; });
    if (rhkData) {
      google.script.run
        .withSuccessHandler(function(actions) {
          actions.forEach(function(a) {
            filterAksiSel.innerHTML += '<option value="' + escapeHtml(a) + '">' + escapeHtml(a) + '</option>';
          });
        })
        .getRencanaAksiByJenis(rhkData.jenisRhk);
    }
  }
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
  if(document.getElementById('filter-month')) document.getElementById('filter-month').value = '';
  
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
  var id = document.getElementById('select-jenis-rhk').value;
  var selectAksi = document.getElementById('select-rencana-aksi');
  selectAksi.innerHTML = '<option value="">— Pilih Rencana Aksi —</option>';
  
  var p2k2Sec = document.getElementById('p2k2-section');
  p2k2Sec.classList.add('hidden');
  
  if (!id) return;
  
  var selected = state.rhkOptions.find(function(o) { return o.id === id; });
  if (!selected) return;
  
  // Show P2K2 Section if Jenis RHK contains "P2K2"
  if (selected.jenisRhk && selected.jenisRhk.toUpperCase().indexOf('P2K2') !== -1) {
    p2k2Sec.classList.remove('hidden');
    loadP2K2ModulOptions();
  }
  
  // Populate Rencana Aksi Form dropdown
  google.script.run
    .withSuccessHandler(function(actions) {
      actions.forEach(function(a) {
        selectAksi.innerHTML += '<option value="' + escapeHtml(a) + '">' + escapeHtml(a) + '</option>';
      });
    })
    .getRencanaAksiByJenis(selected.jenisRhk);
}

function loadP2K2ModulOptions() {
  google.script.run
    .withSuccessHandler(function(moduls) {
      var selectModul = document.getElementById('select-modul');
      selectModul.innerHTML = '<option value="">— Pilih Modul —</option>';
      moduls.forEach(function(m) {
        selectModul.innerHTML += '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>';
      });
    })
    .getUniqueModulP2K2();
}

function onModulChange() {
  var modul = document.getElementById('select-modul').value;
  var selectSesi = document.getElementById('select-sesi');
  selectSesi.innerHTML = '<option value="">— Pilih Sesi —</option>';
  if (!modul) return;
  
  google.script.run
    .withSuccessHandler(function(sesis) {
      sesis.forEach(function(s) {
        selectSesi.innerHTML += '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>';
      });
    })
    .getSesiByModul(modul);
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
      stopRecording();
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

async function saveAndGeneratePDF() {
  var narrativeText = document.getElementById('textarea-narasi').value;
  if (!narrativeText) {
    showToast('Konten narasi kosong!', 'error');
    return;
  }
  
  showLoading('Menyimpan laporan...');
  
  try {
    let ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) throw new Error("Spreadsheet ID belum siap.");
    
    await saveEditedNarrativeClient(ssId, state.currentReportId, narrativeText);
    
    hideLoading();
    showToast('Laporan berhasil disimpan! (Pembuatan PDF dialihkan ke pembaruan mendatang)', 'success');
    
    // Reset form cache
    state.currentReportId = null;
    state.selectedPhotos = [];
    document.getElementById('select-jenis-rhk').value = '';
    document.getElementById('select-rencana-aksi').innerHTML = '<option value="">— Pilih Rencana Aksi —</option>';
    document.getElementById('input-tanggal').value = '';
    document.getElementById('input-lokasi').value = '';
    document.getElementById('input-poin').value = '';
    document.getElementById('photo-previews').innerHTML = '';
    
    navigateTo('dashboard');
  } catch(err) {
    hideLoading();
    showToast('Gagal menyelesaikan laporan: ' + err.message, 'error');
  }
}

function editReportDraft(reportId) {
  showLoading('Memuat detail draf...');
  google.script.run
    .withSuccessHandler(function(r) {
      hideLoading();
      if (!r) return;
      
      state.currentReportId = r.ReportId;
      document.getElementById('form-title-text').textContent = 'Edit Laporan RHK';
      
      // Populate fields
      document.getElementById('input-tanggal').value = r.Tanggal ? r.Tanggal.substring(0, 10) : '';
      document.getElementById('input-lokasi').value = r.Lokasi || '';
      document.getElementById('input-poin').value = r.PoinKegiatan || '';
      
      // Trigger RHK change event by first setting select RHK value
      // Need to find full RHK option with Jenis RHK
      var matchedRHK = state.rhkOptions.find(function(o) { return o.jenisRhk === r.JenisRHK; });
      if (matchedRHK) {
        document.getElementById('select-jenis-rhk').value = matchedRHK.id;
        
        // Load rencana aksi options dynamically
        google.script.run
          .withSuccessHandler(function(actions) {
            var selectAksi = document.getElementById('select-rencana-aksi');
            selectAksi.innerHTML = '<option value="">— Pilih Rencana Aksi —</option>';
            actions.forEach(function(a) {
              selectAksi.innerHTML += '<option value="' + escapeHtml(a) + '">' + escapeHtml(a) + '</option>';
            });
            selectAksi.value = r.RencanaAksi || '';
          })
          .getRencanaAksiByJenis(matchedRHK.jenisRhk);
          
        // Show P2K2 if relevant
        var p2k2Sec = document.getElementById('p2k2-section');
        if (r.JenisRHK.toUpperCase().indexOf('P2K2') !== -1) {
          p2k2Sec.classList.remove('hidden');
          loadP2K2ModulOptions();
          
          // Populate P2K2 fields
          if (r.P2K2Data) {
            var pData = typeof r.P2K2Data === 'string' ? JSON.parse(r.P2K2Data) : r.P2K2Data;
            
            document.getElementById('input-jumlah-kpm').value = pData.jumlahKPM || '';
            document.getElementById('input-jumlah-hadir').value = pData.jumlahHadir || '';
            document.getElementById('input-nama-kelompok').value = pData.namaKelompok || '';
            document.getElementById('input-ketua-kelompok').value = pData.ketuaKelompok || '';
            
            // Wait for moduls to load
            setTimeout(function() {
              document.getElementById('select-modul').value = pData.modul || '';
              // Load sesi based on modul
              if (pData.modul) {
                google.script.run
                  .withSuccessHandler(function(sesis) {
                    var selectSesi = document.getElementById('select-sesi');
                    selectSesi.innerHTML = '<option value="">— Pilih Sesi —</option>';
                    sesis.forEach(function(s) {
                      selectSesi.innerHTML += '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>';
                    });
                    selectSesi.value = pData.sesi || '';
                  })
                  .getSesiByModul(pData.modul);
              }
            }, 1000);
          }
        } else {
          p2k2Sec.classList.add('hidden');
        }
      }
      
      // Photos previews
      state.selectedPhotos = [];
      if (r.FotoIds) {
        var fIds = typeof r.FotoIds === 'string' ? JSON.parse(r.FotoIds) : r.FotoIds;
        var previewContainer = document.getElementById('photo-previews');
        previewContainer.innerHTML = '';
        
        fIds.forEach(function(id) {
          var pUrl = 'https://drive.google.com/uc?export=view&id=' + id;
          var div = document.createElement('div');
          div.className = 'photo-preview-item relative group w-20 h-20 rounded border border-outline-variant overflow-hidden';
          div.innerHTML = `
            <img src="${pUrl}" alt="Preview" class="w-full h-full object-cover">
          `;
          previewContainer.appendChild(div);
        });
      }
      
      navigateTo('form');
    })
    .withFailureHandler(function(err) {
      hideLoading();
      showToast('Gagal memuat draf: ' + err.message, 'error');
    })
    .getReportById(reportId);
}

function deleteReportLog(reportId) {
  state.deleteTarget = { type: 'report', id: reportId };
  openModal('modal-delete');
}

function reprintPdf(reportId) {
  showLoading('Mencetak ulang PDF...');
  google.script.run
    .withSuccessHandler(function(res) {
      hideLoading();
      showToast('PDF berhasil dicetak.', 'success');
      if (res.pdfUrl) {
        window.open(res.pdfUrl, '_blank');
      }
      loadDashboardData();
    })
    .withFailureHandler(function(err) {
      hideLoading();
      showToast('Gagal cetak ulang: ' + err.message, 'error');
    })
    .createReportPDF(reportId);
}

function viewPdfFile(pdfId) {
  var url = 'https://drive.google.com/uc?export=view&id=' + pdfId;
  window.open(url, '_blank');
}

// ==============================================================
// ── MODULE: Pengaduan Masyarakat ─────────────────────────────
// ==============================================================
function loadComplaintsData() {
  google.script.run
    .withSuccessHandler(function(res) {
      state.complaintsList = res.reports || [];
      renderComplaintsList();
    })
    .withFailureHandler(function(err) {
      showToast('Gagal memuat aduan: ' + err.message, 'error');
    })
    .apiGetPengaduanList(state.clientEmail);
}

function renderComplaintsList() {
  var grid = document.getElementById('pengaduan-cards-grid');
  var emptyState = document.getElementById('pengaduan-empty-state');
  grid.innerHTML = '';
  
  if (state.complaintsList.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  
  state.complaintsList.forEach(function(c) {
    var dateText = c.CreatedAt ? formatDateIndo(new Date(c.CreatedAt)) : '—';
    var statusBadge = c.PdfFileId ? 
      `<span class="bg-secondary-fixed/30 text-secondary px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider inline-block">Verifikasi Selesai</span>` : 
      `<span class="bg-surface-variant text-on-surface-variant px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider inline-block">Draft</span>`;
    
    var viewBtn = c.PdfFileId ? 
      `<button class="text-on-surface-variant hover:text-primary transition-colors p-1" onclick="viewPdfFile('${c.PdfFileId}')" title="Buka PDF"><span class="material-symbols-outlined text-[20px]">visibility</span></button>` : '';
      
    var div = document.createElement('div');
    div.className = 'bg-white rounded-xl shadow-sm border border-surface-variant p-5 flex flex-col justify-between';
    div.innerHTML = `
      <div>
        <div class="flex justify-between items-start mb-3">
          <div>
            <h4 class="font-bold text-primary text-sm">${escapeHtml(c.Nama)}</h4>
            <p class="text-xs text-on-surface-variant">NIK: ${escapeHtml(c.Nik)}</p>
          </div>
          ${statusBadge}
        </div>
        <p class="text-xs text-on-surface font-sans mb-3 line-clamp-3">${escapeHtml(c.Aduan)}</p>
        <p class="text-[10px] text-on-surface-variant italic mb-2">Analisa: ${escapeHtml(c.HasilAnalisa || 'Belum dianalisa')}</p>
      </div>
      <div class="border-t border-surface-variant pt-3 flex justify-between items-center mt-3">
        <span class="text-[10px] text-on-surface-variant">${dateText}</span>
        <div class="flex gap-2">
          ${viewBtn}
          <button class="text-error hover:text-error/80 transition-colors p-1" onclick="deleteComplaintLog('${c.Id}')" title="Hapus"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </div>
      </div>
    `;
    grid.appendChild(div);
  });
}

function openFormPengaduan() {
  // Clear forms
  document.getElementById('input-adu-nik').value = '';
  document.getElementById('input-adu-nama').value = '';
  document.getElementById('input-adu-alamat').value = '';
  document.getElementById('input-adu-desa').value = '';
  document.getElementById('input-adu-kecamatan').value = '';
  document.getElementById('input-adu-kabkota').value = '';
  document.getElementById('input-adu-isi').value = '';
  document.getElementById('input-adu-lat').value = '';
  document.getElementById('input-adu-lng').value = '';
  document.getElementById('input-adu-analisa').value = '';
  document.getElementById('ktp-filename').textContent = 'Pilih Foto KTP';
  document.getElementById('siks-filename').textContent = 'Pilih Screenshot SIKS-NG';
  
  state.ktpPhotoBase64 = '';
  state.siksPhotoBase64 = '';
  
  navigateTo('form-pengaduan');
}

// ── Photo uploads for complaint ─────────────────────────────
function handleKtpUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  document.getElementById('ktp-filename').textContent = file.name;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result;
    state.ktpPhotoBase64 = base64;
    
    // Call AI Extraction endpoint automatically!
    extractKtpDataAI(base64, file.type);
  };
  reader.readAsDataURL(file);
}

function extractKtpDataAI(base64Image, mimeType) {
  var loadingBox = document.getElementById('ktp-ai-loading');
  loadingBox.classList.remove('hidden');
  
  google.script.run
    .withSuccessHandler(function(res) {
      loadingBox.classList.add('hidden');
      if (res.success) {
        document.getElementById('input-adu-nik').value = res.nik || '';
        document.getElementById('input-adu-nama').value = res.nama || '';
        showToast('Identitas KTP berhasil diekstraksi oleh AI!', 'success');
      } else {
        showToast('Gagal ekstraksi KTP: ' + res.message, 'warning');
      }
    })
    .withFailureHandler(function(err) {
      loadingBox.classList.add('hidden');
      showToast('Koneksi AI gagal: ' + err.message, 'error');
    })
    .apiExtractKtpData(base64Image, mimeType);
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
  
  showLoading('Menyimpan data pengaduan...');
  
  // We'll upload images first if base64 is loaded, or write directly
  // For simplicity, we save files on Drive via Apps Script
  // Let's call the server function to upload and save
  
  var payload = {
    nik: nik,
    nama: nama,
    alamat: alamat,
    desaKelurahan: desa,
    kecamatan: kec,
    kabKota: kab,
    aduan: aduan,
    hasilAnalisa: analisa,
    latitude: lat,
    longitude: lng,
    fotoKtpBase64: state.ktpPhotoBase64,
    siksBase64: state.siksPhotoBase64
  };
  
  // First upload images, then save Pengaduan
  google.script.run
    .withSuccessHandler(function(saveResult) {
      hideLoading();
      if (saveResult.success) {
        showToast('Aduan berhasil disimpan.', 'success');
        navigateTo('pengaduan');
      } else {
        showToast('Gagal menyimpan: ' + saveResult.message, 'error');
      }
    })
    .withFailureHandler(function(err) {
      hideLoading();
      showToast('Gagal memproses aduan: ' + err.message, 'error');
    })
    .apiSaveComplaintWithFiles(payload, state.clientEmail); // We will define this helper on the server in Code.gs!
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
  if (state.selectedCSVRows.length === 0) {
    showToast('Belum ada data CSV yang diimpor.', 'error');
    return;
  }
  
  showLoading('Menyusun PDF Laporan VERKOM...');
  
  google.script.run
    .withSuccessHandler(function(result) {
      hideLoading();
      if (result.success) {
        showToast('Laporan PDF VERKOM berhasil dicetak.', 'success');
        if (result.pdfUrl) {
          window.open(result.pdfUrl, '_blank');
        }
      } else {
        showToast('Gagal membuat PDF: ' + result.message, 'error');
      }
    })
    .withFailureHandler(function(err) {
      hideLoading();
      showToast('Koneksi gagal: ' + err.message, 'error');
    })
    .apiCreateVerkomPdf(state.selectedCSVRows, state.selectedCSVFileName, state.clientEmail);
}

// ==============================================================
// ── MODULE: Nota Dinas ────────────────────────────────────────
// ==============================================================
function loadNotaDinasData() {
  google.script.run
    .withSuccessHandler(function(res) {
      state.notaDinasList = res.reports || [];
      renderNotaDinasList();
    })
    .withFailureHandler(function(err) {
      showToast('Gagal memuat Nota Dinas: ' + err.message, 'error');
    })
    .apiGetNotaDinasList(state.clientEmail);
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
  var yth = document.getElementById('input-nd-yth').value.trim();
  var dari = document.getElementById('input-nd-dari').value.trim();
  var hal = document.getElementById('input-nd-hal').value.trim();
  var poin = document.getElementById('input-nd-poin').value.trim();
  
  if (!yth || !dari || !hal || !poin) {
    showToast('Mohon lengkapi data metadata dan poin draf sebelum men-generate memo.', 'error');
    return;
  }
  
  showLoading('Menyusun draft memo dengan AI...');
  
  // Prompt builder for official memo
  var prompt = `Buatlah draf isi Nota Dinas Resmi dengan detail berikut:
- Dari: ${dari}
- Kepada Yth: ${yth}
- Hal: ${hal}
- Poin pokok yang dilaporkan: ${poin}

Aturan Penulisan:
1. Gunakan bahasa Indonesia yang baku, sangat formal, sopan, dan sesuai dengan tata bahasa birokrasi pemerintahan (Ejaan Yang Desempurnakan).
2. Mulai langsung dengan isi surat (paragraf pembuka, penjelasan poin draf secara deskriptif, dan paragraf penutup).
3. JANGAN menyertakan KOP, judul "NOTA DINAS", ataupun baris Nomor/Kepada/Dari/Hal/Tanggal di awal teks karena hal tersebut sudah dibuat oleh template PDF.
4. JANGAN menuliskan tanda tangan di akhir teks.
5. Format teks harus berupa paragraf-paragraf bersih tanpa formatting markdown seperti **bold** atau bullet points, agar rapi saat dicetak ke PDF.`;

  google.script.run
    .withSuccessHandler(function(responseText) {
      hideLoading();
      document.getElementById('textarea-nd-isi').value = responseText;
      navigateTo('preview-nd');
    })
    .withFailureHandler(function(err) {
      hideLoading();
      showToast('Gagal menyusun memo: ' + err.message, 'error');
    })
    .callAIService(prompt); // Calls backend AI Service directly!
}

function regenerateMemoAI() {
  generateMemoAI();
}

function saveAndGenerateNDPdf() {
  var isiText = document.getElementById('textarea-nd-isi').value.trim();
  if (!isiText) {
    showToast('Memo dinas kosong!', 'error');
    return;
  }
  
  var nomor = document.getElementById('input-nd-nomor').value.trim();
  var yth = document.getElementById('input-nd-yth').value.trim();
  var dari = document.getElementById('input-nd-dari').value.trim();
  var hal = document.getElementById('input-nd-hal').value.trim();
  var lampiran = document.getElementById('input-nd-lampiran').value.trim();
  var sifat = document.getElementById('input-nd-sifat').value;
  var tanggal = document.getElementById('input-nd-tanggal').value.trim();
  var poin = document.getElementById('input-nd-poin').value.trim();
  
  if (!nomor) {
    showToast('Mohon lengkapi Nomor Nota Dinas.', 'error');
    return;
  }
  
  showLoading('Menyimpan draf dan mencetak PDF...');
  
  var payload = {
    nomor: nomor,
    yth: yth,
    dari: dari,
    hal: hal,
    lampiran: lampiran,
    sifat: sifat,
    tanggal: tanggal,
    poinDraft: poin,
    isiNotaDinas: isiText,
    fotoBase64: state.ndPhotoBase64
  };
  
  google.script.run
    .withSuccessHandler(function(saveResult) {
      if (saveResult.success) {
        google.script.run
          .withSuccessHandler(function(pdfResult) {
            hideLoading();
            showToast('Nota Dinas berhasil dicetak.', 'success');
            if (pdfResult.pdfUrl) {
              window.open(pdfResult.pdfUrl, '_blank');
            }
            navigateTo('nota-dinas');
          })
          .withFailureHandler(function(err) {
            hideLoading();
            showToast('Gagal mencetak PDF: ' + err.message, 'error');
            navigateTo('nota-dinas');
          })
          .apiCreateNotaDinasPdf(saveResult.id, state.clientEmail);
      } else {
        hideLoading();
        showToast('Gagal menyimpan Nota Dinas: ' + saveResult.message, 'error');
      }
    })
    .withFailureHandler(function(err) {
      hideLoading();
      showToast('Koneksi gagal: ' + err.message, 'error');
    })
    .apiSaveNotaDinasWithFiles(payload, state.clientEmail); // We will define this helper on the server in Code.gs!
}

function deleteNotaDinasLog(id) {
  state.deleteTarget = { type: 'nota-dinas', id: id };
  openModal('modal-delete');
}

// ==============================================================
// ── MODULE: Pengaturan & AI ───────────────────────────────────
// ==============================================================
function loadProfileSettings() {
  if (!state.user) return;
  
  document.getElementById('input-email').value = state.user.email || '';
  document.getElementById('input-nama').value = state.user.nama || '';
  document.getElementById('input-nip').value = state.user.nip || '';
  document.getElementById('input-jabatan').value = state.user.jabatan || '';
  document.getElementById('input-kabupaten').value = state.user.kabupatenKota || '';
  
  var initials = getInitials(state.user.nama || state.user.email || '');
  var previewDiv = document.getElementById('profile-photo-preview');
  
  if (state.user.photoUrl) {
    previewDiv.innerHTML = `<img src="${state.user.photoUrl}" alt="Photo" class="w-full h-full object-cover rounded-full">`;
  } else {
    previewDiv.innerHTML = `<span id="profile-initials">${initials}</span>`;
  }
  
  // Render signature preview
  var sigPreview = document.getElementById('signature-preview');
  if (state.user.signatureUrl) {
    sigPreview.innerHTML = `<img src="${state.user.signatureUrl}" alt="Signature" class="max-h-24 object-contain">`;
  } else {
    sigPreview.innerHTML = `<span class="text-xs text-on-surface-variant italic">Belum ada tanda tangan</span>`;
  }
  
  // Load AI configuration for admin
  if (state.isAdmin) {
    google.script.run
      .withSuccessHandler(function(config) {
        state.aiKeys = {
          google: config.geminiKey || '',
          groq: config.groqKey || '',
          openrouter: config.openrouterKey || ''
        };
        state.aiProvider = config.provider || 'google';
        state.aiModel = config.model || '';
        
        document.getElementById('select-ai-provider').value = state.aiProvider;
        document.getElementById('input-ai-model').value = state.aiModel;
        
        // Load active key
        document.getElementById('input-gemini-key').value = state.aiKeys[state.aiProvider];
      })
      .withFailureHandler(function() { /* silent */ })
      .getAIConfigForAdmin(state.clientEmail);
      
    // Load Logo Kop preview
    google.script.run
      .withSuccessHandler(function(logoUrl) {
        var logoPreview = document.getElementById('logo-preview-box');
        if (logoUrl) {
          logoPreview.innerHTML = `<img src="${logoUrl}" alt="Kop Logo" class="max-h-12 object-contain">`;
        }
      })
      .getKemensosLogoUrl();
  }
}

function onAIProviderChange() {
  var provider = document.getElementById('select-ai-provider').value;
  state.aiProvider = provider;
  
  // Display active key from cache
  document.getElementById('input-gemini-key').value = state.aiKeys[provider] || '';
  
  var hintText = document.getElementById('ai-key-hint');
  if (provider === 'google') {
    hintText.textContent = 'Masukkan API Key yang Anda peroleh dari Google AI Studio.';
  } else if (provider === 'groq') {
    hintText.textContent = 'Masukkan API Key yang Anda peroleh dari Groq Console.';
  } else if (provider === 'openrouter') {
    hintText.textContent = 'Masukkan API Key yang Anda peroleh dari OpenRouter Dashboard.';
  }
}

function handleProfilePhotoUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  showLoading('Mengunggah foto profil...');
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result;
    google.script.run
      .withSuccessHandler(function(res) {
        hideLoading();
        if (res.success) {
          showToast('Foto profil berhasil diperbarui.', 'success');
          loadUserProfile();
          setTimeout(loadProfileSettings, 1000);
        } else {
          showToast('Gagal upload: ' + res.message, 'error');
        }
      })
      .withFailureHandler(function(err) {
        hideLoading();
        showToast('Koneksi gagal: ' + err.message, 'error');
      })
      .uploadProfilePhoto(base64, file.type);
  };
  reader.readAsDataURL(file);
}

function handleSignatureUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  showLoading('Mengunggah tanda tangan...');
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result;
    google.script.run
      .withSuccessHandler(function(res) {
        hideLoading();
        if (res.success) {
          showToast('Tanda tangan digital diperbarui.', 'success');
          loadUserProfile();
          setTimeout(loadProfileSettings, 1000);
        } else {
          showToast('Gagal upload: ' + res.message, 'error');
        }
      })
      .withFailureHandler(function(err) {
        hideLoading();
        showToast('Koneksi gagal: ' + err.message, 'error');
      })
      .uploadSignature(base64, file.type);
  };
  reader.readAsDataURL(file);
}

function handleLogoUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  showLoading('Mengunggah logo instansi...');
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result;
    google.script.run
      .withSuccessHandler(function(res) {
        hideLoading();
        if (res.success) {
          showToast('Logo kop surat instansi berhasil disimpan.', 'success');
          setTimeout(loadProfileSettings, 1000);
        } else {
          showToast('Gagal upload logo: ' + res.message, 'error');
        }
      })
      .withFailureHandler(function(err) {
        hideLoading();
        showToast('Koneksi gagal: ' + err.message, 'error');
      })
      .uploadKemensosLogo(base64, file.type, state.clientEmail);
  };
  reader.readAsDataURL(file);
}

function toggleApiKeyVisibility() {
  var input = document.getElementById('input-gemini-key');
  var btnIcon = document.querySelector('#btn-toggle-key span');
  
  if (input.type === 'password') {
    input.type = 'text';
    btnIcon.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    btnIcon.textContent = 'visibility';
  }
}

function testAIConnectionSettings() {
  var provider = document.getElementById('select-ai-provider').value;
  var apiKey = document.getElementById('input-gemini-key').value.trim();
  var model = document.getElementById('input-ai-model').value.trim();
  
  if (!apiKey) {
    showToast('Mohon isi API Key terlebih dahulu.', 'error');
    return;
  }
  
  var diagnosticBox = document.getElementById('gemini-diagnostic-box');
  var diagnosticSummary = document.getElementById('gemini-diagnostic-summary');
  
  diagnosticBox.classList.remove('hidden');
  diagnosticSummary.textContent = 'Mencoba menghubungkan ke API provider ' + provider + '...';
  
  google.script.run
    .withSuccessHandler(function(res) {
      if (res.success) {
        diagnosticSummary.innerHTML = `<span class="text-success font-bold">✓ KONEKSI BERHASIL!</span>\nRespons: ${escapeHtml(res.message)}`;
      } else {
        diagnosticSummary.innerHTML = `<span class="text-error font-bold">✗ KONEKSI GAGAL!</span>\nDetail error: ${escapeHtml(res.message)}`;
      }
    })
    .withFailureHandler(function(err) {
      diagnosticSummary.innerHTML = `<span class="text-error font-bold">✗ ERROR SISTEM!</span>\nDetail error: ${escapeHtml(err.message)}`;
    })
    .testAIConnection(provider, apiKey, model, state.clientEmail); // Calls backend endpoint!
}

function saveAIConfigSettings() {
  var provider = document.getElementById('select-ai-provider').value;
  var apiKey = document.getElementById('input-gemini-key').value.trim();
  var model = document.getElementById('input-ai-model').value.trim();
  
  if (!apiKey) {
    showToast('API Key tidak boleh kosong.', 'error');
    return;
  }
  
  // Cache locally
  state.aiKeys[provider] = apiKey;
  state.aiProvider = provider;
  state.aiModel = model;
  
  showLoading('Menyimpan konfigurasi AI...');
  
  var payload = {
    provider: provider,
    geminiKey: state.aiKeys.google,
    groqKey: state.aiKeys.groq,
    openrouterKey: state.aiKeys.openrouter,
    model: model
  };
  
  google.script.run
    .withSuccessHandler(function(res) {
      hideLoading();
      showToast(res.message, 'success');
    })
    .withFailureHandler(function(err) {
      hideLoading();
      showToast('Gagal menyimpan: ' + err.message, 'error');
    })
    .saveAIConfig(payload, state.clientEmail);
}

function saveSettings() {
  var nama = document.getElementById('input-nama').value.trim();
  var nip = document.getElementById('input-nip').value.trim();
  var jabatan = document.getElementById('input-jabatan').value.trim();
  var kab = document.getElementById('input-kabupaten').value.trim();
  
  if (!nama) {
    showToast('Nama lengkap tidak boleh kosong.', 'error');
    return;
  }
  
  showLoading('Menyimpan profil...');
  
  var payload = {
    nama: nama,
    nip: nip,
    jabatan: jabatan,
    kabupatenKota: kab
  };
  
  google.script.run
    .withSuccessHandler(function(res) {
      hideLoading();
      if (res.success) {
        showToast('Profil berhasil disimpan.', 'success');
        loadUserProfile();
      } else {
        showToast('Gagal menyimpan: ' + res.message, 'error');
      }
    })
    .withFailureHandler(function(err) {
      hideLoading();
      showToast('Koneksi gagal: ' + err.message, 'error');
    })
    .updateUserProfile(payload);
}

// ==============================================================
// ── MODULE: Panel Admin ───────────────────────────────────────
// ==============================================================
function loadAdminData() {
  showLoading('Memuat data master...');
  
  // Load Master RHK
  google.script.run
    .withSuccessHandler(function(options) {
      var tbody = document.getElementById('admin-rhk-tbody');
      tbody.innerHTML = '';
      
      if (options.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Belum ada data Master RHK</td></tr>';
        return;
      }
      
      options.forEach(function(o, index) {
        var tr = document.createElement('tr');
        tr.className = 'hover:bg-surface-container-low border-b border-surface-variant';
        tr.innerHTML = `
          <td class="p-3 font-semibold">${escapeHtml(o.id)}</td>
          <td class="p-3">${escapeHtml(o.jenisRhk)}</td>
          <td class="p-3 max-w-sm truncate">${escapeHtml(o.rencanaAksi)}</td>
          <td class="p-3 text-right">
            <div class="flex gap-2 justify-end">
              <button class="text-on-surface-variant hover:text-primary transition-colors p-1" onclick="editAdminRow('rhk', ${o._rowIndex}, '${o.id}', '${escapeJs(o.jenisRhk)}', '${escapeJs(o.rencanaAksi)}')"><span class="material-symbols-outlined text-[16px]">edit</span></button>
              <button class="text-error hover:text-error/85 transition-colors p-1" onclick="deleteAdminRow('rhk', ${o._rowIndex})"><span class="material-symbols-outlined text-[16px]">delete</span></button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .withFailureHandler(function(err) {
      showToast('Gagal memuat master RHK: ' + err.message, 'error');
    })
    .getRHKOptions();
    
  // Load Master P2K2
  google.script.run
    .withSuccessHandler(function(p2k2List) {
      hideLoading();
      var tbody = document.getElementById('admin-p2k2-tbody');
      tbody.innerHTML = '';
      
      if (!p2k2List || p2k2List.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Belum ada data Master P2K2</td></tr>';
        return;
      }
      
      p2k2List.forEach(function(p) {
        var tr = document.createElement('tr');
        tr.className = 'hover:bg-surface-container-low border-b border-surface-variant';
        tr.innerHTML = `
          <td class="p-3 font-semibold">${escapeHtml(p.ID)}</td>
          <td class="p-3">${escapeHtml(p.MODUL)}</td>
          <td class="p-3">${escapeHtml(p.SESI)}</td>
          <td class="p-3 text-right">
            <div class="flex gap-2 justify-end">
              <button class="text-on-surface-variant hover:text-primary transition-colors p-1" onclick="editAdminRow('p2k2', ${p._rowIndex}, '${p.ID}', '${escapeJs(p.MODUL)}', '${escapeJs(p.SESI)}')"><span class="material-symbols-outlined text-[16px]">edit</span></button>
              <button class="text-error hover:text-error/85 transition-colors p-1" onclick="deleteAdminRow('p2k2', ${p._rowIndex})"><span class="material-symbols-outlined text-[16px]">delete</span></button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .withFailureHandler(function(err) {
      hideLoading();
      showToast('Gagal memuat master P2K2: ' + err.message, 'error');
    })
    .getAllMasterP2K2(); // We will define this helper on the server in Code.gs!
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
  var id = document.getElementById('modal-input-id').value.trim();
  var val1 = document.getElementById('modal-input-jenis').value.trim();
  var val2 = document.getElementById('modal-input-aksi').value.trim();
  
  if (!id || !val1 || !val2) {
    showToast('Mohon lengkapi semua bidang.', 'error');
    return;
  }
  
  showLoading('Menyimpan data master...');
  
  var payload = {
    type: state.editingMasterType,
    rowIndex: state.editingRowIndex,
    id: id,
    val1: val1,
    val2: val2
  };
  
  google.script.run
    .withSuccessHandler(function(res) {
      hideLoading();
      closeModal('modal-admin');
      if (res.success) {
        showToast(res.message, 'success');
        loadAdminData();
        loadRHKOptions(); // Refresh main RHK options
      } else {
        showToast('Gagal menyimpan: ' + res.message, 'error');
      }
    })
    .withFailureHandler(function(err) {
      hideLoading();
      showToast('Koneksi gagal: ' + err.message, 'error');
    })
    .saveMasterData(payload, state.clientEmail); // We will define this helper on the server in Code.gs!
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
    google.script.run
      .withSuccessHandler(function(res) {
        hideLoading();
        showToast('Laporan berhasil dihapus.', 'success');
        loadDashboardData();
      })
      .withFailureHandler(function(err) {
        hideLoading();
        showToast('Gagal menghapus: ' + err.message, 'error');
      })
      .deleteReportData(target.id, state.clientEmail);
  } else if (target.type === 'complaint') {
    google.script.run
      .withSuccessHandler(function(res) {
        hideLoading();
        showToast('Aduan berhasil dihapus.', 'success');
        loadComplaintsData();
      })
      .withFailureHandler(function(err) {
        hideLoading();
        showToast('Gagal menghapus aduan: ' + err.message, 'error');
      })
      .apiDeletePengaduan(target.id, state.clientEmail);
  } else if (target.type === 'nota-dinas') {
    google.script.run
      .withSuccessHandler(function(res) {
        hideLoading();
        showToast('Nota Dinas berhasil dihapus.', 'success');
        loadNotaDinasData();
      })
      .withFailureHandler(function(err) {
        hideLoading();
        showToast('Gagal menghapus Nota Dinas: ' + err.message, 'error');
      })
      .apiDeleteNotaDinas(target.id, state.clientEmail);
  } else if (target.type.indexOf('admin-') === 0) {
    var masterType = target.type.replace('admin-', '');
    google.script.run
      .withSuccessHandler(function(res) {
        hideLoading();
        if (res.success) {
          showToast('Data master berhasil dihapus.', 'success');
          loadAdminData();
          loadRHKOptions();
        } else {
          showToast('Gagal hapus: ' + res.message, 'error');
        }
      })
      .withFailureHandler(function(err) {
        hideLoading();
        showToast('Koneksi gagal: ' + err.message, 'error');
      })
      .deleteMasterData(masterType, target.rowIndex, state.clientEmail); // We will define this helper on the server in Code.gs!
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
  localStorage.removeItem('aspend_clientEmail');
  state.clientEmail = '';
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
  
  google.script.run
    .withSuccessHandler(function(res) {
      btn.innerHTML = originalText;
      btn.disabled = false;
      if (res.success) {
        showToast(res.message, 'success');
        document.getElementById('spreadsheet-overlay').classList.add('hidden');
        // Lanjutkan inisialisasi
        showLoading('Mengambil data Anda...');
        loadUserProfile();
        loadDashboardData();
        loadComplaintsData();
        loadNotaDinasData();
        hideLoading();
      } else {
        showToast(res.message, 'error');
      }
    })
    .withFailureHandler(function(err) {
      btn.innerHTML = originalText;
      btn.disabled = false;
      showToast('Terjadi kesalahan jaringan: ' + err.message, 'error');
    })
    .registerUserSpreadsheet(state.clientEmail, ssIdInput);
}

