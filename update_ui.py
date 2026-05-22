import re

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

move_nodes = '''    await node3.hover();
    await page.mouse.down();
    await page.mouse.move(800, 500, { steps: 5 });
    await page.mouse.up();

    await node2.hover();
    await page.mouse.down();
    await page.mouse.move(400, 500, { steps: 5 });
    await page.mouse.up();
'''

content = content.replace("const createEdge = async (src, tgt) => {", move_nodes + "\n    const createEdge = async (src, tgt) => {")

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
