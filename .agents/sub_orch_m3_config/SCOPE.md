# Scope: Milestone 3 - Alias & Config Control

## Architecture
See `d:\personal\living_graph_tc\PROJECT.md`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 3.1 | Backend Alias Dictionary | Backend API to manage and normalize alias terms. | M2 | PLANNED |
| 3.2 | Config Panel | Frontend UI with max_depth and filter. Uses debounce before calling API. Shows semi-transparent loading overlay. | M2 | PLANNED |
| 3.3 | Dropdown Autocomplete | Frontend input for alias search forces user to select from standard dictionary. | M2 | PLANNED |

## Instructions
- You are the Milestone 3 Sub-orchestrator.
- Execute the Iteration Loop (Explorer -> Worker -> Reviewer -> Gate) to implement these features.
- Note the caveat from Milestone 2: running `npm install` directly may time out due to user permissions, so rely on static analysis. Also `dagreGraph` in `src/layout.ts` might need to be scoped locally, keep this in mind.
- When done, update `d:\personal\living_graph_tc\PROJECT.md` Milestone 3 status to DONE.
- Then report back to your parent.
