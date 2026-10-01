import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isP2K2 } from '@/lib/master-rhk';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const DEFAULT_KEY_B64 = 'c2stb3ItdjEtMDMxMjU3NDI2NjQwYTM3NWEyYjExMDM3ZmQ0YWE1NWM4MjQ1ZTVlZjkxNzM1NzU5NjcyOWM3NThlOTZiYTI0Nw==';
const OPENROUTER_DEFAULT_KEY = Buffer.from(DEFAULT_KEY_B64, 'base64').toString('utf-8');
const OPENROUTER_DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NAMA_BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatTanggalLengkap(dateStr: string): { formattedTanggal: string; tanggalLengkap: string } {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const hari = NAMA_HARI[d.getDay()];
      const tgl = d.getDate();
      const bln = NAMA_BULAN[d.getMonth() + 1];
      const thn = d.getFullYear();
      const padTgl = String(tgl).padStart(2, '0');
      return {
        formattedTanggal: `${hari}, ${tgl} ${bln} ${thn}`,
        tanggalLengkap: `${padTgl} ${bln} ${thn}`
      };
    }
  } catch {}
  return { formattedTanggal: dateStr, tanggalLengkap: dateStr };
}

// ─── 1. PROMPT LAPORAN UMUM / NON-P2K2 / TKSK ─────────────────────────
function buildReportPrompt(params: {
  jenisRHK: string;
  rencanaAksi: string;
  tanggal: string;
  pukul: string;
  poinKegiatan: string;
  lokasi?: string;
  kecamatan?: string;
  kabupatenKota?: string;
  provinsi?: string;
  namaPetugas?: string;
  jabatanPetugas?: string;
}): string {
  const { formattedTanggal, tanggalLengkap } = formatTanggalLengkap(params.tanggal);
  const lokasiText = params.lokasi?.trim() ? `- Lokasi Kegiatan: ${params.lokasi.trim()}` : '';
  const wilayahKec = params.kecamatan?.trim() || '';
  const wilayahKab = params.kabupatenKota?.trim() || '';
  const wilayahProv = params.provinsi?.trim() || '';
  const nama = params.namaPetugas?.trim() || '';
  const jabatan = params.jabatanPetugas?.trim() || 'Pendamping Sosial';

  const wilayahParts = [];
  if (wilayahKec) wilayahParts.push(`Kecamatan ${wilayahKec}`);
  if (wilayahKab) wilayahParts.push(`Kabupaten/Kota ${wilayahKab}`);
  if (wilayahProv) wilayahParts.push(`Provinsi ${wilayahProv}`);
  const wilayahStr = wilayahParts.join(' ');

  return `Anda adalah asisten cerdas yang bertugas membuat narasi Laporan Rencana Hasil Kerja (RHK) resmi untuk pegawai Kementerian Sosial RI.
Tugas Anda adalah membuat narasi laporan yang lengkap, terstruktur, mendalam, dan profesional dalam bahasa Indonesia yang baku.

Berdasarkan data berikut:
- Jenis RHK: ${params.jenisRHK}
- Rencana Aksi: ${params.rencanaAksi}
- Tanggal: ${formattedTanggal} (${tanggalLengkap})
- Pukul: ${params.pukul} WIB
${lokasiText ? `${lokasiText}\n` : ''}${wilayahStr ? `- Wilayah Penugasan: ${wilayahStr}\n` : ''}${nama ? `- Petugas Pelaksana: ${nama} (${jabatan})\n` : ''}- Poin Kegiatan:
${params.poinKegiatan}

ATURAN SUPER PENTING:
1. JANGAN PERNAH membuat kalimat pengantar, salam, basa-basi, atau preamble apa pun di awal laporan. Langsung mulai baris pertama dengan "A. PENDAHULUAN".
2. Format HARUS persis mengikuti struktur di bawah (A, B, C, D, E).
3. JANGAN PERNAH menggunakan simbol asterisk (*) untuk daftar/bullet points. Selalu gunakan penomoran huruf (a., b., c.) atau tanda hubung biasa (-).
4. JANGAN gunakan tanda strip panjang (en-dash atau em-dash) atau simbol aneh. Selalu gunakan tanda hubung biasa (-) standar ASCII untuk rentang waktu (contoh: 08.00 - 10.00 WIB).
5. JANGAN menuliskan komentar, penjelasan, atau proses berpikir Anda. HANYA tuliskan teks laporan final.

A. PENDAHULUAN
1. Gambaran Umum:
(Tuliskan latar belakang resmi yang komprehensif dalam 2 PARAGRAF LENGKAP yang berbobot:
Paragraf 1: Menguraikan konteks kebijakan perlindungan sosial dan pengentasan kemiskinan Kementerian Sosial RI, pentingnya pelayanan dan pembinaan berkelanjutan bagi keluarga penerima manfaat, serta peran aktif pendamping sosial dalam memfasilitasi program ${wilayahStr ? `di wilayah ${wilayahStr}` : ''} secara berkala.
Paragraf 2: Menguraikan pertanggungjawaban pelaksanaan tugas kedinasan pada tanggal ${formattedTanggal} dalam melaksanakan rencana aksi "${params.rencanaAksi}", sasaran penerima manfaat dampingan, serta metode kerja pendampingan yang diterapkan di lapangan).

2. Maksud dan Tujuan:
Maksud dan tujuan dari pelaksanaan kegiatan ini meliputi:
a. Mendukung pencapaian target rencana hasil kerja (RHK) dan efektivitas pelaksanaan program perlindungan sosial di lapangan.
b. Memberikan bimbingan, verifikasi, atau pelayanan pendampingan secara langsung dan terukur kepada keluarga sasaran.
c. Mengidentifikasi kendala atau kebutuhan sosial penerima manfaat serta merumuskan langkah tindak lanjut penyelesaiannya secara tepat.
d. Memastikan seluruh proses pendampingan berjalan sesuai standar operasional prosedur Kementerian Sosial RI menuju kemandirian keluarga.

3. Ruang Lingkup:
Ruang lingkup kegiatan ini meliputi sasaran penerima manfaat dampingan, materi/fokus penanganan terkait "${params.rencanaAksi}", wilayah penugasan ${wilayahStr ? `di ${wilayahStr}` : ''}, koordinasi dengan pihak-pihak terkait, serta langkah-langkah kerja teknis pendampingan yang dilaksanakan.

4. Dasar:
Pelaksanaan kegiatan ini didasarkan pada:
a. Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial.
b. Peraturan Menteri Sosial Republik Indonesia Nomor 8 Tahun 2026 tentang Program Keluarga Harapan.
c. Keputusan Direktur Jenderal Perlindungan dan Jaminan Sosial Nomor 20/3/HK.01/3/2025.

B. KEGIATAN YANG DILAKSANAKAN
(Tuliskan CUKUP TEPAT 2 PARAGRAF yang padat dan komprehensif merangkum jalannya seluruh rangkaian kegiatan yang dilaksanakan secara teratur, interaksi di lapangan, dan peran petugas).

C. HASIL
(Wajib ditulis CUKUP TEPAT 2 PARAGRAF SAJA, dilarang kurang atau lebih dari 2 paragraf. Isinya penting, berbobot, dan mendalam:
- Paragraf 1: Menguraikan capaian output konkret pelaksanaan kegiatan, tingkat partisipasi penerima manfaat, dan data/fakta temuan penting di lapangan.
- Paragraf 2: Menguraikan komitmen konkret atau solusi yang berhasil disepakati bersama, tindak lanjut yang direncanakan, serta dampak nyata bagi kemandirian keluarga penerima manfaat).

D. KESIMPULAN DAN SARAN
(Tuliskan 1 paragraf ringkas berisi kesimpulan utama pelaksanaan tugas dan saran/rekomendasi tindak lanjut).

E. PENUTUP
Demikian laporan pelaksanaan kegiatan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.

Tambahan: Jika dalam data atau poin kegiatan terdapat lokasi atau tempat kegiatan, cantumkan di baris paling akhir laporan dengan format XML: <lokasi>Nama Lokasi</lokasi>. Jika tidak ada, tulis <lokasi>Tidak disebutkan</lokasi>.`;
}

// ─── 2. PROMPT P2K2 REGULER (PENDAMPING PKH) ─────────────────────────
function buildP2K2ReportPrompt(params: {
  jenisRHK: string;
  rencanaAksi: string;
  tanggal: string;
  pukul: string;
  poinKegiatan: string;
  p2k2Data: any;
  kecamatan?: string;
  kabupatenKota?: string;
  provinsi?: string;
  namaPetugas?: string;
  jabatanPetugas?: string;
}): string {
  const { formattedTanggal, tanggalLengkap } = formatTanggalLengkap(params.tanggal);
  const d = params.p2k2Data || {};

  const wilayahKec = params.kecamatan?.trim() || '';
  const wilayahKab = params.kabupatenKota?.trim() || '';
  const wilayahProv = params.provinsi?.trim() || '';
  const nama = params.namaPetugas?.trim() || '';
  const jabatan = params.jabatanPetugas?.trim() || 'Pendamping PKH';

  const pemateri = (d.isPemateriDiriSendiri || !d.namaPemateri?.trim())
    ? (nama || 'Pendamping Sosial PKH')
    : d.namaPemateri.trim();
  const jabatanPem = (d.isPemateriDiriSendiri || !d.jabatanPemateri?.trim())
    ? (jabatan || 'Pendamping PKH')
    : d.jabatanPemateri.trim();

  const jamSelesaiStr = d.jamSelesai?.trim() || 'selesai';
  const tempatStr = d.tempatPelaksanaan?.trim() || 'Lokasi Kelompok';
  const kelompokStr = d.namaKelompok?.trim() || 'Kelompok KPM';
  const ketuaStr = d.ketuaKelompok?.trim() || '-';
  const hadir = d.jumlahHadir || '0';
  const sakit = d.jumlahSakit || '0';
  const alpa = d.jumlahAlpa || '0';
  const total = d.jumlahKPM || String(parseInt(hadir) + parseInt(sakit) + parseInt(alpa) || 0);

  return `Anda adalah asisten cerdas yang bertugas membuat narasi Laporan Rencana Hasil Kerja (RHK) resmi kegiatan Pertemuan Peningkatan Kemampuan Keluarga (P2K2) / Family Development Session (FDS) untuk pegawai Kementerian Sosial RI.
Tugas Anda adalah membuat narasi laporan yang lengkap, terstruktur, mendalam, dan profesional dalam bahasa Indonesia yang baku sesuai pedoman resmi Kementerian Sosial RI.

Data Pelaksanaan P2K2:
- Jenis RHK: ${params.jenisRHK}
- Rencana Aksi: ${params.rencanaAksi}
- Modul: ${d.modul || '-'}
- Sesi / Materi: ${d.sesi || '-'}
- Tanggal Pelaksanaan: ${formattedTanggal} (${tanggalLengkap})
- Waktu: Pukul ${params.pukul} - ${jamSelesaiStr} WIB (gunakan tanda hubung '-')
- Tempat / Lokasi: ${tempatStr}
- Wilayah Tugas: Kecamatan ${wilayahKec}, Kabupaten/Kota ${wilayahKab}, Provinsi ${wilayahProv}
- Kelompok: ${kelompokStr}
- Ketua Kelompok: Ibu ${ketuaStr}
- Kehadiran: ${hadir} hadir, ${sakit} sakit, ${alpa} alpa dari total ${total} KPM peserta dampingan
- Fasilitator / Pemateri: ${pemateri} (${jabatanPem})
- Poin Kegiatan Tambahan:
${params.poinKegiatan}

ATURAN SUPER PENTING:
1. JANGAN PERNAH membuat kalimat pengantar, salam, basa-basi, atau preamble apa pun di awal laporan. Langsung mulai baris pertama dengan "A. PENDAHULUAN".
2. Format laporan HARUS persis mengikuti struktur resmi berikut (A, B, C, D, E).
3. JANGAN PERNAH menggunakan simbol asterisk (*) untuk daftar. Gunakan huruf abjad (a., b., c.) atau tanda hubung biasa (-).
4. JANGAN gunakan tanda strip panjang (en-dash atau em-dash) atau simbol aneh. Selalu gunakan tanda hubung biasa (-) standar ASCII untuk rentang waktu (contoh: 08.00 - 10.00 WIB).
5. JANGAN menuliskan komentar, penjelasan, atau proses berpikir Anda. HANYA tuliskan teks laporan final.

STRUKTUR RESMI NARASI LAPORAN:

A. PENDAHULUAN
1. Gambaran Umum:
Pertemuan Peningkatan Kemampuan Keluarga (P2K2) merupakan proses belajar terstruktur untuk mempercepat perubahan perilaku Keluarga Penerima Manfaat (KPM) PKH dalam bidang Kesehatan, Pendidikan, Ekonomi, Perlindungan Anak, dan Kesejahteraan Sosial dan merupakan salah satu kegiatan utama dalam Program Keluarga Harapan (PKH) yang bertujuan menyediakan wadah belajar bagi KPM PKH, menambah wawasan dan mengubah perilaku, melaksanakan edukasi secara berkala kepada KPM PKH, dan memberikan dukungan kepada KPM untuk menuju kemandirian khususnya di Kecamatan ${wilayahKec} Kabupaten/Kota ${wilayahKab} Provinsi ${wilayahProv} yang dilakukan secara rutin sesuai jadwal yang telah ditetapkan.

Laporan ini disusun sebagai bentuk pertanggungjawaban dan dokumentasi kegiatan P2K2 yang telah dilaksanakan pada ${tanggalLengkap}. Pelaksanaan P2K2 melibatkan pendamping sosial PKH sebagai fasilitator dan KPM kelompok ${kelompokStr} di Kecamatan ${wilayahKec} Kabupaten/Kota ${wilayahKab} Provinsi ${wilayahProv} sebagai peserta pertemuan. Kegiatan berlangsung dengan metode diskusi kelompok, penyampaian materi ${d.modul || ''}, tanya jawab, dan simulasi dengan tema modul ${d.modul || ''} sesi ${d.sesi || ''} yang ditetapkan oleh Kementerian Sosial, maupun materi tambahan mengenai wawasan terkait isu-isu yang relevan di masyarakat sesuai dengan kondisi terkini atau sesuai kebutuhan.

2. Maksud dan Tujuan:
Maksud dan tujuan pelaksanaan kegiatan P2K2 ini meliputi:
a. Memberikan pemahaman dan edukasi mendalam kepada KPM dampingan mengenai materi ${d.modul || ''} sesi ${d.sesi || ''} untuk dipraktikkan dalam kehidupan keluarga sehari-hari.
b. Mendorong perubahan pola pikir dan perilaku positif KPM dalam peningkatan kualitas kesehatan, pendidikan anak, serta tata kelola ekonomi keluarga.
c. Memperkuat komitmen KPM dalam memenuhi kewajiban kepesertaan Program Keluarga Harapan menuju kemandirian dan graduasi sejahtera.
d. Menyediakan ruang interaktif bagi KPM untuk mendiskusikan kendala atau isu-isu yang dihadapi dalam pemenuhan komitmen program dan mencari pemecahan masalah bersama.

3. Ruang Lingkup:
Ruang lingkup kegiatan P2K2 yang dilaksanakan meliputi sasaran KPM dampingan kelompok ${kelompokStr} (Ketua: Ibu ${ketuaStr}) di ${tempatStr}, dengan cakupan kegiatan:
a. Persiapan materi ${d.modul || ''} dan jadwal pertemuan.
b. Koordinasi dengan KPM mengenai lokasi dan waktu pelaksanaan.
c. Pelaksanaan pertemuan sesuai modul ${d.modul || ''} sesi ${d.sesi || ''}.
d. Fasilitasi diskusi, penyampaian materi ${d.modul || ''}, dan praktik sederhana.
e. Dokumentasi pertemuan dan pengisian daftar hadir peserta.
f. Rekapitulasi hadir peserta dan evaluasi komitmen KPM.

4. Dasar:
Pelaksanaan kegiatan ini didasarkan pada:
a. Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial.
b. Peraturan Menteri Sosial Republik Indonesia Nomor 8 Tahun 2026 tentang Program Keluarga Harapan.
c. Keputusan Direktur Jenderal Perlindungan dan Jaminan Sosial Nomor 20/3/HK.01/3/2025.

B. KEGIATAN YANG DILAKSANAKAN
(Tuliskan CUKUP TEPAT 2 PARAGRAF yang padat dan komprehensif. Paragraf pertama menguraikan pembukaan, perkenalan tujuan, dinamika pemaparan materi ${d.modul || ''} sesi ${d.sesi || ''} oleh pemateri ${pemateri}, serta keaktifan KPM dalam diskusi kelompok. Paragraf kedua menguraikan sesi tanya jawab, simulasi praktik materi, penegasan komitmen peserta, dan penutupan acara).

C. HASIL
(Wajib ditulis CUKUP TEPAT 2 PARAGRAF SAJA, dilarang kurang atau lebih dari 2 paragraf. Isinya penting, berbobot, dan mendalam:
- Paragraf 1: Menguraikan output nyata capaian kegiatan, tingkat kehadiran (${hadir} hadir dari total ${total} KPM) dan antusiasme aktif peserta, serta sejauh mana pemahaman peserta terhadap materi ${d.modul || ''} sesi ${d.sesi || ''} yang telah dibahas.
- Paragraf 2: Menguraikan komitmen perubahan perilaku positif anggota KPM di rumah tangga masing-masing setelah mempelajari modul tersebut, solusi konkret yang disepakati atas kendala keluarga dampingan di lapangan, serta dampak langsung kegiatan ini terhadap upaya kemandirian keluarga penerima manfaat).

D. KESIMPULAN DAN SARAN
(Tuliskan 1 paragraf ringkas berisi kesimpulan utama pelaksanaan pertemuan P2K2 dan rekomendasi/tindak lanjut untuk pendampingan pertemuan sesi berikutnya).

E. PENUTUP
Demikian laporan pelaksanaan kegiatan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.

Tambahan: Cantumkan di baris paling akhir laporan dengan format XML: <lokasi>${tempatStr}</lokasi>.`;
}

// ─── 3. PROMPT SUPERVISI P2K2 (KATIM KAB/KOTA & KATIM PROVINSI) ───────
function buildP2K2SupervisiReportPrompt(params: {
  jenisRHK: string;
  rencanaAksi: string;
  tanggal: string;
  pukul: string;
  poinKegiatan: string;
  p2k2Data: any;
  kecamatan?: string;
  kabupatenKota?: string;
  provinsi?: string;
  namaPetugas?: string;
  jabatanPetugas?: string;
}): string {
  const { formattedTanggal, tanggalLengkap } = formatTanggalLengkap(params.tanggal);
  const d = params.p2k2Data || {};

  const wilayahKab = d.kabupatenKota?.trim() || params.kabupatenKota?.trim() || '';
  const wilayahProv = d.provinsi?.trim() || params.provinsi?.trim() || '';
  const wilayahKec = d.kecamatan?.trim() || params.kecamatan?.trim() || '';
  const wilayahDesa = d.desaKelurahan?.trim() || '';

  const namaKatim = d.namaKetuaTim?.trim() || params.namaPetugas?.trim() || 'Ketua Tim';
  const jabatanKatim = params.jabatanPetugas?.trim() || 'Ketua Tim';

  const namaPendamping = d.namaPendamping?.trim() || d.namaPemateri?.trim() || 'Pendamping Sosial PKH';
  const nipPendamping = d.nipPendamping?.trim() ? ` (NIP: ${d.nipPendamping.trim()})` : '';

  const jamSelesaiStr = d.jamSelesai?.trim() || 'selesai';
  const tempatStr = d.tempatPelaksanaan?.trim() || 'Lokasi Kegiatan';
  const kelompokStr = d.namaKelompok?.trim() || 'Kelompok KPM';
  const ketuaStr = d.ketuaKelompok?.trim() || '-';
  const hadir = d.jumlahHadir || '0';
  const sakit = d.jumlahSakit || '0';
  const alpa = d.jumlahAlpa || '0';
  const total = d.jumlahKPM || String(parseInt(hadir) + parseInt(sakit) + parseInt(alpa) || 0);

  return `Anda adalah asisten cerdas yang bertugas membuat narasi Laporan Rencana Hasil Kerja (RHK) resmi kegiatan Supervisi Pertemuan Peningkatan Kemampuan Keluarga (P2K2) kepada ASN PPPK / Pendamping Sosial PKH oleh Ketua Tim (Katim) Kementerian Sosial RI.
Tugas Anda adalah membuat narasi laporan supervisi yang lengkap, terstruktur, mendalam, dan profesional dalam bahasa Indonesia yang baku sesuai pedoman resmi Kementerian Sosial RI.

Data Pelaksanaan Supervisi P2K2:
- Jenis RHK: ${params.jenisRHK}
- Rencana Aksi: ${params.rencanaAksi}
- Modul P2K2: ${d.modul || '-'}
- Sesi / Materi P2K2: ${d.sesi || '-'}
- Tanggal Supervisi: ${formattedTanggal} (${tanggalLengkap})
- Waktu: Pukul ${params.pukul} - ${jamSelesaiStr} WIB (gunakan tanda hubung '-')
- Tempat / Lokasi: ${tempatStr}
- Wilayah Supervisi: Desa/Kelurahan ${wilayahDesa}, Kecamatan ${wilayahKec}, Kabupaten/Kota ${wilayahKab}, Provinsi ${wilayahProv}
- Nama Ketua Tim (Penyelia/Supervisor): ${namaKatim} (${jabatanKatim})
- Nama Pendamping yang Disupervisi: ${namaPendamping}${nipPendamping}
- Kelompok Dampingan: ${kelompokStr}
- Ketua Kelompok: Ibu ${ketuaStr}
- Kehadiran KPM: ${hadir} hadir, ${sakit} sakit, ${alpa} alpa dari total ${total} KPM peserta dampingan
- Poin Kegiatan Khusus:
${params.poinKegiatan}

ATURAN SUPER PENTING:
1. JANGAN PERNAH membuat kalimat pengantar, salam, basa-basi, atau preamble apa pun di awal laporan. Langsung mulai baris pertama dengan "A. PENDAHULUAN".
2. Format laporan HARUS persis mengikuti struktur resmi baku di bawah (A, B, C, D, E).
3. JANGAN PERNAH menggunakan simbol asterisk (*) untuk daftar. Gunakan huruf abjad (a., b., c.) atau penomoran angka biasa.
4. JANGAN gunakan tanda strip panjang (en-dash atau em-dash) atau simbol aneh. Selalu gunakan tanda hubung biasa (-) standar ASCII untuk rentang waktu (contoh: 08.00 - 10.00 WIB).
5. JANGAN menuliskan komentar, penjelasan, atau proses berpikir Anda. HANYA tuliskan teks laporan final.

STRUKTUR RESMI NARASI LAPORAN SUPERVISI:

A. PENDAHULUAN
1. Umum
Pertemuan Peningkatan Kemampuan Keluarga (P2K2) merupakan proses belajar terstruktur untuk mempercepat perubahan perilaku Keluarga Penerima Manfaat (KPM) PKH dalam bidang Kesehatan, Pendidikan, Ekonomi, Perlindungan Anak, dan Kesejahteraan Sosial dan merupakan salah satu kegiatan utama dalam Program Keluarga Harapan (PKH) yang bertujuan menyediakan wadah belajar bagi KPM PKH, menambah wawasan dan mengubah perilaku, melaksanakan edukasi secara berkala kepada KPM PKH, dan memberikan dukungan kepada KPM untuk menuju kemandirian khususnya di Kabupaten/Kota ${wilayahKab} Provinsi ${wilayahProv} yang dilakukan secara rutin sesuai jadwal yang telah ditetapkan.

Kegiatan Supervisi Pertemuan Peningkatan Kemampuan Keluarga (P2K2) dalam Program Keluarga Harapan (PKH) dilaksanakan dalam rangka memastikan kualitas pelaksanaan pendampingan dan meningkatkan efektivitas perubahan perilaku Keluarga Penerima Manfaat (KPM). Supervisi ini berfungsi sebagai mekanisme kontrol kualitas (quality assurance) dan pembinaan langsung bagi Pendamping Sosial PKH.

Laporan ini disusun sebagai bentuk pertanggungjawaban dan dokumentasi kegiatan Supervisi P2K2 yang telah dilaksanakan pada ${tanggalLengkap}. Pelaksanaan Supervisi P2K2 dilakukan oleh Ketua Tim (Katim) selaku penyelia terhadap pendamping sosial PKH (${namaPendamping}) sebagai fasilitator dan KPM di Kabupaten/Kota ${wilayahKab} Provinsi ${wilayahProv} sebagai peserta pertemuan. Kegiatan berlangsung dengan metode diskusi kelompok dan tanya jawab.

2. Maksud Dan Tujuan
a. Memberikan informasi lengkap mengenai pelaksanaan P2K2 di Kabupaten/Kota ${wilayahKab} Provinsi ${wilayahProv}.
b. Menjadi bahan evaluasi terhadap hasil capaian pelaksanaan kegiatan P2K2.
c. Meningkatkan penguatan kapasitas Pendamping dengan memberikan saran, tindak lanjut terhadap temuan, bimbingan teknis, serta evaluasi langsung terhadap keterampilan fasilitasi Pendamping Sosial PKH di lapangan.

3. Ruang Lingkup
Ruang lingkup pelaksanaan kegiatan supervisi P2K2 kepada ASN PPPK / Pendamping Sosial PKH mencakup:
a. Verifikasi kesiapan administrasi kelompok, daftar hadir KPM, dan kelengkapan media peraga/buku kerja P2K2 modul ${d.modul || ''}.
b. Observasi dan evaluasi kesesuaian metode fasilitasi materi sesi ${d.sesi || ''} dengan standar operasional prosedur (SOP).
c. Pemantauan tingkat kehadiran, partisipasi aktif, serta pemahaman KPM terhadap materi yang disampaikan.
d. Pemberian bimbingan teknis langsung dan coaching keterampilan fasilitasi kepada pendamping sosial di lokasi dampingan.
e. Perumusan catatan evaluasi, penyusunan rencana tindak lanjut pembinaan, dan dokumentasi hasil supervisi.

4. Dasar
a. Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial.
b. Peraturan Menteri Sosial Republik Indonesia Nomor 8 Tahun 2026 tentang Program Keluarga Harapan.
c. Keputusan Direktur Jenderal Perlindungan dan Jaminan Sosial Nomor 20/3/HK.01/3/2025.

B. KEGIATAN YANG DILAKSANAKAN
(Tuliskan CUKUP TEPAT 2 PARAGRAF yang padat dan komprehensif. Paragraf pertama menguraikan jalannya kegiatan supervisi oleh Ketua Tim terhadap penyampaian materi ${d.modul || ''} sesi ${d.sesi || ''} oleh pendamping sosial ${namaPendamping} kepada kelompok KPM ${kelompokStr} di ${tempatStr}. Paragraf kedua menguraikan proses observasi metode fasilitasi, interaksi tanya jawab antara KPM dan pendamping, serta arahan supervisi pembinaan yang diberikan Ketua Tim).

C. HASIL
(Wajib ditulis CUKUP TEPAT 2 PARAGRAF SAJA, dilarang kurang atau lebih dari 2 paragraf. Isinya penting, berbobot, dan mendalam:
- Paragraf 1: Menguraikan hasil penilaian supervisi terhadap keterampilan fasilitasi pendamping sosial ${namaPendamping}, tingkat kehadiran KPM (${hadir} dari ${total} KPM) dan keaktifan peserta, serta kesesuaian penyampaian materi modul dengan standar operasional prosedur (SOP).
- Paragraf 2: Menguraikan poin bimbingan teknis dan saran konstruktif yang diberikan kepada pendamping sosial, komitmen tindak lanjut pembinaan SDM, serta rekomendasi untuk meningkatkan efektivitas pertemuan P2K2 berikutnya).

D. KESIMPULAN DAN SARAN
(Tuliskan 1 paragraf ringkas berisi kesimpulan utama hasil supervisi dan rekomendasi pembinaan keberlanjutan bagi pendamping sosial PKH).

E. PENUTUP
Demikian laporan pelaksanaan supervisi kegiatan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.

Tambahan: Cantumkan di baris paling akhir laporan dengan format XML: <lokasi>${tempatStr}</lokasi>.`;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      jenisRHK,
      idRHK,
      rencanaAksi,
      tanggal,
      pukul,
      poinKegiatan,
      p2k2Data,
      lokasi,
      kecamatan,
      kabupatenKota,
      provinsi,
      namaPetugas,
      jabatanPetugas
    } = body;

    if (!jenisRHK || !rencanaAksi || !poinKegiatan) {
      return NextResponse.json({ error: 'Data laporan belum lengkap.' }, { status: 400 });
    }

    const checkP2K2 = isP2K2(idRHK || '') || isP2K2(jenisRHK || '') || isP2K2(rencanaAksi || '') || Boolean(p2k2Data && (p2k2Data.modul || p2k2Data.sesi || p2k2Data.namaKelompok));
    const isSupervisi = p2k2Data?.isSupervisi || rencanaAksi?.toLowerCase().includes('supervisi pelaksanaan p2k2');

    let prompt = '';
    if (checkP2K2 && isSupervisi) {
      prompt = buildP2K2SupervisiReportPrompt({
        jenisRHK,
        rencanaAksi,
        tanggal: tanggal || new Date().toISOString().substring(0, 10),
        pukul: pukul || '14:00',
        poinKegiatan,
        p2k2Data,
        kecamatan,
        kabupatenKota,
        provinsi,
        namaPetugas: namaPetugas || session.user?.name || '',
        jabatanPetugas: jabatanPetugas || 'Katim Kab/Kota',
      });
    } else if (checkP2K2) {
      prompt = buildP2K2ReportPrompt({
        jenisRHK,
        rencanaAksi,
        tanggal: tanggal || new Date().toISOString().substring(0, 10),
        pukul: pukul || '14:00',
        poinKegiatan,
        p2k2Data,
        kecamatan,
        kabupatenKota,
        provinsi,
        namaPetugas: namaPetugas || session.user?.name || '',
        jabatanPetugas: jabatanPetugas || 'Pendamping PKH',
      });
    } else {
      prompt = buildReportPrompt({
        jenisRHK,
        rencanaAksi,
        tanggal: tanggal || new Date().toISOString().substring(0, 10),
        pukul: pukul || '14:00',
        poinKegiatan,
        lokasi,
        kecamatan,
        kabupatenKota,
        provinsi,
        namaPetugas: namaPetugas || session.user?.name || '',
        jabatanPetugas: jabatanPetugas || 'Pendamping Sosial',
      });
    }

    let generatedText = '';
    const openRouterKey = process.env.OPENROUTER_API_KEY || OPENROUTER_DEFAULT_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const groqKey = process.env.GROQ_API_KEY || '';

    // 1. Coba OpenRouter API dengan model Gemini 2.5 Flash-Lite tanpa reasoning tokens (super cepat & akurat)
    if (!generatedText && openRouterKey) {
      const routerModels = [
        OPENROUTER_DEFAULT_MODEL,
        'google/gemini-2.5-flash',
        'google/gemini-2.0-flash-001',
      ];
      for (const rModel of routerModels) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openRouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://aspend-web.vercel.app',
              'X-Title': 'ASPEND Web',
            },
            body: JSON.stringify({
              model: rModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 8192,
              reasoning: { effort: 'none' },
            }),
          });
          if (response.ok) {
            const data = await response.json();
            generatedText = data.choices?.[0]?.message?.content || '';
            if (generatedText) break;
          } else {
            console.warn(`OpenRouter (${rModel}) response not ok:`, response.status, await response.text());
          }
        } catch (err) {
          console.warn(`OpenRouter error (${rModel}):`, err);
        }
      }
    }

    // 2. Fallback ke Google Gemini API jika OpenRouter gagal
    if (!generatedText && geminiKey) {
      const geminiModels = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      for (const gModel of geminiModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${geminiKey}`;
          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 8000 },
            }),
          });
          if (response.ok) {
            const data = await response.json();
            generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (generatedText) break;
          }
        } catch (err) {
          console.warn(`Gemini API error (${gModel}):`, err);
        }
      }
    }

    // 3. Fallback ke Groq API jika tersedia
    if (!generatedText && groqKey) {
      const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
      for (const qModel of groqModels) {
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: qModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 8000,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            generatedText = data.choices?.[0]?.message?.content || '';
            if (generatedText) break;
          }
        } catch (err) {
          console.warn(`Groq API error (${qModel}):`, err);
        }
      }
    }

    if (!generatedText) {
      throw new Error(
        'Gagal menghubungkan ke layanan AI. Pastikan kuota API Key (OPENROUTER_API_KEY atau GEMINI_API_KEY) masih aktif.'
      );
    }

    // 4. Ekstrak lokasi
    let location = '';
    const locRegex = /<lokasi>([\s\S]*?)<\/lokasi>/i;
    const locMatch = generatedText.match(locRegex);
    if (locMatch && locMatch[1]) {
      location = locMatch[1].trim();
      if (location.toLowerCase() === 'tidak disebutkan') location = '';
    }
    let cleanNarrative = generatedText.replace(locRegex, '').trim();

    // 5. Bersihkan karakter aneh
    cleanNarrative = cleanNarrative
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, '-')
      .replace(/•/g, '-')
      .replace(/\u00AD/g, '')
      .replace(/\u200B/g, '');

    // 6. Potong preamble jika AI menghasilkan basa-basi sebelum "A. PENDAHULUAN"
    const pendahuluanMatch = cleanNarrative.search(/(?:\*\*)?A\.\s+PENDAHULUAN(?:\*\*)?/i);
    if (pendahuluanMatch !== -1) {
      cleanNarrative = cleanNarrative.substring(pendahuluanMatch);
    }

    // 7. Pastikan seksi E. PENUTUP selalu ada
    const hasPenutup = /(?:\*\*)?E\.\s*PENUTUP(?:\*\*)?/i.test(cleanNarrative);
    if (!hasPenutup) {
      cleanNarrative += '\n\nE. PENUTUP\nDemikian laporan pelaksanaan kegiatan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.';
    }

    return NextResponse.json({
      success: true,
      narrative: cleanNarrative,
      lokasi: location,
    });
  } catch (error: any) {
    console.error('Error /api/generate-narrative:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
