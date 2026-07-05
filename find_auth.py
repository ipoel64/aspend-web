import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/JavaScript.html'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if 'function processLogin' in line or 'function initApp' in line:
                print(f"[{i+1}] {line.strip()}")
