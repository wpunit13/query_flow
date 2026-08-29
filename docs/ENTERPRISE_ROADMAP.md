# Enterprise Roadmap — Tracking

Track implementation progress for enterprise readiness items (from review point 4 onward).

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done

### Status snapshot (2026-08-28)

**Done recently but was missing from this doc:** table view, UNION graph nodes, light/dark theme, Author/Explore/Zen modes, label tooltips, layout overlap/LR fixes, pipeline stage deselect, parser tests (39).

**Still open (highest impact):** catalog integration (§5), workspaces/versioning (§7), auth + rate limits (P0), observability metrics (§10), K8s Helm, CI pipeline, dependency pinning.

**Large graph UI:** Queries with **≥ 40 nodes** default to Table / Pipeline after render, with an overview toast. Select a stage, then Graph (`G`) to trace on the canvas.

---

## 4. Lineage Accuracy Limitationsmo

Current extraction is table-name-level, not true column-level lineage.


| Limitation                             | Impact                                                 |
| -------------------------------------- | ------------------------------------------------------ |
| `find_all(Table)` flattens subqueries  | Subquery internals may be wrong or duplicated          |
| CTE names vs physical tables conflated | e.g. `RecursiveDepartmentHierarchy` treated as a table |
| No `schema.db.table` qualification     | Ambiguous in multi-schema environments                 |
| Single join node per block             | Loses per-join type (LEFT vs INNER) and order          |
| Preprocessing (`LATERAL` → `JOIN`)     | Silent transformation; should be logged/warned         |
| No `INSERT` / `CREATE VIEW` / `MERGE`  | Only SELECT lineage today                              |




### Tasks

- [x] Use SQLGlot **lineage API** (`sqlglot.lineage`) for column-level lineage
- [x] Extend node model: `id`, `type`, `qualified_name`, `schema`, `database`, `dialect`
- [x] Distinguish node kinds: `physical_table`, `cte`, `subquery`, `view`, `final_output`
- [x] Surface parse warnings in UI (e.g. “LATERAL normalized”, “unresolved reference”)
- [x] Handle subqueries without flattening table references incorrectly
- [x] Resolve qualified names (`schema.table`, `db.schema.table`) where possible
- [x] Per-join nodes with join type (LEFT, INNER, etc.) and order preserved
- [x] Per-union nodes with UNION / UNION ALL type and branch wiring
- [x] Log/warn when SQL preprocessing alters syntax (LATERAL, etc.)
- [x] Support lineage for `INSERT`, `CREATE VIEW`, `MERGE`, and other DML/DDL statements

---



## 5. Metadata Catalog Integration

Enterprises need lineage in context of their data catalog. **Parse-only mode stays the default** — catalog is optional enrichment after parse.

**Design:** [CATALOG.md](CATALOG.md) (phases, API, credentials, local mock testing).

### Phase plan


| Phase | Focus                                                                   | Status |
| ----- | ----------------------------------------------------------------------- | ------ |
| **0** | Enrich API, `CatalogConnector`, mock JSON fixture, no UI                | [ ]    |
| **1** | Catalog dropdown (`None` / mock), enriched table nodes, dev demo        | [ ]    |
| **2** | First real connector (BQ or Snowflake), server credentials, Settings UI | [ ]    |
| **3** | Unity Catalog, Glue, DataHub read; K8s secrets; cache                   | [ ]    |
| **4** | Collibra, Atlan, OAuth, “Open in catalog”                               | [ ]    |
| **5** | Cross-asset impact analysis (catalog lineage APIs)                      | [ ]    |




### Tasks

- [ ] Phase 0: `POST /api/v1/catalog/enrich` + file mock connector
- [ ] Phase 1: UI catalog dropdown; metadata chips on source tables
- [ ] Phase 2: Integrate with BigQuery catalog **or** Snowflake INFORMATION_SCHEMA
- [ ] Phase 3: Integrate with Databricks Unity Catalog
- [ ] Phase 3: Integrate with AWS Glue Data Catalog
- [ ] Phase 3–4: Integrate with DataHub (read; complements OpenLineage export)
- [ ] Phase 4: Integrate with Collibra
- [ ] Phase 4: Integrate with Atlan
- [ ] Enrich nodes with owner, description, row count, freshness
- [ ] Enrich nodes with PII tags and SLA tier
- [ ] “Open in catalog” link per table node
- [ ] Impact analysis: downstream views/objects affected by a table change

---



## 6. Multi-Dialect & Dialect Selector

Dialect is currently hardcoded to `bigquery` in the UI.

### Tasks

- [x] Dialect dropdown in UI (BigQuery, Snowflake, Postgres, Spark, Redshift, DuckDB)
- [x] Pass selected dialect to API on every parse request
- [x] Auto-detect dialect heuristics (optional helper)
- [x] Dialect-specific preprocessing rules where needed
- [x] Document supported dialects and known limitations per dialect

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



## 8. Export & Embed — Done (Phase 1)

**Status:** Graph export (PNG/SVG/PDF), lineage JSON/CSV, OpenLineage API, `POST /api/v1/lineage` alias, embed mode (`?embed=1`). See `docs/EMBED.md`.

### Tasks

- [x] Export DAG as PNG
- [x] Export DAG as SVG
- [x] Export DAG as PDF
- [x] Export lineage as JSON
- [x] Export lineage as CSV
- [x] Export lineage as OpenLineage format
- [x] Export lineage as Marquez-compatible format (same OpenLineage event JSON)
- [x] Embeddable widget for internal portals (`?embed=1` + iframe)
- [x] API-first `POST /api/v1/lineage` with standard response schema for CI/CD gates

---



## 9. Advanced Graph UX


| Feature                         | Why enterprises want it                                  |
| ------------------------------- | -------------------------------------------------------- |
| Column-level lineage mode       | Trace e.g. `total_compensation` → `salaries.base_salary` |
| Filter by table/CTE name        | Hide everything except one branch                        |
| Layout modes (TB / LR)          | Large graphs read better horizontally                    |
| Breadcrumb path                 | e.g. `clients → CTE → join → Final_Output`               |
| Keyboard shortcuts              | Power users navigate without mouse                       |
| Diff mode                       | Highlight nodes/edges added/removed between two queries  |
| Table / pipeline view           | Read stages as a table for audits and walkthroughs        |
| UNION visualization             | Show `UNION ALL` branches as first-class graph nodes     |


### Tasks

- [x] Column-level lineage mode in graph (click column → highlight upstream path)
- [x] Filter/hide nodes by table or CTE name
- [x] Layout mode: top-to-bottom (current)
- [x] Layout mode: left-to-right
- [ ] ~~Layout mode: radial~~ — removed (poor readability on real queries)
- [x] Breadcrumb / path indicator for selected node lineage
- [x] Keyboard shortcuts (search, fit view, expand/collapse, navigate matches)
- [x] Diff mode: compare two queries and highlight graph changes
- [x] “Focus branch” mode: show only upstream or downstream of selected node
- [x] Graph / Table view toggle (`G` / `T` shortcuts)
- [x] Table view tabs: Sources, Pipeline, Operations, Output
- [x] Pipeline stage detail panel + upstream path bar; clear selection without re-render
- [x] UNION nodes in graph (`unionNode`) with branch list and expand
- [x] UNION merges in column-trace breadcrumb and Operations table
- [x] Author / Explore studio modes (editor collapses after successful render)
- [x] Zen mode (fullscreen graph, floating controls)
- [x] Light / dark theme with `localStorage` persistence
- [x] Long labels: ellipsis + hover tooltip (copy, node kind)
- [x] Layout polish: overlap resolution, top-anchored expand, LR column spacing, LR left/right edge handles
- [x] Large-graph overview: default to Table / Pipeline when node count ≥ 40, with toast

---



## 10. Observability & Ops



### Tasks

- [x] `GET /health` endpoint
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
  components/LineageTableView.jsx
  components/nodes/TableNode.jsx
  components/nodes/JoinNode.jsx
  components/nodes/UnionNode.jsx
  context/ThemeContext.jsx
  hooks/useLineageGraph.js
  hooks/useGraphLayout.js
  api/lineageClient.js
  utils/dagreLayout.js
  utils/lineageTableModel.js
  theme/themes.js
```



### Tasks

- [x] Create `backend/services/sql_preprocessor.py`
- [x] Create `backend/services/lineage_parser.py`
- [x] Create `backend/models/lineage.py` (Pydantic schemas)
- [x] Create `backend/api/routes/lineage.py`
- [x] Move tests to `backend/tests/`
- [x] Split `GraphCanvas` from `App.jsx`
- [x] Split `TableNode`, `JoinNode`, and `UnionNode` into separate components
- [x] Create `LineageTableView.jsx` + `lineageTableModel.js`
- [x] Create `hooks/useLineageGraph.js`
- [x] Create `hooks/useGraphLayout.js`
- [x] Create `api/lineageClient.js` (env-based API URL)
- [x] Create `utils/dagreLayout.js`
- [x] Theme system: `ThemeContext`, `themes.js`, `uiStyles.js`, `ThemeToggle`
- [x] Remove dead/backup code (`bkp_app_jsx`, commented blocks in `main.py`)

---



## 12. API Contract Versioning — Done

**Status:** Implemented on `develop` — `/api/v1/`* routes, `GET /api/v1/version`, legacy `/api/*` deprecation headers, Pydantic contract with `stats`, enums, and OpenAPI docs at `/docs`.

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

- [x] Define versioned API schema (`version` field in responses)
- [x] Add `warnings` array to parse responses
- [x] Add `kind` / node type enum to node schema
- [x] Add `qualified_name` to nodes
- [x] Add optional `metadata` object on nodes
- [x] Add `edge_type` to edges (join, direct, cte, etc.)
- [x] Add `stats` block (node_count, edge_count, parse_ms)
- [x] Document API in OpenAPI / Swagger (FastAPI auto-docs)
- [x] API versioning strategy (`/api/v1/*`, deprecation policy on legacy `/api/*`)

---



## 13. Error UX

Replace `alert()` and basic errors with production-grade feedback.

### Tasks

- [x] Inline error panel (replace `alert()`)
- [x] Show SQLGlot line/column in error messages
- [x] Click error → jump to line in SQL editor
- [x] Replace textarea with Monaco or CodeMirror editor
- [x] Syntax highlighting in SQL editor
- [x] Line numbers in SQL editor
- [x] Dialect-aware highlighting (where supported)
- [x] Warning panel for non-fatal parse issues (separate from errors)
- [x] Loading / parsing progress indicator for large queries

---



## Enterprise Deployment Model


| Model              | Fit                                   |
| ------------------ | ------------------------------------- |
| SaaS multi-tenant  | Auth, tenant isolation, usage billing |
| Single-tenant VPC  | Docker/K8s Helm chart, customer cloud |
| Air-gapped on-prem | No external deps, offline SQLGlot     |




### Phase 1 — Local / demo (Docker)

Single-container image: FastAPI + built React UI on one port.


| Task                                                                | Status |
| ------------------------------------------------------------------- | ------ |
| Multi-stage `deploy/Dockerfile` (build UI → copy into Python image) | [x]    |
| `deploy/docker-compose.yml` for local runs                          | [x]    |
| `GET /health` for container healthcheck                             | [x]    |
| Same-origin API URL when UI is served by the app                    | [x]    |


```bash
docker compose -f deploy/docker-compose.yml up --build
# UI + API → http://localhost:8080
```



### Phase 2 — Production / enterprise (later)


| Task                                                                  | Status |
| --------------------------------------------------------------------- | ------ |
| Kubernetes Helm chart                                                 | [ ]    |
| Helm: HPA, ingress, secrets templates                                 | [ ]    |
| SBOM generation                                                       | [ ]    |
| Dependency scanning (Dependabot / Snyk)                               | [ ]    |
| SaaS: multi-tenant data isolation                                     | [ ]    |
| SaaS: usage metering / billing hooks                                  | [ ]    |
| VPC deploy guide and reference architecture                           | [ ]    |
| Air-gapped / on-prem deploy guide (no external network)               | [ ]    |
| SOC2-oriented docs: data retention policy (SQL not stored by default) | [ ]    |
| SOC2-oriented docs: encryption (TLS, at-rest)                         | [ ]    |
| SOC2-oriented docs: access controls and audit requirements            | [ ]    |


---



## Suggested Roadmap (Timeline)


| Phase             | Items                                                                        | Target    |
| ----------------- | ---------------------------------------------------------------------------- | --------- |
| **P0 Foundation** | Pin deps, Docker, CI, auth, rate limits, audit log, parser tests, API schema | ~5 weeks  |
| **P1 Product**    | Dialect selector, Monaco editor, column-level lineage, export, workspaces    | ~11 weeks |
| **P2 Enterprise** | Catalog integration, impact analysis, diff mode, K8s Helm, observability     | ~13 weeks |




### P0 Foundation

- [~] Pin all Python and npm dependencies (`requirements.txt` unpinned; `package.json` uses semver ranges)
- [x] Fix missing frontend deps in `package.json`
- [x] Docker + docker-compose (Phase 1 — see Enterprise Deployment Model)
- [ ] CI: lint, test, build on every PR
- [ ] Authentication (JWT / OIDC)
- [ ] Rate limiting and request size caps
- [ ] Audit logging
- [x] Parser test suite (pytest + golden files — **39 tests** in `backend/tests/`)
- [x] Initial API schema (section 12 — `/api/v1/*`, contract `1.0`, stats, deprecation policy)



### P1 Product

- [x] Dialect selector (section 6)
- [x] CodeMirror editor (section 13)
- [x] Column-level lineage (section 4)
- [x] Export PNG / JSON / OpenLineage (section 8)
- [x] Graph / Table view + pipeline table (section 9)
- [ ] Save / share workspaces (section 7)



### P2 Enterprise

- [ ] Catalog integration (section 5)
- [ ] Catalog-backed impact analysis (section 5)
- [x] In-session diff mode (section 9 — compare two renders)
- [ ] K8s Helm + observability (sections 10, deployment)
- [x] Architecture refactor (section 11)

---



## Quick Wins (Optional — can parallelize with P0)

- [x] Dialect dropdown + `VITE_API_URL` env var
- [x] Add pytest cases using `backend/tests/fixtures/notworking.sql` and simpler inline fixtures
- [~] Pin `requirements.txt` and `package.json` deps (deps present; strict pinning pending)
- [x] Delete commented-out code in `main.py` and `bkp_app_jsx`
- [x] Add `GET /health` endpoint
- [ ] SQL size validation (e.g. max 500KB)
- [x] Replace `alert()` with inline error banner
- [x] Add pytest cases using `backend/tests/fixtures/notworking.sql` and simpler inline fixtures

---



## Changelog


| Date       | Item                                 | Notes                                                                                                  |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 2026-08-28 | Section 9 — Table view & UNION UX    | Graph/Table toggle, pipeline table, UNION nodes, Author/Explore/Zen, theme, layout polish            |
| 2026-08-28 | Section 5 — Catalog design doc       | Phased plan in `docs/CATALOG.md`; optional enrich, mock local testing                                  |
| 2026-08-28 | Section 8 — Export & embed           | PNG/SVG/PDF export, JSON/CSV/OpenLineage API, embed mode, `/api/v1/lineage`                            |
| 2026-08-28 | Section 12 — API contract versioning | `/api/v1/*`, `GET /api/v1/version`, `stats` block, NodeKind/EdgeType enums, legacy deprecation headers |
| 2026-08-28 | Section 6 — Multi-dialect            | Dialect selector, detect API, editor highlighting map                                                  |
| 2026-08-28 | Section 13 — Error UX                | CodeMirror editor, inline errors with line/col, jump-to-error, warning panel                           |
| 2026-08-27 | Section 9 — Advanced graph UX        | Layouts, filter, focus, breadcrumbs, shortcuts, diff, column trace                                     |
| 2026-08-27 | Section 4 — Lineage accuracy         | Column lineage, node kinds, per-join nodes, DML support, warnings UI                                   |
| 2026-08-27 | Section 11 — Architecture refactor   | Split backend + frontend monolith; 5 pytest tests passing                                              |


