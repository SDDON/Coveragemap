# CSS Policy for CoverageMap

## Focus+Context Architecture
- When a node or edge is selected, the ReactFlow container gets the .has-selection class.
- Nodes and edges that are part of the active selection context receive the .active class.
- The dimming of unrelated elements is handled entirely by CSS:
  .has-selection .react-flow__node:not(.active) and .has-selection .react-flow__edge:not(.active).
- We NEVER apply .de-emphasized manually in code.

## Directional Highlights
- Nodes connected by incoming edges to the active selection receive .highlight-incoming (Blue border).
- Nodes connected by outgoing edges from the active selection receive .highlight-outgoing (Orange border).
- Cross-edges between any two .active nodes receive .highlight-edge for thicker strokes.
