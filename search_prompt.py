import os

paths = ['c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/GeminiService.gs', 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/run_local.py']

for path in paths:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            print(f"--- {os.path.basename(path)} ---")
            lines = f.readlines()
            for i, line in enumerate(lines):
                line_lower = line.lower()
                if 'dasar hukum' in line_lower or 'gambaran umum' in line_lower or 'kali lipat' in line_lower:
                    print(f"[{i+1}] {line.strip()}")
