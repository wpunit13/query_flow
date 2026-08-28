# Deploy (Phase 1 — local Docker)

Single container: FastAPI API + built React UI on one port.

```bash
# From repository root
docker compose -f deploy/docker-compose.yml up --build

# Or from this directory
docker compose up --build
```

Open **http://localhost:8080** (maps host 8080 → container 8000).

Health: **http://localhost:8080/health**

Build context is the **repository root** (`context: ..`); the Dockerfile copies `backend/`, `sql-visualizer-ui/`, and root `main.py`.
