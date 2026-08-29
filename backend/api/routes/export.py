from fastapi import APIRouter, HTTPException

from backend.models.lineage import OpenLineageExportRequest
from backend.services.dialects import validate_dialect
from backend.services.export_formats import lineage_to_openlineage

router = APIRouter(prefix="/api/v1", tags=["export"])


@router.post(
    "/export/openlineage",
    summary="Export lineage as OpenLineage (Marquez-compatible) event JSON",
)
def export_openlineage(request: OpenLineageExportRequest) -> dict:
    try:
        dialect = validate_dialect(request.dialect)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return lineage_to_openlineage(request.lineage, request.sql, dialect)
