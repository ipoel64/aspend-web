'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  KpmKeluarga,
  isKpmDataLengkap,
  getKpmCompletenessDetails,
  formatIndonesianPhone,
} from '@/lib/kpm-constants';
import KpmFormModal from './KpmFormModal';
import KpmAnggotaModal from './KpmAnggotaModal';
import KpmAsetModal from './KpmAsetModal';
import KpmGraduasiModal from './KpmGraduasiModal';
import KpmPermasalahanModal from './KpmPermasalahanModal';
import KpmFullProfileModal from './KpmFullProfileModal';
import KpmShareLinkModal from './KpmShareLinkModal';
import KpmImportModal from './KpmImportModal';
import KpmImportPhotoModal from './KpmImportPhotoModal';
import KpmAbsensiModal from './KpmAbsensiModal';

interface KpmTableViewProps {
  onDataChange?: () => void;
  onNavigateHome?: () => void;
  onNavigateToKpmDashboard?: () => void;
}

export default function KpmTableView({
  onDataChange,
  onNavigateHome,
  onNavigateToKpmDashboard,
}: KpmTableViewProps) {
  const [dataList, setDataList] = useState<KpmKeluarga[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelompok, setSelectedKelompok] = useState('');
  const [selectedStatusKelompok, setSelectedStatusKelompok] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTahapFilter, setSelectedTahapFilter] = useState('');
  const [selectedKepesertaanFilter, setSelectedKepesertaanFilter] = useState('');
  const [duplicateFilterMode, setDuplicateFilterMode] = useState<'none' | 'kpm' | 'anggota'>('none');
  const showOnlyDuplicates = duplicateFilterMode !== 'none';
  const setShowOnlyDuplicates = (val: boolean) => setDuplicateFilterMode(val ? 'kpm' : 'none');
  const [showOnlyCatatan, setShowOnlyCatatan] = useState(false);
  const [popupCatatanKpm, setPopupCatatanKpm] = useState<KpmKeluarga | null>(null);

  // Salin ke Clipboard
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<KpmKeluarga | null>(null);

  const [isAnggotaModalOpen, setIsAnggotaModalOpen] = useState(false);
  const [isAsetModalOpen, setIsAsetModalOpen] = useState(false);
  const [isGraduasiModalOpen, setIsGraduasiModalOpen] = useState(false);
  const [isPermasalahanModalOpen, setIsPermasalahanModalOpen] = useState(false);
  const [isFullProfileModalOpen, setIsFullProfileModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportPhotoModalOpen, setIsImportPhotoModalOpen] = useState(false);
  const [importPhotoCategory, setImportPhotoCategory] = useState<'dokumen' | 'rumah'>('dokumen');
  const [isAbsensiModalOpen, setIsAbsensiModalOpen] = useState(false);

  const [activeKeluarga, setActiveKeluarga] = useState<KpmKeluarga | null>(null);
  const [actionModalKpm, setActionModalKpm] = useState<KpmKeluarga | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  // Delete confirmation modal
  const [deletingKpm, setDeletingKpm] = useState<KpmKeluarga | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Clear all data modal states
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState('');

  // Fetch KPM data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/kpm');
      const json = await res.json();
      if (json.data) {
        setDataList(json.data);
      }
    } catch (err) {
      console.error('Error fetching KPM list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter kelompok options
  const kelompokOptions = useMemo(() => {
    const set = new Set<string>();
    dataList.forEach((k) => {
      if (k.Kelompok?.trim()) set.add(k.Kelompok.trim());
    });
    return Array.from(set);
  }, [dataList]);

  // Analisis Duplikasi NIK dan No. KK KPM serta NIK Anggota (Hanya hitung nilai 16 digit valid, abaikan string ilmiah)
  const duplicateInfo = useMemo(() => {
    const kpmNikCounts = new Map<string, number>();
    const kpmKKCounts = new Map<string, number>();

    for (const k of dataList) {
      const nik = (k.NIK || '').trim();
      const kk = (k.NoKK || '').trim();
      const isNikValid = nik && nik.length === 16 && !/e[+-]?\d+/i.test(nik) && !nik.endsWith('00000000');
      const isKKValid = kk && kk.length === 16 && !/e[+-]?\d+/i.test(kk) && !kk.endsWith('00000000');
      if (isNikValid) {
        kpmNikCounts.set(nik, (kpmNikCounts.get(nik) || 0) + 1);
      }
      if (isKKValid) {
        kpmKKCounts.set(kk, (kpmKKCounts.get(kk) || 0) + 1);
      }
    }

    let totalKpmDup = 0;
    let totalAnggotaDup = 0;

    for (const k of dataList) {
      const nik = (k.NIK || '').trim();
      const kk = (k.NoKK || '').trim();
      const isDupNik = nik && (kpmNikCounts.get(nik) || 0) > 1;
      const isDupKK = kk && (kpmKKCounts.get(kk) || 0) > 1;
      const isDupKpm = isDupNik || isDupKK || Boolean(k.IsDuplicateNik) || Boolean(k.IsDuplicateKK);
      if (isDupKpm) totalKpmDup++;
      if (k.HasDuplicateAnggotaNik) totalAnggotaDup++;
    }

    return {
      kpmNikCounts,
      kpmKKCounts,
      totalKpmDup,
      totalAnggotaDup,
      totalAnyDuplicates: totalKpmDup + totalAnggotaDup,
    };
  }, [dataList]);

  // Statistik KPM (Total, Aktif, Tidak Aktif/Graduasi, Bermasalah/Catatan)
  const statsOverview = useMemo(() => {
    let aktif = 0;
    let tidakAktif = 0;
    let catatan = 0;
    for (const k of dataList) {
      const isGradOrInactive =
        k.StatusKepesertaan === 'Graduasi' ||
        k.StatusKepesertaan === 'Tidak Aktif' ||
        k.StatusGraduasi === 'Sudah Graduasi' ||
        k.StatusGraduasi === 'Graduasi Mandiri' ||
        k.StatusGraduasi === 'Graduasi Alami' ||
        k.CatatanTemuan?.includes('Sudah Graduasi');

      if (isGradOrInactive) {
        tidakAktif++;
      } else {
        aktif++;
      }

      if (k.CatatanTemuan && k.CatatanTemuan !== '[]' && k.CatatanTemuan.trim() !== '') {
        catatan++;
      }
    }
    return {
      total: dataList.length,
      aktif,
      tidakAktif,
      catatan,
    };
  }, [dataList]);

  // Filtered and Sorted list (Kelompok ASC -> Ketua Kelompok -> NamaPengurus ASC)
  const filteredData = useMemo(() => {
    const list = dataList.filter((item) => {
      const matchSearch =
        !searchQuery ||
        item.NIK?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.NoKK?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.NamaPengurus?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.Alamat?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.Lingkungan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.Kelurahan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.Kecamatan?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchKelompok = !selectedKelompok || item.Kelompok === selectedKelompok;
      const matchStatusKelompok = !selectedStatusKelompok || item.StatusKelompok === selectedStatusKelompok;

      let matchStatus = true;
      if (selectedStatus === 'Lengkap') {
        const isKpmComplete = item.IsKpmLengkap !== undefined ? item.IsKpmLengkap : isKpmDataLengkap(item);
        const isAnggotaComplete = item.IsAnggotaLengkap !== undefined ? item.IsAnggotaLengkap : (item.AnggotaCount || 0) >= 1;
        const isAsetComplete = item.IsAsetLengkap !== undefined ? item.IsAsetLengkap : Boolean(item.HasAset);
        matchStatus = isKpmComplete && isAnggotaComplete && isAsetComplete;
      } else if (selectedStatus === 'Belum Lengkap') {
        const isKpmComplete = item.IsKpmLengkap !== undefined ? item.IsKpmLengkap : isKpmDataLengkap(item);
        const isAnggotaComplete = item.IsAnggotaLengkap !== undefined ? item.IsAnggotaLengkap : (item.AnggotaCount || 0) >= 1;
        const isAsetComplete = item.IsAsetLengkap !== undefined ? item.IsAsetLengkap : Boolean(item.HasAset);
        matchStatus = !(isKpmComplete && isAnggotaComplete && isAsetComplete);
      } else if (selectedStatus) {
        matchStatus = item.StatusData === selectedStatus;
      }

      // Filter Tahap Bansos
      let matchTahap = true;
      if (selectedTahapFilter) {
        const itemTahap = (item.TahapBansos || 'Tahap 1').toLowerCase();
        const stageNum = selectedTahapFilter.replace(/\D/g, '');
        matchTahap =
          itemTahap.includes(selectedTahapFilter.toLowerCase()) ||
          Boolean(stageNum && (itemTahap.includes(`tahap ${stageNum}`) || itemTahap.includes(`thp-${stageNum}`) || itemTahap.includes(`t${stageNum}`)));
      }

      // Filter Status Kepesertaan
      let matchKepesertaan = true;
      const isGradOrInactive =
        item.StatusKepesertaan === 'Graduasi' ||
        item.StatusKepesertaan === 'Tidak Aktif' ||
        item.StatusGraduasi === 'Sudah Graduasi' ||
        item.StatusGraduasi === 'Graduasi Mandiri' ||
        item.StatusGraduasi === 'Graduasi Alami' ||
        item.CatatanTemuan?.includes('Sudah Graduasi');

      if (selectedKepesertaanFilter === 'Aktif') {
        matchKepesertaan = !isGradOrInactive;
      } else if (selectedKepesertaanFilter === 'Tidak Aktif') {
        matchKepesertaan = isGradOrInactive;
      }

      let matchDuplicate = true;
      if (duplicateFilterMode === 'kpm') {
        const cleanNik = (item.NIK || '').trim();
        const cleanKK = (item.NoKK || '').trim();
        const isDupNik = cleanNik && (duplicateInfo.kpmNikCounts.get(cleanNik) || 0) > 1;
        const isDupKK = cleanKK && (duplicateInfo.kpmKKCounts.get(cleanKK) || 0) > 1;
        matchDuplicate = Boolean(isDupNik || isDupKK || item.IsDuplicateNik || item.IsDuplicateKK);
      } else if (duplicateFilterMode === 'anggota') {
        matchDuplicate = Boolean(item.HasDuplicateAnggotaNik);
      }

      let matchCatatan = true;
      if (showOnlyCatatan) {
        matchCatatan = Boolean(item.CatatanTemuan && item.CatatanTemuan !== '[]' && item.CatatanTemuan.trim() !== '');
      }

      return matchSearch && matchKelompok && matchStatusKelompok && matchStatus && matchTahap && matchKepesertaan && matchDuplicate && matchCatatan;
    });

    // Urutkan:
    // 1. Kelompok (natural sort alfabetis, tanpa kelompok ditaruh paling bawah)
    // 2. Ketua Kelompok selalu di posisi teratas dalam kelompoknya
    // 3. Nama Pengurus alfabetis (A-Z)
    return list.sort((a, b) => {
      const kelA = (a.Kelompok || '').trim();
      const kelB = (b.Kelompok || '').trim();

      if (!kelA && kelB) return 1;
      if (kelA && !kelB) return -1;
      if (kelA !== kelB) {
        return kelA.localeCompare(kelB, undefined, { numeric: true, sensitivity: 'base' });
      }

      // Dalam kelompok yang sama, Ketua Kelompok di urutan pertama
      const isKetuaA = a.StatusKelompok === 'Ketua Kelompok' ? 0 : 1;
      const isKetuaB = b.StatusKelompok === 'Ketua Kelompok' ? 0 : 1;
      if (isKetuaA !== isKetuaB) {
        return isKetuaA - isKetuaB;
      }

      // Jika status sama, urutkan berdasarkan Nama Pengurus
      return (a.NamaPengurus || '').localeCompare(b.NamaPengurus || '', undefined, { sensitivity: 'base' });
    });
  }, [dataList, searchQuery, selectedKelompok, selectedStatusKelompok, selectedStatus, selectedTahapFilter, selectedKepesertaanFilter, duplicateFilterMode, showOnlyCatatan, duplicateInfo]);

  // Ringkasan jumlah KPM per kelompok (untuk header kelompok: Total, Aktif, Tidak Aktif)
  const kelompokSummaryMap = useMemo(() => {
    const map: Record<string, { total: number; aktif: number; tidakAktif: number }> = {};
    for (const item of filteredData) {
      const k = (item.Kelompok || '').trim();
      if (!map[k]) {
        map[k] = { total: 0, aktif: 0, tidakAktif: 0 };
      }
      map[k].total += 1;
      const isGradOrInactive =
        item.StatusKepesertaan === 'Graduasi' ||
        item.StatusKepesertaan === 'Tidak Aktif' ||
        item.StatusGraduasi === 'Sudah Graduasi' ||
        item.StatusGraduasi === 'Graduasi Mandiri' ||
        item.StatusGraduasi === 'Graduasi Alami' ||
        item.CatatanTemuan?.includes('Sudah Graduasi');
      if (isGradOrInactive) {
        map[k].tidakAktif += 1;
      } else {
        map[k].aktif += 1;
      }
    }
    return map;
  }, [filteredData]);

  // Paginated list
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleDelete = async () => {
    if (!deletingKpm) return;
    setIsDeleting(true);
    try {
      const kpmIdParam = encodeURIComponent(deletingKpm.KpmId || '');
      const nikParam = encodeURIComponent(deletingKpm.NIK || '');
      const noKKParam = encodeURIComponent(deletingKpm.NoKK || '');
      const res = await fetch(`/api/kpm?kpmId=${kpmIdParam}&nik=${nikParam}&noKK=${noKKParam}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus');
      }
      setDeletingKpm(null);
      fetchData();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllData = async () => {
    if (clearAllConfirmText.trim().toUpperCase() !== 'HAPUS') return;
    setIsClearingAll(true);
    try {
      const res = await fetch('/api/kpm?clearAll=true', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menghapus seluruh data');
      }
      alert(json.message || 'Seluruh data KPM PKH berhasil dibersihkan!');
      setIsClearAllModalOpen(false);
      setClearAllConfirmText('');
      setDataList([]);
      if (onDataChange) onDataChange();
      fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsClearingAll(false);
    }
  };
  const [isScientificBannerDismissed, setIsScientificBannerDismissed] = useState(false);

  // Deteksi jumlah data yang benar-benar memiliki NIK atau No. KK berformat notasi ilmiah (e+, e-)
  const scientificDataCount = useMemo(() => {
    return dataList.filter((k) => {
      const nik = (k.NIK || '').trim();
      const kk = (k.NoKK || '').trim();
      const isNikBad = /e[+-]?\d+/i.test(nik) || Boolean(k.IsScientificNik);
      const isKKBad = /e[+-]?\d+/i.test(kk) || Boolean(k.IsScientificKK);
      return isNikBad || isKKBad;
    }).length;
  }, [dataList]);

  const [isRepairingScientific, setIsRepairingScientific] = useState(false);

  const handleRepairScientific = async () => {
    if (
      !confirm(
        `Ditemukan ${scientificDataCount} data NIK/No. KK yang terindikasi berformat ilmiah. Sistem akan memulihkan 16 digit angka asli dari Google Sheets & sinkronisasi data anggota. Lanjutkan?`
      )
    ) {
      return;
    }
    setIsRepairingScientific(true);
    try {
      const res = await fetch('/api/kpm?action=repair-scientific', { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memulihkan format NIK/KK');
      alert(json.message || 'Format NIK/No. KK berhasil dipulihkan!');
      setIsScientificBannerDismissed(true);
      fetchData();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsRepairingScientific(false);
    }
  };

  const [isDeduplicating, setIsDeduplicating] = useState(false);

  const handleDeduplicateKpm = async () => {
    if (
      !confirm(
        `Sistem akan memeriksa seluruh ${dataList.length} data KPM, mempertahankan baris yang paling lengkap (termasuk status Ketua Kelompok), menggabungkan seluruh riwayat tahap bansos & dokumen, lalu menghapus baris duplikat dari Google Sheets. Lanjutkan?`
      )
    ) {
      return;
    }
    setIsDeduplicating(true);
    try {
      const res = await fetch('/api/kpm?action=deduplicate', { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membersihkan duplikat');
      alert(json.message || 'Data duplikat berhasil dibersihkan!');
      setDuplicateFilterMode('none');
      fetchData();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsDeduplicating(false);
    }
  };

  const [isDeduplicatingAnggota, setIsDeduplicatingAnggota] = useState(false);

  const handleDeduplicateAnggota = async () => {
    if (
      !confirm(
        `Sistem akan memeriksa seluruh data anggota keluarga di sheet KPM_Anggota, mempertahankan data anggota yang paling lengkap, dan menghapus baris anggota duplikat dari Google Sheets. Lanjutkan?`
      )
    ) {
      return;
    }
    setIsDeduplicatingAnggota(true);
    try {
      const res = await fetch('/api/kpm?action=deduplicate-anggota', { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membersihkan anggota duplikat');
      alert(json.message || 'Data anggota duplikat berhasil dibersihkan!');
      setDuplicateFilterMode('none');
      fetchData();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsDeduplicatingAnggota(false);
    }
  };

  const handleOpenEdit = (kpm: KpmKeluarga) => {
    setSelectedForEdit(kpm);
    setIsFormModalOpen(true);
  };

  const handleOpenAdd = () => {
    setSelectedForEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenFullProfile = (kpm: KpmKeluarga) => {
    setActiveKeluarga(kpm);
    setIsFullProfileModalOpen(true);
  };

  const isAnyFilterActive = Boolean(
    searchQuery ||
    selectedKelompok ||
    selectedStatusKelompok ||
    selectedStatus ||
    selectedTahapFilter ||
    selectedKepesertaanFilter ||
    showOnlyDuplicates ||
    showOnlyCatatan
  );

  return (
    <div className="space-y-4">
      {/* Top Header & Actions Bar */}
      {/* Top Header & Actions Bar (1 Baris Hemat Tempat) */}
      <div className="bg-white rounded-2xl border border-gray-200 px-4 py-2.5 shadow-xs flex items-center justify-between gap-3 flex-nowrap overflow-x-auto">
        <div className="flex items-center gap-2.5 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-[#1A1D21] font-['Outfit'] flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <span className="material-symbols-outlined text-cyan-600 text-xl">family_restroom</span>
            Data KPM PKH
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Filter Total: klik untuk reset filter */}
            <button
              type="button"
              onClick={() => {
                setSelectedKepesertaanFilter('');
                setShowOnlyCatatan(false);
                setDuplicateFilterMode('none');
                setCurrentPage(1);
              }}
              className={`px-2 py-0.5 rounded-full text-[11px] font-black flex items-center gap-1 shadow-2xs whitespace-nowrap cursor-pointer transition-all ${
                !selectedKepesertaanFilter && !showOnlyCatatan && duplicateFilterMode === 'none'
                  ? 'bg-cyan-600 text-white border border-cyan-700 ring-2 ring-cyan-200'
                  : 'bg-cyan-50 text-cyan-900 border border-cyan-300 hover:bg-cyan-100'
              }`}
              title="Klik untuk menampilkan seluruh KPM (Reset filter status & catatan)"
            >
              <span className="material-symbols-outlined text-[13px]">groups</span>
              Total: {statsOverview.total}
            </button>

            {/* Filter KPM Aktif */}
            <button
              type="button"
              onClick={() => {
                setSelectedKepesertaanFilter(selectedKepesertaanFilter === 'Aktif' ? '' : 'Aktif');
                setShowOnlyCatatan(false);
                setCurrentPage(1);
              }}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-2xs whitespace-nowrap cursor-pointer transition-all ${
                selectedKepesertaanFilter === 'Aktif'
                  ? 'bg-emerald-600 text-white border border-emerald-700 ring-2 ring-emerald-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
              }`}
              title="Klik untuk memfilter data KPM Aktif saja"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${selectedKepesertaanFilter === 'Aktif' ? 'bg-white' : 'bg-emerald-500'}`}></span>
              Aktif: {statsOverview.aktif}
            </button>

            {/* Filter KPM Non-Aktif / Graduasi */}
            <button
              type="button"
              onClick={() => {
                setSelectedKepesertaanFilter(selectedKepesertaanFilter === 'Tidak Aktif' ? '' : 'Tidak Aktif');
                setShowOnlyCatatan(false);
                setCurrentPage(1);
              }}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-2xs whitespace-nowrap cursor-pointer transition-all ${
                selectedKepesertaanFilter === 'Tidak Aktif'
                  ? 'bg-purple-600 text-white border border-purple-700 ring-2 ring-purple-200'
                  : statsOverview.tidakAktif > 0
                  ? 'bg-purple-100 text-purple-900 border border-purple-300 hover:bg-purple-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
              }`}
              title="Klik untuk memfilter data KPM Non-Aktif / Graduasi saja"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  selectedKepesertaanFilter === 'Tidak Aktif' ? 'bg-white' : statsOverview.tidakAktif > 0 ? 'bg-purple-600' : 'bg-slate-400'
                }`}
              ></span>
              Non-Aktif: {statsOverview.tidakAktif}
            </button>

            {/* Filter KPM yang Memiliki Catatan Temuan */}
            {statsOverview.catatan > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowOnlyCatatan(!showOnlyCatatan);
                  setSelectedKepesertaanFilter('');
                  setCurrentPage(1);
                }}
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-2xs whitespace-nowrap cursor-pointer transition-all ${
                  showOnlyCatatan
                    ? 'bg-amber-600 text-white border border-amber-700 ring-2 ring-amber-200'
                    : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                }`}
                title="Klik untuk memfilter data KPM yang memiliki catatan temuan"
              >
                <span className={`material-symbols-outlined text-[13px] ${showOnlyCatatan ? 'text-white' : 'text-amber-600'}`}>report</span>
                Catatan: {statsOverview.catatan}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Badge & Tombol KPM Ganda (Hanya jika kepala keluarga ada yang ganda) */}
          {duplicateInfo.totalKpmDup > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setDuplicateFilterMode(duplicateFilterMode === 'kpm' ? 'none' : 'kpm');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border shadow-xs whitespace-nowrap ${
                  duplicateFilterMode === 'kpm'
                    ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700 shadow-rose-200'
                    : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                }`}
                title="Filter tabel untuk hanya menampilkan data KPM yang NIK/KK kepalanya ganda"
              >
                <span className="material-symbols-outlined text-[14px] text-rose-600">warning</span>
                <span>
                  {duplicateFilterMode === 'kpm'
                    ? 'Semua Data'
                    : `${duplicateInfo.totalKpmDup} KPM Ganda`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDeduplicateKpm}
                disabled={isDeduplicating}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                title="Bersihkan seluruh data KPM duplikat di Google Sheets secara otomatis"
              >
                {isDeduplicating ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">cleaning_services</span>
                )}
                <span className="hidden sm:inline">Bersihkan KPM</span>
              </button>
            </div>
          )}

          {/* Badge & Tombol ART Ganda (Jika ada anggota keluarga yang NIK-nya ganda di sheet KPM_Anggota) */}
          {duplicateInfo.totalAnggotaDup > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setDuplicateFilterMode(duplicateFilterMode === 'anggota' ? 'none' : 'anggota');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border shadow-xs whitespace-nowrap ${
                  duplicateFilterMode === 'anggota'
                    ? 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700 shadow-amber-200'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
                title="Filter tabel untuk melihat KPM yang memiliki NIK Anggota (ART) ganda di database Google Sheets"
              >
                <span className="material-symbols-outlined text-[14px] text-amber-600">group</span>
                <span>
                  {duplicateFilterMode === 'anggota'
                    ? 'Semua Data'
                    : `${duplicateInfo.totalAnggotaDup} Ada ART Ganda`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDeduplicateAnggota}
                disabled={isDeduplicatingAnggota}
                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                title="Bersihkan baris anggota keluarga (ART) yang terdaftar ganda di sheet KPM_Anggota Google Sheets"
              >
                {isDeduplicatingAnggota ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">cleaning_services</span>
                )}
                <span className="hidden sm:inline">Bersihkan ART Ganda</span>
              </button>
            </div>
          )}
          <button
            onClick={() => setIsAbsensiModalOpen(true)}
            className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap"
            title="Cetak Lembar Presensi / Absensi Pertemuan P2K2 Resmi"
          >
            <span className="material-symbols-outlined text-[15px] text-indigo-600">print</span>
            <span>Cetak Absensi</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3 py-1.5 bg-gradient-to-r from-[#005B94] to-[#00838F] hover:from-[#004b7a] hover:to-[#006f7a] text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[15px]">person_add</span>
            <span>Tambah KPM</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap"
            title="Impor Data KPM dari Excel"
          >
            <span className="material-symbols-outlined text-[15px] text-teal-600">upload_file</span>
            <span>Impor</span>
          </button>
          <a
            href="/api/kpm/export?type=excel-all"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap"
            title="Ekspor Seluruh Data KPM ke Excel"
          >
            <span className="material-symbols-outlined text-[15px] text-emerald-600">file_download</span>
            <span>Ekspor</span>
          </a>
          <button
            onClick={() => {
              setClearAllConfirmText('');
              setIsClearAllModalOpen(true);
            }}
            className="p-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl transition-all flex items-center justify-center shadow-xs cursor-pointer shrink-0"
            title="Hapus Bersih Seluruh Data KPM PKH"
          >
            <span className="material-symbols-outlined text-[17px] text-rose-600">delete</span>
          </button>
        </div>
      </div>


      {/* Notice Banner jika ada NIK/No. KK yang berformat notasi ilmiah (misal 1,27503E+15) */}
      {!isScientificBannerDismissed && scientificDataCount > 0 && (
        <div className="bg-sky-50 border border-sky-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <span className="material-symbols-outlined text-sky-600 text-2xl shrink-0 mt-0.5 sm:mt-0">auto_fix_high</span>
            <div>
              <p className="text-xs font-bold text-sky-950">
                Format NIK / No. KK Ilmiah Terdeteksi ({scientificDataCount} Data)
              </p>
              <p className="text-[11px] text-sky-800 mt-0.5">
                Ditemukan nomor NIK atau No. KK yang tampil dalam format ilmiah (seperti 1,27503E+15). Klik tombol di samping untuk memulihkan 16 digit angka asli dan mengunci format teks murni di Google Sheets.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRepairScientific}
              disabled={isRepairingScientific}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">build_circle</span>
              <span>{isRepairingScientific ? 'Memulihkan...' : 'Perbaiki Format Sekarang'}</span>
            </button>
            <button
              onClick={() => setIsScientificBannerDismissed(true)}
              className="p-1.5 hover:bg-sky-200/70 text-sky-700 hover:text-sky-950 rounded-lg transition-colors cursor-pointer"
              title="Sembunyikan pemberitahuan ini"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Notice Banner jika ada Data KPM Duplikat */}
      {duplicateInfo.totalKpmDup > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <span className="material-symbols-outlined text-rose-600 text-2xl shrink-0 mt-0.5 sm:mt-0">warning</span>
            <div>
              <p className="text-xs font-bold text-rose-950">
                Terdeteksi Data KPM Duplikat ({duplicateInfo.totalKpmDup} Baris Teridentifikasi)
              </p>
              <p className="text-[11px] text-rose-800 mt-0.5">
                Terdapat baris data keluarga dengan NIK atau No. KK ganda di database. Klik tombol di samping untuk otomatis menggabungkan riwayat bansos & dokumen, lalu menghapus baris ganda dari Google Sheets.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDeduplicateKpm}
              disabled={isDeduplicating}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isDeduplicating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Membersihkan...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">cleaning_services</span>
                  <span>Bersihkan Duplikat Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Notice Banner jika filter ART Duplikat sedang aktif */}
      {duplicateFilterMode === 'anggota' && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <span className="material-symbols-outlined text-amber-600 text-2xl shrink-0 mt-0.5 sm:mt-0">info</span>
            <div>
              <p className="text-xs font-bold text-amber-950">
                Filter Aktif: Menampilkan {duplicateInfo.totalAnggotaDup} KPM dengan NIK Anggota (ART) Ganda di Database
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                <strong>Catatan Penting:</strong> Seluruh {duplicateInfo.totalAnggotaDup} keluarga KPM ini <strong>100% unik (bukan KPM kembar)</strong>. Duplikasi terjadi pada baris data anggota keluarga di sheet <code>KPM_Anggota</code> (misal tersimpan dua kali saat pengisian mandiri). Klik tombol di samping untuk otomatis membersihkan baris anggota kembar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDeduplicateAnggota}
              disabled={isDeduplicatingAnggota}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isDeduplicatingAnggota ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Membersihkan...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">cleaning_services</span>
                  <span>Bersihkan ART Ganda Sekarang</span>
                </>
              )}
            </button>
            <button
              onClick={() => setDuplicateFilterMode('none')}
              className="px-2.5 py-1.5 text-xs text-amber-800 hover:text-amber-950 font-bold hover:underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Filter & Search Bar (1 Baris Penuh, Ringkas & Pas di 100% Zoom) */}
      <div className="bg-white rounded-2xl border border-gray-200 px-3 py-2 shadow-xs">
        <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto">
          {/* Field Pencarian Ringkas */}
          <div className="relative w-28 sm:w-32 lg:w-36 shrink-0">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[14px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari NIK, KK..."
              className="w-full pl-6 pr-5 py-1 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-cyan-500 outline-none bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={selectedKelompok}
            onChange={(e) => {
              setSelectedKelompok(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-cyan-500 outline-none bg-white cursor-pointer shrink-0 max-w-[130px]"
          >
            <option value="">Semua Kelompok</option>
            {kelompokOptions.map((kel) => (
              <option key={kel} value={kel}>
                {kel}
              </option>
            ))}
          </select>

          <select
            value={selectedStatusKelompok}
            onChange={(e) => {
              setSelectedStatusKelompok(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-cyan-500 outline-none bg-white cursor-pointer shrink-0"
          >
            <option value="">Peran: Semua</option>
            <option value="Ketua Kelompok">⭐ Ketua</option>
            <option value="Anggota">👤 Anggota</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-cyan-500 outline-none bg-white cursor-pointer shrink-0"
          >
            <option value="">Data: Semua</option>
            <option value="Lengkap">✅ Lengkap</option>
            <option value="Belum Lengkap">⏳ Belum Lengkap</option>
            <option value="Verifikasi">🔍 Verifikasi</option>
          </select>

          <select
            value={selectedTahapFilter}
            onChange={(e) => {
              setSelectedTahapFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-cyan-500 outline-none bg-white cursor-pointer shrink-0"
          >
            <option value="">Tahap: Semua</option>
            <option value="Tahap 1">Thp-1 (2026)</option>
            <option value="Tahap 2">Thp-2 (2026)</option>
            <option value="Tahap 3">Thp-3 (2026)</option>
            <option value="Tahap 4">Thp-4 (2026)</option>
          </select>

          <select
            value={selectedKepesertaanFilter}
            onChange={(e) => {
              setSelectedKepesertaanFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-cyan-500 outline-none bg-white cursor-pointer shrink-0"
          >
            <option value="">Status: Semua</option>
            <option value="Aktif">🟢 Aktif</option>
            <option value="Tidak Aktif">⚪ Non-Aktif / Graduasi</option>
          </select>

          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedKelompok('');
              setSelectedStatusKelompok('');
              setSelectedStatus('');
              setSelectedTahapFilter('');
              setSelectedKepesertaanFilter('');
              setShowOnlyDuplicates(false);
              setCurrentPage(1);
            }}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              isAnyFilterActive
                ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 shadow-xs font-bold active:scale-95'
                : 'border border-gray-300 hover:bg-gray-100 text-gray-600'
            }`}
            title="Reset Filter"
          >
            Reset
          </button>

          {/* Angka Hasil Filter Cukup Angka Saja yang Mencolok & Ukuran Sedikit Besar */}
          <div
            className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-xl shadow-xs"
            title={`Total ${filteredData.length} KPM ditemukan`}
          >
            <span className="material-symbols-outlined text-[15px] opacity-85">groups</span>
            <span className="font-black text-sm font-mono tracking-tight leading-none">{filteredData.length}</span>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium">Memuat data KPM dari Google Sheets...</p>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-2">
            <span className="material-symbols-outlined text-5xl">group_off</span>
            <p className="font-bold text-gray-600 text-sm">Tidak ada data KPM ditemukan</p>
            <p className="text-xs text-gray-400">
              {searchQuery || selectedKelompok || selectedStatus
                ? 'Coba ubah kata kunci atau reset filter pencarian'
                : 'Mulai dengan menambahkan data KPM baru'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[360px]">
            <table className="w-full text-left border-collapse">
              <colgroup>
                <col className="w-9" />
                <col className="min-w-[130px]" />
                <col className="min-w-[140px]" />
                <col className="min-w-[115px]" />
                <col className="min-w-[115px]" />
                <col className="min-w-[85px]" />
                <col className="min-w-[95px]" />
                <col className="min-w-[160px]" />
              </colgroup>
              <tbody className="divide-y divide-slate-300 text-xs">
                {paginatedData.map((kpm, idx) => {
                  const absoluteIndex = (currentPage - 1) * pageSize + idx + 1;
                  const prevKpm = idx > 0 ? paginatedData[idx - 1] : null;
                  const isNewGroup = !prevKpm || (kpm.Kelompok || '').trim() !== (prevKpm.Kelompok || '').trim();

                  const cleanNik = (kpm.NIK || '').trim();
                  const cleanKK = (kpm.NoKK || '').trim();
                  const nikDupCount = cleanNik ? (duplicateInfo.kpmNikCounts.get(cleanNik) || 1) : 1;
                  const kkDupCount = cleanKK ? (duplicateInfo.kpmKKCounts.get(cleanKK) || 1) : 1;
                  const isDupNik = nikDupCount > 1 || Boolean(kpm.IsDuplicateNik);
                  const isDupKK = kkDupCount > 1 || Boolean(kpm.IsDuplicateKK);
                  const hasDupAnggota = Boolean(kpm.HasDuplicateAnggotaNik);

                  const isGraduasi =
                    kpm.StatusKepesertaan === 'Graduasi' ||
                    kpm.StatusGraduasi === 'Sudah Graduasi' ||
                    kpm.StatusGraduasi === 'Graduasi Mandiri' ||
                    kpm.StatusGraduasi === 'Graduasi Alami' ||
                    kpm.CatatanTemuan?.includes('Sudah Graduasi');
                  const isGraduasiOrInactive = isGraduasi || kpm.StatusKepesertaan === 'Tidak Aktif';
                  const rowActionId = kpm.KpmId || kpm.NIK || kpm.NoKK || `kpm-${idx}`;

                  return (
                    <React.Fragment key={`kpm-row-${rowActionId}-${idx}`}>
                      {/* Pembatas / Header Grup Kelompok */}
                      {isNewGroup && (() => {
                        const grpSummary = kelompokSummaryMap[(kpm.Kelompok || '').trim()] || { total: 1, aktif: 1, tidakAktif: 0 };
                        return (
                          <tr
                            key={`grp-hdr-${kpm.Kelompok || 'tanpa-kelompok'}-${currentPage}-${idx}`}
                            className="bg-slate-100/95 border-t-2 border-b border-slate-300 select-none"
                          >
                            <td colSpan={8} className="px-3 py-2 bg-gradient-to-r from-slate-100 via-sky-50/70 to-white">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="material-symbols-outlined text-cyan-700 text-lg">groups</span>
                                  <span className="font-bold text-slate-800 text-xs tracking-wider uppercase">
                                    {kpm.Kelompok ? `Kelompok: ${kpm.Kelompok}` : 'Tanpa Kelompok'}
                                  </span>
                                  <span className="text-[10px] text-cyan-900 bg-cyan-100/90 border border-cyan-200 font-bold px-2 py-0.5 rounded-full">
                                    {grpSummary.total} KPM Terdaftar
                                  </span>
                                  <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Aktif: {grpSummary.aktif}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border shadow-2xs ${
                                    grpSummary.tidakAktif > 0
                                      ? 'text-purple-900 bg-purple-100 border-purple-300'
                                      : 'text-slate-600 bg-slate-100 border-slate-300'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${grpSummary.tidakAktif > 0 ? 'bg-purple-600' : 'bg-slate-400'}`}></span>
                                    Tidak Aktif: {grpSummary.tidakAktif}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })()}

                      <tr
                        className={`transition-all border-b border-slate-300 ${
                          isGraduasiOrInactive
                            ? 'bg-slate-100/80 text-slate-400 opacity-60 border-l-4 border-l-slate-400 hover:bg-slate-100'
                            : isDupNik || isDupKK
                            ? 'bg-rose-50/40 hover:bg-rose-100/50 border-l-4 border-l-rose-500'
                            : hasDupAnggota
                            ? 'bg-amber-50/40 hover:bg-amber-100/50 border-l-4 border-l-amber-500'
                            : 'hover:bg-cyan-50/30'
                        }`}
                      >
                        <td className="px-2 py-2.5 text-center font-mono text-gray-500 font-medium">
                          {absoluteIndex}
                        </td>

                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-3">
                            {/* Thumbnail Foto Rumah / KTP (Ukuran Lebih Besar & Bisa di-Preview Saat Diklik) */}
                            {(() => {
                              const housePhotoId = kpm.FotoRumah || kpm.FotoRumahLuar || kpm.FotoRumahDalam || kpm.FotoKTP;
                              const hasPhoto = Boolean(housePhotoId);
                              const photoLabel = kpm.FotoRumah || kpm.FotoRumahLuar || kpm.FotoRumahDalam
                                ? `Foto Rumah: ${kpm.NamaPengurus}`
                                : `Foto KTP: ${kpm.NamaPengurus}`;
                              return (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (hasPhoto) {
                                      setPreviewPhoto({
                                        url: `/api/image-proxy?id=${housePhotoId}`,
                                        title: photoLabel,
                                        subtitle: `NIK: ${kpm.NIK || '—'} • KK: ${kpm.NoKK || '—'} • ${kpm.Kelompok ? `Kelompok ${kpm.Kelompok}` : ''}`,
                                      });
                                    } else {
                                      handleOpenFullProfile(kpm);
                                    }
                                  }}
                                  className={`relative group/thumb w-12 h-12 rounded-xl overflow-hidden border border-gray-200 bg-cyan-100 flex items-center justify-center font-bold text-cyan-800 shrink-0 text-base shadow-xs cursor-pointer hover:border-cyan-400 hover:shadow-md transition-all ${
                                    isGraduasiOrInactive ? 'grayscale opacity-60' : ''
                                  }`}
                                  title={hasPhoto ? 'Klik untuk memperbesar / melihat foto' : 'Klik untuk melihat profil lengkap'}
                                >
                                  {hasPhoto ? (
                                    <>
                                      <img
                                        src={`/api/image-proxy?id=${housePhotoId}`}
                                        alt={kpm.NamaPengurus}
                                        className="w-full h-full object-cover transition-transform duration-200 group-hover/thumb:scale-110"
                                      />
                                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined text-lg">zoom_in</span>
                                      </div>
                                    </>
                                  ) : (
                                    kpm.NamaPengurus.charAt(0)
                                  )}
                                </div>
                              );
                            })()}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <p
                                  onClick={() => handleOpenFullProfile(kpm)}
                                  className={`font-bold hover:underline cursor-pointer text-xs leading-snug truncate max-w-[125px] ${
                                    isGraduasiOrInactive ? 'text-slate-500 hover:text-slate-700' : 'text-gray-900 hover:text-cyan-700'
                                  }`}
                                  title={kpm.NamaPengurus}
                                >
                                  {kpm.NamaPengurus}
                                </p>
                                {(() => {
                                  const hasCatatan = Boolean(kpm.CatatanTemuan && kpm.CatatanTemuan !== '[]' && kpm.CatatanTemuan.trim() !== '');
                                  if (!hasCatatan) return null;
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPopupCatatanKpm(kpm);
                                      }}
                                      className="p-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors cursor-pointer shrink-0"
                                      title="KPM memiliki catatan/temuan lapangan (Klik untuk melihat)"
                                    >
                                      <span className="material-symbols-outlined text-[13px] text-amber-600 block">report</span>
                                    </button>
                                  );
                                })()}
                              </div>
                              {isGraduasi ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5 bg-slate-200 text-slate-600 border border-slate-300">
                                  <span className="material-symbols-outlined text-[12px] text-slate-500">school</span>
                                  <span>Graduasi</span>
                                </span>
                              ) : isGraduasiOrInactive ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5 bg-slate-200 text-slate-600 border border-slate-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  <span>Non-Aktif</span>
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                                    kpm.StatusKelompok === 'Ketua Kelompok'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {kpm.StatusKelompok === 'Ketua Kelompok' && (
                                    <span className="material-symbols-outlined text-[12px] text-amber-600 shrink-0">star</span>
                                  )}
                                  <span>{kpm.StatusKelompok || 'Anggota'}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-2 py-2 font-mono whitespace-nowrap min-w-[140px]">
                          {/* NIK baris 1 (Klik angka untuk salin) */}
                          <div className="whitespace-nowrap">
                            {kpm.NIK ? (
                              <span
                                onClick={(e) => handleCopy(kpm.NIK, `nik-${kpm.KpmId || idx}`, e)}
                                className={`cursor-pointer font-bold tracking-tight text-xs transition-colors hover:text-cyan-700 hover:underline inline-flex items-center gap-1 ${
                                  copiedKey === `nik-${kpm.KpmId || idx}`
                                    ? 'text-emerald-600 font-extrabold'
                                    : isGraduasiOrInactive
                                    ? 'text-slate-500'
                                    : 'text-gray-900'
                                }`}
                                title={copiedKey === `nik-${kpm.KpmId || idx}` ? 'NIK Berhasil Disalin!' : 'Klik untuk menyalin NIK'}
                              >
                                {kpm.NIK}
                                {copiedKey === `nik-${kpm.KpmId || idx}` && (
                                  <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </div>

                          {/* No. KK baris 2 (Klik angka untuk salin) */}
                          <div className="whitespace-nowrap mt-0.5">
                            {kpm.NoKK ? (
                              <span
                                onClick={(e) => handleCopy(kpm.NoKK, `kk-${kpm.KpmId || idx}`, e)}
                                className={`cursor-pointer text-[11px] transition-colors hover:text-cyan-700 hover:underline inline-flex items-center gap-1 ${
                                  copiedKey === `kk-${kpm.KpmId || idx}`
                                    ? 'text-emerald-600 font-bold'
                                    : isGraduasiOrInactive
                                    ? 'text-slate-400'
                                    : 'text-gray-500'
                                }`}
                                title={copiedKey === `kk-${kpm.KpmId || idx}` ? 'No. KK Berhasil Disalin!' : 'Klik untuk menyalin No. KK'}
                              >
                                KK: {kpm.NoKK}
                                {copiedKey === `kk-${kpm.KpmId || idx}` && (
                                  <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[11px]">KK: —</span>
                            )}
                          </div>
                        </td>

                        <td className="px-2 py-2">
                          <span className={`font-semibold ${isGraduasiOrInactive ? 'text-slate-500' : 'text-gray-800'} text-xs block truncate max-w-[120px]`}>{kpm.Kelompok || '—'}</span>
                          {kpm.NoHP && (
                            <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
                              <span className="material-symbols-outlined text-[13px] text-emerald-600 shrink-0">call</span>
                              <span
                                onClick={(e) => handleCopy(formatIndonesianPhone(kpm.NoHP), `hp-${kpm.KpmId || idx}`, e)}
                                className={`cursor-pointer font-mono text-[11px] transition-colors hover:text-emerald-700 hover:underline inline-flex items-center gap-1 ${
                                  copiedKey === `hp-${kpm.KpmId || idx}`
                                    ? 'text-emerald-600 font-bold'
                                    : isGraduasiOrInactive
                                    ? 'text-slate-400'
                                    : 'text-gray-600'
                                }`}
                                title={copiedKey === `hp-${kpm.KpmId || idx}` ? 'No. Telp Berhasil Disalin!' : 'Klik untuk menyalin No. Telp'}
                              >
                                {formatIndonesianPhone(kpm.NoHP)}
                                {copiedKey === `hp-${kpm.KpmId || idx}` && (
                                  <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                                )}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className={`px-2 py-2 ${isGraduasiOrInactive ? 'text-slate-400' : 'text-gray-600'}`}>
                          <p className={`truncate max-w-[120px] font-bold text-xs ${isGraduasiOrInactive ? 'text-slate-500' : 'text-gray-900'}`}>
                            {kpm.Kelurahan || kpm.Kecamatan || '—'}
                          </p>
                          <p className={`text-[10px] truncate max-w-[120px] ${isGraduasiOrInactive ? 'text-slate-400' : 'text-gray-600'}`}>
                            {kpm.Alamat || '—'}
                          </p>
                        </td>

                        {/* Tahap Bansos (Thp-1 2026, Thp-2 2026, dst) */}
                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          {(() => {
                            const rawTahap = kpm.TahapBansos || 'Tahap 1';
                            const stages = ['Tahap 1', 'Tahap 2', 'Tahap 3', 'Tahap 4'].filter((t) => rawTahap.includes(t));
                            if (stages.length === 0) stages.push('Tahap 1');
                            return (
                              <div className="flex items-center justify-center gap-1 flex-wrap max-w-[95px] mx-auto">
                                {stages.map((stg) => {
                                  const num = stg.replace(/\D/g, '') || '1';
                                  const colorClass =
                                    num === '1'
                                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                                      : num === '2'
                                      ? 'bg-teal-50 text-teal-800 border-teal-300'
                                      : num === '3'
                                      ? 'bg-purple-50 text-purple-800 border-purple-300'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-300';
                                  return (
                                    <span
                                      key={stg}
                                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border leading-none inline-flex items-center gap-0.5 shadow-2xs ${colorClass}`}
                                      title={`Bansos Tahap ${num} Tahun 2026`}
                                    >
                                      <span>Thp-{num}</span>
                                      <span className="text-[8.5px] opacity-75 font-semibold">2026</span>
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Aksi Tunggal Terpadu (Membuka Jendela Pop-up Modal Profesional) */}
                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setActionModalKpm(kpm)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 border border-slate-300 hover:border-cyan-400 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
                            title={`Buka Menu Pilihan Aksi untuk ${kpm.NamaPengurus}`}
                          >
                            <span className="material-symbols-outlined text-[15px] text-cyan-600">settings</span>
                            <span>Aksi</span>
                          </button>
                        </td>

                        {/* KELENGKAPAN DATA (Paling Ujung Kanan) */}
                        <td className="px-2.5 py-2 min-w-[170px]">
                          {(() => {
                            const isKpmComplete = kpm.IsKpmLengkap !== undefined ? kpm.IsKpmLengkap : isKpmDataLengkap(kpm);
                            const anggotaCount = kpm.AnggotaCount || 0;
                            const isAnggotaComplete = kpm.IsAnggotaLengkap !== undefined ? kpm.IsAnggotaLengkap : anggotaCount >= 1;
                            const hasAset = Boolean(kpm.HasAset);
                            const isAsetComplete = kpm.IsAsetLengkap !== undefined ? kpm.IsAsetLengkap : hasAset;

                            let completedPillars = 0;
                            if (isKpmComplete) completedPillars++;
                            if (isAnggotaComplete) completedPillars++;
                            if (isAsetComplete) completedPillars++;

                            const isAllComplete = completedPillars === 3;
                            const progressPercent =
                              kpm.CompletenessPercent !== undefined
                                ? kpm.CompletenessPercent
                                : Math.round((completedPillars / 3) * 100);

                            const details = getKpmCompletenessDetails(kpm, anggotaCount, hasAset);

                            const handleDirectIncomplete = () => {
                              if (!isKpmComplete) {
                                handleOpenEdit(kpm);
                              } else if (!isAnggotaComplete) {
                                setActiveKeluarga(kpm);
                                setIsAnggotaModalOpen(true);
                              } else if (!isAsetComplete) {
                                setActiveKeluarga(kpm);
                                setIsAsetModalOpen(true);
                              } else {
                                handleOpenFullProfile(kpm);
                              }
                            };

                            return (
                              <div className="space-y-1 py-0.5">
                                {/* Progress Bar & Persentase Ringkas */}
                                <div
                                  onClick={handleDirectIncomplete}
                                  className="cursor-pointer group select-none"
                                  title={`Kelengkapan Data: ${completedPillars}/3 Pilar (${progressPercent}%). Klik untuk melengkapi data yang belum lengkap.`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1 leading-none">
                                    <span className="text-[11px] font-bold flex items-center gap-1">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                          isAllComplete
                                            ? 'bg-emerald-500'
                                            : progressPercent >= 60
                                            ? 'bg-amber-500'
                                            : 'bg-rose-500'
                                        }`}
                                      />
                                      <span
                                        className={
                                          isAllComplete
                                            ? 'text-emerald-700 font-bold'
                                            : 'text-gray-700 font-bold'
                                        }
                                      >
                                        {isAllComplete ? 'Lengkap' : `${progressPercent}%`}
                                      </span>
                                    </span>
                                    <span className="text-[10px] font-mono text-gray-500 font-medium">
                                      {completedPillars}/3 Pilar
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        isAllComplete
                                          ? 'bg-emerald-500'
                                          : progressPercent >= 66
                                          ? 'bg-cyan-500'
                                          : progressPercent >= 33
                                          ? 'bg-amber-400'
                                          : 'bg-rose-400'
                                      }`}
                                      style={{ width: `${Math.max(progressPercent, 6)}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Micro Badges: Ultra Ramping & Tipis */}
                                <div className="flex items-center gap-1 flex-nowrap mt-0.5">
                                  {/* 1. Data KPM */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEdit(kpm);
                                    }}
                                    className={`h-[17px] px-1 py-0 rounded text-[8.5px] font-bold leading-none inline-flex items-center gap-0.5 shrink-0 transition-colors cursor-pointer border shadow-2xs ${
                                      isKpmComplete
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                    }`}
                                    title={
                                      isKpmComplete
                                        ? 'Data Pokok KPM: Lengkap. Klik untuk edit.'
                                        : `Data Pokok KPM Belum Lengkap (${details.kpmMissingSummary || 'ada field/dokumen yang kosong'}). Klik untuk melengkapi.`
                                    }
                                  >
                                    <span className="material-symbols-outlined text-[9px] shrink-0">
                                      {isKpmComplete ? 'check_circle' : 'warning'}
                                    </span>
                                    <span>KPM</span>
                                  </button>

                                  {/* 2. Data Anggota */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveKeluarga(kpm);
                                      setIsAnggotaModalOpen(true);
                                    }}
                                    className={`h-[17px] px-1 py-0 rounded text-[8.5px] font-bold leading-none inline-flex items-center gap-0.5 shrink-0 transition-colors cursor-pointer border shadow-2xs ${
                                      kpm.HasDuplicateAnggotaNik
                                        ? 'bg-rose-100 text-rose-900 border-rose-400 hover:bg-rose-200'
                                        : isAnggotaComplete
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                    }`}
                                    title={
                                      kpm.HasDuplicateAnggotaNik
                                        ? `PERINGATAN: Ada NIK Anggota Ganda terdeteksi (${(kpm.DuplicateAnggotaNiks || []).join(', ')})! Klik untuk kelola.`
                                        : isAnggotaComplete
                                        ? `Data Anggota Keluarga: Lengkap (${anggotaCount} Anggota). Klik untuk kelola.`
                                        : 'Belum ada data anggota keluarga. Klik untuk menambahkan anggota.'
                                    }
                                  >
                                    <span className="material-symbols-outlined text-[9px] shrink-0">
                                      {kpm.HasDuplicateAnggotaNik ? 'warning' : isAnggotaComplete ? 'group' : 'group_off'}
                                    </span>
                                    <span>{anggotaCount} ART</span>
                                    {kpm.HasDuplicateAnggotaNik && (
                                      <span className="text-[7.5px] bg-rose-600 text-white px-0.5 rounded-full font-bold ml-0.5">
                                        Ganda
                                      </span>
                                    )}
                                  </button>

                                  {/* 3. Data Aset */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveKeluarga(kpm);
                                      setIsAsetModalOpen(true);
                                    }}
                                    className={`h-[17px] px-1 py-0 rounded text-[8.5px] font-bold leading-none inline-flex items-center gap-0.5 shrink-0 transition-colors cursor-pointer border shadow-2xs ${
                                      isAsetComplete
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : hasAset
                                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                        : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                    }`}
                                    title={
                                      isAsetComplete
                                        ? 'Data Aset & Lokasi: Lengkap. Klik untuk kelola.'
                                        : hasAset
                                        ? `Data Aset Belum Lengkap. ${kpm.AsetMissing || ''}. Klik untuk melengkapi.`
                                        : 'Belum ada data aset & lokasi. Klik untuk menambahkan aset.'
                                    }
                                  >
                                    <span className="material-symbols-outlined text-[9px] shrink-0">
                                      {isAsetComplete ? 'home' : hasAset ? 'home' : 'add_home'}
                                    </span>
                                    <span>Aset</span>
                                  </button>
                                </div>

                                {/* Peringatan NIK Ganda / KK Ganda / Format Ilmiah */}
                                {(isDupNik || isDupKK || Boolean(kpm.IsScientificNik || /e[+-]?\d+/i.test(kpm.NIK || '')) || Boolean(kpm.IsScientificKK || /e[+-]?\d+/i.test(kpm.NoKK || ''))) && (
                                  <div className="flex flex-wrap items-center gap-1 pt-1">
                                    {isDupNik && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shrink-0"
                                        title={`NIK ini terdaftar ganda pada ${nikDupCount} data KPM!`}
                                      >
                                        <span className="material-symbols-outlined text-[11px] text-rose-600 shrink-0">warning</span>
                                        <span>NIK Ganda{nikDupCount > 1 ? ` (${nikDupCount}x)` : ''}</span>
                                      </span>
                                    )}
                                    {isDupKK && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0"
                                        title={`Nomor KK ini terdaftar ganda pada ${kkDupCount} data KPM!`}
                                      >
                                        <span className="material-symbols-outlined text-[11px] text-amber-600 shrink-0">warning</span>
                                        <span>KK Ganda{kkDupCount > 1 ? ` (${kkDupCount}x)` : ''}</span>
                                      </span>
                                    )}
                                    {Boolean((kpm.IsScientificNik || /e[+-]?\d+/i.test(kpm.NIK || '')) && !isDupNik) && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 shrink-0"
                                        title="Format NIK belum 16 digit valid. Klik Perbaiki Format di atas atau Edit."
                                      >
                                        <span className="material-symbols-outlined text-[11px] text-sky-600 shrink-0">build</span>
                                        <span>NIK Ilmiah</span>
                                      </span>
                                    )}
                                    {Boolean((kpm.IsScientificKK || /e[+-]?\d+/i.test(kpm.NoKK || '')) && !isDupKK) && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 shrink-0"
                                        title="Format No. KK belum 16 digit valid. Klik Perbaiki Format di atas atau Edit."
                                      >
                                        <span className="material-symbols-outlined text-[11px] text-sky-600 shrink-0">build</span>
                                        <span>KK Ilmiah</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                    </tr>
                  </React.Fragment>
                );
              })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && filteredData.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span>Tampilkan</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 border border-gray-300 rounded-lg bg-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>dari {filteredData.length} data</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
              >
                ◀ Sebelumnya
              </button>
              <span className="px-3 py-1 font-bold">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
              >
                Selanjutnya ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <KpmFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedForEdit(null);
        }}
        onSuccess={() => {
          setIsFormModalOpen(false);
          setSelectedForEdit(null);
          fetchData();
          if (onDataChange) onDataChange();
        }}
        editData={selectedForEdit}
        existingKelompokList={kelompokOptions}
      />

      <KpmAnggotaModal
        isOpen={isAnggotaModalOpen}
        onClose={() => setIsAnggotaModalOpen(false)}
        onSuccess={() => {
          fetchData();
          if (onDataChange) onDataChange();
        }}
        keluarga={activeKeluarga}
      />

      <KpmAsetModal
        isOpen={isAsetModalOpen}
        onClose={() => setIsAsetModalOpen(false)}
        onSuccess={() => {
          fetchData();
          if (onDataChange) onDataChange();
        }}
        keluarga={activeKeluarga}
      />

      <KpmGraduasiModal
        isOpen={isGraduasiModalOpen}
        onClose={() => setIsGraduasiModalOpen(false)}
        onSuccess={() => {
          fetchData();
          if (onDataChange) onDataChange();
        }}
        keluarga={activeKeluarga}
      />

      <KpmPermasalahanModal
        isOpen={isPermasalahanModalOpen}
        onClose={() => setIsPermasalahanModalOpen(false)}
        onSuccess={() => {
          fetchData();
          if (onDataChange) onDataChange();
        }}
        keluarga={activeKeluarga}
      />

      <KpmFullProfileModal
        isOpen={isFullProfileModalOpen}
        onClose={() => setIsFullProfileModalOpen(false)}
        kpmId={activeKeluarga?.KpmId}
        noKK={activeKeluarga?.NoKK}
        nik={activeKeluarga?.NIK}
        initialKeluarga={activeKeluarga}
        onEditKeluarga={() => {
          setIsFullProfileModalOpen(false);
          if (activeKeluarga) handleOpenEdit(activeKeluarga);
        }}
        onManageAnggota={() => {
          setIsFullProfileModalOpen(false);
          setIsAnggotaModalOpen(true);
        }}
        onManageAset={() => {
          setIsFullProfileModalOpen(false);
          setIsAsetModalOpen(true);
        }}
        onManageGraduasi={() => {
          setIsFullProfileModalOpen(false);
          setIsGraduasiModalOpen(true);
        }}
        onManagePermasalahan={() => {
          setIsFullProfileModalOpen(false);
          setIsPermasalahanModalOpen(true);
        }}
      />

      <KpmShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        keluarga={activeKeluarga}
      />

      <KpmImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onNavigateHome={onNavigateHome}
        onOpenImportPhoto={(cat) => {
          setIsImportModalOpen(false);
          setImportPhotoCategory(cat || 'dokumen');
          setIsImportPhotoModalOpen(true);
        }}
        onSuccess={() => {
          fetchData();
          if (onDataChange) onDataChange();
        }}
      />

      <KpmImportPhotoModal
        isOpen={isImportPhotoModalOpen}
        initialCategory={importPhotoCategory}
        onClose={() => setIsImportPhotoModalOpen(false)}
        onSuccess={() => {
          fetchData();
          if (onDataChange) onDataChange();
        }}
      />

      <KpmAbsensiModal
        isOpen={isAbsensiModalOpen}
        onClose={() => setIsAbsensiModalOpen(false)}
        dataList={dataList}
      />

      {/* Jendela Pop-up Menu Aksi KPM Profesional */}
      {actionModalKpm && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActionModalKpm(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Pop-up Aksi */}
            <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-teal-900 text-white p-4.5 relative">
              <button
                type="button"
                onClick={() => setActionModalKpm(null)}
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>

              <div className="flex items-center gap-3 pr-8">
                {/* Avatar / Foto */}
                <div className="w-13 h-13 rounded-2xl overflow-hidden bg-white/20 border-2 border-white/30 shrink-0 flex items-center justify-center font-bold text-lg text-white shadow-inner">
                  {actionModalKpm.FotoRumah || actionModalKpm.FotoRumahLuar || actionModalKpm.FotoRumahDalam || actionModalKpm.FotoKTP ? (
                    <img
                      src={`/api/image-proxy?id=${actionModalKpm.FotoRumah || actionModalKpm.FotoRumahLuar || actionModalKpm.FotoRumahDalam || actionModalKpm.FotoKTP}`}
                      alt={actionModalKpm.NamaPengurus}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    actionModalKpm.NamaPengurus.charAt(0)
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-white tracking-tight truncate max-w-[280px]">
                      {actionModalKpm.NamaPengurus}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        actionModalKpm.StatusKelompok === 'Ketua Kelompok'
                          ? 'bg-amber-400 text-amber-950'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      {actionModalKpm.StatusKelompok || 'Anggota'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-cyan-200/90 font-mono mt-0.5">
                    <span>NIK: {actionModalKpm.NIK || '—'}</span>
                    <span>•</span>
                    <span>KK: {actionModalKpm.NoKK || '—'}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 truncate">
                    {actionModalKpm.Kelompok ? `Kelompok ${actionModalKpm.Kelompok}` : 'Tanpa Kelompok'} •{' '}
                    {actionModalKpm.Kelurahan || actionModalKpm.Kecamatan || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Menu Aksi Pilihan */}
            <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
              {/* Section 1: Data Utama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const k = actionModalKpm;
                    setActionModalKpm(null);
                    handleOpenFullProfile(k);
                  }}
                  className="p-3 rounded-2xl border border-cyan-200 bg-cyan-50/60 hover:bg-cyan-100 text-left transition-all cursor-pointer group flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-lg">visibility</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-800 group-hover:text-cyan-900">
                      Lihat Profil Lengkap
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Ringkasan biodata & dokumen</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const k = actionModalKpm;
                    setActionModalKpm(null);
                    handleOpenEdit(k);
                  }}
                  className="p-3 rounded-2xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-left transition-all cursor-pointer group flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-800 group-hover:text-blue-900">
                      Edit Data KPM
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Ubah biodata & nomor KK</div>
                  </div>
                </button>
              </div>

              {/* Section 2: Modul Terkait */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const k = actionModalKpm;
                    setActionModalKpm(null);
                    setActiveKeluarga(k);
                    setIsAnggotaModalOpen(true);
                  }}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/50 text-left transition-all cursor-pointer group flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-lg">groups</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-800 group-hover:text-emerald-900 flex items-center gap-1.5">
                      <span>Anggota Keluarga</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                        {actionModalKpm.AnggotaCount || 0}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Kelola ART & komponen bansos</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const k = actionModalKpm;
                    setActionModalKpm(null);
                    setActiveKeluarga(k);
                    setIsAsetModalOpen(true);
                  }}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-amber-300 bg-white hover:bg-amber-50/50 text-left transition-all cursor-pointer group flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-lg">home</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-800 group-hover:text-amber-900 flex items-center gap-1.5">
                      <span>Aset & Rumah</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          actionModalKpm.HasAset
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {actionModalKpm.HasAset ? 'Ada' : 'Belum'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Foto rumah, usaha & GPS</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const k = actionModalKpm;
                    setActionModalKpm(null);
                    setActiveKeluarga(k);
                    setIsGraduasiModalOpen(true);
                  }}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-purple-300 bg-white hover:bg-purple-50/50 text-left transition-all cursor-pointer group flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-lg">school</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-800 group-hover:text-purple-900">
                      Graduasi & PPSE
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Pemberdayaan & kemandirian</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const k = actionModalKpm;
                    setActionModalKpm(null);
                    setActiveKeluarga(k);
                    setIsPermasalahanModalOpen(true);
                  }}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-rose-50/50 text-left transition-all cursor-pointer group flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-lg">report_problem</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-800 group-hover:text-rose-900">
                      Permasalahan
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Catatan & tindak lanjut aduan</div>
                  </div>
                </button>
              </div>

              {/* Section 3: Bagikan Link & Hapus */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const k = actionModalKpm;
                    setActionModalKpm(null);
                    setActiveKeluarga(k);
                    setIsShareModalOpen(true);
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-indigo-50/50 text-left transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-indigo-600 text-base">link</span>
                    <span className="font-bold text-xs text-slate-700">Bagikan Link Portal Mandiri KPM</span>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-base">chevron_right</span>
                </button>

                {(() => {
                  const nik = (actionModalKpm.NIK || '').trim();
                  const kk = (actionModalKpm.NoKK || '').trim();
                  const isDup =
                    (nik && (duplicateInfo.kpmNikCounts.get(nik) || 0) > 1) ||
                    (kk && (duplicateInfo.kpmKKCounts.get(kk) || 0) > 1) ||
                    actionModalKpm.IsDuplicateNik ||
                    actionModalKpm.IsDuplicateKK;
                  if (!isDup) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setActionModalKpm(null);
                        handleDeduplicateKpm();
                      }}
                      className="w-full p-2.5 rounded-xl border border-amber-300 hover:border-amber-400 bg-amber-50/70 hover:bg-amber-100/80 text-left transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 text-amber-900">
                        <span className="material-symbols-outlined text-amber-700 text-base group-hover:scale-110 transition-transform">
                          cleaning_services
                        </span>
                        <span className="font-bold text-xs">Bersihkan Baris Duplikat KPM Ini</span>
                      </div>
                      <span className="text-[10px] text-amber-700 font-medium">Satukan ke 1 baris</span>
                    </button>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => {
                    const k = actionModalKpm;
                    setActionModalKpm(null);
                    setDeletingKpm(k);
                  }}
                  className="w-full p-2.5 rounded-xl border border-rose-200 hover:border-rose-300 bg-rose-50/40 hover:bg-rose-100/60 text-left transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 text-rose-700">
                    <span className="material-symbols-outlined text-rose-600 text-base group-hover:scale-110 transition-transform">
                      delete
                    </span>
                    <span className="font-bold text-xs">Hapus Data KPM</span>
                  </div>
                  <span className="text-[10px] text-rose-500 font-medium">Hapus permanen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal Preview Foto KPM */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar Preview */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/95 border-b border-slate-800 text-white">
              <div>
                <h4 className="font-bold text-sm tracking-tight text-white">{previewPhoto.title}</h4>
                {previewPhoto.subtitle && (
                  <p className="text-xs text-slate-400 mt-0.5">{previewPhoto.subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewPhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs"
                  title="Buka ukuran penuh di tab baru"
                >
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  <span className="hidden sm:inline">Ukuran Penuh</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            {/* Display Foto */}
            <div className="p-4 flex items-center justify-center bg-black/60 min-h-[300px] max-h-[75vh] overflow-hidden">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingKpm && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-base text-gray-900">Konfirmasi Hapus KPM</h3>
              <p className="text-xs text-gray-500 mt-1">
                Apakah Anda yakin ingin menghapus data KPM{' '}
                <strong className="text-gray-800">{deletingKpm.NamaPengurus}</strong> (KK: {deletingKpm.NoKK})?
                Seluruh data relasi (anggota, aset, graduasi, permasalahan) juga akan dihapus dari Google Sheets.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingKpm(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>Hapus Permanen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 border border-rose-200">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-outlined text-3xl">delete_sweep</span>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-bold text-lg text-gray-900">Hapus Bersih Seluruh Data KPM PKH</h3>
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 text-left leading-relaxed">
                <span className="font-bold flex items-center gap-1 mb-1 text-rose-800">
                  <span className="material-symbols-outlined text-sm">warning</span> Peringatan Tindakan Permanen:
                </span>
                Tindakan ini akan mengosongkan <strong>seluruh data KPM PKH</strong> di Google Sheets (termasuk Data Keluarga, Anggota Keluarga, Aset KPM, Graduasi, Permasalahan, dan Portal). Format header baris pertama akan tetap dipertahankan sehingga Anda dapat langsung mengimpor data baru.
              </div>
              <p className="text-xs text-gray-600">
                Untuk menghindari tindakan yang tidak disengaja, ketik kata <span className="font-black text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded select-all tracking-wider">HAPUS</span> di bawah ini untuk konfirmasi:
              </p>
            </div>

            <div className="pt-1">
              <input
                type="text"
                value={clearAllConfirmText}
                onChange={(e) => setClearAllConfirmText(e.target.value)}
                placeholder="Ketik HAPUS di sini..."
                disabled={isClearingAll}
                className="w-full text-center tracking-widest font-bold text-sm px-4 py-2.5 border-2 border-rose-300 rounded-xl focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-200 uppercase transition-all"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsClearAllModalOpen(false);
                  setClearAllConfirmText('');
                }}
                disabled={isClearingAll}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                disabled={isClearingAll || clearAllConfirmText.trim().toUpperCase() !== 'HAPUS'}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isClearingAll ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Mengosongkan Sheet...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">delete_sweep</span>
                    <span>Ya, Hapus Bersih Seluruh Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup Catatan Temuan KPM */}
      {popupCatatanKpm && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPopupCatatanKpm(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-amber-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl">report</span>
                <div>
                  <h4 className="font-bold text-sm font-['Outfit']">Catatan Temuan KPM</h4>
                  <p className="text-[11px] text-amber-100">{popupCatatanKpm.NamaPengurus} (KK: {popupCatatanKpm.NoKK || '—'})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPopupCatatanKpm(null)}
                className="p-1 hover:bg-white/20 rounded-xl text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-gray-700 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="font-bold text-gray-800 mb-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-amber-600">checklist</span>
                  Daftar Catatan & Temuan Lapangan:
                </p>
                {(() => {
                  let list: string[] = [];
                  try {
                    list = JSON.parse(popupCatatanKpm.CatatanTemuan || '[]');
                  } catch {
                    if (popupCatatanKpm.CatatanTemuan) list = [popupCatatanKpm.CatatanTemuan];
                  }
                  if (!Array.isArray(list) || list.length === 0) {
                    return <p className="text-gray-400 italic">Tidak ada catatan temuan.</p>;
                  }
                  return (
                    <div className="space-y-1.5">
                      {list.map((item, i) => (
                        <div
                          key={i}
                          className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-950 font-medium"
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Foto Bukti Catatan (jika ada) */}
              {popupCatatanKpm.FotoBuktiCatatan && (
                <div className="space-y-1.5">
                  <p className="font-bold text-gray-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-amber-600">image</span>
                    Foto Bukti Catatan:
                  </p>
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-slate-100 max-h-48">
                    <img
                      src={`/api/image-proxy?id=${popupCatatanKpm.FotoBuktiCatatan}`}
                      alt="Foto Bukti Catatan"
                      className="w-full h-48 object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() =>
                        setPreviewPhoto({
                          url: `/api/image-proxy?id=${popupCatatanKpm.FotoBuktiCatatan}`,
                          title: `Foto Bukti Catatan: ${popupCatatanKpm.NamaPengurus}`,
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = popupCatatanKpm;
                  setPopupCatatanKpm(null);
                  handleOpenFullProfile(target);
                }}
                className="text-xs font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>Lihat Profil Lengkap</span>
              </button>
              <button
                type="button"
                onClick={() => setPopupCatatanKpm(null)}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
