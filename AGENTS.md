# AI Development & Architecture Guide for 'CoverageMap'

## Project Context
This project is a 'Living Document Platform' aimed at visualizing the non-linear structure of mobile game QA processes. It replaces traditional linear spreadsheets with an interactive graph-based testing coverage tool (CoverageMap).

## Tech Stack
- **Data Layer:** Neo4j (Graph Database). Supports both Docker (WSL) and native Windows binary environments.
- **Backend:** Python (FastAPI), NetworkX (for graph filtering/processing), `uv` (for package management).
- **Frontend:** React, React Flow (for interactive graph UI), Vite, TypeScript.
- **E2E Testing:** Playwright (TypeScript).

## Core Requirements & Conventions
1. **Neo4j Dual Environment Support:** The backend connects to Neo4j using environment variables (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`) via `python-dotenv` to easily switch between Docker and local Windows binary setups.
2. **Living TC (Test Coverage):** Nodes and Edges have a `status` property (`Untested`, `Passed`, `Failed`) which visually updates the graph to indicate the scope of testing.
3. **Alias Normalization:** Graph nodes have an `aliases` array. The backend forces alias normalization to prevent tag fragmentation. The frontend provides a dropdown (`<datalist>`) for selecting tags to enforce this consistency.
4. **Focus+Context Visualization:** Clicking a node (Focus) dims the surrounding unrelated nodes (Context) using a CSS `.has-selection` class rather than completely deleting them from the DOM.
5. **Debounced Config Panel:** Changes to `max_depth` or node filters trigger a debounced backend request for NetworkX subgraph recomputation. A loading overlay prevents race conditions during this fetch.
6. **Optimistic Updates & Edge Status:** Graph mutations (like Pass/Fail badges, or disconnecting nodes) should immediately update the local React state (`setNodes`, `setEdges`) rather than triggering a full re-fetch, to prevent layout jumping and losing focus.
8. **UI/UX Policy Hook:** Whenever you (the AI Agent) modify UI-related files (e.g., `index.css`, `CoverageNode.tsx`), you MUST execute the `ui-ux-policy-checker` skill or manually verify compliance against `UI_UX_DESIGN_SYSTEM.md` before concluding your task.

## Running the Project
1. **Database:** Run `run_db.bat` to start the local Neo4j Community Edition (located at `E:\neo4j-community-2026.02.2`).
2. **Backend:** `cd backend && uv run uvicorn main:app --reload --port 8190`
3. **Frontend:** `cd frontend && npm run dev`

*Note to Future AI Agents: Please maintain the separation of concerns between NetworkX (graph logical filtering) and Neo4j (data storage), and respect the existing `App.tsx` interactive CRUD architecture.*
