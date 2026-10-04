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

  // Auto Ingest (CSV 일괄 가져오기) 모달
  ingest: {
    title: '⚡ CSV 일괄 가져오기 (Auto Ingest)',
    subtitle: '엑셀/구글 시트의 테스트 케이스를 붙여넣으면 화면, 기능, 테스트케이스와 의존성을 한 번에 생성합니다.',
    localNotice: '🛡️ 로컬 처리: 외부 서버를 호출하지 않고 로컬 백엔드에서만 파싱합니다.',
    inputLabel: 'CSV 내용 붙여넣기 (Screen, Feature, TestCase, Prerequisite, CrossCutting, Description):',
    fillSample: '📋 표준 CSV 템플릿 채우기 (인벤토리)',
    parse: '⚡ CSV 구조 분석 실행',
    parsing: '⏳ CSV 데이터 파싱 중...',
    emptyInput: 'CSV 내용을 입력해주세요.',
    parseFailed: 'CSV 파싱 실패',
    applyFailed: '적용 실패',
    previewTitle: '🔍 분석 결과 미리보기',
    previewNodeList: '생성될 주요 노드 목록:',
    countScreen: 'Screen (화면)',
    countFeature: 'Feature (기능)',
    countTestCase: 'TestCase (검증 시나리오)',
    countEdges: 'Edges (의존성/전이)',
    cancel: '취소',
    apply: '🚀 캔버스에 적용',
    applying: '적용 중...',
    targetWorkspace: '대상 워크스페이스',
    noWorkspace: '(전체 보기 — 워크스페이스 미선택)',
    cleanApply: '이 워크스페이스의 기존 노드를 지우고 새로 적용',
    cleanRequiresWorkspace: '기존 노드 삭제는 워크스페이스를 선택한 상태에서만 할 수 있습니다.',
    confirmTitle: '⚠️ 삭제 확인',
    confirmBody: (workspace: string, count: number) =>
      `워크스페이스 '${workspace}' 태그를 가진 노드 ${count}개가 삭제됩니다. 다른 워크스페이스 태그도 함께 가진 노드도 포함됩니다. 적용 직전 전체 그래프는 자동 백업 프리셋으로 저장됩니다.`,
    confirmProceed: '삭제하고 적용',
    confirmBack: '돌아가기',
    checking: '삭제 대상 확인 중...',
    // 표준 CSV 템플릿 샘플 (한국어 샘플 데이터이므로 locale에서 관리)
    sampleCsv: `Screen,Feature,TestCase,Prerequisite,CrossCutting,Description
인벤토리 화면,아이템 분해,일반 등급 장비 일괄 분해 검증,,다국어,인벤토리 가방 내 장비 분해
인벤토리 화면,아이템 분해,잠금된 장비 분해 시도 시 경고 팝업,아이템 분해,다국어,잠금 보호 로직 검증
인벤토리 화면,장비 강화,강화 재료 투입 후 골드 소모 검증,로그인 완료,"다국어, 21:9",골드 및 재료 차감
인벤토리 화면,장비 강화,골드 부족 시 상점 이동 모달 확인,장비 강화,다국어,예외 처리
상점 화면,패키지 구매,한정 패키지 결제 완료 후 인벤토리 지급 검증,로그인 완료,네트워크,결제 모듈 연동
`,
  },
} as const;

export const I18N_LOCALES = { koKR } as const;

// 현재 활성 로케일 (한국어 단일)
export const t = I18N_LOCALES.koKR;
