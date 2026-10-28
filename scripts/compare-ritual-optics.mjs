import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Re-render HEAD or the saved pre-refinement modules against the working tree.
// Never modifies production scene sources.
const root = process.cwd().replaceAll('\\', '/');
const base = process.env.WBR_URL || 'http://127.0.0.1:5177';
const refinement = process.argv.includes('--refinement');
const output = refinement ? 'artifacts/ritual-optics/refinement' : 'artifacts/ritual-optics/comparison';
const out = path.join(root, output);
await mkdir(path.join(out, 'baseline'), { recursive: true });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const cases = [
  { id: 'lantern', title: '灯笼', create: 'createLantern', progress: 3, stage: 'night', crop: { left: 195, top: 145, width: 330, height: 220 } },
  { id: 'furin-wind-chime', title: '风铃', create: 'createFurinWindChime', progress: 3, stage: 'day', crop: { left: 235, top: 155, width: 250, height: 165 } },
  { id: 'japanese-wagasa', title: '纸伞', create: 'createJapaneseWagasa', progress: 1, stage: 'day', crop: { left: 65, top: 25, width: 590, height: 265 } },
].filter(item => !refinement || item.id !== 'furin-wind-chime');
const files = [...cases.map(c => `packages/scenes/src/${c.id}/scene.ts`), 'packages/scenes/src/japanese-wagasa/model.ts', ...(refinement ? ['packages/scene-runtime/src/ritual-optics.ts', 'packages/scene-runtime/src/toon-surfaces.ts'] : [])];
const baseline = new Map(files.map(file => [file, `${output}/baseline/${file}`]));
const hashes = [];
const hash = data => createHash('sha256').update(data).digest('hex');
for (const file of files) {
  const before = refinement ? await readFile(path.join(root, 'artifacts/ritual-optics/refinement-before/source', file), 'utf8') : execFileSync('git', ['show', `${revision}:${file}`], { encoding: 'utf8', maxBuffer: 2 ** 22 });
  const after = await readFile(path.join(root, file), 'utf8');
  hashes.push({ file, before: hash(before), after: hash(after) });
  // Resolve relative imports against the real source directory. Model imports
  // whose files are in this baseline use the matching historical module.
  const relocated = before.replace(/((?:from\s*|import\s*\()\s*['"])([^'"]+)(['"])/g, (all, start, specifier, end) => {
    const relative = specifier.startsWith('.');
    const runtime = specifier.startsWith('@wbr/scene-runtime/');
    if (!relative && !runtime) return all;
    const resolved = relative ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : `packages/scene-runtime/src/${specifier.slice('@wbr/scene-runtime/'.length)}`;
    const original = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}/index.ts`].find(candidate => existsSync(path.join(root, candidate))) || resolved;
    const target = baseline.get(original) || original;
    return `${start}/@fs/${root}/${target}${end}`;
  });
  const dest = path.join(root, baseline.get(file));
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, relocated);
}

const bundled = chromium.executablePath();
const host = bundled.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
const browser = await chromium.launch({ headless: true, executablePath: process.env.OPTICS_BROWSER_PATH || (existsSync(bundled) ? bundled : host), args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { revision, baseline: refinement ? 'pre-refinement working tree snapshot (after initial optics integration)' : 'HEAD', browser: await browser.version(), canvas: [720, 720], dpr: 1, style: 'toon-soft', sourceHashes: hashes, frames: [], errors: [], notes: 'Baseline modules relocated only for imports; refinement also loads its saved optical factory and toon adapter. Identical viewport, authored pose, day/night, time, updates, exposure and crop. No recoloring or contrast enhancement. Desktop SwiftShader; not a mobile performance test.' };
try {
  for (const item of cases) for (const variant of ['before', 'after']) {
    const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push({ scene: item.id, variant, error: error.message }));
    page.on('console', msg => { if (msg.type() === 'error') report.errors.push({ scene: item.id, variant, error: msg.text() }); });
    await page.addInitScript(() => {
      let seed = 197503;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      Date.now = () => 1800000000000;
      Object.defineProperty(performance, 'now', { value: () => 1000 });
    });
    if (refinement && variant === 'before') {
      await page.route('**/packages/scene-runtime/src/toon-surfaces.ts*', async route => {
        const response = await route.fetch({ url: `${base}/@fs/${root}/${baseline.get('packages/scene-runtime/src/toon-surfaces.ts')}` });
        await route.fulfill({ response });
      });
    }
    await page.route('**/optics-comparison', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>html,body{margin:0;width:720px;height:720px;background:#e8dfcc}#stage{width:720px;height:720px;position:relative}canvas{display:block;width:720px;height:720px}.overlay,.scene-object-cues{position:absolute;inset:0;visibility:hidden;pointer-events:none}</style></head><body><div id="stage"><canvas></canvas><div class="overlay"></div><div class="scene-object-cues"></div></div></body></html>' }));
    await page.goto(`${base}/optics-comparison`);
    const result = await page.evaluate(async ({ root, item, variant, modulePath }) => {
      window.process = { env: { EXPO_BASE_URL: '/' } };
      const contexts = new Map(), links = [];
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(kind, attributes) {
        const gl = getContext.call(this, kind, /^webgl/.test(kind) ? { ...attributes, preserveDrawingBuffer: true } : attributes);
        if (gl && /^webgl/.test(kind) && !contexts.has(this)) {
          contexts.set(this, gl);
          const link = gl.linkProgram.bind(gl);
          gl.linkProgram = program => { link(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) links.push(gl.getProgramInfoLog(program)); };
        }
        return gl;
      };
      const file = p => `/@fs/${root}/${p}`;
      const { debugStyles } = await import(file('packages/scene-runtime/src/debug-styles.ts'));
      const shared = await import(file('packages/shared/src/index.ts'));
      const gestures = await import(file('packages/gestures/src/index.ts'));
      debugStyles.enable();
      const mod = await import(file(modulePath));
      const canvas = document.querySelector('canvas'), overlay = document.querySelector('.overlay');
      const instance = mod[item.create]({ canvas, overlay, shared, gestures, sceneId: item.id, initialProgress: item.progress, isActive: () => true, isReducedMotion: () => true, isSoundEnabled: () => false, stage: item.stage, deferWishWriting: true, onProgress: () => {} });
      instance.start();
      // Same environment settling and same authored animation frame on both sides.
      await new Promise(resolve => setTimeout(resolve, 400));
      debugStyles.select(item.id, 'toon-soft');
      for (let i = 0; i < 8; i++) instance.update(1 / 30);
      const gl = contexts.get(canvas);
      if (!gl) throw Error('No actual WebGL context');
      const rgba = new Uint8Array(720 * 720 * 4);
      gl.readPixels(0, 0, 720, 720, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      let colorful = 0;
      for (let i = 0; i < rgba.length; i += 4) if (rgba[i] + rgba[i + 1] + rgba[i + 2] > 12 && rgba[i + 3] > 0) colorful++;
      const actual = debugStyles.getSnapshot().find(s => s.id === item.id)?.actual;
      window.comparisonInstance = instance;
      return { scene: item.id, variant, progress: item.progress, stage: item.stage, actual, links, colorful, environment: canvas.dataset.environment, exposureUnmodified: true };
    }, { root, item, variant, modulePath: variant === 'before' ? baseline.get(`packages/scenes/src/${item.id}/scene.ts`) : `packages/scenes/src/${item.id}/scene.ts` });
    await page.locator('canvas').screenshot({ path: path.join(out, `${item.id}-${variant}.png`) });
    report.frames.push(result);
    await page.evaluate(() => window.comparisonInstance.dispose());
    await page.close();
    console.log(`${item.id} ${variant}: ${result.actual}; shader link errors ${result.links.length}`);
  }
} finally { await browser.close(); }

function label(title, subtitle, width, height = 76) {
  const safe = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#17222b"/><text x="24" y="32" fill="#ffffff" font-size="23" font-family="Microsoft YaHei, sans-serif">${safe(title)}</text><text x="24" y="59" fill="#bac6cd" font-size="15" font-family="Microsoft YaHei, sans-serif">${safe(subtitle)}</text></svg>`);
}
for (const item of cases) {
  const before = await readFile(path.join(out, `${item.id}-before.png`));
  const after = await readFile(path.join(out, `${item.id}-after.png`));
  const a = await sharp(before).removeAlpha().raw().toBuffer();
  const b = await sharp(after).removeAlpha().raw().toBuffer();
  let changed = 0, totalDiff = 0, maxDiff = 0;
  for (let i = 0; i < a.length; i += 3) {
    const diff = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    if (diff > 2) changed++;
    maxDiff = Math.max(maxDiff, diff);
    totalDiff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  }
  const metrics = { scene: item.id, changedPixelsOver2: changed, meanAbsoluteChannelDifference: totalDiff / a.length, maxChannelDifference: maxDiff };
  report.frames.find(f => f.scene === item.id && f.variant === 'after').comparison = metrics;
  for (const detail of [false, true]) {
    const images = [];
    for (const bytes of [before, after]) {
      images.push(detail ? await sharp(bytes).extract(item.crop).resize(720, 480, { fit: 'contain', background: '#e8dfcc' }).png().toBuffer() : bytes);
    }
    const imageHeight = detail ? 480 : 720;
    await sharp({ create: { width: 1448, height: imageHeight + 76, channels: 3, background: '#17222b' } }).composite([
      { input: label(`${item.title} · ${refinement ? '调校前' : '接入前'}`, detail ? '同一区域放大 · 未调色或增强对比度' : refinement ? '上一版已接入材质 · 默认柔和卡通' : '接入前 Git 版本 · 默认柔和卡通', 720), left: 0, top: 0 },
      { input: label(`${item.title} · ${refinement ? '本轮调校后' : '接入后'}`, detail ? '同一区域放大 · 未调色或增强对比度' : '当前材质 · 相同视角、光照与状态', 720), left: 728, top: 0 },
      { input: images[0], left: 0, top: 76 }, { input: images[1], left: 728, top: 76 },
    ]).png().toFile(path.join(out, `${item.id}-${detail ? 'detail' : 'comparison'}.png`));
  }
  console.log(JSON.stringify(metrics));
}
await writeFile(path.join(out, 'comparison-report.json'), JSON.stringify(report, null, 2));
const invalid = report.frames.filter(f => f.actual !== report.style || f.links.length || !f.colorful);
if (report.errors.length || invalid.length || report.frames.length !== cases.length * 2) throw Error(`Comparison verification failed: ${JSON.stringify({ errors: report.errors, invalid })}`);
console.log(`${report.frames.length} real renders verified. Comparison output: ${out}`);
