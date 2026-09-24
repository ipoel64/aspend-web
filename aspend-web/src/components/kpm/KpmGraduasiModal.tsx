'use client';

import React, { useState, useEffect } from 'react';
import {
  KpmGraduasi,
  KpmKeluarga,
  STATUS_GRADUASI_OPTIONS,
  ALASAN_GRADUASI_OPTIONS,
  STATUS_PPSE_OPTIONS,
} from '@/lib/kpm-constants';

interface KpmGraduasiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  keluarga?: KpmKeluarga | null;
  noKK?: string;
  existingGraduasi?: KpmGraduasi | null;
  initialData?: KpmGraduasi | null;
  kpmList?: KpmKeluarga[];
}

export default function KpmGraduasiModal({
  isOpen,
  onClose,
  onSuccess,
  keluarga,
  noKK,
  existingGraduasi,
  initialData,
  kpmList = [],
}: KpmGraduasiModalProps) {
  const effectiveData = existingGraduasi || initialData;
  const [selectedKK, setSelectedKK] = useState(keluarga?.NoKK || noKK || '');
  const effectiveNoKK = keluarga?.NoKK || noKK || selectedKK;

  const [formData, setFormData] = useState<Partial<KpmGraduasi>>({
    StatusGraduasi: 'Belum Graduasi',
    TanggalGraduasi: '',
    AlasanGraduasi: '',
    IndeksKesejahteraan: '',
    BantuanTerakhir: 'PKH',
    PenghasilanPerBulan: '',
    SuratPengunduranDiri: '',
    StatusPPSE: 'Belum PPSE',
    Catatan: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setSelectedKK(keluarga?.NoKK || noKK || '');
    if (effectiveData) {
      setFormData(effectiveData);
    } else {
      setFormData({
        StatusGraduasi: 'Belum Graduasi',
        TanggalGraduasi: '',
        AlasanGraduasi: '',
        IndeksKesejahteraan: '',
        BantuanTerakhir: 'PKH',
        PenghasilanPerBulan: '',
        SuratPengunduranDiri: '',
        StatusPPSE: 'Belum PPSE',
        Catatan: '',
      });
    }
    setErrorMsg('');
  }, [effectiveData, keluarga, noKK, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('files', file);
      uploadFormData.append('folderName', 'RHK-agent_FotoKPM');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengunggah surat');
      }

      if (data.files && data.files.length > 0) {
        setFormData((prev) => ({ ...prev, SuratPengunduranDiri: data.files[0].id }));
      }
    } catch (err: any) {
      setErrorMsg(`Gagal upload berkas: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!effectiveNoKK) {
      setErrorMsg('Pilih keluarga KPM terlebih dahulu sebelum menyimpan status graduasi.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        NoKK: effectiveNoKK,
      };

      const res = await fetch('/api/kpm/graduasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan status graduasi');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentKpm = keluarga || kpmList.find((k) => k.NoKK === effectiveNoKK);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">school</span>
            <div>
              <h3 className="font-bold text-lg font-['Outfit']">Status Graduasi & PPSE</h3>
              <p className="text-xs text-white/80">
                {currentKpm
                  ? `Keluarga: ${currentKpm.NamaPengurus} (KK: ${currentKpm.NoKK})`
                  : effectiveNoKK
                  ? `No. KK: ${effectiveNoKK}`
                  : 'Pilih Keluarga Penerima Manfaat'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-gray-700 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 text-xs font-medium">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pemilih KPM jika modal dibuka langsung dari tombol header */}
          {!keluarga && !noKK && kpmList.length > 0 && (
            <div className="bg-violet-50 p-3.5 rounded-xl border border-violet-200 space-y-1">
              <label className="block font-bold text-violet-950 text-xs">
                Pilih Keluarga KPM yang Akan Dicatat Graduasi / PPSE:
              </label>
              <select
                value={selectedKK}
                onChange={(e) => setSelectedKK(e.target.value)}
                required
                className="w-full px-3 py-2 border border-violet-300 rounded-lg bg-white font-medium text-xs focus:ring-2 focus:ring-violet-500 outline-none"
              >
                <option value="">-- Pilih Salah Satu KPM ({kpmList.length} KPM Terdaftar) --</option>
                {kpmList.map((k) => (
                  <option key={k.NoKK} value={k.NoKK}>
                    {k.NamaPengurus} (KK: {k.NoKK}) - Kelompok: {k.Kelompok || 'Tanpa Kelompok'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Status Graduasi</label>
              <select
                value={formData.StatusGraduasi || 'Belum Graduasi'}
                onChange={(e) => setFormData({ ...formData, StatusGraduasi: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white font-medium"
              >
                {STATUS_GRADUASI_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Status PPSE</label>
              <select
                value={formData.StatusPPSE || 'Belum PPSE'}
                onChange={(e) => setFormData({ ...formData, StatusPPSE: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white font-medium"
              >
                {STATUS_PPSE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Tanggal Graduasi</label>
              <input
                type="date"
                value={formData.TanggalGraduasi || ''}
                onChange={(e) => setFormData({ ...formData, TanggalGraduasi: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Alasan Graduasi</label>
              <select
                value={formData.AlasanGraduasi || ''}
                onChange={(e) => setFormData({ ...formData, AlasanGraduasi: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white"
              >
                <option value="">-- Pilih Alasan Graduasi --</option>
                {ALASAN_GRADUASI_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Estimasi Penghasilan / Bulan (Rp)</label>
              <input
                type="number"
                value={formData.PenghasilanPerBulan || ''}
                onChange={(e) => setFormData({ ...formData, PenghasilanPerBulan: e.target.value })}
                placeholder="Contoh: 3500000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Bantuan Terakhir Diterima</label>
              <input
                type="text"
                value={formData.BantuanTerakhir || 'PKH'}
                onChange={(e) => setFormData({ ...formData, BantuanTerakhir: e.target.value })}
                placeholder="Contoh: PKH Tahap 2 / Sembako"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Surat Pernyataan / Pengunduran Diri</label>
            {formData.SuratPengunduranDiri ? (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-violet-600">description</span>
                  <span className="text-[11px] font-medium text-gray-700">Berkas Surat Tersimpan di Drive</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, SuratPengunduranDiri: '' })}
                  className="text-rose-600 hover:text-rose-800 font-bold text-[11px]"
                >
                  Hapus Berkas
                </button>
              </div>
            ) : (
              <label className="border border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-violet-500 hover:bg-violet-50/50 transition-colors">
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-gray-400">upload_file</span>
                    <span className="text-gray-600">Unggah Foto / Scan Surat Pengunduran Diri</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div>
            <label className="block font-semibold mb-1">Catatan Tambahan Pendamping</label>
            <textarea
              rows={3}
              value={formData.Catatan || ''}
              onChange={(e) => setFormData({ ...formData, Catatan: e.target.value })}
              placeholder="Catatan perkembangan atau tindak lanjut graduasi..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
            />
          </div>

          <div className="pt-4 border-t flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Simpan Status Graduasi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
