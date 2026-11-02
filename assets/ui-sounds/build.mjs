// Rebuild from the already downloaded Kenney Interface Sounds 1.0 package.
// Uses the repository's existing Playwright and installed Edge; no audio tools
// or native runtime dependencies are added to the app.
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const output = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] || path.join(output, '../../artifacts/ui-sounds/kenney-interface'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const choices = [
  { sound: 'navigate', original: 'pluck_001.ogg', maxDuration: .12, peak: .032 },
  { sound: 'back', original: 'pluck_002.ogg', maxDuration: .14, peak: .032 },
  { sound: 'select', original: 'select_001.ogg', minDuration: .06, peak: .032 },
  { sound: 'open', original: 'open_001.ogg', maxDuration: .18, peak: .032 },
  { sound: 'close', original: 'close_001.ogg', maxDuration: .18, peak: .032 },
  { sound: 'toggleOn', original: 'toggle_001.ogg', maxDuration: .14, peak: .032 },
  { sound: 'toggleOff', original: 'toggle_002.ogg', maxDuration: .14, peak: .032 },
  { sound: 'notice', original: 'question_002.ogg', maxDuration: .22, peak: .028 },
];
function wav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
const browser = await chromium.launch({ channel: process.env.WBR_BROWSER || 'msedge', headless: true, args: ['--no-proxy-server'] });
const sounds = [];
try {
  const page = await browser.newPage();
  for (const choice of choices) {
    const original = await readFile(path.join(source, 'Audio', choice.original));
    const result = await page.evaluate(async input => {
      const rate = 24000;
      const original = Uint8Array.from(atob(input.data), char => char.charCodeAt(0));
      const decoder = new OfflineAudioContext(1, 1, 44100);
      const decoded = await decoder.decodeAudioData(original.buffer);
      const duration = Math.min(input.maxDuration ?? Infinity, Math.max(input.minDuration ?? 0, decoded.duration));
      const length = Math.ceil(duration * rate);
      const context = new OfflineAudioContext(1, length, rate);
      const source = context.createBufferSource(); source.buffer = decoded;
      const lowpass = context.createBiquadFilter();
      lowpass.type = 'lowpass'; lowpass.frequency.value = 3600; lowpass.Q.value = .65;
      source.connect(lowpass); lowpass.connect(context.destination); source.start(0);
      const rendered = await context.startRendering();
      const samples = rendered.getChannelData(0);
      let peak = 0;
      for (let i = 0; i < samples.length; i++) {
        // Apply the edge envelope after filtering so the filtered tail also
        // reaches exact silence at the file boundary.
        samples[i] *= Math.min(1, i / (rate * .004), (samples.length - 1 - i) / (rate * .012));
        peak = Math.max(peak, Math.abs(samples[i]));
      }
      if (!Number.isFinite(peak) || peak < .000001) throw Error('Source is silent or invalid');
      const pcm = new Uint8Array(samples.length * 2), view = new DataView(pcm.buffer);
      let measuredPeak = 0, energy = 0, maxStep = 0, previous = 0;
      for (let i = 0; i < samples.length; i++) {
        const value = Math.round(samples[i] * input.peak / peak * 32767);
        view.setInt16(i * 2, value, true);
        const quantized = value / 32768;
        measuredPeak = Math.max(measuredPeak, Math.abs(quantized)); energy += quantized * quantized;
        maxStep = Math.max(maxStep, Math.abs(quantized - previous)); previous = quantized;
      }
      let binary = '';
      for (let i = 0; i < pcm.length; i += 8192) binary += String.fromCharCode(...pcm.subarray(i, i + 8192));
      return {
        pcm: btoa(binary), sampleRate: rate, frames: samples.length, duration: samples.length / rate,
        peak: measuredPeak, rms: Math.sqrt(energy / samples.length), maxSampleStep: maxStep,
        original: { duration: decoded.duration, sampleRate: decoded.sampleRate, channels: decoded.numberOfChannels },
      };
    }, { ...choice, data: original.toString('base64') });
    const { pcm, original: properties, ...metrics } = result;
    const file = `ui-sounds/${choice.sound}.wav`;
    const bytes = wav(Buffer.from(pcm, 'base64'), metrics.sampleRate);
    await writeFile(path.join(output, `${choice.sound}.wav`), bytes);
    sounds.push({ sound: choice.sound, file, bytes: bytes.length, sha256: hash(bytes), ...metrics,
      original: { file: `Audio/${choice.original}`, bytes: original.length, sha256: hash(original), ...properties } });
  }
} finally { await browser.close(); }
const license = await readFile(path.join(source, 'License.txt'));
await copyFile(path.join(source, 'License.txt'), path.join(output, 'License.txt'));
const manifest = {
  title: 'Kenney Interface Sounds', version: '1.0', author: 'Kenney',
  sourceUrl: 'https://kenney.nl/assets/interface-sounds', license: 'CC0-1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  licenseFile: { file: 'ui-sounds/License.txt', bytes: license.length, sha256: hash(license) },
  sourceZipSha256: 'f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232',
  processing: { decoder: 'Microsoft Edge Web Audio', channels: 1, sampleRate: 24000, bitDepth: 16,
    lowpassHz: 3600, lowpassQ: .65, attackMs: 4, releaseMs: 12,
    normalization: 'peak .032, notice .028; quantized to signed 16-bit PCM',
    edits: 'Back cropped to 140ms; select padded to 60ms; notice cropped to 220ms; other clips retain decoded duration.' },
  verification: 'Signal metrics and offline bundling only; no claim of subjective listening or physical-device silent-switch validation.',
  totalWavBytes: sounds.reduce((total, sound) => total + sound.bytes, 0), sounds,
};
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ totalWavBytes: manifest.totalWavBytes, sounds: sounds.map(({ sound, duration, peak, rms, maxSampleStep }) => ({ sound, duration, peak, rms, maxSampleStep })) }, null, 2));
