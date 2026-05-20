# Handoff Report: Milestone 3-1 Backend Alias Logic

## 1. Observation
In `.agents/sub_orch_m3_resume/SCOPE.md`, the requirement for M3-1 states:
> "Backend Alias Dictionary: A module or dict mapping aliases to standard terms. The `GET /api/graph` endpoint should normalize `category` or `type` or relevant view properties to standard terms."

When inspecting `backend/graph_service.py`, I observed that:
- `ALIAS_MAP` and `_normalize_aliases()` are implemented and handle lists of alias strings.
- Node normalization is only applied to `n.get("aliases")` (line 68: `aliases = _normalize_aliases(n.get("aliases"))`).
- The `label` of the node is extracted directly without normalization (line 63: `label = n_labels[0] if n_labels else "Node"`).
- The edge `type` is extracted directly without normalization (line 85: `type=r.type`).
- In `backend/main.py`, the `/api/aliases` endpoint only queries Neo4j for the `aliases` property, without fetching distinct node labels or edge types.

## 2. Logic Chain
1. The requirement explicitly asks to "normalize `category` or `type` or relevant view properties to standard terms."
2. The current implementation in `graph_service.py` successfully standardizes the `aliases` array but fails to normalize single-string view properties such as the node `label`, `properties["category"]`, and edge `type`.
3. Consequently, if a node has a label "Front-End" or an edge has a type "UI", they are not mapped to "frontend" and "ui" respectively, breaking the standard term constraint for the UI display and filtering.
4. Therefore, M3-1 is only partially implemented and requires a fix to extend the normalization logic to scalar strings (node label, node category, edge type).

## 3. Caveats
- I did not test the graph filter directly by running the FastAPI server, as my role is a read-only investigation.
- I assume `label` (which is mapped to `n_labels[0]`) and `r.type` are the primary fields meant by "category or type or relevant view properties". If there are specific keys within `properties=dict(n)` like `category`, those should also be targeted.

## 4. Conclusion
M3-1 is **not fully implemented**. The alias dictionary exists, but it only normalizes the `aliases` array property. 

**Recommended Fix Strategy:**
1. In `backend/graph_service.py`, introduce a scalar normalization helper `_normalize_string(val: str) -> str` that checks `ALIAS_MAP` or `CANONICAL_VALUES` and returns the standardized term.
2. Apply `_normalize_string()` to the node's `label` before calling `G.add_node(..., label=label, ...)`.
3. Apply `_normalize_string()` to the edge's `type` before calling `G.add_edge(..., type=r.type, ...)`.
4. (Optional) Check and normalize a specific `category` or `type` key within `dict(n)` if it exists.
5. In `backend/main.py` -> `get_aliases()`, consider expanding the Cypher query to also return distinct labels and edge types if they are meant to be valid terms in the autocomplete dropdown.

## 5. Verification Method
- **Code Inspection:** Check `backend/graph_service.py` to ensure `label` and `type` variables are wrapped in a normalizer function.
- **API Testing:** Launch `uvicorn main:app --reload`, create a Neo4j node with label "Front-End" and an edge of type "UI". Fetch `GET /api/graph` and verify the JSON response contains `"label": "frontend"` and `"type": "ui"`.
