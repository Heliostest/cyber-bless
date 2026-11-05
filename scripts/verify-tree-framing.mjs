import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.WBR_URL || 'http://127.0.0.1:5190';
const out = path.resolve('artifacts/tree-framing');
await mkdir(out, { recursive: true });
const executablePath = [process.env.WBR_CHROME, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && existsSync(file));
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--no-proxy-server'] });
const report = { cases: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, locale: 'zh-CN' });
  page.on('pageerror', error => report.errors.push(error.message));
  for (const id of ['shinto-torii', 'japanese-wagasa', 'chinese-diabolo', 'german-nutcracker', 'diya-oil-lamp']) {
    await page.goto(`${base}/scene-review?scene=${id}`, { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('canvas[data-tree-method]').first();
    await canvas.waitFor({ timeout: 60000 });
    await page.evaluate(async url => {
      const source = await (await fetch(url)).text();
      const THREE = await import(source.match(/from\s+["']([^"']*three[^"']*)["']/)[1]);
      window.treeFramingThree = THREE;
      const prototype = THREE.InstancedMesh.prototype, before = prototype.onBeforeRender;
      prototype.onBeforeRender = function (...args) {
        if (this.userData.importedTreeFoliage && args[2].isPerspectiveCamera) window.treeFramingView = { scene: args[1], camera: args[2] };
        return before.apply(this, args);
      };
    }, '/@fs/' + path.resolve('packages/scene-runtime/src/imported-trees.ts').replaceAll('\\', '/'));
    await page.locator('[data-audio-console-toggle]').click();
    const select = page.locator(`select[data-tree-scene="${id}"]`);
    const methods = id === 'shinto-torii' || id === 'diya-oil-lamp' ? ['cherry', 'willow', 'cypress', 'conifer'] : ['scene'];
    for (const method of methods) {
      await select.selectOption(method);
      await page.waitForFunction(method => document.querySelector('canvas[data-tree-method]')?.dataset.treeMethod === method && document.querySelector('canvas[data-tree-status]')?.dataset.treeStatus === 'ready', method);
      await page.locator('[data-audio-console-toggle]').click();
      await canvas.screenshot({ path: path.join(out, `${id}-${method}.png`) });
      await page.waitForFunction(() => window.treeFramingView?.scene.getObjectByName('alternative-environment-trees')?.children.length > 0);
      const framing = await page.evaluate(() => {
        const THREE = window.treeFramingThree, { scene, camera } = window.treeFramingView;
        const root = scene.getObjectByName('alternative-environment-trees');
        const point = new THREE.Vector3(), matrix = new THREE.Matrix4();
        let central = 0, visible = 0, top = 0, wood = 0;
        root.traverse(mesh => {
          if (!mesh.isInstancedMesh) return;
          mesh.getMatrixAt(0, matrix); matrix.premultiply(mesh.matrixWorld);
          const vertices = mesh.geometry.getAttribute('position');
          for (let index = 0; index < vertices.count; index++) {
            point.fromBufferAttribute(vertices, index).applyMatrix4(matrix).applyMatrix4(camera.matrixWorldInverse);
            if (point.z >= -camera.near || point.z <= -camera.far) continue;
            point.applyMatrix4(camera.projectionMatrix);
            if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
            visible++;
            if (point.y > .35) top++;
            if (!mesh.userData.importedTreeFoliage) wood++;
            if (point.y < .33 && Math.abs(point.x) < .50) central++;
          }
        });
        return { central, visible, top, wood };
      });
      assert.equal(framing.central, 0, `${id}/${method}: foreground leaves/wood keep the central work area clear`);
      assert.ok(framing.visible > 0, `${id}/${method}: near trees enter the picture`);
      report.cases.push({ id, method, viewport: 'desktop', framing });
      await page.locator('[data-audio-console-toggle]').click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-audio-console-toggle]').click();
    await canvas.screenshot({ path: path.join(out, `${id}-mobile.png`) });
    report.cases.push({ id, viewport: 'mobile' });
    await page.setViewportSize({ width: 1100, height: 900 });
  }
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(report));
