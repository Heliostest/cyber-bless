// Run against a Vite dev server: WBR_URL=http://127.0.0.1:5173 node scripts/test-gouache-style.mjs
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/").replace(/\/$/, "");
const base = process.env.WBR_URL ?? "http://127.0.0.1:5173";
const target = process.env.WBR_STYLE ?? "gouache";
const labels = { gouache: "水粉插画", moebius: "Moebius 手绘漫画", "toon-outline": "卡通描边", halftone: "网点印刷", "pixel-art": "复古像素" };
assert.ok(target in labels, "unsupported style probe");
const label = labels[target];
const output = `${root}/artifacts/${target}-review`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { fixture: null, scenes: [] };
try {
  const fixture = await browser.newPage();
  await fixture.route("**/__gouache_probe", route => route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }));
  await fixture.goto(`${base}/__gouache_probe`);
  report.fixture = await fixture.evaluate(async ({ module, target }) => {
    const source = await (await fetch(module)).text();
    const THREE = await import(source.match(/import \* as THREE from "([^"]+)"/)[1]);
    const { EffectComposer } = await import(source.match(/from "([^"]*postprocessing[^"]*)"/)[1]);
    const { createRenderStyle } = await import(module);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(240, 180); renderer.setPixelRatio(1.5);
    renderer.setClearColor(0, 0); renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.append(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 240/180, .1, 10);
    camera.position.z = 4;
    const material = new THREE.MeshStandardMaterial({ color: 0xbd5e4d, roughness: .8 });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(.75, 32, 24), material);
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(-2, 3, 4);
    scene.add(sphere, sun, new THREE.AmbientLight(0xffffff, .7));
    const style = createRenderStyle(renderer, scene, camera);
    const check = (condition, message) => { if (!condition) throw Error(message); };
    const pixel = (center) => {
      const gl = renderer.getContext(), value = new Uint8Array(4);
      gl.readPixels(center ? gl.drawingBufferWidth/2 : 0, center ? gl.drawingBufferHeight/2 : 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, value);
      return [...value];
    };
    const pixels = () => {
      const gl = renderer.getContext(), data = new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);
      return data;
    };
    style.render(); const original = pixel(true), originalFrame = pixels();
    style.setStyle(target); style.render();
    check(style.getStyle() === target, `${target} shader silently fell back`);
    const painted = pixel(true);
    check(painted[3] > 250 && pixel(false)[3] === 0, `${target} changed subject/corner alpha`);
    const styledFrame = pixels();
    check(styledFrame.some((v, i) => i%4 !== 3 && Math.abs(v-originalFrame[i]) > 5), `${target} did not change the rendering`);
    check(sphere.material === material, "source material was not restored");
    material.color.set(0x416c9b); style.render(); const animated = pixel(true);
    check(animated[2] > animated[0], "animated source color was lost");
    // A static frame must remain static: the paper texture must not flicker.
    style.render(); check(JSON.stringify(animated) === JSON.stringify(pixel(true)), `static ${target} frame flickers`);
    sphere.visible = false; style.render();
    check(pixel(true)[3] === 0, "hidden geometry left a stale frame");
    sphere.visible = true; style.render();
    renderer.setSize(200, 200); camera.aspect = 1; camera.updateProjectionMatrix(); style.resize(200, 200); style.render();
    check(pixel(false)[3] === 0 && pixel(true)[3] > 250, "resize broke alpha or framing");
    if (target === "moebius") {
      const paperGeometry = new THREE.PlaneGeometry(2, 2);
      const paperMaterial = new THREE.MeshStandardMaterial({ color: 0x48565a, roughness: .9, side: THREE.BackSide });
      const paper = new THREE.Mesh(paperGeometry, paperMaterial); paper.rotation.y = Math.PI;
      sphere.visible = false; scene.add(paper); style.render();
      const gl = renderer.getContext(), region = new Uint8Array(80*60*4);
      gl.readPixels(100, 100, 80, 60, gl.RGBA, gl.UNSIGNED_BYTE, region);
      let inkMin = 255, inkMax = 0;
      for (let i = 0; i < region.length; i += 4) { inkMin = Math.min(inkMin, region[i]); inkMax = Math.max(inkMax, region[i]); }
      check(inkMax-inkMin > 12, "back-facing paper lost its hatching in the normal pass");
      scene.remove(paper); paperGeometry.dispose(); paperMaterial.dispose(); sphere.visible = true;
    }
    if (["moebius", "pixel-art", "toon-outline"].includes(target)) {
      // A nonselected foreground surface must hide ink on selected geometry behind it.
      const coverGeometry = new THREE.PlaneGeometry(20, 20);
      const coverMaterial = new THREE.MeshBasicMaterial({ color: 0x6d8079 });
      // Keep the cover well in front: at z=1 this fixture produces a few mixed
      // color samples even in original rendering, independently of ink visibility.
      const cover = new THREE.Mesh(coverGeometry, coverMaterial); cover.position.z = 2; scene.add(cover);
      style.setStyle("original"); style.render(); const coverOriginal = pixel(true);
      style.setStyle(target);
      if (target === "toon-outline") style.setParameters({ toonWidth: 4 });
      if (target === "moebius") style.setParameters({ moebiusWidth: 3, hatchStrength: 1 });
      style.render();
      const gl = renderer.getContext(), region = new Uint8Array(200*200*4);
      gl.readPixels(50, 50, 200, 200, gl.RGBA, gl.UNSIGNED_BYTE, region);
      for (let channel = 0; channel < 3; channel++) {
        let min = 255, max = 0;
        for (let i = channel; i < region.length; i += 4) { min = Math.min(min, region[i]); max = Math.max(max, region[i]); }
        check(max-min <= 1, `occluded subject ink leaked through a foreground surface (channel ${channel}: ${min}..${max}, ${style.getStyle()})`);
        if (target === "pixel-art") check(Math.abs(pixel(true)[channel]-coverOriginal[channel]) <= 2,
          "a flat foreground surface gained spurious normal-edge brightness");
      }
      scene.remove(cover); coverGeometry.dispose(); coverMaterial.dispose(); style.render();
    }
    const textures = renderer.info.memory.textures;
    for (let i = 0; i < 5; i++) { style.setStyle("toon-soft"); style.render(); style.setStyle(target); style.render(); }
    check(renderer.info.memory.textures <= textures, "style switching leaked textures");
    const draw = EffectComposer.prototype.render;
    try {
      EffectComposer.prototype.render = function() { renderer.autoClear = false; camera.layers.mask = 0; throw Error("injected style failure"); };
      style.render();
      check(style.getStyle() === "original", "effect failure did not recover to original");
      check(camera.layers.mask === 1 && renderer.autoClear && renderer.getRenderTarget() === null, "effect failure left mutated renderer state");
      check(pixel(true)[3] > 250 && sphere.material === material, "recovered original rendering is blank or still adapted");
    } finally { EffectComposer.prototype.render = draw; }
    style.dispose(); sphere.geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss();
    return { original, painted, animated, alpha: "preserved", resize: "passed", switching: "no texture growth", failureRecovery: "passed",
      ...(target === "moebius" ? { backFaces: "passed" } : {}),
      ...(["moebius", "pixel-art", "toon-outline"].includes(target) ? { occlusion: "passed" } : {}) };
  }, { module: `/@fs/${root}/packages/scene-runtime/src/render-style.ts`, target });
  await fixture.close();
  console.log("WebGL fixture passed", report.fixture);

  // Matte carving, fine glazed ornament, real glass, and a warm night flame.
  const selected = process.argv.slice(2).filter(id => !id.startsWith("--"));
  const fixtureOnly = process.argv.includes("--fixture-only");
  for (const id of fixtureOnly ? [] : selected.length ? selected : ["dalarna-wooden-horse", "uzbek-clay-bowl", "andalusian-ceramic-tile", "venetian-glass-bead", "votive-candle-catholic"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`${base}/scene-review?scene=${id}`, { waitUntil: "domcontentloaded" });
    await page.locator('canvas[data-environment-ready="true"]').waitFor();
    await page.getByRole("button", { name: /SHADER LAB/ }).click();
    await page.getByRole("status").filter({ hasText: "正在使用柔和卡通" }).waitFor();
    await page.getByRole("button", { name: /柔和卡通/ }).click();
    await page.getByRole("status").filter({ hasText: "正在使用柔和卡通" }).waitFor();
    await page.getByRole("button", { name: /SHADER LAB/ }).click();
    const canvas = page.locator("canvas[data-environment]");
    await canvas.screenshot({ path: `${output}/${id}-before.png` });
    await page.getByRole("button", { name: /SHADER LAB/ }).click();
    await page.getByRole("button", { name: new RegExp(label) }).click();
    await page.getByRole("status").filter({ hasText: `正在使用${label}` }).waitFor();
    await page.getByRole("button", { name: /SHADER LAB/ }).click();
    await page.screenshot({ path: `${output}/${id}-desktop.png` });
    await canvas.screenshot({ path: `${output}/${id}-after.png` });
    const hint = page.locator(".scene-hint");
    const beforeHint = await hint.innerText();
    await page.locator(".scene-bow-tap").click();
    await page.waitForFunction(before => document.querySelector(".scene-hint")?.textContent !== before, beforeHint);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${output}/${id}-mobile.png` });
    assert.deepEqual(errors, [], `${id}: browser errors`);
    report.scenes.push({ id, defaultStyle: "toon-soft", switching: "passed", interaction: "advanced", desktop: "1280x900", mobile: "390x844", errors });
    console.log(`${id}: default, comparison, interaction and mobile resize passed`);
    await page.close();
  }
  await writeFile(`${output}/${selected.length ? selected.join("+") : "report"}.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally { await browser.close(); }
