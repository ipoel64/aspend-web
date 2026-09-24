'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { KpmFullData } from '@/lib/kpm-sheets';
import { formatIndonesianPhone, KpmKeluarga } from '@/lib/kpm-constants';

interface KpmFullProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpmId?: string;
  noKK?: string;
  nik?: string;
  initialKeluarga?: KpmKeluarga | null;
  onEditKeluarga?: () => void;
  onManageAnggota?: () => void;
  onManageAset?: () => void;
  onManageGraduasi?: () => void;
  onManagePermasalahan?: () => void;
}

export default function KpmFullProfileModal({
  isOpen,
  onClose,
  kpmId,
  noKK,
  nik,
  initialKeluarga,
  onEditKeluarga,
  onManageAnggota,
  onManageAset,
  onManageGraduasi,
  onManagePermasalahan,
}: KpmFullProfileModalProps) {
  const [profileData, setProfileData] = useState<KpmFullData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pokok' | 'anggota' | 'aset' | 'graduasi' | 'masalah'>('pokok');

  // Copy to clipboard
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!text) return;
    const cleanText = text.replace(/^'+/, '').trim();
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = cleanText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cleanText).catch(() => fallback());
    } else {
      fallback();
    }

    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  useEffect(() => {
    if (!isOpen) {
      setProfileData(null);
      return;
    }

    const effectiveKpmId = kpmId || initialKeluarga?.KpmId || '';
    const effectiveNoKK = noKK || initialKeluarga?.NoKK || '';
    const effectiveNik = nik || initialKeluarga?.NIK || '';

    if (!effectiveKpmId && !effectiveNoKK && !effectiveNik) return;

    setIsLoading(true);
    const searchParams = new URLSearchParams();
    if (effectiveKpmId) searchParams.set('kpmId', effectiveKpmId);
    if (effectiveNoKK) searchParams.set('noKK', effectiveNoKK);
    if (effectiveNik) searchParams.set('nik', effectiveNik);

    fetch(`/api/kpm/profil-lengkap?${searchParams.toString()}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.data) setProfileData(res.data);
      })
      .catch((err) => console.error('Error fetching full profile:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen, kpmId, noKK, nik, initialKeluarga]);

  const keluarga = profileData?.keluarga || initialKeluarga;
  const anggotaList = profileData?.anggota || [];
  const aset = profileData?.aset;
  const graduasi = profileData?.graduasi;
  const masalahList = profileData?.permasalahan || [];

  // Parse catatan temuan
  const temuanList: string[] = useMemo(() => {
    try {
      return JSON.parse(keluarga?.CatatanTemuan || '[]');
    } catch {
      return [];
    }
  }, [keluarga?.CatatanTemuan]);

  if (!isOpen) return null;

  // Selected representative photo for avatar
  const mainPhoto =
    keluarga?.FotoKTP ||
    keluarga?.FotoRumah ||
    aset?.FotoRumahLuar ||
    aset?.FotoRumahDalam ||
    '';

  const housePhoto =
    keluarga?.FotoRumah ||
    aset?.FotoRumahLuar ||
    aset?.FotoRumahDalam ||
    '';

  const isGraduasi =
    keluarga?.StatusKepesertaan === 'Graduasi' ||
    keluarga?.StatusKepesertaan === 'Tidak Aktif' ||
    temuanList.includes('Sudah Graduasi');

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date()).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:rounded-none">
        
        {/* ============================================================== */}
        {/* 1. WEB MODAL INTERACTIVE VIEW (Hidden in Print)                */}
        {/*    Styled in modern "Sekolah Rakyat" cards layout              */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 print:hidden">
          
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Peserta Dampingan</span>
              <span>/</span>
              <span className="font-bold text-slate-800">
                Detail Profil KPM - {keluarga?.NamaPengurus || 'Memuat...'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {isLoading || !keluarga ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-gray-500">
              <div className="w-9 h-9 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-bold text-xs">Memuat data lengkap KPM Sekolah Rakyat...</p>
            </div>
          ) : (
            <>
              {/* HERO CARD (Mirip Tampilan Situs Sekolah Rakyat - Screenshot 1) */}
              <div className="bg-gradient-to-br from-slate-50 via-sky-50/40 to-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
                {/* Top subtitle & Status Badges */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={onClose}
                      className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer shadow-xs transition-colors shrink-0"
                      title="Kembali"
                    >
                      <span className="material-symbols-outlined text-base">arrow_back</span>
                    </button>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        DETAIL PROFIL KELUARGA PENERIMA MANFAAT (KPM) PKH
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-['Outfit'] tracking-tight">
                        {keluarga.NamaPengurus}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-black border flex items-center gap-1 ${
                        keluarga.StatusData === 'Lengkap'
                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm text-amber-600">verified</span>
                      <span>DATA LENGKAP</span>
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-mono font-bold border border-slate-200 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                      <span>{todayFormatted}</span>
                    </span>
                  </div>
                </div>

                {/* Main Body: Photo Card + 4 Key Value Cards + Action Buttons */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  
                  {/* Left: Large Portrait Photo (Sekolah Rakyat Style) */}
                  <div className="lg:col-span-3 flex flex-col">
                    <div
                      onClick={() => mainPhoto && setPreviewPhoto(mainPhoto)}
                      className="w-full h-56 sm:h-64 rounded-2xl overflow-hidden bg-slate-200 border-2 border-white shadow-md relative group cursor-pointer"
                      title="Klik untuk memperbesar foto"
                    >
                      {mainPhoto ? (
                        <img
                          src={`/api/image-proxy?id=${mainPhoto}`}
                          alt={keluarga.NamaPengurus}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 bg-gradient-to-b from-slate-100 to-slate-200">
                          <span className="material-symbols-outlined text-5xl">person</span>
                          <span className="text-[11px] font-bold">Belum Ada Foto</span>
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 text-white flex items-center justify-between text-[11px]">
                        <span className="font-semibold truncate">
                          {keluarga.FotoKTP ? 'Foto Pengurus / KTP' : 'Foto Rumah'}
                        </span>
                        <span className="material-symbols-outlined text-sm">zoom_in</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: 4 Key Value Cards (Grid 2x2) */}
                  <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* Card 1: NIK */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <span className="material-symbols-outlined text-xl">badge</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          NIK Pengurus
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-slate-900 text-sm truncate">
                            {keluarga.NIK}
                          </span>
                          {keluarga.NIK && (
                            <button
                              type="button"
                              onClick={(e) => handleCopy(keluarga.NIK, 'sr-nik', e)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-cyan-700 cursor-pointer"
                              title="Salin NIK"
                            >
                              <span className="material-symbols-outlined text-xs">
                                {copiedKey === 'sr-nik' ? 'check' : 'content_copy'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card 2: No. KK */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <span className="material-symbols-outlined text-xl">family_restroom</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          No. Kartu Keluarga
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-slate-900 text-sm truncate">
                            {keluarga.NoKK}
                          </span>
                          {keluarga.NoKK && (
                            <button
                              type="button"
                              onClick={(e) => handleCopy(keluarga.NoKK, 'sr-kk', e)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-cyan-700 cursor-pointer"
                              title="Salin No. KK"
                            >
                              <span className="material-symbols-outlined text-xs">
                                {copiedKey === 'sr-kk' ? 'check' : 'content_copy'}
                              </span>
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {anggotaList.length} Jiwa Terdaftar
                        </span>
                      </div>
                    </div>

                    {/* Card 3: Status Kepesertaan / Desil */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Status Kepesertaan
                        </span>
                        <p className="font-bold text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isGraduasi ? 'bg-slate-400' : 'bg-emerald-500'
                            }`}
                          />
                          <span>{isGraduasi ? 'Tidak Aktif (Graduasi)' : 'Peserta Aktif PKH'}</span>
                        </p>
                        <span className="text-[10px] text-slate-500 block truncate">
                          Peran: <strong>{keluarga.StatusKelompok || 'Anggota'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Card 4: Tahap Penyaluran & Kelompok */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <span className="material-symbols-outlined text-xl">event_repeat</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Tahap Penyaluran Bansos
                        </span>
                        <p className="font-bold text-cyan-800 text-sm mt-0.5 truncate">
                          {keluarga.TahapBansos || 'Tahap 1 (2026)'}
                        </p>
                        <span className="text-[10px] text-slate-500 block truncate">
                          Kelompok: <strong>{keluarga.Kelompok || '—'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Vertical Action Buttons (Sekolah Rakyat Style) */}
                  <div className="lg:col-span-3 flex flex-col justify-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleCopy(window.location.href, 'link-profil', e)}
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 hover:border-cyan-500 hover:text-cyan-800 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base text-cyan-600">share</span>
                      <span>{copiedKey === 'link-profil' ? 'Tautan Disalin!' : 'Salin Link'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 hover:border-purple-400 text-purple-900 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                      title="Cetak format resmi Sekolah Rakyat Kemensos"
                    >
                      <span className="material-symbols-outlined text-base text-purple-600">picture_as_pdf</span>
                      <span>Profil Calon Siswa / PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-2.5 px-3 bg-rose-50/80 border border-rose-200 hover:bg-rose-100 text-rose-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base text-rose-600">undo</span>
                      <span>Kembali</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-Tabs for Detailed Sections */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                {[
                  { id: 'pokok', label: 'Data Pokok Keluarga', icon: 'person' },
                  { id: 'anggota', label: `Anggota Keluarga (${anggotaList.length})`, icon: 'groups' },
                  { id: 'aset', label: 'Aset & Foto Rumah', icon: 'home' },
                  { id: 'graduasi', label: 'Graduasi & PPSE', icon: 'school' },
                  { id: 'masalah', label: `Catatan & Temuan (${masalahList.length + temuanList.length})`, icon: 'report_problem' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeTab === t.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab 1: Data Pokok */}
              {activeTab === 'pokok' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <h5 className="font-bold text-slate-800 flex items-center gap-1.5 border-b pb-1.5">
                      <span className="material-symbols-outlined text-base text-cyan-600">location_on</span>
                      Data Wilayah & Tempat Tinggal
                    </h5>
                    <div className="grid grid-cols-2 gap-y-1.5 pt-1 text-slate-600">
                      <span className="font-medium">Alamat:</span>
                      <span className="font-bold text-slate-900">{keluarga.Alamat || '—'}</span>
                      <span className="font-medium">Lingkungan/Dusun:</span>
                      <span className="font-bold text-slate-900">{keluarga.Lingkungan || '—'}</span>
                      <span className="font-medium">Kelurahan/Desa:</span>
                      <span className="font-bold text-slate-900">{keluarga.Kelurahan || '—'}</span>
                      <span className="font-medium">Kecamatan:</span>
                      <span className="font-bold text-slate-900">{keluarga.Kecamatan || '—'}</span>
                      <span className="font-medium">Kabupaten/Kota:</span>
                      <span className="font-bold text-slate-900">{keluarga.KabKota || '—'}</span>
                      <span className="font-medium">Provinsi:</span>
                      <span className="font-bold text-slate-900">{keluarga.Provinsi || '—'}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <h5 className="font-bold text-slate-800 flex items-center gap-1.5 border-b pb-1.5">
                      <span className="material-symbols-outlined text-base text-cyan-600">contact_phone</span>
                      Kontak & Kepesertaan Kelompok
                    </h5>
                    <div className="grid grid-cols-2 gap-y-1.5 pt-1 text-slate-600">
                      <span className="font-medium">No. Telepon / WA:</span>
                      <span className="font-mono font-bold text-slate-900">{keluarga.NoHP || '—'}</span>
                      <span className="font-medium">Nama Kelompok:</span>
                      <span className="font-bold text-slate-900">{keluarga.Kelompok || '—'}</span>
                      <span className="font-medium">Status Kelompok:</span>
                      <span className="font-bold text-slate-900">{keluarga.StatusKelompok || 'Anggota'}</span>
                      <span className="font-medium">Status Kepesertaan:</span>
                      <span className="font-bold text-slate-900">{keluarga.StatusKepesertaan || 'Aktif'}</span>
                      <span className="font-medium">Tahap Bansos:</span>
                      <span className="font-bold text-cyan-800">{keluarga.TahapBansos || 'Tahap 1 (2026)'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Anggota Keluarga */}
              {activeTab === 'anggota' && (
                <div className="space-y-3">
                  {anggotaList.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border">
                      <span className="material-symbols-outlined text-4xl">group_off</span>
                      <p className="mt-1 text-xs font-bold text-slate-600">Belum ada data anggota keluarga</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {anggotaList.map((ang, i) => (
                        <div
                          key={ang.AnggotaId || i}
                          className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-1.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {ang.Nama}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                              {ang.HubunganKeluarga}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-500">NIK: {ang.NIK}</p>
                          <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
                            <p>Komponen: <strong>{ang.Komponen || '—'}</strong></p>
                            <p>JK / Tgl Lahir: {ang.JenisKelamin || '—'} • {ang.TanggalLahir || '—'}</p>
                            {ang.Sekolah && <p>Sekolah: {ang.Sekolah} ({ang.Kelas})</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Aset & Foto Rumah */}
              {activeTab === 'aset' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-4 rounded-2xl border text-center">
                      <span className="text-[11px] text-slate-400 uppercase font-bold">Status Kepemilikan</span>
                      <p className="text-sm font-bold text-slate-900 mt-1">{aset?.StatusRumah || 'Milik Sendiri'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border text-center">
                      <span className="text-[11px] text-slate-400 uppercase font-bold">Kegiatan Usaha</span>
                      <p className="text-sm font-bold text-slate-900 mt-1">{aset?.Usaha || 'Tidak Memiliki Usaha'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border text-center">
                      <span className="text-[11px] text-slate-400 uppercase font-bold">Tahun Terima Bansos</span>
                      <p className="text-sm font-bold text-slate-900 mt-1">{aset?.TahunMenerimaBansos || '2020'}</p>
                    </div>
                  </div>

                  {/* Galeri Foto Rumah */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-2">
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-cyan-600">home</span>
                        Foto Rumah Tampak Luar
                      </span>
                      <div
                        onClick={() => housePhoto && setPreviewPhoto(housePhoto)}
                        className="w-full h-44 rounded-xl overflow-hidden bg-slate-100 border cursor-pointer relative group flex items-center justify-center"
                      >
                        {housePhoto ? (
                          <img
                            src={`/api/image-proxy?id=${housePhoto}`}
                            alt="Rumah Tampak Luar"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">Belum ada foto rumah luar</span>
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-2">
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-cyan-600">chair</span>
                        Foto Rumah Tampak Dalam
                      </span>
                      <div
                        onClick={() => aset?.FotoRumahDalam && setPreviewPhoto(aset.FotoRumahDalam)}
                        className="w-full h-44 rounded-xl overflow-hidden bg-slate-100 border cursor-pointer relative group flex items-center justify-center"
                      >
                        {aset?.FotoRumahDalam ? (
                          <img
                            src={`/api/image-proxy?id=${aset.FotoRumahDalam}`}
                            alt="Rumah Tampak Dalam"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">Belum ada foto rumah dalam</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Graduasi & PPSE */}
              {activeTab === 'graduasi' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-600">school</span>
                    Catatan Status Graduasi & PPSE
                  </h5>
                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <span className="text-slate-500 font-medium">Status Graduasi:</span>
                    <span className="font-bold text-slate-900">{graduasi?.StatusGraduasi || (isGraduasi ? 'Sudah Graduasi' : 'Belum Graduasi')}</span>
                    <span className="text-slate-500 font-medium">Status PPSE:</span>
                    <span className="font-bold text-slate-900">{graduasi?.StatusPPSE || 'Belum PPSE'}</span>
                    <span className="text-slate-500 font-medium">Alasan Graduasi:</span>
                    <span className="font-bold text-slate-900">{graduasi?.AlasanGraduasi || '—'}</span>
                    <span className="text-slate-500 font-medium">Penghasilan / Bulan:</span>
                    <span className="font-bold text-slate-900">{graduasi?.PenghasilanPerBulan || '—'}</span>
                  </div>
                </div>
              )}

              {/* Tab 5: Catatan Permasalahan & Temuan */}
              {activeTab === 'masalah' && (
                <div className="space-y-3">
                  {/* Foto Bukti Dukung (User Item 10) */}
                  {keluarga.FotoBuktiCatatan && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                      <div
                        onClick={() => setPreviewPhoto(keluarga.FotoBuktiCatatan!)}
                        className="w-16 h-16 rounded-xl overflow-hidden bg-amber-200 shrink-0 cursor-pointer border border-amber-300"
                        title="Klik perbesar foto bukti"
                      >
                        <img
                          src={`/api/image-proxy?id=${keluarga.FotoBuktiCatatan}`}
                          alt="Bukti Temuan"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <span className="font-bold text-amber-950 text-xs block">Foto Bukti Temuan / Dukung Terlampir</span>
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto(keluarga.FotoBuktiCatatan!)}
                          className="text-[11px] font-bold text-cyan-800 hover:underline cursor-pointer flex items-center gap-1 mt-0.5"
                        >
                          <span className="material-symbols-outlined text-xs">zoom_in</span>
                          Lihat Foto Bukti
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List of problems */}
                  {masalahList.length === 0 && temuanList.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 bg-slate-50 rounded-2xl border">
                      <span className="material-symbols-outlined text-3xl">check_circle</span>
                      <p className="mt-1 text-xs font-bold text-slate-600">Tidak ada permasalahan tercatat</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {temuanList.map((t, idx) => (
                        <div key={idx} className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 font-bold flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-rose-600">warning</span>
                          <span>Catatan Temuan Lapangan: {t}</span>
                        </div>
                      ))}
                      {masalahList.map((m) => (
                        <div key={m.MasalahId} className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{m.JenisMasalah}</span>
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">{m.Status}</span>
                          </div>
                          <p className="text-slate-600">{m.Deskripsi}</p>
                          {m.TindakLanjut && <p className="text-cyan-800 font-medium">Tindak Lanjut: {m.TindakLanjut}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ============================================================== */}
        {/* 2. DEDICATED PRINT / PDF EXPORT LAYOUT                         */}
        {/*    Styled EXACTLY as in Screenshot 2 (media_1790129549859.jpg) */}
        {/* ============================================================== */}
        {keluarga && (
          <div className="hidden print:block font-sans text-black bg-white p-8 max-w-[210mm] mx-auto text-[10pt] leading-tight">
            
            {/* Top Header Logos & Titles */}
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
              <div className="flex items-center gap-3">
                {/* Garuda / Kemensos Logo representation */}
                <div className="w-12 h-12 flex items-center justify-center font-bold border border-slate-300 rounded-lg text-xs bg-slate-50">
                  <span className="material-symbols-outlined text-3xl text-emerald-800">security</span>
                </div>
                <div>
                  <h4 className="font-bold text-[11pt] tracking-wider uppercase">
                    PROFIL KELUARGA PENERIMA MANFAAT (KPM)
                  </h4>
                  <h3 className="font-black text-[12pt] tracking-wide uppercase">
                    KEMENTERIAN SOSIAL REPUBLIK INDONESIA
                  </h3>
                </div>
              </div>

              <div className="text-right">
                <span className="font-black text-rose-600 tracking-wider text-[11pt]">#KEMENSOS</span>
                <span className="font-black text-slate-900 tracking-wider text-[11pt]"> SELALU ADA</span>
              </div>
            </div>

            {/* Gold Banner */}
            <div className="bg-[#D4A017] text-white px-3 py-1 font-bold text-[9pt] flex items-center justify-between mb-3 rounded-xs">
              <span>Program Keluarga Harapan : {keluarga.Kecamatan || 'Kecamatan'}, {keluarga.Kelurahan || 'Kelurahan'}</span>
              <span>TA. 2026/2027</span>
            </div>

            {/* 3-Column Top Section: Photo KPM | Center Table | Photo Rumah Tampak Luar */}
            <div className="grid grid-cols-12 gap-3 mb-3">
              
              {/* Left Photo (Foto Calon Siswa / Pengurus) */}
              <div className="col-span-3 flex flex-col border border-black">
                <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden min-h-[170px]">
                  {mainPhoto ? (
                    <img
                      src={`/api/image-proxy?id=${mainPhoto}`}
                      alt="Foto Pengurus"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[9pt] text-slate-500">Foto Pengurus</span>
                  )}
                </div>
                <div className="bg-[#D4A017] text-white text-center py-0.5 text-[8pt] font-bold">
                  Foto Pengurus KPM
                </div>
              </div>

              {/* Center Table: Biodata Detail */}
              <div className="col-span-6 border border-black p-2 text-[8.5pt]">
                <table className="w-full">
                  <tbody>
                    <tr>
                      <td className="w-32 font-bold py-0.5">Nama</td>
                      <td className="w-2">:</td>
                      <td className="font-bold uppercase">{keluarga.NamaPengurus}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">NIK</td>
                      <td>:</td>
                      <td className="font-mono">{keluarga.NIK}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">No. KK</td>
                      <td>:</td>
                      <td className="font-mono">{keluarga.NoKK}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Tempat, Tanggal Lahir</td>
                      <td>:</td>
                      <td>{anggotaList[0]?.TanggalLahir || '—'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Jenis Kelamin</td>
                      <td>:</td>
                      <td>Perempuan</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Kelompok PKH</td>
                      <td>:</td>
                      <td>{keluarga.Kelompok || '—'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Status Kelompok</td>
                      <td>:</td>
                      <td>{keluarga.StatusKelompok || 'Anggota'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Bansos PKH</td>
                      <td>:</td>
                      <td className="font-bold">{keluarga.TahapBansos || 'Tahap 1 (2026)'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Status Kepesertaan</td>
                      <td>:</td>
                      <td className="font-bold">{isGraduasi ? 'TIDAK AKTIF (GRADUASI)' : 'AKTIF'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right Photo: Foto Rumah Tampak Luar */}
              <div className="col-span-3 flex flex-col border border-black">
                <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden min-h-[170px]">
                  {housePhoto ? (
                    <img
                      src={`/api/image-proxy?id=${housePhoto}`}
                      alt="Rumah Tampak Luar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[9pt] text-slate-500">Foto Rumah Luar</span>
                  )}
                </div>
                <div className="bg-[#D4A017] text-white text-center py-0.5 text-[8pt] font-bold">
                  Foto Rumah Tampak Luar
                </div>
              </div>
            </div>

            {/* Bottom Section: 2 Columns of Tables + Bottom Right Photo */}
            <div className="grid grid-cols-12 gap-3 mb-3">
              
              {/* Sub-table Left: Petugas & Wilayah */}
              <div className="col-span-5 border border-black p-2 text-[8pt]">
                <table className="w-full">
                  <tbody>
                    <tr>
                      <td className="w-24 font-bold py-0.5">Nama Petugas</td>
                      <td className="w-2">:</td>
                      <td className="font-bold">SYAIFUL KHOLIFAH</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">No Hp Petugas</td>
                      <td>:</td>
                      <td>+6285370632461</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Provinsi</td>
                      <td>:</td>
                      <td>{keluarga.Provinsi || 'SUMATERA UTARA'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Kab/Kota</td>
                      <td>:</td>
                      <td>{keluarga.KabKota || 'KOTA BINJAI'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Kecamatan</td>
                      <td>:</td>
                      <td>{keluarga.Kecamatan || 'BINJAI KOTA'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Desa/Kel</td>
                      <td>:</td>
                      <td>{keluarga.Kelurahan || 'KARTINI'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Alamat</td>
                      <td>:</td>
                      <td>{keluarga.Alamat || '—'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Status Rumah</td>
                      <td>:</td>
                      <td>{aset?.StatusRumah || 'Milik Sendiri'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sub-table Middle: Ekonomi & Tanggungan */}
              <div className="col-span-4 border border-black p-2 text-[8pt]">
                <table className="w-full">
                  <tbody>
                    <tr>
                      <td className="w-28 font-bold py-0.5">Tanggungan</td>
                      <td className="w-2">:</td>
                      <td>{anggotaList.length} Jiwa</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Penerangan</td>
                      <td>:</td>
                      <td>Listrik PLN dengan meteran</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Daya Listrik</td>
                      <td>:</td>
                      <td>450 / 900 watt</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Penghasilan/Bln</td>
                      <td>:</td>
                      <td>&lt; 1 juta per bulan</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Pengeluaran/Bln</td>
                      <td>:</td>
                      <td>800.000 - 1.000.000</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Kegiatan Usaha</td>
                      <td>:</td>
                      <td>{aset?.Usaha || 'Tidak Memiliki Usaha'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Jenis Usaha</td>
                      <td>:</td>
                      <td>{aset?.JenisUsaha || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bottom Right Photo: Foto Orang Tua / Rumah Dalam */}
              <div className="col-span-3 flex flex-col border border-black">
                <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden min-h-[140px]">
                  {aset?.FotoRumahDalam ? (
                    <img
                      src={`/api/image-proxy?id=${aset.FotoRumahDalam}`}
                      alt="Rumah Dalam"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[8pt] text-slate-500">Foto Rumah Dalam</span>
                  )}
                </div>
                <div className="bg-[#D4A017] text-white text-center py-0.5 text-[8pt] font-bold">
                  Foto Rumah Tampak Dalam
                </div>
              </div>
            </div>

            {/* Catatan Petugas / Catatan Temuan Banner */}
            <div className="border border-black p-2.5 mb-3 text-[8.5pt]">
              <span className="font-bold">Catatan Petugas Pendamping : </span>
              <span>
                {temuanList.length > 0
                  ? `Catatan temuan: ${temuanList.join(', ')}. `
                  : 'Kondisi ekonomi keluarga tergolong prasejahtera dan memenuhi syarat kepesertaan PKH. '}
                {keluarga.Pernyataan ? `Pernyataan resmi terlampir pada dokumen verifikasi fisik.` : ''}
              </span>
            </div>

            {/* Gold Bottom Footer Banner */}
            <div className="bg-[#D4A017] text-white text-center py-1 text-[8pt] italic font-semibold rounded-xs">
              Formulir ini merupakan bagian dari program bantuan sosial Program Keluarga Harapan (PKH) oleh Kementerian Sosial Republik Indonesia.
            </div>
          </div>
        )}

      </div>

      {/* Modal Zoom Preview Foto */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-cyan-400">image</span>
                Pratinjau Foto Dokumen
              </span>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[75vh]">
              <img
                src={`/api/image-proxy?id=${previewPhoto}`}
                alt="Pratinjau"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
