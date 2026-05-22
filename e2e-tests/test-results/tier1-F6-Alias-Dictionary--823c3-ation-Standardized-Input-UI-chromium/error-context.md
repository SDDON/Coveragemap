# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tier1.spec.ts >> F6: Alias Dictionary (Standardization) >> Standardized Input UI
- Location: tests\tier1.spec.ts:435:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /node category/i })

```

# Page snapshot

```yaml
- application [ref=e4]:
  - generic [ref=e6]:
    - generic:
      - generic:
        - img
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:46 to 4:da70af90-091e-43d3-bd27-ecec858f0795:66" [ref=e7] [cursor=pointer]:
            - generic [ref=e10]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:47 to 4:da70af90-091e-43d3-bd27-ecec858f0795:66" [ref=e12] [cursor=pointer]:
            - generic [ref=e15]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:48 to 4:da70af90-091e-43d3-bd27-ecec858f0795:70" [ref=e17] [cursor=pointer]:
            - generic [ref=e20]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:70 to 4:da70af90-091e-43d3-bd27-ecec858f0795:66" [ref=e22] [cursor=pointer]:
            - generic [ref=e25]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:49 to 4:da70af90-091e-43d3-bd27-ecec858f0795:71" [ref=e27] [cursor=pointer]:
            - generic [ref=e30]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:71 to 4:da70af90-091e-43d3-bd27-ecec858f0795:66" [ref=e32] [cursor=pointer]:
            - generic [ref=e35]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:50 to 4:da70af90-091e-43d3-bd27-ecec858f0795:71" [ref=e37] [cursor=pointer]:
            - generic [ref=e40]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:51 to 4:da70af90-091e-43d3-bd27-ecec858f0795:46" [ref=e42] [cursor=pointer]:
            - generic [ref=e45]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:51 to 4:da70af90-091e-43d3-bd27-ecec858f0795:97" [ref=e47] [cursor=pointer]:
            - generic [ref=e50]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:97 to 4:da70af90-091e-43d3-bd27-ecec858f0795:66" [ref=e52] [cursor=pointer]:
            - generic [ref=e55]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:52 to 4:da70af90-091e-43d3-bd27-ecec858f0795:97" [ref=e57] [cursor=pointer]:
            - generic [ref=e58]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:53 to 4:da70af90-091e-43d3-bd27-ecec858f0795:98" [ref=e60] [cursor=pointer]:
            - generic [ref=e61]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:54 to 4:da70af90-091e-43d3-bd27-ecec858f0795:99" [ref=e63] [cursor=pointer]:
            - generic [ref=e66]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:55 to 4:da70af90-091e-43d3-bd27-ecec858f0795:100" [ref=e68] [cursor=pointer]:
            - generic [ref=e71]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:100 to 4:da70af90-091e-43d3-bd27-ecec858f0795:70" [ref=e73] [cursor=pointer]:
            - generic [ref=e76]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:56 to 4:da70af90-091e-43d3-bd27-ecec858f0795:101" [ref=e78] [cursor=pointer]:
            - generic [ref=e81]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:101 to 4:da70af90-091e-43d3-bd27-ecec858f0795:100" [ref=e83] [cursor=pointer]:
            - generic [ref=e86]:
              - generic: Depends_On
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:57 to 4:da70af90-091e-43d3-bd27-ecec858f0795:102" [ref=e88] [cursor=pointer]:
            - generic [ref=e89]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:58 to 4:da70af90-091e-43d3-bd27-ecec858f0795:45" [ref=e91] [cursor=pointer]:
            - generic [ref=e92]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:59 to 4:da70af90-091e-43d3-bd27-ecec858f0795:99" [ref=e94] [cursor=pointer]:
            - generic [ref=e97]:
              - generic: Tests
        - img:
          - group "Edge from 4:da70af90-091e-43d3-bd27-ecec858f0795:60 to 4:da70af90-091e-43d3-bd27-ecec858f0795:101" [ref=e99] [cursor=pointer]:
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
            - generic [ref=e117]: 4:da70af90-091e-43d3-bd27-ecec858f0795:46
        - group [ref=e119]:
          - generic [ref=e122]:
            - generic [ref=e123]: Feature
            - generic [ref=e124]: Login
            - generic [ref=e125]: Sign In, Auth
        - group [ref=e127]:
          - generic [ref=e130]:
            - generic [ref=e131]: TestCase
            - generic [ref=e132]: 4:da70af90-091e-43d3-bd27-ecec858f0795:47
        - group [ref=e134]:
          - generic [ref=e137]:
            - generic [ref=e138]: TestCase
            - generic [ref=e139]: 4:da70af90-091e-43d3-bd27-ecec858f0795:48
        - group [ref=e141]:
          - generic [ref=e144]:
            - generic [ref=e145]: Feature
            - generic [ref=e146]: Dashboard
            - generic [ref=e147]: Home, Main Page
        - group [ref=e149]:
          - generic [ref=e152]:
            - generic [ref=e153]: TestCase
            - generic [ref=e154]: 4:da70af90-091e-43d3-bd27-ecec858f0795:49
        - group [ref=e156]:
          - generic [ref=e159]:
            - generic [ref=e160]: Feature
            - generic [ref=e161]: User Profile
            - generic [ref=e162]: Settings, Account
        - group [ref=e164]:
          - generic [ref=e167]:
            - generic [ref=e168]: TestCase
            - generic [ref=e169]: 4:da70af90-091e-43d3-bd27-ecec858f0795:50
        - group [ref=e171]:
          - generic [ref=e174]:
            - generic [ref=e175]: TestCase
            - generic [ref=e176]: 4:da70af90-091e-43d3-bd27-ecec858f0795:51
        - group [ref=e178]:
          - generic [ref=e181]:
            - generic [ref=e182]: Feature
            - generic [ref=e183]: Billing
            - generic [ref=e184]: Payments, Invoices
        - group [ref=e186]:
          - generic [ref=e189]:
            - generic [ref=e190]: TestCase
            - generic [ref=e191]: 4:da70af90-091e-43d3-bd27-ecec858f0795:52
        - group [ref=e193]:
          - generic [ref=e196]:
            - generic [ref=e197]: TestCase
            - generic [ref=e198]: 4:da70af90-091e-43d3-bd27-ecec858f0795:53
        - group [ref=e200]:
          - generic [ref=e203]:
            - generic [ref=e204]: Feature
            - generic [ref=e205]: Notifications
            - generic [ref=e206]: Alerts
        - group [ref=e208]:
          - generic [ref=e211]:
            - generic [ref=e212]: TestCase
            - generic [ref=e213]: 4:da70af90-091e-43d3-bd27-ecec858f0795:54
        - group [ref=e215]:
          - generic [ref=e218]:
            - generic [ref=e219]: Feature
            - generic [ref=e220]: Search
            - generic [ref=e221]: Find, Query
        - group [ref=e223]:
          - generic [ref=e226]:
            - generic [ref=e227]: TestCase
            - generic [ref=e228]: 4:da70af90-091e-43d3-bd27-ecec858f0795:55
        - group [ref=e230]:
          - generic [ref=e233]:
            - generic [ref=e234]: Feature
            - generic [ref=e235]: Reports
            - generic [ref=e236]: Analytics, Metrics
        - group [ref=e238]:
          - generic [ref=e241]:
            - generic [ref=e242]: TestCase
            - generic [ref=e243]: 4:da70af90-091e-43d3-bd27-ecec858f0795:56
        - group [ref=e245]:
          - generic [ref=e248]:
            - generic [ref=e249]: Feature
            - generic [ref=e250]: Export
            - generic [ref=e251]: Download, Save As
        - group [ref=e253]:
          - generic [ref=e256]:
            - generic [ref=e257]: TestCase
            - generic [ref=e258]: 4:da70af90-091e-43d3-bd27-ecec858f0795:57
        - group [ref=e260]:
          - generic [ref=e263]:
            - generic [ref=e264]: Feature
            - generic [ref=e265]: Integrations
            - generic [ref=e266]: api, Webhooks
        - group [ref=e268]:
          - generic [ref=e271]:
            - generic [ref=e272]: TestCase
            - generic [ref=e273]: 4:da70af90-091e-43d3-bd27-ecec858f0795:58
        - group [ref=e275]:
          - generic [ref=e278]:
            - generic [ref=e279]: TestCase
            - generic [ref=e280]: 4:da70af90-091e-43d3-bd27-ecec858f0795:59
        - group [ref=e282]:
          - generic [ref=e285]:
            - generic [ref=e286]: TestCase
            - generic [ref=e287]: 4:da70af90-091e-43d3-bd27-ecec858f0795:60
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
  340 |     
  341 |     const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
  342 |     await depthInput.fill('2');
  343 |     await depthInput.fill('3');
  344 |     await depthInput.fill('4');
  345 |     
  346 |     await page.waitForTimeout(500);
  347 |     expect(requestCount).toBe(1); // Exactly one request should be fired
  348 |   });
  349 | 
  350 |   test('Config Depth Update', async ({ page }) => {
  351 |     await page.goto('/');
  352 |     const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
  353 |     
  354 |     const requestPromise = page.waitForRequest(req => req.url().includes('/api/graph?depth=5'));
  355 |     await depthInput.fill('5');
  356 |     await requestPromise;
  357 |   });
  358 | 
  359 |   test('Show Loading Overlay', async ({ page }) => {
  360 |     let resolveApi: (value?: unknown) => void;
  361 |     const apiPromise = new Promise(r => { resolveApi = r; });
  362 |     await page.route('**/api/graph**', async route => {
  363 |       await apiPromise;
  364 |       await route.continue();
  365 |     });
  366 |     
  367 |     await page.goto('/');
  368 |     const overlay = page.getByTestId('loading-overlay');
  369 |     await expect(overlay).toBeVisible();
  370 |     resolveApi!();
  371 |   });
  372 | 
  373 |   test('Hide Loading Overlay', async ({ page }) => {
  374 |     await page.goto('/');
  375 |     await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
  376 | 
  377 |     let resolveApi: (value?: unknown) => void;
  378 |     const apiPromise = new Promise(r => { resolveApi = r; });
  379 |     
  380 |     await page.route('**/api/graph**', async route => {
  381 |       await apiPromise;
  382 |       await route.continue();
  383 |     });
  384 |     
  385 |     const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
  386 |     await depthInput.fill('5');
  387 |     
  388 |     const overlay = page.getByTestId('loading-overlay');
  389 |     await expect(overlay).toBeVisible();
  390 |     
  391 |     resolveApi!();
  392 |     
  393 |     await expect(overlay).toBeHidden();
  394 |   });
  395 | 
  396 |   test('Block Race Conditions', async ({ page }) => {
  397 |     await page.goto('/');
  398 |     const nodes = page.locator('.react-flow__node');
  399 |     await expect(nodes).not.toHaveCount(0);
  400 |     const node = nodes.first();
  401 |     const nodeId = await node.getAttribute('data-id');
  402 |     const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  403 | 
  404 |     let resolveApi: (value?: unknown) => void;
  405 |     const apiPromise = new Promise(r => { resolveApi = r; });
  406 |     
  407 |     await page.route('**/api/graph**', async route => {
  408 |       await apiPromise;
  409 |       await route.continue();
  410 |     });
  411 |     
  412 |     const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
  413 |     await depthInput.fill('5');
  414 |     
  415 |     const overlay = page.getByTestId('loading-overlay');
  416 |     await expect(overlay).toBeVisible();
  417 |     
  418 |     // FIX: Verify that the overlay natively intercepts the click. DO NOT USE force: true!
  419 |     await expect(targetNode.click({ timeout: 1000 })).rejects.toThrowError(/intercepts pointer events/i);
  420 |     await expect(targetNode).not.toHaveClass(/active/);
  421 |     
  422 |     resolveApi!();
  423 |   });
  424 | });
  425 | 
  426 | test.describe('F6: Alias Dictionary (Standardization)', () => {
  427 |   test('Backend Alias Normalization', async ({ request }) => {
  428 |     const response = await request.get('/api/dictionary?term=synonym_xyz');
  429 |     expect(response.status()).toBe(200);
  430 |     const body = await response.json();
  431 |     expect(body.standardTerm).toBeDefined();
  432 |     expect(body.standardTerm).not.toBe('synonym_xyz');
  433 |   });
  434 | 
  435 |   test('Standardized Input UI', async ({ page }) => {
  436 |     await page.goto('/');
  437 |     await page.locator('.react-flow__node').first().click({ force: true });
  438 |     
  439 |     const categoryInput = page.getByRole('textbox', { name: /node category/i });
> 440 |     const tagName = await categoryInput.evaluate(el => el.tagName.toLowerCase());
      |                                         ^ Error: locator.evaluate: Test timeout of 30000ms exceeded.
  441 |     expect(tagName).toBe('input');
  442 |     
  443 |     const autocomplete = await categoryInput.getAttribute('autocomplete');
  444 |     expect(autocomplete).not.toBe('off');
  445 |   });
  446 | 
  447 |   test('Autocomplete Suggestion', async ({ page }) => {
  448 |     await page.goto('/');
  449 |     await page.locator('.react-flow__node').first().click({ force: true });
  450 |     
  451 |     const categoryInput = page.getByRole('textbox', { name: /node category/i });
  452 |     await categoryInput.fill('synonym');
  453 |     
  454 |     const suggestion = page.locator('.autocomplete-suggestion').first();
  455 |     await expect(suggestion).toBeVisible();
  456 |   });
  457 | 
  458 |   test('Form Submission Validation', async ({ page }) => {
  459 |     await page.goto('/');
  460 |     const firstNode = page.locator('.react-flow__node').first();
  461 |     await firstNode.click({ force: true });
  462 |     
  463 |     const categoryInput = page.getByRole('textbox', { name: /node category/i });
  464 |     const originalCategory = await categoryInput.inputValue();
  465 |     
  466 |     await categoryInput.fill('valid_category');
  467 |     
  468 |     const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.status() === 200);
  469 |     await page.getByRole('button', { name: /save/i }).click();
  470 |     await responsePromise;
  471 |     
  472 |     await expect(page.locator('.validation-error')).toHaveCount(0);
  473 | 
  474 |     // Cleanup
  475 |     await firstNode.click({ force: true });
  476 |     await categoryInput.fill(originalCategory);
  477 |     const restorePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
  478 |     await page.getByRole('button', { name: /save/i }).click();
  479 |     await restorePromise;
  480 |   });
  481 | 
  482 |   test('Block Free Text', async ({ page }) => {
  483 |     await page.goto('/');
  484 |     await page.locator('.react-flow__node').first().click({ force: true });
  485 |     
  486 |     const categoryInput = page.getByRole('textbox', { name: /node category/i });
  487 |     await categoryInput.fill('invalid_free_text');
  488 |     await page.getByRole('button', { name: /save/i }).click();
  489 |     
  490 |     await expect(page.locator('.validation-error')).toBeVisible();
  491 |   });
  492 | });
  493 | 
```