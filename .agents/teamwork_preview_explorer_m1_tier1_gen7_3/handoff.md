# Handoff Report: Analysis of Integrity Violations in `tier1.spec.ts`

## 1. Observation
After reviewing `e2e-tests/tests/tier1.spec.ts`, all violations reported by the Auditor, Reviewer 1, and Challenger 2 were identified:

1. **Auditor (F5 - Debounce API Violation):** Lines 393-394 set up the request listener with `req.url().includes('/api/') && req.method() !== 'GET'`. The API being debounced (`/api/graph?depth=X`) is a `GET` request. 
2. **Reviewer 1 (F5 - Race Conditions):** Line 474 directly invokes `await targetNode.click({ force: true });`, bypassing Playwright's click interception checks.
3. **Reviewer 1 (F6 - Validation):** Lines 523-527 call `waitForRequest` and then instantly assert `toHaveCount(0)` on `.validation-error`, checking the DOM before the server response returns and UI updates.
4. **Reviewer 1 (F3 - Undocumented Selectors):** Lines 134, 140, 157, 164, etc., use CSS selectors like `button.mark-passed` and `button.reset-status` instead of semantic roles.
5. **Challenger 2 (F3 - State Bleeding):** Line 121's `beforeEach` block only waits for graph loading but omits the `/api/dev/reset-seed` database reset. As a result, tests in F3 depend on brittle manual `// Cleanup` blocks (Lines 139-141, 162-169, 190-197, 219-224, 244-247).
6. **Challenger 2 (Hardcoded URLs):** Lines 31 and 483 hardcode `http://localhost:8000`.
7. **Challenger 2 (Locator Inconsistency):** Lines 424 and 444 query `.loading-overlay`, whereas line 471 correctly uses `page.getByTestId('loading-overlay')`.

## 2. Logic Chain
1. **Debounce Fix:** The F5 debounce test is a facade because it monitors the wrong method. Filtering for `/api/graph` and `req.method() === 'GET'` (or specific parameters like `depth=`) is required to count the actual depth update calls.
2. **Race Condition Fix:** `force: true` deliberately avoids checking for actionable state, hiding whether the overlay actually intercepts clicks. Replacing it with `await expect(targetNode.click({ timeout: 1000 })).rejects.toThrow()` verifies that Playwright correctly intercepts the click because of the overlay, explicitly testing the blocker.
3. **Validation Fix:** Asserting the absence of an error immediately after a request launches is a race condition. The test must wait for a successful response (via `waitForResponse` or checking a success state in the UI) before asserting no validation errors exist.
4. **Semantic Selectors:** Replacing CSS selectors with `page.getByRole('button', { name: /mark passed/i })` aligns with Playwright best practices and improves test resilience.
5. **State Reset Fix:** Introducing `await request.post('/api/dev/reset-seed');` in F3's `beforeEach` (similar to F4) enforces strict isolation per test. The manual cleanup blocks must then be completely removed.
6. **URL & Locator Consistency:** Changing hardcoded endpoints to relative URLs (e.g., `/api/graph`) ensures tests leverage Playwright's Base URL. Standardizing to `getByTestId('loading-overlay')` creates uniform selector usage across F5.

## 3. Caveats
- I am assuming that the `/api/dev/reset-seed` endpoint correctly resets nodes and their test coverage statuses (passed/failed/untested) for F3.
- Removing manual cleanup from F3 implies that `reset-seed` covers all states perfectly.
- The Race Conditions test fix assumes the `loading-overlay` prevents pointer events natively via CSS (`pointer-events: auto` vs `none`) or z-index hierarchy. If the underlying UI doesn't actually block events correctly, the test will fail as expected (which is desired behavior).

## 4. Conclusion
`tier1.spec.ts` contains substantial facades and bad practices across multiple test blocks (F1, F3, F5, F6). The file must be aggressively rewritten using the strategies in the Logic Chain to remove facades: debounce must count the correct GET requests, race conditions must verify click interception (by expecting a timeout error on click), assertions must wait for network responses, semantic locators must be used throughout, state must be reset globally per test, URLs must be relative, and locators must be consistent.

## 5. Verification Method
1. The Implementer agent should apply these targeted fixes to `tier1.spec.ts`.
2. Run `npx playwright test e2e-tests/tests/tier1.spec.ts`.
3. Check the logs to ensure no facade/timeout warnings are skipped.
4. Intentionally disable debounce in the UI to confirm the test fails (validating it is no longer a facade).
