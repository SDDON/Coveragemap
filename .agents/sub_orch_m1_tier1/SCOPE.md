# Scope: M1 (Setup & Tier 1 Tests)

## Architecture
- Target directory: `/e2e-tests`
- `package.json` with Playwright (Node.js/TypeScript)
- `playwright.config.ts`

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Setup & Tier 1 | Initialize Playwright, write 30 Feature Coverage tests (5 per feature F1-F6). | none | DONE |

## Interface Contracts
- Tests must compile with `tsc` without errors.
- Tests will target `http://localhost:5173` and `http://localhost:8000`.
- Expected to fail at runtime if app is not built, but code structure must be sound.
