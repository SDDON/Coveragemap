import re

with open('frontend/src/CoverageNode.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'(type="source"\s*position=\{Position\.Bottom\}\s*style=\{\{\s*width:\s*\'100%\',\s*height:\s*\'10px\',\s*background:\s*\'transparent\',\s*border:\s*\'none\',\s*position:\s*\'absolute\',\s*zIndex:\s*1,\s*opacity:\s*0,\s*borderRadius:\s*0,\s*top:\s*0,\s*left:\s*0\s*\}\})',
    r'type="source"\n        position={Position.Bottom}\n        style={{ width: \'100%\', height: \'10px\', background: \'transparent\', border: \'none\', position: \'absolute\', zIndex: 1, opacity: 0, borderRadius: 0, bottom: 0, left: 0 }}',
    content
)

with open('frontend/src/CoverageNode.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('CoverageNode updated')
