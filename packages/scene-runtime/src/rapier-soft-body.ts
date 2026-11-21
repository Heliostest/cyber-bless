/// <reference path="./rapier-wasm-shims.d.ts" />
import * as THREE from 'three';
import type * as RapierNamespace from '@dimforge/rapier3d-simd';

export type RapierModule = typeof RapierNamespace;
export type Vec3Like = { x: number; y: number; z: number };
export type QuatLike = { x: number; y: number; z: number; w: number };

let cachedRapier: RapierModule | null = null;
let pendingRapier: Promise<RapierModule> | null = null;

/** True once the Rapier WASM module has finished initializing in this process. */
export function isRapierLoaded(): boolean {
  return cachedRapier !== null;
}

/** @internal Reset loader cache in unit tests only. */
export function _resetRapierLoaderForTest(): void {
  cachedRapier = null;
  pendingRapier = null;
}

function resolveWasmAssetUrl(wasmMod: {
  __rapierWasmUrl?: string | null;
  default?: unknown;
}): string | null {
  if (typeof wasmMod.__rapierWasmUrl === 'string' && wasmMod.__rapierWasmUrl.length > 0) {
    return wasmMod.__rapierWasmUrl;
  }
  const def = wasmMod.default;
  if (typeof def === 'string' && def.length > 0) return def;
  if (def && typeof def === 'object') {
    const uri = (def as { uri?: unknown }).uri;
    if (typeof uri === 'string' && uri.length > 0) return uri;
  }
  return null;
}

async function instantiateFromUrl(
  url: string,
  imports: WebAssembly.Imports,
): Promise<WebAssembly.Exports> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Rapier WASM (${response.status}): ${url}`);
  }
  if (typeof WebAssembly.instantiateStreaming === 'function') {
    try {
      const streaming = await WebAssembly.instantiateStreaming(response.clone(), imports);
      return streaming.instance.exports;
    } catch {
      // Fall back when server/WebView serves `.wasm` without `application/wasm`.
    }
  }
  const bytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(bytes, imports);
  return result.instance.exports;
}

async function defaultLoadRapier(): Promise<RapierModule> {
  // Literal specifiers so Rollup/Vite code-split Rapier into a lazy chunk and
  // scene-testing-revisions tracks `@dimforge/rapier3d-simd` cleanly.
  const [rapier, bg, wasmMod] = await Promise.all([
    import('@dimforge/rapier3d-simd'),
    import('@dimforge/rapier3d-simd/rapier_wasm3d_bg.js'),
    import('@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm'),
  ]);

  let alreadyLive = false;
  try {
    alreadyLive = typeof rapier.version() === 'string' && rapier.version().length > 0;
  } catch {
    alreadyLive = false;
  }

  if (!alreadyLive) {
    const wasmBridge = wasmMod as unknown as {
      readonly __rapierWasmExports?: WebAssembly.Exports | null;
      readonly __rapierWasmUrl?: string | null;
      readonly default?: unknown;
    };
    if (wasmBridge.__rapierWasmExports) {
      bg.__wbg_set_wasm(wasmBridge.__rapierWasmExports);
    } else {
      const url = resolveWasmAssetUrl(wasmBridge);
      if (!url) {
        throw new Error('Rapier WASM asset could not be resolved by the current bundler');
      }
      const exports = await instantiateFromUrl(url, {
        './rapier_wasm3d_bg.js': bg as unknown as WebAssembly.ModuleImports,
      });
      bg.__wbg_set_wasm(exports);
    }
    // Verify initialization succeeded before caching.
    rapier.version();
  }

  return rapier;
}

/**
 * Lazily loads and initializes `@dimforge/rapier3d-simd` (SIMD WASM).
 * Importing this module does not fetch or compile WASM until `loadRapier()` is called.
 */
export function loadRapier(
  loader?: () => Promise<RapierModule>,
): Promise<RapierModule> {
  if (loader) return loader();
  if (cachedRapier) return Promise.resolve(cachedRapier);
  if (!pendingRapier) {
    pendingRapier = defaultLoadRapier()
      .then((mod) => {
        cachedRapier = mod;
        return mod;
      })
      .catch((error) => {
        pendingRapier = null;
        throw error;
      });
  }
  return pendingRapier;
}

export interface ColliderOptions {
  friction?: number;
  restitution?: number;
  rotation?: QuatLike;
}

export interface RigidColliderHandle {
  readonly body: RapierNamespace.RigidBody;
  readonly collider: RapierNamespace.Collider;
  setPose(position: Vec3Like, rotation?: QuatLike): void;
  setKinematicTarget(position: Vec3Like, rotation?: QuatLike): void;
}

export interface SoftBodyCommonSpec {
  mass?: number;
  particleMass?: number;
  particleRadius?: number;
  linearDamping?: number;
  gravityScale?: number;
  edgeSoftness?: { naturalFrequency: number; dampingRatio: number };
  bendSoftness?: { naturalFrequency: number; dampingRatio: number };
  softness?: { naturalFrequency: number; dampingRatio: number };
  pinnedParticles?: number[];
  canSleep?: boolean;
  selfContacts?: boolean;
  friction?: number;
  restitution?: number;
  noSurfaceCollider?: boolean;
  additionalSolverIterations?: number;
  additionalPgsIterations?: number;
  tensionOnly?: boolean;
}

export interface ClothSpec extends SoftBodyCommonSpec {
  origin: Vec3Like;
  du: Vec3Like;
  dv: Vec3Like;
  nu: number;
  nv: number;
}

export interface ClothTubeSpec extends SoftBodyCommonSpec {
  origin: Vec3Like;
  axis: Vec3Like;
  radiusStart: number;
  radiusEnd: number;
  numAround: number;
  numAlong: number;
}

export interface RopeSpec extends SoftBodyCommonSpec {
  start: Vec3Like;
  end: Vec3Like;
  numParticles: number;
}

export interface CustomRopeSpec extends SoftBodyCommonSpec {
  /** World-space control points (one particle per point). */
  points: readonly Vec3Like[];
  /** Connect last particle back to particle 0 as a closed loop. */
  closed?: boolean;
  /** Add 2-hop bending edges for realistic cord/ribbon stiffness (default: true). */
  bending?: boolean;
  /** Add wire collision segments so the rope contacts rigid colliders (default: true). */
  wireCollision?: boolean;
}

export interface RapierSoftBodySession {
  readonly rapier: RapierModule;
  readonly world: RapierNamespace.World;
  readonly softBodies: readonly RapierNamespace.SoftBody[];
  addFixedBox(center: Vec3Like, size: Vec3Like, options?: ColliderOptions): RigidColliderHandle;
  addFixedCylinder(center: Vec3Like, radius: number, height: number, options?: ColliderOptions): RigidColliderHandle;
  addFixedCapsule(center: Vec3Like, radius: number, halfHeight: number, options?: ColliderOptions): RigidColliderHandle;
  addKinematicBox(center: Vec3Like, size: Vec3Like, options?: ColliderOptions): RigidColliderHandle;
  addKinematicCylinder(center: Vec3Like, radius: number, height: number, options?: ColliderOptions): RigidColliderHandle;
  createCloth(spec: ClothSpec): RapierNamespace.SoftBody;
  createClothTube(spec: ClothTubeSpec): RapierNamespace.SoftBody;
  createRope(spec: RopeSpec): RapierNamespace.SoftBody;
  createCustomRope(spec: CustomRopeSpec): RapierNamespace.SoftBody;
  wakeUpAll(): void;
}

export interface RapierSoftBodyHostOptions {
  gravity?: Vec3Like;
  fixedDt?: number;
  maxSubsteps?: number;
  solverIterations?: number;
  internalPgsIterations?: number;
  sleepSpeedThreshold?: number;
  sleepTimeRequired?: number;
  isActive?: () => boolean;
  isReducedMotion?: () => boolean;
  /** Override loader for unit tests. */
  loader?: () => Promise<RapierModule>;
  onReady?: (session: RapierSoftBodySession) => void;
  onError?: (error: unknown) => void;
}

export interface RapierSoftBodyHost {
  readonly ready: boolean;
  readonly disposed: boolean;
  readonly sleeping: boolean;
  readonly session: RapierSoftBodySession | null;
  /** Starts lazy WASM loading and world construction once. Safe to call repeatedly. */
  start(): Promise<RapierSoftBodySession | null>;
  /**
   * Advances the physics world by `dt` seconds (fixed substeps, clamped <= 0.05s).
   * Returns `true` if at least one simulation step ran.
   * Respects `isActive()`, `isReducedMotion()`, and sleep gating.
   */
  step(
    dt: number,
    beforeStep?: (session: RapierSoftBodySession, subDt: number) => void,
    afterStep?: (session: RapierSoftBodySession) => void,
  ): boolean;
  /** Runs `steps` synchronous warm-up steps once the session is ready (ignores active/sleep gating). */
  settle(
    steps: number,
    beforeStep?: (session: RapierSoftBodySession, subDt: number) => void,
  ): boolean;
  /** Wakes all soft bodies and resets the quiet sleep timer. */
  wakeUp(): void;
  /** Frees the Rapier world and prevents any in-flight initialization from completing. */
  dispose(): void;
}

const IDENTITY_QUAT: QuatLike = { x: 0, y: 0, z: 0, w: 1 };

function applySoftBodyCommon(
  rapier: RapierModule,
  desc: RapierNamespace.SoftBodyDesc,
  spec: SoftBodyCommonSpec,
): RapierNamespace.SoftBodyDesc {
  if (spec.mass !== undefined) desc.setMass(spec.mass);
  else if (spec.particleMass !== undefined) desc.setParticleMass(spec.particleMass);
  if (spec.particleRadius !== undefined) desc.setParticleRadius(spec.particleRadius);
  if (spec.linearDamping !== undefined) desc.setLinearDamping(spec.linearDamping);
  if (spec.gravityScale !== undefined) desc.setGravityScale(spec.gravityScale);
  if (spec.edgeSoftness || spec.bendSoftness) {
    const mat = new rapier.SoftBodyMaterial();
    if (spec.edgeSoftness) mat.edgeSoftness = { ...spec.edgeSoftness };
    if (spec.bendSoftness) mat.bendSoftness = { ...spec.bendSoftness };
    desc.setMaterial(mat);
  } else if (spec.softness) {
    desc.setSoftness(spec.softness.naturalFrequency, spec.softness.dampingRatio);
  }
  if (spec.pinnedParticles && spec.pinnedParticles.length > 0) {
    desc.setPinnedParticles(spec.pinnedParticles);
  }
  desc.setCanSleep(spec.canSleep ?? true);
  if (spec.selfContacts !== undefined) desc.setSelfContacts(spec.selfContacts);
  if (spec.additionalSolverIterations !== undefined) {
    desc.setAdditionalSolverIterations(spec.additionalSolverIterations);
  }
  if (spec.additionalPgsIterations !== undefined) {
    desc.setAdditionalPgsIterations(spec.additionalPgsIterations);
  }
  if (spec.tensionOnly) desc.setTensionOnly();
  if (spec.noSurfaceCollider) {
    desc.setNoSurfaceCollider();
  } else if (spec.friction !== undefined || spec.restitution !== undefined) {
    const template = rapier.ColliderDesc.ball(0.05);
    if (spec.friction !== undefined) template.setFriction(spec.friction);
    if (spec.restitution !== undefined) template.setRestitution(spec.restitution);
    desc.setSurfaceCollider(template);
  }
  return desc;
}

function createRigidCollider(
  world: RapierNamespace.World,
  bodyDesc: RapierNamespace.RigidBodyDesc,
  colliderDesc: RapierNamespace.ColliderDesc,
  center: Vec3Like,
  options: ColliderOptions = {},
): RigidColliderHandle {
  bodyDesc.setTranslation(center.x, center.y, center.z);
  const rot = options.rotation ?? IDENTITY_QUAT;
  bodyDesc.setRotation(rot);
  const body = world.createRigidBody(bodyDesc);
  if (options.friction !== undefined) colliderDesc.setFriction(options.friction);
  if (options.restitution !== undefined) colliderDesc.setRestitution(options.restitution);
  const collider = world.createCollider(colliderDesc, body);
  return {
    body,
    collider,
    setPose(position: Vec3Like, rotation?: QuatLike) {
      body.setTranslation(position, true);
      if (rotation) body.setRotation(rotation, true);
    },
    setKinematicTarget(position: Vec3Like, rotation?: QuatLike) {
      body.setNextKinematicTranslation(position);
      if (rotation) body.setNextKinematicRotation(rotation);
    },
  };
}

function createSession(
  rapier: RapierModule,
  options: RapierSoftBodyHostOptions,
): RapierSoftBodySession {
  const gravity = options.gravity ?? { x: 0, y: -9.81, z: 0 };
  const world = new rapier.World(gravity);
  world.timestep = options.fixedDt ?? 1 / 60;
  if (options.solverIterations !== undefined) world.numSolverIterations = options.solverIterations;
  if (options.internalPgsIterations !== undefined) {
    world.numInternalPgsIterations = options.internalPgsIterations;
  }
  const softBodies: RapierNamespace.SoftBody[] = [];

  return {
    rapier,
    world,
    softBodies,
    addFixedBox(center, size, opts) {
      return createRigidCollider(
        world,
        rapier.RigidBodyDesc.fixed(),
        rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2),
        center,
        opts,
      );
    },
    addFixedCylinder(center, radius, height, opts) {
      return createRigidCollider(
        world,
        rapier.RigidBodyDesc.fixed(),
        rapier.ColliderDesc.cylinder(height / 2, radius),
        center,
        opts,
      );
    },
    addFixedCapsule(center, radius, halfHeight, opts) {
      return createRigidCollider(
        world,
        rapier.RigidBodyDesc.fixed(),
        rapier.ColliderDesc.capsule(halfHeight, radius),
        center,
        opts,
      );
    },
    addKinematicBox(center, size, opts) {
      return createRigidCollider(
        world,
        rapier.RigidBodyDesc.kinematicPositionBased(),
        rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2),
        center,
        opts,
      );
    },
    addKinematicCylinder(center, radius, height, opts) {
      return createRigidCollider(
        world,
        rapier.RigidBodyDesc.kinematicPositionBased(),
        rapier.ColliderDesc.cylinder(height / 2, radius),
        center,
        opts,
      );
    },
    createCloth(spec) {
      const desc = rapier.SoftBodyDesc.cloth(spec.origin, spec.du, spec.dv, spec.nu, spec.nv);
      applySoftBodyCommon(rapier, desc, spec);
      const body = world.createSoftBody(desc);
      softBodies.push(body);
      return body;
    },
    createClothTube(spec) {
      const desc = rapier.SoftBodyDesc.clothTube(
        spec.origin,
        spec.axis,
        spec.radiusStart,
        spec.radiusEnd,
        spec.numAround,
        spec.numAlong,
      );
      applySoftBodyCommon(rapier, desc, spec);
      const body = world.createSoftBody(desc);
      softBodies.push(body);
      return body;
    },
    createRope(spec) {
      const desc = rapier.SoftBodyDesc.rope(spec.start, spec.end, spec.numParticles);
      applySoftBodyCommon(rapier, desc, spec);
      const body = world.createSoftBody(desc);
      softBodies.push(body);
      return body;
    },
    createCustomRope(spec) {
      const n = spec.points.length;
      const flat = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const p = spec.points[i]!;
        flat[i * 3] = p.x;
        flat[i * 3 + 1] = p.y;
        flat[i * 3 + 2] = p.z;
      }
      const desc = new rapier.SoftBodyDesc(flat);
      const closed = spec.closed ?? false;
      const edges: number[] = [];
      for (let i = 0; i < n - 1; i++) edges.push(i, i + 1);
      if (closed && n > 2) edges.push(n - 1, 0);
      desc.setEdges(edges);
      if (spec.bending ?? true) {
        const bend: number[] = [];
        for (let i = 0; i < n - 2; i++) bend.push(i, i + 2);
        if (closed && n > 3) {
          bend.push(n - 2, 0, n - 1, 1);
        }
        if (bend.length > 0) desc.setBendEdges(bend);
      }
      if (spec.wireCollision ?? true) {
        desc.setWire(edges);
      }
      applySoftBodyCommon(rapier, desc, spec);
      const body = world.createSoftBody(desc);
      softBodies.push(body);
      return body;
    },
    wakeUpAll() {
      for (const body of softBodies) {
        if (body.isValid()) body.wakeUp();
      }
    },
  };
}

/**
 * Shared lazy-loading Rapier soft-body simulation host for an active ritual.
 * - Never initializes WASM until `start()` is invoked.
 * - Stops stepping when inactive/paused, in reduced motion, or once settled asleep.
 * - Releases the entire Rapier WASM world cleanly on `dispose()`.
 */
export function createRapierSoftBodyHost(
  options: RapierSoftBodyHostOptions = {},
): RapierSoftBodyHost {
  const fixedDt = options.fixedDt ?? 1 / 60;
  const maxSubsteps = options.maxSubsteps ?? 4;
  const sleepSpeedThreshold = options.sleepSpeedThreshold ?? 0.008;
  const sleepTimeRequired = options.sleepTimeRequired ?? 0.45;

  let session: RapierSoftBodySession | null = null;
  let startPromise: Promise<RapierSoftBodySession | null> | null = null;
  let disposed = false;
  let accumulator = 0;
  let quietElapsed = 0;
  let sleeping = false;

  function maxParticleSpeed(current: RapierSoftBodySession): number {
    let maxSq = 0;
    for (const body of current.softBodies) {
      if (!body.isValid() || body.isSleeping()) continue;
      const v = body.particleVelocities();
      for (let i = 0; i < v.length; i += 3) {
        const vx = v[i]!, vy = v[i + 1]!, vz = v[i + 2]!;
        const sq = vx * vx + vy * vy + vz * vz;
        if (sq > maxSq) maxSq = sq;
      }
    }
    return Math.sqrt(maxSq);
  }

  function allBodiesRapierSleeping(current: RapierSoftBodySession): boolean {
    if (current.softBodies.length === 0) return false;
    for (const body of current.softBodies) {
      if (body.isValid() && !body.isSleeping()) return false;
    }
    return true;
  }

  return {
    get ready() {
      return session !== null && !disposed;
    },
    get disposed() {
      return disposed;
    },
    get sleeping() {
      return sleeping;
    },
    get session() {
      return disposed ? null : session;
    },
    start() {
      if (disposed) return Promise.resolve(null);
      if (session) return Promise.resolve(session);
      if (!startPromise) {
        startPromise = loadRapier(options.loader)
          .then((rapier) => {
            if (disposed) return null;
            const created = createSession(rapier, options);
            session = created;
            try {
              options.onReady?.(created);
            } catch (error) {
              options.onError?.(error);
            }
            return created;
          })
          .catch((error) => {
            startPromise = null;
            options.onError?.(error);
            return null;
          });
      }
      return startPromise;
    },
    step(dt, beforeStep, afterStep) {
      if (disposed || !session) return false;
      if (options.isActive && !options.isActive()) return false;
      if (options.isReducedMotion && options.isReducedMotion()) return false;
      if (!Number.isFinite(dt) || dt <= 0) return false;
      if (sleeping) return false;

      const clamped = Math.min(dt, 0.05);
      accumulator += clamped;
      let steps = 0;
      session.world.timestep = fixedDt;

      while (accumulator >= fixedDt && steps < maxSubsteps) {
        beforeStep?.(session, fixedDt);
        session.world.step();
        accumulator -= fixedDt;
        steps++;
      }

      if (steps === 0) {
        // Run a single smaller substep when frame dt < fixedDt (e.g. 120Hz displays)
        // only when accumulator crosses half a fixed step; otherwise keep smooth pacing.
        return false;
      }
      if (accumulator > fixedDt * maxSubsteps) accumulator = 0;

      const steppedTime = steps * fixedDt;
      if (allBodiesRapierSleeping(session)) {
        sleeping = true;
        quietElapsed = sleepTimeRequired;
      } else if (sleepSpeedThreshold > 0 && session.softBodies.length > 0) {
        if (maxParticleSpeed(session) < sleepSpeedThreshold) {
          quietElapsed += steppedTime;
          if (quietElapsed >= sleepTimeRequired) sleeping = true;
        } else {
          quietElapsed = 0;
        }
      }

      afterStep?.(session);
      return true;
    },
    settle(steps, beforeStep) {
      if (disposed || !session || steps <= 0) return false;
      session.world.timestep = fixedDt;
      for (let i = 0; i < steps; i++) {
        beforeStep?.(session, fixedDt);
        session.world.step();
      }
      accumulator = 0;
      return true;
    },
    wakeUp() {
      if (disposed) return;
      sleeping = false;
      quietElapsed = 0;
      session?.wakeUpAll();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      accumulator = 0;
      quietElapsed = 0;
      sleeping = false;
      const current = session;
      session = null;
      if (current) {
        try {
          current.world.free();
        } catch {
          // Ignore double-free or WASM teardown errors.
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Reusable geometry write-back helpers (preserve existing BufferAttributes!)
// ---------------------------------------------------------------------------

export interface SyncPositionsOptions {
  /** Maps geometry vertex index `i` -> particle index. If omitted, 1:1 mapping is used. */
  vertexToParticle?: Uint32Array | readonly number[];
  /** Optional world-to-local matrix applied to particle positions before writing. */
  worldToLocal?: THREE.Matrix4;
  computeNormals?: boolean;
  computeBounds?: boolean;
}

const _tmpVec = new THREE.Vector3();

/** Writes flattened Rapier particle positions into an existing Three.js BufferGeometry in-place. */
export function syncParticlesToGeometry(
  particlePositions: Float32Array,
  geometry: THREE.BufferGeometry,
  options: SyncPositionsOptions = {},
): void {
  const attr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!attr) return;
  const map = options.vertexToParticle;
  const count = map ? Math.min(attr.count, map.length) : Math.min(attr.count, Math.floor(particlePositions.length / 3));
  const m = options.worldToLocal;

  for (let i = 0; i < count; i++) {
    const pIdx = (map ? map[i]! : i) * 3;
    let x = particlePositions[pIdx]!;
    let y = particlePositions[pIdx + 1]!;
    let z = particlePositions[pIdx + 2]!;
    if (m) {
      _tmpVec.set(x, y, z).applyMatrix4(m);
      x = _tmpVec.x;
      y = _tmpVec.y;
      z = _tmpVec.z;
    }
    attr.setXYZ(i, x, y, z);
  }
  attr.needsUpdate = true;
  if (options.computeNormals ?? true) geometry.computeVertexNormals();
  if (options.computeBounds ?? true) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
}

export interface ClosedTubeWriter {
  /** Updates the non-indexed tube solid (and optional welded outline shell) in-place from centerline points. */
  update(controlPoints: readonly THREE.Vector3[]): void;
}

/**
 * Builds a zero-allocation in-place writer for a closed non-indexed `tubeSolid`
 * geometry (with matching welded outline shell) produced by `TubeGeometry(curve, tubular, radius, radial, true)`.
 * Preserves triangle winding, UVs, buffer identity, and matching outline bounds.
 */
export function createClosedTubeWriter(
  tubeGeometry: THREE.BufferGeometry,
  tubularSegments: number,
  radialSegments: number,
  radius: number,
  outlineGeometry?: THREE.BufferGeometry,
  clampCenter?: (point: THREE.Vector3) => void,
): ClosedTubeWriter {
  const ringCount = tubularSegments;
  const sideCount = radialSegments;
  const sampleCount = ringCount + 1;
  const ringPositions = new Float32Array(ringCount * sideCount * 3);
  const ringNormals = new Float32Array(ringCount * sideCount * 3);
  const centers: THREE.Vector3[] = Array.from({ length: ringCount }, () => new THREE.Vector3());
  const tangents: THREE.Vector3[] = Array.from({ length: ringCount }, () => new THREE.Vector3());
  const normals: THREE.Vector3[] = Array.from({ length: ringCount }, () => new THREE.Vector3());
  const binormals: THREE.Vector3[] = Array.from({ length: ringCount }, () => new THREE.Vector3());
  const cosTable = new Float32Array(sideCount);
  const sinTable = new Float32Array(sideCount);
  for (let j = 0; j < sideCount; j++) {
    const angle = (j / sideCount) * Math.PI * 2;
    cosTable[j] = -Math.cos(angle);
    sinTable[j] = Math.sin(angle);
  }

  // Detect whether `tubeSolid` flipped winding (compare initial geometry volume orientation).
  const posAttr = tubeGeometry.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = tubeGeometry.getAttribute('normal') as THREE.BufferAttribute;

  // Map each vertex of `tubeGeometry` and `outlineGeometry` to the nearest `(ring, side)` slot
  // on the initial tube so we preserve the exact winding, UVs, and welded shell vertex indices!
  const initPos = posAttr;
  const expectedTris = ringCount * sideCount * 2;
  const directMapped = initPos.count === expectedTris * 3;

  // Build exact index mapping for outlineGeometry (which was produced via `mergeVertices`).
  let outlineMap: Uint32Array | null = null;
  if (outlineGeometry) {
    const outPos = outlineGeometry.getAttribute('position') as THREE.BufferAttribute;
    outlineMap = new Uint32Array(outPos.count);
    // Match each welded outline vertex to its source vertex in tubeGeometry by initial coordinates.
    const lookup = new Map<string, number>();
    const keyOf = (x: number, y: number, z: number) =>
      `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    for (let i = 0; i < initPos.count; i++) {
      const k = keyOf(initPos.getX(i), initPos.getY(i), initPos.getZ(i));
      if (!lookup.has(k)) lookup.set(k, i);
    }
    for (let i = 0; i < outPos.count; i++) {
      const k = keyOf(outPos.getX(i), outPos.getY(i), outPos.getZ(i));
      const matched = lookup.get(k);
      if (matched !== undefined) {
        outlineMap[i] = matched;
      } else {
        // Fallback nearest vertex search (runs once at init only).
        let best = 0;
        let bestDist = Infinity;
        const ox = outPos.getX(i), oy = outPos.getY(i), oz = outPos.getZ(i);
        for (let j = 0; j < initPos.count; j++) {
          const dx = initPos.getX(j) - ox, dy = initPos.getY(j) - oy, dz = initPos.getZ(j) - oz;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < bestDist) { bestDist = d; best = j; }
        }
        outlineMap[i] = best;
      }
    }
  }

  // Detect whether triangle (1,2) in `tubeSolid` were swapped relative to Three's TubeGeometry.
  // In TubeGeometry for (i=1, j=1): tri 0 = (a, b, d), tri 1 = (b, c, d), where
  // a=(0,0), b=(1,0), c=(1,1), d=(0,1). Check if vertex 1 is closer to next ring or next radial.
  const v0 = new THREE.Vector3().fromBufferAttribute(initPos, 0);
  const v1 = new THREE.Vector3().fromBufferAttribute(initPos, 1);
  const v2 = new THREE.Vector3().fromBufferAttribute(initPos, 2);
  const n0 = new THREE.Vector3().fromBufferAttribute(normAttr, 0);
  const faceCross = v1.clone().sub(v0).cross(v2.clone().sub(v0));
  // Check outward orientation against reference; if normal aligns with (v1-v0)x(v2-v0) it's outward.
  const flipWinding = faceCross.dot(n0) < 0;

  // Build vertex -> (ring * sideCount + side) mapping directly from TubeGeometry's canonical order.
  // TubeGeometry generates triangles in loops: for (i = 1..tubularSegments) for (j = 1..radialSegments)
  // tri0: a=(i-1, j-1), b=(i, j-1), d=(i-1, j)
  // tri1: b=(i, j-1), c=(i, j), d=(i-1, j)
  // Determine whether source had swapped winding during tubeSolid().
  const a0 = new THREE.Vector3().fromBufferAttribute(initPos, 0);
  const b0 = new THREE.Vector3().fromBufferAttribute(initPos, 1);
  const d0 = new THREE.Vector3().fromBufferAttribute(initPos, 2);
  // In standard TubeGeometry, vertex 3 (start of tri 1) equals vertex 1 (b) if unswapped,
  // or equals vertex 2 (b after swap of tri0's 1<->2 and tri1's 1<->2).
  const v3 = new THREE.Vector3().fromBufferAttribute(initPos, 3);
  const swappedByTubeSolid = v3.distanceToSquared(d0) < v3.distanceToSquared(b0);

  const vertexSlot = new Uint32Array(directMapped ? initPos.count : 0);
  if (directMapped) {
    let cursor = 0;
    for (let i = 1; i <= ringCount; i++) {
      const rPrev = (i - 1) % ringCount;
      const rCurr = i % ringCount;
      for (let j = 1; j <= sideCount; j++) {
        const sPrev = (j - 1) % sideCount;
        const sCurr = j % sideCount;
        const a = rPrev * sideCount + sPrev;
        const b = rCurr * sideCount + sPrev;
        const c = rCurr * sideCount + sCurr;
        const d = rPrev * sideCount + sCurr;
        if (swappedByTubeSolid) {
          vertexSlot[cursor++] = a;
          vertexSlot[cursor++] = d;
          vertexSlot[cursor++] = b;
          vertexSlot[cursor++] = b;
          vertexSlot[cursor++] = d;
          vertexSlot[cursor++] = c;
        } else {
          vertexSlot[cursor++] = a;
          vertexSlot[cursor++] = b;
          vertexSlot[cursor++] = d;
          vertexSlot[cursor++] = b;
          vertexSlot[cursor++] = c;
          vertexSlot[cursor++] = d;
        }
      }
    }
  }
  void a0; void flipWinding;

  const tmpAxis = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const upRef = new THREE.Vector3(0, 1, 0);
  const sideRef = new THREE.Vector3(1, 0, 0);

  return {
    update(controlPoints) {
      if (!directMapped || controlPoints.length < 3) return;
      const curve = new THREE.CatmullRomCurve3(controlPoints as THREE.Vector3[], true, 'centripetal');
      for (let i = 0; i < ringCount; i++) {
        curve.getPointAt(i / ringCount, centers[i]!);
        if (clampCenter) clampCenter(centers[i]!);
      }
      let maxAbsTy = 0;
      for (let i = 0; i < ringCount; i++) {
        const prev = centers[(i - 1 + ringCount) % ringCount]!;
        const next = centers[(i + 1) % ringCount]!;
        tangents[i]!.subVectors(next, prev).normalize();
        const absTy = Math.abs(tangents[i]!.y);
        if (absTy > maxAbsTy) maxAbsTy = absTy;
      }

      if (maxAbsTy < 0.85) {
        // Horizontal-plane loop: keep cross-section normal aligned with world +Y
        // so the tube sits cleanly on horizontal supports without holonomy twist.
        for (let i = 0; i < ringCount; i++) {
          const t = tangents[i]!;
          normals[i]!.copy(upRef).addScaledVector(t, -upRef.dot(t)).normalize();
          binormals[i]!.crossVectors(t, normals[i]!).normalize();
        }
      } else {
        // General 3D loop: parallel-transport (rotation-minimizing) frame + twist closure.
        const t0 = tangents[0]!;
        const ref = Math.abs(t0.dot(upRef)) < 0.9 ? upRef : sideRef;
        normals[0]!.copy(ref).addScaledVector(t0, -ref.dot(t0)).normalize();
        binormals[0]!.crossVectors(t0, normals[0]!).normalize();

        for (let i = 1; i < ringCount; i++) {
          const prevT = tangents[i - 1]!;
          const currT = tangents[i]!;
          normals[i]!.copy(normals[i - 1]!);
          tmpAxis.crossVectors(prevT, currT);
          const sinLen = tmpAxis.length();
          if (sinLen > 1e-6) {
            tmpAxis.divideScalar(sinLen);
            const theta = Math.acos(THREE.MathUtils.clamp(prevT.dot(currT), -1, 1));
            tmpQuat.setFromAxisAngle(tmpAxis, theta);
            normals[i]!.applyQuaternion(tmpQuat);
          }
          normals[i]!.addScaledVector(currT, -normals[i]!.dot(currT)).normalize();
          binormals[i]!.crossVectors(currT, normals[i]!).normalize();
        }

        const lastT = tangents[ringCount - 1]!;
        const closingN = normals[ringCount - 1]!.clone();
        tmpAxis.crossVectors(lastT, t0);
        if (tmpAxis.lengthSq() > 1e-12) {
          tmpAxis.normalize();
          const theta = Math.acos(THREE.MathUtils.clamp(lastT.dot(t0), -1, 1));
          closingN.applyQuaternion(tmpQuat.setFromAxisAngle(tmpAxis, theta));
        }
        closingN.addScaledVector(t0, -closingN.dot(t0)).normalize();
        const twist = Math.atan2(closingN.dot(binormals[0]!), closingN.dot(normals[0]!));
        if (Math.abs(twist) > 1e-6) {
          for (let i = 1; i < ringCount; i++) {
            const angle = -twist * (i / ringCount);
            const ca = Math.cos(angle), sa = Math.sin(angle);
            const nx = normals[i]!.x * ca + binormals[i]!.x * sa;
            const ny = normals[i]!.y * ca + binormals[i]!.y * sa;
            const nz = normals[i]!.z * ca + binormals[i]!.z * sa;
            normals[i]!.set(nx, ny, nz).normalize();
            binormals[i]!.crossVectors(tangents[i]!, normals[i]!).normalize();
          }
        }
      }

      for (let i = 0; i < ringCount; i++) {
        const c = centers[i]!, n = normals[i]!, b = binormals[i]!;
        for (let j = 0; j < sideCount; j++) {
          const ca = cosTable[j]!, sa = sinTable[j]!;
          const nx = ca * n.x + sa * b.x;
          const ny = ca * n.y + sa * b.y;
          const nz = ca * n.z + sa * b.z;
          const idx = (i * sideCount + j) * 3;
          ringNormals[idx] = nx;
          ringNormals[idx + 1] = ny;
          ringNormals[idx + 2] = nz;
          ringPositions[idx] = c.x + radius * nx;
          ringPositions[idx + 1] = c.y + radius * ny;
          ringPositions[idx + 2] = c.z + radius * nz;
        }
      }

      const pArr = posAttr.array as Float32Array;
      const nArr = normAttr.array as Float32Array;
      for (let k = 0; k < vertexSlot.length; k++) {
        const src = vertexSlot[k]! * 3;
        const dst = k * 3;
        pArr[dst] = ringPositions[src]!;
        pArr[dst + 1] = ringPositions[src + 1]!;
        pArr[dst + 2] = ringPositions[src + 2]!;
        nArr[dst] = ringNormals[src]!;
        nArr[dst + 1] = ringNormals[src + 1]!;
        nArr[dst + 2] = ringNormals[src + 2]!;
      }
      posAttr.needsUpdate = true;
      normAttr.needsUpdate = true;
      tubeGeometry.computeBoundingBox();
      tubeGeometry.computeBoundingSphere();

      if (outlineGeometry && outlineMap) {
        const outP = outlineGeometry.getAttribute('position') as THREE.BufferAttribute;
        const outN = outlineGeometry.getAttribute('normal') as THREE.BufferAttribute;
        const opArr = outP.array as Float32Array;
        const onArr = outN.array as Float32Array;
        for (let i = 0; i < outlineMap.length; i++) {
          const src = vertexSlot[outlineMap[i]!]! * 3;
          const dst = i * 3;
          opArr[dst] = ringPositions[src]!;
          opArr[dst + 1] = ringPositions[src + 1]!;
          opArr[dst + 2] = ringPositions[src + 2]!;
          onArr[dst] = ringNormals[src]!;
          onArr[dst + 1] = ringNormals[src + 1]!;
          onArr[dst + 2] = ringNormals[src + 2]!;
        }
        outP.needsUpdate = true;
        outN.needsUpdate = true;
        outlineGeometry.computeBoundingBox();
        outlineGeometry.computeBoundingSphere();
      }
      void sampleCount;
    },
  };
}
