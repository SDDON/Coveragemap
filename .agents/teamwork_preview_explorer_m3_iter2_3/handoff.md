# Handoff Report: Milestone 3 Config & Alias Fix Strategy

## 1. Observation
1. **`process_graph()` crashing**: In `backend/graph_service.py:113`, `G.to_undirected(as_view=True)` is used. NetworkX 3.x removed the `as_view` parameter from `to_undirected()`.
2. **OOM risk in `/api/aliases`**: In `backend/main.py:43-47`, `get_aliases()` calls `fetch_graph_from_neo4j(session)` which executes a `MATCH (n) OPTIONAL MATCH (n)-[r]->(m)` Cypher query, pulling the entire graph into memory in Python just to aggregate the `aliases` string property.
3. **Missing `debounce_id` and cleanup**: In `frontend/src/App.tsx:106-111`, `fetchGraph()` is wrapped in a `setTimeout` for 300ms but does not append `debounce_id` to the `URLSearchParams`, nor does it verify `debounce_id` on return. There is no `AbortController` or `ignore` flag to prevent stale data updates from out-of-order network responses.
4. **Incorrect title-casing**: In `backend/graph_service.py:31-35`, `_normalize_aliases` title-cases inputs if they are not keys in `ALIAS_MAP`. Canonical values like `"frontend"` are not keys, so they fall into the `else` block and get mutated to `"Frontend"`.

## 2. Logic Chain
1. Removing `as_view=True` from `G.to_undirected()` in `graph_service.py` resolves the `TypeError` under NetworkX 3.x, gracefully defaulting to returning a new undirected graph (which is fully acceptable for the BFS depth traversal logic).
2. Changing `get_aliases()` in `main.py` to run a direct Cypher query (`MATCH (n) WHERE n.aliases IS NOT NULL UNWIND n.aliases AS alias RETURN DISTINCT alias`) will only extract the strings we need. We can then pass these through `_normalize_aliases()` in Python, dropping graph extraction complexity from O(V+E) to O(V).
3. Implementing `AbortController`, an `ignore` flag, and explicitly passing/checking `debounce_id` in `frontend/src/App.tsx` guarantees that the UI resolves race conditions by ignoring out-of-order or canceled API fetches.
4. Modifying `_normalize_aliases` to check if `a_lower in ALIAS_MAP.values()` will preserve intended lower-case canonical names without inadvertently title-casing them, removing duplicate diverging terms from the UI datalist.

## 3. Caveats
- The Cypher query `UNWIND n.aliases` assumes `aliases` is stored as an array of strings in Neo4j. If some records store them as single strings, `UNWIND` might behave differently or the Python side might need to parse them. However, since the Python `_normalize_aliases` function handles strings vs lists well, we just need to ensure `get_aliases` runs `_normalize_aliases(record["alias"])`.
- Modifying `App.tsx` requires taking care to abort the controller in the `useEffect` return cleanup block.

## 4. Conclusion
A straightforward set of 4 targeted fixes perfectly covers all feedback points:
1. **Backend**: Update `backend/graph_service.py` to use `G.to_undirected()`.
2. **Backend**: Update `backend/main.py` `get_aliases` endpoint with `session.run("MATCH (n) WHERE n.aliases IS NOT NULL UNWIND n.aliases AS alias RETURN DISTINCT alias")`. Import `_normalize_aliases` to normalize the resulting strings.
3. **Frontend**: Update `frontend/src/App.tsx` `useEffect` hook to use `AbortController` for network cancellation, add an `ignore` flag, and generate/validate `debounce_id` against the API response.
4. **Backend**: Update `backend/graph_service.py` `_normalize_aliases` to add an `elif a_lower in ALIAS_MAP.values(): standardized.append(a_lower)`.

## 5. Verification Method
1. Run backend tests or trigger `GET /api/graph?filter=foo` manually to ensure `TypeError` is resolved.
2. Trigger `GET /api/aliases` to verify the JSON payload is small and returns quickly without hanging on large DBs.
3. Rapidly type in the frontend filter box to visually confirm only the last fired debounced response paints the UI (inspect network tabs for aborted requests).
4. Check the frontend datalist for aliases to confirm it lists canonical terms properly (e.g. "frontend" instead of "frontend" + "Frontend").
