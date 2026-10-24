"""
Milestone 1 Challenger 2 Empirical Stress Test Suite
Adversarial Verification of:
1. Preset ID Path Traversal Permutations & Boundary Conditions
2. ENABLE_DEV_ENDPOINTS Environment Variable Parsing & Security Gating
3. Deterministic BFS Root Cause Tracing: Multi-Branch Trees, Diamonds, Edge Semantics & Cycles
"""
import os
import re
import urllib.parse
from unittest.mock import Mock, MagicMock, patch
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import app
from database import get_db
import preset_service
from preset_service import _resolve_preset_path, get_preset, load_preset_to_neo4j
from graph_service import (
    find_root_cause_bfs,
    get_node_status_summary,
    RootCauseInfo,
    STATUS_DEPENDENT_EDGE_TYPES,
    FAIL_OR_BLOCK,
)


# =============================================================================
# PART 1: PRESET PATH TRAVERSAL PERMUTATIONS
# =============================================================================

class TestPresetPathTraversalPermutations:
    """Adversarial stress-testing of preset_id path traversal handling."""

    @pytest.mark.parametrize("payload", [
        # Standard relative traversal
        "..",
        "../",
        "..\\",
        "../..",
        "..\\..",
        "../../..",
        "..\\..\\..",
        "../outside",
        "..\\outside",
        "../../secret",
        "..\\..\\secret",
        "../../../../../../../../../../windows/system32/cmd.exe",

        # Dot variants
        ".",
        "./preset",
        ".\\preset",
        "...",
        "....",
        "preset/...",
        "preset\\...",
        "preset..",
        "preset...json",

        # Slashes and separators
        "/",
        "\\",
        "/etc/passwd",
        "/etc/shadow",
        "C:\\Windows",
        "C:\\Windows\\System32\\drivers\\etc\\hosts",
        "C:/Windows/win.ini",
        "D:\\data\\preset.json",
        "\\\\localhost\\c$\\test",
        "\\\\127.0.0.1\\c$\\test",

        # Embedded traversal in subdirectories
        "sub/preset",
        "sub\\preset",
        "sub/../preset",
        "sub\\..\\preset",
        "preset/../../escape",
        "preset\\..\\..\\escape",

        # URL encoded and percent-encoded payloads
        "%2e%2e",
        "%2e%2e%2f",
        "%2e%2e%5c",
        "%2e%2e/outside",
        "%2e%2e\\outside",
        "..%2f",
        "..%5c",
        "..%2foutside",
        "..%5coutside",
        "%252e%252e%252f",
        "%00",
        "preset%00.json",
        "preset%20name",

        # Null bytes
        "\0",
        "preset\0",
        "preset\0.json",
        "\0preset",
        "preset.json\0",

        # Whitespace and emptiness
        "",
        " ",
        "   ",
        "\t",
        "\n",
        "\r\n",
        " preset",
        "preset ",
        "preset\t",
        "preset\n",

        # Dangerous shell / path characters
        "preset;ls",
        "preset|dir",
        "preset&calc",
        "preset$HOME",
        "preset`whoami`",
        "preset>out",
        "preset<in",
        "preset*wildcard",
        "preset?single",
        'preset"quote',
        "preset'quote",

        # Windows Alternate Data Streams (ADS)
        "preset:stream",
        "preset.json:stream",
        "preset::$DATA",
        "preset.json::$DATA",

        # Non-ASCII and unicode evasion attempts
        "\u202e\u002e\u002e",  # Right-to-left override
        "\uff0e\uff0e\uff0f",  # Full-width ../
    ])
    def test_direct_resolve_preset_path_rejects_malicious_payloads(self, payload):
        """Every path traversal or invalid payload must raise HTTPException(400)."""
        with pytest.raises(HTTPException) as exc_info:
            _resolve_preset_path(payload)
        assert exc_info.value.status_code == 400, (
            f"Expected status 400 for payload {payload!r}, got {exc_info.value.status_code}"
        )

    @pytest.mark.parametrize("invalid_type", [
        None,
        123,
        12.34,
        True,
        False,
        [],
        ["../malicious"],
        {"id": "../malicious"},
    ])
    def test_direct_resolve_preset_path_rejects_non_string_types(self, invalid_type):
        """Non-string arguments must raise HTTPException(400)."""
        with pytest.raises(HTTPException) as exc_info:
            _resolve_preset_path(invalid_type)
        assert exc_info.value.status_code == 400

    def test_valid_preset_id_format_but_non_existent_returns_404(self):
        """Valid alphanumeric preset ID that does not exist on disk must return 404, not 400."""
        valid_non_existent = "non_existent_test_preset_xyz_12345"
        with pytest.raises(HTTPException) as exc_info:
            _resolve_preset_path(valid_non_existent)
        assert exc_info.value.status_code == 404
        assert "not found" in exc_info.value.detail.lower()

    def test_valid_existing_preset_resolution(self):
        """Valid existing preset (e.g. minimal_e2e) must resolve cleanly to a real file path."""
        path_without_ext = _resolve_preset_path("minimal_e2e")
        assert os.path.exists(path_without_ext)
        assert path_without_ext.endswith("minimal_e2e.json")

        path_with_ext = _resolve_preset_path("minimal_e2e.json")
        assert path_with_ext == path_without_ext

    def test_http_api_preset_get_with_encoded_traversal(self):
        """FastAPI TestClient calls with URL-encoded traversal must be blocked (400 or 404, never 200/500)."""
        client = TestClient(app)
        test_payloads = [
            "..%2Foutside",
            "..%5Coutside",
            "%2e%2e%2foutside",
            "%2e%2e%5cwindows%5cwin.ini",
            "..%252Fetc%252Fpasswd",
            "nonexistent%00file",
            "test;calc",
        ]
        for p in test_payloads:
            res = client.get(f"/api/presets/{p}")
            assert res.status_code in (400, 404), (
                f"Expected 400 or 404 for HTTP GET /api/presets/{p}, got {res.status_code} ({res.text})"
            )
            assert res.status_code != 500, f"Server error on payload: {p}"

    def test_http_api_preset_load_with_traversal_payload(self):
        """POST /api/presets/{preset_id}/load must reject traversal payloads with 400."""
        client = TestClient(app)
        mock_session = Mock()
        app.dependency_overrides[get_db] = lambda: mock_session
        try:
            res = client.post("/api/presets/..%2F..%2Fescape/load")
            assert res.status_code in (400, 404)
        finally:
            app.dependency_overrides.clear()


# =============================================================================
# PART 2: ENABLE_DEV_ENDPOINTS SECURITY GATING
# =============================================================================

class TestEnableDevEndpointsSecurityGate:
    """Adversarial stress-testing of dev endpoint gating behind ENABLE_DEV_ENDPOINTS."""

    @pytest.mark.parametrize("falsy_val", [
        None,            # Not set
        "",              # Empty
        "   ",           # Whitespace
        "false",         # Standard false
        "False",         # Title false
        "FALSE",         # Upper false
        "0",             # Zero
        "no",            # No
        "No",            # Title no
        "NO",            # Upper no
        "disabled",      # Disabled
        "DISABLED",      # Upper disabled
        "none",          # None string
        "off",           # Off
        "OFF",           # Upper off
        "2",             # Non-1 integer
        "-1",            # Negative integer
        "true1",         # Prefix match attempt
        "10",            # 10
        "undefined",     # Undefined
    ])
    def test_dev_reset_seed_rejected_for_all_falsy_or_invalid_values(self, monkeypatch, falsy_val):
        """Any value not strictly in ('true', '1', 'yes') must yield HTTP 403 Forbidden."""
        client = TestClient(app)
        if falsy_val is None:
            monkeypatch.delenv("ENABLE_DEV_ENDPOINTS", raising=False)
        else:
            monkeypatch.setenv("ENABLE_DEV_ENDPOINTS", falsy_val)

        with patch("subprocess.run") as mock_subproc:
            res = client.post("/api/dev/reset-seed")
            assert res.status_code == 403, (
                f"Expected 403 for ENABLE_DEV_ENDPOINTS={falsy_val!r}, got {res.status_code}"
            )
            assert "Development endpoints are disabled" in res.json().get("detail", "")
            # Subprocess (scripts/seed.py) MUST NOT be called!
            assert not mock_subproc.called

    @pytest.mark.parametrize("truthy_val", [
        "true",
        "True",
        "TRUE",
        " true ",
        "1",
        " 1 ",
        "yes",
        "Yes",
        "YES",
        " yes ",
    ])
    def test_dev_reset_seed_allowed_for_all_truthy_values(self, monkeypatch, truthy_val):
        """Truthy values must allow access and execute the seed subprocess."""
        client = TestClient(app)
        monkeypatch.setenv("ENABLE_DEV_ENDPOINTS", truthy_val)

        mock_session = Mock()
        mock_record = {"total": 0, "seed_marker": 0}
        mock_session.run.return_value.single.return_value = mock_record
        app.dependency_overrides[get_db] = lambda: mock_session

        try:
            with patch("subprocess.run") as mock_subproc:
                res = client.post("/api/dev/reset-seed")
                assert res.status_code == 200, (
                    f"Expected 200 for ENABLE_DEV_ENDPOINTS={truthy_val!r}, got {res.status_code}"
                )
                assert res.json().get("status") == "success"
                assert mock_subproc.called
        finally:
            app.dependency_overrides.clear()


# =============================================================================
# PART 3: DETERMINISTIC BFS ROOT CAUSE TRACING
# =============================================================================

class MockGraphEngine:
    """
    In-memory graph helper for deterministic BFS testing.
    Mocks session.run to respond accurately to incoming_query for arbitrary topologies.
    """
    def __init__(self):
        self.nodes = {}  # id -> {name, test_status, label}
        self.edges = []  # list of {id, src_id, target_id, type, test_status, action}

    def add_node(self, nid: str, name: str, test_status: str = "Untested", label: str = "Screen"):
        self.nodes[nid] = {
            "id": nid,
            "name": name,
            "test_status": test_status,
            "label": label
        }

    def add_edge(self, eid: str, src_id: str, target_id: str, edge_type: str, test_status: str = "Untested", action: str = None):
        self.edges.append({
            "edge_id": eid,
            "src_id": src_id,
            "target_id": target_id,
            "edge_type": edge_type.upper(),
            "edge_status": test_status,
            "edge_action": action
        })

    def run_incoming(self, query: str, **kw):
        curr_id = kw.get("curr_id")
        results = []
        for e in self.edges:
            if e["target_id"] == curr_id:
                # Exclude RETURN edges per spec
                if e["edge_type"] == "RETURN":
                    continue
                src = self.nodes.get(e["src_id"], {"name": e["src_id"], "test_status": "Untested"})
                results.append({
                    "src_id": e["src_id"],
                    "src_name": src["name"],
                    "src_status": src["test_status"],
                    "edge_id": e["edge_id"],
                    "edge_type": e["edge_type"],
                    "edge_status": e["edge_status"],
                    "edge_action": e["edge_action"]
                })
        # Deterministic order by src.name ASC, elementId(r) ASC
        results.sort(key=lambda r: (r["src_name"], r["edge_id"]))
        mock_res = MagicMock()
        mock_res.__iter__.return_value = iter(results)
        return mock_res


class TestDeterministicBFSRootCauseTracing:
    """Adversarial stress-testing of deterministic BFS root-cause tracing."""

    def test_shortest_distance_priority_over_alphabetical_intermediate(self):
        """
        Topology (Distance Priority):
        Target (Blocked)
          <- Mid_A (Blocked) <- Root_Far (Failed)   [Depth 2]
          <- Root_Close (Failed)                    [Depth 1]
        'Mid_A' comes alphabetically BEFORE 'Root_Close' ('M' < 'R').
        BFS MUST return Root_Close (depth 1) because BFS prioritizes shortest path over alphabetical intermediate names.
        """
        engine = MockGraphEngine()
        engine.add_node("target", "Target", "Blocked")
        engine.add_node("mid_a", "Mid_A", "Blocked")
        engine.add_node("root_far", "Root_Far", "Failed")
        engine.add_node("root_close", "Root_Close", "Failed")

        # Depth 1 edges
        engine.add_edge("e1", "mid_a", "target", "DEPENDS_ON", "Untested")
        engine.add_edge("e2", "root_close", "target", "DEPENDS_ON", "Untested")
        # Depth 2 edge
        engine.add_edge("e3", "root_far", "mid_a", "DEPENDS_ON", "Untested")

        mock_session = Mock()
        mock_session.run.side_effect = engine.run_incoming

        info = find_root_cause_bfs(mock_session, "target", "Target")
        assert info is not None
        # Root_Close MUST win because distance is 1 (shortest path)
        assert info.origin_node_id == "root_close"
        assert info.origin_node_name == "Root_Close"
        assert info.path == ["Root_Close", "Target"]

    def test_alphabetical_tie_breaker_at_same_depth(self):
        """
        Topology (Same Distance Tie-Breaker):
        Target (Blocked)
          <- Root_B (Failed) [Depth 1]
          <- Root_A (Failed) [Depth 1]
        Both are at depth 1. BFS MUST deterministically pick Root_A because 'Root_A' < 'Root_B'.
        """
        engine = MockGraphEngine()
        engine.add_node("target", "Target", "Blocked")
        engine.add_node("root_b", "Root_B", "Failed")
        engine.add_node("root_a", "Root_A", "Failed")

        engine.add_edge("e_b", "root_b", "target", "DEPENDS_ON", "Untested")
        engine.add_edge("e_a", "root_a", "target", "DEPENDS_ON", "Untested")

        mock_session = Mock()
        mock_session.run.side_effect = engine.run_incoming

        info = find_root_cause_bfs(mock_session, "target", "Target")
        assert info is not None
        assert info.origin_node_id == "root_a"
        assert info.origin_node_name == "Root_A"
        assert info.path == ["Root_A", "Target"]

    def test_diamond_dependency_convergence(self):
        """
        Topology (Diamond):
        Target (Blocked)
          <- Branch_1 (Blocked) <- Root (Failed)
          <- Branch_2 (Blocked) <- Root (Failed)
        Root is reached through both branches. BFS must not duplicate exploration,
        and must deterministically return the path through Branch_1 ('Branch_1' < 'Branch_2').
        """
        engine = MockGraphEngine()
        engine.add_node("target", "Target", "Blocked")
        engine.add_node("b1", "Branch_1", "Blocked")
        engine.add_node("b2", "Branch_2", "Blocked")
        engine.add_node("root", "Root", "Failed")

        engine.add_edge("e_t1", "b1", "target", "DEPENDS_ON", "Untested")
        engine.add_edge("e_t2", "b2", "target", "DEPENDS_ON", "Untested")
        engine.add_edge("e_r1", "root", "b1", "DEPENDS_ON", "Untested")
        engine.add_edge("e_r2", "root", "b2", "DEPENDS_ON", "Untested")

        mock_session = Mock()
        mock_session.run.side_effect = engine.run_incoming

        info = find_root_cause_bfs(mock_session, "target", "Target")
        assert info is not None
        assert info.origin_node_id == "root"
        assert info.origin_node_name == "Root"
        assert info.path == ["Root", "Branch_1", "Target"]

    def test_flow_edge_failed_action_immediate_root_cause(self):
        """
        Topology (Flow Edge Failure):
        Screen_A (Untested) --Transition (Failed, action='버튼 클릭')--> Screen_B (Blocked)
        Flow edges are judged strictly by edge_status.
        If Transition is Failed, it is the root cause with its edge action label.
        """
        engine = MockGraphEngine()
        engine.add_node("screen_a", "Screen_A", "Untested")
        engine.add_node("screen_b", "Screen_B", "Blocked")

        engine.add_edge("e_btn", "screen_a", "screen_b", "TRANSITION", "Failed", action="버튼 클릭")

        mock_session = Mock()
        mock_session.run.side_effect = engine.run_incoming

        info = find_root_cause_bfs(mock_session, "screen_b", "Screen_B")
        assert info is not None
        assert info.origin_node_id == "screen_a"
        assert info.origin_node_name == "Screen_A"
        assert "버튼 클릭" in info.reason
        assert info.path == ["Screen_A", "Screen_B"]

    def test_flow_edge_passed_ignores_failed_source_node(self):
        """
        Topology (Flow Edge Ignores Source Status):
        Defect_Screen (Failed) --Transition (Passed)--> Normal_Screen (Blocked)
                               --Depends_On (Untested)--> TC_Gate (Failed)
        Transition is Passed, so Defect_Screen MUST NOT be treated as a causal origin.
        Causal path must trace through Depends_On to TC_Gate.
        """
        engine = MockGraphEngine()
        engine.add_node("normal_screen", "Normal_Screen", "Blocked")
        engine.add_node("defect_screen", "Defect_Screen", "Failed")
        engine.add_node("tc_gate", "TC_Gate", "Failed")

        # Flow edge from Failed screen, but edge is Passed -> NON-CAUSAL!
        engine.add_edge("e_trans", "defect_screen", "normal_screen", "TRANSITION", "Passed", action="화면 이동")
        # Dependency edge from TC_Gate (Failed) -> CAUSAL!
        engine.add_edge("e_dep", "tc_gate", "normal_screen", "DEPENDS_ON", "Untested")

        mock_session = Mock()
        mock_session.run.side_effect = engine.run_incoming

        info = find_root_cause_bfs(mock_session, "normal_screen", "Normal_Screen")
        assert info is not None
        assert info.origin_node_id == "tc_gate"
        assert info.origin_node_name == "TC_Gate"
        assert info.path == ["TC_Gate", "Normal_Screen"]

    def test_return_edge_completely_excluded_from_root_cause(self):
        """
        Topology (Return Edge Exclusion):
        Normal (Blocked) <-Return (Failed)-- Failed_Previous (Failed)
                         <-Depends_On (Untested)-- TC_Real_Root (Failed)
        Return edge is strictly weight=0 and must be completely ignored even if Failed.
        """
        engine = MockGraphEngine()
        engine.add_node("normal", "Normal", "Blocked")
        engine.add_node("prev_fail", "Failed_Previous", "Failed")
        engine.add_node("tc_real", "TC_Real_Root", "Failed")

        engine.add_edge("e_ret", "prev_fail", "normal", "RETURN", "Failed", action="뒤로가기")
        engine.add_edge("e_dep", "tc_real", "normal", "DEPENDS_ON", "Untested")

        mock_session = Mock()
        mock_session.run.side_effect = engine.run_incoming

        info = find_root_cause_bfs(mock_session, "normal", "Normal")
        assert info is not None
        assert info.origin_node_id == "tc_real"
        assert info.origin_node_name == "TC_Real_Root"
        assert "Failed_Previous" not in info.path

    def test_cycle_immunity_and_depth_limit(self):
        """
        Topology (Cycle Immunity):
        Target (Blocked) <- A (Blocked) <- B (Blocked) <- A (Blocked) [Cycle between A and B]
        BFS must handle cyclic graphs gracefully without infinite loop or stack overflow,
        returning None when no true Failed root cause exists in the cycle.
        """
        engine = MockGraphEngine()
        engine.add_node("target", "Target", "Blocked")
        engine.add_node("node_a", "Node_A", "Blocked")
        engine.add_node("node_b", "Node_B", "Blocked")

        engine.add_edge("e1", "node_a", "target", "DEPENDS_ON", "Untested")
        engine.add_edge("e2", "node_b", "node_a", "DEPENDS_ON", "Untested")
        engine.add_edge("e3", "node_a", "node_b", "DEPENDS_ON", "Untested")  # Cycle

        mock_session = Mock()
        mock_session.run.side_effect = engine.run_incoming

        info = find_root_cause_bfs(mock_session, "target", "Target")
        # No Failed root cause exists in a purely Blocked cycle -> returns None
        assert info is None

    def test_depth_limit_boundary_10_hops(self):
        """
        Topology (Long Chain):
        Chain of 12 Blocked nodes ending with Root (Failed).
        BFS with depth limit 10 stops at depth 10 without hanging.
        """
        engine = MockGraphEngine()
        engine.add_node("n0", "N0_Target", "Blocked")
        for i in range(1, 12):
            status = "Failed" if i == 11 else "Blocked"
            engine.add_node(f"n{i}", f"N{i}", status)
            engine.add_edge(f"e{i}", f"n{i}", f"n{i-1}", "DEPENDS_ON", "Untested")

        mock_session = Mock()
        mock_session.run.side_effect = engine.run_incoming

        info = find_root_cause_bfs(mock_session, "n0", "N0_Target")
        # Root is at depth 11, depth limit is 10, so BFS terminates safely
        assert info is None or len(info.path) <= 11
