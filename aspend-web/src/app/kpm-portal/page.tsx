'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  STATUS_KELOMPOK_OPTIONS,
  KOMPONEN_OPTIONS,
  HUBUNGAN_KELUARGA_OPTIONS,
  STATUS_RUMAH_OPTIONS,
  USAHA_OPTIONS,
  PERNYATAAN_OPTIONS,
  JENIS_KELAMIN_OPTIONS,
  KpmKeluarga,
  KpmAnggota,
  KpmAset,
} from '@/lib/kpm-constants';

function KpmPortalContent() {
  const searchParams = useSearchParams();
  const urlNik = searchParams.get('nik') || '';
  const token = searchParams.get('token') || '';

  // Auth state
  const [nikInput, setNikInput] = useState(urlNik);
  const [passwordInput, setPasswordInput] = useState('123456');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState('');

  // KPM Loaded Data
  const [kpmData, setKpmData] = useState<KpmKeluarga | null>(null);

  // Tabs: 'keluarga' | 'anggota' | 'aset' | 'pernyataan'
  const [activeTab, setActiveTab] = useState<'keluarga' | 'anggota' | 'aset' | 'pernyataan'>('keluarga');

  // Blok 1: Keluarga fields
  const [namaPengurus, setNamaPengurus] = useState('');
  const [noHP, setNoHP] = useState('');
  const [kelompok, setKelompok] = useState('');
  const [statusKelompok, setStatusKelompok] = useState('Anggota');
  const [alamat, setAlamat] = useState('');
  const [lingkungan, setLingkungan] = useState('');
  const [provinsi, setProvinsi] = useState('');
  const [kabKota, setKabKota] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [kelurahan, setKelurahan] = useState('');

  // Berkas Foto Keluarga
  const [fotoKTP, setFotoKTP] = useState('');
  const [fotoKK, setFotoKK] = useState('');
  const [fotoBukuTabungan, setFotoBukuTabungan] = useState('');
  const [fotoKKS, setFotoKKS] = useState('');
  const [fotoRumah, setFotoRumah] = useState('');

  // Blok 2: Anggota Keluarga
  const [anggotaList, setAnggotaList] = useState<KpmAnggota[]>([]);
  const [deletedAnggotaIds, setDeletedAnggotaIds] = useState<string[]>([]);

  // Form Tambah Anggota Baru
  const [tempNama, setTempNama] = useState('');
  const [tempNik, setTempNik] = useState('');
  const [tempJK, setTempJK] = useState('Laki-laki');
  const [tempTglLahir, setTempTglLahir] = useState('');
  const [tempHub, setTempHub] = useState('Anak');
  const [tempKomp, setTempKomp] = useState('');
  const [tempPosyandu, setTempPosyandu] = useState('');
  const [tempSekolah, setTempSekolah] = useState('');
  const [tempKelas, setTempKelas] = useState('');
  const [tempPekerjaan, setTempPekerjaan] = useState('');
  const [tempKetAnggota, setTempKetAnggota] = useState('');

  // Blok 3: Rumah & Aset
  const [statusRumah, setStatusRumah] = useState('Milik Sendiri');
  const [usaha, setUsaha] = useState('Tidak Memiliki Usaha');
  const [jenisUsaha, setJenisUsaha] = useState('');
  const [fotoUsaha, setFotoUsaha] = useState('');
  const [fotoRumahLuar, setFotoRumahLuar] = useState('');
  const [fotoRumahDalam, setFotoRumahDalam] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [tahunMenerimaBansos, setTahunMenerimaBansos] = useState('');
  const [keteranganAset, setKeteranganAset] = useState('');

  // Blok 4: Pernyataan KPM
  const [pernyataan, setPernyataan] = useState('');

  // Uploading state
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Saving / notification state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSuccessAll, setIsSuccessAll] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoadingAuth(true);

    try {
      let query = `action=kpm-data&nik=${nikInput}&password=${passwordInput}`;
      if (token) query += `&token=${token}`;

      const res = await fetch(`/api/kpm/portal?${query}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Gagal masuk');
      }

      const keluarga: KpmKeluarga = json.data?.keluarga || json.data;
      const anggota: KpmAnggota[] = json.data?.anggota || [];
      const aset: KpmAset | null = json.data?.aset || null;

      setKpmData(keluarga);
      setNamaPengurus(keluarga.NamaPengurus || '');
      setNoHP(keluarga.NoHP || '');
      setKelompok(keluarga.Kelompok || '');
      setStatusKelompok(keluarga.StatusKelompok || 'Anggota');
      setAlamat(keluarga.Alamat || '');
      setLingkungan(keluarga.Lingkungan || '');
      setProvinsi(keluarga.Provinsi || '');
      setKabKota(keluarga.KabKota || '');
      setKecamatan(keluarga.Kecamatan || '');
      setKelurahan(keluarga.Kelurahan || '');
      setFotoKTP(keluarga.FotoKTP || '');
      setFotoKK(keluarga.FotoKK || '');
      setFotoBukuTabungan(keluarga.FotoBukuTabungan || '');
      setFotoKKS(keluarga.FotoKKS || '');
      setFotoRumah(keluarga.FotoRumah || '');
      setPernyataan(keluarga.Pernyataan || '');

      const rawAnggota: KpmAnggota[] = json.data?.anggota || [];
      const uniqueAnggota: KpmAnggota[] = [];
      const seenNiks = new Set<string>();
      for (const a of rawAnggota) {
        const aNik = (a.NIK || '').replace(/\D/g, '');
        if (aNik && seenNiks.has(aNik)) continue;
        if (aNik) seenNiks.add(aNik);
        uniqueAnggota.push(a);
      }

      setAnggotaList(uniqueAnggota);

      if (aset) {
        setStatusRumah(aset.StatusRumah || 'Milik Sendiri');
        setUsaha(aset.Usaha || 'Tidak Memiliki Usaha');
        setJenisUsaha(aset.JenisUsaha || '');
        setFotoUsaha(aset.FotoUsaha || '');
        setFotoRumahLuar(aset.FotoRumahLuar || '');
        setFotoRumahDalam(aset.FotoRumahDalam || '');
        setLatitude(aset.Latitude || '');
        setLongitude(aset.Longitude || '');
        setTahunMenerimaBansos(aset.TahunMenerimaBansos || '');
        setKeteranganAset(aset.Keterangan || '');
      }

      setIsLoggedIn(true);
    } catch (err: any) {
      setAuthError(err.message || 'Terjadi kesalahan saat masuk');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Upload handler for photos
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(fieldKey);
    setSubmitError('');

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('files', file);
      uploadFormData.append('folderName', 'RHK-agent_FotoKPM');
      if (token) {
        uploadFormData.append('token', token);
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengunggah foto');
      }

      if (data.files && data.files.length > 0) {
        const fileId = data.files[0].id;
        switch (fieldKey) {
          case 'FotoKTP':
            setFotoKTP(fileId);
            break;
          case 'FotoKK':
            setFotoKK(fileId);
            break;
          case 'FotoBukuTabungan':
            setFotoBukuTabungan(fileId);
            break;
          case 'FotoKKS':
            setFotoKKS(fileId);
            break;
          case 'FotoRumah':
            setFotoRumah(fileId);
            break;
          case 'FotoUsaha':
            setFotoUsaha(fileId);
            break;
          case 'FotoRumahLuar':
            setFotoRumahLuar(fileId);
            break;
          case 'FotoRumahDalam':
            setFotoRumahDalam(fileId);
            break;
        }
      }
    } catch (err: any) {
      setSubmitError(`Gagal upload foto: ${err.message}`);
    } finally {
      setUploadingField(null);
    }
  };

  // GPS handler
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Browser Anda tidak mendukung deteksi lokasi GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      (err) => {
        alert(`Gagal mengambil titik GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Tambah Anggota Baru
  const handleAddAnggota = () => {
    if (!tempNama.trim() || !tempNik.trim()) {
      alert('Nama dan NIK anggota keluarga wajib diisi.');
      return;
    }
    const cleanNik = tempNik.replace(/\D/g, '');
    if (cleanNik.length !== 16) {
      alert('NIK anggota harus terdiri dari 16 digit angka.');
      return;
    }
    if (anggotaList.some((a) => (a.NIK || '').replace(/\D/g, '') === cleanNik)) {
      alert('Anggota dengan NIK ini sudah ada dalam daftar.');
      return;
    }

    const newMember: KpmAnggota = {
      AnggotaId: '', // akan dibuat otomatis oleh backend
      NoKK: kpmData?.NoKK || '',
      NIK: cleanNik,
      Nama: tempNama.trim(),
      JenisKelamin: tempJK,
      TanggalLahir: tempTglLahir,
      Komponen: tempKomp,
      HubunganKeluarga: tempHub,
      Posyandu: tempPosyandu.trim(),
      Sekolah: tempSekolah.trim(),
      Kelas: tempKelas.trim(),
      Pekerjaan: tempPekerjaan.trim(),
      Keterangan: tempKetAnggota.trim(),
      CreatedAt: new Date().toISOString(),
    };

    setAnggotaList((prev) => [...prev, newMember]);
    setTempNama('');
    setTempNik('');
    setTempJK('Laki-laki');
    setTempTglLahir('');
    setTempHub('Anak');
    setTempKomp('');
    setTempPosyandu('');
    setTempSekolah('');
    setTempKelas('');
    setTempPekerjaan('');
    setTempKetAnggota('');
  };

  // Hapus Anggota dari daftar
  const handleDeleteAnggota = (index: number) => {
    const target = anggotaList[index];
    if (target?.AnggotaId) {
      setDeletedAnggotaIds((prev) => [...prev, target.AnggotaId]);
    }
    setAnggotaList((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Intermediate block save handler
   * Menyimpan kemajuan data secara parsial sesuai blok aktif lalu berpindah ke blok berikutnya
   */
  const handleSaveBlock = async (
    currentBlock: 'keluarga' | 'anggota' | 'aset' | 'pernyataan',
    nextTab?: 'keluarga' | 'anggota' | 'aset' | 'pernyataan' | 'done'
  ) => {
    setIsSaving(true);
    setSubmitError('');
    setSaveSuccessMsg('');

    try {
      const payload: any = {
        token,
        nik: kpmData?.NIK || nikInput,
        password: passwordInput,
        step: currentBlock,
      };

      // Siapkan payload dataKeluarga jika di blok keluarga, pernyataan, atau final
      if (currentBlock === 'keluarga' || currentBlock === 'pernyataan' || nextTab === 'done') {
        payload.dataKeluarga = {
          NoKK: kpmData?.NoKK || '',
          NamaPengurus: namaPengurus,
          NoHP: noHP,
          Alamat: alamat,
          Lingkungan: lingkungan,
          Provinsi: provinsi,
          KabKota: kabKota,
          Kecamatan: kecamatan,
          Kelurahan: kelurahan,
          FotoKTP: fotoKTP,
          FotoKK: fotoKK,
          FotoBukuTabungan: fotoBukuTabungan,
          FotoKKS: fotoKKS,
          FotoRumah: fotoRumah,
          Pernyataan: pernyataan,
        };
      }

      // Siapkan payload dataAnggota HANYA jika di blok anggota
      if (currentBlock === 'anggota') {
        payload.dataAnggota = anggotaList;
        payload.deletedAnggotaIds = deletedAnggotaIds;
      }

      // Siapkan payload dataAset jika di blok aset atau final
      if (currentBlock === 'aset' || nextTab === 'done') {
        payload.dataAset = {
          StatusRumah: statusRumah,
          Usaha: usaha,
          JenisUsaha: jenisUsaha,
          FotoUsaha: fotoUsaha,
          FotoRumahLuar: fotoRumahLuar,
          FotoRumahDalam: fotoRumahDalam,
          Latitude: latitude,
          Longitude: longitude,
          TahunMenerimaBansos: tahunMenerimaBansos,
          Keterangan: keteranganAset,
        };
      }

      const res = await fetch('/api/kpm/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menyimpan perubahan');
      }

      // Update data anggota terkini jika dikembalikan oleh backend
      if (json.data?.anggota) {
        setAnggotaList(json.data.anggota);
      }

      // Reset daftar deleted IDs setelah tersimpan
      if (payload.deletedAnggotaIds?.length) {
        setDeletedAnggotaIds([]);
      }

      setSaveSuccessMsg('Data pada blok ini berhasil disimpan ke sistem.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);

      if (nextTab === 'done') {
        setIsSuccessAll(true);
      } else if (nextTab) {
        setActiveTab(nextTab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal menyimpan data ke sistem');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col font-['Inter',sans-serif]">
      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl">
            <img
              src={`/api/image-proxy?id=${previewPhoto}`}
              alt="Pratinjau Foto"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded-xl"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 bg-black/60 text-white rounded-full p-2 hover:bg-black transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <header className="bg-gradient-to-r from-[#005B94] to-[#00838F] text-white py-4 px-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Kemensos"
              width={42}
              height={42}
              className="rounded-xl bg-white p-1 shadow-xs"
            />
            <div>
              <h1 className="font-bold text-base sm:text-lg font-['Outfit']">PORTAL PENGISIAN MANDIRI KPM PKH</h1>
              <p className="text-[11px] text-white/80">Kementerian Sosial Republik Indonesia</p>
            </div>
          </div>
          {isLoggedIn && (
            <button
              onClick={() => {
                if (confirm('Keluar dari portal pengisian? Pastikan Anda sudah menyimpan data Anda.')) {
                  setIsLoggedIn(false);
                }
              }}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs text-white font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>Keluar</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6">
        {!isLoggedIn ? (
          /* LOGIN SCREEN */
          <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-10 shadow-xl max-w-md mx-auto mt-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-cyan-100 text-cyan-800 flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-3xl">badge</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 font-['Outfit']">Masuk ke Formulir Mandiri KPM</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Silakan masukkan 16 Digit NIK dan Password default Anda untuk mulai melengkapi atau melanjutkan data keluarga Anda.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">NIK Pengurus (16 Digit)</label>
                <input
                  type="text"
                  maxLength={16}
                  value={nikInput}
                  onChange={(e) => setNikInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 1271010000000001"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Password Masuk</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password default: 123456"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">💡 Password bawaan sistem adalah: <strong>123456</strong></p>
              </div>

              <button
                type="submit"
                disabled={isLoadingAuth}
                className="w-full py-3 bg-gradient-to-r from-[#005B94] to-[#00838F] hover:from-[#004b7a] hover:to-[#006f7a] text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoadingAuth ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Memeriksa Akun...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">login</span>
                    <span>Masuk ke Formulir</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-gray-100 text-center text-[11px] text-gray-400">
              Jika mengalami kendala, silakan hubungi Pendamping PKH di wilayah Anda.
            </div>
          </div>
        ) : isSuccessAll ? (
          /* SUCCESS SCREEN */
          <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 shadow-xl max-w-lg mx-auto text-center space-y-4 mt-8">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 font-['Outfit']">Seluruh Data Berhasil Disimpan!</h2>
            <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
              Terima kasih, Bapak/Ibu <strong>{namaPengurus || kpmData?.NamaPengurus}</strong>. Data profil keluarga, anggota keluarga, kondisi rumah & aset, serta pernyataan komitmen Anda telah tersimpan secara resmi di sistem PKH.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  setIsSuccessAll(false);
                  setActiveTab('keluarga');
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Lihat & Edit Kembali Formulir
              </button>
              <button
                onClick={() => {
                  setIsSuccessAll(false);
                  setIsLoggedIn(false);
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Selesai & Keluar
              </button>
            </div>
          </div>
        ) : (
          /* MULTI-TAB FORM WITH AUTO/STEP SAVE */
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden space-y-6">
            {/* Header Profil Singkat */}
            <div className="bg-gradient-to-br from-cyan-50 to-sky-50 border-b border-cyan-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-cyan-800 font-semibold">Selamat Datang,</p>
                <h2 className="text-lg font-bold text-gray-900 font-['Outfit']">{namaPengurus || kpmData?.NamaPengurus}</h2>
                <p className="text-[11px] text-gray-500 font-mono">
                  No. KK: <strong>{kpmData?.NoKK}</strong> | NIK: <strong>{kpmData?.NIK}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>KPM PKH Aktif</span>
                </span>
              </div>
            </div>

            {/* Notification Banners */}
            <div className="px-6 space-y-2">
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-medium flex items-center gap-2 transition-all">
                  <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                  <span>{saveSuccessMsg}</span>
                </div>
              )}
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            {/* Stepper / Tab Navigation */}
            <div className="px-6 flex border-b border-gray-200 overflow-x-auto gap-2">
              {[
                { id: 'keluarga', label: '1. Data Keluarga', icon: 'home' },
                { id: 'anggota', label: `2. Anggota (${anggotaList.length})`, icon: 'groups' },
                { id: 'aset', label: '3. Rumah & Aset', icon: 'roofing' },
                { id: 'pernyataan', label: '4. Pernyataan', icon: 'verified' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-cyan-600 text-cyan-800'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* TAB CONTENTS */}
            <div className="p-6 space-y-6 text-xs text-gray-700">
              
              {/* ============================================================== */}
              {/* BLOK 1: DATA KELUARGA & FOTO DOKUMEN                           */}
              {/* ============================================================== */}
              {activeTab === 'keluarga' && (
                <div className="space-y-5">
                  <div className="border-b pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">Blok 1: Data Pokok Keluarga & Dokumen</h3>
                      <p className="text-[11px] text-gray-500">Lengkapi identitas pengurus, kelompok, alamat, dan foto berkas keluarga.</p>
                    </div>
                    <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-2.5 py-1 rounded-full">
                      Langkah 1 dari 4
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-1">Nama Lengkap Pengurus</label>
                      <input
                        type="text"
                        value={namaPengurus}
                        onChange={(e) => setNamaPengurus(e.target.value)}
                        placeholder="Nama pengurus sesuai KTP"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Nomor HP / WhatsApp Aktif</label>
                      <input
                        type="text"
                        value={noHP}
                        onChange={(e) => setNoHP(e.target.value)}
                        placeholder="Contoh: 08123456789"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h4 className="font-bold text-gray-800 border-b pb-1">Alamat & Wilayah Tempat Tinggal</h4>
                    <div>
                      <label className="block font-semibold mb-1">Alamat Rumah Lengkap (Jalan / Gang / RT / RW / No)</label>
                      <textarea
                        rows={2}
                        value={alamat}
                        onChange={(e) => setAlamat(e.target.value)}
                        placeholder="Contoh: Jl. Diponegoro No. 12 RT 02 RW 01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Lingkungan / Dusun</label>
                        <input
                          type="text"
                          value={lingkungan}
                          onChange={(e) => setLingkungan(e.target.value)}
                          placeholder="Contoh: Dusun Karanganyar"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Kelurahan / Desa</label>
                        <input
                          type="text"
                          value={kelurahan}
                          onChange={(e) => setKelurahan(e.target.value)}
                          placeholder="Nama kelurahan/desa"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Kecamatan</label>
                        <input
                          type="text"
                          value={kecamatan}
                          onChange={(e) => setKecamatan(e.target.value)}
                          placeholder="Nama kecamatan"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Kabupaten / Kota</label>
                        <input
                          type="text"
                          value={kabKota}
                          onChange={(e) => setKabKota(e.target.value)}
                          placeholder="Nama kabupaten/kota"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Upload Berkas Foto */}
                  <div className="space-y-3 pt-2">
                    <h4 className="font-bold text-gray-800 border-b pb-1">Unggah Foto Berkas & Dokumen</h4>
                    <p className="text-[11px] text-gray-500">
                      Ambil foto langsung melalui kamera ponsel atau pilih dari galeri Anda.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: 'Foto KTP Pengurus', fieldKey: 'FotoKTP', val: fotoKTP, setVal: setFotoKTP },
                        { label: 'Foto Kartu Keluarga', fieldKey: 'FotoKK', val: fotoKK, setVal: setFotoKK },
                        { label: 'Foto Buku Tabungan', fieldKey: 'FotoBukuTabungan', val: fotoBukuTabungan, setVal: setFotoBukuTabungan },
                        { label: 'Foto Kartu KKS PKH', fieldKey: 'FotoKKS', val: fotoKKS, setVal: setFotoKKS },
                        { label: 'Foto Rumah KPM', fieldKey: 'FotoRumah', val: fotoRumah, setVal: setFotoRumah },
                      ].map(({ label, fieldKey, val, setVal }) => {
                        const isUploading = uploadingField === fieldKey;
                        return (
                          <div
                            key={fieldKey}
                            className="border border-gray-200 rounded-2xl p-3 bg-gray-50 flex flex-col items-center justify-between text-center relative overflow-hidden"
                          >
                            <p className="font-semibold text-gray-800 text-[11px] mb-2">{label}</p>
                            {val ? (
                              <div className="relative w-full h-24 rounded-xl overflow-hidden border border-gray-300 bg-white group">
                                <img
                                  src={`/api/image-proxy?id=${val}`}
                                  alt={label}
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => setPreviewPhoto(val)}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewPhoto(val)}
                                    className="p-1 bg-white rounded-full text-slate-800 shadow"
                                    title="Perbesar"
                                  >
                                    <span className="material-symbols-outlined text-sm">zoom_in</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setVal('')}
                                    className="p-1 bg-rose-600 rounded-full text-white shadow"
                                    title="Hapus"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <label className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/50 transition-colors">
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
                                  disabled={isUploading}
                                  onChange={(e) => handlePhotoUpload(e, fieldKey)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons for Blok 1 */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveBlock('keluarga')}
                      className="w-full sm:w-auto px-4 py-2.5 border border-cyan-600 text-cyan-800 hover:bg-cyan-50 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-base">save</span>
                      <span>Simpan Sementara Blok Ini</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveBlock('keluarga', 'anggota')}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-800 hover:to-teal-800 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <span>Simpan & Lanjut ke Blok Anggota ▶</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* BLOK 2: ANGGOTA KELUARGA                                       */}
              {/* ============================================================== */}
              {activeTab === 'anggota' && (
                <div className="space-y-5">
                  <div className="border-b pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">Blok 2: Anggota Keluarga</h3>
                      <p className="text-[11px] text-gray-500">
                        Daftar seluruh anggota keluarga (anak, suami, istri, lansia, disabilitas) yang tinggal bersama.
                      </p>
                    </div>
                    <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-2.5 py-1 rounded-full">
                      Langkah 2 dari 4
                    </span>
                  </div>

                  {/* List Anggota Terdaftar */}
                  {anggotaList.length > 0 ? (
                    <div className="space-y-2.5">
                      {anggotaList.map((a, idx) => (
                        <div
                          key={a.AnggotaId || idx}
                          className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl flex items-start justify-between gap-3 shadow-2xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-900 text-sm">{a.Nama}</span>
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-semibold text-[10px]">
                                {a.HubunganKeluarga}
                              </span>
                              {a.Komponen && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">
                                  {a.Komponen}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 font-mono">
                              NIK: {a.NIK} • JK: {a.JenisKelamin} {a.TanggalLahir ? `• Lahir: ${a.TanggalLahir}` : ''}
                            </p>
                            {(a.Posyandu || a.Sekolah || a.Pekerjaan) && (
                              <p className="text-[11px] text-gray-600">
                                {a.Posyandu && <span>🏥 Posyandu: {a.Posyandu} </span>}
                                {a.Sekolah && <span>🎒 Sekolah: {a.Sekolah} {a.Kelas ? `(Kls ${a.Kelas})` : ''} </span>}
                                {a.Pekerjaan && <span>💼 Pekerjaan: {a.Pekerjaan} </span>}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnggota(idx)}
                            className="p-1.5 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors cursor-pointer"
                            title="Hapus Anggota"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center text-amber-900 text-xs">
                      Belum ada anggota keluarga yang terdaftar. Silakan tambahkan anggota keluarga di bawah ini.
                    </div>
                  )}

                  {/* Form Tambah Anggota */}
                  <div className="border border-dashed border-cyan-300 rounded-2xl p-4 bg-cyan-50/30 space-y-3">
                    <p className="font-bold text-gray-800 flex items-center gap-1.5 text-xs">
                      <span className="material-symbols-outlined text-base text-cyan-700">person_add</span>
                      Tambah Anggota Keluarga Baru
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Nama Lengkap Anggota *</label>
                        <input
                          type="text"
                          value={tempNama}
                          onChange={(e) => setTempNama(e.target.value)}
                          placeholder="Nama sesuai KK/KTP"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">NIK (16 Digit) *</label>
                        <input
                          type="text"
                          maxLength={16}
                          value={tempNik}
                          onChange={(e) => setTempNik(e.target.value.replace(/\D/g, ''))}
                          placeholder="Contoh: 1271010000000002"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Jenis Kelamin</label>
                        <select
                          value={tempJK}
                          onChange={(e) => setTempJK(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                        >
                          {JENIS_KELAMIN_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Tanggal Lahir</label>
                        <input
                          type="date"
                          value={tempTglLahir}
                          onChange={(e) => setTempTglLahir(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Hubungan Keluarga</label>
                        <select
                          value={tempHub}
                          onChange={(e) => setTempHub(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                        >
                          {HUBUNGAN_KELUARGA_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Komponen PKH</label>
                        <select
                          value={tempKomp}
                          onChange={(e) => setTempKomp(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                        >
                          <option value="">-- Bukan Komponen PKH --</option>
                          {KOMPONEN_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Kondisional Posyandu */}
                      {(tempKomp === 'Balita' || tempKomp === 'Ibu Hamil') && (
                        <div className="sm:col-span-2">
                          <label className="block font-semibold mb-1">Nama Posyandu Terdaftar</label>
                          <input
                            type="text"
                            value={tempPosyandu}
                            onChange={(e) => setTempPosyandu(e.target.value)}
                            placeholder="Contoh: Posyandu Melati Indah"
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                          />
                        </div>
                      )}

                      {/* Kondisional Sekolah */}
                      {(tempKomp === 'Anak SD' || tempKomp === 'Anak SMP' || tempKomp === 'Anak SMA') && (
                        <>
                          <div>
                            <label className="block font-semibold mb-1">Nama Sekolah</label>
                            <input
                              type="text"
                              value={tempSekolah}
                              onChange={(e) => setTempSekolah(e.target.value)}
                              placeholder="Contoh: SDN 01 Harapan"
                              className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Kelas</label>
                            <input
                              type="text"
                              value={tempKelas}
                              onChange={(e) => setTempKelas(e.target.value)}
                              placeholder="Contoh: 3 / 8 / 11"
                              className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block font-semibold mb-1">Pekerjaan</label>
                        <input
                          type="text"
                          value={tempPekerjaan}
                          onChange={(e) => setTempPekerjaan(e.target.value)}
                          placeholder="Contoh: Pelajar / Buruh Harian / IRT"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Keterangan Tambahan</label>
                        <input
                          type="text"
                          value={tempKetAnggota}
                          onChange={(e) => setTempKetAnggota(e.target.value)}
                          placeholder="Catatan jika ada"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddAnggota}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      <span>Tambahkan ke Daftar Anggota</span>
                    </button>
                  </div>

                  {/* Actions for Blok 2 */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t">
                    <button
                      type="button"
                      onClick={() => setActiveTab('keluarga')}
                      className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                    >
                      ◀ Kembali ke Blok Keluarga
                    </button>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveBlock('anggota')}
                        className="px-4 py-2.5 border border-cyan-600 text-cyan-800 hover:bg-cyan-50 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-base">save</span>
                        <span>Simpan</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveBlock('anggota', 'aset')}
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-800 hover:to-teal-800 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <span>Simpan & Lanjut ke Blok Rumah & Aset ▶</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* BLOK 3: RUMAH & ASET                                           */}
              {/* ============================================================== */}
              {activeTab === 'aset' && (
                <div className="space-y-5">
                  <div className="border-b pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">Blok 3: Kondisi Rumah, Usaha & Aset</h3>
                      <p className="text-[11px] text-gray-500">
                        Lengkapi status kepemilikan tempat tinggal, usaha keluarga, foto rumah/usaha, serta titik koordinat GPS.
                      </p>
                    </div>
                    <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-2.5 py-1 rounded-full">
                      Langkah 3 dari 4
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-1">Status Kepemilikan Rumah</label>
                      <select
                        value={statusRumah}
                        onChange={(e) => setStatusRumah(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                      >
                        {STATUS_RUMAH_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Kepemilikan Usaha Keluarga</label>
                      <select
                        value={usaha}
                        onChange={(e) => setUsaha(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                      >
                        {USAHA_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    {usaha === 'Memiliki Usaha' && (
                      <div className="sm:col-span-2 bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-3">
                        <h4 className="font-bold text-amber-950 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base text-amber-700">store</span>
                          Detail Usaha KPM
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-semibold mb-1">Jenis Usaha</label>
                            <input
                              type="text"
                              value={jenisUsaha}
                              onChange={(e) => setJenisUsaha(e.target.value)}
                              placeholder="Contoh: Warung kopi, jualan kue, ternak ayam"
                              className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Foto Tempat Usaha</label>
                            {fotoUsaha ? (
                              <div className="relative w-full h-24 rounded-xl overflow-hidden border border-gray-300 bg-white group">
                                <img
                                  src={`/api/image-proxy?id=${fotoUsaha}`}
                                  alt="Foto Usaha"
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => setPreviewPhoto(fotoUsaha)}
                                />
                                <button
                                  type="button"
                                  onClick={() => setFotoUsaha('')}
                                  className="absolute top-1 right-1 p-1 bg-rose-600 rounded-full text-white shadow"
                                  title="Hapus Foto"
                                >
                                  <span className="material-symbols-outlined text-xs">close</span>
                                </button>
                              </div>
                            ) : (
                              <label className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/50 transition-colors">
                                {uploadingField === 'FotoUsaha' ? (
                                  <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-gray-400 text-2xl mb-1">add_a_photo</span>
                                    <span className="text-[10px] text-gray-500">Unggah Foto Usaha</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={uploadingField === 'FotoUsaha'}
                                  onChange={(e) => handlePhotoUpload(e, 'FotoUsaha')}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Foto Rumah Luar & Dalam */}
                  <div className="space-y-3 pt-2">
                    <h4 className="font-bold text-gray-800 border-b pb-1">Foto Kondisi Rumah</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold mb-1">Foto Rumah Tampak Depan / Luar</label>
                        {fotoRumahLuar ? (
                          <div className="relative w-full h-28 rounded-xl overflow-hidden border border-gray-300 bg-white group">
                            <img
                              src={`/api/image-proxy?id=${fotoRumahLuar}`}
                              alt="Foto Rumah Luar"
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setPreviewPhoto(fotoRumahLuar)}
                            />
                            <button
                              type="button"
                              onClick={() => setFotoRumahLuar('')}
                              className="absolute top-1 right-1 p-1 bg-rose-600 rounded-full text-white shadow"
                              title="Hapus"
                            >
                              <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                          </div>
                        ) : (
                          <label className="w-full h-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/50 transition-colors">
                            {uploadingField === 'FotoRumahLuar' ? (
                              <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-gray-400 text-2xl mb-1">add_a_photo</span>
                                <span className="text-[10px] text-gray-500">Unggah Foto Rumah Luar</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingField === 'FotoRumahLuar'}
                              onChange={(e) => handlePhotoUpload(e, 'FotoRumahLuar')}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Foto Rumah Tampak Dalam (Ruang Tengah/Dapur)</label>
                        {fotoRumahDalam ? (
                          <div className="relative w-full h-28 rounded-xl overflow-hidden border border-gray-300 bg-white group">
                            <img
                              src={`/api/image-proxy?id=${fotoRumahDalam}`}
                              alt="Foto Rumah Dalam"
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setPreviewPhoto(fotoRumahDalam)}
                            />
                            <button
                              type="button"
                              onClick={() => setFotoRumahDalam('')}
                              className="absolute top-1 right-1 p-1 bg-rose-600 rounded-full text-white shadow"
                              title="Hapus"
                            >
                              <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                          </div>
                        ) : (
                          <label className="w-full h-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/50 transition-colors">
                            {uploadingField === 'FotoRumahDalam' ? (
                              <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-gray-400 text-2xl mb-1">add_a_photo</span>
                                <span className="text-[10px] text-gray-500">Unggah Foto Rumah Dalam</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingField === 'FotoRumahDalam'}
                              onChange={(e) => handlePhotoUpload(e, 'FotoRumahDalam')}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Titik Lokasi GPS & Bansos */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block font-semibold">Titik Lokasi Rumah (Koordinat GPS)</label>
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">my_location</span>
                        <span>Ambil Lokasi Saya</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input
                          type="text"
                          value={latitude}
                          onChange={(e) => setLatitude(e.target.value)}
                          placeholder="Latitude (Contoh: -6.2088)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono outline-none"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={longitude}
                          onChange={(e) => setLongitude(e.target.value)}
                          placeholder="Longitude (Contoh: 106.8456)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block font-semibold mb-1">Tahun Pertama Kali Menerima Bansos PKH</label>
                        <input
                          type="text"
                          value={tahunMenerimaBansos}
                          onChange={(e) => setTahunMenerimaBansos(e.target.value)}
                          placeholder="Contoh: 2018"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Keterangan Kondisi Tempat Tinggal</label>
                        <input
                          type="text"
                          value={keteranganAset}
                          onChange={(e) => setKeteranganAset(e.target.value)}
                          placeholder="Contoh: Dinding semi permanen, lantai semen"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions for Blok 3 */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t">
                    <button
                      type="button"
                      onClick={() => setActiveTab('anggota')}
                      className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                    >
                      ◀ Kembali ke Blok Anggota
                    </button>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveBlock('aset')}
                        className="px-4 py-2.5 border border-cyan-600 text-cyan-800 hover:bg-cyan-50 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-base">save</span>
                        <span>Simpan</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveBlock('aset', 'pernyataan')}
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-800 hover:to-teal-800 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <span>Simpan & Lanjut ke Blok Pernyataan ▶</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* BLOK 4: PERNYATAAN RESMI KPM                                   */}
              {/* ============================================================== */}
              {activeTab === 'pernyataan' && (
                <div className="space-y-5">
                  <div className="border-b pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">Blok 4: Pernyataan Komitmen Resmi KPM</h3>
                      <p className="text-[11px] text-gray-500">
                        Pilih surat pernyataan resmi di bawah ini sesuai dengan kondisi riil keluarga Anda.
                      </p>
                    </div>
                    <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-2.5 py-1 rounded-full">
                      Langkah 4 dari 4
                    </span>
                  </div>

                  <div className="space-y-3">
                    <label
                      className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                        !pernyataan
                          ? 'bg-amber-50 border-amber-400 text-amber-950 font-medium shadow-xs'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pernyataan_portal"
                        checked={!pernyataan}
                        onChange={() => setPernyataan('')}
                        className="accent-amber-600 mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-gray-900 text-xs">Belum Ada Pernyataan Resmi</span>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Saya belum membuat atau belum memilih surat pernyataan komitmen saat ini.
                        </p>
                      </div>
                    </label>

                    {PERNYATAAN_OPTIONS.map((stmt, idx) => (
                      <label
                        key={idx}
                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                          pernyataan === stmt
                            ? 'bg-cyan-50 border-cyan-500 text-cyan-950 font-medium shadow-xs'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pernyataan_portal"
                          checked={pernyataan === stmt}
                          onChange={() => setPernyataan(stmt)}
                          className="accent-cyan-600 mt-0.5"
                        />
                        <span className="leading-relaxed text-xs">{stmt}</span>
                      </label>
                    ))}
                  </div>

                  {/* Actions for Blok 4 */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t">
                    <button
                      type="button"
                      onClick={() => setActiveTab('aset')}
                      className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                    >
                      ◀ Kembali ke Blok Rumah & Aset
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveBlock('pernyataan', 'done')}
                      className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Menyimpan Seluruh Formulir...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">verified</span>
                          <span>Simpan & Selesaikan Pengisian Mandiri</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-gray-400 border-t border-gray-200 mt-auto">
        Sistem ASPEND Web PKH • Kementerian Sosial Republik Indonesia
      </footer>
    </div>
  );
}

export default function KpmPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <KpmPortalContent />
    </Suspense>
  );
}
