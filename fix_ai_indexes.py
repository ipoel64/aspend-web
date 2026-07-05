import os
import re

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

new_functions = """
async function generateNarrativeClient(spreadsheetId, reportId) {
  try {
    // 1. Ambil API key dari Sheet Config
    const configRes = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Config!A:B'
    });
    
    let geminiKey = '';
    if (configRes.result.values) {
      const apiRow = configRes.result.values.find(r => r[0] === 'GEMINI_API_KEY');
      if (apiRow) geminiKey = apiRow[1];
    }
    if (!geminiKey) throw new Error("Gemini API Key belum dikonfigurasi.");
    
    // 2. Ambil data spesifik dari Laporan
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Laporan_Log!A:O'
    });
    
    const rows = response.result.values || [];
    const reportRow = rows.find(r => r[0] === reportId);
    if (!reportRow) throw new Error("Data laporan belum masuk ke database.");
    
    // Rangkum informasi laporan (Murni 15 Kolom Mobile)
    const prompt = `Buatkan narasi laporan Rencana Hasil Kerja (RHK) formal Kementerian Sosial RI.
    
Jenis Kegiatan: ${reportRow[2]}
Rencana Aksi: ${reportRow[4]}
Tanggal: ${reportRow[1]}
Lokasi: ${reportRow[13]}
Poin Laporan: ${reportRow[6]}

Buat narasi 2 paragraf yang profesional. Jangan gunakan formatting markdown (tanpa bintang atau tebal), karena teks ini akan disisipkan ke dalam format cetak PDF.`;

    // 3. Panggil Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
    const aiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    const resJson = await aiResponse.json();
    if (resJson.candidates && resJson.candidates[0].content.parts[0].text) {
      const narasi = resJson.candidates[0].content.parts[0].text;
      
      // Simpan narasi ke Sheet (Kolom H = NarasiAI)
      const rowIndex = rows.findIndex(r => r[0] === reportId) + 1; // 1-based index
      if (rowIndex > 0) {
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId,
          range: `Laporan_Log!H${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [[narasi]] }
        });
      }
      return narasi;
    }
    return "Gagal menghasilkan narasi dari AI.";
  } catch(err) {
    console.error("Gemini API Error:", err);
    throw err;
  }
}

/**
 * Menyimpan narasi akhir yang telah diedit manual ke Google Sheets (Client-side)
 */
async function saveEditedNarrativeClient(spreadsheetId, reportId, editedText) {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Laporan_Log!A:O'
    });
    const rows = response.result.values || [];
    const rowIndex = rows.findIndex(r => r[0] === reportId) + 1;
    
    if (rowIndex > 0) {
      // Simpan narasiEdited (Kolom I) dan Status "Selesai" (Kolom J)
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `Laporan_Log!I${rowIndex}:J${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[editedText, 'Selesai']] }
      });
      return true;
    }
    return false;
  } catch(err) {
    console.error("Gagal menyimpan narasi:", err);
    throw err;
  }
}
"""

content = re.sub(r'async function generateNarrativeClient.*?\}\n\}', new_functions, content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done writing!")
