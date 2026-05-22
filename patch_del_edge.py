import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Remove edge creation block from Delete Edge
c = re.sub(
r"""      await page\.mouse\.move\(500, 500\);.*?await responsePromise;""", 
"", c, flags=re.DOTALL)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print("Removed edge creation from Delete Edge")
