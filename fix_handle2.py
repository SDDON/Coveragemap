import sys
with open('frontend/src/CoverageNode.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace("height: '10px'", "height: '100%'")
with open('frontend/src/CoverageNode.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
