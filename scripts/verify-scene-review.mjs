import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.WBR_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/scene-review`);
  const navigation = page.getByRole('navigation', { name: '场景遍历' });
  await navigation.waitFor({ timeout: 5000 });
  const select = navigation.getByLabel('跳转场景');
  const ids = await select.locator('option').evaluateAll(options => options.map(option => option.value));
  assert.ok(ids.length >= 78, 'The review includes the complete scene catalog');
  const ready = async id => {
    await page.locator(`.scene-experience[aria-label]`).waitFor();
    await page.waitForFunction(id => {
      const stage = document.querySelector(`.library-scene-stage[data-scene="${id}"]`);
      return id === 'woodfish'
        ? document.querySelector('.woodfish-visual[data-renderer="ready"]')
        : stage?.dataset.ready === 'true' && stage.querySelector('canvas');
    }, id, { timeout: 30000 });
    assert.equal(await select.inputValue(), id);
    assert.equal(await page.locator('.scene-load-error').count(), 0);
  };
  await ready(ids[0]);
  assert.ok(await navigation.getByRole('button', { name: '上一个', exact: true }).isDisabled());
  await navigation.getByRole('button', { name: '下一个', exact: true }).click();
  await ready(ids[1]);
  await navigation.getByRole('button', { name: '最后一个', exact: true }).click();
  await ready(ids.at(-1));
  assert.ok(await navigation.getByRole('button', { name: '下一个', exact: true }).isDisabled());
  await page.reload();
  await ready(ids.at(-1));
  await navigation.getByRole('button', { name: '上一个', exact: true }).click();
  await ready(ids.at(-2));
  await select.selectOption('woodfish');
  await ready('woodfish');
  await navigation.getByRole('button', { name: '重新开始', exact: true }).click();
  await ready('woodfish');
  await navigation.getByRole('button', { name: '第一个', exact: true }).click();
  await ready(ids[0]);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile controls fit the screen');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ scenes: ids.length, first: ids[0], last: ids.at(-1), checks: 'previous/next, first/last, dropdown, reload, restart, woodfish, mobile', errors }));
} finally {
  await browser.close();
}
