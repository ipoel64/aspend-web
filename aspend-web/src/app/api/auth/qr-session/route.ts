import { NextResponse } from 'next/server';
import { createQrSession, getQrSession, authorizeQrSession, QrUserPayload } from '@/lib/qr-session-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const sessionId = searchParams.get('sessionId');

  // Create new session
  if (action === 'create') {
    const session = createQrSession();
    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
    });
  }

  // Check existing session status
  if (sessionId) {
    let session = getQrSession(sessionId);
    if (!session) {
      session = createQrSession(sessionId);
    }

    // Jika masih PENDING, periksa apakah mobile mengirim otorisasi via Cloud Relay (ntfy.sh)
    // Hal ini memungkinkan mobile pada jaringan 4G/LTE/cellular maupun multi-instance serverless tetap sinkron!
    if (session.status === 'PENDING') {
      try {
        const relayRes = await fetch(`https://ntfy.sh/aspend_qr_${encodeURIComponent(sessionId)}/raw?poll=1`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(1500)
        });
        if (relayRes.ok) {
          const rawText = await relayRes.text();
          if (rawText && rawText.trim().startsWith('{')) {
            const body = JSON.parse(rawText.trim());
            if (body && (body.sessionId === sessionId || body.email)) {
              const userPayload: QrUserPayload = {
                id: body.email || sessionId,
                email: body.email || '',
                name: body.nama || body.name || 'Pengguna Aspend',
                image: body.image || body.picture || '',
                spreadsheetId: body.spreadsheetId || '',
                accessToken: body.accessToken || '',
                refreshToken: body.refreshToken || '',
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
              };
              authorizeQrSession(sessionId, userPayload);
              session = getQrSession(sessionId)!;
            }
          }
        }
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
      user: session.status === 'AUTHORIZED' ? session.user : undefined,
    });
  }

  return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, email, nama, name, image, picture, spreadsheetId, accessToken, refreshToken } = body;

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId wajib diisi' }, { status: 400 });
    }

    let session = getQrSession(sessionId);
    if (!session) {
      session = createQrSession(sessionId);
    }

    const userPayload: QrUserPayload = {
      id: email || sessionId,
      email: email || '',
      name: nama || name || 'Pengguna Aspend',
      image: image || picture || '',
      spreadsheetId: spreadsheetId || '',
      accessToken: accessToken || '',
      refreshToken: refreshToken || '',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    const success = authorizeQrSession(sessionId, userPayload);

    // Broadcast ke cloud relay agar instance polling lainnya langsung ter-update
    try {
      await fetch(`https://ntfy.sh/aspend_qr_${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userPayload, sessionId }),
      });
    } catch (_) {}

    return NextResponse.json({
      success,
      message: success ? 'Sesi berhasil diotorisasi dari perangkat HP.' : 'Gagal mengotorisasi sesi.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
