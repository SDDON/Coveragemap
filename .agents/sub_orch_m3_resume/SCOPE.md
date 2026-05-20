# Scope: Milestone 3 - Alias & Config Control

## Architecture
- **Backend Alias Dictionary**: A module or dict mapping aliases to standard terms. The `GET /api/graph` endpoint should normalize `category` or `type` or relevant view properties to standard terms.
- **Frontend Config Panel**: A UI component that allows the user to specify `max_depth` (int) and `filter` (string).
- **Debounce & Loading Overlay**: The config panel inputs should have a debounce before triggering API calls to prevent rapid firing. While the API is fetching, an overlay should block the canvas to prevent race conditions.
- **Dropdown Auto-complete**: When filtering or searching, the user should be forced to select from the standardized terms (Alias Dictionary keys/values synced from the backend or statically available, but backend is source of truth).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Backend Alias Logic | Create alias mapping, update graph fetch logic to normalize node/edge properties. | none | DONE |
| 2 | Frontend Config UI | Build config panel with debounce, max_depth, filter, and dropdown auto-complete. | M3-1 | DONE |
| 3 | Loading Overlay | Implement semi-transparent overlay on canvas during API fetches. | M3-2 | DONE |

## Interface Contracts
### FastAPI ↔ React
- `GET /api/graph`: Returns JSON representation of the graph (nodes, edges). Properties matching aliases are normalized to standard terms.
- Additional endpoint `GET /api/aliases` (optional but recommended) to return the valid standard terms for the dropdown auto-complete.
- Query Params on `GET /api/graph`: `max_depth` (int), `filter` (string).
