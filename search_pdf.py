import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/PdfService.gs'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            line_lower = line.lower()
            if 'dasar hukum' in line_lower or 'margin' in line_lower or 'appendimage' in line_lower or 'gambaran umum' in line_lower or 'setwidth' in line_lower or 'setheight' in line_lower or 'setkeepwithnext' in line_lower or 'heading' in line_lower:
                print(f"[{i+1}] {line.strip()}")
