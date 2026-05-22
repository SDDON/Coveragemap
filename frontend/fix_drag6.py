import sys
with open('test_drag.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("await page.mouse.move(startX, startY);", '''
  await node.evaluate((el) => {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 200, clientY: 200 }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 200, clientY: 200 }));
  });
''')
content = content.replace("await page.mouse.down();", "")
content = content.replace("await page.waitForTimeout(100);", "")
content = content.replace("await page.mouse.move(startX + 100, startY + 100, { steps: 10 });", "")
content = content.replace("await page.mouse.up();", "")

with open('test_drag.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
