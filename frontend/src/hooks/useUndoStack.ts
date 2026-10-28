import { useRef, useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { CoverageNode, CoverageEdge, StatusName } from '../types/graph';
import type { UndoAction, EditFormData } from '../types/ui';
import { calculateEdgeBundling } from '../utils/edgeBundling';
import { t } from '../locales/koKR';

interface UseUndoStackProps {
  edgesRef: MutableRefObject<CoverageEdge[]>;
  selectedNodeRef: MutableRefObject<CoverageNode | null>;
  selectedEdge: CoverageEdge | null;
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setEdges: Dispatch<SetStateAction<CoverageEdge[]>>;
  setSelectedNode: Dispatch<SetStateAction<CoverageNode | null>>;
  setSelectedEdge: Dispatch<SetStateAction<CoverageEdge | null>>;
  setEditFormData: Dispatch<SetStateAction<EditFormData>>;
  setPinnedFocusNodeId: Dispatch<SetStateAction<string | null>>;
  triggerRefresh: () => void;
  syncStatusesFromServer: () => Promise<void>;
  unparentNodesOnContainsDelete: (deletedContains: CoverageEdge[], remainingEdges: CoverageEdge[]) => void;
  setErrorToast: (msg: string | null) => void;
}

export function useUndoStack({
  edgesRef,
  selectedNodeRef,
  selectedEdge,
  setNodes,
  setEdges,
  setSelectedNode,
  setSelectedEdge,
  setEditFormData,
  setPinnedFocusNodeId,
  triggerRefresh,
  syncStatusesFromServer,
  unparentNodesOnContainsDelete,
  setErrorToast,
}: UseUndoStackProps) {
  // Undo Stack
  const actionHistory = useRef<UndoAction[]>([]);

  const remapUndoStackId = useCallback((
    stack: UndoAction[],
    oldId: string,
    newId: string,
    entityType: 'node' | 'edge'
  ): void => {
    if (!oldId || !newId || oldId === newId) return;

    stack.forEach(action => {
      if (entityType === 'node') {
        if (action.id === oldId) {
          action.id = newId;
        }
        if (action.nodeData && action.nodeData.id === oldId) {
          action.nodeData.id = newId;
        }
        if (Array.isArray(action.nodeIds)) {
          action.nodeIds = action.nodeIds.map((nid: string) => (nid === oldId ? newId : nid));
        }
        if (Array.isArray(action.connectedEdges)) {
          action.connectedEdges.forEach((e: CoverageEdge) => {
            if (e.source === oldId) e.source = newId;
            if (e.target === oldId) e.target = newId;
          });
        }
        if (action.edgeData) {
          if (action.edgeData.source === oldId) action.edgeData.source = newId;
          if (action.edgeData.target === oldId) action.edgeData.target = newId;
        }
      } else if (entityType === 'edge') {
        if (action.id === oldId) {
          action.id = newId;
        }
        if (action.edgeData && action.edgeData.id === oldId) {
          action.edgeData.id = newId;
        }
        if (Array.isArray(action.connectedEdges)) {
          action.connectedEdges.forEach((e: CoverageEdge) => {
            if (e.id === oldId) e.id = newId;
          });
        }
      }
    });
  }, []);

  const pushUndo = useCallback((action: UndoAction) => {
    actionHistory.current.push(action);
    if (actionHistory.current.length > 50) actionHistory.current.shift();
  }, []);

  const handleUndo = useCallback(async () => {
    const action = actionHistory.current.pop();
    if (!action) return;

    try {
      if (action.type === 'CREATE_NODE') {
        const res = await fetch(`/api/nodes/${encodeURIComponent(action.id!)}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to undo node creation');
        }
        setNodes(nds => nds.filter(n => n.id !== action.id));
        setEdges(eds => eds.filter(e => e.source !== action.id && e.target !== action.id));
        if (selectedNodeRef.current?.id === action.id) {
          setSelectedNode(null);
          setEditFormData({});
        }
      } else if (action.type === 'UPDATE_NODE') {
        const res = await fetch(`/api/nodes/${encodeURIComponent(action.id!)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.previousData)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to undo node update');
        }

        const restoredStatus = String(action.previousData?.test_status || 'untested').toLowerCase();
        setNodes(nds => nds.map(n => {
          if (n.id !== action.id) {
            if (Array.isArray(n.data?.badges) && n.data.badges.some(b => b.id === action.id)) {
              const nextBadges = n.data.badges.map(b =>
                b.id === action.id ? { ...b, ...action.previousData } : b
              );
              return { ...n, data: { ...n.data, badges: nextBadges } };
            }
            return n;
          }
          const baseCls = (n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim();
          const nextCls = `${baseCls} status-${restoredStatus}`.trim();
          return {
            ...n,
            className: nextCls,
            data: { ...n.data, ...action.previousData }
          };
        }));

        setSelectedNode(prev => {
          if (!prev || prev.id !== action.id) return prev;
          const baseCls = (prev.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim();
          const nextCls = `${baseCls} status-${restoredStatus}`.trim();
          return {
            ...prev,
            className: nextCls,
            data: { ...prev.data, ...action.previousData }
          };
        });

        // Position doesn't matter for edit panel
        setEditFormData(prev => {
          if (prev.id !== action.id || prev.type !== 'node') return prev;
          return {
            ...prev,
            ...action.previousData,
            status: (action.previousData?.test_status as string) || prev.status,
            aliases: Array.isArray(action.previousData?.aliases)
              ? action.previousData.aliases.join(', ')
              : ((action.previousData?.aliases as string) ?? prev.aliases)
          };
        });
      } else if (action.type === 'DELETE_NODE') {
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.nodeData)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to recreate node during undo');
        }
        const newId = await res.json();
        const oldId = action.id!;

        remapUndoStackId(actionHistory.current, oldId, newId, 'node');

        for (const edge of (action.connectedEdges || [])) {
          const edgePayload = {
            source: edge.source === oldId ? newId : edge.source,
            target: edge.target === oldId ? newId : edge.target,
            type: edge.label || edge.data?.type || 'RELATED',
            action: edge.data?.action,
            test_status: edge.data?.test_status || 'Untested',
            properties: edge.data?.properties || {}
          };
          const eRes = await fetch('/api/edges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edgePayload)
          });
          if (eRes.ok) {
            const newEdgeId = await eRes.json();
            if (edge.id && newEdgeId) {
              remapUndoStackId(actionHistory.current, edge.id, newEdgeId, 'edge');
            }
          }
        }
        // New node needs layout
        triggerRefresh();
      } else if (action.type === 'CREATE_EDGE') {
        const targetEdge = edgesRef.current.find(e => e.id === action.id);
        const eType = String(targetEdge?.data?.type || targetEdge?.label || '').toLowerCase();
        const res = await fetch(`/api/edges/${encodeURIComponent(action.id!)}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to undo edge creation');
        }
        const nextEds = edgesRef.current.filter(e => e.id !== action.id);
        setEdges(nextEds);
        if (targetEdge && (eType === 'contains' || eType === 'has')) {
          unparentNodesOnContainsDelete([targetEdge], nextEds);
        }
        if (selectedEdge?.id === action.id) {
          setSelectedEdge(null);
          setEditFormData({});
        }
      } else if (action.type === 'UPDATE_EDGE') {
        const prevData = action.previousData || action.oldData || {};
        const currentEdge = edgesRef.current.find(e => e.id === action.id);
        const prevType = String(currentEdge?.data?.type || currentEdge?.label || '').toLowerCase();
        const nextType = String(prevData.type || prevType).toLowerCase();
        const wasContains = prevType === 'contains' || prevType === 'has';
        const isNowContains = nextType === 'contains' || nextType === 'has';

        const res = await fetch(`/api/edges/${encodeURIComponent(action.id!)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prevData)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to undo edge update');
        }
        let newId = action.id!;
        try {
          const data = await res.json();
          if (data?.new_id) newId = data.new_id;
        } catch {
          // Gracefully keep previous ID if no new_id is returned
        }

        if (newId !== action.id) {
          remapUndoStackId(actionHistory.current, action.id!, newId, 'edge');
        }

        const restoredEdgeStatus = String(prevData.test_status || currentEdge?.data?.test_status || 'untested').toLowerCase();
        const nextEds = edgesRef.current.map(e => {
          if (e.id !== action.id) return e;
          const baseCls = (e.className || '').replace(/\b(edge-contains|status-[a-z-]+)\b/g, '').trim();
          const statusCls = `status-${restoredEdgeStatus}`;
          const nextCls = `${baseCls} ${statusCls}${isNowContains ? ' edge-contains' : ''}`.trim();
          return {
            ...e,
            id: newId,
            label: (prevData.type as string) || e.label,
            className: nextCls || undefined,
            data: {
              ...e.data,
              ...prevData,
              test_status: ((prevData.test_status as StatusName) || e.data?.test_status || 'Untested'),
            }
          };
        });
        setEdges(nextEds);
        if (currentEdge && wasContains && !isNowContains) {
          unparentNodesOnContainsDelete([currentEdge], nextEds);
        }
        if (!wasContains && isNowContains) {
          triggerRefresh();
        }
      } else if (action.type === 'DELETE_EDGE') {
        const res = await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.edgeData)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to recreate edge during undo');
        }
        const newEdgeId = await res.json();
        const oldEdgeId = action.id!;
        remapUndoStackId(actionHistory.current, oldEdgeId, newEdgeId, 'edge');

        const eType = String(action.edgeData?.type || '').toLowerCase();
        const isContains = eType === 'contains' || eType === 'has';
        const restoredStatusCls = `status-${String(action.edgeData?.test_status || 'untested').toLowerCase()}`;
        setEdges(eds => calculateEdgeBundling([...eds, {
          id: newEdgeId,
          source: (action.edgeData?.source as string) || '',
          target: (action.edgeData?.target as string) || '',
          label: (action.edgeData?.type as string) || '',
          type: 'floating',
          className: isContains ? `edge-contains ${restoredStatusCls}` : restoredStatusCls,
          data: { test_status: 'Untested', ...action.edgeData },
          style: { strokeWidth: 2 },
        }]));
        if (isContains) {
          setNodes(nds => nds.map(n => {
            if (n.id === action.edgeData?.target) {
              return { ...n, parentId: action.edgeData?.source as string, extent: 'parent' as const };
            }
            if (n.id === action.edgeData?.source) {
              return { ...n, data: { ...n.data, hasChildren: true } };
            }
            return n;
          }).sort((a, b) => (a.parentId && !b.parentId ? 1 : (!a.parentId && b.parentId ? -1 : 0))));
          setSelectedNode(prev => prev && prev.id === action.edgeData?.target ? { ...prev, parentId: action.edgeData?.source as string, extent: 'parent' as const } : prev);
          triggerRefresh();
        }
      } else if (action.type === 'CLONE_SUBGRAPH') {
        const nodeIds: string[] = Array.isArray(action.nodeIds) ? action.nodeIds : (Array.isArray(action.createdNodeIds) ? action.createdNodeIds : []);
        for (const nid of nodeIds) {
          const res = await fetch(`/api/nodes/${encodeURIComponent(nid)}`, { method: 'DELETE' });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Failed to undo cloned node ${nid}`);
          }
        }
        const deletedSet = new Set(nodeIds);
        setNodes(nds => nds.filter(n => !deletedSet.has(n.id)));
        setEdges(eds => eds.filter(e => !deletedSet.has(e.source) && !deletedSet.has(e.target)));
        if (selectedNodeRef.current && deletedSet.has(selectedNodeRef.current.id)) {
          selectedNodeRef.current = null;
          setSelectedNode(null);
        }
        setSelectedEdge(prev => (prev && (deletedSet.has(prev.source) || deletedSet.has(prev.target)) ? null : prev));
        setPinnedFocusNodeId(prev => (prev && deletedSet.has(prev) ? null : prev));
        triggerRefresh();
      }
      await syncStatusesFromServer();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Undo execution failed:', message);
      actionHistory.current.push(action);
      setErrorToast(message || t.error.unknown);
    }
  }, [
    triggerRefresh,
    setNodes,
    setEdges,
    setSelectedNode,
    setSelectedEdge,
    setEditFormData,
    setPinnedFocusNodeId,
    syncStatusesFromServer,
    unparentNodesOnContainsDelete,
    selectedEdge,
    setErrorToast,
    edgesRef,
    selectedNodeRef,
    remapUndoStackId,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Only undo if not typing in an input
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  return {
    actionHistory,
    pushUndo,
    handleUndo,
    remapUndoStackId,
  };
}
