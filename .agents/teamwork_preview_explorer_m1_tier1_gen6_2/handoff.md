# Handoff Report

## 1. Observation
- **Debounce API Call (F5)** (line 292-300): The test types a single value `await depthInput.fill('4')` and waits for one request. This passes immediately even if debouncing is broken because it only triggers one change event.
- **Form Submission Validation (F6)** (line 409-418): The test clicks the save button `await page.locator('button.save-node').click()` and immediately checks `await expect(page.locator('.validation-error')).toHaveCount(0)`. Because the UI hasn't had time to update or complete the backend request, this passes instantly and falsely.
- **Shared State Flakiness (F3, F4)**: Tests like "Add Node", "Edit Node Properties", "Delete Node", and the status markers in F3 mutate backend state but do not clean up. For instance, "Delete Node" deletes the first seed node, making it unavailable for subsequent tests. "Edit Node Properties" permanently changes the first node's label.

## 2. Logic Chain
- To accurately test **Debounce**, we must simulate real user typing. Using `pressSequentially` with a delay generates multiple input events. By tracking network requests, we can verify that only one request is dispatched after the user finishes typing, proving the debounce logic works.
- To accurately test **Form Submission Validation**, we must wait for the asynchronous operation (the API call) to resolve before evaluating the UI state. Waiting for the `PATCH`/`POST` response ensures the form submission lifecycle has completed.
- To eliminate **Shared State Flakiness** and order dependencies, tests must be completely isolated:
  1. Adding a `test.beforeEach` to reload the page and wait for seed data ensures a clean UI state for every test.
  2. Any test that mutates data must revert it: status marking tests should click "reset-status" at the end.
  3. "Add Node" must use a unique identifier (e.g., timestamp) and delete the created node afterwards.
  4. "Delete Node" should create a temporary node first and delete that, rather than destroying seed data.
  5. "Edit Node" should restore the original label.

## 3. Caveats
- We are assuming that the UI has a "reset-status" button that works for both nodes and edges (as seen in the "Reset Status" test).
- We assume that the `DELETE` actions are exposed in the UI for the newly created temporary nodes and edges.
- These strategies focus on functional cleanup through the UI. If the UI lacks complete cleanup capabilities, direct API teardown calls (`test.afterEach` via Playwright's `request`) would be required.

## 4. Conclusion
We must implement the following Fix Strategy for Iteration 6 in `tier1.spec.ts`:

### Fix 1: F5 Debounce API Call
- Clear the input field.
- Set up a network interceptor (`page.route`) to count the number of calls to `**/api/graph?depth=*`.
- Use `await depthInput.pressSequentially('234', { delay: 100 })` to simulate user typing.
- Wait for the final API response (`depth=234`).
- Assert that exactly 1 request was captured by the interceptor.

### Fix 2: F6 Form Submission Validation
- After `await page.locator('button.save-node').click();`, await the network response: `await page.waitForResponse(res => res.url().includes('/api/nodes') && res.request().method() === 'PATCH');` (or `POST`).
- Only after this promise resolves, evaluate `await expect(page.locator('.validation-error')).toHaveCount(0);`.

### Fix 3: Deterministic Data Mutation & Cleanup (F3, F4)
- **Global**: Add `test.beforeEach` in mutating suites (F3, F4) to `await page.reload()` and wait for `GET /api/graph` (status 200).
- **F3 (Living TC)**: In "Mark Passed" / "Mark Failed", append cleanup steps at the end of the test to click `reset-status` on the mutated node/edge.
- **F4 (Graph Editing)**:
  - **Add Node**: Append `Date.now()` to the label (`New Node ${Date.now()}`). At the end of the test, locate this specific node, click it, and delete it.
  - **Edit Node**: Save the node's original label before editing. After verifying the edit, edit it again to restore the original label.
  - **Delete Node**: Do not delete seed nodes. First, add a temporary node (`Delete Target ${Date.now()}`), save it, then select it and delete it. Verify it is removed.
  - **Add/Delete Edge**: Similarly, create temporary nodes/edges specifically for these tests and delete them at the end, ensuring seed data remains intact.

## 5. Verification Method
- **Code Inspection**: Review `tier1.spec.ts` to ensure `pressSequentially`, network waits, and cleanup logic are present.
- **Test Execution**: Run `npx playwright test e2e-tests/tests/tier1.spec.ts --headed`.
- **Validation**:
  - The F5 test should simulate typing and visually show only one loading cycle.
  - The F3/F4 tests should run successfully in any order (e.g., using `--fully-parallel` or `test.describe.configure({ mode: 'parallel' })`) without cross-test contamination.
