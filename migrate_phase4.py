import os

# 1. Add fetch/save to client_services.js
client_code = """
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
"""

with open('c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js', 'a', encoding='utf-8') as f:
    f.write('\n' + client_code)


# 2. Rewrite script.js Admin functions
script_path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(script_path, 'r', encoding='utf-8') as f:
    text = f.read()

def replace_function(text, func_name, new_code):
    start = text.find(func_name)
    if start == -1: return text
    brace_start = text.find('{', start)
    stack = 0
    end = -1
    for i in range(brace_start, len(text)):
        if text[i] == '{': stack += 1
        elif text[i] == '}':
            stack -= 1
            if stack == 0:
                end = i
                break
    if end == -1: return text
    return text[:start] + new_code + text[end+1:]

new_on_jenis = """function onJenisRHKChange() {
  var sel = document.getElementById('select-jenis-rhk');
  var rs = document.getElementById('select-rencana-aksi');
  if (!sel || !rs) return;
  
  rs.innerHTML = '<option value="">— Pilih Rencana Aksi —</option>';
  var selectedId = sel.value; // Ini adalah RHK-1, RHK-2, dll
  if (!selectedId) {
    document.getElementById('p2k2-fields').classList.add('hidden');
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
    document.getElementById('p2k2-fields').classList.remove('hidden');
    loadP2K2ModulOptions();
  } else {
    document.getElementById('p2k2-fields').classList.add('hidden');
  }
}"""

new_load_modul = """function loadP2K2ModulOptions() {
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
}"""

new_on_modul = """function onModulChange() {
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
}"""

new_load_admin = """function loadAdminData() {
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
}"""

new_save_admin = """function saveAdminData() {
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
}"""

new_save_settings = """function saveSettings() {
  var prov = document.getElementById('select-ai-provider').value;
  var model = document.getElementById('input-ai-model').value.trim();
  var openrouter = document.getElementById('input-key-openrouter').value.trim();
  var google = document.getElementById('input-key-google').value.trim();
  var groq = document.getElementById('input-key-groq').value.trim();
  
  state.aiProvider = prov;
  state.aiModel = model;
  state.aiKeys.openrouter = openrouter;
  state.aiKeys.google = google;
  state.aiKeys.groq = groq;
  
  // Karena ini client-side, simpan saja langsung di localStorage!
  localStorage.setItem('aspend_aiProvider', prov);
  localStorage.setItem('aspend_aiModel', model);
  localStorage.setItem('aspend_aiKeys', JSON.stringify(state.aiKeys));
  
  showToast('Pengaturan lokal berhasil disimpan.', 'success');
}"""

text = replace_function(text, 'function onJenisRHKChange()', new_on_jenis)
text = replace_function(text, 'function loadP2K2ModulOptions()', new_load_modul)
text = replace_function(text, 'function onModulChange()', new_on_modul)
text = replace_function(text, 'function loadAdminData()', new_load_admin)
text = replace_function(text, 'function saveAdminData()', new_save_admin)
text = replace_function(text, 'function saveSettings()', new_save_settings)

with open(script_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Phase 4 script applied.")
