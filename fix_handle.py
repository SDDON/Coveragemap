import sys
with open('frontend/src/CoverageNode.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace("height: '20%'", "height: '10px'")
with open('frontend/src/CoverageNode.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
