import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

new_func = """function onJenisRHKFilterChange() {
  var filterJenisSel = document.getElementById('filter-jenis-rhk');
  var filterRencanaSel = document.getElementById('filter-rencana-aksi');
  
  state.filterJenisRHK = filterJenisSel.value;
  state.filterRencanaAksi = ''; // Reset
  
  if (filterRencanaSel) {
    filterRencanaSel.innerHTML = '<option value="">Semua Rencana Aksi</option>';
    
    if (state.filterJenisRHK) {
      // Cari Rencana Aksi yang sesuai dengan Jenis RHK yang dipilih
      var matched = (state.rhkOptions || []).filter(o => o.id === state.filterJenisRHK);
      matched.forEach(o => {
        filterRencanaSel.innerHTML += '<option value="' + escapeHtml(o.rencanaAksi) + '">' + escapeHtml(o.rencanaAksi) + '</option>';
      });
    }
  }
  
  state.currentReportPage = 1;
  loadDashboardData();
}

function onFilterChange(event) {"""

text = text.replace('function onFilterChange(event) {', new_func)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("onJenisRHKFilterChange injected successfully.")
