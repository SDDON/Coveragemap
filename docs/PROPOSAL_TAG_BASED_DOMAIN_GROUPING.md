# Feature Proposal: Tag-Based Domain Grouping & Quick Isolation Spec
## 태그/속성 기반 최상위 도메인 그룹핑 및 퀵 격리 탐색 명세서

**문서 버전:** 1.0.0  
**작성 일자:** 2026-10-26  
**대상 독자:** 개발 담당 AI 에이전트(Implementer Agent) 및 QA 리드 엔지니어  
**관련 문서:** 
- [AI_IMPLEMENTATION_SPEC.md](file:///d:/workspace/Coveragemap/AI_IMPLEMENTATION_SPEC.md)
- [UI_UX_DESIGN_SYSTEM.md](file:///d:/workspace/Coveragemap/UI_UX_DESIGN_SYSTEM.md)
- [TESTCASE_MODELING_AND_STATE_PROPAGATION.md](file:///d:/workspace/Coveragemap/docs/TESTCASE_MODELING_AND_STATE_PROPAGATION.md)
- [GLOBAL_IMPACT_ISOLATION_AND_NAVIGATION_SPEC.md](file:///d:/workspace/Coveragemap/docs/GLOBAL_IMPACT_ISOLATION_AND_NAVIGATION_SPEC.md)

---

## 1. Executive Summary & Problem Definition (문제 정의 및 제안 배경)

### 1.1. 배경 (Background)
모바일 게임 QA 프로세스에서 게임의 **메인 로비(메인 메뉴)**는 상점, 인벤토리, 던전, 우편, 설정, 길드, 퀘스트 등 수십 개의 서브 시스템으로 연결되는 대표적인 허브(Hub) 화면입니다.

현재 CoverageMap에서 이러한 허브 구조를 연결하면 노드가 방사형으로 급증하는 **허브 앤 스포크 폭발(Hub-and-Spoke Explosion)** 및 **극단적인 가로/세로 캔버스 비대화** 문제가 발생합니다.

### 1.2. 물리적 중첩의 한계와 Depth=1 원칙의 충돌 (Core Architecture Dilemma)
이 문제를 해결하기 위해 '캐릭터 성장 관리'라는 시각적 부모 컨테이너(Parent Node)로 '영웅 목록', '가방' 등의 노드를 묶는 방식을 고려할 수 있으나, 다음과 같은 아키텍처적 한계에 부딪힙니다:

1. **하위 컴포넌트의 존재**: 
   * `영웅 목록(Screen)` 자체도 이미 내부에 장비 장착, 스킬 강화, 각성, 필터 등 수많은 `Component(자식)`들을 포함하고 있습니다.
2. **`Max Depth = 1` 제약 위반**:
   * `영웅 목록(Screen)`을 `캐릭터 성장 관리` 부모 박스 안에 넣으면 **[부모 ➔ 자식 ➔ 손자] (Depth ≥ 2)** 구조가 됩니다.
   * `AGENTS.md` Rule 10에 명시된 대로, React Flow 및 ELK.js 레이아웃 환경에서 Depth ≥ 2 중첩은 좌표계 왜곡, 드래그 시 자식 이탈, 줌/패닝 렌더링 붕괴를 초래하므로 절대적으로 금지됩니다.

### 1.3. 제안의 핵심 가치 (Core Proposal)
따라서 화면 캔버스에 물리적 중첩 박스를 겹겹이 쌓는 대신, **노드의 메타데이터(속성 `domain` 및 태그 `aliases`)를 활용한 "논리적 최상위 도메인 그룹핑(Logical Domain Grouping)"**과 **"원클릭 도메인 퀵 격리 탐색(Quick Domain Isolation)"** 시스템을 구축합니다.

---

## 2. Core Requirements & Architecture Principles (핵심 설계 원칙)

본 기능을 구현하는 에이전트는 다음 시스템 규칙을 반드시 준수해야 합니다:

1. **Max Depth = 1 불변 원칙 (Never violate Depth=1)**:
   * `Screen ➔ Component`의 1단계 물리적 컨테이너 구조를 유지하며, 최상위 도메인은 물리적 DOM 중첩이 아닌 **논리적 메타데이터 계층**으로 처리합니다.
2. **Zero-JS Styling & Focus+Context 준수 (AI_IMPLEMENTATION_SPEC Rule 1)**:
   * React 컴포넌트에서 인라인 스타일로 투명도(`opacity`)나 좌표를 계산하지 않고, 캔버스 최상위 클래스(`.domain-active`, `.domain-isolated`) 및 순수 CSS 선택자로 가시성을 제어합니다.
3. **12-Tier Z-Index 토큰 준수 (AI_IMPLEMENTATION_SPEC Rule 2)**:
   * 신규 캔버스 컨트롤(도메인 바, 칩 등)은 `--z-canvas-controls (100)` 또는 `--z-floating-panel (200)` 토큰만을 사용합니다.
4. **i18n 중앙화 준수 (check_policy Rule 6)**:
   * 모든 신규 UI 텍스트(도메인 라벨, 툴팁, 버튼)는 `frontend/src/locales/koKR.ts`(`t.domain.*`)에 등록하여 호출합니다.
5. **비파괴적 레이아웃 (Non-Destructive Viewport Navigation)**:
   * 도메인 선택 시 노드의 영구 좌표를 훼손하지 않고, React Flow의 `fitView({ nodes: domainNodes, duration: 400 })`를 활용해 관심 영역으로 부드럽게 카메라를 이동합니다.

---

## 3. Detailed Feature Specifications (상세 기능 명세)

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Canvas Top Floating Area]                                             │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 🏷️ 도메인: [전체 보기] [⚔️ 전투 (4)] [🎒 성장 (6)] [💎 상점 (3)]  [⚙️] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│   ┌───────────────┐     Transition      ┌─────────────────────────┐    │
│   │ 🏠 메인 로비    │ ─────────────────▶ │ 🎒 영웅 목록 (Screen)     │    │
│   │ [Screen]      │                     │ [도메인: 성장 / Emerald]  │    │
│   └───────────────┘                     │  - 장비 장착 (Component) │    │
│           │                             │  - 스킬 강화 (Component) │    │
│           │ Transition                  └─────────────────────────┘    │
│           ▼                                                            │
│   ┌─────────────────────────┐                                          │
│   │ 🎒 가방 / 룬 (Screen)   │                                          │
│   │ [도메인: 성장 / Emerald]  │                                          │
│   └─────────────────────────┘                                          │
└────────────────────────────────────────────────────────────────────────┘
```

### Feature 1: 캔버스 상단 '퀵 도메인 필터 바' (`DomainFilterBar.tsx`)
* **위치**: 캔버스 상단 중앙 컨트롤 영역 (`z-index: var(--z-canvas-controls)`).
* **구성 요소**:
  1. `[전체 보기 (All)]`: 기본 활성화 상태. 모든 노드가 기본 Focus+Context 규칙에 따라 표시됨.
  2. `도메인 칩 버튼 목록`: 그래프에 존재하는 도메인(예: `전투`, `성장`, `상점`, `시스템`, `미분류`)을 자동 집계하여 칩으로 노출.
  3. `도메인 요약 배지`: 각 도메인 칩에 `(노드 N개)` 및 결함 포함 여부(🔴 인디케이터) 노출.
  4. `[👁️ 격리 모드 (Isolate)]` 토글: 비활성 도메인을 90% 딤 처리할지, 완전히 화면에서 숨길지(Display: none) 전환.
* **상호작용 흐름**:
  1. 테스터가 `[🎒 성장 (6)]` 칩을 클릭.
  2. `selectedDomain = 'Growth'`로 상태 변경.
  3. **캔버스 반응**:
     - `Growth` 도메인에 속한 Screen/Component 노드와, 이들과 직접 연결된 허브 노드(메인 로비)만 100% 선명하게 표시.
     - 타 도메인(전투, 상점, 시스템 등) 노드는 CSS에 의해 `.dimmed-by-domain`으로 반투명 처리(격리 모드 ON 시 숨김).
  4. **카메라 피팅**: `reactFlow.fitView`를 호출하여 성장 도메인 노드들이 화면 한가운데 오도록 부드럽게 줌/팬 자동 조정.

---

### Feature 2: 도메인 시맨틱 컬러 코딩 & 카테고리 칩 (`CoverageNode.tsx`)
* **목적**: 캔버스를 줌아웃하더라도 색상만으로 어떤 도메인군인지 0.1초 만에 식별.
* **노드 카드 비주얼 명세**:
  * 노드 카드 좌측에 **4px 도메인 엑센트 바(Accent Bar)** 노출.
  * 노드 헤더 상단 라벨 옆에 **도메인 칩(Domain Badge)** 노출 (예: `🎒 성장`, `⚔️ 전투`).
* **도메인 표준 컬러 팔레트 (CSS 변수 정의)**:
  * `--domain-battle`: `#e11d48` (Rose/Ruby Red - 전투/코어루프)
  * `--domain-growth`: `#059669` (Emerald Green - 성장/캐릭터/가방)
  * `--domain-economy`: `#7c3aed` (Violet/Purple - 상점/재화/가챠)
  * `--domain-social`: `#0284c7` (Sky/Ocean Blue - 길드/친구/채팅)
  * `--domain-system`: `#475569` (Slate - 설정/보안/계정)
  * `--domain-custom`: `#d97706` (Amber - 기타 사용자 지정 도메인)

---

### Feature 3: 인스펙터 편집기 도메인 관리 (`EditNodeForm.tsx`)
* **위치**: 우측 인스펙터 패널의 노드 수정 폼.
* **UI 필드**: "최상위 도메인 (Domain / Category)" 입력 드롭다운.
  * 프리셋 선택: `[선택 안 함]`, `⚔️ 전투 (Battle)`, `🎒 성장 (Growth)`, `💎 상점 (Economy)`, `👥 소셜 (Social)`, `⚙️ 시스템 (System)`.
  * 사용자 직접 입력(Custom) 가능 (`<input list="domain-presets" />`).
* **저장 및 동기화**:
  * 노드의 `data.properties.domain`에 저장.
  * 기존 `aliases` 태그와도 자연스럽게 연동되어 검색창 `#Growth` 검색 시에도 동일하게 하이라이트 지원.

---

## 4. Technical Architecture & File Changes (구현 세부 계획)

### 4.1. 변경 대상 파일 목록
1. **`frontend/src/locales/koKR.ts`**:
   - `t.domain.*` i18n 텍스트 키 등록 (버튼명, 툴팁, 도메인 프리셋 이름).
2. **`frontend/src/types/graph.ts`**:
   - `CoverageNodeData` 인터페이스에 `domain?: string;` 추가.
3. **`frontend/src/index.css`**:
   - 도메인별 컬러 변수(`--domain-*`) 및 엑센트 바 스타일.
   - 도메인 활성화 컨테이너 클래스(`.domain-active`, `.domain-isolated`) 및 비활성 노드 딤/숨김 스타일.
4. **`frontend/src/components/Canvas/DomainFilterBar.tsx`** *(신규 생성)*:
   - 도메인 칩 목록 집계 및 클릭 이벤트, 격리 토글 렌더링.
5. **`frontend/src/CoverageNode.tsx`**:
   - 좌측 엑센트 바 및 헤더 도메인 뱃지 렌더링.
6. **`frontend/src/components/Inspector/EditNodeForm.tsx`**:
   - 도메인 선택/입력 폼 컨트롤 추가 및 상태 업데이트 핸들러 연동.
7. **`frontend/src/hooks/useFocusContext.ts`**:
   - `selectedDomain`에 따른 노드/엣지 활성화 여부 판정 로직 결합.

### 4.2. CSS 가시성 제어 규격 (`frontend/src/index.css`)
```css
/* 도메인 컬러 토큰 */
:root {
  --domain-battle: #e11d48;
  --domain-growth: #059669;
  --domain-economy: #7c3aed;
  --domain-social: #0284c7;
  --domain-system: #475569;
  --domain-custom: #d97706;
}

/* 도메인 필터 활성화 시 비선택 노드 딤 처리 */
.react-flow.domain-active .custom-node:not(.domain-matched):not(.domain-hub) {
  opacity: 0.12;
  filter: grayscale(0.8);
  pointer-events: none;
  transition: opacity 0.2s ease, filter 0.2s ease;
}

/* 완전 격리 모드 활성화 시 비선택 노드 숨김 */
.react-flow.domain-active.domain-isolated .custom-node:not(.domain-matched):not(.domain-hub) {
  display: none !important;
}

/* 노드 좌측 엑센트 바 */
.custom-node .node-domain-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  border-top-left-radius: inherit;
  border-bottom-left-radius: inherit;
}
```

---

## 5. Verification Checklist & 3-Tier Policy (검증 파이프라인 가이드)

다음 에이전트는 구현 완료 후 반드시 3-Tier 검증 파이프라인을 통과해야 합니다:

### Tier 1: Static Policy Checker
* 실행 명령어: `python scripts/check_policy.py` (또는 `uv run python scripts/check_policy.py`)
* 무결성 검증 항목:
  - `frontend/src/` 내부 한글 하드코딩 금지 (모든 문구는 `koKR.ts`의 `t.domain.*`을 거쳐야 함).
  - 12-Tier Z-index 토큰 준수 (숫자 하드코딩 금지).
  - 인라인 스타일링 금지 (Focus+Context CSS 클래스 기반).

### Tier 2: Automated Tests
* 실행 명령어:
  - 백엔드: `cd backend && uv run pytest -q`
  - E2E: `cd e2e-tests && npm test`
* 모든 테스트 패스 및 회귀 결함 0건 확인.

### Tier 3: Human Signoff Checklist
1. 메인 로비에 연결된 다수의 Screen 노드 중 특정 도메인을 클릭했을 때 해당 화면들만 강조되고 뷰포트가 자동으로 중심을 잡는가?
2. `isCollapsed: true`로 접힌 Screen 노드도 도메인 필터링 시 정상적으로 포함되는가?
3. 도메인 격리 모드(`Isolate`)를 켰을 때 비관련 노드가 깔끔하게 화면에서 사라져 가로/세로 복잡도가 즉시 해소되는가?

---

## 6. Implementation Prompt for the Next AI Agent

다음 작업을 수행할 AI 에이전트에게 전달할 프롬프트 예시:

```markdown
docs/PROPOSAL_TAG_BASED_DOMAIN_GROUPING.md 문서를 바탕으로 '태그/속성 기반 최상위 도메인 그룹핑 및 퀵 격리 탐색' 기능을 구현해 주세요.

[요구사항]
1. docs/PROPOSAL_TAG_BASED_DOMAIN_GROUPING.md의 4.1 항목에 나열된 모든 변경 대상 파일을 순서대로 수정/생성하세요.
2. AGENTS.md 및 AI_IMPLEMENTATION_SPEC.md의 모든 규칙(Pure CSS Zero-JS Styling, 12-Tier Z-Index 토큰, koKR.ts 단일 로케일 i18n, Max Depth=1 유지)을 엄격히 준수하세요.
3. 구현 완료 후 scripts/check_policy.py와 E2E/백엔드 테스트를 통과하고 검증 결과를 보고해 주세요.
```
