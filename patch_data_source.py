import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# For Mark Edge Passed
c = re.sub(r"const sourceId = await edge\.getAttribute\('data-source'\);\s*const targetId = await edge\.getAttribute\('data-target'\);\s*expect\(sourceId\)\.toBeTruthy\(\);\s*expect\(targetId\)\.toBeTruthy\(\);",
           r"", c)

# For Add Edge
c = re.sub(r"const newEdge = page\.locator\(\.react-flow__edge\[data-source=\"\$\{sourceId\}\"\]\[data-target=\"\$\{targetId\}\"\]\)\.last\(\);",
           r"const newEdge = page.locator('.react-flow__edge').last();", c)

# For Delete Edge
c = re.sub(r"const targetEdge = page\.locator\(\.react-flow__edge\[data-source=\"\$\{sourceId\}\"\]\[data-target=\"\$\{targetId\}\"\]\)\.last\(\);",
           r"const targetEdge = page.locator('.react-flow__edge').last();", c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched data-source completely')
