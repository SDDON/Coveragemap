import os
import re
import json
import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from graph_service import fetch_graph_from_neo4j, convert_to_response, serialize_props_for_neo4j
from models import IDENTIFIER_PATTERN

PRESETS_DIR = os.path.join(os.path.dirname(__file__), "presets")

def ensure_presets_dir():
    if not os.path.exists(PRESETS_DIR):
        os.makedirs(PRESETS_DIR, exist_ok=True)

def list_presets() -> List[Dict[str, Any]]:
    """List all available presets with metadata."""
    ensure_presets_dir()
    presets = []
    
    for filename in sorted(os.listdir(PRESETS_DIR)):
        if filename.endswith(".json"):
            filepath = os.path.join(PRESETS_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    presets.append({
                        "id": data.get("id", os.path.splitext(filename)[0]),
                        "name": data.get("name", filename),
                        "description": data.get("description", ""),
                        "created_at": data.get("created_at", ""),
                        "node_count": len(data.get("nodes", [])),
                        "edge_count": len(data.get("edges", []))
                    })
            except Exception as e:
                print(f"Error reading preset file {filename}: {e}")
                
    return presets

def _resolve_preset_path(preset_id: str) -> str:
    """
    프리셋 ID의 경로 탐색(Path Traversal) 공격을 검증하고, PRESETS_DIR 내부의 절대 경로를 반환합니다.
    - .., /, \\, \\0 포함 또는 허용되지 않는 문자열 패턴 시 HTTP 400 Bad Request
    - 정규화된 경로가 PRESETS_DIR 범위를 벗어날 경우 HTTP 400 Bad Request
    - 안전한 ID이지만 파일이 존재하지 않는 경우 HTTP 404 Not Found
    """
    ensure_presets_dir()

    if not isinstance(preset_id, str) or not preset_id.strip():
        raise HTTPException(status_code=400, detail="프리셋 ID가 올바르지 않습니다.")

    # 1. 경로 순회 및 디렉터리 구분자 차단
    if ".." in preset_id or "/" in preset_id or "\\" in preset_id or "\0" in preset_id:
        raise HTTPException(status_code=400, detail="경로 순회(Path Traversal) 문자가 포함되어 있습니다.")

    # 2. 영문/숫자/언더스코어/하이픈 및 선택적 .json 확장자만 허용
    if not re.fullmatch(r"^[A-Za-z0-9_\-]+(?:\.json)?$", preset_id):
        raise HTTPException(status_code=400, detail="프리셋 ID 규격이 올바르지 않습니다.")

    # 기본 .json 접미사 결합
    filename = preset_id if preset_id.endswith(".json") else f"{preset_id}.json"
    target_path = os.path.join(PRESETS_DIR, filename)

    real_dir = os.path.realpath(PRESETS_DIR)
    real_file = os.path.realpath(target_path)

    # 3. 디렉터리 경계 탈출 여부 엄격 검증
    try:
        if os.path.commonpath([real_dir, real_file]) != real_dir or real_file == real_dir:
            raise HTTPException(status_code=400, detail="허용되지 않는 프리셋 경로입니다.")
    except ValueError:
        # 윈도우 드라이브가 다른 경우 ValueError 발생
        raise HTTPException(status_code=400, detail="허용되지 않는 프리셋 경로입니다.")

    if not os.path.exists(real_file):
        # .json 없이 저장된 프리셋 파일 대체 탐색
        alt_path = os.path.join(PRESETS_DIR, preset_id)
        real_alt = os.path.realpath(alt_path)
        try:
            if os.path.commonpath([real_dir, real_alt]) != real_dir or real_alt == real_dir:
                raise HTTPException(status_code=400, detail="허용되지 않는 프리셋 경로입니다.")
        except ValueError:
            raise HTTPException(status_code=400, detail="허용되지 않는 프리셋 경로입니다.")

        if os.path.exists(real_alt) and not os.path.isdir(real_alt):
            return real_alt

        raise HTTPException(status_code=404, detail=f"Preset '{preset_id}' not found.")

    if os.path.isdir(real_file):
        raise HTTPException(status_code=400, detail="프리셋 경로는 파일이어야 합니다.")

    return real_file

def get_preset(preset_id: str) -> Dict[str, Any]:
    """Retrieve the full content of a specific preset safely."""
    filepath = _resolve_preset_path(preset_id)
            
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read preset: {str(e)}")

def _validate_identifier(value: str, kind: str) -> str:
    """
    프리셋 파일의 라벨/관계 타입은 Cypher 쿼리에 문자열로 삽입되므로,
    API 입력과 동일한 IDENTIFIER_PATTERN으로 검증합니다. (변조된 프리셋 파일에 의한 인젝션 방지)
    """
    if not isinstance(value, str) or not re.fullmatch(IDENTIFIER_PATTERN, value):
        raise ValueError(f"프리셋에 허용되지 않는 {kind} 값이 있습니다: {value!r}")
    return value

def load_preset_to_neo4j(session, preset_id: str, clean: bool = False) -> Dict[str, Any]:
    """
    Load a preset into Neo4j, either replacing (clean) or merging.
    clean=True는 DB 전체를 교체하므로, 호출 측(main.py)에서 자동 백업을 먼저 수행해야 합니다.
    전체 과정은 단일 트랜잭션으로 수행되어, 중간 실패 시 기존 데이터가 그대로 유지됩니다.
    """
    preset_data = get_preset(preset_id)
    nodes = preset_data.get("nodes", [])
    edges = preset_data.get("edges", [])

    # 쓰기 전에 모든 식별자를 먼저 검증하여, 잘못된 파일이면 아무것도 변경하지 않습니다.
    for n in nodes:
        _validate_identifier(n.get("label", "Node"), "라벨")
    for e in edges:
        _validate_identifier(e.get("type", "Depends_On"), "관계 타입")

    tx = session.begin_transaction()
    try:
        if clean:
            tx.run("MATCH (n) DETACH DELETE n")

        id_to_elem_id = {}

        # 1. Create Nodes
        for n in nodes:
            label = n.get("label", "Node")
            n_id = n.get("id")
            name = n.get("name", n_id)
            aliases = n.get("aliases", [])
            description = n.get("description", "")
            test_status = n.get("test_status", "Untested")
            props = serialize_props_for_neo4j(n.get("properties", {}))

            # Safe cypher creation
            query = f"""
            CREATE (n:`{label}`)
            SET n.id = $id,
                n.name = $name,
                n.aliases = $aliases,
                n.description = $description,
                n.test_status = $test_status,
                n += $props
            RETURN elementId(n) AS elem_id
            """
            res = tx.run(query, id=n_id, name=name, aliases=aliases, description=description, test_status=test_status, props=props)
            record = res.single()
            if record:
                elem_id = record["elem_id"]
                id_to_elem_id[n_id] = elem_id

        # 2. Create Edges
        created_edges_count = 0
        for e in edges:
            source_key = e.get("source")
            target_key = e.get("target")
            e_type = e.get("type", "Depends_On")
            action = e.get("action", "")
            test_status = e.get("test_status", "Untested")
            props = e.get("properties", {})

            source_elem = id_to_elem_id.get(source_key)
            target_elem = id_to_elem_id.get(target_key)

            if source_elem and target_elem:
                edge_query = f"""
                MATCH (s), (t)
                WHERE elementId(s) = $s_id AND elementId(t) = $t_id
                CREATE (s)-[r:`{e_type}`]->(t)
                SET r.action = $action,
                    r.test_status = $test_status,
                    r += $props
                RETURN elementId(r) AS elem_id
                """
                res = tx.run(edge_query, s_id=source_elem, t_id=target_elem, action=action, test_status=test_status, props=props)
                if res.single():
                    created_edges_count += 1
            else:
                # Fallback lookup by id property if nodes were already existing in DB
                edge_query = f"""
                MATCH (s {{id: $source_key}}), (t {{id: $target_key}})
                CREATE (s)-[r:`{e_type}`]->(t)
                SET r.action = $action,
                    r.test_status = $test_status,
                    r += $props
                RETURN elementId(r) AS elem_id
                """
                res = tx.run(edge_query, source_key=source_key, target_key=target_key, action=action, test_status=test_status, props=props)
                if res.single():
                    created_edges_count += 1

        tx.commit()
    except Exception:
        tx.rollback()
        raise
    finally:
        tx.close()

    return {
        "status": "success",
        "preset_id": preset_id,
        "nodes_created": len(nodes),
        "edges_created": created_edges_count,
        "clean_mode": clean
    }

def save_current_graph_as_preset(session, preset_id: str, name: str, description: str) -> Dict[str, Any]:
    """Export the active Neo4j graph into a new preset JSON file."""
    ensure_presets_dir()
    
    # Sanitize preset_id
    safe_id = "".join([c if c.isalnum() or c in ("-", "_") else "_" for c in preset_id.strip()]).lower()
    if not safe_id:
        safe_id = f"preset_{int(datetime.datetime.now().timestamp())}"
        
    full_graph = fetch_graph_from_neo4j(session)
    response_data = convert_to_response(full_graph)
    
    nodes_export = []
    # elementId -> 내보내기 ID 매핑. 엣지의 source/target도 같은 ID로 변환해야 복원 시 연결이 유지됩니다.
    # (id 속성이 중복되는 경우 복원 시 엉뚱한 노드에 연결되지 않도록 elementId로 대체합니다.)
    elem_to_export_id = {}
    used_ids = set()
    for n in response_data.nodes:
        export_id = n.properties.get("id") or n.id
        if export_id in used_ids:
            export_id = n.id
        used_ids.add(export_id)
        elem_to_export_id[n.id] = export_id
        nodes_export.append({
            "id": export_id,
            "label": n.label,
            "name": n.name,
            "aliases": n.aliases,
            "description": n.properties.get("description", ""),
            "test_status": n.test_status,
            "properties": {k: v for k, v in n.properties.items() if k not in ("id", "name", "aliases", "test_status", "description")}
        })
        
    edges_export = []
    for e in response_data.edges:
        edges_export.append({
            "source": elem_to_export_id.get(e.source, e.source),
            "target": elem_to_export_id.get(e.target, e.target),
            "type": e.type,
            "action": e.action,
            "test_status": e.test_status,
            "properties": e.properties
        })
        
    preset_data = {
        "id": safe_id,
        "name": name.strip() or safe_id,
        "description": description.strip(),
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "nodes": nodes_export,
        "edges": edges_export
    }
    
    filepath = os.path.join(PRESETS_DIR, f"{safe_id}.json")
    real_dir = os.path.realpath(PRESETS_DIR)
    real_file = os.path.realpath(filepath)
    if os.path.commonpath([real_dir, real_file]) != real_dir or real_file == real_dir:
        raise HTTPException(status_code=400, detail="유효하지 않은 프리셋 저장 경로입니다.")

    with open(real_file, "w", encoding="utf-8") as f:
        json.dump(preset_data, f, ensure_ascii=False, indent=2)
        
    return {
        "status": "success",
        "preset_id": safe_id,
        "name": preset_data["name"],
        "node_count": len(nodes_export),
        "edge_count": len(edges_export)
    }

# ─── Auto Backup ────────────────────────────────────────────────────
# 파괴적 작업(워크스페이스 clean 적용, 프리셋 Clean Load) 직전에 현재 그래프 전체를 프리셋 파일로 저장합니다.
# 복원은 프리셋 관리 화면에서 '_autobackup_' 항목을 불러오면 됩니다. (git에는 커밋되지 않도록 .gitignore 처리)

AUTOBACKUP_PREFIX = "_autobackup_"
AUTOBACKUP_KEEP = 10

def create_auto_backup(session, reason: str) -> Dict[str, Any]:
    """현재 그래프를 '_autobackup_YYYYMMDD_HHMMSS_ffffff' 프리셋으로 저장하고, 최근 AUTOBACKUP_KEEP개만 남깁니다."""
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    result = save_current_graph_as_preset(
        session,
        f"{AUTOBACKUP_PREFIX}{stamp}",
        f"자동 백업 {stamp[:15]}",
        f"자동 백업 사유: {reason}"
    )
    prune_auto_backups()
    return result

def prune_auto_backups(keep: int = AUTOBACKUP_KEEP) -> List[str]:
    """오래된 자동 백업 파일을 삭제합니다. 파일명에 시각이 포함되어 있으므로 이름순 정렬 = 시간순 정렬입니다."""
    ensure_presets_dir()
    backups = sorted(f for f in os.listdir(PRESETS_DIR)
                     if f.startswith(AUTOBACKUP_PREFIX) and f.endswith(".json"))
    removed = []
    for f in backups[:-keep] if keep > 0 else backups:
        os.remove(os.path.join(PRESETS_DIR, f))
        removed.append(f)
    return removed
