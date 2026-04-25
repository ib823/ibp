// One-off: capture Settings page (where the SAC Bridge section lives)
// at desktop and mobile widths, so the user can preview the new section
// without booting their own browser.
import { chromium } from 'playwright';

const browser = await chromium.launch();
try {
  for (const vp of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile',  width: 320,  height: 720 },
  ]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      try { localStorage.setItem('petros_tour_completed', 'true'); } catch {}
    });
    await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `viewport-walk/${vp.name}-settings-sac.png`, fullPage: false });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('captured');
