# Project: CoverageMap Stabilization, Hardening & Modularization

## Architecture
- **Backend**: FastAPI (Port 8190 default, host 127.0.0.1), Neo4j (Graph DB), NetworkX (topology & cycle checks).
  - Graph services: `backend/graph_service.py`, `backend/main.py`, `backend/preset_service.py`.
- **MCP Server**: FastMCP server (`mcp_server/server.py`) communicating with backend over HTTP with full error detection and URL encoding.
- **Frontend**: React 18, React Flow (`@xyflow/react`), ELK.js, Vite, TypeScript.
  - Acyclic 5-layer architecture:
    - Level 1: `types/` (`graph.ts`, `ui.ts`, `index.ts`)
    - Level 2: `api/` (`client.ts`), `utils/` (`constants.ts`, `edgeBundling.ts`, `graphScopes.ts`), `layout.ts`, `statusPropagation.ts`
    - Level 3: `hooks/` (`useCanvasBadgeEvents.ts`, `useFocusContext.ts`, `useGraphLayout.ts`, `useGraphOperations.ts`, `useGraphSync.ts`, `useImpactOverlay.ts`, `useQuickConnect.ts`, `useUndoStack.ts`)
    - Level 4: `components/` (`Inspector/`, `CanvasOverlays/`, `PresetManagerModal.tsx`), `CoverageNode.tsx`, `FloatingEdge.tsx`
    - Level 5: `App.tsx` (522-line top-level coordinator)
- **Verification Infrastructure**:
  - Tier 1: Static policy checker (`scripts/check_policy.py`), comment audit (`scripts/deep_comment_audit.py`), layer cycle audit (`scripts/verify_layer_dependencies.py`)
  - Tier 2: Backend tests (`backend/test_*.py` via pytest), MCP tests (`mcp_server/test_*.py`), Frontend build (`npm run build`), Linter (`npx eslint src`), Playwright E2E (`e2e-tests/`)
  - Tier 3: 10-point Human Signoff Checklist in `AI_IMPLEMENTATION_SPEC.md`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Property Overwrite Prevention | Cypher `+= $properties` placed before explicit setters; strip reserved keys in NodeModel/EdgeModel | M1 | R1, survey_backend |
| 2 | Reserved Fields Sanitization | Sanitize node/edge properties returned from Neo4j so reserved keys do not leak into `properties` | M1 | R1, survey_backend |
| 3 | Worklist Cycle Prevention | Use `processed` set in `_run_propagation` so nodes are never re-evaluated in a single pass | M1 | R1, survey_backend |
| 4 | Dependency Cycle Rejection | Reject `Depends_On` / `Tests` edges that form cycles or self-loops with HTTP 400 | M1 | R1, survey_backend |
| 5 | Return Edge Zero Weight | Ensure `Return` edges have propagation weight 0 and are omitted from synthesis inputs | M1 | R1, survey_specs |
| 6 | Global Node Non-Propagation | Global badge nodes and attachment edges never propagate Blocked/Failed to screen/component nodes | M1 | R1, survey_specs |
| 7 | Worklist Boundary Termination | Propagation worklist halts upon encountering `is_manual_override` or `is_global` nodes | M1 | R1, survey_specs |
| 8 | Preserved Direct Failed Status | Preserve tester's directly marked `Failed` status on gated nodes when upstream blocking clears | M1 | R1, survey_specs |
| 9 | Deterministic BFS Root Cause | Deterministic shortest-path BFS; Flow edges judged by edge status, dependency edges by source node | M1 | R1, survey_backend |
| 10 | Node Alias Case Preservation | Preserve original alias casing (e.g. `iOS`, `PvP`) while matching case-insensitively on rename/delete | M1 | R1, survey_backend |
| 11 | Dev Endpoint Security Gate | Gate `POST /api/dev/reset-seed` behind `ENABLE_DEV_ENDPOINTS` environment variable | M1 | R3, survey_backend |
| 12 | CORS & Host Standardization | Restrict CORS to local Vite origins; bind backend to `127.0.0.1` by default; read `PORT`/`BACKEND_PORT` | M1 | R3, survey_backend |
| 13 | Preset Path Traversal Guard | Validate `preset_id` in `preset_service.py` to prevent directory traversal (`..`, `/`, `\`) | M1 | R3, survey_backend |
| 14 | Backend Regression Test Suite | Add pytest coverage for property overwrite, cycle rejection, global nodes, traversal, dev reset | M1 | R1, R3, R5 |
| 15 | MCP Server Error Handling | Wrap `httpx` calls in `mcp_server/server.py` with ConnectError/TimeoutException handling | M2 | R2, survey_backend |
| 16 | MCP Filter URL Encoding | URL-encode filter query parameters (e.g. `#Popup` -> `%23Popup`) | M2 | R2, survey_backend |
| 17 | Policy Checker Hardening | Update `check_policy.py` for single-digit z-index, inline TSX boxShadow/opacity, transform: scale | M2 | R5, survey_backend |
| 18 | Stray Artifacts Cleanup | Remove duplicate `frontend/vite.config.js`, `remove_init.py`, 0-byte `graph.json`, `.last-run.json` | M2 | R3, survey_backend |
| 19 | Focus+Context Dimming Opacity | Set `.has-selection` unselected node/edge dimming opacity to `0.4` in `frontend/src/index.css` | M3 | R4, survey_frontend |
| 20 | Missing Keyframes & Edge Style | Define `@keyframes dash` in CSS; style `.react-flow__edge.status-blocked` with `#f59e0b` | M3 | R4, survey_frontend |
| 21 | Tokenized Styling in TSX | Replace inline status colors, `boxShadow`, `opacity`, numeric `zIndex` with CSS classes & tokens | M3 | R4, survey_frontend |
| 22 | koKR UI Localization | Centralize remaining hardcoded English UI strings in `frontend/src/locales/koKR.ts` | M3 | R4, survey_frontend |
| 23 | Mutation res.ok & Rollback | Add `res.ok` checks across all API calls; roll back local optimistic state on failure | M3 | R2, survey_frontend |
| 24 | Undo Stack Integrity | Record undo only after server confirmation; remap entity IDs across stack; sync `status-*` classes | M3 | R2, survey_frontend |
| 25 | Sequence Tracking | Guard mutation paths with sequence counters so stale status poll responses never overwrite state | M3 | R2, survey_frontend |
| 26 | Inspector Form Field Preservation | Preserve edited `name`, `aliases`, `label` in local state and Inspector form during status update | M3 | R1, survey_specs |
| 27 | App.tsx Acyclic Decomposition | Decompose 4,137-line `App.tsx` into clean 5-layer modules, reducing `App.tsx` to <800 lines | M4 | R5, survey_frontend |
| 28 | Comment Preservation | Retain 100% of existing Korean/English explanatory comments across all extracted files | M4 | R5, ORIGINAL_REQUEST |
| 29 | ESLint 0 Errors Compliance | Eliminate `@typescript-eslint/no-explicit-any`, `no-empty`, and `react-hooks/exhaustive-deps` | M4 | R5, survey_frontend |
| 30 | Drag Performance Optimization | Avoid O(N·E) per-frame work during node drag; do not mutate caller style objects in `layout.ts` | M4 | R5, survey_frontend |
| 31 | E2E Vacuous Assertion Removal | Replace `if (await count() > 0)` conditional assertions with deterministic setup and assertions | E2E | R5, survey_frontend |
| 32 | Opaque-Box E2E Coverage | Implement requirement-driven test cases (Tiers 1-4) covering all features | E2E | Project Pattern Dual Track |
| 33 | Adversarial Coverage Hardening | White-box stress testing and gap elimination (Tier 5) | E2E | Project Pattern Dual Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend State Persistence, Propagation & Security | `backend/graph_service.py`, `backend/main.py`, `backend/preset_service.py`, `backend/tests/` | none | DONE |
| M2 | MCP Resiliency, Policy Checker & Artifact Cleanup | `mcp_server/server.py`, `scripts/check_policy.py`, stray files cleanup | none | DONE |
| M3 | Frontend CSS, Localization & Mutation Rollback | `frontend/src/index.css`, `frontend/src/locales/koKR.ts`, CSS tokens in TSX, mutation rollback & undo | M1 | DONE |
| M4 | App.tsx Modular Decomposition & ESLint Zero-Error | `frontend/src/` modular decomposition into `types`, `api`, `utils`, `hooks`, `components`, comments preservation | M3 | DONE |
| E2E | E2E Testing Track (Parallel) | `e2e-tests/` test infra, vacuous assertion removal, Tiers 1-4 suites, `TEST_READY.md` | M1, M2 | DONE |
| FINAL | Final Verification & Coverage Hardening | 100% E2E test pass (Tiers 1-4) + Tier 5 adversarial hardening + 3-Tier signoff | M4, E2E | DONE |

## Interface Contracts
### Backend ↔ Frontend API Contract
- `PUT /api/nodes/{id}`:
  - Request: `NodeUpdateRequest { name?: str, label?: str, aliases?: list[str], test_status?: str, is_manual_override?: bool, override_reason?: str, properties?: dict }`
  - Response: Updated `NodeModel`. `properties` dictionary MUST NOT contain reserved top-level keys (`id`, `name`, `label`, `aliases`, `test_status`, `is_manual_override`, `override_reason`).
- `PUT /api/edges/{id}`:
  - Request: `EdgeUpdateRequest { action?: str, test_status?: str, properties?: dict }`
  - Response: Updated `EdgeModel`. `properties` dictionary MUST NOT contain reserved top-level keys (`id`, `source`, `target`, `type`, `action`, `test_status`).
  - Error: If updating edge creates dependency cycle (`Depends_On` or `Tests`), returns HTTP 400 Bad Request with `{"detail": "Dependency cycle detected"}`.
- `POST /api/edges`:
  - Error: If new edge creates dependency cycle or self-loop, returns HTTP 400 Bad Request.
- `POST /api/dev/reset-seed`:
  - Protected: Returns HTTP 403 Forbidden if `ENABLE_DEV_ENDPOINTS` environment variable is not truthy.
- `GET /api/presets/{preset_id}`:
  - Validation: Returns HTTP 400 Bad Request if `preset_id` contains path traversal tokens (`..`, `/`, `\`).

### MCP ↔ Backend Contract
- URL encoding: All query parameters with special characters (`#Popup`) must be encoded (`%23Popup`).
- Error handling: Network errors (`ConnectError`, `TimeoutException`) and non-2xx HTTP responses must return clear error messages `Error: <details>` instead of success messages.

## Code Layout
```
backend/
├── main.py                   # FastAPI application, CORS, dev endpoint gates, server binding
├── graph_service.py          # Cypher queries, state synthesis, cycle check, worklist, BFS root cause
├── preset_service.py         # Preset loading with path traversal validation
└── test_*.py                 # Pytest unit, integration, and stress test suite (224 tests)

mcp_server/
├── server.py                 # FastMCP server with resilient error handling and URL encoding
└── test_*.py                 # MCP resiliency & stress tests (16 tests)

scripts/
├── check_policy.py           # Tier 1 static policy checker (z-index, inline styles, scale, ports)
├── deep_comment_audit.py     # Verifies 150/150 domain comments are preserved
└── verify_layer_dependencies.py # Enforces 5-layer acyclic frontend architecture

frontend/
├── src/
│   ├── types/                # Level 1: Domain types (graph.ts, ui.ts, index.ts)
│   ├── api/                  # Level 2: API client with res.ok validation (client.ts)
│   ├── utils/                # Level 2: Pure utilities & constants (constants.ts, edgeBundling.ts, graphScopes.ts)
│   ├── hooks/                # Level 3: Custom domain hooks (useCanvasBadgeEvents, useFocusContext, useGraphLayout, useGraphOperations, useGraphSync, useImpactOverlay, useQuickConnect, useUndoStack)
│   ├── components/           # Level 4: UI subcomponents (Inspector/, CanvasOverlays/, PresetManagerModal.tsx)
│   ├── locales/              # koKR.ts localization dictionary
│   ├── index.css             # Focus+Context dimming (0.4), @keyframes dash, .status-blocked, parent drop-zone hint
│   └── App.tsx               # Level 5: Slim canvas coordinator (522 lines)
└── vite.config.ts            # Vite configuration with PORT/BACKEND_PORT env support

e2e-tests/                    # Playwright test suite (global-setup.ts, fixtures.ts, 10 spec files, 68 tests)
```
