import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { KpmFullData } from './kpm-sheets';
import { LOGO_KEMENSOS_BASE64, LOGO_PKH_BASE64 } from './kpm-logos';

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function formatTanggalIndonesia(dateStr?: string): string {
  if (!dateStr) return '—';
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
  const day = String(d.getDate()).padStart(2, '0');
  const bln = NAMA_BULAN[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${bln} ${year}`;
}

export function formatTanggalWaktuIndonesia(date: Date = new Date()): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const monthName = NAMA_BULAN[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dayName}, ${day} ${monthName} ${year} • Pukul ${hours}:${minutes} WIB`;
}

/**
 * Fetch image as Base64 Data URL for embedding into jsPDF
 */
async function fetchImageAsBase64(fileId?: string): Promise<string | null> {
  if (!fileId || typeof fileId !== 'string' || !fileId.trim()) return null;
  const cleanId = fileId.trim();
  if (cleanId.startsWith('data:image/')) return cleanId;
  if (typeof window === 'undefined') return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(`/api/image-proxy?id=${encodeURIComponent(cleanId)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
          resolve(reader.result);
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Gagal memuat foto PDF id:', cleanId, err);
    return null;
  }
}

/**
 * Generate formal PDF document of KPM Full Profile (Complete with photos, anggota, and audit metadata)
 */
export async function generateKpmFullProfilePdf(data: KpmFullData, pendampingName?: string): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const marginX = 14;
  const usableWidth = pageWidth - marginX * 2; // 182mm

  const keluarga = data.keluarga;
  const anggotaList = (data.anggota && data.anggota.length > 0)
    ? data.anggota
    : ((data.keluarga as any)?.AnggotaList || []);
  const aset = data.aset;
  const graduasi = data.graduasi;
  const masalahList = data.permasalahan || [];

  // Ambil seluruh foto dokumen & fisik rumah KPM secara paralel
  const fotoRumahLuarId = keluarga?.FotoRumah || aset?.FotoRumahLuar || keluarga?.FotoRumahLuar;
  const fotoRumahDalamId = aset?.FotoRumahDalam || keluarga?.FotoRumahDalam;
  const fotoKtpId = keluarga?.FotoKTP;
  const fotoKkId = keluarga?.FotoKK;
  const fotoTabunganId = keluarga?.FotoBukuTabungan;
  const fotoKksId = keluarga?.FotoKKS;
  const fotoUsahaId = aset?.FotoUsaha;
  const fotoBuktiCatatanId = keluarga?.FotoBuktiCatatan;

  const [
    imgRumahLuar,
    imgRumahDalam,
    imgKtp,
    imgKk,
    imgTabungan,
    imgKks,
    imgUsaha,
    imgBuktiCatatan,
  ] = await Promise.all([
    fetchImageAsBase64(fotoRumahLuarId),
    fetchImageAsBase64(fotoRumahDalamId),
    fetchImageAsBase64(fotoKtpId),
    fetchImageAsBase64(fotoKkId),
    fetchImageAsBase64(fotoTabunganId),
    fetchImageAsBase64(fotoKksId),
    fetchImageAsBase64(fotoUsahaId),
    fetchImageAsBase64(fotoBuktiCatatanId),
  ]);

  let temuanList: string[] = [];
  try {
    temuanList = JSON.parse(keluarga?.CatatanTemuan || '[]');
  } catch {
    temuanList = [];
  }

  // 1. KOP SURAT RESMI KEMENSOS & PKH
  try {
    if (LOGO_KEMENSOS_BASE64) {
      doc.addImage(LOGO_KEMENSOS_BASE64, 'PNG', marginX, 10, 20, 20);
    }
  } catch (e) {
    console.warn('Logo kemensos pdf error:', e);
  }

  try {
    if (LOGO_PKH_BASE64) {
      doc.addImage(LOGO_PKH_BASE64, 'PNG', pageWidth - marginX - 22, 10, 22, 20);
    }
  } catch (e) {
    console.warn('Logo pkh pdf error:', e);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', pageWidth / 2, 14, { align: 'center' });

  doc.setFontSize(9);
  doc.text('DIREKTORAT JAMINAN SOSIAL KELUARGA', pageWidth / 2, 18.5, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(0, 91, 148);
  doc.text('PROFIL KELUARGA PENERIMA MANFAAT (KPM) PKH', pageWidth / 2, 23.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const lokasiStr = [
    keluarga?.Kelurahan ? `Desa/Kel. ${keluarga.Kelurahan}` : '',
    keluarga?.Kecamatan ? `Kec. ${keluarga.Kecamatan}` : '',
    keluarga?.KabKota || '',
    keluarga?.Provinsi || '',
  ].filter(Boolean).join(', ');
  doc.text(lokasiStr || 'Sistem Informasi Pendampingan Sosial ASPEND PKH', pageWidth / 2, 28, { align: 'center' });

  // Garis Pembatas Kop Surat
  doc.setDrawColor(0, 91, 148);
  doc.setLineWidth(0.8);
  doc.line(marginX, 32, pageWidth - marginX, 32);
  doc.setDrawColor(180, 200, 220);
  doc.setLineWidth(0.3);
  doc.line(marginX, 33, pageWidth - marginX, 33);

  let currentY = 38;

  // Helper Section Header
  const renderSectionHeader = (title: string, badge?: string) => {
    // Check page break
    if (currentY > 260) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFillColor(240, 246, 252);
    doc.roundedRect(marginX, currentY, usableWidth, 6.5, 1, 1, 'F');
    doc.setDrawColor(0, 91, 148);
    doc.setLineWidth(0.4);
    doc.line(marginX, currentY, marginX, currentY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 75, 125);
    doc.text(title, marginX + 3, currentY + 4.5);

    if (badge) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 118, 110);
      doc.text(badge, pageWidth - marginX - 3, currentY + 4.5, { align: 'right' });
    }

    currentY += 8.5;
  };

  // Helper Info Row Table
  const renderKeyValueGrid = (items: Array<{ label: string; value: string }>) => {
    const colWidth = usableWidth / 2;
    doc.setFontSize(8);

    for (let i = 0; i < items.length; i += 2) {
      if (currentY > 275) {
        doc.addPage();
        currentY = 16;
      }

      const item1 = items[i];
      const item2 = items[i + 1];

      // Left column
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${item1.label}:`, marginX + 2, currentY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      const val1 = item1.value || '—';
      doc.text(val1, marginX + 36, currentY);

      // Right column (if exists)
      if (item2) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`${item2.label}:`, marginX + colWidth + 2, currentY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        const val2 = item2.value || '—';
        doc.text(val2, marginX + colWidth + 36, currentY);
      }

      currentY += 4.5;
    }
    currentY += 2;
  };

  // ==========================================
  // 1. IDENTITAS KELUARGA & PENGURUS
  // ==========================================
  renderSectionHeader('A. IDENTITAS KELUARGA & PENGURUS KPM', `Status: ${keluarga?.StatusKepesertaan || 'Aktif'}`);

  renderKeyValueGrid([
    { label: 'Nama Pengurus', value: keluarga?.NamaPengurus || '' },
    { label: 'Kelompok PKH', value: keluarga?.Kelompok || '—' },
    { label: 'NIK Pengurus', value: keluarga?.NIK || '' },
    { label: 'Peran Kelompok', value: keluarga?.StatusKelompok || 'Anggota' },
    { label: 'No. Kartu Keluarga', value: keluarga?.NoKK || '' },
    { label: 'No. HP / WA', value: keluarga?.NoHP || '—' },
    { label: 'Alamat Rumah', value: keluarga?.Alamat || '—' },
    { label: 'Lingkungan/Dusun', value: keluarga?.Lingkungan || '—' },
    { label: 'Desa / Kelurahan', value: keluarga?.Kelurahan || '—' },
    { label: 'Kecamatan', value: keluarga?.Kecamatan || '—' },
    { label: 'Kabupaten / Kota', value: keluarga?.KabKota || '—' },
    { label: 'Provinsi', value: keluarga?.Provinsi || '—' },
    { label: 'Tahap Penyaluran', value: keluarga?.TahapBansos || 'Tahap 1 (2026)' },
    { label: 'Kelengkapan Data', value: keluarga?.StatusData || 'Lengkap' },
  ]);

  if (keluarga?.Pernyataan) {
    if (currentY > 270) {
      doc.addPage();
      currentY = 16;
    }
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(marginX, currentY, usableWidth, 9, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(146, 64, 14);
    doc.text('Pernyataan Resmi:', marginX + 2, currentY + 3.8);
    doc.setFont('helvetica', 'normal');
    const splittedPernyataan = doc.splitTextToSize(`"${keluarga.Pernyataan}"`, usableWidth - 28);
    doc.text(splittedPernyataan, marginX + 26, currentY + 3.8);
    currentY += 12;
  }

  // ==========================================
  // 2. DAFTAR ANGGOTA KELUARGA
  // ==========================================
  renderSectionHeader(`B. DAFTAR ANGGOTA KELUARGA (${anggotaList.length} JIWA TERDAFTAR)`);

  if (anggotaList.length > 0) {
    const tableBody = anggotaList.map((m: any, idx: number) => [
      String(idx + 1),
      m.Nama || '—',
      m.NIK || '—',
      m.JenisKelamin ? (m.JenisKelamin.startsWith('L') ? 'L' : 'P') : '—',
      m.HubunganKeluarga || '—',
      m.Komponen || '—',
      m.Sekolah ? `${m.Sekolah}${m.Kelas ? ` (Kls ${m.Kelas})` : ''}` : (m.Posyandu || '—'),
      m.Pekerjaan || '—',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['No', 'Nama Anggota', 'NIK', 'JK', 'Hubungan', 'Komponen', 'Fasilitas (Sekolah/Posyandu)', 'Pekerjaan']],
      body: tableBody,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      headStyles: {
        fillColor: [0, 91, 148],
        textColor: 255,
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [30, 41, 59],
        cellPadding: 1.5,
      },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 35, fontStyle: 'bold' },
        2: { cellWidth: 26, font: 'courier' },
        3: { cellWidth: 8, halign: 'center' },
        4: { cellWidth: 22 },
        5: { cellWidth: 24, fontStyle: 'bold' },
        6: { cellWidth: 38 },
        7: { cellWidth: 22 },
      },
      didDrawPage: (hookData) => {
        currentY = hookData.cursor?.y ? hookData.cursor.y + 4 : currentY;
      },
    });

    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 4;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Belum ada data anggota keluarga yang tercatat.', marginX + 3, currentY);
    currentY += 6;
  }

  // ==========================================
  // 3. KONDISI TEMPAT TINGGAL & ASET
  // ==========================================
  renderSectionHeader('C. KONDISI TEMPAT TINGGAL, USAHA & ASET KELUARGA');

  renderKeyValueGrid([
    { label: 'Status Kepemilikan Rumah', value: aset?.StatusRumah || '—' },
    { label: 'Kepemilikan Usaha', value: aset?.Usaha || 'Tidak Memiliki Usaha' },
    { label: 'Jenis Usaha', value: aset?.JenisUsaha || '—' },
    { label: 'Tahun Pertama Bansos', value: aset?.TahunMenerimaBansos || '—' },
    { label: 'Titik Lokasi (Latitude)', value: aset?.Latitude || '—' },
    { label: 'Titik Lokasi (Longitude)', value: aset?.Longitude || '—' },
    { label: 'Kondisi Fisik Rumah', value: aset?.Keterangan || '—' },
    { label: 'Terdaftar Sejak', value: formatTanggalIndonesia(aset?.CreatedAt) },
  ]);

  // ==========================================
  // 4. GRADUASI & PPSE
  // ==========================================
  if (graduasi || keluarga?.StatusGraduasi) {
    renderSectionHeader('D. STATUS GRADUASI & KEMANDIRIAN (PPSE)');
    renderKeyValueGrid([
      { label: 'Status Graduasi', value: graduasi?.StatusGraduasi || keluarga?.StatusGraduasi || 'Belum Graduasi' },
      { label: 'Tanggal Graduasi', value: formatTanggalIndonesia(graduasi?.TanggalGraduasi) },
      { label: 'Alasan Graduasi', value: graduasi?.AlasanGraduasi || '—' },
      { label: 'Status PPSE Kemensos', value: graduasi?.StatusPPSE || 'Belum PPSE' },
      { label: 'Penghasilan / Bulan', value: graduasi?.PenghasilanPerBulan || '—' },
      { label: 'Catatan Graduasi', value: graduasi?.Catatan || '—' },
    ]);
  }

  // ==========================================
  // 5. CATATAN TEMUAN LAPANGAN & PERMASALAHAN
  // ==========================================
  if (temuanList.length > 0 || masalahList.length > 0) {
    renderSectionHeader('E. CATATAN TEMUAN & PERMASALAHAN LAPANGAN');

    if (temuanList.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9);
      doc.text('Temuan Lapangan:', marginX + 2, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(temuanList.join(' • '), marginX + 32, currentY);
      currentY += 4.5;
    }

    if (masalahList.length > 0) {
      const masalahBody = masalahList.map((m, i) => [
        String(i + 1),
        m.JenisMasalah || '—',
        m.Deskripsi || '—',
        m.Prioritas || 'Sedang',
        m.Status || 'Terbuka',
        m.TindakLanjut || '—',
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['No', 'Jenis Permasalahan', 'Deskripsi Temuan', 'Prioritas', 'Status', 'Tindak Lanjut']],
        body: masalahBody,
        margin: { left: marginX, right: marginX },
        theme: 'grid',
        headStyles: {
          fillColor: [180, 83, 9],
          textColor: 255,
          fontSize: 7,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 1.5,
        },
        columnStyles: {
          0: { cellWidth: 7, halign: 'center' },
          1: { cellWidth: 30, fontStyle: 'bold' },
          2: { cellWidth: 55 },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 16, halign: 'center' },
          5: { cellWidth: 58 },
        },
      });
      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 4;
    }
  }

  // ==========================================
  // 6. DOKUMENTASI FOTO BERKAS & RUMAH KPM
  // ==========================================
  interface PhotoDocItem {
    label: string;
    kategori: string;
    base64: string;
  }

  const photosToRender: PhotoDocItem[] = [];
  if (imgRumahLuar) photosToRender.push({ label: 'Foto Fisik Rumah (Tampak Luar)', kategori: 'Kondisi Rumah', base64: imgRumahLuar });
  if (imgRumahDalam) photosToRender.push({ label: 'Foto Fisik Rumah (Tampak Dalam)', kategori: 'Kondisi Rumah', base64: imgRumahDalam });
  if (imgKtp) photosToRender.push({ label: 'Foto KTP Pengurus KPM', kategori: 'Dokumen Identitas', base64: imgKtp });
  if (imgKk) photosToRender.push({ label: 'Foto Kartu Keluarga (KK)', kategori: 'Dokumen Identitas', base64: imgKk });
  if (imgKks) photosToRender.push({ label: 'Foto Kartu KKS Bansos', kategori: 'Dokumen Bansos', base64: imgKks });
  if (imgTabungan) photosToRender.push({ label: 'Foto Buku Tabungan Bansos', kategori: 'Dokumen Rekening', base64: imgTabungan });
  if (imgUsaha) photosToRender.push({ label: 'Foto Sarana / Tempat Usaha', kategori: 'Aset Ekonomi', base64: imgUsaha });
  if (imgBuktiCatatan) photosToRender.push({ label: 'Foto Bukti Temuan Lapangan', kategori: 'Catatan Khusus', base64: imgBuktiCatatan });

  renderSectionHeader(`F. DOKUMENTASI FOTO BERKAS & FISIK RUMAH KPM (${photosToRender.length} FOTO TERSEDIA)`);

  if (photosToRender.length > 0) {
    const colCount = 2;
    const cardGap = 4;
    const cardW = (usableWidth - cardGap) / colCount; // ~89mm
    const cardH = 55; // card height
    const imgH = 44;  // image height
    const imgW = cardW - 4; // image width

    for (let i = 0; i < photosToRender.length; i += colCount) {
      if (currentY + cardH + 4 > 275) {
        doc.addPage();
        currentY = 16;
      }

      const p1 = photosToRender[i];
      const p2 = photosToRender[i + 1];

      // Card 1
      const x1 = marginX;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x1, currentY, cardW, cardH, 1.5, 1.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(x1, currentY, cardW, cardH, 1.5, 1.5, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(p1.label, x1 + 2.5, currentY + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(p1.kategori, x1 + cardW - 2.5, currentY + 4.5, { align: 'right' });

      try {
        const format1 = p1.base64.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(p1.base64, format1, x1 + 2, currentY + 6.5, imgW, imgH, undefined, 'FAST');
      } catch (e) {
        console.warn('Gagal menambahkan foto 1 ke pdf:', e);
      }

      // Card 2
      if (p2) {
        const x2 = marginX + cardW + cardGap;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x2, currentY, cardW, cardH, 1.5, 1.5, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(x2, currentY, cardW, cardH, 1.5, 1.5, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        doc.text(p2.label, x2 + 2.5, currentY + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(p2.kategori, x2 + cardW - 2.5, currentY + 4.5, { align: 'right' });

        try {
          const format2 = p2.base64.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(p2.base64, format2, x2 + 2, currentY + 6.5, imgW, imgH, undefined, 'FAST');
        } catch (e) {
          console.warn('Gagal menambahkan foto 2 ke pdf:', e);
        }
      }

      currentY += cardH + cardGap;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Belum ada berkas foto yang diunggah untuk profil KPM ini.', marginX + 3, currentY);
    currentY += 6;
  }

  // =========================================================================
  // 7. INFORMASI PENDAMPING SOSIAL & WAKTU UNDUH DATA (PENGGANTI TANDA TANGAN)
  // =========================================================================
  if (currentY + 26 > 275) {
    doc.addPage();
    currentY = 16;
  } else {
    currentY += 4;
  }

  const downloadTime = formatTanggalWaktuIndonesia(new Date());
  const wilayahStr = [
    keluarga?.Kelurahan ? `Kel. ${keluarga.Kelurahan}` : '',
    keluarga?.Kecamatan ? `Kec. ${keluarga.Kecamatan}` : '',
    keluarga?.KabKota || '',
  ].filter(Boolean).join(', ') || 'Wilayah PKH';

  // Box Informasi Validitas & Waktu Unduh
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, currentY, usableWidth, 21, 1.5, 1.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, currentY, usableWidth, 21, 1.5, 1.5, 'S');

  // Aksen Biru di Sisi Kiri
  doc.setFillColor(0, 91, 148);
  doc.rect(marginX, currentY, 2, 21, 'F');

  // Judul Blok
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 91, 148);
  doc.text('INFORMASI PENDAMPING SOSIAL & WAKTU UNDUH DATA', marginX + 4.5, currentY + 5);

  // Baris 1: Pendamping Sosial & Wilayah Dampingan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Pendamping Sosial PKH:', marginX + 4.5, currentY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(pendampingName || 'Pendamping Sosial PKH', marginX + 38, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Wilayah Dampingan:', marginX + 96, currentY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(wilayahStr, marginX + 125, currentY + 10);

  // Baris 2: Waktu Unduh Data
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Waktu Unduh Data:', marginX + 4.5, currentY + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text(downloadTime, marginX + 38, currentY + 15);

  // Catatan Sistem di Bawah
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Dokumen ini dicetak otomatis secara elektronik melalui Sistem Informasi ASPEND Web PKH Kementerian Sosial RI.',
    marginX + 4.5,
    currentY + 19.5
  );

  currentY += 25;

  // Footer di setiap halaman
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Dokumen Profil Resmi KPM PKH • Dicetak otomatis melalui ASPEND Web PKH Kementerian Sosial RI • Halaman ${p} dari ${totalPages}`,
      pageWidth / 2,
      292,
      { align: 'center' }
    );
  }

  return doc;
}
