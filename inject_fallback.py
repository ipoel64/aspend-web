import os

script_path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(script_path, 'r', encoding='utf-8') as f:
    text = f.read()

def replace_func(text, func_name, new_code):
    start = text.find(func_name)
    if start == -1: return text
    brace = text.find('{', start)
    stack = 0
    end = -1
    for i in range(brace, len(text)):
        if text[i] == '{': stack += 1
        elif text[i] == '}':
            stack -= 1
            if stack == 0:
                end = i
                break
    if end == -1: return text
    return text[:start] + new_code + text[end+1:]

fallback_code = """function loadRHKOptions() {
  // Data Cadangan (Fallback) jika Spreadsheet gagal
  const defaultRhk = [
    {id: 'RHK-1', jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', rencana: 'Melaksanakan supervisi Kebijakan Bantuan Sosial Kepada ASN PPPK'},
    {id: 'RHK-1', jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', rencana: 'Melakukan edukasi dan sosialisasi pencairan secara tunai dan non tunai'},
    {id: 'RHK-1', jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', rencana: 'Melaksanakan Supervisi Permasalahan Bantuan Sosial'},
    {id: 'RHK-1', jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', rencana: 'Melaksanakan Monitoring/Pemantauan Penyaluran Bantuan Sosial'},
    {id: 'RHK-1', jenis: 'Terlaksananya penyaluran bansos kepada Keluarga Penerima Manfaat (KPM) PKH tepat sasaran dan tepat jumlah', rencana: 'Melaksanakan Penelitian penyaluran bantuan Sosial'},
    {id: 'RHK-2', jenis: 'Terlaksananya pertemuan P2K2 sesuai dengan ketentuan', rencana: 'Melaksanakan Pertemuan Peningkatan Kemampuan Keluarga (P2K2)'},
    {id: 'RHK-2', jenis: 'Terlaksananya pertemuan P2K2 sesuai dengan ketentuan', rencana: 'Melakukan Supervisi pelaksanaan P2K2 kepada ASN PPPK'},
    {id: 'RHK-3', jenis: 'Terlaksananya Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial secara akurat sesuai dengan ketentuan', rencana: 'Melaksanakan Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial'},
    {id: 'RHK-3', jenis: 'Terlaksananya Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial secara akurat sesuai dengan ketentuan', rencana: 'Melakukan pendampingan, mediasi, dan fasilitasi kepada KPM PKH dalam proses perubahan perilaku, pola pikir yang mandiri dan produktif'},
    {id: 'RHK-3', jenis: 'Terlaksananya Verifikasi Komitmen Pendidikan,Kesehatan dan Kesejahteraan Sosial secara akurat sesuai dengan ketentuan', rencana: 'Melaksanakan supervisi Verifikasi Komitmen Kepada ASN PPPK'},
    {id: 'RHK-4', jenis: 'Tersedianya Data KPM graduasi yang disusun sesuai dengan instrumen dan ketentuan', rencana: 'Melakukan usulan KPM Graduasi mandiri dan Pemberdayaan PPSE'},
    {id: 'RHK-4', jenis: 'Tersedianya Data KPM graduasi yang disusun sesuai dengan instrumen dan ketentuan', rencana: 'Melaksanakan supervisi Graduasi Kepada ASN PPPK'},
    {id: 'RHK-5', jenis: 'Terlaksananya Verifikasi, Validasi dan Permutakhiran Data KPM secara akurat sesuai dengan ketentuan', rencana: 'Melaksanakan Pemutakhiran Data'},
    {id: 'RHK-5', jenis: 'Terlaksananya Verifikasi, Validasi dan Permutakhiran Data KPM secara akurat sesuai dengan ketentuan', rencana: 'Melaksanakan proses bisnis PKH yang meliputi verifikasi validasi calon penerima bantuan sosial'},
    {id: 'RHK-5', jenis: 'Terlaksananya Verifikasi, Validasi dan Permutakhiran Data KPM secara akurat sesuai dengan ketentuan', rencana: 'Melaksanakan supervisi Verifikasi, Validasi dan pemutakhiran Kepada ASN PPPK'},
    {id: 'RHK-6', jenis: 'Terlaksananya kegiatan kasus adaptif (Respon kasus/pengaduan/kebencanaan/kerentanan) disusun secara lengkap dan akurat', rencana: 'Melaksanakan Respon Kasus/Pengaduan/kebencanaan/Kerentanan'},
    {id: 'RHK-7', jenis: 'Tersedianya Data Analisis Laporan Bulanan yang disusun sesuai dengan Ketentuan', rencana: 'Membuat laporan bulanan pelaksanaan PKH dan laporan lainnya.'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Melaksanakan Tindak Lanjut Hasil Pemeriksaan (TLHP)'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Melakukan sosialisasi kebijakan dan bisnis proses PKH kepada aparat pemerintah tingkat kecamatan, desa/kelurahan, KPM PKH, dan masyarakat umum secara berkala melalui Pertemuan atau media sosial di'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Mengikuti Rapat Koordinasi,Sosialisasi Kebijakan Proses Bisnis PKH dan Penguatan Kapasitas SDM.'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Melakukan Pengawasan dan edukasi kepada Pendamping Sosial di Wilayah Kerja'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Melakukan koordinasi dan sinkronisasi dengan instansi terkait di tingkat Kabupaten Kota'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Berkoodinasi dengan ASN PPPK berkaitan dengan pelaksanaan program ke ASN PPPK'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Melakukan Evaluasi Kinerja dan Menyusun Pelaporan ASN PPPK'},
    {id: 'RHK-8', jenis: 'Terlaksananya direktif pimpinan sesuai dengan penugasan program Kementrian Sosial', rencana: 'Tugas Lainnya (Penugasan lainnya program Kementrian Sosial)'},
    {id: 'RHK-9', jenis: 'Terlaksananya Penyebaran Berita Baik Kementrian Sosial', rencana: 'Berperan aktif dalam memanfaatkan, menggunakan, melibatkan dan menyebarkan Media Sosial untuk menyampaikan semua program di Kementerian Sosial'}
  ];

  fetchAdminDataClient().then(data => {
    let rhkData = data.rhk && data.rhk.length > 0 ? data.rhk : defaultRhk;
    state.rhkOptions = rhkData.map(r => ({id: r.id, jenisRhk: r.jenis, rencanaAksi: r.rencana}));
    
    if (data.p2k2 && data.p2k2.length > 0) {
      state.p2k2ModulOptions = data.p2k2.map(p => ({modul: p.modul, sesi: p.sesi}));
    } else {
      // Default P2K2
      state.p2k2ModulOptions = [
        {modul: 'Modul Kesehatan dan Gizi', sesi: 'Sesi 1 - Pentingnya Gizi dan Layanan Kesehatan Ibu Hamil'},
        {modul: 'Modul Pengasuhan dan Pendidikan Anak', sesi: 'Sesi 1 - Menjadi Orang Tua yang Lebih Baik'},
        {modul: 'Modul Ekonomi', sesi: 'Sesi 1 - Mengelola Keuangan Keluarga'}
      ];
    }
    
    populateDropdowns();
  }).catch(err => {
    console.warn("Gagal memuat RHK dari Google Sheets. Menggunakan Data Cadangan Lokal.", err);
    state.rhkOptions = defaultRhk.map(r => ({id: r.id, jenisRhk: r.jenis, rencanaAksi: r.rencana}));
    state.p2k2ModulOptions = [
        {modul: 'Modul Kesehatan dan Gizi', sesi: 'Sesi 1 - Pentingnya Gizi dan Layanan Kesehatan Ibu Hamil'},
        {modul: 'Modul Pengasuhan dan Pendidikan Anak', sesi: 'Sesi 1 - Menjadi Orang Tua yang Lebih Baik'},
        {modul: 'Modul Ekonomi', sesi: 'Sesi 1 - Mengelola Keuangan Keluarga'}
    ];
    populateDropdowns();
  });
  
  function populateDropdowns() {
    var filterJenisSel = document.getElementById('filter-jenis-rhk');
    if (filterJenisSel) {
      filterJenisSel.innerHTML = '<option value="">Semua Jenis RHK</option>';
      var seen = {};
      state.rhkOptions.forEach(function(o) {
        if (!seen[o.jenisRhk]) {
          seen[o.jenisRhk] = true;
          filterJenisSel.innerHTML += '<option value="' + escapeHtml(o.id) + '">' + escapeHtml(o.id + ' — ' + o.jenisRhk) + '</option>';
        }
      });
    }

    var selectJenis = document.getElementById('select-jenis-rhk');
    if (selectJenis) {
      selectJenis.innerHTML = '<option value="">— Pilih Jenis RHK —</option>';
      var seenForm = {};
      state.rhkOptions.forEach(function(o) {
        if (!seenForm[o.jenisRhk]) {
          seenForm[o.jenisRhk] = true;
          selectJenis.innerHTML += '<option value="' + escapeHtml(o.id) + '">' + escapeHtml(o.id + ' — ' + o.jenisRhk) + '</option>';
        }
      });
    }
    
    // Memicu trigger agar Rencana Aksi terhubung langsung saat baru dimuat
    if (state.filterJenisRHK && filterJenisSel) {
        filterJenisSel.value = state.filterJenisRHK;
        onJenisRHKFilterChange();
    }
  }
}"""
text = replace_func(text, 'function loadRHKOptions()', fallback_code)

with open(script_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Bulletproof Dropdown applied successfully.")
