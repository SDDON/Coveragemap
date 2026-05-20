# Scope: Living TC & Graph Editing

## Architecture
- FastAPI endpoints for Node/Edge creation, updates, and deletions.
- React Flow UI for managing Graph Editing (Create/Edit/Delete Node/Edge).
- React Flow UI for Living TC: mark nodes/edges with Test Status (Untested, Passed, Failed). UI updates dynamically.
- Backend Neo4j updates via FastAPI for persistence of these edits and statuses.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 4.1 | Backend Edit APIs | Implement POST/PUT/DELETE for nodes and edges in FastAPI & Neo4j. | none | IN_PROGRESS |
| 4.2 | Frontend Graph Editing | React UI for adding/editing/deleting nodes and edges. Integration with Backend APIs. | 4.1 | PLANNED |
| 4.3 | Frontend Living TC | React UI to toggle Test States of nodes/edges (Untested/Passed/Failed) and visual styles. | 4.1 | PLANNED |

## Interface Contracts
### FastAPI ↔ React
- `POST /api/graph/nodes`: Create a new node.
- `PUT /api/graph/nodes/{node_id}`: Update node (name, alias, test_status).
- `DELETE /api/graph/nodes/{node_id}`: Delete node.
- `POST /api/graph/edges`: Create an edge (source, target, label).
- `PUT /api/graph/edges/{edge_id}`: Update edge (test_status). (Wait, neo4j edges need ID or source/target, let's use source/target or ID).
- `DELETE /api/graph/edges/{edge_id}`: Delete an edge.
