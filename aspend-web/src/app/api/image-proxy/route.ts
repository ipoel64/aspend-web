import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDriveClient } from '@/lib/google-drive';
import { refreshGoogleAccessToken } from '@/lib/google-auth-helpers';
import crypto from 'crypto';

const SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'aspend-secret-kpm-portal-2026';

function decryptToken(tokenStr: string): any | null {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(SECRET).digest(),
      Buffer.alloc(16, 0)
    );
    const raw = Buffer.from(tokenStr, 'base64url').toString('utf8');
    let decrypted = decipher.update(raw, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');
    const token = searchParams.get('token');

    let accessToken: string | null = null;
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    accessToken = session?.accessToken || null;

    if (!accessToken && token) {
      const decoded = decryptToken(token);
      if (decoded?.refreshToken) {
        const refreshed = await refreshGoogleAccessToken(decoded.refreshToken);
        if (refreshed?.accessToken) {
          accessToken = refreshed.accessToken;
        }
      }
    }

    if (!accessToken) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

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
