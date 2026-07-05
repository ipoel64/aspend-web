import os
import time
import re

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

t = int(time.time())

if '<script src="client_services.js"></script>' in text:
    text = text.replace('<script src="client_services.js"></script>', f'<script src="client_services.js?v={t}"></script>')
else:
    text = re.sub(r'<script src="client_services\.js\?v=\d+"></script>', f'<script src="client_services.js?v={t}"></script>', text)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Client Services Cache buster planted!')
