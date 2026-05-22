# Progress

- [2026-05-22T00:55:49+09:00] Initialization. Started investigation on CoverageNode.tsx.
- [2026-05-22T00:58:00+09:00] Found root cause: React Flow's default .react-flow__handle applies transform: translate(-50%, -50%).
- [2026-05-22T01:00:00+09:00] Formulated fix: adding transform: 'none' or transform: 'translate(0, 0)' to Handle inline style.
- [2026-05-22T01:02:00+09:00] Writing handoff report.
