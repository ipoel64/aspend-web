import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOrCreateFolder, uploadFileToDrive } from '@/lib/google-drive';
import { isGoogleAuthError } from '@/lib/google-sheets';
import { getFreshAccessToken, cleanGoogleErrorMessage, refreshGoogleAccessToken } from '@/lib/google-auth-helpers';
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const token = (formData.get('token') as string) || request.headers.get('x-kpm-token');

    const session = await auth();
    let accessToken: string | null = await getFreshAccessToken(session);

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
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Sesi otorisasi Google belum terhubung. Silakan login kembali.',
        isAuthError: true
      }, { status: 401 });
    }
    const files = formData.getAll('files') as File[];
    const folderName = (formData.get('folderName') as string) || 'RHK-agent_FotoKegiatan';
    const providedFolderId = (formData.get('folderId') as string) || '';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 });
    }

    // Gunakan folderId yang sudah di-cache oleh client, atau buat/cari folder tujuan di Google Drive
    let targetFolderId: string = providedFolderId;
    try {
      if (!targetFolderId) {
        targetFolderId = (await getOrCreateFolder(accessToken as string, folderName)) || '';
      }
    } catch (folderErr: any) {
      // Jika auth error dan ada refreshToken di session, refresh dan retry folder
      // @ts-expect-error - refreshToken from session
      if (isGoogleAuthError(folderErr) && session?.refreshToken) {
        // @ts-expect-error - refreshToken from session
        const ref = await refreshGoogleAccessToken(session.refreshToken);
        if (ref?.accessToken) {
          accessToken = ref.accessToken;
          targetFolderId = (await getOrCreateFolder(accessToken, folderName)) || '';
        } else {
          throw folderErr;
        }
      } else {
        throw folderErr;
      }
    }

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
    const friendlyMsg = cleanGoogleErrorMessage(error);
    return NextResponse.json({
      error: friendlyMsg,
      isAuthError: isAuth
    }, { status: isAuth ? 401 : 500 });
  }
}
