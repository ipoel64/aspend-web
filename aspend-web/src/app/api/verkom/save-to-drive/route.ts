import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOrCreateFolder, uploadFileToDrive } from '@/lib/google-drive';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized. Sesi login telah berakhir.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const requestedFileName = formData.get('fileName') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada berkas PDF yang dikirim.' }, { status: 400 });
    }

    // Dapatkan atau buat folder 'VERKOM_Laporan' di Google Drive
    const targetFolderId = await getOrCreateFolder(accessToken as string, 'VERKOM_Laporan');

    const buffer = Buffer.from(await file.arrayBuffer());
    let finalFileName = requestedFileName || file.name || `VERKOM_${Date.now()}.pdf`;
    if (!finalFileName.toLowerCase().endsWith('.pdf')) {
      finalFileName += '.pdf';
    }

    const uploadResult = await uploadFileToDrive(
      accessToken as string,
      finalFileName,
      'application/pdf',
      buffer,
      targetFolderId || undefined
    );

    return NextResponse.json({
      success: true,
      message: 'PDF berhasil disimpan ke Google Drive folder "VERKOM_Laporan"!',
      fileId: uploadResult?.id,
      fileName: finalFileName,
      webViewLink: uploadResult?.webViewLink,
    });
  } catch (error: any) {
    console.error('Error saving VERKOM PDF to Google Drive:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menyimpan berkas ke Google Drive.' },
      { status: 500 }
    );
  }
}
