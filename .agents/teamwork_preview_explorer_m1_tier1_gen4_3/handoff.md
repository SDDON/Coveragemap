# Handoff Report: Iteration 4 Fix Strategy for tier1.spec.ts

## 1. Observation
An analysis of `e2e-tests/tests/tier1.spec.ts` reveals the following issues matching the failure report:
- **Shared Database State**: There are no `beforeEach` or `afterEach` hooks in the file to reset the backend state between tests.
- **Debounce Race Condition**: In `Debounce API Call` (L279-296), the test checks `expect(apiCallCount).toBeLessThanOrEqual(2)` after typing multiple inputs.
- **Pane Click Flakiness**: In `Restore Context` (L61), `page.locator('.react-flow__pane').click()` is called without coordinates.
- **Missing Awaits on Routes**: Route methods are not awaited on L39 (`route.abort()`), L312, L330, and L357 (`route.continue()`).
- **Brittle Topology**: In `Shift Focus` (L70-71) and `Add Edge` (L252-253), selectors like `nodes.nth(0)` and `nodes.nth(1)` rely on strict DOM ordering.
- **Broad Error Masking**: In `Block Race Conditions` (L366), `expect(...).rejects.toThrow()` is used without specifying the error message.
- **Conditional Logic**: In `Standardized Input UI` (L388), `expect(['select', 'input']).toContain(tagName)` is non-deterministic.
- **Race Conditions on count()**: In `Add Node` (L197) and `Add Edge` (L250), `await nodes.count()` happens immediately after `not.toHaveCount(0)`, which may capture an incomplete count if rendering is staggered.

## 2. Logic Chain
1. **Shared Database State**: Without a reset, data added in one test (like "Add Node") leaks into others, causing flakiness in node counts. We must add a `test.beforeEach` to call `/api/reset`.
2. **Debounce Race Condition**: The `toBeLessThanOrEqual` check masks race conditions. By waiting for the page to settle before counting, and explicitly tracking only the debounced request, we can enforce a strict `toBe(1)` assertion.
3. **Pane Click Flakiness**: The React Flow pane often overlaps with nodes in the center. Clicking at an explicit empty coordinate `{ position: { x: 10, y: 10 } }` guarantees a safe background click.
4. **Missing Awaits on Routes**: Playwright's `route.continue()` and `route.abort()` return Promises. Failing to await them can lead to unhandled promise rejections and detached route handling.
5. **Brittle Topology**: Using `.nth(1)` is fragile if seed data ordering changes. Fetching distinct nodes using `.first()` and `.last()`, or filtering by `data-id`, guarantees we act on deterministic elements.
6. **Broad Error Masking**: A simple `.toThrow()` might catch a Playwright timeout due to an incorrect selector. Enforcing `/intercepts pointer events/i` confirms the specific mechanic (the loading overlay blocking interaction) is working.
7. **Conditional Logic**: Since the test later calls `.fill()` on the element (which only works on inputs/textareas), the tag must be an `input`. We can safely assert `expect(tagName).toBe('input')`.
8. **Race Conditions on count()**: The DOM might temporarily have 1 node while others are rendering. Waiting for `networkidle` or waiting for the `/api/graph` fetch promise ensures the topology has finished rendering before we capture `initialCount`.

## 3. Caveats
- The fix strategy assumes `http://localhost:8000/api/reset` is the correct endpoint for tearing down backend state. The implementer must verify this or create the endpoint if it does not exist.
- The `networkidle` state can sometimes be brittle if there are continuous background polling requests; if so, explicit `waitForResponse` on the graph API should be preferred.
- The strategy assumes the top-left coordinate `(10, 10)` is always empty of nodes.

## 4. Conclusion
The `tier1.spec.ts` test file requires a targeted redesign to eliminate flakiness. The implementer should apply the following fixes:
1. Add `test.beforeEach(async ({ request }) => { await request.post('http://localhost:8000/api/reset'); });` globally.
2. In the debounce test, wait for the initial load (`await page.waitForLoadState('networkidle')`), reset the call count, trigger inputs, wait for the final request, and assert `expect(apiCallCount).toBe(1)`.
3. Update pane clicks to `await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } });`.
4. Prefix all `route.abort()` and `route.continue()` calls with `await`.
5. Replace `.nth(0)` and `.nth(1)` with `.first()` and `.last()` (or `data-id` lookups).
6. Change `.toThrow()` to `.toThrowError(/intercepts pointer events/i)`.
7. Change `toContain(tagName)` to `expect(tagName).toBe('input')`.
8. Before taking initial counts, wait for the graph fetch to complete or `networkidle` to ensure stable topology.

## 5. Verification Method
The implementer can verify the fixes by:
1. Running `npx playwright test e2e-tests/tests/tier1.spec.ts --repeat-each=10` to prove flakiness is eliminated.
2. Running `npx playwright test e2e-tests/tests/tier1.spec.ts --workers=1` to ensure sequential runs don't leak state.
3. Checking the test report to ensure all assertions pass cleanly without timing out or relying on `.toBeLessThanOrEqual`.
