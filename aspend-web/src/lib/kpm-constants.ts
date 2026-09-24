// Data Keluarga KPM
export interface KpmKeluarga {
  KpmId: string;
  NIK: string;
  NoKK: string;
  NamaPengurus: string;
  Alamat: string;
  Lingkungan: string;
  Provinsi: string;
  KabKota: string;
  Kecamatan: string;
  Kelurahan: string;
  NoHP: string;
  Kelompok: string;
  StatusKelompok: string; // 'Ketua Kelompok' | 'Anggota'
  FotoKTP: string; // Drive File ID
  FotoKK: string;
  FotoBukuTabungan: string;
  FotoKKS: string;
  CatatanTemuan: string; // JSON array string
  Pernyataan: string;
  Password: string; // default '123456'
  StatusData: string; // 'Lengkap' | 'Belum Lengkap' | 'Verifikasi'
  CreatedAt: string;
  UpdatedAt: string;
  StatusKepesertaan?: 'Aktif' | 'Tidak Aktif' | 'Graduasi' | string;
  TahapBansos?: string;
  FotoBuktiCatatan?: string;
  FotoRumah?: string;
  FotoRumahLuar?: string;
  FotoRumahDalam?: string;
  StatusGraduasi?: string;
  AnggotaCount?: number;
  IsAnggotaLengkap?: boolean;
  AnggotaMissing?: string;
  HasAset?: boolean;
  IsAsetLengkap?: boolean;
  AsetMissing?: string;
  IsKpmLengkap?: boolean;
  CompletenessPercent?: number;
  AnggotaList?: KpmAnggota[];
  HasDuplicateAnggotaNik?: boolean;
  DuplicateAnggotaNiks?: string[];
  IsDuplicateNik?: boolean;
  IsDuplicateKK?: boolean;
  IsScientificNik?: boolean;
  IsScientificKK?: boolean;
}

// Data Anggota Keluarga
export interface KpmAnggota {
  AnggotaId: string;
  NoKK: string; // FK to KpmKeluarga
  NIK: string;
  Nama: string;
  JenisKelamin: string;
  TanggalLahir: string;
  Komponen: string;
  HubunganKeluarga: string;
  Posyandu: string;
  Sekolah: string;
  Kelas: string;
  Pekerjaan: string;
  Keterangan: string;
  CreatedAt: string;
  IsDuplicateNik?: boolean;
  DuplicateCount?: number;
}

// Data Aset
export interface KpmAset {
  AsetId: string;
  NoKK: string; // FK to KpmKeluarga
  StatusRumah: string;
  Usaha: string;
  JenisUsaha: string;
  FotoUsaha: string;
  FotoRumahLuar: string;
  FotoRumahDalam: string;
  Latitude: string;
  Longitude: string;
  TahunMenerimaBansos: string;
  Keterangan: string;
  CreatedAt: string;
}

// Data Graduasi
export interface KpmGraduasi {
  GraduasiId: string;
  NoKK: string;
  StatusGraduasi: string;
  TanggalGraduasi: string;
  AlasanGraduasi: string;
  IndeksKesejahteraan: string;
  BantuanTerakhir: string;
  PenghasilanPerBulan: string;
  SuratPengunduranDiri: string;
  StatusPPSE: string;
  Catatan: string;
  CreatedAt: string;
}

// Data Permasalahan
export interface KpmPermasalahan {
  MasalahId: string;
  NoKK: string;
  JenisMasalah: string;
  Deskripsi: string;
  Prioritas: string;
  Status: string;
  FotoBukti: string;
  TindakLanjut: string;
  TanggalTindakLanjut: string;
  CreatedAt: string;
}

// ==========================================
// 2. Sheet Names & Column Mappings
// ==========================================

export const KPM_SHEET_KELUARGA = 'KPM_Keluarga';
export const KPM_SHEET_ANGGOTA = 'KPM_Anggota';
export const KPM_SHEET_ASET = 'KPM_Aset';
export const KPM_SHEET_GRADUASI = 'KPM_Graduasi';
export const KPM_SHEET_PERMASALAHAN = 'KPM_Permasalahan';
export const KPM_SHEET_PORTAL = 'KPM_Portal';

export const KPM_KELUARGA_HEADERS = [
  'KpmId',
  'NIK',
  'NoKK',
  'NamaPengurus',
  'Alamat',
  'Lingkungan',
  'Provinsi',
  'KabKota',
  'Kecamatan',
  'Kelurahan',
  'NoHP',
  'Kelompok',
  'StatusKelompok',
  'FotoKTP',
  'FotoKK',
  'FotoBukuTabungan',
  'FotoKKS',
  'CatatanTemuan',
  'Pernyataan',
  'Password',
  'StatusData',
  'CreatedAt',
  'UpdatedAt',
  'StatusKepesertaan',
  'TahapBansos',
  'FotoBuktiCatatan',
  'FotoRumah',
];
export const KPM_ANGGOTA_HEADERS = ['AnggotaId', 'NoKK', 'NIK', 'Nama', 'JenisKelamin', 'TanggalLahir', 'Komponen', 'HubunganKeluarga', 'Posyandu', 'Sekolah', 'Kelas', 'Pekerjaan', 'Keterangan', 'CreatedAt'];
export const KPM_ASET_HEADERS = ['AsetId', 'NoKK', 'StatusRumah', 'Usaha', 'JenisUsaha', 'FotoUsaha', 'FotoRumahLuar', 'FotoRumahDalam', 'Latitude', 'Longitude', 'TahunMenerimaBansos', 'Keterangan', 'CreatedAt'];
export const KPM_GRADUASI_HEADERS = ['GraduasiId', 'NoKK', 'StatusGraduasi', 'TanggalGraduasi', 'AlasanGraduasi', 'IndeksKesejahteraan', 'BantuanTerakhir', 'PenghasilanPerBulan', 'SuratPengunduranDiri', 'StatusPPSE', 'Catatan', 'CreatedAt'];
export const KPM_PERMASALAHAN_HEADERS = ['MasalahId', 'NoKK', 'JenisMasalah', 'Deskripsi', 'Prioritas', 'Status', 'FotoBukti', 'TindakLanjut', 'TanggalTindakLanjut', 'CreatedAt'];

// ==========================================
// 3. Dropdown Options
// ==========================================

export const STATUS_KEPESERTAAN_OPTIONS = ['Aktif', 'Tidak Aktif', 'Graduasi'];
export const TAHAP_BANSOS_OPTIONS = [
  'Tahap 1 (2026)',
  'Tahap 2 (2026)',
  'Tahap 3 (2026)',
  'Tahap 4 (2026)',
];

export const STATUS_KELOMPOK_OPTIONS = ['Ketua Kelompok', 'Anggota'];
export const KOMPONEN_OPTIONS = ['Balita', 'Ibu Hamil', 'Anak SD', 'Anak SMP', 'Anak SMA', 'Disabilitas Berat', 'Lansia'];
export const HUBUNGAN_KELUARGA_OPTIONS = ['Kepala Keluarga', 'Suami/Istri', 'Anak', 'Orang Tua', 'Famili Lain'];
export const JENIS_KELAMIN_OPTIONS = ['Laki-laki', 'Perempuan'];
export const STATUS_RUMAH_OPTIONS = ['Milik Sendiri', 'Milik Dinas', 'Milik Kebon', 'Numpang', 'Sewa/Kontrak'];
export const USAHA_OPTIONS = ['Memiliki Usaha', 'Tidak Memiliki Usaha'];
export const STATUS_GRADUASI_OPTIONS = ['Belum Graduasi', 'Proses Graduasi', 'Sudah Graduasi', 'Graduasi Mandiri', 'Graduasi Alami'];
export const ALASAN_GRADUASI_OPTIONS = ['Ekonomi Membaik', 'Penghasilan Di Atas UMK', 'Kepesertaan > 5 Tahun', 'ASN/TNI/POLRI/BUMN/BUMD', 'Lainnya'];
export const STATUS_PPSE_OPTIONS = ['Belum PPSE', 'Calon PPSE', 'Sudah PPSE'];
export const CATATAN_TEMUAN_OPTIONS = ['Sudah Graduasi', 'Sudah PPSE', 'Calon PPSE', 'Rumah Tidak Layak Huni', 'Sudah Mampu', 'Memiliki Kendaraan Mewah'];
export const JENIS_MASALAH_OPTIONS = ['Data Tidak Sesuai', 'Penerima Ganda', 'Sudah Mampu', 'Meninggal Dunia', 'Pindah Domisili', 'Tidak Dapat Ditemui', 'Menolak Bantuan', 'Kendaraan Mewah', 'Rumah Tidak Layak Huni', 'Anak Putus Sekolah', 'Lainnya'];
export const PRIORITAS_OPTIONS = ['Rendah', 'Sedang', 'Tinggi', 'Kritis'];
export const STATUS_MASALAH_OPTIONS = ['Terbuka', 'Dalam Proses', 'Ditindaklanjuti', 'Selesai'];
export const STATUS_DATA_OPTIONS = ['Lengkap', 'Belum Lengkap', 'Verifikasi'];

export const PERNYATAAN_OPTIONS = [
  'Saya dengan penuh kesadaran menyatakan masih tergolong keluarga miskin dan bersedia mengikuti kewajiban sebagai penerima PKH serta pelabelan status keluarga miskin pada dinding rumah',
  'Saya dengan penuh kesadaran menyatakan keluar dari kepesertaan PKH karena ekonomi saya sudah baik dan bersedia menandatangani surat pengunduran diri dari kepesertaan PKH',
  'Saya dengan penuh kesadaran menyatakan keluar dari kepesertaan PKH karena saya sudah menjadi peserta PKH lebih dari 5 Tahun dan bersedia menandatangani surat pengunduran diri dari kepesertaan PKH',
  'Saya dengan penuh kesadaran menyatakan keluar dari kepesertaan PKH karena Penghasilan saya sudah diatas UMK dan bersedia menandatangani surat pengunduran diri dari kepesertaan PKH',
  'Saya dengan penuh kesadaran menyatakan keluar dari kepesertaan PKH karena saya atau anggota keluarga saya ada yang berstatus ASN/TNI/POLRI/BUMN/BUMD dan bersedia menandatangani surat pengunduran diri dari kepesertaan PKH'
];

// ==========================================
// 4. Helper Functions
// ==========================================

let globalIdCounter = 0;

function formatDateId(): string {
  const now = new Date();
  // Format: YYYYMMDD-HHmmss
  const base = now.toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/^(\d{8})(\d+)/, '$1-$2');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  globalIdCounter = (globalIdCounter + 1) % 10000;
  const seq = String(globalIdCounter).padStart(4, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}-${ms}${seq}-${rand}`;
}

export function generateKpmId(customSuffix?: string | number): string { 
  if (customSuffix !== undefined) {
    const now = new Date();
    const base = now.toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/^(\d{8})(\d+)/, '$1-$2');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `KPM-${base}-${String(customSuffix).padStart(3, '0')}-${rand}`;
  }
  return `KPM-${formatDateId()}`; 
}

export function generateAnggotaId(seq: number): string { 
  return `ANG-${formatDateId()}-${String(seq).padStart(2, '0')}`; 
}

export function generateAsetId(): string { 
  return `AST-${formatDateId()}`; 
}

export function generateGraduasiId(): string { 
  return `GRD-${formatDateId()}`; 
}

export function generateMasalahId(): string { 
  return `MSL-${formatDateId()}`; 
}

/**
 * Format sel teks agar Google Sheets USER_ENTERED memperlakukannya sebagai teks murni (literal string)
 * dan tidak otomatis mengubah nomor 16 digit (NIK / No. KK) atau nomor telepon (+62...) menjadi notasi ilmiah (1,21E+15) atau formula (=+62...)
 */
export function formatTextCell(val: any): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str) return '';
  if (str.startsWith("'")) return str;
  return `'${str}`;
}

/**
 * Membersihkan prefix apostrof tunggal (') jika ada saat membaca sel dari Google Sheets,
 * dan mengonversi tipe number atau string notasi ilmiah (misal 1,27503E+15) menjadi string digit penuh.
 */
export function cleanTextCell(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'number') {
    if (isFinite(val) && val >= 1e9) {
      return BigInt(Math.round(val)).toString();
    }
    return String(val);
  }
  let str = String(val).trim();
  if (str.startsWith("'")) {
    str = str.slice(1).trim();
  }
  // Jika tersimpan dalam notasi ilmiah Excel/Google Sheets (misal 1,27503E+15 atau 1.27503E+15)
  if (/e[+-]?\d+/i.test(str)) {
    try {
      const normalized = str.replace(',', '.');
      const num = Number(normalized);
      if (!isNaN(num) && isFinite(num)) {
        str = BigInt(Math.round(num)).toString();
      }
    } catch {}
  }
  return str;
}

/**
 * Format nomor telepon Indonesia agar selalu diawali kode negara (+62) sebelum angka 8.
 * Contoh:
 * - 083151658433  -> +6283151658433
 * - 83151658433   -> +6283151658433
 * - +6283151658433-> +6283151658433
 * - 6283151658433 -> +6283151658433
 * - 0812-3456-7890-> +6281234567890
 */
export function formatIndonesianPhone(phone: any): string {
  if (!phone) return '';
  let str = String(phone).trim();
  if (!str) return '';

  if (str.startsWith("'")) str = str.slice(1).trim();

  const digits = str.replace(/\D/g, '');
  if (!digits || digits.length < 5) return str;

  if (digits.startsWith('628')) {
    return `+${digits}`;
  }
  if (digits.startsWith('08')) {
    return `+62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `+62${digits}`;
  }
  if (digits.startsWith('62')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+62${digits.slice(1)}`;
  }

  return `+62${digits}`;
}

// Parse sheet row array to typed object
export function parseKeluargaRow(row: string[]): KpmKeluarga {
  return {
    KpmId: cleanTextCell(row[0]),
    NIK: cleanTextCell(row[1]),
    NoKK: cleanTextCell(row[2]),
    NamaPengurus: cleanTextCell(row[3]),
    Alamat: cleanTextCell(row[4]),
    Lingkungan: cleanTextCell(row[5]),
    Provinsi: cleanTextCell(row[6]),
    KabKota: cleanTextCell(row[7]),
    Kecamatan: cleanTextCell(row[8]),
    Kelurahan: cleanTextCell(row[9]),
    NoHP: formatIndonesianPhone(cleanTextCell(row[10])),
    Kelompok: cleanTextCell(row[11]),
    StatusKelompok: cleanTextCell(row[12]),
    FotoKTP: cleanTextCell(row[13]),
    FotoKK: cleanTextCell(row[14]),
    FotoBukuTabungan: cleanTextCell(row[15]),
    FotoKKS: cleanTextCell(row[16]),
    CatatanTemuan: cleanTextCell(row[17]),
    Pernyataan: cleanTextCell(row[18]),
    Password: cleanTextCell(row[19]),
    StatusData: cleanTextCell(row[20]),
    CreatedAt: cleanTextCell(row[21]),
    UpdatedAt: cleanTextCell(row[22]),
    StatusKepesertaan: cleanTextCell(row[23]) || 'Aktif',
    TahapBansos: cleanTextCell(row[24]) || 'Tahap 1 (2026)',
    FotoBuktiCatatan: cleanTextCell(row[25]) || '',
    FotoRumah: cleanTextCell(row[26]) || '',
  };
}

export function parseAnggotaRow(row: string[]): KpmAnggota {
  return {
    AnggotaId: cleanTextCell(row[0]),
    NoKK: cleanTextCell(row[1]),
    NIK: cleanTextCell(row[2]),
    Nama: cleanTextCell(row[3]),
    JenisKelamin: cleanTextCell(row[4]),
    TanggalLahir: cleanTextCell(row[5]),
    Komponen: cleanTextCell(row[6]),
    HubunganKeluarga: cleanTextCell(row[7]),
    Posyandu: cleanTextCell(row[8]),
    Sekolah: cleanTextCell(row[9]),
    Kelas: cleanTextCell(row[10]),
    Pekerjaan: cleanTextCell(row[11]),
    Keterangan: cleanTextCell(row[12]),
    CreatedAt: cleanTextCell(row[13]),
  };
}

export function parseAsetRow(row: string[]): KpmAset {
  return {
    AsetId: cleanTextCell(row[0]),
    NoKK: cleanTextCell(row[1]),
    StatusRumah: cleanTextCell(row[2]),
    Usaha: cleanTextCell(row[3]),
    JenisUsaha: cleanTextCell(row[4]),
    FotoUsaha: cleanTextCell(row[5]),
    FotoRumahLuar: cleanTextCell(row[6]),
    FotoRumahDalam: cleanTextCell(row[7]),
    Latitude: cleanTextCell(row[8]),
    Longitude: cleanTextCell(row[9]),
    TahunMenerimaBansos: cleanTextCell(row[10]),
    Keterangan: cleanTextCell(row[11]),
    CreatedAt: cleanTextCell(row[12]),
  };
}

export function parseGraduasiRow(row: string[]): KpmGraduasi {
  return {
    GraduasiId: cleanTextCell(row[0]),
    NoKK: cleanTextCell(row[1]),
    StatusGraduasi: cleanTextCell(row[2]),
    TanggalGraduasi: cleanTextCell(row[3]),
    AlasanGraduasi: cleanTextCell(row[4]),
    IndeksKesejahteraan: cleanTextCell(row[5]),
    BantuanTerakhir: cleanTextCell(row[6]),
    PenghasilanPerBulan: cleanTextCell(row[7]),
    SuratPengunduranDiri: cleanTextCell(row[8]),
    StatusPPSE: cleanTextCell(row[9]),
    Catatan: cleanTextCell(row[10]),
    CreatedAt: cleanTextCell(row[11]),
  };
}

export function parsePermasalahanRow(row: string[]): KpmPermasalahan {
  return {
    MasalahId: cleanTextCell(row[0]),
    NoKK: cleanTextCell(row[1]),
    JenisMasalah: cleanTextCell(row[2]),
    Deskripsi: cleanTextCell(row[3]),
    Prioritas: cleanTextCell(row[4]),
    Status: cleanTextCell(row[5]),
    FotoBukti: cleanTextCell(row[6]),
    TindakLanjut: cleanTextCell(row[7]),
    TanggalTindakLanjut: cleanTextCell(row[8]),
    CreatedAt: cleanTextCell(row[9]),
  };
}

// Convert typed object to sheet row array (for writing)
export function keluargaToRow(data: KpmKeluarga): string[] {
  return [
    data.KpmId || '',
    formatTextCell(data.NIK),
    formatTextCell(data.NoKK),
    data.NamaPengurus || '',
    data.Alamat || '',
    data.Lingkungan || '',
    data.Provinsi || '',
    data.KabKota || '',
    data.Kecamatan || '',
    data.Kelurahan || '',
    formatTextCell(formatIndonesianPhone(data.NoHP)),
    data.Kelompok || '',
    data.StatusKelompok || '',
    data.FotoKTP || '',
    data.FotoKK || '',
    data.FotoBukuTabungan || '',
    data.FotoKKS || '',
    data.CatatanTemuan || '[]',
    data.Pernyataan || '',
    data.Password || '123456',
    data.StatusData || '',
    data.CreatedAt || '',
    data.UpdatedAt || '',
    data.StatusKepesertaan || 'Aktif',
    data.TahapBansos || 'Tahap 1 (2026)',
    data.FotoBuktiCatatan || '',
    data.FotoRumah || '',
  ];
}

export function anggotaToRow(data: KpmAnggota): string[] {
  return [
    data.AnggotaId || '',
    formatTextCell(data.NoKK),
    formatTextCell(data.NIK),
    data.Nama || '',
    data.JenisKelamin || '',
    data.TanggalLahir || '',
    data.Komponen || '',
    data.HubunganKeluarga || '',
    data.Posyandu || '',
    data.Sekolah || '',
    data.Kelas || '',
    data.Pekerjaan || '',
    data.Keterangan || '',
    data.CreatedAt || '',
  ];
}

export function asetToRow(data: KpmAset): string[] {
  return [
    data.AsetId || '',
    formatTextCell(data.NoKK),
    data.StatusRumah || '',
    data.Usaha || '',
    data.JenisUsaha || '',
    data.FotoUsaha || '',
    data.FotoRumahLuar || '',
    data.FotoRumahDalam || '',
    data.Latitude || '',
    data.Longitude || '',
    data.TahunMenerimaBansos || '',
    data.Keterangan || '',
    data.CreatedAt || '',
  ];
}

export function graduasiToRow(data: KpmGraduasi): string[] {
  return [
    data.GraduasiId || '',
    formatTextCell(data.NoKK),
    data.StatusGraduasi || '',
    data.TanggalGraduasi || '',
    data.AlasanGraduasi || '',
    data.IndeksKesejahteraan || '',
    data.BantuanTerakhir || '',
    data.PenghasilanPerBulan || '',
    data.SuratPengunduranDiri || '',
    data.StatusPPSE || '',
    data.Catatan || '',
    data.CreatedAt || '',
  ];
}

export function permasalahanToRow(data: KpmPermasalahan): string[] {
  return [
    data.MasalahId || '',
    formatTextCell(data.NoKK),
    data.JenisMasalah || '',
    data.Deskripsi || '',
    data.Prioritas || '',
    data.Status || '',
    data.FotoBukti || '',
    data.TindakLanjut || '',
    data.TanggalTindakLanjut || '',
    data.CreatedAt || '',
  ];
}

// Validate NIK (16 digits)
export function validateNIK(nik: string): boolean {
  return /^\d{16}$/.test(nik);
}

// Validate No KK (16 digits)
export function validateNoKK(noKK: string): boolean {
  return /^\d{16}$/.test(noKK);
}

/**
 * Normalisasi No. KK yang tahan terhadap format notasi ilmiah Excel (misal 1,21E+15 atau 1.21E+15)
 */
export function normalizeKK(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  if (/e[+-]?\d+/i.test(str)) {
    try {
      const normalized = str.replace(',', '.');
      const num = Number(normalized);
      if (!isNaN(num) && isFinite(num)) {
        str = BigInt(Math.round(num)).toString();
      }
    } catch {}
  }
  return str.replace(/\D/g, '');
}

/**
 * Mengecek apakah satu baris Data Anggota Keluarga sudah lengkap
 */
export function isSingleAnggotaLengkap(ang: Partial<KpmAnggota>): boolean {
  if (!ang) return false;
  if (!ang.NIK?.trim() || !/^\d{16}$/.test(ang.NIK.trim())) return false;
  if (!ang.Nama?.trim()) return false;
  if (!ang.JenisKelamin?.trim()) return false;
  if (!ang.TanggalLahir?.trim()) return false;
  if (!ang.Komponen?.trim()) return false;
  if (!ang.HubunganKeluarga?.trim()) return false;

  // Kondisional Posyandu (Balita / Ibu Hamil)
  const isPosyandu = ang.Komponen === 'Balita' || ang.Komponen === 'Ibu Hamil';
  if (isPosyandu && !ang.Posyandu?.trim()) return false;

  // Kondisional Sekolah & Kelas (Anak SD / SMP / SMA)
  const isSekolah =
    ang.Komponen === 'Anak SD' ||
    ang.Komponen === 'Anak SMP' ||
    ang.Komponen === 'Anak SMA';
  if (isSekolah && (!ang.Sekolah?.trim() || !ang.Kelas?.trim())) return false;

  // Kondisional Pekerjaan (Kepala Keluarga / Suami/Istri)
  const isPekerjaan =
    ang.HubunganKeluarga === 'Kepala Keluarga' ||
    ang.HubunganKeluarga === 'Suami/Istri';
  if (isPekerjaan && !ang.Pekerjaan?.trim()) return false;

  return true;
}

/**
 * Mengecek apakah seluruh Data Anggota Keluarga dari suatu KPM lengkap
 * (Belum lengkap jika belum ada anggota atau ada salah satu anggota yang belum lengkap datanya)
 */
export function isKpmAnggotaLengkap(
  anggotaList: KpmAnggota[] | undefined | null
): { isLengkap: boolean; count: number; missingReason: string } {
  const count = anggotaList?.length || 0;
  if (!anggotaList || count === 0) {
    return { isLengkap: false, count: 0, missingReason: 'Belum ada anggota keluarga' };
  }

  // Sesuai permintaan user: apabila sudah ada minimal 1 anggota keluarga maka dianggap lengkap
  return { isLengkap: true, count, missingReason: '' };
}

/**
 * Mengecek apakah Data Aset & Lokasi KPM lengkap
 * (Belum lengkap jika belum ada data aset atau ada field wajib/foto dokumen yang kosong)
 */
export function isKpmAsetLengkap(
  aset: Partial<KpmAset> | null | undefined
): { isLengkap: boolean; hasRecord: boolean; missingReason: string } {
  if (!aset || (!aset.AsetId && !aset.StatusRumah && !aset.FotoRumahLuar)) {
    return { isLengkap: false, hasRecord: false, missingReason: 'Belum ada data aset' };
  }

  const missing: string[] = [];
  if (!aset.StatusRumah?.trim()) missing.push('Status Rumah');
  if (!aset.FotoRumahLuar?.trim()) missing.push('Foto Luar');
  if (!aset.FotoRumahDalam?.trim()) missing.push('Foto Dalam');
  if (!aset.Latitude?.trim() || !aset.Longitude?.trim()) missing.push('Titik GPS');
  if (!aset.TahunMenerimaBansos?.trim()) missing.push('Tahun Bansos');
  if (!aset.Usaha?.trim()) missing.push('Status Usaha');

  if (aset.Usaha === 'Memiliki Usaha') {
    if (!aset.JenisUsaha?.trim()) missing.push('Jenis Usaha');
    if (!aset.FotoUsaha?.trim()) missing.push('Foto Usaha');
  }

  if (missing.length > 0) {
    return {
      isLengkap: false,
      hasRecord: true,
      missingReason: `Kurang: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? '...' : ''}`,
    };
  }

  return { isLengkap: true, hasRecord: true, missingReason: '' };
}

// Determine status data based on completeness of all 3 pillars
export function calculateStatusData(
  keluarga: KpmKeluarga,
  anggotaListOrCount: KpmAnggota[] | number = 0,
  asetOrBoolean: Partial<KpmAset> | boolean | null = false
): string {
  if (keluarga.StatusData === 'Verifikasi') {
    return 'Verifikasi';
  }

  const details = getKpmCompletenessDetails(keluarga, anggotaListOrCount, asetOrBoolean);
  return details.isAllComplete ? 'Lengkap' : 'Belum Lengkap';
}

/**
 * Mengecek apakah Data Pokok KPM (Keluarga) sudah lengkap sesuai aturan:
 * Belum lengkap apabila salah satu saja dari keseluruhan data (kecuali CatatanTemuan)
 * belum terisi, termasuk foto dokumen (KTP, KK, Tabungan, KKS) dan pernyataan resmi.
 */
export function isKpmDataLengkap(kpm: Partial<KpmKeluarga>): boolean {
  if (!kpm) return false;
  const fields = [
    kpm.NIK,
    kpm.NoKK,
    kpm.NamaPengurus,
    kpm.Alamat,
    kpm.Lingkungan,
    kpm.Provinsi,
    kpm.KabKota,
    kpm.Kecamatan,
    kpm.Kelurahan,
    kpm.NoHP,
    kpm.Kelompok,
    kpm.StatusKelompok,
    kpm.FotoKTP,
    kpm.FotoKK,
    kpm.FotoBukuTabungan,
    kpm.FotoKKS,
    kpm.Pernyataan,
  ];
  return fields.every((f) => f && f.trim() !== '');
}

/**
 * Mendapatkan rincian kelengkapan data keseluruhan KPM (KPM, Anggota, Aset)
 * dan menentukan bagian mana yang perlu dilengkapi secara real-time
 */
export function getKpmCompletenessDetails(
  kpm: Partial<KpmKeluarga>,
  anggotaListOrCount: KpmAnggota[] | number = 0,
  asetOrBoolean: Partial<KpmAset> | boolean | null = false
) {
  const missingBasic: string[] = [];
  if (!kpm.NIK?.trim()) missingBasic.push('NIK');
  if (!kpm.NoKK?.trim()) missingBasic.push('No KK');
  if (!kpm.NamaPengurus?.trim()) missingBasic.push('Nama Pengurus');
  if (!kpm.Alamat?.trim()) missingBasic.push('Alamat');
  if (!kpm.Lingkungan?.trim()) missingBasic.push('Lingkungan');
  if (!kpm.Provinsi?.trim()) missingBasic.push('Provinsi');
  if (!kpm.KabKota?.trim()) missingBasic.push('Kab/Kota');
  if (!kpm.Kecamatan?.trim()) missingBasic.push('Kecamatan');
  if (!kpm.Kelurahan?.trim()) missingBasic.push('Kelurahan');
  if (!kpm.NoHP?.trim()) missingBasic.push('No HP');
  if (!kpm.Kelompok?.trim()) missingBasic.push('Kelompok');
  if (!kpm.StatusKelompok?.trim()) missingBasic.push('Status Kelompok');

  const missingPhotos: string[] = [];
  if (!kpm.FotoKTP?.trim()) missingPhotos.push('KTP');
  if (!kpm.FotoKK?.trim()) missingPhotos.push('KK');
  if (!kpm.FotoBukuTabungan?.trim()) missingPhotos.push('Tabungan');
  if (!kpm.FotoKKS?.trim()) missingPhotos.push('KKS');

  const isMissingPernyataan = !kpm.Pernyataan?.trim();

  const isKpmComplete =
    missingBasic.length === 0 &&
    missingPhotos.length === 0 &&
    !isMissingPernyataan;

  // 2. Evaluasi Pilar Anggota
  let hasAnggota = false;
  let isAnggotaComplete = false;
  let anggotaCount = 0;
  let anggotaMissingSummary = '';

  if (Array.isArray(anggotaListOrCount)) {
    const angRes = isKpmAnggotaLengkap(anggotaListOrCount);
    hasAnggota = angRes.count > 0;
    isAnggotaComplete = angRes.isLengkap;
    anggotaCount = angRes.count;
    anggotaMissingSummary = angRes.missingReason;
  } else {
    anggotaCount = typeof anggotaListOrCount === 'number' ? anggotaListOrCount : kpm.AnggotaCount || 0;
    hasAnggota = anggotaCount > 0;
    isAnggotaComplete = hasAnggota;
    anggotaMissingSummary = hasAnggota ? '' : 'Belum ada anggota keluarga';
  }

  // 3. Evaluasi Pilar Aset
  let hasAsetRecord = false;
  let isAsetComplete = false;
  let asetMissingSummary = '';

  if (asetOrBoolean && typeof asetOrBoolean === 'object') {
    const astRes = isKpmAsetLengkap(asetOrBoolean as KpmAset);
    hasAsetRecord = astRes.hasRecord;
    isAsetComplete = astRes.isLengkap;
    asetMissingSummary = astRes.missingReason;
  } else {
    hasAsetRecord = typeof asetOrBoolean === 'boolean' ? asetOrBoolean : Boolean(kpm.HasAset);
    isAsetComplete = kpm.IsAsetLengkap !== undefined ? kpm.IsAsetLengkap : hasAsetRecord;
    asetMissingSummary = kpm.AsetMissing || (hasAsetRecord ? '' : 'Belum ada aset');
  }

  // Buat ringkasan bagian data KPM yang belum lengkap
  let kpmMissingSummary = '';
  if (!isKpmComplete) {
    const parts: string[] = [];
    if (missingPhotos.length > 0) {
      parts.push(`Foto Dokumen (${missingPhotos.join(', ')})`);
    }
    if (isMissingPernyataan) {
      parts.push('Pernyataan Resmi');
    }
    if (missingBasic.length > 0) {
      parts.push(`Data Pokok (${missingBasic.slice(0, 3).join(', ')}${missingBasic.length > 3 ? '...' : ''})`);
    }
    kpmMissingSummary = parts.join(' & ');
  }

  // Kalkulasi persentase kelengkapan 3 pilar:
  // Pilar 1 (KPM): bobot 34%
  // Pilar 2 (Anggota): bobot 33%
  // Pilar 3 (Aset): bobot 33%
  const totalKpmFields = 17;
  const missingKpmCount = missingBasic.length + missingPhotos.length + (isMissingPernyataan ? 1 : 0);
  const filledKpm = Math.max(0, totalKpmFields - missingKpmCount);
  const kpmScore = Math.round((filledKpm / totalKpmFields) * 34);

  const anggotaScore = isAnggotaComplete ? 33 : hasAnggota ? 15 : 0;
  const asetScore = isAsetComplete ? 33 : hasAsetRecord ? 15 : 0;

  const isAllComplete = isKpmComplete && isAnggotaComplete && isAsetComplete;
  const percentage = isAllComplete ? 100 : Math.min(kpmScore + anggotaScore + asetScore, 99);

  let completedPillars = 0;
  if (isKpmComplete) completedPillars++;
  if (isAnggotaComplete) completedPillars++;
  if (isAsetComplete) completedPillars++;

  return {
    isKpmComplete,
    kpmMissingSummary,
    hasAnggota,
    isAnggotaComplete,
    anggotaCount,
    anggotaMissingSummary,
    hasAset: hasAsetRecord,
    isAsetComplete,
    asetMissingSummary,
    percentage,
    completedPillars,
    isAllComplete,
  };
}
