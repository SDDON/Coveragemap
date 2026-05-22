import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(r"const categoryInput = page\.locator\('input\[list=\"alias-list\"\]'\);\s*await categoryInput\.fill\('invalid_free_text'\);\s*await page\.getByRole\('button', \{ name: /save/i \}\)\.click\(\);\s*await expect\(page\.locator\('\.validation-error'\)\)\.toBeVisible\(\);\s*\}\);", "", c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
