import re

path = 'E:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    if (!box1 || !box2 || !box3) throw new Error('Bounding boxes not found');

    // Move nodes apart a bit to ensure drag works properly
    await page.mouse.move(box1.x + 10, box1.y + 10);
    await page.mouse.down();
    await page.mouse.move(box1.x - 200, box1.y, { steps: 5 });
    await page.mouse.up();

    await page.mouse.move(box3.x + 10, box3.y + 10);
    await page.mouse.down();
    await page.mouse.move(box3.x + 200, box3.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Re-fetch bounding boxes after moving
    const b1 = await node1.boundingBox();
    const b2 = await node2.boundingBox();
    const b3 = await node3.boundingBox();

    if (!b1 || !b2 || !b3) throw new Error('Bounding boxes not found after move');'''

replacement = '''    if (!box1 || !box2 || !box3) throw new Error('Bounding boxes not found');'''

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Removed manual moves successfully")
else:
    print("Target not found")
