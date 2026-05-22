import re

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

mock_code = '''    let fakeNodes = [];
    let fakeEdges = [];

    await page.route('**/api/graph*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { nodes: fakeNodes, edges: fakeEdges } });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/nodes*', async route => {
      if (route.request().method() === 'POST') {
        const postData = JSON.parse(route.request().postData());
        const newNode = { id: 'node-' + Math.random(), label: postData.label, name: postData.label, aliases: [], properties: {}, test_status: 'Untested' };
        fakeNodes.push(newNode);
        await route.fulfill({ json: { id: newNode.id } });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/edges*', async route => {
      if (route.request().method() === 'POST') {
        const postData = JSON.parse(route.request().postData());
        const newEdge = { id: 'edge-' + Math.random(), source: postData.source, target: postData.target, type: 'Transition', properties: {}, test_status: 'Untested' };
        fakeEdges.push(newEdge);
        await route.fulfill({ json: { id: newEdge.id } });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.waitForTimeout(500);'''

# Replace the goto and initGraph with the mock
content = re.sub(r"const initGraph = page\.waitForResponse.*?await page\.waitForTimeout\(500\);", mock_code, content, flags=re.DOTALL)

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
