// Typography visual-regression scaffold (S9 PR7 — 2026-04-26).
//
// Captures full-page screenshots of every route at three viewports into
// tests-e2e/snapshots/{baseline|current}/. The diff itself is left to the
// reviewer's preferred tool (Playwright trace viewer, ImageMagick `compare`,
// `dssim`, or simply opening pairs side-by-side). This script is the
// CAPTURE half — establishing and curating the baseline is owner work.
//
// Why no in-tree pixel diff: PNG byte equality is too strict (anti-aliasing
// jitter triggers false positives across machines) and a "fuzzy" diff
// would need a real lib like `pixelmatch`. We avoid the dep + complexity
// here and document the manual workflow instead.
//
// Usage:
//   1. Start dev server: npm run dev
//   2. Capture baseline (one-off, after typography work stabilises):
//        node scripts/typography-snapshots.mjs --baseline
//      → writes tests-e2e/snapshots/baseline/{viewport}-{slug}.png
//   3. Capture current (every CI run / after each PR):
//        node scripts/typography-snapshots.mjs
//      → writes tests-e2e/snapshots/current/{viewport}-{slug}.png
//   4. Diff: `compare baseline/desktop-economics.png current/desktop-economics.png diff.png`
//      (ImageMagick) or open both files in any image viewer.
//
// The baseline directory is committed; the current directory is gitignored
// (regenerable). Diffs that survive review become the new baseline.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'http://localhost:5173';
const isBaseline = process.argv.includes('--baseline');
const OUT_DIR = resolve('tests-e2e/snapshots', isBaseline ? 'baseline' : 'current');

const PAGES = [
  { slug: 'dashboard',     path: '/' },
  { slug: 'economics',     path: '/economics' },
  { slug: 'sensitivity',   path: '/sensitivity' },
  { slug: 'portfolio',     path: '/portfolio' },
  { slug: 'financial',     path: '/financial' },
  { slug: 'consolidation', path: '/consolidation' },
  { slug: 'reserves',      path: '/reserves' },
  { slug: 'monte-carlo',   path: '/monte-carlo' },
  { slug: 'data-entry',    path: '/data-entry' },
  { slug: 'settings',      path: '/settings' },
  { slug: 'glossary',      path: '/glossary' },
  { slug: 'data-sources',  path: '/data-sources' },
  { slug: 'audit',         path: '/audit' },
];

const VIEWPORTS = [
  { name: 'mobile',  width: 320, height: 720 },
  { name: 'tablet',  width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
let captured = 0;
let failed = 0;

try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();

    // Suppress GuidedTour so screenshots reflect content, not the welcome modal.
    await page.addInitScript(() => {
      try { localStorage.setItem('petros_tour_completed', 'true'); } catch { /* no-op */ }
    });

    for (const p of PAGES) {
      const out = resolve(OUT_DIR, `${vp.name}-${p.slug}.png`);
      try {
        await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: out, fullPage: true });
        captured++;
        process.stdout.write(`[${vp.name} ${vp.width}] ${p.path.padEnd(14)} → ${out}\n`);
      } catch (e) {
        failed++;
        process.stdout.write(`[${vp.name} ${vp.width}] ${p.path.padEnd(14)} FAIL: ${e.message?.slice(0, 120)}\n`);
      }
    }

    await ctx.close();
  }
} finally {
  await browser.close();
}

process.stdout.write(
  `\n${isBaseline ? 'Baseline' : 'Current'} capture complete: ${captured} ok, ${failed} fail\n` +
  `Output: ${OUT_DIR}\n` +
  (isBaseline
    ? 'Commit tests-e2e/snapshots/baseline/ to lock in this typography state.\n'
    : 'Diff against tests-e2e/snapshots/baseline/ to detect drift.\n')
);

if (failed > 0) process.exit(1);
