import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findAspendSpreadsheet, getDriveClient } from '@/lib/google-drive';
import { getSheetData, deleteSheetRow, updateSheetRow, appendSheetData } from '@/lib/google-sheets';
import { generateReportPDF } from '@/lib/pdf-generator';

function extractDriveId(str: string) {
  if (!str) return '';
  const match = str.match(/[-\w]{25,}/);
  return match ? match[0] : str;
}

/**
 * DELETE /api/reports?reportId=...
 * Menghapus baris laporan dari Laporan_Log dan file terkait di Drive
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    const spreadsheetId = await findAspendSpreadsheet(accessToken as string);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet tidak ditemukan' }, { status: 404 });
    }

    // Cari baris di Laporan_Log
    const rows = await getSheetData(accessToken as string, spreadsheetId, 'Laporan_Log!A:Q');
    let targetRowIndex0Based = -1;
    let targetRowData: any[] | null = null;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0]).trim() === String(reportId).trim()) {
        targetRowIndex0Based = i;
        targetRowData = rows[i];
        break;
      }
    }

    if (targetRowIndex0Based === -1 || !targetRowData) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan di database.' }, { status: 404 });
    }

    // Hapus baris dari Google Sheets
    await deleteSheetRow(accessToken as string, spreadsheetId, 'Laporan_Log', targetRowIndex0Based);

    // Hapus file PDF di Drive jika ada (opsional / safe)
    const pdfFileId = targetRowData[10];
    if (pdfFileId && typeof pdfFileId === 'string' && pdfFileId.length > 5) {
      try {
        const drive = await getDriveClient(accessToken as string);
        await drive.files.update({
          fileId: pdfFileId,
          requestBody: { trashed: true },
        });
      } catch (err) {
        console.warn('Gagal memindahkan PDF ke trash:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Laporan berhasil dihapus dari database Google Sheets.',
    });
  } catch (error: any) {
    console.error('Error DELETE /api/reports:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT /api/reports
 * Memperbarui data laporan di Laporan_Log dan otomatis meregenerasi file PDF di Drive
 */
export async function PUT(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const { reportId, tanggal, jenisRHK, idRHK, rencanaAksi, pukul, poinKegiatan, narasiEdited, lokasi, p2k2Data, fotoIds } = payload;

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    const spreadsheetId = await findAspendSpreadsheet(accessToken as string);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet tidak ditemukan' }, { status: 404 });
    }

    const rows = await getSheetData(accessToken as string, spreadsheetId, 'Laporan_Log!A:Q');
    let targetRowNumber1Based = -1;
    let existingRow: any[] | null = null;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0]).trim() === String(reportId).trim()) {
        targetRowNumber1Based = i + 1; // row 2, 3, etc.
        existingRow = rows[i];
        break;
      }
    }

    if (targetRowNumber1Based === -1 || !existingRow) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan di database.' }, { status: 404 });
    }

    // Format FotoIds jika dikirim sebagai array atau string
    let formattedFotoIds = existingRow[11] || '';
    let parsedFotoIds: string[] = [];
    if (fotoIds !== undefined) {
      if (Array.isArray(fotoIds)) {
        parsedFotoIds = fotoIds.map(extractDriveId).filter(Boolean);
        formattedFotoIds = JSON.stringify(parsedFotoIds);
      } else {
        formattedFotoIds = String(fotoIds);
        parsedFotoIds = [extractDriveId(formattedFotoIds)].filter(Boolean);
      }
    } else if (existingRow[11]) {
      const val = existingRow[11];
      if (typeof val === 'string' && val.trim().startsWith('[')) {
        try { parsedFotoIds = JSON.parse(val).map(extractDriveId).filter(Boolean); } catch {}
      } else {
        const matches = String(val).match(/[-\w]{25,}/g);
        if (matches) parsedFotoIds = matches;
      }
    }

    // Baca Profil Pengguna untuk tanda tangan dan kop PDF
    let userProfile = {
      nama: session.user?.name || '',
      email: session.user?.email || '',
      nip: '',
      jabatan: 'Penata Layanan Operasional',
      kabupaten: '',
      photoFileId: '',
      signatureFileId: ''
    };

    try {
      let profileRows = await getSheetData(accessToken as string, spreadsheetId, 'Profile!A2:H');
      if (!profileRows || profileRows.length === 0) {
        profileRows = await getSheetData(accessToken as string, spreadsheetId, 'Users!A2:I');
      }
      if (profileRows && profileRows.length > 0) {
        let matchedRow = profileRows[0];
        for (const row of profileRows) {
          if (row[0] && row[0].toString().trim().toLowerCase() === session.user?.email?.toLowerCase()) {
            matchedRow = row;
            break;
          }
        }
        userProfile = {
          email: matchedRow[0] || session.user?.email || '',
          nama: matchedRow[1] || session.user?.name || '',
          nip: matchedRow[2] || '',
          jabatan: matchedRow[3] || 'Penata Layanan Operasional',
          kabupaten: matchedRow[4] || '',
          photoFileId: matchedRow[6] ? extractDriveId(matchedRow[6]) : '',
          signatureFileId: matchedRow[5] ? extractDriveId(matchedRow[5]) : ''
        };
      }
    } catch (profErr) {
      console.warn('Gagal membaca profile untuk PDF:', profErr);
    }

    // Siapkan baris yang diperbarui
    let currentPdfId = existingRow[10] || '';

    // Otomatis regenerasi file PDF resmi di Google Drive
    try {
      let parsedP2K2 = null;
      if (p2k2Data !== undefined) {
        if (typeof p2k2Data === 'object') {
          parsedP2K2 = p2k2Data;
        } else if (typeof p2k2Data === 'string') {
          try { parsedP2K2 = JSON.parse(p2k2Data); } catch { parsedP2K2 = null; }
        }
      } else if (existingRow[12]) {
        const rawVal = existingRow[12];
        if (typeof rawVal === 'object') {
          parsedP2K2 = rawVal;
        } else if (typeof rawVal === 'string') {
          try { parsedP2K2 = JSON.parse(rawVal); } catch { parsedP2K2 = null; }
        }
      }

      const pdfRes = await generateReportPDF(accessToken as string, {
        reportData: {
          ReportId: existingRow[0] || reportId,
          Tanggal: tanggal !== undefined ? tanggal : (existingRow[1] || ''),
          JenisRHK: jenisRHK !== undefined ? jenisRHK : (existingRow[2] || ''),
          IdRHK: idRHK !== undefined ? idRHK : (existingRow[3] || ''),
          RencanaAksi: rencanaAksi !== undefined ? rencanaAksi : (existingRow[4] || ''),
          Pukul: pukul !== undefined ? pukul : (existingRow[5] || ''),
          Lokasi: lokasi !== undefined ? lokasi : (existingRow[13] || ''),
          NarasiEdited: narasiEdited !== undefined ? narasiEdited : (existingRow[8] || ''),
          NarasiAI: existingRow[7] || '',
          P2K2Data: parsedP2K2,
          FotoIds: parsedFotoIds,
          PdfFileId: currentPdfId
        },
        userProfile
      });

      if (pdfRes.success && pdfRes.pdfFileId) {
        currentPdfId = pdfRes.pdfFileId;
      }
    } catch (pdfErr) {
      console.error('Error saat meregenerasi PDF laporan:', pdfErr);
    }

    const updatedRow = [
      existingRow[0] || reportId,                                    // A: ReportId
      tanggal !== undefined ? tanggal : (existingRow[1] || ''),       // B: Tanggal
      jenisRHK !== undefined ? jenisRHK : (existingRow[2] || ''),     // C: JenisRHK
      idRHK !== undefined ? idRHK : (existingRow[3] || ''),           // D: IdRHK
      rencanaAksi !== undefined ? rencanaAksi : (existingRow[4] || ''),// E: RencanaAksi
      pukul !== undefined ? pukul : (existingRow[5] || ''),           // F: Pukul
      poinKegiatan !== undefined ? poinKegiatan : (existingRow[6] || ''), // G: PoinKegiatan
      existingRow[7] || '',                                           // H: NarasiAI
      narasiEdited !== undefined ? narasiEdited : (existingRow[8] || ''), // I: NarasiEdited
      existingRow[9] || 'SELESAI',                                    // J: Status
      currentPdfId,                                                   // K: PdfFileId
      formattedFotoIds,                                               // L: FotoIds
      p2k2Data !== undefined ? (typeof p2k2Data === 'object' ? JSON.stringify(p2k2Data) : p2k2Data) : (existingRow[12] || ''), // M: P2K2Data
      lokasi !== undefined ? lokasi : (existingRow[13] || ''),        // N: Lokasi
      existingRow[14] || new Date().toISOString()                     // O: CreatedAt
    ];

    await updateSheetRow(
      accessToken as string,
      spreadsheetId,
      `Laporan_Log!A${targetRowNumber1Based}:O${targetRowNumber1Based}`,
      [updatedRow]
    );

    return NextResponse.json({
      success: true,
      message: 'Laporan dan dokumen PDF berhasil diperbarui.',
      data: {
        ReportId: updatedRow[0],
        Tanggal: updatedRow[1],
        JenisRHK: updatedRow[2],
        IdRHK: updatedRow[3],
        RencanaAksi: updatedRow[4],
        Pukul: updatedRow[5],
        PoinKegiatan: updatedRow[6],
        NarasiAI: updatedRow[7],
        NarasiEdited: updatedRow[8],
        Status: updatedRow[9],
        PdfFileId: updatedRow[10],
        FotoIds: parsedFotoIds,
        Lokasi: updatedRow[13]
      }
    });
  } catch (error: any) {
    console.error('Error PUT /api/reports:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/reports
 * Membuat laporan RHK baru, otomatis membuat file PDF resmi di Google Drive,
 * dan menyimpan baris ke Laporan_Log Google Sheets
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const {
      tanggal,
      jenisRHK,
      idRHK,
      rencanaAksi,
      pukul,
      poinKegiatan,
      narasiAI,
      narasiEdited,
      lokasi,
      p2k2Data,
      fotoIds
    } = payload;

    if (!tanggal || !jenisRHK || !rencanaAksi || !poinKegiatan) {
      return NextResponse.json({ error: 'Field wajib belum lengkap diisi.' }, { status: 400 });
    }

    const spreadsheetId = await findAspendSpreadsheet(accessToken as string);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet database Aspend tidak ditemukan di Google Drive.' }, { status: 404 });
    }

    // 1. Generate Unique Report ID (Timestamp berbasis detik)
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const reportId = `RPT-${yyyy}${mm}${dd}-${hh}${min}${ss}`;

    // 2. Parse FotoIds
    let parsedFotoIds: string[] = [];
    if (fotoIds) {
      if (Array.isArray(fotoIds)) {
        parsedFotoIds = fotoIds.map(extractDriveId).filter(Boolean);
      } else {
        parsedFotoIds = [extractDriveId(String(fotoIds))].filter(Boolean);
      }
    }

    // 3. Baca Profil Pengguna untuk tanda tangan dan kop PDF
    let userProfile = {
      nama: session.user?.name || '',
      email: session.user?.email || '',
      nip: '',
      jabatan: 'Penata Layanan Operasional',
      kabupaten: '',
      photoFileId: '',
      signatureFileId: ''
    };

    try {
      let profileRows = await getSheetData(accessToken as string, spreadsheetId, 'Profile!A2:H');
      if (!profileRows || profileRows.length === 0) {
        profileRows = await getSheetData(accessToken as string, spreadsheetId, 'Users!A2:I');
      }
      if (profileRows && profileRows.length > 0) {
        let matchedRow = profileRows[0];
        for (const row of profileRows) {
          if (row[0] && row[0].toString().trim().toLowerCase() === session.user?.email?.toLowerCase()) {
            matchedRow = row;
            break;
          }
        }
        userProfile = {
          email: matchedRow[0] || session.user?.email || '',
          nama: matchedRow[1] || session.user?.name || '',
          nip: matchedRow[2] || '',
          jabatan: matchedRow[3] || 'Penata Layanan Operasional',
          kabupaten: matchedRow[4] || '',
          photoFileId: matchedRow[6] ? extractDriveId(matchedRow[6]) : '',
          signatureFileId: matchedRow[5] ? extractDriveId(matchedRow[5]) : ''
        };
      }
    } catch (profErr) {
      console.warn('Gagal membaca profile untuk PDF baru:', profErr);
    }

    // 4. Generate Dokumen PDF Resmi di Google Drive
    let createdPdfId = '';
    let parsedP2K2 = null;
    if (p2k2Data) {
      if (typeof p2k2Data === 'object') {
        parsedP2K2 = p2k2Data;
      } else if (typeof p2k2Data === 'string') {
        try { parsedP2K2 = JSON.parse(p2k2Data); } catch { parsedP2K2 = null; }
      }
    }

    try {
      const pdfRes = await generateReportPDF(accessToken as string, {
        reportData: {
          ReportId: reportId,
          Tanggal: tanggal,
          JenisRHK: jenisRHK,
          IdRHK: idRHK || '',
          RencanaAksi: rencanaAksi,
          Pukul: pukul || '14:00',
          Lokasi: lokasi || '',
          NarasiEdited: narasiEdited || narasiAI || '',
          NarasiAI: narasiAI || '',
          P2K2Data: parsedP2K2,
          FotoIds: parsedFotoIds,
          PdfFileId: ''
        },
        userProfile
      });

      if (pdfRes.success && pdfRes.pdfFileId) {
        createdPdfId = pdfRes.pdfFileId;
      }
    } catch (pdfErr) {
      console.error('Error saat membuat PDF laporan baru:', pdfErr);
    }

    // 5. Susun Baris Laporan_Log!A:O
    const newRow = [
      reportId,                                                          // A: ReportId
      tanggal,                                                           // B: Tanggal
      jenisRHK,                                                          // C: JenisRHK
      idRHK || '',                                                       // D: IdRHK
      rencanaAksi,                                                       // E: RencanaAksi
      pukul || '14:00',                                                  // F: Pukul
      poinKegiatan || '',                                                // G: PoinKegiatan
      narasiAI || '',                                                    // H: NarasiAI
      narasiEdited || narasiAI || '',                                    // I: NarasiEdited
      'SELESAI',                                                         // J: Status
      createdPdfId,                                                      // K: PdfFileId
      JSON.stringify(parsedFotoIds),                                     // L: FotoIds
      parsedP2K2 ? JSON.stringify(parsedP2K2) : '',                      // M: P2K2Data
      lokasi || '',                                                      // N: Lokasi
      now.toISOString()                                                  // O: CreatedAt
    ];

    await appendSheetData(
      accessToken as string,
      spreadsheetId,
      'Laporan_Log!A:O',
      [newRow]
    );

    // 6. Simpan riwayat poin ke sheet Riwayat_Poin jika ada (opsional / non-blocking)
    if (poinKegiatan && poinKegiatan.trim()) {
      try {
        await appendSheetData(
          accessToken as string,
          spreadsheetId,
          'Riwayat_Poin!A:C',
          [[idRHK || jenisRHK, poinKegiatan.trim(), now.toISOString()]]
        );
      } catch {
        // Riwayat_Poin sheet mungkin belum ada
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Laporan dan dokumen PDF resmi berhasil dibuat dan disimpan.',
      data: {
        ReportId: newRow[0],
        Tanggal: newRow[1],
        JenisRHK: newRow[2],
        IdRHK: newRow[3],
        RencanaAksi: newRow[4],
        Pukul: newRow[5],
        PoinKegiatan: newRow[6],
        NarasiAI: newRow[7],
        NarasiEdited: newRow[8],
        Status: newRow[9],
        PdfFileId: newRow[10],
        FotoIds: parsedFotoIds,
        P2K2Data: parsedP2K2,
        Lokasi: newRow[13],
        CreatedAt: newRow[14]
      }
    });
  } catch (error: any) {
    console.error('Error POST /api/reports:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

