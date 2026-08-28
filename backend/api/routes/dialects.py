from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.dialects import detect_dialect, list_dialects, validate_dialect

router = APIRouter(prefix="/api", tags=["dialects"])


class DialectInfo(BaseModel):
    id: str
    label: str
    limitations: str


class DetectDialectRequest(BaseModel):
    sql: str = Field(..., min_length=1)


class DialectSignal(BaseModel):
    dialect: str
    reason: str


class DialectAlternative(BaseModel):
    dialect: str
    score: int


class DetectDialectResponse(BaseModel):
    dialect: str
    confidence: str
    signals: List[DialectSignal] = Field(default_factory=list)
    alternatives: List[DialectAlternative] = Field(default_factory=list)


@router.get("/dialects", response_model=List[DialectInfo])
def get_dialects() -> List[DialectInfo]:
    return [DialectInfo(**d) for d in list_dialects()]


@router.post("/detect-dialect", response_model=DetectDialectResponse)
def post_detect_dialect(request: DetectDialectRequest) -> DetectDialectResponse:
    result = detect_dialect(request.sql)
    return DetectDialectResponse(**result)
