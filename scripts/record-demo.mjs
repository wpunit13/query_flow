/**
 * Record README demo GIFs with Playwright (headless).
 *
 * Captures current UI: Explore mode, TB/LR layouts, Graph/Table toggle, column trace,
 * pipeline stage graph (macro boxes), table pipeline tab.
 *
 * Requires:
 *   - Backend: http://127.0.0.1:8000/health
 *   - Frontend: http://127.0.0.1:5173
 *
 * Usage: npm run record   (from scripts/)
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const ASSETS = resolve(ROOT, 'docs/assets');
const FIXTURE_SQL = resolve(ROOT, 'backend/tests/fixtures/notworking.sql');
const PIPELINE_FIXTURE_SQL = resolve(
  ROOT,
  'backend/tests/fixtures/large_multifeature.sql'
);
const UI_URL = process.env.DEMO_UI_URL || 'http://127.0.0.1:5173';
const API_HEALTH = process.env.DEMO_API_URL || 'http://127.0.0.1:8000/health';

const FALLBACK_SQL = `WITH cte1 AS (
  SELECT u.id, o.amount
  FROM users u
  JOIN orders o ON u.id = o.user_id
)
SELECT id, amount FROM cte1`;

function loadSqlFile(path, label) {
  if (existsSync(path)) {
    return readFileSync(path, 'utf8');
  }
  console.warn(`Fixture not found (${path}), ${label}`);
  return null;
}

function loadDemoSql() {
  const sql = loadSqlFile(FIXTURE_SQL, 'using fallback SQL');
  if (sql) return sql;
  return FALLBACK_SQL;
}

function loadPipelineDemoSql() {
  const sql = loadSqlFile(PIPELINE_FIXTURE_SQL, 'falling back to default demo SQL');
  return sql || DEMO_SQL;
}

const DEMO_SQL = loadDemoSql();
const PIPELINE_DEMO_SQL = loadPipelineDemoSql();

mkdirSync(ASSETS, { recursive: true });

async function waitForServices() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const health = await fetch(API_HEALTH);
      if (!health.ok) throw new Error('health not ok');
      const ui = await fetch(UI_URL);
      if (!ui.ok) throw new Error('ui not ok');
      return;
    } catch {
      await sleep(1500);
    }
  }
  throw new Error(
    `Services not ready. Start backend (uvicorn main:app) and UI (npm run dev), then retry.\n  API: ${API_HEALTH}\n  UI:  ${UI_URL}`
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function captureFrames(page, count, delayMs) {
  const frames = [];
  for (let i = 0; i < count; i += 1) {
    frames.push(await page.screenshot({ type: 'png' }));
    await sleep(delayMs);
  }
  return frames;
}

function pngBuffersToGif(frameBuffers, outPath, frameDelayMs = 120) {
  const encoder = GIFEncoder();
  let width = 0;
  let height = 0;

  for (const buffer of frameBuffers) {
    const png = PNG.sync.read(buffer);
    width = png.width;
    height = png.height;
    const palette = quantize(png.data, 256);
    const index = applyPalette(png.data, palette);
    encoder.writeFrame(index, width, height, { palette, delay: frameDelayMs });
  }

  encoder.finish();
  writeFileSync(outPath, Buffer.from(encoder.bytes()));
  return { width, height, frames: frameBuffers.length };
}

const LINEAGE_SESSION_KEYS = [
  'ls_session_sql',
  'ls_lineage_session_meta',
  'ls_lineage_session_result',
];

async function clearStoredLineageSession(page) {
  await page.evaluate((keys) => {
    for (const key of keys) {
      try {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }, LINEAGE_SESSION_KEYS);
}

/** Fresh Author page with SQL editor — avoids Explore restore hiding the editor. */
async function prepareRecordingPage(page) {
  await page.goto(UI_URL, { waitUntil: 'networkidle' });
  await clearStoredLineageSession(page);
  await sleep(600);
  await ensureSqlEditorReady(page);
}

async function ensureSqlEditorReady(page) {
  const editor = page.locator('.cm-editor .cm-content').first();
  try {
    await editor.waitFor({ state: 'visible', timeout: 3000 });
    return;
  } catch {
    /* Explore mode or session restore — open Author */
  }

  const editBtn = page.getByRole('button', { name: /^Edit SQL/i });
  if (await editBtn.count() > 0) {
    await editBtn.click();
    await sleep(500);
  } else {
    await page.keyboard.press('e');
    await sleep(500);
  }

  await editor.waitFor({ state: 'visible', timeout: 20_000 });
}

async function fillSqlEditor(page, sql) {
  await ensureSqlEditorReady(page);
  const editor = page.locator('.cm-editor .cm-content').first();
  await editor.click({ timeout: 20_000 });
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.insertText(sql);
  await sleep(sql.length > 4000 ? 1200 : 400);
}

async function waitForParseComplete(page, timeoutMs) {
  await page
    .locator('text=Restoring lineage')
    .waitFor({ state: 'hidden', timeout: timeoutMs })
    .catch(() => {});

  await page.waitForFunction(
    () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const parsing = buttons.some((b) => (b.textContent || '').includes('Parsing'));
      const graphReady = buttons.some((b) => /^Graph$/i.test((b.textContent || '').trim()));
      return !parsing && graphReady;
    },
    { timeout: timeoutMs }
  );
}

async function waitForGraphCanvas(page, timeoutMs = 60_000) {
  await ensureGraphView(page);
  await page.waitForSelector('.react-flow__node', { timeout: timeoutMs });
  await sleep(800);
}

async function renderDag(page, { timeoutMs = 180_000 } = {}) {
  const renderBtn = page.getByRole('button', { name: /Render DAG/i }).first();
  await renderBtn.click();
  await waitForParseComplete(page, timeoutMs);
  await waitForGraphCanvas(page, Math.min(timeoutMs, 120_000));
}

async function fitGraph(page) {
  await page.keyboard.press('f');
  await sleep(600);
}

/** Switch to flat table/join graph (Whole graph). */
async function ensureFlatGraph(page) {
  const wholeGraphBtn = page.getByRole('button', { name: /^Whole graph|Full graph$/i });
  if (await wholeGraphBtn.count() > 0) {
    await wholeGraphBtn.click();
    await sleep(900);
    return true;
  }
  const pipelineBtn = page.getByRole('button', { name: /^Pipeline stages$/i });
  return (await pipelineBtn.count()) === 0;
}

async function clickCanvasElement(locator) {
  if (await locator.count() > 0) {
    await locator.first().evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    });
    await sleep(500);
    return true;
  }
  return false;
}

/** Final output table node — do not filter on "(N cols)" (hidden when expanded). */
function finalOutputGraphNode(page) {
  return page
    .locator('.react-flow__node')
    .filter({ hasText: /Final View Output|Final_Output/i })
    .first();
}

async function expandTableNodeColumns(page, nodeLocator) {
  const expandToggle = nodeLocator.getByText('▼', { exact: true });
  if (await expandToggle.count() > 0) {
    await clickCanvasElement(expandToggle);
    await sleep(800);
    return true;
  }
  const collapseToggle = nodeLocator.getByText('▲', { exact: true });
  return (await collapseToggle.count()) > 0;
}

/** Overview: Author SQL → Render DAG → LR layout → Zen mode peek → Search → Node selection */
async function recordOverview(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepareRecordingPage(page);

  const frames = [];
  frames.push(...await captureFrames(page, 3, 200));

  await fillSqlEditor(page, DEMO_SQL);
  frames.push(...await captureFrames(page, 4, 200));

  await renderDag(page);
  frames.push(...await captureFrames(page, 6, 220));

  await fitGraph(page);
  frames.push(...await captureFrames(page, 3, 200));

  const lrBtn = page.getByRole('button', { name: /^→ LR/i });
  if (await lrBtn.count() > 0) {
    await lrBtn.click();
    await sleep(800);
    await fitGraph(page);
    frames.push(...await captureFrames(page, 6, 220));
  }

  // Zen mode demonstration
  await page.keyboard.press('z');
  await sleep(600);
  frames.push(...await captureFrames(page, 5, 220));
  await page.keyboard.press('z');
  await sleep(600);

  // Search demonstration
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.click();
    await page.keyboard.type('dept', { delay: 100 });
    await sleep(400);
    frames.push(...await captureFrames(page, 5, 220));
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  // Node selection & breadcrumb highlight
  const node = page.locator('.react-flow__node').first();
  if (await node.count() > 0) {
    await clickCanvasElement(node);
    frames.push(...await captureFrames(page, 6, 220));
  }

  const out = resolve(ASSETS, 'demo-overview.gif');
  const meta = pngBuffersToGif(frames, out, 130);
  console.log(`Wrote ${out} (${meta.width}x${meta.height}, ${meta.frames} frames)`);
}

/** Column trace on output — expand Final Output, click column, show upstream highlight */
async function recordColumnTrace(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepareRecordingPage(page);

  await fillSqlEditor(page, DEMO_SQL);
  await renderDag(page);
  await ensureGraphView(page);
  await ensureFlatGraph(page);
  await fitGraph(page);

  const frames = await captureFrames(page, 4, 200);

  const targetNode = finalOutputGraphNode(page);
  if (await targetNode.count() === 0) {
    console.warn('demo-column-trace: Final Output node not found');
    return;
  }

  await targetNode.scrollIntoViewIfNeeded();
  await expandTableNodeColumns(page, targetNode);

  const expandedNode = finalOutputGraphNode(page);
  const colRow = expandedNode
    .locator('div')
    .filter({ hasText: /department_path/i })
    .first();

  if (await colRow.count() === 0) {
    console.warn('demo-column-trace: department_path column row not found after expand');
    return;
  }

  await clickCanvasElement(colRow);
  await fitGraph(page);
  frames.push(...await captureFrames(page, 12, 280));

  const out = resolve(ASSETS, 'demo-column-trace.gif');
  const meta = pngBuffersToGif(frames, out, 130);
  console.log(`Wrote ${out} (${meta.width}x${meta.height}, ${meta.frames} frames)`);
}

/** Table view: Sources, Pipeline, Operations (with collapse/expand), Target tabs */
async function recordTableView(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepareRecordingPage(page);

  await fillSqlEditor(page, DEMO_SQL);
  await renderDag(page);

  const tableBtn = page.getByRole('button', { name: /^Table$/i });
  if (await tableBtn.count() === 0) {
    console.log('Skipped demo-table-view.gif (Table toggle not found)');
    return;
  }

  await tableBtn.click();
  await sleep(600);

  const frames = [];

  // Sources tab
  const sourcesTab = page.getByRole('button', { name: /^Sources/i });
  if (await sourcesTab.count() > 0) {
    await sourcesTab.click();
    await sleep(400);
    frames.push(...await captureFrames(page, 4, 220));
  }

  // Pipeline tab
  const pipelineTab = page.getByRole('button', { name: /^Pipeline/i });
  if (await pipelineTab.count() > 0) {
    await pipelineTab.click();
    await sleep(400);
    const stageRow = page.locator('table tbody tr').nth(1);
    if (await stageRow.count() > 0) {
      await stageRow.click();
      frames.push(...await captureFrames(page, 5, 220));
    }
  }

  // Operations tab with stage collapse and inspector
  const operationsTab = page.getByRole('button', { name: /^Operations/i });
  if (await operationsTab.count() > 0) {
    await operationsTab.click();
    await sleep(500);
    frames.push(...await captureFrames(page, 4, 220));

    // Toggle expand all
    const expandAllBtn = page.getByRole('button', { name: /Expand All/i });
    if (await expandAllBtn.count() > 0) {
      await expandAllBtn.click();
      await sleep(400);
      frames.push(...await captureFrames(page, 4, 220));
    }

    // Select an operation row to inspect details
    const opRow = page.locator('table tbody tr').nth(2);
    if (await opRow.count() > 0) {
      await opRow.click();
      frames.push(...await captureFrames(page, 6, 220));
    }
  }

  // Target tab
  const targetTab = page.getByRole('button', { name: /^Target|Output/i });
  if (await targetTab.count() > 0) {
    await targetTab.click();
    await sleep(400);
    frames.push(...await captureFrames(page, 5, 220));
  }

  if (frames.length > 4) {
    const out = resolve(ASSETS, 'demo-table-view.gif');
    const meta = pngBuffersToGif(frames, out, 130);
    console.log(`Wrote ${out} (${meta.width}x${meta.height}, ${meta.frames} frames)`);
  } else {
    console.log('Skipped demo-table-view.gif (no table rows captured)');
  }
}

async function ensureGraphView(page) {
  const graphBtn = page.getByRole('button', { name: /^Graph$/i });
  if (await graphBtn.count() > 0) {
    await graphBtn.click();
    await sleep(400);
  }
}

/** Switch to macro pipeline stage boxes. */
async function ensurePipelineStageGraph(page) {
  const pipelineBtn = page.getByRole('button', { name: /^Pipeline stages$/i });
  const wholeGraphBtn = page.getByRole('button', { name: /^Whole graph|Full graph$/i });

  if (await pipelineBtn.count() > 0) {
    await pipelineBtn.click();
    await sleep(700);
    return true;
  }
  if (await wholeGraphBtn.count() > 0) {
    return true;
  }
  return false;
}

/** Pipeline stage graph + Whole graph toggle, expand stage, Export menu */
async function recordPipelineStages(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepareRecordingPage(page);

  await fillSqlEditor(page, PIPELINE_DEMO_SQL);
  await renderDag(page, { timeoutMs: 300_000 });
  await ensureGraphView(page);
  await fitGraph(page);
  await sleep(1200);

  const pipelineAvailable = await ensurePipelineStageGraph(page);
  if (!pipelineAvailable) {
    console.log(
      'Skipped demo-pipeline-stages.gif (no Pipeline stages / Whole graph toggle — query may be too small or not a CTE pipeline)'
    );
    return;
  }

  await fitGraph(page);
  const frames = await captureFrames(page, 5, 220);

  // Expand a macro stage box
  const expandBtn = page
    .locator('.react-flow__node')
    .getByRole('button', { name: /^Expand$/i })
    .first();
  if (await expandBtn.count() > 0) {
    await clickCanvasElement(expandBtn);
    await fitGraph(page);
    frames.push(...await captureFrames(page, 5, 240));
  }

  // Click stage node for highlight
  const stageNode = page.locator('.react-flow__node').filter({
    hasText: /CTE|OUTPUT|Final/i,
  }).first();
  if (await stageNode.count() > 0) {
    await clickCanvasElement(stageNode);
    frames.push(...await captureFrames(page, 4, 220));
  }

  // Switch to Whole graph flat view
  const wholeGraphBtn = page.getByRole('button', { name: /^Whole graph|Full graph$/i });
  if (await wholeGraphBtn.count() > 0) {
    await wholeGraphBtn.click();
    await sleep(900);
    await fitGraph(page);
    frames.push(...await captureFrames(page, 6, 220));

    // Switch back to Pipeline stages
    const pipelineBtn = page.getByRole('button', { name: /^Pipeline stages$/i });
    if (await pipelineBtn.count() > 0) {
      await pipelineBtn.click();
      await sleep(800);
      await fitGraph(page);
      frames.push(...await captureFrames(page, 4, 220));
    }
  }

  // Open Export Menu showcasing formats
  const exportBtn = page.getByRole('button', { name: /Export/i }).first();
  if (await exportBtn.count() > 0) {
    await exportBtn.click();
    await sleep(400);
    frames.push(...await captureFrames(page, 6, 250));
    await exportBtn.click();
  }

  const out = resolve(ASSETS, 'demo-pipeline-stages.gif');
  const meta = pngBuffersToGif(frames, out, 130);
  console.log(`Wrote ${out} (${meta.width}x${meta.height}, ${meta.frames} frames)`);
}

async function main() {
  console.log('Waiting for API and UI…');
  await waitForServices();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript((keys) => {
    for (const key of keys) {
      try {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }, LINEAGE_SESSION_KEYS);
  const page = await context.newPage();

  try {
    await recordOverview(page);
    await recordColumnTrace(page);
    await recordTableView(page);
    await recordPipelineStages(page);
  } finally {
    await context.close();
    await browser.close();
  }

  // Playwright may leave extra webm artifacts — remove all (GIFs are the deliverable)
  const { readdirSync, unlinkSync } = await import('fs');
  for (const file of readdirSync(ASSETS)) {
    if (
      file.endsWith('.webm') ||
      file.endsWith('.mp4') ||
      file.endsWith('.mov') ||
      file.startsWith('page@')
    ) {
      unlinkSync(resolve(ASSETS, file));
    }
  }

  console.log('Done. Commit docs/assets/*.gif for README.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
