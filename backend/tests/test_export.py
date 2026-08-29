"""Tests for export format conversions and API routes."""

from fastapi.testclient import TestClient

from backend.app import app
from backend.services.export_formats import lineage_to_csv, lineage_to_openlineage
from backend.services.lineage_parser import parse_sql_to_lineage

client = TestClient(app)

SIMPLE_SQL = "SELECT u.id FROM users u JOIN orders o ON u.id = o.user_id"


def test_lineage_to_openlineage():
    lineage = parse_sql_to_lineage(SIMPLE_SQL, "bigquery")
    event = lineage_to_openlineage(lineage, SIMPLE_SQL, "bigquery")
    assert event["eventType"] == "COMPLETE"
    assert event["schemaURL"].startswith("https://openlineage.io/")
    assert any(d["name"] == "users" for d in event["inputs"])
    assert event["facets"]["sql"]["query"] == SIMPLE_SQL


def test_lineage_to_csv():
    lineage = parse_sql_to_lineage("SELECT id FROM users", "bigquery")
    csv_text = lineage_to_csv(lineage)
    assert "record_type" in csv_text.splitlines()[0]
    assert "node" in csv_text
    assert "edge" in csv_text
    assert "users" in csv_text


def test_export_openlineage_endpoint():
    response = client.post(
        "/api/v1/export/openlineage",
        json={"sql": SIMPLE_SQL, "dialect": "bigquery"},
    )
    assert response.status_code == 200
    assert response.json()["eventType"] == "COMPLETE"


def test_export_csv_endpoint():
    response = client.post(
        "/api/v1/export/csv",
        json={"sql": "SELECT id FROM users", "dialect": "bigquery"},
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    assert "users" in response.text


def test_lineage_alias_endpoint():
    response = client.post(
        "/api/v1/lineage",
        json={"sql": "SELECT id FROM users", "dialect": "bigquery"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "1.0"
    assert body["stats"]["node_count"] >= 1
