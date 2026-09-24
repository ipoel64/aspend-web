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
    const fileId = searchParams.get('id');

    if (!fileId) {
      return new NextResponse('File ID required', { status: 400 });
    }

    const drive = await getDriveClient(accessToken as string);

    // Get metadata for mimeType
    const metadata = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType',
    });

    const mimeType = metadata.data.mimeType || 'image/jpeg';

    // Get file media
    const fileResponse = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      {
        responseType: 'arraybuffer',
      }
    );

    const buffer = Buffer.from(fileResponse.data as ArrayBuffer);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      },
    });
  } catch (error: any) {
    console.error('Error fetching image from Drive:', error);
    return new NextResponse('Error loading image', { status: 500 });
  }
}
