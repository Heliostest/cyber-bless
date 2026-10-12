import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const base = process.env.WBR_URL || 'http://127.0.0.1:5178/';
const out = path.resolve('artifacts/four-craft-scenes/browser');
await mkdir(out, { recursive: true });
const ids = ['daruma-eye-painting', 'mizuhiki', 'milagros', 'phuang-malai'];
const key = 'cyber-bless:personal:v1';
const empty = { version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [],
  settings: { sound: false, haptics: false, reducedMotion: true } };
const browser = await chromium.launch({ headless: true });
const errors = [], results = [];
async function pageAt(width = 390, state = empty) {
  const page = await browser.newPage({ viewport: { width, height: width > 500 ? 900 : 844 } });
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state });
  await page.goto(base);
  return page;
}
async function catalog(page) {
  await page.getByRole('button', { name: '我的', exact: true }).click();
  await page.getByRole('button', { name: '场景目录', exact: true }).click();
}
async function open(page, id) {
  await page.locator(`.scene-card[data-scene="${id}"]`).click();
  await page.locator('canvas[data-environment-ready="true"]').waitFor();
}
const save = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
async function progress(page, id, n) {
  try {
    await page.waitForFunction(({ key, id, n }) => JSON.parse(localStorage.getItem(key)).sceneRecords.find(r => r.id === id)?.progress === n, { key, id, n }, { timeout: 15000 });
  } catch (error) {
    console.error({ id, expected: n, state: await save(page) });
    await page.screenshot({ path: path.join(out, `${id}-failed.png`), fullPage: true });
    throw error;
  }
}
async function action(page, count = 1) {
  for (let i = 0; i < count; i++) await page.locator('.scene-bow-tap').click();
}
async function shot(page, id, suffix) {
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(out, `${id}-${suffix}.png`), fullPage: true, animations: 'disabled' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow: ${id}/${suffix}`);
}
async function reopen(page, id, n, wishes = 0) {
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await open(page, id);
  const state = await save(page);
  assert.equal(state.sceneRecords.find(r => r.id === id).progress, n);
  assert.equal(state.wishes.length, wishes);
}

// Inspect each visible checkpoint in portrait, narrow portrait and desktop.
for (const width of [390, 320, 1280]) for (const id of ids) {
  const page = await pageAt(width);
  await catalog(page); await open(page, id);
  if (id === 'milagros') await page.getByRole('button', { name: '选择花形小符' }).click();
  await shot(page, id, `${width}-0`);
  await action(page, id === 'phuang-malai' ? 4 : 1);
  await progress(page, id, 1);
  if (width === 390) await reopen(page, id, 1);
  await shot(page, id, `${width}-1`);
  const phrase = `${id}：谢谢这段时光`;
  if (id === 'daruma-eye-painting') {
    await page.locator('.scene-wish-slot input').fill(phrase);
    await page.locator('.scene-wish-slot input').press('Enter');
  } else await action(page);
  await progress(page, id, 2);
  if (width === 390) await reopen(page, id, 2, id === 'daruma-eye-painting' ? 1 : 0);
  await shot(page, id, `${width}-2`);
  if (id === 'daruma-eye-painting') await action(page);
  else {
    await page.locator('.scene-wish-slot input').fill(phrase);
    await page.locator('.scene-wish-slot input').press('Enter');
  }
  await progress(page, id, 3);
  await shot(page, id, `${width}-3`);
  const state = await save(page);
  assert.equal(state.wishes.length, 1);
  assert.equal(state.wishes[0].title, phrase);
  if (id === 'milagros') assert.equal(state.sceneRecords.find(r => r.id === id).variant, 'flower');
  results.push({ id, width, checkpoints: 3, savedWishes: 1 });
  console.log(`${id} ${width}px: checkpoints/restoration/save passed`);
  await page.close();
}

// Screen coordinates come from the scenes' documented camera/object positions;
// real Playwright pointer events hit the actual rendered objects and rays.
async function project(page, id, xyz) {
  const rect = await page.locator('canvas').boundingBox();
  const aspect = rect.width / rect.height;
  const settings = {
    'daruma-eye-painting': [40, [0, 1.45, 3.45], [0, .97, 0], 3.2],
    mizuhiki: [35, [0, 3.5, 3.8], [0, .12, 0], 4],
    milagros: [40, [.12, 1.72, 4.75], [0, 1.08, 0], 3],
    'phuang-malai': [40, [0, 1.8, 3.35], [0, 1.06, .05], 3.1],
  }[id];
  const [fov, home, look, factor] = settings;
  const camera = new THREE.PerspectiveCamera(fov, aspect, .1, 60);
  camera.position.set(...home); camera.position.z += Math.max(0, .8 - aspect) * factor;
  camera.lookAt(new THREE.Vector3(...look)); camera.updateMatrixWorld();
  const p = new THREE.Vector3(...xyz).project(camera);
  return [rect.x + (p.x + 1) * rect.width / 2, rect.y + (1 - p.y) * rect.height / 2];
}
async function drag(page, id, route) {
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const pts = await Promise.all(route.map(p => project(page, id, p)));
  await page.mouse.move(...pts[0]); await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(...p, { steps: 8 });
  await page.mouse.up();
}
for (const id of ids) {
  const page = await pageAt(); await catalog(page); await open(page, id);
  if (id === 'daruma-eye-painting') {
    const u = (1.075 - .82) / .9;
    const r = .72 * Math.sqrt(1 - u * u) * (1 - u * .12);
    const eye = [-.255, 1.075 + .135, Math.sqrt(r * r - .255 ** 2) * .82 + .022];
    await drag(page, id, [eye, eye]);
  } else if (id === 'mizuhiki') {
    await drag(page, id, [[-.62,.31,.48],[-.70,.31,.15],[-.57,.31,-.20],[-.32,.31,-.38],[-.05,.31,-.27],[.12,.31,0]]);
  } else if (id === 'milagros') {
    await drag(page, id, [[-.81,.41,.72],[-.81,.41,.72]]);
    await progress(page, id, 1);
    await drag(page, id, [[.62,1.04,.62],[0,1.65,.2]]);
    await progress(page, id, 2);
  } else {
    for (const [i, segment] of [1,3,4,5].entries()) {
      const a = (segment + .5) * Math.PI / 3;
      await drag(page, id, [[-.36 + i * .24,.34,.68],[Math.cos(a) * .425,1.38 + Math.sin(a) * .425,.18]]);
    }
  }
  await progress(page, id, id === 'milagros' ? 2 : 1);
  results.push({ id, directGesture: 'passed' });
  await page.close();
}

// Enter through the real wish/vessel UI. A return paints the second eye,
// spends one keepsake and adds one note without producing another wish.
{
  const at = '2026-10-11T08:00:00.000Z';
  const state = { ...empty,
    wishes: [{ id: 'craft-return', title: '读完一本书', intention: '每天读一点', status: 'realized', archived: false,
      createdAt: at, realizedAt: at, returnMethod: 'ritual', sourceSceneId: 'daruma-eye-painting', notes: [] }],
    collectibles: [{ id: 'craft-vessel', kind: 'scene', sceneId: 'daruma-eye-painting', title: '达摩点睛', wishScene: true, at }] };
  const page = await pageAt(390, state);
  await page.getByRole('button', { name: '心愿', exact: true }).click();
  await page.locator('.wish-card[data-wish-id="craft-return"]').click();
  await page.getByRole('button', { name: '来还个愿', exact: true }).click();
  await page.locator('.vessel-card[data-scene="daruma-eye-painting"]').click();
  await page.locator('canvas[data-environment-ready="true"]').waitFor();
  await shot(page, 'daruma-eye-painting', 'return-0');
  assert.equal(await page.locator('.scene-bow-tap').innerText(), '补上另一目');
  assert.equal(await page.locator('.scene-wish-slot input').count(), 0);
  await action(page, 3); await progress(page, 'daruma-eye-painting', 3);
  await shot(page, 'daruma-eye-painting', 'return-3');
  const saved = await save(page);
  assert.equal(saved.wishes.length, 1);
  assert.equal(saved.wishes[0].notes.length, 1);
  assert.ok(saved.collectibles[0].spentAt);
  assert.equal(saved.ledger.length, 0);
  results.push({ id: 'daruma-eye-painting', returning: 'passed' });
  await page.close();
}
await writeFile(path.join(out, 'report.json'), JSON.stringify({ results, errors }, null, 2));
await browser.close();
assert.deepEqual(errors, []);
console.log(JSON.stringify({ captures: 50, flows: 12, directGestures: 4, returning: true, errors, out }));
