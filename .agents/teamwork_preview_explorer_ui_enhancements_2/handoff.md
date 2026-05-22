# Handoff Report: React Flow UI Enhancements

## 1. Observation
- **Focus+Context & CSS**:
  - frontend/src/index.css applies dimming via .react-flow.has-selection .react-flow__node:not(.selected) { opacity: 0.2; }
  - frontend/src/App.tsx has a maxDepth state used currently for backend fetching (/api/graph?max_depth=...)
  - onSelectionChange currently sets hasSelection and selectedNode. React Flow natively applies the .selected class ONLY to the explicitly clicked node. Neighbors are not styled.
- **Connection Mechanism**:
  - App.tsx and layout.ts use default React Flow nodes which come with small, fixed-size dot handles (using .react-flow__handle).
  - No custom Node or Edge types are currently defined in App.tsx.

## 2. Logic Chain
1. **Focus+Context & Directional Colors (Milestones 1 & 2)**:
   - To highlight neighbors up to maxDepth, we must compute reachable nodes on the frontend when selectedNode changes.
   - We can add a useMemo in App.tsx that traverses the edges array starting from selectedNode.id, performing a BFS up to maxDepth for both incoming and outgoing directions.
   - This useMemo will return derived styledNodes and styledEdges arrays, injecting custom classes (highlight-incoming, highlight-outgoing, highlight-edge) into their .className property.
   - index.css must be updated to exempt these new classes from the opacity: 0.2 rule and to apply distinct directional styling (e.g., orange/blue borders).
   - I have created css_policy.md in the root outlining these classes.
2. **Connection Mechanism (Milestone 3)**:
   - Creating full Floating Edges requires complex mathematical intersection logic and custom Node/Edge components, which is heavy for this scope.
   - A simpler, robust "full-boundary" approach is to use CSS to expand the default handles.
   - By styling .react-flow__handle-top and .react-flow__handle-bottom to have width: 100%, height: 10px, opacity: 0, and border-radius: 0, the entire top and bottom edges of every node become connectable drop targets. This allows easy multiple connections without interfering with dragging the center of the node.
   - Adding connectionMode={ConnectionMode.Loose} to <ReactFlow> allows any handle to connect to any other, improving connection flexibility.

## 3. Caveats
- Passing derived styledNodes to <ReactFlow> effectively replaces the nodes array during render. React Flow's useNodesState and onNodesChange will still function correctly with the underlying nodes state, but the logic must append to existing n.className to avoid wiping out base classes.
- Expanding handles to 100% width via CSS leaves the vertical center of the node for dragging. If users need to drag the node from the very top or bottom edge, they will trigger a connection instead. This is standard and acceptable behavior for full-boundary handles.

## 4. Conclusion
- The UI enhancements can be fully implemented by updating frontend/src/App.tsx (BFS traversal logic and ConnectionMode.Loose) and frontend/src/index.css (custom highlight colors, dimming logic fix, and handle expansion).
- css_policy.md has been created in the root directory.
- The implementer agent can safely proceed with these targeted changes.

## 5. Verification Method
- Make the changes in App.tsx and index.css.
- Run the frontend (cd frontend && npm run dev).
- Select a node in the UI and verify that upstream and downstream neighbors up to maxDepth are highlighted with distinct colors, and path edges remain opaque, while unrelated nodes/edges are dimmed to 0.2 opacity.
- Attempt to connect two nodes by dragging from their full top/bottom boundaries and confirm the connection works seamlessly.
