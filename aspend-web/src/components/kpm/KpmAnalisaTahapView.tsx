'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { KpmKeluarga, TAHAP_BANSOS_OPTIONS } from '@/lib/kpm-constants';
import KpmFullProfileModal from './KpmFullProfileModal';

interface KpmAnalisaTahapViewProps {
  onNavigateHome?: () => void;
  onNavigateToKpmData?: () => void;
}

export default function KpmAnalisaTahapView({
  onNavigateHome,
  onNavigateToKpmData,
}: KpmAnalisaTahapViewProps) {
  const [dataList, setDataList] = useState<KpmKeluarga[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tahap Selection for Comparison
  const [tahapA, setTahapA] = useState<string>('Tahap 1 (2026)');
  const [tahapB, setTahapB] = useState<string>('Tahap 2 (2026)');

  // Active Tab for Detailed Table
  const [activeTab, setActiveTab] = useState<'baru' | 'terhenti' | 'bertahan' | 'semua-b'>('baru');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelompok, setSelectedKelompok] = useState('');

  // Profile modal
  const [activeKpmProfile, setActiveKpmProfile] = useState<KpmKeluarga | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/kpm');
      const json = await res.json();
      if (json.data) {
        setDataList(json.data);
      }
    } catch (err) {
      console.error('Error fetching KPM data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper check membership in stage
  const isInTahap = (kpm: KpmKeluarga, tahap: string): boolean => {
    const raw = kpm.TahapBansos || 'Tahap 1 (2026)';
    const cleanTahap = tahap.split(' ')[0] + ' ' + tahap.split(' ')[1]; // "Tahap 1", "Tahap 2", etc.
    return raw.includes(tahap) || raw.includes(cleanTahap);
  };

  // Comparison Analysis
  const analysis = useMemo(() => {
    const kpmInA: KpmKeluarga[] = [];
    const kpmInB: KpmKeluarga[] = [];
    const bertahan: KpmKeluarga[] = []; // In both A and B
    const baruInB: KpmKeluarga[] = []; // In B but NOT in A
    const terhentiInB: KpmKeluarga[] = []; // In A but NOT in B

    for (const k of dataList) {
      const hasA = isInTahap(k, tahapA);
      const hasB = isInTahap(k, tahapB);

      if (hasA) kpmInA.push(k);
      if (hasB) kpmInB.push(k);

      if (hasA && hasB) {
        bertahan.push(k);
      } else if (!hasA && hasB) {
        baruInB.push(k);
      } else if (hasA && !hasB) {
        terhentiInB.push(k);
      }
    }

    const retensiPercent =
      kpmInA.length > 0 ? Math.round((bertahan.length / kpmInA.length) * 100) : 0;

    const netGrowth = kpmInB.length - kpmInA.length;

    // Per-kelompok comparison
    const kelompokMap: Record<
      string,
      { totalA: number; totalB: number; baru: number; terhenti: number; bertahan: number }
    > = {};

    for (const k of dataList) {
      const kel = k.Kelompok?.trim() || 'Tanpa Kelompok';
      if (!kelompokMap[kel]) {
        kelompokMap[kel] = { totalA: 0, totalB: 0, baru: 0, terhenti: 0, bertahan: 0 };
      }
      const hasA = isInTahap(k, tahapA);
      const hasB = isInTahap(k, tahapB);

      if (hasA) kelompokMap[kel].totalA++;
      if (hasB) kelompokMap[kel].totalB++;
      if (hasA && hasB) kelompokMap[kel].bertahan++;
      else if (!hasA && hasB) kelompokMap[kel].baru++;
      else if (hasA && !hasB) kelompokMap[kel].terhenti++;
    }

    return {
      totalKpm: dataList.length,
      kpmInA,
      kpmInB,
      bertahan,
      baruInB,
      terhentiInB,
      retensiPercent,
      netGrowth,
      kelompokMap,
    };
  }, [dataList, tahapA, tahapB]);

  // Kelompok list for filter dropdown
  const kelompokList = useMemo(() => {
    return Object.keys(analysis.kelompokMap).sort();
  }, [analysis.kelompokMap]);

  // Items for the active detail tab
  const tabItems = useMemo(() => {
    let source: KpmKeluarga[] = [];
    if (activeTab === 'baru') source = analysis.baruInB;
    else if (activeTab === 'terhenti') source = analysis.terhentiInB;
    else if (activeTab === 'bertahan') source = analysis.bertahan;
    else source = analysis.kpmInB;

    return source.filter((k) => {
      if (selectedKelompok && k.Kelompok !== selectedKelompok) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nama = (k.NamaPengurus || '').toLowerCase();
        const nik = (k.NIK || '').toLowerCase();
        const kk = (k.NoKK || '').toLowerCase();
        const alamat = (k.Alamat || '').toLowerCase();
        return nama.includes(q) || nik.includes(q) || kk.includes(q) || alamat.includes(q);
      }
      return true;
    });
  }, [analysis, activeTab, selectedKelompok, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-[#1A1D21] font-['Outfit'] flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">compare_arrows</span>
              Analisa Perbandingan KPM Aktif Antar Tahap
            </h2>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-full text-xs font-black flex items-center gap-1.5 shadow-xs">
              <span className="material-symbols-outlined text-[15px] text-indigo-700">trending_up</span>
              {analysis.netGrowth >= 0 ? `+${analysis.netGrowth}` : analysis.netGrowth} Pertumbuhan Netto
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Analisis kepesertaan aktif, KPM baru masuk, KPM bertahan, dan KPM terhenti/graduasi antar tahap penyaluran
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {onNavigateToKpmData && (
            <button
              onClick={onNavigateToKpmData}
              className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-cyan-700">family_restroom</span>
              <span>Data KPM</span>
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Cetak Laporan Perbandingan"
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>Cetak Analisis</span>
          </button>
        </div>
      </div>

      {/* Comparison Selector Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Tahap Sebelumnya (A) */}
          <div className="flex-1 w-full bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15">
            <span className="text-[11px] uppercase tracking-wider text-indigo-200 font-bold block mb-1">
              Tahap Sebelumnya (Basis A)
            </span>
            <select
              value={tahapA}
              onChange={(e) => setTahapA(e.target.value)}
              className="w-full bg-slate-800 text-white font-bold text-sm px-3 py-2 rounded-lg border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
            >
              {TAHAP_BANSOS_OPTIONS.map((t) => (
                <option key={`a-${t}`} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <p className="text-xs text-indigo-200 mt-2 font-mono">
              Peserta Terdaftar: <strong>{analysis.kpmInA.length} KPM</strong>
            </p>
          </div>

          {/* Visual Arrow Indicator */}
          <div className="flex flex-col items-center justify-center shrink-0 px-2">
            <div className="w-10 h-10 rounded-full bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-200">
              <span className="material-symbols-outlined text-2xl">arrow_forward</span>
            </div>
            <span className="text-[10px] text-indigo-300 font-bold mt-1">DIBANDINGKAN</span>
          </div>

          {/* Tahap Saat Ini (B) */}
          <div className="flex-1 w-full bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15">
            <span className="text-[11px] uppercase tracking-wider text-cyan-200 font-bold block mb-1">
              Tahap Saat Ini (Target B)
            </span>
            <select
              value={tahapB}
              onChange={(e) => setTahapB(e.target.value)}
              className="w-full bg-slate-800 text-white font-bold text-sm px-3 py-2 rounded-lg border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer"
            >
              {TAHAP_BANSOS_OPTIONS.map((t) => (
                <option key={`b-${t}`} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <p className="text-xs text-cyan-200 mt-2 font-mono">
              Peserta Terdaftar: <strong>{analysis.kpmInB.length} KPM</strong>
            </p>
          </div>
        </div>
      </div>

      {/* KPI Comparison Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">KPM Baru Masuk</span>
            <span className="material-symbols-outlined text-emerald-500 text-xl">person_add</span>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">+{analysis.baruInB.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Baru terdaftar di {tahapB}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">KPM Terhenti / Drop</span>
            <span className="material-symbols-outlined text-rose-500 text-xl">person_remove</span>
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">-{analysis.terhentiInB.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Ada di {tahapA}, tidak di {tahapB}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">KPM Bertahan</span>
            <span className="material-symbols-outlined text-indigo-500 text-xl">verified</span>
          </div>
          <p className="text-2xl font-black text-indigo-600 mt-2">{analysis.bertahan.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Aktif di kedua tahap</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Tingkat Retensi</span>
            <span className="material-symbols-outlined text-cyan-600 text-xl">percent</span>
          </div>
          <p className="text-2xl font-black text-cyan-700 mt-2">{analysis.retensiPercent}%</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Persentase bertahan dari {tahapA}</p>
        </div>
      </div>

      {/* Breakdown per Kelompok Summary Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 text-lg">view_column</span>
            <h3 className="font-bold text-slate-800 text-xs tracking-wider uppercase font-['Outfit']">
              Tabel Matriks Perbandingan Per Kelompok ({kelompokList.length} Kelompok)
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600 uppercase font-bold">
                <th className="px-3.5 py-3">Nama Kelompok</th>
                <th className="px-3 py-3 text-center">{tahapA}</th>
                <th className="px-3 py-3 text-center">{tahapB}</th>
                <th className="px-3 py-3 text-center text-emerald-700">KPM Baru (+)</th>
                <th className="px-3 py-3 text-center text-rose-700">KPM Drop (-)</th>
                <th className="px-3 py-3 text-center text-indigo-700">Bertahan</th>
                <th className="px-3 py-3 text-center">Tingkat Retensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kelompokList.map((kel) => {
                const row = analysis.kelompokMap[kel];
                const retensi = row.totalA > 0 ? Math.round((row.bertahan / row.totalA) * 100) : 0;

                return (
                  <tr key={kel} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5 font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-slate-400">group</span>
                      <span>{kel}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-medium text-slate-600">
                      {row.totalA}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 bg-sky-50/40">
                      {row.totalB}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-emerald-700">
                      {row.baru > 0 ? `+${row.baru}` : '0'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-rose-700">
                      {row.terhenti > 0 ? `-${row.terhenti}` : '0'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-indigo-700">
                      {row.bertahan}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          retensi >= 90
                            ? 'bg-emerald-100 text-emerald-800'
                            : retensi >= 70
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {retensi}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabs Detail KPM */}
      <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-xs flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab('baru')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'baru'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          <span>KPM Baru di {tahapB} ({analysis.baruInB.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('terhenti')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'terhenti'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">person_remove</span>
          <span>KPM Terhenti / Graduasi ({analysis.terhentiInB.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bertahan')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'bertahan'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">verified</span>
          <span>KPM Bertahan di Kedua Tahap ({analysis.bertahan.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('semua-b')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'semua-b'
              ? 'bg-slate-800 text-white shadow-md'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">groups</span>
          <span>Semua KPM {tahapB} ({analysis.kpmInB.length})</span>
        </button>
      </div>

      {/* Filter inside Details */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, NIK, No. KK, atau alamat..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <select
            value={selectedKelompok}
            onChange={(e) => setSelectedKelompok(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer"
          >
            <option value="">Semua Kelompok</option>
            {kelompokList.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <span className="text-xs text-gray-500 ml-auto font-medium">
            Menampilkan <strong>{tabItems.length}</strong> KPM
          </span>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {tabItems.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <span className="material-symbols-outlined text-4xl text-gray-300">search_off</span>
            <p className="mt-2 text-xs font-bold text-gray-600">Tidak ada KPM pada kategori ini</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-600 uppercase font-bold">
                  <th className="px-3 py-3 text-center w-10">No</th>
                  <th className="px-3 py-3">Nama Pengurus</th>
                  <th className="px-3 py-3">NIK & No. KK</th>
                  <th className="px-3 py-3">Kelompok</th>
                  <th className="px-3 py-3">Wilayah</th>
                  <th className="px-3 py-3 text-center">Tahap Terdaftar</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tabItems.map((kpm, idx) => (
                  <tr key={kpm.KpmId || kpm.NIK || idx} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="px-3 py-2.5 text-center font-mono text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <p
                        onClick={() => {
                          setActiveKpmProfile(kpm);
                          setIsProfileModalOpen(true);
                        }}
                        className="font-bold text-slate-900 hover:text-indigo-600 hover:underline cursor-pointer"
                      >
                        {kpm.NamaPengurus}
                      </p>
                      <span className="text-[10px] text-gray-500">{kpm.StatusKelompok || 'Anggota'}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      <p className="text-slate-800 font-semibold">{kpm.NIK}</p>
                      <p className="text-gray-400 text-[11px]">KK: {kpm.NoKK}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                        {kpm.Kelompok || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 text-[11px]">
                      {kpm.Kelurahan || kpm.Kecamatan || kpm.Alamat || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 bg-sky-100 text-sky-900 border border-sky-300 rounded-md text-[10px] font-bold">
                        {kpm.TahapBansos || 'Tahap 1 (2026)'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          kpm.StatusKepesertaan === 'Graduasi' || kpm.StatusKepesertaan === 'Tidak Aktif'
                            ? 'bg-slate-100 text-slate-700 border border-slate-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {kpm.StatusKepesertaan || 'Aktif'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => {
                          setActiveKpmProfile(kpm);
                          setIsProfileModalOpen(true);
                        }}
                        className="p-1 hover:bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer transition-colors"
                        title="Lihat Profil KPM"
                      >
                        <span className="material-symbols-outlined text-base">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Profile Modal */}
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
