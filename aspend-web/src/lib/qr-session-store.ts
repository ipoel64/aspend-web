// In-memory / Global store for QR Code login sessions in local / test mode

export interface QrUserPayload {
  id?: string;
  email: string;
  name: string;
  image?: string;
  spreadsheetId?: string;
  isPremium?: boolean;
  accessToken?: string;
  refreshToken?: string;
  serverAuthCode?: string;
  idToken?: string;
  expiresAt?: number;
  googleExpiresAt?: number;
}

export interface QrSession {
  sessionId: string;
  status: 'PENDING' | 'AUTHORIZED' | 'EXPIRED';
  user?: QrUserPayload;
  createdAt: number;
}

// Preserve across HMR in development
const globalForQr = globalThis as unknown as {
  _aspendQrSessions?: Map<string, QrSession>;
};

export const qrSessionsMap = globalForQr._aspendQrSessions || new Map<string, QrSession>();
if (process.env.NODE_ENV !== 'production') {
  globalForQr._aspendQrSessions = qrSessionsMap;
}

export function createQrSession(sessionId?: string): QrSession {
  const id = sessionId || 'ASPEND_AUTH_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const session: QrSession = {
    sessionId: id,
    status: 'PENDING',
    createdAt: Date.now(),
  };
  qrSessionsMap.set(id, session);
  return session;
}

export function getQrSession(sessionId: string): QrSession | null {
  const session = qrSessionsMap.get(sessionId);
  if (!session) return null;

  // Sesi PENDING kedaluwarsa setelah 10 menit (waktu scan barcode baru)
  // Sesi AUTHORIZED aktif penuh selama 24 jam (86.400.000 ms)
  const maxLifetime = session.status === 'AUTHORIZED' ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000;
  if (Date.now() - session.createdAt > maxLifetime) {
    session.status = 'EXPIRED';
    qrSessionsMap.delete(sessionId);
    return null;
  }
  return session;
}

export function authorizeQrSession(sessionId: string, user: QrUserPayload): boolean {
  let session = qrSessionsMap.get(sessionId);
  if (!session) {
    session = {
      sessionId,
      status: 'AUTHORIZED',
      createdAt: Date.now(),
      user,
    };
  } else {
    session.status = 'AUTHORIZED';
    session.user = { ...(session.user || {}), ...user };
  }
  qrSessionsMap.set(sessionId, session);
  return true;
}

export function updateQrSessionTokens(
  sessionId: string,
  accessToken: string,
  refreshToken?: string,
  googleExpiresAt?: number
): boolean {
  const session = getQrSession(sessionId);
  if (!session || !session.user) return false;

  session.user.accessToken = accessToken;
  if (refreshToken) {
    session.user.refreshToken = refreshToken;
  }
  if (googleExpiresAt) {
    session.user.googleExpiresAt = googleExpiresAt;
  }
  qrSessionsMap.set(sessionId, session);
  return true;
}
