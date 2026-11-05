import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const base = process.env.WBR_URL || 'http://127.0.0.1:5189';
const out = path.resolve('artifacts/tree-debug');
await mkdir(out, { recursive: true });
const report = { scenes: [], errors: [], external: [] };
const executablePath = [process.env.WBR_CHROME, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && existsSync(file));
const browser = await chromium.launch({ executablePath, headless: true,
  args: ['--enable-unsafe-swiftshader', '--no-proxy-server'] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, locale: 'zh-CN' });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('request', request => {
    if (!request.url().startsWith(new URL(base).origin) && !/^(?:data:|blob:)/.test(request.url())) report.external.push(request.url());
  });
  for (const id of ['shinto-torii', 'diya-oil-lamp']) {
    await page.goto(`${base}/scene-review?scene=${id}`, { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('canvas[data-tree-method]').first();
    await canvas.waitFor({ timeout: 60000 });
    await page.locator('canvas[data-environment-ready="true"]').waitFor();
    await page.locator('[data-audio-console-toggle]').click();
    const select = page.locator(`select[data-tree-scene="${id}"]`); await select.waitFor();
    const state = await page.evaluate(() => {
      window.treeCanvas = document.querySelector('canvas[data-tree-method]');
      return JSON.stringify(localStorage);
    });
    const options = await select.locator('option').evaluateAll(nodes => nodes.map(node => node.value));
    assert.deepEqual(options, ['original', 'scene', 'quaternius', 'simple-tree', 'cherry', 'cypress', 'willow', 'conifer']);
    await select.selectOption('original');
    await page.screenshot({ path: path.join(out, `${id}-original.png`) });
    for (const method of ['quaternius', 'simple-tree', 'cherry', 'cypress', 'willow', 'conifer']) {
      await select.selectOption(method);
      await page.waitForFunction(method => {
        const canvas = document.querySelector('canvas[data-tree-method]');
        return canvas?.dataset.treeMethod === method && canvas.dataset.treeStatus === 'ready';
      }, method, { timeout: 30000 });
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.querySelector('canvas[data-tree-method]') === window.treeCanvas), true);
      assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), state);
      await page.locator('[data-audio-console-toggle]').click();
      await page.screenshot({ path: path.join(out, `${id}-${method}.png`) });
      assert.equal(await canvas.getAttribute('data-tree-method'), method);
      await page.locator('[data-audio-console-toggle]').click();
    }
    await select.selectOption('quaternius'); await select.selectOption('simple-tree'); await select.selectOption('original');
    await page.waitForTimeout(250);
    assert.equal(await canvas.getAttribute('data-tree-method'), 'original');
    await select.selectOption('quaternius');
    await page.waitForFunction(() => document.querySelector('canvas[data-tree-method]')?.dataset.treeMethod === 'quaternius');
    await page.locator('[data-tree-reset]').click(); assert.equal(await canvas.getAttribute('data-tree-method'), id === 'shinto-torii' ? 'scene' : 'original');
    await page.setViewportSize({ width: 390, height: 844 });
    const panel = await page.locator('.audio-debug-console').boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= 390 && panel.y >= 0 && panel.y + panel.height <= 844);
    await page.screenshot({ path: path.join(out, `${id}-mobile-console.png`) });
    await page.setViewportSize({ width: 1100, height: 900 });
    report.scenes.push({ id, methods: options, sameCanvas: true, noStorageWrites: true, rapidSwitch: true, restored: true });
  }
  await page.goto(`${base}/scene-review?scene=udo-undama`);
  await page.locator('canvas').waitFor(); await page.locator('[data-audio-console-toggle]').click();
  assert.equal(await page.locator('select[data-tree-scene]').count(), 0, 'coastal environment has no switchable background trees');
  report.scenes.push({ id: 'udo-undama', excluded: true });
  report.recommendations = [];
  const recommendations = {
    'japanese-wagasa': '樱花', 'ema-votive-plaque': '樱花', 'shrine-suzu-bell': '樱花', 'omikuji': '樱花', 'shinto-torii': '樱花',
    'german-nutcracker': '层叠针叶', 'chinese-diabolo': '垂柳', 'neapolitan-cornicello': '柱形柏', 'valencian-folding-fan': '柱形柏',
    'japanese-kadomatsu': '保留原景',
  };
  for (const [id, expected] of Object.entries(recommendations)) {
    await page.goto(`${base}/scene-review?scene=${id}`, { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('canvas[data-tree-method]').first(); await canvas.waitFor({ timeout: 60000 });
    await page.locator('[data-audio-console-toggle]').click();
    const select = page.locator(`select[data-tree-scene="${id}"]`); await select.waitFor();
    assert.ok((await select.locator('option[value="scene"]').textContent()).includes(expected));
    await select.selectOption('scene');
    await page.waitForFunction(expectedMethod => {
      const canvas = document.querySelector('canvas[data-tree-method]');
      return canvas?.dataset.treeStatus === 'ready' && canvas.dataset.treeMethod === expectedMethod;
    }, expected === '保留原景' ? 'original' : 'scene', { timeout: 30000 });
    if (expected === '樱花') {
      assert.equal(await page.locator('[data-tree-attribution]').count(), 0);
      const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname));
      for (const variant of ['round', 'cluster']) assert.ok(loaded.includes(`/environments/trees/simple-tree/cherry-${variant}.glb`), `Simple Tree cherry ${variant} loaded`);
      assert.ok(!loaded.some(url => url.startsWith('/environments/trees/regional/')), 'external cherry archive is not requested');
    }
    if (id === 'shinto-torii') {
      await page.screenshot({ path: path.join(out, 'regional-cherry-console.png') });
      const isolation = await page.evaluate(async urls => {
        const source = await (await fetch(urls.trees)).text();
        const THREE = await import(source.match(/from\s+["']([^"']*three[^"']*)["']/)[1]);
        const { captureSceneImage } = await import(urls.capture);
        const prototype = THREE.InstancedMesh.prototype, previous = prototype.onBeforeRender;
        let previewDraws = 0, beforeEncode = -1;
        prototype.onBeforeRender = function (...args) { if (this.userData.importedTreeFoliage) previewDraws++; return previous.apply(this, args); };
        const canvas = document.querySelector('canvas[data-tree-method]'), encode = canvas.toDataURL;
        canvas.toDataURL = function (...args) { beforeEncode = previewDraws; return encode.apply(this, args); };
        try {
          const image = captureSceneImage(canvas);
          return { encoded: image?.startsWith('data:image/png;base64,'), beforeEncode, afterRestore: previewDraws, method: canvas.dataset.treeMethod };
        } finally { prototype.onBeforeRender = previous; canvas.toDataURL = encode; }
      }, Object.fromEntries(Object.entries({ trees: 'packages/scene-runtime/src/imported-trees.ts', capture: 'packages/scene-runtime/src/scene-capture.ts' })
        .map(([key, value]) => [key, '/@fs/' + path.resolve(value).replaceAll('\\', '/')])));
      assert.equal(isolation.encoded, true); assert.ok(isolation.beforeEncode > 0);
      assert.ok(isolation.afterRestore > 0); assert.equal(isolation.method, 'scene'); report.captureIsolation = isolation;
    }
    report.recommendations.push({ id, expected, actual: await canvas.getAttribute('data-tree-method') });
  }
  report.rendering = await page.evaluate(async urls => {
    const source = await (await fetch(urls.trees)).text();
    const THREE = await import(source.match(/from\s+["']([^"']*three[^"']*)["']/)[1]);
    const { createTreeRendering } = await import(urls.trees), { createRenderStyle } = await import(urls.style);
    const { visualStyleOptions } = await import(urls.options);
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(240, 240); renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 30);
    scene.background = new THREE.Color('#c1e3ec'); camera.position.set(0, 1.6, 4.6); camera.lookAt(0, 1.25, 0);
    scene.add(new THREE.HemisphereLight('#d8eeff', '#b9ad8b', .6));
    const sun = new THREE.DirectionalLight('#fff4e5', 3.8); sun.position.set(-6, 9, 5); scene.add(sun);
    const original = new THREE.Mesh(new THREE.BoxGeometry(.4, 2, .4), new THREE.MeshStandardMaterial({ color: '#63884a' }));
    original.position.y = 1; scene.add(original);
    const trees = createTreeRendering([original], [{ x: 0, z: 0, scale: 2.5, turn: 0, variant: 'round' }, { x: 2, z: -1, scale: 1.8, turn: .7, variant: 'cluster' }], 0);
    scene.add(trees.root);
    const style = createRenderStyle(renderer, scene, camera), styles = [];
    let shaderErrors = 0; renderer.debug.onShaderError = () => { shaderErrors++; };
    const memory = () => ({ ...renderer.info.memory });
    style.render(); const baseline = memory();
    try {
      for (const method of ['quaternius', 'simple-tree', 'cherry', 'cypress', 'willow', 'conifer']) {
        await trees.select(method);
        for (const option of visualStyleOptions) {
          style.setStyle(option.id); trees.update(2, true); style.render();
          const pixels = new Uint8Array(240 * 240 * 4), gl = renderer.getContext();
          gl.readPixels(0, 0, 240, 240, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let visible = 0; const background = [...pixels.slice(0, 3)];
          for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - background[0]) + Math.abs(pixels[i + 1] - background[1]) + Math.abs(pixels[i + 2] - background[2]) > 25) visible++;
          if (visible < 100) throw Error(`No visible tree: ${method}/${option.id}`);
          if (style.getStyle() !== option.id) throw Error(`Style fallback: ${method}/${option.id}`);
          styles.push({ method, style: option.id, visible });
        }
        style.setStyle('toon-soft'); await trees.select('original'); style.render();
      }
      const afterWarmup = memory(), repeated = [];
      for (let i = 0; i < 4; i++) {
        await trees.select(i % 2 ? 'simple-tree' : 'quaternius'); style.render();
        await trees.select('original'); style.render(); repeated.push(memory());
      }
      if (repeated.some(item => item.geometries !== afterWarmup.geometries || item.textures !== afterWarmup.textures)) throw Error('Tree GPU resources grew after restore');
      return { styles, shaderErrors, baseline, afterWarmup, repeated };
    } finally {
      trees.dispose(); style.dispose(); original.geometry.dispose(); original.material.dispose(); renderer.dispose(); renderer.forceContextLoss();
    }
  }, Object.fromEntries(Object.entries({ trees: 'packages/scene-runtime/src/imported-trees.ts', style: 'packages/scene-runtime/src/render-style.ts', options: 'packages/core/src/visual-style.ts' })
    .map(([key, value]) => [key, '/@fs/' + path.resolve(value).replaceAll('\\', '/')])));
  assert.equal(report.rendering.shaderErrors, 0);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []);
} finally {
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close();
}
console.log(JSON.stringify({ scenes: report.scenes, recommendations: report.recommendations,
  captureIsolation: report.captureIsolation, styleCases: report.rendering.styles.length,
  shaderErrors: report.rendering.shaderErrors, resources: report.rendering.repeated,
  errors: report.errors, external: report.external }));
