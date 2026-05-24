# Original User Request

## Initial Request — 2026-05-23T15:42:38Z

# Teamwork Project Prompt

Working directory: e:\Workspace\coveragemap\frontend
Integrity mode: development

## Requirements

### R1. Robust Parent-Child Grouping (Subflows)
Parent nodes (e.g., Screens) must visually and structurally contain their child nodes (e.g., Components). The parent node's UI must dynamically expand to enclose children while maintaining a cohesive design, without the parent's own label/UI rendering as a detached overlapping box. Use React Flow's native `type: 'group'` or a robust custom group layout.

### R2. Global Node Badgeification (Dependencies)
Nodes marked as `is_global` (e.g., common Data elements) must not render as standalone nodes in the canvas. Instead, they must be injected into the UI of the nodes that depend on them, appearing as small, clickable "pill badges" displaying their test status.

### R3. Visual Clarity & Edge Deduplication
The UI must strictly adhere to a Dark Mode Glassmorphism aesthetic. Edges must be cleanly routed. When a parent node is collapsed, all external edges connecting its children to external nodes must be visually deduplicated into a single representative edge. "Focus + Context" interaction must properly dim unrelated nodes (opacity 0.4, grayscale 100%) without making them invisible.

## Acceptance Criteria

### UI Architecture Verification
- [ ] Programmatic/Visual: Parent nodes correctly wrap child nodes. The parent node's label and content perfectly align with the expanded boundary. No visual overlap bugs where a parent node's inner `div` renders separately from its React Flow boundary.

### Interaction Verification
- [ ] Programmatic: Collapsing a parent node smoothly hides its children and deduplicates all external edges into a single representative edge.
- [ ] Programmatic: Clicking a global node's badge opens the Edit Panel for that global node.
