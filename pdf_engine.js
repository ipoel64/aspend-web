/**
 * ASPEND PDF Engine v2 (Powered by pdfmake)
 * Membangun PDF sepenuhnya di sisi klien (browser) tanpa server.
 * 
 * Direplika dari kode mobile: pdf_service.dart → createReportPdf()
 * 
 * Field mapping dari Google Sheets (via client_services.js):
 *   row[0]  → ReportId
 *   row[1]  → Tanggal
 *   row[2]  → JenisRHK
 *   row[3]  → IdRHK
 *   row[4]  → RencanaAksi
 *   row[5]  → Pukul          ← BUKAN "Jam"!
 *   row[6]  → PoinKegiatan   ← BUKAN "Uraian"!
 *   row[7]  → NarasiAI       ← Teks narasi dari AI
 *   row[8]  → NarasiEdited   ← Teks narasi yang sudah diedit user
 *   row[9]  → Status
 *   row[10] → PdfFileId
 *   row[11] → FotoIds
 *   row[12] → P2K2Data (JSON)
 *   row[13] → Lokasi
 *   row[14] → CreatedAt
 */

// Helper: Indonesian month names
const BULAN_INDO = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function safeParseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function formatPeriode(dateStr) {
  const d = safeParseDate(dateStr);
  if (!d) return '-';
  return `${BULAN_INDO[d.getMonth()]} ${d.getFullYear()}`;
}

function formatWaktu(dateStr, pukulStr) {
  const d = safeParseDate(dateStr);
  if (!d) return dateStr + (pukulStr ? `, Pukul ${pukulStr}` : '');
  const dayName = HARI_INDO[d.getDay()];
  const monthName = BULAN_INDO[d.getMonth()];
  let timeStr = '';
  if (pukulStr && pukulStr !== '-' && pukulStr.trim()) {
    timeStr = `, Pukul ${pukulStr}`;
  }
  return `${dayName}, ${d.getDate()} ${monthName} ${d.getFullYear()}${timeStr}`;
}

function formatSignDate(dateStr) {
  const d = safeParseDate(dateStr);
  if (!d) return dateStr;
  return `${d.getDate()} ${BULAN_INDO[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Parse bold markers (**text**) in a string and return pdfmake text array.
 * Mirip dengan parseNarrativeSpans() di mobile.
 */
function parseNarrativeSpans(text) {
  const parts = text.split('**');
  const result = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '') continue;
    if (i % 2 === 1) {
      result.push({ text: parts[i], bold: true });
    } else {
      result.push({ text: parts[i] });
    }
  }
  return result;
}

/**
 * Build narrative widgets (pdfmake content array) from narrative text.
 * Mirip dengan buildNarrativeWidgets() di mobile pdf_service.dart.
 * 
 * Supports:
 *   A. PENDAHULUAN        → Sub-headers (bold)
 *   1. Gambaran Umum      → Numbered list items
 *   - Bullet point        → Bullet list items
 *   Regular paragraph     → Indented text with justify alignment
 */
function buildNarrativeWidgets(text, p2k2Data) {
  const widgets = [];
  if (!text || text.trim() === '') {
    widgets.push({ text: '(Narasi belum tersedia)', italics: true, color: '#888888', margin: [0, 10, 0, 10] });
    return widgets;
  }

  // Normalkan newlines: literal \n string dari database
  let normalizedText = text;
  if (typeof normalizedText === 'string') {
    normalizedText = normalizedText.replace(/\\n/g, '\n');
  }

  const lines = normalizedText.split('\n');
  let hasAddedP2K2Table = false;
  let inListItem = false;
  let pendingHeaders = [];

  // Regex patterns (mirip mobile)
  const subHeaderRegExp = /^(?:\*\*)?([A-Z]\.)\s+(.*?)(?:\*\*)?$/;
  const pointRegExp = /^(\d+)\.\s+(.*)/;
  const bulletRegExp = /^[-*•]\s+(.*)/;

  function flushPendingHeaders() {
    if (pendingHeaders.length > 0) {
      widgets.push(...pendingHeaders);
      pendingHeaders = [];
    }
  }

  // P2K2 Table builder
  function buildP2K2Table(p2k2) {
    return {
      table: {
        widths: [120, '*'],
        body: [
          [
            { text: 'Keterangan P2K2', bold: true, fontSize: 9.5, fillColor: '#f0f0f0', margin: [5, 5, 5, 5] },
            { text: 'Detail', bold: true, fontSize: 9.5, fillColor: '#f0f0f0', margin: [5, 5, 5, 5] }
          ],
          [
            { text: 'Modul', fontSize: 9.5, margin: [5, 5, 5, 5] },
            { text: p2k2.modul || '-', fontSize: 9.5, margin: [5, 5, 5, 5] }
          ],
          [
            { text: 'Sesi', fontSize: 9.5, margin: [5, 5, 5, 5] },
            { text: p2k2.sesi || '-', fontSize: 9.5, margin: [5, 5, 5, 5] }
          ],
          [
            { text: 'Nama Kelompok', fontSize: 9.5, margin: [5, 5, 5, 5] },
            { text: p2k2.namaKelompok || '-', fontSize: 9.5, margin: [5, 5, 5, 5] }
          ],
          [
            { text: 'Ketua Kelompok', fontSize: 9.5, margin: [5, 5, 5, 5] },
            { text: p2k2.ketuaKelompok || '-', fontSize: 9.5, margin: [5, 5, 5, 5] }
          ],
          [
            { text: 'Kehadiran', fontSize: 9.5, margin: [5, 5, 5, 5] },
            { text: `${p2k2.jumlahHadir || 0} hadir dari total ${p2k2.jumlahKPM || 0} KPM`, fontSize: 9.5, margin: [5, 5, 5, 5] }
          ]
        ]
      },
      margin: [0, 10, 0, 15]
    };
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (pendingHeaders.length === 0) {
        widgets.push({ text: '', margin: [0, 3, 0, 3] }); // spacer
      }
      continue;
    }

    let contentWidget = null;

    // Check sub-header (A. PENDAHULUAN, B. KEGIATAN, etc.)
    if (subHeaderRegExp.test(trimmed)) {
      const match = trimmed.match(subHeaderRegExp);
      const letter = match[1];
      const title = match[2];
      const cleanHeader = `${letter} ${title}`;

      // Insert P2K2 table before C/D/E sections if applicable
      if (/^[CDE]\./.test(cleanHeader) && !hasAddedP2K2Table && p2k2Data && p2k2Data.modul) {
        flushPendingHeaders();
        widgets.push(buildP2K2Table(p2k2Data));
        hasAddedP2K2Table = true;
      }

      pendingHeaders.push({
        text: cleanHeader,
        bold: true,
        fontSize: 11,
        margin: [0, 22, 0, 8]
      });
      continue;
    }

    // Check numbered list (1. Gambaran Umum: ...)
    if (pointRegExp.test(trimmed)) {
      inListItem = true;
      const match = trimmed.match(pointRegExp);
      const num = match[1];
      const content = match[2];

      // Try to parse "Title: Description" pattern
      const titleMatch = content.match(/^(?:\*\*(.*?)\*\*(?:\s*[:\-]?\s*)?|([^*:\-]+?)(?:\s*:\s*|\s+-\s+))(.*)/);
      
      if (titleMatch) {
        const pointTitle = (titleMatch[1] || titleMatch[2] || '').trim();
        const pointDesc = (titleMatch[3] || '').trim();
        
        if (pointTitle) {
          contentWidget = [
            {
              text: `${num}. ${pointTitle}`,
              bold: true,
              fontSize: 10.5,
              margin: [14, 0, 0, 4]
            }
          ];
          if (pointDesc) {
            contentWidget.push({
              text: [
                { text: '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0' }, // Non-breaking spaces
                ...parseNarrativeSpans(pointDesc)
              ],
              fontSize: 10.5,
              lineHeight: 1.3,
              alignment: 'justify',
              margin: [14, 0, 0, 6]
            });
          }
        } else {
          contentWidget = {
            columns: [
              { text: `${num}.`, width: 18, bold: true },
              {
                text: parseNarrativeSpans(content),
                alignment: 'justify',
                lineHeight: 1.3
              }
            ],
            fontSize: 10.5,
            margin: [14, 0, 0, 6]
          };
        }
      } else {
        contentWidget = {
          columns: [
            { text: `${num}.`, width: 18, bold: true },
            {
              text: parseNarrativeSpans(content),
              alignment: 'justify',
              lineHeight: 1.3
            }
          ],
          fontSize: 10.5,
          margin: [14, 0, 0, 6]
        };
      }
    }

    // Check bullet list (- item or * item)
    else if (bulletRegExp.test(trimmed)) {
      inListItem = true;
      const match = trimmed.match(bulletRegExp);
      const content = match[1];

      contentWidget = {
        columns: [
          { text: '•', width: 14, bold: true },
          {
            text: parseNarrativeSpans(content),
            alignment: 'justify',
            lineHeight: 1.3
          }
        ],
        fontSize: 10.5,
        margin: [28, 0, 0, 6]
      };
    }

    // Regular paragraph
    else {
      contentWidget = {
        text: [
          { text: '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0' }, // Non-breaking spaces for proper indent
          ...parseNarrativeSpans(trimmed)
        ],
        fontSize: 10.5,
        lineHeight: 1.3,
        alignment: 'justify',
        margin: [inListItem ? 28 : 0, 0, 0, 6]
      };
    }

    // If there are pending headers, group them with the first content widget
    if (pendingHeaders.length > 0 && contentWidget) {
      if (Array.isArray(contentWidget)) {
        widgets.push({
          stack: [...pendingHeaders, contentWidget[0]],
          unbreakable: true
        });
        widgets.push(...contentWidget.slice(1));
      } else {
        widgets.push({
          stack: [...pendingHeaders, contentWidget],
          unbreakable: true
        });
      }
      pendingHeaders = [];
    } else if (contentWidget) {
      if (Array.isArray(contentWidget)) {
        widgets.push(...contentWidget);
      } else {
        widgets.push(contentWidget);
      }
    }
  }

  flushPendingHeaders();

  // If P2K2 table was never added but data exists, add it at the end
  if (!hasAddedP2K2Table && p2k2Data && p2k2Data.modul) {
    widgets.push(buildP2K2Table(p2k2Data));
  }

  return widgets;
}

/**
 * Main PDF generation function.
 * Dipanggil dari script.js dengan parameter:
 *   - report: objek laporan dari Google Sheets
 *   - userProfile: objek profil user (dari state.user)
 *   - isVerkom: boolean (belum dipakai)
 *   - action: 'download' | 'dataUrl' | 'blob'
 */
async function generateClientPDF(report, userProfile, isVerkom = false, action = 'download') {
  try {
    showLoading('Menyusun PDF Laporan...');

    // === DEBUG LOG ===
    console.log('=== PDF ENGINE DEBUG ===');
    console.log('Report object keys:', Object.keys(report));
    console.log('Report.NarasiAI length:', (report.NarasiAI || '').length);
    console.log('Report.NarasiEdited length:', (report.NarasiEdited || '').length);
    console.log('Report.PoinKegiatan length:', (report.PoinKegiatan || '').length);
    console.log('Report.Pukul:', report.Pukul);
    console.log('Report.Tanggal:', report.Tanggal);
    console.log('Report.RencanaAksi:', report.RencanaAksi);
    console.log('Report.JenisRHK:', report.JenisRHK);
    console.log('Report.IdRHK:', report.IdRHK);
    console.log('Report.FotoIds:', report.FotoIds);
    console.log('Report.P2K2Data:', report.P2K2Data);
    console.log('UserProfile:', userProfile);
    console.log('NarasiAI preview:', (report.NarasiAI || '').substring(0, 200));
    console.log('NarasiEdited preview:', (report.NarasiEdited || '').substring(0, 200));
    console.log('=== END DEBUG ===');

    // 1. Persiapkan Data & Styling
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [54, 35, 54, 54], // Mirip mobile: left:54, right:54, top:35, bottom:54
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10.5,
        lineHeight: 1.2
      },
      styles: {},
      content: []
    };

    // ══════════════════════════════════════════
    // 2. KOP SURAT (Mirip mobile buildHeader)
    // ══════════════════════════════════════════
    const hasLogo = typeof KEMENSOS_LOGO_BASE64 !== 'undefined' && KEMENSOS_LOGO_BASE64;
    
    // Logo + Text Header
    docDefinition.content.push({
      columns: [
        hasLogo ? {
          image: KEMENSOS_LOGO_BASE64,
          width: 80,
          margin: [0, 0, 5, 0]
        } : {
          text: 'LOGO',
          width: 80,
          alignment: 'center',
          color: '#999999'
        },
        {
          width: '*',
          stack: [
            { text: 'KEMENTERIAN SOSIAL REPUBLIK INDONESIA', bold: true, fontSize: 14, alignment: 'center' },
            { text: 'DIREKTORAT JENDERAL PERLINDUNGAN DAN JAMINAN SOSIAL', bold: true, fontSize: 10.5, alignment: 'center' },
            { text: 'DIREKTORAT PERLINDUNGAN SOSIAL NON KEBENCANAAN', bold: true, fontSize: 10.5, alignment: 'center' },
            { text: 'Jl. Salemba Raya No. 28 Jakarta Pusat 10430 Telp. (021) 3103591 http://www.kemsos.go.id', fontSize: 7.5, alignment: 'center' }
          ],
          margin: [0, 8, 0, 0]
        }
      ],
      margin: [0, 0, 0, 3]
    });

    // Garis pembatas (Divider) - garis tebal
    docDefinition.content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 487, y2: 0, lineWidth: 2 }],
      margin: [0, 0, 0, 8]
    });

    // ══════════════════════════════════════════
    // 3. JUDUL LAPORAN (Mirip mobile buildTitle)
    // ══════════════════════════════════════════
    // Gunakan IdRHK (misalnya "RHK-2") jika ada, kalau tidak coba parse dari JenisRHK
    let rhkTitle = report.IdRHK || 'RHK';
    if (!rhkTitle.startsWith('RHK') && report.JenisRHK) {
      const rhkMatch = report.JenisRHK.match(/RHK-\d+/);
      if (rhkMatch) rhkTitle = rhkMatch[0];
    }

    // jenisRHK text = teks deskriptif (misal: "Terlaksananya pertemuan P2K2 sesuai dengan ketentuan")
    let jenisKegiatanText = report.JenisRHK || '';
    // Hapus prefix [RHK-2] jika ada
    jenisKegiatanText = jenisKegiatanText.replace(/\[?RHK-\d+\]?\s*/g, '').trim();

    const periodeStr = formatPeriode(report.Tanggal);
    const waktuStr = formatWaktu(report.Tanggal, report.Pukul);

    docDefinition.content.push({
      text: `LAPORAN RENCANA HASIL KERJA (${rhkTitle})`,
      bold: true,
      fontSize: 13,
      alignment: 'center',
      margin: [0, 0, 0, 2]
    });

    if (jenisKegiatanText) {
      docDefinition.content.push({
        text: jenisKegiatanText,
        fontSize: 11,
        italics: true,
        alignment: 'center',
        margin: [0, 0, 0, 2]
      });
    }

    if (periodeStr !== '-') {
      docDefinition.content.push({
        text: `(Periode: ${periodeStr})`,
        fontSize: 11,
        alignment: 'center',
        margin: [0, 0, 0, 15]
      });
    }

    // Informasi Dasar (Rencana Aksi & Waktu) - mirip mobile Table
    docDefinition.content.push({
      table: {
        widths: [80, 10, '*'],
        body: [
          [
            { text: 'Rencana Aksi', italics: true, fontSize: 10.5 },
            { text: ':', fontSize: 10.5 },
            { text: report.RencanaAksi || '-', fontSize: 10.5 }
          ],
          [
            { text: 'Waktu', italics: true, fontSize: 10.5 },
            { text: ':', fontSize: 10.5 },
            { text: waktuStr, fontSize: 10.5 }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 15]
    });

    // ══════════════════════════════════════════
    // 4. NARASI / ISI LAPORAN
    // ══════════════════════════════════════════
    // Prioritas: NarasiEdited → NarasiAI → PoinKegiatan (fallback terakhir)
    // Mirip mobile: report.narasiEdited.isNotEmpty ? report.narasiEdited : report.narasiAI
    let narrativeText = '';
    if (report.NarasiEdited && report.NarasiEdited.trim()) {
      narrativeText = report.NarasiEdited;
      console.log('PDF using: NarasiEdited');
    } else if (report.NarasiAI && report.NarasiAI.trim()) {
      narrativeText = report.NarasiAI;
      console.log('PDF using: NarasiAI');
    } else if (report.PoinKegiatan && report.PoinKegiatan.trim()) {
      narrativeText = report.PoinKegiatan;
      console.log('PDF using: PoinKegiatan (fallback)');
    } else {
      console.warn('PDF WARNING: No narrative text found in any field!');
    }

    const narrativeWidgets = buildNarrativeWidgets(narrativeText, report.P2K2Data);
    docDefinition.content.push(...narrativeWidgets);

    // ══════════════════════════════════════════
    // 5. TANDA TANGAN (Mirip mobile Signature Block)
    // ══════════════════════════════════════════
    const signatureBase64 = localStorage.getItem('aspend_signature_base64');
    const signDateStr = formatSignDate(report.Tanggal);
    
    // Lokasi dari userProfile atau default
    const lokasiTTD = (userProfile && userProfile.kabupatenKota) 
      ? userProfile.kabupatenKota 
      : ((userProfile && userProfile.lokasi) ? userProfile.lokasi : 'Dibuat di');

    const jabatan = (userProfile && userProfile.jabatan) 
      ? userProfile.jabatan 
      : 'Pendamping Sosial';

    const namaUser = (userProfile && userProfile.nama) 
      ? userProfile.nama 
      : ((userProfile && userProfile.email) ? userProfile.email : '-');

    const nipUser = (userProfile && userProfile.nip) 
      ? `NIP. ${userProfile.nip}` 
      : '';

    const signatureStack = [
      { text: `${lokasiTTD}, ${signDateStr}`, fontSize: 10.5 },
      { text: jabatan, fontSize: 10.5, margin: [0, 4, 0, 2] },
    ];

    if (signatureBase64) {
      signatureStack.push({ image: signatureBase64, width: 135, height: 75, margin: [0, 0, 0, 0] });
    } else {
      signatureStack.push({ text: '\n\n\n( Belum Ada Tanda Tangan )\n\n', fontSize: 10, margin: [0, 0, 0, 0] });
    }

    signatureStack.push({ text: namaUser, bold: true, fontSize: 10.5, decoration: 'underline' });
    if (nipUser) {
      signatureStack.push({ text: nipUser, fontSize: 9.5 });
    }

    docDefinition.content.push({
      margin: [0, 20, 0, 0],
      columns: [
        { width: '*', text: '' },
        {
          width: 'auto',
          alignment: 'center',
          stack: signatureStack
        }
      ]
    });

    // ══════════════════════════════════════════
    // 6. LAMPIRAN DOKUMENTASI (Foto dari Google Drive)
    // ══════════════════════════════════════════
    if (report.FotoIds && report.FotoIds.length > 0) {
      console.log('PDF: Downloading', report.FotoIds.length, 'photos for documentation appendix...');
      
      const token = localStorage.getItem('google_access_token');
      const photoImages = [];

      for (const fileId of report.FotoIds) {
        if (!fileId || fileId.length < 5) continue;
        try {
          const fetchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (fetchRes.ok) {
            const blob = await fetchRes.blob();
            const base64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            photoImages.push(base64);
          } else {
            console.warn('PDF: Failed to fetch photo', fileId, fetchRes.status);
          }
        } catch (err) {
          console.error('PDF: Error downloading photo', fileId, err);
        }
      }

      if (photoImages.length > 0) {
        docDefinition.content.push({
          text: 'LAMPIRAN DOKUMENTASI',
          bold: true,
          fontSize: 13,
          alignment: 'center',
          pageBreak: 'before',
          margin: [0, 0, 0, 20]
        });

        for (const imgBase64 of photoImages) {
          docDefinition.content.push({
            image: imgBase64,
            width: 450,
            alignment: 'center',
            margin: [0, 0, 0, 20]
          });
        }
      }
    }

    // ══════════════════════════════════════════
    // 7. GENERATE & OUTPUT PDF
    // ══════════════════════════════════════════
    const filename = `Laporan_RHK_${report.Tanggal || 'draft'}.pdf`;

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
    console.error('PDF Engine Error:', err);
    showToast('Gagal menyusun PDF: ' + err.message, 'error');
    throw err;
  }
}
