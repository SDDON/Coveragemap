import networkx as nx
from graph_service import process_graph

def test_process_graph_no_filter():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=[])
    G.add_node("2", name="Bob", label="Person", aliases=[])
    G.add_edge("1", "2", type="KNOWS")

    processed = process_graph(G)
    assert len(processed.nodes) == 2
    assert len(processed.edges) == 1

def test_process_graph_with_filter():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=[])
    G.add_node("2", name="Bob", label="Person", aliases=[])
    G.add_edge("1", "2", type="KNOWS")

    # Filter 'alice' should match node 1
    # max_depth=1 should include node 2 because it's connected to node 1
    processed = process_graph(G, filter_str="alice", max_depth=1)
    assert len(processed.nodes) == 2, f"Expected 2 nodes, got {len(processed.nodes)}"
    assert len(processed.edges) == 1, f"Expected 1 edge, got {len(processed.edges)}"

def test_process_graph_with_filter_no_depth():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=[])
    G.add_node("2", name="Bob", label="Person", aliases=[])
    G.add_node("3", name="Charlie", label="Person", aliases=[])
    G.add_edge("1", "2", type="KNOWS")
    G.add_edge("2", "3", type="KNOWS")

    # max_depth defaults to 1
    processed = process_graph(G, filter_str="alice", max_depth=None)
    assert len(processed.nodes) == 2, f"Expected 2 nodes, got {len(processed.nodes)}"
    assert "3" not in processed.nodes, "Node 3 should not be in the graph"

def test_process_graph_case_insensitive():
    G = nx.DiGraph()
    G.add_node("1", name="ALICE", label="Person", aliases=[])
    processed = process_graph(G, filter_str="alice")
    assert len(processed.nodes) == 1

def test_process_graph_alias_match():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=["Ally"])
    processed = process_graph(G, filter_str="ally")
    assert len(processed.nodes) == 1

def test_process_graph_label_match():
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="SuperPerson", aliases=[])
    processed = process_graph(G, filter_str="super")
    assert len(processed.nodes) == 1

def test_process_graph_ego_graph_undirected():
    # ego_graph with undirected=True means it considers both in and out edges
    G = nx.DiGraph()
    G.add_node("1", name="Alice", label="Person", aliases=[])
    G.add_node("2", name="Bob", label="Person", aliases=[])
    G.add_edge("2", "1", type="KNOWS") # In-edge to Alice

    processed = process_graph(G, filter_str="alice", max_depth=1)
    assert len(processed.nodes) == 2, f"Expected 2 nodes, got {len(processed.nodes)}"
    assert len(processed.edges) == 1, f"Expected 1 edge, got {len(processed.edges)}"

def test_normalize_string():
    from graph_service import _normalize_string
    assert _normalize_string("front-end") == "frontend"
    assert _normalize_string("FRONT-END") == "frontend"
    assert _normalize_string("database") == "database"
    assert _normalize_string("DB") == "database"
    assert _normalize_string("RELATED") == "Related"
    assert _normalize_string(123) == 123
    assert _normalize_string(None) is None

def test_alias_casing_preservation_and_normalization():
    """
    GAP-10: 사용자 정의 별칭의 원래 대소문자(iOS, PvP, gRPC)가 보존되고,
    사전식 동의어는 표준형으로 매핑되며 중복은 대소문자 무시로 제거되는지 검증합니다.
    """
    from graph_service import _normalize_aliases
    aliases = ["iOS", "PvP", "front-end", "DB", "ios", "gRPC", "  mcUI  "]
    normalized = _normalize_aliases(aliases)
    assert normalized == ["iOS", "PvP", "frontend", "database", "gRPC", "mcUI"]


def test_alias_delete_and_rename_case_insensitive():
    """
    GAP-10: delete_alias 및 rename_alias가 toLower를 사용해 대소문자 무관하게 매칭하는지 검증합니다.
    """
    from graph_service import delete_alias, rename_alias
    from unittest.mock import Mock

    mock_session = Mock()
    delete_alias(mock_session, "ios")
    delete_query = mock_session.run.call_args[0][0]
    assert "toLower" in delete_query

    rename_alias(mock_session, "ios", "iOS_Renamed")
    rename_query = mock_session.run.call_args[0][0]
    assert "toLower" in rename_query


def test_deterministic_bfs_root_cause_tracing_distinguishes_flow_and_dep():
    """
    GAP-9: Flow 엣지는 엣지 자체 상태로 판정하고, Dependency 엣지는 출발 노드로 판정하여
    결정론적 최단 결함 경로를 올바르게 찾아내는지 검증합니다.
    """
    from graph_service import find_root_cause_bfs
    from unittest.mock import MagicMock

    session = MagicMock()

    # 시나리오: ScreenA (Untested) --Transition(Passed)--> ScreenB (Untested) --Depends_On--> TC_Fail (Failed)
    # Target: ScreenB
    # ScreenB에 들어오는 엣지:
    # 1. Flow Transition from ScreenA (edge_status='Passed') -> 비인과적
    # 2. Depends_On from TC_Fail (src_status='Failed') -> 인과적 root cause!
    def mock_run(query, **kw):
        res = MagicMock()
        if kw.get("curr_id") == "screen_b":
            res.__iter__.return_value = iter([
                {
                    "src_id": "screen_a", "src_name": "ScreenA", "src_status": "Untested",
                    "edge_id": "e_trans", "edge_type": "TRANSITION", "edge_status": "Passed",
                    "edge_action": "화면 전환"
                },
                {
                    "src_id": "tc_fail", "src_name": "TC_Fail", "src_status": "Failed",
                    "edge_id": "e_dep", "edge_type": "DEPENDS_ON", "edge_status": "Untested",
                    "edge_action": None
                }
            ])
        elif kw.get("curr_id") == "tc_fail":
            res.__iter__.return_value = iter([])  # 더 이상 상류 원인 없음
        else:
            res.__iter__.return_value = iter([])
        return res

    session.run.side_effect = mock_run

    info = find_root_cause_bfs(session, "screen_b", "ScreenB")
    assert info is not None
    assert info.origin_node_id == "tc_fail"
    assert info.origin_node_name == "TC_Fail"
    assert info.path == ["TC_Fail", "ScreenB"]
    assert "TC_Fail" in info.reason


if __name__ == '__main__':
    test_process_graph_no_filter()
    test_process_graph_with_filter()
    test_process_graph_with_filter_no_depth()
    test_process_graph_case_insensitive()
    test_process_graph_alias_match()
    test_process_graph_label_match()
    test_process_graph_ego_graph_undirected()
    test_normalize_string()
    print("All tests passed.")
