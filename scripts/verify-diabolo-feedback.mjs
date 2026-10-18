import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { scenePointer } from './browser-scene-pointer.mjs';

const base = process.env.WBR_URL || 'http://127.0.0.1:5173';
const out = 'artifacts/diabolo-feedback';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const cases = [[390, false], [320, true], [1280, false]];
  for (const [width, touch] of cases.filter(([width]) => !process.env.WBR_WIDTHS || process.env.WBR_WIDTHS.split(',').includes(String(width)))) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: touch, isMobile: touch });
    page.setDefaultTimeout(10000);
    console.log(`Checking diabolo at ${width}px, touch=${touch}`);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.reviewHaptics = [];
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: duration => {
        window.reviewHaptics.push(duration); return true;
      } });
    });
    await page.goto(`${base}/scene-review?scene=chinese-diabolo`);
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor();
    const pointer = await scenePointer(page, touch);
    const progress = async n => {
      try {
        await page.waitForFunction(n => document.querySelector('.scene-progress')?.textContent?.replace(/\s/g, '') === `已完成${n}/3`, n, { timeout: 10000 });
      } catch (error) {
        await page.screenshot({ path: `${out}/failed-${width}.png`, fullPage: true });
        console.error(await page.locator('.scene-progress').textContent());
        throw error;
      }
    };
    const drag = async label => {
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const guide = page.locator('.scene-cue-guide:not([hidden])').filter({ hasText: label });
      await guide.waitFor();
      const index = await guide.evaluate(el => [...el.parentElement.children].indexOf(el));
      const source = page.locator('[data-cue-role="source"]:not([hidden])').nth(index);
      await source.waitFor();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const from = await source.evaluate(el => {
        const rect = el.parentElement.getBoundingClientRect();
        return [rect.left + Number(el.dataset.x), rect.top + Number(el.dataset.y)];
      });
      console.log(`${width}px ${label}: ${JSON.stringify({ index, from })}`);
      const delta = label.includes('向上') ? [0, -70] : label.includes('向左') ? [-70, 0] : [0, 70];
      await pointer.down(from); await pointer.move([from[0] + delta[0], from[1] + delta[1]], 12); await pointer.up();
    };
    await drag('向上提杆起转'); await progress(1);
    console.log(`${width}px: spinning`);
    await drag('向左展绳抛接'); await progress(2);
    console.log(`${width}px: first catch`);
    for (let n = 0; n < 2; n++) {
      await drag('向左展绳抛接');
      await page.locator('.scene-diabolo-repeat:enabled').waitFor();
      await progress(2);
      assert.equal(await page.locator('.scene-done-row').count(), 0);
    }
    await page.locator('.scene-diabolo-repeat').focus();
    await page.keyboard.press('Enter');
    await page.locator('.scene-diabolo-repeat:enabled').waitFor();
    await progress(2);
    const haptics = await page.evaluate(() => window.reviewHaptics);
    assert.ok(haptics.includes(12) && haptics.includes(24));
    assert.equal(haptics.filter(ms => ms === 40).length, 4, 'Each catch produces one heavy impact');
    await page.screenshot({ path: `${out}/repeat-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: '震动', exact: true }).click();
    const count = await page.evaluate(() => window.reviewHaptics.length);
    await page.locator('.scene-diabolo-repeat').click();
    await page.locator('.scene-diabolo-repeat:enabled').waitFor();
    assert.equal(await page.evaluate(() => window.reviewHaptics.length), count, 'The live vibration toggle silences subsequent throws');
    await drag('向下收杆停转'); await progress(3);
    const row = page.locator('.scene-completion-actions');
    const done = row.getByRole('button', { name: '完成', exact: true });
    const favorite = row.getByRole('button', { name: '收藏', exact: true });
    await done.scrollIntoViewIfNeeded();
    const [left, right] = await Promise.all([done.boundingBox(), favorite.boundingBox()]);
    assert.equal(left.y, right.y); assert.equal(left.height, right.height);
    assert.ok(right.x >= left.x + left.width && right.x + right.width <= width);
    const colors = await row.locator('button').evaluateAll(buttons => buttons.map(button => getComputedStyle(button).backgroundImage));
    assert.notEqual(colors[0], colors[1]);
    await favorite.click(); assert.equal(await favorite.getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: `${out}/complete-${width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    results.push({ width, touch, catches: 5, heavyPulses: 4, completionRow: 'same height, same row, different colors', errors });
    await page.close();
  }
  await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
