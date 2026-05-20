# Fix Strategy: Tier 1 Playwright E2E Tests

## Consensus
The Explorer's fix strategy perfectly addresses the Forensic Auditor and Challenger's findings:
1. **Remove Tautologies**: In F2 tests, select specific edges/nodes before the action, then assert those specific elements acquire the `.de-emphasized` class (do not select elements by `.de-emphasized` and check if they have that class).
2. **Remove Bypasses**: Remove all `if` blocks wrapping assertions. Assert prerequisites (e.g. `expect(nodeId).toBeTruthy()`), then assert the state (e.g., `await expect(page.locator(`...`)).toHaveCount(0)`).
3. **Strict Bounds**: Instead of `toBeGreaterThan(0)`, use exact count increments: `initialCount = await nodes.count()`, then `await expect(nodes).toHaveCount(initialCount + 1)`.
4. **Remove Error Suppression**: In F5 'Block Race Conditions', remove `.catch(() => {})`. Test blocked interactions by using `expect(page.locator(...).click({ timeout: 1000 })).rejects.toThrow()`.
5. **Fix Asynchrony**: Add missing `await` to `page.goto('/')` in F5.
6. **Use Web-First Assertions**: Replace all instant checks like `expect(await locator.count()).toBe(...)` with auto-retrying assertions like `await expect(locator).toHaveCount(...)`.
7. **Authentic Input**: Replace `.evaluate(el => el.value = ...)` with `await locator.fill(...)` to trigger React events properly.

## Actionable Summary for Worker
The Worker needs to:
1. Edit `d:\personal\living_graph_tc\e2e-tests\tests\tier1.spec.ts`.
2. Apply the above 7 fix strategies completely.
3. Visually verify the code contains no `if (` blocks wrapping assertions, no `.catch(() => {})` handlers on clicks, and no `.evaluate` for input filling.
4. Verify code compiles with `npx tsc --noEmit`.
