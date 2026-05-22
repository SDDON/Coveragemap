## 2026-05-21T23:41:25+09:00

Improve the React Flow node interaction in Coveragemap by fixing the focus/context highlighting for neighbors, distinguishing incoming vs outgoing neighbor colors, and implementing a robust connection mechanism to resolve small handle constraints.

Working directory: e:\Workspace\coveragemap
Integrity mode: demo (Adhere strictly to authorized workflows; well-maintained open-source libraries with permissive licenses are allowed if necessary).

## Requirements

### R1. Fix Focus+Context Highlighting
When a node is selected, its connected neighbors (up to a given Max Depth) and the edges between them should remain active and highlighted. Unrelated nodes and edges should be dimmed.

### R2. Directional Highlight Colors & Policy Document
When a node is selected, visually distinguish its incoming neighbors from its outgoing neighbors using different CSS highlights. You must create a css_policy.md document in the root directory that clearly explains which CSS classes or variables are used for these highlights, so the user can easily provide feedback or override the colors later.

### R3. Improved Connection Mechanism
Replace the restrictive single top/bottom tiny handle system. Evaluate and implement the best native React Flow approach (such as floating edges or full-boundary connection points) to allow multiple edges to be easily connected to and from a single node.

## Acceptance Criteria

### Browser SubAgent Verification
- [ ] An independent Browser SubAgent audit confirms that clicking a node correctly keeps its related neighbors active (not dimmed).
- [ ] The Auditor confirms that incoming and outgoing nodes have visually distinct highlights.
- [ ] The css_policy.md file is generated and accurately details how to change the colors.
- [ ] The Auditor confirms that drawing multiple edges to a single node is now smooth and unconstrained by the previous tiny, fixed handles.
