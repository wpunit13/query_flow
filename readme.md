# SQL Lineage Studio (QueryFlow)

Untangle massive, complex SQL queries in seconds. SQL Lineage Studio is an interactive visualization tool that converts nested CTEs, subqueries, and multi-statement SQL into a clean, navigable data lineage graph (DAG).

Built for data engineers and analysts who need to debug long, production-grade queries without losing context.

![Tech stack: React Flow + FastAPI + SQLGlot](https://img.shields.io/badge/React-18-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-API-green) ![SQLGlot](https://img.shields.io/badge/SQLGlot-parser-orange)

---

## Features

### Core lineage graph

- **Interactive DAG layout** — Parses SQL and renders a directional graph with `dagre` and React Flow.
- **CTE & subquery support** — Each CTE, subquery, and final output is a distinct node with correct upstream wiring.
- **Join condition extraction** — Join nodes show `ON` / `USING` conditions; expand to read full join logic.
- **Per-join nodes** — Separate join steps with type preserved (`LEFT JOIN`, `INNER JOIN`, etc.) and order in the chain.
- **Multi-dialect parsing** — Powered by SQLGlot (BigQuery default; Postgres, Snowflake, Spark, and others supported server-side).
- **Complex SQL preprocessing** — Handles patterns like `LATERAL` joins with parse warnings surfaced in the UI.

### Lineage accuracy

- **Node kinds** — Visual badges for `TABLE`, `CTE`, `SUBQUERY`, `VIEW`, `OUTPUT`, `INSERT`, `MERGE`, and more.
- **Qualified names** — Supports `schema.table` and `database.schema.table` where present in SQL.
- **Column-level lineage** — Output columns include upstream source references via SQLGlot’s lineage API.
- **Column trace mode** — Expand a node and click **trace** on any column to highlight its upstream path and source tables.
- **DML / DDL statements** — Lineage for `SELECT`, `INSERT`, `CREATE VIEW`, and `MERGE`.

### Graph interaction

- **Lineage highlighting** — Click a node to highlight upstream and downstream paths; unrelated nodes dim.
- **Upstream hide/show** — Hide upstream dependencies per node without re-layout (positions stay stable).
- **Smart search** — Find tables, columns, or lineage source names; press `Enter` to cycle through matches.
- **Branch filter** — Filter the graph to paths involving a specific table or CTE name.
- **Focus branch** — Show only upstream or only downstream of the selected node.
- **Breadcrumb path** — See the lineage path to the selected node (e.g. `users → join → cte1 → Final_Output`).
- **Collapsed columns by default** — Nodes show a column count; expand to inspect schema and lineage.
- **Interactive minimap** — Draggable, zoomable minimap with color coding matching node types.
- **Fit view for large graphs** — Auto-fit on render with deep zoom-out for complex queries.

### Layout & comparison

- **Layout modes**
  - **TB** — Top-to-bottom (default)
  - **LR** — Left-to-right
  - **Radial** — Concentric layout for overview-style reading
- **Diff mode** — Compare two renders of the same query; new nodes and edges highlighted in green.
- **Reset canvas** — Restore full visibility, collapse state, and layout in one click.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `F` | Fit graph to view |
| `R` | Reset canvas |
| `Esc` | Clear selection and focus |
| `U` | Focus upstream of selected node |
| `D` | Focus downstream of selected node |
| `1` | Layout: top-to-bottom |
| `2` | Layout: left-to-right |
| `3` | Layout: radial |
| `?` | Show shortcuts help |
| `Enter` | Cycle search matches (in search box) |

---

## Tech stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | React 18, Vite, [@xyflow/react](https://reactflow.dev/), [dagre](https://github.com/dagrejs/dagre) |
| **Backend** | Python 3.10+, [FastAPI](https://fastapi.tiangolo.com/), [SQLGlot](https://github.com/tobymao/sqlglot), Pydantic |
| **API** | REST `POST /api/parse-sql` — versioned JSON with nodes, edges, warnings, and column lineage |

### Project structure

```
backend/
  api/routes/lineage.py       # API routes
  models/lineage.py           # Pydantic schemas
  services/lineage_parser.py  # AST → graph
  services/sql_preprocessor.py
  tests/

sql-visualizer-ui/
  src/components/             # Graph canvas, toolbar, nodes
  src/hooks/                  # Lineage graph & layout logic
  src/utils/                  # Dagre layout, diff, path utilities
  src/api/lineageClient.js

main.py                       # FastAPI entrypoint
```

---

## Getting started

Run the **backend** and **frontend** in separate terminals.

### Prerequisites

- Node.js 18+ (recommended)
- Python 3.10+

### 1. Backend (FastAPI)

```bash
cd /path/to/hackathon

python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload
```

API runs at **http://127.0.0.1:8000**  
OpenAPI docs: **http://127.0.0.1:8000/docs**

### 2. Frontend (React)

```bash
cd sql-visualizer-ui

npm install
npm run dev
```

Open **http://localhost:5173**

Optional — custom API URL (`sql-visualizer-ui/.env`):

```env
VITE_API_URL=http://127.0.0.1:8000
```

### 3. Run tests

```bash
pytest
```

---

## Usage tips

1. Paste SQL into the editor and click **Render DAG**.
2. Use the **graph toolbar** for layout, branch filter, focus, and diff mode.
3. Expand a node and click **trace** on a column for column-level lineage.
4. Use **Hide** on a node to collapse upstream tables without moving the graph.
5. Try `notworking.sql` in the repo for a stress test (recursive CTEs, lateral joins, `MERGE`, `ROLLUP`, etc.).

---

## Roadmap

Enterprise and production hardening items are tracked in [ENTERPRISE_ROADMAP.md](ENTERPRISE_ROADMAP.md).

**Completed:** architecture refactor, lineage accuracy (section 4), advanced graph UX (section 9).

**Planned:** catalog integration, export (PNG/OpenLineage), workspace save/share, auth, observability, and deployment (Docker/K8s).

---

## License

See repository license. Contributions welcome.
