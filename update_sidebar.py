import os
path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update the sidebar classes
old_sidebar = '<aside class="fixed inset-y-0 left-0 bg-primary w-64 text-white z-30 transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col shadow-xl" id="sidebar">'
new_sidebar = '<aside class="fixed inset-y-0 left-0 bg-primary w-64 lg:w-[84px] lg:hover:w-64 text-white z-40 transform -translate-x-full lg:translate-x-0 transition-all duration-300 ease-in-out flex flex-col shadow-xl overflow-hidden group whitespace-nowrap" id="sidebar">'
text = text.replace(old_sidebar, new_sidebar)

# 2. Update the main content margin
old_main = '<main class="flex-1 lg:ml-64 bg-surface flex flex-col min-h-screen transition-all duration-300 ease-in-out">'
new_main = '<main class="flex-1 lg:ml-[84px] bg-surface flex flex-col min-h-screen transition-all duration-300 ease-in-out w-full">'
text = text.replace(old_main, new_main)

# 3. Adjust logo area to look good when thin
old_logo_area = '<div class="p-6 flex flex-col items-center border-b border-primary-dark/30">'
new_logo_area = '<div class="py-6 px-0 flex flex-col items-center border-b border-primary-dark/30 w-full">'
text = text.replace(old_logo_area, new_logo_area)

old_logo_text = '<span class="text-2xl font-display font-black tracking-wider text-white">ASPEND</span>'
new_logo_text = '<span class="text-2xl font-display font-black tracking-wider text-white transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100 mt-2">ASPEND</span>'
text = text.replace(old_logo_text, new_logo_text)

old_profile_box = '<div class="mt-6 flex items-center gap-3 bg-primary-dark/40 p-3 rounded-xl border border-primary-light/10 w-full">'
new_profile_box = '<div class="mt-6 flex items-center gap-3 bg-primary-dark/40 p-3 rounded-xl border border-primary-light/10 w-[85%] mx-auto lg:w-12 lg:group-hover:w-[85%] lg:p-1 lg:group-hover:p-3 overflow-hidden transition-all duration-300">'
text = text.replace(old_profile_box, new_profile_box)

# 4. Hide Profile Text when collapsed
old_profile_text = '<div class="flex-1 min-w-0">'
new_profile_text = '<div class="flex-1 min-w-0 transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">'
text = text.replace(old_profile_text, new_profile_text)

# 5. Fix padding on nav items so icons center exactly at 84px width (84/2 = 42, icon is 24, padding = 30 -> 15px ~ px-5 or px-7)
old_nav = 'class="flex items-center gap-4 px-6 py-4'
new_nav = 'class="flex items-center gap-5 px-[30px] py-4'
text = text.replace(old_nav, new_nav)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Sidebar transformed to Mini-Hover mode!')
