# Handoff Report: Milestone 3 Fix Strategy

## 1. Observation
- **NetworkX API Change:** In `backend/graph_service.py` (line 113), `process_graph()` uses `G_undirected = G.to_undirected(as_view=True)`. NetworkX 3.x removed the `as_view` argument, which causes a `TypeError` and a 500 error on any graph filter request.
- **Neo4j Endpoint Performance:** In `backend/main.py` (lines 41-48), the `get_aliases()` endpoint calls `fetch_graph_from_neo4j(session)`. This pulls the entire graph (nodes, edges, and properties) from the database into a Python NetworkX object simply to iterate over nodes and extract their `aliases` property.
- **React Frontend API Contract & Cleanup:** In `frontend/src/App.tsx` (lines 57-111), the `useEffect` that calls `/api/graph` uses `setTimeout` to debounce, but fails to pass a `debounce_id` to the API or check the returned `data.debounce_id`. Furthermore, it lacks a React cleanup method (like `AbortController` or an `ignore` flag) to cancel pending fetches when the component unmounts or a new request is triggered.
- **Normalization Logic Flaw:** In `backend/graph_service.py` (lines 30-35), `_normalize_aliases()` checks `if a_lower in ALIAS_MAP:`. Since `ALIAS_MAP` only contains non-canonical keys (e.g., `"front-end": "frontend"`), an input that is *already* canonical (e.g., `"frontend"`) falls into the `else` block and is capitalized to `"Frontend"`.

## 2. Logic Chain
- **Issue 1 Fix (NetworkX):** Because `as_view=True` is obsolete, we can avoid the API breakage and the overhead of copying the graph by bypassing `to_undirected()` entirely. Instead of iterating `G_undirected.neighbors(curr_node)`, we can retrieve all neighbors using `list(G.successors(curr_node)) + list(G.predecessors(curr_node))`.
- **Issue 2 Fix (Neo4j Endpoint):** Loading an O(V+E) graph structure in Python for a single property extraction is an anti-pattern. We can delegate this to Neo4j using a direct Cypher query: `MATCH (n) WHERE n.aliases IS NOT NULL UNWIND n.aliases AS a RETURN DISTINCT a`. The backend then only retrieves the raw aliases and passes them through `_normalize_aliases()`.
- **Issue 3 Fix (React & Debounce):** To prevent race conditions where a slow, older API request overwrites a newer one, we must use an `AbortController`. The controller's signal is passed to `fetch()`, and `controller.abort()` is called in the `useEffect` cleanup. Additionally, to fully fulfill the API contract, the frontend should generate a unique ID (e.g., `Date.now().toString()`), send it as `debounce_id`, and verify that the response `debounce_id` matches the one requested.
- **Issue 4 Fix (Normalization):** We must prevent canonical terms from being title-cased. By extracting `canonical_values = set(ALIAS_MAP.values())` and adding an `elif a_lower in canonical_values:` branch that appends `a_lower` as-is, terms like `"frontend"` will remain `"frontend"` rather than diverging into a duplicate `"Frontend"`.

## 3. Caveats
- The Cypher query `UNWIND n.aliases` assumes `n.aliases` is correctly stored as a list in Neo4j. If a node accidentally stores a single string, Neo4j's `UNWIND` handles it gracefully (yielding the string itself), so the query remains robust.
- When implementing the `AbortController` in `App.tsx`, the `fetch` will throw an `AbortError` upon cancellation. This error must be explicitly caught and ignored to prevent it from displaying in the UI's error panel.

## 4. Conclusion
The recommended fix strategy for Milestone 3 is to implement the following code changes:
1. **`graph_service.py`**: Replace `G.to_undirected(as_view=True)` with explicit `successors` and `predecessors` iteration in `process_graph()`.
2. **`main.py`**: Rewrite `/api/aliases` to execute `MATCH (n) WHERE n.aliases IS NOT NULL UNWIND n.aliases AS a RETURN DISTINCT a`, and then normalize the results.
3. **`App.tsx`**: Update the `fetchGraph` effect to initialize an `AbortController` (aborting on cleanup), generate a `currentDebounceId`, append it to the URL, check `data.debounce_id === currentDebounceId` on success, and handle `AbortError` gracefully in the `catch` block.
4. **`graph_service.py`**: Add `elif a_lower in set(ALIAS_MAP.values()): standardized.append(a_lower)` to `_normalize_aliases()` to preserve canonical alias casing.

## 5. Verification Method
- **Backend:** Update the files and run `pytest backend/test_graph_service.py` (if available) to ensure graph traversal and normalization tests pass.
- **API:** Start the FastAPI server. Run `curl -X GET http://localhost:8000/api/aliases` and ensure the response is fast and only contains properly normalized terms (e.g., `"frontend"`, no `"Frontend"`).
- **Frontend:** Start the React app. Type rapidly into the Filter input box. Open the browser's Network tab and verify that superseded API requests are marked as `(canceled)` and no stale graph data overwrites the screen.
