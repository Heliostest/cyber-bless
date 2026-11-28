import * as THREE from 'three';
import type { CourtyardSkinId } from './courtyard-skins';
import type { EnvironmentTone } from './debug-environment-tone';
import type { GardenKind } from './garden-layout';
import { createKomorebiSurface } from './komorebi-surface';

type ActiveCourtyardSkin = Exclude<CourtyardSkinId, 'none'>;
type RGB = [number, number, number];
type AtlasQuad = 0 | 1 | 2 | 3; // 0=plaster/stucco, 1=wood/bamboo, 2=stone/brick, 3=roof-tile

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

interface MeshBuilder {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

function createBuilder(): MeshBuilder {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

function quadUvBounds(quad: AtlasQuad): [number, number, number] {
  return [(quad % 2) * 0.5 + 0.02, Math.floor(quad / 2) * 0.5 + 0.02, 0.46];
}

/**
 * Append an arbitrary BufferGeometry into a vertex-colored & UV-mapped merged mesh builder.
 * Supports optional vertical AO gradient (`aoBottom` -> `aoTop`) and gentle sunward tinting.
 */
function appendGeometry(
  b: MeshBuilder,
  geo: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  color: RGB,
  quad: AtlasQuad,
  options?: {
    aoBottom?: number;
    aoTop?: number;
    aoMinY?: number;
    aoMaxY?: number;
    uvRepeatU?: number;
    uvRepeatV?: number;
  },
) {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const idxAttr = geo.getIndex();

  const normalMat = new THREE.Matrix3().getNormalMatrix(matrix);
  const vPos = new THREE.Vector3();
  const vNorm = new THREE.Vector3();
  const [qU0, qV0, qSpan] = quadUvBounds(quad);
  const repU = options?.uvRepeatU ?? 1;
  const repV = options?.uvRepeatV ?? 1;
  const aoBottom = options?.aoBottom ?? 1;
  const aoTop = options?.aoTop ?? 1;
  const aoMinY = options?.aoMinY ?? 0;
  const aoMaxY = options?.aoMaxY ?? 2.6;
  const aoSpan = Math.max(0.01, aoMaxY - aoMinY);

  const baseVertex = b.positions.length / 3;
  for (let i = 0; i < posAttr.count; i++) {
    vPos.fromBufferAttribute(posAttr, i).applyMatrix4(matrix);
    if (normAttr) {
      vNorm.fromBufferAttribute(normAttr, i).applyMatrix3(normalMat).normalize();
    } else {
      vNorm.set(0, 1, 0);
    }

    const rawU = uvAttr ? uvAttr.getX(i) * repU : 0.5;
    const rawV = uvAttr ? uvAttr.getY(i) * repV : 0.5;
    // Wrap UVs smoothly inside the quadrant (triangle-wave fold avoids mip seam bleeding).
    const uFrac = ((rawU % 1) + 1) % 1;
    const vFrac = ((rawV % 1) + 1) % 1;
    const u = qU0 + uFrac * qSpan;
    const v = qV0 + vFrac * qSpan;

    let shade = 1;
    if (aoBottom !== 1 || aoTop !== 1) {
      const t = THREE.MathUtils.clamp((vPos.y - aoMinY) / aoSpan, 0, 1);
      shade *= THREE.MathUtils.lerp(aoBottom, aoTop, t);
    }
    // Slight ground-contact darkening right where masonry meets the earth.
    const groundAO = THREE.MathUtils.smoothstep(vPos.y, 0.0, 0.24);
    shade *= 0.87 + 0.13 * groundAO;

    const c = scaleRgb(color, shade);
    b.positions.push(vPos.x, vPos.y, vPos.z);
    b.normals.push(vNorm.x, vNorm.y, vNorm.z);
    b.uvs.push(u, v);
    b.colors.push(c[0], c[1], c[2]);
  }

  if (idxAttr) {
    for (let i = 0; i < idxAttr.count; i++) {
      b.indices.push(baseVertex + idxAttr.getX(i));
    }
  } else {
    for (let i = 0; i < posAttr.count; i++) {
      b.indices.push(baseVertex + i);
    }
  }
}

const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();

function composeMat(
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.Matrix4 {
  _pos.set(x, y, z);
  _euler.set(rx, ry, rz);
  _quat.setFromEuler(_euler);
  _scale.set(sx, sy, sz);
  return _mat4.compose(_pos, _quat, _scale);
}

// Reusable unit primitive pool (never mutated, disposed nowhere — tiny static primitives).
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYL_8 = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
const UNIT_CYL_10 = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
const UNIT_CYL_6 = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
const UNIT_SPHERE_LOW = new THREE.IcosahedronGeometry(1, 1);
const UNIT_CONE_6 = new THREE.ConeGeometry(1, 1, 6, 1);
const UNIT_OCTA = new THREE.OctahedronGeometry(1, 1);

function addBox(
  b: MeshBuilder,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: RGB,
  quad: AtlasQuad,
  opts?: { rx?: number; ry?: number; rz?: number; aoBottom?: number; aoTop?: number; aoMinY?: number; aoMaxY?: number },
) {
  appendGeometry(
    b,
    UNIT_BOX,
    composeMat(x, y, z, opts?.rx ?? 0, opts?.ry ?? 0, opts?.rz ?? 0, w, h, d),
    color,
    quad,
    {
      aoBottom: opts?.aoBottom,
      aoTop: opts?.aoTop,
      aoMinY: opts?.aoMinY ?? y - h * 0.5,
      aoMaxY: opts?.aoMaxY ?? y + h * 0.5,
    },
  );
}

function addCyl(
  b: MeshBuilder,
  radius: number,
  height: number,
  x: number,
  y: number,
  z: number,
  color: RGB,
  quad: AtlasQuad,
  opts?: { segs?: 6 | 8 | 10; rx?: number; ry?: number; rz?: number; aoBottom?: number; aoTop?: number },
) {
  const geo = opts?.segs === 6 ? UNIT_CYL_6 : opts?.segs === 10 ? UNIT_CYL_10 : UNIT_CYL_8;
  appendGeometry(
    b,
    geo,
    composeMat(x, y, z, opts?.rx ?? 0, opts?.ry ?? 0, opts?.rz ?? 0, radius, height, radius),
    color,
    quad,
    {
      aoBottom: opts?.aoBottom,
      aoTop: opts?.aoTop,
      aoMinY: y - height * 0.5,
      aoMaxY: y + height * 0.5,
    },
  );
}

function addBlob(
  b: MeshBuilder,
  rx: number,
  ry: number,
  rz: number,
  x: number,
  y: number,
  z: number,
  color: RGB,
  quad: AtlasQuad,
  rotY = 0,
  rotZ = 0,
) {
  appendGeometry(b, UNIT_SPHERE_LOW, composeMat(x, y, z, 0, rotY, rotZ, rx, ry, rz), color, quad, {
    aoBottom: 0.78,
    aoTop: 1.06,
    aoMinY: y - ry,
    aoMaxY: y + ry,
  });
}

/** Add a genuine extruded 2D architectural shape (e.g. Moon Gate wall, Arched arcade wall, Octagonal leak window). */
function addExtrudedWall(
  b: MeshBuilder,
  shape: THREE.Shape,
  depth: number,
  x: number,
  y: number,
  zCenter: number,
  color: RGB,
  quad: AtlasQuad,
  opts?: {
    ry?: number;
    aoBottom?: number;
    aoTop?: number;
    aoMinY?: number;
    aoMaxY?: number;
    curveSegments?: number;
  },
) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: opts?.curveSegments ?? 18,
  });
  geo.translate(0, 0, -depth * 0.5);
  // Normalize UVs to world-meter scale (~0.35 repeat per meter) for clean plaster/tile texture mapping.
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * 0.36, uv.getY(i) * 0.36);
  }
  appendGeometry(b, geo, composeMat(x, y, zCenter, 0, opts?.ry ?? 0, 0, 1, 1, 1), color, quad, {
    aoBottom: opts?.aoBottom ?? 0.88,
    aoTop: opts?.aoTop ?? 1.0,
    aoMinY: opts?.aoMinY ?? 0,
    aoMaxY: opts?.aoMaxY ?? 2.6,
  });
  geo.dispose();
}

/** Add a pitched clay-tile roof coping along X (centered at x, ridge at y, depth d). */
function addTiledWallCopingX(
  b: MeshBuilder,
  xCenter: number,
  yBase: number,
  zCenter: number,
  length: number,
  depth: number,
  tileColor: RGB,
  ribColor: RGB,
  ridgeColor: RGB,
  pitch = 0.30,
  ribSpacing = 0.28,
) {
  const halfDepth = depth * 0.52;
  const slopeThick = 0.055;
  const slopeOffsetY = Math.sin(pitch) * halfDepth * 0.45;
  // Front & back pitched tile skirts.
  addBox(b, length, slopeThick, halfDepth, xCenter, yBase + slopeOffsetY, zCenter + halfDepth * 0.46, tileColor, 3, {
    rx: pitch,
    aoBottom: 0.90,
    aoTop: 1.04,
  });
  addBox(b, length, slopeThick, halfDepth, xCenter, yBase + slopeOffsetY, zCenter - halfDepth * 0.46, scaleRgb(tileColor, 0.92), 3, {
    rx: -pitch,
    aoBottom: 0.88,
    aoTop: 1.02,
  });
  // Crisp ridge beam along the crest.
  addBox(b, length + 0.06, 0.09, 0.11, xCenter, yBase + slopeOffsetY + 0.075, zCenter, ridgeColor, 0, {
    aoBottom: 0.94,
    aoTop: 1.06,
  });
  // Barrel tile ribs along the front eave face so silhouette reads unmistakably tiled.
  const ribCount = Math.max(3, Math.round(length / ribSpacing));
  for (let i = 0; i <= ribCount; i++) {
    const rx = xCenter - length * 0.5 + 0.05 + (i / ribCount) * Math.max(0.1, length - 0.10);
    addCyl(b, 0.026, halfDepth * 1.04, rx, yBase + slopeOffsetY + 0.028, zCenter + halfDepth * 0.48, ribColor, 3, {
      segs: 6,
      rx: Math.PI * 0.5 + pitch,
    });
  }
}

/** Add a pitched clay-tile roof coping along Z (for left L-wing return walls). */
function addTiledWallCopingZ(
  b: MeshBuilder,
  xCenter: number,
  yBase: number,
  zCenter: number,
  length: number,
  depth: number,
  tileColor: RGB,
  ribColor: RGB,
  ridgeColor: RGB,
  pitch = 0.30,
  ribSpacing = 0.30,
) {
  const halfDepth = depth * 0.52;
  const slopeThick = 0.055;
  const slopeOffsetY = Math.sin(pitch) * halfDepth * 0.45;
  addBox(b, halfDepth, slopeThick, length, xCenter + halfDepth * 0.46, yBase + slopeOffsetY, zCenter, tileColor, 3, {
    rz: -pitch,
    aoBottom: 0.90,
    aoTop: 1.04,
  });
  addBox(b, halfDepth, slopeThick, length, xCenter - halfDepth * 0.46, yBase + slopeOffsetY, zCenter, scaleRgb(tileColor, 0.92), 3, {
    rz: pitch,
    aoBottom: 0.88,
    aoTop: 1.02,
  });
  addBox(b, 0.11, 0.09, length + 0.06, xCenter, yBase + slopeOffsetY + 0.075, zCenter, ridgeColor, 0, {
    aoBottom: 0.94,
    aoTop: 1.06,
  });
  const ribCount = Math.max(3, Math.round(length / ribSpacing));
  for (let i = 0; i <= ribCount; i++) {
    const rz = zCenter - length * 0.5 + 0.05 + (i / ribCount) * Math.max(0.1, length - 0.10);
    addCyl(b, 0.026, halfDepth * 1.04, xCenter + halfDepth * 0.48, yBase + slopeOffsetY + 0.028, rz, ribColor, 3, {
      segs: 6,
      rz: Math.PI * 0.5 - pitch,
    });
  }
}

/** Push a pointed lanceolate bamboo leaf fan (3 slender tapered leaf blades fanning downward from a twig). */
function addBambooLeafSpray(
  b: MeshBuilder,
  x: number,
  y: number,
  z: number,
  yaw: number,
  scale: number,
  color: RGB,
) {
  const leafAngles = [-0.46, 0, 0.44];
  const leafDroops = [0.22, 0.34, 0.24];
  const leafLens = [0.30, 0.36, 0.29];
  for (let k = 0; k < 3; k++) {
    const a = yaw + leafAngles[k]!;
    const droop = leafDroops[k]!;
    const len = leafLens[k]! * scale;
    const hw = 0.034 * scale;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Pointed diamond leaf blade rendered double-sided via 2 back-to-back triangles so it reads crisply from every camera angle.
    const midX = x + cos * len * 0.42;
    const midY = y - droop * len * 0.24 + 0.025 * scale;
    const midZ = z + sin * len * 0.42;
    const tipX = x + cos * len;
    const tipY = y - droop * len;
    const tipZ = z + sin * len;
    const sideX = -sin * hw;
    const sideZ = cos * hw;

    const rootCol = scaleRgb(color, 0.86);
    const tipCol = scaleRgb(color, 1.10);
    const base = b.positions.length / 3;
    const push = (px: number, py: number, pz: number, ny: number, col: RGB) => {
      b.positions.push(px, py, pz);
      b.normals.push(0, ny, 0.25);
      b.uvs.push(0.25, 0.25);
      b.colors.push(col[0], col[1], col[2]);
    };
    push(x, y, z, 0.96, rootCol);
    push(midX + sideX, midY, midZ + sideZ, 0.96, color);
    push(tipX, tipY, tipZ, 0.96, tipCol);
    push(midX - sideX, midY, midZ - sideZ, 0.96, color);
    // Top + underside winding so slender angled leaves never disappear from below.
    b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    b.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

/** Add a slender bamboo grove cluster (segmented culms with dark nodes + feathery pointed lanceolate leaf sprays). */
function addBambooClump(
  b: MeshBuilder,
  baseX: number,
  baseZ: number,
  stalkCount: number,
  maxHeight: number,
  seed: number,
) {
  const culmBase = parseHex('#547b3f');
  const culmTop = parseHex('#789c4f');
  const nodeColor = parseHex('#3e5a30');
  const leafDark = parseHex('#4a7638');
  const leafLight = parseHex('#7fa84f');

  for (let i = 0; i < stalkCount; i++) {
    const ox = (hash2(seed + i, 3) - 0.5) * 0.72;
    const oz = (hash2(seed + i, 7) - 0.5) * 0.46;
    const h = maxHeight * (0.68 + hash2(seed + i, 11) * 0.36);
    const r = 0.022 + hash2(seed + i, 17) * 0.010;
    const leanX = (hash2(seed + i, 23) - 0.5) * 0.14;
    const leanZ = (hash2(seed + i, 29) - 0.42) * 0.12;
    const segs = 4;
    let cx = baseX + ox;
    let cy = -0.02;
    let cz = baseZ + oz;

    for (let s = 0; s < segs; s++) {
      const segH = h / segs;
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const col = mixRgb(culmBase, culmTop, (t0 + t1) * 0.5);
      const tiltX = leanZ * (0.4 + t1 * 0.8);
      const tiltZ = -leanX * (0.4 + t1 * 0.8);
      const nx = cx + leanX * segH * (0.4 + t1 * 0.8);
      const ny = cy + segH;
      const nz = cz + leanZ * segH * (0.4 + t1 * 0.8);
      addCyl(b, r * (1 - t0 * 0.28), segH * 1.03, (cx + nx) * 0.5, (cy + ny) * 0.5, (cz + nz) * 0.5, col, 1, {
        segs: 6,
        rx: tiltX,
        rz: tiltZ,
      });
      if (s < segs - 1) {
        addCyl(b, r * (1 - t1 * 0.22) * 1.18, 0.022, nx, ny, nz, nodeColor, 1, { segs: 6 });
      }
      // Feathery pointed bamboo leaf sprays emerging from upper nodes.
      if (s >= 1) {
        const sprays = s === segs - 1 ? 4 : s === segs - 2 ? 3 : 2;
        for (let k = 0; k < sprays; k++) {
          const ang = hash2(seed + i * 7 + s, k * 13) * Math.PI * 2;
          const twigLen = 0.10 + hash2(seed + i * 5 + s, k * 19) * 0.12;
          const lx = nx + Math.cos(ang) * twigLen;
          const ly = ny + (hash2(seed + i, k * 23) - 0.35) * 0.12;
          const lz = nz + Math.sin(ang) * twigLen;
          const lCol = mixRgb(leafDark, leafLight, 0.30 + hash2(seed + k, i * 11) * 0.70);
          const sc = 0.85 + hash2(seed + i, k * 29) * 0.45;
          addBambooLeafSpray(b, lx, ly, lz, ang, sc, lCol);
        }
      }
      cx = nx;
      cy = ny;
      cz = nz;
    }
  }
}

/** Add a mossy volcanic/granite or Taihu garden boulder cluster. */
function addGardenBoulder(
  b: MeshBuilder,
  x: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  stoneColor: RGB,
  mossColor: RGB | null,
  rotY: number,
) {
  const geo = UNIT_OCTA;
  appendGeometry(b, geo, composeMat(x, sy * 0.42, z, 0.08, rotY, -0.05, sx, sy, sz), stoneColor, 2, {
    aoBottom: 0.72,
    aoTop: 1.06,
    aoMinY: 0,
    aoMaxY: sy * 1.3,
  });
  // Secondary lobe for natural rock massing.
  appendGeometry(
    b,
    geo,
    composeMat(x + Math.cos(rotY) * sx * 0.52, sy * 0.28, z + Math.sin(rotY) * sz * 0.45, -0.1, rotY + 0.9, 0.12, sx * 0.65, sy * 0.64, sz * 0.7),
    scaleRgb(stoneColor, 0.93),
    2,
    { aoBottom: 0.74, aoTop: 1.02, aoMinY: 0, aoMaxY: sy },
  );
  if (mossColor) {
    addBlob(b, sx * 0.76, sy * 0.22, sz * 0.72, x, sy * 0.84, z, mossColor, 0, rotY + 0.3);
  }
}

/**
 * ============================================================================
 * SKIN 1: JAPANESE KARESANSUI / TIMBER EAVE & BAMBOO-STONE COURTYARD
 * ============================================================================
 */
function buildJapaneseKaresansuiCourtyard(
  s: MeshBuilder,
  g: MeshBuilder,
  compactWing: boolean,
) {
  const wallZ = -4.95;
  const cedarDark = parseHex('#4c392b');
  const cedarMid = parseHex('#634b38');
  const cedarWarm = parseHex('#7c6047');
  const shojiCream = parseHex('#ece3cf');
  const plasterWarm = parseHex('#e4dccb');
  const tileDark = parseHex('#4a5058');
  const tileMid = parseHex('#5d646d');
  const tileRib = parseHex('#6a727c');
  const graniteBase = parseHex('#928e86');
  const graniteLight = parseHex('#aba79e');
  const bambooA = parseHex('#a29468');
  const bambooB = parseHex('#93875e');
  const bambooRail = parseHex('#877a54');
  const ropeBlack = parseHex('#2e2a27');
  const mossCap = parseHex('#698b44');
  const lanternStone = parseHex('#a29e95');
  const lanternRoof = parseHex('#8d8b82');
  const lanternGlow = parseHex('#f5e5c0');

  const wingFrontZ = compactWing ? -3.95 : -2.55;

  // 1) Back-Left Engawa / Timber Pavilion Corner (x ∈ [-4.85, -2.05], z = -4.95)
  // Stone foundation plinth + plaster base wall + warm shoji sliding screen panel.
  addBox(s, 2.86, 0.36, 0.30, -3.45, 0.16, wallZ, graniteBase, 2);
  addBox(s, 2.76, 0.56, 0.20, -3.45, 0.62, wallZ, plasterWarm, 0, { aoBottom: 0.88, aoTop: 1.0 });
  // Translucent shoji panel inset + vertical & horizontal cedar kumiko muntins.
  addBox(s, 2.52, 1.38, 0.08, -3.45, 1.56, wallZ + 0.01, shojiCream, 0, { aoBottom: 0.90, aoTop: 1.0 });
  for (const px of [-4.72, -3.45, -2.18]) {
    addBox(s, 0.14, 2.52, 0.16, px, 1.24, wallZ + 0.04, cedarDark, 1);
  }
  addBox(s, 2.84, 0.12, 0.20, -3.45, 0.92, wallZ + 0.04, cedarMid, 1);
  addBox(s, 2.84, 0.14, 0.22, -3.45, 2.26, wallZ + 0.05, cedarDark, 1);
  for (let i = 0; i < 7; i++) {
    const mx = -4.55 + i * 0.37;
    addBox(s, 0.028, 1.32, 0.04, mx, 1.58, wallZ + 0.055, cedarWarm, 1);
  }
  for (const my of [1.22, 1.58, 1.92]) {
    addBox(s, 2.56, 0.028, 0.04, -3.45, my, wallZ + 0.055, cedarWarm, 1);
  }
  // Low projecting cedar engawa veranda ledge at base of back-left pavilion.
  addBox(s, 2.72, 0.10, 0.62, -3.45, 0.32, wallZ + 0.40, cedarWarm, 1);
  for (const px of [-4.45, -3.45, -2.45]) {
    addBox(s, 0.10, 0.30, 0.10, px, 0.13, wallZ + 0.62, cedarDark, 1);
  }

  // Overhanging pitched kawara clay-tile roof eave cantilevering gently into upper-left portrait view (x → -1.78).
  const eaveLenX = 3.36;
  const eaveCenterX = -3.42;
  const eavePitch = 0.28;
  // Timber roof soffit + exposed rafter tails (垂木).
  addBox(s, eaveLenX, 0.07, 1.48, eaveCenterX, 2.58, wallZ + 0.36, cedarMid, 1, { rx: eavePitch });
  for (let i = 0; i < 12; i++) {
    const rx = eaveCenterX - eaveLenX * 0.47 + (i / 11) * (eaveLenX * 0.94);
    addBox(s, 0.045, 0.06, 1.56, rx, 2.52, wallZ + 0.38, cedarDark, 1, { rx: eavePitch });
  }
  // Main charcoal kawara tiled roof slope + cylindrical barrel-tile ribs + round eave-end medallions.
  addBox(s, eaveLenX + 0.10, 0.075, 1.58, eaveCenterX, 2.66, wallZ + 0.34, tileDark, 3, {
    rx: eavePitch,
    aoBottom: 0.92,
    aoTop: 1.06,
  });
  for (let i = 0; i <= 14; i++) {
    const rx = eaveCenterX - eaveLenX * 0.48 + (i / 14) * (eaveLenX * 0.96);
    addCyl(s, 0.032, 1.60, rx, 2.71, wallZ + 0.35, i % 2 === 0 ? tileRib : tileMid, 3, {
      segs: 6,
      rx: Math.PI * 0.5 + eavePitch,
    });
    // Crisp circular eave-end medallion (軒丸瓦) facing the viewer.
    addCyl(s, 0.036, 0.025, rx, 2.49, wallZ + 1.12, graniteLight, 2, { segs: 6, rx: Math.PI * 0.5 });
  }
  // Ridge beam (棟) with raised end tiles.
  addBox(s, eaveLenX + 0.16, 0.14, 0.18, eaveCenterX, 2.94, wallZ - 0.34, tileMid, 3);
  addBox(s, 0.14, 0.24, 0.22, eaveCenterX + eaveLenX * 0.5 + 0.02, 3.00, wallZ - 0.34, tileRib, 2);

  // 2) Left L-Wing Return (along x = -4.65 from z = -4.95 forward to wingFrontZ)
  const wingLen = Math.abs(wallZ - wingFrontZ);
  const wingCenterZ = (wallZ + wingFrontZ) * 0.5;
  addBox(s, 0.28, 0.34, wingLen + 0.14, -4.65, 0.15, wingCenterZ, graniteBase, 2);
  addBox(s, 0.18, 1.98, wingLen, -4.65, 1.28, wingCenterZ, plasterWarm, 0, { aoBottom: 0.86, aoTop: 1.0 });
  addBox(s, 0.16, 2.38, 0.16, -4.65, 1.18, wingFrontZ, cedarDark, 1);
  addBox(s, 0.20, 0.12, wingLen + 0.1, -4.65, 2.24, wingCenterZ, cedarDark, 1);
  addTiledWallCopingZ(s, -4.65, 2.32, wingCenterZ, wingLen + 0.36, 0.72, tileDark, tileRib, tileMid, 0.28, 0.28);

  // 3) Woven Yotsume-gaki Bamboo Fence: center-left (x ∈ [-2.12, +0.30]) & stepped right wing (x ∈ [+2.66, +6.35])
  const addBambooFenceSpan = (xStart: number, xEnd: number, height: number, seedOffset: number) => {
    const len = xEnd - xStart;
    const cx = (xStart + xEnd) * 0.5;
    // Cut-granite foundation curb under bamboo fence.
    addBox(s, len + 0.06, 0.20, 0.22, cx, 0.08, wallZ, graniteBase, 2);
    // Vertical bamboo poles (spaced ~0.16m for tactile woven presence).
    const stakeCount = Math.max(4, Math.round(len / 0.165));
    for (let i = 0; i <= stakeCount; i++) {
      const sx = xStart + (i / stakeCount) * len;
      const col = i % 2 === 0 ? bambooA : bambooB;
      const tone = 0.94 + hash2(i + seedOffset, 5) * 0.12;
      addCyl(s, 0.026, height, sx, 0.16 + height * 0.5, wallZ, scaleRgb(col, tone), 1, { segs: 6 });
    }
    // 3 horizontal split-bamboo crossbars + dark hemp rope knots (黒シュロ縄).
    const railYs = [0.36, 0.36 + (height - 0.30) * 0.5, 0.16 + height - 0.12];
    for (const ry of railYs) {
      addCyl(s, 0.024, len + 0.04, cx, ry, wallZ + 0.032, bambooRail, 1, { segs: 6, rz: Math.PI * 0.5 });
      addCyl(s, 0.022, len + 0.04, cx, ry, wallZ - 0.032, scaleRgb(bambooRail, 0.88), 1, { segs: 6, rz: Math.PI * 0.5 });
      const knotStep = Math.max(1, Math.round(stakeCount / 7));
      for (let i = 0; i <= stakeCount; i += knotStep) {
        const kx = xStart + (i / stakeCount) * len;
        addBox(s, 0.052, 0.056, 0.078, kx, ry, wallZ, ropeBlack, 1);
      }
    }
    // Thick protective top bamboo cap rail.
    addCyl(s, 0.036, len + 0.10, cx, 0.16 + height + 0.02, wallZ, cedarWarm, 1, { segs: 8, rz: Math.PI * 0.5 });
    // End posts.
    addBox(s, 0.10, height + 0.24, 0.10, xStart, (height + 0.20) * 0.5, wallZ, cedarDark, 1);
    addBox(s, 0.10, height + 0.24, 0.10, xEnd, (height + 0.20) * 0.5, wallZ, cedarDark, 1);
  };
  addBambooFenceSpan(-2.12, 0.28, 1.14, 11);
  addBambooFenceSpan(2.68, 6.28, 1.06, 47);

  // 4) Open Timber Garden Gate (中門) centered at x = +1.48 (aligned to stone road, calm height below Torii kasagi)
  const gateCx = 1.48;
  const gateHalf = 1.18; // clear width ~2.20m between posts
  for (const side of [-1, 1] as const) {
    const gx = gateCx + side * gateHalf;
    // Carved granite column base plinth + cedar pillar + upper brace bracket.
    addBox(s, 0.24, 0.24, 0.24, gx, 0.10, wallZ, graniteBase, 2);
    addBox(s, 0.15, 2.12, 0.15, gx, 1.24, wallZ, cedarDark, 1);
    addBox(s, 0.12, 0.12, 0.44, gx, 2.14, wallZ, cedarMid, 1);
    // Low ajar bamboo-lattice swing gate leaf swung gracefully open beside each post.
    const leafW = 0.52;
    const leafAngle = side === -1 ? 0.85 : -0.78;
    const lx = gx - side * (0.09 + Math.cos(leafAngle) * leafW * 0.5);
    const lz = wallZ - Math.abs(Math.sin(leafAngle)) * leafW * 0.5;
    addBox(s, leafW, 0.04, 0.04, lx, 0.34, lz, cedarMid, 1, { ry: leafAngle });
    addBox(s, leafW, 0.04, 0.04, lx, 1.06, lz, cedarMid, 1, { ry: leafAngle });
    for (let k = -2; k <= 2; k++) {
      const f = (k / 2) * (leafW * 0.42);
      const sx = lx + Math.cos(leafAngle) * f;
      const sz = lz - Math.sin(leafAngle) * f;
      addCyl(s, 0.016, 0.84, sx, 0.70, sz, bambooA, 1, { segs: 6 });
    }
  }
  // Gate lintel beams (貫 & 冠木).
  addBox(s, gateHalf * 2 + 0.56, 0.13, 0.16, gateCx, 2.24, wallZ, cedarDark, 1);
  addBox(s, gateHalf * 2 + 0.28, 0.085, 0.12, gateCx, 2.02, wallZ, cedarMid, 1);
  // Pitched kawara-tile gate rain-hood roof.
  addTiledWallCopingX(s, gateCx, 2.34, wallZ, 3.16, 0.94, tileDark, tileRib, tileMid, 0.30, 0.26);

  // 5) Hero Sculpted 3-Legged Yukimi-dōrō Snow-Viewing Stone Lantern (雪見灯籠) at (-1.94, -4.22)
  const lx = -1.94;
  const lz = -4.22;
  // Flat mossy foundation stone slab.
  addCyl(s, 0.38, 0.10, lx, 0.04, lz, graniteBase, 2, { segs: 8 });
  // Three arched granite legs.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.45;
    const legX = lx + Math.cos(a) * 0.19;
    const legZ = lz + Math.sin(a) * 0.19;
    addBox(s, 0.09, 0.48, 0.09, legX, 0.30, legZ, lanternStone, 2, {
      rx: Math.sin(a) * 0.24,
      rz: -Math.cos(a) * 0.24,
    });
  }
  // Hexagonal stone platform (中台) + carved firebox pillars (火袋).
  addCyl(s, 0.32, 0.10, lx, 0.56, lz, lanternStone, 2, { segs: 6 });
  addCyl(s, 0.24, 0.06, lx, 0.63, lz, graniteLight, 2, { segs: 6 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addBox(s, 0.045, 0.30, 0.045, lx + Math.cos(a) * 0.155, 0.80, lz + Math.sin(a) * 0.155, lanternStone, 2, { ry: -a });
  }
  // Warm glowing firebox core (separate glow mesh for night Bloom!).
  addCyl(g, 0.12, 0.24, lx, 0.80, lz, lanternGlow, 0, { segs: 6 });
  // Broad hexagonal pagoda umbrella roof (笠) + moss accent + lotus finial (宝珠).
  appendGeometry(s, UNIT_CONE_6, composeMat(lx, 1.10, lz, 0, Math.PI / 6, 0, 0.56, 0.32, 0.56), lanternRoof, 2, {
    aoBottom: 0.86,
    aoTop: 1.06,
    aoMinY: 0.94,
    aoMaxY: 1.26,
  });
  addCyl(s, 0.54, 0.055, lx, 0.96, lz, lanternStone, 2, { segs: 6, ry: Math.PI / 6 });
  // Subtle green moss cushion resting on top slope of the stone lantern umbrella.
  addBlob(s, 0.18, 0.045, 0.14, lx - 0.14, 1.08, lz + 0.10, mossCap, 0, 0.5);
  addCyl(s, 0.075, 0.06, lx, 1.27, lz, lanternStone, 2, { segs: 6 });
  addBlob(s, 0.068, 0.095, 0.068, lx, 1.35, lz, graniteLight, 2);

  // 6) Mossy Kyoto Garden Rocks & Arching Bamboo Grove behind the fence.
  addGardenBoulder(s, -2.78, -4.34, 0.44, 0.34, 0.32, graniteBase, mossCap, 0.4);
  addGardenBoulder(s, -1.28, -4.48, 0.28, 0.21, 0.24, scaleRgb(graniteBase, 0.94), mossCap, -0.7);
  addGardenBoulder(s, 3.22, -4.38, 0.48, 0.36, 0.35, graniteBase, mossCap, 1.2);
  addGardenBoulder(s, 3.85, -4.46, 0.29, 0.22, 0.24, graniteLight, null, -0.3);

  addBambooClump(s, -2.35, -5.42, 5, 3.25, 19);
  addBambooClump(s, -0.35, -5.45, 4, 2.75, 53);
  addBambooClump(s, 3.45, -5.42, 5, 3.10, 89);
}

/**
 * ============================================================================
 * SKIN 2: CHINESE JIANGNAN WHITEWASHED-WALL & DARK-TILE COURTYARD (粉墙黛瓦)
 * ============================================================================
 */
function buildChineseJiangnanCourtyard(
  s: MeshBuilder,
  g: MeshBuilder,
  compactWing: boolean,
) {
  const wallZ = -4.95;
  const limeWall = parseHex('#ebe5da');
  const limeReveal = parseHex('#dcd5c8');
  const limeRidge = parseHex('#efeae0');
  const plinthStone = parseHex('#787e82');
  const grayBrick = parseHex('#697075');
  const grayBrickLight = parseHex('#7f868a');
  const tileDark = parseHex('#444b52');
  const tileMid = parseHex('#586068');
  const tileRib = parseHex('#677078');
  const timberChestnut = parseHex('#5c382c');
  const timberWarm = parseHex('#734838');
  const taihuRock = parseHex('#adb0ac');
  const mossGreen = parseHex('#5d8140');
  const lanternGlow = parseHex('#f5e5bf');

  const wallThick = 0.28;
  const wingFrontZ = compactWing ? -3.95 : -2.55;

  // 1) Main Back Whitewashed Wall (x ∈ [-4.72, +3.08], h = 2.52) with TWO genuine open voids:
  //    - Circular Moon Gate (月洞门) centered at x = +1.48, y = 0.88, r = 1.32 (ground chord 1.97m, crown 2.20m)
  //    - Octagonal Begonia Leak Window (八角花窗) centered at x = -1.42, y = 1.38, r = 0.56
  const gateCx = 1.48;
  const gateR = 1.32;
  const gateCy = 0.88;
  const gateAlpha = Math.asin(gateCy / gateR); // 0.7297 rad below horizontal at y = 0
  const gateGroundHalf = Math.cos(gateAlpha) * gateR; // ~0.984m -> 1.97m threshold aligned to stone path
  const gateAngleLeft = Math.PI + gateAlpha;
  const gateAngleRight = -gateAlpha;
  const winCx = -1.42;
  const winCy = 1.38;
  const winR = 0.56;

  // Left-to-gate main wall segment (x ∈ [-4.72, +3.08]) with circular Moon Gate carved out cleanly.
  const mainWall = new THREE.Shape();
  mainWall.moveTo(-4.72, -0.04);
  mainWall.lineTo(gateCx - gateGroundHalf, -0.04);
  const archSegs = 30;
  for (let i = 0; i <= archSegs; i++) {
    const a = gateAngleLeft - (i / archSegs) * (gateAngleLeft - gateAngleRight);
    const px = gateCx + Math.cos(a) * gateR;
    const py = Math.max(-0.04, gateCy + Math.sin(a) * gateR);
    mainWall.lineTo(px, py);
  }
  mainWall.lineTo(gateCx + gateGroundHalf, -0.04);
  mainWall.lineTo(3.08, -0.04);
  mainWall.lineTo(3.08, 2.52);
  mainWall.lineTo(-2.55, 2.52);
  // Subtle upward step at the back-left corner pavilion wall (马头墙层次).
  mainWall.lineTo(-2.55, 2.80);
  mainWall.lineTo(-4.72, 2.80);
  mainWall.closePath();

  // Genuine open octagonal leak window hole at (-1.42, 1.38) in CW order so inner reveals face inward.
  const winHole = new THREE.Path();
  for (let i = 7; i >= 0; i--) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const wx = winCx + Math.cos(a) * winR;
    const wy = winCy + Math.sin(a) * winR;
    if (i === 7) winHole.moveTo(wx, wy);
    else winHole.lineTo(wx, wy);
  }
  winHole.closePath();
  mainWall.holes.push(winHole);

  addExtrudedWall(s, mainWall, wallThick, 0, 0, wallZ, limeWall, 0, {
    aoBottom: 0.87,
    aoTop: 1.0,
    aoMinY: 0,
    aoMaxY: 2.80,
  });

  // Gray-brick base plinth (勒脚) flanking left and right of Moon Gate threshold.
  const leftPlinthEnd = gateCx - gateGroundHalf - 0.04;
  const leftPlinthW = leftPlinthEnd - -4.72;
  addBox(s, leftPlinthW, 0.36, wallThick + 0.06, -4.72 + leftPlinthW * 0.5, 0.16, wallZ, plinthStone, 2);
  const rightPlinthStart = gateCx + gateGroundHalf + 0.04;
  const rightPlinthW = Math.max(0.24, 3.08 - rightPlinthStart);
  addBox(s, rightPlinthW, 0.36, wallThick + 0.06, rightPlinthStart + rightPlinthW * 0.5, 0.16, wallZ, plinthStone, 2);

  // Carved Gray-Brick Circular Moon Gate Ring Surround (青砖月洞门券).
  const ringSegs = 28;
  for (let i = 0; i < ringSegs; i++) {
    const a0 = gateAngleLeft - (i / ringSegs) * (gateAngleLeft - gateAngleRight);
    const a1 = gateAngleLeft - ((i + 1) / ringSegs) * (gateAngleLeft - gateAngleRight);
    const aMid = (a0 + a1) * 0.5;
    const rMid = gateR + 0.055;
    const segLen = Math.abs(a1 - a0) * rMid + 0.016;
    const bx = gateCx + Math.cos(aMid) * rMid;
    const by = gateCy + Math.sin(aMid) * rMid;
    if (by < 0.03) continue;
    addBox(
      s,
      segLen,
      0.13,
      wallThick + 0.075,
      bx,
      by,
      wallZ,
      i % 2 === 0 ? grayBrick : grayBrickLight,
      2,
      { rz: aMid - Math.PI * 0.5 },
    );
  }
  // Bluestone cheek plinth blocks anchoring the circular Moon Gate curve into the earth.
  addBox(s, 0.22, 0.24, wallThick + 0.10, gateCx - gateGroundHalf - 0.06, 0.10, wallZ, plinthStone, 2);
  addBox(s, 0.22, 0.24, wallThick + 0.10, gateCx + gateGroundHalf + 0.06, 0.10, wallZ, plinthStone, 2);

  // Octagonal Gray-Brick Window Frame + Carved Traditional Lattice Tracery (八角海棠花窗).
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const a1 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
    const aMid = (a0 + a1) * 0.5;
    const rOuter = winR + 0.035;
    const sideLen = 2 * rOuter * Math.sin(Math.PI / 8) + 0.03;
    addBox(
      s,
      sideLen,
      0.085,
      wallThick + 0.06,
      winCx + Math.cos(aMid) * (winR + 0.015),
      winCy + Math.sin(aMid) * (winR + 0.015),
      wallZ,
      grayBrick,
      2,
      { rz: aMid + Math.PI * 0.5 },
    );
  }
  // Delicate open geometric begonia / ice-ray tracery inside the window aperture.
  const barThick = 0.030;
  const barDepth = 0.09;
  addBox(s, winR * 1.88, barThick, barDepth, winCx, winCy, wallZ, grayBrickLight, 2);
  addBox(s, barThick, winR * 1.88, barDepth, winCx, winCy, wallZ, grayBrickLight, 2);
  addBox(s, winR * 1.48, barThick, barDepth, winCx, winCy, wallZ, grayBrick, 2, { rz: Math.PI / 4 });
  addBox(s, winR * 1.48, barThick, barDepth, winCx, winCy, wallZ, grayBrick, 2, { rz: -Math.PI / 4 });
  // Central diamond & inner ring motif (海棠菱格).
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    addBox(s, 0.34, barThick, barDepth, winCx + Math.cos(a) * 0.16, winCy + Math.sin(a) * 0.16, wallZ, limeReveal, 2, {
      rz: a + Math.PI / 2,
    });
  }

  // 2) Stepped Low Right Wing Wall (x ∈ [+3.06, +6.36], h = 1.46) so sky & mountains open wide on the right.
  addBox(s, 3.30, 0.32, wallThick + 0.05, 4.71, 0.14, wallZ, plinthStone, 2);
  addBox(s, 3.28, 1.18, wallThick, 4.71, 0.87, wallZ, limeWall, 0, { aoBottom: 0.88, aoTop: 1.0 });
  // Decorative gray-brick coping trim + pitched charcoal tile coping + white lime ridge (黛瓦粉脊).
  addBox(s, 5.74, 0.07, wallThick + 0.10, 0.27, 2.53, wallZ, grayBrick, 2);
  addTiledWallCopingX(s, 0.27, 2.58, wallZ, 5.82, 0.68, tileDark, tileRib, limeRidge, 0.28, 0.27);
  addBox(s, 3.34, 0.07, wallThick + 0.10, 4.71, 1.47, wallZ, grayBrick, 2);
  addTiledWallCopingX(s, 4.71, 1.52, wallZ, 3.42, 0.62, tileDark, tileRib, limeRidge, 0.28, 0.28);
  // Higher back-left wall crest coping.
  addBox(s, 2.30, 0.07, wallThick + 0.10, -3.65, 2.81, wallZ, grayBrick, 2);
  addTiledWallCopingX(s, -3.65, 2.86, wallZ, 2.38, 0.72, tileDark, tileRib, limeRidge, 0.28, 0.26);

  // 3) Left L-Wing Return Wall (along x = -4.65 from z = -4.95 forward to wingFrontZ)
  const wingLen = Math.abs(wallZ - wingFrontZ);
  const wingCenterZ = (wallZ + wingFrontZ) * 0.5;
  addBox(s, wallThick + 0.06, 0.34, wingLen + 0.16, -4.65, 0.15, wingCenterZ, plinthStone, 2);
  addBox(s, wallThick, 2.08, wingLen, -4.65, 1.32, wingCenterZ, limeWall, 0, { aoBottom: 0.86, aoTop: 1.0 });
  addBox(s, wallThick + 0.10, 0.07, wingLen + 0.16, -4.65, 2.38, wingCenterZ, grayBrick, 2);
  addTiledWallCopingZ(s, -4.65, 2.43, wingCenterZ, wingLen + 0.32, 0.68, tileDark, tileRib, limeRidge, 0.28, 0.28);
  // Crisp vertical end-pier column at wing tip.
  addBox(s, wallThick + 0.08, 2.42, 0.24, -4.65, 1.21, wingFrontZ, limeReveal, 0);

  // 4) Upturned Jiangnan Corner Pavilion Eave (飞檐翘角) framing upper-left corner!
  // Chestnut timber column + carved tie beam + concave projecting charcoal-tile corner roof.
  addCyl(s, 0.085, 2.48, -2.62, 1.24, wallZ + 0.62, timberChestnut, 1, { segs: 8 });
  addCyl(s, 0.13, 0.16, -2.62, 0.06, wallZ + 0.62, plinthStone, 2, { segs: 8 });
  addBox(s, 2.15, 0.12, 0.12, -3.62, 2.38, wallZ + 0.62, timberChestnut, 1);
  addBox(s, 0.12, 0.12, 0.72, -2.62, 2.38, wallZ + 0.30, timberWarm, 1);
  // Sweeping overhanging charcoal roof eave with upturned winged corner (飞檐).
  addBox(s, 2.52, 0.07, 1.26, -3.56, 2.66, wallZ + 0.42, tileDark, 3, { rx: 0.26 });
  for (let i = 0; i <= 10; i++) {
    const rx = -4.72 + (i / 10) * 2.36;
    addCyl(s, 0.028, 1.30, rx, 2.71, wallZ + 0.44, i % 2 === 0 ? tileRib : tileMid, 3, {
      segs: 6,
      rx: Math.PI * 0.5 + 0.26,
    });
  }
  // Graceful upturned dark-tile corner wing (飞檐翘角) integrated smoothly into the corner eave.
  addBox(s, 0.46, 0.068, 0.42, -2.36, 2.58, wallZ + 0.90, tileDark, 3, { rx: -0.10, ry: 0.28, rz: 0.22 });
  addBox(s, 0.32, 0.055, 0.12, -2.28, 2.66, wallZ + 0.98, tileRib, 3, { ry: 0.28, rz: 0.30 });

  // 5) Carved Chinese Courtyard Stone Lantern (中式六角石灯) at (-2.18, -4.24)
  const lx = -2.18;
  const lz = -4.24;
  addCyl(s, 0.28, 0.12, lx, 0.05, lz, plinthStone, 2, { segs: 6 });
  addCyl(s, 0.10, 0.68, lx, 0.44, lz, grayBrickLight, 2, { segs: 6 });
  addCyl(s, 0.24, 0.09, lx, 0.80, lz, plinthStone, 2, { segs: 6 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addBox(s, 0.036, 0.28, 0.036, lx + Math.cos(a) * 0.135, 0.97, lz + Math.sin(a) * 0.135, grayBrick, 2, { ry: -a });
  }
  addCyl(g, 0.105, 0.23, lx, 0.97, lz, lanternGlow, 0, { segs: 6 });
  appendGeometry(s, UNIT_CONE_6, composeMat(lx, 1.24, lz, 0, Math.PI / 6, 0, 0.42, 0.26, 0.42), tileMid, 3);
  addCyl(s, 0.40, 0.045, lx, 1.12, lz, grayBrick, 2, { segs: 6, ry: Math.PI / 6 });
  addBlob(s, 0.055, 0.085, 0.055, lx, 1.40, lz, limeReveal, 2);

  // 6) Sculpted Taihu Scholar's Limestone Rocks (太湖石) & Emerald Bamboo Grove!
  // Multi-tiered eroded Taihu stone silhouette beside the lantern and right wall.
  addGardenBoulder(s, -2.84, -4.34, 0.36, 0.56, 0.26, taihuRock, mossGreen, 0.35);
  addGardenBoulder(s, -2.56, -4.46, 0.22, 0.34, 0.20, scaleRgb(taihuRock, 1.06), null, -0.5);
  addGardenBoulder(s, 3.32, -4.38, 0.44, 0.62, 0.30, taihuRock, mossGreen, 1.1);
  addGardenBoulder(s, 3.82, -4.46, 0.26, 0.32, 0.24, scaleRgb(taihuRock, 0.94), null, -0.2);

  // Emerald bamboo peeking directly through the open octagonal leak window and over the right wall!
  addBambooClump(s, -1.52, -5.52, 5, 3.15, 31);
  addBambooClump(s, 3.25, -5.45, 5, 2.95, 73);
  addBambooClump(s, -3.20, -5.48, 3, 3.30, 107);
}

/**
 * ============================================================================
 * SKIN 3: WARM TERRACOTTA ARCH & CITRUS STUCCO COURTYARD (暖陶拱券庭院)
 * ============================================================================
 */
function buildWarmTerracottaArchCourtyard(
  s: MeshBuilder,
  g: MeshBuilder,
  compactWing: boolean,
) {
  const wallZ = -4.95;
  const stuccoWarm = parseHex('#ead8c0');
  const stuccoBlush = parseHex('#dfb08e');
  const terracottaWall = parseHex('#d28962');
  const ochreTrim = parseHex('#d99d50');
  const limestone = parseHex('#d5c7ae');
  const limestoneDark = parseHex('#b9aa90');
  const tileClayA = parseHex('#b96240');
  const tileClayB = parseHex('#ca7550');
  const tileRidge = parseHex('#d7865e');
  const cedarTimber = parseHex('#6a4834');
  const azulejoBlue = parseHex('#3b6d96');
  const azulejoCream = parseHex('#ece2ce');
  const clayPot = parseHex('#c16a44');
  const clayPotRim = parseHex('#cf7b54');
  const soilDark = parseHex('#4a3829');
  const leafDark = parseHex('#366832');
  const leafBright = parseHex('#5c8d40');
  const orangeA = parseHex('#eb8928');
  const orangeB = parseHex('#f2a238');
  const bougA = parseHex('#c83e69');
  const bougB = parseHex('#dd5a83');
  const bougDark = parseHex('#a63056');
  const bronzeDark = parseHex('#3b322c');
  const lanternGlow = parseHex('#fae2a8');

  const wallThick = 0.32;
  const wingFrontZ = compactWing ? -3.95 : -2.55;

  // 1) Main Sun-Warmed Stucco Arcade Wall (x ∈ [-4.72, +2.92], h = 2.66) with TWO genuine open arches:
  //    - Grand Sunlit Courtyard Archway centered at x = +1.48 (clear width 2.24m, aligned to stone road!)
  //    - Left Patio Window/Loggia Arch centered at x = -1.46 (clear width 1.34m, above 0.54m parapet sill)
  const bigCx = 1.48;
  const bigHalf = 1.12;
  const bigSpringY = 1.38;
  const leftCx = -1.46;
  const leftHalf = 0.67;
  const leftSillY = 0.56;
  const leftSpringY = 1.62;

  const arcadeShape = new THREE.Shape();
  arcadeShape.moveTo(-4.72, -0.04);
  arcadeShape.lineTo(bigCx - bigHalf, -0.04);
  arcadeShape.lineTo(bigCx - bigHalf, bigSpringY);
  const archSteps = 20;
  for (let i = 0; i <= archSteps; i++) {
    const a = Math.PI - (i / archSteps) * Math.PI;
    arcadeShape.lineTo(bigCx + Math.cos(a) * bigHalf, bigSpringY + Math.sin(a) * bigHalf);
  }
  arcadeShape.lineTo(bigCx + bigHalf, -0.04);
  arcadeShape.lineTo(2.92, -0.04);
  arcadeShape.lineTo(2.92, 2.70);
  arcadeShape.lineTo(-2.72, 2.70);
  // Gentle Mediterranean corner parapet step up on back-left.
  arcadeShape.lineTo(-2.72, 2.94);
  arcadeShape.lineTo(-4.72, 2.94);
  arcadeShape.closePath();

  // Genuine open semicircular patio loggia arch on the left (CW order so arch soffits face inward).
  const leftArchHole = new THREE.Path();
  leftArchHole.moveTo(leftCx - leftHalf, leftSillY);
  leftArchHole.lineTo(leftCx - leftHalf, leftSpringY);
  for (let i = 0; i <= archSteps; i++) {
    const a = Math.PI - (i / archSteps) * Math.PI;
    leftArchHole.lineTo(leftCx + Math.cos(a) * leftHalf, leftSpringY + Math.sin(a) * leftHalf);
  }
  leftArchHole.lineTo(leftCx + leftHalf, leftSillY);
  leftArchHole.closePath();
  arcadeShape.holes.push(leftArchHole);

  addExtrudedWall(s, arcadeShape, wallThick, 0, 0, wallZ, stuccoWarm, 0, {
    aoBottom: 0.88,
    aoTop: 1.0,
    aoMinY: 0,
    aoMaxY: 2.94,
  });

  // Dressed limestone plinth + subtle Mediterranean ceramic tile dado stripe along front wall base.
  addBox(s, 5.10, 0.34, wallThick + 0.06, -2.18, 0.15, wallZ, limestone, 2);
  addBox(s, 0.34, 0.34, wallThick + 0.06, 2.77, 0.15, wallZ, limestone, 2);
  // Decorative cobalt/cream/ochre glazed dado band below the left arch sill and piers.
  const tileBandW = 0.22;
  for (let i = 0; i < 22; i++) {
    const tx = -4.54 + i * tileBandW;
    if (tx > bigCx - bigHalf - 0.14) break;
    const col = i % 3 === 0 ? azulejoBlue : i % 3 === 1 ? azulejoCream : ochreTrim;
    addBox(s, tileBandW - 0.015, 0.14, 0.025, tx, 0.42, wallZ + wallThick * 0.5 + 0.012, col, 1);
  }
  // Warm terracotta tiled sill capping the left patio arch parapet.
  addBox(s, leftHalf * 2 + 0.22, 0.075, wallThick + 0.14, leftCx, leftSillY, wallZ, tileClayB, 2);

  // Sculpted ochre archivolt trims, limestone keystones & slender chamfered columns framing BOTH arches!
  const addArchTrim = (cx: number, springY: number, radius: number, segments: number) => {
    for (let i = 0; i < segments; i++) {
      const a0 = Math.PI - (i / segments) * Math.PI;
      const a1 = Math.PI - ((i + 1) / segments) * Math.PI;
      const aMid = (a0 + a1) * 0.5;
      const rMid = radius + 0.065;
      const len = Math.abs(a1 - a0) * rMid + 0.018;
      addBox(
        s,
        len,
        0.13,
        wallThick + 0.075,
        cx + Math.cos(aMid) * rMid,
        springY + Math.sin(aMid) * rMid,
        wallZ,
        i % 2 === 0 ? ochreTrim : stuccoBlush,
        0,
        { rz: aMid - Math.PI * 0.5 },
      );
    }
    // Limestone keystone at the arch apex.
    addBox(s, 0.16, 0.22, wallThick + 0.12, cx, springY + radius + 0.08, wallZ, limestone, 2);
  };
  addArchTrim(bigCx, bigSpringY, bigHalf, 16);
  addArchTrim(leftCx, leftSpringY, leftHalf, 12);

  // Slender octagonal limestone half-columns with stepped capitals flanking the arches.
  const columnPositions: readonly [number, number, number][] = [
    [bigCx - bigHalf - 0.06, 0.0, bigSpringY],
    [bigCx + bigHalf + 0.06, 0.0, bigSpringY],
    [leftCx - leftHalf - 0.04, leftSillY, leftSpringY],
    [leftCx + leftHalf + 0.04, leftSillY, leftSpringY],
  ];
  for (const [cx, y0, y1] of columnPositions) {
    const h = y1 - y0;
    addBox(s, 0.24, 0.12, wallThick + 0.12, cx, y0 + 0.06, wallZ, limestoneDark, 2);
    addCyl(s, 0.088, h - 0.18, cx, (y0 + y1) * 0.5, wallZ + wallThick * 0.34, limestone, 2, { segs: 8 });
    addBox(s, 0.26, 0.12, wallThick + 0.14, cx, y1 - 0.04, wallZ, limestone, 2);
  }

  // 2) Stepped Low Right Wing Wall (x ∈ [+2.90, +6.34], h = 1.38) in warm terracotta-blush stucco.
  addBox(s, 3.46, 0.32, wallThick + 0.06, 4.63, 0.14, wallZ, limestone, 2);
  addBox(s, 3.44, 1.08, wallThick, 4.63, 0.84, wallZ, stuccoBlush, 0, { aoBottom: 0.88, aoTop: 1.0 });
  for (let i = 0; i < 14; i++) {
    const tx = 3.06 + i * 0.24;
    addBox(s, 0.22, 0.13, 0.024, tx, 0.39, wallZ + wallThick * 0.5 + 0.012, i % 2 === 0 ? azulejoBlue : azulejoCream, 1);
  }

  // 3) Terracotta Barrel-Tile Eave Copings & Cedar Rafter Tails (红陶筒瓦檐).
  for (let i = 0; i < 15; i++) {
    const rx = -2.55 + i * 0.38;
    addBox(s, 0.065, 0.075, 0.44, rx, 2.66, wallZ + 0.22, cedarTimber, 1);
  }
  addTiledWallCopingX(s, 0.12, 2.74, wallZ, 5.76, 0.82, tileClayA, tileClayB, tileRidge, 0.26, 0.24);
  addTiledWallCopingX(s, -3.72, 2.98, wallZ, 2.18, 0.82, tileClayA, tileClayB, tileRidge, 0.26, 0.24);
  addTiledWallCopingX(s, 4.63, 1.42, wallZ, 3.58, 0.66, tileClayA, tileClayB, tileRidge, 0.26, 0.25);

  // 4) Left L-Wing Return Wall (along x = -4.65) in sun-baked terracotta plaster.
  const wingLen = Math.abs(wallZ - wingFrontZ);
  const wingCenterZ = (wallZ + wingFrontZ) * 0.5;
  addBox(s, wallThick + 0.06, 0.34, wingLen + 0.16, -4.65, 0.15, wingCenterZ, limestone, 2);
  addBox(s, wallThick, 2.28, wingLen, -4.65, 1.44, wingCenterZ, terracottaWall, 0, { aoBottom: 0.86, aoTop: 1.0 });
  addTiledWallCopingZ(s, -4.65, 2.62, wingCenterZ, wingLen + 0.34, 0.78, tileClayA, tileClayB, tileRidge, 0.26, 0.25);
  addBox(s, wallThick + 0.08, 2.56, 0.24, -4.65, 1.28, wingFrontZ, limestone, 2);

  // 5) Handmade Terracotta Citrus Planters (陶盆柑橘) — Hero Left at (-2.38, -4.24) + Right at (+3.18, -4.28)!
  const addCitrusPlanter = (px: number, pz: number, scale: number, seed: number) => {
    const potH = 0.56 * scale;
    const potR = 0.28 * scale;
    // Turned terracotta pot body + rolled flared rim + base foot + dark soil.
    addCyl(s, potR * 0.78, 0.08 * scale, px, 0.04 * scale, pz, scaleRgb(clayPot, 0.84), 2, { segs: 10 });
    addCyl(s, potR * 0.94, potH * 0.82, px, potH * 0.48, pz, clayPot, 0, { segs: 10, aoBottom: 0.82, aoTop: 1.05 });
    addCyl(s, potR * 1.08, 0.10 * scale, px, potH * 0.92, pz, clayPotRim, 0, { segs: 10 });
    addCyl(s, potR * 0.90, 0.04 * scale, px, potH * 0.94, pz, soilDark, 2, { segs: 10 });
    // Mini citrus tree trunk + forked branches.
    addCyl(s, 0.045 * scale, 0.62 * scale, px, potH + 0.28 * scale, pz, cedarTimber, 1, { segs: 6, rz: 0.05 });
    // Layered crisp-faceted glossy emerald citrus foliage crown.
    const crownBaseY = potH + 0.66 * scale;
    const crownOffsets: readonly [number, number, number, number][] = [
      [0, 0.16, 0, 0.36],
      [-0.24, 0.06, 0.12, 0.27],
      [0.24, 0.08, 0.10, 0.28],
      [-0.12, 0.31, -0.06, 0.25],
      [0.14, 0.29, -0.08, 0.24],
      [0.02, 0.04, 0.22, 0.24],
      [-0.18, 0.22, 0.18, 0.20],
      [0.18, 0.22, 0.16, 0.20],
    ];
    crownOffsets.forEach(([ox, oy, oz, r], idx) => {
      const col = mixRgb(leafDark, leafBright, 0.28 + (idx % 3) * 0.28);
      appendGeometry(
        s,
        UNIT_OCTA,
        composeMat(px + ox * scale, crownBaseY + oy * scale, pz + oz * scale, idx * 0.3, idx * 0.9, idx * 0.2, r * scale, r * 0.82 * scale, r * scale),
        col,
        0,
        { aoBottom: 0.80, aoTop: 1.06, aoMinY: crownBaseY - 0.2, aoMaxY: crownBaseY + 0.55 },
      );
    });
    // Vibrant ripe citrus oranges nestled visibly on the sunlit outer crown!
    const fruitCoords: readonly [number, number, number][] = [
      [-0.26, 0.12, 0.26],
      [-0.08, 0.28, 0.27],
      [0.14, 0.18, 0.28],
      [0.28, 0.06, 0.22],
      [-0.22, -0.04, 0.24],
      [0.04, 0.02, 0.34],
      [0.20, 0.30, 0.18],
      [-0.15, 0.36, 0.12],
    ];
    fruitCoords.forEach(([fx, fy, fz], i) => {
      addBlob(s, 0.056 * scale, 0.054 * scale, 0.056 * scale, px + fx * scale, crownBaseY + fy * scale, pz + fz * scale, (i + seed) % 2 === 0 ? orangeA : orangeB, 0);
    });
  };
  addCitrusPlanter(-2.38, -4.24, 1.04, 17);
  addCitrusPlanter(3.18, -4.28, 0.92, 43);
  // Companion small empty clay amphora beside the hero planter for authentic layered charm.
  addCyl(s, 0.16, 0.30, -2.86, 0.15, -4.34, clayPot, 0, { segs: 8, aoBottom: 0.82, aoTop: 1.05 });
  addCyl(s, 0.19, 0.06, -2.86, 0.31, -4.34, clayPotRim, 0, { segs: 8 });

  // 6) Delicate Cascading Bougainvillea Vine draping over the left terracotta cornice & right parapet!
  // Uses small crisp faceted blossom-bract tufts + pointed emerald leaves instead of heavy smooth spheres.
  const bougVines: readonly [number, number, number, number, number][] = [
    [-2.78, 2.74, -4.60, 0.88, 1],
    [-2.42, 2.66, -4.56, 1.02, 2],
    [-2.04, 2.58, -4.56, 0.94, 3],
    [-1.68, 2.54, -4.60, 0.76, 4],
    [-2.58, 2.34, -4.54, 0.82, 5],
    [-2.24, 2.26, -4.54, 0.72, 6],
    [-2.74, 2.02, -4.56, 0.64, 7],
    [-1.90, 2.34, -4.58, 0.58, 8],
    [3.42, 1.50, -4.64, 0.78, 9],
    [3.78, 1.44, -4.66, 0.68, 10],
  ];
  bougVines.forEach(([bx, by, bz, sc, seed]) => {
    // Pointed emerald leaf sprays tucked behind the magenta bracts.
    for (let l = 0; l < 3; l++) {
      const yaw = (l - 1) * 1.15 + hash2(seed, l * 7) * 0.6;
      addBambooLeafSpray(
        s,
        bx + (hash2(seed, l * 3) - 0.5) * 0.24 * sc,
        by + (hash2(seed, l * 5) - 0.3) * 0.16 * sc,
        bz - 0.04,
        yaw,
        0.58 * sc,
        l % 2 === 0 ? leafDark : leafBright,
      );
    }
    // Delicate cluster of 7 small crisp-faceted papery magenta bougainvillea bracts.
    for (let k = 0; k < 7; k++) {
      const ox = (hash2(seed * 13 + k, 11) - 0.5) * 0.42 * sc;
      const oy = (hash2(seed * 13 + k, 17) - 0.58) * 0.34 * sc;
      const oz = (hash2(seed * 13 + k, 23) - 0.25) * 0.16 * sc;
      const br = (0.068 + hash2(seed * 13 + k, 29) * 0.056) * sc;
      const col = k % 3 === 0 ? bougB : k % 3 === 1 ? bougA : bougDark;
      appendGeometry(
        s,
        UNIT_OCTA,
        composeMat(bx + ox, by + oy, bz + oz + 0.04, k * 0.7, seed + k * 1.1, k * 0.5, br * 1.18, br * 0.85, br * 0.72),
        col,
        0,
        { aoBottom: 0.84, aoTop: 1.08, aoMinY: by - 0.3, aoMaxY: by + 0.3 },
      );
    }
  });

  // 7) Wrought-Bronze Courtyard Wall Lanterns mounted on the central & left piers!
  const addWallLantern = (wx: number, wy: number, wz: number) => {
    addBox(s, 0.06, 0.20, 0.04, wx, wy, wz, bronzeDark, 2);
    addBox(s, 0.04, 0.04, 0.22, wx, wy + 0.08, wz + 0.11, bronzeDark, 2);
    const cz = wz + 0.22;
    appendGeometry(s, UNIT_CONE_6, composeMat(wx, wy + 0.04, cz, 0, 0, 0, 0.13, 0.11, 0.13), bronzeDark, 2);
    addCyl(s, 0.10, 0.03, wx, wy - 0.18, cz, bronzeDark, 2, { segs: 6 });
    addCyl(g, 0.085, 0.17, wx, wy - 0.08, cz, lanternGlow, 0, { segs: 6 });
  };
  addWallLantern(-0.18, 1.72, wallZ + wallThick * 0.5);
  addWallLantern(-2.52, 1.82, wallZ + wallThick * 0.5);
}

/**
 * Shared 2×2 procedural architectural texture atlas (luminance centered near 1.0):
 * - (0,0): Hand-troweled limewash plaster / stucco
 * - (1,0): Warm cedar wood grain & bamboo culm fiber
 * - (0,1): Chiseled granite / Suzhou gray brick masonry courses
 * - (1,1): Semi-cylindrical clay roof tile ribs & overlap courses
 */
let cachedArchAtlasBytes: Uint8Array<ArrayBuffer> | undefined;

function getArchAtlasBytes(size = 256): Uint8Array<ArrayBuffer> {
  if (cachedArchAtlasBytes && cachedArchAtlasBytes.length === size * size * 4) {
    return cachedArchAtlasBytes;
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
        // Hand-troweled limewash plaster / stucco: soft broad organic clouding + fine mineral warmth.
        const cloud =
          Math.sin(u * Math.PI * 4 + Math.cos(v * Math.PI * 3) * 0.9) * 0.028 +
          Math.cos(v * Math.PI * 5 - u * Math.PI * 2) * 0.022;
        const grain = (hash2(px * 0.7, py * 0.7) - 0.5) * 0.032;
        const shade = 0.99 + cloud + grain;
        r = THREE.MathUtils.clamp(shade * 1.006, 0, 1);
        g = THREE.MathUtils.clamp(shade, 0, 1);
        b = THREE.MathUtils.clamp(shade * 0.988, 0, 1);
      } else if (quad === 1) {
        // Cedar wood grain / bamboo fibers along V.
        const fiber =
          Math.sin(u * Math.PI * 18 + Math.sin(v * Math.PI * 3) * 0.6) * 0.038 +
          Math.sin(u * Math.PI * 7) * 0.024;
        const fine = (hash2(Math.floor(px * 0.9), Math.floor(py * 0.25)) - 0.5) * 0.038;
        const shade = 0.975 + fiber + fine;
        r = THREE.MathUtils.clamp(shade * 1.01, 0, 1);
        g = THREE.MathUtils.clamp(shade * 0.995, 0, 1);
        b = THREE.MathUtils.clamp(shade * 0.97, 0, 1);
      } else if (quad === 2) {
        // Dressed granite / Suzhou gray brick running-bond courses.
        const rows = 6;
        const cols = 3;
        const row = Math.floor(v * rows);
        const rv = (v * rows) % 1;
        const uShifted = (u * cols + (row % 2) * 0.5) % 1;
        const mortarH = rv < 0.08 || rv > 0.92;
        const mortarV = uShifted < 0.05 || uShifted > 0.95;
        const blockTone = (hash2(row * 7, Math.floor(u * cols + (row % 2) * 0.5) * 11) - 0.5) * 0.07;
        const chisel = (hash2(Math.floor(px * 0.6), Math.floor(py * 0.6)) - 0.5) * 0.045;
        let shade = 0.985 + blockTone + chisel;
        if (mortarH || mortarV) shade *= 0.87;
        r = THREE.MathUtils.clamp(shade, 0, 1);
        g = THREE.MathUtils.clamp(shade, 0, 1);
        b = THREE.MathUtils.clamp(shade * 0.99, 0, 1);
      } else {
        // Clay barrel roof tile ribs along U + horizontal stepped courses along V.
        const rib = Math.sin(u * Math.PI * 14);
        const courseV = (v * 6) % 1;
        const overlapShadow = courseV < 0.14 ? -0.10 * (1 - courseV / 0.14) : 0;
        const shade = 0.97 + rib * 0.075 + overlapShadow + (hash2(px * 0.5, py * 0.5) - 0.5) * 0.025;
        r = THREE.MathUtils.clamp(shade, 0, 1);
        g = THREE.MathUtils.clamp(shade, 0, 1);
        b = THREE.MathUtils.clamp(shade, 0, 1);
      }

      const idx = (py * size + px) * 4;
      bytes[idx] = Math.round(r * 255);
      bytes[idx + 1] = Math.round(g * 255);
      bytes[idx + 2] = Math.round(b * 255);
      bytes[idx + 3] = 255;
    }
  }
  cachedArchAtlasBytes = bytes;
  return bytes;
}

function makeArchTexture(bytes: Uint8Array<ArrayBuffer>, size: number, colorSpace: THREE.ColorSpace): THREE.DataTexture {
  const texture = new THREE.DataTexture(bytes.slice(), size, size);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'regional-courtyard-arch-atlas';
  return texture;
}

interface GeometryTemplate {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  boundingBox: THREE.Box3;
  boundingSphere: THREE.Sphere;
}

interface CourtyardTemplatePair {
  structure: GeometryTemplate;
  glow: GeometryTemplate;
}

const COURTYARD_TEMPLATE_CACHE = new Map<string, CourtyardTemplatePair>();

function builderToTemplate(b: MeshBuilder): GeometryTemplate {
  const positions = Float32Array.from(b.positions);
  const normals = Float32Array.from(b.normals);
  const uvs = Float32Array.from(b.uvs);
  const colors = Float32Array.from(b.colors);
  const indices = Uint32Array.from(b.indices);
  const temp = new THREE.BufferGeometry();
  temp.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  temp.computeBoundingBox();
  temp.computeBoundingSphere();
  const boundingBox = temp.boundingBox!.clone();
  const boundingSphere = temp.boundingSphere!.clone();
  temp.dispose();
  return { positions, normals, uvs, colors, indices, boundingBox, boundingSphere };
}

function instantiateTemplate(tpl: GeometryTemplate): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(tpl.positions.slice(), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(tpl.normals.slice(), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(tpl.uvs.slice(), 2));
  geo.setAttribute('color', new THREE.BufferAttribute(tpl.colors.slice(), 3));
  geo.setIndex(new THREE.BufferAttribute(tpl.indices.slice(), 1));
  geo.boundingBox = tpl.boundingBox.clone();
  geo.boundingSphere = tpl.boundingSphere.clone();
  return geo;
}

function getCourtyardTemplates(skin: ActiveCourtyardSkin, compactWing: boolean): CourtyardTemplatePair {
  const key = `${skin}:${compactWing ? 1 : 0}`;
  let cached = COURTYARD_TEMPLATE_CACHE.get(key);
  if (!cached) {
    const structureBuilder = createBuilder();
    const glowBuilder = createBuilder();
    if (skin === 'japanese-karesansui') {
      buildJapaneseKaresansuiCourtyard(structureBuilder, glowBuilder, compactWing);
    } else if (skin === 'chinese-jiangnan') {
      buildChineseJiangnanCourtyard(structureBuilder, glowBuilder, compactWing);
    } else {
      buildWarmTerracottaArchCourtyard(structureBuilder, glowBuilder, compactWing);
    }
    cached = {
      structure: builderToTemplate(structureBuilder),
      glow: builderToTemplate(glowBuilder),
    };
    COURTYARD_TEMPLATE_CACHE.set(key, cached);
  }
  return cached;
}

/**
 * Calibrate Komorebi daylight architectural walls with warm sunlit courtyard bounce fill:
 * vertical walls facing away from the upper-left key sun (-6, 12, 6) would otherwise crush
 * too cool/dark under the ambient-free Komorebi rig. Sunlit crests still read full 1.0 brightness.
 */
function createKomorebiArchSurface(map: THREE.DataTexture, name: string): THREE.MeshPhongMaterial {
  const surface = createKomorebiSurface();
  surface.color.setRGB(1, 1, 1);
  surface.map = map;
  surface.vertexColors = true;
  surface.name = name;
  surface.userData.komorebiSurface = true;
  surface.userData.komorebiPigment = true;
  const baseCompile = surface.onBeforeCompile;
  surface.onBeforeCompile = (shader, renderer) => {
    baseCompile.call(surface, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 outgoingLight=clamp(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,0.0,1.0)*kmPigment',
      'vec3 outgoingLight=mix(vec3(.46,.45,.47),vec3(1.0),clamp(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,0.0,1.0))*kmPigment',
    );
  };
  surface.customProgramCacheKey = () => 'komorebi-courtyard-arch-v1';
  return surface;
}

export interface RegionalCourtyardHandle {
  root: THREE.Group;
  skin: ActiveCourtyardSkin;
  setTone(tone: EnvironmentTone): void;
  dispose(): void;
}

export function createRegionalCourtyard({
  skin,
  kind,
  id,
  groundY,
  night,
}: {
  skin: ActiveCourtyardSkin;
  kind: GardenKind;
  id: string;
  groundY: number;
  night: boolean;
}): RegionalCourtyardHandle {
  // Keep veranda decks, tables, and chinowa-kuguri walking corridors spacious and unobstructed.
  const compactWing = kind === 'veranda' || kind === 'table' || id === 'chinowa-kuguri';
  const templates = getCourtyardTemplates(skin, compactWing);
  const structureGeo = instantiateTemplate(templates.structure);
  const glowGeo = instantiateTemplate(templates.glow);

  const atlasBytes = getArchAtlasBytes(256);
  const komorebiMap = makeArchTexture(atlasBytes, 256, THREE.NoColorSpace);
  const standardMap = makeArchTexture(atlasBytes, 256, THREE.SRGBColorSpace);

  const komorebiStructureMat = createKomorebiArchSurface(
    komorebiMap,
    `Regional courtyard structure (${skin}, Komorebi)`,
  );

  const nightWallTint =
    skin === 'warm-terracotta-arch' ? 0xaba09a : skin === 'chinese-jiangnan' ? 0x9aa6b5 : 0x9fa8b2;
  const standardStructureMat = new THREE.MeshStandardMaterial({
    color: night ? nightWallTint : 0xdfd7ca,
    map: standardMap,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  standardStructureMat.name = `Regional courtyard structure (${skin}${night ? ', night' : ''})`;
  standardStructureMat.userData.komorebiPigment = true;

  // Lantern firebox glow: soft warm cream washi/glass by day; subtle HDR warm glow at night for AgX + Bloom.
  const komorebiGlowMat = createKomorebiSurface();
  komorebiGlowMat.color.setRGB(1, 1, 1);
  komorebiGlowMat.vertexColors = true;
  komorebiGlowMat.name = `Regional courtyard lantern (${skin}, Komorebi)`;
  komorebiGlowMat.userData.komorebiSurface = true;
  komorebiGlowMat.userData.komorebiPigment = true;

  const standardGlowMat = night
    ? new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.48, 0.98, 0.48),
        toneMapped: false,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xf2e2be,
        vertexColors: true,
        roughness: 0.72,
        metalness: 0,
      });
  standardGlowMat.name = `Regional courtyard lantern (${skin}${night ? ', night glow' : ''})`;
  standardGlowMat.userData.komorebiPigment = true;

  const root = new THREE.Group();
  root.name = 'regional-courtyard';
  root.position.set(0, groundY, 0);
  root.userData.courtyardSkin = skin;

  const structureMesh = new THREE.Mesh(
    structureGeo,
    night ? standardStructureMat : komorebiStructureMat,
  );
  structureMesh.name = 'regional-courtyard-structure';
  structureMesh.castShadow = false;
  structureMesh.receiveShadow = true;
  structureMesh.raycast = () => {};
  structureMesh.userData.courtyardSkin = true;
  structureMesh.userData.toonSurface = { outline: false, shading: 'smooth' };

  const glowMesh = new THREE.Mesh(glowGeo, night ? standardGlowMat : komorebiGlowMat);
  glowMesh.name = 'regional-courtyard-glow';
  glowMesh.castShadow = false;
  glowMesh.receiveShadow = false;
  glowMesh.raycast = () => {};
  glowMesh.userData.courtyardSkin = true;
  glowMesh.userData.courtyardGlow = true;
  glowMesh.userData.toonSurface = { outline: false, shading: 'smooth' };

  root.add(structureMesh, glowMesh);

  let disposed = false;

  function setTone(tone: EnvironmentTone) {
    if (disposed) return;
    if (night) {
      structureMesh.material = standardStructureMat;
      glowMesh.material = standardGlowMat;
      standardStructureMat.color.setHex(
        tone === 'tiny-delivery' ? 0xb4aba2 : nightWallTint,
      );
      return;
    }
    const useKomorebi = tone === 'komorebi';
    structureMesh.material = useKomorebi ? komorebiStructureMat : standardStructureMat;
    glowMesh.material = useKomorebi ? komorebiGlowMat : standardGlowMat;
    if (!useKomorebi) {
      standardStructureMat.color.setHex(tone === 'tiny-delivery' ? 0xe6dccb : 0xdfd7ca);
    }
  }

  return {
    root,
    skin,
    setTone,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      structureGeo.dispose();
      glowGeo.dispose();
      komorebiStructureMat.dispose();
      standardStructureMat.dispose();
      komorebiGlowMat.dispose();
      standardGlowMat.dispose();
      komorebiMap.dispose();
      standardMap.dispose();
    },
  };
}
