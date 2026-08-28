import time

import sqlglot
from fastapi import APIRouter, HTTPException

from backend.models.api_contract import API_CONTRACT_VERSION
from backend.models.lineage import LineageResponse, ParseErrorDetail, SQLRequest
from backend.services.lineage_parser import parse_sql_to_lineage
from backend.services.parse_errors import format_parse_error
from backend.services.dialects import validate_dialect


def build_lineage_router(prefix: str, tags: list[str]) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=tags)

    @router.post(
        "/parse-sql",
        response_model=LineageResponse,
        responses={400: {"model": ParseErrorDetail}},
        summary="Parse SQL into a lineage graph",
        description=(
            "Returns a versioned lineage graph (nodes, edges, warnings, stats). "
            f"Response contract version is `{API_CONTRACT_VERSION}`."
        ),
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

    return router
