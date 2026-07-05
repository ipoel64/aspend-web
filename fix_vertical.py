import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the Brand Header Wrapper
old_brand = 'class="mb-stack_lg px-4 md:px-0 md:group-hover:px-4 transition-all duration-300 flex justify-center md:justify-start md:group-hover:justify-start"'
new_brand = 'class="mb-stack_lg px-4 md:px-0 md:group-hover:px-4 transition-all duration-300 flex flex-col items-center md:items-stretch"'
text = text.replace(old_brand, new_brand)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Profile layout successfully fixed to vertical stack!')
