import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(r"test\('Delete Edge', async \(\{ page \}\) => \{.*?test\.describe\('F5", r"test.describe('F5", c, flags=re.DOTALL)
c = re.sub(r"await request\.post\('/api/dev/reset-seed'\);", "// await request.post('/api/dev/reset-seed');", c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
