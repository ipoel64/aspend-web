'use client';

import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';

export type PhotoImportCategory = 'dokumen' | 'rumah';

interface KpmImportPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialCategory?: PhotoImportCategory;
}

type ImportSourceType = 'drive' | 'zip';

interface PreviewItem {
  rowNum: number;
  noKK: string;
  namaPengurus: string;
  isKpmExists: boolean;
  // Rumah fields
  hasExistingAset?: boolean;
  statusRumah?: string;
  usaha?: string;
  jenisUsaha?: string;
  rLuarFilename?: string;
  rLuarDriveFileId?: string;
  rLuarFound?: boolean;
  rDalamFilename?: string;
  rDalamDriveFileId?: string;
  rDalamFound?: boolean;
  // Dokumen fields
  selfieFilename?: string;
  selfieDriveFileId?: string;
  selfieFound?: boolean;
  ktpFilename?: string;
  ktpDriveFileId?: string;
  ktpFound?: boolean;
  kkFilename?: string;
  kkDriveFileId?: string;
  kkFound?: boolean;
  butabFilename?: string;
  butabDriveFileId?: string;
  butabFound?: boolean;
  kksFilename?: string;
  kksDriveFileId?: string;
  kksFound?: boolean;
  existingSelfie?: string;
  existingKtp?: string;
  existingKk?: string;
  existingButab?: string;
  existingKks?: string;
}

interface AnalysisResult {
  category: PhotoImportCategory;
  totalOldRows: number;
  matchedKpmCount: number;
  matchedWithPhotosCount?: number;
  unmatchedKpmCount: number;
  driveFolderScanned: boolean;
  driveFilesCount: number;
  driveScanError?: string;
  // Rumah
  rLuarMatchCount?: number;
  rDalamMatchCount?: number;
  // Dokumen
  selfieMatchCount?: number;
  ktpMatchCount?: number;
  kkMatchCount?: number;
  butabMatchCount?: number;
  kksMatchCount?: number;
  totalDocMatchCount?: number;
  canDirectDriveCopy: boolean;
  previewItems: PreviewItem[];
  allMatchedItems: PreviewItem[];
}

function detectDocType(str: string): 'ktp' | 'kk' | 'butab' | 'kks' | 'selfie' | 'r_luar' | 'r_dalam' | null {
  const s = str.toLowerCase();
  if (s.includes('selfie') || s.includes('f_selfie')) return 'selfie';
  if (s.includes('ktp') || s.includes('f_ktp')) return 'ktp';
  if (s.includes('butab') || s.includes('buku_tab') || s.includes('bukutab') || s.includes('tabungan') || s.includes('f_butab')) return 'butab';
  if (s.includes('kks') || s.includes('f_kks')) return 'kks';
  if (s.includes('kk') || s.includes('f_kk')) return 'kk';
  if (s.includes('r_luar') || s.includes('luar') || s.includes('rluar')) return 'r_luar';
  if (s.includes('r_dalam') || s.includes('dalam') || s.includes('rdalam')) return 'r_dalam';
  return null;
}

function findZipKey(
  zipObj: JSZip,
  noKK: string,
  docType: string,
  preferredKey?: string,
  filename?: string
): string | null {
  if (!zipObj) return null;
  const files = zipObj.files;
  const allKeys = Object.keys(files).filter(
    (k) => !files[k].dir && !k.startsWith('__MACOSX')
  );

  // 1. Direct match on preferredKey
  if (preferredKey && files[preferredKey]) {
    return preferredKey;
  }

  // 2. Case-insensitive or normalized path match for preferredKey
  if (preferredKey) {
    const pNorm = preferredKey.replace(/\\/g, '/').toLowerCase();
    const pBase = pNorm.replace(/^.*[\/]/, '');
    const found = allKeys.find((k) => {
      const kNorm = k.replace(/\\/g, '/').toLowerCase();
      return kNorm === pNorm || kNorm.endsWith('/' + pBase) || kNorm.endsWith(pBase);
    });
    if (found) return found;
  }

  // 3. Match by filename
  if (filename) {
    const fNorm = filename.replace(/\\/g, '/').toLowerCase();
    const fBase = fNorm.replace(/^.*[\/]/, '');
    let found = allKeys.find((k) => {
      const kNorm = k.replace(/\\/g, '/').toLowerCase();
      return kNorm === fNorm || kNorm.endsWith('/' + fBase) || kNorm.endsWith(fBase);
    });
    if (found) return found;

    const parts = fBase.split(/[\._]/);
    if (parts.length >= 2) {
      const prefix = `${parts[0]}.${parts[1]}`.toLowerCase();
      found = allKeys.find((k) => k.replace(/\\/g, '/').toLowerCase().includes(prefix));
      if (found) return found;
    }
  }

  // 4. Match by clean NoKK + docType
  const cleanKK = noKK.replace(/\D/g, '');
  if (cleanKK) {
    const found = allKeys.find((k) => {
      const kNorm = k.replace(/\\/g, '/').toLowerCase();
      const kBase = kNorm.replace(/^.*[\/]/, '');
      const parts = kBase.split(/[\._]/);
      const cDigits = parts[0].replace(/\D/g, '');
      if (
        cDigits === cleanKK ||
        cDigits === '0' + cleanKK ||
        ('0' + cDigits) === cleanKK
      ) {
        return detectDocType(kBase) === docType;
      }
      return false;
    });
    if (found) return found;
  }

  return null;
}

function guessImageMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'bmp') return 'image/bmp';
  return 'image/jpeg';
}

/**
 * Compress/resize an image in the browser before uploading.
 * Vercel serverless functions reject request bodies larger than ~4.5 MB (HTTP 413),
 * so original phone photos (2–6 MB each) must be shrunk first.
 */
async function compressImage(input: Blob, name: string): Promise<Blob> {
  const typed = input.type ? input : new Blob([input], { type: guessImageMime(name) });
  if (typed.size <= 300 * 1024) return typed;

  const attempt = async (src: Blob, maxDim: number, quality: number): Promise<Blob | null> => {
    try {
      const bmp = await createImageBitmap(src);
      const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      if (typeof bmp.close === 'function') bmp.close();
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    } catch {
      return null;
    }
  };

  let out = await attempt(typed, 1600, 0.75);
  if (out && out.size > 900 * 1024) {
    out = (await attempt(typed, 1200, 0.6)) || out;
  }
  if (!out) return typed;
  return out.size < typed.size ? out : typed;
}

export default function KpmImportPhotoModal({
  isOpen,
  onClose,
  onSuccess,
  initialCategory = 'dokumen',
}: KpmImportPhotoModalProps) {
  const [category, setCategory] = useState<PhotoImportCategory>(initialCategory);
  const [sourceType, setSourceType] = useState<ImportSourceType>('zip');

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
    profileUpdated: number;
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
    keluargaUpdatedCount?: number;
    errors?: string[];
  } | null>(null);

  useEffect(() => {
    if (isOpen && initialCategory) {
      setCategory(initialCategory);
    }
  }, [isOpen, initialCategory]);

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

  const handleCategoryChange = (newCat: PhotoImportCategory) => {
    setCategory(newCat);
    handleReset();
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
      formData.append('category', category);

      if (sourceType === 'drive') {
        if (!driveFolderInput.trim()) {
          throw new Error(
            category === 'dokumen'
              ? 'Harap masukkan Link atau ID Folder Google Drive USER_Images (foto berkas & selfie).'
              : 'Harap masukkan Link atau ID Folder Google Drive RUMAH_Images (foto rumah & aset).'
          );
        }
        formData.append('oldDriveFolderId', driveFolderInput.trim());

        if (sheetInputType === 'url') {
          if (oldSheetUrl.trim()) {
            formData.append('oldSpreadsheetId', oldSheetUrl.trim());
          }
        } else {
          if (excelFile) {
            formData.append('excelFile', excelFile);
          }
        }
      } else {
        // ZIP / Direct Images
        if (!zipFile && (!multipleImages || multipleImages.length === 0)) {
          throw new Error(
            category === 'dokumen'
              ? 'Harap pilih file ZIP (misal USER_Images.zip) atau kumpulan file foto berkas KPM.'
              : 'Harap pilih file ZIP (misal RUMAH_Images.zip) atau kumpulan file foto rumah.'
          );
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
          if (oldSheetUrl.trim()) {
            formData.append('oldSpreadsheetId', oldSheetUrl.trim());
          }
        } else {
          if (excelFile) {
            formData.append('excelFile', excelFile);
          }
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
      // 1. Filter items that actually have photos or relevant data to import!
      const itemsToImport = analysisResult.allMatchedItems.filter((item) => {
        if (category === 'dokumen') {
          return (
            item.selfieFound ||
            item.ktpFound ||
            item.kkFound ||
            item.butabFound ||
            item.kksFound ||
            Boolean(item.selfieDriveFileId || item.ktpDriveFileId || item.kkDriveFileId || item.butabDriveFileId || item.kksDriveFileId)
          );
        } else {
          return (
            item.rLuarFound ||
            item.rDalamFound ||
            Boolean(item.rLuarDriveFileId || item.rDalamDriveFileId) ||
            Boolean(item.statusRumah) ||
            Boolean(item.usaha)
          );
        }
      });

      if (itemsToImport.length === 0) {
        throw new Error('Tidak ada berkas/foto yang cocok dengan data KPM terdaftar untuk diimpor.');
      }

      if (sourceType === 'drive') {
        // Direct Cloud-to-Cloud copy
        const res = await fetch('/api/kpm/import-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'commit-drive',
            category,
            oldDriveFolderId: driveFolderInput.trim(),
            mode,
            items: itemsToImport,
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
        // ZIP / File upload - Stream upload in batches of 5 KPM
        let zipObj = cachedZip;
        if (!zipObj && zipFile) {
          const zip = new JSZip();
          zipObj = await zip.loadAsync(zipFile);
          setCachedZip(zipObj);
        }

        // Keep each request well below Vercel's ~4.5 MB body limit
        const MAX_BATCH_BYTES = 3 * 1024 * 1024;
        const MAX_BATCH_FILES = 10;
        const MAX_BATCH_ITEMS = 10;

        setProgress({
          current: 0,
          total: itemsToImport.length,
          percent: 0,
          uploaded: 0,
          profileUpdated: 0,
        });

        let totalUploaded = 0;
        let totalAsetUpdated = 0;
        let totalAsetCreated = 0;
        let totalKeluargaUpdated = 0;
        let processedCount = 0;
        const batchErrors: string[] = [];

        type UploadFile = { blob: Blob; name: string };
        type UploadEntry = { item: PreviewItem; files: UploadFile[]; bytes: number };

        const updateProgress = () => {
          setProgress({
            current: processedCount,
            total: itemsToImport.length,
            percent: Math.round((processedCount / itemsToImport.length) * 100),
            uploaded: totalUploaded,
            profileUpdated: category === 'dokumen' ? totalKeluargaUpdated : totalAsetUpdated,
          });
        };

        const setItemFilename = (item: PreviewItem, type: string, name: string) => {
          if (type === 'selfie') item.selfieFilename = name;
          if (type === 'ktp') item.ktpFilename = name;
          if (type === 'kk') item.kkFilename = name;
          if (type === 'butab') item.butabFilename = name;
          if (type === 'kks') item.kksFilename = name;
          if (type === 'r_luar') item.rLuarFilename = name;
          if (type === 'r_dalam') item.rDalamFilename = name;
        };

        // Collect (and compress) all photos belonging to a single KPM
        const collectItemFiles = async (item: PreviewItem): Promise<UploadFile[]> => {
          const docConfigs =
            category === 'dokumen'
              ? [
                  { type: 'selfie', driveId: item.selfieDriveFileId, filename: item.selfieFilename },
                  { type: 'ktp', driveId: item.ktpDriveFileId, filename: item.ktpFilename },
                  { type: 'kk', driveId: item.kkDriveFileId, filename: item.kkFilename },
                  { type: 'butab', driveId: item.butabDriveFileId, filename: item.butabFilename },
                  { type: 'kks', driveId: item.kksDriveFileId, filename: item.kksFilename },
                ]
              : [
                  { type: 'r_luar', driveId: item.rLuarDriveFileId, filename: item.rLuarFilename },
                  { type: 'r_dalam', driveId: item.rDalamDriveFileId, filename: item.rDalamFilename },
                ];

          const result: UploadFile[] = [];
          for (const doc of docConfigs) {
            let rawBlob: Blob | null = null;
            let name = '';

            if (zipObj) {
              const zipKey = findZipKey(zipObj, item.noKK, doc.type, doc.driveId, doc.filename);
              if (zipKey && zipObj.files[zipKey]) {
                rawBlob = await zipObj.files[zipKey].async('blob');
                name = zipKey.replace(/^.*[\\\/]/, '') || `${item.noKK}.${doc.type.toUpperCase()}.jpg`;
              }
            } else if (multipleImages) {
              const cleanKK = item.noKK.replace(/\D/g, '');
              const targetDriveId = (doc.driveId || '').replace(/^.*[\\\/]/, '').toLowerCase();
              const targetFname = (doc.filename || '').replace(/^.*[\\\/]/, '').toLowerCase();
              for (const img of Array.from(multipleImages)) {
                const imgName = img.name.replace(/^.*[\\\/]/, '').toLowerCase();
                const isMatch =
                  (targetDriveId && (imgName === targetDriveId || imgName.endsWith(targetDriveId))) ||
                  (targetFname && (imgName === targetFname || imgName.endsWith(targetFname))) ||
                  (cleanKK && imgName.includes(cleanKK) && detectDocType(imgName) === doc.type);
                if (isMatch) {
                  rawBlob = img;
                  name = img.name;
                  break;
                }
              }
            }

            if (rawBlob && name) {
              const compressed = await compressImage(rawBlob, name);
              result.push({ blob: compressed, name });
              setItemFilename(item, doc.type, name);
            }
          }
          return result;
        };

        // Send a group of entries; on 413 split the group in half and retry
        const sendEntries = async (entries: UploadEntry[]): Promise<void> => {
          if (entries.length === 0) return;

          const fd = new FormData();
          fd.append('action', 'commit-upload');
          fd.append('category', category);
          fd.append('mode', mode);
          for (const entry of entries) {
            for (const f of entry.files) {
              fd.append('imageFiles', f.blob, f.name);
            }
          }
          fd.append('items', JSON.stringify(entries.map((e) => e.item)));

          const res = await fetch('/api/kpm/import-photos', { method: 'POST', body: fd });
          const responseText = await res.text();

          if (res.status === 413 || (!res.ok && responseText.toLowerCase().includes('too large'))) {
            if (entries.length > 1) {
              const mid = Math.ceil(entries.length / 2);
              await sendEntries(entries.slice(0, mid));
              await sendEntries(entries.slice(mid));
              return;
            }
            batchErrors.push(`Foto KK ${entries[0].item.noKK} terlalu besar untuk diunggah (413), dilewati.`);
            processedCount += 1;
            updateProgress();
            return;
          }

          let resData: any = {};
          try {
            resData = JSON.parse(responseText);
          } catch {
            throw new Error(`Server error (${res.status}): ${responseText.slice(0, 120)}`);
          }

          if (!res.ok) {
            throw new Error(resData.error || 'Gagal mengunggah foto ke ASPEND.');
          }

          if (resData.uploadedCount) totalUploaded += resData.uploadedCount;
          if (resData.asetUpdatedCount) totalAsetUpdated += resData.asetUpdatedCount;
          if (resData.asetCreatedCount) totalAsetCreated += resData.asetCreatedCount;
          if (resData.keluargaUpdatedCount) totalKeluargaUpdated += resData.keluargaUpdatedCount;
          if (resData.errors) batchErrors.push(...resData.errors);

          processedCount += entries.length;
          updateProgress();
        };

        let pending: UploadEntry[] = [];
        let pendingBytes = 0;
        let pendingFiles = 0;

        const flush = async () => {
          const toSend = pending;
          pending = [];
          pendingBytes = 0;
          pendingFiles = 0;
          await sendEntries(toSend);
        };

        for (const item of itemsToImport) {
          const files = await collectItemFiles(item);
          const bytes = files.reduce((sum, f) => sum + f.blob.size, 0);
          const hasMeta = category === 'rumah' && Boolean(item.statusRumah || item.usaha);

          if (files.length === 0 && !hasMeta) {
            processedCount += 1;
            updateProgress();
            continue;
          }

          if (
            pending.length > 0 &&
            (pendingBytes + bytes > MAX_BATCH_BYTES ||
              pendingFiles + files.length > MAX_BATCH_FILES ||
              pending.length >= MAX_BATCH_ITEMS)
          ) {
            await flush();
          }

          pending.push({ item, files, bytes });
          pendingBytes += bytes;
          pendingFiles += files.length;
        }
        await flush();

        setExecutionResult({
          success: true,
          message:
            category === 'dokumen'
              ? `Berhasil mengunggah ${totalUploaded} berkas/foto dokumen ke Google Drive ASPEND. Profil KPM diperbarui: ${totalKeluargaUpdated} keluarga.`
              : `Berhasil mengunggah ${totalUploaded} foto rumah ke Google Drive ASPEND. Data Aset diperbarui: ${totalAsetUpdated}, data Aset baru dibuat: ${totalAsetCreated}.`,
          uploadedCount: totalUploaded,
          asetUpdatedCount: totalAsetUpdated,
          asetCreatedCount: totalAsetCreated,
          keluargaUpdatedCount: totalKeluargaUpdated,
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
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-2xl text-white">
                {category === 'dokumen' ? 'badge' : 'photo_library'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {category === 'dokumen' ? 'Impor Berkas & Foto Dokumen KPM' : 'Impor Foto Rumah KPM'}
              </h2>
              <p className="text-xs text-white/80">
                {category === 'dokumen'
                  ? 'Salin & hubungkan Foto Selfie, KTP, KK, Buku Tabungan (Butab), dan KKS ke database ASPEND'
                  : 'Salin & hubungkan foto rumah tampak luar & dalam dari Google Drive lama ke profil ASPEND'}
              </p>
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
                Impor Foto & Berkas Selesai!
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                {executionResult.message}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">
                    {executionResult.copiedCount ?? executionResult.uploadedCount ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">Foto / Berkas Tersimpan</div>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 text-center">
                  <div className="text-lg font-extrabold text-teal-700">
                    {category === 'dokumen'
                      ? (executionResult.keluargaUpdatedCount ?? 0)
                      : (executionResult.asetUpdatedCount ?? 0)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">
                    {category === 'dokumen' ? 'Profil KPM Diperbarui' : 'Aset Diperbarui'}
                  </div>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 text-center col-span-2 sm:col-span-1">
                  <div className="text-lg font-extrabold text-cyan-700">
                    {category === 'dokumen' ? 'KPM_Keluarga' : (executionResult.asetCreatedCount ?? 0)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">
                    {category === 'dokumen' ? 'Tersinkronisasi Database' : 'Aset Baru Dibuat'}
                  </div>
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
              {/* Category Switcher Tabs */}
              <div className="p-1.5 rounded-2xl bg-slate-100 border border-slate-200 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCategoryChange('dokumen')}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    category === 'dokumen'
                      ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">badge</span>
                  <span>1. Berkas & Foto Dokumen KPM</span>
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Selfie, KTP, KK, Butab, KKS
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange('rumah')}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    category === 'rumah'
                      ? 'bg-white text-cyan-700 shadow-sm border border-cyan-100'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">cottage</span>
                  <span>2. Foto Rumah & Aset KPM</span>
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                    R_LUAR, R_DALAM
                  </span>
                </button>
              </div>

              {/* Source Type Switcher Tabs (Drive vs ZIP) */}
              <div className="flex rounded-2xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => { setSourceType('zip'); handleReset(); }}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sourceType === 'zip'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">folder_zip</span>
                  Unggah File ZIP / Foto dari Komputer (Rekomendasi Cepat)
                </button>
                <button
                  type="button"
                  onClick={() => { setSourceType('drive'); handleReset(); }}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sourceType === 'drive'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">cloud_sync</span>
                  Salin Langsung Antar Folder Google Drive
                </button>
              </div>

              {/* Form Input Section */}
              <form onSubmit={handleAnalyze} className="space-y-4">
                
                {/* Method 1: Google Drive */}
                {sourceType === 'drive' && (
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        1. Link atau ID Folder Google Drive Foto {category === 'dokumen' ? 'USER_Images' : 'RUMAH_Images'} *
                      </label>
                      <input
                        type="text"
                        value={driveFolderInput}
                        onChange={(e) => { setDriveFolderInput(e.target.value); handleReset(); }}
                        placeholder={
                          category === 'dokumen'
                            ? 'Contoh: https://drive.google.com/drive/folders/1abcxyz... (Folder USER_Images)'
                            : 'Contoh: https://drive.google.com/drive/folders/1abcxyz... (Folder RUMAH_Images)'
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        required
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Buka folder Google Drive foto lama &gt; salin tautan link foldernya ke sini.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">
                          2. Sumber Data Pemetaan Spreadsheet Lama ({category === 'dokumen' ? 'Tabel "USER"' : 'Tabel "RUMAH"'}) (Opsional)
                        </label>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => { setSheetInputType('url'); handleReset(); }}
                            className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                              sheetInputType === 'url' ? 'bg-emerald-700 text-white font-bold' : 'text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Link Google Sheet
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSheetInputType('file'); handleReset(); }}
                            className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                              sheetInputType === 'file' ? 'bg-emerald-700 text-white font-bold' : 'text-gray-600 hover:bg-gray-200'
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
                        />
                      ) : (
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => { setExcelFile(e.target.files?.[0] || null); handleReset(); }}
                          className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                        />
                      )}
                      <p className="text-[11px] text-gray-500 mt-1">
                        {category === 'dokumen'
                          ? 'Opsional jika nama file sudah mencakup No. KK (contoh: 1234567890123456.F_KTP.jpg).'
                          : 'Tabel yang berisi kolom NKK, PENGURUS, R_LUAR, R_DALAM.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Method 2: ZIP / Offline */}
                {sourceType === 'zip' && (
                  <div className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-100 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        1. Unggah File ZIP Foto ({category === 'dokumen' ? 'USER_Images.zip' : 'RUMAH_Images.zip'}) atau Kumpulan Foto *
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
                        💡 Cara mudah: Klik kanan folder <strong>{category === 'dokumen' ? 'USER_Images' : 'RUMAH_Images'}</strong> di Google Drive &gt; pilih <strong>Download</strong>. Google akan otomatis mengunduh sebagai file <strong>.zip</strong>.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">
                          2. Sumber Data Pemetaan Spreadsheet Lama ({category === 'dokumen' ? 'Tabel "USER"' : 'Tabel "RUMAH"'}) (Opsional)
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
                        />
                      ) : (
                        <input
                          type="text"
                          value={oldSheetUrl}
                          onChange={(e) => { setOldSheetUrl(e.target.value); handleReset(); }}
                          placeholder="Contoh: https://docs.google.com/spreadsheets/d/1aBcDeFg.../edit"
                          className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                        />
                      )}
                      <p className="text-[11px] text-gray-500 mt-1">
                        {category === 'dokumen'
                          ? 'Bisa dikosongkan jika file di dalam ZIP sudah bernama No. KK (contoh: 1234567890123456.F_KTP.jpg).'
                          : 'Tabel yang berisi kolom NKK, PENGURUS, R_LUAR, R_DALAM.'}
                      </p>
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
                        Menganalisis &amp; Mencocokkan Data...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">search_check</span>
                        Analisis &amp; Cocokkan Berkas Berdasarkan No. KK
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
                      Hasil Analisis &amp; Pencocokan Berdasarkan No. KK (NKK)
                    </h3>
                    <span className="text-xs text-gray-500">
                      Total Baris / KK: <strong>{analysisResult.totalOldRows}</strong>
                    </span>
                  </div>

                  {/* Summary Cards */}
                  {category === 'dokumen' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                        <div className="text-[11px] text-gray-500">KPM Cocok</div>
                        <div className="text-base font-extrabold text-emerald-700">
                          {analysisResult.matchedKpmCount}
                        </div>
                        <div className="text-[9px] text-emerald-600">No. KK di ASPEND</div>
                      </div>

                      <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100">
                        <div className="text-[11px] text-gray-500">Foto Selfie</div>
                        <div className="text-base font-extrabold text-purple-700">
                          {analysisResult.selfieMatchCount || 0}
                        </div>
                        <div className="text-[9px] text-purple-600">F_SELFIE</div>
                      </div>

                      <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100">
                        <div className="text-[11px] text-gray-500">Foto KTP</div>
                        <div className="text-base font-extrabold text-blue-700">
                          {analysisResult.ktpMatchCount || 0}
                        </div>
                        <div className="text-[9px] text-blue-600">F_KTP</div>
                      </div>

                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                        <div className="text-[11px] text-gray-500">Foto KK</div>
                        <div className="text-base font-extrabold text-amber-700">
                          {analysisResult.kkMatchCount || 0}
                        </div>
                        <div className="text-[9px] text-amber-600">F_KK</div>
                      </div>

                      <div className="p-3 rounded-2xl bg-teal-50 border border-teal-100">
                        <div className="text-[11px] text-gray-500">Buku Tabungan</div>
                        <div className="text-base font-extrabold text-teal-700">
                          {analysisResult.butabMatchCount || 0}
                        </div>
                        <div className="text-[9px] text-teal-600">F_BUTAB</div>
                      </div>

                      <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100">
                        <div className="text-[11px] text-gray-500">Foto KKS</div>
                        <div className="text-base font-extrabold text-rose-700">
                          {analysisResult.kksMatchCount || 0}
                        </div>
                        <div className="text-[9px] text-rose-600">F_KKS</div>
                      </div>
                    </div>
                  ) : (
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
                          {analysisResult.rLuarMatchCount || 0}
                        </div>
                        <div className="text-[10px] text-cyan-600">Tampak Luar</div>
                      </div>

                      <div className="p-3 rounded-2xl bg-teal-50 border border-teal-100">
                        <div className="text-xs text-gray-500">Foto R_DALAM Cocok</div>
                        <div className="text-lg font-extrabold text-teal-700">
                          {analysisResult.rDalamMatchCount || 0}
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
                  )}

                  {/* Drive scanning warning callout */}
                  {sourceType === 'drive' && analysisResult.driveFilesCount === 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-950 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                        <span className="material-symbols-outlined text-base text-amber-600">verified</span>
                        <span>No. KK Berhasil Dicocokkan ({analysisResult.matchedKpmCount} KPM Terdaftar di ASPEND Cocok)!</span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Data No. KK (NKK) Anda <strong>100% cocok dengan {analysisResult.matchedKpmCount} KPM</strong> di database ASPEND. Namun, isi folder Google Drive terbaca <strong>0 file</strong> karena Google membatasi akses listing file lintas akun.
                      </p>
                      <div className="p-3 bg-white/80 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                        <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                          <span className="material-symbols-outlined text-sm text-emerald-600">lightbulb</span>
                          Solusi Cepat &amp; Pasti Berhasil:
                        </div>
                        <ol className="list-decimal pl-4 space-y-1 text-[11px] text-gray-700">
                          <li>Buka folder <strong>{category === 'dokumen' ? 'USER_Images' : 'RUMAH_Images'}</strong> di Google Drive Anda.</li>
                          <li>Klik panah di samping nama folder &gt; pilih <strong>Download</strong> (Google Drive akan mengunduh file <strong>.zip</strong>).</li>
                          <li>Beralih ke tab <strong>"Unggah File ZIP / Foto dari Komputer"</strong> di atas, masukkan file ZIP tersebut.</li>
                          <li>Klik tombol <strong>Analisis</strong>, maka seluruh foto berkas dokumen akan langsung cocok 100%!</li>
                        </ol>
                      </div>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-600 sticky top-0">
                          {category === 'dokumen' ? (
                            <tr>
                              <th className="py-2 px-3">No. KK</th>
                              <th className="py-2 px-3">Nama Pengurus</th>
                              <th className="py-2 px-3">Status KPM</th>
                              <th className="py-2 px-2 text-center">Selfie</th>
                              <th className="py-2 px-2 text-center">KTP</th>
                              <th className="py-2 px-2 text-center">KK</th>
                              <th className="py-2 px-2 text-center">Butab</th>
                              <th className="py-2 px-2 text-center">KKS</th>
                            </tr>
                          ) : (
                            <tr>
                              <th className="py-2 px-3">No. KK</th>
                              <th className="py-2 px-3">Nama Pengurus</th>
                              <th className="py-2 px-3">Status KPM</th>
                              <th className="py-2 px-3">Foto Luar</th>
                              <th className="py-2 px-3">Foto Dalam</th>
                            </tr>
                          )}
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

                              {category === 'dokumen' ? (
                                <>
                                  <td className="py-2 px-2 text-center">
                                    {item.selfieFound || (sourceType === 'zip' && item.selfieFilename) ? (
                                      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">Ada</span>
                                    ) : item.selfieFilename ? (
                                      <span className="text-[10px] text-gray-400">Siap</span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {item.ktpFound || (sourceType === 'zip' && item.ktpFilename) ? (
                                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">Ada</span>
                                    ) : item.ktpFilename ? (
                                      <span className="text-[10px] text-gray-400">Siap</span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {item.kkFound || (sourceType === 'zip' && item.kkFilename) ? (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">Ada</span>
                                    ) : item.kkFilename ? (
                                      <span className="text-[10px] text-gray-400">Siap</span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {item.butabFound || (sourceType === 'zip' && item.butabFilename) ? (
                                      <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 text-[10px] font-bold">Ada</span>
                                    ) : item.butabFilename ? (
                                      <span className="text-[10px] text-gray-400">Siap</span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {item.kksFound || (sourceType === 'zip' && item.kksFilename) ? (
                                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">Ada</span>
                                    ) : item.kksFilename ? (
                                      <span className="text-[10px] text-gray-400">Siap</span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                </>
                              ) : (
                                <>
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
                                </>
                              )}
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
                        <div className="text-[11px] text-gray-500">Tentukan apakah berkas/foto lama di ASPEND akan ditimpa atau dilewati.</div>
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
                          <span>Timpa Berkas</span>
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

                    {/* Live Progress Bar */}
                    {progress && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm animate-spin text-emerald-600">sync</span>
                            Sedang Menyimpan Berkas Foto KPM ke Google Drive ASPEND...
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
                          <span>Foto berhasil diunggah: <strong>{progress.uploaded} berkas</strong></span>
                          <span>Profil KPM diperbarui: <strong>{progress.profileUpdated} keluarga</strong></span>
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
                        disabled={
                          isExecuting ||
                          analysisResult.matchedKpmCount === 0 ||
                          (category === 'dokumen' && (analysisResult.totalDocMatchCount || 0) === 0)
                        }
                        className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isExecuting ? (
                          <>
                            <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                            {progress ? `Memproses ${progress.current}/${progress.total} KPM...` : 'Sedang Menyalin & Mengunggah Foto ke Drive...'}
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">cloud_upload</span>
                            Mulai Impor {category === 'dokumen'
                              ? `${analysisResult.totalDocMatchCount || 0} Berkas (${analysisResult.matchedWithPhotosCount || analysisResult.matchedKpmCount} KPM)`
                              : `${analysisResult.matchedWithPhotosCount || analysisResult.matchedKpmCount} KPM Foto Rumah`}
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
