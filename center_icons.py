import os
import re

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update Nav Links (remove px-[30px] and add justify-center and gap-0 when collapsed)
# Find all nav items
# Example: <a class="nav-item flex items-center gap-3 px-4 md:px-[30px] md:group-hover:px-4 py-3 rounded-lg transition-all duration-300 text-on-primary/70 hover:text-on-primary hover:bg-white/5 transition-colors duration-200 cursor-pointer active:scale-95"
old_nav_regex = r'class="nav-item flex items-center gap-3 px-4 md:px-\[30px\] md:group-hover:px-4 py-3'
new_nav_class = 'class="nav-item flex items-center gap-3 md:gap-0 md:group-hover:gap-3 px-4 py-3 md:justify-center md:group-hover:justify-start'
text = re.sub(old_nav_regex, new_nav_class, text)

# For the logout button
old_logout_regex = r'class="flex items-center gap-3 px-4 md:px-\[30px\] md:group-hover:px-4 py-2 text-error/80'
new_logout_class = 'class="flex items-center gap-3 md:gap-0 md:group-hover:gap-3 px-4 py-2 md:justify-center md:group-hover:justify-start text-error/80'
text = re.sub(old_logout_regex, new_logout_class, text)

# 2. Update Nav Texts to zero-width collapse
# Example: <span class="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">Dashboard RHK</span>
old_span_regex = r'<span class="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">(.*?)</span>'
new_span_template = r'<span class="md:max-w-0 md:opacity-0 md:group-hover:max-w-[200px] md:group-hover:opacity-100 overflow-hidden transition-all duration-300 whitespace-nowrap block">\1</span>'
text = re.sub(old_span_regex, new_span_template, text)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Nav icons perfectly centered!')
