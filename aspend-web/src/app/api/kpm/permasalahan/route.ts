import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import {
  getSheetData,
  appendSheetData,
  updateSheetRow,
  deleteSheetRow,
  findRowByKey,
} from '@/lib/google-sheets';
import {
  KPM_SHEET_PERMASALAHAN,
  KPM_PERMASALAHAN_HEADERS,
  generateMasalahId,
  parsePermasalahanRow,
  permasalahanToRow,
  KpmPermasalahan,
} from '@/lib/kpm-constants';
import { ensureSheetExists } from '@/lib/kpm-sheets';

export async function GET(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is set in jwt callback
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const noKK = searchParams.get('noKK');
    const status = searchParams.get('status');

    await ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_PERMASALAHAN, KPM_PERMASALAHAN_HEADERS);

    const rows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_PERMASALAHAN}!A2:J`);
    let data = rows.filter((r) => r.length > 0).map(parsePermasalahanRow);

    if (noKK) {
      data = data.filter((item) => item.NoKK === noKK);
    }
    if (status) {
      data = data.filter((item) => item.Status === status);
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('KPM Permasalahan GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is set in jwt callback
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });
    }

    const body = await request.json();
    if (!body.NoKK) {
      return NextResponse.json({ error: 'Nomor Kartu Keluarga (NoKK) wajib diisi' }, { status: 400 });
    }

    await ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_PERMASALAHAN, KPM_PERMASALAHAN_HEADERS);

    const newMasalah: KpmPermasalahan = {
      MasalahId: generateMasalahId(),
      NoKK: body.NoKK,
      JenisMasalah: body.JenisMasalah || 'Lainnya',
      Deskripsi: body.Deskripsi || '',
      Prioritas: body.Prioritas || 'Sedang',
      Status: body.Status || 'Terbuka',
      FotoBukti: body.FotoBukti || '',
      TindakLanjut: body.TindakLanjut || '',
      TanggalTindakLanjut: body.TanggalTindakLanjut || '',
      CreatedAt: new Date().toISOString(),
    };

    await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_PERMASALAHAN}!A:J`, [permasalahanToRow(newMasalah)]);
    return NextResponse.json({ success: true, data: newMasalah });
  } catch (error) {
    console.error('KPM Permasalahan POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is set in jwt callback
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });
    }

    const body = await request.json();
    if (!body.MasalahId) {
      return NextResponse.json({ error: 'MasalahId wajib diisi' }, { status: 400 });
    }

    const rowIndex = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_PERMASALAHAN, body.MasalahId, 0);
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Data masalah tidak ditemukan' }, { status: 404 });
    }

    const existingRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_PERMASALAHAN}!A${rowIndex}:J${rowIndex}`);
    const oldData = parsePermasalahanRow(existingRows[0] || []);

    const updatedData: KpmPermasalahan = {
      ...oldData,
      ...body,
      MasalahId: body.MasalahId,
    };

    await updateSheetRow(accessToken, spreadsheetId, `${KPM_SHEET_PERMASALAHAN}!A${rowIndex}:J${rowIndex}`, [permasalahanToRow(updatedData)]);
    return NextResponse.json({ success: true, data: updatedData });
  } catch (error) {
    console.error('KPM Permasalahan PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is set in jwt callback
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const masalahId = searchParams.get('masalahId');
    if (!masalahId) {
      return NextResponse.json({ error: 'MasalahId wajib diisi' }, { status: 400 });
    }

    const rowIndex = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_PERMASALAHAN, masalahId, 0);
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Data masalah tidak ditemukan' }, { status: 404 });
    }

    await deleteSheetRow(accessToken, spreadsheetId, KPM_SHEET_PERMASALAHAN, rowIndex - 1);
    return NextResponse.json({ success: true, message: 'Data masalah berhasil dihapus' });
  } catch (error) {
    console.error('KPM Permasalahan DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
