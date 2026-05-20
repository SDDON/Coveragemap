# Handoff Report: Milestone 3-1 (Backend Alias Logic)

## 1. Observation
- In `backend/graph_service.py` (lines 7-16), an `ALIAS_MAP` is defined, and `_normalize_aliases` correctly normalizes arrays of aliases.
- In `backend/graph_service.py` (lines 68, 81), `n.get("aliases")` is successfully normalized for all nodes: `aliases = _normalize_aliases(n.get("aliases"))`.
- However, when adding nodes and edges to the NetworkX graph (`G.add_node`, `G.add_edge`), properties are passed as raw dicts (`properties=dict(n)` and `properties=dict(r)`). Edge types are passed directly as `type=r.type`.
- According to `d:\personal\living_graph_tc\.agents\sub_orch_m3_resume\SCOPE.md` (line 4): "The `GET /api/graph` endpoint should normalize `category` or `type` or relevant view properties to standard terms."
- In `backend/main.py` (lines 40-51), the `GET /api/aliases` endpoint properly aggregates and returns normalized alias values from all `n.aliases` arrays.

## 2. Logic Chain
1. The backend has successfully laid the groundwork for aliases (`ALIAS_MAP`, `_normalize_aliases`, and the `/api/aliases` endpoint).
2. Node `aliases` fields are being correctly intercepted and normalized during the Neo4j -> NetworkX conversion.
3. However, single-value fields (e.g., node `category`, edge `type`, node/edge `type` property) are extracted and appended to the graph without passing through `ALIAS_MAP`.
4. Because the scope requires standardizing `category` and `type` properties, the current implementation is incomplete and needs a minor fix to apply standardisation to those fields as well.

## 3. Caveats
- It is assumed that properties like `category` and `type` will contain strings that map to `ALIAS_MAP` keys.
- Edge `type` in Neo4j is capitalized by convention, but `ALIAS_MAP` values are lowercase. `_normalize_aliases` title-cases unrecognized terms, which might change edge types from `RELATED` to `Related`. If `type` needs to be uppercase, a different normalizer or an `.upper()` conversion on the final edge type may be necessary. For now, the proposed fix handles basic mapping and title-casing.

## 4. Conclusion
The Backend Alias Logic is mostly implemented but misses the requirement to normalize `category` and `type` fields. 

**Proposed Fix Strategy**: 
Introduce a `_normalize_string` helper in `backend/graph_service.py` and apply it to properties and edge types during `fetch_graph_from_neo4j`. 

**Snippet for proposed fix (`backend/graph_service.py`)**:
```python
def _normalize_string(val: Any) -> Any:
    if not isinstance(val, str):
        return val
    val_lower = val.lower()
    if val_lower in ALIAS_MAP:
        return ALIAS_MAP[val_lower]
    elif val_lower in CANONICAL_VALUES:
        return val_lower
    return val.title()
```

Inside `fetch_graph_from_neo4j`, before adding a node/edge, normalize the specific keys:
```python
# For node properties
n_props = dict(n)
for key in ["category", "type"]:
    if key in n_props:
        n_props[key] = _normalize_string(n_props[key])

# For edge properties and type
r_props = dict(r)
for key in ["category", "type"]:
    if key in r_props:
        r_props[key] = _normalize_string(r_props[key])
normalized_edge_type = _normalize_string(r.type)

G.add_edge(n_id, m_id, type=normalized_edge_type, properties=r_props)
```

## 5. Verification Method
- Edit `backend/graph_service.py` to include the fix.
- Ensure `uvicorn main:app` runs without errors.
- Create a test node in Neo4j with `category: "front-end"` or an edge with `type: "FRONT-END"`.
- Fetch `GET /api/graph` and verify the output JSON shows the properties translated to `frontend`.
