import re

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

signature_block = """              <!-- Signature block -->
              <div class="bg-white rounded-xl shadow-sm border border-surface-variant p-6">
                <h3 class="font-title-lg text-title-lg text-on-surface mb-6 border-b border-surface-variant pb-2 flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary">draw</span>
                  Tanda Tangan Digital
                </h3>
                <div class="border border-outline-variant border-dashed rounded-lg p-4 flex flex-col items-center justify-center bg-surface-container-low mb-4 h-32 overflow-hidden" id="signature-preview">
                  <span class="text-xs text-on-surface-variant italic">Belum ada tanda tangan</span>
                </div>
                <input type="file" id="input-signature" accept="image/png,image/jpeg" class="hidden" onchange="handleSignatureUpload(event)">
                <div class="flex flex-col gap-2">
                  <button class="w-full py-2.5 px-4 bg-primary/10 text-primary font-body-md text-xs font-bold rounded-lg hover:bg-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer" onclick="openSignatureCanvas()">
                    <span class="material-symbols-outlined text-[16px]">gesture</span>
                    Gambar Langsung di Layar
                  </button>
                  <button class="w-full py-2.5 px-4 border border-outline text-on-surface-variant font-body-md text-xs font-bold rounded-lg hover:bg-surface-variant transition-all flex items-center justify-center gap-2 cursor-pointer" onclick="document.getElementById('input-signature').click()">
                    <span class="material-symbols-outlined text-[16px]">upload_file</span>
                    Unggah dari Galeri
                  </button>
                </div>
              </div>"""

# Modal Canvas
canvas_modal = """  <!-- ═══════════════════════════════════════════════════════
       Modal: Kanvas Tanda Tangan
       ═══════════════════════════════════════════════════════ -->
  <div class="modal-overlay hidden" id="modal-canvas">
    <div class="modal max-w-md w-full bg-white rounded-xl shadow-xl border border-surface-variant p-6 relative">
      <h3 class="font-title-lg text-title-lg text-primary mb-2">Buat Tanda Tangan</h3>
      <p class="font-body-md text-sm text-on-surface-variant mb-4">Silakan gambar tanda tangan Anda di dalam kotak di bawah ini.</p>
      
      <div class="border-2 border-outline-variant rounded-lg overflow-hidden mb-4 bg-surface-container-lowest" style="touch-action: none;">
        <canvas id="signature-canvas" width="350" height="200" class="w-full cursor-crosshair"></canvas>
      </div>
      
      <div class="flex justify-between items-center mt-6">
        <button class="text-xs font-bold text-error hover:text-error/80 px-3 py-2 flex items-center gap-1 cursor-pointer" onclick="clearSignatureCanvas()">
          <span class="material-symbols-outlined text-[16px]">delete</span> Hapus Ulang
        </button>
        <div class="flex gap-2">
          <button class="px-4 py-2 border border-outline text-on-surface-variant rounded-lg hover:bg-surface-variant font-bold text-xs cursor-pointer" onclick="closeModal('modal-canvas')">Batal</button>
          <button class="px-4 py-2 bg-primary text-secondary-fixed rounded-lg hover:opacity-90 font-bold text-xs cursor-pointer" onclick="saveCanvasSignature()">💾 Simpan</button>
        </div>
      </div>
    </div>
  </div>"""

old_sig_match = re.search(r'<!-- Signature block -->.*?</div>\s*</div>\s*</div>', content, re.DOTALL)
if old_sig_match:
    content = content.replace(old_sig_match.group(0), signature_block + "\n            </div>")

if '<!-- Modal: Kanvas' not in content:
    content = content.replace('<!-- Sidebar Backdrop (mobile) -->', canvas_modal + '\n\n  <!-- Sidebar Backdrop (mobile) -->')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Canvas UI injected.")
