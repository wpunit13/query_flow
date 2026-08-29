# Metadata Catalog Integration

Design for **§5 Metadata Catalog Integration** in [ENTERPRISE_ROADMAP.md](ENTERPRISE_ROADMAP.md).

Catalog enrichment is **optional**. Parse-only mode (`POST /api/v1/parse-sql`) works exactly as today when no catalog is configured.

---

## Design principles

| Principle | Rule |
|-----------|------|
| Parse-first | `parse-sql` never requires a catalog connection |
| Opt-in enrich | Catalog runs only when `connection_id` is set |
| Fail soft | Catalog errors append to `warnings[]`; SQL graph still returned |
| Secrets server-side | UI sends `connection_id` only — never passwords or API keys |
| Same API contract | Enrich patches `node.data.metadata` / columns; response `version` stays `1.0` |
| Test without cloud | Mock file connector + fixtures in CI and local dev |

---

## Architecture

```text
Phase A (always):   SQL  →  parse  →  lineage graph
Phase B (optional): graph + connection_id  →  enrich  →  patched graph
```

```text
backend/services/catalog/
  base.py              # CatalogConnector interface
  registry.py          # resolve connection_id → connector
  null_connector.py    # no-op
  file_connector.py    # JSON fixtures (local mock)
  bigquery_connector.py    # Phase 2+
  snowflake_connector.py
  ...
backend/api/routes/catalog.py
```

**Enrichment targets:** `physical_table` and `view` nodes (match on dialect + `qualified_name`). CTEs and subqueries stay query-derived.

**Enrichment fills:**

- `data.metadata` — owner, description, tags, freshness, `catalog_url`, etc.
- `data.columns` — optional full schema from catalog (vs SQL-only columns on downstream nodes today)

---

## API (planned)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/parse-sql` | Unchanged — SQL → graph |
| `POST /api/v1/catalog/enrich` | Patch graph with catalog metadata |
| `GET /api/v1/catalog/connections` | List `{ id, label, type }` for UI dropdown (no secrets) |
| `POST /api/v1/catalog/connections` | Admin: create connection metadata (Phase 2+) |
| `POST /api/v1/catalog/connections/{id}/test` | Health check (Phase 2+) |

**Enrich request:**

```json
{
  "lineage": { "version": "1.0", "nodes": [...], "edges": [...], "warnings": [], "stats": {...} },
  "connection_id": "mock"
}
```

Omit `connection_id` → return lineage unchanged.

**Optional combined parse (Phase 1+):**

```json
POST /api/v1/parse-sql
{
  "sql": "...",
  "dialect": "bigquery",
  "catalog": { "connection_id": "mock" }
}
```

---

## Credential storage

| Environment | Where secrets live |
|-------------|-------------------|
| Local dev | `.env`, gitignored `catalog-connections.yaml` |
| Docker | `env_file` (e.g. `.env.catalog`), not in image |
| K8s / VPC | Secrets Manager, Vault, K8s Secrets; IAM roles where possible |
| SaaS | Per-tenant `secret_ref` in DB — not raw tokens |

The UI stores **connection id + label**. OAuth tokens and warehouse keys stay on the server.

---

## Local testing without a real catalog

Use a **file-backed mock** — no Snowflake, BQ, or Atlan required:

```text
backend/tests/fixtures/catalog/mock_tables.json
```

Example key: `bigquery:users` → owner, columns, tags, `catalog_url`.

```bash
# Phase 0+ — enrich with mock
curl -s -X POST http://127.0.0.1:8000/api/v1/catalog/enrich \
  -H 'Content-Type: application/json' \
  -d '{"connection_id":"mock","lineage":{...}}'
```

CI uses `connection_id=mock` only. Optional nightly job can test a BQ/Snowflake trial with secrets in CI env.

---

## Phase-wise delivery

### Phase 0 — Pluggable layer (no UI)

**Goal:** Architecture and mock enrich; zero user-visible change.

| Deliverable | Details |
|-------------|---------|
| `CatalogConnector` ABC + `NullConnector` | No-op when catalog disabled |
| `FileCatalogConnector` | Reads `fixtures/catalog/mock_tables.json` |
| `POST /api/v1/catalog/enrich` | Patch nodes; warnings on miss/failure |
| `GET /api/v1/catalog/connections` | Returns `[{ id: "mock", label: "Local mock", type: "file" }]` in dev |
| Tests | enrich noop, mock metadata, parse tests unchanged |

**Exit:** Enrich works with `connection_id=mock`; no credentials.

---

### Phase 1 — Dev UI + mock catalog

**Goal:** Configure and demo catalog locally without cloud accounts.

| Deliverable | Details |
|-------------|---------|
| Header dropdown | `Catalog: None` (default) \| `Local mock` |
| Render flow | parse → enrich if catalog selected |
| Table nodes | Owner/tag chips; expand shows catalog columns when enriched |
| Explore badge | “SQL lineage only” vs “Enriched (mock)” |
| Docs | This file + roadmap §5 phase table |

**Exit:** `None` = current app; mock shows enriched `users` from fixture.

---

### Phase 2 — First real connector + server config

**Goal:** One warehouse (BigQuery **or** Snowflake) with server-side credentials.

| Deliverable | Details |
|-------------|---------|
| `BigQueryConnector` or `SnowflakeConnector` | INFORMATION_SCHEMA / Tables API |
| Connection records | id, type, non-secret config + `secret_ref` |
| Settings UI (minimal) | List connections, test connection, no secret paste in prod |
| Credentials | `.env` / compose `env_file` locally |

**Exit:** Real table metadata from trial account; mock still used in CI.

---

### Phase 3 — Multi-platform + production secrets

**Goal:** More connectors; caching; K8s-ready secret handling.

| Deliverable | Details |
|-------------|---------|
| Connectors | Unity Catalog, AWS Glue, DataHub (read) |
| Caching | TTL per `(connection_id, qualified_name)` |
| Secrets | K8s Secrets / cloud SM; IAM roles for Glue/BQ |
| Settings | Full CRUD, default connection |

**Exit:** 3+ connector types; secrets never in API/export JSON.

---

### Phase 4 — Governance + deep links

**Goal:** Collibra, Atlan, rich business metadata.

| Deliverable | Details |
|-------------|---------|
| Connectors | Atlan, Collibra REST; disambiguation when names collide |
| UI | “Open in catalog” (`metadata.catalog_url`); certification, glossary |
| OAuth | Backend callback; tokens encrypted server-side |

**Exit:** Deep links and stewardship metadata on source nodes.

---

### Phase 5 — Cross-asset impact analysis

**Goal:** Downstream impact beyond the current query graph.

| Deliverable | Details |
|-------------|---------|
| Catalog lineage APIs | DataHub, BQ lineage, Snowflake deps (where available) |
| UI | “Show downstream impact” on table node; export CSV |
| Optional | dbt `manifest.json` (overlap with §7) |

**Exit:** List downstream views/jobs from catalog; still optional feature.

---

## UI configuration (summary)

| Surface | Phase | Purpose |
|---------|-------|---------|
| Header `Catalog` dropdown | 1 | `None` or active connection |
| Settings → Catalog | 2+ | Admin: connections, test, docs link for secrets |
| Node chips / expand | 1 | Show enrichment when present |
| Open in catalog | 4 | External link on table/view nodes |
| Impact panel | 5 | Estate-wide downstream deps |

---

## Roadmap task mapping

| §5 task | Phase |
|---------|-------|
| Enrich owner, description, row count, freshness | 1–4 |
| PII tags, SLA tier | 3–4 |
| BigQuery catalog | 2 |
| Snowflake INFORMATION_SCHEMA | 2 |
| Unity Catalog, Glue | 3 |
| DataHub | 3–4 |
| Collibra, Atlan | 4 |
| Open in catalog | 4 |
| Impact analysis | 5 |

---

## Related docs

- [EMBED.md](EMBED.md) — iframe / API-first usage
- [ENTERPRISE_ROADMAP.md](ENTERPRISE_ROADMAP.md) — §5 tracking
- OpenLineage export (`POST /api/v1/export/openlineage`) — push to DataHub; Phase 3+ read-back for enrichment
