import sys
with open('test_drag.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('''  await node.evaluate((el) => {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 200, clientY: 200 }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 200, clientY: 200 }));
  });''', 'await node.dragTo(page.locator(".react-flow__pane"));')

with open('test_drag.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
