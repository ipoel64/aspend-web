with open('logo_kemensos_base64.txt', 'r') as f:
    b64 = f.read().replace('\n', '').replace('\r', '')

with open('logo_data.js', 'w') as out:
    out.write('const KEMENSOS_LOGO_BASE64 = "' + b64 + '";\n')
