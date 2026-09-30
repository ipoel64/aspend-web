import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import { getSheetData, updateSheetRow, appendSheetData } from '@/lib/google-sheets';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const PROFILE_HEADERS = [
  'Email',
  'Nama Lengkap',
  'NIP',
  'Jabatan',
  'Kabupaten/Kota',
  'Tanda Tangan ID',
  'Foto Profil ID',
  'Logo ID',
  'Jenis SDM',
  'Provinsi',
  'Kecamatan'
];

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
      nama = '',
      nip = '',
      jenisSdm = 'SDM PKH',
      jabatan = 'Pendamping PKH',
      provinsi = '',
      kabupaten = '',
      kecamatan = '',
      photoFileId = '',
      signatureFileId = '',
      logoFileId = ''
    } = body;

    const spreadsheetId = await findAspendSpreadsheet(accessToken as string);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet database Aspend tidak ditemukan.' }, { status: 404 });
    }

    const email = session.user?.email || '';

    // 1. Baca data sheet Profile saat ini
    let profileRows: any[][] = [];
    try {
      profileRows = await getSheetData(accessToken as string, spreadsheetId, 'Profile!A1:K');
    } catch {
      // Jika tab Profile belum ada, buat tab dan header
      try {
        await appendSheetData(accessToken as string, spreadsheetId, 'Profile!A1:K1', [PROFILE_HEADERS]);
      } catch (sheetCreateErr) {
        console.warn('Gagal inisialisasi sheet Profile:', sheetCreateErr);
      }
    }

    // Tentukan baris target
    let rowIndex = 2; // Default baris ke-2 (setelah header)
    let existingRow: any[] = [];

    if (profileRows && profileRows.length > 1) {
      let foundIndex = -1;
      for (let i = 1; i < profileRows.length; i++) {
        const row = profileRows[i];
        if (row[0] && row[0].toString().trim().toLowerCase() === email.toLowerCase()) {
          foundIndex = i + 1; // 1-based index
          existingRow = row;
          break;
        }
      }
      if (foundIndex > 0) {
        rowIndex = foundIndex;
      } else {
        rowIndex = profileRows.length + 1;
      }
    }

    // Jika jenis SDM adalah TKSK, jabatan dikosongkan sesuai aturan Kemensos
    const finalJabatan = jenisSdm === 'TKSK' ? '' : (jabatan || 'Pendamping PKH');

    // Pertahankan foto/tanda tangan yang sudah ada jika tidak diperbarui
    const finalSigId = signatureFileId || existingRow[5] || '';
    const finalPhotoId = photoFileId || existingRow[6] || '';
    const finalLogoId = logoFileId || existingRow[7] || '';

    const updatedRow = [
      email,                                    // A: Email
      nama.trim(),                              // B: Nama Lengkap
      nip.trim(),                               // C: NIP
      finalJabatan.trim(),                      // D: Jabatan
      kabupaten.trim(),                         // E: Kabupaten/Kota
      finalSigId,                               // F: Tanda Tangan ID
      finalPhotoId,                             // G: Foto Profil ID
      finalLogoId,                              // H: Logo ID
      jenisSdm.trim() || 'SDM PKH',             // I: Jenis SDM
      provinsi.trim(),                          // J: Provinsi
      kecamatan.trim(),                         // K: Kecamatan
    ];

    if (existingRow.length > 0) {
      await updateSheetRow(
        accessToken as string,
        spreadsheetId,
        `Profile!A${rowIndex}:K${rowIndex}`,
        [updatedRow]
      );
    } else {
      // Tambah baris baru jika belum ada
      await appendSheetData(
        accessToken as string,
        spreadsheetId,
        'Profile!A:K',
        [updatedRow]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profil pengguna berhasil disimpan!',
      profile: {
        email,
        nama: nama.trim(),
        nip: nip.trim(),
        jenisSdm: jenisSdm.trim() || 'SDM PKH',
        jabatan: finalJabatan.trim(),
        provinsi: provinsi.trim(),
        kabupaten: kabupaten.trim(),
        kecamatan: kecamatan.trim(),
        photoFileId: finalPhotoId,
        signatureFileId: finalSigId,
      }
    });
  } catch (error: any) {
    console.error('Error saving profile:', error);
    return NextResponse.json({ error: error.message || 'Gagal menyimpan profil pengguna.' }, { status: 500 });
  }
}
