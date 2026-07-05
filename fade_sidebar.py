import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix ASPEND Title
old_aspend = '<span class="font-headline-md text-headline-md font-bold text-on-primary tracking-wide">ASPEND</span>'
new_aspend = '<span class="font-headline-md text-headline-md font-bold text-on-primary tracking-wide md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">ASPEND</span>'
text = text.replace(old_aspend, new_aspend)

# Fix Profile Name and Role Container
old_profile_div = '''          <div>
            <p class="font-label-md text-label-md text-on-primary truncate max-w-[150px]" id="sidebar-user-name">Memuat...</p>
            <p class="text-[10px] text-on-primary/70 truncate max-w-[150px]" id="sidebar-user-role">—</p>
          </div>'''
new_profile_div = '''          <div class="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
            <p class="font-label-md text-label-md text-on-primary truncate max-w-[150px]" id="sidebar-user-name">Memuat...</p>
            <p class="text-[10px] text-on-primary/70 truncate max-w-[150px]" id="sidebar-user-role">—</p>
          </div>'''
text = text.replace(old_profile_div, new_profile_div)

# Fix Profil Lengkap Button
old_btn = '<button class="w-full py-2 border border-secondary-fixed/50 rounded-lg text-secondary-fixed font-label-md text-label-md hover:bg-white/5 transition-colors duration-200 cursor-pointer active:scale-95" onclick="navigateTo(\'settings\')">'
new_btn = '<button class="w-full py-2 border border-secondary-fixed/50 rounded-lg text-secondary-fixed font-label-md text-label-md hover:bg-white/5 transition-all duration-300 cursor-pointer active:scale-95 md:opacity-0 md:group-hover:opacity-100" onclick="navigateTo(\'settings\')">'
text = text.replace(old_btn, new_btn)

# Fix Nav Links Texts and Center the Icons
# List of texts to fade
texts_to_fade = ['Dashboard RHK', 'Pengaduan', 'VERKOM Tools', 'Nota Dinas', 'Pengaturan &amp; AI', 'Panel Admin', 'Keluar']
for t in texts_to_fade:
    old_span = f'<span>{t}</span>'
    new_span = f'<span class="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">{t}</span>'
    text = text.replace(old_span, new_span)

# Center icons when collapsed
old_nav_class = 'class="nav-item flex items-center gap-3 px-4 py-3 rounded-lg'
new_nav_class = 'class="nav-item flex items-center gap-3 px-4 md:px-[30px] md:group-hover:px-4 py-3 rounded-lg transition-all duration-300'
text = text.replace(old_nav_class, new_nav_class)

# The Logout button has a slightly different class
old_logout_class = 'class="flex items-center gap-3 px-4 py-2 text-error/80'
new_logout_class = 'class="flex items-center gap-3 px-4 md:px-[30px] md:group-hover:px-4 py-2 text-error/80 transition-all duration-300'
text = text.replace(old_logout_class, new_logout_class)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Sidebar visual polish complete!')
