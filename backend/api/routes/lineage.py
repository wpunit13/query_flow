import sqlglot
from fastapi import APIRouter, HTTPException

from backend.models.lineage import LineageResponse, SQLRequest
from backend.services.lineage_parser import parse_sql_to_lineage

router = APIRouter(prefix="/api", tags=["lineage"])


@router.post("/parse-sql", response_model=LineageResponse)
def parse_sql(request: SQLRequest) -> LineageResponse:
    try:
        result = parse_sql_to_lineage(request.sql, request.dialect)
    except sqlglot.errors.ParseError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return LineageResponse(**result)
