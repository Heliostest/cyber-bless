import * as THREE from 'three';

export type BladeLeafTip = 'acuminate' | 'dripTip' | 'obtuse' | 'spiny';

export interface BladeLeafOptions {
  /** Blade length from petiole `(0,0,0)` along `+z` (meters). Default `0.20`. */
  length?: number;
  /** Maximum width across `±x` (meters). Default `0.09`. */
  maxWidth?: number;
  /** Normalized longitudinal position (`0.15..0.80`) of maximum width. Default `0.42`. */
  widthStation?: number;
  /** Blade apex / margin silhouette. Default `'acuminate'`. */
  tip?: BladeLeafTip;
  /** Midrib V-fold half-angle in degrees (`0..45`, typical `10..16`). Default `13`. */
  midribFold?: number;
  /** Gentle longitudinal arch height along `+y` (meters, negative curves upward). Default `length * 0.09`. */
  arch?: number;
  /** Additional tip droop toward `-y` (meters). Default `tip === 'dripTip' ? length * 0.14 : length * 0.04`. */
  tipDroop?: number;
  /** Closed shell thickness at blade center (meters, typical `0.002..0.004`). Default `0.0028`. */
  thickness?: number;
  /** Even subdivisions across blade width (`2..8`, ensuring an exact `u = 0.5` midrib column). Default `2`. */
  widthSegments?: number;
  /** Subdivisions along blade length (`3..16`). Defaults: `5` (acuminate/obtuse → 68 tris), `6` (dripTip/spiny → 80 tris). */
  lengthSegments?: number;
}

export type CuppedPetalTip = 'rounded' | 'pointed' | 'notched';

export interface CuppedPetalOptions {
  /** Petal length from throat `(0,0,0)` along `+y` (meters). Default `0.12`. */
  length?: number;
  /** Maximum blade width across `±x` (meters). Default `0.075`. */
  maxWidth?: number;
  /** Throat width as a fraction of `maxWidth` at `v = 0` (`0.08..0.7`). Default `0.24`. */
  throatRatio?: number;
  /** Inward cupping depth (meters; positive cups convex back toward `+z`, concave face toward `-z`). Default `0.016`. */
  cupDepth?: number;
  /** Outward tip flare along `+z` for `v > 0.55` (meters). Default `0.012`. */
  tipCurl?: number;
  /** Tip silhouette (`'rounded'`, `'pointed'`, or `'notched'` for peach/cherry blossoms). Default `'rounded'`. */
  tipShape?: CuppedPetalTip;
  /** Closed shell thickness (meters). Default `0.0022`. */
  thickness?: number;
  /** Subdivisions across width (`2..8`). Default `4`. */
  widthSegments?: number;
  /** Subdivisions along length (`3..12`). Default `3` (with `widthSegments: 4` → 76 tris). */
  lengthSegments?: number;
}

export interface SpinyHollyLeafOptions {
  /** Total leaf length along `+z` (meters). Default `0.34`. */
  length?: number;
  /** Max width across opposing spine tips along `±x` (meters). Default `0.19`. */
  maxWidth?: number;
  /** Pairs of alternating lateral marginal spines (`2..4`). Default `3`. */
  spinePairs?: number;
  /** Vertical alternating up/down pitch at spine tips (meters). Default `0.006`. */
  spinePitch?: number;
  /** Midrib V-fold angle in degrees (`0..30`). Default `12`. */
  midribFold?: number;
  /** Gentle longitudinal arch along `+y` (meters). Default `0.018`. */
  arch?: number;
  /** Closed thin-shell thickness (meters). Default `0.0035`. */
  thickness?: number;
}

export interface FoldedBananaLeafFanOptions {
  /** Base fan width across `±x` (meters). Default `0.30`. */
  width?: number;
  /** Vertical crest height along `+y` (meters). Default `0.32`. */
  height?: number;
  /** Forward central fold-ridge depth along `+z` (meters). Default `0.15`. */
  ridgeDepth?: number;
  /** Organic outward belly curve on each folded cheek (meters). Default `0.024`. */
  bellyCurve?: number;
  /** Closed shell thickness (meters). Default `0.0032`. */
  thickness?: number;
  /** Even subdivisions across width (`2..8`). Default `4`. */
  widthSegments?: number;
  /** Subdivisions along height (`3..10`). Default `4` (96 tris). */
  heightSegments?: number;
}

export interface WheatKernelOptions {
  /** Kernel length centered on `y ∈ [-length/2, +length/2]` (meters). Default `0.11`. */
  length?: number;
  /** Equatorial radius (meters). Default `0.026`. */
  radius?: number;
  /** Relative depth of the ventral wheat crease (`0..0.45`). Default `0.24`. */
  creaseDepth?: number;
  /** Circumferential segments (`6..20`). Default `8`. */
  radialSegments?: number;
  /** Longitudinal segments (`3..12`). Default `5` (64 tris). */
  heightSegments?: number;
}

export interface FlowerBudOptions {
  /** Bud length centered on `y ∈ [-length/2, +length/2]` (meters). Default `0.095`. */
  length?: number;
  /** Maximum bud radius (meters). Default `0.024`. */
  radius?: number;
  /** Subtle wrapped-petal flutes around circumference (`0` for smooth catkin, `3` for jasmine bud). Default `3`. */
  lobeCount?: number;
  /** Relative radial flute depth (`0..0.22`). Default `0.07`. */
  lobeDepth?: number;
  /** Tip pointiness (`0.3` rounded catkin .. `1.4` pointed jasmine bud). Default `0.78`. */
  tipSharpness?: number;
  /** Circumferential segments (`6..24`). Default `10`. */
  radialSegments?: number;
  /** Longitudinal segments (`4..12`). Default `5` (80 tris). */
  heightSegments?: number;
}

export interface SmoothSolidOptions {
  /** Compute area-weighted smooth normals across shared welded positions (default `true`). */
  smooth?: boolean;
  /** Optional sharp-edge threshold in radians; faces meeting above this angle do not blend normals. */
  creaseAngle?: number;
  /** Minimum triangle area retained (default `1e-12`). */
  areaEpsilon?: number;
  /** Spatial welding precision multiplier (default `1e6`). */
  weldPrecision?: number;
  /** Flip triangle winding if total signed volume is negative (default `true`). */
  ensureOutward?: boolean;
  /** Dispose the source geometry after building the cleaned solid (default `false`). */
  disposeSource?: boolean;
}

interface ShellSample {
  pos: THREE.Vector3;
  halfThickness: number;
  uv: [number, number];
}

function clampFinite(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isFinite(value) ? THREE.MathUtils.clamp(value!, min, max) : fallback;
}

function signedVolume(positions: Float32Array, indices: number[]): number {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cross = new THREE.Vector3();
  let vol = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]! * 3;
    const ib = indices[i + 1]! * 3;
    const ic = indices[i + 2]! * 3;
    a.set(positions[ia]!, positions[ia + 1]!, positions[ia + 2]!);
    b.set(positions[ib]!, positions[ib + 1]!, positions[ib + 2]!);
    c.set(positions[ic]!, positions[ic + 1]!, positions[ic + 2]!);
    cross.crossVectors(b, c);
    vol += a.dot(cross) / 6;
  }
  return vol;
}

/**
 * Builds a strictly watertight, closed, outward-oriented thin-shell solid from a
 * `(segU + 1) × (segV + 1)` mid-surface grid: smooth top sheet + smooth bottom sheet
 * + welded boundary rim strip. Top, bottom, and rim share exact boundary vertex
 * coordinates so every undirected welded edge has directed counts `[-1, 1]`, while
 * split normal groups keep thin 2–4 mm edges crisp without dark bevel bleeding.
 */
function buildWatertightThinShell(
  segU: number,
  segV: number,
  sample: (u: number, v: number, iu: number, iv: number) => ShellSample,
): THREE.BufferGeometry {
  const cols = segU + 1;
  const rows = segV + 1;
  const grid: ShellSample[][] = [];
  for (let iv = 0; iv < rows; iv++) {
    const v = iv / segV;
    const row: ShellSample[] = [];
    for (let iu = 0; iu < cols; iu++) {
      const u = iu / segU;
      row.push(sample(u, v, iu, iv));
    }
    grid.push(row);
  }

  // Estimate smooth mid-surface normals from central finite differences across the grid.
  const midNormals: THREE.Vector3[][] = [];
  const dU = new THREE.Vector3();
  const dV = new THREE.Vector3();
  for (let iv = 0; iv < rows; iv++) {
    const nRow: THREE.Vector3[] = [];
    const ivPrev = Math.max(0, iv - 1);
    const ivNext = Math.min(segV, iv + 1);
    for (let iu = 0; iu < cols; iu++) {
      const iuPrev = Math.max(0, iu - 1);
      const iuNext = Math.min(segU, iu + 1);
      dU.subVectors(grid[iv]![iuNext]!.pos, grid[iv]![iuPrev]!.pos);
      dV.subVectors(grid[ivNext]![iu]!.pos, grid[ivPrev]![iu]!.pos);
      const n = new THREE.Vector3().crossVectors(dV, dU);
      if (n.lengthSq() < 1e-16) n.set(0, 1, 0);
      else n.normalize();
      nRow.push(n);
    }
    midNormals.push(nRow);
  }

  const topPts: THREE.Vector3[][] = [];
  const botPts: THREE.Vector3[][] = [];
  for (let iv = 0; iv < rows; iv++) {
    const tRow: THREE.Vector3[] = [];
    const bRow: THREE.Vector3[] = [];
    for (let iu = 0; iu < cols; iu++) {
      const cell = grid[iv]![iu]!;
      const n = midNormals[iv]![iu]!;
      const h = Math.max(0.0004, cell.halfThickness);
      tRow.push(cell.pos.clone().addScaledVector(n, h));
      bRow.push(cell.pos.clone().addScaledVector(n, -h));
    }
    topPts.push(tRow);
    botPts.push(bRow);
  }

  // Vertex layout:
  // [0 .. sheetCount-1]                  : top sheet (smooth top normals)
  // [sheetCount .. 2*sheetCount-1]       : bottom sheet (smooth bottom normals)
  // [2*sheetCount .. 2*sheetCount + 4*P] : perimeter rim quads (outward rim normals)
  const sheetCount = rows * cols;
  const perimeterLoop: [number, number][] = [];
  for (let iu = 0; iu < segU; iu++) perimeterLoop.push([iu, 0]);
  for (let iv = 0; iv < segV; iv++) perimeterLoop.push([segU, iv]);
  for (let iu = segU; iu > 0; iu--) perimeterLoop.push([iu, segV]);
  for (let iv = segV; iv > 0; iv--) perimeterLoop.push([0, iv]);
  const perimCount = perimeterLoop.length;

  const totalVerts = sheetCount * 2 + perimCount * 4;
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices: number[] = [];

  for (let iv = 0; iv < rows; iv++) {
    for (let iu = 0; iu < cols; iu++) {
      const idx = iv * cols + iu;
      const top = topPts[iv]![iu]!;
      const bot = botPts[iv]![iu]!;
      const uv = grid[iv]![iu]!.uv;
      positions[idx * 3] = top.x;
      positions[idx * 3 + 1] = top.y;
      positions[idx * 3 + 2] = top.z;
      uvs[idx * 2] = uv[0];
      uvs[idx * 2 + 1] = uv[1];

      const bIdx = sheetCount + idx;
      positions[bIdx * 3] = bot.x;
      positions[bIdx * 3 + 1] = bot.y;
      positions[bIdx * 3 + 2] = bot.z;
      uvs[bIdx * 2] = uv[0];
      uvs[bIdx * 2 + 1] = uv[1];
    }
  }

  const topIndices: number[] = [];
  const botIndices: number[] = [];
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * cols + iu;
      const b = (iv + 1) * cols + iu;
      const c = (iv + 1) * cols + (iu + 1);
      const d = iv * cols + (iu + 1);
      // Top sheet outward +n: (a, b, c) and (a, c, d)
      topIndices.push(a, b, c, a, c, d);
      // Bottom sheet outward -n: opposite winding
      const ba = sheetCount + a;
      const bb = sheetCount + b;
      const bc = sheetCount + c;
      const bd = sheetCount + d;
      botIndices.push(ba, bc, bb, ba, bd, bc);
    }
  }
  indices.push(...topIndices, ...botIndices);

  // Perimeter rim strip connecting top perimeter to bottom perimeter with matching opposite directed edges.
  const rimBase = sheetCount * 2;
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();
  for (let k = 0; k < perimCount; k++) {
    const [u0, v0] = perimeterLoop[k]!;
    const [u1, v1] = perimeterLoop[(k + 1) % perimCount]!;
    const t0 = topPts[v0]![u0]!;
    const t1 = topPts[v1]![u1]!;
    const b1 = botPts[v1]![u1]!;
    const b0 = botPts[v0]![u0]!;
    const uv0 = grid[v0]![u0]!.uv;
    const uv1 = grid[v1]![u1]!.uv;

    e1.subVectors(t1, t0);
    e2.subVectors(b1, t0);
    fn.crossVectors(e1, e2);
    if (fn.lengthSq() > 1e-18) fn.normalize();
    else fn.set(0, 1, 0);

    const base = rimBase + k * 4;
    const pts = [t0, t1, b1, b0];
    const qUvs: [number, number][] = [uv0, uv1, uv1, uv0];
    for (let j = 0; j < 4; j++) {
      const vi = base + j;
      positions[vi * 3] = pts[j]!.x;
      positions[vi * 3 + 1] = pts[j]!.y;
      positions[vi * 3 + 2] = pts[j]!.z;
      normals[vi * 3] = fn.x;
      normals[vi * 3 + 1] = fn.y;
      normals[vi * 3 + 2] = fn.z;
      uvs[vi * 2] = qUvs[j]![0];
      uvs[vi * 2 + 1] = qUvs[j]![1];
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Ensure strictly positive signed volume (flip winding if parameterization was left-handed).
  const flipped = signedVolume(positions, indices) < 0;
  if (flipped) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1]!;
      indices[i + 1] = indices[i + 2]!;
      indices[i + 2] = tmp;
    }
    for (let i = rimBase * 3; i < normals.length; i++) normals[i] = -normals[i]!;
  }

  // Compute area-weighted smooth normals independently on top and bottom sheets.
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const accumulateSheetNormals = (startTriIdx: number, count: number) => {
    for (let i = startTriIdx; i < startTriIdx + count; i += 3) {
      const ia = indices[i]!;
      const ib = indices[i + 1]!;
      const ic = indices[i + 2]!;
      va.set(positions[ia * 3]!, positions[ia * 3 + 1]!, positions[ia * 3 + 2]!);
      vb.set(positions[ib * 3]!, positions[ib * 3 + 1]!, positions[ib * 3 + 2]!);
      vc.set(positions[ic * 3]!, positions[ic * 3 + 1]!, positions[ic * 3 + 2]!);
      e1.subVectors(vb, va);
      e2.subVectors(vc, va);
      fn.crossVectors(e1, e2);
      for (const idx of [ia, ib, ic]) {
        normals[idx * 3] += fn.x;
        normals[idx * 3 + 1] += fn.y;
        normals[idx * 3 + 2] += fn.z;
      }
    }
  };
  accumulateSheetNormals(0, topIndices.length);
  accumulateSheetNormals(topIndices.length, botIndices.length);

  for (let i = 0; i < sheetCount * 2; i++) {
    const nx = normals[i * 3]!;
    const ny = normals[i * 3 + 1]!;
    const nz = normals[i * 3 + 2]!;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;
    } else {
      normals[i * 3 + 1] = i < sheetCount ? 1 : -1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds a strictly watertight closed solid of revolution around the Y axis with
 * single welded pole vertices (zero degenerate polar triangles), exact UV seam
 * coordinates, seamless smooth normals across the meridian, and outward winding.
 */
function buildClosedRevolutionSolid(
  radialSegments: number,
  heightSegments: number,
  yMin: number,
  yMax: number,
  radiusAt: (v: number, angle: number) => number,
): THREE.BufferGeometry {
  const ringCount = heightSegments - 1;
  const ringStride = radialSegments + 1;
  // Layout: [0] bottom pole, [1] top pole, [2 .. 2 + ringCount*ringStride - 1] rings
  const totalVerts = 2 + ringCount * ringStride;
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices: number[] = [];

  // Bottom pole (index 0) and top pole (index 1)
  positions[0] = 0; positions[1] = yMin; positions[2] = 0;
  uvs[0] = 0.5; uvs[1] = 0;
  positions[3] = 0; positions[4] = yMax; positions[5] = 0;
  uvs[2] = 0.5; uvs[3] = 1;

  for (let r = 0; r < ringCount; r++) {
    const v = (r + 1) / heightSegments;
    const y = THREE.MathUtils.lerp(yMin, yMax, v);
    for (let j = 0; j <= radialSegments; j++) {
      // Reuse angle = 0 at the UV seam (j === radialSegments) so seam positions weld identically.
      const angle = j === radialSegments ? 0 : (j / radialSegments) * Math.PI * 2;
      const rad = Math.max(0.001, radiusAt(v, angle));
      const vi = 2 + r * ringStride + j;
      positions[vi * 3] = Math.cos(angle) * rad;
      positions[vi * 3 + 1] = y;
      positions[vi * 3 + 2] = Math.sin(angle) * rad;
      uvs[vi * 2] = j / radialSegments;
      uvs[vi * 2 + 1] = v;
    }
  }

  // Bottom cap (outward -Y)
  for (let j = 0; j < radialSegments; j++) {
    indices.push(0, 2 + j, 2 + j + 1);
  }
  // Middle rings (outward radial)
  for (let r = 0; r < ringCount - 1; r++) {
    const row0 = 2 + r * ringStride;
    const row1 = 2 + (r + 1) * ringStride;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(row0 + j, row1 + j, row0 + j + 1);
      indices.push(row0 + j + 1, row1 + j, row1 + j + 1);
    }
  }
  // Top cap (outward +Y)
  const lastRow = 2 + (ringCount - 1) * ringStride;
  for (let j = 0; j < radialSegments; j++) {
    indices.push(1, lastRow + j + 1, lastRow + j);
  }

  if (signedVolume(positions, indices) < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1]!;
      indices[i + 1] = indices[i + 2]!;
      indices[i + 2] = tmp;
    }
  }

  // Accumulate area-weighted normals by logical vertex (merging UV seam j=0 and j=radialSegments).
  const logicalNormal = new Float32Array((2 + ringCount * radialSegments) * 3);
  const logicalOf = (vi: number) => {
    if (vi < 2) return vi;
    const rel = vi - 2;
    const r = Math.floor(rel / ringStride);
    const j = rel % ringStride;
    return 2 + r * radialSegments + (j === radialSegments ? 0 : j);
  };
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]!;
    const ib = indices[i + 1]!;
    const ic = indices[i + 2]!;
    va.set(positions[ia * 3]!, positions[ia * 3 + 1]!, positions[ia * 3 + 2]!);
    vb.set(positions[ib * 3]!, positions[ib * 3 + 1]!, positions[ib * 3 + 2]!);
    vc.set(positions[ic * 3]!, positions[ic * 3 + 1]!, positions[ic * 3 + 2]!);
    e1.subVectors(vb, va);
    e2.subVectors(vc, va);
    fn.crossVectors(e1, e2);
    for (const vi of [ia, ib, ic]) {
      const li = logicalOf(vi);
      logicalNormal[li * 3] += fn.x;
      logicalNormal[li * 3 + 1] += fn.y;
      logicalNormal[li * 3 + 2] += fn.z;
    }
  }

  for (let vi = 0; vi < totalVerts; vi++) {
    const li = logicalOf(vi);
    const nx = logicalNormal[li * 3]!;
    const ny = logicalNormal[li * 3 + 1]!;
    const nz = logicalNormal[li * 3 + 2]!;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      normals[vi * 3] = nx / len;
      normals[vi * 3 + 1] = ny / len;
      normals[vi * 3 + 2] = nz / len;
    } else {
      normals[vi * 3 + 1] = vi === 0 ? -1 : 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function bladeWidthFactor(v: number, widthStation: number, tip: BladeLeafTip): number {
  const s = v <= widthStation
    ? 0.5 * (v / Math.max(widthStation, 1e-4))
    : 0.5 + 0.5 * ((v - widthStation) / Math.max(1 - widthStation, 1e-4));
  const baseEllipse = Math.pow(Math.max(0, Math.sin(Math.PI * s)), 0.88);
  let factor = baseEllipse;
  if (tip === 'acuminate') {
    if (v > widthStation) {
      const u = (v - widthStation) / Math.max(1 - widthStation, 1e-4);
      factor = Math.pow(Math.max(0, 1 - Math.pow(u, 1.35)), 0.85);
    }
  } else if (tip === 'dripTip') {
    // Cordate full lower blade narrowing into a slender elongated drip tip.
    const belly = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, v / 0.78))), 0.72);
    const tail = v > 0.62 ? 0.14 * Math.pow(1 - (v - 0.62) / 0.38, 0.7) : 0;
    factor = v <= 0.62 ? belly : Math.max(belly * Math.pow(1 - (v - 0.62) / 0.38, 1.6), tail);
  } else if (tip === 'obtuse') {
    factor = Math.pow(Math.max(0, Math.sin(Math.PI * s)), 0.60);
  } else {
    // spiny marginal undulations tapering into a pointed apex
    const teeth = 0.74 + 0.26 * Math.cos((v - 0.18) * Math.PI * 5.0);
    factor = baseEllipse * teeth;
  }
  return Math.max(0.055, factor);
}

/**
 * Watertight midrib-folded tapered leaf solid (~48–96 triangles, `FrontSide` only).
 *
 * Canonical frame: petiole base at `(0, 0, 0)`, blade extends along `+z` (`0..length`),
 * width spans `±x`, upper face normal points `+y`. Authored UV places `u = 0.5` right on
 * the midrib and `v ∈ [0, 1]` from petiole to tip.
 */
export function createBladeLeafGeometry(options: BladeLeafOptions = {}): THREE.BufferGeometry {
  const length = clampFinite(options.length, 0.20, 0.02, 2.0);
  const maxWidth = clampFinite(options.maxWidth, 0.09, 0.01, 1.5);
  const widthStation = clampFinite(options.widthStation, 0.42, 0.15, 0.80);
  const tip: BladeLeafTip =
    options.tip === 'dripTip' || options.tip === 'obtuse' || options.tip === 'spiny' ? options.tip : 'acuminate';
  const foldDeg = clampFinite(options.midribFold, 13, 0, 45);
  const arch = clampFinite(options.arch, length * 0.09, -length * 0.6, length * 0.6);
  const tipDroop = clampFinite(
    options.tipDroop,
    tip === 'dripTip' ? length * 0.14 : length * 0.04,
    -length * 0.5,
    length * 0.5,
  );
  const thickness = clampFinite(options.thickness, 0.0028, 0.001, 0.02);
  const rawSegU = Math.round(clampFinite(options.widthSegments, 2, 2, 8));
  const segU = rawSegU % 2 === 0 ? rawSegU : Math.min(8, rawSegU + 1);
  const defaultSegV = tip === 'dripTip' || tip === 'spiny' ? 6 : 5;
  const segV = Math.round(clampFinite(options.lengthSegments, defaultSegV, 3, 16));

  const foldTan = Math.tan(THREE.MathUtils.degToRad(foldDeg));
  const halfMaxW = maxWidth * 0.5;
  const minHalfW = Math.max(0.0014, halfMaxW * 0.055);

  return buildWatertightThinShell(segU, segV, (u, v) => {
    const lat = (u - 0.5) * 2; // -1..1
    const absLat = Math.abs(lat);
    const halfW = Math.max(minHalfW, halfMaxW * bladeWidthFactor(v, widthStation, tip));
    const x = lat * halfW;
    const z = v * length;
    const archY = Math.sin(Math.PI * Math.pow(v, 0.85)) * arch - Math.pow(v, 2.3) * tipDroop;
    const midribV = absLat * halfW * foldTan;
    // Slight transverse camber when segU >= 4 softens the half-blade cheeks.
    const cheekCamber = segU >= 4 ? (1 - absLat) * absLat * halfW * 0.12 : 0;
    const y = archY + midribV + cheekCamber;

    const taper = THREE.MathUtils.lerp(1.0, 0.54, v) * THREE.MathUtils.lerp(1.12, 0.68, absLat);
    const halfThickness = Math.max(0.0005, thickness * 0.5 * taper);
    return { pos: new THREE.Vector3(x, y, z), halfThickness, uv: [u, v] };
  });
}

/**
 * Watertight cupped & tip-curled flower petal solid (~44–80 triangles, `FrontSide` only).
 * Lightweight closed-shell cousin of `yeondeunghoe`'s sculpted lotus petal.
 *
 * Canonical frame: throat at `(0, 0, 0)`, blade rises along `+y` (`0..length`), width
 * spans `±x`, concave inner cup faces `-z` and convex back / curled tip bow toward `+z`.
 */
export function createCuppedPetalGeometry(options: CuppedPetalOptions = {}): THREE.BufferGeometry {
  const length = clampFinite(options.length, 0.12, 0.015, 1.5);
  const maxWidth = clampFinite(options.maxWidth, 0.075, 0.01, 1.2);
  const throatRatio = clampFinite(options.throatRatio, 0.24, 0.08, 0.70);
  const cupDepth = clampFinite(options.cupDepth, 0.016, -length * 0.5, length * 0.5);
  const tipCurl = clampFinite(options.tipCurl, 0.012, -length * 0.5, length * 0.5);
  const tipShape: CuppedPetalTip =
    options.tipShape === 'pointed' || options.tipShape === 'notched' ? options.tipShape : 'rounded';
  const thickness = clampFinite(options.thickness, 0.0022, 0.0008, 0.015);
  const segU = Math.round(clampFinite(options.widthSegments, 4, 2, 8));
  const segV = Math.round(clampFinite(options.lengthSegments, 3, 3, 12));

  const halfMaxW = maxWidth * 0.5;
  const minHalfW = Math.max(0.0012, halfMaxW * 0.06);

  return buildWatertightThinShell(segU, segV, (u, v) => {
    const lat = (u - 0.5) * 2; // -1..1
    const absLat = Math.abs(lat);
    const powExp = tipShape === 'pointed' ? 0.92 : 0.62;
    const lobe = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(v, 0.74))), powExp);
    const widthFactor = throatRatio * (1 - v) + lobe * (1 - throatRatio * 0.35);
    const halfW = Math.max(minHalfW, halfMaxW * widthFactor);
    const x = lat * halfW;

    // Optional delicate sakura/peach tip notch along the central apex.
    const notch = tipShape === 'notched'
      ? Math.pow(v, 3.0) * Math.exp(-lat * lat * 12) * (length * 0.075)
      : 0;
    const y = v * length - notch;

    const cupEnvelope = Math.sin(Math.PI * Math.pow(v, 0.78));
    const cupZ = cupDepth * (1 - lat * lat) * cupEnvelope;
    const tipPhase = Math.max(0, (v - 0.55) / 0.45);
    const curlZ = tipCurl * tipPhase * tipPhase;
    const z = cupZ + curlZ;

    const taper = THREE.MathUtils.lerp(1.05, 0.58, v) * THREE.MathUtils.lerp(1.08, 0.72, absLat);
    const halfThickness = Math.max(0.00045, thickness * 0.5 * taper);
    return { pos: new THREE.Vector3(x, y, z), halfThickness, uv: [u, v] };
  });
}

/**
 * Watertight thin-shell holly leaf (*Osmanthus heterophyllus*) with alternating upturned
 * and downturned marginal spines, V-folded midrib, and authored midrib-centered UVs.
 *
 * Canonical frame: petiole at `(0, 0, 0)`, extends along `+z` (`0..length`), width `±x`, up `+y`.
 */
export function createSpinyHollyLeafGeometry(options: SpinyHollyLeafOptions = {}): THREE.BufferGeometry {
  const length = clampFinite(options.length, 0.34, 0.04, 1.5);
  const maxWidth = clampFinite(options.maxWidth, 0.19, 0.02, 1.0);
  const spinePairs = Math.round(clampFinite(options.spinePairs, 3, 2, 4));
  const spinePitch = clampFinite(options.spinePitch, 0.006, 0, 0.04);
  const foldDeg = clampFinite(options.midribFold, 12, 0, 30);
  const arch = clampFinite(options.arch, 0.018, -0.2, 0.2);
  const thickness = clampFinite(options.thickness, 0.0035, 0.0012, 0.015);

  const segU = 2;
  // Two segments per sinus-to-spine-to-sinus wave gives crisp pointed spine peaks.
  const segV = spinePairs * 4;
  const foldTan = Math.tan(THREE.MathUtils.degToRad(foldDeg));
  const halfMaxW = maxWidth * 0.5;
  const minHalfW = Math.max(0.0018, halfMaxW * 0.055);

  return buildWatertightThinShell(segU, segV, (u, v, _iu, iv) => {
    const lat = (u - 0.5) * 2;
    const absLat = Math.abs(lat);
    const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(v, 0.85))), 0.78);
    // Alternating sinus (odd*2) and sharp spine crest (iv % 4 === 2) along lateral margins.
    const isInner = iv > 0 && iv < segV;
    const phase = iv % 4;
    const spineFactor = !isInner ? 0.08 : phase === 2 ? 1.0 : phase === 0 ? 0.58 : 0.74;
    const halfW = Math.max(minHalfW, halfMaxW * envelope * spineFactor);
    const x = lat * halfW;
    const z = v * length;

    const spineIndex = Math.floor((iv - 1) / 4);
    const pitchSign = spineIndex % 2 === 0 ? 1 : -1;
    const edgeCurl = isInner && phase === 2 ? pitchSign * spinePitch * absLat : 0;
    const y = Math.sin(Math.PI * v) * arch + absLat * halfW * foldTan + edgeCurl;
    const halfThickness = Math.max(0.0006, thickness * 0.5 * THREE.MathUtils.lerp(1.08, 0.62, v));
    return { pos: new THREE.Vector3(x, y, z), halfThickness, uv: [u, v] };
  });
}

/**
 * Watertight folded banana-leaf fan (for krathong crowns and folded tropical leaf collars).
 *
 * Canonical frame: base centered near `(0, 0, 0)`, rises along `+y` (`0..height`),
 * width spans `±x`, central fold ridge projects toward `+z`. Authored UV places
 * `u = 0.5` directly on the raised fold ridge for `botanical-surfaces` (`leaf: parallel`).
 */
export function createFoldedBananaLeafFanGeometry(options: FoldedBananaLeafFanOptions = {}): THREE.BufferGeometry {
  const width = clampFinite(options.width, 0.30, 0.03, 1.5);
  const height = clampFinite(options.height, 0.32, 0.03, 1.5);
  const ridgeDepth = clampFinite(options.ridgeDepth, 0.15, 0.01, 0.8);
  const bellyCurve = clampFinite(options.bellyCurve, 0.024, 0, 0.25);
  const thickness = clampFinite(options.thickness, 0.0032, 0.001, 0.02);
  const rawSegU = Math.round(clampFinite(options.widthSegments, 4, 2, 8));
  const segU = rawSegU % 2 === 0 ? rawSegU : Math.min(8, rawSegU + 1);
  const segV = Math.round(clampFinite(options.heightSegments, 4, 3, 10));

  const halfBaseW = width * 0.5;
  const minHalfW = Math.max(0.002, halfBaseW * 0.045);

  return buildWatertightThinShell(segU, segV, (u, v) => {
    const lat = (u - 0.5) * 2; // -1..1
    const absLat = Math.abs(lat);
    // Tapers gracefully from broad folded base (v=0) to pointed upright crest (v=1).
    const widthProfile = Math.pow(Math.max(0, 1 - v), 0.78);
    const halfW = Math.max(minHalfW, halfBaseW * widthProfile);
    const x = lat * halfW;
    // Center ridge stands slightly taller near the bottom belly and converges to height at tip.
    const y = v * height + (1 - absLat) * (1 - v) * (height * 0.12);
    // Raised central V-ridge tapering upward, plus gentle organic cheek fullness.
    const ridgeZ = (1 - absLat) * ridgeDepth * Math.pow(1 - v * 0.58, 1.1);
    const cheekZ = Math.sin(Math.PI * absLat) * Math.sin(Math.PI * v) * bellyCurve;
    const z = ridgeZ + cheekZ - ridgeDepth * 0.35;

    const halfThickness = Math.max(0.0005, thickness * 0.5 * THREE.MathUtils.lerp(1.05, 0.62, v));
    return { pos: new THREE.Vector3(x, y, z), halfThickness, uv: [u, v] };
  });
}

/**
 * Watertight plump teardrop wheat kernel with a subtle ventral crease (`InstancedMesh`-ready).
 * Centered along `y ∈ [-length/2, +length/2]` with smooth seamless normals and authored UVs.
 */
export function createWheatKernelGeometry(options: WheatKernelOptions = {}): THREE.BufferGeometry {
  const length = clampFinite(options.length, 0.11, 0.01, 1.0);
  const radius = clampFinite(options.radius, 0.026, 0.003, 0.4);
  const creaseDepth = clampFinite(options.creaseDepth, 0.24, 0, 0.45);
  const radialSegments = Math.round(clampFinite(options.radialSegments, 8, 6, 20));
  const heightSegments = Math.round(clampFinite(options.heightSegments, 5, 3, 12));

  return buildClosedRevolutionSolid(radialSegments, heightSegments, -length * 0.5, length * 0.5, (v, angle) => {
    // Plump lower-mid belly tapering gently toward base and sharper toward the brush apex.
    const profile = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.84)), 0.72);
    // Ventral wheat groove centered near angle = 0 (wrapped cleanly around ±π).
    const wrapped = Math.atan2(Math.sin(angle), Math.cos(angle));
    const groove = Math.exp(-Math.pow(wrapped * 2.4, 2)) * Math.sin(Math.PI * v);
    const cross = 1 - creaseDepth * groove + 0.06 * Math.cos(angle * 2);
    return radius * profile * Math.max(0.45, cross);
  });
}

/**
 * Watertight teardrop/ovoid flower bud primitive (for jasmine garlands or willow catkins).
 * Centered along `y ∈ [-length/2, +length/2]` with optional soft petal flutes and smooth normals.
 */
export function createFlowerBudGeometry(options: FlowerBudOptions = {}): THREE.BufferGeometry {
  const length = clampFinite(options.length, 0.095, 0.01, 1.0);
  const radius = clampFinite(options.radius, 0.024, 0.003, 0.4);
  const lobeCount = Math.round(clampFinite(options.lobeCount, 3, 0, 8));
  const lobeDepth = clampFinite(options.lobeDepth, 0.07, 0, 0.22);
  const tipSharpness = clampFinite(options.tipSharpness, 0.78, 0.3, 1.4);
  const radialSegments = Math.round(clampFinite(options.radialSegments, 10, 6, 24));
  const heightSegments = Math.round(clampFinite(options.heightSegments, 5, 4, 12));

  return buildClosedRevolutionSolid(radialSegments, heightSegments, -length * 0.5, length * 0.5, (v, angle) => {
    // Swells smoothly above the calyx base (v ≈ 0.38) and tapers to the bud tip (v = 1).
    const baseRound = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.72)), 0.68);
    const tipTaper = v > 0.42 ? Math.pow(1 - (v - 0.42) / 0.58, tipSharpness * 0.45) : 1;
    const flute = lobeCount > 0
      ? 1 + lobeDepth * Math.cos(angle * lobeCount + v * 1.4) * Math.sin(Math.PI * v)
      : 1;
    return radius * baseRound * tipTaper * flute;
  });
}

/**
 * Produces a clean, degenerate-free, outward-oriented non-indexed solid while
 * preserving smooth welded vertex normals (avoiding the classic
 * `toNonIndexed() -> computeVertexNormals()` faceted-shading bug on spheres,
 * deformed apples, and willow buds).
 */
export function createSmoothSolid(
  source: THREE.BufferGeometry,
  options: SmoothSolidOptions = {},
): THREE.BufferGeometry {
  const smooth = options.smooth ?? true;
  const creaseCos = options.creaseAngle !== undefined && Number.isFinite(options.creaseAngle)
    ? Math.cos(THREE.MathUtils.clamp(options.creaseAngle, 0, Math.PI))
    : undefined;
  const areaEpsilon = clampFinite(options.areaEpsilon, 1e-12, 0, 1e-4);
  const weldPrecision = clampFinite(options.weldPrecision, 1e6, 1e2, 1e8);
  const ensureOutward = options.ensureOutward ?? true;

  const srcPos = source.getAttribute('position');
  const srcIndex = source.index;
  const srcUv = source.getAttribute('uv');
  const srcColor = source.getAttribute('color');
  const triVertCount = srcIndex ? srcIndex.count : srcPos.count;

  const keptPositions: number[] = [];
  const keptUvs: number[] = [];
  const keptColors: number[] = [];
  const faceNormals: THREE.Vector3[] = [];
  const faceUnitNormals: THREE.Vector3[] = [];
  const triKeys: [string, string, string][] = [];

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  const weldKey = (v: THREE.Vector3) =>
    `${Math.round(v.x * weldPrecision)},${Math.round(v.y * weldPrecision)},${Math.round(v.z * weldPrecision)}`;

  let volume = 0;
  for (let i = 0; i < triVertCount; i += 3) {
    const i0 = srcIndex ? srcIndex.getX(i) : i;
    const i1 = srcIndex ? srcIndex.getX(i + 1) : i + 1;
    const i2 = srcIndex ? srcIndex.getX(i + 2) : i + 2;
    a.fromBufferAttribute(srcPos, i0);
    b.fromBufferAttribute(srcPos, i1);
    c.fromBufferAttribute(srcPos, i2);
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    cross.crossVectors(e1, e2);
    const area = cross.length() * 0.5;
    if (!Number.isFinite(area) || area <= areaEpsilon) continue;

    keptPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    if (srcUv) {
      keptUvs.push(
        srcUv.getX(i0), srcUv.getY(i0),
        srcUv.getX(i1), srcUv.getY(i1),
        srcUv.getX(i2), srcUv.getY(i2),
      );
    }
    if (srcColor) {
      keptColors.push(
        srcColor.getX(i0), srcColor.getY(i0), srcColor.getZ(i0),
        srcColor.getX(i1), srcColor.getY(i1), srcColor.getZ(i1),
        srcColor.getX(i2), srcColor.getY(i2), srcColor.getZ(i2),
      );
    }
    volume += a.dot(e1.copy(b).cross(c)) / 6;
    faceNormals.push(cross.clone());
    faceUnitNormals.push(cross.clone().normalize());
    triKeys.push([weldKey(a), weldKey(b), weldKey(c)]);
  }

  const triCount = faceNormals.length;
  if (ensureOutward && volume < 0) {
    for (let t = 0; t < triCount; t++) {
      const pBase = t * 9;
      for (let k = 0; k < 3; k++) {
        const tmp = keptPositions[pBase + 3 + k]!;
        keptPositions[pBase + 3 + k] = keptPositions[pBase + 6 + k]!;
        keptPositions[pBase + 6 + k] = tmp;
      }
      if (srcUv) {
        const uBase = t * 6;
        for (let k = 0; k < 2; k++) {
          const tmp = keptUvs[uBase + 2 + k]!;
          keptUvs[uBase + 2 + k] = keptUvs[uBase + 4 + k]!;
          keptUvs[uBase + 4 + k] = tmp;
        }
      }
      if (srcColor) {
        const cBase = t * 9;
        for (let k = 0; k < 3; k++) {
          const tmp = keptColors[cBase + 3 + k]!;
          keptColors[cBase + 3 + k] = keptColors[cBase + 6 + k]!;
          keptColors[cBase + 6 + k] = tmp;
        }
      }
      faceNormals[t]!.negate();
      faceUnitNormals[t]!.negate();
      const keys = triKeys[t]!;
      triKeys[t] = [keys[0], keys[2], keys[1]];
    }
  }

  const outNormals = new Float32Array(triCount * 9);
  if (!smooth) {
    for (let t = 0; t < triCount; t++) {
      const fn = faceUnitNormals[t]!;
      const base = t * 9;
      for (let k = 0; k < 3; k++) {
        outNormals[base + k * 3] = fn.x;
        outNormals[base + k * 3 + 1] = fn.y;
        outNormals[base + k * 3 + 2] = fn.z;
      }
    }
  } else if (creaseCos === undefined) {
    // Fully smooth: accumulate area-weighted face normals per welded 3D position.
    const buckets = new Map<string, THREE.Vector3>();
    for (let t = 0; t < triCount; t++) {
      const fn = faceNormals[t]!;
      for (const key of triKeys[t]!) {
        const acc = buckets.get(key);
        if (acc) acc.add(fn);
        else buckets.set(key, fn.clone());
      }
    }
    for (const vec of buckets.values()) {
      if (vec.lengthSq() > 1e-18) vec.normalize();
      else vec.set(0, 1, 0);
    }
    for (let t = 0; t < triCount; t++) {
      const keys = triKeys[t]!;
      const base = t * 9;
      for (let k = 0; k < 3; k++) {
        const n = buckets.get(keys[k]!)!;
        outNormals[base + k * 3] = n.x;
        outNormals[base + k * 3 + 1] = n.y;
        outNormals[base + k * 3 + 2] = n.z;
      }
    }
  } else {
    // Crease-angle smooth: average incident face normals within creaseAngle of each triangle.
    const incident = new Map<string, number[]>();
    for (let t = 0; t < triCount; t++) {
      for (const key of triKeys[t]!) {
        const list = incident.get(key);
        if (list) list.push(t);
        else incident.set(key, [t]);
      }
    }
    const acc = new THREE.Vector3();
    for (let t = 0; t < triCount; t++) {
      const ref = faceUnitNormals[t]!;
      const keys = triKeys[t]!;
      const base = t * 9;
      for (let k = 0; k < 3; k++) {
        acc.set(0, 0, 0);
        for (const other of incident.get(keys[k]!)!) {
          if (ref.dot(faceUnitNormals[other]!) >= creaseCos) acc.add(faceNormals[other]!);
        }
        if (acc.lengthSq() > 1e-18) acc.normalize();
        else acc.copy(ref);
        outNormals[base + k * 3] = acc.x;
        outNormals[base + k * 3 + 1] = acc.y;
        outNormals[base + k * 3 + 2] = acc.z;
      }
    }
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keptPositions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(outNormals, 3));
  if (srcUv) out.setAttribute('uv', new THREE.Float32BufferAttribute(keptUvs, 2));
  if (srcColor) out.setAttribute('color', new THREE.Float32BufferAttribute(keptColors, 3));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  if (options.disposeSource) source.dispose();
  return out;
}
