import sys
path = 'frontend/src/App.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('properties: Record<string, any>;', 'properties: Record<string, unknown>;')
content = content.replace('const [editFormData, setEditFormData] = useState<any>({});', 'const [editFormData, setEditFormData] = useState<Record<string, unknown>>({});')
content = content.replace('} catch (err: any) {', '} catch (err: unknown) {')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed App.tsx")
