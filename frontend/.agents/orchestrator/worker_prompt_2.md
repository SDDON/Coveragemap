# Iteration 2: Implement Fixes for R2 and R3 Bugs

Please implement the fixes for `e:\Workspace\coveragemap\frontend\src\App.tsx` based on the newly updated `e:\Workspace\coveragemap\frontend\.agents\orchestrator\PROJECT.md`.

Fix requirements:
1. Fix the R2 bug: Search `App.tsx` for all hardcoded `properties: {}` instances (in `handleSave`, `handleSaveStatus`, `pushUndo` snapshots, `onConnect` payloads). Replace them so that existing properties are preserved (e.g., `properties: node.data.properties || {}` or spreading previous data).
2. Fix the R3 bug: Update `onConnect` to include `type: 'floating'` in the new edge. Also ensure that `calculateEdgeBundling` (or equivalent bundling logic) is called on the new edge list before setting `setEdges`, so `pathOffset` is correctly computed for deduplication.

Use `multi_replace_file_content` carefully.
Make sure the app builds/compiles without TS errors after your changes.
When done, report back with your findings and any verification you performed.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
