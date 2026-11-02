import React, { useState } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { CoverageNode, CoverageEdge, ApiNode } from '../../types/graph';
import type { ActiveImpactItem, EditFormData } from '../../types/ui';
import { api } from '../../api/client';
import { t } from '../../locales/koKR';

interface GlobalsTabProps {
  globalNodesList: ApiNode[];
  activeImpacts: ActiveImpactItem[];
  selectedNode: CoverageNode | null;
  nodesRef: MutableRefObject<CoverageNode[]>;
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setEdges: Dispatch<SetStateAction<CoverageEdge[]>>;
  setSelectedNode: Dispatch<SetStateAction<CoverageNode | null>>;
  setSelectedEdge: Dispatch<SetStateAction<CoverageEdge | null>>;
  setEditFormData?: Dispatch<SetStateAction<EditFormData>>;
  setIsCreatingNode?: Dispatch<SetStateAction<boolean>>;
  setRightPanelTab: Dispatch<SetStateAction<'view' | 'edit' | 'globals'>>;
  toggleImpact: (globalNodeId: string, globalNodeName: string) => Promise<void>;
  fetchGlobals: () => Promise<void>;
  triggerRefresh: () => void;
  setErrorToast: (msg: string | null) => void;
}

/* Impact Overlay Stats Bar (Multi-Global 5-Slot & OR/AND Filter) */
export const GlobalsTab: React.FC<GlobalsTabProps> = ({
  globalNodesList,
  activeImpacts,
  selectedNode,
  nodesRef,
  setNodes,
  setEdges,
  setSelectedNode,
  setSelectedEdge,
  setEditFormData,
  setIsCreatingNode,
  setRightPanelTab,
  toggleImpact,
  fetchGlobals,
  triggerRefresh,
  setErrorToast,
}) => {
  const [newGlobalName, setNewGlobalName] = useState('');

  const handleEditGlobal = async (g: ApiNode) => {
    try {
      let data: ApiNode;
      try {
        data = await api.nodes.fetchNode(g.id);
      } catch {
        data = g;
      }
      const globalNodeObj: CoverageNode = {
        id: data.id || g.id,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: data.label || g.label || 'Component',
          name: data.name || g.name,
          aliases: data.aliases || g.aliases || [],
          test_status: (data.test_status as CoverageNode['data']['test_status']) || 'Untested',
          properties: data.properties || g.properties || {},
          is_global: true,
        },
      };
      setNodes(nds => (nds.some(n => n.selected) ? nds.map(n => (n.selected ? { ...n, selected: false } : n)) : nds));
      setEdges(eds => (eds.some(ed => ed.selected) ? eds.map(ed => (ed.selected ? { ...ed, selected: false } : ed)) : eds));
      setIsCreatingNode?.(false);
      setSelectedEdge(null);
      setSelectedNode(globalNodeObj);
      setEditFormData?.({
        id: globalNodeObj.id,
        label: globalNodeObj.data.label || 'Component',
        name: globalNodeObj.data.name || '',
        aliases: globalNodeObj.data.aliases || [],
        description: data.description || g.description || '',
        test_status: globalNodeObj.data.test_status || 'Untested',
        properties: { ...(globalNodeObj.data.properties || {}), is_global: 'true' },
        type: 'node',
      });
      window.dispatchEvent(new CustomEvent('selectBadgeNode', { detail: globalNodeObj.id }));
      setRightPanelTab('edit');
    } catch (err: unknown) {
      console.error('Failed to open global node for edit', err);
    }
  };

  const handleAttachGlobal = async (g: ApiNode) => {
    if (!selectedNode) return;
    try {
      const newEdgeId = await api.edges.createEdge({
        source: selectedNode.id,
        target: g.id,
        type: 'Depends_On',
        test_status: 'Untested',
        properties: {},
      });

      setNodes(nds =>
        nds.map(n => {
          if (n.id !== selectedNode.id) return n;
          const liveGlobalData = nodesRef.current.find(gn => gn.id === g.id)?.data;
          const mergedGlobalProps: Record<string, unknown> = {
            ...(g.properties || {}),
            ...(liveGlobalData?.properties || {}),
          };
          const newBadges = [
            ...(n.data?.badges || []),
            {
              id: g.id,
              name: g.name,
              label: g.label,
              properties: mergedGlobalProps,
              edgeId: newEdgeId,
              edgeType: 'Depends_On',
              test_status: 'Untested' as const,
            },
          ];
          return { ...n, data: { ...n.data, badges: newBadges } };
        })
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorToast(message || 'Failed to attach global node');
    }
  };

  const handleCreateGlobal = async () => {
    if (!newGlobalName.trim()) return;
    try {
      await api.nodes.createNode({
        label: 'Component',
        name: newGlobalName.trim(),
        aliases: [],
        properties: { is_global: 'true' },
        test_status: 'Untested',
      });
      setNewGlobalName('');
      await fetchGlobals();
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorToast(message || 'Failed to create global node');
    }
  };

  return (
    <div>
      <div style={{ padding: '0 0 16px 0', borderBottom: '1px solid var(--panel-border)', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
          {t.globalNode.panelTitle}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.globalNodes}>?</span>
        </h3>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {t.globalNode.panelGuide}
        </p>
      </div>

      {globalNodesList.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t.globalNode.empty}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {globalNodesList.map(g => {
            const activeImpactItem = activeImpacts.find(item => item.globalNodeId === g.id);
            return (
              <div
                key={g.id}
                style={{
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', width: '100%', minWidth: 0 }}>
                  <span
                    style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.35, wordBreak: 'keep-all', overflowWrap: 'anywhere', flex: 1, minWidth: 0 }}
                    title={g.name}
                  >
                    {g.name}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>{g.label}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', width: '100%' }}>
                  <button
                    type="button"
                    className="global-node-edit-btn"
                    title={t.globalNode.editButtonTitle(g.name)}
                    onClick={() => handleEditGlobal(g)}
                  >
                    {t.globalNode.editButton}
                  </button>
                  <button
                    type="button"
                    className={`impact-toggle-btn${activeImpactItem ? ` active impact-slot-${activeImpactItem.slotIndex}` : ''}`}
                    onClick={() => toggleImpact(g.id, g.name)}
                    title={t.globalNode.impactTooltip(g.name)}
                  >
                    {activeImpactItem && <span className={`impact-slot-dot slot-${activeImpactItem.slotIndex}`} />}
                    {activeImpactItem ? t.globalNode.impactOn : t.globalNode.impactButton}
                  </button>
                  <button
                    className="primary attach-global-btn"
                    disabled={!selectedNode}
                    onClick={() => handleAttachGlobal(g)}
                    title={selectedNode ? t.globalNode.attachTooltip(selectedNode.data?.name || '') : t.globalNode.attachNoSelectionTooltip}
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    {t.globalNode.attach}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--panel-border)' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>{t.globalNode.createNew}</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            id="newGlobalNodeName"
            value={newGlobalName}
            onChange={e => setNewGlobalName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleCreateGlobal();
              }
            }}
            placeholder={t.globalNode.newPlaceholder}
            style={{ flex: 1, padding: '8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--panel-border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}
          />
          <button
            className="primary"
            onClick={handleCreateGlobal}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            {t.common.create}
          </button>
        </div>
      </div>
    </div>
  );
};
