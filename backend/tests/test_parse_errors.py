"""Tests for structured parse error responses."""

import pytest
from fastapi.testclient import TestClient

import sqlglot
from backend.app import app
from backend.services.parse_errors import format_parse_error

client = TestClient(app)

HAVING_WHERE_SQL = """
SELECT x FROM t
GROUP BY x
HAVING COUNT(*) >= 2 where
   AND AVG(x) > 50000
QUALIFY ROW_NUMBER() OVER (ORDER BY x) <= 10
"""


def test_format_parse_error_includes_line_column():
    try:
        sqlglot.parse_one("SELECT FROM", read="bigquery")
    except sqlglot.errors.ParseError as e:
        payload = format_parse_error(e, sql="SELECT FROM")
        assert payload["error"] == "parse_error"
        assert payload["errors"][0]["line"] == 1
        assert payload["errors"][0]["column"] == 11
        assert payload["errors"][0]["context_lines"]
        assert payload["guidance"]
        return
    pytest.fail("expected ParseError")


def test_humanize_and_context_for_qualify_error():
    try:
        sqlglot.parse_one(HAVING_WHERE_SQL, read="bigquery")
    except sqlglot.errors.ParseError as e:
        payload = format_parse_error(e, sql=HAVING_WHERE_SQL)
        err = payload["errors"][0]
        assert "Invalid or incomplete syntax before QUALIFY" in err["message"]
        assert "Required keyword" in err["technical_message"]
        assert err["line"] == 6
        assert any(row["is_error_line"] for row in err["context_lines"])
        return
    pytest.fail("expected ParseError")


def test_parse_sql_api_returns_structured_error():
    response = client.post(
        "/api/parse-sql",
        json={"sql": "SELECT FROM", "dialect": "bigquery"},
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["error"] == "parse_error"
    assert detail["guidance"]
    assert len(detail["errors"]) >= 1
    assert detail["errors"][0]["line"] == 1
