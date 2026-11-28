import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { RenderStyleId } from "@wbr/content";
import { isSceneVisibleInApp } from "@wbr/core/daily-scenes";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import nature from "./nature-kit.data.json";
import { gardenLayout } from "./garden-layout";
import { createStylizedMeadow } from "./stylized-meadow";
import type { TreePlacement } from './tree-models';
import { createEnvironmentTrees } from './environment-trees';
import type { TreeRenderMethod, TreeRenderReport } from './debug-trees';
import { getSceneTreeDefault } from './tree-profiles';
import { readSceneMotion } from "./scene-motion";
import { createToonCloudBackdrop } from "./toon-cloud-backdrop";
import { createEnvironmentTone, DELIVERY_PALETTE, KOMOREBI_PALETTE } from './environment-tone';
import type { EnvironmentTone } from './debug-environment-tone';
import { DEFAULT_ENVIRONMENT_TONE, DEFAULT_GRASS_METHOD } from './environment-defaults';
import { createKomorebiMeadow, decorateMeadowGround } from './komorebi-meadow';
import type { GrassRenderMethod } from './debug-grass';
import { createKomorebiSurface } from './komorebi-surface';
import { createCourtyardStonePath } from './courtyard-stone-path';
import { getCourtyardSkin } from './courtyard-skins';
import { createGardenCourtyardPad } from './garden-courtyard-paving';
import { createRegionalCourtyard } from './regional-courtyard';
import { createKomorebiBackdrop, type BackdropRole } from './komorebi-backdrop';
import { applyCraftSurface } from './craft-surfaces';
import { createEnvironmentWind, type EnvironmentWindController } from './environment-wind';

import { assetUrl } from './asset-urls';
import { getEnvironmentProfile, getEnvironmentSurfaceY } from './environment-profiles';

type Part = { positions: number[]; normals: number[]; indices: number[]; color: number[] };
type NatureModel = { parts: Part[] };
const models = nature as Record<string, NatureModel>;

type WoodAxis = 'x' | 'y' | 'z';
type WoodFlip = 'none' | 'x' | 'y' | 'z';
type DeckPlankRecipe = {
  dh: number;
  ds: number;
  dl: number;
  scale: number;
  strength: number;
  roughness: number;
  flip: WoodFlip;
  offset: readonly [number, number, number];
};

// Keep the shared veranda/table wood noticeably quieter, softer and more matte
// than foreground hero craft furniture (strength 0.35-0.48, roughness 0.72-0.82),
// while letting environment-tone remap day Komorebi, Delivery, and Night palettes.
const DECK_PLANK_RECIPES: readonly DeckPlankRecipe[] = [
  { dh: 0.005, ds: -0.020, dl: 0.032, scale: 0.50, strength: 0.13, roughness: 0.90, flip: 'none', offset: [0.31, 0.14, 0.47] },
  { dh: -0.006, ds: 0.024, dl: -0.042, scale: 0.62, strength: 0.15, roughness: 0.93, flip: 'y', offset: [-0.47, -0.21, 0.83] },
  { dh: 0.002, ds: -0.010, dl: 0.008, scale: 0.56, strength: 0.12, roughness: 0.91, flip: 'x', offset: [0.64, 0.27, -0.52] },
  { dh: -0.004, ds: 0.018, dl: -0.024, scale: 0.66, strength: 0.14, roughness: 0.92, flip: 'z', offset: [-0.29, -0.17, -0.74] },
  { dh: 0.004, ds: -0.015, dl: 0.020, scale: 0.48, strength: 0.12, roughness: 0.89, flip: 'none', offset: [0.53, -0.24, 0.29] },
];

// Asymmetric plank widths summing to exact outer widths (12.00m veranda, 5.80m table)
// with a center plank straddling x = 0 so no hard seam bisects the focal prop.
const VERANDA_PLANK_WIDTHS = [0.82, 0.75, 0.85, 0.76, 0.83, 0.74, 0.84, 0.81, 0.76, 0.85, 0.75, 0.83, 0.78, 0.84, 0.79] as const;
const TABLE_PLANK_WIDTHS = [0.84, 0.79, 0.86, 0.82, 0.85, 0.78, 0.86] as const;

function tintWoodColor(hex: number, dh: number, ds: number, dl: number) {
  return new THREE.Color(hex).offsetHSL(dh, ds, dl);
}

function orientWoodGeometry(geometry: THREE.BufferGeometry, flip: WoodFlip) {
  if (flip === 'x') geometry.rotateX(Math.PI);
  else if (flip === 'y') geometry.rotateY(Math.PI);
  else if (flip === 'z') geometry.rotateZ(Math.PI);
}

const BACKGROUND_ROTATION_Y = 2.2;
const SKY_WIDTH = 128;
const SKY_HEIGHT = 64;
const SHADOW_HALF_EXTENT = 2.85;
const SHADOW_NEAR = 0.5;
const SHADOW_FAR = 28;
const KOMOREBI_SHADOW_RADIUS = 2.4;

const DAY_SUN_DIR = new THREE.Vector3(-6, 12, 6).normalize();
const NIGHT_MOON_DIR = new THREE.Vector3(2.5, 4, 2).normalize();
const SKY_PIXEL_CACHE = new Map<string, Uint8Array<ArrayBuffer>>();

type RGBTuple = readonly [number, number, number];

function hexToSrgbTuple(hex: number): RGBTuple {
  return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255];
}

function mixRgb(a: RGBTuple, b: RGBTuple, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function hashSeed(id: string): number {
  let state = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    state ^= id.charCodeAt(i);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return state;
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * A sun/moon-directional 128×64 equirectangular painted sky, aligned to `scene.backgroundRotation.y = 2.2`.
 * Independent of the photographic HDR used for IBL lighting.
 */
function createSkyBackdrop(clear = false, night = false, delivery = false, komorebi = false) {
  const key = `${clear ? 1 : 0}:${night ? 1 : 0}:${delivery ? 1 : 0}:${komorebi ? 1 : 0}`;
  let template = SKY_PIXEL_CACHE.get(key);
  if (!template) {
    template = new Uint8Array(SKY_WIDTH * SKY_HEIGHT * 4);
    const celestialDir = night ? NIGHT_MOON_DIR : DAY_SUN_DIR;
    const celestialPhi = Math.atan2(celestialDir.z, celestialDir.x);

    const zenithCool = hexToSrgbTuple(
      night ? (delivery ? 0x0f2134 : 0x061024) : komorebi ? 0x5f90c6 : delivery ? 0x1e85de : clear ? 0x2086df : 0x3794db,
    );
    const zenithWarm = hexToSrgbTuple(
      night ? (delivery ? 0x193149 : 0x0d1d3d) : komorebi ? 0x7daed6 : delivery ? 0x3ca2ee : clear ? 0x3ea0ee : 0x56afe6,
    );
    const midCool = hexToSrgbTuple(
      night ? (delivery ? 0x1b344a : 0x0e1f41) : komorebi ? 0x83b4d7 : delivery ? 0x4bb6f2 : clear ? 0x4db1f4 : 0x70bfe9,
    );
    const midWarm = hexToSrgbTuple(
      night ? (delivery ? 0x274561 : 0x1a325c) : komorebi ? 0xaac8dc : delivery ? 0x82cff5 : clear ? 0x7fc9f3 : 0x9cd4ec,
    );
    const horizonCool = hexToSrgbTuple(
      night ? (delivery ? 0x2b4354 : 0x172d50) : komorebi ? 0x95c4d8 : delivery ? 0x5dc4fa : clear ? 0x67c2fb : 0x91d3ee,
    );
    const horizonWarm = hexToSrgbTuple(
      night ? (delivery ? 0x3b5970 : 0x264673) : komorebi ? 0xecdbbc : delivery ? 0xf2e1c1 : clear ? 0xedddb9 : 0xf0e2c4,
    );
    const groundTint = hexToSrgbTuple(
      night ? (delivery ? 0x142433 : 0x091426) : komorebi ? 0x8ca689 : delivery ? 0x8fb57d : 0x8cb089,
    );
    const glowTint = hexToSrgbTuple(night ? 0x9bc0e6 : 0xfff3d6);

    for (let y = 0; y < SKY_HEIGHT; y++) {
      const v = (y + 0.5) / SKY_HEIGHT;
      const theta = (v - 0.5) * Math.PI;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const poleFade = Math.min(1, cosTheta * 4);

      for (let x = 0; x < SKY_WIDTH; x++) {
        const u = (x + 0.5) / SKY_WIDTH;
        // Three.js r170 samples equirectangular cubemaps via R_y(-backgroundRotation.y) * worldDir.
        const phiTex = (u - 0.5) * Math.PI * 2;
        const phiWorld = phiTex - BACKGROUND_ROTATION_Y;
        const wx = cosTheta * Math.cos(phiWorld);
        const wy = sinTheta;
        const wz = cosTheta * Math.sin(phiWorld);

        const az = 0.5 + 0.5 * Math.cos(phiWorld - celestialPhi) * poleFade;
        const azWarm = Math.pow(az, night ? 1.9 : 1.75);

        const zen = mixRgb(zenithCool, zenithWarm, az * 0.65);
        const mid = mixRgb(midCool, midWarm, az * 0.78);
        const hor = mixRgb(horizonCool, horizonWarm, azWarm);

        let r: number;
        let g: number;
        let b: number;
        if (wy >= 0) {
          const k = 1 - wy;
          const midMix = Math.pow(k, night ? 1.7 : 1.55);
          const horMix = Math.pow(k, night ? 4.8 : 4.2);
          const base0 = mixRgb(zen, mid, midMix);
          const skyCol = mixRgb(base0, hor, horMix);
          r = skyCol[0];
          g = skyCol[1];
          b = skyCol[2];

          const sd = Math.max(0, wx * celestialDir.x + wy * celestialDir.y + wz * celestialDir.z);
          if (night) {
            const moonGlow =
              (0.14 * Math.pow(sd, 4) + 0.18 * Math.pow(sd, 16) + 0.14 * Math.pow(sd, 64)) *
              THREE.MathUtils.smoothstep(wy, 0, 0.16);
            const tGlow = Math.min(0.46, moonGlow);
            r += (glowTint[0] - r) * tGlow;
            g += (glowTint[1] - g) * tGlow;
            b += (glowTint[2] - b) * tGlow;
          } else {
            const aureole = 0.13 * Math.pow(sd, 3) + 0.16 * Math.pow(sd, 10) + 0.12 * Math.pow(sd, 36);
            const horizonBloom = Math.exp(-wy * 8.5) * Math.pow(az, 2.2) * 0.16;
            const tGlow = Math.min(0.42, aureole + horizonBloom);
            r += (glowTint[0] - r) * tGlow;
            g += (glowTint[1] - g) * tGlow;
            b += (glowTint[2] - b) * tGlow;
          }
        } else {
          const below = THREE.MathUtils.smoothstep(-wy, 0, 0.28);
          r = hor[0] * 0.92 + (groundTint[0] - hor[0] * 0.92) * below;
          g = hor[1] * 0.92 + (groundTint[1] - hor[1] * 0.92) * below;
          b = hor[2] * 0.92 + (groundTint[2] - hor[2] * 0.92) * below;
        }

        const at = (y * SKY_WIDTH + x) * 4;
        template[at] = Math.round(THREE.MathUtils.clamp(r, 0, 1) * 255);
        template[at + 1] = Math.round(THREE.MathUtils.clamp(g, 0, 1) * 255);
        template[at + 2] = Math.round(THREE.MathUtils.clamp(b, 0, 1) * 255);
        template[at + 3] = 255;
      }
    }
    SKY_PIXEL_CACHE.set(key, template);
  }

  const texture = new THREE.DataTexture(template.slice(), SKY_WIDTH, SKY_HEIGHT);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

type RidgeLayerSpec = {
  readonly name: string;
  readonly role: 'hill' | 'distantHill' | 'farRidge';
  readonly originalHex: number;
  readonly deliveryHex: number;
  readonly columns: number;
  readonly spanX: number;
  readonly baseZ: number;
  readonly curveZ: number;
  readonly slopeDepth: number;
  readonly peakHeight: number;
  readonly phaseA: number;
  readonly phaseB: number;
  readonly phaseC: number;
  readonly valleyDip: number;
  readonly crestTint: RGBTuple;
  readonly baseTint: RGBTuple;
};

type RidgeTemplate = {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint16Array;
  readonly boundingBox: THREE.Box3;
  readonly boundingSphere: THREE.Sphere;
};
const RIDGE_TEMPLATE_CACHE = new Map<string, RidgeTemplate>();

/**
 * Procedural low-poly rolling foothill / mountain ridge silhouette with warm sunlit crest
 * highlights and soft aerial-perspective misty blue-sage base vertex colors.
 * Generic organic terrain only — no region- or culture-specific landmarks.
 */
function createMountainRidgeGeometry(spec: RidgeLayerSpec, riverValley: boolean) {
  const cacheKey = `${spec.name}:${riverValley ? 1 : 0}`;
  let tpl = RIDGE_TEMPLATE_CACHE.get(cacheKey);
  if (!tpl) {
    const cols = spec.columns;
    const rows = 4;
    const vertCount = (cols + 1) * (rows + 1);
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const indexList: number[] = [];
    const baseY = -0.7;

    const ridgeHeights = new Float32Array(cols + 1);
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const s = u * 2 - 1; // -1..1
      const edgeFade = 1 - THREE.MathUtils.smoothstep(Math.abs(s), 0.76, 1.0);
      const harmonic =
        0.46 +
        0.24 * Math.sin(s * 3.1 + spec.phaseA) +
        0.16 * Math.sin(s * 6.3 + spec.phaseB) +
        0.09 * Math.cos(s * 11.4 + spec.phaseC) +
        0.05 * Math.sin(s * 17.5 - spec.phaseA * 1.4);
      // Keep a gentle saddle/opening near center so focal ritual subjects stay framed clearly.
      const valleyWidth = riverValley ? 0.34 : 0.24;
      const valleyStrength = riverValley ? Math.min(0.68, spec.valleyDip + 0.22) : spec.valleyDip;
      const valley = 1 - valleyStrength * Math.exp(-(s * s) / (valleyWidth * valleyWidth));
      ridgeHeights[i] = Math.max(0.18, spec.peakHeight * Math.max(0.12, harmonic) * valley * edgeFade);
    }

    for (let r = 0; r <= rows; r++) {
      const v = r / rows; // 0 = base, 1 = crest
      const yProfile = Math.pow(v, 0.85);
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        const s = u * 2 - 1;
        const x = s * (spec.spanX * 0.5);
        const crestY = ridgeHeights[i]!;
        const y = baseY + (crestY - baseY) * yProfile;
        // Gentle panoramic curve plus organic spur/gully folds that catch directional sun.
        const spur = Math.sin(s * 7.8 + spec.phaseB * 0.7) * 0.45 * (1 - v * 0.55) * (1 - s * s * 0.5);
        const z = spec.baseZ + spec.curveZ * (s * s) + (1 - v) * spec.slopeDepth + spur;
        const idx = (r * (cols + 1) + i) * 3;
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < cols; i++) {
        const a = r * (cols + 1) + i;
        const b = a + 1;
        const c = a + (cols + 1);
        const d = c + 1;
        // Winding faces +Z (toward the camera).
        indexList.push(a, b, c, b, d, c);
      }
    }

    const tempGeo = new THREE.BufferGeometry();
    tempGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    tempGeo.setIndex(indexList);
    tempGeo.computeVertexNormals();

    const normalsAttr = tempGeo.getAttribute('normal') as THREE.BufferAttribute;
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      const elevT = THREE.MathUtils.smoothstep(v, 0.08, 0.96);
      for (let i = 0; i <= cols; i++) {
        const vert = r * (cols + 1) + i;
        // Softly lift normals upward so distant slopes feel painterly rather than harsh low-poly facets.
        const nx = normalsAttr.getX(vert) * 0.72;
        const ny = normalsAttr.getY(vert) * 0.72 + 0.42;
        const nz = normalsAttr.getZ(vert) * 0.72 + 0.34;
        const nLen = Math.hypot(nx, ny, nz) || 1;
        const unx = nx / nLen;
        const uny = ny / nLen;
        const unz = nz / nLen;
        normalsAttr.setXYZ(vert, unx, uny, unz);

        const sunDot = THREE.MathUtils.clamp(
          unx * DAY_SUN_DIR.x + uny * DAY_SUN_DIR.y + unz * DAY_SUN_DIR.z,
          0,
          1,
        );
        const warmLift = (sunDot - 0.5) * 0.14 * (0.35 + 0.65 * elevT);
        const cr = spec.baseTint[0] + (spec.crestTint[0] - spec.baseTint[0]) * elevT + warmLift * 1.1;
        const cg = spec.baseTint[1] + (spec.crestTint[1] - spec.baseTint[1]) * elevT + warmLift * 0.85;
        const cb = spec.baseTint[2] + (spec.crestTint[2] - spec.baseTint[2]) * elevT - warmLift * 0.55;
        const cIdx = vert * 3;
        colors[cIdx] = THREE.MathUtils.clamp(cr, 0.55, 1.2);
        colors[cIdx + 1] = THREE.MathUtils.clamp(cg, 0.55, 1.2);
        colors[cIdx + 2] = THREE.MathUtils.clamp(cb, 0.55, 1.2);
      }
    }

    tempGeo.computeBoundingBox();
    tempGeo.computeBoundingSphere();
    tpl = {
      positions,
      normals: Float32Array.from(normalsAttr.array as Float32Array),
      colors,
      indices: Uint16Array.from(indexList),
      boundingBox: tempGeo.boundingBox!.clone(),
      boundingSphere: tempGeo.boundingSphere!.clone(),
    };
    tempGeo.dispose();
    RIDGE_TEMPLATE_CACHE.set(cacheKey, tpl);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(tpl.positions.slice(), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(tpl.normals.slice(), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(tpl.colors.slice(), 3));
  geometry.setIndex(new THREE.BufferAttribute(tpl.indices.slice(), 1));
  geometry.boundingBox = tpl.boundingBox.clone();
  geometry.boundingSphere = tpl.boundingSphere.clone();
  return { geometry, baseColors: tpl.colors.slice() };
}

let cachedSoftRadial32: Uint8Array<ArrayBuffer> | undefined;
function createSoftRadialTexture(size: 32 | 64, power: number) {
  let bytes: Uint8Array<ArrayBuffer>;
  if (size === 32 && power === 2.2) {
    if (!cachedSoftRadial32) {
      cachedSoftRadial32 = buildRadialBytes(32, 2.2);
    }
    bytes = cachedSoftRadial32.slice();
  } else {
    bytes = buildRadialBytes(size, power);
  }
  const texture = new THREE.DataTexture(bytes, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function buildRadialBytes(size: number, power: number) {
  const bytes = new Uint8Array(size * size * 4);
  const half = (size - 1) * 0.5;
  for (let y = 0; y < size; y++) {
    const dy = (y - half) / half;
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half;
      const r = Math.hypot(dx, dy);
      const falloff = r >= 1 ? 0 : Math.pow(1 - r * r, power);
      const core = r >= 1 ? 0 : Math.exp(-r * r * 4.5) * 0.35;
      const alpha = THREE.MathUtils.clamp(falloff * 0.8 + core, 0, 1);
      const at = (y * size + x) * 4;
      bytes[at] = 255;
      bytes[at + 1] = 255;
      bytes[at + 2] = 255;
      bytes[at + 3] = Math.round(alpha * 255);
    }
  }
  return bytes;
}

const MOTE_VERTEX_SHADER = /* glsl */ `
attribute float aPhase;
uniform float uTime;
varying vec2 vUv;
varying float vTwinkle;
void main() {
  vUv = uv;
  vec4 worldCenter = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float instScale = length(vec3(instanceMatrix[0][0], instanceMatrix[0][1], instanceMatrix[0][2]));
  vec4 mvPosition = viewMatrix * worldCenter;
  mvPosition.xy += position.xy * instScale;
  vTwinkle = 0.5 + 0.5 * sin(uTime * (0.95 + fract(aPhase * 1.73) * 0.85) + aPhase * 6.2831853);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const MOTE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uSprite;
uniform vec3 uColor;
uniform vec2 uOpacityRange;
varying vec2 vUv;
varying float vTwinkle;
void main() {
  float mask = texture2D(uSprite, vUv).a;
  if (mask < 0.01) discard;
  float alpha = mask * mix(uOpacityRange.x, uOpacityRange.y, vTwinkle);
  gl_FragColor = vec4(uColor, alpha);
}
`;

function createKomorebiLightMotes({ id, groundY, night }: { id: string; groundY: number; night: boolean }) {
  const count = night ? 18 : 28;
  const rng = createRng(hashSeed(`${id}:motes`));
  const geometry = new THREE.PlaneGeometry(1, 1);
  const phases = new Float32Array(count);
  const baseX = new Float32Array(count);
  const baseY = new Float32Array(count);
  const baseZ = new Float32Array(count);
  const radii = new Float32Array(count);
  const speeds = new Float32Array(count);

  const sprite = createSoftRadialTexture(32, 2.2);
  sprite.name = 'komorebi-light-mote-sprite';
  const material = new THREE.ShaderMaterial({
    name: 'Komorebi floating light motes',
    uniforms: {
      uTime: { value: 0 },
      uSprite: { value: sprite },
      uColor: { value: new THREE.Color(night ? 0xffcb7d : 0xfff3d6) },
      uOpacityRange: { value: new THREE.Vector2(night ? 0.14 : 0.18, night ? 0.26 : 0.32) },
    },
    vertexShader: MOTE_VERTEX_SHADER,
    fragmentShader: MOTE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = 'komorebi-light-motes';
  mesh.raycast = () => {};
  mesh.userData.effect = true;
  mesh.userData.toonSurface = { outline: false };
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 3;

  const transform = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    // Distribute around the mid-ground and stage air, keeping clear of the camera near-plane.
    const angle = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.45;
    const radial = 0.75 + rng() * 2.55;
    baseX[i] = Math.cos(angle) * radial;
    baseZ[i] = -1.6 + Math.sin(angle) * radial * 0.9 - rng() * 1.6;
    if (baseZ[i] > 1.25) baseZ[i] = 1.25 - rng() * 1.4;
    baseY[i] = groundY + 0.35 + rng() * 2.25;
    radii[i] = night ? 0.032 + rng() * 0.032 : 0.036 + rng() * 0.042;
    phases[i] = rng();
    speeds[i] = 0.28 + rng() * 0.38;

    transform.position.set(baseX[i], baseY[i], baseZ[i]);
    transform.scale.setScalar(radii[i]);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
  }
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  mesh.instanceMatrix.needsUpdate = true;

  const sampleWind = new THREE.Vector3();
  const minY = groundY + 0.35;
  const maxY = groundY + 2.6;
  const spanX = 6.8;
  const spanZ = 6.6;
  const minZ = -5.35;

  function wrap(value: number, min: number, span: number) {
    return min + ((((value - min) % span) + span) % span);
  }

  return {
    mesh,
    geometry,
    material,
    sprite,
    update(windTime: number, reducedMotion: boolean, wind: EnvironmentWindController) {
      if (reducedMotion) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      material.uniforms.uTime.value = windTime;
      const driftScale = Math.max(0.15, wind.strength);
      for (let i = 0; i < count; i++) {
        const bx = baseX[i]!;
        const by = baseY[i]!;
        const bz = baseZ[i]!;
        const phase = phases[i]! * Math.PI * 2;
        const speed = speeds[i]!;
        wind.sample(bx, by, bz, sampleWind);
        const rawX = bx + wind.direction.x * windTime * speed * driftScale + sampleWind.x * 0.42 + Math.sin(windTime * 0.55 + phase) * 0.14;
        const rawZ = bz + wind.direction.y * windTime * speed * driftScale + sampleWind.z * 0.42 + Math.cos(windTime * 0.47 + phase * 1.3) * 0.12;
        const x = wrap(rawX, -spanX * 0.5, spanX);
        const z = wrap(rawZ, minZ, spanZ);
        const y = THREE.MathUtils.clamp(
          by + Math.sin(windTime * (0.42 + speed * 0.4) + phase) * 0.18 + sampleWind.y * 0.35,
          minY,
          maxY,
        );
        transform.position.set(x, y, z);
        transform.scale.setScalar(radii[i]!);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

let cachedLampPool64: Uint8Array<ArrayBuffer> | undefined;
function createNightLampPool(surfaceY: number) {
  if (!cachedLampPool64) {
    cachedLampPool64 = buildRadialBytes(64, 2.6);
  }
  const texture = new THREE.DataTexture(cachedLampPool64.slice(), 64, 64);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  texture.name = 'night-lamp-pool-radial';

  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffb866,
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'night-lamp-pool';
  mesh.position.set(0, surfaceY + 0.003, 0);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(2.0, 2.0, 1);
  mesh.visible = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 2;
  mesh.raycast = () => {};
  mesh.userData.effect = true;
  mesh.userData.toonSurface = { outline: false };

  return { mesh, geometry, material, texture };
}

const _snapUp = new THREE.Vector3();
const _snapRight = new THREE.Vector3();
const _snapUpLight = new THREE.Vector3();
const _snapDir = new THREE.Vector3();

function snapFocusToShadowTexels(
  focus: THREE.Vector3,
  lightDirection: THREE.Vector3,
  halfExtent: number,
  mapSize: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const dir = _snapDir.copy(lightDirection);
  if (dir.lengthSq() < 1e-8) return out.copy(focus);
  dir.normalize();
  _snapUp.set(Math.abs(dir.y) > 0.99 ? 1 : 0, Math.abs(dir.y) > 0.99 ? 0 : 1, 0);
  _snapRight.crossVectors(_snapUp, dir).normalize();
  _snapUpLight.crossVectors(dir, _snapRight);
  const texel = (halfExtent * 2) / Math.max(1, mapSize);
  const snappedX = Math.round(focus.dot(_snapRight) / texel) * texel;
  const snappedY = Math.round(focus.dot(_snapUpLight) / texel) * texel;
  const along = focus.dot(dir);
  return out
    .set(0, 0, 0)
    .addScaledVector(_snapRight, snappedX)
    .addScaledVector(_snapUpLight, snappedY)
    .addScaledVector(dir, along);
}

/** Small, source-derived Kenney props and local sky lighting; each mount owns its GPU resources. */
export function createCozyEnvironment(
  scene: THREE.Scene,
  { id, loadSky = (url: string) => new RGBELoader().loadAsync(url), invalidate = () => {}, loadTree, onTrees, camera }: {
    id: string;
    loadSky?: (url: string) => Promise<THREE.DataTexture>;
    invalidate?: () => void;
    loadTree?: (url: string) => Promise<THREE.Group>;
    onTrees?: (report: TreeRenderReport) => void;
    camera?: THREE.Camera;
  },
) {
  const profile = getEnvironmentProfile(id);
  if (!profile) return null;
  const { kind, floor, night = false, warmLight = false, coastal = false } = profile;
  const surfaceY = getEnvironmentSurfaceY(id);
  const previous = {
    background: scene.background, fog: scene.fog, environment: scene.environment,
    intensity: scene.backgroundIntensity, blur: scene.backgroundBlurriness,
    environmentIntensity: scene.environmentIntensity,
    backgroundRotation: scene.backgroundRotation.clone(), environmentRotation: scene.environmentRotation.clone(),
    environmentNight: scene.userData.environmentNight,
    environmentId: scene.userData.environmentId,
    environmentSurfaceY: scene.userData.environmentSurfaceY,
    environmentWind: scene.userData.environmentWind,
  };
  const root = new THREE.Group();
  root.name = "cozy-environment";
  root.userData.environment = kind;
  const courtyardSkin = getCourtyardSkin(id);
  root.userData.courtyardSkin = courtyardSkin;
  scene.add(root);
  const environmentWind = createEnvironmentWind({ strength: night ? 0.28 : coastal ? 0.58 : 0.52 });
  scene.userData.environmentNight = night;
  scene.userData.environmentId = id;
  scene.userData.environmentSurfaceY = surfaceY;
  scene.userData.environmentWind = environmentWind;
  const toneSurfaces = createEnvironmentTone(root, night);
  const calibrated = createKomorebiBackdrop(root);
  let tone: EnvironmentTone = 'original', toneDirty = false;
  let deliveryBackdrop: THREE.DataTexture | undefined;
  let komorebiBackdrop: THREE.DataTexture | undefined;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const propGeometries = new Map<string, THREE.BufferGeometry[]>();
  const instances: THREE.InstancedMesh[] = [];
  const ridgeRecords: {
    geometry: THREE.BufferGeometry;
    material: THREE.MeshStandardMaterial;
    baseColors: Float32Array;
    originalHex: number;
    deliveryHex: number;
  }[] = [];
  let disposed = false;
  let sky: THREE.DataTexture | undefined;
  let meadow: ReturnType<typeof createStylizedMeadow> | undefined;
  let komorebiMeadow: ReturnType<typeof createKomorebiMeadow> | undefined;
  let stonePath: ReturnType<typeof createCourtyardStonePath> | undefined;
  let gardenPad: ReturnType<typeof createGardenCourtyardPad> | undefined;
  let regionalCourtyard: ReturnType<typeof createRegionalCourtyard> | undefined;
  let grassMethod: GrassRenderMethod = 'original';
  let treePlacements: readonly TreePlacement[] = [];
  const clouds = !coastal && isSceneVisibleInApp({ id }) ? createToonCloudBackdrop(night ? "night" : "day") : undefined;
  if (clouds) root.add(clouds.root);
  const clearDay = !night && !!clouds;
  let windTime = 0, lastFrame = 0;
  const horizon = night ? (clouds ? 0x20395a : 0x415d73) : clearDay ? 0xc1e3ec : 0xb8dce7;
  const backdrop = night && !clouds ? undefined : createSkyBackdrop(clearDay, night);
  scene.background = backdrop ?? new THREE.Color(horizon);
  // Atmospheric perspective belongs to the far tree line, not the workbench.
  scene.fog = new THREE.Fog(horizon, night ? 7 : clearDay ? 24 : 18, night ? 24 : clearDay ? 80 : 55);
  scene.backgroundIntensity = night && !backdrop ? 0.065 : 1;
  scene.backgroundBlurriness = night && !backdrop ? 0.015 : 0;
  scene.environmentIntensity = warmLight ? 0.25 : night ? 0.16 : 0.22;
  scene.backgroundRotation.set(0, BACKGROUND_ROTATION_Y, 0);
  scene.environmentRotation.copy(scene.backgroundRotation);

  const makeMaterial = (color: number, role?: keyof typeof DELIVERY_PALETTE) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    material.userData.environmentRole = role;
    materials.add(material);
    return material;
  };
  const grass = makeMaterial(night ? 0x718e82 : 0x90c65b, 'grass');
  let komorebiGround: THREE.MeshPhongMaterial | undefined;
  const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.userData.toonSurface = { outline: false, shading: "smooth" };
    root.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) =>
    addMesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const makeWoodMaterial = (
    role: 'wood' | 'trim',
    axis: WoodAxis,
    { dh = 0, ds = 0, dl = 0, scale = 0.56, strength = 0.14, roughness = 0.91 }: {
      dh?: number; ds?: number; dl?: number; scale?: number; strength?: number; roughness?: number;
    } = {},
  ) => {
    const baseHex = role === 'wood' ? (night ? 0xa78e70 : 0xd9b98c) : (night ? 0x8c846e : 0xbfa07a);
    const material = new THREE.MeshStandardMaterial({
      color: tintWoodColor(baseHex, dh, ds, dl),
      roughness,
      metalness: 0,
    });
    material.userData.environmentRole = role;
    applyCraftSurface(material, { kind: 'wood', axis, scale, strength });
    materials.add(material);
    return material;
  };
  const woodBox = (
    name: string,
    w: number,
    h: number,
    d: number,
    material: THREE.MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
    radius = 0.015,
    { flip = 'none', offset }: { flip?: WoodFlip; offset?: readonly [number, number, number] } = {},
  ) => {
    const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3));
    orientWoodGeometry(geometry, flip);
    let px = x, py = y, pz = z;
    if (offset) {
      // Shift local-space vertices and compensate on mesh.position so world bounds stay
      // exact while each plank/post samples an independent region of 3D wood grain.
      geometry.translate(offset[0], offset[1], offset[2]);
      px -= offset[0];
      py -= offset[1];
      pz -= offset[2];
    }
    const mesh = addMesh(geometry, material, px, py, pz);
    mesh.name = name;
    // Pin matte roughness explicitly so toon-soft keeps background deck calmer than hero wood.
    mesh.userData.toonSurface = { outline: false, shading: "smooth", roughness: material.roughness };
    return mesh;
  };
  const buildPlankDeck = (
    prefix: string,
    widths: readonly number[],
    totalWidth: number,
    height: number,
    depth: number,
    yCenter: number,
    zCenter: number,
    seamGap: number,
    chamfer: number,
  ) => {
    const plankMaterials = DECK_PLANK_RECIPES.map(recipe =>
      makeWoodMaterial('wood', 'z', {
        dh: recipe.dh,
        ds: recipe.ds,
        dl: recipe.dl,
        scale: recipe.scale,
        strength: recipe.strength,
        roughness: recipe.roughness,
      }),
    );
    let cursorX = -totalWidth / 2;
    widths.forEach((slotWidth, index) => {
      const isFirst = index === 0;
      const isLast = index === widths.length - 1;
      const leftInset = isFirst ? 0 : seamGap / 2;
      const rightInset = isLast ? 0 : seamGap / 2;
      const boardWidth = slotWidth - leftInset - rightInset;
      const xCenter = cursorX + leftInset + boardWidth / 2;
      const recipe = DECK_PLANK_RECIPES[index % DECK_PLANK_RECIPES.length]!;
      const mat = plankMaterials[index % plankMaterials.length]!;
      woodBox(`${prefix}-plank`, boardWidth, height, depth, mat, xCenter, yCenter, zCenter, chamfer, {
        flip: recipe.flip,
        offset: [
          recipe.offset[0] + index * 0.37,
          recipe.offset[1] + ((index % 3) - 1) * 0.11,
          recipe.offset[2] + ((index * 5) % 7 - 3) * 0.29,
        ],
      });
      cursorX += slotWidth;
    });
  };
  const groundY = kind === "table" ? floor - 0.14 : floor;
  const spring = id === "celtic-folk-spring";
  let groundGeometry: THREE.BufferGeometry = new THREE.PlaneGeometry(100, 100);
  if (spring) {
    groundGeometry.dispose();
    const shape = new THREE.Shape();
    shape.moveTo(-50, -38); shape.lineTo(50, -38); shape.lineTo(50, 62); shape.lineTo(-50, 62); shape.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, 1.36, 0, Math.PI * 2, true); shape.holes.push(hole);
    groundGeometry = new THREE.ShapeGeometry(shape, 48);
    const uv = groundGeometry.getAttribute("uv"), position = groundGeometry.getAttribute("position");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (position.getX(i) + 50) / 100, (position.getY(i) + 38) / 100);
  }
  const ground = addMesh(groundGeometry, grass, 0, kind === "river" ? groundY - .30 : groundY, spring ? 0 : -12);
  ground.name = "meadow-ground";
  ground.rotation.x = -Math.PI / 2;

  if (!night && !coastal) {
    meadow = createStylizedMeadow({ kind, floor: groundY, id });
    root.add(meadow.mesh); grass.color.set(0xffffff); grass.map = meadow.groundMap;
  }

  if (!night && !coastal) {
    // Three layered organic rolling ridge silhouettes frame the horizon with aerial depth.
    const ridgeSpecs: readonly RidgeLayerSpec[] = [
      {
        name: 'distant-ridge-near',
        role: 'hill',
        originalHex: 0x86b95c,
        deliveryHex: DELIVERY_PALETTE.hill,
        columns: 56,
        spanX: 46,
        baseZ: -18.2,
        curveZ: 1.6,
        slopeDepth: 2.4,
        peakHeight: 2.35,
        phaseA: 0.75,
        phaseB: 1.9,
        phaseC: 0.4,
        valleyDip: 0.42,
        crestTint: [1.14, 1.12, 0.94],
        baseTint: [0.84, 0.94, 1.04],
      },
      {
        name: 'distant-ridge-mid',
        role: 'distantHill',
        originalHex: 0xa3cb7a,
        deliveryHex: DELIVERY_PALETTE.distantHill,
        columns: 56,
        spanX: 62,
        baseZ: -25.2,
        curveZ: 2.1,
        slopeDepth: 3.1,
        peakHeight: 3.75,
        phaseA: 2.35,
        phaseB: 0.55,
        phaseC: 2.1,
        valleyDip: 0.22,
        crestTint: [1.11, 1.11, 0.98],
        baseTint: [0.85, 0.95, 1.07],
      },
      {
        name: 'distant-ridge-far',
        role: 'farRidge',
        originalHex: 0xb4cfc8,
        deliveryHex: 0xaecfb8,
        columns: 60,
        spanX: 78,
        baseZ: -33.4,
        curveZ: 2.6,
        slopeDepth: 3.8,
        peakHeight: 5.4,
        phaseA: 4.1,
        phaseB: 2.8,
        phaseC: 1.25,
        valleyDip: 0.12,
        crestTint: [1.08, 1.09, 1.03],
        baseTint: [0.86, 0.96, 1.10],
      },
    ];
    for (const spec of ridgeSpecs) {
      const { geometry, baseColors } = createMountainRidgeGeometry(spec, kind === 'river');
      const material = new THREE.MeshStandardMaterial({
        color: spec.originalHex,
        roughness: 1,
        metalness: 0,
        vertexColors: true,
      });
      material.userData.backdropRole = spec.role;
      materials.add(material);
      const ridge = addMesh(geometry, material, 0, groundY, 0);
      ridge.name = spec.name;
      ridge.userData.distantRidge = true;
      ridge.castShadow = false;
      ridge.receiveShadow = false;
      ridgeRecords.push({
        geometry,
        material,
        baseColors,
        originalHex: spec.originalHex,
        deliveryHex: spec.deliveryHex,
      });
    }
  }

  let lightMotes: ReturnType<typeof createKomorebiLightMotes> | undefined;
  if (!coastal) {
    lightMotes = createKomorebiLightMotes({ id, groundY, night });
    geometries.add(lightMotes.geometry);
    materials.add(lightMotes.material);
    textures.add(lightMotes.sprite);
    instances.push(lightMotes.mesh);
    root.add(lightMotes.mesh);
  }

  let nightLampPool: ReturnType<typeof createNightLampPool> | undefined;
  if (night) {
    nightLampPool = createNightLampPool(surfaceY);
    geometries.add(nightLampPool.geometry);
    materials.add(nightLampPool.material);
    textures.add(nightLampPool.texture);
    root.add(nightLampPool.mesh);
  }

  if (kind === "courtyard") {
    stonePath = createCourtyardStonePath({ floor, night, skin: courtyardSkin });
    root.add(stonePath.mesh);
    if (stonePath.mossMesh) root.add(stonePath.mossMesh);
  } else if (kind === "veranda") {
    const deckHeight = 0.12;
    const deckY = floor - 0.055;
    const seamGap = 0.010;
    const edgeDepth = 0.18;
    const plankDepth = 5.3 - edgeDepth - seamGap;
    const plankZ = 0.2 + (edgeDepth + seamGap) / 2;
    const edgeZ = 0.2 - 5.3 / 2 + edgeDepth / 2;
    const seamBacking = makeMaterial(night ? 0x8c846e : 0xbfa07a, 'trim');
    seamBacking.color.copy(tintWoodColor(night ? 0x8c846e : 0xbfa07a, -0.005, 0.015, -0.14));
    seamBacking.roughness = 0.96;
    // Continuous recessed sub-deck strictly above meadow-ground (y = floor) and below
    // deck top (floor + 0.005) prevents green ground bleed while keeping a warm seam valley.
    const backing = box(11.97, 0.098, 5.27, seamBacking, 0, floor - 0.0462, 0.2);
    backing.name = 'veranda-deck-backing';
    backing.userData.toonSurface = { outline: false, shading: "smooth", roughness: 0.96 };
    buildPlankDeck('veranda-deck', VERANDA_PLANK_WIDTHS, 12, deckHeight, plankDepth, deckY, plankZ, seamGap, 0.012);
    const edgeMat = makeWoodMaterial('wood', 'x', { dh: -0.004, ds: 0.014, dl: -0.022, scale: 0.54, strength: 0.15, roughness: 0.90 });
    woodBox('veranda-deck-edge', 12, deckHeight, edgeDepth, edgeMat, 0, deckY, edgeZ, 0.012, { offset: [0.42, -0.15, 0.23] });
    // A low rail anchors the eye without surrounding the subject with a box.
    const postMats = [
      makeWoodMaterial('wood', 'y', { dh: -0.004, ds: 0.016, dl: -0.026, scale: 0.72, strength: 0.21, roughness: 0.88 }),
      makeWoodMaterial('wood', 'y', { dh: 0.004, ds: -0.010, dl: -0.010, scale: 0.84, strength: 0.20, roughness: 0.87 }),
    ];
    const capMat = makeWoodMaterial('trim', 'x', { scale: 0.80, strength: 0.16, roughness: 0.89 });
    const railMat = makeWoodMaterial('wood', 'x', { dh: -0.003, ds: 0.012, dl: -0.018, scale: 0.68, strength: 0.20, roughness: 0.87 });
    const postFlips: readonly WoodFlip[] = ['none', 'y', 'x', 'z'];
    ([-4.6, -2.3, 2.3, 4.6] as const).forEach((x, index) => {
      woodBox('veranda-rail-post', 0.12, 0.66, 0.12, postMats[index % 2]!, x, floor + 0.32, -2.5, 0.016, {
        flip: postFlips[index % 4]!,
        offset: [0.18 * (index - 1.5), 0.31 * (index % 2 ? -1 : 1), 0.22 * (index - 1)],
      });
      woodBox('veranda-rail-cap', 0.146, 0.026, 0.146, capMat, x, floor + 0.653, -2.5, 0.007, {
        flip: index % 2 ? 'y' : 'none',
        offset: [0.24 * (index - 1.5), 0.08, -0.19 * (index % 2 ? 1 : -1)],
      });
    });
    ([-3.5, 3.5] as const).forEach((x, index) => {
      woodBox('veranda-rail-bar', 3, 0.10, 0.10, railMat, x, floor + 0.58, -2.5, 0.016, {
        flip: index === 0 ? 'none' : 'y',
        offset: index === 0 ? [0.46, 0.14, -0.18] : [-0.58, -0.16, 0.25],
      });
    });
  } else if (kind === "table") {
    const seamBacking = makeMaterial(night ? 0x8c846e : 0xbfa07a, 'trim');
    seamBacking.color.copy(tintWoodColor(night ? 0x8c846e : 0xbfa07a, -0.005, 0.015, -0.14));
    seamBacking.roughness = 0.96;
    const backing = box(5.77, 0.104, 3.37, seamBacking, 0, floor - 0.073, 0.35);
    backing.name = 'table-deck-backing';
    backing.userData.toonSurface = { outline: false, shading: "smooth", roughness: 0.96 };
    buildPlankDeck('table-deck', TABLE_PLANK_WIDTHS, 5.8, 0.13, 3.4, floor - 0.08, 0.35, 0.010, 0.013);
    // The paper's existing folding/lifting motion stays unobstructed.
    const legMats = [
      makeWoodMaterial('wood', 'y', { dh: -0.004, ds: 0.015, dl: -0.024, scale: 0.70, strength: 0.20, roughness: 0.88 }),
      makeWoodMaterial('wood', 'y', { dh: 0.004, ds: -0.010, dl: -0.008, scale: 0.82, strength: 0.19, roughness: 0.87 }),
    ];
    ([-2.1, 2.1] as const).forEach((x, index) => {
      woodBox('table-front-post', 0.15, 0.68, 0.15, legMats[index]!, x, floor - 0.43, 1.25, 0.018, {
        flip: index === 0 ? 'none' : 'y',
        offset: index === 0 ? [0.22, 0.28, -0.16] : [-0.26, -0.31, 0.21],
      });
    });
  } else if (kind === "river") {
    ground.material = makeMaterial(coastal ? 0x9ab8ad : 0xb3c39b);
    for (const x of coastal ? [] : [-5, 5]) box(5, 0.10, 46, grass, x, floor + 0.025, -13);
  } else {
    gardenPad = createGardenCourtyardPad({ floor, night, skin: courtyardSkin, spring });
    root.add(gardenPad.mesh);
    if (gardenPad.borderMesh) root.add(gardenPad.borderMesh);
    if (gardenPad.mossMesh) root.add(gardenPad.mossMesh);
  }

  if (!coastal && kind !== "river" && courtyardSkin !== "none") {
    regionalCourtyard = createRegionalCourtyard({
      skin: courtyardSkin,
      kind,
      id,
      groundY,
      night,
    });
    root.add(regionalCourtyard.root);
  }

  const propParts = (name: string) => {
    const model = models[name];
    if (!model) throw new Error(`Missing bundled nature prop: ${name}`);
    let parts = propGeometries.get(name);
    if (!parts) {
      parts = model.parts.map(part => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(part.normals, 3));
        geometry.setIndex(part.indices);
        geometries.add(geometry);
        return geometry;
      });
      propGeometries.set(name, parts);
    }
    return parts;
  };
  const propMaterial = (name: string, part: Part, index: number) => {
    const color = new THREE.Color().setRGB(part.color[0], part.color[1], part.color[2]);
    const backdropRole: BackdropRole = name.startsWith('rock') ? 'stone' : !name.startsWith('flowers') || index === 0 ? 'foliage'
      : index === 1 ? (name === 'flowers' ? 'flower' : 'bloom') : 'blossomHeart';
    if (name.startsWith("rock")) color.lerp(new THREE.Color(night ? 0x91a9a4 : 0xc3c6aa), 0.72);
    else if (color.g > color.r * 1.1) color.lerp(new THREE.Color(night ? 0x729988 : 0x6fa84c), night ? 0.48 : 0.65);
    else if (name.startsWith("tree")) color.lerp(new THREE.Color(night ? 0xa78e70 : 0xb5906c), 0.65);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    if (name.startsWith('rock')) material.userData.environmentRole = 'stone';
    else if (name === 'flowers') material.userData.environmentRole = color.g > color.r * 1.1 ? 'foliage' : 'flower';
    material.userData.backdropRole = backdropRole;
    materials.add(material);
    return material;
  };
  const prop = (name: string, x: number, z: number, scale: number, rotation = 0) => {
    const parts = propParts(name);
    const group = new THREE.Group();
    group.position.set(x, groundY + 0.014, z);
    group.scale.setScalar(scale);
    group.rotation.y = rotation;
    models[name].parts.forEach((part, index) => {
      const mesh = new THREE.Mesh(parts[index], propMaterial(name, part, index));
      mesh.userData.toonSurface = { outline: false, shading: "smooth" };
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    });
    root.add(group);
    return group;
  };
  if (night) {
    // Preserve the quiet night arrangement around the authored lamps.
    const trees: [number, number, number][] = [
      [-6.8, -6.5, 3.7], [7.0, -7.5, 3.4], [-7.0, -8.8, 3.9],
      [7.4, -10, 5.5], [-4.4, -11, 2.7], [4.6, -13, 3.1], [-10, -15, 6.3], [10.4, -16, 5.3],
    ];
    treePlacements = trees.map(([x, z, scale], index) => ({ x, z, scale, turn: index * .8 }));
    for (const [x, z, scale] of [[-2.8, -2.3, 1.3], [3.0, -3.3, 1.1], [-5.2, -6.6, 1.8], [4, -7, 1.5]]) {
      prop("bush", x, z, scale, x);
    }
    for (const [x, z, scale] of [[-2.2, -1.4, 0.7], [2.7, -2.0, 0.6], [-3.8, -4.0, 1.0], [3.5, -5.6, 0.9]]) {
      prop("rock", x, z, scale, z);
    }
    for (let i = 0; i < 3; i++) {
      prop("flowers", (i % 2 ? -1 : 1) * (3.0 + i * 0.35), -2.6 - i * 1.15, 0.65, i);
    }
  } else if (!coastal) {
    const planting = new THREE.Group(); planting.name = "daylight-planting"; root.add(planting);
    const layout = gardenLayout(kind, id).filter(item => id !== "chinowa-kuguri" || Math.abs(item.x) > 7.8 || item.z < -5.5), transform = new THREE.Object3D();
    treePlacements = layout.filter(item => item.model.startsWith('tree-'));
    for (const name of new Set(layout.filter(item => !item.model.startsWith("tree-")).map(item => item.model))) {
      const placements = layout.filter(item => item.model === name), parts = propParts(name);
      models[name].parts.forEach((part, index) => {
        const mesh = new THREE.InstancedMesh(parts[index], propMaterial(name, part, index), placements.length);
        mesh.name = `nature-${name}`;
        mesh.userData.toonSurface = { outline: false, shading: "smooth" };
        mesh.castShadow = mesh.receiveShadow = true;
        placements.forEach((item, i) => {
          transform.position.set(item.x, groundY + .014 + (item.lift ?? 0), item.z);
          transform.rotation.set(0, item.turn, 0); transform.scale.setScalar(item.scale); transform.updateMatrix();
          mesh.setMatrixAt(i, transform.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        instances.push(mesh); planting.add(mesh);
      });
    }
  }
  if (id === "celtic-folk-spring") {
    for (let i = 0; i < 14; i++) {
      const angle = i * Math.PI * 2 / 14;
      prop("rock", Math.cos(angle) * 1.72, Math.sin(angle) * 1.72, 0.65 + (i % 3) * 0.06, angle);
    }
  }

  function syncRidgePalette() {
    for (const ridge of ridgeRecords) {
      const attr = ridge.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
      if (attr) {
        (attr.array as Float32Array).set(ridge.baseColors);
        attr.needsUpdate = true;
      }
      ridge.material.color.setHex(tone === 'tiny-delivery' ? ridge.deliveryHex : ridge.originalHex);
    }
  }

  const treeRecommendation = getSceneTreeDefault(id);
  const treeRendering = createEnvironmentTrees(treePlacements, groundY, { load: loadTree,
    onChange: report => {
      toneDirty = true;
      if (report.status === 'ready') { toneSurfaces.refresh(); syncRidgePalette(); toneDirty = false; }
      onTrees?.(report);
    }, invalidate, recommendation: treeRecommendation, camera });
  root.add(treeRendering.root);
  const file = night ? "kloppenheim-02-night-1k.hdr" : "kloppenheim-06-sky-1k.hdr";
  const skyReady = loadSky(assetUrl(`environments/${file}`))
    .then(texture => {
      if (disposed) { texture.dispose(); return; }
      sky = texture;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      if (night && !backdrop && tone === 'original') scene.background = texture;
      invalidate();
    })
    .catch(() => { /* Local sky unavailable: the fully built garden still renders. */ });

  const lights = new WeakSet<THREE.Light>();
  const hemiDirections = new Map<THREE.HemisphereLight,THREE.Vector3>();
  const targetPositions = new Map<THREE.DirectionalLight, THREE.Vector3>();
  const meshes = new WeakSet<THREE.Mesh>();
  const shadowPlanes = new Map<THREE.Mesh, boolean>();
  const previewShadows = new Map<THREE.DirectionalLight, { intensity: number; radius: number }>();
  const stageFocus = new THREE.Vector3(0, surfaceY, 0);
  const sunOffset = new THREE.Vector3();
  const snappedFocus = new THREE.Vector3();
  const lightWorldPos = new THREE.Vector3();
  const lampPoolColor = new THREE.Color();
  const warmAmberTint = new THREE.Color(0xffb45c);
  function restorePreviewShadows() {
    previewShadows.forEach((original, light) => { light.shadow.intensity = original.intensity; light.shadow.radius = original.radius; });
    previewShadows.clear();
  }
  function setTone(next: EnvironmentTone) {
    if (disposed || next === tone) return;
    tone = next;
    stonePath?.setTone(next);
    gardenPad?.setTone(next);
    regionalCourtyard?.setTone(next);
    // Restore PBR sources first, so the shared palette remap also visits them.
    calibrated.setEnabled(false);
    toneSurfaces.setTone(next); syncRidgePalette(); meadow?.setTone(next); komorebiMeadow?.setTone(next);
    calibrated.setEnabled(next === 'komorebi' && !night);
    if (next === 'tiny-delivery') {
      deliveryBackdrop ??= createSkyBackdrop(clearDay, night, true);
      scene.background = deliveryBackdrop;
      scene.backgroundIntensity = 1; scene.backgroundBlurriness = 0;
      scene.fog?.color.setHex(night ? 0x304959 : DELIVERY_PALETTE.horizon);
      scene.environmentIntensity = night ? .2 : .26;
    } else if (next === 'komorebi') {
      komorebiBackdrop ??= createSkyBackdrop(clearDay, night, false, true);
      scene.background = komorebiBackdrop; scene.backgroundIntensity = 1; scene.backgroundBlurriness = 0;
      scene.fog?.color.setHex(night ? 0x20395a : KOMOREBI_PALETTE.horizon);
      scene.environmentIntensity = .16;
    } else {
      scene.background = backdrop ?? sky ?? new THREE.Color(horizon);
      scene.backgroundIntensity = night && !backdrop ? .065 : 1;
      scene.backgroundBlurriness = night && !backdrop ? .015 : 0;
      scene.fog?.color.setHex(horizon);
      scene.environmentIntensity = warmLight ? .25 : night ? .16 : .22;
    }
    invalidate();
  }
  setTone(DEFAULT_ENVIRONMENT_TONE);
  function setGrassMethod(next: GrassRenderMethod) {
    if (disposed || !meadow || next === grassMethod) return;
    if (next === 'komorebi' && !komorebiMeadow) {
      komorebiMeadow = createKomorebiMeadow({ kind, floor: groundY, id }); root.add(komorebiMeadow.root); komorebiMeadow.setTone(tone);
    }
    grassMethod = next; meadow.mesh.visible = next === 'original';
    if (komorebiMeadow) komorebiMeadow.root.visible = next === 'komorebi';
    grass.map = next === 'komorebi' ? komorebiMeadow!.groundMap : meadow.groundMap;
    if (next === 'komorebi' && !komorebiGround) {
      komorebiGround = decorateMeadowGround(createKomorebiSurface(), komorebiMeadow!.groundStrokes);
      komorebiGround.name = 'Komorebi meadow ground';
      materials.add(komorebiGround);
    }
    if (komorebiGround) {
      komorebiGround.map=komorebiMeadow!.groundMap;
      root.traverse(object=>{
        if (!(object instanceof THREE.Mesh)) return;
        if (next==='komorebi' && object.material===grass) object.material=komorebiGround!;
        else if (next==='original' && object.material===komorebiGround) object.material=grass;
      });
    }
    invalidate();
  }
  setGrassMethod(DEFAULT_GRASS_METHOD);
  let captureReady = false;
  const ready = Promise.all([skyReady, treeRendering.ready]).then(() => { captureReady = true; });
  return {
    kind, ready,
    get captureReady() { return captureReady; },
    setTone,
    hasGrass: !!meadow,
    setGrassMethod,
    captureDefaultGrass() {
      if (!meadow || grassMethod === DEFAULT_GRASS_METHOD) return undefined;
      const selected = grassMethod; setGrassMethod(DEFAULT_GRASS_METHOD); return () => setGrassMethod(selected);
    },
    captureDefaultTone() {
      const selected = tone;
      if (selected === DEFAULT_ENVIRONMENT_TONE) return undefined;
      setTone(DEFAULT_ENVIRONMENT_TONE);
      return () => setTone(selected);
    },
    treeCount: treePlacements.length,
    treeRecommendation,
    captureDefaultTrees: treeRendering.captureDefault,
    setTreeMethod(method: TreeRenderMethod) { return treeRendering.select(method); },
    prepare(renderer: THREE.WebGLRenderer, style: RenderStyleId = "toon-soft", { advanceMotion = true } = {}) {
      treeRendering.reframe();
      if (toneDirty) { toneSurfaces.refresh(); syncRidgePalette(); toneDirty = false; }
      const delivery = tone === 'tiny-delivery';
      const komorebi = tone === 'komorebi';
      const paintedDay = style === "gouache" && !night;
      const softTrees = treeRendering.isPreviewVisible();
      if (!softTrees) restorePreviewShadows();
      if (advanceMotion) {
        const now = performance.now() * .001, motion = readSceneMotion(renderer.domElement);
        let dt = 0;
        if (motion.reducedMotion) {
          windTime = 0;
        } else if (motion.active && lastFrame) {
          dt = Math.min(.05, Math.max(0, now - lastFrame));
          windTime += dt;
        }
        lastFrame = now;
        environmentWind.update(windTime, dt, motion.reducedMotion);
        meadow?.update(windTime);
        if (grassMethod === 'komorebi') komorebiMeadow?.update(windTime);
        treeRendering.update(windTime, motion.reducedMotion);
        clouds?.update(windTime);
        lightMotes?.update(windTime, motion.reducedMotion, environmentWind);
      }
      let keySeen = false;
      let lampWeightSum = 0;
      let lampPeakIntensity = 0;
      let lampWeightedX = 0;
      let lampWeightedZ = 0;
      let lampWeightedHeight = 0;
      let lampWeightedR = 0;
      let lampWeightedG = 0;
      let lampWeightedB = 0;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = !softTrees && (night || paintedDay || delivery) ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          const surfaces = Array.isArray(object.material) ? object.material : [object.material];
          if (
            object.userData.keepInOutdoorEnvironment !== true &&
            surfaces.length > 0 &&
            surfaces.every(material => material instanceof THREE.ShadowMaterial)
          ) {
            if (!shadowPlanes.has(object)) shadowPlanes.set(object, object.visible);
            object.visible = false;
          }
          if (!meshes.has(object)) {
            meshes.add(object);
            if (surfaces.some(material => material instanceof THREE.MeshStandardMaterial && !material.transparent)) {
              object.castShadow = !object.userData.komorebiGrass && !object.userData.stonePath && !object.userData.courtyardSkin && !object.userData.distantRidge;
              object.receiveShadow = !object.userData.importedTreeFoliage && !object.userData.distantRidge && !object.userData.courtyardGlow;
            }
          }
        }
        if (!(object instanceof THREE.Light)) return;
        const first = !lights.has(object);
        if (first) lights.add(object);
        if (object instanceof THREE.PointLight) {
          if (nightLampPool && object.visible && object.intensity > 0.001) {
            object.updateWorldMatrix(true, false);
            object.getWorldPosition(lightWorldPos);
            const weight = object.intensity;
            lampWeightSum += weight;
            if (weight > lampPeakIntensity) lampPeakIntensity = weight;
            lampWeightedX += lightWorldPos.x * weight;
            lampWeightedZ += lightWorldPos.z * weight;
            lampWeightedHeight += Math.max(0.12, lightWorldPos.y - surfaceY) * weight;
            lampWeightedR += object.color.r * weight;
            lampWeightedG += object.color.g * weight;
            lampWeightedB += object.color.b * weight;
          }
          return;
        }
        if (object instanceof THREE.AmbientLight) {
          object.color.set(warmLight ? 0xffe0b9 : night ? 0xa8bddb : delivery ? 0xffedcf : 0xfff8ee);
          object.intensity = warmLight ? 0.35 : night ? 0.24 : paintedDay ? .26 : delivery ? .2 : .18;
          if (komorebi && !night && !warmLight) object.intensity=0;
        } else if (object instanceof THREE.HemisphereLight) {
          object.color.set(night ? 0xaec9e1 : komorebi ? 0x79a8e3 : delivery ? 0xc8e6e6 : 0xd8eeff);
          object.groundColor.set(warmLight ? 0x988568 : night ? 0x536971 : komorebi ? 0x253e57 : delivery ? 0x9fa77c : 0xb9ad8b);
          // Babylon's Color3.FromHexString feeds these lighting floats directly.
          if (komorebi && !night) {
            object.color.setRGB(121 / 255, 168 / 255, 227 / 255);
            if (!warmLight) object.groundColor.setRGB(37 / 255, 62 / 255, 87 / 255);
          }
          object.intensity = warmLight ? 0.6 : night ? 0.48 : paintedDay ? 1 : delivery ? .65 : .6;
          if (komorebi && !night) {
            if (!hemiDirections.has(object)) hemiDirections.set(object,object.position.clone());
            object.intensity=.64*Math.PI; object.position.set(.2,1,.3);
          } else if (hemiDirections.has(object)) {
            object.position.copy(hemiDirections.get(object)!); hemiDirections.delete(object);
          }
        } else if (object instanceof THREE.DirectionalLight) {
          const key = !keySeen;
          keySeen = true;
          object.color.set(warmLight && key ? 0xffd19a : night ? 0xd6e5fb : key ? (komorebi ? 0xfff1dc : delivery ? 0xfff0d5 : 0xfff4e5) : 0xecf4ff);
          if (komorebi && key && !night && !warmLight) object.color.setRGB(1, 241 / 255, 220 / 255);
          object.intensity = warmLight && key ? 1.15 : night ? (key ? 0.65 : 0.2) : (key ? (komorebi ? 3.1 : paintedDay ? 2.9 : delivery ? 3.25 : 3.8) : 0.1);
          if (komorebi && !night && !warmLight) object.intensity=key?1.12*Math.PI:0;
          object.castShadow = key;
          if (key && first) {
            object.shadow.mapSize.set(night ? 1024 : 2048, night ? 1024 : 2048);
            Object.assign(object.shadow.camera, {
              left: -SHADOW_HALF_EXTENT,
              right: SHADOW_HALF_EXTENT,
              top: SHADOW_HALF_EXTENT,
              bottom: -SHADOW_HALF_EXTENT,
              near: SHADOW_NEAR,
              far: SHADOW_FAR,
            });
            object.shadow.bias = -0.00025;
            object.shadow.normalBias = night ? 0.022 : 0.012;
            object.shadow.radius = night ? 4 : KOMOREBI_SHADOW_RADIUS;
            object.shadow.camera.updateProjectionMatrix();
          }
          // A common high side sun makes shapes and contact shadows legible,
          // snapped to light-space shadow texels to prevent edge shimmer.
          // Keep authored night light positions and animated point lights intact.
          if (key) {
            if (!targetPositions.has(object)) targetPositions.set(object, object.target.position.clone());
            const mapSize = object.shadow.mapSize.x || (night ? 1024 : 2048);
            if (!night) {
              sunOffset.set(-6, komorebi ? 12 : 9, komorebi ? 6 : 5);
              snapFocusToShadowTexels(stageFocus, sunOffset, SHADOW_HALF_EXTENT, mapSize, snappedFocus);
              object.target.position.copy(snappedFocus);
              object.position.copy(snappedFocus).add(sunOffset);
              object.target.updateMatrixWorld(true);
            } else {
              sunOffset.copy(object.position).sub(stageFocus);
              snapFocusToShadowTexels(stageFocus, sunOffset, SHADOW_HALF_EXTENT, mapSize, snappedFocus);
              object.target.position.copy(snappedFocus);
              object.target.updateMatrixWorld(true);
            }
          }
          if (key && !softTrees) object.shadow.radius = delivery ? 4 : night ? 4 : KOMOREBI_SHADOW_RADIUS;
          if (softTrees && key) {
            if (!previewShadows.has(object)) previewShadows.set(object, { intensity: object.shadow.intensity, radius: object.shadow.radius });
            object.shadow.intensity = previewShadows.get(object)!.intensity * .52;
            object.shadow.radius = 12;
          }
        }
      });
      if (nightLampPool) {
        if (lampWeightSum > 0) {
          const poolX = lampWeightedX / lampWeightSum;
          const poolZ = lampWeightedZ / lampWeightSum;
          const avgHeight = lampWeightedHeight / lampWeightSum;
          const diameter = THREE.MathUtils.clamp(
            1.45 + avgHeight * 0.85 + Math.sqrt(lampWeightSum) * 0.38,
            1.5,
            3.8,
          );
          lampPoolColor
            .setRGB(lampWeightedR / lampWeightSum, lampWeightedG / lampWeightSum, lampWeightedB / lampWeightSum)
            .lerp(warmAmberTint, 0.25);
          const opacity = THREE.MathUtils.clamp(
            lampPeakIntensity * 0.30 + Math.max(0, lampWeightSum - lampPeakIntensity) * 0.08,
            0,
            0.44,
          );
          nightLampPool.mesh.visible = true;
          nightLampPool.mesh.position.set(poolX, surfaceY + 0.003, poolZ);
          nightLampPool.mesh.scale.set(diameter, diameter, 1);
          nightLampPool.material.color.copy(lampPoolColor);
          nightLampPool.material.opacity = opacity;
        } else {
          nightLampPool.mesh.visible = false;
          nightLampPool.material.opacity = 0;
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      restorePreviewShadows();
      shadowPlanes.forEach((visible, mesh) => { mesh.visible = visible; });
      shadowPlanes.clear();
      hemiDirections.forEach((position,light)=>light.position.copy(position)); hemiDirections.clear();
      targetPositions.forEach((position, light) => {
        light.target.position.copy(position);
        light.target.updateMatrixWorld(true);
      });
      targetPositions.clear();
      root.removeFromParent();
      calibrated.dispose();
      meadow?.dispose();
      komorebiMeadow?.dispose();
      stonePath?.dispose();
      gardenPad?.dispose();
      regionalCourtyard?.dispose();
      treeRendering.dispose();
      clouds?.dispose();
      instances.forEach(mesh => mesh.dispose());
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      textures.clear();
      backdrop?.dispose();
      deliveryBackdrop?.dispose();
      komorebiBackdrop?.dispose();
      sky?.dispose();
      scene.background = previous.background;
      scene.environment = previous.environment;
      scene.fog = previous.fog;
      scene.backgroundIntensity = previous.intensity;
      scene.backgroundBlurriness = previous.blur;
      scene.environmentIntensity = previous.environmentIntensity;
      scene.backgroundRotation.copy(previous.backgroundRotation);
      scene.environmentRotation.copy(previous.environmentRotation);
      if (previous.environmentNight === undefined) delete scene.userData.environmentNight;
      else scene.userData.environmentNight = previous.environmentNight;
      if (previous.environmentId === undefined) delete scene.userData.environmentId;
      else scene.userData.environmentId = previous.environmentId;
      if (previous.environmentSurfaceY === undefined) delete scene.userData.environmentSurfaceY;
      else scene.userData.environmentSurfaceY = previous.environmentSurfaceY;
      if (previous.environmentWind === undefined) delete scene.userData.environmentWind;
      else scene.userData.environmentWind = previous.environmentWind;
    },
  };
}
