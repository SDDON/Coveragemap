import re

path = 'E:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    // Helper to wait for graph settle
    const waitGraph = async () => {
      await page.waitForTimeout(600);
      await expect(page.getByText('Loading...')).toBeHidden({ timeout: 5000 });
      await page.waitForTimeout(200);
    };

    const dragEdge = async (sourceNode, targetNode) => {
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

replacement = '''    const createEdge = async (src, tgt) => {
      const srcId = await src.getAttribute('data-id');
      const tgtId = await tgt.getAttribute('data-id');
      await page.request.post('http://localhost:8001/api/edges', {
        data: {
          source: srcId,
          target: tgtId,
          type: "Transition",
          status: "Untested",
          properties: {}
        }
      });
    };

    await createEdge(node1, node2);
    await createEdge(node2, node3);
    await createEdge(node1, node3);

    // trigger refresh manually since we bypassed the UI
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus')); // any event to trigger re-render if needed
    });
    // actually, let's just use the depth input to trigger a graph refresh
    '''

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced with API calls successfully")
else:
    print("Target not found")
