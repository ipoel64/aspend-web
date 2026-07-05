import os

# 1. Rename files to standard web formats
if os.path.exists('Stylesheet.html'):
    os.rename('Stylesheet.html', 'style.css')
if os.path.exists('JavaScript.html'):
    os.rename('JavaScript.html', 'script.js')

# 2. Clean up script/style tags from the new files
with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()
css = css.replace('<style>', '').replace('</style>', '').strip()
with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

with open('script.js', 'r', encoding='utf-8') as f:
    js = f.read()
js = js.replace('<script>', '').replace('</script>', '').strip()
with open('script.js', 'w', encoding='utf-8') as f:
    f.write(js)

# 3. Update Index.html to use standard web linking
with open('Index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace("<?!= include('Stylesheet') ?>", '<link rel="stylesheet" href="style.css">')
html = html.replace("<?!= include('JavaScript') ?>", '<script src="script.js"></script>')

with open('Index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Migration to standard static web successful!')
