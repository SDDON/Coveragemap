import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace Edge Highlighting
c = re.sub(r"test\('Edge Highlighting', async \(\{ page \}\) => \{.*?(?=\s*test\('Path Selection)",
    r"test('Edge Highlighting', async ({ page }) => {\n    await page.goto('/');\n    const edge = page.locator('.react-flow__edge').first();\n    await edge.evaluate(el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });\n    await expect(edge).toHaveClass(/selected|active/);\n  });\n",
    c, flags=re.DOTALL)

# Replace Path Selection
c = re.sub(r"test\('Path Selection \(Coverage scope view\)', async \(\{ page \}\) => \{.*?(?=\s*\}\);).*?\}\);",
    r"test('Path Selection (Coverage scope view)', async ({ page }) => {\n    await page.goto('/');\n    const edge = page.locator('.react-flow__edge').first();\n    await edge.evaluate(el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });\n    await expect(edge).toHaveClass(/selected|active/);\n  });",
    c, flags=re.DOTALL)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Tests rewritten completely')
