import re

# Fix App.tsx
with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import React, { useEffect", "import { useEffect")
content = re.sub(r"const triggerRefresh = \(\) => setRefreshKey\(k => k \+ 1\);\n?", "", content)

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Fix CoverageNode.tsx
with open('frontend/src/CoverageNode.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import React from 'react';\n", "")

with open('frontend/src/CoverageNode.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
