import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

// Rendered product UI and save invariants; this does not assess cultural facts or physical hardware.
const base = process.env.WBR_URL || 'http://127.0.0.1:5176';
const out = process.env.WBR_OUT || 'artifacts/wish-object-shelf', key = 'cyber-bless:personal:v1';
const at = '2026-10-27T08:00:00.000Z';
const keepsake = (id, sceneId, extra = {}) => ({ id, kind: 'scene', title: sceneId, sceneId, wishScene: true, at, spentAt: at, ...extra });
const inventory = [keepsake('last-crane', 'crane'), keepsake('milagros', 'milagros'),
  keepsake('house', 'alasita-miniature-house'), keepsake('tanzaku', 'tanzaku-tanabata'),
  keepsake('daruma', 'daruma-eye-painting'), keepsake('first-crane', 'crane')];
const savedState = (collectibles = inventory, reducedMotion = false, sound = true, extra = {}) => ({
  version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles, ledger: [],
  settings: { sound, haptics: false, reducedMotion }, ...extra,
});
const results = [], screenshots = [], errors = [];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.WBR_BROWSER || 'msedge', headless: true,
  args: ['--no-proxy-server', '--enable-unsafe-swiftshader'] });
let current;
async function open(saved, width = 390, options = {}, disableGraphics = false) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, ...options });
  const page = await context.newPage(); current = page; page.setDefaultTimeout(45000);
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ key, saved, disableGraphics }) => {
    if (disableGraphics) Object.defineProperty(globalThis, 'WebGL2RenderingContext', { value: undefined, configurable: true });
    localStorage.setItem(key, JSON.stringify(saved));
    window.rackSounds = 0;
    window.rackAudioEvents = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) {
      window.rackSounds++;
      window.rackAudioEvents.push({ duration: this.buffer?.duration, frames: this.buffer?.length });
      return start.apply(this, args);
    };
  }, { key, saved, disableGraphics });
  await page.goto(base); await page.locator('[data-tab="wishes"]').click();
  await page.locator('.app-shell[data-page="wishes"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const item = (page, id) => page.locator(`.wish-rack-item[data-collectible-id="${id}"]`);
const routeButton = (page, id) => item(page, id).locator('..').locator('.wish-rack-open');
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
async function ready(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('.wish-rack-slot')].slice(0, 3)
    .every(slot => slot.querySelector('.wish-object-preview')?.dataset.status === 'ready'));
}
async function dimensions(page) {
  return page.locator('.wish-rack-row').evaluate(row => ({ width: row.clientWidth, content: row.scrollWidth,
    slot: row.querySelector('.wish-rack-slot').getBoundingClientRect().width,
    page: document.documentElement.scrollWidth, viewport: innerWidth,
    canvases: row.querySelectorAll('canvas').length, slots: row.querySelectorAll('.wish-rack-slot').length }));
}
async function screenshot(page, name) {
  const path = `${out}/${name}`; await page.screenshot({ path, fullPage: true }); screenshots.push(path);
}
async function changedPixels(before, after) {
  const a = await sharp(before).ensureAlpha().raw().toBuffer();
  const b = await sharp(after).ensureAlpha().raw().toBuffer();
  assert.equal(a.length, b.length);
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) changed++;
  return changed;
}
try {
  for (const width of [320, 390, 1280]) {
    const page = await open(savedState(), width); await ready(page);
    const sizes = await dimensions(page);
    assert.equal(sizes.slots, 6); assert.ok(sizes.content > sizes.width);
    assert.ok(sizes.width / sizes.slot >= 2.9 && sizes.width / sizes.slot < 3.5);
    assert.ok(sizes.canvases >= 3 && sizes.canvases <= 4); assert.equal(sizes.page, sizes.viewport);
    assert.equal(await page.locator('.wish-rack-row').count(), 1);
    assert.equal(await page.locator('.wish-rack-toggle').count(), 0);
    assert.equal(await page.locator('.wish-rack-row .scene-overlay-host:visible').count(), 0);
    assert.equal(await page.locator('.wish-rack-row canvas[data-environment]').count(), 0,
      'inline objects omit decorative gardens and skies');
    const first = item(page, 'first-crane');
    const before = await first.locator('.wish-rack-charm').screenshot();
    await first.click();
    assert.equal(await page.evaluate(() => window.rackSounds), 1);
    assert.equal(await first.locator('.wish-rack-charm').evaluate(el => el.getAnimations().length), 0,
      'paper crane moves real wing geometry rather than wobbling its whole frame');
    await page.waitForTimeout(180);
    const after = await first.locator('.wish-rack-charm').screenshot();
    const wingPixels = await changedPixels(before, after);
    assert.ok(wingPixels > 25, `visible paper wing movement at ${width}px: ${wingPixels}`);
    assert.equal(await page.locator('.app-shell').getAttribute('data-page'), 'wishes');
    assert.deepEqual((await saved(page)).collectibles, inventory); assert.equal((await saved(page)).wishes.length, 0);
    await first.locator('.wish-rack-charm').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await screenshot(page, `shelf-${width}.png`);
    // Page arrows reveal the remaining objects and release the old renderers.
    await page.getByRole('button', { name: '向后浏览小物', exact: true }).click();
    await page.waitForFunction(() => { const row = document.querySelector('.wish-rack-row'); return row.scrollLeft > row.clientWidth / 2; });
    await page.getByRole('button', { name: '向后浏览小物', exact: true }).click();
    await page.waitForFunction(() => { const row = document.querySelector('.wish-rack-row'); return row.scrollLeft + row.clientWidth >= row.scrollWidth - 2; });
    await page.waitForFunction(() => !document.querySelector('[data-collectible-id="first-crane"] canvas'));
    assert.ok((await dimensions(page)).canvases <= 4);
    assert.deepEqual((await saved(page)).collectibles, inventory);
    results.push({ check: 'three-across-live-objects', width, sizes, sound: true, nativeWingPixels: wingPixels, saveUnchanged: true, lazyReleased: true });
    await page.context().close();
  }
  const reduced = await open(savedState(inventory, true, false)); await ready(reduced);
  await item(reduced, 'first-crane').click();
  assert.equal(await reduced.evaluate(() => window.rackSounds), 0);
  assert.equal(await item(reduced, 'first-crane').locator('.wish-rack-charm').evaluate(el => el.getAnimations().length), 0);
  await item(reduced, 'first-crane').focus(); await reduced.keyboard.press('ArrowRight');
  assert.equal(await reduced.locator(':focus').getAttribute('data-collectible-id'), 'daruma');
  await reduced.keyboard.press('Enter');
  assert.equal(await reduced.locator('.app-shell').getAttribute('data-page'), 'wishes');
  // A mouse drag moves the same strip, without trailing sound or navigation.
  const box = await reduced.locator('.wish-rack-row').boundingBox();
  await reduced.mouse.move(box.x + box.width - 25, box.y + 40); await reduced.mouse.down();
  await reduced.mouse.move(box.x + 25, box.y + 40, { steps: 12 }); await reduced.mouse.up();
  assert.ok(await reduced.locator('.wish-rack-row').evaluate(el => el.scrollLeft > 20));
  assert.equal(await reduced.evaluate(() => window.rackSounds), 0);
  assert.equal(await reduced.locator('.app-shell').getAttribute('data-page'), 'wishes');
  results.push({ check: 'reduced-motion-muted-keyboard-drag', passed: true });
  await reduced.context().close();

  const touch = await open(savedState(), 390, { isMobile: true, hasTouch: true }); await ready(touch);
  const client = await touch.context().newCDPSession(touch), bounds = await touch.locator('.wish-rack-row').boundingBox();
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width - 15, y: bounds.y + 45 }] });
  for (let i = 1; i <= 10; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bounds.x + bounds.width - 15 - i * 24, y: bounds.y + 45 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.waitForFunction(() => document.querySelector('.wish-rack-row').scrollLeft > 50);
  assert.equal(await touch.evaluate(() => window.rackSounds), 0);
  assert.equal(await touch.locator('.app-shell').getAttribute('data-page'), 'wishes');
  results.push({ check: 'native-touch-swipe-without-activation', passed: true });
  await touch.context().close();

  const individualInventory = [keepsake('kept-house', 'alasita-miniature-house', { wishScene: false }),
    keepsake('paper', 'crane'), keepsake('doll', 'daruma-eye-painting')];
  const individual = await open(savedState(individualInventory)); await ready(individual);
  const reactions = [];
  for (const id of ['paper', 'doll']) {
    const tile = item(individual, id), charm = tile.locator('.wish-rack-charm');
    const before = await tile.screenshot();
    await item(individual, id).click(); await individual.waitForTimeout(180);
    const after = await tile.screenshot();
    const pixels = await changedPixels(before, after);
    assert.ok(pixels > 10, `${id} has a visible individual response`);
    const frames = await charm.evaluate(el => el.getAnimations().map(animation => animation.effect?.getKeyframes()));
    assert.equal(frames.length, id === 'doll' ? 1 : 0);
    reactions.push({ id, changedPixels: pixels, wrapperAnimations: frames.length,
      audio: await individual.evaluate(() => window.rackAudioEvents.at(-1)) });
    await individual.waitForTimeout(1800);
  }
  assert.ok(Math.abs(reactions[0].audio.duration - .38) < .002);
  assert.ok(Math.abs(reactions[1].audio.duration - .24) < .002);
  assert.equal(await item(individual, 'kept-house').getAttribute('data-rack-status'), 'kept');
  assert.equal(await individual.locator('.wish-rack-count').innerText(), '0 个未用');
  assert.deepEqual((await saved(individual)).collectibles, individualInventory);
  assert.equal((await saved(individual)).wishes.length, 0);
  await screenshot(individual, 'individual-responses-390.png');
  await routeButton(individual, 'kept-house').click();
  await individual.locator('.app-shell[data-page="collection"]').waitFor();
  results.push({ check: 'material-sounds-and-native-local-motions', reactions, prayerCollectionDisplayOnly: true, saveUnchanged: true });
  await individual.context().close();

  const reminder = keepsake('reminder', 'omikuji'); delete reminder.spentAt;
  const nonPrayerInventory = [keepsake('woodfish', 'woodfish', { wishScene: false }),
    reminder, keepsake('flowers', 'phuang-malai'),
    keepsake('oil-lamp', 'diya-oil-lamp'), keepsake('sumalak', 'navruz-sumalak'),
    keepsake('bulls', 'pucara-rooftop-bulls', { wishScene: false }),
    keepsake('pine', 'japanese-kadomatsu', { wishScene: false }),
    keepsake('candy', 'shichigosan-chitose-ame', { wishScene: false }),
    keepsake('chime', 'furin-wind-chime'), keepsake('legacy-bulls', 'pucara-rooftop-bulls')];
  const mixedInventory = [...inventory, ...nonPrayerInventory];
  const prayerOnly = await open(savedState(mixedInventory)); await ready(prayerOnly);
  assert.equal(await prayerOnly.locator('.wish-rack-item').count(), inventory.length);
  for (const object of nonPrayerInventory) assert.equal(await item(prayerOnly, object.id).count(), 0);
  assert.equal(await prayerOnly.locator('.wish-rack-count').innerText(), '0 个未用');
  assert.deepEqual((await saved(prayerOnly)).collectibles, mixedInventory);
  await screenshot(prayerOnly, 'prayer-only-390.png');
  await prayerOnly.context().close();
  const noPrayerObjects = await open(savedState(nonPrayerInventory));
  assert.equal(await noPrayerObjects.locator('.wish-ritual-rack').count(), 0);
  assert.equal(await noPrayerObjects.locator('.pray-button').count(), 1);
  assert.deepEqual((await saved(noPrayerObjects)).collectibles, nonPrayerInventory);
  await noPrayerObjects.context().close();
  results.push({ check: 'only-primary-wish-objects-with-original-collection-preserved', passed: true });

  const used = await open(savedState([keepsake('copy', 'crane', { title: '我的纸鹤' })])); await ready(used);
  await routeButton(used, 'copy').click(); await used.locator('.app-shell[data-page="collection"]').waitFor();
  assert.equal(await used.locator('.page-heading .title-ribbon').innerText(), '折一只纸鹤');
  assert.ok((await saved(used)).collectibles[0].spentAt);
  await used.context().close();
  const unusedItem = keepsake('unused', 'crane', { spentAt: undefined });
  const unused = await open(savedState([unusedItem])); await ready(unused);
  await item(unused, 'unused').click(); assert.equal((await saved(unused)).collectibles[0].spentAt, undefined);
  await routeButton(unused, 'unused').click(); await unused.locator('.app-shell[data-page="scene"]').waitFor();
  assert.equal((await saved(unused)).collectibles[0].spentAt, undefined);
  await unused.context().close();
  const pendingItem = keepsake('pending', 'alasita-miniature-house');
  const pendingState = savedState([pendingItem], true, false, { vesselDrafts: { pending: { line: '愿家人平安', at } },
    sceneRecords: [{ id: 'alasita-miniature-house', title: '微屋寄愿', engine: 'alasita-miniature-house@1', revision: '1',
      manifestUrl: '/scenes/alasita-miniature-house/manifest.json', progress: 3, steps: 3, favorite: false, lastOpened: at }] });
  const pending = await open(pendingState); await ready(pending);
  await item(pending, 'pending').click(); assert.deepEqual((await saved(pending)).vesselDrafts, pendingState.vesselDrafts);
  await routeButton(pending, 'pending').click(); await pending.locator('.scene-keep-choice').waitFor();
  assert.ok((await pending.locator('.scene-keep-line').innerText()).includes('愿家人平安'));
  await pending.context().close();
  results.push({ check: 'exact-copy-used-unused-pending-navigation', passed: true });
  const fallback = await open(savedState(), 390, {}, true);
  assert.equal(await fallback.locator('.wish-rack-row canvas').count(), 0);
  assert.equal(await fallback.locator('.wish-object-preview[data-status="failed"] .scene-icon').count(), 6);
  await item(fallback, 'first-crane').click();
  assert.equal(await fallback.evaluate(() => window.rackSounds), 1);
  assert.equal(await fallback.locator('.app-shell').getAttribute('data-page'), 'wishes');
  await screenshot(fallback, 'fallback-390.png');
  await fallback.context().close();
  results.push({ check: 'no-webgl-fallback-remains-tappable', passed: true });
  const empty = await open(savedState([]));
  assert.equal(await empty.locator('.wish-ritual-rack').count(), 0);
  assert.equal(await empty.locator('.pray-button').count(), 1);
  await empty.locator('.pray-button').click();
  await empty.locator('.wish-ritual-picker').waitFor();
  assert.equal(await empty.locator('.wish-scene-choice').count(), 18);
  for (const id of ['crane', 'mizuhiki', 'ema-votive-plaque'])
    assert.equal(await empty.locator(`.wish-scene-choice[data-scene="${id}"]`).count(), 1);
  for (const id of ['phuang-malai', 'slavic-wreath', 'omikuji', 'furin-wind-chime', 'shinto-torii', 'bonfim-ribbon'])
    assert.equal(await empty.locator(`.wish-practice-card[data-scene="${id}"]`).count(), 0);
  assert.equal(await empty.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.deepEqual((await saved(empty)).collectibles, []);
  await screenshot(empty, 'two-category-picker-390.png');
  await empty.context().close();
  results.push({ check: 'two-category-picker-with-18-writable-wish-scenes', passed: true });
  assert.deepEqual(errors, []);
  const report = { passed: true, base, checkedAt: new Date().toISOString(), results, screenshots, pageErrors: errors };
  await writeFile(`${out}/browser.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (current && !current.isClosed()) await screenshot(current, 'failure.png').catch(() => {});
  await writeFile(`${out}/browser.json`, JSON.stringify({ passed: false, results, screenshots, pageErrors: errors, error: error.stack }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
