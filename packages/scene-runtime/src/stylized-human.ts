import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';
import { applyCraftSurface, type CraftSurfaceOptions } from './craft-surfaces';
import { createRitualMaterial } from './ritual-optics';

/**
 * @wbr/scene-runtime/stylized-human
 *
 * Warm Komorebi / storybook / handcrafted wooden-ceramic stylized human hands,
 * limbs, sleeves, full-body figures, and seated contemplative statue components
 * powered by Loop subdivision (`three-subdivide`, MIT).
 *
 * Every exported geometry builder produces a finite, outward-oriented, closed
 * 2-manifold mesh with smooth welded normals and subtle warm vertex-color AO /
 * blush gradients, staying strictly within mobile triangle budgets
 * (400–1,200 tris per hand, 1,500–3,500 tris per full figure).
 */

export type SkinTonePreset =
  | 'warm-apricot'
  | 'warm-peach'
  | 'honey-ochre'
  | 'warm-caramel'
  | 'terracotta-warm'
  | 'cedar-wood'
  | 'gilded-bronze';

export const SKIN_TONE_PRESETS: Record<SkinTonePreset, number> = {
  'warm-apricot': 0xe9b48c,
  'warm-peach': 0xf0be95,
  'honey-ochre': 0xd89d72,
  'warm-caramel': 0xc78d68,
  'terracotta-warm': 0xb97957,
  'cedar-wood': 0xd4a47c,
  'gilded-bronze': 0xcfa460,
};

export interface StylizedSkinMaterialOptions {
  /** Base pigment color or named warm Komorebi preset. Default `'warm-apricot'`. */
  color?: THREE.ColorRepresentation;
  tone?: SkinTonePreset;
  /** Matte handcrafted ceramic/storybook roughness. Default `0.86`. */
  roughness?: number;
  /** Subtle warm subsurface scatter strength via ritual-optics. Default `0.12`. */
  scatterStrength?: number;
  /** Enable baked warm blush / crevice AO vertex colors. Default `true`. */
  vertexColors?: boolean;
  name?: string;
}

export interface StylizedGarmentMaterialOptions {
  color: THREE.ColorRepresentation;
  /** Soft woven cloth roughness. Default `0.92`. */
  roughness?: number;
  /** Procedural fabric weave strength via craft-surfaces. Default `0.28`. */
  fabricStrength?: number;
  /** Fabric weave pattern scale. Default `1.2`. */
  fabricScale?: number;
  /** Fabric grain axis. Default `'y'`. */
  axis?: CraftSurfaceOptions['axis'];
  /** Gentle cloth light-wrap scatter via ritual-optics. Default `0.07`. */
  scatterStrength?: number;
  /** Enable baked cuff-interior / hem AO vertex colors. Default `true`. */
  vertexColors?: boolean;
  name?: string;
}

export type StylizedSurfaceRole = 'skin' | 'garment' | 'hair' | 'statue';

export interface ManifoldReport {
  triangleCount: number;
  vertexCount: number;
  degenerateTriangles: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  invertedEdges: number;
  signedVolume: number;
  isClosedTwoManifold: boolean;
}

export interface SubdivideOptions {
  /** Loop subdivision iterations (typically 1 or 2). Default `1`. */
  iterations?: number;
  /** Whether to return an indexed BufferGeometry (true) or non-indexed (false). Default `true`. */
  indexed?: boolean;
}

export interface StylizedPalmOptions extends SubdivideOptions {
  /** Width across knuckles (X). Default `0.24`. */
  width?: number;
  /** Thickness from palm face to back of hand (Y). Default `0.076`. */
  thickness?: number;
  /** Length from wrist base (+Z) to knuckle line (-Z). Default `0.26`. */
  length?: number;
  /** Handedness for thenar (thumb-pad) fullness side. `'right'` puts thumb on -X when palm faces down / -Z forward. Default `'right'`. */
  handedness?: 'left' | 'right';
  /** If true, palm faces +Y (upward offering); if false, palm faces -Y (resting/stroking). Default `false`. */
  palmUp?: boolean;
  /** Subtle arch height of the dorsal hand. Default `0.010`. */
  arch?: number;
  /** Optional flat contact plane clamp on the palm-facing side (`+thickness/2` if palmUp, `-thickness/2` otherwise) for exact flush contact. */
  flatContactFace?: boolean;
  /** Radial cage segments. Default `8`. */
  radialSegments?: number;
}

export interface StylizedFingerOptions extends SubdivideOptions {
  /** Total finger length along `-Z` (from knuckle base at `z = 0` to tip at `z = -length`). Default `0.19`. */
  length?: number;
  /** Base horizontal radius (X). Default `0.028`. */
  radiusX?: number;
  /** Base vertical radius (Y). Default `0.027`. */
  radiusY?: number;
  /** Gentle curl droop angle (radians) along the finger length. Positive curls toward `-Y` (or `+Y` when `curlUp` is true). Default `0.22`. */
  curl?: number;
  /** If true, curls toward `+Y` (palm-up cup); otherwise curls toward `-Y`. Default `false`. */
  curlUp?: boolean;
  /** Optional side splay curve along X. Default `0`. */
  splay?: number;
  /** Optional custom 3D centerline curve (overrides length/curl/splay). */
  curve?: THREE.Curve<THREE.Vector3>;
  /** Number of intermediate longitudinal rings along the finger. Default `3`. */
  lengthSegments?: number;
  /** Radial cage segments. Default `6`. */
  radialSegments?: number;
  /** Optional flat top clamp at `y <= flatTopY` (for flush support under thin objects). */
  flatTopY?: number;
}

export interface StylizedThumbOptions extends SubdivideOptions {
  /** Thumb length along `-Z`. Default `0.15`. */
  length?: number;
  /** Base horizontal radius. Default `0.034`. */
  radiusX?: number;
  /** Base vertical radius. Default `0.032`. */
  radiusY?: number;
  /** Gentle inward opposition curve (radians). Default `0.26`. */
  curl?: number;
  /** If true, curls toward `+Y`; otherwise toward `-Y`. Default `false`. */
  curlUp?: boolean;
  /** Optional side curve along X (opposition toward palm). Default `0.015`. */
  opposition?: number;
  /** Optional custom 3D centerline curve. */
  curve?: THREE.Curve<THREE.Vector3>;
  /** Number of longitudinal segments. Default `2`. */
  lengthSegments?: number;
  /** Optional flat top clamp at `y <= flatTopY`. */
  flatTopY?: number;
  radialSegments?: number;
}

export interface StylizedForearmOptions extends SubdivideOptions {
  /** Forearm length along `+Z` (from wrist at `z = 0` to proximal end at `z = length`). Default `0.55`. */
  length?: number;
  /** Horizontal radius at wrist end (`z = 0`). Default `0.085`. */
  wristRadiusX?: number;
  /** Vertical radius at wrist end (`z = 0`). Default `0.062`. */
  wristRadiusY?: number;
  /** Horizontal radius at proximal/elbow end (`z = length`). Default `0.118`. */
  elbowRadiusX?: number;
  /** Vertical radius at proximal/elbow end (`z = length`). Default `0.092`. */
  elbowRadiusY?: number;
  /** Subtle muscle fullness bulge near proximal third. Default `0.08`. */
  fullness?: number;
  radialSegments?: number;
}

export interface StylizedSleeveCuffOptions extends SubdivideOptions {
  /** Sleeve segment length along `+Z` (`z = 0` is the open wrist cuff mouth, `z = length` is the proximal sleeve end). Default `0.42`. */
  length?: number;
  /** Outer horizontal radius at the cuff mouth (`z = 0`). Default `0.115`. */
  cuffRadiusX?: number;
  /** Outer vertical radius at the cuff mouth (`z = 0`). Default `0.095`. */
  cuffRadiusY?: number;
  /** Outer horizontal radius at the proximal sleeve end (`z = length`). Default `0.148`. */
  sleeveRadiusX?: number;
  /** Outer vertical radius at the proximal sleeve end (`z = length`). Default `0.126`. */
  sleeveRadiusY?: number;
  /** Rolled fabric cuff wall thickness. Default `0.016`. */
  wallThickness?: number;
  /** Subtle rolled/layered cuff lip flare at the mouth. Default `0.010`. */
  rolledLip?: number;
  /** Soft cloth drapery ripple amplitude around the circumference. Default `0.006`. */
  foldDepth?: number;
  /** How deep the darkened inner sleeve cavity extends inside the cuff (0.25..0.75 of length). Default `0.42`. */
  cavityDepthRatio?: number;
  /** Radial cage segments. Default `10`. */
  radialSegments?: number;
}

export type StylizedHandPosePreset = 'open' | 'gentle-rest' | 'stroke' | 'cup' | 'offer';

export interface StylizedHandRigOptions {
  namePrefix?: string;
  handedness?: 'left' | 'right';
  scale?: number;
  palmUp?: boolean;
  pose?: StylizedHandPosePreset;
  skinMaterial?: THREE.Material;
  garmentMaterial?: THREE.Material;
  cuffMaterial?: THREE.Material;
  includeForearm?: boolean;
  includeSleeve?: boolean;
  includeCuff?: boolean;
  iterations?: number;
  indexed?: boolean;
}

export interface StylizedHandRig {
  root: THREE.Group;
  palm: THREE.Mesh;
  fingers: THREE.Mesh[];
  thumb: THREE.Mesh;
  forearm?: THREE.Mesh;
  cuff?: THREE.Mesh;
  sleeve?: THREE.Mesh;
}

export interface StylizedHeadOptions extends SubdivideOptions {
  /** Head width across cheeks (X). Default `0.22`. */
  width?: number;
  /** Head height from chin bottom to crown top (Y). Default `0.26`. */
  height?: number;
  /** Head depth from occiput to brow (Z). Default `0.23`. */
  depth?: number;
  /** Cheek fullness factor (storybook warmth). Default `0.12`. */
  cheekFullness?: number;
  /** Subtle sculpted nose bridge/tip prominence (0 = smooth wooden doll, 1 = gentle storybook nose). Default `0.45`. */
  noseProminence?: number;
  /** Include gentle chin/jaw taper. Default `0.18`. */
  chinTaper?: number;
  /** Radial cage segments. Default `10`. */
  radialSegments?: number;
}

export type StylizedHairStyle = 'short' | 'bun' | 'bob' | 'topknot' | 'cap-base';

export interface StylizedHairOptions extends SubdivideOptions {
  style?: StylizedHairStyle;
  /** Reference head width. Default `0.22`. */
  headWidth?: number;
  /** Reference head height. Default `0.26`. */
  headHeight?: number;
  /** Reference head depth. Default `0.23`. */
  headDepth?: number;
  /** Volume thickness beyond scalp. Default `0.022`. */
  volume?: number;
  radialSegments?: number;
}

export type StylizedCollarStyle = 'round' | 'crossed' | 'mandarin' | 'robe';

export interface StylizedTorsoOptions extends SubdivideOptions {
  /** Shoulder width (X). Default `0.38`. */
  shoulderWidth?: number;
  /** Waist width (X). Default `0.28`. */
  waistWidth?: number;
  /** Lower hem width (X). Default `0.34`. */
  hemWidth?: number;
  /** Front-to-back chest depth (Z). Default `0.21`. */
  depth?: number;
  /** Total torso garment height from hem (`y = 0`) to collar base (`y = height`). Default `0.52`. */
  height?: number;
  collarStyle?: StylizedCollarStyle;
  /** Gentle fabric fold amplitude around lower hem. Default `0.010`. */
  foldDepth?: number;
  radialSegments?: number;
}

export interface StylizedLimbOptions extends SubdivideOptions {
  /** Limb length along `-Y` (from joint at `y = 0` to distal end at `y = -length`). Default `0.44`. */
  length?: number;
  /** Proximal (hip/shoulder) radius. Default `0.088`. */
  topRadius?: number;
  /** Distal (ankle/wrist) radius. Default `0.058`. */
  bottomRadius?: number;
  /** Depth-to-width oval ratio (Z / X). Default `1.06`. */
  depthRatio?: number;
  /** Gentle knee/elbow bend forward along `+Z` (radians). Default `0.12`. */
  bend?: number;
  /** Soft cloth trouser/sleeve fold ripple amplitude. Default `0.005`. */
  foldDepth?: number;
  radialSegments?: number;
}

export interface StylizedShoeOptions extends SubdivideOptions {
  /** Shoe length along `+Z` (heel near `-length*0.35`, rounded toe at `+length*0.65`). Default `0.21`. */
  length?: number;
  /** Shoe width across forefoot (X). Default `0.095`. */
  width?: number;
  /** Ankle collar height above ground (`y = 0`). Default `0.082`. */
  height?: number;
  /** Slight upward storybook toe spring. Default `0.008`. */
  toeLift?: number;
  radialSegments?: number;
}

export interface StylizedSeatedStatueOptions extends SubdivideOptions {
  /** Knee-to-knee base span (X). Default `0.62`. */
  lapWidth?: number;
  /** Front-to-back seated depth (Z). Default `0.42`. */
  lapDepth?: number;
  /** Seated height from lotus seat (`y = 0`) to shoulder/neck base (`y = height`). Default `0.66`. */
  height?: number;
  /** Shoulder width (X). Default `0.36`. */
  shoulderWidth?: number;
  /** Soft robe drapery fold amplitude. Default `0.014`. */
  foldDepth?: number;
  radialSegments?: number;
}

export interface StylizedLotusPedestalOptions extends SubdivideOptions {
  /** Outer petal radius. Default `0.44`. */
  radius?: number;
  /** Total pedestal height (`y = 0` base to `y = height` seat platform). Default `0.18`. */
  height?: number;
  /** Number of sculpted lotus petals around the ring. Default `12`. */
  petalCount?: number;
}

export interface RobeDraperyOptions {
  /** Wave amplitude of drapery pleats. Default `0.008`. */
  amplitude?: number;
  /** Number of pleats around circumference. Default `7`. */
  frequency?: number;
  /** Vertical phase shift for diagonal monk-robe / kimono folds. Default `1.4`. */
  diagonalTwist?: number;
  /** Optional warm AO darkening strength in drapery valleys (0..0.4). Default `0.18`. */
  valleyAO?: number;
}

// ============================================================================
// Internal Math & Manifold-Preserving Subdivision Core
// ============================================================================

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  if (Math.abs(edge1 - edge0) < 1e-9) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const GEOMETRY_CACHE_LIMIT = 160;
const geometryTemplateCache = new Map<string, THREE.BufferGeometry>();

function roundKey(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return 'u';
  return Math.round(n * 1e5).toString();
}

function curveCacheKey(curve: THREE.Curve<THREE.Vector3> | undefined): string {
  if (!curve) return 'none';
  const samples: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const p = curve.getPoint(i / 4);
    samples.push(`${roundKey(p.x)},${roundKey(p.y)},${roundKey(p.z)}`);
  }
  return samples.join(';');
}

function cachedStylizedGeometry(
  key: string,
  build: () => THREE.BufferGeometry,
): THREE.BufferGeometry {
  let template = geometryTemplateCache.get(key);
  if (!template) {
    template = build();
    if (geometryTemplateCache.size >= GEOMETRY_CACHE_LIMIT) {
      const oldestKey = geometryTemplateCache.keys().next().value;
      if (oldestKey !== undefined) {
        geometryTemplateCache.get(oldestKey)?.dispose();
        geometryTemplateCache.delete(oldestKey);
      }
    }
    geometryTemplateCache.set(key, template);
  }
  return template.clone();
}

/**
 * Inspects a BufferGeometry (indexed or non-indexed) and verifies strict closed
 * 2-manifold topology: finite vertices, zero degenerate faces, every undirected
 * edge shared by exactly 2 triangles with opposing half-edge directions, and
 * positive outward signed volume.
 */
export function analyzeMeshManifold(geometry: THREE.BufferGeometry, weldTolerance = 1e-5): ManifoldReport {
  const pos = geometry.getAttribute('position');
  if (!pos || pos.count === 0) {
    return {
      triangleCount: 0,
      vertexCount: 0,
      degenerateTriangles: 0,
      boundaryEdges: 0,
      nonManifoldEdges: 0,
      invertedEdges: 0,
      signedVolume: 0,
      isClosedTwoManifold: false,
    };
  }

  const index = geometry.index;
  const triIndexCount = index ? index.count : pos.count;
  const triangleCount = Math.floor(triIndexCount / 3);
  const invTol = 1 / Math.max(weldTolerance, 1e-9);

  const keyToId = new Map<string, number>();
  const uniquePositions: THREE.Vector3[] = [];
  const rawToWelded = new Int32Array(pos.count);
  let allFinite = true;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      allFinite = false;
      rawToWelded[i] = -1;
      continue;
    }
    const qx = Math.round(x * invTol);
    const qy = Math.round(y * invTol);
    const qz = Math.round(z * invTol);
    const key = `${qx === 0 ? 0 : qx},${qy === 0 ? 0 : qy},${qz === 0 ? 0 : qz}`;
    let id = keyToId.get(key);
    if (id === undefined) {
      id = uniquePositions.length;
      keyToId.set(key, id);
      uniquePositions.push(new THREE.Vector3(x, y, z));
    }
    rawToWelded[i] = id;
  }

  const undirectedEdges = new Map<string, number>();
  const directedEdges = new Map<string, number>();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const cross = new THREE.Vector3();
  let degenerateTriangles = 0;
  let signedVolume = 0;

  for (let t = 0; t < triangleCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    const a = rawToWelded[i0]!;
    const b = rawToWelded[i1]!;
    const c = rawToWelded[i2]!;
    if (a < 0 || b < 0 || c < 0 || a === b || b === c || c === a) {
      degenerateTriangles++;
      continue;
    }
    const va = uniquePositions[a]!;
    const vb = uniquePositions[b]!;
    const vc = uniquePositions[c]!;
    e1.subVectors(vb, va);
    e2.subVectors(vc, va);
    cross.crossVectors(e1, e2);
    if (cross.length() * 0.5 <= 1e-12) {
      degenerateTriangles++;
      continue;
    }
    signedVolume += va.dot(cross) / 6;

    const pairs: [number, number][] = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [u, v] of pairs) {
      const uKey = u < v ? `${u}|${v}` : `${v}|${u}`;
      undirectedEdges.set(uKey, (undirectedEdges.get(uKey) ?? 0) + 1);
      const dKey = `${u}->${v}`;
      directedEdges.set(dKey, (directedEdges.get(dKey) ?? 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of undirectedEdges.values()) {
    if (count === 1) boundaryEdges++;
    else if (count !== 2) nonManifoldEdges++;
  }

  let invertedEdges = 0;
  for (const count of directedEdges.values()) {
    if (count > 1) invertedEdges++;
  }

  const isClosedTwoManifold =
    allFinite &&
    triangleCount > 0 &&
    degenerateTriangles === 0 &&
    boundaryEdges === 0 &&
    nonManifoldEdges === 0 &&
    invertedEdges === 0 &&
    signedVolume > 0;

  return {
    triangleCount,
    vertexCount: uniquePositions.length,
    degenerateTriangles,
    boundaryEdges,
    nonManifoldEdges,
    invertedEdges,
    signedVolume,
    isClosedTwoManifold,
  };
}

/** Returns true iff `geometry` is a finite, outward-oriented, closed 2-manifold mesh. */
export function isClosedTwoManifold(geometry: THREE.BufferGeometry, weldTolerance = 1e-5): boolean {
  return analyzeMeshManifold(geometry, weldTolerance).isClosedTwoManifold;
}

/**
 * Welds vertices by spatial position, removes any zero-area triangles, ensures
 * strictly positive outward signed volume, and computes smooth welded normals.
 */
function weldAndFinalizeManifold(
  source: THREE.BufferGeometry,
  indexed: boolean,
  uvGenerator?: (p: THREE.Vector3, n: THREE.Vector3) => [number, number],
  colorGenerator?: (p: THREE.Vector3, n: THREE.Vector3, box: THREE.Box3) => [number, number, number],
): THREE.BufferGeometry {
  const posAttr = source.getAttribute('position');
  const rawIndex = source.index;
  const rawTriCount = Math.floor((rawIndex ? rawIndex.count : posAttr.count) / 3);

  // Adaptive weld precision relative to mesh extent so fine details stay intact.
  source.computeBoundingBox();
  const rawBox = source.boundingBox ?? new THREE.Box3();
  const size = rawBox.getSize(new THREE.Vector3());
  const maxSpan = Math.max(size.x, size.y, size.z, 1e-4);
  const tol = Math.min(1e-5, maxSpan * 1e-5);
  const invTol = 1 / tol;

  const keyToId = new Map<string, number>();
  const positions: number[] = [];
  const rawToWelded = new Int32Array(posAttr.count);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const qx = Math.round(x * invTol);
    const qy = Math.round(y * invTol);
    const qz = Math.round(z * invTol);
    const key = `${qx === 0 ? 0 : qx},${qy === 0 ? 0 : qy},${qz === 0 ? 0 : qz}`;
    let id = keyToId.get(key);
    if (id === undefined) {
      id = positions.length / 3;
      keyToId.set(key, id);
      positions.push(x, y, z);
    }
    rawToWelded[i] = id;
  }

  const indices: number[] = [];
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const cross = new THREE.Vector3();
  let signedVolume = 0;

  for (let t = 0; t < rawTriCount; t++) {
    const r0 = rawIndex ? rawIndex.getX(t * 3) : t * 3;
    const r1 = rawIndex ? rawIndex.getX(t * 3 + 1) : t * 3 + 1;
    const r2 = rawIndex ? rawIndex.getX(t * 3 + 2) : t * 3 + 2;
    const a = rawToWelded[r0]!;
    const b = rawToWelded[r1]!;
    const c = rawToWelded[r2]!;
    if (a === b || b === c || c === a) continue;
    va.set(positions[a * 3]!, positions[a * 3 + 1]!, positions[a * 3 + 2]!);
    vb.set(positions[b * 3]!, positions[b * 3 + 1]!, positions[b * 3 + 2]!);
    vc.set(positions[c * 3]!, positions[c * 3 + 1]!, positions[c * 3 + 2]!);
    e1.subVectors(vb, va);
    e2.subVectors(vc, va);
    cross.crossVectors(e1, e2);
    if (cross.length() * 0.5 <= 1e-12) continue;
    signedVolume += va.dot(cross) / 6;
    indices.push(a, b, c);
  }

  if (signedVolume < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1]!;
      indices[i + 1] = indices[i + 2]!;
      indices[i + 2] = tmp;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingBox();

  const box = g.boundingBox!;
  const center = box.getCenter(new THREE.Vector3());
  const boxSize = box.getSize(new THREE.Vector3());
  const normAttr = g.getAttribute('normal');
  const vertCount = positions.length / 3;
  const uvs = new Float32Array(vertCount * 2);
  const colors = new Float32Array(vertCount * 3);
  const pVec = new THREE.Vector3();
  const nVec = new THREE.Vector3();

  for (let i = 0; i < vertCount; i++) {
    pVec.set(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
    nVec.set(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
    if (uvGenerator) {
      const [u, v] = uvGenerator(pVec, nVec);
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    } else {
      const dx = pVec.x - center.x;
      const dz = pVec.z - center.z;
      const u = Math.atan2(dx, dz) / (Math.PI * 2) + 0.5;
      const v = clamp((pVec.y - box.min.y) / Math.max(boxSize.y, 1e-4), 0, 1);
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }
    if (colorGenerator) {
      const [r, gCh, b] = colorGenerator(pVec, nVec, box);
      colors[i * 3] = r;
      colors[i * 3 + 1] = gCh;
      colors[i * 3 + 2] = b;
    } else {
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
    }
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeBoundingBox();
  g.computeBoundingSphere();

  if (!indexed) {
    const nonIndexed = g.toNonIndexed();
    g.dispose();
    nonIndexed.computeBoundingBox();
    nonIndexed.computeBoundingSphere();
    return nonIndexed;
  }
  return g;
}

/**
 * Applies Charles Loop subdivision (`three-subdivide`) to a closed control cage
 * while safeguarding against `three-subdivide`'s internal `POSITION_DECIMALS = 2`
 * vertex hashing precision by scaling the cage to macro scale prior to subdivision
 * and scaling back afterwards.
 */
export function subdivideClosedCage(
  controlCage: THREE.BufferGeometry,
  options: SubdivideOptions & {
    postDeform?: (p: THREE.Vector3) => void;
    uvGenerator?: (p: THREE.Vector3, n: THREE.Vector3) => [number, number];
    colorGenerator?: (p: THREE.Vector3, n: THREE.Vector3, box: THREE.Box3) => [number, number, number];
  } = {},
): THREE.BufferGeometry {
  const iterations = clamp(Math.round(options.iterations ?? 1), 0, 3);
  const indexed = options.indexed !== false;

  controlCage.computeBoundingBox();
  const cageBox = controlCage.boundingBox ?? new THREE.Box3();
  const span = cageBox.getSize(new THREE.Vector3());
  const maxSpan = Math.max(span.x, span.y, span.z, 1e-4);

  let working: THREE.BufferGeometry;
  if (iterations === 0) {
    working = controlCage.clone();
  } else {
    // Scale cage so minimum inter-vertex spacing stays >> 0.01 (three-subdivide hash grid).
    const scaleFactor = Math.max(120, 180 / maxSpan);
    const scaled = controlCage.clone();
    scaled.scale(scaleFactor, scaleFactor, scaleFactor);
    if (!scaled.getAttribute('normal')) {
      scaled.computeVertexNormals();
    }
    const subdivided = LoopSubdivision.modify(scaled, iterations, {
      split: false,
      uvSmooth: false,
      preserveEdges: false,
      flatOnly: false,
    });
    scaled.dispose();
    const inv = 1 / scaleFactor;
    subdivided.scale(inv, inv, inv);
    working = subdivided;
  }

  if (options.postDeform) {
    const pos = working.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      options.postDeform(v);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  }

  const finalGeo = weldAndFinalizeManifold(
    working,
    indexed,
    options.uvGenerator,
    options.colorGenerator,
  );
  working.dispose();
  return finalGeo;
}

/**
 * Builds a guaranteed closed 2-manifold control cage from ordered rings of equal
 * vertex count, capped cleanly at both poles (or linked cyclically when `closedLoop` is true).
 */
function buildLoftedControlCage(
  rings: THREE.Vector3[][],
  caps: { startPole?: THREE.Vector3; endPole?: THREE.Vector3; closedLoop?: boolean },
): THREE.BufferGeometry {
  const ringCount = rings.length;
  if (ringCount < 2) {
    throw new Error('buildLoftedControlCage requires at least 2 rings');
  }
  const segs = rings[0]!.length;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < ringCount; r++) {
    const ring = rings[r]!;
    if (ring.length !== segs) {
      throw new Error('All rings in buildLoftedControlCage must share identical segment counts');
    }
    for (let s = 0; s < segs; s++) {
      const p = ring[s]!;
      positions.push(p.x, p.y, p.z);
    }
  }

  const pushQuad = (a: number, b: number, c: number, d: number, altDiagonal: boolean) => {
    if (altDiagonal) {
      indices.push(a, b, d, b, c, d);
    } else {
      indices.push(a, b, c, a, c, d);
    }
  };

  const loopSegments = caps.closedLoop ? ringCount : ringCount - 1;
  for (let r = 0; r < loopSegments; r++) {
    const nextR = (r + 1) % ringCount;
    const row0 = r * segs;
    const row1 = nextR * segs;
    for (let s = 0; s < segs; s++) {
      const sNext = (s + 1) % segs;
      const a = row0 + s;
      const b = row0 + sNext;
      const c = row1 + sNext;
      const d = row1 + s;
      pushQuad(a, b, c, d, ((r + s) & 1) === 1);
    }
  }

  if (!caps.closedLoop) {
    if (caps.startPole) {
      const startIdx = positions.length / 3;
      positions.push(caps.startPole.x, caps.startPole.y, caps.startPole.z);
      for (let s = 0; s < segs; s++) {
        const sNext = (s + 1) % segs;
        indices.push(startIdx, sNext, s);
      }
    }
    if (caps.endPole) {
      const endIdx = positions.length / 3;
      positions.push(caps.endPole.x, caps.endPole.y, caps.endPole.z);
      const lastRow = (ringCount - 1) * segs;
      for (let s = 0; s < segs; s++) {
        const sNext = (s + 1) % segs;
        indices.push(endIdx, lastRow + s, lastRow + sNext);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

/**
 * Computes twist-free parallel-transport (Bishop) frames along a smooth 3D curve.
 */
function computeParallelFrames(
  curve: THREE.Curve<THREE.Vector3>,
  segments: number,
  preferredUp = new THREE.Vector3(0, 1, 0),
): {
  points: THREE.Vector3[];
  tangents: THREE.Vector3[];
  normals: THREE.Vector3[];
  binormals: THREE.Vector3[];
} {
  const points = curve.getSpacedPoints(segments);
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(segments, i + 1)]!;
    const t = new THREE.Vector3().subVectors(next, prev);
    if (t.lengthSq() < 1e-12) t.set(0, 0, -1);
    else t.normalize();
    tangents.push(t);
  }

  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];
  const t0 = tangents[0]!;
  const ref = Math.abs(t0.dot(preferredUp)) > 0.92 ? new THREE.Vector3(1, 0, 0) : preferredUp.clone();
  const b0 = new THREE.Vector3().crossVectors(t0, ref).normalize();
  const n0 = new THREE.Vector3().crossVectors(b0, t0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  for (let i = 1; i <= segments; i++) {
    const prevT = tangents[i - 1]!;
    const currT = tangents[i]!;
    const nextN = normals[i - 1]!.clone();
    axis.crossVectors(prevT, currT);
    const sinA = axis.length();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const cosA = clamp(prevT.dot(currT), -1, 1);
      quat.setFromAxisAngle(axis, Math.atan2(sinA, cosA));
      nextN.applyQuaternion(quat);
    }
    nextN.addScaledVector(currT, -nextN.dot(currT)).normalize();
    const nextB = new THREE.Vector3().crossVectors(currT, nextN).normalize();
    normals.push(nextN);
    binormals.push(nextB);
  }

  return { points, tangents, normals, binormals };
}

// ============================================================================
// 1. Warm Komorebi Skin & Garment Material Factories
// ============================================================================

/**
 * Applies `toonSurface` hints compatible with the shared `toon-soft` pipeline.
 * Skin meshes intentionally disable dark ink outlines (`outline: false`) so
 * stylized fingers and faces remain warm and soft instead of black-outlined.
 */
export function applyStylizedHumanSurfaceHint(
  mesh: THREE.Mesh,
  role: StylizedSurfaceRole = 'skin',
): THREE.Mesh {
  if (role === 'skin') {
    mesh.userData.toonSurface = {
      outline: false,
      roughness: 0.88,
      shading: 'smooth',
    };
  } else if (role === 'garment') {
    mesh.userData.toonSurface = {
      outline: false,
      roughness: 0.92,
      shading: 'smooth',
    };
  } else if (role === 'hair') {
    mesh.userData.toonSurface = {
      outline: false,
      roughness: 0.84,
      shading: 'smooth',
    };
  } else {
    mesh.userData.toonSurface = {
      outline: false,
      roughness: 0.78,
      shading: 'smooth',
    };
  }
  return mesh;
}

/**
 * Warm Komorebi matte-peach / handcrafted ceramic skin material with gentle
 * light-wrapping subsurface scatter via `ritual-optics` (`kind: 'skin'`).
 */
export function createStylizedSkinMaterial(
  options: StylizedSkinMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const baseColor =
    options.color !== undefined
      ? options.color
      : SKIN_TONE_PRESETS[options.tone ?? 'warm-apricot'];
  const roughness = clamp(options.roughness ?? 0.86, 0.74, 0.96);
  const scatter = options.scatterStrength ?? 0.12;
  const mat =
    scatter <= 0
      ? new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness,
          metalness: 0,
          vertexColors: options.vertexColors ?? true,
        })
      : createRitualMaterial(
          {
            color: baseColor,
            roughness,
            metalness: 0,
            vertexColors: options.vertexColors ?? true,
          },
          {
            kind: 'skin',
            strength: clamp(scatter, 0.04, 0.24),
            fiber: false,
          },
        );
  mat.name = options.name ?? 'stylized-human-skin';
  mat.userData.stylizedHuman = {
    role: 'skin' as StylizedSurfaceRole,
    tone: options.tone ?? 'warm-apricot',
  };
  return mat;
}

/**
 * Soft woven garment material combining `ritual-optics` (`kind: 'cloth'`) light
 * wrap with `craft-surfaces` (`kind: 'fabric'`) tactile weave and vertex-color
 * support for warm cuff-interior / hem ambient occlusion.
 */
export function createStylizedGarmentMaterial(
  options: StylizedGarmentMaterialOptions,
): THREE.MeshStandardMaterial {
  const roughness = clamp(options.roughness ?? 0.92, 0.82, 0.99);
  const mat = createRitualMaterial(
    {
      color: options.color,
      roughness,
      metalness: 0,
      vertexColors: options.vertexColors ?? true,
    },
    {
      kind: 'cloth',
      strength: clamp(options.scatterStrength ?? 0.07, 0, 0.20),
      fiber: false,
    },
  );
  applyCraftSurface(mat, {
    kind: 'fabric',
    strength: clamp(options.fabricStrength ?? 0.28, 0.08, 0.60),
    scale: options.fabricScale ?? 1.2,
    axis: options.axis ?? 'y',
  });
  mat.name = options.name ?? 'stylized-human-garment';
  mat.userData.stylizedHuman = {
    role: 'garment' as StylizedSurfaceRole,
  };
  return mat;
}

// ============================================================================
// 2. Stylized Hand, Finger, Thumb, Forearm & Sleeve Cuff Generators
// ============================================================================

/**
 * Generates a warm sculpted stylized palm via Loop subdivision:
 * gently arched dorsum, softly cupped palm with plump thenar & hypothenar pads,
 * natural wrist taper (+Z) and slightly curved knuckle line (-Z).
 */
export function createStylizedPalmGeometry(
  options: StylizedPalmOptions = {},
): THREE.BufferGeometry {
  const width = options.width ?? 0.24;
  const thickness = options.thickness ?? 0.076;
  const length = options.length ?? 0.26;
  const handedness = options.handedness ?? 'right';
  const palmUp = options.palmUp === true;
  const arch = options.arch ?? thickness * 0.14;
  const flatContactFace = options.flatContactFace === true;
  const radialSegments = Math.max(6, Math.round(options.radialSegments ?? 8));
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `palm|${roundKey(width)}|${roundKey(thickness)}|${roundKey(length)}|${handedness}|${palmUp ? 1 : 0}|${roundKey(arch)}|${flatContactFace ? 1 : 0}|${radialSegments}|${iterations}|${indexed ? 1 : 0}`;
  return cachedStylizedGeometry(cacheKey, () => {
  // For a right hand pointing -Z with palm facing down (-Y), thumb sits on -X;
  // when palm faces up (+Y), thumb flips to +X (or mirrored for left hand).
  const thumbSign = (handedness === 'right' ? -1 : 1) * (palmUp ? -1 : 1);
  const palmDir = palmUp ? 1 : -1;

  const halfW = width * 0.5;
  const halfT = thickness * 0.5;
  const halfL = length * 0.5;
  const flatBoost = flatContactFace ? 1.24 : 1.04;

  // Longitudinal stations from wrist base (+Z) to knuckle front (-Z).
  const stations: { z: number; rx: number; ry: number; yShift: number; thenar: number; cup: number }[] = [
    { z: halfL * 0.92, rx: halfW * 0.72, ry: halfT * 0.84, yShift: 0, thenar: 0.06, cup: 0.0 },
    { z: halfL * 0.44, rx: halfW * 1.02, ry: halfT * flatBoost, yShift: -palmDir * arch * 0.35, thenar: 0.26, cup: flatContactFace ? 0.0 : 0.12 },
    { z: -halfL * 0.18, rx: halfW * 1.12, ry: halfT * flatBoost, yShift: -palmDir * arch * 0.55, thenar: 0.12, cup: flatContactFace ? 0.0 : 0.16 },
    { z: -halfL * 0.80, rx: halfW * 1.02, ry: halfT * (flatContactFace ? 1.12 : 0.90), yShift: -palmDir * arch * 0.20, thenar: 0.0, cup: flatContactFace ? 0.0 : 0.05 },
  ];

  const rings: THREE.Vector3[][] = stations.map((st) => {
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Softly squared-oval palm cross section (superellipse-like warmth).
      const sqX = Math.sign(ca) * Math.pow(Math.abs(ca), 0.84);
      const sqY = Math.sign(sa) * Math.pow(Math.abs(sa), 0.88);

      let x = sqX * st.rx;
      let y = sqY * st.ry + st.yShift;
      // Subtle anatomical skew at knuckles (index/middle reach slightly farther forward).
      let z = st.z;
      if (st.z < 0) {
        const indexSide = clamp((x * thumbSign) / Math.max(halfW, 1e-4), -1, 1);
        z -= (0.045 * length) * (0.35 + 0.65 * Math.cos((indexSide - 0.22) * Math.PI * 0.55));
      }

      const isPalmSide = sa * palmDir > 0;
      const onThumbSide = ca * thumbSign > 0;
      if (isPalmSide) {
        // Plump thenar (thumb) and hypothenar (pinky) pads with a gentle central palm hollow.
        const padWeight = Math.sin(clamp(Math.abs(sa), 0, 1) * Math.PI * 0.5);
        const sideFactor = onThumbSide ? st.thenar : st.thenar * 0.62;
        const padBulge = sideFactor * Math.pow(Math.abs(ca), 1.2) * halfT * padWeight;
        const centerCup = st.cup * (1 - Math.abs(ca)) * halfT * padWeight;
        y += palmDir * (padBulge - centerCup);
        if (onThumbSide) {
          x += thumbSign * st.thenar * halfW * 0.22 * padWeight;
        }
      } else {
        // Soft convex dorsal hand arch.
        y -= palmDir * arch * (1 - Math.abs(ca) * 0.65) * Math.abs(sa);
      }

      ring.push(new THREE.Vector3(x, y, z));
    }
    return ring;
  });

  const startPole = new THREE.Vector3(0, 0, halfL * 1.06);
  const endPole = new THREE.Vector3(thumbSign * halfW * 0.06, -palmDir * arch * 0.10, -halfL * 1.05);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    postDeform: flatContactFace
      ? (p) => {
          // Ensure clean exact flush plane on palm face while keeping soft rounded sides.
          if (palmUp) {
            if (p.y > halfT) p.y = halfT;
            const radial = Math.hypot(p.x / (halfW * 0.88), p.z / (halfL * 0.88));
            if (radial < 1 && p.y > halfT * 0.68) {
              p.y = halfT;
            }
          } else {
            if (p.y < -halfT) p.y = -halfT;
            const radial = Math.hypot(p.x / (halfW * 0.88), p.z / (halfL * 0.88));
            if (radial < 1 && p.y < -halfT * 0.68) {
              p.y = -halfT;
            }
          }
        }
      : undefined,
    colorGenerator: (p, n, box) => {
      const zNorm = clamp((box.max.z - p.z) / Math.max(box.max.z - box.min.z, 1e-4), 0, 1);
      // Warm rosy-peach subtle tint toward palm pads and knuckles; soft warm AO at wrist crease.
      const wristShadow = (1 - smoothstep(0.0, 0.28, zNorm)) * 0.09;
      const palmWarmth = smoothstep(-0.1, 0.85, n.y * palmDir) * 0.045;
      const knuckleBlush = smoothstep(0.62, 1.0, zNorm) * 0.04;
      const r = clamp(1.0 + palmWarmth + knuckleBlush - wristShadow * 0.72, 0.82, 1.04);
      const g = clamp(1.0 - palmWarmth * 0.45 - knuckleBlush * 0.55 - wristShadow * 1.02, 0.78, 1.01);
      const b = clamp(1.0 - palmWarmth * 0.85 - knuckleBlush * 0.90 - wristShadow * 1.15, 0.74, 1.0);
      return [r, g, b];
    },
  });
  cage.dispose();
  return geo;
  });
}

/**
 * Generates a warm sculpted stylized finger via Loop subdivision:
 * three-phalanx subtle tapering, plump fingertip pad, softly rounded tip,
 * and natural gentle curl (or custom 3D grip curve).
 */
export function createStylizedFingerGeometry(
  options: StylizedFingerOptions = {},
): THREE.BufferGeometry {
  const length = options.length ?? 0.19;
  const rxBase = options.radiusX ?? 0.028;
  const ryBase = options.radiusY ?? 0.027;
  const curl = options.curl ?? 0.22;
  const curlSign = options.curlUp ? 1 : -1;
  const splay = options.splay ?? 0;
  const radialSegments = Math.max(6, Math.round(options.radialSegments ?? 6));
  const lengthSegments = Math.max(2, Math.round(options.lengthSegments ?? 3));
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `finger|${roundKey(length)}|${roundKey(rxBase)}|${roundKey(ryBase)}|${roundKey(curl)}|${curlSign}|${roundKey(splay)}|${radialSegments}|${lengthSegments}|${iterations}|${indexed ? 1 : 0}|${roundKey(options.flatTopY)}|${curveCacheKey(options.curve)}`;
  return cachedStylizedGeometry(cacheKey, () => {
  const curve =
    options.curve ??
    (() => {
      const pts: THREE.Vector3[] = [];
      const steps = 4;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        // Progressive natural phalanx curl: straighter proximal, gentler arc toward fingertip.
        const bendAngle = curl * Math.pow(u, 1.45);
        const z = -u * length * (1 - 0.12 * bendAngle * bendAngle);
        const y = curlSign * length * (0.28 * bendAngle * u);
        const x = splay * u * length;
        pts.push(new THREE.Vector3(x, y, z));
      }
      return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    })();

  const { points, tangents, normals, binormals } = computeParallelFrames(
    curve,
    lengthSegments,
    new THREE.Vector3(0, 1, 0),
  );

  // Build lofted rings with subtle phalanx contour: gentle knuckle warmth + rounded finger pad.
  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= lengthSegments; i++) {
    const u = i / lengthSegments;
    const p = points[i]!;
    const N = normals[i]!;
    const B = binormals[i]!;

    // Smooth taper from base (1.02) to delicate rounded tip (0.64), with subtle plump pad at u ~ 0.80.
    const taper = lerp(1.02, 0.72, smoothstep(0.0, 0.92, u));
    const knucklePulse = 1 + 0.04 * Math.sin(u * Math.PI * 2.2) * (1 - u * 0.5);
    const padFullness = 0.09 * Math.exp(-Math.pow((u - 0.82) / 0.16, 2));
    const endRound = u > 0.92 ? lerp(1.0, 0.76, (u - 0.92) / 0.08) : 1.0;

    const rx = rxBase * taper * knucklePulse * endRound;
    const ry = ryBase * taper * (1 + padFullness * 0.55) * endRound;

    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Slightly fuller finger pad on the curling side, smooth dorsal curve opposite.
      const padShift = sa * curlSign > 0 ? 1 + padFullness : 1 - padFullness * 0.25;
      const v = p
        .clone()
        .addScaledVector(B, ca * rx)
        .addScaledVector(N, sa * ry * padShift);
      ring.push(v);
    }
    rings.push(ring);
  }

  const baseCapLen = Math.min(rxBase, ryBase) * 0.75;
  const tipCapLen = Math.min(rxBase, ryBase) * 0.92;
  const startPole = points[0]!.clone().addScaledVector(tangents[0]!, -baseCapLen);
  const endPole = points[lengthSegments]!.clone().addScaledVector(tangents[lengthSegments]!, tipCapLen);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  const startPt = points[0]!;
  const endPt = points[lengthSegments]!;
  const totalChord = Math.max(startPt.distanceTo(endPt), 1e-4);

  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    postDeform:
      options.flatTopY !== undefined
        ? (p) => {
            if (p.y > options.flatTopY!) p.y = options.flatTopY!;
          }
        : undefined,
    colorGenerator: (p) => {
      const u = clamp(p.distanceTo(startPt) / totalChord, 0, 1);
      // Warm storybook peach blush at fingertip; gentle warm knuckle-base shading at root.
      const tipBlush = smoothstep(0.55, 1.0, u) * 0.065;
      const baseAO = (1 - smoothstep(0.0, 0.22, u)) * 0.075;
      const r = clamp(1.0 + tipBlush - baseAO * 0.65, 0.86, 1.05);
      const g = clamp(1.0 - tipBlush * 0.62 - baseAO * 0.95, 0.82, 1.01);
      const b = clamp(1.0 - tipBlush * 0.98 - baseAO * 1.12, 0.78, 1.0);
      return [r, g, b];
    },
  });
  cage.dispose();
  return geo;
  });
}

/**
 * Generates a warm sculpted stylized thumb with fuller metacarpal base, gentle
 * opposition arc, and plump rounded thumb pad.
 */
export function createStylizedThumbGeometry(
  options: StylizedThumbOptions = {},
): THREE.BufferGeometry {
  const length = options.length ?? 0.15;
  const rx = options.radiusX ?? 0.034;
  const ry = options.radiusY ?? 0.032;
  const curl = options.curl ?? 0.26;
  const curlSign = options.curlUp ? 1 : -1;
  const opposition = options.opposition ?? 0.015;
  const radialSegments = Math.max(6, Math.round(options.radialSegments ?? 6));
  const iterations = options.iterations ?? 1;

  const curve =
    options.curve ??
    new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(opposition * 0.45, curlSign * length * 0.04, -length * 0.36),
        new THREE.Vector3(opposition * 0.90, curlSign * length * 0.11, -length * 0.72),
        new THREE.Vector3(opposition * 0.72, curlSign * length * (0.14 + 0.18 * curl), -length),
      ],
      false,
      'centripetal',
    );

  return createStylizedFingerGeometry({
    curve,
    radiusX: rx,
    radiusY: ry,
    curlUp: options.curlUp,
    lengthSegments: options.lengthSegments ?? 2,
    radialSegments,
    iterations,
    indexed: options.indexed,
    flatTopY: options.flatTopY,
  });
}

/**
 * Generates a smooth anatomical forearm transitioning organically from wrist
 * (`z = 0`) toward elbow/sleeve interior (`z = length`).
 */
export function createStylizedForearmGeometry(
  options: StylizedForearmOptions = {},
): THREE.BufferGeometry {
  const length = options.length ?? 0.55;
  const wristRX = options.wristRadiusX ?? 0.085;
  const wristRY = options.wristRadiusY ?? 0.062;
  const elbowRX = options.elbowRadiusX ?? 0.118;
  const elbowRY = options.elbowRadiusY ?? 0.092;
  const fullness = options.fullness ?? 0.08;
  const radialSegments = Math.max(8, Math.round(options.radialSegments ?? 8));
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `forearm|${roundKey(length)}|${roundKey(wristRX)}|${roundKey(wristRY)}|${roundKey(elbowRX)}|${roundKey(elbowRY)}|${roundKey(fullness)}|${radialSegments}|${iterations}|${indexed ? 1 : 0}`;
  return cachedStylizedGeometry(cacheKey, () => {
  const tSteps = [0.05, 0.24, 0.52, 0.78, 0.96];
  const rings: THREE.Vector3[][] = tSteps.map((u) => {
    const z = u * length;
    const bulge = 1 + fullness * Math.sin(Math.pow(u, 0.85) * Math.PI);
    const rx = lerp(wristRX, elbowRX, smoothstep(0.05, 0.92, u)) * bulge;
    const ry = lerp(wristRY, elbowRY, smoothstep(0.05, 0.92, u)) * bulge;
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      // Subtle oval smoothing for a natural wrist-to-forearm contour.
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ring.push(new THREE.Vector3(ca * rx, sa * ry, z));
    }
    return ring;
  });

  const startPole = new THREE.Vector3(0, 0, -Math.min(wristRX, wristRY) * 0.45);
  const endPole = new THREE.Vector3(0, 0, length + Math.min(elbowRX, elbowRY) * 0.35);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    colorGenerator: (p, n, box) => {
      const u = clamp((p.z - box.min.z) / Math.max(box.max.z - box.min.z, 1e-4), 0, 1);
      // Warm gentle shadow where forearm enters the sleeve cuff mouth (+Z).
      const sleeveAO = smoothstep(0.68, 1.0, u) * 0.14;
      const underAO = smoothstep(0.0, -0.85, n.y) * 0.05;
      const shade = clamp(1 - sleeveAO - underAO, 0.78, 1.0);
      return [
        clamp(shade * 1.01, 0.80, 1.0),
        clamp(shade * 0.98, 0.76, 1.0),
        clamp(shade * 0.95, 0.72, 1.0),
      ];
    },
  });
  cage.dispose();
  return geo;
  });
}

/**
 * Generates a closed 2-manifold thick-walled garment sleeve with a softly rolled
 * cuff lip at `z = 0`, subtle fabric drapery folds along `+Z`, and a recessed
 * warm-shadowed inner sleeve cavity so the wrist emerges naturally from cloth.
 */
export function createStylizedSleeveCuffGeometry(
  options: StylizedSleeveCuffOptions = {},
): THREE.BufferGeometry {
  const length = options.length ?? 0.42;
  const cuffRX = options.cuffRadiusX ?? 0.115;
  const cuffRY = options.cuffRadiusY ?? 0.095;
  const sleeveRX = options.sleeveRadiusX ?? 0.148;
  const sleeveRY = options.sleeveRadiusY ?? 0.126;
  const wall = clamp(options.wallThickness ?? 0.016, 0.004, Math.min(cuffRX, cuffRY) * 0.45);
  const rolledLip = options.rolledLip ?? wall * 0.62;
  const foldDepth = options.foldDepth ?? 0.006;
  const cavityDepth = length * clamp(options.cavityDepthRatio ?? 0.42, 0.20, 0.75);
  const radialSegments = Math.max(8, Math.round(options.radialSegments ?? 10));
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `sleeve|${roundKey(length)}|${roundKey(cuffRX)}|${roundKey(cuffRY)}|${roundKey(sleeveRX)}|${roundKey(sleeveRY)}|${roundKey(wall)}|${roundKey(rolledLip)}|${roundKey(foldDepth)}|${roundKey(cavityDepth)}|${radialSegments}|${iterations}|${indexed ? 1 : 0}`;
  return cachedStylizedGeometry(cacheKey, () => {
  // Ordered cross-section profile around the thick sleeve wall:
  // Proximal end (+Z) -> outer sleeve body -> rolled cuff lip -> inner wall -> cavity floor.
  const stations: { z: number; rx: number; ry: number; fold: number; isInner: boolean }[] = [
    { z: length * 0.98, rx: sleeveRX, ry: sleeveRY, fold: 0.7, isInner: false },
    { z: length * 0.62, rx: lerp(cuffRX, sleeveRX, 0.62), ry: lerp(cuffRY, sleeveRY, 0.62), fold: 1.0, isInner: false },
    { z: length * 0.24, rx: lerp(cuffRX, sleeveRX, 0.22), ry: lerp(cuffRY, sleeveRY, 0.22), fold: 0.85, isInner: false },
    { z: length * 0.06, rx: cuffRX + rolledLip * 0.75, ry: cuffRY + rolledLip * 0.75, fold: 0.45, isInner: false },
    { z: -rolledLip * 0.35, rx: cuffRX + rolledLip * 0.22, ry: cuffRY + rolledLip * 0.22, fold: 0.2, isInner: false },
    { z: -rolledLip * 0.10, rx: Math.max(0.006, cuffRX - wall * 0.75), ry: Math.max(0.006, cuffRY - wall * 0.75), fold: 0.1, isInner: true },
    { z: cavityDepth * 0.48, rx: Math.max(0.006, cuffRX - wall * 1.15), ry: Math.max(0.006, cuffRY - wall * 1.15), fold: 0.0, isInner: true },
    { z: cavityDepth, rx: Math.max(0.005, (cuffRX - wall) * 0.62), ry: Math.max(0.005, (cuffRY - wall) * 0.62), fold: 0.0, isInner: true },
  ];

  const rings: THREE.Vector3[][] = stations.map((st) => {
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const wave =
        st.fold *
        foldDepth *
        (0.65 * Math.sin(a * 4 + st.z * 5.0) + 0.35 * Math.cos(a * 3 - st.z * 3.2));
      const rx = Math.max(0.004, st.rx + wave);
      const ry = Math.max(0.004, st.ry + wave);
      ring.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, st.z));
    }
    return ring;
  });

  // Closed watertight caps at the proximal end (+Z) and recessed inner cavity floor.
  const startPole = new THREE.Vector3(0, 0, length * 1.02);
  const endPole = new THREE.Vector3(0, 0, cavityDepth + wall * 0.45);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  const innerRefRX = Math.max(0.006, cuffRX - wall * 0.55);
  const innerRefRY = Math.max(0.006, cuffRY - wall * 0.55);

  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    colorGenerator: (p, n) => {
      // Detect inner cuff wall by inward-pointing radial normal & radius inside mouth.
      const radNorm = Math.hypot(p.x / innerRefRX, p.y / innerRefRY);
      const radialLen = Math.hypot(p.x, p.y);
      const radialDot = radialLen > 1e-5 ? (p.x * n.x + p.y * n.y) / radialLen : 0;
      const inward = smoothstep(0.05, -0.55, radialDot);
      const insideRadius = 1 - smoothstep(0.95, 1.15, radNorm);
      const mouthProximity = 1 - smoothstep(0.0, cavityDepth * 1.05, p.z);
      const interiorDepth = smoothstep(-rolledLip * 0.2, cavityDepth * 0.85, p.z);

      // Warm shadowed cuff interior AO so the emerging wrist reads cleanly.
      const innerAO = inward * insideRadius * (0.24 + 0.28 * interiorDepth) * (0.4 + 0.6 * mouthProximity);
      // Subtle cuff-fold highlight along rolled outer rim.
      const rimHighlight = (1 - smoothstep(0.0, length * 0.14, Math.abs(p.z))) * (1 - inward) * 0.035;
      const underShade = smoothstep(-0.1, -0.85, n.y) * 0.08 * (1 - inward);

      const shade = clamp(1 - innerAO - underShade + rimHighlight, 0.48, 1.04);
      // Shift shadow subtly toward warm umber rather than muddy gray.
      return [
        clamp(shade * (1 + innerAO * 0.08), 0.50, 1.04),
        clamp(shade * (1 - innerAO * 0.04), 0.46, 1.03),
        clamp(shade * (1 - innerAO * 0.14), 0.42, 1.02),
      ];
    },
  });
  cage.dispose();
  return geo;
  });
}

/**
 * Convenience assembler creating a complete, articulated stylized hand group
 * (`palm`, 4 `fingers`, `thumb`, and optional `forearm`, `cuff`, `sleeve`).
 */
export function buildStylizedHandRig(options: StylizedHandRigOptions = {}): StylizedHandRig {
  const prefix = options.namePrefix ?? 'stylized-hand';
  const handedness = options.handedness ?? 'right';
  const scale = options.scale ?? 1;
  const palmUp = options.palmUp === true;
  const pose = options.pose ?? 'gentle-rest';
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const skinMat = options.skinMaterial ?? createStylizedSkinMaterial();
  const garmentMat =
    options.garmentMaterial ?? createStylizedGarmentMaterial({ color: 0x6b9496 });
  const cuffMat = options.cuffMaterial ?? garmentMat;

  const root = new THREE.Group();
  root.name = prefix;

  const thumbSign = (handedness === 'right' ? -1 : 1) * (palmUp ? -1 : 1);
  const palmW = 0.24 * scale;
  const palmT = 0.076 * scale;
  const palmL = 0.26 * scale;

  const palmGeo = createStylizedPalmGeometry({
    width: palmW,
    thickness: palmT,
    length: palmL,
    handedness,
    palmUp,
    iterations,
    indexed,
  });
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.name = `${prefix}-palm`;
  palm.castShadow = palm.receiveShadow = true;
  applyStylizedHumanSurfaceHint(palm, 'skin');
  root.add(palm);

  const curlByPose: Record<StylizedHandPosePreset, number> = {
    open: 0.08,
    'gentle-rest': 0.22,
    stroke: 0.26,
    cup: 0.36,
    offer: 0.16,
  };
  const baseCurl = curlByPose[pose];
  const fingerRatios = [0.76, 0.86, 0.80, 0.64];
  const fingerThick = [0.98, 1.02, 0.96, 0.84];
  const fingers: THREE.Mesh[] = [];

  for (let i = 0; i < 4; i++) {
    // Index (i=0) sits on thumbSign side, pinky (i=3) on -thumbSign side.
    const slot = 1.5 - i;
    const x = thumbSign * slot * (palmW * 0.245);
    const zBase = -palmL * (0.43 + (i === 1 ? 0.03 : i === 3 ? -0.04 : 0));
    const len = palmL * fingerRatios[i]!;
    const r = 0.028 * scale * fingerThick[i]!;
    const fGeo = createStylizedFingerGeometry({
      length: len,
      radiusX: r,
      radiusY: r * 0.94,
      curl: baseCurl * (0.9 + i * 0.08),
      curlUp: palmUp,
      splay: thumbSign * (slot * 0.045),
      iterations,
      indexed,
    });
    const finger = new THREE.Mesh(fGeo, skinMat);
    finger.name = `${prefix}-finger-${i}`;
    finger.position.set(x, (palmUp ? 0.004 : -0.004) * scale, zBase);
    finger.castShadow = finger.receiveShadow = true;
    applyStylizedHumanSurfaceHint(finger, 'skin');
    root.add(finger);
    fingers.push(finger);
  }

  const thumbGeo = createStylizedThumbGeometry({
    length: palmL * 0.56,
    radiusX: 0.034 * scale,
    radiusY: 0.031 * scale,
    curl: baseCurl * 0.85,
    curlUp: palmUp,
    opposition: -thumbSign * 0.018 * scale,
    iterations,
    indexed,
  });
  const thumb = new THREE.Mesh(thumbGeo, skinMat);
  thumb.name = `${prefix}-thumb`;
  thumb.position.set(thumbSign * palmW * 0.46, (palmUp ? 0.008 : -0.008) * scale, palmL * 0.08);
  thumb.rotation.y = thumbSign * 0.52;
  thumb.castShadow = thumb.receiveShadow = true;
  applyStylizedHumanSurfaceHint(thumb, 'skin');
  root.add(thumb);

  let forearm: THREE.Mesh | undefined;
  let cuff: THREE.Mesh | undefined;
  let sleeve: THREE.Mesh | undefined;

  if (options.includeForearm) {
    const forearmGeo = createStylizedForearmGeometry({
      length: 0.48 * scale,
      wristRadiusX: palmW * 0.34,
      wristRadiusY: palmT * 0.44,
      elbowRadiusX: palmW * 0.46,
      elbowRadiusY: palmT * 0.58,
      iterations,
      indexed,
    });
    forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.name = `${prefix}-forearm`;
    forearm.position.set(0, 0, palmL * 0.44);
    forearm.castShadow = forearm.receiveShadow = true;
    applyStylizedHumanSurfaceHint(forearm, 'skin');
    root.add(forearm);
  }

  if (options.includeCuff) {
    const cuffGeo = createStylizedSleeveCuffGeometry({
      length: 0.14 * scale,
      cuffRadiusX: palmW * 0.48,
      cuffRadiusY: palmT * 0.66,
      sleeveRadiusX: palmW * 0.52,
      sleeveRadiusY: palmT * 0.72,
      wallThickness: 0.016 * scale,
      iterations,
      indexed,
    });
    cuff = new THREE.Mesh(cuffGeo, cuffMat);
    cuff.name = `${prefix}-cuff`;
    cuff.position.set(0, 0, palmL * (options.includeForearm ? 1.42 : 0.56));
    cuff.castShadow = cuff.receiveShadow = true;
    applyStylizedHumanSurfaceHint(cuff, 'garment');
    root.add(cuff);
  }

  if (options.includeSleeve) {
    const sleeveGeo = createStylizedSleeveCuffGeometry({
      length: 0.48 * scale,
      cuffRadiusX: palmW * 0.50,
      cuffRadiusY: palmT * 0.68,
      sleeveRadiusX: palmW * 0.64,
      sleeveRadiusY: palmT * 0.86,
      wallThickness: 0.018 * scale,
      iterations,
      indexed,
    });
    sleeve = new THREE.Mesh(sleeveGeo, garmentMat);
    sleeve.name = `${prefix}-sleeve`;
    sleeve.position.set(0, 0, palmL * (options.includeForearm ? 1.72 : 0.64));
    sleeve.castShadow = sleeve.receiveShadow = true;
    applyStylizedHumanSurfaceHint(sleeve, 'garment');
    root.add(sleeve);
  }

  return { root, palm, fingers, thumb, forearm, cuff, sleeve };
}

// ============================================================================
// 3. Full-Body Stylized Figure & Seated Statue Components (Wave 2 Ready)
// ============================================================================

/**
 * Generates a warm storybook / handcrafted wooden-ceramic stylized head:
 * soft ovoid cranium, gentle rosy cheeks, rounded chin, and a subtle sculpted
 * nose tip without uncanny-valley sockets or harsh crevices.
 * Local origin sits at head center; `+Z` faces forward, `+Y` is up.
 */
export function createStylizedHeadGeometry(
  options: StylizedHeadOptions = {},
): THREE.BufferGeometry {
  const width = options.width ?? 0.22;
  const height = options.height ?? 0.26;
  const depth = options.depth ?? 0.23;
  const cheekFullness = options.cheekFullness ?? 0.12;
  const noseProminence = clamp(options.noseProminence ?? 0.45, 0, 1);
  const chinTaper = clamp(options.chinTaper ?? 0.18, 0, 0.45);
  const radialSegments = Math.max(8, Math.round(options.radialSegments ?? 10));
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `head|${roundKey(width)}|${roundKey(height)}|${roundKey(depth)}|${roundKey(cheekFullness)}|${roundKey(noseProminence)}|${roundKey(chinTaper)}|${radialSegments}|${iterations}|${indexed ? 1 : 0}`;
  return cachedStylizedGeometry(cacheKey, () => {
  const rx = width * 0.5;
  const ry = height * 0.5;
  const rz = depth * 0.5;

  // Vertical elevation latitudes from chin (-1) to crown (+1).
  const latProfile: { y: number; sx: number; sz: number; zOffset: number; cheek: number; nose: number }[] = [
    { y: -0.78, sx: 0.54 - chinTaper * 0.35, sz: 0.58, zOffset: 0.05 * rz, cheek: 0.0, nose: 0.0 },
    { y: -0.34, sx: 0.90 + cheekFullness * 0.55, sz: 0.92, zOffset: 0.04 * rz, cheek: 1.0, nose: 0.22 },
    { y: 0.02, sx: 0.99, sz: 1.00, zOffset: 0.01 * rz, cheek: 0.55, nose: 1.0 },
    { y: 0.44, sx: 0.94, sz: 0.97, zOffset: -0.02 * rz, cheek: 0.0, nose: 0.12 },
    { y: 0.80, sx: 0.62, sz: 0.66, zOffset: -0.03 * rz, cheek: 0.0, nose: 0.0 },
  ];

  const rings: THREE.Vector3[][] = latProfile.map((st) => {
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      // Angle a = 0 points toward +Z (face front).
      const a = (s / radialSegments) * Math.PI * 2;
      const sinA = Math.sin(a);
      const cosA = Math.cos(a);
      let x = sinA * rx * st.sx;
      let z = cosA * rz * st.sz + st.zOffset;

      // Warm storybook cheek softness at ±42° on the front face.
      const cheekMask = Math.max(0, cosA) * Math.pow(Math.abs(sinA), 1.1) * st.cheek;
      x += Math.sign(sinA) * cheekMask * cheekFullness * rx * 0.45;
      z += cheekMask * cheekFullness * rz * 0.28;

      // Gentle soft nose-tip prominence right at front center (a = 0).
      const frontPeak = Math.pow(Math.max(0, cosA), 7);
      z += frontPeak * st.nose * noseProminence * rz * 0.16;

      ring.push(new THREE.Vector3(x, st.y * ry, z));
    }
    return ring;
  });

  const startPole = new THREE.Vector3(0, -ry, 0.04 * rz);
  const endPole = new THREE.Vector3(0, ry, -0.02 * rz);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    colorGenerator: (p, n, box) => {
      const yNorm = clamp((p.y - box.min.y) / Math.max(box.max.y - box.min.y, 1e-4), 0, 1);
      // Warm soft storybook cheek blush on lower-mid front cheeks.
      const nx = Math.abs(p.x) / Math.max(rx, 1e-4);
      const nz = p.z / Math.max(rz, 1e-4);
      const cheekBlush =
        Math.exp(-Math.pow((nx - 0.56) / 0.34, 2)) *
        Math.exp(-Math.pow((yNorm - 0.38) / 0.18, 2)) *
        smoothstep(0.15, 0.72, nz) *
        0.095;
      const chinShadow = smoothstep(-0.25, -0.92, n.y) * 0.09;
      return [
        clamp(1.0 + cheekBlush - chinShadow * 0.65, 0.84, 1.06),
        clamp(1.0 - cheekBlush * 0.65 - chinShadow * 0.95, 0.80, 1.01),
        clamp(1.0 - cheekBlush * 0.92 - chinShadow * 1.12, 0.76, 1.0),
      ];
    },
  });
  cage.dispose();
  return geo;
  });
}

/**
 * Generates a closed 2-manifold sculpted hair mass or traditional cap base
 * designed to hug `createStylizedHeadGeometry` cleanly.
 */
export function createStylizedHairGeometry(
  options: StylizedHairOptions = {},
): THREE.BufferGeometry {
  const style = options.style ?? 'short';
  const rx = (options.headWidth ?? 0.22) * 0.5;
  const ry = (options.headHeight ?? 0.26) * 0.5;
  const rz = (options.headDepth ?? 0.23) * 0.5;
  const vol = options.volume ?? 0.022;
  const radialSegments = Math.max(8, Math.round(options.radialSegments ?? 10));
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `hair|${style}|${roundKey(rx)}|${roundKey(ry)}|${roundKey(rz)}|${roundKey(vol)}|${radialSegments}|${iterations}|${indexed ? 1 : 0}`;
  return cachedStylizedGeometry(cacheKey, () => {
  const isBun = style === 'bun';
  const isTopknot = style === 'topknot';
  const isBob = style === 'bob';
  const isCap = style === 'cap-base';

  const latLevels: { y: number; sx: number; sz: number; zShift: number; wave: number }[] =
    isBun || isTopknot
      ? [
          { y: -0.25, sx: 0.94, sz: 0.96, zShift: -0.05 * rz, wave: 0.004 },
          { y: 0.20, sx: 1.04, sz: 1.06, zShift: -0.04 * rz, wave: 0.005 },
          { y: 0.68, sx: 0.96, sz: 0.98, zShift: -0.04 * rz, wave: 0.004 },
          // Neck of the bun / topknot
          { y: 0.96, sx: isTopknot ? 0.44 : 0.36, sz: isTopknot ? 0.44 : 0.38, zShift: isTopknot ? -0.02 * rz : -0.18 * rz, wave: 0.002 },
          // Plump bun dome
          { y: isTopknot ? 1.24 : 1.18, sx: isTopknot ? 0.46 : 0.44, sz: isTopknot ? 0.46 : 0.46, zShift: isTopknot ? -0.02 * rz : -0.22 * rz, wave: 0.003 },
        ]
      : isBob
        ? [
            { y: -0.64, sx: 1.12, sz: 1.06, zShift: -0.08 * rz, wave: 0.008 },
            { y: -0.20, sx: 1.14, sz: 1.12, zShift: -0.06 * rz, wave: 0.007 },
            { y: 0.32, sx: 1.10, sz: 1.10, zShift: -0.04 * rz, wave: 0.006 },
            { y: 0.78, sx: 0.82, sz: 0.84, zShift: -0.03 * rz, wave: 0.003 },
          ]
        : isCap
          ? [
              // Warm rolled winter/festive brim cap
              { y: 0.12, sx: 1.18, sz: 1.18, zShift: -0.02 * rz, wave: 0.005 },
              { y: 0.34, sx: 1.22, sz: 1.22, zShift: -0.02 * rz, wave: 0.004 },
              { y: 0.56, sx: 1.02, sz: 1.04, zShift: -0.02 * rz, wave: 0.004 },
              { y: 0.96, sx: 0.76, sz: 0.78, zShift: -0.02 * rz, wave: 0.003 },
            ]
          : [
              // Classic warm short hair crown
              { y: -0.24, sx: 1.02, sz: 1.04, zShift: -0.06 * rz, wave: 0.007 },
              { y: 0.16, sx: 1.08, sz: 1.10, zShift: -0.04 * rz, wave: 0.008 },
              { y: 0.60, sx: 1.02, sz: 1.04, zShift: -0.03 * rz, wave: 0.006 },
              { y: 0.92, sx: 0.68, sz: 0.70, zShift: -0.02 * rz, wave: 0.003 },
            ];

  const rings: THREE.Vector3[][] = latLevels.map((st, idx) => {
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const sinA = Math.sin(a);
      const cosA = Math.cos(a);
      // Lift the front hairline over the face so cheeks & nose remain cleanly visible.
      const frontMask = Math.max(0, cosA);
      let yLift = 0;
      let radialPull = 1;
      if (idx === 0 && !isCap) {
        yLift = frontMask * (isBob ? 0.88 : 0.70) * ry;
        radialPull = 1 - frontMask * (isBob ? 0.10 : 0.12);
      } else if (idx === 1 && isBob) {
        yLift = frontMask * 0.42 * ry;
      }

      const lockRipple = st.wave * Math.sin(a * 5 + idx * 0.9);
      const x = sinA * (rx * st.sx + vol + lockRipple) * radialPull;
      const z = cosA * (rz * st.sz + vol + lockRipple) * radialPull + st.zShift;
      ring.push(new THREE.Vector3(x, st.y * ry + yLift, z));
    }
    return ring;
  });

  const startPole = new THREE.Vector3(0, isCap ? 0.16 * ry : -0.18 * ry, -0.14 * rz);
  const topY = isTopknot ? 1.46 * ry : isBun ? 1.38 * ry : isCap ? 1.16 * ry : 1.08 * ry;
  const topZ = isBun ? -0.22 * rz : -0.02 * rz;
  const endPole = new THREE.Vector3(0, topY, topZ);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    colorGenerator: (p, n, box) => {
      const yNorm = clamp((p.y - box.min.y) / Math.max(box.max.y - box.min.y, 1e-4), 0, 1);
      const crownLift = smoothstep(0.55, 1.0, yNorm) * 0.08;
      const underAO = smoothstep(-0.1, -0.8, n.y) * 0.14;
      const shade = clamp(1 + crownLift - underAO, 0.78, 1.08);
      return [shade, shade * 0.985, shade * 0.97];
    },
  });
  cage.dispose();
  return geo;
  });
}

/**
 * Generates a warm sculpted stylized garment torso (`y = 0` lower hem to
 * `y = height` shoulder/collar top) with gentle tapered waist, dropped storybook
 * shoulders, subtle fabric pleats, and collar styling (`round`, `crossed`, `mandarin`, `robe`).
 */
export function createStylizedTorsoGeometry(
  options: StylizedTorsoOptions = {},
): THREE.BufferGeometry {
  const shoulderW = options.shoulderWidth ?? 0.38;
  const waistW = options.waistWidth ?? 0.28;
  const hemW = options.hemWidth ?? 0.34;
  const depth = options.depth ?? 0.21;
  const height = options.height ?? 0.52;
  const collarStyle = options.collarStyle ?? 'round';
  const foldDepth = options.foldDepth ?? 0.010;
  const radialSegments = Math.max(8, Math.round(options.radialSegments ?? 10));
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `torso|${roundKey(shoulderW)}|${roundKey(waistW)}|${roundKey(hemW)}|${roundKey(depth)}|${roundKey(height)}|${collarStyle}|${roundKey(foldDepth)}|${radialSegments}|${iterations}|${indexed ? 1 : 0}`;
  return cachedStylizedGeometry(cacheKey, () => {
  const isRobe = collarStyle === 'robe';
  const isMandarin = collarStyle === 'mandarin';
  const isCrossed = collarStyle === 'crossed';

  const levels: { y: number; rx: number; rz: number; fold: number; collarLapel?: number }[] = [
    { y: height * 0.04, rx: hemW * (isRobe ? 0.58 : 0.50), rz: depth * (isRobe ? 0.62 : 0.52), fold: 1.0 },
    { y: height * 0.28, rx: waistW * (isRobe ? 0.55 : 0.50), rz: depth * 0.49, fold: 0.65 },
    { y: height * 0.58, rx: lerp(waistW, shoulderW, 0.58) * 0.5, rz: depth * 0.54, fold: 0.32, collarLapel: isCrossed ? 1 : 0 },
    { y: height * 0.84, rx: shoulderW * 0.5, rz: depth * 0.48, fold: 0.14, collarLapel: isCrossed ? 0.8 : 0 },
    { y: height * (isMandarin ? 1.02 : 0.96), rx: shoulderW * (isMandarin ? 0.24 : 0.28), rz: depth * (isMandarin ? 0.34 : 0.38), fold: 0.0 },
  ];

  const rings: THREE.Vector3[][] = levels.map((st, idx) => {
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const sinA = Math.sin(a);
      const cosA = Math.cos(a);
      // Soft squircle torso profile for cozy tunic volume.
      const sqX = Math.sign(sinA) * Math.pow(Math.abs(sinA), 0.88);
      const sqZ = Math.sign(cosA) * Math.pow(Math.abs(cosA), 0.92);
      const pleat =
        st.fold * foldDepth * (0.65 * Math.sin(a * 5 + idx * 0.4) + 0.35 * Math.cos(a * 3));
      // Subtle asymmetric front lapel rise for crossed collar (kimono / hanfu / vest).
      let lapelBump = 0;
      if (st.collarLapel && cosA > 0.2) {
        lapelBump = st.collarLapel * 0.012 * Math.max(0, cosA) * (sinA > 0 ? 1.0 : 0.4);
      }
      const x = sqX * (st.rx + pleat);
      const z = sqZ * (st.rz + pleat) + lapelBump;
      ring.push(new THREE.Vector3(x, st.y, z));
    }
    return ring;
  });

  const startPole = new THREE.Vector3(0, 0, 0);
  const endPole = new THREE.Vector3(0, height * (isMandarin ? 1.06 : 1.0), 0);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    colorGenerator: (p, n, box) => {
      const yNorm = clamp((p.y - box.min.y) / Math.max(box.max.y - box.min.y, 1e-4), 0, 1);
      const hemShadow = (1 - smoothstep(0.0, 0.22, yNorm)) * 0.14;
      const collarShadow = smoothstep(0.86, 1.0, yNorm) * 0.10;
      const underAO = smoothstep(-0.1, -0.85, n.y) * 0.10;
      const shade = clamp(1 - hemShadow - collarShadow - underAO, 0.72, 1.02);
      return [
        clamp(shade * 1.01, 0.74, 1.02),
        clamp(shade * 0.985, 0.71, 1.01),
        clamp(shade * 0.95, 0.68, 1.0),
      ];
    },
  });
  cage.dispose();
  return geo;
  });
}

/**
 * Generates a softly draped stylized limb (trouser leg or clothed upper/lower arm)
 * running from `y = 0` down to `y = -length` with gentle natural joint bend and
 * cloth folds.
 */
export function createStylizedLimbGeometry(
  options: StylizedLimbOptions = {},
): THREE.BufferGeometry {
  const length = options.length ?? 0.44;
  const topR = options.topRadius ?? 0.088;
  const botR = options.bottomRadius ?? 0.058;
  const depthRatio = options.depthRatio ?? 1.06;
  const bend = options.bend ?? 0.12;
  const foldDepth = options.foldDepth ?? 0.005;
  const radialSegments = Math.max(6, Math.round(options.radialSegments ?? 8));
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `limb|${roundKey(length)}|${roundKey(topR)}|${roundKey(botR)}|${roundKey(depthRatio)}|${roundKey(bend)}|${roundKey(foldDepth)}|${radialSegments}|${iterations}|${indexed ? 1 : 0}`;
  return cachedStylizedGeometry(cacheKey, () => {
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -length * 0.34, length * bend * 0.24),
      new THREE.Vector3(0, -length * 0.68, length * bend * 0.32),
      new THREE.Vector3(0, -length, length * bend * 0.12),
    ],
    false,
    'centripetal',
  );
  const segs = 4;
  const { points, tangents, normals, binormals } = computeParallelFrames(
    curve,
    segs,
    new THREE.Vector3(0, 0, 1),
  );

  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const r = lerp(topR, botR, smoothstep(0.0, 1.0, u)) * (1 + 0.05 * Math.sin(u * Math.PI));
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const drape = foldDepth * Math.sin(a * 4 + u * Math.PI * 2) * Math.sin(u * Math.PI);
      const v = points[i]!
        .clone()
        .addScaledVector(binormals[i]!, Math.cos(a) * (r + drape))
        .addScaledVector(normals[i]!, Math.sin(a) * (r * depthRatio + drape));
      ring.push(v);
    }
    rings.push(ring);
  }

  const startPole = points[0]!.clone().addScaledVector(tangents[0]!, -topR * 0.45);
  const endPole = points[segs]!.clone().addScaledVector(tangents[segs]!, botR * 0.45);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    colorGenerator: (p, _n, box) => {
      const yNorm = clamp((p.y - box.min.y) / Math.max(box.max.y - box.min.y, 1e-4), 0, 1);
      const cuffAO = (1 - smoothstep(0.0, 0.20, yNorm)) * 0.12;
      const topAO = smoothstep(0.84, 1.0, yNorm) * 0.10;
      const shade = clamp(1 - cuffAO - topAO, 0.78, 1.0);
      return [shade * 1.01, shade * 0.99, shade * 0.96];
    },
  });
  cage.dispose();
  return geo;
  });
}

/**
 * Generates a warm rounded storybook cloth shoe / soft boot grounded cleanly at
 * `y = 0` (`min.y === 0`), heel toward `-Z`, rounded toe toward `+Z`.
 */
export function createStylizedShoeGeometry(
  options: StylizedShoeOptions = {},
): THREE.BufferGeometry {
  const length = options.length ?? 0.21;
  const width = options.width ?? 0.095;
  const height = options.height ?? 0.082;
  const toeLift = options.toeLift ?? 0.008;
  const radialSegments = Math.max(8, Math.round(options.radialSegments ?? 8));
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `shoe|${roundKey(length)}|${roundKey(width)}|${roundKey(height)}|${roundKey(toeLift)}|${radialSegments}|${iterations}|${indexed ? 1 : 0}`;
  return cachedStylizedGeometry(cacheKey, () => {
  const halfW = width * 0.5;
  // Stations from heel (-Z) to rounded toe (+Z).
  const stations: { z: number; rx: number; topY: number; botY: number }[] = [
    { z: -length * 0.34, rx: halfW * 0.76, topY: height * 0.98, botY: height * 0.05 },
    { z: -length * 0.05, rx: halfW * 0.88, topY: height * 0.92, botY: height * 0.02 },
    { z: length * 0.28, rx: halfW * 1.02, topY: height * 0.64, botY: height * 0.02 },
    { z: length * 0.56, rx: halfW * 0.78, topY: height * 0.44 + toeLift, botY: toeLift * 0.9 },
  ];

  const rings: THREE.Vector3[][] = stations.map((st) => {
    const ring: THREE.Vector3[] = [];
    const midY = (st.topY + st.botY) * 0.5;
    const radY = (st.topY - st.botY) * 0.5;
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x = ca * st.rx;
      // Flatter grounded sole underneath (`sa < 0`), fuller rounded vamp on top (`sa > 0`).
      const y = sa < 0 ? midY - Math.pow(-sa, 0.65) * radY : midY + Math.pow(sa, 0.92) * radY;
      ring.push(new THREE.Vector3(x, y, st.z));
    }
    return ring;
  });

  const startPole = new THREE.Vector3(0, height * 0.45, -length * 0.42);
  const endPole = new THREE.Vector3(0, height * 0.24 + toeLift, length * 0.68);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  let minY = Infinity;
  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    postDeform: (p) => {
      if (p.y < minY) minY = p.y;
    },
    colorGenerator: (p, _n, box) => {
      const h = clamp((p.y - box.min.y) / Math.max(box.max.y - box.min.y, 1e-4), 0, 1);
      const soleAO = (1 - smoothstep(0.0, 0.24, h)) * 0.20;
      const shade = clamp(1 - soleAO, 0.74, 1.0);
      return [shade, shade * 0.97, shade * 0.94];
    },
  });
  cage.dispose();

  // Seat exact sole bottom at y = 0.
  geo.computeBoundingBox();
  if (geo.boundingBox && Math.abs(geo.boundingBox.min.y) > 1e-9) {
    geo.translate(0, -geo.boundingBox.min.y, 0);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }
  return geo;
  });
}

/**
 * Applies soft flowing garment/robe drapery folds along an existing closed
 * 2-manifold geometry without altering topology, recomputing smooth normals and
 * optional warm valley AO.
 */
export function applyRobeDraperyFolds(
  geometry: THREE.BufferGeometry,
  options: RobeDraperyOptions = {},
): THREE.BufferGeometry {
  const pos = geometry.getAttribute('position');
  if (!pos) return geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const sizeY = Math.max(box.max.y - box.min.y, 1e-4);
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;

  const amp = options.amplitude ?? 0.008;
  const freq = options.frequency ?? 7;
  const twist = options.diagonalTwist ?? 1.4;
  const valleyAO = clamp(options.valleyAO ?? 0.18, 0, 0.40);

  const colorAttr = geometry.getAttribute('color');
  const colors = colorAttr
    ? Float32Array.from(colorAttr.array as ArrayLike<number>)
    : new Float32Array(pos.count * 3).fill(1);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rx = x - cx;
    const rz = z - cz;
    const rad = Math.hypot(rx, rz);
    if (rad < 1e-5) continue;

    const yNorm = clamp((y - box.min.y) / sizeY, 0, 1);
    const envelope = Math.sin(yNorm * Math.PI) * (1 - smoothstep(0.86, 1.0, yNorm));
    const angle = Math.atan2(rx, rz);
    const fold =
      0.65 * Math.sin(angle * freq + yNorm * twist * Math.PI) +
      0.35 * Math.cos(angle * (freq - 2) - yNorm * twist * 0.6 * Math.PI);
    const disp = amp * envelope * fold;
    pos.setXYZ(i, x + (rx / rad) * disp, y, z + (rz / rad) * disp);

    if (valleyAO > 0) {
      const dark = smoothstep(0.2, -0.95, fold) * envelope * valleyAO;
      colors[i * 3] = clamp(colors[i * 3]! * (1 - dark * 0.78), 0.55, 1.05);
      colors[i * 3 + 1] = clamp(colors[i * 3 + 1]! * (1 - dark * 0.96), 0.50, 1.04);
      colors[i * 3 + 2] = clamp(colors[i * 3 + 2]! * (1 - dark * 1.10), 0.46, 1.03);
    }
  }

  pos.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Generates a calm, warm handcrafted seated statue body (crossed-leg meditative
 * base rising smoothly into robed torso and draped shoulders, grounded at `y = 0`).
 * Designed for Wave 2 contemplative / offering statue scenes.
 */
export function createStylizedSeatedStatueGeometry(
  options: StylizedSeatedStatueOptions = {},
): THREE.BufferGeometry {
  const lapW = options.lapWidth ?? 0.62;
  const lapD = options.lapDepth ?? 0.42;
  const height = options.height ?? 0.66;
  const shoulderW = options.shoulderWidth ?? 0.36;
  const foldDepth = options.foldDepth ?? 0.014;
  const radialSegments = Math.max(10, Math.round(options.radialSegments ?? 12));
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `statue|${roundKey(lapW)}|${roundKey(lapD)}|${roundKey(height)}|${roundKey(shoulderW)}|${roundKey(foldDepth)}|${radialSegments}|${iterations}|${indexed ? 1 : 0}`;
  return cachedStylizedGeometry(cacheKey, () => {
  // Classic serene triangular seated silhouette: broad lotus lap -> gentle waist -> calm shoulders -> neck collar.
  const levels: { y: number; rx: number; rz: number; zShift: number; kneeBulge: number; fold: number }[] = [
    { y: height * 0.04, rx: lapW * 0.48, rz: lapD * 0.48, zShift: lapD * 0.06, kneeBulge: 0.14, fold: 0.6 },
    { y: height * 0.18, rx: lapW * 0.50, rz: lapD * 0.49, zShift: lapD * 0.08, kneeBulge: 0.18, fold: 1.0 },
    { y: height * 0.36, rx: shoulderW * 0.46, rz: lapD * 0.35, zShift: -lapD * 0.02, kneeBulge: 0.0, fold: 0.85 },
    { y: height * 0.62, rx: shoulderW * 0.52, rz: lapD * 0.34, zShift: -lapD * 0.04, kneeBulge: 0.0, fold: 0.60 },
    { y: height * 0.84, rx: shoulderW * 0.48, rz: lapD * 0.30, zShift: -lapD * 0.04, kneeBulge: 0.0, fold: 0.25 },
    { y: height * 0.97, rx: shoulderW * 0.20, rz: lapD * 0.20, zShift: -lapD * 0.03, kneeBulge: 0.0, fold: 0.0 },
  ];

  const rings: THREE.Vector3[][] = levels.map((st) => {
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const sinA = Math.sin(a);
      const cosA = Math.cos(a);
      const kneeFactor = st.kneeBulge * Math.pow(Math.abs(sinA), 1.6) * (0.45 + 0.55 * Math.max(0, cosA));
      const x = sinA * st.rx * (1 + kneeFactor);
      const z = cosA * st.rz + st.zShift;
      ring.push(new THREE.Vector3(x, st.y, z));
    }
    return ring;
  });

  const startPole = new THREE.Vector3(0, 0, lapD * 0.04);
  const endPole = new THREE.Vector3(0, height * 1.02, -lapD * 0.03);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    colorGenerator: (p, n, box) => {
      const yNorm = clamp((p.y - box.min.y) / Math.max(box.max.y - box.min.y, 1e-4), 0, 1);
      const baseAO = (1 - smoothstep(0.0, 0.16, yNorm)) * 0.16;
      const underAO = smoothstep(-0.15, -0.85, n.y) * 0.12;
      const shade = clamp(1 - baseAO - underAO, 0.72, 1.02);
      return [shade * 1.01, shade * 0.99, shade * 0.95];
    },
  });
  cage.dispose();

  if (foldDepth > 0) {
    applyRobeDraperyFolds(geo, {
      amplitude: foldDepth,
      frequency: 7,
      diagonalTwist: 1.35,
      valleyAO: 0.16,
    });
  }

  // Seat exact statue base at y = 0.
  geo.computeBoundingBox();
  if (geo.boundingBox && Math.abs(geo.boundingBox.min.y) > 1e-9) {
    geo.translate(0, -geo.boundingBox.min.y, 0);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }
  return geo;
  });
}

/**
 * Generates a warm sculpted closed 2-manifold lotus pedestal (`y = 0` base to
 * `y = height` top seat) with gently scalloped petal relief around its waist.
 */
export function createStylizedLotusPedestalGeometry(
  options: StylizedLotusPedestalOptions = {},
): THREE.BufferGeometry {
  const radius = options.radius ?? 0.44;
  const height = options.height ?? 0.18;
  const petalCount = Math.max(6, Math.round(options.petalCount ?? 12));
  const radialSegments = Math.min(24, petalCount * 2);
  const iterations = options.iterations ?? 1;
  const indexed = options.indexed !== false;

  const cacheKey = `lotus|${roundKey(radius)}|${roundKey(height)}|${petalCount}|${iterations}|${indexed ? 1 : 0}`;
  return cachedStylizedGeometry(cacheKey, () => {
  const levels: { y: number; r: number; petalAmp: number; phase: number }[] = [
    { y: height * 0.03, r: radius * 0.92, petalAmp: 0.02, phase: 0 },
    { y: height * 0.24, r: radius * 1.00, petalAmp: 0.065, phase: 0 },
    { y: height * 0.50, r: radius * 0.80, petalAmp: 0.025, phase: Math.PI / petalCount },
    { y: height * 0.78, r: radius * 0.98, petalAmp: 0.075, phase: Math.PI / petalCount },
    { y: height * 0.97, r: radius * 0.84, petalAmp: 0.015, phase: Math.PI / petalCount },
  ];

  const rings: THREE.Vector3[][] = levels.map((st) => {
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const a = (s / radialSegments) * Math.PI * 2;
      const petal = Math.abs(Math.cos((a + st.phase) * petalCount * 0.5));
      const r = st.r * (1 + st.petalAmp * (petal - 0.35));
      ring.push(new THREE.Vector3(Math.cos(a) * r, st.y, Math.sin(a) * r));
    }
    return ring;
  });

  const startPole = new THREE.Vector3(0, 0, 0);
  const endPole = new THREE.Vector3(0, height, 0);

  const cage = buildLoftedControlCage(rings, { startPole, endPole });
  const geo = subdivideClosedCage(cage, {
    iterations,
    indexed,
    colorGenerator: (p, _n, box) => {
      const yNorm = clamp((p.y - box.min.y) / Math.max(box.max.y - box.min.y, 1e-4), 0, 1);
      const waistCrease = Math.exp(-Math.pow((yNorm - 0.5) / 0.14, 2)) * 0.14;
      const baseAO = (1 - smoothstep(0.0, 0.15, yNorm)) * 0.14;
      const shade = clamp(1 - waistCrease - baseAO, 0.72, 1.02);
      return [shade * 1.01, shade * 0.98, shade * 0.94];
    },
  });
  cage.dispose();

  geo.computeBoundingBox();
  if (geo.boundingBox && Math.abs(geo.boundingBox.min.y) > 1e-9) {
    geo.translate(0, -geo.boundingBox.min.y, 0);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }
  return geo;
  });
}
