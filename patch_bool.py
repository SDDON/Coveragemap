import re

path = 'E:/Workspace/coveragemap/backend/graph_service.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('if m and r:', 'if m is not None and r is not None:')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
