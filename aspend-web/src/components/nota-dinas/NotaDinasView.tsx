'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  NotaDinasItem,
  SIFAT_NOTA_DINAS_OPTIONS,
  generateNotaDinasId,
} from '@/lib/nota-dinas-constants';
import {
  downloadNotaDinasPdf,
  NotaDinasUserProfile,
} from '@/lib/nota-dinas-pdf';

interface NotaDinasViewProps {
  profile?: {
    nama?: string;
    nip?: string;
    jabatan?: string;
    provinsi?: string;
    kabupaten?: string;
    kecamatan?: string;
  } | null;
}

export default function NotaDinasView({ profile }: NotaDinasViewProps) {
  const [items, setItems] = useState<NotaDinasItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NotaDinasItem | null>(null);
  const [editItem, setEditItem] = useState<NotaDinasItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<NotaDinasItem | null>(null);

  // Form States for Create
  const [nomor, setNomor] = useState('');
  const [yth, setYth] = useState('');
  const [dari, setDari] = useState('');
  const [hal, setHal] = useState('');
  const [sifat, setSifat] = useState('Biasa');
  const [lampiran, setLampiran] = useState('-');
  const [tanggal, setTanggal] = useState('');
  const [poinDraft, setPoinDraft] = useState('');
  const [isiNotaDinas, setIsiNotaDinas] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoBase64List, setPhotoBase64List] = useState<string[]>([]);

  // Initialize form defaults based on profile
  useEffect(() => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    setTanggal(formattedDate);
    if (profile?.jabatan) {
      setDari(profile.jabatan);
    } else {
      setDari('Pendamping Sosial PKH');
    }
  }, [profile]);

  // Fetch Nota Dinas
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/nota-dinas');
      const data = await res.json();
      if (data.success && Array.isArray(data.list)) {
        setItems(data.list);
      }
    } catch (err) {
      console.error('Gagal memuat Nota Dinas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered List based on Search Query
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.nomor.toLowerCase().includes(q) ||
        item.hal.toLowerCase().includes(q) ||
        item.yth.toLowerCase().includes(q) ||
        item.dari.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Handle AI Narrative Generation
  const handleGenerateAi = async () => {
    if (!poinDraft.trim()) {
      alert('Silakan tuliskan poin-poin draft kegiatan terlebih dahulu.');
      return;
    }

    try {
      setIsGeneratingAi(true);
      const res = await fetch('/api/nota-dinas/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yth: yth.trim(),
          dari: dari.trim(),
          hal: hal.trim(),
          tanggal: tanggal.trim(),
          poinDraft: poinDraft.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.text) {
        setIsiNotaDinas(data.text);
      } else {
        alert(data.error || 'Gagal menyusun narasi dengan AI.');
      }
    } catch (err) {
      console.error('Error generate AI:', err);
      alert('Terjadi kesalahan koneksi saat memanggil AI.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoBase64List((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotoBase64List((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Create Form
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomor.trim()) {
      alert('Nomor surat wajib diisi.');
      return;
    }
    if (!yth.trim()) {
      alert('Penerima (Kepada Yth.) wajib diisi.');
      return;
    }
    if (!hal.trim()) {
      alert('Perihal (Hal) wajib diisi.');
      return;
    }
    if (!isiNotaDinas.trim()) {
      alert('Isi nota dinas wajib diisi. Anda dapat klik "Susun Narasi dengan AI" atau mengetik manual.');
      return;
    }

    try {
      setIsSubmitting(true);
      const id = generateNotaDinasId();
      const payload: Partial<NotaDinasItem> = {
        id,
        nomor: nomor.trim(),
        yth: yth.trim(),
        dari: dari.trim() || 'Pendamping Sosial PKH',
        hal: hal.trim(),
        sifat,
        lampiran: lampiran.trim() || '-',
        tanggal: tanggal.trim(),
        poinDraft: poinDraft.trim(),
        isiNotaDinas: isiNotaDinas.trim(),
      };

      const res = await fetch('/api/nota-dinas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.item) {
        setItems((prev) => [data.item, ...prev]);
        setIsCreateModalOpen(false);

        // Reset form
        setNomor('');
        setYth('');
        setHal('');
        setPoinDraft('');
        setIsiNotaDinas('');
        setPhotoBase64List([]);

        // Download PDF automatically
        const userProf: NotaDinasUserProfile = {
          nama: profile?.nama || 'SYAIFUL KHOLIFAH',
          nip: profile?.nip || '',
          jabatan: profile?.jabatan || data.item.dari,
        };
        downloadNotaDinasPdf(data.item, userProf, photoBase64List);
      } else {
        alert(data.error || 'Gagal menyimpan Nota Dinas ke database.');
      }
    } catch (err) {
      console.error('Error save nota dinas:', err);
      alert('Terjadi kesalahan saat menyimpan Nota Dinas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/nota-dinas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editItem),
      });

      const data = await res.json();
      if (data.success && data.item) {
        setItems((prev) => prev.map((it) => (it.id === data.item.id ? data.item : it)));
        if (selectedItem?.id === data.item.id) {
          setSelectedItem(data.item);
        }
        setEditItem(null);
      } else {
        alert(data.error || 'Gagal memperbarui Nota Dinas.');
      }
    } catch (err) {
      console.error('Error update nota dinas:', err);
      alert('Terjadi kesalahan saat memperbarui Nota Dinas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (item: NotaDinasItem) => {
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/nota-dinas?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.filter((it) => it.id !== item.id));
        if (selectedItem?.id === item.id) setSelectedItem(null);
        setDeleteConfirmItem(null);
      } else {
        alert(data.error || 'Gagal menghapus Nota Dinas.');
      }
    } catch (err) {
      console.error('Error delete nota dinas:', err);
      alert('Terjadi kesalahan saat menghapus Nota Dinas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Download
  const handleDownloadItem = (item: NotaDinasItem) => {
    const userProf: NotaDinasUserProfile = {
      nama: profile?.nama || 'SYAIFUL KHOLIFAH',
      nip: profile?.nip || '',
      jabatan: profile?.jabatan || item.dari,
    };
    downloadNotaDinasPdf(item, userProf);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ─── Header & Action Bar ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#005B94] to-[#00838F] text-white flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-2xl">description</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-['Outfit'] text-slate-900 tracking-tight">
                Nota Dinas
              </h1>
              <span className="bg-cyan-100 text-cyan-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {items.length} Data
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Penyusunan & Pengarsipan Nota Dinas Resmi Kemensos RI Berbasis AI Terintegrasi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-[#005B94] to-[#00838F] hover:from-[#004b7a] hover:to-[#006f7a] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Buat Nota Dinas</span>
          </button>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
            title="Segarkan data dari Google Sheets"
          >
            <span className={`material-symbols-outlined text-[18px] ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* ─── Search Bar (Persis Aspend Mobile) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-xl pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan Nomor atau Perihal..."
            className="w-full pl-11 pr-10 py-2.5 bg-transparent text-xs font-medium text-slate-900 placeholder-slate-400 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── List of Nota Dinas Cards (Format Sama Persis Aspend Mobile) ─── */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="w-9 h-9 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Memuat daftar Nota Dinas dari Google Sheets...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">description</span>
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {searchQuery ? 'Nota Dinas tidak ditemukan' : 'Belum Ada Nota Dinas'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            {searchQuery
              ? `Tidak ditemukan surat yang cocok dengan kata kunci "${searchQuery}".`
              : 'Mulai buat surat nota dinas resmi Kemensos RI pertama Anda dengan bantuan AI sekarang.'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-[#005B94] to-[#00838F] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Buat Nota Dinas Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((item) => {
            const formattedDateStr = (() => {
              try {
                const d = new Date(item.createdAt);
                if (!isNaN(d.getTime())) {
                  return d.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                }
              } catch {}
              return item.tanggal || '-';
            })();

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-cyan-400 hover:shadow-md transition-all p-4.5 flex flex-col justify-between group"
              >
                <div>
                  {/* Top: Nomor & Tanggal */}
                  <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                    <span className="font-bold text-cyan-800 font-mono tracking-tight truncate">
                      {item.nomor}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">{formattedDateStr}</span>
                  </div>

                  {/* Title / Perihal */}
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-cyan-700 transition-colors line-clamp-1 mb-2">
                    {item.hal}
                  </h4>

                  {/* Yth & Dari */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mb-3">
                    <div className="truncate">
                      <span className="font-semibold text-slate-700">Yth: </span>
                      <span>{item.yth}</span>
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-slate-700">Dari: </span>
                      <span>{item.dari}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-100 my-2.5"></div>

                  {/* Narasi Cuplikan */}
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {item.isiNotaDinas || 'Tidak ada teks isi nota dinas.'}
                  </p>
                </div>

                {/* Bottom Actions Toolbar */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="px-2.5 py-1.5 bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-slate-200"
                      title="Lihat Detail & Pratinjau Surat"
                    >
                      <span className="material-symbols-outlined text-[15px]">visibility</span>
                      <span>Detail</span>
                    </button>
                    <button
                      onClick={() => handleDownloadItem(item)}
                      className="px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg font-bold transition-colors flex items-center gap-1 cursor-pointer border border-cyan-200"
                      title="Download Dokumen PDF Resmi"
                    >
                      <span className="material-symbols-outlined text-[15px]">download</span>
                      <span>PDF</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditItem(item)}
                      className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Edit Isi Narasi"
                    >
                      <span className="material-symbols-outlined text-[17px]">edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmItem(item)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Nota Dinas"
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal Buat Nota Dinas Baru ─── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-[#005B94] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-cyan-400 text-2xl">post_add</span>
                <div>
                  <h3 className="font-bold text-sm font-['Outfit']">Buat Nota Dinas Baru</h3>
                  <p className="text-[11px] text-slate-300">Format Resmi Kementerian Sosial Republik Indonesia</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer text-white"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-cyan-700">tune</span>
                  <span>Parameter Nota Dinas</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Nomor Surat <span className="text-rose-500">*</span>:
                    </label>
                    <input
                      type="text"
                      value={nomor}
                      onChange={(e) => setNomor(e.target.value)}
                      placeholder="Contoh: 123/ND/06/2026"
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Kepada Yth. <span className="text-rose-500">*</span>:
                    </label>
                    <input
                      type="text"
                      value={yth}
                      onChange={(e) => setYth(e.target.value)}
                      placeholder="Contoh: Kepala Dinas Sosial Kota Binjai"
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-cyan-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Dari <span className="text-rose-500">*</span>:
                    </label>
                    <input
                      type="text"
                      value={dari}
                      onChange={(e) => setDari(e.target.value)}
                      placeholder="Contoh: Pendamping Sosial PKH Kecamatan..."
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Perihal (Hal) <span className="text-rose-500">*</span>:
                    </label>
                    <input
                      type="text"
                      value={hal}
                      onChange={(e) => setHal(e.target.value)}
                      placeholder="Contoh: Laporan Pelaksanaan Penyaluran Bantuan"
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-cyan-500 font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Sifat:</label>
                      <select
                        value={sifat}
                        onChange={(e) => setSifat(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {SIFAT_NOTA_DINAS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Lampiran:</label>
                      <input
                        type="text"
                        value={lampiran}
                        onChange={(e) => setLampiran(e.target.value)}
                        placeholder="Contoh: 1 Berkas atau -"
                        className="w-full p-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Tanggal Surat:</label>
                    <input
                      type="text"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      placeholder="Contoh: 05 Oktober 2026"
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Draf Poin & Generator AI */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[17px] text-cyan-700">edit_note</span>
                    <span>Poin-Poin Draft Kegiatan (Bahan AI)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAi}
                    disabled={isGeneratingAi || !poinDraft.trim()}
                    className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isGeneratingAi ? 'animate-spin' : ''}`}>
                      {isGeneratingAi ? 'hourglass_empty' : 'auto_fix_high'}
                    </span>
                    <span>{isGeneratingAi ? 'Menyusun Narasi AI...' : 'Susun Narasi dengan AI'}</span>
                  </button>
                </div>
                <textarea
                  value={poinDraft}
                  onChange={(e) => setPoinDraft(e.target.value)}
                  placeholder="Tuliskan poin-poin kegiatan/isi surat, contoh:&#10;1. Melaksanakan penyaluran bansos di balai pertemuan kantor lurah.&#10;2. Dihadiri oleh 45 KPM dan seluruh anggota berjalan tertib.&#10;3. Kendala 2 KPM sakit dan dilakukan home visit langsung oleh petugas."
                  rows={4}
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
                />
              </div>

              {/* Hasil Isi Nota Dinas */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Isi Lengkap Nota Dinas (Siap Cetak PDF) <span className="text-rose-500">*</span></span>
                  <span className="text-[10.5px] text-slate-400 font-normal">Dapat diedit bebas</span>
                </label>
                <textarea
                  value={isiNotaDinas}
                  onChange={(e) => setIsiNotaDinas(e.target.value)}
                  placeholder="Isi narasi resmi Nota Dinas akan muncul di sini setelah klik 'Susun Narasi dengan AI', atau Anda dapat menulisnya langsung..."
                  rows={7}
                  required
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 bg-white leading-relaxed font-sans"
                />
              </div>

              {/* Upload Bukti Dukung (Lampiran) */}
              <div className="space-y-2">
                <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-cyan-700">photo_library</span>
                  <span>Lampiran Foto / Bukti Dukung (Opsional)</span>
                </label>

                <div className="flex items-center gap-3 flex-wrap">
                  <label className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-cyan-500 rounded-xl font-bold text-slate-700 cursor-pointer flex items-center gap-2 transition-colors">
                    <span className="material-symbols-outlined text-lg text-cyan-600">add_photo_alternate</span>
                    <span>Pilih Foto dari Perangkat</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-slate-400 text-[11px]">Mendukung multi-foto (JPG, PNG)</span>
                </div>

                {photoBase64List.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-2.5">
                    {photoBase64List.map((photo, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                        <img src={photo} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                          title="Hapus foto"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#005B94] to-[#00838F] hover:from-[#004b7a] hover:to-[#006f7a] disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isSubmitting ? 'hourglass_empty' : 'save'}
                  </span>
                  <span>{isSubmitting ? 'Menyimpan & Membuat PDF...' : 'Simpan & Buat PDF'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Detail & Pratinjau Nota Dinas ─── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Detail */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-cyan-400 text-xl">description</span>
                <span className="font-bold text-xs font-mono">{selectedItem.nomor}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadItem(selectedItem)}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 hover:bg-white/20 rounded-xl text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            {/* Paper Preview Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-slate-900 font-sans">
              <div className="text-center mb-6">
                <h3 className="font-black text-sm uppercase underline tracking-wider">NOTA DINAS</h3>
                <p className="font-bold text-xs mt-1">Nomor: {selectedItem.nomor}</p>
              </div>

              {/* Metadata Table */}
              <div className="grid grid-cols-1 gap-1.5 text-xs mb-4">
                <div className="flex">
                  <span className="w-28 font-bold shrink-0">Kepada Yth.</span>
                  <span className="w-4">:</span>
                  <span className="flex-1 font-semibold">{selectedItem.yth}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold shrink-0">Dari</span>
                  <span className="w-4">:</span>
                  <span className="flex-1 font-semibold">{selectedItem.dari}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold shrink-0">Sifat</span>
                  <span className="w-4">:</span>
                  <span className="flex-1">{selectedItem.sifat}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold shrink-0">Lampiran</span>
                  <span className="w-4">:</span>
                  <span className="flex-1">{selectedItem.lampiran}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold shrink-0">Tanggal</span>
                  <span className="w-4">:</span>
                  <span className="flex-1">{selectedItem.tanggal}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold shrink-0">Hal</span>
                  <span className="w-4">:</span>
                  <span className="flex-1 font-bold">{selectedItem.hal}</span>
                </div>
              </div>

              {/* Divider Line */}
              <div className="border-b-2 border-black mb-6"></div>

              {/* Narasi Isi Surat */}
              <div className="space-y-3.5 text-xs text-justify leading-relaxed pl-8">
                {selectedItem.isiNotaDinas.split('\n').map((para, idx) => {
                  const t = para.trim();
                  if (!t) return null;
                  return (
                    <p key={idx} className="indent-6">
                      {t}
                    </p>
                  );
                })}
              </div>

              {/* Signature Block */}
              <div className="mt-10 flex justify-end text-xs">
                <div className="w-64 text-center">
                  <p>{profile?.jabatan || selectedItem.dari}</p>
                  <div className="h-16"></div>
                  <p className="font-bold underline uppercase">
                    {profile?.nama || 'SYAIFUL KHOLIFAH'}
                  </p>
                  <p className="font-mono text-[11px]">
                    NIP. {profile?.nip || '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Edit Narasi ─── */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-xs font-['Outfit']">Edit Narasi Nota Dinas ({editItem.nomor})</h3>
              <button onClick={() => setEditItem(null)} className="p-1 hover:bg-white/20 rounded-lg text-white">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Isi Narasi:</label>
                <textarea
                  value={editItem.isiNotaDinas}
                  onChange={(e) => setEditItem({ ...editItem, isiNotaDinas: e.target.value })}
                  rows={10}
                  required
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 bg-white leading-relaxed"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Konfirmasi Hapus ─── */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 text-center shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <h3 className="font-bold text-sm text-slate-900">Hapus Nota Dinas?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Apakah Anda yakin ingin menghapus surat nomor <strong>"{deleteConfirmItem.nomor}"</strong>? Data ini akan dihapus dari Google Sheets.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmItem)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
