/**
 * Record README demo GIFs with Playwright (headless).
 *
 * Captures current UI: Explore mode, TB/LR layouts, Graph/Table toggle, column trace.
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
const UI_URL = process.env.DEMO_UI_URL || 'http://127.0.0.1:5173';
const API_HEALTH = process.env.DEMO_API_URL || 'http://127.0.0.1:8000/health';

const FALLBACK_SQL = `WITH cte1 AS (
  SELECT u.id, o.amount
  FROM users u
  JOIN orders o ON u.id = o.user_id
)
SELECT id, amount FROM cte1`;

function loadDemoSql() {
  if (existsSync(FIXTURE_SQL)) {
    return readFileSync(FIXTURE_SQL, 'utf8');
  }
  console.warn(`Fixture not found (${FIXTURE_SQL}), using fallback SQL`);
  return FALLBACK_SQL;
}

const DEMO_SQL = loadDemoSql();

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

async function fillSqlEditor(page, sql) {
  const editor = page.locator('.cm-editor .cm-content').first();
  await editor.click({ timeout: 15_000 });
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.insertText(sql);
  await sleep(400);
}

async function renderDag(page) {
  const renderBtn = page.getByRole('button', { name: /Render DAG/i }).first();
  await renderBtn.click();
  await page.waitForSelector('.react-flow__node', { timeout: 90_000 });
  await sleep(800);
}

async function fitGraph(page) {
  await page.keyboard.press('f');
  await sleep(600);
}

/** Overview: complex SQL → TB graph → LR layout → table pipeline peek → graph selection */
async function recordOverview(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(UI_URL, { waitUntil: 'networkidle' });
  await sleep(600);

  const frames = [];
  frames.push(...await captureFrames(page, 3, 200));

  await fillSqlEditor(page, DEMO_SQL);
  frames.push(...await captureFrames(page, 3, 200));

  await renderDag(page);
  frames.push(...await captureFrames(page, 8, 220));

  await fitGraph(page);
  frames.push(...await captureFrames(page, 4, 200));

  const lrBtn = page.getByRole('button', { name: /^→ LR/i });
  if (await lrBtn.count() > 0) {
    await lrBtn.click();
    await sleep(900);
    await fitGraph(page);
    frames.push(...await captureFrames(page, 8, 220));
  }

  const tableBtn = page.getByRole('button', { name: /^Table$/i });
  if (await tableBtn.count() > 0) {
    await tableBtn.click();
    await sleep(500);
    const pipelineTab = page.getByRole('button', { name: /^Pipeline$/i });
    if (await pipelineTab.count() > 0) {
      await pipelineTab.click();
      await sleep(400);
    }
    frames.push(...await captureFrames(page, 6, 220));
    const graphBtn = page.getByRole('button', { name: /^Graph$/i });
    if (await graphBtn.count() > 0) {
      await graphBtn.click();
      await sleep(400);
    }
  }

  const node = page.locator('.react-flow__node').first();
  if (await node.count() > 0) {
    await node.click();
    frames.push(...await captureFrames(page, 5, 200));
  }

  const out = resolve(ASSETS, 'demo-overview.gif');
  const meta = pngBuffersToGif(frames, out, 130);
  console.log(`Wrote ${out} (${meta.width}x${meta.height}, ${meta.frames} frames)`);
}

/** Column trace on output / stage with expandable columns */
async function recordColumnTrace(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(UI_URL, { waitUntil: 'networkidle' });
  await sleep(400);

  await fillSqlEditor(page, DEMO_SQL);
  await renderDag(page);
  await fitGraph(page);

  const frames = await captureFrames(page, 4, 200);

  const outputNode = page.locator('.react-flow__node').filter({
    hasText: /Final|Output|cte1/i,
  }).first();
  const targetNode =
    (await outputNode.count() > 0)
      ? outputNode
      : page.locator('.react-flow__node').first();

  if (await targetNode.count() > 0) {
    await targetNode.click();
    await sleep(300);
    const expandToggle = targetNode.getByText('▼');
    if (await expandToggle.count() > 0) {
      await expandToggle.click();
      frames.push(...await captureFrames(page, 5, 200));
      const trace = targetNode.getByText('trace', { exact: true }).first();
      if (await trace.count() > 0) {
        await trace.click();
        frames.push(...await captureFrames(page, 10, 250));
      }
    }
  }

  if (frames.length > 6) {
    const out = resolve(ASSETS, 'demo-column-trace.gif');
    const meta = pngBuffersToGif(frames, out, 130);
    console.log(`Wrote ${out} (${meta.width}x${meta.height}, ${meta.frames} frames)`);
  } else {
    console.log('Skipped demo-column-trace.gif (no expandable columns / trace control found)');
  }
}

/** Table view: pipeline stages + stage detail panel */
async function recordTableView(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(UI_URL, { waitUntil: 'networkidle' });
  await sleep(400);

  await fillSqlEditor(page, DEMO_SQL);
  await renderDag(page);

  const tableBtn = page.getByRole('button', { name: /^Table$/i });
  if (await tableBtn.count() === 0) {
    console.log('Skipped demo-table-view.gif (Table toggle not found)');
    return;
  }

  await tableBtn.click();
  await sleep(500);

  const pipelineTab = page.getByRole('button', { name: /^Pipeline$/i });
  if (await pipelineTab.count() > 0) {
    await pipelineTab.click();
    await sleep(400);
  }

  const frames = await captureFrames(page, 4, 200);

  const stageRow = page.locator('table tbody tr').nth(1);
  if (await stageRow.count() > 0) {
    await stageRow.click();
    frames.push(...await captureFrames(page, 10, 250));
    const clearBtn = page.getByRole('button', { name: /^Clear$/i });
    if (await clearBtn.count() > 0) {
      await clearBtn.click();
      frames.push(...await captureFrames(page, 4, 200));
    }
  }

  if (frames.length > 4) {
    const out = resolve(ASSETS, 'demo-table-view.gif');
    const meta = pngBuffersToGif(frames, out, 130);
    console.log(`Wrote ${out} (${meta.width}x${meta.height}, ${meta.frames} frames)`);
  } else {
    console.log('Skipped demo-table-view.gif (no pipeline rows found)');
  }
}

async function main() {
  console.log('Waiting for API and UI…');
  await waitForServices();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await recordOverview(page);
    await recordColumnTrace(page);
    await recordTableView(page);
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
