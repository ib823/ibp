import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('petros_tour_completed','true'); } catch{} });
await page.goto('http://localhost:5173/economics', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(500);
// Click Calculate to populate KPIs
await page.click('button:has-text("Calculate")', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(800);
// Click the first KPI's trace button (NPV₁₀)
await page.click('button[aria-label*="trace for NPV"]', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: 'viewport-walk/trace-npv.png', fullPage: false });
await browser.close();
console.log('done');
