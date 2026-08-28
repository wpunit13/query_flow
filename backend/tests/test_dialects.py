"""Tests for dialect listing, validation, and detection."""

from fastapi.testclient import TestClient

from backend.app import app
from backend.services.dialects import detect_dialect, validate_dialect

client = TestClient(app)


def test_list_dialects():
    response = client.get("/api/dialects")
    assert response.status_code == 200
    ids = {d["id"] for d in response.json()}
    assert "bigquery" in ids
    assert "snowflake" in ids
    assert "postgres" in ids


def test_validate_dialect_rejects_unknown():
    try:
        validate_dialect("oracle")
        assert False, "expected ValueError"
    except ValueError as e:
        assert "Unsupported" in str(e)


def test_detect_dialect_qualify():
    result = detect_dialect("SELECT * FROM t QUALIFY rn = 1")
    assert result["dialect"] in ("bigquery", "snowflake")
    assert result["signals"]


def test_detect_dialect_endpoint():
    response = client.post(
        "/api/detect-dialect",
        json={"sql": "SELECT x::int FROM t"},
    )
    assert response.status_code == 200
    assert response.json()["dialect"] == "postgres"


def test_parse_sql_invalid_dialect():
    response = client.post(
        "/api/parse-sql",
        json={"sql": "SELECT 1", "dialect": "invalid_db"},
    )
    assert response.status_code == 400
    assert "Unsupported" in response.json()["detail"]


def test_parse_sql_postgres():
    response = client.post(
        "/api/parse-sql",
        json={"sql": "SELECT id FROM users", "dialect": "postgres"},
    )
    assert response.status_code == 200
    assert len(response.json()["nodes"]) >= 1
