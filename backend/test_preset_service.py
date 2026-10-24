"""
프리셋 서비스 경로 순회(Path Traversal) 방어 및 정상 조회 검증 (GAP-7)
"""
import pytest
from fastapi import HTTPException
from unittest.mock import Mock
from preset_service import get_preset, load_preset_to_neo4j, _resolve_preset_path


def test_get_preset_path_traversal_payloads_raise_400():
    """상위 디렉터리 이동(..), 슬래시(/), 역슬래시(\\), 널바이트 등 악의적 ID에 대해 HTTP 400을 반환해야 합니다."""
    malicious_ids = [
        "../outside",
        "..\\windows\\win.ini",
        "../../etc/passwd",
        "/etc/shadow",
        "C:\\boot.ini",
        "sub/dir/preset",
        "preset\\..\\escape",
        "preset\0null",
        "",
        "   ",
        "invalid;id",
        "invalid id with space",
    ]
    for pid in malicious_ids:
        with pytest.raises(HTTPException) as exc_info:
            get_preset(pid)
        assert exc_info.value.status_code == 400, f"Expected 400 for payload: {pid!r}, got {exc_info.value.status_code}"


def test_get_preset_non_existent_valid_id_raises_404():
    """안전한 형식이지만 존재하지 않는 프리셋 ID는 HTTP 400이 아닌 404 Not Found를 반환해야 합니다."""
    with pytest.raises(HTTPException) as exc_info:
        get_preset("non_existent_preset_99999_valid_name")
    assert exc_info.value.status_code == 404


def test_get_preset_valid_existing_success():
    """기존 존재하는 프리셋(minimal_e2e 등)을 확장자 유무와 관계없이 정상 조회해야 합니다."""
    res1 = get_preset("minimal_e2e")
    assert "nodes" in res1
    assert "edges" in res1

    res2 = get_preset("minimal_e2e.json")
    assert res2 == res1


def test_load_preset_traversal_rejected():
    """load_preset_to_neo4j 역시 get_preset을 경유하므로 경로 탐색 시 HTTP 400으로 즉시 차단되어야 합니다."""
    mock_session = Mock()
    with pytest.raises(HTTPException) as exc_info:
        load_preset_to_neo4j(mock_session, "../../secret")
    assert exc_info.value.status_code == 400
