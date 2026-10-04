'use client';

import React, { useState, useMemo } from 'react';
import { KpmKeluarga } from '@/lib/kpm-constants';
import { getUniqueModulP2K2, getSesiByModul } from '@/lib/master-rhk';
import {
  downloadKpmAbsensiPdf,
  formatTanggalIndonesiaLengkap,
  formatTanggalTtd,
} from '@/lib/kpm-absensi-pdf';

interface KpmAbsensiModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataList: KpmKeluarga[];
}

export default function KpmAbsensiModal({
  isOpen,
  onClose,
  dataList,
}: KpmAbsensiModalProps) {
  // Filters
  const [selectedKelompok, setSelectedKelompok] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'aktif' | 'non-aktif' | 'semua'>('aktif');

  // Master Modul & Sesi P2K2 (Sinkron dengan RHK-2)
  const modulOptions = useMemo(() => getUniqueModulP2K2(), []);
  const [modulP2K2, setModulP2K2] = useState<string>(() => {
    const list = getUniqueModulP2K2();
    return list.length > 0 ? list[0] : '';
  });

  const sesiOptions = useMemo(() => getSesiByModul(modulP2K2), [modulP2K2]);
  const [sesiP2K2, setSesiP2K2] = useState<string>(() => {
    const list = getUniqueModulP2K2();
    const sesis = list.length > 0 ? getSesiByModul(list[0]) : [];
    return sesis.length > 0 ? sesis[0] : '';
  });

  // Waktu & Identitas
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [lokasi, setLokasi] = useState('Rumah Ketua Kelompok');
  const [namaPendamping, setNamaPendamping] = useState('SYAIFUL KHOLIFAH');
  const [nipPendamping, setNipPendamping] = useState('1275012710******');
  const [isDownloading, setIsDownloading] = useState(false);

  // List of kelompok
  const kelompokOptions = useMemo(() => {
    const set = new Set<string>();
    for (const k of dataList) {
      if (k.Kelompok?.trim()) set.add(k.Kelompok.trim());
    }
    return Array.from(set).sort();
  }, [dataList]);

  // Set initial selected kelompok if available
  React.useEffect(() => {
    if (!selectedKelompok && kelompokOptions.length > 0) {
      setSelectedKelompok(kelompokOptions[0]);
    }
  }, [kelompokOptions, selectedKelompok]);

  // Filtered members for attendance
  const filteredList = useMemo(() => {
    return dataList
      .filter((kpm) => {
        // Kelompok filter
        if (selectedKelompok && kpm.Kelompok !== selectedKelompok) return false;

        // Status filter
        const isGraduasiOrInactive =
          kpm.StatusKepesertaan === 'Graduasi' ||
          kpm.StatusKepesertaan === 'Tidak Aktif' ||
          kpm.StatusGraduasi === 'Sudah Graduasi' ||
          kpm.StatusGraduasi === 'Graduasi Mandiri' ||
          kpm.StatusGraduasi === 'Graduasi Alami' ||
          kpm.CatatanTemuan?.includes('Sudah Graduasi');

        if (filterStatus === 'aktif' && isGraduasiOrInactive) return false;
        if (filterStatus === 'non-aktif' && !isGraduasiOrInactive) return false;

        return true;
      })
      .sort((a, b) => {
        // Ketua Kelompok first
        if (a.StatusKelompok === 'Ketua Kelompok' && b.StatusKelompok !== 'Ketua Kelompok') return -1;
        if (a.StatusKelompok !== 'Ketua Kelompok' && b.StatusKelompok === 'Ketua Kelompok') return 1;
        return (a.NamaPengurus || '').localeCompare(b.NamaPengurus || '');
      });
  }, [dataList, selectedKelompok, filterStatus]);

  // First KPM for location metadata
  const sampleKpm = filteredList[0] || dataList[0];

  const handleDownloadPdf = () => {
    try {
      setIsDownloading(true);
      downloadKpmAbsensiPdf({
        kelompok: selectedKelompok,
        filterStatus,
        modulP2K2,
        sesiP2K2,
        tanggal,
        lokasi,
        namaPendamping,
        nipPendamping,
        kpmList: filteredList,
      });
    } catch (err) {
      console.error('Error downloading absensi PDF:', err);
      alert('Terjadi kesalahan saat membuat file PDF. Silakan coba kembali.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  const formattedIndonesianDate = formatTanggalIndonesiaLengkap(tanggal);
  const formattedTtdDate = formatTanggalTtd(tanggal);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:rounded-none">
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-cyan-400 text-2xl">picture_as_pdf</span>
            <div>
              <h3 className="font-bold text-sm font-['Outfit'] flex items-center gap-2">
                <span>Cetak & Download Lembar Absensi P2K2 (FDS)</span>
                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2 py-0.5 rounded text-[10px]">
                  Format Resmi Kemensos RI
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Lengkap dengan logo Kemensos, logo PKH, rekapitulasi kehadiran, modul & sesi standar RHK
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {/* Tombol Download PDF (Aksi Utama Sesuai Permintaan User) */}
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading || filteredList.length === 0}
              className="px-3.5 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Download File PDF Langsung"
            >
              <span className="material-symbols-outlined text-[17px]">
                {isDownloading ? 'hourglass_empty' : 'download'}
              </span>
              <span>{isDownloading ? 'Memproses PDF...' : 'Download PDF Absensi'}</span>
            </button>

            {/* Tombol Cetak Browser */}
            <button
              onClick={() => window.print()}
              disabled={filteredList.length === 0}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              title="Pratinjau / Cetak Melalui Browser"
            >
              <span className="material-symbols-outlined text-[17px]">print</span>
              <span>Cetak Browser</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer text-white"
              title="Tutup"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Filter & Customizer (Hidden on Print) */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs shrink-0 print:hidden">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Pilih Kelompok:</label>
            <select
              value={selectedKelompok}
              onChange={(e) => setSelectedKelompok(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
            >
              <option value="">Semua Kelompok</option>
              {kelompokOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Status Kepesertaan KPM:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-cyan-800 outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
            >
              <option value="aktif">🟢 Hanya KPM Aktif</option>
              <option value="non-aktif">⚪ Hanya KPM Non-Aktif / Graduasi</option>
              <option value="semua">🔵 Gabungan (Semua KPM)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Tanggal Pertemuan:</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Lokasi Pertemuan:</label>
            <input
              type="text"
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
              placeholder="Contoh: Rumah Ketua Kelompok"
            />
          </div>

          {/* Modul P2K2 Dropdown (Sesuai Database RHK-2) */}
          <div className="lg:col-span-2">
            <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
              <span>Nama Modul P2K2:</span>
              <span className="text-[10px] text-cyan-700 font-semibold bg-cyan-50 px-1.5 py-0.5 rounded">
                Master Database P2K2
              </span>
            </label>
            <select
              value={modulP2K2}
              onChange={(e) => {
                const newModul = e.target.value;
                setModulP2K2(newModul);
                const sesis = getSesiByModul(newModul);
                setSesiP2K2(sesis.length > 0 ? sesis[0] : '');
              }}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-medium"
            >
              {modulOptions.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>

          {/* Sesi Modul Dropdown (Sesuai Modul Pilihan) */}
          <div className="lg:col-span-2">
            <label className="font-bold text-slate-700 block mb-1">Sesi Modul P2K2:</label>
            <select
              value={sesiP2K2}
              onChange={(e) => setSesiP2K2(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-medium"
            >
              {sesiOptions.map((ses) => (
                <option key={ses} value={ses}>
                  {ses}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Printable Paper Area (A4 layout) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white print:p-0 print:overflow-visible text-slate-900 font-sans">
          
          {/* Header Kop Surat Resmi (Logo Kemensos di Kiri & Logo PKH di Kanan) */}
          <div className="relative border-b-2 border-black pb-3 mb-4">
            <div className="flex items-center justify-between gap-4">
              {/* Logo Kemensos (Kiri) */}
              <div className="w-20 shrink-0 flex items-center justify-center">
                <img
                  src="/logo_kemensos.png"
                  alt="Kementerian Sosial RI"
                  className="w-18 h-18 object-contain"
                />
              </div>

              {/* Teks Kop Tengah */}
              <div className="text-center flex-1">
                <h4 className="font-bold text-xs sm:text-sm tracking-wider uppercase leading-tight text-slate-900">
                  KEMENTERIAN SOSIAL REPUBLIK INDONESIA
                </h4>
                <h3 className="font-extrabold text-xs sm:text-sm tracking-wide uppercase mt-0.5 text-slate-900">
                  DIREKTORAT JAMINAN SOSIAL KELUARGA
                </h3>
                <h3 className="font-extrabold text-xs sm:text-sm tracking-wide uppercase text-slate-900">
                  PROGRAM KELUARGA HARAPAN (PKH)
                </h3>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Sekretariat: Jl. Salemba Raya No. 28, Jakarta Pusat 10430 Telp. (021) 3103591 http://www.kemsos.go.id
                </p>
              </div>

              {/* Logo PKH (Kanan) */}
              <div className="w-22 shrink-0 flex items-center justify-center">
                <img
                  src="/logo_pkh.png"
                  alt="Program Keluarga Harapan"
                  className="w-20 h-16 object-contain"
                />
              </div>
            </div>

            {/* Garis Ganda Pemisah Kop Surat */}
            <div className="border-b border-black mt-2 pt-0.5"></div>
          </div>

          {/* Judul Dokumen */}
          <div className="text-center mb-4">
            <h2 className="font-black text-xs sm:text-sm uppercase tracking-wider text-slate-900 underline">
              DAFTAR HADIR PERTEMUAN PENINGKATAN KEMAMPUAN KELUARGA (P2K2 / FDS)
            </h2>
            <p className="text-[10.5px] font-bold text-slate-700 mt-1 uppercase">
              STATUS KEPESERTAAN:{' '}
              {filterStatus === 'aktif'
                ? 'KPM AKTIF (PESERTA BERJALAN)'
                : filterStatus === 'non-aktif'
                ? 'KPM TIDAK AKTIF / SUDAH GRADUASI'
                : 'SELURUH KPM (GABUNGAN)'}
            </p>
          </div>

          {/* Metadata Kegiatan (2 Kolom) */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs mb-3">
            <div className="flex">
              <span className="w-36 font-semibold shrink-0">Nama Kelompok PKH</span>
              <span>: <strong>{selectedKelompok || 'Semua Kelompok'}</strong></span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold shrink-0">Hari / Tanggal</span>
              <span>: <strong>{formattedIndonesianDate}</strong></span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold shrink-0">Kelurahan / Desa</span>
              <span>: {sampleKpm?.Kelurahan || 'Kartini'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold shrink-0">Tempat / Lokasi</span>
              <span>: {lokasi}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold shrink-0">Kecamatan / Kota</span>
              <span>: {[sampleKpm?.Kecamatan, sampleKpm?.KabKota].filter(Boolean).join(', ') || 'Binjai Kota'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold shrink-0">Nama Pendamping</span>
              <span>: <strong>{namaPendamping}</strong></span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold shrink-0">Modul P2K2</span>
              <span>: <strong>{modulP2K2}</strong></span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold shrink-0">NIP / No. Registrasi</span>
              <span>: {nipPendamping || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold shrink-0">Sesi Pertemuan</span>
              <span>: {sesiP2K2}</span>
            </div>
          </div>

          {/* Kotak Rekapitulasi: Jumlah Peserta Pertemuan & Kehadiran (Sesuai Permintaan User) */}
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-2.5 mb-4 text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <span className="text-slate-700 font-semibold">Jumlah Peserta Pertemuan : </span>
                <strong className="text-cyan-800 text-sm font-bold">{filteredList.length} Orang</strong>
              </div>
              <div className="text-slate-800">
                <span className="text-slate-700 font-semibold">Kehadiran : </span>
                <span className="font-medium">
                  Total: <strong>{filteredList.length}</strong> Orang &nbsp;|&nbsp; Hadir: <strong>......</strong> Orang &nbsp;|&nbsp; Sakit: <strong>......</strong> Orang &nbsp;|&nbsp; Alpa: <strong>......</strong> Orang
                </span>
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-slate-100 font-bold text-center border-b border-black">
                <th className="border border-black py-2 px-1 w-8" rowSpan={2}>NO</th>
                <th className="border border-black py-2 px-2 text-left" rowSpan={2}>NAMA LENGKAP PENGURUS</th>
                <th className="border border-black py-2 px-2 text-center w-36" rowSpan={2}>NIK / NO. KK</th>
                <th className="border border-black py-2 px-2 text-left" rowSpan={2}>ALAMAT / LINGKUNGAN</th>
                <th className="border border-black py-2 px-2 text-center w-20" rowSpan={2}>STATUS</th>
                <th className="border border-black py-1.5 px-2 text-center" colSpan={2}>
                  TANDA TANGAN / CAP JEMPOL
                </th>
              </tr>
              <tr className="bg-slate-100 font-bold text-center border-b border-black text-[10px]">
                <th className="border border-black py-1 px-1 w-20">GANJIL</th>
                <th className="border border-black py-1 px-1 w-20">GENAP</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((kpm, idx) => {
                const no = idx + 1;
                const isOdd = no % 2 !== 0;
                const isGrad =
                  kpm.StatusKepesertaan === 'Graduasi' ||
                  kpm.StatusKepesertaan === 'Tidak Aktif' ||
                  kpm.StatusGraduasi === 'Sudah Graduasi' ||
                  kpm.StatusGraduasi === 'Graduasi Mandiri' ||
                  kpm.StatusGraduasi === 'Graduasi Alami' ||
                  kpm.CatatanTemuan?.includes('Sudah Graduasi');

                return (
                  <tr key={kpm.KpmId || idx} className="border-b border-black">
                    <td className="border border-black py-2.5 text-center font-bold">{no}</td>
                    <td className="border border-black py-2.5 px-2 font-bold">
                      {kpm.NamaPengurus}
                      {kpm.StatusKelompok === 'Ketua Kelompok' && (
                        <span className="ml-1.5 text-[9.5px] uppercase font-bold text-slate-700 block sm:inline">
                          (Ketua Kelompok)
                        </span>
                      )}
                    </td>
                    <td className="border border-black py-2.5 px-2 text-center font-mono text-[11px]">
                      <div>{kpm.NIK}</div>
                      <div className="text-[10px] text-slate-600">KK: {kpm.NoKK}</div>
                    </td>
                    <td className="border border-black py-2.5 px-2 text-[11px]">
                      {kpm.Alamat || ''} {kpm.Lingkungan ? `(${kpm.Lingkungan})` : ''}
                    </td>
                    <td className="border border-black py-2.5 px-1 text-center font-bold text-[10px]">
                      {isGrad ? 'GRADUASI' : 'AKTIF'}
                    </td>
                    {/* Staggered Signature Boxes */}
                    <td className="border-t border-b border-l border-black py-2.5 px-1.5 w-20 text-left font-bold text-[11px] align-top h-10">
                      {isOdd ? `${no}. .................` : ''}
                    </td>
                    <td className="border-t border-b border-r border-black py-2.5 px-1.5 w-20 text-left font-bold text-[11px] align-top h-10">
                      {!isOdd ? `${no}. .................` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer Pengesahan */}
          <div className="mt-8 grid grid-cols-2 text-xs pt-4 page-break-inside-avoid">
            <div className="text-center">
              <p>Mengetahui,</p>
              <p className="font-bold">Ketua Kelompok PKH</p>
              <div className="h-16"></div>
              <p className="font-bold underline uppercase">
                {filteredList.find((k) => k.StatusKelompok === 'Ketua Kelompok')?.NamaPengurus ||
                  '( ................................................ )'}
              </p>
            </div>

            <div className="text-center">
              <p>{sampleKpm?.KabKota || 'Kota Binjai'}, {formattedTtdDate}</p>
              <p className="font-bold">Pendamping Sosial PKH</p>
              <div className="h-16"></div>
              <p className="font-bold underline uppercase">{namaPendamping}</p>
              <p className="font-mono text-[11px]">NIP/Reg: {nipPendamping}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
