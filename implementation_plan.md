# Rencana Implementasi Re-revisi RHK-agent (Fase 4)

Dokumen ini menjelaskan rencana teknis untuk menyelesaikan revisi fase 4 yang diajukan oleh pengguna terkait ukuran logo kop, perbaikan bug rendering tanda tangan, penyesuaian tombol aksi "Buka Link", fitur Edit & Hapus laporan, serta penggantian Lokasi Kegiatan dengan Pukul.

## User Review Required

> [!IMPORTANT]
> - **Perbaikan Tanda Tangan**: Fungsi `row.setPreventFolderSplit` tidak didukung di standard DocumentApp Google Apps Script sehingga menyebabkan kegagalan rendering dan tanda tangan tidak muncul. Kita akan menghapus pemanggilan ini untuk memulihkan rendering tanda tangan sepenuhnya.
> - **Aksi Buka Link (Folder Drive)**: Tombol "Buka Link" akan mengarah langsung ke folder `RHK-agent_Output` di Google Drive (bukan ke file PDF langsung). Tombol ini akan dalam kondisi **disabled** secara default dan baru menjadi **aktif** setelah pengguna menekan tombol "Unduh PDF" untuk pertama kalinya pada baris laporan tersebut.
> - **Fitur Edit & Hapus Laporan**: Kita akan menambahkan tombol "Edit" dan "Hapus" pada kolom aksi di tabel dashboard. 
>   - Menghapus laporan akan menghapus baris di Google Sheets dan membuang file PDF/foto terkait di Drive.
>   - Mengedit laporan akan memuat kembali data ke formulir input, dan saat disimpan, statusnya akan kembali menjadi Draft untuk proses re-generate narasi & PDF.
> - **Lokasi Diganti Pukul**: Input "Lokasi Kegiatan" diubah menjadi "Pukul Kegiatan" (format jam). Jam ini akan digabungkan di kolom tanggal pada dashboard (contoh: `3 Jun 2026 - 09:00 WIB`) dan pada kop waktu laporan PDF. Informasi lokasi kegiatan fisik kini ditulis oleh pengguna di dalam textarea "Poin-poin Kegiatan".

---

## Proposed Changes

### 1. Modifikasi Layanan PDF & Render (`PdfService.gs`)

#### [MODIFY] [PdfService.gs](file:///c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/PdfService.gs)
* **Perbesar Logo Kop**:
  - Ubah `logoCell.setWidth(70)` menjadi `95`.
  - Ubah `textCell.setWidth(410)` menjadi `385`.
  - Ubah ukuran logo `newWidth` dari `60` menjadi `85` agar logo terlihat lebih besar.
* **Perbaikan Rendering Tanda Tangan**:
  - Hapus pemanggilan `row.setPreventFolderSplit(true);` di `insertSignatureBlock` untuk memperbaiki crash rendering.
* **Integrasi Pukul di Kop Laporan**:
  - Di `insertReportHeader`, jika `reportData.Lokasi` terisi (yang sekarang menyimpan jam), gabungkan ke teks waktu:
    `Waktu : [Tanggal], Pukul [Lokasi]`

---

### 2. Modifikasi Server-Side Controller (`Code.gs`)

#### [MODIFY] [Code.gs](file:///c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Code.gs)
* **Return folderUrl di getUserReports**:
  - Panggil `getOrCreateOutputFolder().getUrl()` dan return nilai tersebut sebagai `folderUrl` dalam respons objek `getUserReports` agar client bisa mendapatkan link folder output secara efisien.
* **Fungsi Hapus Laporan**:
  - Implementasikan `deleteReportLog(reportId)` untuk mencari row, menghapus file PDF & foto-foto kegiatan di Google Drive, kemudian menghapus baris data di sheet `Laporan_Log`.
* **Fungsi Update Laporan (Edit)**:
  - Perbarui `submitReportData` agar menerima `reportId` opsional dalam payload. Jika `reportId` dikirim dan barisnya ditemukan, timpa baris tersebut (menggunakan `updateRow`) dan kembalikan statusnya ke `Draft` agar narasi dan PDF dapat di-generate ulang.

---

### 3. Modifikasi UI HTML & JS (`Index.html`, `JavaScript.html`)

#### [MODIFY] [Index.html](file:///c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html)
* **Label Lokasi → Pukul**:
  - Ubah label "Lokasi Kegiatan" menjadi "Pukul Kegiatan".
  - Ubah input text `#input-lokasi` placeholder menjadi `Contoh: 09:00 WIB` atau `09:00 - 11:00`.
* **Placeholder Poin Kegiatan**:
  - Perbarui placeholder `#input-poin` agar menyertakan petunjuk pengisian lokasi kegiatan:
    `Tuliskan poin-point kegiatan, seperti lokasi kegiatan; siapa saja yang terlibat; Kegiatan apa; Hasil Utamanya; Saran`
* **Kolom Status Dihilangkan**:
  - Hapus kolom `<th>Status</th>` dari header tabel dashboard.

#### [MODIFY] [JavaScript.html](file:///c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/JavaScript.html)
* **State & Tracking Download**:
  - Tambahkan `state.folderUrl = ''` dan `state.downloadedReports = {}` pada object state.
* **Render Tabel & Aksi Baru**:
  - Di `loadReports()`, simpan `result.folderUrl` ke `state.folderUrl`.
  - Di `renderReportsTable()`, hilangkan kolom status.
  - Untuk setiap baris laporan, buat kolom Aksi dengan layout Flex yang berisi:
    1. **Unduh PDF**: Aktif jika status Selesai.
    2. **Buka Link**: Aktif hanya jika laporan berstatus Selesai DAN ID laporan tersebut ada di `state.downloadedReports` (pernah diunduh). Tautan ini mengarah ke `state.folderUrl`.
    3. **Edit**: Tombol ✏️ Edit yang memanggil `editReport(row.id)`.
    4. **Hapus**: Tombol 🗑️ Hapus yang memanggil `deleteReport(row.id)`.
  - Gabungkan Pukul (`row.lokasi`) di kolom Tanggal (contoh: `25 Mei 2026 - 09:00 WIB`).
* **Fitur Unduh & Aktivasi Buka Link**:
  - Di fungsi `downloadPdf()`, setelah sukses mengunduh, set `state.downloadedReports[reportId] = true` dan panggil `renderReportsTable(state.reports)` untuk mengaktifkan tombol "Buka Link".
* **Fungsi Edit Laporan**:
  - Implementasikan `editReport(reportId)` untuk memanggil `getReportById`, mengisi kembali seluruh inputan form (termasuk modul/sesi P2K2 dan preview foto lama), mengubah teks tombol submit menjadi `✨ Perbarui Narasi`, dan bernavigasi ke halaman form.
* **Fungsi Hapus Laporan**:
  - Implementasikan `deleteReport(reportId)` dengan konfirmasi hapus via `confirm()`. Jika disetujui, panggil `deleteReportLog` di server lalu muat ulang dashboard.
* **Reset Form**:
  - Di `resetForm()`, kosongkan `state.currentReportId` dan kembalikan teks tombol submit ke `✨ Buat Narasi`.

---

## Rencana Verifikasi

### Pengujian Manual
1. Pastikan logo Kemensos pada kop laporan PDF tampil lebih besar sesuai dengan area layout.
2. Pastikan blok tanda tangan di kanan bawah PDF muncul secara lengkap tanpa error rendering.
3. Buka dashboard:
   - Pastikan kolom "STATUS" sudah hilang.
   - Pastikan tanggal terformat jam (misal: `3 Jun 2026 - 09:00 WIB`).
   - Tombol "Buka Link" harus berstatus *disabled* saat halaman pertama kali dimuat.
4. Klik tombol "Unduh PDF", pastikan file PDF terunduh dan tombol "Buka Link" berubah menjadi aktif. Klik "Buka Link" dan pastikan tab baru terbuka mengarah ke folder Google Drive `RHK-agent_Output`.
5. Klik tombol "Edit" pada salah satu laporan:
   - Form buat laporan harus terisi otomatis dengan data laporan tersebut.
   - Tombol berubah menjadi "Perbarui Narasi".
   - Edit nilai pukul atau tanggal, klik "Perbarui Narasi" lalu generate PDF ulang, pastikan nama file ter-update dan PDF mencerminkan perubahan jam tersebut.
6. Klik tombol "Hapus" pada salah satu laporan, konfirmasi penghapusan, dan pastikan data laporan hilang dari dashboard dan sheet spreadsheet.
