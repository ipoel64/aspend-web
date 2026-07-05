/**
 * ASPEND PDF Engine (Powered by pdfmake)
 * Membangun PDF sepenuhnya di sisi klien (browser) tanpa server.
 */

async function generateClientPDF(report, userProfile, isVerkom = false, action = 'download') {
  try {
    showLoading('Menyusun PDF Laporan...');

    // 1. Persiapkan Data & Styling
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [60, 60, 60, 60], // [left, top, right, bottom]
      defaultStyle: {
        font: 'Roboto',
        fontSize: 11,
        lineHeight: 1.5 // Sesuai permintaan (lineSpacing lebih longgar)
      },
      styles: {
        header: {
          fontSize: 14,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 20] // [left, top, right, bottom]
        },
        subHeader: {
          fontSize: 12,
          bold: true,
          margin: [0, 15, 0, 5],
          pageBreakBefore: function(currentNode, followingNodesOnPage) {
            // Orphan Control: Jangan biarkan sub-judul terpisah dari isi paragrafnya
            // Jika sisa ruang di halaman sangat kecil, dorong sub-judul ke halaman berikutnya
            return followingNodesOnPage.length === 0;
          }
        },
        paragraph: {
          margin: [0, 0, 0, 10],
          alignment: 'justify'
        },
        signature: {
          margin: [0, 40, 0, 0],
          alignment: 'right'
        }
      },
      content: []
    };

    // 2. Susun Konten
    docDefinition.content.push({ text: 'LAPORAN KEGIATAN PENDAMPING PKH', style: 'header' });

    // Informasi Dasar
    docDefinition.content.push({
      table: {
        widths: [120, 'auto', '*'],
        body: [
          ['Nama Pendamping', ':', userProfile.nama || userProfile.email],
          ['Tanggal Kegiatan', ':', report.Tanggal],
          ['Lokasi', ':', report.Lokasi || '-'],
          ['Jenis Kegiatan', ':', report.JenisRHK],
          ['Rencana Aksi', ':', report.RencanaAksi || '-']
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 20]
    });

    // Uraian Kegiatan (Diubah dari teks biasa ke struktur Markdown/Paragraf)
    const uraianLines = (report.Uraian || '').split('\\n');
    let isList = false;
    let currentList = [];

    uraianLines.forEach(line => {
      line = line.trim();
      if (!line) return;

      // Cek apakah baris ini adalah sub-judul (A. Pendahuluan, B. Pelaksanaan, 1. Gambaran Umum, dsb)
      const isSubHeading = /^([A-Z]\.|\\d+\.)\\s+/.test(line);

      if (isSubHeading) {
        // Masukkan list yang tertunda jika ada
        if (currentList.length > 0) {
          docDefinition.content.push({ ul: currentList, margin: [15, 0, 0, 10] }); // Menjorok ke dalam sesuai permintaan
          currentList = [];
          isList = false;
        }
        
        docDefinition.content.push({ text: line, style: 'subHeader', unbreakable: true });
      } 
      else if (line.startsWith('-') || line.startsWith('*')) {
        isList = true;
        currentList.push(line.substring(1).trim());
      } 
      else {
        if (currentList.length > 0) {
          docDefinition.content.push({ ul: currentList, margin: [15, 0, 0, 10] });
          currentList = [];
          isList = false;
        }
        
        docDefinition.content.push({ text: line, style: 'paragraph' });
      }
    });

    if (currentList.length > 0) {
      docDefinition.content.push({ ul: currentList, margin: [15, 0, 0, 10] });
    }

    // 3. Tanda Tangan
    // Kita ambil tanda tangan dari LocalStorage jika ada (fitur Canvas)
    const signatureBase64 = localStorage.getItem('aspend_signature_base64');
    
    // Formatting Tanda Tangan Proporsional
    docDefinition.content.push({
      columns: [
        { width: '*', text: '' }, // Spacer kiri
        {
          width: 200,
          alignment: 'center',
          margin: [0, 40, 0, 0],
          stack: [
            { text: 'Pendamping Sosial,' },
            signatureBase64 ? { image: signatureBase64, width: 120, margin: [0, 10, 0, 10] } : { text: '\\n\\n\\n( Belum Ada Tanda Tangan )\\n\\n' },
            { text: userProfile.nama || userProfile.email, bold: true, decoration: 'underline' }
          ]
        }
      ]
    });

    // 4. Unduh PDF
    const filename = `Laporan_RHK_${report.Tanggal}.pdf`;
    
    if (action === 'dataUrl') {
      return new Promise((resolve) => {
        pdfMake.createPdf(docDefinition).getBlob((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          resolve(blobUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH');
        });
      });
    } else {
      pdfMake.createPdf(docDefinition).download(filename);
    }


    hideLoading();
    showToast('PDF berhasil diunduh ke perangkat Anda!', 'success');

  } catch (err) {
    hideLoading();
    console.error(err);
    showToast('Gagal menyusun PDF: ' + err.message, 'error');
  }
}
