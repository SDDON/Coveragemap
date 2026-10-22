# CSS Policy for CoverageMap

## Focus+Context Architecture (Pure CSS, Zero Inline Opacity)
- When a node or edge is selected, the ReactFlow container gets the `.has-selection` class.
- Nodes and edges that are part of the active selection context receive the `.active` class (Clean Light Theme blue focus ring `#2563eb`).
- The dimming of unrelated elements is handled entirely by CSS rules (`.has-selection .react-flow__node:not(.active)`, `.react-flow__node.de-emphasized`, and `.has-selection .react-flow__edge:not(.active)`).
- We NEVER inject inline `style={{ opacity }}` or `filter` calculations in TSX components.

## Directional, Status & Impact Highlights
- **Directional**:
  - Incoming neighbor nodes receive `.highlight-incoming` (Blue border `#3b82f6`).
  - Outgoing neighbor nodes receive `.highlight-outgoing` (Amber/Orange border `#f59e0b`).
  - Active edges receive `.highlight-edge` for thicker strokes, while `Contains`/`Has` subflow edges receive `.edge-contains` (dashed slate stroke `#94a3b8`).
- **4-Stage Test Status**:
  - `.status-untested` (`#64748b`), `.status-passed` (`#22c55e`), `.status-failed` (`#ef4444`), `.status-blocked` (`#f59e0b`).
- **Root Cause & Impact Propagation**:
  - `.highlight-root-cause`: Red pulsing border along the upstream failure path.
  - `.node-modified-pulse` & `.highlight-affected`: Violet pulsing border (`#8b5cf6`) for spec-modified nodes and their 1–2 hop downstream scope (including rollup to collapsed parent `Screen` nodes with `.parent-collapse-impact-summary`).
  - `.impact-highlighted` & `.impact-source`: Global badge impact overlay highlights (including rollup to collapsed parent `Screen` nodes).

