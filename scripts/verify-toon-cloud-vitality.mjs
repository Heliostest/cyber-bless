import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = process.argv[2] || 'artifacts/toon-cloud/vitality';
const palette = process.argv[3] || 'day';
assert.ok(['day', 'night'].includes(palette));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.routeWebSocket('**/*', () => {});
const moduleUrl = file => '/@fs/' + path.resolve(file).replaceAll('\\', '/');
try {
  await page.goto(process.env.WBR_URL || 'http://127.0.0.1:5177/');
  const report = await page.evaluate(async ([cloudUrl, styleUrl, environmentUrl, palette]) => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { createToonCloudBackdrop } = await import(cloudUrl);
    const { createRenderStyle } = await import(styleUrl);
    const { createCozyEnvironment } = await import(environmentUrl);
    const width = 600, height = 320;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(width, height); renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, width / height, .1, 40);
    camera.position.z = 5;
    const clouds = createToonCloudBackdrop(palette), layers = clouds.root.children;
    scene.add(clouds.root);
    const style = createRenderStyle(renderer, scene, camera);
    const read = () => {
      const pixels = new Uint8Array(width * height * 4), gl = renderer.getContext();
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const appearance = [];
    try {
      // Both production routes apply ACES: directly and via the shared composer.
      // A NoToneMapping fixture alone misses the grey-white regression.
      scene.background = new THREE.Color(palette === 'night' ? 0x1b355d : 0x7cc8ef);
      for (const renderStyle of ['original', 'toon-soft']) {
        style.setStyle(renderStyle);
        for (let i = 0; i < layers.length; i++) {
          layers.forEach((layer, j) => { layer.visible = i === j; });
          style.render();
          const pixels = read(), at = (20 * width + width / 2) * 4;
          const rgb = Array.from(pixels.slice(at, at + 3), value => value / 255);
          appearance.push({ style: renderStyle, layer: i, rgb,
            luminance: .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] });
        }
      }
      style.setStyle('original'); renderer.toneMapping = THREE.NoToneMapping;
      scene.background = null;
      const motion = [];
      for (const layerIndex of [0, 5]) {
        layers.forEach((layer, j) => { layer.visible = layerIndex === j; });
        clouds.update(0); style.render(); const first = read();
        clouds.update(2); style.render(); const next = read();
        let bestError = Infinity, displacement = 0;
        // Match rendered alpha contours rather than asserting a speed uniform.
        for (let shift = -50; shift <= 50; shift++) {
          let error = 0;
          for (let y = 40; y < 260; y += 2) for (let x = 60; x < width - 60; x += 2) {
            error += Math.abs(first[(y * width + x) * 4 + 3] - next[(y * width + x + shift) * 4 + 3]);
          }
          if (error < bestError) { bestError = error; displacement = shift; }
        }
        motion.push({ layer: layerIndex, seconds: 2, displacementCss: displacement });
        // Re-rendering a frozen clock must be pixel-identical.
        style.render(); const frozen = read();
        if (next.some((value, index) => value !== frozen[index])) throw new Error('frozen clouds changed');
      }
      // Read the actual environment gradient through both production routes.
      // The HDR remains a lighting source; it must not overwrite the night sky.
      clouds.root.visible = false;
      const environment = createCozyEnvironment(scene, {
        id: palette === 'night' ? 'yeondeunghoe' : 'furin-wind-chime',
        loadSky: async () => new THREE.DataTexture(),
      });
      const skyAppearance = [];
      try {
        await environment.ready;
        scene.getObjectByName('cozy-environment').visible = false;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        for (const renderStyle of ['original', 'toon-soft']) {
          style.setStyle(renderStyle); style.render();
          const pixels = read(), at = ((height - 20) * width + width / 2) * 4;
          const rgb = Array.from(pixels.slice(at, at + 3), value => value / 255);
          skyAppearance.push({ style: renderStyle, rgb,
            luminance: .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] });
        }
      } finally { environment.dispose(); }
      return { palette, appearance, motion, skyAppearance };
    } finally { style.dispose(); clouds.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  }, [moduleUrl('packages/scene-runtime/src/toon-cloud-backdrop.ts'), moduleUrl('packages/scene-runtime/src/render-style.ts'),
    moduleUrl('packages/scene-runtime/src/cozy-environment.ts'), palette]);
  await writeFile(`${out}/report.json`, JSON.stringify({ ...report, errors }, null, 2));
  for (const style of ['original', 'toon-soft']) {
    const samples = report.appearance.filter(sample => sample.style === style);
    if (palette === 'day') {
      assert.ok(samples[0].luminance >= .86, `${style}: distant clouds stay luminous: ${JSON.stringify(samples)}`);
      assert.ok(samples[5].luminance >= .96, `${style}: near clouds stay white: ${JSON.stringify(samples)}`);
    } else {
      assert.ok(samples[0].luminance >= .10 && samples[0].luminance <= .30, `${style}: distant night clouds: ${JSON.stringify(samples)}`);
      assert.ok(samples[5].luminance >= .30 && samples[5].luminance <= .60, `${style}: subdued moonlit clouds: ${JSON.stringify(samples)}`);
    }
    assert.ok(samples[0].rgb[2] - samples[0].rgb[0] >= .08, `${style}: blue shadows retain colour`);
    assert.ok(samples[5].luminance - samples[0].luminance >= .06, `${style}: layers retain depth`);
    for (let i = 1; i < samples.length; i++) assert.ok(samples[i].luminance - samples[i - 1].luminance >= .007,
      `${style}: adjacent bright layers stay distinct: ${JSON.stringify(samples)}`);
  }
  for (const sky of report.skyAppearance) {
    if (palette === 'day') {
      assert.ok(sky.rgb[2] - sky.rgb[0] >= .28 && sky.rgb[2] - sky.rgb[1] >= .08,
        `clear blue daylight sky: ${JSON.stringify(sky)}`);
    } else {
      assert.ok(sky.luminance >= .02 && sky.luminance <= .15 && sky.rgb[2] > sky.rgb[0] * 2,
        `deep blue night sky: ${JSON.stringify(sky)}`);
    }
  }
  assert.ok(Math.abs(report.motion[0].displacementCss) >= 5, JSON.stringify(report.motion));
  assert.ok(Math.abs(report.motion[1].displacementCss) >= 24, JSON.stringify(report.motion));
  assert.ok(Math.abs(report.motion[1].displacementCss) > Math.abs(report.motion[0].displacementCss) * 2, JSON.stringify(report.motion));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ...report, errors }));
} finally { await browser.close(); }
