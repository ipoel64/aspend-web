export interface MasterRHKItem {
  id: string;
  jenis: string;
  rencanaList: string[];
}

export const MASTER_RHK_DATA: MasterRHKItem[] = [
  {
    id: 'RHK-1',
    jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah',
    rencanaList: [
      'Melaksanakan supervisi Kebijakan Bantuan Sosial Kepada ASN PPPK',
      'Melakukan edukasi dan sosialisasi pencairan secara tunai dan non tunai',
      'Melaksanakan Supervisi Permasalahan Bantuan Sosial',
      'Melaksanakan Monitoring/Pemantauan Penyaluran Bantuan Sosial',
      'Melaksanakan Penelitian penyaluran bantuan Sosial'
    ]
  },
  {
    id: 'RHK-2',
    jenis: 'Terlaksananya pertemuan P2K2 sesuai dengan ketentuan',
    rencanaList: [
      'Melaksanakan Pertemuan Peningkatan Kemampuan Keluarga (P2K2)',
      'Melakukan Supervisi pelaksanaan P2K2 kepada ASN PPPK'
    ]
  },
  {
    id: 'RHK-3',
    jenis: 'Terlaksananya Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial secara akurat sesuai dengan ketentuan',
    rencanaList: [
      'Melaksanakan Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial',
      'Melakukan pendampingan, mediasi, dan fasilitasi kepada KPM PKH dalam proses perubahan perilaku, pola pikir yang mandiri dan produktif',
      'Melaksanakan supervisi Verifikasi Komitmen Kepada ASN PPPK'
    ]
  },
  {
    id: 'RHK-4',
    jenis: 'Tersedianya Data KPM graduasi yang disusun sesuai dengan instrumen dan ketentuan',
    rencanaList: [
      'Melakukan usulan KPM Graduasi mandiri dan Pemberdayaan PPSE',
      'Melaksanakan supervisi Graduasi Kepada ASN PPPK'
    ]
  },
  {
    id: 'RHK-5',
    jenis: 'Terlaksananya Verifikasi, Validasi dan Permutakhiran Data KPM secara akurat sesuai dengan ketentuan',
    rencanaList: [
      'Melaksanakan Pemutakhiran Data',
      'Melaksanakan proses bisnis PKH yang meliputi verifikasi validasi calon penerima bantuan sosial',
      'Melaksanakan supervisi Verifikasi, Validasi dan pemutakhiran Kepada ASN PPPK'
    ]
  },
  {
    id: 'RHK-6',
    jenis: 'Terlaksananya kegiatan kasus adaptif (Respon kasus/pengaduan/kebencanaan/kerentanan) disusun secara lengkap dan akurat',
    rencanaList: [
      'Melaksanakan Respon Kasus/Pengaduan/kebencanaan/Kerentanan'
    ]
  },
  {
    id: 'RHK-7',
    jenis: 'Tersedianya Data Analisis Laporan Bulanan yang disusun sesuai dengan Ketentuan',
    rencanaList: [
      'Membuat laporan bulanan pelaksanaan PKH dan laporan lainnya.'
    ]
  },
  {
    id: 'RHK-8',
    jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial',
    rencanaList: [
      'Melaksanakan Tindak Lanjut Hasil Pemeriksaan (TLHP)',
      'Melakukan sosialisasi kebijakan dan bisnis proses PKH kepada aparat pemerintah tingkat kecamatan, desa/kelurahan, KPM PKH, dan masyarakat umum secara berkala melalui Pertemuan atau media sosial di',
      'Mengikuti Rapat Koordinasi,Sosialisasi Kebijakan Proses Bisnis PKH dan Penguatan Kapasitas SDM.',
      'Melakukan Pengawasan dan edukasi kepada Pendamping Sosial di Wilayah Kerja',
      'Melakukan koordinasi dan sinkronisasi dengan instansi terkait di tingkat Kabupaten Kota',
      'Berkoodinasi dengan ASN PPPK berkaitan dengan pelaksanaan program ke ASN PPPK',
      'Melakukan Evaluasi Kinerja dan Menyusun Pelaporan ASN PPPK',
      'Tugas Lainnya (Penugasan lainnya program Kementrian Sosial)'
    ]
  },
  {
    id: 'RHK-9',
    jenis: 'Terlaksananya Penyebaran Berita Baik Kementrian Sosial',
    rencanaList: [
      'Berperan aktif dalam memanfaatkan, menggunakan, melibatkan dan menyebarkan Media Sosial untuk menyampaikan semua program di Kementerian Sosial'
    ]
  }
];

export function getRHKByIdOrJenis(identifier: string): MasterRHKItem | undefined {
  if (!identifier) return undefined;
  const cleanId = identifier.trim().toLowerCase();
  return MASTER_RHK_DATA.find(
    item => item.id.toLowerCase() === cleanId || 
            item.jenis.toLowerCase() === cleanId || 
            item.id.replace(/\D/g, '') === cleanId.replace(/\D/g, '')
  );
}

export function getRencanaAksiListForRHK(identifier: string): string[] {
  const item = getRHKByIdOrJenis(identifier);
  return item ? item.rencanaList : [];
}

export function isP2K2(identifier: string): boolean {
  if (!identifier) return false;
  const s = identifier.toUpperCase();
  return s.includes('P2K2') || s.includes('RHK-2') || s === '2';
}

export interface MasterP2K2Item {
  id: string;
  modul: string;
  sesi: string;
}

export const MASTER_P2K2_DATA: MasterP2K2Item[] = [
  { id: 'p2k201', modul: 'MODUL PENDIDIKAN DAN PENGASUHAN', sesi: 'Sesi 1 : Menjadi Orang Tua yang Lebih Baik' },
  { id: 'p2k202', modul: 'MODUL PENDIDIKAN DAN PENGASUHAN', sesi: 'Sesi 2 : Memahami Perilaku Anak' },
  { id: 'p2k203', modul: 'MODUL PENDIDIKAN DAN PENGASUHAN', sesi: 'Sesi 3 : Memahami Cara Anak Usia Dini Belajar' },
  { id: 'p2k204', modul: 'MODUL PENDIDIKAN DAN PENGASUHAN', sesi: 'Sesi 4 : Membantu Anak Sukses di Sekolah' },
  { id: 'p2k205', modul: 'MODUL KEUANGAN KELUARGA', sesi: 'Sesi 1 : Mengelola Keuangan Keluarga' },
  { id: 'p2k206', modul: 'MODUL KEUANGAN KELUARGA', sesi: 'Sesi 2 : Cermat Meminjam dan Menabung' },
  { id: 'p2k207', modul: 'MODUL KEUANGAN KELUARGA', sesi: 'Sesi 3 : Memulai Usaha' },
  { id: 'p2k208', modul: 'MODUL KESEHATAN DAN GIZI', sesi: 'Sesi 1 : 1000 hari Pertama Kehidupan' },
  { id: 'p2k209', modul: 'MODUL KESEHATAN DAN GIZI', sesi: 'Sesi 2 : Anak dan Balita' },
  { id: 'p2k210', modul: 'MODUL KESEHATAN DAN GIZI', sesi: 'Sesi 3 : Higinitas, Sanitasi dan Penyakit' },
  { id: 'p2k211', modul: 'MODUL PERLINDUNGAN ANAK', sesi: 'Sesi 1: Pencegahan Kekerasan terhadap Anak' },
  { id: 'p2k212', modul: 'MODUL PERLINDUNGAN ANAK', sesi: 'Sesi 2 : Pencegahan Penelantaran dan Eksploitasi terhadap Anak' },
  { id: 'p2k213', modul: 'MODUL KESEJAHTERAAN SOSIAL', sesi: 'Sesi 1 : Perlindungan Penyandang Disabilitas' },
  { id: 'p2k214', modul: 'MODUL KESEJAHTERAAN SOSIAL', sesi: 'Sesi 2 : Kesejahteraan Lansia' },
  { id: 'p2k215', modul: 'MODUL 2: PERMASALAHAN STUNTING', sesi: 'Sesi 1. Memahami Permasalahan Stunting' },
  { id: 'p2k216', modul: 'MODUL 3: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMENUHAN KESEJAHTERAAN IBU HAMIL', sesi: 'Sesi 2. Mendukung Ibu Hamil Mengakses Informasi Yang Tepat dan Layanan Yang Tersedia di Masyarakat' },
  { id: 'p2k217', modul: 'MODUL 3: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMENUHAN KESEJAHTERAAN IBU HAMIL', sesi: 'Sesi 3. Mendukung Perawatan Sehari-Hari Ibu Hamil' },
  { id: 'p2k218', modul: 'MODUL 3: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMENUHAN KESEJAHTERAAN IBU HAMIL', sesi: 'Sesi 4. Mendukung Ayah dan Ibu Untuk Memberikan Stimulasi Pada Janin' },
  { id: 'p2k219', modul: 'MODUL 4: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMENUHAN KESEJAHTERAAN BAYI BARU LAHIR DAN IBU MENYUSUI', sesi: 'Sesi 5. Mendukung Pemenuhan Kesejahteraan Bayi Baru Lahir dan Ibu Menyusui' },
  { id: 'p2k220', modul: 'MODUL 5: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMBERIAN STIMULASI PADA ANAK', sesi: 'Sesi 6. Mendukung Pemberian Stimulasi Pada Bayi Baru Lahir sampai Usia 6 Bulan' },
  { id: 'p2k221', modul: 'MODUL 5: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMBERIAN STIMULASI PADA ANAK', sesi: 'Sesi 7. Mendukung Pemberian Stimulasi Pada Bayi 6-12 Bulan' },
  { id: 'p2k222', modul: 'MODUL 5: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMBERIAN STIMULASI PADA ANAK', sesi: 'Sesi 8. Mendukung Pemberian Stimulasi Pada Anak Usia 1-2 tahun' },
  { id: 'p2k223', modul: 'MODUL 5: PENCEGAHAN & PENANGANAN STUNTING MELALUI PEMBERIAN STIMULASI PADA ANAK', sesi: 'Sesi 9. Mendukung Pemberian Stimulasi Pada Anak Usia 2-6 Tahun' },
  { id: 'p2k224', modul: 'MODUL 6: PEMANFAATAN BANTUAN SOSIAL DALAM PEMENUHAN GIZI BAGI ANAK DAN IBU HAMIL', sesi: 'Sesi 10. Mendukung Pemanfaatan Bantuan Sosial Dalam Pemenuhan Gizi Bagi Anak dan Ibu Hamil' },
  { id: 'p2k225', modul: 'MODUL 7: PENCEGAHAN & PENANGANAN STUNTING MELALUI KEBERSIHAN DIRI DAN LINGKUNGAN', sesi: 'Sesi 11. Mendukung Praktik Cuci tangan pakai Sabun' },
  { id: 'p2k226', modul: 'MODUL 7: PENCEGAHAN & PENANGANAN STUNTING MELALUI KEBERSIHAN DIRI DAN LINGKUNGAN', sesi: 'Sesi 12. Mendukung Pemanfaatan Jamban Sehat' },
  { id: 'p2k227', modul: 'MODUL 8: PEMETAAN POTENSI KELUARGA DAN RENCANA AKSI DALAM PENCEGAHAN DAN PENANGANAN STUNTING', sesi: 'Sesi 13. Pemetaan Potensi Diri, Keluarga dan Lingkungan Sekitar' },
  { id: 'p2k228', modul: 'MODUL 8: PEMETAAN POTENSI KELUARGA DAN RENCANA AKSI DALAM PENCEGAHAN DAN PENANGANAN STUNTING', sesi: 'Sesi 14. Mendukung keluarga Mengakses Sistem Rujukan Untuk Penanganan Anak Stunting' },
  { id: 'p2k229', modul: 'MODUL 8: PEMETAAN POTENSI KELUARGA DAN RENCANA AKSI DALAM PENCEGAHAN DAN PENANGANAN STUNTING', sesi: 'Sesi 15. Komitmen Melaksanakan rencana Tindak Lanjut' }
];

export function getUniqueModulP2K2(): string[] {
  const moduls: string[] = [];
  for (const item of MASTER_P2K2_DATA) {
    if (!moduls.includes(item.modul)) {
      moduls.push(item.modul);
    }
  }
  return moduls;
}

export function getSesiByModul(modul: string): string[] {
  return MASTER_P2K2_DATA
    .filter(item => item.modul === modul)
    .map(item => item.sesi);
}

