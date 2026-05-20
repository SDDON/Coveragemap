# E2E Test Infra: Living Graph TC Platform

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | F1: Local Data Pipeline (Neo4j Seed) | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ |
| 2 | F2: Core Visualization (Focus+Context) | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| 3 | F3: Living TC (Test Coverage Marking) | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| 4 | F4: Graph Editing (Nodes & Edges) | ORIGINAL_REQUEST R4 | 5 | 5 | ✓ |
| 5 | F5: Config Panel & Loading UI | ORIGINAL_REQUEST R5 | 5 | 5 | ✓ |
| 6 | F6: Alias Dictionary (Standardization) | ORIGINAL_REQUEST R6 | 5 | 5 | ✓ |

## Test Architecture
- Test runner: Playwright (Node.js/TypeScript)
- Invocation: `cd e2e-tests && npm run test`
- Pass/Fail semantics: All tests must pass with exit code 0 when run against the fully implemented application.
- Test case format: Playwright `.spec.ts` files. Expected output format is Playwright's default reporter (list/html).
- Directory layout:
  - `/e2e-tests/`
    - `package.json`
    - `playwright.config.ts`
    - `tests/`
      - `tier1.spec.ts` (Feature Coverage)
      - `tier2.spec.ts` (Boundary & Corner)
      - `tier3.spec.ts` (Cross-Feature)
      - `tier4.spec.ts` (Real-World Application)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | User loads app, sees loading overlay, focuses on a seed node, marks it as passed. | F1, F2, F3, F5 | Medium |
| 2 | User edits an existing node using standardized alias, then creates an edge to another node, and verifies config panel debounce prevents race conditions. | F4, F5, F6 | High |
| 3 | User creates a complex path (5 nodes, 4 edges), marks one intermediate node as failed, changing the visualization context for the subgraph. | F2, F3, F4 | High |
| 4 | User sets maximum depth config, sees the graph reduce in size, searches for a synonym alias which auto-converts to standard, and highlights the corresponding node. | F2, F5, F6 | Medium |
| 5 | End-to-end TC cycle: User starts with untested graph, tests paths by adding edges and marking test statuses, and reaches a fully tested (passed/failed) state. | F3, F4 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature (Total 30)
- Tier 2: ≥5 per feature (Total 30)
- Tier 3: pairwise coverage of major feature interactions (Total 6)
- Tier 4: ≥5 realistic application scenarios (Total 5)
