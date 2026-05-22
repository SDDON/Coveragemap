import re

path = 'E:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    // Drag from bottom handle to top handle
    // node1 -> node2
    await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height - 2);
    await page.mouse.down();
    await page.mouse.move(b2.x + b2.width / 2, b2.y + 2, { steps: 5 });
    await page.mouse.up();
    
    // node2 -> node3
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height - 2);
    await page.mouse.down();
    await page.mouse.move(b3.x + b3.width / 2, b3.y + 2, { steps: 5 });
    await page.mouse.up();
    
    // node1 -> node3
    await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height - 2);
    await page.mouse.down();
    await page.mouse.move(b3.x + b3.width / 2, b3.y + 2, { steps: 5 });
    await page.mouse.up();'''

replacement = '''    // Drag from bottom handle to top handle
    // node1 -> node2
    let curB1 = await node1.boundingBox();
    let curB2 = await node2.boundingBox();
    if(curB1 && curB2) {
      await page.mouse.move(curB1.x + curB1.width / 2, curB1.y + curB1.height - 2);
      await page.mouse.down();
      await page.mouse.move(curB2.x + curB2.width / 2, curB2.y + 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(600); // Wait for debounce and layout
    }

    // node2 -> node3
    curB2 = await node2.boundingBox();
    let curB3 = await node3.boundingBox();
    if(curB2 && curB3) {
      await page.mouse.move(curB2.x + curB2.width / 2, curB2.y + curB2.height - 2);
      await page.mouse.down();
      await page.mouse.move(curB3.x + curB3.width / 2, curB3.y + 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(600);
    }
    
    // node1 -> node3
    curB1 = await node1.boundingBox();
    curB3 = await node3.boundingBox();
    if(curB1 && curB3) {
      await page.mouse.move(curB1.x + curB1.width / 2, curB1.y + curB1.height - 2);
      await page.mouse.down();
      await page.mouse.move(curB3.x + curB3.width / 2, curB3.y + 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(600);
    }'''

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced edges logic successfully")
else:
    print("Target not found")
