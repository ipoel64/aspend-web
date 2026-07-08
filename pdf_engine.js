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
        kopTitle: { fontSize: 12, bold: true, alignment: 'center' },
        kopAddress: { fontSize: 9, alignment: 'center' },
        header: {
          fontSize: 12,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 5]
        },
        subHeader: {
          fontSize: 11,
          bold: true,
          margin: [0, 15, 0, 5],
          pageBreakBefore: function(currentNode, followingNodesOnPage) {
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
    // Kop Surat dengan Logo Kemensos (2 Kolom)
    docDefinition.content.push({
      columns: [
        {
          image: typeof KEMENSOS_LOGO_BASE64 !== 'undefined' ? KEMENSOS_LOGO_BASE64 : '',
          width: 55,
          margin: [0, 0, 0, 0]
        },
        {
          width: '*',
          text: [
            { text: 'KEMENTERIAN SOSIAL REPUBLIK INDONESIA\n', style: 'kopTitle' },
            { text: 'DIREKTORAT JENDERAL PERLINDUNGAN DAN JAMINAN SOSIAL\n', style: 'kopTitle' },
            { text: 'DIREKTORAT PERLINDUNGAN SOSIAL NON KEBENCANAAN\n', style: 'kopTitle' },
            { text: 'Jln. Salemba Raya No. 28 Jakarta Pusat 10430 Telp. (021) 3103591 http://www.kemsos.go.id', style: 'kopAddress' }
          ],
          margin: [0, 5, 55, 0] // Geser ke kiri sedikit agar penempatan seimbang di tengah halaman
        }
      ],
      margin: [0, 0, 0, 5]
    });
    
    // Garis Bawah Kop Surat
    docDefinition.content.push({
      canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2 }],
      margin: [0, 0, 0, 20]
    });
    
    // Judul Laporan
    let rhkTitle = (report.JenisRHK && report.JenisRHK.includes('RHK-')) 
      ? report.JenisRHK.match(/RHK-\d+/)?.[0] || 'RHK'
      : 'RHK';
      
    let jenisKegiatanText = report.JenisRHK ? report.JenisRHK.replace(/\[RHK-\d+\]\s*/g, '') : '-';
    
    // Dapatkan bulan dan tahun dari Tanggal
    let dateObj = new Date(report.Tanggal);
    let bulanArr = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    let periodeStr = !isNaN(dateObj.getTime()) ? `${bulanArr[dateObj.getMonth()]} ${dateObj.getFullYear()}` : '-';

    docDefinition.content.push({ text: `LAPORAN RENCANA HASIL KERJA (${rhkTitle})`, style: 'header' });
    docDefinition.content.push({ text: jenisKegiatanText, alignment: 'center', fontSize: 10, italics: true });
    docDefinition.content.push({ text: `(Periode: ${periodeStr})`, alignment: 'center', fontSize: 10, margin: [0, 0, 0, 25] });

    // Informasi Dasar
    docDefinition.content.push({
      table: {
        widths: [80, 'auto', '*'],
        body: [
          ['Rencana Aksi', ':', report.RencanaAksi || '-'],
          ['Waktu', ':', report.Tanggal + (report.Jam ? `, Pukul ${report.Jam}` : '')]
        ]
      },
      layout: 'noBorders',
      margin: [30, 0, 0, 25]
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
    // Format Tanggal (e.g. 7 Juli 2026)
    let signDate = new Date(report.Tanggal);
    let signDateStr = !isNaN(signDate.getTime()) 
       ? `${signDate.getDate()} ${bulanArr[signDate.getMonth()]} ${signDate.getFullYear()}` 
       : report.Tanggal;

    docDefinition.content.push({
      columns: [
        { width: '*', text: '' }, // Spacer kiri
        {
          width: 250,
          alignment: 'center',
          margin: [0, 40, 0, 0],
          stack: [
            { text: `Binjai, ${signDateStr}` },
            { text: 'Penata Layanan Operasional' },
            signatureBase64 ? { image: signatureBase64, width: 120, margin: [0, 10, 0, 10] } : { text: '\n\n\n( Belum Ada Tanda Tangan )\n\n' },
            { text: userProfile.nama || userProfile.email, bold: true, decoration: 'underline' },
            { text: 'NIP. 199009272025211060' } // Ditambahkan langsung dari template mobile
          ]
        }
      ]
    });

    // 3.5 Ambil Foto Dokumentasi (Jika Ada)
    if (report.FotoList && report.FotoList.length > 0) {
      docDefinition.content.push({
        text: 'LAMPIRAN DOKUMENTASI',
        style: 'header',
        pageBreak: 'before',
        margin: [0, 20, 0, 20]
      });

      const token = localStorage.getItem('google_access_token');
      for (let foto of report.FotoList) {
        if (foto.url) {
          // Ekstrak File ID dari URL Google Drive
          const match = foto.url.match(/id=([a-zA-Z0-9_-]+)/);
          if (match) {
            const fileId = match[1];
            try {
              let fetchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (fetchRes.ok) {
                let blob = await fetchRes.blob();
                let base64 = await new Promise((resolve) => {
                  let reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                
                docDefinition.content.push({
                  image: base64,
                  width: 400,
                  alignment: 'center',
                  margin: [0, 0, 0, 20]
                });
              }
            } catch (err) {
              console.error("Gagal mengunduh foto untuk PDF:", err);
            }
          }
        }
      }
    }

    // 4. Unduh PDF atau Kembalikan Data
    const filename = `Laporan_RHK_${report.Tanggal}.pdf`;
    
    if (action === 'dataUrl') {
      return new Promise((resolve) => {
        pdfMake.createPdf(docDefinition).getBlob((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          resolve(blobUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH');
        });
      });
    } else if (action === 'blob') {
      return new Promise((resolve) => {
        pdfMake.createPdf(docDefinition).getBlob((blob) => {
          resolve(blob);
        });
      });
    } else {
      pdfMake.createPdf(docDefinition).download(filename);
      hideLoading();
      showToast('PDF berhasil diunduh ke perangkat Anda!', 'success');
    }

  } catch (err) {
    hideLoading();
    console.error(err);
    showToast('Gagal menyusun PDF: ' + err.message, 'error');
  }
}
