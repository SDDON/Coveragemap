Please explore the `e:\Workspace\coveragemap\frontend\src` directory and analyze how to implement the three requirements in `ORIGINAL_REQUEST.md`.

Requirements:
R1. Parent-Child Grouping: Parent nodes dynamically expand to enclose children. No visual overlap bugs.
R2. Global Node Badgeification: `is_global` nodes render as clickable pill badges inside dependent nodes instead of standalone nodes.
R3. Visual Clarity & Edge Deduplication: Dark mode glassmorphism, clean edge routing. Collapsed parents visually deduplicate external edges. Focus+Context dims unrelated nodes (opacity 0.4, grayscale 100%).

Tasks:
1. Identify all relevant components and state files (e.g., node types, edge types, layouts, app state).
2. Propose an implementation plan/architecture for each requirement.
3. Write your findings to `e:\Workspace\coveragemap\frontend\.agents\orchestrator\PROJECT.md`.
4. Your handoff should contain the milestone plan and interface contracts for the Worker to follow.
