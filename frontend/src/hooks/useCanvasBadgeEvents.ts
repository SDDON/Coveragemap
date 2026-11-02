import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { CoverageNode, CoverageEdge, StatusName, EditFormData, RightPanelTab } from '../types';
import { api } from '../api/client';

export interface UseCanvasBadgeEventsProps {
  nodesRef: MutableRefObject<CoverageNode[]>;
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setEdges: Dispatch<SetStateAction<CoverageEdge[]>>;
  selectedNode: CoverageNode | null;
  setSelectedNode: Dispatch<SetStateAction<CoverageNode | null>>;
  setSelectedEdge: Dispatch<SetStateAction<CoverageEdge | null>>;
  persist: (url: string, init: RequestInit) => Promise<Response>;
  executeMutation: (args: {
    actionName: string;
    optimisticUpdate?: () => void;
    apiCall: () => Promise<Response>;
    skipStatusSync?: boolean;
    onSuccess?: (data: unknown) => void | Promise<void>;
  }) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  setEditFormData?: Dispatch<SetStateAction<EditFormData>>;
  setRightPanelTab?: Dispatch<SetStateAction<RightPanelTab>>;
  setIsCreatingNode?: Dispatch<SetStateAction<boolean>>;
}

export function useCanvasBadgeEvents({
  setNodes,
  setEdges,
  selectedNode,
  setSelectedNode,
  setSelectedEdge,
  persist,
  executeMutation,
  setEditFormData,
  setRightPanelTab,
  setIsCreatingNode,
}: UseCanvasBadgeEventsProps) {
  const [hoveredGlobalBadgeId, setHoveredGlobalBadgeId] = useState<string | null>(null);

  useEffect(() => {
    const isGlobalSelected = selectedNode?.data?.properties?.is_global === 'true';
    if (!isGlobalSelected) {
      // selectedNode가 해제되거나 일반 노드로 바뀌면 배지 필의 선택 상태(selectedBadgeId)도 즉시 해제
      window.dispatchEvent(new CustomEvent('selectBadgeNode', { detail: null }));
    }
  }, [selectedNode]);

  useEffect(() => {
    const handleBadgeSelect = async (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      const nodeId = customEvent.detail;
      if (!nodeId) return;
      try {
        const data = await api.nodes.fetchNode(nodeId);
        const globalNode: CoverageNode = {
          id: data.id,
          type: 'custom',
          position: { x: 0, y: 0 },
          data: { ...data, test_status: (data.test_status as StatusName) || 'Untested' },
        };
        setNodes(nds => (nds.some(n => n.selected) ? nds.map(n => (n.selected ? { ...n, selected: false } : n)) : nds));
        setEdges(eds => (eds.some(ed => ed.selected) ? eds.map(ed => (ed.selected ? { ...ed, selected: false } : ed)) : eds));
        setSelectedEdge(null);
        setSelectedNode(globalNode);
        if (setEditFormData) {
          setEditFormData({
            id: data.id,
            label: data.label || 'Node',
            name: data.name || '',
            aliases: data.aliases || [],
            description: data.description || '',
            test_status: (data.test_status as StatusName) || 'Untested',
            properties: { ...(data.properties || {}) },
            type: 'node',
          });
        }
        if (setIsCreatingNode) {
          setIsCreatingNode(false);
        }
        if (setRightPanelTab) {
          setRightPanelTab('edit');
        }
      } catch {
        // Ignore fetch failure
      }
    };

    const handleMarkBadgeStatus = async (e: Event) => {
      const customEvent = e as CustomEvent<{ edgeId: string; status: StatusName }>;
      const { edgeId, status } = customEvent.detail;
      if (!edgeId) return;
      await executeMutation({
        actionName: 'mark badge status',
        optimisticUpdate: () => {
          setEdges(eds => eds.map(edge => (edge.id === edgeId ? { ...edge, data: { ...edge.data, test_status: status } } : edge)));
          setNodes(nds => nds.map(n => {
            if (!n.data?.badges) return n;
            let changed = false;
            const newBadges = n.data.badges.map(b => {
              if (b.edgeId === edgeId && b.test_status !== status) {
                changed = true;
                return { ...b, test_status: status };
              }
              return b;
            });
            return changed ? { ...n, data: { ...n.data, badges: newBadges } } : n;
          }));
        },
        apiCall: () => persist(`/api/edges/${encodeURIComponent(edgeId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test_status: status }),
        }),
      });
    };

    const handleToggleCollapse = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const targetId = customEvent.detail;
      setNodes(nds => {
        const parentNode = nds.find(n => n.id === targetId);
        const isCollapsed = !parentNode?.data?.isCollapsed;
        const children = nds.filter(n => n.parentId === targetId);
        const childSummary = {
          total: children.length,
          passed: children.filter(c => c.data?.test_status === 'Passed').length,
          failed: children.filter(c => c.data?.test_status === 'Failed').length,
          blocked: children.filter(c => c.data?.test_status === 'Blocked').length,
        };
        return nds.map(n => {
          if (n.id === targetId) {
            const expandedStyle = n.data?.expandedStyle || n.style;
            const nextStyle = isCollapsed ? { ...n.style, width: 280, height: 'auto', minHeight: 110 } : expandedStyle;
            return { ...n, style: nextStyle, data: { ...n.data, isCollapsed, childSummary, expandedStyle } };
          }
          if (n.parentId === targetId) return { ...n, hidden: isCollapsed };
          return n;
        });
      });
    };

    const handleToggleCollapseAll = (e: Event) => {
      const customEvent = e as CustomEvent<{ collapsed?: boolean } | undefined>;
      setNodes(nds => {
        const parentNodes = nds.filter(n => n.data?.hasChildren);
        if (parentNodes.length === 0) return nds;
        const shouldCollapse =
          typeof customEvent.detail?.collapsed === 'boolean'
            ? customEvent.detail.collapsed
            : !parentNodes.every(p => p.data?.isCollapsed);
        const parentIds = new Set(parentNodes.map(p => p.id));
        return nds.map(n => {
          if (parentIds.has(n.id)) {
            const children = nds.filter(c => c.parentId === n.id);
            const childSummary = {
              total: children.length,
              passed: children.filter(c => c.data?.test_status === 'Passed').length,
              failed: children.filter(c => c.data?.test_status === 'Failed').length,
              blocked: children.filter(c => c.data?.test_status === 'Blocked').length,
            };
            const expandedStyle = n.data?.expandedStyle || n.style;
            const nextStyle = shouldCollapse
              ? { ...n.style, width: 280, height: 'auto', minHeight: 110 }
              : expandedStyle;
            return {
              ...n,
              style: nextStyle,
              data: { ...n.data, isCollapsed: shouldCollapse, childSummary, expandedStyle },
            };
          }
          if (n.parentId && parentIds.has(n.parentId)) {
            return { ...n, hidden: shouldCollapse };
          }
          return n;
        });
      });
    };

    const handleDeleteBadge = async (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeId: string; edgeId: string }>;
      const { edgeId } = customEvent.detail;
      if (!edgeId) return;
      await executeMutation({
        actionName: 'delete badge',
        optimisticUpdate: () => {
          setEdges(eds => eds.filter(edge => edge.id !== edgeId));
          setNodes(nds => nds.map(n => {
            if (!n.data?.badges) return n;
            const newBadges = n.data.badges.filter(b => b.edgeId !== edgeId);
            return newBadges.length !== n.data.badges.length ? { ...n, data: { ...n.data, badges: newBadges } } : n;
          }));
        },
        apiCall: () => persist(`/api/edges/${encodeURIComponent(edgeId)}`, {
          method: 'DELETE',
        }),
      });
    };

    const handleHoverGlobal = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setHoveredGlobalBadgeId(customEvent.detail);
    };
    const handleUnhoverGlobal = () => setHoveredGlobalBadgeId(null);

    window.addEventListener('selectBadgeNode', handleBadgeSelect);
    window.addEventListener('markBadgeStatus', handleMarkBadgeStatus);
    window.addEventListener('toggleCollapseNode', handleToggleCollapse);
    window.addEventListener('toggleCollapseAllNodes', handleToggleCollapseAll);
    window.addEventListener('deleteBadge', handleDeleteBadge);
    window.addEventListener('hoverGlobalBadge', handleHoverGlobal);
    window.addEventListener('unhoverGlobalBadge', handleUnhoverGlobal);
    return () => {
      window.removeEventListener('selectBadgeNode', handleBadgeSelect);
      window.removeEventListener('markBadgeStatus', handleMarkBadgeStatus);
      window.removeEventListener('toggleCollapseNode', handleToggleCollapse);
      window.removeEventListener('toggleCollapseAllNodes', handleToggleCollapseAll);
      window.removeEventListener('deleteBadge', handleDeleteBadge);
      window.removeEventListener('hoverGlobalBadge', handleHoverGlobal);
      window.removeEventListener('unhoverGlobalBadge', handleUnhoverGlobal);
    };
  }, [executeMutation, persist, setNodes, setEdges, setSelectedNode, setSelectedEdge, setEditFormData, setRightPanelTab, setIsCreatingNode]);

  return {
    hoveredGlobalBadgeId,
    setHoveredGlobalBadgeId,
  };
}
