"""API path versioning and legacy-route deprecation headers."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.models.api_contract import API_PREFIX_V1, LEGACY_API_PREFIX, LEGACY_SUNSET

LEGACY_API_PATHS = frozenset(
    {
        "/api/parse-sql",
        "/api/dialects",
        "/api/detect-dialect",
    }
)


def apply_legacy_deprecation_headers(response: Response, path: str) -> None:
    if path in LEGACY_API_PATHS:
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = LEGACY_SUNSET
        successor = path.replace(LEGACY_API_PREFIX, API_PREFIX_V1, 1)
        response.headers["Link"] = f"<{successor}>; rel=\"successor-version\""


class LegacyApiDeprecationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        apply_legacy_deprecation_headers(response, request.url.path)
        return response
