import * as THREE from 'three';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import type { CourtyardSkinId } from './courtyard-skins';
import type { EnvironmentTone } from './debug-environment-tone';
import { createKomorebiSurface } from './komorebi-surface';

type RGB = [number, number, number];

function parseHex(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(a: number, b: number): number {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function fbm2(noise: NoiseFunction2D, x: number, y: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function scaleRgb(c: RGB, factor: number): RGB {
  return [
    THREE.MathUtils.clamp(c[0] * factor, 0, 1),
    THREE.MathUtils.clamp(c[1] * factor, 0, 1),
    THREE.MathUtils.clamp(c[2] * factor, 0, 1),
  ];
}

const GARDEN_EDGE_NOISE = createNoise2D(createSeededRandom(0x41a7c9e3));
const GARDEN_STONE_NOISE = createNoise2D(createSeededRandom(0x8c5b2f11));
const GARDEN_ATLAS_NOISE = createNoise2D(createSeededRandom(0x3f71d4a5));
const GARDEN_MOSS_NOISE = createNoise2D(createSeededRandom(0x6b29e7d1));

/**
 * Seamless periodic simplex-noise perimeter scale around the garden courtyard oval (2π-periodic).
 * Produces natural ±0.14m organic bays and promontories instead of a ruler-perfect ellipse.
 */
export function gardenPavingEdgeScale(angle: number, seedOffset = 0): number {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const sx = seedOffset * 0.13;
  const sy = seedOffset * 0.09;
  const macro = GARDEN_EDGE_NOISE(ca * 2.0 + sx, sa * 2.0 + sy) * 0.044;
  const detail = GARDEN_EDGE_NOISE(ca * 4.3 - sy + 7.1, sa * 4.3 + sx - 3.9) * 0.024;
  return THREE.MathUtils.clamp(1 + macro + detail, 0.942, 1.062);
}

/**
 * Exact organic garden paving avoidance boundary matching the undulating curb & edging pebbles,
 * so meadow grass avoids protruding curb stones while naturally hugging concave bays.
 */
export function isInsideGardenPaving(x: number, z: number, margin = 0.18): boolean {
  const angle = Math.atan2(z, x);
  // Conservative envelope covering all regional garden skins' perimeter curb + edging pebbles.
  const baseScale = Math.max(
    gardenPavingEdgeScale(angle, 0),
    gardenPavingEdgeScale(angle, 101),
    gardenPavingEdgeScale(angle, 203),
    gardenPavingEdgeScale(angle, 307),
    gardenPavingEdgeScale(angle, 409),
  );
  const rx = 2.94 * baseScale + margin;
  const rz = 2.26 * baseScale + margin;
  return (x / rx) ** 2 + (z / rz) ** 2 < 1;
}

interface GeometryBuilder {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

function createBuilder(): GeometryBuilder {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

function pushVertex(
  b: GeometryBuilder,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  u: number,
  v: number,
  color: RGB,
): number {
  const index = b.positions.length / 3;
  b.positions.push(x, y, z);
  b.normals.push(nx, ny, nz);
  b.uvs.push(u, v);
  b.colors.push(color[0], color[1], color[2]);
  return index;
}

function finalizeGeometry(b: GeometryBuilder): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  geometry.setIndex(b.indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

let cachedPavingAtlasBytes: Uint8Array<ArrayBuffer> | undefined;
let cachedSpringDetailBytes: Uint8Array<ArrayBuffer> | undefined;

/**
 * Borderless 2×2 procedural paving texture atlas (simplex-noise FBM, luminance centered near 0.99):
 * - (0,0): Fine Shirakawa quartz gravel mineral grain + gentle rake micro-grooves
 * - (1,0): Borderless mottled granite/bluestone/sandstone mineral grain & subtle pores (no box frame)
 * - (0,1): Kiln-fired Saltillo terracotta clay wash with soft mineral fleck (no black digital border)
 * - (1,1): Mottled painterly mortar / sandy earth / moss bed wash
 */
function getPavingAtlasBytes(size = 256): Uint8Array<ArrayBuffer> {
  if (cachedPavingAtlasBytes && cachedPavingAtlasBytes.length === size * size * 4) {
    return cachedPavingAtlasBytes;
  }
  const bytes = new Uint8Array(size * size * 4);
  const half = size / 2;

  for (let py = 0; py < size; py++) {
    const qy = py < half ? 0 : 1;
    const v = (py - qy * half + 0.5) / half;
    for (let px = 0; px < size; px++) {
      const qx = px < half ? 0 : 1;
      const u = (px - qx * half + 0.5) / half;
      const quad = qy * 2 + qx;

      let r = 1;
      let g = 1;
      let b = 1;

      if (quad === 0) {
        // Fine mineral Shirakawa-suna quartz gravel grain + subtle micro-grooves.
        const n1 = hash2(px * 0.85, py * 0.85);
        const n2 = GARDEN_ATLAS_NOISE(u * 14.0 + 3.1, v * 14.0 + 7.4);
        const microGroove = Math.sin(v * Math.PI * 16 + Math.sin(u * Math.PI * 4) * 0.5) * 0.022;
        const sparkle = n1 > 0.91 ? 0.052 : n1 < 0.09 ? -0.052 : n2 * 0.028;
        const shade = THREE.MathUtils.clamp(0.985 + microGroove + sparkle, 0.85, 1.07);
        r = THREE.MathUtils.clamp(shade * 1.005, 0, 1);
        g = THREE.MathUtils.clamp(shade, 0, 1);
        b = THREE.MathUtils.clamp(shade * 0.992, 0, 1);
      } else if (quad === 1) {
        // Borderless isotropic hand-dressed granite / bluestone / sandstone mineral texture.
        const broad = fbm2(GARDEN_ATLAS_NOISE, u * 3.5 + 11.2, v * 3.5 + 5.7, 3);
        const medium = GARDEN_ATLAS_NOISE(u * 9.0 - 4.3, v * 9.0 + 13.8);
        const fine = GARDEN_ATLAS_NOISE(u * 22.0 + 19.4, v * 22.0 - 8.6);
        const pore = fine < -0.58 ? (fine + 0.58) * 0.15 : 0;
        const fleck = fine > 0.64 ? (fine - 0.64) * 0.11 : 0;
        const shade = THREE.MathUtils.clamp(0.992 + Math.tanh(broad * 1.35) * 0.042 + medium * 0.022 + pore + fleck, 0.86, 1.07);
        const hueShift = (broad * 0.7 + medium * 0.3) * 0.016;
        r = THREE.MathUtils.clamp(shade + hueShift * 0.75, 0, 1);
        g = THREE.MathUtils.clamp(shade + hueShift * 0.22, 0, 1);
        b = THREE.MathUtils.clamp(shade - hueShift * 0.85, 0, 1);
      } else if (quad === 2) {
        // Borderless kiln-fired terracotta clay wash: warm organic clouding & mineral fleck.
        const clayBroad = fbm2(GARDEN_ATLAS_NOISE, u * 3.8 + 27.4, v * 3.8 + 14.9, 3);
        const brush = GARDEN_ATLAS_NOISE(u * 9.5 + 1.7, v * 5.2 - 11.3) * 0.026;
        const fleck = GARDEN_ATLAS_NOISE(u * 23.0 - 6.1, v * 23.0 + 29.2) * 0.024;
        const shade = THREE.MathUtils.clamp(0.988 + clayBroad * 0.046 + brush + fleck, 0.86, 1.07);
        r = THREE.MathUtils.clamp(shade * 1.018, 0, 1);
        g = THREE.MathUtils.clamp(shade * 0.992, 0, 1);
        b = THREE.MathUtils.clamp(shade * 0.96, 0, 1);
      } else {
        // Recessed mortar / earthy moss bed wash.
        const earthBroad = fbm2(GARDEN_ATLAS_NOISE, u * 4.2 + 41.3, v * 4.2 + 23.7, 3);
        const grit = GARDEN_ATLAS_NOISE(u * 21.0 + 8.5, v * 21.0 - 15.2) * 0.030;
        const wash = THREE.MathUtils.clamp(0.98 + earthBroad * 0.052 + grit, 0.84, 1.07);
        r = THREE.MathUtils.clamp(wash * 1.01, 0, 1);
        g = THREE.MathUtils.clamp(wash, 0, 1);
        b = THREE.MathUtils.clamp(wash * 0.97, 0, 1);
      }

      const idx = (py * size + px) * 4;
      bytes[idx] = Math.round(r * 255);
      bytes[idx + 1] = Math.round(g * 255);
      bytes[idx + 2] = Math.round(b * 255);
      bytes[idx + 3] = 255;
    }
  }
  cachedPavingAtlasBytes = bytes;
  return bytes;
}

/** Soft pebble & worn-ring detail multiplier for celtic-folk-spring's sand ring. */
function getSpringDetailBytes(size = 128): Uint8Array<ArrayBuffer> {
  if (cachedSpringDetailBytes && cachedSpringDetailBytes.length === size * size * 4) {
    return cachedSpringDetailBytes;
  }
  const bytes = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    const v = (py + 0.5) / size;
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size;
      const dx = (u - 0.5) * 2;
      const dy = (v - 0.5) * 2;
      const rad = Math.hypot(dx, dy);
      const wave = Math.sin(rad * 18 + Math.atan2(dy, dx) * 3) * 0.025;
      const pebble = GARDEN_ATLAS_NOISE(u * 18.0 + 5.1, v * 18.0 - 3.7) * 0.042;
      const rimAO = THREE.MathUtils.smoothstep(rad, 0.78, 1.0) * -0.10;
      const shade = THREE.MathUtils.clamp(0.99 + wave + pebble + rimAO, 0.78, 1.08);
      const idx = (py * size + px) * 4;
      bytes[idx] = Math.round(THREE.MathUtils.clamp(shade * 1.01, 0, 1) * 255);
      bytes[idx + 1] = Math.round(THREE.MathUtils.clamp(shade, 0, 1) * 255);
      bytes[idx + 2] = Math.round(THREE.MathUtils.clamp(shade * 0.97, 0, 1) * 255);
      bytes[idx + 3] = 255;
    }
  }
  cachedSpringDetailBytes = bytes;
  return bytes;
}

function makeTexture(
  bytes: Uint8Array<ArrayBuffer>,
  size: number,
  colorSpace: THREE.ColorSpace,
  name: string,
): THREE.DataTexture {
  const texture = new THREE.DataTexture(bytes.slice(), size, size);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = name;
  return texture;
}

const SUN_DIR = new THREE.Vector3(-6, 12, 6).normalize();

/**
 * Push an irregular hand-dressed polygonal stone block (N perimeter vertices, top plateau fan +
 * smooth-creased chamfered bevel skirt) with geometry-driven directional rim lighting and contact AO.
 */
function pushOrganicPolygonStone(
  b: GeometryBuilder,
  ringXZ: readonly [number, number][],
  baseY: number,
  topY: number,
  bevelInset: number,
  quad: 0 | 1 | 2 | 3,
  color: RGB,
  seed = 0,
) {
  const n = ringXZ.length;
  if (n < 3) return;

  let cx = 0;
  let cz = 0;
  let signedArea2 = 0;
  for (let i = 0; i < n; i++) {
    const p0 = ringXZ[i]!;
    const p1 = ringXZ[(i + 1) % n]!;
    cx += p0[0];
    cz += p0[1];
    // Signed area in XZ looking down from +Y: > 0 means CCW from +Y.
    signedArea2 += p0[1] * p1[0] - p0[0] * p1[1];
  }
  cx /= n;
  cz /= n;
  // Ensure CCW winding viewed from +Y.
  const ordered = signedArea2 >= 0 ? ringXZ : [...ringXZ].reverse();

  let maxSpan = 0.2;
  for (const [x, z] of ordered) {
    maxSpan = Math.max(maxSpan, Math.hypot(x - cx, z - cz));
  }

  const qU0 = (quad % 2) * 0.5 + 0.04;
  const qV0 = Math.floor(quad / 2) * 0.5 + 0.04;
  const qSpan = 0.42;
  const uvAngle = hash2(seed, 71.3) * Math.PI * 2;
  const cosUv = Math.cos(uvAngle);
  const sinUv = Math.sin(uvAngle);

  const toUv = (x: number, z: number): [number, number] => {
    const dx = (x - cx) / maxSpan;
    const dz = (z - cz) / maxSpan;
    const ru = (dx * cosUv - dz * sinUv) * 0.40 + 0.5;
    const rv = (dx * sinUv + dz * cosUv) * 0.40 + 0.5;
    return [
      qU0 + THREE.MathUtils.clamp(ru, 0.02, 0.98) * qSpan,
      qV0 + THREE.MathUtils.clamp(rv, 0.02, 0.98) * qSpan,
    ];
  };

  const basePts: [number, number, number][] = [];
  const topPts: [number, number, number][] = [];
  const baseUvs: [number, number][] = [];
  const topUvs: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    const [bx, bz] = ordered[i]!;
    basePts.push([bx, baseY, bz]);
    baseUvs.push(toUv(bx, bz));

    const dx = bx - cx;
    const dz = bz - cz;
    const dist = Math.hypot(dx, dz) || 1;
    const localBevel = bevelInset * (0.84 + GARDEN_STONE_NOISE(bx * 3.6 + seed, bz * 3.6 - seed) * 0.24);
    const shrink = THREE.MathUtils.clamp((dist - localBevel) / dist, 0.56, 0.92);
    const tx = cx + dx * shrink;
    const tz = cz + dz * shrink;
    // Slight natural worn edge drop (-0.4mm) so center stays flattest without ever exceeding topY.
    topPts.push([tx, topY - 0.0004, tz]);
    topUvs.push(toUv(tx, tz));
  }

  // Top face fan (CCW from +Y -> +Y normal).
  const [cU, cV] = toUv(cx, cz);
  const centerIdx = pushVertex(b, cx, topY, cz, 0, 1, 0, cU, cV, color);
  const topRingIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = topPts[i]!;
    const uv = topUvs[i]!;
    const dx = p[0] - cx;
    const dz = p[2] - cz;
    const len = Math.hypot(dx, dz) || 1;
    const sunAlign = (dx / len) * SUN_DIR.x + (dz / len) * SUN_DIR.z;
    const rimFactor = 1.0 + sunAlign * 0.036 - (1 - Math.max(0, sunAlign)) * 0.02;
    topRingIndices.push(pushVertex(b, p[0], p[1], p[2], 0, 1, 0, uv[0], uv[1], scaleRgb(color, rimFactor)));
  }
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    b.indices.push(centerIdx, topRingIndices[i]!, topRingIndices[next]!);
  }

  // Creased smooth-wrapped bevel skirt.
  const bevelTopIdx: number[] = [];
  const bevelBaseIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = (i + n - 1) % n;
    const next = (i + 1) % n;
    const pT = topPts[i]!;
    const pB = basePts[i]!;
    const pPrev = topPts[prev]!;
    const pNext = topPts[next]!;

    const e1x = pNext[0] - pPrev[0];
    const e1y = pNext[1] - pPrev[1];
    const e1z = pNext[2] - pPrev[2];
    const e2x = pB[0] - pT[0];
    const e2y = pB[1] - pT[1];
    const e2z = pB[2] - pT[2];
    const nx = e2y * e1z - e2z * e1y;
    const ny = e2z * e1x - e2x * e1z;
    const nz = e2x * e1y - e2y * e1x;
    const len = Math.hypot(nx, ny, nz) || 1;
    const ux = nx / len;
    const uy = Math.max(0.28, ny / len);
    const uz = nz / len;
    const normLen = Math.hypot(ux, uy, uz) || 1;
    const fx = ux / normLen;
    const fy = uy / normLen;
    const fz = uz / normLen;

    const sunDot = fx * SUN_DIR.x + fy * SUN_DIR.y + fz * SUN_DIR.z;
    const sunT = THREE.MathUtils.clamp((sunDot + 0.4) / 1.1, 0, 1);
    const topFactor = THREE.MathUtils.lerp(0.86, 1.04, sunT);
    const baseFactor = THREE.MathUtils.lerp(0.68, 0.80, sunT);

    bevelTopIdx.push(pushVertex(b, pT[0], pT[1], pT[2], fx, fy, fz, topUvs[i]![0], topUvs[i]![1], scaleRgb(color, topFactor)));
    bevelBaseIdx.push(pushVertex(b, pB[0], pB[1], pB[2], fx, fy, fz, baseUvs[i]![0], baseUvs[i]![1], scaleRgb(color, baseFactor)));
  }
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const i0 = bevelTopIdx[i]!;
    const i1 = bevelTopIdx[next]!;
    const i2 = bevelBaseIdx[i]!;
    const i3 = bevelBaseIdx[next]!;
    b.indices.push(i0, i2, i1, i1, i2, i3);
  }
}

/**
 * Convert a 4-corner cell into an organic 10-vertex hand-dressed flagstone/tile contour with
 * subtly weathered edges, soft rounded/chipped corners, and simplex-noise micro-undulation.
 */
function buildHandDressedCellPolygon(
  cornersXZ: readonly [number, number][],
  roughness: number,
  cornerRound: number,
  seed: number,
): [number, number][] {
  let cx = 0;
  let cz = 0;
  for (const [x, z] of cornersXZ) {
    cx += x;
    cz += z;
  }
  cx /= 4;
  cz /= 4;

  const pts: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    const a = cornersXZ[i]!;
    const b = cornersXZ[(i + 1) % 4]!;
    const c = cornersXZ[(i + 2) % 4]!;
    const edgeLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nextLen = Math.hypot(c[0] - b[0], c[1] - b[1]);
    // Outward edge normal for mid-edge hand-chiseled undulation.
    const mx = (a[0] + b[0]) * 0.5;
    const mz = (a[1] + b[1]) * 0.5;
    const outX = mx - cx;
    const outZ = mz - cz;
    const outLen = Math.hypot(outX, outZ) || 1;
    const midWave = GARDEN_STONE_NOISE(mx * 3.8 + seed, mz * 3.8 - seed * 0.7) * roughness * Math.min(edgeLen, 0.55);

    const cutBefore = THREE.MathUtils.clamp(cornerRound * (0.78 + hash2(seed + i * 7, 13) * 0.44), 0.04, 0.24);
    const cutAfter = THREE.MathUtils.clamp(cornerRound * (0.78 + hash2(seed + i * 11, 29) * 0.44), 0.04, 0.24);

    // Mid-edge sculpted point + two chamfered/worn corner points around vertex b.
    pts.push([mx + (outX / outLen) * midWave, mz + (outZ / outLen) * midWave]);
    const beforeX = THREE.MathUtils.lerp(b[0], a[0], cutBefore * Math.min(1, 0.42 / Math.max(edgeLen, 0.12)));
    const beforeZ = THREE.MathUtils.lerp(b[1], a[1], cutBefore * Math.min(1, 0.42 / Math.max(edgeLen, 0.12)));
    const afterX = THREE.MathUtils.lerp(b[0], c[0], cutAfter * Math.min(1, 0.42 / Math.max(nextLen, 0.12)));
    const afterZ = THREE.MathUtils.lerp(b[1], c[1], cutAfter * Math.min(1, 0.42 / Math.max(nextLen, 0.12)));
    pts.push([beforeX, beforeZ]);
    pts.push([afterX, afterZ]);
  }
  return pts;
}

/** Add a smooth organic shoulder pebble/cobble dome tucked beside outer garden curbs. */
function pushGardenCobble(
  b: GeometryBuilder,
  cx: number,
  cz: number,
  radX: number,
  radZ: number,
  baseY: number,
  topY: number,
  yaw: number,
  color: RGB,
  seed: number,
) {
  const segs = 10;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const qU0 = 0.54;
  const qV0 = 0.04;
  const qSpan = 0.42;

  const shoulderPts: [number, number, number][] = [];
  const basePts: [number, number, number][] = [];
  const uvs: [number, number][] = [];

  for (let s = 0; s < segs; s++) {
    const a = (s / segs) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const wobble = 0.84 + GARDEN_STONE_NOISE(ca * 1.45 + seed, sa * 1.45 - seed * 0.7) * 0.24;
    const lx = ca * radX * wobble;
    const lz = sa * radZ * wobble;
    const wx = cx + lx * cosY - lz * sinY;
    const wz = cz + lx * sinY + lz * cosY;
    basePts.push([wx, baseY, wz]);
    shoulderPts.push([cx + (wx - cx) * 0.64, THREE.MathUtils.lerp(baseY, topY, 0.78), cz + (wz - cz) * 0.64]);
    uvs.push([qU0 + (0.5 + ca * 0.40) * qSpan, qV0 + (0.5 + sa * 0.40) * qSpan]);
  }

  const cIdx = pushVertex(b, cx, topY, cz, 0, 1, 0, qU0 + qSpan * 0.5, qV0 + qSpan * 0.5, scaleRgb(color, 1.05));
  const sIdx: number[] = [];
  const bIdx: number[] = [];

  for (let s = 0; s < segs; s++) {
    const sp = shoulderPts[s]!;
    const bp = basePts[s]!;
    const uv = uvs[s]!;
    const dx = bp[0] - cx;
    const dz = bp[2] - cz;
    const len = Math.hypot(dx, dz) || 1;
    const sunDot = (dx / len) * SUN_DIR.x + (dz / len) * SUN_DIR.z;
    sIdx.push(pushVertex(b, sp[0], sp[1], sp[2], (dx / len) * 0.42, 0.91, (dz / len) * 0.42, uv[0], uv[1], scaleRgb(color, 0.96 + sunDot * 0.08)));
    bIdx.push(pushVertex(b, bp[0], bp[1], bp[2], (dx / len) * 0.82, 0.57, (dz / len) * 0.82, uv[0], uv[1], scaleRgb(color, 0.73 + sunDot * 0.06)));
  }

  for (let s = 0; s < segs; s++) {
    const next = (s + 1) % segs;
    b.indices.push(cIdx, sIdx[next]!, sIdx[s]!);
    b.indices.push(sIdx[s]!, sIdx[next]!, bIdx[s]!, sIdx[next]!, bIdx[next]!, bIdx[s]!);
  }
}

/** Add an organically undulating mortar/earth base disc whose outer rim tapers cleanly into meadow ground. */
function pushOrganicEllipticalBed(
  b: GeometryBuilder,
  rx: number,
  rz: number,
  y: number,
  centerColor: RGB,
  edgeColor: RGB,
  seedOffset: number,
  radialSegments = 56,
  rings = 5,
) {
  const cIdx = pushVertex(b, 0, y, 0, 0, 1, 0, 0.75, 0.75, centerColor);
  const ringStarts: number[] = [];
  for (let r = 1; r <= rings; r++) {
    const frac = r / rings;
    const isRim = r === rings;
    ringStarts.push(b.positions.length / 3);
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const edgeScale = THREE.MathUtils.lerp(1, gardenPavingEdgeScale(a, seedOffset), THREE.MathUtils.smoothstep(frac, 0.25, 1.0));
      const x = Math.cos(a) * rx * frac * edgeScale;
      const z = Math.sin(a) * rz * frac * edgeScale;
      const edgeT = THREE.MathUtils.smoothstep(frac, 0.45, 1.0);
      const jitter = 0.94 + hash2(r * 7 + seedOffset, s * 3) * 0.12;
      const col = scaleRgb(mixRgb(centerColor, edgeColor, edgeT), jitter);
      const vy = isRim ? y - 0.0045 : y;
      const u = 0.54 + (0.5 + 0.42 * Math.cos(a) * frac) * 0.42;
      const v = 0.54 + (0.5 + 0.42 * Math.sin(a) * frac) * 0.42;
      pushVertex(b, x, vy, z, 0, 1, 0, u, v, col);
    }
  }
  const firstRing = ringStarts[0]!;
  for (let s = 0; s < radialSegments; s++) {
    const next = (s + 1) % radialSegments;
    b.indices.push(cIdx, firstRing + next, firstRing + s);
  }
  for (let r = 1; r < rings; r++) {
    const prev = ringStarts[r - 1]!;
    const curr = ringStarts[r]!;
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments;
      b.indices.push(prev + s, prev + next, curr + s, prev + next, curr + next, curr + s);
    }
  }
}

/**
 * Add an organic undulating ring of hand-dressed natural curb blocks (10-vertex sculpted stone contours
 * with varied angular lengths, simplex-noise outer edge projection/recession, and nestled shoulder cobbles).
 */
function pushOrganicPerimeterCurbRing(
  b: GeometryBuilder,
  innerRx: number,
  innerRz: number,
  outerRx: number,
  outerRz: number,
  segments: number,
  baseY: number,
  topY: number,
  gapAngleFrac: number,
  bevelInset: number,
  quad: 0 | 1 | 2 | 3,
  palette: readonly RGB[],
  seedOffset: number,
  outerRoughness = 1.0,
) {
  // Varied stone angular lengths summing cleanly to 2π so stones aren't cloned uniform wedges.
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < segments; i++) {
    const w = 0.78 + hash2(i + seedOffset, 17) * 0.44;
    weights.push(w);
    weightSum += w;
  }

  let cursorA = hash2(seedOffset, 5) * 0.25;
  for (let i = 0; i < segments; i++) {
    const span = (weights[i]! / weightSum) * Math.PI * 2;
    const gap = span * gapAngleFrac;
    const a0 = cursorA + gap * 0.5;
    const a1 = cursorA + span - gap * 0.5;
    const aMid = (a0 + a1) * 0.5;
    cursorA += span;

    const scale0 = gardenPavingEdgeScale(a0, seedOffset);
    const scaleM = gardenPavingEdgeScale(aMid, seedOffset);
    const scale1 = gardenPavingEdgeScale(a1, seedOffset);

    // Individual stone shoulder protrusion / recession layered over the macro organic bay wave.
    const stepPush = (hash2(i + seedOffset, 13) - 0.42) * 0.085 * outerRoughness;
    const iScale0 = THREE.MathUtils.lerp(1, scale0, 0.55);
    const iScaleM = THREE.MathUtils.lerp(1, scaleM, 0.55);
    const iScale1 = THREE.MathUtils.lerp(1, scale1, 0.55);

    const oRx0 = outerRx * scale0 + stepPush;
    const oRz0 = outerRz * scale0 + stepPush * 0.85;
    const oRxM = outerRx * scaleM + stepPush + GARDEN_STONE_NOISE(Math.cos(aMid) * 6 + seedOffset, Math.sin(aMid) * 6) * 0.045 * outerRoughness;
    const oRzM = outerRz * scaleM + stepPush * 0.85 + GARDEN_STONE_NOISE(Math.cos(aMid) * 6 - seedOffset, Math.sin(aMid) * 6) * 0.04 * outerRoughness;
    const oRx1 = outerRx * scale1 + stepPush * 0.88;
    const oRz1 = outerRz * scale1 + stepPush * 0.75;

    const aQ1 = THREE.MathUtils.lerp(a0, a1, 0.28);
    const aQ3 = THREE.MathUtils.lerp(a0, a1, 0.72);
    const oRxQ1 = THREE.MathUtils.lerp(oRx0, oRxM, 0.65) + GARDEN_STONE_NOISE(i * 2.3 + seedOffset, 1.7) * 0.025 * outerRoughness;
    const oRzQ1 = THREE.MathUtils.lerp(oRz0, oRzM, 0.65) + GARDEN_STONE_NOISE(i * 2.3 + seedOffset, 4.1) * 0.022 * outerRoughness;
    const oRxQ3 = THREE.MathUtils.lerp(oRxM, oRx1, 0.35) + GARDEN_STONE_NOISE(i * 2.3 - seedOffset, 8.9) * 0.025 * outerRoughness;
    const oRzQ3 = THREE.MathUtils.lerp(oRzM, oRz1, 0.35) + GARDEN_STONE_NOISE(i * 2.3 - seedOffset, 12.3) * 0.022 * outerRoughness;

    // 10-vertex hand-dressed irregular curb stone polygon (smoothly rounded outer shoulders + organic back).
    const aInnerInset = span * 0.055;
    const ring: [number, number][] = [
      [Math.cos(a0 + aInnerInset) * innerRx * iScale0, Math.sin(a0 + aInnerInset) * innerRz * iScale0],
      [Math.cos(a0) * THREE.MathUtils.lerp(innerRx * iScale0, oRx0, 0.48), Math.sin(a0) * THREE.MathUtils.lerp(innerRz * iScale0, oRz0, 0.48)],
      [Math.cos(a0 + aInnerInset * 0.9) * oRx0, Math.sin(a0 + aInnerInset * 0.9) * oRz0],
      [Math.cos(aQ1) * oRxQ1, Math.sin(aQ1) * oRzQ1],
      [Math.cos(aMid) * oRxM, Math.sin(aMid) * oRzM],
      [Math.cos(aQ3) * oRxQ3, Math.sin(aQ3) * oRzQ3],
      [Math.cos(a1 - aInnerInset * 0.9) * oRx1, Math.sin(a1 - aInnerInset * 0.9) * oRz1],
      [Math.cos(a1) * THREE.MathUtils.lerp(innerRx * iScale1, oRx1, 0.48), Math.sin(a1) * THREE.MathUtils.lerp(innerRz * iScale1, oRz1, 0.48)],
      [Math.cos(a1 - aInnerInset) * innerRx * iScale1, Math.sin(a1 - aInnerInset) * innerRz * iScale1],
      [Math.cos(aMid) * innerRx * iScaleM * (0.992 + hash2(i + seedOffset, 37) * 0.016), Math.sin(aMid) * innerRz * iScaleM * (0.992 + hash2(i + seedOffset, 37) * 0.016)],
    ];

    const hJitter = (hash2(i + seedOffset, 29) - 0.5) * 0.005;
    const pal = palette[(i + Math.floor(hash2(i + seedOffset, 41) * palette.length)) % palette.length]!;
    const col = scaleRgb(pal, 0.95 + hash2(i + seedOffset, 53) * 0.10);
    pushOrganicPolygonStone(b, ring, baseY, topY + hJitter, bevelInset, quad, col, seedOffset + i * 19.7);

    // Tuck natural shoulder cobbles/pebbles into outer joints and recessed bays along the curb rim.
    if (hash2(i * 7 + seedOffset, 67) > 0.36) {
      const ca = a1 + gap * 0.45 + (hash2(i + seedOffset, 73) - 0.5) * 0.04;
      const cScale = gardenPavingEdgeScale(ca, seedOffset);
      const rU = 0.042 + hash2(i + seedOffset, 79) * 0.045;
      const rV = rU * (0.72 + hash2(i + seedOffset, 83) * 0.48);
      const pushOut = 0.028 + rU * 0.72;
      const cx = Math.cos(ca) * (outerRx * cScale + pushOut);
      const cz = Math.sin(ca) * (outerRz * cScale + pushOut * 0.88);
      const cobCol = scaleRgb(pal, 0.88 + hash2(i + seedOffset, 89) * 0.16);
      pushGardenCobble(
        b,
        cx,
        cz,
        rU,
        rV,
        baseY + 0.001,
        0.006 + hash2(i + seedOffset, 97) * 0.007,
        ca + (hash2(i + seedOffset, 101) - 0.5) * 0.9,
        cobCol,
        seedOffset + i * 31.3,
      );
    }
  }
}

/** Build asymmetric, organic multi-lobe moss pads & crevices aligned with the undulating garden curb. */
function buildOuterMossGeometry(
  rx: number,
  rz: number,
  skin: CourtyardSkinId,
  seedOffset: number,
  edgeSeed: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const mossDark = parseHex(
    skin === 'japanese-karesansui' ? '#4f7637' : skin === 'warm-terracotta-arch' ? '#627c44' : '#537939',
  );
  const mossLight = parseHex(
    skin === 'japanese-karesansui' ? '#82a74f' : skin === 'warm-terracotta-arch' ? '#92a65a' : '#84a652',
  );
  const pebbleTone = parseHex(skin === 'chinese-jiangnan' ? '#6e7579' : '#7b766d');

  // 9 natural asymmetric cluster zones hugging concave bays and curb crevices around the courtyard rim.
  const clusterAngles = [0.18, 0.88, 1.54, 2.24, 2.94, 3.66, 4.38, 5.10, 5.78];
  clusterAngles.forEach((baseA, clusterIdx) => {
    const lobes = skin === 'warm-terracotta-arch' ? 2 : 3;
    for (let l = 0; l < lobes; l++) {
      const a = baseA + (l - 1) * 0.105 + (hash2(clusterIdx * 7 + l + seedOffset, 3) - 0.5) * 0.075;
      const edgeScale = gardenPavingEdgeScale(a, edgeSeed);
      const radialPush = edgeScale * (0.995 + hash2(clusterIdx * 11 + l + seedOffset, 7) * 0.036);
      const mx = Math.cos(a) * rx * radialPush;
      const mz = Math.sin(a) * rz * radialPush;
      const radX = (l === 1 ? 0.165 : 0.108) + hash2(clusterIdx * 5 + l + seedOffset, 11) * 0.058;
      const radZ = radX * (0.70 + hash2(clusterIdx + l + seedOffset, 13) * 0.38);
      const height = (skin === 'japanese-karesansui' ? 0.025 : 0.018) + hash2(clusterIdx + l + seedOffset, 17) * 0.011;
      const segs = 12;
      const lobePhase = hash2(clusterIdx * 13 + l + seedOffset, 19) * Math.PI * 2;
      const lobeSeed = clusterIdx * 23.1 + l * 11.7 + seedOffset;

      const centerIdx = positions.length / 3;
      const toneShift = 0.94 + hash2(clusterIdx * 3 + l + seedOffset, 23) * 0.12;
      const topCol = scaleRgb(mossLight, toneShift);
      const midCol = scaleRgb(mixRgb(mossDark, mossLight, 0.48), toneShift);
      const rimCol = scaleRgb(mossDark, toneShift);
      positions.push(mx, height, mz);
      normals.push(0, 1, 0);
      colors.push(topCol[0], topCol[1], topCol[2]);

      const ringStart = positions.length / 3;
      for (let s = 0; s < segs; s++) {
        const sa = (s / segs) * Math.PI * 2;
        const ca = Math.cos(sa);
        const saSin = Math.sin(sa);
        // Multi-lobe scalloped silhouette driven by simplex-noise + 3/5-lobe harmonics (no plain ovals).
        const nVal = GARDEN_MOSS_NOISE(ca * 1.9 + lobeSeed, saSin * 1.9 - lobeSeed * 0.6);
        const scallop = THREE.MathUtils.clamp(
          0.74 + nVal * 0.24 + Math.sin(sa * 3 + lobePhase) * 0.16 + Math.cos(sa * 5 - lobePhase * 1.2) * 0.08,
          0.48,
          1.22,
        );
        const px = mx + ca * radX * scallop;
        const pz = mz + saSin * radZ * scallop;
        positions.push(px, -0.008, pz);
        normals.push(ca * 0.34, 0.94, saSin * 0.34);
        const edgeCol = scallop > 0.92 ? midCol : rimCol;
        colors.push(edgeCol[0], edgeCol[1], edgeCol[2]);
      }
      for (let s = 0; s < segs; s++) {
        const next = (s + 1) % segs;
        indices.push(centerIdx, ringStart + next, ringStart + s);
      }

      // 2 delicate grass/moss blades rising softly from each cushion.
      for (let k = 0; k < 2; k++) {
        const ba = hash2(clusterIdx * 5 + l, k * 7 + 5) * Math.PI * 2;
        const lean = 0.022 + hash2(clusterIdx + l, k * 11 + 9) * 0.025;
        const bh = 0.046 + hash2(clusterIdx + l, k * 13 + 3) * 0.036;
        const hw = 0.011;
        const ox = (hash2(clusterIdx + l, k * 5 + 1) - 0.5) * radX * 0.68;
        const oz = (hash2(clusterIdx + l, k * 5 + 7) - 0.5) * radZ * 0.68;
        const cos = Math.cos(ba);
        const sin = Math.sin(ba);
        const baseIndex = positions.length / 3;
        const bladeMid = mixRgb(rimCol, topCol, 0.55);
        const pushV = (x: number, y: number, z: number, c: RGB) => {
          positions.push(mx + ox + x, y, mz + oz + z);
          normals.push(0, 1, 0);
          colors.push(c[0], c[1], c[2]);
        };
        pushV(-sin * hw, -0.002, cos * hw, rimCol);
        pushV(sin * hw, -0.002, -cos * hw, rimCol);
        pushV(cos * lean * 0.45 - sin * hw * 0.6, bh * 0.55, sin * lean * 0.45 + cos * hw * 0.6, bladeMid);
        pushV(cos * lean * 0.45 + sin * hw * 0.6, bh * 0.55, sin * lean * 0.45 - cos * hw * 0.6, bladeMid);
        pushV(cos * lean, bh, sin * lean, topCol);
        indices.push(
          baseIndex, baseIndex + 1, baseIndex + 2,
          baseIndex + 1, baseIndex + 3, baseIndex + 2,
          baseIndex + 2, baseIndex + 3, baseIndex + 4,
        );
      }
    }

    // Companion smooth irregular river pebbles nestled beside moss clusters.
    if (skin !== 'warm-terracotta-arch') {
      for (let p = 0; p < 2; p++) {
        const pa = baseA + (p === 0 ? -0.16 : 0.17);
        const pScale = gardenPavingEdgeScale(pa, edgeSeed);
        const px0 = Math.cos(pa) * (rx * pScale * (1.005 + p * 0.015));
        const pz0 = Math.sin(pa) * (rz * pScale * (1.005 + p * 0.015));
        const pRad = 0.052 + hash2(clusterIdx * 3 + p + seedOffset, 47) * 0.038;
        const pH = 0.022 + hash2(clusterIdx + p + seedOffset, 59) * 0.014;
        const pColTop = scaleRgb(pebbleTone, 1.12);
        const pColBase = scaleRgb(pebbleTone, 0.78);
        const pCenter = positions.length / 3;
        positions.push(px0, pH, pz0);
        normals.push(0, 1, 0);
        colors.push(pColTop[0], pColTop[1], pColTop[2]);
        const pRing = positions.length / 3;
        const pSeed = clusterIdx * 17.3 + p * 7.1 + seedOffset;
        for (let s = 0; s < 10; s++) {
          const sa = (s / 10) * Math.PI * 2;
          const ca = Math.cos(sa);
          const saSin = Math.sin(sa);
          const wobble = 0.82 + GARDEN_STONE_NOISE(ca * 1.5 + pSeed, saSin * 1.5 - pSeed) * 0.24;
          positions.push(px0 + ca * pRad * wobble, -0.006, pz0 + saSin * pRad * 0.78 * wobble);
          normals.push(ca * 0.45, 0.89, saSin * 0.45);
          colors.push(pColBase[0], pColBase[1], pColBase[2]);
        }
        for (let s = 0; s < 10; s++) {
          const next = (s + 1) % 10;
          indices.push(pCenter, pRing + next, pRing + s);
        }
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Build an irregular 14-vertex natural flat river/garden stepping stone (飛び石). */
function buildSteppingStoneRing(
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  rot: number,
  seed: number,
  verts = 14,
): [number, number][] {
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const cleaveA = hash2(seed, 11) * Math.PI * 2;
  const cAx = Math.cos(cleaveA);
  const cAy = Math.sin(cleaveA);
  const pts: [number, number][] = [];
  for (let i = 0; i < verts; i++) {
    const a = (i / verts) * Math.PI * 2 + (hash2(seed + i * 5, 19) - 0.5) * 0.14;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const n1 = GARDEN_STONE_NOISE(ca * 1.55 + seed, sa * 1.55 - seed * 0.6);
    const n2 = GARDEN_STONE_NOISE(ca * 3.1 - seed * 0.5, sa * 3.1 + seed * 0.9);
    const rScale = 0.88 + n1 * 0.18 + n2 * 0.07;
    let lx = ca * rx * rScale;
    let lz = sa * rz * rScale;
    const proj = (lx / rx) * cAx + (lz / rz) * cAy;
    if (proj > 0.84) {
      const pull = 0.84 / proj;
      lx *= THREE.MathUtils.lerp(1, pull, 0.75);
      lz *= THREE.MathUtils.lerp(1, pull, 0.75);
    }
    pts.push([cx + lx * cosR - lz * sinR, cz + lx * sinR + lz * cosR]);
  }
  return pts;
}

/**
 * 1) Japanese Karesansui Paving:
 * Smooth welded Shirakawa-suna raked white-gravel heightfield framed by organic hand-dressed
 * Kyoto granite curb stones, irregular natural stepping boulders (飛び石), and nestled river cobbles.
 */
function buildJapaneseKaresansuiPad(): THREE.BufferGeometry {
  const b = createBuilder();
  const innerRx = 2.66;
  const innerRz = 2.02;
  const edgeSeed = 101;
  const rings = 34;
  const segs = 56;

  const gravelTrough = parseHex('#a29b8d');
  const gravelMid = parseHex('#cec8ba');
  const gravelCrest = parseHex('#e7e2d6');
  const gravelRimShadow = parseHex('#948e81');

  const sampleRakedField = (x: number, z: number, radialFrac: number): { y: number; wave01: number } => {
    const r = Math.hypot(x * 0.88, z * 1.12);
    const concentric = Math.cos(r * 23.0);
    const parallel = Math.sin(z * 23.5 + Math.sin(x * 1.25) * 0.75);
    const blend = THREE.MathUtils.smoothstep(radialFrac, 0.34, 0.64);
    const raw = THREE.MathUtils.lerp(concentric, parallel, blend);
    const amp = (0.40 + 0.60 * THREE.MathUtils.smoothstep(r, 0.14, 0.52)) * (1 - THREE.MathUtils.smoothstep(radialFrac, 0.90, 1.0) * 0.72);
    const wave = raw * amp;
    return { y: wave * 0.0034 - 0.0005, wave01: 0.5 + 0.5 * wave };
  };

  const eps = 0.025;
  const sampleNormal = (x: number, z: number, frac: number): [number, number, number] => {
    const hL = sampleRakedField(x - eps, z, frac).y;
    const hR = sampleRakedField(x + eps, z, frac).y;
    const hD = sampleRakedField(x, z - eps, frac).y;
    const hU = sampleRakedField(x, z + eps, frac).y;
    const nx = (hL - hR) * 14.0;
    const nz = (hD - hU) * 14.0;
    const ny = 1.0;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  };

  const cSample = sampleRakedField(0, 0, 0);
  const cIdx = pushVertex(b, 0, cSample.y, 0, 0, 1, 0, 0.25, 0.25, gravelMid);
  const ringStarts: number[] = [];

  for (let r = 1; r <= rings; r++) {
    const frac = r / rings;
    ringStarts.push(b.positions.length / 3);
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const eScale = THREE.MathUtils.lerp(1, gardenPavingEdgeScale(a, edgeSeed), THREE.MathUtils.smoothstep(frac, 0.45, 1.0) * 0.62);
      const x = Math.cos(a) * innerRx * frac * eScale;
      const z = Math.sin(a) * innerRz * frac * eScale;
      const { y, wave01 } = sampleRakedField(x, z, frac);
      const [nx, ny, nz] = sampleNormal(x, z, frac);
      let col = wave01 < 0.5
        ? mixRgb(gravelTrough, gravelMid, wave01 * 2)
        : mixRgb(gravelMid, gravelCrest, (wave01 - 0.5) * 2);
      const rimAO = THREE.MathUtils.smoothstep(frac, 0.88, 1.0);
      col = mixRgb(col, gravelRimShadow, rimAO * 0.42);
      const u = 0.02 + (((x / (innerRx * 2) + 0.5) * 3) % 1 + 1) % 1 * 0.46;
      const v = 0.02 + (((z / (innerRz * 2) + 0.5) * 3) % 1 + 1) % 1 * 0.46;
      pushVertex(b, x, y, z, nx, ny, nz, u, v, col);
    }
  }
  const firstRing = ringStarts[0]!;
  for (let s = 0; s < segs; s++) {
    const next = (s + 1) % segs;
    b.indices.push(cIdx, firstRing + next, firstRing + s);
  }
  for (let r = 1; r < rings; r++) {
    const prev = ringStarts[r - 1]!;
    const curr = ringStarts[r]!;
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      b.indices.push(prev + s, prev + next, curr + s, prev + next, curr + next, curr + s);
    }
  }

  // Organic hand-dressed stepping stones (飛び石) gently bedded toward the rear-right garden gate.
  const steppingStones: readonly [number, number, number, number, number][] = [
    [1.02, -1.30, 0.25, 0.175, 0.18],
    [1.50, -1.62, 0.23, 0.165, -0.24],
    [1.92, -1.78, 0.17, 0.125, 0.34],
  ];
  const stepColor = parseHex('#96938b');
  for (let i = 0; i < steppingStones.length; i++) {
    const [sx, sz, rx, rz, rot] = steppingStones[i]!;
    const ring = buildSteppingStoneRing(sx, sz, rx, rz, rot, 31.7 + i * 19.3, 14);
    pushOrganicPolygonStone(b, ring, -0.009, 0.0045, 0.036, 1, scaleRgb(stepColor, 0.95 + i * 0.045), 71 + i * 13);
  }

  const graniteCurbPalette: readonly RGB[] = [
    '#a39f97',
    '#9a9790',
    '#aeaaa0',
    '#939089',
    '#a8a49b',
  ].map(parseHex);
  pushOrganicPerimeterCurbRing(
    b,
    innerRx - 0.04,
    innerRz - 0.04,
    innerRx + 0.21,
    innerRz + 0.19,
    28,
    -0.012,
    0.018,
    0.055,
    0.024,
    1,
    graniteCurbPalette,
    edgeSeed,
    1.05,
  );

  return finalizeGeometry(b);
}

/**
 * 2) Chinese Jiangnan Paving:
 * Aged hand-hewn Suzhou bluestone flagstones (青石板) with softly weathered corners bedded in
 * organic recessed mortar, framed by an undulating rustic gray-brick & cobble edge.
 */
function buildChineseJiangnanPad(): THREE.BufferGeometry {
  const b = createBuilder();
  const innerRx = 2.60;
  const innerRz = 1.96;
  const edgeSeed = 203;

  pushOrganicEllipticalBed(b, innerRx + 0.18, innerRz + 0.16, -0.007, parseHex('#6d706c'), parseHex('#5f6c54'), edgeSeed);

  const bluestonePalette: readonly RGB[] = [
    '#9da5a8',
    '#939c9f',
    '#a7adaa',
    '#8c9598',
    '#adb2ae',
    '#97a0a2',
  ].map(parseHex);

  const rowDepth = 0.56;
  const seam = 0.034;
  let rowIdx = 0;
  for (let z0 = -innerRz; z0 < innerRz - 0.12; z0 += rowDepth) {
    const z1 = Math.min(innerRz, z0 + rowDepth);
    const zMid = (z0 + z1) * 0.5;
    const zRatio = zMid / innerRz;
    if (Math.abs(zRatio) >= 0.98) continue;
    const spanX = innerRx * Math.sqrt(Math.max(0, 1 - zRatio * zRatio));
    const offset = (rowIdx % 2) * 0.34 + (hash2(rowIdx, 3) - 0.5) * 0.08;
    const colW = 0.68;

    let colIdx = 0;
    for (let x0 = -spanX - offset; x0 < spanX; x0 += colW) {
      const rawX0 = Math.max(-spanX, x0) + seam * 0.5;
      const rawX1 = Math.min(spanX, x0 + colW) - seam * 0.5;
      const rawZ0 = z0 + seam * 0.5 + (hash2(rowIdx * 5 + colIdx, 19) - 0.5) * 0.016;
      const rawZ1 = z1 - seam * 0.5 + (hash2(rowIdx * 5 + colIdx, 23) - 0.5) * 0.016;
      if (rawX1 - rawX0 < 0.20 || rawZ1 - rawZ0 < 0.18) {
        colIdx++;
        continue;
      }

      const clampCorner = (px: number, pz: number): [number, number] => {
        const a = Math.atan2(pz, px);
        const s = THREE.MathUtils.lerp(1, gardenPavingEdgeScale(a, edgeSeed), 0.55);
        const er = Math.hypot(px / ((innerRx - 0.03) * s), pz / ((innerRz - 0.03) * s));
        if (er > 1) return [px / er, pz / er];
        return [px, pz];
      };
      const corners: [number, number][] = [
        clampCorner(rawX0, rawZ0),
        clampCorner(rawX1, rawZ0),
        clampCorner(rawX1, rawZ1),
        clampCorner(rawX0, rawZ1),
      ];
      let minSide = Infinity;
      for (let k = 0; k < 4; k++) {
        const a = corners[k]!;
        const c = corners[(k + 1) % 4]!;
        minSide = Math.min(minSide, Math.hypot(c[0] - a[0], c[1] - a[1]));
      }
      const area = 0.5 * Math.abs(
        (corners[1]![0] - corners[0]![0]) * (corners[2]![1] - corners[0]![1]) -
        (corners[2]![0] - corners[0]![0]) * (corners[1]![1] - corners[0]![1]) +
        (corners[2]![0] - corners[0]![0]) * (corners[3]![1] - corners[0]![1]) -
        (corners[3]![0] - corners[0]![0]) * (corners[2]![1] - corners[0]![1]),
      );
      if (minSide < 0.15 || area < 0.048) {
        colIdx++;
        continue;
      }

      const poly = buildHandDressedCellPolygon(corners, 0.032, 0.12, rowIdx * 17.3 + colIdx * 7.1 + 11);
      const pal = bluestonePalette[(rowIdx * 3 + colIdx + Math.floor(hash2(rowIdx, colIdx + 17) * 3)) % bluestonePalette.length]!;
      const edgeDist = Math.hypot(((rawX0 + rawX1) * 0.5) / innerRx, zMid / innerRz);
      const col = scaleRgb(pal, (0.97 + hash2(rowIdx * 7, colIdx * 5) * 0.06) * (1 - THREE.MathUtils.smoothstep(edgeDist, 0.76, 1.0) * 0.07));
      const topY = -0.001 + hash2(rowIdx * 11, colIdx * 13) * 0.0028;
      pushOrganicPolygonStone(b, poly, -0.010, topY, 0.022, 1, col, rowIdx * 29 + colIdx * 13);
      colIdx++;
    }
    rowIdx++;
  }

  const grayBrickPalette: readonly RGB[] = [
    '#6b7176',
    '#747b80',
    '#62686d',
    '#7c8286',
  ].map(parseHex);
  pushOrganicPerimeterCurbRing(
    b,
    innerRx - 0.08,
    innerRz - 0.08,
    innerRx + 0.24,
    innerRz + 0.22,
    40,
    -0.012,
    0.015,
    0.08,
    0.017,
    1,
    grayBrickPalette,
    edgeSeed,
    0.92,
  );

  return finalizeGeometry(b);
}

/**
 * 3) Warm Terracotta Arch Courtyard Paving:
 * Hand-molded Saltillo terracotta tiles (红陶砖) with worn organic edges, recessed sandy lime-mortar joints,
 * glazed cobalt/ochre corner diamonds, and an organically undulating Mediterranean limestone curb.
 */
function buildWarmTerracottaPad(): THREE.BufferGeometry {
  const b = createBuilder();
  const innerRx = 2.62;
  const innerRz = 1.98;
  const edgeSeed = 307;

  pushOrganicEllipticalBed(b, innerRx + 0.18, innerRz + 0.16, -0.007, parseHex('#9a8970'), parseHex('#847d5e'), edgeSeed);

  const terracottaPalette: readonly RGB[] = [
    '#c47f58',
    '#bc7650',
    '#cb8962',
    '#b5704c',
    '#cf926b',
    '#bf7b55',
  ].map(parseHex);
  const cobaltInlay = parseHex('#3b6a94');
  const ochreInlay = parseHex('#d6a44e');

  const tileSize = 0.50;
  const seam = 0.032;
  let rowIdx = 0;

  for (let z0 = -innerRz; z0 < innerRz - 0.08; z0 += tileSize) {
    const z1 = Math.min(innerRz, z0 + tileSize);
    const zMid = (z0 + z1) * 0.5;
    const zRatio = zMid / innerRz;
    if (Math.abs(zRatio) >= 0.98) continue;
    const spanX = innerRx * Math.sqrt(Math.max(0, 1 - zRatio * zRatio));

    let colIdx = 0;
    for (let x0 = -Math.ceil(spanX / tileSize) * tileSize; x0 < spanX; x0 += tileSize) {
      const rawX0 = Math.max(-spanX, x0) + seam * 0.5;
      const rawX1 = Math.min(spanX, x0 + tileSize) - seam * 0.5;
      const rawZ0 = z0 + seam * 0.5;
      const rawZ1 = z1 - seam * 0.5;
      if (rawX1 - rawX0 < 0.16 || rawZ1 - rawZ0 < 0.16) {
        colIdx++;
        continue;
      }

      const clampCorner = (px: number, pz: number): [number, number] => {
        const a = Math.atan2(pz, px);
        const s = THREE.MathUtils.lerp(1, gardenPavingEdgeScale(a, edgeSeed), 0.55);
        const er = Math.hypot(px / ((innerRx - 0.03) * s), pz / ((innerRz - 0.03) * s));
        if (er > 1) return [px / er, pz / er];
        return [px, pz];
      };
      const corners: [number, number][] = [
        clampCorner(rawX0, rawZ0),
        clampCorner(rawX1, rawZ0),
        clampCorner(rawX1, rawZ1),
        clampCorner(rawX0, rawZ1),
      ];
      let minSide = Infinity;
      for (let k = 0; k < 4; k++) {
        const a = corners[k]!;
        const c = corners[(k + 1) % 4]!;
        minSide = Math.min(minSide, Math.hypot(c[0] - a[0], c[1] - a[1]));
      }
      if (minSide < 0.14) {
        colIdx++;
        continue;
      }

      const poly = buildHandDressedCellPolygon(corners, 0.024, 0.11, rowIdx * 23.1 + colIdx * 11.7 + 31);
      const pal = terracottaPalette[(rowIdx * 5 + colIdx * 3 + Math.floor(hash2(rowIdx, colIdx + 7) * 3)) % terracottaPalette.length]!;
      const col = scaleRgb(pal, 0.95 + hash2(rowIdx * 13, colIdx * 7) * 0.10);
      const topY = -0.001 + hash2(rowIdx * 3, colIdx * 11) * 0.0028;
      pushOrganicPolygonStone(b, poly, -0.010, topY, 0.020, 2, col, rowIdx * 37 + colIdx * 17);

      if ((rowIdx + colIdx) % 2 === 0 && rawX1 - rawX0 > 0.36 && rawZ1 - rawZ0 > 0.36) {
        const ix = x0 + tileSize;
        const iz = z0 + tileSize;
        const er = Math.hypot(ix / (innerRx - 0.18), iz / (innerRz - 0.18));
        if (er < 0.90 && Math.hypot(ix, iz) > 0.65) {
          const dr = 0.068;
          const diamond: [number, number][] = [
            [ix, iz - dr],
            [ix + dr, iz],
            [ix, iz + dr],
            [ix - dr, iz],
          ];
          const inlayCol = rowIdx % 2 === 0 ? cobaltInlay : ochreInlay;
          pushOrganicPolygonStone(b, diamond, -0.008, 0.0024, 0.011, 1, inlayCol, rowIdx * 19 + colIdx * 5);
        }
      }
      colIdx++;
    }
    rowIdx++;
  }

  const limestoneCurbPalette: readonly RGB[] = [
    '#d6c9b2',
    '#ccbda5',
    '#dcd0ba',
    '#c4b49b',
    '#d1c4ad',
  ].map(parseHex);
  pushOrganicPerimeterCurbRing(
    b,
    innerRx - 0.08,
    innerRz - 0.08,
    innerRx + 0.22,
    innerRz + 0.20,
    30,
    -0.012,
    0.017,
    0.055,
    0.023,
    1,
    limestoneCurbPalette,
    edgeSeed,
    0.96,
  );

  return finalizeGeometry(b);
}

/**
 * 4) Neutral Natural Courtyard Paving (`skin === 'none'`, non-spring garden):
 * Irregular hand-dressed sandstone flagstones in broken-bond courses bedded in undulating
 * sandy earth and edged with weathered natural fieldstone curbing & cobbles.
 */
function buildNeutralGardenCourtyardPad(): THREE.BufferGeometry {
  const b = createBuilder();
  const innerRx = 2.62;
  const innerRz = 1.98;
  const edgeSeed = 409;

  pushOrganicEllipticalBed(b, innerRx + 0.18, innerRz + 0.16, -0.007, parseHex('#877d69'), parseHex('#747c58'), edgeSeed);

  const naturalStonePalette: readonly RGB[] = [
    '#c7baa2',
    '#c2b499',
    '#bdb29d',
    '#b8a990',
    '#b4a894',
  ].map(parseHex);

  const rowDepth = 0.62;
  const seam = 0.044;
  let rowIdx = 0;

  for (let z0 = -innerRz; z0 < innerRz - 0.14; z0 += rowDepth) {
    const z1 = Math.min(innerRz, z0 + rowDepth);
    const zMid = (z0 + z1) * 0.5;
    const zRatio = zMid / innerRz;
    if (Math.abs(zRatio) >= 0.98) continue;
    const spanX = innerRx * Math.sqrt(Math.max(0, 1 - zRatio * zRatio));
    const offset = (rowIdx % 2) * 0.36 + (hash2(rowIdx, 19) - 0.5) * 0.12;
    const colW = 0.74;

    let colIdx = 0;
    for (let x0 = -spanX - offset; x0 < spanX; x0 += colW) {
      const rawX0 = Math.max(-spanX, x0) + seam * 0.5;
      const rawX1 = Math.min(spanX, x0 + colW) - seam * 0.5;
      const rawZ0 = z0 + seam * 0.5 + (hash2(rowIdx * 7 + colIdx, 31) - 0.5) * 0.022;
      const rawZ1 = z1 - seam * 0.5 + (hash2(rowIdx * 7 + colIdx, 37) - 0.5) * 0.022;
      if (rawX1 - rawX0 < 0.22 || rawZ1 - rawZ0 < 0.18) {
        colIdx++;
        continue;
      }

      const clampCorner = (px: number, pz: number): [number, number] => {
        const a = Math.atan2(pz, px);
        const s = THREE.MathUtils.lerp(1, gardenPavingEdgeScale(a, edgeSeed), 0.55);
        const er = Math.hypot(px / ((innerRx - 0.03) * s), pz / ((innerRz - 0.03) * s));
        if (er > 1) return [px / er, pz / er];
        return [px, pz];
      };
      const corners: [number, number][] = [
        clampCorner(rawX0, rawZ0),
        clampCorner(rawX1, rawZ0),
        clampCorner(rawX1, rawZ1),
        clampCorner(rawX0, rawZ1),
      ];
      const w = Math.hypot(corners[1]![0] - corners[0]![0], corners[1]![1] - corners[0]![1]);
      const d = Math.hypot(corners[3]![0] - corners[0]![0], corners[3]![1] - corners[0]![1]);
      if (w < 0.16 || d < 0.14) {
        colIdx++;
        continue;
      }

      const poly = buildHandDressedCellPolygon(corners, 0.055, 0.17, rowIdx * 31.3 + colIdx * 13.7 + 47);
      const pal = naturalStonePalette[(rowIdx * 3 + colIdx + Math.floor(hash2(rowIdx, colIdx + 5) * 3)) % naturalStonePalette.length]!;
      const col = scaleRgb(pal, 0.96 + hash2(rowIdx * 5, colIdx * 9) * 0.08);
      const topY = -0.001 + hash2(rowIdx * 7, colIdx * 3) * 0.0028;
      pushOrganicPolygonStone(b, poly, -0.010, topY, 0.026, 1, col, rowIdx * 43 + colIdx * 19);
      colIdx++;
    }
    rowIdx++;
  }

  const fieldstoneCurbPalette: readonly RGB[] = [
    '#aba393',
    '#9f9889',
    '#b5ad9c',
    '#989284',
  ].map(parseHex);
  pushOrganicPerimeterCurbRing(
    b,
    innerRx - 0.04,
    innerRz - 0.04,
    innerRx + 0.21,
    innerRz + 0.19,
    28,
    -0.012,
    0.015,
    0.065,
    0.025,
    1,
    fieldstoneCurbPalette,
    edgeSeed,
    1.12,
  );

  return finalizeGeometry(b);
}

/**
 * Spring ring (`celtic-folk-spring`): preserves the exact r = 1.36 center hole and Komorebi
 * backdrop sand calibration on `garden-path`, while framing the outer edge with organic weathered
 * fieldstones and shoulder cobbles.
 */
function buildSpringRingPadGeometry(): {
  padGeometry: THREE.BufferGeometry;
  borderGeometry: THREE.BufferGeometry;
} {
  const rx = 2.86;
  const rz = 2.18;
  const edgeSeed = 503;
  const shape = new THREE.Shape();
  const outerSegs = 64;
  for (let i = 0; i <= outerSegs; i++) {
    const a = (i / outerSegs) * Math.PI * 2;
    const s = gardenPavingEdgeScale(a, edgeSeed);
    const sx = Math.cos(a) * rx * s;
    const sy = Math.sin(a) * rz * s;
    if (i === 0) shape.moveTo(sx, sy);
    else shape.lineTo(sx, sy);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 1.36, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const padGeometry = new THREE.ShapeGeometry(shape, 48);
  padGeometry.rotateX(-Math.PI / 2);

  const pos = padGeometry.getAttribute('position') as THREE.BufferAttribute;
  const uv = padGeometry.getAttribute('uv') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(i, x / (rx * 2) + 0.5, z / (rz * 2) + 0.5);
    const r = Math.hypot(x, z);
    const er = Math.hypot(x / rx, z / rz);
    const innerRim = 1 - THREE.MathUtils.smoothstep(r, 1.36, 1.62);
    const outerRim = THREE.MathUtils.smoothstep(er, 0.80, 1.0);
    const shade = 1.0 - innerRim * 0.08 - outerRim * 0.09 + GARDEN_STONE_NOISE(x * 1.4, z * 1.4) * 0.03;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade * 0.98;
  }
  padGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  padGeometry.computeBoundingBox();
  padGeometry.computeBoundingSphere();

  const curbBuilder = createBuilder();
  const curbPalette: readonly RGB[] = ['#aba393', '#9d9788', '#b5ad9d', '#949082'].map(parseHex);
  pushOrganicPerimeterCurbRing(
    curbBuilder,
    rx - 0.14,
    rz - 0.12,
    rx + 0.13,
    rz + 0.11,
    28,
    -0.012,
    0.016,
    0.065,
    0.024,
    1,
    curbPalette,
    edgeSeed,
    1.1,
  );
  const borderGeometry = finalizeGeometry(curbBuilder);

  return { padGeometry, borderGeometry };
}

export interface GardenCourtyardPadHandle {
  mesh: THREE.Mesh;
  borderMesh?: THREE.Mesh;
  mossMesh?: THREE.Mesh;
  setTone(tone: EnvironmentTone): void;
  dispose(): void;
}

export function createGardenCourtyardPad({
  floor,
  night,
  skin,
  spring,
}: {
  floor: number;
  night: boolean;
  skin: CourtyardSkinId;
  spring: boolean;
}): GardenCourtyardPadHandle {
  const atlasBytes = getPavingAtlasBytes(256);
  const ownedGeometries: THREE.BufferGeometry[] = [];
  const ownedMaterials: THREE.Material[] = [];
  const ownedTextures: THREE.Texture[] = [];

  const edgeSeed = spring
    ? 503
    : skin === 'japanese-karesansui'
      ? 101
      : skin === 'chinese-jiangnan'
        ? 203
        : skin === 'warm-terracotta-arch'
          ? 307
          : 409;

  let mesh: THREE.Mesh;
  let borderMesh: THREE.Mesh | undefined;
  let mossMesh: THREE.Mesh | undefined;
  let komorebiPadMaterial: THREE.MeshPhongMaterial | undefined;
  let standardPadMaterial: THREE.MeshStandardMaterial | undefined;
  let komorebiBorderMaterial: THREE.MeshPhongMaterial | undefined;
  let standardBorderMaterial: THREE.MeshStandardMaterial | undefined;
  let mossKomorebiMaterial: THREE.MeshPhongMaterial | undefined;
  let mossStandardMaterial: THREE.MeshStandardMaterial | undefined;

  if (spring) {
    const { padGeometry, borderGeometry } = buildSpringRingPadGeometry();
    ownedGeometries.push(padGeometry, borderGeometry);

    const springDetailTex = makeTexture(getSpringDetailBytes(128), 128, THREE.NoColorSpace, 'garden-spring-ring-detail');
    ownedTextures.push(springDetailTex);

    const padMaterial = new THREE.MeshStandardMaterial({
      color: night ? 0x9c927d : 0xdccaa2,
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    });
    padMaterial.userData.environmentRole = 'sand';
    padMaterial.userData.backdropRole = 'sand';
    padMaterial.userData.komorebiDetailMap = springDetailTex;
    ownedMaterials.push(padMaterial);

    mesh = new THREE.Mesh(padGeometry, padMaterial);
    mesh.name = 'garden-path';
    mesh.position.set(0, floor + 0.008, 0);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.toonSurface = { outline: false, shading: 'smooth' };

    const borderKomorebiMap = makeTexture(atlasBytes, 256, THREE.NoColorSpace, 'garden-paving-atlas-komorebi');
    const borderStdMap = makeTexture(atlasBytes, 256, THREE.SRGBColorSpace, 'garden-paving-atlas-standard');
    ownedTextures.push(borderKomorebiMap, borderStdMap);

    komorebiBorderMaterial = createKomorebiSurface();
    komorebiBorderMaterial.color.setRGB(1, 1, 1);
    komorebiBorderMaterial.map = borderKomorebiMap;
    komorebiBorderMaterial.vertexColors = true;
    komorebiBorderMaterial.shininess = 6;
    komorebiBorderMaterial.specular.setRGB(0.018, 0.018, 0.018);
    komorebiBorderMaterial.name = 'Garden courtyard curb (Komorebi)';
    komorebiBorderMaterial.userData.komorebiSurface = true;
    komorebiBorderMaterial.userData.komorebiPigment = true;

    standardBorderMaterial = new THREE.MeshStandardMaterial({
      color: night ? 0x9d9c99 : 0xd8d0c2,
      map: borderStdMap,
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
    });
    standardBorderMaterial.name = 'Garden courtyard curb';
    standardBorderMaterial.userData.komorebiPigment = true;
    ownedMaterials.push(komorebiBorderMaterial, standardBorderMaterial);

    borderMesh = new THREE.Mesh(borderGeometry, night ? standardBorderMaterial : komorebiBorderMaterial);
    borderMesh.name = 'garden-path-border';
    borderMesh.position.set(0, floor + 0.008, 0);
    borderMesh.receiveShadow = true;
    borderMesh.castShadow = false;
    borderMesh.userData.toonSurface = { outline: false, shading: 'smooth' };
    borderMesh.userData.courtyardSkin = true;
  } else {
    const padGeometry =
      skin === 'japanese-karesansui'
        ? buildJapaneseKaresansuiPad()
        : skin === 'chinese-jiangnan'
          ? buildChineseJiangnanPad()
          : skin === 'warm-terracotta-arch'
            ? buildWarmTerracottaPad()
            : buildNeutralGardenCourtyardPad();
    ownedGeometries.push(padGeometry);

    const komorebiMap = makeTexture(atlasBytes, 256, THREE.NoColorSpace, 'garden-paving-atlas-komorebi');
    const standardMap = makeTexture(atlasBytes, 256, THREE.SRGBColorSpace, 'garden-paving-atlas-standard');
    ownedTextures.push(komorebiMap, standardMap);

    komorebiPadMaterial = createKomorebiSurface();
    komorebiPadMaterial.color.setRGB(1, 1, 1);
    komorebiPadMaterial.map = komorebiMap;
    komorebiPadMaterial.vertexColors = true;
    komorebiPadMaterial.shininess = 6;
    komorebiPadMaterial.specular.setRGB(0.018, 0.018, 0.018);
    komorebiPadMaterial.name = `Garden courtyard paving (${skin}, Komorebi)`;
    komorebiPadMaterial.userData.komorebiSurface = true;
    komorebiPadMaterial.userData.komorebiPigment = true;

    const nightTint =
      skin === 'japanese-karesansui'
        ? 0xa0a6ad
        : skin === 'chinese-jiangnan'
          ? 0x9aa4ae
          : skin === 'warm-terracotta-arch'
            ? 0xa89b91
            : 0xa29e98;
    standardPadMaterial = new THREE.MeshStandardMaterial({
      color: night ? nightTint : 0xd6cec0,
      map: standardMap,
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
    });
    standardPadMaterial.name = `Garden courtyard paving (${skin}${night ? ', night' : ''})`;
    standardPadMaterial.userData.komorebiPigment = true;
    ownedMaterials.push(komorebiPadMaterial, standardPadMaterial);

    mesh = new THREE.Mesh(padGeometry, night ? standardPadMaterial : komorebiPadMaterial);
    mesh.name = 'garden-path';
    mesh.position.set(0, floor + 0.008, 0);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.toonSurface = { outline: false, shading: 'smooth' };
    mesh.userData.courtyardSkin = true;
  }

  // Outer perimeter organic multi-lobe moss pads & river pebbles (daylight only).
  if (!night) {
    const mossGeometry = buildOuterMossGeometry(2.86, 2.20, skin, skin.length * 19 + (spring ? 7 : 0), edgeSeed);
    ownedGeometries.push(mossGeometry);

    mossKomorebiMaterial = createKomorebiSurface();
    mossKomorebiMaterial.color.setRGB(1, 1, 1);
    mossKomorebiMaterial.vertexColors = true;
    mossKomorebiMaterial.shininess = 6;
    mossKomorebiMaterial.specular.setRGB(0.015, 0.015, 0.015);
    mossKomorebiMaterial.side = THREE.DoubleSide;
    mossKomorebiMaterial.name = 'Garden courtyard edge moss (Komorebi)';
    mossKomorebiMaterial.userData.komorebiSurface = true;
    mossKomorebiMaterial.userData.komorebiPigment = true;

    mossStandardMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    mossStandardMaterial.userData.komorebiPigment = true;
    ownedMaterials.push(mossKomorebiMaterial, mossStandardMaterial);

    mossMesh = new THREE.Mesh(mossGeometry, mossKomorebiMaterial);
    mossMesh.name = 'garden-path-moss';
    mossMesh.position.set(0, floor + 0.008, 0);
    mossMesh.receiveShadow = true;
    mossMesh.castShadow = false;
    mossMesh.raycast = () => {};
    mossMesh.userData.toonSurface = { outline: false, shading: 'smooth' };
    mossMesh.userData.courtyardSkin = true;
  }

  let disposed = false;

  function setTone(tone: EnvironmentTone) {
    if (disposed) return;
    const useKomorebi = !night && tone === 'komorebi';
    if (komorebiPadMaterial && standardPadMaterial) {
      mesh.material = useKomorebi ? komorebiPadMaterial : standardPadMaterial;
      if (!useKomorebi) {
        if (night) {
          standardPadMaterial.color.setHex(tone === 'tiny-delivery' ? 0xaca8a0 : 0xa0a2a6);
        } else {
          standardPadMaterial.color.setHex(tone === 'tiny-delivery' ? 0xdfd3be : 0xd6cec0);
        }
      }
    }
    if (borderMesh && komorebiBorderMaterial && standardBorderMaterial) {
      borderMesh.material = useKomorebi ? komorebiBorderMaterial : standardBorderMaterial;
    }
    if (mossMesh && mossKomorebiMaterial && mossStandardMaterial) {
      mossMesh.material = useKomorebi ? mossKomorebiMaterial : mossStandardMaterial;
    }
  }

  return {
    mesh,
    borderMesh,
    mossMesh,
    setTone,
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.removeFromParent();
      borderMesh?.removeFromParent();
      mossMesh?.removeFromParent();
      ownedGeometries.forEach(g => g.dispose());
      ownedMaterials.forEach(m => m.dispose());
      ownedTextures.forEach(t => t.dispose());
    },
  };
}
