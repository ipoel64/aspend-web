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
  KPM_SHEET_GRADUASI,
  KPM_SHEET_KELUARGA,
  KPM_GRADUASI_HEADERS,
  generateGraduasiId,
  parseGraduasiRow,
  graduasiToRow,
  parseKeluargaRow,
  keluargaToRow,
  KpmGraduasi,
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

    await ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_GRADUASI, KPM_GRADUASI_HEADERS);

    const rows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_GRADUASI}!A2:L`);
    let data = rows.filter((r) => r.length > 0).map(parseGraduasiRow);

    if (noKK) {
      data = data.filter((item) => item.NoKK === noKK);
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('KPM Graduasi GET error:', error);
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

    await ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_GRADUASI, KPM_GRADUASI_HEADERS);

    // Upsert berdasarkan NoKK
    const existingRowIndex = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_GRADUASI, body.NoKK, 1);

    if (existingRowIndex > 1) {
      const existingRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_GRADUASI}!A${existingRowIndex}:L${existingRowIndex}`);
      const oldData = parseGraduasiRow(existingRows[0] || []);

      const updatedData: KpmGraduasi = {
        ...oldData,
        ...body,
        GraduasiId: oldData.GraduasiId || generateGraduasiId(),
        NoKK: body.NoKK,
      };

      await updateSheetRow(accessToken, spreadsheetId, `${KPM_SHEET_GRADUASI}!A${existingRowIndex}:L${existingRowIndex}`, [graduasiToRow(updatedData)]);

      // Sinkronisasi status kepesertaan ke sheet KPM_Keluarga
      try {
        const isGrad =
          updatedData.StatusGraduasi === 'Sudah Graduasi' ||
          updatedData.StatusGraduasi === 'Graduasi Mandiri' ||
          updatedData.StatusGraduasi === 'Graduasi Alami';

        const kpmRowIndex = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_KELUARGA, body.NoKK, 2);
        if (kpmRowIndex > 1) {
          const kpmRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A${kpmRowIndex}:AA${kpmRowIndex}`);
          if (kpmRows.length > 0) {
            const kpmData = parseKeluargaRow(kpmRows[0]);
            kpmData.StatusKepesertaan = isGrad ? 'Graduasi' : 'Aktif';
            kpmData.StatusGraduasi = updatedData.StatusGraduasi || (isGrad ? 'Sudah Graduasi' : 'Belum Graduasi');
            await updateSheetRow(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A${kpmRowIndex}:AA${kpmRowIndex}`, [keluargaToRow(kpmData)]);
          }
        }
      } catch (syncErr) {
        console.error('Error auto-sync graduasi ke KPM_Keluarga:', syncErr);
      }

      return NextResponse.json({ success: true, data: updatedData, action: 'updated' });
    }

    const newGraduasi: KpmGraduasi = {
      GraduasiId: generateGraduasiId(),
      NoKK: body.NoKK,
      StatusGraduasi: body.StatusGraduasi || 'Belum Graduasi',
      TanggalGraduasi: body.TanggalGraduasi || '',
      AlasanGraduasi: body.AlasanGraduasi || '',
      IndeksKesejahteraan: body.IndeksKesejahteraan || '',
      BantuanTerakhir: body.BantuanTerakhir || '',
      PenghasilanPerBulan: body.PenghasilanPerBulan || '',
      SuratPengunduranDiri: body.SuratPengunduranDiri || '',
      StatusPPSE: body.StatusPPSE || 'Belum PPSE',
      Catatan: body.Catatan || '',
      CreatedAt: new Date().toISOString(),
    };

    await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_GRADUASI}!A:L`, [graduasiToRow(newGraduasi)]);

    // Sinkronisasi status kepesertaan ke sheet KPM_Keluarga
    try {
      const isGrad =
        newGraduasi.StatusGraduasi === 'Sudah Graduasi' ||
        newGraduasi.StatusGraduasi === 'Graduasi Mandiri' ||
        newGraduasi.StatusGraduasi === 'Graduasi Alami';

      const kpmRowIndex = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_KELUARGA, body.NoKK, 2);
      if (kpmRowIndex > 1) {
        const kpmRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A${kpmRowIndex}:AA${kpmRowIndex}`);
        if (kpmRows.length > 0) {
          const kpmData = parseKeluargaRow(kpmRows[0]);
          kpmData.StatusKepesertaan = isGrad ? 'Graduasi' : 'Aktif';
          kpmData.StatusGraduasi = newGraduasi.StatusGraduasi || (isGrad ? 'Sudah Graduasi' : 'Belum Graduasi');
          await updateSheetRow(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A${kpmRowIndex}:AA${kpmRowIndex}`, [keluargaToRow(kpmData)]);
        }
      }
    } catch (syncErr) {
      console.error('Error auto-sync graduasi ke KPM_Keluarga:', syncErr);
    }

    return NextResponse.json({ success: true, data: newGraduasi, action: 'created' });
  } catch (error) {
    console.error('KPM Graduasi POST error:', error);
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
    const graduasiId = searchParams.get('graduasiId');
    if (!graduasiId) {
      return NextResponse.json({ error: 'GraduasiId wajib diisi' }, { status: 400 });
    }

    const rowIndex = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_GRADUASI, graduasiId, 0);
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Data graduasi tidak ditemukan' }, { status: 404 });
    }

    // Ambil data sebelum dihapus untuk mengetahui NoKK KPM
    let noKKToRevert = '';
    try {
      const gradRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_GRADUASI}!A${rowIndex}:L${rowIndex}`);
      if (gradRows.length > 0) {
        const gradData = parseGraduasiRow(gradRows[0]);
        noKKToRevert = gradData.NoKK || '';
      }
    } catch (readErr) {
      console.error('Error reading graduasi before delete:', readErr);
    }

    await deleteSheetRow(accessToken, spreadsheetId, KPM_SHEET_GRADUASI, rowIndex - 1);

    // Kembalikan status kepesertaan di KPM_Keluarga menjadi Aktif
    if (noKKToRevert) {
      try {
        const kpmRowIndex = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_KELUARGA, noKKToRevert, 2);
        if (kpmRowIndex > 1) {
          const kpmRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A${kpmRowIndex}:AA${kpmRowIndex}`);
          if (kpmRows.length > 0) {
            const kpmData = parseKeluargaRow(kpmRows[0]);
            kpmData.StatusKepesertaan = 'Aktif';
            kpmData.StatusGraduasi = 'Belum Graduasi';
            await updateSheetRow(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A${kpmRowIndex}:AA${kpmRowIndex}`, [keluargaToRow(kpmData)]);
          }
        }
      } catch (revertErr) {
        console.error('Error reverting KPM status in graduasi DELETE:', revertErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Data graduasi berhasil dihapus' });
  } catch (error) {
    console.error('KPM Graduasi DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
