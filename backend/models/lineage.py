from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class SQLRequest(BaseModel):
    sql: str
    dialect: str = "bigquery"


class ColumnLineageEntry(BaseModel):
    name: str
    sources: List[str] = Field(default_factory=list)


class NodeData(BaseModel):
    label: str
    columns: List[str] = Field(default_factory=list)
    conditions: List[str] = Field(default_factory=list)
    kind: str = "physical_table"
    qualified_name: Optional[str] = None
    schema: Optional[str] = None
    database: Optional[str] = None
    dialect: Optional[str] = None
    join_type: Optional[str] = None
    join_order: Optional[int] = None
    column_lineage: List[ColumnLineageEntry] = Field(default_factory=list)


class LineageNode(BaseModel):
    id: str
    data: NodeData
    type: str = "tableNode"


class LineageEdge(BaseModel):
    id: str
    source: str
    target: str
    edge_type: str = "direct"


class LineageResponse(BaseModel):
    version: str = "1.0"
    warnings: List[str] = Field(default_factory=list)
    nodes: List[LineageNode]
    edges: List[LineageEdge]


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
