import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import { getSheetData, updateSheetRow, appendSheetData, findRowByKey } from '@/lib/google-sheets';
import {
  KPM_SHEET_KELUARGA,
  KPM_SHEET_ANGGOTA,
  KPM_SHEET_ASET,
  parseKeluargaRow,
  keluargaToRow,
  asetToRow,
  anggotaToRow,
  generateAnggotaId,
  generateAsetId,
  KpmKeluarga,
  KpmAset,
  KpmAnggota,
} from '@/lib/kpm-constants';
import crypto from 'crypto';

const SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'aspend-secret-kpm-portal-2026';

function encryptToken(payload: any): string {
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    crypto.createHash('sha256').update(SECRET).digest(),
    Buffer.alloc(16, 0)
  );
  let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return Buffer.from(encrypted).toString('base64url');
}

function decryptToken(tokenStr: string): any | null {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(SECRET).digest(),
      Buffer.alloc(16, 0)
    );
    const raw = Buffer.from(tokenStr, 'base64url').toString('utf8');
    let decrypted = decipher.update(raw, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

async function getAccessTokenFromRefreshToken(refreshToken: string): Promise<string | null> {
  try {
    const url = 'https://oauth2.googleapis.com/token';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const data = await response.json();
    return data.access_token || null;
  } catch (err) {
    console.error('Error refreshing token in portal route:', err);
    return null;
  }
}

// GET: Generate link (oleh pendamping) ATAU ambil data KPM saat login portal
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Action 1: Pendamping membuat link portal untuk KPM
    if (action === 'generate-link') {
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

      const nik = searchParams.get('nik');
      if (!nik) {
        return NextResponse.json({ error: 'NIK wajib diisi' }, { status: 400 });
      }

      // @ts-expect-error - refreshToken may exist in token
      const refreshToken = session?.refreshToken || '';

      const payload = {
        spreadsheetId,
        nik,
        refreshToken,
        generatedAt: Date.now(),
      };

      const token = encryptToken(payload);
      return NextResponse.json({ token, nik });
    }

    // Action 2: KPM mengambil data awal setelah memasukkan NIK & Password
    if (action === 'kpm-data') {
      const token = searchParams.get('token');
      const nik = searchParams.get('nik');
      const password = searchParams.get('password') || '123456';

      let spreadsheetId = '';
      let activeToken = '';

      if (token) {
        const decoded = decryptToken(token);
        if (decoded) {
          spreadsheetId = decoded.spreadsheetId;
          if (decoded.refreshToken) {
            activeToken = (await getAccessTokenFromRefreshToken(decoded.refreshToken)) || '';
          }
        }
      }

      // Fallback: Jika pendamping sedang login di browser yang sama
      if (!activeToken) {
        const session = await auth();
        // @ts-expect-error
        activeToken = session?.accessToken || '';
        if (activeToken && !spreadsheetId) {
          spreadsheetId = (await findAspendSpreadsheet(activeToken)) || '';
        }
      }

      if (!spreadsheetId || !activeToken) {
        return NextResponse.json(
          { error: 'Tautan formulir tidak valid atau sesi pendamping telah berakhir.' },
          { status: 400 }
        );
      }

      // Cari KPM berdasarkan NIK
      const rawKeluarga = await getSheetData(activeToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A2:AA`);
      const keluargaList = rawKeluarga.filter((r) => r.length > 0).map(parseKeluargaRow);

      const found = keluargaList.find((k) => k.NIK === nik);
      if (!found) {
        return NextResponse.json({ error: 'NIK KPM tidak terdaftar dalam database.' }, { status: 404 });
      }

      // Verifikasi password (default: 123456)
      const validPassword = found.Password || '123456';
      if (password !== validPassword) {
        return NextResponse.json({ error: 'Password salah. Default: 123456' }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        data: found,
      });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (error) {
    console.error('KPM Portal GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: KPM melengkapi dan menyimpan datanya secara mandiri
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, nik, password, dataKeluarga, dataAnggota, dataAset } = body;

    let spreadsheetId = '';
    let activeToken = '';

    if (token) {
      const decoded = decryptToken(token);
      if (decoded) {
        spreadsheetId = decoded.spreadsheetId;
        if (decoded.refreshToken) {
          activeToken = (await getAccessTokenFromRefreshToken(decoded.refreshToken)) || '';
        }
      }
    }

    if (!activeToken) {
      const session = await auth();
      // @ts-expect-error
      activeToken = session?.accessToken || '';
      if (activeToken && !spreadsheetId) {
        spreadsheetId = (await findAspendSpreadsheet(activeToken)) || '';
      }
    }

    if (!spreadsheetId || !activeToken) {
      return NextResponse.json({ error: 'Otorisasi portal gagal' }, { status: 401 });
    }

    // 1. Validasi NIK dan update Data Keluarga
    const rowIndex = await findRowByKey(activeToken, spreadsheetId, KPM_SHEET_KELUARGA, nik, 1);
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Data KPM tidak ditemukan' }, { status: 404 });
    }

    const rawRows = await getSheetData(activeToken, spreadsheetId, `${KPM_SHEET_KELUARGA}!A${rowIndex}:AA${rowIndex}`);
    const existing = parseKeluargaRow(rawRows[0] || []);

    const updatedKeluarga: KpmKeluarga = {
      ...existing,
      ...dataKeluarga,
      NIK: existing.NIK,
      NoKK: dataKeluarga?.NoKK || existing.NoKK,
      NamaPengurus: dataKeluarga?.NamaPengurus || existing.NamaPengurus,
      StatusData: 'Lengkap',
      UpdatedAt: new Date().toISOString(),
    };

    await updateSheetRow(
      activeToken,
      spreadsheetId,
      `${KPM_SHEET_KELUARGA}!A${rowIndex}:AA${rowIndex}`,
      [keluargaToRow(updatedKeluarga)]
    );

    // 2. Simpan atau Update Aset
    if (dataAset && updatedKeluarga.NoKK) {
      const asetRowIdx = await findRowByKey(activeToken, spreadsheetId, KPM_SHEET_ASET, updatedKeluarga.NoKK, 1);
      if (asetRowIdx > 1) {
        const rawAset = await getSheetData(activeToken, spreadsheetId, `${KPM_SHEET_ASET}!A${asetRowIdx}:M${asetRowIdx}`);
        const existingAset = rawAset[0] || [];
        const newAsetData: KpmAset = {
          AsetId: existingAset[0] || generateAsetId(),
          NoKK: updatedKeluarga.NoKK,
          StatusRumah: dataAset.StatusRumah || existingAset[2] || 'Milik Sendiri',
          Usaha: dataAset.Usaha || existingAset[3] || 'Tidak Memiliki Usaha',
          JenisUsaha: dataAset.JenisUsaha || existingAset[4] || '',
          FotoUsaha: dataAset.FotoUsaha || existingAset[5] || '',
          FotoRumahLuar: dataAset.FotoRumahLuar || existingAset[6] || '',
          FotoRumahDalam: dataAset.FotoRumahDalam || existingAset[7] || '',
          Latitude: dataAset.Latitude || existingAset[8] || '',
          Longitude: dataAset.Longitude || existingAset[9] || '',
          TahunMenerimaBansos: dataAset.TahunMenerimaBansos || existingAset[10] || '',
          Keterangan: dataAset.Keterangan || existingAset[11] || '',
          CreatedAt: existingAset[12] || new Date().toISOString(),
        };
        await updateSheetRow(
          activeToken,
          spreadsheetId,
          `${KPM_SHEET_ASET}!A${asetRowIdx}:M${asetRowIdx}`,
          [asetToRow(newAsetData)]
        );
      } else {
        const newAsetData: KpmAset = {
          AsetId: generateAsetId(),
          NoKK: updatedKeluarga.NoKK,
          StatusRumah: dataAset.StatusRumah || 'Milik Sendiri',
          Usaha: dataAset.Usaha || 'Tidak Memiliki Usaha',
          JenisUsaha: dataAset.JenisUsaha || '',
          FotoUsaha: dataAset.FotoUsaha || '',
          FotoRumahLuar: dataAset.FotoRumahLuar || '',
          FotoRumahDalam: dataAset.FotoRumahDalam || '',
          Latitude: dataAset.Latitude || '',
          Longitude: dataAset.Longitude || '',
          TahunMenerimaBansos: dataAset.TahunMenerimaBansos || '',
          Keterangan: dataAset.Keterangan || '',
          CreatedAt: new Date().toISOString(),
        };
        await appendSheetData(activeToken, spreadsheetId, `${KPM_SHEET_ASET}!A:M`, [asetToRow(newAsetData)]);
      }
    }

    // 3. Tambahkan Anggota Baru jika ada
    if (Array.isArray(dataAnggota) && dataAnggota.length > 0 && updatedKeluarga.NoKK) {
      for (const ang of dataAnggota) {
        if (ang.Nama && ang.NIK) {
          const newAng: KpmAnggota = {
            AnggotaId: generateAnggotaId(1),
            NoKK: updatedKeluarga.NoKK,
            NIK: ang.NIK,
            Nama: ang.Nama,
            JenisKelamin: ang.JenisKelamin || 'Laki-laki',
            TanggalLahir: ang.TanggalLahir || '',
            Komponen: ang.Komponen || '',
            HubunganKeluarga: ang.HubunganKeluarga || 'Anak',
            Posyandu: ang.Posyandu || '',
            Sekolah: ang.Sekolah || '',
            Kelas: ang.Kelas || '',
            Pekerjaan: ang.Pekerjaan || '',
            Keterangan: ang.Keterangan || '',
            CreatedAt: new Date().toISOString(),
          };
          await appendSheetData(activeToken, spreadsheetId, `${KPM_SHEET_ANGGOTA}!A:N`, [anggotaToRow(newAng)]);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Data KPM Anda berhasil disimpan ke sistem ASPEND PKH.',
    });
  } catch (error) {
    console.error('KPM Portal POST error:', error);
    return NextResponse.json({ error: 'Gagal memproses data portal' }, { status: 500 });
  }
}
