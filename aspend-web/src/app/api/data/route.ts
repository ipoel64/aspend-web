import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSheetData } from '@/lib/google-sheets';

export async function GET(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - session.accessToken is injected in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get('spreadsheetId');

    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID required' }, { status: 400 });
    }

    // Fetch data from 'Laporan_Log' sheet
    const rawData = await getSheetData(accessToken as string, spreadsheetId, 'Laporan_Log!A:Z');
    
    // Process data (skip header row)
    const reports = [];
    if (rawData && rawData.length > 1) {
      // Header: ['ReportId', 'Email', 'Tanggal', 'JenisRHK', 'IdRHK', 'RencanaAksi', 'Lokasi', 'PoinKegiatan', 'NarasiAI', 'NarasiEdited', 'Status', 'PdfUrl', 'PdfFileId', 'FotoIds', 'P2K2Data', 'ThumbnailId', 'CreatedAt']
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row[0]) continue; // Skip empty rows
        
        reports.push({
          reportId: row[0],
          email: row[1],
          tanggal: row[2],
          jenisRHK: row[3],
          idRHK: row[4],
          rencanaAksi: row[5],
          lokasi: row[6],
          poinKegiatan: row[7],
          narasiAI: row[8],
          narasiEdited: row[9],
          status: row[10] || 'DRAFT',
          pdfUrl: row[11],
          pdfFileId: row[12],
          fotoIds: row[13],
          p2k2Data: row[14],
          createdAt: row[16]
        });
      }
    }

    return NextResponse.json({ success: true, data: reports });
  } catch (error: any) {
    console.error('API /api/data error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
