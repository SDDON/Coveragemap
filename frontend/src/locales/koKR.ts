// UI 문구 단일 관리 지점 (AGENTS.md 규칙 3: 한국어 단일, 문구는 locale 파일에서 참조)
// 영어가 필요해지면 enUS.ts를 같은 구조로 추가하고 I18N_LOCALES에 등록합니다.

export const koKR = {
  // Living TC 4단계 상태 라벨
  status: {
    Untested: '미검증',
    Passed: '통과',
    Failed: '실패',
    Blocked: '차단됨',
  },

  // 공통 버튼
  common: {
    edit: '수정',
    delete: 'Delete',
    save: 'Save',
    create: 'Create',
    ok: '확인',
    close: '닫기',
    cancel: '취소',
    closeWithIcon: '✕ Close',
  },

  // 워크스페이스 선택 화면 / 상단 표시 (Workspace 관리자 모달은 FEATURE_PRUNING_GUIDE 3.2에 따라 제거됨)
  workspace: {
    selectTitle: 'Select Workspace',
    selectGuide: '작업할 도메인(모듈)을 선택하세요. 선택한 도메인과 1~2 Depth 내의 경계 노드들만 로드되어 최적의 성능으로 작업할 수 있습니다.',
    dontShowAgain: '다시 보지 않기 (자동 진입)',
    loadPreset: '📂 샘플 프리셋 로드',
    loadAll: '전체 그래프 로드 (Heavy)',
    all: '전체 워크스페이스',
    none: 'None',
  },

  // 상단 툴바 버튼 툴팁
  // (Cypher Export / Grid Layout 문구는 FEATURE_PRUNING_GUIDE 1순위 정리로 기능과 함께 제거됨)
  toolbar: {
    addNode: 'Add Node',
    currentWorkspace: 'Current:',
    switchWorkspace: '워크스페이스(도메인) 선택 화면 열기',
    switchWorkspaceBtn: 'Switch Workspace',
    presets: '샘플 프리셋 및 데이터셋 관리자를 엽니다.',
    presetsBtn: '📂 Presets',
    help: '도움말 및 범례 (Help & Legend)',
    relayout: '선택된 노드만 또는 전체를 자동 정렬합니다',
    relayoutBtn: '⟳ Re-layout',
  },

  // 우측 패널 ? 아이콘 툴팁
  tooltip: {
    filterGraph: '선택한 카테고리(Alias)에 해당하는 노드들만 캔버스에 표시합니다.',
    searchHighlight: '노드(이름·라벨·별칭·도메인·속성) 및 엣지(연결 타입·액션/트리거·커스텀 속성)를 검색해 일치하는 항목과 의존성 흐름을 하이라이트합니다.',
    visibilityFilter: '체크한 타입의 노드들만 캔버스에 표시합니다.',
    maxDepth: '선택한 노드로부터 지정한 단계(Depth)까지만 연관 노드를 표시합니다.',
    hideUnconnectedEdges: '노드 선택 또는 포커스 시, 관심 범위와 직접 연결되지 않은 배경 간선들을 완전히 숨겨 복잡한 그래프에서의 가독성을 높입니다.',
    overviewMode: '모든 상위 화면(Parent)의 하위 컴포넌트를 한 번에 접어 상위 수준 흐름만 보거나 다시 펼칩니다. 접힌 상태에서는 하위 연결선이 상위 대리 간선(Proxy Edge)으로 자동 위임됩니다.',
    nodeLabel: '노드의 역할을 나타내는 주요 타입입니다. (Feature, Screen, Popup, Component, Content, System, Data, TestCase, Node)',
    nodeName: '노드에 표시될 실제 이름입니다.',
    nodeCategory: '그룹화나 검색에 쓰이는 카테고리 태그(Alias)입니다.',
    nodeDomain: '허브 앤 스포크 복잡도를 줄이기 위한 논리적 최상위 도메인 분류입니다 (Max Depth=1 유지).',
    globalNode: '체크 시 이 노드는 캔버스에서 숨겨지고, 이 노드와 연결된 다른 노드들의 하단에 뱃지(Pill) 형태로 표시됩니다.',

    status: '현재 테스트/개발 상태를 나타냅니다. 선행 Depends_On 실패 시 하류는 Blocked로 자동 전파되며, Mark Blocked로 사유와 함께 수동 고정(📌)할 수 있습니다.',
    checklist: '하위 노드를 새로 분기하지 않고 화면 내부의 정적 UI·텍스트·딤(Dimmed) 명세를 체크리스트로 검증합니다. 항목 결과에 따라 노드 상태가 자동 판정됩니다.',
    changeImpact: '기획/스펙 변경 시 노드를 보라색 펄스로 강조하고 하류 1~2단계(Return 제외) 의존 노드에 재검증 영향권을 표시합니다.',
    nodeClone: '선택한 노드와 내부 Contains 자식·체크리스트·글로벌 배지 연결을 새 환경 태그(#아레나 등)로 복제하고 상태를 미검증으로 초기화합니다. (단축키: Ctrl+C / Ctrl+V)',
    edgeType: 'Transition(화면 이동), Contains(부모-자식 포함), Displays(노출), Depends_On(선행 의존 전파), Triggers(이벤트 호출), Tests(TC 검증 전파), Return(복귀, 전파 제외) 등 연결 성격을 지정합니다.',
    actionTrigger: '이 연결선(화면 전환/호출)을 발생시키는 사용자 조작이나 시스템 조건(예: 뒤로가기 버튼 클릭, 재화 부족 시)을 기록합니다.',
    domainBar: '최상위 도메인(전투/성장/상점 등)별로 노드를 색상 구분하고, 칩 클릭 시 해당 도메인과 연결 허브만 필터링·격리합니다.',
    globalNodes: '전역 노드를 다른 노드에 부착(Attach)하거나, 해당 전역 노드에 의존하는 모든 노드(Impact)를 시각화합니다.',
  },

  // 노드 라벨 선택지 (value는 영문 라벨 그대로, 표시만 한국어 병기)
  nodeLabel: {
    Feature: 'Feature (기능)',
    Screen: 'Screen (화면)',
    Popup: 'Popup (팝업/모달)',
    Content: 'Content (콘텐츠)',
    System: 'System (시스템)',
    Component: 'Component (컴포넌트)',
    Data: 'Data (데이터)',
    TestCase: 'TestCase (테스트케이스)',
    Node: 'Node (기본)',
  },

  // 엣지 타입 선택지
  edgeType: {
    Transition: 'Transition (화면 이동)',
    Contains: 'Contains (포함)',
    Displays: 'Displays (표시)',
    Depends_On: 'Depends_On (의존)',
    Triggers: 'Triggers (호출)',
    Tests: 'Tests (검증)',
    Return: 'Return (복귀)',
  },

  // 노드 편집 폼
  nodeForm: {

    parentLabel: (name: string) => `📦 소속 부모: ${name}`,
    changeRelation: '🔗 관계 변경',
    changeRelationTitle: '부모-자식 Contains 연결선을 선택하여 관계 타입(Transition 등)이나 상태를 변경합니다.',
    detachParent: '⏏ 분리',
    detachParentTitle: '부모 컨테이너에서 이 노드를 즉시 분리(Contains 엣지 삭제)합니다.',
  },

  // 노드 및 하위 구조(Contains) 복제
  nodeClone: {
    openButton: '📋 노드 복제',
    guide: '선택한 노드와 내부 Contains 자식·체크리스트·글로벌 배지 연결을 새 태그로 복제하고 모든 상태를 미검증(Untested)으로 초기화합니다. (외부 화면 연결선은 제외)',
    tagLabel: '복제 환경/컨텐츠 태그',
    tagPlaceholder: '예: #아레나 (미입력 시 #복사본)',
    confirmButton: '복제 생성',
    failed: '노드 복제에 실패했습니다.',
  },

  // 📌 수동 차단 (Manual Override, TESTCASE 스펙 4.3)
  override: {
    reasonLabel: '차단 사유',
    reasonPlaceholder: '차단 사유 (필수) 예: 빌드 미제공, 테스트 기기 없음',
    confirm: '📌 차단 확정',
    cancel: '취소',
    hint: '수동 차단된 노드는 선행 노드가 바뀌어도 자동 계산으로 덮어쓰지 않습니다.',
    pinnedLabel: '수동 고정됨',
    noReason: '(사유 없음)',
    releaseHint: 'Mark Passed / Mark Failed / Reset Status를 누르면 고정이 해제됩니다.',
    pinTitle: (reason: string) => `📌 수동 고정: ${reason}`,
  },

  // B안 노드 내부 체크리스트 (TESTCASE 스펙 3.3)
  checklist: {
    title: '세부 체크리스트 (Verification Checklist)',
    empty: '등록된 검증 항목이 없습니다. 단순 UI 검증 항목은 노드를 새로 만들지 말고 여기에 추가하세요.',
    itemLabel: '검증 항목 내용',
    itemPlaceholder: '검증 항목 입력 (Enter 저장 · Shift+Enter 줄바꿈)',
    changeStatus: '검증 결과 변경',
    deleteItem: '항목 삭제',
    addItem: '+ 새 검증 항목 추가',
    autoStatusHint: '항목 결과에 따라 노드 상태가 자동 판정됩니다. (실패 > 차단 > 모두 통과 > 미검증)',
    badgeAllPassed: (passed: number, total: number) => `🟢 ${passed}/${total} (${total ? Math.round((passed / total) * 100) : 0}%)`,
    badgeFailed: (failed: number, total: number) => `🔴 ${failed} 결함 / ${total} 항목`,
    badgeBlocked: (blocked: number, total: number) => `🟡 ${blocked} 차단 / ${total} 항목`,
    badgeProgress: (passed: number, total: number) => `⚪ ${passed}/${total} (${total ? Math.round((passed / total) * 100) : 0}%)`,
  },

  // 변경 영향도 강조 (Change Impact Ripple, AI_IMPLEMENTATION_SPEC 4.4)
  modified: {
    sectionTitle: '변경 영향도 (Change Impact)',
    bannerTitle: '변경 내역',
    noNote: '(메모 없음)',
    modifiedAt: '변경 시각:',
    acknowledge: '✓ 변경사항 확인 완료 (Acknowledge)',
    noteLabel: '변경 메모',
    notePlaceholder: '변경 메모 예: 상점 바로가기 버튼 UI 개편 (GAME-1234)',
    markButton: '✨ 변경 표시',
    hint: '변경 표시된 노드는 보라색 펄스로, 하류 1~2단계 노드/엣지는 영향권으로 강조됩니다. 확인 완료해도 테스트 상태는 바뀌지 않습니다.',
    saveFailed: '변경 표시 상태를 저장하지 못했습니다.',
    chip: '✨ [Spec Updated]',
  },

  // 부모 노드 접기/펼치기 요약 배지 (AI_IMPLEMENTATION_SPEC 4.1 / COLLAPSED_SCREEN_IMPACT_HIGHLIGHT_SPEC 4.3)
  parentCollapse: {
    summary: (passed: number, failed: number, blocked: number, total: number) => {
      const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
      const blockedPart = blocked > 0 ? ` / 🟡 차단: ${blocked}` : '';
      return `🟢 통과: ${passed} / 🔴 결함: ${failed}${blockedPart} (${pct}%)`;
    },
    affectedChildCount: (count: number) => `⚡ 영향 하위 컴포넌트 ${count}개`,
    collapseAllBtn: '📦 하위 그룹 접기',
    expandAllBtn: '📂 하위 그룹 펼치기',
    collapseAllTitle: '개괄적인 상위 흐름만 볼 수 있도록 모든 부모 화면의 하위 컴포넌트를 접고 간선을 상위 노드로 위임합니다.',
    expandAllTitle: '접혀 있는 모든 상위 화면의 하위 컴포넌트를 다시 펼칩니다.',
  },

  // 결함 원인 역추적 (Root Cause Tracing, AI_IMPLEMENTATION_SPEC 3.3)
  rootCause: {
    traceButton: '🔍 결함 원인 역추적 (Trace Root Cause)',
    clearButton: '✕ 역추적 하이라이트 해제',
    banner: (count: number) => `🚨 선행 결함/차단 경로 ${count}개 노드를 역추적하여 캔버스에 강조 표시 중입니다.`,
  },

  // 화면(Screen/Container) 단위 다국어 스코프 감사 (CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 3.2 & 4.1)
  scopedAudit: {
    startButton: '🌐 이 화면 다국어 검증 모드',
    clearButton: '✕ 다국어 검증 모드 해제',
    banner: (matchedCount: number, totalCount: number) =>
      `🌐 이 화면 및 하위 다국어(Localization) 검증 대상 ${matchedCount}개 노드를 집중 하이라이트 중입니다. (범위 내 전체: ${totalCount}개)`,
    faultChip: (name: string) => `🏷️ [${name}: 결함]`,
    keywords: ['localization', 'i18n', 'l10n', '다국어', '언어', '번역'],
  },

  // 전역 공통 노드(Badge) 설정
  globalNode: {
    title: '🌐 전역 공통 노드 (Badge화)',
    notAllowed: 'System, Screen, Feature 등 큰 단위의 노드는 전역 노드화할 수 없습니다.',
    hintBefore: '체크 시 이 노드는 캔버스에서 숨겨지고, 이 노드와 연결된 다른 노드들의 하단에 ',
    hintBadge: '뱃지(Pill)',
    hintAfter: ' 형태로 표시됩니다.',
    hintUsage: '다국어(I18N), 공통 데이터 등 여러 노드에서 반복 연결되는 글로벌 의존성에 사용하세요.',
    hintClick: '뱃지를 클릭하면 테스트 상태를 변경할 수 있습니다.',
    uncheckHint: '체크를 해제하고 저장하면 일반 캔버스 노드 및 연결선으로 복원됩니다.',
    unlinkConfirm: '정말 이 뱃지와의 연결(Edge)을 해제하시겠습니까?\n(글로벌 뱃지 원본 데이터는 삭제되지 않습니다.)',
    editButton: '✎ 편집',
    editButtonTitle: (name: string) => `${name} 전역 노드 편집 / 전역 해제`,
    panelTitle: 'Global Nodes',
    panelGuide: 'Attach global nodes as badges to the currently selected node.',
    empty: 'No global nodes found.',
    impactTooltip: (name: string) => `Show impact: which nodes are affected by ${name}`,
    impactOn: '🔍 ON',
    impactButton: '🔍 Impact',
    attach: '[+] Attach',
    attachTooltip: (name: string) => `Attach to ${name}`,
    attachNoSelectionTooltip: 'Select a node on the canvas first to attach',
    createNew: 'Create New Global Node',
    newPlaceholder: 'e.g. Common Login',
    disconnectEdge: 'Disconnect Dependency (Edge only)',
  },

  // 원거리 노드 간 빠른 연결 (Quick Connect 팝오버 & 2-Step 타겟 클릭 모드)
  quickConnect: {
    title: (sourceName: string) => `🔗 ${sourceName} → 대상 노드 연결`,
    edgeTypeLabel: '연결 타입',
    searchPlaceholder: '대상 노드 이름 또는 #별칭 검색 (Enter로 즉시 연결)',
    emptyResult: '조건에 맞는 대상 노드가 없습니다.',
    pickOnCanvasButton: '🎯 캔버스에서 직접 클릭해 선택',
    startButton: '🔗 다른 노드에 연결 시작',
    pendingBanner: (sourceName: string, edgeType: string) =>
      `🔗 [${sourceName}]에서 (${edgeType}) 연결 중 — 연결할 대상 노드를 클릭하세요`,
    cancelPending: '취소 ✕',
    alreadyConnectedSame: (edgeType: string) => `⚠️ 동일 연결됨 (→ ${edgeType})`,
    alreadyConnectedOut: (edgeType: string) => `🔗 연결됨 (→ ${edgeType})`,
    alreadyConnectedIn: (edgeType: string) => `🔗 연결됨 (← ${edgeType})`,
    alreadyAttachedBadge: '🏷️ 배지 부착됨',
    newNodeLabelSelectTitle: '새로 생성할 노드의 타입(Label)',
    createAndConnectBtn: (name: string, edgeType: string) => `➕ "${name}" 새 노드 생성 후 (${edgeType}) 연결`,
  },

  // 캔버스 우클릭 메뉴
  contextMenu: {
    addNode: '➕ 새 노드 추가',
    fitView: '⤢ 전체 화면 맞춤',
    refresh: '🔄 새로고침',
  },

  // 특정 콘텐츠 중심 확인 및 포커스 고정 (Content Focus Pinning — 기존 Workspace 관리자 모달은 제거됨)
  contentFocus: {
    pinButton: '📌 이 콘텐츠 포커스 고정',
    unpinButton: '📌 포커스 고정 해제',
    banner: (name: string) => `📌 집중 콘텐츠: ${name}`,
    unpinBannerButton: '고정 해제 ✕',
  },

  // 전역 노드 영향도(Impact) 표시 (다중 Global Node 5색 슬롯, OR/AND 교집합 필터, 격리 보기 & 네비게이터)
  impact: {
    affected: (count: number) => `영향 받는 노드 ${count}개`,
    modeOr: '합집합 (OR)',
    modeAnd: '교집합 (AND)',
    modeOrTitle: '선택한 전역 노드 중 하나라도 연결된 노드를 모두 표시합니다',
    modeAndTitle: '선택한 전역 노드들이 모두 동시에 연결된 교집합 노드만 표시합니다',
    removeChipTitle: (name: string) => `${name} 영향도 강조 해제`,
    isolateOn: '👁️ 격리 보기 ON',
    isolateOff: '👁️ 격리 보기 OFF',
    isolateTitle: '영향 받는 노드와 엣지만 화면에 남기고 비관련 요소를 숨깁니다',
    listToggleOpen: (count: number) => `📋 목록 보기 (${count}) ▲`,
    listToggleClose: (count: number) => `📋 목록 닫기 (${count}) ▼`,
    listTitle: '영향 받는 노드 네비게이터',
    listEmpty: '조건에 일치하는 영향 노드가 없습니다.',
    flyToHint: '클릭하여 해당 노드 위치로 카메라 이동',
    parentBadge: (parentName: string) => `📦 ${parentName}`,
  },

  // 태그/속성 기반 최상위 도메인 그룹핑 및 퀵 격리 탐색 (PROPOSAL_TAG_BASED_DOMAIN_GROUPING.md)
  domain: {
    barLabel: '🏷️ 도메인:',
    all: '전체 보기',
    unassigned: '미분류',
    isolateOn: '👁️ 격리 ON',
    isolateOff: '👁️ 격리 OFF',
    isolateTitle: '선택한 도메인과 연결 허브 노드만 화면에 남기고 타 도메인 노드를 숨깁니다',
    fieldLabel: '최상위 도메인 (Domain):',
    fieldPlaceholder: '도메인 선택 또는 직접 입력 (예: Battle, Growth, 상점)',
    noneOption: '선택 안 함',
    chipCount: (label: string, count: number) => `${label} (${count})`,
    presets: {
      Battle: '⚔️ 전투',
      Growth: '🎒 성장',
      Economy: '💎 상점',
      Social: '👥 소셜',
      System: '⚙️ 시스템',
    },
    keywords: {
      battle: ['battle', '전투', '던전', '아레나', '레이드'],
      growth: ['growth', '성장', '영웅', '캐릭터', '장비', '가방'],
      economy: ['economy', '상점', '재화', '결제', '가챠', '소환'],
      social: ['social', '소셜', '길드', '친구', '채팅', '우편'],
      system: ['system', '시스템', '설정', '계정', '보안', '로그인'],
    },
    tagPrefixes: ['domain:', '도메인:'],
  },

  // 도움말 모달
  help: {
    title: 'CoverageMap 가이드',
    highlightTitle: '🌈 하이라이트 색상 (의존성 방향)',
    incomingTitle: '🔵 파란색 테두리 (Incoming)',
    incomingBody: '선택/검색된 노드로 들어오는(진입하는) 흐름입니다. 즉, 이 노드가 동작하기 위한 선행 조건이나 상위 진입점을 의미합니다.',
    outgoingTitle: '🟠 주황색 테두리 (Outgoing)',
    outgoingBody: '선택/검색된 노드에서 뻗어 나가는 흐름입니다. 해당 노드에서 파생되는 하위 결과물이나 다음 단계를 의미합니다.',
    statusTitle: '✅ 노드 테스트 상태 (Test Status)',
    untestedTitle: '⬜ 흰색 (Untested)',
    untestedBody: '아직 테스트되지 않은 항목입니다.',
    passedTitle: '🟢 초록색 (Passed)',
    passedBody: '테스트를 성공적으로 통과한 항목입니다.',
    failedTitle: '🔴 빨간색 (Failed)',
    failedBody: '테스트에 실패한(버그가 발견된) 항목입니다.',
    // 기존 범례에서 누락되어 있던 4번째 상태
    blockedTitle: '🟡 노란색 (Blocked)',
    blockedBody: '선행 항목(Depends_On)이 실패/차단되어 테스트를 진행할 수 없는 항목입니다. 하류로 자동 연쇄 전파되며, Mark Blocked로 사유와 함께 수동 고정(📌)할 수도 있습니다.',
    statusNote: '※ 대상(Component 등)을 검증하는 Tests TC와 체크리스트가 모두 Passed이면 자동으로 Passed, 하나라도 Failed면 Failed로 판정됩니다. Return(복귀) 엣지는 전파에서 제외됩니다.',
    tipsTitle: '🛠 주요 기능 팁',
    connectTitle: '선 연결 (드래그)',
    // 상/하단 핸들 → 외곽 Halo 핸들 구조로 바뀐 현재 동작 기준
    connectBody: '노드의 테두리(바깥쪽 가장자리)에서 드래그를 시작해 다른 노드 위에 놓으면 선(Edge)이 생성됩니다. 하위 노드를 품은 상위 컨테이너(Screen)에 연결할 때는 드래그 시 상단 헤더에 표시되는 점선 드롭 영역에 놓으세요.',
    highlightTipTitle: '다중 선택 하이라이트',
    highlightTipBody: '우측 패널의 Search Highlight에 단어(예: Arena)를 검색하면 해당 그룹의 의존성 흐름을 한눈에 볼 수 있습니다.',
    depthTitle: '깊이 조절 (Max Depth)',
    depthBody: '선택한 노드로부터 몇 단계(Depth)까지의 연관 관계를 볼 것인지 숫자 입력으로 조절할 수 있습니다.',
    undoTitle: 'Undo (되돌리기)',
    undoBody: 'Ctrl + Z를 눌러 최근 작업을 취소할 수 있습니다.',
    copyPasteTitle: '노드 복제 (Ctrl + C / Ctrl + V)',
    copyPasteBody: '노드 선택 후 Ctrl + C로 복사하고 Ctrl + V를 누르면 선택한 노드(및 하위 Contains 자식·체크리스트·글로벌 배지)가 #복사본으로 즉시 복제됩니다.',
    globalTitle: '🌐 전역 노드 (Global Node) 정책',
    globalTypeTitle: '타입 제약',
    globalTypeBody: 'Component, Data, TestCase 등 세부 단위의 노드만 전역 노드로 변환(Badge화)할 수 있습니다. System, Screen 등 그룹 단위의 노드는 전역 노드가 될 수 없습니다.',
    globalDeleteTitle: '삭제 제약 (Borrow Checker)',
    globalDeleteBody: '전역 노드가 하나 이상의 노드에 배지로 부착되어 사용 중일 경우, 원본을 삭제할 수 없습니다. 연결을 먼저 해제해야 합니다.',
    globalUsageTitle: '사용 방법',
    globalUsageBody: '우측 패널에서 노드를 전역 노드화한 뒤, 캔버스에서 부착할 다른 대상 노드를 선택하고 우측 패널의 Globals 탭에서 [+] Attach 버튼을 누르면 배지로 부착됩니다.',
    tabGuide: '📖 사용 가이드',
    tabChangelog: '📋 변경 이력 (Changelog)',
    changelogIntro: '버전별 주요 아키텍처 및 UI/UX 개선 내역입니다. 상세 내역은 프로젝트 루트의 CHANGELOG.md 파일에서도 확인할 수 있습니다.',
    changelogEntries: [
      {
        version: 'v0.5.1',
        date: '2026-10-27',
        title: '반화면(960×1080) 반응형 상단 HUD · 인라인 도움말 · 노드 생성 버그 수정',
        items: [
          '반화면(960×1080) 분할 환경에서 상단 툴바·도메인 바·인스펙터 패널이 겹치지 않도록 좌측 상단 2단 HUD 스택 정책 적용',
          '엣지 선택 후 Add Node 또는 빈 캔버스 우클릭(새 노드 추가) 시 노드 생성 폼이 열리지 않던 상태 전환 버그 수정',
          '전역 노드(Globals) 영향도와 중복되던 Edit 패널의 구형 다국어 검증 모드 버튼 제거 및 일원화',
          '모든 Inspector/도메인 주요 기능에 인라인 도움말(?) 툴팁 추가 및 도움말 모달 내 변경 이력(Changelog) 탭 신설',
        ],
      },
      {
        version: 'v0.5.0',
        date: '2026-10-27',
        title: '최상위 도메인 그룹핑 · 영향도 격리/네비게이터 · 대리 간선 & 빠른 연결 고도화',
        items: [
          '태그/속성 기반 최상위 논리 도메인 그룹핑(전투/성장/상점/소셜/시스템), 상단 도메인 필터 바 및 격리 보기 구현',
          '전역 노드 영향도(Impact) 격리 보기(👁️) 및 영향 노드 목록 네비게이터 드로어(클릭 시 카메라 Fly-to) 추가',
          '하위 그룹 전체 접기/펼치기(📦/📂) 및 접힌 부모 간 대리 간선(Proxy Edge) 상태·하이라이트 롤업',
          '빈 공간 드래그 Quick Connect 팝오버에서 새 노드 즉시 생성 후 연결 및 기연결 상태 배지 표시',
          '포커스 시 비연결 배경 간선 숨기기 옵션 및 노드 복제(#태그 치환) 시 즉시 캔버스 반영',
        ],
      },
      {
        version: 'v0.4.0',
        date: '2026-10-20',
        title: '다중 전역 노드 5-슬롯 영향도 · 특정 콘텐츠 포커스 고정 · 2-Step 연결',
        items: [
          '최대 5개 전역 노드 동시 영향도 비교(5색 슬롯) 및 합집합(OR) / 교집합(AND) 필터링 지원',
          '부모 화면 + 직속 자식을 Depth-0 콘텐츠 묶음(Content Unit)으로 탐색 및 포커스 고정(📌) 기능 추가',
          '원거리 노드 연결을 위한 Quick Connect 검색 팝오버 및 2-Step 캔버스 클릭 연결 모드 도입',
        ],
      },
      {
        version: 'v0.3.0',
        date: '2026-10-12',
        title: 'B안 노드 내부 체크리스트 · 스펙 변경 영향도(Ripple) · Contains 일급 엣지',
        items: [
          '그래프 폭발 방지를 위한 노드 내부 체크리스트(Verification Checklist) 및 자동 상태 합성 도입',
          '기획 변경 시 보라색 펄스(.node-modified-pulse) 및 하류 2-hop 영향권(.highlight-affected) 시각화',
          'Contains 관계를 일급 플로팅 엣지로 렌더링(평시 숨김, 선택/호버 시 점선 노출) 및 소속 부모 원클릭 분리 지원',
          '유사 환경 반복 검증을 위한 서브그래프 일괄 복제(📋 노드 복제 + Ctrl+Z Undo) 구현',
        ],
      },
      {
        version: 'v0.2.0',
        date: '2026-10-05',
        title: 'Living TC 4단계 상태 전파 엔진 · 수동 차단(📌) · 결함 원인 역추적',
        items: [
          'Untested / Passed / Failed / Blocked 4단계 상태 머신 및 Depends_On / Tests 연쇄 전파 엔진 구축',
          '사유 입력 기반 수동 차단(📌 Manual Override) 및 최초 결함 원인 역추적(Trace Root Cause) 펄스 하이라이트',
          '외곽 광륜 핸들(.halo-handle) 내부 영역 격리 및 12단계 표준 Z-Index CSS 토큰 체계 확립',
        ],
      },
    ],
  },

  // 샘플 프리셋 관리자 모달
  preset: {
    title: '샘플 프리셋 관리자 (Presets)',
    listLoadFailed: '프리셋 목록을 불러오지 못했습니다.',
    genericError: '오류가 발생했습니다.',
    loadFailed: '프리셋 로드에 실패했습니다.',
    loadSuccess: (id: string, nodes: number, edges: number) =>
      `"${id}" 프리셋이 성공적으로 로드되었습니다! (노드 ${nodes}개, 엣지 ${edges}개)`,
    loadError: '프리셋 로드 중 오류가 발생했습니다.',
    idNameRequired: '프리셋 ID와 이름을 모두 입력해주세요.',
    saveFailed: '프리셋 저장에 실패했습니다.',
    saveSuccess: '현재 그래프가 새 프리셋으로 저장되었습니다!',
    saveError: '프리셋 저장 중 오류가 발생했습니다.',
    cleanLoad: '기존 그래프 지우고 새로 불러오기 (Clean Load)',
    cleanLoadHint: '체크 해제 시 현재 열려있는 캔버스 그래프에 프리셋 노드들을 병합(Merge)합니다.',
    listLoading: '프리셋 목록을 불러오는 중...',
    empty: '저장된 프리셋이 없습니다.',
    nodeCount: (n: number) => `노드 ${n}개`,
    edgeCount: (n: number) => `엣지 ${n}개`,
    noDescription: '(설명 없음)',
    loading: '로딩 중...',
    load: '불러오기',
    saveSection: '💾 현재 캔버스 그래프를 새 프리셋으로 저장',
    idLabel: '프리셋 고유 ID (영문/숫자/언더바):',
    idPlaceholder: '예: my_game_stage1',
    nameLabel: '프리셋 표시 이름:',
    namePlaceholder: '예: 스테이지 1 전투 QA 맵',
    descLabel: '설명 (선택):',
    descPlaceholder: '프리셋에 대한 간략한 설명',
    saving: '저장 중...',
    save: '프리셋 파일 저장',
    featuredBadge: '⭐ 대규모 실전 QA 샘플',
    backupSection: (count: number) => `🕒 자동 백업 복원 목록 (${count}개)`,
  },

  // 우측 패널 (Inspector) 탭 및 폼 라벨
  inspector: {
    tabFilters: 'Filters',
    tabEdit: 'Edit',
    tabGlobals: 'Globals',
    filterGraph: 'Filter Graph',
    passedNodes: 'Passed Nodes:',
    allAliases: 'All aliases...',
    searchHighlight: 'Search Highlight',
    searchPlaceholder: 'Type to highlight nodes...',
    visibilityFilter: 'Visibility Filter',
    maxDepth: 'Max Depth',
    hideUnconnectedEdges: '포커스 시 비연결 간선 숨기기',
    overviewModeLabel: '개괄 뷰 (Parent Overview)',
    addNodeTitle: 'Add Node',
    editTitle: (type: string) => type === 'node' ? '노드 편집' : '연결선(Edge) 편집',
    label: 'Label:',
    name: 'Name:',
    nodeCategory: 'Node Category:',
    edgeType: 'Type:',
    actionTrigger: 'Action / Trigger:',
    actionPlaceholder: 'e.g. Android Back Button',
    status: 'Status:',
    markPassed: 'Mark Passed',
    markFailed: 'Mark Failed',
    resetStatus: 'Reset Status',
    markBlocked: 'Mark Blocked',
    selectPrompt: "Select a node or edge on the graph, or click 'Add Node' to start editing.",
  },

  // 시스템 헬스 상태 알약
  systemStatus: {
    online: 'System Online',
    offline: 'System Offline',
    checking: 'Checking...',
  },

  // 캔버스 상태 오버레이
  canvas: {
    noNodes: 'No nodes found.',
    loading: 'Loading Graph...',
  },

  // 개별 노드/배지 내부 라벨
  node: {
    dependencies: 'Dependencies',
    verificationGuide: (name: string) => `${name} Verification Guide`,
    markPassedTitle: 'Mark Passed',
    markFailedTitle: 'Mark Failed',
    parentDropHint: '📥 여기에 드롭하여 상위 노드에 연결',
  },

  // 에러 메시지
  error: {
    prefix: 'Error: ',
    unknown: 'An unknown error occurred.',
    deleteNodeFailed: 'Failed to delete node.',
    createNodeFailed: 'Failed to create node.',
  },
} as const;

export const I18N_LOCALES = { koKR } as const;

// 현재 활성 로케일 (한국어 단일)
export const t = I18N_LOCALES.koKR;
