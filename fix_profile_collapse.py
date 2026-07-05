import os
import re

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the Profile Text Container by adding whitespace-nowrap and changing max-w-0 to w-0
old_prof_container = '<div class="md:max-w-0 md:opacity-0 md:group-hover:max-w-[150px] md:group-hover:opacity-100 overflow-hidden transition-all duration-300">'
new_prof_container = '<div class="md:w-0 md:opacity-0 md:group-hover:w-[150px] md:group-hover:opacity-100 overflow-hidden transition-all duration-300 whitespace-nowrap">'
text = text.replace(old_prof_container, new_prof_container)

# Just to be completely sure, let's also fix ASPEND text if it's acting up
old_aspend = '<span class="font-headline-md text-headline-md font-bold text-on-primary tracking-wide md:max-w-0 md:opacity-0 md:group-hover:max-w-[150px] md:group-hover:opacity-100 overflow-hidden transition-all duration-300">'
new_aspend = '<span class="font-headline-md text-headline-md font-bold text-on-primary tracking-wide md:w-0 md:opacity-0 md:group-hover:w-[150px] md:group-hover:opacity-100 overflow-hidden transition-all duration-300 whitespace-nowrap block">'
text = text.replace(old_aspend, new_aspend)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Profile Info completely collapsed!')
