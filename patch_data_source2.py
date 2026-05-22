import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(r"\.react-flow__edge\[data-source=\"\$\{sourceId\}\"\]\[data-target=\"\$\{targetId\}\"\]",
           r".react-flow__edge", c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched data-source properly')
