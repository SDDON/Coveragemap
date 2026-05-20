# Explorer Handoff Report

## 1. Observation
- **NetworkX `as_view=True` Crash**: Found in `backend/graph_service.py` at line 113. `G.to_undirected(as_view=True)` is used, which was removed in NetworkX 3.x and raises a `TypeError`.
- **Neo4j `/api/aliases` Endpoint Performance**: Found in `backend/main.py` at lines 43-47. `fetch_graph_from_neo4j(session)` is called just to extract aliases, iterating over all nodes in the local MultiDiGraph. This pulls the entire graph into memory O(V+E).
- **Frontend `debounce_id` & Race Conditions**: Found in `frontend/src/App.tsx` at lines 57-111. The `useEffect` for fetching the graph uses a `setTimeout` for debounce but lacks any cancellation mechanism (no `AbortController` or `isSubscribed` flag). It also doesn't pass the `debounce_id` query parameter defined in the API contract.
- **Alias Title-casing Logic Flaw**: Found in `backend/graph_service.py` at lines 34-35. The `_normalize_aliases` function title-cases everything that is not found in `ALIAS_MAP` keys. However, the lowercase canonical values of `ALIAS_MAP` (e.g., "frontend", "backend") are missing from keys, so if a canonical value like "frontend" is passed, it falls through to the `else` block and gets wrongly transformed to "Frontend".

## 2. Logic Chain
- **NetworkX Fix**: To fix the NetworkX crash without copying the graph, we can replace `G.to_undirected(as_view=True)` with a manual lookup of neighbors by using `set(G.successors(curr_node)).union(set(G.predecessors(curr_node)))` within the BFS loop.
- **Cypher Endpoint Fix**: To fix the `/api/aliases` endpoint performance, modify `backend/main.py` to execute a direct Cypher query (`MATCH (n) UNWIND n.aliases AS alias RETURN DISTINCT alias`). The raw aliases can then be normalized using `_normalize_aliases` to maintain consistency, deduplicated, and returned.
- **Frontend React Fix**: To fix the frontend race condition, modify `App.tsx`'s `useEffect` for `fetchGraph`. Create an `AbortController`, pass its `signal` to `fetch`, and call `.abort()` in the `useEffect` cleanup function. Additionally, generate a unique `debounce_id` (e.g., `Date.now().toString()`) and append it to the `URLSearchParams`. Ignore `AbortError`s in the `catch` block.
- **Alias Logic Fix**: To fix the title-casing flaw in `_normalize_aliases`, declare `CANONICAL_VALUES = set(ALIAS_MAP.values())` at the top level. Inside the function, add an `elif a_lower in CANONICAL_VALUES:` branch that appends `a_lower` exactly as-is.

## 3. Caveats
- Passing the `AbortController` signal is sufficient to prevent state updates from outdated requests because aborted requests will throw an `AbortError`. If we also want to honor `debounce_id` in response data, we can, but checking `AbortController` is standard React practice and resolves the race condition.
- The `CANONICAL_VALUES` set must be defined outside the loop/function in `graph_service.py` to avoid re-evaluating it unnecessarily.

## 4. Conclusion
The current implementation requires four precise fixes:
1. `backend/graph_service.py`: Update `process_graph` to compute undirected neighbors via `.successors()` and `.predecessors()`.
2. `backend/graph_service.py`: Update `_normalize_aliases` to check if `a_lower` is already in the values of `ALIAS_MAP`.
3. `backend/main.py`: Update `get_aliases` to run a native Cypher `UNWIND` query and apply `_normalize_aliases(raw_aliases)` directly.
4. `frontend/src/App.tsx`: Incorporate `AbortController` and append a generated `debounce_id` query parameter in the `fetchGraph` `useEffect`.

## 5. Verification Method
- **Backend Graph Filter Test**: Restart FastAPI. Send `GET /api/graph?filter=frontend` and verify no 500 error is thrown.
- **Backend Aliases Test**: Send `GET /api/aliases`. Verify backend logs show Cypher `UNWIND n.aliases` is used, and verify "frontend" is fully lowercased in the JSON response (not "Frontend").
- **Frontend Race Condition Test**: Type rapidly in the Config Panel filter box. Inspect the Network tab to see requests being cancelled (`(canceled)` status). Verify `debounce_id` is sent as a query parameter in those network requests.
