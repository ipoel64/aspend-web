'use client';

import React, { useState } from 'react';

interface KpmImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onNavigateHome?: () => void;
}

type ImportTarget = 'keluarga' | 'anggota' | 'aset';
type ImportMode = 'skip' | 'overwrite';

interface PreviewAnalysis {
  target: string;
  keyField: string;
  totalRows: number;
  validCount: number;
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
  duplicates: Array<{ key: string; nama: string; rowNum: number }>;
  detailErrors: string[];
  previewData: Array<Record<string, any>>;
}

export default function KpmImportModal({
  isOpen,
  onClose,
  onSuccess,
  onNavigateHome,
}: KpmImportModalProps) {
  const [target, setTarget] = useState<ImportTarget>('keluarga');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Pre-check analysis
  const [previewAnalysis, setPreviewAnalysis] = useState<PreviewAnalysis | null>(null);

  // User confirmation options
  const [importMode, setImportMode] = useState<ImportMode>('skip');
  const [selectedTahap, setSelectedTahap] = useState<string>('Tahap 1 (2026)');
  const [isAgreed, setIsAgreed] = useState(false);

  // Execution result
  const [resultMsg, setResultMsg] = useState<{
    success: boolean;
    text: string;
    imported?: number;
    updated?: number;
    skipped?: number;
    errors?: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewAnalysis(null);
    setResultMsg(null);
    setIsAgreed(false);
    onClose();
  };

  const handleDownloadTemplate = () => {
    window.open(`/api/kpm/export?type=template&target=${target}`, '_blank');
  };

  const handleTargetChange = (newTarget: ImportTarget) => {
    setTarget(newTarget);
    setSelectedFile(null);
    setPreviewAnalysis(null);
    setResultMsg(null);
    setIsAgreed(false);
  };

  // Pre-check / Preview analysis
  const analyzeFile = async (file: File, currentTarget: ImportTarget, currentTahap?: string) => {
    setIsAnalyzing(true);
    setPreviewAnalysis(null);
    setResultMsg(null);
    setIsAgreed(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('target', currentTarget);
      formData.append('tahap', currentTahap || selectedTahap);
      formData.append('action', 'preview');

      const res = await fetch('/api/kpm/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Gagal menganalisis file impor');
      }

      setPreviewAnalysis(json);
    } catch (err: any) {
      setResultMsg({
        success: false,
        text: err.message || 'Gagal membaca isi file Excel.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) {
      analyzeFile(file, target);
    } else {
      setPreviewAnalysis(null);
    }
  };

  // Commit Execution
  const handleExecuteImport = async () => {
    if (!selectedFile) return;

    setIsExecuting(true);
    setResultMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('target', target);
      formData.append('tahap', selectedTahap);
      formData.append('action', 'commit');
      formData.append('mode', importMode);

      const res = await fetch('/api/kpm/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setResultMsg({
          success: false,
          text: json.error || 'Gagal mengeksekusi impor data.',
          errors: json.detailErrors || [],
        });
        return;
      }

      setResultMsg({
        success: true,
        text: json.message || 'Impor data berhasil diproses.',
        imported: json.importedCount,
        updated: json.updatedCount,
        skipped: json.skippedCount,
        errors: json.detailErrors,
      });

      onSuccess();
    } catch (err: any) {
      setResultMsg({
        success: false,
        text: err.message || 'Terjadi kesalahan saat mengimpor data.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-600 to-cyan-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">
              {resultMsg?.success ? 'task_alt' : 'upload_file'}
            </span>
            <div>
              <h3 className="font-bold text-base font-['Outfit']">
                {resultMsg?.success ? 'Informasi Hasil Impor' : 'Impor Data KPM dari Excel'}
              </h3>
              <p className="text-[11px] text-white/80">
                {resultMsg?.success ? 'Status dan ringkasan penyimpanan database' : 'Impor data keluarga, anggota keluarga, atau aset & lokasi'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-lg text-white cursor-pointer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {resultMsg?.success ? (
          /* POPUP INFORMASI BERHASIL */
          <div className="p-6 md:p-8 flex flex-col items-center text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Ikon Berhasil */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="material-symbols-outlined text-4xl">verified</span>
            </div>

            {/* Judul & Keterangan */}
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-gray-900 font-['Outfit']">
                Impor Data Berhasil!
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                Data Excel telah berhasil diproses dan disimpan secara aman ke database Google Sheets.
              </p>
            </div>

            {/* Kartu Ringkasan Hasil Impor */}
            <div className="w-full bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 text-xs text-left space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
                <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-emerald-700">summarize</span>
                  Ringkasan: {target === 'keluarga' ? 'Data KPM (Keluarga)' : target === 'anggota' ? 'Data Anggota Keluarga' : 'Data Aset & Lokasi'}
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                  SELESAI
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                  <p className="text-[11px] text-gray-500 font-medium">Data Baru Disimpan</p>
                  <p className="text-2xl font-black text-emerald-700 mt-0.5">
                    {resultMsg.imported || 0} <span className="text-xs font-semibold text-gray-500">baris</span>
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-cyan-100 shadow-2xs">
                  <p className="text-[11px] text-gray-500 font-medium">Data Ditimpa / Diperbarui</p>
                  <p className="text-2xl font-black text-cyan-700 mt-0.5">
                    {resultMsg.updated || 0} <span className="text-xs font-semibold text-gray-500">baris</span>
                  </p>
                </div>
              </div>

              {resultMsg.skipped ? (
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                  <span className="flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-sm text-amber-600">skip_next</span>
                    Data Duplikat Dilewati:
                  </span>
                  <span className="font-bold">{resultMsg.skipped} baris</span>
                </div>
              ) : null}
            </div>

            {/* Tombol Aksi: Tutup dan Kembali ke Beranda */}
            <div className="grid grid-cols-2 gap-3 w-full pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 px-4 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Tutup</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleClose();
                  if (onNavigateHome) {
                    onNavigateHome();
                  } else {
                    window.location.href = '/';
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">home</span>
                <span>Kembali ke Beranda</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Content Body */}
            <div className="p-6 space-y-4 text-xs text-gray-700 max-h-[80vh] overflow-y-auto">
          {/* Step 1: Pilih Target Data */}
          <div>
            <label className="font-bold text-gray-900 block mb-1.5">1. Pilih Kategori Data yang Akan Diimpor:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'keluarga', label: 'Data KPM (Keluarga)', icon: 'home', keyName: 'Kunci: No. KK' },
                { id: 'anggota', label: 'Anggota Keluarga', icon: 'group', keyName: 'Kunci: NIK' },
                { id: 'aset', label: 'Aset & Lokasi', icon: 'location_on', keyName: 'Kunci: No. KK' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTargetChange(t.id as ImportTarget)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    target === t.id
                      ? 'bg-cyan-50 border-cyan-500 text-cyan-950 font-bold shadow-xs'
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{t.icon}</span>
                  <span className="text-[11px] leading-tight">{t.label}</span>
                  <span className="text-[9px] text-gray-400 font-normal">{t.keyName}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step Khusus: Pilih Tahap Penyaluran Bansos (Khusus Data KPM) */}
          {target === 'keluarga' && (
            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-sky-950 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-cyan-700">event_repeat</span>
                  <span>Pilih Tahap Bansos yang Diimpor:</span>
                </label>
                <span className="text-[11px] font-bold text-cyan-800 bg-white px-2 py-0.5 rounded-md border border-sky-200">
                  {selectedTahap}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['Tahap 1 (2026)', 'Tahap 2 (2026)', 'Tahap 3 (2026)', 'Tahap 4 (2026)'].map((thp) => (
                  <button
                    key={thp}
                    type="button"
                    onClick={() => {
                      setSelectedTahap(thp);
                      if (selectedFile) analyzeFile(selectedFile, target, thp);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                      selectedTahap === thp
                        ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {thp}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-sky-800 leading-relaxed">
                ℹ️ <strong>Data KPM yang sudah ada tidak akan tertimpa isinya</strong>. Kepesertaan tahap ini akan didaftarkan secara akumulatif, dan sistem otomatis menganalisis KPM baru pada tahap ini.
              </p>
            </div>
          )}

          {/* Step 2: Unduh Template Sesuai Target */}
          <div className="p-3.5 bg-cyan-50/70 border border-cyan-200 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-cyan-900 flex items-center gap-1">
                <span className="material-symbols-outlined text-base">download_for_offline</span>
                Template Excel: {target === 'keluarga' ? 'Data Keluarga' : target === 'anggota' ? 'Data Anggota' : 'Aset & Lokasi'}
              </p>
              <p className="text-[11px] text-cyan-800 mt-0.5">
                Kunci unik:{' '}
                <strong>{target === 'anggota' ? 'NIK Anggota' : 'Nomor Kartu Keluarga (No. KK)'}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1 shrink-0"
            >
              <span>Unduh Template</span>
              <span className="material-symbols-outlined text-xs">file_download</span>
            </button>
          </div>

          {/* Step 3: Pilih File */}
          <div className="space-y-1.5">
            <label className="font-bold text-gray-800 block">2. Pilih File Excel yang Ingin Diimpor (.xlsx / .xls):</label>
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-5 text-center hover:border-cyan-500 transition-colors bg-gray-50/50">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isAnalyzing || isExecuting}
                id="excelFileInput"
                className="hidden"
              />
              <label htmlFor="excelFileInput" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-3xl text-cyan-600">table_chart</span>
                {selectedFile ? (
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{selectedFile.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB (Klik untuk mengganti file)
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-gray-700">Klik untuk memilih file Excel</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Mendukung format .xlsx, .xls, atau .csv</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Analisis Loading */}
          {isAnalyzing && (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-gray-500">
              <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-medium text-xs">Menganalisis data dan memeriksa duplikasi di database...</p>
            </div>
          )}

          {/* Step 4: Hasil Analisis & Konfirmasi Duplikasi */}
          {previewAnalysis && !isAnalyzing && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-gray-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-cyan-600">manage_search</span>
                  Hasil Analisis Data ({previewAnalysis.validCount} Terbaca)
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  Kunci: {previewAnalysis.keyField}
                </span>
              </div>

              {/* Badges Statistik */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center">
                  <p className="text-lg font-bold text-emerald-800">{previewAnalysis.newCount}</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">Data Baru</p>
                </div>
                <div className={`p-2.5 rounded-xl text-center border ${
                  previewAnalysis.duplicateCount > 0 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-gray-100 border-gray-200 text-gray-500'
                }`}>
                  <p className="text-lg font-bold">{previewAnalysis.duplicateCount}</p>
                  <p className="text-[10px] font-semibold">Data Sudah Ada (Duplikat)</p>
                </div>
                <div className={`p-2.5 rounded-xl text-center border ${
                  previewAnalysis.invalidCount > 0 ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-gray-100 border-gray-200 text-gray-500'
                }`}>
                  <p className="text-lg font-bold">{previewAnalysis.invalidCount}</p>
                  <p className="text-[10px] font-semibold">Tidak Valid / Dilewati</p>
                </div>
              </div>

              {/* Rincian Peringatan Duplikat & Mode Pilihan */}
              {previewAnalysis.duplicateCount > 0 && (
                <div className="p-3 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2 text-amber-950">
                  <p className="font-bold text-[11px] flex items-center gap-1 text-amber-900">
                    <span className="material-symbols-outlined text-base">
                      {target === 'keluarga' ? 'info' : 'warning'}
                    </span>
                    {target === 'keluarga'
                      ? `Analisis: Ditemukan ${previewAnalysis.duplicateCount} KPM yang sudah terdaftar di tahap sebelumnya`
                      : `Perhatian: Ditemukan ${previewAnalysis.duplicateCount} data yang sudah ada di database!`}
                  </p>
                  {target === 'keluarga' && (
                    <p className="text-[11px] text-sky-900 bg-sky-50 p-2 rounded-lg border border-sky-200">
                      🛡️ <strong>Keamanan Data Terjamin:</strong> Data pokok profil (NIK, Nama, Alamat, Foto, dll.) tidak akan tertimpa. Sistem secara otomatis mendaftarkan kepesertaan <strong>{selectedTahap}</strong> dan mendata <strong>{previewAnalysis.newCount} KPM Baru</strong>.
                    </p>
                  )}

                  <div className="space-y-1.5 pt-1">
                    <p className="font-semibold text-[11px]">Silakan pilih tindakan untuk data yang sudah ada:</p>
                    <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="skip"
                        checked={importMode === 'skip'}
                        onChange={() => setImportMode('skip')}
                        className="accent-cyan-600"
                      />
                      <div>
                        <p className="font-bold text-gray-900">Hanya impor data baru saja</p>
                        <p className="text-[10px] text-gray-500">Data yang sudah terdaftar akan dilewati dan tidak diubah.</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="overwrite"
                        checked={importMode === 'overwrite'}
                        onChange={() => setImportMode('overwrite')}
                        className="accent-cyan-600"
                      />
                      <div>
                        <p className="font-bold text-gray-900">Timpa / Perbarui data yang sudah ada</p>
                        <p className="text-[10px] text-gray-500">
                          Data lama dengan {target === 'anggota' ? 'NIK' : 'No. KK'} yang sama akan diperbarui dengan data dari Excel.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Contoh Duplikat */}
                  {previewAnalysis.duplicates.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[10px] text-gray-500 font-semibold mb-1">Contoh data yang sudah ada di database:</p>
                      <div className="max-h-24 overflow-y-auto bg-white p-2 rounded-lg border border-gray-200 text-[10px] space-y-0.5 font-mono text-gray-700">
                        {previewAnalysis.duplicates.slice(0, 5).map((d, i) => (
                          <p key={i}>• Baris {d.rowNum}: [{d.key}] {d.nama}</p>
                        ))}
                        {previewAnalysis.duplicates.length > 5 && (
                          <p className="font-bold text-gray-400">...dan {previewAnalysis.duplicates.length - 5} data lainnya.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rincian Baris Tidak Valid */}
              {previewAnalysis.detailErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-900">
                  <p className="font-bold text-[11px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">error</span>
                    Catatan baris yang tidak memenuhi kriteria:
                  </p>
                  <div className="max-h-24 overflow-y-auto bg-white/80 p-2 rounded-lg border border-rose-200 text-[10px] space-y-0.5 font-mono text-rose-700">
                    {previewAnalysis.detailErrors.slice(0, 5).map((err, i) => (
                      <p key={i}>⚠️ {err}</p>
                    ))}
                    {previewAnalysis.detailErrors.length > 5 && (
                      <p className="font-bold text-gray-400">...dan {previewAnalysis.detailErrors.length - 5} catatan lainnya.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Checkbox Konfirmasi Persetujuan */}
              <div className="pt-1">
                <label className="flex items-center gap-2 p-2.5 bg-cyan-50 border border-cyan-300 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAgreed}
                    onChange={(e) => setIsAgreed(e.target.checked)}
                    className="w-4 h-4 accent-cyan-600 rounded"
                  />
                  <span className="font-bold text-cyan-950 text-xs">
                    Saya menyetujui proses impor ini ({importMode === 'overwrite' ? 'Menimpa data lama' : 'Hanya data baru'})
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Result Alert jika terjadi error pada eksekusi */}
          {resultMsg && !resultMsg.success && (
            <div className="p-4 rounded-xl border text-xs leading-relaxed space-y-1.5 bg-rose-50 border-rose-300 text-rose-900">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{resultMsg.text}</span>
              </div>
              {resultMsg.errors && resultMsg.errors.length > 0 && (
                <div className="max-h-24 overflow-y-auto bg-white/80 p-2 rounded-lg border border-rose-200 text-[10px] space-y-0.5 font-mono text-rose-700 mt-1">
                  {resultMsg.errors.slice(0, 5).map((err, i) => (
                    <p key={i}>⚠️ {err}</p>
                  ))}
                  {resultMsg.errors.length > 5 && (
                    <p className="font-bold text-gray-400">...dan {resultMsg.errors.length - 5} rincian lainnya.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={!selectedFile || !previewAnalysis || !isAgreed || isExecuting || isAnalyzing}
            className="px-6 py-2 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Menyimpan ke Database...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">cloud_upload</span>
                <span>Mulai Impor Data</span>
              </>
            )}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
