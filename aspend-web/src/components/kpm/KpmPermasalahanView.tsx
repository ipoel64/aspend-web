'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  KpmPermasalahan,
  KpmKeluarga,
  JENIS_MASALAH_OPTIONS,
  PRIORITAS_OPTIONS,
  STATUS_MASALAH_OPTIONS,
} from '@/lib/kpm-constants';
import KpmPermasalahanModal from './KpmPermasalahanModal';
import KpmFullProfileModal from './KpmFullProfileModal';

interface KpmPermasalahanViewProps {
  onNavigateHome?: () => void;
  onNavigateToKpmData?: () => void;
}

export default function KpmPermasalahanView({
  onNavigateHome,
  onNavigateToKpmData,
}: KpmPermasalahanViewProps) {
  const [masalahList, setMasalahList] = useState<KpmPermasalahan[]>([]);
  const [kpmList, setKpmList] = useState<KpmKeluarga[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab State: 'belum-selesai' | 'selesai'
  const [activeTab, setActiveTab] = useState<'belum-selesai' | 'selesai'>('belum-selesai');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJenis, setSelectedJenis] = useState('');
  const [selectedPrioritas, setSelectedPrioritas] = useState('');
  const [selectedKelompok, setSelectedKelompok] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<KpmPermasalahan | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [activeKpmProfile, setActiveKpmProfile] = useState<KpmKeluarga | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resMasalah, resKpm] = await Promise.all([
        fetch('/api/kpm/permasalahan').then((r) => r.json()),
        fetch('/api/kpm').then((r) => r.json()),
      ]);
      if (resMasalah.data) setMasalahList(resMasalah.data);
      if (resKpm.data) setKpmList(resKpm.data);
    } catch (err) {
      console.error('Error fetching data permasalahan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map NoKK -> KpmKeluarga for family details
  const kpmMap = useMemo(() => {
    const map = new Map<string, KpmKeluarga>();
    for (const k of kpmList) {
      if (k.NoKK) map.set(k.NoKK.trim(), k);
    }
    return map;
  }, [kpmList]);

  // Kelompok options from KPM list
  const kelompokOptions = useMemo(() => {
    const set = new Set<string>();
    for (const k of kpmList) {
      if (k.Kelompok?.trim()) set.add(k.Kelompok.trim());
    }
    return Array.from(set);
  }, [kpmList]);

  // Summary counts
  const stats = useMemo(() => {
    const total = masalahList.length;
    const selesai = masalahList.filter((m) => m.Status === 'Selesai').length;
    const belumSelesai = total - selesai;
    const terbuka = masalahList.filter((m) => m.Status === 'Terbuka').length;
    const dalamProses = masalahList.filter((m) => m.Status === 'Dalam Proses').length;
    const ditindaklanjuti = masalahList.filter((m) => m.Status === 'Ditindaklanjuti').length;
    const kritis = masalahList.filter((m) => m.Prioritas === 'Kritis' && m.Status !== 'Selesai').length;

    return { total, selesai, belumSelesai, terbuka, dalamProses, ditindaklanjuti, kritis };
  }, [masalahList]);

  // Filtered list based on active tab and filter criteria
  const filteredList = useMemo(() => {
    return masalahList.filter((m) => {
      // Filter tab
      const isSelesai = m.Status === 'Selesai';
      if (activeTab === 'belum-selesai' && isSelesai) return false;
      if (activeTab === 'selesai' && !isSelesai) return false;

      // Filter jenis masalah
      if (selectedJenis && m.JenisMasalah !== selectedJenis) return false;

      // Filter prioritas
      if (selectedPrioritas && m.Prioritas !== selectedPrioritas) return false;

      // KPM family data lookup
      const kpm = kpmMap.get((m.NoKK || '').trim());

      // Filter kelompok
      if (selectedKelompok && kpm?.Kelompok !== selectedKelompok) return false;

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nama = (kpm?.NamaPengurus || '').toLowerCase();
        const kk = (m.NoKK || '').toLowerCase();
        const deskripsi = (m.Deskripsi || '').toLowerCase();
        const tindakLanjut = (m.TindakLanjut || '').toLowerCase();
        const jenis = (m.JenisMasalah || '').toLowerCase();

        return nama.includes(q) || kk.includes(q) || deskripsi.includes(q) || tindakLanjut.includes(q) || jenis.includes(q);
      }

      return true;
    });
  }, [masalahList, activeTab, selectedJenis, selectedPrioritas, selectedKelompok, searchQuery, kpmMap]);

  // Quick update status
  const handleUpdateStatus = async (masalah: KpmPermasalahan, newStatus: string) => {
    try {
      const res = await fetch('/api/kpm/permasalahan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...masalah,
          Status: newStatus,
          TanggalTindakLanjut: newStatus === 'Selesai' ? new Date().toISOString().slice(0, 10) : masalah.TanggalTindakLanjut,
        }),
      });
      if (!res.ok) throw new Error('Gagal memperbarui status');
      fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Delete problem
  const handleDelete = async (masalahId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan permasalahan ini?')) return;
    try {
      const res = await fetch(`/api/kpm/permasalahan?masalahId=${encodeURIComponent(masalahId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus permasalahan');
      fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'Kritis':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Tinggi':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Sedang':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'Selesai':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Ditindaklanjuti':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'Dalam Proses':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-rose-100 text-rose-800 border-rose-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-[#1A1D21] font-['Outfit'] flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600">report_problem</span>
              Sub Menu Khusus Permasalahan KPM
            </h2>
            <span className="px-3 py-1 bg-rose-100 text-rose-900 border border-rose-300 rounded-full text-xs font-black flex items-center gap-1.5 shadow-xs">
              <span className="material-symbols-outlined text-[15px] text-rose-700">warning</span>
              {stats.belumSelesai} Masalah Aktif
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Monitoring, tindak lanjut, dan dokumentasi penanganan masalah seluruh KPM dampingan
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => {
              setSelectedForEdit(null);
              setIsAddModalOpen(true);
            }}
            className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span>Tambah Catatan Permasalahan</span>
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

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Belum Selesai</span>
            <span className="material-symbols-outlined text-rose-500 text-xl">pending_actions</span>
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">{stats.belumSelesai}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {stats.terbuka} Terbuka • {stats.dalamProses} Proses
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Sudah Selesai</span>
            <span className="material-symbols-outlined text-emerald-500 text-xl">task_alt</span>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{stats.selesai}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Penanganan tuntas 100%</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Prioritas Kritis</span>
            <span className="material-symbols-outlined text-red-600 text-xl">emergency</span>
          </div>
          <p className="text-2xl font-black text-red-700 mt-2">{stats.kritis}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Butuh tindak lanjut segera</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">Total Tercatat</span>
            <span className="material-symbols-outlined text-cyan-600 text-xl">inventory_2</span>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">{stats.total}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Seluruh riwayat temuan</p>
        </div>
      </div>

      {/* Main Tab Navigation: 2 Layar (Belum Selesai vs Selesai) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-xs flex items-center gap-2">
        <button
          onClick={() => setActiveTab('belum-selesai')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'belum-selesai'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">hourglass_top</span>
          <span>Layar 1: Masalah Belum Selesai ({stats.belumSelesai})</span>
        </button>

        <button
          onClick={() => setActiveTab('selesai')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'selesai'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">verified</span>
          <span>Layar 2: Masalah Selesai ({stats.selesai})</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
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
              placeholder="Cari nama KPM, No. KK, deskripsi masalah, atau tindak lanjut..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-none"
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
            value={selectedJenis}
            onChange={(e) => setSelectedJenis(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-rose-500 outline-none bg-white cursor-pointer"
          >
            <option value="">Semua Jenis Masalah</option>
            {JENIS_MASALAH_OPTIONS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>

          <select
            value={selectedPrioritas}
            onChange={(e) => setSelectedPrioritas(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-rose-500 outline-none bg-white cursor-pointer"
          >
            <option value="">Semua Prioritas</option>
            {PRIORITAS_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={selectedKelompok}
            onChange={(e) => setSelectedKelompok(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-rose-500 outline-none bg-white cursor-pointer"
          >
            <option value="">Semua Kelompok</option>
            {kelompokOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          {(searchQuery || selectedJenis || selectedPrioritas || selectedKelompok) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedJenis('');
                setSelectedPrioritas('');
                setSelectedKelompok('');
              }}
              className="px-3 py-2 border border-gray-300 hover:bg-gray-100 rounded-xl text-xs font-semibold text-gray-600 transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          )}

          <div className="text-xs text-gray-500 ml-auto font-medium">
            Menampilkan <strong>{filteredList.length}</strong> catatan
          </div>
        </div>
      </div>

      {/* Problem Cards List */}
      {isLoading ? (
        <div className="py-24 bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium">Memuat data permasalahan...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-20 bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-2">
          <span className="material-symbols-outlined text-5xl">
            {activeTab === 'belum-selesai' ? 'check_circle' : 'inventory'}
          </span>
          <p className="font-bold text-gray-600 text-sm">
            {activeTab === 'belum-selesai'
              ? 'Tidak ada masalah yang belum selesai!'
              : 'Belum ada catatan masalah yang selesai'}
          </p>
          <p className="text-xs text-gray-400">
            {activeTab === 'belum-selesai'
              ? 'Seluruh penanganan temuan saat ini dalam kondisi tuntas atau belum ada laporan baru.'
              : 'Masalah yang diselesaikan akan diarsipkan di layar ini.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((m) => {
            const kpm = kpmMap.get((m.NoKK || '').trim());

            return (
              <div
                key={m.MasalahId}
                className="bg-white rounded-2xl border border-gray-200 hover:border-rose-300 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  {/* Top Bar: Family Info & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => {
                            if (kpm) {
                              setActiveKpmProfile(kpm);
                              setIsProfileModalOpen(true);
                            }
                          }}
                          className="font-bold text-slate-900 hover:text-cyan-700 cursor-pointer hover:underline text-sm"
                          title="Klik untuk lihat profil lengkap KPM"
                        >
                          {kpm?.NamaPengurus || 'KPM Tidak Terdaftar'}
                        </span>
                        {kpm?.Kelompok && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                            {kpm.Kelompok}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        KK: {m.NoKK} {kpm?.NIK ? `• NIK: ${kpm.NIK}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityBadge(
                          m.Prioritas
                        )}`}
                      >
                        {m.Prioritas}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                          m.Status
                        )}`}
                      >
                        {m.Status}
                      </span>
                    </div>
                  </div>

                  {/* Problem Tag & Description */}
                  <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                      <span className="material-symbols-outlined text-sm text-rose-600">error_outline</span>
                      <span>{m.JenisMasalah}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {m.Deskripsi || 'Tidak ada deskripsi rinci.'}
                    </p>
                  </div>

                  {/* Follow up action info */}
                  {(m.TindakLanjut || m.TanggalTindakLanjut) && (
                    <div className="p-3 bg-cyan-50/50 border border-cyan-100 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-900 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-cyan-600">assignment_turned_in</span>
                          Tindak Lanjut & Progres
                        </span>
                        {m.TanggalTindakLanjut && (
                          <span className="text-[10px] text-cyan-800 font-mono">
                            {m.TanggalTindakLanjut}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                        {m.TindakLanjut || 'Belum ada catatan tindak lanjut.'}
                      </p>
                    </div>
                  )}

                  {/* Foto Bukti Dukung (Item 10) */}
                  {m.FotoBukti && (
                    <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      <div
                        onClick={() => setPreviewPhoto(m.FotoBukti)}
                        className="w-14 h-14 rounded-lg overflow-hidden bg-slate-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity border border-slate-300"
                        title="Klik untuk memperbesar foto bukti"
                      >
                        <img
                          src={`/api/image-proxy?id=${m.FotoBukti}`}
                          alt="Foto Bukti Dukung"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">Foto Bukti Dukung Terlampir</p>
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto(m.FotoBukti)}
                          className="text-[11px] text-cyan-700 hover:underline flex items-center gap-1 mt-0.5 cursor-pointer font-semibold"
                        >
                          <span className="material-symbols-outlined text-[13px]">visibility</span>
                          Lihat Pratinjau Foto
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions Toolbar */}
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
                  {/* Status Dropdown Quick Change */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-500 font-medium">Ubah:</span>
                    <select
                      value={m.Status}
                      onChange={(e) => handleUpdateStatus(m, e.target.value)}
                      className="px-2 py-1 text-[11px] font-bold border border-gray-200 rounded-lg bg-gray-50 hover:bg-white cursor-pointer outline-none"
                    >
                      {STATUS_MASALAH_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedForEdit(m);
                        setIsAddModalOpen(true);
                      }}
                      className="p-1.5 text-gray-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Catatan Permasalahan"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>

                    <button
                      onClick={() => handleDelete(m.MasalahId)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Catatan Permasalahan"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tambah / Edit Permasalahan */}
      {isAddModalOpen && (
        <KpmPermasalahanModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setSelectedForEdit(null);
          }}
          noKK={selectedForEdit?.NoKK || ''}
          initialData={selectedForEdit}
          onSuccess={() => {
            fetchData();
            setIsAddModalOpen(false);
            setSelectedForEdit(null);
          }}
        />
      )}

      {/* Modal Pratinjau Foto Bukti Dukung */}
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
                <span className="material-symbols-outlined text-base text-rose-400">image</span>
                Foto Bukti Temuan / Permasalahan
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
                alt="Bukti Temuan"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

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
