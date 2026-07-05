import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/JavaScript.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if line.startswith('function renderDashboardTable() {'):
        start_idx = i
    elif start_idx != -1 and line.startswith('}'):
        # Found the end of the function (assuming it's unindented)
        if 'renderDashboardTable' not in ''.join(lines[start_idx:i]):
            pass # just a check
        end_idx = i
        break

new_func = """function renderDashboardTable() {
  var container = document.getElementById('reports-list-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (state.reports.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-on-surface-variant w-full"><span class="material-symbols-outlined text-4xl block mb-2 opacity-50">drafts</span>Belum ada data laporan.</div>';
    document.getElementById('pagination-info').textContent = 'Menampilkan 0 dari 0 laporan';
    document.getElementById('pagination-pages').innerHTML = '';
    return;
  }
  
  // Sort descending by created at or date
  var sortedReports = [...state.reports].sort(function(a, b) {
    var dateA = new Date(a.Tanggal + (a.Pukul && a.Pukul !== '-' ? 'T' + a.Pukul : 'T00:00:00'));
    var dateB = new Date(b.Tanggal + (b.Pukul && b.Pukul !== '-' ? 'T' + b.Pukul : 'T00:00:00'));
    if (isNaN(dateA)) dateA = new Date(a.CreatedAt || 0);
    if (isNaN(dateB)) dateB = new Date(b.CreatedAt || 0);
    return dateB - dateA;
  });
  
  var tableHtml = `
    <div class="overflow-x-auto w-full bg-white rounded-xl border border-surface-variant shadow-sm">
      <table class="w-full text-sm text-left text-on-background">
        <thead class="text-[11px] uppercase bg-surface-container-low text-on-surface-variant border-b border-outline-variant/30 font-bold tracking-wider">
          <tr>
            <th scope="col" class="px-4 py-4 whitespace-nowrap w-36">Waktu & Tanggal</th>
            <th scope="col" class="px-4 py-4 text-center w-20">Foto</th>
            <th scope="col" class="px-4 py-4 min-w-[280px]">Laporan Kegiatan</th>
            <th scope="col" class="px-4 py-4 min-w-[160px]">Lokasi</th>
            <th scope="col" class="px-4 py-4 text-center w-28">Status</th>
            <th scope="col" class="px-4 py-4 text-center w-32">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-outline-variant/20">
  `;
  
  sortedReports.forEach(function(r) {
    // Tanggal & Jam
    var dateObj = r.Tanggal ? new Date(r.Tanggal) : null;
    var dateStr = dateObj ? formatDateIndo(dateObj) : '-';
    var timeStr = (r.Pukul && r.Pukul !== '-') ? r.Pukul + ' WIB' : '';
    
    // Foto dari array FotoIds (Kolom ke 12)
    var photoHtml = '<span class="text-[10px] text-on-surface-variant italic block py-2">Tidak Ada</span>';
    var thumbId = (r.FotoIds && r.FotoIds.length > 0) ? r.FotoIds[0] : null;
    if (thumbId) {
      var photoUrl = 'https://drive.google.com/uc?export=view&id=' + thumbId;
      photoHtml = `<img src="${photoUrl}" class="w-12 h-12 mx-auto rounded-lg object-cover border border-outline-variant/40 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" onclick="window.open('${photoUrl}', '_blank')" alt="Foto">`;
    }
    
    // Status
    var statusClass = 'bg-surface-variant text-on-surface-variant';
    if (r.Status === 'Selesai') {
      statusClass = 'bg-secondary-fixed/30 text-secondary-dark';
    }
    
    // Aksi
    var actionButtons = '';
    if (r.Status === 'Draft') {
      actionButtons = `
        <div class="flex items-center justify-center gap-1">
          <button class="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded bg-surface hover:bg-surface-container" onclick="editReportDraft('${r.ReportId}')" title="Edit Draft"><span class="material-symbols-outlined text-[20px]">edit</span></button>
          <button class="text-error/70 hover:text-error transition-colors p-1.5 rounded bg-surface hover:bg-error/10" onclick="deleteReportLog('${r.ReportId}')" title="Hapus"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </div>
      `;
    } else {
      var downloadBtn = r.PdfFileId ? 
        `<button class="text-primary hover:text-primary-dark transition-colors p-1.5 rounded bg-primary/10 hover:bg-primary/20" onclick="window.open('https://drive.google.com/file/d/${r.PdfFileId}/view', '_blank')" title="Buka PDF"><span class="material-symbols-outlined text-[20px]">visibility</span></button>` : 
        `<button class="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded bg-surface hover:bg-surface-container" onclick="reprintPdf('${r.ReportId}')" title="Cetak PDF"><span class="material-symbols-outlined text-[20px]">print</span></button>`;
      
      actionButtons = `
        <div class="flex items-center justify-center gap-1">
          ${downloadBtn}
          <button class="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded bg-surface hover:bg-surface-container" onclick="editReportDraft('${r.ReportId}')" title="Edit"><span class="material-symbols-outlined text-[20px]">edit</span></button>
          <button class="text-error/70 hover:text-error transition-colors p-1.5 rounded bg-surface hover:bg-error/10" onclick="deleteReportLog('${r.ReportId}')" title="Hapus"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </div>
      `;
    }
    
    var rhkText = escapeHtml(r.JenisRHK || 'RHK Umum');
    var aksiText = escapeHtml(r.RencanaAksi || '—');
    var lokasiText = escapeHtml(r.Lokasi || '—');
    
    tableHtml += `
      <tr class="hover:bg-primary-fixed/20 transition-colors bg-white group">
        <td class="px-4 py-4 align-top">
          <div class="font-medium text-xs sm:text-sm text-on-surface whitespace-nowrap">${dateStr}</div>
          <div class="text-[11px] text-primary font-bold mt-1 bg-primary/10 inline-block px-1.5 py-0.5 rounded">${timeStr}</div>
        </td>
        <td class="px-4 py-4 align-top text-center">
          ${photoHtml}
        </td>
        <td class="px-4 py-4 align-top">
          <div class="font-bold text-primary font-body-lg text-sm mb-1.5 line-clamp-2 leading-snug">${rhkText}</div>
          <div class="text-on-surface-variant text-xs leading-relaxed line-clamp-3">${aksiText}</div>
        </td>
        <td class="px-4 py-4 align-top">
          <div class="flex items-start gap-1.5 text-xs text-on-surface-variant bg-surface px-2 py-1.5 rounded-md">
            <span class="material-symbols-outlined text-[14px] mt-0.5 text-on-surface-variant/70">location_on</span>
            <span class="line-clamp-3 leading-relaxed">${lokasiText}</span>
          </div>
        </td>
        <td class="px-4 py-4 align-top text-center">
          <span class="badge ${statusClass} px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-block">${escapeHtml(r.Status)}</span>
        </td>
        <td class="px-4 py-4 align-top">
          ${actionButtons}
        </td>
      </tr>
    `;
  });
  
  tableHtml += `
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = tableHtml;
}
"""

if start_idx != -1 and end_idx != -1:
    lines = lines[:start_idx] + [new_func] + lines[end_idx+1:]
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Done writing UI changes!")
else:
    print("Error: Could not find function boundaries.")
