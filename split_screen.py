import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# We need to find where the old container is.
# In the original file, it is: <div class="overflow-x-auto min-h-[400px]" id="reports-list-container"></div>
# But it might be missing the closing div if we just search for the opening tag.
# We will search for '<div class="overflow-x-auto min-h-[400px]" id="reports-list-container">'
import re
match = re.search(r'<div class="[^"]*?" id="reports-list-container">.*?</div>', text, flags=re.DOTALL)
if not match:
    # Maybe the div is completely empty in the file
    match = re.search(r'<div class="[^"]*?" id="reports-list-container">\s*</div>', text, flags=re.DOTALL)

if match:
    new_split_screen = '''
            <!-- SPLIT SCREEN LAYOUT -->
            <div class="flex flex-col lg:flex-row w-full min-h-[500px]">
              
              <!-- KIRI: TABEL LAPORAN (45%) -->
              <div class="w-full lg:w-[45%] border-r border-surface-variant overflow-x-auto" id="reports-list-container">
                <!-- Table injected here -->
              </div>
              
              <!-- KANAN: PDF PREVIEW (55%) -->
              <div class="w-full lg:w-[55%] bg-surface-container-lowest relative flex flex-col hidden lg:flex" id="pdf-preview-pane">
                
                <div class="p-3 border-b border-surface-variant bg-surface-bright flex justify-between items-center">
                  <div class="font-label-md text-label-md font-bold text-on-surface-variant flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">preview</span>
                    Pratinjau Laporan PDF
                  </div>
                  <button id="close-preview-btn" class="p-1.5 rounded-md hover:bg-surface-variant text-on-surface-variant lg:hidden" onclick="document.getElementById('pdf-preview-pane').classList.add('hidden')">
                    <span class="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <div class="flex-grow relative flex items-center justify-center bg-surface" id="pdf-content-area">
                  <div class="text-center px-4" id="pdf-placeholder">
                    <span class="material-symbols-outlined text-6xl text-outline-variant/30 mb-3 block">picture_as_pdf</span>
                    <p class="font-body-sm text-body-sm text-on-surface-variant">Klik laporan di tabel sebelah kiri<br>untuk memuat pratinjau PDF di sini.</p>
                  </div>
                  
                  <iframe id="pdf-frame" class="absolute inset-0 w-full h-full hidden border-0"></iframe>
                </div>
                
              </div>
            </div>
'''
    text = text[:match.start()] + new_split_screen + text[match.end():]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('Split-Screen Structure applied!')
else:
    print('Container not found!')
