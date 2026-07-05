import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update the flex rows to remove gap when collapsed
old_row = '<div class="flex items-center gap-3 mb-6">'
new_row = '<div class="flex items-center gap-3 md:gap-0 md:group-hover:gap-3 mb-6 transition-all duration-300 md:justify-center md:group-hover:justify-start">'
text = text.replace(old_row, new_row)

# 2. Update ASPEND text to collapse width
old_aspend = '<span class="font-headline-md text-headline-md font-bold text-on-primary tracking-wide md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">ASPEND</span>'
new_aspend = '<span class="font-headline-md text-headline-md font-bold text-on-primary tracking-wide md:max-w-0 md:opacity-0 md:group-hover:max-w-[150px] md:group-hover:opacity-100 overflow-hidden transition-all duration-300">ASPEND</span>'
text = text.replace(old_aspend, new_aspend)

# 3. Update Profile text container to collapse width
old_prof = '<div class="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">'
new_prof = '<div class="md:max-w-0 md:opacity-0 md:group-hover:max-w-[150px] md:group-hover:opacity-100 overflow-hidden transition-all duration-300">'
text = text.replace(old_prof, new_prof)

# 4. Hide 'Profil Lengkap' button perfectly when collapsed
old_btn = 'md:opacity-0 md:group-hover:opacity-100"'
new_btn = 'md:opacity-0 md:group-hover:opacity-100 md:max-w-0 md:group-hover:max-w-full md:px-0 md:group-hover:px-4 overflow-hidden border-transparent md:group-hover:border-secondary-fixed/50"'
text = text.replace(old_btn, new_btn)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Zero-Width Collapse applied!')
