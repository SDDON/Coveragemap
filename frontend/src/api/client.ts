import type { ApiNode, GraphResponse, StatusName, ChecklistItem } from '../types/graph';

async function extractResponseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const errJson = await res.json();
    return errJson.detail || errJson.message || fallback;
  } catch {
    const text = await res.text().catch(() => '');
    return text || fallback;
  }
}

export function extractErrorMessage(err: unknown, fallback = 'Unknown error occurred'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
}

export const api = {
  nodes: {
    async fetchGraph(filter = '', depth = 1, signal?: AbortSignal, debounceId?: string): Promise<GraphResponse> {
      let url = `/api/graph?filter=${encodeURIComponent(filter)}&depth=${depth}`;
      if (debounceId) {
        url += `&debounce_id=${encodeURIComponent(debounceId)}`;
      }
      const res = await fetch(url, { signal });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to fetch graph data'));
      }
      return res.json();
    },

    async fetchNode(id: string): Promise<ApiNode> {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`);
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to fetch node'));
      }
      return res.json();
    },

    async createNode(payload: Partial<ApiNode>): Promise<string> {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to create node'));
      }
      return res.json();
    },

    async updateNode(id: string, payload: Record<string, unknown>): Promise<ApiNode> {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to update node'));
      }
      return res.json();
    },

    async markStatus(id: string, status: StatusName, overrideReason?: string): Promise<ApiNode> {
      const payload: Record<string, unknown> = {
        test_status: status,
        is_manual_override: overrideReason !== undefined,
      };
      if (overrideReason !== undefined) {
        payload.override_reason = overrideReason;
      }
      return this.updateNode(id, payload);
    },

    async saveChecklist(id: string, items: ChecklistItem[]): Promise<ApiNode> {
      return this.updateNode(id, {
        properties: { checklist: items },
      });
    },

    async deleteNode(id: string): Promise<void> {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to delete node'));
      }
    },

    /**
     * 노드(및 직속 Contains/Has 자식 구조, 체크리스트, 글로벌 배지 연결)를 새 태그로 복제하고
     * 모든 상태를 Untested로 초기화한 뒤 Undo 스택(CLONE_SUBGRAPH)에 등록합니다.
     */
    async cloneNode(id: string, tag?: string): Promise<{ cloned_root_id: string; cloned_node_ids: string[]; cloned_edge_ids: string[]; name: string }> {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tag || '' }),
      });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to clone node'));
      }
      return res.json();
    },

    async cloneSubgraph(id: string, tag?: string) {
      return this.cloneNode(id, tag);
    },

    async markModified(id: string, note = ''): Promise<void> {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}/mark-modified`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to mark node modified'));
      }
    },

    async acknowledgeNode(id: string): Promise<void> {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}/acknowledge`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to acknowledge node'));
      }
    },

    async fetchAliases(): Promise<string[]> {
      const res = await fetch('/api/aliases');
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to fetch aliases'));
      }
      return res.json();
    },

    async fetchStatuses(): Promise<Record<string, string>> {
      const res = await fetch('/api/node-statuses');
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to fetch node statuses'));
      }
      return res.json();
    },
  },

  edges: {
    async createEdge(payload: {
      source: string;
      target: string;
      type: string;
      action?: string;
      test_status: string;
      properties?: Record<string, unknown>;
    }): Promise<string> {
      const res = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to create edge'));
      }
      return res.json();
    },

    async updateEdge(id: string, payload: Record<string, unknown>): Promise<{ new_id?: string }> {
      const res = await fetch(`/api/edges/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to update edge'));
      }
      return res.json();
    },

    async deleteEdge(id: string): Promise<void> {
      const res = await fetch(`/api/edges/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to delete edge'));
      }
    },
  },

  globals: {
    async fetchGlobals(): Promise<ApiNode[]> {
      const res = await fetch('/api/globals');
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to fetch globals'));
      }
      return res.json();
    },

    async fetchImpact(globalNodeId: string): Promise<{
      connected_nodes: Array<{ id: string; edge_id?: string }>;
      stats: { Passed: number; Failed: number; Untested: number };
      total: number;
    }> {
      const res = await fetch(`/api/impact/${encodeURIComponent(globalNodeId)}`);
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to fetch impact data'));
      }
      return res.json();
    },
  },

  system: {
    async checkHealth(): Promise<boolean> {
      try {
        const res = await fetch('/api/health');
        return res.ok;
      } catch {
        return false;
      }
    },

    async auditCrossCutting(aspect: string, scopeRootId: string): Promise<unknown> {
      const res = await fetch('/api/audit/cross-cutting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspect, scope_root_id: scopeRootId }),
      });
      if (!res.ok) {
        throw new Error(await extractResponseErrorMessage(res, 'Failed to run cross-cutting audit'));
      }
      return res.json();
    },
  },
};
