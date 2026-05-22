import codecs
import re

with codecs.open('frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

content = re.sub(r'await fetch\(http://localhost:8001/api/nodes/,\s*\{', 'await fetch(http://localhost:8001/api/nodes/, {', content)
content = re.sub(r'await fetch\(http://localhost:8001/api/edges/,\s*\{', 'await fetch(http://localhost:8001/api/edges/, {', content)

with codecs.open('frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)
print("SUCCESS")
