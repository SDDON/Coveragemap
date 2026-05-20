# Handoff Report: Milestone 2 (Core Visualization) Analysis

## Observation
1. **Scope and Requirements:**
   - **Goal:** Set up Vite + React app in `/frontend`. Integrate React Flow to render the graph. Implement Focus+Context logic (dimming background nodes/edges when a node/edge is selected).
   - **Sources:** `PROJECT.md` (lines 15-22, 24-32), `.agents/sub_orch_m2_frontend/SCOPE.md` (lines 7-11).

2. **Backend Data Contract:**
   - **API Endpoint:** `GET /api/graph` (defined in `backend/main.py:24`).
   - **Response Structure (from `backend/models.py` and `backend/graph_service.py`):**
     ```json
     {
       "nodes": [
         {
           "id": "str",
           "label": "str",
           "name": "str",
           "aliases": ["str"],
           "properties": {}
         }
       ],
       "edges": [
         {
           "source": "str",
           "target": "str",
           "type": "str",
           "properties": {}
         }
       ],
       "debounce_id": "str|null"
     }
     ```
   - **Note:** The backend does **not** provide spatial coordinates (`x`, `y`) for nodes. Edges are directional (MultiDiGraph).

## Logic Chain
1. **Frontend Foundation:** We need a React app using Vite to host the frontend. We will need `reactflow` for graph rendering.
2. **Data Mapping:** Since React Flow requires a specific object format, we must transform the backend response:
   - Backend `NodeModel` -> React Flow node: `{ id, position: {x, y}, data: { label, name, aliases, properties } }`
   - Backend `EdgeModel` -> React Flow edge: `{ id, source, target, data: { type, properties } }`. (We must generate a unique `id` for edges, e.g., `${source}-${target}-${type}`).
3. **Layout Generation:** Because `GET /api/graph` does not supply `position`, nodes would pile up at `(0, 0)` if not positioned. We must use a layout algorithm. `dagre` is a standard, lightweight directed-graph layout engine that pairs perfectly with React Flow.
4. **Focus+Context Visualization:** React Flow automatically applies the `.selected` CSS class to the currently selected nodes and edges. We can achieve the dimming effect purely via CSS without complex React state recalculations:
   - Apply a dynamic class (e.g., `.has-selection`) to the React Flow container when any element is selected (tracked via `onSelectionChange`).
   - Use CSS rules to set `opacity: 0.2` on `.react-flow__node:not(.selected)` and `.react-flow__edge:not(.selected)` when `.has-selection` is present.

## Caveats
- **Layouting:** `dagre` is a static layout engine. If nodes are dynamically added or deleted in the future (Milestone 4), we might need to re-run the layout or allow manual positioning. For now, static layout on load is sufficient.
- **Edge Overlap:** Because the backend uses `MultiDiGraph`, there may be multiple edges between the same two nodes. React Flow's default edge types may overlap them. Custom edge routing or bezier curves may be needed if multiple edges exist.

## Conclusion
The backend is ready to supply standard graph data. The frontend needs to fetch this data, transform it into React Flow's structure, run a layout engine (like `dagre`) to position nodes, and implement a CSS-driven Focus+Context mechanic.

### Recommended Implementation Strategy:
1. **Scaffold Frontend:** 
   - `npm create vite@latest frontend -- --template react-ts`
   - `cd frontend && npm install reactflow dagre`
2. **API Integration:**
   - Fetch `/api/graph` in a `useEffect` hook.
   - Transform nodes and generate edge IDs.
3. **Auto-Layout:**
   - Create a layout utility using `dagre` to compute `x` and `y` for each node before passing them to the `<ReactFlow />` state.
4. **Focus+Context UI:**
   - Track selection state using React Flow's `onSelectionChange`.
   - Wrap `<ReactFlow />` in a container: `<div className={hasSelection ? 'has-selection' : ''}>`
   - Add CSS:
     ```css
     .has-selection .react-flow__node:not(.selected),
     .has-selection .react-flow__edge:not(.selected) {
       opacity: 0.2;
       transition: opacity 0.3s ease;
     }
     ```

## Verification Method
- **To test data fetch:** Start backend (`cd backend && uvicorn main:app --reload`), verify `curl http://localhost:8000/api/graph` returns the node/edge JSON.
- **To test layout:** Load the React app in browser, ensure nodes are not stacked on top of each other.
- **To test Focus+Context:** Click a node. The clicked node should remain fully opaque; all other nodes and edges should fade to 20% opacity. Click the canvas background to deselect and restore all to 100% opacity.
