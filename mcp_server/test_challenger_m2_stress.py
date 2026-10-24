"""
Milestone 2 Challenger Empirical Stress Test Suite for MCP Server.
Adversarially tests:
1. ConnectError resilience across all 16 MCP tools
2. TimeoutException resilience across all 16 MCP tools
3. HTTP 400 Bad Request, 404, 500 error reporting and detail extraction
4. URL encoding for #Popup and special characters (#, /, :, ?, &, +, Korean) across all query/path tools
5. Checklist normalization edge cases (empty strings, invalid status, checked mapping, id collisions)
6. Invalid inputs (create_path with <2 nodes, invalid target_type)
7. Malformed backend payload handling (non-dict/non-list)
"""

import asyncio
from unittest.mock import patch, MagicMock
import httpx
import server

ALL_TOOLS = [
    ("list_nodes", {}),
    ("create_node", {"label": "Screen", "name": "Login"}),
    ("create_edge", {"source": "n1", "target": "n2"}),
    ("create_path", {"node_ids": ["n1", "n2"]}),
    ("mark_status", {"target_type": "node", "target_id": "n1", "status": "Passed"}),
    ("ask_test_status", {"query": "Login"}),
    ("get_impact_scope", {"query": "Login"}),
    ("audit_cross_cutting", {"aspect": "i18n"}),
    ("get_next_test_targets", {}),
    ("delete_node", {"node_id": "n1"}),
    ("delete_edge", {"edge_id": "e1"}),
    ("find_node", {"name": "Login"}),
    ("get_node_details", {"query": "n1"}),
    ("get_coverage", {}),
    ("mark_node_modified", {"node_id": "n1"}),
    ("acknowledge_node", {"node_id": "n1"}),
]

MUTATING_TOOLS = [
    ("create_node", {"label": "Screen", "name": "Login"}),
    ("create_edge", {"source": "n1", "target": "n2"}),
    ("create_path", {"node_ids": ["n1", "n2"]}),
    ("mark_status", {"target_type": "node", "target_id": "n1", "status": "Passed"}),
    ("delete_node", {"node_id": "n1"}),
    ("delete_edge", {"edge_id": "e1"}),
    ("mark_node_modified", {"node_id": "n1"}),
    ("acknowledge_node", {"node_id": "n1"}),
]

SUCCESS_KEYWORDS = [
    "생성 완료",
    "삭제 완료",
    "처리 완료",
    "검증 완료",
    "스펙 변경(Modified) 마킹 완료",
    "변경 확인 완료(Acknowledged)",
]


def test_all_16_tools_connect_error():
    """All 16 MCP tools must handle httpx.ConnectError without unhandled exceptions or false success."""
    with patch("httpx.Client.get", side_effect=httpx.ConnectError("Connection refused")), \
         patch("httpx.Client.post", side_effect=httpx.ConnectError("Connection refused")), \
         patch("httpx.Client.put", side_effect=httpx.ConnectError("Connection refused")), \
         patch("httpx.Client.delete", side_effect=httpx.ConnectError("Connection refused")):
        
        for tool_name, args in ALL_TOOLS:
            res = asyncio.run(server.call_tool(tool_name, args))
            assert len(res) == 1, f"Tool {tool_name} returned invalid response length: {len(res)}"
            text = res[0].text
            assert "Error" in text, f"Tool {tool_name} failed to include 'Error' on ConnectError: {text}"
            assert "Failed to connect" in text, f"Tool {tool_name} failed to include 'Failed to connect': {text}"
            for kw in SUCCESS_KEYWORDS:
                assert kw not in text, f"Tool {tool_name} falsely reported success '{kw}' during ConnectError: {text}"


def test_all_16_tools_timeout():
    """All 16 MCP tools must handle httpx.TimeoutException without unhandled exceptions or false success."""
    with patch("httpx.Client.get", side_effect=httpx.ReadTimeout("Read timed out")), \
         patch("httpx.Client.post", side_effect=httpx.ReadTimeout("Read timed out")), \
         patch("httpx.Client.put", side_effect=httpx.ReadTimeout("Read timed out")), \
         patch("httpx.Client.delete", side_effect=httpx.ReadTimeout("Read timed out")):
        
        for tool_name, args in ALL_TOOLS:
            res = asyncio.run(server.call_tool(tool_name, args))
            assert len(res) == 1, f"Tool {tool_name} returned invalid response length: {len(res)}"
            text = res[0].text
            assert "Error" in text, f"Tool {tool_name} failed to include 'Error' on Timeout: {text}"
            assert "Request timed out" in text, f"Tool {tool_name} failed to include 'Request timed out': {text}"
            for kw in SUCCESS_KEYWORDS:
                assert kw not in text, f"Tool {tool_name} falsely reported success '{kw}' during Timeout: {text}"


def test_http_400_bad_request_formats():
    """Verify HTTP 400, 404, 500 responses with diverse error payloads."""
    # 1. Simple dict detail
    mock_400_simple = MagicMock()
    mock_400_simple.status_code = 400
    mock_400_simple.text = '{"detail": "Cycle detected: A -> B -> A"}'
    mock_400_simple.json.return_value = {"detail": "Cycle detected: A -> B -> A"}

    with patch("httpx.Client.post", return_value=mock_400_simple):
        res = server._api("POST", "/api/edges", {"source": "A", "target": "B"})
        assert server._is_error(res)
        assert "Error 400: Cycle detected: A -> B -> A" in res

    # 2. Pydantic validation error list
    pydantic_detail = [{"loc": ["body", "label"], "msg": "field required", "type": "value_error.missing"}]
    mock_422 = MagicMock()
    mock_422.status_code = 422
    mock_422.text = str(pydantic_detail)
    mock_422.json.return_value = {"detail": pydantic_detail}

    with patch("httpx.Client.post", return_value=mock_422):
        res = server._api("POST", "/api/nodes", {})
        assert server._is_error(res)
        assert "Error 422:" in res
        assert "field required" in res

    # 3. Plain text error (non-JSON)
    mock_502 = MagicMock()
    mock_502.status_code = 502
    mock_502.text = "Bad Gateway"
    mock_502.json.side_effect = ValueError("Not JSON")

    with patch("httpx.Client.get", return_value=mock_502):
        res = server._api("GET", "/api/graph")
        assert server._is_error(res)
        assert "Error 502: Bad Gateway" in res


def test_mutating_tools_http_400_rejection():
    """All mutating tools must NOT report success when backend returns HTTP 400."""
    mock_400 = MagicMock()
    mock_400.status_code = 400
    mock_400.text = '{"detail": "Adversarial rejection"}'
    mock_400.json.return_value = {"detail": "Adversarial rejection"}

    with patch("httpx.Client.post", return_value=mock_400), \
         patch("httpx.Client.put", return_value=mock_400), \
         patch("httpx.Client.delete", return_value=mock_400), \
         patch("httpx.Client.get", return_value=mock_400):
        
        for tool_name, args in MUTATING_TOOLS:
            res = asyncio.run(server.call_tool(tool_name, args))
            text = res[0].text
            assert "Error 400: Adversarial rejection" in text, f"Tool {tool_name} failed to return error detail: {text}"
            for kw in SUCCESS_KEYWORDS:
                assert kw not in text, f"Tool {tool_name} falsely reported success on 400: {text}"


def test_url_encoding_adversarial_special_chars():
    """Verify safe URL encoding for #Popup, slashes, colons, ampersands, spaces, and Korean."""
    recorded_urls = []

    def fake_get(url):
        recorded_urls.append(("GET", url))
        mock = MagicMock()
        mock.status_code = 200
        mock.json.return_value = {}
        return mock

    def fake_post(url, json=None):
        recorded_urls.append(("POST", url))
        mock = MagicMock()
        mock.status_code = 200
        mock.json.return_value = "new_id"
        return mock

    def fake_put(url, json=None):
        recorded_urls.append(("PUT", url))
        mock = MagicMock()
        mock.status_code = 200
        mock.json.return_value = "updated"
        return mock

    def fake_delete(url):
        recorded_urls.append(("DELETE", url))
        mock = MagicMock()
        mock.status_code = 200
        mock.json.return_value = "deleted"
        return mock

    with patch("httpx.Client.get", side_effect=fake_get), \
         patch("httpx.Client.post", side_effect=fake_post), \
         patch("httpx.Client.put", side_effect=fake_put), \
         patch("httpx.Client.delete", side_effect=fake_delete):

        # 1. list_nodes with #Popup & complex filter
        asyncio.run(server.call_tool("list_nodes", {"filter": "#Popup & Modal/v1"}))
        assert ("GET", f"{server.BASE_URL}/api/graph?filter=%23Popup%20%26%20Modal%2Fv1") in recorded_urls

        # 2. ask_test_status with Korean and #Popup
        asyncio.run(server.call_tool("ask_test_status", {"query": "#Popup 팝업 화면:1"}))
        assert ("GET", f"{server.BASE_URL}/api/qa/status-summary?q=%23Popup%20%ED%8C%9D%EC%97%85%20%ED%99%94%EB%A9%B4%3A1") in recorded_urls

        # 3. get_impact_scope with slashes and hashes
        asyncio.run(server.call_tool("get_impact_scope", {"query": "Feature#1/Sub:A"}))
        assert ("GET", f"{server.BASE_URL}/api/qa/impact-scope?q=Feature%231%2FSub%3AA") in recorded_urls

        # 4. audit_cross_cutting with Korean aspect and scope_root_id
        asyncio.run(server.call_tool("audit_cross_cutting", {"aspect": "#다국어/i18n", "scope_root_id": "Screen#1/A"}))
        assert ("GET", f"{server.BASE_URL}/api/qa/audit-cross-cutting?aspect=%23%EB%8B%A4%EA%B5%AD%EC%96%B4%2Fi18n&scope_root_id=Screen%231%2FA") in recorded_urls

        # 5. delete_node with special chars in ID
        asyncio.run(server.call_tool("delete_node", {"node_id": "node#1/with:slash?query=1&b=2"}))
        assert ("DELETE", f"{server.BASE_URL}/api/nodes/node%231%2Fwith%3Aslash%3Fquery%3D1%26b%3D2") in recorded_urls

        # 6. delete_edge with special chars in ID
        asyncio.run(server.call_tool("delete_edge", {"edge_id": "edge#1/with:slash?query=1&b=2"}))
        assert ("DELETE", f"{server.BASE_URL}/api/edges/edge%231%2Fwith%3Aslash%3Fquery%3D1%26b%3D2") in recorded_urls

        # 7. get_node_details with special chars in query
        asyncio.run(server.call_tool("get_node_details", {"query": "node#1/with:slash"}))
        assert ("GET", f"{server.BASE_URL}/api/nodes/node%231%2Fwith%3Aslash/details") in recorded_urls

        # 8. mark_node_modified with special chars in ID
        asyncio.run(server.call_tool("mark_node_modified", {"node_id": "node#1/with:slash"}))
        assert ("POST", f"{server.BASE_URL}/api/nodes/node%231%2Fwith%3Aslash/mark-modified") in recorded_urls

        # 9. acknowledge_node with special chars in ID
        asyncio.run(server.call_tool("acknowledge_node", {"node_id": "node#1/with:slash"}))
        assert ("POST", f"{server.BASE_URL}/api/nodes/node%231%2Fwith%3Aslash/acknowledge") in recorded_urls

        # 10. mark_status (node & edge) with special chars in ID
        asyncio.run(server.call_tool("mark_status", {"target_type": "node", "target_id": "node#1/with:slash", "status": "Passed"}))
        assert ("PUT", f"{server.BASE_URL}/api/nodes/node%231%2Fwith%3Aslash") in recorded_urls
        asyncio.run(server.call_tool("mark_status", {"target_type": "edge", "target_id": "edge#1/with:slash", "status": "Passed"}))
        assert ("PUT", f"{server.BASE_URL}/api/edges/edge%231%2Fwith%3Aslash") in recorded_urls


def test_checklist_normalization_edge_cases():
    """Verify _normalize_checklist edge cases and synthesis."""
    # 1. Blank and whitespace strings stripped
    norm = server._normalize_checklist(["", "   ", "Valid Item"])
    assert len(norm) == 1
    assert norm[0]["text"] == "Valid Item"
    assert norm[0]["status"] == "Untested"

    # 2. Dicts with empty text stripped
    norm2 = server._normalize_checklist([{"text": ""}, {"text": "   "}, {"text": "Check A", "checked": True}])
    assert len(norm2) == 1
    assert norm2[0]["text"] == "Check A"
    assert norm2[0]["status"] == "Passed"

    # 3. ID collision auto-renumbering
    norm3 = server._normalize_checklist([
        {"id": "c1", "text": "First"},
        {"id": "c1", "text": "Second"},
        {"id": "c1", "text": "Third"}
    ])
    ids = [item["id"] for item in norm3]
    assert len(ids) == len(set(ids)), f"Duplicate IDs detected: {ids}"


def test_invalid_tool_inputs():
    """Verify tool parameter guards."""
    # 1. create_path with < 2 nodes
    res = asyncio.run(server.call_tool("create_path", {"node_ids": ["single_node"]}))
    assert "Error: 최소 2개의 노드 ID가 필요합니다" in res[0].text

    # 2. mark_status with invalid target_type
    res = asyncio.run(server.call_tool("mark_status", {"target_type": "screen", "target_id": "n1", "status": "Passed"}))
    assert "Error: 지원되지 않는 target_type입니다" in res[0].text

    # 3. unknown tool
    res = asyncio.run(server.call_tool("nonexistent_tool", {}))
    assert "Unknown tool: nonexistent_tool" in res[0].text


def test_malformed_backend_responses():
    """Verify tools handle unexpected non-dict or non-list payloads gracefully."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = "unexpected string"

    with patch("httpx.Client.get", return_value=mock_resp):
        res1 = asyncio.run(server.call_tool("list_nodes", {}))
        assert "Error: 백엔드 응답 형식이 올바르지 않습니다" in res1[0].text

        res2 = asyncio.run(server.call_tool("ask_test_status", {"query": "test"}))
        assert "Error: 백엔드 응답 형식이 올바르지 않습니다" in res2[0].text

        res3 = asyncio.run(server.call_tool("get_coverage", {}))
        assert "Error: 백엔드 응답 형식이 올바르지 않습니다" in res3[0].text

        res4 = asyncio.run(server.call_tool("get_next_test_targets", {}))
        assert "Error: 백엔드 응답 형식이 올바르지 않습니다" in res4[0].text


if __name__ == "__main__":
    test_all_16_tools_connect_error()
    test_all_16_tools_timeout()
    test_http_400_bad_request_formats()
    test_mutating_tools_http_400_rejection()
    test_url_encoding_adversarial_special_chars()
    test_checklist_normalization_edge_cases()
    test_invalid_tool_inputs()
    test_malformed_backend_responses()
    print("All Challenger M2 empirical stress tests passed successfully!")
