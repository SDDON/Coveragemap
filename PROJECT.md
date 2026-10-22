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

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Backend Foundation | Neo4j Docker, auto-seed 20+ nodes, FastAPI setup, NetworkX integration, Graph fetch API | none | DONE |
| 2 | Core Visualization | React Flow setup, API fetch, Focus+Context feature (de-emphasize BG nodes on focus) | M1 | DONE |
| 3 | Alias & Config Control | Backend Alias Dictionary (normalize terms). Config Panel (depth/filter) with debounce & overlay. Dropdown auto-complete. | M2 | DONE |
| 4 | Living TC & Graph Editing | Test states (`Untested`/`Passed`/`Failed`/`Blocked`) styling & propagation. Node/Edge creation, edit, deletion APIs & UI. | M3 | DONE |
| 5 | E2E Final Pass | E2E Test execution (3-Tier Verification Pipeline: `check_policy.py`, `pytest`, Playwright E2E) | M1, M2, M3, M4 | DONE |

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
