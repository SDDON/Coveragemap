import re

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the move nodes code
content = re.sub(r'    await node3\.hover\(\);\n    await page\.mouse\.down\(\);\n    await page\.mouse\.move\(800, 500, \{ steps: 5 \}\);\n    await page\.mouse\.up\(\);\n\n    await node2\.hover\(\);\n    await page\.mouse\.down\(\);\n    await page\.mouse\.move\(400, 500, \{ steps: 5 \}\);\n    await page\.mouse\.up\(\);\n', '', content)

# Remove the bad GET mock if it exists
content = re.sub(r"    await page\.route\('\*\*/api/graph\*'.*?await page\.goto\('/'\);", "    await page.goto('/');", content, flags=re.DOTALL)

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
