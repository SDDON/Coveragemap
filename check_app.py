with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    c = f.read()
import re
print(repr(re.search(r'return\s*\(\s*<div', c).group(0)))
