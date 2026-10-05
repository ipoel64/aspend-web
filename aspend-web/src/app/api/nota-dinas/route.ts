import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import {
  getSheetsClient,
  getSheetData,
  appendSheetData,
  updateSheetRow,
  deleteSheetRow,
} from '@/lib/google-sheets';
import {
  SHEET_NOTA_DINAS,
  NOTA_DINAS_HEADERS,
  NotaDinasItem,
  generateNotaDinasId,
  parseNotaDinasRow,
  notaDinasToRow,
} from '@/lib/nota-dinas-constants';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Memastikan sheet Nota_Dinas ada di Google Spreadsheet.
 */
async function ensureNotaDinasSheet(accessToken: string, spreadsheetId: string): Promise<string> {
  const sheets = await getSheetsClient(accessToken);
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets || [];

  const foundSheet = sheetList.find((s) => {
    const title = s.properties?.title || '';
    return title.toLowerCase() === SHEET_NOTA_DINAS.toLowerCase();
  });

  if (!foundSheet) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: SHEET_NOTA_DINAS,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
              },
            },
          ],
        },
      });

      await appendSheetData(accessToken, spreadsheetId, `${SHEET_NOTA_DINAS}!A1:N1`, [
        NOTA_DINAS_HEADERS,
      ]);
    } catch (err: any) {
      console.warn('Gagal membuat sheet Nota_Dinas via batchUpdate:', err);
    }
  }

  return SHEET_NOTA_DINAS;
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
      return NextResponse.json({ success: true, list: [] });
    }

    const sheetName = await ensureNotaDinasSheet(accessToken as string, spreadsheetId);

    let rows: any[][] = [];
    try {
      rows = await getSheetData(accessToken as string, spreadsheetId, `${sheetName}!A2:N`);
    } catch {
      return NextResponse.json({ success: true, list: [] });
    }

    const list: NotaDinasItem[] = [];
    if (rows && rows.length > 0) {
      for (const r of rows) {
        if (!r || r.length === 0 || !r[0]) continue;
        list.push(parseNotaDinasRow(r));
      }
    }

    // Urutkan dari yang terbaru (descending)
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, list });
  } catch (error: any) {
    console.error('Error GET /api/nota-dinas:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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
      return NextResponse.json({ error: 'Spreadsheet Aspend Database tidak ditemukan.' }, { status: 404 });
    }

    const body = await request.json();
    const sheetName = await ensureNotaDinasSheet(accessToken as string, spreadsheetId);

    const id = body.id?.trim() || generateNotaDinasId();
    const email = session.user?.email || '';

    const newItem: NotaDinasItem = {
      id,
      email,
      nomor: body.nomor?.trim() || '',
      yth: body.yth?.trim() || '',
      dari: body.dari?.trim() || '',
      hal: body.hal?.trim() || '',
      lampiran: body.lampiran?.trim() || '-',
      sifat: body.sifat?.trim() || 'Biasa',
      tanggal: body.tanggal?.trim() || new Date().toLocaleDateString('id-ID'),
      poinDraft: body.poinDraft?.trim() || '',
      isiNotaDinas: body.isiNotaDinas?.trim() || '',
      pdfFileId: body.pdfFileId?.trim() || '',
      createdAt: body.createdAt || new Date().toISOString(),
      buktiDukung: body.buktiDukung?.trim() || '',
    };

    const row = notaDinasToRow(newItem);
    await appendSheetData(accessToken as string, spreadsheetId, `${sheetName}!A:N`, [row]);

    return NextResponse.json({ success: true, item: newItem });
  } catch (error: any) {
    console.error('Error POST /api/nota-dinas:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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
      return NextResponse.json({ error: 'Spreadsheet Aspend Database tidak ditemukan.' }, { status: 404 });
    }

    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'ID Nota Dinas wajib disertakan' }, { status: 400 });
    }

    const sheetName = await ensureNotaDinasSheet(accessToken as string, spreadsheetId);
    const rows = await getSheetData(accessToken as string, spreadsheetId, `${sheetName}!A2:N`);

    let rowIndex = -1;
    let existingItem: NotaDinasItem | null = null;

    if (rows && rows.length > 0) {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i][0] === id) {
          rowIndex = i + 2; // Row number 1-based (header is row 1)
          existingItem = parseNotaDinasRow(rows[i]);
          break;
        }
      }
    }

    if (rowIndex === -1 || !existingItem) {
      return NextResponse.json({ error: 'Data Nota Dinas tidak ditemukan' }, { status: 404 });
    }

    const updatedItem: NotaDinasItem = {
      ...existingItem,
      nomor: body.nomor !== undefined ? body.nomor.trim() : existingItem.nomor,
      yth: body.yth !== undefined ? body.yth.trim() : existingItem.yth,
      dari: body.dari !== undefined ? body.dari.trim() : existingItem.dari,
      hal: body.hal !== undefined ? body.hal.trim() : existingItem.hal,
      lampiran: body.lampiran !== undefined ? body.lampiran.trim() : existingItem.lampiran,
      sifat: body.sifat !== undefined ? body.sifat.trim() : existingItem.sifat,
      tanggal: body.tanggal !== undefined ? body.tanggal.trim() : existingItem.tanggal,
      poinDraft: body.poinDraft !== undefined ? body.poinDraft.trim() : existingItem.poinDraft,
      isiNotaDinas: body.isiNotaDinas !== undefined ? body.isiNotaDinas.trim() : existingItem.isiNotaDinas,
      pdfFileId: body.pdfFileId !== undefined ? body.pdfFileId.trim() : existingItem.pdfFileId,
      buktiDukung: body.buktiDukung !== undefined ? body.buktiDukung.trim() : existingItem.buktiDukung,
    };

    const row = notaDinasToRow(updatedItem);
    await updateSheetRow(accessToken as string, spreadsheetId, `${sheetName}!A${rowIndex}:N${rowIndex}`, [row]);

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error: any) {
    console.error('Error PUT /api/nota-dinas:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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
      return NextResponse.json({ error: 'Parameter id wajib diisi' }, { status: 400 });
    }

    const spreadsheetId = await findAspendSpreadsheet(accessToken as string);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet tidak ditemukan.' }, { status: 404 });
    }

    const sheetName = await ensureNotaDinasSheet(accessToken as string, spreadsheetId);
    const rows = await getSheetData(accessToken as string, spreadsheetId, `${sheetName}!A2:N`);

    let rowIndex0Based = -1;
    if (rows && rows.length > 0) {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i][0] === id) {
          rowIndex0Based = i + 1; // row 1 is header (idx 0), row 2 is idx 1
          break;
        }
      }
    }

    if (rowIndex0Based === -1) {
      return NextResponse.json({ error: 'Data Nota Dinas tidak ditemukan' }, { status: 404 });
    }

    await deleteSheetRow(accessToken as string, spreadsheetId, sheetName, rowIndex0Based);

    return NextResponse.json({ success: true, message: 'Nota Dinas berhasil dihapus' });
  } catch (error: any) {
    console.error('Error DELETE /api/nota-dinas:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
