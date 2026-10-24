"""
Milestone 1 Empirical Challenger Stress Test Suite
Adversarial verification of:
1. Dependency cycle rejection (Depends_On, Tests) and self-loops across N-hop topologies & DAGs
2. Return edge weight 0 enforcement, synthesis exclusion, and deadlock immunity
3. Worklist boundary termination at manual override and global nodes
4. Global node non-propagation to screens (AI_IMPLEMENTATION_SPEC §4.3)
5. Direct Failed preservation across upstream gate lifecycle
6. Property overwrite prevention and schema sanitization
7. Security dev endpoint gate & preset path traversal boundary tests
"""
import json
import pytest
from unittest.mock import Mock, MagicMock
from fastapi import HTTPException
from fastapi.testclient import TestClient

from graph_service import (
    compute_synthesized_status,
    checklist_status,
    create_edge,
    update_edge,
    create_node,
    update_node,
    _check_dependency_cycle_and_self_loop,
    _dependent_targets,
    _run_propagation,
    _recalc_single_node_status,
    sanitize_node_properties,
    sanitize_edge_properties,
    RESERVED_NODE_PROPERTIES,
    RESERVED_EDGE_PROPERTIES,
)
from models import NodeCreate, NodeUpdate, EdgeCreate, EdgeUpdate
from main import app
from conftest import RECALC_QUERY_MARKER
import preset_service


# ─────────────────────────────────────────────────────────────────────────────
# In-Memory Oracle Session with Reachability Engine for Cycle Stress Testing
# ─────────────────────────────────────────────────────────────────────────────

class ReachabilityGraphSession:
    """
    In-memory graph session that simulates Neo4j and computes true directed
    reachability over Depends_On and Tests edges to act as an oracle for cycle checks.
    """
    def __init__(self):
        self.nodes = {}  # id -> dict of properties
        self.edges = {}  # id -> {id, source, target, type, test_status, properties}
        self._next_edge_id = 1

    def add_node(self, nid: str, **props):
        self.nodes[nid] = {
            "test_status": "Untested",
            "is_manual_override": False,
            "override_reason": None,
            "is_global": "false",
            "checklist": None,
            **props
        }

    def add_edge(self, source: str, target: str, edge_type: str, test_status: str = "Untested", properties: dict = None):
        eid = f"e{self._next_edge_id}"
        self._next_edge_id += 1
        self.edges[eid] = {
            "id": eid,
            "source": source,
            "target": target,
            "type": edge_type,
            "test_status": test_status,
            "properties": properties or {}
        }
        return eid

    def _has_path(self, start: str, end: str, allowed_types: set, exclude_edge_id: str = None) -> bool:
        """BFS reachability check from start to end over allowed edge types."""
        visited = set()
        queue = [start]
        while queue:
            curr = queue.pop(0)
            if curr == end:
                return True
            if curr in visited:
                continue
            visited.add(curr)
            for eid, edata in self.edges.items():
                if exclude_edge_id and eid == exclude_edge_id:
                    continue
                if edata["source"] == curr and edata["type"].upper() in allowed_types:
                    queue.append(edata["target"])
        return False

    def run(self, query: str, **kw):
        mock_res = MagicMock()

        # 1. Cycle detection query simulation
        if "has_cycle" in query:
            target_id = kw.get("target_id")
            source_id = kw.get("source_id")
            exclude_id = kw.get("edge_id")
            allowed = {"DEPENDS_ON", "TESTS"}
            # The query checks if path exists from target to source
            has_cycle = self._has_path(target_id, source_id, allowed, exclude_id)
            mock_res.single.return_value = {"has_cycle": has_cycle}
            return mock_res

        # 2. Status recalculation query
        if RECALC_QUERY_MARKER in query:
            tid = kw.get("target_id")
            t = self.nodes.get(tid)
            if not t:
                mock_res.single.return_value = None
                return mock_res
            inputs = []
            for eid, edata in self.edges.items():
                if edata["target"] == tid and edata["type"].upper() != "RETURN":
                    src_node = self.nodes.get(edata["source"], {})
                    inputs.append({
                        "edge_type": edata["type"].upper(),
                        "edge_status": edata.get("test_status", "Untested"),
                        "src_status": src_node.get("test_status", "Untested"),
                        "src_is_global": str(src_node.get("is_global", "")).lower() == "true",
                        "is_badge_attachment": edata.get("properties", {}).get("is_badge_attachment", False)
                    })
            mock_res.single.return_value = {
                "current_status": t.get("test_status", "Untested"),
                "is_override": t.get("is_manual_override"),
                "is_global": t.get("is_global"),
                "checklist": t.get("checklist"),
                "inputs": inputs,
            }
            return mock_res

        # 3. SET target.test_status
        if "SET target.test_status = $new_status" in query:
            tid = kw.get("target_id")
            if tid in self.nodes:
                self.nodes[tid]["test_status"] = kw.get("new_status")
            mock_res.single.return_value = None
            return mock_res

        # 4. Downstream targets query (IN $dep_types)
        if "IN $dep_types" in query:
            src_id = kw.get("id")
            dep_types = [t.upper() for t in kw.get("dep_types", [])]
            src_node = self.nodes.get(src_id, {})
            # If src is global or override, returns empty
            if str(src_node.get("is_global", "")).lower() == "true" or src_node.get("is_manual_override"):
                mock_res.__iter__.return_value = iter([])
                return mock_res

            next_ids = []
            for eid, edata in self.edges.items():
                if edata["source"] == src_id and edata["type"].upper() in dep_types:
                    downstream = self.nodes.get(edata["target"], {})
                    if str(downstream.get("is_global", "")).lower() != "true" and not downstream.get("is_manual_override"):
                        next_ids.append(edata["target"])
            mock_res.__iter__.return_value = iter([{"next_id": nid} for nid in sorted(set(next_ids))])
            return mock_res

        # 5. CREATE (source)-[r:`TYPE`]->(target)
        if "CREATE (source)-[r:" in query:
            etype = query.split("[r:`")[1].split("`")[0]
            eid = self.add_edge(kw["source_id"], kw["target_id"], etype, kw.get("test_status", "Untested"), kw.get("properties"))
            mock_res.single.return_value = {"id": eid}
            return mock_res

        # 6. MATCH (n) WHERE elementId(n) = $id SET ...
        if query.strip().startswith("MATCH (n) WHERE elementId(n) = $id") and "SET" in query:
            nid = kw["id"]
            if nid in self.nodes:
                for k in ("test_status", "is_manual_override", "override_reason", "name", "description", "issue_link"):
                    if k in kw:
                        self.nodes[nid][k] = kw[k]
                if "properties" in kw and isinstance(kw["properties"], dict):
                    self.nodes[nid].update(kw["properties"])
            mock_res.single.return_value = None
            return mock_res

        # 7. MATCH (a)-[r]->(b) WHERE elementId(r) = $id RETURN ... (update_edge rel_info)
        if "WHERE elementId(r) = $id" in query and "RETURN" in query:
            eid = kw.get("id")
            edata = self.edges.get(eid)
            if edata:
                mock_res.single.return_value = {
                    "source_id": edata["source"],
                    "target_id": edata["target"],
                    "rel_type": edata["type"],
                    "new_id": eid,
                }
            else:
                mock_res.single.return_value = None
            return mock_res

        # 8. Type check in update_edge
        if "type(r) AS rel_type" in query:
            eid = kw.get("id")
            edata = self.edges.get(eid)
            mock_res.single.return_value = {"rel_type": edata["type"] if edata else None}
            return mock_res

        # Default fallback
        mock_res.single.return_value = None
        mock_res.__iter__.return_value = iter([])
        return mock_res


# ─────────────────────────────────────────────────────────────────────────────
# 1. Dependency Cycle Rejection & Self-Loop Stress Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_stress_self_loops_rejected_all_types():
    """Any attempt to create an edge with source == target must be rejected with ValueError."""
    session = Mock()
    edge_types = ["Depends_On", "Tests", "Transition", "Return", "Contains", "Custom_Edge"]

    for etype in edge_types:
        edge = EdgeCreate(source="node_X", target="node_X", type=etype)
        with pytest.raises(ValueError) as exc:
            create_edge(session, edge)
        assert "Self-loop dependency is not allowed." in str(exc.value)


def test_stress_2hop_cycle_detection():
    """A -> B -> A cycle must be rejected for Depends_On, Tests, and mixed types."""
    g = ReachabilityGraphSession()
    g.add_node("A")
    g.add_node("B")

    # A -> B (Depends_On)
    create_edge(g, EdgeCreate(source="A", target="B", type="Depends_On"))

    # B -> A (Depends_On) -> CYCLE!
    with pytest.raises(ValueError) as exc1:
        create_edge(g, EdgeCreate(source="B", target="A", type="Depends_On"))
    assert "Dependency cycle detected" in str(exc1.value)

    # B -> A (Tests) -> MIXED CYCLE!
    with pytest.raises(ValueError) as exc2:
        create_edge(g, EdgeCreate(source="B", target="A", type="Tests"))
    assert "Dependency cycle detected" in str(exc2.value)


def test_stress_nhop_long_chain_cycle_detection():
    """A long chain N1 -> N2 -> ... -> N10 must detect cycle when N10 -> N1 is attempted."""
    g = ReachabilityGraphSession()
    nodes = [f"N_{i}" for i in range(1, 11)]
    for n in nodes:
        g.add_node(n)

    for i in range(len(nodes) - 1):
        etype = "Depends_On" if i % 2 == 0 else "Tests"
        create_edge(g, EdgeCreate(source=nodes[i], target=nodes[i+1], type=etype))

    # N_10 -> N_1 (10-hop cycle)
    with pytest.raises(ValueError) as exc:
        create_edge(g, EdgeCreate(source="N_10", target="N_1", type="Depends_On"))
    assert "Dependency cycle detected" in str(exc.value)

    # N_7 -> N_3 (Sub-cycle within the chain)
    with pytest.raises(ValueError) as exc:
        create_edge(g, EdgeCreate(source="N_7", target="N_3", type="Tests"))
    assert "Dependency cycle detected" in str(exc.value)


def test_stress_dag_diamond_topology_allowed():
    """Diamond DAG (A -> B, A -> C, B -> D, C -> D) is NOT a cycle and must succeed."""
    g = ReachabilityGraphSession()
    g.add_node("A")
    g.add_node("B")
    g.add_node("C")
    g.add_node("D")

    e1 = create_edge(g, EdgeCreate(source="A", target="B", type="Depends_On"))
    e2 = create_edge(g, EdgeCreate(source="A", target="C", type="Depends_On"))
    e3 = create_edge(g, EdgeCreate(source="B", target="D", type="Depends_On"))
    e4 = create_edge(g, EdgeCreate(source="C", target="D", type="Depends_On"))

    assert all([e1, e2, e3, e4])
    assert len(g.edges) == 4


def test_stress_return_edges_allowed_in_loop():
    """Game cycle with Return edge: Lobby -> Shop (Transition), Shop -> Lobby (Return) must be allowed."""
    g = ReachabilityGraphSession()
    g.add_node("Lobby")
    g.add_node("Shop")

    e1 = create_edge(g, EdgeCreate(source="Lobby", target="Shop", type="Transition"))
    e2 = create_edge(g, EdgeCreate(source="Shop", target="Lobby", type="Return"))

    assert e1 and e2
    assert len(g.edges) == 2


def test_stress_update_edge_cycle_rejection():
    """Updating existing non-dependency edge to Depends_On that forms a cycle must be rejected."""
    g = ReachabilityGraphSession()
    g.add_node("A")
    g.add_node("B")

    # A -> B (Depends_On)
    create_edge(g, EdgeCreate(source="A", target="B", type="Depends_On"))
    # B -> A (Transition)
    e_back = create_edge(g, EdgeCreate(source="B", target="A", type="Transition"))

    # Attempt to update e_back type to Depends_On -> must raise cycle error!
    with pytest.raises(ValueError) as exc:
        update_edge(g, e_back, EdgeUpdate(type="Depends_On"))
    assert "Dependency cycle detected" in str(exc.value)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Return Edge Weight 0 & Deadlock Immunity Stress Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_stress_return_edge_weight_forced_to_zero_on_create():
    """Even if caller provides non-zero weight, Return edge must be sanitized to weight=0."""
    session = Mock()
    create_res = MagicMock()
    create_res.single.return_value = {"id": "return_edge_1"}
    recalc_res = MagicMock()
    recalc_res.single.return_value = {"current_status": "Untested", "is_override": False, "is_global": False, "checklist": None, "inputs": []}

    def _run(q, **kw):
        if RECALC_QUERY_MARKER in q:
            return recalc_res
        return create_res

    session.run.side_effect = _run

    edge_id = create_edge(session, EdgeCreate(
        source="Shop",
        target="Lobby",
        type="Return",
        properties={"weight": 100, "note": "closing modal"}
    ))

    create_call = [c for c in session.run.call_args_list if "CREATE (source)-[r:`Return`]" in c[0][0]][0]
    kwargs = create_call[1]
    assert kwargs["properties"]["weight"] == 0
    assert kwargs["properties"]["note"] == "closing modal"


def test_stress_return_edge_excluded_from_synthesized_status():
    """An incoming Return edge, regardless of status, is completely omitted from status synthesis."""
    # 1. Target with only a Failed Return edge -> remains Untested
    res1 = compute_synthesized_status("Untested", [
        {"edge_type": "RETURN", "edge_status": "Failed", "src_status": "Failed"}
    ])
    assert res1 == "Untested"

    # 2. Target with Passed Transition AND Failed Return -> Passed (Return does not pollute with Blocked/Failed)
    res2 = compute_synthesized_status("Untested", [
        {"edge_type": "TRANSITION", "edge_status": "Passed", "src_status": "Passed"},
        {"edge_type": "RETURN", "edge_status": "Failed", "src_status": "Failed"}
    ])
    assert res2 == "Passed"


def test_stress_return_edge_mutual_return_no_deadlock():
    """Two screens with bidirectional Return edges: updating status never triggers infinite loop."""
    g = ReachabilityGraphSession()
    g.add_node("ScreenA", test_status="Untested")
    g.add_node("ScreenB", test_status="Untested")

    create_edge(g, EdgeCreate(source="ScreenA", target="ScreenB", type="Return", test_status="Failed"))
    create_edge(g, EdgeCreate(source="ScreenB", target="ScreenA", type="Return", test_status="Failed"))

    update_node(g, "ScreenA", NodeUpdate(test_status="Failed"))
    # ScreenB is not affected by Return edge
    assert g.nodes["ScreenB"]["test_status"] == "Untested"
    assert g.nodes["ScreenA"]["test_status"] == "Failed"


# ─────────────────────────────────────────────────────────────────────────────
# 3. Worklist Boundary Termination Stress Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_stress_worklist_boundary_termination_manual_override():
    """Propagation must strictly halt when encountering an is_manual_override node."""
    g = ReachabilityGraphSession()
    g.add_node("TC1", test_status="Untested")
    g.add_node("TC2_Override", test_status="Passed", is_manual_override=True, override_reason="빌드 외 환경 검증")
    g.add_node("TC3", test_status="Untested")
    g.add_node("TC4", test_status="Untested")

    create_edge(g, EdgeCreate(source="TC1", target="TC2_Override", type="Depends_On"))
    create_edge(g, EdgeCreate(source="TC2_Override", target="TC3", type="Depends_On"))
    create_edge(g, EdgeCreate(source="TC3", target="TC4", type="Depends_On"))

    # When TC1 fails:
    # TC2_Override must keep Passed
    # TC3 and TC4 must NOT be touched (stay Untested)
    update_node(g, "TC1", NodeUpdate(test_status="Failed"))

    assert g.nodes["TC1"]["test_status"] == "Failed"
    assert g.nodes["TC2_Override"]["test_status"] == "Passed"
    assert g.nodes["TC3"]["test_status"] == "Untested"
    assert g.nodes["TC4"]["test_status"] == "Untested"


def test_stress_worklist_boundary_termination_global_node():
    """Propagation must strictly halt when encountering an is_global node during cascade."""
    g = ReachabilityGraphSession()
    g.add_node("TC1", test_status="Untested")
    g.add_node("Global_Lang", test_status="Passed", is_global="true")
    g.add_node("SubScreen", test_status="Untested")

    # Initialize edge as Passed so Global_Lang synthesizes to Passed
    create_edge(g, EdgeCreate(source="TC1", target="Global_Lang", type="Depends_On", test_status="Passed"))
    create_edge(g, EdgeCreate(source="Global_Lang", target="SubScreen", type="Depends_On"))

    assert g.nodes["Global_Lang"]["test_status"] == "Passed"

    # When TC1 fails:
    update_node(g, "TC1", NodeUpdate(test_status="Failed"))

    # Global node is excluded from cascade recalc and stops downstream discovery
    assert g.nodes["Global_Lang"]["test_status"] == "Passed", "Global node should not be affected by TC1 failure in cascade"
    assert g.nodes["SubScreen"]["test_status"] == "Untested", "SubScreen should not be affected by Global node"


def test_stress_legacy_cycle_in_db_does_not_infinite_loop():
    """
    If a legacy cycle (A -> B -> C -> A) somehow exists in the database,
    _run_propagation's processed set MUST prevent infinite looping and terminate cleanly.
    """
    g = ReachabilityGraphSession()
    g.add_node("A", test_status="Untested")
    g.add_node("B", test_status="Untested")
    g.add_node("C", test_status="Untested")

    # Manually inject cycle bypassing create_edge
    g.add_edge("A", "B", "Depends_On")
    g.add_edge("B", "C", "Depends_On")
    g.add_edge("C", "A", "Depends_On")

    # Directly run propagation starting at A
    _run_propagation(g, ["B", "C"])

    # All nodes evaluated, no infinite loop or crash
    assert True


def test_bug_checklist_recovery_locked_in_failed():
    """
    [DEFECT 1 REPRODUCTION]
    When a component with a checklist transitions from Failed to Passed,
    compute_synthesized_status must return 'Passed'.
    CURRENT BEHAVIOR: Returns 'Failed' because line 221 checks
    `(current == 'Failed' and not tests)` without `and not cl`.
    """
    cl_failing = [{"id": "1", "status": "Failed"}]
    cl_passed = [{"id": "1", "status": "Passed"}]

    # Step 1: Checklist fails -> node is Failed
    res1 = compute_synthesized_status("Untested", [], checklist=cl_failing)
    assert res1 == "Failed"

    # Step 2: Tester fixes checklist to Passed -> node MUST become Passed!
    res2 = compute_synthesized_status(res1, [], checklist=cl_passed)
    assert res2 == "Passed", (
        f"Expected 'Passed' after all checklist items passed, but got '{res2}'. "
        "Bug: `(current == 'Failed' and not tests)` locks B안 checklist components into Failed forever."
    )


def test_stress_checklist_and_depends_on_interplay():
    """
    Verify complete interplay between internal checklist (B안) and upstream Depends_On gate.
    - Upstream gate failure correctly blocks a component with passed checklist.
    - Fixing checklist to passed while upstream is failed transitions to Blocked.
    - Recovering upstream gate to passed transitions component to Passed.
    - Direct Failed preservation does NOT lock checklist components.
    """
    cl_failing = [{"id": "1", "status": "Failed"}]
    cl_passed = [{"id": "1", "status": "Passed"}]
    dep_passed = [{"edge_type": "DEPENDS_ON", "src_status": "Passed"}]
    dep_failed = [{"edge_type": "DEPENDS_ON", "src_status": "Failed"}]
    dep_blocked = [{"edge_type": "DEPENDS_ON", "src_status": "Blocked"}]

    # 1. Gate Passed + Checklist Failed -> Failed
    s1 = compute_synthesized_status("Untested", dep_passed, checklist=cl_failing)
    assert s1 == "Failed"

    # 2. Gate Failed + Checklist Failed -> Failed (Failure priority)
    s2 = compute_synthesized_status(s1, dep_failed, checklist=cl_failing)
    assert s2 == "Failed"

    # 3. Gate still Failed + Checklist recovers to Passed -> Blocked (Upstream gate blocks)
    s3 = compute_synthesized_status(s2, dep_failed, checklist=cl_passed)
    assert s3 == "Blocked", f"Expected Blocked when upstream gate fails, got {s3}"

    # 4. Gate recovers to Passed + Checklist Passed -> Passed (Full recovery)
    s4 = compute_synthesized_status(s3, dep_passed, checklist=cl_passed)
    assert s4 == "Passed", f"Expected Passed when upstream gate recovers, got {s4}"

    # 5. Gate breaks again -> Blocked
    s5 = compute_synthesized_status(s4, dep_blocked, checklist=cl_passed)
    assert s5 == "Blocked"

    # 6. Gate recovers again -> Passed
    s6 = compute_synthesized_status(s5, dep_passed, checklist=cl_passed)
    assert s6 == "Passed"


def test_bug_update_edge_return_type_omits_weight_zero():
    """
    [DEFECT 2 REPRODUCTION]
    When an edge is updated to type='Return' via EdgeUpdate(type='Return'),
    weight=0 must be enforced in the properties.
    CURRENT BEHAVIOR: If properties is None, clean_props is None and weight=0 is skipped.
    """
    session = Mock()
    def _run(query, **kw):
        res = MagicMock()
        if "rel_type" in query:
            res.single.return_value = {"rel_type": "Transition", "source_id": "n1", "target_id": "n2"}
        elif "CREATE" in query:
            res.single.return_value = {"new_id": "e2", "target_id": "n2"}
        elif RECALC_QUERY_MARKER in query:
            res.single.return_value = {"current_status": "Untested", "is_override": False, "is_global": False, "checklist": None, "inputs": []}
        return res
    session.run.side_effect = _run

    update_edge(session, "e1", EdgeUpdate(type="Return"))

    # Check whether weight=0 was set in CREATE query or params
    create_call = [c for c in session.run.call_args_list if "CREATE (a)-[r2:`Return`]" in c[0][0]]
    assert len(create_call) > 0
    query = create_call[0][0][0]
    kwargs = create_call[0][1]

    has_weight_zero = ("weight = 0" in query) or (kwargs.get("properties", {}).get("weight") == 0)
    assert has_weight_zero, (
        "Expected weight=0 to be enforced on Return edge in update_edge, but neither query nor kwargs set weight=0."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. Global Node Non-Propagation to Screens Stress Tests (AI_IMPLEMENTATION_SPEC §4.3)
# ─────────────────────────────────────────────────────────────────────────────

def test_stress_global_node_never_propagates_to_screen():
    """A screen with failing global badge attachments must NEVER be marked Blocked or Failed."""
    screen_inputs = [
        {"edge_type": "TRANSITION", "edge_status": "Passed", "src_status": "Passed"},
        {"edge_type": "DEPENDS_ON", "edge_status": "Failed", "src_status": "Failed", "src_is_global": True},
        {"edge_type": "DEPENDS_ON", "edge_status": "Blocked", "src_status": "Blocked", "is_badge_attachment": True},
        {"edge_type": "TESTS", "edge_status": "Failed", "src_status": "Failed", "src_is_global": True},
    ]

    res = compute_synthesized_status("Untested", screen_inputs, is_global=False)
    assert res == "Passed", "Screen should remain Passed despite global badge failures!"


def test_stress_screen_with_only_failing_global_badges():
    """A screen with only failing global badges and no normal flow edges remains Untested."""
    inputs = [
        {"edge_type": "DEPENDS_ON", "edge_status": "Failed", "src_status": "Failed", "src_is_global": True},
        {"edge_type": "DEPENDS_ON", "edge_status": "Blocked", "src_status": "Blocked", "is_badge_attachment": True},
    ]
    res = compute_synthesized_status("Untested", inputs, is_global=False)
    assert res == "Untested"


def test_stress_global_badge_itself_uses_edge_status_only():
    """A global badge node evaluates solely based on edge_status, ignoring src_status."""
    inputs = [
        {"edge_type": "DEPENDS_ON", "edge_status": "Passed", "src_status": "Failed"},
        {"edge_type": "DEPENDS_ON", "edge_status": "Passed", "src_status": "Blocked"},
    ]
    res = compute_synthesized_status("Untested", inputs, is_global=True)
    assert res == "Passed"

    failing_inputs = [
        {"edge_type": "DEPENDS_ON", "edge_status": "Failed", "src_status": "Passed"},
    ]
    res_fail = compute_synthesized_status("Untested", failing_inputs, is_global=True)
    assert res_fail == "Blocked"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Direct Failed Preservation Across Upstream Lifecycle Stress Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_stress_direct_failed_preservation_lifecycle():
    """
    Directly marked Failed node:
    - Does NOT transition to Blocked when upstream gate fails or blocks
    - Does NOT transition to Untested when upstream gate recovers
    - Remains permanently Failed until tester directly modifies it
    """
    # 1. Pure function tests
    # Pre-condition: Node is Failed
    # Case A: Upstream gate fails
    assert compute_synthesized_status("Failed", [{"edge_type": "DEPENDS_ON", "src_status": "Failed"}]) == "Failed"
    # Case B: Upstream gate is blocked
    assert compute_synthesized_status("Failed", [{"edge_type": "DEPENDS_ON", "src_status": "Blocked"}]) == "Failed"
    # Case C: Upstream gate recovers to Passed
    assert compute_synthesized_status("Failed", [{"edge_type": "DEPENDS_ON", "src_status": "Passed"}]) == "Failed"

    # Counter-check: Automatically blocked node DOES recover to Untested
    assert compute_synthesized_status("Blocked", [{"edge_type": "DEPENDS_ON", "src_status": "Passed"}]) == "Untested"

    # 2. Graph lifecycle session test
    g = ReachabilityGraphSession()
    g.add_node("Gate", test_status="Untested")
    g.add_node("DefectNode", test_status="Failed")  # Directly marked Failed
    g.add_node("NormalNode", test_status="Untested")  # Untested node

    create_edge(g, EdgeCreate(source="Gate", target="DefectNode", type="Depends_On"))
    create_edge(g, EdgeCreate(source="Gate", target="NormalNode", type="Depends_On"))

    # Gate Fails:
    update_node(g, "Gate", NodeUpdate(test_status="Failed"))
    assert g.nodes["DefectNode"]["test_status"] == "Failed"  # Preserved!
    assert g.nodes["NormalNode"]["test_status"] == "Blocked"  # Auto blocked!

    # Gate Recovers to Passed:
    update_node(g, "Gate", NodeUpdate(test_status="Passed"))
    assert g.nodes["DefectNode"]["test_status"] == "Failed"  # Still Failed!
    assert g.nodes["NormalNode"]["test_status"] == "Untested"  # Auto unblocked!


def test_stress_component_with_tests_rollup_and_gate_dependency():
    """
    Component with:
    - Incoming Tests from TC1 (Passed)
    - Incoming Depends_On from Gate (Failed -> Blocked -> Passed)
    """
    # Gate is Failed -> Component is Blocked
    res_blocked = compute_synthesized_status("Untested", [
        {"edge_type": "TESTS", "src_status": "Passed"},
        {"edge_type": "DEPENDS_ON", "src_status": "Failed"},
    ])
    assert res_blocked == "Blocked"

    # Gate recovers to Passed -> Component becomes Passed because Tests is Passed!
    res_passed = compute_synthesized_status("Blocked", [
        {"edge_type": "TESTS", "src_status": "Passed"},
        {"edge_type": "DEPENDS_ON", "src_status": "Passed"},
    ])
    assert res_passed == "Passed"

    # But if TC1 itself was Failed, Component stays Failed regardless of gate
    res_defect = compute_synthesized_status("Failed", [
        {"edge_type": "TESTS", "src_status": "Failed"},
        {"edge_type": "DEPENDS_ON", "src_status": "Failed"},
    ])
    assert res_defect == "Failed"


# ─────────────────────────────────────────────────────────────────────────────
# 6. Property Overwrite Prevention & Schema Sanitization Stress Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_stress_reserved_properties_sanitization_matrix():
    """Verify all RESERVED_NODE_PROPERTIES and RESERVED_EDGE_PROPERTIES are stripped."""
    polluted_node_props = {k: f"malicious_{k}" for k in RESERVED_NODE_PROPERTIES}
    polluted_node_props["legitimate_custom_prop"] = "safe_value"

    sanitized_node = sanitize_node_properties(polluted_node_props)
    for k in RESERVED_NODE_PROPERTIES:
        assert k not in sanitized_node
    assert sanitized_node["legitimate_custom_prop"] == "safe_value"

    polluted_edge_props = {k: f"malicious_{k}" for k in RESERVED_EDGE_PROPERTIES}
    polluted_edge_props["weight"] = 1

    sanitized_edge = sanitize_edge_properties(polluted_edge_props)
    for k in RESERVED_EDGE_PROPERTIES:
        assert k not in sanitized_edge
    assert sanitized_edge["weight"] == 1


def test_stress_details_and_api_endpoints_sanitization():
    """Verify get_node_full_details and API endpoints sanitize reserved properties."""
    from graph_service import get_node_full_details
    from database import get_db

    # 1. Test get_node_full_details sanitizes node and edge properties
    mock_session = Mock()
    mock_find_result = Mock()
    polluted_props = {k: f"leak_{k}" for k in RESERVED_NODE_PROPERTIES}
    polluted_props["tags"] = "#Common"
    polluted_props["description"] = "Safe description"
    mock_find_result.single.return_value = {
        "id": "node_1",
        "name": "Node1",
        "label": "Screen",
        "aliases": ["N1"],
        "test_status": "Passed",
        "properties": dict(polluted_props),
    }
    in_edges = [{
        "id": "e_in",
        "type": "Transition",
        "test_status": "Passed",
        "action": "click",
        "properties": {"action": "click", "test_status": "Passed", "custom_edge_prop": 42},
        "source_id": "s1",
        "source_name": "Source1",
        "source_label": "Screen",
        "source_status": "Passed",
    }]
    out_edges = [{
        "id": "e_out",
        "type": "Return",
        "test_status": "Passed",
        "action": "back",
        "properties": {"action": "back", "type": "Return", "weight": 0},
        "target_id": "t1",
        "target_name": "Target1",
        "target_label": "Screen",
        "target_status": "Passed",
    }]
    mock_session.run.side_effect = [mock_find_result, in_edges, out_edges]

    details = get_node_full_details(mock_session, "Node1")
    assert details is not None
    # None of RESERVED_NODE_PROPERTIES should be in details["properties"]
    for k in RESERVED_NODE_PROPERTIES:
        assert k not in details["properties"]
    assert details["properties"]["tags"] == "#Common"

    # None of RESERVED_EDGE_PROPERTIES should be in details["incoming_edges"][0]["properties"]
    for k in RESERVED_EDGE_PROPERTIES:
        assert k not in details["incoming_edges"][0]["properties"]
    assert details["incoming_edges"][0]["properties"]["custom_edge_prop"] == 42

    for k in RESERVED_EDGE_PROPERTIES:
        assert k not in details["outgoing_edges"][0]["properties"]
    assert details["outgoing_edges"][0]["properties"]["weight"] == 0

    # 2. Test GET /api/nodes/{id} and GET /api/globals via TestClient
    client = TestClient(app)
    mock_api_session = Mock()
    mock_single_node = Mock()
    mock_single_node.data.return_value = {
        "id": "node_1",
        "type": "Component",
        "label": "Component",
        "name": "Node1",
        "aliases": ["N1"],
        "test_status": "Passed",
        "is_manual_override": True,
        "override_reason": "Spec changed",
        "properties": dict(polluted_props),
    }
    mock_run_res = Mock()
    mock_run_res.single.return_value = mock_single_node
    mock_run_res.data.return_value = [mock_single_node.data.return_value]
    mock_api_session.run.return_value = mock_run_res

    app.dependency_overrides[get_db] = lambda: mock_api_session
    try:
        resp_node = client.get("/api/nodes/node_1")
        assert resp_node.status_code == 200
        data_node = resp_node.json()
        assert data_node["is_manual_override"] is True
        assert data_node["override_reason"] == "Spec changed"
        for k in RESERVED_NODE_PROPERTIES:
            assert k not in data_node["properties"]
        assert data_node["properties"]["tags"] == "#Common"

        resp_globals = client.get("/api/globals")
        assert resp_globals.status_code == 200
        data_globals = resp_globals.json()
        assert len(data_globals) == 1
        for k in RESERVED_NODE_PROPERTIES:
            assert k not in data_globals[0]["properties"]
        assert data_globals[0]["properties"]["tags"] == "#Common"
    finally:
        app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────────────────────
# 7. Security Dev Gate & Preset Traversal Stress Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_stress_preset_path_traversal_payload_matrix():
    """Matrix of directory traversal payloads must all raise HTTPException(400)."""
    malicious_payloads = [
        "../secret",
        "..\\secret",
        "..",
        "/etc/passwd",
        "\\windows\\system32",
        "nested/../../secret",
        "preset\0.json",
        "test%2f..%2fsecret",
        "foo bar",
        "",
        "   ",
    ]

    for payload in malicious_payloads:
        with pytest.raises(HTTPException) as exc:
            preset_service.get_preset(payload)
        assert exc.value.status_code == 400


def test_stress_security_dev_reset_gate(monkeypatch):
    """Dev reset endpoint must reject with 403 on all non-enabled values."""
    client = TestClient(app)

    # Disabled / Missing values
    for val in [None, "", "false", "0", "no", "disabled", "OFF"]:
        if val is None:
            monkeypatch.delenv("ENABLE_DEV_ENDPOINTS", raising=False)
        else:
            monkeypatch.setenv("ENABLE_DEV_ENDPOINTS", val)

        res = client.post("/api/dev/reset-seed")
        assert res.status_code == 403, f"Expected 403 for ENABLE_DEV_ENDPOINTS='{val}', got {res.status_code}"
