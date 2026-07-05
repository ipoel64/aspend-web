import os
path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

start_marker = '<section class="page hidden" id="page-dashboard">'
end_marker = '<!-- Content Card (Table & Filters) -->'

idx_start = text.find(start_marker)
idx_end = text.find(end_marker, idx_start)

if idx_start != -1 and idx_end != -1:
    new_section = '''
          <div class="mb-stack_lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 class="font-headline-lg text-headline-lg text-on-surface mb-2">Dashboard Laporan RHK</h2>
              <p class="font-body-md text-body-md text-on-surface-variant">Kelola dan tinjau laporan pendampingan sosial secara real-time.</p>
            </div>
            
            <div class="flex flex-row gap-3 overflow-x-auto pb-2 md:pb-0 hide-scrollbar" style="-ms-overflow-style: none; scrollbar-width: none;">
              <!-- Card Total -->
              <div class="bg-surface-container-lowest shadow-sm border border-surface-variant rounded-xl p-3 flex items-center gap-3 min-w-[150px] flex-shrink-0">
                <div class="p-2 bg-primary/10 rounded-lg text-primary flex-shrink-0">
                  <span class="material-symbols-outlined text-xl">summarize</span>
                </div>
                <div>
                  <span class="text-on-surface-variant font-label-sm text-[10px] uppercase block mb-0.5 font-bold">Total Laporan</span>
                  <div class="font-headline-md text-headline-md text-on-surface font-black leading-none" id="dash-stat-total">0</div>
                </div>
              </div>
              
              <!-- Card Bulan Ini -->
              <div class="bg-surface-container-lowest shadow-sm border border-surface-variant rounded-xl p-3 flex items-center gap-3 min-w-[150px] flex-shrink-0">
                <div class="p-2 bg-secondary/15 rounded-lg text-secondary flex-shrink-0">
                  <span class="material-symbols-outlined text-xl">calendar_today</span>
                </div>
                <div>
                  <span class="text-on-surface-variant font-label-sm text-[10px] uppercase block mb-0.5 font-bold">Bulan Ini</span>
                  <div class="font-headline-md text-headline-md text-on-surface font-black leading-none" id="dash-stat-month">0</div>
                </div>
              </div>
            </div>
          </div>

          '''
    new_text = text[:idx_start + len(start_marker)] + new_section + text[idx_end:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('Cards relocated successfully!')
else:
    print('Failed to find markers.')
