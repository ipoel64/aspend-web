import os
import re
import time

def patch_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    robust_parser = '''function extractDriveId(str) {
  if (!str) return '';
  let match = str.match(/[-\\w]{25,}/);
  return match ? match[0] : str;
}

function parseRobustDate(dateStr, timeStr) {
  if (!dateStr) return 0;
  let d = dateStr.toString().trim().toLowerCase();
  
  // Hapus nama hari bahasa Indonesia
  d = d.replace(/senin,?|selasa,?|rabu,?|kamis,?|jumat,?|jum\\'at,?|sabtu,?|minggu,?/g, '').trim();
  
  const monthsId = {
      'januari': '01', 'jan': '01',
      'februari': '02', 'feb': '02',
      'maret': '03', 'mar': '03',
      'april': '04', 'apr': '04',
      'mei': '05', 
      'juni': '06', 'jun': '06',
      'juli': '07', 'jul': '07',
      'agustus': '08', 'agu': '08',
      'september': '09', 'sep': '09',
      'oktober': '10', 'okt': '10',
      'november': '11', 'nov': '11',
      'desember': '12', 'des': '12'
  };
  
  for (let m in monthsId) {
      if (d.includes(m)) {
          d = d.replace(m, ' ' + monthsId[m] + ' ');
          let p = d.trim().split(/\\s+/);
          if (p.length === 3) {
              let day = p[0].padStart(2, '0');
              let month = p[1];
              let year = p[2];
              let iso = `${year}-${month}-${day}T${timeStr}:00`;
              let res = new Date(iso).getTime();
              if (!isNaN(res)) return res;
          }
          break;
      }
  }

  let parts = d.split(/[-/\\\\]/);
  let year, month, day;
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      year = parts[0]; month = parts[1]; day = parts[2];
    } else {
      day = parts[0]; month = parts[1]; year = parts[2];
      if (parseInt(month) > 12) { 
        day = parts[1]; month = parts[0]; 
      }
      if (year.length === 2) year = '20' + year;
    }
    month = month.padStart(2, '0');
    day = day.padStart(2, '0');
    let iso = `${year}-${month}-${day}T${timeStr}:00`;
    let res = new Date(iso).getTime();
    if (!isNaN(res)) return res;
  }
  let raw = new Date(dateStr + ' ' + timeStr).getTime();
  return isNaN(raw) ? 0 : raw;
}
'''

    # Hapus parseRobustDate yang lama dan masukkan yang baru
    text = re.sub(r'function parseRobustDate[\s\S]*?raw = new Date[\s\S]*?raw;\n}', '', text)
    if 'function extractDriveId' not in text:
        text = robust_parser + text

    # Khusus untuk client_services.js, perbaiki parsing FotoIds
    if 'client_services.js' in path:
        old_foto = '''FotoIds: (() => {
        try { return row[11] ? JSON.parse(row[11]) : []; } 
        catch(e) { return []; } 
      })(),'''
        new_foto = '''FotoIds: (() => {
        let val = row[11];
        if (!val) return [];
        try { 
            let parsed = JSON.parse(val); 
            if (Array.isArray(parsed)) return parsed.map(extractDriveId);
        } catch(e) {} 
        return [extractDriveId(val)];
      })(),'''
        text = text.replace(old_foto, new_foto)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)

patch_file('c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js')
patch_file('c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js')

print('Kamus Bahasa Indonesia dan Penyaring Foto berhasil dipasang!')
