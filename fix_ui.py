import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update logo (Sidebar Desktop)
old_logo = '<span class="material-symbols-outlined text-4xl text-white opacity-90">assignment_ind</span>'
new_logo = '<img src="logo.png" alt="ASPEND" class="w-10 h-10 object-contain rounded-md shadow-sm bg-white/20 p-1" onerror="this.onerror=null; this.src=\'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxsaW5lIHgxPSI5IiB5MT0iOSIgeDI9IjE1IiB5Mj0iOSI+PC9saW5lPjxsaW5lIHgxPSI5IiB5MT0iMTMiIHgyPSIxNSIgeTI9IjEzIj48L2xpbmU+PGxpbmUgeDE9IjkiIHkxPSIxNyIgeDI9IjE1IiB5Mj0iMTciPjwvbGluZT48L3N2Zz4=\';">'
text = text.replace(old_logo, new_logo)

# Update logo (Mobile Header)
old_logo_2 = '<span class="material-symbols-outlined text-2xl text-primary bg-primary-container p-2 rounded-lg">assignment_ind</span>'
new_logo_2 = '<img src="logo.png" alt="ASPEND" class="w-8 h-8 object-contain bg-primary-container p-1 rounded-lg" onerror="this.onerror=null; this.src=\'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxsaW5lIHgxPSI5IiB5MT0iOSIgeDI9IjE1IiB5Mj0iOSI+PC9saW5lPjxsaW5lIHgxPSI5IiB5MT0iMTMiIHgyPSIxNSIgeTI9IjEzIj48L2xpbmU+PGxpbmUgeDE9IjkiIHkxPSIxNyIgeDI9IjE1IiB5Mj0iMTciPjwvbGluZT48L3N2Zz4=\';">'
text = text.replace(old_logo_2, new_logo_2)

# 2. Fix Dropdown Responsiveness (Adding truncate and max-widths)
old_sel_1 = '<select class="px-4 py-2 border border-outline-variant rounded-lg font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white min-w-[160px]" id="filter-jenis-rhk" onchange="onJenisRHKFilterChange()" title="Filter Jenis RHK">'
new_sel_1 = '<select class="w-full sm:w-auto max-w-[280px] md:max-w-xs lg:max-w-[350px] truncate px-4 py-2 border border-outline-variant rounded-lg font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white" id="filter-jenis-rhk" onchange="onJenisRHKFilterChange()" title="Filter Jenis RHK">'
text = text.replace(old_sel_1, new_sel_1)

old_sel_2 = '<select class="px-4 py-2 border border-outline-variant rounded-lg font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white min-w-[180px]" id="filter-rencana-aksi" onchange="onFilterChange(event)" title="Filter Rencana Aksi">'
new_sel_2 = '<select class="w-full sm:w-auto max-w-[280px] md:max-w-xs lg:max-w-[350px] truncate px-4 py-2 border border-outline-variant rounded-lg font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white" id="filter-rencana-aksi" onchange="onFilterChange(event)" title="Filter Rencana Aksi">'
text = text.replace(old_sel_2, new_sel_2)

# Also fix the inner inputs to use w-full or flex-grow on mobile
old_filter_container = '<div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">'
new_filter_container = '<div class="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto overflow-hidden">'
text = text.replace(old_filter_container, new_filter_container)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('UI/UX Responsive layout applied!')
