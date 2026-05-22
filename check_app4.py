with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

import re
m = re.search(r'([ \t]*)return\s*\(\s*<div', c)
if m:
    print(repr(m.group(1)))
