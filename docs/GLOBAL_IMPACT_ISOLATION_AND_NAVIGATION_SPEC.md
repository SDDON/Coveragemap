# Global Node Impact Isolation & Navigation Specification

**Document Version:** 1.0.0  
**Target Audience:** Senior AI Coding Agents & Full-Stack QA Engineers  
**Related Documents:** [AI_IMPLEMENTATION_SPEC.md](file:///d:/workspace/Coveragemap/AI_IMPLEMENTATION_SPEC.md), [UI_UX_DESIGN_SYSTEM.md](file:///d:/workspace/Coveragemap/UI_UX_DESIGN_SYSTEM.md), [TESTCASE_MODELING_AND_STATE_PROPAGATION.md](file:///d:/workspace/Coveragemap/docs/TESTCASE_MODELING_AND_STATE_PROPAGATION.md)

---

## 1. Executive Summary & Problem Definition (문제 정의 및 배경)

### 1.1. 배경 (Context)
CoverageMap은 게임 내 다국어(i18n), 네트워크, 사운드, 그리고 **재화 공급망(예: `Gold(Produce)`, `Gold(Use)`)**과 같은 횡단 관심사(Cross-cutting Concerns)를 캔버스 선 꼬임 없이 관리하기 위해 **전역 노드(Global Node, `is_global: true`)** 아키텍처를 채택하고 있습니다.

전역 노드를 활성화하면 우측 `GlobalsTab` 또는 인스펙터에서 **`🔍 Impact` 모드**를 켤 수 있으며, 해당 전역 노드와 연결된 캔버스 상의 모든 타겟 노드(Screen, Feature, Content 등)에 `.impact-highlighted` 클래스가 부여되어 시각적으로 강조됩니다.

### 1.2. 실무 환경에서의 한계 및 문제점 (Pain Points)
현재 시스템의 시각화는 **Focus+Context(관심 대상은 100% 불투명도 유지, 비관련 대상은 `opacity: 0.15`로 딤 처리)** 철학에만 기반하고 있습니다. 이로 인해 노드가 50~200개 이상으로 확장되는 실무 프로젝트에서 다음과 같은 심각한 UI/UX 병목이 발생합니다:

1. **Where's Waldo? (숨은그림찾기) 문제**:
   * 예를 들어 `Gold(Produce)` 배지가 붙은 공급원 노드가 캔버스 전체에서 단 5개뿐일 때, 이 5개 노드는 드넓은 캔버스 사방에 멀리 흩어져 있습니다.
   * 나머지 95개 이상의 비관련 노드가 딤(Dim) 처리만 된 채 **원래의 캔버스 2D 좌표와 물리적 공간을 그대로 점유**하고 있습니다.
   * 테스터는 캔버스를 수동으로 줌아웃하고 이리저리 패닝하며 흩어진 5개의 노드를 눈으로 찾아 헤매야 합니다.
2. **영향 노드 목록(List/Navigator) 부재**:
   * 하단 `ImpactStatsBar`에는 `총 5개 영향 (Passed: 3, Failed: 1, Untested: 1)`이라는 단순 집계 숫자만 노출됩니다.
   * 그 5개 노드가 구체적으로 어떤 화면과 기능인지 이름 목록을 보거나, 특정 노드로 즉시 카메라를 이동시키는 네비게이션 수단이 전무합니다.
3. **초기 카메라 시야(Viewport) 미조정**:
   * `Impact` 버튼을 켰을 때 카메라가 현재 보고 있던 뷰포트에 그대로 멈춰 있어, 영향받는 노드들이 화면 밖에 위치해 있으면 아무런 변화가 없는 것처럼 느껴질 수 있습니다.

---

## 2. Core Requirements & Engineering Principles (핵심 원칙)

본 기능의 구현 및 대안 탐색 시 모든 AI 에이전트는 다음 규칙을 준수해야 합니다:

1. **Focus+Context와 Isolate(격리 모드)의 공존**:
   * 전체 게임 화면 내에서의 배치 맥락(Context)을 유지하며 보기를 원하는 사용자와, 영향 노드만 깔끔하게 모아서 보기를 원하는 사용자를 모두 수용할 수 있도록 **원클릭 토글(Toggle)** 방식으로 제공합니다.
2. **Pure CSS & Zero-JS Styling 준수 (Spec Rule 1)**:
   * React 컴포넌트 내부에서 인라인 스타일로 `opacity`나 `display`를 연산하지 않고, 최상위 컨테이너 클래스(`.has-impact.is-isolated`) 조작과 순수 CSS 규칙으로 제어합니다.
3. **12-Tier Z-Index 토큰 준수 (Spec Rule 2)**:
   * 하단 바, 드로어, 팝오버 등 신규 UI 요소는 반드시 `--z-floating-panel (200)` 또는 `--z-context-menu (500)` 등의 CSS 변수 토큰만을 사용합니다.
4. **i18n 중앙화 준수 (Spec Rule 6 / check_policy Rule 6)**:
   * 모든 UI 텍스트(버튼명, 툴팁, 안내 문구)는 `frontend/src/locales/koKR.ts`(`t.impact.*`)에 등록하여 참조합니다.
5. **비파괴적 레이아웃 (Non-Destructive Layout)**:
   * 격리 보기 시 노드의 원래 `position({x, y})` 데이터를 영구 변경하지 않고, React Flow의 가시성 제어 및 `fitView({ nodes: [...] })` 카메라 뷰포트 이동으로 처리합니다.

---

## 3. Detailed Feature Specifications (상세 기능 명세)

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Canvas: React Flow]                                                   │
│                                                                        │
│   ┌──────────────┐                     ┌──────────────┐                │
│   │ [🟢] 일일 던전 │                     │ [🔴] 퀘스트 보상 │                │
│   └──────────────┘                     └──────────────┘                │
│                                                                        │
│   ─────────────────── [Impact Overlay Bar] ────────────────────        │
│   🔍 [🪙 Gold(Produce)] [🪙 Gold(Use)]  | 총 5개 영향 (🟢3 🔴1 ⚪1)      │
│   [👁️ 격리 보기 OFF/ON] [📋 목록 보기 ▼]   | [OR | AND]                 │
└────────────────────────────────────────────────────────────────────────┘
```

### Feature 1: `[👁️ 영향 노드만 격리 보기 (Isolate Mode)]` 토글
* **위치**: 하단 `ImpactStatsBar.tsx` 내부 컨트롤 영역.
* **상태 관리**: `isImpactIsolated: boolean` (기본값: `false`).
* **동작 흐름**:
  1. 테스터가 `[👁️ 격리 보기]` 버튼 클릭 시 `isImpactIsolated`가 `true`로 전환됩니다.
  2. React Flow 최상위 컨테이너에 `.is-isolated` 클래스가 추가됩니다.
  3. **CSS 가시성 제어 (`index.css`)**:
     ```css
     /* 격리 모드 활성화 시 영향받지 않는 노드 및 엣지를 완전 은닉 */
     .has-impact.is-isolated .react-flow__node:not(.impact-highlighted):not(.impact-source) {
       display: none !important;
     }
     .has-impact.is-isolated .react-flow__edge:not(.impact-edge) {
       display: none !important;
     }
     ```
  4. **카메라 자동 맞춤 (Auto FitView)**:
     * 격리 모드 진입 즉시 매칭된 영향 노드 ID 목록을 기준으로 React Flow의 `fitView`를 호출합니다:
     ```typescript
     reactFlowInstance.fitView({
       nodes: matchedNodes.map(id => ({ id })),
       duration: 400,
       padding: 0.25,
     });
     ```
  5. 토글 OFF 시: 숨겨졌던 모든 노드가 다시 나타나고(기존 0.15 딤 상태), 전체 캔버스 뷰포트로 부드럽게 복귀합니다.

---

### Feature 2: `[📋 영향 노드 목록 네비게이터 (List & Fly-to)]` 드로어
* **위치**: 하단 `ImpactStatsBar` 우측 또는 `GlobalsTab` 내부.
* **동작 흐름**:
  1. `[📋 목록 보기]` 클릭 시 하단 바 상단으로 플로팅 카드 리스트(Drawer/Popover)가 열립니다.
  2. **목록 아이템 구성**:
     * 상태 뱃지: `🟢 통과`, `🔴 결함`, `🟡 차단`, `⚪ 미검증`
     * 노드 라벨: `Screen`, `Feature`, `Content` 등
     * 노드 이름: `n.data.name`
     * 부모 소속 (있는 경우): `📦 소속 부모 화면명`
  3. **클릭 시 인터랙션 (Fly-to)**:
     * 목록에서 특정 항목 클릭 시 캔버스 카메라가 해당 노드를 화면 중앙에 두고 부드럽게 줌인(Zoom-in) 이동합니다:
     ```typescript
     reactFlowInstance.setCenter(node.position.x + width / 2, node.position.y + height / 2, {
       zoom: 1.1,
       duration: 350,
     });
     ```
     * 해당 노드에 `.highlight-selected` 스타일이 임시 적용되어 즉각적인 시각적 피드백을 제공합니다.

---

### Feature 3: Impact 활성화 시 1회 자동 뷰포트 맞춤 (Auto FitView on Activation)
* `GlobalsTab.tsx`에서 특정 전역 노드의 `Impact` 버튼을 누르면:
  * 캔버스가 기존 위치에 머무르지 않고, 매칭된 노드들을 한 화면에 담을 수 있도록 1회 자동 `fitView`를 실행합니다:
  ```typescript
  if (matchedNodeIds.length > 0) {
    reactFlowInstance.fitView({
      nodes: matchedNodeIds.map(id => ({ id })),
      duration: 300,
      padding: 0.2,
    });
  }
  ```

---

## 4. Alternatives & Future Explorations (대안 탐색 및 추가 아이디어)

추후 기능을 구현할 AI 에이전트는 위 3대 표준 기능 외에도 다음 대안 방식을 추가 탐색할 수 있습니다:

### 대안 1: 서브뷰(Sub-view / Mini Modal Canvas) 방식
* 메인 캔버스를 그대로 둔 채, 모달(Modal) 창 내에 "해당 전역 노드와 연결된 노드들만의 독립된 ELK 계층 미니 캔버스"를 띄우는 방식.
* *장점*: 메인 캔버스 뷰포트가 흐트러지지 않음.
* *단점*: 모달 창 내부에서 노드 편집/상태 마킹을 수행하려면 이중 상태 동기화 복잡도가 증가함.

### 대안 2: 사이드바 필터 패널과의 결합 (`#태그` 기반 일괄 바인딩)
* 글로벌 노드 배지 연결 시 자동으로 대상 노드들의 `aliases`에 `#Global_{Name}` 태그를 주입하고,
* 좌측/상단 검색 필터의 `#태그` 쿼리와 연동하여 Focus+Context와 자연스럽게 결합하는 방식.

---

## 5. Verification Checklist for Implementing Agents (구현 검증 체크리스트)

기능 구현 작업을 수행하는 에이전트는 다음 단계를 반드시 검증해야 합니다:

- [ ] **Tier 1 Static Checker 통과**: `backend/.venv/Scripts/python.exe scripts/check_policy.py` 실행 시 무에러 0 종료.
- [ ] **CSS Z-Index 규칙 준수**: 팝오버 및 토글 버튼에 하드코딩된 숫자 z-index 대신 `var(--z-floating-panel)` 사용.
- [ ] **Zero-JS Styling 준수**: TSX에 `style={{ display: isIsolated ? 'none' : 'block' }}` 주입 금지 (클래스 기반 제어).
- [ ] **단일 한국어 로케일**: `t.impact.isolateOn`, `t.impact.isolateOff`, `t.impact.listTitle` 등 `koKR.ts` 등록 준수.
- [ ] **Parent Screen 상향 롤업 연동**: 접힌 부모 Screen(`isCollapsed: true`) 내부에 영향받는 자식이 있는 경우, 격리 모드에서도 부모 컨테이너가 숨겨지지 않고 요약 배지(`.parent-collapse-impact-summary`)와 함께 노출되는지 확인.
- [ ] **E2E 테스트 추가**: `e2e-tests/`에 Impact 모드 활성화 ➔ 격리 토글 ➔ 비영향 노드 은닉 ➔ 목록 클릭 시 뷰포트 이동 테스트 작성.
