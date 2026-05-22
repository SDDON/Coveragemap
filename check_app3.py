with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

import re
matches = [repr(m.group(0)) for m in re.finditer(r'return\s*\(\s*<div', c)]
print(matches)
