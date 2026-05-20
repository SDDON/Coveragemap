# Handoff Report: Milestone 4.1 "Backend Edit APIs"

## 1. Observation
- The basic structure for POST/PUT/DELETE APIs is **already implemented** in `main.py` (e.g., `@app.post("/api/nodes")`, `@app.put("/api/nodes/{node_id}")`, `@app.delete("/api/nodes/{node_id}")`).
- In `models.py` (lines 4-49), the fields for node/edge status are currently named `status` (typed as `str` with a default of `"Untested"`), rather than `test_status`. 
- In `graph_service.py`, node and edge property extraction and database queries reference `status` instead of `test_status` (e.g., line 84: `status = n_props.get("status", "Untested")`, line 196: `n.status = $status,`).
- The `status` field is currently unrestricted (`str`), rather than constrained to the three Living TC states: `"Untested", "Passed", "Failed"`.

## 2. Logic Chain
- Since the routing and underlying Neo4j insertion/deletion functions already exist, the remaining work is solely about aligning the data models with the "Living TC" requirements (`test_status`).
- To enforce the exact states `"Untested", "Passed", "Failed"`, Pydantic's `Literal` type can be used in `models.py`. This will automatically validate incoming POST/PUT requests.
- The property name in Neo4j queries (`graph_service.py`) and the JSON responses (`models.py`) must be updated from `status` to `test_status` to match the milestone requirements.

## 3. Caveats
- **Schema Migration**: Existing nodes/edges in the Neo4j database might still use the `status` property. When the backend expects `test_status`, existing items will default to `"Untested"`. A manual Cypher migration query should be run to preserve existing data: 
  `MATCH (n) WHERE n.status IS NOT NULL SET n.test_status = n.status REMOVE n.status`
  `MATCH ()-[r]->() WHERE r.status IS NOT NULL SET r.test_status = r.status REMOVE r.status`
- **Frontend Impact**: The UI must be updated simultaneously to send/receive `test_status` instead of `status` in the JSON bodies.

## 4. Conclusion
The implementation plan for Milestone 4.1 is:
1. **Modify `models.py`**:
   - Import `Literal` from `typing`.
   - Define a type alias `TestStatus = Literal["Untested", "Passed", "Failed"]`.
   - Rename all `status` fields to `test_status` across `NodeModel`, `EdgeModel`, `NodeCreate`, `NodeUpdate`, `EdgeCreate`, `EdgeUpdate`.
   - Set the type of `test_status` to `TestStatus` (or `Optional[TestStatus]` for updates).
2. **Modify `graph_service.py`**:
   - Replace all occurrences of `"status"` property extraction with `"test_status"`.
   - Update Cypher queries in `create_node`, `update_node`, `create_edge`, `update_edge` to use `n.test_status` and `r.test_status` instead of `.status` (and variable names as appropriate).
3. **Database Migration**: Run the Cypher rename queries to migrate legacy `status` fields to `test_status`.

## 5. Verification Method
- **Code Inspection**: Verify `models.py` uses `test_status: Literal["Untested", "Passed", "Failed"]`.
- **API Tests**: Use a Python script to send a `POST /api/nodes` request with `{"label": "Test", "name": "TestNode", "test_status": "Invalid"}`. Pydantic should reject it with a 422 Unprocessable Entity error. 
- **API Tests**: Send a `POST /api/nodes` with `{"label": "Test", "name": "TestNode", "test_status": "Passed"}` and verify it returns a 200 OK. Fetch the graph via `GET /api/graph` and ensure the node has `test_status: "Passed"`.
