import re

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Edge Highlighting
content = re.sub(
    r"test\('Edge Highlighting', async \(\{ page \}\) => \{.*?\n  \}\);",
    '''test('Edge Highlighting', async ({ page }) => {
    await page.goto('/');
    const edge = page.locator('.react-flow__edge').first();
    await edge.evaluate(el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await expect(edge).toHaveClass(/active|selected/);
  });''',
    content,
    flags=re.DOTALL
)

# Fix Path Selection
content = re.sub(
    r"test\('Path Selection \(Coverage scope view\)', async \(\{ page \}\) => \{.*?\n  \}\);",
    '''test('Path Selection (Coverage scope view)', async ({ page }) => {
    await page.goto('/');
    const edge = page.locator('.react-flow__edge').first();
    await edge.evaluate(el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await expect(edge).toHaveClass(/active|selected/);
  });''',
    content,
    flags=re.DOTALL
)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
