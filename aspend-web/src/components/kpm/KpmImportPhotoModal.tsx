'use client';

import React, { useState } from 'react';
import JSZip from 'jszip';

interface KpmImportPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportSourceType = 'drive' | 'zip';

interface PreviewItem {
  rowNum: number;
  noKK: string;
  namaPengurus: string;
  isKpmExists: boolean;
  hasExistingAset: boolean;
  statusRumah: string;
  usaha: string;
  jenisUsaha: string;
  rLuarFilename: string;
  rLuarDriveFileId: string;
  rLuarFound: boolean;
  rDalamFilename: string;
  rDalamDriveFileId: string;
  rDalamFound: boolean;
}

interface AnalysisResult {
  totalOldRows: number;
  matchedKpmCount: number;
  unmatchedKpmCount: number;
  driveFolderScanned: boolean;
  driveFilesCount: number;
  driveScanError?: string;
  rLuarMatchCount: number;
  rDalamMatchCount: number;
  canDirectDriveCopy: boolean;
  previewItems: PreviewItem[];
  allMatchedItems: PreviewItem[];
}

export default function KpmImportPhotoModal({
  isOpen,
  onClose,
  onSuccess,
}: KpmImportPhotoModalProps) {
  const [sourceType, setSourceType] = useState<ImportSourceType>('zip'); // Default to ZIP for reliability

  // Input fields for Drive method
  const [driveFolderInput, setDriveFolderInput] = useState('');
  const [sheetInputType, setSheetInputType] = useState<'url' | 'file'>('url');
  const [oldSheetUrl, setOldSheetUrl] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);

  // Input fields for ZIP / Direct upload method
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [cachedZip, setCachedZip] = useState<JSZip | null>(null);
  const [multipleImages, setMultipleImages] = useState<FileList | null>(null);

  // Analysis & Execution states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [mode, setMode] = useState<'overwrite' | 'skip'>('overwrite');

  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    uploaded: number;
    asetUpdated: number;
  } | null>(null);

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    message: string;
    copiedCount?: number;
    uploadedCount?: number;
    asetUpdatedCount?: number;
    asetCreatedCount?: number;
    errors?: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setAnalysisResult(null);
    setExecutionResult(null);
    setProgress(null);
    setErrorMsg('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // 1. Analyze / Preview Data
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setExecutionResult(null);
    setProgress(null);
    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('action', 'preview');

      if (sourceType === 'drive') {
        if (!driveFolderInput.trim()) {
          throw new Error('Harap masukkan Link atau ID Folder Google Drive foto lama (RUMAH_Images).');
        }
        formData.append('oldDriveFolderId', driveFolderInput.trim());

        if (sheetInputType === 'url') {
          if (!oldSheetUrl.trim()) {
            throw new Error('Harap masukkan Link atau ID Google Sheet database lama ("RUMAH").');
          }
          formData.append('oldSpreadsheetId', oldSheetUrl.trim());
        } else {
          if (!excelFile) {
            throw new Error('Harap pilih file Excel (.xlsx / .csv) database lama ("RUMAH").');
          }
          formData.append('excelFile', excelFile);
        }
      } else {
        // ZIP method: scan filenames locally in browser to avoid sending 200MB file on preview!
        if (!zipFile && (!multipleImages || multipleImages.length === 0)) {
          throw new Error('Harap pilih file ZIP (misal RUMAH_Images.zip) atau kumpulan file foto.');
        }

        let zipFilenames: string[] = [];
        if (zipFile) {
          let zipObj = cachedZip;
          if (!zipObj) {
            const zip = new JSZip();
            zipObj = await zip.loadAsync(zipFile);
            setCachedZip(zipObj);
          }
          zipFilenames = Object.keys(zipObj.files).filter(
            (k) => !zipObj.files[k].dir && !k.startsWith('__MACOSX')
          );
        } else if (multipleImages) {
          zipFilenames = Array.from(multipleImages).map((f) => f.name);
        }

        formData.append('zipFilenames', JSON.stringify(zipFilenames));

        if (sheetInputType === 'url') {
          if (!oldSheetUrl.trim()) {
            throw new Error('Harap masukkan Link atau ID Google Sheet database lama.');
          }
          formData.append('oldSpreadsheetId', oldSheetUrl.trim());
        } else {
          if (!excelFile) {
            throw new Error('Harap pilih file Excel database lama ("RUMAH").');
          }
          formData.append('excelFile', excelFile);
        }
      }

      const res = await fetch('/api/kpm/import-photos', {
        method: 'POST',
        body: formData,
      });

      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        if (res.status === 413 || responseText.toLowerCase().includes('too large')) {
          throw new Error('Ukuran data melebihi batas server (413 Request Entity Too Large).');
        }
        throw new Error(`Server error (${res.status}): ${responseText.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menganalisis data impor foto.');
      }

      setAnalysisResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menganalisis data.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2. Commit / Execute Import
  const handleExecuteImport = async () => {
    if (!analysisResult) return;
    setErrorMsg('');
    setIsExecuting(true);

    try {
      if (sourceType === 'drive') {
        // Direct Cloud-to-Cloud copy
        const res = await fetch('/api/kpm/import-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'commit-drive',
            oldDriveFolderId: driveFolderInput.trim(),
            mode,
            items: analysisResult.allMatchedItems,
          }),
        });

        const responseText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`Server error (${res.status}): ${responseText.slice(0, 120)}`);
        }

        if (!res.ok) {
          throw new Error(data.error || 'Gagal menjalankan pemindahan foto antar Google Drive.');
        }

        setExecutionResult(data);
        onSuccess();
      } else {
        // ZIP / File upload - Stream upload in batches of 5 KPM to prevent 413 Request Entity Too Large
        let zipObj = cachedZip;
        if (!zipObj && zipFile) {
          const zip = new JSZip();
          zipObj = await zip.loadAsync(zipFile);
          setCachedZip(zipObj);
        }

        const matchedItems = analysisResult.allMatchedItems;
        const BATCH_SIZE = 5;
        setProgress({
          current: 0,
          total: matchedItems.length,
          percent: 0,
          uploaded: 0,
          asetUpdated: 0,
        });

        let totalUploaded = 0;
        let totalAsetUpdated = 0;
        let totalAsetCreated = 0;
        const batchErrors: string[] = [];

        for (let i = 0; i < matchedItems.length; i += BATCH_SIZE) {
          const batchItems = matchedItems.slice(i, i + BATCH_SIZE);
          const batchFormData = new FormData();
          batchFormData.append('action', 'commit-upload');
          batchFormData.append('mode', mode);
          batchFormData.append('items', JSON.stringify(batchItems));

          // Attach photos for this batch
          for (const item of batchItems) {
            if (zipObj) {
              if (item.rLuarFilename) {
                const targetName = item.rLuarFilename.toLowerCase();
                const zipKey = Object.keys(zipObj.files).find(
                  (k) => k.toLowerCase().endsWith(targetName)
                );
                if (zipKey) {
                  const blob = await zipObj.files[zipKey].async('blob');
                  batchFormData.append('imageFiles', blob, item.rLuarFilename);
                }
              }
              if (item.rDalamFilename) {
                const targetName = item.rDalamFilename.toLowerCase();
                const zipKey = Object.keys(zipObj.files).find(
                  (k) => k.toLowerCase().endsWith(targetName)
                );
                if (zipKey) {
                  const blob = await zipObj.files[zipKey].async('blob');
                  batchFormData.append('imageFiles', blob, item.rDalamFilename);
                }
              }
            } else if (multipleImages) {
              for (const img of Array.from(multipleImages)) {
                const imgLower = img.name.toLowerCase();
                if (
                  imgLower === item.rLuarFilename.toLowerCase() ||
                  imgLower === item.rDalamFilename.toLowerCase()
                ) {
                  batchFormData.append('imageFiles', img);
                }
              }
            }
          }

          const res = await fetch('/api/kpm/import-photos', {
            method: 'POST',
            body: batchFormData,
          });

          const responseText = await res.text();
          let resData: any = {};
          try {
            resData = JSON.parse(responseText);
          } catch {
            if (res.status === 413 || responseText.toLowerCase().includes('too large')) {
              throw new Error('Ukuran foto pada batch ini melebihi batas server (413).');
            }
            throw new Error(`Server error (${res.status}): ${responseText.slice(0, 120)}`);
          }

          if (!res.ok) {
            throw new Error(resData.error || 'Gagal mengunggah foto ke ASPEND.');
          }

          if (resData.uploadedCount) totalUploaded += resData.uploadedCount;
          if (resData.asetUpdatedCount) totalAsetUpdated += resData.asetUpdatedCount;
          if (resData.asetCreatedCount) totalAsetCreated += resData.asetCreatedCount;
          if (resData.errors) batchErrors.push(...resData.errors);

          const currentCount = Math.min(i + BATCH_SIZE, matchedItems.length);
          setProgress({
            current: currentCount,
            total: matchedItems.length,
            percent: Math.round((currentCount / matchedItems.length) * 100),
            uploaded: totalUploaded,
            asetUpdated: totalAsetUpdated,
          });
        }

        setExecutionResult({
          success: true,
          message: `Berhasil mengunggah ${totalUploaded} foto ke Google Drive ASPEND. Data Aset diperbarui: ${totalAsetUpdated}, data Aset baru dibuat: ${totalAsetCreated}.`,
          uploadedCount: totalUploaded,
          asetUpdatedCount: totalAsetUpdated,
          asetCreatedCount: totalAsetCreated,
          errors: batchErrors,
        });
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat mengeksekusi impor foto.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-2xl text-white">photo_library</span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Impor / Migrasi Foto KPM</h2>
              <p className="text-xs text-white/80">Salin & hubungkan foto rumah KPM dari Google Drive lama ke profil ASPEND</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-gray-800 text-sm">
          
          {/* Success Banner */}
          {executionResult && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-bold text-base text-emerald-800">
                <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                Impor Foto Selesai!
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                {executionResult.message}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">
                    {executionResult.copiedCount ?? executionResult.uploadedCount ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">Foto Tersimpan</div>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 text-center">
                  <div className="text-lg font-extrabold text-teal-700">
                    {executionResult.asetUpdatedCount ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">Aset Diperbarui</div>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 text-center col-span-2 sm:col-span-1">
                  <div className="text-lg font-extrabold text-cyan-700">
                    {executionResult.asetCreatedCount ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">Aset Baru Dibuat</div>
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Tutup & Lihat Data KPM
                </button>
              </div>
            </div>
          )}

          {!executionResult && (
            <>
              {/* Method Switcher Tabs */}
              <div className="flex rounded-2xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => { setSourceType('drive'); handleReset(); }}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sourceType === 'drive'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">cloud_sync</span>
                  Salin Langsung dari Google Drive
                </button>
                <button
                  type="button"
                  onClick={() => { setSourceType('zip'); handleReset(); }}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sourceType === 'zip'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">folder_zip</span>
                  Unggah File ZIP / Foto dari Komputer
                </button>
              </div>

              {/* Form Input Section */}
              <form onSubmit={handleAnalyze} className="space-y-4">
                
                {/* Method 1: Google Drive */}
                {sourceType === 'drive' && (
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        1. Link atau ID Folder Google Drive Foto Lama (RUMAH_Images) *
                      </label>
                      <input
                        type="text"
                        value={driveFolderInput}
                        onChange={(e) => { setDriveFolderInput(e.target.value); handleReset(); }}
                        placeholder="Contoh: https://drive.google.com/drive/folders/1KkPBbU3qirsObK8cEpnJJbKK-DXNWRS_ atau 1KkPBbU3..."
                        className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        required
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        💡 Buka folder <strong>RUMAH_Images</strong> di Drive lama, salin link dari browser dan tempel di sini. Pastikan folder dapat diakses atau di-share ke akun ini.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">
                          2. Sumber Data Pemetaan Tabel "RUMAH" *
                        </label>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => { setSheetInputType('url'); handleReset(); }}
                            className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                              sheetInputType === 'url' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Link Google Sheet
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSheetInputType('file'); handleReset(); }}
                            className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                              sheetInputType === 'file' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Upload File Excel
                          </button>
                        </div>
                      </div>

                      {sheetInputType === 'url' ? (
                        <input
                          type="text"
                          value={oldSheetUrl}
                          onChange={(e) => { setOldSheetUrl(e.target.value); handleReset(); }}
                          placeholder="Contoh: https://docs.google.com/spreadsheets/d/1aBcDeFg.../edit atau ID Spreadsheet"
                          className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          required={sheetInputType === 'url'}
                        />
                      ) : (
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => { setExcelFile(e.target.files?.[0] || null); handleReset(); }}
                          className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                          required={sheetInputType === 'file'}
                        />
                      )}
                      <p className="text-[11px] text-gray-500 mt-1">
                        Tabel yang berisi kolom <strong>NKK, PENGURUS, R_LUAR, R_DALAM</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Method 2: ZIP / Offline */}
                {sourceType === 'zip' && (
                  <div className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-100 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        1. Unggah File ZIP Foto (RUMAH_Images.zip) atau Kumpulan Foto *
                      </label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept=".zip"
                            onChange={(e) => {
                              setZipFile(e.target.files?.[0] || null);
                              setMultipleImages(null);
                              handleReset();
                            }}
                            className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-100 file:text-cyan-800 hover:file:bg-cyan-200 cursor-pointer"
                          />
                        </div>
                        <div className="text-center text-[10px] text-gray-400 font-bold uppercase">— ATAU PILIH BANYAK FOTO LANGSUNG —</div>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            setMultipleImages(e.target.files);
                            setZipFile(null);
                            handleReset();
                          }}
                          className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        💡 Cara mudah: Klik kanan folder <strong>RUMAH_Images</strong> di Google Drive &gt; pilih <strong>Download</strong>. Google akan otomatis mengunduh sebagai file <strong>.zip</strong>.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">
                          2. Sumber Data Pemetaan Tabel "RUMAH" *
                        </label>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => { setSheetInputType('file'); handleReset(); }}
                            className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                              sheetInputType === 'file' ? 'bg-cyan-700 text-white font-bold' : 'text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Upload File Excel
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSheetInputType('url'); handleReset(); }}
                            className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                              sheetInputType === 'url' ? 'bg-cyan-700 text-white font-bold' : 'text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Link Google Sheet
                          </button>
                        </div>
                      </div>

                      {sheetInputType === 'file' ? (
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => { setExcelFile(e.target.files?.[0] || null); handleReset(); }}
                          className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 cursor-pointer"
                          required={sheetInputType === 'file'}
                        />
                      ) : (
                        <input
                          type="text"
                          value={oldSheetUrl}
                          onChange={(e) => { setOldSheetUrl(e.target.value); handleReset(); }}
                          placeholder="Contoh: https://docs.google.com/spreadsheets/d/1aBcDeFg.../edit"
                          className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                          required={sheetInputType === 'url'}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-base shrink-0">error</span>
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Analyze Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isAnalyzing}
                    className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                        Menganalisis & Mencocokkan Data...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">search_check</span>
                        Analisis & Cocokkan Data
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Analysis Result & Preview */}
              {analysisResult && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600">query_stats</span>
                      Hasil Analisis & Pencocokan
                    </h3>
                    <span className="text-xs text-gray-500">
                      Total Baris Lama: <strong>{analysisResult.totalOldRows}</strong>
                    </span>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                      <div className="text-xs text-gray-500">KPM ASPEND Cocok</div>
                      <div className="text-lg font-extrabold text-emerald-700">
                        {analysisResult.matchedKpmCount}
                      </div>
                      <div className="text-[10px] text-emerald-600">Sesuai No. KK di ASPEND</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-cyan-50 border border-cyan-100">
                      <div className="text-xs text-gray-500">Foto R_LUAR Cocok</div>
                      <div className="text-lg font-extrabold text-cyan-700">
                        {analysisResult.rLuarMatchCount}
                      </div>
                      <div className="text-[10px] text-cyan-600">Tampak Luar</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-teal-50 border border-teal-100">
                      <div className="text-xs text-gray-500">Foto R_DALAM Cocok</div>
                      <div className="text-lg font-extrabold text-teal-700">
                        {analysisResult.rDalamMatchCount}
                      </div>
                      <div className="text-[10px] text-teal-600">Tampak Dalam</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="text-xs text-gray-500">
                        {sourceType === 'drive' ? 'File Terbaca di Drive' : 'File Terbaca di ZIP'}
                      </div>
                      <div className={`text-lg font-extrabold ${analysisResult.driveFilesCount > 0 || sourceType === 'zip' ? 'text-indigo-700' : 'text-rose-600'}`}>
                        {sourceType === 'drive' ? analysisResult.driveFilesCount : (zipFile ? 'File ZIP Terpilih' : 'Foto Terpilih')}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {sourceType === 'drive' ? (analysisResult.driveFilesCount === 0 ? '0 file (Akses Google Dibatasi)' : 'File siap disalin') : 'Siap diekstrak'}
                      </div>
                    </div>
                  </div>

                  {/* Callout jika pembacaan Drive menghasilkan 0 file karena izin Google */}
                  {sourceType === 'drive' && analysisResult.driveFilesCount === 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-950 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                        <span className="material-symbols-outlined text-base text-amber-600">verified</span>
                        <span>No. KK Berhasil Dicocokkan ({analysisResult.matchedKpmCount} KPM Terdaftar di ASPEND Cocok)!</span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Data No. KK (NKK) Anda <strong>100% cocok dengan {analysisResult.matchedKpmCount} KPM</strong> di database ASPEND. Namun, isi folder Google Drive foto lama terbaca <strong>0 file</strong> karena Google membatasi akses listing file lintas akun.
                      </p>
                      <div className="p-3 bg-white/80 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                        <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                          <span className="material-symbols-outlined text-sm text-emerald-600">lightbulb</span>
                          Solusi Cepat &amp; Pasti Berhasil (1 Menit):
                        </div>
                        <ol className="list-decimal pl-4 space-y-1 text-[11px] text-gray-700">
                          <li>Buka folder <strong>RUMAH_Images</strong> di Google Drive Anda.</li>
                          <li>Klik panah di samping nama folder &gt; pilih <strong>Download</strong> (Google Drive akan otomatis mengunduh file <strong>.zip</strong>).</li>
                          <li>Beralih ke tab <strong>"Unggah File ZIP / Foto dari Komputer"</strong> di atas, masukkan file ZIP tersebut.</li>
                          <li>Klik tombol <strong>Analisis</strong>, maka seluruh foto R_LUAR dan R_DALAM akan langsung cocok 100%!</li>
                        </ol>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => { setSourceType('zip'); handleReset(); }}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">folder_zip</span>
                            Beralih ke Tab Unggah ZIP Sekarang
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {analysisResult.driveScanError && analysisResult.driveFilesCount > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm shrink-0">warning</span>
                      <span>Peringatan Google Drive: {analysisResult.driveScanError}</span>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-600 sticky top-0">
                          <tr>
                            <th className="py-2 px-3">No. KK</th>
                            <th className="py-2 px-3">Nama Pengurus</th>
                            <th className="py-2 px-3">Status KPM</th>
                            <th className="py-2 px-3">Foto Luar</th>
                            <th className="py-2 px-3">Foto Dalam</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {analysisResult.previewItems.map((item, idx) => (
                            <tr key={idx} className={item.isKpmExists ? 'hover:bg-emerald-50/40' : 'bg-gray-50/50 opacity-60'}>
                              <td className="py-2 px-3 font-mono font-bold text-gray-700">{item.noKK}</td>
                              <td className="py-2 px-3 font-medium text-gray-900">{item.namaPengurus}</td>
                              <td className="py-2 px-3">
                                {item.isKpmExists ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    ASPEND Cocok
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[10px]">
                                    Belum Ada
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {item.rLuarFilename ? (
                                  <span className={`text-[10px] flex items-center gap-1 ${item.rLuarFound || sourceType === 'zip' ? 'text-cyan-700 font-semibold' : 'text-gray-400'}`}>
                                    <span className="material-symbols-outlined text-xs">
                                      {item.rLuarFound || sourceType === 'zip' ? 'check' : 'help_outline'}
                                    </span>
                                    {item.rLuarFilename}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {item.rDalamFilename ? (
                                  <span className={`text-[10px] flex items-center gap-1 ${item.rDalamFound || sourceType === 'zip' ? 'text-teal-700 font-semibold' : 'text-gray-400'}`}>
                                    <span className="material-symbols-outlined text-xs">
                                      {item.rDalamFound || sourceType === 'zip' ? 'check' : 'help_outline'}
                                    </span>
                                    {item.rDalamFilename}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mode & Action Controls */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-gray-800">Opsi Penanganan Foto yang Sudah Ada:</div>
                        <div className="text-[11px] text-gray-500">Tentukan apakah foto lama di ASPEND akan ditimpa atau dilewati.</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="importMode"
                            value="overwrite"
                            checked={mode === 'overwrite'}
                            onChange={() => setMode('overwrite')}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Timpa Foto</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="importMode"
                            value="skip"
                            checked={mode === 'skip'}
                            onChange={() => setMode('skip')}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Hanya Isi yang Kosong</span>
                        </label>
                      </div>
                    </div>

                    {/* Live Progress Bar saat impor berlangsung */}
                    {progress && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm animate-spin text-emerald-600">sync</span>
                            Sedang Mengunggah &amp; Menyimpan Foto KPM ke Google Drive...
                          </span>
                          <span>{progress.current} / {progress.total} KPM ({progress.percent}%)</span>
                        </div>
                        <div className="w-full bg-emerald-200/60 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-emerald-800 flex justify-between font-medium">
                          <span>Foto berhasil diunggah: <strong>{progress.uploaded} foto</strong></span>
                          <span>Aset diperbarui: <strong>{progress.asetUpdated} data</strong></span>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={isExecuting}
                        className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs rounded-xl cursor-pointer transition-all disabled:opacity-40"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteImport}
                        disabled={isExecuting || analysisResult.matchedKpmCount === 0}
                        className="px-6 py-2.5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isExecuting ? (
                          <>
                            <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                            {progress ? `Memproses ${progress.current}/${progress.total} KPM...` : 'Sedang Menyalin & Mengunggah Foto ke Drive...'}
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">cloud_upload</span>
                            Mulai Impor {analysisResult.matchedKpmCount} Foto KPM
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

      </div>
    </div>
  );
}
