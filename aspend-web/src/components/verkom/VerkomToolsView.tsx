'use client';

import React, { useState, useRef, useMemo } from 'react';
import { parseCsvText, extractVerkomData, VerkomParseResult, VerkomRow } from '@/lib/verkom-parser';
import { buildVerkomPdfDoc, downloadVerkomPdf, getVerkomPdfBlob } from '@/lib/verkom-pdf';

interface VerkomToolsViewProps {
  showToast?: (text: string, type: 'success' | 'error' | 'info') => void;
  userProfile?: any;
}

export default function VerkomToolsView({ showToast }: VerkomToolsViewProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<VerkomParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string, type: 'success' | 'error' | 'info') => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(msg);
    }
  };

  // ─── Proses Parsing Berkas CSV ──────────────────────────────
  const handleProcessFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      notify('Harap pilih berkas dengan ekstensi .csv', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const text = await file.text();
      const rawRows = parseCsvText(text);

      if (rawRows.length === 0) {
        notify('Berkas CSV kosong atau tidak terbaca.', 'error');
        setIsProcessing(false);
        return;
      }

      const extracted = extractVerkomData(rawRows);

      if (extracted.rows.length === 0) {
        notify('Tidak ditemukan baris data siswa/KPM yang valid dalam berkas CSV ini.', 'error');
        setIsProcessing(false);
        return;
      }

      setFileName(file.name);
      setParsedData(extracted);
      setCurrentPage(1);
      setSearchQuery('');

      notify(`CSV berhasil diimpor dengan ${extracted.totalRecords} baris data!`, 'success');
    } catch (err: any) {
      console.error('Gagal membaca berkas CSV:', err);
      notify(`Gagal membaca berkas CSV: ${err.message || 'Format tidak valid'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
    // Reset file input agar bisa memilih file yang sama jika diinginkan
    if (e.target) e.target.value = '';
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleReset = () => {
    setFileName(null);
    setParsedData(null);
    setSearchQuery('');
    setCurrentPage(1);
  };

  // ─── Filter Data berdasarkan Pencarian ──────────────────────
  const filteredRows = useMemo(() => {
    if (!parsedData) return [];
    if (!searchQuery.trim()) return parsedData.rows;

    const q = searchQuery.toLowerCase().trim();
    return parsedData.rows.filter(
      r =>
        r.namaSiswa.toLowerCase().includes(q) ||
        r.namaPengurus.toLowerCase().includes(q) ||
        r.nikPengurus.includes(q) ||
        r.nikSiswa.includes(q) ||
        r.nisn.includes(q) ||
        r.namaPendamping.toLowerCase().includes(q) ||
        r.tingkatPendidikan.toLowerCase().includes(q) ||
        r.bentukPendidikan.toLowerCase().includes(q)
    );
  }, [parsedData, searchQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  // ─── Aksi: Simpan ke Google Drive ───────────────────────────
  const saveToGoogleDrive = async (silent = false): Promise<boolean> => {
    if (!parsedData || !fileName) return false;

    setIsSavingToDrive(true);
    try {
      const blob = getVerkomPdfBlob(parsedData);
      const cleanName = fileName.replace(/\.[^/.]+$/, '');
      const pdfFileName = `VERKOM_${cleanName}.pdf`;

      const formData = new FormData();
      formData.append('file', blob, pdfFileName);
      formData.append('fileName', pdfFileName);

      const res = await fetch('/api/verkom/save-to-drive', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menyimpan ke Google Drive');
      }

      if (!silent) {
        notify('PDF berhasil disimpan ke Google Drive folder "VERKOM_Laporan"!', 'success');
      }
      return true;
    } catch (err: any) {
      console.error('Save to Drive error:', err);
      notify(`Gagal menyimpan ke Google Drive: ${err.message}`, 'error');
      return false;
    } finally {
      setIsSavingToDrive(false);
    }
  };

  // ─── Aksi: Unduh PDF ────────────────────────────────────────
  const handleDownloadPdf = () => {
    if (!parsedData || !fileName) return;
    try {
      notify('Menyiapkan dokumen PDF Landscape...', 'info');
      downloadVerkomPdf(parsedData, fileName);
      notify('Dokumen PDF berhasil diunduh!', 'success');
    } catch (err: any) {
      console.error('Download PDF error:', err);
      notify(`Gagal mengunduh PDF: ${err.message}`, 'error');
    }
  };

  // ─── Aksi: Cetak Langsung (Browser Print) ───────────────────
  const handlePrint = () => {
    if (!parsedData) return;
    window.print();
  };

  // ─── Aksi: Cetak & Simpan PDF (Persis Alur Mobile) ──────────
  const handlePrintAndSave = async () => {
    if (!parsedData || !fileName) return;

    try {
      notify('Menyimpan ke Google Drive & menyiapkan cetak...', 'info');
      // 1. Simpan ke Google Drive
      await saveToGoogleDrive(true);
      notify('PDF tersimpan di folder "VERKOM_Laporan"! Mengunduh dokumen...', 'success');

      // 2. Unduh berkas PDF
      downloadVerkomPdf(parsedData, fileName);
    } catch (err: any) {
      console.error('Print and save error:', err);
      notify(`Gagal memproses cetak & simpan: ${err.message}`, 'error');
    }
  };

  return (
    <div className="w-full pb-20">
      {/* ══════════════════════════════════════════════════════════
          HERO BANNER: Verifikasi Komitmen CSV Converter
          (Persis seperti AppBar + Upload Header di Mobile)
          ══════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-[#0B1528] via-[#101E36] to-[#0F172A] text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-700/50 relative overflow-hidden mb-6 no-print">
        {/* Glow Accent Decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-900/50 border border-cyan-700/60 text-cyan-300 text-xs font-semibold mb-3">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>VERKOM Tools PKH Kemensos</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold font-['Outfit'] tracking-tight text-white mb-2">
            Verifikasi Komitmen CSV Converter
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed mb-6">
            Impor berkas CSV dari sistem PKH Kemensos untuk diubah menjadi format PDF siap cetak dengan tata letak Landscape resmi.
          </p>

          {/* Upload Button & Drag Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 transition-all duration-200 ${
              isDragging
                ? 'border-amber-400 bg-amber-400/10 scale-[1.01]'
                : 'border-slate-600/80 bg-slate-800/40 hover:border-slate-500'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv, .txt"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="material-symbols-outlined text-3xl">upload_file</span>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-95 text-slate-950 font-bold text-sm shadow-md transition-all cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">file_upload</span>
                  <span>{parsedData ? 'Pilih Berkas CSV Lain' : 'Pilih Berkas CSV'}</span>
                </button>
                <p className="text-[11px] text-slate-400 mt-2">
                  atau seret dan lepas berkas CSV Anda langsung ke sini
                </p>
              </div>

              {/* Active File Badge */}
              {fileName && parsedData && (
                <div className="mt-2 inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Aktif: <strong className="text-amber-300">{fileName}</strong></span>
                  <span className="text-slate-400">•</span>
                  <span>{parsedData.totalRecords} baris data</span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="ml-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                    title="Hapus / Reset"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          EMPTY STATE
          ══════════════════════════════════════════════════════════ */}
      {!parsedData && !isProcessing && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-xl mx-auto shadow-sm no-print">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">insert_drive_file</span>
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-1 font-['Outfit']">
            Silakan impor berkas CSV terlebih dahulu
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed mb-6">
            Unggah file CSV Form Verifikasi Komitmen Pendidikan dari aplikasi e-PKH untuk menampilkan tabel verifikasi dan mencetak format PDF landscape.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Unggah Berkas CSV</span>
          </button>
        </div>
      )}

      {/* Loading state spinner */}
      {isProcessing && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-md mx-auto shadow-sm no-print">
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-800">Sedang memproses berkas CSV...</p>
          <p className="text-xs text-gray-500 mt-1">Mengekstrak metadata sekolah dan baris data komitmen siswa</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          DATA DISPLAY & ACTIONS BAR
          ══════════════════════════════════════════════════════════ */}
      {parsedData && (
        <div className="space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
            {/* Kartu Sekolah */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Fasilitas Pendidikan</span>
                <p className="text-xs font-bold text-gray-900 truncate" title={parsedData.metadata.schoolName}>
                  {parsedData.metadata.schoolName.replace(/^Nama Sekolah\s*:\s*/i, '') || '-'}
                </p>
                <p className="text-[11px] text-gray-500 font-mono">
                  {parsedData.metadata.npsn || 'NPSN : -'}
                </p>
              </div>
            </div>

            {/* Kartu Periode Triwulan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">date_range</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Periode Verifikasi</span>
                <p className="text-xs font-bold text-gray-900 truncate">
                  {parsedData.metadata.month1} • {parsedData.metadata.month2} • {parsedData.metadata.month3}
                </p>
                <p className="text-[11px] text-gray-500">3 Bulan Pengamatan</p>
              </div>
            </div>

            {/* Kartu Total Data */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">groups</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Siswa Terdaftar</span>
                <p className="text-lg font-extrabold text-emerald-700 leading-tight">
                  {parsedData.totalRecords} <span className="text-xs font-normal text-gray-500">KPM/Siswa</span>
                </p>
                <p className="text-[11px] text-gray-500">Siap diekspor ke PDF Landscape</p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-2.5 text-gray-400 material-symbols-outlined text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari nama siswa, nama pengurus, NIK, NISN..."
                className="w-full text-xs font-medium pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tombol Cetak & Simpan (Alur Utama Persis Mobile) */}
              <button
                type="button"
                onClick={handlePrintAndSave}
                disabled={isSavingToDrive}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0F172A] to-[#1E293B] hover:from-[#1E293B] hover:to-[#334155] active:scale-95 text-white font-bold text-xs shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                title="Simpan file ke Google Drive folder 'VERKOM_Laporan' dan unduh dokumen PDF"
              >
                <span className="material-symbols-outlined text-[18px] text-amber-400">
                  {isSavingToDrive ? 'sync' : 'print'}
                </span>
                <span>{isSavingToDrive ? 'Menyimpan...' : 'Cetak & Simpan PDF'}</span>
              </button>

              {/* Unduh PDF Saja */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-3.5 py-2.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 font-bold text-xs shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Unduh dokumen PDF langsung ke komputer Anda"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Unduh PDF</span>
              </button>

              {/* Cetak Browser Langsung */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Buka dialog cetak browser (Landscape A4)"
              >
                <span className="material-symbols-outlined text-[18px]">local_printshop</span>
                <span>Cetak Web</span>
              </button>

              {/* Simpan ke Drive Saja */}
              <button
                type="button"
                onClick={() => saveToGoogleDrive(false)}
                disabled={isSavingToDrive}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                title="Simpan langsung ke Google Drive folder 'VERKOM_Laporan'"
              >
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                <span>Simpan ke Drive</span>
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              TABEL PREVIEW VERKOM RESMI KEMENSOS (A4 LANDSCAPE FORMAT)
              ══════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden verkom-print-container">
            {/* Header Dokumen Resmi Cetak */}
            <div className="p-4 sm:p-5 border-b border-gray-200 bg-slate-50/50">
              <h2 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight uppercase">
                {parsedData.metadata.title}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-600 font-medium">
                <span>{parsedData.metadata.npsn}</span>
                <span>{parsedData.metadata.schoolName}</span>
              </div>
            </div>

            {/* Tabel Konten Responsif */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  {/* Header Baris 1: Kolom Utama & Nama Bulan */}
                  <tr className="bg-slate-100/90 text-slate-800 border-b border-slate-300 font-bold">
                    <th rowSpan={3} className="py-2 px-2 text-center border-r border-slate-300 w-10">NO</th>
                    <th rowSpan={3} className="py-2 px-2 text-center border-r border-slate-300 min-w-[130px]">NIK PENGURUS</th>
                    <th rowSpan={3} className="py-2 px-2 text-left border-r border-slate-300 min-w-[150px]">NAMA PENGURUS</th>
                    <th rowSpan={3} className="py-2 px-2 text-center border-r border-slate-300 min-w-[130px]">NIK SISWA</th>
                    <th rowSpan={3} className="py-2 px-2 text-center border-r border-slate-300 min-w-[100px]">NISN</th>
                    <th rowSpan={3} className="py-2 px-2 text-left border-r border-slate-300 min-w-[160px]">NAMA SISWA</th>
                    <th rowSpan={3} className="py-2 px-2 text-center border-r border-slate-300 min-w-[80px]">BENTUK PENDIDIKAN</th>
                    <th rowSpan={3} className="py-2 px-2 text-center border-r border-slate-300 min-w-[80px]">TINGKAT PENDIDIKAN</th>
                    
                    {/* Bulan 1 */}
                    <th colSpan={5} className="py-1 px-2 text-center border-r border-slate-300 bg-cyan-50/60 text-cyan-900 font-extrabold">
                      {parsedData.metadata.month1}
                    </th>
                    {/* Bulan 2 */}
                    <th colSpan={5} className="py-1 px-2 text-center border-r border-slate-300 bg-amber-50/60 text-amber-900 font-extrabold">
                      {parsedData.metadata.month2}
                    </th>
                    {/* Bulan 3 */}
                    <th colSpan={5} className="py-1 px-2 text-center border-r border-slate-300 bg-emerald-50/60 text-emerald-900 font-extrabold">
                      {parsedData.metadata.month3}
                    </th>

                    <th rowSpan={3} className="py-2 px-2 text-center border-r border-slate-300 min-w-[60px]">KET</th>
                    <th rowSpan={3} className="py-2 px-2 text-left min-w-[150px]">NAMA PENDAMPING</th>
                  </tr>

                  {/* Header Baris 2: Hari Efektif */}
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 font-semibold text-[10px]">
                    <th colSpan={5} className="py-1 px-1 text-center border-r border-slate-300 bg-cyan-50/30">
                      Hari Efektif: ......
                    </th>
                    <th colSpan={5} className="py-1 px-1 text-center border-r border-slate-300 bg-amber-50/30">
                      Hari Efektif: ......
                    </th>
                    <th colSpan={5} className="py-1 px-1 text-center border-r border-slate-300 bg-emerald-50/30">
                      Hari Efektif: ......
                    </th>
                  </tr>

                  {/* Header Baris 3: Sub-kolom Kehadiran */}
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold text-[10px]">
                    {/* Sub Bulan 1 */}
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">ALPA</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">IZIN</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">SAKIT</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">JML</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-9">%</th>

                    {/* Sub Bulan 2 */}
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">ALPA</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">IZIN</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">SAKIT</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">JML</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-9">%</th>

                    {/* Sub Bulan 3 */}
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">ALPA</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">IZIN</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">SAKIT</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-8">JML</th>
                    <th className="py-1 px-1 text-center border-r border-slate-300 w-9">%</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={25} className="py-8 text-center text-slate-400">
                        Tidak ada data yang cocok dengan pencarian &ldquo;{searchQuery}&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => {
                      const displayNo = (currentPage - 1) * rowsPerPage + idx + 1;
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/80 transition-colors odd:bg-white even:bg-slate-50/30"
                        >
                          <td className="py-2 px-2 text-center text-slate-500 font-mono border-r border-slate-200">
                            {row.no || displayNo}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-slate-700 border-r border-slate-200">
                            {row.nikPengurus}
                          </td>
                          <td className="py-2 px-2 text-left font-semibold text-slate-900 border-r border-slate-200">
                            {row.namaPengurus}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-slate-700 border-r border-slate-200">
                            {row.nikSiswa}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-slate-700 border-r border-slate-200">
                            {row.nisn}
                          </td>
                          <td className="py-2 px-2 text-left font-semibold text-slate-900 border-r border-slate-200">
                            {row.namaSiswa}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-700 border-r border-slate-200">
                            {row.bentukPendidikan}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-700 border-r border-slate-200">
                            {row.tingkatPendidikan}
                          </td>

                          {/* Month 1 Data */}
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m1Alpa}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m1Izin}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m1Sakit}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200 font-semibold">{row.m1Jml}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m1Persen}</td>

                          {/* Month 2 Data */}
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m2Alpa}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m2Izin}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m2Sakit}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200 font-semibold">{row.m2Jml}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m2Persen}</td>

                          {/* Month 3 Data */}
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m3Alpa}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m3Izin}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m3Sakit}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200 font-semibold">{row.m3Jml}</td>
                          <td className="py-2 px-1 text-center border-r border-slate-200">{row.m3Persen}</td>

                          {/* KET & Pendamping */}
                          <td className="py-2 px-2 text-center text-slate-600 border-r border-slate-200">{row.ket}</td>
                          <td className="py-2 px-2 text-left text-slate-800">{row.namaPendamping}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Signature Block (Tampak juga pada Print Mode) */}
            <div className="p-6 sm:p-8 flex justify-end bg-white border-t border-slate-200">
              <div className="text-left w-64 text-xs space-y-1 text-slate-800">
                <p>............ , ......................../20......</p>
                <p>Diketahui Oleh :</p>
                <p className="font-semibold">Kepala Sekolah/wakil/Kesiswaan</p>
                <div className="h-16" />
                <div className="border-b border-slate-900 w-48" />
              </div>
            </div>

            {/* Footer Pagination */}
            {totalPages > 1 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 no-print">
                <div>
                  Menampilkan {(currentPage - 1) * rowsPerPage + 1} -{' '}
                  {Math.min(currentPage * rowsPerPage, filteredRows.length)} dari {filteredRows.length} baris
                  {filteredRows.length !== parsedData.totalRecords && (
                    <span> (difilter dari {parsedData.totalRecords} total data)</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>

                  <span className="px-3 py-1 font-semibold text-slate-800">
                    Halaman {currentPage} dari {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PRINT-ONLY CSS (A4 LANDSCAPE)
          ══════════════════════════════════════════════════════════ */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            background: white !important;
            color: black !important;
            font-size: 8pt !important;
          }
          .no-print,
          header,
          aside,
          nav,
          footer {
            display: none !important;
          }
          .verkom-print-container {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 7pt !important;
          }
          th, td {
            border: 0.5pt solid black !important;
            padding: 2px 3px !important;
          }
        }
      `}</style>
    </div>
  );
}
