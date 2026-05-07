import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => { try { localStorage.setItem('aida.test.bypass', '1'); } catch (e) {} });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:5174/data?bypass=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const html = await page.content();
    console.log('PAGE HTML LENGTH', html.length);
  } catch (e) {
    console.error('Error during open:', e);
  } finally {
    await browser.close();
  }
})();
