import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

/**
 * Format string teks watermark resmi instansi (Kemensos/PKH)
 * Format: "(NIP)  (Nama User)  (DD-MM-YYYY)" persis seperti di Aspend Mobile
 */
export function formatWatermarkText(
  user?: { nip?: string; nama?: string } | null,
  date?: Date | string | null
): string {
  const nip = user?.nip?.trim() ? user.nip.trim() : '-';
  const nama = (user?.nama?.trim() || 'ASPEND').toUpperCase();

  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string' && date.trim()) {
    const parsed = new Date(date);
    d = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    d = new Date();
  }

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const tgl = `${dd}-${mm}-${yyyy}`;

  return `${nip}  ${nama}  ${tgl}`;
}

/**
 * Terapkan watermark diagonal halus berulang ke dokumen jsPDF (Client/Server)
 * Sudut rotasi: 26 derajat (counter-clockwise dari kiri bawah ke kanan atas)
 * Warna: Abu-abu kebiruan sangat lembut dan transparan, tidak mengganggu bacaan
 */
export function applyWatermarkToJsPdf(doc: any, watermarkText: string): void {
  if (!watermarkText || !watermarkText.trim()) return;

  try {
    const pageCount = doc.getNumberOfPages ? doc.getNumberOfPages() : doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const cleanText = watermarkText.trim();
    const repeated = `${cleanText}       ${cleanText}       ${cleanText}       ${cleanText}`;

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.saveGraphicsState();

      // Warna sangat halus dan transparan (tidak mengganggu naskah dokumen)
      doc.setTextColor(228, 232, 238);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      for (let y = -30; y <= pageHeight + 60; y += 16) {
        doc.text(repeated, -30, y, { angle: 26 });
      }

      doc.restoreGraphicsState();
    }
  } catch (err) {
    console.warn('Gagal menambahkan watermark pada jsPDF:', err);
  }
}

/**
 * Terapkan watermark diagonal halus berulang ke Buffer PDF (Server Side - pdf-lib)
 */
export async function applyWatermarkToPdfBuffer(
  pdfBuffer: any,
  watermarkText: string
): Promise<any> {
  if (!watermarkText || !watermarkText.trim()) return pdfBuffer;

  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    const cleanText = watermarkText.trim();
    const repeatedLine = `${cleanText}       ${cleanText}       ${cleanText}       ${cleanText}`;

    for (const page of pages) {
      const { width, height } = page.getSize();

      for (let y = -120; y <= height + 250; y += 46) {
        page.drawText(repeatedLine, {
          x: -80,
          y: y,
          size: 7.5,
          font: font,
          color: rgb(0.88, 0.90, 0.93), // Halus dan transparan
          opacity: 0.32,
          rotate: degrees(26), // Sudut diagonal counter-clockwise
        });
      }
    }

    const modifiedBytes = await pdfDoc.save();
    return Buffer.from(modifiedBytes.buffer, modifiedBytes.byteOffset, modifiedBytes.byteLength);
  } catch (err) {
    console.warn('Gagal menambahkan watermark pada PDF Buffer:', err);
    return pdfBuffer;
  }
}
