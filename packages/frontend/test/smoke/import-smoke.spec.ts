import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loginThroughUi } from './smokeTestHelpers';

test.setTimeout(120000);
test('import JSON with multiple top-level arrays and preset flows', async ({ browser }) => {
  // Wait for server to be reachable via health-check before navigating
  const healthUrl = 'http://127.0.0.1:5174/health';
  // Create a fresh context and authenticate before opening protected routes.
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginThroughUi(page);

  // Capture console and page errors as early as possible
  const logs: string[] = [];
  page.on('console', msg => logs.push(`console:${msg.type()}:${msg.text()}`));
  page.on('pageerror', err => logs.push(`pageerror:${err.message}`));

  await page.waitForResponse(resp => resp.url() === healthUrl && resp.status() === 200, { timeout: 15000 }).catch(() => null);

  // Serve from baseURL after authentication
  try {
    await page.goto('/data', { waitUntil: 'domcontentloaded' });
  } catch (err) {
    console.log('Navigation failed, logs so far:\n', logs.join('\n'));
    throw err;
  }

  // Wait for global readiness flag set by the app or the visible header as fallback
  try {
    const appReady = await page.waitForFunction(() => (window as any).__AIDA_APP_READY === true, { timeout: 20000 }).catch(() => null);
    if (!appReady) {
      // Fallback: wait for the Data Management heading which indicates the page mounted
      await page.waitForSelector('text=Data Management', { timeout: 20000 });
    }
  } catch (err) {
    const html = await page.content().catch(() => '<failed to read html>');
    console.log('Playwright logs during page load:', logs.join('\n'));
    console.log('Page HTML snapshot:\n', html.slice(0, 20000));
    throw err;
  }

  // Wait for the file input to be present (input is hidden but should be attached)
  const fileInput = await page.waitForSelector('input#csv-import-file', { state: 'attached', timeout: 15000 }).catch(() => null as null);
  if (!fileInput) {
    // Dump diagnostics to help debugging flakiness
    const html = await page.content();
    console.log('Playwright logs during page load:', logs.join('\n'));
    console.log('Page HTML snapshot:\n', html.slice(0, 20000));
  }
  expect(fileInput).not.toBeNull();

  // Prepare a temp JSON file with multiple arrays
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  const tmpPath = path.join(tmpDir, 'multi-arrays.json');
  const payload = JSON.stringify({ users: [{ id: '1', name: 'Alice' }], orders: [{ id: 'o1', total: 10 }] });
  fs.writeFileSync(tmpPath, payload);

  // Set the file input files
  if (!fileInput) {
    const html = await page.content().catch(() => '<failed to read html>');
    console.log('Playwright logs during file input lookup:', logs.join('\n'));
    console.log('Page HTML snapshot:\n', html.slice(0, 20000));
    throw new Error('File input not found; aborting test');
  }
  await fileInput.setInputFiles(tmpPath);

  // Wait for modal to appear
  await expect(page.locator('text=CSV Data Import Wizard')).toBeVisible({ timeout: 5000 });

  // When multiple arrays exist, the top-level key select should be visible
  const select = page.locator('select').filter({ hasText: 'JSON top-level key' }).first();
  // If the UI shows the select, choose 'orders'
  if (await select.count()) {
    await page.selectOption('select', 'orders');
  }

  // Select a collection (first available by index)
  await page.selectOption('#collection-select', { index: 1 });

  // Click Auto-map to populate mappings
  await page.click('text=Auto-map');

  // Save preset locally (we are not authenticated in smoke test)
  await page.fill('input[placeholder="Preset name (e.g. Amazon CSV)"]', 'smokePreset');
  await page.click('text=Save Preset');

  // Verify preset saved in localStorage
  const stored = await page.evaluate(() => localStorage.getItem('aida.mapping.presets'));
  if (!stored) throw new Error('localStorage presets missing after save');
  const parsed = JSON.parse(stored as string) as Record<string, Record<string, Record<string, string>>>;
  const coll = Object.keys(parsed)[0];
  if (!coll) throw new Error('No collection key found in saved presets');
  if (!parsed[coll]['smokePreset']) throw new Error('Preset "smokePreset" not found in localStorage');

  // Delete preset via UI
  await page.click('text=Delete Preset');

  // Close modal
  await page.click('text=Close');

  // Close context to clean up
  await context.close();
});
