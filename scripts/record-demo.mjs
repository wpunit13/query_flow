/**
 * Record README demo GIFs with Playwright (headless).
 *
 * Requires:
 *   - Backend: http://127.0.0.1:8000/health
 *   - Frontend: http://127.0.0.1:5173
 *
 * Usage: node record-demo.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const ASSETS = resolve(ROOT, 'docs/assets');
const UI_URL = process.env.DEMO_UI_URL || 'http://127.0.0.1:5173';
const API_HEALTH = process.env.DEMO_API_URL || 'http://127.0.0.1:8000/health';

const DEMO_SQL = `WITH cte1 AS (
  SELECT u.id, o.amount
  FROM users u
  JOIN orders o ON u.id = o.user_id
)
SELECT id, amount FROM cte1`;

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

async function recordOverview(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(UI_URL, { waitUntil: 'networkidle' });
  await sleep(800);

  const frames = [];
  frames.push(...await captureFrames(page, 4, 200));

  const renderBtn = page.getByRole('button', { name: /Render DAG/i }).first();
  await renderBtn.click();

  await page.waitForSelector('.react-flow__node', { timeout: 30_000 });
  frames.push(...await captureFrames(page, 12, 250));

  await page.mouse.wheel(0, 80);
  frames.push(...await captureFrames(page, 4, 200));

  const node = page.locator('.react-flow__node').first();
  if (await node.count() > 0) {
    await node.click();
    frames.push(...await captureFrames(page, 6, 200));
  }

  const out = resolve(ASSETS, 'demo-overview.gif');
  const meta = pngBuffersToGif(frames, out, 130);
  console.log(`Wrote ${out} (${meta.width}x${meta.height}, ${meta.frames} frames)`);
}

async function recordColumnTrace(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(UI_URL, { waitUntil: 'networkidle' });

  const renderBtn = page.getByRole('button', { name: /Render DAG/i }).first();
  await renderBtn.click();
  await page.waitForSelector('.react-flow__node', { timeout: 30_000 });
  await sleep(600);

  const frames = await captureFrames(page, 4, 200);

  const expandToggle = page.locator('.react-flow__node').first().getByText('▼');
  if (await expandToggle.count() > 0) {
    await expandToggle.click();
    frames.push(...await captureFrames(page, 6, 200));
    const trace = page.getByText('trace').first();
    if (await trace.count() > 0) {
      await trace.click();
      frames.push(...await captureFrames(page, 10, 250));
    }
  }

  if (frames.length > 6) {
    const out = resolve(ASSETS, 'demo-column-trace.gif');
    const meta = pngBuffersToGif(frames, out, 130);
    console.log(`Wrote ${out} (${meta.width}x${meta.height}, ${meta.frames} frames)`);
  } else {
    console.log('Skipped demo-column-trace.gif (no expandable columns found)');
  }
}

async function main() {
  console.log('Waiting for API and UI…');
  await waitForServices();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: ASSETS,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();

  try {
    await recordOverview(page);
    await recordColumnTrace(page);
  } finally {
    await context.close();
    await browser.close();
  }

  // Playwright may leave extra webm artifacts — keep only demo-overview.webm
  const { readdirSync, renameSync, existsSync, unlinkSync } = await import('fs');
  for (const file of readdirSync(ASSETS)) {
    if (file.endsWith('.webm') && file !== 'demo-overview.webm') {
      unlinkSync(resolve(ASSETS, file));
    }
  }
  const webm = readdirSync(ASSETS).find((f) => f.endsWith('.webm') && f !== 'demo-overview.webm');
  if (webm) {
    unlinkSync(resolve(ASSETS, webm));
  }
  if (existsSync(resolve(ASSETS, 'demo-overview.webm'))) {
    console.log(`Wrote ${resolve(ASSETS, 'demo-overview.webm')} (optional — convert to mp4 with ffmpeg)`);
  }

  console.log('Done. Commit docs/assets/*.gif for README.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
