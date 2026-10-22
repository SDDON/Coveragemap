# MCP Node Inspection & Advanced Search Tool Specification

**Document Version:** 1.0.0  
**Target Audience:** Senior AI Coding Models (Argon, Claude Opus 5.5, Gemini 4) & Core Contributors  
**Related Documents:** [AI_IMPLEMENTATION_SPEC.md](file:///e:/Workspace/coveragemap/AI_IMPLEMENTATION_SPEC.md), [mcp_server/README.md](file:///e:/Workspace/coveragemap/mcp_server/README.md)  
**Status:** Implemented (2026-10-22)

---

## 1. Executive Summary & Problem Statement (배경 및 문제 정의)

### 1.1. 발생 배경 (Context)
- AI 에이전트(Gemini, Claude 등)가 CoverageMap의 그래프 상태를 질의하고 분석하는 과정에서, 특정 노드의 **전체 속성(Properties), 전역 여부(`is_global`), 내부 체크리스트(`checklist`), 그리고 연결된 진입/진출 엣지 목록**을 파악해야 하는 상황이 빈번히 발생합니다.
- 그러나 현재 MCP 서버(`mcp_server/server.py`)의 `find_node` 도구는 노드의 ID와 이름, 상태만 반환하며 상세 프로퍼티를 완전히 누락하고 있습니다.
- 이로 인해 AI 에이전트가 **MCP 도구를 신뢰하지 못하고 터미널에서 Python 스크립트를 직접 실행하여 Neo4j DB를 우회 조회하는 심각한 안티패턴(Friction)**이 발생했습니다.
  - 윈도우 파워쉘 환경에서 한글 인코딩 깨짐(`SyntaxError: unterminated string literal`),
  - 샌드박스 보안 권한 거부(`user denied permission to run command`) 등으로 인해 사용자 경험이 저하되었습니다.

---

## 2. Gap Analysis of Current MCP Tools (현행 MCP 도구 한계 분석)

현재 `mcp_server/server.py`에 등록된 도구들의 한계점입니다:

### 2.1. `find_node`의 극소 정보 반환 한계 (`server.py:542-557`)
```python
# 현행 find_node 반환 로직:
matches = [n for n in data.get("nodes", []) if search in n["name"].lower()]
...
for n in matches:
    lines.append(f"  {status_icon} [{n['label']}] {n['name']}")
    lines.append(f"      id: {n['id']}")
```
- **문제점**:
  1. `properties` 객체를 전혀 반환하지 않음 ➔ 해당 노드가 **전역 노드(`is_global: true`)인지 여부를 알 수 없음**.
  2. 노드 내부 `checklist` 배열을 반환하지 않음 ➔ B안 체크리스트 검증 현황을 알 수 없음.
  3. `aliases`, `description`, `issue_link`, `is_modified` 등 중요 메타데이터가 모두 유실됨.
  4. 검색 대상이 `name` 하나로 제한되어 있어, 라벨(`label`), 전역 여부(`is_global`), 별칭(`aliases`)으로의 필터링이 불가능함.

### 2.2. 노드 단건 상세 조회 도구(`get_node_details` / `inspect_node`) 부재
- 특정 노드의 ID나 이름을 알고 있을 때, 해당 노드의:
  - 모든 프로퍼티,
  - 해당 노드로 들어오는 엣지(Incoming Edges) 및 나가는 엣지(Outgoing Edges),
  - 부모 노드(Parent Screen) 및 자식 컴포넌트(Children) 목록
- 위 정보를 종합적으로 브리핑해 주는 **'노드 전용 인스펙터(Inspector) MCP 도구'가 존재하지 않습니다.**

---

## 3. Tool Specifications & Design (신규 및 개선 도구 규격)

차기 AI 모델은 다음 2가지 작업을 수행해야 합니다:

### 3.1. [신규 도구] `get_node_details` (노드 상세 인스펙터)

- **도구명**: `get_node_details`
- **목적**: 특정 노드의 상세 메타데이터(프로퍼티, 전역 여부, 체크리스트) 및 연결된 모든 진입/진출 엣지를 일목요연하게 조회합니다.
- **파라미터 (Input Schema)**:
  ```json
  {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "조회할 노드의 ID(elementId) 또는 이름(name, 부분 일치 지원)"
      }
    },
    "required": ["query"]
  }
  ```
- **반환 포맷 (Output Format 예시)**:
  ```text
  🔍 노드 상세 정보: [Screen] 공명
  • 노드 ID: 4:a6a07862-3470-4776-8add-c80226b1d23c:13
  • 라벨/유형: Screen
  • 테스트 상태: ⬜ Untested
  • 전역 여부(is_global): ✅ true (전역 노드 - 연결 시 배지로 자동 흡수)
  • 별칭(Aliases): ["공명", "#Resonance"]
  • 기능 설명: 영웅 공명 시스템 전역 제어 모듈
  • 이슈/문서 링크: https://jira.company.com/browse/QA-102
  
  📋 내부 체크리스트 (2/3 통과):
    [x] 공명 버프 수치 계산식 정상 적용 확인
    [x] 속성별 공명 활성화 조건 확인
    [ ] 4인 풀파티 공명 시너지 이펙트 확인 (Untested)
  
  ⬇️ 진입 엣지 (Incoming Edges, 총 3개):
    - [Transition] 파티 편성 화면 ──(action: 공명 탭 터치)──▶
    - [Displays] 영웅 슬롯 #배틀인카운터 ──▶
    - [Displays] 영웅 슬롯 #파티편성 ──▶
  
  ⬆️ 진출 엣지 (Outgoing Edges, 총 1개):
    - ──[Transition: 닫기]──▶ 메인 게임 (Return)
  ```

---

### 3.2. [기존 도구 개선] `find_node` 확장 (Advanced Search)

- **도구명**: `find_node`
- **파라미터 확장**:
  ```json
  {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "검색할 노드 이름 또는 별칭 (부분 일치)"
      },
      "label": {
        "type": "string",
        "description": "노드 라벨 필터 (선택사항, 예: Screen, Component, TestCase)"
      },
      "is_global": {
        "type": "boolean",
        "description": "전역 노드(is_global=true)만 검색할지 여부 (선택사항)"
      },
      "include_details": {
        "type": "boolean",
        "description": "프로퍼티 및 체크리스트 요약 정보를 결과에 포함할지 여부 (기본값: true)",
        "default": true
      }
    },
    "required": ["name"]
  }
  ```
- **개선 내용**:
  - 이름뿐만 아니라 `aliases` 배열도 함께 검색 매칭.
  - 검색 결과에 `is_global` 여부 및 체크리스트 개수(`checklist: 3개`)를 함께 표시하여 에이전트가 노드의 성격을 즉각 인지할 수 있도록 보강.

---

## 4. Implementation Directives for Next AI Model (차기 모델 구현 지시서)

### 4.1. 백엔드 지원 엔드포인트 확인 및 보강 (`backend/main.py`)
- 이미 백엔드에 `GET /api/nodes/{id}`가 존재하거나, 없을 경우 `graph_service.py`에 단건 노드 상세 조회 함수(`get_node_full_details`)를 작성하여 REST 엔드포인트를 노출합니다:
  ```python
  # backend/main.py
  @app.get("/api/nodes/{node_id}/details")
  def api_get_node_details(node_id: str, session = Depends(get_db)):
      return get_node_full_details(session, node_id)
  ```

### 4.2. MCP 서버 작업 (`mcp_server/server.py`)
1. **Tool 정의 목록에 `get_node_details` 추가**:
   - `Tool(name="get_node_details", ...)` 등록.
2. **`find_node` 파라미터 스키마 갱신**:
   - `label`, `is_global`, `include_details` 파라미터 추가.
3. **핸들러 구현 (`server.py:lines ~530-570`)**:
   - `elif name == "get_node_details":` 핸들러 블록 추가.
   - 반환받은 properties(`is_global`, `checklist`, `modified_note` 등)와 edges 데이터를 마크다운 문자열로 가공하여 반환.

---

## 5. Verification & Acceptance Criteria (검증 기준)

차기 모델은 구현 완료 후 다음 게이트를 통과해야 합니다:

1. **단위 및 기능 검증**:
   - `uv run python mcp_server/server.py` 구동 후 JSON-RPC 호출 테스트.
   - `get_node_details(query="공명")` 호출 시:
     - `is_global: true` 속성이 명확히 출력되는지 확인.
     - 해당 노드로 들어오는 엣지 목록이 빠짐없이 노출되는지 확인.
2. **`find_node` 개선 검증**:
   - `find_node(name="슬롯", is_global=false)` 호출 시 일반 슬롯 노드들만 필터링되어 반환되는지 확인.
3. **에이전트 자립성(Zero-Script Principle)**:
   - AI 에이전트가 노드의 전역 여부, 속성, 엣지를 확인하기 위해 별도 Python 스크립트 실행 없이 오직 MCP 도구(`get_node_details`)만으로 모든 정보를 파악할 수 있는지 확인.
