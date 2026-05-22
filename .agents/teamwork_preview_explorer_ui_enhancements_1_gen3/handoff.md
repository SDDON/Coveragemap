# Handoff: CoverageNode Registration Fix

## 1. Observation
- e:\Workspace\coveragemap\frontend\src\App.tsx lacks the import for CoverageNode.
- <ReactFlow> inside App.tsx is not receiving the 
odeTypes prop.
- The node mapping logic inside the etchGraph function (App.tsx lines ~82-87) constructs initialNodes but does not set 	ype: 'coverage'. It only sets id, data, position, and style.
- e:\Workspace\coveragemap\frontend\src\CoverageNode.tsx uses a default export: export default function CoverageNode({ data }: ...)

## 2. Logic Chain
1. Since CoverageNode is not imported or registered in App.tsx, React Flow falls back to default node rendering.
2. The failing Playwright tests are due to this fallback (the custom node UI/DOM structure is missing).
3. To restore custom nodes, we must provide the 
odeTypes map to <ReactFlow> containing the key coverage.
4. Nodes generated from the API must have 	ype: 'coverage' explicitly set so React Flow uses the provided 
odeTypes.
5. Defining 
odeTypes outside the component (or using useMemo) is best practice in React Flow to avoid unnecessary re-renders.

## 3. Caveats
- No edits to CoverageNode.tsx are assumed necessary since it already exists and uses a default export.
- The 
odeTypes object should be defined outside the App component or memoized to avoid performance issues with React Flow.

## 4. Conclusion
To fix the fallback to default nodes and satisfy Iteration 3 requirements, implement the following changes in e:\Workspace\coveragemap\frontend\src\App.tsx:

1. **Import the node component:**
   `	sx
   import CoverageNode from './CoverageNode';
   `
2. **Define 
odeTypes (outside the App component to avoid re-renders):**
   `	sx
   const nodeTypes = { coverage: CoverageNode };
   `
3. **Assign the type during node creation:**
   In the etchGraph function's data.nodes.map logic, add 	ype: 'coverage':
   `	sx
   const initialNodes: Node[] = data.nodes.map((n: ApiNode) => ({
     id: n.id,
     type: 'coverage', // <-- ADD THIS LINE
     data: n,
     position: { x: 0, y: 0 },
     style: { backgroundColor: n.status === 'Passed' ? '#c8e6c9' : (n.status === 'Failed' ? '#ffcdd2' : '#ffffff') }
   }));
   `
4. **Pass 
odeTypes to ReactFlow:**
   `	sx
   <ReactFlow
     nodes={styledNodes}
     edges={styledEdges}
     nodeTypes={nodeTypes} // <-- ADD THIS LINE
     // ...
   >
   `

## 5. Verification Method
- Inspect e:\Workspace\coveragemap\frontend\src\App.tsx to verify the four changes above.
- In e:\Workspace\coveragemap\frontend, run 
pm run dev and visually confirm that the custom nodes are rendering instead of default nodes.
- Run the E2E tests (e.g., 
px playwright test in the frontend directory) to confirm they no longer fail due to missing node UI elements.
