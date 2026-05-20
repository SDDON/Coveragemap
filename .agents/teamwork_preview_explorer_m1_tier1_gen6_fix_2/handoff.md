# Handoff Report: Iteration 5 Test Failures

## 1. Observation
- **TypeScript Error**: Reviewer 2 notes the worker missed creating a `tsconfig.json` in `/e2e-tests`, causing `npx tsc --noEmit` to fail.
- **Debounce Logic Weakness**: In `tier1.spec.ts:292-300`, the F5 "Debounce API Call" test simply types '4' into an input and waits for a single request. It does not verify rapid successive inputs are coalesced.
- **Hallucinated Selectors & Endpoints**: Tests rely on non-existent, highly specific CSS selectors (e.g., `.add-node`, `.node-category-input`, `.details-panel`) and strict REST endpoints (e.g., `POST /api/nodes` at line 211, `PATCH /api/nodes` at line 229) not defined in `ORIGINAL_REQUEST.md`.
- **Loading Overlay Brittle Check**: The F5 "Block Race Conditions" test (line 370) checks `expect(targetNode.click()).rejects.toThrowError(/intercepts pointer events/i)`. If the overlay has `pointer-events: none`, the click passes through, making this check inadequate to ensure clicks are actually blocked.
- **State Bleeding**: The F4 "Graph Editing" suite adds and deletes nodes/edges but has no `test.beforeEach` block. This mutates the underlying DB state, risking state-bleeding into subsequent tests.
- **Topological & Layout Assumptions**: 
  - Tests like "Shift Focus" (line 72) and "Add Edge" arbitrarily select nodes without `.first()`, leading to strict mode violations.
  - "Add Edge" selects arbitrary target nodes that might already be connected, which is a topology assumption.
  - "Restore Context" test (line 61) clicks `{x: 10, y: 10}`, a brittle layout assumption.
  - Flaky `.count()` evaluations occur before the graph is fully stable (waiting for rendering).

## 2. Logic Chain
- **TypeScript Config**: Playwright requires a local `tsconfig.json` in the `e2e-tests` directory to define compiler options for `tsc` when type-checking tests.
- **Debouncing**: To prove debounce works, the test must simulate multiple rapid keystrokes and verify that only a *single* API call is made after the debounce window expires.
- **Hallucinations**: Since this is test-driven development (M1), tests must rely on accessible semantic locators (e.g., `getByRole('button', { name: /add/i })`) and generic API matching (`**/api/**`) instead of guessing implementation details like exact CSS classes or REST routes.
- **Overlay State Check**: Instead of checking if Playwright throws an interception error, we should forcefully click the target node while the overlay is visible and explicitly assert that the node's state *did not change* (e.g., it did not become active). This ensures the UI ignores clicks regardless of CSS properties.
- **State Bleeding**: E2E tests modifying persistent state require isolation. Adding a `test.beforeEach` to call a backend reset endpoint (e.g., `/api/dev/reset-seed`) ensures each test starts with pristine seed data.
- **Flakiness & Assumptions**:
  - *Strict Mode*: Handle locators must use `.first()` or `.nth()` to avoid violations when multiple nodes match.
  - *Stability*: Tests must wait for the graph to render (e.g., waiting for specific data attributes or an expected minimum count) rather than synchronously checking `.count()`.
  - *Layout*: Instead of clicking arbitrary coordinates (`{x:10, y:10}`) to clear focus, click the background element directly (e.g., `page.locator('.react-flow__pane')` without offsets, or rely on a semantic background selector).
  - *Topology*: When adding an edge, select two nodes that are explicitly *not* connected (verifying no edge exists between them first) rather than hoping the target node is disconnected.

## 3. Caveats
- We are proposing a `/api/dev/reset-seed` endpoint for state isolation. The implementer of the FastAPI backend (in a future milestone) will need to add this endpoint.
- Shifting to semantic locators like `getByRole` dictates that the UI implementer must build an accessible frontend (e.g., using proper `<button>` elements and aria labels).

## 4. Conclusion
The `tier1.spec.ts` needs a refactor to eliminate hallucinations, enforce correct debounce testing, verify actual state protection during loading, and reset backend state between mutation tests. Strict mode violations, layout assumptions, and flaky `.count()` checks must be resolved. A `tsconfig.json` must be introduced for the test directory.

### Concrete Fix Strategy (Proposed Changes)

**1. Create `e2e-tests/tsconfig.json`**
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

**2. State Bleeding Fix (DB Reset)**
Add a hook to `tier1.spec.ts` (e.g., at the top of mutation suites like F4):
```typescript
test.beforeEach(async ({ request }) => {
  // Reset the Neo4j seed data before each test
  await request.post('/api/dev/reset-seed');
});
```

**3. Anti-Hallucination (Semantic Locators & Generic APIs)**
Refactor CSS selectors and explicit endpoints:
```typescript
// Before:
const addNodeBtn = page.locator('button.add-node');
const requestPromise = page.waitForRequest(req => req.url().includes('/api/nodes') && req.method() === 'POST');

// After:
const addNodeBtn = page.getByRole('button', { name: /add node/i });
// Wait for any non-GET API mutation instead of hallucinating the exact endpoint
const requestPromise = page.waitForRequest(req => req.url().includes('/api/') && req.method() !== 'GET');
```

**4. Strengthen Debounce Test**
```typescript
test('Debounce API Call', async ({ page }) => {
  await page.goto('/');
  let requestCount = 0;
  page.on('request', req => {
    if (req.url().includes('/api/graph')) requestCount++;
  });
  
  const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
  await depthInput.fill('2');
  await depthInput.fill('3');
  await depthInput.fill('4');
  
  await page.waitForTimeout(500); // Wait for debounce period
  expect(requestCount).toBe(1); // Only one request should be sent
});
```

**5. Robust Loading Overlay Test**
```typescript
test('Block Race Conditions', async ({ page }) => {
  // ... trigger loading overlay ...
  const overlay = page.getByTestId('loading-overlay');
  await expect(overlay).toBeVisible();
  
  // Force click bypassing pointer-events checks, verify no state change occurs
  await targetNode.click({ force: true });
  await expect(targetNode).not.toHaveClass(/active/);
});
```

**6. Flakiness, Layout, and Topology Fixes**
- **Strict Mode**: Ensure `.first()` or `.nth(0)` is used on locators like `sourceNode.locator('.react-flow__handle.source')`.
- **Graph Stability**: Replace `await nodes.count()` with `await expect(nodes).toHaveCount(expectedCount)` or wait for a specific node to appear.
- **Brittle Layout**: Replace `await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } })` with `await page.locator('.react-flow__pane').click()` directly.
- **Topology**: To add an edge without assumptions, find an unconnected pair or filter out existing edges:
```typescript
const nodes = page.locator('.react-flow__node');
await expect(nodes).toHaveCount(2); // Wait for stability
const sourceNode = nodes.nth(0);
const targetNode = nodes.nth(1);
// Ensure they aren't already connected, or just allow the test to connect them if the backend allows duplicates.
// Best approach: reset DB in beforeEach, guaranteeing a known seed topology.
```

## 5. Verification Method
- **TypeScript**: Run `npx tsc --noEmit -p e2e-tests/tsconfig.json` to verify the config creation.
- **Logic**: Review `tier1.spec.ts` to confirm locators are semantic (`getByRole`, etc.) and no `POST /api/nodes` exact routes are hardcoded.
- **Test Execution**: Once the UI is implemented, running `npx playwright test e2e-tests/tests/tier1.spec.ts` should pass without state-bleeding flakes, strict mode violations, or layout failures.
