with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

import re
idx = c.find('return (')
print(repr(c[idx-5:idx+20]))
