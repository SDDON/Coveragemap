# Handoff Report

## 1. Observation
- `App.tsx` had a bug where editing or saving node/edge statuses resulted in dropping `properties` because payloads defaulted to `{}` or didn't fetch them into `editFormData`.
- `App.tsx` had a bug in `handleUndo` for `DELETE_EDGE` where adding an edge back did not invoke `calculateEdgeBundling`, leading to overlapping edges.
- Inspected `App.tsx` using `view_file`.
- `onConnect` already contained `type: 'floating'` and `calculateEdgeBundling` inside it, likely fixed in a prior step but partially documented as needing a fix in `PROJECT.md`.
- Ran `npx tsc --noEmit` which completed with no errors.

## 2. Logic Chain
- To fix R2: updated the `setEditFormData` assignments in `useEffect` to include `properties: n.properties || {}`. Also replaced `existingProperties` references in `handleSave` and `handleSaveStatus` to correctly use `editFormData.properties || {}`.
- To fix R2 undo actions: replaced references with `(node.data as any)?.properties || {}` directly.
- To fix R3: Wrapped the `setEdges` state updater in `handleUndo` -> `DELETE_EDGE` branch with `calculateEdgeBundling(...)` to recalculate offsets when an edge is restored.

## 3. Caveats
- `onConnect` was already containing the requested updates for R3. No changes were made there to avoid redundancy.
- Did not test via Playwright since the environment wasn't fully mocked, but TypeScript compilation passes.

## 4. Conclusion
- Fixes for Iteration 2 (R2 properties preservation and R3 edge bundling on undo) are successfully implemented in `App.tsx`.
- The code now preserves node properties across state edits/saves, preventing global nodes from losing their `is_global` tag.

## 5. Verification Method
- Code compilation verified via `npx tsc --noEmit`.
- Run frontend (`npm run dev`) and manually test:
  1. Toggle node status on a node with `is_global=true` properties, and confirm the property is not lost.
  2. Create an overlapping edge, delete it, and use Ctrl+Z to undo. Confirm it routes with the proper `pathOffset` offset instead of overlapping exactly.
