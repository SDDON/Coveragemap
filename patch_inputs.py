import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("getByRole('textbox', { name: /label/i })", "locator('input[type=\"text\"]').nth(1)")
c = c.replace("getByRole('textbox', { name: /name/i })", "locator('input[type=\"text\"]').nth(2)")

# Wait, check for any edge properties? Edge has no Label/Name, only Type.

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Patched Label and Name inputs')
