import re

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "await srcHandle.dragTo(tgtHandle);",
    "await srcHandle.dragTo(tgtHandle, { sourcePosition: { x: 5, y: 5 }, targetPosition: { x: 5, y: 5 } });"
)

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
