import React, { useState } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import type { CoverageNode, CoverageEdge, StatusName, ChecklistItem } from '../../types/graph';
import type { EditFormData, PendingConnectSourceState } from '../../types/ui';
import { isOverridden } from '../../statusPropagation';
import { getSmartDefaultEdgeType, computeContentFocusScope } from '../../utils/graphScopes';
import { ChecklistSection } from './ChecklistSection';
import { t } from '../../locales/koKR';

interface EditNodeFormProps {
  isCreatingNode: boolean;
  liveEditNode: CoverageNode | null;
  editFormData: EditFormData;
  setEditFormData: Dispatch<SetStateAction<EditFormData>>;
  nodes: CoverageNode[];
  edges: CoverageEdge[];
  nodesRef: MutableRefObject<CoverageNode[]>;
  edgesRef: MutableRefObject<CoverageEdge[]>;
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setEdges: Dispatch<SetStateAction<CoverageEdge[]>>;
  setSelectedNode: Dispatch<SetStateAction<CoverageNode | null>>;
  setSelectedEdge: Dispatch<SetStateAction<CoverageEdge | null>>;
  aliases: string[];
  maxDepth: number;
  rfInstance: ReactFlowInstance<CoverageNode, CoverageEdge> | null;
  tracedRootNodeId: string | null;
  setTracedRootNodeId: Dispatch<SetStateAction<string | null>>;
  rootCauseScope: { nodeIds: Set<string>; edgeIds: Set<string>; key: string };
  scopedAuditRootId: string | null;
  setScopedAuditRootId: Dispatch<SetStateAction<string | null>>;
  scopedAuditScope: { nodeIds: Set<string>; edgeIds: Set<string>; totalInScope: number; matchedCount: number; key: string };
  pinnedFocusNodeId: string | null;
  setPinnedFocusNodeId: Dispatch<SetStateAction<string | null>>;
  pendingConnectSource: PendingConnectSourceState | null;
  setPendingConnectSource: Dispatch<SetStateAction<PendingConnectSourceState | null>>;
  blockReasonDraft: string | null;
  setBlockReasonDraft: Dispatch<SetStateAction<string | null>>;
  modifiedNoteDraft: string;
  setModifiedNoteDraft: (note: string) => void;
  handleSaveStatus: (status: StatusName, overrideOptions?: { reason?: string }) => Promise<void>;
  handleMarkModified: (nodeId?: string) => Promise<void>;
  handleAcknowledge: (nodeId?: string) => Promise<void>;
  handleCloneNode: (nodeId?: string, tag?: string) => Promise<void>;
  handleDetachFromParent: (containsEdge: CoverageEdge) => Promise<void>;
  saveChecklist: (items: ChecklistItem[]) => Promise<void>;
  handleDelete: () => Promise<void>;
  handleSave: () => Promise<void>;
}

export const EditNodeForm: React.FC<EditNodeFormProps> = ({
  isCreatingNode,
  liveEditNode,
  editFormData,
  setEditFormData,
  nodes,
  edges,
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  setSelectedNode,
  setSelectedEdge,
  aliases,
  maxDepth,
  rfInstance,
  tracedRootNodeId,
  setTracedRootNodeId,
  rootCauseScope,
  scopedAuditRootId,
  setScopedAuditRootId,
  scopedAuditScope,
  pinnedFocusNodeId,
  setPinnedFocusNodeId,
  pendingConnectSource,
  setPendingConnectSource,
  blockReasonDraft,
  setBlockReasonDraft,
  modifiedNoteDraft,
  setModifiedNoteDraft,
  handleSaveStatus,
  handleMarkModified,
  handleAcknowledge,
  handleCloneNode,
  handleDetachFromParent,
  saveChecklist,
  handleDelete,
  handleSave,
}) => {
  const [showCloneBox, setShowCloneBox] = useState(false);
  const [cloneTagDraft, setCloneTagDraft] = useState('');
  const [isCloningNode, setIsCloningNode] = useState(false);

  // Inspector에서 편집 중인 노드의 "최신" 객체 (selectedNode는 선택 시점 스냅샷이라 전파/체크리스트 반영이 늦을 수 있음)
  const isCurrentlyGlobal = editFormData.properties?.is_global === 'true';
  const isGlobalAllowed = ['Component', 'Data', 'TestCase'].includes(editFormData.label || '');
  const canToggleGlobal = isGlobalAllowed || isCurrentlyGlobal;

  const containsEdge = !isCreatingNode && liveEditNode
    ? edges.find(e => {
        const et = String(e.data?.type || e.label || '').toLowerCase();
        return e.target === liveEditNode.id && (et === 'contains' || et === 'has');
      })
    : undefined;

  const parentId = liveEditNode?.parentId || containsEdge?.source;
  const parentNode = parentId ? nodes.find(n => n.id === parentId) : undefined;
  const parentName = parentNode?.data?.name || parentId || '';

  const liveNodeProperties = liveEditNode?.data?.properties || {};
  const isNodeModified = liveNodeProperties.is_modified === true || liveNodeProperties.is_modified === 'true';

  const onConfirmClone = async () => {
    try {
      setIsCloningNode(true);
      await handleCloneNode(editFormData.id, cloneTagDraft);
      setShowCloneBox(false);
      setCloneTagDraft('');
    } finally {
      setIsCloningNode(false);
    }
  };

  return (
    <>
      <div className="form-group">
        <label htmlFor="nodeLabel" className="form-label">
          {t.inspector.label}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.nodeLabel}>?</span>
        </label>
        <select
          id="nodeLabel"
          value={editFormData.label || 'Node'}
          onChange={e => setEditFormData({ ...editFormData, label: e.target.value })}
        >
          <option value="Feature">{t.nodeLabel.Feature}</option>
          <option value="Screen">{t.nodeLabel.Screen}</option>
          <option value="Content">{t.nodeLabel.Content}</option>
          <option value="System">{t.nodeLabel.System}</option>
          <option value="Component">{t.nodeLabel.Component}</option>
          <option value="Data">{t.nodeLabel.Data}</option>
          <option value="TestCase">{t.nodeLabel.TestCase}</option>
          <option value="Node">{t.nodeLabel.Node}</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="nodeName" className="form-label">
          {t.inspector.name}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.nodeName}>?</span>
        </label>
        <input
          id="nodeName"
          type="text"
          value={editFormData.name || ''}
          onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label htmlFor="nodeCategory" className="form-label">
          {t.inspector.nodeCategory}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.nodeCategory}>?</span>
        </label>
        <input
          id="nodeCategory"
          type="text"
          list="category-aliases"
          autoComplete="off"
          value={Array.isArray(editFormData.aliases) ? editFormData.aliases.join(', ') : (editFormData.aliases || '')}
          onChange={e => {
            setEditFormData({ ...editFormData, aliases: e.target.value });
          }}
        />
        <datalist id="category-aliases">
          {aliases.map(a => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>

      <div className="form-group">
        <label htmlFor="nodeDomain" className="form-label">
          {t.domain.fieldLabel}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.nodeDomain}>?</span>
        </label>
        <input
          id="nodeDomain"
          type="text"
          list="domain-presets"
          autoComplete="off"
          placeholder={t.domain.fieldPlaceholder}
          value={String(editFormData.properties?.domain || '')}
          onChange={e => {
            const newProps = { ...(editFormData.properties || {}), domain: e.target.value };
            setEditFormData({ ...editFormData, properties: newProps });
          }}
        />
        <datalist id="domain-presets">
          {(['Battle', 'Growth', 'Economy', 'Social', 'System'] as const).map(key => (
            <option key={key} value={key}>{t.domain.presets[key]}</option>
          ))}
        </datalist>
        <div className="domain-preset-pills">
          {(['Battle', 'Growth', 'Economy', 'Social', 'System'] as const).map(key => {
            const isSelected = String(editFormData.properties?.domain || '') === key;
            return (
              <button
                key={key}
                type="button"
                className={`domain-preset-pill domain-tone-${key.toLowerCase()}${isSelected ? ' active' : ''}`}
                onClick={() => {
                  const nextVal = isSelected ? '' : key;
                  const newProps = { ...(editFormData.properties || {}), domain: nextVal };
                  setEditFormData({ ...editFormData, properties: newProps });
                }}
              >
                {t.domain.presets[key]}
              </button>
            );
          })}
        </div>
      </div>

      {!isCreatingNode && liveEditNode && parentId && (
        <div className="form-group parent-relation-box">
          <div className="parent-relation-label" title={parentName}>
            {t.nodeForm.parentLabel(parentName)}
          </div>
          {containsEdge && (
            <div className="parent-relation-actions">
              <button
                type="button"
                className="parent-relation-btn"
                title={t.nodeForm.changeRelationTitle}
                onClick={() => {
                  setNodes(nds => (nds.some(n => n.selected) ? nds.map(n => (n.selected ? { ...n, selected: false } : n)) : nds));
                  setEdges(eds =>
                    eds.map(e =>
                      e.id === containsEdge.id ? { ...e, selected: true } : e.selected ? { ...e, selected: false } : e
                    )
                  );
                  setSelectedNode(null);
                  setSelectedEdge(containsEdge);
                }}
              >
                {t.nodeForm.changeRelation}
              </button>
              <button
                type="button"
                className="parent-relation-btn detach"
                title={t.nodeForm.detachParentTitle}
                onClick={() => handleDetachFromParent(containsEdge)}
              >
                {t.nodeForm.detachParent}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Extract description and issue_link to top-level for the backend, while preserving is_global in properties */}
      <div className="form-group" style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', opacity: canToggleGlobal ? 1 : 0.5 }}>
          <input
            type="checkbox"
            id="nodeIsGlobal"
            disabled={!canToggleGlobal}
            checked={isCurrentlyGlobal}
            onChange={e => {
              const newProps = { ...(editFormData.properties || {}), is_global: e.target.checked ? 'true' : 'false' };
              setEditFormData({ ...editFormData, properties: newProps });
            }}
            style={{ cursor: canToggleGlobal ? 'pointer' : 'not-allowed', width: '16px', height: '16px' }}
          />
          <label htmlFor="nodeIsGlobal" className="form-label" style={{ marginBottom: 0, cursor: canToggleGlobal ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
            {t.globalNode.title}
            <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.globalNode}>?</span>
          </label>
        </div>
        {!isGlobalAllowed && !isCurrentlyGlobal && (
          <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#dc2626', fontWeight: 500 }}>
            {t.globalNode.notAllowed}
          </p>
        )}
        {isCurrentlyGlobal && (
          <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#0369a1', fontWeight: 500 }}>
            {t.globalNode.uncheckHint}
          </p>
        )}
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
          {t.globalNode.hintBefore}<strong>{t.globalNode.hintBadge}</strong>{t.globalNode.hintAfter}
          {t.globalNode.hintUsage}
          {t.globalNode.hintClick}
        </p>

        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem', color: '#1e293b' }}>{t.nodeForm.issueLink}</label>
            <textarea 
              rows={3}
              value={(editFormData.properties?.issue_link as string) || ''} 
              onChange={e => {
                const newProps = { ...(editFormData.properties || {}), issue_link: e.target.value };
                setEditFormData({ ...editFormData, properties: newProps });
              }}
              placeholder="https://jira...&#10;https://github..."
              style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', resize: 'vertical' }}
            />
          </div>
        </div>
      </div>

      {/* 상태는 폼에 열어둔 값이 아니라 "현재 노드의 실제 상태"를 사용합니다. */}
      {/* (폼을 연 뒤 연쇄 전파로 Blocked 등이 된 경우, 이름만 고쳐 저장해도 전파 결과를 덮어쓰지 않도록) */}
      {/* 기존 시스템 속성(checklist / 📌 고정 / 변경 표시 / is_global 등)은 로컬 state에서도 그대로 보존합니다. */}
      {/* (백엔드는 properties를 병합(n += $properties)하므로 서버 쪽 값도 유지됨) */}
      <div className="form-group">
        <label className="form-label">
          {t.inspector.status}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.status}>?</span>
        </label>
        <div style={{ display: 'flex', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
          <button className="success" onClick={(e) => { e.preventDefault(); handleSaveStatus('Passed'); }}>
            {t.inspector.markPassed}
          </button>
          <button className="danger" onClick={(e) => { e.preventDefault(); handleSaveStatus('Failed'); }}>
            {t.inspector.markFailed}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); handleSaveStatus('Untested'); }}
            style={{ border: '1.5px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155' }}
          >
            {t.inspector.resetStatus}
          </button>
          {/* B. 수동 차단(📌 Manual Override): 노드에서만 제공, 사유 필수 */}
          {!isCreatingNode && (
            <button
              className="warning"
              onClick={(e) => { e.preventDefault(); setBlockReasonDraft(prev => (prev === null ? '' : null)); }}
            >
              {t.inspector.markBlocked}
            </button>
          )}
          {/* 결함 원인 역추적(Root Cause Tracing, AI_IMPLEMENTATION_SPEC 3.3): Failed 또는 Blocked 노드에서 활성 */}
          {!isCreatingNode && (liveEditNode?.data?.test_status === 'Blocked' || liveEditNode?.data?.test_status === 'Failed') && (
            <button
              type="button"
              className={`trace-root-cause-btn${tracedRootNodeId === editFormData.id ? ' active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                setTracedRootNodeId(prev => (prev === editFormData.id ? null : (editFormData.id || null)));
              }}
            >
              {tracedRootNodeId === editFormData.id ? t.rootCause.clearButton : t.rootCause.traceButton}
            </button>
          )}
          {/* 화면(Screen/Container) 단위 다국어 스코프 감사 (CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 4.1) */}
          {!isCreatingNode && (liveEditNode?.data?.label === 'Screen' || Boolean(liveEditNode?.data?.hasChildren)) && (
            <button
              type="button"
              className={`scoped-audit-btn${scopedAuditRootId === editFormData.id ? ' active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                const targetId = editFormData.id;
                const nextId = scopedAuditRootId === targetId ? null : (targetId || null);
                if (nextId && liveEditNode?.data?.isCollapsed) {
                  window.dispatchEvent(new CustomEvent('toggleCollapseNode', { detail: targetId }));
                }
                setScopedAuditRootId(nextId);
                if (nextId) {
                  fetch(`/api/qa/audit-cross-cutting?aspect=Localization&scope_root_id=${encodeURIComponent(nextId)}`).catch(() => {});
                }
              }}
            >
              {scopedAuditRootId === editFormData.id ? t.scopedAudit.clearButton : t.scopedAudit.startButton}
            </button>
          )}
          {/* 특정 콘텐츠 포커스 고정 (Content Focus Pinning) */}
          {!isCreatingNode && (
            <button
              type="button"
              className={`pin-focus-btn${pinnedFocusNodeId === editFormData.id ? ' active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                const targetId = editFormData.id;
                const nextId = pinnedFocusNodeId === targetId ? null : (targetId || null);
                setPinnedFocusNodeId(nextId);
                if (nextId && rfInstance) {
                  const scope = computeContentFocusScope([nextId], nodesRef.current, edgesRef.current, maxDepth);
                  const focusNodes = nodesRef.current.filter(n => !n.hidden && scope.activeNodes.has(n.id));
                  if (focusNodes.length > 0) {
                    rfInstance.fitView({ nodes: focusNodes, padding: 0.25, duration: 500 });
                  }
                }
              }}
            >
              {pinnedFocusNodeId === editFormData.id ? t.contentFocus.unpinButton : t.contentFocus.pinButton}
            </button>
          )}
          {/* 장거리 노드 2-Step 클릭 연결 시작 버튼 (Pattern B) */}
          {!isCreatingNode && liveEditNode?.data?.properties?.is_global !== 'true' && (
            <button
              type="button"
              className={`start-connect-mode-btn${pendingConnectSource?.nodeId === editFormData.id ? ' active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                const targetId = editFormData.id;
                if (!targetId) return;
                if (pendingConnectSource?.nodeId === targetId) {
                  setPendingConnectSource(null);
                } else {
                  const srcNode = nodesRef.current.find(n => n.id === targetId);
                  setPendingConnectSource({
                    nodeId: targetId,
                    nodeName: srcNode?.data?.name,
                    edgeType: getSmartDefaultEdgeType(srcNode, undefined),
                  });
                }
              }}
            >
              {t.quickConnect.startButton}
            </button>
          )}
        </div>

        {!isCreatingNode && tracedRootNodeId === editFormData.id && (
          <div className="root-cause-banner">
            {t.rootCause.banner(rootCauseScope.nodeIds.size)}
          </div>
        )}
        {!isCreatingNode && scopedAuditRootId === editFormData.id && (
          <div className="scoped-audit-banner">
            {t.scopedAudit.banner(scopedAuditScope.matchedCount, scopedAuditScope.totalInScope)}
          </div>
        )}
        {!isCreatingNode && blockReasonDraft !== null && (
          <div className="override-reason-box">
            <input
              type="text"
              autoFocus
              aria-label={t.override.reasonLabel}
              placeholder={t.override.reasonPlaceholder}
              value={blockReasonDraft}
              onChange={e => setBlockReasonDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && blockReasonDraft.trim()) {
                  handleSaveStatus('Blocked', { reason: blockReasonDraft.trim() });
                  setBlockReasonDraft(null);
                }
              }}
            />
            <div className="override-reason-actions">
              <button
                className="warning"
                disabled={!blockReasonDraft.trim()}
                onClick={(e) => {
                  e.preventDefault();
                  if (!blockReasonDraft.trim()) return;
                  handleSaveStatus('Blocked', { reason: blockReasonDraft.trim() });
                  setBlockReasonDraft(null);
                }}
              >
                {t.override.confirm}
              </button>
              <button onClick={(e) => { e.preventDefault(); setBlockReasonDraft(null); }}>
                {t.override.cancel}
              </button>
            </div>
            <p className="inspector-hint">{t.override.hint}</p>
          </div>
        )}
        {!isCreatingNode && isOverridden(liveEditNode ?? undefined) && (
          <div className="override-pin-banner">
            📌 {t.override.pinnedLabel}: {liveEditNode?.data?.properties?.override_reason || t.override.noReason}
            <div className="inspector-hint">{t.override.releaseHint}</div>
          </div>
        )}
      </div>

      {/* C. B안 노드 내부 체크리스트 (TESTCASE 스펙 3.3) */}
      {!isCreatingNode && liveEditNode && (
        <ChecklistSection
          liveEditNode={liveEditNode}
          saveChecklist={saveChecklist}
        />
      )}

      {/* D. 변경 영향도 강조 (Change Impact Ripple, AI_IMPLEMENTATION_SPEC 4.4) */}
      {!isCreatingNode && liveEditNode && (
        <div className="form-group modified-section">
          <h4 className="inspector-section-title">{t.modified.sectionTitle}</h4>
          {isNodeModified ? (
            <div className="modified-banner">
              <div className="modified-banner-title">
                ⚠️ {t.modified.bannerTitle}: {liveNodeProperties.modified_note || t.modified.noNote}
              </div>
              {liveNodeProperties.modified_at && (
                <div className="inspector-hint">
                  {t.modified.modifiedAt} {new Date(liveNodeProperties.modified_at).toLocaleString()}
                </div>
              )}
              <button className="success" onClick={(e) => { e.preventDefault(); handleAcknowledge(editFormData.id); }}>
                {t.modified.acknowledge}
              </button>
            </div>
          ) : (
            <div className="modified-mark-row">
              <input
                type="text"
                aria-label={t.modified.noteLabel}
                placeholder={t.modified.notePlaceholder}
                value={modifiedNoteDraft}
                onChange={e => setModifiedNoteDraft(e.target.value)}
              />
              <button onClick={(e) => { e.preventDefault(); handleMarkModified(editFormData.id); }}>
                {t.modified.markButton}
              </button>
            </div>
          )}
          <p className="inspector-hint">{t.modified.hint}</p>
        </div>
      )}

      {!isCreatingNode && (
        <div className="node-clone-section">
          <button
            type="button"
            className={`node-clone-open-btn${showCloneBox ? ' active' : ''}`}
            onClick={() => setShowCloneBox(prev => !prev)}
          >
            {t.nodeClone.openButton}
          </button>
          {showCloneBox && (
            <div className="node-clone-box">
              <p className="inspector-hint" style={{ marginTop: 0, marginBottom: '8px' }}>
                {t.nodeClone.guide}
              </p>
              <input
                type="text"
                autoFocus
                disabled={isCloningNode}
                className="node-clone-tag-input"
                aria-label={t.nodeClone.tagLabel}
                placeholder={t.nodeClone.tagPlaceholder}
                value={cloneTagDraft}
                onChange={e => setCloneTagDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    onConfirmClone();
                  }
                }}
              />
              <div className="node-clone-actions">
                <button
                  type="button"
                  disabled={isCloningNode}
                  className="primary node-clone-confirm-btn"
                  onClick={onConfirmClone}
                >
                  {t.nodeClone.confirmButton}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCloneBox(false);
                    setCloneTagDraft('');
                  }}
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Don't triggerRefresh for normal edits — local state is already updated */}
      {/* triggerRefresh would re-run dagre layout and reset all dragged positions */}
      {/* UPDATE_NODE Undo 스냅샷 (체크리스트/변경 표시 등 properties 변경 전 상태 보관) */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button className="danger" style={{ flex: 1 }} onClick={handleDelete}>
          {t.common.delete}
        </button>
        <button className="primary" style={{ flex: 1 }} onClick={handleSave}>
          {t.common.save}
        </button>
      </div>

      {/* (Node Raw Inspector 디버그 패널은 FEATURE_PRUNING_GUIDE 1순위 정리 대상으로 제거됨) */}
    </>
  );
};
