import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix API Failure
c = re.sub(r"const errorToast = page\.getByText\(/Error:/i\);\s*await expect\(errorToast\)\.toBeVisible\(\);",
           r"const errorToast = page.locator('.react-flow__panel');\n    await expect(errorToast).toContainText(/Failed to load/i);", c)

# Fix Edge Highlighting reference errors
c = re.sub(r"const unassociatedNode = page\.locator\(\.react-flow__node:not\(\[data-id=\"\$\{sourceId\}\"\]\):not\(\[data-id=\"\$\{targetId\}\"\]\)\)\.first\(\);",
           r"const unassociatedNode = page.locator('.react-flow__node:not(.active)').first();", c)

c = re.sub(r"const sourceNode = page\.locator\(\.react-flow__node\[data-id=\"\$\{sourceId\}\"\]\);\s*const targetNode = page\.locator\(\.react-flow__node\[data-id=\"\$\{targetId\}\"\]\);\s*const unassociatedNode = page\.locator\(\.react-flow__node:not\(\[data-id=\"\$\{sourceId\}\"\]\):not\(\[data-id=\"\$\{targetId\}\"\]\)\)\.first\(\);",
           r"const unassociatedNode = page.locator('.react-flow__node:not(.active)').first();", c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched reference errors')
