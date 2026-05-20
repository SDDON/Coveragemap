# Scope: E2E Test Suite Development

## Architecture
- Playwright TypeScript test suite under `/e2e-tests`
- `playwright.config.ts` targeting `http://localhost:5173` (Frontend) and `http://localhost:8000` (Backend API).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Setup & Tier 1 Tests | Initialize Playwright, write 30 Feature Coverage tests (5 per feature F1-F6). | none | IN_PROGRESS |
| 2 | Tier 2 Tests | Write 30 Boundary & Corner tests. | M1 | PLANNED |
| 3 | Tier 3 Tests | Write pairwise cross-feature tests. | M1 | PLANNED |
| 4 | Tier 4 Tests | Write 5 Real-World Application scenario tests. | M1 | PLANNED |

## Interface Contracts
### E2E Tests ↔ Application
- Application must be running locally during test execution. Tests will use mock responses where possible for backend isolation if needed, but primary focus is E2E over live local endpoints.
- Tests rely on standard DOM attributes (e.g., `data-testid`, class names) or API schemas defined in the ORIGINAL_REQUEST.
