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
