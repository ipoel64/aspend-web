/**
 * VERKOM (Verifikasi Komitmen PKH) CSV Parser
 * Digunakan untuk membaca dan mengekstrak data dari berkas CSV Form Verifikasi Komitmen Pendidikan PKH Kemensos.
 * Porting langsung dari rhk_agent_mobile/lib/screens/verkom/verkom_tools_screen.dart
 */

export interface VerkomMetadata {
  title: string;
  npsn: string;
  schoolName: string;
  month1: string;
  month2: string;
  month3: string;
}

export interface VerkomRow {
  no: string;
  nikPengurus: string;
  namaPengurus: string;
  nikSiswa: string;
  nisn: string;
  namaSiswa: string;
  bentukPendidikan: string;
  tingkatPendidikan: string;
  // Month 1
  m1Alpa: string;
  m1Izin: string;
  m1Sakit: string;
  m1Jml: string;
  m1Persen: string;
  // Month 2
  m2Alpa: string;
  m2Izin: string;
  m2Sakit: string;
  m2Jml: string;
  m2Persen: string;
  // Month 3
  m3Alpa: string;
  m3Izin: string;
  m3Sakit: string;
  m3Jml: string;
  m3Persen: string;
  ket: string;
  namaPendamping: string;
}

export interface VerkomParseResult {
  metadata: VerkomMetadata;
  rows: VerkomRow[];
  rawRows: string[][];
  totalRecords: number;
}

const INDO_MONTH_NAMES = [
  'JANUARI', 'FEBRUARI', 'PEBRUARI', 'MARET',
  'APRIL', 'MEI', 'JUNI', 'JULI',
  'AGUSTUS', 'SEPTEMBER', 'OKTOBER',
  'NOVEMBER', 'NOPEMBER', 'DESEMBER'
];

/**
 * Parsing teks CSV dengan dukungan karakter kutip ganda dan delimiter koma/titik koma
 */
export function parseCsvText(csvText: string): string[][] {
  let input = csvText;

  // 1. Bersihkan UTF-8 Byte Order Mark (BOM) jika ada
  if (input.charCodeAt(0) === 0xFEFF) {
    input = input.slice(1);
  }

  // 2. Normalisasi line endings ke LF (\n)
  input = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Bersihkan direktif 'sep=' milik Excel di baris awal
  const trimmedLeft = input.trimStart();
  if (trimmedLeft.toLowerCase().startsWith('sep=')) {
    const firstNewline = input.indexOf('\n');
    if (firstNewline !== -1) {
      input = input.slice(firstNewline + 1);
    }
  }

  // 4. Deteksi delimiter: jika mengandung ';' lebih banyak dari ',', gunakan ';'
  // Sesuai mobile: input.contains(';') ? ';' : ','
  const delimiter = input.includes(';') ? ';' : ',';

  // 5. Tokenizer RFC 4180
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote: ""
        currentField += '"';
        i++; // lewati kutip kedua
      } else {
        // Toggle status di dalam kutip
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentField.trim());
      // Tambahkan baris jika tidak seluruhnya kosong
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Push field dan baris terakhir jika ada
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Ekstraksi metadata dan baris data terstruktur dari CSV VERKOM
 */
export function extractVerkomData(rawRows: string[][]): VerkomParseResult {
  let title = 'FORM VERIFIKASI KOMITMEN PENDIDIKAN';
  let npsn = 'NPSN :';
  let schoolName = 'Nama Sekolah :';

  // 1. Ekstraksi Judul, NPSN, dan Nama Sekolah dari 6 baris pertama
  for (let i = 0; i < rawRows.length && i < 6; i++) {
    const row = rawRows[i];
    const rowStr = row.map(e => e?.toString() || '').join(' ');
    const upper = rowStr.toUpperCase();

    if (upper.includes('FORM VERIFIKASI')) {
      title = rowStr.trim();
    } else if (upper.includes('NPSN')) {
      npsn = rowStr.trim();
    } else if (upper.includes('NAMA SEKOLAH')) {
      schoolName = rowStr.trim();
    }
  }

  // Bersihkan tanda titik dua ganda '::' atau ': :'
  npsn = npsn.replace(/::/g, ':').replace(/:\s*:/g, ':').trim();
  schoolName = schoolName.replace(/::/g, ':').replace(/:\s*:/g, ':').trim();

  // 2. Deteksi 3 Nama Bulan secara Dinamis dari baris Header NIK PENGURUS
  let month1 = 'APRIL';
  let month2 = 'MEI';
  let month3 = 'JUNI';

  for (const row of rawRows) {
    const rowStr = row.join(' ').toUpperCase();
    if (rowStr.includes('NIK PENGURUS') && rowStr.includes('NAMA PENGURUS')) {
      const detectedMonths: string[] = [];
      for (const cell of row) {
        const cellStr = cell?.toString().trim() || '';
        const upper = cellStr.toUpperCase();
        if (INDO_MONTH_NAMES.includes(upper)) {
          detectedMonths.push(cellStr);
        }
      }
      if (detectedMonths.length >= 3) {
        month1 = detectedMonths[0];
        month2 = detectedMonths[1];
        month3 = detectedMonths[2];
        break;
      }
    }
  }

  // 3. Filter baris data yang valid (bukan header atau baris kosong)
  const filteredData = rawRows.filter(row => {
    if (row.length < 10) return false;

    const rowStr = row.join(' ').toUpperCase();
    if (
      rowStr.includes('NIK PENGURUS') ||
      rowStr.includes('NAMA PENGURUS') ||
      rowStr.includes('TINGKAT PENDIDIKAN') ||
      rowStr.includes('HARI EFEKTIF') ||
      rowStr.includes('ALPA') ||
      rowStr.includes('IZIN') ||
      rowStr.includes('SAKIT')
    ) {
      return false;
    }

    // Lewati baris jika Nama Pengurus (index 2) dan Nama Siswa (index 5) dua-duanya kosong
    if (row.length > 5) {
      const namaPengurus = (row[2] || '').toString().trim();
      const namaSiswa = (row[5] || '').toString().trim();
      if (!namaPengurus && !namaSiswa) {
        return false;
      }
    }

    return true;
  });

  // 4. Petakan ke VerkomRow dengan padding minimal 25 kolom
  const rows: VerkomRow[] = filteredData.map((row, idx) => {
    const padded = [...row];
    while (padded.length < 25) {
      padded.push('');
    }

    const noVal = (padded[0] || '').toString().trim();

    return {
      no: noVal || (idx + 1).toString(),
      nikPengurus: (padded[1] || '').toString().trim(),
      namaPengurus: (padded[2] || '').toString().trim(),
      nikSiswa: (padded[3] || '').toString().trim(),
      nisn: (padded[4] || '').toString().trim(),
      namaSiswa: (padded[5] || '').toString().trim(),
      bentukPendidikan: (padded[6] || '').toString().trim(),
      tingkatPendidikan: (padded[7] || '').toString().trim(),
      m1Alpa: (padded[8] || '').toString().trim(),
      m1Izin: (padded[9] || '').toString().trim(),
      m1Sakit: (padded[10] || '').toString().trim(),
      m1Jml: (padded[11] || '').toString().trim(),
      m1Persen: (padded[12] || '').toString().trim(),
      m2Alpa: (padded[13] || '').toString().trim(),
      m2Izin: (padded[14] || '').toString().trim(),
      m2Sakit: (padded[15] || '').toString().trim(),
      m2Jml: (padded[16] || '').toString().trim(),
      m2Persen: (padded[17] || '').toString().trim(),
      m3Alpa: (padded[18] || '').toString().trim(),
      m3Izin: (padded[19] || '').toString().trim(),
      m3Sakit: (padded[20] || '').toString().trim(),
      m3Jml: (padded[21] || '').toString().trim(),
      m3Persen: (padded[22] || '').toString().trim(),
      ket: (padded[23] || '').toString().trim(),
      namaPendamping: (padded[24] || '').toString().trim(),
    };
  });

  return {
    metadata: {
      title,
      npsn,
      schoolName,
      month1,
      month2,
      month3,
    },
    rows,
    rawRows,
    totalRecords: rows.length,
  };
}
