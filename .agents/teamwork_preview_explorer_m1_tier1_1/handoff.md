# M1 Tier 1 Playwright E2E Test Design Handoff

## 1. Observation
- `SCOPE.md` indicates the target directory is `/e2e-tests` with Playwright (Node.js/TypeScript). Tests must compile with `tsc` without errors, target `http://localhost:5173` and `http://localhost:8000`.
- `ORIGINAL_REQUEST.md` details 6 core requirements (F1-F6) encompassing the data pipeline, visualization, test coverage marking, editing, config panel (with loading UI/debounce), and alias dictionary.
- `TEST_INFRA.md` requires 30 Tier 1 Feature Coverage tests (5 per feature) in `tier1.spec.ts`.

## 2. Logic Chain
- To guarantee functional coverage, each of the 6 features must have exactly 5 tests targeting specific acceptance criteria and boundaries.
- **F1 (Local Data Pipeline)** needs to test the seed data loading and fallback behavior via the API.
- **F2 (Core Visualization)** must verify the Focus+Context CSS class applications on nodes and edges.
- **F3 (Living TC)** needs to assert status transitions (Untested, Passed, Failed) and visual updates.
- **F4 (Graph Editing)** focuses on CRUD operations for nodes and edges directly on the canvas.
- **F5 (Config Panel)** requires verifying debounce logic (multiple inputs yielding one API call) and the loading overlay.
- **F6 (Alias Dictionary)** ensures free-text entry is blocked in favor of standardized dropdowns and backend normalization.

## 3. Caveats
- Actual Playwright locators (e.g., test IDs or specific CSS selectors) are not defined here as the implementation details of the frontend DOM are not yet finalized.
- Backend seed data content is assumed to have at least 20 nodes per the acceptance criteria, so F1 tests assert `count >= 20`.

## 4. Conclusion
Below is the design of the 30 Tier 1 Feature Coverage tests, and the recommended configuration and directory structure.

### Recommended Directory Structure
```
/e2e-tests/
├── package.json
├── playwright.config.ts
├── tests/
│   └── tier1.spec.ts
```

### `package.json`
```json
{
  "name": "living-graph-tc-e2e",
  "version": "1.0.0",
  "description": "Playwright E2E tests for Living Graph TC Platform",
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### `playwright.config.ts`
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
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### 30 Tier 1 Test Cases (to be implemented in `tests/tier1.spec.ts`)

#### F1: Local Data Pipeline (Neo4j Seed)
1. **Fetch Seed Data on Load**
   - **Purpose**: Verify frontend connects to API and fetches initial seeded data successfully.
   - **Actions**: Load `/`. Wait for network request to graph endpoint.
   - **Assertions**: Graph canvas DOM contains at least 20 node elements.
2. **Node Properties Rendering**
   - **Purpose**: Verify nodes display basic properties from seed data.
   - **Actions**: Click on a node.
   - **Assertions**: Details panel shows non-empty ID, label, and attributes.
3. **Edge Rendering**
   - **Purpose**: Verify edges reflect relationships in seed data.
   - **Actions**: Inspect canvas for edge paths.
   - **Assertions**: Count of edge elements is > 0.
4. **Backend API Direct Verification**
   - **Purpose**: Verify backend directly returns valid JSON structure.
   - **Actions**: API GET `http://localhost:8000/api/graph`.
   - **Assertions**: Status 200, response body has arrays for `nodes` and `edges`.
5. **API Failure Degradation**
   - **Purpose**: Verify UI error handling when API is unreachable.
   - **Actions**: Route API request to abort, then load page.
   - **Assertions**: Visible error toast or empty state message indicating data fetch failure.

#### F2: Core Visualization (Focus+Context)
1. **Focus Node Dimming**
   - **Purpose**: Selecting a focus node dims background nodes.
   - **Actions**: Click a node.
   - **Assertions**: Clicked node has active class; other nodes have de-emphasized class/style.
2. **Restore Context**
   - **Purpose**: Deselecting restores background nodes.
   - **Actions**: Click canvas background.
   - **Assertions**: All nodes return to normal opacity.
3. **Shift Focus**
   - **Purpose**: Clicking a new node shifts focus correctly.
   - **Actions**: Click Node A, then Node B.
   - **Assertions**: Node B is active, Node A is de-emphasized.
4. **Edge Highlighting**
   - **Purpose**: Edges connected to focus node stay highlighted.
   - **Actions**: Click a node with edges.
   - **Assertions**: Connected edges have normal opacity; disconnected edges are de-emphasized.
5. **Path Selection (Coverage scope view)**
   - **Purpose**: Ensuring multiple context selections do not conflict.
   - **Actions**: Perform an action that selects a path (if available) or repeatedly toggle focus.
   - **Assertions**: Highlight and dimming states remain mutually exclusive and correct.

#### F3: Living TC (Test Coverage Marking)
1. **Mark Passed**
   - **Purpose**: Mark an untested node as 'Passed'.
   - **Actions**: Click 'Untested' node, click 'Mark Passed'.
   - **Assertions**: Node class/color changes to represent 'Passed' (e.g. green).
2. **Mark Failed**
   - **Purpose**: Mark a node as 'Failed'.
   - **Actions**: Click a node, click 'Mark Failed'.
   - **Assertions**: Node class/color changes to represent 'Failed' (e.g. red).
3. **Mark Edge Passed**
   - **Purpose**: Mark an edge as 'Passed'.
   - **Actions**: Click an edge, click 'Mark Passed'.
   - **Assertions**: Edge stroke changes to thick green line.
4. **Reset Status**
   - **Purpose**: Reset a 'Passed' node back to 'Untested'.
   - **Actions**: Click 'Passed' node, click 'Reset Status'.
   - **Assertions**: Node class/color reverts to default 'Untested'.
5. **Coverage Metrics Update**
   - **Purpose**: Ensure UI metrics update on status change.
   - **Actions**: Mark a node 'Passed'.
   - **Assertions**: Coverage dashboard/text increments passed count by 1.

#### F4: Graph Editing (Nodes & Edges)
1. **Add Node**
   - **Purpose**: Add a new node to the canvas.
   - **Actions**: Click 'Add Node', fill standardized details, save.
   - **Assertions**: New node appears in canvas DOM; API POST request captured.
2. **Edit Node Properties**
   - **Purpose**: Edit existing node properties.
   - **Actions**: Select node, update field in panel, save.
   - **Assertions**: Label updates on canvas; API PATCH request captured.
3. **Delete Node**
   - **Purpose**: Remove a node.
   - **Actions**: Select node, click 'Delete'.
   - **Assertions**: Node is removed from canvas DOM.
4. **Add Edge**
   - **Purpose**: Connect two nodes with an edge.
   - **Actions**: Drag connection between two node handles.
   - **Assertions**: New edge SVG path is drawn; API POST captured.
5. **Delete Edge**
   - **Purpose**: Remove an existing edge.
   - **Actions**: Select edge, click 'Delete'.
   - **Assertions**: Edge SVG path is removed from DOM.

#### F5: Config Panel & Loading UI
1. **Debounce API Call**
   - **Purpose**: Multiple rapid config changes trigger only one API call.
   - **Actions**: Rapidly slide "Max Depth" input 3 times.
   - **Assertions**: After debounce delay, only exactly 1 API call is dispatched.
2. **Config Depth Update**
   - **Purpose**: Changing depth config fetches new graph data.
   - **Actions**: Increase depth config, wait for response.
   - **Assertions**: API called with new depth param; canvas re-renders with node delta.
3. **Show Loading Overlay**
   - **Purpose**: Overlay appears during backend processing.
   - **Actions**: Trigger config change, intercept API request to delay response.
   - **Assertions**: Loading overlay/spinner is visible in DOM.
4. **Hide Loading Overlay**
   - **Purpose**: Overlay disappears after fetch completes.
   - **Actions**: Complete the delayed API request.
   - **Assertions**: Loading overlay is removed from DOM.
5. **Block Race Conditions**
   - **Purpose**: UI interactions are blocked while overlay is active.
   - **Actions**: While overlay is active, attempt to click a node.
   - **Assertions**: Overlay intercepts pointer events; node does not become focused.

#### F6: Alias Dictionary (Standardization)
1. **Backend Alias Normalization**
   - **Purpose**: Backend returns standard term for a synonym.
   - **Actions**: API GET request with synonym parameter.
   - **Assertions**: Response data contains standard term instead of synonym.
2. **Standardized Input UI**
   - **Purpose**: Node editing uses dropdowns/autocomplete for standard terms.
   - **Actions**: Open node edit panel for category/view.
   - **Assertions**: Input element is a `select` or has `autocomplete` enforcement (not free text).
3. **Autocomplete Suggestion**
   - **Purpose**: Typing synonym in autocomplete shows standard term.
   - **Actions**: Type known synonym into alias field.
   - **Assertions**: Dropdown displays standard term mapping.
4. **Form Submission Validation**
   - **Purpose**: Selecting standard term successfully submits form.
   - **Actions**: Select standard term, click Save.
   - **Assertions**: Node properties update successfully; no validation errors.
5. **Block Free Text**
   - **Purpose**: Free text entry is rejected.
   - **Actions**: Evaluate script to set value to arbitrary non-standard string and submit.
   - **Assertions**: Form displays validation error; API call is not dispatched.

## 5. Verification Method
- **Method**: The next agent assigned to implement these tests should place them in `/e2e-tests/tests/tier1.spec.ts`. To verify the structure, they can run `cd e2e-tests && npm run test` (the tests will fail until the app is implemented, which is expected per `SCOPE.md`). Code compilation can be checked with `npx tsc --noEmit`.
