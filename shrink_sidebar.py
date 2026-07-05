import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update the sidebar classes
old_sidebar = 'w-[280px] backdrop-blur-md border-r border-outline-variant/20 shadow-xl flex flex-col py-margin_desktop px-stack_md z-50 transition-transform duration-300 -translate-x-full md:translate-x-0" id="sidebar"'
new_sidebar = 'w-[280px] md:w-[84px] md:hover:w-[280px] group overflow-hidden whitespace-nowrap backdrop-blur-md border-r border-outline-variant/20 shadow-xl flex flex-col py-margin_desktop px-stack_md z-50 transition-all duration-300 -translate-x-full md:translate-x-0" id="sidebar"'
text = text.replace(old_sidebar, new_sidebar)

# 2. Update the main content margin
old_main = 'md:ml-[280px] w-full"'
new_main = 'md:ml-[84px] transition-all duration-300 w-full"'
text = text.replace(old_main, new_main)

# 3. Update the Brand Header padding so logo is centered
old_brand = '<div class="mb-stack_lg px-4">'
new_brand = '<div class="mb-stack_lg px-4 md:px-0 md:group-hover:px-4 transition-all duration-300 flex justify-center md:justify-start md:group-hover:justify-start">'
text = text.replace(old_brand, new_brand)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Modern Collapsible Sidebar applied!')
