# Synthesis: Iteration 7 Fix Strategy (INTEGRITY VIOLATION REMEDIATION)

## Overview
This iteration MUST resolve the strict **Integrity Violations** identified by the Forensic Auditor and Reviewer 1, alongside the critical flaws identified by Challenger 2. The Worker must rigidly follow these fixes in `tier1.spec.ts` without introducing new facades.

## 1. Auditor Integrity Violation Fix: Debounce Facade
**Flaw:** The debounce test ignored `GET` requests, but the actual depth update (`/api/graph?depth=X`) is a `GET` request.
**Fix:** The test MUST count `/api/graph` `GET` requests.
```typescript
test('Debounce API Call', async ({ page }) => {
  await page.goto('/');
  let requestCount = 0;
  page.on('request', req => {
    // FIX: Only count the specific GET requests we are debouncing!
    if (req.url().includes('/api/graph') && req.method() === 'GET') {
      requestCount++;
    }
  });
  
  const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
  await depthInput.fill('2');
  await depthInput.fill('3');
  await depthInput.fill('4');
  
  await page.waitForTimeout(500);
  expect(requestCount).toBe(1); // Exactly one request should be fired
});
```

## 2. Reviewer 1 Integrity Violation Fix: Race Conditions Facade
**Flaw:** The test used `.click({ force: true })`, explicitly disabling Playwright's interception checks and creating a facade.
**Fix:** Perform a normal click and expect it to fail/throw due to interception by the overlay.
```typescript
test('Block Race Conditions', async ({ page }) => {
  const overlay = page.getByTestId('loading-overlay');
  await expect(overlay).toBeVisible();
  
  // FIX: Verify that the overlay natively intercepts the click. DO NOT USE force: true!
  await expect(targetNode.click({ timeout: 1000 })).rejects.toThrowError(/intercepts pointer events/i);
});
```

## 3. Reviewer 1 Fix: Validation Race Condition
**Flaw:** The test asserted `toHaveCount(0)` on validation errors immediately after `waitForRequest`, checking the DOM *before* the server responded.
**Fix:** Wait for the successful API *response* before checking the DOM.
```typescript
// After clicking submit:
const response = await page.waitForResponse(res => res.url().includes('/api/') && res.status() === 200);
await expect(page.locator('.validation-error')).toHaveCount(0);
```

## 4. Reviewer 1 & Challenger 2 Fix: Hallucinated Selectors & Consistency
**Flaw:** Tests used undocumented CSS like `button.mark-passed` and mixed `.loading-overlay` vs `getByTestId('loading-overlay')`.
**Fix:** 
- Use semantic locators exclusively: `page.getByRole('button', { name: /mark passed/i })`
- Standardize the loading overlay: `page.getByTestId('loading-overlay')`

## 5. Challenger 2 Fix: F3 State Bleeding
**Flaw:** F3 lacked a `test.beforeEach` API reset, relying on manual cleanup which leaked state if a test crashed.
**Fix:** 
- Add `test.beforeEach` to F3: `await request.post('/api/dev/reset-seed');`
- Remove all manual `// Cleanup` blocks at the end of the F3 tests.

## 6. Challenger 2 Fix: Hardcoded URLs
**Flaw:** F1 hardcoded `http://localhost:8000` instead of using the Playwright base URL.
**Fix:** Replace all hardcoded absolute URLs with relative paths (e.g. `/api/graph`).
