import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.routes.dialects import router as dialects_router
from backend.api.routes.lineage import router as lineage_router


def create_app() -> FastAPI:
    app = FastAPI(title="Enhanced SQL Lineage API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    app.include_router(lineage_router)
    app.include_router(dialects_router)

    static_dir = Path(os.environ.get("STATIC_DIR", "static"))
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

    return app


app = create_app()
