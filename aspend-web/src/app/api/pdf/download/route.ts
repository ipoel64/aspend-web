import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDriveClient } from '@/lib/google-drive';

export async function GET(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const fileName = searchParams.get('fileName') || `Laporan_RHK_${fileId}.pdf`;

    if (!fileId) {
      return new NextResponse('File ID is required', { status: 400 });
    }

    const drive = await getDriveClient(accessToken as string);

    // Get file media as arraybuffer
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      {
        responseType: 'arraybuffer',
      }
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);

    // Clean filename for HTTP Header
    const cleanFileName = fileName.replace(/"/g, "'");

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${cleanFileName}"; filename*=UTF-8''${encodeURIComponent(cleanFileName)}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error downloading PDF from Drive:', error);
    return new NextResponse('Error downloading PDF', { status: 500 });
  }
}
