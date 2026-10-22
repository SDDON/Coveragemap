# Project: CoverageMap

## Architecture
- **Database**: Neo4j (via Docker Compose, WSL-compatible)
- **Backend**: FastAPI (Python), NetworkX for graph processing/algorithms
- **Frontend**: React, React Flow for node-edge graph rendering
- **Data Flow**: Neo4j -> NetworkX -> FastAPI -> React Flow
- **Key Mechanics**:
  - Focus+Context: Frontend CSS-based de-emphasis.
  - Config Panel: Debounced API calls with loading overlay.
  - Alias Dictionary: Backend standardizes tags/aliases; Frontend enforces via Dropdown.
  - Living TC: Visual markers for 4-stage test status (`Untested`, `Passed`, `Failed`, `Blocked`).

## Interface Contracts
### FastAPI <-> React
- `GET /api/graph`: Returns JSON representation of the graph (nodes, edges) standardized by NetworkX. Include Alias normalization.
- `GET /api/nodes/{id}/details`: Returns full node inspector details (properties, checklist, parent/children, incoming/outgoing edges).
- `POST /api/nodes`: Create a new node.
- `PUT /api/nodes/{id}`: Update a node (including test status, alias, checklist, manual override) and propagate status downstream.
- `DELETE /api/nodes/{id}`: Delete a node.
- `POST /api/edges`: Create an edge.
- `PUT /api/edges/{id}`: Update an edge.
- `DELETE /api/edges/{id}`: Delete an edge.
- Query Params on `GET /api/graph`: `max_depth` (int), `filter` (string), `debounce_id` (string).

## Code Layout
- `/backend`: FastAPI app, `main.py`, models, routes, Neo4j connection, NetworkX logic.
- `/frontend`: React app (Vite recommended), React Flow components, CSS/styled-components.
- `/docker-compose.yml`: For local Neo4j instance.
- `/scripts`: Auto-seeding scripts or Docker entrypoints.
