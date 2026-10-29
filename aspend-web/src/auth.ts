import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getQrSession } from "@/lib/qr-session-store";

async function refreshAccessToken(token: any) {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000 + (refreshedTokens.expires_in || 3600)),
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // Sesi login aktif 24 jam (86400 detik)
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    Credentials({
      id: "qr-session",
      name: "QR Code Login",
      credentials: {
        sessionId: { label: "Session ID", type: "text" },
        userPayload: { label: "User Payload", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.sessionId) return null;
        const sessionId = credentials.sessionId as string;
        let s = getQrSession(sessionId);
        let user: any = s?.user;

        // Prioritaskan userPayload langsung dari client polling (sudah melalui pertukaran serverAuthCode)
        if (!user && credentials?.userPayload && typeof credentials.userPayload === 'string' && credentials.userPayload.trim().startsWith('{')) {
          try {
            const parsedUser = JSON.parse(credentials.userPayload);
            if (parsedUser && (parsedUser.email || parsedUser.id)) {
              user = parsedUser;
            }
          } catch (_) {}
        }

        if (!user) {
          try {
            const relayRes = await fetch(`https://ntfy.sh/aspend_qr_${encodeURIComponent(sessionId)}/raw?poll=1`, {
              cache: 'no-store',
              signal: AbortSignal.timeout(3000),
            });
            if (relayRes.ok) {
              const rawText = await relayRes.text();
              if (rawText && rawText.trim()) {
                const lines = rawText.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
                let body: any = null;
                for (const line of lines) {
                  try {
                    const parsed = JSON.parse(line);
                    if (parsed && (parsed.sessionId === sessionId || parsed.email)) {
                      body = { ...(body || {}), ...parsed };
                    }
                  } catch (_) {}
                }
                if (body && (body.sessionId === sessionId || body.email)) {
                  let accessToken = body.accessToken || '';
                  let refreshToken = body.refreshToken || '';
                  let expiresAt = body.expiresAt || (Math.floor(Date.now() / 1000) + 3600);
                  const serverAuthCode = body.serverAuthCode || '';

                  if (serverAuthCode && !refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
                    try {
                      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams({
                          client_id: process.env.GOOGLE_CLIENT_ID,
                          client_secret: process.env.GOOGLE_CLIENT_SECRET,
                          code: serverAuthCode,
                          grant_type: "authorization_code",
                          redirect_uri: "",
                        }),
                      });
                      if (tokenRes.ok) {
                        const tokenData = await tokenRes.json();
                        if (tokenData.access_token) {
                          accessToken = tokenData.access_token;
                          if (tokenData.refresh_token) refreshToken = tokenData.refresh_token;
                          if (tokenData.expires_in) expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;
                        }
                      }
                    } catch (_) {}
                  }

                  user = {
                    id: body.email || sessionId,
                    name: body.nama || body.name || 'Pengguna Aspend',
                    email: body.email || '',
                    image: body.image || body.picture || '',
                    spreadsheetId: body.spreadsheetId || '',
                    isPremium: Boolean(body.isPremium),
                    accessToken,
                    refreshToken,
                    serverAuthCode,
                    expiresAt: body.expiresAt || (Math.floor(Date.now() / 1000) + 86400),
                  };
                }
              }
            }
          } catch (_) {}
        }
        if (user) {
          if (user.serverAuthCode && !user.refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            try {
              const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  client_id: process.env.GOOGLE_CLIENT_ID,
                  client_secret: process.env.GOOGLE_CLIENT_SECRET,
                  code: user.serverAuthCode,
                  grant_type: "authorization_code",
                  redirect_uri: "",
                }),
              });
              if (tokenRes.ok) {
                const tokenData = await tokenRes.json();
                if (tokenData.access_token) {
                  user.accessToken = tokenData.access_token;
                  if (tokenData.refresh_token) user.refreshToken = tokenData.refresh_token;
                  if (tokenData.expires_in) user.expiresAt = Math.floor(Date.now() / 1000) + Math.max(tokenData.expires_in, 86400);
                }
              }
            } catch (_) {}
          }

          return {
            id: user.id || sessionId,
            name: user.name,
            email: user.email,
            image: user.image,
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
            expiresAt: user.expiresAt || (Math.floor(Date.now() / 1000) + 86400),
            spreadsheetId: user.spreadsheetId,
            isPremium: Boolean(user.isPremium),
          } as any;
        }
        return null;
      }
    }),
  ],
  callbacks: {
    async jwt({ token, account, user, profile }) {
      // Login awal via Google OAuth
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at || (Math.floor(Date.now() / 1000) + 86400);
        (token as any).sessionCreated = Date.now();
        delete token.error;
      }
      // Login awal via QR Code Credentials
      if (user) {
        token.picture = user.image || (profile as any)?.picture;
        (token as any).sessionCreated = Date.now();
        if ((user as any).accessToken) {
          token.accessToken = (user as any).accessToken;
          token.refreshToken = (user as any).refreshToken;
          token.expiresAt = (user as any).expiresAt || (Math.floor(Date.now() / 1000) + 86400);
          delete token.error;
        }
        if ((user as any).spreadsheetId) {
          (token as any).spreadsheetId = (user as any).spreadsheetId;
        }
        if ((user as any).sessionId) {
          (token as any).sessionId = (user as any).sessionId;
        }
        if ((user as any).isPremium !== undefined) {
          (token as any).isPremium = (user as any).isPremium;
        }
      }

      // Refresh Google access token jika ada refreshToken dan token Google mendekati kadaluwarsa
      if (token.refreshToken && token.expiresAt && Date.now() >= ((token.expiresAt as number) - 300) * 1000) {
        return await refreshAccessToken(token);
      }

      // Sesi aktif 24 jam penuh. Hanya tandai berakhir jika 24 jam penuh telah terlewati
      const sessionCreated = (token as any).sessionCreated || (token.expiresAt ? ((token.expiresAt as number) - 86400) * 1000 : 0);
      if (sessionCreated > 0 && Date.now() >= sessionCreated + 24 * 60 * 60 * 1000) {
        return {
          ...token,
          error: "RefreshAccessTokenError",
        };
      }

      return token;
    },
    async session({ session, token }) {
      // @ts-expect-error - session.accessToken doesn't exist on default Session type
      session.accessToken = token.accessToken;
      // @ts-expect-error - session.refreshToken doesn't exist on default Session type
      session.refreshToken = token.refreshToken;
      if (token.error) {
        (session as any).error = token.error;
      }
      if (session.user && token.picture) {
        session.user.image = token.picture as string;
      }
      if ((token as any).spreadsheetId && session.user) {
        (session.user as any).spreadsheetId = (token as any).spreadsheetId;
      }
      if ((token as any).sessionId) {
        (session as any).sessionId = (token as any).sessionId;
      }
      if ((token as any).isPremium !== undefined && session.user) {
        (session.user as any).isPremium = (token as any).isPremium;
      }
      return session;
    }
  }
});
