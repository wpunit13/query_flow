"""FastAPI entrypoint for uvicorn: `uvicorn main:app --reload`"""

from backend.app import app

__all__ = ["app"]
