import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix Add Node button
c = re.sub(r'/add node/i', r'/create node/i', c)

# Fix dragging handles in Add Edge and Delete Edge
# Just add a pan command before sourceHandle.dragTo
pan_code = "await page.mouse.move(500, 500); await page.mouse.down(); await page.mouse.move(2000, 500, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(500);\n    "
c = re.sub(r'(\s+)await sourceHandle\.dragTo\(targetHandle, \{ force: true \}\);', 
           r'\1' + pan_code + r'await sourceHandle.dragTo(targetHandle, { force: true });', c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print("Patched create node and dragTo panning.")
