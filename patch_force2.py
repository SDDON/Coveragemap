import re

path = 'E:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("dragTo(node2.locator('.react-flow__handle-top'))", "dragTo(node2.locator('.react-flow__handle-top'), { force: true })")
content = content.replace("dragTo(node3.locator('.react-flow__handle-top'))", "dragTo(node3.locator('.react-flow__handle-top'), { force: true })")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
