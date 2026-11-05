import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const out = path.resolve('artifacts/toon-water');
const base = process.env.WBR_URL || 'http://127.0.0.1:5177';
const moduleUrl = file => '/@fs/' + path.resolve(file).replaceAll('\\', '/');
const waterIds = ['celtic-folk-spring', 'floating-lantern-loy-krathong', 'japanese-shishi-odoshi',
  'mochigase-nagashibina', 'slavic-wreath', 'theravada-water', 'udo-undama', 'zeniarai-coin-washing',
  'bai-indigo-cloth', 'clootie-well-rag', 'fgs-buddha-bathing', 'thai-songkran-elders',
  'tibetan-water-bowls', 'sri-lankan-bodhi-puja', 'hindu-coconut-offering'];
const report = { scenes: [], styles: [], checks: [], errors: [] };
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.WBR_BROWSER || 'msedge', headless: true,
  args: ['--enable-unsafe-swiftshader', '--no-proxy-server'] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, locale: 'zh-CN' });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  for (const id of [...waterIds, 'kagami-biraki-sake', 'turkish-ebru-paper', 'japanese-kendama']) {
    await page.goto(`${base}/scene-review?scene=${id}`, { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('canvas[data-water-surfaces]').first();
    await canvas.waitFor({ timeout: 60000 });
    await page.locator('[data-audio-console-toggle]').click();
    if (waterIds.includes(id)) await page.waitForFunction(() => Number(document.querySelector('canvas[data-water-surfaces]')?.dataset.waterSurfaces) > 0);
    const count = Number(await canvas.getAttribute('data-water-surfaces'));
    if (!waterIds.includes(id)) {
      assert.equal(count, 0, `${id} is excluded`);
      assert.equal(await page.locator('.water-debug-controls select').count(), 0);
      report.scenes.push({ id, surfaces: count, excluded: true }); continue;
    }
    assert.ok(count > 0, `${id} has registered water`);
    const selector = page.locator(`select[data-water-scene="${id}"]`);
    await selector.waitFor();
    const before = await page.evaluate(() => {
      window.waterCanvas = document.querySelector('canvas[data-water-surfaces]');
      return JSON.stringify(localStorage);
    });
    if (id === 'celtic-folk-spring') await page.screenshot({ path: path.join(out, 'pool-original.png') });
    await selector.selectOption('toon-water');
    await page.waitForFunction(() => document.querySelector('canvas[data-water-surfaces]')?.dataset.waterMethod === 'toon-water');
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => document.querySelector('canvas[data-water-surfaces]') === window.waterCanvas), true);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before, 'debug selection does not save progress or preferences');
    await page.locator('[data-audio-console-toggle]').click();
    assert.equal(await canvas.getAttribute('data-water-method'), 'toon-water', 'collapsing retains preview');
    if (['celtic-folk-spring', 'tibetan-water-bowls', 'floating-lantern-loy-krathong', 'zeniarai-coin-washing'].includes(id)) {
      await page.screenshot({ path: path.join(out, `${id}-toon.png`) });
    }
    await page.locator('[data-audio-console-toggle]').click();
    await page.locator('[data-water-reset]').click();
    assert.equal(await canvas.getAttribute('data-water-method'), 'original');
    report.scenes.push({ id, surfaces: count, switched: true, restored: true });
  }
  report.checks.push('15 actual scenes switch and restore through the developer console without remounting or saving; sake, ebru size and dry scenes are excluded');

  await page.goto(`${base}/scene-review?scene=celtic-folk-spring`);
  await page.locator('canvas[data-water-surfaces]').waitFor();
  await page.locator('[data-audio-console-toggle]').click();
  await page.locator('select[data-water-scene]').selectOption('toon-water');
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await page.locator('.audio-debug-console').boundingBox();
  assert.ok(panel.x >= 0 && panel.x + panel.width <= 390 && panel.y >= 0 && panel.y + panel.height <= 844);
  await page.screenshot({ path: path.join(out, 'mobile-console.png') });
  report.checks.push('mobile console remains within the viewport');

  // Exercise the real WebGL pipeline independently of App navigation and timing.
  const rendering = await page.evaluate(async urls => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { createWaterRendering } = await import(urls.water);
    const { createStylizedWater } = await import(urls.stylized);
    const { createRenderStyle } = await import(urls.style);
    const { visualStyleOptions } = await import(urls.options);
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(240, 240); renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 30);
    scene.background = new THREE.Color(0xc8e3e0); scene.fog = new THREE.Fog(0xc8e3e0, 5, 20);
    camera.position.set(0, 3, 3); camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2));
    const effect = createStylizedWater({ geometry: new THREE.CircleGeometry(1.5, 64), opacity: .7 });
    effect.surface.rotation.x = -Math.PI / 2; scene.add(effect.surface);
    const override = createWaterRendering(scene), style = createRenderStyle(renderer, scene, camera);
    const source = effect.surface.material, results = [];
    const read = () => {
      const pixels = new Uint8Array(240 * 240 * 4), gl = renderer.getContext();
      gl.readPixels(0, 0, 240, 240, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels;
    };
    const render = () => { const frame = override.apply('toon-water'); try { style.render(); } finally { frame.restore(); } };
    let shaderErrors = 0; renderer.debug.onShaderError = () => { shaderErrors++; };
    try {
      for (const option of visualStyleOptions) {
        style.setStyle(option.id); render(); const first = read();
        for (let i = 0; i < 10; i++) override.update(.1, { active: true, reducedMotion: false });
        render(); const second = read();
        let changed = 0, colored = 0;
        for (let i = 0; i < first.length; i += 4) {
          if (Math.abs(first[i] - second[i]) + Math.abs(first[i + 1] - second[i + 1]) + Math.abs(first[i + 2] - second[i + 2]) > 15) changed++;
          if (second[i + 2] > second[i] + 15) colored++;
        }
        results.push({ style: option.id, actual: style.getStyle(), changed, colored, restored: effect.surface.material === source });
      }
      const geometry = effect.surface.geometry; geometry.deleteAttribute('uv');
      style.setStyle('original'); render();
      const pixels = read();
      return { styles: results, shaderErrors, projectedPixels: pixels.reduce((sum, value) => sum + value, 0) };
    } finally { style.dispose(); override.dispose(); effect.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  }, { water: moduleUrl('packages/scene-runtime/src/water-rendering.ts'), stylized: moduleUrl('packages/scene-runtime/src/stylized-water.ts'),
    style: moduleUrl('packages/scene-runtime/src/render-style.ts'), options: moduleUrl('packages/core/src/visual-style.ts') });
  for (const row of rendering.styles) {
    assert.equal(row.actual, row.style, `${row.style} does not fall back`);
    assert.equal(row.restored, true); assert.ok(row.changed > 100, `${row.style} has visible animated flow`);
    assert.ok(row.colored > 100, `${row.style} renders blue water`);
  }
  assert.equal(rendering.shaderErrors, 0); assert.ok(rendering.projectedPixels > 0);
  report.styles = rendering.styles;
  report.checks.push('real WebGL renders animated toon water across every visual style and UV-less geometry without fallback; all source materials restored');
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
