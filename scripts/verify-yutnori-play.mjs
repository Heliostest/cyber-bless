import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { scenePointer } from './browser-scene-pointer.mjs';

const base = process.env.WBR_URL || 'http://127.0.0.1:5173';
const key = 'cyber-bless:personal:v1', out = 'artifacts/yutnori-play';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const cases = [[390, false, [8, 0, 15, 7, 3, 0]], [320, true, [0, 15]], [1280, false, [7, 3]]];
  for (const [width, touch, masks] of cases) {
    if (process.env.WBR_WIDTHS && !process.env.WBR_WIDTHS.split(',').includes(String(width))) continue;
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: touch, isMobile: touch });
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(key => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: false, haptics: false, reducedMotion: false } }));
    }, key);
    await page.goto(base);
    const open = async () => {
      await page.getByRole('button', { name: '我的', exact: true }).click();
      await page.getByRole('button', { name: '场景目录', exact: true }).click();
      await page.locator('.scene-card[data-scene="korean-yutnori"]').click();
      await page.locator('.library-scene-stage[data-ready="true"]').waitFor();
    };
    await open();
    const pointer = await scenePointer(page, touch);
    const record = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).sceneRecords.find(entry => entry.id === 'korean-yutnori'), key);
    const waitPhase = async phase => {
      await page.waitForFunction(({ key, phase }) => JSON.parse(localStorage.getItem(key)).sceneRecords.find(entry => entry.id === 'korean-yutnori')?.variant?.endsWith(`-${phase}`), { key, phase }, { timeout: 20000 });
      await page.locator('.scene-bow-tap:enabled').waitFor();
    };
    const drag = async (dx, dy) => {
      await page.locator('canvas').scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const [x, y] = await page.locator('[data-cue-role="source"]').evaluate(el => {
        const rect = el.parentElement.getBoundingClientRect();
        return [rect.left + Number(el.dataset.x), rect.top + Number(el.dataset.y)];
      });
      await pointer.down([x, y]); await pointer.move([x + dx, y + dy], 12); await pointer.up();
    };
    console.log(`${width}px: gather`);
    if (width === 1280) await page.locator('.scene-bow-tap').press('Enter'); else await drag(60, 0);
    await waitPhase('throw');
    let position = 0;
    for (let round = 0; round < masks.length; round++) {
      const mask = masks[round], flats = mask.toString(2).replaceAll('0', '').length, steps = flats || 5;
      await page.evaluate(mask => { window.originalYutRandom = Math.random; Math.random = () => mask / 16; }, mask);
      if (width === 1280) await page.locator('.scene-bow-tap').press('Enter'); else await drag(0, -60);
      await waitPhase('move');
      await page.evaluate(() => { Math.random = window.originalYutRandom; });
      assert.ok((await record()).variant.includes(`-${mask}-${round + 1}-move`));
      assert.ok((await page.locator('.scene-hint').textContent()).includes(`${steps} 格`));
      if (width === 390 && round === 1) {
        const pending = (await record()).variant;
        await page.reload(); await open();
        assert.equal((await record()).variant, pending, 'Reload preserves the pending random outcome');
        assert.ok((await page.locator('.scene-hint').textContent()).includes('5 格'));
      }
      if (width === 1280) await page.locator('.scene-bow-tap').press('Space'); else await drag(0, -60);
      await waitPhase('again');
      position = (position + steps) % 20;
      assert.equal((await record()).variant, `yut1-${position}-${mask}-${round + 1}-again`);
      assert.equal((await record()).progress, 2);
      assert.equal(await page.locator('.scene-done-row').count(), 0);
      assert.ok(await page.locator('.scene-yut-finish').isVisible());
      if (width === 390 && round === 0) {
        const settled = (await record()).variant;
        await page.getByRole('button', { name: '返回', exact: true }).click();
        await page.locator('.scene-card[data-scene="korean-yutnori"]').click();
        await page.locator('.library-scene-stage[data-ready="true"]').waitFor();
        assert.equal((await record()).variant, settled, 'Returning preserves the settled location');
      }
      console.log(`${width}px: round ${round + 1}, ${steps} spaces, position ${position}`);
    }
    await page.locator('.scene-yut-finish').scrollIntoViewIfNeeded();
    const boxes = await Promise.all([page.locator('.scene-yut-finish').boundingBox(), page.locator('.scene-bow-tap').boundingBox(), page.locator('.scene-step-dots').boundingBox()]);
    assert.ok(boxes[2].x + boxes[2].width <= boxes[0].x && boxes[0].x + boxes[0].width <= boxes[1].x);
    await page.screenshot({ path: `${out}/rounds-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: '结束行棋', exact: true }).click();
    assert.equal((await record()).progress, 3);
    await page.locator('[data-cue-role="source"]').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-cue-role="source"]').count(), 0);
    assert.equal(await page.locator('.scene-completion-actions button').count(), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/finished-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    results.push({ width, touch, throws: masks.length, position, errors });
    await page.close();
  }
  await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
