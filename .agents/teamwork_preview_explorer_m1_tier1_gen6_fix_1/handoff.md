# Handoff Report: Tier 1 Test Fix Strategy

## 1. Observation
- **Missing `tsconfig.json`**: The `e2e-tests` directory lacks a `tsconfig.json`, causing `npx tsc --noEmit` to fail.
- **Weak Debounce Test**: The test `Debounce API Call` (lines 395-403) only inputs a single value (`4`) and waits for one request, failing to verify that intermediate rapid inputs are ignored.
- **Hallucinated UI/API**: The tests rely on specific CSS classes (`.add-node`, `.loading-overlay`, `.status-untested`) and API endpoints (e.g., `POST /api/nodes`) that are not strictly defined in the `ORIGINAL_REQUEST.md`.
- **Loading Overlay Click Behavior**: The `Block Race Conditions` test expects pointer events interception. However, if the implementation uses `pointerEvents: 'none'`, Playwright's click will silently pass through, failing to trigger the rejection.
- **State-Bleeding**: F3 and F4 use a `beforeEach` that only waits for `GET /api/graph` (lines 121-125, 252-256) but does not reset the DB. Deletion cleanup occurs at the end of the test, meaning a failing test will leave mutated data.
- **Strict Mode Violations**: In `Add Edge` and `Delete Edge`, `sourceNode.locator('.react-flow__handle.source')` can resolve to multiple handles, violating Playwright's strict mode (lines 348-349).
- **Flaky `.count()`**: Counting elements via `await nodes.count()` before the graph is fully stable (e.g., animations or multiple renders completing) can result in an incorrect base count.
- **Brittle Layout Assumptions**: Clicking at `{ x: 10, y: 10 }` on `.react-flow__pane` (line 61) to clear focus might accidentally click a node if the layout places one there.
- **Topology Assumptions**: Tests arbitrarily pick `targetNode` using `.first()` (e.g., line 345) which might already be connected to the `sourceNode`, or assume unassociated nodes exist.

## 2. Logic Chain
- Without a local `tsconfig.json`, the TypeScript compiler lacks the context to resolve `@playwright/test` types within the `e2e-tests` directory.
- A true debounce test must simulate the rapid inputs it is meant to debounce. By typing multiple values rapidly and verifying only the *final* request is made (and after a delay), the logic is properly strengthened.
- Opaque-box testing requires a defined contract. We must standardize on semantic locators (e.g., `getByRole`) or explicit `data-testid` attributes to decouple tests from implementation details (CSS classes). Similarly, we should define a strict API contract or mock endpoints if the backend is not yet stable.
- To prevent race conditions (R5), the loading overlay *must* block clicks. If the overlay has `pointer-events: none`, it fails this requirement. The test must explicitly verify that the overlay exists and has `pointer-events` enabled (e.g., `auto` or default).
- E2E tests interacting with a real DB must isolate state. A `POST /api/dev/reset-db` endpoint should be called in `beforeEach` to guarantee a clean slate for every test, avoiding cascading failures.
- Playwright's strict mode requires unique resolution. Handle locators must use `.first()` or specific IDs to prevent errors when nodes have multiple handles.
- Awaiting `.count()` immediately after a page load is a race condition. We must wait for a stable state (e.g., `await page.waitForLoadState('networkidle')` or expecting a specific node count first) before reading the count.
- To restore context (clear focus), instead of clicking an arbitrary coordinate that might contain a node, we should click a known empty area or press the `Escape` key, which is standard UX for clearing selection.
- Relying on random seed data for topological tests (like finding an unconnected node pair) causes flakiness. We must use a deterministic seed dataset with known node IDs (e.g., `node-a`, `node-b`) and predefined edge relationships.

## 3. Caveats
- This strategy introduces a dependency on a `POST /api/dev/reset-db` endpoint. The backend team must implement this or a similar mechanism.
- The use of semantic locators (`getByRole`) enforces accessibility standards (ARIA roles) on the frontend, which is beneficial but wasn't explicitly stated in the original requirements.
- The debounce test assumes a specific debounce delay (e.g., 300ms-500ms). The frontend implementation must match the test's expectation.

## 4. Conclusion
To fix `tier1.spec.ts`, the implementation agent must:
1. Create `e2e-tests/tsconfig.json` extending the base config or providing standard Playwright compiler options.
2. Rewrite the `Debounce API Call` test to input multiple values successively without awaiting, then verify only one API call is triggered for the last value.
3. Replace class-based CSS selectors with semantic locators (e.g., `getByRole('button', { name: 'Add Node' })`) or explicit `data-testid` attributes (`data-testid="loading-overlay"`).
4. Assert that the loading overlay has `pointer-events: auto` (or not `none`) to ensure it blocks clicks.
5. Add a `POST /api/dev/reset-db` call in a global `beforeEach` hook to ensure isolated state.
6. Fix strict mode by appending `.first()` to handle locators, and resolve flakiness by awaiting network idle before `.count()`.
7. Replace coordinate clicking (`{x: 10, y: 10}`) with `page.keyboard.press('Escape')` or clicking a known safe background area.
8. Enforce deterministic seed data logic (e.g., referencing nodes by explicit IDs rather than `.first()`/`:not()`) so topology assumptions are guaranteed.

## 5. Verification Method
- **`tsconfig.json`**: Run `cd e2e-tests && npx tsc --noEmit`. It should exit with code 0.
- **Test execution**: Run `npx playwright test`. Ensure no strict mode violations occur.
- **Review test code**: Manually inspect `tier1.spec.ts` to confirm debounce logic inputs multiple values, `beforeEach` resets the DB, locators are semantic/data-testid based, and `page.keyboard.press('Escape')` is used instead of coordinate clicking.
