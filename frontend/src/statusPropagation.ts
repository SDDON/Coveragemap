import type { Node, Edge } from '@xyflow/react';

/**
 * Living TC 4-Stage 상태 전파 엔진 (프론트엔드 낙관적 업데이트용)
 *
 * 백엔드 backend/graph_service.py 의 compute_synthesized_status / _run_propagation 과
 * "같은 규칙"을 그대로 옮긴 순수 함수 모음입니다. (AI_IMPLEMENTATION_SPEC 3.2 / 3.5, TESTCASE 스펙 4.2)
 *
 * - 화면은 이 모듈로 즉시(낙관적) 갱신하고, 저장 후에는 서버의 실제 상태(/api/node-statuses)로 재동기화합니다.
 *   (프론트 state에는 Contains/배지 엣지가 없어서 일부 노드는 서버 계산과 다를 수 있기 때문)
 * - 연쇄 전파는 DEPENDS_ON / TESTS 엣지만 따라갑니다.
 *   흐름 엣지(Transition 등)는 "엣지 자체의 상태"로만 판정하므로 테스터가 직접 마킹한 상태를 덮어쓰지 않습니다.
 * - RETURN 엣지는 집계/전파에서 완전히 제외합니다. (순환 Deadlock 방지, TESTCASE 스펙 3.4)
 * - 수동 고정(📌 is_manual_override) 노드는 재계산하지 않습니다.
 */

export type StatusName = 'Untested' | 'Passed' | 'Failed' | 'Blocked';

export type ChecklistItem = { id: string; text: string; status: StatusName };

// 백엔드 STATUS_DEPENDENT_EDGE_TYPES 와 동일
export const STATUS_DEPENDENT_EDGE_TYPES = ['DEPENDS_ON', 'TESTS'];
const FAIL_OR_BLOCK = ['Failed', 'Blocked'];

// 순환이 있는 잘못된 모델링에서도 무한 반복하지 않도록 하는 안전 상한 (백엔드 MAX_PROPAGATION_STEPS 와 동일)
const MAX_PROPAGATION_STEPS = 1000;

export type StatusInput = {
  edgeType: string;   // 대문자 정규화된 엣지 타입 (DEPENDS_ON / TESTS / TRANSITION ...)
  edgeStatus: string; // 엣지 자체의 test_status
  srcStatus: string;  // 출발 노드의 test_status
};

/** 체크리스트 항목들의 종합 상태 (TESTCASE 스펙 3.3-2). 항목이 없으면 null. */
export function checklistStatus(checklist: unknown): StatusName | null {
  if (!Array.isArray(checklist) || checklist.length === 0) return null;
  const statuses = checklist
    .filter(item => item && typeof item === 'object')
    .map(item => String((item as any).status || 'Untested'));
  if (statuses.length === 0) return null;
  if (statuses.includes('Failed')) return 'Failed';
  if (statuses.includes('Blocked')) return 'Blocked';
  if (statuses.every(s => s === 'Passed')) return 'Passed';
  return 'Untested';
}

/** 기존 3.2 합성 규칙 (전역/배지 노드용): 0개 Untested / 실패·차단 하나라도 Blocked / 모두 Passed면 Passed */
function legacyEdgeRule(edgeStatuses: string[]): StatusName {
  if (edgeStatuses.length === 0) return 'Untested';
  if (edgeStatuses.some(s => FAIL_OR_BLOCK.includes(s))) return 'Blocked';
  if (edgeStatuses.every(s => s === 'Passed')) return 'Passed';
  return 'Untested';
}

/**
 * 타겟 노드 1개의 합성 상태를 계산합니다. (백엔드 compute_synthesized_status 와 1:1 대응)
 */
export function computeSynthesizedStatus(
  currentStatus: string | undefined,
  inputs: StatusInput[],
  checklist: unknown = null,
  isGlobal = false,
): StatusName {
  const current = (currentStatus || 'Untested') as StatusName;
  const clean = inputs.filter(i => i && i.edgeType.toUpperCase() !== 'RETURN');

  // 전역(Badge) 노드: 배지 ✓/✕가 엣지 상태로 기록되므로 엣지 상태 기반 규칙을 유지
  if (isGlobal) return legacyEdgeRule(clean.map(i => i.edgeStatus || 'Untested'));

  const dep = clean.filter(i => i.edgeType === 'DEPENDS_ON');
  const tests = clean.filter(i => i.edgeType === 'TESTS');
  const flow = clean.filter(i => !STATUS_DEPENDENT_EDGE_TYPES.includes(i.edgeType));

  const cl = checklistStatus(checklist);
  const rollup: string[] = [...tests.map(i => i.srcStatus || 'Untested'), ...(cl ? [cl] : [])];

  // 게이트: 선행 TC(Depends_On 출발 노드/엣지)가 실패/차단, 또는 흐름·검증 엣지 자체가 실패/차단
  const gateBlocked =
    dep.some(i => FAIL_OR_BLOCK.includes(i.srcStatus) || FAIL_OR_BLOCK.includes(i.edgeStatus)) ||
    [...flow, ...tests].some(i => FAIL_OR_BLOCK.includes(i.edgeStatus));

  // 1) 검증 TC 또는 체크리스트에 실패가 있으면 Failed (결함 위치를 우선하는 확정 규칙)
  if (rollup.includes('Failed')) return 'Failed';
  // 2) 선행 실패/차단이면 Blocked
  if (gateBlocked || rollup.includes('Blocked')) return 'Blocked';
  // 3) 롤업 대상(TC/체크리스트/흐름 엣지)이 있으면 모두 Passed일 때만 Passed
  const deriveParts = [...rollup, ...flow.map(i => i.edgeStatus || 'Untested')];
  if (deriveParts.length > 0) return deriveParts.every(s => s === 'Passed') ? 'Passed' : 'Untested';
  // 4) 선행 의존만 있고 모두 정상이면 자동 차단만 풀고, 테스터가 직접 마킹한 상태는 유지
  if (dep.length > 0) return current === 'Blocked' ? 'Untested' : current;
  // 5) 입력이 전혀 없으면 기존 규칙대로 Untested
  return 'Untested';
}

/** 엣지 타입을 대문자로 정규화 (data.type 우선, 없으면 label) */
export function edgeTypeOf(e: Edge): string {
  const raw = (e.data as any)?.type ?? e.label ?? '';
  return String(raw).toUpperCase();
}

function nodeProps(n: Node | undefined): Record<string, any> {
  return ((n?.data as any)?.properties || {}) as Record<string, any>;
}

/** 📌 수동 고정 여부 (Neo4j/JSON 왕복에 따라 boolean 또는 문자열일 수 있음) */
export function isOverridden(n: Node | undefined): boolean {
  const v = nodeProps(n).is_manual_override;
  return v === true || v === 'true' || v === 'True';
}

export function isGlobalNode(n: Node | undefined): boolean {
  return nodeProps(n).is_global === 'true';
}

/** node_id의 상태를 입력으로 쓰는 하류 노드 (DEPENDS_ON 타겟 / TESTS 타겟) */
export function dependentTargets(edges: Edge[], nodeId: string): string[] {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.source === nodeId && STATUS_DEPENDENT_EDGE_TYPES.includes(edgeTypeOf(e))) out.add(e.target);
  }
  return Array.from(out);
}

/**
 * 워크리스트 방식 연쇄 전파 (백엔드 _run_propagation 과 동일한 동작)
 * - startIds 부터 재계산하고, 상태가 바뀐 노드의 하류만 다시 큐에 넣습니다.
 * - exclude: 사용자가 방금 직접 마킹한 노드 (순환이 있어도 사용자의 입력을 덮어쓰지 않음)
 * - 전역(배지) 노드는 배지 엣지가 프론트 state에 없으므로 여기서는 건드리지 않고 서버 재동기화에 맡깁니다.
 * 반환값: 실제로 상태가 바뀐 노드들의 { id: 새 상태 }
 */
export function runPropagation(
  nodes: Node[],
  edges: Edge[],
  startIds: string[],
  exclude: Set<string> = new Set(),
): Record<string, StatusName> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const statusOf = new Map<string, string>(nodes.map(n => [n.id, ((n.data as any)?.test_status || 'Untested')]));
  const original = new Map(statusOf);

  const queue: string[] = [...startIds];
  const queued = new Set(startIds);
  let steps = 0;

  while (queue.length > 0 && steps < MAX_PROPAGATION_STEPS) {
    const nid = queue.shift()!;
    queued.delete(nid);
    steps += 1;
    if (exclude.has(nid)) continue;

    const node = byId.get(nid);
    if (!node || isOverridden(node) || isGlobalNode(node)) continue;

    const inputs: StatusInput[] = edges
      .filter(e => e.target === nid && edgeTypeOf(e) !== 'RETURN')
      .map(e => ({
        edgeType: edgeTypeOf(e),
        edgeStatus: ((e.data as any)?.test_status || 'Untested'),
        srcStatus: statusOf.get(e.source) || 'Untested',
      }));

    const current = statusOf.get(nid) || 'Untested';
    const next = computeSynthesizedStatus(current, inputs, nodeProps(node).checklist, false);
    if (next === current) continue;

    statusOf.set(nid, next);
    for (const nxt of dependentTargets(edges, nid)) {
      if (!queued.has(nxt) && !exclude.has(nxt)) {
        queue.push(nxt);
        queued.add(nxt);
      }
    }
  }

  const changes: Record<string, StatusName> = {};
  statusOf.forEach((st, id) => {
    if (original.get(id) !== st) changes[id] = st as StatusName;
  });
  return changes;
}

/** 노드 상태가 바뀐 뒤 하류로 연쇄 전파 (백엔드 _propagate_to_dependents 대응) */
export function propagateToDependents(nodes: Node[], edges: Edge[], nodeId: string): Record<string, StatusName> {
  return runPropagation(nodes, edges, dependentTargets(edges, nodeId), new Set([nodeId]));
}

/** 엣지 생성/수정/삭제 뒤 타겟 재계산 + 바뀌면 하류 전파 (백엔드 _recalc_target_node_status 대응) */
export function recalcTargetAndPropagate(nodes: Node[], edges: Edge[], targetIds: string[]): Record<string, StatusName> {
  return runPropagation(nodes, edges, targetIds);
}

/** 상태 변경 맵을 노드 배열에 반영 (data.test_status + status-xxx 클래스 동기화, 변경 없으면 같은 객체 유지) */
export function applyStatusChanges(nodes: Node[], changes: Record<string, string>): Node[] {
  if (Object.keys(changes).length === 0) return nodes;
  let changed = false;
  const next = nodes.map(n => {
    const st = changes[n.id];
    if (!st || (n.data as any)?.test_status === st) return n;
    changed = true;
    const cls = ((n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + st.toLowerCase()).trim();
    return { ...n, className: cls, data: { ...(n.data || {}), test_status: st } };
  });
  // 실제 변경이 없으면 같은 배열을 돌려줘 불필요한 리렌더를 막습니다.
  return changed ? next : nodes;
}
