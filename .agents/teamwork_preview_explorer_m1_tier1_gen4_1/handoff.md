# FAILED M1 Milestone: Iteration 4 Fix Strategy

## 1. Observation
The following issues were identified in `e2e-tests/tests/tier1.spec.ts`:
1. **Shared Database State**: There is no teardown or setup mechanism to isolate database state between tests.
2. **Debounce Race Condition & Weak Checks**: In `test('Debounce API Call')` (line 295), `expect(apiCallCount).toBeLessThanOrEqual(2)` is weak and race-prone.
3. **Pane Click Flakiness**: In `test('Restore Context')` (line 61), `await page.locator('.react-flow__pane').click()` clicks the exact center of the pane, which might accidentally hit a node.
4. **Missing Awaits on Routes**: Route control methods like `route.abort()` (line 39) and `route.continue()` (lines 312, 330, 357) lack `await`.
5. **Brittle Topology Assumptions**: Selectors such as `nodes.nth(0)` and `nodes.nth(1)` are used for shifting focus (line 70) and adding edges (line 252), which assume a strict layout.
6. **Broad Error Masking**: In `test('Block Race Conditions')` (line 366), `await expect(...).rejects.toThrow()` is used, which catches any error, not just the overlay block.
7. **Conditional Logic in Tests**: In `test('Standardized Input UI')` (line 388), `expect(['select', 'input']).toContain(tagName)` relies on non-deterministic assertions.
8. **Race Conditions on count()**: Tests like `Add Node` and `Add Edge` (lines 197, 250) check `.count()` immediately after `not.toHaveCount(0)`, which fails if rendering is incomplete.

## 2. Logic Chain
To redesign the tests and ensure absolute, deterministic assertions:
1. **Database Teardown**: Inject `test.beforeEach(async ({ request }) => { await request.post('http://localhost:8000/api/reset'); });` at the top level to ensure clean state per test.
2. **Debounce Flakiness**: Wait for network stability (`await page.waitForLoadState('networkidle');`) after the final text input, then assert `expect(apiCallCount).toBe(1)` (or `toBe(2)` if the app uses leading-edge firing).
3. **Pane Click Flakiness**: Modify the click to target a safe, fixed background coordinate: `await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } });`.
4. **Awaiting Routes**: Prepend `await` to all route intercepted methods: `await route.abort();` and `await route.continue();`.
5. **Topology Assumptions**: Replace `.nth()` selections with specific target tracking. For example, grab the first node, get its `data-id`, and query the second node using `.locator('.react-flow__node:not([data-id="<first_id>"])').first()`.
6. **Error Masking**: Replace `.rejects.toThrow()` with `.rejects.toThrowError(/intercepts pointer events/i)` to guarantee the overlay is functioning as a blocker.
7. **Deterministic UI Assertions**: Replace the `toContain(tagName)` array check with a strict check against the actual implemented element type (e.g., `expect(tagName).toBe('input');`).
8. **Count Race Conditions**: Precede `.count()` captures with `await page.waitForLoadState('networkidle');` or a specific API resolution wait, guaranteeing all nodes are fully mounted before establishing the baseline count.

## 3. Caveats
- The teardown strategy assumes the backend at `http://localhost:8000/api/reset` is implemented and accessible.
- For the UI assertion (Issue #7), the fix strategy assumes `input` is the intended element type (given the autocomplete check below it). Adjust to `select` if that is what the final implementation renders.

## 4. Conclusion
The current test suite is flaky because it relies on relative element counts, indeterminate timing, lack of test isolation, and weak assertions. The fix strategy systematically resolves these 8 issues by employing explicit test isolation (`/api/reset`), deterministic selections (excluding by `data-id`), fixed-coordinate clicks, exact validations, and proper hydration boundaries (`networkidle`). Implementing these changes in Iteration 4 will satisfy the M1 milestone's Tier 1 Playwright requirements.

## 5. Verification Method
1. Apply the proposed code changes to `e2e-tests/tests/tier1.spec.ts`.
2. Ensure the `/api/reset` endpoint is functional on the backend.
3. Run `npx playwright test e2e-tests/tests/tier1.spec.ts --repeat-each 10` to confirm flakiness is eliminated and all tests pass reliably.
