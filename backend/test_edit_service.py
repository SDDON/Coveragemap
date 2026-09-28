import pytest
from unittest.mock import Mock, patch, MagicMock
from graph_service import create_node, update_node, delete_node, create_edge, update_edge, delete_edge
from models import NodeCreate, NodeUpdate, EdgeCreate, EdgeUpdate

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
    mock_session = Mock()
    
    node_data = NodeUpdate(
        name="New Backend",
        test_status="Failed"
    )
    
    update_node(mock_session, "mock_node_id", node_data)
    
    mock_session.run.assert_called_once()
    called_query = mock_session.run.call_args[0][0]
    assert "MATCH (n) WHERE elementId(n) = $id" in called_query
    assert "SET n.name = $name, n.test_status = $test_status" in called_query
    
    called_kwargs = mock_session.run.call_args[1]
    assert called_kwargs["id"] == "mock_node_id"
    assert called_kwargs["name"] == "New Backend"
    assert called_kwargs["test_status"] == "Failed"

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
    mock_session = Mock()
    mock_result = Mock()
    mock_record = {"id": "mock_edge_id"}
    mock_result.single.return_value = mock_record
    mock_session.run.return_value = mock_result

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
    assert any("OPTIONAL MATCH ()-[in_r]->(target)" in q for q in called_queries)

def test_update_edge():
    mock_session = Mock()
    mock_result = MagicMock()
    mock_result.single.return_value = {"new_id": "mock_edge_id", "target_id": "node2"}
    mock_session.run.return_value = mock_result
    
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
    assert any("OPTIONAL MATCH ()-[in_r]->(target)" in q for q in called_queries)

def test_delete_edge():
    mock_session = Mock()
    mock_result = MagicMock()
    mock_result.single.return_value = {"target_id": "node2"}
    mock_session.run.return_value = mock_result
    
    delete_edge(mock_session, "mock_edge_id")
    
    # Called twice: once to delete edge, once to recalc status
    assert mock_session.run.call_count == 2
    called_queries = [args[0][0] for args in mock_session.run.call_args_list]
    assert any("DELETE r" in q for q in called_queries)
    assert any("OPTIONAL MATCH ()-[in_r]->(target)" in q for q in called_queries)

