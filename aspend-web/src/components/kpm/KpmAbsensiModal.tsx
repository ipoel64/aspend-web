'use client';

import React, { useState, useMemo } from 'react';
import { KpmKeluarga } from '@/lib/kpm-constants';

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
  const [selectedTahap, setSelectedTahap] = useState<string>('');

  // Form Details
  const [modulP2K2, setModulP2K2] = useState('Modul Pengelolaan Keuangan dan Perencanaan Usaha');
  const [sesiP2K2, setSesiP2K2] = useState('Sesi 1: Mengelola Keuangan Keluarga');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [lokasi, setLokasi] = useState('Rumah Ketua Kelompok');
  const [namaPendamping, setNamaPendamping] = useState('SYAIFUL KHOLIFAH');
  const [nipPendamping, setNipPendamping] = useState('1275012710******');

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
    return dataList.filter((kpm) => {
      // Kelompok filter
      if (selectedKelompok && kpm.Kelompok !== selectedKelompok) return false;

      // Status filter
      const isGraduasiOrInactive =
        kpm.StatusKepesertaan === 'Graduasi' ||
        kpm.StatusKepesertaan === 'Tidak Aktif' ||
        kpm.CatatanTemuan?.includes('Sudah Graduasi');

      if (filterStatus === 'aktif' && isGraduasiOrInactive) return false;
      if (filterStatus === 'non-aktif' && !isGraduasiOrInactive) return false;

      // Tahap filter
      if (selectedTahap && !kpm.TahapBansos?.includes(selectedTahap)) return false;

      return true;
    }).sort((a, b) => {
      // Ketua Kelompok first
      if (a.StatusKelompok === 'Ketua Kelompok' && b.StatusKelompok !== 'Ketua Kelompok') return -1;
      if (a.StatusKelompok !== 'Ketua Kelompok' && b.StatusKelompok === 'Ketua Kelompok') return 1;
      return (a.NamaPengurus || '').localeCompare(b.NamaPengurus || '');
    });
  }, [dataList, selectedKelompok, filterStatus, selectedTahap]);

  // First KPM for location metadata
  const sampleKpm = filteredList[0] || dataList[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:rounded-none">
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-cyan-400 text-2xl">print</span>
            <div>
              <h3 className="font-bold text-sm font-['Outfit']">
                Cetak Lembar Absensi Pertemuan P2K2 (FDS) PKH
              </h3>
              <p className="text-[11px] text-slate-300">
                Format resmi absensi Kemensos RI (Aktif / Non-Aktif / Graduasi terpisah)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Cetak Sekarang</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer text-white"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Filter & Customizer (Hidden on Print) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs shrink-0 print:hidden">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Pilih Kelompok:</label>
            <select
              value={selectedKelompok}
              onChange={(e) => setSelectedKelompok(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none"
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
              className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-cyan-800 outline-none"
            >
              <option value="aktif">🟢 Hanya KPM Aktif</option>
              <option value="non-aktif">⚪ Hanya KPM Non-Aktif / Graduasi</option>
              <option value="semua">🔵 Gabungan (Semua KPM)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Filter Tahap Bansos:</label>
            <select
              value={selectedTahap}
              onChange={(e) => setSelectedTahap(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none"
            >
              <option value="">Semua Tahap</option>
              <option value="Tahap 1">Tahap 1</option>
              <option value="Tahap 2">Tahap 2</option>
              <option value="Tahap 3">Tahap 3</option>
              <option value="Tahap 4">Tahap 4</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Tanggal Pertemuan:</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 block mb-1">Nama Modul P2K2:</label>
            <input
              type="text"
              value={modulP2K2}
              onChange={(e) => setModulP2K2(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none"
              placeholder="Contoh: Modul Pengelolaan Keuangan dan Perencanaan Usaha"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Sesi Modul:</label>
            <input
              type="text"
              value={sesiP2K2}
              onChange={(e) => setSesiP2K2(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none"
              placeholder="Contoh: Sesi 1: Mengelola Keuangan"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Lokasi Pertemuan:</label>
            <input
              type="text"
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none"
              placeholder="Contoh: Rumah Ketua Kelompok"
            />
          </div>
        </div>

        {/* Printable Paper Area (A4 layout) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white print:p-0 print:overflow-visible text-slate-900 font-sans">
          {/* Header Surat Resmi */}
          <div className="text-center border-b-2 border-black pb-3 mb-4">
            <h4 className="font-bold text-sm tracking-wider uppercase">
              KEMENTERIAN SOSIAL REPUBLIK INDONESIA
            </h4>
            <h3 className="font-extrabold text-base tracking-wide uppercase mt-0.5">
              DIREKTORAT JAMINAN SOSIAL KELUARGA — PROGRAM KELUARGA HARAPAN (PKH)
            </h3>
            <h2 className="font-black text-sm uppercase tracking-wider mt-1 text-slate-900 underline">
              DAFTAR HADIR PERTEMUAN PENINGKATAN KEMAMPUAN KELUARGA (P2K2 / FDS)
            </h2>
            <p className="text-[11px] font-bold text-slate-700 mt-0.5">
              STATUS KEPESERTAAN:{' '}
              {filterStatus === 'aktif'
                ? 'KPM AKTIF (PESERTA BERJALAN)'
                : filterStatus === 'non-aktif'
                ? 'KPM TIDAK AKTIF / SUDAH GRADUASI'
                : 'SELURUH KPM (GABUNGAN)'}
            </p>
          </div>

          {/* Metadata Kegiatan */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs mb-4">
            <div className="flex">
              <span className="w-36 font-semibold">Nama Kelompok PKH</span>
              <span>: <strong>{selectedKelompok || 'Semua Kelompok'}</strong></span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold">Hari / Tanggal</span>
              <span>: {tanggal}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold">Kelurahan / Desa</span>
              <span>: {sampleKpm?.Kelurahan || 'Kartini'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold">Modul P2K2</span>
              <span>: {modulP2K2}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold">Kecamatan / Kota</span>
              <span>: {sampleKpm?.Kecamatan || 'Binjai Kota'}, {sampleKpm?.KabKota || 'Kota Binjai'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold">Sesi Pertemuan</span>
              <span>: {sesiP2K2}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold">Nama Pendamping</span>
              <span>: <strong>{namaPendamping}</strong></span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold">Tempat / Lokasi</span>
              <span>: {lokasi}</span>
            </div>
          </div>

          {/* Attendance Table */}
          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-slate-100 font-bold text-center border-b border-black">
                <th className="border border-black py-2 px-1 w-8">NO</th>
                <th className="border border-black py-2 px-2 text-left">NAMA LENGKAP PENGURUS</th>
                <th className="border border-black py-2 px-2 text-center w-36">NIK / NO. KK</th>
                <th className="border border-black py-2 px-2 text-left">ALAMAT / LINGKUNGAN</th>
                <th className="border border-black py-2 px-2 text-center w-24">STATUS KEPESERTAAN</th>
                <th className="border border-black py-2 px-2 text-center w-40" colSpan={2}>
                  TANDA TANGAN / CAP JEMPOL
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((kpm, idx) => {
                const no = idx + 1;
                const isOdd = no % 2 !== 0;
                const isGrad =
                  kpm.StatusKepesertaan === 'Graduasi' ||
                  kpm.StatusKepesertaan === 'Tidak Aktif' ||
                  kpm.CatatanTemuan?.includes('Sudah Graduasi');

                return (
                  <tr key={kpm.KpmId || idx} className="border-b border-black">
                    <td className="border border-black py-2.5 text-center font-bold">{no}</td>
                    <td className="border border-black py-2.5 px-2 font-bold">
                      {kpm.NamaPengurus}
                      {kpm.StatusKelompok === 'Ketua Kelompok' && (
                        <span className="ml-1.5 text-[10px] uppercase font-bold text-slate-700">
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
                    <td className="border-t border-b border-l border-black py-2.5 px-1 w-20 text-left font-bold text-[11px] align-top h-10">
                      {isOdd ? `${no}. .................` : ''}
                    </td>
                    <td className="border-t border-b border-r border-black py-2.5 px-1 w-20 text-left font-bold text-[11px] align-top h-10">
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
              <p>{sampleKpm?.KabKota || 'Kota Binjai'}, {tanggal}</p>
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
