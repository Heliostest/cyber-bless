import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

// Fulfill all requests directly from the build/public directories. This is a
// local-file test origin, with no HTTP listener or actual network request.
const base = 'http://icon-look.local';
const out = path.resolve('artifacts/icon-look-preview');
await mkdir(out, { recursive: true });
const bundled = chromium.executablePath();
const executablePath = existsSync(bundled) ? bundled : bundled.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const errors = [], results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.protocol === 'file:') { await route.continue(); return; }
  if (url.origin !== base) { errors.push(`Unexpected external request: ${url.origin}`); await route.abort(); return; }
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(out, 'site', relative);
  const publicFile = path.resolve('apps/cyber-bless/public', relative);
  if (!file.startsWith(path.join(out, 'site') + path.sep) || !publicFile.startsWith(path.resolve('apps/cyber-bless/public') + path.sep)) { await route.abort(); return; }
  const target = existsSync(file) ? file : publicFile;
  const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' }[path.extname(target)] || 'application/octet-stream';
  try { await route.fulfill({ status: 200, contentType, body: await readFile(target) }); }
  catch (error) { errors.push(`Missing local preview file: ${relative}`); await route.fulfill({ status: 404, body: 'Not found' }); }
});
await page.addInitScript(() => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  const contexts = window.previewContexts = [];
  HTMLCanvasElement.prototype.getContext = function(type, ...options) {
    const context = getContext.call(this, type, ...options);
    if ((type === 'webgl' || type === 'webgl2') && context && !contexts.includes(context)) contexts.push(context);
    return context;
  };
});
try {
  await page.goto(process.argv.includes('--standalone') ? pathToFileURL(path.join(out, '仪式小物质感对比.html')).href : `${base}/icon-look-preview.html`);
  const ids = ['omamori-cycle', 'woodfish', 'shrine-suzu-bell', 'furin-wind-chime'];
  for (const width of process.argv.includes('--desktop') ? [1440] : [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1100 : 900 });
    for (const id of ids) {
      await page.locator(`button[data-subject="${id}"]`).click();
      await page.waitForFunction(() => document.querySelector('#root')?.dataset.ready === 'true' || document.querySelector('#root')?.dataset.error, null, { timeout: 60000 });
      const failure = await page.locator('#root').getAttribute('data-error'); if (failure) throw Error(failure);
      await page.waitForFunction(() => [...document.querySelectorAll('.stage canvas')].length === 2 && [...document.querySelectorAll('.stage canvas')].every(canvas => canvas.dataset.environmentReady === 'true' || canvas.closest('[data-scene-presentation="object"]')), null, { timeout: 60000 });
      await page.waitForTimeout(350);
      const row = { width, id, canvases: [] };
      for (const mode of ['current', 'icon']) {
        const canvas = page.locator(`[data-mode="${mode}"] canvas`);
        const file = path.join(out, `${id}-${width}-${mode}.png`);
        await canvas.screenshot({ path: file });
        const stats = await sharp(file).stats();
        if (stats.channels.slice(0, 3).every(channel => channel.stdev < 3)) throw Error(`Blank frame: ${id}/${mode}/${width}`);
        row.canvases.push({ mode, variance: stats.channels.slice(0, 3).map(channel => channel.stdev) });
      }
      if (width === 1440) {
        await page.screenshot({ path: path.join(out, `${id}-page.png`), fullPage: true });
        for (const mode of ['current', 'icon']) {
          const host = page.locator(`[data-mode="${mode}"]`);
          await host.scrollIntoViewIfNeeded();
          const point = async role => {
            const rect = await host.locator('canvas').boundingBox();
            const xy = await host.locator(`[data-cue-role="${role}"]`).first().evaluate(node => [Number(node.dataset.x), Number(node.dataset.y)]);
            return [rect.x + xy[0], rect.y + xy[1]];
          };
          if (id === 'woodfish') {
            await host.locator('.woodfish-hit').click({ position: { x: 170, y: 170 } });
            await page.waitForFunction(mode => Number(document.querySelector(`[data-mode="${mode}"]`).dataset.progress) > 0, mode);
          } else {
            const source = await point('source');
            if (id === 'shrine-suzu-bell') {
              await page.mouse.move(...source); await page.mouse.down(); await page.mouse.move(source[0], source[1] + 65, { steps: 12 }); await page.mouse.up();
            } else await page.mouse.click(...source);
            await page.waitForFunction(mode => Number(document.querySelector(`[data-mode="${mode}"]`).dataset.progress) > 0, mode);
            if (id === 'omamori-cycle') {
              await host.locator('[data-cue-role="target"]').first().waitFor({ state: 'attached' }); await page.waitForTimeout(250);
              const from = await point('source'), to = await point('target');
              await page.mouse.move(...from); await page.mouse.down(); await page.mouse.move(...to, { steps: 24 }); await page.mouse.up();
              await page.waitForFunction(mode => Number(document.querySelector(`[data-mode="${mode}"]`).dataset.progress) >= 2, mode);
            }
          }
        }
        row.physicalInteraction = true;
      }
      row.contexts = await page.evaluate(() => ({ created: window.previewContexts.length, active: window.previewContexts.filter(gl => !gl.isContextLost()).length }));
      if (row.contexts.active > 2) throw Error(`WebGL contexts not released: ${JSON.stringify(row.contexts)}`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`Horizontal overflow at ${width}`);
      results.push(row);
      console.log(`${id} ${width}: rendered, ${row.contexts.active} active contexts`);
    }
  }
  // Check the real shared scenery after the isolated close views.
  if (!process.argv.includes('--desktop')) {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator('.view-toggle').click();
    for (const id of ids) {
      await page.locator(`button[data-subject="${id}"]`).click();
      await page.waitForFunction(() => document.querySelector('#root')?.dataset.ready === 'true', null, { timeout: 60000 });
      await page.waitForFunction(() => [...document.querySelectorAll('.stage canvas')].every(canvas => canvas.dataset.environmentReady === 'true'), null, { timeout: 60000 });
      await page.locator('[data-mode="icon"] canvas').screenshot({ path: path.join(out, `${id}-world.png`) });
      const active = await page.evaluate(() => window.previewContexts.filter(gl => !gl.isContextLost()).length);
      if (active > 2) throw Error(`World view contexts not released: ${active}`);
      results.push({ id, width: 1440, worldView: true, contexts: { active } });
      console.log(`${id}: shared world view checked`);
    }
  }
  const tiles = [];
  for (const [row, id] of ids.entries()) {
    const icon = await sharp(`assets/scene-icons/soft3d/${id}.webp`).resize(300, 300, { fit: 'contain' }).extend({ top: 30, bottom: 30, left: 30, right: 30, background: '#f6f1e6' }).flatten({ background: '#f6f1e6' }).png().toBuffer();
    tiles.push({ input: icon, left: 0, top: row * 398 + 38 });
    for (const [column, mode] of ['current', 'icon'].entries()) tiles.push({ input: await sharp(path.join(out, `${id}-1440-${mode}.png`)).resize(360, 360).png().toBuffer(), left: (column + 1) * 360, top: row * 398 + 38 });
    tiles.push({ input: Buffer.from(`<svg width="1080" height="38"><rect width="1080" height="38" fill="#f6f1e6"/><g fill="#655645" font-size="14"><text x="20" y="25">${id} / ICON</text><text x="380" y="25">CURRENT</text><text x="740" y="25">SOFT MATERIAL</text></g></svg>`), left: 0, top: row * 398 });
  }
  await sharp({ create: { width: 1080, height: 1592, channels: 3, background: '#f6f1e6' } }).composite(tiles).png().toFile(path.join(out, 'comparison.png'));
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ browser: await browser.version(), results, errors, limitations: 'Desktop Chromium SwiftShader at DPR 1; real scene modules and real bundled woodfish model. Not device GPU measurements. Separate trial page; no production defaults or user saves changed.' }, null, 2));
  if (errors.length) throw Error(`${errors.length} browser errors: ${errors.join('\n')}`);
  console.log(JSON.stringify({ states: results.length, renders: results.length * 2, errors: errors.length }));
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(path.join(out, 'failure.json'), JSON.stringify({ message: String(error), errors, body: await page.locator('body').innerText().catch(() => ''), results }, null, 2));
  throw error;
} finally { await browser.close(); }
