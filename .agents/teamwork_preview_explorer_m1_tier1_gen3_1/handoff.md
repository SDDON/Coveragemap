# Handoff Report: M1 (Tier 1 E2E Tests) Integrity Violations Fix Strategy

## 1. Observation
The following 8 integrity violations were identified in `d:\personal\living_graph_tc\e2e-tests\tests\tier1.spec.ts` during the M1 review:
1. `Test F5: Block Race Conditions`: Uses `{ force: true }` and times out waiting for node rendering rather than verifying overlay blocking.
2. `Test F5: Hide Loading Overlay`: Asserts overlay is hidden immediately after `page.goto()`, before the initial network request even fires.
3. `Test F2: Path Selection (Coverage scope view)`: Simulates double click on a single node instead of actual path selection logic.
4. `Test F4: Missing UI State Assertions`: `Add Edge` and `Edit Node Properties` tests only wait for API responses but do not assert the DOM changes.
5. `Test F4: Add Node`: Calls `nodes.count()` synchronously right after `goto('/')`, failing to account for initial seed data load time.
6. `Test F3: Dynamic Locators Re-evaluating`: Caches dynamic class locators (e.g. `.status-untested`) and expects them to change class, but Playwright re-evaluates them and points to the next node in the list.
7. `Test F3: Coverage Metrics Update`: Reads `innerText()` synchronously before React has hydrated the initial metrics.
8. `Test F5: Debounce API Call`: Uses hardcoded `waitForTimeout(1000)` instead of deterministic request waiting.

## 2. Logic Chain & Proposed Fixes

To resolve these violations, the test file requires systemic refactoring to use deterministic waits and stable locators.

### Fix 1: F5 - Block Race Conditions
**Rationale:** We need to wait for the graph to render *before* triggering the overlay, so that nodes actually exist. Then we attempt to click a node *without* `force: true`.
```typescript
test('Block Race Conditions', async ({ page }) => {
  await page.goto('/');
  const nodes = page.locator('.react-flow__node');
  await expect(nodes).not.toHaveCount(0); // Wait for initial render
  
  // Intercept subsequent config changes
  await page.route('**/api/graph?depth=*', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    route.continue();
  });
  
  // Trigger overlay
  await page.locator('input[name="max-depth"]').fill('5');
  const overlay = page.locator('.loading-overlay');
  await expect(overlay).toBeVisible();
  
  // Assert click is blocked by overlay
  const firstNode = nodes.first();
  await expect(firstNode.click({ timeout: 200 })).rejects.toThrow();
});
```

### Fix 2: F5 - Hide Loading Overlay
**Rationale:** Wait for rendering, trigger a change, wait for overlay, wait for API, then assert hidden.
```typescript
test('Hide Loading Overlay', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
  
  const depthInput = page.locator('input[name="max-depth"]');
  const requestPromise = page.waitForResponse(res => res.url().includes('/api/graph?depth=5'));
  
  await depthInput.fill('5');
  const overlay = page.locator('.loading-overlay');
  await expect(overlay).toBeVisible();
  
  await requestPromise;
  await expect(overlay).toBeHidden();
});
```

### Fix 3: F2 - Path Selection (Coverage scope view)
**Rationale:** Click an edge to simulate path selection, ensuring the source/target nodes become active, and others are de-emphasized.
```typescript
test('Path Selection (Coverage scope view)', async ({ page }) => {
  await page.goto('/');
  const edge = page.locator('.react-flow__edge').first();
  const sourceId = await edge.getAttribute('data-source');
  const targetId = await edge.getAttribute('data-target');
  
  await edge.click();
  
  const sourceNode = page.locator(`.react-flow__node[data-id="${sourceId}"]`);
  const targetNode = page.locator(`.react-flow__node[data-id="${targetId}"]`);
  const otherNode = page.locator(`.react-flow__node:not([data-id="${sourceId}"]):not([data-id="${targetId}"])`).first();
  
  await expect(sourceNode).toHaveClass(/active/);
  await expect(targetNode).toHaveClass(/active/);
  await expect(otherNode).toHaveClass(/de-emphasized/);
});
```

### Fix 4: F4 - Missing UI State Assertions
**Rationale:** Add DOM assertions after API responses resolve.
```typescript
// Edit Node Properties
test('Edit Node Properties', async ({ page }) => {
  await page.goto('/');
  const node = page.locator('.react-flow__node').first();
  const nodeId = await node.getAttribute('data-id');
  await node.click();
  
  await page.locator('input[name="node-label"]').fill('Updated Label');
  
  const requestPromise = page.waitForRequest(req => req.url().includes('/api/nodes') && req.method() === 'PATCH');
  await page.locator('button.save-node').click();
  await requestPromise;
  
  await expect(page.locator(`.react-flow__node[data-id="${nodeId}"]`)).toContainText('Updated Label');
});

// Add Edge
test('Add Edge', async ({ page }) => {
  await page.goto('/');
  const sourceNode = page.locator('.react-flow__node').nth(0);
  const targetNode = page.locator('.react-flow__node').nth(1);
  const sourceId = await sourceNode.getAttribute('data-id');
  const targetId = await targetNode.getAttribute('data-id');
  
  const sourceHandle = sourceNode.locator('.react-flow__handle.source');
  const targetHandle = targetNode.locator('.react-flow__handle.target');
  
  const requestPromise = page.waitForRequest(req => req.url().includes('/api/edges') && req.method() === 'POST');
  await sourceHandle.dragTo(targetHandle);
  await requestPromise;
  
  const edge = page.locator(`.react-flow__edge[data-source="${sourceId}"][data-target="${targetId}"]`);
  await expect(edge).toBeVisible();
});
```

### Fix 5: F4 - Add Node Flaky State Assertion
**Rationale:** Wait for seed data before reading `count()`.
```typescript
test('Add Node', async ({ page }) => {
  await page.goto('/');
  const nodes = page.locator('.react-flow__node');
  await expect(nodes).not.toHaveCount(0); // Sync barrier
  const initialCount = await nodes.count();

  await page.locator('button.add-node').click();
  await page.locator('input[name="node-label"]').fill('New Node');
  
  const requestPromise = page.waitForRequest(req => req.url().includes('/api/nodes') && req.method() === 'POST');
  await page.locator('button.save-node').click();
  await requestPromise;
  
  await expect(nodes).toHaveCount(initialCount + 1);
});
```

### Fix 6: F3 - Dynamic Locators Re-evaluating
**Rationale:** Extract `data-id` and use it for subsequent specific node lookups to avoid `.first()` pointing to the wrong node after state changes. Apply this to all tests in F3 (`Mark Passed`, `Mark Failed`, `Mark Edge Passed`, `Reset Status`).
```typescript
test('Mark Passed', async ({ page }) => {
  await page.goto('/');
  const untestedNodes = page.locator('.react-flow__node.status-untested');
  await expect(untestedNodes).not.toHaveCount(0); // Sync barrier
  
  const nodeId = await untestedNodes.first().getAttribute('data-id');
  const nodeLocator = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  await nodeLocator.click();
  
  await page.locator('button.mark-passed').click();
  await expect(nodeLocator).toHaveClass(/status-passed/); // Evaluates stable locator
});
```

### Fix 7: F3 - SPA Hydration Flake
**Rationale:** Ensure DOM is hydrated by waiting for seed elements to render before reading the `.innerText()`.
```typescript
test('Coverage Metrics Update', async ({ page }) => {
  await page.goto('/');
  const untestedNodes = page.locator('.react-flow__node.status-untested');
  await expect(untestedNodes).not.toHaveCount(0); // Sync barrier
  
  const passedCount = page.locator('.metrics-passed-count');
  const initialText = await passedCount.innerText();
  const initialCount = parseInt(initialText, 10) || 0;
  
  const nodeId = await untestedNodes.first().getAttribute('data-id');
  const nodeLocator = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  
  await nodeLocator.click();
  await page.locator('button.mark-passed').click();
  
  await expect(passedCount).toHaveText((initialCount + 1).toString());
});
```

### Fix 8: F5 - Hardcoded Timeout
**Rationale:** Listen to specific request triggers and await the final debounced request instead of arbitrary sleeping.
```typescript
test('Debounce API Call', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.react-flow__node')).not.toHaveCount(0); // Sync barrier
  
  let apiCallCount = 0;
  page.on('request', req => {
    if (req.url().includes('/api/graph?depth=') && req.method() === 'GET') {
      apiCallCount++;
    }
  });
  
  const depthInput = page.locator('input[name="max-depth"]');
  await depthInput.fill('2');
  await depthInput.fill('3');
  
  const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph?depth=4'));
  await depthInput.fill('4');
  await responsePromise;
  
  expect(apiCallCount).toBeLessThanOrEqual(2);
});
```

## 3. Caveats
- `Path Selection`: The fix assumes that clicking an edge selects the path (source and target nodes). If the application UI requires a different interaction (e.g. shift-clicking nodes), the interaction simulation in `Test F2: Path Selection` will need to be adapted accordingly.
- Edge selectors use `[data-source]` and `[data-target]`. Ensure that the application DOM actually populates these attributes on `.react-flow__edge` elements.

## 4. Conclusion
The integrity violations in `tier1.spec.ts` stem largely from synchronous execution ignoring SPA data-loading lifecycles, and Playwright dynamically re-evaluating state-dependent locators. The proposed fix strategy comprehensively replaces tautological assertions, mitigates race conditions via deterministic sync barriers (`expect().not.toHaveCount(0)`), and stabilizes interactions using unique `data-id` selectors.

## 5. Verification Method
1. Implement the changes detailed above into `tier1.spec.ts`.
2. Run the E2E test suite using the standard Playwright command:
   `npx playwright test e2e-tests/tests/tier1.spec.ts`
3. Verify that all tests pass without flakes, even on slower rendering ticks (can be verified using CPU throttling).
