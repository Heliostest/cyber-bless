import * as THREE from 'three';
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

function hash2(a: number, b: number): number {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return value - Math.floor(value);
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

/**
 * Curated regional stone-road slab & mortar palettes (raw-gamma space for Komorebi day).
 * All palettes share the exact same road geometry and vertex count while harmonizing
 * courtyard stone paths with each regional skin's architecture.
 */
interface RoadPalette {
  slabs: readonly RGB[];
  mortarCenter: RGB;
  mortarEdge: RGB;
}

const ROAD_PALETTES: Record<CourtyardSkinId, RoadPalette> = {
  none: {
    slabs: ['#c7baa2', '#c4b59a', '#bfb39e', '#bdab91', '#b7ab97', '#b2a692'].map(parseHex),
    mortarCenter: parseHex('#7c7260'),
    mortarEdge: parseHex('#717954'),
  },
  'japanese-karesansui': {
    // Refined Kyoto weathered granite / warm silver-grey temple flagstones.
    slabs: ['#bbb6ab', '#b3afa5', '#c3beb2', '#aba79e', '#b9b4a8', '#a4a097'].map(parseHex),
    mortarCenter: parseHex('#78756b'),
    mortarEdge: parseHex('#63734e'),
  },
  'chinese-jiangnan': {
    // Suzhou bluestone flagstones (青石板) with mossy slate-earth seams.
    slabs: ['#a6aeae', '#9da6a8', '#b0b5b2', '#959fa1', '#a2abac', '#8f989a'].map(parseHex),
    mortarCenter: parseHex('#6d726f'),
    mortarEdge: parseHex('#5f7054'),
  },
  'warm-terracotta-arch': {
    // Sun-warmed Andalusian terracotta-sandstone patio pavers with sandy lime seams.
    slabs: ['#cca180', '#c49674', '#d1aa89', '#bd8e6c', '#c89e7c', '#b78968'].map(parseHex),
    mortarCenter: parseHex('#8a7b66'),
    mortarEdge: parseHex('#7d7c5b'),
  },
};

const MOSS_ROOT: RGB = parseHex('#496f37');
const MOSS_TIP: RGB = parseHex('#8eb256');

interface PathFrame {
  x: number;
  z: number;
  rx: number;
  rz: number;
  tx: number;
  tz: number;
  half: number;
}

function samplePathFrame(t: number): PathFrame {
  const clamped = THREE.MathUtils.clamp(t, -0.02, 1.02);
  const x = courtyardPathCenterX(clamped);
  const z = COURTYARD_PATH_START_Z - clamped * COURTYARD_PATH_LENGTH;
  const dx = 1.6 * Math.PI * 1.5 * Math.cos(clamped * Math.PI * 1.5);
  const dz = -COURTYARD_PATH_LENGTH;
  const len = Math.hypot(dx, dz);
  const tx = dx / len;
  const tz = dz / len;
  // Right-hand perpendicular (+X side when facing along -Z).
  const rx = -tz;
  const rz = tx;
  return { x, z, rx, rz, tx, tz, half: courtyardPathHalfWidth(THREE.MathUtils.clamp(t, 0, 1)) };
}

function mapPathPoint(t: number, lateral: number): [number, number] {
  const frame = samplePathFrame(t);
  return [frame.x + lateral * frame.rx, frame.z + lateral * frame.rz];
}

/**
 * Clean 2×2 procedural cel-stone atlas:
 *  - Quadrants (0,0), (1,0), (0,1): three stylized anime stone slab surfaces
 *    with crisp perimeter edge framing and broad 2–3 tone painterly cel washes.
 *  - Quadrant (1,1): soft warm earth/mortar wash for the recessed bed.
 * Luminance is centered near 1.0 so per-slab vertex colors control calibrated L*.
 */
let cachedStoneAtlasBytes: Uint8Array<ArrayBuffer> | undefined;

function createStoneAtlasBytes(size = 256): Uint8Array<ArrayBuffer> {
  if (cachedStoneAtlasBytes && cachedStoneAtlasBytes.length === size * size * 4) {
    return cachedStoneAtlasBytes;
  }
  const bytes = new Uint8Array(size * size * 4);
  const half = size / 2;
  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  for (let py = 0; py < size; py++) {
    const qy = py < half ? 0 : 1;
    const v = (py - qy * half + 0.5) / half; // 0..1 within tile
    for (let px = 0; px < size; px++) {
      const qx = px < half ? 0 : 1;
      const u = (px - qx * half + 0.5) / half; // 0..1 within tile
      const quad = qy * 2 + qx;

      let r = 1;
      let g = 1;
      let b = 1;

      if (quad < 3) {
        // Broad, clean cel-painted tonal planes (no high-frequency noise).
        const phase = quad * 2.1 + 0.4;
        const diag = u * 0.72 + (1 - v) * 0.68;
        const wave =
          Math.sin(u * 4.2 + phase) * 0.14 +
          Math.cos(v * 3.7 - phase * 0.8) * 0.14 +
          Math.sin((u - v) * 5.0 + phase * 1.3) * 0.08;
        const field = diag * 0.55 + 0.28 + wave;

        // Three clean cel bands: sunlit plane, main body, cool-warm mid-plane.
        let shade = 0.935;
        shade += 0.065 * smoothstep(0.41, 0.46, field);
        shade += 0.052 * smoothstep(0.70, 0.75, field);

        // Subtle clean anime corner/chisel highlight patch.
        const cornerPatch = smoothstep(0.29, 0.21, Math.hypot(u - (0.24 + quad * 0.22), v - (0.72 - quad * 0.18)));
        shade += cornerPatch * 0.028;

        // Crisp stylized bevel/contour framing around slab perimeter.
        // Sun comes from (-X, +Z) -> left (low u) and front/sunward (low v).
        const borderMin = Math.min(u, 1 - u, v, 1 - v);
        const sunRim = Math.max(smoothstep(0.105, 0.04, u), smoothstep(0.105, 0.04, v)) * smoothstep(0.02, 0.045, borderMin);
        const shadowRim = Math.max(smoothstep(0.90, 0.965, u), smoothstep(0.90, 0.965, v)) * smoothstep(0.02, 0.05, borderMin);
        const inkLine = smoothstep(0.042, 0.014, borderMin);

        shade += sunRim * 0.052;
        shade -= shadowRim * 0.10;
        shade *= 1 - inkLine * 0.17;

        // Subtle warm/cool cel hue split: sunlit lifts slightly warmer, shaded leans slightly cooler taupe.
        const warmShift = (shade - 0.97) * 0.20;
        r = THREE.MathUtils.clamp(shade + warmShift * 0.55, 0, 1);
        g = THREE.MathUtils.clamp(shade + warmShift * 0.12, 0, 1);
        b = THREE.MathUtils.clamp(shade - warmShift * 0.65, 0, 1);
      } else {
        // Mortar / recessed earth bed tile: soft broad painterly variation centered around 0.98.
        const wash =
          0.98 +
          0.045 * Math.sin(u * Math.PI * 2 + Math.cos(v * Math.PI * 2) * 0.8) +
          0.03 * Math.cos(v * Math.PI * 4 - u * Math.PI * 2);
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

function buildCourtyardRoadGeometry(floor: number, skin: CourtyardSkinId = 'none'): {
  roadGeometry: THREE.BufferGeometry;
  mossPositions: [number, number, number][];
} {
  const palette = ROAD_PALETTES[skin];
  const b = createBuilder();
  const mossPositions: [number, number, number][] = [];

  // 1. Continuous recessed warm earth/mortar roadbed ribbon underneath all slabs.
  // Sits at floor + 0.006 so slabs (base floor + 0.003, top floor + 0.0175) sit firmly embedded.
  const bedY = floor + 0.006;
  const bedSteps = 72;
  const latFractions = [-0.96, -0.76, 0, 0.76, 0.96];
  const cols = latFractions.length;
  const bedStartIndex = b.positions.length / 3;

  for (let i = 0; i <= bedSteps; i++) {
    const t = -0.006 + (i / bedSteps) * 1.012;
    const frame = samplePathFrame(t);
    const vBed = 0.54 + ((i % 4) / 4) * 0.42;
    for (let c = 0; c < cols; c++) {
      const frac = latFractions[c]!;
      const lat = frac * frame.half;
      const wx = frame.x + lat * frame.rx;
      const wz = frame.z + lat * frame.rz;
      const edgeWeight = Math.abs(frac) > 0.8 ? 1 : Math.abs(frac) > 0.5 ? 0.35 : 0;
      const variation = 0.94 + hash2(i * 1.7, c * 3.1) * 0.12;
      const color = scaleRgb(mixRgb(palette.mortarCenter, palette.mortarEdge, edgeWeight), variation);
      const uBed = 0.54 + ((frac + 1) * 0.5) * 0.42;
      pushVertex(b, wx, bedY, wz, 0, 1, 0, uBed, vBed, color);
    }
  }
  for (let i = 0; i < bedSteps; i++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = bedStartIndex + i * cols + c;
      const d = a + 1;
      const e = a + cols;
      const f = e + 1;
      // Front-to-back moves along -Z, left-to-right moves along +X, so (a, d, e) faces +Y.
      b.indices.push(a, d, e, d, f, e);
    }
  }

  // 2. Individual stylized beveled stone slabs laid in coursed irregular running-bond rows.
  const threeColTemplates: readonly [number, number, number][] = [
    [0.29, 0.42, 0.29],
    [0.40, 0.26, 0.34],
    [0.32, 0.31, 0.37],
    [0.42, 0.32, 0.26],
  ];
  const twoColTemplates: readonly [number, number][] = [
    [0.57, 0.43],
    [0.42, 0.58],
    [0.53, 0.47],
  ];

  // Sun direction normalized for subtle per-bevel cel highlight/shadow tinting: (-6, 12, 6).
  const sunDir = new THREE.Vector3(-6, 12, 6).normalize();
  const slabBaseY = floor + 0.003;
  const seamGap = 0.038;
  const bevelInset = 0.024;

  let tCursor = -0.004;
  let row = 0;
  let prevPaletteIdx = -1;

  while (tCursor < 1.002) {
    const midFrame = samplePathFrame(Math.min(1, tCursor + 0.009));
    // Course length: generous readable flagstones in foreground/midground, gently scaled in far distance.
    const baseLen = THREE.MathUtils.lerp(0.70, 0.52, THREE.MathUtils.clamp(tCursor, 0, 1));
    const rowLenMeters = baseLen * (0.89 + hash2(row, 11) * 0.22);
    const dt = rowLenMeters / COURTYARD_PATH_LENGTH;
    const tFront = tCursor;
    const tBack = Math.min(1.004, tCursor + dt);
    const tMid = (tFront + tBack) * 0.5;
    const halfW = samplePathFrame(tMid).half;
    const fullW = halfW * 2;

    const useThree = halfW >= 0.84;
    const template = useThree
      ? threeColTemplates[row % threeColTemplates.length]!
      : twoColTemplates[row % twoColTemplates.length]!;

    // Apply slight deterministic per-column proportion jitter while preserving sum = 1.
    const rawWeights = template.map((w, col) => w + (hash2(row * 7 + col, 19) - 0.5) * 0.045);
    const weightSum = rawWeights.reduce((acc, w) => acc + w, 0);
    const weights = rawWeights.map(w => w / weightSum);

    let fracCursor = 0;
    for (let col = 0; col < weights.length; col++) {
      const wFrac = weights[col]!;
      const leftFrac = fracCursor;
      const rightFrac = fracCursor + wFrac;
      fracCursor = rightFrac;

      const isLeftEdge = col === 0;
      const isRightEdge = col === weights.length - 1;

      // Subtle organic outer edge overhang so stone border silhouettes cleanly against the meadow.
      const leftOverhang = isLeftEdge ? (hash2(row, 31) - 0.35) * 0.08 : 0;
      const rightOverhang = isRightEdge ? (hash2(row, 37) - 0.35) * 0.08 : 0;

      const u0 = -halfW + leftFrac * fullW + (isLeftEdge ? -leftOverhang : seamGap * 0.5);
      const u1 = -halfW + rightFrac * fullW + (isRightEdge ? rightOverhang : -seamGap * 0.5);

      // Slight row-end stagger on individual slabs so transverse seams feel hand-laid.
      const frontJitter = (hash2(row * 5 + col, 41) - 0.5) * 0.016 / COURTYARD_PATH_LENGTH;
      const backJitter = (hash2(row * 5 + col, 43) - 0.5) * 0.016 / COURTYARD_PATH_LENGTH;
      const t0 = tFront + (seamGap * 0.5) / COURTYARD_PATH_LENGTH + frontJitter;
      const t1 = tBack - (seamGap * 0.5) / COURTYARD_PATH_LENGTH + backJitter;

      const slabW = u1 - u0;
      const slabL = (t1 - t0) * COURTYARD_PATH_LENGTH;
      if (slabW < 0.16 || slabL < 0.16) continue;

      // Pick a regional slab tone different from the previous slab in the row.
      let palIdx = Math.floor(hash2(row * 13 + col * 5, 53) * palette.slabs.length);
      if (palIdx === prevPaletteIdx) palIdx = (palIdx + 1 + (row % 2)) % palette.slabs.length;
      prevPaletteIdx = palIdx;
      const slabColor = scaleRgb(palette.slabs[palIdx]!, 0.975 + hash2(row, col * 17 + 7) * 0.05);

      // Keep top well within [floor + 0.0155, floor + 0.0195] so Didukh (< floor + 0.03)
      // and shinto-torii authored steps (at y = 0 with floor = -0.035) stay cleanly separated.
      const slabTopY = floor + 0.0162 + hash2(row * 3 + col, 61) * 0.0030;
      const tiltU = (hash2(row + col * 11, 67) - 0.5) * 0.0018;
      const tiltV = (hash2(row * 9 + col, 71) - 0.5) * 0.0018;

      const chamfer = THREE.MathUtils.clamp(Math.min(slabW, slabL) * 0.095, 0.028, 0.068);
      const cT = chamfer / COURTYARD_PATH_LENGTH;
      const cU = chamfer;

      // 8 perimeter corners in CCW order when viewed from +Y (u increases right/+X, t increases back/-Z):
      // Front edge (t0) goes left->right, right edge (u1) goes front->back, back edge (t1) goes right->left, left edge (u0) goes back->front.
      const rawCorners: [number, number][] = [
        [u0 + cU * (0.85 + hash2(row, col * 2 + 1) * 0.3), t0],
        [u1 - cU * (0.85 + hash2(row, col * 2 + 2) * 0.3), t0],
        [u1, t0 + cT * (0.85 + hash2(row, col * 2 + 3) * 0.3)],
        [u1, t1 - cT * (0.85 + hash2(row, col * 2 + 4) * 0.3)],
        [u1 - cU * (0.85 + hash2(row, col * 2 + 5) * 0.3), t1],
        [u0 + cU * (0.85 + hash2(row, col * 2 + 6) * 0.3), t1],
        [u0, t1 - cT * (0.85 + hash2(row, col * 2 + 7) * 0.3)],
        [u0, t0 + cT * (0.85 + hash2(row, col * 2 + 8) * 0.3)],
      ];

      const uCenter = (u0 + u1) * 0.5;
      const tCenter = (t0 + t1) * 0.5;

      // Atlas quadrant for this slab (0, 1, or 2 — quadrant 3 is mortar).
      const quad = (row * 3 + col + Math.floor(hash2(row, col + 83) * 3)) % 3;
      const qU0 = (quad % 2) * 0.5 + 0.015;
      const qV0 = Math.floor(quad / 2) * 0.5 + 0.015;
      const qSpan = 0.47;

      const toUv = (uVal: number, tVal: number): [number, number] => {
        const nu = THREE.MathUtils.clamp((uVal - u0) / slabW, 0, 1);
        const nv = THREE.MathUtils.clamp((tVal - t0) / (t1 - t0), 0, 1);
        return [qU0 + nu * qSpan, qV0 + nv * qSpan];
      };

      // Map outer base and inset top rings to world space.
      const basePts: [number, number, number][] = [];
      const topPts: [number, number, number][] = [];
      const baseUvs: [number, number][] = [];
      const topUvs: [number, number][] = [];

      const dtInset = bevelInset / COURTYARD_PATH_LENGTH;
      for (let k = 0; k < 8; k++) {
        const [cu, ct] = rawCorners[k]!;
        const [bx, bz] = mapPathPoint(ct, cu);
        basePts.push([bx, slabBaseY, bz]);
        baseUvs.push(toUv(cu, ct));

        // Inset smoothly toward slab center to create a clean chamfered bevel.
        const du = cu - uCenter;
        const dtc = (ct - tCenter) * COURTYARD_PATH_LENGTH;
        const dist = Math.hypot(du, dtc) || 1;
        const shrink = Math.max(0.5, (dist - bevelInset) / dist);
        const tu = uCenter + du * shrink;
        const tt = tCenter + (ct - tCenter) * shrink;
        // Clamp inset softly within inner rectangle so thin slabs stay clean.
        const clampedU = THREE.MathUtils.clamp(tu, u0 + bevelInset * 0.65, u1 - bevelInset * 0.65);
        const clampedT = THREE.MathUtils.clamp(tt, t0 + dtInset * 0.65, t1 - dtInset * 0.65);
        const [tx, tz] = mapPathPoint(clampedT, clampedU);
        const nu = (clampedU - uCenter) / (slabW * 0.5);
        const nv = (clampedT - tCenter) / ((t1 - t0) * 0.5);
        const ty = slabTopY + nu * tiltU + nv * tiltV;
        topPts.push([tx, ty, tz]);
        topUvs.push(toUv(clampedU, clampedT));
      }

      // Compute clean slightly tilted top normal.
      const [cx, cz] = mapPathPoint(tCenter, uCenter);
      const topNormal = new THREE.Vector3(-tiltU * 1.4, 1, -tiltV * 1.4).normalize();

      // Top face fan (center + 8 ring vertices).
      const [cUvU, cUvV] = toUv(uCenter, tCenter);
      const centerIdx = pushVertex(b, cx, slabTopY, cz, topNormal.x, topNormal.y, topNormal.z, cUvU, cUvV, slabColor);
      const topRingIndices: number[] = [];
      for (let k = 0; k < 8; k++) {
        const [px, py, pz] = topPts[k]!;
        const [uvU, uvV] = topUvs[k]!;
        // Subtle directional cel lift on top perimeter edges.
        const edgeDir = new THREE.Vector3(px - cx, 0, pz - cz).normalize();
        const sunFacing = edgeDir.dot(sunDir);
        const rimFactor = 1 + sunFacing * 0.025;
        topRingIndices.push(
          pushVertex(b, px, py, pz, topNormal.x, topNormal.y, topNormal.z, uvU, uvV, scaleRgb(slabColor, rimFactor)),
        );
      }
      for (let k = 0; k < 8; k++) {
        const next = (k + 1) % 8;
        b.indices.push(centerIdx, topRingIndices[k]!, topRingIndices[next]!);
      }

      // Crisp faceted chamfer bevel skirt (8 quads).
      for (let k = 0; k < 8; k++) {
        const next = (k + 1) % 8;
        const pT0 = topPts[k]!;
        const pT1 = topPts[next]!;
        const pB0 = basePts[k]!;
        const pB1 = basePts[next]!;

        // Outward-and-upward bevel normal.
        const e1x = pT1[0] - pT0[0], e1y = pT1[1] - pT0[1], e1z = pT1[2] - pT0[2];
        const e2x = pB0[0] - pT0[0], e2y = pB0[1] - pT0[1], e2z = pB0[2] - pT0[2];
        // Cross(e2, e1) points outward and upward for our CCW ring.
        const nx = e2y * e1z - e2z * e1y;
        const ny = e2z * e1x - e2x * e1z;
        const nz = e2x * e1y - e2y * e1x;
        const nLen = Math.hypot(nx, ny, nz) || 1;
        const fnx = nx / nLen, fny = Math.max(0.25, ny / nLen), fnz = nz / nLen;
        const normLen = Math.hypot(fnx, fny, fnz) || 1;
        const unx = fnx / normLen, uny = fny / normLen, unz = fnz / normLen;

        const sunDot = unx * sunDir.x + uny * sunDir.y + unz * sunDir.z;
        const topBevelFactor = sunDot > 0.45 ? 1.04 : 0.89;
        const baseBevelFactor = sunDot > 0.45 ? 0.82 : 0.72;

        const topCol = scaleRgb(slabColor, topBevelFactor);
        const baseCol = scaleRgb(slabColor, baseBevelFactor);

        const i0 = pushVertex(b, pT0[0], pT0[1], pT0[2], unx, uny, unz, topUvs[k]![0], topUvs[k]![1], topCol);
        const i1 = pushVertex(b, pT1[0], pT1[1], pT1[2], unx, uny, unz, topUvs[next]![0], topUvs[next]![1], topCol);
        const i2 = pushVertex(b, pB0[0], pB0[1], pB0[2], unx, uny, unz, baseUvs[k]![0], baseUvs[k]![1], baseCol);
        const i3 = pushVertex(b, pB1[0], pB1[1], pB1[2], unx, uny, unz, baseUvs[next]![0], baseUvs[next]![1], baseCol);

        b.indices.push(i0, i2, i1, i1, i2, i3);
      }

      // Collect sparse outer-edge joint spots behind z = -2.2 for subtle stylized grass tufts.
      if ((isLeftEdge || isRightEdge) && cz < -2.2 && cz > -20 && hash2(row, col + 97) > 0.56) {
        const edgeLat = isLeftEdge ? u0 - 0.01 : u1 + 0.01;
        const [mx, mz] = mapPathPoint(t0, edgeLat);
        mossPositions.push([mx, floor + 0.005, mz]);
      }
    }

    tCursor = tBack;
    row++;
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  roadGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
  roadGeometry.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  roadGeometry.setIndex(b.indices);
  roadGeometry.computeBoundingBox();
  roadGeometry.computeBoundingSphere();
  return { roadGeometry, mossPositions };
}

function buildEdgeMossGeometry(spots: [number, number, number][]): THREE.BufferGeometry | undefined {
  if (!spots.length) return undefined;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  spots.forEach(([sx, sy, sz], spotIdx) => {
    const blades = 3 + (spotIdx % 2);
    for (let k = 0; k < blades; k++) {
      const angle = hash2(spotIdx, k * 7 + 3) * Math.PI * 2;
      const lean = 0.03 + hash2(spotIdx, k * 11 + 5) * 0.035;
      const height = 0.075 + hash2(spotIdx, k * 13 + 7) * 0.055;
      const halfWidth = 0.014 + hash2(spotIdx, k * 17 + 1) * 0.006;
      const ox = (hash2(spotIdx, k * 5 + 2) - 0.5) * 0.06;
      const oz = (hash2(spotIdx, k * 5 + 9) - 0.5) * 0.06;

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const baseIndex = positions.length / 3;
      const tone = 0.92 + hash2(spotIdx, k + 29) * 0.16;
      const rootCol = scaleRgb(MOSS_ROOT, tone);
      const midCol = scaleRgb(mixRgb(MOSS_ROOT, MOSS_TIP, 0.55), tone);
      const tipCol = scaleRgb(MOSS_TIP, tone);

      const pushBladeVert = (x: number, y: number, z: number, col: RGB) => {
        positions.push(sx + ox + x, sy + y, sz + oz + z);
        normals.push(0, 1, 0);
        colors.push(col[0], col[1], col[2]);
      };

      // 5-vertex curved grass ribbon blade.
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
  const { roadGeometry, mossPositions } = buildCourtyardRoadGeometry(floor, skin);
  const atlasBytes = createStoneAtlasBytes(256);

  // Komorebi daylight surface: limited-diffuse clamped lighting (NoColorSpace raw pigment multipliers).
  const komorebiMap = makeAtlasTexture(atlasBytes, 256, THREE.NoColorSpace);
  const komorebiMaterial = createKomorebiSurface();
  komorebiMaterial.color.setRGB(1, 1, 1);
  komorebiMaterial.map = komorebiMap;
  komorebiMaterial.vertexColors = true;
  komorebiMaterial.name = 'Courtyard stylized stone path (Komorebi)';
  komorebiMaterial.userData.komorebiSurface = true;
  komorebiMaterial.userData.komorebiPigment = true;

  // Standard PBR material for night courtyards (darker muted warm-slate stone) and non-Komorebi tones.
  const standardMap = makeAtlasTexture(atlasBytes, 256, THREE.SRGBColorSpace);
  const standardMaterial = new THREE.MeshStandardMaterial({
    color: night ? 0xa4a09a : 0xd4cbbd,
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

  // Subtle stylized grass blades tucked into outer stone joints (daylight only).
  let mossMesh: THREE.Mesh | undefined;
  let mossGeometry: THREE.BufferGeometry | undefined;
  let mossKomorebiMaterial: THREE.MeshPhongMaterial | undefined;
  let mossStandardMaterial: THREE.MeshStandardMaterial | undefined;

  if (!night) {
    mossGeometry = buildEdgeMossGeometry(mossPositions);
    if (mossGeometry) {
      mossKomorebiMaterial = createKomorebiSurface();
      mossKomorebiMaterial.color.setRGB(1, 1, 1);
      mossKomorebiMaterial.vertexColors = true;
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
      mossMesh.userData.toonSurface = { outline: false, shading: 'smooth' };
      mossMesh.userData.stonePath = true;
    }
  }

  let disposed = false;

  function setTone(tone: EnvironmentTone) {
    if (disposed) return;
    if (night) {
      mesh.material = standardMaterial;
      standardMaterial.color.setHex(tone === 'tiny-delivery' ? 0xafa9a0 : 0xa4a09a);
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
