import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import {
  getSheetData,
  appendSheetData,
  updateSheetRow,
  batchUpdateSheetValues,
  findRowByKey,
} from '@/lib/google-sheets';
import {
  KPM_SHEET_KELUARGA,
  KPM_SHEET_ANGGOTA,
  KPM_SHEET_ASET,
  KPM_KELUARGA_HEADERS,
  KPM_ANGGOTA_HEADERS,
  KPM_ASET_HEADERS,
  generateKpmId,
  generateAnggotaId,
  generateAsetId,
  keluargaToRow,
  parseKeluargaRow,
  anggotaToRow,
  parseAnggotaRow,
  asetToRow,
  parseAsetRow,
  validateNIK,
  validateNoKK,
  KpmKeluarga,
  KpmAnggota,
  KpmAset,
  formatIndonesianPhone,
} from '@/lib/kpm-constants';
import { ensureSheetExists } from '@/lib/kpm-sheets';
import * as XLSX from 'xlsx';

// Pembersih angka NIK & No KK yang tahan terhadap format Excel (scientific, float, leading-zero)
function cleanDigits(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();

  // Tangani format notasi ilmiah Excel (misal 1.27101E+15 atau 1,21E+15)
  if (/e[+-]?\d+/i.test(str)) {
    try {
      const normalized = str.replace(',', '.');
      const num = Number(normalized);
      if (!isNaN(num) && isFinite(num)) {
        str = BigInt(Math.round(num)).toString();
      }
    } catch {
      // Abaikan jika gagal BigInt
    }
  }

  // Hapus semua karakter non-angka
  str = str.replace(/\D/g, '');

  // Jika 15 digit, seringkali akibat angka nol di depan terpotong oleh Excel (misal 0123... jadi 123...)
  if (str.length === 15) {
    str = '0' + str;
  }

  return str;
}

// Pencari nilai kolom yang fleksibel dan cerdas (tahan variasi nama header & case-insensitive)
function extractColumnValue(row: Record<string, any>, possibleKeys: string[]): string {
  const rowKeys = Object.keys(row);

  // 1. Coba pencocokan persis (exact match)
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }

  // 2. Coba pencocokan normalisasi (tanpa spasi, huruf kecil, tanpa tanda kurung/titik)
  const normalizedPossibles = possibleKeys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ''));

  for (const rk of rowKeys) {
    const normRowKey = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const np of normalizedPossibles) {
      if (normRowKey === np || normRowKey.includes(np) || np.includes(normRowKey)) {
        const val = row[rk];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }

  return '';
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized: Sesi login tidak valid' }, { status: 401 });
    }
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet database ASPEND tidak ditemukan di Google Drive' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const target = (formData.get('target') as string) || 'keluarga'; // 'keluarga' | 'anggota' | 'aset'
    const action = (formData.get('action') as string) || 'commit'; // 'preview' | 'commit'
    const mode = (formData.get('mode') as string) || 'skip'; // 'skip' (hanya data baru) | 'overwrite' (timpa data lama)
    const selectedTahap = (formData.get('tahap') as string) || 'Tahap 1 (2026)';

    if (!file) {
      return NextResponse.json({ error: 'File Excel (.xlsx/.xls/.csv) wajib diunggah' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    // Cari sheet yang memiliki data (atau cari nama sheet yang sesuai target)
    let worksheet: XLSX.WorkSheet | null = null;
    for (const sName of workbook.SheetNames) {
      const lower = sName.toLowerCase();
      if (
        (target === 'anggota' && lower.includes('anggota')) ||
        (target === 'aset' && (lower.includes('aset') || lower.includes('rumah'))) ||
        (target === 'keluarga' && (lower.includes('keluarga') || lower.includes('kpm')))
      ) {
        worksheet = workbook.Sheets[sName];
        break;
      }
    }

    // Jika tidak ada sheet bertarget khusus, ambil sheet pertama yang ada isinya
    if (!worksheet) {
      for (const sName of workbook.SheetNames) {
        const ws = workbook.Sheets[sName];
        const testJson = XLSX.utils.sheet_to_json(ws);
        if (testJson.length > 0) {
          worksheet = ws;
          break;
        }
      }
    }

    if (!worksheet) {
      worksheet = workbook.Sheets[workbook.SheetNames[0]];
    }

    if (!worksheet) {
      return NextResponse.json({ error: 'File Excel tidak memiliki lembar kerja (sheet) yang dapat dibaca' }, { status: 400 });
    }

    // Pra-proses sel worksheet Excel agar angka 16 digit (NIK / No. KK) tidak terpotong menjadi notasi ilmiah (misal 1,27503E+15)
    for (const cellAddr in worksheet) {
      if (cellAddr.startsWith('!')) continue;
      const cell = worksheet[cellAddr];
      if (!cell) continue;

      if (cell.t === 'n' && typeof cell.v === 'number') {
        if (cell.v >= 1e11 || (cell.w && /e[+-]?\d+/i.test(cell.w))) {
          const fullDigits = BigInt(Math.round(cell.v)).toString();
          cell.t = 's';
          cell.v = fullDigits;
          cell.w = fullDigits;
        }
      } else if (cell.w && /e[+-]?\d+/i.test(cell.w) && typeof cell.v === 'number') {
        const fullDigits = BigInt(Math.round(cell.v)).toString();
        cell.t = 's';
        cell.v = fullDigits;
        cell.w = fullDigits;
      }
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
      raw: false,
    });

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong atau tidak memiliki baris data yang terbaca' }, { status: 400 });
    }

    // ═════════════════════════════════════════════════════════════
    // TARGET 1: DATA KPM (KELUARGA) — Kunci Unik: No. KK
    // ═════════════════════════════════════════════════════════════
    if (target === 'keluarga') {
      await ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_KELUARGA, KPM_KELUARGA_HEADERS);

      // Ambil NoKK yang sudah ada di sheet (Kolom C, index 2)
      const rawExisting = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A2:AA`).catch(() => []);

      // Map NoKK & NIK -> { rowIndex, data } dengan nomor baris aktual (i + 2)
      const existingMapByKK = new Map<string, { rowIndex: number; data: KpmKeluarga }>();
      const existingMapByNIK = new Map<string, { rowIndex: number; data: KpmKeluarga }>();

      rawExisting.forEach((r, i) => {
        if (r && r.length > 0) {
          const k = parseKeluargaRow(r);
          const cKK = cleanDigits(k.NoKK);
          const cNik = cleanDigits(k.NIK);
          const entry = { rowIndex: i + 2, data: k };
          if (cKK && !existingMapByKK.has(cKK)) {
            existingMapByKK.set(cKK, entry);
          }
          if (cNik && !existingMapByNIK.has(cNik)) {
            existingMapByNIK.set(cNik, entry);
          }
        }
      });

      const validRows: Array<{ kpm: KpmKeluarga; isDuplicate: boolean; existingRowIndex?: number; existingData?: KpmKeluarga }> = [];
      const duplicateList: Array<{ key: string; nama: string; rowNum: number }> = [];
      const errors: string[] = [];

      rawRows.forEach((row, idx) => {
        const rowNum = idx + 2;

        const rawNoKK = extractColumnValue(row, [
          'No. KK (16 Digit)', 'No. KK', 'NO KK', 'No KK', 'NoKK', 'nomor_kk', 'Nomor KK', 'Nomor Kartu Keluarga', 'Kartu Keluarga',
        ]);
        const noKK = cleanDigits(rawNoKK);

        const rawNik = extractColumnValue(row, [
          'NIK Pengurus (16 Digit)', 'NIK (16 Digit)', 'NIK', 'nik', 'NIK Pengurus', 'No. KTP', 'No KTP', 'Nomor KTP',
        ]);
        const nik = cleanDigits(rawNik);

        const nama = extractColumnValue(row, [
          'Nama Pengurus', 'Nama', 'nama', 'NAMA PENGURUS', 'Nama Lengkap', 'Nama KPM', 'Nama Kepala Keluarga',
        ]);

        // Lewati baris contoh bawaan template
        if (
          nama.toLowerCase().includes('contoh nama pengurus') ||
          nama.toLowerCase().includes('contoh anggota lain') ||
          (noKK === '1271010000000002' && nik === '1271010000000001')
        ) {
          return;
        }

        if (!noKK && !nik && !nama) return;

        // Cocokkan berdasarkan No. KK atau NIK
        const existing = (noKK && existingMapByKK.get(noKK)) || (nik && existingMapByNIK.get(nik)) || undefined;
        const isDuplicate = !!existing;

        // Jika duplikat di database dan kolom di Excel kosong, gunakan nilai lama dari database
        const effectiveNik = nik || (isDuplicate ? existing.data.NIK : '');
        const effectiveNama = nama || (isDuplicate ? existing.data.NamaPengurus : '');

        // Validasi
        if (!noKK) {
          errors.push(`Baris ${rowNum} (${effectiveNama || 'Tanpa Nama'}): No. KK kosong.`);
          return;
        }
        if (!validateNoKK(noKK)) {
          errors.push(`Baris ${rowNum} (${effectiveNama || noKK}): No. KK harus 16 digit angka (Terbaca: "${noKK}" [${noKK.length} digit]).`);
          return;
        }
        // Sesuai permintaan user: NIK tidak lagi memblokir impor data KPM (tetap diizinkan lewat walau tidak valid / sama).
        // Pengecualian hanya No. KK yang harus wajib dan valid 16 digit. NIK yang tidak valid / duplikat akan ditandai pada tabel.
        if (!effectiveNama) {
          errors.push(`Baris ${rowNum} (KK: ${noKK}): Nama Pengurus kosong.`);
          return;
        }

        const alamat = extractColumnValue(row, ['Alamat', 'alamat', 'ALAMAT', 'Alamat Lengkap', 'Jalan']);
        const lingkungan = extractColumnValue(row, ['Lingkungan', 'lingkungan', 'LINGKUNGAN', 'Dusun', 'Lingk', 'RT/RW']);
        const provinsi = extractColumnValue(row, ['Provinsi', 'provinsi', 'PROVINSI', 'Propinsi']);
        const kabKota = extractColumnValue(row, ['Kab/Kota', 'Kabupaten/Kota', 'Kabupaten', 'Kota', 'KAB/KOTA']);
        const kecamatan = extractColumnValue(row, ['Kecamatan', 'kecamatan', 'KECAMATAN', 'Kec']);
        const kelurahan = extractColumnValue(row, ['Kelurahan', 'kelurahan', 'KELURAHAN', 'Desa', 'Kel']);
        const noHP = extractColumnValue(row, ['No. HP', 'No HP', 'NO HP', 'Telepon', 'WhatsApp', 'WA', 'HP']);
        const kelompok = extractColumnValue(row, ['Kelompok', 'kelompok', 'KELOMPOK', 'Nama Kelompok', 'Grup']);
        const statusKelompok = extractColumnValue(row, ['Status Kelompok', 'Status', 'Peran']);
        const rawPernyataan = extractColumnValue(row, [
          'Pernyataan',
          'Pernyataan Resmi',
          'Pernyataan KPM',
          'Surat Pernyataan',
          'pernyataan',
          'PERNYATAAN',
          'Pernyataan Resmi KPM',
        ]);
        const cleanPernyataan = rawPernyataan ? rawPernyataan.trim() : '';

        if (isDuplicate) {
          duplicateList.push({
            key: noKK,
            nama: `${effectiveNama} (Sebelumnya: ${existing.data.NamaPengurus})`,
            rowNum,
          });
        }

        // Hitung penggabungan Tahap Bansos
        const existingTahap = existing?.data?.TahapBansos || '';
        const tahapTarget = selectedTahap || 'Tahap 1 (2026)';
        let mergedTahap = tahapTarget;
        if (isDuplicate && existingTahap) {
          const parts = existingTahap.split(',').map((p) => p.trim()).filter(Boolean);
          if (!parts.includes(tahapTarget)) {
            parts.push(tahapTarget);
          }
          mergedTahap = parts.join(', ');
        }

        const kpmItem: KpmKeluarga = {
          KpmId: isDuplicate ? existing.data.KpmId : generateKpmId(validRows.length + 1),
          NIK: effectiveNik,
          NoKK: noKK,
          NamaPengurus: effectiveNama,
          Alamat: alamat || (isDuplicate ? existing.data.Alamat : ''),
          Lingkungan: lingkungan || (isDuplicate ? existing.data.Lingkungan : ''),
          Provinsi: provinsi || (isDuplicate ? existing.data.Provinsi : ''),
          KabKota: kabKota || (isDuplicate ? existing.data.KabKota : ''),
          Kecamatan: kecamatan || (isDuplicate ? existing.data.Kecamatan : ''),
          Kelurahan: kelurahan || (isDuplicate ? existing.data.Kelurahan : ''),
          NoHP: noHP ? formatIndonesianPhone(noHP) : (isDuplicate ? existing.data.NoHP : ''),
          Kelompok: kelompok || (isDuplicate ? existing.data.Kelompok : ''),
          StatusKelompok: statusKelompok ? (statusKelompok.toLowerCase().includes('ketua') ? 'Ketua Kelompok' : 'Anggota') : (isDuplicate ? existing.data.StatusKelompok : 'Anggota'),
          FotoKTP: isDuplicate ? existing.data.FotoKTP : '',
          FotoKK: isDuplicate ? existing.data.FotoKK : '',
          FotoBukuTabungan: isDuplicate ? existing.data.FotoBukuTabungan : '',
          FotoKKS: isDuplicate ? existing.data.FotoKKS : '',
          CatatanTemuan: isDuplicate ? existing.data.CatatanTemuan : '[]',
          Pernyataan: cleanPernyataan || (isDuplicate ? existing.data.Pernyataan || '' : ''),
          Password: isDuplicate ? existing.data.Password : '123456',
          StatusData: isDuplicate ? existing.data.StatusData : 'Belum Lengkap',
          CreatedAt: isDuplicate ? existing.data.CreatedAt : new Date().toISOString(),
          UpdatedAt: new Date().toISOString(),
          StatusKepesertaan: isDuplicate ? (existing.data.StatusKepesertaan || 'Aktif') : 'Aktif',
          TahapBansos: mergedTahap,
          FotoBuktiCatatan: isDuplicate ? (existing.data.FotoBuktiCatatan || '') : '',
          FotoRumah: isDuplicate ? (existing.data.FotoRumah || '') : '',
        };

        validRows.push({
          kpm: kpmItem,
          isDuplicate,
          existingRowIndex: existing?.rowIndex,
          existingData: existing?.data,
        });
      });

      // Jika hanya pratinjau (preview)
      if (action === 'preview') {
        const newCount = validRows.filter((r) => !r.isDuplicate).length;
        const duplicateCount = validRows.filter((r) => r.isDuplicate).length;

        return NextResponse.json({
          target: 'keluarga',
          keyField: 'Nomor Kartu Keluarga (No. KK)',
          totalRows: rawRows.length,
          validCount: validRows.length,
          newCount,
          duplicateCount,
          selectedTahap,
          invalidCount: errors.length,
          duplicates: duplicateList,
          detailErrors: errors,
          previewData: validRows.slice(0, 5).map((r) => ({
            key: r.kpm.NoKK,
            nama: r.kpm.NamaPengurus,
            nik: r.kpm.NIK,
            kelompok: r.kpm.Kelompok,
            status: r.isDuplicate ? 'KPM Lanjutan (Sudah Terdaftar)' : 'KPM Baru Tahap Ini',
            tahap: r.kpm.TahapBansos,
          })),
        });
      }

      // Action === 'commit' (Eksekusi Impor)
      if (validRows.length === 0) {
        return NextResponse.json({
          error: 'Tidak ada baris data KPM yang valid untuk diimpor.',
          detailErrors: errors,
        }, { status: 400 });
      }

      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      const rangesToUpdate: Array<{ range: string; values: string[][] }> = [];
      const newRowsToAppend: string[][] = [];

      for (const item of validRows) {
        if (item.isDuplicate) {
          // KPM sudah ada: perbarui kepesertaan tahap tanpa menimpa data pokok keluarga
          if (item.existingRowIndex) {
            const existingKpm =
              item.existingData ||
              (item.kpm.NoKK && existingMapByKK.get(cleanDigits(item.kpm.NoKK))?.data) ||
              (item.kpm.NIK && existingMapByNIK.get(cleanDigits(item.kpm.NIK))?.data);
            const updatedKpm: KpmKeluarga = {
              ...(existingKpm || item.kpm),
              TahapBansos: item.kpm.TahapBansos,
              UpdatedAt: new Date().toISOString(),
            };
            rangesToUpdate.push({
              range: `${KPM_SHEET_KELUARGA}!A${item.existingRowIndex}:AA${item.existingRowIndex}`,
              values: [keluargaToRow(updatedKpm)],
            });
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          newRowsToAppend.push(keluargaToRow(item.kpm));
          importedCount++;
        }
      }

      // Batch update data yang diperbarui tahapnya (chunk per 100 baris agar hemat kuota dan tidak timeout)
      if (rangesToUpdate.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < rangesToUpdate.length; i += BATCH_SIZE) {
          const chunk = rangesToUpdate.slice(i, i + BATCH_SIZE);
          await batchUpdateSheetValues(accessToken, spreadsheetId, chunk);
        }
      }

      if (newRowsToAppend.length > 0) {
        await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A:AA`, newRowsToAppend);
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil memproses data KPM. KPM Baru Tahap Ini: ${importedCount}, KPM Lanjutan Terdaftar: ${updatedCount}.`,
        importedCount,
        updatedCount,
        skippedCount,
        totalProcessed: validRows.length,
        selectedTahap,
      });
    }

    // ═════════════════════════════════════════════════════════════
    // TARGET 2: DATA ANGGOTA KELUARGA — Kunci Unik: NIK Anggota
    // ═════════════════════════════════════════════════════════════
    if (target === 'anggota') {
      await ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_ANGGOTA, KPM_ANGGOTA_HEADERS);

      // Ambil NIK yang sudah ada di sheet (Kolom C, index 2)
      const rawExisting = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A2:N`).catch(() => []);

      const existingMap = new Map<string, { rowIndex: number; data: KpmAnggota }>();
      rawExisting.forEach((r, i) => {
        if (r && r.length > 0) {
          const a = parseAnggotaRow(r);
          if (a.NIK && !existingMap.has(a.NIK.trim())) {
            existingMap.set(a.NIK.trim(), { rowIndex: i + 2, data: a });
          }
        }
      });

      const validRows: Array<{ anggota: KpmAnggota; isDuplicate: boolean; existingRowIndex?: number }> = [];
      const duplicateList: Array<{ key: string; nama: string; rowNum: number }> = [];
      const errors: string[] = [];

      rawRows.forEach((row, idx) => {
        const rowNum = idx + 2;

        const rawNik = extractColumnValue(row, [
          'NIK Anggota (16 Digit)', 'NIK Anggota', 'NIK (16 Digit)', 'NIK', 'nik', 'No. KTP', 'Nomor KTP',
        ]);
        const nik = cleanDigits(rawNik);

        const rawNoKK = extractColumnValue(row, [
          'No. KK (16 Digit)', 'No. KK', 'NO KK', 'No KK', 'NoKK', 'nomor_kk', 'Nomor KK', 'Kartu Keluarga',
        ]);
        const noKK = cleanDigits(rawNoKK);

        const nama = extractColumnValue(row, [
          'Nama Anggota', 'Nama', 'nama', 'Nama Lengkap', 'NAMA ANGGOTA',
        ]);

        // Lewati contoh
        if (
          nama.toLowerCase().includes('contoh nama anggota') ||
          nama.toLowerCase().includes('contoh balita') ||
          (nik === '1271010000000005' && noKK === '1271010000000002')
        ) {
          return;
        }

        if (!nik && !nama && !noKK) return;

        const existing = nik ? existingMap.get(nik) : undefined;
        const isDuplicate = !!existing;

        const effectiveNama = nama || (isDuplicate ? existing.data.Nama : '');
        const effectiveNoKK = noKK || (isDuplicate ? existing.data.NoKK : '');

        if (!nik) {
          errors.push(`Baris ${rowNum} (${effectiveNama || 'Tanpa Nama'}): NIK Anggota kosong.`);
          return;
        }
        if (!validateNIK(nik)) {
          errors.push(`Baris ${rowNum} (${effectiveNama || nik}): NIK Anggota harus 16 digit angka (Terbaca: "${nik}" [${nik.length} digit]).`);
          return;
        }
        if (!effectiveNama) {
          errors.push(`Baris ${rowNum} (NIK: ${nik}): Nama Anggota kosong.`);
          return;
        }

        const jk = extractColumnValue(row, ['Jenis Kelamin', 'L/P', 'Kelamin', 'Gender']);
        const tglLahir = extractColumnValue(row, ['Tanggal Lahir', 'Tgl Lahir', 'TglLahir', 'Lahir']);
        const hubungan = extractColumnValue(row, ['Hubungan Keluarga', 'Hubungan', 'Status Hubungan']);
        const komponen = extractColumnValue(row, ['Komponen PKH', 'Komponen', 'Kategori']);
        const posyandu = extractColumnValue(row, ['Nama Posyandu', 'Posyandu']);
        const sekolah = extractColumnValue(row, ['Nama Sekolah', 'Sekolah']);
        const kelas = extractColumnValue(row, ['Kelas']);
        const pekerjaan = extractColumnValue(row, ['Pekerjaan']);
        const keterangan = extractColumnValue(row, ['Keterangan', 'Catatan']);

        if (isDuplicate) {
          duplicateList.push({
            key: nik,
            nama: `${effectiveNama} (Sebelumnya: ${existing.data.Nama})`,
            rowNum,
          });
        }

        const anggotaItem: KpmAnggota = {
          AnggotaId: isDuplicate ? existing.data.AnggotaId : generateAnggotaId(validRows.length + 1),
          NoKK: effectiveNoKK,
          NIK: nik,
          Nama: effectiveNama,
          JenisKelamin: jk.toLowerCase().startsWith('p') ? 'Perempuan' : 'Laki-laki',
          TanggalLahir: tglLahir || (isDuplicate ? existing.data.TanggalLahir : ''),
          Komponen: komponen || (isDuplicate ? existing.data.Komponen : ''),
          HubunganKeluarga: hubungan || (isDuplicate ? existing.data.HubunganKeluarga : 'Anak'),
          Posyandu: posyandu || (isDuplicate ? existing.data.Posyandu : ''),
          Sekolah: sekolah || (isDuplicate ? existing.data.Sekolah : ''),
          Kelas: kelas || (isDuplicate ? existing.data.Kelas : ''),
          Pekerjaan: pekerjaan || (isDuplicate ? existing.data.Pekerjaan : ''),
          Keterangan: keterangan || (isDuplicate ? existing.data.Keterangan : ''),
          CreatedAt: isDuplicate ? existing.data.CreatedAt : new Date().toISOString(),
        };

        validRows.push({
          anggota: anggotaItem,
          isDuplicate,
          existingRowIndex: existing?.rowIndex,
        });
      });

      if (action === 'preview') {
        const newCount = validRows.filter((r) => !r.isDuplicate).length;
        const duplicateCount = validRows.filter((r) => r.isDuplicate).length;

        return NextResponse.json({
          target: 'anggota',
          keyField: 'NIK Anggota (16 Digit)',
          totalRows: rawRows.length,
          validCount: validRows.length,
          newCount,
          duplicateCount,
          invalidCount: errors.length,
          duplicates: duplicateList,
          detailErrors: errors,
          previewData: validRows.slice(0, 5).map((r) => ({
            key: r.anggota.NIK,
            nama: r.anggota.Nama,
            noKK: r.anggota.NoKK,
            komponen: r.anggota.Komponen,
            status: r.isDuplicate ? 'Duplikat (Sudah Ada)' : 'Data Baru',
          })),
        });
      }

      if (validRows.length === 0) {
        return NextResponse.json({
          error: 'Tidak ada baris data Anggota Keluarga yang valid untuk diimpor.',
          detailErrors: errors,
        }, { status: 400 });
      }

      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      const rangesToUpdate: Array<{ range: string; values: string[][] }> = [];
      const newRowsToAppend: string[][] = [];

      for (const item of validRows) {
        if (item.isDuplicate) {
          if (mode === 'overwrite' && item.existingRowIndex) {
            rangesToUpdate.push({
              range: `${KPM_SHEET_ANGGOTA}!A${item.existingRowIndex}:N${item.existingRowIndex}`,
              values: [anggotaToRow(item.anggota)],
            });
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          newRowsToAppend.push(anggotaToRow(item.anggota));
          importedCount++;
        }
      }

      // Batch update data anggota yang ditimpa (chunk 100 baris)
      if (rangesToUpdate.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < rangesToUpdate.length; i += BATCH_SIZE) {
          const chunk = rangesToUpdate.slice(i, i + BATCH_SIZE);
          await batchUpdateSheetValues(accessToken, spreadsheetId, chunk);
        }
      }

      if (newRowsToAppend.length > 0) {
        await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A:N`, newRowsToAppend);
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil mengimpor data Anggota Keluarga. Baru: ${importedCount}, Diperbarui (Timpa): ${updatedCount}, Dilewati: ${skippedCount}.`,
        importedCount,
        updatedCount,
        skippedCount,
        detailErrors: errors,
      });
    }

    // ═════════════════════════════════════════════════════════════
    // TARGET 3: DATA ASET & LOKASI — Kunci Unik: No. KK
    // ═════════════════════════════════════════════════════════════
    if (target === 'aset') {
      await ensureSheetExists(accessToken, spreadsheetId, KPM_SHEET_ASET, KPM_ASET_HEADERS);

      // Ambil NoKK yang sudah ada di sheet (Kolom B, index 1)
      const rawExisting = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ASET}!A2:M`).catch(() => []);

      const existingMap = new Map<string, { rowIndex: number; data: KpmAset }>();
      rawExisting.forEach((r, i) => {
        if (r && r.length > 0) {
          const ast = parseAsetRow(r);
          if (ast.NoKK && !existingMap.has(ast.NoKK.trim())) {
            existingMap.set(ast.NoKK.trim(), { rowIndex: i + 2, data: ast });
          }
        }
      });

      const validRows: Array<{ aset: KpmAset; isDuplicate: boolean; existingRowIndex?: number }> = [];
      const duplicateList: Array<{ key: string; nama: string; rowNum: number }> = [];
      const errors: string[] = [];

      rawRows.forEach((row, idx) => {
        const rowNum = idx + 2;

        const rawNoKK = extractColumnValue(row, [
          'No. KK (16 Digit)', 'No. KK', 'NO KK', 'No KK', 'NoKK', 'nomor_kk', 'Nomor KK', 'Kartu Keluarga',
        ]);
        const noKK = cleanDigits(rawNoKK);

        // Lewati contoh
        if (
          (noKK === '1271010000000002' || noKK === '1271010000000004') &&
          extractColumnValue(row, ['Keterangan']).toLowerCase().includes('dinding tepas')
        ) {
          return;
        }

        if (!noKK && Object.values(row).every((v) => !v)) return;

        if (!noKK) {
          errors.push(`Baris ${rowNum}: Nomor Kartu Keluarga (No. KK) kosong.`);
          return;
        }
        if (!validateNoKK(noKK)) {
          errors.push(`Baris ${rowNum}: No. KK harus 16 digit angka (Terbaca: "${noKK}" [${noKK.length} digit]).`);
          return;
        }

        const statusRumah = extractColumnValue(row, ['Status Rumah', 'StatusRumah', 'Rumah', 'Kepemilikan Rumah']);
        const usaha = extractColumnValue(row, ['Kepemilikan Usaha', 'Usaha', 'Ada Usaha']);
        const jenisUsaha = extractColumnValue(row, ['Jenis Usaha', 'JenisUsaha', 'Usaha KPM']);
        const tahunBansos = extractColumnValue(row, ['Tahun Terima Bansos', 'Tahun Bansos', 'Tahun Masuk', 'Bansos Sejak']);
        const lat = extractColumnValue(row, ['Latitude (GPS)', 'Latitude', 'Lat', 'Lintang']);
        const lng = extractColumnValue(row, ['Longitude (GPS)', 'Longitude', 'Long', 'Lng', 'Bujur']);
        const keterangan = extractColumnValue(row, ['Keterangan', 'Catatan']);

        const existing = existingMap.get(noKK);
        const isDuplicate = !!existing;

        if (isDuplicate) {
          duplicateList.push({
            key: noKK,
            nama: `KK: ${noKK} (Status Rumah: ${existing.data.StatusRumah || '—'})`,
            rowNum,
          });
        }

        const asetItem: KpmAset = {
          AsetId: isDuplicate ? existing.data.AsetId : generateAsetId(),
          NoKK: noKK,
          StatusRumah: statusRumah || (isDuplicate ? existing.data.StatusRumah : 'Milik Sendiri'),
          Usaha: usaha || (isDuplicate ? existing.data.Usaha : 'Tidak Memiliki Usaha'),
          JenisUsaha: jenisUsaha || (isDuplicate ? existing.data.JenisUsaha : ''),
          FotoUsaha: isDuplicate ? existing.data.FotoUsaha : '',
          FotoRumahLuar: isDuplicate ? existing.data.FotoRumahLuar : '',
          FotoRumahDalam: isDuplicate ? existing.data.FotoRumahDalam : '',
          Latitude: lat || (isDuplicate ? existing.data.Latitude : ''),
          Longitude: lng || (isDuplicate ? existing.data.Longitude : ''),
          TahunMenerimaBansos: tahunBansos || (isDuplicate ? existing.data.TahunMenerimaBansos : ''),
          Keterangan: keterangan || (isDuplicate ? existing.data.Keterangan : ''),
          CreatedAt: isDuplicate ? existing.data.CreatedAt : new Date().toISOString(),
        };

        validRows.push({
          aset: asetItem,
          isDuplicate,
          existingRowIndex: existing?.rowIndex,
        });
      });

      if (action === 'preview') {
        const newCount = validRows.filter((r) => !r.isDuplicate).length;
        const duplicateCount = validRows.filter((r) => r.isDuplicate).length;

        return NextResponse.json({
          target: 'aset',
          keyField: 'Nomor Kartu Keluarga (No. KK)',
          totalRows: rawRows.length,
          validCount: validRows.length,
          newCount,
          duplicateCount,
          invalidCount: errors.length,
          duplicates: duplicateList,
          detailErrors: errors,
          previewData: validRows.slice(0, 5).map((r) => ({
            key: r.aset.NoKK,
            nama: `Rumah: ${r.aset.StatusRumah}`,
            usaha: r.aset.Usaha,
            lokasi: r.aset.Latitude && r.aset.Longitude ? `${r.aset.Latitude}, ${r.aset.Longitude}` : '—',
            status: r.isDuplicate ? 'Duplikat (Sudah Ada)' : 'Data Baru',
          })),
        });
      }

      if (validRows.length === 0) {
        return NextResponse.json({
          error: 'Tidak ada baris data Aset & Lokasi yang valid untuk diimpor.',
          detailErrors: errors,
        }, { status: 400 });
      }

      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      const rangesToUpdate: Array<{ range: string; values: string[][] }> = [];
      const newRowsToAppend: string[][] = [];

      for (const item of validRows) {
        if (item.isDuplicate) {
          if (mode === 'overwrite' && item.existingRowIndex) {
            rangesToUpdate.push({
              range: `${KPM_SHEET_ASET}!A${item.existingRowIndex}:M${item.existingRowIndex}`,
              values: [asetToRow(item.aset)],
            });
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          newRowsToAppend.push(asetToRow(item.aset));
          importedCount++;
        }
      }

      // Batch update data aset yang ditimpa (chunk 100 baris)
      if (rangesToUpdate.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < rangesToUpdate.length; i += BATCH_SIZE) {
          const chunk = rangesToUpdate.slice(i, i + BATCH_SIZE);
          await batchUpdateSheetValues(accessToken, spreadsheetId, chunk);
        }
      }

      if (newRowsToAppend.length > 0) {
        await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ASET}!A:M`, newRowsToAppend);
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil mengimpor data Aset & Lokasi. Baru: ${importedCount}, Diperbarui (Timpa): ${updatedCount}, Dilewati: ${skippedCount}.`,
        importedCount,
        updatedCount,
        skippedCount,
        detailErrors: errors,
      });
    }

    return NextResponse.json({ error: 'Target tipe impor tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    console.error('KPM Import Excel error:', error);
    return NextResponse.json({ error: error.message || 'Gagal memproses file Excel' }, { status: 500 });
  }
}
