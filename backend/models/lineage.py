from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from backend.models.api_contract import API_CONTRACT_VERSION, EdgeType, LineageStats, NodeKind


class SQLRequest(BaseModel):
    sql: str = Field(..., min_length=1, description="SQL query to parse into a lineage graph")
    dialect: str = Field(
        default="bigquery",
        description="SQLGlot dialect id (e.g. bigquery, postgres, snowflake)",
    )


class ColumnLineageEntry(BaseModel):
    name: str = Field(..., description="Output column name or alias")
    sources: List[str] = Field(
        default_factory=list,
        description="Upstream source references for this column",
    )


class NodeData(BaseModel):
    label: str = Field(..., description="Display label for the graph node")
    columns: List[str] = Field(default_factory=list, description="Output column names when expanded")
    conditions: List[str] = Field(
        default_factory=list,
        description="Join or filter conditions (join nodes)",
    )
    kind: NodeKind = Field(
        default=NodeKind.PHYSICAL_TABLE,
        description="Semantic node type in the lineage graph",
    )
    qualified_name: Optional[str] = Field(
        default=None,
        description="Fully qualified table/view name when applicable",
    )
    schema: Optional[str] = Field(default=None, description="Schema (database) qualifier")
    database: Optional[str] = Field(default=None, description="Catalog/database qualifier")
    dialect: Optional[str] = Field(default=None, description="Dialect used when the node was parsed")
    join_type: Optional[str] = Field(default=None, description="Join type label for join nodes")
    join_order: Optional[int] = Field(default=None, description="Position of this join in the join chain")
    column_lineage: List[ColumnLineageEntry] = Field(
        default_factory=list,
        description="Per-column upstream lineage on output nodes",
    )
    metadata: Dict[str, str] = Field(
        default_factory=dict,
        description="Optional catalog or platform metadata (e.g. owner, tags)",
    )


class LineageNode(BaseModel):
    id: str = Field(..., description="Stable node id within the graph")
    data: NodeData
    type: str = Field(
        default="tableNode",
        description="React Flow node component type (tableNode or joinNode)",
    )


class LineageEdge(BaseModel):
    id: str = Field(..., description="Stable edge id within the graph")
    source: str = Field(..., description="Source node id")
    target: str = Field(..., description="Target node id")
    edge_type: EdgeType = Field(
        default=EdgeType.DIRECT,
        description="Semantic edge type (direct table flow, join, merge, etc.)",
    )


class LineageResponse(BaseModel):
    version: str = Field(
        default=API_CONTRACT_VERSION,
        description="Response contract version; clients should check before parsing",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Non-fatal parse or normalization warnings",
    )
    nodes: List[LineageNode]
    edges: List[LineageEdge]
    stats: LineageStats = Field(..., description="Graph size and server-side parse timing")


class ParseContextLine(BaseModel):
    line: int
    text: str
    is_error_line: bool = False


class ParseErrorItem(BaseModel):
    message: str
    line: Optional[int] = None
    column: Optional[int] = None
    highlight: Optional[str] = None
    technical_message: Optional[str] = None
    snippet: Optional[str] = None
    context_lines: List[ParseContextLine] = Field(default_factory=list)


class ParseErrorDetail(BaseModel):
    error: str = "parse_error"
    message: str
    guidance: Optional[str] = None
    errors: List[ParseErrorItem] = Field(default_factory=list)
