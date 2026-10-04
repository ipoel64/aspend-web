/**
 * VERKOM PDF Generator
 * Menghasilkan dokumen PDF Landscape A4 resmi Kemensos untuk Verifikasi Komitmen Pendidikan
 * Porting langsung dari rhk_agent_mobile/lib/screens/verkom/verkom_tools_screen.dart
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VerkomParseResult } from './verkom-parser';

export interface GeneratePdfOptions {
  city?: string;
  sourceFileName?: string;
}

/**
 * Menghasilkan instance jsPDF untuk dokumen Verifikasi Komitmen Pendidikan (Landscape A4)
 */
export function buildVerkomPdfDoc(data: VerkomParseResult, options?: GeneratePdfOptions): jsPDF {
  // A4 Landscape: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const { metadata, rows } = data;

  // 1. Header Formulir
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);
  doc.text(metadata.title || 'FORM VERIFIKASI KOMITMEN PENDIDIKAN', 10, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(metadata.npsn || 'NPSN :', 10, 16.5);
  doc.text(metadata.schoolName || 'Nama Sekolah :', 10, 20.5);

  // 2. Multi-level Table Header
  const head = [
    // Header Row 1: Judul kolom utama + Nama Bulan
    [
      { content: 'NO', rowSpan: 3, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'NIK PENGURUS', rowSpan: 3, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'NAMA PENGURUS', rowSpan: 3, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'NIK SISWA', rowSpan: 3, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'NISN', rowSpan: 3, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'NAMA SISWA', rowSpan: 3, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'BENTUK\nPENDIDIKAN', rowSpan: 3, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'TINGKAT\nPENDIDIKAN', rowSpan: 3, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: metadata.month1 || 'BULAN 1', colSpan: 5, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
      { content: metadata.month2 || 'BULAN 2', colSpan: 5, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
      { content: metadata.month3 || 'BULAN 3', colSpan: 5, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
      { content: 'KET', rowSpan: 3, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'NAMA PENDAMPING', rowSpan: 3, styles: { halign: 'center' as const, valign: 'middle' as const } },
    ],
    // Header Row 2: Hari Efektif
    [
      { content: 'Hari Efektif: ......', colSpan: 5, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
      { content: 'Hari Efektif: ......', colSpan: 5, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
      { content: 'Hari Efektif: ......', colSpan: 5, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
    ],
    // Header Row 3: Sub-kolom absensi per bulan
    [
      // Month 1
      { content: 'ALPA', styles: { halign: 'center' as const } },
      { content: 'IZIN', styles: { halign: 'center' as const } },
      { content: 'SAKIT', styles: { halign: 'center' as const } },
      { content: 'JML', styles: { halign: 'center' as const } },
      { content: '%', styles: { halign: 'center' as const } },
      // Month 2
      { content: 'ALPA', styles: { halign: 'center' as const } },
      { content: 'IZIN', styles: { halign: 'center' as const } },
      { content: 'SAKIT', styles: { halign: 'center' as const } },
      { content: 'JML', styles: { halign: 'center' as const } },
      { content: '%', styles: { halign: 'center' as const } },
      // Month 3
      { content: 'ALPA', styles: { halign: 'center' as const } },
      { content: 'IZIN', styles: { halign: 'center' as const } },
      { content: 'SAKIT', styles: { halign: 'center' as const } },
      { content: 'JML', styles: { halign: 'center' as const } },
      { content: '%', styles: { halign: 'center' as const } },
    ],
  ];

  // Helper truncate jika teks terlalu panjang (sama seperti mobile)
  const truncate = (val: string, maxLen = 22) => {
    if (!val) return '';
    const str = val.trim();
    return str.length > maxLen ? `${str.slice(0, maxLen - 3)}...` : str;
  };

  const body = rows.map((r, idx) => [
    r.no || (idx + 1).toString(),
    r.nikPengurus,
    truncate(r.namaPengurus, 24),
    r.nikSiswa,
    r.nisn,
    truncate(r.namaSiswa, 25),
    r.bentukPendidikan,
    r.tingkatPendidikan,
    // Month 1
    r.m1Alpa,
    r.m1Izin,
    r.m1Sakit,
    r.m1Jml,
    r.m1Persen,
    // Month 2
    r.m2Alpa,
    r.m2Izin,
    r.m2Sakit,
    r.m2Jml,
    r.m2Persen,
    // Month 3
    r.m3Alpa,
    r.m3Izin,
    r.m3Sakit,
    r.m3Jml,
    r.m3Persen,
    // KET & Pendamping
    r.ket,
    truncate(r.namaPendamping, 24),
  ]);

  // Total lebar kertas: 297mm. Margin kiri 8mm, kanan 8mm => Sisa 281mm
  autoTable(doc, {
    startY: 23.5,
    margin: { top: 12, left: 8, right: 8, bottom: 12 },
    head: head,
    body: body,
    theme: 'grid',
    styles: {
      fontSize: 5.8,
      cellPadding: 0.8,
      lineColor: [40, 40, 40],
      lineWidth: 0.15,
      textColor: [20, 20, 20],
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontSize: 5.2,
      fontStyle: 'bold',
      lineColor: [40, 40, 40],
      lineWidth: 0.15,
      cellPadding: 0.7,
    },
    columnStyles: {
      0: { cellWidth: 7.5, halign: 'center' },  // NO
      1: { cellWidth: 21, halign: 'center' },   // NIK PENGURUS
      2: { cellWidth: 26, halign: 'left' },     // NAMA PENGURUS
      3: { cellWidth: 21, halign: 'center' },   // NIK SISWA
      4: { cellWidth: 17, halign: 'center' },   // NISN
      5: { cellWidth: 28, halign: 'left' },     // NAMA SISWA
      6: { cellWidth: 12, halign: 'center' },   // BENTUK PENDIDIKAN
      7: { cellWidth: 13, halign: 'center' },   // TINGKAT PENDIDIKAN
      // Month 1: 5 * 5.6 = 28mm
      8: { cellWidth: 5.6, halign: 'center' },
      9: { cellWidth: 5.6, halign: 'center' },
      10: { cellWidth: 5.6, halign: 'center' },
      11: { cellWidth: 5.6, halign: 'center' },
      12: { cellWidth: 5.6, halign: 'center' },
      // Month 2: 5 * 5.6 = 28mm
      13: { cellWidth: 5.6, halign: 'center' },
      14: { cellWidth: 5.6, halign: 'center' },
      15: { cellWidth: 5.6, halign: 'center' },
      16: { cellWidth: 5.6, halign: 'center' },
      17: { cellWidth: 5.6, halign: 'center' },
      // Month 3: 5 * 5.6 = 28mm
      18: { cellWidth: 5.6, halign: 'center' },
      19: { cellWidth: 5.6, halign: 'center' },
      20: { cellWidth: 5.6, halign: 'center' },
      21: { cellWidth: 5.6, halign: 'center' },
      22: { cellWidth: 5.6, halign: 'center' },
      // KET & Pendamping
      23: { cellWidth: 9, halign: 'center' },
      24: { cellWidth: 25, halign: 'left' },
    },
    didDrawPage: (hookData) => {
      // Running page number at the bottom right
      const str = `Halaman ${hookData.pageNumber}`;
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(str, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 6);
    },
  });

  // 3. Signature Block di Bagian Bawah Kanan (Persis seperti mobile)
  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  let sigY = finalY + 7;
  // Jika tidak cukup ruang untuk tanda tangan (butuh ~32mm), pindah ke halaman baru
  if (sigY + 34 > pageHeight - 10) {
    doc.addPage();
    sigY = 18;
  }

  const sigX = pageWidth - 68; // Area tanda tangan di sisi kanan

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);

  doc.text('............ , ......................../20......', sigX, sigY);
  doc.text('Diketahui Oleh :', sigX, sigY + 4);
  doc.text('Kepala Sekolah/wakil/Kesiswaan', sigX, sigY + 8);

  // Garis tanda tangan
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);
  doc.line(sigX, sigY + 28, sigX + 52, sigY + 28);

  return doc;
}

/**
 * Menghasilkan file PDF dan mengunduhnya langsung ke peramban
 */
export function downloadVerkomPdf(data: VerkomParseResult, fileName: string): void {
  const doc = buildVerkomPdfDoc(data);
  const cleanName = fileName.replace(/\.[^/.]+$/, '');
  doc.save(`VERKOM_${cleanName}.pdf`);
}

/**
 * Mengubah dokumen PDF menjadi Blob untuk dikirim ke Google Drive API
 */
export function getVerkomPdfBlob(data: VerkomParseResult): Blob {
  const doc = buildVerkomPdfDoc(data);
  return doc.output('blob');
}
