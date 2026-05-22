import os
import re

directory = r'e:\Workspace\coveragemap\e2e-tests\tests'

for filename in os.listdir(directory):
    if not filename.endswith('.spec.ts'):
        continue
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match lines like:
    #     firstNode.dispatchEvent('pointerdown', { bubbles: true }); await firstNode.dispatchEvent('pointerup', { bubbles: true }); await firstNode.dispatchEvent('click', { bubbles: true });
    
    content = re.sub(r'(\s+)(firstNode|nodeA|nodeB|unassociatedNode|sourceNode|targetNode)\.dispatchEvent\(''pointerdown''.*?;', 
                     r'\1await \2.evaluate(el => { el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Final evaluate patch complete.")
