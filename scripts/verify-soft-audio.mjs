// Run against Vite: WBR_URL=http://127.0.0.1:5193 node scripts/verify-soft-audio.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.WBR_URL || 'http://127.0.0.1:5193';
const out = path.resolve('artifacts/soft-audio');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.WBR_BROWSER || 'msedge', headless: true, args: ['--no-proxy-server', '--enable-unsafe-swiftshader'] });
const report = { at: new Date().toISOString(), base, scope: 'Real browser WebAudio scheduling and OfflineAudioContext rendering; no physical phone speaker assessment.', renders: [], scenes: [], errors: [] };
function wav(pcm, rate) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
try {
  const renderPage = await browser.newPage();
  await renderPage.goto(base);
  const rendered = await renderPage.evaluate(async source => {
    const { createSoftSoundPlayer } = await import(source);
    const result = [];
    for (const sound of ['complete', 'collect', 'saved', 'woodfish', 'paper', 'water', 'woodTap', 'beans']) {
      const context = new OfflineAudioContext(1, 33600, 24000);
      const player = createSoftSoundPlayer({ context: () => context, enabled: () => true });
      player.play(sound);
      const buffer = await context.startRendering(), samples = buffer.getChannelData(0);
      const bytes = new Uint8Array(samples.length * 2), view = new DataView(bytes.buffer);
      let peak = 0, energy = 0;
      for (let i = 0; i < samples.length; i++) {
        const value = samples[i]; peak = Math.max(peak, Math.abs(value)); energy += value * value;
        view.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true);
      }
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      result.push({ sound, peak, rms: Math.sqrt(energy / samples.length), pcm: btoa(binary) });
      player.dispose();
    }
    return result;
  }, new URL(`/@fs/${path.resolve('packages/shared/src/soft-audio.ts').replaceAll('\\', '/')}`, base).href);
  const preview = [];
  for (const { sound, peak, rms, pcm } of rendered) {
    assert.ok(peak > .0001 && peak < .12, `${sound} has a finite, quiet rendered signal`);
    assert.ok(rms > .00001 && rms < .04, `${sound} is audible without sustained excessive level`);
    const bytes = Buffer.from(pcm, 'base64');
    await writeFile(path.join(out, `${sound}.wav`), wav(bytes, 24000));
    preview.push(bytes);
    report.renders.push({ sound, peak, rms });
  }
  await writeFile(path.join(out, 'preview.wav'), wav(Buffer.concat(preview), 24000));
  const labels = ['完成', '收下', '保存成功', '木鱼', '折纸', '倒水', '木碰', '撒豆'];
  await writeFile(path.join(out, 'listen.html'), `<!doctype html><meta charset="utf-8"><title>一日一念 · 音效试听</title><style>body{max-width:650px;margin:50px auto;padding:0 24px;background:#f8f4e9;color:#3e584b;font:16px system-ui}h1{font-size:26px}section{display:flex;align-items:center;justify-content:space-between;gap:15px;margin:12px 0;padding:15px;border-radius:20px;background:#fffdf6}audio{width:280px}</style><h1>一日一念 · 轻柔音效</h1><p>完成、收下与小小动作的声音。</p>${rendered.map((item, index) => `<section><span>${labels[index]}</span><audio controls preload="none" src="${item.sound}.wav"></audio></section>`).join('')}`);
  await renderPage.close();

  for (const scene of ['crane', 'tibetan-water-bowls', 'zeniarai-coin-washing', 'kagami-biraki-sake', 'setsubun-mamemaki']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => report.errors.push(`${scene}: ${error.message}`));
    await page.addInitScript(() => {
      window.audioEvents = [];
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        createBufferSource() {
          const source = super.createBufferSource(), start = source.start.bind(source);
          source.start = (...args) => {
            window.audioEvents.push({ type: 'material', time: performance.now(), frames: source.buffer?.length, progress: document.querySelector('.scene-progress')?.textContent });
            return start(...args);
          };
          return source;
        }
        createOscillator() {
          const source = super.createOscillator(), start = source.start.bind(source);
          source.start = (...args) => { window.audioEvents.push({ type: 'tone', time: performance.now() }); return start(...args); };
          return source;
        }
      };
    });
    await page.goto(`${base}/scene-review?scene=${scene}`);
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor();
    assert.equal(await page.evaluate(() => window.audioEvents.length), 0, `${scene} restores silently`);
    const action = page.locator('.scene-bow-tap');
    const clickStep = async () => {
      await action.click();
      await page.waitForFunction(() => {
        const button = document.querySelector('.scene-bow-tap');
        return button && (button.hidden || (!button.disabled && button.getAttribute('aria-disabled') !== 'true'));
      });
    };
    if (scene === 'crane') {
      for (let i = 0; i < 4; i++) await clickStep();
      assert.equal(await page.evaluate(() => window.audioEvents.filter(e => e.type === 'material').length), 4, 'every accepted fold has one material voice');
      await clickStep(); await clickStep();
      await page.locator('.scene-done-row').waitFor();
    } else if (scene === 'tibetan-water-bowls' || scene === 'zeniarai-coin-washing') {
      await clickStep();
      const before = await page.evaluate(() => window.audioEvents.filter(e => e.type === 'material').length);
      await clickStep();
      const water = await page.evaluate(() => window.audioEvents.filter(e => e.type === 'material'));
      assert.equal(water.length, before + 1, `${scene} water sounds once during the pour`);
      assert.match(water.at(-1).progress, /1\s*\//, 'water starts before the pour checkpoint settles');
    } else {
      await clickStep(); await clickStep();
      assert.ok(await page.evaluate(() => window.audioEvents.some(e => e.type === 'material')), `${scene} has an operation voice`);
    }
    const gear = page.getByRole('button', { name: '仪式设置', exact: true });
    await gear.click();
    await page.getByRole('button', { name: '音效', exact: true }).click();
    await gear.click();
    const beforeMute = await page.evaluate(() => window.audioEvents.length);
    if (await action.isVisible()) await clickStep();
    assert.equal(await page.evaluate(() => window.audioEvents.length), beforeMute, `${scene} obeys live mute`);
    report.scenes.push({ scene, events: await page.evaluate(() => window.audioEvents), mutePassed: true });
    await page.close();
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({ renders: report.renders, scenes: report.scenes.map(item => ({ scene: item.scene, events: item.events.length, mutePassed: item.mutePassed })) }, null, 2));
} finally {
  await writeFile(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
