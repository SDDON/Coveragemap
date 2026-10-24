# CoverageMap MCP Server
# FastAPI 백엔드(localhost:8190)를 래핑하여 AI 에이전트가 그래프를 조작할 수 있게 합니다.
# 실행: uv run python server.py

import os
import json
import sys
import urllib.parse
import httpx
from mcp.server.lowlevel import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

BACKEND_PORT = os.getenv("BACKEND_PORT") or os.getenv("PORT") or "8190"
BASE_URL = os.getenv("BACKEND_URL", f"http://localhost:{BACKEND_PORT}")

server = Server("coveragemap")


def _is_error(res) -> bool:
    """_api 응답이 에러 문자열인지 여부를 판별합니다."""
    return isinstance(res, str) and res.startswith("Error")


def _api(method: str, path: str, body: dict | None = None) -> dict | list | str:
    """Helper to call the CoverageMap REST API with resilient error handling."""
    url = f"{BASE_URL}{path}"
    try:
        with httpx.Client(timeout=10) as client:
            if method == "GET":
                r = client.get(url)
            elif method == "POST":
                r = client.post(url, json=body)
            elif method == "PUT":
                r = client.put(url, json=body)
            elif method == "DELETE":
                r = client.delete(url)
            else:
                return f"Error: Unknown HTTP method: {method}"
            
            if r.status_code >= 400:
                error_detail = r.text
                try:
                    err_json = r.json()
                    if isinstance(err_json, dict) and "detail" in err_json:
                        error_detail = err_json["detail"]
                        if isinstance(error_detail, (dict, list)):
                            error_detail = json.dumps(error_detail, ensure_ascii=False)
                except Exception:
                    pass
                return f"Error {r.status_code}: {error_detail}"
            
            try:
                return r.json()
            except Exception:
                return r.text
    except httpx.ConnectError as e:
        return f"Error: Failed to connect to backend server at {BASE_URL}: {e}"
    except httpx.TimeoutException as e:
        return f"Error: Request timed out contacting backend server at {BASE_URL}{path}: {e}"
    except httpx.RequestError as e:
        return f"Error: Network error contacting backend server at {BASE_URL}{path}: {e}"
    except Exception as e:
        return f"Error: Unexpected error calling {BASE_URL}{path}: {e}"



def _normalize_checklist(raw_checklist: list) -> list[dict]:
    """문자열 또는 객체 배열 형태의 체크리스트 입력을 표준 {id, text, status} 객체 배열로 정규화합니다."""
    normalized: list[dict] = []
    used_ids: set[str] = set()

    def _unique_id(preferred: str, fallback_idx: int) -> str:
        candidate = preferred or f"chk_{fallback_idx}"
        seq = fallback_idx
        while candidate in used_ids:
            seq += 1
            candidate = f"chk_{seq}"
        used_ids.add(candidate)
        return candidate

    for idx, item in enumerate(raw_checklist, start=1):
        if isinstance(item, str):
            text_val = item.strip()
            if text_val:
                normalized.append({
                    "id": _unique_id(f"chk_{idx}", idx),
                    "text": text_val,
                    "status": "Untested",
                })
        elif isinstance(item, dict):
            text_val = str(item.get("text", "")).strip()
            if not text_val:
                continue
            raw_id = str(item.get("id") or "").strip()
            item_id = _unique_id(raw_id, idx)
            raw_status = item.get("status")
            if raw_status in ("Untested", "Passed", "Failed", "Blocked"):
                status_val = raw_status
            elif item.get("checked") is True:
                status_val = "Passed"
            else:
                status_val = "Untested"
            normalized.append({
                **item,
                "id": item_id,
                "text": text_val,
                "status": status_val,
            })
    return normalized


# ─── Tool Definitions ──────────────────────────────────────────────

@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="list_nodes",
            description="그래프의 모든 노드 목록을 조회합니다. 각 노드의 id, label, name, aliases, test_status를 반환합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "filter": {
                        "type": "string",
                        "description": "특정 alias로 필터링 (선택사항)"
                    }
                }
            }
        ),
        Tool(
            name="create_node",
            description="새 노드를 생성합니다. label은 노드 유형(Feature, TestCase, Screen 등), name은 구체적 이름입니다. 선택적으로 test_status, 전역 여부(is_global), 설명(description), 이슈/문서 링크(issue_link), 내부 체크리스트(checklist)를 생성 시점에 함께 지정할 수 있습니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "노드 유형 (예: Feature, TestCase, Screen, Component, Modal)"
                    },
                    "name": {
                        "type": "string",
                        "description": "노드 이름 (예: LOGIN, DASHBOARD)"
                    },
                    "aliases": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "별칭/태그 목록 (선택사항)"
                    },
                    "test_status": {
                        "type": "string",
                        "enum": ["Untested", "Passed", "Failed", "Blocked"],
                        "description": "초기 테스트 상태 (선택사항, 기본값: Untested)",
                        "default": "Untested"
                    },
                    "is_global": {
                        "type": "boolean",
                        "description": "전역 공통 노드(배지) 여부 (선택사항, 기본값: false)"
                    },
                    "description": {
                        "type": "string",
                        "description": "노드/기능 설명 또는 전역 배지 검증 가이드 (선택사항)"
                    },
                    "issue_link": {
                        "type": "string",
                        "description": "연결된 Jira/이슈 또는 외부 테이블형 테스트 문서 링크 (선택사항)"
                    },
                    "checklist": {
                        "type": "array",
                        "description": "B안 노드 내부 체크리스트 항목 목록 (문자열 배열 또는 {id, text, status} 객체 배열)",
                        "items": {
                            "anyOf": [
                                {"type": "string"},
                                {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "string"},
                                        "text": {"type": "string"},
                                        "status": {
                                            "type": "string",
                                            "enum": ["Untested", "Passed", "Failed", "Blocked"]
                                        }
                                    },
                                    "required": ["text"]
                                }
                            ]
                        }
                    }
                },
                "required": ["label", "name"]
            }
        ),
        Tool(
            name="create_edge",
            description="두 노드 사이에 엣지(연결)를 생성합니다. source와 target은 노드 ID이며, 선택적으로 엣지 유형(type), 트리거 조건/액션명(action), 초기 테스트 상태(test_status)를 지정할 수 있습니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "source": {
                        "type": "string",
                        "description": "출발 노드의 ID"
                    },
                    "target": {
                        "type": "string",
                        "description": "도착 노드의 ID"
                    },
                    "type": {
                        "type": "string",
                        "description": "엣지 유형 (예: Tests, Depends_On, Transition, Return, Contains)",
                        "default": "Transition"
                    },
                    "action": {
                        "type": "string",
                        "description": "엣지 트리거 조건/액션명 (예: '결제하기 버튼 터치', '닫기 버튼 클릭')"
                    },
                    "test_status": {
                        "type": "string",
                        "enum": ["Untested", "Passed", "Failed", "Blocked"],
                        "description": "초기 테스트 상태 (선택사항, 기본값: Untested)",
                        "default": "Untested"
                    }
                },
                "required": ["source", "target"]
            }
        ),
        Tool(
            name="create_path",
            description="여러 노드를 순서대로 연결하는 경로를 한 번에 만듭니다. 예: A → B → C. 노드 ID 배열을 받아 순서대로 엣지를 생성합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "node_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "순서대로 연결할 노드 ID 배열 (최소 2개)",
                        "minItems": 2
                    },
                    "type": {
                        "type": "string",
                        "description": "엣지 유형",
                        "default": "Transition"
                    }
                },
                "required": ["node_ids"]
            }
        ),
        Tool(
            name="mark_status",
            description="노드 또는 엣지의 테스트 상태를 변경합니다. (Passed, Failed, Blocked, Untested)",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_type": {
                        "type": "string",
                        "enum": ["node", "edge"],
                        "description": "대상 유형"
                    },
                    "target_id": {
                        "type": "string",
                        "description": "노드 또는 엣지의 ID"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["Passed", "Failed", "Blocked", "Untested"],
                        "description": "설정할 테스트 상태"
                    },
                    "is_manual_override": {
                        "type": "boolean",
                        "description": "수동 고정 여부 (자동 합성에 의해 덮어쓰기 방지)"
                    },
                    "override_reason": {
                        "type": "string",
                        "description": "수동 고정 사유 또는 비고 메모"
                    }
                },
                "required": ["target_type", "target_id", "status"]
            }
        ),
        Tool(
            name="ask_test_status",
            description="특정 노드의 테스트 완료 여부, 상태, 수동 오버라이드 사유, 들어오는 엣지 분포 및 블로커 원인을 질의합니다. (예: '타이틀 화면 테스트 해봤어?')",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "조회할 노드 이름 또는 ID"
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="get_impact_scope",
            description="특정 기능이 변경되었을 때 하류 방향으로 영향을 받는 화면/기능 목록과 추천 회귀 테스트 범위를 계산합니다. (예: '로그인이 바뀌었는데 어디까지 다시 테스트해야 해?')",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "변경된 노드 이름 또는 ID"
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="audit_cross_cutting",
            description="다국어(i18n), 화면비(Aspect Ratio), 사운드 등 전체 UI(또는 특정 화면 scope_root_id 하위 범위)에 걸친 필수 횡단 관심사의 적용 여부를 감사하고 누락된 화면(Gap)을 찾습니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "aspect": {
                        "type": "string",
                        "description": "감사할 횡단 관심사 키워드 (예: '다국어', '화면비', '사운드', 'Localization', 'i18n')"
                    },
                    "scope_root_id": {
                        "type": "string",
                        "description": "(선택) 특정 화면(Screen/Container) 및 하위 Contains 자식 범위로 한정할 루트 노드 ID 또는 이름"
                    }
                },
                "required": ["aspect"]
            }
        ),
        Tool(
            name="get_next_test_targets",
            description="선행 의존성이 모두 Passed되어 지금 즉시 테스트를 시작할 수 있는 Untested 노드들을 추천합니다. (예: '지금 어느 테스트부터 시작하면 돼?')",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="delete_node",
            description="노드를 삭제합니다. 연결된 엣지도 함께 삭제됩니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "node_id": {
                        "type": "string",
                        "description": "삭제할 노드의 ID"
                    }
                },
                "required": ["node_id"]
            }
        ),
        Tool(
            name="delete_edge",
            description="엣지(연결)를 삭제합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "edge_id": {
                        "type": "string",
                        "description": "삭제할 엣지의 ID"
                    }
                },
                "required": ["edge_id"]
            }
        ),
        Tool(
            name="find_node",
            description="이름(name) 또는 별칭(aliases)으로 노드를 검색합니다. 라벨(label), 전역 여부(is_global) 필터링 및 프로퍼티/체크리스트 요약 포함을 지원합니다.",
            inputSchema={
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
                        "default": True
                    }
                },
                "required": ["name"]
            }
        ),
        Tool(
            name="get_node_details",
            description="특정 노드의 상세 메타데이터(프로퍼티, 전역 여부 is_global, 체크리스트) 및 연결된 모든 진입/진출 엣지, 부모/자식 노드를 일목요연하게 조회합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "조회할 노드의 ID(elementId) 또는 이름(name, 부분 일치 지원)"
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="get_coverage",
            description="현재 테스트 커버리지 통계를 조회합니다. 노드/엣지별 Passed, Failed, Blocked, Untested 수를 반환합니다.",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="mark_node_modified",
            description="특정 기능/노드를 '스펙 변경됨(Modified)'으로 마킹하여 캔버스에서 오렌지 맥동(.node-modified-pulse) 및 하류 영향 반경(.highlight-affected)을 활성화합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "node_id": {
                        "type": "string",
                        "description": "스펙이 변경된 노드의 ID"
                    }
                },
                "required": ["node_id"]
            }
        ),
        Tool(
            name="acknowledge_node",
            description="변경된 노드의 회귀 검증을 완료하고 '변경 확인 완료(Acknowledge)' 처리하여 오렌지 맥동 및 영향 반경 하이라이트를 해제합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "node_id": {
                        "type": "string",
                        "description": "변경 확인을 완료할 노드의 ID"
                    }
                },
                "required": ["node_id"]
            }
        ),
    ]


# ─── Tool Handlers ──────────────────────────────────────────────

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    
    if name == "list_nodes":
        params = ""
        if arguments.get("filter"):
            encoded_filter = urllib.parse.quote(str(arguments["filter"]), safe="")
            params = f"?filter={encoded_filter}"
        data = _api("GET", f"/api/graph{params}")
        if _is_error(data):
            return [TextContent(type="text", text=data)]
        if not isinstance(data, dict):
            return [TextContent(type="text", text=f"Error: 백엔드 응답 형식이 올바르지 않습니다: {data}")]
        
        # Format nodes for readability
        nodes = data.get("nodes", [])
        edges = data.get("edges", [])
        lines = [f"=== 노드 {len(nodes)}개, 엣지 {len(edges)}개 ===\n"]
        
        lines.append("## 노드 목록")
        for n in nodes:
            status_icon = {"Passed": "✅", "Failed": "❌", "Blocked": "🟡", "Untested": "⬜"}.get(n.get("test_status"), "⬜")
            aliases_str = ", ".join(n.get("aliases", []))
            lines.append(f"  {status_icon} [{n['label']}] {n['name']}  (id: {n['id']})")
            if aliases_str:
                lines.append(f"      aliases: {aliases_str}")
        
        lines.append(f"\n## 엣지 목록")
        # Build name lookup
        id_to_name = {n["id"]: n["name"] for n in nodes}
        for e in edges:
            status_icon = {"Passed": "✅", "Failed": "❌", "Blocked": "🟡", "Untested": "⬜"}.get(e.get("test_status"), "⬜")
            src_name = id_to_name.get(e["source"], e["source"][:12])
            tgt_name = id_to_name.get(e["target"], e["target"][:12])
            lines.append(f"  {status_icon} {src_name} ──{e['type']}──▶ {tgt_name}  (id: {e['id']})")
        
        return [TextContent(type="text", text="\n".join(lines))]
    
    elif name == "create_node":
        props: dict = {}
        if "is_global" in arguments and arguments["is_global"] is not None:
            props["is_global"] = "true" if bool(arguments["is_global"]) else "false"
        if "checklist" in arguments and isinstance(arguments["checklist"], list):
            props["checklist"] = _normalize_checklist(arguments["checklist"])

        explicit_status = arguments.get("test_status")
        if not explicit_status and props.get("checklist"):
            statuses = [c.get("status", "Untested") for c in props["checklist"]]
            if "Failed" in statuses:
                explicit_status = "Failed"
            elif "Blocked" in statuses:
                explicit_status = "Blocked"
            elif all(s == "Passed" for s in statuses):
                explicit_status = "Passed"

        body: dict = {
            "label": arguments["label"],
            "name": arguments["name"],
            "aliases": arguments.get("aliases", []),
            "test_status": explicit_status or "Untested",
            "properties": props,
        }
        if arguments.get("description") is not None:
            body["description"] = arguments["description"]
        if arguments.get("issue_link") is not None:
            body["issue_link"] = arguments["issue_link"]

        result = _api("POST", "/api/nodes", body)
        if _is_error(result):
            return [TextContent(type="text", text=result)]
        return [TextContent(type="text", text=f"노드 생성 완료. ID: {result}")]
    
    elif name == "create_edge":
        body: dict = {
            "source": arguments["source"],
            "target": arguments["target"],
            "type": arguments.get("type") or "Transition",
            "test_status": arguments.get("test_status") or "Untested",
            "properties": {},
        }
        if arguments.get("action") is not None:
            body["action"] = arguments["action"]

        result = _api("POST", "/api/edges", body)
        if _is_error(result):
            return [TextContent(type="text", text=result)]
        return [TextContent(type="text", text=f"엣지 생성 완료. ID: {result}")]
    
    elif name == "create_path":
        node_ids = arguments["node_ids"]
        edge_type = arguments.get("type", "Transition")
        
        if len(node_ids) < 2:
            return [TextContent(type="text", text="Error: 최소 2개의 노드 ID가 필요합니다.")]
        
        # Get node names for display
        data = _api("GET", "/api/graph")
        if _is_error(data):
            return [TextContent(type="text", text=data)]
        id_to_name = {}
        if isinstance(data, dict):
            id_to_name = {n["id"]: n["name"] for n in data.get("nodes", [])}
        
        results = []
        for i in range(len(node_ids) - 1):
            src = node_ids[i]
            tgt = node_ids[i + 1]
            body = {
                "source": src,
                "target": tgt,
                "type": edge_type,
                "test_status": "Untested",
                "properties": {}
            }
            edge_id = _api("POST", "/api/edges", body)
            src_name = id_to_name.get(src, src[:12])
            tgt_name = id_to_name.get(tgt, tgt[:12])
            if _is_error(edge_id):
                results.append(f"  ❌ {src_name} ──{edge_type}──▶ {tgt_name} 실패: {edge_id}")
                failed_display = " → ".join(id_to_name.get(nid, nid[:12]) for nid in node_ids)
                header = f"Error: 경로 생성 중 오류 발생 ({failed_display}):\n"
                return [TextContent(type="text", text=header + "\n".join(results))]
            results.append(f"  ✅ {src_name} ──{edge_type}──▶ {tgt_name} (edge: {edge_id})")
        
        path_display = " → ".join(id_to_name.get(nid, nid[:12]) for nid in node_ids)
        header = f"경로 생성 완료: {path_display}\n엣지 {len(results)}개 생성:\n"
        return [TextContent(type="text", text=header + "\n".join(results))]
    
    elif name == "mark_status":
        target_type = arguments["target_type"]
        target_id = str(arguments["target_id"])
        status = arguments["status"]
        is_override = arguments.get("is_manual_override")
        override_reason = arguments.get("override_reason")
        
        body = {"test_status": status}
        if is_override is not None:
            body["is_manual_override"] = is_override
        if override_reason is not None:
            body["override_reason"] = override_reason
            
        encoded_id = urllib.parse.quote(target_id, safe="")
        if target_type == "node":
            result = _api("PUT", f"/api/nodes/{encoded_id}", body)
        elif target_type == "edge":
            result = _api("PUT", f"/api/edges/{encoded_id}", body)
        else:
            return [TextContent(type="text", text=f"Error: 지원되지 않는 target_type입니다: '{target_type}' (node 또는 edge여야 합니다.)")]
        
        if _is_error(result):
            return [TextContent(type="text", text=result)]
        
        icon = {"Passed": "✅", "Failed": "❌", "Blocked": "🟡", "Untested": "⬜"}.get(status, "")
        override_msg = f" (📌 수동 고정: {override_reason})" if override_reason else ""
        return [TextContent(type="text", text=f"{icon} {target_type} ({target_id}) → {status} 처리 완료{override_msg}")]

    elif name == "ask_test_status":
        query = arguments["query"]
        data = _api("GET", f"/api/qa/status-summary?q={urllib.parse.quote(str(query), safe='')}")
        if _is_error(data):
            return [TextContent(type="text", text=data)]
        if not isinstance(data, dict):
            return [TextContent(type="text", text=f"Error: 백엔드 응답 형식이 올바르지 않습니다: {data}")]
        
        status_icons = {
            "Passed": "✅ 검증 완료 (Passed)",
            "Failed": "❌ 결함 발생 (Failed)",
            "Blocked": "🟡 차단됨 (Blocked)",
            "Untested": "⬜ 미검증 (Untested)"
        }
        status_str = status_icons.get(data.get("test_status"), data.get("test_status"))
        
        lines = [
            f"🔍 [{data.get('label')}] '{data.get('name')}' 테스트 상태 브리핑",
            f"• 현재 상태: {status_str}"
        ]
        
        if data.get("is_manual_override"):
            lines.append(f"• 📌 수동 고정(Manual Override) 적용됨: \"{data.get('override_reason') or '사유 미작성'}\"")
            
        if data.get("description"):
            lines.append(f"• 기능 설명: {data['description']}")
        if data.get("issue_link"):
            lines.append(f"• 연결 이슈: {data['issue_link']}")
            
        # 들어오는 선행 조건 분포
        in_stats = data.get("incoming_statuses", {})
        if in_stats:
            in_summary = ", ".join([f"{k}: {v}개" for k, v in in_stats.items()])
            lines.append(f"• 선행 조건({sum(in_stats.values())}개) 현황: {in_summary}")
        else:
            lines.append("• 선행 조건: 없음 (최상위 진입점 화면)")
            
        # 차단/결함 원인 추적
        rc = data.get("root_cause")
        if rc:
            lines.append(f"\n🚨 근본 원인(Root Cause):")
            lines.append(f"  - 원인: {rc['reason']}")
            lines.append(f"  - 결함 경로: {' → '.join(rc['path'])}")
            
        return [TextContent(type="text", text="\n".join(lines))]

    elif name == "get_impact_scope":
        query = arguments["query"]
        data = _api("GET", f"/api/qa/impact-scope?q={urllib.parse.quote(str(query), safe='')}")
        if _is_error(data):
            return [TextContent(type="text", text=data)]
        if not isinstance(data, dict):
            return [TextContent(type="text", text=f"Error: 백엔드 응답 형식이 올바르지 않습니다: {data}")]
            
        changed_name = data.get("changed_node_name", query)
        total_impacted = data.get("total_impacted_nodes", 0)
        scope = data.get("recommended_regression_scope", [])
        
        lines = [
            f"⚡ 변경 영향도 분석 리포트: '{changed_name}'",
            f"• 총 영향을 받는 하류(Downstream) 노드: {total_impacted}개",
            f"• 총 영향 엣지: {len(data.get('impacted_edges', []))}개",
            f"\n🎯 권장 회귀 테스트 범위 (Regression Scope):"
        ]
        
        if scope:
            for s in scope:
                lines.append(f"  - {s}")
        else:
            lines.append("  (하류에 연결된 후속 화면/기능이 없습니다. 단일 기능 검증으로 충분합니다.)")
            
        return [TextContent(type="text", text="\n".join(lines))]

    elif name == "audit_cross_cutting":
        aspect = arguments["aspect"]
        scope_root_id = (arguments.get("scope_root_id") or "").strip()
        qs = f"aspect={urllib.parse.quote(str(aspect), safe='')}"
        if scope_root_id:
            qs += f"&scope_root_id={urllib.parse.quote(str(scope_root_id), safe='')}"
        data = _api("GET", f"/api/qa/audit-cross-cutting?{qs}")
        if _is_error(data):
            return [TextContent(type="text", text=data)]
        if not isinstance(data, dict):
            return [TextContent(type="text", text=f"Error: 백엔드 응답 형식이 올바르지 않습니다: {data}")]
            
        lines = [
            f"📋 횡단 관심사 전수 감사(Audit): '{data.get('aspect_queried')}'",
            f"• 대상 화면/기능: 총 {data.get('total_screens_features')}개",
            f"• 적용 커버리지: {data.get('coverage_rate')}%",
            f"• 요약: {data.get('gap_summary')}\n"
        ]
        
        missing = data.get("missing_nodes", [])
        if missing:
            lines.append("⚠️ 누락된 사각지대(Gap) 노드 목록:")
            for m in missing:
                lines.append(f"  - [{m['label']}] {m['name']} (id: {m['id']})")
            lines.append("\n💡 조치 권장: 위 화면들에 해당 관심사(배지/속성)를 추가 검증 항목으로 연결하세요.")
        else:
            lines.append("🎉 축하합니다! 모든 대상 노드에 완벽하게 대응되어 있습니다.")
            
        return [TextContent(type="text", text="\n".join(lines))]

    elif name == "get_next_test_targets":
        data = _api("GET", "/api/qa/next-targets")
        if _is_error(data):
            return [TextContent(type="text", text=data)]
        if not isinstance(data, list):
            return [TextContent(type="text", text=f"Error: 백엔드 응답 형식이 올바르지 않습니다: {data}")]
            
        ready_targets = [t for t in data if t.get("incoming_requirements_met")]
        waiting_targets = [t for t in data if not t.get("incoming_requirements_met")]
        
        lines = ["🎯 다음 테스트 대상 추천 리포트\n"]
        lines.append(f"## 🟢 지금 즉시 테스트 가능 (Ready to Test): {len(ready_targets)}개")
        if ready_targets:
            for t in ready_targets:
                reasons = ", ".join(t.get("untested_reasons", []))
                lines.append(f"  • [{t['label']}] {t['name']}  ({reasons})")
        else:
            lines.append("  (현재 선행 조건을 모두 만족한 미검증 노드가 없습니다.)")
            
        if waiting_targets:
            lines.append(f"\n## ⏳ 선행 조건 미충족 대기 중 (Waiting): {len(waiting_targets)}개")
            for t in waiting_targets[:5]:
                reasons = ", ".join(t.get("untested_reasons", []))
                lines.append(f"  • [{t['label']}] {t['name']}  [대기 사유: {reasons}]")
            if len(waiting_targets) > 5:
                lines.append(f"  ... 외 {len(waiting_targets) - 5}개")
                
        return [TextContent(type="text", text="\n".join(lines))]

    elif name == "delete_node":
        node_id = str(arguments["node_id"])
        result = _api("DELETE", f"/api/nodes/{urllib.parse.quote(node_id, safe='')}")
        if _is_error(result):
            return [TextContent(type="text", text=result)]
        return [TextContent(type="text", text=f"노드 삭제 완료: {node_id}")]
    
    elif name == "delete_edge":
        edge_id = str(arguments["edge_id"])
        result = _api("DELETE", f"/api/edges/{urllib.parse.quote(edge_id, safe='')}")
        if _is_error(result):
            return [TextContent(type="text", text=result)]
        return [TextContent(type="text", text=f"엣지 삭제 완료: {edge_id}")]
    
    elif name == "find_node":
        raw_search = (arguments.get("name") or "").lower().strip()
        search = "" if raw_search == "*" else raw_search
        label_filter = (arguments.get("label") or "").strip().lower()
        is_global_filter = arguments.get("is_global")
        include_details = arguments.get("include_details", True)

        data = _api("GET", "/api/graph")
        if _is_error(data):
            return [TextContent(type="text", text=data)]
        if not isinstance(data, dict):
            return [TextContent(type="text", text=f"Error: 백엔드 응답 형식이 올바르지 않습니다: {data}")]
        
        matches = []
        for n in data.get("nodes", []):
            n_name = str(n.get("name", "")).lower()
            n_aliases = [str(a).lower() for a in (n.get("aliases") or [])]
            if search and (search not in n_name and not any(search in a for a in n_aliases)):
                continue
            if label_filter and str(n.get("label", "")).lower() != label_filter:
                continue
            props = n.get("properties") or {}
            raw_is_global = props.get("is_global", n.get("is_global", "false"))
            node_is_global = str(raw_is_global).lower() == "true"
            if is_global_filter is not None and node_is_global != bool(is_global_filter):
                continue
            matches.append(n)

        if not matches:
            return [TextContent(type="text", text=f"'{arguments['name']}'와 일치하는 노드가 없습니다.")]
        
        lines = [f"검색 결과: {len(matches)}개\n"]
        for n in matches:
            status_icon = {"Passed": "✅", "Failed": "❌", "Blocked": "🟡", "Untested": "⬜"}.get(n.get("test_status"), "⬜")
            props = n.get("properties") or {}
            raw_is_global = props.get("is_global", n.get("is_global", "false"))
            node_is_global = str(raw_is_global).lower() == "true"
            global_tag = " [🌐 Global]" if node_is_global else ""
            lines.append(f"  {status_icon} [{n['label']}] {n['name']}{global_tag}")
            lines.append(f"      id: {n['id']}")
            if include_details:
                lines.append(f"      is_global: {str(node_is_global).lower()}")
                aliases = n.get("aliases") or []
                if aliases:
                    lines.append(f"      aliases: {json.dumps(aliases, ensure_ascii=False)}")
                checklist = props.get("checklist") if isinstance(props.get("checklist"), list) else []
                if checklist:
                    passed_cnt = sum(
                        1 for c in checklist
                        if isinstance(c, dict) and (c.get("status") == "Passed" or c.get("checked") is True)
                    )
                    lines.append(f"      checklist: {len(checklist)}개 ({passed_cnt}/{len(checklist)} 통과)")
                desc = props.get("description")
                if desc:
                    lines.append(f"      description: {desc}")
        return [TextContent(type="text", text="\n".join(lines))]

    elif name == "get_node_details":
        query = str(arguments["query"])
        data = _api("GET", f"/api/nodes/{urllib.parse.quote(query, safe='')}/details")
        if _is_error(data):
            return [TextContent(type="text", text=data)]
        if not isinstance(data, dict):
            return [TextContent(type="text", text=f"Error: 백엔드 응답 형식이 올바르지 않습니다: {data}")]

        status_icon = {"Passed": "✅", "Failed": "❌", "Blocked": "🟡", "Untested": "⬜"}.get(data.get("test_status"), "⬜")
        is_global = bool(data.get("is_global"))
        global_str = "✅ true (전역 노드 - 연결 시 배지로 자동 흡수)" if is_global else "❌ false (일반 캔버스 노드)"
        aliases = data.get("aliases") or []

        lines = [
            f"🔍 노드 상세 정보: [{data.get('label')}] {data.get('name')}",
            f"• 노드 ID: {data.get('id')}",
            f"• 라벨/유형: {data.get('label')}",
            f"• 테스트 상태: {status_icon} {data.get('test_status')}",
            f"• 전역 여부(is_global): {global_str}",
            f"• 별칭(Aliases): {json.dumps(aliases, ensure_ascii=False)}",
        ]
        if data.get("is_manual_override"):
            lines.append(f"• 📌 수동 고정(Manual Override): true (사유: {data.get('override_reason') or '미작성'})")
        if data.get("description"):
            lines.append(f"• 기능 설명: {data.get('description')}")
        if data.get("issue_link"):
            lines.append(f"• 이슈/문서 링크: {data.get('issue_link')}")
        if data.get("is_modified"):
            lines.append(f"• ✨ 스펙 변경 여부(is_modified): true ({data.get('modified_note') or '메모 없음'})")

        parent = data.get("parent")
        if parent:
            lines.append(f"• 상위 부모(Parent Screen): [{parent.get('label')}] {parent.get('name')} (id: {parent.get('id')})")
        children = data.get("children") or []
        if children:
            child_names = ", ".join(f"[{c.get('label')}] {c.get('name')}" for c in children)
            lines.append(f"• 하위 컴포넌트(Children, 총 {len(children)}개): {child_names}")

        checklist = data.get("checklist") or []
        if checklist:
            passed_cnt = sum(
                1 for c in checklist
                if isinstance(c, dict) and (c.get("status") == "Passed" or c.get("checked") is True)
            )
            lines.append(f"\n📋 내부 체크리스트 ({passed_cnt}/{len(checklist)} 통과):")
            for item in checklist:
                if not isinstance(item, dict):
                    continue
                st = item.get("status") or ("Passed" if item.get("checked") is True else "Untested")
                mark = "[x]" if st == "Passed" else ("[!] " if st == "Failed" else ("[B] " if st == "Blocked" else "[ ]"))
                suffix = "" if st == "Passed" else f" ({st})"
                lines.append(f"  {mark} {item.get('text', '')}{suffix}")
        else:
            lines.append("\n📋 내부 체크리스트: 없음")

        in_edges = data.get("incoming_edges") or []
        lines.append(f"\n⬇️ 진입 엣지 (Incoming Edges, 총 {len(in_edges)}개):")
        if in_edges:
            for e in in_edges:
                act = e.get("action") or (e.get("properties") or {}).get("action")
                act_str = f"──(action: {act})──▶" if act else "──▶"
                lines.append(f"  - [{e.get('type')}] {e.get('source_name')} {act_str} (status: {e.get('test_status')}, id: {e.get('id')})")
        else:
            lines.append("  (없음)")

        out_edges = data.get("outgoing_edges") or []
        lines.append(f"\n⬆️ 진출 엣지 (Outgoing Edges, 총 {len(out_edges)}개):")
        if out_edges:
            for e in out_edges:
                act = e.get("action") or (e.get("properties") or {}).get("action")
                type_act = f"{e.get('type')}: {act}" if act else f"{e.get('type')}"
                lines.append(f"  - ──[{type_act}]──▶ {e.get('target_name')} (status: {e.get('test_status')}, id: {e.get('id')})")
        else:
            lines.append("  (없음)")

        return [TextContent(type="text", text="\n".join(lines))]
    
    elif name == "get_coverage":
        data = _api("GET", "/api/graph")
        if _is_error(data):
            return [TextContent(type="text", text=data)]
        if not isinstance(data, dict):
            return [TextContent(type="text", text=f"Error: 백엔드 응답 형식이 올바르지 않습니다: {data}")]
        
        nodes = data.get("nodes", [])
        edges = data.get("edges", [])
        
        node_stats = {"Passed": 0, "Failed": 0, "Blocked": 0, "Untested": 0}
        edge_stats = {"Passed": 0, "Failed": 0, "Blocked": 0, "Untested": 0}
        
        for n in nodes:
            s = n.get("test_status", "Untested")
            node_stats[s] = node_stats.get(s, 0) + 1
        for e in edges:
            s = e.get("test_status", "Untested")
            edge_stats[s] = edge_stats.get(s, 0) + 1
        
        total_nodes = len(nodes)
        total_edges = len(edges)
        node_pct = (node_stats["Passed"] / total_nodes * 100) if total_nodes > 0 else 0
        edge_pct = (edge_stats["Passed"] / total_edges * 100) if total_edges > 0 else 0
        
        lines = [
            "📊 테스트 커버리지 현황\n",
            f"## 노드 ({total_nodes}개)",
            f"  ✅ Passed:   {node_stats['Passed']}  ({node_pct:.1f}%)",
            f"  ❌ Failed:   {node_stats['Failed']}",
            f"  🟡 Blocked:  {node_stats['Blocked']}",
            f"  ⬜ Untested: {node_stats['Untested']}",
            f"\n## 엣지 ({total_edges}개)",
            f"  ✅ Passed:   {edge_stats['Passed']}  ({edge_pct:.1f}%)",
            f"  ❌ Failed:   {edge_stats['Failed']}",
            f"  🟡 Blocked:  {edge_stats['Blocked']}",
            f"  ⬜ Untested: {edge_stats['Untested']}",
        ]
        return [TextContent(type="text", text="\n".join(lines))]

    elif name == "mark_node_modified":
        node_id = str(arguments["node_id"])
        result = _api("POST", f"/api/nodes/{urllib.parse.quote(node_id, safe='')}/mark-modified")
        if _is_error(result):
            return [TextContent(type="text", text=result)]
        return [TextContent(type="text", text=f"🟠 노드 ({node_id}) 스펙 변경(Modified) 마킹 완료. 하류 영향 범위가 활성화되었습니다.")]

    elif name == "acknowledge_node":
        node_id = str(arguments["node_id"])
        result = _api("POST", f"/api/nodes/{urllib.parse.quote(node_id, safe='')}/acknowledge")
        if _is_error(result):
            return [TextContent(type="text", text=result)]
        return [TextContent(type="text", text=f"✅ 노드 ({node_id}) 변경 확인 완료(Acknowledged). 영향 반경 하이라이트가 해제되었습니다.")]
    
    return [TextContent(type="text", text=f"Unknown tool: {name}")]


# ─── Entry Point ──────────────────────────────────────────────

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
