# Fix Strategy: Tier 1 Playwright E2E Tests (Iteration 4)

## Consensus
The Explorer's fix strategy addresses the remaining flakiness and logic holes found by the Challenger and Reviewer:

1. **Shared Database State**: Add a `test.beforeEach` block at the top of the suite:
   ```typescript
   test.beforeEach(async ({ request }) => {
     await request.post('http://localhost:5173/api/reset').catch(() => {}); // Fallback in case endpoint is not implemented yet
   });
   ```
   (Note: Use `baseURL` if configured, or the appropriate API endpoint. We'll use `/api/reset`).

2. **Debounce Race Condition**: Wait for network idle before asserting exact API call count.
   ```typescript
   await page.waitForLoadState('networkidle');
   expect(apiCallCount).toBe(2); // Or 1, depending on the test logic (initial fetch + 1 debounce)
   ```

3. **Pane Click Flakiness**: Click at explicit coordinates to avoid hitting nodes:
   ```typescript
   await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } });
   ```

4. **Missing Awaits on Routes**: Add `await` to `route.abort()` and `route.continue()`.

5. **Brittle Topology Assumptions**: Replace `.nth(1)` with explicit ID negation:
   ```typescript
   const nodeA = nodes.first();
   const nodeAId = await nodeA.getAttribute('data-id');
   const nodeB = page.locator(`.react-flow__node:not([data-id="${nodeAId}"])`).first();
   ```

6. **Broad Error Masking**: Replace `.toThrow()` with specific overlay matching:
   ```typescript
   await expect(targetNode.click({ timeout: 1000 })).rejects.toThrowError(/intercepts pointer events/i);
   ```

7. **Conditional Logic**: Use exact assertions instead of arrays: `expect(tagName).toBe('input');`

8. **Deterministic Counts**: Wait for `/api/graph` response before counting initial nodes/edges:
   ```typescript
   const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
   await page.goto('/');
   await responsePromise;
   await expect(nodes).not.toHaveCount(0);
   const initialCount = await nodes.count();
   ```

## Actionable Summary for Worker
The Worker needs to:
1. Edit `d:\personal\living_graph_tc\e2e-tests\tests\tier1.spec.ts`.
2. Apply the 8 exact fix strategies as outlined above.
3. Ensure no conditional logic exists in assertions.
4. Ensure no `toThrow()` without an error regex.
5. Verify code compiles with `npx tsc --noEmit`.
