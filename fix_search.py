import os
import re

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Fix regex replace
text = text.replace(r"replace(/\\D/g, '')", r"replace(/\D/g, '')")

# 2. Fix loadRHKOptions to fetch from DB instead of hardcode
def replace_func(text, func_name, new_code):
    start = text.find(func_name)
    if start == -1: return text
    brace = text.find('{', start)
    stack = 0
    end = -1
    for i in range(brace, len(text)):
        if text[i] == '{': stack += 1
        elif text[i] == '}':
            stack -= 1
            if stack == 0:
                end = i
                break
    if end == -1: return text
    return text[:start] + new_code + text[end+1:]

new_load_rhk = """function loadRHKOptions() {
  fetchAdminDataClient().then(data => {
    state.rhkOptions = data.rhk.map(r => ({id: r.id, jenisRhk: r.jenis, rencanaAksi: r.rencana}));
    state.p2k2ModulOptions = data.p2k2.map(p => ({modul: p.modul, sesi: p.sesi}));
    
    // Populate dashboard filter dropdown
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

    // Populate Form select dropdown
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
  }).catch(err => {
    console.error("Gagal memuat RHK:", err);
  });
}"""

text = replace_func(text, 'function loadRHKOptions()', new_load_rhk)

# 3. Fix onSearchInput (Add debounce)
new_search = """let searchTimeout = null;
function onSearchInput(event) {
  state.searchTerm = event.target.value;
  state.currentReportPage = 1;
  
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadDashboardData();
  }, 600); // Tunggu 600ms setelah selesai mengetik agar tidak membebani server
}"""
text = replace_func(text, 'function onSearchInput(event)', new_search)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Fixes applied successfully.")
