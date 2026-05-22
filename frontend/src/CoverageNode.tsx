import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

// Inline style extracted as a constant to avoid creating a new object on every render
const wrapperStyle = { pointerEvents: 'auto' as const, width: '220px' };

function CoverageNode({ data }: { data: any; selected?: boolean; [key: string]: any }) {
  // Status classes are applied to the wrapper by App.tsx, so we just use standard classes here
  return (
    <div className="custom-node-wrapper" style={wrapperStyle}>
      <Handle type="target" position={Position.Top} id="top" className="react-flow__handle-top" />
      <div className="custom-node">
        {/* Decorative corner element for status color inheritance (handled in CSS) */}
        <div className="status-indicator"></div>
        
        <div className="node-label">{data.label || 'Node'}</div>
        <div className="node-type">{data.name}</div>
        <div className="node-aliases">
          {data.aliases?.join(', ')}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="bottom" className="react-flow__handle-bottom" />
    </div>
  );
}

// Custom comparator: only re-render when actual visible data changes.
// Ignore xPos, yPos, dragging, zIndex etc. which change every drag frame.
export default memo(CoverageNode, (prev, next) => {
  return prev.data === next.data && prev.selected === next.selected;
});
