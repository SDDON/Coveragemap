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
    delete: '삭제',
    ok: '확인',
    close: '닫기',
  },

  // 워크스페이스 선택 화면 / 상단 표시
  workspace: {
    selectGuide: '작업할 도메인(모듈)을 선택하세요. 선택한 도메인과 1~2 Depth 내의 경계 노드들만 로드되어 최적의 성능으로 작업할 수 있습니다.',
    dontShowAgain: '다시 보지 않기 (자동 진입)',
    openManager: '⚙️ Workspace 관리자',
    loadPreset: '📂 샘플 프리셋 로드',
    loadAll: '전체 그래프 로드 (Heavy)',
    all: '전체 워크스페이스',
  },

  // 상단 툴바 버튼 툴팁
  // (Cypher Export / Grid Layout 문구는 FEATURE_PRUNING_GUIDE 1순위 정리로 기능과 함께 제거됨)
  toolbar: {
    switchWorkspace: '워크스페이스(도메인) 선택 화면 열기',
    presets: '샘플 프리셋 및 데이터셋 관리자를 엽니다.',
    help: '도움말 및 범례 (Help & Legend)',
    relayout: '선택된 노드만 또는 전체를 자동 정렬합니다',
  },

  // 우측 패널 ? 아이콘 툴팁
  tooltip: {
    filterGraph: '선택한 카테고리(Alias)에 해당하는 노드들만 캔버스에 표시합니다.',
    searchHighlight: '검색어가 포함된 노드와 그 의존성 흐름을 하이라이트합니다.',
    visibilityFilter: '체크한 타입의 노드들만 캔버스에 표시합니다.',
    maxDepth: '선택한 노드로부터 지정한 단계(Depth)까지만 연관 노드를 표시합니다.',
    nodeLabel: '노드의 역할을 나타내는 주요 타입입니다. (예: Screen, Feature 등)',
    nodeName: '노드에 표시될 실제 이름입니다.',
    nodeCategory: '그룹화나 검색에 쓰이는 카테고리 태그(Alias)입니다.',
    globalNode: '체크 시 이 노드는 캔버스에서 숨겨지고, 이 노드와 연결된 다른 노드들의 하단에 뱃지(Pill) 형태로 표시됩니다.',
    status: '현재 테스트/개발 상태를 나타냅니다.',
    globalNodes: '전역 노드를 다른 노드에 부착(Attach)하거나, 해당 전역 노드에 의존하는 모든 노드(Impact)를 시각화합니다.',
  },

  // 노드 라벨 선택지 (value는 영문 라벨 그대로, 표시만 한국어 병기)
  nodeLabel: {
    Feature: 'Feature (기능)',
    Screen: 'Screen (화면)',
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
    issueLink: 'Issue Link (e.g. Jira) - 쉼표(,)나 엔터(줄바꿈)로 여러 개 입력 가능',
    deleteProperty: '속성 삭제',
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

  // 전역 공통 노드(Badge) 설정
  globalNode: {
    title: '🌐 전역 공통 노드 (Badge화)',
    notAllowed: 'System, Screen, Feature 등 큰 단위의 노드는 전역 노드화할 수 없습니다.',
    hintBefore: '체크 시 이 노드는 캔버스에서 숨겨지고, 이 노드와 연결된 다른 노드들의 하단에 ',
    hintBadge: '뱃지(Pill)',
    hintAfter: ' 형태로 표시됩니다.',
    hintUsage: '다국어(I18N), 공통 데이터 등 여러 노드에서 반복 연결되는 글로벌 의존성에 사용하세요.',
    hintClick: '뱃지를 클릭하면 테스트 상태를 변경할 수 있습니다.',
    unlinkConfirm: '정말 이 뱃지와의 연결(Edge)을 해제하시겠습니까?\n(글로벌 뱃지 원본 데이터는 삭제되지 않습니다.)',
  },

  // 캔버스 우클릭 메뉴
  contextMenu: {
    addNode: '➕ 새 노드 추가',
    fitView: '⤢ 전체 화면 맞춤',
    refresh: '🔄 새로고침',
  },

  // Workspace(alias) 관리자
  workspaceManager: {
    title: 'Workspace 관리자',
    renamePrompt: (alias: string) => `'${alias}'의 새 이름을 입력하세요:`,
    renameConfirm: (alias: string, next: string) =>
      `'${alias}' 태그를 가진 모든 노드의 태그가 '${next}'(으)로 변경됩니다. 계속하시겠습니까?`,
    deleteConfirm: (alias: string) => `'${alias}' 태그를 모든 노드에서 삭제합니다. 계속하시겠습니까?`,
  },

  // 전역 노드 영향도(Impact) 표시
  impact: {
    affected: (count: number) => `영향 받는 노드 ${count}개`,
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
    connectBody: '노드의 테두리(바깥쪽 가장자리)에서 드래그를 시작해 다른 노드 위에 놓으면 선(Edge)이 생성됩니다.',
    highlightTipTitle: '다중 선택 하이라이트',
    highlightTipBody: '우측 패널의 Search Highlight에 단어(예: Arena)를 검색하면 해당 그룹의 의존성 흐름을 한눈에 볼 수 있습니다.',
    depthTitle: '깊이 조절 (Max Depth)',
    depthBody: '선택한 노드로부터 몇 단계(Depth)까지의 연관 관계를 볼 것인지 숫자 입력으로 조절할 수 있습니다.',
    undoTitle: 'Undo (되돌리기)',
    undoBody: 'Ctrl + Z를 눌러 최근 작업을 취소할 수 있습니다.',
    globalTitle: '🌐 전역 노드 (Global Node) 정책',
    globalTypeTitle: '타입 제약',
    globalTypeBody: 'Component, Data, TestCase 등 세부 단위의 노드만 전역 노드로 변환(Badge화)할 수 있습니다. System, Screen 등 그룹 단위의 노드는 전역 노드가 될 수 없습니다.',
    globalDeleteTitle: '삭제 제약 (Borrow Checker)',
    globalDeleteBody: '전역 노드가 하나 이상의 노드에 배지로 부착되어 사용 중일 경우, 원본을 삭제할 수 없습니다. 연결을 먼저 해제해야 합니다.',
    globalUsageTitle: '사용 방법',
    globalUsageBody: '우측 패널에서 노드를 전역 노드화한 뒤, 캔버스에서 부착할 다른 대상 노드를 선택하고 우측 패널의 Globals 탭에서 [+] Attach 버튼을 누르면 배지로 부착됩니다.',
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
  },
} as const;

export const I18N_LOCALES = { koKR } as const;

// 현재 활성 로케일 (한국어 단일)
export const t = I18N_LOCALES.koKR;
