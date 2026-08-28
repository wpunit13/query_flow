# README demo assets

Animated demos for the main [readme.md](../readme.md). Files here are **screen captures** (GIF or MP4), not live apps.

## Files

| `demo-overview.gif` | Paste SQL → Render DAG → explore lineage graph (**commit to git**) |
| `demo-column-trace.gif` | Expand node → trace a column upstream (**commit to git**) |
| `demo-overview.webm` / `.mp4` | Local recorder output — **gitignored** (use GIF in README) |

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

# Terminal 3 — record (installs Playwright once)
cd scripts && npm install && npx playwright install chromium
node record-demo.mjs
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
![Demo — render and explore](docs/assets/demo-overview.gif)
```

Or video:

```markdown
<video src="docs/assets/demo-overview.mp4" autoplay loop muted playsinline width="100%"></video>
```
