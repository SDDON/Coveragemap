import type { CoverageNode, CoverageEdge, StatusName, ChecklistItem } from './graph';

export type RightPanelTab = 'view' | 'edit' | 'globals';
export type HealthStatus = 'checking' | 'ok' | 'error';
export type ImpactFilterOperator = 'OR' | 'AND';

// 그래프 전체 재조회(/api/graph) 완료 횟수 — 재조회로 className이 초기화되면 하이라이트 effect를 다시 적용하기 위함
export type GraphVersion = number;

// E. 연결 드래그 중일 때만 타겟 드롭 히트박스를 노드 전체로 확장하기 위한 플래그 (.react-flow--connecting)
export type ConnectingState = boolean;

// B. Mark Blocked(📌 수동 차단) 사유 입력 UI 상태 — null이면 입력창 닫힘
export type BlockReasonDraftState = string | null;

// D. 변경 표시(Mark Modified) 메모 입력값
export type ModifiedNoteDraftState = string;

// C. 체크리스트 항목의 상태 선택 팝오버가 열린 항목 id (한 번에 하나만 열림, null이면 닫힘)
export type OpenChecklistStatusIdState = string | null;

// 결함 원인 역추적(Trace Root Cause) 활성 대상 노드 ID (AI_IMPLEMENTATION_SPEC 3.3)
export type TracedRootNodeIdState = string | null;

// 화면(Screen/Container) 단위 다국어 스코프 감사 활성 루트 노드 ID (CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 4.1)
export type ScopedAuditRootIdState = string | null;

// 특정 콘텐츠 중심 확인을 위한 포커스 고정 노드 ID (Content Focus Pinning)
export type PinnedFocusNodeIdState = string | null;

// 노드(및 Contains 하위 구조) 인라인 복제 박스 표시 여부, 태그 입력값, 진행 중 잠금
export interface CloneBoxState {
  show: boolean;
  tag: string;
  isCloning: boolean;
}

// Impact Overlay Mode (다중 글로벌 노드 동시 비교 및 합집합 OR / 교집합 AND 필터 지원)
export interface ActiveImpactItem {
  globalNodeId: string;
  globalNodeName: string;
  slotIndex: number;
  connectedIds: Set<string>;
  edgeIds: Set<string>;
  stats: { Passed: number; Failed: number; Untested: number };
  total: number;
}

// 장거리 노드 연결 UI/UX (Pattern A: 빈 캔버스 드롭 팝오버 / Pattern B: 2-Step 소스 고정 후 타겟 클릭)
export interface QuickConnectPopoverState {
  sourceNodeId: string;
  x: number;
  y: number;
  edgeType: string;
  edgeTypeManuallySet?: boolean;
  search: string;
}

export interface PendingConnectSourceState {
  nodeId: string;
  nodeName?: string;
  edgeType: string;
  edgeTypeManuallySet?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  show: boolean;
}

export interface EditFormData {
  type?: 'node' | 'edge';
  id?: string;
  label?: string;
  name?: string;
  category?: string;
  aliases?: string | string[];
  status?: StatusName | string;
  test_status?: StatusName;
  description?: string;
  issue_link?: string;
  edgeType?: string;
  action?: string;
  isManualOverride?: boolean;
  overrideReason?: string;
  isModified?: boolean;
  modifiedNote?: string;
  properties?: Record<string, unknown>;
  checklist?: ChecklistItem[];
  source?: string;
  target?: string;
  [key: string]: unknown;
}

export type UndoActionType =
  | 'CREATE_NODE'
  | 'UPDATE_NODE'
  | 'DELETE_NODE'
  | 'CREATE_EDGE'
  | 'UPDATE_EDGE'
  | 'DELETE_EDGE'
  | 'CLONE_SUBGRAPH';

export interface UndoAction {
  type: UndoActionType;
  id?: string;
  nodeData?: Record<string, unknown>;
  edgeData?: Record<string, unknown>;
  previousData?: Record<string, unknown>;
  oldData?: Record<string, unknown>;
  connectedEdges?: CoverageEdge[];
  nodeIds?: string[];
  createdNodeIds?: string[];
  createdEdgeIds?: string[];
}

export type PendingConnectSource = PendingConnectSourceState;

export interface GraphSnapshot {
  nodes: CoverageNode[];
  edges: CoverageEdge[];
  selectedNode: CoverageNode | null;
  selectedEdge: CoverageEdge | null;
  editFormData: EditFormData;
  sequenceToken?: number;
}

export interface FilterState {
  searchQuery: string;
  filterText: string;
  maxDepth: number;
  visibleTypes: Set<string>;
  showAllDomains: boolean;
}
