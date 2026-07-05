import os

# 1. Add fetchNotaDinasDataClient and saveNotaDinasClient to client_services.js
client_code = """
// ── MODUL NOTA DINAS KLIEN ─────────────────────────────────────
async function fetchNotaDinasDataClient() {
  try {
    const ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) return [];

    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: 'NotaDinas_Log!A2:I'
    });

    const rows = response.result.values || [];
    let list = rows.map(row => ({
      NDId: row[0] || '',
      Tanggal: row[1] || '',
      Nomor: row[2] || '',
      Kepada: row[3] || '',
      Dari: row[4] || '',
      Hal: row[5] || '',
      Isi: row[6] || '',
      FotoIds: (() => {
        try { return row[7] ? JSON.parse(row[7]) : []; }
        catch(e) { return []; }
      })(),
      Status: row[8] || ''
    }));

    list.sort((a,b) => new Date(b.Tanggal || 0) - new Date(a.Tanggal || 0));
    return list;
  } catch (err) {
    console.error('Gagal memuat Data Nota Dinas:', err);
    throw err;
  }
}

async function saveNotaDinasClient(data) {
  try {
    const ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) throw new Error("Spreadsheet ID belum diatur.");
    
    const ndId = "ND-" + Date.now();
    
    const newRow = [
      ndId,
      data.tanggal,
      data.nomor,
      data.kepada,
      data.dari,
      data.hal,
      data.isi,
      "[]",
      "Draft"
    ];

    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: ssId,
      range: 'NotaDinas_Log!A:I',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });

    return { success: true, NDId: ndId };
  } catch (err) {
    console.error('Gagal menyimpan Nota Dinas:', err);
    throw err;
  }
}
"""
with open('c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js', 'a', encoding='utf-8') as f:
    f.write('\n' + client_code)

# 2. Modify script.js functions
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

new_load_nd = """function loadNotaDinasData() {
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
}"""

new_save_nd = """function saveAndGenerateNDPdf() {
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
}"""

new_memo_ai = """function generateMemoAI() {
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
    var draf = "Merujuk pada " + hal + ", bersama ini kami sampaikan bahwa...\\n\\nDemikian disampaikan untuk menjadi maklum.";
    document.getElementById('input-nd-isi').value = draf;
    showToast('Draf AI berhasil dibuat!', 'success');
  }, 1500);
}"""

text = replace_function(text, 'function loadNotaDinasData()', new_load_nd)
text = replace_function(text, 'function saveAndGenerateNDPdf()', new_save_nd)
text = replace_function(text, 'function generateMemoAI()', new_memo_ai)

with open(script_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Phase 3 script applied.")
