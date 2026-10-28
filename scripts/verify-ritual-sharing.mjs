import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

// The real production Woodfish component, engine, shaders and environment.
// Only storage and local asset delivery are isolated from the full application.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/ritual-sharing');
await mkdir(out, { recursive: true });
const bundle = await build({
  absWorkingDir: root, entryPoints: ['scripts/fixtures/ritual-share.tsx'], write: false,
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.EXPO_BASE_URL': '"/"', 'process.env.NODE_ENV': '"production"' },
});
const inlineCSS = async file => {
  const source = await readFile(file, 'utf8');
  let result = source;
  for (const match of source.matchAll(/@import\s+"([^"]+)";/g))
    result = result.replace(match[0], await inlineCSS(path.resolve(path.dirname(file), match[1])));
  return result;
};
const css = await inlineCSS(path.join(root, 'packages/app/src/style.css'));
const model = (await readFile(path.join(root, 'assets/woodfish/bundled-v1/woodfish.glb'))).toString('base64');
let browser;
try {
  const bundledBrowser = chromium.executablePath();
  const hostBrowser = bundledBrowser.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
  browser = await chromium.launch({ headless: true, executablePath: process.env.SHARE_BROWSER_PATH || (existsSync(bundledBrowser) ? bundledBrowser : hostBrowser), args: ['--no-proxy-server', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  let environmentLoads = 0;
  await page.route('https://ritual-share.test/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/environments/kloppenheim-06-sky-1k.hdr') {
      await route.fulfill({ body: await readFile(path.join(root, 'assets/environments/kloppenheim-06-sky-1k.hdr')), contentType: 'application/octet-stream' });
      environmentLoads++;
    } else await route.fulfill({ status: 404, body: 'Unmapped fixture resource' });
  });
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
  page.on('pageerror', error => { errors.push(String(error)); console.error('Browser error:', String(error)); });
  await page.setContent('<!doctype html><html lang="zh-Hans"><head><base href="https://ritual-share.test/"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: css });
  await page.evaluate(base64 => { window.shareModelBase64 = base64; }, model);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForFunction(() => window.shareVerificationReady);
  const rendering = await page.evaluate(() => ({
    environment: document.querySelector('canvas.scene-canvas')?.dataset.environment,
    style: window.shareRendering?.style,
    environmentReady: document.querySelector('canvas.scene-canvas')?.dataset.environmentReady,
  }));
  assert.equal(rendering.environment, 'veranda', 'Share verification must use the production woodfish environment');
  assert.equal(rendering.style, 'toon-soft', 'Share verification must preserve the production shader');
  assert.equal(rendering.environmentReady, 'true', 'Wait for production environment lighting before sharing');
  assert.equal(environmentLoads, 1, 'Production HDR must load instead of silently falling back');
  await page.getByRole('button', { name: '分享仪式', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '分享这场仪式' });
  await dialog.locator('img').waitFor();
  const dataUrl = await dialog.locator('img').getAttribute('src');
  const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1350); assert.equal(metadata.format, 'png');
  const stats = await sharp(bytes).extract({ left: 250, top: 350, width: 580, height: 500 }).stats();
  assert(stats.channels.slice(0, 3).some(channel => channel.stdev > 10), 'Scene picture must contain visible model pixels');
  await writeFile(path.join(out, 'woodfish-share.png'), bytes);
  await page.screenshot({ path: path.join(out, 'preview-390.png') });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 667 });
    const layout = await dialog.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const actions = [...element.querySelectorAll('.ritual-share-actions .button')].map(button => {
        const rect = button.getBoundingClientRect(); return { left: rect.left, right: rect.right, height: rect.height };
      });
      return { left: bounds.left, right: bounds.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, actions };
    });
    assert(layout.left >= 0 && layout.right <= width, 'Dialog stays in mobile viewport');
    assert(layout.scrollWidth <= layout.clientWidth, 'Preview has no horizontal overflow');
    assert(layout.actions.every(action => action.height >= 44 && action.left >= 0 && action.right <= width), 'Share controls remain touch sized');
  }
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('link', { name: '保存图片' }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'ritual-woodfish.png');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('button', { name: '分享仪式', exact: true }).count(), 1);
  assert.deepEqual(errors, []);
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ png: { width: metadata.width, height: metadata.height, bytes: bytes.length }, rendering, environmentLoads, mobileWidths: [320, 390], browser: await browser.version(), errors, limits: 'Production Woodfish component, engine, veranda environment, HDR and toon-soft shader with isolated storage/asset delivery. Not full application navigation or a native device. Native sheets require device acceptance.' }, null, 2));
  console.log('Ritual image sharing: real WebGL PNG, preview, mobile widths, download and Escape passed.');
} finally {
  await browser?.close();
}
