import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/client_services.js'

new_funcs = """
// ── FUNGSI PENGHAPUS MANDIRI (PENGGANTI GAS DELETE) ─────────────
async function getSheetIdByName(spreadsheetId, sheetName) {
  const response = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId
  });
  const sheet = response.result.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error("Sheet tidak ditemukan: " + sheetName);
  return sheet.properties.sheetId;
}

async function findRowIndexById(spreadsheetId, sheetName, idValue) {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!A:A`
  });
  const rows = response.result.values;
  if (!rows) throw new Error("Sheet kosong.");
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === idValue) {
      return i; // 0-based index for the batchUpdate API
    }
  }
  throw new Error("ID tidak ditemukan.");
}

async function deleteRowClient(idValue, sheetName) {
  const ssId = localStorage.getItem('aspend_spreadsheetId');
  const sheetId = await getSheetIdByName(ssId, sheetName);
  const rowIndex = await findRowIndexById(ssId, sheetName, idValue);
  
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: ssId,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
        }
      }]
    }
  });
}

async function deleteRowByIndexClient(rowIndex1Based, sheetName) {
  const rowIndex0Based = parseInt(rowIndex1Based) - 1;
  const ssId = localStorage.getItem('aspend_spreadsheetId');
  const sheetId = await getSheetIdByName(ssId, sheetName);
  
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: ssId,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: rowIndex0Based,
            endIndex: rowIndex0Based + 1
          }
        }
      }]
    }
  });
}
"""

with open(path, 'a', encoding='utf-8') as f:
    f.write('\n' + new_funcs)

print("Client delete functions injected.")
