import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

def replace_function(text, func_name, new_code):
    start = text.find(func_name)
    if start == -1: return text
    brace_start = text.find('{', start)
    stack = 0
    end = -1
    for i in range(brace_start, len(text)):
        if text[i] == '{': stack += 1
        elif text[i] == '}':
            stack -= 1
            if stack == 0:
                end = i
                break
    if end == -1: return text
    return text[:start] + new_code + text[end+1:]

new_verkom_pdf = """function generateVerkomPDF() {
  showToast('Sistem PDFMake untuk Verkom sedang dalam tahap perakitan.', 'info');
  // Nantinya di sini kita panggil pembuat template PDFMake
  // pdfMake.createPdf(docDefinition).download('Verkom.pdf');
}"""

text = replace_function(text, 'function generateVerkomPDF()', new_verkom_pdf)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("generateVerkomPDF modified.")
