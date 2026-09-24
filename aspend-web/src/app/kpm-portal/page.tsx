'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  KOMPONEN_OPTIONS,
  HUBUNGAN_KELUARGA_OPTIONS,
  STATUS_RUMAH_OPTIONS,
  USAHA_OPTIONS,
  PERNYATAAN_OPTIONS,
  KpmKeluarga,
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

  // KPM Data
  const [kpmData, setKpmData] = useState<KpmKeluarga | null>(null);

  // Form steps: 1: Keluarga, 2: Anggota, 3: Aset, 4: Foto, 5: Selesai
  const [activeTab, setActiveTab] = useState<'keluarga' | 'anggota' | 'aset' | 'pernyataan'>('keluarga');

  // Form inputs
  const [alamat, setAlamat] = useState('');
  const [lingkungan, setLingkungan] = useState('');
  const [noHP, setNoHP] = useState('');

  // Anggota list
  const [anggotaList, setAnggotaList] = useState<
    Array<{
      NIK: string;
      Nama: string;
      JenisKelamin: string;
      Komponen: string;
      HubunganKeluarga: string;
      Sekolah?: string;
      Posyandu?: string;
    }>
  >([]);

  // Aset inputs
  const [statusRumah, setStatusRumah] = useState('Milik Sendiri');
  const [usaha, setUsaha] = useState('Tidak Memiliki Usaha');
  const [jenisUsaha, setJenisUsaha] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [pernyataan, setPernyataan] = useState('');

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

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

      setKpmData(json.data);
      setAlamat(json.data.Alamat || '');
      setLingkungan(json.data.Lingkungan || '');
      setNoHP(json.data.NoHP || '');
      setPernyataan(json.data.Pernyataan || '');
      setIsLoggedIn(true);
    } catch (err: any) {
      setAuthError(err.message || 'Terjadi kesalahan');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // GPS handler
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Browser Anda tidak mendukung deteksi lokasi.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      (err) => {
        alert(`Gagal mengambil lokasi: ${err.message}`);
      }
    );
  };

  // Add temp anggota
  const [tempNama, setTempNama] = useState('');
  const [tempNik, setTempNik] = useState('');
  const [tempJK, setTempJK] = useState('Laki-laki');
  const [tempKomp, setTempKomp] = useState('');
  const [tempHub, setTempHub] = useState('Anak');
  const [tempSekolah, setTempSekolah] = useState('');

  const handleAddAnggota = () => {
    if (!tempNama.trim() || !tempNik.trim()) {
      alert('Nama dan NIK anggota keluarga wajib diisi.');
      return;
    }
    setAnggotaList((prev) => [
      ...prev,
      {
        Nama: tempNama,
        NIK: tempNik,
        JenisKelamin: tempJK,
        Komponen: tempKomp,
        HubunganKeluarga: tempHub,
        Sekolah: tempSekolah,
      },
    ]);
    setTempNama('');
    setTempNik('');
    setTempSekolah('');
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        token,
        nik: nikInput,
        password: passwordInput,
        dataKeluarga: {
          Alamat: alamat,
          Lingkungan: lingkungan,
          NoHP: noHP,
          Pernyataan: pernyataan,
        },
        dataAset: {
          StatusRumah: statusRumah,
          Usaha: usaha,
          JenisUsaha: jenisUsaha,
          Latitude: latitude,
          Longitude: longitude,
        },
        dataAnggota: anggotaList,
      };

      const res = await fetch('/api/kpm/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menyimpan data');
      }

      setIsSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal mengirim formulir');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col font-['Inter',sans-serif]">
      {/* Header Banner */}
      <header className="bg-gradient-to-r from-[#005B94] to-[#00838F] text-white py-4 px-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Kemensos"
              width={40}
              height={40}
              className="rounded-xl bg-white p-1 shadow-xs"
            />
            <div>
              <h1 className="font-bold text-base sm:text-lg font-['Outfit']">PORTAL KPM PKH</h1>
              <p className="text-[11px] text-white/80">Kementerian Sosial Republik Indonesia</p>
            </div>
          </div>
          {isLoggedIn && (
            <button
              onClick={() => setIsLoggedIn(false)}
              className="text-xs text-white/80 hover:text-white underline font-medium cursor-pointer"
            >
              Keluar
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
              <h2 className="text-xl font-bold text-gray-900 font-['Outfit']">Masuk ke Formulir KPM</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Silakan masukkan 16 Digit NIK dan Password default Anda untuk mulai melengkapi data keluarga.
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
        ) : isSuccess ? (
          /* SUCCESS SCREEN */
          <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 shadow-xl max-w-lg mx-auto text-center space-y-4 mt-8">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 font-['Outfit']">Data Berhasil Terkirim!</h2>
            <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
              Terima kasih, Bapak/Ibu <strong>{kpmData?.NamaPengurus}</strong>. Data profil keluarga dan kondisi rumah Anda telah berhasil diperbarui dan tersimpan langsung di sistem pendampingan PKH.
            </p>
            <div className="pt-4">
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setIsLoggedIn(false);
                }}
                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Selesai & Keluar
              </button>
            </div>
          </div>
        ) : (
          /* MULTI-TAB FORM */
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden space-y-6">
            {/* Header Profil Singkat */}
            <div className="bg-gradient-to-br from-cyan-50 to-sky-50 border-b border-cyan-100 p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-cyan-800 font-semibold">Selamat Datang,</p>
                <h2 className="text-lg font-bold text-gray-900 font-['Outfit']">{kpmData?.NamaPengurus}</h2>
                <p className="text-[11px] text-gray-500 font-mono">No. KK: {kpmData?.NoKK} | NIK: {kpmData?.NIK}</p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                KPM PKH Aktif
              </span>
            </div>

            {/* Tab Navigation */}
            <div className="px-6 flex border-b border-gray-200 overflow-x-auto gap-2">
              {[
                { id: 'keluarga', label: '1. Data Keluarga', icon: 'home' },
                { id: 'anggota', label: '2. Anggota Keluarga', icon: 'groups' },
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

            {/* Tab Content */}
            <div className="p-6 space-y-4 text-xs text-gray-700">
              {submitError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
                  {submitError}
                </div>
              )}

              {/* TAB 1: DATA KELUARGA */}
              {activeTab === 'keluarga' && (
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-gray-900 border-b pb-2">Alamat & Kontak Keluarga</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block font-semibold mb-1">Nomor HP / WhatsApp Aktif</label>
                      <input
                        type="text"
                        value={noHP}
                        onChange={(e) => setNoHP(e.target.value)}
                        placeholder="Contoh: 08123456789"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Lingkungan / Dusun</label>
                      <input
                        type="text"
                        value={lingkungan}
                        onChange={(e) => setLingkungan(e.target.value)}
                        placeholder="Contoh: Lingkungan II / Dusun Maju"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Alamat Tempat Tinggal Saat Ini</label>
                      <textarea
                        rows={3}
                        value={alamat}
                        onChange={(e) => setAlamat(e.target.value)}
                        placeholder="Alamat lengkap (nama jalan, nomor rumah, RT/RW)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => setActiveTab('anggota')}
                      className="px-5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl font-bold"
                    >
                      Lanjut ke Anggota Keluarga ▶
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: ANGGOTA KELUARGA */}
              {activeTab === 'anggota' && (
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-gray-900 border-b pb-2">
                    Daftar Anggota Keluarga yang Tinggal Bersama
                  </h3>

                  {anggotaList.length > 0 && (
                    <div className="space-y-2">
                      {anggotaList.map((a, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-gray-900">{a.Nama}</p>
                            <p className="text-[11px] text-gray-500 font-mono">NIK: {a.NIK} | {a.HubunganKeluarga}</p>
                            {a.Komponen && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[9px] mt-1 inline-block">
                                {a.Komponen}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setAnggotaList(anggotaList.filter((_, i) => i !== idx))}
                            className="text-rose-600 hover:text-rose-800 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Form Tambah Anggota Baru */}
                  <div className="border border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50/50 space-y-3">
                    <p className="font-bold text-gray-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-base text-emerald-600">person_add</span>
                      Tambah Anggota Keluarga (Anak / Suami / Istri / Lansia):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Nama Lengkap</label>
                        <input
                          type="text"
                          value={tempNama}
                          onChange={(e) => setTempNama(e.target.value)}
                          placeholder="Nama anggota"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">NIK (16 Digit)</label>
                        <input
                          type="text"
                          maxLength={16}
                          value={tempNik}
                          onChange={(e) => setTempNik(e.target.value.replace(/\D/g, ''))}
                          placeholder="NIK anggota keluarga"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Hubungan</label>
                        <select
                          value={tempHub}
                          onChange={(e) => setTempHub(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none"
                        >
                          <option value="">-- Bukan Komponen --</option>
                          {KOMPONEN_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAnggota}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                    >
                      + Tambahkan Anggota Ini
                    </button>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setActiveTab('keluarga')}
                      className="px-4 py-2 border border-gray-300 rounded-xl font-semibold"
                    >
                      ◀ Kembali
                    </button>
                    <button
                      onClick={() => setActiveTab('aset')}
                      className="px-5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl font-bold"
                    >
                      Lanjut ke Data Rumah ▶
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ASET & RUMAH */}
              {activeTab === 'aset' && (
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-gray-900 border-b pb-2">Kondisi Rumah & Usaha</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-1">Status Kepemilikan Rumah</label>
                      <select
                        value={statusRumah}
                        onChange={(e) => setStatusRumah(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none"
                      >
                        {STATUS_RUMAH_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Kepemilikan Usaha</label>
                      <select
                        value={usaha}
                        onChange={(e) => setUsaha(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none"
                      >
                        {USAHA_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    {usaha === 'Memiliki Usaha' && (
                      <div className="sm:col-span-2">
                        <label className="block font-semibold mb-1">Jenis Usaha</label>
                        <input
                          type="text"
                          value={jenisUsaha}
                          onChange={(e) => setJenisUsaha(e.target.value)}
                          placeholder="Contoh: Warung kopi / Jual kue keliling"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block font-semibold">Titik Lokasi Rumah (Koordinat GPS)</label>
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        className="px-3 py-1 bg-amber-100 text-amber-900 rounded-lg font-bold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">my_location</span>
                        Ambil Lokasi Saya
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="Latitude"
                        className="px-3 py-2 border border-gray-300 rounded-lg font-mono"
                      />
                      <input
                        type="text"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="Longitude"
                        className="px-3 py-2 border border-gray-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setActiveTab('anggota')}
                      className="px-4 py-2 border border-gray-300 rounded-xl font-semibold"
                    >
                      ◀ Kembali
                    </button>
                    <button
                      onClick={() => setActiveTab('pernyataan')}
                      className="px-5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl font-bold"
                    >
                      Lanjut ke Pernyataan ▶
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: PERNYATAAN KPM */}
              {activeTab === 'pernyataan' && (
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-gray-900 border-b pb-2">Pernyataan Komitmen KPM</h3>
                  <div className="space-y-2.5">
                    <label
                      className={`flex items-start gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        !pernyataan
                          ? 'bg-amber-50 border-amber-400 text-amber-950 font-medium'
                          : 'bg-white border-gray-200'
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
                        <span className="font-semibold text-gray-900 text-xs">Belum Ada Pernyataan Resmi</span>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Saya belum membuat atau belum memilih surat pernyataan komitmen saat ini.
                        </p>
                      </div>
                    </label>

                    {PERNYATAAN_OPTIONS.map((stmt, idx) => (
                      <label
                        key={idx}
                        className={`flex items-start gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                          pernyataan === stmt
                            ? 'bg-cyan-50 border-cyan-500 text-cyan-950 font-medium'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pernyataan_portal"
                          checked={pernyataan === stmt}
                          onChange={() => setPernyataan(stmt)}
                          className="accent-cyan-600 mt-0.5"
                        />
                        <span className="leading-relaxed">{stmt}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-between pt-6 border-t">
                    <button
                      onClick={() => setActiveTab('aset')}
                      className="px-4 py-2 border border-gray-300 rounded-xl font-semibold"
                    >
                      ◀ Kembali
                    </button>
                    <button
                      onClick={handleFinalSubmit}
                      disabled={isSubmitting}
                      className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Mengirim Formulir...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">send</span>
                          <span>Kirim Data Formulir</span>
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
