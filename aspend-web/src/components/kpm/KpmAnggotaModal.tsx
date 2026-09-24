'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  KpmAnggota,
  KpmKeluarga,
  KOMPONEN_OPTIONS,
  HUBUNGAN_KELUARGA_OPTIONS,
  JENIS_KELAMIN_OPTIONS,
} from '@/lib/kpm-constants';

interface KpmAnggotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  keluarga: KpmKeluarga | null;
  editAnggota?: KpmAnggota | null;
}

export default function KpmAnggotaModal({
  isOpen,
  onClose,
  onSuccess,
  keluarga,
  editAnggota,
}: KpmAnggotaModalProps) {
  const [members, setMembers] = useState<KpmAnggota[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [activeEditingMember, setActiveEditingMember] = useState<KpmAnggota | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);

  // Copy to clipboard state
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

  const [formData, setFormData] = useState<Partial<KpmAnggota>>({
    NIK: '',
    Nama: '',
    JenisKelamin: 'Laki-laki',
    TanggalLahir: '',
    Komponen: '',
    HubunganKeluarga: 'Anak',
    Posyandu: '',
    Sekolah: '',
    Kelas: '',
    Pekerjaan: '',
    Keterangan: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Ambil daftar anggota keluarga dari API
  const fetchMembers = async () => {
    if (!keluarga) return;
    setIsLoadingMembers(true);
    try {
      const q = keluarga.NoKK
        ? `noKK=${encodeURIComponent(keluarga.NoKK)}&nik=${encodeURIComponent(keluarga.NIK || '')}`
        : `nik=${encodeURIComponent(keluarga.NIK || '')}`;
      const res = await fetch(`/api/kpm/anggota?${q}`);
      const json = await res.json();
      if (json.data) {
        setMembers(json.data);
      }
    } catch (err) {
      console.error('Error fetching anggota:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (isOpen && keluarga) {
      fetchMembers();
      if (editAnggota) {
        setActiveEditingMember(editAnggota);
        setFormData(editAnggota);
        setIsFormVisible(true);
      } else {
        setActiveEditingMember(null);
        resetForm();
        setIsFormVisible(false);
      }
      setErrorMsg('');
    }
  }, [isOpen, keluarga, editAnggota]);

  const resetForm = () => {
    setFormData({
      NIK: '',
      Nama: '',
      JenisKelamin: 'Laki-laki',
      TanggalLahir: '',
      Komponen: '',
      HubunganKeluarga: 'Anak',
      Posyandu: '',
      Sekolah: '',
      Kelas: '',
      Pekerjaan: '',
      Keterangan: '',
    });
    setActiveEditingMember(null);
    setErrorMsg('');
  };

  const handleStartEdit = (ang: KpmAnggota) => {
    setActiveEditingMember(ang);
    setFormData({ ...ang });
    setIsFormVisible(true);
    setErrorMsg('');
  };

  const handleDeleteMember = async (ang: KpmAnggota) => {
    if (!confirm(`Yakin ingin menghapus data anggota keluarga "${ang.Nama}" (NIK: ${ang.NIK})?`)) {
      return;
    }

    setIsDeletingId(ang.AnggotaId);
    try {
      const res = await fetch(`/api/kpm/anggota?anggotaId=${encodeURIComponent(ang.AnggotaId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus anggota');

      await fetchMembers();
      onSuccess();
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    } finally {
      setIsDeletingId(null);
    }
  };

  // Cek duplikasi NIK di dalam form input real-time
  const isFormNikDuplicate = useMemo(() => {
    const inputNik = (formData.NIK || '').trim();
    if (!inputNik || inputNik.length < 5) return false;
    return members.some(
      (m) =>
        m.NIK?.trim() === inputNik &&
        (!activeEditingMember || m.AnggotaId !== activeEditingMember.AnggotaId)
    );
  }, [formData.NIK, members, activeEditingMember]);

  // Cek keaktifan field kondisional:
  const isPosyanduActive = formData.Komponen === 'Balita' || formData.Komponen === 'Ibu Hamil';
  const isSekolahActive =
    formData.Komponen === 'Anak SD' ||
    formData.Komponen === 'Anak SMP' ||
    formData.Komponen === 'Anak SMA';
  const isPekerjaanActive =
    formData.HubunganKeluarga === 'Kepala Keluarga' ||
    formData.HubunganKeluarga === 'Suami/Istri';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.NIK || formData.NIK.length !== 16) {
      setErrorMsg('NIK Anggota harus 16 digit angka.');
      return;
    }
    if (!formData.Nama?.trim()) {
      setErrorMsg('Nama Anggota wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        NoKK: keluarga?.NoKK,
      };

      const isEdit = !!activeEditingMember?.AnggotaId;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch('/api/kpm/anggota', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan data anggota');
      }

      await fetchMembers();
      onSuccess();
      resetForm();
      setIsFormVisible(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !keluarga) return null;

  // Hitung jumlah duplikat dalam daftar anggota keluarga ini
  const duplicateMemberCount = members.filter((m) => m.IsDuplicateNik).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl max-w-4xl w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-3xl">groups</span>
            <div>
              <h3 className="font-bold text-lg font-['Outfit']">
                Kelola Data Anggota Keluarga
              </h3>
              <p className="text-xs text-white/85">
                Pengurus: <strong>{keluarga.NamaPengurus}</strong> • No. KK: <span className="font-mono">{keluarga.NoKK}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-xl text-white transition-colors cursor-pointer"
            title="Tutup"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Peringatan jika ada NIK duplikat di antara anggota */}
          {duplicateMemberCount > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-rose-900 text-xs font-semibold">
              <span className="material-symbols-outlined text-rose-600 text-base shrink-0">warning</span>
              <span>
                Perhatian: Ditemukan {duplicateMemberCount} anggota dengan <strong>NIK Ganda (Duplikat)</strong>! Data duplikat ditandai dengan label merah pada tabel di bawah.
              </span>
            </div>
          )}

          {/* Tabel Anggota Keluarga */}
          <div className="border border-gray-200 rounded-2xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">format_list_bulleted</span>
                  Daftar Anggota Terdaftar ({members.length} Orang)
                </h4>
                <p className="text-[11px] text-gray-500">
                  Seluruh data anggota keluarga yang tercatat di dalam No. KK ini.
                </p>
              </div>

              {!isFormVisible && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsFormVisible(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">person_add</span>
                  <span>Tambah Anggota</span>
                </button>
              )}
            </div>

            {isLoadingMembers ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-gray-400">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs">Memuat data anggota keluarga...</p>
              </div>
            ) : members.length === 0 ? (
              <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <span className="material-symbols-outlined text-gray-400 text-3xl mb-1">group_off</span>
                <p className="text-xs font-semibold text-gray-600">Belum ada anggota keluarga terdaftar</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Klik tombol &quot;Tambah Anggota&quot; untuk menambahkan data anggota keluarga.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] text-gray-500 uppercase font-semibold">
                      <th className="px-3 py-2.5 text-center w-10">No</th>
                      <th className="px-3 py-2.5">Nama</th>
                      <th className="px-3 py-2.5">NIK</th>
                      <th className="px-3 py-2.5 text-center">L/P</th>
                      <th className="px-3 py-2.5">Hubungan</th>
                      <th className="px-3 py-2.5">Komponen</th>
                      <th className="px-3 py-2.5">Sekolah / Posyandu</th>
                      <th className="px-3 py-2.5 text-center w-20">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {members.map((ang, idx) => {
                      const isDup = Boolean(ang.IsDuplicateNik);
                      const isEditingThis = activeEditingMember?.AnggotaId === ang.AnggotaId;

                      return (
                        <tr
                          key={ang.AnggotaId ? `${ang.AnggotaId}-${idx}` : `ang-${idx}`}
                          className={`transition-colors ${
                            isEditingThis
                              ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600'
                              : isDup
                              ? 'bg-rose-50/50 hover:bg-rose-100/60 border-l-4 border-l-rose-500'
                              : 'hover:bg-gray-50/80'
                          }`}
                        >
                          <td className="px-3 py-2 text-center font-mono text-gray-500 font-medium">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-bold text-gray-900">
                            {ang.Nama}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-semibold text-gray-800">{ang.NIK || '—'}</span>
                              {ang.NIK && (
                                <button
                                  type="button"
                                  onClick={(e) => handleCopy(ang.NIK, `ang-table-nik-${ang.AnggotaId || idx}`, e)}
                                  className="p-0.5 hover:bg-gray-200 rounded transition-colors text-gray-400 hover:text-cyan-700 cursor-pointer inline-flex items-center"
                                  title={copiedKey === `ang-table-nik-${ang.AnggotaId || idx}` ? 'NIK Berhasil Disalin!' : 'Salin NIK'}
                                >
                                  <span className={`material-symbols-outlined text-[13px] ${copiedKey === `ang-table-nik-${ang.AnggotaId || idx}` ? 'text-emerald-600 font-bold' : ''}`}>
                                    {copiedKey === `ang-table-nik-${ang.AnggotaId || idx}` ? 'check' : 'content_copy'}
                                  </span>
                                </button>
                              )}
                              {isDup && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shrink-0"
                                  title={`NIK ini tercatat ganda pada data anggota! Silakan periksa atau perbarui.`}
                                >
                                  <span className="material-symbols-outlined text-[11px] text-rose-600">warning</span>
                                  <span>NIK Ganda</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {ang.JenisKelamin === 'Laki-laki' ? 'L' : 'P'}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{ang.HubunganKeluarga}</td>
                          <td className="px-3 py-2">
                            {ang.Komponen ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                                {ang.Komponen}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-[11px]">
                            {ang.Sekolah ? `${ang.Sekolah} (${ang.Kelas || '-'})` : ang.Posyandu || '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(ang)}
                                className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors cursor-pointer"
                                title="Edit Anggota"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button
                                type="button"
                                disabled={isDeletingId === ang.AnggotaId}
                                onClick={() => handleDeleteMember(ang)}
                                className="p-1 hover:bg-rose-100 rounded-lg text-rose-600 transition-colors cursor-pointer disabled:opacity-40"
                                title="Hapus Anggota"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Form Tambah / Edit Anggota */}
          {isFormVisible && (
            <div className="border-2 border-emerald-300 rounded-2xl p-5 bg-gradient-to-br from-emerald-50/40 to-teal-50/20 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-emerald-200 pb-3">
                <h4 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-700 text-base">
                    {activeEditingMember ? 'edit' : 'person_add'}
                  </span>
                  <span>{activeEditingMember ? 'Edit Data Anggota' : 'Form Tambah Anggota Baru'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsFormVisible(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                  <span>Tutup Form</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs text-gray-700">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 text-xs font-medium">
                    <span className="material-symbols-outlined text-base">error</span>
                    <span>{errorMsg}</span>
                  </div>
                )}

                {isFormNikDuplicate && (
                  <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-center gap-2 text-xs font-semibold">
                    <span className="material-symbols-outlined text-amber-600 text-base shrink-0">warning</span>
                    <span>Perhatian: NIK ini sudah terdaftar pada anggota lain dalam keluarga ini!</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">NIK Anggota (16 Digit) *</label>
                    <input
                      type="text"
                      maxLength={16}
                      value={formData.NIK || ''}
                      onChange={(e) => setFormData({ ...formData, NIK: e.target.value.replace(/\D/g, '') })}
                      placeholder="Contoh: 1271010000000003"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Nama Lengkap *</label>
                    <input
                      type="text"
                      value={formData.Nama || ''}
                      onChange={(e) => setFormData({ ...formData, Nama: e.target.value })}
                      placeholder="Nama lengkap anggota keluarga"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Jenis Kelamin</label>
                    <select
                      value={formData.JenisKelamin || 'Laki-laki'}
                      onChange={(e) => setFormData({ ...formData, JenisKelamin: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    >
                      {JENIS_KELAMIN_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={formData.TanggalLahir || ''}
                      onChange={(e) => setFormData({ ...formData, TanggalLahir: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Hubungan Keluarga</label>
                    <select
                      value={formData.HubunganKeluarga || 'Anak'}
                      onChange={(e) => setFormData({ ...formData, HubunganKeluarga: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    >
                      {HUBUNGAN_KELUARGA_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Komponen PKH</label>
                    <select
                      value={formData.Komponen || ''}
                      onChange={(e) => setFormData({ ...formData, Komponen: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                    >
                      <option value="">-- Bukan Komponen --</option>
                      {KOMPONEN_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Conditional Fields */}
                <div className="border-t border-emerald-200 pt-3 space-y-3">
                  <h5 className="font-bold text-gray-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-emerald-600">tune</span>
                    Data Terkait Komponen & Hubungan
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Posyandu (Aktif jika Balita / Ibu Hamil) */}
                    <div>
                      <label className={`block font-semibold mb-1 ${!isPosyanduActive ? 'text-gray-400' : 'text-gray-800'}`}>
                        Nama Posyandu {isPosyanduActive && <span className="text-emerald-600">* (Aktif)</span>}
                      </label>
                      <input
                        type="text"
                        disabled={!isPosyanduActive}
                        value={formData.Posyandu || ''}
                        onChange={(e) => setFormData({ ...formData, Posyandu: e.target.value })}
                        placeholder={isPosyanduActive ? 'Contoh: Posyandu Melati Indah' : 'Aktif untuk Balita / Ibu Hamil'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100 disabled:text-gray-400 bg-white"
                      />
                    </div>

                    {/* Pekerjaan (Aktif jika Kepala Keluarga / Suami-Istri) */}
                    <div>
                      <label className={`block font-semibold mb-1 ${!isPekerjaanActive ? 'text-gray-400' : 'text-gray-800'}`}>
                        Pekerjaan {isPekerjaanActive && <span className="text-emerald-600">* (Aktif)</span>}
                      </label>
                      <input
                        type="text"
                        disabled={!isPekerjaanActive}
                        value={formData.Pekerjaan || ''}
                        onChange={(e) => setFormData({ ...formData, Pekerjaan: e.target.value })}
                        placeholder={isPekerjaanActive ? 'Contoh: Buruh Harian Lepas / Pedagang' : 'Aktif untuk Kepala Keluarga / Suami-Istri'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100 disabled:text-gray-400 bg-white"
                      />
                    </div>

                    {/* Sekolah (Aktif jika Anak SD/SMP/SMA) */}
                    <div>
                      <label className={`block font-semibold mb-1 ${!isSekolahActive ? 'text-gray-400' : 'text-gray-800'}`}>
                        Nama Sekolah {isSekolahActive && <span className="text-emerald-600">* (Aktif)</span>}
                      </label>
                      <input
                        type="text"
                        disabled={!isSekolahActive}
                        value={formData.Sekolah || ''}
                        onChange={(e) => setFormData({ ...formData, Sekolah: e.target.value })}
                        placeholder={isSekolahActive ? 'Contoh: SDN 020202 Binjai' : 'Aktif untuk Anak SD/SMP/SMA'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100 disabled:text-gray-400 bg-white"
                      />
                    </div>

                    {/* Kelas (Aktif jika Anak SD/SMP/SMA) */}
                    <div>
                      <label className={`block font-semibold mb-1 ${!isSekolahActive ? 'text-gray-400' : 'text-gray-800'}`}>
                        Kelas {isSekolahActive && <span className="text-emerald-600">* (Aktif)</span>}
                      </label>
                      <input
                        type="text"
                        disabled={!isSekolahActive}
                        value={formData.Kelas || ''}
                        onChange={(e) => setFormData({ ...formData, Kelas: e.target.value })}
                        placeholder={isSekolahActive ? 'Contoh: Kelas 4 / Kelas 8' : 'Aktif untuk Anak SD/SMP/SMA'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100 disabled:text-gray-400 bg-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-semibold mb-1">Keterangan Tambahan</label>
                      <input
                        type="text"
                        value={formData.Keterangan || ''}
                        onChange={(e) => setFormData({ ...formData, Keterangan: e.target.value })}
                        placeholder="Catatan khusus anggota keluarga jika ada..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-emerald-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setIsFormVisible(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">save</span>
                        <span>{activeEditingMember ? 'Perbarui Anggota' : 'Simpan Anggota'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-gray-500">
            Total {members.length} anggota tercatat pada KK {keluarga.NoKK}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
