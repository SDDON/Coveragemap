import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace untested node locator
c = c.replace("const untestedNode = page.locator('.react-flow__node.status-untested').first();",
              "const untestedNode = page.locator('.react-flow__node').first();")

# Replace targetNode class assertions
c = re.sub(r"await expect\(targetNode\)\.toHaveClass\(/status-passed/\);",
           r"await expect(targetNode).toHaveCSS('background-color', 'rgb(200, 230, 201)');", c)

c = re.sub(r"await expect\(targetNode\)\.toHaveClass\(/status-failed/\);",
           r"await expect(targetNode).toHaveCSS('background-color', 'rgb(255, 205, 210)');", c)

c = re.sub(r"await expect\(targetNode\)\.toHaveClass\(/status-untested/\);",
           r"await expect(targetNode).toHaveCSS('background-color', 'rgb(255, 255, 255)');", c)

# Replace targetEdge class assertions
# Note: targetEdge is .react-flow__edge, the stroke is on the <path> inside it!
c = re.sub(r"await expect\(targetEdge\)\.toHaveClass\(/status-passed/\);",
           r"await expect(targetEdge.locator('path.react-flow__edge-path').first()).toHaveCSS('stroke', 'rgb(0, 128, 0)');", c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Patched status classes to inline styles')
