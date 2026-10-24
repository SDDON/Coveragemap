"""
개발용 엔드포인트 게이팅(ENABLE_DEV_ENDPOINTS) 및 CORS/바인딩 보안 검증 (GAP-8)
"""
import os
import pytest
from unittest.mock import patch, Mock
from fastapi.testclient import TestClient
from main import app
from database import get_db

client = TestClient(app)


def test_dev_reset_seed_forbidden_when_env_not_set():
    """ENABLE_DEV_ENDPOINTS가 설정되지 않은 기본 상태에서는 POST /api/dev/reset-seed 호출 시 HTTP 403 Forbidden을 반환해야 합니다."""
    with patch.dict(os.environ, {}, clear=True):
        response = client.post("/api/dev/reset-seed")
        assert response.status_code == 403
        assert "Development endpoints are disabled" in response.json()["detail"]


def test_dev_reset_seed_forbidden_when_false():
    """ENABLE_DEV_ENDPOINTS가 'false', '0', '' 등으로 비활성화된 경우 HTTP 403 Forbidden을 반환해야 합니다."""
    for false_val in ["false", "0", "no", "DISABLED", ""]:
        with patch.dict(os.environ, {"ENABLE_DEV_ENDPOINTS": false_val}):
            response = client.post("/api/dev/reset-seed")
            assert response.status_code == 403, f"Expected 403 for {false_val!r}"


def test_dev_reset_seed_allowed_when_enabled():
    """ENABLE_DEV_ENDPOINTS='1' 또는 'true'로 설정된 경우 접근이 허용되고 seed 스크립트를 실행해야 합니다."""
    mock_session = Mock()
    mock_record = {"total": 0, "seed_marker": 0}
    mock_session.run.return_value.single.return_value = mock_record

    app.dependency_overrides[get_db] = lambda: mock_session

    try:
        with patch.dict(os.environ, {"ENABLE_DEV_ENDPOINTS": "1"}):
            with patch("subprocess.run") as mock_subproc:
                response = client.post("/api/dev/reset-seed")
                assert response.status_code == 200
                assert response.json()["status"] == "success"
                assert mock_subproc.called
    finally:
        app.dependency_overrides.clear()
