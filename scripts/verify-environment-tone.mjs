import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const base = process.env.WBR_URL || 'http://127.0.0.1:5194';
let server;
if (process.argv.includes('--serve')) {
  server = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', new URL(base).port, '--strictPort'],
    { cwd: path.resolve('apps/cyber-bless'), windowsHide: true, stdio: 'ignore' });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (server.exitCode !== null) throw Error(`Vite exited: ${server.exitCode}`);
      try { ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw Error('Vite did not become ready');
  } catch (error) { server.kill(); throw error; }
}
const out = path.resolve('artifacts/environment-tone');
await mkdir(out, { recursive: true });
const executablePath = [process.env.WBR_CHROME, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && existsSync(file));
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--no-proxy-server'] });
const report = { scenes: [], errors: [] };
const recommendations = { 'japanese-wagasa': 'cherry', 'ema-votive-plaque': 'cherry', 'shrine-suzu-bell': 'cherry', omikuji: 'cherry',
  'shinto-torii': 'cherry', 'german-nutcracker': 'conifer', 'chinese-diabolo': 'willow', 'neapolitan-cornicello': 'cypress', 'valencian-folding-fan': 'cypress' };
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  for (const id of ['woodfish', ...Object.keys(recommendations), 'diya-oil-lamp', 'udo-undama', 'japanese-kadomatsu']) {
    await page.goto(`${base}/scene-review?scene=${id}`, { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('canvas[data-environment-tone]').first();
    await canvas.waitFor({ timeout: 60000 });
    await page.locator('canvas[data-environment-ready="true"]').waitFor();
    const defaultTree = await page.evaluate(async ({ url, id }) => {
      const { getSceneTreeDefault } = await import(url); return getSceneTreeDefault(id);
    }, { url: '/@fs/' + path.resolve('packages/scene-runtime/src/tree-profiles.ts').replaceAll('\\', '/'), id });
    assert.equal(await canvas.getAttribute('data-environment-tone'), 'komorebi');
    if (id !== 'udo-undama') assert.equal(await canvas.getAttribute('data-tree-method'), defaultTree === 'original' ? 'original' : 'scene');
    await canvas.screenshot({ path: path.join(out, `${id}-default-scene.png`) });
    await page.evaluate(() => { window.toneCanvas = document.querySelector('canvas[data-environment-tone]'); });
    const saved = await page.evaluate(() => JSON.stringify(localStorage));
    await page.locator('[data-audio-console-toggle]').click();
    const select = page.locator('.environment-tone-controls select');
    await select.waitFor();
    assert.deepEqual(await select.locator('option').evaluateAll(nodes => nodes.map(node => node.value)), ['original', 'tiny-delivery', 'komorebi']);
    assert.equal(await select.inputValue(), 'komorebi');
    const treeSelect = page.locator(`select[data-tree-scene="${id}"]`);
    if (await treeSelect.count()) assert.equal(await treeSelect.inputValue(), 'scene');
    await select.selectOption('original');
    await page.locator('[data-audio-console-toggle]').click();
    await page.screenshot({ path: path.join(out, `${id}-original.png`) });
    await canvas.screenshot({ path: path.join(out, `${id}-original-scene.png`) });
    await page.locator('[data-audio-console-toggle]').click();
    await select.selectOption('tiny-delivery');
    await page.waitForFunction(() => document.querySelector('canvas[data-environment-tone]')?.dataset.environmentTone === 'tiny-delivery');
    if (id === 'shinto-torii') {
      // Both the original canopy and a tree loaded after selecting a palette must render.
      await page.locator(`select[data-tree-scene="${id}"]`).selectOption('cherry');
      await page.waitForFunction(() => document.querySelector('canvas[data-tree-status]')?.dataset.treeStatus === 'ready');
      await page.screenshot({ path: path.join(out, `${id}-delivery-cherry-console.png`) });
      await canvas.screenshot({ path: path.join(out, `${id}-delivery-cherry-scene.png`) });
      await select.selectOption('original');
      await canvas.screenshot({ path: path.join(out, `${id}-original-cherry-scene.png`) });
      await select.selectOption('tiny-delivery');
      await page.locator(`select[data-tree-scene="${id}"]`).selectOption('original');
      await select.selectOption('original');
      const isolation = await page.evaluate(async urls => {
        const source = await (await fetch(urls.trees)).text();
        const THREE = await import(source.match(/from\s+["']([^"']*three[^"']*)["']/)[1]);
        const { captureSceneImage } = await import(urls.capture);
        const proto = THREE.InstancedMesh.prototype, before = proto.onBeforeRender;
        let currentScene;
        proto.onBeforeRender = function(renderer, scene, ...args) {
          if (scene.getObjectByName('cozy-environment')) currentScene = scene;
          return before.call(this, renderer, scene, ...args);
        };
        const canvas = document.querySelector('canvas[data-environment-tone]'), encode = canvas.toDataURL;
        let during;
        canvas.toDataURL = function(...args) {
          during = { recommended: currentScene.getObjectByName('recommended-environment-trees').visible,
            background: currentScene.background.uuid };
          return encode.apply(this, args);
        };
        try {
          const image = captureSceneImage(canvas);
          return { encoded: image?.startsWith('data:image/png;base64,'), during,
            after: { recommended: currentScene.getObjectByName('recommended-environment-trees').visible,
              background: currentScene.background.uuid } };
        } finally { proto.onBeforeRender = before; canvas.toDataURL = encode; }
      }, Object.fromEntries(Object.entries({ trees: 'packages/scene-runtime/src/imported-trees.ts', capture: 'packages/scene-runtime/src/scene-capture.ts' })
        .map(([key, value]) => [key, '/@fs/' + path.resolve(value).replaceAll('\\', '/')])));
      assert.equal(isolation.encoded, true); assert.equal(isolation.during.recommended, true);
      assert.equal(isolation.after.recommended, false); assert.notEqual(isolation.during.background, isolation.after.background);
      report.captureDefaults = isolation;
      await select.selectOption('tiny-delivery');
      await treeSelect.selectOption('scene');
    }
    await page.locator('[data-audio-console-toggle]').click();
    assert.equal(await canvas.getAttribute('data-environment-tone'), 'tiny-delivery');
    await page.screenshot({ path: path.join(out, `${id}-delivery.png`) });
    await canvas.screenshot({ path: path.join(out, `${id}-delivery-scene.png`) });
    assert.equal(await page.evaluate(() => document.querySelector('canvas[data-environment-tone]') === window.toneCanvas), true);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), saved);
    await page.locator('[data-audio-console-toggle]').click();
    await select.selectOption('original');
    assert.equal(await canvas.getAttribute('data-environment-tone'), 'original');
    await select.selectOption('tiny-delivery');
    await page.setViewportSize({ width: 390, height: 844 });
    await select.scrollIntoViewIfNeeded();
    const panel = await page.locator('.audio-debug-console').boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= 390 && panel.y >= 0 && panel.y + panel.height <= 844);
    if (id === 'woodfish') await page.screenshot({ path: path.join(out, 'mobile-console.png') });
    await page.setViewportSize({ width: 1100, height: 900 });
    report.scenes.push({ id, regionalComparison: recommendations[id] ?? 'original', defaultTone: 'komorebi', defaultTrees: 'scene',
      sameCanvas: true, restored: true, collapsedChoiceRetained: true, noStorageWrites: true, mobilePanelFits: true });
  }
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  server?.kill();
}
console.log(JSON.stringify(report, null, 2));
