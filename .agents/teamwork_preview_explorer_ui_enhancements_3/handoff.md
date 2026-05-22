# Handoff Report: React Flow UI Enhancements

## 1. Observation
- In frontend/src/App.tsx, onSelectionChange currently sets a global hasSelection boolean which applies .has-selection to the ReactFlow container.
- In frontend/src/index.css, .react-flow.has-selection .react-flow__node:not(.selected) receives opacity: 0.2. React Flow only adds the .selected class to the directly clicked node, causing all neighbors and edges to dim.
- Nodes are currently generated using the default node type (no nodeTypes defined in ReactFlow), with small default circular handles.
- Node styles (background color based on status) are directly injected via the style prop in the initialNodes mapping within App.tsx.
- The scope document (SCOPE.md) requires:
  1. Highlighting selected node + neighbors (up to maxDepth) + edges, while dimming the rest.
  2. Distinct colors for incoming vs outgoing neighbors and edges.
  3. Replacing tiny handles with full-boundary or floating edges.

## 2. Logic Chain
- Focus+Context & Directional Colors: To highlight neighbors selectively and distinguish between incoming/outgoing, we cannot rely solely on the default .selected class. We need to compute neighbor sets in App.tsx when a node is selected.
  - A useEffect hook listening to selectedNode.id should execute a BFS to find incoming and outgoing nodes up to maxDepth.
  - We can then iterate through setNodes and setEdges to assign specific custom classes (e.g., node-focus, node-incoming, node-outgoing, node-context-dimmed) based on this topology computation.
- Connection Mechanism: Default nodes don't easily support full-boundary handles without CSS hacks that might interfere with each other. Creating a Custom Node (e.g., CoverageNode.tsx) allows us to place invisible <Handle> elements that span 100% width/height of the node boundaries (e.g., a top handle covering the top edge, a bottom handle covering the bottom edge), making connections much easier to grab.
- CSS Policy: A css_policy.md file is needed to standardize these directional colors (e.g., Amber for incoming, Blue for outgoing) and handle styling. (Note: I have already created a draft of this policy at e:\Workspace\coveragemap\css_policy.md).

## 3. Caveats
- Modifying nodes and edges arrays to inject className inside a useEffect can cause infinite render loops if dependencies (like edges) trigger the effect again after setEdges is called. It is recommended to either:
  1. Track the topological highlight state in a separate React state object and apply classes dynamically in a custom node component.
  2. Or strictly gate the useEffect so it only updates setNodes/setEdges when selectedNode.id changes, not on every edge change.
- The maxDepth variable currently used for API fetching could be reused for this local UI traversal.

## 4. Conclusion
To implement the React Flow UI Enhancements, the implementer should:
1. Create frontend/src/CoverageNode.tsx: A custom node type with enlarged/full-width transparent <Handle> components to satisfy the connection mechanism requirement. Register this in App.tsx via the nodeTypes prop and map fetched nodes to type: 'coverage'.
2. Update frontend/src/App.tsx: Add a useEffect that listens for selection changes. When selectedNode is present, traverse the edges to find incoming/outgoing nodes up to maxDepth. Apply corresponding classes (node-incoming, node-outgoing, edge-incoming, etc.) to the nodes and edges.
3. Update frontend/src/index.css: Remove the old .has-selection logic and add styles for the new classes defined in css_policy.md.

## 5. Verification Method
- Run the frontend: cd frontend && npm run dev.
- Test Connections: Drag from the edges of any node (not just the tiny dots) to another node and verify an edge is created.
- Test Focus+Context: Click a node. Verify that the node itself has the focus highlight, incoming neighbors/edges have the Amber highlight, outgoing have the Blue highlight, and all other nodes/edges are dimmed (opacity 0.2).
- Test Max Depth: Change the maxDepth parameter and verify that the highlight traversal respects the specified depth.
