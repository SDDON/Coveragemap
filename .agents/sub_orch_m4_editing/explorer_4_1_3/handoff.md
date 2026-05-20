# Handoff Report: Milestone 4.1 Backend Edit APIs

## Observation
- `main.py` currently has the REST endpoints (`POST /api/nodes`, `PUT /api/nodes/{node_id}`, `DELETE /api/nodes/{node_id}`, and similarly for edges) already stubbed/wired to `graph_service.py`.
- `models.py` defines `NodeCreate`, `NodeUpdate`, `EdgeCreate`, `EdgeUpdate` with a `status: str = "Untested"` field, instead of the required `test_status`.
- `graph_service.py` currently sets `status` using `n_props.get("status", "Untested")` and stores it as `n.status`.
- Cypher injection vulnerability: `create_node` uses string interpolation `f"CREATE (n:`{node_data.label}`)"` and `create_edge` uses `f"CREATE (source)-[r:`{edge_data.type}`]->(target)"` without validating `label` or `type` inputs. 
- `update_node` string interpolates the label update as `f"SET n:`{node_data.label}`"`. In Neo4j, `SET n:Label` *adds* a label but does not remove existing labels.
- `update_edge` accepts `edge_data.type` via the `EdgeUpdate` model, but the `update_edge` function in `graph_service.py` ignores it. Neo4j does not support changing relationship types natively (you must delete and recreate the relationship).

## Logic Chain
1. **Model Updates**: To fulfill the `test_status` requirement, rename `status` to `test_status` in all Pydantic models. We should use `Literal["Untested", "Passed", "Failed"]` for `test_status` to ensure data integrity.
2. **Cypher Query Renaming**: In `graph_service.py`, all instances of `status` must be renamed to `test_status` (e.g., `n.test_status = $test_status`, `r.test_status = $test_status`).
3. **Security (Cypher Injection)**: Neo4j requires labels and relationship types to be static in the query structure. To make string interpolation safe, `label` and `type` fields in `models.py` must be restricted using Pydantic regex validation (e.g., `Field(pattern=r"^[A-Za-z0-9_]+$")`) to ensure they contain only safe alphanumeric characters.
4. **Node Label Updates**: Updating a node's label properly in Neo4j without APOC requires querying its current labels, removing them, and setting the new one. Alternatively, if labels are static after creation, we should remove `label` from `NodeUpdate` to avoid "label accumulation" bugs where a node ends up with multiple disjoint labels over time.
5. **Edge Type Updates**: Since Neo4j relationships are strictly immutable regarding type, `type` should be removed from `EdgeUpdate`. If a user needs to change an edge type, the frontend should issue a DELETE followed by a POST.

## Caveats
- I did not test the actual execution of Neo4j queries because I am in read-only investigation mode.
- Pydantic's `Literal` might cause slight type-checking issues depending on the Python version, but since Python 3.8+ it is well supported via `typing.Literal`.
- The assumption is made that nodes only have a single primary label that matters for the UI. If multi-label nodes are used, the label update logic would be significantly more complex.

## Conclusion
The backend is mostly wired, but the implementation needs safety and correctness fixes to meet the milestone.
**Implementation Plan**:
1. **`models.py`**:
   - Change `status` to `test_status: Literal["Untested", "Passed", "Failed"] = "Untested"`.
   - Add regex validation to `NodeCreate.label` and `EdgeCreate.type` (e.g., `Field(..., pattern=r"^[A-Za-z0-9_]+$")`).
   - Remove `label` from `NodeUpdate` (or implement full label replacement logic in graph_service).
   - Remove `type` from `EdgeUpdate` (enforcing immutability).
2. **`graph_service.py`**:
   - Update `fetch_graph_from_neo4j` to read `test_status` from node/edge properties.
   - Update `convert_to_response` to map `test_status`.
   - Change `$status` to `$test_status` in Cypher queries for `create_node`, `update_node`, `create_edge`, and `update_edge`.
   - (Optional but recommended) Add try/except blocks around `session.run()` for `create_edge` to catch missing nodes.
3. **`main.py`**:
   - Endpoints are already correctly mapping to the service layer. Ensure any DB exceptions are caught and return a 400 or 404 HTTP response.

## Verification Method
- **Static Analysis**: Run `pytest test_graph_service.py` to ensure processing still works.
- **API Tests**: Use `curl` or FastAPI's Swagger UI (`http://localhost:8000/docs`) to test:
  1. `POST /api/nodes` with an invalid `label` (e.g., `"Invalid Label //"`) to verify the regex rejects it (422 Unprocessable Entity).
  2. `POST /api/nodes` with `test_status="Invalid"` to verify it's rejected.
  3. `POST /api/nodes` with `test_status="Passed"` to verify successful creation.
  4. Ensure `PUT /api/edges/{id}` rejects attempts to pass a `type` payload.
