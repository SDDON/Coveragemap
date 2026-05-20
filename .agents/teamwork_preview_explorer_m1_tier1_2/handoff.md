# Handoff Report: M1 Tier 1 Feature Coverage E2E Tests

## 1. Observation
- `SCOPE.md` specifies the architecture for E2E tests: target directory `/e2e-tests`, `package.json` with Playwright (Node.js/TypeScript), and `playwright.config.ts`.
- `TEST_INFRA.md` specifies E2E test invocation (`npm run test`), directory layout (`/e2e-tests/tests/tier1.spec.ts`), and coverage thresholds (30 tests for Tier 1: 5 per feature).
- `ORIGINAL_REQUEST.md` details 6 core features (F1-F6) that need to be tested against `http://localhost:5173` (Frontend) and `http://localhost:8000` (Backend).

## 2. Logic Chain
- To meet M1 requirements, the E2E test suite must be initialized with standard Playwright + TypeScript configuration in `/e2e-tests`.
- The directory structure should strictly follow the `TEST_INFRA.md` layout, placing all Tier 1 tests in `tests/tier1.spec.ts`.
- `package.json` needs basic scripts (`test`, `test:ui`) and standard dependencies (`@playwright/test`, `typescript`, `@types/node`).
- `playwright.config.ts` must configure tests to run against the frontend (`http://localhost:5173`), with potential API request testing targeting the backend (`http://localhost:8000`).
- For each of the 6 features, exactly 5 distinct test cases are designed by breaking down the acceptance criteria and user interactions described in `ORIGINAL_REQUEST.md`.

## 3. Caveats
- Since the implementation code is not yet written, the specific DOM selectors (e.g., `data-testid` or CSS classes) used in the proposed test actions and assertions are illustrative. The implementation phase must align the actual application DOM with these selectors.
- API mocking vs Real E2E: These tests are designed as opaque-box true E2E tests against the real backend, assuming the Neo4j seed data is available as per R1. Tests that require mocking network errors will need Playwright's `page.route` to intercept calls.

## 4. Conclusion (Detailed Design)

### Directory Structure
```
/e2e-tests/
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── tests/
    └── tier1.spec.ts
```

### `package.json` (Recommended Contents)
```json
{
  "name": "living-graph-tc-e2e",
  "version": "1.0.0",
  "description": "Playwright E2E tests for Living Graph TC Platform",
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed"
  },
  "devDependencies": {
    "@playwright/test": "^1.43.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0"
  }
}
```

### `playwright.config.ts` (Recommended Contents)
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173', // Frontend URL
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

### 30 Tier 1 Feature Coverage Test Cases (`tier1.spec.ts`)

#### F1: Local Data Pipeline (Neo4j Seed)
1. **Purpose:** Verify backend API returns valid JSON graph data.
   - **Actions:** Call `page.request.get('http://localhost:8000/api/graph')`.
   - **Assertions:** Response status 200, body contains `nodes` and `edges` arrays.
2. **Purpose:** Verify seed data meets the minimum size requirement (>=20 nodes).
   - **Actions:** Call `page.request.get('http://localhost:8000/api/graph')`.
   - **Assertions:** `response.nodes.length >= 20`.
3. **Purpose:** Verify frontend initial load fetches and renders seed nodes.
   - **Actions:** Visit `/`, wait for network idle.
   - **Assertions:** Count elements with class `react-flow__node` >= 20.
4. **Purpose:** Verify frontend initial load renders edges between nodes.
   - **Actions:** Visit `/`, wait for network idle.
   - **Assertions:** Count elements with class `react-flow__edge` > 0.
5. **Purpose:** Verify graceful handling of backend connection failures.
   - **Actions:** Intercept `/api/graph` with `page.route` to abort, visit `/`.
   - **Assertions:** An error message (e.g., "Failed to load graph data") is visible on screen.

#### F2: Core Visualization (Focus+Context)
6. **Purpose:** Verify selecting a node applies focus styling.
   - **Actions:** Visit `/`, click on a specific node.
   - **Assertions:** The clicked node element has a `data-focused="true"` or specific active class.
7. **Purpose:** Verify selecting a node de-emphasizes non-selected background nodes.
   - **Actions:** Click on a specific node.
   - **Assertions:** All other node elements possess a `de-emphasized` CSS class (or reduced opacity).
8. **Purpose:** Verify connected edges remain highlighted while others are de-emphasized.
   - **Actions:** Click a node that has edges.
   - **Assertions:** Connected edges lack the `de-emphasized` class; unconnected edges have it.
9. **Purpose:** Verify clicking the canvas background clears node selection.
   - **Actions:** Click a node, then click the canvas background (empty space).
   - **Assertions:** No nodes or edges have the `de-emphasized` or `focused` classes.
10. **Purpose:** Verify changing focus updates the context correctly.
    - **Actions:** Click Node A, then click Node B.
    - **Assertions:** Node B becomes focused, Node A becomes de-emphasized.

#### F3: Living TC (Test Coverage Marking)
11. **Purpose:** Verify nodes default to the 'Untested' visual state.
    - **Actions:** Visit `/`.
    - **Assertions:** Seed nodes display an 'Untested' indicator or default neutral style.
12. **Purpose:** Verify marking a node as 'Passed' updates its status and style.
    - **Actions:** Select a node, click the "Mark Passed" button in the UI panel.
    - **Assertions:** The node visually updates (e.g., turns green, class `status-passed`).
13. **Purpose:** Verify marking a node as 'Failed' updates its status and style.
    - **Actions:** Select a node, click the "Mark Failed" button.
    - **Assertions:** The node visually updates (e.g., turns red, class `status-failed`).
14. **Purpose:** Verify marking an edge as 'Passed' updates its style.
    - **Actions:** Select an edge, click "Mark Passed".
    - **Assertions:** The edge stroke visually updates (e.g., thicker green line).
15. **Purpose:** Verify test status visually persists after selection is cleared.
    - **Actions:** Mark a node as 'Passed', click the background to clear focus.
    - **Assertions:** The node retains the `status-passed` styling even when not focused.

#### F4: Graph Editing (Nodes & Edges)
16. **Purpose:** Verify user can create a new node.
    - **Actions:** Click "Add Node" control.
    - **Assertions:** Total node count on the canvas increases by 1; the new node is visible.
17. **Purpose:** Verify user can edit an existing node's information.
    - **Actions:** Select a node, change its label in the edit panel, submit.
    - **Assertions:** The node's text on the canvas reflects the updated label.
18. **Purpose:** Verify user can delete a node.
    - **Actions:** Select a node, click the "Delete" button (or press Backspace).
    - **Assertions:** The node disappears from the canvas; node count decreases.
19. **Purpose:** Verify user can create a new edge between two nodes.
    - **Actions:** Drag from the source handle of Node A to the target handle of Node B.
    - **Assertions:** A new edge appears in the DOM connecting Node A and Node B.
20. **Purpose:** Verify user can delete an existing edge.
    - **Actions:** Select an edge, click "Delete".
    - **Assertions:** The edge is removed from the DOM; edge count decreases.

#### F5: Config Panel & Loading UI
21. **Purpose:** Verify Config Panel is present with default settings.
    - **Actions:** Open Config Panel.
    - **Assertions:** Max Depth, Loop Allow, and Viewpoint Filter inputs are visible and populated with defaults.
22. **Purpose:** Verify debounce prevents immediate API calls on rapid input.
    - **Actions:** Listen to network requests on `/api/graph`. Type quickly into the filter input (3 keystrokes).
    - **Assertions:** Only 1 API request is dispatched after the debounce delay, not 3.
23. **Purpose:** Verify a loading overlay appears during backend re-calculation.
    - **Actions:** Intercept `/api/graph` to delay response by 1 second. Change max depth value.
    - **Assertions:** A UI overlay with `data-testid="loading-overlay"` becomes visible on the canvas.
24. **Purpose:** Verify loading overlay disappears after data is fetched.
    - **Actions:** Allow the delayed `/api/graph` response to complete.
    - **Assertions:** The loading overlay is removed from the DOM.
25. **Purpose:** Verify graph updates based on max depth config change.
    - **Actions:** Change Max Depth to a smaller number (e.g., 1), wait for network response.
    - **Assertions:** The displayed graph structure strictly conforms to the new depth (node count should reflect the restricted view).

#### F6: Alias Dictionary (Standardization)
26. **Purpose:** Verify backend standardizes alias terms.
    - **Actions:** Call `page.request.post('http://localhost:8000/api/standardize', { data: { term: 'aliasTerm' } })`.
    - **Assertions:** Response returns the designated standard term.
27. **Purpose:** Verify free-text input is restricted for alias fields.
    - **Actions:** Try to type a non-standard string into the alias/viewpoint input and press enter without selecting a dropdown item.
    - **Assertions:** The input is rejected, cleared, or an error is shown; value does not save.
28. **Purpose:** Verify dropdown appears with autocomplete suggestions.
    - **Actions:** Type a partial alias into the input.
    - **Assertions:** An autocomplete dropdown list appears with matching standard terms.
29. **Purpose:** Verify selecting a standard term from the dropdown updates the node.
    - **Actions:** Select a term from the dropdown and save.
    - **Assertions:** The input field and the node's saved property reflect the exact standard term selected.
30. **Purpose:** Verify backend seed data renders using standard terms.
    - **Actions:** Inspect a loaded node known to have an alias in the seed.
    - **Assertions:** The displayed label/property is the standard term, confirming normalization occurred before/during frontend render.

## 5. Verification Method
- **To Verify Structure:** Read the contents of `handoff.md` to ensure all 6 features have exactly 5 tests listed, matching the requirements of M1 Tier 1.
- **To Apply:** An implementing agent should create the directory, write `package.json` and `playwright.config.ts`, install dependencies, and implement the test logic inside `e2e-tests/tests/tier1.spec.ts`.
- **To Validate Implementation:** Run `npm run test` in `/e2e-tests`. Success is determined by 30 tests passing with a 0 exit code once the application code is built.
