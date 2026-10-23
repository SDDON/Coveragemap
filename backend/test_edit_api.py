import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock
from main import app
from database import get_db
from conftest import make_recalc_aware_session

# Create a test client
client = TestClient(app)

def test_api_create_node():
    mock_session = Mock()
    mock_check_result = Mock()
    mock_check_result.single.return_value = None  # No duplicate
    mock_create_result = Mock()
    mock_create_result.single.return_value = {"id": "n1"}
    mock_session.run.side_effect = [mock_check_result, mock_create_result]
    
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
    # 스펙 변경(TESTCASE_MODELING 5.2-1): test_status 갱신 후 하류 전파 조회 결과를 순회하므로 iterable Mock 세션 사용
    mock_session = make_recalc_aware_session(None)
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
    # Mock iteration for targets query
    mock_run_result = MagicMock()
    mock_run_result.__iter__.return_value = iter([])
    mock_session.run.return_value = mock_run_result
    
    app.dependency_overrides[get_db] = lambda: mock_session
    
    response = client.delete("/api/nodes/n1")
    
    assert response.status_code == 200
    assert response.json() == {"status": "success"}
    
    app.dependency_overrides.clear()

def test_api_create_edge():
    # 스펙 변경(d54aa5f): 엣지 CRUD 후 상태 재합성 쿼리가 실행되므로 재합성 레코드를 돌려주는 Mock 사용
    mock_session = make_recalc_aware_session({"id": "e1"})
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
    mock_session = make_recalc_aware_session({"new_id": "e1", "target_id": "n2"})
    
    app.dependency_overrides[get_db] = lambda: mock_session
    
    response = client.put("/api/edges/e1", json={
        "test_status": "Failed"
    })
    
    assert response.status_code == 200
    assert response.json() == {"status": "success", "new_id": "e1"}
    
    app.dependency_overrides.clear()

def test_api_delete_edge():
    mock_session = make_recalc_aware_session({"target_id": "n2"})
    
    app.dependency_overrides[get_db] = lambda: mock_session
    
    response = client.delete("/api/edges/e1")
    
    assert response.status_code == 200
    assert response.json() == {"status": "success"}
    
    app.dependency_overrides.clear()

def test_api_node_statuses():
    # 프론트 낙관적 상태 계산 후 서버 SSOT와 재동기화하는 경량 엔드포인트 (/api/node-statuses)
    # test_status가 없는 노드는 coalesce로 'Untested'가 반환되어야 함 (Cypher에서 처리 → 여기선 그대로 매핑만 확인)
    mock_session = Mock()
    mock_session.run.return_value = iter([
        {"id": "n1", "test_status": "Passed"},
        {"id": "n2", "test_status": "Blocked"},
        {"id": "n3", "test_status": "Untested"},
    ])
    app.dependency_overrides[get_db] = lambda: mock_session

    response = client.get("/api/node-statuses")

    assert response.status_code == 200
    assert response.json() == {"n1": "Passed", "n2": "Blocked", "n3": "Untested"}
    # 상태 조회 쿼리는 1회만 실행 (전체 그래프 조회/레이아웃 재계산 없음)
    assert mock_session.run.call_count == 1
    assert "coalesce(n.test_status, 'Untested')" in mock_session.run.call_args[0][0]

    app.dependency_overrides.clear()


def test_api_get_node_and_globals_include_label_and_test_status():
    mock_session = Mock()
    mock_node_res = Mock()
    mock_node_dict = {
        "id": "4:abc:77",
        "type": "Component",
        "label": "Component",
        "name": "Global_Lang",
        "aliases": ["i18n"],
        "test_status": "Passed",
        "properties": {"is_global": "true"},
    }
    mock_single = Mock()
    mock_single.data.return_value = dict(mock_node_dict)
    mock_node_res.single.return_value = mock_single

    mock_globals_res = Mock()
    mock_globals_res.data.return_value = [dict(mock_node_dict)]

    mock_session.run.side_effect = [mock_node_res, mock_globals_res]
    app.dependency_overrides[get_db] = lambda: mock_session

    res_node = client.get("/api/nodes/4:abc:77")
    assert res_node.status_code == 200
    body_node = res_node.json()
    assert body_node["label"] == "Component"
    assert body_node["test_status"] == "Passed"
    assert body_node["properties"]["is_global"] == "true"

    res_globals = client.get("/api/globals")
    assert res_globals.status_code == 200
    body_globals = res_globals.json()
    assert len(body_globals) == 1
    assert body_globals[0]["label"] == "Component"
    assert body_globals[0]["test_status"] == "Passed"

    app.dependency_overrides.clear()

