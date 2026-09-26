import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet } from '@/lib/google-drive';
import { getSheetData } from '@/lib/google-sheets';
import { MASTER_RHK_DATA } from '@/lib/master-rhk';

function extractDriveId(str: string) {
  if (!str) return '';
  const match = str.match(/[-\w]{25,}/);
  return match ? match[0] : str;
}

function parseRobustDate(dateStr: string, timeStr: string = '00:00') {
  if (!dateStr) return 0;
  if (!timeStr) timeStr = '00:00';
  let d = dateStr.toString().trim().toLowerCase();
  
  // Hapus semua nama hari Indonesia/Inggris (baik panjang maupun singkatan: Jum, Sen, dll) beserta tanda baca
  d = d.replace(/\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|sen|sel|rab|kam|jum|sab|min|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b[,.]?/gi, '').trim();
  
  const monthsId = [
    { name: 'januari', short: 'jan', m: 0 },
    { name: 'februari', short: 'feb', m: 1 },
    { name: 'maret', short: 'mar', m: 2 },
    { name: 'april', short: 'apr', m: 3 },
    { name: 'mei', short: 'may', m: 4 },
    { name: 'juni', short: 'jun', m: 5 },
    { name: 'juli', short: 'jul', m: 6 },
    { name: 'agustus', short: 'agu', m: 7 },
    { name: 'august', short: 'aug', m: 7 },
    { name: 'september', short: 'sep', m: 8 },
    { name: 'oktober', short: 'okt', m: 9 },
    { name: 'october', short: 'oct', m: 9 },
    { name: 'november', short: 'nov', m: 10 },
    { name: 'desember', short: 'des', m: 11 },
    { name: 'december', short: 'dec', m: 11 }
  ];

  for (const item of monthsId) {
    const regex = new RegExp('\\b(' + item.name + '|' + item.short + ')\\b', 'i');
    if (regex.test(d)) {
      d = d.replace(regex, ' ' + item.m + ' ');
      const p = d.trim().split(/\s+/);
      if (p.length >= 3) {
        const day = parseInt(p[0]);
        const month = parseInt(p[1]);
        const year = parseInt(p[2]);
        const hour = parseInt(timeStr.split(':')[0]) || 0;
        const min = parseInt(timeStr.split(':')[1]) || 0;
        const res = new Date(year, month, day, hour, min, 0).getTime();
        if (!isNaN(res)) return res;
      }
      break;
    }
  }

  const parts = d.split(/[-/\\]/);
  if (parts.length === 3) {
    let year: number, month: number, day: number;
    if (parts[0].length === 4) {
      year = parseInt(parts[0]); month = parseInt(parts[1]) - 1; day = parseInt(parts[2]);
    } else {
      day = parseInt(parts[0]); month = parseInt(parts[1]) - 1; year = parseInt(parts[2]);
      if (month > 11) { 
        const temp = day; day = month + 1; month = temp - 1; 
      }
      if (year < 100) year += 2000;
    }
    const hour = parseInt(timeStr.split(':')[0]) || 0;
    const min = parseInt(timeStr.split(':')[1]) || 0;
    const res = new Date(year, month, day, hour, min, 0).getTime();
    if (!isNaN(res)) return res;
  }
  const raw = new Date(dateStr + (timeStr ? ' ' + timeStr : '')).getTime();
  return isNaN(raw) ? 0 : raw;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is set in jwt callback
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let spreadsheetId = searchParams.get('spreadsheetId');

    // 1. Jika ID tidak dikirim, otomatis cari di Google Drive milik user
    if (!spreadsheetId) {
      spreadsheetId = await findAspendSpreadsheet(accessToken as string);
    }

    if (!spreadsheetId) {
      return NextResponse.json({ 
        success: false, 
        notFound: true,
        message: 'File spreadsheet "Aspend Database" tidak ditemukan di Google Drive Anda.' 
      }, { status: 404 });
    }

    // 2. Baca Profil Pengguna
    let isPremiumUser = false;
    const userEmailLower = (session.user?.email || '').toLowerCase().trim();

    // 1. Akun Admin / Developer selalu Premium
    const adminEmails = ['binjaipkh@gmail.com'];
    if (userEmailLower && adminEmails.includes(userEmailLower)) {
      isPremiumUser = true;
    }

    // 2. Cek sheet "Premium" (format client_services.js: [Email, Status, Metode])
    try {
      const premRows = await getSheetData(accessToken as string, spreadsheetId, 'Premium!A2:C');
      if (premRows && premRows.length > 0) {
        for (const row of premRows) {
          if (row[0] && row[0].toString().trim().toLowerCase() === userEmailLower) {
            const status = (row[1] || '').toString().trim().toLowerCase();
            if (status === 'aktif' || status === 'active' || status === 'premium' || status === 'true') {
              isPremiumUser = true;
              break;
            }
          }
        }
      }
    } catch {
      // Tab Premium mungkin belum ada
    }

    // 3. Cek sheet "PremiumUsers" (format DataService.gs: [Email, AddedAt, PackageType, Duration, ExpiryDate])
    if (!isPremiumUser) {
      try {
        const premUsers = await getSheetData(accessToken as string, spreadsheetId, 'PremiumUsers!A2:E');
        if (premUsers && premUsers.length > 0) {
          for (const row of premUsers) {
            if (row[0] && row[0].toString().trim().toLowerCase() === userEmailLower) {
              const expiryStr = row[4] ? row[4].toString() : '';
              if (!expiryStr) {
                isPremiumUser = true;
                break;
              }
              const expiry = new Date(expiryStr).getTime();
              if (isNaN(expiry) || expiry > Date.now()) {
                isPremiumUser = true;
                break;
              }
            }
          }
        }
      } catch {
        // Tab PremiumUsers mungkin belum ada
      }
    }

    let userProfile = {
      nama: session.user?.name || '',
      email: session.user?.email || '',
      nip: '',
      jabatan: 'Pendamping PKH',
      kabupaten: '',
      photoFileId: '',
      photoUrl: session.user?.image || '',
      signatureFileId: '',
      signatureUrl: '',
      isPremium: isPremiumUser
    };

    try {
      // Coba baca dari sheet Profile dulu (format Aspend Mobile)
      let profileRows = await getSheetData(accessToken as string, spreadsheetId, 'Profile!A2:H');
      if (!profileRows || profileRows.length === 0) {
        profileRows = await getSheetData(accessToken as string, spreadsheetId, 'Users!A2:I');
      }
      
      if (profileRows && profileRows.length > 0) {
        // Ambil baris pertama atau cari yang cocok dengan email
        let matchedRow = profileRows[0];
        for (const row of profileRows) {
          if (row[0] && row[0].toString().trim().toLowerCase() === session.user?.email?.toLowerCase()) {
            matchedRow = row;
            break;
          }
        }

        const photoId = matchedRow[6] ? extractDriveId(matchedRow[6]) : '';
        const sigId = matchedRow[5] ? extractDriveId(matchedRow[5]) : '';

        // Cek juga apakah ada kolom status di profile/users
        for (let c = 7; c < matchedRow.length; c++) {
          const val = (matchedRow[c] || '').toString().trim().toLowerCase();
          if (val === 'premium' || val === 'aktif' || val === 'active' || val === 'true') {
            isPremiumUser = true;
            break;
          }
        }

        userProfile = {
          email: matchedRow[0] || session.user?.email || '',
          nama: matchedRow[1] || session.user?.name || '',
          nip: matchedRow[2] || '',
          jabatan: matchedRow[3] || 'Pendamping PKH',
          kabupaten: matchedRow[4] || '',
          photoFileId: photoId,
          photoUrl: photoId ? `/api/image-proxy?id=${photoId}` : (session.user?.image || ''),
          signatureFileId: sigId,
          signatureUrl: sigId ? `/api/image-proxy?id=${sigId}` : '',
          isPremium: isPremiumUser
        };
      }
    } catch (err) {
      console.warn('Gagal membaca sheet Users/Profile:', err);
    }

    // 3. Baca Master RHK (Fallback ke MASTER_RHK_DATA standar ASPEND)
    let rhkList: any[] = MASTER_RHK_DATA.flatMap(m => 
      m.rencanaList.map(rencana => ({
        id: m.id,
        jenis: m.jenis,
        rencana: rencana
      }))
    );
    try {
      const rhkRows = await getSheetData(accessToken as string, spreadsheetId, 'Master_RHK!A2:C');
      if (rhkRows && rhkRows.length > 0) {
        rhkList = rhkRows.map((row: any) => ({
          id: row[0] || '',
          jenis: row[1] || '',
          rencana: row[2] || ''
        }));
      }
    } catch {
      // Menggunakan fallback MASTER_RHK_DATA standar
    }

    // 4. Baca Laporan_Log
    let rawReports: any[][] = [];
    try {
      rawReports = await getSheetData(accessToken as string, spreadsheetId, 'Laporan_Log!A2:Q');
    } catch (err) {
      console.warn('Gagal membaca sheet Laporan_Log:', err);
    }

    const reports = (rawReports || []).map((row: any, idx: number) => {
      // Row mapping:
      // [0] ReportId, [1] Tanggal, [2] JenisRHK, [3] IdRHK, [4] RencanaAksi, [5] Pukul, 
      // [6] PoinKegiatan, [7] NarasiAI, [8] NarasiEdited, [9] Status, [10] PdfFileId, 
      // [11] FotoIds, [12] P2K2Data, [13] Lokasi, [14] CreatedAt
      let fotoIds: string[] = [];
      const val = row[11];
      if (val) {
        if (typeof val === 'string') {
          if (val.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) fotoIds = parsed.map(extractDriveId).filter(Boolean);
            } catch (e) {}
          }
          if (fotoIds.length === 0) {
            const matches = val.match(/[-\w]{25,}/g);
            if (matches && matches.length > 0) fotoIds = matches;
          }
        }
        if (fotoIds.length === 0) {
          const single = extractDriveId(val);
          if (single) fotoIds = [single];
        }
      }

      let p2k2Data = null;
      if (row[12]) {
        try { p2k2Data = JSON.parse(row[12]); } catch (e) {}
      }

      return {
        ReportId: row[0] !== undefined && row[0] !== null ? String(row[0]) : `TMP_${idx}`,
        Tanggal: row[1] !== undefined && row[1] !== null ? String(row[1]) : '',
        JenisRHK: row[2] !== undefined && row[2] !== null ? String(row[2]) : '',
        IdRHK: row[3] !== undefined && row[3] !== null ? String(row[3]) : '',
        RencanaAksi: row[4] !== undefined && row[4] !== null ? String(row[4]) : '',
        Pukul: row[5] !== undefined && row[5] !== null ? String(row[5]) : '',
        PoinKegiatan: row[6] !== undefined && row[6] !== null ? String(row[6]) : '',
        NarasiAI: row[7] !== undefined && row[7] !== null ? String(row[7]) : '',
        NarasiEdited: row[8] !== undefined && row[8] !== null ? String(row[8]) : '',
        Status: row[9] !== undefined && row[9] !== null ? String(row[9]) : 'SELESAI',
        PdfFileId: row[10] !== undefined && row[10] !== null ? String(row[10]) : '',
        FotoIds: fotoIds,
        P2K2Data: p2k2Data,
        Lokasi: row[13] !== undefined && row[13] !== null ? String(row[13]) : '',
        CreatedAt: row[14] !== undefined && row[14] !== null ? String(row[14]) : ''
      };
    });

    // Urutkan terbaru di atas
    reports.sort((a, b) => {
      const pukulA = (a.Pukul && a.Pukul !== '-') ? a.Pukul.toString().trim().substring(0, 5) : '00:00';
      const pukulB = (b.Pukul && b.Pukul !== '-') ? b.Pukul.toString().trim().substring(0, 5) : '00:00';
      let timeA = parseRobustDate(a.Tanggal, pukulA);
      let timeB = parseRobustDate(b.Tanggal, pukulB);
      if (timeA === 0) timeA = new Date(a.CreatedAt || 0).getTime();
      if (timeB === 0) timeB = new Date(b.CreatedAt || 0).getTime();
      return timeB - timeA;
    });

    // Statistik
    const currentMonth = new Date().toISOString().substring(0, 7);
    const reportsThisMonth = reports.filter(r => r.Tanggal && String(r.Tanggal).startsWith(currentMonth));
    
    const rhkBreakdown: Record<string, number> = {};
    reportsThisMonth.forEach(r => {
      const id = r.IdRHK || r.JenisRHK || '';
      const angka = id.replace(/\D/g, '') || '?';
      const key = 'RHK-' + angka;
      if (key !== 'RHK-?') {
        rhkBreakdown[key] = (rhkBreakdown[key] || 0) + 1;
      }
    });

    const stats = {
      total: reports.length,
      month: reportsThisMonth.length,
      rhkBreakdown,
      pending: reports.filter(r => (r.Status || '').toLowerCase() === 'draft').length,
      done: reports.filter(r => (r.Status || '').toLowerCase() !== 'draft').length
    };

    // 5. Baca sheet Riwayat_Poin jika ada di spreadsheet
    let riwayatPoinRaw: any[][] = [];
    try {
      riwayatPoinRaw = await getSheetData(accessToken as string, spreadsheetId, 'Riwayat_Poin!A2:C');
    } catch {
      // Sheet Riwayat_Poin mungkin belum dibuat atau kosong
    }

    const riwayatPoinList = (riwayatPoinRaw || [])
      .filter((row: any) => row && row[1] && String(row[1]).trim())
      .map((row: any) => ({
        idRhk: String(row[0] || '').trim(),
        text: String(row[1] || '').trim(),
        date: String(row[2] || '').trim()
      }));

    return NextResponse.json({
      success: true,
      spreadsheetId,
      profile: userProfile,
      reports,
      riwayatPoinList,
      rhkList,
      stats
    });
  } catch (error: any) {
    console.error('Error di /api/dashboard:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
