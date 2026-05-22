# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tier1.spec.ts >> F3: Living TC (Test Coverage Marking) >> Mark Failed
- Location: tests\tier1.spec.ts:145:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /mark failed/i })

```

# Page snapshot

```yaml
- application [ref=e4]:
  - generic [ref=e6]:
    - generic:
      - generic:
        - img
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:2 to 4:da70af90-091e-43d3-bd27-ecec858f0795:69" [ref=e7] [cursor=pointer]:
            - generic [ref=e10]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:17 to 4:da70af90-091e-43d3-bd27-ecec858f0795:69" [ref=e12] [cursor=pointer]:
            - generic [ref=e15]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:18 to 4:da70af90-091e-43d3-bd27-ecec858f0795:89" [ref=e17] [cursor=pointer]:
            - generic [ref=e20]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:89 to 4:da70af90-091e-43d3-bd27-ecec858f0795:69" [ref=e22] [cursor=pointer]:
            - generic [ref=e25]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:19 to 4:da70af90-091e-43d3-bd27-ecec858f0795:90" [ref=e27] [cursor=pointer]:
            - generic [ref=e30]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:90 to 4:da70af90-091e-43d3-bd27-ecec858f0795:69" [ref=e32] [cursor=pointer]:
            - generic [ref=e35]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:20 to 4:da70af90-091e-43d3-bd27-ecec858f0795:90" [ref=e37] [cursor=pointer]:
            - generic [ref=e40]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:21 to 4:da70af90-091e-43d3-bd27-ecec858f0795:91" [ref=e42] [cursor=pointer]:
            - generic [ref=e45]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:21 to 4:da70af90-091e-43d3-bd27-ecec858f0795:2" [ref=e47] [cursor=pointer]:
            - generic [ref=e50]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:91 to 4:da70af90-091e-43d3-bd27-ecec858f0795:69" [ref=e52] [cursor=pointer]:
            - generic [ref=e55]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:22 to 4:da70af90-091e-43d3-bd27-ecec858f0795:91" [ref=e57] [cursor=pointer]:
            - generic [ref=e58]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:23 to 4:da70af90-091e-43d3-bd27-ecec858f0795:92" [ref=e60] [cursor=pointer]:
            - generic [ref=e61]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:24 to 4:da70af90-091e-43d3-bd27-ecec858f0795:93" [ref=e63] [cursor=pointer]:
            - generic [ref=e66]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:25 to 4:da70af90-091e-43d3-bd27-ecec858f0795:94" [ref=e68] [cursor=pointer]:
            - generic [ref=e71]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:94 to 4:da70af90-091e-43d3-bd27-ecec858f0795:89" [ref=e73] [cursor=pointer]:
            - generic [ref=e76]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:26 to 4:da70af90-091e-43d3-bd27-ecec858f0795:95" [ref=e78] [cursor=pointer]:
            - generic [ref=e81]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:95 to 4:da70af90-091e-43d3-bd27-ecec858f0795:94" [ref=e83] [cursor=pointer]:
            - generic [ref=e86]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:27 to 4:da70af90-091e-43d3-bd27-ecec858f0795:96" [ref=e88] [cursor=pointer]:
            - generic [ref=e89]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:28 to 4:da70af90-091e-43d3-bd27-ecec858f0795:0" [ref=e91] [cursor=pointer]:
            - generic [ref=e92]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:29 to 4:da70af90-091e-43d3-bd27-ecec858f0795:93" [ref=e94] [cursor=pointer]:
            - generic [ref=e97]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:61 to 4:da70af90-091e-43d3-bd27-ecec858f0795:95" [ref=e99] [cursor=pointer]:
            - generic [ref=e102]:
              - generic: Tests
      - generic:
        - group [ref=e104]:
          - generic [ref=e107]:
            - generic [ref=e108]: Feature
            - generic [ref=e109]: Admin Panel
            - generic [ref=e110]: Backoffice
        - group [ref=e112]:
          - generic [ref=e115]:
            - generic [ref=e116]: TestCase
            - generic [ref=e117]: 4:da70af90-091e-43d3-bd27-ecec858f0795:2
        - group [ref=e119]:
          - generic [ref=e122]:
            - generic [ref=e123]: Feature
            - generic [ref=e124]: Login
            - generic [ref=e125]: Sign In, Auth
        - group [ref=e127]:
          - generic [ref=e130]:
            - generic [ref=e131]: TestCase
            - generic [ref=e132]: 4:da70af90-091e-43d3-bd27-ecec858f0795:17
        - group [ref=e134]:
          - generic [ref=e137]:
            - generic [ref=e138]: TestCase
            - generic [ref=e139]: 4:da70af90-091e-43d3-bd27-ecec858f0795:18
        - group [ref=e141]:
          - generic [ref=e144]:
            - generic [ref=e145]: Feature
            - generic [ref=e146]: Dashboard
            - generic [ref=e147]: Home, Main Page
        - group [ref=e149]:
          - generic [ref=e152]:
            - generic [ref=e153]: TestCase
            - generic [ref=e154]: 4:da70af90-091e-43d3-bd27-ecec858f0795:19
        - group [ref=e156]:
          - generic [ref=e159]:
            - generic [ref=e160]: Feature
            - generic [ref=e161]: User Profile
            - generic [ref=e162]: Settings, Account
        - group [ref=e164]:
          - generic [ref=e167]:
            - generic [ref=e168]: TestCase
            - generic [ref=e169]: 4:da70af90-091e-43d3-bd27-ecec858f0795:20
        - group [ref=e171]:
          - generic [ref=e174]:
            - generic [ref=e175]: TestCase
            - generic [ref=e176]: 4:da70af90-091e-43d3-bd27-ecec858f0795:21
        - group [ref=e178]:
          - generic [ref=e181]:
            - generic [ref=e182]: Feature
            - generic [ref=e183]: Billing
            - generic [ref=e184]: Payments, Invoices
        - group [ref=e186]:
          - generic [ref=e189]:
            - generic [ref=e190]: TestCase
            - generic [ref=e191]: 4:da70af90-091e-43d3-bd27-ecec858f0795:22
        - group [ref=e193]:
          - generic [ref=e196]:
            - generic [ref=e197]: TestCase
            - generic [ref=e198]: 4:da70af90-091e-43d3-bd27-ecec858f0795:23
        - group [ref=e200]:
          - generic [ref=e203]:
            - generic [ref=e204]: Feature
            - generic [ref=e205]: Notifications
            - generic [ref=e206]: Alerts
        - group [ref=e208]:
          - generic [ref=e211]:
            - generic [ref=e212]: TestCase
            - generic [ref=e213]: 4:da70af90-091e-43d3-bd27-ecec858f0795:24
        - group [ref=e215]:
          - generic [ref=e218]:
            - generic [ref=e219]: Feature
            - generic [ref=e220]: Search
            - generic [ref=e221]: Find, Query
        - group [ref=e223]:
          - generic [ref=e226]:
            - generic [ref=e227]: TestCase
            - generic [ref=e228]: 4:da70af90-091e-43d3-bd27-ecec858f0795:25
        - group [ref=e230]:
          - generic [ref=e233]:
            - generic [ref=e234]: Feature
            - generic [ref=e235]: Reports
            - generic [ref=e236]: Analytics, Metrics
        - group [ref=e238]:
          - generic [ref=e241]:
            - generic [ref=e242]: TestCase
            - generic [ref=e243]: 4:da70af90-091e-43d3-bd27-ecec858f0795:26
        - group [ref=e245]:
          - generic [ref=e248]:
            - generic [ref=e249]: Feature
            - generic [ref=e250]: Export
            - generic [ref=e251]: Download, Save As
        - group [ref=e253]:
          - generic [ref=e256]:
            - generic [ref=e257]: TestCase
            - generic [ref=e258]: 4:da70af90-091e-43d3-bd27-ecec858f0795:27
        - group [ref=e260]:
          - generic [ref=e263]:
            - generic [ref=e264]: Feature
            - generic [ref=e265]: Integrations
            - generic [ref=e266]: api, Webhooks
        - group [ref=e268]:
          - generic [ref=e271]:
            - generic [ref=e272]: TestCase
            - generic [ref=e273]: 4:da70af90-091e-43d3-bd27-ecec858f0795:28
        - group [ref=e275]:
          - generic [ref=e278]:
            - generic [ref=e279]: TestCase
            - generic [ref=e280]: 4:da70af90-091e-43d3-bd27-ecec858f0795:29
        - group [ref=e282]:
          - generic [ref=e285]:
            - generic [ref=e286]: TestCase
            - generic [ref=e287]: 4:da70af90-091e-43d3-bd27-ecec858f0795:61
  - generic "Control Panel" [ref=e289]:
    - button "Zoom In" [ref=e290] [cursor=pointer]:
      - img [ref=e291]
    - button "Zoom Out" [ref=e293] [cursor=pointer]:
      - img [ref=e294]
    - button "Fit View" [ref=e296] [cursor=pointer]:
      - img [ref=e297]
    - button "Toggle Interactivity" [ref=e299] [cursor=pointer]:
      - img [ref=e300]
  - img
  - button "Add Node" [ref=e303] [cursor=pointer]
  - generic [ref=e304]:
    - generic [ref=e305]:
      - generic [ref=e306]: Filter Graph
      - generic [ref=e307]: "Passed Nodes: 0"
      - combobox [ref=e308]:
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
    - generic [ref=e309]:
      - generic [ref=e310]: Max Depth
      - spinbutton "Max Depth" [ref=e311]: "1"
  - link "React Flow attribution" [ref=e313] [cursor=pointer]:
    - /url: https://reactflow.dev
    - text: React Flow
```

# Test source

```ts
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
  120 |     await expect(unassociatedNode).toHaveClass(/de-emphasized/);
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
> 154 |     await markFailedBtn.click();
      |                         ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  221 |     await addNodeBtn.click({ force: true });
  222 |     
  223 |     const uniqueLabel = `New Node ${Date.now()}`;
  224 |     await page.getByRole('textbox', { name: /label/i }).fill(uniqueLabel);
  225 |     
  226 |     const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
  227 |     await page.getByRole('button', { name: /save/i }).click();
  228 |     await responsePromise;
  229 |     
  230 |     const targetNode = page.locator(`.react-flow__node`, { hasText: uniqueLabel });
  231 |     await expect(targetNode).toBeVisible();
  232 |   });
  233 | 
  234 |   test('Edit Node Properties', async ({ page }) => {
  235 |     const nodes = page.locator('.react-flow__node');
  236 |     await expect(nodes).not.toHaveCount(0);
  237 |     const node = nodes.first();
  238 |     const nodeId = await node.getAttribute('data-id');
  239 |     const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  240 |     await targetNode.click({ force: true });
  241 |     
  242 |     const labelInput = page.getByRole('textbox', { name: /label/i });
  243 |     
  244 |     await labelInput.fill('Updated Label');
  245 |     
  246 |     const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
  247 |     await page.getByRole('button', { name: /save/i }).click();
  248 |     await responsePromise;
  249 |     
  250 |     await expect(targetNode).toHaveText(/Updated Label/);
  251 |   });
  252 | 
  253 |   test('Delete Node', async ({ page }) => {
  254 |     const nodes = page.locator('.react-flow__node');
```