// Real WebGL parameter effects, alpha and texture lifecycle.
// App controls are covered by visual-style-menu.test.ts and verify-visual-style-filmstrip.mjs.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/").replace(/\/$/, "");
const base = process.env.WBR_URL ?? "http://127.0.0.1:5173";
const output = `${root}/artifacts/shader-parameters-review`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const errors = [];
  const fixture = await browser.newPage();
  fixture.on("pageerror", error => errors.push(error.message));
  fixture.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
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
  await writeFile(`${output}/report.json`, JSON.stringify({ gpu, errors }, null, 2));
  if (errors.length) throw Error(errors.join("\n"));
  console.log("WebGL parameters passed", gpu);
} finally { await browser.close(); }
