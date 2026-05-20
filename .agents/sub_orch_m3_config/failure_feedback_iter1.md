# Iteration 1 Failure Feedback

The previous implementation failed the Challenger verification.

## Feedback from Challenger 1:
1. **CRITICAL**: The backend uses `G.to_undirected(as_view=True)` in `process_graph()`. Since `networkx` is unpinned in `requirements.txt`, it will use version 3.x, where `as_view` has been completely removed. Any request to `/api/graph` with a filter will crash with a 500 Internal Server Error (`TypeError`).
2. **HIGH**: The `/api/aliases` endpoint pulls the ENTIRE Neo4j graph into memory (O(V+E)) just to extract aliases, which will cause massive latency and OOM on large graphs. It should use a direct Cypher query instead (e.g. `MATCH (n) UNWIND n.aliases AS a RETURN DISTINCT a`).
3. **MEDIUM**: The frontend `App.tsx` completely ignores the `debounce_id` API contract and lacks a standard React cleanup (AbortController or ignore flag). This introduces race conditions where out-of-order API responses will overwrite the UI with stale data.

## Feedback from Challenger 2:
1. **CRITICAL**: `_normalize_aliases` title-cases valid canonical inputs (e.g. "frontend" becomes "Frontend" instead of "frontend" because it skips the dictionary hit). This causes the UI datalist to show diverging duplicates (e.g. "Frontend" and "frontend").
2. **HIGH**: The `/api/aliases` endpoint loads the entire Neo4j database into a NetworkX object in memory (O(V+E)) simply to extract a single property from the nodes. This is an unacceptable architectural anti-pattern for an autocomplete endpoint that could be a fast `UNWIND` Cypher query.

## Instruction to Explorers
Design a new fix strategy that explicitly addresses all these issues.
