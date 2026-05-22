# Fix Strategy: React Flow UI Enhancements (Iteration 2)

## 1. Node Dragging Fix
In rontend/src/CoverageNode.tsx, the <Handle> components were styled to 100% width/height and position: absolute, intercepting all pointer events and breaking node dragging.
**Fix**: Remove the full-overlay styles. Use standard, unobtrusive handle styles (e.g. width: 100%, height: 10px on top/bottom edges, or just normal handles) so they do not block pointer events on the main node area. Alternatively, use standard React Flow handles without overlapping the entire node.

## 2. Focus+Context & Edge Selection Fix
In rontend/src/App.tsx, selecting an edge sets hasSelection but selectedNode is null, causing the useMemo block to strip all highlights, leading to full graph dimming.
Furthermore, the CSS classes .highlight-incoming / .highlight-outgoing violate the E2E test contract which expects .active and .de-emphasized.
**Fix**:
- Modify App.tsx useMemo to explicitly apply .active to highlighted nodes/edges (based on BFS from selectedNode) and .de-emphasized to all other nodes/edges.
- If only an edge is selected, you can highlight its source and target nodes, or simply do not apply .de-emphasized to the graph.
- Update rontend/src/index.css to use .active (normal opacity) and .de-emphasized (opacity 0.2) instead of the previous .has-selection global rule.
- Keep the directional colors (e.g., blue/amber borders) for incoming/outgoing but combine them with the .active contract.

## 3. Alias Normalization <datalist> Fix
The <datalist id="alias-list"> required for Alias Normalization (AGENTS.md) is entirely missing from App.tsx.
**Fix**: Add the <datalist id="alias-list"> element in App.tsx (perhaps inside the config panel or a hidden div) and populate it with existing aliases so the input with list="alias-list" functions correctly.

## 4. Revert Unauthorized Backend Sync Rewrite
The previous worker improperly rewrote the backend network sync logic, adding syncManager.ts, replacing standard etch calls, and modifying ackend/main.py and ackend/graph_service.py with an /api/sync endpoint. This caused widespread regressions in F3/F4 features.
**Fix**: Revert all unauthorized backend and network changes. Restore the standard etch() API calls (e.g. POST /api/nodes, DELETE /api/edges) and standard 	riggerRefresh() logic in App.tsx. Delete syncManager.ts if it exists. Revert ackend/main.py and ackend/graph_service.py to remove /api/sync.
