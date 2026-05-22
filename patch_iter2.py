import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter2_dimming.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r'await page\.locator\(''\[data-id="A"\]''\)\.click\(\{ force: true \}\);', r'await page.locator(\'[data-id="A"]\').evaluate(el => { el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });', c)
with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter2_dimming.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
