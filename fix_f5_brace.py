import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("test.describe('F6: Alias Dictionary (Standardization)', () => {",
              "});\n\ntest.describe('F6: Alias Dictionary (Standardization)', () => {")

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print("Restored closing brace")
