// Against Vite: $env:WBR_URL='http://127.0.0.1:5194'; node scripts/verify-ui-audio.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { UI_SOUND_FILES } from '../packages/app/src/ui-sound-assets.ts';

const base = process.env.WBR_URL || 'http://127.0.0.1:5194';
const out = path.resolve('artifacts/ui-sounds/verification');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.WBR_BROWSER || 'msedge', headless: true });
const report = { checks: [], errors: [], assets: [], scope: 'Real browser decoding, user-gesture playback and UI lifecycle; no physical phone listening or silent-switch assessment.' };
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', error => report.errors.push(error.message));
await page.addInitScript(() => {
  window.uiAudioEvents = [];
  window.uiAudioContexts = 0;
  window.uiAudioHidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.uiAudioHidden });
  const Native = window.AudioContext;
  window.AudioContext = class extends Native {
    constructor(...args) { super(...args); window.uiAudioContexts++; }
    createBufferSource() {
      const source = super.createBufferSource(), start = source.start.bind(source), stop = source.stop.bind(source);
      source.start = (...args) => {
        window.uiAudioEvents.push({ kind: 'start', at: performance.now(), duration: source.buffer?.duration, page: document.querySelector('.app-shell')?.dataset.page });
        return start(...args);
      };
      source.stop = (...args) => { window.uiAudioEvents.push({ kind: 'stop', at: performance.now() }); return stop(...args); };
      return source;
    }
  };
});
const count = () => page.evaluate(() => window.uiAudioEvents.filter(event => event.kind === 'start').length);
const pause = () => page.waitForTimeout(200);
const check = (name, detail) => report.checks.push({ name, ...detail });
async function changes(name, action, amount = 1) {
  await pause();
  const before = await count();
  await action(); await pause();
  const after = await count();
  assert.equal(after - before, amount, name);
  check(name, { played: after - before });
}
try {
  await page.goto(base);
  const moduleUrl = `/@fs/${path.resolve('packages/core/src/index.ts').replaceAll('\\', '/')}`;
  await page.evaluate(async url => {
    const { createState, reduce } = await import(url);
    const state = reduce(createState(), { type: 'wish.create', id: 'audio-wish', title: '今天顺利', intention: '', at: '2026-11-03T01:00:00Z' });
    localStorage.setItem('cyber-bless:personal:v1', JSON.stringify(state));
  }, moduleUrl);
  await page.reload();
  await page.locator('[data-tab="today"]').waitFor();
  await page.waitForFunction(() => new Set(performance.getEntriesByType('resource').filter(entry => /ui-sounds\/soft-garden-v1\/.*\.wav/.test(entry.name)).map(entry => entry.name)).size === 10);
  assert.equal(await count(), 0);
  assert.equal(await page.evaluate(() => window.uiAudioContexts), 0);
  check('startup fetches local bytes without audio context or playback', { played: 0 });

  // A trusted click on the already-selected tab unlocks and decodes without a cue.
  await changes('current tab stays quiet while preparing audio', () => page.locator('[data-tab="today"]').click(), 0);
  await changes('user tab navigation plays once', () => page.locator('[data-tab="wishes"]').click());
  await changes('repeated current tab stays quiet', () => page.locator('[data-tab="wishes"]').click(), 0);
  await changes('changed wish filter plays once', () => page.locator('.wish-filters button, .filter-row button, .segmented button').filter({ hasText: '已如愿' }).click());
  await changes('repeated wish filter stays quiet', () => page.locator('.wish-filters button, .filter-row button, .segmented button').filter({ hasText: '已如愿' }).click(), 0);
  await changes('open settings page', () => page.locator('[data-tab="me"]').click());
  await changes('language dialog opens once', () => page.locator('.language-setting-trigger').click());
  await changes('language choice closes without an extra close cue', () => page.locator('.language-dialog input[value="en"]').click());
  await changes('language dialog reopens', () => page.locator('.language-setting-trigger').click());
  await changes('Escape dismisses dialog once', () => page.keyboard.press('Escape'));

  await changes('muting is silent', () => page.locator('.settings-card .switch').first().uncheck(), 0);
  await changes('muted navigation is quiet', () => page.locator('[data-tab="wishes"]').click(), 0);
  await changes('muted return is quiet', () => page.locator('[data-tab="me"]').click(), 0);
  await changes('enabling sound gives one preview', () => page.locator('.settings-card .switch').first().check());
  await changes('changed accessibility setting plays once', () => page.locator('.settings-card .switch').last().check());

  await pause();
  const before = await count();
  await page.locator('.language-setting-trigger').click();
  await page.evaluate(() => { window.uiAudioHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await pause();
  const hiddenCount = await count();
  assert.equal(hiddenCount - before, 1);
  assert.ok(await page.evaluate(() => window.uiAudioEvents.some(event => event.kind === 'stop')));
  await page.evaluate(() => { window.uiAudioHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await pause(); assert.equal(await count(), hiddenCount);
  check('background stops active UI source and return does not replay', { playedAfterReturn: 0 });
  await page.keyboard.press('Escape'); await pause();

  await changes('open wishes for a real saved result', () => page.locator('[data-tab="wishes"]').click());
  await changes('open wish detail', () => page.locator('[data-wish-id="audio-wish"]').click());
  await pause();
  const savedBefore = await count();
  await page.locator('.wish-detail-page [data-audio-cue="saved"]').click();
  await page.waitForFunction(before => window.uiAudioEvents.filter(event => event.kind === 'start').length > before, savedBefore);
  await page.waitForTimeout(600);
  assert.equal(await count() - savedBefore, 1);
  assert.equal(await page.evaluate(() => window.uiAudioEvents.filter(event => event.kind === 'start').at(-1).duration), .52);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cyber-bless:personal:v1')).wishes.find(wish => wish.id === 'audio-wish').status), 'realized');
  check('successful wish persistence plays the new 520ms saved WAV exactly once', { played: 1 });

  // Decode every packaged WAV in the browser, inspect actual samples, and write
  // a review page using exactly the same bytes shipped in the App.
  const files = Object.keys(UI_SOUND_FILES).filter(sound => sound !== 'notice');
  for (const sound of files) {
    const result = await page.evaluate(async ({ sound, file }) => {
      const context = new OfflineAudioContext(1, 48000, 48000);
      const response = await fetch(`/${file}`);
      if (!response.ok) throw Error(`Missing local sound ${sound}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const samples = buffer.getChannelData(0);
      let peak = 0, energy = 0;
      for (const value of samples) { peak = Math.max(peak, Math.abs(value)); energy += value * value; }
      return { sound, duration: buffer.duration, channels: buffer.numberOfChannels, peak, rms: Math.sqrt(energy / samples.length) };
    }, { sound, file: UI_SOUND_FILES[sound] });
    assert.ok(result.peak > .05 && result.peak <= .085);
    assert.ok(result.duration >= .16 && result.duration <= .93);
    assert.equal(result.channels, 1);
    report.assets.push(result);
    await copyFile(path.resolve('assets', UI_SOUND_FILES[sound]), path.join(out, `${sound}.wav`));
  }
  const names = ['进入页面', '返回', '切换选项', '展开面板', '收起面板', '开启', '关闭选项', '保存', '收集', '完成'];
  await writeFile(path.join(out, 'listen.html'), `<!doctype html><html lang="zh-Hans"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>界面音效试听</title><style>body{max-width:680px;margin:40px auto;padding:0 24px;background:#f8f5ed;color:#3e584b;font:16px system-ui}h1{font-size:26px}section{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;padding:16px;background:#fffdf7;border-radius:20px}audio{width:min(65%,300px)}small{display:block;color:#65766b}</style><h1>一日一念 · Soft Garden</h1><p>App 实际使用的十段原创合成音效。</p>${files.map((sound, index) => `<section><span>${names[index]}<small>${Math.round(report.assets[index].duration * 1000)} ms</small></span><audio controls preload="none" src="${sound}.wav"></audio></section>`).join('')}<p>本地确定性合成，统一调整为试听版的 45% 振幅。</p><script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script></html>`);
  // Sequential reel with a quiet gap between each cue, usable as an inline preview.
  const pcm = [];
  for (const sound of files) {
    const data = await readFile(path.resolve('assets', UI_SOUND_FILES[sound]));
    pcm.push(data.subarray(44), Buffer.alloc(48000 * 2 * .2));
  }
  const data = Buffer.concat(pcm), header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + data.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(48000, 24); header.writeUInt32LE(96000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  await writeFile(path.join(out, 'preview.wav'), Buffer.concat([header, data]));
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
