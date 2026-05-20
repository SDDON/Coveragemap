# Handoff Report: M1 Tier 1 E2E Test Design

## 1. Observation
- `TEST_INFRA.md` specifies 6 features (F1-F6) requiring 5 tests each for Tier 1 (Total: 30 tests). Tests are opaque-box and requirement-driven.
- Test stack is Playwright (Node.js/TypeScript). Tests must compile without errors using `tsc` and run against `http://localhost:5173` (Frontend) and `http://localhost:8000` (Backend).
- `ORIGINAL_REQUEST.md` details the requirements: R1 (Local Data Pipeline), R2 (Focus+Context), R3 (Test Coverage Marking), R4 (Graph Editing), R5 (Config Panel & Loading), R6 (Alias Dictionary).
- Directory structure requires `/e2e-tests/` with `package.json`, `playwright.config.ts`, and `tests/tier1.spec.ts`.

## 2. Logic Chain
- **F1 (Local Data Pipeline):** Tests must verify the initial state, the API response, and the proper rendering of the seed nodes and edges.
- **F2 (Focus+Context):** Tests must verify the visual state changes (opacity/styling) when a node is clicked, clicking away, and switching nodes.
- **F3 (Living TC):** Tests must verify the interaction to mark nodes and edges as Passed/Failed/Untested and check that their visual styling reflects the status.
- **F4 (Graph Editing):** Tests must verify the CRUD operations for nodes and edges via the UI.
- **F5 (Config Panel):** Tests must verify the loading overlay, debounce functionality, and structural changes to the graph when configs (e.g., depth) change.
- **F6 (Alias Dictionary):** Tests must verify the autocomplete restriction, standard term normalization, and application of standard terms when creating/editing nodes.
- The configuration files must be standard Playwright setups pointing to the frontend URL as the baseURL.

## 3. Caveats
- The exact DOM selectors (classes/ids) for nodes, edges, loading overlays, and dropdowns are not defined yet since the application code isn't implemented. The test descriptions use semantic actions instead of specific DOM selectors.
- The tests assume `http://localhost:5173` is running and the backend provides valid data at `http://localhost:8000`. Backend testing in Playwright will utilize `request` contexts to hit the API endpoints directly.

## 4. Conclusion
We have designed the 30 Tier 1 Feature Coverage tests to meet the requirements specified in `TEST_INFRA.md`.

### Recommended Directory Structure
```
/e2e-tests/
├── package.json
├── playwright.config.ts
└── tests/
    ├── tier1.spec.ts
    ├── tier2.spec.ts
    ├── tier3.spec.ts
    └── tier4.spec.ts
```

### e2e-tests/package.json
```json
{
  "name": "living-graph-tc-e2e",
  "version": "1.0.0",
  "description": "E2E tests for Living Graph TC Platform",
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### e2e-tests/playwright.config.ts
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### Test Case Design (30 Tests for `tier1.spec.ts`)

#### F1: Local Data Pipeline (Neo4j Seed)
- **T1.1**: *Purpose:* Verify UI shows seed nodes on initial load. *Action:* Navigate to `/`. *Assert:* The React Flow canvas contains at least 20 nodes.
- **T1.2**: *Purpose:* Verify backend API `/api/graph` returns valid JSON with `nodes` and `edges` arrays. *Action:* Playwright makes a `GET` request to `http://localhost:8000/api/graph`. *Assert:* Response status 200, response body has `nodes` array (length >= 20) and `edges` array.
- **T1.3**: *Purpose:* Verify node labels in UI match the expected seed data properties. *Action:* Wait for canvas to load. *Assert:* At least one visible node contains a recognizable seed data name.
- **T1.4**: *Purpose:* Verify edges are correctly rendered connecting the seed nodes. *Action:* Wait for canvas to load. *Assert:* The canvas contains path elements representing edges.
- **T1.5**: *Purpose:* Verify graceful handling of backend unavailability. *Action:* Mock the `/api/graph` API route to return a 500 error, load the page. *Assert:* UI displays a visible error message regarding data fetch failure.

#### F2: Core Visualization (Focus+Context)
- **T2.1**: *Purpose:* Verify clicking a node focuses it and applies a 'de-emphasized' class to unrelated background nodes. *Action:* Click on a central node. *Assert:* Unrelated nodes have a CSS class corresponding to decreased opacity/de-emphasis.
- **T2.2**: *Purpose:* Verify clicking the background clears the focus state. *Action:* Click a node, then click an empty area on the canvas. *Assert:* No nodes have the 'de-emphasized' CSS class.
- **T2.3**: *Purpose:* Verify focused node retains its normal styling. *Action:* Click a node. *Assert:* The clicked node does NOT have the de-emphasized CSS class.
- **T2.4**: *Purpose:* Verify edges connecting to the focused node remain emphasized. *Action:* Click a node with connected edges. *Assert:* Connected edges retain normal styling, while unconnected edges are de-emphasized.
- **T2.5**: *Purpose:* Verify focusing a different node switches the context appropriately. *Action:* Click Node A, then click Node B. *Assert:* Node B is focused (normal style), Node A becomes de-emphasized (unless directly connected to Node B).

#### F3: Living TC (Test Coverage Marking)
- **T3.1**: *Purpose:* Verify marking a node as 'Passed' updates its visual style. *Action:* Click an 'Untested' node, select 'Mark Passed' from the context menu/toolbar. *Assert:* The node's DOM element receives a 'passed' CSS class (e.g., green color).
- **T3.2**: *Purpose:* Verify marking a node as 'Failed' updates its visual style. *Action:* Click a node, select 'Mark Failed'. *Assert:* The node receives a 'failed' CSS class (e.g., red color).
- **T3.3**: *Purpose:* Verify marking an edge as 'Passed' updates its visual style. *Action:* Click an edge, select 'Mark Passed'. *Assert:* The edge receives a 'passed' CSS class (e.g., green bold line).
- **T3.4**: *Purpose:* Verify marking an edge as 'Failed' updates its visual style. *Action:* Click an edge, select 'Mark Failed'. *Assert:* The edge receives a 'failed' CSS class (e.g., red line).
- **T3.5**: *Purpose:* Verify test status changes persist after losing focus. *Action:* Mark a node as 'Passed', then click the canvas background to clear focus. *Assert:* The node retains its 'passed' visual styling.

#### F4: Graph Editing (Nodes & Edges)
- **T4.1**: *Purpose:* Verify adding a new node. *Action:* Click the "Add Node" button in the UI, fill in basic details. *Assert:* A new node element appears on the React Flow canvas.
- **T4.2**: *Purpose:* Verify adding a new edge. *Action:* Use the UI to create a connection from Node A to Node B (e.g., drag handle). *Assert:* A new edge path is rendered between Node A and Node B.
- **T4.3**: *Purpose:* Verify deleting a node. *Action:* Select an existing node, click the "Delete" button/key. *Assert:* The node and its connected edges are removed from the DOM.
- **T4.4**: *Purpose:* Verify deleting an edge. *Action:* Select an existing edge, click the "Delete" button/key. *Assert:* The edge path is removed from the DOM.
- **T4.5**: *Purpose:* Verify editing a node's properties. *Action:* Select a node, edit its name in the properties panel, and save. *Assert:* The node's visible text on the canvas updates to the new name.

#### F5: Config Panel & Loading UI
- **T5.1**: *Purpose:* Verify changing a setting triggers the loading overlay. *Action:* Change the 'Max Depth' slider/input in the config panel. *Assert:* The semi-transparent loading overlay becomes visible over the canvas.
- **T5.2**: *Purpose:* Verify backend debounce mechanism for config changes. *Action:* Rapidly change the 'Max Depth' value 3 times within 200ms. *Assert:* Using Playwright network intercept, verify that only one backend request is dispatched.
- **T5.3**: *Purpose:* Verify loading overlay disappears. *Action:* Change a setting and wait for the backend response to complete. *Assert:* The loading overlay is removed from the DOM.
- **T5.4**: *Purpose:* Verify interaction is blocked during loading. *Action:* Change a setting, then immediately attempt to click a node. *Assert:* The node click is blocked by the overlay and does not trigger focus/context changes.
- **T5.5**: *Purpose:* Verify config filter reduces visible nodes. *Action:* Apply a specific property filter in the config panel. *Assert:* The number of rendered nodes on the canvas is less than before the filter was applied.

#### F6: Alias Dictionary (Standardization)
- **T6.1**: *Purpose:* Verify backend returns standardized terminology. *Action:* Playwright requests `/api/graph`. *Assert:* Property fields containing known aliases are returned as their standard form (e.g., if 'sys' is an alias for 'system', response should contain 'system').
- **T6.2**: *Purpose:* Verify property editing restricts to dropdowns. *Action:* Attempt to edit a node's standardized property (e.g., Viewpoint/Type). *Assert:* An autocomplete/dropdown UI appears instead of a plain text input.
- **T6.3**: *Purpose:* Verify free text input is blocked for standard fields. *Action:* Try to submit a random unlisted string in the standardized property input. *Assert:* The input is rejected, or the save button is disabled/form fails validation.
- **T6.4**: *Purpose:* Verify synonym search auto-converts to standard term. *Action:* Type a known alias (e.g., 'sys') into the autocomplete field. *Assert:* The dropdown suggests the standardized term ('system').
- **T6.5**: *Purpose:* Verify node creation applies standardized terms. *Action:* Create a node, selecting the standardized term from the dropdown. *Assert:* The new node is rendered with the correctly selected standard term.

## 5. Verification Method
1. Create the described directory structure in `/e2e-tests/`.
2. Write the JSON and TS contents into `/e2e-tests/package.json` and `/e2e-tests/playwright.config.ts`.
3. Create `/e2e-tests/tests/tier1.spec.ts` with `test.skip` or `test.todo` blocks outlining the 30 tests.
4. Run `cd e2e-tests && npm install && npx tsc` to verify TypeScript compilation succeeds.
5. Review the structure against `TEST_INFRA.md` to ensure all 6 features are covered.
