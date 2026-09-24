import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import {
  getSheetData,
  appendSheetData,
  updateSheetRow,
  deleteSheetRow,
  deleteSheetRowsBatch,
  findRowByKey,
  batchUpdateSheetValues,
} from '@/lib/google-sheets';
import {
  KPM_SHEET_KELUARGA,
  KPM_SHEET_ANGGOTA,
  KPM_SHEET_ASET,
  KPM_SHEET_GRADUASI,
  KPM_KELUARGA_HEADERS,
  generateKpmId,
  generateGraduasiId,
  parseKeluargaRow,
  parseAnggotaRow,
  parseAsetRow,
  parseGraduasiRow,
  keluargaToRow,
  graduasiToRow,
  validateNIK,
  validateNoKK,
  normalizeKK,
  isKpmDataLengkap,
  isKpmAnggotaLengkap,
  isKpmAsetLengkap,
  getKpmCompletenessDetails,
  cleanTextCell,
  formatTextCell,
  KpmKeluarga,
  KpmAnggota,
  KpmAset,
  KpmGraduasi,
} from '@/lib/kpm-constants';

export async function GET(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is set in jwt callback
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase();
    const kelompok = searchParams.get('kelompok');
    const status = searchParams.get('status');

    let [keluargaRows, rawAnggota, rawAset] = await Promise.all([
      getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A2:AA`).catch(() => []),
      getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A2:N`).catch(() => []),
      getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ASET}!A2:M`).catch(() => []),
    ]);

    const allAnggota = rawAnggota.filter((r) => r.length > 0).map(parseAnggotaRow);
    const allAset = rawAset.filter((r) => r.length > 0).map(parseAsetRow);

    // Map NoKK -> Anggota[] & Map NIK -> Anggota (untuk cross-reference pengurus)
    const anggotaByKK = new Map<string, KpmAnggota[]>();
    const anggotaByNIK = new Map<string, KpmAnggota>();

    for (const ang of allAnggota) {
      const rawKK = ang.NoKK?.trim();
      const normKK = normalizeKK(ang.NoKK);

      if (rawKK) {
        if (!anggotaByKK.has(rawKK)) anggotaByKK.set(rawKK, []);
        anggotaByKK.get(rawKK)!.push(ang);
      }
      if (normKK && normKK !== rawKK) {
        if (!anggotaByKK.has(normKK)) anggotaByKK.set(normKK, []);
        anggotaByKK.get(normKK)!.push(ang);
      }

      if (ang.NIK?.trim()) {
        anggotaByNIK.set(ang.NIK.trim(), ang);
      }
    }

    // Map NoKK -> Aset
    const asetByKK = new Map<string, KpmAset>();
    for (const ast of allAset) {
      const rawKK = ast.NoKK?.trim();
      const normKK = normalizeKK(ast.NoKK);
      if (rawKK && !asetByKK.has(rawKK)) asetByKK.set(rawKK, ast);
      if (normKK && !asetByKK.has(normKK)) asetByKK.set(normKK, ast);
    }

    // Hitung frekuensi kemunculan NIK anggota di seluruh database
    const anggotaNikCounts = new Map<string, number>();
    for (const ang of allAnggota) {
      const aNik = ang.NIK?.trim();
      if (aNik && aNik !== '—' && aNik !== '-') {
        anggotaNikCounts.set(aNik, (anggotaNikCounts.get(aNik) || 0) + 1);
      }
    }

    // Map nama anggota untuk cross-reference nama pengurus
    const anggotaByNama = new Map<string, KpmAnggota>();
    for (const ang of allAnggota) {
      if (ang.Nama?.trim()) {
        const cleanNama = ang.Nama.trim().toLowerCase();
        if (!anggotaByNama.has(cleanNama)) {
          anggotaByNama.set(cleanNama, ang);
        }
      }
    }

    const rawParsedKeluarga = keluargaRows
      .filter((row) => row.length > 0)
      .map(parseKeluargaRow);

    // 1. Pemulihan Silang (Cross-Reference) & Pembersihan Data KPM
    const dataWithRepairs = rawParsedKeluarga.map((item) => {
      if (!item.KpmId) {
        item.KpmId = item.NIK ? `KPM-${item.NIK}` : generateKpmId();
      }

      let currentNoKK = cleanTextCell(item.NoKK);
      let currentNik = cleanTextCell(item.NIK);
      const namaPengurus = (item.NamaPengurus || '').trim().toLowerCase();

      // Deteksi jika NoKK atau NIK memerlukan pemulihan dari data anggota
      const needsKKRecovery = !currentNoKK || currentNoKK.length < 16 || /e[+-]?\d+/i.test(currentNoKK);
      const needsNikRecovery = !currentNik || currentNik.length < 16 || /e[+-]?\d+/i.test(currentNik);

      // A. Pulihkan No. KK dari data anggota jika NoKK rusak
      if (needsKKRecovery) {
        // Coba cari dari NIK Pengurus di data anggota
        if (currentNik && validateNIK(currentNik) && anggotaByNIK.has(currentNik)) {
          const matchingAnggota = anggotaByNIK.get(currentNik)!;
          if (matchingAnggota.NoKK && validateNoKK(matchingAnggota.NoKK)) {
            currentNoKK = matchingAnggota.NoKK.trim();
          }
        }
        // Jika belum dapat, coba cari dari kecocokan Nama Pengurus di data anggota
        if (needsKKRecovery && namaPengurus && anggotaByNama.has(namaPengurus)) {
          const matchingAnggota = anggotaByNama.get(namaPengurus)!;
          if (matchingAnggota.NoKK && validateNoKK(matchingAnggota.NoKK)) {
            currentNoKK = matchingAnggota.NoKK.trim();
          }
        }
      }

      // B. Pulihkan NIK Pengurus dari data anggota jika NIK rusak
      if (needsNikRecovery && currentNoKK && validateNoKK(currentNoKK)) {
        const membersOfFamily = anggotaByKK.get(currentNoKK) || [];
        const matchingHead = membersOfFamily.find(
          (a) =>
            (a.Nama && a.Nama.trim().toLowerCase() === namaPengurus) ||
            a.HubunganKeluarga === 'Kepala Keluarga'
        );
        if (matchingHead?.NIK && validateNIK(matchingHead.NIK)) {
          currentNik = matchingHead.NIK.trim();
        }
      }

      item.NoKK = currentNoKK;
      item.NIK = currentNik;

      const rawKK = item.NoKK?.trim() || '';
      const normKK = normalizeKK(item.NoKK);

      // Cari anggota keluarga
      let anggotaList =
        (rawKK && anggotaByKK.get(rawKK)) ||
        (normKK && anggotaByKK.get(normKK)) ||
        [];

      // Cari aset
      const aset =
        (rawKK && asetByKK.get(rawKK)) ||
        (normKK && asetByKK.get(normKK)) ||
        null;

      const isKpmComplete = isKpmDataLengkap(item);
      const anggotaStatus = isKpmAnggotaLengkap(anggotaList);
      const asetStatus = isKpmAsetLengkap(aset);
      const details = getKpmCompletenessDetails(item, anggotaList, aset);
      const fotoRumah = item.FotoRumah || aset?.FotoRumahLuar || aset?.FotoRumahDalam || '';
      const isGraduasi =
        item.StatusKepesertaan === 'Graduasi' ||
        item.CatatanTemuan?.includes('Sudah Graduasi') ||
        false;
      const statusKepesertaan = isGraduasi ? 'Graduasi' : item.StatusKepesertaan || 'Aktif';

      return {
        ...item,
        StatusKepesertaan: statusKepesertaan,
        FotoRumah: fotoRumah,
        FotoRumahLuar: aset?.FotoRumahLuar || '',
        FotoRumahDalam: aset?.FotoRumahDalam || '',
        AnggotaCount: anggotaStatus.count,
        IsAnggotaLengkap: anggotaStatus.isLengkap,
        AnggotaMissing: anggotaStatus.missingReason,
        HasAset: asetStatus.hasRecord,
        IsAsetLengkap: asetStatus.isLengkap,
        AsetMissing: asetStatus.missingReason,
        IsKpmLengkap: isKpmComplete,
        CompletenessPercent: details.percentage,
        AnggotaList: anggotaList,
        IsScientificNik: /e[+-]?\d+/i.test(item.NIK || ''),
        IsScientificKK: /e[+-]?\d+/i.test(item.NoKK || ''),
      };
    });

    console.log('[DEBUG KPM GET] Total raw rows from Google Sheets:', rawParsedKeluarga.length);

    // Hitung duplikasi HANYA untuk NIK & No. KK yang valid 16 digit (bukan nilai scientific yang terpotong)
    const kpmNikCounts = new Map<string, number>();
    const kpmKKCounts = new Map<string, number>();

    for (const k of dataWithRepairs) {
      const kNik = k.NIK?.trim();
      const kKK = k.NoKK?.trim();
      if (kNik && validateNIK(kNik)) {
        kpmNikCounts.set(kNik, (kpmNikCounts.get(kNik) || 0) + 1);
      }
      if (kKK && validateNoKK(kKK)) {
        kpmKKCounts.set(kKK, (kpmKKCounts.get(kKK) || 0) + 1);
      }
    }

    let data = dataWithRepairs.map((item) => {
      const cleanNik = item.NIK?.trim() || '';
      const cleanKK = item.NoKK?.trim() || '';

      const isDupNik = Boolean(cleanNik && validateNIK(cleanNik) && (kpmNikCounts.get(cleanNik) || 0) > 1);
      const isDupKK = Boolean(cleanKK && validateNoKK(cleanKK) && (kpmKKCounts.get(cleanKK) || 0) > 1);

      const enrichedAnggotaList = (item.AnggotaList || []).map((ang) => {
        const aNik = ang.NIK?.trim() || '';
        const dupCount = aNik ? (anggotaNikCounts.get(aNik) || 1) : 1;
        return {
          ...ang,
          IsDuplicateNik: dupCount > 1,
          DuplicateCount: dupCount,
        };
      });

      const hasDupAnggotaNik = enrichedAnggotaList.some((ang) => ang.IsDuplicateNik);
      const dupAnggotaNiks = enrichedAnggotaList
        .filter((ang) => ang.IsDuplicateNik)
        .map((ang) => ang.NIK?.trim())
        .filter(Boolean);

      return {
        ...item,
        AnggotaList: enrichedAnggotaList,
        HasDuplicateAnggotaNik: hasDupAnggotaNik,
        DuplicateAnggotaNiks: dupAnggotaNiks,
        IsDuplicateNik: isDupNik,
        IsDuplicateKK: isDupKK,
      };
    });

    if (search) {
      data = data.filter(item => 
        (item.NIK?.toLowerCase().includes(search) || item.NamaPengurus?.toLowerCase().includes(search) || item.NoKK?.toLowerCase().includes(search))
      );
    }
    if (kelompok) {
      data = data.filter(item => item.Kelompok === kelompok);
    }
    if (status === 'Lengkap') {
      data = data.filter(item => item.IsKpmLengkap && item.IsAnggotaLengkap && item.IsAsetLengkap);
    } else if (status === 'Belum Lengkap') {
      data = data.filter(item => !(item.IsKpmLengkap && item.IsAnggotaLengkap && item.IsAsetLengkap));
    } else if (status) {
      data = data.filter(item => item.StatusData === status);
    }

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    console.error('KPM GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });

    const body = await request.json();
    
    if (!validateNIK(body.NIK) || !validateNoKK(body.NoKK)) {
      return NextResponse.json({ error: 'Invalid NIK or NoKK. Must be 16 digits.' }, { status: 400 });
    }

    // Check headers and existing data
    let existingRows: string[][] = [];
    try {
      existingRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A1:AA`);
    } catch (e) {
      // Create headers if fails
      await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A1:AA`, [KPM_KELUARGA_HEADERS]);
    }
    
    if (existingRows.length === 0) {
      await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A1:AA`, [KPM_KELUARGA_HEADERS]);
    } else {
      const dataRows = existingRows.slice(1);
      // Cek apakah NIK atau No. KK sudah ada (Kolom B = NIK [index 1], Kolom C = NoKK [index 2])
      const isDuplicate = dataRows.some((row) => {
        const cellNik = cleanTextCell(row[1]);
        const cellKK = cleanTextCell(row[2]);
        return (
          (cellNik && cellNik === body.NIK) ||
          (cellKK && normalizeKK(cellKK) === normalizeKK(body.NoKK))
        );
      });
      if (isDuplicate) {
        return NextResponse.json(
          {
            error:
              'NIK atau No. KK sudah terdaftar di database KPM. Silakan gunakan tombol Edit pada data yang bersangkutan jika ingin memperbarui, bukan menambah baru.',
          },
          { status: 400 }
        );
      }
    }

    const newKeluarga: KpmKeluarga = {
      ...body,
      KpmId: generateKpmId(),
      Password: '123456',
      StatusData: isKpmDataLengkap(body) ? 'Lengkap' : 'Belum Lengkap',
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };

    const rowData = keluargaToRow(newKeluarga);
    await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A:AA`, [rowData]);

    return NextResponse.json(newKeluarga, { status: 201 });
  } catch (error) {
    console.error('KPM POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error
    const accessToken = session?.accessToken;
    if (!session || !accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });

    const body = await request.json();
    const rawRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A:AA`);
    if (!rawRows || rawRows.length <= 1) {
      return NextResponse.json({ error: 'Data sheet KPM kosong' }, { status: 404 });
    }

    let foundRowIndex = -1; // 1-indexed (nomor baris aktual di Google Sheets)
    const targetKpmId = (body.KpmId || '').trim();
    const targetNik = (body.OriginalNIK || body.NIK || '').trim();
    const targetNoKK = (body.OriginalNoKK || body.NoKK || '').trim();

    // 1. Cari berdasarkan KpmId (jika ada) di kolom A (index 0)
    if (targetKpmId) {
      for (let i = 1; i < rawRows.length; i++) {
        const cellKpmId = cleanTextCell(rawRows[i][0]);
        if (cellKpmId && cellKpmId.toLowerCase() === targetKpmId.toLowerCase()) {
          foundRowIndex = i + 1;
          break;
        }
      }
    }

    // 2. Jika belum ditemukan atau KpmId kosong, cari berdasarkan NIK di kolom B (index 1)
    if (foundRowIndex === -1 && targetNik) {
      for (let i = 1; i < rawRows.length; i++) {
        const cellNik = cleanTextCell(rawRows[i][1]);
        if (cellNik && cellNik === targetNik) {
          foundRowIndex = i + 1;
          break;
        }
      }
    }

    // 3. Jika masih belum ditemukan, cari berdasarkan No. KK di kolom C (index 2)
    if (foundRowIndex === -1 && targetNoKK) {
      const normTargetKK = normalizeKK(targetNoKK);
      for (let i = 1; i < rawRows.length; i++) {
        const cellKK = cleanTextCell(rawRows[i][2]);
        if (cellKK === targetNoKK || (normTargetKK && normalizeKK(cellKK) === normTargetKK)) {
          foundRowIndex = i + 1;
          break;
        }
      }
    }

    // 4. Jika masih belum ditemukan (misal NIK dan No. KK lama di Google Sheets keduanya berformat scientific / rusak),
    // cocokkan berdasarkan kombinasi NamaPengurus dan Kelompok
    const targetNama = (body.OriginalNamaPengurus || body.NamaPengurus || '').trim().toLowerCase();
    const targetKelompok = (body.OriginalKelompok || body.Kelompok || '').trim().toLowerCase();
    if (foundRowIndex === -1 && targetNama) {
      for (let i = 1; i < rawRows.length; i++) {
        const cellNama = cleanTextCell(rawRows[i][3]).toLowerCase();
        const cellKelompok = cleanTextCell(rawRows[i][11]).toLowerCase();
        if (cellNama === targetNama && (!targetKelompok || cellKelompok === targetKelompok)) {
          foundRowIndex = i + 1;
          break;
        }
      }
    }

    if (foundRowIndex <= 1) {
      return NextResponse.json(
        { error: 'Data KPM tidak ditemukan di Google Sheets untuk diperbarui.' },
        { status: 404 }
      );
    }

    // Ambil data baris yang ditemukan
    const existingRow = rawRows[foundRowIndex - 1];
    const existingKeluarga = existingRow ? parseKeluargaRow(existingRow) : ({} as Partial<KpmKeluarga>);

    const updatedKeluarga: KpmKeluarga = {
      ...(existingKeluarga as KpmKeluarga),
      ...body,
      // Pastikan KpmId selalu terisi unik permanen
      KpmId: existingKeluarga.KpmId || body.KpmId || (body.NIK ? `KPM-${body.NIK}` : generateKpmId()),
      UpdatedAt: new Date().toISOString(),
    };
    updatedKeluarga.StatusData = isKpmDataLengkap(updatedKeluarga) ? 'Lengkap' : 'Belum Lengkap';

    // Temukan apakah ada baris duplikat lain di Google Sheets yang memiliki NIK, NoKK, atau KpmId yang sama
    // (Misalnya akibat impor ganda atau kesalahan sebelumnya)
    const effectiveNik = cleanTextCell(updatedKeluarga.NIK);
    const effectiveKK = cleanTextCell(updatedKeluarga.NoKK);
    const effectiveKpmId = cleanTextCell(updatedKeluarga.KpmId);
    const normEffectiveKK = normalizeKK(effectiveKK);

    const stagesToMerge = new Set<string>();

    // Masukkan tahap dari updatedKeluarga saat ini
    if (updatedKeluarga.TahapBansos) {
      updatedKeluarga.TahapBansos.split(',').forEach((s) => {
        const tr = s.trim();
        if (tr) stagesToMerge.add(tr);
      });
    }

    for (let i = 1; i < rawRows.length; i++) {
      // Lewati baris utama yang sedang diperbarui (foundRowIndex adalah 1-indexed, i adalah 0-indexed)
      if (i === foundRowIndex - 1) continue;

      const row = rawRows[i];
      const cellNik = cleanTextCell(row[1]);
      const cellKK = cleanTextCell(row[2]);

      const isSameNik = Boolean(effectiveNik && validateNIK(effectiveNik) && cellNik === effectiveNik);
      const isSameKK = Boolean(effectiveKK && validateNoKK(effectiveKK) && (cellKK === effectiveKK || (normEffectiveKK && normalizeKK(cellKK) === normEffectiveKK)));

      if (isSameNik || isSameKK) {
        // Kumpulkan riwayat tahap dari baris serupa agar tidak ada data tahap yang terlewat
        const rowTahap = cleanTextCell(row[24]);
        if (rowTahap) {
          rowTahap.split(',').forEach((s) => {
            const tr = s.trim();
            if (tr) stagesToMerge.add(tr);
          });
        }
      }
    }

    // Jika ada tahap tambahan dari baris duplikat, gabungkan secara teratur
    if (stagesToMerge.size > 0) {
      const stageList = Array.from(stagesToMerge).sort();
      updatedKeluarga.TahapBansos = stageList.join(', ');
    }

    const updatedRow = keluargaToRow(updatedKeluarga);
    const range = `${KPM_SHEET_KELUARGA}!A${foundRowIndex}:AA${foundRowIndex}`;
    await updateSheetRow(accessToken, spreadsheetId, range, [updatedRow]);

    // Sinkronisasi dua arah otomatis dengan KPM_SHEET_GRADUASI
    if (updatedKeluarga.NoKK) {
      const isGrad =
        updatedKeluarga.StatusKepesertaan === 'Graduasi' ||
        updatedKeluarga.StatusGraduasi === 'Sudah Graduasi' ||
        updatedKeluarga.StatusGraduasi === 'Graduasi Mandiri' ||
        updatedKeluarga.StatusGraduasi === 'Graduasi Alami';

      try {
        const existingGradRow = await findRowByKey(accessToken, spreadsheetId, KPM_SHEET_GRADUASI, updatedKeluarga.NoKK, 1);
        if (isGrad) {
          const gradData: KpmGraduasi = {
            GraduasiId: generateGraduasiId(),
            NoKK: updatedKeluarga.NoKK,
            StatusGraduasi: updatedKeluarga.StatusGraduasi || 'Sudah Graduasi',
            TanggalGraduasi: new Date().toISOString().split('T')[0],
            AlasanGraduasi: 'Graduasi Mandiri',
            IndeksKesejahteraan: '',
            BantuanTerakhir: 'PKH',
            PenghasilanPerBulan: '',
            SuratPengunduranDiri: '',
            StatusPPSE: 'Belum PPSE',
            Catatan: 'Disinkronkan dari status KPM',
            CreatedAt: new Date().toISOString(),
          };
          if (existingGradRow > 1) {
            await updateSheetRow(accessToken, spreadsheetId, `${KPM_SHEET_GRADUASI}!A${existingGradRow}:L${existingGradRow}`, [graduasiToRow(gradData)]);
          } else {
            await appendSheetData(accessToken, spreadsheetId, `${KPM_SHEET_GRADUASI}!A:L`, [graduasiToRow(gradData)]);
          }
        } else if (existingGradRow > 1 && updatedKeluarga.StatusKepesertaan === 'Aktif') {
          const gradRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_GRADUASI}!A${existingGradRow}:L${existingGradRow}`);
          if (gradRows.length > 0) {
            const currentGrad = parseGraduasiRow(gradRows[0]);
            currentGrad.StatusGraduasi = 'Belum Graduasi';
            await updateSheetRow(accessToken, spreadsheetId, `${KPM_SHEET_GRADUASI}!A${existingGradRow}:L${existingGradRow}`, [graduasiToRow(currentGrad)]);
          }
        }
      } catch (gradErr) {
        console.error('Error auto-sync graduasi in PUT KPM:', gradErr);
      }
    }

    return NextResponse.json({ success: true, data: updatedKeluarga });
  } catch (error: any) {
    console.error('KPM PUT error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error
    const accessToken = session?.accessToken;
    if (!session || !accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const kpmId = (searchParams.get('kpmId') || '').trim();
    const nik = (searchParams.get('nik') || '').trim();
    const noKK = (searchParams.get('noKK') || '').trim();

    if (!kpmId && !nik && !noKK) {
      return NextResponse.json({ error: 'kpmId, nik, atau noKK diperlukan untuk menghapus' }, { status: 400 });
    }

    const rawRows = await getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A:AA`);
    if (!rawRows || rawRows.length <= 1) {
      return NextResponse.json({ error: 'Data sheet KPM kosong' }, { status: 404 });
    }

    let foundRowIndex = -1; // 1-indexed

    // 1. Cari berdasarkan KpmId jika ada
    if (kpmId) {
      for (let i = 1; i < rawRows.length; i++) {
        const cellKpmId = cleanTextCell(rawRows[i][0]);
        if (cellKpmId && cellKpmId.toLowerCase() === kpmId.toLowerCase()) {
          foundRowIndex = i + 1;
          break;
        }
      }
    }

    // 2. Jika belum ditemukan, cari berdasarkan NIK
    if (foundRowIndex === -1 && nik) {
      for (let i = 1; i < rawRows.length; i++) {
        const cellNik = cleanTextCell(rawRows[i][1]);
        if (cellNik && cellNik === nik) {
          foundRowIndex = i + 1;
          break;
        }
      }
    }

    // 3. Jika masih belum ditemukan, cari berdasarkan No. KK
    if (foundRowIndex === -1 && noKK) {
      const normTargetKK = normalizeKK(noKK);
      for (let i = 1; i < rawRows.length; i++) {
        const cellKK = cleanTextCell(rawRows[i][2]);
        if (cellKK === noKK || (normTargetKK && normalizeKK(cellKK) === normTargetKK)) {
          foundRowIndex = i + 1;
          break;
        }
      }
    }

    if (foundRowIndex <= 1) {
      return NextResponse.json({ error: 'Data KPM tidak ditemukan untuk dihapus' }, { status: 404 });
    }

    // deleteSheetRow menggunakan 0-based index! (Baris 1-indexed ke-foundRowIndex adalah index foundRowIndex - 1)
    await deleteSheetRow(accessToken, spreadsheetId, KPM_SHEET_KELUARGA, foundRowIndex - 1);

    return NextResponse.json({ message: 'KPM berhasil dihapus' });
  } catch (error: any) {
    console.error('KPM DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error
    const accessToken = session?.accessToken;
    if (!session || !accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');


    if (action === 'repair-scientific') {
      const [keluargaRaw, anggotaRaw] = await Promise.all([
        getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A:AA`, 'UNFORMATTED_VALUE'),
        getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A:N`, 'UNFORMATTED_VALUE'),
      ]);

      if (keluargaRaw.length <= 1) {
        return NextResponse.json({ success: true, message: 'Data KPM kosong', count: 0 });
      }

      // 1. Bangun peta data anggota
      const anggotaByNIK = new Map<string, string>(); // NIK -> NoKK
      const anggotaByKKPengurus = new Map<string, string>(); // NoKK -> NIK
      const anggotaByNama = new Map<string, { nik: string; noKK: string }>();

      for (let i = 1; i < anggotaRaw.length; i++) {
        const row = anggotaRaw[i];
        const kk = cleanTextCell(row[1]);
        const nik = cleanTextCell(row[2]);
        const nama = cleanTextCell(row[3]).toLowerCase();
        const hub = cleanTextCell(row[7]).toLowerCase();

        if (nik && validateNIK(nik) && kk && validateNoKK(kk)) {
          anggotaByNIK.set(nik, kk);
          if (hub === 'kepala keluarga' || hub.includes('pengurus')) {
            anggotaByKKPengurus.set(kk, nik);
          }
          if (nama) {
            anggotaByNama.set(nama, { nik, noKK: kk });
          }
        }
      }

      const updates: { range: string; values: string[][] }[] = [];
      let repairedCount = 0;

      for (let i = 1; i < keluargaRaw.length; i++) {
        const row = keluargaRaw[i];
        const rowNum = i + 1;
        const rawNik = row[1];
        const rawKK = row[2];
        const nama = cleanTextCell(row[3]).toLowerCase();

        let cleanNik = cleanTextCell(rawNik);
        let cleanKK = cleanTextCell(rawKK);
        let needsUpdate = false;

        // 1. Pulihkan No. KK jika bermasalah
        const isKKCorrupted = !cleanKK || cleanKK.length !== 16 || /e[+-]?\d+/i.test(String(rawKK)) || cleanKK.endsWith('00000000');
        if (isKKCorrupted) {
          // Cari dari data anggota berdasarkan NIK
          if (cleanNik && validateNIK(cleanNik) && anggotaByNIK.has(cleanNik)) {
            cleanKK = anggotaByNIK.get(cleanNik)!;
            needsUpdate = true;
          } else if (nama && anggotaByNama.has(nama)) {
            cleanKK = anggotaByNama.get(nama)!.noKK;
            needsUpdate = true;
          } else if (typeof rawKK === 'number' && rawKK >= 1e11) {
            cleanKK = BigInt(Math.round(rawKK)).toString();
            needsUpdate = true;
          }
        }

        // 2. Pulihkan NIK jika bermasalah
        const isNikCorrupted = !cleanNik || cleanNik.length !== 16 || /e[+-]?\d+/i.test(String(rawNik)) || cleanNik.endsWith('00000000');
        if (isNikCorrupted) {
          if (cleanKK && validateNoKK(cleanKK) && anggotaByKKPengurus.has(cleanKK)) {
            cleanNik = anggotaByKKPengurus.get(cleanKK)!;
            needsUpdate = true;
          } else if (nama && anggotaByNama.has(nama)) {
            cleanNik = anggotaByNama.get(nama)!.nik;
            needsUpdate = true;
          } else if (typeof rawNik === 'number' && rawNik >= 1e11) {
            cleanNik = BigInt(Math.round(rawNik)).toString();
            needsUpdate = true;
          }
        }

        // 3. Pastikan sel tersimpan sebagai plain text dengan prefix apostrof (')
        if (!String(rawNik).startsWith("'") || !String(rawKK).startsWith("'")) {
          needsUpdate = true;
        }

        if (needsUpdate && (cleanNik || cleanKK)) {
          updates.push({
            range: `${KPM_SHEET_KELUARGA}!B${rowNum}:C${rowNum}`,
            values: [[formatTextCell(cleanNik), formatTextCell(cleanKK)]],
          });
          repairedCount++;
        }
      }

      if (updates.length > 0) {
        const BATCH_SIZE = 100;
        for (let b = 0; b < updates.length; b += BATCH_SIZE) {
          const chunk = updates.slice(b, b + BATCH_SIZE);
          await batchUpdateSheetValues(accessToken, spreadsheetId, chunk);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil memulihkan dan memformat ${repairedCount} data NIK/KK menjadi teks murni di Google Sheets.`,
        count: repairedCount,
      });
    }

    return NextResponse.json({ error: 'Action not supported' }, { status: 400 });
  } catch (error) {
    console.error('KPM PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
