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

BACKEND_PORT = os.getenv("PORT", "8190")
BASE_URL = os.getenv("BACKEND_URL", f"http://localhost:{BACKEND_PORT}")

server = Server("coveragemap")


def _api(method: str, path: str, body: dict | None = None) -> dict | str:
    """Helper to call the CoverageMap REST API."""
    url = f"{BASE_URL}{path}"
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
            return f"Unknown method: {method}"
        
        if r.status_code >= 400:
            return f"Error {r.status_code}: {r.text}"
        
        try:
            return r.json()
        except Exception:
            return r.text


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
            description="새 노드를 생성합니다. label은 노드 유형(Feature, TestCase 등), name은 구체적 이름입니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "노드 유형 (예: Feature, TestCase, Screen)"
                    },
                    "name": {
                        "type": "string",
                        "description": "노드 이름 (예: LOGIN, DASHBOARD)"
                    },
                    "aliases": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "별칭/태그 목록 (선택사항)"
                    }
                },
                "required": ["label", "name"]
            }
        ),
        Tool(
            name="create_edge",
            description="두 노드 사이에 엣지(연결)를 생성합니다. source와 target은 노드 ID입니다.",
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
                        "description": "엣지 유형 (예: Tests, Depends_On, Transition)",
                        "default": "Transition"
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
            description="다국어(i18n), 화면비(Aspect Ratio), 사운드 등 전체 UI에 걸친 필수 횡단 관심사의 적용 여부를 전수 감사하고 누락된 화면(Gap)을 찾습니다. (예: '화면비 처리가 UI 전반에 다 되어있는지 궁금해')",
            inputSchema={
                "type": "object",
                "properties": {
                    "aspect": {
                        "type": "string",
                        "description": "감사할 횡단 관심사 키워드 (예: '다국어', '화면비', '사운드', 'Aspect', 'i18n')"
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
            description="이름(name)으로 노드를 검색합니다. 부분 일치를 지원합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "검색할 노드 이름 (부분 일치)"
                    }
                },
                "required": ["name"]
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
            params = f"?filter={arguments['filter']}"
        data = _api("GET", f"/api/graph{params}")
        if isinstance(data, str):
            return [TextContent(type="text", text=data)]
        
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
        body = {
            "label": arguments["label"],
            "name": arguments["name"],
            "aliases": arguments.get("aliases", []),
            "test_status": "Untested",
            "properties": {}
        }
        result = _api("POST", "/api/nodes", body)
        return [TextContent(type="text", text=f"노드 생성 완료. ID: {result}")]
    
    elif name == "create_edge":
        body = {
            "source": arguments["source"],
            "target": arguments["target"],
            "type": arguments.get("type", "Transition"),
            "test_status": "Untested",
            "properties": {}
        }
        result = _api("POST", "/api/edges", body)
        return [TextContent(type="text", text=f"엣지 생성 완료. ID: {result}")]
    
    elif name == "create_path":
        node_ids = arguments["node_ids"]
        edge_type = arguments.get("type", "Transition")
        
        if len(node_ids) < 2:
            return [TextContent(type="text", text="Error: 최소 2개의 노드 ID가 필요합니다.")]
        
        # Get node names for display
        data = _api("GET", "/api/graph")
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
            results.append(f"  ✅ {src_name} ──{edge_type}──▶ {tgt_name} (edge: {edge_id})")
        
        path_display = " → ".join(id_to_name.get(nid, nid[:12]) for nid in node_ids)
        header = f"경로 생성 완료: {path_display}\n엣지 {len(results)}개 생성:\n"
        return [TextContent(type="text", text=header + "\n".join(results))]
    
    elif name == "mark_status":
        target_type = arguments["target_type"]
        target_id = arguments["target_id"]
        status = arguments["status"]
        is_override = arguments.get("is_manual_override")
        override_reason = arguments.get("override_reason")
        
        body = {"test_status": status}
        if is_override is not None:
            body["is_manual_override"] = is_override
        if override_reason is not None:
            body["override_reason"] = override_reason
            
        if target_type == "node":
            result = _api("PUT", f"/api/nodes/{target_id}", body)
        else:
            result = _api("PUT", f"/api/edges/{target_id}", body)
        
        icon = {"Passed": "✅", "Failed": "❌", "Blocked": "🟡", "Untested": "⬜"}.get(status, "")
        override_msg = f" (📌 수동 고정: {override_reason})" if override_reason else ""
        return [TextContent(type="text", text=f"{icon} {target_type} ({target_id}) → {status} 처리 완료{override_msg}")]

    elif name == "ask_test_status":
        query = arguments["query"]
        data = _api("GET", f"/api/qa/status-summary?q={urllib.parse.quote(query)}")
        if isinstance(data, str):
            return [TextContent(type="text", text=data)]
        
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
        data = _api("GET", f"/api/qa/impact-scope?q={urllib.parse.quote(query)}")
        if isinstance(data, str):
            return [TextContent(type="text", text=data)]
            
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
        data = _api("GET", f"/api/qa/audit-cross-cutting?aspect={urllib.parse.quote(aspect)}")
        if isinstance(data, str):
            return [TextContent(type="text", text=data)]
            
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
        if isinstance(data, str):
            return [TextContent(type="text", text=data)]
            
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
        result = _api("DELETE", f"/api/nodes/{arguments['node_id']}")
        return [TextContent(type="text", text=f"노드 삭제 완료: {arguments['node_id']}")]
    
    elif name == "delete_edge":
        result = _api("DELETE", f"/api/edges/{arguments['edge_id']}")
        return [TextContent(type="text", text=f"엣지 삭제 완료: {arguments['edge_id']}")]
    
    elif name == "find_node":
        search = arguments["name"].lower()
        data = _api("GET", "/api/graph")
        if isinstance(data, str):
            return [TextContent(type="text", text=data)]
        
        matches = [n for n in data.get("nodes", []) if search in n["name"].lower()]
        if not matches:
            return [TextContent(type="text", text=f"'{arguments['name']}'와 일치하는 노드가 없습니다.")]
        
        lines = [f"검색 결과: {len(matches)}개\n"]
        for n in matches:
            status_icon = {"Passed": "✅", "Failed": "❌", "Blocked": "🟡", "Untested": "⬜"}.get(n.get("test_status"), "⬜")
            lines.append(f"  {status_icon} [{n['label']}] {n['name']}")
            lines.append(f"      id: {n['id']}")
        return [TextContent(type="text", text="\n".join(lines))]
    
    elif name == "get_coverage":
        data = _api("GET", "/api/graph")
        if isinstance(data, str):
            return [TextContent(type="text", text=data)]
        
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
        node_id = arguments["node_id"]
        result = _api("POST", f"/api/nodes/{urllib.parse.quote(node_id)}/mark-modified")
        if isinstance(result, str) and result.startswith("Error"):
            return [TextContent(type="text", text=result)]
        return [TextContent(type="text", text=f"🟠 노드 ({node_id}) 스펙 변경(Modified) 마킹 완료. 하류 영향 범위가 활성화되었습니다.")]

    elif name == "acknowledge_node":
        node_id = arguments["node_id"]
        result = _api("POST", f"/api/nodes/{urllib.parse.quote(node_id)}/acknowledge")
        if isinstance(result, str) and result.startswith("Error"):
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
