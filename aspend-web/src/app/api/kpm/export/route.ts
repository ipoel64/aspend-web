import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import { getSheetData } from '@/lib/google-sheets';
import {
  KPM_SHEET_KELUARGA,
  KPM_SHEET_ANGGOTA,
  KPM_SHEET_ASET,
  parseKeluargaRow,
  parseAnggotaRow,
  parseAsetRow,
  PERNYATAAN_OPTIONS,
} from '@/lib/kpm-constants';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'excel-all';
    const noKK = searchParams.get('noKK');

    // Case 1: Download Template Excel Impor (Keluarga, Anggota, atau Aset)
    if (type === 'template') {
      const target = searchParams.get('target') || 'keluarga';
      const wb = XLSX.utils.book_new();

      if (target === 'anggota') {
        const templateData = [
          {
            'No. KK (16 Digit)': '1271010000000002',
            'NIK Anggota (16 Digit)': '1271010000000005',
            'Nama Anggota': 'CONTOH NAMA ANGGOTA',
            'Jenis Kelamin': 'Laki-laki',
            'Tanggal Lahir': '2015-05-12',
            'Hubungan Keluarga': 'Anak',
            'Komponen PKH': 'Anak SD',
            'Nama Posyandu': '',
            'Nama Sekolah': 'SDN 01 BINJAI',
            'Kelas': 'Kelas 4',
            'Pekerjaan': '',
            'Keterangan': 'Penerima bantuan PIP',
          },
          {
            'No. KK (16 Digit)': '1271010000000002',
            'NIK Anggota (16 Digit)': '1271010000000006',
            'Nama Anggota': 'CONTOH BALITA',
            'Jenis Kelamin': 'Perempuan',
            'Tanggal Lahir': '2023-08-20',
            'Hubungan Keluarga': 'Anak',
            'Komponen PKH': 'Balita',
            'Nama Posyandu': 'Posyandu Melati',
            'Nama Sekolah': '',
            'Kelas': '',
            'Pekerjaan': '',
            'Keterangan': 'Imunisasi lengkap',
          },
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        ws['!cols'] = [
          { wch: 22 }, // No KK
          { wch: 24 }, // NIK Anggota
          { wch: 26 }, // Nama Anggota
          { wch: 16 }, // Jenis Kelamin
          { wch: 16 }, // Tanggal Lahir
          { wch: 20 }, // Hubungan
          { wch: 18 }, // Komponen
          { wch: 20 }, // Posyandu
          { wch: 22 }, // Sekolah
          { wch: 14 }, // Kelas
          { wch: 20 }, // Pekerjaan
          { wch: 25 }, // Keterangan
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Template_Anggota_KPM');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="Template_Impor_Anggota_KPM.xlsx"',
          },
        });
      } else if (target === 'aset') {
        const templateData = [
          {
            'No. KK (16 Digit)': '1271010000000002',
            'Status Rumah': 'Milik Sendiri',
            'Kepemilikan Usaha': 'Memiliki Usaha',
            'Jenis Usaha': 'Warung Kelontong',
            'Tahun Terima Bansos': '2019',
            'Latitude (GPS)': '3.595196',
            'Longitude (GPS)': '98.672223',
            'Keterangan': 'Rumah semi permanen dinding tepas',
          },
          {
            'No. KK (16 Digit)': '1271010000000004',
            'Status Rumah': 'Numpang',
            'Kepemilikan Usaha': 'Tidak Memiliki Usaha',
            'Jenis Usaha': '',
            'Tahun Terima Bansos': '2021',
            'Latitude (GPS)': '3.597840',
            'Longitude (GPS)': '98.674510',
            'Keterangan': 'Tinggal bersama orang tua',
          },
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        ws['!cols'] = [
          { wch: 22 }, // No KK
          { wch: 18 }, // Status Rumah
          { wch: 22 }, // Usaha
          { wch: 22 }, // Jenis Usaha
          { wch: 20 }, // Tahun Bansos
          { wch: 18 }, // Latitude
          { wch: 18 }, // Longitude
          { wch: 30 }, // Keterangan
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Template_Aset_KPM');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="Template_Impor_Aset_KPM.xlsx"',
          },
        });
      } else {
        // Default: Template Data Keluarga KPM
        const templateData = [
          {
            'No. KK (16 Digit)': '1271010000000002',
            'NIK (16 Digit)': '1271010000000001',
            'Nama Pengurus': 'CONTOH NAMA PENGURUS',
            'Alamat': 'Jl. Merdeka No. 10',
            'Lingkungan': 'Lingkungan I',
            'Provinsi': 'SUMATERA UTARA',
            'Kab/Kota': 'KOTA BINJAI',
            'Kecamatan': 'BINJAI KOTA',
            'Kelurahan': 'KARTINI',
            'No. HP': '08123456789',
            'Kelompok': 'Kelompok Mawar Indah',
            'Status Kelompok': 'Ketua Kelompok',
            'Tahap Bansos': 'Tahap 1 (2026)',
            'Status Kepesertaan': 'Aktif',
            'Pernyataan': PERNYATAAN_OPTIONS[0],
          },
          {
            'No. KK (16 Digit)': '1271010000000004',
            'NIK (16 Digit)': '1271010000000003',
            'Nama Pengurus': 'CONTOH ANGGOTA LAIN',
            'Alamat': 'Jl. Diponegoro No. 25',
            'Lingkungan': 'Lingkungan II',
            'Provinsi': 'SUMATERA UTARA',
            'Kab/Kota': 'KOTA BINJAI',
            'Kecamatan': 'BINJAI KOTA',
            'Kelurahan': 'KARTINI',
            'No. HP': '08219876543',
            'Kelompok': 'Kelompok Mawar Indah',
            'Status Kelompok': 'Anggota',
            'Tahap Bansos': 'Tahap 1 (2026)',
            'Status Kepesertaan': 'Aktif',
            'Pernyataan': '',
          },
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        ws['!cols'] = [
          { wch: 22 }, // No KK
          { wch: 22 }, // NIK
          { wch: 26 }, // Nama Pengurus
          { wch: 30 }, // Alamat
          { wch: 18 }, // Lingkungan
          { wch: 20 }, // Provinsi
          { wch: 18 }, // Kab/Kota
          { wch: 18 }, // Kecamatan
          { wch: 18 }, // Kelurahan
          { wch: 16 }, // No HP
          { wch: 24 }, // Kelompok
          { wch: 16 }, // Status Kelompok
          { wch: 18 }, // Tahap Bansos
          { wch: 18 }, // Status Kepesertaan
          { wch: 60 }, // Pernyataan
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Template_Keluarga_KPM');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="Template_Impor_KPM_ASPEND.xlsx"',
          },
        });
      }
    }

    // Case 2 & 3: Export Real Data dari Google Sheets
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const spreadsheetId = await findAspendSpreadsheet(accessToken);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet not found' }, { status: 404 });
    }

    const [rawKeluarga, rawAnggota, rawAset] = await Promise.all([
      getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A2:AA`).catch(() => []),
      getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A2:N`).catch(() => []),
      getSheetData(accessToken, spreadsheetId, `${KPM_SHEET_ASET}!A2:M`).catch(() => []),
    ]);

    let keluargaList = rawKeluarga.filter((r) => r.length > 0).map(parseKeluargaRow);
    let anggotaList = rawAnggota.filter((r) => r.length > 0).map(parseAnggotaRow);
    let asetList = rawAset.filter((r) => r.length > 0).map(parseAsetRow);

    // Jika filter per keluarga
    if (type === 'excel-family' && noKK) {
      keluargaList = keluargaList.filter((k) => k.NoKK === noKK);
      anggotaList = anggotaList.filter((a) => a.NoKK === noKK);
      asetList = asetList.filter((ast) => ast.NoKK === noKK);
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Data Keluarga
    const keluargaRows = keluargaList.map((k, i) => ({
      No: i + 1,
      NIK: k.NIK,
      'No. KK': k.NoKK,
      'Nama Pengurus': k.NamaPengurus,
      Alamat: k.Alamat,
      Lingkungan: k.Lingkungan,
      Provinsi: k.Provinsi,
      'Kab/Kota': k.KabKota,
      Kecamatan: k.Kecamatan,
      Kelurahan: k.Kelurahan,
      'No. HP': k.NoHP,
      Kelompok: k.Kelompok,
      'Status Kelompok': k.StatusKelompok,
      'Status Kepesertaan': k.StatusKepesertaan || 'Aktif',
      'Tahap Bansos': k.TahapBansos || 'Tahap 1 (2026)',
      'Status Data': k.StatusData,
      'Catatan Temuan': k.CatatanTemuan || '[]',
      Pernyataan: k.Pernyataan,
    }));
    const wsKeluarga = XLSX.utils.json_to_sheet(keluargaRows);
    XLSX.utils.book_append_sheet(wb, wsKeluarga, 'Data_Keluarga');

    // Sheet 2: Data Anggota
    const anggotaRows = anggotaList.map((a, i) => ({
      No: i + 1,
      'No. KK': a.NoKK,
      NIK: a.NIK,
      'Nama Anggota': a.Nama,
      'Jenis Kelamin': a.JenisKelamin,
      'Tanggal Lahir': a.TanggalLahir,
      'Komponen PKH': a.Komponen,
      'Hubungan Keluarga': a.HubunganKeluarga,
      Posyandu: a.Posyandu,
      Sekolah: a.Sekolah,
      Kelas: a.Kelas,
      Pekerjaan: a.Pekerjaan,
    }));
    const wsAnggota = XLSX.utils.json_to_sheet(anggotaRows);
    XLSX.utils.book_append_sheet(wb, wsAnggota, 'Data_Anggota');

    // Sheet 3: Data Aset
    const asetRows = asetList.map((ast, i) => ({
      No: i + 1,
      'No. KK': ast.NoKK,
      'Status Rumah': ast.StatusRumah,
      Usaha: ast.Usaha,
      'Jenis Usaha': ast.JenisUsaha,
      'Latitude (GPS)': ast.Latitude,
      'Longitude (GPS)': ast.Longitude,
      'Tahun Terima Bansos': ast.TahunMenerimaBansos,
    }));
    const wsAset = XLSX.utils.json_to_sheet(asetRows);
    XLSX.utils.book_append_sheet(wb, wsAset, 'Data_Aset_Rumah');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fileName =
      type === 'excel-family' && keluargaList[0]
        ? `Profil_KPM_${keluargaList[0].NamaPengurus.replace(/\s+/g, '_')}_${keluargaList[0].NoKK}.xlsx`
        : `Rekap_Seluruh_KPM_PKH_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('KPM Export GET error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengekspor data KPM' }, { status: 500 });
  }
}
