// Native counterpart of packages/app/src/style.css --dots. The three PNGs
// describe the same 24pt tile; Metro selects the device's image density.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const css = await readFile(new URL('../packages/app/src/style.css', import.meta.url), 'utf8');
const color = name => {
  const match = css.match(new RegExp(`${name}: (#[0-9a-f]{6});`));
  assert.ok(match, `Missing CSS color ${name}`);
  return match[1];
};
// Fail rather than silently producing stale native geometry if --dots changes.
assert.match(css, /--dots:\s*radial-gradient\(var\(--island-dot\) 2\.6px, transparent 3\.2px\) 0 0 \/ 24px 24px,\s*radial-gradient\(#ffffffa6 1\.6px, transparent 2\.2px\) 12px 12px \/ 24px 24px;/);
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <defs>
    <radialGradient id="green"><stop offset="81.25%" stop-color="${color('--island-dot')}"/><stop offset="100%" stop-color="${color('--island-dot')}" stop-opacity="0"/></radialGradient>
    <radialGradient id="white"><stop offset="72.7272727%" stop-color="white" stop-opacity="${166 / 255}"/><stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient>
  </defs>
  <path fill="${color('--island')}" d="M0 0h24v24H0z"/>
  <circle cx="12" cy="12" r="3.2" fill="url(#green)"/>
  <g fill="url(#white)"><circle cx="0" cy="0" r="2.2"/><circle cx="24" cy="0" r="2.2"/><circle cx="0" cy="24" r="2.2"/><circle cx="24" cy="24" r="2.2"/></g>
</svg>`);
for (const scale of [1, 2, 3]) {
  const suffix = scale === 1 ? '' : `@${scale}x`;
  const file = new URL(`../apps/mobile-expo/assets/island-dots${suffix}.png`, import.meta.url);
  await sharp(svg, { density: 72 * scale }).png().toFile(fileURLToPath(file));
  console.log(`Generated ${file.pathname.split('/').pop()} (${24 * scale}px, 24pt).`);
}
