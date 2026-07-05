import re

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

new_render_dashboard = """function renderDashboardTable() {
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
    <div class="overflow-x-auto w-full bg-white rounded-xl border border-surface-variant shadow-sm">
      <table class="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr class="bg-surface/50 text-xs text-on-surface-variant/70 uppercase tracking-wider border-b border-surface-variant">
            <th class="px-4 py-3 font-semibold whitespace-nowrap">Waktu & Tanggal</th>
            <th class="px-4 py-3 font-semibold text-center w-20">Foto</th>
            <th class="px-4 py-3 font-semibold">Laporan Kegiatan</th>
            <th class="px-4 py-3 font-semibold text-center w-24">Aksi</th>
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
      // Format Tanggal ke "Jumat, 3 Juli 2026"
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
            <td colspan="4" class="px-4 py-2">
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
        // Menggunakan format thumbnail resmi dari Drive agar tidak diblokir browser (CORB/CORS)
        let thumbUrl = `https://drive.google.com/thumbnail?id=${photos[0]}&sz=w200-h200`;
        let fullUrl = `https://drive.google.com/uc?id=${photos[0]}&export=view`;
        photoHtml = `<img src="${thumbUrl}" class="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 border border-surface-variant" onclick="window.open('${fullUrl}', '_blank')" alt="Foto" onerror="this.src='${fullUrl}'; this.onerror=null;">`;
      } else {
        photoHtml = `<div class="w-10 h-10 rounded bg-surface flex items-center justify-center text-on-surface-variant/30 border border-surface-variant"><span class="material-symbols-outlined text-[20px]">hide_image</span></div>`;
      }
      
      // Membuang Lokasi & Status, Menyisipkan (RHK-1) ke Judul
      // Ekstrak angka dari JenisRHK ("RHK 1" -> "1")
      var angkaRHK = (r.JenisRHK || '').replace(/\D/g, '') || '?';
      var judulHTML = `<div class="font-bold text-on-surface mb-1">(RHK-${angkaRHK}) ${r.RencanaAksi || '-'}</div>`;
      var uraianHTML = r.Uraian ? `<div class="text-xs text-on-surface-variant mt-1 line-clamp-2">${r.Uraian}</div>` : '';

      tableHtml += `
        <tr class="hover:bg-surface-container-lowest transition-colors group">
          <td class="px-4 py-3 align-top whitespace-nowrap">
            <div class="font-medium text-on-surface">${formattedDate}</div>
            <div class="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
              <span class="material-symbols-outlined text-[12px]">schedule</span>
              ${r.Pukul} WIB
            </div>
          </td>
          <td class="px-4 py-3 align-top text-center">${photoHtml}</td>
          <td class="px-4 py-3 align-top">
            ${judulHTML}
            <div class="text-[11px] text-primary/80 font-medium mb-1">
              <span class="material-symbols-outlined text-[10px] inline-block align-middle mr-0.5">adjust</span>
              ${r.PoinKegiatan || '-'}
            </div>
            ${uraianHTML}
          </td>
          <td class="px-4 py-3 align-top text-center">
            <div class="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="text-on-surface-variant hover:text-primary transition-colors p-1 rounded hover:bg-primary/10" onclick="editReportDraft('${r.ReportId}')" title="Edit Data">
                <span class="material-symbols-outlined text-[20px]">edit</span>
              </button>
              <button class="text-on-surface-variant hover:text-error transition-colors p-1 rounded hover:bg-error/10" onclick="deleteReportLog('${r.ReportId}')" title="Hapus Data">
                <span class="material-symbols-outlined text-[20px]">delete</span>
              </button>
              <button class="text-on-surface-variant hover:text-primary transition-colors p-1 rounded hover:bg-primary/10" onclick="reprintPdf('${r.ReportId}')" title="Unduh PDF">
                <span class="material-symbols-outlined text-[20px]">download</span>
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
}"""

old_match = re.search(r'function renderDashboardTable\(\)\s*\{.*?container\.innerHTML = tableHtml;\n\}', content, re.DOTALL)
if old_match:
    content = content.replace(old_match.group(0), new_render_dashboard)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Dashboard table rendering updated.")
else:
    print("Could not find renderDashboardTable.")
