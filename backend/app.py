import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.routes.dialects import build_dialects_router
from backend.api.routes.export import router as export_router
from backend.api.routes.lineage import build_lineage_router
from backend.api.routes.meta import router as meta_router
from backend.api.versioning import LegacyApiDeprecationMiddleware
from backend.models.api_contract import API_CONTRACT_VERSION, LEGACY_SUNSET


def create_app() -> FastAPI:
    app = FastAPI(
        title="SQL Lineage Studio API",
        description=(
            "Parse SQL into interactive lineage graphs. "
            f"Stable contract: **v{API_CONTRACT_VERSION}** under `/api/v1/*`. "
            f"Unversioned `/api/*` routes are deprecated (Sunset: {LEGACY_SUNSET})."
        ),
        version=API_CONTRACT_VERSION,
    )
    app.add_middleware(LegacyApiDeprecationMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["ops"])
    def health() -> dict:
        return {"status": "ok"}

    app.include_router(meta_router)
    app.include_router(build_lineage_router("/api/v1", ["lineage-v1"]))
    app.include_router(build_dialects_router("/api/v1", ["dialects-v1"]))
    app.include_router(export_router)
    app.include_router(build_lineage_router("/api", ["lineage-legacy"]))
    app.include_router(build_dialects_router("/api", ["dialects-legacy"]))

    static_dir = Path(os.environ.get("STATIC_DIR", "static"))
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

    return app


app = create_app()
