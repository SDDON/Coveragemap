"""
Tests for MCP server resiliency and URL encoding.
Verifies that connection errors, timeouts, HTTP 4xx/5xx errors,
and URL encoding are properly handled across all MCP tools.
"""

import asyncio
from unittest.mock import patch, MagicMock
import httpx
import server


def test_api_connect_error():
    """httpx.ConnectError is caught and returns descriptive error string."""
    with patch("httpx.Client.get", side_effect=httpx.ConnectError("Connection refused")):
        res = server._api("GET", "/api/graph")
        assert server._is_error(res)
        assert "Failed to connect to backend server" in res
        assert "Connection refused" in res


def test_api_timeout_error():
    """httpx.TimeoutException is caught and returns descriptive error string."""
    with patch("httpx.Client.get", side_effect=httpx.ReadTimeout("timed out")):
        res = server._api("GET", "/api/graph")
        assert server._is_error(res)
        assert "Request timed out" in res


def test_api_http_400_error_detail():
    """HTTP 400 extracts JSON detail if present."""
    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = '{"detail": "Dependency cycle detected"}'
    mock_resp.json.return_value = {"detail": "Dependency cycle detected"}

    with patch("httpx.Client.post", return_value=mock_resp):
        res = server._api("POST", "/api/edges", {"source": "a", "target": "b"})
        assert server._is_error(res)
        assert "Error 400: Dependency cycle detected" in res


def test_tools_connection_failure():
    """When backend is unreachable, tool handlers return error messages without '완료'."""
    error_msg = "Error: Failed to connect to backend server at http://localhost:8190: Connection refused"
    with patch("server._api", return_value=error_msg):
        # 1. create_node
        res = asyncio.run(server.call_tool("create_node", {"label": "Screen", "name": "Login"}))
        assert "완료" not in res[0].text
        assert "Failed to connect" in res[0].text

        # 2. create_edge
        res = asyncio.run(server.call_tool("create_edge", {"source": "n1", "target": "n2"}))
        assert "완료" not in res[0].text
        assert "Failed to connect" in res[0].text

        # 3. create_path
        res = asyncio.run(server.call_tool("create_path", {"node_ids": ["n1", "n2"]}))
        assert "완료" not in res[0].text
        assert "Failed to connect" in res[0].text

        # 4. mark_status
        res = asyncio.run(server.call_tool("mark_status", {"target_type": "node", "target_id": "n1", "status": "Passed"}))
        assert "완료" not in res[0].text
        assert "Failed to connect" in res[0].text

        # 5. delete_node
        res = asyncio.run(server.call_tool("delete_node", {"node_id": "n1"}))
        assert "완료" not in res[0].text
        assert "Failed to connect" in res[0].text

        # 6. delete_edge
        res = asyncio.run(server.call_tool("delete_edge", {"edge_id": "e1"}))
        assert "완료" not in res[0].text
        assert "Failed to connect" in res[0].text


def test_create_edge_cycle_error():
    """Dependency cycle HTTP 400 error does not report success."""
    with patch("server._api", return_value="Error 400: Dependency cycle detected"):
        res = asyncio.run(server.call_tool("create_edge", {"source": "A", "target": "B", "type": "Depends_On"}))
        assert "엣지 생성 완료" not in res[0].text
        assert "Error 400: Dependency cycle detected" in res[0].text


def test_create_path_partial_cycle_failure():
    """create_path detects edge failure and stops, returning failure indicators."""
    def fake_api(method, path, body=None):
        if method == "GET" and path == "/api/graph":
            return {"nodes": [{"id": "A", "name": "Screen A"}, {"id": "B", "name": "Screen B"}, {"id": "C", "name": "Screen C"}]}
        if method == "POST" and path == "/api/edges":
            if body["target"] == "C":
                return "Error 400: Dependency cycle detected"
            return "edge_1"
        return "ok"

    with patch("server._api", side_effect=fake_api):
        res = asyncio.run(server.call_tool("create_path", {"node_ids": ["A", "B", "C"], "type": "Depends_On"}))
        assert "경로 생성 완료" not in res[0].text
        assert "Error: 경로 생성 중 오류 발생" in res[0].text
        assert "❌ Screen B ──Depends_On──▶ Screen C 실패" in res[0].text


def test_list_nodes_url_encoding():
    """filter='#Popup' is properly URL-encoded as %23Popup."""
    called_path = None
    def fake_api(method, path, body=None):
        nonlocal called_path
        called_path = path
        return {"nodes": [], "edges": []}

    with patch("server._api", side_effect=fake_api):
        asyncio.run(server.call_tool("list_nodes", {"filter": "#Popup"}))
        assert called_path == "/api/graph?filter=%23Popup"


def test_special_characters_url_encoding():
    """Path parameters with special characters are safely URL-encoded."""
    paths_called = []
    def fake_api(method, path, body=None):
        paths_called.append(path)
        return "deleted"

    with patch("server._api", side_effect=fake_api):
        asyncio.run(server.call_tool("delete_node", {"node_id": "test:node/with#slash"}))
        asyncio.run(server.call_tool("delete_edge", {"edge_id": "edge:1/2"}))
        assert "/api/nodes/test%3Anode%2Fwith%23slash" in paths_called
        assert "/api/edges/edge%3A1%2F2" in paths_called


if __name__ == "__main__":
    test_api_connect_error()
    test_api_timeout_error()
    test_api_http_400_error_detail()
    test_tools_connection_failure()
    test_create_edge_cycle_error()
    test_create_path_partial_cycle_failure()
    test_list_nodes_url_encoding()
    test_special_characters_url_encoding()
    print("All 8 MCP resiliency tests passed successfully!")
