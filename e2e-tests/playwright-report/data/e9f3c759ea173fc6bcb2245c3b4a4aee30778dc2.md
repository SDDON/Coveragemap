# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui_iter3_stress_test.spec.ts >> Iteration 3 UI Enhancements Stress Test >> verify Focus+Context, Directional Colors, and Full-boundary connections
- Location: tests\ui_iter3_stress_test.spec.ts:16:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.waitForResponse: Test timeout of 120000ms exceeded.
```

# Page snapshot

```yaml
- application [ref=e4]:
  - generic [ref=e6]:
    - generic:
      - generic:
        - group [ref=e7]:
          - generic [ref=e10]:
            - generic [ref=e11]: Screen
            - generic [ref=e12]: TestNode1
        - group [ref=e14]:
          - generic [ref=e17]:
            - generic [ref=e18]: Screen
            - generic [ref=e19]: TestNode2
        - group [ref=e21]:
          - generic [ref=e24]:
            - generic [ref=e25]: Screen
            - generic [ref=e26]: TestNode3
  - generic "Control Panel" [ref=e28]:
    - button "Zoom In" [ref=e29] [cursor=pointer]:
      - img [ref=e30]
    - button "Zoom Out" [ref=e32] [cursor=pointer]:
      - img [ref=e33]
    - button "Fit View" [ref=e35] [cursor=pointer]:
      - img [ref=e36]
    - button "Toggle Interactivity" [ref=e38] [cursor=pointer]:
      - img [ref=e39]
  - img
  - generic [ref=e42]:
    - button "Add Node" [ref=e43] [cursor=pointer]
    - button "?" [ref=e44] [cursor=pointer]
    - button "⟳ Re-layout" [ref=e45] [cursor=pointer]
    - button "🗂 Grid Layout" [ref=e46] [cursor=pointer]
  - generic [ref=e47]:
    - generic [ref=e48]:
      - generic [ref=e49]: Filter Graph
      - generic [ref=e50]: "Passed Nodes: 0"
      - combobox "Filter Graph" [ref=e51]:
        - option "All aliases..." [selected]
        - option "Account"
        - option "Alerts"
        - option "Analytics"
        - option "Auth"
        - option "Backoffice"
        - option "Download"
        - option "Find"
        - option "Home"
        - option "Invoices"
        - option "Main Page"
        - option "Metrics"
        - option "Payments"
        - option "Query"
        - option "Save As"
        - option "Settings"
        - option "Sign In"
        - option "Webhooks"
        - option "api"
        - option "synonym_xyz"
        - option "synonym_abc"
        - option "Arena"
        - option "Shop"
        - option "Inventory"
    - generic [ref=e52]:
      - generic [ref=e53]: Search Highlight
      - textbox "Type to highlight nodes..." [ref=e54]
    - generic [ref=e55]:
      - generic [ref=e56]: Visibility Filter
      - generic [ref=e57]:
        - generic [ref=e58] [cursor=pointer]:
          - checkbox "Screen" [checked] [ref=e59]
          - text: Screen
        - generic [ref=e60] [cursor=pointer]:
          - checkbox "Component" [checked] [ref=e61]
          - text: Component
        - generic [ref=e62] [cursor=pointer]:
          - checkbox "TestCase" [checked] [ref=e63]
          - text: TestCase
        - generic [ref=e64] [cursor=pointer]:
          - checkbox "Data" [checked] [ref=e65]
          - text: Data
    - generic [ref=e66]:
      - generic [ref=e67]: Max Depth
      - spinbutton "Max Depth" [active] [ref=e68]: "2"
  - link "React Flow attribution" [ref=e70] [cursor=pointer]:
    - /url: https://reactflow.dev
    - text: React Flow
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.beforeEach(async ({ page }) => {
  4   |   page.on('framenavigated', async () => {
  5   |     try {
  6   |       const heavyBtn = page.getByRole('button', { name: /전체 그래프 로드/i });
  7   |       await heavyBtn.waitFor({ state: 'visible', timeout: 1500 });
  8   |       await heavyBtn.click({ force: true });
  9   |     } catch (e) {
  10  |       // Ignore if button is not present
  11  |     }
  12  |   });
  13  | });
  14  | 
  15  | test.describe('Iteration 3 UI Enhancements Stress Test', () => {
  16  |   test('verify Focus+Context, Directional Colors, and Full-boundary connections', async ({ page }) => {
  17  |     test.setTimeout(120000);
  18  |                 let fakeNodes = [];
  19  |     let fakeEdges = [];
  20  | 
  21  |     await page.route('**/api/graph*', async route => {
  22  |       if (route.request().method() === 'GET') {
  23  |         await route.fulfill({ json: { nodes: fakeNodes, edges: fakeEdges } });
  24  |       } else {
  25  |         await route.continue();
  26  |       }
  27  |     });
  28  | 
  29  |     await page.route('**/api/nodes*', async route => {
  30  |       if (route.request().method() === 'POST') {
  31  |         const postData = JSON.parse(route.request().postData());
  32  |         const newNode = { id: 'node-' + Math.random(), label: postData.label, name: postData.name || postData.label, aliases: [], properties: {}, test_status: 'Untested' };
  33  |         fakeNodes.push(newNode);
  34  |         await route.fulfill({ json: newNode.id });
  35  |       } else {
  36  |         await route.continue();
  37  |       }
  38  |     });
  39  | 
  40  |     await page.route('**/api/edges*', async route => {
  41  |       if (route.request().method() === 'POST') {
  42  |         const postData = JSON.parse(route.request().postData());
  43  |         const newEdge = { id: 'edge-' + Math.random(), source: postData.source, target: postData.target, type: 'Transition', properties: {}, test_status: 'Untested' };
  44  |         fakeEdges.push(newEdge);
  45  |         await route.fulfill({ json: { id: newEdge.id } });
  46  |       } else {
  47  |         await route.continue();
  48  |       }
  49  |     });
  50  | 
  51  |     await page.goto('/');
  52  |     await page.waitForTimeout(500);
  53  | 
  54  |     const createNode = async (name) => {
  55  |       await page.click('button:has-text("Add Node")');
  56  |       const nameInput = page.locator('#nodeName');
  57  |       await expect(nameInput).toBeVisible({ timeout: 3000 });
  58  |       await nameInput.fill(name);
  59  |       await page.click('button:has-text("Save")');
  60  |       await page.waitForTimeout(500);
  61  |     };
  62  | 
  63  |     await createNode('TestNode1'); await createNode('TestNode2'); await createNode('TestNode3');
  64  | 
  65  |     const node1 = page.locator('.react-flow__node:has-text("TestNode1")').first();
  66  |     const node2 = page.locator('.react-flow__node:has-text("TestNode2")').first();
  67  |     const node3 = page.locator('.react-flow__node:has-text("TestNode3")').first();
  68  | 
  69  |     await expect(node1).toBeVisible(); await expect(node2).toBeVisible(); await expect(node3).toBeVisible();
  70  | 
  71  |     await page.locator('.react-flow__controls-fitview').click();
  72  |     await page.waitForTimeout(500);
  73  | 
  74  |     
  75  |     const createEdge = async (src, tgt) => {
  76  |       const sId = await src.getAttribute('data-id');
  77  |       const tId = await tgt.getAttribute('data-id');
  78  |       await page.evaluate(async ({ s, t }) => {
  79  |         await fetch('/api/edges', {
  80  |           method: 'POST',
  81  |           headers: { 'Content-Type': 'application/json' },
  82  |           body: JSON.stringify({ source: s, target: t, type: 'Transition', test_status: 'Untested', properties: {} })
  83  |         });
  84  |       }, { s: sId, t: tId });
  85  |       await page.waitForTimeout(100);
  86  |     };
  87  | 
  88  |     await createEdge(node1, node2);
  89  |     await createEdge(node2, node3);
  90  |     await createEdge(node1, node3);
  91  | 
> 92  |     const filterSelect = page.getByRole('combobox', { name: /Filter Graph/i });
      |                               ^ Error: page.waitForResponse: Test timeout of 120000ms exceeded.
  93  |     await filterSelect.selectOption({ index: 1 });
  94  |     await page.waitForTimeout(500);
  95  | 
  96  |     const depthPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.request().method()==='GET');
  97  |     await page.fill('input[type="number"]', '2');
  98  |     await depthPromise;
  99  |     await page.waitForTimeout(500);
  100 | 
  101 |     await node1.click();
  102 |     await page.waitForTimeout(500);
  103 | 
  104 |     const reactFlow = page.locator('.react-flow').first();
  105 |     await expect(reactFlow).toHaveClass(/.*has-selection.*/);
  106 |     await expect(node1).toHaveClass(/.*active.*/);
  107 |     await expect(node2).toHaveClass(/.*active.*/);
  108 |     await expect(node2).toHaveClass(/.*highlight-outgoing.*/);
  109 |     await expect(node3).toHaveClass(/.*active.*/);
  110 |     await expect(node3).toHaveClass(/.*highlight-outgoing.*/);
  111 | 
  112 |     const activeEdges = page.locator('.react-flow__edge.active.highlight-edge');
  113 |     expect(await activeEdges.count()).toBeGreaterThanOrEqual(3);
  114 | 
  115 |     await page.mouse.click(10, 10);
  116 |     await page.waitForTimeout(500);
  117 | 
  118 |     await node2.click();
  119 |     await page.waitForTimeout(500);
  120 | 
  121 |     await expect(node1).toHaveClass(/.*highlight-incoming.*/);
  122 |     await expect(node3).toHaveClass(/.*highlight-outgoing.*/);
  123 |   });
  124 | });
  125 | 
```