import json
import re

sync_manager_code = '''export type SyncAction = 'create' | 'update' | 'delete';
export type SyncType = 'node' | 'edge';

export interface SyncOperation {
  type: SyncType;
  action: SyncAction;
  id?: string;
  temp_id?: string;
  data?: any;
}

const STORAGE_KEY = 'coveragemap_sync_queue';

export const getSyncQueue = (): SyncOperation[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const enqueueSyncOperation = (op: SyncOperation) => {
  const queue = getSyncQueue();
  queue.push(op);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export const clearSyncQueue = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const syncWithBackend = async (baseUrl: string): Promise<boolean> => {
  const queue = getSyncQueue();
  if (queue.length === 0) return true;

  try {
    const res = await fetch(${baseUrl}/api/sync, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations: queue }),
    });
    
    if (res.ok) {
      clearSyncQueue();
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to sync', e);
    return false;
  }
};
'''
with open('src/syncManager.ts', 'w', encoding='utf-8') as f:
    f.write(sync_manager_code)

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken template literals in App.tsx
content = content.replace("const newEdgeId = \tmp-edge-;", "const newEdgeId = 	mp-edge-;")
content = content.replace("const newNodeId = \tmp-node-;", "const newNodeId = 	mp-node-;")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
