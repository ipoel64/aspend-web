import os
import re

new_parse = '''function parseRobustDate(dateStr, timeStr) {
  if (!dateStr) return 0;
  if (!timeStr) timeStr = '00:00';
  let d = dateStr.toString().trim().toLowerCase();
  
  // Hapus nama hari bahasa Indonesia
  d = d.replace(/senin,?|selasa,?|rabu,?|kamis,?|jumat,?|jum\\'at,?|sabtu,?|minggu,?/g, '').trim();
  
  const monthsId = {
      'januari': 0, 'jan': 0,
      'februari': 1, 'feb': 1,
      'maret': 2, 'mar': 2,
      'april': 3, 'apr': 3,
      'mei': 4, 
      'juni': 5, 'jun': 5,
      'juli': 6, 'jul': 6,
      'agustus': 7, 'agu': 7,
      'september': 8, 'sep': 8,
      'oktober': 9, 'okt': 9,
      'november': 10, 'nov': 10,
      'desember': 11, 'des': 11
  };
  
  for (let m in monthsId) {
      if (d.includes(m)) {
          d = d.replace(m, ' ' + monthsId[m] + ' ');
          let p = d.trim().split(/\\s+/);
          if (p.length >= 3) {
              let day = parseInt(p[0]);
              let month = parseInt(p[1]);
              let year = parseInt(p[2]);
              let hour = parseInt(timeStr.split(':')[0]) || 0;
              let min = parseInt(timeStr.split(':')[1]) || 0;
              let res = new Date(year, month, day, hour, min, 0).getTime();
              if (!isNaN(res)) return res;
          }
          break;
      }
  }

  let parts = d.split(/[-/\\\\]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      year = parseInt(parts[0]); month = parseInt(parts[1]) - 1; day = parseInt(parts[2]);
    } else {
      day = parseInt(parts[0]); month = parseInt(parts[1]) - 1; year = parseInt(parts[2]);
      if (month > 11) { 
        let temp = day; day = month + 1; month = temp - 1; 
      }
      if (year < 100) year += 2000;
    }
    let hour = parseInt(timeStr.split(':')[0]) || 0;
    let min = parseInt(timeStr.split(':')[1]) || 0;
    let res = new Date(year, month, day, hour, min, 0).getTime();
    if (!isNaN(res)) return res;
  }
  let raw = new Date(dateStr + ' ' + timeStr).getTime();
  return isNaN(raw) ? 0 : raw;
}'''

for fname in ['script.js', 'client_services.js']:
    path = f'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/{fname}'
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Replace parseRobustDate
    text = re.sub(r'function parseRobustDate[\s\S]*?raw = new Date[\s\S]*?raw;\n}', lambda m: new_parse, text)
    
    if fname == 'script.js':
        # Replace image css with inline styles to force landscape
        text = text.replace('class="w-24 h-16 rounded object-cover border border-surface-variant"', 'class="rounded border border-surface-variant" style="width: 100px; height: 60px; object-fit: cover; flex-shrink: 0;"')
        # Also replace fallback
        text = text.replace('class="w-24 h-16 rounded bg-surface flex items-center justify-center text-on-surface-variant/30 border border-surface-variant"', 'class="rounded bg-surface flex items-center justify-center text-on-surface-variant/30 border border-surface-variant" style="width: 100px; height: 60px; flex-shrink: 0;"')
        
        # Backup replace just in case it still has w-16 h-16
        text = text.replace('class="w-16 h-16 rounded object-cover border border-surface-variant"', 'class="rounded border border-surface-variant" style="width: 100px; height: 60px; object-fit: cover; flex-shrink: 0;"')
        text = text.replace('class="w-16 h-16 rounded bg-surface flex items-center justify-center text-on-surface-variant/30 border border-surface-variant"', 'class="rounded bg-surface flex items-center justify-center text-on-surface-variant/30 border border-surface-variant" style="width: 100px; height: 60px; flex-shrink: 0;"')
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)

print('SUCCESS')
