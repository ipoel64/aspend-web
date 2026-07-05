import os

# 1. Add fetchComplaintsDataClient and saveComplaintClient to client_services.js
client_code = """
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
"""

with open('c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js', 'a', encoding='utf-8') as f:
    f.write(client_code)


# 2. Add loadComplaintsData and modify saveComplaint in script.js
script_path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(script_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Append loadComplaintsData to script.js since it's missing
load_complaints_code = """
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
"""

with open(script_path, 'a', encoding='utf-8') as f:
    f.write('\n' + load_complaints_code)

print("Client services and script.js updated for Pengaduan.")
