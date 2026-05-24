# CoverageMap Frontend Architecture & Implementation Plan

This document outlines the architectural plan and interface contracts for implementing the three core requirements (R1, R2, R3) in the frontend codebase.

## R1: Parent-Child Grouping & Dynamic Expansion
**Goal:** Parent nodes must dynamically expand to enclose their children without visual overlap bugs.

**Current State & Issues:**
- `layout.ts` correctly identifies parent-child relationships using `parentId` and computes a bounding box for the parent based on a grid layout of its children (setting `n.style.width` and `n.style.height`).
- **The Bug:** `CoverageNode.tsx` has a hardcoded `wrapperStyle = { width: '240px' }`. When a node acts as a parent, its inner DOM elements do not stretch to fill the dynamic bounding box assigned by `layout.ts`, causing visual overlap and incorrect hitboxes.

**Implementation Plan (Worker Task):**
1. **Update `CoverageNode.tsx`:** 
   - Check if the node is a parent (e.g., `data.hasChildren`).
   - If it is a parent, the wrapper and inner `.custom-node` must use `width: '100%'` and `height: '100%'` to fill the React Flow node container.
   - Adjust `padding` for parents so children don't overlap the parent's label.
2. **CSS Tweaks (`index.css`):**
   - Refine `.react-flow__node[style*="width"] .custom-node-wrapper` and `.custom-node` to ensure they stretch correctly when `style.width` is present on the outer node.

## R2: Global Node Badgeification
**Goal:** `is_global` nodes should render as clickable pill badges inside dependent nodes instead of standalone nodes.

**Current State & Issues:**
- Initial load (`fetchGraph` in `App.tsx`) handles badgeification: global nodes are filtered out of the graph and injected into the `data.badges` array of their dependent nodes.
- `CoverageNode.tsx` successfully renders these badges and emits `selectBadgeNode` events.
- **The Bug:** When a user dynamically creates an edge to/from a global node via `onConnect`, the app blindly adds a standard edge to the `edges` state. It fails to intercept the action to update the `data.badges` array of the target/source node instead.

**Implementation Plan (Worker Task):**
1. **Intercept Edge Creation/Update (`App.tsx`):**
   - In `onConnect` and edge updates, check if the `source` or `target` is a global node (by checking the `is_global` property or inspecting existing global nodes).
   - If one endpoint is global, **do not** add a standard edge to `edges`. Instead, append the global node metadata to the other node's `data.badges` array.
2. **State Syncing:**
   - Ensure that when a global node's status is edited, all nodes containing that badge re-render with the updated badge status.
   - Ensure deleting a badge removes the underlying edge via API.

## R3: Visual Clarity & Edge Deduplication
**Goal:** Dark mode glassmorphism, clean edge routing, collapsed parents deduplicating external edges, and Focus+Context dimming.

**Current State & Issues:**
- **Dark Mode / Glassmorphism:** Mostly implemented in `index.css` (`var(--bg-color)`, `backdrop-filter: blur()`).
- **Focus+Context:** Implemented via the `has-selection` class and CSS dimming (`opacity: 0.4`, `filter: grayscale(100%)`).
- **Edge Deduplication:** `visibleEdges` hook dynamically reroutes edges when a parent is collapsed, changing the endpoint to the parent and setting `label = '...'`.
- **The Bug / Missing Polish:**
  - When edges are deduplicated, the `isRerouted` check falls back to `type: 'smoothstep'`. We should ensure this still uses `FloatingEdge` or a visually consistent edge type so styles match.
  - Sibling edges (multiple edges between the same two nodes) are bundled using `pathOffset` in `fetchGraph`. However, dynamically added edges do not recalculate this `pathOffset`, leading to overlapping lines.

**Implementation Plan (Worker Task):**
1. **Dynamic Edge Bundling (`App.tsx`):**
   - Extract the edge bundling logic (calculating `pathOffset`, `edgeIndex`, `totalEdges`) from `fetchGraph` into a reusable utility function.
   - Run this utility whenever the `edges` state changes so that dynamically added edges are correctly fanned out.
2. **Refine Edge Deduplication:**
   - In the `visibleEdges` useMemo, maintain the `floating` edge type for deduplicated edges, or ensure `smoothstep` edges receive the same marker and styling as standard edges.
3. **Verify Focus+Context:**
   - Ensure the `.has-selection` logic triggers reliably and clears when clicking the background. 

## Interface Contracts for Worker
- **State Structure:** 
  - `Node.data.badges`: Array of `{ id, name, test_status, edgeId, edgeType }`.
  - `Node.data.hasChildren`: Boolean flag indicating if the node acts as a parent layout container.
- **Event Bus:**
  - `selectBadgeNode`: Dispatched from `CoverageNode` with the global node ID to select it in the inspector.
  - `toggleCollapseNode`: Dispatched to toggle visibility of children.
- **Backend Sync:** 
  - Do not alter the Neo4j API calls; all visual transformations (badgeification, collapsing) must happen in the React layer.

## Iteration 2: Bug Fixes

### Findings
1. **R2 Failure (Global Node Property Destruction):** In `App.tsx`, `handleSave` and `handleSaveStatus` hardcode `properties: {}` in their API payloads and undo histories. Furthermore, `editFormData` does not initialize the `properties` field when selecting a node or edge (lines 411, 414). When saving or toggling the global checkbox, the properties (including `is_global`) are either not preserved from the original state or completely wiped out by the hardcoded `{}`.
2. **R3 Failure (Missing Floating Edge Type and Bundling):** In `App.tsx`, the `onConnect` callback pushes a newly created edge to the `edges` state without specifying `type: 'floating'`. Because of this omission, React Flow falls back to the default edge renderer, bypassing `FloatingEdge.tsx`. Even if `type` were added, it still ignores the custom `pathOffset` logic used to fan out overlapping edges because `calculateEdgeBundling` is not called on the newly appended edges.

### Fix Strategy & Implementation Plan (Worker Task)
1. **Fix R2 (Preserve Properties):** 
   - **Initialization**: In the `useEffect` (around line 408) that populates `setEditFormData` when `selectedNode` or `selectedEdge` changes, explicitly include `properties: n.properties || {}` and `properties: e.properties || {}` respectively. Also initialize `properties: {}` when `isCreatingNode` is true.
   - **API Payloads**: In `handleSave` and `handleSaveStatus`, replace the hardcoded `properties: {}` in the request payload with `properties: editFormData.properties || {}`. For undo actions (`pushUndo`), use `properties: (node.data as any)?.properties || {}` and `properties: (edge.data as any)?.properties || {}`. Replace all 12+ instances of hardcoded `properties: {}` across node/edge saving, deleting, and status updating.
2. **Fix R3 (Enforce FloatingEdge and Bundling):**
   - **Enforce Floating**: Update `onConnect` to explicitly include `type: 'floating'` when appending the new edge object to the `setEdges` state updater (around line 512).
   - **Recalculate Bundling**: Instead of just returning `nextEds` inside the `setEdges` callback in `onConnect`, wrap it in the `calculateEdgeBundling` function (i.e. `return calculateEdgeBundling(nextEds);`) so that `pathOffset` is correctly computed for dynamically added overlapping edges.
   - Do the same for `handleUndo`'s `DELETE_EDGE` logic (add `type: 'floating'` and potentially wrap in `calculateEdgeBundling`).
