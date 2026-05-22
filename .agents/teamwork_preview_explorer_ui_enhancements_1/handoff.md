# Handoff Report: React Flow UI Enhancements

## 1. Observation
- **State & Graph Data**: rontend/src/App.tsx manages 
odes and edges via @xyflow/react hooks. The backend API handles max_depth filtering, returning a restricted subgraph.
- **Focus+Context**: Currently implemented purely in rontend/src/index.css using:
  .react-flow.has-selection .react-flow__node:not(.selected) { opacity: 0.2; }
  This correctly dims unselected elements but fails to highlight neighbors, violating the requirement.
- **Node Connections**: App.tsx uses default nodes. Connection handles are small default circles placed at Top and Bottom (set by layout.ts).
- **Styles**: No directional styles (incoming vs outgoing) exist. No css_policy.md exists.

## 2. Logic Chain
- **Focus+Context Fix & Directional Colors**: 
  - To highlight neighbors up to maxDepth with directional colors, the frontend must dynamically compute them based on the current selectedNode.
  - A client-side Breadth-First Search (BFS) should run when selectedNode or maxDepth changes.
  - The BFS will trace *incoming* edges (target == current node) and *outgoing* edges (source == current node) up to maxDepth.
  - The calculated sets will be used to assign specific classes (e.g., .highlight-incoming, .highlight-outgoing) to the className of the 
odes and edges state arrays.
  - index.css must be updated to apply distinct colors to these classes (e.g., blue for incoming, orange for outgoing) and exclude them from the .has-selection opacity dimming.
- **Connection Mechanism (Full-Boundary)**: 
  - Since React Flow uses default nodes, the easiest and most reliable way to achieve "full-boundary" connections without complex floating edge math is to implement a CustomNode.
  - This CustomNode will render the node label/status and include <Handle> components styled to cover the full width and height of the node (e.g., position: absolute; width: 100%; height: 100%; opacity: 0;). This allows users to start drawing edges from anywhere on the node's perimeter.

## 3. Caveats
- The client-side BFS will only traverse nodes and edges currently loaded in the frontend state. If the backend maxDepth or ilter excluded a node, it will naturally not appear or be highlighted.
- When updating node className in React, ensure it preserves the core .selected class managed by React Flow to avoid breaking native selection behavior.
- Invisible handles covering 100% of the node might interfere with node dragging. Ensure the handles only cover the border area, or test React Flow's dragHandle prop if node dragging becomes unresponsive.

## 4. Conclusion
To implement the UI enhancements, the implementer should:
1. **Create css_policy.md**: Define the standard colors for incoming (e.g., blue), outgoing (e.g., orange), and both (e.g., purple).
2. **Update rontend/src/index.css**: Add styles for .highlight-incoming and .highlight-outgoing. Modify .has-selection rules to prevent dimming of these classes.
3. **Implement Client BFS in App.tsx**: Add a useEffect hook that performs a bidirectional BFS from selectedNode up to maxDepth. Update the className of 
odes and edges based on the BFS results.
4. **Create rontend/src/CustomNode.tsx**: Build a custom node with "full-boundary" handles (invisible handles wrapping the border) and register it in App.tsx via the 
odeTypes prop.

## 5. Verification Method
- Run the frontend (cd frontend && npm run dev) and backend (cd backend && uv run uvicorn main:app).
- Create a linear chain of 5 nodes: A -> B -> C -> D -> E.
- Select node C with maxDepth = 1. Verify B is highlighted as incoming, D as outgoing, and A/E are dimmed (opacity 0.2).
- Change maxDepth = 2. Verify A and B are incoming, D and E are outgoing.
- Attempt to connect two nodes by dragging from the edge/border of a node rather than a tiny center dot. Verify the connection succeeds.
- Check that css_policy.md exists in the root directory.
