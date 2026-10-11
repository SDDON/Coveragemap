"""
백엔드 pytest 공통 설정.

- test_e2e.py / test_e2e_edge.py는 import 시점에 Playwright 브라우저를 띄우는 수동 실행용 스크립트라
  pytest 수집 시 전체 실행이 깨집니다. (grill-me Q6: 파일은 보존) → 수집에서만 제외합니다.
- make_recalc_aware_session(): 엣지 CRUD 후 호출되는 상태 재합성(_recalc_target_node_status) 쿼리에
  실제와 같은 형태의 레코드를 돌려주는 Mock 세션을 만듭니다.
"""
from unittest.mock import Mock, MagicMock

collect_ignore = ["test_e2e.py", "test_e2e_edge.py"]

# 상태 재합성 쿼리 식별용 조각 (graph_service._recalc_target_node_status)
# 2026-10: TestCase 연쇄 전파 스펙 반영으로 출발 노드(src) 상태까지 수집하도록 쿼리가 바뀌었습니다.
RECALC_QUERY_MARKER = "OPTIONAL MATCH (src)-[in_r]->(target)"


def make_recalc_aware_session(primary_record):
    """
    primary_record: 엣지 생성/수정/삭제 쿼리의 .single() 결과.
    재합성 쿼리에는 '들어오는 엣지 없음 + 현재 Untested + 오버라이드 없음' 레코드를 돌려주어,
    상태 변화/하류 전파가 일어나지 않게 합니다. (run 호출 수 = 본 쿼리 1 + 재합성 1)
    그 외 쿼리(하류 전파 조회 등)는 빈 결과로 순회됩니다. (MagicMock 기본 __iter__ = 빈 이터레이터)
    """
    session = Mock()

    def _run(query, *args, **kwargs):
        result = MagicMock()
        if RECALC_QUERY_MARKER in query:
            result.single.return_value = {
                "current_status": "Untested",
                "is_override": None,
                "is_global": None,
                "checklist": None,
                "inputs": [],
            }
        else:
            result.single.return_value = primary_record
        return result

    session.run.side_effect = _run
    return session
