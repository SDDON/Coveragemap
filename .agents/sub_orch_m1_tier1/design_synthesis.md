# Tier 1 Playwright E2E Test Design Synthesis

## Consensus
The design across the Explorers agrees on:
1. **Framework**: Playwright with TypeScript.
2. **Directory Structure**:
   - `/e2e-tests/package.json`
   - `/e2e-tests/playwright.config.ts`
   - `/e2e-tests/tests/tier1.spec.ts`
3. **Configurations**: `baseURL` should be `http://localhost:5173`. Target both frontend and backend (`http://localhost:8000`).
4. **Test Categories (5 tests per feature F1-F6)**:
   - **F1 (Local Data Pipeline)**: Seed data loading (20+ nodes), Node properties rendering, Edge rendering, API direct verification, API failure degradation.
   - **F2 (Focus+Context)**: Focus dimming of unrelated nodes, Restoring context on background click, Focus shifting, Edge highlighting, Context isolation.
   - **F3 (Living TC)**: Mark node passed (green), Mark node failed (red), Mark edge passed, Reset status, Coverage metrics update.
   - **F4 (Graph Editing)**: Add Node, Edit Node, Delete Node, Add Edge, Delete Edge.
   - **F5 (Config Panel)**: Debounce API call (only 1 call after rapid changes), Config depth update, Show loading overlay, Hide loading overlay, Block UI interactions during loading.
   - **F6 (Alias Dictionary)**: Backend alias normalization, Standardized input UI (dropdown), Autocomplete suggestions, Form submission validation, Block free text entry.

## Resolved Conflicts
- No significant conflicts. Explorers aligned completely on the required tests mapping to the 6 features.

## Actionable Summary for Worker
The Worker needs to:
1. Create `/e2e-tests/package.json` with Playwright and TypeScript dependencies.
2. Create `/e2e-tests/playwright.config.ts` configured for `localhost:5173`.
3. Create `/e2e-tests/tests/tier1.spec.ts` containing the 30 Playwright tests structured using `test.describe` blocks for each feature. Since the UI is not built, semantic CSS classes or placeholders should be used for locators (e.g., `locator('.react-flow__node')`, `locator('.de-emphasized')`, `locator('.status-passed')`).
4. Run `npm install` and `npx tsc --noEmit` to verify code compiles.
