import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { builtInScenes, isSceneVisibleInApp } from '../packages/core/src/daily-scenes.ts';

const ids = [
  'korean-bojagi-wrap', 'welsh-love-spoon', 'barcelos-clay-rooster', 'croatian-licitar-heart',
  'sorbian-painted-egg', 'lithuanian-straw-garden', 'aland-votive-ship', 'chinese-incense',
  'italian-ex-voto', 'omikuji', 'polish-blessing-basket', 'navruz-sumalak', 'bokjori',
  'diya-oil-lamp', 'daruma-eye-painting', 'mizuhiki', 'milagros', 'phuang-malai',
  'shinto-torii', 'slavic-wreath', 'yeondeunghoe', 'furin-wind-chime', 'crane', 'woodfish',
];
const base = process.env.WBR_URL || 'http://127.0.0.1:5173';
const out = 'artifacts/blessing-rollout', saveKey = 'cyber-bless:personal:v1';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }), results = [];
try {
  for (const width of [390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, hasTouch: width === 320 });
    page.setDefaultTimeout(20000);
    const errors = [];page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ saveKey, reducedMotion }) => {
      localStorage.setItem(saveKey, JSON.stringify({ version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: false, haptics: false, reducedMotion } }));
    }, { saveKey, reducedMotion: width === 320 });
    for (const id of ids) {
      const entry = builtInScenes.find(e => e.id === id), steps = id === 'woodfish' ? 12 : 3;
      assert.ok(entry && isSceneVisibleInApp(entry));
      await page.goto(base);
      await page.getByRole('button', { name: '我的', exact: true }).click();
      await page.getByRole('button', { name: '场景目录', exact: true }).click();
      await page.getByRole('searchbox', { name: '搜索场景' }).fill(entry.title);
      await page.locator(`.scene-card[data-scene="${id}"]`).click();
      if (id === 'woodfish') await page.locator('.woodfish-visual[data-renderer="ready"]').waitFor();
      else await page.locator(`.library-scene-stage[data-scene="${id}"][data-ready="true"]`).waitFor();
      await page.locator('.ritual-narrative summary').click();
      assert.equal(await page.locator('.ritual-narrative p').innerText(), entry.narrative);
      await page.locator('.ritual-narrative summary').click();
      const progress = () => page.evaluate(({ saveKey, id }) => JSON.parse(localStorage.getItem(saveKey)).sceneRecords.find(r => r.id === id)?.progress ?? 0, { saveKey, id });
      const states = [];
      const capture = async () => {
        const n = await progress();
        const text = await page.locator('.scene-hint,.scene-cue-guide,.scene-instruction,.scene-done').allTextContents();
        const labels = await page.locator('.scene-bow-tap').evaluateAll(nodes => nodes.map(el => el.getAttribute('aria-label') || el.title || el.textContent));
        states.push({ progress: n, text, labels });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${id}/${width} does not overflow`);
        return n;
      };
      await capture();
      await page.screenshot({ path: `${out}/${id}-${width}-start.png`, fullPage: true });
      for (let action = 0; action < 18 && await progress() < steps; action++) {
        await page.waitForFunction(({ saveKey, id, steps }) => {
          const n = JSON.parse(localStorage.getItem(saveKey)).sceneRecords.find(r => r.id === id)?.progress ?? 0;
          const button = document.querySelector(id === 'woodfish' ? 'button.woodfish-object' : '.scene-bow-tap');
          return n >= steps || (button && !button.hidden && !button.disabled);
        }, { saveKey, id, steps });
        if (await capture() >= steps) break;
        const button = page.locator(id === 'woodfish' ? 'button.woodfish-object' : '.scene-bow-tap');
        await button.press(action % 2 ? 'Space' : 'Enter');
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      await page.waitForFunction(({ saveKey, id, steps }) => JSON.parse(localStorage.getItem(saveKey)).sceneRecords.find(r => r.id === id)?.progress === steps, { saveKey, id, steps });
      await capture();
      await page.locator('.scene-completion-actions').waitFor();
      await page.screenshot({ path: `${out}/${id}-${width}-done.png`, fullPage: true });
      assert.deepEqual(errors, []);
      results.push({ id, width, reducedMotion: width === 320, complete: true, states });
      console.log(JSON.stringify({ id, width, complete: true }));
    }
    await page.close();
  }
  await writeFile(`${out}/context-browser.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
