# Collapsed Screen Impact Highlight Propagation Specification

**Document Version:** 1.0.0  
**Target Audience:** Next AI Coding Models (Argon, Claude Opus 5.5, Gemini 4) & Core Contributors  
**Related Documents:** [AI_IMPLEMENTATION_SPEC.md](file:///e:/Workspace/coveragemap/AI_IMPLEMENTATION_SPEC.md), [TESTCASE_MODELING_AND_STATE_PROPAGATION.md](file:///e:/Workspace/coveragemap/docs/TESTCASE_MODELING_AND_STATE_PROPAGATION.md), [CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC.md](file:///e:/Workspace/coveragemap/docs/CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC.md)  
**Status:** Implemented (2026-10-22)

---

## 1. Executive Summary & Issue Definition (배경 및 현상)

### 1.1. 현상 (Problem Statement)
- `Screen` 노드가 접힌(`isCollapsed: true`, `-` 버튼으로 축소) 상태일 때, 해당 화면 내부에 속한 자식 컴포넌트(`Component`)가 글로벌 노드(`Global Node`) 또는 변경 수정 노드의 영향권에 포함되어 있음에도 불구하고:
  1. **글로벌 노드 영향도 오버레이 모드(`impactMode` / `[🔍 Impact]` 클릭 시)**: 접힌 Screen 카드가 `.impact-highlighted`에서 누락되어 **완전히 딤(Dim, 불투명도 25% + 흑백 그레이스케일) 처리**되어 영향권에서 배제된 것처럼 보임.
  2. **변경 영향도 강조 모드(`affectedScope` / Change Impact Ripple `.highlight-affected`)**: 자식 노드가 1~2홉 하류에 있어도 자식은 숨김(`hidden: true`) 처리되어 있고, 부모 Screen에는 `.highlight-affected` 클래스가 부여되지 않아 **스펙 변경 파급 하이라이트가 시각적으로 증발**함.

### 1.2. 비즈니스 및 QA 영향
- 테스터는 대규모 맵에서 인지 부하를 줄이기 위해 여러 Screen을 접어두고(`Collapsed`) 테스트를 진행합니다.
- 특정 전역 시스템(다국어, 네트워크 지연, 사운드 등)이나 기획 변경의 영향도를 파악할 때, 접힌 화면이 시각적으로 어둡게 꺼져 있으면 **"이 화면은 전역 시스템/스펙 변경의 영향을 받지 않는구나"라고 치명적인 오판**을 하게 됩니다.

---

## 2. Root Cause Analysis (상세 코드 분석 및 원인)

### 2.1. 원인 1: 부모 노드 접기 시 자식 노드 은닉 메커니즘 (`frontend/src/App.tsx:482-511`)
```tsx
// App.tsx: handleToggleCollapse
const handleToggleCollapse = (e: Event) => {
  ...
  return nds.map(n => {
    if (n.id === targetId) {
      return {
        ...n,
        style: nextStyle,
        data: { ...n.data, isCollapsed, childSummary, expandedStyle }
      };
    }
    // 자식 노드는 physically 숨김 처리됨!
    if (n.parentId === targetId) return { ...n, hidden: isCollapsed };
    return n;
  });
};
```
- 부모 Screen이 접히면 직속 자식 컴포넌트들은 `n.hidden = true`가 되어 캔버스 DOM에서 렌더링되지 않거나 화면에서 사라집니다.

### 2.2. 원인 2: `impactMode`의 타겟 식별 한계 (`frontend/src/App.tsx:155-169`, `backend/graph_service.py:684-723`)
- 백엔드 `get_impact_nodes(global_node_id)`는 전역 노드와 직접 엣지로 연결된 노드(`n`)를 반환합니다.
- 모바일 게임 모델링 규칙상 전역 노드(`Global_I18N` 등)는 부모 Screen이 아니라 **화면 내부의 구체적인 UI 컴포넌트(`Component`)**와 연결(`Depends_On` / `Displays`)됩니다.
- 따라서 `impactMode.connectedIds`에는 **자식 컴포넌트 ID**만 들어가고, **부모 Screen ID는 들어가지 않습니다.**
```tsx
// App.tsx:1660-1666
if (impactMode) {
  if (n.id === impactMode.globalNodeId) {
    cls += ' impact-highlighted impact-source';
  } else if (impactMode.connectedIds.has(n.id)) {
    cls += ' impact-highlighted';
  }
}
```
- 화면이 접혀 자식이 `hidden: true`일 때, 부모 Screen은 `impactMode.connectedIds`에 없으므로:
  - `index.css:833`: `.has-impact .react-flow__node:not(.impact-highlighted)` 규칙에 걸려 **`opacity: 0.25; filter: grayscale(100%);`**로 강제 딤 처리됩니다.

### 2.3. 원인 3: `affectedScope` (Change Impact Ripple)의 BFS 부모 미전파 (`frontend/src/App.tsx:1416-1441`)
```tsx
// App.tsx: affectedScope useMemo
for (const id of frontier) {
  for (const e of edges) {
    if (e.source !== id || edgeTypeOf(e) === 'RETURN') continue;
    ...
    if (!visited.has(e.target)) {
      nodeIds.add(e.target);
      next.push(e.target);
    }
  }
}
```
- BFS는 엣지의 `target`만을 영향 노드로 수집합니다.
- `Global Node ➔ Component` 엣지는 컴포넌트로 향하므로 `target`은 자식 컴포넌트입니다.
- 자식 컴포넌트의 `parentId`(부모 Screen)를 영향도 집합(`nodeIds`)에 올려주는(Rollup) 로직이 누락되어 있어, 부모 Screen에는 `.highlight-affected`가 부여되지 않습니다.

---

## 3. Standard Design & Behavioral Specification (표준 설계 및 동작 규격)

### 3.1. 원칙 1: 부모 노드로의 영향도 상향 롤업 (Parent Impact Rollup)
- **규칙**: 어떤 자식 노드(`n.parentId === parentScreen.id`)가 영향권(Impact)에 포함되어 있다면, **부모 Screen 노드 역시 영향권에 속한 것으로 판정**합니다.
- **적용 조건**:
  - 부모 Screen이 **접힌 상태(`isCollapsed: true`)일 때 필수 적용**되어야 합니다.
  - (확장성) 부모 Screen이 펼쳐진 상태에서도 외곽 컨테이너가 은은하게 영향권임을 인지할 수 있도록 하거나, 접힌 상태에서 우선 활성화합니다.

### 3.2. 원칙 2: 시각적 하이라이트 및 동적 요약 칩 노출
1. **`impactMode` 활성화 시**:
   - 접힌 부모 Screen 노드에 `.impact-highlighted` 클래스가 적용되어 딤 처리되지 않고 **보라색 펄스 글로우 테두리**가 유지됩니다.
   - 접힌 부모 Screen 카드 헤더 또는 요약 영역에 **영향받는 하위 요소 개수 배지** 표출:
     - 예: `[ 🔍 영향 하위 컴포넌트: 3개 ]`
2. **`affectedScope` (스펙 변경 리플) 활성화 시**:
   - 접힌 부모 Screen 노드에 `.highlight-affected` 클래스가 부여되어 **바이올렛 펄스 테두리**가 활성화됩니다.
   - 부모 카드 상태 칩 영역([CoverageNode.tsx:107](file:///e:/Workspace/coveragemap/frontend/src/CoverageNode.tsx#L107))에 `✨ [하위 변경: N개]` 칩 노출.

### 3.3. 원칙 3: Focus+Context 및 순수 CSS 제약 준수 (Zero-JS Styling)
- JS 인라인 스타일 조작 금지 (`AI_IMPLEMENTATION_SPEC Rule 1`).
- 부모 Screen 노드에 CSS 클래스(`.impact-highlighted`, `.highlight-affected`)를 부여하는 방식으로만 스타일을 제어합니다.
- 부모 노드가 활성화되어도 `transform: scale`을 건드리지 않고 `box-shadow`와 `border-color`로만 강조합니다 (`AI_IMPLEMENTATION_SPEC Rule 6.3`).

---

## 4. Implementation Directives for Next AI Model (차기 모델 구현 지시서)

차기 AI 모델은 아래 3개 파일을 수정하여 본 규격을 구현해야 합니다.

### 4.1. 프론트엔드 작업 (`frontend/src/App.tsx`)

#### 1) `impactMode` 계산 시 부모 노드 롤업 추가
- `App.tsx`의 노드 클래스 부여 루프(`lines ~1654-1688`) 또는 `impactMode` 상태 구조 개선:
- 자식 노드 중 `impactMode.connectedIds.has(child.id)`인 노드가 1개 이상 존재하는 부모 Screen(`n.id === child.parentId`)에 대해:
  ```tsx
  const isParentOfImpactedChild = n.data?.isCollapsed && nds.some(child => 
    child.parentId === n.id && impactMode.connectedIds.has(child.id)
  );

  if (impactMode) {
    if (n.id === impactMode.globalNodeId) {
      cls += ' impact-highlighted impact-source';
    } else if (impactMode.connectedIds.has(n.id) || isParentOfImpactedChild) {
      cls += ' impact-highlighted';
    }
  }
  ```

#### 2) `affectedScope` 계산 시 부모 노드 상향 포함 (`lines ~1416-1441`)
- BFS 탐색 완료 후, `nodeIds`에 포함된 노드들의 `parentId`를 조회하여 추가:
  ```tsx
  // D. 변경 영향권(Impact Ripple)에 포함된 자식 노드의 접힌 부모 Screen 추가
  const parentNodeIds = new Set<string>();
  for (const nid of nodeIds) {
    const childNode = nodes.find(n => n.id === nid);
    if (childNode?.parentId) {
      const parentNode = nodes.find(n => n.id === childNode.parentId);
      if (parentNode) {
        parentNodeIds.add(parentNode.id);
      }
    }
  }
  for (const pid of parentNodeIds) {
    nodeIds.add(pid);
  }
  ```

### 4.2. 노드 컴포넌트 작업 (`frontend/src/CoverageNode.tsx`)
- Screen 노드가 `data.isCollapsed === true`일 때:
  - 하위 자식 노드 중 영향받는 컴포넌트가 존재할 경우 요약 UI 표출.
  - `t.parentCollapse.impactSummary` 로케일 문자열을 활용하여 칩 또는 요약 텍스트 렌더링.

### 4.3. 로케일 문자열 추가 (`frontend/src/locales/koKR.ts`)
- `koKR.ts` 내에 하드코딩 방지를 위한 다국어 토큰 추가:
  ```ts
  parentCollapse: {
    ...
    affectedChildCount: (count: number) => `⚡ 영향 하위 컴포넌트 ${count}개`,
  }
  ```

---

## 5. Verification & Acceptance Criteria (검증 기준)

차기 모델은 구현 완료 후 다음 게이트를 모두 통과해야 합니다:

1. **Tier 1 (정적 정책 검사)**:
   - `backend/.venv/Scripts/python.exe scripts/check_policy.py` 통과 (Exit Code 0).
   - 하드코딩된 한글 UI 문자열이 없고 CSS 토큰을 준수하는지 확인.
2. **단위 및 E2E 자동화 검증**:
   - `cd backend; uv run pytest -q` (기존 10개 테스트 전원 통과).
   - `cd e2e-tests; npm test` (기존 E2E 테스트 전원 통과).
3. **수동 / 휴먼 검증 시나리오**:
   - [x] `타이틀 화면` 우측 상단의 `−` 버튼을 눌러 화면을 접음(`Collapsed`).
   - [x] 우측 Globals 패널에서 `다국어(I18N)` 글로벌 노드의 `[🔍 Impact]` 버튼 클릭.
   - [x] 접혀 있는 `타이틀 화면` 카드가 딤(그레이스케일) 처리되지 않고 선명한 보라색 글로우 테두리(`.impact-highlighted`)로 유지되는지 확인.
   - [x] `타이틀 화면` 내부의 자식 컴포넌트 중 하나를 `[⚡ 스펙 변경 표시]` 했을 때, 접힌 `타이틀 화면` 카드 외곽에 `.highlight-affected` 바이올렛 테두리가 정상 노출되는지 확인.
