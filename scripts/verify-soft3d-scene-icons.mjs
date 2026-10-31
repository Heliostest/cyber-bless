import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { populatedLayoutState } from './fixtures/i18n-layout-state.mjs';
import { builtInScenes } from '../packages/core/src/daily-scenes.ts';
import { SCENE_ICON_IDS } from '../packages/app/src/scene-icon-assets.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/soft3d-scene-icons');
const views = [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }];
const preview = process.argv.includes('--preview');
const missing = SCENE_ICON_IDS.filter(id => !existsSync(path.join(root, `assets/scene-icons/soft3d/${id}.webp`)));
assert.deepEqual(missing, [], `Generate all illustrations before browser verification; missing ${missing.length}`);
await mkdir(out, { recursive: true });

const errors = [], imageFailures = [], rows = [], screenshots = [];
let server, browser;
async function baseUrl() {
  if (process.env.WBR_URL) return process.env.WBR_URL;
  const port = process.env.WBR_ICONS_PORT || '5193';
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), ...(preview ? ['preview'] : []),
    '--host', '127.0.0.1', '--port', port, '--strictPort'], {
    cwd: path.join(root, 'apps/cyber-bless'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(Error(`Vite did not start: ${log}`)), 30000);
    server.stdout.on('data', chunk => { log += chunk; if (log.includes('Local:')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', chunk => { log += chunk; });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Vite exited ${code}: ${log}`)); });
  });
  return `http://127.0.0.1:${port}`;
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function tab(page, id) {
  await page.locator(`[data-tab="${id}"]`).click();
  await page.locator(`.app-shell[data-page="${id}"]`).waitFor();
  await settle(page);
}

async function screenshot(page, label, view) {
  const filename = `${view.width}-${label}.png`;
  await page.screenshot({ path: path.join(out, filename), fullPage: !label.startsWith('catalog') });
  screenshots.push(filename);
}

async function inspect(page, route, view, { all = false, allowEmpty = false } = {}) {
  await page.waitForFunction(allowEmpty => {
    const images = [...document.querySelectorAll('img.scene-icon')];
    return (allowEmpty || images.length > 0) && images.every(image => image.complete);
  }, allowEmpty);
  await settle(page);
  const result = await page.evaluate(() => {
    const images = [...document.querySelectorAll('img.scene-icon')].map(image => {
      const rect = image.getBoundingClientRect(), css = getComputedStyle(image);
      const slot = image.closest('.scene-badge, .scene-art, .wish-object-preview');
      const bounds = slot?.getBoundingClientRect();
      return { id: image.closest('[data-scene]')?.getAttribute('data-scene'), src: image.getAttribute('src'),
        naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
        width: rect.width, height: rect.height, objectFit: css.objectFit,
        alt: image.getAttribute('alt'), hidden: image.getAttribute('aria-hidden'), draggable: image.draggable,
        slot: slot?.className, slotWidth: bounds?.width, slotHeight: bounds?.height,
        insideSlot: !bounds || rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 &&
          rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1 };
    });
    return { images, uniqueIds: [...new Set(images.map(image => image.id).filter(Boolean))],
      sceneBadges: document.querySelectorAll('.scene-badge').length,
      leafBadges: document.querySelectorAll('.scene-badge > svg').length,
      documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
  });
  assert.ok(allowEmpty || result.images.length > 0, `${route}: no scene illustrations rendered`);
  assert.equal(result.leafBadges, 0, `${route}: a known scene fell back to a leaf`);
  assert.ok(result.documentWidth <= result.viewportWidth + 2, `${route}: horizontal page overflow`);
  for (const image of result.images) {
    assert.ok(image.naturalWidth > 0 && image.naturalHeight > 0, `${route}: unloaded image ${JSON.stringify(image)}`);
    assert.ok(image.width > 0 && image.height > 0, `${route}: collapsed image ${JSON.stringify(image)}`);
    assert.equal(image.objectFit, 'contain', `${route}: image no longer fits its original slot`);
    assert.ok(image.insideSlot, `${route}: image escapes its slot ${JSON.stringify(image)}`);
    assert.equal(image.alt, '', `${route}: decorative art gained an accessible label`);
    assert.equal(image.hidden, 'true', `${route}: decorative art is no longer hidden`);
    assert.equal(image.draggable, false, `${route}: image interferes with touch gestures`);
    assert.match(image.src, /\/scene-icons\/soft3d\/[\w-]+\.webp$/, `${route}: unexpected image asset`);
  }
  if (all) assert.deepEqual(result.uniqueIds.sort(), [...SCENE_ICON_IDS].sort(), 'historical keepsakes must render every known scene image');
  rows.push({ route, ...view, ...result });
  console.log(JSON.stringify({ route, width: view.width, images: result.images.length, uniqueIds: result.uniqueIds.length }));
}

function observe(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/scene-icons/soft3d/') && response.status() >= 400)
      imageFailures.push({ url: response.url(), status: response.status() });
  });
  page.on('requestfailed', request => {
    if (request.url().includes('/scene-icons/soft3d/')) imageFailures.push({ url: request.url(), error: request.failure()?.errorText });
  });
}

try {
  const base = await baseUrl();
  const bundled = chromium.executablePath();
  const host = bundled.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
  browser = await chromium.launch({ headless: true, executablePath: existsSync(bundled) ? bundled : host,
    args: ['--no-proxy-server', '--enable-unsafe-swiftshader'] });
  for (const view of views) {
    const context = await browser.newContext({ viewport: view, locale: 'zh-CN', hasTouch: view.width < 1000 });
    const page = await context.newPage();
    observe(page);
    await page.addInitScript(state => localStorage.setItem('cyber-bless:personal:v1', JSON.stringify(state)), populatedLayoutState('zh-Hans'));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.app-shell[data-page="today"]').waitFor();
    await inspect(page, 'today', view); await screenshot(page, 'today', view);
    await tab(page, 'wishes');
    const expand = page.locator('.wish-rack-toggle');
    if (await expand.count() && await expand.getAttribute('aria-expanded') !== 'true') await expand.click();
    // The wish shelf normally shows real 3D objects; shared images appear in
    // its failure state and in the following ritual picker.
    await inspect(page, 'wishes', view, { allowEmpty: true }); await screenshot(page, 'wishes', view);
    await page.locator('.pray-button').click();
    await page.locator('.app-shell[data-page="new"]').waitFor();
    await inspect(page, 'wish-picker', view); await screenshot(page, 'wish-picker', view);
    await page.locator('.back-button').click();
    await page.locator('.app-shell[data-page="wishes"]').waitFor();
    await tab(page, 'world');
    await inspect(page, 'world', view); await screenshot(page, 'world', view);
    await tab(page, 'me');
    await page.getByRole('button', { name: '场景目录', exact: true }).click();
    await page.locator('.app-shell[data-page="scenes"]').waitFor();
    while (await page.getByRole('button', { name: '显示更多', exact: true }).count()) {
      await page.getByRole('button', { name: '显示更多', exact: true }).click();
    }
    await inspect(page, 'catalog', view);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      for (const element of document.querySelectorAll('.app-content, .app-shell')) element.scrollTop = 0;
    });
    await settle(page);
    await screenshot(page, 'catalog', view);
    await page.locator('.scene-card').last().scrollIntoViewIfNeeded();
    await screenshot(page, 'catalog-last', view);
    await context.close();
  }

  // Real collection rendering also covers scenes no longer listed in the catalog.
  const view = views.at(-1);
  const context = await browser.newContext({ viewport: view, locale: 'zh-CN' });
  const page = await context.newPage();
  observe(page);
  const historical = populatedLayoutState('zh-Hans');
  historical.collectibles = builtInScenes.map(entry => ({ id: `soft3d-browser:${entry.id}`, kind: 'scene',
    sceneId: entry.id, title: entry.title, at: '2026-10-30T08:00:00.000Z' }));
  await page.addInitScript(state => localStorage.setItem('cyber-bless:personal:v1', JSON.stringify(state)), historical);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.app-shell[data-page="today"]').waitFor();
  await tab(page, 'world');
  await inspect(page, 'historical-keepsakes', view, { all: true });
  await screenshot(page, 'all-keepsakes', view);
  await context.close();
  assert.deepEqual(imageFailures, [], 'scene illustrations must not fail network requests');
  assert.deepEqual(errors, [], 'browser must not throw while rendering shared scene illustrations');
  await writeFile(path.join(out, 'browser-report.json'), JSON.stringify({ at: new Date().toISOString(), base, mode: preview ? 'production-preview' : 'development', views,
    rows, screenshots, imageFailures, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ routes: rows.length, screenshots: screenshots.length, imageFailures, errors, out }));
} finally {
  await browser?.close();
  server?.kill();
}
