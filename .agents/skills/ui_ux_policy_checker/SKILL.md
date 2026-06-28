---
name: ui-ux-policy-checker
description: Checks the current React Flow and CSS code against the UI_UX_DESIGN_SYSTEM.md policies to ensure design consistency (Focus+Context, Status colors, Component structure). Use this when adding new nodes or when a UI/UX Designer requests a design audit.
---

# UI/UX Policy Checker Skill

You are acting as a UI/UX Designer Assistant for the CoverageMap project.
Your job is to regularly audit the frontend codebase to ensure it complies with the project's design system.

## Instructions
1. Read `UI_UX_DESIGN_SYSTEM.md` in the workspace root to understand the current UI layout policies, including Naming Conventions (Parent Node, Child Node, Dependency Badges), Test Status Colors, and Focus + Context blurring rules.
2. Review the CSS file (`frontend/src/index.css`) to verify that the CSS classes (e.g., `.has-selection`, `.active`, `.status-passed`) are implemented correctly and haven't been degraded or overwritten.
3. Review the node component file (`frontend/src/CoverageNode.tsx`) to ensure it still uses the correct CSS classes (`.custom-node`, `.badge-pill`, etc.) and hasn't introduced inline styles that violate the policy.
4. Report any deviations, hardcoded inline opacity/colors that bypass the CSS classes, or contrast/visibility issues to the user.
5. If everything is compliant, provide a short summary confirming that the UI/UX policy is successfully maintained.
