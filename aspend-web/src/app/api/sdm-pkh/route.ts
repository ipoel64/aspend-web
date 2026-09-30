import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import { getSheetData, appendSheetData, updateSheetRow, deleteSheetRow } from '@/lib/google-sheets';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SDM_SHEET_NAME = 'Master_SDM_PKH';
const SDM_HEADERS = ['ID', 'Nama', 'NIP'];

export interface SdmPkhItem {
  id: string;
  nama: string;
  nip: string;
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

    let rows: any[][] = [];
    try {
      rows = await getSheetData(accessToken as string, spreadsheetId, `${SDM_SHEET_NAME}!A2:C`);
    } catch {
      return NextResponse.json({ success: true, data: [] });
    }

    const list: SdmPkhItem[] = (rows || [])
      .filter(r => r && r[1])
      .map(r => ({
        id: r[0] || `${Date.now()}_${Math.random()}`,
        nama: r[1] || '',
        nip: r[2] || '',
      }));

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
      return NextResponse.json({ error: 'Spreadsheet tidak ditemukan.' }, { status: 404 });
    }

    const body = await request.json();

    // Check if headers exist
    try {
      const check = await getSheetData(accessToken as string, spreadsheetId, `${SDM_SHEET_NAME}!A1:C1`);
      if (!check || check.length === 0) {
        await appendSheetData(accessToken as string, spreadsheetId, `${SDM_SHEET_NAME}!A1:C1`, [SDM_HEADERS]);
      }
    } catch {
      try {
        await appendSheetData(accessToken as string, spreadsheetId, `${SDM_SHEET_NAME}!A1:C1`, [SDM_HEADERS]);
      } catch {}
    }

    // Support single item or bulk items (impor excel)
    if (body.items && Array.isArray(body.items)) {
      const rowsToAppend = body.items
        .filter((it: any) => it.nama && it.nama.trim())
        .map((it: any) => [
          it.id || `SDM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          it.nama.trim(),
          (it.nip || '').trim()
        ]);

      if (rowsToAppend.length > 0) {
        await appendSheetData(accessToken as string, spreadsheetId, `${SDM_SHEET_NAME}!A:C`, rowsToAppend);
      }
      return NextResponse.json({
        success: true,
        message: `${rowsToAppend.length} data pendamping berhasil diimpor!`,
        count: rowsToAppend.length
      });
    }

    const { nama, nip } = body;
    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: 'Nama pendamping wajib diisi.' }, { status: 400 });
    }

    const newId = `SDM-${Date.now()}`;
    const newRow = [newId, nama.trim(), (nip || '').trim()];

    await appendSheetData(accessToken as string, spreadsheetId, `${SDM_SHEET_NAME}!A:C`, [newRow]);

    return NextResponse.json({
      success: true,
      message: 'Data SDM PKH berhasil ditambahkan!',
      data: {
        id: newId,
        nama: nama.trim(),
        nip: (nip || '').trim()
      }
    });
  } catch (error: any) {
    console.error('Error adding SDM PKH:', error);
    return NextResponse.json({ error: error.message || 'Gagal menambahkan SDM PKH.' }, { status: 500 });
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

    const { id, nama, nip } = await request.json();
    if (!id || !nama || !nama.trim()) {
      return NextResponse.json({ error: 'ID dan Nama wajib diisi.' }, { status: 400 });
    }

    const rows = await getSheetData(accessToken as string, spreadsheetId, `${SDM_SHEET_NAME}!A:C`);
    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return NextResponse.json({ error: 'Data SDM tidak ditemukan.' }, { status: 404 });
    }

    await updateSheetRow(
      accessToken as string,
      spreadsheetId,
      `${SDM_SHEET_NAME}!A${targetRow}:C${targetRow}`,
      [[id, nama.trim(), (nip || '').trim()]]
    );

    return NextResponse.json({
      success: true,
      message: 'Data SDM PKH berhasil diperbarui!',
      data: { id, nama: nama.trim(), nip: (nip || '').trim() }
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

    const rows = await getSheetData(accessToken as string, spreadsheetId, `${SDM_SHEET_NAME}!A:C`);
    let targetRow0Based = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        targetRow0Based = i;
        break;
      }
    }

    if (targetRow0Based === -1) {
      return NextResponse.json({ error: 'Data tidak ditemukan.' }, { status: 404 });
    }

    await deleteSheetRow(accessToken as string, spreadsheetId, SDM_SHEET_NAME, targetRow0Based);

    return NextResponse.json({ success: true, message: 'Data SDM PKH berhasil dihapus.' });
  } catch (error: any) {
    console.error('Error deleting SDM PKH:', error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus data SDM PKH.' }, { status: 500 });
  }
}
