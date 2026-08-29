"""Tests for API contract versioning (section 12)."""

from fastapi.testclient import TestClient

from backend.app import app
from backend.models.api_contract import API_CONTRACT_VERSION, LEGACY_SUNSET

client = TestClient(app)


def test_v1_version_endpoint():
    response = client.get("/api/v1/version")
    assert response.status_code == 200
    body = response.json()
    assert body["api_version"] == API_CONTRACT_VERSION
    assert body["contract_version"] == API_CONTRACT_VERSION
    assert body["legacy_sunset"] == LEGACY_SUNSET
    assert "POST /api/v1/parse-sql" in body["endpoints"]


def test_v1_parse_sql_contract():
    response = client.post(
        "/api/v1/parse-sql",
        json={"sql": "SELECT id FROM users", "dialect": "bigquery"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == API_CONTRACT_VERSION
    assert isinstance(body["warnings"], list)
    assert body["stats"]["node_count"] == len(body["nodes"])
    assert body["stats"]["edge_count"] == len(body["edges"])
    assert body["stats"]["parse_ms"] >= 0
    users = next(n for n in body["nodes"] if n["id"] == "users")
    assert users["data"]["kind"] == "physical_table"
    assert "edge_type" in body["edges"][0]
    assert "metadata" in body["nodes"][0]["data"]


def test_legacy_parse_sql_has_deprecation_headers():
    response = client.post(
        "/api/parse-sql",
        json={"sql": "SELECT id FROM users", "dialect": "bigquery"},
    )
    assert response.status_code == 200
    assert response.headers.get("Deprecation") == "true"
    assert response.headers.get("Sunset") == LEGACY_SUNSET
    assert "/api/v1/parse-sql" in response.headers.get("Link", "")


def test_v1_dialects_endpoint():
    response = client.get("/api/v1/dialects")
    assert response.status_code == 200
    ids = {d["id"] for d in response.json()}
    assert "bigquery" in ids


def test_v1_parse_sql_with_join():
    response = client.post(
        "/api/v1/parse-sql",
        json={
            "sql": "SELECT u.id FROM users u JOIN orders o ON u.id = o.user_id",
            "dialect": "bigquery",
        },
    )
    assert response.status_code == 200
    body = response.json()
    kinds = {n["data"]["kind"] for n in body["nodes"]}
    assert "join" in kinds

    users = next(n for n in body["nodes"] if n["id"] == "users")
    orders = next(n for n in body["nodes"] if n["id"] == "orders")
    assert users["data"]["alias"] == "u"
    assert orders["data"]["alias"] == "o"

    join = next(n for n in body["nodes"] if n["data"]["kind"] == "join")
    operands = join["data"]["join_operands"]
    assert len(operands) == 2
    assert operands[0]["label"] == "u (users)"
    assert operands[1]["label"] == "o (orders)"


def test_cors_allows_vite_dev_origin():
    response = client.post(
        "/api/v1/parse-sql",
        json={"sql": "SELECT 1", "dialect": "bigquery"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_legacy_dialects_has_deprecation_headers():
    response = client.get("/api/dialects")
    assert response.status_code == 200
    assert response.headers.get("Deprecation") == "true"
    assert "/api/v1/dialects" in response.headers.get("Link", "")
