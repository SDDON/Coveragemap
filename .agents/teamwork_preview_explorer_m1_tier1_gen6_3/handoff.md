# Handoff Report

## 1. Observation
- **Debounce API Call (F5)**: In `e2e-tests/tests/tier1.spec.ts` (lines 292-300), the test uses `await depthInput.fill('4');` and waits for a single request. This doesn't actually test if debouncing prevents multiple requests because `fill()` acts instantly.
- **Form Submission Validation (F6)**: In `e2e-tests/tests/tier1.spec.ts` (lines 409-418), the test clicks `button.save-node` and immediately asserts `expect(...).toHaveCount(0)`. This asserts before the UI has a chance to render the result of the backend request.
- **Shared State / Persistent Backend**: A check of `backend/database.py` shows the app connects to a Neo4j database (`bolt://localhost:7687`), which is a persistent storage. The tests in `F3` and `F4` currently mutate nodes/edges directly on the seed data (e.g., clicking `.delete-node` on the first node) without any cleanup. Since state persists across tests, this causes flaky behavior and order dependencies depending on which test runs first.

## 2. Logic Chain
1. **Debounce fix**: To verify debounce, we must simulate rapid typing over time. Using `pressSequentially('234', { delay: 100 })` forces the input to emit multiple change events. We can then count the total fired `/api/graph` requests. If debounce is working, exactly one request (for `depth=4`) will be made.
2. **Form validation fix**: To avoid race conditions between the Playwright execution and the React rendering cycle, we must wait for the actual network update (`page.waitForResponse` for `/api/nodes`) before we assert that validation errors are not present on the screen.
3. **Shared state fix**: Because the Neo4j backend is persistent and does not auto-reset between tests, every mutation permanently modifies the graph for subsequent tests. We must isolate tests by ensuring they clean up their modifications:
   - For status changes (`F3`), tests must click `.reset-status` at the end to revert the node/edge to untested.
   - For creations/edits/deletions (`F4`), tests should operate on uniquely identifiable nodes (using `Date.now()` in labels).
   - Rather than deleting seed nodes/edges, `Delete Node`/`Delete Edge` tests must first *create* temporary nodes/edges, and then delete those, leaving the seed data untouched.

## 3. Caveats
- I did not test the exact UI selector behavior of React Flow handles during the drag-and-drop for `Add Edge`. It is assumed that dragging from `.react-flow__handle.source` to `.react-flow__handle.target` works reliably when creating temporary nodes, just as it did for seed nodes.
- When creating unique temporary nodes for edge tests, I assume they automatically spawn with handles (source/target) visible for dragging.

## 4. Conclusion
The `tier1.spec.ts` tests need to be rewritten to eliminate deterministic and order-dependency flaws:
1. **F5 Debounce**: Use `pressSequentially` and count the network requests to assert strictly exactly 1 call is made.
2. **F6 Validation**: `await` the network response (`/api/nodes`) before asserting validation errors are hidden.
3. **F3 & F4 State isolation**: Introduce explicit cleanup steps. `F3` tests must reset status. `F4` tests must use unique data (`Date.now()`) and create temporary nodes for deletion/edge tests instead of cannibalizing the seed data.

## 5. Verification Method
1. The implementer should rewrite `tier1.spec.ts` following these guidelines.
2. Run `npx playwright test e2e-tests/tests/tier1.spec.ts --workers=1` (or parallel if safe) and ensure it passes completely.
3. Run the test suite multiple times in a row (`npx playwright test --repeat-each=5`) without resetting the backend, to prove that state mutations are properly cleaned up and isolated.
