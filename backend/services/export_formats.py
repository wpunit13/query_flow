"""Convert lineage graphs to export formats (OpenLineage, CSV, etc.)."""

import csv
import io
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

OPENLINEAGE_PRODUCER = "sql-lineage-studio"
OPENLINEAGE_SCHEMA_URL = "https://openlineage.io/spec/1-0-5/OpenLineage.json"

INPUT_KINDS = frozenset({"physical_table", "subquery", "cte"})
OUTPUT_KINDS = frozenset({"final_output", "view", "insert_target", "merge_target"})


def _dataset(namespace: str, name: str) -> Dict[str, str]:
    return {"namespace": namespace, "name": name}


def lineage_to_openlineage(
    lineage: Dict[str, Any],
    sql: str,
    dialect: str,
    job_name: str = "sql_lineage_parse",
) -> Dict[str, Any]:
    """Build an OpenLineage COMPLETE event (Marquez-compatible ingestion format)."""
    inputs: List[Dict[str, str]] = []
    outputs: List[Dict[str, str]] = []
    seen_in: set[str] = set()
    seen_out: set[str] = set()

    for node in lineage.get("nodes", []):
        data = node.get("data") or {}
        kind = data.get("kind", "")
        name = data.get("qualified_name") or data.get("label") or node.get("id", "")
        key = f"{dialect}:{name}"
        if kind in INPUT_KINDS and key not in seen_in:
            seen_in.add(key)
            inputs.append(_dataset(dialect, name))
        elif kind in OUTPUT_KINDS and key not in seen_out:
            seen_out.add(key)
            outputs.append(_dataset(dialect, name))

    return {
        "eventType": "COMPLETE",
        "eventTime": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "producer": OPENLINEAGE_PRODUCER,
        "schemaURL": OPENLINEAGE_SCHEMA_URL,
        "run": {"runId": str(uuid4())},
        "job": {"namespace": OPENLINEAGE_PRODUCER, "name": job_name},
        "inputs": inputs,
        "outputs": outputs,
        "facets": {
            "sql": {"query": sql},
            "lineage": {
                "version": lineage.get("version"),
                "stats": lineage.get("stats"),
                "warnings": lineage.get("warnings", []),
            },
        },
    }


