/**
 * Utilitas pemformatan teks resmi aplikasi ASPEND Web
 */

/**
 * Mengubah string menjadi format Capitalize Each Word (Title Case)
 * Mempertahankan akronim resmi, angka Romawi, dan singkatan Kemensos/Wilayah.
 * 
 * Contoh:
 * - "SUMATERA UTARA" -> "Sumatera Utara"
 * - "KOTA BINJAI" -> "Kota Binjai"
 * - "BINJAI UTARA" -> "Binjai Utara"
 * - "PAYA ROBA" -> "Paya Roba"
 * - "DKI JAKARTA" -> "DKI Jakarta"
 * - "DUSUN II" -> "Dusun II"
 * - "SEI-BINGAI" -> "Sei-Bingai"
 */
export function capitalizeEachWord(str?: string | null): string {
  if (!str) return '-';
  const trimmed = str.trim();
  if (!trimmed || trimmed === '-') return '-';

  // Akronim resmi & Angka Romawi yang wajib tetap huruf kapital (uppercase)
  const preserveUpper = new Set([
    'DKI', 'DI', 'D.I.', 'UPT', 'PKH', 'KPM', 'P2K2', 'WIB', 'WITA', 'WIT',
    'RT', 'RW', 'SD', 'SMP', 'SMA', 'SMK', 'TKSK', 'NIP', 'KTP', 'KK',
    'PPSE', 'DPR', 'APBN', 'APBD', 'I', 'II', 'III', 'IV', 'V', 'VI',
    'VII', 'VIII', 'IX', 'X', 'XI', 'XII'
  ]);

  return trimmed
    .split(/\s+/)
    .map(word => {
      // Tangani kata yang mengandung tanda hubung (-) misalnya "SEI-BINGAI"
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => capitalizeWordToken(part, preserveUpper))
          .join('-');
      }
      // Tangani kata yang mengandung garis miring (/) misalnya "KAB/KOTA"
      if (word.includes('/')) {
        return word
          .split('/')
          .map(part => capitalizeWordToken(part, preserveUpper))
          .join('/');
      }
      return capitalizeWordToken(word, preserveUpper);
    })
    .join(' ');
}

function capitalizeWordToken(token: string, preserveUpper: Set<string>): string {
  if (!token) return '';
  const clean = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (preserveUpper.has(clean)) {
    return token.toUpperCase();
  }
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}
