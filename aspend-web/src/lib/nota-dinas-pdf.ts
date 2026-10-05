import { jsPDF } from 'jspdf';
import { NotaDinasItem } from './nota-dinas-constants';

export interface NotaDinasUserProfile {
  nama: string;
  nip?: string;
  jabatan?: string;
  signatureUrl?: string;
  signatureBase64?: string;
}

export function buildNotaDinasPdf(
  notaDinas: NotaDinasItem,
  userProfile?: NotaDinasUserProfile,
  buktiDukungImages?: string[]
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 22; // 22mm left & right
  const usableWidth = pageWidth - marginX * 2; // 166mm

  // 1. HEADER DOKUMEN: NOTA DINAS & NOMOR
  let currentY = 24;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('NOTA DINAS', pageWidth / 2, currentY, { align: 'center' });

  // Underline for NOTA DINAS
  const titleWidth = doc.getTextWidth('NOTA DINAS');
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(pageWidth / 2 - titleWidth / 2, currentY + 1.2, pageWidth / 2 + titleWidth / 2, currentY + 1.2);

  currentY += 6.5;
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Nomor: ${notaDinas.nomor || '-'}`, pageWidth / 2, currentY, { align: 'center' });

  currentY += 8;

  // 2. TABEL METADATA SURAT (Kepada Yth, Dari, Sifat, Lampiran, Tanggal, Hal)
  const metaFields: [string, string][] = [
    ['Kepada Yth.', notaDinas.yth || '-'],
    ['Dari', notaDinas.dari || '-'],
    ['Sifat', notaDinas.sifat || 'Biasa'],
    ['Lampiran', notaDinas.lampiran || '-'],
    ['Tanggal', notaDinas.tanggal || '-'],
    ['Hal', notaDinas.hal || '-'],
  ];

  const col1W = 28;
  const colColonW = 5;
  const colValW = usableWidth - col1W - colColonW;

  doc.setFontSize(10);

  for (const [label, val] of metaFields) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, marginX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(':', marginX + col1W, currentY);

    const splitVal = doc.splitTextToSize(val, colValW);
    doc.text(splitVal, marginX + col1W + colColonW, currentY);

    const rowH = Math.max(splitVal.length * 4.8, 5.5);
    currentY += rowH;
  }

  currentY += 2;

  // 3. GARIS PEMISAH TEBAL
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.6);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  currentY += 7;

  // 4. ISI NOTA DINAS (Paragraf-Paragraf Rapi dengan Indentasi & Justified)
  const rawParagraphs = (notaDinas.isiNotaDinas || '')
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const paraIndent = 24; // Indentasi isi surat sesuai standar tata naskah dinas
  const bodyWidth = usableWidth - paraIndent;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);

  for (const para of rawParagraphs) {
    const lines = doc.splitTextToSize(`      ${para}`, bodyWidth);

    // Cek jika halaman tidak cukup
    if (currentY + lines.length * 5.2 > pageHeight - 55) {
      doc.addPage();
      currentY = 25;
    }

    doc.text(lines, marginX + paraIndent, currentY, {
      align: 'justify',
      maxWidth: bodyWidth,
    });

    currentY += lines.length * 5.2 + 3.5;
  }

  // 5. BLOK TANDA TANGAN DI SEBELAH KANAN
  const ttdBlockHeight = 45;
  if (currentY + ttdBlockHeight > pageHeight - 20) {
    doc.addPage();
    currentY = 25;
  } else {
    currentY += 6;
  }

  const ttdCenterX = pageWidth - marginX - 35; // Center of signature block

  const jabatanText = userProfile?.jabatan?.trim() || notaDinas.dari || 'Pendamping Sosial';
  const namaText = (userProfile?.nama?.trim() || 'SYAIFUL KHOLIFAH').toUpperCase();
  const nipText = userProfile?.nip?.trim() ? `NIP. ${userProfile.nip.trim()}` : '';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(jabatanText, ttdCenterX, currentY, { align: 'center' });

  currentY += 5;

  // Jika ada tanda tangan digital
  let hasDrawnSignature = false;
  if (userProfile?.signatureBase64) {
    try {
      doc.addImage(userProfile.signatureBase64, 'PNG', ttdCenterX - 18, currentY, 36, 18);
      currentY += 20;
      hasDrawnSignature = true;
    } catch {
      hasDrawnSignature = false;
    }
  }

  if (!hasDrawnSignature) {
    currentY += 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(namaText, ttdCenterX, currentY, { align: 'center' });

  // Underline nama pejabat
  const namaWidth = doc.getTextWidth(namaText);
  doc.setLineWidth(0.3);
  doc.line(ttdCenterX - namaWidth / 2, currentY + 0.8, ttdCenterX + namaWidth / 2, currentY + 0.8);

  if (nipText) {
    currentY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(nipText, ttdCenterX, currentY, { align: 'center' });
  }

  // 6. HALAMAN LAMPIRAN BUKTI DUKUNG (JIKA ADA FOTO)
  if (buktiDukungImages && buktiDukungImages.length > 0) {
    doc.addPage();
    let attachY = 25;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('LAMPIRAN DOKUMENTASI NOTA DINAS', pageWidth / 2, attachY, { align: 'center' });

    attachY += 10;

    for (let i = 0; i < buktiDukungImages.length; i++) {
      const imgBase64 = buktiDukungImages[i];
      if (!imgBase64) continue;

      if (attachY + 95 > pageHeight - 15) {
        doc.addPage();
        attachY = 25;
      }

      try {
        doc.addImage(imgBase64, 'JPEG', marginX + 8, attachY, usableWidth - 16, 90, undefined, 'FAST');
        attachY += 98;
      } catch (err) {
        console.warn('Gagal memuat gambar lampiran nota dinas:', err);
      }
    }
  }

  return doc;
}

export function downloadNotaDinasPdf(
  notaDinas: NotaDinasItem,
  userProfile?: NotaDinasUserProfile,
  buktiDukungImages?: string[]
): void {
  const doc = buildNotaDinasPdf(notaDinas, userProfile, buktiDukungImages);
  const cleanNomor = (notaDinas.nomor || 'Nota_Dinas').replace(/[\\/:*?"<>|\s]/g, '_');
  const fileName = `Nota_Dinas_${cleanNomor}.pdf`;
  doc.save(fileName);
}
