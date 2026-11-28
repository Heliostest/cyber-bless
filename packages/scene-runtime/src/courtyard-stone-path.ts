import * as THREE from 'three';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import type { CourtyardSkinId } from './courtyard-skins';
import type { EnvironmentTone } from './debug-environment-tone';
import { createKomorebiSurface } from './komorebi-surface';

export const COURTYARD_PATH_START_Z = 4;
export const COURTYARD_PATH_LENGTH = 36;

export function courtyardPathT(z: number): number {
  return THREE.MathUtils.clamp((COURTYARD_PATH_START_Z - z) / COURTYARD_PATH_LENGTH, 0, 1);
}

export function courtyardPathCenterX(t: number): number {
  return Math.sin(t * Math.PI * 1.5) * 1.6;
}

export function courtyardPathHalfWidth(t: number): number {
  return 1.22 - t * 0.65;
}

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

// Deterministic simplex-noise fields shared across path edge sculpting, slabs, pebbles, moss, and atlas.
const EDGE_NOISE = createNoise2D(createSeededRandom(0x5a3c91d7));
const SLAB_NOISE = createNoise2D(createSeededRandom(0x2b7e1516));
const ATLAS_NOISE = createNoise2D(createSeededRandom(0x9e3779b9));
const MOSS_NOISE = createNoise2D(createSeededRandom(0x73a5d1c3));

/**
 * Curated regional stone-road slab, cobble, mortar, and moss palettes (raw-gamma space for Komorebi day).
 * All skins share the exact same road topology and vertex count while tailoring hand-dressed stone
 * character and harmonious regional palettes.
 */
interface RoadPalette {
  slabs: readonly RGB[];
  cobbles: readonly RGB[];
  mortarCenter: RGB;
  mortarEdge: RGB;
  mossRoot: RGB;
  mossTip: RGB;
  /** Superellipse sharpness (higher = slightly crisper hand-hewn bluestone, lower = softer fieldstone). */
  superellipseP: number;
  /** Outer free-edge cleave/undulation weight (all skins remain unmistakably organic). */
  outerRoughness: number;
}

const ROAD_PALETTES: Record<CourtyardSkinId, RoadPalette> = {
  none: {
    slabs: ['#c7baa2', '#c4b59a', '#bfb39e', '#bdab91', '#b7ab97', '#b2a692'].map(parseHex),
    cobbles: ['#afa48f', '#a69a86', '#bbb09a', '#9c927f'].map(parseHex),
    mortarCenter: parseHex('#7c7260'),
    mortarEdge: parseHex('#6e7b52'),
    mossRoot: parseHex('#496f37'),
    mossTip: parseHex('#8eb256'),
    superellipseP: 3.1,
    outerRoughness: 1.05,
  },
  'japanese-karesansui': {
    // Refined Kyoto weathered granite / warm silver-grey hand-split temple flagstones.
    slabs: ['#bbb6ab', '#b3afa5', '#c3beb2', '#aba79e', '#b9b4a8', '#a4a097'].map(parseHex),
    cobbles: ['#98948b', '#a8a499', '#8c8982', '#b0aca1'].map(parseHex),
    mortarCenter: parseHex('#78756b'),
    mortarEdge: parseHex('#61744d'),
    mossRoot: parseHex('#466c34'),
    mossTip: parseHex('#87ad51'),
    superellipseP: 3.35,
    outerRoughness: 1.0,
  },
  'chinese-jiangnan': {
    // Aged Suzhou bluestone flagstones (青石板) with mossy slate-earth joints and river edging cobbles.
    slabs: ['#a6aeae', '#9da6a8', '#b0b5b2', '#959fa1', '#a2abac', '#8f989a'].map(parseHex),
    cobbles: ['#848d91', '#929b9d', '#798286', '#9ea6a5'].map(parseHex),
    mortarCenter: parseHex('#6d726f'),
    mortarEdge: parseHex('#5d7152'),
    mossRoot: parseHex('#4a6e39'),
    mossTip: parseHex('#82a753'),
    superellipseP: 3.9,
    outerRoughness: 0.92,
  },
  'warm-terracotta-arch': {
    // Sun-warmed Mediterranean sandstone-terracotta patio pavers with sandy lime seams & field cobbles.
    slabs: ['#cca180', '#c49674', '#d1aa89', '#bd8e6c', '#c89e7c', '#b78968'].map(parseHex),
    cobbles: ['#b58f70', '#c2a083', '#a68265', '#c8aa8d'].map(parseHex),
    mortarCenter: parseHex('#8a7b66'),
    mortarEdge: parseHex('#787d59'),
    mossRoot: parseHex('#5a753e'),
    mossTip: parseHex('#94aa5c'),
    superellipseP: 3.55,
    outerRoughness: 0.96,
  },
};

interface PathFrame {
  x: number;
  z: number;
  rx: number;
  rz: number;
  tx: number;
  tz: number;
  arcLen: number;
  half: number;
}

function samplePathFrame(t: number): PathFrame {
  const clamped = THREE.MathUtils.clamp(t, -0.02, 1.02);
  const x = courtyardPathCenterX(clamped);
  const z = COURTYARD_PATH_START_Z - clamped * COURTYARD_PATH_LENGTH;
  const dx = 1.6 * Math.PI * 1.5 * Math.cos(clamped * Math.PI * 1.5);
  const dz = -COURTYARD_PATH_LENGTH;
  const arcLen = Math.hypot(dx, dz);
  const tx = dx / arcLen;
  const tz = dz / arcLen;
  // Right-hand perpendicular (+X side when facing along -Z).
  const rx = -tz;
  const rz = tx;
  return { x, z, rx, rz, tx, tz, arcLen, half: courtyardPathHalfWidth(THREE.MathUtils.clamp(t, 0, 1)) };
}

function mapPathPoint(t: number, lateral: number): [number, number] {
  const frame = samplePathFrame(t);
  return [frame.x + lateral * frame.rx, frame.z + lateral * frame.rz];
}

/**
 * Multi-frequency simplex-noise organic shoulder offset (meters) on left (-1) or right (+1) side.
 * Positive values push outward into the meadow (promontories / protruding shoulder stones),
 * negative values pull slightly inward (grassy coves / concave bays).
 * Total foreground/midground swing is ~0.26m (-0.06m to +0.20m), scaling cleanly as the path tapers.
 */
function rawShoulderOffset(t: number, side: -1 | 1): number {
  const s = THREE.MathUtils.clamp(t, -0.02, 1.02) * COURTYARD_PATH_LENGTH;
  const yLane = side < 0 ? 3.7 : 19.3;
  const macro = EDGE_NOISE(s * 0.21, yLane) * 0.085;
  const medium = EDGE_NOISE(s * 0.58 + 7.1, yLane + 4.3) * 0.085;
  const detail = EDGE_NOISE(s * 1.32 - 3.9, yLane + 11.7) * 0.042;
  const taperScale = THREE.MathUtils.lerp(1.0, 0.72, THREE.MathUtils.clamp(t, 0, 1));
  const raw = (0.048 + macro + medium + detail) * taperScale;
  return THREE.MathUtils.clamp(raw, -0.062 * taperScale, 0.215 * taperScale);
}

/**
 * Borderless 2×2 procedural stone mineral & mortar atlas (simplex-noise FBM, zero box frames):
 *  - Quadrants (0,0), (1,0), (0,1): three natural mottled stone mineral grain & soft cel washes
 *    with subtle pores and warm/cool pigment drift. No directional/rectangular border lines!
 *  - Quadrant (1,1): mottled warm earth / sandy mortar / mossy soil wash for the recessed bed.
 * Luminance is centered near 0.99 so per-slab vertex colors control calibrated Komorebi L*.
 */
let cachedStoneAtlasBytes: Uint8Array<ArrayBuffer> | undefined;

function createStoneAtlasBytes(size = 256): Uint8Array<ArrayBuffer> {
  if (cachedStoneAtlasBytes && cachedStoneAtlasBytes.length === size * size * 4) {
    return cachedStoneAtlasBytes;
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

      if (quad < 3) {
        // Isotropic multi-frequency mineral mottling + subtle weathered stone pores.
        const ox = quad * 13.7 + 1.9;
        const oy = quad * 7.3 + 4.1;
        const broad = fbm2(ATLAS_NOISE, u * 3.2 + ox, v * 3.2 + oy, 3);
        const medium = ATLAS_NOISE(u * 8.5 - oy, v * 8.5 + ox);
        const fine = ATLAS_NOISE(u * 21.0 + ox * 1.4, v * 21.0 - oy * 1.2);
        const pore = fine < -0.58 ? (fine + 0.58) * 0.16 : 0;
        const fleck = fine > 0.64 ? (fine - 0.64) * 0.11 : 0;

        // Soft painterly cel-wash modulation centered around 0.99 (never rectangular edge framing).
        const celStep = Math.tanh(broad * 1.4) * 0.042;
        const shade = THREE.MathUtils.clamp(0.992 + celStep + medium * 0.022 + pore + fleck, 0.86, 1.07);

        // Subtle warm/cool mineral hue split.
        const hueShift = (broad * 0.7 + medium * 0.3) * 0.018;
        r = THREE.MathUtils.clamp(shade + hueShift * 0.85, 0, 1);
        g = THREE.MathUtils.clamp(shade + hueShift * 0.25, 0, 1);
        b = THREE.MathUtils.clamp(shade - hueShift * 0.95, 0, 1);
      } else {
        // Recessed earth/mortar bed: organic sandy grit & soft mossy clouding.
        const earthBroad = fbm2(ATLAS_NOISE, u * 4.4 + 31.1, v * 4.4 + 17.3, 3);
        const grit = ATLAS_NOISE(u * 24.0 + 9.2, v * 24.0 + 41.7) * 0.032;
        const wash = THREE.MathUtils.clamp(0.985 + earthBroad * 0.055 + grit, 0.84, 1.07);
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
  cachedStoneAtlasBytes = bytes;
  return bytes;
}

function makeAtlasTexture(bytes: Uint8Array<ArrayBuffer>, size: number, colorSpace: THREE.ColorSpace): THREE.DataTexture {
  const texture = new THREE.DataTexture(bytes.slice(), size, size);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'stylized-courtyard-stone-atlas';
  return texture;
}

interface SlabDescriptor {
  row: number;
  col: number;
  isLeftEdge: boolean;
  isRightEdge: boolean;
  u0: number;
  u1: number;
  t0: number;
  t1: number;
  ringVerts: number;
  palIdx: number;
  toneScale: number;
  slabTopOffset: number;
  tiltU: number;
  tiltV: number;
  quad: number;
  yaw: number;
  uvAngle: number;
  uvShiftU: number;
  uvShiftV: number;
  cleaveAngleA: number;
  cleaveCutA: number;
  cleaveAngleB: number;
  cleaveCutB: number;
  /** Precomputed approximate outer bounds in curve-local coordinates for fast envelope queries. */
  minU: number;
  maxU: number;
}

interface CobbleDescriptor {
  t: number;
  lateral: number;
  side: -1 | 1;
  radiusU: number;
  radiusL: number;
  height: number;
  yaw: number;
  palIdx: number;
  toneScale: number;
  quad: number;
  seed: number;
}

interface MossClusterDescriptor {
  t: number;
  lateral: number;
  side: -1 | 1;
  scale: number;
  withBlades: boolean;
  seed: number;
}

interface CourtyardRoadLayout {
  slabs: readonly SlabDescriptor[];
  cobbles: readonly CobbleDescriptor[];
  mossClusters: readonly MossClusterDescriptor[];
  envelopeBins: number;
  leftEnvelope: Float32Array;
  rightEnvelope: Float32Array;
}

const ENVELOPE_BINS = 180;
let cachedRoadLayout: CourtyardRoadLayout | undefined;

/**
 * Evaluate the hand-dressed polygonal slab outline in meters around center `(0, 0)`.
 * Uses a superellipse blended with multi-frequency simplex-noise sculpting and quarry-split
 * cleave flats, keeping interior seams tidy while letting outer shoulder faces undulate organically.
 */
function sampleSlabContourMeters(
  slab: SlabDescriptor,
  halfU: number,
  halfL: number,
  superellipseP: number,
  outerRoughness: number,
): [number, number][] {
  const n = slab.ringVerts;
  const pts: [number, number][] = [];
  const seedBase = slab.row * 19.3 + slab.col * 7.1;
  const cosYaw = Math.cos(slab.yaw);
  const sinYaw = Math.sin(slab.yaw);
  const cAx = Math.cos(slab.cleaveAngleA);
  const cAy = Math.sin(slab.cleaveAngleA);
  const cBx = Math.cos(slab.cleaveAngleB);
  const cBy = Math.sin(slab.cleaveAngleB);

  for (let k = 0; k < n; k++) {
    const baseAngle = (k / n) * Math.PI * 2 + hash2(slab.row, slab.col * 13 + 3) * 0.35;
    const angleJitter = (hash2(slab.row * 11 + k, slab.col * 17 + 5) - 0.5) * (Math.PI * 2 / n) * 0.30;
    const angle = baseAngle + angleJitter;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);

    // Direction exposure toward the free meadow edge on outer shoulder slabs.
    const outerExposure =
      (slab.isLeftEdge && ca < 0 ? Math.pow(-ca, 1.15) : 0) +
      (slab.isRightEdge && ca > 0 ? Math.pow(ca, 1.15) : 0);

    // Slightly softer corners on free outer edges, firmer dressed corners along interior mortar seams.
    const p = Math.max(2.1, superellipseP - outerExposure * 0.95 + (hash2(slab.row, slab.col + 29) - 0.5) * 0.55);
    const denom = Math.pow(Math.abs(ca) / halfU, p) + Math.pow(Math.abs(sa) / halfL, p);
    let r = Math.pow(Math.max(denom, 1e-6), -1 / p);

    // Multi-frequency simplex radial sculpting (gentle on interior joints, bold on meadow-facing edge).
    const nx = ca * 1.65 + seedBase;
    const ny = sa * 1.65 + slab.row * 2.3;
    const nLow = SLAB_NOISE(nx, ny);
    const nHigh = SLAB_NOISE(nx * 2.35 + 11.4, ny * 2.35 - 6.7);
    const interiorAmp = 0.055;
    const outerAmp = (0.145 + outerExposure * 0.065) * outerRoughness;
    const sculpt = (nLow * 0.68 + nHigh * 0.32) * THREE.MathUtils.lerp(interiorAmp, outerAmp, outerExposure);
    r *= 1 + sculpt;

    // Subtle hand-split quarry cleave facets (flat-ish split faces and occasional shallow edge chip).
    let lx = ca * r;
    let lz = sa * r;
    const projA = (lx / halfU) * cAx + (lz / halfL) * cAy;
    if (projA > slab.cleaveCutA) {
      const pull = slab.cleaveCutA / projA;
      lx *= THREE.MathUtils.lerp(1, pull, 0.72 + outerExposure * 0.25);
      lz *= THREE.MathUtils.lerp(1, pull, 0.72 + outerExposure * 0.25);
    }
    const projB = (lx / halfU) * cBx + (lz / halfL) * cBy;
    if (projB > slab.cleaveCutB) {
      const pull = slab.cleaveCutB / projB;
      lx *= THREE.MathUtils.lerp(1, pull, 0.65 + outerExposure * 0.25);
      lz *= THREE.MathUtils.lerp(1, pull, 0.65 + outerExposure * 0.25);
    }

    // Apply slight natural hand-laid yaw rotation.
    let rx = lx * cosYaw - lz * sinYaw;
    let rz = lx * sinYaw + lz * cosYaw;

    // Clamp interior-facing sides gently so neighboring slabs keep crisp non-overlapping mortar joints,
    // while allowing meadow-facing outer shoulder faces to project/recess freely!
    const maxPosU = slab.isRightEdge ? halfU * 1.24 : halfU * 1.015;
    const maxNegU = slab.isLeftEdge ? halfU * 1.24 : halfU * 1.015;
    const maxL = halfL * 1.035;
    rx = THREE.MathUtils.clamp(rx, -maxNegU, maxPosU);
    rz = THREE.MathUtils.clamp(rz, -maxL, maxL);

    pts.push([rx, rz]);
  }
  return pts;
}

/**
 * Build the deterministic stone slab, shoulder cobble, moss cluster, and organic envelope layout once.
 * Guarantees consistent topology, non-overlapping broken-bond joints, solid coverage under (0, 0)
 * and all central ritual samples, and an exact per-t outer edge envelope for meadow grass avoidance.
 */
function getCourtyardRoadLayout(): CourtyardRoadLayout {
  if (cachedRoadLayout) return cachedRoadLayout;

  const threeColTemplates: readonly [number, number, number][] = [
    [0.28, 0.43, 0.29],
    [0.41, 0.26, 0.33],
    [0.31, 0.32, 0.37],
    [0.39, 0.35, 0.26],
    [0.27, 0.34, 0.39],
  ];
  const twoColTemplates: readonly [number, number][] = [
    [0.58, 0.42],
    [0.41, 0.59],
    [0.54, 0.46],
    [0.45, 0.55],
  ];

  const slabs: SlabDescriptor[] = [];
  const cobbles: CobbleDescriptor[] = [];
  const mossClusters: MossClusterDescriptor[] = [];
  const seamGap = 0.038;

  // Track previous row's back-edge longitudinal offset across 3 coarse lateral zones so adjacent
  // rows interlock along undulating broken cross-seams instead of ruler-straight horizontal rows.
  let prevZoneBackT: [number, number, number] = [-0.004, -0.004, -0.004];
  let tCursor = -0.004;
  let row = 0;
  let prevPaletteIdx = -1;

  while (tCursor < 1.002) {
    const baseLen = THREE.MathUtils.lerp(0.69, 0.50, THREE.MathUtils.clamp(tCursor, 0, 1));
    const rowLenMeters = baseLen * (0.84 + hash2(row, 11) * 0.34);
    const dt = rowLenMeters / COURTYARD_PATH_LENGTH;
    const tFrontBase = tCursor;
    const tBackBase = Math.min(1.005, tCursor + dt);
    const tMid = (tFrontBase + tBackBase) * 0.5;
    const halfW = samplePathFrame(tMid).half;

    // Sample organic shoulder edges for this row (left/right vary independently by up to ~0.26m!).
    const leftShoulder = rawShoulderOffset(tMid, -1);
    const rightShoulder = rawShoulderOffset(tMid, 1);
    // Add per-row stone-to-stone shoulder step so adjacent outer stones visibly alternate in/out.
    const leftStep = (hash2(row, 31) - 0.44) * 0.11 * THREE.MathUtils.lerp(1.0, 0.72, THREE.MathUtils.clamp(tMid, 0, 1));
    const rightStep = (hash2(row, 37) - 0.44) * 0.11 * THREE.MathUtils.lerp(1.0, 0.72, THREE.MathUtils.clamp(tMid, 0, 1));

    const leftOuter = -(halfW + THREE.MathUtils.clamp(leftShoulder + leftStep, -0.062, 0.225));
    const rightOuter = halfW + THREE.MathUtils.clamp(rightShoulder + rightStep, -0.062, 0.225);
    const totalSpan = rightOuter - leftOuter;

    const useThree = halfW >= 0.84;
    const template = useThree
      ? threeColTemplates[row % threeColTemplates.length]!
      : twoColTemplates[row % twoColTemplates.length]!;

    const rawWeights = template.map((w, col) => w + (hash2(row * 7 + col, 19) - 0.5) * 0.065);
    const weightSum = rawWeights.reduce((acc, w) => acc + w, 0);
    const weights = rawWeights.map(w => w / weightSum);

    const nextZoneBackT: [number, number, number] = [tBackBase, tBackBase, tBackBase];
    let fracCursor = 0;

    for (let col = 0; col < weights.length; col++) {
      const wFrac = weights[col]!;
      const leftFrac = fracCursor;
      const rightFrac = fracCursor + wFrac;
      fracCursor = rightFrac;

      const isLeftEdge = col === 0;
      const isRightEdge = col === weights.length - 1;

      const u0 = leftOuter + leftFrac * totalSpan + (isLeftEdge ? 0 : seamGap * 0.5);
      const u1 = leftOuter + rightFrac * totalSpan - (isRightEdge ? 0 : seamGap * 0.5);

      // Broken transverse seam: each column inherits its matching zone's previous back seam
      // and projects an undulating new back seam (stronger stagger on outer columns).
      const zoneIdx = useThree ? col : (col === 0 ? 0 : 2);
      const frontBase = row === 0 ? tFrontBase : prevZoneBackT[zoneIdx]!;
      const backWaveMeters =
        SLAB_NOISE(row * 0.85 + col * 3.7, 5.1) * (isLeftEdge || isRightEdge ? 0.068 : 0.044) +
        (hash2(row * 5 + col, 43) - 0.5) * 0.036;
      const backBound = Math.min(1.005, Math.max(frontBase + 0.28 / COURTYARD_PATH_LENGTH, tBackBase + backWaveMeters / COURTYARD_PATH_LENGTH));
      nextZoneBackT[zoneIdx] = backBound;
      if (!useThree && col === 0) nextZoneBackT[1] = (frontBase + backBound) * 0.5;

      const t0 = frontBase + (seamGap * 0.5) / COURTYARD_PATH_LENGTH;
      const t1 = backBound - (seamGap * 0.5) / COURTYARD_PATH_LENGTH;

      const slabW = u1 - u0;
      const slabL = (t1 - t0) * COURTYARD_PATH_LENGTH;
      if (slabW < 0.16 || slabL < 0.16) continue;

      let palIdx = Math.floor(hash2(row * 13 + col * 5, 53) * 6);
      if (palIdx === prevPaletteIdx) palIdx = (palIdx + 1 + (row % 2)) % 6;
      prevPaletteIdx = palIdx;

      // Foreground/midground flagstones use 14 perimeter vertices, far background uses 12 (all within 12..18).
      const ringVerts = tMid < 0.58 ? 14 : 12;
      const yawAmp = isLeftEdge || isRightEdge ? 0.115 : 0.052;
      const yaw = (hash2(row * 17 + col, 73) - 0.5) * 2 * yawAmp;

      const slabDesc: SlabDescriptor = {
        row,
        col,
        isLeftEdge,
        isRightEdge,
        u0,
        u1,
        t0,
        t1,
        ringVerts,
        palIdx,
        toneScale: 0.965 + hash2(row, col * 17 + 7) * 0.07,
        // Strictly keep slab top plateau within [floor + 0.0160, floor + 0.0190] (safe around floor + 0.0175).
        slabTopOffset: 0.0164 + hash2(row * 3 + col, 61) * 0.0024,
        tiltU: (hash2(row + col * 11, 67) - 0.5) * 0.0014,
        tiltV: (hash2(row * 9 + col, 71) - 0.5) * 0.0014,
        quad: (row * 3 + col + Math.floor(hash2(row, col + 83) * 3)) % 3,
        yaw,
        uvAngle: hash2(row * 19 + col, 89) * Math.PI * 2,
        uvShiftU: (hash2(row * 23 + col, 91) - 0.5) * 0.08,
        uvShiftV: (hash2(row * 29 + col, 97) - 0.5) * 0.08,
        cleaveAngleA: hash2(row * 31 + col, 101) * Math.PI * 2,
        cleaveCutA: 0.84 + hash2(row * 37 + col, 103) * 0.14,
        cleaveAngleB: hash2(row * 41 + col, 107) * Math.PI * 2,
        cleaveCutB: 0.85 + hash2(row * 43 + col, 109) * 0.14,
        minU: u0,
        maxU: u1,
      };

      // Compute conservative lateral extent across all skins' superellipse settings.
      const uC = (u0 + u1) * 0.5;
      const halfU = slabW * 0.5;
      const halfL = slabL * 0.5;
      const pts = sampleSlabContourMeters(slabDesc, halfU, halfL, 3.1, 1.05);
      let minU = Infinity;
      let maxU = -Infinity;
      for (const [lx] of pts) {
        if (uC + lx < minU) minU = uC + lx;
        if (uC + lx > maxU) maxU = uC + lx;
      }
      slabDesc.minU = minU;
      slabDesc.maxU = maxU;
      slabs.push(slabDesc);

      // Scatter natural shoulder cobbles / edging pebbles nestled into outer joints & recessed coves.
      if (isLeftEdge || isRightEdge) {
        const side: -1 | 1 = isLeftEdge ? -1 : 1;
        const edgeU = side < 0 ? slabDesc.minU : slabDesc.maxU;
        const cobbleChance = hash2(row * 13 + side * 7, 131);
        if (tMid > 0.005 && tMid < 0.92 && cobbleChance > 0.34) {
          const isBay = (side < 0 ? leftShoulder : rightShoulder) < 0.05;
          const rU = (0.048 + hash2(row, side * 19 + 137) * 0.052) * THREE.MathUtils.lerp(1.0, 0.78, tMid);
          const rL = rU * (0.76 + hash2(row, side * 23 + 139) * 0.55);
          // Place right alongside the slab shoulder or tucked into the corner joint between rows.
          const push = isBay ? rU * 0.85 + 0.028 : rU * 0.58 + 0.014;
          const ct = THREE.MathUtils.lerp(t0, t1, cobbleChance > 0.66 ? 0.12 : 0.86);
          const cLat = edgeU + side * push;
          cobbles.push({
            t: ct,
            lateral: cLat,
            side,
            radiusU: rU,
            radiusL: rL,
            height: 0.0095 + hash2(row, side * 29 + 149) * 0.0058,
            yaw: (hash2(row, side * 31 + 151) - 0.5) * 1.4,
            palIdx: Math.floor(hash2(row * 7 + side, 157) * 4),
            toneScale: 0.93 + hash2(row * 3, side * 37 + 163) * 0.14,
            quad: (row + (side > 0 ? 1 : 2)) % 3,
            seed: row * 17.7 + (side > 0 ? 103.3 : 41.9),
          });
        }

        // Collect organic multi-lobe moss cushion locations along outer joints, coves, and flanking cobbles.
        const [, cz] = mapPathPoint(tMid, edgeU);
        const mossRoll = hash2(row * 11 + side * 5, 173);
        if (cz < 2.2 && cz > -22.0 && mossRoll > 0.42) {
          const jointT = mossRoll > 0.72 ? t0 : THREE.MathUtils.lerp(t0, t1, 0.55);
          const mLat = edgeU + side * (0.015 + hash2(row, side * 41 + 179) * 0.045);
          const [, mz] = mapPathPoint(jointT, mLat);
          mossClusters.push({
            t: jointT,
            lateral: mLat,
            side,
            scale: (0.78 + hash2(row, side * 43 + 181) * 0.52) * THREE.MathUtils.lerp(1.0, 0.80, tMid),
            // Keep taller grass blades behind the immediate foreground workbench area (z < -1.8).
            withBlades: mz < -1.8 && hash2(row, side * 47 + 191) > 0.38,
            seed: row * 23.1 + (side > 0 ? 77.7 : 13.3),
          });
        }
      }
    }

    prevZoneBackT = nextZoneBackT;
    tCursor = tBackBase;
    row++;
  }

  // Build exact per-bin outer lateral envelope from the real roadbed + slab polygons + cobbles.
  const leftEnvelope = new Float32Array(ENVELOPE_BINS + 1);
  const rightEnvelope = new Float32Array(ENVELOPE_BINS + 1);
  for (let i = 0; i <= ENVELOPE_BINS; i++) {
    const t = i / ENVELOPE_BINS;
    const half = courtyardPathHalfWidth(t);
    leftEnvelope[i] = -(half + rawShoulderOffset(t, -1));
    rightEnvelope[i] = half + rawShoulderOffset(t, 1);
  }

  const expandRange = (tStart: number, tEnd: number, minLat: number, maxLat: number) => {
    const b0 = Math.max(0, Math.floor(THREE.MathUtils.clamp(tStart, 0, 1) * ENVELOPE_BINS));
    const b1 = Math.min(ENVELOPE_BINS, Math.ceil(THREE.MathUtils.clamp(tEnd, 0, 1) * ENVELOPE_BINS));
    for (let i = b0; i <= b1; i++) {
      if (minLat < leftEnvelope[i]!) leftEnvelope[i] = minLat;
      if (maxLat > rightEnvelope[i]!) rightEnvelope[i] = maxLat;
    }
  };

  for (const slab of slabs) {
    expandRange(slab.t0, slab.t1, slab.minU - 0.012, slab.maxU + 0.012);
  }
  for (const cobble of cobbles) {
    const dt = (cobble.radiusL + 0.02) / COURTYARD_PATH_LENGTH;
    expandRange(cobble.t - dt, cobble.t + dt, cobble.lateral - cobble.radiusU - 0.012, cobble.lateral + cobble.radiusU + 0.012);
  }

  // Mild 3-tap smoothing so transitions between adjacent shoulder stones trace natural curved coves
  // without sharp bin staircase artifacts while never shrinking any protruding stone bound.
  const smoothLeft = leftEnvelope.slice();
  const smoothRight = rightEnvelope.slice();
  for (let i = 1; i < ENVELOPE_BINS; i++) {
    smoothLeft[i] = Math.min(leftEnvelope[i]!, (leftEnvelope[i - 1]! + leftEnvelope[i]! * 2 + leftEnvelope[i + 1]!) * 0.25);
    smoothRight[i] = Math.max(rightEnvelope[i]!, (rightEnvelope[i - 1]! + rightEnvelope[i]! * 2 + rightEnvelope[i + 1]!) * 0.25);
  }

  cachedRoadLayout = {
    slabs,
    cobbles,
    mossClusters,
    envelopeBins: ENVELOPE_BINS,
    leftEnvelope: smoothLeft,
    rightEnvelope: smoothRight,
  };
  return cachedRoadLayout;
}

/**
 * Exact organic outer lateral extent (in meters, signed: negative on left, positive on right)
 * of the courtyard stone path (slabs + shoulder cobbles + roadbed) at curve parameter `t`.
 */
export function courtyardPathEdgeLateral(t: number, side: -1 | 1): number {
  const layout = getCourtyardRoadLayout();
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const f = clamped * layout.envelopeBins;
  const i0 = Math.floor(f);
  const i1 = Math.min(layout.envelopeBins, i0 + 1);
  const alpha = f - i0;
  const arr = side < 0 ? layout.leftEnvelope : layout.rightEnvelope;
  return arr[i0]! + (arr[i1]! - arr[i0]!) * alpha;
}

/**
 * Accurate organic footprint test for the courtyard stone path (including protruding shoulder stones
 * and edging cobbles, while allowing meadow grass to creep closely into concave stone bays).
 */
export function isInsideCourtyardStonePath(x: number, z: number, margin = 0.11): boolean {
  const t0 = (COURTYARD_PATH_START_Z - z) / COURTYARD_PATH_LENGTH;
  if (t0 < -0.04 || t0 > 1.04) return false;
  const f0 = samplePathFrame(t0);
  const ds = (x - f0.x) * f0.tx + (z - f0.z) * f0.tz;
  const t1 = t0 + ds / f0.arcLen;
  if (t1 < -0.018 || t1 > 1.018) return false;
  const f1 = samplePathFrame(THREE.MathUtils.clamp(t1, 0, 1));
  const lateral = (x - f1.x) * f1.rx + (z - f1.z) * f1.rz;
  const left = courtyardPathEdgeLateral(t1, -1);
  const right = courtyardPathEdgeLateral(t1, 1);
  return lateral >= left - margin && lateral <= right + margin;
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

const SUN_DIR = new THREE.Vector3(-6, 12, 6).normalize();

function pushShoulderCobble(
  b: GeometryBuilder,
  cobble: CobbleDescriptor,
  floor: number,
  palette: RoadPalette,
) {
  const [cx, cz] = mapPathPoint(cobble.t, cobble.lateral);
  const baseY = floor + 0.0018;
  const topY = floor + cobble.height;
  const segs = 10;
  const baseColor = scaleRgb(palette.cobbles[cobble.palIdx % palette.cobbles.length]!, cobble.toneScale);
  const qU0 = (cobble.quad % 2) * 0.5 + 0.04;
  const qV0 = Math.floor(cobble.quad / 2) * 0.5 + 0.04;
  const qSpan = 0.42;
  const cosY = Math.cos(cobble.yaw);
  const sinY = Math.sin(cobble.yaw);

  const shoulderPts: [number, number, number][] = [];
  const basePts: [number, number, number][] = [];
  const ringUvs: [number, number][] = [];

  for (let s = 0; s < segs; s++) {
    const a = (s / segs) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const wobble = 0.84 + SLAB_NOISE(ca * 1.4 + cobble.seed, sa * 1.4 - cobble.seed * 0.6) * 0.22;
    const lx = ca * cobble.radiusU * wobble;
    const lz = sa * cobble.radiusL * wobble;
    const wx = cx + lx * cosY - lz * sinY;
    const wz = cz + lx * sinY + lz * cosY;
    basePts.push([wx, baseY, wz]);
    shoulderPts.push([
      cx + (wx - cx) * 0.64,
      THREE.MathUtils.lerp(baseY, topY, 0.78),
      cz + (wz - cz) * 0.64,
    ]);
    ringUvs.push([qU0 + (0.5 + ca * 0.42) * qSpan, qV0 + (0.5 + sa * 0.42) * qSpan]);
  }

  const centerIdx = pushVertex(b, cx, topY, cz, 0, 1, 0, qU0 + qSpan * 0.5, qV0 + qSpan * 0.5, scaleRgb(baseColor, 1.04));
  const shoulderIndices: number[] = [];
  const baseIndices: number[] = [];

  for (let s = 0; s < segs; s++) {
    const sp = shoulderPts[s]!;
    const bp = basePts[s]!;
    const uv = ringUvs[s]!;
    const dx = bp[0] - cx;
    const dz = bp[2] - cz;
    const len = Math.hypot(dx, dz) || 1;
    const snx = (dx / len) * 0.42;
    const sny = 0.91;
    const snz = (dz / len) * 0.42;
    const bnx = (dx / len) * 0.82;
    const bny = 0.57;
    const bnz = (dz / len) * 0.82;

    const sunDot = (dx / len) * SUN_DIR.x + (dz / len) * SUN_DIR.z;
    const shoulderCol = scaleRgb(baseColor, 0.96 + sunDot * 0.08);
    const baseCol = scaleRgb(baseColor, 0.74 + sunDot * 0.06);

    shoulderIndices.push(pushVertex(b, sp[0], sp[1], sp[2], snx, sny, snz, uv[0], uv[1], shoulderCol));
    baseIndices.push(pushVertex(b, bp[0], bp[1], bp[2], bnx, bny, bnz, uv[0], uv[1], baseCol));
  }

  for (let s = 0; s < segs; s++) {
    const next = (s + 1) % segs;
    // In XZ with a increasing CW from +Y: (center, next, s) faces +Y; skirt (s, next, baseS) faces outward.
    b.indices.push(centerIdx, shoulderIndices[next]!, shoulderIndices[s]!);
    b.indices.push(
      shoulderIndices[s]!, shoulderIndices[next]!, baseIndices[s]!,
      shoulderIndices[next]!, baseIndices[next]!, baseIndices[s]!,
    );
  }
}

function buildCourtyardRoadGeometry(floor: number, skin: CourtyardSkinId = 'none'): {
  roadGeometry: THREE.BufferGeometry;
  mossClusters: readonly MossClusterDescriptor[];
} {
  const palette = ROAD_PALETTES[skin];
  const layout = getCourtyardRoadLayout();
  const b = createBuilder();

  // 1. Organic recessed warm earth/mortar roadbed ribbon underneath all slabs.
  // Outer rim tracks the undulating simplex-noise stone boundary and tapers smoothly down
  // to floor + 0.0004 so soil & moss feather naturally into the meadow with zero ruler edge.
  const bedInteriorY = floor + 0.0055;
  const bedOuterY = floor + 0.0004;
  const bedSteps = 120;
  const cols = 5;
  const bedStartIndex = b.positions.length / 3;

  for (let i = 0; i <= bedSteps; i++) {
    const t = -0.006 + (i / bedSteps) * 1.012;
    const frame = samplePathFrame(t);
    const clampedT = THREE.MathUtils.clamp(t, 0, 1);
    const leftEdge = courtyardPathEdgeLateral(clampedT, -1);
    const rightEdge = courtyardPathEdgeLateral(clampedT, 1);
    // Subtle extra simplex feather along the earth rim so earth weaves gently under/past outer stones.
    const sMeters = clampedT * COURTYARD_PATH_LENGTH;
    const leftRim = leftEdge + EDGE_NOISE(sMeters * 1.15 + 2.4, 31.7) * 0.045 - 0.012;
    const rightRim = rightEdge + EDGE_NOISE(sMeters * 1.15 - 5.2, 47.3) * 0.045 + 0.012;

    const lats = [
      leftRim,
      leftRim * 0.72,
      (leftRim + rightRim) * 0.15,
      rightRim * 0.72,
      rightRim,
    ];
    const vBed = 0.54 + ((i % 4) / 4) * 0.42;

    for (let c = 0; c < cols; c++) {
      const lat = lats[c]!;
      const wx = frame.x + lat * frame.rx;
      const wz = frame.z + lat * frame.rz;
      const isOuter = c === 0 || c === cols - 1;
      const isInnerRim = c === 1 || c === cols - 2;
      const edgeWeight = isOuter ? 1.0 : isInnerRim ? 0.36 : 0;
      const variation = 0.93 + hash2(i * 1.7, c * 3.1) * 0.14;
      const color = scaleRgb(mixRgb(palette.mortarCenter, palette.mortarEdge, edgeWeight), variation);
      const y = isOuter
        ? bedOuterY + EDGE_NOISE(wx * 1.3, wz * 1.3) * 0.00025
        : isInnerRim
          ? bedInteriorY - 0.0008
          : bedInteriorY;
      const uBed = 0.54 + (c / (cols - 1)) * 0.42;
      pushVertex(b, wx, y, wz, 0, 1, 0, uBed, vBed, color);
    }
  }
  for (let i = 0; i < bedSteps; i++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = bedStartIndex + i * cols + c;
      const d = a + 1;
      const e = a + cols;
      const f = e + 1;
      b.indices.push(a, d, e, d, f, e);
    }
  }

  // 2. Irregular 12–14 vertex hand-dressed polygonal flagstones (single merged draw call).
  const slabBaseY = floor + 0.0024;

  for (const slab of layout.slabs) {
    const uCenter = (slab.u0 + slab.u1) * 0.5;
    const tCenter = (slab.t0 + slab.t1) * 0.5;
    const slabW = slab.u1 - slab.u0;
    const slabL = (slab.t1 - slab.t0) * COURTYARD_PATH_LENGTH;
    const halfU = slabW * 0.5;
    const halfL = slabL * 0.5;
    const n = slab.ringVerts;

    const contour = sampleSlabContourMeters(slab, halfU, halfL, palette.superellipseP, palette.outerRoughness);
    const slabColor = scaleRgb(palette.slabs[slab.palIdx % palette.slabs.length]!, slab.toneScale);
    const slabTopY = floor + slab.slabTopOffset;

    const qU0 = (slab.quad % 2) * 0.5 + 0.04;
    const qV0 = Math.floor(slab.quad / 2) * 0.5 + 0.04;
    const qSpan = 0.42;
    const cosUv = Math.cos(slab.uvAngle);
    const sinUv = Math.sin(slab.uvAngle);

    // Spatial UV projection within the borderless stone quadrant (rotated per stone to hide tiling).
    const toUv = (lx: number, lz: number): [number, number] => {
      const nx = lx / Math.max(halfU, 0.25);
      const nz = lz / Math.max(halfL, 0.25);
      const ru = (nx * cosUv - nz * sinUv) * 0.38 + 0.5 + slab.uvShiftU;
      const rv = (nx * sinUv + nz * cosUv) * 0.38 + 0.5 + slab.uvShiftV;
      return [
        qU0 + THREE.MathUtils.clamp(ru, 0.02, 0.98) * qSpan,
        qV0 + THREE.MathUtils.clamp(rv, 0.02, 0.98) * qSpan,
      ];
    };

    const basePts: [number, number, number][] = [];
    const topPts: [number, number, number][] = [];
    const baseUvs: [number, number][] = [];
    const topUvs: [number, number][] = [];
    const rFracs: number[] = [];

    for (let k = 0; k < n; k++) {
      const [lx, lz] = contour[k]!;
      const bu = uCenter + lx;
      const bt = tCenter + lz / COURTYARD_PATH_LENGTH;
      const [bx, bz] = mapPathPoint(bt, bu);
      basePts.push([bx, slabBaseY, bz]);
      baseUvs.push(toUv(lx, lz));

      // Hand-chiseled variable bevel inset per vertex (0.024m..0.040m).
      const dist = Math.hypot(lx, lz) || 1;
      const localBevel = 0.029 + SLAB_NOISE(lx * 4.5 + slab.row * 3.1, lz * 4.5 + slab.col * 7.3) * 0.008;
      const shrink = THREE.MathUtils.clamp((dist - localBevel) / dist, 0.62, 0.92);
      const tlx = lx * shrink;
      const tlz = lz * shrink;
      const tu = uCenter + tlx;
      const tt = tCenter + tlz / COURTYARD_PATH_LENGTH;
      const [tx, tz] = mapPathPoint(tt, tu);
      const nu = tlx / Math.max(halfU, 0.15);
      const nv = tlz / Math.max(halfL, 0.15);
      // Tiny natural worn pillow (-0.0005m at top rim) while staying strictly inside [floor+0.0155, floor+0.0195].
      const ty = THREE.MathUtils.clamp(
        slabTopY + nu * slab.tiltU + nv * slab.tiltV - 0.0005,
        floor + 0.0155,
        floor + 0.0195,
      );
      topPts.push([tx, ty, tz]);
      topUvs.push(toUv(tlx, tlz));
      rFracs.push(shrink);
    }

    const [cx, cz] = mapPathPoint(tCenter, uCenter);
    const topNormal = new THREE.Vector3(-slab.tiltU * 1.4, 1, -slab.tiltV * 1.4).normalize();

    // Top face fan: center + N perimeter vertices.
    const [cUvU, cUvV] = toUv(0, 0);
    const centerIdx = pushVertex(b, cx, slabTopY, cz, topNormal.x, topNormal.y, topNormal.z, cUvU, cUvV, slabColor);
    const topRingIndices: number[] = [];

    for (let k = 0; k < n; k++) {
      const [px, py, pz] = topPts[k]!;
      const [uvU, uvV] = topUvs[k]!;
      const dx = px - cx;
      const dz = pz - cz;
      const len = Math.hypot(dx, dz) || 1;
      const sunFacing = (dx / len) * SUN_DIR.x + (dz / len) * SUN_DIR.z;
      // Geometry-driven radial & directional rim shading (replaces the old rectangular UV black frame).
      const rimWeight = THREE.MathUtils.smoothstep(rFracs[k]!, 0.62, 0.92);
      const rimFactor = 1.0 + sunFacing * 0.036 * rimWeight - (1 - Math.max(0, sunFacing)) * 0.022 * rimWeight;
      let vertCol = scaleRgb(slabColor, rimFactor);
      // Subtle weathered mossy hint on outer meadow-facing shoulder rims.
      if ((slab.isLeftEdge && contour[k]![0] < -halfU * 0.45) || (slab.isRightEdge && contour[k]![0] > halfU * 0.45)) {
        const mossHint = Math.max(0, MOSS_NOISE(px * 1.6, pz * 1.6)) * 0.14;
        vertCol = mixRgb(vertCol, palette.mortarEdge, mossHint);
      }
      topRingIndices.push(pushVertex(b, px, py, pz, topNormal.x, topNormal.y, topNormal.z, uvU, uvV, vertCol));
    }

    for (let k = 0; k < n; k++) {
      const next = (k + 1) % n;
      b.indices.push(centerIdx, topRingIndices[k]!, topRingIndices[next]!);
    }

    // Shared-ring hand-worn bevel skirt (2*N vertices per slab = lean mobile vertex budget).
    // Creased cleanly from the flat top face while smoothly wrapping the stone shoulder perimeter.
    const bevelTopIndices: number[] = [];
    const bevelBaseIndices: number[] = [];

    for (let k = 0; k < n; k++) {
      const prev = (k + n - 1) % n;
      const next = (k + 1) % n;
      const pT = topPts[k]!;
      const pB = basePts[k]!;
      const pTPrev = topPts[prev]!;
      const pTNext = topPts[next]!;

      // Tangent along perimeter (CCW) and outward-downward bevel vector.
      const tEdgeX = pTNext[0] - pTPrev[0];
      const tEdgeY = pTNext[1] - pTPrev[1];
      const tEdgeZ = pTNext[2] - pTPrev[2];
      const downX = pB[0] - pT[0];
      const downY = pB[1] - pT[1];
      const downZ = pB[2] - pT[2];
      // Cross(down, tangent) points outward and upward for CCW ring.
      const nx = downY * tEdgeZ - downZ * tEdgeY;
      const ny = downZ * tEdgeX - downX * tEdgeZ;
      const nz = downX * tEdgeY - downY * tEdgeX;
      const nLen = Math.hypot(nx, ny, nz) || 1;
      const fnx = nx / nLen;
      const fny = Math.max(0.28, ny / nLen);
      const fnz = nz / nLen;
      const normLen = Math.hypot(fnx, fny, fnz) || 1;
      const unx = fnx / normLen;
      const uny = fny / normLen;
      const unz = fnz / normLen;

      const sunDot = unx * SUN_DIR.x + uny * SUN_DIR.y + unz * SUN_DIR.z;
      const topBevelFactor = THREE.MathUtils.lerp(0.87, 1.04, THREE.MathUtils.clamp((sunDot + 0.4) / 1.1, 0, 1));
      const baseBevelFactor = THREE.MathUtils.lerp(0.69, 0.82, THREE.MathUtils.clamp((sunDot + 0.4) / 1.1, 0, 1));

      const topCol = scaleRgb(slabColor, topBevelFactor);
      const baseCol = mixRgb(scaleRgb(slabColor, baseBevelFactor), palette.mortarCenter, 0.22);

      bevelTopIndices.push(pushVertex(b, pT[0], pT[1], pT[2], unx, uny, unz, topUvs[k]![0], topUvs[k]![1], topCol));
      bevelBaseIndices.push(pushVertex(b, pB[0], pB[1], pB[2], unx, uny, unz, baseUvs[k]![0], baseUvs[k]![1], baseCol));
    }

    for (let k = 0; k < n; k++) {
      const next = (k + 1) % n;
      const i0 = bevelTopIndices[k]!;
      const i1 = bevelTopIndices[next]!;
      const i2 = bevelBaseIndices[k]!;
      const i3 = bevelBaseIndices[next]!;
      b.indices.push(i0, i2, i1, i1, i2, i3);
    }
  }

  // 3. Natural shoulder cobbles & edging pebbles merged into the same single-draw-call road mesh.
  for (const cobble of layout.cobbles) {
    pushShoulderCobble(b, cobble, floor, palette);
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  roadGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
  roadGeometry.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  roadGeometry.setIndex(b.indices);
  roadGeometry.computeBoundingBox();
  roadGeometry.computeBoundingSphere();
  return { roadGeometry, mossClusters: layout.mossClusters };
}

/**
 * Build organic multi-lobe moss pads (scalloped irregular leaf/cushion silhouettes driven by
 * simplex-noise, never plain elliptical discs) plus sparse curved grass blades tucked into outer stone crevices.
 */
function buildEdgeMossGeometry(
  clusters: readonly MossClusterDescriptor[],
  floor: number,
  palette: RoadPalette,
): THREE.BufferGeometry | undefined {
  if (!clusters.length) return undefined;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  clusters.forEach((cluster, clusterIdx) => {
    const [baseX, baseZ] = mapPathPoint(cluster.t, cluster.lateral);
    const frame = samplePathFrame(cluster.t);
    const lobes = 2 + (clusterIdx % 2); // 2–3 overlapping multi-lobe organic cushions per cluster

    for (let l = 0; l < lobes; l++) {
      const lobeSeed = cluster.seed + l * 17.3;
      const alongShift = (l - (lobes - 1) * 0.5) * 0.085 * cluster.scale;
      const outShift = (hash2(clusterIdx * 7 + l, 11) - 0.32) * 0.055 * cluster.scale * cluster.side;
      const mx = baseX + frame.tx * alongShift + frame.rx * outShift;
      const mz = baseZ + frame.tz * alongShift + frame.rz * outShift;

      const radMain = (l === 0 ? 0.095 : 0.068) * cluster.scale * (0.86 + hash2(clusterIdx, l * 13 + 5) * 0.30);
      const radCross = radMain * (0.68 + hash2(clusterIdx, l * 19 + 7) * 0.42);
      const domeH = (0.011 + hash2(clusterIdx + l, 23) * 0.009) * Math.min(1.15, cluster.scale);
      const segs = 12;
      const lobePhase = hash2(clusterIdx, l * 29 + 3) * Math.PI * 2;
      const tone = 0.92 + hash2(clusterIdx * 3 + l, 31) * 0.16;
      const tipCol = scaleRgb(palette.mossTip, tone);
      const midCol = scaleRgb(mixRgb(palette.mossRoot, palette.mossTip, 0.52), tone);
      const rimCol = scaleRgb(palette.mossRoot, tone * 0.92);

      const centerIdx = positions.length / 3;
      positions.push(mx, floor + domeH, mz);
      normals.push(0, 1, 0);
      colors.push(tipCol[0], tipCol[1], tipCol[2]);

      const ringStart = positions.length / 3;
      for (let s = 0; s < segs; s++) {
        const sa = (s / segs) * Math.PI * 2;
        const ca = Math.cos(sa);
        const saSin = Math.sin(sa);
        // Multi-lobe scalloped moss silhouette: 3-lobe + 5-lobe harmonic + simplex noise (rejects plain ovals!).
        const nVal = MOSS_NOISE(ca * 1.9 + lobeSeed, saSin * 1.9 - lobeSeed * 0.7);
        const scallop =
          0.74 +
          nVal * 0.24 +
          Math.sin(sa * 3 + lobePhase) * 0.16 +
          Math.cos(sa * 5 - lobePhase * 1.3) * 0.08;
        const rFactor = THREE.MathUtils.clamp(scallop, 0.46, 1.24);
        const px = mx + ca * radMain * rFactor;
        const pz = mz + saSin * radCross * rFactor;
        positions.push(px, floor + 0.001, pz);
        normals.push(ca * 0.36, 0.93, saSin * 0.36);
        const edgeCol = rFactor > 0.92 ? midCol : rimCol;
        colors.push(edgeCol[0], edgeCol[1], edgeCol[2]);
      }

      for (let s = 0; s < segs; s++) {
        const next = (s + 1) % segs;
        indices.push(centerIdx, ringStart + next, ringStart + s);
      }
    }

    // Companion delicate curved grass blades sprouting from crevices behind the foreground area.
    if (cluster.withBlades) {
      const blades = 2 + (clusterIdx % 2);
      for (let k = 0; k < blades; k++) {
        const angle = hash2(clusterIdx, k * 7 + 3) * Math.PI * 2;
        const lean = 0.028 + hash2(clusterIdx, k * 11 + 5) * 0.032;
        const height = 0.068 + hash2(clusterIdx, k * 13 + 7) * 0.048;
        const halfWidth = 0.013 + hash2(clusterIdx, k * 17 + 1) * 0.005;
        const ox = (hash2(clusterIdx, k * 5 + 2) - 0.5) * 0.08;
        const oz = (hash2(clusterIdx, k * 5 + 9) - 0.5) * 0.08;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const baseIndex = positions.length / 3;
        const tone = 0.92 + hash2(clusterIdx, k + 29) * 0.16;
        const rootCol = scaleRgb(palette.mossRoot, tone);
        const midCol = scaleRgb(mixRgb(palette.mossRoot, palette.mossTip, 0.55), tone);
        const tipCol = scaleRgb(palette.mossTip, tone);

        const pushBladeVert = (x: number, y: number, z: number, col: RGB) => {
          positions.push(baseX + ox + x, floor + 0.004 + y, baseZ + oz + z);
          normals.push(0, 1, 0);
          colors.push(col[0], col[1], col[2]);
        };

        pushBladeVert(-sin * halfWidth, 0, cos * halfWidth, rootCol);
        pushBladeVert(sin * halfWidth, 0, -cos * halfWidth, rootCol);
        pushBladeVert(cos * lean * 0.45 - sin * halfWidth * 0.65, height * 0.55, sin * lean * 0.45 + cos * halfWidth * 0.65, midCol);
        pushBladeVert(cos * lean * 0.45 + sin * halfWidth * 0.65, height * 0.55, sin * lean * 0.45 - cos * halfWidth * 0.65, midCol);
        pushBladeVert(cos * lean, height, sin * lean, tipCol);

        indices.push(
          baseIndex, baseIndex + 1, baseIndex + 2,
          baseIndex + 1, baseIndex + 3, baseIndex + 2,
          baseIndex + 2, baseIndex + 3, baseIndex + 4,
        );
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

export function createCourtyardStonePath({
  floor,
  night,
  skin = 'none',
}: {
  floor: number;
  night: boolean;
  skin?: CourtyardSkinId;
}) {
  const palette = ROAD_PALETTES[skin];
  const { roadGeometry, mossClusters } = buildCourtyardRoadGeometry(floor, skin);
  const atlasBytes = createStoneAtlasBytes(256);

  // Komorebi daylight surface: matte stone (shininess <= 8), clamped lighting before pigment.
  const komorebiMap = makeAtlasTexture(atlasBytes, 256, THREE.NoColorSpace);
  const komorebiMaterial = createKomorebiSurface();
  komorebiMaterial.color.setRGB(1, 1, 1);
  komorebiMaterial.map = komorebiMap;
  komorebiMaterial.vertexColors = true;
  komorebiMaterial.shininess = 6;
  komorebiMaterial.specular.setRGB(0.018, 0.018, 0.018);
  komorebiMaterial.name = 'Courtyard stylized stone path (Komorebi)';
  komorebiMaterial.userData.komorebiSurface = true;
  komorebiMaterial.userData.komorebiPigment = true;

  // Standard PBR material for night courtyards (cool muted moonlit stone) and non-Komorebi tones.
  const standardMap = makeAtlasTexture(atlasBytes, 256, THREE.SRGBColorSpace);
  const standardMaterial = new THREE.MeshStandardMaterial({
    color: night ? 0x9ca0a4 : 0xd4cbbd,
    map: standardMap,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
  });
  standardMaterial.name = night ? 'Courtyard stylized stone path (night)' : 'Courtyard stylized stone path';
  standardMaterial.userData.komorebiPigment = true;

  const mesh = new THREE.Mesh(roadGeometry, night ? standardMaterial : komorebiMaterial);
  mesh.name = 'courtyard-stone-path';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.toonSurface = { outline: false, shading: 'smooth' };
  mesh.userData.stonePath = true;

  // Organic multi-lobe moss pads & crevice grass blades tucked along outer stone joints (daylight only).
  let mossMesh: THREE.Mesh | undefined;
  let mossGeometry: THREE.BufferGeometry | undefined;
  let mossKomorebiMaterial: THREE.MeshPhongMaterial | undefined;
  let mossStandardMaterial: THREE.MeshStandardMaterial | undefined;

  if (!night) {
    mossGeometry = buildEdgeMossGeometry(mossClusters, floor, palette);
    if (mossGeometry) {
      mossKomorebiMaterial = createKomorebiSurface();
      mossKomorebiMaterial.color.setRGB(1, 1, 1);
      mossKomorebiMaterial.vertexColors = true;
      mossKomorebiMaterial.shininess = 6;
      mossKomorebiMaterial.specular.setRGB(0.015, 0.015, 0.015);
      mossKomorebiMaterial.side = THREE.DoubleSide;
      mossKomorebiMaterial.name = 'Courtyard path edge moss (Komorebi)';
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

      mossMesh = new THREE.Mesh(mossGeometry, mossKomorebiMaterial);
      mossMesh.name = 'courtyard-path-moss';
      mossMesh.receiveShadow = true;
      mossMesh.castShadow = false;
      mossMesh.raycast = () => {};
      mossMesh.userData.toonSurface = { outline: false, shading: 'smooth' };
      mossMesh.userData.stonePath = true;
    }
  }

  let disposed = false;

  function setTone(tone: EnvironmentTone) {
    if (disposed) return;
    if (night) {
      mesh.material = standardMaterial;
      standardMaterial.color.setHex(tone === 'tiny-delivery' ? 0xa9a8a4 : 0x9ca0a4);
      return;
    }
    const useKomorebi = tone === 'komorebi';
    mesh.material = useKomorebi ? komorebiMaterial : standardMaterial;
    if (!useKomorebi) {
      standardMaterial.color.setHex(tone === 'tiny-delivery' ? 0xd9cdb8 : 0xd4cbbd);
    }
    if (mossMesh && mossKomorebiMaterial && mossStandardMaterial) {
      mossMesh.material = useKomorebi ? mossKomorebiMaterial : mossStandardMaterial;
    }
  }

  return {
    mesh,
    mossMesh,
    setTone,
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.removeFromParent();
      mossMesh?.removeFromParent();
      roadGeometry.dispose();
      mossGeometry?.dispose();
      komorebiMaterial.dispose();
      standardMaterial.dispose();
      mossKomorebiMaterial?.dispose();
      mossStandardMaterial?.dispose();
      komorebiMap.dispose();
      standardMap.dispose();
    },
  };
}
