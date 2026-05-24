# Handoff: Iteration 2 Bug Investigation

## 1. Observation
- `App.tsx` contains 12+ instances of hardcoded `properties: {}`.
- When a user clicks a node or edge, `setEditFormData` in `useEffect` (lines 408-420) initializes `editFormData` but omits the `properties` field.
- In `handleSave` and `handleSaveStatus`, the payload explicitly uses `properties: {}`, which wipes out existing properties on the node (such as `is_global` which is toggled via `editFormData.properties.is_global`).
- In `onConnect` (line 512+), `setEdges` creates a new edge object but omits `type: 'floating'`. Furthermore, the returned array `nextEds` is passed directly without calling `calculateEdgeBundling`, resulting in an edge without `pathOffset`.

## 2. Logic Chain
- Because `editFormData` does not initialize `properties`, any existing `properties` (like `is_global`) is lost unless the user explicitly interacts with the global checkbox.
- Because `handleSave` and `pushUndo` hardcode `properties: {}`, any backend update strictly overwrites and erases the properties, causing R2 failures.
- Because `onConnect` fails to add `type: 'floating'` and fails to wrap the new edge list with `calculateEdgeBundling()`, new edges do not render via `FloatingEdge.tsx` and lack `pathOffset`, leading to overlapping edges (R3 failure).

## 3. Caveats
- `calculateEdgeBundling` uses `edge.source` and `edge.target`. We assume all new edges in `onConnect` and `handleUndo` provide valid `source` and `target` properties (which they do).
- Replacing `properties: {}` should be done carefully to ensure it falls back to `{}` if neither `editFormData.properties` nor the original node/edge properties exist.

## 4. Conclusion
- **R2 Fix:** Add `properties: n.properties || {}` and `properties: e.properties || {}` to `setEditFormData`. Replace all instances of `properties: {}` in `handleSave`, `handleSaveStatus`, and `pushUndo` with the preserved properties object.
- **R3 Fix:** In `onConnect` and `handleUndo` (for `DELETE_EDGE`), add `type: 'floating'` and return `calculateEdgeBundling(nextEds)` so newly created edges receive their `pathOffset`.

## 5. Verification Method
- Code Review: Ensure no `properties: {}` remains in `App.tsx` logic flows for updating nodes/edges.
- App Testing: Select a node, check the 'Global' badge box, save, and ensure the node changes to a badge. 
- App Testing: Drag an edge between two nodes. It should not overlap with existing edges and should render with the correct floating edge style.
