import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { emptyLayoutState } from './fixtures/i18n-layout-state.mjs';

const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, 'artifacts/dev-i18n-layout');
const rows = [], errors = []; let server, browser;
await mkdir(out, { recursive: true });
try {
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5192', '--strictPort'], { cwd: path.join(root, 'apps/cyber-bless'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let log = ''; const timer = setTimeout(() => reject(Error(log)), 30000);
    server.stdout.on('data', chunk => { log += chunk; if (log.includes('Local:')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', chunk => { log += chunk; });
    server.on('exit', code => { clearTimeout(timer); reject(Error(`Vite exited ${code}: ${log}`)); });
  });
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const cache = [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'), process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'AppData/Local/ms-playwright')].find(candidate => candidate && existsSync(candidate));
    if (cache) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;
  }
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--enable-unsafe-swiftshader'] });
  for (const locale of ['fr', 'ja']) for (const route of ['/dev/gallery', '/dev/scene/tanzaku-tanabata']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale });
    await context.addInitScript(state => localStorage.setItem('cyber-bless:personal:v1', JSON.stringify(state)), emptyLayoutState(locale));
    const page = await context.newPage(); page.on('pageerror', error => errors.push({ locale, route, message: error.message }));
    await page.goto(`http://127.0.0.1:5192${route}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
    await page.locator(route.includes('/scene/') ? '.scene-bow-tap' : '.gallery-card-title').first().waitFor({ state: 'attached' });
    let liveLocale = null;
    if (route.includes('/scene/')) {
      await page.locator('.scene-bow-tap:not([hidden])').first().click();
      await page.locator('.scene-step-dot[data-state="done"]').first().waitFor();
      liveLocale = await page.evaluate(async ({ module, locale }) => {
        const api = await import(module), canvas = document.querySelector('canvas'), button = document.querySelector('.scene-bow-tap:not([hidden])');
        const before = button.getAttribute('aria-label'), checkpoint = [...document.querySelectorAll('.scene-step-dot')].map(dot => dot.dataset.state).join();
        api.configureLocale('en'); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const changed = button.getAttribute('aria-label') !== before;
        api.configureLocale(locale); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { canvasPreserved: document.querySelector('canvas') === canvas, buttonPreserved: document.querySelector('.scene-bow-tap:not([hidden])') === button, helperChanged: changed,
          checkpointPreserved: checkpoint === [...document.querySelectorAll('.scene-step-dot')].map(dot => dot.dataset.state).join(), restored: button.getAttribute('aria-label') === before };
      }, { module: `/@fs/${path.join(root, 'packages/i18n/src/index.ts').replaceAll('\\', '/')}`, locale });
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      const items = [...document.querySelectorAll('body *')].filter(el => el instanceof HTMLElement).map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
      for (const [el, size] of items) el.style.fontSize = `${size * 2}px`;
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    if (route.includes('/scene/')) {
      await page.locator('.scene-bow-tap:not([hidden])').first().scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    const result = await page.evaluate(() => {
      const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && s.clipPath !== 'inset(50%)' && !el.closest('[hidden]'); };
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
      const selectors = '.gallery-card-title,.app-nav a,.scene-topbar h1,.scene-topbar a,.scene-title,.scene-hint,.scene-cue-guide,.scene-bow-tap,.debug-overlay-toggle';
      const elements = [...document.querySelectorAll(selectors)].filter(visible);
      const clipped = elements.filter(el => el.scrollWidth > el.clientWidth + 2 || el.getBoundingClientRect().right > innerWidth + 1 || el.getBoundingClientRect().left < -1).map(el => ({ className: el.className, text: el.textContent, ...rect(el), scrollWidth: el.scrollWidth }));
      const hint = [...document.querySelectorAll('.scene-hint,.scene-cue-guides')].find(visible), action = document.querySelector('.scene-bow-tap:not([hidden])');
      let overlap = null;
      if (hint && action && visible(hint) && visible(action)) { const a = hint.getBoundingClientRect(), b = action.getBoundingClientRect(); if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) overlap = { hint: rect(hint), action: rect(action) }; }
      const actionRect = action && visible(action) ? rect(action) : null;
      return { language: document.documentElement.lang, scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth, clipped, overlap, actionReachable: !actionRect || actionRect.y >= 0 && actionRect.bottom <= innerHeight && actionRect.width >= 44 && actionRect.height >= 44, controls: elements.slice(0, 8).map(el => ({ text: el.textContent, ...rect(el) })) };
    });
    const screenshot = `${locale}-${route.includes('/scene/') ? 'scene' : 'gallery'}-320-200.png`;
    await page.screenshot({ path: path.join(out, screenshot) });
    rows.push({ locale, route, textScale: 2, liveLocale, ...result, screenshot }); await context.close();
  }
} finally {
  await browser?.close(); server?.kill();
  const passed = rows.length === 4 && !errors.length && rows.every(row => row.scrollWidth <= row.viewport + 1 && !row.clipped.length && !row.overlap && row.actionReachable && (!row.liveLocale || Object.values(row.liveLocale).every(Boolean)));
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ passed, checkedAt: new Date().toISOString(), scope: 'Representative French/Japanese developer gallery and one real tanzaku scene, 320×640 CSS pixels, simulated 200% computed text size. No claim of all scenes or native text scaling.', rows, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, cases: rows.length, errors, failures: rows.filter(row => row.clipped.length || row.overlap || row.scrollWidth > row.viewport + 1), out }));
  if (!passed) process.exitCode = 1;
}
