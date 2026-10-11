'use client';

import React, { useEffect, useState, useRef } from 'react';
import { signIn } from 'next-auth/react';

interface QrWebLoginCardProps {
  onGoogleSignIn?: () => void;
  showGoogleSignIn?: boolean;
}

export default function QrWebLoginCard({ onGoogleSignIn, showGoogleSignIn = false }: QrWebLoginCardProps) {
  const [sessionId, setSessionId] = useState<string>('');
  const [qrPayload, setQrPayload] = useState<string>('');
  const [qrStatus, setQrStatus] = useState<'LOADING' | 'READY' | 'AUTHORIZED' | 'EXPIRED' | 'ERROR'>('LOADING');
  const [statusMessage, setStatusMessage] = useState<string>('Menyiapkan barcode...');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const initQrSession = async () => {
    try {
      setQrStatus('LOADING');
      setStatusMessage('Membuat sesi barcode baru...');
      
      const res = await fetch('/api/auth/qr-session?action=create');
      const data = await res.json();
      
      if (data.success && data.sessionId) {
        const sid = data.sessionId;
        setSessionId(sid);
        
        // Encode payload: contains session ID and local origin so mobile can reach it
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        const payload = JSON.stringify({
          type: 'ASPEND_WEB_LOGIN',
          session: sid,
          endpoint: `${origin}/api/auth/qr-session`
        });
        
        setQrPayload(payload);
        setQrStatus('READY');
        setStatusMessage('Arahkan kamera scanner dari HP Anda');
      } else {
        setQrStatus('ERROR');
        setStatusMessage('Gagal membuat sesi QR.');
      }
    } catch (e: any) {
      setQrStatus('ERROR');
      setStatusMessage('Koneksi server gagal: ' + (e?.message || 'Error'));
    }
  };

  useEffect(() => {
    initQrSession();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Polling for session authorization
  useEffect(() => {
    if (qrStatus !== 'READY' || !sessionId) return;

    let pollCount = 0;
    const maxPolls = 150; // 5 minutes at 2s interval

    pollIntervalRef.current = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setQrStatus('EXPIRED');
        setStatusMessage('Kode QR telah kedaluwarsa. Silakan muat ulang.');
        return;
      }

      try {
        const res = await fetch(`/api/auth/qr-session?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.success && data.status === 'AUTHORIZED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setQrStatus('AUTHORIZED');
          setStatusMessage('✅ Perangkat terhubung! Mengalihkan ke Dashboard...');

          // Sign in using next-auth Credentials provider
          const result = await signIn('qr-session', {
            sessionId: sessionId,
            redirect: false,
          });

          if (result?.ok) {
            window.location.reload();
          } else {
            // Fallback reload
            setTimeout(() => {
              window.location.reload();
            }, 1200);
          }
        }
      } catch (_) {}
    }, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [qrStatus, sessionId]);

  const qrImageUrl = qrPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(qrPayload)}`
    : '';

  return (
    <div className="w-full flex flex-col items-center">
      {/* QR Code Container */}
      <div className="relative p-4 bg-white rounded-2xl border-2 border-indigo-100 shadow-sm flex flex-col items-center justify-center min-h-[240px] min-w-[240px]">
        {qrStatus === 'LOADING' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-500 font-medium">Membuat Barcode...</p>
          </div>
        )}

        {qrStatus === 'READY' && qrImageUrl && (
          <div className="flex flex-col items-center">
            <img
              src={qrImageUrl}
              alt="Scan QR Barcode untuk Login Aspend"
              width={200}
              height={200}
              className="rounded-lg shadow-xs"
            />
          </div>
        )}

        {qrStatus === 'AUTHORIZED' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3 animate-in zoom-in-95">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl font-bold">
              ✓
            </div>
            <p className="text-sm font-bold text-emerald-700 text-center">Berhasil Terhubung!</p>
            <p className="text-xs text-gray-500">Membuka Dashboard ASPEND...</p>
          </div>
        )}

        {qrStatus === 'EXPIRED' && (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl font-bold">
              ⏰
            </div>
            <p className="text-xs text-gray-600 font-medium text-center">Kode QR telah kedaluwarsa</p>
            <button
              onClick={initQrSession}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
            >
              Perbarui Barcode
            </button>
          </div>
        )}

        {qrStatus === 'ERROR' && (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xl font-bold">
              ✕
            </div>
            <p className="text-xs text-red-600 font-medium text-center">{statusMessage}</p>
            <button
              onClick={initQrSession}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}
      </div>

      {/* Status Live Indicator */}
      {qrStatus === 'READY' && (
        <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-indigo-50/70 border border-indigo-100 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[11px] font-medium text-indigo-900">{statusMessage}</span>
        </div>
      )}

      {/* Guide text */}
      <div className="mt-4 text-center px-2">
        <p className="text-xs text-slate-300/90 font-medium leading-relaxed">
          1. Buka aplikasi <b>Aspend</b> di HP Anda
          <br />
          2. Ketuk tombol scanner <b>[ ⛶ ]</b> di bagian atas Dashboard
          <br />
          3. Arahkan kamera ke barcode di atas
        </p>
      </div>

      {/* Divider & Google Sign In (Hidden: login is barcode-only) */}
      {showGoogleSignIn && onGoogleSignIn && (
        <>
          <div className="w-full flex items-center my-5">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">atau</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          <button
            onClick={onGoogleSignIn}
            className="w-full py-3 bg-white text-gray-700 border border-gray-300 font-medium text-xs rounded-xl hover:bg-gray-50 transition-all shadow-xs flex items-center justify-center gap-3 active:scale-98 cursor-pointer"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
            <span>Masuk manual dengan Akun Google</span>
          </button>
        </>
      )}
    </div>
  );
}
