# Handoff Report: Milestone 2 Core Visualization Strategy

## 1. Observation
- `PROJECT.md` specifies Milestone 2 encompasses: React App Setup in `/frontend`, React Flow setup, API fetch, and Focus+Context feature.
- The `d:\personal\living_graph_tc\frontend` directory does not currently exist.
- The backend `GET /api/graph` endpoint (found in `backend/main.py`) returns a graph structure adhering to `GraphResponse` in `backend/models.py`. 
- The data contract is:
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
    "debounce_id": "str"
  }
  ```
- The backend does NOT provide layout coordinates (x, y) for nodes. 

## 2. Logic Chain
- Since the `/frontend` folder is missing, we must scaffold it using `npm create vite@latest frontend -- --template react-ts`.
- The data fetched from the API needs to be adapted to React Flow's `Node` and `Edge` types.
  - React Flow nodes require an `id`, `position`, and `data` (which will contain the `name` and `aliases`).
  - React Flow edges require an `id` (can be generated as `source-target`), `source`, and `target`.
- Because nodes lack coordinates, a layout engine like `dagre` is highly recommended to position nodes automatically and prevent them from piling at `(0,0)`.
- For the Focus+Context logic:
  - We can maintain a `focusedNodeId` state in the React component.
  - When a node is clicked (`onNodeClick`), we identify its connected nodes by traversing the edge list.
  - We apply a specific CSS class (e.g., `.dimmed { opacity: 0.2; }`) to all nodes and edges that are not part of the active cluster (the clicked node and its immediate neighbors).

## 3. Caveats
- No complex layout requirements were provided, so a simple top-to-bottom or left-to-right `dagre` layout is assumed to be sufficient for MVP.
- If the graph size grows large (1000+ nodes), client-side layout calculation and dynamic styling might have performance impacts. The current backend implementation has a `max_depth` parameter, which helps keep graph size manageable.
- Focus+Context logic as proposed only highlights immediate neighbors (distance=1). If multi-hop highlighting is required later, the adjacency traversal logic will need to be recursive.

## 4. Conclusion
**Recommended Step-by-Step Implementation Strategy:**

1. **Scaffolding:**
   - Run `npm create vite@latest frontend -- --template react-ts` from `d:\personal\living_graph_tc`.
   - `cd frontend` and run `npm install` then `npm install reactflow dagre`.

2. **API Integration & Data Mapping:**
   - In `App.tsx` (or a dedicated component), add a `useEffect` to `fetch('http://localhost:8000/api/graph')`.
   - Map backend nodes to React Flow nodes: `{ id: n.id, data: { label: n.name }, position: { x: 0, y: 0 } }`.
   - Map backend edges to React Flow edges: `{ id: \`e-${e.source}-${e.target}\`, source: e.source, target: e.target, label: e.type }`.

3. **Layouting:**
   - Use `dagre` to compute the actual `position.x` and `position.y` for each node based on the edges, before passing them to the React Flow `<ReactFlow />` component.

4. **Focus+Context Implementation:**
   - Create state: `const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);`
   - Create an `onNodeClick` handler that sets the clicked node's ID.
   - Create an `onPaneClick` handler to reset it to `null`.
   - Use a `useMemo` hook to compute the styled nodes and edges based on `focusedNodeId`.
   - If `focusedNodeId` is set, iterate over edges to find neighbors. Any node/edge not in this active set gets a `.dimmed` class applied to its `className` property.

## 5. Verification Method
- **Scaffolding:** Verify `d:\personal\living_graph_tc\frontend\package.json` exists and includes `reactflow`.
- **API Fetch:** Run the frontend (`npm run dev`) and observe the network tab to ensure `/api/graph` is called and returns a 200 OK.
- **Rendering:** Open the frontend in a browser; nodes and edges should render as a graph without overlapping on a single point (proving `dagre` works).
- **Focus+Context:** Click a node. The clicked node and its immediate connected nodes (and the edges between them) should remain fully opaque, while all other nodes and edges visibly dim. Click the background pane to restore full opacity.
