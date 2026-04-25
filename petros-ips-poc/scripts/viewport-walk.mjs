// Viewport walk: visit every page at three viewports, capture screenshots,
// collect console messages, and emit a structured report.
//
// Usage: node scripts/viewport-walk.mjs
// Prereq: dev server at http://localhost:5173 + Playwright installed.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT_DIR = resolve('viewport-walk');

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
  { slug: 'sac-mapping',   path: '/sac-mapping' },
];

const VIEWPORTS = [
  { name: 'mobile',  width: 320, height: 720 },
  { name: 'tablet',  width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const report = { startedAt: new Date().toISOString(), pages: [] };

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();

try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();

    // Suppress the first-visit GuidedTour so screenshots show real content.
    // The tour is gated on localStorage['petros_tour_completed']; set it
    // before any navigation so the auto-start effect skips on mount.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('petros_tour_completed', 'true');
      } catch {
        /* no-op */
      }
    });

    for (const p of PAGES) {
      const slug = p.slug;
      const consoleMsgs = [];
      const pageErrors = [];

      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');

      page.on('console', (msg) => {
        const type = msg.type();
        if (type === 'error' || type === 'warning') {
          consoleMsgs.push({ type, text: msg.text().slice(0, 500) });
        }
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err.message.slice(0, 500));
      });

      const url = BASE + p.path;
      let navOk = true;
      let navError = null;

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      } catch (e) {
        navOk = false;
        navError = String(e.message ?? e).slice(0, 300);
      }

      await page.waitForTimeout(300);

      const screenshot = resolve(OUT_DIR, `${vp.name}-${slug}.png`);
      let shotOk = true;
      try {
        await page.screenshot({ path: screenshot, fullPage: true });
      } catch {
        shotOk = false;
      }

      const title = await page.title().catch(() => '');
      const scrollWidth = await page
        .evaluate(() => document.documentElement.scrollWidth)
        .catch(() => null);
      const hasHorizScroll = scrollWidth != null && scrollWidth > vp.width + 2;

      report.pages.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        slug,
        path: p.path,
        title,
        navOk,
        navError,
        shotOk,
        screenshot: `viewport-walk/${vp.name}-${slug}.png`,
        scrollWidth,
        hasHorizScroll,
        consoleErrors: consoleMsgs.filter((m) => m.type === 'error'),
        consoleWarnings: consoleMsgs.filter((m) => m.type === 'warning'),
        pageErrors,
      });

      process.stdout.write(
        `[${vp.name} ${vp.width}] ${p.path.padEnd(14)} ` +
          `${navOk ? 'ok' : 'FAIL'} ` +
          `${hasHorizScroll ? 'H-SCROLL ' : ''}` +
          `${consoleMsgs.length ? `${consoleMsgs.length} console ` : ''}` +
          `${pageErrors.length ? `${pageErrors.length} errors ` : ''}` +
          `\n`
      );
    }

    await ctx.close();
  }
} finally {
  await browser.close();
}

report.finishedAt = new Date().toISOString();

writeFileSync(resolve(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

const issuesByPage = new Map();
for (const r of report.pages) {
  if (!r.navOk || r.hasHorizScroll || r.consoleErrors.length || r.pageErrors.length) {
    const key = r.slug;
    if (!issuesByPage.has(key)) issuesByPage.set(key, []);
    issuesByPage.get(key).push(r);
  }
}

console.log('\n── Summary ──');
console.log(`Visited: ${report.pages.length} (${PAGES.length} pages × ${VIEWPORTS.length} viewports)`);
console.log(`Pages with issues: ${issuesByPage.size}`);
for (const [slug, rows] of issuesByPage) {
  console.log(`\n  ${slug}`);
  for (const r of rows) {
    const flags = [];
    if (!r.navOk) flags.push('nav-fail');
    if (r.hasHorizScroll) flags.push(`h-scroll(${r.scrollWidth}>${r.width})`);
    if (r.consoleErrors.length) flags.push(`${r.consoleErrors.length} console-err`);
    if (r.pageErrors.length) flags.push(`${r.pageErrors.length} page-err`);
    console.log(`    [${r.viewport} ${r.width}] ${flags.join(' ')}`);
    for (const e of r.consoleErrors.slice(0, 3)) console.log(`      CE: ${e.text}`);
    for (const e of r.pageErrors.slice(0, 3))  console.log(`      PE: ${e}`);
  }
}
console.log(`\nReport: ${resolve(OUT_DIR, 'report.json')}`);
console.log(`Screenshots: ${OUT_DIR}/`);
