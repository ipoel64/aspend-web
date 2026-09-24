import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import {
  getSheetData,
  appendSheetData,
  updateSheetRow,
  deleteSheetRow,
  findRowByKey
} from '@/lib/google-sheets';
import {
  KPM_SHEET_ANGGOTA,
  KPM_ANGGOTA_HEADERS,
  generateAnggotaId,
  parseAnggotaRow,
  anggotaToRow,
  validateNIK,
  normalizeKK,
  KpmAnggota,
} from '@/lib/kpm-constants';

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
    const nik = searchParams.get('nik');
    const all = searchParams.get('all') === 'true';

    if (!noKK && !nik && !all) {
      return NextResponse.json({ error: 'noKK atau nik wajib diisi' }, { status: 400 });
    }

    let rows: string[][] = [];
    try {
      rows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A2:N`);
    } catch (e) {
      rows = [];
    }

    const allMembers = rows.filter(row => row.length > 0).map(parseAnggotaRow);

    // Hitung frekuensi kemunculan NIK di seluruh data anggota
    const nikCounts = new Map<string, number>();
    for (const m of allMembers) {
      const mNik = m.NIK?.trim();
      if (mNik && mNik !== '—' && mNik !== '-') {
        nikCounts.set(mNik, (nikCounts.get(mNik) || 0) + 1);
      }
    }

    let data: KpmAnggota[] = [];
    if (all) {
      data = allMembers;
    } else {
      const normTargetKK = noKK ? normalizeKK(noKK) : '';

      data = allMembers.filter(item => {
        if (noKK && (item.NoKK === noKK || (normTargetKK && normalizeKK(item.NoKK) === normTargetKK))) {
          return true;
        }
        return false;
      });

      // Jika tidak ditemukan dengan NoKK, coba cari melalui NIK Pengurus yang terdaftar di tabel Anggota
      if (data.length === 0 && nik) {
        const matchByNik = allMembers.find(item => item.NIK === nik);
        if (matchByNik && matchByNik.NoKK) {
          const realKK = matchByNik.NoKK;
          const normRealKK = normalizeKK(realKK);
          data = allMembers.filter(item => item.NoKK === realKK || (normRealKK && normalizeKK(item.NoKK) === normRealKK));
        }
      }
    }

    const enrichedData = data.map((item) => {
      const mNik = item.NIK?.trim() || '';
      const dupCount = mNik ? (nikCounts.get(mNik) || 1) : 1;
      return {
        ...item,
        IsDuplicateNik: dupCount > 1,
        DuplicateCount: dupCount,
      };
    });

    return NextResponse.json({ data: enrichedData, total: enrichedData.length });
  } catch (error) {
    console.error('Anggota GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });

    const body = await request.json();
    
    if (!validateNIK(body.NIK)) {
      return NextResponse.json({ error: 'Invalid NIK. Must be 16 digits.' }, { status: 400 });
    }

    // Check headers
    let existingRows: string[][] = [];
    try {
      existingRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A1:N`);
    } catch (e) {
      await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A1:N`, [KPM_ANGGOTA_HEADERS]);
    }
    
    if (existingRows.length === 0) {
      await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A1:N`, [KPM_ANGGOTA_HEADERS]);
    }

    // Assume seq is based on current timestamp for unique generation, or pass custom logic
    const newAnggota = {
      ...body,
      AnggotaId: generateAnggotaId(Date.now()), 
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };

    const rowData = anggotaToRow(newAnggota);
    await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A:N`, [rowData]);

    return NextResponse.json(newAnggota, { status: 201 });
  } catch (error) {
    console.error('Anggota POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error
    const accessToken = session?.accessToken;
    if (!session || !accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });

    const body = await request.json();
    const anggotaId = body.AnggotaId;
    if (!anggotaId) return NextResponse.json({ error: 'AnggotaId is required' }, { status: 400 });

    const rawRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A:N`);
    let foundRowIndex = -1;
    let existingRow: string[] | null = null;

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowAnggotaId = (row[0] || '').trim();
      const rowNIK = (row[2] || '').trim();

      if (anggotaId && rowAnggotaId.toLowerCase() === anggotaId.toLowerCase()) {
        foundRowIndex = i + 1; // 1-indexed baris sheet
        existingRow = row;
        break;
      }
      if (body.NIK && rowNIK === body.NIK.trim()) {
        foundRowIndex = i + 1;
        existingRow = row;
        break;
      }
    }

    if (foundRowIndex === -1 || !existingRow) {
      return NextResponse.json({ error: 'Data anggota tidak ditemukan untuk diperbarui' }, { status: 404 });
    }

    const existingAnggota = parseAnggotaRow(existingRow);
    const updatedAnggota: KpmAnggota = {
      ...existingAnggota,
      ...body,
      AnggotaId: existingAnggota.AnggotaId || anggotaId,
      NoKK: body.NoKK || existingAnggota.NoKK,
      CreatedAt: existingAnggota.CreatedAt || new Date().toISOString(),
    };

    const updatedRow = anggotaToRow(updatedAnggota);
    const range = `${KPM_SHEET_ANGGOTA}!A${foundRowIndex}:N${foundRowIndex}`;
    await updateSheetRow(accessToken, spreadsheetId, range, [updatedRow]);

    return NextResponse.json(updatedAnggota);
  } catch (error) {
    console.error('Anggota PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error
    const accessToken = session?.accessToken;
    if (!session || !accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const anggotaId = searchParams.get('anggotaId');
    if (!anggotaId) return NextResponse.json({ error: 'anggotaId is required' }, { status: 400 });

    const result = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_ANGGOTA, anggotaId, 0);
    if (!result || result <= 0) return NextResponse.json({ error: 'Data anggota tidak ditemukan' }, { status: 404 });
    
    // deleteSheetRow menggunakan 0-based index! (Baris 1-indexed ke-result adalah index result - 1)
    await deleteSheetRow(accessToken, spreadsheetId, KPM_SHEET_ANGGOTA, result - 1);

    return NextResponse.json({ message: 'Anggota deleted successfully' });
  } catch (error) {
    console.error('Anggota DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
