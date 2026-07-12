import base64

with open('rhk_agent_mobile/assets/images/logo_kemensos.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

with open('logo_kemensos_base64.txt', 'w') as out:
    out.write('data:image/png;base64,' + b64)
