# Milestone 4 Implementation Strategy: Graph Editing and Living TC

**Observation**
- `backend/models.py` (Lines 4-15): Current `NodeModel` and `EdgeModel` lack a `status` field. They also lack Pydantic schemas for creation/updating. `EdgeModel` currently lacks a unique `id` property, making edge targeting difficult for PUT/DELETE operations.
- `backend/main.py` (Lines 24-51): Currently only exposes `GET /api/graph` and `GET /api/aliases`. No POST/PUT/DELETE endpoints exist.
- `backend/graph_service.py` (Lines 48-87): `fetch_graph_from_neo4j` captures `dict(n)` into `properties` but doesn't explicitly parse out `status`. It also doesn't fetch edge `element_id` to provide as a unique Edge ID.
- `frontend/src/App.tsx` (Lines 31-205): Uses React Flow with default nodes/edges (Lines 81-95). The `hasSelection` state tracks if an element is selected (Line 34). It has an `<input list="alias-list">` for filtering (Lines 153-165), populated by the `/api/aliases` endpoint, but it is not currently used for a node creation/editing form.
- The user requested that we support changing the node/edge `status` visually (green/red/default) and enforce the use of the alias dropdown when editing or adding a node.

**Logic Chain**
1. **Backend - Models (`models.py`)**: 
   - Add `status: str = "Untested"` to `NodeModel` and `EdgeModel`.
   - Add `id: str` to `EdgeModel` so it can be uniquely identified for PUT/DELETE endpoints.
   - Add schemas for requests: `NodeCreate`, `NodeUpdate`, `EdgeCreate`, `EdgeUpdate`.
2. **Backend - Database Logic (`graph_service.py`)**:
   - Update `fetch_graph_from_neo4j` to assign edge `id` from `str(r.element_id)` and explicitly extract `status` from `n.get("status", "Untested")` (and similar for edges).
   - Update `convert_to_response` to map `status` and `id` to the respective models.
   - Add CRUD methods: `create_node`, `update_node`, `delete_node` (using `elementId(n)`), and similarly for edges (using `elementId(r)`).
3. **Backend - Endpoints (`main.py`)**:
   - Add `POST /api/nodes`, `PUT /api/nodes/{node_id}`, `DELETE /api/nodes/{node_id}`.
   - Add `POST /api/edges`, `PUT /api/edges/{edge_id}`, `DELETE /api/edges/{edge_id}`.
   - These will accept the new creation/update schemas and call the `graph_service` CRUD methods, utilizing the `get_db` session.
4. **Frontend - Visuals (`App.tsx`)**:
   - Map `n.status` and `e.status` (from the API response) to React Flow styling:
     - Nodes: `style: { backgroundColor: n.status === 'Passed' ? '#c8e6c9' : (n.status === 'Failed' ? '#ffcdd2' : '#ffffff') }`
     - Edges: `style: { stroke: e.status === 'Passed' ? 'green' : (e.status === 'Failed' ? 'red' : 'gray') }`
5. **Frontend - Editing UI (`App.tsx`)**:
   - When `hasSelection` is true, render an "Edit Node" or "Edit Edge" form in the right-side Panel.
   - The Node Edit form should include a Status dropdown (Untested, Passed, Failed) and an Alias input that uses the existing `<datalist id="alias-list">`.
   - Add a "Create Node" button that opens an empty form, using the same `<datalist>`.
   - Wire the form submissions and React Flow's `onNodesDelete`/`onEdgesDelete` to send the correct POST/PUT/DELETE fetch calls to the new backend endpoints, triggering a graph refetch afterward.

**Caveats**
- Relying on `element_id` for Neo4j is valid for Neo4j 5+, but queries must strictly use `WHERE elementId(n) = $id` rather than `id(n)`.
- If an edge is created, React Flow expects a source and target ID immediately. The backend POST `/api/edges` must return the new edge's ID so the frontend can properly register it without waiting for a full `fetchGraph` refresh, or we just rely on `fetchGraph` after a successful mutation.
- The `aliases` field in `models.py` is a `List[str]`. The frontend editing form will need to convert the comma-separated alias input string into an array before sending it in a POST/PUT request.

**Conclusion**
To implement Milestone 4, the following files MUST be modified:
1. `backend/models.py` (Add status and id fields, create CRUD schemas)
2. `backend/main.py` (Expose 6 new POST/PUT/DELETE endpoints)
3. `backend/graph_service.py` (Add 6 CRUD database functions and update `fetch` mappings)
4. `frontend/src/App.tsx` (Add inline styling for nodes/edges based on status, and build the create/update forms utilizing the `alias-list` datalist).

No new libraries or major architectural changes are needed; standard FastAPI routes and React state management are sufficient.

**Verification Method**
1. Backend Tests: Verify `pytest backend/` passes if any tests exist. Add temporary `test_crud.py` to ensure POST `/api/nodes` correctly writes to Neo4j.
2. Frontend Verification: Run the UI and visually verify that a node changed to "Passed" turns green. Confirm that the Alias `<datalist>` dropdown appears when typing in the Create/Edit node form. Ensure clicking delete properly removes the element from Neo4j and the UI.
