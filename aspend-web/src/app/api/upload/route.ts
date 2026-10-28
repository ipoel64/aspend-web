import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOrCreateFolder, uploadFileToDrive } from '@/lib/google-drive';
import { isGoogleAuthError } from '@/lib/google-sheets';
import crypto from 'crypto';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

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

async function getAccessTokenFromRefreshToken(refreshToken: string): Promise<string | null> {
  try {
    const url = 'https://oauth2.googleapis.com/token';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const data = await response.json();
    return data.access_token || null;
  } catch (err) {
    console.error('Error refreshing token in upload route:', err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const token = (formData.get('token') as string) || request.headers.get('x-kpm-token');

    let accessToken: string | null = null;
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    accessToken = session?.accessToken || null;

    if (!accessToken && token) {
      const decoded = decryptToken(token);
      if (decoded?.refreshToken) {
        accessToken = await getAccessTokenFromRefreshToken(decoded.refreshToken);
      }
    }

    if (!accessToken || (session as any)?.error === 'RefreshAccessTokenError') {
      return NextResponse.json({
        error: 'SESSION_EXPIRED',
        sessionExpired: true,
        message: 'Sesi otorisasi Google Anda telah berakhir. Silakan hubungkan ulang sesi dari aplikasi HP.'
      }, { status: 401 });
    }
    const files = formData.getAll('files') as File[];
    const folderName = (formData.get('folderName') as string) || 'RHK-agent_FotoKegiatan';
    const providedFolderId = (formData.get('folderId') as string) || '';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 });
    }

    // Gunakan folderId yang sudah di-cache oleh client, atau buat/cari folder tujuan di Google Drive
    const targetFolderId = providedFolderId || (await getOrCreateFolder(accessToken as string, folderName));

    // Unggah seluruh file dalam batch secara paralel dengan urutan tetap terjaga
    const uploadPromises = files.map(async (file, idx) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${Date.now()}_${idx}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const mimeType = file.type || 'image/jpeg';

      const uploadResult = await uploadFileToDrive(
        accessToken as string,
        fileName,
        mimeType,
        buffer,
        targetFolderId || undefined
      );

      if (uploadResult?.id) {
        return {
          id: uploadResult.id,
          name: fileName,
          webViewLink: uploadResult.webViewLink,
        };
      }
      return null;
    });

    const rawResults = await Promise.all(uploadPromises);
    const uploadedResults = rawResults.filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({
      success: true,
      folderId: targetFolderId,
      message: `${uploadedResults.length} foto berhasil diunggah ke Google Drive.`,
      files: uploadedResults,
    });
  } catch (error: any) {
    console.error('Error uploading file to Drive:', error);
    const isAuth = isGoogleAuthError(error);
    return NextResponse.json({
      error: isAuth
        ? 'Sesi otorisasi Google Anda telah berakhir (1 jam). Silakan tautkan ulang barcode dari aplikasi HP untuk melanjutkan.'
        : (error.message || 'Gagal mengunggah file ke Google Drive.'),
      sessionExpired: isAuth,
      isAuthError: isAuth
    }, { status: isAuth ? 401 : 500 });
  }
}
