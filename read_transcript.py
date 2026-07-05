import json
import os

path = r"C:\Users\kholifah\.gemini\antigravity\brain\3eeadb83-a756-4ade-826c-a260505a4926\.system_generated\logs\transcript.jsonl"
if not os.path.exists(path):
    print("Transcript not found.")
else:
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if data.get('type') == 'USER_INPUT':
                    print(f"USER: {data.get('content')}")
            except Exception as e:
                pass
