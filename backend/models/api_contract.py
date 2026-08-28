"""API contract version constants and shared schema types."""

from enum import Enum
from typing import List

from pydantic import BaseModel, Field


API_CONTRACT_VERSION = "1.0"
API_PREFIX_V1 = "/api/v1"
LEGACY_API_PREFIX = "/api"

# Unversioned /api/* routes remain until this date (RFC 8594 Sunset).
LEGACY_SUNSET = "2026-12-31"


class NodeKind(str, Enum):
    PHYSICAL_TABLE = "physical_table"
    CTE = "cte"
    SUBQUERY = "subquery"
    VIEW = "view"
    JOIN = "join"
    FINAL_OUTPUT = "final_output"
    MERGE_TARGET = "merge_target"
    INSERT_TARGET = "insert_target"


class EdgeType(str, Enum):
    DIRECT = "direct"
    JOIN = "join"
    MERGE = "merge"
    CTE = "cte"


class LineageStats(BaseModel):
    node_count: int = Field(..., ge=0, description="Number of nodes in the lineage graph")
    edge_count: int = Field(..., ge=0, description="Number of edges in the lineage graph")
    parse_ms: int = Field(..., ge=0, description="Server-side parse and graph build time in milliseconds")


class ApiVersionInfo(BaseModel):
    api_version: str = Field(
        default=API_CONTRACT_VERSION,
        description="URL path version (/api/v1). Bump when routes or breaking HTTP behavior changes.",
    )
    contract_version: str = Field(
        default=API_CONTRACT_VERSION,
        description="JSON response schema version (version field on parse responses).",
    )
    documentation: str = Field(default="/docs", description="OpenAPI interactive documentation path")
    legacy_prefix: str = Field(default=LEGACY_API_PREFIX, description="Deprecated unversioned API prefix")
    legacy_sunset: str = Field(
        default=LEGACY_SUNSET,
        description="RFC 8594 Sunset date for legacy /api/* routes (excluding /api/v1/*)",
    )
    endpoints: List[str] = Field(
        default_factory=lambda: [
            "GET /api/v1/version",
            "GET /api/v1/dialects",
            "POST /api/v1/detect-dialect",
            "POST /api/v1/parse-sql",
        ],
        description="Current stable v1 endpoints",
    )
