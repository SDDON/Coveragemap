import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(r"const detailsPanel = page\.locator\('\.details-panel'\);\s*await expect\(detailsPanel\)\.toBeVisible\(\);\s*await expect\(detailsPanel\.locator\('\.node-id'\)\)\.not\.toBeEmpty\(\);\s*await expect\(detailsPanel\.locator\('\.node-label'\)\)\.not\.toBeEmpty\(\);", 
    r"const heading = page.getByRole('heading', { name: /Edit node/i }); await expect(heading).toBeVisible();", c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Updated tier1.spec.ts v3')
