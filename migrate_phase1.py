import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

def replace_function(text, func_name, new_code):
    start = text.find(func_name)
    if start == -1:
        print(f"Function {func_name} not found!")
        return text
    
    # Find the opening brace
    brace_start = text.find('{', start)
    if brace_start == -1:
        print(f"Opening brace for {func_name} not found!")
        return text

    # Trace matching brace
    stack = 0
    end = -1
    for i in range(brace_start, len(text)):
        if text[i] == '{':
            stack += 1
        elif text[i] == '}':
            stack -= 1
            if stack == 0:
                end = i
                break
    
    if end == -1:
        print(f"Closing brace for {func_name} not found!")
        return text

    return text[:start] + new_code + text[end+1:]


new_process_ss = """function processSpreadsheetRegistration() {
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
}"""

new_edit_report = """function editReportDraft(reportId) {
  showLoading('Memuat detail draf...');
  
  // Ambil dari RAM lokal (state.reports)
  let r = state.reports.find(rep => rep.ReportId === reportId);
  hideLoading();
  
  if (!r) {
    showToast('Laporan tidak ditemukan di memori.', 'error');
    return;
  }
  
  state.currentReportId = r.ReportId;
  document.getElementById('form-title-text').textContent = 'Edit Laporan RHK';
  
  // Populate fields
  document.getElementById('input-tanggal').value = r.Tanggal ? r.Tanggal.substring(0, 10) : '';
  document.getElementById('input-lokasi').value = r.Lokasi || '';
  document.getElementById('input-poin').value = r.PoinKegiatan || '';
  
  var selectJenis = document.getElementById('select-jenis-rhk');
  if (selectJenis) {
    var opt = Array.from(selectJenis.options).find(o => o.value === r.IdRHK);
    if (opt) {
      selectJenis.value = r.IdRHK;
      onJenisRHKChange();
    }
  }
  
  setTimeout(() => {
    var selectRencana = document.getElementById('select-rencana-aksi');
    if (selectRencana) {
      var opt2 = Array.from(selectRencana.options).find(o => o.value === r.RencanaAksi);
      if (opt2) {
        selectRencana.value = r.RencanaAksi;
      }
    }
    
    // Populate P2K2 jika ada
    if (r.P2K2Data) {
      document.getElementById('p2k2-fields').classList.remove('hidden');
      document.getElementById('input-p2k2-modul').value = r.P2K2Data.Modul || '';
      onModulChange();
      setTimeout(() => {
        document.getElementById('input-p2k2-sesi').value = r.P2K2Data.Sesi || '';
      }, 300);
      document.getElementById('input-p2k2-kpm').value = r.P2K2Data.JumlahKPM || '';
    } else {
      document.getElementById('p2k2-fields').classList.add('hidden');
    }
  }, 300);
  
  // Tampilkan modal
  openModal('modal-form');
}"""

new_execute_delete = """function executeDelete() {
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
}"""

text = replace_function(text, 'function processSpreadsheetRegistration()', new_process_ss)
text = replace_function(text, 'function editReportDraft(reportId)', new_edit_report)
text = replace_function(text, 'function executeDelete()', new_execute_delete)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Phase 1 modifications completed.")
