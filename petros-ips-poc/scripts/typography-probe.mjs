// Typography probe: visit each page, walk every text node and every UI5
// custom-element, and report any that render outside the declared
// semantic-token sizes (S9–S12 in AUDIT.md).
//
// Verifies the runtime claims from the typography audit that source-code
// inspection alone could not confirm — specifically:
//   - Are UI5 components (button/tag/tab/select/dialog) using the SAP
//     Horizon defaults documented in src/index.css, or has something
//     downstream overridden them silently?
//   - Are there any rendered text nodes below the 11px caption floor?
//
// Usage: node scripts/typography-probe.mjs
// Prereq: dev server at http://localhost:5173 + Playwright installed.
//
// Output: typography-probe/report.json with per-page findings.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT_DIR = resolve('typography-probe');

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

// Semantic tokens (must mirror src/index.css @theme block).
const TOKENS = {
  caption: 11,
  numeric: 12,
  body: 14,
  subtitle: 16,
  title: 20,
  display: 24,
};
const ALLOWED_PX = new Set(Object.values(TOKENS));

// UI5 components whose computed font properties we inspect.
const UI5_SELECTORS = [
  'ui5-button',
  'ui5-tag',
  'ui5-tab',
  'ui5-select',
  'ui5-input',
  'ui5-dialog',
  'ui5-side-navigation-item',
  'ui5-segmented-button-item',
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// Suppress the first-visit GuidedTour so the probe sees real content.
await page.addInitScript(() => {
  try { localStorage.setItem('petros_tour_completed', 'true'); } catch { /* no-op */ }
});

const report = { startedAt: new Date().toISOString(), tokens: TOKENS, pages: [] };

try {
  for (const p of PAGES) {
    const url = BASE + p.path;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (e) {
      report.pages.push({ slug: p.slug, navError: String(e.message ?? e) });
      continue;
    }
    await page.waitForTimeout(400);

    const findings = await page.evaluate(({ ALLOWED_PX_ARR, UI5_SELECTORS_ARR }) => {
      const allowed = new Set(ALLOWED_PX_ARR);

      function rectVisible(el) {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }

      // 1) Every text-bearing node — flag any below 12px or off-token.
      const subFloor = [];
      const offToken = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.nodeValue?.trim();
        if (!text) continue;
        const el = node.parentElement;
        if (!el || !rectVisible(el)) continue;
        const cs = window.getComputedStyle(el);
        const px = parseFloat(cs.fontSize);
        if (!Number.isFinite(px)) continue;
        const sample = text.slice(0, 60);
        const path = (() => {
          const parts = [];
          let cur = el;
          while (cur && parts.length < 4) {
            parts.unshift(cur.tagName.toLowerCase() + (cur.className && typeof cur.className === 'string' ? '.' + cur.className.trim().split(/\s+/).slice(0,2).join('.') : ''));
            cur = cur.parentElement;
          }
          return parts.join(' > ');
        })();
        if (px < 11) subFloor.push({ px, weight: cs.fontWeight, sample, path });
        else if (!allowed.has(px)) offToken.push({ px, weight: cs.fontWeight, sample, path });
      }

      // 2) UI5 components — sample one of each tag and report computed font.
      const ui5 = [];
      for (const sel of UI5_SELECTORS_ARR) {
        const el = document.querySelector(sel);
        if (!el || !rectVisible(el)) continue;
        const cs = window.getComputedStyle(el);
        ui5.push({
          selector: sel,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontSizePx: parseFloat(cs.fontSize),
          fontWeight: cs.fontWeight,
        });
      }

      // 3) ui5-dialog header — opened only if a dialog is present.
      const dialog = document.querySelector('ui5-dialog');
      let dialogHeader = null;
      if (dialog) {
        const sr = dialog.shadowRoot;
        const headerText = sr?.querySelector('.ui5-popup-header-text');
        if (headerText) {
          const cs = window.getComputedStyle(headerText);
          dialogHeader = {
            fontSize: cs.fontSize,
            fontSizePx: parseFloat(cs.fontSize),
            fontWeight: cs.fontWeight,
            fontFamily: cs.fontFamily,
          };
        }
      }

      // Dedup near-identical findings.
      const dedupe = (arr) => {
        const seen = new Map();
        for (const f of arr) {
          const key = `${f.px}|${f.weight}|${f.path}`;
          if (!seen.has(key)) seen.set(key, { ...f, count: 1 });
          else seen.get(key).count++;
        }
        return [...seen.values()].sort((a, b) => b.count - a.count);
      };

      return {
        subFloor: dedupe(subFloor).slice(0, 50),
        offToken: dedupe(offToken).slice(0, 50),
        ui5,
        dialogHeader,
        totals: { subFloorNodes: subFloor.length, offTokenNodes: offToken.length },
      };
    }, { ALLOWED_PX_ARR: [...ALLOWED_PX], UI5_SELECTORS_ARR: UI5_SELECTORS });

    report.pages.push({ slug: p.slug, path: p.path, ...findings });
    process.stdout.write(
      `[${p.slug.padEnd(14)}] subFloor=${findings.totals.subFloorNodes} ` +
      `offToken=${findings.totals.offTokenNodes} ` +
      `ui5=${findings.ui5.length}` +
      `\n`
    );
  }
} finally {
  await ctx.close();
  await browser.close();
}

report.finishedAt = new Date().toISOString();
const out = resolve(OUT_DIR, 'report.json');
writeFileSync(out, JSON.stringify(report, null, 2));
process.stdout.write(`\nReport: ${out}\n`);
