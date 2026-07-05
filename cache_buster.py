import os
import time

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

import re
if '<script src="script.js"></script>' in text:
    text = text.replace('<script src="script.js"></script>', f'<script src="script.js?v={int(time.time())}"></script>')
else:
    text = re.sub(r'<script src="script\.js\?v=\d+"></script>', f'<script src="script.js?v={int(time.time())}"></script>', text)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Cache buster planted!')
