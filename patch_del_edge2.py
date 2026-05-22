import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace Delete Edge test fully
c = re.sub(
r"test\('Delete Edge', async \(\{ page \}\) => \{.*?(?=\s*\}\);)\s*\}\);",
r"""test('Delete Edge', async ({ page }) => {
    const edges = page.locator('.react-flow__edge');
    await expect(edges).not.toHaveCount(0);
    const initialCount = await edges.count();
    
    const targetEdge = edges.first();
    await expect(targetEdge).toBeVisible();
    
    await targetEdge.evaluate(el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    
    await page.waitForTimeout(500);
    const deletePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() === 'DELETE');
    
    await page.keyboard.press('Backspace');
    await deletePromise;
    await page.waitForTimeout(500);
    
    const finalCount = await edges.count();
    expect(finalCount).toBeLessThan(initialCount);
  });""", c, flags=re.DOTALL)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print("Rewrote Delete Edge")
