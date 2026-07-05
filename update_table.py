import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
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

new_render = """function renderDashboardTable() {
  var container = document.getElementById('reports-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (!state.reports || state.reports.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-12 text-center border-t border-surface-variant">
        <span class="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">drafts</span>
        <p class="text-on-surface-variant/70 text-sm">Belum ada data laporan.</p>
      </div>
    `;
    return;
  }

  var tableHtml = `
    <div class="w-full bg-white border-0 shadow-none">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-surface-bright text-[10px] text-on-surface-variant/70 uppercase tracking-wider border-b border-surface-variant">
            <th class="px-3 py-2 font-semibold text-center w-20">Foto</th>
            <th class="px-3 py-2 font-semibold whitespace-nowrap">Waktu, Tanggal & Lokasi</th>
            <th class="px-3 py-2 font-semibold">RHK & Rencana Aksi</th>
            <th class="px-3 py-2 font-semibold text-center w-24">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-variant text-sm">
  `;

  // Sort descending by created at or date
  var sortedReports = [...state.reports].sort(function(a, b) {
    var dateA = new Date(a.Tanggal + (a.Pukul && a.Pukul !== '-' ? 'T' + a.Pukul : 'T00:00:00'));
    var dateB = new Date(b.Tanggal + (b.Pukul && b.Pukul !== '-' ? 'T' + b.Pukul : 'T00:00:00'));
    return dateB - dateA;
  });

  let lastDateGroup = null;

  sortedReports.forEach(function(r) {
      let formattedDate = r.Tanggal;
      let dateObj = new Date(r.Tanggal);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = new Intl.DateTimeFormat('id-ID', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        }).format(dateObj);
      }

      // Timeline Divider Logic
      if (formattedDate !== lastDateGroup) {
        lastDateGroup = formattedDate;
        tableHtml += `
          <tr class="bg-surface-container-lowest">
            <td colspan="4" class="px-3 py-2">
              <div class="flex items-center gap-3">
                <div class="h-px bg-outline-variant flex-grow"></div>
                <span class="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded">${formattedDate}</span>
                <div class="h-px bg-outline-variant flex-grow"></div>
              </div>
            </td>
          </tr>
        `;
      }

      // Photo rendering (MENGGUNAKAN THUMBNAIL GOOGLE DRIVE)
      var photos = r.FotoIds;
      if (typeof photos === 'string') {
        try { photos = JSON.parse(photos); } catch(e) {}
      }
      var photoHtml = '';
      if (Array.isArray(photos) && photos.length > 0) {
        let thumbUrl = `https://drive.google.com/thumbnail?id=${photos[0]}&sz=w400-h400`;
        let fullUrl = `https://drive.google.com/uc?id=${photos[0]}&export=view`;
        // Foto dibuat agak besar (w-16 h-16)
        photoHtml = `<img src="${thumbUrl}" class="w-16 h-16 rounded object-cover border border-surface-variant" alt="Foto" onerror="this.src='${fullUrl}'; this.onerror=null;">`;
      } else {
        photoHtml = `<div class="w-16 h-16 rounded bg-surface flex items-center justify-center text-on-surface-variant/30 border border-surface-variant"><span class="material-symbols-outlined text-[24px]">hide_image</span></div>`;
      }
      
      // Judul RHK
      var idText = r.IdRHK || r.JenisRHK || '';
      var angkaRHK = idText.replace(/\D/g, '') || '?';
      var judulHTML = `<div class="font-bold text-on-surface mb-0.5 text-sm leading-tight">(RHK-${angkaRHK}) ${r.RencanaAksi || '-'}</div>`;

      // Lokasi & Tanggal
      var lokasiHtml = r.Lokasi ? `<div class="text-[11px] text-on-surface-variant/80 mt-1 line-clamp-2 leading-tight flex items-start gap-0.5"><span class="material-symbols-outlined text-[12px] mt-0.5">location_on</span>${escapeHtml(r.Lokasi)}</div>` : '';

      tableHtml += `
        <tr class="hover:bg-primary/5 transition-colors group cursor-pointer" onclick="previewPdf('${r.ReportId}')">
          <td class="px-3 py-3 align-top text-center" onclick="event.stopPropagation(); window.open('https://drive.google.com/uc?id=${(Array.isArray(photos)&&photos.length>0)?photos[0]:''}&export=view', '_blank')">
            ${photoHtml}
          </td>
          <td class="px-3 py-3 align-top whitespace-normal min-w-[120px]">
            <div class="font-medium text-xs text-on-surface">${formattedDate}</div>
            <div class="text-[11px] text-primary font-bold mt-1 bg-primary/10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded">
              <span class="material-symbols-outlined text-[11px]">schedule</span>
              ${r.Pukul} WIB
            </div>
            ${lokasiHtml}
          </td>
          <td class="px-3 py-3 align-top min-w-[150px]">
            ${judulHTML}
            <div class="text-[10px] text-primary/80 font-medium leading-tight">
              <span class="material-symbols-outlined text-[10px] inline-block align-middle mr-0.5">adjust</span>
              ${r.PoinKegiatan || '-'}
            </div>
          </td>
          <td class="px-3 py-3 align-top text-center" onclick="event.stopPropagation()">
            <div class="flex items-center justify-center gap-1 flex-wrap">
              <button class="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded bg-surface border border-surface-variant hover:border-primary/50 shadow-sm" onclick="editReportDraft('${r.ReportId}')" title="Edit Data">
                <span class="material-symbols-outlined text-[16px]">edit</span>
              </button>
              <button class="text-error/70 hover:text-error transition-colors p-1.5 rounded bg-surface border border-surface-variant hover:border-error/50 shadow-sm" onclick="deleteReportLog('${r.ReportId}')" title="Hapus Data">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
              <button class="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded bg-surface border border-surface-variant hover:border-primary/50 shadow-sm" onclick="reprintPdf('${r.ReportId}')" title="Unduh PDF">
                <span class="material-symbols-outlined text-[16px]">download</span>
              </button>
            </div>
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

// FUNGSI PREVIEW PDF BARU
async function previewPdf(reportId) {
  let report = state.reports.find(r => r.ReportId === reportId);
  if (!report) return;

  var pane = document.getElementById('pdf-preview-pane');
  var placeholder = document.getElementById('pdf-placeholder');
  var iframe = document.getElementById('pdf-frame');
  
  if (pane) pane.classList.remove('hidden');
  if (placeholder) placeholder.innerHTML = '<span class="material-symbols-outlined text-4xl text-primary animate-spin mb-3 block">progress_activity</span><p class="font-body-sm text-body-sm text-on-surface-variant">Menyusun pratinjau PDF...</p>';
  if (iframe) iframe.classList.add('hidden');

  try {
    // Generate DataURL instead of downloading
    const dataUrl = await generateClientPDF(report, state.user, false, 'dataUrl');
    
    if (placeholder) placeholder.style.display = 'none';
    if (iframe) {
      iframe.src = dataUrl;
      iframe.classList.remove('hidden');
    }
  } catch (err) {
    if (placeholder) placeholder.innerHTML = '<span class="material-symbols-outlined text-4xl text-error mb-3 block">error</span><p class="font-body-sm text-body-sm text-error">Gagal memuat pratinjau PDF.</p>';
    console.error('Preview Error:', err);
  }
}
"""

text = replace_func(text, 'function renderDashboardTable()', new_render)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Table successfully minified and Preview Engine embedded!')
