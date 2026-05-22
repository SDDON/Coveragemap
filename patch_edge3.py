import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('const targetEdge = page.locator(.react-flow__edge[data-id=""]);', 'const targetEdge = page.locator(`.react-flow__edge[data-id="${edgeId}"]`);')

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print("Mark Edge Passed fixed.")
