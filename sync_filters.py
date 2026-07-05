import os

# 1. Update loadDashboardData to pass all filters
script_path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(script_path, 'r', encoding='utf-8') as f:
    text = f.read()

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

new_load = """async function loadDashboardData() {
  try {
    let ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) {
      return;
    }
    
    const data = await fetchDashboardDataClient(ssId, state.clientEmail, {
      page: state.currentReportPage,
      pageSize: state.pageSize,
      searchTerm: state.searchTerm,
      filterJenis: state.filterJenisRHK || '',
      filterRencanaAksi: state.filterRencanaAksi || '',
      filterDate: state.filterDate || '',
      filterMonth: state.filterMonth || ''
    });
    
    const stats = data.stats;
    document.getElementById('dash-stat-total').textContent = stats.total || 0;
    document.getElementById('dash-stat-month').textContent = stats.month || 0;
    document.getElementById('dash-stat-draft').textContent = stats.pending || 0;
    document.getElementById('dash-stat-final').textContent = stats.done || 0;
    
    state.reports = data.list.data || [];
    state.totalReports = data.list.total || 0;
    renderDashboardTable();
  } catch (err) {
    console.error('Error loadDashboardData:', err);
  }
}"""
text = replace_func(text, 'async function loadDashboardData()', new_load)
with open(script_path, 'w', encoding='utf-8') as f:
    f.write(text)

# 2. Update fetchDashboardDataClient to apply those filters
client_path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js'
with open(client_path, 'r', encoding='utf-8') as f:
    client_text = f.read()

new_fetch = """async function fetchDashboardDataClient(ssId, userEmail, options) {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: 'Laporan_RHK!A2:R'
    });
    
    const rows = response.result.values || [];
    let reports = rows.map(row => ({
      WaktuStamp: row[0] || '',
      Email: row[1] || '',
      IdRHK: row[2] || '',
      JenisRHK: row[3] || '',
      RencanaAksi: row[4] || '',
      Tanggal: row[5] || '',
      Mulai: row[6] || '',
      Selesai: row[7] || '',
      PoinKegiatan: row[8] || '',
      P2K2Modul: row[9] || '',
      P2K2Sesi: row[10] || '',
      P2K2FDS: row[11] || '',
      NarasiAI: row[12] || '',
      LinkFoto: row[13] || '',
      Uraian: row[14] || '',
      RowIndex: row[15] || '',
      Status: row[16] || '',
      Latitude: row[17] || '' // if any
    }));

    // Saring berdasarkan Pencarian Teks
    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      reports = reports.filter(r => 
        (r.JenisRHK || '').toLowerCase().includes(term) ||
        (r.RencanaAksi || '').toLowerCase().includes(term) ||
        (r.PoinKegiatan || '').toLowerCase().includes(term) ||
        (r.NarasiAI || '').toLowerCase().includes(term) ||
        (r.IdRHK || '').toLowerCase().includes(term)
      );
    }
    
    // Saring berdasarkan Jenis RHK (Dropdown 1)
    if (options.filterJenis) {
      reports = reports.filter(r => r.IdRHK === options.filterJenis || r.JenisRHK === options.filterJenis);
    }
    
    // Saring berdasarkan Rencana Aksi (Dropdown 2)
    if (options.filterRencanaAksi) {
      reports = reports.filter(r => r.RencanaAksi === options.filterRencanaAksi);
    }
    
    // Saring berdasarkan Tanggal (Dropdown 3)
    if (options.filterDate) {
      reports = reports.filter(r => r.Tanggal === options.filterDate);
    }

    // Hitung Statistik
    const total = reports.length;
    let pending = 0;
    let done = 0;
    let monthCount = 0;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    reports.forEach(r => {
      if ((r.Status || '').toLowerCase() === 'draft') {
        pending++;
      } else {
        done++;
      }
      if (r.Tanggal) {
        const d = new Date(r.Tanggal);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          monthCount++;
        }
      }
    });

    reports.sort((a, b) => new Date(b.WaktuStamp || 0) - new Date(a.WaktuStamp || 0));

    // Pagination
    const page = options.page || 1;
    const size = options.pageSize || 10;
    const start = (page - 1) * size;
    const paginatedReports = reports.slice(start, start + size);

    return {
      stats: { total: total, month: monthCount, pending: pending, done: done },
      list: { data: paginatedReports, total: total }
    };
  } catch (err) {
    console.error('fetchDashboardDataClient error:', err);
    throw err;
  }
}"""
client_text = replace_func(client_text, 'async function fetchDashboardDataClient(ssId, userEmail, options)', new_fetch)
with open(client_path, 'w', encoding='utf-8') as f:
    f.write(client_text)

print("Filters completely synchronized.")
