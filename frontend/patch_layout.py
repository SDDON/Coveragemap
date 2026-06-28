import re

with open("src/layout.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Replace import
content = content.replace("import dagre from 'dagre';", "import ELK from 'elkjs/lib/elk.bundled.js';\nconst elk = new ELK();")

# Make getLayoutedElements async
content = content.replace(
    "export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {",
    "export const getLayoutedElements = async (nodes: Node[], edges: Edge[], direction = 'TB') => {"
)

# Replace dagre logic with elk
dagre_setup = """  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 160,   // Generous spacing between sibling nodes
    ranksep: 200,   // Generous spacing between ranks
    edgesep: 40,
  });"""

elk_setup = """  const isHorizontal = direction === 'LR';
  const elkGraph: any = {
    id: "root",
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': isHorizontal ? 'RIGHT' : 'DOWN',
      'elk.spacing.nodeNode': '160',
      'elk.layered.spacing.nodeNodeBetweenLayers': '200',
    },
    children: [],
    edges: []
  };"""
content = content.replace(dagre_setup, elk_setup)

# Step 3
step3_old = """  // -- Step 3: Register only root nodes with Dagre --
  newNodes.forEach(node => {
    if (!node.parentId) {
      const dims = nodeDimensions[node.id] || { w: nodeWidth, h: nodeHeight };
      dagreGraph.setNode(node.id, { width: dims.w, height: dims.h });
    }
  });"""
step3_new = """  // -- Step 3: Register only root nodes with ELK --
  newNodes.forEach(node => {
    if (!node.parentId) {
      const dims = nodeDimensions[node.id] || { w: nodeWidth, h: nodeHeight };
      elkGraph.children.push({ id: node.id, width: dims.w, height: dims.h });
    }
  });"""
content = content.replace(step3_old, step3_new)

# Step 4
step4_old = """  // -- Step 4: Register edges with Dagre (route through parents if needed) --
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    const effectiveSource = sourceNode?.parentId || edge.source;
    const effectiveTarget = targetNode?.parentId || edge.target;
    
    if (effectiveSource !== effectiveTarget && dagreGraph.hasNode(effectiveSource) && dagreGraph.hasNode(effectiveTarget)) {
      dagreGraph.setEdge(effectiveSource, effectiveTarget);
    }
  });

  dagre.layout(dagreGraph);"""

step4_new = """  // -- Step 4: Register edges with ELK (route through parents if needed) --
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    const effectiveSource = sourceNode?.parentId || edge.source;
    const effectiveTarget = targetNode?.parentId || edge.target;
    
    if (effectiveSource !== effectiveTarget && 
        elkGraph.children.some((c: any) => c.id === effectiveSource) && 
        elkGraph.children.some((c: any) => c.id === effectiveTarget)) {
      elkGraph.edges.push({
        id: edge.id,
        sources: [effectiveSource],
        targets: [effectiveTarget]
      });
    }
  });

  const layoutedGraph = await elk.layout(elkGraph);"""
content = content.replace(step4_old, step4_new)

# Step 5
step5_old = """  // -- Step 5: Apply Dagre positions to root nodes --
  const finalNodes = newNodes.map(node => {
    const newNode = { ...node };

    if (!newNode.parentId) {
      const nodeWithPosition = dagreGraph.node(newNode.id);
      newNode.targetPosition = isHorizontal ? Position.Left : Position.Top;
      newNode.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

      if (nodeWithPosition) {
        const dims = nodeDimensions[newNode.id] || { w: nodeWidth, h: nodeHeight };
        newNode.position = {
          x: nodeWithPosition.x - dims.w / 2,
          y: nodeWithPosition.y - dims.h / 2,
        };
      }
    } else {
      // Child nodes: keep relative positions (already set above)
      newNode.targetPosition = isHorizontal ? Position.Left : Position.Top;
      newNode.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    }

    return newNode;
  });"""

step5_new = """  // -- Step 5: Apply ELK positions to root nodes --
  const finalNodes = newNodes.map(node => {
    const newNode = { ...node };

    if (!newNode.parentId) {
      const elkNode = layoutedGraph.children?.find(c => c.id === newNode.id);
      newNode.targetPosition = isHorizontal ? Position.Left : Position.Top;
      newNode.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

      if (elkNode) {
        newNode.position = {
          x: elkNode.x as number,
          y: elkNode.y as number,
        };
      }
    } else {
      // Child nodes: keep relative positions (already set above)
      newNode.targetPosition = isHorizontal ? Position.Left : Position.Top;
      newNode.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    }

    return newNode;
  });"""
content = content.replace(step5_old, step5_new)

with open("src/layout.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("layout.ts patched")
