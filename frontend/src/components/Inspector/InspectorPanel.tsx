import React from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { Panel } from '@xyflow/react';
import type { ReactFlowInstance } from '@xyflow/react';
import type { CoverageNode, CoverageEdge, ApiNode, StatusName, ChecklistItem } from '../../types/graph';
import type { EditFormData, PendingConnectSourceState, ActiveImpactItem, RightPanelTab } from '../../types/ui';
import { ViewTab } from './ViewTab';
import { EditNodeForm } from './EditNodeForm';
import { EditEdgeForm } from './EditEdgeForm';
import { GlobalsTab } from './GlobalsTab';
import { t } from '../../locales/koKR';

interface InspectorPanelProps {
  rightPanelTab: RightPanelTab;
  setRightPanelTab: Dispatch<SetStateAction<RightPanelTab>>;
  nodes: CoverageNode[];
  edges: CoverageEdge[];
  nodesRef: MutableRefObject<CoverageNode[]>;
  edgesRef: MutableRefObject<CoverageEdge[]>;
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setEdges: Dispatch<SetStateAction<CoverageEdge[]>>;
  selectedNode: CoverageNode | null;
  selectedEdge: CoverageEdge | null;
  setSelectedNode: Dispatch<SetStateAction<CoverageNode | null>>;
  setSelectedEdge: Dispatch<SetStateAction<CoverageEdge | null>>;
  liveEditNode: CoverageNode | null;
  isCreatingNode: boolean;
  setIsCreatingNode?: Dispatch<SetStateAction<boolean>>;
  editFormData: EditFormData;
  setEditFormData: Dispatch<SetStateAction<EditFormData>>;
  filterText: string;
  setFilterText: (text: string) => void;
  aliases: string[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  visibleTypes: Set<string>;
  setVisibleTypes: Dispatch<SetStateAction<Set<string>>>;
  maxDepth: number;
  setMaxDepth: (depth: number) => void;
  hideUnconnectedEdges?: boolean;
  setHideUnconnectedEdges?: (hide: boolean) => void;
  rfInstance: ReactFlowInstance<CoverageNode, CoverageEdge> | null;
  globalNodesList: ApiNode[];
  activeImpacts: ActiveImpactItem[];
  toggleImpact: (globalNodeId: string, globalNodeName: string) => Promise<void>;
  fetchGlobals: () => Promise<void>;
  triggerRefresh: () => void;
  tracedRootNodeId: string | null;
  setTracedRootNodeId: Dispatch<SetStateAction<string | null>>;
  rootCauseScope: { nodeIds: Set<string>; edgeIds: Set<string>; key: string };
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
  setErrorToast: (msg: string | null) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  rightPanelTab,
  setRightPanelTab,
  nodes,
  edges,
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  selectedNode,
  selectedEdge,
  setSelectedNode,
  setSelectedEdge,
  liveEditNode,
  isCreatingNode,
  setIsCreatingNode,
  editFormData,
  setEditFormData,
  filterText,
  setFilterText,
  aliases,
  searchQuery,
  setSearchQuery,
  visibleTypes,
  setVisibleTypes,
  maxDepth,
  setMaxDepth,
  hideUnconnectedEdges,
  setHideUnconnectedEdges,
  rfInstance,
  globalNodesList,
  activeImpacts,
  toggleImpact,
  fetchGlobals,
  triggerRefresh,
  tracedRootNodeId,
  setTracedRootNodeId,
  rootCauseScope,
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
  setErrorToast,
}) => {
  return (
    <Panel
      position="top-right"
      className="metrics-panel details-panel glass-panel"
      style={{
        pointerEvents: 'none',
        width: '340px',
        maxWidth: '360px',
        margin: '20px',
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        border: '1.5px solid #cbd5e1',
        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
      }}
    >
      <div
        className="nowheel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          overflowY: 'auto',
          flex: 1,
          paddingRight: '4px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '4px',
            backgroundColor: '#f1f5f9',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '16px',
            position: 'sticky',
            top: 0,
            zIndex: 'var(--z-node-badge)',
          }}
        >
          <button
            className={`panel-tab-btn ${rightPanelTab === 'view' ? 'active' : ''}`}
            aria-label="Filters"
            style={{
              flex: 1,
              padding: '8px 12px',
              background: rightPanelTab === 'view' ? '#ffffff' : 'transparent',
              color: rightPanelTab === 'view' ? '#2563eb' : '#64748b',
              border: 'none',
              fontWeight: rightPanelTab === 'view' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              borderRadius: '6px',
            }}
            onClick={() => setRightPanelTab('view')}
          >
            {t.inspector.tabFilters}
          </button>
          <button
            className={`panel-tab-btn ${rightPanelTab === 'edit' ? 'active' : ''}`}
            aria-label="Edit"
            style={{
              flex: 1,
              padding: '8px 12px',
              background: rightPanelTab === 'edit' ? '#ffffff' : 'transparent',
              color: rightPanelTab === 'edit' ? '#2563eb' : '#64748b',
              border: 'none',
              fontWeight: rightPanelTab === 'edit' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              borderRadius: '6px',
            }}
            onClick={() => setRightPanelTab('edit')}
          >
            {t.inspector.tabEdit}
          </button>
          <button
            className={`panel-tab-btn ${rightPanelTab === 'globals' ? 'active' : ''}`}
            aria-label="Globals"
            style={{
              flex: 1,
              padding: '8px 12px',
              background: rightPanelTab === 'globals' ? '#ffffff' : 'transparent',
              color: rightPanelTab === 'globals' ? '#2563eb' : '#64748b',
              border: 'none',
              fontWeight: rightPanelTab === 'globals' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              borderRadius: '6px',
            }}
            onClick={() => setRightPanelTab('globals')}
          >
            {t.inspector.tabGlobals}
          </button>
        </div>

        <div style={{ display: rightPanelTab === 'view' ? 'block' : 'none' }}>
          <ViewTab
            nodes={nodes}
            filterText={filterText}
            setFilterText={setFilterText}
            aliases={aliases}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            visibleTypes={visibleTypes}
            setVisibleTypes={setVisibleTypes}
            maxDepth={maxDepth}
            setMaxDepth={setMaxDepth}
            hideUnconnectedEdges={hideUnconnectedEdges}
            setHideUnconnectedEdges={setHideUnconnectedEdges}
          />
        </div>

        <div style={{ display: rightPanelTab === 'edit' ? 'block' : 'none', flex: 1 }}>
          {selectedNode || selectedEdge || isCreatingNode ? (
            <div style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600 }}>
                {isCreatingNode ? t.inspector.addNodeTitle : t.inspector.editTitle(editFormData.type || '')}
                {!isCreatingNode && (
                  <>
                    <span className="node-id" style={{ display: 'none' }}>{editFormData.id}</span>
                    <span className="node-label" style={{ display: 'none' }}>{editFormData.label}</span>
                  </>
                )}
              </h3>

              {(isCreatingNode || editFormData.type === 'node') && (
                <EditNodeForm
                  isCreatingNode={isCreatingNode}
                  liveEditNode={liveEditNode}
                  editFormData={editFormData}
                  setEditFormData={setEditFormData}
                  nodes={nodes}
                  edges={edges}
                  nodesRef={nodesRef}
                  edgesRef={edgesRef}
                  setNodes={setNodes}
                  setEdges={setEdges}
                  setSelectedNode={setSelectedNode}
                  setSelectedEdge={setSelectedEdge}
                  aliases={aliases}
                  maxDepth={maxDepth}
                  rfInstance={rfInstance}
                  tracedRootNodeId={tracedRootNodeId}
                  setTracedRootNodeId={setTracedRootNodeId}
                  rootCauseScope={rootCauseScope}
                  pinnedFocusNodeId={pinnedFocusNodeId}
                  setPinnedFocusNodeId={setPinnedFocusNodeId}
                  pendingConnectSource={pendingConnectSource}
                  setPendingConnectSource={setPendingConnectSource}
                  blockReasonDraft={blockReasonDraft}
                  setBlockReasonDraft={setBlockReasonDraft}
                  modifiedNoteDraft={modifiedNoteDraft}
                  setModifiedNoteDraft={setModifiedNoteDraft}
                  handleSaveStatus={handleSaveStatus}
                  handleMarkModified={handleMarkModified}
                  handleAcknowledge={handleAcknowledge}
                  handleCloneNode={handleCloneNode}
                  handleDetachFromParent={handleDetachFromParent}
                  saveChecklist={saveChecklist}
                  handleDelete={handleDelete}
                  handleSave={handleSave}
                />
              )}

              {!isCreatingNode && editFormData.type === 'edge' && (
                <EditEdgeForm
                  editFormData={editFormData}
                  setEditFormData={setEditFormData}
                  handleSaveStatus={handleSaveStatus}
                  handleDelete={handleDelete}
                  handleSave={handleSave}
                />
              )}
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              {t.inspector.selectPrompt}
            </div>
          )}
        </div>

        <div style={{ display: rightPanelTab === 'globals' ? 'block' : 'none', flex: 1 }}>
          <GlobalsTab
            globalNodesList={globalNodesList}
            activeImpacts={activeImpacts}
            selectedNode={selectedNode}
            nodesRef={nodesRef}
            setNodes={setNodes}
            setEdges={setEdges}
            setSelectedNode={setSelectedNode}
            setSelectedEdge={setSelectedEdge}
            setEditFormData={setEditFormData}
            setIsCreatingNode={setIsCreatingNode}
            setRightPanelTab={setRightPanelTab}
            toggleImpact={toggleImpact}
            fetchGlobals={fetchGlobals}
            triggerRefresh={triggerRefresh}
            setErrorToast={setErrorToast}
          />
        </div>
      </div>
    </Panel>
  );
};
