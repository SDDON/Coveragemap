# Synthesis: Core Visualization (Milestone 2)

## Consensus & Plan
The backend data is ready at `GET /api/graph` returning `nodes` and `edges`. Since spatial coordinates (`x`, `y`) are missing, we must use an auto-layout library like `dagre` alongside React Flow.
For Focus+Context, we will use React Flow's native `.selected` class and CSS for the dimming effect.

## Worker Tasks:
1. **Initialize Frontend:**
   - Run `npm create vite@latest frontend -- --template react-ts` in `d:\personal\living_graph_tc`.
   - `cd frontend && npm install reactflow dagre`
   - Modify `package.json` scripts if needed or just use default.
2. **Implement API Fetch & Data Mapping:**
   - Fetch `http://localhost:8000/api/graph` in `App.tsx` or a custom hook.
   - Transform nodes to React Flow format. Add edge IDs (`${source}-${target}-${type}`).
3. **Auto-Layout with dagre:**
   - Implement a utility function to apply `dagre` layout so nodes are positioned meaningfully.
4. **Focus+Context Visualization:**
   - Track selection state (`onSelectionChange` or similar).
   - Add `.has-selection` class to the container when a node/edge is selected.
   - Add CSS to set opacity to 0.2 for `.react-flow__node:not(.selected)` and `.react-flow__edge:not(.selected)` when under `.has-selection`.
5. **Verification:**
   - Build the app `npm run build` to ensure compilation.
   - (Optional but recommended) Run unit tests if any exist.

*Note on CORS:* Make sure the FastAPI backend allows CORS from the frontend dev server (`http://localhost:5173`). Check `backend/main.py`.

*Note on package names:* `reactflow` is now `@xyflow/react` in v12, but `reactflow` v11 might be installed. Ensure you use the correct imports (e.g. `import { ReactFlow } from 'reactflow'` or `@xyflow/react`).
