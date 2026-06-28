import ELK from 'elkjs/lib/elk.bundled.js';
const elk = new ELK();
import { Node, Edge, Position } from '@xyflow/react';

// Base dimensions for a single node (matches .custom-node min-width + padding)
const nodeWidth = 240;
const nodeHeight = 120;

/**
 * Dagre-based layout with parent-child (subflow) support.
 * 
 * Strategy:
 * 1. Identify parent-child relationships (nodes with parentId).
 * 2. Lay out children inside parents using a simple grid.
 * 3. Calculate parent dimensions with generous padding so children never overflow.
 * 4. Feed only root-level nodes into Dagre for global positioning.
 * 5. Apply Dagre positions to root nodes; children keep their relative positions.
 */
export const getLayoutedElements = async (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
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
  };

  // -- Step 1: Group children by parent --
  const parentToChildren: Record<string, Node[]> = {};
  nodes.forEach(n => {
    if (n.parentId) {
      if (!parentToChildren[n.parentId]) parentToChildren[n.parentId] = [];
      parentToChildren[n.parentId].push(n);
    }
  });

  // -- Step 2: Lay out children inside each parent and compute parent dimensions --
  const newNodes = nodes.map(n => ({ ...n }));
  const nodeDimensions: Record<string, { w: number; h: number }> = {};

  // Grid layout parameters for children inside a parent
  const CHILD_W = nodeWidth;
  const CHILD_GAP_X = 120;  // Increased to give horizontal edges more breathing room
  const CHILD_GAP_Y = 120;  // Increased to prevent tight vertical gaps
  const PAD_LEFT = 40;      // Increased padding
  const PAD_RIGHT = 40;
  const PAD_BOTTOM = 60;    // Increased bottom padding
  const COLS = 2;           // Number of columns in the child grid

  newNodes.forEach(n => {
    if (!n.parentId && parentToChildren[n.id]) {
      // This is a parent node
      const children = parentToChildren[n.id];
      const numRows = Math.ceil(children.length / COLS);
      const numCols = Math.min(children.length, COLS);
      
      const badgesCount = (n.data as any)?.badges?.length || 0;
      // Calculate dynamic top padding based on parent badges
      const PAD_TOP = badgesCount > 0 ? 100 + (badgesCount * 30) : 100;

      // Calculate dynamic row heights based on children's badges
      const rowHeights: number[] = Array(numRows).fill(180);
      children.forEach((child, i) => {
        const row = Math.floor(i / COLS);
        const childBadgesCount = (child.data as any)?.badges?.length || 0;
        // 140px base + ~40px per badge (assuming 1 badge per row for safety as names can be long)
        const childH = 140 + (childBadgesCount * 40);
        if (childH > rowHeights[row]) {
          rowHeights[row] = childH;
        }
      });

      // Lay out each child in a grid
      children.forEach((child, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const x = PAD_LEFT + col * (CHILD_W + CHILD_GAP_X);
        
        let y = PAD_TOP;
        for (let r = 0; r < row; r++) {
          y += rowHeights[r] + CHILD_GAP_Y;
        }
        
        const childNode = newNodes.find(cn => cn.id === child.id);
        if (childNode) {
          childNode.position = { x, y };
        }
      });

      // Calculate parent dimensions to fully contain all children
      const totalChildrenW = numCols * CHILD_W + (numCols - 1) * CHILD_GAP_X;
      let totalChildrenH = 0;
      for (let r = 0; r < numRows; r++) {
        totalChildrenH += rowHeights[r];
      }
      totalChildrenH += Math.max(0, numRows - 1) * CHILD_GAP_Y;
      
      const parentW = PAD_LEFT + totalChildrenW + PAD_RIGHT;
      const parentH = PAD_TOP + totalChildrenH + PAD_BOTTOM;

      nodeDimensions[n.id] = { w: parentW, h: parentH };

      // Apply visual styling to the parent node
      if (!n.style) n.style = {};
      n.style.width = parentW;
      n.style.height = parentH;
      n.style.padding = '0px';
      n.style.backgroundColor = 'rgba(30, 41, 59, 0.35)';
      n.style.border = '1px solid rgba(148, 163, 184, 0.25)';
      n.style.borderRadius = '16px';
    } else if (!n.parentId) {
      // Regular root node (no children)
      nodeDimensions[n.id] = { w: nodeWidth, h: nodeHeight };
    }
  });

  // -- Step 3: Register only root nodes with ELK --
  newNodes.forEach(node => {
    if (!node.parentId) {
      const dims = nodeDimensions[node.id] || { w: nodeWidth, h: nodeHeight };
      elkGraph.children.push({ id: node.id, width: dims.w, height: dims.h });
    }
  });

  // -- Step 4: Register edges with ELK (route through parents if needed) --
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

  const layoutedGraph = await elk.layout(elkGraph);

  // -- Step 5: Apply ELK positions to root nodes --
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
  });

  return { nodes: finalNodes, edges };
};

/**
 * Simple grid layout that groups nodes by their primary alias (category).
 * Used as an alternative to Dagre for a more spreadsheet-like view.
 */
export const getGridLayoutedElements = (nodes: Node[], columns: number = 4) => {
  const groups: Record<string, Node[]> = {};
  
  // Group nodes by their primary alias (category)
  nodes.forEach(node => {
    const aliases = (node.data as any)?.aliases || [];
    const category = aliases.length > 0 ? aliases[0] : 'Uncategorized';
    if (!groups[category]) groups[category] = [];
    groups[category].push(node);
  });

  const paddingX = 120;
  const paddingY = 150;
  const groupPaddingY = 300; // Extra vertical space between different category groups

  let currentY = 0;
  const newNodes: Node[] = [];
  
  // Sort categories alphabetically so layout is deterministic
  const categories = Object.keys(groups).sort();
  
  for (const category of categories) {
    const groupNodes = groups[category];
    let row = 0;
    let col = 0;
    let maxRowY = currentY;
    
    // Sort nodes within the group alphabetically by name for consistency
    groupNodes.sort((a, b) => {
      const nameA = ((a.data as any)?.name || '').toLowerCase();
      const nameB = ((b.data as any)?.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    for (const node of groupNodes) {
      const newNode = { ...node };
      
      newNode.position = {
        x: col * (nodeWidth + paddingX),
        y: currentY + row * (nodeHeight + paddingY)
      };
      
      newNodes.push(newNode);
      maxRowY = Math.max(maxRowY, newNode.position.y);
      
      col++;
      if (col >= columns) {
        col = 0;
        row++;
      }
    }
    
    // Move Y to the start of the next group
    currentY = maxRowY + nodeHeight + groupPaddingY;
  }

  return { nodes: newNodes };
};
