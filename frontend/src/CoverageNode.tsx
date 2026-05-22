import { Handle, Position } from '@xyflow/react';

export default function CoverageNode({ data }: { data: Record<string, any> }) {
  const bgColor = data.test_status === 'Passed' ? '#c8e6c9' : data.test_status === 'Failed' ? '#ffcdd2' : 'white';
  return (
    <div style={{ position: 'relative', width: '200px', height: '100%', pointerEvents: 'auto' }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ zIndex: 10, left: 0, top: 0, width: '100%', height: '5px', borderRadius: 0, opacity: 1, background: 'transparent', border: 'none' }}
      />
      <div style={{ textAlign: 'center', background: bgColor, border: '1px solid #333', borderRadius: '5px', padding: '10px' }}>
        <div className="node-label" style={{ fontWeight: 'bold' }}>{data.label || 'Node'}</div>
        <div style={{ fontSize: '10px', color: '#555' }}>{data.name}</div>
        <div style={{ fontSize: '10px', fontStyle: 'italic', marginTop: 4 }}>
          {data.aliases?.join(', ')}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ zIndex: 10, left: 0, bottom: 0, width: '100%', height: '5px', borderRadius: 0, opacity: 1, background: 'transparent', border: 'none' }}
      />
    </div>
  );
}
