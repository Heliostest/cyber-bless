import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { LAYOUT_ACTIVE_WISH, LAYOUT_FULFILLED_WISH, USER_NOTE_COLLISION, USER_NOTE_DRAFT, USER_WISH_TITLE,
  emptyLayoutState, populatedLayoutState } from './fixtures/i18n-layout-state.mjs';

// Real shipped messages, never injected sample translations. Text enlargement is
// deliberately a browser simulation; the report does not claim native Dynamic Type.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.env.WBR_LAYOUT_OUT || 'artifacts/i18n-layout');
const locales = (process.env.WBR_LAYOUT_LOCALES || 'zh-Hans,zh-Hant,en,ja,ko,es,pt,fr').split(',');
const widths = (process.env.WBR_LAYOUT_WIDTHS || '320,360,390,430,768,1440').split(',').map(Number);
const scales = (process.env.WBR_LAYOUT_SCALES || '1,1.5,2').split(',').map(Number);
const height = Number(process.env.WBR_LAYOUT_HEIGHT || 640);
const sourceOnly = process.env.WBR_LAYOUT_SOURCE_ONLY === '1';
const populated = process.env.WBR_LAYOUT_POPULATED !== '0';
const stress = process.env.WBR_LAYOUT_STRESS !== '0';
const additionalOnly = process.env.WBR_LAYOUT_ADDITIONAL_ONLY === '1';
const worldOnly = process.env.WBR_LAYOUT_WORLD_ONLY === '1';
const populatedViews = [
  { width: 320, height: 568, scale: 2 },
  { width: 390, height: 844, scale: 1 },
  { width: 320, height: 225, scale: 1, reflowEquivalent: '1280×900 desktop at400%:320×225CSSviewport; browserzoomUI not driven' },
];
const i18nModule = `/@fs/${path.join(root, 'packages/i18n/src/index.ts').replaceAll('\\', '/')}`;
const catalogsModule = `/@fs/${path.join(root, 'packages/i18n/src/catalogs.ts').replaceAll('\\', '/')}`;
const rows = [], screenshots = [], errors = [], fontCoverage = [], dockLineViolations = [];
let server, browser, page, current = {};
await mkdir(out, { recursive: true });

async function baseUrl() {
  if (process.env.WBR_URL) return process.env.WBR_URL;
  const port = process.env.WBR_LAYOUT_PORT || '5191';
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', port, '--strictPort'], {
    cwd: path.join(root, 'apps/cyber-bless'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(Error(`Vite did not start: ${log}`)), 30000);
    server.stdout.on('data', data => { log += data; if (log.includes('Local:')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', data => { log += data; });
    server.on('exit', code => { clearTimeout(timer); reject(Error(`Vite exited ${code}: ${log}`)); });
  });
  return `http://127.0.0.1:${port}`;
}

async function settle() {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function enlarge(scale) {
  await page.evaluate(scale => {
    globalThis.__layoutRestoreText?.();
    const items = [...document.querySelectorAll('.app-shell, .app-shell *')]
      .filter(element => element instanceof HTMLElement)
      .map(element => ({ element, original: element.style.fontSize, size: parseFloat(getComputedStyle(element).fontSize) }));
    for (const { element, size } of items) element.style.fontSize = `${size * scale}px`;
    globalThis.__layoutRestoreText = () => {
      for (const { element, original } of items) element.style.fontSize = original;
      delete globalThis.__layoutRestoreText;
    };
    window.dispatchEvent(new Event('resize'));
  }, scale);
  await settle();
}

async function inspect(route) {
  const result = await page.evaluate(() => {
    const visible = element => {
      const css = getComputedStyle(element), rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && css.display !== 'none' && css.visibility !== 'hidden' &&
        !element.closest('[hidden], [inert], [aria-hidden="true"]');
    };
    const selectors = '.title-ribbon, .count-pill, .filter-row button, .wish-card strong, .wish-title, .note-context, .note-preview p, .wish-source, .wish-practice-card strong, .wish-rack-item strong, .scene-card strong, .collection-card strong, .settings-row > span, .legal-information h2, .legal-information section p, .scene-completion-actions .button, .ritual-narrative-toggle';
    const clipped = [...document.querySelectorAll(selectors)].filter(visible).flatMap(element => {
      const css = getComputedStyle(element), rect = element.getBoundingClientRect();
      const horizontal = element.scrollWidth > element.clientWidth + 2;
      const vertical = element.scrollHeight > element.clientHeight + 2 && /hidden|clip/.test(css.overflowY);
      return horizontal || vertical ? [{ selector: element.className, text: element.textContent,
        width: rect.width, scrollWidth: element.scrollWidth, height: rect.height, scrollHeight: element.scrollHeight }] : [];
    });
    const dock = document.querySelector('.bottom-nav'), content = document.querySelector('.app-content');
    const dockReserve = dock && content ? { height: dock.getBoundingClientRect().height,
      bottom: parseFloat(getComputedStyle(dock).bottom) || 0,
      position: getComputedStyle(dock).position,
      padding: parseFloat(getComputedStyle(content).paddingBottom) || 0 } : null;
    const canvas = document.querySelector('.library-scene-stage .scene-canvas');
    const caption = document.querySelector('.room-caption');
    const roomCaption = caption ? { writingMode: getComputedStyle(caption).writingMode,
      letterSpacing: getComputedStyle(caption).letterSpacing, text: caption.textContent } : null;
    const counters = [...document.querySelectorAll('.count-pill')].filter(visible).map(element => ({ text: element.textContent,
      width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight, scrollHeight: element.scrollHeight }));
    const dockLabels = [...document.querySelectorAll('.bottom-nav button[data-tab]')].filter(visible).map(button => {
      const label = button.querySelector('span'), range = document.createRange(); range.selectNodeContents(label);
      const lines = new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top * 10) / 10)).size;
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { id: button.dataset.tab, visible: label.textContent, accessible: button.getAttribute('aria-label'), lines,
        width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight,
        centerHit: !!hit && (hit === button || button.contains(hit)), occluder: hit?.className };
    });
    const overflowElements = document.documentElement.scrollWidth > innerWidth + 2
      ? [...document.querySelectorAll('.app-shell *')].filter(element => element instanceof HTMLElement && visible(element))
        .map(element => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.right > innerWidth + 2 || rect.left < -2)
        .slice(0, 16).map(({ element, rect }) => ({ selector: element.className || element.tagName,
          text: element.textContent.slice(0, 100), left: rect.left, right: rect.right, width: rect.width,
          display: getComputedStyle(element).display })) : [];
    return { lang: document.documentElement.lang, viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth, overflowElements, clipped, dockReserve, roomCaption, counters, dockLabels,
      title: document.querySelector('.title-ribbon')?.textContent,
      ribbonSize: document.querySelector('.title-ribbon') ? getComputedStyle(document.querySelector('.title-ribbon')).fontSize : null,
      scrollFallback: document.querySelector('.app-shell')?.hasAttribute('data-layout-scroll') || false,
      canvasHeight: canvas?.getBoundingClientRect().height ?? null };
  });
  assert.ok(result.documentWidth <= result.viewport + 2, `${route}: document overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.clipped, [], `${route}: clipped text ${JSON.stringify(result.clipped)}`);
  if (result.roomCaption && ['en', 'es', 'pt', 'fr'].includes(result.lang)) {
    assert.equal(result.roomCaption.writingMode, 'horizontal-tb', `${route}: Latin caption is rotated vertically`);
    assert.ok(['normal', '0px'].includes(result.roomCaption.letterSpacing), `${route}: Latin caption uses CJK tracking`);
  }
  if (result.dockReserve?.position === 'fixed') assert.ok(result.dockReserve.padding >= result.dockReserve.height + result.dockReserve.bottom + 8,
    `${route}: dock clearance ${JSON.stringify(result.dockReserve)}`);
  for (const label of result.dockLabels) {
    if (label.lines < 1 || label.lines > 2) dockLineViolations.push({ ...current, route, ...label });
    assert.ok(label.visible?.trim() && label.accessible?.trim(), `${route}: missing visible or accessible dock label`);
    assert.ok(label.width >= 43.5 && label.height >= 43.5, `${route}: dock target is too small ${JSON.stringify(label)}`);
    assert.ok(label.top >= -1 && label.bottom <= label.viewportHeight + 1, `${route}: dock is outside viewport ${JSON.stringify(label)}`);
    assert.ok(label.centerHit, `${route}: dock target center is obscured ${JSON.stringify(label)}`);
  }
  if (result.dockLabels.length) {
    const expected = await page.evaluate(async module => {
      const { translate, message } = await import(module);
      return Object.fromEntries(Object.entries({ today: '今日', wishes: '心愿', world: '小天地', me: '我的' })
        .map(([id, source]) => [id, { accessible: translate(source), visible: message(`app.nav.${id}`) }]));
    }, i18nModule);
    for (const label of result.dockLabels) {
      assert.equal(label.accessible, expected[label.id].accessible, `${route}: short dock label lost its full localized accessible name`);
      assert.equal(label.visible, expected[label.id].visible, `${route}: dock label does not use its localized short message`);
    }
  }
  if (result.canvasHeight !== null) assert.ok(result.canvasHeight >= 222,
    `${route}: interaction canvas collapsed to ${result.canvasHeight}px`);
  rows.push({ ...current, route, ...result });
  return result;
}

async function restoreText() { await page.evaluate(() => globalThis.__layoutRestoreText?.()); }

async function tab(id) {
  await restoreText();
  await page.locator(`[data-tab="${id}"]`).click();
  await page.locator(`.app-shell[data-page="${id}"]`).waitFor();
  await settle();
}

async function back(route) {
  await restoreText(); await page.locator('.back-button').click();
  await page.locator(`.app-shell[data-page="${route}"]`).waitFor(); await settle();
}

async function translatedButton(source) {
  const name = await page.evaluate(async ({ source, module }) => (await import(module)).translate(source), { source, module: i18nModule });
  return page.getByRole('button', { name, exact: true });
}

async function reachable(selector, route) {
  const control = page.locator(selector).first();
  await control.scrollIntoViewIfNeeded(); await settle();
  const result = await control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
    const target = document.elementFromPoint(x, y);
    return { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom,
      viewportHeight: innerHeight, hit: !!target && (target === element || element.contains(target)), text: element.textContent };
  });
  assert.ok(result.width >= 43.5 && result.height >= 43.5 && result.top >= -1 && result.bottom <= result.viewportHeight + 1 && result.hit,
    `${route}: control is obscured or unreachable ${JSON.stringify(result)}`);
  rows.push({ ...current, route: `${route}-action`, control: result });
}

async function check(route, scale) { await enlarge(scale); await inspect(route); }

async function populatedRoutes(locale, view) {
  const { width, height: viewHeight, scale, reflowEquivalent } = view;
  current = { locale, width, height: viewHeight, scale, populated: true, ...(reflowEquivalent ? { reflowEquivalent } : {}) };
  await page.setViewportSize({ width, height: viewHeight });
  await tab('wishes'); await check('wishes-populated', scale);
  assert.equal(await page.locator(`.wish-card[data-wish-id="${LAYOUT_ACTIVE_WISH}"] strong`).textContent(), USER_WISH_TITLE);
  await page.locator('.wish-rack-toggle').click(); await check('wishes-rack-expanded', scale);
  await restoreText(); await page.locator(`.wish-card[data-wish-id="${LAYOUT_ACTIVE_WISH}"]`).click();
  await page.locator('.app-shell[data-page="wish"]').waitFor();
  await check('wish-detail', scale);
  assert.equal(await page.locator('.wish-title').textContent(), USER_WISH_TITLE);
  await restoreText(); await page.locator('.effort-card > .text-button').click();
  await check('wish-detail-all-notes', scale);
  assert.ok((await page.locator('.note-preview p').allTextContents()).includes(USER_NOTE_COLLISION), 'user note matching product copy was translated');
  await reachable('.wish-detail-page > .button.primary', 'wish-detail');
  await restoreText(); await page.locator('.effort-card .small-button').click();
  await page.locator('.app-shell[data-page="note"]').waitFor();
  await page.locator('#wish-note').fill(USER_NOTE_DRAFT);
  await page.locator('#wish-note').evaluate(element => { element.focus(); element.setSelectionRange(8, 12); });
  await check('wish-note-draft', scale);
  const editor = await page.locator('#wish-note').evaluate(element => ({ value: element.value,
    start: element.selectionStart, end: element.selectionEnd, height: element.clientHeight, scrollHeight: element.scrollHeight }));
  assert.equal(editor.value, USER_NOTE_DRAFT, 'font/layout changes must preserve user draft bytes');
  assert.deepEqual([editor.start, editor.end], [8, 12], 'font/layout changes must preserve selection');
  assert.ok(editor.scrollHeight <= editor.height + 2, `textarea did not grow to its text ${JSON.stringify(editor)}`);
  await reachable('.note-page > button[type="submit"]', 'wish-note');
  await back('wish'); await back('wishes');
  await page.locator('.filter-row button').nth(1).click(); await check('wishes-fulfilled', scale);
  await restoreText(); await page.locator(`.wish-card[data-wish-id="${LAYOUT_FULFILLED_WISH}"]`).click();
  await page.locator('.app-shell[data-page="wish"]').waitFor(); await check('wish-detail-fulfilled', scale);
  await back('wishes'); await page.locator('.filter-row button').nth(2).click(); await check('wishes-archived', scale);
  await tab('world'); await check('world-populated', scale);
  if (width === 320 && scale === 2 && !reflowEquivalent) await screenshot(`${locale}-populated-world-${width}-${scale}`);
  await restoreText(); await page.locator('.collection-card').first().click();
  await page.locator('.app-shell[data-page="collection"]').waitFor(); await check('collection-detail', scale);
  await back('world');
  await restoreText(); await (await translatedButton('仪式时光')).click();
  await page.locator('.app-shell[data-page="history"]').waitFor(); await check('history', scale);
  assert.ok(await page.locator('.timeline li, .scene-catalog .scene-card').count(), 'history fixture must contain records');
  await back('world'); await tab('me'); await check('me-settings', scale);
  for (const [source, route] of [['隐私政策', 'privacy'], ['技术支持', 'support'], ['资源缓存', 'cache'], ['场景目录', 'scenes']]) {
    await restoreText(); await (await translatedButton(source)).click();
    await page.locator(`.app-shell[data-page="${route}"]`).waitFor(); await check(route, scale);
    if (route === 'cache') await reachable('.cache-manager .button', 'cache');
    if (route === 'scenes') {
      await restoreText(); await page.locator('.scene-search input').fill('layout-no-matching-scene-xxxxxxxx');
      await check('catalog-no-results', scale);
    }
    await back('me');
  }
  if (width === 320 && !reflowEquivalent) { await check('me-settings-screenshot', scale); await screenshot(`${locale}-populated-me-${width}-${scale}`); }
}

async function stressRoutes(base) {
  const context = await browser.newContext({ locale: 'en', viewport: { width: 320, height: 568 } });
  page = await context.newPage(); page.on('pageerror', error => errors.push({ locale: 'en-XA-stress', message: error.message }));
  await page.addInitScript(state => localStorage.setItem('cyber-bless:personal:v1', JSON.stringify(state)), populatedLayoutState('en'));
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await tab('me');
    const pseudo = JSON.parse(await readFile(path.join(root, 'artifacts/i18n/pseudo-en-XA.json'), 'utf8'));
    const original = await page.locator('.title-ribbon').textContent();
    await page.evaluate(async ({ pseudo, module, catalogs }) => {
      Object.assign((await import(catalogs)).catalogData.en, pseudo);
      const { configureLocale } = await import(module);
      configureLocale('ja'); await new Promise(resolve => requestAnimationFrame(resolve)); configureLocale('en');
    }, { pseudo, module: i18nModule, catalogs: catalogsModule });
    await settle();
    const expanded = await page.locator('.title-ribbon').textContent();
    assert.notEqual(expanded, original, 'pseudo AST must flow through the formatter and React subscription');
    assert.ok(expanded.includes('['), 'pseudo AST must visibly mark expanded messages');
    current = { locale: 'en-XA', width: 320, height: 568, scale: 1.5, pseudo: 'FormatJS AST accent+expansion' };
    await check('pseudo-me-settings', 1.5); await screenshot('pseudo-me-settings-320-1.5');
    await restoreText(); await tab('wishes'); await check('pseudo-wishes-populated', 1.5);
    await restoreText(); await page.locator(`.wish-card[data-wish-id="${LAYOUT_ACTIVE_WISH}"]`).click();
    await page.locator('.app-shell[data-page="wish"]').waitFor(); await check('pseudo-wish-detail', 1.5);
    assert.equal(await page.locator('.wish-title').textContent(), USER_WISH_TITLE, 'pseudo catalog must not transform user content');
    await reachable('.wish-detail-page > .button.primary', 'pseudo-wish-detail');
    await back('wishes'); await restoreText();
    const spacing = await page.addStyleTag({ content: '.app-shell * { line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important } .app-shell p { margin-block-end:2em!important }' });
    current = { locale: 'en-XA', width: 320, height: 568, scale: 1, pseudo: 'FormatJS AST + text spacing override' };
    await inspect('pseudo-text-spacing-wishes'); await screenshot('pseudo-text-spacing-wishes-320'); await spacing.evaluate(node => node.remove());
  } finally { await context.close(); }
}

async function keyboardResize(locale) {
  await page.setViewportSize({ width: 390, height: 844 }); await tab('wishes');
  await page.locator(`.wish-card[data-wish-id="${LAYOUT_ACTIVE_WISH}"]`).click();
  await page.locator('.app-shell[data-page="wish"]').waitFor();
  await page.locator('.effort-card .small-button').click(); await page.locator('.note-page').waitFor();
  const field = page.locator('#wish-note'); await field.fill(USER_NOTE_DRAFT);
  await field.evaluate(element => { element.focus(); element.setSelectionRange(8, 12); });
  for (const reducedHeight of [320, 390]) {
    await page.setViewportSize({ width: 390, height: reducedHeight }); await settle();
    current = { locale, width: 390, height: reducedHeight, scale: 1, simulatedKeyboard: 'browser viewport resize from390×844; no native keyboard/IME claim' };
    await inspect('note-keyboard-like-resize');
    const beforeScroll = await field.evaluate(element => ({ focus: document.activeElement === element,
      value: element.value, start: element.selectionStart, end: element.selectionEnd }));
    assert.deepEqual(beforeScroll, { focus: true, value: USER_NOTE_DRAFT, start: 8, end: 12 });
    await reachable('.note-page > button[type="submit"]', 'note-keyboard-like-resize');
    assert.equal(await field.evaluate(element => document.activeElement === element), true, 'scrolling to submit must not steal editor focus');
    await screenshot(`${locale}-note-keyboard-like-390-${reducedHeight}`);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await settle();
  assert.equal(await field.inputValue(), USER_NOTE_DRAFT);
  await back('wish'); await back('wishes');
}

async function fontFailure(base, locale) {
  const context = await browser.newContext({ locale, viewport: { width: 320, height: 568 } });
  page = await context.newPage(); let abortedFonts = 0;
  page.on('pageerror', error => errors.push({ locale: `${locale}-font-failure`, message: error.message }));
  await page.route(/\.(?:woff2?|ttf|otf)(?:\?|$)/i, route => { abortedFonts++; return route.abort(); });
  await page.addInitScript(state => localStorage.setItem('cyber-bless:personal:v1', JSON.stringify(state)), populatedLayoutState(locale));
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await tab('wishes');
    current = { locale, width: 320, height: 568, scale: 2, fault: 'all bundled font requests aborted in isolated browser context' };
    await check('font-failure-wishes', 2);
    assert.ok(abortedFonts > 0, 'font failure test must actually abort font requests');
    const statuses = await page.evaluate(() => [...document.fonts].map(font => ({ family: font.family, status: font.status })));
    assert.ok(statuses.some(font => font.status === 'error'), 'font failure must reach a failed FontFace');
    rows.push({ ...current, route: 'font-failure-status', abortedFonts, statuses, actualFonts: await fonts() });
    await tab('world'); await check('font-failure-world', 2);
    await page.locator('.room-caption').scrollIntoViewIfNeeded(); await settle();
    await screenshot(`${locale}-font-failure-world-caption-320-2`);
    await tab('me'); await check('font-failure-me', 2);
    await screenshot(`${locale}-font-failure-me-320-2`);
  } finally { await context.close(); }
}

async function screenshot(name) {
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false }); screenshots.push(file);
}

async function fonts() {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable'); await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.title-ribbon' });
    return nodeId ? (await session.send('CSS.getPlatformFontsForNode', { nodeId })).fonts : [];
  } finally { await session.detach(); }
}

async function verifyFontCoverage(locale) {
  const sample = { 'zh-Hans': '直骨令愿', 'zh-Hant': '直骨令願', ja: '直骨令かな', ko: '나의 소원',
    en: 'Wish – café e\u0301', es: 'mañana ilusión e\u0301', pt: 'coração bênção e\u0301', fr: 'cœur Aujourd’hui œuvre e\u0301' }[locale];
  await page.evaluate(({ locale, sample }) => {
    const node = document.createElement('p'); node.id = 'layout-font-sample'; node.lang = locale; node.textContent = sample;
    node.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:99999;background:white'; document.body.appendChild(node);
  }, { locale, sample });
  const session = await page.context().newCDPSession(page);
  try {
    await page.evaluate(() => document.fonts.ready);
    await session.send('DOM.enable'); await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#layout-font-sample' });
    const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
    if (['zh-Hant', 'ja', 'ko', 'en', 'es', 'pt', 'fr'].includes(locale)) {
      assert.ok(fonts.every(font => !/NotoSansSC|Blessing Sans/.test(`${font.familyName} ${font.postScriptName}`)),
        `${locale}: unexpected Simplified Chinese fallback ${JSON.stringify(fonts)}`);
    }
    fontCoverage.push({ locale, sample, fonts });
  } finally { await session.detach(); await page.evaluate(() => document.querySelector('#layout-font-sample')?.remove()); }
}

try {
  if (!sourceOnly) for (const group of ['app', 'scenes', 'narratives']) {
    const source = JSON.parse(await readFile(path.join(root, 'packages/i18n/src/catalogs/zh-Hans', `${group}.json`), 'utf8'));
    for (const locale of locales) {
      const target = JSON.parse(await readFile(path.join(root, 'packages/i18n/src/catalogs', locale, `${group}.json`), 'utf8'));
      const missing = Object.keys(source).filter(id => typeof target[id] !== 'string' || !target[id].trim());
      assert.equal(missing.length, 0, `${locale}/${group}: ${missing.length} untranslated entries; compile complete catalogs before claiming a real-locale matrix`);
    }
  }
  const base = await baseUrl();
  const defaultCache = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright');
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && defaultCache && existsSync(defaultCache)) process.env.PLAYWRIGHT_BROWSERS_PATH = defaultCache;
  browser = await chromium.launch({ headless: true,
    ...(process.env.WBR_BROWSER ? { channel: process.env.WBR_BROWSER } : {}),
    args: ['--no-proxy-server', '--enable-unsafe-swiftshader'] });
  for (const locale of locales) {
    const context = await browser.newContext({ locale, viewport: { width: 320, height } });
    page = await context.newPage();
    page.on('pageerror', error => errors.push({ locale, message: error.message }));
    await page.addInitScript(state => {
      if (!sessionStorage.getItem('i18n-layout-seeded')) {
        localStorage.setItem('cyber-bless:personal:v1', JSON.stringify(state)); sessionStorage.setItem('i18n-layout-seeded', '1');
      }
    }, additionalOnly || worldOnly ? populatedLayoutState(locale) : emptyLayoutState(locale));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    if (!sourceOnly) await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
    if (worldOnly) {
      for (const view of populatedViews) {
        current = { locale, ...view, populated: true, regression: 'complete translated collection counter' };
        await page.setViewportSize({ width: view.width, height: view.height }); await tab('world');
        await check('world-counter-regression', view.scale);
        if (view.scale === 2) await screenshot(`${locale}-world-counter-320-2`);
      }
      await context.close(); continue;
    }
    if (additionalOnly) { await keyboardResize(locale); await context.close(); continue; }
    await page.locator('[data-tab="wishes"]').click(); await settle();
    await verifyFontCoverage(locale);
    const actualFonts = await fonts();
    for (const width of widths) for (const scale of scales) {
      current = { locale, width, scale, actualFonts };
      await page.setViewportSize({ width, height }); await enlarge(scale);
      await inspect('wishes-empty');
      if (width === 320 && scale === 2 || width === 390 && scale === 1) await screenshot(`${locale}-wishes-${width}-${scale}`);
    }
    await page.evaluate(() => globalThis.__layoutRestoreText?.());
    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator('.pray-button').click(); await settle();
    current = { locale, width: 320, height: 568, scale: 1 };
    await inspect('ritual-picker');
    await page.locator('.wish-scene-choice[data-scene="tanzaku-tanabata"]').click();
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor({ timeout: 30000 });
    await enlarge(2); current.scale = 2;
    await inspect('scene-large-text');
    const trigger = page.locator('.ritual-narrative-toggle');
    await trigger.click(); await settle();
    const panel = await page.locator('.ritual-narrative[role="dialog"]').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewport: innerWidth,
        height: innerHeight, triggerHeight: element.querySelector('button').getBoundingClientRect().height,
        bodyTop: element.querySelector('.ritual-narrative-body').getBoundingClientRect().top };
    });
    assert.ok(panel.left >= -1 && panel.right <= panel.viewport + 1, `dialog exceeds viewport ${JSON.stringify(panel)}`);
    assert.ok(panel.top >= -1 && panel.bottom <= panel.height + 1, `dialog exceeds visible height ${JSON.stringify(panel)}`);
    assert.ok(panel.bodyTop >= panel.top + panel.triggerHeight - 2, `dialog text overlaps its trigger ${JSON.stringify(panel)}`);
    rows.push({ ...current, route: 'narrative-large-text', panel });
    await screenshot(`${locale}-scene-dialog-320-2`);
    await page.keyboard.press('Escape');
    await page.locator('.scene-bow-tap:not([hidden])').first().scrollIntoViewIfNeeded(); await settle();
    const helper = await page.locator('.scene-bow-tap:not([hidden])').first().boundingBox();
    assert.ok(helper && helper.width >= 44 && helper.height >= 44 && helper.y >= 0 && helper.y + helper.height <= 569,
      `scene helper is not reachable ${JSON.stringify(helper)}`);
    await screenshot(`${locale}-scene-controls-320-2`);
    if (populated) {
      await page.evaluate(state => localStorage.setItem('cyber-bless:personal:v1', JSON.stringify(state)), populatedLayoutState(locale));
      await page.reload({ waitUntil: 'domcontentloaded' });
      if (!sourceOnly) await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
      for (const view of populatedViews) await populatedRoutes(locale, view);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cyber-bless:personal:v1')));
      assert.equal(saved.wishes.find(wish => wish.id === LAYOUT_ACTIVE_WISH).title, USER_WISH_TITLE);
      assert.equal(saved.wishes.find(wish => wish.id === LAYOUT_ACTIVE_WISH).notes[0].text, USER_NOTE_COLLISION);
      await keyboardResize(locale);
    }
    await context.close();
  }
  if (stress && !additionalOnly && !worldOnly) await stressRoutes(base);
  for (const locale of ['fr', 'zh-Hant']) await fontFailure(base, locale);
  assert.deepEqual(errors, [], 'browser page errors');
  assert.deepEqual(dockLineViolations, [], `dock labels wrap beyond two lines: ${JSON.stringify(dockLineViolations)}`);
  const report = { passed: true, sourceOnly, additionalOnly, worldOnly, checkedAt: new Date().toISOString(), rows, screenshots, errors, fontCoverage,
    scope: worldOnly ? 'World counter and dock regression in all requested locales at three representative views, including large text and desktop400%CSSreflow equivalence, plus French/Hantfont failures. Complete visible countertext, one-or-two-line localized dock labels, original full accessible names,44px targets, viewport bounds and actual center hits are asserted. This is a Vite DEV browser run, not native keyboard or all-scene verification.' : additionalOnly
      ? 'Additional suite only: note-editor viewport resize from390×844 to390×320/390 preserving draft/selection/focus and reachable submit, plus isolated French/Hant bundled-font failures. These are browser simulations, not native keyboard/IME or all-scene verification.'
      : 'Eight shipped locales; empty wishes at requested viewport/text-scale matrix; populated wish/rack/detail/note/world/collection/settings/privacy/support/cache/history/catalog at three representative views; one tanzaku scene/dialog/helper per locale; actual FormatJS pseudo AST and text spacing; note-editor reduced viewport and French/Hant bundled-font failures. Desktop400% is a CSS reflow equivalence, not browser zoom UI. Native text scaling, hardware/accessibility and human linguistic review are separate. This does not test all87scenes.' };
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, cases: rows.length, sourceOnly, additionalOnly, worldOnly, out, screenshots: screenshots.length }));
} catch (error) {
  if (page && !page.isClosed()) await screenshot('failure').catch(() => {});
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ passed: false, sourceOnly, additionalOnly, worldOnly, current, rows, screenshots, errors, fontCoverage, dockLineViolations, error: error.stack || String(error) }, null, 2) + '\n');
  throw error;
} finally { await browser?.close(); server?.kill(); }
