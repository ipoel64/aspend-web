'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { KpmKeluarga } from '@/lib/kpm-constants';

const KpmLeafletMap = dynamic(() => import('./KpmLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[320px] flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-2">
      <div className="w-8 h-8 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs font-medium">Memuat Peta Spasial Rumah KPM...</p>
    </div>
  ),
});

interface DashboardData {
  summary: {
    totalKpm: number;
    lengkapCount: number;
    belumLengkapCount: number;
    verifikasiCount: number;
    graduasiCount: number;
    masalahCount: number;
    totalAnggota: number;
    aktifCount?: number;
    tidakAktifCount?: number;
  };
  tahapBreakdown?: Record<string, number>;
  kelompokBreakdown: Record<string, number>;
  komponenBreakdown: Record<string, number>;
  graduasiBreakdown: Record<string, number>;
  markers: Array<{
    kpmId: string;
    nik?: string;
    noKK: string;
    namaPengurus: string;
    kelompok: string;
    alamat: string;
    statusData: string;
    statusKepesertaan?: string;
    fotoRumah?: string;
    lat: number;
    lng: number;
  }>;
  recentKpm?: KpmKeluarga[];
}

interface KpmDashboardViewProps {
  onNavigateToData?: () => void;
  onSelectKpm?: (kpm: KpmKeluarga) => void;
}

export default function KpmDashboardView({
  onNavigateToData,
  onSelectKpm,
}: KpmDashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<any | null>(null);
  const [markerSearchQuery, setMarkerSearchQuery] = useState('');
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-scroll item di daftar samping saat marker dipilih
  useEffect(() => {
    if (selectedMarker) {
      const key = selectedMarker.kpmId || selectedMarker.noKK;
      const el = itemRefs.current.get(key);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedMarker]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/kpm/dashboard');
      if (!res.ok) {
        throw new Error(`Gagal memuat data (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (json.summary) {
        setData(json);
      } else {
        throw new Error(json.error || 'Format data dashboard tidak valid');
      }
    } catch (err: any) {
      console.error('Error fetching KPM dashboard:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat memuat data dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const summary = data?.summary || {
    totalKpm: 0,
    lengkapCount: 0,
    belumLengkapCount: 0,
    verifikasiCount: 0,
    graduasiCount: 0,
    masalahCount: 0,
    totalAnggota: 0,
    aktifCount: 0,
    tidakAktifCount: 0,
  };

  const tahapBreakdown = data?.tahapBreakdown || {};
  const komponenBreakdown = data?.komponenBreakdown || {};
  const kelompokBreakdown = data?.kelompokBreakdown || {};
  const markers = data?.markers || [];

  // Hitung persentase kelengkapan
  const kelengkapanRate =
    summary.totalKpm > 0
      ? Math.round((summary.lengkapCount / summary.totalKpm) * 100)
      : 0;

  // Filter titik marker berdasarkan pencarian nama, kelompok, alamat
  // WAJIB ditaruh sebelum conditional returns agar urutan Hooks tidak berubah antar render
  const filteredMarkers = useMemo(() => {
    if (!markerSearchQuery) return markers;
    const q = markerSearchQuery.toLowerCase();
    return markers.filter(
      (m) =>
        m.namaPengurus?.toLowerCase().includes(q) ||
        m.kelompok?.toLowerCase().includes(q) ||
        m.alamat?.toLowerCase().includes(q) ||
        m.noKK?.includes(q)
    );
  }, [markers, markerSearchQuery]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-gray-500">
        <div className="w-8 h-8 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-medium text-xs">Memuat data ringkasan dashboard KPM...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-500 bg-white rounded-2xl border border-rose-200 p-8 shadow-xs">
        <span className="material-symbols-outlined text-4xl text-rose-500">sync_problem</span>
        <p className="font-bold text-sm text-gray-800">Gagal Memuat Ringkasan Dashboard</p>
        <p className="text-xs text-rose-600 max-w-md text-center">{errorMsg}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-2 px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          <span>Muat Ulang Dashboard</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Dashboard */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1A1D21] font-['Outfit'] flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-600">analytics</span>
            Dashboard Eksekutif Profil KPM
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Analitik komprehensif profil penerima manfaat, status graduasi, aset, dan sebaran spasial
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToData && (
            <button
              onClick={onNavigateToData}
              className="px-4 py-2 bg-gradient-to-r from-[#005B94] to-[#00838F] hover:from-[#004b7a] hover:to-[#006f7a] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">table_view</span>
              <span>Buka Data KPM</span>
            </button>
          )}
          <button
            onClick={fetchDashboardData}
            className="p-2 border border-gray-300 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"
            title="Refresh Data"
          >
            <span className="material-symbols-outlined text-base">sync</span>
          </button>
        </div>
      </div>

      {/* 5 Kartu Statistik Utama */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          {
            label: 'Total KPM',
            val: summary.totalKpm,
            icon: 'groups',
            bg: 'from-cyan-500 to-cyan-700',
            sub: 'Keluarga',
          },
          {
            label: 'Total Anggota',
            val: summary.totalAnggota,
            icon: 'diversity_3',
            bg: 'from-blue-500 to-blue-700',
            sub: 'Jiwa Terdaftar',
          },
          {
            label: 'Data Lengkap',
            val: summary.lengkapCount,
            icon: 'verified',
            bg: 'from-emerald-500 to-emerald-700',
            sub: `${kelengkapanRate}% Lengkap`,
          },
          {
            label: 'Belum Lengkap',
            val: summary.belumLengkapCount,
            icon: 'pending',
            bg: 'from-amber-500 to-amber-700',
            sub: 'Perlu Verifikasi',
          },
          {
            label: 'Sudah Graduasi',
            val: summary.graduasiCount,
            icon: 'school',
            bg: 'from-violet-500 to-violet-700',
            sub: 'Mandiri / Alami',
          },
          {
            label: 'Bermasalah',
            val: summary.masalahCount,
            icon: 'warning',
            bg: 'from-rose-500 to-rose-700',
            sub: 'Kasus Aktif',
          },
        ].map((c, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-gray-600">{c.label}</span>
              <div
                className={`w-8 h-8 rounded-lg bg-gradient-to-br ${c.bg} flex items-center justify-center text-white shadow-xs`}
              >
                <span className="material-symbols-outlined text-[17px]">{c.icon}</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900 font-['Outfit']">{c.val}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid Komposisi Komponen & Sebaran Kelompok */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Komposisi Komponen PKH */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-lg">pie_chart</span>
              Komposisi Komponen Bantuan PKH
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Rincian jumlah anggota keluarga berdasarkan kriteria komponen
            </p>
          </div>

          {Object.keys(komponenBreakdown).length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <span className="material-symbols-outlined text-3xl">donut_large</span>
              <p className="text-xs mt-1">Belum ada data komponen anggota</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(komponenBreakdown).map(([komp, count]) => {
                const totalComp = Object.values(komponenBreakdown).reduce((a, b) => a + b, 0);
                const pct = Math.round((count / (totalComp || 1)) * 100);
                return (
                  <div key={komp} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-700">{komp}</span>
                      <span className="font-bold text-gray-900 font-mono">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sebaran Kelompok PKH */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600 text-lg">bar_chart</span>
              Sebaran KPM per Kelompok PKH
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Jumlah KPM yang terorganisir dalam tiap kelompok dampingan</p>
          </div>

          {Object.keys(kelompokBreakdown).length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <span className="material-symbols-outlined text-3xl">bar_chart</span>
              <p className="text-xs mt-1">Belum ada kelompok terdaftar</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {Object.entries(kelompokBreakdown).map(([kel, count]) => {
                const maxCount = Math.max(...Object.values(kelompokBreakdown));
                const pct = Math.round((count / (maxCount || 1)) * 100);
                return (
                  <div key={kel} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-700">{kel}</span>
                      <span className="font-bold text-gray-900 font-mono">{count} KPM</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#005B94] to-[#00838F] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Grid Analisa Tahap Bansos & Status Kepesertaan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grafik Tahap Bansos Berjalan */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-lg">stacked_bar_chart</span>
              Analisa Kepesertaan per Tahap Bansos (Tahun Berjalan)
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Jumlah KPM yang terdata menerima bantuan pada masing-masing tahap penyaluran
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {['Tahap 1', 'Tahap 2', 'Tahap 3', 'Tahap 4'].map((tName, tIdx) => {
              const count = tahapBreakdown[tName] || 0;
              const pct = summary.totalKpm > 0 ? Math.round((count / summary.totalKpm) * 100) : 0;
              const colors = [
                { bg: 'bg-blue-50 border-blue-200 text-blue-900', bar: 'bg-blue-600' },
                { bg: 'bg-teal-50 border-teal-200 text-teal-900', bar: 'bg-teal-600' },
                { bg: 'bg-purple-50 border-purple-200 text-purple-900', bar: 'bg-purple-600' },
                { bg: 'bg-emerald-50 border-emerald-200 text-emerald-900', bar: 'bg-emerald-600' },
              ][tIdx];
              return (
                <div key={tName} className={`p-3 rounded-xl border ${colors.bg} text-center space-y-1`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{tName}</p>
                  <p className="text-xl font-black font-['Outfit']">{count}</p>
                  <p className="text-[10px] font-bold text-gray-500">{pct}% KPM</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mt-1">
                    <div className={`${colors.bar} h-1.5 rounded-full`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">Monitoring Penyaluran Bansos:</span>
            <span className="font-bold text-indigo-700 font-mono">
              Tahap Aktif & Valid
            </span>
          </div>
        </div>

        {/* Rasio KPM Aktif vs Non-Aktif / Graduasi */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600 text-lg">donut_large</span>
              Status Kepesertaan: Aktif vs Non-Aktif / Graduasi
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Proporsi KPM dampingan aktif dibandingkan KPM yang telah graduasi/mandiri
            </p>
          </div>

          <div className="space-y-4">
            {/* KPM Aktif */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  KPM Aktif Dampingan
                </span>
                <span className="font-bold text-gray-900 font-mono">
                  {summary.aktifCount ?? (summary.totalKpm - summary.graduasiCount)} KPM (
                  {summary.totalKpm > 0
                    ? Math.round(((summary.aktifCount ?? (summary.totalKpm - summary.graduasiCount)) / summary.totalKpm) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      summary.totalKpm > 0
                        ? Math.round(((summary.aktifCount ?? (summary.totalKpm - summary.graduasiCount)) / summary.totalKpm) * 100)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            {/* KPM Non-Aktif / Graduasi */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  KPM Non-Aktif / Graduasi
                </span>
                <span className="font-bold text-gray-900 font-mono">
                  {summary.tidakAktifCount ?? summary.graduasiCount} KPM (
                  {summary.totalKpm > 0
                    ? Math.round(((summary.tidakAktifCount ?? summary.graduasiCount) / summary.totalKpm) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-slate-400 to-slate-600 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      summary.totalKpm > 0
                        ? Math.round(((summary.tidakAktifCount ?? summary.graduasiCount) / summary.totalKpm) * 100)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-2 text-xs text-teal-900">
            <span className="material-symbols-outlined text-teal-600 text-base">info</span>
            <span>
              KPM yang telah graduasi ditampilkan dengan visualisasi samar (dimmed) pada tabel data KPM.
            </span>
          </div>
        </div>
      </div>

      {/* Peta Sebaran Spasial KPM */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 text-lg">pin_drop</span>
              Peta Sebaran Lokasi Rumah KPM
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Visualisasi titik koordinat GPS rumah keluarga penerima manfaat ({markers.length} Titik Terdeteksi)
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-cyan-900 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-xl font-medium">
            <span className="material-symbols-outlined text-sm text-cyan-600">my_location</span>
            <span>Area Utama: Kota Binjai & Sekitarnya</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Peta Leaflet Interaktif Multi-Pin */}
          <div className="lg:col-span-2 h-80 sm:h-[420px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100 relative">
            <KpmLeafletMap
              markers={markers}
              selectedMarker={selectedMarker}
              onSelectMarker={(m) => setSelectedMarker(m)}
            />
          </div>

          {/* Daftar Titik Lokasi KPM */}
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex flex-col justify-between h-80 sm:h-[420px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-xs text-gray-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-cyan-600">location_city</span>
                  Daftar Titik Rumah KPM
                </p>
                <span className="text-[10px] font-bold text-cyan-800 bg-cyan-100 px-1.5 py-0.5 rounded">
                  {filteredMarkers.length} KPM
                </span>
              </div>

              {/* Pencarian Titik KPM */}
              <div className="relative mb-2">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  search
                </span>
                <input
                  type="text"
                  value={markerSearchQuery}
                  onChange={(e) => setMarkerSearchQuery(e.target.value)}
                  placeholder="Cari nama, kelompok, alamat..."
                  className="w-full pl-7 pr-6 py-1 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                />
                {markerSearchQuery && (
                  <button
                    onClick={() => setMarkerSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {markers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <span className="material-symbols-outlined text-2xl">location_off</span>
                <p className="text-[11px] mt-1 font-medium">Belum ada koordinat GPS</p>
                <p className="text-[10px] text-gray-400">Isi data lokasi di menu Data Aset KPM</p>
              </div>
            ) : filteredMarkers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <p className="text-[11px]">Tidak ada titik yang cocok</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredMarkers.map((m, idx) => {
                  const isSelected = selectedMarker?.noKK === m.noKK || (m.kpmId && selectedMarker?.kpmId === m.kpmId);
                  const isOutlier = m.lat < 3.2 || m.lat > 4.0 || m.lng < 98.0 || m.lng > 99.0;
                  const isGrad =
                    m.statusKepesertaan === 'Graduasi' ||
                    m.statusKepesertaan === 'Tidak Aktif';
                  const photoSrc = m.fotoRumah
                    ? (m.fotoRumah.startsWith('http') ? m.fotoRumah : `/api/image-proxy?id=${m.fotoRumah}`)
                    : '';
                  const itemKey = m.kpmId || m.noKK || `marker-${idx}`;

                  return (
                    <div
                      key={itemKey}
                      ref={(el) => {
                        if (el) itemRefs.current.set(itemKey, el);
                        else itemRefs.current.delete(itemKey);
                      }}
                      onClick={() => setSelectedMarker(m)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex gap-2.5 items-center ${
                        isSelected
                          ? 'bg-cyan-50/90 border-cyan-500 ring-2 ring-cyan-200 text-cyan-950 font-semibold shadow-xs'
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800 hover:border-gray-300'
                      }`}
                    >
                      {/* Thumbnail Foto Rumah */}
                      <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative shadow-2xs">
                        {photoSrc ? (
                          <img
                            src={photoSrc}
                            alt="Foto Rumah"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                        <span className="material-symbols-outlined text-slate-400 text-lg absolute -z-0">
                          home
                        </span>
                      </div>

                      {/* Detail KPM */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-bold truncate text-[12px]">{m.namaPengurus}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {isOutlier && (
                              <span
                                className="px-1 py-0.2 text-[8px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-300"
                                title="Koordinat di luar Kota Binjai"
                              >
                                ⚠️ Cek
                              </span>
                            )}
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                                isGrad
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isGrad ? 'Graduasi' : 'Aktif'}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-cyan-800 font-medium truncate mt-0.5">
                          {m.kelompok ? `Kelompok: ${m.kelompok}` : '—'}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{m.alamat}</p>
                        <div className="mt-1 flex items-center justify-between text-[10px] pt-1 border-t border-gray-100">
                          <span className="font-mono text-gray-400 text-[9px]">
                            {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                          </span>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-700 font-bold hover:underline flex items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                            title="Buka titik koordinat di Google Maps"
                          >
                            <span>Maps</span>
                            <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
