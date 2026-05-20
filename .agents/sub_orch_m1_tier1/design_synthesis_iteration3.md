# Fix Strategy: Tier 1 Playwright E2E Tests (Iteration 3)

## Consensus
The Explorer's fix strategy addresses all the latest integrity violations:
1. **F5 Block Race Conditions**: Wait for the graph to render initially. Then delay the config API, trigger config change, verify overlay is visible, and use `await expect(node.click({ timeout: 1000 })).rejects.toThrow()` WITHOUT `{ force: true }`.
2. **F5 Hide Loading Overlay**: Wait for the graph to render initially. Delay the config API, trigger config change, wait for overlay to be visible. Let API resolve, then assert overlay is hidden.
3. **F2 Path Selection**: Locate a valid edge, extract `data-source` and `data-target`. Click the source and target nodes. Assert both nodes have the `.active` class and an unconnected node has the `.de-emphasized` class.
4. **F4 Missing UI Assertions**: 
   - **Edit Node**: Assert the node's label in the DOM matches the new label after the PATCH request.
   - **Add Edge**: Get initial edge count AFTER seed data loads. After POST request, assert edge count is `initialCount + 1`.
5. **F4 Add Node (Flaky State)**: `await expect(nodes).not.toHaveCount(0)` BEFORE reading `initialCount`.
6. **F3 Dynamic Locators**: Capture the `data-id` of the `.status-untested` node. Use `page.locator(\`.react-flow__node[data-id="\${nodeId}"]\`)` for all subsequent clicks and assertions.
7. **F3 SPA Hydration**: Wait for graph nodes to render (`await expect(nodes).not.toHaveCount(0)`) BEFORE reading the initial metrics count.
8. **F5 Debounce API Call**: Remove `page.waitForTimeout(1000)`. Wait for the specific request (e.g. `page.waitForRequest(req => req.url().includes('depth=4'))`).

## Actionable Summary for Worker
The Worker needs to:
1. Edit `d:\personal\living_graph_tc\e2e-tests\tests\tier1.spec.ts`.
2. Apply the 8 fix strategies completely.
3. Ensure the code contains NO `force: true` for overlay tests, NO `waitForTimeout` calls, and NO dynamic locator re-evaluations for state changes.
4. Ensure `await expect(locator).not.toHaveCount(0)` is always used BEFORE fetching an initial baseline count or reading `.innerText()`.
5. Verify code compiles with `npx tsc --noEmit`.
