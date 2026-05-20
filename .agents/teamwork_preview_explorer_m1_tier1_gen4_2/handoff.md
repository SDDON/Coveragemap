# M1 Tier 1 E2E Test Fix Strategy

## 1. Observation
I reviewed the code in `e2e-tests/tests/tier1.spec.ts` and identified the specific lines causing the violations reported in the previous iteration's failure:
1. **Shared Database State**: The tests mutate the graph (adding nodes, edges, modifying status) but there is no cleanup hook.
2. **Debounce Race Condition**: `expect(apiCallCount).toBeLessThanOrEqual(2)` on line 295.
3. **Pane Click Flakiness**: `await page.locator('.react-flow__pane').click();` on line 61.
4. **Missing Awaits on Routes**: `route.abort()` on line 39 and `route.continue()` on lines 312, 330, and 357 lack the `await` keyword.
5. **Brittle Topology Assumptions**: Hardcoded indices like `nodes.nth(0)` and `nodes.nth(1)` are used for interactions on lines 70-71 (Shift Focus) and 252-253 (Add Edge).
6. **Broad Error Masking**: `await expect(targetNode.click({ timeout: 1000 })).rejects.toThrow();` on line 366 masks potential actual errors.
7. **Conditional Logic in Tests**: `expect(['select', 'input']).toContain(tagName);` on line 388 is a non-deterministic assertion.
8. **Race Conditions on count()**: `.count()` is taken immediately after `not.toHaveCount(0)` on line 197 (Add Node) and line 250 (Add Edge).

## 2. Logic Chain
To address all failures, the test file must be rewritten using absolute and deterministic assertions:
- **State Reset**: A global `test.beforeEach` block should send a POST request to `/api/reset` to clear the local backend state before every test.
- **Debounce Fix**: The API count assertion must strictly expect `1` after ensuring the network is idle (`await page.waitForLoadState('networkidle')`).
- **Safe Pane Clicks**: Adding coordinates `{ position: { x: 10, y: 10 } }` to the `.react-flow__pane` click will ensure we hit the background instead of a node.
- **Await Routes**: All Playwright route interception callbacks must be `async` and appropriately await `route.abort()` and `route.continue()`.
- **Robust Selectors**: Instead of `.nth(1)`, tests must pick a node, extract its `data-id`, and select the next node using `:not([data-id="<id>"])`.
- **Specific Error Matching**: Replace `.toThrow()` with `.toThrowError(/intercepts pointer events/i)` to verify the click is blocked by the specific loading overlay.
- **Strict Tag Assertion**: Replace the array-based conditional with a specific expectation, e.g., `expect(tagName).toBe('input')`, since a `.fill()` call is used on this element right after.
- **Deterministic Counts**: Wait for the network payload containing the graph data to resolve (`waitForResponse`) before evaluating `.count()`.

## 3. Caveats
- I assumed the tag used for the category input is `input`. If the application uses a `select`, the exact assertion should be adjusted to `select`, but a `.fill()` interaction later implies an `input`.
- I assumed that `/api/reset` requires a POST request without any authentication headers and returns 200/204 on success.
- I assumed `/api/graph` handles all initial data loading so that awaiting it resolves the graph `count()` race condition.

## 4. Conclusion
The implementation agent should apply the following precise changes to `tier1.spec.ts`:

1. **Add `beforeEach`** at the top level of the file:
   ```typescript
   test.beforeEach(async ({ request }) => {
     await request.post('http://localhost:8000/api/reset');
   });
   ```

2. **Debounce Assertion** (Line 295):
   ```typescript
   await page.waitForLoadState('networkidle');
   expect(apiCallCount).toBe(1);
   ```

3. **Pane Click** (Line 61):
   ```typescript
   await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } });
   ```

4. **Await Routes** (Lines 39, 312, 330, 357):
   ```typescript
   await page.route('**/api/graph', async route => await route.abort());
   // ...
   await route.continue();
   ```

5. **Robust Selectors** (Lines 70-71, 252-253):
   ```typescript
   const nodeA = nodes.first();
   const nodeAId = await nodeA.getAttribute('data-id');
   const nodeB = page.locator(`.react-flow__node:not([data-id="${nodeAId}"])`).first();
   ```

6. **Specific Error Matching** (Line 366):
   ```typescript
   await expect(targetNode.click({ timeout: 1000 })).rejects.toThrowError(/intercepts pointer events/i);
   ```

7. **Strict Tag Assertion** (Line 388):
   ```typescript
   expect(tagName).toBe('input');
   ```

8. **Deterministic Counts** (Lines 197, 250):
   Wait for the network before taking the count:
   ```typescript
   const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
   await page.goto('/');
   await responsePromise;
   const initialCount = await nodes.count();
   ```

## 5. Verification Method
After changes are implemented:
1. Inspect the modified `tier1.spec.ts` using `view_file` to ensure all 8 points are correctly updated.
2. Run the specific test file using the local testing command (e.g., `npx playwright test e2e-tests/tests/tier1.spec.ts --repeat-each 5`) to verify that the flakiness is resolved and that tests pass reliably.
