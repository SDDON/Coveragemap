# Handoff: Backend Edit APIs (Milestone 4.1)

## Summary
The backend APIs for editing the graph (POST, PUT, DELETE for nodes and edges) are already scaffolded in `main.py` and `graph_service.py`. However, they use `status` instead of the requested `test_status`, lack validation for the Living TC required values, and do not appropriately handle missing IDs (404 errors) during updates. The plan below outlines the exact changes needed.

## 1. Observation
- **File `models.py`:** Contains `NodeModel`, `EdgeModel`, `NodeCreate`, `NodeUpdate`, `EdgeCreate`, `EdgeUpdate`. They use a property named `status: str = "Untested"`. No restriction exists on the string value.
- **File `graph_service.py`:** The CRUD operations (`create_node`, `update_node`, `delete_node`, `create_edge`, `update_edge`, `delete_edge`) read and write `status` instead of `test_status`. 
  - `update_node` attempts to update labels dynamically with `SET n:{node_data.label}`, which appends rather than replaces the label.
  - Queries for update operations (`MATCH ... SET ...`) execute successfully in Neo4j even if the ID is missing, but the Python functions do not verify if an update occurred.
- **File `main.py`:** The endpoints (`/api/nodes/{id}`, `/api/edges/{id}`) return `{"status": "success"}` universally, lacking HTTP error handling (like 404 Not Found) if the entity to be updated or deleted did not exist.

## 2. Logic Chain
1. To satisfy the requirement for a `"test_status"` field that strictly accepts `"Untested", "Passed", or "Failed"`, we must rename the existing `status` property in `models.py` to `test_status` and restrict its type using `typing.Literal`.
2. Cypher query parameters and dictionary accesses in `graph_service.py` must align with this new field name (`n.test_status`, `r.test_status`).
3. Because Neo4j's `MATCH ... SET` and `DELETE` clauses silently do nothing if a match is absent, the backend should explicitly `RETURN n` or check `result.consume().counters.properties_set` (or `nodes_deleted`) to know if the operation acted on any data. If not, FastAPI should raise an `HTTPException(status_code=404)`.
4. As the scope mandates updating "name, properties, test status", and Neo4j makes node label and edge type replacement difficult, the `label` parameter should be removed from `NodeUpdate` (and logic in `update_node`), and we shouldn't attempt edge type updates, preventing silent schema fragmentation.

## 3. Caveats
- Cypher does not allow parameterized labels/relationship types natively (e.g., `SET n:$label` fails). The current implementation uses f-string formatting (`SET n:{label}`), which introduces minor injection risks if `label` is unfiltered, and it only *adds* labels rather than replacing them. Removing `label` from the update model avoids this.
- Deleting nodes uses `DETACH DELETE`, which is correct as it cleans up orphaned edges.

## 4. Conclusion
Implement the following changes:
1. **Rename and Restrict `test_status`**: In `models.py`, replace `status: str` with `test_status: Literal["Untested", "Passed", "Failed"] = "Untested"` across all models.
2. **Update Cypher operations**: In `graph_service.py`, replace references to `status` with `test_status` (in `fetch_graph_from_neo4j`, `create_node`, `update_node`, `create_edge`, `update_edge`).
3. **Handle 404s**: Modify `update_node`, `delete_node`, `update_edge`, `delete_edge` to check query outcomes (e.g., by adding `RETURN elementId(n)` to the query and checking `result.single()`). In `main.py`, raise `HTTPException(status_code=404, detail="Not Found")` if the result is empty.
4. **Scope Updates**: Remove `label` from `NodeUpdate` and the corresponding set clause in `update_node` to avoid append-only label pollution.

## 5. Verification Method
- **Static checks**: Inspect `models.py` to ensure `test_status` uses `Literal`.
- **Automated tests**: Run the backend tests (`pytest d:\personal\living_graph_tc\backend`).
- **Endpoint tests**: Use a script or curl to test the FastAPI app locally:
  - Verify `POST /api/nodes` with `test_status: "Invalid"` returns a 422 Unprocessable Entity.
  - Verify `PUT /api/nodes/NON_EXISTENT_ID` returns a 404.
  - Verify that a valid `PUT /api/nodes/{valid_id}` correctly updates the fields and is readable via `GET /api/graph`.
