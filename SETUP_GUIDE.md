# 📋 Panduan Setup & Deploy — RHK-agent

Panduan lengkap untuk memasang dan menjalankan aplikasi **RHK-agent** sebagai Google Apps Script Web App.

---

## 📌 Prasyarat

1. Akun Google (Gmail / Google Workspace)
2. Akses ke Google Drive, Google Sheets, Google Docs
3. Gemini API Key (gratis dari Google AI Studio)

---

## 🔑 Langkah 1: Dapatkan Gemini API Key

1. Buka **[Google AI Studio](https://aistudio.google.com/apikey)**
2. Login dengan akun Google Anda
3. Klik **"Create API Key"** atau **"Buat Kunci API"**
4. Pilih project Google Cloud (buat baru jika belum ada)
5. **Salin API Key** yang dihasilkan (format: `AIza...`)
6. Simpan API Key ini — akan digunakan di Langkah 4

> ⚠️ **PENTING:** API Key ini bersifat rahasia. Jangan bagikan ke orang lain.

---

## 📄 Langkah 2: Buat Project Google Apps Script

1. Buka **[Google Apps Script](https://script.google.com)**
2. Klik **"New Project"** (Proyek Baru)
3. Beri nama project: **"RHK-agent"**

### Buat File-File Berikut:

Di editor Apps Script, buat file-file ini (klik tombol **+** di sebelah "Files"):

#### File Server (.gs):
| Nama File | Cara Membuat |
|-----------|-------------|
| `Code.gs` | Sudah ada default, ganti isinya |
| `DataService.gs` | Klik + → Script → ketik nama "DataService" |
| `GeminiService.gs` | Klik + → Script → ketik nama "GeminiService" |
| `PdfService.gs` | Klik + → Script → ketik nama "PdfService" |

#### File Frontend (.html):
| Nama File | Cara Membuat |
|-----------|-------------|
| `Index.html` | Klik + → HTML → ketik nama "Index" |
| `Stylesheet.html` | Klik + → HTML → ketik nama "Stylesheet" |
| `JavaScript.html` | Klik + → HTML → ketik nama "JavaScript" |

4. **Salin-tempel** isi dari masing-masing file yang disediakan ke file yang sesuai di editor

---

## ⚙️ Langkah 3: Buat Google Spreadsheet Database

1. Buka **[Google Sheets](https://sheets.google.com)**
2. Buat spreadsheet baru dengan nama: **"RHK-agent Database"**
3. **Salin ID Spreadsheet** dari URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_DISINI/edit
   ```
   ID adalah bagian antara `/d/` dan `/edit`

> 💡 Sheet dan data master akan dibuat otomatis oleh fungsi `setupDatabase()`.

---

## 🔐 Langkah 4: Konfigurasi Script Properties

Script Properties adalah tempat menyimpan konfigurasi rahasia (seperti API Key) agar tidak ditulis langsung di kode. Berikut cara mengaturnya:

### Cara Membuka Script Properties:
1. Di editor Apps Script, lihat **sidebar kiri** (panel navigasi)
2. Klik ikon **⚙️ Project Settings** (Setelan Proyek) — biasanya di bagian paling bawah sidebar
3. Scroll ke bawah halaman sampai menemukan bagian **"Script Properties"**
4. Klik tombol **"Add Script Property"** (Tambah Properti Skrip)

### Cara Pengaturan API Key:

Ada 2 cara untuk mengatur `GEMINI_API_KEY`:

#### Cara 1: Lewat Halaman Pengaturan Web App (SANGAT DIREKOMENDASIKAN)
1. Setelah web app berhasil di-deploy (Langkah 6), buka web app.
2. Sebagai Admin (pengguna pertama yang menjalankan `runSetup` otomatis menjadi admin), buka menu **Pengaturan**.
3. Di bagian bawah, Anda akan melihat kartu **🛡️ Konfigurasi & Diagnostik Gemini API**.
4. Tempel API Key Anda di sana, lalu klik **Simpan API Key**. Anda juga bisa menguji status API Key secara langsung dengan mengklik tombol **Test Koneksi API** untuk melihat hasil analisis kuota.

#### Cara 2: Lewat Script Properties (Manual)
Tambahkan properti berikut di editor Apps Script Project Settings:

**Properti 1 — GEMINI_API_KEY**

| Kolom | Yang Diketik |
|-------|-------------|
| **Property** | `GEMINI_API_KEY` |
| **Value** | *(tempel API Key dari Langkah 1)* |

Contoh lengkap:
```
Property:  GEMINI_API_KEY
Value:     AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> 💡 API Key didapat dari Langkah 1. Pastikan meng-copy secara lengkap tanpa spasi di awal/akhir.

---

**Properti 2 — SPREADSHEET_ID**

| Kolom | Yang Diketik |
|-------|-------------|
| **Property** | `SPREADSHEET_ID` |
| **Value** | *(tempel ID Spreadsheet dari Langkah 3)* |

Contoh lengkap:
```
Property:  SPREADSHEET_ID
Value:     1BxR4a7ZQxKj2Mxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> 💡 ID Spreadsheet adalah deretan karakter acak di URL spreadsheet Anda, antara `/d/` dan `/edit`.
> Contoh URL: `https://docs.google.com/spreadsheets/d/1BxR4a7ZQxKj2Mxxxxxxxxxx/edit`
> Maka ID-nya: `1BxR4a7ZQxKj2Mxxxxxxxxxx`

---

**Properti 3 — ADMIN_EMAILS (OPSIONAL)**

> ⚠️ **Properti ini TIDAK WAJIB.** Secara default, pengguna pertama yang menjalankan `runSetup()` di Langkah 5 akan otomatis menjadi Admin. Anda hanya perlu mengisi ini jika ingin menambahkan admin tambahan.

| Kolom | Yang Diketik |
|-------|-------------|
| **Property** | `ADMIN_EMAILS` |
| **Value** | *(daftar email admin, dipisah koma, TANPA spasi)* |

Contoh — 1 admin saja:
```
Property:  ADMIN_EMAILS
Value:     kholifah@gmail.com
```

Contoh — beberapa admin:
```
Property:  ADMIN_EMAILS
Value:     kholifah@gmail.com,budi.santoso@gmail.com,siti.aminah@gmail.com
```

> 💡 **Penjelasan:** Email yang dimasukkan di sini akan mendapat akses ke menu **🛡️ Admin** di aplikasi. Admin bisa menambah/edit/hapus data Master RHK dan Master P2K2. Jika Anda satu-satunya pengguna, cukup kosongkan properti ini — Anda sudah otomatis jadi admin dari Langkah 5.

---

### Setelah Selesai:

Tampilan Script Properties Anda seharusnya terlihat seperti ini:

```
┌──────────────────┬──────────────────────────────────────────────┐
│ Property         │ Value                                        │
├──────────────────┼──────────────────────────────────────────────┤
│ GEMINI_API_KEY   │ AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx       │
│ SPREADSHEET_ID   │ 1BxR4a7ZQxKj2Mxxxxxxxxxxxxxxxxxxxxxx        │
│ ADMIN_EMAILS     │ kholifah@gmail.com                           │
└──────────────────┴──────────────────────────────────────────────┘
```

5. Klik **"Save Script Properties"** (Simpan Properti Skrip) untuk menyimpan

---

## 🗄️ Langkah 5: Inisialisasi Database

1. Di editor Apps Script, buka file **`Code.gs`**
2. Pilih fungsi **`runSetup`** dari dropdown fungsi di toolbar atas
3. Klik tombol **▶ Run** (Jalankan)
4. Pada dialog izin:
   - Klik **"Review Permissions"**
   - Pilih akun Google Anda
   - Klik **"Advanced"** → **"Go to RHK-agent (unsafe)"**
   - Klik **"Allow"** (Izinkan)
5. Tunggu hingga eksekusi selesai (cek di Execution Log)
6. Buka Google Spreadsheet — seharusnya sudah ada 5 sheet:
   - `Users`, `Master_RHK`, `Master_P2K2`, `Laporan_Log`, `Config`

---

## 🚀 Langkah 6: Deploy sebagai Web App

1. Di editor Apps Script, klik **"Deploy"** → **"New deployment"**
2. Klik ikon ⚙️ → pilih **"Web app"**
3. Isi konfigurasi:

| Setting | Value |
|---------|-------|
| **Description** | RHK-agent v1.0 |
| **Execute as** | **Me** (email Anda) |
| **Who has access** | **Anyone with Google account** (atau sesuai kebutuhan) |

4. Klik **"Deploy"**
5. **Salin URL Web App** yang dihasilkan
6. Buka URL tersebut di browser — aplikasi RHK-agent akan tampil!

> 💡 Setiap kali melakukan perubahan kode, buat deployment baru via **"Deploy"** → **"Manage deployments"** → **"Edit"** → ubah versi ke **"New version"** → **"Deploy"**

---

## 📁 Langkah 7: Pengaturan Folder Google Drive

Aplikasi akan otomatis membuat folder-folder berikut di Google Drive Anda:

| Folder | Fungsi |
|--------|--------|
| `RHK-agent_Output` | Menyimpan file PDF laporan |
| `RHK-agent_Signatures` | Menyimpan gambar tanda tangan user |
| `RHK-agent_Photos` | Menyimpan foto bukti kegiatan |
| `RHK-agent_ProfilePhotos` | Menyimpan foto profil user |

> ✅ Folder dibuat otomatis saat pertama kali digunakan. Tidak perlu membuat manual.

---

## 👤 Langkah 8: Setup Profil User

1. Buka URL Web App
2. Klik menu **"Pengaturan"** di sidebar
3. Lengkapi profil:
   - **Nama Lengkap**: Nama sesuai identitas
   - **NIP**: Nomor Induk Pegawai
   - **Jabatan**: Jabatan resmi (misal: Penata Layanan Operasional)
   - **Kabupaten/Kota**: Lokasi kerja (akan muncul di "Dibuat di" pada PDF)
4. **Upload Tanda Tangan**: Siapkan foto tanda tangan (PNG/JPG, latar putih)
5. Klik **"Simpan Perubahan"**

---

## 🔧 Troubleshooting

### Error "Authorization required"
- Jalankan ulang fungsi `runSetup` dan berikan izin yang diminta

### Error "Spreadsheet not found"
- Pastikan `SPREADSHEET_ID` di Script Properties sudah benar
- Pastikan spreadsheet tidak dihapus

### Error "Gemini API error"
- Pastikan `GEMINI_API_KEY` di Script Properties sudah benar
- Pastikan API key belum expired atau direvoke
- Cek kuota API di [Google AI Studio](https://aistudio.google.com)

### PDF tidak ter-generate
- Pastikan user sudah mengisi profil lengkap (Nama, NIP, Jabatan, Kabupaten/Kota)
- Pastikan tanda tangan sudah di-upload
- Cek Execution Log di Apps Script untuk detail error

### Aplikasi lambat
- Google Apps Script memiliki batas waktu eksekusi 6 menit
- Kurangi ukuran foto yang di-upload (max 2MB per foto)
- Gunakan max 4-5 foto per laporan

---

## 📊 Penggunaan Harian

### Alur Membuat Laporan:
1. **Buat Laporan** → Isi form → Pilih RHK & Rencana Aksi
2. **Buat Narasi** → AI menyusun narasi resmi
3. **Review & Edit** → Periksa dan edit narasi sesuai kebutuhan
4. **Simpan & Generate PDF** → PDF tersimpan otomatis di Google Drive
5. **Dashboard** → Lihat riwayat & unduh PDF kapan saja

### Tips:
- Gunakan fitur **input suara** 🎤 untuk mendikte poin kegiatan
- Edit narasi AI sebelum generate PDF — AI tidak selalu sempurna
- Upload foto dengan resolusi sedang (1-2 MB) untuk hasil optimal
- PDF otomatis tersimpan di folder `RHK-agent_Output` di Drive

---

## 📞 Dukungan

Jika mengalami masalah, periksa:
1. **Execution Log**: Di Apps Script → Executions (sidebar kiri)
2. **Browser Console**: Tekan F12 → tab Console untuk error JavaScript
3. **Script Properties**: Pastikan semua key sudah terisi dengan benar

---

*RHK-agent v1.0 — Sistem Otomasi Laporan Kinerja*
*Dibuat untuk Kementerian Sosial Republik Indonesia*
