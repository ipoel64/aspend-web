import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/PdfService.gs'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if 'function formatAndAppendParagraph' in line:
                print(f"Found at [{i+1}] {line.strip()}")
