# Review Handoff: React Flow UI Enhancements

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Critical] Node Dragging Broken (Usability Regression)
- **What**: Nodes can no longer be dragged to reposition them.
- **Where**: frontend/src/CoverageNode.tsx
- **Why**: Both source and target <Handle> components are given width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1. Because they cover the entire node, they capture all pointer events (such as mousedown). React Flow's Handle internally calls stopPropagation() to initiate an edge connection, which completely disables the native node drag-to-move functionality.
- **Suggestion**: Do not overlap the entire node with Handles that block pointer events. If loose connection is desired, consider using standard handles or a dedicated dragHandle class on the node content to explicitly separate dragging nodes from drawing edges.

### [Critical] Edge Selection Dims Entire Graph
- **What**: Selecting an edge dims all nodes in the graph, leaving the selected edge pointing to invisible (dimmed) nodes.
- **Where**: frontend/src/App.tsx (onSelectionChange and useMemo) and frontend/src/index.css.
- **Why**: onSelectionChange sets hasSelection to true if *either* a node or an edge is selected. When only an edge is selected, selectedNode is null. The useMemo block then clears all .highlight-* classes from all nodes. Because hasSelection is true, the CSS rule .react-flow.has-selection .react-flow__node:not(.selected):not(.highlight-incoming):not(.highlight-outgoing) applies to ALL nodes (since none have .selected), reducing their opacity to 0.2.
- **Suggestion**: When an edge is selected, you should either keep its source/target nodes fully visible (by adding a highlight class to them) OR exclude edge-only selection from setting hasSelection = true.

### [High] E2E Test Suite Failure
- **What**: Playwright E2E tests are failing universally with timeouts on node clicks.
- **Where**: npm install && npx playwright test in e2e-tests.
- **Why**: The changes to CoverageNode.tsx (the overlapping invisible handles) likely prevent Playwright from correctly locating and clicking the underlying node element, resulting in element is outside of the viewport timeouts.
- **Suggestion**: Ensure that UI changes do not break the existing testing harness. Run npx playwright test locally to verify before handoff.

## Verified Claims
- BFS logic for maxDepth traversal -> conceptually verified via code review, though it recalculates purely on selectedNode and ignores selectedEdge.
- Custom CSS applied -> verified via code review in index.css.

## Unverified Items
- NetworkX backend filtering was not touched; the scope currently implements client-side BFS. No backend logic was reviewed.
