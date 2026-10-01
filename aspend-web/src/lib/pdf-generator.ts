import { getDriveClient, getOrCreateFolder, uploadFileToDrive } from './google-drive';
import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { MASTER_P2K2_DATA, isP2K2 as isP2K2Rhk } from './master-rhk';

/**
 * Mendapatkan dimensi asli (width & height) dari buffer gambar (PNG / JPEG)
 */
function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    // 1. PNG: Byte 16-23 berisi Width & Height (big-endian 32-bit)
    if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }
    // 2. JPEG: Scan marker SOF0 s/d SOF3
    if (buffer.length > 10 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let i = 2;
      while (i < buffer.length - 8) {
        if (buffer[i] === 0xff) {
          const marker = buffer[i + 1];
          if (marker >= 0xc0 && marker <= 0xc3) {
            return {
              height: buffer.readUInt16BE(i + 5),
              width: buffer.readUInt16BE(i + 7),
            };
          }
          const len = buffer.readUInt16BE(i + 2);
          i += 2 + (len || 1);
        } else {
          i++;
        }
      }
    }
  } catch (e) {
    console.warn('Gagal membaca dimensi gambar:', e);
  }
  return null;
}

/**
 * Menghitung ukuran proporsional (dalam satuan point) agar pas di halaman A4
 */
function calculateFittedSize(
  origWidth: number,
  origHeight: number,
  maxWidth = 410,
  maxHeight = 380
): { width: number; height: number } {
  if (!origWidth || !origHeight) {
    return { width: maxWidth, height: 290 };
  }
  const ratio = Math.min(maxWidth / origWidth, maxHeight / origHeight, 1);
  return {
    width: Math.round(origWidth * ratio),
    height: Math.round(origHeight * ratio),
  };
}

/**
 * Mengambil Base64 PNG Logo KEMENSOS resmi (BUKAN logo aplikasi Aspend)
 */
function getKemensosLogoBase64(): string {
  try {
    // 1. Prioritas utama: public/logo_kemensos.png
    const publicLogoKemensos = path.join(process.cwd(), 'public', 'logo_kemensos.png');
    if (fs.existsSync(publicLogoKemensos)) {
      const buf = fs.readFileSync(publicLogoKemensos);
      return `data:image/png;base64,${buf.toString('base64')}`;
    }
    // 2. Dari rhk_agent_mobile/assets/images/logo_kemensos.png
    const mobileLogoPath = path.join(process.cwd(), '..', 'rhk_agent_mobile', 'assets', 'images', 'logo_kemensos.png');
    if (fs.existsSync(mobileLogoPath)) {
      const buf = fs.readFileSync(mobileLogoPath);
      return `data:image/png;base64,${buf.toString('base64')}`;
    }
    // 3. Dari logo_kemensos_base64.txt di root workspace
    const txtPath = path.join(process.cwd(), '..', 'logo_kemensos_base64.txt');
    if (fs.existsSync(txtPath)) {
      const content = fs.readFileSync(txtPath, 'utf8').trim();
      return content.startsWith('data:') ? content : `data:image/png;base64,${content}`;
    }
    const currentTxtPath = path.join(process.cwd(), 'logo_kemensos_base64.txt');
    if (fs.existsSync(currentTxtPath)) {
      const content = fs.readFileSync(currentTxtPath, 'utf8').trim();
      return content.startsWith('data:') ? content : `data:image/png;base64,${content}`;
    }
  } catch (err) {
    console.warn('Gagal membaca file logo Kemensos:', err);
  }
  return '';
}

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatTanggalIndonesia(date: Date): string {
  try {
    const hari = NAMA_HARI[date.getDay()];
    const tgl = date.getDate();
    const bln = NAMA_BULAN[date.getMonth()];
    const thn = date.getFullYear();
    return `${hari}, ${tgl} ${bln} ${thn}`;
  } catch {
    return date.toLocaleDateString('id-ID');
  }
}

function formatTanggalTtd(date: Date): string {
  try {
    const tgl = date.getDate();
    const bln = NAMA_BULAN[date.getMonth()];
    const thn = date.getFullYear();
    return `${tgl} ${bln} ${thn}`;
  } catch {
    return date.toLocaleDateString('id-ID');
  }
}

function formatBulanTahun(date: Date): string {
  try {
    const bln = NAMA_BULAN[date.getMonth()];
    const thn = date.getFullYear();
    return `${bln} ${thn}`;
  } catch {
    return '';
  }
}

interface LoadedDriveImage {
  base64: string;
  width: number;
  height: number;
}

/**
 * Mengunduh file dari Drive dan mengubahnya menjadi Base64 Data URL beserta ukuran terpasang (fitted dimensions)
 */
async function getDriveImage(accessToken: string, fileId: string): Promise<LoadedDriveImage | null> {
  if (!fileId || fileId.length < 5) return null;
  try {
    const drive = await getDriveClient(accessToken);
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const mime = res.headers['content-type'] || 'image/jpeg';
    const buffer = Buffer.from(res.data as ArrayBuffer);
    
    // Deteksi dimensi asli
    const dims = getImageDimensions(buffer);
    const fitted = dims 
      ? calculateFittedSize(dims.width, dims.height, 420, 390)
      : { width: 420, height: 300 };

    return {
      base64: `data:${mime};base64,${buffer.toString('base64')}`,
      width: fitted.width,
      height: fitted.height,
    };
  } catch (err) {
    console.warn(`Gagal mengambil gambar drive ID ${fileId}:`, err);
    return null;
  }
}

/**
 * Ekstrak baris teks di dalam Bagian B. KEGIATAN YANG DILAKSANAKAN dari narasi
 */
function extractSectionBLines(narrative: string): string[] {
  if (!narrative) return [];
  const lines = narrative.split('\n');
  const bLines: string[] = [];
  let capturingB = false;

  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    const clean = t.replace(/<[^>]+>/g, '').replace(/[*_#]/g, '').trim();
    const match = clean.match(/^([A-E])\.\s+([A-Za-z0-9\s\(\)\/\-,–—]+?):?$/);
    if (match && match[2].trim().length <= 70) {
      const letter = match[1].toUpperCase();
      if (letter === 'B') {
        capturingB = true;
        continue;
      } else if (capturingB) {
        break;
      }
    }
    if (capturingB && t.length > 0) {
      if (!t.startsWith('|') && !/^[|\s\-+:]{3,}$/.test(t)) {
        bLines.push(t);
      }
    }
  }
  return bLines;
}

/**
 * Menghasilkan tabel HTML resmi P2K2 Kemensos (A. Informasi Umum, B. Waktu Pelaksanaan, C. Pemateri, D. Isi Materi, E. Isi Kegiatan)
 */
function generateP2K2TableHtml(
  p2k2: any,
  userProfile: { nama: string; nip: string; jabatan: string; kabupaten: string; provinsi?: string; kecamatan?: string },
  reportData: { ReportId: string; Tanggal: string; JenisRHK: string; IdRHK: string; RencanaAksi: string; Pukul: string; Lokasi?: string; NarasiEdited?: string; NarasiAI?: string },
  validDate: Date,
  bLines: string[],
  firstPhotoBase64?: string | null
): string {
  const isSupervisi = Boolean(
    p2k2?.isSupervisi ||
    p2k2?.IsSupervisi ||
    reportData.RencanaAksi?.toLowerCase().includes('supervisi')
  );

  const rawDateStr = reportData.Tanggal ? reportData.Tanggal.replace(/-/g, '') : '';
  const cleanTime = (reportData.Pukul || '00.00').replace(':', '.');
  const docTitleNo = `${rawDateStr} - ${cleanTime} - ${reportData.IdRHK || 'RHK-2'} - ${(reportData.RencanaAksi || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()}`;
  const tglFormatted = formatTanggalIndonesia(validDate);
  const tglTtdFormatted = formatTanggalTtd(validDate);

  const namaPemateri = (p2k2?.isPemateriDiriSendiri || !p2k2?.namaPemateri?.trim())
    ? (userProfile.nama || '-')
    : p2k2.namaPemateri;

  const jabatanPemateri = (p2k2?.isPemateriDiriSendiri || !p2k2?.jabatanPemateri?.trim())
    ? (userProfile.jabatan || 'Pendamping PKH')
    : p2k2.jabatanPemateri;

  const hadir = parseInt(p2k2?.jumlahHadir ?? p2k2?.hadir ?? 0, 10) || 0;
  const sakit = parseInt(p2k2?.jumlahSakit ?? p2k2?.sakit ?? 0, 10) || 0;
  const alpa = parseInt(p2k2?.jumlahAlpa ?? p2k2?.alpa ?? 0, 10) || 0;
  let totalDampingan = hadir + sakit + alpa;
  if (totalDampingan === 0 && (p2k2?.totalDampingan || p2k2?.jumlahKPM)) {
    totalDampingan = parseInt(p2k2.totalDampingan || p2k2.jumlahKPM, 10) || 0;
  }

  // Modul & Sesi fallback detection jika belum terisi
  let modulDisplay = p2k2?.modul || '';
  let sesiDisplay = p2k2?.sesi || '';

  if (!modulDisplay || !sesiDisplay) {
    const fullNarasi = `${reportData.RencanaAksi || ''} ${reportData.NarasiEdited || reportData.NarasiAI || ''}`;
    for (const item of MASTER_P2K2_DATA) {
      if (!modulDisplay && fullNarasi.toLowerCase().includes(item.modul.toLowerCase())) {
        modulDisplay = item.modul;
      }
      if (!sesiDisplay && fullNarasi.toLowerCase().includes(item.sesi.toLowerCase())) {
        sesiDisplay = item.sesi;
      }
    }
  }

  if (!modulDisplay) modulDisplay = 'MODUL PENDIDIKAN DAN PENGASUHAN';
  if (!sesiDisplay) sesiDisplay = 'Sesi 1 : Menjadi Orang Tua yang Lebih Baik';

  let tempatPelaksanaan = p2k2?.tempatPelaksanaan || reportData.Lokasi || '';
  if (!tempatPelaksanaan) {
    tempatPelaksanaan = userProfile.kecamatan ? `Kecamatan ${userProfile.kecamatan}` : '-';
  }

  const jamSelesai = p2k2?.jamSelesai || '15:30';

  // Section A rows based on supervisi or normal
  let sectionARows = '';
  if (isSupervisi) {
    const pendampingDisplay = `${p2k2?.namaPendamping || '-'}${p2k2?.nipPendamping ? ` (${p2k2.nipPendamping})` : ''}`;
    const katimName = p2k2?.namaKetuaTim || userProfile.nama || '-';
    const desa = p2k2?.desaKelurahan || '-';
    const kec = p2k2?.kecamatan || userProfile.kecamatan || '-';
    const kab = p2k2?.kabupatenKota || userProfile.kabupaten || '-';
    const prov = p2k2?.provinsi || userProfile.provinsi || '-';

    sectionARows = `
      <tr>
        <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Nama Pendamping</td>
        <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${pendampingDisplay}</td>
      </tr>
      <tr>
        <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Nama Ketua Tim (Katim)</td>
        <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${katimName}</td>
      </tr>
      <tr>
        <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Desa/Kelurahan</td>
        <td style="width: 25%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${desa}</td>
        <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Kecamatan</td>
        <td style="width: 25%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${kec}</td>
      </tr>
      <tr>
        <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Kabupaten / Kota</td>
        <td style="width: 25%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${kab}</td>
        <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Provinsi</td>
        <td style="width: 25%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${prov}</td>
      </tr>
    `;
  } else {
    sectionARows = `
      <tr>
        <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Nama Pendamping</td>
        <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${userProfile.nama || '-'}</td>
      </tr>
      <tr>
        <td colspan="4" style="background-color: #E8E8E8; font-weight: bold; font-size: 9pt; padding: 2.5pt 5pt; border: 1px solid #000000; text-align: center;">SESUAI WILAYAH TUGAS</td>
      </tr>
      <tr>
        <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Kecamatan</td>
        <td style="width: 25%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${userProfile.kecamatan || '-'}</td>
        <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Kabupaten / Kota</td>
        <td style="width: 25%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${userProfile.kabupaten || '-'}</td>
      </tr>
      <tr>
        <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Provinsi</td>
        <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${userProfile.provinsi || '-'}</td>
      </tr>
    `;
  }

  // Format Rangkuman Kegiatan lines
  let rangkumanHtml = '-';
  if (bLines && bLines.length > 0) {
    rangkumanHtml = bLines.map(line => {
      let l = line.trim();
      l = l.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      const m = l.match(/^([a-z0-9][.)]|[-*•])\s+(.+)$/i);
      if (m) {
        return `<table style="width: 100%; border-collapse: collapse; border: none; margin: 1pt 0 2pt 0;" border="0" cellpadding="0" cellspacing="0"><tr><td style="width: 14pt; vertical-align: top; border: none; padding: 0; font-size: 8.5pt; line-height: 1.2;">${m[1]}</td><td style="vertical-align: top; border: none; padding: 0; text-align: justify; font-size: 8.5pt; line-height: 1.2;">${m[2]}</td></tr></table>`;
      } else {
        return `<div style="margin-bottom: 2pt; text-align: justify; font-size: 8.5pt; line-height: 1.2;">${l}</div>`;
      }
    }).join('');
  } else {
    const kelompokNama = p2k2?.namaKelompok ? `kelompok ${p2k2.namaKelompok}` : 'kelompok KPM dampingan';
    rangkumanHtml = `<div style="margin-bottom: 2pt; text-align: justify; font-size: 8.5pt; line-height: 1.2;">Pertemuan Peningkatan Kemampuan Keluarga (P2K2) ${kelompokNama} dibuka pada ${tglFormatted}, pukul ${reportData.Pukul || '14:00'} - ${jamSelesai} WIB di ${tempatPelaksanaan}. Kegiatan diawali dengan perkenalan dan penjelasan mengenai pentingnya ${sesiDisplay}, yaitu ${modulDisplay}. Fasilitator memaparkan materi dengan interaktif, mendorong diskusi kelompok, dan mencatat pertanyaan-pertanyaan dari peserta. Antusiasme KPM terlihat dari banyaknya pertanyaan dan keinginan untuk berbagi pengalaman, menunjukkan keterlibatan aktif dalam pembelajaran.</div>`;
  }

  // Foto Kegiatan
  const fotoHtml = firstPhotoBase64
    ? `<div style="text-align: center; padding: 3pt 0;"><img src="${firstPhotoBase64}" style="max-width: 250pt; max-height: 175pt; object-fit: contain; display: inline-block; margin: 0 auto;" /></div>`
    : `<span style="font-size: 8.5pt;">-</span>`;

  return `
    <div style="text-align: center; margin-top: 10pt; margin-bottom: 6pt; font-family: Arial, sans-serif;">
      <p style="font-size: 11pt; font-weight: bold; margin: 0; line-height: 1.2;">LAPORAN KEGIATAN P2K2</p>
      <p style="font-size: 9.5pt; margin: 2pt 0 0 0; line-height: 1.2;">Pertemuan Peningkatan Kemampuan Keluarga</p>
    </div>
    <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 8.5pt; line-height: 1.15; border: 1px solid #000000; margin-top: 4pt; margin-bottom: 12pt;" border="1" cellpadding="3" cellspacing="0">
      <tbody>
        <tr>
          <td colspan="4" style="background-color: #E8E8E8; font-weight: bold; font-size: 9pt; padding: 2.5pt 5pt; border: 1px solid #000000; text-align: left;">A. INFORMASI UMUM</td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">No. Laporan</td>
          <td style="width: 25%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${docTitleNo}</td>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Tanggal Pengisian</td>
          <td style="width: 25%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${tglTtdFormatted}</td>
        </tr>
        ${sectionARows}
        <tr>
          <td colspan="4" style="background-color: #E8E8E8; font-weight: bold; font-size: 9pt; padding: 2.5pt 5pt; border: 1px solid #000000; text-align: left;">B. WAKTU PELAKSANAAN</td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Tanggal Kegiatan</td>
          <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${tglFormatted}</td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Jam Mulai</td>
          <td style="width: 25%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${reportData.Pukul || '14:00'}</td>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Jam Selesai</td>
          <td style="width: 25%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${jamSelesai}</td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Tempat Pelaksanaan</td>
          <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${tempatPelaksanaan}</td>
        </tr>
        <tr>
          <td colspan="4" style="background-color: #E8E8E8; font-weight: bold; font-size: 9pt; padding: 2.5pt 5pt; border: 1px solid #000000; text-align: left;">C. PEMATERI</td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Nama Pemateri</td>
          <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${namaPemateri}</td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Jabatan / Instansi</td>
          <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${jabatanPemateri}</td>
        </tr>
        <tr>
          <td colspan="4" style="background-color: #E8E8E8; font-weight: bold; font-size: 9pt; padding: 2.5pt 5pt; border: 1px solid #000000; text-align: left;">D. ISI MATERI</td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Materi</td>
          <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${sesiDisplay}</td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">Modul</td>
          <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt;">${modulDisplay}</td>
        </tr>
        <tr>
          <td colspan="4" style="background-color: #E8E8E8; font-weight: bold; font-size: 9pt; padding: 2.5pt 5pt; border: 1px solid #000000; text-align: left;">E. ISI KEGIATAN</td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt; vertical-align: top;">Jumlah Peserta Hadir</td>
          <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt; vertical-align: top;">
            <div style="font-size: 8.5pt; line-height: 1.25;">
              <p style="font-weight: bold; margin: 0 0 2pt 0;">Total Dampingan : ${totalDampingan} orang</p>
              <p style="margin: 0;">Hadir : ${hadir} orang</p>
              <p style="margin: 0;">Sakit : ${sakit} orang</p>
              <p style="margin: 0;">Alpa  : ${alpa} orang</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt; vertical-align: top;">Rangkuman Kegiatan</td>
          <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt; vertical-align: top;">
            ${rangkumanHtml}
          </td>
        </tr>
        <tr>
          <td style="width: 25%; font-weight: bold; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt; vertical-align: middle;">Foto Kegiatan<br>(foto geotagging)</td>
          <td colspan="3" style="width: 75%; padding: 2.5pt 5pt; border: 1px solid #000000; font-size: 8.5pt; vertical-align: middle; text-align: center;">
            ${fotoHtml}
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * Format narasi laporan ke HTML terstruktur rapi sesuai standar ASPEND
 * Jarak antar baris dirapatkan sedikit (line-height: 1.2, margin-bottom: 3-4pt)
 */
function formatNarrativeHtml(narrative: string, p2k2TableHtml?: string, isP2K2 = false): string {
  if (!narrative || !narrative.trim()) {
    let emptyHtml = '<p style="font-style: italic; color: #555; font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.2;">[Narasi belum tersedia]</p>';
    if (p2k2TableHtml) emptyHtml += '\n' + p2k2TableHtml;
    return emptyHtml;
  }

  // Normalisasi karakter
  let text = narrative.replace(/[\u200B\u200C\u200D\uFEFF\u00AD\uFFFD]/g, '');
  text = text.replace(/^[^\w\s\d()\[\]"'.\-a-zA-Z]\s+/gm, '- ');

  const rawLines = text.split('\n');
  const htmlParts: string[] = [];
  let p2k2Inserted = false;
  let skippingSectionB = false;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trim();
    if (!line) continue;

    // Bersihkan penanda heading markdown (# ## ###) jika ada
    line = line.replace(/^#+\s*/, '').trim();

    // Lewati separator markdown atau tabel mentah
    if (line.includes('|') || /^[|\s\-+:]{3,}$/.test(line)) continue;

    // Lewati jika ada baris judul teks lama "Data Pelaksanaan P2K2:" agar tidak tumpang tindih
    if (/^(\*\*)?Data\s+Pelaksanaan\s+P2K2:?(\*\*)?$/i.test(line.replace(/<\/?b>/g, '').trim())) {
      continue;
    }

    // Format bold markdown **text** -> <b>text</b>
    line = line.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

    // Bersihkan HTML tag untuk deteksi judul seksi utama
    const cleanNoHtml = line.replace(/<[^>]+>/g, '').replace(/[*_#]/g, '').trim();

    // 1. Section Header Utama: strictly A., B., C., D., E. (case-insensitive for title, optional colon)
    const sectionMatch = cleanNoHtml.match(/^([A-E])\.\s+([A-Za-z0-9\s\(\)\/\-,–—]+?):?$/);
    if (sectionMatch && sectionMatch[2].trim().length <= 70) {
      const letter = sectionMatch[1].toUpperCase();
      const title = sectionMatch[2].trim();
      const sectionText = `${letter}. ${title.toUpperCase()}`;
      const isSectionB = letter === 'B';

      if (isP2K2 && isSectionB) {
        skippingSectionB = true;
        htmlParts.push(`
          <p style="font-size: 10.5pt; font-weight: bold; margin-top: 14pt; margin-bottom: 4pt; text-align: left; font-family: Arial, sans-serif; line-height: 1.2;">
            ${sectionText}
          </p>
        `);
        if (p2k2TableHtml && !p2k2Inserted) {
          htmlParts.push(p2k2TableHtml);
          p2k2Inserted = true;
        }
        continue;
      }

      if (skippingSectionB) {
        skippingSectionB = false;
      }

      // Khusus jika P2K2 table belum tersemat: letakkan sebelum C, D, E
      if (isP2K2 && p2k2TableHtml && !p2k2Inserted && ['C', 'D', 'E'].includes(letter)) {
        htmlParts.push(`
          <p style="font-size: 10.5pt; font-weight: bold; margin-top: 14pt; margin-bottom: 4pt; text-align: left; font-family: Arial, sans-serif; line-height: 1.2;">
            B. KEGIATAN YANG DILAKSANAKAN
          </p>
        `);
        htmlParts.push(p2k2TableHtml);
        p2k2Inserted = true;
      }

      const marginTop = letter === 'A' ? '8pt' : '14pt';
      htmlParts.push(`
        <p style="font-size: 10.5pt; font-weight: bold; margin-top: ${marginTop}; margin-bottom: 4pt; text-align: left; font-family: Arial, sans-serif; line-height: 1.2;">
          ${sectionText}
        </p>
      `);
      continue;
    }

    if (skippingSectionB && isP2K2) {
      // Lewati teks Section B karena sudah masuk ke Rangkuman Kegiatan di tabel P2K2
      continue;
    }

    // 2. Sub-heading bernomor dengan isi langsung (inline): "1. Gambaran Umum: [teks]"
    const numInlineMatch = line.match(/^(\d+\.\s+[^:\n]+?):\s*(.+)$/);
    if (numInlineMatch) {
      const subTitle = numInlineMatch[1].replace(/<\/?b>/g, '').trim();
      const bodyText = numInlineMatch[2].trim();
      htmlParts.push(`
        <p style="font-size: 10pt; line-height: 1.25; margin-top: 5pt; margin-bottom: 3pt; text-align: justify; font-family: Arial, sans-serif;">
          <b>${subTitle}:</b> ${bodyText}
        </p>
      `);
      continue;
    }

    // 3. Sub-heading bernomor tanpa isi (header baris tersendiri): "1. Gambaran Umum"
    const numHeaderMatch = line.match(/^(\d+\.\s+(?:Gambaran\s+Umum|Maksud\s+dan\s+Tujuan|Dasar|Ruang\s+Lingkup|Umum|Sasaran)[^:]*):?$/i);
    if (numHeaderMatch) {
      const subTitle = numHeaderMatch[1].replace(/<\/?b>/g, '').replace(/:$/, '').trim();
      htmlParts.push(`
        <p style="font-size: 10pt; font-weight: bold; margin-top: 5pt; margin-bottom: 2pt; text-align: left; font-family: Arial, sans-serif; line-height: 1.2;">
          ${subTitle}
        </p>
      `);
      continue;
    }

    // 4. List item: huruf kecil (a., b., c.), angka (1., 2.), atau bullet (- / • / *)
    // Gunakan borderless table agar alignment kalimat baris kedua dan seterusnya selalu rapi sejajar di bawah teks
    const listMatch = line.match(/^([a-z0-9][.)]|[-*•])\s+(.+)$/);
    if (listMatch) {
      const bullet = listMatch[1];
      const itemContent = listMatch[2];
      htmlParts.push(`
        <table style="width: 100%; border-collapse: collapse; border: none; margin: 1pt 0 2.5pt 0;" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 18pt; border: none; padding: 0; vertical-align: top;">&nbsp;</td>
            <td style="width: 18pt; border: none; padding: 0; vertical-align: top; font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.25; color: #000000;">${bullet}</td>
            <td style="border: none; padding: 0; vertical-align: top; text-align: justify; font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.25; color: #000000;">${itemContent}</td>
          </tr>
        </table>
      `);
      continue;
    }

    // 5. Paragraf biasa (dibawah B, C, D, E, dsb.)
    htmlParts.push(`
      <p style="font-size: 10pt; line-height: 1.25; margin-top: 0; margin-bottom: 4pt; text-indent: 20pt; text-align: justify; font-family: Arial, sans-serif;">
        ${line}
      </p>
    `);
  }

  // Jika seksi C, D, E tidak ditemukan, pastikan tabel P2K2 tetap tersemat di bagian Seksi B
  if (isP2K2 && p2k2TableHtml && !p2k2Inserted) {
    htmlParts.push(`
      <p style="font-size: 10.5pt; font-weight: bold; margin-top: 14pt; margin-bottom: 4pt; text-align: left; font-family: Arial, sans-serif; line-height: 1.2;">
        B. KEGIATAN YANG DILAKSANAKAN
      </p>
    `);
    htmlParts.push(p2k2TableHtml);
    p2k2Inserted = true;
  }

  // 6. Pastikan seksi E. PENUTUP selalu ada di dalam PDF resmi Kemensos
  const hasPenutupSection = rawLines.some(l => {
    const clean = l.replace(/<[^>]+>/g, '').replace(/[*_#]/g, '').trim();
    return /^E\.\s*PENUTUP/i.test(clean);
  });

  if (!hasPenutupSection) {
    htmlParts.push(`
      <p style="font-size: 10.5pt; font-weight: bold; margin-top: 14pt; margin-bottom: 4pt; text-align: left; font-family: Arial, sans-serif; line-height: 1.2;">
        E. PENUTUP
      </p>
      <p style="font-size: 10pt; line-height: 1.25; margin-top: 0; margin-bottom: 4pt; text-indent: 20pt; text-align: justify; font-family: Arial, sans-serif;">
        Demikian laporan pelaksanaan kegiatan ini dibuat sebagai bentuk pertanggungjawaban pelaksanaan tugas dan untuk dipergunakan sebagaimana mestinya.
      </p>
    `);
  }

  return htmlParts.join('\n');
}

export interface GeneratePdfParams {
  reportData: {
    ReportId: string;
    Tanggal: string;
    JenisRHK: string;
    IdRHK: string;
    RencanaAksi: string;
    Pukul: string;
    Lokasi?: string;
    NarasiEdited?: string;
    NarasiAI?: string;
    P2K2Data?: any;
    FotoIds?: string[];
    PdfFileId?: string;
  };
  userProfile: {
    nama: string;
    nip: string;
    jabatan: string;
    kabupaten: string;
    provinsi?: string;
    kecamatan?: string;
    signatureFileId?: string;
  };
}

/**
 * Menghasilkan atau memperbarui file PDF laporan RHK secara otomatis ke Google Drive
 */
export async function generateReportPDF(
  accessToken: string,
  params: GeneratePdfParams
): Promise<{ success: boolean; pdfFileId: string; fileName: string }> {
  const { reportData, userProfile } = params;
  const drive = await getDriveClient(accessToken);

  const idRHK = reportData.IdRHK || 'RHK-X';
  const rawDate = reportData.Tanggal ? new Date(reportData.Tanggal) : new Date();
  const validDate = isNaN(rawDate.getTime()) ? new Date() : rawDate;

  const yyyy = validDate.getFullYear();
  const mm = String(validDate.getMonth() + 1).padStart(2, '0');
  const dd = String(validDate.getDate()).padStart(2, '0');
  const ymd = `${yyyy}${mm}${dd}`;

  let timeStr = (reportData.Pukul || '14:00').toString().trim().replace(':', '.');
  if (timeStr.length === 2) timeStr += '.00';
  if (timeStr.length > 5) timeStr = timeStr.substring(0, 5);

  const numRHK = idRHK.replace(/\D/g, '') || idRHK;
  const rhkTag = numRHK.startsWith('RHK-') ? numRHK : `RHK-${numRHK}`;
  const cleanAksi = (reportData.RencanaAksi || reportData.JenisRHK || 'Laporan')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const docTitle = `${ymd} - ${timeStr} - ${rhkTag} - ${cleanAksi}`;

  // 1. Muat Logo KEMENSOS Resmi PNG Base64
  const kemensosLogoBase64 = getKemensosLogoBase64();

  // 2. Muat Tanda Tangan User jika ada
  let signatureBase64: string | null = null;
  if (userProfile.signatureFileId) {
    const sigRes = await getDriveImage(accessToken, userProfile.signatureFileId);
    if (sigRes) signatureBase64 = sigRes.base64;
  }

  // 3. Muat Foto Bukti Dukung beserta Dimensi yang Terukur
  const fotoList: LoadedDriveImage[] = [];
  if (reportData.FotoIds && reportData.FotoIds.length > 0) {
    for (const fotoId of reportData.FotoIds) {
      const imgRes = await getDriveImage(accessToken, fotoId);
      if (imgRes) fotoList.push(imgRes);
    }
  }

  // 4. Deteksi P2K2 dan Siapkan Tabel P2K2
  let parsedP2K2 = reportData.P2K2Data;
  if (typeof parsedP2K2 === 'string') {
    try {
      parsedP2K2 = JSON.parse(parsedP2K2);
    } catch {
      parsedP2K2 = null;
    }
  }

  const idUpper = (reportData.IdRHK || '').toUpperCase();
  const jenisUpper = (reportData.JenisRHK || '').toUpperCase();
  const aksiUpper = (reportData.RencanaAksi || '').toUpperCase();

  const isP2K2 = Boolean(
    idUpper.includes('RHK-2') ||
    idUpper === '2' ||
    jenisUpper.includes('P2K2') ||
    aksiUpper.includes('P2K2') ||
    aksiUpper.includes('PENINGKATAN KEMAMPUAN KELUARGA') ||
    isP2K2Rhk(reportData.JenisRHK || '') ||
    isP2K2Rhk(reportData.IdRHK || '') ||
    (parsedP2K2 && (parsedP2K2.modul || parsedP2K2.Modul || parsedP2K2.sesi || parsedP2K2.Sesi || parsedP2K2.namaKelompok))
  );

  if (isP2K2 && (!parsedP2K2 || typeof parsedP2K2 !== 'object')) {
    parsedP2K2 = {};
  }

  const narrative = reportData.NarasiEdited || reportData.NarasiAI || '';
  const bLines = isP2K2 ? extractSectionBLines(narrative) : [];
  const firstPhotoBase64 = isP2K2 && fotoList.length > 0 ? fotoList[0].base64 : null;
  const appendixPhotos = isP2K2 ? fotoList.slice(1) : fotoList;

  let p2k2TableHtml = '';
  if (isP2K2) {
    p2k2TableHtml = generateP2K2TableHtml(parsedP2K2, userProfile, reportData, validDate, bLines, firstPhotoBase64);
  }

  // 5. Format Narasi (dengan tabel P2K2 tersemat di Seksi B)
  const narrativeHtml = formatNarrativeHtml(narrative, p2k2TableHtml, isP2K2);

  // 6. Lampiran Dokumentasi Foto (Foto ke-2 dst. untuk P2K2, atau semua foto untuk non-P2K2)
  let appendixHtml = '';
  if (appendixPhotos.length > 0) {
    appendixHtml = `
      <p align="center" style="font-size: 13pt; font-weight: bold; margin-top: 24pt; margin-bottom: 6pt; text-align: center; font-family: Arial, sans-serif; line-height: 1.15;">LAMPIRAN DOKUMENTASI</p>
      
      ${appendixPhotos.map((foto, idx) => `
        <div style="margin-bottom: 14pt; text-align: center; page-break-inside: avoid;">
          <p align="center" style="font-size: 10pt; font-style: italic; margin-top: 2pt; margin-bottom: 4pt; text-align: center; color: #333; line-height: 1.15; font-family: Arial, sans-serif;">Foto ${isP2K2 ? idx + 2 : idx + 1}</p>
          <p align="center" style="text-align: center; margin: 0 auto; padding: 0; line-height: 1;">
            <img src="${foto.base64}" width="${foto.width}" height="${foto.height}" style="width: ${foto.width}pt; height: ${foto.height}pt; display: inline-block; margin: 0 auto;" />
          </p>
        </div>
      `).join('')}
    `;
  }

  // 7. Susun HTML Lengkap Dokumen (Lokasi dihilangkan, Jarak Baris Rapat & Margin Proporsional)
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${docTitle}</title>
      <style>
        @page {
          size: A4 portrait;
          margin-top: 28pt;
          margin-bottom: 36pt;
          margin-left: 54pt;
          margin-right: 54pt;
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #000000;
          font-size: 10pt;
          line-height: 1.2;
          margin: 0;
          padding: 0;
        }
        p, div, span, table, td, th, h1, h2, h3 {
          font-family: Arial, Helvetica, sans-serif;
          color: #000000;
          line-height: 1.2;
        }
      </style>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; padding: 0;">
      
      <!-- KOP SURAT RESMI KEMENSOS -->
      <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 0;" border="0">
        <tr>
          <td style="width: 80pt; text-align: center; vertical-align: middle; border: none; padding: 0;">
            ${kemensosLogoBase64 ? `<img src="${kemensosLogoBase64}" width="80" height="80" style="width: 80pt; height: 80pt;" />` : ''}
          </td>
          <td style="text-align: center; vertical-align: middle; border: none; padding: 0 0 0 8pt;">
            <p style="font-size: 13pt; font-weight: bold; margin: 0; line-height: 1.15; font-family: Arial, sans-serif;">KEMENTERIAN SOSIAL REPUBLIK INDONESIA</p>
            <p style="font-size: 10pt; font-weight: bold; margin: 1.5pt 0 0 0; line-height: 1.15; font-family: Arial, sans-serif;">DIREKTORAT JENDERAL PERLINDUNGAN DAN JAMINAN SOSIAL</p>
            <p style="font-size: 9.5pt; font-weight: bold; margin: 1.5pt 0 0 0; line-height: 1.15; font-family: Arial, sans-serif;">DIREKTORAT PERLINDUNGAN SOSIAL NON KEBENCANAAN</p>
            <p style="font-size: 7.5pt; margin: 1.5pt 0 0 0; line-height: 1.15; font-family: Arial, sans-serif;">Jl. Salemba Raya No. 28 Jakarta Pusat 10430 Telp. (021) 3103591 http://www.kemsos.go.id</p>
          </td>
        </tr>
      </table>

      <!-- GARIS PEMBATAS KOP SURAT TEBAL & PROPORSIAL -->
      <table style="width: 100%; border-collapse: collapse; border: none; margin-top: 3pt; margin-bottom: 14pt;" border="0">
        <tr>
          <td style="border-bottom: 3px solid #000000; height: 1pt; padding: 0; font-size: 1pt; line-height: 1;">&nbsp;</td>
        </tr>
      </table>

      <!-- HEADER LAPORAN -->
      <div style="text-align: center; margin-bottom: 10pt; font-family: Arial, sans-serif;">
        <p style="font-size: 13pt; font-weight: bold; margin: 0 0 2pt 0; text-transform: uppercase; line-height: 1.2;">
          LAPORAN RENCANA HASIL KERJA (${idRHK})
        </p>
        <p style="font-size: 10.5pt; font-style: italic; margin: 0 0 2pt 0; line-height: 1.2;">
          ${reportData.JenisRHK || '-'}
        </p>
        <p style="font-size: 10.5pt; margin: 0 0 8pt 0; line-height: 1.2;">
          (Periode: ${formatBulanTahun(validDate)})
        </p>
      </div>

      <!-- METADATA RENCANA AKSI & WAKTU (LOKASI DIHILANGKAN) -->
      <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 10pt; font-size: 10pt; font-family: Arial, sans-serif;" border="0">
        <tr>
          <td style="width: 85pt; vertical-align: top; padding: 1.5pt 0; border: none; line-height: 1.2;">Rencana Aksi</td>
          <td style="width: 12pt; vertical-align: top; padding: 1.5pt 0; text-align: center; border: none; line-height: 1.2;">:</td>
          <td style="vertical-align: top; padding: 1.5pt 0; border: none; line-height: 1.2;">${reportData.RencanaAksi || '-'}</td>
        </tr>
        <tr>
          <td style="vertical-align: top; padding: 1.5pt 0; border: none; line-height: 1.2;">Waktu</td>
          <td style="vertical-align: top; padding: 1.5pt 0; text-align: center; border: none; line-height: 1.2;">:</td>
          <td style="vertical-align: top; padding: 1.5pt 0; border: none; line-height: 1.2;">${formatTanggalIndonesia(validDate)}${timeStr ? `, Pukul ${timeStr}` : ''}</td>
        </tr>
      </table>

      <!-- ISI LAPORAN / NARASI (TERMASUK TABEL P2K2 DI SEKSI B) -->
      <div style="font-family: Arial, sans-serif;">
        ${narrativeHtml}
      </div>

      <!-- BLOK TANDA TANGAN (SATU KESATUAN - GESER KE KANAN 60%/40%, SPASI NORMAL 16PT) -->
      <table style="width: 100%; border-collapse: collapse; border: none; margin-top: 16pt; page-break-inside: avoid;" border="0">
        <tr style="page-break-inside: avoid;">
          <td style="width: 60%; border: none;"></td>
          <td style="width: 40%; border: none; font-size: 10pt; text-align: center; font-family: Arial, sans-serif; line-height: 1.2; page-break-inside: avoid;">
            <p align="center" style="margin: 0; font-size: 10pt; line-height: 1.2; text-align: center;">${userProfile.kabupaten || 'Binjai'}, ${formatTanggalTtd(validDate)}</p>
            <p align="center" style="margin: 2pt 0 0 0; font-size: 10pt; line-height: 1.2; text-align: center;">${userProfile.jabatan || 'Penata Layanan Operasional'}</p>
            
            <div style="height: 48pt; margin: 3pt 0; text-align: center;">
              ${signatureBase64 ? `
                <img src="${signatureBase64}" width="120" height="45" style="max-height: 45pt; max-width: 120pt; object-fit: contain; display: inline-block;" />
              ` : `
                <div style="height: 45pt;"></div>
              `}
            </div>

            <p align="center" style="margin: 0; font-size: 10pt; font-weight: bold; text-decoration: underline; line-height: 1.2; text-align: center;">${userProfile.nama || '-'}</p>
            <p align="center" style="margin: 2pt 0 0 0; font-size: 9.5pt; line-height: 1.2; text-align: center;">NIP. ${userProfile.nip || '-'}</p>
          </td>
        </tr>
      </table>

      <!-- LAMPIRAN FOTO DOKUMENTASI -->
      ${appendixHtml}

    </body>
    </html>
  `;

  // 8. Unggah HTML sebagai Google Doc sementara untuk konversi PDF resmi Drive
  const tempDoc = await drive.files.create({
    requestBody: {
      name: `TEMP_DOC_${docTitle}`,
      mimeType: 'application/vnd.google-apps.document',
    },
    media: {
      mimeType: 'text/html',
      body: fullHtml,
    },
  });

  if (!tempDoc.data.id) {
    throw new Error('Gagal membuat dokumen perantara di Google Drive.');
  }

  // 9. Atur margin dokumen & terapkan PageBreakBefore pada B. dan LAMPIRAN DOKUMENTASI secara native via Docs API
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const docs = google.docs({ version: 'v1', auth });

    // Baca dokumen perantara untuk mencari posisi "B." dan "LAMPIRAN DOKUMENTASI"
    const docRes = await docs.documents.get({ documentId: tempDoc.data.id });

    const batchRequests: any[] = [
      {
        updateDocumentStyle: {
          documentStyle: {
            marginTop: { magnitude: 28, unit: 'PT' },     // Rapat ke atas untuk kop surat hal 1
            marginBottom: { magnitude: 36, unit: 'PT' },  // Batas bawah 36pt
            marginLeft: { magnitude: 54, unit: 'PT' },    // Batas samping 54pt (0.75 in)
            marginRight: { magnitude: 54, unit: 'PT' },   // Batas samping 54pt (0.75 in)
            pageSize: {
              width: { magnitude: 595.28, unit: 'PT' },
              height: { magnitude: 841.89, unit: 'PT' },
            },
          },
          fields: 'marginTop,marginBottom,marginLeft,marginRight,pageSize',
        },
      },
    ];

    if (docRes.data.body?.content) {
      const content = docRes.data.body.content;
      let inLampiranSection = false;
      let justFinishedP2K2Table = false;

      // Helper function untuk mendeteksi apakah suatu elemen adalah tabel P2K2
      const isP2K2TableElem = (tElem: any): boolean => {
        if (!tElem?.table?.tableRows) return false;
        for (const r of tElem.table.tableRows) {
          if (r.tableCells) {
            for (const c of r.tableCells) {
              const text = c.content?.map((cp: any) => cp.paragraph?.elements?.map((e: any) => e.textRun?.content || '').join('') || '').join(' ').toLowerCase() || '';
              if (
                text.includes('keterangan p2k2') ||
                text.includes('nama kelompok') ||
                text.includes('informasi umum') ||
                text.includes('waktu pelaksanaan') ||
                text.includes('isi materi') ||
                text.includes('isi kegiatan')
              ) return true;
            }
          }
        }
        return false;
      };

      for (let elemIdx = 0; elemIdx < content.length; elemIdx++) {
        const elem = content[elemIdx];
        const nextElem = content[elemIdx + 1];

        // 1. Tangani Paragraf Tingkat Dokumen
        if (elem.paragraph && elem.startIndex != null && elem.endIndex != null && elem.startIndex < elem.endIndex) {
          const text = elem.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
          const trimmed = text.trim();
          const hasImage = elem.paragraph.elements?.some(e => e.inlineObjectElement);

          // Jika elemen ini tepat berada setelah tabel P2K2 (Spacer atau seksi C)
          if (justFinishedP2K2Table) {
            justFinishedP2K2Table = false;
            if (!trimmed) {
              // Spacer pemisah antara tabel P2K2 dengan C. HASIL di bawahnya
              batchRequests.push({
                updateParagraphStyle: {
                  range: {
                    startIndex: elem.startIndex,
                    endIndex: elem.endIndex,
                  },
                  paragraphStyle: {
                    spaceAbove: { magnitude: 2, unit: 'PT' },
                    spaceBelow: { magnitude: 12, unit: 'PT' },
                    lineSpacing: 100,
                  },
                  fields: 'spaceAbove,spaceBelow,lineSpacing',
                },
              });
              continue;
            }
          }

          // Jika paragraf ini tepat berada sebelum tabel P2K2, rapatkan jarak bawahnya ke tabel
          if (isP2K2TableElem(nextElem)) {
            batchRequests.push({
              updateParagraphStyle: {
                range: {
                  startIndex: elem.startIndex,
                  endIndex: elem.endIndex,
                },
                paragraphStyle: {
                  spaceAbove: { magnitude: 0, unit: 'PT' },
                  spaceBelow: { magnitude: 2, unit: 'PT' },
                },
                fields: 'spaceAbove,spaceBelow',
              },
            });
            continue;
          }

          // Kolaps paragraf kosong tanpa gambar agar tidak menciptakan halaman kosong perantara
          if (!trimmed && !hasImage) {
            batchRequests.push({
              updateParagraphStyle: {
                range: {
                  startIndex: elem.startIndex,
                  endIndex: elem.endIndex,
                },
                paragraphStyle: {
                  spaceAbove: { magnitude: 0, unit: 'PT' },
                  spaceBelow: { magnitude: 0, unit: 'PT' },
                  lineSpacing: 100,
                },
                fields: 'spaceAbove,spaceBelow,lineSpacing',
              },
            });
            continue;
          }

          // Header Judul Laporan: berikan jarak lega di bawah garis pembatas kop surat tebal
          if (trimmed.includes('LAPORAN RENCANA HASIL KERJA')) {
            batchRequests.push({
              updateParagraphStyle: {
                range: {
                  startIndex: elem.startIndex,
                  endIndex: elem.endIndex,
                },
                paragraphStyle: {
                  spaceAbove: { magnitude: 16, unit: 'PT' },
                  spaceBelow: { magnitude: 2, unit: 'PT' },
                  alignment: 'CENTER',
                  lineSpacing: 115,
                },
                fields: 'spaceAbove,spaceBelow,alignment,lineSpacing',
              },
            });
          }

          // Poin Besar A. (Strict case-sensitive: hanya huruf kapital A.)
          if (/^A\.\s+[A-Z]/.test(trimmed)) {
            batchRequests.push({
              updateParagraphStyle: {
                range: {
                  startIndex: elem.startIndex,
                  endIndex: elem.endIndex,
                },
                paragraphStyle: {
                  keepWithNext: true,
                  spaceAbove: { magnitude: 8, unit: 'PT' },
                  spaceBelow: { magnitude: 3, unit: 'PT' },
                },
                fields: 'keepWithNext,spaceAbove,spaceBelow',
              },
            });
            continue;
          }

          // Poin Besar B. Kegiatan Yang Dilaksanakan (Strict case-sensitive: hanya huruf kapital B.)
          if (/^B\.\s+[A-Z]/.test(trimmed)) {
            batchRequests.push({
              updateParagraphStyle: {
                range: {
                  startIndex: elem.startIndex,
                  endIndex: elem.endIndex,
                },
                paragraphStyle: {
                  pageBreakBefore: isP2K2, // HANYA P2K2 yang mulai di halaman baru karena tabel Kemensos yang besar!
                  keepWithNext: true,
                  spaceAbove: { magnitude: 14, unit: 'PT' },
                  spaceBelow: { magnitude: 3, unit: 'PT' },
                },
                fields: 'pageBreakBefore,keepWithNext,spaceAbove,spaceBelow',
              },
            });
            continue;
          }

          // Poin Besar C, D, E, dst. (Strict case-sensitive: hanya huruf kapital C, D, E)
          if (/^[C-E]\.\s+[A-Z]/.test(trimmed)) {
            batchRequests.push({
              updateParagraphStyle: {
                range: {
                  startIndex: elem.startIndex,
                  endIndex: elem.endIndex,
                },
                paragraphStyle: {
                  keepWithNext: true,
                  spaceAbove: { magnitude: 14, unit: 'PT' },
                  spaceBelow: { magnitude: 3, unit: 'PT' },
                },
                fields: 'keepWithNext,spaceAbove,spaceBelow',
              },
            });
            continue;
          }

          // Sub-poin judul bernomor khusus: 1. Gambaran Umum, 2. Maksud dan Tujuan, Dasar
          if (/^\d+\.\s+(?:Gambaran\s+Umum|Maksud\s+dan\s+Tujuan|Dasar)/i.test(trimmed)) {
            batchRequests.push({
              updateParagraphStyle: {
                range: {
                  startIndex: elem.startIndex,
                  endIndex: elem.endIndex,
                },
                paragraphStyle: {
                  keepWithNext: true,
                  spaceAbove: { magnitude: 5, unit: 'PT' },
                  spaceBelow: { magnitude: 2, unit: 'PT' },
                },
                fields: 'keepWithNext,spaceAbove,spaceBelow',
              },
            });
            continue;
          }

          // Kalimat penutup: berikan jarak proporsional sebelum blok tanda tangan (spaceBelow: 16pt)
          if (trimmed.toLowerCase().includes('demikian') || trimmed.toLowerCase().includes('sebagaimana mestinya')) {
            batchRequests.push({
              updateParagraphStyle: {
                range: {
                  startIndex: elem.startIndex,
                  endIndex: elem.endIndex,
                },
                paragraphStyle: {
                  spaceAbove: { magnitude: 2, unit: 'PT' },
                  spaceBelow: { magnitude: 16, unit: 'PT' },
                },
                fields: 'spaceAbove,spaceBelow',
              },
            });
            continue;
          }

          // Lampiran Dokumentasi: Mulai halaman baru dengan jarak atas proporsional (24pt)
          if (trimmed.includes('LAMPIRAN DOKUMENTASI')) {
            inLampiranSection = true;
            batchRequests.push({
              updateParagraphStyle: {
                range: {
                  startIndex: elem.startIndex,
                  endIndex: elem.endIndex,
                },
                paragraphStyle: {
                  pageBreakBefore: true,
                  spaceAbove: { magnitude: 24, unit: 'PT' },
                  spaceBelow: { magnitude: 6, unit: 'PT' },
                  alignment: 'CENTER',
                  lineSpacing: 100,
                },
                fields: 'pageBreakBefore,spaceAbove,spaceBelow,alignment,lineSpacing',
              },
            });
            continue;
          }

          // Di dalam bagian Lampiran Dokumentasi: Pastikan SEMUA caption & foto RATA TENGAH (CENTER)
          if (inLampiranSection) {
            if (/^Foto\s+\d+/i.test(trimmed)) {
              batchRequests.push({
                updateParagraphStyle: {
                  range: {
                    startIndex: elem.startIndex,
                    endIndex: elem.endIndex,
                  },
                  paragraphStyle: {
                    alignment: 'CENTER',
                    keepWithNext: true,
                    spaceAbove: { magnitude: 2, unit: 'PT' },
                    spaceBelow: { magnitude: 3, unit: 'PT' },
                    lineSpacing: 100,
                  },
                  fields: 'alignment,keepWithNext,spaceAbove,spaceBelow,lineSpacing',
                },
              });
            } else if (hasImage) {
              batchRequests.push({
                updateParagraphStyle: {
                  range: {
                    startIndex: elem.startIndex,
                    endIndex: elem.endIndex,
                  },
                  paragraphStyle: {
                    alignment: 'CENTER',
                    spaceAbove: { magnitude: 0, unit: 'PT' },
                    spaceBelow: { magnitude: 12, unit: 'PT' },
                  },
                  fields: 'alignment,spaceAbove,spaceBelow',
                },
              });
            } else if (trimmed) {
              batchRequests.push({
                updateParagraphStyle: {
                  range: {
                    startIndex: elem.startIndex,
                    endIndex: elem.endIndex,
                  },
                  paragraphStyle: {
                    alignment: 'CENTER',
                  },
                  fields: 'alignment',
                },
              });
            }
          }
        }

        // 2. Tangani Tabel (Termasuk Tabel P2K2 dan Sel Tanda Tangan)
        if (elem.table?.tableRows) {
          const isP2K2 = isP2K2TableElem(elem);
          if (isP2K2) {
            justFinishedP2K2Table = true;
          }

          for (const row of elem.table.tableRows) {
            if (row.tableCells) {
              for (const cell of row.tableCells) {
                if (cell.content) {
                  const cellText = cell.content
                    .map(c => c.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '')
                    .join(' ');

                  const kabClean = (userProfile.kabupaten || 'Binjai').toLowerCase().trim();
                  const namaClean = (userProfile.nama || '').toLowerCase().trim();
                  const lowerCell = cellText.toLowerCase();

                  const isSigCell =
                    (kabClean && lowerCell.includes(kabClean)) ||
                    lowerCell.includes('penata layanan operasional') ||
                    lowerCell.includes('nip.') ||
                    (namaClean && lowerCell.includes(namaClean));

                  if (isSigCell) {
                    const paragraphsInCell = cell.content.filter(
                      c => c.paragraph && c.startIndex != null && c.endIndex != null && c.startIndex < c.endIndex
                    );

                    for (let pIdx = 0; pIdx < paragraphsInCell.length; pIdx++) {
                      const pElem = paragraphsInCell[pIdx];
                      const isLast = pIdx === paragraphsInCell.length - 1;

                      batchRequests.push({
                        updateParagraphStyle: {
                          range: {
                            startIndex: pElem.startIndex,
                            endIndex: pElem.endIndex,
                          },
                          paragraphStyle: {
                            keepWithNext: !isLast,
                            keepLinesTogether: true,
                            alignment: 'CENTER',
                            spaceAbove: { magnitude: 1, unit: 'PT' },
                            spaceBelow: { magnitude: 2, unit: 'PT' },
                            lineSpacing: 100,
                          },
                          fields: 'keepWithNext,keepLinesTogether,alignment,spaceAbove,spaceBelow,lineSpacing',
                        },
                      });
                    }
                  } else if (isP2K2) {
                    // Paragraf dalam sel tabel P2K2: RAPATKAN TINGGI BARIS (spaceAbove: 0, spaceBelow: 0, lineSpacing: 100)
                    const paragraphsInCell = cell.content.filter(
                      c => c.paragraph && c.startIndex != null && c.endIndex != null && c.startIndex < c.endIndex
                    );

                    for (const pElem of paragraphsInCell) {
                      batchRequests.push({
                        updateParagraphStyle: {
                          range: {
                            startIndex: pElem.startIndex,
                            endIndex: pElem.endIndex,
                          },
                          paragraphStyle: {
                            spaceAbove: { magnitude: 0, unit: 'PT' },
                            spaceBelow: { magnitude: 0, unit: 'PT' },
                            lineSpacing: 100,
                          },
                          fields: 'spaceAbove,spaceBelow,lineSpacing',
                        },
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    await docs.documents.batchUpdate({
      documentId: tempDoc.data.id,
      requestBody: {
        requests: batchRequests,
      },
    });
  } catch (docsErr: any) {
    console.warn('Docs API batchUpdate (margin & page break):', docsErr?.message || docsErr);
  }

  // 10. Ekspor Google Doc ke format PDF resmi
  const pdfExportRes = await drive.files.export(
    {
      fileId: tempDoc.data.id,
      mimeType: 'application/pdf',
    },
    { responseType: 'arraybuffer' }
  );

  const pdfBuffer = Buffer.from(pdfExportRes.data as ArrayBuffer);

  // 11. Hapus Dokumen Google Doc Sementara
  try {
    await drive.files.delete({ fileId: tempDoc.data.id });
  } catch {
    // Abaikan jika hapus gagal
  }

  // 12. Perbarui PDF lama di Google Drive atau Buat PDF baru
  let targetPdfId = reportData.PdfFileId;

  if (targetPdfId && targetPdfId.length > 5) {
    try {
      await drive.files.update({
        fileId: targetPdfId,
        requestBody: {
          name: `${docTitle}.pdf`,
        },
        media: {
          mimeType: 'application/pdf',
          body: Readable.from(pdfBuffer),
        },
      });
    } catch (updateErr) {
      console.warn('Gagal memperbarui file PDF yang sudah ada, membuat file baru:', updateErr);
      targetPdfId = '';
    }
  }

  if (!targetPdfId) {
    const outputFolderId = await getOrCreateFolder(accessToken, 'RHK-agent_Output');
    const newFile = await uploadFileToDrive(
      accessToken,
      `${docTitle}.pdf`,
      'application/pdf',
      pdfBuffer,
      outputFolderId || undefined
    );
    targetPdfId = newFile?.id || '';
  }

  return {
    success: true,
    pdfFileId: targetPdfId || '',
    fileName: `${docTitle}.pdf`,
  };
}
