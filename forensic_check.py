import urllib.request
import json

# 1. Download the LIVE script.js and client_services.js
for fname in ['script.js', 'client_services.js']:
    url = f'http://localhost:8000/{fname}'
    try:
        with urllib.request.urlopen(url) as resp:
            content = resp.read().decode('utf-8')
            # Save to local file for inspection
            with open(f'LIVE_{fname}', 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Check for parseRobustDate
            if 'function parseRobustDate' in content:
                # Extract the function
                start = content.index('function parseRobustDate')
                # Find closing bracket by counting braces
                depth = 0
                end = start
                for i in range(start, len(content)):
                    if content[i] == '{':
                        depth += 1
                    elif content[i] == '}':
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
                func_text = content[start:end]
                print(f'\n=== parseRobustDate in {fname} ===')
                print(func_text[:500])
                print('...(truncated)' if len(func_text) > 500 else '')
            else:
                print(f'\n!!! parseRobustDate NOT FOUND in {fname}')
            
            # Check for sort logic
            if 'sortedReports' in content:
                idx = content.index('sortedReports')
                snippet = content[idx:idx+400]
                print(f'\n=== SORT LOGIC in {fname} ===')
                print(snippet)
            
            # Check for reports.sort
            if 'reports.sort' in content:
                idx = content.index('reports.sort')
                snippet = content[idx:idx+400]
                print(f'\n=== reports.sort in {fname} ===')
                print(snippet)
                
            # Check for padStart(5
            if 'padStart(5' in content:
                print(f'\n-> padStart(5) FOUND in {fname}')
            else:
                print(f'\n-> padStart(5) MISSING in {fname}')
                
            # Check for monthsId / indonesian months
            if 'juli' in content and 'monthsId' in content:
                print(f'-> Indonesian month parser FOUND in {fname}')
            else:
                print(f'-> Indonesian month parser MISSING in {fname}')
                
    except Exception as e:
        print(f'Failed to fetch {fname}: {e}')

print('\n\nDone!')
