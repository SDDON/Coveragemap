# Handoff Report: Fix Strategy for Tier 1 Tests

## Observation
- **TypeScript Configuration**: `e2e-tests/tsconfig.json` is missing, causing `npx tsc --noEmit` to fail.
- **Debounce Logic (F5)**: The debounce test simply types one value and waits for a request, completely failing to test if rapid, successive inputs are collapsed into a single request.
- **Hallucinated Elements & APIs**: Tests rely on undefined DOM details (e.g., `.node-category-input`, `button.save-node`) and undefined REST endpoints (e.g., `POST /api/nodes`), leading to brittle assumptions.
- **Loading Overlay (F5)**: The race condition test expects a click to throw an error due to `pointer-events` interception. If the overlay uses `pointer-events: none` or isn't positioned perfectly, this fails.
- **State Bleeding (F3, F4)**: Tests mutate the graph (e.g., adding/deleting nodes) without a `beforeEach` DB reset, which will break subsequent tests when running against a persistent backend.
- **Playwright Anti-Patterns & Flakiness**:
  - `Add Edge` fails Playwright's strict mode by selecting `.react-flow__handle.source` without `.first()`, matching multiple handles.
  - Tests manually read `.count()` before asserting, which does not auto-wait, causing flakiness if the graph is still rendering.
  - The "Restore Context" test relies on clicking absolute coordinates `{x: 10, y: 10}` to clear focus, assuming layout dimensions.
  - Topological assumptions attempt to dynamically find unconnected nodes, which might fail depending on random seed data.

## Logic Chain
1. **TS Fix**: Creating `/e2e-tests/tsconfig.json` will resolve the TS compiler error for the test suite.
2. **Debounce Test Strengthening**: To properly test debouncing, we must simulate rapid typing (e.g., sequentially entering '1', '2', '3') and assert that exactly *one* network request is triggered after a timeout, instead of one per keystroke.
3. **Semantic Locators & Mocking**: Because exact CSS and mutation API schemas aren't specified in the requirements, we should use semantic Playwright locators (e.g., `getByRole('button', { name: /save/i })`). Furthermore, UI-focused tests (F2-F6) should use `page.route` to mock backend responses.
4. **Overlay Test Fix**: Instead of relying on Playwright's internal error throw for `pointer-events`, we should assert that the overlay is visually present (`toBeVisible()`) during a delayed API response, and check that underlying interactive elements (like the canvas or buttons) are logically blocked (e.g., disabled attribute or obscured).
5. **State & Topology Consistency**: By applying `page.route('**/api/graph', ...)` with static, deterministic JSON data in a `beforeEach` block for F2-F6, we achieve two things:
   - We completely eliminate state bleeding since the real DB is never mutated.
   - We fix topological assumptions by injecting a known, fixed graph (e.g., 3 nodes total, where Node A and B are connected, and Node C is explicitly isolated).
6. **Robust Assertions & Actions**: 
   - We must append `.first()` or explicitly identify specific handles for edge creation to satisfy strict mode.
   - We must replace raw `.count()` checks with `await expect(locator).toHaveCount(X)` to leverage Playwright's auto-retrying assertions.
   - We should use `page.keyboard.press('Escape')` or a semantic action to clear selections rather than brittle coordinate clicks.

## Caveats
- Using mock data for F2-F6 means those suites will test the frontend in isolation. F1 will still verify the real API and seed data pipeline, providing end-to-end coverage where appropriate.
- We assume React Flow's core selectors (`.react-flow__node`, `.react-flow__edge`, `.react-flow__handle`) are permissible as they are standard to the library.

## Conclusion
The test suite must be rewritten to adopt a mocked-data approach for F2-F6, eliminating state bleed and topology guessing. Anti-patterns like un-awaited counts, coordinate clicking, and strict-mode violations on handles must be removed in favor of auto-waiting assertions and explicit node/handle targeting. The debounce test will be updated to fire multiple events and count the resulting API calls. A `tsconfig.json` will be added to the test directory.

## Verification Method
1. Verify TS compilation: `cd e2e-tests && npx tsc --noEmit`.
2. Run tests to confirm stability: `cd e2e-tests && npx playwright test`. 
3. Observe that tests run deterministically and pass without assuming real backend persistence or specific random seed topologies.
