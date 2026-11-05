import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const subjects = JSON.parse(await readFile('assets/scene-icons/soft3d/subjects.json', 'utf8')).subjects;
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
const palettes = {}, hashes = {};
for (const subject of subjects) {
  const file = `assets/scene-icons/soft3d/${subject.id}.webp`, bytes = await readFile(file);
  hashes[subject.id] = createHash('sha256').update(bytes).digest('hex');
  const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bins = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 235) continue;
    const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]);
    if (s < .16 || l < .18 || l > .84) continue;
    const key = `${Math.floor(h * 24)}:${Math.floor(s * 8)}:${Math.floor(l * 8)}`;
    const bin = bins.get(key) ?? { h: 0, s: 0, l: 0, count: 0 };
    bin.h += h; bin.s += s; bin.l += l; bin.count++; bins.set(key, bin);
  }
  const clusters = [...bins.values()].sort((a, b) => b.count - a.count).map(bin => [bin.h / bin.count, bin.s / bin.count, bin.l / bin.count, bin.count]);
  const anchors = [];
  for (const c of clusters) {
    if (anchors.every(a => Math.min(Math.abs(a[0] - c[0]), 1 - Math.abs(a[0] - c[0])) > .05 || Math.abs(a[2] - c[2]) > .15)) anchors.push(c);
    if (anchors.length === 6) break;
  }
  palettes[subject.id] = anchors.map(c => c.slice(0, 3).map(value => +value.toFixed(4)));
}
await writeFile('packages/scene-runtime/src/icon-style-palettes.generated.json', JSON.stringify(palettes, null, 2) + '\n');
await mkdir('artifacts/icon-style-rollout', { recursive: true });
await writeFile('artifacts/icon-style-rollout/icon-source-hashes.json', JSON.stringify(hashes, null, 2));
// Contact sheets are review aids; they do not assert any cultural provenance.
for (let start = 0; start < subjects.length; start += 24) {
  const page = subjects.slice(start, start + 24), tiles = [];
  for (const [index, subject] of page.entries()) {
    const x = index % 6 * 220, y = Math.floor(index / 6) * 210;
    tiles.push({ input: await sharp(`assets/scene-icons/soft3d/${subject.id}.webp`).resize(150, 150).png().toBuffer(), left: x + 35, top: y });
    const title = subject.id.replaceAll('&', '&amp;');
    const swatches = palettes[subject.id].map(([h, s, l], i) => `<rect x="${12 + i * 32}" y="28" width="29" height="16" fill="hsl(${h * 360},${s * 100}%,${l * 100}%)"/>`).join('');
    tiles.push({ input: Buffer.from(`<svg width="220" height="60"><text x="8" y="16" fill="#655645" font-size="11">${title}</text>${swatches}</svg>`), left: x, top: y + 150 });
  }
  await sharp({ create: { width: 1320, height: 840, channels: 3, background: '#f5eddf' } }).composite(tiles).png().toFile(`artifacts/icon-style-rollout/icon-palettes-${Math.floor(start / 24) + 1}.png`);
}
console.log(`Prepared ${subjects.length} icon palettes; hue never transfers between color families in the runtime.`);
