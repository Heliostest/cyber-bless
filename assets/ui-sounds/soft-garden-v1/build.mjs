// Rebuild the approved original sound palette using only the checked-in source.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { renderSounds, rate } from '../../../design/audio/soft-garden-v1/generate.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const gain = .45;
const approved = renderSounds();
const sounds = [];
for (const cue of renderSounds(gain)) {
  const file = `ui-sounds/soft-garden-v1/${cue.id}.wav`;
  await writeFile(new URL(`${cue.id}.wav`, import.meta.url), cue.bytes);
  sounds.push({ sound: cue.id, file, bytes: cue.bytes.length, ...cue.metrics,
    auditionSha256: approved.find(original => original.id === cue.id).metrics.sha256 });
}
const generator = 'design/audio/soft-garden-v1/generate.mjs';
const manifest = {
  title: 'Soft Garden', version: '1', provenance: 'product-original',
  source: 'Local deterministic synthesis: oscillators, envelopes and seeded noise; no third-party samples.',
  generator, generatorSha256: hash(await readFile(new URL(`../../../${generator}`, import.meta.url))),
  processing: { sampleRate: rate, channels: 1, bitDepth: 16, gainFromApprovedAudition: gain,
    edits: 'Uniform attenuation only; approved timbres, timing and relative dynamics retained.' },
  aliases: { notice: 'select' }, totalWavBytes: sounds.reduce((sum, sound) => sum + sound.bytes, 0), sounds,
};
await writeFile(new URL('manifest.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built ${sounds.length} Soft Garden cues (${manifest.totalWavBytes} bytes).`);
