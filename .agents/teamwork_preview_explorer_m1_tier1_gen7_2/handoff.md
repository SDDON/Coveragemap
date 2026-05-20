# Handoff Report: Integrity Violations & Feedback Analysis

## 1. Observation
I reviewed `d:\personal\living_graph_tc\e2e-tests\tests\tier1.spec.ts` and identified the following lines corresponding to the reported feedback:

- **Auditor (F5 Debounce API Call):**
  Lines 394-395 filter requests using `req.url().includes('/api/') && req.method() !== 'GET'`. The requests triggered by the depth input actually use `GET /api/graph?depth=X`, which are ignored by this test, making it a facade.
- **Reviewer 1 (F5 Block Race Conditions):**
  Line 474 uses `.click({ force: true })`, deliberately disabling Playwright's actionability checks (which test if an element is obscured by the loading overlay).
- **Reviewer 1 (F6 Form Submission Validation):**
  Lines 523-527 wait for a request to be initiated (`waitForRequest`) and immediately assert `toHaveCount(0)` on validation errors, bypassing the UI update cycle entirely.
- **Reviewer 1 (F3 Undocumented Selectors):**
  Lines 134, 140, 157, 164, 185, 192, 211, and 214 rely on undocumented CSS classes for buttons (`button.mark-passed`, `button.mark-failed`, `button.reset-status`).
- **Challenger 2 (F3 State Bleeding):**
  Lines 121-125 show F3's `beforeEach` does not use the `/api/dev/reset-seed` endpoint. F3 tests (e.g., lines 139-141, 162-169, 190-197, 219-224) use manual, imperative cleanup steps that are brittle. Similar manual cleanup is present in F4 (e.g., lines 276-279, 301-307) and F6 (lines 529-535).
- **Challenger 2 (F1 Hardcoded URLs):**
  Lines 31 and 483 hardcode `http://localhost:8000` instead of relying on the relative API path inherited from `request` configuration.
- **Challenger 2 (Loading Overlay Locator Inconsistency):**
  Lines 424 and 444 use `.locator('.loading-overlay')`, whereas line 471 uses `.getByTestId('loading-overlay')`.

## 2. Logic Chain
1. **F5 Debounce:** The test intends to measure the number of GET requests triggered by depth input changes. It must count requests matching `/api/graph?depth=` instead of strictly excluding GET requests.
2. **F5 Race Conditions:** Bypassing click interception with `force: true` defeats the purpose of checking if the UI is blocked. The test should attempt a regular click with a short timeout and expect it to fail (throw) due to the overlay intercepting the event.
3. **F6 Validation:** Asserting the absence of an error element instantly after a request starts is a race condition that passes vacuously. The test must await `waitForResponse` to ensure the server processed it, and then check that the error locator is hidden.
4. **F3 Selectors:** Undocumented layout-bound selectors are fragile. Locating by accessible roles (e.g., `getByRole('button', { name: /pass/i })`) is idiomatic and resilient.
5. **State Bleeding:** Test suites that mutate graph state (F3, F4, F6) must share a unified `beforeEach` hook calling the backend reset endpoint. Once centralized, all imperative `// Cleanup` blocks within individual tests can be safely removed, preventing state leakage if a test fails midway.
6. **Hardcoded URLs:** Removing the base URL domain allows tests to run consistently across environments.
7. **Locator Consistency:** Standardizing the overlay locator strictly to `getByTestId('loading-overlay')` enhances maintainability and alignment with testing best practices.

## 3. Caveats
- The fix strategy assumes that buttons in F3 contain standard text like "Pass", "Failed", and "Reset". If they use an icon-only or different text design, `getByRole` may need tweaking.
- Standardizing to `getByTestId('loading-overlay')` assumes `data-testid="loading-overlay"` is set on the element in the application.

## 4. Conclusion
The file contains several structural facades and brittle test setups. The following concrete fixes must be applied by the implementer:

1. **F5 Debounce:** Change the request counter filter to: `if (req.url().includes('/api/graph?depth=')) requestCount++;`
2. **F5 Race Conditions:** Remove `force: true`. Catch the expected interception error:
   ```typescript
   const err = await targetNode.click({ timeout: 1000 }).catch(e => e);
   expect(err.message).toMatch(/intercepted|timeout/i);
   ```
3. **F6 Validation:** Change `waitForRequest` to `waitForResponse` and ensure status is 200. Change the assertion to `await expect(page.locator('.validation-error')).toBeHidden();`
4. **F3 Selectors:** Replace `button.mark-passed`, `button.mark-failed`, and `button.reset-status` with `page.getByRole('button', { name: /pass/i })` (and similarly for fail/reset).
5. **State Bleeding:** 
   - Add `await request.post('/api/dev/reset-seed');` to the `beforeEach` blocks of F3 and F6.
   - Delete all `// Cleanup` blocks across F3, F4, and F6.
6. **Hardcoded URLs:** Remove `http://localhost:8000` from lines 31 and 483, leaving just the relative path (`/api/...`).
7. **Locator Consistency:** Replace `.locator('.loading-overlay')` with `.getByTestId('loading-overlay')` in F5.

## 5. Verification Method
- **Code Inspection:** Verify that `tier1.spec.ts` no longer contains `force: true`, `req.method() !== 'GET'`, `http://localhost:8000`, or `button.mark-passed`. Verify `// Cleanup` blocks are absent.
- **Execution:** Run the E2E tests: `npx playwright test e2e-tests/tests/tier1.spec.ts`. All 30 tests must pass reliably without flakiness or state bleeding.
