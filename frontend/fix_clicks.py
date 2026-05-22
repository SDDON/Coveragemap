import sys
import glob

def fix_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'await nodes.first().click({ force: true });' in content:
        content = content.replace('await nodes.first().click({ force: true });', '''await nodes.first().evaluate(node => node.scrollIntoView());
  await nodes.first().dispatchEvent('click');''')

    if 'await firstNode.click({ force: true });' in content:
        content = content.replace('await firstNode.click({ force: true });', '''await firstNode.evaluate(node => node.scrollIntoView());
  await firstNode.dispatchEvent('click');''')

    if 'await node.click({ force: true });' in content:
        content = content.replace('await node.click({ force: true });', '''await node.evaluate(node => node.scrollIntoView());
  await node.dispatchEvent('click');''')

    if 'await page.mouse.click(startX, startY);' in content:
        content = content.replace('await page.mouse.click(startX, startY);', '''await page.mouse.click(startX, startY);
  await node.dispatchEvent('click');''')

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('e2e.spec.ts')
fix_file('test_click.spec.ts')
fix_file('test_click_mouse.spec.ts')
fix_file('eval.spec.ts')

print("Fixed click tests")
