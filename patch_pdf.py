import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. RESTORE PAGINATION LOGIC
old_table_end = '''  container.innerHTML = tableHtml;
}'''

new_table_end = '''  container.innerHTML = tableHtml;

  // Pulihkan logika update teks pagination yang hilang
  let paginationInfo = document.getElementById('pagination-info');
  if (paginationInfo) {
    paginationInfo.textContent = `Menampilkan ${state.reports.length} dari ${state.totalReports || state.reports.length} laporan`;
  }
}'''
text = text.replace(old_table_end, new_table_end)

# 2. FIX PDF PREVIEW TO USE GOOGLE DRIVE FILE IF EXISTS
old_preview_core = '''  try {
    // Generate DataURL instead of downloading
    const dataUrl = await generateClientPDF(report, state.user, false, 'dataUrl');
    
    hideLoading(); // Matikan loading utama yang dipicu oleh generateClientPDF
    
    if (placeholder) placeholder.style.display = 'none';
    if (iframe) {
      iframe.src = dataUrl;
      iframe.classList.remove('hidden');
    }
  } catch (err) {'''

new_preview_core = '''  try {
    if (report.PdfFileId && report.PdfFileId.length > 5) {
      // Jika file sudah ada di Google Drive, tampilkan dari sana!
      let driveUrl = `https://drive.google.com/file/d/${report.PdfFileId}/preview`;
      if (placeholder) placeholder.style.display = 'none';
      if (iframe) {
        iframe.src = driveUrl;
        iframe.classList.remove('hidden');
      }
    } else {
      // Generate DataURL dari awal (Fallback)
      const dataUrl = await generateClientPDF(report, state.user, false, 'dataUrl');
      
      hideLoading(); // Matikan loading utama
      
      if (placeholder) placeholder.style.display = 'none';
      if (iframe) {
        iframe.src = dataUrl;
        iframe.classList.remove('hidden');
      }
    }
  } catch (err) {'''
text = text.replace(old_preview_core, new_preview_core)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Pagination restored and PDF Preview mapped to Google Drive!')
