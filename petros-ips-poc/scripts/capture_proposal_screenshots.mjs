// Proposal-deck screenshot capture: visits each page that appears in the
// POC walkthrough section (slides 60–71) at proposal-friendly viewport,
// captures full-page PNG, suppresses the GuidedTour overlay.
//
// Usage:
//   1. Ensure dev server running:  npm run dev   (port 5173)
//   2. Run:                        node scripts/capture_proposal_screenshots.mjs
//   3. Output:                     proposal-screenshots/<slug>.png
//
// Output dimensions: 1600x900 viewport (matches 16:9 slide aspect ratio).

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT_DIR = resolve('proposal-screenshots');

// Pages mapped to PROPOSAL.md walkthrough slides 60–71
const PAGES = [
  { slide: 61, slug: 'dashboard',     path: '/' },
  { slide: 62, slug: 'economics',     path: '/economics' },
  { slide: 63, slug: 'sensitivity',   path: '/sensitivity' },
  { slide: 64, slug: 'monte-carlo',   path: '/monte-carlo' },
  { slide: 65, slug: 'portfolio',     path: '/portfolio' },
  { slide: 66, slug: 'financial',     path: '/financial' },
  { slide: 67, slug: 'reserves',      path: '/reserves' },
  { slide: 68, slug: 'consolidation', path: '/consolidation' },
  { slide: 69, slug: 'ma',            path: '/ma' },
  { slide: 70, slug: 'project-finance', path: '/project-finance' },
  { slide: 71, slug: 'climate',       path: '/climate' },
];

const VIEWPORT = { width: 1600, height: 900 };

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2, // retina-quality screenshots
});
const page = await ctx.newPage();

// Suppress GuidedTour overlay
await page.addInitScript(() => {
  try {
    localStorage.setItem('petros_tour_completed', 'true');
  } catch {}
});

let captured = 0;
let failed = 0;

try {
  for (const p of PAGES) {
    const out = resolve(OUT_DIR, `slide${p.slide}-${p.slug}.png`);
    try {
      await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 25000 });
      // Allow charts to settle
      await page.waitForTimeout(800);
      // For pages with many charts, take above-the-fold screenshot only
      // (proposal deck slides cap at 16:9 = 1600x900 visible area)
      await page.screenshot({ path: out, fullPage: false });
      captured++;
      process.stdout.write(`  ✓ slide ${p.slide} (${p.slug}) → ${out.split('/').pop()}\n`);
    } catch (e) {
      failed++;
      process.stdout.write(`  ✗ slide ${p.slide} (${p.slug}) FAIL: ${(e.message || '').slice(0, 80)}\n`);
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(`\nProposal screenshots: ${captured} ok, ${failed} fail\nOutput: ${OUT_DIR}\n`);
process.exit(failed > 0 ? 1 : 0);
