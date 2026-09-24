import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOrCreateFolder, uploadFileToDrive } from '@/lib/google-drive';

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const folderName = (formData.get('folderName') as string) || 'RHK-agent_FotoKegiatan';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 });
    }

    // Dapatkan folder tujuan di Google Drive
    const targetFolderId = await getOrCreateFolder(accessToken as string, folderName);

    const uploadedResults = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const mimeType = file.type || 'image/jpeg';

      const uploadResult = await uploadFileToDrive(
        accessToken as string,
        fileName,
        mimeType,
        buffer,
        targetFolderId || undefined
      );

      if (uploadResult?.id) {
        uploadedResults.push({
          id: uploadResult.id,
          name: fileName,
          webViewLink: uploadResult.webViewLink,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${uploadedResults.length} foto berhasil diunggah ke Google Drive.`,
      files: uploadedResults,
    });
  } catch (error: any) {
    console.error('Error uploading file to Drive:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengunggah file ke Google Drive.' }, { status: 500 });
  }
}
