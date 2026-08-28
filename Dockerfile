# syntax=docker/dockerfile:1

# --- Stage 1: build React UI ---
FROM node:20-alpine AS ui-builder

WORKDIR /build/sql-visualizer-ui

COPY sql-visualizer-ui/package.json sql-visualizer-ui/package-lock.json ./
RUN npm ci

COPY sql-visualizer-ui/ ./

# Same-origin API when served from this container (see backend static mount).
ENV VITE_API_URL=
RUN npm run build

# --- Stage 2: Python API + static assets ---
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    STATIC_DIR=/app/static

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py pytest.ini ./
COPY backend/ backend/

COPY --from=ui-builder /build/sql-visualizer-ui/dist /app/static

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
