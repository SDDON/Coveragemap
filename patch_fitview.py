import re

path = 'E:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    // Helper to wait for graph settle'''
replacement = '''    // Click Fit View so nodes are in viewport
    await page.locator('.react-flow__controls-fitview').click();
    await page.waitForTimeout(500);

    // Helper to wait for graph settle'''

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added fitview successfully")
else:
    print("Target not found")
