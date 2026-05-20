# Handoff Report: Fix Strategy for tier1.spec.ts (M1 Iteration 3)

## 1. Observation
The current `d:\personal\living_graph_tc\e2e-tests\tests\tier1.spec.ts` file contains 8 identified issues that violate E2E testing integrity:
1. **Block Race Conditions (F5)**: Uses `setTimeout` for initial load, then uses `node.click({ force: true, timeout: 1000 })`, which bypasses the overlay logic completely and fails only because the node doesn't exist yet.
2. **Hide Loading Overlay (F5)**: Asserts the overlay is hidden synchronously immediately after `page.goto('/')`, before any rendering or loading logic starts.
3. **Path Selection (F2)**: Tests path selection by double-clicking a single node, but only verifies one other node is de-emphasized. It lacks structural assertions for the nodes actually *within* the path.
4. **Missing UI State Assertions (F4)**: `Edit Node Properties` and `Add Edge` wait for the API but fail to assert that the DOM reflects the changes.
5. **Add Node (F4)**: Synchronously evaluates `await nodes.count()` immediately after `page.goto('/')`, capturing `0` before seed data hydrates.
6. **Dynamic Locators (F3)**: `Mark Passed`, `Mark Failed`, etc., capture nodes by dynamic state classes (`.status-untested`). When the node's state changes, the locator re-evaluates and points to a *different* node for the assertion.
7. **SPA Hydration Flake (F3)**: `Coverage Metrics Update` reads `.innerText()` on metric counters right after load, capturing empty or stale states.
8. **Hardcoded Timeout (F5)**: `Debounce API Call` uses a hardcoded `page.waitForTimeout(1000)` instead of deterministic state-based waits.

## 2. Logic Chain
1. **Block Race Conditions**: The initial load must be allowed to render cleanly. A *subsequent* API call (e.g., changing depth in config) should be delayed. While delayed, a normal `node.click()` (without `force: true`) should fail or timeout because the `.loading-overlay` prevents pointer events.
2. **Hide Loading Overlay**: Wait for the graph to render initially. Trigger an action that shows the overlay (like a config change), `await expect(overlay).toBeVisible()`, allow the API to resolve, and *then* `await expect(overlay).toBeHidden()`.
3. **Path Selection**: We must identify an actual path. Find an edge, get its `data-source` and `data-target` IDs. Trigger path selection (e.g., clicking the edge or a node), then verify that the specific source and target nodes have the `active` class, and an unrelated node has the `de-emphasized` class.
4. **Missing UI State Assertions**: After `Edit Node Properties` completes its API request, add an assertion like `await expect(page.locator('.react-flow__node', { hasText: 'Updated Label' })).toBeVisible()`. For `Add Edge`, verify the new edge exists using its IDs or position.
5. **Add Node / SPA Hydration Flake**: Always block reading initial states (counts, inner text) until seed data is fully rendered: `await expect(page.locator('.react-flow__node')).not.toHaveCount(0)`.
6. **Dynamic Locators**: Extract a stable identifier first. `const id = await node.getAttribute('data-id'); const stableNode = page.locator(\`.react-flow__node[data-id="\${id}"]\`);`. Use `stableNode` for the click and the subsequent status assertions.
7. **Hardcoded Timeout**: Remove `waitForTimeout(1000)`. Instead, use `page.waitForResponse(...)` to wait for the exact API call (e.g., depth=4) triggered by the final user input, ensuring the debounce window is deterministically passed.

## 3. Caveats
- We assume elements like `.react-flow__node` and `.react-flow__edge` have stable `data-id`, `data-source`, and `data-target` attributes, as indicated by the existing code.
- We assume clicking a `.react-flow__edge` is an acceptable way to trigger path selection, or the implementer can adjust the trigger mechanism (e.g., double clicking a node) as long as they verify multiple nodes in the path using stable IDs.
- We assume changing the `max-depth` config input triggers an API call that can be delayed to test the overlay.

## 4. Conclusion
The fix strategy requires rewriting the flagged tests in `tier1.spec.ts` using strict synchronization (waiting for seed data first), stable locators (via `data-id`), and absolute assertions of UI state. All `waitForTimeout` and `{ force: true }` hacks must be removed in favor of waiting for exact network conditions and correct DOM layers.

## 5. Verification Method
Run the Playwright tests via `npx playwright test e2e-tests/tests/tier1.spec.ts`.
Inspect the code to ensure:
- `page.waitForTimeout` is absent.
- `force: true` is not used in the race condition test.
- Status assertions use `[data-id="..."]` locators.
- Pre-checks ensure initial hydration (`not.toHaveCount(0)`) before reading states.
