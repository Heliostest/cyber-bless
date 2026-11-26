import * as THREE from 'three';
import type * as RapierNamespace from '@dimforge/rapier3d-simd';
import {
  createRapierSoftBodyHost,
  type RapierModule,
  type RapierSoftBodySession,
} from './rapier-soft-body';

/**
 * Shared stiff-paper hanging strip helper built on the repo's existing
 * `@dimforge/rapier3d-simd` soft-body runtime.
 *
 * Compared to `tibetan-prayer-flags` cloth (`bendSoftness: 3.2`), hanging paper
 * uses inextensible edges and ~5x stiffer bending (`tensionOnly: false`) so
 * slips keep a crisp top bar, develop gentle elastic arcs, and never flop or
 * bunch like soft fabric.
 */

export interface PaperStripSurface {
  /** Subdivided PlaneGeometry anchored at top-center (y = 0..-height). */
  readonly geometry: THREE.PlaneGeometry;
  /** Synchronized thin cut-paper perimeter rim following the deformed sheet. */
  readonly edgeGeometry: THREE.BufferGeometry;
  readonly width: number;
  readonly height: number;
  readonly thickness: number;
  readonly segX: number;
  readonly segY: number;
}

export interface RestingPaperPose {
  /** Rotation around the top hanging cord (radians). */
  yaw?: number;
  /** Gentle pendulum tilt around Z (radians). */
  swingZ?: number;
  /** Gentle stiff-paper forward/back bow along the sheet length (radians). */
  bendZ?: number;
  /** Subtle helical wind twist along the strip length (radians). */
  twist?: number;
  /** Subtle cross-width cupping/camber (meters). */
  camber?: number;
}

export interface HangingPaperStripSpec {
  readonly surface: PaperStripSurface;
  /** Staggered wind phase per strip (radians). */
  phase?: number;
  /** Natural resting orientation around its hanging string (radians). */
  baseYaw?: number;
  /** Subtle inherent paper roll/curl memory (-1..1). */
  curlBias?: number;
  /** Breeze responsiveness multiplier (default 1). */
  breezeScale?: number;
  /**
   * Optional predicate returning whether this strip is currently suspended.
   * When false, the rig skips writing to it so the scene can pose it directly
   * (for example resting on the ground or being dragged).
   */
  isHanging?: () => boolean;
}

export interface HangingPaperRigOptions {
  readonly strips: readonly HangingPaperStripSpec[];
  isActive?: () => boolean;
  isReducedMotion?: () => boolean;
  /** Override Rapier loader for unit tests. */
  loader?: () => Promise<RapierModule>;
  /** Number of warm-up substeps when Rapier finishes loading (default 40). */
  settleSteps?: number;
  /** Global breeze strength multiplier (default 1). */
  breezeStrength?: number;
}

export interface HangingPaperRig {
  readonly ready: boolean;
  start(): Promise<RapierSoftBodySession | null>;
  /** Advances stiff-paper simulation or deterministic reduced-motion curve. */
  update(dt: number, elapsedSeconds: number): void;
  /** Imparts a brief elastic breeze/seating impulse to one strip (local X/Z). */
  impulse(stripIndex: number, vx: number, vz: number): void;
  /** Resets one strip's particles cleanly when transitioning from held to hung. */
  resetStrip(stripIndex: number, vx?: number, vz?: number): void;
  dispose(): void;
}

const SIM_NU = 3;
const SIM_NV = 7;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1)
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Samples a 3-column × nv-row Rapier paper grid smoothly: quadratic across width
 * (3 particles preserve crisp paper cross-section with gentle camber) and
 * Catmull-Rom along the hanging length.
 */
function samplePaperGrid(
  pos: Float32Array,
  nv: number,
  u: number,
  v: number,
  offsetX: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const cu = THREE.MathUtils.clamp(u, 0, 1);
  const fv = THREE.MathUtils.clamp(v, 0, 1) * (nv - 1);
  const j1 = Math.min(nv - 2, Math.floor(fv));
  const tv = fv - j1;
  const j0 = Math.max(0, j1 - 1);
  const j2 = j1 + 1;
  const j3 = Math.min(nv - 1, j1 + 2);

  // Quadratic Lagrange weights across the 3 width columns (u = 0, 0.5, 1)
  const w0 = (1 - cu) * (1 - 2 * cu);
  const w1 = 4 * cu * (1 - cu);
  const w2 = cu * (2 * cu - 1);

  const sampleCol = (col: number, axis: 0 | 1 | 2) => catmullRom(
    pos[(col * nv + j0) * 3 + axis]!,
    pos[(col * nv + j1) * 3 + axis]!,
    pos[(col * nv + j2) * 3 + axis]!,
    pos[(col * nv + j3) * 3 + axis]!,
    tv,
  );

  const x = w0 * sampleCol(0, 0) + w1 * sampleCol(1, 0) + w2 * sampleCol(2, 0) - offsetX;
  const y = w0 * sampleCol(0, 1) + w1 * sampleCol(1, 1) + w2 * sampleCol(2, 1);
  const z = w0 * sampleCol(0, 2) + w1 * sampleCol(1, 2) + w2 * sampleCol(2, 2);
  return out.set(x, y, z);
}

/**
 * Builds a subdivided `PlaneGeometry` anchored at its top center `(0, 0, 0)`
 * plus a matching thin cut-paper perimeter rim geometry (`edgeGeometry`).
 */
export function createPaperStripSurface(
  width: number,
  height: number,
  options: { segX?: number; segY?: number; thickness?: number } = {},
): PaperStripSurface {
  const segX = Math.max(2, Math.floor(options.segX ?? 4));
  const segY = Math.max(4, Math.floor(options.segY ?? 14));
  const thickness = Math.max(0.0008, options.thickness ?? 0.0026);

  const geometry = new THREE.PlaneGeometry(width, height, segX, segY);
  geometry.translate(0, -height / 2, 0);

  // Build perimeter rim quads along top, right, bottom, left edges.
  // Each perimeter segment produces 1 quad (4 vertices, 2 triangles) spanning
  // -thickness/2 to +thickness/2 along the local surface normal.
  const perimeterSegments = 2 * segX + 2 * segY;
  const edgePositions = new Float32Array(perimeterSegments * 4 * 3);
  const edgeUvs = new Float32Array(perimeterSegments * 4 * 2);
  const edgeIndices: number[] = [];
  for (let s = 0; s < perimeterSegments; s++) {
    const base = s * 4;
    edgeIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    edgeUvs[base * 2] = 0; edgeUvs[base * 2 + 1] = 0;
    edgeUvs[(base + 1) * 2] = 1; edgeUvs[(base + 1) * 2 + 1] = 0;
    edgeUvs[(base + 2) * 2] = 1; edgeUvs[(base + 2) * 2 + 1] = 1;
    edgeUvs[(base + 3) * 2] = 0; edgeUvs[(base + 3) * 2 + 1] = 1;
  }
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
  edgeGeometry.setAttribute('uv', new THREE.BufferAttribute(edgeUvs, 2));
  edgeGeometry.setIndex(edgeIndices);

  const surface: PaperStripSurface = { geometry, edgeGeometry, width, height, thickness, segX, segY };
  // Populate initial rim matching flat plane before first pose/update.
  syncPaperEdgeGeometry(surface);
  return surface;
}

const _n0 = new THREE.Vector3();
const _n1 = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();

/** Updates the perimeter cut-paper rim in-place from the current deformed `PlaneGeometry`. */
export function syncPaperEdgeGeometry(surface: PaperStripSurface): void {
  const { geometry, edgeGeometry, segX, segY, thickness } = surface;
  const cols = segX + 1;
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  let norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!norm) {
    geometry.computeVertexNormals();
    norm = geometry.getAttribute('normal') as THREE.BufferAttribute;
  }
  const ePos = edgeGeometry.getAttribute('position') as THREE.BufferAttribute;
  const half = thickness * 0.5;
  let cursor = 0;

  const writeSeg = (idxA: number, idxB: number) => {
    _p0.fromBufferAttribute(pos, idxA);
    _p1.fromBufferAttribute(pos, idxB);
    _n0.fromBufferAttribute(norm!, idxA);
    _n1.fromBufferAttribute(norm!, idxB);
    const base = cursor * 4;
    ePos.setXYZ(base, _p0.x + _n0.x * half, _p0.y + _n0.y * half, _p0.z + _n0.z * half);
    ePos.setXYZ(base + 1, _p1.x + _n1.x * half, _p1.y + _n1.y * half, _p1.z + _n1.z * half);
    ePos.setXYZ(base + 2, _p1.x - _n1.x * half, _p1.y - _n1.y * half, _p1.z - _n1.z * half);
    ePos.setXYZ(base + 3, _p0.x - _n0.x * half, _p0.y - _n0.y * half, _p0.z - _n0.z * half);
    cursor++;
  };

  // Top edge (left -> right)
  for (let x = 0; x < segX; x++) writeSeg(x, x + 1);
  // Right edge (top -> bottom)
  for (let y = 0; y < segY; y++) writeSeg(y * cols + segX, (y + 1) * cols + segX);
  // Bottom edge (right -> left)
  for (let x = segX; x > 0; x--) writeSeg(segY * cols + x, segY * cols + x - 1);
  // Left edge (bottom -> top)
  for (let y = segY; y > 0; y--) writeSeg(y * cols, (y - 1) * cols);

  ePos.needsUpdate = true;
  edgeGeometry.computeVertexNormals();
  edgeGeometry.computeBoundingBox();
  edgeGeometry.computeBoundingSphere();
}

/**
 * Poses a paper strip analytically with an inextensible stiff-paper curve
 * (gentle bow, subtle twist, slight cross-width camber). Used for reduced-motion
 * mode, resting/dragged strips, and frame-0 before Rapier WASM finishes loading.
 */
export function poseRestingPaperStrip(surface: PaperStripSurface, pose: RestingPaperPose = {}): void {
  const { geometry, width, height, segX, segY } = surface;
  const yaw = pose.yaw ?? 0;
  const swingZ = pose.swingZ ?? 0;
  const bendZ = pose.bendZ ?? 0.14;
  const twist = pose.twist ?? 0.05;
  const camber = pose.camber ?? 0.0022;

  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const cols = segX + 1;
  const stepS = height / segY;
  const cosSwing = Math.cos(swingZ);
  const sinSwing = Math.sin(swingZ);

  // Integrate inextensible centerline arc so length stays exact when bowed.
  let cy = 0;
  let cz = 0;
  for (let y = 0; y <= segY; y++) {
    const v = y / segY;
    if (y > 0) {
      const vm = (y - 0.5) / segY;
      // Smooth cantilever-like bend profile: crisp near top pin, graceful curve toward tail.
      const theta = bendZ * (0.28 * vm + 0.72 * vm * vm);
      cy -= stepS * Math.cos(theta);
      cz += stepS * Math.sin(theta);
    }
    const localYaw = yaw + twist * v * v;
    const cosY = Math.cos(localYaw);
    const sinY = Math.sin(localYaw);
    const thetaHere = bendZ * (0.28 * v + 0.72 * v * v);
    const sinT = Math.sin(thetaHere);
    const cosT = Math.cos(thetaHere);

    for (let x = 0; x <= segX; x++) {
      const u = x / segX - 0.5;
      const sx = u * width;
      // Gentle cross-width paper cup (zero at pinned top edge so top center stays at exact origin).
      const cup = camber * (1 - 4 * u * u) * Math.sin(Math.PI * v);
      const rx = sx * cosY + cup * sinY;
      const rz = -sx * sinY + cup * cosY;

      // Apply subtle pendulum Z swing around top-center origin (0, 0, 0).
      const px = rx * cosSwing - (cy + cup * sinT * 0.2) * sinSwing;
      const py = rx * sinSwing + cy * cosSwing;
      const pz = cz + rz * cosT;
      pos.setXYZ(y * cols + x, px, py, pz);
    }
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  syncPaperEdgeGeometry(surface);
}

interface StripRuntime {
  readonly spec: HangingPaperStripSpec;
  readonly offsetX: number;
  readonly phase: number;
  readonly baseYaw: number;
  readonly curlBias: number;
  readonly breezeScale: number;
  body: RapierNamespace.SoftBody | null;
  wasHanging: boolean;
  yaw: number;
  yawVel: number;
  impulseX: number;
  impulseZ: number;
  readonly samplePt: THREE.Vector3;
}

const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _triN = new THREE.Vector3();

/**
 * Creates a lazy-loaded Rapier stiff-paper simulation rig shared across all
 * hanging paper strips in one scene.
 */
export function createHangingPaperRig(options: HangingPaperRigOptions): HangingPaperRig {
  const breezeStrength = options.breezeStrength ?? 1;
  const settleSteps = options.settleSteps ?? 40;
  let simClock = 0;
  let rapierReady = false;
  let physicsStepped = false;
  let disposed = false;

  const pinnedTopRow: number[] = [];
  for (let i = 0; i < SIM_NU; i++) pinnedTopRow.push(i * SIM_NV);

  const runtimes: StripRuntime[] = options.strips.map((spec, index) => ({
    spec,
    offsetX: index * 2.0,
    phase: spec.phase ?? index * 1.47,
    baseYaw: spec.baseYaw ?? ((index % 2 === 0 ? 1 : -1) * 0.16),
    curlBias: spec.curlBias ?? ((index % 2 === 0 ? 1 : -1) * 0.65),
    breezeScale: spec.breezeScale ?? 1,
    body: null,
    wasHanging: spec.isHanging ? spec.isHanging() : true,
    yaw: spec.baseYaw ?? ((index % 2 === 0 ? 1 : -1) * 0.16),
    yawVel: 0,
    impulseX: 0,
    impulseZ: 0,
    samplePt: new THREE.Vector3(),
  }));

  function resetOneBody(rt: StripRuntime, vx = 0, vz = 0) {
    const body = rt.body;
    if (!body || !body.isValid()) return;
    const { width, height } = rt.spec.surface;
    rt.yaw = rt.baseYaw;
    rt.yawVel = 0;
    const cosY = Math.cos(rt.yaw);
    const sinY = Math.sin(rt.yaw);
    const stepS = height / (SIM_NV - 1);
    const initBend = rt.curlBias * 0.14;
    let cy = 0;
    let cz = 0;
    for (let j = 0; j < SIM_NV; j++) {
      const v = j / (SIM_NV - 1);
      if (j > 0) {
        const vm = (j - 0.5) / (SIM_NV - 1);
        const theta = initBend * (0.3 * vm + 0.7 * vm * vm);
        cy -= stepS * Math.cos(theta);
        cz += stepS * Math.sin(theta);
      }
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1) - 0.5;
        const sx = u * width;
        const k = i * SIM_NV + j;
        body.setParticlePosition(k, {
          x: rt.offsetX + sx * cosY,
          y: cy,
          z: cz - sx * sinY,
        });
        body.setParticleVelocity(k, { x: vx * v, y: 0, z: vz * v });
      }
    }
  }

  function applyForces(_session: RapierSoftBodySession, subDt: number) {
    simClock += subDt;
    const t = simClock;

    for (const rt of runtimes) {
      const body = rt.body;
      if (!body || !body.isValid()) continue;
      const hanging = rt.spec.isHanging ? rt.spec.isHanging() : true;
      if (!hanging) {
        rt.wasHanging = false;
        continue;
      }
      if (!rt.wasHanging) {
        rt.wasHanging = true;
        resetOneBody(rt, rt.impulseX, rt.impulseZ);
        rt.impulseX = 0;
        rt.impulseZ = 0;
      }

      const { width } = rt.spec.surface;
      const scale = breezeStrength * rt.breezeScale;

      // Gentle damped yaw around the top hanging cord (tanzaku / wind-chime slip turns softly in breeze).
      const targetYaw = rt.baseYaw
        + (0.14 * Math.sin(t * 0.85 + rt.phase) + 0.06 * Math.sin(t * 1.65 + rt.phase * 1.4)) * scale;
      rt.yawVel += (-(rt.yaw - targetYaw) * 9.5 - rt.yawVel * 3.8) * subDt;
      rt.yaw += rt.yawVel * subDt;

      // Subtle lateral top-pin roll from breeze so the crisp top bar breathes softly.
      const topRoll = 0.045 * Math.sin(t * 1.15 + rt.phase) * scale;
      const cosY = Math.cos(rt.yaw);
      const sinY = Math.sin(rt.yaw);
      const sinR = Math.sin(topRoll);

      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1) - 0.5;
        const sx = u * width;
        body.setParticleKinematicTarget(i * SIM_NV, {
          x: rt.offsetX + sx * cosY,
          y: sx * sinR,
          z: -sx * sinY,
        });
      }

      body.resetForces(false);
      const pos = body.particlePositions();
      const vel = body.particleVelocities();
      const pMass = Math.max(body.mass() / (SIM_NU * SIM_NV), 1e-4);

      // Gentle summer breeze vector in strip local coordinates.
      const windX = (0.58 + 0.92 * Math.sin(t * 1.2 + rt.phase) + 0.34 * Math.sin(t * 2.3 + rt.phase * 1.7)) * scale;
      const windZ = (0.72 + 0.55 * Math.cos(t * 0.95 + rt.phase * 0.8) + 0.38 * Math.sin(t * 1.8 + rt.phase)) * scale;

      for (let i = 0; i < SIM_NU; i++) {
        const iPrev = Math.max(0, i - 1);
        const iNext = Math.min(SIM_NU - 1, i + 1);
        for (let j = 1; j < SIM_NV; j++) {
          const v = j / (SIM_NV - 1);
          const k = i * SIM_NV + j;
          const jPrev = j - 1;
          const jNext = Math.min(SIM_NV - 1, j + 1);

          // Estimate local paper normal for aerodynamic pressure + paper curl memory.
          const kL = (iPrev * SIM_NV + j) * 3;
          const kR = (iNext * SIM_NV + j) * 3;
          const kU = (i * SIM_NV + jPrev) * 3;
          const kD = (i * SIM_NV + jNext) * 3;
          _e1.set(pos[kR]! - pos[kL]!, pos[kR + 1]! - pos[kL + 1]!, pos[kR + 2]! - pos[kL + 2]!);
          _e2.set(pos[kU]! - pos[kD]!, pos[kU + 1]! - pos[kD + 1]!, pos[kU + 2]! - pos[kD + 2]!);
          _triN.crossVectors(_e1, _e2);
          if (_triN.lengthSq() > 1e-10) _triN.normalize();
          else _triN.set(sinY, 0, cosY);

          const vRamp = THREE.MathUtils.smoothstep(v, 0.04, 0.86);
          const gust = 0.68 + 0.32 * Math.sin(t * 2.05 - v * 2.5 + rt.phase);
          // Aerodynamic normal pressure (paper catches breeze across its face rather than flapping randomly).
          const wDotN = windX * _triN.x + windZ * _triN.z;
          const aeroX = (_triN.x * wDotN * 1.55 + windX * 0.50) * gust * vRamp;
          const aeroZ = (_triN.z * wDotN * 1.55 + windZ * 0.50) * gust * vRamp;

          // Inherent handmade paper roll-curl bias creates a crisp elastic J-curve even in light breeze.
          const curlForce = rt.curlBias * 2.45 * (v * v - 0.14 * v);
          const impX = rt.impulseX * vRamp;
          const impZ = rt.impulseZ * vRamp;

          const vx = vel[k * 3]!;
          const vy = vel[k * 3 + 1]!;
          const vz = vel[k * 3 + 2]!;

          body.addParticleForce(k, {
            x: pMass * (aeroX + _triN.x * curlForce + impX - 2.35 * vx),
            y: pMass * (-1.8 * vy),
            z: pMass * (aeroZ + _triN.z * curlForce + impZ - 2.35 * vz),
          }, false);
        }
      }
      rt.impulseX *= Math.exp(-subDt * 6);
      rt.impulseZ *= Math.exp(-subDt * 6);
    }
  }

  function writeFromRapier() {
    for (const rt of runtimes) {
      const body = rt.body;
      if (!body || !body.isValid()) continue;
      if (rt.spec.isHanging && !rt.spec.isHanging()) continue;

      const { geometry, height, segX, segY } = rt.spec.surface;
      const simPos = body.particlePositions();
      const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
      const cols = segX + 1;
      const maxReach = height * 1.06;

      for (let y = 0; y <= segY; y++) {
        const v = y / segY;
        for (let x = 0; x <= segX; x++) {
          const u = x / segX;
          samplePaperGrid(simPos, SIM_NV, u, v, rt.offsetX, rt.samplePt);
          // Safety clamp against extreme numerical impulse while staying seamless in normal motion.
          const len = rt.samplePt.length();
          if (len > maxReach && len > 1e-6) rt.samplePt.multiplyScalar(maxReach / len);
          pos.setXYZ(y * cols + x, rt.samplePt.x, rt.samplePt.y, rt.samplePt.z);
        }
      }
      pos.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      syncPaperEdgeGeometry(rt.spec.surface);
    }
  }

  function writeAnalytic(t: number, reduced: boolean) {
    for (const rt of runtimes) {
      if (rt.spec.isHanging && !rt.spec.isHanging()) continue;
      const scale = reduced ? 0 : breezeStrength * rt.breezeScale;
      poseRestingPaperStrip(rt.spec.surface, {
        yaw: rt.baseYaw + Math.sin(t * 0.85 + rt.phase) * 0.14 * scale,
        swingZ: Math.sin(t * 1.25 + rt.phase) * 0.075 * scale,
        bendZ: rt.curlBias * 0.18 + Math.sin(t * 1.45 + rt.phase) * 0.11 * scale,
        twist: rt.curlBias * 0.06 + Math.cos(t * 1.05 + rt.phase) * 0.06 * scale,
        camber: 0.0022 * Math.sign(rt.curlBias || 1),
      });
    }
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 8,
    internalPgsIterations: 4,
    // Hanging paper responds continuously to gentle breeze when active.
    sleepSpeedThreshold: 0,
    isActive: options.isActive,
    isReducedMotion: options.isReducedMotion,
    loader: options.loader,
    onReady(session) {
      if (disposed) return;
      for (const rt of runtimes) {
        const { width, height } = rt.spec.surface;
        rt.body = session.createCloth({
          origin: { x: rt.offsetX - width / 2, y: 0, z: 0 },
          du: { x: width / (SIM_NU - 1), y: 0, z: 0 },
          dv: { x: 0, y: -height / (SIM_NV - 1), z: 0 },
          nu: SIM_NU,
          nv: SIM_NV,
          mass: 0.032,
          particleRadius: 0.008,
          gravityScale: 0.85,
          linearDamping: 2.9,
          // Inextensible edges + ~5x stiffer bending than cloth keeps crisp paper curves.
          edgeSoftness: { naturalFrequency: 48, dampingRatio: 0.92 },
          bendSoftness: { naturalFrequency: 16, dampingRatio: 0.88 },
          tensionOnly: false,
          pinnedParticles: pinnedTopRow,
          noSurfaceCollider: true,
          canSleep: false,
        });
        resetOneBody(rt);
      }
      rapierReady = true;
      host.settle(settleSteps, applyForces);
      physicsStepped = true;
      writeFromRapier();
    },
  });

  // Render an immediate crisp resting curve on frame 0 before WASM loads.
  writeAnalytic(0, true);

  return {
    get ready() {
      return rapierReady && !disposed;
    },
    start() {
      if (disposed || options.isReducedMotion?.()) return Promise.resolve(null);
      return host.start();
    },
    update(dt, elapsedSeconds) {
      if (disposed) return;
      const reduced = options.isReducedMotion?.() ?? false;
      if (reduced) {
        writeAnalytic(0, true);
        return;
      }
      if (rapierReady) {
        const stepped = host.step(dt, applyForces);
        if (stepped || physicsStepped) {
          physicsStepped = true;
          writeFromRapier();
          return;
        }
      }
      writeAnalytic(elapsedSeconds, false);
    },
    impulse(stripIndex, vx, vz) {
      const rt = runtimes[stripIndex];
      if (!rt) return;
      rt.impulseX = THREE.MathUtils.clamp(rt.impulseX + vx, -14, 14);
      rt.impulseZ = THREE.MathUtils.clamp(rt.impulseZ + vz, -14, 14);
      rt.yawVel = THREE.MathUtils.clamp(rt.yawVel + vx * 0.25, -3, 3);
    },
    resetStrip(stripIndex, vx = 0, vz = 0) {
      const rt = runtimes[stripIndex];
      if (!rt) return;
      rt.wasHanging = rt.spec.isHanging ? rt.spec.isHanging() : true;
      resetOneBody(rt, vx, vz);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const rt of runtimes) rt.body = null;
      rapierReady = false;
      physicsStepped = false;
      host.dispose();
    },
  };
}
