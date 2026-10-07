'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { KpmFullData } from '@/lib/kpm-sheets';
import { KpmKeluarga } from '@/lib/kpm-constants';
import { generateKpmFullProfilePdf, formatTanggalIndonesia } from '@/lib/kpm-profil-pdf';

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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!text) return;
    const cleanText = text.replace(/^'+/, '').trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cleanText).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1500);
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

  const temuanList: string[] = useMemo(() => {
    try {
      return JSON.parse(keluarga?.CatatanTemuan || '[]');
    } catch {
      return [];
    }
  }, [keluarga?.CatatanTemuan]);

  if (!isOpen) return null;

  const isGraduasi =
    keluarga?.StatusKepesertaan === 'Graduasi' ||
    keluarga?.StatusKepesertaan === 'Tidak Aktif' ||
    temuanList.includes('Sudah Graduasi');

  const handleDownloadPdf = () => {
    if (!profileData && !keluarga) return;
    setIsGeneratingPdf(true);
    try {
      const fullData: KpmFullData = profileData || {
        keluarga: keluarga || null,
        anggota: anggotaList,
        aset: aset || null,
        graduasi: graduasi || null,
        permasalahan: masalahList,
      };

      const doc = generateKpmFullProfilePdf(fullData, 'Pendamping Sosial PKH');
      const safeName = (keluarga?.NamaPengurus || 'KPM').replace(/[^a-zA-Z0-9]/g, '_');
      const safeNik = (keluarga?.NIK || '').replace(/[^0-9]/g, '');
      doc.save(`Profil_KPM_${safeName}_${safeNik}.pdf`);
    } catch (err) {
      console.error('Gagal membuat PDF profil KPM:', err);
      alert('Terjadi kesalahan saat membuat file PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      {/* Lightbox / Preview Photo */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-3xl overflow-hidden p-2 shadow-2xl">
            <img
              src={`/api/image-proxy?id=${previewPhoto}`}
              alt="Pratinjau Foto"
              className="max-h-[82vh] w-auto mx-auto object-contain rounded-2xl"
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

      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden font-['Inter',sans-serif]">
        
        {/* ============================================================== */}
        {/* TOP HEADER: Title, Quick Info, Download PDF & Close Buttons    */}
        {/* ============================================================== */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white flex items-center justify-between border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-600/30 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-sm shrink-0">
              <span className="material-symbols-outlined text-2xl">badge</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold font-['Outfit'] text-white">
                  {keluarga?.NamaPengurus || 'Memuat Data KPM...'}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    isGraduasi
                      ? 'bg-slate-700 text-slate-300 border-slate-500'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  }`}
                >
                  {isGraduasi ? 'Tidak Aktif (Graduasi)' : 'KPM PKH Aktif'}
                </span>
                {keluarga?.StatusKelompok && (
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded-md text-[10px] font-medium">
                    {keluarga.StatusKelompok}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                NIK: <strong>{keluarga?.NIK || '—'}</strong> • No. KK: <strong>{keluarga?.NoKK || '—'}</strong>
                {keluarga?.Kelompok ? ` • Kelompok: ${keluarga.Kelompok}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tombol Download PDF Profil KPM */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || !keluarga}
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Download dokumen resmi Profil Lengkap KPM dalam format PDF"
            >
              {isGeneratingPdf ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyiapkan PDF...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                  <span>Download PDF Profil KPM</span>
                </>
              )}
            </button>

            {/* Tombol Tutup Modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Tutup Jendela"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* MODAL BODY: 1 UNIFIED SCROLLABLE PAGE (ALL DATA IN 1 PAGE)     */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs text-slate-700 bg-[#F8FAFC]">
          {isLoading || !keluarga ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
              <div className="w-10 h-10 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-bold text-xs">Memuat seluruh informasi lengkap KPM PKH...</p>
            </div>
          ) : (
            <>
              {/* ======================================================== */}
              {/* SEKSI 1: DATA POKOK KELUARGA & WILAYAH                   */}
              {/* ======================================================== */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-700 text-lg">home</span>
                    <h3 className="font-bold text-sm text-slate-900 font-['Outfit']">
                      1. Data Pokok Keluarga & Wilayah Tempat Tinggal
                    </h3>
                  </div>
                  {onEditKeluarga && (
                    <button
                      type="button"
                      onClick={onEditKeluarga}
                      className="px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      <span>Edit Data Pokok</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nama Pengurus</span>
                    <p className="font-bold text-slate-900 text-sm">{keluarga.NamaPengurus}</p>
                    <span className="text-[10px] text-slate-500 block">Peran: {keluarga.StatusKelompok || 'Anggota'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">NIK Pengurus</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900 text-sm">{keluarga.NIK}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(keluarga.NIK, 'nik', e)}
                        className="text-slate-400 hover:text-cyan-700 cursor-pointer"
                        title="Salin NIK"
                      >
                        <span className="material-symbols-outlined text-xs">
                          {copiedKey === 'nik' ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Kartu Keluarga</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900 text-sm">{keluarga.NoKK}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(keluarga.NoKK, 'nokk', e)}
                        className="text-slate-400 hover:text-cyan-700 cursor-pointer"
                        title="Salin No KK"
                      >
                        <span className="material-symbols-outlined text-xs">
                          {copiedKey === 'nokk' ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nomor HP / WhatsApp</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900">{keluarga.NoHP || '—'}</span>
                      {keluarga.NoHP && (
                        <button
                          type="button"
                          onClick={(e) => handleCopy(keluarga.NoHP, 'nohp', e)}
                          className="text-slate-400 hover:text-cyan-700 cursor-pointer"
                          title="Salin No HP"
                        >
                          <span className="material-symbols-outlined text-xs">
                            {copiedKey === 'nohp' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nama Kelompok PKH</span>
                    <p className="font-bold text-cyan-900">{keluarga.Kelompok || '—'}</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tahap Bansos</span>
                    <p className="font-bold text-slate-900">{keluarga.TahapBansos || 'Tahap 1 (2026)'}</p>
                  </div>
                </div>

                {/* Detail Alamat Wilayah */}
                <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex items-center gap-1 font-semibold text-slate-700">
                    <span className="material-symbols-outlined text-base text-cyan-600">location_on</span>
                    <span>Alamat Lengkap Tempat Tinggal:</span>
                  </div>
                  <p className="font-medium text-slate-900 pl-5 leading-relaxed">
                    {keluarga.Alamat || '—'}
                    {keluarga.Lingkungan ? ` • Dusun/Lingkungan: ${keluarga.Lingkungan}` : ''}
                    {keluarga.Kelurahan ? ` • Kel/Desa: ${keluarga.Kelurahan}` : ''}
                    {keluarga.Kecamatan ? ` • Kec: ${keluarga.Kecamatan}` : ''}
                    {keluarga.KabKota ? ` • Kab/Kota: ${keluarga.KabKota}` : ''}
                    {keluarga.Provinsi ? ` • Prov: ${keluarga.Provinsi}` : ''}
                  </p>
                </div>

                {/* Pernyataan Resmi KPM (jika ada) */}
                {keluarga.Pernyataan && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <span className="material-symbols-outlined text-base text-amber-700">verified</span>
                      <span>Surat Pernyataan Komitmen Resmi KPM:</span>
                    </div>
                    <p className="italic text-amber-950 pl-5 text-[11px] leading-relaxed">
                      "{keluarga.Pernyataan}"
                    </p>
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* SEKSI 2: BERKAS FOTO & DOKUMEN KPM                       */}
              {/* ======================================================== */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-700 text-lg">photo_library</span>
                    <h3 className="font-bold text-sm text-slate-900 font-['Outfit']">
                      2. Berkas Foto Dokumen & Kondisi Fisik Rumah
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">Klik foto untuk memperbesar pratinjau</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Foto KTP Pengurus', id: keluarga.FotoKTP },
                    { label: 'Foto Kartu Keluarga', id: keluarga.FotoKK },
                    { label: 'Foto Buku Tabungan', id: keluarga.FotoBukuTabungan },
                    { label: 'Foto Kartu KKS', id: keluarga.FotoKKS },
                    { label: 'Foto Rumah KPM', id: keluarga.FotoRumah || aset?.FotoRumahLuar },
                  ].map(({ label, id }) => (
                    <div
                      key={label}
                      className="border border-slate-200 rounded-xl p-2 bg-slate-50 flex flex-col items-center justify-between text-center relative group"
                    >
                      <span className="text-[10px] font-bold text-slate-600 mb-1.5 truncate w-full">{label}</span>
                      <div
                        onClick={() => id && setPreviewPhoto(id)}
                        className={`w-full h-24 rounded-lg overflow-hidden border flex items-center justify-center relative ${
                          id ? 'cursor-pointer hover:border-cyan-500 bg-white' : 'bg-slate-100 border-dashed text-slate-400'
                        }`}
                      >
                        {id ? (
                          <>
                            <img
                              src={`/api/image-proxy?id=${id}`}
                              alt={label}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <span className="material-symbols-outlined text-lg">zoom_in</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="material-symbols-outlined text-2xl text-slate-300">image_not_supported</span>
                            <span className="text-[9px] text-slate-400">Belum ada foto</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ======================================================== */}
              {/* SEKSI 3: DAFTAR ANGGOTA KELUARGA                         */}
              {/* ======================================================== */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-700 text-lg">groups</span>
                    <h3 className="font-bold text-sm text-slate-900 font-['Outfit']">
                      3. Daftar Anggota Keluarga ({anggotaList.length} Jiwa Terdaftar)
                    </h3>
                  </div>
                  {onManageAnggota && (
                    <button
                      type="button"
                      onClick={onManageAnggota}
                      className="px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">person_add</span>
                      <span>Kelola Anggota</span>
                    </button>
                  )}
                </div>

                {anggotaList.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="py-2.5 px-3 w-10 text-center">No</th>
                          <th className="py-2.5 px-3">Nama Anggota</th>
                          <th className="py-2.5 px-3">NIK</th>
                          <th className="py-2.5 px-3 w-12 text-center">JK</th>
                          <th className="py-2.5 px-3">Hubungan</th>
                          <th className="py-2.5 px-3">Komponen PKH</th>
                          <th className="py-2.5 px-3">Fasilitas (Sekolah / Posyandu)</th>
                          <th className="py-2.5 px-3">Pekerjaan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {anggotaList.map((m, idx) => (
                          <tr key={m.AnggotaId || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{m.Nama}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              <span
                                onClick={(e) => handleCopy(m.NIK, `ang-${idx}`, e)}
                                className="cursor-pointer hover:text-cyan-700"
                                title="Klik untuk salin NIK"
                              >
                                {m.NIK}
                                {copiedKey === `ang-${idx}` && (
                                  <span className="text-[10px] text-emerald-600 font-sans ml-1">✓</span>
                                )}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  m.JenisKelamin?.startsWith('L')
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-pink-100 text-pink-800'
                                }`}
                              >
                                {m.JenisKelamin?.startsWith('L') ? 'L' : 'P'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{m.HubunganKeluarga}</td>
                            <td className="py-2.5 px-3">
                              {m.Komponen ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px] inline-block">
                                  {m.Komponen}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {m.Sekolah ? (
                                <span>🎒 {m.Sekolah} {m.Kelas ? `(Kls ${m.Kelas})` : ''}</span>
                              ) : m.Posyandu ? (
                                <span>🏥 {m.Posyandu}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{m.Pekerjaan || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                    <span className="material-symbols-outlined text-3xl">group_off</span>
                    <p className="mt-1 font-semibold text-xs text-slate-600">Belum ada anggota keluarga terdaftar</p>
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* SEKSI 4: KONDISI RUMAH, USAHA & ASET                     */}
              {/* ======================================================== */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-700 text-lg">roofing</span>
                    <h3 className="font-bold text-sm text-slate-900 font-['Outfit']">
                      4. Kondisi Tempat Tinggal, Usaha & Aset Keluarga
                    </h3>
                  </div>
                  {onManageAset && (
                    <button
                      type="button"
                      onClick={onManageAset}
                      className="px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      <span>Edit Aset</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Kepemilikan Rumah</span>
                    <p className="font-bold text-slate-900">{aset?.StatusRumah || 'Milik Sendiri'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kepemilikan Usaha</span>
                    <p className="font-bold text-slate-900">{aset?.Usaha || 'Tidak Memiliki Usaha'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jenis Usaha</span>
                    <p className="font-bold text-cyan-900">{aset?.JenisUsaha || '—'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tahun Terima Bansos</span>
                    <p className="font-bold text-slate-900">{aset?.TahunMenerimaBansos || '—'}</p>
                  </div>
                </div>

                {/* Foto Rumah Tampak Luar & Dalam */}
                {(aset?.FotoRumahLuar || aset?.FotoRumahDalam || aset?.FotoUsaha) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {aset?.FotoRumahLuar && (
                      <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 text-center">
                        <span className="text-[10px] font-bold text-slate-600 block mb-1">Foto Rumah Tampak Luar</span>
                        <img
                          src={`/api/image-proxy?id=${aset.FotoRumahLuar}`}
                          alt="Rumah Luar"
                          onClick={() => setPreviewPhoto(aset.FotoRumahLuar)}
                          className="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-95"
                        />
                      </div>
                    )}
                    {aset?.FotoRumahDalam && (
                      <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 text-center">
                        <span className="text-[10px] font-bold text-slate-600 block mb-1">Foto Rumah Tampak Dalam</span>
                        <img
                          src={`/api/image-proxy?id=${aset.FotoRumahDalam}`}
                          alt="Rumah Dalam"
                          onClick={() => setPreviewPhoto(aset.FotoRumahDalam)}
                          className="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-95"
                        />
                      </div>
                    )}
                    {aset?.FotoUsaha && (
                      <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 text-center">
                        <span className="text-[10px] font-bold text-slate-600 block mb-1">Foto Tempat Usaha</span>
                        <img
                          src={`/api/image-proxy?id=${aset.FotoUsaha}`}
                          alt="Usaha"
                          onClick={() => setPreviewPhoto(aset.FotoUsaha)}
                          className="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-95"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Titik Koordinat GPS & Keterangan */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Titik Koordinat Lokasi (GPS)</span>
                    <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">
                      Lat: {aset?.Latitude || '—'} • Long: {aset?.Longitude || '—'}
                    </p>
                  </div>
                  {aset?.Latitude && aset?.Longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${aset.Latitude},${aset.Longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors self-start sm:self-auto"
                    >
                      <span className="material-symbols-outlined text-sm">map</span>
                      <span>Buka di Google Maps</span>
                    </a>
                  )}
                </div>

                {aset?.Keterangan && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-700">
                    <span className="font-bold text-slate-800">Keterangan Kondisi Tempat Tinggal: </span>
                    <span>{aset.Keterangan}</span>
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* SEKSI 5: DATA GRADUASI & KEMANDIRIAN (PPSE)              */}
              {/* ======================================================== */}
              {(graduasi || isGraduasi || keluarga?.StatusGraduasi) && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-teal-700 text-lg">school</span>
                      <h3 className="font-bold text-sm text-slate-900 font-['Outfit']">
                        5. Status Graduasi & Pemberdayaan Sosial Ekonomi (PPSE)
                      </h3>
                    </div>
                    {onManageGraduasi && (
                      <button
                        type="button"
                        onClick={onManageGraduasi}
                        className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        <span>Edit Graduasi</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 space-y-1">
                      <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">Status Graduasi</span>
                      <p className="font-bold text-teal-950">{graduasi?.StatusGraduasi || keluarga?.StatusGraduasi || 'Graduasi'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tanggal Graduasi</span>
                      <p className="font-bold text-slate-900">{formatTanggalIndonesia(graduasi?.TanggalGraduasi)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status PPSE</span>
                      <p className="font-bold text-slate-900">{graduasi?.StatusPPSE || 'Belum PPSE'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Penghasilan / Bulan</span>
                      <p className="font-bold text-slate-900">{graduasi?.PenghasilanPerBulan || '—'}</p>
                    </div>
                  </div>

                  {graduasi?.AlasanGraduasi && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-700">
                      <span className="font-bold text-slate-800">Alasan Graduasi: </span>
                      <span>{graduasi.AlasanGraduasi}</span>
                    </div>
                  )}

                  {graduasi?.Catatan && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-700">
                      <span className="font-bold text-slate-800">Catatan Tambahan: </span>
                      <span>{graduasi.Catatan}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* SEKSI 6: CATATAN TEMUAN & PERMASALAHAN LAPANGAN          */}
              {/* ======================================================== */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-700 text-lg">report_problem</span>
                    <h3 className="font-bold text-sm text-slate-900 font-['Outfit']">
                      6. Catatan Temuan & Permasalahan Lapangan
                    </h3>
                  </div>
                  {onManagePermasalahan && (
                    <button
                      type="button"
                      onClick={onManagePermasalahan}
                      className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">add_alert</span>
                      <span>Kelola Catatan</span>
                    </button>
                  )}
                </div>

                {/* Temuan Checklist */}
                {temuanList.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-600">Catatan Temuan KPM:</span>
                    {temuanList.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm text-amber-700">warning</span>
                        <span>{t}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-[11px]">Tidak ada catatan temuan khusus pada profil KPM ini.</p>
                )}

                {/* Foto Bukti Catatan (jika ada) */}
                {keluarga.FotoBuktiCatatan && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                    <img
                      src={`/api/image-proxy?id=${keluarga.FotoBuktiCatatan}`}
                      alt="Foto Bukti"
                      onClick={() => setPreviewPhoto(keluarga.FotoBuktiCatatan!)}
                      className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-90 border border-amber-300 shrink-0"
                    />
                    <div>
                      <span className="font-bold text-amber-950 block text-xs">Foto Bukti Dukung Temuan Lapangan</span>
                      <p className="text-[10px] text-amber-800">Klik gambar untuk melihat bukti dalam ukuran penuh</p>
                    </div>
                  </div>
                )}

                {/* Tabel Kasus / Permasalahan Spesifik */}
                {masalahList.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="font-bold text-slate-800 text-xs block">Daftar Laporan Kasus / Permasalahan:</span>
                    <div className="space-y-2">
                      {masalahList.map((m) => (
                        <div
                          key={m.MasalahId}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">{m.JenisMasalah}</span>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                                {m.Prioritas || 'Sedang'}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-[10px]">
                                {m.Status}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-700 leading-relaxed">{m.Deskripsi}</p>
                          {m.TindakLanjut && (
                            <p className="text-[11px] text-cyan-800 font-semibold pt-1 border-t border-slate-200">
                              Tindak Lanjut: {m.TindakLanjut}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ============================================================== */}
        {/* FOOTER: Quick Dismiss & Bottom PDF Trigger                     */}
        {/* ============================================================== */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Sistem Informasi Pendampingan Sosial ASPEND Web PKH</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || !keluarga}
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
              <span>Download PDF Profil KPM</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl font-semibold hover:bg-slate-100 transition-colors cursor-pointer text-slate-700"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
