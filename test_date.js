function parseRobustDate(dateStr, timeStr) {
  if (!dateStr) return 0;
  let d = dateStr.toString().trim().toLowerCase();
  
  // Hapus nama hari bahasa Indonesia
  d = d.replace(/senin,?|selasa,?|rabu,?|kamis,?|jumat,?|jum\'at,?|sabtu,?|minggu,?/g, '').trim();
  
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
          let p = d.trim().split(/\s+/);
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

  let parts = d.split(/[-/\\]/);
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

let reports = [
    { Tanggal: 'Jumat, 3 Juli 2026', Pukul: '9:00', originalIndex: 1 },
    { Tanggal: 'Rabu, 3 Juni 2026', Pukul: '10:00', originalIndex: 2 },
    { Tanggal: 'Kamis, 2 Juli 2026', Pukul: '14:00', originalIndex: 3 },
    { Tanggal: 'Rabu, 17 Juni 2026', Pukul: '10:00', originalIndex: 4 }
];

reports.forEach(r => {
    let t = parseRobustDate(r.Tanggal, r.Pukul.padStart(5, '0'));
    console.log(`Tanggal: ${r.Tanggal} | Timestamp: ${t}`);
});

reports.sort((a, b) => {
    let timeA = parseRobustDate(a.Tanggal, a.Pukul.padStart(5, '0'));
    let timeB = parseRobustDate(b.Tanggal, b.Pukul.padStart(5, '0'));
    if (timeA === 0) console.log("timeA IS ZERO FOR", a.Tanggal);
    if (timeB === 0) console.log("timeB IS ZERO FOR", b.Tanggal);
    return timeB - timeA;
});

console.log("Sorted Order:");
reports.forEach(r => console.log(r.Tanggal));
