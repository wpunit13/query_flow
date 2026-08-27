# Enterprise Roadmap — Tracking

Track implementation progress for enterprise readiness items (from review point 4 onward).

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## 4. Lineage Accuracy Limitations

Current extraction is table-name-level, not true column-level lineage.

| Limitation | Impact |
|---|---|
| `find_all(Table)` flattens subqueries | Subquery internals may be wrong or duplicated |
| CTE names vs physical tables conflated | e.g. `RecursiveDepartmentHierarchy` treated as a table |
| No `schema.db.table` qualification | Ambiguous in multi-schema environments |
| Single join node per block | Loses per-join type (LEFT vs INNER) and order |
| Preprocessing (`LATERAL` → `JOIN`) | Silent transformation; should be logged/warned |
| No `INSERT` / `CREATE VIEW` / `MERGE` | Only SELECT lineage today |

### Tasks

- [x] Use SQLGlot **lineage API** (`sqlglot.lineage`) for column-level lineage
- [x] Extend node model: `id`, `type`, `qualified_name`, `schema`, `database`, `dialect`
- [x] Distinguish node kinds: `physical_table`, `cte`, `subquery`, `view`, `final_output`
- [x] Surface parse warnings in UI (e.g. “LATERAL normalized”, “unresolved reference”)
- [x] Handle subqueries without flattening table references incorrectly
- [x] Resolve qualified names (`schema.table`, `db.schema.table`) where possible
- [x] Per-join nodes with join type (LEFT, INNER, etc.) and order preserved
- [x] Log/warn when SQL preprocessing alters syntax (LATERAL, etc.)
- [x] Support lineage for `INSERT`, `CREATE VIEW`, `MERGE`, and other DML/DDL statements

---

## 5. Metadata Catalog Integration

Enterprises need lineage in context of their data catalog.

### Tasks

- [ ] Integrate with Snowflake metadata / INFORMATION_SCHEMA
- [ ] Integrate with Databricks Unity Catalog
- [ ] Integrate with BigQuery catalog
- [ ] Integrate with AWS Glue Data Catalog
- [ ] Integrate with Collibra
- [ ] Integrate with Atlan
- [ ] Integrate with DataHub
- [ ] Enrich nodes with owner, description, row count, freshness
- [ ] Enrich nodes with PII tags and SLA tier
- [ ] “Open in catalog” link per table node
- [ ] Impact analysis: downstream views/objects affected by a table change

---

## 6. Multi-Dialect & Dialect Selector

Dialect is currently hardcoded to `bigquery` in the UI.

### Tasks

- [ ] Dialect dropdown in UI (BigQuery, Snowflake, Postgres, Spark, Redshift, DuckDB)
- [ ] Pass selected dialect to API on every parse request
- [ ] Auto-detect dialect heuristics (optional helper)
- [ ] Dialect-specific preprocessing rules where needed
- [ ] Document supported dialects and known limitations per dialect

---

## 7. Workspace & Query Management

### Tasks

- [ ] Save/load queries (named projects, folders)
- [ ] Version history for queries
- [ ] Diff between query versions (“what changed between v1 and v2?”)
- [ ] Import from file upload
- [ ] Import from Git repo
- [ ] Import from dbt `models/`
- [ ] Import from Airflow SQL files
- [ ] Shareable read-only links with expiry
- [ ] Persist graph state (collapse/hide, layout) per saved query

---

## 8. Export & Embed

### Tasks

- [ ] Export DAG as PNG
- [ ] Export DAG as SVG
- [ ] Export DAG as PDF
- [ ] Export lineage as JSON
- [ ] Export lineage as CSV
- [ ] Export lineage as OpenLineage format
- [ ] Export lineage as Marquez-compatible format
- [ ] Embeddable widget for internal portals
- [ ] API-first `POST /v1/lineage` with standard response schema for CI/CD gates

---

## 9. Advanced Graph UX

| Feature | Why enterprises want it |
|---|---|
| Column-level lineage mode | Trace e.g. `total_compensation` → `salaries.base_salary` |
| Filter by table/CTE name | Hide everything except one branch |
| Layout modes (TB / LR / radial) | Large graphs read better horizontally |
| Breadcrumb path | e.g. `clients → CTE → join → Final_Output` |
| Keyboard shortcuts | Power users navigate without mouse |
| Diff mode | Highlight nodes/edges added/removed between two queries |

### Tasks

- [x] Column-level lineage mode in graph (click column → highlight upstream path)
- [x] Filter/hide nodes by table or CTE name
- [x] Layout mode: top-to-bottom (current)
- [x] Layout mode: left-to-right
- [x] Layout mode: radial
- [x] Breadcrumb / path indicator for selected node lineage
- [x] Keyboard shortcuts (search, fit view, expand/collapse, navigate matches)
- [x] Diff mode: compare two queries and highlight graph changes
- [x] “Focus branch” mode: show only upstream or downstream of selected node

---

## 10. Observability & Ops

### Tasks

- [ ] `GET /health` endpoint
- [ ] `GET /ready` endpoint
- [ ] Prometheus metrics: parse latency
- [ ] Prometheus metrics: parse success / failure rate
- [ ] Prometheus metrics: node count distribution
- [ ] Structured JSON logging with correlation IDs
- [ ] Graceful degradation: partial graph + warnings when parse is incomplete
- [ ] Request timeout on parse operations
- [ ] Alerting hooks for high error rates or latency SLO breaches

---

## 11. Architecture Refactor — Split the Monolith

Today: large `App.jsx` and inline logic in `main.py`.

### Target structure

```
backend/
  api/routes/lineage.py
  services/lineage_parser.py      # AST → graph
  services/sql_preprocessor.py    # LATERAL, etc.
  models/lineage.py               # Pydantic response schema
  tests/

frontend/
  components/GraphCanvas.jsx
  components/nodes/TableNode.jsx
  components/nodes/JoinNode.jsx
  hooks/useLineageGraph.js
  hooks/useGraphLayout.js
  api/lineageClient.js
  utils/dagreLayout.js
```

### Tasks

- [x] Create `backend/services/sql_preprocessor.py`
- [x] Create `backend/services/lineage_parser.py`
- [x] Create `backend/models/lineage.py` (Pydantic schemas)
- [x] Create `backend/api/routes/lineage.py`
- [x] Move tests to `backend/tests/`
- [x] Split `GraphCanvas` from `App.jsx`
- [x] Split `TableNode` and `JoinNode` into separate components
- [x] Create `hooks/useLineageGraph.js`
- [x] Create `hooks/useGraphLayout.js`
- [x] Create `api/lineageClient.js` (env-based API URL)
- [x] Create `utils/dagreLayout.js`
- [x] Remove dead/backup code (`bkp_app_jsx`, commented blocks in `main.py`)

---

## 12. API Contract Versioning

### Target response shape

```json
{
  "version": "1.0",
  "warnings": ["LATERAL join normalized on line 37"],
  "nodes": [
    {
      "id": "employees",
      "kind": "physical_table",
      "qualified_name": "hr.employees",
      "label": "employees",
      "columns": [],
      "metadata": { "owner": "data-platform" }
    }
  ],
  "edges": [
    {
      "id": "...",
      "source": "employees",
      "target": "join_...",
      "edge_type": "join"
    }
  ],
  "stats": {
    "node_count": 18,
    "edge_count": 32,
    "parse_ms": 45
  }
}
```

### Tasks

- [ ] Define versioned API schema (`version` field in responses)
- [ ] Add `warnings` array to parse responses
- [ ] Add `kind` / node type enum to node schema
- [ ] Add `qualified_name` to nodes
- [ ] Add optional `metadata` object on nodes
- [ ] Add `edge_type` to edges (join, direct, cte, etc.)
- [ ] Add `stats` block (node_count, edge_count, parse_ms)
- [ ] Document API in OpenAPI / Swagger (FastAPI auto-docs)
- [ ] API versioning strategy (`/v1/lineage`, deprecation policy)

---

## 13. Error UX

Replace `alert()` and basic errors with production-grade feedback.

### Tasks

- [ ] Inline error panel (replace `alert()`)
- [ ] Show SQLGlot line/column in error messages
- [ ] Click error → jump to line in SQL editor
- [ ] Replace textarea with Monaco or CodeMirror editor
- [ ] Syntax highlighting in SQL editor
- [ ] Line numbers in SQL editor
- [ ] Dialect-aware highlighting (where supported)
- [ ] Warning panel for non-fatal parse issues (separate from errors)
- [ ] Loading / parsing progress indicator for large queries

---

## Enterprise Deployment Model (P2)

| Model | Fit |
|---|---|
| SaaS multi-tenant | Auth, tenant isolation, usage billing |
| Single-tenant VPC | Docker/K8s Helm chart, customer cloud |
| Air-gapped on-prem | No external deps, offline SQLGlot |

### Tasks

- [ ] Multi-stage `Dockerfile` (API + static UI)
- [ ] `docker-compose.yml` for local / demo deployments
- [ ] Kubernetes Helm chart
- [ ] Helm: HPA, ingress, secrets templates
- [ ] SBOM generation
- [ ] Dependency scanning (Dependabot / Snyk)
- [ ] SaaS: multi-tenant data isolation
- [ ] SaaS: usage metering / billing hooks
- [ ] VPC deploy guide and reference architecture
- [ ] Air-gapped / on-prem deploy guide (no external network)
- [ ] SOC2-oriented docs: data retention policy (SQL not stored by default)
- [ ] SOC2-oriented docs: encryption (TLS, at-rest)
- [ ] SOC2-oriented docs: access controls and audit requirements

---

## Suggested Roadmap (Timeline)

| Phase | Items | Target |
|---|---|---|
| **P0 Foundation** | Pin deps, Docker, CI, auth, rate limits, audit log, parser tests, API schema | ~5 weeks |
| **P1 Product** | Dialect selector, Monaco editor, column-level lineage, export, workspaces | ~11 weeks |
| **P2 Enterprise** | Catalog integration, impact analysis, diff mode, K8s Helm, observability | ~13 weeks |

### P0 Foundation

- [ ] Pin all Python and npm dependencies
- [ ] Fix missing frontend deps in `package.json`
- [ ] Docker + docker-compose
- [ ] CI: lint, test, build on every PR
- [ ] Authentication (JWT / OIDC)
- [ ] Rate limiting and request size caps
- [ ] Audit logging
- [ ] Parser test suite (pytest + golden files)
- [ ] Initial API schema (see section 12)

### P1 Product

- [ ] Dialect selector (section 6)
- [ ] Monaco / CodeMirror editor (section 13)
- [ ] Column-level lineage (section 4)
- [ ] Export PNG / JSON / OpenLineage (section 8)
- [ ] Save / share workspaces (section 7)

### P2 Enterprise

- [ ] Catalog integration (section 5)
- [ ] Impact analysis + diff mode (sections 5, 9)
- [ ] K8s Helm + observability (sections 10, deployment)
- [x] Architecture refactor (section 11)

---

## Quick Wins (Optional — can parallelize with P0)

- [x] Dialect dropdown + `VITE_API_URL` env var (env var only; dialect dropdown pending)
- [x] Pin `requirements.txt` and fix `package.json` deps (deps added; pinning pending)
- [x] Delete commented-out code in `main.py` and `bkp_app_jsx`
- [ ] Add `GET /health` and SQL size validation (e.g. max 500KB)
- [ ] Replace `alert()` with inline error banner
- [x] Add pytest cases using `notworking.sql` and simpler fixtures

---

## Changelog

| Date | Item | Notes |
|---|---|---|
| 2026-08-27 | Section 9 — Advanced graph UX | Layouts, filter, focus, breadcrumbs, shortcuts, diff, column trace |
| 2026-08-27 | Section 4 — Lineage accuracy | Column lineage, node kinds, per-join nodes, DML support, warnings UI |
| 2026-08-27 | Section 11 — Architecture refactor | Split backend + frontend monolith; 5 pytest tests passing |
