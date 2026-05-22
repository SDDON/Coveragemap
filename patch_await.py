import os

directory = r'e:\Workspace\coveragemap\e2e-tests\tests'

for filename in os.listdir(directory):
    if not filename.endswith('.spec.ts'):
        continue
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # If a line starts with whitespace and then a node variable but missing await
    import re
    content = re.sub(r'(\s+)(node[A-Z0-9]*|firstNode|unassociatedNode|sourceNode|targetNode|nodes\.first\(\)|page\.locator\(''\.react-flow__node''\)\.first\(\)|page\.locator\(''\[data-id="[A-Z]"\]''\))\.dispatchEvent\(''pointerdown''', r'\1await \2.dispatchEvent(''pointerdown''', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Patching await complete.")
