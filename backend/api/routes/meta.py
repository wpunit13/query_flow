from fastapi import APIRouter

from backend.models.api_contract import ApiVersionInfo

router = APIRouter(prefix="/api/v1", tags=["api-v1"])


@router.get(
    "/version",
    response_model=ApiVersionInfo,
    summary="API contract and versioning metadata",
)
def get_api_version() -> ApiVersionInfo:
    return ApiVersionInfo()
