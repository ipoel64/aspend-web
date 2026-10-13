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
  'Kecamatan',
  'Jabatan ASN'
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
      jabatanAsn = '',
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
      profileRows = await getSheetData(accessToken as string, spreadsheetId, 'Profile!A1:L');
    } catch {
      // Jika tab Profile belum ada, buat tab dan header
      try {
        await appendSheetData(accessToken as string, spreadsheetId, 'Profile!A1:L1', [PROFILE_HEADERS]);
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
    const finalJabatanAsn = jabatanAsn !== undefined ? (jabatanAsn || '').trim() : (existingRow[11] || '').trim();

    const updatedRow = [
      email,                                    // A: Email (0)
      nama.trim(),                              // B: Nama Lengkap (1)
      nip.trim(),                               // C: NIP (2)
      finalJabatan.trim(),                      // D: Jabatan (3)
      kabupaten.trim(),                         // E: Kabupaten/Kota (4)
      finalSigId,                               // F: Tanda Tangan ID (5)
      finalPhotoId,                             // G: Foto Profil ID (6)
      finalLogoId,                              // H: Logo ID (7)
      jenisSdm.trim() || 'SDM PKH',             // I: Jenis SDM (8)
      provinsi.trim(),                          // J: Provinsi (9)
      kecamatan.trim(),                         // K: Kecamatan (10)
      finalJabatanAsn,                          // L: Jabatan ASN (11)
    ];

    if (existingRow.length > 0) {
      await updateSheetRow(
        accessToken as string,
        spreadsheetId,
        `Profile!A${rowIndex}:L${rowIndex}`,
        [updatedRow]
      );
    } else {
      // Tambah baris baru jika belum ada
      await appendSheetData(
        accessToken as string,
        spreadsheetId,
        'Profile!A:L',
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
        jabatanAsn: finalJabatanAsn,
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
