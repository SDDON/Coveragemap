# AI Development & Architecture Guide for 'CoverageMap'

## Project Context
This project is a 'Living Document Platform' aimed at visualizing the non-linear structure of mobile game QA processes. It replaces traditional linear spreadsheets with an interactive graph-based testing coverage tool (CoverageMap).

> ⚠️ **MANDATORY SPECIFICATION FOR ALL AI AGENTS (Gemini 4, Claude Opus, GPT-5):**  
> Before modifying or adding any feature, you MUST read and strictly adhere to **[AI_IMPLEMENTATION_SPEC.md](file:///e:/Workspace/coveragemap/AI_IMPLEMENTATION_SPEC.md)**. That document is the single immutable source of truth (SSOT) for domain logic, state machines, Z-Index tokens, and verification policies.

## Tech Stack
- **Data Layer:** Neo4j (Graph Database). Supports both Docker (WSL) and native Windows binary environments.
- **Backend:** Python (FastAPI, Port 8190), NetworkX (for graph filtering/processing), `uv` (for package management).
- **Frontend:** React 18, React Flow (@xyflow/react for interactive graph UI), ELK.js (layered auto-layout), Vite, TypeScript.
- **E2E Testing:** Playwright (TypeScript).
- **Agent Interop:** MCP Server (`mcp_server/server.py`).

## Core Requirements & Conventions
1. **Neo4j Dual Environment Support:** The backend connects to Neo4j using environment variables (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`) via `python-dotenv` to easily switch between Docker and local Windows binary setups.
2. **Living TC 4-Stage Status Taxonomy:**
   - Elements have one of 4 statuses: `Untested` (⚪), `Passed` (🟢), `Failed` (🔴), `Blocked` (🟡).
   - If incoming dependencies fail, downstream nodes automatically transition to `Blocked`.
   - Manual Override (📌) allows forcing a status with mandatory `override_reason` notes without being overwritten by synthesis.
   - Root Cause Tracing highlights the path to the original failing node with `.highlight-root-cause` pulsing animation.
3. **i18n Localization (Korean single locale):** UI strings are centralized in `frontend/src/locales/` (`koKR.ts`, exported as `t` / `I18N_LOCALES`). Only Korean is maintained. No file under `frontend/src` (except `frontend/src/locales/`) may hardcode Hangul UI strings; this is enforced by Tier 1 (`scripts/check_policy.py` rule 6). Comments are allowed.
4. **Focus+Context Pure CSS Rule (Zero-JS Styling):**
   - Clicking a node (Focus) dims surrounding unrelated nodes (Context) strictly via CSS classes: `.has-selection`, `.active`, `.highlight-incoming`, `.highlight-outgoing`.
   - NEVER inject inline opacity/grayscale calculations in TSX.
5. **12-Tier Standard Z-Index Layering Tokens:**
   - Hardcoded numeric z-index values (e.g. `z-index: 1000`) are strictly banned.
   - Always use CSS variables: `--z-canvas-bg` (0), `--z-edge` (10), `--z-parent-node` (20), `--z-child-node` (30), `--z-active-node` (40), `--z-node-badge` (50), `--z-canvas-controls` (100), `--z-floating-panel` (200), `--z-context-menu` (500), `--z-tooltip` (1000), `--z-loading-overlay` (2000), `--z-modal` (3000), `--z-toast` (9999).
6. **Optimistic Updates & Anti-Jumping:** Graph mutations (status changes, badge toggles, edge additions) must immediately update local React state (`setNodes`, `setEdges`) to prevent layout jumping and lost zoom focus.
7. **Parent Collapse & Dynamic Chips:**
   - Parent nodes use `isCollapsed` to contain 10+ child features into a single summary progress bar.
   - Unlimited perspectives (Localization, Audio, Network) display as dynamic issue chips only when faults occur, keeping nodes compact.
8. **Port Standardization:** The default port is `8190`. Always read `PORT` and `BACKEND_PORT` from environment variables before falling back.
9. **Inner Content vs Outer Rim Isolation (Halo Handle):**
   - Halo handles (`.halo-handle`) MUST strictly remain on the outer boundary (outer rim) and NEVER encroach on the node's inner content area (0px inward) to prevent click stealing on badges (✔/✖/⊘) and collapse buttons.
   - The handle's stacking level must stay at or below `z-index: var(--z-canvas-bg)` (0), strictly below `.custom-node` (1) and badges (50).
   - **Target Drop Hitbox:** Currently the target handle is at the center (50%, 50%). When expanding target drop hitbox to cover the node body, it must be active only during connection drag (`.react-flow--connecting`) to preserve inner click isolation.
10. **Parent Scale Immutability & Clean Light Theme:**
   - Active parent nodes must NEVER use `transform: scale` to prevent child coordinate detachment. Highlight using `box-shadow` and direct child (`>`) selectors only.
   - Subflows are strictly limited to Max Depth = 1. Cross-cutting concerns (Localization) must be flattened into attribute checkboxes/chips.
   - Default theme is Clean Light (Slate-50 background, white cards, slate-900 text) for readability.
11. **Black-Box QA Environment (Zero-Code Access Policy):**
   - CoverageMap operates strictly in a **pure black-box QA environment** where QA engineers have **NO ACCESS to game client source code, internal repositories, or game engine project files (Unity, Unreal)**.
   - All white-box methods, engine asset parsers (Prefabs, Scenes, UMG), and source code reflection tools are strictly banned.
   - Graph structures, verification points, and test results must be constructed exclusively from external test artifacts (Spreadsheet/CSV test cases, QA conversational flow prompts) and runtime black-box behavioral testing.
12. **Game Cycle & 3-Layer Modeling Separation (Room-Door-Furniture Rule):**
   - **No Dependency Cycles**: Never use `Depends_On` or progress `Transition` for backward/return navigation. Always use `type: "Return"` (Propagation Weight = 0) to prevent circular blocking deadlocks.
   - **3-Layer Verification Separation**: Strictly maintain Node (Context/Screen/Modal), Edge (Action/Transition Trigger), and Checklist (Static UI/Text/Dimmed Specs). Never nest sub-components beyond Max Depth = 1.
   - **Batch Regression via Tagging**: For fragmented, heterogeneous components (e.g. popups with inconsistent Dimmed behaviors), verify specs via node-internal checklists and batch-audit via `#Popup` tags and Focus+Context filtering.
13. **Change Impact Ripple Highlight (Future Work Specification):**
   - When a feature/node is modified (`properties.is_modified: true`), highlight it with `.node-modified-pulse` and mark downstream dependents with `.highlight-affected`.
   - The effect persists until the tester verifies and acknowledges (`is_modified: false`) in the Inspector panel (see `AI_IMPLEMENTATION_SPEC.md` Section 4.4 & `docs/TESTCASE_MODELING_AND_STATE_PROPAGATION.md` Section 7).

## 3-Tier Verification Pipeline
Before concluding any task, the AI agent MUST execute:
1. **Tier 1 (Static Policy Checker):** `python scripts/check_policy.py` (Must exit with code 0).
2. **Tier 2 (Automated Tests):** `cd backend; uv run pytest -q` (must pass) and `cd e2e-tests; npm test` (0 failed; every `test.skip`/`test.fixme` needs a `// SKIP-REASON:` comment on the line above, enforced by Tier 1). Reports must quote the actual passed/failed/skipped numbers.
3. **Tier 3 (Human Signoff Checklist):** Verify against the 10-point checklist in `AI_IMPLEMENTATION_SPEC.md`.

## Running the Project
1. **Database:** Run `run_db.bat` (auto-detects local Neo4j in PATH/drives or saves custom path) or `docker compose up -d neo4j`.
2. **Backend:** `cd backend && uv run uvicorn main:app --reload --port 8190`
3. **Frontend:** `cd frontend && npm run dev`
4. **MCP Server:** `cd mcp_server && uv run python server.py`
