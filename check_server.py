import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/run_local.py'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if 'do_GET' in line or 'send_response(200)' in line:
                print(f"[{i+1}] {line.strip()}")
