import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
from main import app
from database import get_db

# Create a test client
client = TestClient(app)

def test_api_create_node():
    mock_session = Mock()
    mock_session.run.return_value.single.return_value = {"id": "n1"}
    
    app.dependency_overrides[get_db] = lambda: mock_session
    
    response = client.post("/api/nodes", json={
        "label": "TestNode",
        "name": "Testing",
        "aliases": ["test"],
        "properties": {"foo": "bar"}
    })
    
    assert response.status_code == 200
    assert response.json() == "n1"
    
    # Clean up override
    app.dependency_overrides.clear()

def test_api_update_node():
    mock_session = Mock()
    app.dependency_overrides[get_db] = lambda: mock_session
    
    response = client.put("/api/nodes/n1", json={
        "name": "Updated Testing",
        "test_status": "Passed"
    })
    
    assert response.status_code == 200
    assert response.json() == {"status": "success"}
    
    app.dependency_overrides.clear()

def test_api_delete_node():
    mock_session = Mock()
    app.dependency_overrides[get_db] = lambda: mock_session
    
    response = client.delete("/api/nodes/n1")
    
    assert response.status_code == 200
    assert response.json() == {"status": "success"}
    
    app.dependency_overrides.clear()

def test_api_create_edge():
    mock_session = Mock()
    mock_session.run.return_value.single.return_value = {"id": "e1"}
    app.dependency_overrides[get_db] = lambda: mock_session
    
    response = client.post("/api/edges", json={
        "source": "n1",
        "target": "n2",
        "type": "TESTS",
        "properties": {"foo": "bar"}
    })
    
    assert response.status_code == 200
    assert response.json() == "e1"
    
    app.dependency_overrides.clear()

def test_api_update_edge():
    mock_session = Mock()
    app.dependency_overrides[get_db] = lambda: mock_session
    
    response = client.put("/api/edges/e1", json={
        "test_status": "Failed"
    })
    
    assert response.status_code == 200
    assert response.json() == {"status": "success"}
    
    app.dependency_overrides.clear()

def test_api_delete_edge():
    mock_session = Mock()
    app.dependency_overrides[get_db] = lambda: mock_session
    
    response = client.delete("/api/edges/e1")
    
    assert response.status_code == 200
    assert response.json() == {"status": "success"}
    
    app.dependency_overrides.clear()
