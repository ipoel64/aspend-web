# RHK-agent — Task Checklist Re-revisions (Fase 4)

## 1. Modifikasi Server-Side Controller (`Code.gs`)
- [x] Return `folderUrl` di `getUserReports` menggunakan path folder output.
- [x] Implementasikan `deleteReportLog(reportId)` untuk menghapus baris laporan dan membersihkan berkas PDF/foto terkait di Drive.
- [x] Perbarui `submitReportData` agar mendukung pembaharuan data (edit laporan) pada row yang sama dan mengatur status kembali ke Draft.

## 2. Modifikasi Layanan PDF (`PdfService.gs`)
- [x] Perbesar ukuran logo Kop Surat di `insertKopSurat` (newWidth = 85pt, logoCell = 95pt, textCell = 385pt).
- [x] Hapus pemanggilan `row.setPreventFolderSplit(true)` di `insertSignatureBlock` untuk memulihkan rendering tanda tangan.
- [x] Modifikasi `insertReportHeader` untuk menyertakan Pukul kegiatan pada baris Waktu.

## 3. Modifikasi UI HTML & JS (`Index.html` and `JavaScript.html`)
- [x] Ganti label "Lokasi Kegiatan" menjadi "Pukul Kegiatan" di `Index.html`.
- [x] Ganti placeholder textarea `#input-poin` agar memuat petunjuk pengisian lokasi di `Index.html`.
- [x] Hapus header `<th>Status</th>` pada tabel dashboard di `Index.html`.
- [x] Tambahkan `state.folderUrl` dan `state.downloadedReports` di `JavaScript.html`.
- [x] Modifikasi `loadReports` untuk menyimpan `result.folderUrl`.
- [x] Perbarui rendering tabel `renderReportsTable` di `JavaScript.html` (gabung tanggal + pukul, hilangkan kolom status, tambahkan tombol Edit & Hapus, buat tombol Buka Link aktif hanya setelah diunduh).
- [x] Implementasikan fungsi `editReport(reportId)` untuk mempopulasikan kembali data form di `JavaScript.html`.
- [x] Implementasikan fungsi `deleteReport(reportId)` untuk menghapus laporan secara interaktif di `JavaScript.html`.
- [x] Perbarui `resetForm` untuk mengembalikan tombol submit ke default di `JavaScript.html`.

## 4. Re-revisi Tambahan (Fase 5)
- [x] Perbaiki crash edit "Data laporan tidak ditemukan" dengan mengganti range kolom statis menjadi dinamis (sheet.getLastColumn) dan membuat pencarian ID kolom `ReportId` dinamis di `Code.gs` dan `GeminiService.gs`.
- [x] Perbesar kembali ukuran logo Kemensos di kop PDF menjadi 110pt dan sesuaikan lebar kolom kop.
- [x] Jajarkan logo dan teks kop secara vertikal (Vertical Alignment CENTER) dan rapatkan jarak spasi garis pembatas kop.
- [x] Buat pembacaan tanda tangan dan profil lebih aman secara dinamis.
- [x] Pastikan input "Lokasi Kegiatan" terbukti diganti menjadi "Pukul Kegiatan" jam.
- [x] Gabungkan tanggal dan jam kegiatan pada kolom Tanggal di dashboard.

## 5. Re-revisi Tambahan (Fase 6)
- [x] Hilangkan judul laporan duplikat sebelum bagian A.PENDAHULUAN dengan skip baris otomatis sebelum A. di PDF dan larangan di prompt AI.
- [x] Kurangi spasi spasial di bawah Kop dan jajarkan logo/teks Kop sejajar tengah vertikal.
- [x] Mencegah pemotongan halaman (split) pada blok tanda tangan dengan memanggil setPreventFolderSplit(true) pada objek Table.
- [x] Jelaskan penyebab tombol Edit gagal pada versi database lama pengguna dan berikan opsi jika mereka tetap ingin menghapusnya.

## 6. Re-revisi Tambahan (Fase 7)
- [x] Kurangi jarak spasi kop surat dengan garis pembatas lebih rapat lagi (Revisi 19).
- [x] Buat isi teks sub-paragraf di bawah A. PENDAHULUAN tidak bercetak tebal (hanya judul sub-paragraf yang tebal) (Revisi 19).
- [x] Kembalikan/munculkan kembali blok tanda tangan di laporan dengan menghapus pemanggilan `setPreventFolderSplit(true)` yang tidak valid (penyebab crash) dan menerapkan `row.setPreventRowSplit(true)` serta memperkecil ukuran gambar tanda tangan agar pas (Revisi 20).
- [x] Hilangkan tombol Edit (✏️) dari kolom aksi dashboard dan nonaktifkan fungsinya sesuai permintaan pengguna.
- [x] Tingkatkan integrasi AI ke multimodal (mengirimkan foto base64 ke Gemini) agar AI dapat mendeteksi, membaca, dan menganalisis data, tabel, nomor surat, atau tulisan penting dalam foto bukti dukung.
- [x] Tampilkan info Tanggal Kejadian - Pukul Kegiatan - Lokasi Fisik Kegiatan (hasil ekstraksi AI/fallback) di kolom Tanggal pada tabel dashboard.

## 7. Re-revisi Tambahan (Fase 8)
- [x] Buat semua teks isi laporan rata kanan kiri (JUSTIFY), termasuk sub-paragraf bernomor dan bullet points.
- [x] Rapatkan lagi jarak garis pembatas kop dengan teks alamat Kemensos dengan menyisipkan horizontal rule di dalam paragraf rapat khusus (Font Size = 1, Margin = 0).
- [x] Kembalikan fungsionalitas blok tanda tangan 100% dengan menghapus method `setPreventRowSplit` pada objek `row` yang juga tidak didukung oleh standard GAS DocumentApp TableRow, sehingga terhindar dari TypeError crash.
- [x] Optimalkan prompt multimodal agar AI Gemini memprioritaskan pembacaan berkas gambar yang memuat data, tabel, nomor surat, dan mengekstrak lokasi fisik kegiatan secara tepat.
- [x] Pisahkan folder penyimpanan antara foto bukti dukung (`RHK-agent_Bukti_Dukung`) dengan file PDF laporan RHK (`RHK-agent_Output`) di Google Drive.
- [x] Perbaiki visualisasi foto dashboard agar tetap muncul dengan membuat folder bukti dukung publik (`setSharing`) dan membuat fallback pembacaan thumbnail dari data `FotoIds` jika kolom `ThumbnailId` kosong.
- [x] Aktifkan kembali tombol Unduh PDF secara permanen di dashboard untuk semua status laporan agar user dapat memicu pembuatan PDF kapan saja.

## 8. Re-revisi Tambahan (Fase 9)
- [x] Perbaiki generator AI agar jam/pukul kegiatan yang tertera pada bagian "Pukul Kegiatan (Jam)" dibaca secara akurat dan tidak selalu bernilai default "07:00 WIB".
- [x] Ubah label tombol "Unduh PDF" di tabel dashboard menjadi "Lihat PDF" serta sesuaikan overlay pemuatan dan notifikasi toast-nya.
- [x] Hilangkan kartu statistik "Menunggu Review" dan "PDF Selesai" pada halaman dashboard.
- [x] Rapikan layout `.stats-grid` dashboard menjadi 2 kolom agar seimbang secara visual pada desktop.
- [x] Jadikan upload foto bukti dukung sebagai field wajib (Required) pada form laporan baru.
- [x] Perbaiki loading dashboard stuck dengan memeriksa keberadaan elemen 'stat-pending' dan 'stat-done' secara aman sebelum memanipulasi textContent di JavaScript.html.
- [x] Perbaiki model default OpenRouter dari google/gemini-2.0-flash-lite:free ke openrouter/free (karena model lama sudah tidak aktif di OpenRouter dan model spesifik dinamis sering berubah, disarankan menggunakan routing model openrouter/free) di GeminiService.gs dan JavaScript.html.

## 9. Re-revisi Tambahan (Fase 10)
- [x] Rapatkan jarak vertikal antara heading besar (A., B., C., dll.) dengan sub-heading/isi di bawahnya dengan mengatur `SpacingAfter(0)` dan `SpacingBefore(0)`.
- [x] Perbaiki perataan bullet points (hanging indent) untuk sub-heading, list alfabet, dan bullet point agar teks baris kedua/ketiga yang terbungkus (wrap) sejajar dengan teks baris pertama, bukan kembali ke margin kiri (0pt).
- [x] Buat preprosesor narasi (`preprocessNarrative`) untuk menyambungkan kembali baris kalimat paragraf atau list item yang tidak sengaja terpotong (soft-wrapped newlines) agar diolah sebagai satu kesatuan elemen paragraf.
- [x] Terapkan pembersih format markdown bold `**` yang sangat andal dan aman dari resiko infinite loop (hang) dengan melakukan pre-kalkulasi offset substring bold pada pure Javascript string (`formatAndAppendParagraph`) sebelum menuliskan paragraf ke Google Docs.

## 10. Re-revisi Tambahan (Fase 11)
- [x] Perbaiki perataan bullet points dan list alfabet agar tidak jatuh ke margin kiri terluar (0pt). Hal ini diselesaikan dengan menyetel nilai absolut positif pada properti `setIndentFirstLine` (karena ia merupakan nilai absolut dari margin kiri, bukan offset relatif, sehingga nilai negatif `-18` menyebabkan teks baris pertama ditarik paksa ke 0pt).
  - Sub-heading (`1.`, `2.`): `indentStart = 36`, `indentFirstLine = 18` (nomor mulai di 18pt, teks rata di 36pt).
  - List Alfabet & Bullet (`a.`, `-`): `indentStart = 54`, `indentFirstLine = 36` (simbol mulai di 36pt—sejajar isi sub-heading—teks rata di 54pt).
  - Paragraf Biasa: `indentStart = 36`, `indentFirstLine = 54` (baris pertama menjorok di 54pt, teks rata di 36pt).
- [x] Tambahkan pembersihan bersih karakter asterisk sisa (`*`) yang tidak berpasangan dari AI agar tidak lolos ke tampilan cetak PDF laporan RHK.

## 11. Run Web App Locally (Fase 12)
- [x] Buat server dev lokal `run_local.py` untuk menggabungkan Index.html, Stylesheet.html, dan JavaScript.html secara real-time.
- [x] Implementasikan Google Apps Script API mock engine (`MOCK_JS` dengan penyimpanan `localStorage`).
- [x] Buat shortcut `run_local.bat` untuk mempermudah eksekusi di Windows.
- [x] Verifikasi fungsionalitas mock untuk seluruh fitur (Dashboard, RHK, P2K2, Nota Dinas, Pengaduan, dan Admin).

