import os
import re

app_file = "frontend/src/App.tsx"
with open(app_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
skip = 0
for i, line in enumerate(lines):
    if skip > 0:
        skip -= 1
        continue
    
    # Replace styledNodes in early return
    if "styledNodes: nodes.map(n => ({ ...n, className: (n.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim() }))," in line:
        new_lines.append("        styledNodes: nodes.map(n => {\n")
        new_lines.append("          const cls = (n.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim();\n")
        new_lines.append("          return cls === (n.className || '') ? n : { ...n, className: cls };\n")
        new_lines.append("        }),\n")
        continue

    # Replace styledEdges in early return
    if "styledEdges: edges.map(e => ({ ...e, className: (e.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim() }))" in line:
        new_lines.append("        styledEdges: edges.map(e => {\n")
        new_lines.append("          const cls = (e.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim();\n")
        new_lines.append("          return cls === (e.className || '') ? e : { ...e, className: cls };\n")
        new_lines.append("        })\n")
        continue

    # Replace de-emphasized else block in styledNodes and styledEdges
    if "else {" in line and i + 1 < len(lines) and "cls += ' de-emphasized';" in lines[i+1]:
        skip = 2
        continue

    # Update return to avoid unnecessary obj creation
    if "return { ...n, className: cls.trim() };" in line:
        new_lines.append("        cls = cls.trim();\n")
        new_lines.append("        if (cls === (n.className || '')) return n;\n")
        new_lines.append("        return { ...n, className: cls };\n")
        continue
        
    if "return { ...e, className: cls.trim() };" in line:
        new_lines.append("        cls = cls.trim();\n")
        new_lines.append("        if (cls === (e.className || '')) return e;\n")
        new_lines.append("        return { ...e, className: cls };\n")
        continue

    # Replace ReactFlow tag to add className
    if "<ReactFlow" in line and i + 5 < len(lines) and "nodes={styledNodes}" in lines[i+1]:
        new_lines.append("      <ReactFlow\n")
        new_lines.append("        className={(selectedNode || selectedEdge) ? 'has-selection' : ''}\n")
        continue

    new_lines.append(line)

with open(app_file, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
