# Handoff Report: tier1.spec.ts Fix Strategy

## Observation
I reviewed `d:\personal\living_graph_tc\e2e-tests\tests\tier1.spec.ts` to confirm the auditor's and challenger's findings. The test suite contains multiple structural violations of the "General Project" integrity policy:
1. **Tautological Assertions:** In `Edge Highlighting` (lines 85-91), edges are selected by the `.de-emphasized` class, and then asserted to have that exact class, rendering the test useless.
2. **Conditional Bypasses:** In multiple tests, `if` statements silently skip assertions if elements or attributes are missing (`if (nodeId)` at line 201, `if (edgeId)` at line 223, `if (await categoryInput.isVisible())` at line 328, `if (await otherNodes.count() > 0)` at line 101).
3. **Weak & Flaky Assertions:** Assertions like `expect(await nodes.count()).toBeGreaterThan(0)` (line 179) provide no guarantee that an Add Node operation succeeded. Flaky `await count()` calls evaluate instantly without waiting for DOM updates.
4. **Error Suppression:** The `Block Race Conditions` test (line 285) uses `.catch(() => {})` to swallow errors, hiding potential test setup failures.
5. **Missing Awaits:** `page.goto('/')` on line 280 lacks an `await`, leading to race conditions.
6. **Bypassing React:** The `Block Free Text` test (line 340) mutates the DOM directly using `.evaluate((el) => el.value = '...')`, which circumvents React's synthetic event system.

## Logic Chain
1. Playwright tests must authentically simulate user interactions and verify actual application state.
2. Using `.catch()` or `if` blocks around assertions allows the test to pass even if the UI is broken (e.g., if nodes render without `data-id`s). Removing them enforces a strict "fail if missing" policy.
3. Asserting a class on an element selected by that class is a logical tautology. Elements must be selected by domain properties (e.g., `data-id`, `data-source`) or structural position before checking visual state classes.
4. `count()` evaluates instantly. By using `await expect(locator).toHaveCount(...)`, Playwright's auto-retrying mechanism will correctly wait for the UI to settle. For state changes (like Add Node), exact increment calculations (`initial + 1`) provide rigid verification.
5. Directly mutating `.value` via `.evaluate()` does not trigger React's `onChange` handlers, meaning the application logic is bypassed. Using `.fill()` correctly mimics a user typing.
6. The missing `await` on `goto` breaks the sequence of operations, making the test non-deterministic.

## Caveats
- I did not run the tests directly due to network/execution restrictions on workspace creation. The strategy assumes standard Playwright behavior.
- The exact node count of the seed data is not hardcoded in my scope. Tests should use relative exact increments (e.g., `total - 1`) or explicit wait steps before reading initial counts.

## Conclusion
The `tier1.spec.ts` file must be aggressively refactored to remove all deceptive patterns. The required fix strategy includes:
1. **Remove all `if` blocks:** Ensure preconditions (e.g., `expect(nodeId).toBeTruthy()`) and assertions are executed unconditionally.
2. **Fix Tautologies:** Select elements using structural attributes (e.g., `data-source`) or general locators (e.g., `.react-flow__node:not(.active)`), rather than the class being verified.
3. **Use Auto-retrying Assertions:** Replace `await locator.count()` with `await expect(locator).toHaveCount(...)`. For node additions, verify an exact increment (`initialCount + 1`).
4. **Remove Error Suppression:** Replace `.catch(() => {})` with an explicit expectation of failure: `await expect(node.click({ timeout: 1000 })).rejects.toThrow()`.
5. **Fix Missing Await:** Add `await` to `page.goto('/')` (line 280).
6. **Use Native Interactions:** Replace `.evaluate(el => el.value = ...)` with `await locator.fill(...)`.

## Verification Method
1. Run the Playwright test suite using the project's standard test command (e.g., `npx playwright test e2e-tests/tests/tier1.spec.ts`).
2. Verify that there are zero `.catch()` or `if` blocks surrounding `expect` calls in the file.
3. Verify that `toHaveCount` is used for all count assertions.
4. Verify that `page.goto` is awaited everywhere.
5. Verify that `.evaluate` is not used to mutate form inputs.
