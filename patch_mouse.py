import re

path = 'E:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    // node1 -> node2
    await node1.locator('.react-flow__handle-bottom').dragTo(node2.locator('.react-flow__handle-top'), { force: true });
    await waitGraph();

    // node2 -> node3
    await node2.locator('.react-flow__handle-bottom').dragTo(node3.locator('.react-flow__handle-top'), { force: true });
    await waitGraph();

    // node1 -> node3
    await node1.locator('.react-flow__handle-bottom').dragTo(node3.locator('.react-flow__handle-top'), { force: true });
    await waitGraph();'''

replacement = '''    const dragEdge = async (sourceNode, targetNode) => {
      const srcBox = await sourceNode.boundingBox();
      const tgtBox = await targetNode.boundingBox();
      if (!srcBox || !tgtBox) throw new Error('Bounding boxes not found');
      
      // Move to center of bottom handle
      await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height - 2);
      await page.mouse.down();
      // Move to center of top handle
      await page.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + 2, { steps: 5 });
      await page.mouse.up();
      await waitGraph();
    };

    // node1 -> node2
    await dragEdge(node1, node2);

    // node2 -> node3
    await dragEdge(node2, node3);

    // node1 -> node3
    await dragEdge(node1, node3);'''

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Reverted to mouse coordinates successfully")
else:
    print("Target not found")
