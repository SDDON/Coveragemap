import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(r"\};\); await sourceNode\.dispatchEvent.*?await expect\(unassociatedNode\)\.not\.toHaveClass\(/active/\);\n    \}\);", r"});", c, flags=re.DOTALL)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
