import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("res.status() === 200", "res.request().method() === 'GET'")

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
