import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Real WebGL regression: wrapped canopy diffuse light must not create white
// GGX highlights where outward clump normals face away from light and camera.
const base = process.env.WBR_URL || 'http://127.0.0.1:5190';
const out = path.resolve('artifacts/tree-foliage');
await mkdir(out, { recursive: true });
const executablePath = [process.env.WBR_CHROME, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && existsSync(file));
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--no-proxy-server'] });
const report = { cases: [], errors: [] };
try {
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto(`${base}/scene-review?scene=chinese-diabolo`, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async urls => {
    const source = await (await fetch(urls.trees)).text();
    const THREE = await import(source.match(/from\s+["']([^"']*three[^"']*)["']/)[1]);
    const { createTreeRendering } = await import(urls.trees), { createRenderStyle } = await import(urls.style);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setSize(600, 600);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#4aace4');
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 50);
    camera.position.set(0, 1.6, 4.6); camera.lookAt(0, 1.25, 0);
    scene.add(new THREE.HemisphereLight('#d8eeff', '#b9ad8b', .6));
    const sun = new THREE.DirectionalLight('#fff4e5', 3.8); sun.position.set(-6, 9, 5); scene.add(sun);
    const original = new THREE.Mesh(new THREE.BoxGeometry(.2, 2, .2), new THREE.MeshStandardMaterial({ color: '#63884a' }));
    original.position.y = 1; scene.add(original);
    const style = createRenderStyle(renderer, scene, camera), cases = [];
    try {
      // Include both seed variants: their outward normals cover different
      // back-facing/grazing angles, which a shader compile test cannot detect.
      for (const method of ['toona', 'acer', 'maple', 'simple-tree', 'cherry', 'willow', 'cypress', 'conifer']) {
        for (const variant of ['round', 'cluster']) {
          let loaded;
          const trees = createTreeRendering([original], [{ x: 0, z: 0, scale: 2.5, turn: 0, variant }], 0, { onChange: value => { loaded = value; } });
          scene.add(trees.root);
          try {
            await trees.select(method);
            if (loaded?.status !== 'ready' || loaded.actual !== method) throw Error(`Tree failed to load: ${method}/${variant}`);
            for (const active of ['original', 'toon-soft']) {
              style.setStyle(active); style.render();
              const gl = renderer.getContext(), pixels = new Uint8Array(600 * 600 * 4);
              gl.readPixels(0, 0, 600, 600, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
              let white = 0, transparent = 0, foreground = 0;
              for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i] > 240 && pixels[i + 1] > 240 && pixels[i + 2] > 240) white++;
                if (pixels[i + 3] < 250) transparent++;
                // Blue background stays blue after tone mapping, all authored
                // tree palettes in this fixture have less blue than red/green.
                if (pixels[i + 2] < Math.max(pixels[i], pixels[i + 1])) foreground++;
              }
              cases.push({ method, variant, active, actual: style.getStyle(), white, transparent, foreground,
                image: renderer.domElement.toDataURL('image/png').split(',')[1] });
            }
          } finally { trees.dispose(); scene.remove(trees.root); }
        }
      }
    } finally { style.dispose(); original.geometry.dispose(); original.material.dispose(); renderer.dispose(); }
    return cases;
  }, Object.fromEntries(Object.entries({ trees: 'packages/scene-runtime/src/imported-trees.ts', style: 'packages/scene-runtime/src/render-style.ts' })
    .map(([key, value]) => [key, '/@fs/' + path.resolve(value).replaceAll('\\', '/')])));
  for (const { image, ...entry } of result) {
    await writeFile(path.join(out, `${entry.method}-${entry.variant}-${entry.active}.png`), Buffer.from(image, 'base64'));
    report.cases.push(entry);
  }
  assert.deepEqual(report.errors, []);
  for (const entry of report.cases) {
    const label = `${entry.method}/${entry.variant}/${entry.active}`;
    assert.equal(entry.actual, entry.active, `${label}: shader must render without fallback`);
    assert.ok(entry.foreground > 2000, `${label}: actual tree must be visible`);
    assert.equal(entry.transparent, 0, `${label}: cutout gaps show the opaque blue background`);
    assert.ok(entry.white <= 10, `${label}: matte colored foliage must not blow out to white (${entry.white} pixels)`);
  }
} finally {
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(report));
