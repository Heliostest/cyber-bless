import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { builtInScenes, isSceneVisibleInApp } from '../packages/core/src/daily-scenes.ts';

const root = process.cwd().replaceAll('\\', '/'), base = process.env.WBR_URL || 'http://127.0.0.1:5186';
const phase = process.argv.includes('--baseline') ? 'before' : 'after';
const width = Number(process.argv.find(arg => arg.startsWith('--width='))?.slice(8) || 390);
const selected = process.argv.filter(arg => arg.startsWith('--scene=')).map(arg => arg.slice(8));
const entries = builtInScenes.filter(isSceneVisibleInApp).filter(scene => scene.id !== 'woodfish' && (!selected.length || selected.includes(scene.id)));
const out = path.join(root, 'artifacts/material-rollout', phase, String(width));
await mkdir(out, { recursive: true });
const bundled = chromium.executablePath(), fallback = bundled.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
const browser = await chromium.launch({ headless: true, executablePath: existsSync(bundled) ? bundled : fallback,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width, height: width }, deviceScaleFactor: 1 });
const errors = [], results = [];
page.on('pageerror', error => errors.push({ id: currentId, message: error.message }));
page.on('console', message => { if (message.type() === 'error') errors.push({ id: currentId, message: message.text() }); });
let currentId = '';
const sourceHashes = async () => {
  const files = ['scripts/verify-craft-rollout-webgl.mjs', 'packages/core/src/daily-scenes.ts', 'packages/scenes/src/registry.ts',
    'packages/scene-runtime/src/craft-surfaces.ts', 'packages/scene-runtime/src/toon-surfaces.ts', 'packages/scene-runtime/src/gallery-surfaces.ts',
    ...entries.flatMap(entry => ['scene.ts', 'model.ts'].map(file => `packages/scenes/src/${entry.id}/${file}`)).filter(file => existsSync(file))];
  return Promise.all(files.map(async file => ({ file, sha256: createHash('sha256').update(await readFile(file)).digest('hex') })));
};
const sources = await sourceHashes();
await page.route('**/craft-rollout-verification', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>body{margin:0;background:#e8dfcc}#stage{position:relative;width:100vw;height:100vh}canvas{display:block;width:100%;height:100%}.overlay{display:none}.scene-object-cues{position:absolute;inset:0;pointer-events:none}</style></head><body><div id="stage"></div></body></html>' }));
try {
  await page.goto(`${base}/craft-rollout-verification`);
  await page.evaluate(async root => {
    window.process = { env: { EXPO_BASE_URL: '/' } };
    const file = value => `/@fs/${root}/${value}`;
    const styleURL = file('packages/scene-runtime/src/render-style.ts'), source = await (await fetch(styleURL)).text();
    const T = await import(source.match(/from\s+["']([^"']*three[^"']*)["']/)[1]);
    const { loadScene } = await import(file('packages/scenes/src/registry.ts'));
    const { debugStyles } = await import(file('packages/scene-runtime/src/debug-styles.ts'));
    const shared = await import(file('packages/shared/src/index.ts')), gestures = await import(file('packages/gestures/src/index.ts'));
    debugStyles.enable();
    const p = window.rolloutProbe = { T, loadScene, debugStyles, shared, gestures, scene: null, current: null };
    const before = T.Object3D.prototype.onBeforeRender;
    T.Object3D.prototype.onBeforeRender = function(renderer, scene, camera, ...rest) {
      if (camera.isPerspectiveCamera || (camera.isOrthographicCamera && camera.position.lengthSq() > 0)) p.scene = scene;
      return before.call(this, renderer, scene, camera, ...rest);
    };
  }, root);
  for (const entry of entries) {
    currentId = entry.id;
    const states = phase === 'before' || width === 320 ? [1] : [1, entry.id === 'tibetan-water-bowls' ? 9 : 3];
    for (const progress of states) {
      let result;
      try {
        result = await page.evaluate(async ({ id, progress, phase, width }) => {
          const p = window.rolloutProbe, stage = document.querySelector('#stage'); p.scene = null;
          stage.innerHTML = '<canvas></canvas><div class="overlay"></div><div class="scene-object-cues"></div>';
          const canvas = stage.querySelector('canvas'), overlay = stage.querySelector('.overlay'), mod = await p.loadScene(id);
          let active = true;
          const instance = p.current = mod.create({ canvas, overlay, shared: p.shared, gestures: p.gestures, sceneId: id,
            initialProgress: progress, isActive: () => active, isReducedMotion: () => true, isSoundEnabled: () => false,
            stage: 'day', deferWishWriting: true });
          instance.start(); instance.update(0);
          for (let attempt = 0; attempt < 120 && canvas.dataset.environment && canvas.dataset.environmentReady !== 'true'; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 50)); instance.update(0);
          }
          if (!p.scene) throw Error(`No real scene rendered: ${id}`);
          const originals = [], owned = new Map(), kinds = {}, optics = {};
          p.scene.traverse(object => {
            if (!object.isMesh) return;
            originals.push([object, object.material]);
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
              if (material.userData.craftSurface && !owned.has(material)) {
                owned.set(material, 0); const kind = material.userData.craftSurface.kind;
                kinds[kind] = (kinds[kind] || 0) + 1;
                material.addEventListener('dispose', () => owned.set(material, owned.get(material) + 1));
              }
              const optical = material.userData.ritualOptics?.kind;
              if (optical) optics[optical] = (optics[optical] || 0) + 1;
            }
          });
          const styles = [];
          for (const style of phase === 'before' || width === 320 ? ['toon-soft'] : ['original', 'toon-soft']) {
            p.debugStyles.select(id, style); instance.update(0); instance.update(0);
            const actual = p.debugStyles.getSnapshot().find(item => item.id === id)?.actual;
            if (actual !== style) throw Error(`Style fallback ${id}: ${style} -> ${actual}`);
            if (originals.some(([object, original]) => object.material !== original)) throw Error(`Source material not restored: ${id}`);
            const gl = canvas.getContext('webgl2'), pixels = new Uint8Array(canvas.width * canvas.height * 4);
            gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            let colored = 0;
            for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 8 && pixels[i] + pixels[i + 1] + pixels[i + 2] > 12) colored++;
            if (colored < 80) throw Error(`Empty/black frame: ${id}`);
            styles.push({ style, actual, colored });
          }
          active = false; instance.update(0); active = true; instance.update(0);
          p.finish = () => {
            instance.dispose(); p.current = null;
            const invalidDisposals = [...owned.values()].filter(count => count !== 1);
            if (invalidDisposals.length) throw Error(`Source craft disposal count: ${id}`);
            if (p.debugStyles.getSnapshot().some(item => item.id === id)) throw Error(`Style registration leak: ${id}`);
            return { craftMaterialsDisposedOnce: owned.size };
          };
          return { id, progress, width, kinds, optics, styles };
        }, { id: entry.id, progress, phase, width });
        if (progress === 1) await page.locator('canvas').screenshot({ path: path.join(out, `${entry.id}.png`) });
        Object.assign(result, await page.evaluate(() => window.rolloutProbe.finish()));
      } catch (error) {
        result = { id: entry.id, progress, error: String(error.stack || error) };
        await page.evaluate(() => { try { window.rolloutProbe.current?.dispose(); } catch {} window.rolloutProbe.current = null; });
      }
      results.push(result);
      await writeFile(path.join(out, 'report.json'), JSON.stringify({ phase, width, results, errors, sources }, null, 2));
      console.log(`${phase} ${entry.id}/${progress}: ${result.error ? result.error.slice(0, 180) : JSON.stringify(result.kinds)}`);
    }
  }
  if (JSON.stringify(sources) !== JSON.stringify(await sourceHashes())) throw Error('Source changed during capture; rerun stable source');
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ phase, width, browser: await browser.version(), results, errors, sources,
    limitations: 'Actual modules in isolated host; reduced motion freezes scene time. Desktop Chromium SwiftShader, not phone GPU performance. Woodfish host is checked separately.' }, null, 2));
  const failures = results.filter(result => result.error);
  console.log(JSON.stringify({ phase, width, scenes: entries.length, states: results.length, failures: failures.length, errors: errors.length }));
  if (failures.length || errors.length) process.exitCode = 1;
} finally { await browser.close(); }
