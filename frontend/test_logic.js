const maxDepth = 2;
const selectedNode = { id: 'A' };
const nodes = [
  { id: 'A', className: 'some-class' },
  { id: 'B' },
  { id: 'C' },
  { id: 'D' },
  { id: 'E' },
  { id: 'F' }
];
const edges = [
  { id: 'e1', source: 'A', target: 'B' },
  { id: 'e2', source: 'B', target: 'C' },
  { id: 'e3', source: 'C', target: 'D' }, // depth 3 from A
  { id: 'e4', source: 'E', target: 'A' },
  { id: 'e5', source: 'F', target: 'E' },
  { id: 'e6', source: 'F', target: 'B' } // unrelated? F is incoming to E, B is outgoing from A
];

const incoming = new Set();
const outgoing = new Set();
const edgeHighlights = new Set();

let queue = [{ id: selectedNode.id, depth: 0 }];
while (queue.length > 0) {
  const { id, depth } = queue.shift();
  if (depth >= maxDepth) continue;

  const outEdges = edges.filter(e => e.source === id);
  for (const edge of outEdges) {
    edgeHighlights.add(edge.id);
    if (!outgoing.has(edge.target)) {
      outgoing.add(edge.target);
      queue.push({ id: edge.target, depth: depth + 1 });
    }
  }
}

queue = [{ id: selectedNode.id, depth: 0 }];
while (queue.length > 0) {
  const { id, depth } = queue.shift();
  if (depth >= maxDepth) continue;

  const inEdges = edges.filter(e => e.target === id);
  for (const edge of inEdges) {
    edgeHighlights.add(edge.id);
    if (!incoming.has(edge.source)) {
      incoming.add(edge.source);
      queue.push({ id: edge.source, depth: depth + 1 });
    }
  }
}

const styledNodes = nodes.map(n => {
  let cls = (n.className || '').replace(/highlight-[a-z-]+/g, '').trim();
  if (n.id === selectedNode.id) {
    // keep selected node as is
  } else if (outgoing.has(n.id)) {
    cls += ' highlight-outgoing';
  } else if (incoming.has(n.id)) {
    cls += ' highlight-incoming';
  }
  return { ...n, className: cls.trim() };
});

const styledEdges = edges.map(e => {
  let cls = (e.className || '').replace(/highlight-[a-z-]+/g, '').trim();
  if (edgeHighlights.has(e.id)) {
    cls += ' highlight-edge';
  }
  return { ...e, className: cls.trim() };
});

console.log(JSON.stringify({ styledNodes, styledEdges }, null, 2));
