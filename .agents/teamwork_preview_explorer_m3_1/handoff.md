# Handoff Report: Milestone 3 - Alias & Config Control

## Observation
- `backend/main.py` already accepts `max_depth` and `filter` query parameters for the `GET /api/graph` endpoint.
- `backend/graph_service.py` implements graph filtering via `max_depth` (using `nx.ego_graph`) and `filter` (searching node name, label, and aliases). However, alias normalization in `_normalize_aliases` currently only applies `.title()` and does not use a real alias dictionary.
- `frontend/src/App.tsx` calls `GET /api/graph` but hardcodes the URL without query parameters. It has a basic loading state but no semi-transparent overlay on the canvas.
- The Config Panel and Dropdown Autocomplete for aliases are missing from the frontend.

## Logic Chain
1. To satisfy "Backend Alias Dictionary", we need to introduce a mapping (e.g., `aliases.json` or in-memory dict) in the backend. `_normalize_aliases` in `graph_service.py` must use this mapping to convert raw terms to standard terms when processing Neo4j records.
2. We need a new backend endpoint (e.g., `GET /api/aliases`) to expose the list of standard terms to the frontend for the dropdown autocomplete.
3. In `frontend/src/App.tsx`, we must add state for `maxDepth` and `filter`. A `useDebounce` hook (or equivalent) should be added to delay the API call when these inputs change.
4. The `fetchGraph` function must be updated to include `?max_depth=${maxDepth}&filter=${filter}` in the API request.
5. A `<ConfigPanel>` component (can be placed inside the existing `<Panel position="top-left">`) should contain the input fields. The filter input needs to act as a dropdown autocomplete, fetching standard terms from `GET /api/aliases`.
6. To add a semi-transparent loading overlay, we can render a `div` absolutely positioned over the `ReactFlow` component with `rgba(255, 255, 255, 0.7)` background when `loading` is true.

## Caveats
- Direct execution of `npm install` may time out due to permissions. All frontend changes should rely on static analysis. New dependencies should be avoided if possible, or mocked/stubbed. We can build a simple custom autocomplete using standard HTML `<datalist>` or a native React controlled component to avoid heavy third-party dropdown libraries.
- The Neo4j database might need to be running to verify the graph fetch, but the code changes can be made structurally without it.
- `dagreGraph` in `layout.ts` was noted to need local scoping in a previous milestone, though it appears functional as is; just be careful not to introduce global state issues if modifying it.

## Conclusion
The implementation can proceed as follows:
1. **Backend**: 
   - Add a `ALIAS_DICT` dictionary in `backend/graph_service.py` (e.g., `{"front-end": "frontend", "back-end": "backend"}`).
   - Update `_normalize_aliases` to use `ALIAS_DICT`.
   - Add `GET /api/aliases` to `backend/main.py` returning `list(set(ALIAS_DICT.values()))`.
2. **Frontend**:
   - Create a debounced fetch mechanism in `App.tsx` (using `useEffect` and `setTimeout`).
   - Create a `ConfigPanel` with a number input for `max_depth` and a text input with an HTML `<datalist>` (or custom dropdown) for the `filter`, populated by `/api/aliases`.
   - Update `fetch` URL to include query parameters.
   - Add a `<div className="loading-overlay">` inside the `ReactFlow` wrapper, styled via `index.css` to be semi-transparent and cover the canvas.

## Verification Method
- **Backend Test**: Run `pytest` if tests exist, or manually curl `GET http://localhost:8000/api/aliases` and `GET http://localhost:8000/api/graph?max_depth=1&filter=frontend` to check the response format.
- **Frontend Test**: Since `npm install` might fail, rely on visual inspection of the React code to ensure state, debounce, and query string logic are correct. Verify that `index.css` contains the `.loading-overlay` class.
