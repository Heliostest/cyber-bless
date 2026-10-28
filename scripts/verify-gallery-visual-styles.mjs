import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

// Run against the development host: node scripts/verify-gallery-visual-styles.mjs
// WBR_URL, WBR_BROWSER or WBR_BROWSER_PATH can select a host/browser. This is a
// desktop Chromium WebGL check, including a mobile-sized App viewport.
const root = process.cwd().replaceAll('\\', '/');
const base = new URL(process.env.WBR_URL || 'http://127.0.0.1:5182');
const output = path.resolve(root, 'artifacts/gallery-visual-styles-2026-10-28');
const gallery = ['gallery-toon', 'pencil-hatch', 'height-palette', 'normal-palette', 'sketch-contour', 'gallery-outline', 'space-grade', 'depth-rim'];
const styles = ['original', ...gallery];
const fixtures = [
  { id: 'crane', progress: 3, stage: 'day' },
  { id: 'furin-wind-chime', progress: 3, stage: 'day' },
  { id: 'lantern', progress: 3, stage: 'night' },
  { id: 'tibetan-water-bowls', progress: 9, stage: 'day' },
  { id: 'votive-candle-catholic', progress: 3, stage: 'night' },
];
const report = {
  capturedAt: new Date().toISOString(), base: base.href, matrix: [], ui: {}, failures: [], pageErrors: [], consoleErrors: [],
  limitations: 'Desktop headless Chromium with SwiftShader, 300px direct scene renders and 390×844 App viewport. This does not measure mobile device performance, FPS, GPU time or validate cultural claims.',
};
await mkdir(output, { recursive: true });
if (process.argv.includes('--ui-only') && existsSync(path.join(output, 'report.json'))) {
  const previous = JSON.parse(await readFile(path.join(output, 'report.json'), 'utf8'));
  report.matrix = previous.matrix || [];
  report.matrixCapturedAt = previous.matrixCapturedAt || previous.capturedAt;
  report.registeredStyles = previous.registeredStyles;
  report.matrixShaderErrors = previous.matrixShaderErrors || [];
  report.failures = (previous.failures || []).filter(failure => failure.scope === 'matrix');
}
const saveReport = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const bundled = chromium.executablePath();
const host = bundled.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
const launch = { headless: true, args: ['--no-proxy-server', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
if (process.env.WBR_BROWSER) launch.channel = process.env.WBR_BROWSER;
else launch.executablePath = process.env.WBR_BROWSER_PATH || (existsSync(bundled) ? bundled : host);
const browser = await chromium.launch(launch);
report.browser = await browser.version();

function installGLTelemetry() {
  const contexts = new Map(), failures = [], captures = [];
  window.__galleryGL = { contexts, failures, captures, current: null };
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, attributes) {
    const gl = get.call(this, kind, /^(webgl2?|experimental-webgl)$/.test(kind) ? { ...attributes, preserveDrawingBuffer: true } : attributes);
    if (gl && /^(webgl2?|experimental-webgl)$/.test(kind) && !contexts.has(this)) {
      const programs = [];
      contexts.set(this, { gl, programs });
      const link = gl.linkProgram.bind(gl);
      gl.linkProgram = program => {
        link(program); programs.push(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) failures.push({ current: window.__galleryGL.current,
          program: gl.getProgramInfoLog(program), shaders: (gl.getAttachedShaders(program) || []).map(shader => ({ log: gl.getShaderInfoLog(shader), source: gl.getShaderSource(shader) })) });
      };
    }
    return gl;
  };
  const encode = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    if (this.width === 160 && this.height === 120) captures.push({ width: this.width, height: this.height });
    return encode.apply(this, args);
  };
  window.__galleryPixels = canvas => {
    const entry = contexts.get(canvas);
    if (!entry) throw Error('No WebGL context for scene canvas');
    const { gl, programs } = entry, width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const rgba = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    let occupied = 0, colorful = 0, sum = 0, square = 0;
    for (let at = 0; at < rgba.length; at += 4) {
      if (rgba[at + 3] <= 8) continue;
      occupied++;
      const value = (rgba[at] + rgba[at + 1] + rgba[at + 2]) / 3;
      if (value > 4) colorful++;
      sum += value; square += value * value;
    }
    return { width, height, occupied, colorful, mean: occupied ? sum / occupied : 0,
      variance: occupied ? square / occupied - (sum / occupied) ** 2 : 0,
      invalidPrograms: programs.filter(program => gl.isProgram(program) && !gl.getProgramParameter(program, gl.LINK_STATUS)).length };
  };
}

function observe(page, scope) {
  page.on('pageerror', error => { report.pageErrors.push({ scope, message: error.message }); console.error('PAGEERROR', scope, error.message); });
  page.on('console', message => { if (message.type() === 'error') {
    report.consoleErrors.push({ scope, message: message.text() }); console.error('CONSOLE', scope, message.text().slice(0, 350));
  } });
}

async function matrix() {
  const context = await browser.newContext({ viewport: { width: 300, height: 300 }, deviceScaleFactor: 1 });
  await context.addInitScript(installGLTelemetry);
  const page = await context.newPage(); observe(page, 'matrix');
  await page.route('**/gallery-visual-verification', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>html,body{margin:0;background:#e8dfcc}#stage{width:300px;height:300px;position:relative}canvas{width:300px;height:300px;display:block}.overlay,.scene-object-cues{position:absolute;inset:0;visibility:hidden;pointer-events:none}</style></head><body><div id="stage"></div></body></html>' }));
  await page.goto(`${base.origin}/gallery-visual-verification`);
  await page.evaluate(async root => {
    window.process = { env: { EXPO_BASE_URL: '/' } };
    const file = name => `/@fs/${root}/${name}`;
    const { debugStyles } = await import(file('packages/scene-runtime/src/debug-styles.ts'));
    const { visualStyleOptions } = await import(file('packages/core/src/visual-style.ts'));
    const { loadScene } = await import(file('packages/scenes/src/registry.ts'));
    const shared = await import(file('packages/shared/src/index.ts'));
    const gestures = await import(file('packages/gestures/src/index.ts'));
    debugStyles.enable();
    window.__galleryProbe = { debugStyles, loadScene, shared, gestures, options: visualStyleOptions, instance: null };
  }, root);
  report.registeredStyles = await page.evaluate(() => window.__galleryProbe.options.map(option => option.id));
  assert.equal(report.registeredStyles.length, 16, 'all sixteen selectable styles are registered');
  for (const fixture of fixtures) {
    try {
      await page.evaluate(async fixture => {
        const p = window.__galleryProbe;
        p.instance?.dispose();
        document.querySelector('#stage').innerHTML = '<canvas></canvas><div class="overlay"></div><div class="scene-object-cues"></div>';
        const canvas = document.querySelector('canvas'), overlay = document.querySelector('.overlay');
        const mod = await p.loadScene(fixture.id);
        p.instance = mod.create({ canvas, overlay, shared: p.shared, gestures: p.gestures, sceneId: fixture.id,
          initialProgress: fixture.progress, isActive: () => true, isReducedMotion: () => true,
          isSoundEnabled: () => false, stage: fixture.stage, deferWishWriting: true, onProgress: () => {} });
        p.instance.start();
        await new Promise(resolve => setTimeout(resolve, 450));
        for (let n = 0; n < 4; n++) p.instance.update(1 / 30);
      }, fixture);
      await page.waitForFunction(() => {
        const canvas = document.querySelector('canvas');
        return !canvas.dataset.environment || canvas.dataset.environmentReady === 'true';
      }, undefined, { timeout: 90000 });
      for (const style of styles) {
        const item = await page.evaluate(({ fixture, style }) => {
          const p = window.__galleryProbe, telemetry = window.__galleryGL;
          telemetry.current = { id: fixture.id, style };
          const before = telemetry.failures.length;
          p.debugStyles.select(fixture.id, style);
          p.instance.update(1 / 30); p.instance.update(1 / 30);
          const canvas = document.querySelector('canvas');
          return { ...fixture, style, actual: p.debugStyles.getSnapshot().find(entry => entry.id === fixture.id)?.actual,
            shaderErrors: telemetry.failures.length - before, environment: canvas.dataset.environment,
            ...window.__galleryPixels(canvas) };
        }, { fixture, style });
        item.file = `${fixture.id}-${style}.png`;
        await page.locator('canvas').screenshot({ path: path.join(output, item.file) });
        if (item.actual !== style || item.shaderErrors || item.invalidPrograms || item.colorful < 100 || item.variance < 4) {
          report.failures.push({ scope: 'matrix', ...item });
        }
        report.matrix.push(item); await saveReport();
      }
      console.log('MATRIX', fixture.id, report.matrix.filter(item => item.id === fixture.id).map(item => `${item.style}:${item.actual}`).join(' '));
    } catch (error) { report.failures.push({ scope: 'matrix', id: fixture.id, message: error.message, stack: error.stack }); }
  }
  report.matrixShaderErrors = await page.evaluate(() => window.__galleryGL.failures);
  await saveReport();
  await page.evaluate(() => window.__galleryProbe.instance?.dispose());
  await context.close();
}

async function ui() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'zh-CN' });
  await context.addInitScript(installGLTelemetry);
  const key = 'cyber-bless:personal:v1';
  await context.addInitScript(({ key, origin }) => {
    if (location.origin === origin && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1,
      sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [],
      settings: { sound: false, haptics: false, reducedMotion: true } }));
  }, { key, origin: base.origin });
  const page = await context.newPage(); page.setDefaultTimeout(30000); observe(page, 'ui');
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const dialog = page.getByRole('dialog', { name: '视觉风格', exact: true });
  const screenshot = name => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false });
  async function chooseScene(id) {
    await page.locator('.scene-search input').fill(id);
    await page.locator(`.scene-card[data-scene="${id}"]`).tap();
    await page.locator(`.library-scene-stage[data-scene="${id}"][data-ready="true"] canvas[data-environment-ready="true"]`).waitFor({ timeout: 90000 });
  }
  async function openMenu() {
    const settings = page.getByRole('button', { name: '仪式设置', exact: true });
    if (await settings.getAttribute('aria-expanded') !== 'true') await settings.tap();
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: '视觉风格', exact: true }).tap(); await dialog.waitFor();
  }
  async function select(id) {
    const card = dialog.locator(`[data-style="${id}"]`);
    await card.scrollIntoViewIfNeeded(); await card.tap();
    await page.waitForFunction(id => document.querySelector(`[data-style="${id}"]`)?.getAttribute('aria-pressed') === 'true', id);
    await page.waitForTimeout(200);
    assert.doesNotMatch(await dialog.locator('[role="status"]').innerText(), /暂时无法显示/, `${id}: live App effect does not fall back`);
  }
  try {
    await page.goto(base.href, { waitUntil: 'domcontentloaded' });
    await page.locator('.app-shell[data-page="today"]').waitFor();
    await page.getByRole('button', { name: '我的', exact: true }).tap();
    await page.getByRole('button', { name: '场景目录', exact: true }).tap();
    await chooseScene('crane');
    const before = await saved();
    await openMenu();
    const optionIds = await dialog.locator('[data-style]').evaluateAll(cards => cards.map(card => card.dataset.style));
    assert.equal(optionIds.length, 16); assert.ok(gallery.every(id => optionIds.includes(id)));
    report.ui.optionIds = optionIds;
    await page.waitForFunction(expected => {
      const cards = [...document.querySelectorAll('.visual-style-filmstrip button[data-style]')];
      return cards.some(card => card.querySelector('.visual-style-swatch')?.dataset.previewState === 'unavailable') || cards.length === expected && cards.every(card => {
        const image = card.querySelector('img');
        return image?.complete && image.naturalWidth === 160 && image.naturalHeight === 120 && image.closest('.visual-style-swatch').dataset.previewState === 'ready';
      });
    }, optionIds.length, { timeout: 150000 });
    const unavailable = await dialog.locator('[data-preview-state="unavailable"]').evaluateAll(frames => frames.map(frame => frame.closest('[data-style]').dataset.style));
    assert.deepEqual(unavailable, [], `shader thumbnails unavailable: ${unavailable.join(', ')}`);
    const images = await dialog.locator('[data-style] img').evaluateAll(images => images.map(image => ({ style: image.closest('[data-style]').dataset.style, src: image.src })));
    report.ui.thumbnails = [];
    for (const image of images) {
      const bytes = Buffer.from(image.src.slice(image.src.indexOf(',') + 1), 'base64');
      const stats = await sharp(bytes).stats();
      assert.ok(stats.channels.slice(0, 3).some(channel => channel.stdev > 4), `${image.style}: real scene thumbnail has spatial detail`);
      const file = `ui-thumbnail-${image.style}.png`;
      await sharp(bytes).png().toFile(path.join(output, file));
      report.ui.thumbnails.push({ style: image.style, file, signature: createHash('sha256').update(bytes).digest('hex') });
    }
    assert.equal(new Set(report.ui.thumbnails.filter(image => gallery.includes(image.style)).map(image => image.signature)).size, gallery.length, 'the eight new shader thumbnails are independently rendered images');
    report.ui.thumbnailCaptureCount = await page.evaluate(() => window.__galleryGL.captures.length);
    assert.ok(report.ui.thumbnailCaptureCount >= optionIds.length, 'each thumbnail uses a real canvas capture');
    assert.deepEqual(await saved(), before, 'thumbnail generation does not save preferences or ritual progress');
    await screenshot('ui-sixteen-styles');
    await select('depth-rim');
    await dialog.locator('.visual-style-tuning summary').tap();
    const slider = dialog.locator('#visual-rimDirection'); await slider.focus(); await slider.press('End');
    assert.equal(await slider.inputValue(), '360');
    assert.deepEqual(await saved(), before, 'new effect parameters remain unsaved during preview');
    await screenshot('ui-new-effect-parameter-preview');
    await page.getByRole('button', { name: '关闭视觉风格', exact: true }).tap();
    await dialog.waitFor({ state: 'detached' });
    assert.deepEqual(await saved(), before, 'closing discards the new effect and parameter draft');
    report.ui.cancelledDraft = true;
    await openMenu(); await select('space-grade');
    await dialog.locator('.visual-style-tuning summary').tap();
    const glow = dialog.locator('#visual-glowStrength'); await glow.focus(); await glow.press('End');
    await dialog.getByRole('button', { name: '完成', exact: true }).tap();
    await dialog.waitFor({ state: 'detached' });
    const local = await saved();
    assert.equal(local.visualStyles?.crane?.style, 'space-grade');
    assert.equal(local.visualStyles?.crane?.parameters?.glowStrength, 1);
    assert.equal(local.globalVisualStyle, undefined);
    report.ui.savedLocal = local.visualStyles.crane;
    await page.reload({ waitUntil: 'domcontentloaded' });
    // App restores its own navigation independently; use its public navigation.
    if (!await page.locator('.scene-search input').count()) {
      await page.getByRole('button', { name: '我的', exact: true }).tap();
      await page.getByRole('button', { name: '场景目录', exact: true }).tap();
    }
    if (!await page.locator('.library-scene-stage[data-scene="crane"]').count()) await chooseScene('crane');
    await page.locator('.library-scene-stage[data-ready="true"] canvas[data-environment-ready="true"]').waitFor({ timeout: 90000 });
    await openMenu();
    assert.equal(await dialog.locator('[data-style="space-grade"]').getAttribute('aria-pressed'), 'true');
    await dialog.locator('.visual-style-tuning summary').tap();
    assert.equal(await dialog.locator('#visual-glowStrength').inputValue(), '1');
    report.ui.restoredAfterReload = true;
    await screenshot('ui-restored-local-style');
    await page.getByRole('button', { name: '关闭视觉风格', exact: true }).tap();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '返回', exact: true }).tap();
    await page.locator('.app-shell[data-page="scenes"]').waitFor();
    // The original lantern engine is exercised above, but is not a visible
    // catalog entry. Use the public glass wind-chime entry for App navigation.
    await chooseScene('furin-wind-chime'); await openMenu();
    assert.equal(await dialog.locator('[data-style="toon-soft"]').getAttribute('aria-pressed'), 'true', 'local choice does not leak into another scene');
    await select('gallery-toon');
    await dialog.getByRole('button', { name: '完成', exact: true }).tap();
    await dialog.waitFor({ state: 'detached' });
    const switched = await saved();
    assert.equal(switched.visualStyles?.crane?.style, 'space-grade');
    assert.equal(switched.visualStyles?.['furin-wind-chime']?.style, 'gallery-toon');
    assert.equal(await page.locator('.scene-load-error').count(), 0);
    report.ui.sceneSwitch = { scene: 'furin-wind-chime', pixels: await page.locator('.library-scene-stage canvas').evaluate(canvas => window.__galleryPixels(canvas)) };
    await screenshot('ui-switched-scene');
    report.ui.shaderErrors = await page.evaluate(() => window.__galleryGL.failures);
    assert.deepEqual(report.ui.shaderErrors, []);
    console.log('UI PASS', optionIds.length, 'real thumbnails; cancel, save, reload and scene switch');
  } catch (error) {
    report.failures.push({ scope: 'ui', message: error.message, stack: error.stack,
      sceneLoadErrors: await page.locator('.scene-load-error').allTextContents().catch(() => []) });
    await screenshot('ui-failure').catch(() => {});
    console.error('UI FAIL', error.message);
  } finally { await saveReport(); await context.close(); }
}

async function contactSheets() {
  const composites = [];
  for (let row = 0; row < fixtures.length; row++) for (let column = 0; column < styles.length; column++) {
    const file = path.join(output, `${fixtures[row].id}-${styles[column]}.png`);
    if (!existsSync(file)) continue;
    composites.push({ input: await sharp(file).resize(240, 240).png().toBuffer(), left: column * 240, top: row * 278 });
    composites.push({ input: Buffer.from(`<svg width="240" height="38"><rect width="100%" height="100%" fill="#17222b"/><text x="7" y="14" fill="white" font-size="11">${fixtures[row].id}</text><text x="7" y="30" fill="#ccd7dd" font-size="11">${styles[column]}</text></svg>`), left: column * 240, top: row * 278 + 240 });
  }
  if (composites.length) await sharp({ create: { width: styles.length * 240, height: fixtures.length * 278, channels: 3, background: '#17222b' } }).composite(composites).png().toFile(path.join(output, 'contact-sheet.png'));
  const images = report.ui.thumbnails || [], thumbs = [];
  for (let index = 0; index < images.length; index++) {
    thumbs.push({ input: await readFile(path.join(output, images[index].file)), left: index % 4 * 184 + 12, top: Math.floor(index / 4) * 152 });
    thumbs.push({ input: Buffer.from(`<svg width="184" height="32"><text x="7" y="20" fill="#253340" font-size="12">${images[index].style}</text></svg>`), left: index % 4 * 184, top: Math.floor(index / 4) * 152 + 120 });
  }
  if (thumbs.length) await sharp({ create: { width: 736, height: Math.ceil(images.length / 4) * 152, channels: 3, background: '#f3ead9' } }).composite(thumbs).png().toFile(path.join(output, 'ui-thumbnails-contact-sheet.png'));
  const preview = [], labels = ['图库卡通', '铅笔排线', '高度配色', '法线配色', '纸墨轮廓', '法线描边', '柔光调色', '深度边缘光'];
  for (let index = 0; index < gallery.length; index++) {
    const file = path.join(output, `crane-${gallery[index]}.png`);
    if (!existsSync(file)) continue;
    const left = index % 4 * 240, top = Math.floor(index / 4) * 278;
    preview.push({ input: await sharp(file).resize(240, 240).png().toBuffer(), left, top });
    preview.push({ input: Buffer.from(`<svg width="240" height="38"><rect width="100%" height="100%" fill="#17222b"/><text x="120" y="25" text-anchor="middle" fill="white" font-size="17" font-family="Microsoft YaHei,sans-serif">${labels[index]}</text></svg>`), left, top: top + 240 });
  }
  if (preview.length) await sharp({ create: { width: 960, height: 556, channels: 3, background: '#17222b' } }).composite(preview).png().toFile(path.join(output, 'new-styles-preview.png'));
}

try {
  if (!process.argv.includes('--ui-only')) await matrix();
  if (!process.argv.includes('--matrix-only')) await ui();
  await contactSheets();
} catch (error) { report.failures.push({ scope: 'harness', message: error.message, stack: error.stack }); }
finally { await browser.close(); await saveReport(); }
const summary = `# Gallery visual styles browser verification\n\n- Command: WBR_URL=${base.origin} node scripts/verify-gallery-visual-styles.mjs (or --ui-only to retain an already completed matrix).\n- Browser: ${report.browser}.\n- Direct scene/style renders: ${report.matrix.length}; requested complete matrix: ${fixtures.length * styles.length}. This includes the underlying lantern engine, which is intentionally hidden from the public App catalog.\n- UI real thumbnails: ${report.ui.thumbnails?.length || 0}; cancelled draft: ${!!report.ui.cancelledDraft}; reload restore: ${!!report.ui.restoredAfterReload}; public catalog scene switch: ${report.ui.sceneSwitch?.scene || 'not completed'}.\n- Failures: ${report.failures.length}; shader link errors: ${report.matrixShaderErrors?.length || 0}; page errors: ${report.pageErrors.length}; console errors: ${report.consoleErrors.length}.\n- ${report.limitations}\n\nSee report.json, contact-sheet.png, new-styles-preview.png and ui-thumbnails-contact-sheet.png for evidence.\n`;
await writeFile(path.join(output, 'README.md'), summary);
console.log(summary);
if (report.failures.length || report.matrixShaderErrors?.length || report.pageErrors.length || report.consoleErrors.length) process.exitCode = 1;
