# Embed SQL Lineage Studio

Embed the lineage graph in an internal portal via **iframe** or a deep link with query parameters.

## iframe

```html
<iframe
  src="http://localhost:5173/?embed=1&dialect=bigquery&sql=SELECT%20id%20FROM%20users"
  width="100%"
  height="720"
  style="border: 1px solid #e2e8f0; border-radius: 8px;"
  title="SQL Lineage"
></iframe>
```

When served from Docker (`http://localhost:8080`), use the same origin:

```html
<iframe src="http://localhost:8080/?embed=1&sql=SELECT%201"></iframe>
```

## URL parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `embed` | yes | Set to `1` to hide the SQL editor header and use graph-only chrome |
| `sql` | optional | URL-encoded SQL to parse on load |
| `dialect` | optional | SQLGlot dialect id (default: `bigquery`) |

## Notes

- Embed mode still shows the graph toolbar (layout, filter, export).
- Large SQL in query strings may hit browser URL length limits — for CI or portals, use the API (`POST /api/v1/lineage`) instead.
- Cross-origin embeds require the API host to allow your portal origin (dev: `localhost` / `127.0.0.1`).

## API-first (CI/CD)

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/lineage \
  -H 'Content-Type: application/json' \
  -d '{"sql":"SELECT id FROM users","dialect":"bigquery"}' | jq .stats
```

Export formats:

- `POST /api/v1/export/json` — versioned lineage JSON
- `POST /api/v1/export/csv` — flattened nodes/edges CSV
- `POST /api/v1/export/openlineage` — OpenLineage event (Marquez-compatible ingestion)
