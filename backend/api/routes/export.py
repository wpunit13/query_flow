import sqlglot
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from backend.models.lineage import LineageResponse, ParseErrorDetail, SQLRequest
from backend.services.dialects import validate_dialect
from backend.services.export_formats import lineage_to_csv, lineage_to_openlineage
from backend.services.lineage_parser import parse_sql_to_lineage
from backend.services.parse_errors import format_parse_error

router = APIRouter(prefix="/api/v1", tags=["export"])


def _parse_or_400(request: SQLRequest) -> dict:
    try:
        dialect = validate_dialect(request.dialect)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    try:
        return parse_sql_to_lineage(request.sql, dialect)
    except sqlglot.errors.ParseError as e:
        raise HTTPException(status_code=400, detail=format_parse_error(e, request.sql))


@router.post(
    "/export/openlineage",
    summary="Export lineage as OpenLineage (Marquez-compatible) event JSON",
)
def export_openlineage(request: SQLRequest) -> dict:
    dialect = validate_dialect(request.dialect)
    lineage = _parse_or_400(request)
    return lineage_to_openlineage(lineage, request.sql, dialect)


@router.post(
    "/export/csv",
    response_class=PlainTextResponse,
    summary="Export lineage graph as CSV",
)
def export_csv(request: SQLRequest) -> PlainTextResponse:
    lineage = _parse_or_400(request)
    csv_text = lineage_to_csv(lineage)
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=lineage.csv"},
    )


@router.post(
    "/export/json",
    response_model=LineageResponse,
    responses={400: {"model": ParseErrorDetail}},
    summary="Export lineage as versioned JSON (same as parse-sql)",
)
def export_json(request: SQLRequest) -> LineageResponse:
    lineage = _parse_or_400(request)
    return LineageResponse(**lineage)
