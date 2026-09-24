'use client';

import React, { useState, useEffect } from 'react';
import {
  KpmPermasalahan,
  KpmKeluarga,
  JENIS_MASALAH_OPTIONS,
  PRIORITAS_OPTIONS,
  STATUS_MASALAH_OPTIONS,
} from '@/lib/kpm-constants';

interface KpmPermasalahanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  keluarga?: KpmKeluarga | null;
  noKK?: string;
  editMasalah?: KpmPermasalahan | null;
  initialData?: KpmPermasalahan | null;
}

export default function KpmPermasalahanModal({
  isOpen,
  onClose,
  onSuccess,
  keluarga,
  noKK,
  editMasalah,
  initialData,
}: KpmPermasalahanModalProps) {
  const effectiveData = editMasalah || initialData;
  const effectiveNoKK = keluarga?.NoKK || noKK || '';

  const [formData, setFormData] = useState<Partial<KpmPermasalahan>>({
    JenisMasalah: 'Rumah Tidak Layak Huni',
    Deskripsi: '',
    Prioritas: 'Sedang',
    Status: 'Terbuka',
    FotoBukti: '',
    TindakLanjut: '',
    TanggalTindakLanjut: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (effectiveData) {
      setFormData(effectiveData);
    } else {
      setFormData({
        JenisMasalah: 'Rumah Tidak Layak Huni',
        Deskripsi: '',
        Prioritas: 'Sedang',
        Status: 'Terbuka',
        FotoBukti: '',
        TindakLanjut: '',
        TanggalTindakLanjut: '',
      });
    }
    setErrorMsg('');
  }, [effectiveData, isOpen]);

  if (!isOpen || (!keluarga && !noKK)) return null;

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
        throw new Error(data.error || 'Gagal mengunggah foto bukti');
      }

      if (data.files && data.files.length > 0) {
        setFormData((prev) => ({ ...prev, FotoBukti: data.files[0].id }));
      }
    } catch (err: any) {
      setErrorMsg(`Gagal upload foto: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        NoKK: effectiveNoKK,
      };

      const isEdit = !!effectiveData?.MasalahId;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch('/api/kpm/permasalahan', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan catatan permasalahan');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-600 to-red-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">report_problem</span>
            <div>
              <h3 className="font-bold text-lg font-['Outfit']">
                {effectiveData ? 'Edit Permasalahan KPM' : 'Catat Permasalahan KPM'}
              </h3>
              <p className="text-xs text-white/80">
                {keluarga ? `Keluarga: ${keluarga.NamaPengurus} (KK: ${keluarga.NoKK})` : `No. KK: ${effectiveNoKK}`}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block font-semibold mb-1">Jenis Permasalahan *</label>
              <select
                value={formData.JenisMasalah || 'Rumah Tidak Layak Huni'}
                onChange={(e) => setFormData({ ...formData, JenisMasalah: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none bg-white font-medium"
              >
                {JENIS_MASALAH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Tingkat Prioritas</label>
              <select
                value={formData.Prioritas || 'Sedang'}
                onChange={(e) => setFormData({ ...formData, Prioritas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none bg-white font-medium"
              >
                {PRIORITAS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'Kritis' ? '🔴 Kritis' : opt === 'Tinggi' ? '🟠 Tinggi' : opt === 'Sedang' ? '🟡 Sedang' : '🟢 Rendah'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Status Penanganan</label>
              <select
                value={formData.Status || 'Terbuka'}
                onChange={(e) => setFormData({ ...formData, Status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none bg-white font-medium"
              >
                {STATUS_MASALAH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Uraian / Deskripsi Permasalahan *</label>
            <textarea
              rows={3}
              value={formData.Deskripsi || ''}
              onChange={(e) => setFormData({ ...formData, Deskripsi: e.target.value })}
              placeholder="Jelaskan detail permasalahan yang ditemukan di lapangan..."
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Rencana / Tindak Lanjut</label>
              <input
                type="text"
                value={formData.TindakLanjut || ''}
                onChange={(e) => setFormData({ ...formData, TindakLanjut: e.target.value })}
                placeholder="Contoh: Koordinasi dengan Korkab / Dinsos"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tanggal Tindak Lanjut</label>
              <input
                type="date"
                value={formData.TanggalTindakLanjut || ''}
                onChange={(e) => setFormData({ ...formData, TanggalTindakLanjut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Foto Bukti Temuan / Kasus</label>
            {formData.FotoBukti ? (
              <div className="relative w-full h-36 rounded-xl overflow-hidden border border-gray-200 bg-white">
                <img
                  src={`/api/image-proxy?id=${formData.FotoBukti}`}
                  alt="Bukti Temuan"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, FotoBukti: '' })}
                  className="absolute top-2 right-2 w-7 h-7 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center text-xs shadow-md"
                  title="Hapus foto"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-rose-500 hover:bg-rose-50/50 transition-colors">
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-gray-400 text-2xl mb-1">add_a_photo</span>
                    <span className="text-[10px] text-gray-500">Unggah Foto Bukti Kasus</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            )}
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
              className="px-5 py-2 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>{editMasalah ? 'Perbarui Catatan' : 'Simpan Masalah'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
