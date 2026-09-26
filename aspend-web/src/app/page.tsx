'use client';

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { MASTER_RHK_DATA, getRHKByIdOrJenis, getRencanaAksiListForRHK, isP2K2, getUniqueModulP2K2, getSesiByModul } from "@/lib/master-rhk";
import KpmTableView from "@/components/kpm/KpmTableView";
import KpmDashboardView from "@/components/kpm/KpmDashboardView";
import KpmPermasalahanView from "@/components/kpm/KpmPermasalahanView";
import KpmGraduasiView from "@/components/kpm/KpmGraduasiView";
import KpmAnalisaTahapView from "@/components/kpm/KpmAnalisaTahapView";

interface Report {
  ReportId: string;
  Tanggal: string;
  JenisRHK: string;
  IdRHK: string;
  RencanaAksi: string;
  Pukul: string;
  PoinKegiatan: string;
  NarasiAI: string;
  NarasiEdited: string;
  Status: string;
  PdfFileId: string;
  FotoIds: string[];
  P2K2Data: any;
  Lokasi: string;
  CreatedAt: string;
}

interface UserProfile {
  nama: string;
  email: string;
  nip: string;
  jabatan: string;
  kabupaten: string;
  photoFileId?: string;
  photoUrl?: string;
  signatureFileId?: string;
  signatureUrl?: string;
  isPremium?: boolean;
}

function parseRobustDate(dateStr: string, timeStr: string = '00:00'): number {
  if (!dateStr) return 0;
  if (!timeStr) timeStr = '00:00';
  let d = dateStr.toString().trim().toLowerCase();
  
  // Hapus semua nama hari Indonesia/Inggris (baik panjang maupun singkatan: Jum, Sen, dll) beserta tanda baca
  d = d.replace(/\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|sen|sel|rab|kam|jum|sab|min|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b[,.]?/gi, '').trim();
  
  const monthsId = [
    { name: 'januari', short: 'jan', m: 0 },
    { name: 'februari', short: 'feb', m: 1 },
    { name: 'maret', short: 'mar', m: 2 },
    { name: 'april', short: 'apr', m: 3 },
    { name: 'mei', short: 'may', m: 4 },
    { name: 'juni', short: 'jun', m: 5 },
    { name: 'juli', short: 'jul', m: 6 },
    { name: 'agustus', short: 'agu', m: 7 },
    { name: 'august', short: 'aug', m: 7 },
    { name: 'september', short: 'sep', m: 8 },
    { name: 'oktober', short: 'okt', m: 9 },
    { name: 'october', short: 'oct', m: 9 },
    { name: 'november', short: 'nov', m: 10 },
    { name: 'desember', short: 'des', m: 11 },
    { name: 'december', short: 'dec', m: 11 }
  ];

  for (const item of monthsId) {
    const regex = new RegExp('\\b(' + item.name + '|' + item.short + ')\\b', 'i');
    if (regex.test(d)) {
      d = d.replace(regex, ' ' + item.m + ' ');
      const p = d.trim().split(/\s+/);
      if (p.length >= 3) {
        const day = parseInt(p[0]);
        const month = parseInt(p[1]);
        const year = parseInt(p[2]);
        const hour = parseInt(timeStr.split(':')[0]) || 0;
        const min = parseInt(timeStr.split(':')[1]) || 0;
        const res = new Date(year, month, day, hour, min, 0).getTime();
        if (!isNaN(res)) return res;
      }
      break;
    }
  }

  const parts = d.split(/[-/\\]/);
  if (parts.length === 3) {
    let year: number, month: number, day: number;
    if (parts[0].length === 4) {
      year = parseInt(parts[0]); month = parseInt(parts[1]) - 1; day = parseInt(parts[2]);
    } else {
      day = parseInt(parts[0]); month = parseInt(parts[1]) - 1; year = parseInt(parts[2]);
      if (month > 11) { 
        const temp = day; day = month + 1; month = temp - 1; 
      }
      if (year < 100) year += 2000;
    }
    const hour = parseInt(timeStr.split(':')[0]) || 0;
    const min = parseInt(timeStr.split(':')[1]) || 0;
    const res = new Date(year, month, day, hour, min, 0).getTime();
    if (!isNaN(res)) return res;
  }
  const raw = new Date(dateStr + (timeStr ? ' ' + timeStr : '')).getTime();
  return isNaN(raw) ? 0 : raw;
}

function toISODate(dateStr: string): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const time = parseRobustDate(str, '00:00');
  if (time === 0) return '';
  const d = new Date(time);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [activePage, setActivePage] = useState<'dashboard' | 'profile' | 'form' | 'kpm-dashboard' | 'kpm-data' | 'kpm-aset' | 'kpm-graduasi' | 'kpm-masalah' | 'kpm-analisa-tahap' | 'kpm-profil-detail'>('dashboard');
  const [kpmMenuExpanded, setKpmMenuExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  const [reports, setReports] = useState<Report[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<{ total: number; month: number; rhkBreakdown: Record<string, number> }>({
    total: 0,
    month: 0,
    rhkBreakdown: {}
  });
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Toast notification
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Edit State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editForm, setEditForm] = useState({
    tanggal: '',
    pukul: '',
    lokasi: '',
    jenisRHK: '',
    idRHK: '',
    rencanaAksi: '',
    poinKegiatan: '',
    narasiEdited: ''
  });
  const [editExistingPhotos, setEditExistingPhotos] = useState<string[]>([]);
  const [editNewPhotos, setEditNewPhotos] = useState<{ file: File; previewUrl: string }[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isUploadingEditPhoto, setIsUploadingEditPhoto] = useState(false);
  const [pdfRefreshTimestamp, setPdfRefreshTimestamp] = useState<number>(Date.now());

  // ─── Modal Premium Access Lock State ──────────────────
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  // ─── Form Buat Laporan RHK Baru State ─────────────────
  const [createForm, setCreateForm] = useState({
    tanggal: new Date().toISOString().substring(0, 10),
    pukul: '14:00',
    jenisRHK: '',
    idRHK: '',
    rencanaAksi: '',
    poinKegiatan: '',
    // Field Khusus RHK-2 (P2K2)
    p2k2Modul: '',
    p2k2Sesi: '',
    p2k2Kelompok: '',
    p2k2Ketua: '',
    p2k2Hadir: '',
    p2k2Total: ''
  });
  const [createPhotos, setCreatePhotos] = useState<{ file: File; previewUrl: string }[]>([]);
  const [generatedNarrative, setGeneratedNarrative] = useState('');
  const [extractedLocation, setExtractedLocation] = useState('');
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [previewPhotoModalUrl, setPreviewPhotoModalUrl] = useState<string | null>(null);
  
  // Riwayat Poin Google Sheets
  const [sheetRiwayatPoin, setSheetRiwayatPoin] = useState<{ idRhk: string; text: string; date?: string }[]>([]);
  const [poinHistory, setPoinHistory] = useState<string[]>([]);
  const [showPoinHistoryModal, setShowPoinHistoryModal] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterJenis, setFilterJenis] = useState("");
  const [filterAksi, setFilterAksi] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Pagination State (Default 10 baris)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard");
      const result = await res.json();
      
      if (res.ok && result.success) {
        setReports(result.reports || []);
        setProfile(result.profile || null);
        setStats(result.stats || { total: 0, month: 0, rhkBreakdown: {} });
        setSheetRiwayatPoin(result.riwayatPoinList || []);
        if (result.reports && result.reports.length > 0) {
          setSelectedReport(result.reports[0]);
        }
      } else {
        setError(result.message || "Gagal memuat data database otomatis.");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchDashboardData();
    }
  }, [status, fetchDashboardData]);

  // Reset current page whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterJenis, filterAksi, filterMonth, filterDate, pageSize]);

  // Unique options for filter dropdowns
  const jenisRHKOptions = useMemo(() => {
    const set = new Set<string>();
    // Tambahkan dari master data
    MASTER_RHK_DATA.forEach(m => set.add(m.jenis));
    // Tambahkan dari laporan
    reports.forEach(r => {
      if (r.JenisRHK) set.add(r.JenisRHK);
    });
    return Array.from(set);
  }, [reports]);

  const rencanaAksiOptions = useMemo(() => {
    const set = new Set<string>();
    if (filterJenis) {
      const masterRencana = getRencanaAksiListForRHK(filterJenis);
      masterRencana.forEach(aksi => set.add(aksi));
    } else {
      MASTER_RHK_DATA.forEach(m => m.rencanaList.forEach(aksi => set.add(aksi)));
    }
    reports.forEach(r => {
      if (r.RencanaAksi) {
        if (!filterJenis || r.JenisRHK === filterJenis) {
          set.add(r.RencanaAksi);
        }
      }
    });
    return Array.from(set);
  }, [reports, filterJenis]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    const list = reports.filter(r => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match = 
          (r.JenisRHK || "").toLowerCase().includes(term) ||
          (r.RencanaAksi || "").toLowerCase().includes(term) ||
          (r.PoinKegiatan || "").toLowerCase().includes(term) ||
          (r.NarasiAI || "").toLowerCase().includes(term) ||
          (r.Lokasi || "").toLowerCase().includes(term);
        if (!match) return false;
      }
      if (filterJenis && r.JenisRHK !== filterJenis) return false;
      if (filterAksi && r.RencanaAksi !== filterAksi) return false;
      if (filterMonth) {
        const iso = toISODate(r.Tanggal);
        if (!iso || !iso.startsWith(filterMonth)) return false;
      }
      if (filterDate) {
        const iso = toISODate(r.Tanggal);
        if (!iso || iso !== filterDate) return false;
      }
      return true;
    });

    return list.slice().sort((a, b) => {
      const pukulA = (a.Pukul && a.Pukul !== '-') ? a.Pukul.toString().trim().substring(0, 5) : '00:00';
      const pukulB = (b.Pukul && b.Pukul !== '-') ? b.Pukul.toString().trim().substring(0, 5) : '00:00';
      let timeA = parseRobustDate(a.Tanggal, pukulA);
      let timeB = parseRobustDate(b.Tanggal, pukulB);
      if (timeA === 0) timeA = new Date(a.CreatedAt || 0).getTime();
      if (timeB === 0) timeB = new Date(b.CreatedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [reports, searchTerm, filterJenis, filterAksi, filterMonth, filterDate]);

  const isFiltered = Boolean(searchTerm || filterJenis || filterAksi || filterMonth || filterDate);

  // Pagination Calculations
  const totalFiltered = filteredReports.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const startItem = totalFiltered === 0 ? 0 : startIndex + 1;
  const endItem = endIndex;

  const paginatedReports = useMemo(() => {
    return filteredReports.slice(startIndex, endIndex);
  }, [filteredReports, startIndex, endIndex]);

  const resetFilters = () => {
    setSearchTerm("");
    setFilterJenis("");
    setFilterAksi("");
    setFilterMonth("");
    setFilterDate("");
    setCurrentPage(1);
  };

  // ── Helper: Format Nama File PDF Sesuai Standar ASPEND ────────
  // Format: "YYYYMMDD - HH.mm - RHK-X - Rencana Aksi.pdf"
  const generatePdfFileName = (report: Report): string => {
    // 1. Tanggal YYYYMMDD
    let ymd = '';
    const timeVal = parseRobustDate(report.Tanggal, '00:00');
    if (timeVal > 0) {
      const d = new Date(timeVal);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      ymd = `${yyyy}${mm}${dd}`;
    } else {
      const digits = (report.Tanggal || '').replace(/\D/g, '');
      ymd = digits.length >= 8 ? digits.substring(0, 8) : '20260101';
    }

    // 2. Pukul HH.mm (menggunakan titik)
    let timeStr = (report.Pukul || '00:00').toString().trim();
    if (!timeStr || timeStr === '-') timeStr = '00.00';
    timeStr = timeStr.replace(':', '.');
    const pParts = timeStr.split('.');
    if (pParts.length >= 2) {
      timeStr = `${pParts[0].padStart(2, '0')}.${pParts[1].padEnd(2, '0').substring(0, 2)}`;
    } else if (pParts.length === 1 && pParts[0].length > 0) {
      timeStr = `${pParts[0].padStart(2, '0')}.00`;
    }

    // 3. Jenis RHK (contoh: RHK-2)
    const idText = report.IdRHK || report.JenisRHK || '';
    const num = idText.replace(/\D/g, '');
    const rhkTag = num ? `RHK-${num}` : (report.IdRHK || report.JenisRHK || 'RHK');

    // 4. Jenis Rencana Aksi
    let aksi = (report.RencanaAksi || report.JenisRHK || 'Laporan').trim();
    aksi = aksi.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();

    return `${ymd} - ${timeStr} - ${rhkTag} - ${aksi}.pdf`;
  };

  // ── Action Handlers: Unduh, Hapus, Edit ──────────────────────

  const handleDownloadPdf = (report: Report) => {
    if (!report.PdfFileId || report.PdfFileId.length < 5) {
      showToast("File PDF belum tersedia di Google Drive.", "error");
      return;
    }
    showToast("Mengunduh dokumen PDF laporan...", "info");
    const fileName = generatePdfFileName(report);
    const downloadUrl = `/api/pdf/download?fileId=${report.PdfFileId}&fileName=${encodeURIComponent(fileName)}`;
    window.open(downloadUrl, "_blank");
  };

  const handleOpenDelete = (report: Report) => {
    setReportToDelete(report);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/reports?reportId=${reportToDelete.ReportId}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (res.ok && result.success) {
        showToast("Laporan berhasil dihapus dari database!", "success");
        // Update local state
        setReports(prev => prev.filter(r => r.ReportId !== reportToDelete.ReportId));
        setStats(prev => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
        }));
        if (selectedReport?.ReportId === reportToDelete.ReportId) {
          const remaining = reports.filter(r => r.ReportId !== reportToDelete.ReportId);
          setSelectedReport(remaining.length > 0 ? remaining[0] : null);
        }
        setDeleteModalOpen(false);
      } else {
        showToast(result.error || "Gagal menghapus laporan.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Terjadi kesalahan saat menghapus laporan.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEdit = (report: Report) => {
    setEditingReport(report);
    
    // Temukan master RHK yang cocok berdasarkan id atau jenis
    let matchedItem = getRHKByIdOrJenis(report.JenisRHK || report.IdRHK);
    if (!matchedItem && report.IdRHK) {
      matchedItem = MASTER_RHK_DATA.find(m => m.id.toLowerCase() === report.IdRHK.toLowerCase());
    }

    const currentJenis = matchedItem ? matchedItem.jenis : (report.JenisRHK || (MASTER_RHK_DATA[0]?.jenis ?? ''));
    const currentId = matchedItem ? matchedItem.id : (report.IdRHK || (MASTER_RHK_DATA[0]?.id ?? ''));
    
    // Rencana Aksi
    const availableRencana = getRencanaAksiListForRHK(currentJenis);
    let currentRencana = report.RencanaAksi || '';
    if (!currentRencana && availableRencana.length > 0) {
      currentRencana = availableRencana[0];
    }

    setEditForm({
      tanggal: toISODate(report.Tanggal) || report.Tanggal || '',
      pukul: report.Pukul || '14:00',
      lokasi: report.Lokasi || '',
      jenisRHK: currentJenis,
      idRHK: currentId,
      rencanaAksi: currentRencana,
      poinKegiatan: report.PoinKegiatan || '',
      narasiEdited: report.NarasiEdited || report.NarasiAI || ''
    });

    setEditExistingPhotos([...(report.FotoIds || [])]);
    setEditNewPhotos([]);
    setEditModalOpen(true);
  };

  const handleAddEditPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newItems = Array.from(files).map(file => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setEditNewPhotos(prev => [...prev, ...newItems]);
    e.target.value = '';
  };

  const handleRemoveExistingPhoto = (indexToRemove: number) => {
    setEditExistingPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleRemoveNewPhoto = (indexToRemove: number) => {
    setEditNewPhotos(prev => {
      const target = prev[indexToRemove];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    setIsSavingEdit(true);

    try {
      let finalFotoIds = [...editExistingPhotos];

      // Unggah foto baru ke Google Drive jika ada
      if (editNewPhotos.length > 0) {
        setIsUploadingEditPhoto(true);
        const formData = new FormData();
        editNewPhotos.forEach(item => {
          formData.append('files', item.file);
        });
        formData.append('folderName', 'RHK-agent_FotoKegiatan');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.files && uploadData.files.length > 0) {
          const newIds = uploadData.files.map((f: any) => f.id);
          finalFotoIds = [...finalFotoIds, ...newIds];
        } else {
          throw new Error(uploadData.error || 'Gagal mengunggah foto baru ke Google Drive.');
        }
      }

      const res = await fetch('/api/reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: editingReport.ReportId,
          tanggal: editForm.tanggal,
          pukul: editForm.pukul,
          lokasi: editForm.lokasi,
          jenisRHK: editForm.jenisRHK,
          idRHK: editForm.idRHK,
          rencanaAksi: editForm.rencanaAksi,
          poinKegiatan: editForm.poinKegiatan,
          narasiEdited: editForm.narasiEdited,
          fotoIds: finalFotoIds
        })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        showToast("Laporan & dokumen PDF berhasil diperbarui!", "success");
        
        const updatedPdfId = result.data?.PdfFileId || editingReport.PdfFileId || '';
        
        // Update state in memory
        setReports(prev => prev.map(r => {
          if (r.ReportId === editingReport.ReportId) {
            return {
              ...r,
              Tanggal: editForm.tanggal,
              Pukul: editForm.pukul,
              Lokasi: editForm.lokasi,
              JenisRHK: editForm.jenisRHK,
              IdRHK: editForm.idRHK,
              RencanaAksi: editForm.rencanaAksi,
              PoinKegiatan: editForm.poinKegiatan,
              NarasiEdited: editForm.narasiEdited,
              PdfFileId: updatedPdfId,
              FotoIds: finalFotoIds
            };
          }
          return r;
        }));

        if (selectedReport?.ReportId === editingReport.ReportId) {
          setSelectedReport(prev => prev ? {
            ...prev,
            Tanggal: editForm.tanggal,
            Pukul: editForm.pukul,
            Lokasi: editForm.lokasi,
            JenisRHK: editForm.jenisRHK,
            IdRHK: editForm.idRHK,
            RencanaAksi: editForm.rencanaAksi,
            PoinKegiatan: editForm.poinKegiatan,
            NarasiEdited: editForm.narasiEdited,
            PdfFileId: updatedPdfId,
            FotoIds: finalFotoIds
          } : null);
        }

        setPdfRefreshTimestamp(Date.now());
        setEditModalOpen(false);
      } else {
        showToast(result.error || "Gagal memperbarui laporan.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Terjadi kesalahan saat menyimpan perubahan.", "error");
    } finally {
      setIsSavingEdit(false);
      setIsUploadingEditPhoto(false);
    }
  };

  // ─── Akses Form Buat Laporan RHK ──────────────────────
  const handleOpenCreateReport = () => {
    // Saat ini siapa saja boleh mengakses fitur Buat Laporan RHK (akses premium diabaikan sementara)
    setActivePage('form');
  };

  // ─── Handler Upload & Hapus Foto Form Baru ────────────
  const handleCreatePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const remainingSlots = 100 - createPhotos.length;
    if (remainingSlots <= 0) {
      showToast('Batas maksimal 100 foto tercapai.', 'info');
      return;
    }
    const selected = files.slice(0, remainingSlots);
    const newItems = selected.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setCreatePhotos(prev => [...prev, ...newItems]);
    e.target.value = '';
  };

  const handleRemoveCreatePhoto = (index: number) => {
    setCreatePhotos(prev => {
      const target = prev[index];
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // ─── Riwayat Poin Per RHK (Google Sheets & Cache) ────
  const loadPoinHistoryForRhk = useCallback((rhkId: string, jenisRhk?: string) => {
    if (!rhkId && !jenisRhk) {
      setPoinHistory([]);
      return;
    }

    const targetId = (rhkId || '').toUpperCase().trim();
    const targetJenis = (jenisRhk || '').toLowerCase().trim();
    const targetNum = targetId.replace(/\D/g, '');

    const foundPoin: string[] = [];

    // Helper untuk matching RHK secara akurat
    const isMatching = (itemRhkId?: string, itemJenis?: string, hasP2k2?: boolean) => {
      const cId = (itemRhkId || '').toUpperCase().trim();
      const cJenis = (itemJenis || '').toLowerCase().trim();
      const cNum = cId.replace(/\D/g, '');

      // Khusus RHK-2 (P2K2)
      if (targetNum === '2' || targetJenis.includes('p2k2')) {
        if (hasP2k2 || cJenis.includes('p2k2') || cNum === '2' || cId.includes('RHK-2')) {
          return true;
        }
        return false;
      }

      // Khusus RHK-1 (Bansos)
      if (targetNum === '1' || targetJenis.includes('bansos')) {
        if (cJenis.includes('p2k2') || hasP2k2 || cNum === '2') return false; // Jangan campur dengan P2K2
        if (cNum === '1' || cId.includes('RHK-1') || cJenis.includes('bansos') || cJenis.includes('bantuan sosial')) {
          return true;
        }
      }

      // RHK 3 s/d 8
      if (targetNum && cNum && targetNum === cNum) return true;
      if (targetId && (cId.includes(targetId) || cJenis.includes(targetId.toLowerCase()))) return true;

      // Fallback perbandingan nama jenis
      if (targetJenis && cJenis) {
        const targetWords = targetJenis.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
        if (targetWords.length > 0 && targetWords.every(w => cJenis.includes(w))) {
          return true;
        }
      }

      return false;
    };

    // 1. Ambil dari sheet Riwayat_Poin jika ada (urutan dari terbaru)
    if (sheetRiwayatPoin && sheetRiwayatPoin.length > 0) {
      for (const item of [...sheetRiwayatPoin].reverse()) {
        if (item.text && item.text.trim()) {
          if (isMatching(item.idRhk, item.idRhk)) {
            foundPoin.push(item.text.trim());
          }
        }
      }
    }

    // 2. Ambil dari Laporan_Log (reports) dari Google Sheets (terbaru lebih dahulu)
    if (reports && reports.length > 0) {
      for (const r of reports) {
        if (r.PoinKegiatan && r.PoinKegiatan.trim()) {
          if (isMatching(r.IdRHK, r.JenisRHK, Boolean(r.P2K2Data))) {
            foundPoin.push(r.PoinKegiatan.trim());
          }
        }
      }
    }

    // 3. Ambil dari localStorage sebagai cadangan
    try {
      if (targetId) {
        const localSaved = localStorage.getItem(`aspend_poin_history_${targetId}`);
        if (localSaved) {
          const parsed = JSON.parse(localSaved);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              if (p && typeof p === 'string' && p.trim()) foundPoin.push(p.trim());
            }
          }
        }
      }
    } catch {}

    // 4. Hapus duplikat sambil mempertahankan urutan terbaru
    const uniquePoin: string[] = [];
    const seen = new Set<string>();
    for (const p of foundPoin) {
      const normalized = p.trim().toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniquePoin.push(p.trim());
      }
    }

    setPoinHistory(uniquePoin);
  }, [reports, sheetRiwayatPoin]);

  const handleOpenPoinHistoryModal = () => {
    if (!createForm.jenisRHK) {
      showToast('Silakan pilih Jenis RHK terlebih dahulu.', 'info');
      return;
    }
    loadPoinHistoryForRhk(createForm.idRHK, createForm.jenisRHK);
    setShowPoinHistoryModal(true);
  };

  // ─── Generate Narasi AI ───────────────────────────────
  const handleGenerateNarrative = async () => {
    if (!createForm.jenisRHK || !createForm.rencanaAksi) {
      showToast('Silakan pilih Jenis RHK dan Rencana Aksi.', 'error');
      return;
    }
    if (!createForm.poinKegiatan.trim()) {
      showToast('Silakan isi poin-poin kegiatan.', 'error');
      return;
    }
    if (isP2K2(createForm.jenisRHK)) {
      if (!createForm.p2k2Modul || !createForm.p2k2Sesi) {
        showToast('Mohon pilih Modul dan Sesi P2K2.', 'error');
        return;
      }
    }

    setIsGeneratingNarrative(true);
    try {
      const p2k2Data = isP2K2(createForm.jenisRHK) ? {
        modul: createForm.p2k2Modul,
        sesi: createForm.p2k2Sesi,
        namaKelompok: createForm.p2k2Kelompok,
        ketuaKelompok: createForm.p2k2Ketua,
        jumlahHadir: createForm.p2k2Hadir,
        jumlahKPM: createForm.p2k2Total,
      } : null;

      const res = await fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenisRHK: createForm.jenisRHK,
          idRHK: createForm.idRHK,
          rencanaAksi: createForm.rencanaAksi,
          tanggal: createForm.tanggal,
          pukul: createForm.pukul,
          poinKegiatan: createForm.poinKegiatan,
          p2k2Data,
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setGeneratedNarrative(result.narrative);
        if (result.lokasi) {
          setExtractedLocation(result.lokasi);
        }
        showToast('Draf narasi AI berhasil dibuat! Silakan tinjau dan edit di bawah.', 'success');
        setTimeout(() => {
          const el = document.getElementById('narrative-editor-box');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 250);
      } else {
        showToast(result.error || 'Gagal menghasilkan narasi AI.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan koneksi AI.', 'error');
    } finally {
      setIsGeneratingNarrative(false);
    }
  };

  // ─── Simpan & Buat PDF ────────────────────────────────
  const handleSubmitReport = async () => {
    if (!createForm.jenisRHK || !createForm.rencanaAksi) {
      showToast('Pilih Jenis RHK dan Rencana Aksi.', 'error');
      return;
    }
    if (!createForm.poinKegiatan.trim()) {
      showToast('Isi poin-poin kegiatan.', 'error');
      return;
    }
    if (!generatedNarrative.trim()) {
      showToast('Silakan klik "Buat Draf Narasi" terlebih dahulu sebelum menyimpan.', 'error');
      return;
    }
    if (createPhotos.length === 0) {
      showToast('Upload minimal 1 foto bukti dukung kegiatan.', 'error');
      return;
    }

    setIsSubmittingReport(true);
    try {
      // 1. Unggah foto bukti dukung ke Google Drive folder RHK-agent_FotoKegiatan
      let uploadedFotoIds: string[] = [];
      if (createPhotos.length > 0) {
        const formData = new FormData();
        formData.append('folderName', 'RHK-agent_FotoKegiatan');
        createPhotos.forEach(p => {
          formData.append('files', p.file);
        });

        const upRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const upResult = await upRes.json();
        if (!upRes.ok || !upResult.success) {
          throw new Error(upResult.error || 'Gagal mengunggah foto bukti dukung ke Google Drive.');
        }
        uploadedFotoIds = upResult.files.map((f: any) => f.id);
      }

      // 2. Data P2K2 jika relevan
      const p2k2Data = isP2K2(createForm.jenisRHK) ? {
        modul: createForm.p2k2Modul,
        sesi: createForm.p2k2Sesi,
        namaKelompok: createForm.p2k2Kelompok,
        ketuaKelompok: createForm.p2k2Ketua,
        jumlahHadir: createForm.p2k2Hadir,
        jumlahKPM: createForm.p2k2Total,
      } : null;

      // 3. Simpan laporan & Buat PDF resmi di Google Drive folder RHK-agent_Output
      const reportRes = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: createForm.tanggal,
          pukul: createForm.pukul,
          jenisRHK: createForm.jenisRHK,
          idRHK: createForm.idRHK,
          rencanaAksi: createForm.rencanaAksi,
          poinKegiatan: createForm.poinKegiatan,
          narasiAI: generatedNarrative,
          narasiEdited: generatedNarrative,
          lokasi: extractedLocation,
          p2k2Data,
          fotoIds: uploadedFotoIds,
        }),
      });

      const reportResult = await reportRes.json();
      if (reportRes.ok && reportResult.success) {
        showToast('Laporan RHK dan dokumen PDF resmi berhasil disimpan ke Google Drive!', 'success');

        // Simpan ke riwayat poin lokal
        if (createForm.idRHK && createForm.poinKegiatan.trim()) {
          try {
            const key = `aspend_poin_history_${createForm.idRHK}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const updated = [createForm.poinKegiatan.trim(), ...existing.filter((x: string) => x !== createForm.poinKegiatan.trim())].slice(0, 10);
            localStorage.setItem(key, JSON.stringify(updated));
          } catch {}
        }

        // Segarkan data dashboard
        await fetchDashboardData();

        // Reset form
        setCreateForm({
          tanggal: new Date().toISOString().substring(0, 10),
          pukul: '14:00',
          jenisRHK: '',
          idRHK: '',
          rencanaAksi: '',
          poinKegiatan: '',
          p2k2Modul: '',
          p2k2Sesi: '',
          p2k2Kelompok: '',
          p2k2Ketua: '',
          p2k2Hadir: '',
          p2k2Total: ''
        });
        setCreatePhotos([]);
        setGeneratedNarrative('');
        setExtractedLocation('');

        setActivePage('dashboard');
      } else {
        throw new Error(reportResult.error || 'Gagal menyimpan laporan.');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan saat menyimpan laporan.', 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const getRhkBadgeStyle = (key: string) => {
    const num = key.replace(/\D/g, '');
    const colors: Record<string, { bg: string; text: string; border: string; numBg: string; numText: string }> = {
      '1': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', numBg: 'bg-blue-600', numText: 'text-white' },
      '2': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', numBg: 'bg-purple-600', numText: 'text-white' },
      '3': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', numBg: 'bg-emerald-600', numText: 'text-white' },
      '4': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', numBg: 'bg-amber-600', numText: 'text-white' },
      '5': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', numBg: 'bg-cyan-600', numText: 'text-white' },
      '6': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', numBg: 'bg-indigo-600', numText: 'text-white' },
      '7': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', numBg: 'bg-pink-600', numText: 'text-white' },
      '8': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', numBg: 'bg-rose-600', numText: 'text-white' },
    };
    return colors[num] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', numBg: 'bg-gray-700', numText: 'text-white' };
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner"></div>
          <p className="text-on-surface-variant text-sm font-medium">Memuat ASPEND...</p>
        </div>
      </div>
    );
  }

  // Jika belum login, tampilkan Login Screen
  if (status === "unauthenticated") {
    return (
      <main className="min-h-screen bg-surface text-on-surface font-body-md transition-colors duration-300 antialiased selection:bg-primary/20 flex items-center justify-center bg-surface/90">
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xl w-full max-w-md mx-4 border border-outline-variant/30 flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-fixed-dim/10 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
          <Image src="/logo.png" alt="ASPEND Logo" width={64} height={64} className="rounded-2xl shadow-lg border border-outline-variant/20 object-cover mb-6 bg-white floating-logo" />
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface mb-2">Masuk ke ASPEND</h1>
          <p className="text-on-surface-variant font-body-md text-body-md mb-8 text-center">Silakan otentikasi dengan akun Google Anda untuk mengakses Database (Google Drive & Sheets).</p>
          
          <div className="w-full space-y-4">
            <button 
              onClick={() => signIn('google')}
              className="w-full py-3 bg-white text-on-surface border border-outline-variant font-label-md text-label-md font-bold rounded-lg hover:bg-surface-variant transition-all shadow-sm flex items-center justify-center gap-3 active:scale-95 cursor-pointer"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              <span>Lanjutkan dengan Google</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Format tanggal grup (misal: "JUMAT, 25 SEPTEMBER 2026")
  const formatDateGroup = (dateStr: string) => {
    if (!dateStr) return "TANGGAL TIDAK DIKETAHUI";
    const time = parseRobustDate(dateStr, '12:00');
    if (time > 0) {
      return new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(new Date(time)).toUpperCase();
    }
    const iso = toISODate(dateStr);
    if (iso) {
      const timeIso = parseRobustDate(iso, '12:00');
      if (timeIso > 0) {
        return new Intl.DateTimeFormat("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        }).format(new Date(timeIso)).toUpperCase();
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(d).toUpperCase();
    }
    return String(dateStr).toUpperCase().trim();
  };

  // Kunci perbandingan grup tanggal (menggunakan teks grup formatDateGroup agar 100% sinkron dan tidak mungkin terpisah)
  const getDateGroupKey = (dateStr: string) => {
    if (!dateStr) return "";
    return formatDateGroup(dateStr).trim().toUpperCase();
  };

  const userAvatarUrl = profile?.photoUrl || session?.user?.image;

  return (
    <div className="flex h-screen bg-surface overflow-hidden text-on-surface font-body-md antialiased selection:bg-primary/20">
      
      {/* ─── Toast Notification ────────────────────────────── */}
      {toast && (
        <div className="fixed top-5 right-5 z-[200] animate-bounce">
          <div className={`px-4 py-2.5 rounded-xl shadow-lg border flex items-center gap-2 text-xs font-bold ${
            toast.type === 'success' 
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : toast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-cyan-600 text-white border-cyan-500'
          }`}>
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
            </span>
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* ─── Modal Konfirmasi Hapus ────────────────────────── */}
      {deleteModalOpen && reportToDelete && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full p-6 my-6 animate-scale-up">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">delete_forever</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-snug">Hapus Laporan RHK?</h3>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Apakah Anda yakin ingin menghapus data laporan ini? Baris data pada Google Sheets dan file PDF terkait akan dihapus secara permanen.
                </p>
              </div>
            </div>

            {/* Foto Bukti Dukung */}
            <div className="mb-3.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">image</span>
                Foto Bukti Dukung ({reportToDelete.FotoIds?.length || 0})
              </label>

              {reportToDelete.FotoIds && reportToDelete.FotoIds.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                  {reportToDelete.FotoIds.map((fotoId, fIdx) => (
                    <div key={fIdx} className="relative rounded-xl overflow-hidden border border-gray-200 shadow-xs bg-gray-100 h-28 w-36 shrink-0 group">
                      <img 
                        src={`/api/image-proxy?id=${fotoId}`}
                        alt={`Bukti Dukung ${fIdx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('drive.google.com')) {
                            target.src = `https://drive.google.com/thumbnail?id=${fotoId}&sz=w400-h400`;
                          }
                        }}
                      />
                      <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                        Foto {fIdx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2 text-gray-400 text-xs">
                  <span className="material-symbols-outlined text-lg">hide_image</span>
                  <span>Tidak ada foto bukti dukung pada laporan ini.</span>
                </div>
              )}
            </div>

            {/* Ringkasan Data Laporan */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 mb-5 text-xs text-gray-700 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-400 w-24 shrink-0 text-[11px]">Waktu:</span>
                <span className="font-medium text-gray-900">
                  {(() => {
                    const t = parseRobustDate(reportToDelete.Tanggal, reportToDelete.Pukul || '00:00');
                    if (t > 0) {
                      return new Intl.DateTimeFormat('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      }).format(new Date(t));
                    }
                    return reportToDelete.Tanggal || '-';
                  })()} 
                  {reportToDelete.Pukul && reportToDelete.Pukul !== '-' && ` • Pukul ${reportToDelete.Pukul}`}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-400 w-24 shrink-0 text-[11px]">Rencana Aksi:</span>
                <span className="font-bold text-gray-900 leading-snug">
                  {reportToDelete.RencanaAksi || reportToDelete.JenisRHK || '-'}
                </span>
              </div>

              {reportToDelete.Lokasi && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-gray-400 w-24 shrink-0 text-[11px]">Lokasi:</span>
                  <span className="font-medium text-gray-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-gray-400">location_on</span>
                    {reportToDelete.Lokasi}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Ya, Hapus Laporan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Edit Laporan ────────────────────────────── */}
      {editModalOpen && editingReport && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full p-6 my-8 animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
                  <span className="material-symbols-outlined text-xl">edit_note</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Edit Laporan RHK</h3>
                  <p className="text-[11px] text-gray-500">Perbarui rincian kegiatan dan narasi laporan Anda.</p>
                </div>
              </div>
              <button 
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="overflow-y-auto pr-1 space-y-3.5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">Tanggal Pelaksanaan *</label>
                  <input
                    type="date"
                    required
                    value={editForm.tanggal}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tanggal: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">Jam / Pukul *</label>
                  <input
                    type="time"
                    required
                    value={editForm.pukul}
                    onChange={(e) => setEditForm(prev => ({ ...prev, pukul: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>
              </div>

              {/* Jenis RHK (Dropdown lengkap seluruh RHK master) */}
              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">Jenis RHK *</label>
                <select
                  required
                  value={editForm.jenisRHK}
                  onChange={(e) => {
                    const newJenis = e.target.value;
                    const item = MASTER_RHK_DATA.find(m => m.jenis === newJenis);
                    const newId = item ? item.id : editForm.idRHK;
                    const availableRencana = item ? item.rencanaList : [];
                    setEditForm(prev => ({
                      ...prev,
                      jenisRHK: newJenis,
                      idRHK: newId,
                      rencanaAksi: availableRencana.length > 0 ? availableRencana[0] : ''
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white font-medium text-gray-800"
                >
                  <option value="">— Pilih Jenis RHK —</option>
                  {MASTER_RHK_DATA.map((item) => (
                    <option key={item.id} value={item.jenis}>
                      {item.id} — {item.jenis}
                    </option>
                  ))}
                  {/* Fallback jika laporan lama memiliki JenisRHK di luar master */}
                  {editForm.jenisRHK && !MASTER_RHK_DATA.some(m => m.jenis === editForm.jenisRHK) && (
                    <option value={editForm.jenisRHK}>{editForm.idRHK || 'RHK'} — {editForm.jenisRHK}</option>
                  )}
                </select>
              </div>

              {/* Rencana Aksi (Dropdown cascading menyesuaikan Jenis RHK terpilih) */}
              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">Rencana Aksi (Sesuai RHK) *</label>
                {(() => {
                  const item = MASTER_RHK_DATA.find(m => m.jenis === editForm.jenisRHK || m.id === editForm.idRHK);
                  const availableRencana = item ? item.rencanaList : [];
                  return (
                    <select
                      required
                      value={editForm.rencanaAksi}
                      onChange={(e) => setEditForm(prev => ({ ...prev, rencanaAksi: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white font-medium text-gray-800"
                    >
                      <option value="">— Pilih Rencana Aksi —</option>
                      {availableRencana.map((aksi, i) => (
                        <option key={i} value={aksi}>
                          {aksi}
                        </option>
                      ))}
                      {/* Nilai kustom jika tidak ada dalam daftar master */}
                      {editForm.rencanaAksi && !availableRencana.includes(editForm.rencanaAksi) && (
                        <option value={editForm.rencanaAksi}>{editForm.rencanaAksi}</option>
                      )}
                    </select>
                  );
                })()}
              </div>

              {/* Foto Bukti Dukung (Edit / Tambah / Ganti Foto) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-cyan-600">photo_library</span>
                    Foto Bukti Dukung ({editExistingPhotos.length + editNewPhotos.length})
                  </label>
                  <label className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>
                    <span>Tambah Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleAddEditPhotos}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  {editExistingPhotos.length === 0 && editNewPhotos.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-xs">
                      <span className="material-symbols-outlined text-3xl mb-1 block opacity-40">image_not_supported</span>
                      <p>Belum ada foto bukti dukung.</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Klik &ldquo;Tambah Foto&rdquo; untuk memilih foto dari perangkat Anda.</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {/* Foto Lama (Google Drive) */}
                      {editExistingPhotos.map((fotoId, fIdx) => (
                        <div key={`existing-${fIdx}`} className="relative rounded-xl overflow-hidden border border-gray-200 shadow-xs bg-white h-24 w-32 shrink-0 group">
                          <img
                            src={`/api/image-proxy?id=${fotoId}`}
                            alt={`Bukti ${fIdx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.src.includes('drive.google.com')) {
                                target.src = `https://drive.google.com/thumbnail?id=${fotoId}&sz=w400-h400`;
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingPhoto(fIdx)}
                            className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 hover:scale-110 transition-all shadow-sm cursor-pointer"
                            title="Hapus foto ini"
                          >
                            <span className="material-symbols-outlined text-[13px] block">close</span>
                          </button>
                          <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.2 rounded font-mono">
                            Foto {fIdx + 1}
                          </div>
                        </div>
                      ))}

                      {/* Foto Baru (Pending Upload) */}
                      {editNewPhotos.map((item, nIdx) => (
                        <div key={`new-${nIdx}`} className="relative rounded-xl overflow-hidden border-2 border-dashed border-cyan-400 shadow-xs bg-cyan-50 h-24 w-32 shrink-0 group">
                          <img
                            src={item.previewUrl}
                            alt={`Foto Baru ${nIdx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewPhoto(nIdx)}
                            className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 hover:scale-110 transition-all shadow-sm cursor-pointer"
                            title="Batalkan foto ini"
                          >
                            <span className="material-symbols-outlined text-[13px] block">close</span>
                          </button>
                          <div className="absolute bottom-1 left-1 bg-cyan-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold">
                            Baru {nIdx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Narasi Laporan */}
              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">Narasi Laporan (Diedit)</label>
                <textarea
                  rows={12}
                  value={editForm.narasiEdited}
                  onChange={(e) => setEditForm(prev => ({ ...prev, narasiEdited: e.target.value }))}
                  placeholder="Narasi laporan lengkap..."
                  className="w-full min-h-[280px] p-3 border border-gray-300 rounded-lg text-xs leading-relaxed focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none font-sans resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-cyan-600 text-white rounded-lg text-xs font-bold hover:bg-cyan-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isSavingEdit ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{isUploadingEditPhoto ? 'Mengunggah Foto...' : 'Menyimpan...'}</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Premium Access Lock ────────────────────────── */}
      {premiumModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-md w-full p-6 my-6 animate-scale-up text-center relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-100 rounded-full blur-2xl -z-10"></div>
            
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
              <span className="material-symbols-outlined text-3xl">workspace_premium</span>
            </div>

            <h3 className="text-xl font-bold text-gray-900 font-['Outfit']">Fitur Khusus ASPEND Premium</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed px-2">
              Fitur <b>Buat Laporan RHK</b> dengan AI Narasi Otomatis dan Ekspor PDF Kemensos adalah fitur eksklusif untuk anggota Premium.
            </p>

            <div className="my-5 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-left space-y-2 text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base">check_circle</span>
                <span className="font-semibold">Buat Laporan RHK tanpa batas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base">auto_awesome</span>
                <span>Penyusunan Narasi AI Resmi Kemensos instan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base">picture_as_pdf</span>
                <span>Otomatis simpan PDF ke Google Drive pribadi</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base">block</span>
                <span>Bebas iklan tanpa gangguan</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-5 text-left">
              <div className="p-3 border border-gray-200 rounded-xl bg-gray-50/50">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Paket 1 Bulan</span>
                <div className="text-base font-bold text-gray-900 mt-0.5">Rp 10.000</div>
                <span className="text-[10px] text-gray-500">Per 30 Hari</span>
              </div>
              <div className="p-3 border-2 border-amber-400 rounded-xl bg-amber-50/40 relative">
                <span className="absolute -top-2 right-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">Hemat 2 Bln</span>
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Paket 1 Tahun</span>
                <div className="text-base font-bold text-amber-900 mt-0.5">Rp 100.000</div>
                <span className="text-[10px] text-gray-500">Per 365 Hari</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent('Halo Admin ASPEND, saya ingin melakukan aktivasi paket Premium untuk akun: ' + (session?.user?.email || ''))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                <span>Hubungi Admin untuk Aktivasi</span>
              </a>
              <button
                onClick={() => setPremiumModalOpen(false)}
                className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Pratinjau Foto Bukti Dukung (Full Screen Viewer) ─── */}
      {previewPhotoModalUrl && (
        <div 
          onClick={() => setPreviewPhotoModalUrl(null)}
          className="fixed inset-0 z-[170] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <img 
              src={previewPhotoModalUrl} 
              alt="Preview Bukti Dukung" 
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setPreviewPhotoModalUrl(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Modal Riwayat Poin ────────────────────────── */}
      {showPoinHistoryModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-5 my-6 animate-scale-up flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-600 text-xl">history</span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Riwayat Poin Kegiatan</h4>
                  {createForm.jenisRHK && (
                    <span className="text-[11px] font-semibold text-cyan-700 block">
                      {createForm.idRHK ? `[${createForm.idRHK}] ` : ''}
                      {createForm.jenisRHK.length > 36 ? createForm.jenisRHK.substring(0, 36) + '...' : createForm.jenisRHK}
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowPoinHistoryModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Pilih poin kegiatan dari laporan sebelumnya untuk disalin ke formulir:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {poinHistory && poinHistory.length > 0 ? (
                poinHistory.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      setCreateForm(prev => ({
                        ...prev,
                        poinKegiatan: item
                      }));
                      setShowPoinHistoryModal(false);
                      showToast('Poin kegiatan berhasil disalin.', 'success');
                    }}
                    className="p-3 bg-gray-50 hover:bg-cyan-50 border border-gray-200 hover:border-cyan-300 rounded-xl cursor-pointer text-xs text-gray-700 hover:text-cyan-900 transition-all space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>Poin #{idx + 1}</span>
                      <span className="text-cyan-600 font-bold flex items-center gap-0.5">
                        Gunakan <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                      </span>
                    </div>
                    <p className="line-clamp-3 whitespace-pre-wrap">{item}</p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-400 text-xs space-y-1">
                  <span className="material-symbols-outlined text-3xl mb-1 block opacity-40">history_toggle_off</span>
                  <span className="font-semibold text-gray-600 block">Belum ada riwayat poin di Google Sheets untuk {createForm.idRHK || 'RHK ini'}.</span>
                  <span className="text-[10px] text-gray-400 block">Poin kegiatan yang diinput pada laporan akan otomatis tersimpan sebagai riwayat.</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 mt-3 flex justify-end">
              <button
                onClick={() => setShowPoinHistoryModal(false)}
                className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Backdrop Overlay untuk Sidebar Drawer ─────────── */}
      <div 
        onClick={() => setIsSidebarOpen(false)}
        className={`fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* ─── SideNavBar Drawer (Tersembunyi Total secara Default) ─── */}
      <aside 
        className={`sidebar bg-primary text-white fixed left-0 top-0 h-full w-[280px] shadow-2xl flex flex-col py-6 px-4 z-50 transition-transform duration-300 ease-in-out border-r border-white/20 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header: Logo, Title, and Close Button */}
        <div className="flex items-center justify-between pb-4 border-b border-white/15 mb-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="ASPEND Logo" width={36} height={36} className="rounded-xl shadow-lg border border-white/20 object-cover bg-white" />
            <div>
              <span className="font-['Outfit'] font-bold text-lg text-white tracking-wide block leading-tight">ASPEND</span>
              <span className="text-[10px] text-white/80 font-medium tracking-wide uppercase">Pendamping PKH</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer"
            title="Tutup Menu"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Profile Card */}
        <div 
          onClick={() => {
            setActivePage('profile');
            setIsSidebarOpen(false);
          }}
          className="flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer mb-5 border border-white/10 group/prof"
          title="Buka Profil Pengguna"
        >
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/90 bg-white flex items-center justify-center font-bold text-base text-primary shadow-md">
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt="Foto Profil" className="w-full h-full object-cover" />
              ) : (
                <span className="uppercase text-primary font-bold">{profile?.nama?.charAt(0) || session?.user?.name?.charAt(0) || '-'}</span>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 bg-gradient-to-r from-amber-400 to-amber-600 text-white rounded-full p-[2px] shadow-sm border border-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[10px]">workspace_premium</span>
            </div>
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-xs text-white truncate font-bold group-hover/prof:underline">{profile?.nama || session?.user?.name}</p>
            <p className="text-[10px] text-white/80 truncate">{profile?.jabatan || 'Pendamping PKH'}</p>
            <p className="text-[9px] text-white/60 truncate font-mono mt-0.5">{profile?.email || session?.user?.email}</p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          <button 
            onClick={() => {
              setActivePage('dashboard');
              setIsSidebarOpen(false);
            }}
            className={`w-full text-left nav-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
              activePage === 'dashboard' ? 'text-white bg-white/25 shadow-sm font-bold' : 'text-white/90 hover:text-white hover:bg-white/10'
            } cursor-pointer`}
          >
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            <span>Dashboard RHK</span>
          </button>
          
          <button 
            onClick={() => {
              setActivePage('profile');
              setIsSidebarOpen(false);
            }}
            className={`w-full text-left nav-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
              activePage === 'profile' ? 'text-white bg-white/25 shadow-sm font-bold' : 'text-white/90 hover:text-white hover:bg-white/10'
            } cursor-pointer`}
          >
            <span className="material-symbols-outlined text-[20px]">account_circle</span>
            <span>Profil Pengguna</span>
          </button>

          <button 
            onClick={() => {
              handleOpenCreateReport();
              setIsSidebarOpen(false);
            }}
            className={`w-full text-left nav-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
              activePage === 'form' ? 'text-white bg-white/25 shadow-sm font-bold' : 'text-white/90 hover:text-white hover:bg-white/10'
            } cursor-pointer active:scale-95`}
          >
            <span className="material-symbols-outlined text-[20px]">add_box</span>
            <span>Buat Laporan RHK</span>
          </button>

          {/* ── Divider ── */}
          <div className="my-2 border-t border-white/15"></div>

          {/* ── Profil KPM (Expandable Menu) ── */}
          <button 
            onClick={() => setKpmMenuExpanded(!kpmMenuExpanded)}
            className={`w-full text-left nav-item flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
              activePage.startsWith('kpm-') ? 'text-white bg-white/25 shadow-sm font-bold' : 'text-white/90 hover:text-white hover:bg-white/10'
            } cursor-pointer`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">group</span>
              <span>Profil KPM</span>
            </div>
            <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${kpmMenuExpanded ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>

          {/* Sub-menu KPM */}
          <div className={`overflow-hidden transition-all duration-300 ${kpmMenuExpanded ? 'max-h-[380px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
            <div className="ml-3 pl-3 border-l-2 border-white/20 space-y-1">
              <button 
                onClick={() => {
                  setActivePage('kpm-dashboard');
                  setIsSidebarOpen(false);
                }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-[13px] font-medium ${
                  activePage === 'kpm-dashboard' ? 'text-white bg-white/20 font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'
                } cursor-pointer`}
              >
                <span className="material-symbols-outlined text-[18px]">analytics</span>
                <span>Dashboard KPM</span>
              </button>
              <button 
                onClick={() => {
                  setActivePage('kpm-data');
                  setIsSidebarOpen(false);
                }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-[13px] font-medium ${
                  activePage === 'kpm-data' ? 'text-white bg-white/20 font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'
                } cursor-pointer`}
              >
                <span className="material-symbols-outlined text-[18px]">family_restroom</span>
                <span>Data KPM</span>
              </button>
              <button 
                onClick={() => {
                  setActivePage('kpm-masalah');
                  setIsSidebarOpen(false);
                }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-[13px] font-medium ${
                  activePage === 'kpm-masalah' ? 'text-white bg-white/20 font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'
                } cursor-pointer`}
              >
                <span className="material-symbols-outlined text-[18px]">report_problem</span>
                <span>Permasalahan KPM</span>
              </button>
              <button 
                onClick={() => {
                  setActivePage('kpm-graduasi');
                  setIsSidebarOpen(false);
                }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-[13px] font-medium ${
                  activePage === 'kpm-graduasi' ? 'text-white bg-white/20 font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'
                } cursor-pointer`}
              >
                <span className="material-symbols-outlined text-[18px]">school</span>
                <span>Graduasi & PPSE</span>
              </button>
              <button 
                onClick={() => {
                  setActivePage('kpm-analisa-tahap');
                  setIsSidebarOpen(false);
                }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-[13px] font-medium ${
                  activePage === 'kpm-analisa-tahap' ? 'text-white bg-white/20 font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'
                } cursor-pointer`}
              >
                <span className="material-symbols-outlined text-[18px]">compare_arrows</span>
                <span>Analisa Tahap</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Logout */}
        <div className="mt-auto border-t border-white/15 pt-3 space-y-1">
          <button 
            onClick={() => {
              setIsSidebarOpen(false);
              signOut();
            }} 
            className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:text-white hover:bg-rose-500/30 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Content Area (100% Lebar Layar Penuh) ─────── */}
      <div className="flex-1 flex flex-col h-full transition-all duration-300 w-full overflow-y-auto bg-[#F5F7FA]">
        
        {/* ─── Top App Bar dengan Toggle Menu Profesional ─────────── */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/90 px-3 sm:px-5 h-14 flex items-center justify-between shadow-2xs shrink-0">
          <div className="flex items-center gap-3">
            {/* Toggle Menu Button Profesional di Pojok Kiri Atas */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-50 to-white hover:from-cyan-50 hover:to-sky-50 active:scale-95 border border-slate-200 hover:border-cyan-400 text-slate-700 hover:text-cyan-800 shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer group"
              title="Buka Menu Navigasi ASPEND"
            >
              <span className="material-symbols-outlined text-[20px] text-cyan-700 group-hover:scale-110 transition-transform">menu</span>
              <span className="text-xs font-bold font-['Outfit'] tracking-wide text-slate-700 group-hover:text-cyan-900">
                Menu
              </span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Breadcrumb Brand & Page Indicator */}
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="ASPEND Logo" width={26} height={26} className="rounded-lg shadow-2xs hidden sm:inline" />
              <span className="font-['Outfit'] font-bold text-sm text-slate-800 tracking-tight hidden md:inline">ASPEND</span>
              <span className="text-slate-300 hidden md:inline text-xs">•</span>
              <span className="text-xs font-bold text-cyan-900 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 shadow-2xs">
                <span className="material-symbols-outlined text-[15px] text-cyan-700">
                  {activePage.startsWith('kpm-data')
                    ? 'family_restroom'
                    : activePage === 'kpm-dashboard'
                    ? 'analytics'
                    : activePage === 'kpm-masalah'
                    ? 'report_problem'
                    : activePage === 'kpm-graduasi'
                    ? 'school'
                    : activePage === 'kpm-analisa-tahap'
                    ? 'compare_arrows'
                    : activePage === 'profile'
                    ? 'account_circle'
                    : activePage === 'form'
                    ? 'add_box'
                    : 'dashboard'}
                </span>
                <span>
                  {activePage.startsWith('kpm-data')
                    ? 'Data KPM PKH'
                    : activePage === 'kpm-dashboard'
                    ? 'Dashboard KPM'
                    : activePage === 'kpm-masalah'
                    ? 'Permasalahan KPM'
                    : activePage === 'kpm-graduasi'
                    ? 'Graduasi & PPSE'
                    : activePage === 'kpm-analisa-tahap'
                    ? 'Analisa Tahap Bansos'
                    : activePage === 'profile'
                    ? 'Profil Pengguna'
                    : activePage === 'form'
                    ? 'Buat Laporan RHK'
                    : 'Dashboard RHK'}
                </span>
              </span>
            </div>
          </div>

          {/* Sisi Kanan: Profil Pengguna Cepat */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActivePage('profile')}
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 cursor-pointer transition-all text-left"
              title="Buka Profil Pengguna"
            >
              <div className="w-7 h-7 rounded-full bg-cyan-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs overflow-hidden">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="Foto Profil" className="w-full h-full object-cover" />
                ) : (
                  profile?.nama?.charAt(0) || session?.user?.name?.charAt(0) || 'P'
                )}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                  {profile?.nama || session?.user?.name || 'Pendamping'}
                </p>
                <p className="text-[10px] text-slate-500 truncate max-w-[120px]">
                  {profile?.jabatan || 'PKH'}
                </p>
              </div>
            </button>
          </div>
        </header>
        
        {/* ══════════════════════════════════════════════════════════
            PAGE: DASHBOARD RHK
            ══════════════════════════════════════════════════════════ */}
        {activePage === 'dashboard' && (
          <main className="flex-grow p-3 md:p-4 w-full max-w-[1440px] mx-auto">
            
            {/* Header Title & Stats */}
            <div className="mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1D21] mb-0.5 font-['Outfit']">Dashboard Laporan RHK</h2>
                <p className="text-xs text-gray-500 mb-2">Kelola dan tinjau laporan pendampingan sosial secara real-time.</p>
                <button 
                  onClick={handleOpenCreateReport}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg shadow-sm hover:shadow-md hover:scale-[1.02] transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer border border-teal-500 w-fit"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Buat Laporan RHK
                </button>
              </div>
              
              <div className="flex flex-row flex-wrap gap-2.5">
                {/* Card Total Laporan */}
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl px-3.5 py-2.5 flex items-center gap-3 min-w-[140px]">
                  <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg flex-shrink-0">
                    <span className="material-symbols-outlined text-xl">summarize</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[9px] uppercase block font-bold">TOTAL LAPORAN</span>
                    <div className="text-xl text-[#1A1D21] font-black leading-none">{stats.total}</div>
                  </div>
                </div>
                
                {/* Card Bulan Ini & Badges */}
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl px-3.5 py-2.5 flex flex-row items-center gap-3 min-w-[260px]">
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg flex-shrink-0">
                      <span className="material-symbols-outlined text-xl">calendar_today</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[9px] uppercase block font-bold">BULAN INI</span>
                      <div className="text-xl text-[#1A1D21] font-black leading-none">{stats.month}</div>
                    </div>
                  </div>
                  
                  {/* RHK Badges Colorful & High Contrast */}
                  <div className="flex flex-wrap gap-1.5 justify-end ml-auto max-w-[190px]">
                    {Object.entries(stats.rhkBreakdown).map(([rhkKey, count]) => {
                      const style = getRhkBadgeStyle(rhkKey);
                      return (
                        <div key={rhkKey} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold shadow-xs ${style.bg} ${style.text} ${style.border}`}>
                          <span>{rhkKey}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black leading-none ${style.numBg} ${style.numText}`}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Bar & Main Card */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-xl flex flex-col overflow-hidden">
              {/* Filter Bar */}
              <div className="p-2.5 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-2 items-center">
                <div className="w-[140px] md:w-[170px] relative shrink-0">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[15px]">search</span>
                  <input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-colors bg-white" 
                    placeholder="Cari laporan..." 
                    type="text" 
                  />
                </div>
                <select 
                  value={filterJenis}
                  onChange={(e) => {
                    setFilterJenis(e.target.value);
                    setFilterAksi("");
                  }}
                  className="w-[150px] md:w-[200px] shrink-0 truncate px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white"
                >
                  <option value="">Semua Jenis RHK</option>
                  {jenisRHKOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
                <select 
                  value={filterAksi}
                  onChange={(e) => setFilterAksi(e.target.value)}
                  className="w-[150px] md:w-[200px] shrink-0 truncate px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white"
                >
                  <option value="">Semua Rencana Aksi</option>
                  {rencanaAksiOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
                <input 
                  type="month" 
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="shrink-0 w-[120px] px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white text-gray-700" 
                />
                <input 
                  type="date" 
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="shrink-0 w-[120px] px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white text-gray-700" 
                />

                {/* Badge informasi hasil filter menarik dan jelas di tengah */}
                {isFiltered && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-lg text-xs font-bold shadow-xs">
                    <span className="material-symbols-outlined text-[16px] text-cyan-600">filter_alt</span>
                    <span>
                      Ditemukan: <span className="bg-cyan-600 text-white px-2 py-0.5 rounded-full text-xs font-black shadow-xs ml-0.5">{totalFiltered}</span> laporan
                    </span>
                  </div>
                )}

                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <button 
                    onClick={resetFilters}
                    className="px-2.5 py-1.5 border border-rose-200 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-100 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[13px]">refresh</span>
                    Reset
                  </button>
                </div>
              </div>

              {/* Split Screen Layout */}
              <div className="flex flex-col lg:flex-row w-full min-h-[520px]">
                
                {/* KIRI: TABEL LAPORAN (48%) */}
                <div className="w-full lg:w-[48%] border-r border-gray-200 overflow-x-hidden overflow-y-auto">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                      <div className="spinner mb-3 border-t-cyan-500 w-8 h-8 border-3 border-solid rounded-full animate-spin"></div>
                      <p className="text-gray-500 text-xs font-medium">Menyinkronkan data Google Sheets...</p>
                    </div>
                  ) : filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                      <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">receipt_long</span>
                      <p className="text-gray-500 text-xs font-medium">Tidak ada laporan yang sesuai dengan filter.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-separate border-spacing-y-2.5 px-2.5">
                      <thead>
                        <tr className="text-[10px] text-gray-400 uppercase tracking-wider">
                          <th className="px-3 py-1 font-bold text-center w-28 md:w-32">FOTO</th>
                          <th className="px-3 py-1 font-bold whitespace-nowrap w-[130px] md:w-[140px]">WAKTU & TANGGAL</th>
                          <th className="px-3 py-1 font-bold">RHK & RENCANA AKSI</th>
                          <th className="px-2 py-1 font-bold text-center w-20">AKSI</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {paginatedReports.map((report, idx) => {
                          const isSelected = selectedReport?.ReportId === report.ReportId;
                          const prevReport = idx > 0 ? paginatedReports[idx - 1] : null;
                          const prevDateKey = prevReport ? getDateGroupKey(prevReport.Tanggal) : null;
                          const currentDateKey = getDateGroupKey(report.Tanggal);
                          const showGroupHeader = !prevReport || prevDateKey !== currentDateKey;
                          const firstPhotoId = report.FotoIds && report.FotoIds.length > 0 ? report.FotoIds[0] : null;

                          const idText = report.IdRHK || report.JenisRHK || '';
                          const angkaRHK = idText.replace(/\D/g, '') || '?';
                          const rhkStyle = getRhkBadgeStyle(angkaRHK);

                          return (
                            <React.Fragment key={report.ReportId || idx}>
                              {/* Group Date Header */}
                              {showGroupHeader && (
                                <tr>
                                  <td colSpan={4} className={`px-1 ${idx > 0 ? 'pt-8 pb-2.5' : 'pt-1.5 pb-2'}`}>
                                    <div className="flex items-center gap-2.5">
                                      <div className="h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent flex-grow"></div>
                                      <span className="text-[10px] font-extrabold text-cyan-800 uppercase tracking-wider bg-cyan-50/90 px-3 py-0.5 rounded-full border border-cyan-200/90 shadow-2xs">
                                        {formatDateGroup(report.Tanggal)}
                                      </span>
                                      <div className="h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent flex-grow"></div>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {/* Report Row (BORDERED CARD WITH MOVING LIGHT BEAMS ON SELECTED & CLEAN ROUNDED CORNERS) */}
                              <tr 
                                onClick={() => setSelectedReport(report)}
                                className={`transition-all duration-150 cursor-pointer ${
                                  isSelected 
                                    ? 'bg-cyan-50/90 shadow-xs' 
                                    : 'bg-white hover:bg-gray-50/80 shadow-xs hover:shadow-sm'
                                }`}
                              >
                                {/* Photo (Tinggi 88px Sejajar Kolom Tengah & Tombol Unduh + Fitur Preview) */}
                                <td className={`relative px-2.5 py-2.5 align-middle text-center w-28 md:w-32 rounded-l-xl border-l-2 border-t-2 border-b-2 overflow-hidden ${
                                  isSelected ? 'border-cyan-400' : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <>
                                      <div className="card-light-beam-top rounded-tl-xl" />
                                      <div className="card-light-beam-bottom rounded-bl-xl" />
                                      <div className="card-light-beam-left rounded-l-xl" />
                                    </>
                                  )}

                                  {firstPhotoId ? (
                                    <div 
                                      className="relative group/foto cursor-zoom-in w-24 h-[86px] md:w-26 md:h-[88px] rounded-lg overflow-hidden border border-gray-300 shadow-xs mx-auto"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewPhotoModalUrl(`/api/image-proxy?id=${firstPhotoId}`);
                                      }}
                                      title="Klik untuk melihat foto ukuran penuh"
                                    >
                                      <img 
                                        src={`/api/image-proxy?id=${firstPhotoId}`}
                                        className="w-full h-full object-cover group-hover/foto:scale-105 transition-transform duration-200" 
                                        alt="Foto Dokumentasi"
                                        loading="lazy"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          if (!target.src.includes('drive.google.com')) {
                                            target.src = `https://drive.google.com/thumbnail?id=${firstPhotoId}&sz=w400-h400`;
                                          }
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover/foto:bg-black/30 flex items-center justify-center transition-all opacity-0 group-hover/foto:opacity-100">
                                        <span className="material-symbols-outlined text-white text-lg drop-shadow-md">zoom_in</span>
                                      </div>
                                      {report.FotoIds && report.FotoIds.length > 1 && (
                                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-md backdrop-blur-xs">
                                          +{report.FotoIds.length - 1}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="w-24 h-[86px] md:w-26 md:h-[88px] rounded-lg bg-gray-100 flex flex-col items-center justify-center text-gray-400 border border-gray-200 mx-auto">
                                      <span className="material-symbols-outlined text-[20px]">hide_image</span>
                                      <span className="text-[9px] text-gray-400 mt-0.5">Tanpa Foto</span>
                                    </div>
                                  )}
                                </td>

                                {/* Waktu & Tanggal */}
                                <td className={`relative px-2.5 py-2.5 align-middle whitespace-normal w-[130px] md:w-[140px] border-t-2 border-b-2 overflow-hidden ${
                                  isSelected ? 'border-cyan-400' : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <>
                                      <div className="card-light-beam-top" />
                                      <div className="card-light-beam-bottom" />
                                    </>
                                  )}

                                  <div className="flex flex-col justify-between h-[88px]">
                                    <div className="font-bold text-xs text-gray-900 leading-tight">
                                      {(() => {
                                        const t = parseRobustDate(report.Tanggal, report.Pukul || '00:00');
                                        if (t > 0) {
                                          return new Intl.DateTimeFormat('id-ID', {
                                            weekday: 'short',
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                          }).format(new Date(t));
                                        }
                                        return report.Tanggal || '-';
                                      })()}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-cyan-800 font-bold bg-cyan-50 border border-cyan-200 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded">
                                        <span className="material-symbols-outlined text-[10px]">schedule</span>
                                        {report.Pukul || '14:00'}
                                      </span>
                                      <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                        SELESAI
                                      </span>
                                    </div>
                                    {report.Lokasi ? (
                                      <div 
                                        className="text-[10px] text-gray-500 max-w-[130px] truncate whitespace-nowrap overflow-hidden flex items-center gap-0.5 leading-none" 
                                        title={report.Lokasi}
                                      >
                                        <span className="material-symbols-outlined text-[11px] text-gray-400 shrink-0">location_on</span>
                                        <span className="truncate">{report.Lokasi}</span>
                                      </div>
                                    ) : (
                                      <div className="h-[10px]"></div>
                                    )}
                                  </div>
                                </td>

                                {/* RHK & Rencana Aksi (Mendukung hingga 3 baris utuh & Kotak RHK Sejajar Tombol Unduh) */}
                                <td className={`relative px-3 py-2.5 align-middle border-t-2 border-b-2 overflow-hidden ${
                                  isSelected ? 'border-cyan-400' : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <>
                                      <div className="card-light-beam-top" />
                                      <div className="card-light-beam-bottom" />
                                    </>
                                  )}

                                  <div className="flex flex-col justify-between h-[88px]">
                                    {/* Rencana Aksi (Mendukung hingga 3 baris teks secara utuh) */}
                                    <div>
                                      <h4 
                                        className="font-bold text-gray-900 text-[11px] md:text-xs leading-snug line-clamp-3" 
                                        title={report.RencanaAksi || report.JenisRHK}
                                      >
                                        {report.RencanaAksi || report.JenisRHK || '-'}
                                      </h4>
                                    </div>

                                    {/* Kotak Jenis RHK & Tulisannya (Lebih kompak, sejajar presisi dengan tombol unduh) */}
                                    <div className={`px-2 py-1 rounded-md border flex items-center gap-1.5 ${rhkStyle.bg} ${rhkStyle.border}`}>
                                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs shrink-0 ${rhkStyle.numBg} ${rhkStyle.numText}`}>
                                        RHK-{angkaRHK}
                                      </span>
                                      <p 
                                        className={`text-[11px] font-semibold leading-tight line-clamp-1 ${rhkStyle.text}`} 
                                        title={report.JenisRHK}
                                      >
                                        {report.JenisRHK || '-'}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                {/* Aksi (Tombol Disable jika belum dipilih; Aktif saat baris dipilih) */}
                                <td className={`relative px-2 py-2.5 align-middle text-center w-20 rounded-r-xl border-r-2 border-t-2 border-b-2 ${
                                  isSelected ? 'border-cyan-400' : 'border-gray-300'
                                }`} onClick={(e) => {
                                  if (!isSelected) {
                                    // Klik pada area aksi tetap memilih baris laporan jika belum dipilih
                                    setSelectedReport(report);
                                  } else {
                                    e.stopPropagation();
                                  }
                                }}>
                                  {isSelected && (
                                    <>
                                      <div className="card-light-beam-top rounded-tr-xl" />
                                      <div className="card-light-beam-bottom rounded-br-xl" />
                                      <div className="card-light-beam-right rounded-r-xl" />

                                      {/* Tanda Panah Bergerak Menunjuk ke Lembar Pratinjau Laporan PDF */}
                                      <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-30 items-center pointer-events-none animate-arrow-bounce">
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md border-2 border-white">
                                          <span className="material-symbols-outlined text-[13px] font-black leading-none">arrow_forward</span>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  <div className={`flex flex-col justify-between h-[88px] items-center transition-all duration-200 ${
                                    isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-30 pointer-events-none select-none'
                                  }`}>
                                    {/* Tombol Edit & Hapus (Disable jika baris tidak dipilih) */}
                                    <div className="flex items-center gap-1.5">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isSelected) handleOpenEdit(report);
                                        }}
                                        disabled={!isSelected}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg border shadow-xs transition-all ${
                                          isSelected 
                                            ? 'text-cyan-700 hover:text-cyan-800 bg-white border-cyan-200 hover:bg-cyan-50 cursor-pointer active:scale-95' 
                                            : 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed'
                                        }`}
                                        title={isSelected ? "Edit Data" : "Pilih laporan terlebih dahulu"}
                                      >
                                        <span className="material-symbols-outlined text-[15px]">edit</span>
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isSelected) handleOpenDelete(report);
                                        }}
                                        disabled={!isSelected}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg border shadow-xs transition-all ${
                                          isSelected 
                                            ? 'text-rose-600 hover:text-rose-700 bg-white border-rose-200 hover:bg-rose-50 cursor-pointer active:scale-95' 
                                            : 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed'
                                        }`}
                                        title={isSelected ? "Hapus Data" : "Pilih laporan terlebih dahulu"}
                                      >
                                        <span className="material-symbols-outlined text-[15px]">delete</span>
                                      </button>
                                    </div>

                                    {/* Tombol Unduh (Disable jika baris tidak dipilih) */}
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isSelected) handleDownloadPdf(report);
                                      }}
                                      disabled={!isSelected}
                                      className={`px-2 py-1.5 rounded-lg text-[10.5px] font-bold transition-all flex items-center justify-center gap-1 shadow-xs w-full ${
                                        isSelected 
                                          ? 'bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer active:scale-95' 
                                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      }`}
                                      title={isSelected ? "Unduh PDF" : "Pilih laporan terlebih dahulu"}
                                    >
                                      <span className="material-symbols-outlined text-[13px]">download</span>
                                      Unduh
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* KANAN: PDF PREVIEW (52%) */}
                <div className="w-full lg:w-[52%] bg-gray-50 relative flex flex-col">
                  <div className="px-3 py-1.5 border-b border-gray-200 bg-white flex justify-between items-center h-[34px]">
                    <div className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-cyan-600">preview</span>
                      Pratinjau Laporan PDF
                    </div>
                    {selectedReport?.PdfFileId && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDownloadPdf(selectedReport)}
                          className="p-1 text-gray-500 hover:text-cyan-600 rounded hover:bg-gray-100 flex items-center"
                          title="Unduh PDF"
                        >
                          <span className="material-symbols-outlined text-[15px]">download</span>
                        </button>
                        <a 
                          href={`https://drive.google.com/file/d/${selectedReport.PdfFileId}/view`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1 text-gray-500 hover:text-cyan-600 rounded hover:bg-gray-100 flex items-center"
                          title="Buka di tab baru"
                        >
                          <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex-grow flex items-center justify-center p-2 min-h-[460px]">
                    {selectedReport && selectedReport.PdfFileId ? (
                      <iframe 
                        key={`${selectedReport.PdfFileId}_${pdfRefreshTimestamp}`}
                        src={`https://drive.google.com/file/d/${selectedReport.PdfFileId}/preview`} 
                        className="w-full h-full min-h-[480px] border-0 rounded-lg shadow-sm bg-white"
                        title="PDF Preview"
                      />
                    ) : (
                      <div className="text-center p-6 text-gray-400">
                        <span className="material-symbols-outlined text-5xl mb-2 block opacity-40">picture_as_pdf</span>
                        <p className="text-xs font-medium text-gray-500">Klik laporan di tabel sebelah kiri<br />untuk memuat pratinjau PDF di sini.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Pagination Bar */}
              <div className="p-3 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                {/* Left: Row Selector & Count Info */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 font-medium">Tampilkan:</span>
                    <select 
                      value={pageSize} 
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-800 font-semibold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-xs cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-gray-500 font-medium">baris</span>
                  </div>

                  <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>

                  <div>
                    Menampilkan <span className="font-bold text-gray-900">{startItem} - {endItem}</span> dari <span className="font-bold text-gray-900">{totalFiltered}</span> laporan
                    {totalFiltered !== reports.length && (
                      <span className="text-gray-400 ml-1">(difilter dari total {reports.length})</span>
                    )}
                  </div>
                </div>

                {/* Right: Full Navigation Controls */}
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  {/* Paling Awal */}
                  <button 
                    onClick={() => setCurrentPage(1)} 
                    disabled={validCurrentPage <= 1} 
                    title="Halaman Pertama (Paling Awal)" 
                    className="px-2 py-1 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">keyboard_double_arrow_left</span>
                    <span className="hidden sm:inline ml-0.5 text-[11px]">Awal</span>
                  </button>

                  {/* Sebelumnya */}
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                    disabled={validCurrentPage <= 1} 
                    title="Halaman Sebelumnya" 
                    className="px-2 py-1 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                    <span className="hidden sm:inline ml-0.5 text-[11px]">Sebelumnya</span>
                  </button>

                  {/* Numbered Page Buttons */}
                  <div className="flex items-center gap-1 mx-0.5">
                    {(() => {
                      const maxButtons = 5;
                      let start = Math.max(1, validCurrentPage - Math.floor(maxButtons / 2));
                      let end = Math.min(totalPages, start + maxButtons - 1);

                      if (end - start + 1 < maxButtons) {
                        start = Math.max(1, end - maxButtons + 1);
                      }

                      const pageNumbers = [];
                      for (let i = start; i <= end; i++) {
                        pageNumbers.push(i);
                      }

                      return pageNumbers.map((pNum) => (
                        <button
                          key={pNum}
                          onClick={() => setCurrentPage(pNum)}
                          className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-all shadow-xs ${
                            validCurrentPage === pNum
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'border border-gray-300 bg-white text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300'
                          }`}
                        >
                          {pNum}
                        </button>
                      ));
                    })()}
                  </div>

                  {/* Selanjutnya */}
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                    disabled={validCurrentPage >= totalPages || totalFiltered === 0} 
                    title="Halaman Selanjutnya" 
                    className="px-2 py-1 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold shadow-xs"
                  >
                    <span className="hidden sm:inline mr-0.5 text-[11px]">Selanjutnya</span>
                    <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                  </button>

                  {/* Paling Akhir */}
                  <button 
                    onClick={() => setCurrentPage(totalPages)} 
                    disabled={validCurrentPage >= totalPages || totalFiltered === 0} 
                    title="Halaman Terakhir (Paling Akhir)" 
                    className="px-2 py-1 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold shadow-xs"
                  >
                    <span className="hidden sm:inline mr-0.5 text-[11px]">Akhir</span>
                    <span className="material-symbols-outlined text-[15px]">keyboard_double_arrow_right</span>
                  </button>
                </div>
              </div>
            </div>

          </main>
        )}

        {/* ══════════════════════════════════════════════════════════
            PAGE: PROFIL PENGGUNA (SETTINGS)
            ══════════════════════════════════════════════════════════ */}
        {activePage === 'profile' && (
          <main className="flex-grow p-4 md:p-6 w-full max-w-[1100px] mx-auto">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1D21] mb-1 font-['Outfit']">Profil Pengguna</h2>
                <p className="text-sm text-gray-500">Data profil dan tanda tangan digital yang tersinkronisasi dari Google Drive & Mobile.</p>
              </div>
              <button 
                onClick={() => setActivePage('dashboard')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Kembali ke Dashboard
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Kolom 1: Informasi Profil */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-cyan-100 shadow-md bg-white flex items-center justify-center">
                    {userAvatarUrl ? (
                      <img src={userAvatarUrl} alt="Foto Profil" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl uppercase text-cyan-600 font-bold">{profile?.nama?.charAt(0) || session?.user?.name?.charAt(0) || '-'}</span>
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 bg-gradient-to-r from-amber-400 to-amber-600 text-white rounded-full p-1 shadow-md border-2 border-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900">{profile?.nama || session?.user?.name}</h3>
                <p className="text-xs font-semibold text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-200 mt-1">
                  {profile?.jabatan || 'Pendamping PKH'}
                </p>
                <p className="text-xs text-gray-400 font-mono mt-1">{profile?.email || session?.user?.email}</p>

                <div className="w-full border-t border-gray-100 my-4"></div>

                <div className="w-full text-left space-y-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">NIP</label>
                    <p className="text-sm font-semibold text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      {profile?.nip || 'Belum disetel'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Kabupaten / Kota</label>
                    <p className="text-sm font-semibold text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      {profile?.kabupaten || 'Belum disetel'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Kolom 2: Tanda Tangan Digital */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-600 text-[20px]">draw</span>
                    Tanda Tangan Digital
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">Tanda tangan yang akan tertera pada lembar dokumen PDF laporan RHK Anda.</p>

                  <div className="w-full h-44 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 flex items-center justify-center p-3 overflow-hidden">
                    {profile?.signatureUrl ? (
                      <img src={profile.signatureUrl} alt="Tanda Tangan" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="text-center text-gray-400">
                        <span className="material-symbols-outlined text-4xl mb-1 block opacity-40">gesture</span>
                        <p className="text-xs">Belum ada tanda tangan</p>
                        <p className="text-[10px] text-gray-400 mt-1">Unggah melalui aplikasi Aspend Mobile</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-cyan-50/60 rounded-lg border border-cyan-100 flex items-start gap-2">
                  <span className="material-symbols-outlined text-cyan-700 text-[18px] shrink-0 mt-0.5">info</span>
                  <p className="text-[11px] text-cyan-800 leading-tight">
                    Data tanda tangan disinkronkan langsung dari Google Drive Anda.
                  </p>
                </div>
              </div>

              {/* Kolom 3: Status Database & Akun */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-600 text-[20px]">database</span>
                    Informasi Akun
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">Koneksi penyimpanan cloud pribadi Anda.</p>

                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Penyimpanan Database</span>
                      <p className="text-xs font-bold text-gray-800 mt-0.5 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Google Sheets (Drive Pribadi)
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Status Akun</span>
                      <p className="text-xs font-bold text-amber-600 mt-0.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        ASPEND Verified Member
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Sinkronisasi</span>
                      <p className="text-xs font-medium text-gray-700 mt-0.5">
                        Tersambung dengan Aspend Mobile
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => signOut()}
                  className="mt-6 w-full py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  Keluar dari Akun
                </button>
              </div>

            </div>
          </main>
        )}

        {/* ══════════════════════════════════════════════════════════
            PAGE: BUAT LAPORAN RHK (FORM)
            ══════════════════════════════════════════════════════════ */}
        {activePage === 'form' && (
          <main className="flex-grow p-4 md:p-6 w-full max-w-[1100px] mx-auto pb-24">
            {/* Header Form */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1D21] font-['Outfit']">Buat Laporan RHK</h2>
              </div>
              <button 
                onClick={() => setActivePage('dashboard')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-xs cursor-pointer w-fit"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Kembali ke Dashboard
              </button>
            </div>

            <div className="space-y-6">
              {/* KARTU 1: DATA UTAMA PELAKSANAAN KEGIATAN */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                  <span className="p-1.5 bg-cyan-50 text-cyan-600 rounded-lg material-symbols-outlined text-lg">event_note</span>
                  Informasi Kegiatan
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Jenis RHK */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 block mb-1">
                      Jenis RHK <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={createForm.jenisRHK}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = MASTER_RHK_DATA.find(r => r.jenis === val);
                        const rhkId = match?.id || '';
                        const rencanaList = match?.rencanaList || [];
                        setCreateForm(prev => ({
                          ...prev,
                          jenisRHK: val,
                          idRHK: rhkId,
                          rencanaAksi: rencanaList[0] || ''
                        }));
                        loadPoinHistoryForRhk(rhkId, val);
                      }}
                      className="w-full text-xs font-medium border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="">-- Pilih Jenis RHK --</option>
                      {MASTER_RHK_DATA.map((rhk) => (
                        <option key={rhk.id} value={rhk.jenis}>
                          [{rhk.id}] {rhk.jenis}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Rencana Aksi */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 block mb-1">
                      Rencana Aksi <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={createForm.rencanaAksi}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, rencanaAksi: e.target.value }))}
                      disabled={!createForm.jenisRHK}
                      className="w-full text-xs font-medium border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Pilih Rencana Aksi --</option>
                      {getRencanaAksiListForRHK(createForm.jenisRHK).map((aksi, idx) => (
                        <option key={idx} value={aksi}>
                          {aksi}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tanggal */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 block mb-1">
                      Tanggal Kegiatan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={createForm.tanggal}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, tanggal: e.target.value }))}
                      className="w-full text-xs font-medium border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                    />
                  </div>

                  {/* Pukul */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 block mb-1">
                      Pukul Kegiatan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={createForm.pukul}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, pukul: e.target.value }))}
                      className="w-full text-xs font-medium border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Poin-poin Kegiatan */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase text-gray-500">
                      Poin-poin Kegiatan <span className="text-rose-500">*</span>
                    </label>
                    <div>
                      <button
                        type="button"
                        onClick={handleOpenPoinHistoryModal}
                        className="px-2.5 py-1 text-[11px] font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">history</span>
                        Riwayat Poin
                      </button>
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={6}
                      value={createForm.poinKegiatan}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, poinKegiatan: e.target.value }))}
                      placeholder={`Tuliskan poin-point kegiatan:\n- Siapa saja yang terlibat\n- Kegiatan apa yang dilaksanakan\n- Lokasi kegiatan\n- Hasil Utamanya\n- Rekomendasi/Saran`}
                      className="w-full text-xs font-medium border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none leading-relaxed transition-all resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* KARTU 2: KHUSUS RHK-2 (P2K2) */}
              {isP2K2(createForm.jenisRHK) && (
                <div className="bg-gradient-to-br from-amber-50/60 via-amber-50/30 to-white rounded-2xl shadow-sm border-2 border-amber-300/80 p-6 animate-scale-up">
                  <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-amber-200">
                    <span className="p-1.5 bg-amber-500 text-white rounded-lg material-symbols-outlined text-lg">school</span>
                    <div>
                      <h3 className="text-base font-bold text-amber-950">Data Pelaksanaan P2K2</h3>
                      <p className="text-[11px] text-amber-800">Pertemuan Peningkatan Kemampuan Keluarga (P2K2)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Modul */}
                    <div>
                      <label className="text-[11px] font-bold uppercase text-amber-900 block mb-1">
                        Modul P2K2 <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={createForm.p2k2Modul}
                        onChange={(e) => {
                          const mod = e.target.value;
                          const sesiList = getSesiByModul(mod);
                          setCreateForm(prev => ({
                            ...prev,
                            p2k2Modul: mod,
                            p2k2Sesi: sesiList[0] || ''
                          }));
                        }}
                        className="w-full text-xs font-medium border border-amber-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all cursor-pointer"
                      >
                        <option value="">-- Pilih Modul P2K2 --</option>
                        {getUniqueModulP2K2().map((modul, idx) => (
                          <option key={idx} value={modul}>{modul}</option>
                        ))}
                      </select>
                    </div>

                    {/* Sesi */}
                    <div>
                      <label className="text-[11px] font-bold uppercase text-amber-900 block mb-1">
                        Sesi P2K2 <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={createForm.p2k2Sesi}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, p2k2Sesi: e.target.value }))}
                        disabled={!createForm.p2k2Modul}
                        className="w-full text-xs font-medium border border-amber-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">-- Pilih Sesi P2K2 --</option>
                        {getSesiByModul(createForm.p2k2Modul).map((sesi, idx) => (
                          <option key={idx} value={sesi}>{sesi}</option>
                        ))}
                      </select>
                    </div>

                    {/* Nama Kelompok */}
                    <div>
                      <label className="text-[11px] font-bold uppercase text-amber-900 block mb-1">Nama Kelompok</label>
                      <input
                        type="text"
                        value={createForm.p2k2Kelompok}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, p2k2Kelompok: e.target.value }))}
                        placeholder="Contoh: Mawar 1"
                        className="w-full text-xs font-medium border border-amber-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      />
                    </div>

                    {/* Ketua Kelompok */}
                    <div>
                      <label className="text-[11px] font-bold uppercase text-amber-900 block mb-1">Ketua Kelompok</label>
                      <input
                        type="text"
                        value={createForm.p2k2Ketua}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, p2k2Ketua: e.target.value }))}
                        placeholder="Nama ketua kelompok"
                        className="w-full text-xs font-medium border border-amber-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      />
                    </div>

                    {/* Jumlah KPM Hadir */}
                    <div>
                      <label className="text-[11px] font-bold uppercase text-amber-900 block mb-1">Jumlah KPM Hadir</label>
                      <input
                        type="number"
                        value={createForm.p2k2Hadir}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, p2k2Hadir: e.target.value }))}
                        placeholder="0"
                        className="w-full text-xs font-medium border border-amber-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      />
                    </div>

                    {/* Total KPM */}
                    <div>
                      <label className="text-[11px] font-bold uppercase text-amber-900 block mb-1">Total KPM (Anggota)</label>
                      <input
                        type="number"
                        value={createForm.p2k2Total}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, p2k2Total: e.target.value }))}
                        placeholder="0"
                        className="w-full text-xs font-medium border border-amber-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* KARTU 3: FOTO BUKTI DUKUNG */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg material-symbols-outlined text-lg">add_photo_alternate</span>
                    Foto Bukti Dukung <span className="text-rose-500">*</span>
                  </h3>
                  <span className="text-xs font-bold text-gray-400">
                    {createPhotos.length} / 100 foto
                  </span>
                </div>

                {/* Upload Picker Button & Drop Area */}
                <label className="border-2 border-dashed border-gray-300 hover:border-cyan-500 rounded-2xl p-6 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-cyan-50/30 transition-all cursor-pointer group">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleCreatePhotoSelect}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800">Klik untuk memilih foto bukti dukung</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">Mendukung banyak file sekaligus (JPG, PNG, WebP)</span>
                </label>

                {/* Previews Grid */}
                {createPhotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
                    {createPhotos.map((item, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100 h-32 group shadow-xs">
                        <img
                          src={item.previewUrl}
                          alt={`Bukti ${idx + 1}`}
                          onClick={() => setPreviewPhotoModalUrl(item.previewUrl)}
                          className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono backdrop-blur-xs">
                          Foto {idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCreatePhoto(idx);
                          }}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-700 transition-all cursor-pointer"
                          title="Hapus foto"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ACTION: TOMBOL BUAT LAPORAN */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleGenerateNarrative}
                  disabled={isGeneratingNarrative || isSubmittingReport}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isGeneratingNarrative ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Menyusun Laporan...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">auto_awesome</span>
                      <span>Buat Laporan</span>
                    </>
                  )}
                </button>
              </div>

              {/* KARTU 4: PRATINJAU & PENYUNTINGAN NARASI */}
              {(generatedNarrative || isGeneratingNarrative) && (
                <div id="narrative-editor-box" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-scale-up">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg material-symbols-outlined text-lg">edit_note</span>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Narasi Laporan</h3>
                        <p className="text-[11px] text-gray-500">Narasi laporan dapat Anda tinjau atau sempurnakan secara manual sebelum disimpan ke PDF resmi.</p>
                      </div>
                    </div>
                    {extractedLocation && (
                      <span className="text-[11px] text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[14px] text-cyan-600">location_on</span>
                        {extractedLocation}
                      </span>
                    )}
                  </div>

                  {isGeneratingNarrative ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                      <div className="w-8 h-8 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs font-bold text-gray-700">Sedang menyusun laporan...</p>
                      <p className="text-[10px] text-gray-400">Proses ini membutuhkan waktu beberapa detik untuk hasil yang optimal.</p>
                    </div>
                  ) : (
                    <textarea
                      rows={16}
                      value={generatedNarrative}
                      onChange={(e) => setGeneratedNarrative(e.target.value)}
                      className="w-full text-xs font-mono font-medium border border-gray-300 rounded-xl p-4 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none leading-relaxed transition-all resize-y min-h-[360px]"
                    />
                  )}

                  {/* BOTTOM BUTTON: SIMPAN & BUAT PDF */}
                  <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setActivePage('dashboard')}
                      disabled={isSubmittingReport}
                      className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitReport}
                      disabled={isSubmittingReport || !generatedNarrative.trim()}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {isSubmittingReport ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Membuat Dokumen PDF & Menyimpan ke Drive...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                          <span>Simpan & Buat Dokumen PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        )}
        {/* ══════════════════════════════════════════════════════════
            PAGE: DASHBOARD KPM
            ══════════════════════════════════════════════════════════ */}
        {activePage === 'kpm-dashboard' && (
          <main className="flex-grow px-3 py-4 sm:px-5 sm:py-6 w-full max-w-[1600px] mx-auto pb-24">
            <KpmDashboardView
              onNavigateToData={() => setActivePage('kpm-data')}
              onSelectKpm={() => setActivePage('kpm-data')}
            />
          </main>
        )}

        {/* ══════════════════════════════════════════════════════════
            PAGE: DATA KPM (Tabel Lengkap & Relasi)
            ══════════════════════════════════════════════════════════ */}
        {(activePage === 'kpm-data' ||
          activePage === 'kpm-aset' ||
          activePage === 'kpm-profil-detail') && (
          <main className="flex-grow px-3 py-4 sm:px-5 sm:py-6 w-full max-w-[1600px] mx-auto pb-24">
            <KpmTableView
              onNavigateHome={() => setActivePage('dashboard')}
              onNavigateToKpmDashboard={() => setActivePage('kpm-dashboard')}
            />
          </main>
        )}

        {/* ══════════════════════════════════════════════════════════
            PAGE: PERMASALAHAN KPM (2 Layar: Belum Selesai & Selesai)
            ══════════════════════════════════════════════════════════ */}
        {activePage === 'kpm-masalah' && (
          <main className="flex-grow px-3 py-4 sm:px-5 sm:py-6 w-full max-w-[1600px] mx-auto pb-24">
            <KpmPermasalahanView
              onNavigateHome={() => setActivePage('dashboard')}
              onNavigateToKpmData={() => setActivePage('kpm-data')}
            />
          </main>
        )}

        {/* ══════════════════════════════════════════════════════════
            PAGE: GRADUASI & PPSE (2 Layar: Calon & Berhasil)
            ══════════════════════════════════════════════════════════ */}
        {activePage === 'kpm-graduasi' && (
          <main className="flex-grow px-3 py-4 sm:px-5 sm:py-6 w-full max-w-[1600px] mx-auto pb-24">
            <KpmGraduasiView
              onNavigateHome={() => setActivePage('dashboard')}
              onNavigateToKpmData={() => setActivePage('kpm-data')}
            />
          </main>
        )}

        {/* ══════════════════════════════════════════════════════════
            PAGE: ANALISA PERBANDINGAN TAHAP BANSOS
            ══════════════════════════════════════════════════════════ */}
        {activePage === 'kpm-analisa-tahap' && (
          <main className="flex-grow px-3 py-4 sm:px-5 sm:py-6 w-full max-w-[1600px] mx-auto pb-24">
            <KpmAnalisaTahapView
              onNavigateHome={() => setActivePage('dashboard')}
              onNavigateToKpmData={() => setActivePage('kpm-data')}
            />
          </main>
        )}

      </div>
    </div>
  );
}
