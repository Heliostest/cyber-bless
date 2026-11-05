import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = process.cwd().replaceAll('\\', '/');
const base = process.env.WBR_URL || 'http://127.0.0.1:5184';
const out = path.resolve(process.env.CRAFT_OUT || 'artifacts/material-assessment/verified');
await mkdir(out, { recursive: true });
const ids = ['ema-votive-plaque', 'barcelos-clay-rooster', 'shrine-suzu-bell', 'omamori-cycle'];
const sourceFiles = ['packages/scene-runtime/src/craft-surfaces.ts', 'packages/scene-runtime/src/toon-surfaces.ts', 'packages/scene-runtime/src/gallery-surfaces.ts',
  'scripts/verify-craft-surfaces-webgl.mjs', ...ids.map(id => `packages/scenes/src/${id}/scene.ts`)];
const captureSources = () => Promise.all(sourceFiles.map(async file => ({ file, sha256: createHash('sha256').update(await readFile(file)).digest('hex') })));
const sourceSnapshot = await captureSources();
const bundled = chromium.executablePath();
const fallback = bundled.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CRAFT_BROWSER_PATH || (existsSync(bundled) ? bundled : fallback),
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
const errors = [], results = [], profiles = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.route('**/craft-verification', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>body{margin:0;background:#e8dfcc}#stage{position:relative;width:100vw;height:100vh}canvas{display:block;width:100%;height:100%}.overlay{display:none}.scene-object-cues{position:absolute;inset:0;pointer-events:none}</style></head><body><div id="stage"></div></body></html>' }));
try {
  await page.goto(`${base}/craft-verification`);
  await page.evaluate(async root => {
    window.process = { env: { EXPO_BASE_URL: '/' } };
    const file = p => `/@fs/${root}/${p}`;
    const styleURL = file('packages/scene-runtime/src/render-style.ts');
    const source = await (await fetch(styleURL)).text();
    const THREE = await import(source.match(/from\s+["']([^"']*three[^"']*)["']/)[1]);
    const { loadScene } = await import(file('packages/scenes/src/registry.ts'));
    const { createRenderStyle } = await import(styleURL);
    const { createCraftMaterial } = await import(file('packages/scene-runtime/src/craft-surfaces.ts'));
    const { debugStyles } = await import(file('packages/scene-runtime/src/debug-styles.ts'));
    const shared = await import(file('packages/shared/src/index.ts'));
    const gestures = await import(file('packages/gestures/src/index.ts'));
    debugStyles.enable();
    const p = window.craftProbe = { THREE, loadScene, createRenderStyle, createCraftMaterial, debugStyles, shared, gestures, scene: null };
    const before = THREE.Object3D.prototype.onBeforeRender;
    THREE.Object3D.prototype.onBeforeRender = function(renderer, scene, ...rest) {
      const materials = Array.isArray(this.material) ? this.material : [this.material];
      if (materials.some(material => material?.userData.craftSurface)) p.scene = scene;
      return before.call(this, renderer, scene, ...rest);
    };
    p.validPixels = canvas => {
      const gl = canvas.getContext('webgl2'), pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let colored = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 8 && pixels[i] + pixels[i + 1] + pixels[i + 2] > 12) colored++;
      if (colored < 100) throw Error('Empty/black rendered frame');
      return colored;
    };
  }, root);

  // Real driver compilation, including local projection on geometry without UVs
  // and a deliberately dim light rig. No claim of measured phone performance.
  for (const kind of ['wood', 'ceramic', 'metal', 'fabric', 'cord']) for (const lighting of ['day', 'dim']) {
    profiles.push(await page.evaluate(({ kind, lighting }) => {
      const p = window.craftProbe, T = p.THREE, stage = document.querySelector('#stage');
      stage.innerHTML = '<canvas></canvas>';
      const canvas = stage.querySelector('canvas'), renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(640, 640); const scene = new T.Scene();
      scene.add(new T.AmbientLight(0xd8e7ff, lighting === 'dim' ? .18 : .5));
      const key = new T.DirectionalLight(0xffeccf, lighting === 'dim' ? .65 : 3); key.position.set(-3, 4, 4); scene.add(key);
      const material = p.createCraftMaterial({ color: kind === 'metal' ? 0xd8b468 : 0xb58b64 }, { kind });
      const geometry = new T.SphereGeometry(.75, 48, 32); geometry.deleteAttribute('uv');
      scene.add(new T.Mesh(geometry, material));
      const camera = new T.PerspectiveCamera(38, 1, .1, 20); camera.position.set(0, .4, 3); camera.lookAt(0, 0, 0);
      const adapter = p.createRenderStyle(renderer, scene, camera), styles = [];
      try {
        for (const style of ['original', 'toon-soft', 'toon-ink', 'gouache', 'pencil-hatch']) {
          adapter.setStyle(style); adapter.resize(640, 640); adapter.render();
          if (adapter.getStyle() !== style) throw Error(`Style fallback: ${kind}/${style}`);
          styles.push({ style, coloredPixels: p.validPixels(canvas) });
        }
        return { kind, lighting, styles };
      } finally { adapter.dispose(); material.dispose(); geometry.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
    }, { kind, lighting }));
  }

  for (const width of [320, 390, 640]) {
    await page.setViewportSize({ width, height: width });
    for (const lighting of width === 640 ? ['day'] : ['day', 'night'])
    for (const id of ids) for (const progress of width === 640 || lighting === 'night' ? [1] : [0, 1, 3]) {
      const result = await page.evaluate(async ({ id, progress, lighting }) => {
        const p = window.craftProbe, stage = document.querySelector('#stage'); p.scene = null;
        // Object presentation keeps the real scene's authored night light rig;
        // the shared environment otherwise selects a day rig by scene ID.
        if (lighting === 'night') stage.dataset.scenePresentation = 'object';
        else delete stage.dataset.scenePresentation;
        stage.innerHTML = '<canvas></canvas><div class="overlay"></div><div class="scene-object-cues"></div>';
        const canvas = stage.querySelector('canvas'), overlay = stage.querySelector('.overlay'), callbacks = [];
        let active = true;
        const mod = await p.loadScene(id);
        const instance = mod.create({ canvas, overlay, shared: p.shared, gestures: p.gestures, sceneId: id, initialProgress: progress,
          isActive: () => active, isReducedMotion: () => true, isSoundEnabled: () => false, stage: lighting, deferWishWriting: true,
          onProgress: value => callbacks.push(value) });
        p.current = instance; instance.start(); instance.update(1 / 30);
        for (let attempt = 0; lighting === 'day' && attempt < 100 && canvas.dataset.environmentReady !== 'true'; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 50)); instance.update(0);
        }
        if ((lighting === 'day' && canvas.dataset.environmentReady !== 'true') || !p.scene) throw Error(`Environment/scene unavailable: ${id}`);
        const sources = [], craftMaterials = new Set();
        p.scene.traverse(object => {
          if (!object.isMesh) return;
          sources.push([object, object.material]);
          for (const material of Array.isArray(object.material) ? object.material : [object.material])
            if (material.userData.craftSurface) craftMaterials.add(material);
        });
        if (!craftMaterials.size) throw Error(`No craft materials in ${id}`);
        const disposed = new Map([...craftMaterials].map(material => [material, 0]));
        craftMaterials.forEach(material => material.addEventListener('dispose', () => disposed.set(material, disposed.get(material) + 1)));
        const styles = [];
        for (const style of ['original', 'toon-soft', 'toon-ink', 'gouache']) {
          p.debugStyles.select(id, style); instance.update(0); instance.update(0);
          const actual = p.debugStyles.getSnapshot().find(entry => entry.id === id)?.actual;
          if (actual !== style) throw Error(`Style fallback: ${id}/${style} -> ${actual}`);
          if (sources.some(([object, material]) => object.material !== material)) throw Error('Source material not restored');
          styles.push({ style, actual, coloredPixels: p.validPixels(canvas) });
        }
        p.debugStyles.select(id, 'toon-soft'); instance.update(0);
        active = false; instance.update(1 / 30); active = true; instance.update(0);
        if (callbacks.length) throw Error(`Rendering advanced restored progress: ${id}`);
        p.finish = () => {
          instance.dispose(); p.current = null;
          if ([...disposed.values()].some(count => count !== 1)) throw Error(`Craft material disposal mismatch: ${id}`);
          return { sourceMaterialsDisposedOnce: disposed.size, registrationRemoved: !p.debugStyles.getSnapshot().some(entry => entry.id === id) };
        };
        return { id, progress, lighting, presentation: lighting === 'night' ? 'object-authored-night-rig' : 'scene-day-environment', width: canvas.width, styles, craftMaterials: craftMaterials.size, pauseResume: true };
      }, { id, progress, lighting });
      if (progress === 1) await page.locator('canvas').screenshot({ path: path.join(out, `${id}-${width}${lighting === 'night' ? '-night' : ''}.png`) });
      Object.assign(result, await page.evaluate(() => window.craftProbe.finish()));
      if (!result.registrationRemoved) throw Error('Scene style registration leaked');
      results.push(result);
    }
    console.log(`SCENES ${width}px: ${results.length} states checked`);
  }

  const tiles = [];
  for (const [row, id] of ids.entries()) for (const [column, version] of ['before', 'after'].entries()) {
    const file = version === 'before' ? path.join(root, 'artifacts/material-assessment/before', `${id}.png`) : path.join(out, `${id}-640.png`);
    if (!existsSync(file)) continue;
    const input = await sharp(file).resize(360, 360).extend({ bottom: 30, background: '#e8dfcc' }).composite([{ input: Buffer.from(`<svg width="360" height="30"><text x="8" y="20" font-size="12">${version}: ${id}</text></svg>`), left: 0, top: 360 }]).png().toBuffer();
    tiles.push({ input, left: column * 360, top: row * 390 });
  }
  await sharp({ create: { width: 720, height: 1560, channels: 3, background: '#e8dfcc' } }).composite(tiles).png().toFile(path.join(out, 'before-after.png'));
  const sources = await captureSources();
  if (JSON.stringify(sources) !== JSON.stringify(sourceSnapshot)) throw Error('Sources changed during verification; rerun against one stable source snapshot');
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ browser: await browser.version(), profiles, results, errors, sources,
    limitations: 'Current scene modules in an isolated host. 320/390/640 CSS px at DPR 1; desktop Chromium SwiftShader, not iPhone/WebView FPS or GPU timing. Actual authored night rigs use object presentation to avoid the shared day environment; dim spheres are separate synthetic probes. Baseline screenshots predate this implementation.' }, null, 2));
  if (errors.length) throw Error(`${errors.length} browser errors; see report.json`);
  console.log(JSON.stringify({ profiles: profiles.length, profileRenders: profiles.reduce((n, p) => n + p.styles.length, 0), sceneStates: results.length, sceneRenders: results.reduce((n, p) => n + p.styles.length, 0), errors: errors.length }));
} finally { await browser.close(); }
