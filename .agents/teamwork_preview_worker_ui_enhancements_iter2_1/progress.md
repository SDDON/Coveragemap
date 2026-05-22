# Progress Update - 2026-05-22

Last visited: 2026-05-22T00:06:00Z

- Fixed Node Dragging issue in CoverageNode.tsx by adjusting handle sizes and z-index so they don't block pointer events.
- Reverted unauthorized backend sync rewrite by restoring original main.py, graph_service.py, models.py, and removing syncManager.ts.
- Patched App.tsx to use proper Focus+Context highlighting rules based on BFS.
- Updated index.css to use .active and .de-emphasized classes.
- Added <datalist id="alias-list"> to App.tsx for Alias Normalization.
- Removed duplicate/broken TS errors and successfully built the frontend.
- Added css_policy.md in root.
