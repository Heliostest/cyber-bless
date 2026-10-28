import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'apps/cyber-bless/dist');
const out = path.join(root, 'artifacts/interactive-sharing');
await mkdir(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const errors = [], missing = [];
const executable = chromium.executablePath();
const hostExecutable = executable.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
const browser = await chromium.launch({ headless: true, executablePath: existsSync(executable) ? executable : hostExecutable, args: ['--no-proxy-server', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.route('http://127.0.0.1:5187/**', async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(dist + path.sep)) return route.fulfill({ status: 403, body: '' });
    try { await route.fulfill({ body: await readFile(file), contentType: mime[path.extname(file)] ?? 'application/octet-stream' }); }
    catch { missing.push(pathname); await route.fulfill({ status: 404, body: '' }); }
  });
  await context.addInitScript(() => {
    const key = 'cyber-bless:personal:v1', marker = '{"private":"do not read or change"}';
    const read = Storage.prototype.getItem, write = Storage.prototype.setItem;
    write.call(localStorage, key, marker);
    window.personalSaveReads = 0; window.personalSaveWrites = 0;
    Storage.prototype.getItem = function (name) { if (name === key) window.personalSaveReads++; return read.call(this, name); };
    Storage.prototype.setItem = function (name, value) { if (name === key) window.personalSaveWrites++; return write.call(this, name, value); };
    window.inspectPersonalSave = () => ({ value: read.call(localStorage, key), reads: window.personalSaveReads, writes: window.personalSaveWrites });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const url = (scene, style = 'toon-soft') => `http://127.0.0.1:5187/share.html?v=1&scene=${scene}&lang=zh-Hans&style=${style}`;
  await page.goto(url('woodfish'));
  await page.locator('.woodfish-stage[data-ready="true"] canvas[data-environment-ready="true"]').waitFor();
  assert.equal(await page.locator('a.public-scene-store').getAttribute('href'), 'https://apps.apple.com/app/id6821271597');
  assert.equal(await page.getByRole('button', { name: '开启声音', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.locator('.woodfish-object').click();
  await page.waitForFunction(() => document.querySelector('.woodfish-count')?.textContent?.includes('1 / 12'));
  await page.getByRole('button', { name: '重新体验', exact: true }).click();
  await page.locator('.woodfish-stage[data-ready="true"] canvas').waitFor();
  await page.waitForFunction(() => document.querySelector('.woodfish-count')?.textContent?.includes('0 / 12'));
  await page.getByRole('button', { name: '开启声音', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '关闭声音', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '关闭声音', exact: true }).click();
  const first = await page.locator('canvas.scene-canvas').screenshot();
  await page.screenshot({ path: path.join(out, 'woodfish-390.png') });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 667 });
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      controls: [...document.querySelectorAll('.public-scene-controls button, .public-scene-store')].map(element => {
        const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
      }) }));
    assert(layout.scrollWidth <= width, 'No horizontal overflow at mobile widths');
    assert(layout.controls.every(control => control.left >= 0 && control.right <= width && control.height >= 44 && control.top >= 0 && control.bottom <= 667), 'Store and replay controls remain visible and touch sized');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url('woodfish', 'gouache'));
  await page.locator('.woodfish-stage[data-ready="true"] canvas[data-environment-ready="true"]').waitFor();
  const painted = await page.locator('canvas.scene-canvas').screenshot();
  const a = await sharp(first).resize(180, 180).removeAlpha().raw().toBuffer();
  const b = await sharp(painted).resize(180, 180).removeAlpha().raw().toBuffer();
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference += Math.abs(a[i] - b[i]);
  difference /= a.length;
  assert(difference > 3, 'Shared shader selection visibly affects the production rendered scene');
  await page.screenshot({ path: path.join(out, 'woodfish-gouache.png') });
  await page.goto(url('crane'));
  await page.locator('.library-scene-stage[data-ready="true"] canvas').waitFor();
  for (let action = 0; action < 10 && !await page.locator('.public-scene-completed').count(); action++) {
    await page.locator('.scene-bow-tap:not(:disabled)').first().click();
    await page.waitForTimeout(200);
  }
  await page.locator('.public-scene-completed').waitFor();
  assert.equal(await page.locator('textarea, .scene-post-wish, .scene-reward-reveal, .bottom-nav').count(), 0);
  await page.screenshot({ path: path.join(out, 'crane-completed.png') });
  const personal = await page.evaluate(() => window.inspectPersonalSave());
  assert.deepEqual(personal, { value: '{"private":"do not read or change"}', reads: 0, writes: 0 });
  await page.goto(url('missing-scene'));
  await page.getByRole('heading', { name: '这个场景暂时无法打开' }).waitFor();
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal(await page.locator('a').getAttribute('href'), 'https://apps.apple.com/app/id6821271597');
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ browser: await browser.version(), scenes: ['woodfish', 'crane'], shaderDifference: difference, widths: [320, 390], personal, errors, missing, limitations: 'Local production Web build with real WebGL. No publication, App Store availability verification or native device acceptance.' }, null, 2));
  console.log('Interactive scene sharing: real scenes, replay, muted entry, shader, store link, mobile layout, private save isolation and invalid links passed.');
} finally { await browser.close(); }
