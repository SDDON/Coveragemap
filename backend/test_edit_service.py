import pytest
from unittest.mock import Mock, patch
from graph_service import create_node, update_node, delete_node, create_edge, update_edge, delete_edge
from models import NodeCreate, NodeUpdate, EdgeCreate, EdgeUpdate

def test_create_node():
    mock_session = Mock()
    mock_result = Mock()
    mock_record = {"id": "mock_node_id"}
    mock_result.single.return_value = mock_record
    mock_session.run.return_value = mock_result

    node_data = NodeCreate(
        label="Component",
        name="Backend",
        aliases=["api"],
        properties={"status": "active"},
        test_status="Passed"
    )

    node_id = create_node(mock_session, node_data)
    
    assert node_id == "mock_node_id"
    mock_session.run.assert_called_once()
    called_query = mock_session.run.call_args[0][0]
    assert "CREATE (n:`Component`)" in called_query
    
    called_kwargs = mock_session.run.call_args[1]
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
    
    delete_node(mock_session, "mock_node_id")
    
    mock_session.run.assert_called_once()
    called_query = mock_session.run.call_args[0][0]
    assert "DETACH DELETE n" in called_query
    assert mock_session.run.call_args[1]["id"] == "mock_node_id"

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
    mock_session.run.assert_called_once()
    called_query = mock_session.run.call_args[0][0]
    assert "MATCH (source), (target)" in called_query
    assert "CREATE (source)-[r:`DEPENDS_ON`]->(target)" in called_query
    
    called_kwargs = mock_session.run.call_args[1]
    assert called_kwargs["source_id"] == "node1"
    assert called_kwargs["target_id"] == "node2"
    assert called_kwargs["test_status"] == "Untested"
    assert called_kwargs["properties"] == {"weight": 1}

def test_update_edge():
    mock_session = Mock()
    
    edge_data = EdgeUpdate(
        test_status="Passed",
        properties={"weight": 2}
    )
    
    update_edge(mock_session, "mock_edge_id", edge_data)
    
    mock_session.run.assert_called_once()
    called_query = mock_session.run.call_args[0][0]
    assert "MATCH ()-[r]->() WHERE elementId(r) = $id" in called_query
    assert "SET r.test_status = $test_status, r += $properties" in called_query
    
    called_kwargs = mock_session.run.call_args[1]
    assert called_kwargs["id"] == "mock_edge_id"
    assert called_kwargs["test_status"] == "Passed"
    assert called_kwargs["properties"] == {"weight": 2}

def test_delete_edge():
    mock_session = Mock()
    
    delete_edge(mock_session, "mock_edge_id")
    
    mock_session.run.assert_called_once()
    called_query = mock_session.run.call_args[0][0]
    assert "DELETE r" in called_query
    assert mock_session.run.call_args[1]["id"] == "mock_edge_id"
