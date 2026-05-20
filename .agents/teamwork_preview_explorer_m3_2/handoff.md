# Handoff Report: Milestone 3 Fix Strategy

## Observation
- **Backend Aliases**: In `backend/graph_service.py:5-13`, `_normalize_aliases()` currently only applies `.title()` to alias strings and does not use a dictionary mapping.
- **Backend Filtering**: In `backend/graph_service.py:77-88`, `process_graph()` extracts subgraphs by iterating over matched nodes and computing `nx.ego_graph()` for each, followed by `nx.compose_all()`. There is no API endpoint exposing standard aliases.
- **Frontend Config**: In `frontend/src/App.tsx:38-84`, the `fetchGraph` function hardcodes the URL `http://localhost:8000/api/graph` without `max_depth` or `filter` query parameters. There is no input panel for these values, nor debounce logic.
- **Frontend Loading**: In `App.tsx:105`, loading state is only shown as text inside a `Panel`: `{loading && <div>Loading graph...</div>}`. The canvas itself is not visually dimmed.

## Logic Chain
1. **Alias Dictionary**: To "standardize tags/aliases" (M3 Req 1) and "force user to select from standardized alias dictionary" (M3 Req 5), the backend must define a strict alias dictionary (e.g., `{"front-end": "frontend", "db": "database"}`). `_normalize_aliases()` needs to apply this dictionary. To populate the frontend's autocomplete dropdown, the backend should expose a `GET /api/aliases` endpoint returning the distinct standard aliases.
2. **Efficient Filtering**: The current `nx.ego_graph` + `nx.compose_all` approach for subgraph extraction is computationally expensive O(K * (V+E)). A more efficient graph filtering strategy is a **multi-source Breadth-First Search (BFS)** using `collections.deque`. By initializing the queue with all matched nodes at distance 0, we can traverse up to `max_depth` in a single pass O(V+E), and return `G.subgraph(visited).copy()`.
3. **Frontend UI & Debounce**: We must create a configuration panel over the React Flow component containing a numeric input for `max_depth` and a text input for `filter`. To satisfy the autocomplete requirement, the `filter` input can use an HTML `<datalist>` connected to the standard aliases fetched from `GET /api/aliases`. A `useDebounce` React hook should wrap these inputs to delay the `fetchGraph` API call (M3 Req 3).
4. **Loading Overlay**: To implement the "semi-transparent loading overlay on the React Flow canvas" (M3 Req 4), we can add an absolute positioned `<div>` covering the canvas with `background-color: rgba(255, 255, 255, 0.5)` and `z-index: 10`, dynamically rendered when the `loading` state is true.

## Caveats
- The exact mapping of the Alias Dictionary is not specified in requirements; I recommend providing a reasonable baseline (e.g., "front-end" -> "frontend", "back-end" -> "backend") that can be expanded later.
- For autocomplete, a native HTML `<datalist>` is the simplest implementation without adding heavy UI libraries, but the worker can opt for a custom dropdown if better styling is required.
- Be aware that changing `max_depth` or `filter` will trigger a re-layout via `dagreGraph`. Supplying a consistent `debounce_id` in the API call might help the frontend track layout states.

## Conclusion
**Recommended Implementation Steps:**
1. **Backend**: Add `ALIAS_MAP` dictionary and a standard alias list to `graph_service.py`. Update `_normalize_aliases()` to use it. Add a `GET /api/aliases` route to `main.py`.
2. **Backend**: Refactor `process_graph()` in `graph_service.py` to replace `nx.ego_graph` with a multi-source BFS using `collections.deque` for efficient subgraph generation.
3. **Frontend**: Add `maxDepth` and `filter` states in `App.tsx`. Create a `useDebounce` hook. Update the `fetchGraph` URL to append these debounced variables as query parameters.
4. **Frontend**: Fetch aliases from `GET /api/aliases` on mount to populate a `<datalist>` for the `filter` input, forcing standardized alias selection.
5. **Frontend**: Add a `div.loading-overlay` element (absolute, transparent white background) overlaying the React Flow container when `loading === true`.

## Verification Method
1. Start backend `python main.py` and ensure `GET /api/aliases` returns a valid JSON array of standard aliases.
2. In the frontend (`npm run dev`), type an alias into the config panel filter. Verify the autocomplete dropdown suggests standard aliases.
3. Observe the network tab: changing inputs should delay the request by ~300-500ms (debounce), and append `?filter=X&max_depth=Y`.
4. Check that the canvas dims with a semi-transparent overlay while the network request is pending.
5. In the backend logs/tests, verify that a search for a node correctly pulls in its neighbors up to the specified `max_depth` efficiently via the new BFS implementation.
