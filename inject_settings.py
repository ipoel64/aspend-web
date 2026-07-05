import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace AI config block
new_ai_block = """              <!-- AI Provider Config -->
              <div class="bg-white rounded-xl shadow-sm border border-surface-variant p-6 relative overflow-hidden" id="gemini-settings-card">
                <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style="background-image: radial-gradient(#000f22 1px, transparent 1px); background-size: 16px 16px;"></div>
                <h3 class="font-title-lg text-title-lg text-on-surface mb-6 border-b border-surface-variant pb-2 flex items-center gap-2 relative z-10">
                  <span class="material-symbols-outlined text-secondary-fixed-dim">smart_toy</span>
                  Layanan AI Cerdas
                </h3>
                
                <div class="space-y-4 relative z-10">
                  <div class="flex flex-col gap-2">
                    <label class="font-label-md text-xs text-on-surface-variant">PILIHAN MODEL KECERDASAN BUATAN <span class="text-error">*</span></label>
                    <select class="w-full rounded-lg border border-outline-variant bg-white py-2 px-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm font-body-md" id="select-ai-provider">
                      <option value="google/gemini-flash-1.5">Google Gemini Flash 1.5 (Sangat pintar & cepat)</option>
                      <option value="meta-llama/llama-3-8b-instruct">Meta Llama 3 8B (Kreatif & bervariasi)</option>
                    </select>
                  </div>
                  <p class="text-[10px] text-on-surface-variant/70 italic">*Sistem telah dikunci menggunakan server OpenRouter dan API tersembunyi. Anda hanya perlu memilih otak utama yang ingin Anda gunakan.</p>

                  <div class="flex gap-3 mt-4">
                    <button class="w-full py-2 px-4 bg-primary text-secondary-fixed rounded-lg hover:opacity-90 font-bold text-xs cursor-pointer" onclick="saveAIConfigSettings()">💾 Simpan Pilihan Model AI</button>
                  </div>
                </div>
              </div>
              
              <!-- Premium Subscription Card -->
              <div class="bg-gradient-to-br from-primary/10 to-transparent rounded-xl shadow-sm border border-primary/20 p-6 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-primary opacity-5 rounded-bl-full pointer-events-none"></div>
                <h3 class="font-title-lg text-title-lg text-primary mb-2 flex items-center gap-2 relative z-10">
                  <span class="material-symbols-outlined">workspace_premium</span>
                  Langganan ASPEND Premium
                </h3>
                <p class="font-body-md text-sm text-on-surface-variant mb-4 relative z-10">Bebaskan diri Anda dari gangguan iklan saat membuat PDF laporan. Nikmati kecepatan tanpa batas!</p>
                
                <div class="flex items-center justify-between bg-white rounded-lg p-3 border border-outline-variant relative z-10">
                  <div>
                    <span class="font-bold text-on-surface">Status Premium</span>
                    <p class="text-xs text-on-surface-variant" id="premium-status-text">Tidak Aktif (Gratis)</p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="toggle-premium" class="sr-only peer" onchange="togglePremiumStatus(event)">
                    <div class="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <p class="text-[9px] text-on-surface-variant mt-2 text-right">Hanya Rp 10.000 / Bulan</p>
              </div>"""

import re
old_ai_match = re.search(r'<!-- AI Provider Config -->.*?</div>\s*</div>\s*</div>', content, re.DOTALL)
if old_ai_match:
    content = content.replace(old_ai_match.group(0), new_ai_block)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Settings page updated.")
