import sqlglot
from fastapi import APIRouter, HTTPException

from backend.models.lineage import LineageResponse, ParseErrorDetail, SQLRequest
from backend.services.lineage_parser import parse_sql_to_lineage
from backend.services.parse_errors import format_parse_error
from backend.services.dialects import validate_dialect

router = APIRouter(prefix="/api", tags=["lineage"])


@router.post(
    "/parse-sql",
    response_model=LineageResponse,
    responses={400: {"model": ParseErrorDetail}},
)
def parse_sql(request: SQLRequest) -> LineageResponse:
    try:
        dialect = validate_dialect(request.dialect)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = parse_sql_to_lineage(request.sql, dialect)
    except sqlglot.errors.ParseError as e:
        raise HTTPException(status_code=400, detail=format_parse_error(e, request.sql))

    return LineageResponse(**result)
