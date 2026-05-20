# Observation

An analysis of `d:\personal\living_graph_tc\e2e-tests\tests\tier1.spec.ts` reveals multiple integrity violations matching the Auditor and Challenger report:

1. **Test F5: Block Race Conditions** (lines 278-291)
   The test sets up a delayed route, immediately goes to `/`, and tries to click a node with `node.click({ force: true, timeout: 1000 })`. The click fails due to the timeout because the node hasn't rendered yet (API is delayed). `force: true` bypasses Playwright's actionability checks (which includes checking for intercepting overlays).
2. **Test F5: Hide Loading Overlay** (lines 272-276)
   Calls `page.goto('/')` and immediately expects the overlay to be hidden before any data has loaded or the overlay has even had a chance to render.
3. **Test F2: Path Selection** (lines 94-106)
   The test double-clicks a single node and asserts that this single node is active while others are de-emphasized. It doesn't trace or verify a path between two connected nodes.
4. **Test F4: Missing UI State Assertions** (lines 186-196, 210-218)
   `Edit Node Properties` and `Add Edge` trigger actions and wait for API responses (`POST`/`PATCH`), but lack assertions to verify the DOM actually updated (e.g., verifying the label changed or the edge count increased).
5. **Test F4: Add Node** (lines 169-172)
   Retrieves `initialCount` synchronously right after `page.goto('/')`, which yields `0` because the graph data hasn't been fetched/rendered yet.
6. **Test F3: Dynamic Locators** (lines 110-119)
   Captures `untestedNode` via `.react-flow__node.status-untested`. After clicking "Mark Passed", the node's class changes. The subsequent assertion `await expect(untestedNode).toHaveClass(/status-passed/)` re-evaluates the locator, which now points to the *next* untested node in the DOM, causing a failure.
7. **Test F3: SPA Hydration** (lines 154-159)
   Reads `.metrics-passed-count` using `innerText()` immediately after `goto('/')`, before the seed data has populated the metrics.
8. **Test F5: Debounce API Call** (lines 234-250)
   Uses a hardcoded `await page.waitForTimeout(1000)` instead of waiting for a determinable state (e.g., waiting for the specific debounced API request to complete).

# Logic Chain

To resolve these violations and produce robust, deterministic E2E tests, the following fix strategy must be applied:

1. **F5: Block Race Conditions**
   - **Strategy**: Wait for the initial graph to load and render (`await expect(nodes).not.toHaveCount(0)`). Then, intercept the config update API request to simulate latency. Trigger the config change to bring up the loading overlay. Verify the overlay is visible. Finally, attempt to click a node without `{ force: true }`. The click should timeout or throw because the overlay intercepts pointer events. Catch this expected failure to pass the test.

2. **F5: Hide Loading Overlay**
   - **Strategy**: Wait for the initial graph to render. Intercept the config change API with a delay. Trigger the config change. Await the overlay to be visible (`await expect(overlay).toBeVisible()`). Let the API resolve, and then assert the overlay becomes hidden (`await expect(overlay).toBeHidden()`).

3. **F2: Path Selection**
   - **Strategy**: Locate a valid edge (`.react-flow__edge`). Extract its `data-source` and `data-target` attributes. Click both nodes (or trigger the path selection mechanism, e.g., clicking the edge or source then target). Assert that BOTH the source and target nodes have the `.active` class, while a node not part of this edge has the `.de-emphasized` class.

4. **F4: Missing UI State Assertions**
   - **Strategy for Edit Node**: After saving the node and waiting for the PATCH request, assert that the node's label in the DOM (e.g., `.node-label` or text content) matches the updated label.
   - **Strategy for Add Edge**: Get the initial edge count after seed data loads. After dragging the handle and waiting for the POST request, assert that the edge count is `initialCount + 1`.

5. **F4: Add Node**
   - **Strategy**: Await initial graph rendering (`await expect(nodes).not.toHaveCount(0)`) BEFORE reading `initialCount`.

6. **F3: Dynamic Locators**
   - **Strategy**: Fetch the `data-id` of the `untestedNode` before changing its status. Create a stable locator based on the ID: `const stableNode = page.locator(\`.react-flow__node[data-id="\${nodeId}"]\`)`. Perform actions and assertions on `stableNode`.

7. **F3: SPA Hydration**
   - **Strategy**: Wait for the graph nodes to render (`await expect(nodes).not.toHaveCount(0)`) before reading the initial passed count metric.

8. **F5: Debounce API Call**
   - **Strategy**: Replace `waitForTimeout(1000)` with `page.waitForRequest(...)` for the final expected API call (e.g., `depth=4`). Check that `apiCallCount` is `<= 2` (one for initial load, one for the debounced update).

# Caveats

- We assume the graph nodes use `data-id` as a stable identifier.
- We assume `data-source` and `data-target` exist on edges, which seems correct based on current test code.
- We assume the loading overlay uses standard pointer-events blocking, which Playwright will detect and reject interactions for when `force: true` is not used.
- We assume the config API route for depth update is `/api/graph?depth=...`.

# Conclusion

The `tier1.spec.ts` suite suffers from race conditions, missing assertions, and improper use of locators that violate testing integrity. The implementer should rewrite the specified tests following the logic chain above, strictly avoiding arbitrary timeouts and `force: true` bypasses. Seed data must always be awaited before capturing baseline state.

# Verification Method

Run the playwright tests after the implementer applies the fixes:
```bash
npx playwright test e2e-tests/tests/tier1.spec.ts
```
All tests must pass deterministically without flakes.
