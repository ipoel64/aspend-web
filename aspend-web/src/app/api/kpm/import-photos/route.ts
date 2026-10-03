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

  // Find column indices
  let colNKK = headers.findIndex((h) => h === 'NKK' || h === 'NO. KK' || h === 'NO KK' || h.includes('KARTU KELUARGA'));
  let colPengurus = headers.findIndex((h) => h === 'PENGURUS' || h.includes('NAMA'));
  let colStatus = headers.findIndex((h) => h.includes('TATUS') || h.includes('RUMAH'));
  let colUsaha = headers.findIndex((h) => h === 'USAHA' || h.includes('KEPEMILIKAN USAHA'));
  let colJenis = headers.findIndex((h) => h === 'JENIS' || h.includes('JENIS USAHA'));
  let colRLuar = headers.findIndex((h) => h.includes('R_LUAR') || h.includes('LUAR'));
  let colRDalam = headers.findIndex((h) => h.includes('R_DALAM') || h.includes('DALAM'));

  // Fallback defaults based on user's screenshot if headers didn't match perfectly:
  // Col C (2): K, Col D (3): NKK, Col E (4): PENGURUS, Col F (5): TATUS_, Col G (6): USAHA, Col H (7): JENIS, Col I (8): R_LUAR, Col J (9): R_DALAM
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
    let oldSpreadsheetId = '';
    let oldDriveFolderId = '';
    let mode = 'overwrite'; // 'skip' | 'overwrite'
    let fileBuffer: Buffer | null = null;
    let zipBuffer: Buffer | null = null;
    let uploadedFiles: Array<{ name: string; buffer: Buffer }> = [];
    let itemsToProcess: any[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      action = (formData.get('action') as string) || 'preview';
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
      oldSpreadsheetId = extractSpreadsheetId(body.oldSpreadsheetId || '');
      oldDriveFolderId = extractDriveFolderId(body.oldDriveFolderId || '');
      mode = body.mode || 'overwrite';
      itemsToProcess = body.items || [];
    }

    // Ensure sheets exist in ASPEND
    await ensureSheetExists(accessToken, aspendSpreadsheetId, KPM_SHEET_KELUARGA, KPM_KELUARGA_HEADERS);
    await ensureSheetExists(accessToken, aspendSpreadsheetId, KPM_SHEET_ASET, KPM_ASET_HEADERS);

    // Read current ASPEND Keluarga & Aset
    const rawKeluarga = await getSheetData(accessToken, aspendSpreadsheetId, `${KPM_SHEET_KELUARGA}!A2:AA`).catch(() => []);
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
        for (const sName of workbook.SheetNames) {
          if (sName.toLowerCase().includes('rumah') || sName.toLowerCase().includes('aset')) {
            ws = workbook.Sheets[sName];
            break;
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

          for (const s of sheetList) {
            const title = s.properties?.title || '';
            if (title.toLowerCase().includes('rumah') || title.toLowerCase().includes('aset')) {
              targetSheetName = title;
              break;
            }
          }

          rawOldRows = await getSheetData(accessToken, oldSpreadsheetId, `${targetSheetName}!A1:Z5000`);
        } catch (err: any) {
          return NextResponse.json({
            error: `Gagal membaca Google Sheet lama: ${err.message || 'Pastikan Sheet telah dibagikan atau dapat diakses.'}`,
          }, { status: 400 });
        }
      } else {
        return NextResponse.json({
          error: 'Harap unggah file Excel tabel "RUMAH" atau masukkan ID/Link Google Sheet database lama.',
        }, { status: 400 });
      }

      const parsedRows = parseOldSheetData(rawOldRows);
      if (parsedRows.length === 0) {
        return NextResponse.json({
          error: 'Tidak ditemukan baris data KPM yang valid pada sheet/file yang diberikan. Pastikan terdapat kolom NKK, R_LUAR, atau R_DALAM.',
        }, { status: 400 });
      }

      // If Drive Folder ID is provided, scan the Drive folder
      let driveFilesMap = new Map<string, { id: string; name: string }>();
      let drivePrefixMap = new Map<string, { id: string; name: string }>();
      let driveFolderScanned = false;
      let driveScanError = '';

      if (oldDriveFolderId) {
        try {
          const files = await listFilesInFolder(accessToken, oldDriveFolderId);
          driveFolderScanned = true;
          files.forEach((f) => {
            const lowerName = f.name.toLowerCase();
            driveFilesMap.set(lowerName, f);

            // Create prefix key e.g. "13e1e626.r_luar"
            const parts = lowerName.split('.');
            if (parts.length >= 2) {
              const prefix = `${parts[0]}.${parts[1]}`;
              drivePrefixMap.set(prefix, f);
            }
          });
          if (files.length === 0) {
            driveScanError = 'Folder Google Drive terhubung namun terbaca 0 file. Hal ini biasanya terjadi karena folder dibuat oleh akun Google yang berbeda atau pembatasan izin privasi Google Drive API. Disarankan menggunakan Tab 2 (Unggah File ZIP Foto) untuk proses instan.';
          }
        } catch (err: any) {
          driveScanError = err.message || 'Gagal memindai folder Google Drive.';
          console.warn('Drive folder scan error:', err);
        }
      }

      // Analyze matching
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

        // Match R_LUAR file in Drive folder if scanned
        let rLuarFoundFile: { id: string; name: string } | null = null;
        if (row.rLuarFilename && driveFolderScanned) {
          const lower = row.rLuarFilename.toLowerCase();
          rLuarFoundFile = driveFilesMap.get(lower) || null;
          if (!rLuarFoundFile) {
            const parts = lower.split('.');
            if (parts.length >= 2) {
              rLuarFoundFile = drivePrefixMap.get(`${parts[0]}.${parts[1]}`) || null;
            }
          }
        }
        if (rLuarFoundFile) rLuarMatchCount++;

        // Match R_DALAM file in Drive folder if scanned
        let rDalamFoundFile: { id: string; name: string } | null = null;
        if (row.rDalamFilename && driveFolderScanned) {
          const lower = row.rDalamFilename.toLowerCase();
          rDalamFoundFile = driveFilesMap.get(lower) || null;
          if (!rDalamFoundFile) {
            const parts = lower.split('.');
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

      // Target folder in current user's Google Drive
      const targetFolderId = await getOrCreateFolder(accessToken, 'RHK-agent_FotoKPM');

      let copiedCount = 0;
      let asetUpdatedCount = 0;
      let asetCreatedCount = 0;
      const errors: string[] = [];

      const asetRangesToUpdate: Array<{ range: string; values: string[][] }> = [];
      const asetRowsToAppend: string[][] = [];
      const keluargaRangesToUpdate: Array<{ range: string; values: string[][] }> = [];

      // Process each item
      for (const item of itemsToProcess) {
        try {
          let newLuarId = '';
          let newDalamId = '';

          // 1. Copy R_LUAR if exists
          if (item.rLuarDriveFileId) {
            const ext = item.rLuarFilename ? item.rLuarFilename.split('.').pop() || 'jpg' : 'jpg';
            const newName = `RUMAH_LUAR_${item.noKK}_${Date.now()}.${ext}`;
            const copied = await copyFileInDrive(accessToken, item.rLuarDriveFileId, newName, targetFolderId || undefined);
            if (copied?.id) {
              newLuarId = copied.id;
              copiedCount++;
            }
          }

          // 2. Copy R_DALAM if exists
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

          // 3. Update or Insert into KPM_Aset
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

          // 4. Update FotoRumah in KPM_Keluarga if currently empty
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
                range: `${KPM_SHEET_KELUARGA}!A${existingKeluargaEntry.rowIndex}:AA${existingKeluargaEntry.rowIndex}`,
                values: [keluargaToRow(updatedKpm)],
              });
            }
          }
        } catch (itemErr: any) {
          errors.push(`Gagal memproses KK ${item.noKK}: ${itemErr.message}`);
        }
      }

      // Execute Google Sheets updates in batches of 100
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

      // Build file map from ZIP or uploadedFiles
      const imageBuffersMap = new Map<string, Buffer>();

      if (zipBuffer) {
        const zip = await JSZip.loadAsync(zipBuffer);
        for (const [filename, fileObj] of Object.entries(zip.files)) {
          if (!fileObj.dir && !filename.startsWith('__MACOSX')) {
            const buf = Buffer.from(await fileObj.async('arraybuffer'));
            const cleanName = cleanPhotoFilename(filename).toLowerCase();
            imageBuffersMap.set(cleanName, buf);

            // Also map prefix
            const parts = cleanName.split('.');
            if (parts.length >= 2) {
              imageBuffersMap.set(`${parts[0]}.${parts[1]}`, buf);
            }
          }
        }
      }

      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((f) => {
          const cleanName = cleanPhotoFilename(f.name).toLowerCase();
          imageBuffersMap.set(cleanName, f.buffer);
          const parts = cleanName.split('.');
          if (parts.length >= 2) {
            imageBuffersMap.set(`${parts[0]}.${parts[1]}`, f.buffer);
          }
        });
      }

      if (imageBuffersMap.size === 0) {
        return NextResponse.json({ error: 'Tidak ada file foto yang berhasil diekstrak atau diunggah.' }, { status: 400 });
      }

      let uploadedCount = 0;
      let asetUpdatedCount = 0;
      let asetCreatedCount = 0;
      const errors: string[] = [];

      const asetRangesToUpdate: Array<{ range: string; values: string[][] }> = [];
      const asetRowsToAppend: string[][] = [];
      const keluargaRangesToUpdate: Array<{ range: string; values: string[][] }> = [];

      for (const item of itemsToProcess) {
        try {
          let newLuarId = '';
          let newDalamId = '';

          // Look for R_LUAR buffer
          if (item.rLuarFilename) {
            const clean = item.rLuarFilename.toLowerCase();
            let buf = imageBuffersMap.get(clean);
            if (!buf) {
              const parts = clean.split('.');
              if (parts.length >= 2) buf = imageBuffersMap.get(`${parts[0]}.${parts[1]}`);
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

          // Look for R_DALAM buffer
          if (item.rDalamFilename) {
            const clean = item.rDalamFilename.toLowerCase();
            let buf = imageBuffersMap.get(clean);
            if (!buf) {
              const parts = clean.split('.');
              if (parts.length >= 2) buf = imageBuffersMap.get(`${parts[0]}.${parts[1]}`);
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

          // Upsert KPM_Aset
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

          // Update KPM_Keluarga.FotoRumah
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
                range: `${KPM_SHEET_KELUARGA}!A${existingKeluargaEntry.rowIndex}:AA${existingKeluargaEntry.rowIndex}`,
                values: [keluargaToRow(updatedKpm)],
              });
            }
          }
        } catch (itemErr: any) {
          errors.push(`Gagal memproses KK ${item.noKK}: ${itemErr.message}`);
        }
      }

      // Execute batch updates
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
