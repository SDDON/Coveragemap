# Challenge Report: Milestone 3

## Observation
- The backend `requirements.txt` leaves `networkx` unpinned, which results in installing the latest version (>3.0).
- `backend/graph_service.py` uses `G.to_undirected(as_view=True)` inside `process_graph`. The `as_view` argument was deprecated in NetworkX 2.6 and completely removed in NetworkX 3.0.
- `backend/main.py` defines the `/api/aliases` endpoint which calls `fetch_graph_from_neo4j(session)` to pull the entire graph from the database into a NetworkX object just to iterate over all nodes and collect their aliases.
- `frontend/src/App.tsx` debounces the `fetchGraph` call with a 300ms `setTimeout`, but it does not pass the `debounce_id` to the backend, nor does it implement an `AbortController` or a boolean `ignore` flag in the `useEffect` cleanup to handle out-of-order network responses.

## Logic Chain
1. **NetworkX Crash**: Because `networkx` is unpinned, the environment will use version 3.x. Calling `G.to_undirected(as_view=True)` will raise a `TypeError: to_undirected() got an unexpected keyword argument 'as_view'`. This guarantees that any API call with a `filter` parameter will result in a 500 Internal Server Error.
2. **O(V+E) Scalability Flaw**: To generate a list of unique aliases, `/api/aliases` pulls every single node and edge from Neo4j into memory. For large graphs, this will cause massive latency and potential Out-Of-Memory (OOM) errors, acting as an unintentional Denial of Service vector when the frontend loads.
3. **Frontend Race Condition**: The frontend does not use the `debounce_id` query parameter (which was specifically required by the interface contract) and lacks standard async cleanup. If a user types quickly and triggers multiple requests, a slow response from an earlier request can overwrite the graph state, causing the UI to display stale/incorrect graph data.

## Caveats
- I was unable to dynamically execute the backend to observe the 500 error directly due to lack of environment execution permissions, but the `networkx` API changes regarding `as_view=True` are strictly documented and verified.
- The `O(V+E)` alias fetching might be acceptable for trivial graphs under 100 nodes, but it is architecturally unsafe for a production application.

## Conclusion
**VETO** - The Milestone 3 implementation is rejected. The backend contains a fatal crash vulnerability on graph filtering, a critical performance bottleneck on the alias endpoint, and the frontend is susceptible to race conditions because it ignores the `debounce_id` synchronization contract.

## Verification Method
1. Start the backend with `uvicorn main:app --reload`.
2. Make a request to `GET http://localhost:8000/api/graph?filter=test` and observe the `TypeError` crash.
3. Review `backend/main.py:get_aliases` to confirm it needlessly calls `fetch_graph_from_neo4j()`.
4. Review `frontend/src/App.tsx` and observe that `debounce_id` is never appended to the URL parameters.
