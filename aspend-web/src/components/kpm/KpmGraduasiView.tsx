'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  KpmGraduasi,
  KpmKeluarga,
  STATUS_GRADUASI_OPTIONS,
  ALASAN_GRADUASI_OPTIONS,
  STATUS_PPSE_OPTIONS,
} from '@/lib/kpm-constants';
import KpmGraduasiModal from './KpmGraduasiModal';
import KpmFullProfileModal from './KpmFullProfileModal';

interface KpmGraduasiViewProps {
  onNavigateHome?: () => void;
  onNavigateToKpmData?: () => void;
}

export default function KpmGraduasiView({
  onNavigateHome,
  onNavigateToKpmData,
}: KpmGraduasiViewProps) {
  const [graduasiList, setGraduasiList] = useState<KpmGraduasi[]>([]);
  const [kpmList, setKpmList] = useState<KpmKeluarga[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 2 Layar/Tab: 'calon' (Calon Graduasi / Mampu & Calon PPSE) | 'berhasil' (Sudah Berhasil Graduasi / PPSE)
  const [activeTab, setActiveTab] = useState<'calon' | 'berhasil'>('calon');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlasan, setSelectedAlasan] = useState('');
  const [selectedStatusPPSE, setSelectedStatusPPSE] = useState('');
  const [selectedKelompok, setSelectedKelompok] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGraduasi, setSelectedGraduasi] = useState<KpmGraduasi | null>(null);
  const [targetNoKK, setTargetNoKK] = useState<string>('');
  const [activeKpmProfile, setActiveKpmProfile] = useState<KpmKeluarga | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resGrad, resKpm] = await Promise.all([
        fetch('/api/kpm/graduasi').then((r) => r.json()),
        fetch('/api/kpm').then((r) => r.json()),
      ]);
      if (resGrad.data) setGraduasiList(resGrad.data);
      if (resKpm.data) setKpmList(resKpm.data);
    } catch (err) {
      console.error('Error fetching data graduasi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map NoKK -> KpmKeluarga
  const kpmMap = useMemo(() => {
    const map = new Map<string, KpmKeluarga>();
    for (const k of kpmList) {
      if (k.NoKK) map.set(k.NoKK.trim(), k);
    }
    return map;
  }, [kpmList]);

  // Map NoKK -> KpmGraduasi
  const graduasiMap = useMemo(() => {
    const map = new Map<string, KpmGraduasi>();
    for (const g of graduasiList) {
      if (g.NoKK) map.set(g.NoKK.trim(), g);
    }
    return map;
  }, [graduasiList]);

  // Kelompok options
  const kelompokOptions = useMemo(() => {
    const set = new Set<string>();
    for (const k of kpmList) {
      if (k.Kelompok?.trim()) set.add(k.Kelompok.trim());
    }
    return Array.from(set);
  }, [kpmList]);

  // Klasifikasi Calon vs Berhasil
  // 1. Berhasil: KpmGraduasi dengan status 'Sudah Graduasi' | 'Graduasi Mandiri' | 'Graduasi Alami', atau StatusPPSE === 'Sudah PPSE', atau StatusKepesertaan === 'Graduasi'
  // 2. Calon: KpmGraduasi dengan 'Proses Graduasi' / 'Calon PPSE' ATAU KPM dengan CatatanTemuan yang mengindikasikan mampu/calon (misal 'Sudah Mampu', 'Calon PPSE', 'Memiliki Kendaraan Mewah') namun belum resmi berstatus graduasi penuh.
  const categorizedData = useMemo(() => {
    const berhasilItems: Array<{ kpm?: KpmKeluarga; graduasi?: KpmGraduasi; noKK: string }> = [];
    const calonItems: Array<{ kpm?: KpmKeluarga; graduasi?: KpmGraduasi; noKK: string; reasonNote: string }> = [];

    const processedKK = new Set<string>();

    // Cek dari data Graduasi
    for (const g of graduasiList) {
      const kk = (g.NoKK || '').trim();
      if (!kk) continue;
      processedKK.add(kk);

      const k = kpmMap.get(kk);
      const isBerhasilGrad =
        g.StatusGraduasi === 'Sudah Graduasi' ||
        g.StatusGraduasi === 'Graduasi Mandiri' ||
        g.StatusGraduasi === 'Graduasi Alami' ||
        g.StatusPPSE === 'Sudah PPSE' ||
        k?.StatusKepesertaan === 'Graduasi';

      if (isBerhasilGrad) {
        berhasilItems.push({ kpm: k, graduasi: g, noKK: kk });
      } else {
        calonItems.push({
          kpm: k,
          graduasi: g,
          noKK: kk,
          reasonNote: g.Catatan || g.AlasanGraduasi || (g.StatusPPSE === 'Calon PPSE' ? 'Calon PPSE' : 'Dalam Proses Graduasi'),
        });
      }
    }

    // Cek juga dari KPM yang memiliki catatan temuan potensi graduasi / PPSE tapi belum dibuatkan baris KPM_Graduasi
    for (const k of kpmList) {
      const kk = (k.NoKK || '').trim();
      if (!kk || processedKK.has(kk)) continue;

      let temuan: string[] = [];
      try {
        temuan = JSON.parse(k.CatatanTemuan || '[]');
      } catch {
        temuan = [];
      }

      const isMampu = temuan.includes('Sudah Mampu');
      const isCalonPPSE = temuan.includes('Calon PPSE');
      const isMewah = temuan.includes('Memiliki Kendaraan Mewah');
      const isSudahGrad = temuan.includes('Sudah Graduasi') || k.StatusKepesertaan === 'Graduasi';
      const isSudahPPSE = temuan.includes('Sudah PPSE');

      if (isSudahGrad || isSudahPPSE) {
        berhasilItems.push({ kpm: k, graduasi: undefined, noKK: kk });
      } else if (isMampu || isCalonPPSE || isMewah) {
        const reasons: string[] = [];
        if (isMampu) reasons.push('Ekonomi Sudah Mampu');
        if (isCalonPPSE) reasons.push('Calon PPSE (Pemberdayaan)');
        if (isMewah) reasons.push('Memiliki Kendaraan Mewah');

        calonItems.push({
          kpm: k,
          graduasi: undefined,
          noKK: kk,
          reasonNote: reasons.join(' • '),
        });
      }
    }

    return { berhasilItems, calonItems };
  }, [graduasiList, kpmList, kpmMap]);

  // Filtered Items for currently active tab
  const filteredItems = useMemo(() => {
    const source = activeTab === 'calon' ? categorizedData.calonItems : categorizedData.berhasilItems;

    return source.filter((item) => {
      const kpm = item.kpm;
      const grad = item.graduasi;

      if (selectedKelompok && kpm?.Kelompok !== selectedKelompok) return false;
      if (selectedAlasan && grad?.AlasanGraduasi !== selectedAlasan) return false;
      if (selectedStatusPPSE && grad?.StatusPPSE !== selectedStatusPPSE) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nama = (kpm?.NamaPengurus || '').toLowerCase();
        const kk = item.noKK.toLowerCase();
        const nik = (kpm?.NIK || '').toLowerCase();
        const alasan = (grad?.AlasanGraduasi || '').toLowerCase();
        const catatan = (grad?.Catatan || '').toLowerCase();

        return nama.includes(q) || kk.includes(q) || nik.includes(q) || alasan.includes(q) || catatan.includes(q);
      }

      return true;
    });
  }, [categorizedData, activeTab, selectedKelompok, selectedAlasan, selectedStatusPPSE, searchQuery]);

  const handleOpenGraduasiModal = (noKK: string, existingGrad?: KpmGraduasi) => {
    setTargetNoKK(noKK);
    setSelectedGraduasi(existingGrad || null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-[#1A1D21] font-['Outfit'] flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600">school</span>
              Sub Menu Khusus Graduasi & PPSE
            </h2>
            <span className="px-3 py-1 bg-teal-100 text-teal-900 border border-teal-300 rounded-full text-xs font-black flex items-center gap-1.5 shadow-xs">
              <span className="material-symbols-outlined text-[15px] text-teal-700">military_tech</span>
              {categorizedData.berhasilItems.length} Sudah Graduasi
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Data pemantauan graduasi mandiri, graduasi alami, dan program pemberdayaan sosial ekonomi (PPSE)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => handleOpenGraduasiModal('')}
            className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base">military_tech</span>
            <span>Catat Graduasi / PPSE</span>
          </button>
          {onNavigateToKpmData && (
            <button
              onClick={onNavigateToKpmData}
              className="px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-cyan-700">family_restroom</span>
              <span>Data KPM</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Calon Graduasi & PPSE</span>
            <span className="material-symbols-outlined text-amber-500 text-xl">upgrade</span>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{categorizedData.calonItems.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Potensial graduasi mandiri</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Berhasil Graduasi</span>
            <span className="material-symbols-outlined text-emerald-500 text-xl">workspace_premium</span>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{categorizedData.berhasilItems.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Resmi keluar kepesertaan PKH</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Graduasi Mandiri</span>
            <span className="material-symbols-outlined text-cyan-600 text-xl">trending_up</span>
          </div>
          <p className="text-2xl font-black text-cyan-700 mt-2">
            {graduasiList.filter((g) => g.StatusGraduasi === 'Graduasi Mandiri').length}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Ekonomi meningkat mandiri</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Peserta PPSE</span>
            <span className="material-symbols-outlined text-indigo-600 text-xl">storefront</span>
          </div>
          <p className="text-2xl font-black text-indigo-700 mt-2">
            {graduasiList.filter((g) => g.StatusPPSE === 'Sudah PPSE').length}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Diberdayakan usaha PPSE</p>
        </div>
      </div>

      {/* 2 Layar Tab Navigation */}
      <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-xs flex items-center gap-2">
        <button
          onClick={() => setActiveTab('calon')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'calon'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">person_search</span>
          <span>Layar 1: Calon Graduasi / Mampu & Calon PPSE ({categorizedData.calonItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('berhasil')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'berhasil'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">verified</span>
          <span>Layar 2: Sudah Berhasil Graduasi / PPSE ({categorizedData.berhasilItems.length})</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama pengurus, NIK, No. KK, atau alasan graduasi..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={selectedKelompok}
            onChange={(e) => setSelectedKelompok(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-teal-500 outline-none bg-white cursor-pointer"
          >
            <option value="">Semua Kelompok</option>
            {kelompokOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          {activeTab === 'berhasil' && (
            <select
              value={selectedAlasan}
              onChange={(e) => setSelectedAlasan(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-teal-500 outline-none bg-white cursor-pointer"
            >
              <option value="">Semua Alasan Graduasi</option>
              {ALASAN_GRADUASI_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedStatusPPSE}
            onChange={(e) => setSelectedStatusPPSE(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-teal-500 outline-none bg-white cursor-pointer"
          >
            <option value="">Semua Status PPSE</option>
            {STATUS_PPSE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {(searchQuery || selectedKelompok || selectedAlasan || selectedStatusPPSE) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedKelompok('');
                setSelectedAlasan('');
                setSelectedStatusPPSE('');
              }}
              className="px-3 py-2 border border-gray-300 hover:bg-gray-100 rounded-xl text-xs font-semibold text-gray-600 transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          )}

          <div className="text-xs text-gray-500 ml-auto font-medium">
            Menampilkan <strong>{filteredItems.length}</strong> KPM
          </div>
        </div>
      </div>

      {/* Cards List */}
      {isLoading ? (
        <div className="py-24 bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium">Memuat data graduasi...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-2">
          <span className="material-symbols-outlined text-5xl">school</span>
          <p className="font-bold text-gray-600 text-sm">
            {activeTab === 'calon'
              ? 'Tidak ada calon graduasi atau calon PPSE'
              : 'Belum ada data KPM yang berhasil graduasi'}
          </p>
          <p className="text-xs text-gray-400">
            {activeTab === 'calon'
              ? 'KPM yang memiliki temuan sudah mampu atau diajukan PPSE akan tampil di layar ini.'
              : 'Catat KPM yang berhasil graduasi mandiri atau graduasi alami menggunakan tombol di atas.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const kpm = item.kpm;
            const grad = item.graduasi;
            const isBerhasil = activeTab === 'berhasil';

            return (
              <div
                key={item.noKK}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between gap-4 ${
                  isBerhasil
                    ? 'border-emerald-200 hover:border-emerald-300 bg-emerald-50/15'
                    : 'border-amber-200 hover:border-amber-300 bg-amber-50/15'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Name & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm shrink-0 border border-teal-200">
                        {kpm?.NamaPengurus?.charAt(0) || 'K'}
                      </div>
                      <div>
                        <h4
                          onClick={() => {
                            if (kpm) {
                              setActiveKpmProfile(kpm);
                              setIsProfileModalOpen(true);
                            }
                          }}
                          className="font-bold text-slate-900 hover:text-cyan-700 cursor-pointer hover:underline text-sm"
                          title="Klik untuk lihat profil lengkap KPM"
                        >
                          {kpm?.NamaPengurus || 'Nama Tidak Ditemukan'}
                        </h4>
                        <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                          KK: {item.noKK} {kpm?.NIK ? `• NIK: ${kpm.NIK}` : ''}
                        </p>
                        {kpm?.Kelompok && (
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold mt-1">
                            {kpm.Kelompok}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isBerhasil
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        {isBerhasil ? (grad?.StatusGraduasi || 'Sudah Graduasi') : 'Calon Graduasi / PPSE'}
                      </span>
                      {grad?.StatusPPSE && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[9px] font-bold">
                          PPSE: {grad.StatusPPSE}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Highlight Reason / Information */}
                  {isBerhasil ? (
                    <div className="p-3 bg-white border border-emerald-200 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-semibold text-gray-500">Alasan Graduasi:</span>
                        <span className="font-bold text-emerald-900">{grad?.AlasanGraduasi || 'Ekonomi Membaik'}</span>
                      </div>
                      {grad?.TanggalGraduasi && (
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="font-semibold text-gray-500">Tanggal Graduasi:</span>
                          <span className="font-mono text-slate-800">{grad.TanggalGraduasi}</span>
                        </div>
                      )}
                      {grad?.PenghasilanPerBulan && (
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="font-semibold text-gray-500">Penghasilan/Bulan:</span>
                          <span className="font-bold text-slate-900">{grad.PenghasilanPerBulan}</span>
                        </div>
                      )}
                      {grad?.Catatan && (
                        <p className="text-[11px] text-gray-600 pt-1 border-t border-gray-100 italic">
                          Catatan: &ldquo;{grad.Catatan}&rdquo;
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-white border border-amber-200 rounded-xl space-y-1 text-xs">
                      <p className="font-bold text-amber-950 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-amber-600">tips_and_updates</span>
                        Alasan / Indikator Potensi Graduasi:
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {(item as any).reasonNote || 'Terindikasi mampu berdasarkan temuan lapangan atau kriteria PPSE.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-gray-500">
                    Status:{' '}
                    <strong className={isBerhasil ? 'text-emerald-700' : 'text-amber-700'}>
                      {isBerhasil ? 'Tidak Aktif (Graduasi)' : 'Peserta Aktif PKH'}
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenGraduasiModal(item.noKK, grad)}
                      className="px-3 py-1.5 bg-white border border-gray-300 hover:border-teal-500 hover:text-teal-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {isBerhasil ? 'edit_note' : 'military_tech'}
                      </span>
                      <span>{isBerhasil ? 'Edit Data Graduasi' : 'Proses Graduasi'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Graduasi */}
      {isModalOpen && (
        <KpmGraduasiModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedGraduasi(null);
            setTargetNoKK('');
          }}
          noKK={targetNoKK}
          initialData={selectedGraduasi}
          kpmList={kpmList}
          onSuccess={() => {
            fetchData();
            setIsModalOpen(false);
            setSelectedGraduasi(null);
            setTargetNoKK('');
          }}
        />
      )}

      {/* Modal Full Profile */}
      {isProfileModalOpen && activeKpmProfile && (
        <KpmFullProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setActiveKpmProfile(null);
          }}
          initialKeluarga={activeKpmProfile}
          kpmId={activeKpmProfile.KpmId}
          noKK={activeKpmProfile.NoKK}
          nik={activeKpmProfile.NIK}
        />
      )}
    </div>
  );
}
