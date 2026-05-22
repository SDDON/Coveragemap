# Handoff Report

## 1. Observation
- Inspected `frontend/src/CoverageNode.tsx`. Both Target (`Position.Top`) and Source (`Position.Bottom`) `<Handle>` components have inline `style` objects defining `width: '100%'`, `height: '10px'`, `left: 0`, and `top: 0` / `bottom: 0`.
- The `<Handle>` components do not currently specify a `transform` property in their inline styles.
- Checked `frontend/src/index.css` and found no custom CSS overrides for `.react-flow__handle`.
- React Flow's default CSS for `.react-flow__handle` applies `transform: translate(-50%, -50%)`. Since the handle width is 100%, this shifts the handle left by 50% of the node's width, as reported in the background.

## 2. Logic Chain
1. React Flow's default styling centers a handle horizontally using `left: 50%` and `transform: translate(-50%, -50%)`.
2. The current `left: 0` inline style in `CoverageNode.tsx` successfully overrides `left: 50%`. However, the inline style does not override the `transform` property.
3. Consequently, the default `transform: translate(-50%, -50%)` remains active. For a handle with `width: 100%`, this pushes it leftward by half of the node's width (the `-50%` horizontal translation) and upward by half its own height.
4. By appending `transform: 'none'` (or `transform: 'translate(0, 0)'`) to the `style` prop of both `<Handle>` components, we will explicitly neutralize the default CSS transform.
5. This ensures the 100%-width handle originates exactly at the node's left edge (`left: 0`) without shifting sideways, while remaining neatly within the top/bottom boundary.

## 3. Caveats
- Using `transform: 'none'` removes both the horizontal AND vertical translation. The `-50%` vertical shift normally centers handles exactly on the node edge. Without it, the 10px handle will sit entirely *inside* the node at the top (`top: 0`) and bottom (`bottom: 0`). Since `opacity: 0` is applied, this visually changes nothing for the user but provides a clean 10px internal hit area, which perfectly satisfies the requirement.

## 4. Conclusion
The root cause of the leftward shift is the inherited `transform: translate(-50%, -50%)` from React Flow's default `.react-flow__handle` CSS class. The fix strategy is for the Worker to add `transform: 'none'` to the inline `style` prop of both the `target` and `source` `<Handle>` components in `frontend/src/CoverageNode.tsx`.

### Proposed Fix for Worker
In `frontend/src/CoverageNode.tsx`, modify the `style` objects to include `transform: 'none'`:

```tsx
<Handle
  type="target"
  position={Position.Top}
  style={{ width: '100%', height: '10px', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, top: 0, left: 0, transform: 'none' }}
/>
```

```tsx
<Handle
  type="source"
  position={Position.Bottom}
  style={{ width: '100%', height: '10px', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, bottom: 0, left: 0, transform: 'none' }}
/>
```

## 5. Verification Method
- After applying the change, run the frontend (`cd frontend && npm run dev`).
- Open the application and use the browser Developer Tools to inspect a node.
- Locate the `.react-flow__handle` elements and confirm their bounding boxes align perfectly with the left and right boundaries of the node (no horizontal overflow).
- Try to connect edges to verify the hit box functions as intended across the entire top/bottom 10px strip.
