from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.dialects import detect_dialect, list_dialects


class DialectInfo(BaseModel):
    id: str = Field(..., description="SQLGlot dialect id")
    label: str = Field(..., description="Human-readable dialect name")
    limitations: str = Field(..., description="Known parser limitations for this dialect")


class DetectDialectRequest(BaseModel):
    sql: str = Field(..., min_length=1, description="SQL snippet to analyze")


class DialectSignal(BaseModel):
    dialect: str
    reason: str


class DialectAlternative(BaseModel):
    dialect: str
    score: int


class DetectDialectResponse(BaseModel):
    dialect: str = Field(..., description="Best-matching dialect id")
    confidence: str = Field(..., description="high, medium, or low")
    signals: List[DialectSignal] = Field(default_factory=list)
    alternatives: List[DialectAlternative] = Field(default_factory=list)


def build_dialects_router(prefix: str, tags: list[str]) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=tags)

    @router.get(
        "/dialects",
        response_model=List[DialectInfo],
        summary="List supported SQL dialects",
    )
    def get_dialects() -> List[DialectInfo]:
        return [DialectInfo(**d) for d in list_dialects()]

    @router.post(
        "/detect-dialect",
        response_model=DetectDialectResponse,
        summary="Heuristic SQL dialect detection",
    )
    def post_detect_dialect(request: DetectDialectRequest) -> DetectDialectResponse:
        result = detect_dialect(request.sql)
        return DetectDialectResponse(**result)

    return router
