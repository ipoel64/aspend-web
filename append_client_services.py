code = """
/**
 * Memanggil Gemini API langsung dari Browser
 */
async function generateNarrativeClient(spreadsheetId, reportId) {
  try {
    const geminiKey = localStorage.getItem('aspend_gemini_key') || '';
    if (!geminiKey) {
      return "MEMO DINAS (MOCK)\\n\\nHarap setel API Key Gemini terlebih dahulu melalui menu Pengaturan Admin agar AI dapat menyusun laporan secara otomatis.";
    }
    
    // 2. Ambil data spesifik dari Laporan
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Laporan_Log!A:Q'
    });
    
    const rows = response.result.values || [];
    const reportRow = rows.find(r => r[0] === reportId);
    if (!reportRow) throw new Error("Data laporan belum masuk ke database.");
    
    // Rangkum informasi laporan
    const prompt = `Buatkan narasi laporan Rencana Hasil Kerja (RHK) formal Kementerian Sosial RI.
    
Jenis Kegiatan: ${reportRow[3]}
Rencana Aksi: ${reportRow[5]}
Tanggal: ${reportRow[2]}
Lokasi: ${reportRow[6]}
Poin Laporan: ${reportRow[7]}

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
      
      // Simpan narasi ke Sheet
      const rowIndex = rows.findIndex(r => r[0] === reportId) + 1; // 1-based index
      if (rowIndex > 0) {
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId,
          range: `Laporan_Log!I${rowIndex}`,
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
 * Menyimpan Narasi Akhir dan Mengubah Status Laporan menjadi Selesai
 */
async function saveEditedNarrativeClient(spreadsheetId, reportId, narrativeText) {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Laporan_Log!A:Q'
    });
    
    const rows = response.result.values || [];
    const rowIndex = rows.findIndex(r => r[0] === reportId) + 1;
    if (rowIndex === 0) throw new Error("Laporan tidak ditemukan di database.");
    
    // Update NarasiEdited (Kolom J) dan Status (Kolom K)
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `Laporan_Log!J${rowIndex}:K${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[narrativeText, 'Selesai']] }
    });
    
    return { success: true };
  } catch(err) {
    console.error("Gagal menyimpan narasi:", err);
    throw err;
  }
}
"""

with open('c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js', 'a', encoding='utf-8') as f:
    f.write(code)
