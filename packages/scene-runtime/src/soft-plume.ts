import * as THREE from 'three';
import { getProceduralNoiseAtlas } from './procedural-noise-atlas';

export type SoftPlumeKind = 'incense' | 'steam' | 'hearth' | 'aroma';

export interface SoftPlumeOptions {
  kind?: SoftPlumeKind;
  color?: THREE.ColorRepresentation;
  warmColor?: THREE.ColorRepresentation;
  height?: number;
  width?: number;
  opacity?: number;
  curl?: number;
  speed?: number;
  strands?: number;
  wisps?: number;
  seed?: number;
}

export interface SoftPlumeHandle {
  readonly root: THREE.Group;
  setIntensity(value: number): void;
  update(
    dt: number,
    camera?: THREE.Camera,
    options?: { reducedMotion?: boolean; scene?: THREE.Object3D | null },
  ): void;
  dispose(): void;
}

export interface SurfaceRippleOptions {
  radius?: number;
  maxRings?: number;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  duration?: number;
}

export interface SurfaceRippleHandle {
  readonly root: THREE.Group;
  trigger(x?: number, z?: number, strength?: number): void;
  setContinuous(active: boolean, x?: number, z?: number): void;
  update(dt: number, reducedMotion?: boolean): void;
  dispose(): void;
}

type PlumePreset = {
  color: number;
  warmColor: number;
  height: number;
  width: number;
  opacity: number;
  curl: number;
  speed: number;
  strands: number;
  wisps: number;
};

const PLUME_PRESETS: Record<SoftPlumeKind, PlumePreset> = {
  incense: {
    color: 0xe6e4ee,
    warmColor: 0xffdfbf,
    height: 0.62,
    width: 0.085,
    opacity: 0.42,
    curl: 1.0,
    speed: 0.65,
    strands: 2,
    wisps: 4,
  },
  steam: {
    color: 0xf7f5f0,
    warmColor: 0xffe9cf,
    height: 0.40,
    width: 0.16,
    opacity: 0.38,
    curl: 0.72,
    speed: 0.85,
    strands: 2,
    wisps: 10,
  },
  hearth: {
    color: 0xd9d2cc,
    warmColor: 0xffc68c,
    height: 0.56,
    width: 0.18,
    opacity: 0.44,
    curl: 0.88,
    speed: 0.78,
    strands: 2,
    wisps: 12,
  },
  aroma: {
    color: 0xf0ece6,
    warmColor: 0xffe6cc,
    height: 0.46,
    width: 0.12,
    opacity: 0.32,
    curl: 1.15,
    speed: 0.58,
    strands: 2,
    wisps: 6,
  },
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finiteOr(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isFinite(value) ? THREE.MathUtils.clamp(value!, min, max) : fallback;
}

const NOOP_RAYCAST = () => {};

function configureEffectMesh(mesh: THREE.Mesh, renderOrder: number): void {
  mesh.userData.effect = true;
  mesh.userData.toonSurface = { outline: false };
  mesh.raycast = NOOP_RAYCAST;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = renderOrder;
}

/** Build a 2 x 22 subdivided vertical ribbon strip with uv.x in [0,1], uv.y in [0,1]. */
function createRibbonStripGeometry(widthSegments = 2, heightSegments = 22): THREE.BufferGeometry {
  const cols = widthSegments + 1;
  const rows = heightSegments + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const indices: number[] = [];

  for (let iy = 0; iy < rows; iy++) {
    const v = iy / heightSegments;
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / widthSegments;
      const idx = iy * cols + ix;
      positions[idx * 3] = u - 0.5;
      positions[idx * 3 + 1] = v;
      positions[idx * 3 + 2] = 0;
      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = v;
    }
  }

  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < widthSegments; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const STRAND_VERTEX_SHADER = `
uniform float uTime;
uniform float uHeight;
uniform float uWidth;
uniform float uCurl;
uniform float uPhase;
uniform float uReducedMotion;
uniform vec3 uWind;
varying vec2 vUv;
varying float vRim;

void main() {
  float v = uv.y;
  float across = (uv.x - 0.5) * 2.0;
  float t = uTime;
  float motionScale = mix(1.0, 0.35, uReducedMotion);
  float vSafe = max(v, 1e-4);
  float widthEnv = mix(0.28, 1.38, pow(vSafe, 0.72)) * (1.0 - 0.16 * smoothstep(0.76, 1.0, v));
  float xLocal = across * 0.5 * uWidth * widthEnv;

  float curlEnv = pow(vSafe, 1.28) * uCurl * uWidth * 0.62 * motionScale;
  float swayX = (sin(v * 6.2 - t * 1.45 + uPhase) * 0.68
               + sin(v * 11.4 - t * 2.25 + uPhase * 1.9) * 0.32) * curlEnv;
  float swayZ = (cos(v * 5.3 - t * 1.18 + uPhase * 1.3) * 0.65
               + sin(v * 9.7 - t * 1.85 + uPhase * 2.4) * 0.35) * curlEnv * 0.75;

  // Soft depth cup along center spine so crossed strands read volumetrically.
  float cupZ = (1.0 - across * across) * uWidth * 0.12 * smoothstep(0.05, 0.45, v);
  vec3 windBend = uWind * (v * v) * uHeight * 0.55;

  vec3 pos = vec3(
    xLocal + swayX + windBend.x,
    v * uHeight + windBend.y * 0.25,
    swayZ + cupZ + windBend.z
  );

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vUv = uv;
  vRim = clamp(1.0 - abs(across), 0.0, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const STRAND_FRAGMENT_SHADER = `
uniform sampler2D uNoiseAtlas;
uniform vec3 uColor;
uniform vec3 uWarmColor;
uniform float uTime;
uniform float uIntensity;
uniform float uOpacity;
uniform float uCurl;
uniform float uPhase;
uniform float uReducedMotion;
varying vec2 vUv;
varying float vRim;

void main() {
  float v = vUv.y;
  float across = (vUv.x - 0.5) * 2.0;
  float t = uTime;

  vec2 warpUv = vec2(
    vUv.x * 0.85 + sin(v * 5.4 - t * 0.95 + uPhase) * 0.14 * uCurl,
    v * 0.82 - t * 0.24 + uPhase * 0.13
  );
  vec4 nMacro = texture2D(uNoiseAtlas, warpUv);
  vec4 nFine = texture2D(uNoiseAtlas, vec2(vUv.x * 1.7 + nMacro.r * 0.22, v * 1.45 - t * 0.36 + uPhase * 0.31));

  float d1 = (across - 0.34 * sin(v * 7.2 - t * 1.25 + uPhase)) * 2.45;
  float d2 = (across + 0.30 * sin(v * 5.9 - t * 0.94 + uPhase * 1.7 + 1.15)) * 2.85;
  float s1 = exp(-(d1 * d1));
  float s2 = exp(-(d2 * d2)) * 0.78;
  float body = 1.0 - smoothstep(0.16, 1.0, abs(across));

  float wispNoise = (0.38 + 0.82 * nMacro.r) * (0.68 + 0.42 * nFine.a);
  float baseFade = smoothstep(0.0, 0.11, v);
  float topFade = pow(max(1.0 - smoothstep(0.18, 1.0, v), 1e-4), 1.38);

  float alpha = (s1 * 0.52 + s2 * 0.38 + body * 0.28) * wispNoise * baseFade * topFade;
  alpha *= uOpacity * uIntensity * mix(1.0, 0.72, uReducedMotion);
  alpha = clamp(alpha, 0.0, 0.86);
  if (alpha < 0.002) discard;

  float warmFactor = clamp((1.0 - v) * 0.52 + vRim * 0.28 + (s1 + s2) * 0.12, 0.0, 1.0);
  vec3 col = mix(uColor, uWarmColor, warmFactor);
  gl_FragColor = vec4(col, alpha);
}
`;

const WISP_VERTEX_SHADER = `
attribute vec4 aSeed;
uniform float uTime;
uniform float uHeight;
uniform float uWidth;
uniform float uCurl;
uniform float uReducedMotion;
uniform vec3 uWind;
varying vec2 vQuad;
varying float vAgeAlpha;
varying float vWarmth;
varying float vSeedOffset;

void main() {
  float life = 1.8 + aSeed.x * 1.1;
  float age = fract((uTime * 0.55) / life + aSeed.w);
  float motionScale = mix(1.0, 0.35, uReducedMotion);

  float rise = pow(max(age, 1e-4), 0.92) * uHeight * (0.78 + 0.30 * aSeed.y);
  float spread = uWidth * (0.20 + 0.62 * age);
  float angle = aSeed.z * 6.2831853 + age * (2.6 + aSeed.x * 1.8) * uCurl * motionScale;

  vec3 localCenter = vec3(
    cos(angle) * spread * 0.42 + (aSeed.y - 0.5) * uWidth * 0.35,
    rise,
    sin(angle) * spread * 0.42 + (aSeed.z - 0.5) * uWidth * 0.35
  ) + uWind * (age * age) * uHeight * 0.52;

  float puffSize = uWidth * (0.34 + 0.78 * age) * (0.82 + 0.34 * aSeed.x);
  #ifdef USE_INSTANCING
    vec4 mvCenter = modelViewMatrix * instanceMatrix * vec4(localCenter, 1.0);
  #else
    vec4 mvCenter = modelViewMatrix * vec4(localCenter, 1.0);
  #endif

  float rot = aSeed.z * 6.2831853 + age * 1.4 * motionScale;
  float cs = cos(rot);
  float sn = sin(rot);
  vec2 q = mat2(cs, -sn, sn, cs) * position.xy;
  mvCenter.xy += q * puffSize;

  vQuad = position.xy;
  vAgeAlpha = smoothstep(0.0, 0.16, age) * (1.0 - smoothstep(0.36, 1.0, age));
  vWarmth = 1.0 - age;
  vSeedOffset = aSeed.x * 0.73 + aSeed.y * 0.41;
  gl_Position = projectionMatrix * mvCenter;
}
`;

const WISP_FRAGMENT_SHADER = `
uniform sampler2D uNoiseAtlas;
uniform vec3 uColor;
uniform vec3 uWarmColor;
uniform float uOpacity;
uniform float uIntensity;
uniform float uReducedMotion;
varying vec2 vQuad;
varying float vAgeAlpha;
varying float vWarmth;
varying float vSeedOffset;

void main() {
  float r = length(vQuad * 2.0);
  if (r > 1.05) discard;
  vec4 nz = texture2D(uNoiseAtlas, vQuad * 0.45 + 0.5 + vec2(vSeedOffset, vSeedOffset * 0.61));
  float n = nz.r * 0.68 + nz.g * 0.32;
  float soft = smoothstep(1.0, 0.12, r + (n - 0.5) * 0.58) * (0.55 + 0.65 * n);
  float alpha = soft * vAgeAlpha * uOpacity * 0.58 * uIntensity * mix(1.0, 0.65, uReducedMotion);
  if (alpha < 0.002) discard;
  vec3 col = mix(uColor, uWarmColor, clamp(vWarmth * 0.55 + (1.0 - r) * 0.25, 0.0, 1.0));
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.68));
}
`;

type EnvironmentWindLike = {
  sample?: (
    x: number,
    y: number,
    z: number,
    out?: THREE.Vector3,
  ) => THREE.Vector3 | { x: number; y: number; z: number } | void;
};

function findEnvironmentWind(
  root: THREE.Object3D,
  scene?: THREE.Object3D | null,
): EnvironmentWindLike | null {
  const direct = scene?.userData?.environmentWind as EnvironmentWindLike | undefined;
  if (direct && typeof direct.sample === 'function') return direct;
  for (let node: THREE.Object3D | null = root.parent; node; node = node.parent) {
    const candidate = node.userData?.environmentWind as EnvironmentWindLike | undefined;
    if (candidate && typeof candidate.sample === 'function') return candidate;
  }
  return null;
}

const _camWorld = new THREE.Vector3();
const _localCam = new THREE.Vector3();
const _rootWorld = new THREE.Vector3();
const _rootQuat = new THREE.Quaternion();
const _windSample = new THREE.Vector3();
const _localWind = new THREE.Vector3();

/**
 * Living curl-warped incense, tea steam, hearth, or aroma plume combining
 * silk ribbon strands and optional rising puff wisps. Samples the shared
 * procedural noise atlas and responds safely to scene environment wind.
 */
export function createSoftPlume(options: SoftPlumeOptions = {}): SoftPlumeHandle {
  const kind: SoftPlumeKind = options.kind ?? 'incense';
  const preset = PLUME_PRESETS[kind];
  const color = new THREE.Color(options.color ?? preset.color);
  const warmColor = new THREE.Color(options.warmColor ?? preset.warmColor);
  const height = finiteOr(options.height, preset.height, 0.05, 6);
  const width = finiteOr(options.width, preset.width, 0.01, 3);
  const opacity = finiteOr(options.opacity, preset.opacity, 0, 1);
  const curl = finiteOr(options.curl, preset.curl, 0, 3);
  const speed = finiteOr(options.speed, preset.speed, 0, 4);
  const strandCount = Math.round(finiteOr(options.strands, preset.strands, 1, 6));
  const wispCount = Math.round(finiteOr(options.wisps, preset.wisps, 0, 32));
  const seed = Math.round(finiteOr(options.seed, 17, 0, 1_000_000));

  const rand = mulberry32(seed + 101);
  const atlas = getProceduralNoiseAtlas();

  const root = new THREE.Group();
  root.name = `soft-plume-${kind}`;
  root.userData.effect = true;
  root.userData.toonSurface = { outline: false };

  const strandsGroup = new THREE.Group();
  strandsGroup.name = 'soft-plume-strands';
  strandsGroup.userData.effect = true;
  root.add(strandsGroup);

  const initialTime = 1.37 + (seed % 19) * 0.23;
  let time = initialTime;
  let intensity = 1;
  let disposed = false;
  const smoothedWind = new THREE.Vector3();

  const strandGeometry = createRibbonStripGeometry(2, 22);
  const strandMaterials: THREE.ShaderMaterial[] = [];

  for (let i = 0; i < strandCount; i++) {
    const phase = rand() * Math.PI * 2 + i * 2.13;
    const widthJitter = 0.88 + rand() * 0.24;
    const heightJitter = 0.92 + rand() * 0.16;
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uNoiseAtlas: { value: atlas },
        uColor: { value: color.clone() },
        uWarmColor: { value: warmColor.clone() },
        uTime: { value: time },
        uIntensity: { value: intensity },
        uOpacity: { value: opacity },
        uCurl: { value: curl },
        uHeight: { value: height * heightJitter },
        uWidth: { value: width * widthJitter },
        uPhase: { value: phase },
        uReducedMotion: { value: 0 },
        uWind: { value: new THREE.Vector3() },
      },
      vertexShader: STRAND_VERTEX_SHADER,
      fragmentShader: STRAND_FRAGMENT_SHADER,
    });
    strandMaterials.push(material);

    const mesh = new THREE.Mesh(strandGeometry, material);
    mesh.name = `soft-plume-strand-${i}`;
    mesh.frustumCulled = false;
    if (strandCount > 1) {
      const spread = ((i / (strandCount - 1)) - 0.5) * 0.62;
      mesh.rotation.y = spread;
    }
    configureEffectMesh(mesh, 16);
    strandsGroup.add(mesh);
  }

  let wispGeometry: THREE.BufferGeometry | null = null;
  let wispMaterial: THREE.ShaderMaterial | null = null;
  let wispMesh: THREE.InstancedMesh | null = null;

  if (wispCount > 0) {
    const baseQuad = new THREE.PlaneGeometry(1, 1);
    const seedAttr = new Float32Array(wispCount * 4);
    for (let i = 0; i < wispCount; i++) {
      seedAttr[i * 4] = rand();
      seedAttr[i * 4 + 1] = rand();
      seedAttr[i * 4 + 2] = rand();
      seedAttr[i * 4 + 3] = i / wispCount;
    }
    baseQuad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedAttr, 4));
    wispGeometry = baseQuad;

    wispMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uNoiseAtlas: { value: atlas },
        uColor: { value: color.clone() },
        uWarmColor: { value: warmColor.clone() },
        uTime: { value: time },
        uHeight: { value: height },
        uWidth: { value: width },
        uCurl: { value: curl },
        uOpacity: { value: opacity },
        uIntensity: { value: intensity },
        uReducedMotion: { value: 0 },
        uWind: { value: new THREE.Vector3() },
      },
      vertexShader: WISP_VERTEX_SHADER,
      fragmentShader: WISP_FRAGMENT_SHADER,
    });

    wispMesh = new THREE.InstancedMesh(wispGeometry, wispMaterial, wispCount);
    wispMesh.name = 'soft-plume-wisps';
    wispMesh.frustumCulled = false;
    const identity = new THREE.Matrix4();
    for (let i = 0; i < wispCount; i++) {
      wispMesh.setMatrixAt(i, identity);
    }
    wispMesh.instanceMatrix.needsUpdate = true;
    configureEffectMesh(wispMesh, 17);
    root.add(wispMesh);
  }

  function syncVisibility(): void {
    const active = intensity > 1e-4;
    strandsGroup.visible = active;
    if (wispMesh) wispMesh.visible = active;
  }

  function setIntensity(value: number): void {
    if (disposed) return;
    intensity = finiteOr(value, 1, 0, 2);
    for (const mat of strandMaterials) {
      mat.uniforms.uIntensity.value = intensity;
    }
    if (wispMaterial) {
      wispMaterial.uniforms.uIntensity.value = intensity;
    }
    syncVisibility();
  }

  function update(
    dt: number,
    camera?: THREE.Camera,
    updateOptions?: { reducedMotion?: boolean; scene?: THREE.Object3D | null },
  ): void {
    if (disposed) return;
    const step = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, 0.1) : 0;
    const reduced = updateOptions?.reducedMotion === true;

    if (!reduced) {
      time += step * speed;
    }

    // Cylindrical Y-axis billboarding of the silk ribbon strands toward camera.
    if (camera) {
      root.updateWorldMatrix(true, false);
      camera.updateWorldMatrix(true, false);
      camera.getWorldPosition(_camWorld);
      _localCam.copy(_camWorld);
      root.worldToLocal(_localCam);
      if (_localCam.x * _localCam.x + _localCam.z * _localCam.z > 1e-8) {
        strandsGroup.rotation.y = Math.atan2(_localCam.x, _localCam.z);
      }
    }

    // Safe duck-typed environment wind sampling.
    _localWind.set(0, 0, 0);
    if (!reduced) {
      const envWind = findEnvironmentWind(root, updateOptions?.scene);
      if (envWind?.sample) {
        root.updateWorldMatrix(true, false);
        root.getWorldPosition(_rootWorld);
        root.getWorldQuaternion(_rootQuat);
        _windSample.set(0, 0, 0);
        const sampled = envWind.sample(_rootWorld.x, _rootWorld.y, _rootWorld.z, _windSample);
        if (sampled && typeof sampled.x === 'number') {
          _windSample.set(sampled.x, sampled.y, sampled.z);
        }
        _localWind.copy(_windSample).applyQuaternion(_rootQuat.invert());
        const len = _localWind.length();
        if (len > 1.2) _localWind.multiplyScalar(1.2 / len);
      }
    }

    const blend = reduced ? 1 : 1 - Math.exp(-step * 6.5);
    smoothedWind.lerp(_localWind, blend);

    const reducedValue = reduced ? 1 : 0;
    for (const mat of strandMaterials) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uReducedMotion.value = reducedValue;
      (mat.uniforms.uWind.value as THREE.Vector3).copy(smoothedWind);
    }
    if (wispMaterial) {
      wispMaterial.uniforms.uTime.value = time;
      wispMaterial.uniforms.uReducedMotion.value = reducedValue;
      (wispMaterial.uniforms.uWind.value as THREE.Vector3).copy(smoothedWind);
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    strandGeometry.dispose();
    for (const mat of strandMaterials) {
      mat.dispose();
    }
    if (wispGeometry) wispGeometry.dispose();
    if (wispMaterial) wispMaterial.dispose();
    root.clear();
  }

  syncVisibility();
  return { root, setIntensity, update, dispose };
}

const RIPPLE_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RIPPLE_FRAGMENT_SHADER = `
uniform sampler2D uNoiseAtlas;
uniform vec3 uColor;
uniform float uProgress;
uniform float uOpacity;
uniform float uStrength;
uniform float uTime;
varying vec2 vUv;

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  float r = length(centered);
  if (r > 1.0) discard;

  float rem = max(1.0 - uProgress, 1e-4);
  float ease = 1.0 - pow(rem, 2.2);
  float rPrimary = mix(0.06, 0.92, ease);
  float wPrimary = mix(0.042, 0.082, uProgress);
  float dp = (r - rPrimary) / wPrimary;
  float primary = exp(-(dp * dp));

  float rSecondary = max(0.02, rPrimary - mix(0.08, 0.17, uProgress));
  float wSecondary = wPrimary * 1.15;
  float ds = (r - rSecondary) / wSecondary;
  float secondary = exp(-(ds * ds)) * 0.56 * smoothstep(0.06, 0.25, uProgress);

  float shimmer = texture2D(uNoiseAtlas, vUv * 1.35 + vec2(uTime * 0.08, -uTime * 0.06)).r;
  float envelope = smoothstep(0.0, 0.08, uProgress) * pow(rem, 1.5);
  float edgeGuard = 1.0 - smoothstep(0.88, 1.0, r);

  float alpha = (primary + secondary) * (0.78 + 0.42 * shimmer) * envelope * edgeGuard * uOpacity * uStrength;
  alpha = clamp(alpha, 0.0, 0.90);
  if (alpha < 0.002) discard;

  vec3 col = uColor * (0.94 + 0.14 * primary + 0.08 * shimmer);
  gl_FragColor = vec4(col, alpha);
}
`;

type RippleSlot = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  active: boolean;
  age: number;
  strength: number;
};

/**
 * Pooled water/tea surface capillary ripple ring emitter for pours and drips.
 * Marked as an effect (excluded from outlines, shadows, and pointer raycasts)
 * and automatically hidden/calm under reducedMotion.
 */
export function createSurfaceRipple(options: SurfaceRippleOptions = {}): SurfaceRippleHandle {
  const radius = finiteOr(options.radius, 0.18, 0.01, 5);
  const maxRings = Math.round(finiteOr(options.maxRings, 3, 1, 8));
  const color = new THREE.Color(options.color ?? 0xfff8ee);
  const opacity = finiteOr(options.opacity, 0.42, 0, 1);
  const duration = finiteOr(options.duration, 1.35, 0.15, 8);

  const atlas = getProceduralNoiseAtlas();
  const root = new THREE.Group();
  root.name = 'surface-ripple';
  root.userData.effect = true;
  root.userData.toonSurface = { outline: false };

  const ringGeometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
  ringGeometry.rotateX(-Math.PI / 2);

  const slots: RippleSlot[] = [];
  for (let i = 0; i < maxRings; i++) {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      uniforms: {
        uNoiseAtlas: { value: atlas },
        uColor: { value: color.clone() },
        uProgress: { value: 0 },
        uOpacity: { value: opacity },
        uStrength: { value: 1 },
        uTime: { value: 0 },
      },
      vertexShader: RIPPLE_VERTEX_SHADER,
      fragmentShader: RIPPLE_FRAGMENT_SHADER,
    });
    const mesh = new THREE.Mesh(ringGeometry, material);
    mesh.name = `surface-ripple-ring-${i}`;
    mesh.visible = false;
    configureEffectMesh(mesh, 14);
    root.add(mesh);
    slots.push({ mesh, material, active: false, age: 0, strength: 1 });
  }

  let continuous = false;
  let continuousX = 0;
  let continuousZ = 0;
  let continuousCooldown = 0;
  let elapsed = 0;
  let disposed = false;

  function pickSlot(): RippleSlot {
    for (const slot of slots) {
      if (!slot.active) return slot;
    }
    let oldest = slots[0];
    for (let i = 1; i < slots.length; i++) {
      if (slots[i].age > oldest.age) oldest = slots[i];
    }
    return oldest;
  }

  function trigger(x = 0, z = 0, strength = 1): void {
    if (disposed) return;
    const slot = pickSlot();
    slot.active = true;
    slot.age = 0;
    slot.strength = finiteOr(strength, 1, 0, 1.5);
    slot.mesh.position.set(Number.isFinite(x) ? x : 0, 0, Number.isFinite(z) ? z : 0);
    slot.mesh.visible = slot.strength > 1e-4;
    slot.material.uniforms.uProgress.value = 0;
    slot.material.uniforms.uStrength.value = slot.strength;
  }

  function setContinuous(active: boolean, x = 0, z = 0): void {
    if (disposed) return;
    const wasActive = continuous;
    continuous = Boolean(active);
    continuousX = Number.isFinite(x) ? x : 0;
    continuousZ = Number.isFinite(z) ? z : 0;
    if (continuous && !wasActive) {
      trigger(continuousX, continuousZ, 0.85);
      continuousCooldown = duration / maxRings;
    }
  }

  function update(dt: number, reducedMotion = false): void {
    if (disposed) return;
    if (reducedMotion) {
      for (const slot of slots) {
        slot.active = false;
        slot.mesh.visible = false;
      }
      return;
    }

    const step = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, 0.1) : 0;
    elapsed += step;

    if (continuous) {
      continuousCooldown -= step;
      if (continuousCooldown <= 0) {
        trigger(continuousX, continuousZ, 0.85);
        continuousCooldown = duration / maxRings;
      }
    }

    for (const slot of slots) {
      if (!slot.active) continue;
      slot.age += step / duration;
      if (slot.age >= 1) {
        slot.active = false;
        slot.age = 0;
        slot.mesh.visible = false;
        slot.material.uniforms.uProgress.value = 1;
      } else {
        slot.mesh.visible = true;
        slot.material.uniforms.uProgress.value = slot.age;
        slot.material.uniforms.uTime.value = elapsed;
      }
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    ringGeometry.dispose();
    for (const slot of slots) {
      slot.material.dispose();
    }
    root.clear();
  }

  return { root, trigger, setContinuous, update, dispose };
}
