import csv
import io
import re
from typing import Dict, Any, List, Optional
from graph_service import _normalize_aliases, _normalize_string, _recalc_target_node_status

def parse_spreadsheet_to_graph(csv_text: str) -> Dict[str, Any]:
    """
    CSV 형식의 테스트 명세서를 파싱하여 CoverageMap의 노드 및 엣지 구조로 변환합니다.
    
    지원 헤더:
    - Screen (대분류/화면)
    - Feature (중분류/기능)
    - TestCase (소분류/검증항목)
    - Prerequisite (선행조건 기능 또는 TC 이름)
    - CrossCutting (쉼표 구분 횡단속성 예: 다국어, 21:9)
    - Description (기능/검증 설명)
    """
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    
    nodes_map: Dict[str, Dict[str, Any]] = {}
    edges_list: List[Dict[str, Any]] = []
    
    # 헤더 정규화 매핑
    field_map = {}
    if reader.fieldnames:
        for f in reader.fieldnames:
            f_clean = f.strip().lower()
            if "screen" in f_clean or "화면" in f_clean:
                field_map["screen"] = f
            elif "feature" in f_clean or "기능" in f_clean:
                field_map["feature"] = f
            elif "testcase" in f_clean or "tc" in f_clean or "테스트" in f_clean or "시나리오" in f_clean:
                field_map["testcase"] = f
            elif "prereq" in f_clean or "선행" in f_clean or "선수" in f_clean:
                field_map["prerequisite"] = f
            elif "cross" in f_clean or "횡단" in f_clean or "속성" in f_clean or "badge" in f_clean:
                field_map["crosscutting"] = f
            elif "desc" in f_clean or "설명" in f_clean or "비고" in f_clean:
                field_map["description"] = f
                
    row_idx = 0
    for row in reader:
        row_idx += 1
        screen_val = (row.get(field_map.get("screen", "")) or "").strip()
        feature_val = (row.get(field_map.get("feature", "")) or "").strip()
        tc_val = (row.get(field_map.get("testcase", "")) or "").strip()
        prereq_val = (row.get(field_map.get("prerequisite", "")) or "").strip()
        cross_val = (row.get(field_map.get("crosscutting", "")) or "").strip()
        desc_val = (row.get(field_map.get("description", "")) or "").strip()
        
        # 1. Screen 노드 등록
        screen_id = None
        if screen_val:
            screen_id = f"screen_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', screen_val)}"
            if screen_id not in nodes_map:
                nodes_map[screen_id] = {
                    "id": screen_id,
                    "label": "Screen",
                    "name": screen_val,
                    "aliases": ["Screen"],
                    "description": f"{screen_val} 화면",
                    "test_status": "Untested",
                    "properties": {}
                }
                
        # 2. Feature 노드 등록
        feature_id = None
        if feature_val:
            feature_id = f"feat_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', feature_val)}"
            if feature_id not in nodes_map:
                aliases = ["Feature"]
                if cross_val:
                    aliases.extend([c.strip() for c in cross_val.split(",") if c.strip()])
                nodes_map[feature_id] = {
                    "id": feature_id,
                    "label": "Feature",
                    "name": feature_val,
                    "aliases": _normalize_aliases(aliases),
                    "description": desc_val if not tc_val else f"{feature_val} 기능",
                    "test_status": "Untested",
                    "properties": {}
                }
            # Screen -> Feature 의존성 연결
            if screen_id:
                edges_list.append({
                    "source": screen_id,
                    "target": feature_id,
                    "type": "Contains",
                    "action": "포함",
                    "test_status": "Untested"
                })
                
        # 3. TestCase 노드 등록
        if tc_val:
            tc_id = f"tc_{row_idx}_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', tc_val[:15])}"
            nodes_map[tc_id] = {
                "id": tc_id,
                "label": "TestCase",
                "name": tc_val,
                "aliases": ["TestCase"],
                "description": desc_val or tc_val,
                "test_status": "Untested",
                "properties": {}
            }
            # Feature -> TestCase 연결
            parent_target = feature_id or screen_id
            if parent_target:
                edges_list.append({
                    "source": tc_id,
                    "target": parent_target,
                    "type": "Tests",
                    "action": "검증",
                    "test_status": "Untested"
                })
                
        # 4. Prerequisite(선행조건) 연결
        if prereq_val and (feature_id or screen_id):
            target_node = feature_id or screen_id
            # 기존 노드 중 이름 일치 검색
            matched_prereq_id = None
            for nid, ndata in nodes_map.items():
                if ndata["name"].lower() == prereq_val.lower():
                    matched_prereq_id = nid
                    break
            if not matched_prereq_id:
                # 없으면 임시 노드로 생성
                matched_prereq_id = f"prereq_{re.sub(r'[^a-zA-Z0-9가-힣]', '_', prereq_val)}"
                nodes_map[matched_prereq_id] = {
                    "id": matched_prereq_id,
                    "label": "Feature",
                    "name": prereq_val,
                    "aliases": ["Prerequisite"],
                    "description": f"선행 조건: {prereq_val}",
                    "test_status": "Untested",
                    "properties": {}
                }
            edges_list.append({
                "source": matched_prereq_id,
                "target": target_node,
                "type": "Depends_On",
                "action": "선수 조건",
                "test_status": "Untested"
            })
            
    # 중복 엣지 제거
    unique_edges = []
    seen_edge_keys = set()
    for e in edges_list:
        key = f"{e['source']}->{e['target']}::{e['type']}"
        if key not in seen_edge_keys:
            seen_edge_keys.add(key)
            unique_edges.append(e)
            
    return {
        "nodes": list(nodes_map.values()),
        "edges": unique_edges
    }


def normalize_workspace(workspace: Optional[str]) -> str:
    """
    워크스페이스 문자열을 노드 aliases에 저장되는 표준 표기로 변환합니다.
    (예: 'front-end' -> 'frontend', 'star rail' -> 'Star Rail')
    빈 문자열/공백은 '워크스페이스 없음(전체 보기)'을 의미하므로 ""를 반환합니다.
    """
    ws = (workspace or "").strip()
    if not ws:
        return ""
    return _normalize_string(ws)


def find_workspace_nodes(session, workspace: str) -> List[Dict[str, Any]]:
    """
    표준화된 aliases 기준으로 해당 워크스페이스 태그를 가진 노드 목록을 반환합니다.
    DB에는 정규화 이전 표기('star rail' 등)가 남아 있을 수 있으므로,
    화면에 보이는 것과 동일한 규칙(_normalize_aliases)으로 Python에서 비교합니다.
    """
    ws = normalize_workspace(workspace)
    if not ws:
        return []
    result = session.run(
        "MATCH (n) WHERE n.aliases IS NOT NULL "
        "RETURN elementId(n) AS elem_id, n.name AS name, n.aliases AS aliases"
    )
    matched = []
    for rec in result:
        if ws in _normalize_aliases(rec["aliases"]):
            matched.append({"elem_id": rec["elem_id"], "name": rec["name"]})
    return matched


def _find_existing_node(session, name: str, label: str, workspace: str) -> Optional[str]:
    """
    중복 판정: 이름 + 라벨 + 워크스페이스가 모두 같아야 같은 노드로 간주합니다.
    워크스페이스가 비어 있으면 이름 + 라벨만으로 판정합니다.
    (수동 노드 생성(create_node)의 전역 이름 유일성 규칙과는 별개입니다.)
    """
    result = session.run(
        "MATCH (n) WHERE n.name = $name AND $label IN labels(n) "
        "RETURN elementId(n) AS elem_id, n.aliases AS aliases",
        name=name, label=label
    )
    for rec in result:
        if not workspace or workspace in _normalize_aliases(rec["aliases"]):
            return rec["elem_id"]
    return None


def apply_ingested_graph_to_neo4j(session, graph_data: Dict[str, Any], workspace: str = "",
                                  clean: bool = False, dry_run: bool = False) -> Dict[str, Any]:
    """
    파싱된 노드와 엣지를 Neo4j 데이터베이스에 일괄 적용합니다.

    - workspace: 가져온 모든 노드의 aliases에 이 워크스페이스 태그를 추가합니다.
    - clean=True: '이 워크스페이스 태그를 가진 노드'만 삭제한 뒤 적용합니다. (DB 전체 삭제 아님)
      워크스페이스가 비어 있으면 삭제 범위를 특정할 수 없으므로 ValueError를 발생시킵니다.
    - dry_run=True: DB를 변경하지 않고 삭제/생성 예정 내역만 반환합니다. (UI의 삭제 확인 단계용)
    - 실제 적용은 단일 트랜잭션으로 수행되어, 중간 실패 시 전체가 롤백됩니다.
    """
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])
    ws = normalize_workspace(workspace)

    if clean and not ws:
        raise ValueError("워크스페이스가 지정되지 않아 clean(기존 노드 삭제) 범위를 정할 수 없습니다.")

    to_delete = find_workspace_nodes(session, ws) if clean else []

    if dry_run:
        # 삭제 예정 노드를 제외하고, 재사용될(이미 존재하는) 노드 수를 계산합니다.
        delete_ids = {d["elem_id"] for d in to_delete}
        reuse = 0
        for n in nodes:
            elem_id = _find_existing_node(session, n.get("name", n.get("id")), n.get("label", "Feature"), ws)
            if elem_id and elem_id not in delete_ids:
                reuse += 1
        return {
            "status": "dry_run",
            "workspace": ws,
            "will_delete": [d["name"] for d in to_delete],
            "will_create_nodes": len(nodes) - reuse,
            "will_reuse_nodes": reuse,
            "total_parsed_edges": len(edges)
        }

    tx = session.begin_transaction()
    try:
        if to_delete:
            delete_ids = [d["elem_id"] for d in to_delete]
            # 삭제 대상 밖(다른 워크스페이스)의 하류 노드는 들어오는 엣지가 사라지므로 상태 재합성이 필요합니다.
            orphan_targets = [
                rec["t_id"] for rec in tx.run(
                    "MATCH (n)-[]->(t) WHERE elementId(n) IN $ids AND NOT elementId(t) IN $ids "
                    "RETURN DISTINCT elementId(t) AS t_id",
                    ids=delete_ids
                )
            ]
            tx.run("MATCH (n) WHERE elementId(n) IN $ids DETACH DELETE n", ids=delete_ids)
            for t_id in orphan_targets:
                _recalc_target_node_status(tx, t_id)

        id_to_elem_id = {}

        # 1. 노드 생성 (중복 방지: 이름+라벨+워크스페이스가 같은 기존 노드는 ID 매핑만 수행)
        created_nodes = 0
        for n in nodes:
            label = n.get("label", "Feature")
            n_id = n.get("id")
            name = n.get("name", n_id)
            aliases = list(n.get("aliases", []))
            if ws:
                aliases.append(ws)
            aliases = _normalize_aliases(aliases)
            description = n.get("description", "")
            test_status = n.get("test_status", "Untested")
            props = n.get("properties", {})

            elem_id = _find_existing_node(tx, name, label, ws)
            if elem_id:
                id_to_elem_id[n_id] = elem_id
                id_to_elem_id[elem_id] = elem_id
                continue

            # label은 ApplyIngestRequest(IDENTIFIER_PATTERN)에서 검증된 값만 들어옵니다.
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
            rec = tx.run(query, id=n_id, name=name, aliases=aliases, description=description,
                         test_status=test_status, props=props).single()
            if rec:
                elem_id = rec["elem_id"]
                id_to_elem_id[n_id] = elem_id
                id_to_elem_id[elem_id] = elem_id
                created_nodes += 1

        # 2. 엣지 생성 (같은 타입의 엣지가 이미 있으면 새로 만들지 않음)
        created_edges = 0
        for e in edges:
            source_key = e.get("source")
            target_key = e.get("target")
            e_type = e.get("type", "Depends_On")
            action = e.get("action", "")
            test_status = e.get("test_status", "Untested")
            props = e.get("properties", {})

            real_src = id_to_elem_id.get(source_key, source_key)
            real_tgt = id_to_elem_id.get(target_key, target_key)

            # e_type 역시 IDENTIFIER_PATTERN으로 검증된 값입니다.
            exists = tx.run(
                f"MATCH (a)-[r:`{e_type}`]->(b) WHERE elementId(a) = $src AND elementId(b) = $tgt "
                "RETURN count(r) AS c",
                src=real_src, tgt=real_tgt
            ).single()
            if exists and exists["c"] > 0:
                continue

            edge_query = f"""
            MATCH (a), (b)
            WHERE elementId(a) = $src AND elementId(b) = $tgt
            CREATE (a)-[r:`{e_type}`]->(b)
            SET r.test_status = $test_status,
                r.action = $action,
                r += $props
            RETURN elementId(r) AS rel_id
            """
            if tx.run(edge_query, src=real_src, tgt=real_tgt, test_status=test_status,
                      action=action, props=props).single():
                created_edges += 1
                _recalc_target_node_status(tx, real_tgt)

        tx.commit()
    except Exception:
        tx.rollback()
        raise
    finally:
        tx.close()

    return {
        "status": "success",
        "workspace": ws,
        "deleted_nodes": len(to_delete),
        "created_nodes": created_nodes,
        "created_edges": created_edges,
        "total_parsed_nodes": len(nodes),
        "total_parsed_edges": len(edges)
    }
