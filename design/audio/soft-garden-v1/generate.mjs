// Original, deterministic sound-design study. No samples, models or downloads.
// Run: node design/audio/soft-garden-v1/generate.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const output = fileURLToPath(new URL('../../../artifacts/audio-design/soft-garden-v1/', import.meta.url));
export const rate = 48000;
const tau = 2 * Math.PI;
const midi = n => 440 * 2 ** ((n - 69) / 12);
const smooth = x => (x = Math.max(0, Math.min(1, x)), x * x * (3 - 2 * x));
const note = (kind, pitch, at = 0, gain = 1, decay) => ({ kind, pitch, at, gain, decay });
const cues = [
  { id: 'navigate', label: '进入', description: '轻轻跃起的一颗软木音', duration: .26,
    notes: [note('wood', 77, 0, 1, .052), note('bubble', 89, .027, .12, .029)] },
  { id: 'back', label: '返回', description: '向下落稳的低音木粒', duration: .27,
    notes: [note('wood', 70, 0, .92, .057), note('bubble', 65, .035, .19, .038)] },
  { id: 'select', label: '选择', description: '适合连续点击的干爽小木点', duration: .16,
    notes: [note('wood', 81, 0, .76, .026)] },
  { id: 'open', label: '展开', description: '两颗向上舒展的木音', duration: .39, air: .022,
    notes: [note('wood', 72, 0, .62, .047), note('wood', 79, .075, .88, .061)] },
  { id: 'close', label: '收起', description: '两颗轻轻收拢的木音', duration: .34, air: .011,
    notes: [note('wood', 76, 0, .60, .040), note('wood', 69, .066, .72, .050)] },
  { id: 'toggleOn', label: '开启', description: '有一点弹性的明亮气泡', duration: .26,
    notes: [note('bubble', 79, 0, .85, .040), note('wood', 91, .021, .15, .026)] },
  { id: 'toggleOff', label: '关闭', description: '低一点、短一点的圆润气泡', duration: .24,
    notes: [note('bubble', 70, 0, .79, .035), note('wood', 82, .014, .10, .024)] },
  { id: 'saved', label: '保存', description: '两颗温暖的音符轻轻落定', duration: .52, room: .035,
    notes: [note('wood', 76, 0, .62, .063), note('bell', 79, .105, .66, .080)] },
  { id: 'collect', label: '收集', description: '上扬的小奖励，尾音略带光泽', duration: .61, room: .045,
    notes: [note('bubble', 74, 0, .60, .042), note('wood', 81, .080, .64, .058), note('bell', 86, .164, .51, .090)] },
  { id: 'complete', label: '完成', description: '一小句轻快的完成提示', duration: .93, room: .055,
    notes: [note('wood', 74, 0, .66, .078), note('wood', 81, .108, .61, .073),
      note('bell', 78, .222, .49, .088), note('bell', 86, .350, .55, .115), note('wood', 74, .350, .21, .093)] },
];

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296 * 2 - 1;
  };
}

function voice(target, event, seed) {
  const rng = random(seed), start = Math.round(event.at * rate);
  const f = midi(event.pitch), decay = event.decay;
  let noise = 0;
  for (let i = start; i < target.length; i++) {
    const t = (i - start) / rate;
    const attack = smooth(t / (event.kind === 'bubble' ? .0035 : .0025));
    noise += .22 * (rng() - noise);
    let sample;
    if (event.kind === 'wood') {
      // A damped fundamental, a brief low body and quiet inharmonic modes.
      const phase = tau * f * (t + .018 * .011 * (1 - Math.exp(-t / .011)));
      sample = Math.sin(phase) * Math.exp(-t / decay)
        + .15 * Math.sin(phase * 3.97) * Math.exp(-t / (decay * .25))
        + .025 * Math.sin(phase * 7.91) * Math.exp(-t / (decay * .13))
        + .12 * Math.sin(phase * .503) * Math.exp(-t / .016)
        + .035 * noise * Math.exp(-t / .006);
    } else if (event.kind === 'bubble') {
      const phase = tau * f * (t + .38 * .012 * (1 - Math.exp(-t / .012)));
      sample = (Math.sin(phase + .15 * Math.sin(phase * 1.5) * Math.exp(-t / .018))
        + .085 * Math.sin(2 * phase) * Math.exp(-t / .022)) * Math.exp(-t / decay);
    } else {
      const phase = tau * f * t;
      sample = Math.sin(phase) * Math.exp(-t / decay)
        + .13 * Math.sin(phase * 2.004) * Math.exp(-t / (decay * .47))
        + .035 * Math.sin(phase * 3.98) * Math.exp(-t / (decay * .24));
    }
    target[i] += sample * attack * event.gain;
  }
}

function render(cue, cueIndex) {
  const samples = new Float64Array(Math.round(cue.duration * rate));
  cue.notes.forEach((event, i) => voice(samples, event, 81031 + cueIndex * 7919 + i * 269));
  if (cue.air) {
    const rng = random(49231 + cueIndex); let breath = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate;
      breath += .045 * (rng() - breath);
      if (t < .16) samples[i] += cue.air * breath * Math.sin(Math.PI * t / .16) ** 2;
    }
  }
  if (cue.room) {
    const dry = samples.slice();
    for (const [seconds, gain] of [[.029, 1], [.047, -.55], [.071, .32]]) {
      const offset = Math.round(seconds * rate);
      for (let i = offset; i < samples.length; i++) samples[i] += dry[i - offset] * cue.room * gain;
    }
  }
  // Two gentle lowpass stages soften mallet transients and upper partials.
  const alpha = 1 - Math.exp(-tau * 4800 / rate);
  let low1 = 0, low2 = 0;
  for (let i = 0; i < samples.length; i++) {
    low1 += alpha * (samples[i] - low1); low2 += alpha * (low1 - low2);
    samples[i] = low2;
  }
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    samples[i] = (samples[i] - mean) * smooth(i / (rate * .0015))
      * smooth((samples.length - 1 - i) / (rate * .026));
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  // A listening master, not the application's quieter playback calibration.
  const ceiling = cue.id === 'select' ? .14 : cue.id === 'complete' ? .22 : .18;
  const gain = Math.min(.23, ceiling / peak);
  return samples.map(value => value * gain);
}

function encodeWav(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i]) || Math.abs(samples[i]) >= 1) throw Error(`Invalid sample ${i}`);
    bytes.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  }
  return bytes;
}

function measure(bytes) {
  const count = (bytes.length - 44) / 2;
  let peak = 0, energy = 0, mean = 0, maxStep = 0, previous = 0;
  for (let i = 0; i < count; i++) {
    const value = bytes.readInt16LE(44 + i * 2) / 32768;
    peak = Math.max(peak, Math.abs(value)); energy += value * value; mean += value;
    maxStep = Math.max(maxStep, Math.abs(value - previous)); previous = value;
  }
  if (peak <= .01 || peak > .23 || bytes.readInt16LE(44) || bytes.readInt16LE(bytes.length - 2)) {
    throw Error('Peak or silent-edge validation failed');
  }
  return { duration: count / rate, peakDbfs: +(20 * Math.log10(peak)).toFixed(2),
    rmsDbfs: +(10 * Math.log10(energy / count)).toFixed(2), dc: +(mean / count).toFixed(8),
    maxSampleStep: +maxStep.toFixed(6), sha256: createHash('sha256').update(bytes).digest('hex') };
}

export function renderSounds(gain = 1) {
  if (!Number.isFinite(gain) || gain <= 0 || gain > 1) throw Error('Gain must be in (0, 1]');
  return cues.map((cue, index) => {
    const samples = render(cue, index).map(value => value * gain);
    const bytes = encodeWav(samples);
    return { ...cue, samples, bytes, metrics: measure(bytes) };
  });
}

async function writePreview() {
await mkdir(output, { recursive: true });
const pack = renderSounds();
const files = [], rendered = [], timeline = [];
let cursor = Math.round(.3 * rate);
for (let index = 0; index < cues.length; index++) {
  const cue = cues[index], { samples, bytes } = pack[index];
  const file = `${String(index + 1).padStart(2, '0')}-${cue.id}.wav`;
  await writeFile(path.join(output, file), bytes);
  files.push({ ...cue, file, bytes: bytes.length, ...measure(bytes), data: bytes.toString('base64') });
  rendered.push(samples);
  timeline.push({ id: cue.id, label: cue.label, start: cursor / rate, end: (cursor + samples.length) / rate });
  cursor += samples.length + Math.round(.65 * rate);
}
const sampler = new Float64Array(cursor);
rendered.forEach((samples, i) => sampler.set(samples, Math.round(timeline[i].start * rate)));
const samplerBytes = encodeWav(sampler);
await writeFile(path.join(output, '00-full-preview.wav'), samplerBytes);
const manifest = { title: 'Soft Garden v1 — 原创合成试听', status: 'audition-only',
  provenance: 'Locally synthesized from mathematical oscillators and seeded noise. No external samples or game audio.',
  generator: 'design/audio/soft-garden-v1/generate.mjs', sampleRate: rate, channels: 1, bitsPerSample: 16,
  verification: 'PCM edges, level, finiteness and browser decoding checked separately from subjective listening.',
  files: files.map(({ data, ...info }) => info), sampler: { file: '00-full-preview.wav', ...measure(samplerBytes), timeline } };
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const cards = files.map((cue, index) => `<article><div class="number">${String(index + 1).padStart(2, '0')}</div><div class="body"><h2>${cue.label}<code>${cue.id}</code></h2><p>${cue.description}</p><audio controls preload="metadata" src="data:audio/wav;base64,${cue.data}"></audio><footer>${Math.round(cue.duration * 1000)} ms <a href="data:audio/wav;base64,${cue.data}" download="${cue.file}">下载 WAV ↓</a></footer></div></article>`).join('\n');
await writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Soft Garden · 原创音效试听</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f6f3e9;color:#354d40;font:15px/1.6 system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:56px 24px 48px}.eyebrow{font-size:12px;letter-spacing:3px;color:#748b73}h1{font-size:42px;letter-spacing:-1px;margin:9px 0 12px;font-weight:650}header p{max-width:620px;color:#6b786a;margin:0 0 26px}.sampler{background:#e3e9d8;padding:22px 26px;border-radius:24px;margin:0 0 28px}.sampler strong{display:block;margin-bottom:12px}audio{width:100%;height:36px}.sequence{font-size:12px;color:#67785d;margin:12px 0 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}article{display:flex;gap:16px;background:#fffef8;border:1px solid #e7e6d8;border-radius:20px;padding:22px}.number{font:13px ui-monospace,monospace;color:#94a383;padding-top:5px}.body{flex:1;min-width:0}h2{font-size:19px;margin:0;display:flex;justify-content:space-between;align-items:center;gap:8px}code{font:11px ui-monospace,monospace;color:#899580}article p{font-size:13px;color:#798374;margin:7px 0 16px}footer{display:flex;justify-content:space-between;font-size:11px;color:#8c9584;margin-top:12px}a{color:#627d50;text-decoration:none}.note{font-size:12px;color:#89917f;margin-top:22px}@media(max-width:600px){main{padding:30px 16px}h1{font-size:34px}.grid{grid-template-columns:1fr}article{padding:18px}.sampler{padding:20px}}</style>
<main><header><div class="eyebrow">LOCAL SOUND STUDY · 01</div><h1>软木与小气泡</h1><p>十段原创交互音效。用短促的木质音、圆润的气泡和一点轻快的旋律，试试更温暖的操作反馈。</p></header><section class="sampler"><strong>整套串听 <span id="now" style="font-size:13px;font-weight:400;margin-left:12px"></span></strong><audio id="sampler" controls preload="metadata" src="data:audio/wav;base64,${samplerBytes.toString('base64')}"></audio><p class="sequence">${cues.map(cue => cue.label).join(' → ')}</p></section><div class="grid">${cards}</div><p class="note">全部在本地合成 · 48 kHz / 16-bit WAV · 试听版本</p></main>
<script>const timeline=${JSON.stringify(timeline)};const all=[...document.querySelectorAll('audio')];all.forEach(audio=>{audio.volume=.7;audio.addEventListener('play',()=>all.forEach(other=>{if(other!==audio)other.pause()}))});const sampler=document.getElementById('sampler');sampler.addEventListener('timeupdate',()=>{const cue=timeline.find(c=>sampler.currentTime>=c.start&&sampler.currentTime<c.end);document.getElementById('now').textContent=cue?cue.label+' · '+cue.id:''});</script></html>`);
console.log(JSON.stringify({ output, count: files.length, samplerSeconds: sampler.length / rate,
  files: files.map(({ id, duration, peakDbfs }) => ({ id, duration, peakDbfs })) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await writePreview();
