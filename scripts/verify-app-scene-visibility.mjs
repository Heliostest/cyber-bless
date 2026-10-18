import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { APP_HIDDEN_SCENE_IDS, builtInScenes, isSceneVisibleInApp } from '../packages/core/src/daily-scenes.ts';

const base = process.env.WBR_URL || 'http://127.0.0.1:5173';
const out = 'artifacts/blessing-audit';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = [];page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('cyber-bless:personal:v1', JSON.stringify({ version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: false, haptics: false, reducedMotion: true } }));
  });
  await page.goto(base);
  await page.getByRole('button', { name: '我的', exact: true }).click();
  await page.getByRole('button', { name: '场景目录', exact: true }).click();
  const more = page.getByRole('button', { name: '显示更多', exact: true });
  while (await more.count()) await more.click();
  assert.equal(await page.locator('.scene-card[data-scene="chinese-suanpan"]').count(), 0);
  const visibleCount = await page.locator('.scene-card').count();
  assert.equal(visibleCount, 35);
  assert.deepEqual((await page.locator('.scene-card').evaluateAll(nodes => nodes.map(el => el.dataset.scene))).sort(), builtInScenes.filter(isSceneVisibleInApp).map(e => e.id).sort());
  for (const id of APP_HIDDEN_SCENE_IDS) {
    await page.getByRole('searchbox', { name: '搜索场景' }).fill(builtInScenes.find(e => e.id === id).title);
    assert.equal(await page.locator('.scene-card').count(), 0, `${id} is hidden from App search`);
  }
  await page.getByRole('searchbox', { name: '搜索场景' }).fill('拨珠见数');
  assert.equal(await page.locator('.scene-card').count(), 0);
  await page.getByRole('status').filter({ hasText: '没有找到相符的场景' }).waitFor();
  await page.screenshot({ path: `${out}/abacus-hidden-390.png`, fullPage: true });
  await page.getByRole('searchbox', { name: '搜索场景' }).fill('鲤旗迎风');
  await page.locator('.scene-card[data-scene="japanese-koinobori"]').click();
  await page.locator('.library-scene-stage[data-ready="true"]').waitFor();
  await page.goto(`${base}/scene-review?scene=chinese-suanpan`);
  await page.locator('.library-scene-stage[data-scene="chinese-suanpan"][data-ready="true"]').waitFor();
  assert.equal(await page.locator('select[aria-label="跳转场景"] option[value="chinese-suanpan"]').count(), 1);
  await page.screenshot({ path: `${out}/abacus-source-review-390.png`, fullPage: true });
  assert.deepEqual(errors, []);
  const report = { visibleCount, hiddenCount: APP_HIDDEN_SCENE_IDS.length, allHiddenFromSearch: true, sourceReviewRetained: true, errors };
  await writeFile(`${out}/visibility-browser.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
