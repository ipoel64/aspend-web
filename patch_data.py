import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. FIX SORTING LOGIC
old_sort = '''  var sortedReports = [...state.reports].sort(function(a, b) {
    var dateA = new Date(a.Tanggal + (a.Pukul && a.Pukul !== '-' ? 'T' + a.Pukul : 'T00:00:00'));
    var dateB = new Date(b.Tanggal + (b.Pukul && b.Pukul !== '-' ? 'T' + b.Pukul : 'T00:00:00'));
    return dateB - dateA;
  });'''

new_sort = '''  var sortedReports = [...state.reports].sort(function(a, b) {
    // Bersihkan format jam dari spasi ekstra atau tulisan WIB
    var pukulA = (a.Pukul && a.Pukul !== '-') ? a.Pukul.toString().trim().substring(0,5) : '00:00';
    var pukulB = (b.Pukul && b.Pukul !== '-') ? b.Pukul.toString().trim().substring(0,5) : '00:00';
    
    var dateA = new Date(a.Tanggal + 'T' + pukulA);
    var dateB = new Date(b.Tanggal + 'T' + pukulB);
    
    // Fallback jika Tanggal gagal di-parse oleh Date()
    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
      var strA = String(a.Tanggal) + ' ' + pukulA;
      var strB = String(b.Tanggal) + ' ' + pukulB;
      return strB.localeCompare(strA);
    }
    return dateB - dateA;
  });'''
text = text.replace(old_sort, new_sort)

# 2. FIX PREVIEW PDF IDENTITY (String vs Integer coercion)
old_preview = '''async function previewPdf(reportId) {
  let report = state.reports.find(r => r.ReportId === reportId);
  if (!report) return;'''
  
new_preview = '''async function previewPdf(reportId) {
  let report = state.reports.find(r => String(r.ReportId) === String(reportId));
  if (!report) {
    console.error('Report not found for ID:', reportId);
    return;
  }'''
text = text.replace(old_preview, new_preview)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Sorting and ID Coercion patched!')
