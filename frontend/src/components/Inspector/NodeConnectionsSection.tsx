import React, { useState, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CoverageNode, CoverageEdge, StatusName } from '../../types/graph';
import type { EditFormData, PendingConnectSourceState } from '../../types/ui';
import { CHECKLIST_STATUS_CYCLE, STATUS_ICON } from '../../utils/constants';
import { getSmartDefaultEdgeType, computeNodeConnections, type NodeConnectionItem } from '../../utils/graphScopes';
import { t } from '../../locales/koKR';

interface NodeConnectionsSectionProps {
  liveEditNode: CoverageNode;
  nodes: CoverageNode[];
  edges: CoverageEdge[];
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setEdges: Dispatch<SetStateAction<CoverageEdge[]>>;
  setSelectedNode: Dispatch<SetStateAction<CoverageNode | null>>;
  setSelectedEdge: Dispatch<SetStateAction<CoverageEdge | null>>;
  setEditFormData: Dispatch<SetStateAction<EditFormData>>;
  onFocusNode?: (nodeId: string, openEditTab?: boolean) => void;
  handleUpdateEdgeStatusById?: (edgeId: string, status: StatusName) => Promise<void>;
  pendingConnectSource: PendingConnectSourceState | null;
  setPendingConnectSource: Dispatch<SetStateAction<PendingConnectSourceState | null>>;
}

export const NodeConnectionsSection: React.FC<NodeConnectionsSectionProps> = ({
  liveEditNode,
  nodes,
  edges,
  setNodes,
  setEdges,
  setSelectedNode,
  setSelectedEdge,
  setEditFormData,
  onFocusNode,
  handleUpdateEdgeStatusById,
  pendingConnectSource,
  setPendingConnectSource,
}) => {
  const [openStatusEdgeId, setOpenStatusEdgeId] = useState<string | null>(null);
  const [showContainsList, setShowContainsList] = useState<boolean>(false);

  const { incoming, outgoing, contains } = useMemo(
    () => computeNodeConnections(liveEditNode, nodes, edges),
    [liveEditNode, nodes, edges]
  );

  const handleJumpToNode = (targetNode: CoverageNode) => {
    if (onFocusNode) {
      onFocusNode(targetNode.id, true);
      return;
    }
    setNodes(nds =>
      nds.map(n => (n.id === targetNode.id ? { ...n, selected: true } : n.selected ? { ...n, selected: false } : n))
    );
    setEdges(eds => (eds.some(e => e.selected) ? eds.map(e => (e.selected ? { ...e, selected: false } : e)) : eds));
    setSelectedNode(targetNode);
    setSelectedEdge(null);
    setEditFormData({
      id: targetNode.id,
      label: targetNode.data?.label || 'Node',
      name: targetNode.data?.name || '',
      aliases: targetNode.data?.aliases || [],
      description: targetNode.data?.description || '',
      test_status: targetNode.data?.test_status || 'Untested',
      properties: { ...(targetNode.data?.properties || {}) },
      type: 'node',
    });
  };

  const handleSelectEdgeForEdit = (edge: CoverageEdge) => {
    const edgeType = String(edge.data?.type || edge.label || 'Transition');
    setNodes(nds => (nds.some(n => n.selected) ? nds.map(n => (n.selected ? { ...n, selected: false } : n)) : nds));
    setEdges(eds =>
      eds.map(e => (e.id === edge.id ? { ...e, selected: true } : e.selected ? { ...e, selected: false } : e))
    );
    setSelectedNode(null);
    setSelectedEdge(edge);
    setEditFormData({
      id: edge.id,
      label: edgeType,
      name: '',
      aliases: [],
      description: '',
      test_status: edge.data?.test_status || 'Untested',
      edgeType,
      action: edge.data?.action || '',
      properties: { ...(edge.data?.properties || {}) },
      type: 'edge',
    });
  };

  const renderConnectionCard = (item: NodeConnectionItem, direction: 'in' | 'out' | 'contains') => {
    const { edge, neighborNode, viaChildNode, containsDirection } = item;
    const edgeStatus = (edge.data?.test_status || 'Untested') as StatusName;
    const edgeType = String(edge.data?.type || edge.label || 'Transition');
    const edgeAction = edge.data?.action || '';
    const neighborName = neighborNode.data?.name || neighborNode.id;
    const neighborLabel = neighborNode.data?.label || 'Node';
    const neighborStatus = (neighborNode.data?.test_status || 'Untested') as StatusName;
    const viaChildName = viaChildNode?.data?.name || viaChildNode?.id || '';

    return (
      <div
        key={`${direction}:${edge.id}`}
        className={`node-conn-card node-conn-${direction} edge-type-${edgeType.toLowerCase()}`}
      >
        <div className="node-conn-card-main">
          {/* 1. 엣지 상태 원클릭 변경 드롭다운 */}
          <div
            className="checklist-status-picker node-conn-status-picker"
            onBlur={e => {
              if (!e.currentTarget.contains(e.relatedTarget as HTMLElement | null)) {
                setOpenStatusEdgeId(prev => (prev === edge.id ? null : prev));
              }
            }}
          >
            <button
              type="button"
              className="checklist-status-trigger node-conn-status-trigger"
              title={`${t.nodeConnections.changeEdgeStatus}: ${t.status[edgeStatus]}`}
              aria-haspopup="menu"
              aria-expanded={openStatusEdgeId === edge.id}
              onClick={() => setOpenStatusEdgeId(prev => (prev === edge.id ? null : edge.id))}
            >
              {STATUS_ICON[edgeStatus]}
            </button>
            {openStatusEdgeId === edge.id && (
              <div className="checklist-status-menu" role="menu">
                {CHECKLIST_STATUS_CYCLE.map(st => (
                  <button
                    key={st}
                    type="button"
                    role="menuitemradio"
                    className={`checklist-status-btn${edgeStatus === st ? ' selected' : ''}`}
                    title={t.status[st]}
                    aria-checked={edgeStatus === st}
                    onClick={() => {
                      setOpenStatusEdgeId(null);
                      if (edgeStatus === st) return;
                      handleUpdateEdgeStatusById?.(edge.id, st);
                    }}
                  >
                    {STATUS_ICON[st]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. 상대 노드 정보 (클릭 시 해당 노드로 즉시 점프) */}
          <div className="node-conn-info">
            <button
              type="button"
              className="node-conn-neighbor-btn"
              title={t.nodeConnections.jumpToNodeTitle(neighborName)}
              onClick={() => handleJumpToNode(neighborNode)}
            >
              <span className="node-conn-label-chip">{neighborLabel}</span>
              <span className="node-conn-neighbor-name">{neighborName}</span>
              <span className="node-conn-neighbor-status" title={t.status[neighborStatus]}>
                {STATUS_ICON[neighborStatus]}
              </span>
            </button>

            <div className="node-conn-meta-row">
              <span className={`node-conn-edge-type-pill type-${edgeType.toLowerCase()}`}>
                {direction === 'in' ? `← ${edgeType}` : direction === 'out' ? `→ ${edgeType}` : edgeType}
              </span>
              {containsDirection && (
                <span className="node-conn-via-badge">
                  {containsDirection === 'parent'
                    ? t.nodeConnections.parentDirectionBadge
                    : t.nodeConnections.childDirectionBadge}
                </span>
              )}
              {edgeAction && (
                <span className="node-conn-action-text" title={edgeAction}>
                  ⚡ {edgeAction}
                </span>
              )}
              {viaChildName && (
                <span className="node-conn-via-badge" title={t.nodeConnections.viaChildBadge(viaChildName)}>
                  {t.nodeConnections.viaChildBadge(viaChildName)}
                </span>
              )}
            </div>
          </div>

          {/* 3. 우측 빠른 액션: 상대 노드 이동(🎯) & 엣지 편집(✏️) */}
          <div className="node-conn-actions">
            <button
              type="button"
              className="node-conn-action-btn jump"
              title={t.nodeConnections.jumpToNodeTitle(neighborName)}
              onClick={() => handleJumpToNode(neighborNode)}
            >
              {t.nodeConnections.jumpBtn}
            </button>
            <button
              type="button"
              className="node-conn-action-btn edit"
              title={t.nodeConnections.editEdgeTitle}
              onClick={() => handleSelectEdgeForEdit(edge)}
            >
              {t.nodeConnections.editEdgeBtn}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="node-connections-panel">
      {/* 장거리 노드 2-Step 연결 시작 바로가기 */}
      {liveEditNode.data?.properties?.is_global !== 'true' && (
        <div className="node-conn-top-bar">
          <button
            type="button"
            className={`start-connect-mode-btn node-conn-start-btn${pendingConnectSource?.nodeId === liveEditNode.id ? ' active' : ''}`}
            onClick={e => {
              e.preventDefault();
              const targetId = liveEditNode.id;
              if (pendingConnectSource?.nodeId === targetId) {
                setPendingConnectSource(null);
              } else {
                setPendingConnectSource({
                  nodeId: targetId,
                  nodeName: liveEditNode.data?.name,
                  edgeType: getSmartDefaultEdgeType(liveEditNode, undefined),
                });
              }
            }}
          >
            {t.quickConnect.startButton}
          </button>
        </div>
      )}

      {/* 1. 들어오는 연결 (Incoming) */}
      <div className="node-conn-group incoming-group">
        <h4 className="node-conn-group-title incoming">
          {t.nodeConnections.incomingTitle(incoming.length)}
        </h4>
        {incoming.length === 0 ? (
          <p className="inspector-hint node-conn-empty">{t.nodeConnections.emptyIncoming}</p>
        ) : (
          <div className="node-conn-list">
            {incoming.map(item => renderConnectionCard(item, 'in'))}
          </div>
        )}
      </div>

      {/* 2. 나가는 연결 (Outgoing) */}
      <div className="node-conn-group outgoing-group">
        <h4 className="node-conn-group-title outgoing">
          {t.nodeConnections.outgoingTitle(outgoing.length)}
        </h4>
        {outgoing.length === 0 ? (
          <p className="inspector-hint node-conn-empty">{t.nodeConnections.emptyOutgoing}</p>
        ) : (
          <div className="node-conn-list">
            {outgoing.map(item => renderConnectionCard(item, 'out'))}
          </div>
        )}
      </div>

      {/* 3. 선택적 부모·자식 포함(Contains) 간선 토글 */}
      {contains.length > 0 && (
        <div className="node-conn-contains-wrap">
          <button
            type="button"
            className="node-conn-contains-toggle"
            onClick={() => setShowContainsList(prev => !prev)}
          >
            {showContainsList
              ? t.nodeConnections.hideContainsToggle
              : t.nodeConnections.showContainsToggle(contains.length)}
          </button>
          {showContainsList && (
            <div className="node-conn-group contains-group">
              <h4 className="node-conn-group-title contains">
                {t.nodeConnections.containsSectionTitle(contains.length)}
              </h4>
              <div className="node-conn-list">
                {contains.map(item => renderConnectionCard(item, 'contains'))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
