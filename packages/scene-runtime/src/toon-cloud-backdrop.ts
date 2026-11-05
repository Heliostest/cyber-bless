/*!
 * @license Toon Cloud — Antoine Clappier, March 2015.
 * Source: https://www.shadertoy.com/view/4t23RR
 * Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International:
 * https://creativecommons.org/licenses/by-nc-sa/4.0/
 * Adapted via Shader Gallery's Three.js mesh layers by Cyber Bless (2026-11-04).
 * Changes: sky depth, viewport-anchored ceiling, open vertical layer spacing,
 * luminous daylight and muted night palettes, depth softness, layer spacing,
 * layered breeze and subtle vertical breathing,
 * motion lifecycle and no input.
 * The adapted cloud shader retains CC BY-NC-SA 4.0.
 * No commercial permission or author endorsement is implied.
 * Full notice is also bundled in environments/LICENSE.txt.
 */
import * as THREE from "three";

const TOP_INSET = 48; // CSS pixels from the scene canvas, independent of DPR/FOV.
const PIXELS_PER_UNIT = 220;
const DRIFT_SPEED = .22;
const TAU = Math.PI * 2;
// Back to front: separate crests within the exposed sky; distant edges stay
// softer/bluer while nearby layers become clearer and brighter.
const LAYER_STYLES = [
  { offset: 0, color: 0x9bd7ff, radiance: 1.65, opacity: .84, softness: 6 },
  { offset: 22, color: 0xb0e1ff, radiance: 1.75, opacity: .87, softness: 5 },
  { offset: 45, color: 0xc8ebff, radiance: 2.0, opacity: .90, softness: 4 },
  { offset: 69, color: 0xdff4ff, radiance: 2.3, opacity: .93, softness: 3 },
  { offset: 94, color: 0xf1faff, radiance: 2.7, opacity: .95, softness: 2.25 },
  { offset: 120, color: 0xfffef7, radiance: 3.2, opacity: .97, softness: 1.5 },
];
// Colour alone changes at night; alpha, contours and fitted spacing stay shared.
const NIGHT_COLORS = [0x26395f, 0x304569, 0x3c5277, 0x4a6289, 0x5c769d, 0x708eb7];

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Viewport anchoring leaves the authored foreground camera unchanged.
  // Normal depth testing still places every opaque scene surface in front.
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uLayer;
uniform vec3 uColor;
uniform vec2 uViewport;
uniform float uCeiling;
uniform float uTopInset;
uniform float uPixelScale;
uniform float uSoftness;
uniform float uOpacity;
varying vec2 vUv;
const float TAU = 6.28318530718;
float Func(float pX) {
  return 0.6*(0.5*sin(0.1*pX) + 0.5*sin(0.553*pX) + 0.7*sin(1.2*pX));
}
float FuncR(float pX) {
  return 0.5 + 0.25*(1.0 + sin(mod(40.0*pX, TAU)));
}
float Layer(vec2 pQ, float pT) {
  vec2 Qt = 3.5*pQ;
  pT *= 0.5;
  Qt.x += pT;
  float Xi = floor(Qt.x);
  float Xf = Qt.x-Xi-0.5;
  float D = 1.0-step(Qt.y,Func(Qt.x));
  vec2 C = vec2(Xf,Qt.y-Func(Xi+0.5));
  D = min(D,length(C)-FuncR(Xi+pT/80.0));
  C = vec2(Xf-1.0,Qt.y-Func(Xi+1.0+0.5));
  D = min(D,length(C)-FuncR(Xi+1.0+pT/80.0));
  C = vec2(Xf+1.0,Qt.y-Func(Xi-1.0+0.5));
  D = min(D,length(C)-FuncR(Xi-1.0+pT/80.0));
  return min(1.0,D);
}
void main() {
  float J = uLayer;
  float layerTime = uTime*${DRIFT_SPEED.toFixed(2)}*(0.5+2.0*J)*(1.0+0.1*sin(226.0*J))+17.0*J;
  vec2 point = vec2((vUv.x-0.5)*uViewport.x,
    (vUv.y-1.0)*uViewport.y+uTopInset)/uPixelScale;
  point.y += uCeiling;
  float distance = Layer(point,layerTime);
  // A one-CSS-pixel minimum keeps the outer edge independent of buffer DPR.
  float softness = max(uSoftness,3.5/uPixelScale);
  float alpha = 1.0-smoothstep(0.0,max(softness,0.0001),distance);
  if (alpha < 0.001) discard;
  gl_FragColor = vec4(uColor,alpha*uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const contour = (x: number) => .6 * (.5 * Math.sin(.1 * x) + .5 * Math.sin(.553 * x) + .7 * Math.sin(1.2 * x));

/** Fit each softened contour to its own crest within the cloud band.
 * The farthest crest remains at TOP_INSET; the other five follow in CSS pixels,
 * keeping phases from arbitrarily spreading crests below the usable sky band.
 */
function fitCloudCeilings(width: number, time: number, ceilings: Float64Array) {
  for (let i = 0; i < 6; i++) {
    const j = i / 5;
    const phase = (time * DRIFT_SPEED * (.5 + 2 * j) * (1 + .1 * Math.sin(226 * j)) + 17 * j) * .5;
    const left = -width / (2 * PIXELS_PER_UNIT) * 3.5 + phase;
    const right = width / (2 * PIXELS_PER_UNIT) * 3.5 + phase;
    const style = LAYER_STYLES[i];
    const softness = 3.5 * style.softness / PIXELS_PER_UNIT;
    let top = Math.max(contour(left), contour(right));
    // A sub-disk viewport can contain a baseline peak but no disk centre.
    if (right - left < 1) {
      for (let n = 1; n < 64; n++) top = Math.max(top, contour(left + (right - left) * n / 64));
    }
    for (let disk = Math.floor(left) - 1; disk <= Math.ceil(right); disk++) {
      const centre = disk + .5;
      const radius = .75 + .25 * Math.sin((40 * (disk + phase / 80)) % TAU) + softness;
      const dx = Math.max(left - centre, centre - right, 0);
      if (dx < radius) top = Math.max(top, contour(centre) + Math.sqrt(radius * radius - dx * dx));
    }
    // Only inner bands breathe: the uppermost silhouette stays viewport-fixed.
    const breathing = i === 0 ? 0 : 1.25 * Math.sin(time * (.32 + i * .035));
    ceilings[i] = top / 3.5 + (style.offset + breathing) / PIXELS_PER_UNIT;
  }
}

/** A sky backdrop, independent of foreground lighting, fog and interaction. */
export function createToonCloudBackdrop(palette: "day" | "night" = "day") {
  const root = new THREE.Group();
  root.name = "toon-cloud-backdrop";
  const geometry = new THREE.PlaneGeometry(2, 2);
  const viewport = new THREE.Vector2(1, 1), measured = new THREE.Vector2();
  const materials: THREE.ShaderMaterial[] = [];
  const ceilings = new Float64Array(6);
  let time = 0, fittedTime = NaN, fittedWidth = 0, fittedHeight = 0;
  const fit = (renderer: THREE.WebGLRenderer) => {
    renderer.getSize(measured);
    const width = Math.max(1, measured.x), height = Math.max(1, measured.y);
    if (width === fittedWidth && height === fittedHeight && time === fittedTime) return;
    viewport.set(width, height);
    fitCloudCeilings(width, time, ceilings);
    materials.forEach((material, i) => { material.uniforms.uCeiling.value = ceilings[i]; });
    fittedWidth = width; fittedHeight = height; fittedTime = time;
  };
  for (let i = 0; i < 6; i++) {
    const style = LAYER_STYLES[i];
    const material = new THREE.ShaderMaterial({
      name: "Toon Cloud distant layer",
      uniforms: {
        uTime: { value: 0 }, uLayer: { value: i / 5 },
        // Scene ACES mapping compresses unit white to grey. Supply daylight
        // radiance so the shared direct/composer paths retain blue-to-white depth.
        uColor: { value: new THREE.Color(palette === "night" ? NIGHT_COLORS[i] : style.color)
          .multiplyScalar(palette === "night" ? .8 : style.radiance) },
        uOpacity: { value: style.opacity }, uSoftness: { value: 3.5 * style.softness / PIXELS_PER_UNIT },
        uViewport: { value: viewport }, uCeiling: { value: 0 },
        uTopInset: { value: TOP_INSET }, uPixelScale: { value: PIXELS_PER_UNIT },
      },
      vertexShader, fragmentShader,
      transparent: true, depthWrite: false, depthTest: true,
      side: THREE.DoubleSide, premultipliedAlpha: false, fog: false,
    });
    const layer = new THREE.Mesh(geometry, material);
    layer.name = `toon-cloud-layer-${i}`;
    // Outline/depth passes may replace the vertex shader with MeshDepthMaterial.
    // Keep their world-space proxy far behind the subject as well.
    layer.position.z = -90 + i * 6;
    layer.renderOrder = -100 + i;
    // A sky quad uses clip space rather than the authored camera's frustum.
    layer.frustumCulled = false;
    layer.onBeforeRender = fit;
    layer.raycast = () => {};
    root.add(layer); materials.push(material);
  }
  let disposed = false;
  return {
    root,
    update(nextTime: number) {
      time = Number.isFinite(nextTime) ? Math.max(0, nextTime) : 0;
      for (const material of materials) material.uniforms.uTime.value = time;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent(); geometry.dispose();
      materials.forEach(material => material.dispose()); root.clear();
    },
  };
}
