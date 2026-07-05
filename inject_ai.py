import re

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

new_narrative = """async function generateNarrativeClient(spreadsheetId, reportId) {
  try {
    // 1. API Key OpenRouter Ditanam Secara Permanen (Hardcoded)
    const OPENROUTER_API_KEY = "sk-or-v1-xxxxxxxxxxxxxxxxx"; // <- Kunci API tersimpan di sini
    
    // 2. Ambil data spesifik dari Laporan
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Laporan_Log!A:O'
    });
    
    const rows = response.result.values || [];
    const reportRow = rows.find(r => r[0] === reportId);
    if (!reportRow) throw new Error("Data laporan belum masuk ke database.");
    
    // 3. Format Prompt Khusus (Ketentuan Teks Ketat)
    // Poin 1: Tanggal di-format, Poin 2: Dasar Hukum -> Dasar
    const prompt = `Buatkan narasi laporan kegiatan dengan aturan SANGAT KETAT:
1. JANGAN gunakan teks pengantar apa pun (langsung isinya).
2. Format tanggal sesuai nama hari (contoh: Jumat, 3 Juli 2026).
3. Gunakan sub-judul numerik (1., 2., 3.).
4. Judul poin referensi gunakan kata "Dasar" (bukan Dasar Hukum).
5. Sejajarkan bullet point dengan rapi menggunakan strip (-) jika ada rincian.

Data Kegiatan:
- Jenis Kegiatan: ${reportRow[2]}
- Rencana Aksi: ${reportRow[4]}
- Tanggal: ${reportRow[1]}
- Lokasi: ${reportRow[13]}
- Poin Uraian: ${reportRow[6]}`;

    // 4. Pilih Model dari Pengaturan (Gemini / Llama)
    let aiModel = localStorage.getItem('aspend_ai_model') || 'google/gemini-flash-1.5';

    // 5. Panggil OpenRouter API
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://aspend-web.app',
        'X-Title': 'ASPEND Web'
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const resJson = await aiResponse.json();
    if (resJson.choices && resJson.choices[0].message.content) {
      let narasi = resJson.choices[0].message.content.trim();
      
      // Simpan narasi ke Sheet (Kolom H = NarasiAI)
      const rowIndex = rows.findIndex(r => r[0] === reportId) + 1;
      if (rowIndex > 0) {
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId,
          range: `Laporan_Log!H${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [[narasi]] }
        });
      }
      return narasi;
    } else {
      throw new Error("Gagal mendapatkan respon dari AI.");
    }
  } catch (err) {
    console.error("AI Error:", err);
    throw err;
  }
}"""

old_match = re.search(r'async function generateNarrativeClient.*?return narasi;\s*\}\s*else\s*\{.*?\n  \}\s*catch\s*\(err\)\s*\{.*?\n  \}\n\}', content, re.DOTALL)
if not old_match:
    # Coba penangkapan reguler ekspresi yang lebih longgar
    old_match = re.search(r'async function generateNarrativeClient\(.*?^\}', content, re.DOTALL | re.MULTILINE)

if old_match:
    content = content.replace(old_match.group(0), new_narrative)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OpenRouter AI injected successfully.")
else:
    print("Failed to find generateNarrativeClient in client_services.js")
