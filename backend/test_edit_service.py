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

def test_get_node_full_details_parses_all_fields():
    from graph_service import get_node_full_details
    import json

    mock_session = Mock()
    mock_find_result = Mock()
    checklist_items = [
        {"id": "chk_1", "category": "Specs", "text": "Dimmed background click closes popup", "checked": True},
        {"id": "chk_2", "category": "Specs", "text": "ESC key closes popup", "checked": False},
    ]
    mock_find_result.single.return_value = {
        "id": "4:abc:101",
        "name": "RewardPopup",
        "label": "Modal",
        "aliases": ["보상 팝업", "RewardDialog"],
        "test_status": "Passed",
        "properties": {
            "name": "RewardPopup",
            "aliases": ["보상 팝업", "RewardDialog"],
            "test_status": "Passed",
            "is_global": "true",
            "is_modified": "false",
            "checklist": json.dumps(checklist_items),
            "tags": "#Popup, #Common",
        },
    }
    in_rows = [
        {
            "id": "5:abc:200",
            "type": "CONTAINS",
            "test_status": "Passed",
            "action": "Open Reward",
            "properties": {"test_status": "Passed", "action": "Open Reward"},
            "source_id": "4:abc:100",
            "source_name": "LobbyScreen",
            "source_label": "Screen",
            "source_status": "Passed",
        }
    ]
    out_rows = [
        {
            "id": "5:abc:201",
            "type": "CONTAINS",
            "test_status": "Passed",
            "action": None,
            "properties": {"test_status": "Passed"},
            "target_id": "4:abc:102",
            "target_name": "ClaimButton",
            "target_label": "UI_Element",
            "target_status": "Passed",
        },
        {
            "id": "5:abc:202",
            "type": "RETURN",
            "test_status": "Passed",
            "action": "Close Popup",
            "properties": {"test_status": "Passed", "action": "Close Popup"},
            "target_id": "4:abc:100",
            "target_name": "LobbyScreen",
            "target_label": "Screen",
            "target_status": "Passed",
        },
    ]
    mock_session.run.side_effect = [mock_find_result, in_rows, out_rows]

    details = get_node_full_details(mock_session, "보상 팝업")
    assert details is not None
    assert details["id"] == "4:abc:101"
    assert details["name"] == "RewardPopup"
    assert details["label"] == "Modal"
    assert details["aliases"] == ["보상 팝업", "RewardDialog"]
    assert details["test_status"] == "Passed"
    assert details["is_global"] is True
    assert details["is_modified"] is False
    assert details["checklist"] == checklist_items
    assert details["properties"]["tags"] == "#Popup, #Common"
    assert details["parent"] == {
        "id": "4:abc:100",
        "name": "LobbyScreen",
        "label": "Screen",
        "test_status": "Passed",
    }
    assert len(details["children"]) == 1
    assert details["children"][0]["name"] == "ClaimButton"
    assert len(details["incoming_edges"]) == 1
    assert details["incoming_edges"][0]["action"] == "Open Reward"
    assert len(details["outgoing_edges"]) == 2

def test_get_node_full_details_not_found_and_empty():
    from graph_service import get_node_full_details

    mock_session = Mock()
    assert get_node_full_details(mock_session, "   ") is None
    assert mock_session.run.call_count == 0

    mock_result = Mock()
    mock_result.single.return_value = None
    mock_session.run.return_value = mock_result
    assert get_node_full_details(mock_session, "NonExistentNode") is None
    assert mock_session.run.call_count == 1


def test_mcp_server_get_node_details_and_find_node():
    import asyncio
    import sys
    import types
    from pathlib import Path

    if "mcp" not in sys.modules:
        mcp_mod = types.ModuleType("mcp")
        mcp_server_mod = types.ModuleType("mcp.server")
        mcp_lowlevel_mod = types.ModuleType("mcp.server.lowlevel")
        mcp_stdio_mod = types.ModuleType("mcp.server.stdio")
        mcp_types_mod = types.ModuleType("mcp.types")

        class DummyServer:
            def __init__(self, name):
                self.name = name
            def list_tools(self):
                return lambda fn: fn
            def call_tool(self):
                return lambda fn: fn

        class DummyTool:
            def __init__(self, name, description, inputSchema):
                self.name = name
                self.description = description
                self.inputSchema = inputSchema

        class DummyTextContent:
            def __init__(self, type, text):
                self.type = type
                self.text = text

        mcp_lowlevel_mod.Server = DummyServer
        mcp_stdio_mod.stdio_server = None
        mcp_types_mod.Tool = DummyTool
        mcp_types_mod.TextContent = DummyTextContent
        sys.modules["mcp"] = mcp_mod
        sys.modules["mcp.server"] = mcp_server_mod
        sys.modules["mcp.server.lowlevel"] = mcp_lowlevel_mod
        sys.modules["mcp.server.stdio"] = mcp_stdio_mod
        sys.modules["mcp.types"] = mcp_types_mod

    mcp_dir = str(Path(__file__).resolve().parent.parent / "mcp_server")
    if mcp_dir not in sys.path:
        sys.path.insert(0, mcp_dir)
    import server as mcp_srv

    tools = asyncio.run(mcp_srv.list_tools())
    tool_names = [t.name for t in tools]
    assert "get_node_details" in tool_names
    assert "find_node" in tool_names

    mock_details_payload = {
        "id": "4:abc:13",
        "name": "공명",
        "label": "Screen",
        "aliases": ["공명", "#Resonance"],
        "test_status": "Untested",
        "is_global": True,
        "description": "영웅 공명 시스템 전역 제어 모듈",
        "issue_link": "https://jira.company.com/browse/QA-102",
        "is_manual_override": False,
        "override_reason": None,
        "is_modified": False,
        "modified_note": None,
        "checklist": [
            {"id": "c1", "text": "공명 버프 수치 계산식 정상 적용 확인", "status": "Passed"},
            {"id": "c2", "text": "속성별 공명 활성화 조건 확인", "status": "Passed"},
            {"id": "c3", "text": "4인 풀파티 공명 시너지 이펙트 확인", "status": "Untested"},
        ],
        "properties": {"is_global": "true"},
        "parent": None,
        "children": [],
        "incoming_edges": [
            {
                "id": "5:abc:1",
                "type": "Transition",
                "source_id": "4:abc:10",
                "source_name": "파티 편성 화면",
                "source_label": "Screen",
                "test_status": "Passed",
                "action": "공명 탭 터치",
                "properties": {"action": "공명 탭 터치"},
            }
        ],
        "outgoing_edges": [
            {
                "id": "5:abc:2",
                "type": "Return",
                "target_id": "4:abc:11",
                "target_name": "메인 게임",
                "target_label": "Screen",
                "test_status": "Untested",
                "action": "닫기",
                "properties": {"action": "닫기"},
            }
        ],
    }

    with patch.object(mcp_srv, "_api", return_value=mock_details_payload) as mock_api:
        res = asyncio.run(mcp_srv.call_tool("get_node_details", {"query": "공명"}))
        assert len(res) == 1
        text = res[0].text
        assert "🔍 노드 상세 정보: [Screen] 공명" in text
        assert "전역 여부(is_global): ✅ true" in text
        assert '["공명", "#Resonance"]' in text
        assert "📋 내부 체크리스트 (2/3 통과):" in text
        assert "[x] 공명 버프 수치 계산식 정상 적용 확인" in text
        assert "[ ] 4인 풀파티 공명 시너지 이펙트 확인 (Untested)" in text
        assert "파티 편성 화면 ──(action: 공명 탭 터치)──▶" in text
        assert "──[Return: 닫기]──▶ 메인 게임" in text
        mock_api.assert_called_once()

    mock_graph_payload = {
        "nodes": [
            {
                "id": "4:abc:13",
                "name": "공명",
                "label": "Screen",
                "aliases": ["공명", "#Resonance"],
                "test_status": "Untested",
                "properties": {
                    "is_global": "true",
                    "checklist": [
                        {"id": "c1", "text": "항목1", "status": "Passed"},
                        {"id": "c2", "text": "항목2", "status": "Untested"},
                    ],
                },
            },
            {
                "id": "4:abc:14",
                "name": "일반 전투 화면",
                "label": "Screen",
                "aliases": ["#Battle"],
                "test_status": "Passed",
                "properties": {"is_global": "false"},
            },
        ],
        "edges": [],
    }
    with patch.object(mcp_srv, "_api", return_value=mock_graph_payload):
        res_find = asyncio.run(
            mcp_srv.call_tool(
                "find_node",
                {"name": "#Resonance", "label": "Screen", "is_global": True, "include_details": True},
            )
        )
        find_text = res_find[0].text
        assert "검색 결과: 1개" in find_text
        assert "[🌐 Global]" in find_text
        assert "is_global: true" in find_text
        assert "checklist: 2개 (1/2 통과)" in find_text

        res_non_global = asyncio.run(
            mcp_srv.call_tool(
                "find_node",
                {"name": "화면", "is_global": False, "include_details": True},
            )
        )
        non_global_text = res_non_global[0].text
        assert "검색 결과: 1개" in non_global_text
        assert "일반 전투 화면" in non_global_text
        assert "is_global: false" in non_global_text
        assert "공명" not in non_global_text

        res_wildcard = asyncio.run(
            mcp_srv.call_tool(
                "find_node",
                {"name": "*", "is_global": True},
            )
        )
        assert "검색 결과: 1개" in res_wildcard[0].text
        assert "공명" in res_wildcard[0].text



