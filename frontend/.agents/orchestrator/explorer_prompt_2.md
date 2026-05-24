# Iteration 2: Fix Bugs Found by Challenger

Please analyze the frontend codebase (`App.tsx`) to fix the following issues found during the previous iteration's review:
1. R2 Failure: In `App.tsx`, `handleSave` hardcodes `properties: {}` in the payload, destroying the `is_global` property when a user tries to convert an existing node into a badge or save it.
2. R3 Failure: In `App.tsx`, `onConnect` appends newly created edges without specifying `type: 'floating'`. This bypasses `FloatingEdge.tsx` and ignores the deduplication `pathOffset`, causing new edges to visually overlap.

Write your findings and fix strategy to `e:\Workspace\coveragemap\frontend\.agents\orchestrator\PROJECT.md` (append or update) and hand off the detailed implementation plan for the Worker.
