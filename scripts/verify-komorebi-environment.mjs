import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.WBR_URL || 'http://127.0.0.1:5197';
const out = path.resolve(process.env.WBR_VISUAL_OUT || 'artifacts/komorebi-environment'); await mkdir(out, { recursive: true });
const executablePath = [process.env.WBR_CHROME, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && existsSync(file));
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--no-proxy-server'] });
const report = { scenes: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, locale: 'zh-CN', reducedMotion: 'reduce' });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  for (const id of (process.argv.includes('--quick') ? ['woodfish'] : ['woodfish','shinto-torii','celtic-folk-spring','diya-oil-lamp','floating-lantern-loy-krathong','udo-undama'])) {
    await page.goto(`${base}/scene-review?scene=${id}`, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: '.scene-review-header { position: static !important; }' });
    const canvas = page.locator('canvas[data-environment-ready="true"]').first(); await canvas.waitFor({ timeout: 90000 });
    await page.evaluate(async url => {
      const source = await (await fetch(url)).text();
      const THREE = await import(source.match(/from\s+["']([^"']*three[^"']*)["']/)[1]);
      window.kmThree = THREE;
      const before = THREE.InstancedMesh.prototype.onBeforeRender;
      THREE.InstancedMesh.prototype.onBeforeRender = function(renderer,scene,camera,...args) {
        if (scene.getObjectByName('cozy-environment')) window.kmView = {scene,camera,renderer};
        return before.call(this,renderer,scene,camera,...args);
      };
    }, '/@fs/' + path.resolve('packages/scene-runtime/src/imported-trees.ts').replaceAll('\\','/'));
    await page.evaluate(() => { window.kmCanvas = document.querySelector('canvas[data-environment]'); });
    const saved = await page.evaluate(() => JSON.stringify(localStorage));
    await canvas.screenshot({ path: path.join(out, `${id}-before.png`) });
    await page.locator('[data-audio-console-toggle]').click();
    const tone = page.locator('.environment-tone-controls select'), trees = page.locator(`select[data-tree-scene="${id}"]`);
    const grass = page.locator('.grass-debug-controls select');
    await tone.selectOption('komorebi');
    if (await grass.count()) await grass.selectOption('komorebi');
    if (await trees.count()) {
      await trees.selectOption('komorebi');
      await page.waitForFunction(() => document.querySelector('canvas[data-tree-method="komorebi"][data-tree-status="ready"]'), { timeout: 60000 });
    }
    await page.screenshot({ path: path.join(out, `${id}-console.png`) });
    await page.locator('[data-audio-console-toggle]').click();
    await canvas.screenshot({ path: path.join(out, `${id}-after.png`) });
    const actualStyle = await page.evaluate(async url => {
      const { debugStyles } = await import(url); return debugStyles.getSnapshot().map(entry=>({id:entry.id,actual:entry.actual}));
    }, '/@fs/' + path.resolve('packages/scene-runtime/src/debug-styles.ts').replaceAll('\\','/'));
    assert.equal(actualStyle.find(entry=>entry.id===id)?.actual,'toon-soft',`${id}: no silent shader fallback`);
    if (id==='woodfish') {
      for (const style of ['toon-ink','toon-outline','moebius','toon-soft']) {
        const actual=await page.evaluate(async ({url,id,style})=>{
          const {debugStyles}=await import(url);debugStyles.enable();debugStyles.select(id,style);
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          return debugStyles.getSnapshot().find(entry=>entry.id===id)?.actual;
        },{url:'/@fs/'+path.resolve('packages/scene-runtime/src/debug-styles.ts').replaceAll('\\','/'),id,style});
        assert.equal(actual,style,`${id}/${style}: no silent shader fallback`);
        await canvas.screenshot({path:path.join(out,`${id}-${style}.png`)});
      }
    }
    const materials = await page.evaluate(() => {
      const result = [];
      if (!window.kmView) return result;
      window.kmView.scene.traverseVisible(object => {
        if (!object.name.startsWith('komorebi-') || !object.isMesh) return;
        result.push({ name:object.name, color:object.material.color?.toArray(), pigment:object.material.userData.komorebiPigment,
          vertexColors:object.material.vertexColors, vertices:object.geometry.getAttribute('color')?.array.slice(0,9),
          materialName:object.material.name });
      }); return result;
    });
    assert.equal(await page.evaluate(() => window.kmCanvas === document.querySelector('canvas[data-environment]')), true);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), saved);
    assert.equal(await canvas.getAttribute('data-environment-tone'), 'komorebi');
    if (await grass.count()) assert.equal(await canvas.getAttribute('data-grass-method'), 'komorebi');
    await page.setViewportSize({ width: 390, height: 844 });
    await canvas.screenshot({ path: path.join(out, `${id}-mobile.png`) });
    await page.locator('[data-audio-console-toggle]').click();
    await tone.scrollIntoViewIfNeeded();
    const panel = await page.locator('.audio-debug-console').boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= 390 && panel.y >= 0 && panel.y + panel.height <= 844);
    if (id === 'woodfish') await page.screenshot({ path: path.join(out, 'mobile-console.png') });
    await tone.selectOption('tiny-delivery');
    if (await grass.count()) await grass.selectOption('original');
    if (await trees.count()) await trees.selectOption('scene');
    await page.waitForFunction(() => document.querySelector('canvas[data-tree-status]')?.dataset.treeStatus !== 'loading');
    await page.locator('[data-audio-console-toggle]').click();
    assert.equal(await canvas.getAttribute('data-environment-tone'), 'tiny-delivery');
    report.scenes.push({ id, sameCanvas: true, noStorageWrites: true, mobileFits: true, actualStyle, hasGrass: !!(await grass.count()), materials });
    await page.setViewportSize({ width: 1100, height: 900 });
  }
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log(JSON.stringify(report,null,2));
