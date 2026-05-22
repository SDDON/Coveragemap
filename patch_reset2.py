import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("await expect(targetNode).toHaveCSS('background-color', 'rgb(200, 230, 201)');", 
    "await expect(targetNode).toHaveCSS('background-color', 'rgb(200, 230, 201)');\n    await page.waitForTimeout(500);\n    targetNode.dispatchEvent('pointerdown', { bubbles: true }); await targetNode.dispatchEvent('pointerup', { bubbles: true }); await targetNode.dispatchEvent('click', { bubbles: true });")

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Patched Reset Status to reselect node')
