# README demo assets

Animated demos for the main [readme.md](../readme.md). Files here are **screen captures** (GIF or MP4), not live apps.

## Files

| `demo-overview.gif` | Complex SQL → Render → LR layout → Table peek → graph selection (**commit to git**) |
| `demo-column-trace.gif` | Expand node → trace a column upstream (**commit to git**) |
| `demo-table-view.gif` | Table view → Pipeline tab → stage detail (**commit to git**, shown in main README) |

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

## Record manually

1. Record with **Kap**, **CleanShot**, or **QuickTime** (1280×720, 10–20 s).
2. Export GIF (Kap) or convert with ffmpeg:

```bash
ffmpeg -i recording.mov -vf "fps=12,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  -t 20 docs/assets/demo-overview.gif
```

3. Keep files under ~8 MB when possible.

## README embed

```markdown
![Demo — overview](docs/assets/demo-overview.gif)
![Demo — column trace](docs/assets/demo-column-trace.gif)
![Demo — table view](docs/assets/demo-table-view.gif)
```
