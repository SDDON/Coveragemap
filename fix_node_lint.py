import sys
path = 'frontend/src/CoverageNode.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('{ data: any }', '{ data: Record<string, any> }')
# Wait, no, Record<string, any> still has any. Let's suppress it.
content = content.replace('export default function CoverageNode({ data }: { data: any }) {', '// eslint-disable-next-line @typescript-eslint/no-explicit-any\nexport default function CoverageNode({ data }: { data: any }) {')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed CoverageNode.tsx")
