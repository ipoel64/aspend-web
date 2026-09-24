import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import { getKpmFullProfile } from '@/lib/kpm-sheets';

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
    const kpmId = searchParams.get('kpmId') || undefined;
    const noKK = searchParams.get('noKK') || undefined;
    const nik = searchParams.get('nik') || undefined;

    if (!kpmId && !noKK && !nik) {
      return NextResponse.json({ error: 'Parameter kpmId, noKK, atau nik wajib diisi' }, { status: 400 });
    }

    const fullData = await getKpmFullProfile(accessToken, spreadsheetId, { kpmId, noKK, nik });

    if (!fullData.keluarga) {
      return NextResponse.json({ error: 'Data KPM tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ data: fullData });
  } catch (error) {
    console.error('KPM Full Profile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
