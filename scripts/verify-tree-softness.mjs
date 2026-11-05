import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.WBR_URL || 'http://127.0.0.1:5190', out = path.resolve('artifacts/tree-softness');
await mkdir(out, { recursive: true });
const executablePath = [process.env.WBR_CHROME, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && existsSync(file));
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--no-proxy-server'] });
let report;
try {
  const page = await browser.newPage(); await page.goto(base);
  report = await page.evaluate(async urls => {
    const source = await (await fetch(urls.trees)).text();
    const THREE = await import(source.match(/from\s+["']([^"']*three[^"']*)["']/)[1]);
    const { createTreeRendering } = await import(urls.trees), { createToonSurfaces } = await import(urls.surfaces);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(64, 64);
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1.2, 1.2, 1.2, -1.2, .1, 20);
    camera.position.set(0, 1, 4); camera.lookAt(0, 1, 0);
    scene.add(new THREE.AmbientLight(0xffffff, .1));
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(0, 3, 8); scene.add(sun);
    const geometry = new THREE.PlaneGeometry(2, 2), front = geometry.index.array.slice();
    const material = new THREE.MeshStandardMaterial({ color: '#66ae73', side: THREE.DoubleSide, alphaTest: .5, roughness: 1 });
    const model = new THREE.Group(), leaf = new THREE.Mesh(geometry, material); leaf.position.y = 1; model.add(leaf);
    const trees = createTreeRendering([], [{ x: 0, z: 0, scale: 2, turn: 0, variant: 'round' }], 0, { load: async () => model });
    scene.add(trees.root); const cases = [];
    const pixel = () => {
      renderer.render(scene, camera); const value = new Uint8Array(4), gl = renderer.getContext();
      gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, value); return [...value.slice(0, 3)];
    };
    const reverse = () => { for (let i = 0; i < front.length; i += 3) geometry.index.array.set([front[i], front[i + 2], front[i + 1]], i); geometry.index.needsUpdate = true; };
    const reset = () => { geometry.index.array.set(front); geometry.index.needsUpdate = true; };
    try {
      scene.add(model); reset(); const plainFront = pixel(); reverse(); const plainBack = pixel(); reset(); model.removeFromParent();
      await trees.select('simple-tree');
      for (const style of ['original', 'toon-soft', 'toon-ink', 'gouache']) {
        const surfaces = style === 'original' ? undefined : createToonSurfaces(style), frame = surfaces?.apply(scene);
        reset(); const frontColor = pixel(); reverse(); const backColor = pixel(); reset();
        cases.push({ style, front: frontColor, back: backColor, difference: Math.max(...frontColor.map((value, i) => Math.abs(value - backColor[i]))) });
        frame?.restore(); surfaces?.dispose();
      }
      return { plainFront, plainBack, cases };
    } finally { trees.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  }, Object.fromEntries(Object.entries({ trees: 'packages/scene-runtime/src/imported-trees.ts', surfaces: 'packages/scene-runtime/src/toon-surfaces.ts' })
    .map(([key, value]) => [key, '/@fs/' + path.resolve(value).replaceAll('\\', '/')])));
  assert.ok(Math.max(...report.plainFront.map((value, i) => Math.abs(value - report.plainBack[i]))) > 25, 'control reproduces the stock double-sided normal flip');
  for (const item of report.cases) assert.ok(item.difference <= 2, `${item.style}: cluster normals should light both card faces consistently, difference ${item.difference}`);
} finally {
  await writeFile(path.join(out, 'normal-report.json'), JSON.stringify(report ?? {}, null, 2) + '\n'); await browser.close();
}
console.log(JSON.stringify(report));
