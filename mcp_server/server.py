# CoverageMap MCP Server
# FastAPI 백엔드(localhost:8001)를 래핑하여 AI 에이전트가 그래프를 조작할 수 있게 합니다.
# 실행: uv run python server.py

import json
import sys
import httpx
from mcp.server.lowlevel import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

BASE_URL = "http://localhost:8001"

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
            description="노드 또는 엣지의 테스트 상태를 변경합니다. (Passed, Failed, Untested)",
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
                        "enum": ["Passed", "Failed", "Untested"],
                        "description": "설정할 테스트 상태"
                    }
                },
                "required": ["target_type", "target_id", "status"]
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
            description="현재 테스트 커버리지 통계를 조회합니다. 노드/엣지별 Passed, Failed, Untested 수를 반환합니다.",
            inputSchema={
                "type": "object",
                "properties": {}
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
            status_icon = {"Passed": "✅", "Failed": "❌", "Untested": "⬜"}.get(n["test_status"], "⬜")
            aliases_str = ", ".join(n.get("aliases", []))
            lines.append(f"  {status_icon} [{n['label']}] {n['name']}  (id: {n['id']})")
            if aliases_str:
                lines.append(f"      aliases: {aliases_str}")
        
        lines.append(f"\n## 엣지 목록")
        # Build name lookup
        id_to_name = {n["id"]: n["name"] for n in nodes}
        for e in edges:
            status_icon = {"Passed": "✅", "Failed": "❌", "Untested": "⬜"}.get(e["test_status"], "⬜")
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
        
        if target_type == "node":
            body = {"test_status": status}
            result = _api("PUT", f"/api/nodes/{target_id}", body)
        else:
            body = {"test_status": status}
            result = _api("PUT", f"/api/edges/{target_id}", body)
        
        icon = {"Passed": "✅", "Failed": "❌", "Untested": "⬜"}.get(status, "")
        return [TextContent(type="text", text=f"{icon} {target_type} ({target_id}) → {status} 처리 완료")]
    
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
            status_icon = {"Passed": "✅", "Failed": "❌", "Untested": "⬜"}.get(n["test_status"], "⬜")
            lines.append(f"  {status_icon} [{n['label']}] {n['name']}")
            lines.append(f"      id: {n['id']}")
        return [TextContent(type="text", text="\n".join(lines))]
    
    elif name == "get_coverage":
        data = _api("GET", "/api/graph")
        if isinstance(data, str):
            return [TextContent(type="text", text=data)]
        
        nodes = data.get("nodes", [])
        edges = data.get("edges", [])
        
        node_stats = {"Passed": 0, "Failed": 0, "Untested": 0}
        edge_stats = {"Passed": 0, "Failed": 0, "Untested": 0}
        
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
            f"  ⬜ Untested: {node_stats['Untested']}",
            f"\n## 엣지 ({total_edges}개)",
            f"  ✅ Passed:   {edge_stats['Passed']}  ({edge_pct:.1f}%)",
            f"  ❌ Failed:   {edge_stats['Failed']}",
            f"  ⬜ Untested: {edge_stats['Untested']}",
        ]
        return [TextContent(type="text", text="\n".join(lines))]
    
    return [TextContent(type="text", text=f"Unknown tool: {name}")]


# ─── Entry Point ──────────────────────────────────────────────

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
