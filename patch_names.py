import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# For Add Node
c = re.sub(r'await page\.getByRole\(''textbox'', \{ name: /label/i \}\)\.fill\(uniqueLabel\);',
           r"await page.getByRole('textbox', { name: /label/i }).fill(uniqueLabel);\n    await page.getByRole('textbox', { name: /name/i }).fill(uniqueLabel + '_name');", c)

# For Edit Node
c = re.sub(r'await page\.getByRole\(''textbox'', \{ name: /label/i \}\)\.fill\(''Updated Label''\);',
           r"await page.getByRole('textbox', { name: /label/i }).fill('Updated Label');\n    await page.getByRole('textbox', { name: /name/i }).fill('Updated Name');", c)

# For Delete Node (which creates a node first)
c = re.sub(r'await page\.getByRole\(''textbox'', \{ name: /label/i \}\)\.fill\(uniqueLabel\);',
           r"await page.getByRole('textbox', { name: /label/i }).fill(uniqueLabel);\n    await page.getByRole('textbox', { name: /name/i }).fill(uniqueLabel + '_name');", c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched node creation')
