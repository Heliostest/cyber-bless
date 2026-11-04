import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = 'artifacts/toon-cloud/anchor';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.WBR_CHROME ? { executablePath: process.env.WBR_CHROME } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto(process.env.WBR_URL || 'http://127.0.0.1:5177/');
  const report = await page.evaluate(async cloudModule => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { createToonCloudBackdrop } = await import(cloudModule);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.NoToneMapping;
    const scene = new THREE.Scene(), clouds = createToonCloudBackdrop();
    scene.add(clouds.root);
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 40);
    const bufferSize = new THREE.Vector2(), results = [];
    for (const [width, height] of [[284, 320], [350, 480], [768, 400], [1280, 600]]) {
      for (const dpr of [1, 2]) {
        renderer.setPixelRatio(dpr); renderer.setSize(width, height);
        camera.aspect = width / height; camera.updateProjectionMatrix();
        for (const time of [0, 17.5, 120]) {
          clouds.update(time);
          camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
          renderer.getDrawingBufferSize(bufferSize);
          const gl = renderer.getContext(), pixels = new Uint8Array(bufferSize.x * bufferSize.y * 4);
          gl.readPixels(0, 0, bufferSize.x, bufferSize.y, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let first = -1;
          for (let y = bufferSize.y - 1; y >= 0 && first < 0; y--) {
            for (let x = 0; x < bufferSize.x; x++) {
              if (pixels[(y * bufferSize.x + x) * 4 + 3] > 2) { first = (bufferSize.y - 1 - y) / dpr; break; }
            }
          }
          camera.position.set(8, 12, 2); camera.lookAt(-1, -3, 0); camera.fov = 65; camera.updateProjectionMatrix();
          renderer.render(scene, camera);
          const tilted = new Uint8Array(pixels.length);
          gl.readPixels(0, 0, bufferSize.x, bufferSize.y, gl.RGBA, gl.UNSIGNED_BYTE, tilted);
          let cameraChangedAlpha = false;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== tilted[i]) { cameraChangedAlpha = true; break; }
          results.push({ width, height, dpr, time, topCss: first, cameraChangedAlpha });
        }
      }
    }
    // Isolate each actual layer: ordered crests and visible colour/edge steps
    // must survive compositing, rather than only exist as uniform settings.
    // Use a wide canvas so the width fixture measures a full lobe, not a crop.
    const isolatedWidth = 600;
    renderer.setPixelRatio(1); renderer.setSize(isolatedWidth, 480);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const layers = clouds.root.children, layerAppearance = [];
    for (const time of [0, 17.5, 120]) {
      clouds.update(time);
      for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      layers.forEach((layer, i) => { layer.visible = i === layerIndex; });
      renderer.render(scene, camera);
      const pixels = new Uint8Array(isolatedWidth * 480 * 4), gl = renderer.getContext();
      gl.readPixels(0, 0, isolatedWidth, 480, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const rows = [];
      for (let y = 479; y >= 0; y--) {
        let alpha = 0;
        for (let x = 0; x < isolatedWidth; x++) alpha = Math.max(alpha, pixels[(y * isolatedWidth + x) * 4 + 3]);
        rows.push(alpha);
      }
      const maximum = Math.max(...rows);
      const crest = rows.findIndex(value => value > 2), sampleY = 479 - (crest + 24);
      let run = 0, spanCss = 0;
      for (let x = 0; x < isolatedWidth; x++) {
        run = pixels[(sampleY * isolatedWidth + x) * 4 + 3] >= maximum * .5 ? run + 1 : 0;
        spanCss = Math.max(spanCss, run);
      }
      const bottom = isolatedWidth / 2 * 4, alpha = pixels[bottom + 3] / 255;
      const rgb = Array.from(pixels.slice(bottom, bottom + 3), value => value / 255 / alpha);
      layerAppearance.push({ time, layer: layerIndex, topCss: crest, spanCss,
        edgeCss: rows.findIndex(value => value >= maximum * .8) - rows.findIndex(value => value >= maximum * .05),
        luminance: .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] });
      }
    }
    layers.forEach(layer => { layer.visible = true; });
    // Auxiliary outline depth passes replace custom shaders. A sky proxy must
    // remain behind the subject rather than become an opaque origin square.
    renderer.setPixelRatio(1); renderer.setSize(350, 480);
    camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0);
    camera.fov = 40; camera.aspect = 350 / 480; camera.updateProjectionMatrix();
    const depth = new THREE.MeshDepthMaterial();
    scene.overrideMaterial = depth; renderer.render(scene, camera);
    const centreDepth = new Uint8Array(4), gl = renderer.getContext();
    gl.readPixels(175, 240, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, centreDepth);
    scene.overrideMaterial = null; depth.dispose();
    clouds.dispose(); renderer.dispose(); renderer.forceContextLoss();
    return { results, layerAppearance, overrideDepthAlpha: centreDepth[3] };
  }, '/@fs/' + path.resolve('packages/scene-runtime/src/toon-cloud-backdrop.ts').replaceAll('\\', '/'));
  const { results } = report;
  await writeFile(`${out}/pixel-report.json`, JSON.stringify({ ...report, errors }, null, 2));
  for (const result of results) {
    assert.ok(result.topCss >= 47.5 && result.topCss <= 50, JSON.stringify(result));
    assert.equal(result.cameraChangedAlpha, false, JSON.stringify(result));
  }
  assert.equal(report.overrideDepthAlpha, 0, 'sky quads do not occlude the subject in override depth passes');
  assert.ok(report.layerAppearance[0].spanCss >= 85 && report.layerAppearance[0].spanCss <= 110,
    `the upper cloud keeps its original horizontal scale: ${JSON.stringify(report.layerAppearance[0])}`);
  for (let i = 1; i < report.layerAppearance.length; i++) {
    if (report.layerAppearance[i].layer === 0) continue;
    const gap = report.layerAppearance[i].topCss - report.layerAppearance[i - 1].topCss;
    assert.ok(gap >= 20 && gap <= 30, `visible layer crests have open vertical spacing: ${JSON.stringify(report.layerAppearance)}`);
    assert.ok(report.layerAppearance[i].luminance - report.layerAppearance[i - 1].luminance >= .007,
      `neighbouring cloud colours remain distinguishable: ${JSON.stringify(report.layerAppearance)}`);
  }
  for (let i = 0; i < report.layerAppearance.length; i += 6) {
    assert.ok(report.layerAppearance[i + 5].edgeCss <= 4 && report.layerAppearance[i + 5].edgeCss <= report.layerAppearance[i].edgeCss,
      `near clouds are clearer than distant clouds: ${JSON.stringify(report.layerAppearance)}`);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ cases: results.length, minTop: Math.min(...results.map(r => r.topCss)), maxTop: Math.max(...results.map(r => r.topCss)), layerAppearance: report.layerAppearance, overrideDepthAlpha: report.overrideDepthAlpha, errors }));
} finally { await browser.close(); }
