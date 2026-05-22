# Handoff Report: UI Enhancements Stress Test

## 1. Observation
- In rontend/src/CoverageNode.tsx, both 	arget and source handles are given full boundary styles: style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 1, opacity: 0, top: 0, left: 0 }}.
- Playwright stress test (e2e-tests/tests/focus_test.spec.ts) clicks the center of a node to trigger Focus+Context. The .react-flow container class remains "react-flow light" without the expected "has-selection" class.
- Playwright stress test (e2e-tests/tests/handle_test.spec.ts) drags from the center of node1 to the center of node2 to trigger an edge creation. The test outputs Edges: 0 -> 0, indicating the connection was rejected by the UI.

## 2. Logic Chain
- The 	arget and source handles are both rendered with 100% width/height and zIndex: 1. Because the source handle is defined last in the component, it renders on top, overlaying both the node body and the 	arget handle.
- React Flow's Handle component intercepts pointer events to handle drag-and-drop connections. 
- When a user clicks the node body, the click event is captured entirely by the source handle overlay. React Flow explicitly ignores clicks on handles for node selection, meaning the node can never become .active. This entirely breaks the Focus+Context and Directional Color features, as no node can be selected.
- When a user attempts to connect two nodes, dragging starts successfully from the top source handle. However, when dropping onto the second node, the drop event is caught by the second node's source handle (which overlays its 	arget handle). Since React Flow requires a connection to be dropped onto a 	arget handle, the connection is rejected.

## 3. Caveats
- Tested using precise coordinate drags via Playwright bounding boxes. Real users might click slightly outside the padding depending on the CSS box model, but since handles use bsolute and 100%, they truly cover the entire clickable node footprint.
- Focus+Context dimming logic (.has-selection) and Directional Colors (.highlight-incoming) might be logically correct in App.tsx, but they are effectively untestable via standard UI interactions due to this architectural flaw.

## 4. Conclusion
- **CRITICAL FAILURE**: The implementation of "full-boundary edges" in CoverageNode.tsx severely breaks core UI interactivity. Nodes can no longer be selected (breaking Focus+Context), and new edges can no longer be created (breaking the Connection Mechanism).

## 5. Verification Method
1. Run 
px playwright test tests/focus_test.spec.ts inside the e2e-tests directory to verify node selection failure.
2. Run 
px playwright test tests/handle_test.spec.ts inside the e2e-tests directory to verify edge creation failure.
3. Manually open http://localhost:5173, create two nodes, and attempt to connect them by dragging or click a node to highlight it. Both actions will fail.
