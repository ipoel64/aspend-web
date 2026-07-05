import os

client_path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js'
with open(client_path, 'r', encoding='utf-8') as f:
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

new_fetch = """async function fetchDashboardDataClient(spreadsheetId, userEmail, options = {}) {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Laporan_Log!A2:Q'
    });
    
    const rows = response.result.values || [];
    let reports = rows.map(row => ({
      ReportId: row[0] || '',
      Tanggal: row[1] || '',
      JenisRHK: row[2] || '',
      IdRHK: row[3] || '',
      RencanaAksi: row[4] || '',
      Pukul: row[5] || '',
      PoinKegiatan: row[6] || '',
      NarasiAI: row[7] || '',
      NarasiEdited: row[8] || '',
      Status: row[9] || '',
      PdfFileId: row[10] || '',
      FotoIds: (() => {
        try { return row[11] ? JSON.parse(row[11]) : []; } 
        catch(e) { return []; } 
      })(),
      P2K2Data: (() => {
        try { return row[12] ? JSON.parse(row[12]) : null; } 
        catch(e) { return null; } 
      })(),
      Lokasi: row[13] || '',
      CreatedAt: row[14] || ''
    }));
    
    // TIDAK PERLU FILTER EMAIL KARENA FILE MILIK PRIBADI USER
    
    // Urutkan terbaru di atas
    reports.sort((a,b) => new Date(b.CreatedAt || 0) - new Date(a.CreatedAt || 0));
    
    // Kalkulasi Statistik Keseluruhan (Sebelum Filter)
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthCount = reports.filter(r => r.Tanggal && r.Tanggal.startsWith(currentMonth)).length;
    const stats = {
      total: reports.length,
      month: monthCount,
      pending: reports.filter(r => (r.Status || '').toLowerCase() === 'draft').length,
      done: reports.filter(r => (r.Status || '').toLowerCase() !== 'draft').length
    };

    // Filter Pencarian Teks
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
    
    // Filter Jenis RHK
    if (options.filterJenis) {
      reports = reports.filter(r => r.IdRHK === options.filterJenis || r.JenisRHK === options.filterJenis);
    }
    
    // Filter Rencana Aksi
    if (options.filterRencanaAksi) {
      reports = reports.filter(r => r.RencanaAksi === options.filterRencanaAksi);
    }
    
    // Filter Tanggal
    if (options.filterDate) {
      reports = reports.filter(r => r.Tanggal === options.filterDate);
    }

    // Pagination
    const page = options.page || 1;
    const size = options.pageSize || 10;
    const start = (page - 1) * size;
    const paginatedReports = reports.slice(start, start + size);

    return {
      stats: stats,
      list: { data: paginatedReports, total: reports.length }
    };
  } catch (err) {
    console.error('fetchDashboardDataClient error:', err);
    throw err;
  }
}"""
text = replace_func(text, 'async function fetchDashboardDataClient(spreadsheetId, userEmail, options = {})', new_fetch)
with open(client_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Filters completely synchronized safely.")
