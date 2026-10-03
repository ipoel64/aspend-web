'use client';

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { MASTER_P2K2_DATA, getUniqueModulP2K2, isP2K2 } from '@/lib/master-rhk';
import { capitalizeEachWord } from '@/lib/format-utils';

export interface ReportItem {
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

export interface UserProfileData {
  nama: string;
  email: string;
  nip: string;
  jabatan: string;
  kabupaten: string;
  provinsi?: string;
  kecamatan?: string;
  jenisSdm?: string;
}

interface RekapP2K2ViewProps {
  reports: ReportItem[];
  userProfile?: UserProfileData | null;
  onOpenReportDetail?: (report: ReportItem) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface P2K2SessionSummary {
  modul: string;
  sesi: string;
  count: number;
  totalKpm: number;
  reports: ReportItem[];
}

interface MonthRekapData {
  monthKey: string; // "2026-01"
  year: number;
  monthNumber: number; // 1 - 12
  monthName: string; // "Januari"
  triwulan: number; // 1, 2, 3, 4
  triwulanName: string; // "Triwulan I (Januari - Maret)"
  totalPertemuan: number;
  totalKpm: number;
  totalHadir: number;
  totalSakit: number;
  totalAlpa: number;
  totalDampingan: number;
  sessions: P2K2SessionSummary[];
  reports: ReportItem[];
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function extractYearMonth(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  const ymd = clean.match(/^(\d{4})[-/](\d{1,2})/);
  if (ymd) {
    return { year: parseInt(ymd[1], 10), month: parseInt(ymd[2], 10) };
  }
  const dmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    return { year: parseInt(dmy[3], 10), month: parseInt(dmy[2], 10) };
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return null;
}

function extractP2K2Info(report: ReportItem): {
  modul: string;
  sesi: string;
  jumlahKpm: number;
  jumlahHadir: number;
  jumlahSakit: number;
  jumlahAlpa: number;
  totalDampingan: number;
  namaKelompok: string;
  ketuaKelompok: string;
  tempatPelaksanaan: string;
  namaPemateri: string;
} {
  let p2k2 = report.P2K2Data;
  if (typeof p2k2 === 'string') {
    try { p2k2 = JSON.parse(p2k2); } catch { p2k2 = null; }
  }

  let modul = p2k2?.modul || '';
  let sesi = p2k2?.sesi || '';

  // Fallback deteksi modul & sesi dari teks narasi / rencana aksi
  if (!modul || !sesi) {
    const fullText = `${report.RencanaAksi || ''} ${report.NarasiEdited || report.NarasiAI || ''} ${report.PoinKegiatan || ''}`;
    for (const item of MASTER_P2K2_DATA) {
      if (!modul && fullText.toLowerCase().includes(item.modul.toLowerCase())) {
        modul = item.modul;
      }
      if (!sesi && fullText.toLowerCase().includes(item.sesi.toLowerCase())) {
        sesi = item.sesi;
      }
    }
  }

  if (!modul) modul = 'MODUL P2K2';
  if (!sesi) sesi = report.RencanaAksi || 'Pertemuan P2K2';

  const hadir = parseInt(p2k2?.jumlahHadir ?? p2k2?.hadir ?? 0, 10) || 0;
  const sakit = parseInt(p2k2?.jumlahSakit ?? p2k2?.sakit ?? 0, 10) || 0;
  const alpa = parseInt(p2k2?.jumlahAlpa ?? p2k2?.alpa ?? 0, 10) || 0;
  let totalDampingan = parseInt(p2k2?.totalDampingan ?? p2k2?.jumlahKPM ?? (hadir + sakit + alpa), 10) || 0;
  let jumlahKpm = hadir > 0 ? hadir : (totalDampingan > 0 ? totalDampingan : (parseInt(p2k2?.jumlahKPM || 0, 10) || 0));

  return {
    modul,
    sesi,
    jumlahKpm,
    jumlahHadir: hadir,
    jumlahSakit: sakit,
    jumlahAlpa: alpa,
    totalDampingan,
    namaKelompok: p2k2?.namaKelompok || '',
    ketuaKelompok: p2k2?.ketuaKelompok || '',
    tempatPelaksanaan: p2k2?.tempatPelaksanaan || report.Lokasi || '',
    namaPemateri: p2k2?.namaPemateri || ''
  };
}

export default function RekapP2K2View({
  reports,
  userProfile,
  onOpenReportDetail,
  showToast
}: RekapP2K2ViewProps) {
  // Filter state
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedTriwulan, setSelectedTriwulan] = useState<string>('all'); // 'all', '1', '2', '3', '4'
  const [selectedModul, setSelectedModul] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [showAllMonths, setShowAllMonths] = useState<boolean>(true); // default true: menampilkan seluruh 12 bulan

  // Detail Modal State
  const [detailModalMonth, setDetailModalMonth] = useState<MonthRekapData | null>(null);

  // 1. Ekstrak Semua Laporan yang merupakan RHK-2 (P2K2)
  const p2k2Reports = useMemo(() => {
    return reports.filter(r => {
      const idUpper = (r.IdRHK || '').toUpperCase();
      const jenisUpper = (r.JenisRHK || '').toUpperCase();
      const rencanaUpper = (r.RencanaAksi || '').toUpperCase();
      return (
        idUpper === 'RHK-2' ||
        idUpper.includes('P2K2') ||
        isP2K2(r.IdRHK) ||
        isP2K2(r.JenisRHK) ||
        rencanaUpper.includes('P2K2') ||
        Boolean(r.P2K2Data)
      );
    });
  }, [reports]);

  // 2. Daftar Tahun yang Tersedia dalam Data
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentYear);
    p2k2Reports.forEach(r => {
      const ym = extractYearMonth(r.Tanggal);
      if (ym) yearsSet.add(ym.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [p2k2Reports, currentYear]);

  // 3. Modul P2K2 Unik
  const uniqueModuls = useMemo(() => {
    return getUniqueModulP2K2();
  }, []);

  // 4. Data Rekap per Bulan (12 Bulan untuk Tahun Terpilih)
  const monthlyRekapList = useMemo(() => {
    // Siapkan 12 bulan kosong untuk selectedYear
    const monthsMap = new Map<number, MonthRekapData>();

    for (let m = 1; m <= 12; m++) {
      const triwulan = Math.ceil(m / 3);
      const triwulanNames = [
        '',
        'Triwulan I (Januari - Maret)',
        'Triwulan II (April - Juni)',
        'Triwulan III (Juli - September)',
        'Triwulan IV (Oktober - Desember)'
      ];
      monthsMap.set(m, {
        monthKey: `${selectedYear}-${String(m).padStart(2, '0')}`,
        year: selectedYear,
        monthNumber: m,
        monthName: NAMA_BULAN[m - 1],
        triwulan,
        triwulanName: triwulanNames[triwulan],
        totalPertemuan: 0,
        totalKpm: 0,
        totalHadir: 0,
        totalSakit: 0,
        totalAlpa: 0,
        totalDampingan: 0,
        sessions: [],
        reports: []
      });
    }

    // Isi dengan data laporan yang sesuai tahun
    p2k2Reports.forEach(report => {
      const ym = extractYearMonth(report.Tanggal);
      if (!ym || ym.year !== selectedYear) return;

      const mData = monthsMap.get(ym.month);
      if (!mData) return;

      const info = extractP2K2Info(report);

      // Cek filter modul jika dipilih
      if (selectedModul !== 'all' && !info.modul.toLowerCase().includes(selectedModul.toLowerCase())) {
        return;
      }

      // Cek search keyword jika ada
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const match =
          info.modul.toLowerCase().includes(kw) ||
          info.sesi.toLowerCase().includes(kw) ||
          info.namaKelompok.toLowerCase().includes(kw) ||
          info.ketuaKelompok.toLowerCase().includes(kw) ||
          info.tempatPelaksanaan.toLowerCase().includes(kw) ||
          report.RencanaAksi.toLowerCase().includes(kw);
        if (!match) return;
      }

      mData.totalPertemuan += 1;
      mData.totalKpm += info.jumlahKpm;
      mData.totalHadir += info.jumlahHadir;
      mData.totalSakit += info.jumlahSakit;
      mData.totalAlpa += info.jumlahAlpa;
      mData.totalDampingan += info.totalDampingan;
      mData.reports.push(report);

      // Kelompokkan sesi dalam bulan tersebut
      const existingSession = mData.sessions.find(
        s => s.modul === info.modul && s.sesi === info.sesi
      );
      if (existingSession) {
        existingSession.count += 1;
        existingSession.totalKpm += info.jumlahKpm;
        existingSession.reports.push(report);
      } else {
        mData.sessions.push({
          modul: info.modul,
          sesi: info.sesi,
          count: 1,
          totalKpm: info.jumlahKpm,
          reports: [report]
        });
      }
    });

    let result = Array.from(monthsMap.values());

    // Filter Triwulan jika aktif
    if (selectedTriwulan !== 'all') {
      const tw = parseInt(selectedTriwulan, 10);
      result = result.filter(item => item.triwulan === tw);
    }

    // Filter hanya bulan berdata jika toggle showAllMonths dimatikan
    if (!showAllMonths) {
      result = result.filter(item => item.totalPertemuan > 0);
    }

    return result;
  }, [p2k2Reports, selectedYear, selectedTriwulan, selectedModul, searchKeyword, showAllMonths]);

  // 5. Hitung Subtotal per Triwulan (untuk Divider)
  const triwulanSubtotals = useMemo(() => {
    const subtotals: Record<number, { pertemuan: number; kpm: number; dampingan: number }> = {
      1: { pertemuan: 0, kpm: 0, dampingan: 0 },
      2: { pertemuan: 0, kpm: 0, dampingan: 0 },
      3: { pertemuan: 0, kpm: 0, dampingan: 0 },
      4: { pertemuan: 0, kpm: 0, dampingan: 0 },
    };

    monthlyRekapList.forEach(m => {
      subtotals[m.triwulan].pertemuan += m.totalPertemuan;
      subtotals[m.triwulan].kpm += m.totalKpm;
      subtotals[m.triwulan].dampingan += m.totalDampingan;
    });

    return subtotals;
  }, [monthlyRekapList]);

  // 6. Grand Total
  const grandTotal = useMemo(() => {
    let pertemuan = 0;
    let kpm = 0;
    let dampingan = 0;
    monthlyRekapList.forEach(m => {
      pertemuan += m.totalPertemuan;
      kpm += m.totalKpm;
      dampingan += m.totalDampingan;
    });
    return { pertemuan, kpm, dampingan };
  }, [monthlyRekapList]);

  // 7. Modul Terbanyak Dilaksanakan
  const topModulSesi = useMemo(() => {
    const countMap: Record<string, { modul: string; sesi: string; count: number; kpm: number }> = {};
    p2k2Reports.forEach(r => {
      const ym = extractYearMonth(r.Tanggal);
      if (!ym || ym.year !== selectedYear) return;
      const info = extractP2K2Info(r);
      const key = `${info.modul} - ${info.sesi}`;
      if (!countMap[key]) {
        countMap[key] = { modul: info.modul, sesi: info.sesi, count: 0, kpm: 0 };
      }
      countMap[key].count += 1;
      countMap[key].kpm += info.jumlahKpm;
    });
    const sorted = Object.values(countMap).sort((a, b) => b.count - a.count || b.kpm - a.kpm);
    return sorted.length > 0 ? sorted[0] : null;
  }, [p2k2Reports, selectedYear]);

  // 8. Ekspor ke Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const excelRows: any[][] = [];

      // Kop & Header Excel
      excelRows.push(['KEMENTERIAN SOSIAL REPUBLIK INDONESIA']);
      excelRows.push(['DIREKTORAT JENDERAL PERLINDUNGAN DAN JAMINAN SOSIAL']);
      excelRows.push(['PROGRAM KELUARGA HARAPAN (PKH)']);
      excelRows.push(['']);
      excelRows.push(['REKAPITULASI PELAKSANAAN PERTEMUAN PENINGKATAN KEMAMPUAN KELUARGA (P2K2 / RHK-2)']);
      excelRows.push([`Tahun Anggaran / Periode: ${selectedYear}`]);
      excelRows.push(['']);
      excelRows.push([`Nama Pendamping: ${userProfile?.nama || '-'}`]);
      excelRows.push([`NIP: ${userProfile?.nip || '-'}`]);
      excelRows.push([`Jabatan: ${userProfile?.jabatan || 'Pendamping Sosial PKH'}`]);
      excelRows.push([`Wilayah Tugas: ${[
        userProfile?.kecamatan ? `Kec. ${capitalizeEachWord(userProfile.kecamatan)}` : '',
        userProfile?.kabupaten ? capitalizeEachWord(userProfile.kabupaten) : '',
        userProfile?.provinsi ? capitalizeEachWord(userProfile.provinsi) : ''
      ].filter(Boolean).join(', ') || '-'}`]);
      excelRows.push(['']);

      // Header Tabel
      excelRows.push([
        'No',
        'Bulan / Tahun',
        'Triwulan',
        'Jumlah Pertemuan',
        'Jumlah KPM',
        'Modul dan Sesi (Rincian Sesi & Jumlah KPM Mengikuti)'
      ]);

      let rowNo = 1;
      let currentTW = 0;

      // Group per triwulan dan sisipkan pembatas
      const sortedMonths = [...monthlyRekapList].sort((a, b) => a.monthNumber - b.monthNumber);

      for (let i = 0; i < sortedMonths.length; i++) {
        const m = sortedMonths[i];

        // Format Rincian Modul dan Sesi
        let sessionsText = '-';
        if (m.sessions.length > 0) {
          sessionsText = m.sessions.map((s, sIdx) => {
            return `[${sIdx + 1}] ${s.modul} - ${s.sesi} (${s.totalKpm} KPM${s.count > 1 ? `, ${s.count}x sesi` : ''})`;
          }).join('\n');
        }

        excelRows.push([
          rowNo++,
          `${m.monthName} ${m.year}`,
          `TW ${m.triwulan}`,
          m.totalPertemuan,
          m.totalKpm,
          sessionsText
        ]);

        // Sisipkan pembatas setiap Triwulan (setelah bulan Maret, Juni, September, Desember atau saat berganti TW)
        const isEndOfTriwulan = (m.monthNumber % 3 === 0);
        const isLastInList = (i === sortedMonths.length - 1);
        const nextItem = sortedMonths[i + 1];
        const nextIsDifferentTW = nextItem && nextItem.triwulan !== m.triwulan;

        if (isEndOfTriwulan || isLastInList || nextIsDifferentTW) {
          const sub = triwulanSubtotals[m.triwulan];
          excelRows.push([
            '---',
            `PEMBATAS ${m.triwulanName.toUpperCase()}`,
            `TW ${m.triwulan}`,
            `Subtotal: ${sub.pertemuan} Pertemuan`,
            `Subtotal: ${sub.kpm} KPM`,
            `Total KPM yang telah mengikuti sesi P2K2 pada Triwulan ${m.triwulan}: ${sub.kpm} KPM`
          ]);
        }
      }

      // Grand Total Row
      excelRows.push(['']);
      excelRows.push([
        'TOTAL',
        `TOTAL KESELURUHAN TAHUN ${selectedYear}`,
        '4 TW',
        grandTotal.pertemuan,
        grandTotal.kpm,
        `Total Seluruh Peserta KPM yang Mengikuti Sesi P2K2: ${grandTotal.kpm} KPM (${grandTotal.pertemuan} Pertemuan Dilaksanakan)`
      ]);

      // Tanda Tangan
      excelRows.push(['']);
      excelRows.push(['']);
      const kabName = userProfile?.kabupaten ? capitalizeEachWord(userProfile.kabupaten) : 'Binjai';
      const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      excelRows.push(['', '', '', '', '', `${kabName}, ${todayStr}`]);
      excelRows.push(['', '', '', '', '', userProfile?.jabatan || 'Pendamping Sosial PKH']);
      excelRows.push(['']);
      excelRows.push(['']);
      excelRows.push(['', '', '', '', '', `( ${userProfile?.nama || '-'} )`]);
      excelRows.push(['', '', '', '', '', `NIP. ${userProfile?.nip || '-'}`]);

      const ws = XLSX.utils.aoa_to_sheet(excelRows);

      // Lebar Kolom Proporsional
      ws['!cols'] = [
        { wch: 6 },   // No
        { wch: 18 },  // Bulan / Tahun
        { wch: 10 },  // Triwulan
        { wch: 18 },  // Jumlah Pertemuan
        { wch: 16 },  // Jumlah KPM
        { wch: 75 }   // Modul dan Sesi
      ];

      XLSX.utils.book_append_sheet(wb, ws, `Rekap_P2K2_${selectedYear}`);
      const filename = `Rekap_Laporan_P2K2_${selectedYear}_${userProfile?.nama ? userProfile.nama.replace(/\s+/g, '_') : 'SDM'}.xlsx`;
      XLSX.writeFile(wb, filename);

      showToast(`File Excel ${filename} berhasil diunduh!`, 'success');
    } catch (err: any) {
      console.error('Gagal mengunduh Excel Rekap P2K2:', err);
      showToast('Gagal mengunduh file Excel Rekap P2K2.', 'error');
    }
  };

  const handleResetFilter = () => {
    setSelectedYear(currentYear);
    setSelectedTriwulan('all');
    setSelectedModul('all');
    setSearchKeyword('');
    setShowAllMonths(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in font-['Outfit',sans-serif]">
      {/* ── HEADER BANNER ── */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-800 rounded-2xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold tracking-wide uppercase mb-2 text-teal-100 border border-white/20">
              <span className="material-symbols-outlined text-[15px]">fact_check</span>
              Rencana Hasil Kerja 2 (RHK-2)
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Rekap Laporan P2K2
            </h1>
            <p className="text-sm text-teal-100/90 mt-1.5 max-w-2xl leading-relaxed">
              Rekapitulasi berkala pelaksanaan Pertemuan Peningkatan Kemampuan Keluarga (P2K2) per bulan dan triwulan lengkap dengan rincian modul, sesi, dan jumlah KPM peserta dampingan.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              <span>Unduh File Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── STATISTIK KPI RINGKAS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pertemuan */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[26px]">groups</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Pertemuan P2K2</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-slate-800">{grandTotal.pertemuan}</span>
              <span className="text-xs text-slate-500">kegiatan</span>
            </div>
          </div>
        </div>

        {/* Total KPM Peserta */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[26px]">how_to_reg</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total KPM Mengikuti Sesi</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-slate-800">{grandTotal.kpm}</span>
              <span className="text-xs text-slate-500">orang KPM</span>
            </div>
          </div>
        </div>

        {/* Rata-rata KPM per Sesi */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[26px]">analytics</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Rata-rata Hadir / Pertemuan</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-slate-800">
                {grandTotal.pertemuan > 0 ? Math.round(grandTotal.kpm / grandTotal.pertemuan) : 0}
              </span>
              <span className="text-xs text-slate-500">KPM / sesi</span>
            </div>
          </div>
        </div>

        {/* Modul Paling Sering */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-[24px]">school</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-medium">Modul Terbanyak Dilaksanakan</p>
            <p className="text-xs font-bold text-slate-800 truncate mt-0.5" title={topModulSesi ? `${topModulSesi.modul} - ${topModulSesi.sesi}` : '-'}>
              {topModulSesi ? topModulSesi.sesi : 'Belum ada data'}
            </p>
            <p className="text-[11px] text-teal-600 font-medium truncate">
              {topModulSesi ? `${topModulSesi.count}x sesi (${topModulSesi.kpm} KPM)` : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* ── FILTER DAN KONTROL ── */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <span className="material-symbols-outlined text-[19px] text-teal-700">tune</span>
            <span>Filter Data Rekap P2K2</span>
          </div>

          {(selectedTriwulan !== 'all' || selectedModul !== 'all' || searchKeyword || !showAllMonths || selectedYear !== currentYear) && (
            <button
              onClick={handleResetFilter}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filter Tahun */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Tahun Anggaran / Periode
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>Tahun {yr}</option>
              ))}
            </select>
          </div>

          {/* Filter Triwulan */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Periode Triwulan (3 Bulanan)
            </label>
            <select
              value={selectedTriwulan}
              onChange={(e) => setSelectedTriwulan(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none cursor-pointer"
            >
              <option value="all">Semua Triwulan (1 Tahun Penuh)</option>
              <option value="1">Triwulan I (Januari - Maret)</option>
              <option value="2">Triwulan II (April - Juni)</option>
              <option value="3">Triwulan III (Juli - September)</option>
              <option value="4">Triwulan IV (Oktober - Desember)</option>
            </select>
          </div>

          {/* Filter Modul */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Filter Berdasarkan Modul
            </label>
            <select
              value={selectedModul}
              onChange={(e) => setSelectedModul(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none cursor-pointer truncate"
            >
              <option value="all">Semua Modul P2K2</option>
              {uniqueModuls.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Pencarian Keyword */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Cari Sesi / Kelompok / Lokasi
            </label>
            <div className="relative">
              <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-3 top-2.5 pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Ketik kata kunci..."
                className="w-full text-xs pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Toggle Tampilkan Semua Bulan */}
        <div className="flex items-center justify-between pt-1 text-xs text-slate-600">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAllMonths}
              onChange={(e) => setShowAllMonths(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded-sm border-slate-300 focus:ring-teal-500 cursor-pointer"
            />
            <span className="font-medium text-slate-700">
              Tampilkan format 12 bulan lengkap (format resmi pelaporan Kemensos)
            </span>
          </label>

          <span className="text-[11px] text-slate-400">
            Ditemukan {monthlyRekapList.filter(m => m.totalPertemuan > 0).length} bulan aktif dengan kegiatan P2K2
          </span>
        </div>
      </div>

      {/* ── TABEL REKAPITULASI DENGAN PEMBATAS TRIWULAN ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider">
                <th className="py-3 px-3.5 text-center w-12">No</th>
                <th className="py-3 px-4 w-40">Bulan / Tahun</th>
                <th className="py-3 px-4 text-center w-36">Jumlah Pertemuan</th>
                <th className="py-3 px-4 text-center w-36">Jumlah KPM</th>
                <th className="py-3 px-5 min-w-[320px]">
                  Modul dan Sesi (Jumlah KPM yang Mengikuti Sesi)
                </th>
                <th className="py-3 px-4 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyRekapList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                    <span className="material-symbols-outlined text-[40px] text-slate-300 block mb-2">event_busy</span>
                    Tidak ada data pelaksanaan P2K2 untuk filter tahun dan periode yang dipilih.
                  </td>
                </tr>
              ) : (
                monthlyRekapList.map((monthData, idx) => {
                  const isEndOfTriwulan = (monthData.monthNumber % 3 === 0);
                  const isLastRow = (idx === monthlyRekapList.length - 1);
                  const nextItem = monthlyRekapList[idx + 1];
                  const shouldRenderDivider = isEndOfTriwulan || (nextItem && nextItem.triwulan !== monthData.triwulan) || (isLastRow && selectedTriwulan !== 'all');
                  const sub = triwulanSubtotals[monthData.triwulan];

                  return (
                    <React.Fragment key={monthData.monthKey}>
                      {/* Baris Bulan Normal */}
                      <tr className={`transition-colors hover:bg-slate-50/80 ${monthData.totalPertemuan > 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        {/* No */}
                        <td className="py-3.5 px-3.5 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Bulan / Tahun */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${monthData.totalPertemuan > 0 ? 'bg-teal-500' : 'bg-slate-300'}`}></span>
                            <span>{monthData.monthName} {monthData.year}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal pl-4">
                            TW {monthData.triwulan}
                          </span>
                        </td>

                        {/* Jumlah Pertemuan */}
                        <td className="py-3.5 px-4 text-center">
                          {monthData.totalPertemuan > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-teal-50 text-teal-700 border border-teal-200/80">
                              <span className="material-symbols-outlined text-[14px]">groups</span>
                              {monthData.totalPertemuan} Pertemuan
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium text-xs">-</span>
                          )}
                        </td>

                        {/* Jumlah KPM */}
                        <td className="py-3.5 px-4 text-center">
                          {monthData.totalKpm > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                                <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                                {monthData.totalKpm} KPM
                              </span>
                              {monthData.totalDampingan > monthData.totalKpm && (
                                <span className="text-[10px] text-slate-400 mt-0.5">
                                  dari {monthData.totalDampingan} dampingan
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium text-xs">0 KPM</span>
                          )}
                        </td>

                        {/* Modul dan Sesi */}
                        <td className="py-3.5 px-5">
                          {monthData.sessions.length > 0 ? (
                            <div className="space-y-2">
                              {monthData.sessions.map((sess, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="p-2 rounded-xl bg-teal-50/50 border border-teal-100 hover:border-teal-200 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="text-[10px] font-extrabold uppercase text-teal-800 tracking-wider">
                                      {sess.modul}
                                    </div>
                                    <div className="text-xs font-semibold text-slate-800 leading-snug">
                                      {sess.sesi}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {sess.count > 1 && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                        {sess.count}x
                                      </span>
                                    )}
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-black bg-teal-600 text-white shadow-xs">
                                      {sess.totalKpm} KPM
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Belum ada kegiatan P2K2 pada bulan ini
                            </span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 text-center">
                          {monthData.totalPertemuan > 0 ? (
                            <button
                              onClick={() => setDetailModalMonth(monthData)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 hover:text-teal-800 transition-colors cursor-pointer border border-teal-200"
                            >
                              <span className="material-symbols-outlined text-[15px]">visibility</span>
                              <span>Rincian</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>

                      {/* ── GARIS TANDA PEMBATAS TRIWULAN (SETIAP 3 BULAN) ── */}
                      {shouldRenderDivider && (
                        <tr className="bg-gradient-to-r from-teal-900 via-teal-800 to-cyan-900 text-white border-y-2 border-teal-700/60 shadow-inner">
                          <td colSpan={2} className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-amber-300 text-[18px]">verified</span>
                              <span className="font-extrabold text-xs tracking-wider uppercase text-amber-300">
                                Pembatas {monthData.triwulanName}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black bg-white/20 text-white">
                              {sub.pertemuan} Pertemuan
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black bg-emerald-400 text-slate-900 shadow-xs">
                              {sub.kpm} KPM
                            </span>
                          </td>
                          <td colSpan={2} className="py-2.5 px-5 text-xs text-teal-100/90 font-medium">
                            Subtotal capaian Triwulan {monthData.triwulan}: <strong className="text-white">{sub.kpm} KPM</strong> mengikuti sesi ({sub.pertemuan} sesi dilaksanakan)
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* ── GRAND TOTAL FOOTER ── */}
            {monthlyRekapList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-extrabold text-xs border-t-2 border-slate-950">
                  <td colSpan={2} className="py-3 px-4 tracking-wider uppercase text-teal-300">
                    TOTAL KESELURUHAN (TAHUN {selectedYear})
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-500 text-slate-950 font-black">
                      {grandTotal.pertemuan} Pertemuan
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-400 text-slate-950 font-black">
                      {grandTotal.kpm} KPM
                    </span>
                  </td>
                  <td colSpan={2} className="py-3 px-5 text-xs text-slate-300 font-medium">
                    Akumulasi seluruh peserta KPM yang telah mengikuti pembelajaran P2K2: <strong className="text-white">{grandTotal.kpm} KPM</strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── MODAL DETAIL BULANAN ── */}
      {detailModalMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-gradient-to-r from-teal-800 to-teal-700 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                  Rincian Laporan P2K2: {detailModalMonth.monthName} {detailModalMonth.year}
                </h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  {detailModalMonth.triwulanName} • Total {detailModalMonth.totalPertemuan} pertemuan ({detailModalMonth.totalKpm} KPM)
                </p>
              </div>
              <button
                onClick={() => setDetailModalMonth(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {detailModalMonth.reports.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-8">
                  Tidak ada rincian laporan yang ditemukan.
                </p>
              ) : (
                detailModalMonth.reports.map((rep, idx) => {
                  const info = extractP2K2Info(rep);
                  return (
                    <div
                      key={rep.ReportId || idx}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-teal-300 transition-all space-y-2 shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {rep.Tanggal} • Pukul {rep.Pukul || '14:00'} WIB
                          </span>
                        </div>
                        {rep.PdfFileId && (
                          <a
                            href={`/api/pdf/download?fileId=${rep.PdfFileId}&fileName=Laporan_P2K2_${rep.Tanggal}.pdf`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                            <span>Unduh PDF</span>
                          </a>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">MODUL</span>
                          <span className="font-extrabold text-teal-800">{info.modul}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">SESI</span>
                          <span className="font-bold text-slate-800">{info.sesi}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">KELOMPOK</span>
                          <span className="font-medium text-slate-700">
                            {info.namaKelompok ? `Kelompok ${info.namaKelompok}` : 'Kelompok Dampingan'}
                            {info.ketuaKelompok ? ` (Ketua: ${info.ketuaKelompok})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">TEMPAT</span>
                          <span className="font-medium text-slate-700">{info.tempatPelaksanaan || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">KEHADIRAN KPM</span>
                          <span className="font-bold text-emerald-700">
                            Hadir: {info.jumlahHadir || info.jumlahKpm} KPM
                            {info.totalDampingan > 0 ? ` / ${info.totalDampingan}` : ''}
                          </span>
                        </div>
                      </div>

                      {onOpenReportDetail && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => {
                              setDetailModalMonth(null);
                              onOpenReportDetail(rep);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                          >
                            <span>Buka Dokumen Laporan Lengkap</span>
                            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setDetailModalMonth(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
