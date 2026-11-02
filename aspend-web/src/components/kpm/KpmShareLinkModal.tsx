'use client';

import React, { useState, useEffect } from 'react';
import { KpmKeluarga } from '@/lib/kpm-constants';

interface KpmShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  keluarga: KpmKeluarga | null;
}

export default function KpmShareLinkModal({
  isOpen,
  onClose,
  keluarga,
}: KpmShareLinkModalProps) {
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    if (isOpen && keluarga?.NIK) {
      setToken('');
      fetch(`/api/kpm/portal?action=generate-link&nik=${encodeURIComponent(keluarga.NIK)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.token) {
            setToken(data.token);
          }
        })
        .catch((err) => console.error('Failed to generate portal token:', err));
    }
  }, [isOpen, keluarga?.NIK]);

  if (!isOpen || !keluarga) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const portalUrl = token
    ? `${origin}/kpm-portal?nik=${keluarga.NIK}&token=${token}`
    : `${origin}/kpm-portal?nik=${keluarga.NIK}`;
  const password = keluarga.Password || '123456';

  const qrImageUrl = portalUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(portalUrl)}`
    : '';

  const waMessage = encodeURIComponent(
    `Yth. Bapak/Ibu *${keluarga.NamaPengurus}*,\n\n` +
      `Berikut adalah tautan resmi untuk melengkapi/memperbarui data KPM PKH keluarga Anda secara mandiri:\n\n` +
      `🌐 *Link Formulir:* ${portalUrl}\n` +
      `🔑 *NIK:* ${keluarga.NIK}\n` +
      `🔒 *Password Masuk:* ${password}\n\n` +
      `Silakan buka tautan di atas dan lengkapi data keluarga, anggota keluarga, kondisi rumah/aset, serta surat pernyataan komitmen.\n\n` +
      `Terima kasih.\n_Pendamping Sosial PKH_`
  );

  const waLink = keluarga.NoHP
    ? `https://wa.me/${keluarga.NoHP.replace(/^0/, '62').replace(/\D/g, '')}?text=${waMessage}`
    : `https://api.whatsapp.com/send?text=${waMessage}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-md w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-5 py-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-xl">qr_code_2</span>
            </div>
            <div>
              <h3 className="font-bold text-base font-['Outfit'] leading-tight">Bagikan Link Portal KPM</h3>
              <p className="text-[11px] text-white/80">KPM Melengkapi Data Mandiri (Self-Service)</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-5 space-y-3.5 text-xs text-gray-700 overflow-y-auto">
          {/* Ringkasan Profil KPM */}
          <div className="p-3 bg-purple-50/80 border border-purple-200/90 rounded-2xl flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-purple-950 text-sm truncate">{keluarga.NamaPengurus}</p>
              <div className="flex items-center gap-2 text-gray-600 font-mono text-[11px] mt-0.5">
                <span>NIK: <strong>{keluarga.NIK}</strong></span>
              </div>
              <p className="text-gray-500 text-[10.5px] mt-0.5 truncate">
                Kelompok: {keluarga.Kelompok || '—'}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[9.5px] font-black uppercase shrink-0">
              KPM PKH
            </span>
          </div>

          {/* ── BARCODE / QR CODE UNTUK SCAN VIA HP KPM ── */}
          <div className="p-3.5 bg-gradient-to-br from-slate-50 to-purple-50/50 border border-purple-200 rounded-2xl flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5 text-purple-950 font-bold text-xs mb-2">
              <span className="material-symbols-outlined text-purple-600 text-[17px]">photo_camera</span>
              <span>Scan Barcode dengan Kamera HP KPM</span>
            </div>

            {/* Container Gambar Barcode */}
            <div className="p-3 bg-white rounded-2xl border border-purple-200/80 shadow-xs flex items-center justify-center">
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt={`Barcode QR Link Portal ${keluarga.NamaPengurus}`}
                  className="w-44 h-44 sm:w-48 sm:h-48 object-contain rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('quickchart.io')) {
                      target.src = `https://quickchart.io/qr?size=220&margin=2&text=${encodeURIComponent(portalUrl)}`;
                    }
                  }}
                />
              ) : (
                <div className="w-44 h-44 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[11px]">Membuat barcode...</span>
                </div>
              )}
            </div>

            {/* Petunjuk Penggunaan Scanner Chrome */}
            <p className="text-[10.5px] text-slate-600 mt-2.5 leading-snug px-2">
              Buka aplikasi <b>Kamera HP</b> atau icon <b>Kamera/Lens di Google Chrome</b> pada HP KPM, arahkan ke barcode ini untuk langsung membuka formulir.
            </p>
          </div>

          {/* Tautan Input URL */}
          <div>
            <label className="block font-semibold mb-1 text-gray-800 text-[11px]">
              Atau Salin Tautan Formulir:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={portalUrl}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-xl font-mono text-[11px] bg-gray-50 text-gray-700 select-all outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'Tersalin!' : 'Salin'}</span>
              </button>
            </div>
          </div>

          {/* Informasi Akses KPM (Username & Password) */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
            <p className="font-bold text-gray-800">Informasi Akses KPM:</p>
            <p className="text-gray-600">
              • Username (NIK): <span className="font-mono font-bold text-gray-900">{keluarga.NIK}</span>
            </p>
            <p className="text-gray-600">
              • Password Default: <span className="font-mono font-bold text-gray-900">{password}</span>
            </p>
          </div>

          {/* Tombol Kirim WhatsApp */}
          <div className="pt-1">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-base">send</span>
              <span>Kirim Link via WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-purple-700 hover:text-purple-900 font-bold hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            <span>Uji Buka Formulir</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
