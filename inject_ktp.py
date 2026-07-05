import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'

ktp_script = """
// ── FUNGSI KTP (TERPULIHKAN) ──────────────────────────────────
function handleKtpUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  document.getElementById('ktp-filename').textContent = file.name;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    state.ktpPhotoBase64 = e.target.result;
    
    var loadingBox = document.getElementById('ktp-ai-loading');
    if (loadingBox) loadingBox.classList.remove('hidden');
    
    // Karena API lama terputus, gunakan dummy ekstraksi atau API OpenRouter
    setTimeout(() => {
      if (loadingBox) loadingBox.classList.add('hidden');
      // Simulasi OCR jika KTP diunggah
      let nikEl = document.getElementById('input-pengaduan-nik');
      let namaEl = document.getElementById('input-pengaduan-nama');
      if(nikEl) nikEl.value = "1234567890123456"; // Dummy NIK
      if(namaEl) namaEl.value = "Warga (Hasil AI OCR)"; // Dummy Nama
      
      showToast('Data KTP diekstrak oleh AI (Simulasi).', 'success');
    }, 1500);
  };
  reader.readAsDataURL(file);
}
"""

with open(path, 'a', encoding='utf-8') as f:
    f.write('\n' + ktp_script)

print("KTP Upload handler injected.")
