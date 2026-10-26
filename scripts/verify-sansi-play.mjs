import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { scenePointer } from './browser-scene-pointer.mjs';

const base = process.env.WBR_URL || 'http://127.0.0.1:5173';
const saveKey = 'cyber-bless:personal:v1', out = 'artifacts/sansi-play';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }), results = [];
try {
  for (const width of [390, 320, 1280]) {
    if (process.env.WBR_WIDTHS && !process.env.WBR_WIDTHS.split(',').includes(String(width))) continue;
    const touch = width === 320, errors = [];
    const page = await browser.newPage({ viewport: { width, height: 950 }, hasTouch: touch, isMobile: touch });
    page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(key => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [], settings: { sound: true, haptics: true, reducedMotion: false } }));
      window.sansiNotes = []; window.sansiHaptics = [];
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value(pattern) { window.sansiHaptics.push(pattern); return true; } });
      const NativeAudio = window.AudioContext;
      window.AudioContext = class extends NativeAudio {
        createOscillator() {
          const osc = super.createOscillator(), set = osc.frequency.setValueAtTime.bind(osc.frequency);
          osc.frequency.setValueAtTime = (value, time) => { window.sansiNotes.push(value); return set(value, time); };
          return osc;
        }
      };
    }, saveKey);
    await page.goto(base);
    const open = async () => {
      await page.getByRole('button', { name: '我的', exact: true }).click();
      await page.getByRole('button', { name: '场景目录', exact: true }).click();
      await page.locator('.scene-card[data-scene="malawi-sansi"]').click();
      await page.locator('.library-scene-stage[data-ready="true"]').waitFor();
    };
    await open();
    const record = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).sceneRecords.find(e => e.id === 'malawi-sansi'), saveKey);
    const pointer = await scenePointer(page, touch), finish = page.getByRole('button', { name: '结束体验', exact: true });
    const setFeedbackMenu = async open => {
      const gear = page.locator('button[aria-label="仪式设置"]');
      if (await gear.getAttribute('aria-expanded') !== String(open)) await gear.click();
      await gear.evaluate(async button => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await Promise.all(button.closest('.feedback-controls').getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
        await new Promise(resolve => requestAnimationFrame(resolve));
      });
      if (!open) await page.locator('.feedback-controls-anchor[data-feedback-present]').waitFor({ state: 'detached' });
    };
    assert.equal(await finish.isEnabled(), false);
    assert.equal(await page.locator('.scene-sansi-key').count(), 9);
    if (width === 1280) {
      await page.keyboard.press('1');
      assert.equal(await page.evaluate(() => window.sansiNotes.length), 3, 'Number shortcuts work immediately on entry');
      await page.locator('.scene-sansi-key').nth(4).focus();
      for (const key of ['Enter', 'Enter', 'Space', '2']) await page.keyboard.press(key);
      assert.equal(await page.evaluate(() => window.sansiNotes.length), 15, 'Keyboard notes repeat without refocusing');
      assert.equal(await page.locator('.scene-sansi-key').nth(4).evaluate(el => el === document.activeElement), true);
      await page.evaluate(() => { window.sansiNotes = []; window.sansiHaptics = []; });
    }
    await page.locator('canvas').scrollIntoViewIfNeeded();
    for (let key = 0; key < 9; key++) {
      if (width === 1280) await page.keyboard.press(String(key + 1));
      else {
        const point = await page.locator('[data-cue-role="source"]').nth(key).evaluate(el => {
          const r = el.parentElement.getBoundingClientRect(); return [r.left + Number(el.dataset.x), r.top + Number(el.dataset.y)];
        });
        await pointer.down(point); await pointer.up();
      }
    }
    const notes = await page.evaluate(() => window.sansiNotes), haptics = await page.evaluate(() => window.sansiHaptics);
    assert.equal(notes.length, 27); assert.equal(new Set(notes.filter((_, i) => i % 3 === 0)).size, 9);
    assert.equal(haptics.length, 9); assert.ok(new Set(haptics).size > 1);
    assert.equal((await record()).progress, 2); assert.equal(await page.locator('.scene-completion-actions').count(), 0);
    const bounds = await page.evaluate(() => {
      const canvas = document.querySelector('canvas').getBoundingClientRect(), stage = document.querySelector('.library-scene-stage').getBoundingClientRect();
      return [...document.querySelectorAll('.scene-sansi-key,.scene-sansi-finish')].every(el => {
        const r = el.getBoundingClientRect(); return r.top >= canvas.bottom - 1 && r.bottom <= stage.bottom + 1 && r.left >= stage.left && r.right <= stage.right && r.height >= 44;
      });
    });
    assert.equal(bounds, true, 'All playing and finish controls fit below the canvas');
    await page.screenshot({ path: `${out}/playing-${width}.png`, fullPage: true });
    if (width === 390) {
      await setFeedbackMenu(true);
      await page.getByRole('button', { name: '音效', exact: true }).click();
      await setFeedbackMenu(false);
      await page.locator('.scene-sansi-key').nth(4).click();
      assert.equal(await page.evaluate(() => window.sansiNotes.length), 27, 'Sound toggle applies to the next note');
      await setFeedbackMenu(true);
      await page.getByRole('button', { name: '震动', exact: true }).click();
      await setFeedbackMenu(false);
      const count = await page.evaluate(() => window.sansiHaptics.length);
      await page.locator('.scene-sansi-key').nth(1).click();
      assert.equal(await page.evaluate(() => window.sansiHaptics.length), count, 'Haptic toggle applies to the next note');
      await page.reload(); await open();
      assert.equal((await record()).progress, 2); assert.equal(await finish.isEnabled(), true);
      assert.equal(await page.evaluate(() => window.sansiNotes.length), 0, 'Restoration remains silent');
    }
    for (const key of [4, 0, 8, 4, 3, 5]) await page.locator('.scene-sansi-key').nth(key).click();
    assert.equal((await record()).progress, 2); await finish.click();
    await page.locator('.scene-completion-actions').waitFor();
    assert.equal((await record()).progress, 3); assert.equal(await page.locator('[data-cue-role="source"]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${out}/finished-${width}.png`, fullPage: true });
    results.push({ width, touch, notes: 9, distinctPitches: 9, manualFinish: true, errors });
    console.log(JSON.stringify(results.at(-1))); await page.close();
  }
  await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
