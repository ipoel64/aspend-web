import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { KpmKeluarga } from './kpm-constants';
import { LOGO_KEMENSOS_BASE64, LOGO_PKH_BASE64 } from './kpm-logos';

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Format tanggal Indonesia lengkap dengan nama hari:
 * Contoh: "Senin, 05 Oktober 2026"
 */
export function formatTanggalIndonesiaLengkap(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      const hari = NAMA_HARI[d.getDay()];
      const tgl = String(day).padStart(2, '0');
      const bln = NAMA_BULAN[month];
      return `${hari}, ${tgl} ${bln} ${year}`;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const hari = NAMA_HARI[d.getDay()];
  const tgl = String(d.getDate()).padStart(2, '0');
  const bln = NAMA_BULAN[d.getMonth()];
  const thn = d.getFullYear();
  return `${hari}, ${tgl} ${bln} ${thn}`;
}

/**
 * Format tanggal untuk blok tanda tangan:
 * Contoh: "05 Oktober 2026"
 */
export function formatTanggalTtd(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const bln = NAMA_BULAN[month];
    return `${String(day).padStart(2, '0')} ${bln} ${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const tgl = String(d.getDate()).padStart(2, '0');
  const bln = NAMA_BULAN[d.getMonth()];
  const thn = d.getFullYear();
  return `${tgl} ${bln} ${thn}`;
}

export interface KpmAbsensiPdfParams {
  kelompok: string;
  filterStatus: 'aktif' | 'non-aktif' | 'semua';
  modulP2K2: string;
  sesiP2K2: string;
  tanggal: string;
  lokasi: string;
  namaPendamping: string;
  nipPendamping: string;
  kpmList: KpmKeluarga[];
}

/**
 * Membuat dokumen PDF A4 resmi Kemensos & PKH untuk Daftar Hadir P2K2
 */
export function buildKpmAbsensiPdf(params: KpmAbsensiPdfParams): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 12; // 12mm left & right
  const usableWidth = pageWidth - marginX * 2; // 186mm

  const sampleKpm = params.kpmList[0];
  const formattedDate = formatTanggalIndonesiaLengkap(params.tanggal);
  const formattedTtdDate = formatTanggalTtd(params.tanggal);

  // 1. KOP SURAT RESMI
  // Logo Kemensos (Kiri)
  try {
    if (LOGO_KEMENSOS_BASE64) {
      doc.addImage(LOGO_KEMENSOS_BASE64, 'PNG', marginX, 10, 22, 22);
    }
  } catch (err) {
    console.warn('Gagal memuat logo Kemensos di PDF:', err);
  }

  // Logo PKH (Kanan)
  try {
    if (LOGO_PKH_BASE64) {
      // PKH logo proporsional (lebar sedikit lebih besar)
      doc.addImage(LOGO_PKH_BASE64, 'PNG', pageWidth - marginX - 25, 10, 25, 20);
    }
  } catch (err) {
    console.warn('Gagal memuat logo PKH di PDF:', err);
  }

  // Teks Kop Tengah
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', pageWidth / 2, 13, { align: 'center' });

  doc.setFontSize(9.5);
  doc.text('DIREKTORAT JAMINAN SOSIAL KELUARGA', pageWidth / 2, 17.5, { align: 'center' });

  doc.setFontSize(9);
  doc.text('PROGRAM KELUARGA HARAPAN (PKH)', pageWidth / 2, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text('Sekretariat: Jl. Salemba Raya No. 28, Jakarta Pusat 10430 Telp. (021) 3103591', pageWidth / 2, 26, { align: 'center' });

  // Garis Pembatas Kop Surat Ganda (Tebal & Tipis)
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.8);
  doc.line(marginX, 29.5, pageWidth - marginX, 29.5);
  doc.setLineWidth(0.2);
  doc.line(marginX, 30.5, pageWidth - marginX, 30.5);

  // 2. JUDUL DOKUMEN
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('DAFTAR HADIR PERTEMUAN PENINGKATAN KEMAMPUAN KELUARGA (P2K2 / FDS)', pageWidth / 2, 36.5, { align: 'center' });

  const statusLabel =
    params.filterStatus === 'aktif'
      ? 'STATUS KEPESERTAAN: KPM AKTIF'
      : params.filterStatus === 'non-aktif'
      ? 'STATUS KEPESERTAAN: KPM NON-AKTIF / GRADUASI'
      : 'STATUS KEPESERTAAN: SELURUH KPM (GABUNGAN)';

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(statusLabel, pageWidth / 2, 40.5, { align: 'center' });

  // 3. METADATA KEGIATAN (2 Kolom Rapi)
  const metaY = 44.5;
  const col1X = marginX;
  const col1ValX = marginX + 32;
  const col2X = marginX + 96;
  const col2ValX = marginX + 130;
  const rowHeight = 4.2;

  doc.setFontSize(7.8);
  doc.setTextColor(30, 41, 59);

  // Baris 1
  doc.setFont('helvetica', 'normal');
  doc.text('Nama Kelompok PKH', col1X, metaY);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${params.kelompok || 'Semua Kelompok'}`, col1ValX, metaY);

  doc.setFont('helvetica', 'normal');
  doc.text('Hari / Tanggal', col2X, metaY);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${formattedDate}`, col2ValX, metaY);

  // Baris 2
  doc.setFont('helvetica', 'normal');
  doc.text('Kelurahan / Desa', col1X, metaY + rowHeight);
  doc.text(`: ${sampleKpm?.Kelurahan || 'Kartini'}`, col1ValX, metaY + rowHeight);

  doc.text('Tempat / Lokasi', col2X, metaY + rowHeight);
  doc.text(`: ${params.lokasi || 'Rumah Ketua Kelompok'}`, col2ValX, metaY + rowHeight);

  // Baris 3
  doc.text('Kecamatan / Kota', col1X, metaY + rowHeight * 2);
  const kecKota = [sampleKpm?.Kecamatan, sampleKpm?.KabKota].filter(Boolean).join(', ') || 'Binjai Kota';
  doc.text(`: ${kecKota}`, col1ValX, metaY + rowHeight * 2);

  doc.text('Nama Pendamping', col2X, metaY + rowHeight * 2);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${params.namaPendamping}`, col2ValX, metaY + rowHeight * 2);

  // Baris 4
  doc.setFont('helvetica', 'normal');
  doc.text('Modul P2K2', col1X, metaY + rowHeight * 3);
  doc.setFont('helvetica', 'bold');
  const splitModul = doc.splitTextToSize(`: ${params.modulP2K2}`, 62);
  doc.text(splitModul, col1ValX, metaY + rowHeight * 3);

  doc.setFont('helvetica', 'normal');
  doc.text('NIP / No. Registrasi', col2X, metaY + rowHeight * 3);
  doc.text(`: ${params.nipPendamping || '-'}`, col2ValX, metaY + rowHeight * 3);

  // Baris 5
  const modulExtraHeight = (splitModul.length - 1) * 3.5;
  const sesiY = metaY + rowHeight * 4 + modulExtraHeight;
  doc.setFont('helvetica', 'normal');
  doc.text('Sesi Modul', col1X, sesiY);
  const splitSesi = doc.splitTextToSize(`: ${params.sesiP2K2}`, 62);
  doc.text(splitSesi, col1ValX, sesiY);

  const metaEnd = Math.max(sesiY + (splitSesi.length - 1) * 3.5, metaY + rowHeight * 4) + 2.5;

  // 4. KOTAK REKAPITULASI KEHADIRAN (Sesuai Permintaan User: Jumlah Peserta & Total/Hadir/Sakit/Alpa)
  const boxY = metaEnd;
  const boxHeight = 9.5;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, boxY, usableWidth, boxHeight, 1.5, 1.5, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  // Baris 1 Kotak: Jumlah Peserta Pertemuan
  doc.setFont('helvetica', 'bold');
  doc.text('Jumlah Peserta Pertemuan :', marginX + 3, boxY + 4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(3, 105, 161); // sky-700
  doc.text(`${params.kpmList.length} Orang`, marginX + 44, boxY + 4);

  // Baris 2 Kotak: Kehadiran (Total, Hadir, Sakit, Alpa)
  doc.setTextColor(15, 23, 42);
  doc.text('Kehadiran :', marginX + 3, boxY + 7.8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Total: ${params.kpmList.length} Orang     |     Hadir:  ...... Orang     |     Sakit:  ...... Orang     |     Alpa:  ...... Orang`,
    marginX + 22,
    boxY + 7.8
  );

  // 5. TABEL DAFTAR HADIR (autoTable)
  const tableStartY = boxY + boxHeight + 3.5;

  const tableRows = params.kpmList.map((kpm, idx) => {
    const no = idx + 1;
    const isOdd = no % 2 !== 0;
    const isGrad =
      kpm.StatusKepesertaan === 'Graduasi' ||
      kpm.StatusGraduasi === 'Sudah Graduasi' ||
      kpm.StatusGraduasi === 'Graduasi Mandiri' ||
      kpm.StatusGraduasi === 'Graduasi Alami' ||
      kpm.CatatanTemuan?.includes('Sudah Graduasi');

    const roleSuffix = kpm.StatusKelompok === 'Ketua Kelompok' ? '\n(KETUA KELOMPOK)' : '';
    const namaText = `${kpm.NamaPengurus || ''}${roleSuffix}`;
    const nikKkText = `${kpm.NIK || '—'}\nKK: ${kpm.NoKK || '—'}`;
    const alamatText = `${kpm.Alamat || ''}${kpm.Lingkungan ? ` (Lingk. ${kpm.Lingkungan})` : ''}`.trim() || '—';

    return [
      no.toString(),
      namaText,
      nikKkText,
      alamatText,
      isGrad ? 'GRADUASI' : 'AKTIF',
      isOdd ? `${no}. ..........................` : '',
      !isOdd ? `${no}. ..........................` : '',
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: marginX, right: marginX, bottom: 12 },
    head: [
      [
        { content: 'NO', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'NAMA LENGKAP PENGURUS', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
        { content: 'NIK / NO. KK', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'ALAMAT / LINGKUNGAN', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
        { content: 'STATUS', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'TANDA TANGAN / CAP JEMPOL', colSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      ],
      [
        { content: 'GANJIL', styles: { halign: 'center', valign: 'middle' } },
        { content: 'GENAP', styles: { halign: 'center', valign: 'middle' } },
      ],
    ],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      textColor: [20, 20, 20],
      lineColor: [40, 40, 40],
      lineWidth: 0.2,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      lineColor: [40, 40, 40],
      lineWidth: 0.25,
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', valign: 'middle' },
      1: { cellWidth: 46, halign: 'left', valign: 'middle', fontStyle: 'bold' },
      2: { cellWidth: 36, halign: 'center', valign: 'middle' },
      3: { cellWidth: 40, halign: 'left', valign: 'middle' },
      4: { cellWidth: 16, halign: 'center', valign: 'middle', fontStyle: 'bold' },
      5: { cellWidth: 20, halign: 'left', valign: 'top', minCellHeight: 8.5 },
      6: { cellWidth: 20, halign: 'left', valign: 'top', minCellHeight: 8.5 },
    },
    didDrawPage: (data) => {
      // Header halaman berulang (halaman 2 dst)
      if (data.pageNumber > 1) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Daftar Hadir Pertemuan P2K2 - Kelompok: ${params.kelompok || 'PKH'} (${formattedDate})`,
          marginX,
          8
        );
        doc.text(`Hal. ${data.pageNumber}`, pageWidth - marginX, 8, { align: 'right' });
      }
    },
  });

  // 6. BLOK TANDA TANGAN DI BAGIAN BAWAH
  const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 50;
  let ttdY = finalY + 8;

  // Jika sisa halaman < 36mm, buat halaman baru untuk tanda tangan
  if (ttdY + 36 > pageHeight - 12) {
    doc.addPage();
    ttdY = 18;
  }

  const ttdCol1X = marginX + 15;
  const ttdCol2X = pageWidth - marginX - 55;

  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);

  // Kiri: Mengetahui Ketua Kelompok
  doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui,', ttdCol1X, ttdY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Ketua Kelompok PKH', ttdCol1X, ttdY + 4, { align: 'center' });

  const ketuaKpm = params.kpmList.find((k) => k.StatusKelompok === 'Ketua Kelompok');
  const namaKetua = ketuaKpm?.NamaPengurus || '( .................................................. )';

  doc.setFont('helvetica', 'bold');
  doc.text(namaKetua, ttdCol1X, ttdY + 24, { align: 'center' });
  doc.line(ttdCol1X - 25, ttdY + 25, ttdCol1X + 25, ttdY + 25);

  // Kanan: Pendamping Sosial PKH
  const kotaKab = sampleKpm?.KabKota || 'Kota Binjai';
  doc.setFont('helvetica', 'normal');
  doc.text(`${kotaKab}, ${formattedTtdDate}`, ttdCol2X, ttdY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Pendamping Sosial PKH', ttdCol2X, ttdY + 4, { align: 'center' });

  doc.text(params.namaPendamping.toUpperCase(), ttdCol2X, ttdY + 24, { align: 'center' });
  doc.line(ttdCol2X - 25, ttdY + 25, ttdCol2X + 25, ttdY + 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP/Reg: ${params.nipPendamping || '-'}`, ttdCol2X, ttdY + 29, { align: 'center' });

  return doc;
}

/**
 * Trigger download file PDF langsung ke peramban
 */
export function downloadKpmAbsensiPdf(params: KpmAbsensiPdfParams): void {
  const doc = buildKpmAbsensiPdf(params);
  const cleanKelompok = (params.kelompok || 'Semua_Kelompok').replace(/[\\/:*?"<>|\s]/g, '_');
  const cleanDate = (params.tanggal || 'Pertemuan').replace(/[-:]/g, '');
  const fileName = `Absensi_P2K2_${cleanKelompok}_${cleanDate}.pdf`;
  doc.save(fileName);
}
