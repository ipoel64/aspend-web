'use client';

import React, { useState, useEffect } from 'react';
import {
  KpmAset,
  KpmKeluarga,
  STATUS_RUMAH_OPTIONS,
  USAHA_OPTIONS,
} from '@/lib/kpm-constants';

interface KpmAsetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  keluarga: KpmKeluarga | null;
  existingAset?: KpmAset | null;
}

export default function KpmAsetModal({
  isOpen,
  onClose,
  onSuccess,
  keluarga,
  existingAset,
}: KpmAsetModalProps) {
  const [formData, setFormData] = useState<Partial<KpmAset>>({
    StatusRumah: 'Milik Sendiri',
    Usaha: 'Tidak Memiliki Usaha',
    JenisUsaha: '',
    FotoUsaha: '',
    FotoRumahLuar: '',
    FotoRumahDalam: '',
    Latitude: '',
    Longitude: '',
    TahunMenerimaBansos: '',
    Keterangan: '',
  });

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    if (existingAset) {
      setFormData(existingAset);
    } else if (isOpen && keluarga?.NoKK) {
      fetch(`/api/kpm/aset?noKK=${keluarga.NoKK}`)
        .then((res) => res.json())
        .then((res) => {
          if (res.data && res.data.length > 0) {
            setFormData(res.data[0]);
          } else {
            setFormData({
              StatusRumah: 'Milik Sendiri',
              Usaha: 'Tidak Memiliki Usaha',
              JenisUsaha: '',
              FotoUsaha: '',
              FotoRumahLuar: '',
              FotoRumahDalam: '',
              Latitude: '',
              Longitude: '',
              TahunMenerimaBansos: '',
              Keterangan: '',
            });
          }
        })
        .catch(() => {});
    } else {
      setFormData({
        StatusRumah: 'Milik Sendiri',
        Usaha: 'Tidak Memiliki Usaha',
        JenisUsaha: '',
        FotoUsaha: '',
        FotoRumahLuar: '',
        FotoRumahDalam: '',
        Latitude: '',
        Longitude: '',
        TahunMenerimaBansos: '',
        Keterangan: '',
      });
    }
    setErrorMsg('');
  }, [existingAset, isOpen, keluarga?.NoKK]);

  if (!isOpen || !keluarga) return null;

  const isUsahaActive = formData.Usaha === 'Memiliki Usaha';

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Browser Anda tidak mendukung deteksi lokasi (Geolocation).');
      return;
    }
    setIsGettingLocation(true);
    setErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          Latitude: pos.coords.latitude.toFixed(6),
          Longitude: pos.coords.longitude.toFixed(6),
        }));
        setIsGettingLocation(false);
      },
      (err) => {
        setIsGettingLocation(false);
        setErrorMsg(`Gagal mengambil koordinat: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof KpmAset) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(fieldName);
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
        throw new Error(data.error || 'Gagal mengunggah foto');
      }

      if (data.files && data.files.length > 0) {
        const driveFileId = data.files[0].id;
        setFormData((prev) => ({ ...prev, [fieldName]: driveFileId }));
      }
    } catch (err: any) {
      setErrorMsg(`Gagal upload foto: ${err.message}`);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        NoKK: keluarga.NoKK,
      };

      const res = await fetch('/api/kpm/aset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan data aset');
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
      <div className="bg-white rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">home_work</span>
            <div>
              <h3 className="font-bold text-lg font-['Outfit']">Data Aset & Kondisi Rumah</h3>
              <p className="text-xs text-white/80">
                Keluarga: {keluarga.NamaPengurus} (KK: {keluarga.NoKK})
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
            <div>
              <label className="block font-semibold mb-1">Status Kepemilikan Rumah</label>
              <select
                value={formData.StatusRumah || 'Milik Sendiri'}
                onChange={(e) => setFormData({ ...formData, StatusRumah: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              >
                {STATUS_RUMAH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Tahun Pertama Menerima Bansos</label>
              <input
                type="number"
                min="2000"
                max={new Date().getFullYear()}
                value={formData.TahunMenerimaBansos || ''}
                onChange={(e) => setFormData({ ...formData, TahunMenerimaBansos: e.target.value })}
                placeholder="Contoh: 2018"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Kepemilikan Usaha</label>
              <select
                value={formData.Usaha || 'Tidak Memiliki Usaha'}
                onChange={(e) => setFormData({ ...formData, Usaha: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white font-medium"
              >
                {USAHA_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block font-semibold mb-1 ${!isUsahaActive ? 'text-gray-400' : 'text-gray-800'}`}>
                Jenis Usaha {isUsahaActive && <span className="text-amber-600">* (Aktif)</span>}
              </label>
              <input
                type="text"
                disabled={!isUsahaActive}
                value={formData.JenisUsaha || ''}
                onChange={(e) => setFormData({ ...formData, JenisUsaha: e.target.value })}
                placeholder={isUsahaActive ? 'Contoh: Warung Kelontong / Ternak Ayam' : 'Aktif jika Memiliki Usaha'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
          </div>

          {/* Lokasi Koordinat GPS */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-amber-600">my_location</span>
                Titik Koordinat Lokasi Rumah (Google Maps)
              </h5>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={isGettingLocation}
                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">near_me</span>
                {isGettingLocation ? 'Mendeteksi...' : 'Ambil Lokasi Saat Ini'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Latitude (Lintang)</label>
                <input
                  type="text"
                  value={formData.Latitude || ''}
                  onChange={(e) => setFormData({ ...formData, Latitude: e.target.value })}
                  placeholder="Contoh: 3.569844"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Longitude (Bujur)</label>
                <input
                  type="text"
                  value={formData.Longitude || ''}
                  onChange={(e) => setFormData({ ...formData, Longitude: e.target.value })}
                  placeholder="Contoh: 98.475967"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                />
              </div>
            </div>

            {formData.Latitude && formData.Longitude && (
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <span className="text-[11px] text-gray-600 font-mono">
                  📍 {formData.Latitude}, {formData.Longitude}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${formData.Latitude},${formData.Longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg text-[11px] font-bold text-gray-700 flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm text-rose-600">map</span>
                  Buka di Google Maps
                </a>
              </div>
            )}
          </div>

          {/* Foto Dokumentasi Aset & Rumah */}
          <div className="border-t pt-4 space-y-3">
            <h5 className="font-bold text-gray-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-amber-600">photo_library</span>
              Foto Rumah & Usaha
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Foto Rumah Tampak Luar', field: 'FotoRumahLuar' as keyof KpmAset, enabled: true },
                { label: 'Foto Rumah Tampak Dalam', field: 'FotoRumahDalam' as keyof KpmAset, enabled: true },
                { label: 'Foto Usaha', field: 'FotoUsaha' as keyof KpmAset, enabled: isUsahaActive },
              ].map(({ label, field, enabled }) => {
                const fileId = (formData[field] as string) || '';
                const isUploading = uploadingField === field;
                return (
                  <div
                    key={field}
                    className={`border rounded-xl p-3 flex flex-col items-center justify-between text-center relative overflow-hidden ${
                      enabled ? 'bg-gray-50 border-gray-200' : 'bg-gray-100/70 border-gray-200 opacity-60'
                    }`}
                  >
                    <p className="font-semibold text-gray-700 text-[11px] mb-2">{label}</p>
                    {fileId ? (
                      <div className="relative w-full h-28 rounded-lg overflow-hidden border border-gray-200 bg-white">
                        <img
                          src={`/api/image-proxy?id=${fileId}`}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, [field]: '' })}
                          className="absolute top-1 right-1 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs shadow-md"
                          title="Hapus foto"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <label
                        className={`w-full h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                          enabled
                            ? 'border-gray-300 cursor-pointer hover:border-amber-500 hover:bg-amber-50/50'
                            : 'border-gray-200 cursor-not-allowed'
                        }`}
                      >
                        {isUploading ? (
                          <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-gray-400 text-2xl mb-1">
                              {enabled ? 'add_a_photo' : 'block'}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {enabled ? 'Pilih Foto' : 'Nonaktif'}
                            </span>
                          </>
                        )}
                        {enabled && (
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handlePhotoUpload(e, field)}
                            disabled={isUploading}
                            className="hidden"
                          />
                        )}
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
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
              className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Simpan Data Aset</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
