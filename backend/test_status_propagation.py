"""
TestCase 모델링 & 4단계 상태 전파 규격 검증 (docs/TESTCASE_MODELING_AND_STATE_PROPAGATION.md 3.3 / 3.4 / 4.2 / 6)

1) 순수 함수(compute_synthesized_status / checklist_status / 직렬화 헬퍼) 단위 테스트
2) 인메모리 FakeGraphSession으로 update_node → 하류 연쇄 전파 시나리오(스펙 6장 E2E 시나리오의 백엔드 버전) 검증
"""
import json
from unittest.mock import MagicMock

from graph_service import (
    compute_synthesized_status, checklist_status,
    serialize_props_for_neo4j, deserialize_props_from_neo4j,
    update_node, create_edge,
)
from models import NodeUpdate, EdgeCreate
from conftest import RECALC_QUERY_MARKER


def _in(edge_type, edge_status="Untested", src_status="Untested"):
    return {"edge_type": edge_type, "edge_status": edge_status, "src_status": src_status}


# ─── 1. 순수 함수 ────────────────────────────────────────────────

def test_depends_on_failed_source_blocks_target():
    assert compute_synthesized_status("Untested", [_in("DEPENDS_ON", src_status="Failed")]) == "Blocked"
    assert compute_synthesized_status("Passed", [_in("DEPENDS_ON", src_status="Blocked")]) == "Blocked"


def test_depends_on_recovery_unblocks_but_keeps_own_result():
    # 선행 복구 시 자동 차단만 해제(Untested)하고, 테스터가 직접 마킹한 결과는 보존합니다.
    assert compute_synthesized_status("Blocked", [_in("DEPENDS_ON", src_status="Passed")]) == "Untested"
    assert compute_synthesized_status("Failed", [_in("DEPENDS_ON", src_status="Passed")]) == "Failed"
    # 선행 노드가 Passed라고 후행 TC가 자동으로 Passed가 되지는 않습니다.
    assert compute_synthesized_status("Untested", [_in("DEPENDS_ON", src_status="Passed")]) == "Untested"


def test_tests_rollup():
    both_passed = [_in("TESTS", src_status="Passed"), _in("TESTS", src_status="Passed")]
    assert compute_synthesized_status("Untested", both_passed) == "Passed"
    partial = [_in("TESTS", src_status="Passed"), _in("TESTS", src_status="Untested")]
    assert compute_synthesized_status("Untested", partial) == "Untested"
    one_failed = [_in("TESTS", src_status="Failed"), _in("TESTS", src_status="Blocked")]
    assert compute_synthesized_status("Untested", one_failed) == "Failed"
    one_blocked = [_in("TESTS", src_status="Passed"), _in("TESTS", src_status="Blocked")]
    assert compute_synthesized_status("Untested", one_blocked) == "Blocked"


def test_return_edges_are_excluded():
    # 복귀선(Return)은 가중치 0: Failed여도 복귀 대상 화면으로 결함이 역류하지 않습니다.
    inputs = [_in("TRANSITION", edge_status="Passed"), _in("RETURN", edge_status="Failed", src_status="Failed")]
    assert compute_synthesized_status("Untested", inputs) == "Passed"
    assert compute_synthesized_status("Untested", [_in("RETURN", edge_status="Failed")]) == "Untested"


def test_legacy_flow_edge_rule_preserved():
    assert compute_synthesized_status("Untested", []) == "Untested"
    assert compute_synthesized_status("Untested", [_in("TRANSITION", edge_status="Failed")]) == "Blocked"
    assert compute_synthesized_status("Untested", [_in("TRANSITION", edge_status="Passed")]) == "Passed"
    # 흐름 엣지는 출발 노드 상태가 아니라 엣지 상태로만 판정합니다.
    assert compute_synthesized_status("Untested", [_in("TRANSITION", edge_status="Untested", src_status="Failed")]) == "Untested"


def test_global_badge_node_uses_edge_status_only():
    # 배지 엣지(노드 → 전역 노드)는 Depends_On이지만 방향이 반대라, 출발 노드 상태로 전역 노드를 차단하지 않습니다.
    assert compute_synthesized_status("Untested", [_in("DEPENDS_ON", src_status="Failed")], is_global=True) == "Untested"
    assert compute_synthesized_status("Untested", [_in("DEPENDS_ON", edge_status="Failed")], is_global=True) == "Blocked"


def test_checklist_status_rules():
    assert checklist_status(None) is None
    assert checklist_status([]) is None
    assert checklist_status([{"status": "Passed"}, {"status": "Passed"}]) == "Passed"
    assert checklist_status([{"status": "Passed"}, {"status": "Untested"}]) == "Untested"
    assert checklist_status([{"status": "Blocked"}, {"status": "Passed"}]) == "Blocked"
    assert checklist_status([{"status": "Blocked"}, {"status": "Failed"}]) == "Failed"


def test_checklist_drives_node_status():
    cl_fail = [{"id": "chk_1", "text": "a", "status": "Failed"}]
    cl_pass = [{"id": "chk_1", "text": "a", "status": "Passed"}]
    assert compute_synthesized_status("Untested", [], checklist=cl_fail) == "Failed"
    assert compute_synthesized_status("Untested", [], checklist=cl_pass) == "Passed"
    # 진입 엣지가 모두 Passed여도 체크리스트(가구)가 미완이면 Passed가 아닙니다.
    cl_partial = [{"status": "Passed"}, {"status": "Untested"}]
    assert compute_synthesized_status("Untested", [_in("TRANSITION", edge_status="Passed")], checklist=cl_partial) == "Untested"


def test_checklist_json_roundtrip():
    checklist = [{"id": "chk_1", "text": "클라이언트 버전 노출", "status": "Passed"}]
    stored = serialize_props_for_neo4j({"checklist": checklist, "status": "active", "tags": ["a", "b"]})
    assert isinstance(stored["checklist"], str)
    assert stored["status"] == "active"
    assert stored["tags"] == ["a", "b"]  # 원시값 배열은 그대로 저장
    restored = deserialize_props_from_neo4j(dict(stored))
    assert restored["checklist"] == checklist
    # 빈 체크리스트도 문자열로 저장 → 다시 빈 배열로 복원
    assert deserialize_props_from_neo4j(serialize_props_for_neo4j({"checklist": []}))["checklist"] == []


# ─── 2. 인메모리 그래프로 연쇄 전파 시나리오 검증 ───────────────────

class FakeGraphSession:
    """graph_service가 상태 전파에 쓰는 Cypher 몇 가지만 해석하는 최소 인메모리 세션."""

    def __init__(self):
        self.nodes = {}   # id -> props
        self.edges = []   # (id, src, tgt, TYPE, props)

    def add_node(self, nid, **props):
        self.nodes[nid] = {"test_status": "Untested", **props}

    def add_edge(self, src, tgt, etype, status="Untested"):
        self.edges.append((f"e{len(self.edges)}", src, tgt, etype.upper(), {"test_status": status}))

    def _result(self, single=None, rows=None):
        r = MagicMock()
        r.single.return_value = single
        r.__iter__.return_value = iter(rows or [])
        return r

    def run(self, query, **kw):
        if RECALC_QUERY_MARKER in query:
            t = self.nodes.get(kw["target_id"])
            if t is None:
                return self._result(None)
            inputs = [
                {"edge_type": et, "edge_status": ep.get("test_status", "Untested"),
                 "src_status": self.nodes[s].get("test_status", "Untested")}
                for _, s, tg, et, ep in self.edges if tg == kw["target_id"] and et != "RETURN"
            ]
            return self._result({
                "current_status": t.get("test_status"), "is_override": t.get("is_manual_override"),
                "is_global": t.get("is_global"), "checklist": t.get("checklist"), "inputs": inputs,
            })
        if "SET target.test_status = $new_status" in query:
            self.nodes[kw["target_id"]]["test_status"] = kw["new_status"]
            return self._result(None)
        if "IN $dep_types" in query:
            rows = sorted({tg for _, s, tg, et, _ in self.edges if s == kw["id"] and et in kw["dep_types"]})
            return self._result(rows=[{"next_id": r} for r in rows])
        if query.strip().startswith("MATCH (n) WHERE elementId(n) = $id") and "SET" in query:
            n = self.nodes[kw["id"]]
            for key in ("test_status", "is_manual_override", "override_reason", "name"):
                if key in kw:
                    n[key] = kw[key]
            n.update(kw.get("properties") or {})
            return self._result(None)
        if "CREATE (source)-[r:" in query:
            etype = query.split("[r:`")[1].split("`")[0]
            self.add_edge(kw["source_id"], kw["target_id"], etype, kw.get("test_status", "Untested"))
            return self._result({"id": self.edges[-1][0]})
        raise AssertionError(f"unexpected query: {query}")


def _spec_graph():
    # 스펙 1.1 예시: TC1 --Depends_On--> TC2, TC1/TC2 --Tests--> Component(클라이언트 버전)
    g = FakeGraphSession()
    g.add_node("tc1")
    g.add_node("tc2")
    g.add_node("comp")
    g.add_edge("tc1", "tc2", "Depends_On")
    g.add_edge("tc1", "comp", "Tests")
    g.add_edge("tc2", "comp", "Tests")
    return g


def test_scenario_tc1_failed_blocks_tc2_and_fails_component():
    g = _spec_graph()
    update_node(g, "tc1", NodeUpdate(test_status="Failed"))
    assert g.nodes["tc2"]["test_status"] == "Blocked"
    assert g.nodes["comp"]["test_status"] == "Failed"


def test_scenario_recovery_and_component_rollup():
    g = _spec_graph()
    update_node(g, "tc1", NodeUpdate(test_status="Failed"))
    # TC1 복구 → TC2 차단 해제(Untested), 컴포넌트는 아직 Untested
    update_node(g, "tc1", NodeUpdate(test_status="Passed"))
    assert g.nodes["tc2"]["test_status"] == "Untested"
    assert g.nodes["comp"]["test_status"] == "Untested"
    # TC2까지 Passed → 컴포넌트 자동 Passed 승격
    update_node(g, "tc2", NodeUpdate(test_status="Passed"))
    assert g.nodes["comp"]["test_status"] == "Passed"


def test_manual_blocked_override_is_preserved():
    g = _spec_graph()
    # TC2를 외부 요인으로 수동 차단(📌) → 이후 TC1이 Passed여도 덮어쓰지 않음
    update_node(g, "tc2", NodeUpdate(test_status="Blocked", is_manual_override=True, override_reason="빌드 미배포"))
    update_node(g, "tc1", NodeUpdate(test_status="Passed"))
    assert g.nodes["tc2"]["test_status"] == "Blocked"
    assert g.nodes["tc2"]["override_reason"] == "빌드 미배포"
    # 수동 차단 TC는 컴포넌트 롤업에 Blocked로 반영
    assert g.nodes["comp"]["test_status"] == "Blocked"


def test_return_edge_cycle_does_not_deadlock():
    # 로비 ⇄ 상점: 진입은 Transition, 복귀는 Return. Return은 상태 계산에서 제외되어 무한 차단이 없어야 합니다.
    g = FakeGraphSession()
    g.add_node("lobby")
    g.add_node("shop")
    g.add_edge("lobby", "shop", "Transition", status="Passed")
    g.add_edge("shop", "lobby", "Return", status="Failed")
    create_edge(g, EdgeCreate(source="shop", target="lobby", type="Return", test_status="Failed"))
    assert g.nodes["lobby"]["test_status"] == "Untested"


def test_checklist_update_recalculates_own_status():
    g = FakeGraphSession()
    g.add_node("comp")
    checklist = [{"id": "chk_1", "text": "a", "status": "Passed"}, {"id": "chk_2", "text": "b", "status": "Failed"}]
    update_node(g, "comp", NodeUpdate(properties={"checklist": checklist}))
    assert json.loads(g.nodes["comp"]["checklist"]) == checklist
    assert g.nodes["comp"]["test_status"] == "Failed"


def test_audit_cross_cutting_counts_internal_checklist():
    from graph_service import audit_cross_cutting

    session = MagicMock()
    checklist_json = json.dumps([{"id": "chk_1", "text": "다국어(i18n) 텍스트 잘림 확인", "status": "Passed"}], ensure_ascii=False)

    def _run(query, **kw):
        if "RETURN elementId(n) AS id, labels(n)[0] AS label" in query:
            return [
                {"id": "n1", "label": "Screen", "name": "로그인 화면", "aliases": [], "checklist": checklist_json},
                {"id": "n2", "label": "Screen", "name": "상점 화면", "aliases": [], "checklist": None},
            ]
        return []

    session.run.side_effect = _run
    res = audit_cross_cutting(session, "i18n")
    assert res.total_screens_features == 2
    assert [n["id"] for n in res.covered_nodes] == ["n1"]
    assert [n["id"] for n in res.missing_nodes] == ["n2"]
    assert res.coverage_rate == 50.0


def test_get_next_test_targets_respects_depends_on_and_ignores_return():
    from graph_service import get_next_test_targets

    session = MagicMock()
    captured_queries = []

    def _run(query, **kw):
        captured_queries.append(query)
        return [
            # TC2: 선행 TC1(Depends_On)이 Passed이고 Return 엣지는 쿼리에서 제외됨 -> 즉시 테스트 가능
            {"id": "tc2", "label": "TestCase", "name": "TC2 버전 일치 확인", "clean_edges": [{"status": "Passed", "src_name": "TC1"}]},
            # TC3: 선행 TC2가 아직 Untested -> 대기
            {"id": "tc3", "label": "TestCase", "name": "TC3 후속 검증", "clean_edges": [{"status": "Untested", "src_name": "TC2"}]},
        ]

    session.run.side_effect = _run
    targets = get_next_test_targets(session)
    assert any("toUpper(type(r)) <> 'RETURN'" in q for q in captured_queries)
    assert any("DEPENDS_ON" in q for q in captured_queries)
    assert targets[0].id == "tc2" and targets[0].incoming_requirements_met is True
    assert targets[1].id == "tc3" and targets[1].incoming_requirements_met is False

