import ELK from 'elkjs/lib/elk.bundled.js';
const elk = new ELK();
import { Node, Edge, Position } from '@xyflow/react';

// Base dimensions for a single node (matches .custom-node min-width + padding)
const nodeWidth = 280;
const nodeHeight = 120;

// Helper to estimate dynamic node width based on label text length
const estimateNodeWidth = (node: Node): number => {
  const name = (node.data as any)?.name || '';
  const textLen = name.length;
  // Estimate ~16px per character for Korean/English mixed text + padding
  const calculated = Math.max(280, textLen * 16 + 70);
  return Math.min(520, calculated);
};

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
      'elk.spacing.nodeNode': '220',
      'elk.layered.spacing.nodeNodeBetweenLayers': '260',
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
  const CHILD_W = 320;      // Expanded so children comfortably contain longer feature titles
  const CHILD_GAP_X = 140;  // Ample horizontal gap between child nodes for clean edge routing
  const CHILD_GAP_Y = 130;  // Ample vertical gap between rows
  const PAD_LEFT = 50;      // Generous side padding
  const PAD_RIGHT = 50;
  const PAD_BOTTOM = 70;    // Generous bottom padding
  const COLS = 2;           // Number of columns in the child grid

  newNodes.forEach(n => {
    if (!n.parentId && parentToChildren[n.id]) {
      // This is a parent node
      const children = parentToChildren[n.id];
      const numRows = Math.ceil(children.length / COLS);
      const numCols = Math.min(children.length, COLS);
      
      const badgesCount = (n.data as any)?.badges?.length || 0;
      // Generous top padding so child nodes never encroach on parent title, type, and tags
      const PAD_TOP = badgesCount > 0 ? 170 + (badgesCount * 36) : 160;

      // Calculate dynamic row heights based on children's badges
      const rowHeights: number[] = Array(numRows).fill(180);
      children.forEach((child, i) => {
        const row = Math.floor(i / COLS);
        const childBadgesCount = (child.data as any)?.badges?.length || 0;
        // 140px base + ~40px per badge
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

      // Apply Clean Light theme visual styling to the parent node
      if (!n.style) n.style = {};
      n.style.width = parentW;
      n.style.height = parentH;
      n.style.padding = '0px';
      n.style.backgroundColor = '#f8fafc';
      n.style.border = '1.5px solid #cbd5e1';
      n.style.borderRadius = '16px';
      n.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
    } else if (!n.parentId) {
      // Regular root node (e.g. TestCase)
      const estimatedW = estimateNodeWidth(n);
      nodeDimensions[n.id] = { w: estimatedW, h: nodeHeight };
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

// (Feature Pruning Tier 1, 2026-10) getGridLayoutedElements(Grid Layout) 제거 — ELK 계층형 레이아웃으로 일원화
