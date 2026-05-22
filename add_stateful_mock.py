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

    // We also need to intercept POST to update our fake local state so GET returns them!
    await page.route('**/api/graph/node', async route => {
      if (route.request().method() === 'POST') {
        const postData = JSON.parse(route.request().postData());
        const newNode = { id: 'node-' + Math.random(), label: postData.label, status: 'Untested' };
        fakeNodes.push(newNode);
        await route.continue();
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/graph/edge', async route => {
      if (route.request().method() === 'POST') {
        const postData = JSON.parse(route.request().postData());
        const newEdge = { id: 'edge-' + Math.random(), source: postData.source_id, target: postData.target_id, status: 'Untested' };
        fakeEdges.push(newEdge);
        await route.continue();
      } else {
        await route.continue();
      }
    });

    const initGraph = page.waitForResponse(res => res.url().includes('/api/graph') && res.request().method() === 'GET');
    await page.goto('/');
    await initGraph;'''

content = re.sub(r"const initGraph = page\.waitForResponse.*?await initGraph;", mock_code, content, flags=re.DOTALL)

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
