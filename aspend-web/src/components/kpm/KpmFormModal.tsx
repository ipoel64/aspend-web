'use client';

import React, { useState, useEffect } from 'react';
import {
  KpmKeluarga,
  STATUS_KELOMPOK_OPTIONS,
  CATATAN_TEMUAN_OPTIONS,
  PERNYATAAN_OPTIONS,
  isKpmDataLengkap,
  formatIndonesianPhone,
  normalizeKK,
} from '@/lib/kpm-constants';

interface KpmFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: KpmKeluarga | null;
  existingKelompokList?: string[];
}

interface WilayahItem {
  id: string;
  name: string;
}

export default function KpmFormModal({
  isOpen,
  onClose,
  onSuccess,
  editData,
  existingKelompokList = [],
}: KpmFormModalProps) {
  const [formData, setFormData] = useState<Partial<KpmKeluarga>>({
    NIK: '',
    NoKK: '',
    NamaPengurus: '',
    Alamat: '',
    Lingkungan: '',
    Provinsi: '',
    KabKota: '',
    Kecamatan: '',
    Kelurahan: '',
    NoHP: '',
    Kelompok: '',
    StatusKelompok: 'Anggota',
    FotoKTP: '',
    FotoKK: '',
    FotoBukuTabungan: '',
    FotoKKS: '',
    CatatanTemuan: '[]',
    Pernyataan: '',
    Password: '123456',
    StatusData: 'Belum Lengkap',
  });

  // Wilayah state
  const [provinces, setProvinces] = useState<WilayahItem[]>([]);
  const [regencies, setRegencies] = useState<WilayahItem[]>([]);
  const [districts, setDistricts] = useState<WilayahItem[]>([]);
  const [villages, setVillages] = useState<WilayahItem[]>([]);

  const [selectedProvId, setSelectedProvId] = useState('');
  const [selectedRegId, setSelectedRegId] = useState('');
  const [selectedDistId, setSelectedDistId] = useState('');

  // Multi-select catatan temuan
  const [selectedTemuan, setSelectedTemuan] = useState<string[]>([]);
  const [customTemuan, setCustomTemuan] = useState('');

  // Upload state
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Matching helper for wilayah
  const cleanWilayahName = (str: string = ''): string => {
    return str
      .toUpperCase()
      .replace(/^(PROVINSI|KABUPATEN|KOTA|KAB\.|KECAMATAN|KEC\.|KELURAHAN|KEL\.|DESA)\s+/i, '')
      .trim();
  };

  const findMatchingWilayah = (list: WilayahItem[], targetName: string = ''): WilayahItem | undefined => {
    if (!targetName || !list || list.length === 0) return undefined;
    const targetClean = cleanWilayahName(targetName);
    const targetRaw = targetName.toUpperCase().trim();

    // 1. Exact raw match
    let found = list.find((item) => item.name.toUpperCase().trim() === targetRaw);
    if (found) return found;

    // 2. Cleaned exact match
    found = list.find((item) => cleanWilayahName(item.name) === targetClean);
    if (found) return found;

    // 3. Substring inclusion
    found = list.find((item) => {
      const cItem = cleanWilayahName(item.name);
      return cItem.length > 2 && (cItem.includes(targetClean) || targetClean.includes(cItem));
    });
    return found;
  };

  // Load provinces on mount / modal open
  useEffect(() => {
    if (!isOpen) return;
    if (provinces.length === 0) {
      fetch('/api/kpm/wilayah?level=provinces')
        .then((res) => res.json())
        .then((res) => {
          if (res.data) setProvinces(res.data);
        })
        .catch((err) => console.error('Error fetching provinces:', err));
    }
  }, [isOpen, provinces.length]);

  // Auto-sync cascade when editing an existing KPM
  useEffect(() => {
    if (!isOpen || !editData) return;
    let isCancelled = false;

    async function syncEditWilayah() {
      try {
        let provList = provinces;
        if (provList.length === 0) {
          const pRes = await fetch('/api/kpm/wilayah?level=provinces');
          const pData = await pRes.json();
          if (pData.data) {
            provList = pData.data;
            if (!isCancelled) setProvinces(provList);
          }
        }

        if (isCancelled || !editData?.Provinsi) return;
        const matchedProv = findMatchingWilayah(provList, editData.Provinsi);
        if (!matchedProv) return;

        if (!isCancelled) setSelectedProvId(matchedProv.id);

        // Fetch regencies
        const rRes = await fetch(`/api/kpm/wilayah?level=regencies&provinceId=${matchedProv.id}`);
        const rData = await rRes.json();
        const regList: WilayahItem[] = rData.data || [];
        if (isCancelled) return;
        setRegencies(regList);

        if (!editData.KabKota) return;
        const matchedReg = findMatchingWilayah(regList, editData.KabKota);
        if (!matchedReg) return;

        if (!isCancelled) setSelectedRegId(matchedReg.id);

        // Fetch districts
        const dRes = await fetch(`/api/kpm/wilayah?level=districts&regencyId=${matchedReg.id}`);
        const dData = await dRes.json();
        const distList: WilayahItem[] = dData.data || [];
        if (isCancelled) return;
        setDistricts(distList);

        if (!editData.Kecamatan) return;
        const matchedDist = findMatchingWilayah(distList, editData.Kecamatan);
        if (!matchedDist) return;

        if (!isCancelled) setSelectedDistId(matchedDist.id);

        // Fetch villages
        const vRes = await fetch(`/api/kpm/wilayah?level=villages&districtId=${matchedDist.id}`);
        const vData = await vRes.json();
        const vilList: WilayahItem[] = vData.data || [];
        if (isCancelled) return;
        setVillages(vilList);
      } catch (e) {
        console.error('Error in syncEditWilayah:', e);
      }
    }

    syncEditWilayah();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, editData?.Provinsi, editData?.KabKota, editData?.Kecamatan]);

  // Handle province change manually
  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedProvId(id);
    setSelectedRegId('');
    setSelectedDistId('');
    setDistricts([]);
    setVillages([]);
    const item = provinces.find((p) => p.id === id);
    setFormData((prev) => ({
      ...prev,
      Provinsi: item?.name || '',
      KabKota: '',
      Kecamatan: '',
      Kelurahan: '',
    }));
    if (id) {
      fetch(`/api/kpm/wilayah?level=regencies&provinceId=${id}`)
        .then((res) => res.json())
        .then((res) => {
          if (res.data) setRegencies(res.data);
        })
        .catch((err) => console.error('Error fetching regencies:', err));
    } else {
      setRegencies([]);
    }
  };

  // Handle regency change manually
  const handleRegencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedRegId(id);
    setSelectedDistId('');
    setVillages([]);
    const item = regencies.find((r) => r.id === id);
    setFormData((prev) => ({
      ...prev,
      KabKota: item?.name || '',
      Kecamatan: '',
      Kelurahan: '',
    }));
    if (id) {
      fetch(`/api/kpm/wilayah?level=districts&regencyId=${id}`)
        .then((res) => res.json())
        .then((res) => {
          if (res.data) setDistricts(res.data);
        })
        .catch((err) => console.error('Error fetching districts:', err));
    } else {
      setDistricts([]);
    }
  };

  // Handle district change manually
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedDistId(id);
    const item = districts.find((d) => d.id === id);
    setFormData((prev) => ({
      ...prev,
      Kecamatan: item?.name || '',
      Kelurahan: '',
    }));
    if (id) {
      fetch(`/api/kpm/wilayah?level=villages&districtId=${id}`)
        .then((res) => res.json())
        .then((res) => {
          if (res.data) setVillages(res.data);
        })
        .catch((err) => console.error('Error fetching villages:', err));
    } else {
      setVillages([]);
    }
  };

  // Handle village change manually
  const handleVillageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, Kelurahan: val }));
  };

  // Initialize form with editData if provided
  useEffect(() => {
    if (editData) {
      setFormData({
        ...editData,
        NoKK: normalizeKK(editData.NoKK) || editData.NoKK || '',
        NoHP: formatIndonesianPhone(editData.NoHP) || editData.NoHP || '',
        Pernyataan: editData.Pernyataan || '',
      });
      try {
        const parsed = JSON.parse(editData.CatatanTemuan || '[]');
        if (Array.isArray(parsed)) {
          const standard = parsed.filter((item) => CATATAN_TEMUAN_OPTIONS.includes(item));
          const custom = parsed.find((item) => !CATATAN_TEMUAN_OPTIONS.includes(item));
          setSelectedTemuan(standard);
          setCustomTemuan(custom || '');
        }
      } catch {
        setSelectedTemuan([]);
      }
    } else {
      setFormData({
        NIK: '',
        NoKK: '',
        NamaPengurus: '',
        Alamat: '',
        Lingkungan: '',
        Provinsi: '',
        KabKota: '',
        Kecamatan: '',
        Kelurahan: '',
        NoHP: '',
        Kelompok: '',
        StatusKelompok: 'Anggota',
        FotoKTP: '',
        FotoKK: '',
        FotoBukuTabungan: '',
        FotoKKS: '',
        CatatanTemuan: '[]',
        Pernyataan: '',
        Password: '123456',
        StatusData: 'Belum Lengkap',
      });
      setSelectedTemuan([]);
      setCustomTemuan('');
      setSelectedProvId('');
      setSelectedRegId('');
      setSelectedDistId('');
      setRegencies([]);
      setDistricts([]);
      setVillages([]);
    }
    setErrorMsg('');
  }, [editData, isOpen]);

  if (!isOpen) return null;

  // Toggle Catatan Temuan item
  const handleToggleTemuan = (option: string) => {
    if (selectedTemuan.includes(option)) {
      setSelectedTemuan(selectedTemuan.filter((item) => item !== option));
    } else {
      setSelectedTemuan([...selectedTemuan, option]);
    }
  };

  // Upload single photo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof KpmKeluarga) => {
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

    if (!formData.NIK || formData.NIK.length !== 16) {
      setErrorMsg('NIK harus terdiri dari 16 digit angka.');
      return;
    }
    if (!formData.NoKK || formData.NoKK.length !== 16) {
      setErrorMsg('Nomor Kartu Keluarga (No. KK) harus terdiri dari 16 digit angka.');
      return;
    }
    if (!formData.NamaPengurus?.trim()) {
      setErrorMsg('Nama Pengurus wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      // Compile catatan temuan
      const allTemuan = [...selectedTemuan];
      if (customTemuan.trim()) {
        allTemuan.push(customTemuan.trim());
      }

      const isLengkap = isKpmDataLengkap(formData);
      const formattedPhone = formatIndonesianPhone(formData.NoHP);

      const isEdit = !!editData;
      const url = '/api/kpm';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        KpmId: editData?.KpmId || formData.KpmId || '',
        OriginalNIK: editData?.NIK || '',
        OriginalNoKK: editData?.NoKK || '',
        OriginalNamaPengurus: editData?.NamaPengurus || '',
        OriginalKelompok: editData?.Kelompok || '',
        NoKK: formData.NoKK?.trim(),
        NIK: formData.NIK?.trim(),
        NoHP: formattedPhone,
        CatatanTemuan: JSON.stringify(allTemuan),
        StatusData: isLengkap ? 'Lengkap' : 'Belum Lengkap',
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Gagal menyimpan data KPM');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setErrorMsg('Penyimpanan memakan waktu terlalu lama (timeout). Silakan periksa koneksi Anda dan coba lagi.');
      } else {
        setErrorMsg(err.message || 'Terjadi kesalahan');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#005B94] to-[#00838F] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">
              {editData ? 'edit_document' : 'person_add'}
            </span>
            <div>
              <h3 className="font-bold text-lg font-['Outfit']">
                {editData ? 'Edit Data Keluarga KPM' : 'Tambah Data Keluarga KPM'}
              </h3>
              <p className="text-xs text-white/80">Lengkapi formulir profil keluarga penerima manfaat</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-gray-700">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 text-xs font-medium">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Identitas Dasar */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600 text-lg">badge</span>
              1. Identitas Pokok
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">NIK Pengurus (16 Digit) *</label>
                <input
                  type="text"
                  maxLength={16}
                  value={formData.NIK || ''}
                  onChange={(e) => setFormData({ ...formData, NIK: e.target.value.replace(/\D/g, '') })}
                  placeholder="Contoh: 1271010000000001"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Nomor Kartu Keluarga (16 Digit) *</label>
                <input
                  type="text"
                  maxLength={16}
                  value={formData.NoKK || ''}
                  onChange={(e) => setFormData({ ...formData, NoKK: e.target.value.replace(/\D/g, '') })}
                  placeholder="Contoh: 1271010000000002"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold mb-1">Nama Lengkap Pengurus *</label>
                <input
                  type="text"
                  value={formData.NamaPengurus || ''}
                  onChange={(e) => setFormData({ ...formData, NamaPengurus: e.target.value })}
                  placeholder="Nama lengkap sesuai KTP"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Nomor HP / WhatsApp</label>
                <input
                  type="text"
                  value={formData.NoHP || ''}
                  onChange={(e) => setFormData({ ...formData, NoHP: e.target.value })}
                  onBlur={() => {
                    if (formData.NoHP) {
                      setFormData((prev) => ({ ...prev, NoHP: formatIndonesianPhone(prev.NoHP) }));
                    }
                  }}
                  placeholder="Contoh: 08123456789 atau +628123456789"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Status dalam Kelompok</label>
                <select
                  value={formData.StatusKelompok || 'Anggota'}
                  onChange={(e) => setFormData({ ...formData, StatusKelompok: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white"
                >
                  {STATUS_KELOMPOK_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold mb-1">Nama Kelompok PKH</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.Kelompok || ''}
                    onChange={(e) => setFormData({ ...formData, Kelompok: e.target.value })}
                    placeholder="Ketik nama kelompok baru atau pilih dari daftar"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                  {existingKelompokList.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) setFormData({ ...formData, Kelompok: e.target.value });
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white"
                    >
                      <option value="">-- Pilih Kelompok --</option>
                      {existingKelompokList.map((kel) => (
                        <option key={kel} value={kel}>
                          {kel}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Status Kepesertaan KPM</label>
                <select
                  value={formData.StatusKepesertaan || 'Aktif'}
                  onChange={(e) => setFormData({ ...formData, StatusKepesertaan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white font-bold"
                >
                  <option value="Aktif">🟢 Aktif (Peserta Berjalan)</option>
                  <option value="Tidak Aktif">⚪ Tidak Aktif</option>
                  <option value="Graduasi">🎓 Graduasi (Sudah Keluar)</option>
                </select>
              </div>

              <div className="md:col-span-2 bg-sky-50/70 border border-sky-200 rounded-xl p-3 space-y-1.5">
                <label className="block font-bold text-sky-950 text-xs">
                  Tahap Kepesertaan Bansos (Pilih Ceklist Berjalan):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Tahap 1 (2026)', 'Tahap 2 (2026)', 'Tahap 3 (2026)', 'Tahap 4 (2026)'].map((thp) => {
                    const currentTahapStr = formData.TahapBansos || '';
                    const isChecked =
                      currentTahapStr.includes(thp) ||
                      currentTahapStr.includes(thp.split(' ')[0] + ' ' + thp.split(' ')[1]);
                    return (
                      <label
                        key={thp}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-cyan-600 text-white font-bold border-cyan-700'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let parts = currentTahapStr
                              ? currentTahapStr.split(',').map((p) => p.trim()).filter(Boolean)
                              : [];
                            if (e.target.checked) {
                              if (!parts.includes(thp)) parts.push(thp);
                            } else {
                              parts = parts.filter(
                                (p) =>
                                  p !== thp &&
                                  !p.includes(thp.split(' ')[0] + ' ' + thp.split(' ')[1])
                              );
                            }
                            setFormData({ ...formData, TahapBansos: parts.join(', ') });
                          }}
                          className="accent-white rounded"
                        />
                        <span>{thp}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Wilayah & Alamat */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600 text-lg">location_on</span>
              2. Alamat & Wilayah Dampingan
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Provinsi</label>
                <select
                  value={selectedProvId || (formData.Provinsi ? 'CURRENT_PROV' : '')}
                  onChange={handleProvinceChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white font-medium text-sm"
                >
                  <option value="">-- Pilih Provinsi --</option>
                  {formData.Provinsi && !selectedProvId && (
                    <option value="CURRENT_PROV">{formData.Provinsi}</option>
                  )}
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Kabupaten / Kota</label>
                <select
                  value={selectedRegId || (formData.KabKota ? 'CURRENT_REG' : '')}
                  onChange={handleRegencyChange}
                  disabled={!selectedProvId && !formData.KabKota && regencies.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white disabled:bg-gray-100 font-medium text-sm"
                >
                  <option value="">-- Pilih Kab/Kota --</option>
                  {formData.KabKota && !selectedRegId && (
                    <option value="CURRENT_REG">{formData.KabKota}</option>
                  )}
                  {regencies.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Kecamatan</label>
                <select
                  value={selectedDistId || (formData.Kecamatan ? 'CURRENT_DIST' : '')}
                  onChange={handleDistrictChange}
                  disabled={!selectedRegId && !formData.Kecamatan && districts.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white disabled:bg-gray-100 font-medium text-sm"
                >
                  <option value="">-- Pilih Kecamatan --</option>
                  {formData.Kecamatan && !selectedDistId && (
                    <option value="CURRENT_DIST">{formData.Kecamatan}</option>
                  )}
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Kelurahan / Desa</label>
                <select
                  value={formData.Kelurahan || ''}
                  onChange={handleVillageChange}
                  disabled={!selectedDistId && !formData.Kelurahan && villages.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white disabled:bg-gray-100 font-medium text-sm"
                >
                  <option value="">-- Pilih Kelurahan/Desa --</option>
                  {formData.Kelurahan && !villages.some((v) => v.name.toUpperCase() === (formData.Kelurahan || '').toUpperCase()) && (
                    <option value={formData.Kelurahan}>{formData.Kelurahan}</option>
                  )}
                  {villages.map((v) => (
                    <option key={v.id} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Lingkungan / Dusun</label>
                <input
                  type="text"
                  value={formData.Lingkungan || ''}
                  onChange={(e) => setFormData({ ...formData, Lingkungan: e.target.value })}
                  placeholder="Contoh: Lingkungan IV / Dusun Bahagia"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold mb-1">Alamat Lengkap (Jalan, No Rumah, RT/RW)</label>
                <textarea
                  rows={2}
                  value={formData.Alamat || ''}
                  onChange={(e) => setFormData({ ...formData, Alamat: e.target.value })}
                  placeholder="Contoh: Jl. Gaharu No. 12 RT 02 RW 01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Unggah Dokumen KPM */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600 text-lg">photo_camera</span>
              3. Foto Dokumen KPM
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Foto KTP', field: 'FotoKTP' as keyof KpmKeluarga },
                { label: 'Foto KK', field: 'FotoKK' as keyof KpmKeluarga },
                { label: 'Foto Buku Tabungan', field: 'FotoBukuTabungan' as keyof KpmKeluarga },
                { label: 'Foto KKS', field: 'FotoKKS' as keyof KpmKeluarga },
                { label: 'Foto Rumah', field: 'FotoRumah' as keyof KpmKeluarga },
                { label: 'Foto Bukti Catatan (Opsional)', field: 'FotoBuktiCatatan' as keyof KpmKeluarga },
              ].map(({ label, field }) => {
                const fileId = (formData[field] as string) || '';
                const isUploading = uploadingField === field;
                return (
                  <div key={field} className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex flex-col items-center justify-between text-center relative overflow-hidden group">
                    <p className="font-semibold text-gray-700 text-[11px] mb-2">{label}</p>
                    {fileId ? (
                      <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-200 bg-white">
                        <img
                          src={`/api/image-proxy?id=${fileId}`}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, [field]: '' })}
                          className="absolute top-1 right-1 w-6 h-6 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center text-xs shadow-md"
                          title="Hapus foto"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <label className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/50 transition-colors">
                        {isUploading ? (
                          <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-gray-400 text-2xl mb-1">add_a_photo</span>
                            <span className="text-[10px] text-gray-500">Pilih Foto</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, field)}
                          disabled={isUploading}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Catatan Temuan Lapangan */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600 text-lg">fact_check</span>
              4. Catatan Temuan Lapangan
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CATATAN_TEMUAN_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    selectedTemuan.includes(opt)
                      ? 'bg-cyan-50 border-cyan-500 text-cyan-900 font-semibold'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTemuan.includes(opt)}
                    onChange={() => handleToggleTemuan(opt)}
                    className="accent-cyan-600 rounded"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="block font-semibold mb-1">Catatan Temuan Lainnya (Manual)</label>
              <input
                type="text"
                value={customTemuan}
                onChange={(e) => setCustomTemuan(e.target.value)}
                placeholder="Tulis catatan temuan khusus lainnya jika ada..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
              />
            </div>
          </div>

          {/* Section 5: Pernyataan KPM */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-1">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-600 text-lg">verified</span>
                5. Pernyataan Resmi KPM
              </h4>
              <span className="text-[11px] text-gray-500">
                Pilih opsi di bawah sesuai dengan surat pernyataan fisik dari KPM
              </span>
            </div>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                  !formData.Pernyataan
                    ? 'bg-amber-50 border-amber-400 text-amber-950 font-medium shadow-xs'
                    : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="pernyataan"
                  checked={!formData.Pernyataan}
                  onChange={() => setFormData({ ...formData, Pernyataan: '' })}
                  className="accent-amber-600 mt-0.5"
                />
                <div>
                  <span className="font-semibold text-gray-900">Belum Ada Pernyataan Resmi</span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    KPM ini belum membuat atau belum menandatangani surat pernyataan resmi apapun.
                  </p>
                </div>
              </label>

              {PERNYATAAN_OPTIONS.map((stmt, idx) => (
                <label
                  key={idx}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                    formData.Pernyataan === stmt
                      ? 'bg-cyan-50 border-cyan-500 text-cyan-950 font-medium shadow-xs'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="pernyataan"
                    checked={formData.Pernyataan === stmt}
                    onChange={() => setFormData({ ...formData, Pernyataan: stmt })}
                    className="accent-cyan-600 mt-0.5"
                  />
                  <span className="leading-relaxed">{stmt}</span>
                </label>
              ))}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-gradient-to-r from-[#005B94] to-[#00838F] hover:from-[#004b7a] hover:to-[#006f7a] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Menyimpan ke Google Sheets...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">save</span>
                <span>{editData ? 'Perbarui Data' : 'Simpan Data KPM'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
