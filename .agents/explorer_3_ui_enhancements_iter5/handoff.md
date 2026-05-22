# Handoff: React Flow Handle Position Fix

## 1. Observation
- The file rontend/src/CoverageNode.tsx defines two <Handle> components (Top and Bottom) for React Flow.
- Both handles use inline styles meant to create a 100% width, 10px high strip: style={{ width: '100%', height: '10px', position: 'absolute', left: 0, ... }}.
- React Flow applies a default CSS class .react-flow__handle which includes the rule 	ransform: translate(-50%, -50%).

## 2. Logic Chain
- The handles are configured to be 100% of the node's width and are positioned starting at the left edge (left: 0).
- The default 	ransform: translate(-50%, -50%) acts on the element's own dimensions. It shifts the handle to the left by 50% of its own width.
- Because the width is 100% of the node, a 50% shift to the left causes the handles to visually shift outside of the node by half the node's width.
- By injecting 	ransform: 'translate(0, 0)' or 	ransform: 'none' into the inline style prop of the handles, this default CSS rule is overridden. The inline style takes precedence, locking the handles to exactly match the left offset and 100% width, without shifting.

## 3. Caveats
- Using 	ransform: 'none' will disable all transformations (including the default -50% vertical shift). Since the top and bottom handles use 	op: 0 and ottom: 0 respectively, they will align precisely inside the top and bottom edges of the node as 10px tall strips, which fits the "top/bottom strips" requirement. 
- No caveats regarding other files; the change is isolated to CoverageNode.tsx.

## 4. Conclusion
- The root cause is the inheritance of the .react-flow__handle default 	ransform property.
- **Action for Worker:** Update the style prop in both <Handle> components in rontend/src/CoverageNode.tsx to include 	ransform: 'none' (or 	ransform: 'translate(0, 0)').
  
**Proposed Change for Worker (rontend/src/CoverageNode.tsx):**
`	sx
// For Top Handle
<Handle
  type="target"
  position={Position.Top}
  style={{ width: '100%', height: '10px', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, top: 0, left: 0, transform: 'none' }}
/>

// For Bottom Handle
<Handle
  type="source"
  position={Position.Bottom}
  style={{ width: '100%', height: '10px', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, bottom: 0, left: 0, transform: 'none' }}
/>
`

## 5. Verification Method
- **Code Inspection:** Verify that 	ransform: 'none' exists in the style prop of both handles in rontend/src/CoverageNode.tsx.
- **Visual/Manual Test:** Start the frontend (cd frontend && npm run dev), select a node, and verify that edge connections (handles) correctly snap to the top/bottom edges over the full width of the node without being shifted to the left.
- **DOM Inspection:** Use browser DevTools to ensure the .react-flow__handle div's bounding box aligns exactly with the parent node's width.
