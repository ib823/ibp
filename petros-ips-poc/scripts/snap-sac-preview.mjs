// Capture three pages with SAC Preview ON vs OFF for visual comparison.
import { chromium } from 'playwright';

const PAGES = [
  { slug: 'dashboard', path: '/' },
  { slug: 'economics', path: '/economics' },
  { slug: 'portfolio', path: '/portfolio' },
];

const browser = await chromium.launch();
try {
  for (const mode of ['off', 'on']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript((on) => {
      try {
        localStorage.setItem('petros_tour_completed', 'true');
        sessionStorage.setItem(
          'petros-ips-ui-prefs',
          JSON.stringify({ sacPreviewMode: on === 'on' })
        );
      } catch {}
    }, mode);
    for (const p of PAGES) {
      await page.goto(`http://localhost:5173${p.path}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `viewport-walk/sac-${mode}-${p.slug}.png`,
        fullPage: false,
      });
      console.log(`captured ${mode} ${p.slug}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
