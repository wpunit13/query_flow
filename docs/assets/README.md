# README demo assets

Animated demos for the main [readme.md](../readme.md). Files here are **screen captures** (GIF), not live apps.

## Files

| File | What it shows | SQL fixture (`scripts/record-demo.mjs`) |
|------|----------------|----------------------------------------|
| `demo-overview.gif` | Author SQL → Parse DAG → LR layout → Zen mode peek → Search → Node selection | `notworking.sql` |
| `demo-column-trace.gif` | Expand node → **trace** column → upstream lineage highlight across CTEs | `notworking.sql` |
| `demo-table-view.gif` | **Table** view → **Sources**, **Pipeline**, **Operations** (with stage collapse/expand), **Target** tabs | `notworking.sql` |
| `demo-pipeline-stages.gif` | **Pipeline stages** macro view → expand stage → **Whole graph** flat view → **Export** menu | `large_multifeature.sql` |

All four GIFs are produced by a single run: `cd scripts && npm run record`.

Scratch video from Playwright (`*.webm`, `page@*`) is deleted automatically after each run.

## Git policy

| Track in git | Ignored (see root `.gitignore`) |
|--------------|----------------------------------|
| `*.gif` in this folder | `*.webm`, `*.mp4`, `*.mov`, Playwright `page@*` artifacts |
| `README.md` (this file) | `scripts/node_modules/` |

## Record locally (automated)

**Prerequisites:** Node 18+, Python backend deps installed.

```bash
# Terminal 1 — API
uvicorn main:app --port 8000

# Terminal 2 — UI
cd sql-visualizer-ui && npm run dev

# Terminal 3 — record (installs Playwright + Chromium once, ~100MB cache in scripts/.playwright-browsers/)
cd scripts && npm install && npx playwright install chromium
npm run record
```

Output is written to this folder (`docs/assets/`).

Each GIF segment clears stored lineage session keys and opens **Edit SQL** if needed (after the first recording, Explore mode hides the editor).

## Record manually

1. Record with **Kap**, **CleanShot**, or **QuickTime** (1280×720, 10–20 s).
2. Export GIF (Kap) or convert with ffmpeg:

```bash
ffmpeg -i recording.mov -vf "fps=12,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  -t 20 docs/assets/demo-overview.gif
```

3. Keep files under ~8 MB when possible.

## README embed

See section **Demo** in [readme.md](../readme.md) for captions paired with each GIF.
