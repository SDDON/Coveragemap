# Fix Strategy: Tier 1 Playwright E2E Tests (Iteration 5)

## Consensus
The Explorer's fix strategy addresses the final setup, debounce, and hydration flaws:

1. **Silent Failure in Setup/Teardown**: The `.catch(() => {})` in `beforeEach` swallows errors and caused an Auditor violation. Since we are testing E2E without a guaranteed backend `/api/reset`, we will mock the `/api/reset` endpoint to return 200 OK deterministically, preventing failures without swallowing errors.
   ```typescript
   test.beforeEach(async ({ page }) => {
     await page.route('**/api/reset', async route => {
       await route.fulfill({ status: 200 });
     });
     await page.request.post('http://localhost:5173/api/reset'); // Or whatever the app calls
   });
   ```
   *Wait, actually, if the frontend doesn't call `/api/reset`, we don't need to route it.* Let's just remove the `beforeEach` `/api/reset` call entirely. The requirement is just to not have state leakage. The app will fetch its own graph. If we must, just `await page.evaluate(() => window.localStorage.clear());` or do nothing if the app is stateless. *Action for Worker*: Remove the `/api/reset` call from `beforeEach` entirely to avoid backend dependency in Tier 1.

2. **Network Race Condition on `innerText`**: Add an auto-retrying web-first assertion before reading the text.
   ```typescript
   const passedCount = page.locator('.metrics-passed-count');
   await expect(passedCount).toHaveText(/\d+/);
   const initialText = await passedCount.innerText();
   ```

3. **Flaky Race Condition (Debounce)**: Avoid simulating slow typing with multiple `.fill()` calls. Use a single `.fill()` to trigger exactly one debounced network request.
   ```typescript
   const depthInput = page.locator('input[name="max-depth"]');
   const requestPromise = page.waitForRequest(req => req.url().includes('/api/graph?depth=4') && req.method() === 'GET');
   await depthInput.fill('4');
   await requestPromise;
   ```

4. **Graph Topology Assumption**: The Challenger flagged that assuming an unassociated node exists can cause crashes. DO NOT use `if (...) test.skip()`, as the Auditor will flag it as an integrity violation. Instead, use a strict assertion to guarantee the node exists, which will properly fail the test if the seed data is invalid (which is the correct behavior for E2E).
   ```typescript
   const unassociatedNode = page.locator(`.react-flow__node:not([data-id="${sourceId}"]):not([data-id="${targetId}"])`).first();
   await expect(unassociatedNode).not.toHaveCount(0); // Explicitly require it to exist
   await unassociatedNode.click();
   ```

## Actionable Summary for Worker
The Worker needs to:
1. Edit `d:\personal\living_graph_tc\e2e-tests\tests\tier1.spec.ts`.
2. Remove the `beforeEach` API reset call, or replace it with `localStorage.clear()` if needed. DO NOT use `.catch()`.
3. Add `await expect(passedCount).toHaveText(/\d+/)` before any `.innerText()` calls.
4. Simplify the debounce test to use a single `.fill()` and wait for a single request.
5. Replace any conditional skips or implicit assumptions about topology with explicit `await expect(locator).not.toHaveCount(0)` assertions.
6. Verify code compiles with `npx tsc --noEmit`.
