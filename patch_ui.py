import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(r'const detailsPanel = page.locator\(''\.details-panel''\);\s*await expect\(detailsPanel\)\.toBeVisible\(\);\s*await expect\(detailsPanel\.locator\(''\.node-id''\)\)\.not\.toBeEmpty\(\);\s*await expect\(detailsPanel\.locator\(''\.node-label''\)\)\.not\.toBeEmpty\(\);', 
    r"const heading = page.getByRole('heading', { name: /Edit node/i }); await expect(heading).toBeVisible();", c)

c = re.sub(r'const markPassedBtn = page\.getByRole\(''button'', \{ name: /mark passed/i \}\);\s*await markPassedBtn\.click\(\);',
    r"await page.getByRole('combobox').selectOption('Passed'); await page.getByRole('button', { name: /save/i }).click();", c)

c = re.sub(r'const markFailedBtn = page\.getByRole\(''button'', \{ name: /mark failed/i \}\);\s*await markFailedBtn\.click\(\);',
    r"await page.getByRole('combobox').selectOption('Failed'); await page.getByRole('button', { name: /save/i }).click();", c)

c = re.sub(r'await page\.getByRole\(''button'', \{ name: /mark passed/i \}\)\.click\(\);\s*await expect\(targetNode\)\.toHaveClass\(/status-passed/\);\s*const resetStatusBtn = page\.getByRole\(''button'', \{ name: /reset/i \}\);\s*await resetStatusBtn\.click\(\);',
    r"await page.getByRole('combobox').selectOption('Passed'); await page.getByRole('button', { name: /save/i }).click(); await expect(targetNode).toHaveClass(/status-passed/); await targetNode.evaluate(el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await page.getByRole('combobox').selectOption('Untested'); await page.getByRole('button', { name: /save/i }).click();", c)

c = re.sub(r'const markPassedBtn = page\.getByRole\(''button'', \{ name: /mark passed/i \}\);\s*await page\.getByRole\(''button'', \{ name: /mark passed/i \}\)\.click\(\);',
    r"await page.getByRole('combobox').selectOption('Passed'); await page.getByRole('button', { name: /save/i }).click();", c)

# And Delete Button!
c = re.sub(r'await page\.getByRole\(''button'', \{ name: /delete/i \}\)\.click\(\);',
    r"await page.keyboard.press('Backspace');", c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated tier1.spec.ts')
