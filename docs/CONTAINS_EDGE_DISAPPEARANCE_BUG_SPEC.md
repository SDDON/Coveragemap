# Contains Edge Disappearance Bug Analysis & Fix Specification

**Document Version:** 1.0.0  
**Target Audience:** Senior AI Coding Models (Argon, Claude Opus 5.5, Gemini 4) & Core Contributors  
**Related Documents:** [AI_IMPLEMENTATION_SPEC.md](file:///d:/workspace/Coveragemap/AI_IMPLEMENTATION_SPEC.md), [TESTCASE_MODELING_AND_STATE_PROPAGATION.md](file:///d:/workspace/Coveragemap/docs/TESTCASE_MODELING_AND_STATE_PROPAGATION.md)  
**Status:** Urgent Bug Fix Request (Drafted: 2026-10-22)

---

## 1. Executive Summary & Problem Statement (문제 정의)

### 1.1. 사용자 보고 현상 (User Bug Report)
> *"노드를 Contains 관계로 연결하면 화면이 갱신되면서 엣지가 사라지는 버그가 아직 남아있는데, 커밋 내역을 확인해서 이걸 수정했다고 처리한 경우, 수정이 안 된 거니까 수정 요청 문서를 남겨주세요."*

- 사용자가 캔버스에서 노드 간에 **`Contains`(또는 `Has`) 관계의 엣지를 연결**하거나, 기존 엣지를 Inspector에서 `Contains` 타입으로 변경하면:
  1. Neo4j 백엔드에는 엣지가 정상 생성/저장되지만,
  2. 화면이 새로고침되거나 `triggerRefresh()`(전체 갱신)가 실행되는 즉시 **캔버스에서 연결선(화살표 엣지)이 흔적도 없이 사라집니다.**
- **치명적 부작용**:
  - 화면에 엣지가 보이지 않으므로 사용자가 엣지를 클릭하여 선택할 수 없습니다.
  - 우측 Inspector에서 `Contains` 엣지의 검증 상태(`test_status`: `Passed`/`Failed`)를 마킹할 수 없습니다.
  - 엣지의 설명, 액션(`action`), 프로퍼티를 확인하거나 편집/삭제할 수 있는 방법이 웹 UI 상에서 완전히 차단됩니다.

---

## 2. Forensic Git History Audit (커밋 이력 포렌식 조사)

커밋 히스토리 분석 결과, 이 문제는 단순 실수로 누락된 것이 아니라 **과거 커밋에서 설계 타협(Workaround)으로 엣지 렌더링을 고의로 생략하고 방치**한 것으로 확인되었습니다.

### 2.1. 문제의 발단: Commit `1757292` (2026-05-24)
- **커밋 메시지**: `feat: enhance badge usability, focus highlight, and multi-link support`
- **변경 내용**:
  `frontend/src/App.tsx`의 그래프 로딩 파이프라인에 `isSubflowEdge` 플래그가 도입되었습니다:
  ```tsx
  let isSubflowEdge = false;
  const eType = (e.type || '').toLowerCase();
  if (eType === 'contains' || eType === 'has') {
    ...
    isSubflowEdge = true; // Subflow 엣지로 플래깅
  }
  // isSubflowEdge인 경우 edgeBundles에 추가하지 않고 드롭!
  if (!isBadgeEdge && !isSubflowEdge) {
    edgeBundles[key].push(e);
  }
  ```
  - **과거 작업자의 의도/착각**: React Flow의 Subflow(부모 노드 컨테이너 박스 안에 자식 노드가 물리적으로 들어가는 UI)를 구현하면서, *"자식이 부모 박스 안에 렌더링되니 부모와 자식을 잇는 화살표 선은 불필요하거나 지저분할 것이다"*라고 단정하고 `edgeBundles`에서 완전히 제외해 버렸습니다.

### 2.2. 버그 은폐 및 방치: Commit `3fee2e1` (2026-10-11)
- **커밋 메시지**: `feat: 2026-10 spec - status propagation, Mark Blocked override...`
- `docs/TESTCASE_MODELING_AND_STATE_PROPAGATION.md` 8.2절 (결정 사항 9번)에 다음과 같이 기록되었습니다:
  > *"9. 프론트-서버 정합성: 프론트엔드 edges 상태에는 Contains/배지 엣지가 빠져 있어 로컬 계산이 서버와 다를 수 있습니다..."*
- 즉, **`Contains` 엣지가 프론트엔드 엣지 배열에서 누락되어 사라지는 치명적 결함을 인지했음에도 불구하고, "의도된 생략"인 것처럼 정당화하고 미해결 상태로 남겨둔 것**입니다.

---

## 3. Code-Level Root Cause Analysis (코드 레벨 원인 분석)

현재 `frontend/src/App.tsx` 내에서 `Contains` 엣지가 사라지게 만드는 3대 원인 지점입니다:

### 3.1. 원인 1: 그래프 로드 시 엣지 번들 누락 (`frontend/src/App.tsx:622-640`)
```tsx
let isSubflowEdge = false;
const eType = (e.type || '').toLowerCase();
if (eType === 'contains' || eType === 'has') {
  const childNode = initialNodes.find(n => n.id === e.target);
  const parentId = initialNodes.find(n => n.id === e.source);
  if (childNode && parentId && !globalNodes.has(e.target)) {
    childNode.parentId = e.source;
    childNode.extent = parentId.hidden ? undefined : 'parent';
    (parentId.data as any).hasChildren = true;
  }
  isSubflowEdge = true;
}

if (!isBadgeEdge && !isSubflowEdge) { // ❌ isSubflowEdge는 번들에 담기지 않음!
  const key = e.source < e.target ? `${e.source}→${e.target}` : `${e.target}→${e.source}`;
  if (!edgeBundles[key]) edgeBundles[key] = [];
  edgeBundles[key].push(e);
}
```
- `isSubflowEdge === true`이면 `edgeBundles`에 담기지 않습니다.
- 하류에서 `setEdges`에 전달되는 엣지 목록은 `edgeBundles`로부터만 생성되므로, **`Contains` 엣지는 React Flow의 `edges` 상태에 단 1개도 들어가지 못하고 영구 소멸**합니다.

### 3.2. 원인 2: 신규 엣지 연결 시 조기 리턴 (`frontend/src/App.tsx:886-905`)
```tsx
// onConnect 핸들러
if (defaultType.toLowerCase() === 'contains' || defaultType.toLowerCase() === 'has') {
  setNodes(nds => {
    ...
  });
  return; // ❌ setEdges를 호출하지 않고 조기 리턴!
}
```
- 사용자가 마우스로 드래그하여 `Contains` 연결을 맺는 순간, `setNodes`로 `parentId`만 바꾼 뒤 `return;`해 버립니다.
- 캔버스에 `newEdge` 객체가 추가되지 않아 연결선이 화면에 나타나지 않습니다.

### 3.3. 원인 3: 엣지 타입 편집 저장 시 화면 새로고침 증발 (`frontend/src/App.tsx:1307-1309`)
```tsx
// handleSave 핸들러 (엣지 수정 저장)
if (payload.type?.toLowerCase() === 'contains' || payload.type?.toLowerCase() === 'has') {
  triggerRefresh();
}
```
- 기존 엣지를 Inspector에서 `Contains`로 수정하고 저장하면 `triggerRefresh()`가 호출됩니다.
- 이때 3.1의 `fetchGraph`가 다시 돌면서 `!isSubflowEdge` 필터에 걸려, 방금 수정한 엣지가 눈앞에서 사라집니다.

---

## 4. Standard Architectural Requirements (표준 요구사항)

CoverageMap은 단순한 레이아웃 뷰어가 아니라 **Living Test Coverage Platform**입니다.
- **원칙 1**: `Contains` 엣지는 화면/컨테이너가 컴포넌트를 소유함을 나타내는 **일급 도메인 엣지(First-Class Edge)**입니다.
- **원칙 2**: `Contains` 엣지도 다른 모든 엣지와 동일하게 **캔버스에 렌더링되어야 하며, 클릭 가능(Selectable)하고, Inspector에서 상태(`Passed`/`Failed`/`Untested`)를 검증 및 수정할 수 있어야 합니다.**
- **원칙 3**: Subflow 부모-자식 계층(`child.parentId = parent.id`) 구조와 엣지 렌더링은 상호 배타적이지 않습니다. 부모 컨테이너 박스 내부에서 부모와 자식 간에 **은은한 점선 스타일(`.edge-contains`)의 플로팅 엣지**로 연결되어 공존해야 합니다.

---

## 5. Implementation Directives for Next AI Model (차기 모델 구현 지시서)

차기 AI 모델은 아래 지침에 따라 코드를 수정해야 합니다.

### 5.1. `frontend/src/App.tsx` 수정

#### 1) `isSubflowEdge` 엣지 드롭 제거 (`lines ~635-640`)
`isSubflowEdge`라고 해서 `edgeBundles`에서 제외하지 않고 정상적으로 포함합니다:
```tsx
// AS-IS:
if (!isBadgeEdge && !isSubflowEdge) {
  ...
}

// TO-BE:
// 배지(Global Node) 엣지만 노드 내부 칩으로 흡수하고, Contains 엣지는 캔버스에 렌더링되도록 번들에 포함합니다.
if (!isBadgeEdge) {
  const key = e.source < e.target ? `${e.source}→${e.target}` : `${e.target}→${e.source}`;
  if (!edgeBundles[key]) edgeBundles[key] = [];
  edgeBundles[key].push(e);
}
```

#### 2) `onConnect` 조기 리턴 수정 (`lines ~886-905`)
`Contains` 연결 시 `setNodes`로 부모-자식 관계를 설정한 뒤, `return;`으로 끊지 말고 `setEdges`에도 `newEdge`가 등록되도록 플로우를 통합합니다:
```tsx
if (defaultType.toLowerCase() === 'contains' || defaultType.toLowerCase() === 'has') {
  setNodes(nds => {
    ...
  });
  // 조기 return을 삭제하고, 아래의 newEdge 생성 및 setEdges(bundledEds)로 자연스럽게 진행되도록 함
}
```

### 5.2. `frontend/src/index.css` 스타일 추가
`Contains` 엣지는 일반 화면 전환선(`Transition`)과 구별되도록 은은한 점선과 고유 스타일을 부여합니다:
```css
/* Contains / Subflow 엣지 스타일 */
.react-flow__edge[data-type="contains"] path.react-flow__edge-path,
.react-flow__edge[data-type="has"] path.react-flow__edge-path,
.react-flow__edge.edge-contains path.react-flow__edge-path {
  stroke: #94a3b8 !important;
  stroke-dasharray: 4 4 !important;
  stroke-width: 1.5px !important;
}

.react-flow__edge[data-type="contains"]:hover path.react-flow__edge-path,
.react-flow__edge[data-type="contains"].active path.react-flow__edge-path {
  stroke: #3b82f6 !important;
  stroke-width: 2px !important;
}
```

### 5.3. 부모 노드 접기(`isCollapsed: true`) 시의 엣지 가시성
- 부모 Screen이 접히면(`isCollapsed: true`), 자식 노드가 `hidden: true`가 되므로 연결된 `Contains` 엣지도 자연스럽게 React Flow에 의해 숨겨집니다.
- 부모 Screen이 다시 펼쳐지면(`isCollapsed: false`), `Contains` 엣지가 선명하게 다시 노출되어야 합니다.

---

## 6. Verification Guidelines (검증 기준)

차기 모델은 작업 후 다음 사항을 완벽히 검증해야 합니다:

1. **정적 정책 검사**: `backend/.venv/Scripts/python.exe scripts/check_policy.py` 통과 (0 Exit Code).
2. **단위 및 E2E 테스트 통과**: `cd backend; uv run pytest -q` 및 `cd e2e-tests; npm test` (기존 테스트 100% 통과).
3. **수동 검증 시나리오**:
   - [ ] 노드 A(Screen)에서 노드 B(Component)로 선을 잇고 타입을 `Contains`로 지정.
   - [ ] 캔버스에 점선 화살표 엣지가 즉시 렌더링되는지 확인.
   - [ ] 브라우저를 새로고침(F5)하거나 노드를 수정하여 화면이 갱신된 후에도 **`Contains` 엣지가 사라지지 않고 유지되는지 확인**.
   - [ ] `Contains` 엣지를 마우스로 클릭했을 때 우측 Inspector가 열리고, `Mark Passed` / `Mark Failed`를 눌러 엣지 상태가 정상 변경되는지 확인.
   - [ ] 엣지 삭제 버튼을 눌렀을 때 Neo4j와 캔버스에서 정상 삭제되고 부모-자식 관계가 해제되는지 확인.
