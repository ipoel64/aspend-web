import { google } from 'googleapis';
import { getSheetsClient, getSheetData, appendSheetData } from './google-sheets';
import {
  KPM_SHEET_KELUARGA,
  KPM_SHEET_ANGGOTA,
  KPM_SHEET_ASET,
  KPM_SHEET_GRADUASI,
  KPM_SHEET_PERMASALAHAN,
  KPM_SHEET_PORTAL,
  KPM_KELUARGA_HEADERS,
  KPM_ANGGOTA_HEADERS,
  KPM_ASET_HEADERS,
  KPM_GRADUASI_HEADERS,
  KPM_PERMASALAHAN_HEADERS,
  KpmKeluarga,
  KpmAnggota,
  KpmAset,
  KpmGraduasi,
  KpmPermasalahan,
  parseKeluargaRow,
  parseAnggotaRow,
  parseAsetRow,
  parseGraduasiRow,
  parsePermasalahanRow,
  normalizeKK,
} from './kpm-constants';

export const KPM_PORTAL_HEADERS = ['PortalId', 'RefCode', 'SpreadsheetId', 'OwnerEmail', 'Status', 'CreatedAt'];

/**
 * Memastikan sheet tab dengan header-nya ada di Spreadsheet.
 * Jika sheet belum ada, otomatis dibuat dan header ditulis di baris pertama.
 */
export async function ensureSheetExists(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
): Promise<void> {
  try {
    const sheets = await getSheetsClient(accessToken);
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const targetSheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
    const neededCols = Math.max(headers ? headers.length : 0, 32);

    if (!targetSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                  gridProperties: {
                    frozenRowCount: 1,
                    columnCount: neededCols,
                  },
                },
              },
            },
          ],
        },
      });

      if (headers && headers.length > 0) {
        await appendSheetData(accessToken, spreadsheetId, `${sheetName}!A1`, [headers]);
      }
    } else {
      // Pastikan jumlah kolom mencukupi minimal 32 kolom (agar kolom AB selalu valid)
      const currentCols = targetSheet.properties?.gridProperties?.columnCount || 26;
      if (currentCols < neededCols && targetSheet.properties?.sheetId !== undefined) {
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  updateSheetProperties: {
                    properties: {
                      sheetId: targetSheet.properties.sheetId,
                      gridProperties: {
                        columnCount: neededCols,
                      },
                    },
                    fields: 'gridProperties.columnCount',
                  },
                },
              ],
            },
          });
        } catch (colErr) {
          console.warn(`Gagal memperluas kolom sheet ${sheetName}:`, colErr);
        }
      }

      // Sinkronkan header jika ada kolom baru (seperti FotoSelfie) yang belum ada di baris 1
      if (headers && headers.length > 0) {
        try {
          const headerRows = await getSheetData(accessToken, spreadsheetId, `${sheetName}!A1:AZ1`).catch(() => []);
          const existingHeaders = headerRows[0] || [];
          if (existingHeaders.length < headers.length) {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${sheetName}!A1`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [headers] },
            });
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (error) {
    console.error(`Gagal memastikan sheet ${sheetName}:`, error);
  }
}

/**
 * Memastikan semua 6 sheet KPM sudah siap di Google Sheets user.
 */
export async function ensureAllKpmSheets(accessToken: string, spreadsheetId: string): Promise<void> {
  await Promise.all([
    ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_KELUARGA, KPM_KELUARGA_HEADERS),
    ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_ANGGOTA, KPM_ANGGOTA_HEADERS),
    ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_ASET, KPM_ASET_HEADERS),
    ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_GRADUASI, KPM_GRADUASI_HEADERS),
    ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_PERMASALAHAN, KPM_PERMASALAHAN_HEADERS),
    ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_PORTAL, KPM_PORTAL_HEADERS),
  ]);
}

export interface KpmFullData {
  keluarga: KpmKeluarga | null;
  anggota: KpmAnggota[];
  aset: KpmAset | null;
  graduasi: KpmGraduasi | null;
  permasalahan: KpmPermasalahan[];
}

/**
 * Mengambil profil lengkap satu keluarga KPM beserta seluruh data relasinya:
 * Anggota, Aset, Graduasi, dan Catatan Permasalahan.
 */
export async function getKpmFullProfile(
  accessToken: string,
  spreadsheetId: string,
  identifier: { kpmId?: string; noKK?: string; nik?: string }
): Promise<KpmFullData> {
  const result: KpmFullData = {
    keluarga: null,
    anggota: [],
    aset: null,
    graduasi: null,
    permasalahan: [],
  };

  try {
    const rawKeluarga = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A2:AB`);
    const keluargaList = rawKeluarga.filter((r) => r.length > 0).map(parseKeluargaRow);

    const idClean = (identifier.kpmId || '').trim();
    const noKKClean = (identifier.noKK || '').trim();
    const nikClean = (identifier.nik || '').trim();
    const derivedNik = idClean.startsWith('KPM-') ? idClean.replace('KPM-', '').trim() : '';

    const foundKeluarga = keluargaList.find((k) => {
      // 1. Cocokkan KpmId persis jika di sheet terisi KpmId
      if (idClean && k.KpmId && k.KpmId.toLowerCase() === idClean.toLowerCase()) return true;
      // 2. Cocokkan NIK dari identifier.nik atau derivedNik (KPM-[NIK])
      if (nikClean && k.NIK && k.NIK === nikClean) return true;
      if (derivedNik && k.NIK && k.NIK === derivedNik) return true;
      // 3. Cocokkan No. KK (termasuk normalisasi)
      if (noKKClean && k.NoKK && (k.NoKK === noKKClean || normalizeKK(k.NoKK) === normalizeKK(noKKClean))) return true;
      // 4. Fallback jika kpmId dikirim tapi berupa digit NIK langsung
      if (idClean && k.NIK && k.NIK === idClean) return true;
      return false;
    });

    if (!foundKeluarga) {
      return result;
    }

    result.keluarga = foundKeluarga;
    const targetNoKK = foundKeluarga.NoKK;

    // Baca data relasi secara paralel
    const [rawAnggota, rawAset, rawGraduasi, rawMasalah] = await Promise.all([
      getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A2:N`).catch(() => []),
      getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ASET}!A2:M`).catch(() => []),
      getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_GRADUASI}!A2:L`).catch(() => []),
      getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_PERMASALAHAN}!A2:J`).catch(() => []),
    ]);

    const parsedAnggota = rawAnggota.filter((r) => r.length > 0).map(parseAnggotaRow);
    const parsedAset = rawAset.filter((r) => r.length > 0).map(parseAsetRow);
    const parsedGraduasi = rawGraduasi.filter((r) => r.length > 0).map(parseGraduasiRow);
    const parsedMasalah = rawMasalah.filter((r) => r.length > 0).map(parsePermasalahanRow);

    const normTargetKK = normalizeKK(targetNoKK);

    // Cek apakah ada anggota yang cocok dengan targetNoKK langsung/normalisasi
    let matchedAnggota = parsedAnggota.filter(
      (a) => a.NoKK === targetNoKK || (normTargetKK && normalizeKK(a.NoKK) === normTargetKK)
    );

    // Jika belum ketemu, coba cari via NIK Pengurus
    let realKK = targetNoKK;
    if (matchedAnggota.length === 0 && foundKeluarga.NIK) {
      const matchByNik = parsedAnggota.find((a) => a.NIK === foundKeluarga.NIK);
      if (matchByNik && matchByNik.NoKK) {
        realKK = matchByNik.NoKK;
        const normRealKK = normalizeKK(realKK);
        matchedAnggota = parsedAnggota.filter(
          (a) => a.NoKK === realKK || (normRealKK && normalizeKK(a.NoKK) === normRealKK)
        );
      }
    }

    // Hitung frekuensi NIK anggota di seluruh sheet
    const anggotaNikCounts = new Map<string, number>();
    for (const a of parsedAnggota) {
      const aNik = a.NIK?.trim();
      if (aNik && aNik !== '—' && aNik !== '-') {
        anggotaNikCounts.set(aNik, (anggotaNikCounts.get(aNik) || 0) + 1);
      }
    }

    result.anggota = matchedAnggota.map((ang) => {
      const aNik = ang.NIK?.trim() || '';
      const dupCount = aNik ? (anggotaNikCounts.get(aNik) || 1) : 1;
      return {
        ...ang,
        IsDuplicateNik: dupCount > 1,
        DuplicateCount: dupCount,
      };
    });

    const normRealKK = normalizeKK(realKK);
    const matchKK = (noKKVal: string) => {
      if (!noKKVal) return false;
      if (noKKVal === targetNoKK || noKKVal === realKK) return true;
      const n = normalizeKK(noKKVal);
      if (normTargetKK && n === normTargetKK) return true;
      if (normRealKK && n === normRealKK) return true;
      return false;
    };

    result.aset = parsedAset.find((ast) => matchKK(ast.NoKK)) || null;
    result.graduasi = parsedGraduasi.find((g) => matchKK(g.NoKK)) || null;
    result.permasalahan = parsedMasalah.filter((m) => matchKK(m.NoKK));

    return result;
  } catch (error) {
    console.error('Error fetching KPM full profile:', error);
    return result;
  }
}
