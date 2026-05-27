# CoverageMap MCP Server

CoverageMap 백엔드 API를 MCP 프로토콜로 래핑한 서버입니다.
AI 에이전트가 자연어로 테스트 커버리지 그래프를 조작할 수 있습니다.

## 전제 조건

MCP 서버를 사용하려면 **백엔드가 실행 중**이어야 합니다:

```bash
# 1. Neo4j 실행
docker-compose up -d  # 또는 로컬 바이너리

# 2. 백엔드 실행
cd backend && uv run uvicorn main:app --port 8001 --reload
```

## 제공 도구 (Tools)

| 도구 | 설명 | 예시 |
|------|------|------|
| `list_nodes` | 전체 그래프 조회 (노드 + 엣지) | "현재 그래프 보여줘" |
| `find_node` | 이름으로 노드 검색 | "LOGIN 노드 찾아줘" |
| `create_node` | 새 노드 생성 | "Feature 노드 하나 만들어, 이름은 PAYMENT" |
| `create_edge` | 두 노드 연결 | "LOGIN에서 DASHBOARD로 연결해" |
| `create_path` | **경로 한번에 생성** (A→B→C) | "LOGIN → DASHBOARD → SETTINGS 경로 만들어" |
| `mark_status` | 테스트 상태 변경 | "LOGIN 노드를 Passed로 마킹해" |
| `delete_node` | 노드 삭제 | "PAYMENT 노드 삭제해" |
| `delete_edge` | 엣지 삭제 | "이 엣지 삭제해" |
| `get_coverage` | 커버리지 통계 조회 | "전체 테스트 진행률 알려줘" |

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
    "cwd": "D:/workspace/Coveragemap/mcp_server"
  }
}
```
