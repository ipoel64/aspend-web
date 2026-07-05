import os
import re

# 1. FIX SCRIPT.JS SORTING
path_script = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path_script, 'r', encoding='utf-8') as f:
    text_script = f.read()

robust_parser = '''function parseRobustDate(dateStr, timeStr) {
  if (!dateStr) return 0;
  let d = dateStr.toString().trim();
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

old_sort_regex = r'var sortedReports = \[\.\.\.state\.reports\]\.sort\(function\(a, b\) \{.*?\};\s*\n?.*?\n?.*?\n?.*?\n?.*?\n?.*?\n?.*?\n?.*?\n?.*?\}\);'
new_sort = '''var sortedReports = [...state.reports].sort(function(a, b) {
    var pukulA = (a.Pukul && a.Pukul !== '-') ? a.Pukul.toString().trim().substring(0,5) : '00:00';
    var pukulB = (b.Pukul && b.Pukul !== '-') ? b.Pukul.toString().trim().substring(0,5) : '00:00';
    
    var timeA = parseRobustDate(a.Tanggal, pukulA);
    var timeB = parseRobustDate(b.Tanggal, pukulB);
    
    return timeB - timeA;
  });'''

if 'function parseRobustDate' not in text_script:
    # Inject parseRobustDate at the top
    text_script = robust_parser + text_script

text_script = re.sub(r'var sortedReports = \[\.\.\.state\.reports\]\.sort\(function\(a, b\) \{[\s\S]*?\}\);', new_sort, text_script)

with open(path_script, 'w', encoding='utf-8') as f:
    f.write(text_script)

# 2. FIX CLIENT_SERVICES.JS REPORT ID
path_client = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js'
with open(path_client, 'r', encoding='utf-8') as f:
    text_client = f.read()

# Change `ReportId: row[0] || ''` to generate a fallback ID
old_report_id = 'ReportId: row[0] || \'\''
new_report_id = 'ReportId: row[0] || (\'TMP_\' + Math.random().toString(36).substr(2,9))'
text_client = text_client.replace(old_report_id, new_report_id)

with open(path_client, 'w', encoding='utf-8') as f:
    f.write(text_client)

print('Robust Date Parser and Fallback IDs injected!')
