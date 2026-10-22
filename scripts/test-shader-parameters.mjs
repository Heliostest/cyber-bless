// Real WebGL parameter changes plus the complete Shader Lab browser path.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/").replace(/\/$/, "");
const base = process.env.WBR_URL ?? "http://127.0.0.1:5173";
const output = `${root}/artifacts/shader-parameters-review`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${base}/scene-review?scene=blang-tea`);
  await page.locator('canvas[data-environment-ready="true"]').waitFor();
  await page.getByRole("button", { name: /SHADER LAB/ }).click();
  await page.getByRole("status").filter({ hasText: "正在使用柔和卡通" }).waitFor();
  assert.equal(await page.getByRole("slider").count(), 0);
  await page.getByRole("button", { name: "网点印刷", exact: false }).click();
  await page.getByRole("slider", { name: "网点大小", exact: true }).fill("10");
  await page.getByRole("slider", { name: "效果强度", exact: true }).fill("0.85");
  const dots = page.getByRole("slider", { name: "网点大小", exact: true });
  const bounds = await dots.boundingBox();
  assert.ok(bounds, "dot slider is outside the panel");
  await page.mouse.move(bounds.x + bounds.width*0.57, bounds.y + bounds.height/2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width*0.2, bounds.y + bounds.height/2, { steps: 8 });
  await page.mouse.up();
  assert.notEqual(await dots.inputValue(), "10", "pointer dragging did not change dot size");
  await dots.fill("10");
  await page.screenshot({ path: `${output}/halftone-desktop.png` });
  await page.getByRole("button", { name: "复古像素", exact: false }).click();
  assert.equal(await page.getByRole("slider").count(), 1);
  await page.getByRole("slider", { name: "像素大小", exact: true }).fill("8");
  await page.reload();
  await page.getByRole("button", { name: /SHADER LAB/ }).click();
  await page.getByRole("status").filter({ hasText: "正在使用复古像素" }).waitFor();
  assert.equal(await page.getByRole("slider", { name: "像素大小", exact: true }).inputValue(), "8");
  await page.getByRole("button", { name: "重置参数", exact: true }).click();
  assert.equal(await page.getByRole("slider").inputValue(), "3");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("slider").fill("12");
  await page.getByRole("slider").focus(); await page.keyboard.press("Home");
  assert.equal(await page.getByRole("slider").inputValue(), "1");
  await page.keyboard.press("End");
  assert.equal(await page.getByRole("slider").inputValue(), "12");
  await page.screenshot({ path: `${output}/pixel-mobile.png` });
  await page.getByRole("button", { name: "网点印刷", exact: false }).click();
  assert.equal(await page.getByRole("slider", { name: "网点大小", exact: true }).inputValue(), "10");
  await page.getByRole("button", { name: "重置参数", exact: true }).click();
  assert.equal(await page.getByRole("slider", { name: "效果强度", exact: true }).inputValue(), "0.58");
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const preset of [
    { label: "Moebius 手绘漫画", controls: [["描边粗细", "2.5"], ["色阶", "4"], ["排线强度", "0.8"]], image: "moebius-desktop" },
    { label: "卡通描边", controls: [["描边粗细", "3"], ["色阶", "6"]], image: "toon-desktop" },
  ]) {
    await page.getByRole("button", { name: preset.label, exact: false }).click();
    assert.equal(await page.getByRole("slider").count(), preset.controls.length);
    for (const [name, value] of preset.controls) await page.getByRole("slider", { name, exact: true }).fill(value);
    await page.reload();
    await page.getByRole("button", { name: /SHADER LAB/ }).click();
    await page.getByRole("status").filter({ hasText: `正在使用${preset.label}` }).waitFor();
    for (const [name, value] of preset.controls) assert.equal(await page.getByRole("slider", { name, exact: true }).inputValue(), value);
    await page.screenshot({ path: `${output}/${preset.image}.png` });
  }
  await page.getByRole("button", { name: "Moebius 手绘漫画", exact: false }).click();
  assert.equal(await page.getByRole("slider", { name: "排线强度", exact: true }).inputValue(), "0.8");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("slider", { name: "描边粗细", exact: true }).fill("3");
  await page.getByRole("slider", { name: "排线强度", exact: true }).fill("0");
  await page.screenshot({ path: `${output}/moebius-mobile.png` });
  await page.getByRole("button", { name: "重置参数", exact: true }).click();
  assert.equal(await page.getByRole("slider", { name: "描边粗细", exact: true }).inputValue(), "0.85");
  assert.equal(await page.getByRole("slider", { name: "色阶", exact: true }).inputValue(), "8");
  assert.equal(await page.getByRole("slider", { name: "排线强度", exact: true }).inputValue(), "0.5");
  await page.getByRole("button", { name: "卡通描边", exact: false }).click();
  assert.equal(await page.getByRole("slider", { name: "描边粗细", exact: true }).inputValue(), "3");
  await page.screenshot({ path: `${output}/toon-mobile.png` });
  await page.getByRole("button", { name: "重置参数", exact: true }).click();
  assert.equal(await page.getByRole("slider", { name: "描边粗细", exact: true }).inputValue(), "1");
  assert.equal(await page.getByRole("slider", { name: "色阶", exact: true }).inputValue(), "3");
  await page.getByRole("button", { name: "恢复内容默认", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "正在使用柔和卡通" }).waitFor();
  assert.equal(await page.getByRole("slider").count(), 0);
  await page.reload();
  await page.getByRole("button", { name: /SHADER LAB/ }).click();
  await page.getByRole("status").filter({ hasText: "正在使用柔和卡通" }).waitFor();
  assert.deepEqual(errors, []);
  console.log("Shader Lab controls: live input, style isolation, reload, reset, desktop and mobile passed");

  const fixture = await browser.newPage();
  await fixture.route("**/__parameter_probe", route => route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }));
  await fixture.goto(`${base}/__parameter_probe`);
  const gpu = await fixture.evaluate(async module => {
    const source = await (await fetch(module)).text();
    const THREE = await import(source.match(/import \* as THREE from "([^"]+)"/)[1]);
    const { createRenderStyle } = await import(module);
    const renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1.5); renderer.setSize(200, 200); renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 10);
    camera.position.z = 4;
    const geometry = new THREE.SphereGeometry(.75, 32, 24);
    const material = new THREE.MeshStandardMaterial({ color: 0xbd5e4d, roughness: .8 });
    scene.add(new THREE.Mesh(geometry, material), new THREE.AmbientLight(0xffffff, .7));
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(-2, 3, 4); scene.add(sun);
    const style = createRenderStyle(renderer, scene, camera), gl = renderer.getContext();
    const check = (condition, message) => { if (!condition) throw Error(message); };
    const frame = () => {
      style.render();
      const data = new Uint8Array(300*300*4);
      gl.readPixels(0, 0, 300, 300, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    };
    const center = (data) => [...data.slice((150*300+150)*4, (150*300+150)*4+4)];
    const different = (a, b) => a.some((value, i) => i%4 !== 3 && Math.abs(value-b[i]) > 5);
    const original = frame();
    style.setStyle("halftone"); style.setParameters({ halftoneStrength: 0 });
    const zero = center(frame());
    check(zero.every((value, i) => Math.abs(value-center(original)[i]) <= 2), "zero strength does not restore original color");
    style.setParameters({ halftoneStrength: 1, halftoneSize: 2 }); const fine = frame();
    check(different(fine, original), "halftone strength has no visible effect");
    style.setParameters({ halftoneSize: 16 }); const coarse = frame();
    check(different(coarse, fine), "dot size has no visible effect");
    let textures = renderer.info.memory.textures;
    for (const size of [2, 16, 4, 8, 2]) { style.setParameters({ halftoneSize: size }); frame(); }
    check(renderer.info.memory.textures === textures, "halftone tuning allocated more textures");
    style.setStyle("pixel-art"); style.setParameters({ pixelSize: 1 }); const small = frame();
    style.setParameters({ pixelSize: 12 }); const large = frame();
    check(different(small, large), "pixel size has no visible effect");
    check(large[3] === 0 && center(large)[3] === 255, "pixel tuning damaged alpha");
    textures = renderer.info.memory.textures;
    for (const size of [1, 12, 3, 8, 1]) { style.setParameters({ pixelSize: size }); frame(); }
    check(renderer.info.memory.textures === textures, "pixel tuning leaked textures");
    check(style.getStyle() === "pixel-art", "parameter tuning silently fell back");
    style.setStyle("moebius"); style.setParameters({ moebiusWidth: 0.25, hatchStrength: 0 }); const fineInk = frame();
    style.setParameters({ moebiusWidth: 3 }); const boldInk = frame();
    check(different(fineInk, boldInk), "Moebius line width has no visible effect");
    style.setParameters({ moebiusLevels: 2 }); const fewTones = frame();
    style.setParameters({ moebiusLevels: 12 }); const manyTones = frame();
    check(different(fewTones, manyTones), "Moebius levels have no visible effect");
    style.setParameters({ hatchStrength: 1 }); const hatched = frame();
    check(different(hatched, manyTones), "hatch strength has no visible effect");
    textures = renderer.info.memory.textures;
    for (const level of [2, 12, 8, 4, 8]) { style.setParameters({ moebiusLevels: level, hatchStrength: level/12 }); frame(); }
    check(renderer.info.memory.textures === textures, "Moebius tuning allocated more textures");
    check(style.getStyle() === "moebius", "Moebius tuning silently fell back");
    style.setStyle("toon-outline"); style.setParameters({ toonWidth: 0.5 }); const thin = frame();
    style.setParameters({ toonWidth: 4 }); const thick = frame();
    check(different(thin, thick), "toon line width has no visible effect");
    const darkRimCount = data => {
      let count = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i+3] > 100 && data[i] < 70 && data[i+1] < 70 && data[i+2] < 70) count++;
      return count;
    };
    check(darkRimCount(thick) > darkRimCount(thin)*1.2, "thicker contour did not cover a wider rim");
    style.setParameters({ toonLevels: 2 }); const two = frame();
    style.setParameters({ toonLevels: 8 }); const eight = frame();
    check(different(two, eight), "toon levels have no visible effect");
    textures = renderer.info.memory.textures;
    for (const level of [2, 8, 3, 5, 3]) { style.setParameters({ toonLevels: level }); frame(); }
    check(renderer.info.memory.textures === textures, "toon level tuning leaked textures");
    check(style.getStyle() === "toon-outline", "toon tuning silently fell back");
    check(center(eight)[3] === 255 && eight[3] === 0, "comic tuning damaged alpha");
    style.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss();
    return { zeroStrength: "original color", halftoneSize: "visible", halftoneStrength: "visible", pixelSize: "visible",
      moebiusWidth: "visible", moebiusLevels: "visible", hatchStrength: "visible", toonWidth: "wider rim", toonLevels: "visible",
      alpha: "preserved", textures: "stable at repeated sizes and levels", dpr: 1.5 };
  }, `/@fs/${root}/packages/scene-runtime/src/render-style.ts`);
  await writeFile(`${output}/report.json`, JSON.stringify({ ui: "passed", gpu, errors }, null, 2));
  console.log("WebGL parameters passed", gpu);
} finally { await browser.close(); }
