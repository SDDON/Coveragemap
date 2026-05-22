import re

path = 'E:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    await page.mouse.move(box3.x + 200, box3.y, { steps: 5 });
    await page.mouse.up();

    // Re-fetch bounding boxes after moving'''

replacement = '''    await page.mouse.move(box3.x + 200, box3.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Re-fetch bounding boxes after moving'''

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced bounding box delay successfully")
else:
    print("Target not found")
