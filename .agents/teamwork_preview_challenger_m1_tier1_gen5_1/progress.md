Last visited: 2026-05-20T12:07:05Z

Task: Empirically verify correctness and challenge assumptions for `tier1.spec.ts`.

Status: Completed.
- Found that `tier1.spec.ts` relies on hallucinated UI elements missing from `App.tsx` and endpoints missing from `main.py`.
- Identified multiple seed data topological assumptions that break test independence.
- Found state-bleeding due to the removed DB reset in `beforeEach` combined with DB-mutating tests.
- Identified flawed loading overlay test (expected to block clicks but overlay has `pointerEvents: 'none'`).
- Wrote findings to `handoff.md`.
