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
  - Living TC: Visual markers for test status (Untested, Passed, Failed).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Backend Foundation | Neo4j Docker, auto-seed 20+ nodes, FastAPI setup, NetworkX integration, Graph fetch API | none | DONE |
| 2 | Core Visualization | React Flow setup, API fetch, Focus+Context feature (de-emphasize BG nodes on focus) | M1 | DONE |
| 3 | Alias & Config Control | Backend Alias Dictionary (normalize terms). Config Panel (depth/filter) with debounce & overlay. Dropdown auto-complete. | M2 | DONE |
| 4 | Living TC & Graph Editing | Test states (Untested/Passed/Failed) styling. Node/Edge creation, edit, deletion APIs & UI. | M3 | PLANNED |
| 5 | E2E Final Pass | E2E Test execution (Phase 1: Tiers 1-4, Phase 2: Tier 5) | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### FastAPI ??React
- `GET /api/graph`: Returns JSON representation of the graph (nodes, edges) standardized by NetworkX. Include Alias normalization.
- `POST /api/graph/nodes`: Create a new node.
- `PUT /api/graph/nodes/{id}`: Update a node (including test status, alias).
- `DELETE /api/graph/nodes/{id}`: Delete a node.
- `POST /api/graph/edges`: Create an edge.
- `DELETE /api/graph/edges/{id}`: Delete an edge.
- Query Params on `GET /api/graph`: `max_depth` (int), `filter` (string), `debounce_id` (optional).

## Code Layout
- `/backend`: FastAPI app, `main.py`, models, routes, Neo4j connection, NetworkX logic.
- `/frontend`: React app (Vite recommended), React Flow components, CSS/styled-components.
- `/docker-compose.yml`: For local Neo4j instance.
- `/scripts`: Auto-seeding scripts or Docker entrypoints.
