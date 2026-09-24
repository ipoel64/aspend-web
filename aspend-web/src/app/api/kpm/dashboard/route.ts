import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import { batchGetSheetData } from '@/lib/google-sheets';
import {
  KPM_SHEET_KELUARGA,
  KPM_SHEET_ANGGOTA,
  KPM_SHEET_ASET,
  KPM_SHEET_GRADUASI,
  KPM_SHEET_PERMASALAHAN,
  parseKeluargaRow,
  parseAnggotaRow,
  parseAsetRow,
  parseGraduasiRow,
  parsePermasalahanRow,
  isKpmDataLengkap,
  isKpmAnggotaLengkap,
  isKpmAsetLengkap,
  normalizeKK,
  KpmAnggota,
  KpmAset,
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

    // Ambil data seluruh 5 sheet sekaligus dalam 1 panggilan API tunggal (batchGet)
    // Mengeliminasi rate limit quota dan mempercepat waktu muat menjadi sub-detik
    const ranges = [
      `${KPM_SHEET_KELUARGA}!A2:AA`,
      `${KPM_SHEET_ANGGOTA}!A2:N`,
      `${KPM_SHEET_ASET}!A2:M`,
      `${KPM_SHEET_GRADUASI}!A2:L`,
      `${KPM_SHEET_PERMASALAHAN}!A2:J`,
    ];

    const results = await batchGetSheetData(accessToken, spreadsheetId, ranges);
    const rawKeluarga = results[0] || [];
    const rawAnggota = results[1] || [];
    const rawAset = results[2] || [];
    const rawGraduasi = results[3] || [];
    const rawMasalah = results[4] || [];

    const rawParsedKeluarga = rawKeluarga.filter((r) => r.length > 0).map(parseKeluargaRow);
    const anggotaList = rawAnggota.filter((r) => r.length > 0).map(parseAnggotaRow);
    const asetList = rawAset.filter((r) => r.length > 0).map(parseAsetRow);
    const graduasiList = rawGraduasi.filter((r) => r.length > 0).map(parseGraduasiRow);
    const masalahList = rawMasalah.filter((r) => r.length > 0).map(parsePermasalahanRow);

    const keluargaList = rawParsedKeluarga;

    // Hitung ringkasan dengan aturan kelengkapan dinamis 3 pilar
    const totalKpm = keluargaList.length;

    const anggotaByKK = new Map<string, KpmAnggota[]>();
    const anggotaByNIK = new Map<string, KpmAnggota>();
    for (const a of anggotaList) {
      const rawKK = a.NoKK?.trim();
      const normKK = normalizeKK(a.NoKK);
      if (rawKK) {
        if (!anggotaByKK.has(rawKK)) anggotaByKK.set(rawKK, []);
        anggotaByKK.get(rawKK)!.push(a);
      }
      if (normKK && normKK !== rawKK) {
        if (!anggotaByKK.has(normKK)) anggotaByKK.set(normKK, []);
        anggotaByKK.get(normKK)!.push(a);
      }
      if (a.NIK?.trim()) {
        anggotaByNIK.set(a.NIK.trim(), a);
      }
    }

    const asetByKK = new Map<string, KpmAset>();
    for (const ast of asetList) {
      const rawKK = ast.NoKK?.trim();
      const normKK = normalizeKK(ast.NoKK);
      if (rawKK && !asetByKK.has(rawKK)) asetByKK.set(rawKK, ast);
      if (normKK && !asetByKK.has(normKK)) asetByKK.set(normKK, ast);
    }

    let lengkapCount = 0;
    let belumLengkapCount = 0;
    let verifikasiCount = 0;

    for (const k of keluargaList) {
      if (k.StatusData === 'Verifikasi') {
        verifikasiCount++;
      } else {
        const rawKK = k.NoKK?.trim() || '';
        const normKK = normalizeKK(k.NoKK);
        let familyAnggota = (rawKK && anggotaByKK.get(rawKK)) || (normKK && anggotaByKK.get(normKK)) || [];
        let linkedRealKK = '';
        if (k.NIK?.trim() && anggotaByNIK.has(k.NIK.trim())) {
          const match = anggotaByNIK.get(k.NIK.trim())!;
          if (match.NoKK) {
            linkedRealKK = match.NoKK.trim();
            if (familyAnggota.length === 0) {
              familyAnggota = anggotaByKK.get(linkedRealKK) || (normalizeKK(linkedRealKK) && anggotaByKK.get(normalizeKK(linkedRealKK))) || [];
            }
          }
        }

        const familyAset =
          (rawKK && asetByKK.get(rawKK)) ||
          (normKK && asetByKK.get(normKK)) ||
          (linkedRealKK && asetByKK.get(linkedRealKK)) ||
          (linkedRealKK && normalizeKK(linkedRealKK) && asetByKK.get(normalizeKK(linkedRealKK))) ||
          null;

        const isComplete =
          isKpmDataLengkap(k) &&
          isKpmAnggotaLengkap(familyAnggota).isLengkap &&
          isKpmAsetLengkap(familyAset).isLengkap;

        if (isComplete) {
          lengkapCount++;
        } else {
          belumLengkapCount++;
        }
      }
    }

    // Kumpulkan seluruh No. KK atau ID KPM yang sudah graduasi dari graduasiList & keluargaList
    const graduasiKkSet = new Set<string>();
    for (const g of graduasiList) {
      const st = (g.StatusGraduasi || '').trim();
      if (st === 'Sudah Graduasi' || st === 'Graduasi Mandiri' || st === 'Graduasi Alami') {
        if (g.NoKK) graduasiKkSet.add(g.NoKK.trim());
      }
    }
    for (const k of keluargaList) {
      const isGrad =
        k.StatusKepesertaan === 'Graduasi' ||
        k.StatusGraduasi === 'Sudah Graduasi' ||
        k.StatusGraduasi === 'Graduasi Mandiri' ||
        k.StatusGraduasi === 'Graduasi Alami' ||
        k.CatatanTemuan?.includes('Sudah Graduasi');
      if (isGrad) {
        if (k.NoKK) graduasiKkSet.add(k.NoKK.trim());
        else if (k.NIK) graduasiKkSet.add(k.NIK.trim());
        else if (k.KpmId) graduasiKkSet.add(k.KpmId);
      }
    }
    const graduasiCount = Math.max(
      graduasiKkSet.size,
      graduasiList.filter(
        (g) => g.StatusGraduasi === 'Sudah Graduasi' || g.StatusGraduasi === 'Graduasi Mandiri' || g.StatusGraduasi === 'Graduasi Alami'
      ).length
    );
    const masalahCount = masalahList.filter((m) => m.Status !== 'Selesai').length;

    // Breakdown Status Kepesertaan (Aktif vs Graduasi/Tidak Aktif)
    let aktifCount = 0;
    let tidakAktifCount = 0;
    for (const k of keluargaList) {
      const isGrad =
        k.StatusKepesertaan === 'Graduasi' ||
        k.StatusGraduasi === 'Sudah Graduasi' ||
        k.StatusGraduasi === 'Graduasi Mandiri' ||
        k.StatusGraduasi === 'Graduasi Alami' ||
        k.CatatanTemuan?.includes('Sudah Graduasi') ||
        k.StatusKepesertaan === 'Tidak Aktif';
      if (isGrad) tidakAktifCount++;
      else aktifCount++;
    }

    // Breakdown per Tahap Bansos
    const tahapBreakdown: Record<string, number> = {
      'Tahap 1': 0,
      'Tahap 2': 0,
      'Tahap 3': 0,
      'Tahap 4': 0,
    };
    for (const k of keluargaList) {
      const tb = (k.TahapBansos || 'Tahap 1').toLowerCase();
      let matched = false;
      for (const t of ['1', '2', '3', '4']) {
        if (tb.includes(`tahap ${t}`) || tb.includes(`thp-${t}`) || tb.includes(`t${t}`)) {
          tahapBreakdown[`Tahap ${t}`] = (tahapBreakdown[`Tahap ${t}`] || 0) + 1;
          matched = true;
        }
      }
      if (!matched) {
        tahapBreakdown['Tahap 1'] = (tahapBreakdown['Tahap 1'] || 0) + 1;
      }
    }

    // Breakdown per Kelompok
    const kelompokBreakdown: Record<string, number> = {};
    for (const k of keluargaList) {
      const kel = k.Kelompok?.trim() || 'Tanpa Kelompok';
      kelompokBreakdown[kel] = (kelompokBreakdown[kel] || 0) + 1;
    }

    // Breakdown per Komponen PKH
    const komponenBreakdown: Record<string, number> = {};
    for (const a of anggotaList) {
      if (a.Komponen && a.Komponen.trim() !== '') {
        komponenBreakdown[a.Komponen] = (komponenBreakdown[a.Komponen] || 0) + 1;
      }
    }

    // Breakdown Status Graduasi
    const graduasiBreakdown: Record<string, number> = {};
    for (const g of graduasiList) {
      const st = g.StatusGraduasi?.trim() || 'Belum Graduasi';
      graduasiBreakdown[st] = (graduasiBreakdown[st] || 0) + 1;
    }
    for (const k of keluargaList) {
      const isGrad =
        k.StatusKepesertaan === 'Graduasi' ||
        k.StatusGraduasi === 'Sudah Graduasi' ||
        k.StatusGraduasi === 'Graduasi Mandiri' ||
        k.StatusGraduasi === 'Graduasi Alami' ||
        k.CatatanTemuan?.includes('Sudah Graduasi');
      if (isGrad) {
        const rawKK = k.NoKK?.trim();
        const alreadyInGraduasiList = rawKK && graduasiList.some((g) => g.NoKK?.trim() === rawKK);
        if (!alreadyInGraduasiList) {
          const st = k.StatusGraduasi?.trim() || 'Sudah Graduasi';
          graduasiBreakdown[st] = (graduasiBreakdown[st] || 0) + 1;
        }
      }
    }

    // Markers untuk peta
    const asetMap = new Map<string, (typeof asetList)[0]>();
    for (const ast of asetList) {
      if (ast.NoKK) asetMap.set(ast.NoKK, ast);
    }

    const markers = keluargaList
      .map((k) => {
        const ast = asetMap.get(k.NoKK);
        const lat = parseFloat(ast?.Latitude || '0');
        const lng = parseFloat(ast?.Longitude || '0');
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          const isGradK =
            k.StatusKepesertaan === 'Graduasi' ||
            k.StatusGraduasi === 'Sudah Graduasi' ||
            k.StatusGraduasi === 'Graduasi Mandiri' ||
            k.StatusGraduasi === 'Graduasi Alami' ||
            k.CatatanTemuan?.includes('Sudah Graduasi');
          const fotoRumah =
            ast?.FotoRumahLuar ||
            ast?.FotoRumahDalam ||
            k.FotoRumah ||
            k.FotoKTP ||
            '';

          return {
            kpmId: k.KpmId,
            nik: k.NIK,
            noKK: k.NoKK,
            namaPengurus: k.NamaPengurus,
            kelompok: k.Kelompok,
            alamat: `${k.Alamat || ''}, ${k.Kelurahan || ''}, ${k.Kecamatan || ''}`,
            statusData: k.StatusData,
            statusKepesertaan: isGradK ? 'Graduasi' : (k.StatusKepesertaan || 'Aktif'),
            fotoRumah,
            lat,
            lng,
          };
        }
        return null;
      })
      .filter(Boolean);

    // KPM Terbaru (10 data)
    const recentKpm = [...keluargaList].reverse().slice(0, 10);

    return NextResponse.json({
      summary: {
        totalKpm,
        lengkapCount,
        belumLengkapCount,
        verifikasiCount,
        graduasiCount,
        masalahCount,
        aktifCount,
        tidakAktifCount,
        totalAnggota: anggotaList.length,
      },
      tahapBreakdown,
      kelompokBreakdown,
      komponenBreakdown,
      graduasiBreakdown,
      markers,
      recentKpm,
    });
  } catch (error) {
    console.error('KPM Dashboard GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
