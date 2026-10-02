import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import {
  getSheetsClient,
  getSheetData,
  appendSheetData,
  updateSheetRow,
  deleteSheetRow
} from '@/lib/google-sheets';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export interface SdmPkhItem {
  id: string;
  nama: string;
  nip: string;
}

/**
 * Memastikan sheet SDM_PKH ada di Google Spreadsheet.
 * Jika belum ada, otomatis dibuat via Google Sheets API batchUpdate addSheet.
 * Mendukung baik nama tab 'SDM_PKH' maupun 'Master_SDM_PKH'.
 */
async function resolveSdmSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{ sheetName: string; hasIdCol: boolean }> {
  const sheets = await getSheetsClient(accessToken);
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets || [];

  // Cari apakah ada sheet dengan nama 'SDM_PKH' atau 'Master_SDM_PKH'
  const foundSheet = sheetList.find((s) => {
    const title = s.properties?.title || '';
    return title === 'SDM_PKH' || title === 'Master_SDM_PKH';
  });

  const targetSheetName = foundSheet?.properties?.title || 'SDM_PKH';

  // 1. Jika sheet belum ada, BUAT TAB BARU secara resmi
  if (!foundSheet) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: targetSheetName,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
              },
            },
          ],
        },
      });

      // Tulis baris header awal
      await appendSheetData(accessToken, spreadsheetId, `${targetSheetName}!A1:C1`, [
        ['ID', 'Nama SDM', 'NIP'],
      ]);

      return { sheetName: targetSheetName, hasIdCol: true };
    } catch (err: any) {
      console.error('Gagal membuat sheet SDM_PKH:', err);
      throw new Error(`Gagal membuat tab ${targetSheetName} di Google Spreadsheet: ${err?.message || err}`);
    }
  }

  // 2. Jika sheet sudah ada, deteksi apakah memiliki kolom 'ID' atau langsung 'Nama'
  try {
    const headerData = await getSheetData(accessToken, spreadsheetId, `${targetSheetName}!A1:E1`);
    if (!headerData || headerData.length === 0 || !headerData[0] || headerData[0].length === 0) {
      await appendSheetData(accessToken, spreadsheetId, `${targetSheetName}!A1:C1`, [
        ['ID', 'Nama SDM', 'NIP'],
      ]);
      return { sheetName: targetSheetName, hasIdCol: true };
    }

    const firstRow = headerData[0].map((c: any) => String(c || '').trim().toLowerCase());
    const hasIdCol = firstRow.includes('id');
    return { sheetName: targetSheetName, hasIdCol };
  } catch {
    return { sheetName: targetSheetName, hasIdCol: true };
  }
}

export async function GET() {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const spreadsheetId = await findAspendSpreadsheet(accessToken as string);
    if (!spreadsheetId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { sheetName, hasIdCol } = await resolveSdmSheet(accessToken as string, spreadsheetId);

    let rows: any[][] = [];
    try {
      rows = await getSheetData(accessToken as string, spreadsheetId, `${sheetName}!A2:D`);
    } catch {
      return NextResponse.json({ success: true, data: [] });
    }

    const list: SdmPkhItem[] = [];
    for (let i = 0; i < (rows || []).length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      let id = '';
      let nama = '';
      let nip = '';

      if (hasIdCol) {
        id = r[0] ? String(r[0]).trim() : `SDM-${i + 1}`;
        nama = r[1] ? String(r[1]).trim() : '';
        nip = r[2] ? String(r[2]).trim() : '';
      } else {
        nama = r[0] ? String(r[0]).trim() : '';
        nip = r[1] ? String(r[1]).trim() : '';
        id = nip ? `SDM-${nip}` : `SDM-${i + 1}`;
      }

      const lowerNama = nama.toLowerCase();
      if (nama && lowerNama !== 'nama' && lowerNama !== 'nama sdm') {
        list.push({ id, nama, nip });
      }
    }

    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    console.error('Error fetching SDM PKH list:', error);
    return NextResponse.json({ error: error.message || 'Gagal memuat data SDM PKH.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const spreadsheetId = await findAspendSpreadsheet(accessToken as string);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet database tidak ditemukan.' }, { status: 404 });
    }

    const { sheetName, hasIdCol } = await resolveSdmSheet(accessToken as string, spreadsheetId);
    const body = await request.json();

    // 1. Dukungan Impor Excel (Bulk Items)
    if (body.items && Array.isArray(body.items)) {
      const validItems = body.items.filter((it: any) => {
        const n = String(it.nama || '').trim().toLowerCase();
        return n && n !== 'nama' && n !== 'nama sdm';
      });

      if (validItems.length === 0) {
        return NextResponse.json({ error: 'Tidak ada data SDM yang valid untuk diimpor.' }, { status: 400 });
      }

      const rowsToAppend = validItems.map((it: any, idx: number) => {
        const sdmId = it.id || `SDM-${Date.now()}-${idx + 1}`;
        const sdmNama = String(it.nama).trim();
        const sdmNip = it.nip ? String(it.nip).trim() : '';

        return hasIdCol
          ? [sdmId, sdmNama, sdmNip]
          : [sdmNama, sdmNip];
      });

      const appendRange = hasIdCol ? `${sheetName}!A:C` : `${sheetName}!A:B`;
      await appendSheetData(accessToken as string, spreadsheetId, appendRange, rowsToAppend);

      return NextResponse.json({
        success: true,
        message: `${rowsToAppend.length} data SDM PKH berhasil diimpor ke Google Sheets!`,
        count: rowsToAppend.length,
      });
    }

    // 2. Tambah Data Tunggal (Manual)
    const { nama, nip } = body;
    if (!nama || !String(nama).trim()) {
      return NextResponse.json({ error: 'Nama pendamping wajib diisi.' }, { status: 400 });
    }

    const newId = `SDM-${Date.now()}`;
    const cleanNama = String(nama).trim();
    const cleanNip = nip ? String(nip).trim() : '';

    const newRow = hasIdCol
      ? [newId, cleanNama, cleanNip]
      : [cleanNama, cleanNip];

    const appendRange = hasIdCol ? `${sheetName}!A:C` : `${sheetName}!A:B`;
    await appendSheetData(accessToken as string, spreadsheetId, appendRange, [newRow]);

    return NextResponse.json({
      success: true,
      message: 'Data SDM PKH berhasil ditambahkan ke Google Sheets!',
      data: {
        id: newId,
        nama: cleanNama,
        nip: cleanNip,
      },
    });
  } catch (error: any) {
    console.error('Error adding/importing SDM PKH:', error);
    return NextResponse.json({ error: error.message || 'Gagal menyimpan data ke Google Sheets.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const spreadsheetId = await findAspendSpreadsheet(accessToken as string);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet tidak ditemukan.' }, { status: 404 });
    }

    const { sheetName, hasIdCol } = await resolveSdmSheet(accessToken as string, spreadsheetId);
    const { id, nama, nip } = await request.json();

    if (!nama || !String(nama).trim()) {
      return NextResponse.json({ error: 'Nama pendamping wajib diisi.' }, { status: 400 });
    }

    const rows = await getSheetData(accessToken as string, spreadsheetId, `${sheetName}!A1:D`);
    let targetRow = -1;

    for (let i = 1; i < (rows || []).length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      if (hasIdCol && r[0] === id) {
        targetRow = i + 1; // 1-based index
        break;
      } else if (!hasIdCol && (r[1] === nip || `SDM-${i}` === id || `SDM-${r[1]}` === id)) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return NextResponse.json({ error: 'Data SDM tidak ditemukan di spreadsheet.' }, { status: 404 });
    }

    const cleanNama = String(nama).trim();
    const cleanNip = nip ? String(nip).trim() : '';

    const updatedRow = hasIdCol
      ? [[id, cleanNama, cleanNip]]
      : [[cleanNama, cleanNip]];

    const range = hasIdCol
      ? `${sheetName}!A${targetRow}:C${targetRow}`
      : `${sheetName}!A${targetRow}:B${targetRow}`;

    await updateSheetRow(accessToken as string, spreadsheetId, range, updatedRow);

    return NextResponse.json({
      success: true,
      message: 'Data SDM PKH berhasil diperbarui!',
      data: { id, nama: cleanNama, nip: cleanNip },
    });
  } catch (error: any) {
    console.error('Error updating SDM PKH:', error);
    return NextResponse.json({ error: error.message || 'Gagal memperbarui data SDM PKH.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID wajib disertakan.' }, { status: 400 });
    }

    const spreadsheetId = await findAspendSpreadsheet(accessToken as string);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet tidak ditemukan.' }, { status: 404 });
    }

    const { sheetName, hasIdCol } = await resolveSdmSheet(accessToken as string, spreadsheetId);
    const rows = await getSheetData(accessToken as string, spreadsheetId, `${sheetName}!A1:D`);
    let targetRow0Based = -1;

    for (let i = 1; i < (rows || []).length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      if (hasIdCol && r[0] === id) {
        targetRow0Based = i;
        break;
      } else if (!hasIdCol && (`SDM-${i}` === id || `SDM-${r[1]}` === id || r[1] === id)) {
        targetRow0Based = i;
        break;
      }
    }

    if (targetRow0Based === -1) {
      return NextResponse.json({ error: 'Data SDM tidak ditemukan.' }, { status: 404 });
    }

    await deleteSheetRow(accessToken as string, spreadsheetId, sheetName, targetRow0Based);

    return NextResponse.json({ success: true, message: 'Data SDM PKH berhasil dihapus.' });
  } catch (error: any) {
    console.error('Error deleting SDM PKH:', error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus data SDM PKH.' }, { status: 500 });
  }
}
