"""Supported SQL dialects and optional auto-detection heuristics."""

from typing import Any, Dict, List

# UI-facing dialect catalog (sqlglot read= id must match)
DIALECT_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "bigquery",
        "label": "BigQuery",
        "limitations": "QUALIFY, nested structs, and some GoogleSQL functions; LATERAL joins are normalized before parse.",
    },
    {
        "id": "snowflake",
        "label": "Snowflake",
        "limitations": "Semi-structured (VARIANT) references may be incomplete; stages and pipes not modeled.",
    },
    {
        "id": "postgres",
        "label": "PostgreSQL",
        "limitations": "PL/pgSQL blocks and custom types may parse partially.",
    },
    {
        "id": "spark",
        "label": "Spark",
        "limitations": "Spark-specific DDL and Delta paths may not appear in lineage.",
    },
    {
        "id": "redshift",
        "label": "Redshift",
        "limitations": "DISTKEY/SORTKEY and Redshift-only syntax may be ignored in graph.",
    },
    {
        "id": "duckdb",
        "label": "DuckDB",
        "limitations": "File-backed table functions may not resolve to physical tables.",
    },
]

SUPPORTED_DIALECT_IDS = {d["id"] for d in DIALECT_CATALOG}


def validate_dialect(dialect: str) -> str:
    """Return normalized dialect id or raise ValueError."""
    normalized = dialect.strip().lower()
    if normalized not in SUPPORTED_DIALECT_IDS:
        supported = ", ".join(sorted(SUPPORTED_DIALECT_IDS))
        raise ValueError(f"Unsupported dialect '{dialect}'. Supported: {supported}")
    return normalized


def list_dialects() -> List[Dict[str, Any]]:
    return list(DIALECT_CATALOG)


def detect_dialect(sql: str) -> Dict[str, Any]:
    """
    Heuristic dialect guess from SQL text. Signals are explanatory, not prescriptive.
    Returns best match, score, and matched signals for UI transparency.
    """
    if not sql or not sql.strip():
        return {
            "dialect": "bigquery",
            "confidence": "low",
            "signals": [],
            "alternatives": [],
        }

    upper = sql.upper()
    scores: Dict[str, int] = {d["id"]: 0 for d in DIALECT_CATALOG}
    signals: List[Dict[str, str]] = []

    def add(dialect_id: str, points: int, reason: str) -> None:
        scores[dialect_id] += points
        signals.append({"dialect": dialect_id, "reason": reason})

    if "QUALIFY " in upper:
        add("bigquery", 2, "QUALIFY clause")
        add("snowflake", 2, "QUALIFY clause")

    if "ARRAY[" in upper or "STRUCT<" in upper:
        add("bigquery", 2, "ARRAY or STRUCT type syntax")

    if "DATEADD(" in upper or "DATE_TRUNC(" in upper:
        add("snowflake", 2, "Snowflake-style date function")

    if "::" in sql and not sql.strip().startswith("http"):
        add("postgres", 2, ":: cast operator")
        add("redshift", 1, ":: cast operator (Redshift/Postgres family)")

    if "GENERATE_SERIES(" in upper:
        add("postgres", 3, "GENERATE_SERIES function")

    if "LATERAL VIEW" in upper or "EXPLODE(" in upper:
        add("spark", 3, "Spark LATERAL VIEW or EXPLODE")

    if "DISTKEY" in upper or "SORTKEY" in upper:
        add("redshift", 3, "DISTKEY or SORTKEY")

    if "READ_CSV" in upper or "READ_PARQUET" in upper:
        add("duckdb", 3, "DuckDB read_* table function")

    if "IDENTIFIER(" in upper:
        add("bigquery", 2, "IDENTIFIER() macro")

    if "TOP " in upper.split("\n")[0] if upper else "":
        add("snowflake", 1, "TOP clause (also T-SQL)")

    ranked = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    best_id, best_score = ranked[0]

    if best_score == 0:
        return {
            "dialect": "bigquery",
            "confidence": "low",
            "signals": [],
            "alternatives": [],
        }

    second_score = ranked[1][1] if len(ranked) > 1 else 0
    if best_score >= second_score + 2:
        confidence = "high"
    elif best_score > second_score:
        confidence = "medium"
    else:
        confidence = "low"

    matched_signals = [s for s in signals if s["dialect"] == best_id]
    alternatives = [
        {"dialect": did, "score": score}
        for did, score in ranked[1:3]
        if score > 0
    ]

    return {
        "dialect": best_id,
        "confidence": confidence,
        "signals": matched_signals,
        "alternatives": alternatives,
    }
