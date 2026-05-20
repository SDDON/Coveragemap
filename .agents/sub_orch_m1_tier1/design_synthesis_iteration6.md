# Synthesis: Iteration 6 Fix Strategy

## Overview
Based on Explorer 2's comprehensive analysis, we will implement the following changes to `d:\personal\living_graph_tc\e2e-tests\tests\tier1.spec.ts` to satisfy the Reviewer and Challenger requirements.

## 1. Create `e2e-tests/tsconfig.json`
To resolve the `tsc --noEmit` failure, create the `tsconfig.json` file inside `d:\personal\living_graph_tc\e2e-tests`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["**/*.ts"]
}
```

## 2. Fix State-Bleeding
Add a `test.beforeEach` hook to reset the database state before mutation tests (e.g., in the Graph Editing suite):
```typescript
test.beforeEach(async ({ request }) => {
  await request.post('/api/dev/reset-seed');
});
```

## 3. Anti-Hallucination: Semantic Locators & Loose API Matching
Replace hallucinated CSS classes (e.g., `.add-node`) and strict endpoint routes (`POST /api/nodes`) with semantic selectors:
- Use `page.getByRole('button', { name: /add node/i })`.
- Use `page.getByRole('textbox', { name: /node category/i })`.
- Wait for generic API mutations: `req.url().includes('/api/') && req.method() !== 'GET'`.

## 4. Strengthen Debounce Test (AUDITOR INTEGRITY VIOLATION FIX)
The Auditor vetoed the previous debounce test as a "facade implementation" because it only performed a single `.fill()`. You MUST fix this by simulating rapid successive typing and verifying that ONLY ONE request is sent:
```typescript
test('Debounce API Call', async ({ page }) => {
  await page.goto('/');
  let requestCount = 0;
  page.on('request', req => {
    if (req.url().includes('/api/') && req.method() !== 'GET') requestCount++;
  });
  
  const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
  await depthInput.fill('2');
  await depthInput.fill('3');
  await depthInput.fill('4');
  
  await page.waitForTimeout(500);
  expect(requestCount).toBe(1);
});
```

## 5. Loading Overlay Robustness
Instead of expecting a click error (which bypasses if `pointer-events: none` is set), use `force: true` and verify no state change occurred on the target node:
```typescript
test('Block Race Conditions', async ({ page }) => {
  const overlay = page.getByTestId('loading-overlay');
  await expect(overlay).toBeVisible();
  
  await targetNode.click({ force: true });
  await expect(targetNode).not.toHaveClass(/active/);
});
```

## 6. Strictness and Stability (Challenger 2 Feedback)
- **Strict Mode**: Use `.first()` or `.nth(0)` when selecting handles to avoid strict mode violations (e.g., multiple `.react-flow__handle` elements).
- **Flaky Counts**: Do NOT use `.count()` directly. Instead, use Playwright web-first assertions like `await expect(nodes).toHaveCount(2)`.
- **Layout Assumptions**: Remove brittle `{x: 10, y: 10}` layout assumptions. Rely on the DOM element bounds or semantic actions.
- **Topology Assumptions**: Because of the `test.beforeEach` DB reset, you can safely assume the topology of the fresh seed data. Do not arbitrarily select targets that might already be connected.
