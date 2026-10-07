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

/**
 * Generate formal PDF document of KPM Full Profile
 */
export function generateKpmFullProfilePdf(data: KpmFullData, pendampingName?: string): jsPDF {
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
  const anggotaList = data.anggota || [];
  const aset = data.aset;
  const graduasi = data.graduasi;
  const masalahList = data.permasalahan || [];

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
    const tableBody = anggotaList.map((m, idx) => [
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
  // 6. LEMBAR PENGESAHAN / TANDA TANGAN
  // ==========================================
  if (currentY > 240) {
    doc.addPage();
    currentY = 20;
  } else {
    currentY += 6;
  }

  const today = formatTanggalIndonesia(new Date().toISOString().split('T')[0]);
  const kotaName = keluarga?.KabKota || 'Wilayah Dampingan';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  // Tanggal di kanan atas blok tanda tangan
  doc.text(`${kotaName}, ${today}`, pageWidth - marginX - 5, currentY, { align: 'right' });
  currentY += 6;

  const colWidth = usableWidth / 2;

  // Kiri: Pengurus KPM
  doc.setFont('helvetica', 'bold');
  doc.text('Pengurus KPM PKH,', marginX + colWidth / 2, currentY, { align: 'center' });

  // Kanan: Pendamping Sosial PKH
  doc.text('Pendamping Sosial PKH,', marginX + colWidth + colWidth / 2, currentY, { align: 'center' });

  currentY += 18;

  // Nama Pengurus
  doc.text(keluarga?.NamaPengurus || '( ........................................ )', marginX + colWidth / 2, currentY, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`NIK: ${keluarga?.NIK || '—'}`, marginX + colWidth / 2, currentY + 3.5, { align: 'center' });

  // Nama Pendamping
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(pendampingName || '( ........................................ )', marginX + colWidth + colWidth / 2, currentY, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Pendamping Sosial Wilayah', marginX + colWidth + colWidth / 2, currentY + 3.5, { align: 'center' });

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
