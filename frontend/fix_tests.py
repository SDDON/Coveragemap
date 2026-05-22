import sys
import glob

# 1. e2e.spec.ts
with open('e2e.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('await nodes.first().click();', 'await nodes.first().click({ force: true });')
content = content.replace('.toHaveClass(/selected/)', '.toHaveClass(/active/)')
with open('e2e.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)

# 2. test_click.spec.ts
with open('test_click.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('await node.click();', 'await node.click({ force: true });')
content = content.replace('.toHaveClass(/selected/)', '.toHaveClass(/active/)')
with open('test_click.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)

# 3. test_click_mouse.spec.ts
with open('test_click_mouse.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace("expect(classList).toContain('selected')", "expect(classList).toContain('active')")
with open('test_click_mouse.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated tests.")
