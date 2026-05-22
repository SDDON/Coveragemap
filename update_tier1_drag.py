import re

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '''await sourceHandle.dragTo(targetHandle);''',
    '''await sourceHandle.dragTo(targetHandle, { sourcePosition: { x: 5, y: 5 }, targetPosition: { x: 5, y: 5 } });'''
)

content = content.replace(
    '''const firstNode = page.locator('.react-flow__node').first();''',
    '''await page.locator('.react-flow__controls-fitview').click();
    await page.waitForTimeout(500);
    const firstNode = page.locator('.react-flow__node').first();'''
)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
