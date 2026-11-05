import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const serve = process.argv.includes('--serve');
const base = process.env.WBR_URL || `http://127.0.0.1:${serve ? 5187 : 5186}`;
const out = 'artifacts/scene-visual-features';
await mkdir(out, { recursive: true });
let browser, server;
const errors = [];
try {
  if (serve) {
    const url = new URL(base);
    server = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), '--host', url.hostname, '--port', url.port, '--strictPort'], {
      cwd: fileURLToPath(new URL('../apps/cyber-bless', import.meta.url)), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    server.stdout.on('data', chunk => { output += chunk; });
    server.stderr.on('data', chunk => { output += chunk; });
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw Error(output);
      if (output.includes('Local:')) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  browser = await chromium.launch({ headless: true, ...(process.env.WBR_BROWSER_CHANNEL ? { channel: process.env.WBR_BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('cyber-bless:personal:v1', JSON.stringify({ version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: false, haptics: false, reducedMotion: true, locale: 'zh-Hans' } }));
  });
  await page.goto(`${base}/scene-review?scene=furin-wind-chime`);
  const select = page.getByRole('combobox', { name: '跳转场景' });
  await select.waitFor();
  const options = await select.locator('option').allTextContents();
  assert.ok(options.length >= 150);
  assert.ok(options.every(text => text.includes('💡')), 'Each review option includes the shared light rig');
  assert.ok(options.find(text => text.includes('风铃')).includes('🔮'));
  await page.locator('.scene-review-features > .scene-visual-features [data-visual-feature="glass"]').waitFor();
  await page.locator('.library-scene-stage[data-ready="true"]').waitFor();
  await page.screenshot({ path: `${out}/review-desktop.png` });
  await select.selectOption('ema-votive-plaque');
  await page.locator('.scene-review-features > .scene-visual-features [data-visual-feature="cherry"]').waitFor();
  await select.selectOption('votive-candle-catholic');
  await page.locator('.scene-review-features > .scene-visual-features [data-visual-feature="night"]').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('.scene-visual-legend summary').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('.scene-visual-legend summary').click();
  await page.screenshot({ path: `${out}/review-mobile.png` });

  await page.goto(base);
  await page.getByRole('button', { name: '我的', exact: true }).click();
  await page.getByRole('button', { name: '场景目录', exact: true }).click();
  const more = page.getByRole('button', { name: '显示更多', exact: true });
  while (await more.count()) await more.click();
  const rows = page.locator('.scene-card');
  const count = await rows.count();
  assert.equal(await rows.locator('.scene-visual-features').count(), count);
  assert.ok(await rows.evaluateAll(rows => rows.every(row => [...row.querySelectorAll('.scene-visual-feature')].every(badge => badge.getBoundingClientRect().right <= row.getBoundingClientRect().right))));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('searchbox', { name: '搜索场景' }).fill('水体');
  assert.ok(await rows.count() > 0);
  assert.equal(await rows.locator('[data-visual-feature="water"]').count(), await rows.count());
  await page.screenshot({ path: `${out}/catalog-mobile.png` });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('searchbox', { name: '搜索场景' }).fill('樱花');
  assert.ok(await rows.count() > 0);
  assert.equal(await rows.locator('[data-visual-feature="cherry"]').count(), await rows.count());
  await page.screenshot({ path: `${out}/catalog-desktop.png` });
  await page.getByRole('searchbox', { name: '搜索场景' }).fill('夜景');
  assert.ok(await rows.count() > 0);
  assert.equal(await rows.locator('[data-visual-feature="night"]').count(), await rows.count());
  assert.deepEqual(errors, []);
  const report = { reviewOptions: options.length, catalogRows: count, checks: ['icons and readable labels', 'water/cherry/night search', 'desktop and mobile', 'legend', 'no horizontal overflow'], errors };
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser?.close(); server?.kill(); }
