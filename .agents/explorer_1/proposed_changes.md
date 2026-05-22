# Proposed Changes for Implementer

## 1. frontend/src/App.tsx

**Step A: Import and Register Node**
`	sx
import CoverageNode from './CoverageNode';
const nodeTypes = { coverage: CoverageNode };
`

**Step B: Assign Node Type**
`	sx
const initialNodes: Node[] = data.nodes.map((n: ApiNode) => ({
  id: n.id,
  type: 'coverage', // <-- ADD THIS
`

**Step C: Fix Edge Highlighting Logic**
`	sx
// Populate after BFS
edges.forEach(e => {
  if (activeNodes.has(e.source) && activeNodes.has(e.target)) {
    edgeHighlights.add(e.id);
  }
});
`

**Step D: Refactor CSS Architecture**
Remove .de-emphasized appending from both styledNodes and styledEdges inside App.tsx.

**Step E: Add Container Class**
`	sx
<ReactFlow
  className={(selectedNode || selectedEdge) ? 'has-selection' : ''}
  nodeTypes={nodeTypes}
`

## 2. frontend/src/index.css

**Step F: Replace CSS rules**
Replace .react-flow__node.de-emphasized with:
`css
.has-selection .react-flow__node:not(.active),
.has-selection .react-flow__edge:not(.active) {
  opacity: 0.2;
}
`
