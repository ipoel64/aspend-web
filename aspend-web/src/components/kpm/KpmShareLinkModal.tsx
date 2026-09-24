'use client';

import React, { useState } from 'react';
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

  if (!isOpen || !keluarga) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const portalUrl = `${origin}/kpm-portal?nik=${keluarga.NIK}`;
  const password = keluarga.Password || '123456';

  const waMessage = encodeURIComponent(
    `Yth. Bapak/Ibu *${keluarga.NamaPengurus}*,\n\n` +
      `Berikut adalah tautan resmi untuk melengkapi/memperbarui data KPM PKH keluarga Anda secara mandiri:\n\n` +
      `🌐 *Link Formulir:* ${portalUrl}\n` +
      `🔑 *NIK:* ${keluarga.NIK}\n` +
      `🔒 *Password Masuk:* ${password}\n\n` +
      `Silakan buka tautan di atas dan lengkapi data keluarga, anggota keluarga, kondisi rumah/aset, serta unggah foto dokumen pendukung.\n\n` +
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">share</span>
            <div>
              <h3 className="font-bold text-base font-['Outfit']">Bagikan Link Portal KPM</h3>
              <p className="text-[11px] text-white/80">KPM Melengkapi Data Mandiri (Self-Service)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs text-gray-700">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
            <p className="font-bold text-purple-900 text-sm">{keluarga.NamaPengurus}</p>
            <p className="text-gray-600 font-mono text-[11px] mt-0.5">NIK: {keluarga.NIK}</p>
            <p className="text-gray-500 text-[11px]">Kelompok: {keluarga.Kelompok || '—'}</p>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-gray-800">Tautan Formulir KPM:</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={portalUrl}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-[11px] bg-gray-50 text-gray-700 select-all outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'Tersalin!' : 'Salin'}</span>
              </button>
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
            <p className="font-bold text-gray-800">Informasi Akses KPM:</p>
            <p className="text-gray-600">
              • Username (NIK): <span className="font-mono font-bold text-gray-900">{keluarga.NIK}</span>
            </p>
            <p className="text-gray-600">
              • Password Default: <span className="font-mono font-bold text-gray-900">{password}</span>
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">send</span>
              <span>Kirim Link via WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
