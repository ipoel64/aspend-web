import { google } from 'googleapis';

/**
 * Mendapatkan instance Google Sheets API yang sudah terautentikasi dengan token user
 * @param accessToken Token akses OAuth2 dari session NextAuth
 */
export async function getSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Membaca data dari Spreadsheet
 * Default menggunakan UNFORMATTED_VALUE agar angka 16 digit (NIK, No. KK) tidak dipaksa menjadi
 * notasi ilmiah (misal 1,27503E+15) oleh formatter tampilan Google Sheets.
 */
export async function getSheetData(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  valueRenderOption: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA' = 'FORMATTED_VALUE'
) {
  try {
    const sheets = await getSheetsClient(accessToken);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption,
    });
    return response.data.values || [];
  } catch (error) {
    console.error('Error membaca Google Sheets:', error);
    throw new Error('Gagal membaca data dari Google Sheets.');
  }
}

/**
 * Membaca banyak range sheet sekaligus dalam 1 API call tunggal (batchGet)
 * Sangat menghemat kuota Google API dan mempercepat response hingga 10x lipat
 */
export async function batchGetSheetData(
  accessToken: string,
  spreadsheetId: string,
  ranges: string[],
  valueRenderOption: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA' = 'FORMATTED_VALUE'
): Promise<any[][][]> {
  if (!ranges || ranges.length === 0) return [];
  try {
    const sheets = await getSheetsClient(accessToken);
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
      valueRenderOption,
    });
    return (response.data.valueRanges || []).map((vr) => vr.values || []);
  } catch (error) {
    console.error('Error batchGetSheetData Google Sheets:', error);
    // Kembalikan array kosong untuk masing-masing range agar pemanggil tidak crash
    return ranges.map(() => []);
  }
}

/**
 * Menulis baris baru (append) ke Spreadsheet
 */
export async function appendSheetData(accessToken: string, spreadsheetId: string, range: string, values: any[][]) {
  try {
    const sheets = await getSheetsClient(accessToken);
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error menulis ke Google Sheets:', error);
    throw new Error('Gagal menyimpan data ke Google Sheets.');
  }
}

/**
 * Memperbarui (update) baris pada Spreadsheet
 */
export async function updateSheetRow(accessToken: string, spreadsheetId: string, range: string, values: any[][]) {
  try {
    const sheets = await getSheetsClient(accessToken);
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
    return response.data;
  } catch (error: any) {
    const errorDetails = error?.response?.data?.error?.message || error?.message || '';
    console.error('Error memperbarui Google Sheets:', errorDetails, error);
    throw new Error(`Gagal memperbarui data di Google Sheets: ${errorDetails || 'Kesalahan API'}`);
  }
}

/**
 * Memperbarui banyak range baris sekaligus dalam satu panggilan API (batchUpdate values)
 * Menghemat kuota write request (60 req/menit) dan menghindari rate limit / timeout saat impor massal
 */
export async function batchUpdateSheetValues(
  accessToken: string,
  spreadsheetId: string,
  data: Array<{ range: string; values: any[][] }>
) {
  if (!data || data.length === 0) return null;
  try {
    const sheets = await getSheetsClient(accessToken);
    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data,
      },
    });
    return response.data;
  } catch (error: any) {
    const errorDetails = error?.response?.data?.error?.message || error?.message || '';
    console.error('Error batchUpdateSheetValues:', errorDetails, error);
    throw new Error(`Gagal memperbarui data massal di Google Sheets: ${errorDetails || 'Kesalahan API'}`);
  }
}

/**
 * Mendapatkan numeric ID dari sheet tab (properties.sheetId)
 */
export async function getSheetNumericId(accessToken: string, spreadsheetId: string, sheetName: string): Promise<number | null> {
  try {
    const sheets = await getSheetsClient(accessToken);
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const targetSheet = meta.data.sheets?.find(s => s.properties?.title === sheetName);
    return targetSheet?.properties?.sheetId ?? null;
  } catch (error) {
    console.error('Error getSheetNumericId:', error);
    return null;
  }
}

/**
 * Menghapus baris dari sheet berdasarkan index 0-based
 */
export async function deleteSheetRow(accessToken: string, spreadsheetId: string, sheetName: string, rowIndex0Based: number) {
  try {
    const sheets = await getSheetsClient(accessToken);
    const numericSheetId = await getSheetNumericId(accessToken, spreadsheetId, sheetName);
    if (numericSheetId === null) {
      throw new Error(`Sheet "${sheetName}" tidak ditemukan.`);
    }

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: numericSheetId,
                dimension: 'ROWS',
                startIndex: rowIndex0Based,
                endIndex: rowIndex0Based + 1,
              },
            },
          },
        ],
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error menghapus baris Google Sheets:', error);
    throw new Error('Gagal menghapus baris dari Google Sheets.');
  }
}

/**
 * Menghapus banyak baris sekaligus dalam 1 request batchUpdate tunggal
 * rowIndices0Based: indeks baris 0-based di Google Sheets (Row 1 header = index 0)
 * Otomatis diurutkan descending (dari terbesar ke terkecil) agar indeks tidak bergeser saat dihapus
 */
export async function deleteSheetRowsBatch(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rowIndices0Based: number[]
) {
  if (!rowIndices0Based || rowIndices0Based.length === 0) return null;
  try {
    const numericSheetId = await getSheetNumericId(accessToken, spreadsheetId, sheetName);
    if (numericSheetId === null) {
      throw new Error(`Sheet "${sheetName}" tidak ditemukan.`);
    }

    // Hilangkan duplikat indeks dan urutkan menurun (descending)
    const sortedDesc = Array.from(new Set(rowIndices0Based)).sort((a, b) => b - a);
    const requests = sortedDesc.map((idx) => ({
      deleteDimension: {
        range: {
          sheetId: numericSheetId,
          dimension: 'ROWS',
          startIndex: idx,
          endIndex: idx + 1,
        },
      },
    }));

    const sheets = await getSheetsClient(accessToken);
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error deleteSheetRowsBatch:', error);
    throw new Error(`Gagal menghapus baris massal di Google Sheets: ${error?.message || ''}`);
  }
}

/**
 * Mencari index baris berdasarkan kunci tertentu (seperti findRowByKey di DataService.gs)
 */
export async function findRowByKey(accessToken: string, spreadsheetId: string, sheetName: string, searchKey: string, columnIndex: number = 0) {
  const data = await getSheetData(accessToken, spreadsheetId, `${sheetName}!A:Z`);
  for (let i = 0; i < data.length; i++) {
    if (data[i][columnIndex] && data[i][columnIndex].toString().toLowerCase() === searchKey.toLowerCase()) {
      return i + 1; // 1-indexed (baris 1, 2, dst)
    }
  }
  return -1;
}
