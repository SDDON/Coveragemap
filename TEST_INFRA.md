# E2E Test Infra: CoverageMap

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | 4-Stage Test Status & Taxonomy | ORIGINAL_REQUEST R1, SPEC §3.1 | 5 | 5 | ✓ |
| 2 | Status Synthesis & Gating | ORIGINAL_REQUEST R1, SPEC §3.2 | 5 | 5 | ✓ |
| 3 | Manual Override (📌) | ORIGINAL_REQUEST R1, SPEC §3.2 | 5 | 5 | ✓ |
| 4 | Dependency Cycle Rejection | ORIGINAL_REQUEST R1, SPEC §3.4 | 5 | 5 | ✓ |
| 5 | Global Node Non-Propagation | ORIGINAL_REQUEST R1, SPEC §4.3 | 5 | 5 | ✓ |
| 6 | Root Cause Tracing BFS | ORIGINAL_REQUEST R1, SPEC §3.3 | 5 | 5 | ✓ |
| 7 | Optimistic Update & Rollback | ORIGINAL_REQUEST R2, SPEC Golden Rule 3 | 5 | 5 | ✓ |
| 8 | Undo Stack Integrity & ID Remapping | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| 9 | Dev Endpoint & Security Gates | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| 10 | Focus+Context Pure CSS (0.4 dimming) | ORIGINAL_REQUEST R4, SPEC §5 Rule 1 | 5 | 5 | ✓ |
| 11 | Change Impact Ripple | SPEC §4.4, TESTCASE_MODELING §7 | 5 | 5 | ✓ |

## Test Architecture
- Test runner: Playwright (`cd e2e-tests && npm test`)
- Pass/fail semantics: Exit code 0, 0 failed tests, all assertions deterministic (no vacuous assertions).
- Directory layout: `e2e-tests/tests/`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Complete QA Verification Workflow | Status marking, checklist updates, dependency rollup, Inspector edits | High |
| 2 | Change Impact Ripple & Acknowledge | Node modification, downstream 2-hop highlight, Inspector acknowledge | Medium |
| 3 | Dependency Cycle Attempt & Prevention | User attempts circular Depends_On, error toast displayed, state preserved | Medium |
| 4 | Global Badge Isolation & Localization Audit | Global node toggle, non-propagation check, cross-cutting audit | High |
| 5 | Undo/Redo & Rollback on Network Failure | Mutations, API error injection, snapshot rollback, undo stack verification | High |

## Coverage Thresholds
- Tier 1: ≥5 per feature
- Tier 2: ≥5 per feature (boundary conditions, cycles, empty inputs)
- Tier 3: pairwise coverage of major feature interactions
- Tier 4: ≥5 realistic application scenarios
