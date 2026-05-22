import re

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(", ConnectionMode } from '@xyflow/react';", "  ConnectionMode,\n} from '@xyflow/react';")

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
