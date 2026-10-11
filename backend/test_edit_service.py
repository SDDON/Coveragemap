import pytest
from unittest.mock import Mock, patch, MagicMock
from graph_service import create_node, update_node, delete_node, create_edge, update_edge, delete_edge
from models import NodeCreate, NodeUpdate, EdgeCreate, EdgeUpdate
from pydantic import ValidationError
from conftest import make_recalc_aware_session

def test_create_node():
    mock_session = Mock()
    mock_check_result = Mock()
    mock_check_result.single.return_value = None  # No duplicate
    mock_create_result = Mock()
    mock_create_result.single.return_value = {"id": "mock_node_id"}
    mock_session.run.side_effect = [mock_check_result, mock_create_result]

    node_data = NodeCreate(
        label="Component",
        name="Backend",
        aliases=["api"],
        properties={"status": "active"},
        test_status="Passed"
    )

    node_id = create_node(mock_session, node_data)
    
    assert node_id == "mock_node_id"
    assert mock_session.run.call_count == 2
    called_query = mock_session.run.call_args_list[1][0][0]
    assert "CREATE (n:`Component`)" in called_query
    
    called_kwargs = mock_session.run.call_args_list[1][1]
    assert called_kwargs["name"] == "Backend"
    assert called_kwargs["aliases"] == ["api"]
    assert called_kwargs["test_status"] == "Passed"
    assert called_kwargs["properties"] == {"status": "active"}

def test_update_node():
    # 스펙 변경(TESTCASE_MODELING 5.2-1): test_status가 바뀌면 하류 Depends_On/Tests 노드로 연쇄 전파 조회가 이어집니다.
    # (하류 조회는 빈 결과를 돌려주는 Mock 세션 사용 → 호출 수 = SET 1 + 하류 조회 1)
    mock_session = make_recalc_aware_session(None)
    
    node_data = NodeUpdate(
        name="New Backend",
        test_status="Failed"
    )
    
    update_node(mock_session, "mock_node_id", node_data)
    
    assert mock_session.run.call_count == 2
    called_query = mock_session.run.call_args_list[0][0][0]
    assert "MATCH (n) WHERE elementId(n) = $id" in called_query
    assert "SET n.name = $name, n.test_status = $test_status" in called_query
    
    called_kwargs = mock_session.run.call_args_list[0][1]
    assert called_kwargs["id"] == "mock_node_id"
    assert called_kwargs["name"] == "New Backend"
    assert called_kwargs["test_status"] == "Failed"

    # 하류 전파 조회는 상태 의존 엣지(DEPENDS_ON/TESTS)만 대상으로 합니다. (Return/흐름 엣지 제외)
    downstream_query = mock_session.run.call_args_list[1][0][0]
    assert "toUpper(type(r)) IN $dep_types" in downstream_query
    assert mock_session.run.call_args_list[1][1]["dep_types"] == ["DEPENDS_ON", "TESTS"]

def test_update_node_without_status_does_not_propagate():
    # 이름만 바꾸는 편집은 상태에 영향이 없으므로 하류 전파 조회를 하지 않습니다.
    mock_session = make_recalc_aware_session(None)
    update_node(mock_session, "mock_node_id", NodeUpdate(name="Only Rename"))
    assert mock_session.run.call_count == 1

def test_delete_node():
    mock_session = Mock()
    mock_check_global = Mock()
    mock_check_global.single.return_value = {"is_global": "false", "rel_count": 0}
    mock_targets_result = MagicMock()
    mock_targets_result.__iter__.return_value = iter([])
    mock_delete_result = Mock()
    mock_session.run.side_effect = [mock_check_global, mock_targets_result, mock_delete_result]
    
    delete_node(mock_session, "mock_node_id")
    
    # Called 3 times: check global, find targets, DETACH DELETE
    assert mock_session.run.call_count == 3
    called_queries = [args[0][0] for args in mock_session.run.call_args_list]
    assert any("MATCH (n)-[r]->(target)" in q for q in called_queries)
    assert any("DETACH DELETE n" in q for q in called_queries)

def test_create_edge():
    # ?ㅽ럺 蹂寃?d54aa5f): ?ｌ? ?앹꽦 ??????몃뱶 ?곹깭 ?ы빀??荑쇰━媛 ?ㅽ뻾?섎?濡? ?ы빀???덉퐫?쒕? ?뚮젮二쇰뒗 Mock ?ъ슜
    mock_session = make_recalc_aware_session({"id": "mock_edge_id"})

    edge_data = EdgeCreate(
        source="node1",
        target="node2",
        type="DEPENDS_ON",
        properties={"weight": 1},
        test_status="Untested"
    )
    
    edge_id = create_edge(mock_session, edge_data)
    
    assert edge_id == "mock_edge_id"
    # Called twice: once to create edge, once to recalc status
    assert mock_session.run.call_count == 2
    called_queries = [args[0][0] for args in mock_session.run.call_args_list]
    assert any("CREATE (source)-[r:`DEPENDS_ON`]->(target)" in q for q in called_queries)
    assert any("OPTIONAL MATCH (src)-[in_r]->(target)" in q for q in called_queries)

def test_update_edge():
    mock_session = make_recalc_aware_session({"new_id": "mock_edge_id", "target_id": "node2"})
    
    edge_data = EdgeUpdate(
        test_status="Passed",
        properties={"weight": 2}
    )
    
    new_id = update_edge(mock_session, "mock_edge_id", edge_data)
    assert new_id == "mock_edge_id"
    # Called twice: once to update edge, once to recalc status
    assert mock_session.run.call_count == 2
    called_queries = [args[0][0] for args in mock_session.run.call_args_list]
    assert any("MATCH ()-[r]->(target) WHERE elementId(r) = $id" in q for q in called_queries)
    assert any("OPTIONAL MATCH (src)-[in_r]->(target)" in q for q in called_queries)

def test_delete_edge():
    mock_session = make_recalc_aware_session({"target_id": "node2"})
    
    delete_edge(mock_session, "mock_edge_id")
    
    # Called twice: once to delete edge, once to recalc status
    assert mock_session.run.call_count == 2
    called_queries = [args[0][0] for args in mock_session.run.call_args_list]
    assert any("DELETE r" in q for q in called_queries)
    assert any("OPTIONAL MATCH (src)-[in_r]->(target)" in q for q in called_queries)

def test_create_edge_rejects_injection_type():
    # Cypher ?몄젥??諛⑹?: 愿怨???낆? IDENTIFIER_PATTERN(?곷Ц/?쒓?/?レ옄/諛묒쨪)留??덉슜
    with pytest.raises(ValidationError):
        EdgeCreate(source="a", target="b", type="T`]->() DETACH DELETE (x")

def test_create_node_rejects_injection_label():
    with pytest.raises(ValidationError):
        NodeCreate(label="X`) DETACH DELETE (m", name="n")

