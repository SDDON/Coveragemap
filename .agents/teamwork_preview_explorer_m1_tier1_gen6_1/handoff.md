# M1 Tier 1 Test Failure Analysis & Fix Strategy

## 1. Observation
I reviewed `e2e-tests/tests/tier1.spec.ts` and identified the logic flaws causing the review failures:
- **Debounce API Call (F5) (Line 292)**: The test only enters a single value (`await depthInput.fill('4')`) and waits for `depth=4`. This passes even if the frontend has no debounce logic at all.
- **Form Submission Validation (F6) (Line 409)**: The test asserts `await expect(page.locator('.validation-error')).toHaveCount(0)` immediately after clicking the `button.save-node`. Because Playwright is faster than the DOM updating during an async network call, this yields a false positive.
- **Shared State Flakiness (F3 & F4) (Line 120-289)**:
  - Many tests (e.g., `Node Properties Rendering`, `Mark Passed`) call `await page.goto('/')` but do not wait for the `/api/graph` network request to complete before interacting with nodes.
  - Tests explicitly mutate and delete the initial seed data. For example, `Delete Node` (Line 236) deletes the first seed node it finds. `Add Node` (Line 198) adds to the global node count without cleaning up. In a persistent backend, this permanently changes the state for subsequent tests, causing flakiness.

## 2. Logic Chain
- **F5 (Debounce)**: To verify debounce works, we must simulate rapid typing that triggers the event handler multiple times before the debounce timer expires. Counting the network requests matching the endpoint over this period proves whether the debounce prevented the intermediate requests.
- **F6 (Validation)**: Because form submission triggers a backend request (`PATCH` or `POST` to `/api/nodes`), the validation state is only finalized *after* that request completes. Waiting for the response ensures we are checking the true final state of the UI.
- **Shared State & Order Dependency**:
  - Without waiting for the initial graph load in every test, race conditions will occur where Playwright attempts to click nodes that haven't rendered yet.
  - To support a persistent backend, E2E tests must be hermetic (self-contained). Mutating tests must generate their own unique test data (e.g., nodes with a `Date.now()` label) and destroy that data at the end of the test.

## 3. Caveats
- When generating unique labels, using `Date.now()` is generally safe for sequential E2E tests, but appending a random string or UUID ensures zero collisions if run in parallel workers.
- When asserting the request count in the debounce test, we must filter strictly by `req.url().includes('/api/graph?depth=')` to avoid counting unrelated API calls that the app might make in the background.

## 4. Conclusion
Implement the following fix strategy for `tier1.spec.ts`:

1. **Global Setup**: Add a `test.beforeEach` to every suite (or globally) to navigate to `/` and explicitly `await` the `/api/graph` GET request. Remove duplicate `page.goto('/')` from individual tests.
2. **F5 (Debounce API Call)**:
   - Attach a `page.on('request')` listener to count requests to `*api/graph?depth=*`.
   - Clear the input, then sequentially trigger multiple changes rapidly: `await depthInput.fill('2'); await depthInput.fill('3'); await depthInput.fill('4');` (or use `pressSequentially('234')` if the input accepts multi-character sequences).
   - Wait for the final API response (`depth=4` or `depth=234`) and a short additional timeout (e.g., 500ms).
   - Assert the request count is exactly `1`.
3. **F6 (Form Submission Validation)**:
   - After filling in a valid category and clicking 'Save', add `await page.waitForResponse(res => res.url().includes('/api/nodes') && (res.request().method() === 'PATCH' || res.request().method() === 'POST'));`.
   - *Then* assert the validation errors have a count of 0.
4. **F3 & F4 (Shared State / Persistent Backend Cleanup)**:
   - **Add Node**: Use a unique label (e.g., `New Node ${Date.now()}`). After asserting addition, click it and delete it.
   - **Edit Node**: Create a new test node, edit it with a unique label, assert, then delete it.
   - **Delete Node**: Create a new test node, verify it exists, then delete it and verify it's gone.
   - **Add/Delete Edge**: Create two new test nodes, add/delete the edge between them, then delete the nodes.
   - **F3 (Living TC)**: After marking a node as Passed/Failed, click `Reset Status` at the end of the test to restore its state.

## 5. Verification Method
- Execute the test suite using `npx playwright test e2e-tests/tests/tier1.spec.ts`.
- Run the tests multiple times in parallel (`--workers 4 --repeat-each 5`) to verify that the shared state flakiness and race conditions are fully resolved.
- To verify the debounce test (F5) specifically, temporarily disable debounce in the frontend code; the test should fail with a request count > 1.
