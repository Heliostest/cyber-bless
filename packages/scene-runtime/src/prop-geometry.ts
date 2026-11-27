import * as THREE from 'three';

export interface BakeCreviceAOOptions {
  groundY?: number;
  groundRange?: number;
  cavityCenter?: [number, number];
  cavityRadius?: number;
  cavityTopY?: number;
  strength?: number;
  tint?: THREE.ColorRepresentation;
  baseColor?: THREE.ColorRepresentation;
}

export interface ThrownVesselOptions {
  segments?: number;
  wallThickness?: number;
  footRing?: boolean;
  rolledLip?: boolean;
  bodyColor?: THREE.ColorRepresentation;
  rimColor?: THREE.ColorRepresentation;
  footColor?: THREE.ColorRepresentation;
  insideColor?: THREE.ColorRepresentation;
  creviceAO?: boolean;
}

export interface CurvedStreamOptions {
  startRadius?: number;
  endRadius?: number;
  sag?: number;
  time?: number;
  flow?: number;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (Math.abs(edge1 - edge0) < 1e-8) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Deterministic vertex-color ambient occlusion baker (zero runtime shader cost).
 * Darkens base ground contact, downward/inward concavities, and interior vessel
 * cavities toward a warm purple-umber tint while preserving existing vertex colors.
 */
export function bakeCreviceAO(
  geometry: THREE.BufferGeometry,
  options: BakeCreviceAOOptions = {},
): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  if (!position) return geometry;
  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }
  const normal = geometry.getAttribute('normal');
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const sizeY = Math.max(1e-4, box.max.y - box.min.y);

  const groundY = Number.isFinite(options.groundY) ? options.groundY! : box.min.y;
  const groundRange = Number.isFinite(options.groundRange)
    ? Math.max(1e-4, options.groundRange!)
    : Math.max(0.02, sizeY * 0.24);
  const cx = options.cavityCenter?.[0] ?? (box.min.x + box.max.x) * 0.5;
  const cz = options.cavityCenter?.[1] ?? (box.min.z + box.max.z) * 0.5;
  const hasCavityRadius = Number.isFinite(options.cavityRadius) && options.cavityRadius! > 0;
  const cavityRadius = hasCavityRadius ? options.cavityRadius! : 0;
  const cavityTopY = Number.isFinite(options.cavityTopY) ? options.cavityTopY! : box.max.y;
  const strength = Number.isFinite(options.strength) ? clamp(options.strength!, 0, 1) : 0.34;

  const tintColor = new THREE.Color(options.tint ?? 0x5e4942);
  const existingColor = geometry.getAttribute('color');
  const baseColor =
    options.baseColor !== undefined
      ? new THREE.Color(options.baseColor)
      : existingColor
        ? null
        : new THREE.Color(0xffffff);

  const count = position.count;
  const colors = new Float32Array(count * 3);
  const cavitySpan = Math.max(1e-4, cavityTopY - groundY);

  for (let i = 0; i < count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const nx = normal ? normal.getX(i) : 0;
    const ny = normal ? normal.getY(i) : 1;
    const nz = normal ? normal.getZ(i) : 0;

    // 1. Base ground contact AO
    const hAboveGround = y - groundY;
    const nearGround = hAboveGround <= 0 ? 1 : 1 - smoothstep(0, groundRange, hAboveGround);
    const downBias = 0.58 + 0.42 * clamp(-ny * 0.65 + 0.35, 0, 1);
    const groundAO = nearGround * nearGround * downBias;

    // 2. Downward overhang / undercut AO
    const underAO = smoothstep(-0.15, -0.85, ny) * 0.46;

    // 3. Inward-facing concavity & interior vessel cavity AO
    const rx = x - cx;
    const rz = z - cz;
    const rad = Math.hypot(rx, rz);
    const radialDot = rad > 1e-5 ? (rx * nx + rz * nz) / rad : 0;
    const inwardFactor = smoothstep(-0.05, -0.75, radialDot);
    const depthNorm = clamp((cavityTopY - y) / cavitySpan, 0, 1);

    let cavityAO = 0;
    if (hasCavityRadius) {
      const insideRadial = 1 - smoothstep(cavityRadius * 0.78, cavityRadius * 1.06, rad);
      const isInteriorFloor = ny > 0.15 && y < cavityTopY - 1e-4 ? insideRadial * 0.94 : 0;
      const interiorMask = Math.max(inwardFactor, isInteriorFloor) * insideRadial;
      cavityAO = interiorMask * (0.30 + 0.70 * Math.pow(depthNorm, 0.72));
    } else if (inwardFactor > 0) {
      cavityAO = inwardFactor * 0.56 * (0.28 + 0.72 * depthNorm);
    }

    const occ = clamp(1 - (1 - groundAO) * (1 - underAO) * (1 - cavityAO), 0, 1);
    const factor = clamp(occ * strength, 0, 0.92);

    let r = existingColor ? existingColor.getX(i) : 1;
    let g = existingColor ? existingColor.getY(i) : 1;
    let b = existingColor ? existingColor.getZ(i) : 1;
    if (baseColor) {
      r *= baseColor.r;
      g *= baseColor.g;
      b *= baseColor.b;
    }

    colors[i * 3] = r * lerp(1, tintColor.r, factor);
    colors[i * 3 + 1] = g * lerp(1, tintColor.g, factor);
    colors[i * 3 + 2] = b * lerp(1, tintColor.b, factor);
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

type VesselRow = {
  r: number;
  y: number;
  color: THREE.Color;
};

/**
 * Builds a wheel-thrown ceramic/metal/lacquer vessel from an outer [radius, y]
 * profile (bottom to top), with smooth spline contour, optional unglazed bisque
 * foot ring, rounded rolled lip, real inner wall and floor, vertex color bands,
 * welded u=0/u=1 seam normals, and automatic crevice AO baking.
 */
export function createThrownVessel(
  profile: readonly (readonly [number, number])[],
  options: ThrownVesselOptions = {},
): THREE.BufferGeometry {
  if (profile.length < 2) {
    throw new Error('createThrownVessel requires at least 2 [radius, y] profile points.');
  }

  const segments = Math.max(8, Math.round(Number.isFinite(options.segments) ? options.segments! : 32));
  const footRing = options.footRing !== false;
  const rolledLip = options.rolledLip !== false;

  const bodyColor = new THREE.Color(options.bodyColor ?? 0xe8ece6);
  const rimColor =
    options.rimColor !== undefined ? new THREE.Color(options.rimColor) : bodyColor.clone();
  const footColor = new THREE.Color(options.footColor ?? 0xd8c3a0);
  const insideColor =
    options.insideColor !== undefined
      ? new THREE.Color(options.insideColor)
      : bodyColor.clone().multiplyScalar(0.86);

  const splinePoints = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  const curve = new THREE.SplineCurve(splinePoints);
  const sampleCount = Math.max(12, profile.length * 4);
  const outer: [number, number][] = curve
    .getPoints(sampleCount)
    .map(p => [Math.max(0, p.x), p.y]);
  // Preserve exact endpoints from authored profile.
  outer[0] = [Math.max(0, profile[0][0]), profile[0][1]];
  outer[outer.length - 1] = [
    Math.max(0, profile[profile.length - 1][0]),
    profile[profile.length - 1][1],
  ];

  const y0 = outer[0][1];
  const r0 = outer[0][0];
  const lip = outer[outer.length - 1];
  const lipR = Math.max(0.004, lip[0]);
  const lipY = lip[1];
  const vesselHeight = Math.max(1e-3, lipY - y0);

  let maxOuterR = 0;
  for (const [r] of outer) if (r > maxOuterR) maxOuterR = r;
  const requestedTh = Number.isFinite(options.wallThickness) ? options.wallThickness! : 0.008;
  const th = clamp(requestedTh, 0.0015, Math.max(0.002, Math.min(lipR, maxOuterR) * 0.48));
  const footLift = footRing && r0 > 0.003 ? Math.min(th * 0.85, vesselHeight * 0.09) : 0;
  const footBandY = footRing
    ? y0 + Math.min(vesselHeight * 0.11, Math.max(footLift * 1.4, th * 1.25))
    : y0;

  const rows: VesselRow[] = [];
  const pushRow = (r: number, y: number, color: THREE.Color) => {
    rows.push({ r: Math.max(0, r), y, color });
  };

  // Base & optional unglazed bisque foot ring
  if (footRing && r0 > 0.003) {
    pushRow(0, y0 + footLift, footColor);
    pushRow(r0 * 0.72, y0 + footLift, footColor);
    pushRow(r0 * 0.80, y0, footColor);
    pushRow(r0, y0, footColor);
  } else {
    const baseCol = options.footColor !== undefined ? footColor : bodyColor;
    pushRow(0, y0, baseCol);
    if (r0 > 0.003) {
      pushRow(r0 * 0.88, y0, baseCol);
      pushRow(r0, y0, baseCol);
    }
  }

  // Outer wall bottom -> lip with crisp foot/glaze color split
  let passedFootBand = !footRing || y0 >= footBandY - 1e-6;
  if (passedFootBand && footRing && r0 > 0.003) {
    pushRow(r0, y0, bodyColor);
  }
  for (let i = 1; i < outer.length; i++) {
    const [rPrev, yPrev] = outer[i - 1];
    const [rCur, yCur] = outer[i];
    if (!passedFootBand && yCur >= footBandY) {
      const denom = yCur - yPrev;
      const t = Math.abs(denom) > 1e-7 ? clamp((footBandY - yPrev) / denom, 0, 1) : 1;
      const rCross = lerp(rPrev, rCur, t);
      pushRow(rCross, footBandY, footColor);
      pushRow(rCross, footBandY, bodyColor);
      passedFootBand = true;
      if (Math.abs(yCur - footBandY) > 1e-6) {
        pushRow(rCur, yCur, bodyColor);
      }
    } else {
      pushRow(rCur, yCur, passedFootBand ? bodyColor : footColor);
    }
  }

  // Rolled lip or crisp chamfered rim
  const innerLipR = Math.max(0.0025, lipR - th);
  pushRow(lipR, lipY, rimColor);
  if (rolledLip) {
    pushRow(lipR + th * 0.08, lipY + th * 0.24, rimColor);
    pushRow(lipR - th * 0.16, lipY + th * 0.52, rimColor);
    pushRow(lipR - th * 0.50, lipY + th * 0.58, rimColor);
    pushRow(lipR - th * 0.84, lipY + th * 0.48, rimColor);
    pushRow(innerLipR, lipY + th * 0.14, rimColor);
    pushRow(innerLipR, lipY + th * 0.14, insideColor);
  } else {
    pushRow(innerLipR, lipY, rimColor);
    pushRow(innerLipR, lipY, insideColor);
  }

  // Real inner wall descending to interior floor
  const interiorFloorY = Math.min(
    lipY - th * 0.65,
    y0 + footLift + th * 1.55,
  );
  let maxInnerR = innerLipR;
  let lastInnerR = innerLipR;

  for (let i = outer.length - 2; i >= 0; i--) {
    const [rOut, yOut] = outer[i];
    if (yOut <= interiorFloorY + th * 0.35) break;
    const rIn = Math.max(0.0025, rOut - th);
    if (rIn > maxInnerR) maxInnerR = rIn;
    pushRow(rIn, yOut, insideColor);
    lastInnerR = rIn;
  }

  // Soft interior cove floor closing at r = 0
  if (lastInnerR > 0.004) {
    pushRow(lastInnerR * 0.76, interiorFloorY + th * 0.18, insideColor);
    pushRow(lastInnerR * 0.45, interiorFloorY, insideColor);
  }
  pushRow(0, interiorFloorY, insideColor);

  // Arc-length UV parameterization along the profile
  const rowCount = rows.length;
  const arcLengths = new Float32Array(rowCount);
  let totalArc = 0;
  for (let i = 1; i < rowCount; i++) {
    totalArc += Math.hypot(rows[i].r - rows[i - 1].r, rows[i].y - rows[i - 1].y);
    arcLengths[i] = totalArc;
  }
  const invArc = totalArc > 1e-6 ? 1 / totalArc : 1;

  const stride = segments + 1;
  const vertexCount = rowCount * stride;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);

  for (let i = 0; i < rowCount; i++) {
    const row = rows[i];
    const v = arcLengths[i] * invArc;
    for (let j = 0; j <= segments; j++) {
      // j === segments uses angle = 0 so seam coordinates match u = 0 bit-for-bit.
      const angle = j === segments ? 0 : (j / segments) * Math.PI * 2;
      const idx = i * stride + j;
      positions[idx * 3] = Math.cos(angle) * row.r;
      positions[idx * 3 + 1] = row.y;
      positions[idx * 3 + 2] = Math.sin(angle) * row.r;
      uvs[idx * 2] = j / segments;
      uvs[idx * 2 + 1] = v;
      colors[idx * 3] = row.color.r;
      colors[idx * 3 + 1] = row.color.g;
      colors[idx * 3 + 2] = row.color.b;
    }
  }

  // Indexed manifold triangles, skipping degenerate zero-area triangles (pole caps & doubled glaze rows)
  const indices: number[] = [];
  const pushValidTri = (a: number, b: number, c: number) => {
    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const ux = positions[b * 3] - ax, uy = positions[b * 3 + 1] - ay, uz = positions[b * 3 + 2] - az;
    const vx = positions[c * 3] - ax, vy = positions[c * 3 + 1] - ay, vz = positions[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz > 1e-18) {
      indices.push(a, b, c);
    }
  };

  for (let i = 0; i < rowCount - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * stride + j;
      const b = a + stride;
      pushValidTri(a, b, a + 1);
      pushValidTri(a + 1, b, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute('normal').array as Float32Array;

  // Weld u=0 / u=1 seam normals across every row.
  for (let i = 0; i < rowCount; i++) {
    const a = i * stride * 3;
    const b = (i * stride + segments) * 3;
    const nx = normals[a] + normals[b];
    const ny = normals[a + 1] + normals[b + 1];
    const nz = normals[a + 2] + normals[b + 2];
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[a] = normals[b] = nx / len;
    normals[a + 1] = normals[b + 1] = ny / len;
    normals[a + 2] = normals[b + 2] = nz / len;
  }

  // Weld coincident doubled color-band rows so glaze edges stay smooth-shaded.
  for (let i = 1; i < rowCount; i++) {
    if (Math.abs(rows[i].r - rows[i - 1].r) + Math.abs(rows[i].y - rows[i - 1].y) < 1e-6) {
      for (let j = 0; j <= segments; j++) {
        const a = ((i - 1) * stride + j) * 3;
        const b = (i * stride + j) * 3;
        const nx = normals[a] + normals[b];
        const ny = normals[a + 1] + normals[b + 1];
        const nz = normals[a + 2] + normals[b + 2];
        const len = Math.hypot(nx, ny, nz) || 1;
        normals[a] = normals[b] = nx / len;
        normals[a + 1] = normals[b + 1] = ny / len;
        normals[a + 2] = normals[b + 2] = nz / len;
      }
    }
  }

  // Clean vertical normals on pole center rows (r = 0).
  for (let j = 0; j <= segments; j++) {
    const bottomIdx = j * 3;
    normals[bottomIdx] = 0;
    normals[bottomIdx + 1] = -1;
    normals[bottomIdx + 2] = 0;
    const topIdx = ((rowCount - 1) * stride + j) * 3;
    normals[topIdx] = 0;
    normals[topIdx + 1] = 1;
    normals[topIdx + 2] = 0;
  }
  geometry.getAttribute('normal').needsUpdate = true;

  if (options.creviceAO !== false) {
    bakeCreviceAO(geometry, {
      groundY: y0,
      groundRange: Math.max(0.015, vesselHeight * 0.24),
      cavityCenter: [0, 0],
      cavityRadius: Math.max(0.005, maxInnerR * 1.02),
      cavityTopY: lipY,
      strength: 0.34,
    });
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

type CurvedStreamMeta = {
  radialSegments: number;
  tubularSegments: number;
};

const _pCur = new THREE.Vector3();
const _pPrev = new THREE.Vector3();
const _pNext = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _frameN = new THREE.Vector3();
const _frameB = new THREE.Vector3();
const _vtx = new THREE.Vector3();

function evalStreamPoint(
  out: THREE.Vector3,
  start: THREE.Vector3,
  end: THREE.Vector3,
  sag: number,
  t: number,
): THREE.Vector3 {
  const arc = 4 * sag * t * (1 - t);
  out.set(
    lerp(start.x, end.x, t),
    lerp(start.y, end.y, t) + arc,
    lerp(start.z, end.z, t),
  );
  return out;
}

/**
 * Allocates a reusable indexed BufferGeometry for a gravity-curved liquid pour
 * stream. Update each frame with `updateCurvedStream()` without heap churn.
 */
export function createCurvedStreamGeometry(
  radialSegments = 12,
  tubularSegments = 20,
): THREE.BufferGeometry {
  const radSeg = Math.max(4, Math.round(Number.isFinite(radialSegments) ? radialSegments : 12));
  const tubSeg = Math.max(4, Math.round(Number.isFinite(tubularSegments) ? tubularSegments : 20));
  const stride = radSeg + 1;
  const vertexCount = (tubSeg + 1) * stride;

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  for (let i = 0; i <= tubSeg; i++) {
    const v = i / tubSeg;
    for (let j = 0; j <= radSeg; j++) {
      const idx = i * stride + j;
      uvs[idx * 2] = j / radSeg;
      uvs[idx * 2 + 1] = v;
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < tubSeg; i++) {
    for (let j = 0; j < radSeg; j++) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const normAttr = new THREE.BufferAttribute(normals, 3);
  normAttr.setUsage(THREE.DynamicDrawUsage);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('normal', normAttr);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.userData.curvedStream = { radialSegments: radSeg, tubularSegments: tubSeg } satisfies CurvedStreamMeta;

  updateCurvedStream(geometry, new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0, 0, 0));
  return geometry;
}

/**
 * Updates a curved stream geometry in-place along a parabolic gravity trajectory
 * from `start` (spout) to `end` (vessel), with natural Bernoulli radius taper,
 * flowing sinusoidal surface shimmer, parallel-transport framing, and welded seam normals.
 */
export function updateCurvedStream(
  geometry: THREE.BufferGeometry,
  start: THREE.Vector3,
  end: THREE.Vector3,
  options: CurvedStreamOptions = {},
): void {
  const meta = geometry.userData.curvedStream as CurvedStreamMeta | undefined;
  if (!meta) {
    throw new Error('updateCurvedStream requires geometry created by createCurvedStreamGeometry().');
  }
  const { radialSegments: radSeg, tubularSegments: tubSeg } = meta;
  const stride = radSeg + 1;

  const startRadius = Number.isFinite(options.startRadius) ? Math.max(0.0005, options.startRadius!) : 0.009;
  const endRadius = Number.isFinite(options.endRadius) ? Math.max(0.0005, options.endRadius!) : 0.0045;
  const rawSag = Number.isFinite(options.sag) ? options.sag! : 0.06;
  const time = Number.isFinite(options.time) ? options.time! : 0;
  const flow = Number.isFinite(options.flow) ? clamp(options.flow!, 0, 1.5) : 1;

  const horiz = Math.hypot(end.x - start.x, end.z - start.z);
  const drop = Math.abs(start.y - end.y);
  // Prevent tangent reversal on purely vertical pours when sag exceeds drop/4.
  const sag = horiz < 1e-4 ? Math.sign(rawSag) * Math.min(Math.abs(rawSag), drop * 0.22) : rawSag;

  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const positions = posAttr.array as Float32Array;
  const normals = normAttr.array as Float32Array;

  let initializedFrame = false;
  for (let i = 0; i <= tubSeg; i++) {
    const t = i / tubSeg;
    evalStreamPoint(_pCur, start, end, sag, t);

    const t0 = Math.max(0, t - 0.5 / tubSeg);
    const t1 = Math.min(1, t + 0.5 / tubSeg);
    evalStreamPoint(_pPrev, start, end, sag, t0);
    evalStreamPoint(_pNext, start, end, sag, t1);
    _tangent.subVectors(_pNext, _pPrev);
    if (_tangent.lengthSq() < 1e-12) {
      _tangent.set(0, -1, 0);
    } else {
      _tangent.normalize();
    }

    if (!initializedFrame) {
      if (Math.abs(_tangent.z) < 0.9) {
        _frameN.set(0, 0, 1);
      } else {
        _frameN.set(1, 0, 0);
      }
      _frameN.addScaledVector(_tangent, -_frameN.dot(_tangent)).normalize();
      initializedFrame = true;
    } else {
      _frameN.addScaledVector(_tangent, -_frameN.dot(_tangent));
      if (_frameN.lengthSq() < 1e-10) {
        _frameN.set(1, 0, 0).addScaledVector(_tangent, -_tangent.x);
      }
      _frameN.normalize();
    }
    _frameB.crossVectors(_tangent, _frameN).normalize();

    const baseR = lerp(startRadius, endRadius, Math.pow(t, 0.65)) * flow;
    const midEnv = Math.sin(Math.PI * t) * Math.min(flow, 1);
    const wavePhase = t * 18.0 - time * 14.0;

    for (let j = 0; j <= radSeg; j++) {
      const theta = j === radSeg ? 0 : (j / radSeg) * Math.PI * 2;
      const cs = Math.cos(theta);
      const sn = Math.sin(theta);
      const shimmer =
        1 +
        (0.08 * Math.sin(wavePhase) + 0.04 * Math.sin(wavePhase * 1.7 + theta * 2.0)) * midEnv;
      const r = baseR * shimmer;

      _vtx
        .copy(_pCur)
        .addScaledVector(_frameN, cs * r)
        .addScaledVector(_frameB, sn * r);

      const idx = (i * stride + j) * 3;
      positions[idx] = _vtx.x;
      positions[idx + 1] = _vtx.y;
      positions[idx + 2] = _vtx.z;
    }
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  // Weld u=0 / u=1 seam normals along every stream ring.
  for (let i = 0; i <= tubSeg; i++) {
    const a = i * stride * 3;
    const b = (i * stride + radSeg) * 3;
    const nx = normals[a] + normals[b];
    const ny = normals[a + 1] + normals[b + 1];
    const nz = normals[a + 2] + normals[b + 2];
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[a] = normals[b] = nx / len;
    normals[a + 1] = normals[b + 1] = ny / len;
    normals[a + 2] = normals[b + 2] = nz / len;
  }

  normAttr.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
