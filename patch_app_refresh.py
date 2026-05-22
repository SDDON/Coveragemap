import re

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r"const \[refreshKey, setRefreshKey\] = useState\(0\);\n?", "", content)
content = content.replace("}, [refreshKey]);", "}, []);")
content = content.replace("}, [filterText, maxDepth, setNodes, setEdges, refreshKey]);", "}, [filterText, maxDepth, setNodes, setEdges]);")

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
