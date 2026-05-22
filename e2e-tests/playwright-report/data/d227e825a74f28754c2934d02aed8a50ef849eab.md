# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tier1.spec.ts >> F2: Core Visualization (Focus+Context) >> Path Selection (Coverage scope view)
- Location: tests\tier1.spec.ts:99:7

# Error details

```
Error: expect(locator).toHaveClass(expected) failed

Locator: locator('.react-flow__node:not([data-id="4:da70af90-091e-43d3-bd27-ecec858f0795:45"]):not([data-id="4:da70af90-091e-43d3-bd27-ecec858f0795:64"])').first()
Expected pattern: /de-emphasized/
Received string:  "react-flow__node react-flow__node-custom nopan active highlight-incoming status-untested selectable draggable"
Timeout: 5000ms

Call log:
  - Expect "toHaveClass" with timeout 5000ms
  - waiting for locator('.react-flow__node:not([data-id="4:da70af90-091e-43d3-bd27-ecec858f0795:45"]):not([data-id="4:da70af90-091e-43d3-bd27-ecec858f0795:64"])').first()
    14 × locator resolved to <div tabindex="0" role="group" aria-roledescription="node" aria-describedby="react-flow__node-desc-1" data-id="4:da70af90-091e-43d3-bd27-ecec858f0795:46" data-testid="rf__node-4:da70af90-091e-43d3-bd27-ecec858f0795:46" class="react-flow__node react-flow__node-custom nopan active highlight-incoming status-untested selectable draggable">…</div>
       - unexpected value "react-flow__node react-flow__node-custom nopan active highlight-incoming status-untested selectable draggable"

```

```yaml
- group: TestCase 4:da70af90-091e-43d3-bd27-ecec858f0795:46
```

# Test source

```ts
  20  |     await expect(detailsPanel.locator('.node-id')).not.toBeEmpty();
  21  |     await expect(detailsPanel.locator('.node-label')).not.toBeEmpty();
  22  |   });
  23  | 
  24  |   test('Edge Rendering', async ({ page }) => {
  25  |     await page.goto('/');
  26  |     const edges = page.locator('.react-flow__edge');
  27  |     await expect(edges).not.toHaveCount(0);
  28  |   });
  29  | 
  30  |   test('Backend API Direct Verification', async ({ request }) => {
  31  |     const response = await request.get('/api/graph');
  32  |     expect(response.status()).toBe(200);
  33  |     const body = await response.json();
  34  |     expect(Array.isArray(body.nodes)).toBeTruthy();
  35  |     expect(Array.isArray(body.edges)).toBeTruthy();
  36  |   });
  37  | 
  38  |   test.skip('API Failure Degradation', async ({ page }) => {
  39  |     await page.route('**/api/graph', async route => await route.abort('failed'));
  40  |     await page.goto('/');
  41  |     const errorToast = page.locator('.error-toast, .empty-state-message');
  42  |     await expect(errorToast).toBeVisible();
  43  |   });
  44  | });
  45  | 
  46  | test.describe('F2: Core Visualization (Focus+Context)', () => {
  47  |   test('Focus Node Dimming', async ({ page }) => {
  48  |     await page.goto('/');
  49  |     const firstNode = page.locator('.react-flow__node').first();
  50  |     await firstNode.click({ force: true });
  51  |     
  52  |     await expect(firstNode).toHaveClass(/active/);
  53  |     const otherNodes = page.locator('.react-flow__node:not(.active)');
  54  |     await expect(otherNodes.first()).toHaveClass(/de-emphasized/);
  55  |   });
  56  | 
  57  |   test('Restore Context', async ({ page }) => {
  58  |     await page.goto('/');
  59  |     const firstNode = page.locator('.react-flow__node').first();
  60  |     await firstNode.click({ force: true });
  61  |     await page.locator('.react-flow__pane').click();
  62  |     
  63  |     const nodes = page.locator('.react-flow__node');
  64  |     await expect(nodes.first()).not.toHaveClass(/de-emphasized/);
  65  |   });
  66  | 
  67  |   test.skip('Shift Focus', async ({ page }) => {
  68  |     await page.goto('/');
  69  |     const nodes = page.locator('.react-flow__node');
  70  |     const nodeA = nodes.first();
  71  |     const nodeAId = await nodeA.getAttribute('data-id');
  72  |     const nodeB = page.locator(`.react-flow__node:not([data-id="${nodeAId}"])`).first();
  73  |     await expect(nodeB).not.toHaveCount(0);
  74  |     
  75  |     await nodeA.click();
  76  |     await nodeB.click();
  77  |     
  78  |     await expect(nodeB).toHaveClass(/active/);
  79  |     await expect(nodeA).toHaveClass(/de-emphasized/);
  80  |   });
  81  | 
  82  |   test('Edge Highlighting', async ({ page }) => {
  83  |     await page.goto('/');
  84  |     const edge = page.locator('.react-flow__edge').first();
  85  |     const ariaLabel = await edge.getAttribute('aria-label');
  86  |     const match = ariaLabel?.match(/Edge from (.+) to (.+)/);
  87  |     const sourceId = match ? match[1] : null;
  88  |     const targetId = match ? match[2] : null;
  89  |     expect(sourceId).toBeTruthy();
  90  |     expect(targetId).toBeTruthy();
  91  |     
  92  |     const unassociatedNode = page.locator(`.react-flow__node:not([data-id="${sourceId}"]):not([data-id="${targetId}"])`).first();
  93  |     await expect(unassociatedNode).not.toHaveCount(0);
  94  |     await unassociatedNode.click();
  95  |     
  96  |     await expect(edge).toHaveClass(/de-emphasized/);
  97  |   });
  98  | 
  99  |   test('Path Selection (Coverage scope view)', async ({ page }) => {
  100 |     await page.goto('/');
  101 |     await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
  102 |     const edge = page.locator('.react-flow__edge').first();
  103 |     const ariaLabel = await edge.getAttribute('aria-label');
  104 |     const match = ariaLabel?.match(/Edge from (.+) to (.+)/);
  105 |     const sourceId = match ? match[1] : null;
  106 |     const targetId = match ? match[2] : null;
  107 |     expect(sourceId).toBeTruthy();
  108 |     expect(targetId).toBeTruthy();
  109 |     
  110 |     const sourceNode = page.locator(`.react-flow__node[data-id="${sourceId}"]`);
  111 |     const targetNode = page.locator(`.react-flow__node[data-id="${targetId}"]`);
  112 |     const unassociatedNode = page.locator(`.react-flow__node:not([data-id="${sourceId}"]):not([data-id="${targetId}"])`).first();
  113 |     await expect(unassociatedNode).not.toHaveCount(0);
  114 |     
  115 |     await sourceNode.click({ force: true });
  116 |     await targetNode.click({ force: true });
  117 |     
  118 |     await expect(sourceNode).toHaveClass(/active/);
  119 |     await expect(targetNode).toHaveClass(/active/);
> 120 |     await expect(unassociatedNode).toHaveClass(/de-emphasized/);
      |                                    ^ Error: expect(locator).toHaveClass(expected) failed
  121 |   });
  122 | });
  123 | 
  124 | test.describe('F3: Living TC (Test Coverage Marking)', () => {
  125 |   test.beforeEach(async ({ page, request }) => {
  126 |     await request.post('/api/dev/reset-seed');
  127 |     const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
  128 |     await page.goto('/');
  129 |     await responsePromise;
  130 |   });
  131 | 
  132 |   test('Mark Passed', async ({ page }) => {
  133 |     await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
  134 |     const untestedNode = page.locator('.react-flow__node').first();
  135 |     const nodeId = await untestedNode.getAttribute('data-id');
  136 |     const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  137 |     await targetNode.click({ force: true });
  138 |     
  139 |     const markPassedBtn = page.getByRole('button', { name: /mark passed/i });
  140 |     await markPassedBtn.click({ force: true });
  141 |     
  142 |     await expect(targetNode).toHaveClass(/status-passed/);
  143 |   });
  144 | 
  145 |   test('Mark Failed', async ({ page }) => {
  146 |     await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
  147 |     const node = page.locator('.react-flow__node').first();
  148 |     const nodeId = await node.getAttribute('data-id');
  149 |     const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  150 |     
  151 |     await targetNode.click({ force: true });
  152 |     
  153 |     const markFailedBtn = page.getByRole('button', { name: /mark failed/i });
  154 |     await markFailedBtn.click();
  155 |     
  156 |     await expect(targetNode).toHaveClass(/status-failed/);
  157 |   });
  158 | 
  159 |   test('Mark Edge Passed', async ({ page }) => {
  160 |     await expect(page.locator('.react-flow__edge')).not.toHaveCount(0);
  161 |     const edge = page.locator('.react-flow__edge').first();
  162 |     const edgeId = await edge.getAttribute('data-id');
  163 |     const targetEdge = page.locator(`.react-flow__edge[data-id="${edgeId}"]`);
  164 |     
  165 |     await targetEdge.click({ force: true });
  166 |     
  167 |     const markPassedBtn = page.getByRole('button', { name: /mark passed/i });
  168 |     await markPassedBtn.click({ force: true });
  169 |     
  170 |     // Ignore flaky class check on edge
  171 |   });
  172 | 
  173 |   test('Reset Status', async ({ page }) => {
  174 |     await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
  175 |     const node = page.locator('.react-flow__node').first();
  176 |     const nodeId = await node.getAttribute('data-id');
  177 |     const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  178 |     
  179 |     await targetNode.click({ force: true });
  180 |     await page.getByRole('button', { name: /mark passed/i }).click();
  181 |     await expect(targetNode).toHaveClass(/status-passed/);
  182 |     
  183 |     const resetStatusBtn = page.getByRole('button', { name: /reset status/i });
  184 |     await resetStatusBtn.click();
  185 |     
  186 |     await expect(targetNode).toHaveClass(/status-untested/);
  187 |   });
  188 | 
  189 |   test('Coverage Metrics Update', async ({ page }) => {
  190 |     const nodes = page.locator('.react-flow__node');
  191 |     await expect(nodes).not.toHaveCount(0);
  192 |     
  193 |     const passedCount = page.locator('.metrics-passed-count');
  194 |     await expect(passedCount).toHaveText(/\d+/);
  195 |     const initialText = await passedCount.innerText();
  196 |     const initialCount = parseInt(initialText, 10);
  197 |     
  198 |     const untestedNode = page.locator('.react-flow__node').first();
  199 |     const nodeId = await untestedNode.getAttribute('data-id');
  200 |     const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  201 |     await targetNode.click({ force: true });
  202 |     await page.getByRole('button', { name: /mark passed/i }).click();
  203 |     
  204 |     await expect(passedCount).toHaveText((initialCount + 1).toString());
  205 |   });
  206 | });
  207 | 
  208 | test.describe('F4: Graph Editing (Nodes & Edges)', () => {
  209 |   test.beforeEach(async ({ page, request }) => {
  210 |     await request.post('/api/dev/reset-seed');
  211 |     const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
  212 |     await page.goto('/');
  213 |     await responsePromise;
  214 |   });
  215 | 
  216 |   test('Add Node', async ({ page }) => {
  217 |     const nodes = page.locator('.react-flow__node');
  218 |     await expect(nodes).not.toHaveCount(0);
  219 | 
  220 |     const addNodeBtn = page.getByRole('button', { name: /add node/i });
```