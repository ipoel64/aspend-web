import { NextResponse } from 'next/server';
import {
  createQrSession,
  getQrSession,
  authorizeQrSession,
  updateQrSessionTokens,
  QrUserPayload,
} from '@/lib/qr-session-store';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '@/lib/google-auth-helpers';

async function processQrPayload(body: any, sessionId: string): Promise<QrUserPayload> {
  let accessToken = body.accessToken || '';
  let refreshToken = body.refreshToken || '';
  let googleExpiresAt = body.googleExpiresAt || (Math.floor(Date.now() / 1000) + 3600); // Token Google aktif 1 jam
  let expiresAt = googleExpiresAt;
  const serverAuthCode = body.serverAuthCode || '';

  // Jika ada serverAuthCode, tukar ke Google OAuth token endpoint untuk mendapatkan refreshToken abadi
  if (serverAuthCode) {
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code: serverAuthCode,
          grant_type: "authorization_code",
          redirect_uri: "",
        }),
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          accessToken = tokenData.access_token;
          if (tokenData.refresh_token) {
            refreshToken = tokenData.refresh_token;
          }
          if (tokenData.expires_in) {
            googleExpiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;
            expiresAt = googleExpiresAt;
          }
        }
      } else {
        const errText = await tokenRes.text();
        console.warn("serverAuthCode exchange non-ok:", tokenRes.status, errText);
      }
    } catch (err) {
      console.warn("serverAuthCode exchange warning:", err);
    }
  }

  return {
    id: body.email || sessionId,
    email: body.email || '',
    name: body.nama || body.name || 'Pengguna Aspend',
    image: body.image || body.picture || '',
    spreadsheetId: body.spreadsheetId || '',
    isPremium: Boolean(body.isPremium),
    accessToken,
    refreshToken,
    serverAuthCode,
    idToken: body.idToken || '',
    expiresAt,
    googleExpiresAt,
  };
}

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
    if (session.status === 'PENDING') {
      try {
        const relayRes = await fetch(`https://ntfy.sh/aspend_qr_${encodeURIComponent(sessionId)}/raw?poll=1`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(1500)
        });
        if (relayRes.ok) {
          const rawText = await relayRes.text();
          if (rawText && rawText.trim()) {
            const lines = rawText.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
            let mergedBody: any = null;
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed && (parsed.sessionId === sessionId || parsed.email)) {
                  mergedBody = { ...(mergedBody || {}), ...parsed };
                }
              } catch (_) {}
            }
            if (mergedBody) {
              const userPayload = await processQrPayload(mergedBody, sessionId);
              authorizeQrSession(sessionId, userPayload);
              session = getQrSession(sessionId)!;
            }
          }
        }
      } catch (_) {}
    }

    // Jika sudah AUTHORIZED, periksa apakah ada pembaruan token (refresh) via Cloud Relay
    if (session.status === 'AUTHORIZED' && session.user) {
      try {
        const refreshRelay = await fetch(`https://ntfy.sh/aspend_qr_refresh_${encodeURIComponent(sessionId)}/raw?poll=1`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(1000)
        });
        if (refreshRelay.ok) {
          const rawText = await refreshRelay.text();
          if (rawText && rawText.trim()) {
            const lines = rawText.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed?.accessToken && session.user && parsed.accessToken !== session.user.accessToken) {
                  updateQrSessionTokens(
                    sessionId,
                    parsed.accessToken,
                    parsed.refreshToken,
                    parsed.googleExpiresAt || (Math.floor(Date.now() / 1000) + 3600)
                  );
                  session = getQrSession(sessionId)!;
                }
              } catch (_) {}
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
    const { sessionId, action } = body;

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId wajib diisi' }, { status: 400 });
    }

    // Action khusus: Pembaruan token berkala dari background mobile
    if (action === 'REFRESH_TOKEN' && body.accessToken) {
      const updated = updateQrSessionTokens(
        sessionId,
        body.accessToken,
        body.refreshToken,
        body.googleExpiresAt || (Math.floor(Date.now() / 1000) + 3600)
      );

      // Broadcast ke channel relay refresh
      try {
        await fetch(`https://ntfy.sh/aspend_qr_refresh_${encodeURIComponent(sessionId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: body.accessToken,
            refreshToken: body.refreshToken,
            googleExpiresAt: body.googleExpiresAt,
            sessionId
          }),
        });
      } catch (_) {}

      return NextResponse.json({ success: updated, message: 'Token Google berhasil diperbarui.' });
    }

    let session = getQrSession(sessionId);
    if (!session) {
      session = createQrSession(sessionId);
    }

    const userPayload = await processQrPayload(body, sessionId);
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
