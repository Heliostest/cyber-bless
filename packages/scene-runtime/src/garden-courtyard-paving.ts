import * as THREE from 'three';
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
 * 2×2 procedural paving texture atlas (luminance centered near 1.0 so vertex colors control calibrated L*):
 * - (0,0): Fine Shirakawa quartz gravel mineral grain + gentle rake micro-grooves
 * - (1,0): Hand-dressed stone / granite / bluestone slab wash with crisp sunlit/shaded bevel rim
 * - (0,1): Kiln-fired terracotta tile wash with subtle clay brush streaks and perimeter bevel
 * - (1,1): Soft painterly mortar / sandy earth bed wash
 */
function getPavingAtlasBytes(size = 256): Uint8Array<ArrayBuffer> {
  if (cachedPavingAtlasBytes && cachedPavingAtlasBytes.length === size * size * 4) {
    return cachedPavingAtlasBytes;
  }
  const bytes = new Uint8Array(size * size * 4);
  const half = size / 2;
  const smoothstep = (e0: number, e1: number, x: number) => {
    const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

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
        const n2 = hash2(Math.floor(px * 0.5), Math.floor(py * 0.5));
        const microGroove = Math.sin(v * Math.PI * 16 + Math.sin(u * Math.PI * 4) * 0.5) * 0.022;
        const sparkle = n1 > 0.91 ? 0.055 : n1 < 0.09 ? -0.055 : (n2 - 0.5) * 0.045;
        const shade = 0.985 + microGroove + sparkle;
        r = THREE.MathUtils.clamp(shade * 1.005, 0, 1);
        g = THREE.MathUtils.clamp(shade, 0, 1);
        b = THREE.MathUtils.clamp(shade * 0.992, 0, 1);
      } else if (quad === 1) {
        // Stylized hand-dressed bluestone / granite slab face with crisp bevel frame.
        const diag = u * 0.68 + (1 - v) * 0.64;
        const wave = Math.sin(u * 4.5 + 0.7) * 0.13 + Math.cos(v * 3.9 - 0.5) * 0.13;
        const field = diag * 0.54 + 0.28 + wave;
        let shade = 0.94;
        shade += 0.062 * smoothstep(0.42, 0.48, field);
        shade += 0.048 * smoothstep(0.71, 0.77, field);
        const borderMin = Math.min(u, 1 - u, v, 1 - v);
        const sunRim = Math.max(smoothstep(0.11, 0.04, u), smoothstep(0.11, 0.04, v)) * smoothstep(0.02, 0.048, borderMin);
        const shadowRim = Math.max(smoothstep(0.89, 0.96, u), smoothstep(0.89, 0.96, v)) * smoothstep(0.02, 0.05, borderMin);
        const seam = smoothstep(0.04, 0.014, borderMin);
        shade += sunRim * 0.055;
        shade -= shadowRim * 0.095;
        shade *= 1 - seam * 0.15;
        const grain = (hash2(Math.floor(px * 0.5), Math.floor(py * 0.5)) - 0.5) * 0.028;
        shade += grain;
        const warmShift = (shade - 0.97) * 0.16;
        r = THREE.MathUtils.clamp(shade + warmShift * 0.45, 0, 1);
        g = THREE.MathUtils.clamp(shade + warmShift * 0.15, 0, 1);
        b = THREE.MathUtils.clamp(shade - warmShift * 0.45, 0, 1);
      } else if (quad === 2) {
        // Kiln-fired terracotta tile: warm earthy brush streaks, subtle mineral kiln fleck, soft bevel.
        const brush = Math.sin(u * 6.2 + Math.sin(v * 3.4) * 0.9) * 0.032 + Math.cos(v * 5.0 - u * 2.1) * 0.026;
        const fleck = (hash2(px * 0.65, py * 0.65) - 0.5) * 0.045;
        let shade = 0.985 + brush + fleck;
        const borderMin = Math.min(u, 1 - u, v, 1 - v);
        const sunRim = Math.max(smoothstep(0.12, 0.045, u), smoothstep(0.12, 0.045, v)) * smoothstep(0.02, 0.05, borderMin);
        const shadowRim = Math.max(smoothstep(0.88, 0.96, u), smoothstep(0.88, 0.96, v)) * smoothstep(0.02, 0.05, borderMin);
        const seam = smoothstep(0.045, 0.015, borderMin);
        shade += sunRim * 0.058;
        shade -= shadowRim * 0.105;
        shade *= 1 - seam * 0.16;
        r = THREE.MathUtils.clamp(shade * 1.02, 0, 1);
        g = THREE.MathUtils.clamp(shade * 0.99, 0, 1);
        b = THREE.MathUtils.clamp(shade * 0.955, 0, 1);
      } else {
        // Recessed mortar / earthy moss bed wash.
        const wash =
          0.975 +
          0.042 * Math.sin(u * Math.PI * 2 + Math.cos(v * Math.PI * 2) * 0.7) +
          0.028 * Math.cos(v * Math.PI * 4 - u * Math.PI * 2) +
          (hash2(Math.floor(px * 0.5), Math.floor(py * 0.5)) - 0.5) * 0.04;
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
      const pebble = (hash2(Math.floor(px * 0.7), Math.floor(py * 0.7)) - 0.5) * 0.07;
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
 * Push a chamfered polygonal paving block (top face + 4 bevel skirts) aligned in local XZ space.
 * `quad` chooses atlas quadrant: 0=gravel, 1=stone slab, 2=terracotta tile, 3=mortar.
 */
function pushBeveledQuadBlock(
  b: GeometryBuilder,
  cornersXZ: readonly [number, number][], // 4 corners in CCW order viewed from +Y
  baseY: number,
  topY: number,
  bevelInset: number,
  quad: 0 | 1 | 2 | 3,
  color: RGB,
) {
  let cx = 0;
  let cz = 0;
  for (const [x, z] of cornersXZ) {
    cx += x;
    cz += z;
  }
  cx /= 4;
  cz /= 4;

  const qU0 = (quad % 2) * 0.5 + 0.02;
  const qV0 = Math.floor(quad / 2) * 0.5 + 0.02;
  const qSpan = 0.46;
  const cornerUvs: readonly [number, number][] = [
    [qU0, qV0],
    [qU0 + qSpan, qV0],
    [qU0 + qSpan, qV0 + qSpan],
    [qU0, qV0 + qSpan],
  ];

  const topPts: [number, number, number][] = [];
  const basePts: [number, number, number][] = [];
  for (let i = 0; i < 4; i++) {
    const [bx, bz] = cornersXZ[i]!;
    basePts.push([bx, baseY, bz]);
    const dx = bx - cx;
    const dz = bz - cz;
    const dist = Math.hypot(dx, dz) || 1;
    const shrink = Math.max(0.55, (dist - bevelInset) / dist);
    topPts.push([cx + dx * shrink, topY, cz + dz * shrink]);
  }

  // Top face (CCW from +Y: verify winding using cross product).
  const ax = topPts[1]![0] - topPts[0]![0];
  const az = topPts[1]![2] - topPts[0]![2];
  const bxv = topPts[2]![0] - topPts[0]![0];
  const bzv = topPts[2]![2] - topPts[0]![2];
  const crossY = az * bxv - ax * bzv; // > 0 means CCW in XZ looking down from +Y -> (0,1,2) faces +Y
  const orderedTop = crossY >= 0 ? topPts : [topPts[0]!, topPts[3]!, topPts[2]!, topPts[1]!];
  const orderedBase = crossY >= 0 ? basePts : [basePts[0]!, basePts[3]!, basePts[2]!, basePts[1]!];
  const orderedUvs = crossY >= 0 ? cornerUvs : [cornerUvs[0]!, cornerUvs[3]!, cornerUvs[2]!, cornerUvs[1]!];

  const tIdx: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p = orderedTop[i]!;
    const uv = orderedUvs[i]!;
    const dirX = p[0] - cx;
    const dirZ = p[2] - cz;
    const len = Math.hypot(dirX, dirZ) || 1;
    const sunAlign = (dirX / len) * SUN_DIR.x + (dirZ / len) * SUN_DIR.z;
    const lift = 1 + sunAlign * 0.032;
    tIdx.push(pushVertex(b, p[0], p[1], p[2], 0, 1, 0, uv[0], uv[1], scaleRgb(color, lift)));
  }
  b.indices.push(tIdx[0]!, tIdx[1]!, tIdx[2]!, tIdx[0]!, tIdx[2]!, tIdx[3]!);

  // 4 beveled skirt quads.
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    const t0 = orderedTop[i]!;
    const t1 = orderedTop[next]!;
    const b0 = orderedBase[i]!;
    const b1 = orderedBase[next]!;

    const e1x = t1[0] - t0[0], e1y = t1[1] - t0[1], e1z = t1[2] - t0[2];
    const e2x = b0[0] - t0[0], e2y = b0[1] - t0[1], e2z = b0[2] - t0[2];
    const nx = e2y * e1z - e2z * e1y;
    const ny = e2z * e1x - e2x * e1z;
    const nz = e2x * e1y - e2y * e1x;
    const len = Math.hypot(nx, ny, nz) || 1;
    const unx = nx / len;
    const uny = Math.max(0.28, ny / len);
    const unz = nz / len;
    const normLen = Math.hypot(unx, uny, unz) || 1;
    const fx = unx / normLen, fy = uny / normLen, fz = unz / normLen;

    const sunDot = fx * SUN_DIR.x + fy * SUN_DIR.y + fz * SUN_DIR.z;
    const topFactor = sunDot > 0.42 ? 1.03 : 0.87;
    const baseFactor = sunDot > 0.42 ? 0.78 : 0.68;

    const i0 = pushVertex(b, t0[0], t0[1], t0[2], fx, fy, fz, orderedUvs[i]![0], orderedUvs[i]![1], scaleRgb(color, topFactor));
    const i1 = pushVertex(b, t1[0], t1[1], t1[2], fx, fy, fz, orderedUvs[next]![0], orderedUvs[next]![1], scaleRgb(color, topFactor));
    const i2 = pushVertex(b, b0[0], b0[1], b0[2], fx, fy, fz, orderedUvs[i]![0], orderedUvs[i]![1], scaleRgb(color, baseFactor));
    const i3 = pushVertex(b, b1[0], b1[1], b1[2], fx, fy, fz, orderedUvs[next]![0], orderedUvs[next]![1], scaleRgb(color, baseFactor));
    b.indices.push(i0, i2, i1, i1, i2, i3);
  }
}

/** Add an elliptical mortar/earth base disc slightly below y = 0 so beveled stones sit bedded in mortar. */
function pushEllipticalBed(
  b: GeometryBuilder,
  rx: number,
  rz: number,
  y: number,
  centerColor: RGB,
  edgeColor: RGB,
  radialSegments = 44,
  rings = 5,
) {
  const cIdx = pushVertex(b, 0, y, 0, 0, 1, 0, 0.75, 0.75, centerColor);
  const ringStarts: number[] = [];
  for (let r = 1; r <= rings; r++) {
    const frac = r / rings;
    ringStarts.push(b.positions.length / 3);
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const x = Math.cos(a) * rx * frac;
      const z = Math.sin(a) * rz * frac;
      const edgeT = THREE.MathUtils.smoothstep(frac, 0.45, 1.0);
      const jitter = 0.95 + hash2(r * 7, s * 3) * 0.1;
      const col = scaleRgb(mixRgb(centerColor, edgeColor, edgeT), jitter);
      const u = 0.54 + (0.5 + 0.42 * Math.cos(a) * frac) * 0.42;
      const v = 0.54 + (0.5 + 0.42 * Math.sin(a) * frac) * 0.42;
      pushVertex(b, x, y, z, 0, 1, 0, u, v, col);
    }
  }
  const firstRing = ringStarts[0]!;
  for (let s = 0; s < radialSegments; s++) {
    const next = (s + 1) % radialSegments;
    // In XZ with angle increasing from +X toward +Z (CW from +Y), (center, next, cur) faces +Y.
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

/** Add a ring of chamfered perimeter curb blocks (granite, gray-brick, limestone, or fieldstone). */
function pushPerimeterCurbRing(
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
) {
  const step = (Math.PI * 2) / segments;
  for (let i = 0; i < segments; i++) {
    const a0 = i * step + step * gapAngleFrac * 0.5;
    const a1 = (i + 1) * step - step * gapAngleFrac * 0.5;
    const radJitter = (hash2(i + seedOffset, 13) - 0.5) * 0.025;
    const oRx = outerRx + radJitter;
    const oRz = outerRz + radJitter * 0.85;
    const hJitter = (hash2(i + seedOffset, 29) - 0.5) * 0.004;
    const corners: [number, number][] = [
      [Math.cos(a0) * innerRx, Math.sin(a0) * innerRz],
      [Math.cos(a0) * oRx, Math.sin(a0) * oRz],
      [Math.cos(a1) * oRx, Math.sin(a1) * oRz],
      [Math.cos(a1) * innerRx, Math.sin(a1) * innerRz],
    ];
    const pal = palette[(i + Math.floor(hash2(i + seedOffset, 41) * palette.length)) % palette.length]!;
    const col = scaleRgb(pal, 0.96 + hash2(i + seedOffset, 53) * 0.08);
    pushBeveledQuadBlock(b, corners, baseY, topY + hJitter, bevelInset, quad, col);
  }
}

/** Build asymmetric, organic multi-lobe moss patches & river pebbles tucked naturally along the outer curb. */
function buildOuterMossGeometry(
  rx: number,
  rz: number,
  skin: CourtyardSkinId,
  seedOffset: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Harmonized with Cyber Bless Komorebi meadow greens so moss blends organically into the lawn.
  const mossDark = parseHex(
    skin === 'japanese-karesansui' ? '#4f7637' : skin === 'warm-terracotta-arch' ? '#627c44' : '#537939',
  );
  const mossLight = parseHex(
    skin === 'japanese-karesansui' ? '#82a74f' : skin === 'warm-terracotta-arch' ? '#92a65a' : '#84a652',
  );
  const pebbleTone = parseHex(skin === 'chinese-jiangnan' ? '#6e7579' : '#7b766d');

  // 7 natural asymmetric cluster zones around the courtyard edge (instead of uniform evenly-spaced buttons).
  const clusterAngles = [0.22, 1.08, 1.96, 2.74, 3.62, 4.58, 5.52];
  clusterAngles.forEach((baseA, clusterIdx) => {
    const lobes = skin === 'warm-terracotta-arch' ? 2 : 3;
    for (let l = 0; l < lobes; l++) {
      const a = baseA + (l - 1) * 0.11 + (hash2(clusterIdx * 7 + l + seedOffset, 3) - 0.5) * 0.08;
      const radialPush = 1.005 + hash2(clusterIdx * 11 + l + seedOffset, 7) * 0.032;
      const mx = Math.cos(a) * rx * radialPush;
      const mz = Math.sin(a) * rz * radialPush;
      const radX = (l === 1 ? 0.17 : 0.11) + hash2(clusterIdx * 5 + l + seedOffset, 11) * 0.06;
      const radZ = radX * (0.72 + hash2(clusterIdx + l + seedOffset, 13) * 0.36);
      const height = (skin === 'japanese-karesansui' ? 0.026 : 0.019) + hash2(clusterIdx + l + seedOffset, 17) * 0.012;
      const segs = 10;

      const centerIdx = positions.length / 3;
      const toneShift = 0.94 + hash2(clusterIdx * 3 + l + seedOffset, 23) * 0.12;
      const topCol = scaleRgb(mossLight, toneShift);
      const rimCol = scaleRgb(mossDark, toneShift);
      positions.push(mx, height, mz);
      normals.push(0, 1, 0);
      colors.push(topCol[0], topCol[1], topCol[2]);

      const ringStart = positions.length / 3;
      for (let s = 0; s < segs; s++) {
        const sa = (s / segs) * Math.PI * 2;
        const wobble = 0.86 + hash2(clusterIdx * 17 + l * 7 + s, 31) * 0.28;
        const px = mx + Math.cos(sa) * radX * wobble;
        const pz = mz + Math.sin(sa) * radZ * wobble;
        positions.push(px, -0.008, pz);
        normals.push(Math.cos(sa) * 0.32, 0.95, Math.sin(sa) * 0.32);
        colors.push(rimCol[0], rimCol[1], rimCol[2]);
      }
      for (let s = 0; s < segs; s++) {
        const next = (s + 1) % segs;
        indices.push(centerIdx, ringStart + next, ringStart + s);
      }

      // 2 delicate grass/moss blades rising softly from each cushion.
      for (let k = 0; k < 2; k++) {
        const ba = hash2(clusterIdx * 5 + l, k * 7 + 5) * Math.PI * 2;
        const lean = 0.022 + hash2(clusterIdx + l, k * 11 + 9) * 0.025;
        const bh = 0.048 + hash2(clusterIdx + l, k * 13 + 3) * 0.036;
        const hw = 0.011;
        const ox = (hash2(clusterIdx + l, k * 5 + 1) - 0.5) * radX * 0.7;
        const oz = (hash2(clusterIdx + l, k * 5 + 7) - 0.5) * radZ * 0.7;
        const cos = Math.cos(ba);
        const sin = Math.sin(ba);
        const baseIndex = positions.length / 3;
        const midCol = mixRgb(rimCol, topCol, 0.55);
        const pushV = (x: number, y: number, z: number, c: RGB) => {
          positions.push(mx + ox + x, y, mz + oz + z);
          normals.push(0, 1, 0);
          colors.push(c[0], c[1], c[2]);
        };
        pushV(-sin * hw, -0.002, cos * hw, rimCol);
        pushV(sin * hw, -0.002, -cos * hw, rimCol);
        pushV(cos * lean * 0.45 - sin * hw * 0.6, bh * 0.55, sin * lean * 0.45 + cos * hw * 0.6, midCol);
        pushV(cos * lean * 0.45 + sin * hw * 0.6, bh * 0.55, sin * lean * 0.45 - cos * hw * 0.6, midCol);
        pushV(cos * lean, bh, sin * lean, topCol);
        indices.push(
          baseIndex, baseIndex + 1, baseIndex + 2,
          baseIndex + 1, baseIndex + 3, baseIndex + 2,
          baseIndex + 2, baseIndex + 3, baseIndex + 4,
        );
      }
    }

    // Companion smooth dark river pebbles nestled beside alternating moss clusters.
    if (skin !== 'warm-terracotta-arch') {
      for (let p = 0; p < 2; p++) {
        const pa = baseA + (p === 0 ? -0.17 : 0.18);
        const px0 = Math.cos(pa) * (rx * (1.008 + p * 0.016));
        const pz0 = Math.sin(pa) * (rz * (1.008 + p * 0.016));
        const pRad = 0.055 + hash2(clusterIdx * 3 + p + seedOffset, 47) * 0.04;
        const pH = 0.024 + hash2(clusterIdx + p + seedOffset, 59) * 0.016;
        const pColTop = scaleRgb(pebbleTone, 1.12);
        const pColBase = scaleRgb(pebbleTone, 0.78);
        const pCenter = positions.length / 3;
        positions.push(px0, pH, pz0);
        normals.push(0, 1, 0);
        colors.push(pColTop[0], pColTop[1], pColTop[2]);
        const pRing = positions.length / 3;
        for (let s = 0; s < 8; s++) {
          const sa = (s / 8) * Math.PI * 2;
          positions.push(px0 + Math.cos(sa) * pRad, -0.006, pz0 + Math.sin(sa) * pRad * 0.76);
          normals.push(Math.cos(sa) * 0.45, 0.89, Math.sin(sa) * 0.45);
          colors.push(pColBase[0], pColBase[1], pColBase[2]);
        }
        for (let s = 0; s < 8; s++) {
          const next = (s + 1) % 8;
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

/**
 * 1) Japanese Karesansui Paving:
 * Smooth welded Shirakawa-suna raked white-gravel heightfield (concentric central ripples
 * blending into flowing parallel wave ridges) framed by 28 chamfered cut-granite curb blocks
 * and flush rear-right stepping stones leading toward the courtyard garden gate.
 */
function buildJapaneseKaresansuiPad(): THREE.BufferGeometry {
  const b = createBuilder();
  const innerRx = 2.66;
  const innerRz = 2.02;
  const rings = 34;
  const segs = 54;

  const gravelTrough = parseHex('#a29b8d');
  const gravelMid = parseHex('#cec8ba');
  const gravelCrest = parseHex('#e7e2d6');
  const gravelRimShadow = parseHex('#948e81');

  const sampleRakedField = (x: number, z: number, radialFrac: number): { y: number; wave01: number } => {
    const r = Math.hypot(x * 0.88, z * 1.12);
    // Concentric meditative rings near the focal ritual stand; flowing parallel waves outside.
    const concentric = Math.cos(r * 23.0);
    const parallel = Math.sin(z * 23.5 + Math.sin(x * 1.25) * 0.75);
    const blend = THREE.MathUtils.smoothstep(radialFrac, 0.34, 0.64);
    const raw = THREE.MathUtils.lerp(concentric, parallel, blend);
    // Flatten slightly at center (r < 0.35) and right against the granite curb so stones meet cleanly.
    const amp = (0.40 + 0.60 * THREE.MathUtils.smoothstep(r, 0.14, 0.52)) * (1 - THREE.MathUtils.smoothstep(radialFrac, 0.90, 1.0) * 0.72);
    const wave = raw * amp;
    return { y: wave * 0.0034 - 0.0005, wave01: 0.5 + 0.5 * wave };
  };

  // Build smooth welded heightfield in polar elliptical rings.
  const eps = 0.025;
  const sampleNormal = (x: number, z: number, frac: number): [number, number, number] => {
    const hL = sampleRakedField(x - eps, z, frac).y;
    const hR = sampleRakedField(x + eps, z, frac).y;
    const hD = sampleRakedField(x, z - eps, frac).y;
    const hU = sampleRakedField(x, z + eps, frac).y;
    // Exaggerate slope slightly so Komorebi key sun paints crisp Zen rake highlights.
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
      const x = Math.cos(a) * innerRx * frac;
      const z = Math.sin(a) * innerRz * frac;
      const { y, wave01 } = sampleRakedField(x, z, frac);
      const [nx, ny, nz] = sampleNormal(x, z, frac);
      let col = wave01 < 0.5
        ? mixRgb(gravelTrough, gravelMid, wave01 * 2)
        : mixRgb(gravelMid, gravelCrest, (wave01 - 0.5) * 2);
      // Soft ambient occlusion right beside the granite curb rim.
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

  // Two flat stepping stones (飛び石) gently embedded toward the rear-right garden gate approach.
  const steppingStones: readonly [number, number, number, number, number][] = [
    [0.98, -1.28, 0.46, 0.30, 0.16],
    [1.46, -1.62, 0.42, 0.28, -0.22],
  ];
  const stepColor = parseHex('#96938b');
  for (let i = 0; i < steppingStones.length; i++) {
    const [sx, sz, sw, sd, rot] = steppingStones[i]!;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const hw = sw * 0.5;
    const hd = sd * 0.5;
    const local: readonly [number, number][] = [
      [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd],
    ];
    const world: [number, number][] = local.map(([lx, lz]) => [sx + lx * c - lz * s, sz + lx * s + lz * c]);
    pushBeveledQuadBlock(b, world, -0.008, 0.0045, 0.035, 1, scaleRgb(stepColor, 0.96 + i * 0.05));
  }

  // 28 chamfered Kyoto cut-granite curb blocks ringing the gravel garden.
  const graniteCurbPalette: readonly RGB[] = [
    '#a39f97',
    '#9a9790',
    '#aeaaa0',
    '#939089',
    '#a8a49b',
  ].map(parseHex);
  pushPerimeterCurbRing(
    b,
    innerRx - 0.03,
    innerRz - 0.03,
    innerRx + 0.20,
    innerRz + 0.19,
    28,
    -0.012,
    0.018,
    0.055,
    0.022,
    1,
    graniteCurbPalette,
    101,
  );

  return finalizeGeometry(b);
}

/**
 * 2) Chinese Jiangnan Paving:
 * Coursed beveled bluestone flagstones (青石板) bedded in recessed mortar, framed by an inner
 * dark-slate trim fillet and a 44-brick Suzhou gray-brick radial header curb (灰砖收边).
 */
function buildChineseJiangnanPad(): THREE.BufferGeometry {
  const b = createBuilder();
  const innerRx = 2.60;
  const innerRz = 1.96;

  pushEllipticalBed(b, innerRx + 0.16, innerRz + 0.14, -0.007, parseHex('#6d706c'), parseHex('#5f6c54'));

  const bluestonePalette: readonly RGB[] = [
    '#9da5a8',
    '#939c9f',
    '#a7adaa',
    '#8c9598',
    '#adb2ae',
    '#97a0a2',
  ].map(parseHex);

  const rowDepth = 0.56;
  const seam = 0.032;
  let rowIdx = 0;
  for (let z0 = -innerRz; z0 < innerRz - 0.12; z0 += rowDepth) {
    const z1 = Math.min(innerRz, z0 + rowDepth);
    const zMid = (z0 + z1) * 0.5;
    const zRatio = zMid / innerRz;
    if (Math.abs(zRatio) >= 0.98) continue;
    const spanX = innerRx * Math.sqrt(Math.max(0, 1 - zRatio * zRatio));
    const offset = (rowIdx % 2) * 0.34;
    const colW = 0.68;

    let colIdx = 0;
    for (let x0 = -spanX - offset; x0 < spanX; x0 += colW) {
      const rawX0 = Math.max(-spanX, x0) + seam * 0.5;
      const rawX1 = Math.min(spanX, x0 + colW) - seam * 0.5;
      const rawZ0 = z0 + seam * 0.5;
      const rawZ1 = z1 - seam * 0.5;
      if (rawX1 - rawX0 < 0.20 || rawZ1 - rawZ0 < 0.18) {
        colIdx++;
        continue;
      }

      // Clamp corners smoothly inside the elliptical inner ring so slabs never poke through the brick curb.
      const clampCorner = (px: number, pz: number): [number, number] => {
        const er = Math.hypot(px / (innerRx - 0.02), pz / (innerRz - 0.02));
        if (er > 1) return [px / er, pz / er];
        return [px, pz];
      };
      const corners: [number, number][] = [
        clampCorner(rawX0, rawZ0),
        clampCorner(rawX1, rawZ0),
        clampCorner(rawX1, rawZ1),
        clampCorner(rawX0, rawZ1),
      ];
      // Skip degenerate edge slivers/wedges (check all 4 side lengths and quad area).
      const isCleanQuad = (pts: readonly [number, number][]) => {
        let minSide = Infinity;
        for (let k = 0; k < 4; k++) {
          const a = pts[k]!, c = pts[(k + 1) % 4]!;
          minSide = Math.min(minSide, Math.hypot(c[0] - a[0], c[1] - a[1]));
        }
        const area = 0.5 * Math.abs(
          (pts[1]![0] - pts[0]![0]) * (pts[2]![1] - pts[0]![1]) -
          (pts[2]![0] - pts[0]![0]) * (pts[1]![1] - pts[0]![1]) +
          (pts[2]![0] - pts[0]![0]) * (pts[3]![1] - pts[0]![1]) -
          (pts[3]![0] - pts[0]![0]) * (pts[2]![1] - pts[0]![1]),
        );
        return minSide >= 0.14 && area >= 0.045;
      };
      if (!isCleanQuad(corners)) {
        colIdx++;
        continue;
      }

      const pal = bluestonePalette[(rowIdx * 3 + colIdx + Math.floor(hash2(rowIdx, colIdx + 17) * 3)) % bluestonePalette.length]!;
      const edgeDist = Math.hypot(((rawX0 + rawX1) * 0.5) / innerRx, zMid / innerRz);
      const col = scaleRgb(pal, (0.97 + hash2(rowIdx * 7, colIdx * 5) * 0.06) * (1 - THREE.MathUtils.smoothstep(edgeDist, 0.76, 1.0) * 0.07));
      const topY = -0.001 + hash2(rowIdx * 11, colIdx * 13) * 0.0028;
      pushBeveledQuadBlock(b, corners, -0.010, topY, 0.020, 1, col);
      colIdx++;
    }
    rowIdx++;
  }

  // Suzhou radial gray-brick header curb (灰砖收边) + inner slate fillet.
  const grayBrickPalette: readonly RGB[] = [
    '#6b7176',
    '#747b80',
    '#62686d',
    '#7c8286',
  ].map(parseHex);
  pushPerimeterCurbRing(
    b,
    innerRx - 0.08,
    innerRz - 0.08,
    innerRx + 0.24,
    innerRz + 0.22,
    44,
    -0.012,
    0.015,
    0.085,
    0.016,
    1,
    grayBrickPalette,
    203,
  );

  return finalizeGeometry(b);
}

/**
 * 3) Warm Terracotta Arch Courtyard Paving:
 * Kiln-fired Saltillo terracotta tiles (红陶砖) with recessed sandy lime-mortar joints,
 * alternating glazed cobalt/albero-ochre diamond corner accents, and a dressed warm-limestone curb.
 */
function buildWarmTerracottaPad(): THREE.BufferGeometry {
  const b = createBuilder();
  const innerRx = 2.62;
  const innerRz = 1.98;

  pushEllipticalBed(b, innerRx + 0.16, innerRz + 0.14, -0.007, parseHex('#9a8970'), parseHex('#847d5e'));

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
  const seam = 0.030;
  const halfStep = tileSize * 0.5;
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
        const er = Math.hypot(px / (innerRx - 0.02), pz / (innerRz - 0.02));
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
        const a = corners[k]!, c = corners[(k + 1) % 4]!;
        minSide = Math.min(minSide, Math.hypot(c[0] - a[0], c[1] - a[1]));
      }
      if (minSide < 0.14) {
        colIdx++;
        continue;
      }

      const pal = terracottaPalette[(rowIdx * 5 + colIdx * 3 + Math.floor(hash2(rowIdx, colIdx + 7) * 3)) % terracottaPalette.length]!;
      const col = scaleRgb(pal, 0.95 + hash2(rowIdx * 13, colIdx * 7) * 0.10);
      const topY = -0.001 + hash2(rowIdx * 3, colIdx * 11) * 0.0028;
      pushBeveledQuadBlock(b, corners, -0.010, topY, 0.018, 2, col);

      // Subtle glazed Andalusian/Mediterranean corner diamond tile at alternating tile intersections.
      if ((rowIdx + colIdx) % 2 === 0 && rawX1 - rawX0 > 0.36 && rawZ1 - rawZ0 > 0.36) {
        const ix = x0 + tileSize;
        const iz = z0 + tileSize;
        const er = Math.hypot(ix / (innerRx - 0.18), iz / (innerRz - 0.18));
        if (er < 0.92 && Math.hypot(ix, iz) > 0.65) {
          const dr = 0.068;
          const diamond: [number, number][] = [
            [ix, iz - dr],
            [ix + dr, iz],
            [ix, iz + dr],
            [ix - dr, iz],
          ];
          const inlayCol = (rowIdx % 2 === 0) ? cobaltInlay : ochreInlay;
          pushBeveledQuadBlock(b, diamond, -0.008, 0.0024, 0.010, 1, inlayCol);
        }
      }
      colIdx++;
    }
    rowIdx++;
  }
  void halfStep;

  // Warm dressed Mediterranean limestone border curb.
  const limestoneCurbPalette: readonly RGB[] = [
    '#d6c9b2',
    '#ccbda5',
    '#dcd0ba',
    '#c4b49b',
    '#d1c4ad',
  ].map(parseHex);
  pushPerimeterCurbRing(
    b,
    innerRx - 0.08,
    innerRz - 0.08,
    innerRx + 0.22,
    innerRz + 0.20,
    30,
    -0.012,
    0.017,
    0.055,
    0.022,
    1,
    limestoneCurbPalette,
    307,
  );

  return finalizeGeometry(b);
}

/**
 * 4) Neutral Natural Courtyard Paving (`skin === 'none'`, non-spring garden):
 * Replaces the bare beige circle with serene, non-culturally-bound sandstone flagstones bedded
 * in warm sandy earth and edged with weathered natural fieldstone curbing.
 */
function buildNeutralGardenCourtyardPad(): THREE.BufferGeometry {
  const b = createBuilder();
  const innerRx = 2.62;
  const innerRz = 1.98;

  pushEllipticalBed(b, innerRx + 0.16, innerRz + 0.14, -0.007, parseHex('#877d69'), parseHex('#747c58'));

  const naturalStonePalette: readonly RGB[] = [
    '#c7baa2',
    '#c2b499',
    '#bdb29d',
    '#b8a990',
    '#b4a894',
  ].map(parseHex);

  const rowDepth = 0.62;
  const seam = 0.042;
  let rowIdx = 0;

  for (let z0 = -innerRz; z0 < innerRz - 0.14; z0 += rowDepth) {
    const z1 = Math.min(innerRz, z0 + rowDepth);
    const zMid = (z0 + z1) * 0.5;
    const zRatio = zMid / innerRz;
    if (Math.abs(zRatio) >= 0.98) continue;
    const spanX = innerRx * Math.sqrt(Math.max(0, 1 - zRatio * zRatio));
    const offset = (rowIdx % 2) * 0.36;
    const colW = 0.74;

    let colIdx = 0;
    for (let x0 = -spanX - offset; x0 < spanX; x0 += colW) {
      const rawX0 = Math.max(-spanX, x0) + seam * 0.5;
      const rawX1 = Math.min(spanX, x0 + colW) - seam * 0.5;
      const rawZ0 = z0 + seam * 0.5;
      const rawZ1 = z1 - seam * 0.5;
      if (rawX1 - rawX0 < 0.22 || rawZ1 - rawZ0 < 0.18) {
        colIdx++;
        continue;
      }

      const clampCorner = (px: number, pz: number): [number, number] => {
        const er = Math.hypot(px / (innerRx - 0.02), pz / (innerRz - 0.02));
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

      const pal = naturalStonePalette[(rowIdx * 3 + colIdx + Math.floor(hash2(rowIdx, colIdx + 5) * 3)) % naturalStonePalette.length]!;
      const col = scaleRgb(pal, 0.96 + hash2(rowIdx * 5, colIdx * 9) * 0.08);
      const topY = -0.001 + hash2(rowIdx * 7, colIdx * 3) * 0.0028;
      pushBeveledQuadBlock(b, corners, -0.010, topY, 0.024, 1, col);
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
  pushPerimeterCurbRing(
    b,
    innerRx - 0.03,
    innerRz - 0.03,
    innerRx + 0.20,
    innerRz + 0.19,
    28,
    -0.012,
    0.015,
    0.065,
    0.024,
    1,
    fieldstoneCurbPalette,
    409,
  );

  return finalizeGeometry(b);
}

/**
 * Spring ring (`celtic-folk-spring`): preserves the exact r = 1.36 center hole and Komorebi
 * backdrop sand calibration on `garden-path`, while adding a weathered stone border curb + moss.
 */
function buildSpringRingPadGeometry(): {
  padGeometry: THREE.BufferGeometry;
  borderGeometry: THREE.BufferGeometry;
} {
  const rx = 2.86;
  const rz = 2.18;
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 1.36, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const padGeometry = new THREE.ShapeGeometry(shape, 48);
  // Rotate into XZ plane so local y = 0 matches all other garden pads cleanly.
  padGeometry.rotateX(-Math.PI / 2);

  // Normalize UVs to [0, 1] across the ellipse and add subtle radial stone/earth vertex coloring.
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
    const shade = 1.0 - innerRim * 0.08 - outerRim * 0.09 + (hash2(x * 4, z * 4) - 0.5) * 0.04;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade * 0.98;
  }
  padGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  padGeometry.computeBoundingBox();
  padGeometry.computeBoundingSphere();

  const curbBuilder = createBuilder();
  const curbPalette: readonly RGB[] = ['#aba393', '#9d9788', '#b5ad9d', '#949082'].map(parseHex);
  pushPerimeterCurbRing(curbBuilder, rx - 0.14, rz - 0.12, rx + 0.12, rz + 0.10, 28, -0.012, 0.016, 0.065, 0.022, 1, curbPalette, 503);
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

    // Keep backdropRole='sand' on the spring ring so createKomorebiBackdrop preserves exact
    // calibrated sand behavior and restores PBR cleanly outside Komorebi.
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

    // Separate weathered granite curb ringing the outer spring pad.
    const borderKomorebiMap = makeTexture(atlasBytes, 256, THREE.NoColorSpace, 'garden-paving-atlas-komorebi');
    const borderStdMap = makeTexture(atlasBytes, 256, THREE.SRGBColorSpace, 'garden-paving-atlas-standard');
    ownedTextures.push(borderKomorebiMap, borderStdMap);

    komorebiBorderMaterial = createKomorebiSurface();
    komorebiBorderMaterial.color.setRGB(1, 1, 1);
    komorebiBorderMaterial.map = borderKomorebiMap;
    komorebiBorderMaterial.vertexColors = true;
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

  // Outer perimeter moss cushions & river pebbles (daylight only).
  if (!night) {
    const mossGeometry = buildOuterMossGeometry(2.86, 2.20, skin, skin.length * 19 + (spring ? 7 : 0));
    ownedGeometries.push(mossGeometry);

    mossKomorebiMaterial = createKomorebiSurface();
    mossKomorebiMaterial.color.setRGB(1, 1, 1);
    mossKomorebiMaterial.vertexColors = true;
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
