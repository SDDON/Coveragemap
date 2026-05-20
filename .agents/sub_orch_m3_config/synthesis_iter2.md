# Synthesized Fix Strategy (Iteration 2)

All 3 Explorers agreed on the following fixes for the 4 issues found in Iteration 1:

1. **NetworkX Crash**:
   - In `backend/graph_service.py`, `G.to_undirected(as_view=True)` crashes because `as_view` was removed in NetworkX 3.x.
   - **Fix**: Remove the `as_view=True` argument (just use `G.to_undirected()`) or manually gather neighbors via `set(G.successors(n)).union(set(G.predecessors(n)))`.

2. **Neo4j `/api/aliases` Performance Anti-Pattern**:
   - In `backend/main.py`, `get_aliases()` currently fetches the entire graph into memory.
   - **Fix**: Replace this with a direct Cypher query:
     `result = session.run("MATCH (n) WHERE n.aliases IS NOT NULL UNWIND n.aliases AS alias RETURN DISTINCT alias")`
     Extract the strings, pass them through `_normalize_aliases()`, deduplicate, and return.

3. **React `debounce_id` and Race Conditions**:
   - In `frontend/src/App.tsx`, the `useEffect` lacks cleanup and `debounce_id` synchronization.
   - **Fix**: 
     - Generate a `debounce_id` (e.g. `Date.now().toString()`).
     - Pass it in the URL (`&debounce_id=...`).
     - Create an `AbortController`, pass its `signal` to `fetch`.
     - In the `useEffect` cleanup function, call `controller.abort()`.
     - Catch `AbortError` and ignore it.
     - Optionally verify `data.debounce_id === currentDebounceId` if the backend returns it.

4. **Alias Title-casing Flaw**:
   - In `backend/graph_service.py`, `_normalize_aliases` incorrectly title-cases canonical names (e.g., "frontend" -> "Frontend") because it only checks if the word is a key in `ALIAS_MAP`.
   - **Fix**: Define `canonical_values = set(ALIAS_MAP.values())`. Add an `elif a_lower in canonical_values:` branch that appends `a_lower` exactly as-is.
