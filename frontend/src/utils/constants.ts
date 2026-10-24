import type { StatusName } from '../types/graph';

// System reserved keys that have dedicated UI form controls and must be excluded from Custom Properties
export const SYSTEM_RESERVED_KEYS = new Set([
  'name', 'label', 'aliases', 'test_status', 'id',
  'is_global', 'description', 'issue_link', 'x', 'y',
  // B안 체크리스트 / 📌 수동 고정 / Change Impact Ripple 필드는 전용 UI(Inspector 섹션)에서만 편집합니다.
  'checklist', 'is_manual_override', 'override_reason',
  'is_modified', 'modified_note', 'modified_at', 'acknowledged_at'
]);

// 체크리스트 항목 원클릭 상태 버튼 순서 (⚪ / 🟢 / 🔴 / 🟡) — TESTCASE 스펙 3.3-3
export const CHECKLIST_STATUS_CYCLE: StatusName[] = ['Untested', 'Passed', 'Failed', 'Blocked'];
export const STATUS_ICON: Record<string, string> = { Untested: '⚪', Passed: '🟢', Failed: '🔴', Blocked: '🟡' };

// 변경 영향권(.highlight-affected)으로 표시할 다운스트림 홉 수 (TESTCASE 스펙 7.2: 1~2차 후속 노드)
export const AFFECTED_MAX_HOPS = 2;

export const FILTERABLE_NODE_TYPES = new Set(['Screen', 'Component', 'TestCase', 'Data']);

export const NODE_LABEL_OPTIONS = [
  'Feature',
  'Screen',
  'Content',
  'System',
  'Component',
  'Data',
  'TestCase',
  'Node',
] as const;

export const EDGE_TYPE_OPTIONS = [
  'Transition',
  'Contains',
  'Displays',
  'Depends_On',
  'Triggers',
  'Tests',
  'Return',
] as const;

export const QUICK_CONNECT_EDGE_TYPES = [
  'Transition',
  'Contains',
  'Depends_On',
  'Tests',
  'Return',
] as const;
