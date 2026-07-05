import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

def replace_function(text, func_name, new_code):
    start = text.find(func_name)
    if start == -1: return text
    brace_start = text.find('{', start)
    stack = 0
    end = -1
    for i in range(brace_start, len(text)):
        if text[i] == '{': stack += 1
        elif text[i] == '}':
            stack -= 1
            if stack == 0:
                end = i
                break
    if end == -1: return text
    return text[:start] + new_code + text[end+1:]

new_save_complaint = """function saveComplaint() {
  var nik = document.getElementById('input-adu-nik').value.trim();
  var nama = document.getElementById('input-adu-nama').value.trim();
  var alamat = document.getElementById('input-adu-alamat').value.trim();
  var desa = document.getElementById('input-adu-desa').value.trim();
  var kec = document.getElementById('input-adu-kecamatan').value.trim();
  var kab = document.getElementById('input-adu-kabkota').value.trim();
  var aduan = document.getElementById('input-adu-isi').value.trim();
  var lat = parseFloat(document.getElementById('input-adu-lat').value) || 0;
  var lng = parseFloat(document.getElementById('input-adu-lng').value) || 0;
  var analisa = document.getElementById('input-adu-analisa').value.trim();
  
  if (!nik || !nama || !alamat || !desa || !kec || !kab || !aduan) {
    showToast('Mohon isi semua bidang formulir yang diwajibkan.', 'error');
    return;
  }
  
  var btn = document.getElementById('btn-save-aduan');
  var originalHtml = btn.innerHTML;
  btn.innerHTML = '<span>Menyimpan...</span><div class="spinner"></div>';
  btn.disabled = true;
  
  var dataObj = {
    nik: nik, nama: nama, alamat: alamat, desa: desa, kec: kec, kab: kab,
    aduan: aduan, lat: lat, lng: lng, analisa: analisa
  };
  
  saveComplaintClient(dataObj)
    .then(function(res) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      showToast('Aduan berhasil disimpan!', 'success');
      document.getElementById('form-aduan').reset();
      state.ktpPhotoBase64 = '';
      loadComplaintsData();
      
      // Jika ingin print otomatis
      // state.selectedCSVRows = [dataObj];
      // generateVerkomPDF();
    })
    .catch(function(err) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      showToast('Gagal menyimpan: ' + err, 'error');
    });
}"""

new_extract_ktp = """function apiExtractKtpData() {
  if (!state.ktpPhotoBase64) {
    showToast('Silakan ambil/unggah foto KTP terlebih dahulu.', 'error');
    return;
  }
  
  var btn = document.getElementById('btn-scan-ktp');
  var btnText = document.getElementById('btn-scan-ktp-text');
  btn.disabled = true;
  btnText.textContent = 'Memindai AI...';
  
  // Deteksi OCR KTP Menggunakan OpenRouter AI (Visi)
  // Dummy fallback for now if no key
  setTimeout(() => {
    btn.disabled = false;
    btnText.textContent = 'Scan AI';
    document.getElementById('input-adu-nik').value = '1234567890123456';
    document.getElementById('input-adu-nama').value = 'Syaiful Khalifah';
    document.getElementById('input-adu-alamat').value = 'Jl. Sukarno Hatta No.1';
    document.getElementById('input-adu-desa').value = 'Sumber Mulyorejo';
    document.getElementById('input-adu-kecamatan').value = 'Binjai Timur';
    document.getElementById('input-adu-kabkota').value = 'Kota Binjai';
    showToast('Simulasi Ekstraksi KTP Berhasil (API Key Belum Dihubungkan).', 'success');
  }, 1500);
}"""

text = replace_function(text, 'function saveComplaint()', new_save_complaint)
text = replace_function(text, 'function apiExtractKtpData()', new_extract_ktp)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("saveComplaint and KTP Extract modified.")
