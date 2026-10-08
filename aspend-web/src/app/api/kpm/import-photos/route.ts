import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  findAspendSpreadsheet,
  getOrCreateFolder,
  uploadFileToDrive,
  listFilesInFolder,
  copyFileInDrive,
  extractDriveFolderId,
  extractSpreadsheetId,
} from '@/lib/google-drive';
import {
  getSheetData,
  getSheetsClient,
  appendSheetData,
  batchUpdateSheetValues,
} from '@/lib/google-sheets';
import {
  KPM_SHEET_KELUARGA,
  KPM_SHEET_ASET,
  KPM_KELUARGA_HEADERS,
  KPM_ASET_HEADERS,
  parseKeluargaRow,
  keluargaToRow,
  parseAsetRow,
  asetToRow,
  generateAsetId,
  KpmKeluarga,
  KpmAset,
} from '@/lib/kpm-constants';
import { ensureSheetExists } from '@/lib/kpm-sheets';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export const maxDuration = 120; // 2 minutes for batch operations
export const dynamic = 'force-dynamic';

function cleanDigits(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  if (/e[+-]?\d+/i.test(str)) {
    try {
      const normalized = str.replace(',', '.');
      const num = Number(normalized);
      if (!isNaN(num) && isFinite(num)) {
        str = BigInt(Math.round(num)).toString();
      }
    } catch {
      // ignore
    }
  }
  str = str.replace(/\D/g, '');
  if (str.length === 15) {
    str = '0' + str;
  }
  return str;
}

function cleanPhotoFilename(rawPath: string): string {
  if (!rawPath) return '';
  const trimmed = String(rawPath).trim();
  const withoutPath = trimmed.replace(/^.*[\\\/]/, '');
  return withoutPath;
}

function mapStatusRumah(val: string): string {
  if (!val) return '';
  const upper = val.toUpperCase().trim();
  if (upper.includes('NUMPANG')) return 'Numpang';
  if (upper.includes('SENDIRI') || upper.includes('SEN')) return 'Milik Sendiri';
  if (upper.includes('SEWA') || upper.includes('KONTRAK') || upper.includes('KOI')) return 'Sewa/Kontrak';
  if (upper.includes('DINAS')) return 'Milik Dinas';
  if (upper.includes('KEBON') || upper.includes('KEBUN')) return 'Milik Kebon';
  return val.trim();
}

function mapUsaha(val: string): string {
  if (!val) return 'Tidak Memiliki Usaha';
  const upper = val.toUpperCase().trim();
  if (upper.includes('TIDAK') || upper === '0' || upper === 'NO' || upper === 'T') {
    return 'Tidak Memiliki Usaha';
  }
  if (upper.includes('ADA') || upper === '1' || upper === 'YES' || upper === 'Y') {
    return 'Memiliki Usaha';
  }
  return val.trim();
}

function detectDocType(str: string): 'ktp' | 'kk' | 'butab' | 'kks' | 'selfie' | null {
  const s = str.toLowerCase();
  if (s.includes('selfie') || s.includes('f_selfie')) return 'selfie';
  if (s.includes('ktp') || s.includes('f_ktp')) return 'ktp';
  if (s.includes('butab') || s.includes('buku_tab') || s.includes('bukutab') || s.includes('tabungan') || s.includes('f_butab')) return 'butab';
  if (s.includes('kks') || s.includes('f_kks')) return 'kks';
  if (s.includes('kk') || s.includes('f_kk')) return 'kk';
  return null;
}

interface ParsedOldRow {
  rowNum: number;
  noKK: string;
  pengurus: string;
  statusRumah: string;
  usaha: string;
  jenisUsaha: string;
  rLuarFilename: string;
  rDalamFilename: string;
}

function parseOldSheetData(rows: any[][]): ParsedOldRow[] {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map((h: any) => String(h || '').trim().toUpperCase());

  let colNKK = headers.findIndex((h) => h === 'NKK' || h === 'NO. KK' || h === 'NO KK' || h.includes('KARTU KELUARGA'));
  let colPengurus = headers.findIndex((h) => h === 'PENGURUS' || h.includes('NAMA'));
  let colStatus = headers.findIndex((h) => h.includes('TATUS') || h.includes('RUMAH'));
  let colUsaha = headers.findIndex((h) => h === 'USAHA' || h.includes('KEPEMILIKAN USAHA'));
  let colJenis = headers.findIndex((h) => h === 'JENIS' || h.includes('JENIS USAHA'));
  let colRLuar = headers.findIndex((h) => h.includes('R_LUAR') || h.includes('LUAR'));
  let colRDalam = headers.findIndex((h) => h.includes('R_DALAM') || h.includes('DALAM'));

  if (colNKK === -1 && rows[0].length >= 4) colNKK = 3;
  if (colPengurus === -1 && rows[0].length >= 5) colPengurus = 4;
  if (colStatus === -1 && rows[0].length >= 6) colStatus = 5;
  if (colUsaha === -1 && rows[0].length >= 7) colUsaha = 6;
  if (colJenis === -1 && rows[0].length >= 8) colJenis = 7;
  if (colRLuar === -1 && rows[0].length >= 9) colRLuar = 8;
  if (colRDalam === -1 && rows[0].length >= 10) colRDalam = 9;

  const result: ParsedOldRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const rawNoKK = colNKK !== -1 ? r[colNKK] : '';
    const noKK = cleanDigits(rawNoKK);
    if (!noKK) continue;

    const pengurus = colPengurus !== -1 ? String(r[colPengurus] || '').trim() : '';
    const statusRumah = colStatus !== -1 ? mapStatusRumah(String(r[colStatus] || '')) : '';
    const usaha = colUsaha !== -1 ? mapUsaha(String(r[colUsaha] || '')) : 'Tidak Memiliki Usaha';
    const jenisUsaha = colJenis !== -1 ? String(r[colJenis] || '').trim() : '';
    const rLuarFilename = colRLuar !== -1 ? cleanPhotoFilename(String(r[colRLuar] || '')) : '';
    const rDalamFilename = colRDalam !== -1 ? cleanPhotoFilename(String(r[colRDalam] || '')) : '';

    result.push({
      rowNum: i + 1,
      noKK,
      pengurus,
      statusRumah,
      usaha,
      jenisUsaha,
      rLuarFilename,
      rDalamFilename,
    });
  }

  return result;
}

interface ParsedOldDocRow {
  rowNum: number;
  noKK: string;
  pengurus: string;
  selfieFilename: string;
  ktpFilename: string;
  kkFilename: string;
  butabFilename: string;
  kksFilename: string;
}

function parseOldDocSheetData(rows: any[][]): ParsedOldDocRow[] {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map((h: any) => String(h || '').trim().toUpperCase());

  let colNKK = headers.findIndex((h) => h === 'NKK' || h === 'NO. KK' || h === 'NO KK' || h === 'NOMOR KK' || h === 'NO_KK' || h.includes('KARTU KELUARGA'));
  let colPengurus = headers.findIndex((h) => h === 'PENGURUS' || h === 'NAMA PENGURUS' || h.includes('PENGURUS') || h.includes('NAMA'));
  let colSelfie = headers.findIndex((h) => h === 'F_SELFIE' || h === 'SELFIE' || h.includes('SELFIE'));
  let colKtp = headers.findIndex((h) => h === 'F_KTP' || h === 'KTP' || h.includes('KTP'));
  let colKk = headers.findIndex((h) => h === 'F_KK' || h === 'KK' || h.includes('KK'));
  let colButab = headers.findIndex((h) => h === 'F_BUTAB' || h === 'BUTAB' || h.includes('BUTAB') || h.includes('TABUNGAN'));
  let colKks = headers.findIndex((h) => h === 'F_KKS' || h === 'KKS' || h.includes('KKS'));

  // Fallback defaults based on screenshot media_1791484655256.png:
  // Col M (12): NKK, Col N (13): PENGURUS, Col R (17): F_SELFIE, Col S (18): F_KTP, Col T (19): F_KK, Col U (20): F_BUTAB, Col V (21): F_KKS
  if (colNKK === -1 && rows[0].length >= 13) colNKK = 12;
  if (colPengurus === -1 && rows[0].length >= 14) colPengurus = 13;
  if (colSelfie === -1 && rows[0].length >= 18) colSelfie = 17;
  if (colKtp === -1 && rows[0].length >= 19) colKtp = 18;
  if (colKk === -1 && rows[0].length >= 20) colKk = 19;
  if (colButab === -1 && rows[0].length >= 21) colButab = 20;
  if (colKks === -1 && rows[0].length >= 22) colKks = 21;

  const result: ParsedOldDocRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const rawNoKK = colNKK !== -1 ? r[colNKK] : '';
    const noKK = cleanDigits(rawNoKK);
    if (!noKK) continue;

    const pengurus = colPengurus !== -1 ? String(r[colPengurus] || '').trim() : '';
    const selfieFilename = colSelfie !== -1 ? cleanPhotoFilename(String(r[colSelfie] || '')) : '';
    const ktpFilename = colKtp !== -1 ? cleanPhotoFilename(String(r[colKtp] || '')) : '';
    const kkFilename = colKk !== -1 ? cleanPhotoFilename(String(r[colKk] || '')) : '';
    const butabFilename = colButab !== -1 ? cleanPhotoFilename(String(r[colButab] || '')) : '';
    const kksFilename = colKks !== -1 ? cleanPhotoFilename(String(r[colKks] || '')) : '';

    result.push({
      rowNum: i + 1,
      noKK,
      pengurus,
      selfieFilename,
      ktpFilename,
      kkFilename,
      butabFilename,
      kksFilename,
    });
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login tidak valid' }, { status: 401 });
    }

    const aspendSpreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!aspendSpreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet database ASPEND tidak ditemukan di Google Drive' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    let action = 'preview';
    let category = 'dokumen'; // 'dokumen' | 'rumah'
    let oldSpreadsheetId = '';
    let oldDriveFolderId = '';
    let mode = 'overwrite'; // 'skip' | 'overwrite'
    let fileBuffer: Buffer | null = null;
    let zipBuffer: Buffer | null = null;
    let uploadedFiles: Array<{ name: string; buffer: Buffer }> = [];
    let itemsToProcess: any[] = [];
    let zipFilenames: string[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      action = (formData.get('action') as string) || 'preview';
      category = (formData.get('category') as string) || 'dokumen';
      oldSpreadsheetId = extractSpreadsheetId((formData.get('oldSpreadsheetId') as string) || '');
      oldDriveFolderId = extractDriveFolderId((formData.get('oldDriveFolderId') as string) || '');
      mode = (formData.get('mode') as string) || 'overwrite';

      const excelFile = formData.get('excelFile') as File | null;
      if (excelFile && excelFile.size > 0) {
        fileBuffer = Buffer.from(await excelFile.arrayBuffer());
      }

      const zipFile = formData.get('zipFile') as File | null;
      if (zipFile && zipFile.size > 0) {
        zipBuffer = Buffer.from(await zipFile.arrayBuffer());
      }

      const zipFilenamesStr = formData.get('zipFilenames') as string | null;
      if (zipFilenamesStr) {
        try {
          zipFilenames = JSON.parse(zipFilenamesStr);
        } catch {
          // ignore
        }
      }

      const directImages = formData.getAll('imageFiles') as File[];
      if (directImages && directImages.length > 0) {
        for (const img of directImages) {
          if (img.size > 0) {
            uploadedFiles.push({
              name: img.name,
              buffer: Buffer.from(await img.arrayBuffer()),
            });
          }
        }
      }

      const itemsJson = formData.get('items') as string | null;
      if (itemsJson) {
        try {
          itemsToProcess = JSON.parse(itemsJson);
        } catch {
          // ignore
        }
      }
    } else {
      const body = await request.json();
      action = body.action || 'preview';
      category = body.category || 'dokumen';
      oldSpreadsheetId = extractSpreadsheetId(body.oldSpreadsheetId || '');
      oldDriveFolderId = extractDriveFolderId(body.oldDriveFolderId || '');
      mode = body.mode || 'overwrite';
      itemsToProcess = body.items || [];
      zipFilenames = body.zipFilenames || [];
    }

    // Ensure sheets exist in ASPEND
    await ensureSheetExists(accessToken, aspendSpreadsheetId, KPM_SHEET_KELUARGA, KPM_KELUARGA_HEADERS);
    await ensureSheetExists(accessToken, aspendSpreadsheetId, KPM_SHEET_ASET, KPM_ASET_HEADERS);

    // Read current ASPEND Keluarga & Aset (up to column AB for FotoSelfie)
    const rawKeluarga = await getSheetData(accessToken, aspendSpreadsheetId, `${KPM_SHEET_KELUARGA}!A2:AB`).catch(() => []);
    const aspendKeluargaMap = new Map<string, { rowIndex: number; data: KpmKeluarga }>();
    const aspendKeluargaByNameMap = new Map<string, { rowIndex: number; data: KpmKeluarga }>();
    rawKeluarga.forEach((r, i) => {
      if (r && r.length > 0) {
        const k = parseKeluargaRow(r);
        const cKK = cleanDigits(k.NoKK);
        if (cKK && !aspendKeluargaMap.has(cKK)) {
          aspendKeluargaMap.set(cKK, { rowIndex: i + 2, data: k });
        }
        const cNama = (k.NamaPengurus || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cNama && !aspendKeluargaByNameMap.has(cNama)) {
          aspendKeluargaByNameMap.set(cNama, { rowIndex: i + 2, data: k });
        }
      }
    });

    const rawAset = await getSheetData(accessToken, aspendSpreadsheetId, `${KPM_SHEET_ASET}!A2:M`).catch(() => []);
    const aspendAsetMap = new Map<string, { rowIndex: number; data: KpmAset }>();
    rawAset.forEach((r, i) => {
      if (r && r.length > 0) {
        const a = parseAsetRow(r);
        const cKK = cleanDigits(a.NoKK);
        if (cKK && !aspendAsetMap.has(cKK)) {
          aspendAsetMap.set(cKK, { rowIndex: i + 2, data: a });
        }
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 1. ACTION: PREVIEW
    // ─────────────────────────────────────────────────────────────
    if (action === 'preview') {
      let rawOldRows: any[][] = [];

      // Source A: Excel file
      if (fileBuffer) {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        let ws: XLSX.WorkSheet | null = null;

        if (category === 'dokumen') {
          for (const sName of workbook.SheetNames) {
            const low = sName.toLowerCase();
            if (low.includes('user') || low.includes('kpm') || low.includes('data')) {
              ws = workbook.Sheets[sName];
              break;
            }
          }
        } else {
          for (const sName of workbook.SheetNames) {
            const low = sName.toLowerCase();
            if (low.includes('rumah') || low.includes('aset')) {
              ws = workbook.Sheets[sName];
              break;
            }
          }
        }

        if (!ws) {
          ws = workbook.Sheets[workbook.SheetNames[0]];
        }
        if (ws) {
          rawOldRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
        }
      } else if (oldSpreadsheetId) {
        // Source B: Google Spreadsheet
        try {
          const sheetsClient = await getSheetsClient(accessToken);
          const meta = await sheetsClient.spreadsheets.get({ spreadsheetId: oldSpreadsheetId });
          const sheetList = meta.data.sheets || [];
          let targetSheetName = sheetList[0]?.properties?.title || 'Sheet1';

          if (category === 'dokumen') {
            for (const s of sheetList) {
              const title = s.properties?.title || '';
              const low = title.toLowerCase();
              if (low.includes('user') || low.includes('kpm') || low.includes('data')) {
                targetSheetName = title;
                break;
              }
            }
          } else {
            for (const s of sheetList) {
              const title = s.properties?.title || '';
              const low = title.toLowerCase();
              if (low.includes('rumah') || low.includes('aset')) {
                targetSheetName = title;
                break;
              }
            }
          }

          rawOldRows = await getSheetData(accessToken, oldSpreadsheetId, `${targetSheetName}!A1:AZ5000`);
        } catch (err: any) {
          return NextResponse.json({
            error: `Gagal membaca Google Sheet lama: ${err.message || 'Pastikan Sheet telah dibagikan atau dapat diakses.'}`,
          }, { status: 400 });
        }
      }

      // Scan Google Drive folder if provided
      const driveFilesMap = new Map<string, { id: string; name: string }>();
      const drivePrefixMap = new Map<string, { id: string; name: string }>();
      const driveDocKeyMap = new Map<string, { id: string; name: string }>();
      let driveFolderScanned = false;
      let driveScanError = '';

      if (oldDriveFolderId) {
        try {
          const files = await listFilesInFolder(accessToken, oldDriveFolderId);
          driveFolderScanned = true;
          files.forEach((f) => {
            const clean = cleanPhotoFilename(f.name).toLowerCase();
            driveFilesMap.set(clean, f);

            const parts = clean.split(/[\._]/);
            if (parts.length >= 2) {
              drivePrefixMap.set(`${parts[0]}.${parts[1]}`, f);
            }

            const cDigits = cleanDigits(parts[0]);
            const dType = detectDocType(clean);
            if (cDigits && dType) {
              driveDocKeyMap.set(`${cDigits}:${dType}`, f);
            }
          });

          if (files.length === 0) {
            driveScanError = 'Folder Google Drive terhubung namun terbaca 0 file. Hal ini biasanya terjadi karena pembatasan izin privasi Google Drive API lintas akun. Disarankan menggunakan Tab 2 (Unggah File ZIP Foto) untuk proses instan.';
          }
        } catch (err: any) {
          driveScanError = err.message || 'Gagal memindai folder Google Drive.';
          console.warn('Drive folder scan error:', err);
        }
      }

      // Scan ZIP filenames if provided from client
      let zipScanned = false;
      if (zipFilenames && zipFilenames.length > 0) {
        zipScanned = true;
        zipFilenames.forEach((rawName) => {
          const clean = cleanPhotoFilename(rawName).toLowerCase();
          const fObj = { id: rawName, name: clean };
          driveFilesMap.set(clean, fObj);

          const parts = clean.split(/[\._]/);
          if (parts.length >= 2) {
            drivePrefixMap.set(`${parts[0]}.${parts[1]}`, fObj);
          }

          const cDigits = cleanDigits(parts[0]);
          const dType = detectDocType(clean);
          if (cDigits && dType) {
            driveDocKeyMap.set(`${cDigits}:${dType}`, fObj);
          }
        });
      }

      // Helper to find document file
      const findDocFile = (noKK: string, filename: string, type: 'ktp' | 'kk' | 'butab' | 'kks' | 'selfie') => {
        if (!driveFolderScanned && !zipScanned) return null;
        if (filename) {
          const clean = cleanPhotoFilename(filename).toLowerCase();
          let f = driveFilesMap.get(clean);
          if (f) return f;

          const parts = clean.split(/[\._]/);
          if (parts.length >= 2) {
            f = drivePrefixMap.get(`${parts[0]}.${parts[1]}`);
            if (f) return f;
          }
        }

        const cDigits = cleanDigits(noKK);
        if (cDigits) {
          const f = driveDocKeyMap.get(`${cDigits}:${type}`);
          if (f) return f;
        }

        return null;
      };

      // ─── CATEGORY DOKUMEN (Berkas KPM: KTP, KK, Butab, KKS, Selfie) ───
      if (category === 'dokumen') {
        let parsedDocRows = parseOldDocSheetData(rawOldRows);

        // If no sheet provided or sheet returned 0, but files exist in Drive/ZIP, parse directly from filenames!
        if (parsedDocRows.length === 0 && (driveFolderScanned || zipScanned)) {
          const kkGroup = new Map<string, { selfie?: string; ktp?: string; kk?: string; butab?: string; kks?: string }>();
          const allFileKeys = Array.from(driveFilesMap.keys());

          for (const fname of allFileKeys) {
            const parts = fname.split(/[\._]/);
            const noKK = cleanDigits(parts[0]);
            if (noKK && (noKK.length === 15 || noKK.length === 16)) {
              const dType = detectDocType(fname);
              if (dType) {
                const entry = kkGroup.get(noKK) || {};
                if (dType === 'selfie') entry.selfie = fname;
                if (dType === 'ktp') entry.ktp = fname;
                if (dType === 'kk') entry.kk = fname;
                if (dType === 'butab') entry.butab = fname;
                if (dType === 'kks') entry.kks = fname;
                kkGroup.set(noKK, entry);
              }
            }
          }

          let rNum = 1;
          for (const [noKK, docs] of kkGroup.entries()) {
            const kpm = aspendKeluargaMap.get(noKK);
            parsedDocRows.push({
              rowNum: rNum++,
              noKK,
              pengurus: kpm?.data.NamaPengurus || '',
              selfieFilename: docs.selfie || '',
              ktpFilename: docs.ktp || '',
              kkFilename: docs.kk || '',
              butabFilename: docs.butab || '',
              kksFilename: docs.kks || '',
            });
          }
        }

        if (parsedDocRows.length === 0) {
          return NextResponse.json({
            error: 'Tidak ditemukan data KPM atau berkas foto dokumen pada input yang diberikan. Pastikan file Excel berisi kolom NKK / nama file foto di Drive/ZIP memiliki format No. KK (contoh: 1234567890123456.F_KTP.jpg).',
          }, { status: 400 });
        }

        let matchedKpmCount = 0;
        let unmatchedKpmCount = 0;
        let selfieMatchCount = 0;
        let ktpMatchCount = 0;
        let kkMatchCount = 0;
        let butabMatchCount = 0;
        let kksMatchCount = 0;

        const previewList = parsedDocRows.map((row) => {
          let aspendKpm = aspendKeluargaMap.get(row.noKK);
          if (!aspendKpm && row.pengurus) {
            const normPengurus = row.pengurus.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            aspendKpm = aspendKeluargaByNameMap.get(normPengurus);
          }
          const isKpmExists = !!aspendKpm;
          const effectiveNoKK = aspendKpm ? aspendKpm.data.NoKK : row.noKK;

          if (isKpmExists) matchedKpmCount++;
          else unmatchedKpmCount++;

          const selfieFile = findDocFile(effectiveNoKK, row.selfieFilename, 'selfie');
          if (selfieFile) selfieMatchCount++;

          const ktpFile = findDocFile(effectiveNoKK, row.ktpFilename, 'ktp');
          if (ktpFile) ktpMatchCount++;

          const kkFile = findDocFile(effectiveNoKK, row.kkFilename, 'kk');
          if (kkFile) kkMatchCount++;

          const butabFile = findDocFile(effectiveNoKK, row.butabFilename, 'butab');
          if (butabFile) butabMatchCount++;

          const kksFile = findDocFile(effectiveNoKK, row.kksFilename, 'kks');
          if (kksFile) kksMatchCount++;

          const currentKpm = aspendKpm?.data;

          return {
            rowNum: row.rowNum,
            noKK: effectiveNoKK,
            namaPengurus: currentKpm?.NamaPengurus || row.pengurus || '—',
            isKpmExists,
            selfieFilename: row.selfieFilename,
            selfieDriveFileId: selfieFile?.id || '',
            selfieFound: !!selfieFile,
            ktpFilename: row.ktpFilename,
            ktpDriveFileId: ktpFile?.id || '',
            ktpFound: !!ktpFile,
            kkFilename: row.kkFilename,
            kkDriveFileId: kkFile?.id || '',
            kkFound: !!kkFile,
            butabFilename: row.butabFilename,
            butabDriveFileId: butabFile?.id || '',
            butabFound: !!butabFile,
            kksFilename: row.kksFilename,
            kksDriveFileId: kksFile?.id || '',
            kksFound: !!kksFile,
            existingSelfie: currentKpm?.FotoSelfie || '',
            existingKtp: currentKpm?.FotoKTP || '',
            existingKk: currentKpm?.FotoKK || '',
            existingButab: currentKpm?.FotoBukuTabungan || '',
            existingKks: currentKpm?.FotoKKS || '',
          };
        });

        const totalDocMatchCount = selfieMatchCount + ktpMatchCount + kkMatchCount + butabMatchCount + kksMatchCount;

        return NextResponse.json({
          success: true,
          action: 'preview',
          category: 'dokumen',
          totalOldRows: parsedDocRows.length,
          matchedKpmCount,
          unmatchedKpmCount,
          driveFolderScanned,
          driveFilesCount: driveFilesMap.size,
          driveScanError,
          selfieMatchCount,
          ktpMatchCount,
          kkMatchCount,
          butabMatchCount,
          kksMatchCount,
          totalDocMatchCount,
          canDirectDriveCopy: driveFolderScanned && totalDocMatchCount > 0,
          previewItems: previewList.slice(0, 30),
          allMatchedItems: previewList.filter((p) => p.isKpmExists),
        });
      }

      // ─── CATEGORY RUMAH (Foto Rumah: R_LUAR, R_DALAM) ───
      const parsedRows = parseOldSheetData(rawOldRows);
      if (parsedRows.length === 0) {
        return NextResponse.json({
          error: 'Tidak ditemukan baris data KPM yang valid pada sheet/file yang diberikan. Pastikan terdapat kolom NKK, R_LUAR, atau R_DALAM.',
        }, { status: 400 });
      }

      let matchedKpmCount = 0;
      let unmatchedKpmCount = 0;
      let rLuarMatchCount = 0;
      let rDalamMatchCount = 0;

      const previewList = parsedRows.map((row) => {
        let aspendKpm = aspendKeluargaMap.get(row.noKK);
        if (!aspendKpm && row.pengurus) {
          const normPengurus = row.pengurus.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          aspendKpm = aspendKeluargaByNameMap.get(normPengurus);
        }
        const isKpmExists = !!aspendKpm;
        const effectiveNoKK = aspendKpm ? aspendKpm.data.NoKK : row.noKK;

        if (isKpmExists) matchedKpmCount++;
        else unmatchedKpmCount++;

        const aspendAset = aspendAsetMap.get(effectiveNoKK) || aspendAsetMap.get(row.noKK);

        let rLuarFoundFile: { id: string; name: string } | null = null;
        if (row.rLuarFilename && (driveFolderScanned || zipScanned)) {
          const lower = row.rLuarFilename.toLowerCase();
          rLuarFoundFile = driveFilesMap.get(lower) || null;
          if (!rLuarFoundFile) {
            const parts = lower.split(/[\._]/);
            if (parts.length >= 2) {
              rLuarFoundFile = drivePrefixMap.get(`${parts[0]}.${parts[1]}`) || null;
            }
          }
        }
        if (rLuarFoundFile) rLuarMatchCount++;

        let rDalamFoundFile: { id: string; name: string } | null = null;
        if (row.rDalamFilename && (driveFolderScanned || zipScanned)) {
          const lower = row.rDalamFilename.toLowerCase();
          rDalamFoundFile = driveFilesMap.get(lower) || null;
          if (!rDalamFoundFile) {
            const parts = lower.split(/[\._]/);
            if (parts.length >= 2) {
              rDalamFoundFile = drivePrefixMap.get(`${parts[0]}.${parts[1]}`) || null;
            }
          }
        }
        if (rDalamFoundFile) rDalamMatchCount++;

        return {
          rowNum: row.rowNum,
          noKK: row.noKK,
          namaPengurus: row.pengurus || aspendKpm?.data.NamaPengurus || '—',
          isKpmExists,
          hasExistingAset: !!aspendAset,
          existingFotoRumahLuar: aspendAset?.data.FotoRumahLuar || '',
          existingFotoRumahDalam: aspendAset?.data.FotoRumahDalam || '',
          statusRumah: row.statusRumah,
          usaha: row.usaha,
          jenisUsaha: row.jenisUsaha,
          rLuarFilename: row.rLuarFilename,
          rLuarDriveFileId: rLuarFoundFile?.id || '',
          rLuarFound: !!rLuarFoundFile,
          rDalamFilename: row.rDalamFilename,
          rDalamDriveFileId: rDalamFoundFile?.id || '',
          rDalamFound: !!rDalamFoundFile,
        };
      });

      return NextResponse.json({
        success: true,
        action: 'preview',
        category: 'rumah',
        totalOldRows: parsedRows.length,
        matchedKpmCount,
        unmatchedKpmCount,
        driveFolderScanned,
        driveFilesCount: driveFilesMap.size,
        driveScanError,
        rLuarMatchCount,
        rDalamMatchCount,
        canDirectDriveCopy: driveFolderScanned && (rLuarMatchCount > 0 || rDalamMatchCount > 0),
        previewItems: previewList.slice(0, 30),
        allMatchedItems: previewList.filter((p) => p.isKpmExists),
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. ACTION: COMMIT-DRIVE (Cloud-to-Cloud copy between folders)
    // ─────────────────────────────────────────────────────────────
    if (action === 'commit-drive') {
      if (!itemsToProcess || itemsToProcess.length === 0) {
        return NextResponse.json({ error: 'Tidak ada data KPM yang dipilih untuk diimpor fotonya.' }, { status: 400 });
      }

      const targetFolderId = await getOrCreateFolder(accessToken, 'RHK-agent_FotoKPM');

      let copiedCount = 0;
      let asetUpdatedCount = 0;
      let asetCreatedCount = 0;
      let keluargaUpdatedCount = 0;
      const errors: string[] = [];

      const asetRangesToUpdate: Array<{ range: string; values: string[][] }> = [];
      const asetRowsToAppend: string[][] = [];
      const keluargaRangesToUpdate: Array<{ range: string; values: string[][] }> = [];

      // ─── COMMIT-DRIVE FOR DOKUMEN (Berkas KPM & Selfie) ───
      if (category === 'dokumen') {
        for (const item of itemsToProcess) {
          try {
            let newSelfieId = '';
            let newKtpId = '';
            let newKkId = '';
            let newButabId = '';
            let newKksId = '';

            if (item.selfieDriveFileId) {
              const ext = item.selfieFilename ? item.selfieFilename.split('.').pop() || 'jpg' : 'jpg';
              const newName = `SELFIE_${item.noKK}_${Date.now()}.${ext}`;
              const copied = await copyFileInDrive(accessToken, item.selfieDriveFileId, newName, targetFolderId || undefined);
              if (copied?.id) {
                newSelfieId = copied.id;
                copiedCount++;
              }
            }

            if (item.ktpDriveFileId) {
              const ext = item.ktpFilename ? item.ktpFilename.split('.').pop() || 'jpg' : 'jpg';
              const newName = `KTP_${item.noKK}_${Date.now()}.${ext}`;
              const copied = await copyFileInDrive(accessToken, item.ktpDriveFileId, newName, targetFolderId || undefined);
              if (copied?.id) {
                newKtpId = copied.id;
                copiedCount++;
              }
            }

            if (item.kkDriveFileId) {
              const ext = item.kkFilename ? item.kkFilename.split('.').pop() || 'jpg' : 'jpg';
              const newName = `KK_${item.noKK}_${Date.now()}.${ext}`;
              const copied = await copyFileInDrive(accessToken, item.kkDriveFileId, newName, targetFolderId || undefined);
              if (copied?.id) {
                newKkId = copied.id;
                copiedCount++;
              }
            }

            if (item.butabDriveFileId) {
              const ext = item.butabFilename ? item.butabFilename.split('.').pop() || 'jpg' : 'jpg';
              const newName = `BUTAB_${item.noKK}_${Date.now()}.${ext}`;
              const copied = await copyFileInDrive(accessToken, item.butabDriveFileId, newName, targetFolderId || undefined);
              if (copied?.id) {
                newButabId = copied.id;
                copiedCount++;
              }
            }

            if (item.kksDriveFileId) {
              const ext = item.kksFilename ? item.kksFilename.split('.').pop() || 'jpg' : 'jpg';
              const newName = `KKS_${item.noKK}_${Date.now()}.${ext}`;
              const copied = await copyFileInDrive(accessToken, item.kksDriveFileId, newName, targetFolderId || undefined);
              if (copied?.id) {
                newKksId = copied.id;
                copiedCount++;
              }
            }

            if (!newSelfieId && !newKtpId && !newKkId && !newButabId && !newKksId) {
              continue;
            }

            // Update KPM_Keluarga
            const existingKeluargaEntry = aspendKeluargaMap.get(item.noKK);
            if (existingKeluargaEntry) {
              const oldKpm = existingKeluargaEntry.data;
              const updatedKpm: KpmKeluarga = { ...oldKpm };

              if (newSelfieId && (mode === 'overwrite' || !oldKpm.FotoSelfie)) {
                updatedKpm.FotoSelfie = newSelfieId;
              }
              if (newKtpId && (mode === 'overwrite' || !oldKpm.FotoKTP)) {
                updatedKpm.FotoKTP = newKtpId;
              }
              if (newKkId && (mode === 'overwrite' || !oldKpm.FotoKK)) {
                updatedKpm.FotoKK = newKkId;
              }
              if (newButabId && (mode === 'overwrite' || !oldKpm.FotoBukuTabungan)) {
                updatedKpm.FotoBukuTabungan = newButabId;
              }
              if (newKksId && (mode === 'overwrite' || !oldKpm.FotoKKS)) {
                updatedKpm.FotoKKS = newKksId;
              }

              updatedKpm.UpdatedAt = new Date().toISOString();

              keluargaRangesToUpdate.push({
                range: `${KPM_SHEET_KELUARGA}!A${existingKeluargaEntry.rowIndex}:AB${existingKeluargaEntry.rowIndex}`,
                values: [keluargaToRow(updatedKpm)],
              });
              keluargaUpdatedCount++;
            }
          } catch (itemErr: any) {
            errors.push(`Gagal memproses berkas KK ${item.noKK}: ${itemErr.message}`);
          }
        }

        if (keluargaRangesToUpdate.length > 0) {
          for (let i = 0; i < keluargaRangesToUpdate.length; i += 100) {
            await batchUpdateSheetValues(accessToken, aspendSpreadsheetId, keluargaRangesToUpdate.slice(i, i + 100));
          }
        }

        return NextResponse.json({
          success: true,
          message: `Berhasil menyalin ${copiedCount} berkas/foto dokumen ke Google Drive ASPEND. Data profil KPM diperbarui: ${keluargaUpdatedCount} keluarga.`,
          copiedCount,
          keluargaUpdatedCount,
          errors,
        });
      }

      // ─── COMMIT-DRIVE FOR RUMAH ───
      for (const item of itemsToProcess) {
        try {
          let newLuarId = '';
          let newDalamId = '';

          if (item.rLuarDriveFileId) {
            const ext = item.rLuarFilename ? item.rLuarFilename.split('.').pop() || 'jpg' : 'jpg';
            const newName = `RUMAH_LUAR_${item.noKK}_${Date.now()}.${ext}`;
            const copied = await copyFileInDrive(accessToken, item.rLuarDriveFileId, newName, targetFolderId || undefined);
            if (copied?.id) {
              newLuarId = copied.id;
              copiedCount++;
            }
          }

          if (item.rDalamDriveFileId) {
            const ext = item.rDalamFilename ? item.rDalamFilename.split('.').pop() || 'jpg' : 'jpg';
            const newName = `RUMAH_DALAM_${item.noKK}_${Date.now()}.${ext}`;
            const copied = await copyFileInDrive(accessToken, item.rDalamDriveFileId, newName, targetFolderId || undefined);
            if (copied?.id) {
              newDalamId = copied.id;
              copiedCount++;
            }
          }

          if (!newLuarId && !newDalamId && !item.statusRumah && !item.usaha) {
            continue;
          }

          const existingAsetEntry = aspendAsetMap.get(item.noKK);

          if (existingAsetEntry) {
            const oldAset = existingAsetEntry.data;
            const updatedAset: KpmAset = {
              ...oldAset,
              FotoRumahLuar: newLuarId || (mode === 'overwrite' ? '' : oldAset.FotoRumahLuar),
              FotoRumahDalam: newDalamId || (mode === 'overwrite' ? '' : oldAset.FotoRumahDalam),
              StatusRumah: oldAset.StatusRumah || item.statusRumah || 'Milik Sendiri',
              Usaha: oldAset.Usaha || item.usaha || 'Tidak Memiliki Usaha',
              JenisUsaha: oldAset.JenisUsaha || item.jenisUsaha || '',
            };

            asetRangesToUpdate.push({
              range: `${KPM_SHEET_ASET}!A${existingAsetEntry.rowIndex}:M${existingAsetEntry.rowIndex}`,
              values: [asetToRow(updatedAset)],
            });
            asetUpdatedCount++;
          } else {
            const newAset: KpmAset = {
              AsetId: generateAsetId(),
              NoKK: item.noKK,
              StatusRumah: item.statusRumah || 'Milik Sendiri',
              Usaha: item.usaha || 'Tidak Memiliki Usaha',
              JenisUsaha: item.jenisUsaha || '',
              FotoUsaha: '',
              FotoRumahLuar: newLuarId,
              FotoRumahDalam: newDalamId,
              Latitude: '',
              Longitude: '',
              TahunMenerimaBansos: '',
              Keterangan: 'Impor dari database KPM lama',
              CreatedAt: new Date().toISOString(),
            };
            asetRowsToAppend.push(asetToRow(newAset));
            asetCreatedCount++;
          }

          const existingKeluargaEntry = aspendKeluargaMap.get(item.noKK);
          if (existingKeluargaEntry) {
            const kpm = existingKeluargaEntry.data;
            if (!kpm.FotoRumah && (newLuarId || newDalamId)) {
              const updatedKpm: KpmKeluarga = {
                ...kpm,
                FotoRumah: newLuarId || newDalamId,
                UpdatedAt: new Date().toISOString(),
              };
              keluargaRangesToUpdate.push({
                range: `${KPM_SHEET_KELUARGA}!A${existingKeluargaEntry.rowIndex}:AB${existingKeluargaEntry.rowIndex}`,
                values: [keluargaToRow(updatedKpm)],
              });
            }
          }
        } catch (itemErr: any) {
          errors.push(`Gagal memproses KK ${item.noKK}: ${itemErr.message}`);
        }
      }

      if (asetRangesToUpdate.length > 0) {
        for (let i = 0; i < asetRangesToUpdate.length; i += 100) {
          await batchUpdateSheetValues(accessToken, aspendSpreadsheetId, asetRangesToUpdate.slice(i, i + 100));
        }
      }

      if (asetRowsToAppend.length > 0) {
        await appendSheetData(accessToken, aspendSpreadsheetId, `${KPM_SHEET_ASET}!A:M`, asetRowsToAppend);
      }

      if (keluargaRangesToUpdate.length > 0) {
        for (let i = 0; i < keluargaRangesToUpdate.length; i += 100) {
          await batchUpdateSheetValues(accessToken, aspendSpreadsheetId, keluargaRangesToUpdate.slice(i, i + 100));
        }
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil menyalin ${copiedCount} foto ke Google Drive ASPEND. Data Aset diperbarui: ${asetUpdatedCount}, data Aset baru dibuat: ${asetCreatedCount}.`,
        copiedCount,
        asetUpdatedCount,
        asetCreatedCount,
        errors,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 3. ACTION: COMMIT-UPLOAD (Upload via ZIP or Direct Image Files)
    // ─────────────────────────────────────────────────────────────
    if (action === 'commit-upload') {
      if (!itemsToProcess || itemsToProcess.length === 0) {
        return NextResponse.json({ error: 'Data KPM untuk impor foto kosong.' }, { status: 400 });
      }

      const targetFolderId = await getOrCreateFolder(accessToken, 'RHK-agent_FotoKPM');

      const imageBuffersMap = new Map<string, Buffer>();
      const imagePrefixMap = new Map<string, Buffer>();
      const imageDocKeyMap = new Map<string, Buffer>();

      if (zipBuffer) {
        const zip = await JSZip.loadAsync(zipBuffer);
        for (const [filename, fileObj] of Object.entries(zip.files)) {
          if (!fileObj.dir && !filename.startsWith('__MACOSX')) {
            const buf = Buffer.from(await fileObj.async('arraybuffer'));
            const cleanName = cleanPhotoFilename(filename).toLowerCase();
            imageBuffersMap.set(cleanName, buf);

            const parts = cleanName.split(/[\._]/);
            if (parts.length >= 2) {
              imagePrefixMap.set(`${parts[0]}.${parts[1]}`, buf);
            }

            const cDigits = cleanDigits(parts[0]);
            const dType = detectDocType(cleanName);
            if (cDigits && dType) {
              imageDocKeyMap.set(`${cDigits}:${dType}`, buf);
            }
          }
        }
      }

      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((f) => {
          const cleanName = cleanPhotoFilename(f.name).toLowerCase();
          imageBuffersMap.set(cleanName, f.buffer);

          const parts = cleanName.split(/[\._]/);
          if (parts.length >= 2) {
            imagePrefixMap.set(`${parts[0]}.${parts[1]}`, f.buffer);
          }

          const cDigits = cleanDigits(parts[0]);
          const dType = detectDocType(cleanName);
          if (cDigits && dType) {
            imageDocKeyMap.set(`${cDigits}:${dType}`, f.buffer);
          }
        });
      }

      if (imageBuffersMap.size === 0) {
        return NextResponse.json({ error: 'Tidak ada file foto yang berhasil diekstrak atau diunggah.' }, { status: 400 });
      }

      const findImageBuffer = (noKK: string, filename: string, type: 'ktp' | 'kk' | 'butab' | 'kks' | 'selfie') => {
        if (filename) {
          const clean = cleanPhotoFilename(filename).toLowerCase();
          let buf = imageBuffersMap.get(clean);
          if (buf) return buf;

          const parts = clean.split(/[\._]/);
          if (parts.length >= 2) {
            buf = imagePrefixMap.get(`${parts[0]}.${parts[1]}`);
            if (buf) return buf;
          }
        }

        const cDigits = cleanDigits(noKK);
        if (cDigits) {
          const buf = imageDocKeyMap.get(`${cDigits}:${type}`);
          if (buf) return buf;
        }

        return null;
      };

      let uploadedCount = 0;
      let asetUpdatedCount = 0;
      let asetCreatedCount = 0;
      let keluargaUpdatedCount = 0;
      const errors: string[] = [];

      const asetRangesToUpdate: Array<{ range: string; values: string[][] }> = [];
      const asetRowsToAppend: string[][] = [];
      const keluargaRangesToUpdate: Array<{ range: string; values: string[][] }> = [];

      // ─── COMMIT-UPLOAD FOR DOKUMEN ───
      if (category === 'dokumen') {
        for (const item of itemsToProcess) {
          try {
            let newSelfieId = '';
            let newKtpId = '';
            let newKkId = '';
            let newButabId = '';
            let newKksId = '';

            const selfieBuf = findImageBuffer(item.noKK, item.selfieFilename, 'selfie');
            if (selfieBuf) {
              const ext = item.selfieFilename ? item.selfieFilename.split('.').pop() || 'jpg' : 'jpg';
              const newName = `SELFIE_${item.noKK}_${Date.now()}.${ext}`;
              const upResult = await uploadFileToDrive(accessToken, newName, 'image/jpeg', selfieBuf, targetFolderId || undefined);
              if (upResult?.id) {
                newSelfieId = upResult.id;
                uploadedCount++;
              }
            }

            const ktpBuf = findImageBuffer(item.noKK, item.ktpFilename, 'ktp');
            if (ktpBuf) {
              const ext = item.ktpFilename ? item.ktpFilename.split('.').pop() || 'jpg' : 'jpg';
              const newName = `KTP_${item.noKK}_${Date.now()}.${ext}`;
              const upResult = await uploadFileToDrive(accessToken, newName, 'image/jpeg', ktpBuf, targetFolderId || undefined);
              if (upResult?.id) {
                newKtpId = upResult.id;
                uploadedCount++;
              }
            }

            const kkBuf = findImageBuffer(item.noKK, item.kkFilename, 'kk');
            if (kkBuf) {
              const ext = item.kkFilename ? item.kkFilename.split('.').pop() || 'jpg' : 'jpg';
              const newName = `KK_${item.noKK}_${Date.now()}.${ext}`;
              const upResult = await uploadFileToDrive(accessToken, newName, 'image/jpeg', kkBuf, targetFolderId || undefined);
              if (upResult?.id) {
                newKkId = upResult.id;
                uploadedCount++;
              }
            }

            const butabBuf = findImageBuffer(item.noKK, item.butabFilename, 'butab');
            if (butabBuf) {
              const ext = item.butabFilename ? item.butabFilename.split('.').pop() || 'jpg' : 'jpg';
              const newName = `BUTAB_${item.noKK}_${Date.now()}.${ext}`;
              const upResult = await uploadFileToDrive(accessToken, newName, 'image/jpeg', butabBuf, targetFolderId || undefined);
              if (upResult?.id) {
                newButabId = upResult.id;
                uploadedCount++;
              }
            }

            const kksBuf = findImageBuffer(item.noKK, item.kksFilename, 'kks');
            if (kksBuf) {
              const ext = item.kksFilename ? item.kksFilename.split('.').pop() || 'jpg' : 'jpg';
              const newName = `KKS_${item.noKK}_${Date.now()}.${ext}`;
              const upResult = await uploadFileToDrive(accessToken, newName, 'image/jpeg', kksBuf, targetFolderId || undefined);
              if (upResult?.id) {
                newKksId = upResult.id;
                uploadedCount++;
              }
            }

            if (!newSelfieId && !newKtpId && !newKkId && !newButabId && !newKksId) {
              continue;
            }

            const existingKeluargaEntry = aspendKeluargaMap.get(item.noKK);
            if (existingKeluargaEntry) {
              const oldKpm = existingKeluargaEntry.data;
              const updatedKpm: KpmKeluarga = { ...oldKpm };

              if (newSelfieId && (mode === 'overwrite' || !oldKpm.FotoSelfie)) {
                updatedKpm.FotoSelfie = newSelfieId;
              }
              if (newKtpId && (mode === 'overwrite' || !oldKpm.FotoKTP)) {
                updatedKpm.FotoKTP = newKtpId;
              }
              if (newKkId && (mode === 'overwrite' || !oldKpm.FotoKK)) {
                updatedKpm.FotoKK = newKkId;
              }
              if (newButabId && (mode === 'overwrite' || !oldKpm.FotoBukuTabungan)) {
                updatedKpm.FotoBukuTabungan = newButabId;
              }
              if (newKksId && (mode === 'overwrite' || !oldKpm.FotoKKS)) {
                updatedKpm.FotoKKS = newKksId;
              }

              updatedKpm.UpdatedAt = new Date().toISOString();

              keluargaRangesToUpdate.push({
                range: `${KPM_SHEET_KELUARGA}!A${existingKeluargaEntry.rowIndex}:AB${existingKeluargaEntry.rowIndex}`,
                values: [keluargaToRow(updatedKpm)],
              });
              keluargaUpdatedCount++;
            }
          } catch (itemErr: any) {
            errors.push(`Gagal memproses berkas KK ${item.noKK}: ${itemErr.message}`);
          }
        }

        if (keluargaRangesToUpdate.length > 0) {
          for (let i = 0; i < keluargaRangesToUpdate.length; i += 100) {
            await batchUpdateSheetValues(accessToken, aspendSpreadsheetId, keluargaRangesToUpdate.slice(i, i + 100));
          }
        }

        return NextResponse.json({
          success: true,
          message: `Berhasil mengunggah ${uploadedCount} berkas/foto dokumen ke Google Drive ASPEND. Data profil KPM diperbarui: ${keluargaUpdatedCount} keluarga.`,
          uploadedCount,
          keluargaUpdatedCount,
          errors,
        });
      }

      // ─── COMMIT-UPLOAD FOR RUMAH ───
      for (const item of itemsToProcess) {
        try {
          let newLuarId = '';
          let newDalamId = '';

          if (item.rLuarFilename) {
            const clean = item.rLuarFilename.toLowerCase();
            let buf = imageBuffersMap.get(clean);
            if (!buf) {
              const parts = clean.split(/[\._]/);
              if (parts.length >= 2) buf = imagePrefixMap.get(`${parts[0]}.${parts[1]}`);
            }

            if (buf) {
              const ext = item.rLuarFilename.split('.').pop() || 'jpg';
              const newName = `RUMAH_LUAR_${item.noKK}_${Date.now()}.${ext}`;
              const upResult = await uploadFileToDrive(accessToken, newName, 'image/jpeg', buf, targetFolderId || undefined);
              if (upResult?.id) {
                newLuarId = upResult.id;
                uploadedCount++;
              }
            }
          }

          if (item.rDalamFilename) {
            const clean = item.rDalamFilename.toLowerCase();
            let buf = imageBuffersMap.get(clean);
            if (!buf) {
              const parts = clean.split(/[\._]/);
              if (parts.length >= 2) buf = imagePrefixMap.get(`${parts[0]}.${parts[1]}`);
            }

            if (buf) {
              const ext = item.rDalamFilename.split('.').pop() || 'jpg';
              const newName = `RUMAH_DALAM_${item.noKK}_${Date.now()}.${ext}`;
              const upResult = await uploadFileToDrive(accessToken, newName, 'image/jpeg', buf, targetFolderId || undefined);
              if (upResult?.id) {
                newDalamId = upResult.id;
                uploadedCount++;
              }
            }
          }

          if (!newLuarId && !newDalamId && !item.statusRumah && !item.usaha) {
            continue;
          }

          const existingAsetEntry = aspendAsetMap.get(item.noKK);

          if (existingAsetEntry) {
            const oldAset = existingAsetEntry.data;
            const updatedAset: KpmAset = {
              ...oldAset,
              FotoRumahLuar: newLuarId || (mode === 'overwrite' ? '' : oldAset.FotoRumahLuar),
              FotoRumahDalam: newDalamId || (mode === 'overwrite' ? '' : oldAset.FotoRumahDalam),
              StatusRumah: oldAset.StatusRumah || item.statusRumah || 'Milik Sendiri',
              Usaha: oldAset.Usaha || item.usaha || 'Tidak Memiliki Usaha',
              JenisUsaha: oldAset.JenisUsaha || item.jenisUsaha || '',
            };

            asetRangesToUpdate.push({
              range: `${KPM_SHEET_ASET}!A${existingAsetEntry.rowIndex}:M${existingAsetEntry.rowIndex}`,
              values: [asetToRow(updatedAset)],
            });
            asetUpdatedCount++;
          } else {
            const newAset: KpmAset = {
              AsetId: generateAsetId(),
              NoKK: item.noKK,
              StatusRumah: item.statusRumah || 'Milik Sendiri',
              Usaha: item.usaha || 'Tidak Memiliki Usaha',
              JenisUsaha: item.jenisUsaha || '',
              FotoUsaha: '',
              FotoRumahLuar: newLuarId,
              FotoRumahDalam: newDalamId,
              Latitude: '',
              Longitude: '',
              TahunMenerimaBansos: '',
              Keterangan: 'Impor dari database KPM lama',
              CreatedAt: new Date().toISOString(),
            };
            asetRowsToAppend.push(asetToRow(newAset));
            asetCreatedCount++;
          }

          const existingKeluargaEntry = aspendKeluargaMap.get(item.noKK);
          if (existingKeluargaEntry) {
            const kpm = existingKeluargaEntry.data;
            if (!kpm.FotoRumah && (newLuarId || newDalamId)) {
              const updatedKpm: KpmKeluarga = {
                ...kpm,
                FotoRumah: newLuarId || newDalamId,
                UpdatedAt: new Date().toISOString(),
              };
              keluargaRangesToUpdate.push({
                range: `${KPM_SHEET_KELUARGA}!A${existingKeluargaEntry.rowIndex}:AB${existingKeluargaEntry.rowIndex}`,
                values: [keluargaToRow(updatedKpm)],
              });
            }
          }
        } catch (itemErr: any) {
          errors.push(`Gagal memproses KK ${item.noKK}: ${itemErr.message}`);
        }
      }

      if (asetRangesToUpdate.length > 0) {
        for (let i = 0; i < asetRangesToUpdate.length; i += 100) {
          await batchUpdateSheetValues(accessToken, aspendSpreadsheetId, asetRangesToUpdate.slice(i, i + 100));
        }
      }

      if (asetRowsToAppend.length > 0) {
        await appendSheetData(accessToken, aspendSpreadsheetId, `${KPM_SHEET_ASET}!A:M`, asetRowsToAppend);
      }

      if (keluargaRangesToUpdate.length > 0) {
        for (let i = 0; i < keluargaRangesToUpdate.length; i += 100) {
          await batchUpdateSheetValues(accessToken, aspendSpreadsheetId, keluargaRangesToUpdate.slice(i, i + 100));
        }
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil mengunggah ${uploadedCount} foto ke Google Drive ASPEND. Data Aset diperbarui: ${asetUpdatedCount}, data Aset baru dibuat: ${asetCreatedCount}.`,
        uploadedCount,
        asetUpdatedCount,
        asetCreatedCount,
        errors,
      });
    }

    return NextResponse.json({ error: 'Action tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    console.error('KPM Import Photos error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan pada server saat memproses impor foto.' }, { status: 500 });
  }
}
