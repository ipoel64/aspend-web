import { google } from 'googleapis';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from './google-auth-helpers';

/**
 * Deteksi apakah error dari Google API disebabkan oleh token kedaluwarsa / tidak valid (HTTP 401)
 */
export function isGoogleAuthError(error: any): boolean {
  if (!error) return false;
  const status = Number(error.status || error.code || error?.response?.status || 0);
  const msg = String(
    error.message ||
      error?.response?.data?.error?.message ||
      error?.response?.data?.error_description ||
      ''
  ).toLowerCase();
  return (
    status === 401 ||
    msg.includes('invalid credentials') ||
    msg.includes('unauthenticated') ||
    msg.includes('invalid_grant') ||
    msg.includes('session_expired') ||
    msg.includes('request had invalid authentication credentials') ||
    msg.includes('expected oauth 2 access token')
  );
}

function createAuthExpiredError(): Error & { status?: number; code?: number } {
  const err: Error & { status?: number; code?: number } = new Error(
    'SESSION_EXPIRED: Sesi login Google Anda telah berakhir. Silakan login kembali.'
  );
  err.status = 401;
  err.code = 401;
  return err;
}

/**
 * Mendapatkan instance Google Sheets API yang sudah terautentikasi dengan token user
 * @param accessToken Token akses OAuth2 dari session NextAuth
 */
export async function getSheetsClient(accessToken: string, refreshToken?: string) {
  const auth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {})
  });
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
    if (isGoogleAuthError(error)) {
      throw createAuthExpiredError();
    }
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
    if (isGoogleAuthError(error)) {
      throw createAuthExpiredError();
    }
    console.warn('batchGetSheetData gagal (kemungkinan salah satu tab sheet belum ada), fallback ke pembacaan per-sheet:', error);
    // Fallback: ambil satu per satu dengan Promise.all agar jika 1 tab opsional belum ada, tab utama tetap terbaca!
    return await Promise.all(
      ranges.map((r) =>
        getSheetData(accessToken, spreadsheetId, r, valueRenderOption).catch((err) => {
          if (isGoogleAuthError(err)) throw err;
          return [];
        })
      )
    );
  }
}

/**
 * Memastikan tab sheet dengan nama tertentu sudah ada di Spreadsheet.
 * Jika belum ada, otomatis dibuat beserta header baris pertamanya.
 */
export async function ensureSheetExists(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  headers?: string[]
): Promise<boolean> {
  try {
    const sheets = await getSheetsClient(accessToken);
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = meta.data.sheets?.some(
      (s) => s.properties?.title?.toLowerCase() === sheetName.toLowerCase()
    );

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      if (headers && headers.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [headers],
          },
        });
      }
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`ensureSheetExists warning for "${sheetName}":`, err);
    return false;
  }
}

/**
 * Menulis baris baru (append) ke Spreadsheet.
 * Otomatis membuat tab sheet baru dan mengisi header jika tab belum tersedia!
 */
export async function appendSheetData(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][],
  defaultHeaders?: string[]
) {
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
  } catch (error: any) {
    if (isGoogleAuthError(error)) {
      throw createAuthExpiredError();
    }

    // Jika tab sheet belum ada ("Unable to parse range" atau "not found"), otomatis buat tab sheet dan retry append!
    const errMsg = String(
      error?.message || error?.response?.data?.error?.message || ''
    ).toLowerCase();

    if (
      errMsg.includes('unable to parse range') ||
      errMsg.includes('not found') ||
      errMsg.includes('bad request') ||
      error?.status === 400 ||
      error?.code === 400
    ) {
      const sheetName = range.split('!')[0].replace(/['"]/g, '');
      console.log(`Sheet "${sheetName}" belum tersedia, membuat tab otomatis...`);
      try {
        await ensureSheetExists(accessToken, spreadsheetId, sheetName, defaultHeaders);
        const sheets = await getSheetsClient(accessToken);
        const retryRes = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });
        return retryRes.data;
      } catch (retryErr: any) {
        if (isGoogleAuthError(retryErr)) throw createAuthExpiredError();
        console.error('Gagal retry appendSheetData setelah createSheet:', retryErr);
      }
    }

    const errorDetails = error?.response?.data?.error?.message || error?.message || '';
    console.error('Error menulis ke Google Sheets:', errorDetails, error);
    throw new Error(`Gagal menyimpan data ke Google Sheets: ${errorDetails || 'Kesalahan Server'}`);
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
  try {
    const data = await getSheetData(accessToken, spreadsheetId, `${sheetName}!A:AZ`);
    const cleanSearch = String(searchKey || '').replace(/^'+/, '').trim().toLowerCase();
    if (!cleanSearch) return -1;

    for (let i = 0; i < data.length; i++) {
      const cellVal = data[i][columnIndex];
      if (cellVal !== undefined && cellVal !== null) {
        const cleanCell = String(cellVal).replace(/^'+/, '').trim().toLowerCase();
        if (cleanCell === cleanSearch) {
          return i + 1; // 1-indexed (baris 1, 2, dst)
        }
      }
    }
    return -1;
  } catch (err) {
    console.warn(`findRowByKey warning for ${sheetName}:`, err);
    return -1;
  }
}
