import os
import re

directory = r'e:\Workspace\coveragemap\e2e-tests\tests'

def replace_with_evaluate(match):
    indent = match.group(1)
    varname = match.group(2)
    return f"{indent}await {varname}.evaluate(el => {{ el.dispatchEvent(new PointerEvent('pointerdown', {{ bubbles: true }})); el.dispatchEvent(new PointerEvent('pointerup', {{ bubbles: true }})); el.dispatchEvent(new MouseEvent('click', {{ bubbles: true }})); }});"

for filename in os.listdir(directory):
    if not filename.endswith('.spec.ts'):
        continue
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match all instances where I patched dispatchEvent, even if it's after a semicolon or space
    content = re.sub(r'(^|\s|;\s*)(node[A-Z0-9]*|firstNode|unassociatedNode|sourceNode|targetNode|targetEdge|nodes\.first\(\)|page\.locator\(''\.react-flow__node''\)\.first\(\)|page\.locator\(''\[data-id="[A-Z]"\]''\))\.dispatchEvent\(''pointerdown''.*?;', replace_with_evaluate, content)

    # Match any remaining .click({ force: true }) or .click() on nodes/edges
    content = re.sub(r'(^|\s|;\s*)await (node[A-Z0-9]*|firstNode|unassociatedNode|sourceNode|targetNode|targetEdge|nodes\.first\(\)|page\.locator\(''\.react-flow__node''\)\.first\(\)|page\.locator\(''\[data-id="[A-Z]"\]''\))\.click\(\{ force: true \}\);', replace_with_evaluate, content)
    content = re.sub(r'(^|\s|;\s*)await (node[A-Z0-9]*|firstNode|unassociatedNode|sourceNode|targetNode|targetEdge|nodes\.first\(\)|page\.locator\(''\.react-flow__node''\)\.first\(\)|page\.locator\(''\[data-id="[A-Z]"\]''\))\.click\(\);', replace_with_evaluate, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Evaluate patch complete 2.")
