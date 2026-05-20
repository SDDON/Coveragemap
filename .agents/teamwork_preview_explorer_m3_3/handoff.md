# Handoff Report: Milestone 3 Fix Strategy

## Observation
1. **Scope/Project context**: `PROJECT.md` and `SCOPE.md` specify implementing Backend Alias Dictionary mapping, filtering via `max_depth` and `filter` in `GET /api/graph`, Frontend Config Panel with debounce and a semi-transparent loading overlay, and a standard dropdown auto-complete.
2. **Backend**: 
   - `backend/main.py` lines 24-38: `GET /api/graph` accepts `max_depth` and `filter` query parameters. It passes them to `process_graph`.
   - `backend/graph_service.py` lines 56-90: `process_graph` correctly applies filtering and depth using `nx.ego_graph`.
   - `backend/graph_service.py` lines 5-13: `_normalize_aliases` currently only applies `.title()` and doesn't map against a standard dictionary.
3. **Frontend**:
   - `frontend/src/App.tsx` lines 39-84: `fetchGraph` hardcodes `http://localhost:8000/api/graph` without appending query parameters `max_depth` and `filter`.
   - `frontend/src/App.tsx` lines 104-107: A `Panel` is used for `loading` text, instead of a full-screen semi-transparent overlay.
   - `frontend/src/layout.ts` lines 4-5: `const dagreGraph = new dagre.graphlib.Graph();` is declared globally outside `getLayoutedElements`, which can cause stale data or node collisions across repeated debounced layout calls.

## Logic Chain
1. Since the backend `GET /api/graph` already accepts `max_depth` and `filter`, the main backend tasks are to introduce an alias dictionary for mapping terms (e.g. "front-end" to "frontend") in `fetch_graph_from_neo4j` or `_normalize_aliases`, and expose standard aliases for the frontend autocomplete via a new endpoint (e.g., `GET /api/aliases`).
2. The frontend `App.tsx` must be updated with state variables for `maxDepth` and `filterText`. A `ConfigPanel` component must be placed in a `<Panel position="top-right">` to adjust these.
3. To prevent API spam on keystrokes, `useEffect` with `setTimeout` should be used to create a debounced version of `filterText` and `maxDepth` state updates, which then trigger the API call with query params.
4. To fix the caveat mentioned in Milestone 2, the `dagreGraph` instantiation in `layout.ts` must be moved inside `getLayoutedElements` so it starts fresh each time the graph updates.
5. A full canvas loading overlay can be achieved by placing a styled `div` with absolute positioning, z-index, and semi-transparent background (`rgba(255, 255, 255, 0.7)`) alongside the `<ReactFlow>` component.
6. The auto-complete dropdown can be built natively using an `<input list="aliases-list">` and a `<datalist id="aliases-list">` populated from the standardized dictionary.

## Caveats
- I did not test the Neo4j queries directly, assuming `fetch_graph_from_neo4j` works as-is.
- Standard aliases can be hardcoded for the demo or managed in the DB; I recommend a hardcoded mapping dictionary in `graph_service.py` for simplicity.
- Running `npm install` is avoided, so no new external React packages (like lodash or react-select) should be added; we rely on native JS debounce (`setTimeout`) and native HTML elements (`<datalist>`).

## Conclusion
The implementer should execute the following strategy:
1. **Backend Alias Dictionary:** 
   - Define `ALIAS_MAP = {"front-end": "frontend", "back-end": "backend", "db": "database"}` in `graph_service.py`. Modify `_normalize_aliases` and the node/edge extraction to map aliases to their standardized values. 
   - Create a `GET /api/aliases` endpoint in `main.py` that returns the unique standard values (e.g. `["frontend", "backend", "database"]`).
2. **Frontend `layout.ts` Fix:**
   - Move `const dagreGraph = new dagre.graphlib.Graph(); dagreGraph.setDefaultEdgeLabel(() => ({}));` to the first lines inside the `getLayoutedElements` function.
3. **Frontend Config Panel & Debounce:**
   - In `App.tsx`, introduce `maxDepth`, `filterText` state.
   - Use `useEffect` with a 300-500ms `setTimeout` to debounce changes and trigger `fetchGraph`.
   - Update `fetchGraph` to include query params: `fetch('http://localhost:8000/api/graph?max_depth=${maxDepth}&filter=${filterText}')`.
4. **Frontend Overlay & Auto-complete:**
   - Fetch standard aliases from `/api/aliases` on mount.
   - Render a `<Panel position="top-right">` containing an `<input type="number">` for depth and an `<input list="aliases">` for the filter, paired with a `<datalist>` of the standard aliases.
   - Replace the `Panel` loading text with an absolute positioned `<div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10 }}>Loading...</div>` sibling to `ReactFlow`.

## Verification Method
1. **Backend**: Start the FastAPI server (`python main.py`). Test `curl http://localhost:8000/api/aliases` returns a JSON list. Test `curl "http://localhost:8000/api/graph?max_depth=2&filter=frontend"` to ensure filtering doesn't crash.
2. **Frontend**: Start Vite (`npm run dev`). Type "frontend" into the config panel filter. The API call should be delayed by ~500ms (debounce). A loading overlay should appear over the canvas. The dropdown should suggest "frontend" from the `datalist`. Changing filters multiple times should not cause overlapping layout nodes (verifying the `layout.ts` fix).
