import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { builtInScenes, isSceneVisibleInApp } from '../packages/core/src/daily-scenes.ts';

const out = process.argv[2] || 'artifacts/toon-cloud/layers';
const requested = new Set((process.argv[3] || '').split(',').filter(Boolean));
const entries = builtInScenes.filter(e => isSceneVisibleInApp(e) && (!requested.size || requested.has(e.id)));
const preserved = new Set(['brat-bride-cloth','scottish-first-footing','diya-oil-lamp','votive-candle-catholic','yeondeunghoe','udo-undama']);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', deviceScaleFactor: 1 });
const errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => localStorage.setItem('cyber-bless:personal:v1', JSON.stringify({
  version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [],
  settings: { sound: false, haptics: false, reducedMotion: true },
})));
// Freeze the inspected shader and ignore dev HMR while a complete audit runs.
await page.routeWebSocket('**/*', () => {});
let frozenCloudSource;
await page.route('**/toon-cloud-backdrop.ts*', async route => {
  const response = await route.fetch();
  frozenCloudSource ??= (await response.text())
    .replace('root.name = "toon-cloud-backdrop";', 'root.name = "toon-cloud-backdrop"; globalThis.__cloudAudit = root;')
    .replace('layer.onBeforeRender = fit;', 'layer.onBeforeRender = (renderer, scene, camera) => { globalThis.__cloudRenderContext = { renderer, scene, camera }; fit(renderer); };');
  await route.fulfill({ response, body: frozenCloudSource });
});
try {
  await page.goto(process.env.WBR_URL || 'http://127.0.0.1:5177/');
  await page.getByRole('button', { name: '我的', exact: true }).click();
  await page.getByRole('button', { name: '场景目录', exact: true }).click();
  for (const entry of entries) {
    await page.evaluate(() => { globalThis.__cloudAudit = null; globalThis.__cloudRenderContext = null; });
    await page.getByRole('searchbox', { name: '搜索场景' }).fill(entry.title);
    await page.locator(`.scene-card[data-scene="${entry.id}"]`).click();
    await page.locator('canvas[data-environment-ready="true"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(100);
    const kind = await page.locator('canvas[data-environment-ready="true"]').getAttribute('data-environment');
    await page.locator('.library-scene-stage').first().screenshot({ path: `${out}/${entry.id}.png`, animations: 'disabled' });
    const measured = await page.evaluate(async () => {
      const root = globalThis.__cloudAudit, context = globalThis.__cloudRenderContext;
      if (!root?.parent || !context) return null;
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const { renderer, scene, camera } = context, size = renderer.getSize(new THREE.Vector2());
      const width = Math.round(size.x), height = Math.round(size.y);
      const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
      target.texture.colorSpace = THREE.LinearSRGBColorSpace;
      const old = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear,
        toneMapping: renderer.toneMapping, outputColorSpace: renderer.outputColorSpace,
        background: scene.background, shadowAuto: renderer.shadowMap.autoUpdate,
        clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() };
      const layers = root.children, originals = layers.map(layer => layer.material);
      const probeMaterials = originals.map(material => {
        const probe = material.clone();
        // Remove only the old whitening mix: probe RGB now measures alpha
        // contribution, rather than conflating contribution with the palette.
        probe.fragmentShader = probe.fragmentShader.replace('mix(uColor,vec3(1.0),J*0.84)', 'uColor');
        probe.uniforms.uColor.value.setRGB(0, 0, 0);
        return probe;
      });
      let released = 0;
      const resources = new Set();
      for (const layer of layers) { resources.add(layer.geometry); resources.add(layer.material); }
      for (const resource of resources) resource.addEventListener('dispose', () => released++);
      globalThis.__readCloudReleases = () => released;
      const read = () => {
        renderer.render(scene, camera);
        const pixels = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
        return pixels;
      };
      try {
        renderer.autoClear = true; renderer.toneMapping = THREE.NoToneMapping;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        renderer.shadowMap.autoUpdate = false;
        renderer.setRenderTarget(target);
        const actual = read();
        scene.background = new THREE.Color(0); renderer.setClearColor(0, 0);
        layers.forEach((layer, i) => { layer.material = probeMaterials[i]; });
        const black = read(), best = new Uint8Array(width * height), winner = new Int8Array(width * height).fill(-1);
        for (let layer = 0; layer < layers.length; layer++) {
          probeMaterials[layer].uniforms.uColor.value.setRGB(1, 1, 1);
          const white = read();
          probeMaterials[layer].uniforms.uColor.value.setRGB(0, 0, 0);
          for (let p = 0; p < best.length; p++) {
            const offset = p * 4;
            const weight = Math.max(white[offset] - black[offset], white[offset + 1] - black[offset + 1], white[offset + 2] - black[offset + 2]);
            if (weight > best[p]) { best[p] = weight; winner[p] = layer; }
          }
        }
        const counts = Array(6).fill(0), minY = Array(6).fill(height), maxY = Array(6).fill(-1);
        const lum = Array(6).fill(0), lumSamples = Array(6).fill(0);
        let cloudPixels = 0;
        for (let p = 0; p < best.length; p++) {
          if (best[p] < 20 || winner[p] < 0) continue;
          const layer = winner[p], y = height - 1 - Math.floor(p / width);
          cloudPixels++; counts[layer]++; minY[layer] = Math.min(minY[layer], y); maxY[layer] = Math.max(maxY[layer], y);
          if (best[p] >= 128) {
            const at = p * 4;
            lum[layer] += (.2126 * actual[at] + .7152 * actual[at + 1] + .0722 * actual[at + 2]) / 255;
            lumSamples[layer]++;
          }
        }
        const significant = counts.map((count, i) => count >= Math.max(24, cloudPixels * .01) && maxY[i] - minY[i] >= 3);
        return { width, height, cloudPixels, cloudFraction: cloudPixels / (width * height),
          dominantAreas: counts, visibleLayers: significant.filter(Boolean).length,
          significant, topRows: minY, bottomRows: maxY,
          layerLuminance: lum.map((value, i) => lumSamples[i] ? value / lumSamples[i] : null) };
      } finally {
        layers.forEach((layer, i) => { layer.material = originals[i]; });
        probeMaterials.forEach(material => material.dispose()); target.dispose();
        scene.background = old.background; renderer.shadowMap.autoUpdate = old.shadowAuto;
        renderer.autoClear = old.autoClear; renderer.toneMapping = old.toneMapping; renderer.outputColorSpace = old.outputColorSpace;
        renderer.setClearColor(old.clear, old.alpha); renderer.setRenderTarget(old.target);
      }
    });
    assert.equal(!!measured, !preserved.has(entry.id), `${entry.id}: eligibility`);
    await page.getByRole('button', { name: '返回', exact: true }).click();
    const released = measured ? await page.evaluate(() => globalThis.__readCloudReleases()) : 0;
    if (measured) assert.equal(released, 7, `${entry.id}: resource cleanup`);
    results.push({ id: entry.id, title: entry.title, kind, measured, released });
    console.log(JSON.stringify({ checked: results.length, total: entries.length, id: entry.id,
      layers: measured?.visibleLayers ?? null, cloudPixels: measured?.cloudPixels ?? 0 }));
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
