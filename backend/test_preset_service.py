"""
프리셋 서비스 경로 순회(Path Traversal) 방어 및 정상 조회 검증 (GAP-7)
"""
import pytest
from fastapi import HTTPException
from unittest.mock import Mock
from preset_service import get_preset, list_presets, load_preset_to_neo4j, _resolve_preset_path, AUTOBACKUP_PREFIX
from graph_service import compute_synthesized_status, checklist_status


def test_get_preset_path_traversal_payloads_raise_400():
    """상위 디렉터리 이동(..), 슬래시(/), 역슬래시(\\), 널바이트 등 악의적 ID에 대해 HTTP 400을 반환해야 합니다."""
    malicious_ids = [
        "../outside",
        "..\\windows\\win.ini",
        "../../etc/passwd",
        "/etc/shadow",
        "C:\\boot.ini",
        "sub/dir/preset",
        "preset\\..\\escape",
        "preset\0null",
        "",
        "   ",
        "invalid;id",
        "invalid id with space",
    ]
    for pid in malicious_ids:
        with pytest.raises(HTTPException) as exc_info:
            get_preset(pid)
        assert exc_info.value.status_code == 400, f"Expected 400 for payload: {pid!r}, got {exc_info.value.status_code}"


def test_get_preset_non_existent_valid_id_raises_404():
    """안전한 형식이지만 존재하지 않는 프리셋 ID는 HTTP 400이 아닌 404 Not Found를 반환해야 합니다."""
    with pytest.raises(HTTPException) as exc_info:
        get_preset("non_existent_preset_99999_valid_name")
    assert exc_info.value.status_code == 404


def test_get_preset_valid_existing_success():
    """기존 존재하는 프리셋(minimal_e2e 등)을 확장자 유무와 관계없이 정상 조회해야 합니다."""
    res1 = get_preset("minimal_e2e")
    assert "nodes" in res1
    assert "edges" in res1

    res2 = get_preset("minimal_e2e.json")
    assert res2 == res1


def test_load_preset_traversal_rejected():
    """load_preset_to_neo4j 역시 get_preset을 경유하므로 경로 탐색 시 HTTP 400으로 즉시 차단되어야 합니다."""
    mock_session = Mock()
    with pytest.raises(HTTPException) as exc_info:
        load_preset_to_neo4j(mock_session, "../../secret")
    assert exc_info.value.status_code == 400


def test_honkai_starrail_full_qa_preset_invariants_and_synthesis():
    """
    대규모 실전 샘플 프리셋(honkai_starrail_full_qa)이
    40개 노드, 300개 고유 엣지, 전진 엣지(Contains/Depends_On/Tests/Transition) DAG 무사이클,
    Return 엣지 weight=0, Contains 최대 깊이 1, 4단계 상태 합성(compute_synthesized_status) 정합성을 모두 만족하는지 검증합니다.
    """
    import networkx as nx

    data = get_preset("honkai_starrail_full_qa")
    nodes = data["nodes"]
    edges = data["edges"]

    assert len(nodes) == 40
    assert len(edges) == 300

    node_map = {n["id"]: n for n in nodes}
    assert len(node_map) == 40

    # 모든 엣지의 source/target 존재, 자기 루프 부재, (source, target) 쌍 고유성 확인
    edge_pairs = set()
    for e in edges:
        assert e["source"] in node_map
        assert e["target"] in node_map
        assert e["source"] != e["target"]
        pair = (e["source"], e["target"])
        assert pair not in edge_pairs, f"Duplicate parallel edge detected: {pair}"
        edge_pairs.add(pair)
        if e["type"] == "Return":
            assert e.get("properties", {}).get("weight") == 0, f"Return edge {pair} missing weight=0"

    # 1. 전진 엣지(Contains / Depends_On / Tests / Transition) 전체 DAG 무사이클 검증 (Rule 12)
    forward_g = nx.DiGraph()
    for e in edges:
        if e["type"] != "Return":
            forward_g.add_edge(e["source"], e["target"])
    assert nx.is_directed_acyclic_graph(forward_g), "Forward (non-Return) edges must form a strict DAG"

    # 2. Contains Max Depth = 1 및 단일 부모 검증
    cont_g = nx.DiGraph()
    for e in edges:
        if e["type"] in ("Contains", "Has"):
            cont_g.add_edge(e["source"], e["target"])
    assert nx.is_directed_acyclic_graph(cont_g)
    for u, v in cont_g.edges():
        assert cont_g.out_degree(v) == 0, f"Contains depth > 1 detected at {u} -> {v}"
    for v in cont_g.nodes():
        assert cont_g.in_degree(v) <= 1, f"Multiple parents detected for {v}"

    # 3. 4단계 상태 합성(compute_synthesized_status) 정합성 검증 (일반 노드 및 Global 노드 전원)
    for nid, n in node_map.items():
        props = n.get("properties", {})
        is_node_global = str(props.get("is_global", "")).lower() == "true"
        if props.get("is_manual_override") is True:
            assert props.get("override_reason"), f"Manual override node {nid} missing override_reason"
            continue

        inc_records = []
        for e in edges:
            if e["target"] == nid:
                s_node = node_map[e["source"]]
                s_props = s_node.get("properties", {})
                e_props = e.get("properties", {})
                inc_records.append({
                    "edge_type": e["type"].upper(),
                    "edge_status": e.get("test_status", "Untested"),
                    "src_status": s_node.get("test_status", "Untested"),
                    "src_is_global": str(s_props.get("is_global", "")).lower() == "true",
                    "is_badge_attachment": str(e_props.get("is_badge_attachment", "")).lower() == "true",
                })
        synthesized = compute_synthesized_status(
            n.get("test_status", "Untested"),
            inc_records,
            checklist=props.get("checklist", []),
            is_global=is_node_global,
        )
        assert synthesized == n.get("test_status"), (
            f"Status mismatch for {nid}: preset has {n.get('test_status')}, synthesized is {synthesized}"
        )


def test_list_presets_orders_featured_first_and_autobackups_last():
    """list_presets()는 추천 프리셋(honkai_starrail_full_qa)을 최상단에, _autobackup_ 항목을 하단에 배치해야 합니다."""
    items = list_presets()
    assert len(items) >= 4
    assert items[0]["id"] == "honkai_starrail_full_qa"
    assert items[0]["node_count"] == 40
    assert items[0]["edge_count"] == 300

    seen_backup = False
    for item in items:
        is_backup = item["id"].startswith(AUTOBACKUP_PREFIX)
        if is_backup:
            seen_backup = True
        else:
            assert not seen_backup, f"Regular preset {item['id']} appeared after auto-backup preset"


def test_load_honkai_starrail_full_qa_preset_with_mock_tx():
    """load_preset_to_neo4j가 40개 노드와 300개 엣지를 단일 트랜잭션(UNWIND 배치 포함)으로 정상 적재해야 합니다."""
    mock_session = Mock()
    mock_tx = Mock()
    mock_session.begin_transaction.return_value = mock_tx

    call_counter = {"n": 0}

    def side_effect_run(query, **kwargs):
        res = Mock()
        if "CREATE (n:" in query:
            call_counter["n"] += 1
            res.single.return_value = {"elem_id": f"elem_{call_counter['n']}"}
        elif "UNWIND $batch" in query:
            batch = kwargs.get("batch", [])
            res.single.return_value = {"cnt": len(batch)}
        else:
            res.single.return_value = None
        return res

    mock_tx.run.side_effect = side_effect_run

    result = load_preset_to_neo4j(mock_session, "honkai_starrail_full_qa", clean=True)
    assert result["status"] == "success"
    assert result["nodes_created"] == 40
    assert result["edges_created"] == 300
    assert result["clean_mode"] is True
    mock_tx.commit.assert_called_once()


def test_load_preset_merge_mode_uses_idempotent_merge():
    """clean=False(병합 모드) 호출 시 DETACH DELETE 없이 MERGE 쿼리를 사용하여 중복 생성을 방지해야 합니다."""
    mock_session = Mock()
    mock_tx = Mock()
    mock_session.begin_transaction.return_value = mock_tx

    executed_queries = []
    call_counter = {"n": 0}

    def side_effect_run(query, **kwargs):
        executed_queries.append(query)
        res = Mock()
        if "MERGE (n {id: $id})" in query:
            call_counter["n"] += 1
            res.single.return_value = {"elem_id": f"elem_{call_counter['n']}"}
        elif "UNWIND $batch" in query and "MERGE (s)-[r:" in query:
            batch = kwargs.get("batch", [])
            res.single.return_value = {"cnt": len(batch)}
        else:
            res.single.return_value = None
        return res

    mock_tx.run.side_effect = side_effect_run

    result = load_preset_to_neo4j(mock_session, "honkai_starrail_full_qa", clean=False)
    assert result["status"] == "success"
    assert result["nodes_created"] == 40
    assert result["edges_created"] == 300
    assert result["clean_mode"] is False
    assert not any("DETACH DELETE" in q for q in executed_queries)
    assert all("CREATE (n:" not in q for q in executed_queries)
    mock_tx.commit.assert_called_once()


def test_save_current_graph_as_preset_preserves_semantic_ids(monkeypatch, tmp_path):
    """save_current_graph_as_preset이 Neo4j elementId 대신 원래의 semantic_id를 보존하여 내보내야 합니다."""
    import networkx as nx
    import preset_service
    from models import NodeModel, EdgeModel

    monkeypatch.setattr(preset_service, "PRESETS_DIR", tmp_path)

    g = nx.MultiDiGraph()
    n1 = NodeModel(id="4:uuid:101", label="Screen", name="타이틀 화면", test_status="Passed", properties={})
    n2 = NodeModel(id="4:uuid:102", label="Popup", name="로그인 팝업", test_status="Passed", properties={})
    g.add_node(n1.id, data=n1, semantic_id="Screen_Title_Express")
    g.add_node(n2.id, data=n2, semantic_id="Popup_Common_Login")
    e1 = EdgeModel(
        id="5:uuid:201",
        source=n1.id,
        target=n2.id,
        type="Transition",
        action="타이틀 클릭",
        test_status="Passed",
        properties={},
    )
    g.add_edge(n1.id, n2.id, key=e1.id, data=e1)

    monkeypatch.setattr(preset_service, "fetch_graph_from_neo4j", lambda session: g)

    saved = preset_service.save_current_graph_as_preset(
        session=Mock(),
        preset_id="exported_test_preset",
        name="Exported Test",
        description="Semantic ID 보존 검증",
    )
    assert saved["preset_id"] == "exported_test_preset"
    exported = preset_service.get_preset("exported_test_preset")
    assert [n["id"] for n in exported["nodes"]] == ["Screen_Title_Express", "Popup_Common_Login"]
    assert exported["edges"][0]["source"] == "Screen_Title_Express"
    assert exported["edges"][0]["target"] == "Popup_Common_Login"


