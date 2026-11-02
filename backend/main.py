import os
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Query, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from database import get_db, close_driver
from models import (
    GraphResponse, NodeCreate, NodeUpdate, EdgeCreate, EdgeUpdate,
    PresetCreate, ModifiedMark, NodeCloneRequest, NodeCloneResponse
)
from graph_service import (
    fetch_graph_from_neo4j, process_graph, convert_to_response,
    create_node, update_node, delete_node,
    create_edge, update_edge, delete_edge,
    get_impact_nodes, deserialize_props_from_neo4j,
    mark_node_modified, acknowledge_node_modification, get_node_statuses,
    clone_node_with_children, sanitize_node_properties
)
from preset_service import (
    list_presets, get_preset, load_preset_to_neo4j, save_current_graph_as_preset, create_auto_backup
)
import uvicorn

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    close_driver()

app = FastAPI(title="CoverageMap API", lifespan=lifespan)

# 동시 reset-seed 요청 경합 방지를 위한 스레드 락
_reset_seed_lock = threading.Lock()

# CORS 설정: 와일드카드(*) + credentials=True 취약점을 제거하고 로컬 출처 및 환경 변수 우선 적용
port_str = os.getenv("PORT", os.getenv("BACKEND_PORT", "8190"))
try:
    server_port = int(port_str)
except ValueError:
    server_port = 8190

default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    f"http://localhost:{server_port}",
    f"http://127.0.0.1:{server_port}",
]
cors_env = os.getenv("CORS_ORIGINS", "").strip()
allowed_origins = [o.strip() for o in cors_env.split(",") if o.strip()] if cors_env else default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

@app.get("/api/health")
def api_health(session = Depends(get_db)):
    try:
        session.run("RETURN 1")
        return {"status": "ok", "db": "ok"}
    except Exception as e:
        return {"status": "error", "db": "error", "message": str(e)}

@app.get("/api/graph", response_model=GraphResponse)
def get_graph(
    response: Response,
    max_depth: Optional[int] = Query(None, ge=0, description="Maximum depth for graph traversal"),
    filter: Optional[str] = Query(None, description="Filter string to search nodes"),
    debounce_id: Optional[str] = Query(None, description="Debounce ID for frontend syncing"),
    session = Depends(get_db)
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    # Fetch from Neo4j
    full_graph = fetch_graph_from_neo4j(session)
    
    # Process using NetworkX
    processed_graph = process_graph(full_graph, filter_str=filter, max_depth=max_depth)
    
    # Convert to response
    return convert_to_response(processed_graph, debounce_id=debounce_id)

@app.get("/api/aliases", response_model=List[str])
def get_aliases(response: Response, session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    """Return all unique normalized aliases present in the current graph."""
    result = session.run("MATCH (n) WHERE n.aliases IS NOT NULL UNWIND n.aliases AS alias RETURN DISTINCT alias")
    from graph_service import _normalize_aliases
    aliases = set()
    for record in result:
        alias = record["alias"]
        if alias:
            for n_alias in _normalize_aliases(alias):
                aliases.add(n_alias)
    return sorted(list(aliases))

@app.put("/api/aliases/{old_alias}")
def api_rename_alias(old_alias: str, new_alias: str = Query(...), session = Depends(get_db)):
    try:
        from graph_service import rename_alias
        rename_alias(session, old_alias, new_alias)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/aliases/{alias_name}")
def api_delete_alias(alias_name: str, session = Depends(get_db)):
    try:
        from graph_service import delete_alias
        delete_alias(session, alias_name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/nodes", response_model=str)
def api_create_node(node: NodeCreate, session = Depends(get_db)):
    try:
        return create_node(session, node)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/globals")
def api_get_globals(session = Depends(get_db)):
    try:
        query = (
            "MATCH (n) WHERE n.is_global = 'true' "
            "RETURN elementId(n) AS id, labels(n)[0] AS type, labels(n)[0] AS label, "
            "n.name AS name, coalesce(n.aliases, []) AS aliases, "
            "n.description AS description, n.issue_link AS issue_link, "
            "coalesce(n.test_status, 'Untested') AS test_status, "
            "coalesce(n.is_manual_override, false) AS is_manual_override, "
            "n.override_reason AS override_reason, "
            "properties(n) AS properties"
        )
        res = session.run(query).data()
        for item in res:
            raw_props = deserialize_props_from_neo4j(item.get("properties") or {})
            item["properties"] = sanitize_node_properties(raw_props)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/nodes/{node_id}/details")
def api_get_node_details(node_id: str, session = Depends(get_db)):
    """특정 노드의 전체 프로퍼티, 전역 여부, 체크리스트, 부모/자식 및 진입/진출 엣지를 상세 조회합니다."""
    from graph_service import get_node_full_details
    res = get_node_full_details(session, node_id)
    if not res:
        raise HTTPException(status_code=404, detail=f"'{node_id}'에 해당하는 노드를 찾을 수 없습니다.")
    return res

@app.get("/api/nodes/{node_id}")
def api_get_node(node_id: str, session = Depends(get_db)):
    try:
        query = (
            "MATCH (n) WHERE elementId(n) = $id "
            "RETURN elementId(n) AS id, labels(n)[0] AS type, labels(n)[0] AS label, "
            "n.name AS name, coalesce(n.aliases, []) AS aliases, "
            "coalesce(n.test_status, 'Untested') AS test_status, "
            "coalesce(n.is_manual_override, false) AS is_manual_override, "
            "n.override_reason AS override_reason, "
            "properties(n) AS properties"
        )
        res = session.run(query, id=node_id).single()
        if not res:
            raise HTTPException(status_code=404, detail="Node not found")
        data = res.data()
        raw_props = deserialize_props_from_neo4j(data.get("properties") or {})
        data["properties"] = sanitize_node_properties(raw_props)
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/nodes/{node_id}")
def api_update_node(node_id: str, node: NodeUpdate, session = Depends(get_db)):
    try:
        update_node(session, node_id, node)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/nodes/{node_id}")
def api_delete_node(node_id: str, session = Depends(get_db)):
    try:
        delete_node(session, node_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ─── Change Impact Ripple Highlight (TESTCASE 스펙 7.4) ─────────────
@app.post("/api/nodes/{node_id}/mark-modified")
def api_mark_node_modified(node_id: str, body: Optional[ModifiedMark] = None, session = Depends(get_db)):
    """기획/UI 변경이 발생한 노드를 수정 상태로 표시합니다 (is_modified=true, modified_note 기록)."""
    res = mark_node_modified(session, node_id, (body.note if body else "") or "")
    if not res:
        raise HTTPException(status_code=404, detail="Node not found")
    return res

@app.post("/api/nodes/{node_id}/acknowledge")
def api_acknowledge_node(node_id: str, session = Depends(get_db)):
    """테스터가 변경 내역 확인/재검증을 마쳤음을 기록합니다 (is_modified=false)."""
    res = acknowledge_node_modification(session, node_id)
    if not res:
        raise HTTPException(status_code=404, detail="Node not found")
    return res

@app.post("/api/nodes/{node_id}/clone", response_model=NodeCloneResponse)
def api_clone_node(node_id: str, body: Optional[NodeCloneRequest] = None, session = Depends(get_db)):
    """노드(및 직속 Contains/Has 자식 노드, 내부 엣지, 글로벌 배지 엣지)를 새 태그로 복제하고 상태를 Untested로 초기화합니다."""
    try:
        res = clone_node_with_children(session, node_id, tag=(body.tag if body else None))
        if not res:
            raise HTTPException(status_code=404, detail="Node not found")
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/node-statuses")
def api_node_statuses(session = Depends(get_db)):
    """연쇄 전파 이후 프론트엔드 낙관적 상태를 서버 기준으로 재동기화하기 위한 {node_id: test_status} 스냅샷."""
    return get_node_statuses(session)

@app.post("/api/edges", response_model=str)
def api_create_edge(edge: EdgeCreate, session = Depends(get_db)):
    try:
        return create_edge(session, edge)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/edges/{edge_id}")
def api_update_edge(edge_id: str, edge: EdgeUpdate, session = Depends(get_db)):
    try:
        new_id = update_edge(session, edge_id, edge)
        return {"status": "success", "new_id": new_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/edges/{edge_id}")
def api_delete_edge(edge_id: str, session = Depends(get_db)):
    try:
        delete_edge(session, edge_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/impact/{node_id}")
def api_get_impact(node_id: str, session = Depends(get_db)):
    """Return all nodes connected to a global node for Impact Overlay."""
    try:
        return get_impact_nodes(session, node_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/presets")
def api_list_presets():
    """List all available presets (sample datasets)."""
    try:
        return list_presets()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/presets/{preset_id}")
def api_get_preset(preset_id: str):
    """Get full details of a specific preset."""
    return get_preset(preset_id)

@app.post("/api/presets/{preset_id}/load")
def api_load_preset(preset_id: str, clean: bool = Query(False, description="Clear existing database before loading (auto-backup is created first)"), session = Depends(get_db)):
    """Load a preset into Neo4j."""
    try:
        backup = None
        if clean:
            # DB 전체 교체 전 자동 백업 (복원: 프리셋 목록의 '_autobackup_' 항목)
            backup = create_auto_backup(session, f"프리셋 '{preset_id}' Clean Load")
        result = load_preset_to_neo4j(session, preset_id, clean=clean)
        if backup:
            result["backup_preset_id"] = backup["preset_id"]
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/presets")
def api_save_preset(preset: PresetCreate, session = Depends(get_db)):
    """Export current Neo4j graph into a new preset JSON file."""
    try:
        return save_current_graph_as_preset(session, preset.id, preset.name, preset.description or "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── QA Copilot Endpoints (Phase 1) ─────────────────────────────────

@app.get("/api/qa/status-summary")
def api_qa_status_summary(q: str = Query(..., description="Node name or element ID"), session = Depends(get_db)):
    """특정 노드의 테스트 상태, 오버라이드 사유, 들어오는 엣지 분포 및 블로커 원인을 요약 조회합니다."""
    from graph_service import get_node_status_summary
    res = get_node_status_summary(session, q)
    if not res:
        raise HTTPException(status_code=404, detail=f"'{q}'에 해당하는 노드를 찾을 수 없습니다.")
    return res

@app.get("/api/qa/impact-scope")
def api_qa_impact_scope(q: str = Query(..., description="Changed node name or element ID"), session = Depends(get_db)):
    """특정 노드/기능 변경 시 하류 방향으로 영향을 받는 모든 노드/엣지 및 추천 회귀 테스트 범위를 산출합니다."""
    from graph_service import get_impact_scope
    res = get_impact_scope(session, q)
    if not res:
        raise HTTPException(status_code=404, detail=f"'{q}'에 해당하는 노드를 찾을 수 없습니다.")
    return res

@app.get("/api/qa/audit-cross-cutting")
def api_qa_audit_cross_cutting(
    aspect: str = Query(..., description="Cross-cutting aspect (e.g. 다국어, 화면비, 사운드, i18n)"),
    scope_root_id: Optional[str] = Query(None, description="Optional root Screen/Container node ID or name for scoped audit"),
    session = Depends(get_db)
):
    """화면비, 다국어, 사운드 등 필수 횡단 관심사가 전체 UI(또는 scope_root_id 하위 범위)에 누락 없이 매핑되어 있는지 감사(Audit)합니다."""
    from graph_service import audit_cross_cutting
    return audit_cross_cutting(session, aspect, scope_root_id=scope_root_id)

@app.get("/api/qa/next-targets")
def api_qa_next_targets(session = Depends(get_db)):
    """선행 조건이 모두 Passed되어 지금 즉시 검증을 시작할 수 있는 Untested 노드들을 추천합니다."""
    from graph_service import get_next_test_targets
    return get_next_test_targets(session)


# ─── Dev / Testing Endpoints ────────────────────────────────────────

@app.post("/api/dev/reset-seed")
def api_reset_seed(request: Request = None, session = Depends(get_db)):
    client_host = (request.client.host if request and getattr(request, "client", None) else "").strip().lower()
    if client_host and client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(
            status_code=403,
            detail="Development endpoints are restricted to local loopback requests only."
        )
    """개발/테스트 전용 시드 리셋 엔드포인트. ENABLE_DEV_ENDPOINTS=1 설정 시에만 허용됩니다."""
    if os.getenv("ENABLE_DEV_ENDPOINTS", "").strip().lower() not in ("true", "1", "yes"):
        raise HTTPException(
            status_code=403,
            detail="Development endpoints are disabled. Set ENABLE_DEV_ENDPOINTS=1 to enable."
        )

    with _reset_seed_lock:
        import subprocess, sys
        # E2E 테스트용 시드 리셋은 DB 전체를 지웁니다(MATCH (n) DETACH DELETE n).
        # 사용자 실데이터 유실을 막기 위해, 현재 DB가 '시드 그래프'가 아닐 때만 자동 백업을 남깁니다.
        # - 시드 마커(Game_Root)가 이미 있으면: 이전 E2E 리셋 결과이므로 백업 생략 (E2E 반복 호출 시 백업 10개 로테이션 소진 방지)
        # - 빈 DB면: 백업할 내용이 없으므로 생략
        backup = None
        record = session.run(
            "MATCH (n) RETURN count(n) AS total, "
            "count(CASE WHEN n.id = 'Game_Root' THEN 1 END) AS seed_marker"
        ).single()
        if record and record["total"] > 0 and record["seed_marker"] == 0:
            backup = create_auto_backup(session, "E2E reset-seed 직전 자동 백업")
        subprocess.run([sys.executable, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts', 'seed.py'))], check=True)
        return {"status": "success", "backup": backup}


if __name__ == "__main__":
    host = os.getenv("BACKEND_HOST", os.getenv("HOST", "127.0.0.1"))
    port_str = os.getenv("PORT", os.getenv("BACKEND_PORT", "8190"))
    try:
        port = int(port_str)
    except ValueError:
        port = 8190
    uvicorn.run("main:app", host=host, port=port, reload=True)

