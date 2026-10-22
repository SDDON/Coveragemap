# CoverageMap MCP Server

CoverageMap 백엔드 API를 MCP 프로토콜로 래핑한 서버입니다.
AI 에이전트가 자연어로 테스트 커버리지 그래프를 조작할 수 있습니다.

## 전제 조건

MCP 서버를 사용하려면 **백엔드가 실행 중**이어야 합니다:

```bash
# 1. Neo4j 실행
docker-compose up -d  # 또는 로컬 바이너리

# 2. 백엔드 실행
cd backend && uv run uvicorn main:app --port 8190 --reload
```

## 제공 도구 (Tools)

| 도구 | 설명 | 예시 |
|------|------|------|
| `list_nodes` | 전체 그래프 조회 (노드 + 엣지) | "현재 그래프 보여줘" |
| `find_node` | 이름/별칭·라벨(`label`)·전역 여부(`is_global`) 필터로 노드 검색 (상세 요약 포함) | "슬롯 노드 중 일반 노드만 찾아줘" |
| `get_node_details` | 특정 노드의 전체 프로퍼티(`is_global`, `checklist` 등), 부모-자식 및 진입/진출 엣지 상세 조회 (Zero-Script Inspector) | "공명 노드 상세 정보 보여줘" |
| `create_node` | 새 노드 생성 (`label`, `name`, `aliases`) | "Feature 노드 하나 만들어, 이름은 PAYMENT" |
| `create_edge` | 두 노드 연결 (`source`, `target`, `type`) | "LOGIN에서 DASHBOARD로 연결해" |
| `create_path` | **경로 한번에 생성** (A→B→C) | "LOGIN → DASHBOARD → SETTINGS 경로 만들어" |
| `mark_status` | 노드/엣지 테스트 상태 변경 (`Untested`/`Passed`/`Failed`/`Blocked`, 수동 고정 지원) | "LOGIN 노드를 Passed로 마킹해" |
| `delete_node` | 노드 삭제 (`node_id`) | "PAYMENT 노드 삭제해" |
| `delete_edge` | 엣지 삭제 (`edge_id`) | "이 엣지 삭제해" |
| `get_coverage` | 커버리지 통계 조회 | "전체 테스트 진행률 알려줘" |
| `ask_test_status` | 특정 화면/기능의 검증 현황, 수동 고정 사유 및 `Blocked` 근본 원인(`Failed` 원흉) 브리핑 | "패키지 상점 왜 차단됐어?" |
| `get_impact_scope` | 특정 노드 수정 시 하류 재검증 영향권(`Return` 제외) 산출 | "가챠 연출 바뀌면 어디 다시 테스트해야 해?" |
| `audit_cross_cutting` | 다국어(`Localization`), 네트워크 등 전역 배지(`aspect`, `scope_root_id`) 기준 연결 화면 감사 | "다국어 배지 연결된 화면 전수 감사해줘" |
| `get_next_test_targets` | 선행 조건이 모두 `Passed`되어 즉시 테스트 가능한 `Untested` 타겟 추천 | "다음에 뭐부터 테스트하면 좋을까?" |
| `mark_node_modified` | 특정 노드에 스펙 변경(`node_id` → `is_modified=true`) 표시 및 리플 하이라이트 활성화 | "상점 팝업 UI 개편됐다고 변경 표시해줘" |
| `acknowledge_node` | 스펙 변경 노드의 재검증 완료 확인(`node_id` → `is_modified=false`) 처리 | "상점 팝업 변경사항 확인 완료 처리해줘" |

## 사용 예시: A → B → C 경로 만들기

### 방법 1: `create_path` (한 번에)
```
"LOGIN → DASHBOARD → SETTINGS 경로를 만들어줘"
```
→ AI가 `find_node`로 ID를 찾고 → `create_path`로 한번에 연결

### 방법 2: 단계별
```
1. "LOGIN 노드 찾아줘"         → find_node
2. "DASHBOARD 노드 찾아줘"     → find_node  
3. "LOGIN에서 DASHBOARD 연결"  → create_edge
4. "DASHBOARD에서 SETTINGS 연결" → create_edge
```

### 방법 3: 노드 생성부터
```
"Feature 노드 3개 만들어: A_화면, B_화면, C_화면. 그리고 A→B→C로 연결해줘"
```
→ AI가 `create_node` × 3 → `create_path` 순서로 실행

## 설정

`mcp_config.json`에 등록되어 있습니다:
```json
{
  "coveragemap": {
    "command": "uv",
    "args": ["run", "python", "server.py"],
    "cwd": "e:/Workspace/coveragemap/mcp_server"
  }
}
```
