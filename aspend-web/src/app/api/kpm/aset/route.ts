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
  KPM_SHEET_ASET,
  KPM_ASET_HEADERS,
  generateAsetId,
  parseAsetRow,
  asetToRow,
  KpmAset,
  normalizeKK,
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

    await ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_ASET, KPM_ASET_HEADERS);

    const rows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ASET}!A2:M`);
    let data = rows.filter((r) => r.length > 0).map(parseAsetRow);

    if (noKK) {
      const normTargetKK = normalizeKK(noKK);
      data = data.filter(
        (item) => item.NoKK === noKK || (normTargetKK && normalizeKK(item.NoKK) === normTargetKK)
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('KPM Aset GET error:', error);
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

    await ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_ASET, KPM_ASET_HEADERS);

    // Cek apakah NoKK sudah punya data aset, jika sudah, kita update saja (upsert)
    const existingRowIndex = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_ASET, body.NoKK, 1);

    if (existingRowIndex > 1) {
      // Update data aset yang ada
      const existingRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ASET}!A${existingRowIndex}:M${existingRowIndex}`);
      const oldData = parseAsetRow(existingRows[0] || []);

      const updatedData: KpmAset = {
        ...oldData,
        ...body,
        AsetId: oldData.AsetId || generateAsetId(),
        NoKK: body.NoKK,
      };

      await updateSheetRow(accessToken, spreadsheetId, `${KPM_SHEET_ASET}!A${existingRowIndex}:M${existingRowIndex}`, [asetToRow(updatedData)]);
      return NextResponse.json({ success: true, data: updatedData, action: 'updated' });
    }

    // Insert data aset baru
    const newAset: KpmAset = {
      AsetId: generateAsetId(),
      NoKK: body.NoKK,
      StatusRumah: body.StatusRumah || '',
      Usaha: body.Usaha || 'Tidak Memiliki Usaha',
      JenisUsaha: body.JenisUsaha || '',
      FotoUsaha: body.FotoUsaha || '',
      FotoRumahLuar: body.FotoRumahLuar || '',
      FotoRumahDalam: body.FotoRumahDalam || '',
      Latitude: body.Latitude || '',
      Longitude: body.Longitude || '',
      TahunMenerimaBansos: body.TahunMenerimaBansos || '',
      Keterangan: body.Keterangan || '',
      CreatedAt: new Date().toISOString(),
    };

    await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ASET}!A:M`, [asetToRow(newAset)]);
    return NextResponse.json({ success: true, data: newAset, action: 'created' });
  } catch (error) {
    console.error('KPM Aset POST error:', error);
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
    const asetId = searchParams.get('asetId');
    if (!asetId) {
      return NextResponse.json({ error: 'AsetId wajib diisi' }, { status: 400 });
    }

    const rowIndex = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_ASET, asetId, 0);
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Data aset tidak ditemukan' }, { status: 404 });
    }

    await deleteSheetRow(accessToken, spreadsheetId, KPM_SHEET_ASET, rowIndex - 1);
    return NextResponse.json({ success: true, message: 'Data aset berhasil dihapus' });
  } catch (error) {
    console.error('KPM Aset DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
