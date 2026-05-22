# Synthesis Report: React Flow UI Enhancements

## 1. Focus+Context & Directional Colors
**Consensus**: All explorers agree that a client-side BFS traversal is required when selectedNode changes. The current CSS-only .has-selection approach cannot highlight neighbors correctly.
**Implementation Strategy**:
- Use a useMemo hook in rontend/src/App.tsx that computes derived styledNodes and styledEdges based on the base 
odes and edges state.
- When selectedNode is set, perform a BFS (both incoming and outgoing directions) up to maxDepth.
- Map over 
odes and edges to inject custom classes into their .className property (e.g., highlight-incoming, highlight-outgoing, highlight-edge).
- Pass these derived styledNodes and styledEdges to the <ReactFlow> component.
- **index.css changes**: Update the .has-selection rule to dim nodes/edges ONLY if they don't have the new highlight classes. Add distinct directional styling for incoming and outgoing nodes/edges.

## 2. Connection Mechanism
**Consensus**: The default dot handles are too small. We need full-boundary handles.
**Resolved Conflict**: Agent 2 suggested a pure CSS hack on default handles, while Agents 1 & 3 recommended a CustomNode.tsx. The CustomNode.tsx approach is more idiomatic for React Flow and less prone to CSS side-effects.
**Implementation Strategy**:
- Create rontend/src/CoverageNode.tsx (a custom node component).
- Inside CoverageNode, render the node data (respecting the existing status background colors) and include <Handle> components positioned to cover the full width/height of the node boundaries (transparent, opacity 0, but clickable).
- Register 
odeTypes in App.tsx and map incoming backend nodes to use 	ype: 'coverage'.
- Set connectionMode={ConnectionMode.Loose} on the <ReactFlow> component to allow connecting any handle to any handle.

## 3. css_policy.md
- Create css_policy.md at the project root documenting the chosen color scheme for incoming vs outgoing connections, and standardizing the CSS classes.

