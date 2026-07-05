import re

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update saveAndGeneratePDF
new_save_pdf = """async function saveAndGeneratePDF() {
  var narrativeText = document.getElementById('textarea-narasi').value;
  if (!narrativeText) {
    showToast('Konten narasi kosong!', 'error');
    return;
  }

  showLoading('Menyimpan laporan & Mencetak PDF...');

  try {
    let ssId = localStorage.getItem('aspend_spreadsheetId');
    if (!ssId) throw new Error("Spreadsheet ID belum siap.");

    await saveEditedNarrativeClient(ssId, state.currentReportId, narrativeText);
    
    // Temukan data laporan di memori lokal
    let report = state.reports.find(r => r.ReportId === state.currentReportId);
    if (report) {
      report.Uraian = narrativeText; // Update dengan yang terbaru
      
      // IKLAN MOCK: Periksa apakah sudah cetak 5 kali
      let pdfCount = parseInt(localStorage.getItem('aspend_pdf_count') || '0');
      pdfCount++;
      localStorage.setItem('aspend_pdf_count', pdfCount);
      
      let isPremium = localStorage.getItem('aspend_is_premium') === 'true';
      if (!isPremium && pdfCount % 5 === 0) {
        showAdModal(() => {
          generateClientPDF(report, state.user);
        });
      } else {
        generateClientPDF(report, state.user);
      }
    } else {
      showToast('Data Laporan tidak ditemukan untuk dicetak.', 'error');
    }

    // Reset form cache
    state.currentReportId = null;
    document.getElementById('modal-ai-result').classList.add('hidden');
    
    // Refresh dasbor
    loadDashboardData();
  } catch (err) {
    hideLoading();
    showToast('Gagal memproses laporan: ' + err.message, 'error');
  }
}"""

old_save_pdf_match = re.search(r'async function saveAndGeneratePDF\(\)\s*\{.*?loadDashboardData\(\);\s*\}\s*catch\s*\(err\)\s*\{.*?\}\s*\}', content, re.DOTALL)
if old_save_pdf_match:
    content = content.replace(old_save_pdf_match.group(0), new_save_pdf)


# 2. Update reprintPdf
new_reprint = """function reprintPdf(reportId) {
  let report = state.reports.find(r => r.ReportId === reportId);
  if (!report) {
    showToast('Laporan tidak ditemukan.', 'error');
    return;
  }
  
  // IKLAN MOCK
  let pdfCount = parseInt(localStorage.getItem('aspend_pdf_count') || '0');
  pdfCount++;
  localStorage.setItem('aspend_pdf_count', pdfCount);
  
  let isPremium = localStorage.getItem('aspend_is_premium') === 'true';
  if (!isPremium && pdfCount % 5 === 0) {
    showAdModal(() => {
      generateClientPDF(report, state.user);
    });
  } else {
    generateClientPDF(report, state.user);
  }
}"""

old_reprint_match = re.search(r'function reprintPdf\(reportId\)\s*\{.*?\}\s*\}', content, re.DOTALL)
if old_reprint_match:
    content = content.replace(old_reprint_match.group(0), new_reprint)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("PDF functions updated successfully.")
