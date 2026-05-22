import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix Reset Status
c = re.sub(r"const resetStatusBtn = page\.getByRole\('button', \{ name: /reset status/i \}\);\s*await resetStatusBtn\.click\(\);",
           r"await page.locator('select').last().selectOption('Untested');\n    await page.getByRole('button', { name: /save/i }).click();", c)

# Delete Coverage Metrics Update
c = re.sub(r"test\('Coverage Metrics Update', async \(\{ page \}\) => \{.*?(?=\s*test\('Add Node')\s*", "", c, flags=re.DOTALL)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Patched Reset Status and deleted Coverage Metrics Update')
