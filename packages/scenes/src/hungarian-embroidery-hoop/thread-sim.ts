import * as THREE from 'three'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
  type RigidColliderHandle,
} from '@wbr/scene-runtime/rapier-soft-body'

export const TABLE_TOP_Y = .76
export const SPOOL_EXIT_LOCAL = new THREE.Vector3(.136, -.088, .054)
export const TAIL_PARTICLES = 18
export const TAIL_RADIUS = .0092

const _pt = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _prevTan = new THREE.Vector3()
const _norm = new THREE.Vector3()
const _binorm = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _refZ = new THREE.Vector3(0, 0, 1)
const _refY = new THREE.Vector3(0, 1, 0)
const _seamN = new THREE.Vector3()

/**
 * Rewrites a pre-allocated TubeGeometry in-place using Bishop parallel-transport frames
 * and a soft 2-ply twisted embroidery floss profile (zero per-frame allocations).
 */
export function writeFlossTubeInPlace(
  geometry: THREE.TubeGeometry,
  controlPoints: readonly THREE.Vector3[],
  options: { turns?: number; plyDepth?: number; phase?: number; taperEnd?: boolean } = {},
): void {
  const { tubularSegments, radius, radialSegments } = geometry.parameters
  const turns = options.turns ?? 7
  const plyDepth = options.plyDepth ?? .075
  const phase = options.phase ?? 0
  const taperEnd = options.taperEnd ?? false
  const curve = geometry.parameters.path as THREE.CatmullRomCurve3
  if (curve.points.length !== controlPoints.length) {
    curve.points = controlPoints.map(v => v.clone())
  } else {
    for (let i = 0; i < controlPoints.length; i++) curve.points[i]!.copy(controlPoints[i]!)
  }
  curve.updateArcLengths()

  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute
  const ringStride = radialSegments + 1

  curve.getTangentAt(0, _prevTan).normalize()
  const ref = Math.abs(_prevTan.dot(_refZ)) < .92 ? _refZ : _refY
  _norm.crossVectors(ref, _prevTan).normalize()
  _binorm.crossVectors(_prevTan, _norm).normalize()

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    curve.getPointAt(u, _pt)
    if (i > 0) {
      curve.getTangentAt(u, _tan).normalize()
      const dot = THREE.MathUtils.clamp(_prevTan.dot(_tan), -1, 1)
      if (dot < .999999) {
        if (dot > -.999999) {
          _quat.setFromUnitVectors(_prevTan, _tan)
          _norm.applyQuaternion(_quat)
        }
        _norm.addScaledVector(_tan, -_norm.dot(_tan))
        if (_norm.lengthSq() > 1e-10) _norm.normalize()
      }
      _binorm.crossVectors(_tan, _norm).normalize()
      _prevTan.copy(_tan)
    }

    const twistAngle = u * turns * Math.PI * 2 + phase
    let endScale = 1
    if (taperEnd && i === tubularSegments) endScale = .68
    else if (taperEnd && i === tubularSegments - 1) endScale = .88

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2
      const r = radius * (1 + plyDepth * Math.cos(2 * (theta - twistAngle))) * endScale
      const cx = -Math.cos(theta)
      const sy = Math.sin(theta)
      const nx = _norm.x * cx + _binorm.x * sy
      const ny = _norm.y * cx + _binorm.y * sy
      const nz = _norm.z * cx + _binorm.z * sy
      posAttr.setXYZ(i * ringStride + j, _pt.x + nx * r, _pt.y + ny * r, _pt.z + nz * r)
    }
  }

  posAttr.needsUpdate = true
  geometry.computeVertexNormals()
  for (let i = 0; i <= tubularSegments; i++) {
    const a = i * ringStride
    const b = a + radialSegments
    _seamN.set(
      normAttr.getX(a) + normAttr.getX(b),
      normAttr.getY(a) + normAttr.getY(b),
      normAttr.getZ(a) + normAttr.getZ(b),
    )
    if (_seamN.lengthSq() > 1e-10) {
      _seamN.normalize()
      normAttr.setXYZ(a, _seamN.x, _seamN.y, _seamN.z)
      normAttr.setXYZ(b, _seamN.x, _seamN.y, _seamN.z)
    }
  }
  normAttr.needsUpdate = true
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

/**
 * Clamps a world-space loose-thread point clear of the birch tabletop and the spool body.
 * Display clearance guard paired with the Rapier rigid colliders.
 */
export function clampThreadClearOfSupport(
  p: THREE.Vector3,
  spoolPos: THREE.Vector3,
  radius = TAIL_RADIUS,
  clearance = .0025,
): boolean {
  let clamped = false
  const minY = TABLE_TOP_Y + radius + clearance
  if (p.y < minY) {
    p.y = minY
    clamped = true
  }
  // Keep points outside the spool flange cylinder except right near the wound exit.
  const dx = p.x - spoolPos.x
  const dz = p.z - spoolPos.z
  const dy = p.y - spoolPos.y
  if (Math.abs(dy) < .235) {
    const minR = .144 + radius
    const dist = Math.hypot(dx, dz)
    if (dist > 1e-6 && dist < minR) {
      const s = minR / dist
      p.x = spoolPos.x + dx * s
      p.z = spoolPos.z + dz * s
      clamped = true
    }
  }
  return clamped
}

/**
 * Deterministic calm analytical resting curve for the spool's loose embroidery thread.
 * Used at initial render before WASM loads, for fresh reduced-motion entry (zero WASM),
 * and whenever reduced motion is toggled on at runtime.
 */
export function buildCalmTailPoints(
  spoolPos: THREE.Vector3,
  out: THREE.Vector3[],
  stitchTarget?: THREE.Vector3 | null,
): THREE.Vector3[] {
  const n = out.length
  const start = _pt.copy(spoolPos).add(SPOOL_EXIT_LOCAL)
  const floorY = TABLE_TOP_Y + TAIL_RADIUS + .002

  if (stitchTarget) {
    const dist = start.distanceTo(stitchTarget)
    const sag = Math.min(.09, .022 + dist * .08)
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1)
      const p = out[i]!
      p.lerpVectors(start, stitchTarget, u)
      const arch = Math.sin(Math.PI * u)
      p.y -= sag * arch
      p.z += .026 * arch
      if (i > 0 && i < n - 1) clampThreadClearOfSupport(p, spoolPos)
    }
    return out
  }

  // Natural relaxed S-curve draping down from the wound spool onto the birch table (+X side).
  const waypoints = [
    start.clone(),
    new THREE.Vector3(spoolPos.x + .19, Math.max(floorY, spoolPos.y - .155), spoolPos.z + .085),
    new THREE.Vector3(spoolPos.x + .26, floorY, spoolPos.z + .115),
    new THREE.Vector3(spoolPos.x + .35, floorY, spoolPos.z + .078),
    new THREE.Vector3(spoolPos.x + .43, floorY, spoolPos.z + .125),
  ]
  const curve = new THREE.CatmullRomCurve3(waypoints, false, 'centripetal')
  for (let i = 0; i < n; i++) {
    curve.getPointAt(i / (n - 1), out[i]!)
    if (i > 0) clampThreadClearOfSupport(out[i]!, spoolPos)
  }
  return out
}

export interface SpoolThreadSimOptions {
  spoolPos: THREE.Vector3
  isActive: () => boolean
  isReducedMotion: () => boolean
  loader?: () => Promise<import('@wbr/scene-runtime/rapier-soft-body').RapierModule>
}

export interface SpoolThreadSim {
  readonly ready: boolean
  readonly disposed: boolean
  readonly sleeping: boolean
  /** Lazily starts the Rapier soft-body host ONLY when active and not in reduced motion. */
  start(): void
  /** Advances physics or writes deterministic calm analytical pose, returning world-space points. */
  step(
    dt: number,
    spoolPos: THREE.Vector3,
    stitchTarget: THREE.Vector3 | null,
    dragging: boolean,
  ): readonly THREE.Vector3[]
  /** Snaps internal points cleanly to the calm resting pose (on restore / cancel / reduced toggle). */
  resetToCalm(spoolPos: THREE.Vector3, stitchTarget?: THREE.Vector3 | null): readonly THREE.Vector3[]
  wakeUp(): void
  dispose(): void
}

/**
 * Hybrid Rapier soft-body driver for the loose trailing embroidery thread on the foreground spool.
 * - Zero WASM on construction or fresh reduced-motion entry.
 * - 18-particle Rapier rope pinned at the spool exit with tabletop box & kinematic spool cylinder colliders.
 * - During the step-0 stitching pass, guides the free working tip continuously to the active embroidery stitch,
 *   then releases it so the thread trails and settles gently back onto the birch tabletop.
 * - Clamping and mild display smoothing are explicit display constraints, not calibrated thread mechanics.
 */
export function createSpoolThreadSim(options: SpoolThreadSimOptions): SpoolThreadSim {
  const worldPts = Array.from({ length: TAIL_PARTICLES }, () => new THREE.Vector3())
  const smoothPts = Array.from({ length: TAIL_PARTICLES }, () => new THREE.Vector3())
  const restPts = Array.from({ length: TAIL_PARTICLES }, () => new THREE.Vector3())
  buildCalmTailPoints(options.spoolPos, worldPts, null)
  for (let i = 0; i < TAIL_PARTICLES; i++) smoothPts[i]!.copy(worldPts[i]!)

  let rope: import('@dimforge/rapier3d-simd').SoftBody | null = null
  let spoolCollider: RigidColliderHandle | null = null
  let lastSpool = options.spoolPos.clone()
  let currentSpool = options.spoolPos.clone()
  let currentTarget: THREE.Vector3 | null = null
  let wasReduced = options.isReducedMotion()
  let hadTarget = false
  let initialized = false

  const syncPinsAndColliders = (session: RapierSoftBodySession, _subDt: number) => {
    if (!rope || !rope.isValid()) return
    const exitX = currentSpool.x + SPOOL_EXIT_LOCAL.x
    const exitY = currentSpool.y + SPOOL_EXIT_LOCAL.y
    const exitZ = currentSpool.z + SPOOL_EXIT_LOCAL.z
    rope.setParticlePosition(0, { x: exitX, y: exitY, z: exitZ })
    rope.setParticleVelocity(0, { x: 0, y: 0, z: 0 })
    spoolCollider?.setKinematicTarget(
      { x: currentSpool.x, y: currentSpool.y, z: currentSpool.z },
    )

    if (currentTarget) {
      // Pin the free working tip gently toward the active embroidery stitch and shape a soft catenary.
      const last = TAIL_PARTICLES - 1
      rope.setParticlePosition(last, { x: currentTarget.x, y: currentTarget.y, z: currentTarget.z })
      rope.setParticleVelocity(last, { x: 0, y: 0, z: 0 })
      const pos = rope.particlePositions()
      const vel = rope.particleVelocities()
      buildCalmTailPoints(currentSpool, restPts, currentTarget)
      for (let i = 1; i < last; i++) {
        const idx = i * 3
        const targetPt = restPts[i]!
        // Gentle elastic pull toward the active catenary so the thread tracks cleanly without snapping rigid.
        const blend = .22
        const nx = pos[idx]! + (targetPt.x - pos[idx]!) * blend
        const ny = pos[idx + 1]! + (targetPt.y - pos[idx + 1]!) * blend
        const nz = pos[idx + 2]! + (targetPt.z - pos[idx + 2]!) * blend
        rope.setParticlePosition(i, { x: nx, y: ny, z: nz })
        rope.setParticleVelocity(i, {
          x: vel[idx]! * .72,
          y: vel[idx + 1]! * .72,
          z: vel[idx + 2]! * .72,
        })
      }
    } else {
      // Mild lateral rest guidance when near the tabletop so the free tail relaxes into a tidy craft curl
      // instead of bunching vertically against the spool flange.
      const pos = rope.particlePositions()
      const vel = rope.particleVelocities()
      const nearTable = Math.abs(currentSpool.y - .99) < .05
      if (nearTable) {
        buildCalmTailPoints(currentSpool, restPts, null)
        for (let i = 1; i < TAIL_PARTICLES; i++) {
          const idx = i * 3
          const t = i / (TAIL_PARTICLES - 1)
          const pull = .018 * t
          const fx = (restPts[i]!.x - pos[idx]!) * pull
          const fz = (restPts[i]!.z - pos[idx + 2]!) * pull
          rope.setParticleVelocity(i, {
            x: vel[idx]! + fx,
            y: vel[idx + 1]!,
            z: vel[idx + 2]! + fz,
          })
        }
      }
    }
    void session
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -5.4, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 3,
    solverIterations: 6,
    internalPgsIterations: 2,
    sleepSpeedThreshold: .012,
    sleepTimeRequired: .45,
    isActive: options.isActive,
    isReducedMotion: options.isReducedMotion,
    loader: options.loader,
    onReady(session) {
      // Fixed birch tabletop box collider (top at y = 0.76).
      session.addFixedBox(
        { x: 0, y: TABLE_TOP_Y - .06, z: .04 },
        { x: 3.48, y: .12, z: 1.70 },
        { friction: .78, restitution: .02 },
      )
      // Kinematic spool cylinder collider.
      spoolCollider = session.addKinematicCylinder(
        { x: currentSpool.x, y: currentSpool.y, z: currentSpool.z },
        .145,
        .42,
        { friction: .55, restitution: .02 },
      )
      buildCalmTailPoints(currentSpool, restPts, currentTarget)
      rope = session.createCustomRope({
        points: restPts.map(p => ({ x: p.x, y: p.y, z: p.z })),
        closed: false,
        bending: true,
        wireCollision: true,
        particleMass: .012,
        particleRadius: TAIL_RADIUS,
        linearDamping: 5.5,
        gravityScale: 1,
        edgeSoftness: { naturalFrequency: 28, dampingRatio: .9 },
        bendSoftness: { naturalFrequency: 10, dampingRatio: .85 },
        pinnedParticles: [0],
        friction: .65,
        restitution: .02,
        canSleep: true,
      })
      // Brief calm settle so the initial live frame rests organically on the table.
      host.settle(14, syncPinsAndColliders)
      readBackFromRapier(true)
      initialized = true
    },
  })

  function readBackFromRapier(snap = false) {
    if (!rope || !rope.isValid()) return
    const pos = rope.particlePositions()
    const exit = _pt.copy(currentSpool).add(SPOOL_EXIT_LOCAL)
    for (let i = 0; i < TAIL_PARTICLES; i++) {
      const idx = i * 3
      const x = pos[idx]!, y = pos[idx + 1]!, z = pos[idx + 2]!
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        worldPts[i]!.set(x, y, z)
      }
      if (i === 0) {
        worldPts[i]!.copy(exit)
      } else if (i === TAIL_PARTICLES - 1 && currentTarget) {
        worldPts[i]!.copy(currentTarget)
      } else {
        clampThreadClearOfSupport(worldPts[i]!, currentSpool)
      }
      if (snap) smoothPts[i]!.copy(worldPts[i]!)
      else smoothPts[i]!.lerp(worldPts[i]!, .42)
    }
    smoothPts[0]!.copy(exit)
    if (currentTarget) smoothPts[TAIL_PARTICLES - 1]!.copy(currentTarget)
  }

  function resetParticlesToCalm() {
    buildCalmTailPoints(currentSpool, worldPts, currentTarget)
    for (let i = 0; i < TAIL_PARTICLES; i++) smoothPts[i]!.copy(worldPts[i]!)
    if (rope && rope.isValid()) {
      for (let i = 0; i < TAIL_PARTICLES; i++) {
        const p = worldPts[i]!
        rope.setParticlePosition(i, { x: p.x, y: p.y, z: p.z })
        rope.setParticleVelocity(i, { x: 0, y: 0, z: 0 })
      }
      spoolCollider?.setPose({ x: currentSpool.x, y: currentSpool.y, z: currentSpool.z })
    }
  }

  return {
    get ready() {
      return host.ready && initialized
    },
    get disposed() {
      return host.disposed
    },
    get sleeping() {
      return host.sleeping
    },
    start() {
      if (host.disposed) return
      if (!options.isActive() || options.isReducedMotion()) return
      void host.start()
    },
    step(dt, spoolPos, stitchTarget, dragging) {
      currentSpool.copy(spoolPos)
      currentTarget = stitchTarget
      const isReduced = options.isReducedMotion()

      if (isReduced) {
        if (!wasReduced || !lastSpool.equals(spoolPos) || Boolean(stitchTarget) !== hadTarget) {
          resetParticlesToCalm()
        }
        wasReduced = true
        hadTarget = Boolean(stitchTarget)
        lastSpool.copy(spoolPos)
        return smoothPts
      }

      if (wasReduced) {
        wasReduced = false
        resetParticlesToCalm()
        if (!host.ready && options.isActive()) void host.start()
        host.wakeUp()
      }

      if (!host.ready) {
        if (options.isActive()) void host.start()
        buildCalmTailPoints(currentSpool, worldPts, currentTarget)
        for (let i = 0; i < TAIL_PARTICLES; i++) smoothPts[i]!.copy(worldPts[i]!)
        lastSpool.copy(spoolPos)
        hadTarget = Boolean(stitchTarget)
        return smoothPts
      }

      const moved = spoolPos.distanceToSquared(lastSpool) > 1e-8
      if (moved || dragging || stitchTarget || hadTarget !== Boolean(stitchTarget)) {
        host.wakeUp()
      }
      if (hadTarget && !stitchTarget && rope && rope.isValid()) {
        // Released from the finished blossom: damp residual velocity gently so it drapes down smoothly.
        const vel = rope.particleVelocities()
        for (let i = 1; i < TAIL_PARTICLES; i++) {
          const idx = i * 3
          rope.setParticleVelocity(i, {
            x: vel[idx]! * .35,
            y: Math.min(0, vel[idx + 1]! * .35),
            z: vel[idx + 2]! * .35,
          })
        }
      }

      const stepped = host.step(dt, syncPinsAndColliders)
      if (stepped) {
        readBackFromRapier(false)
      } else if (moved) {
        // Even if frame dt < fixedDt, keep anchor ring locked cleanly to moving spool.
        const exit = _pt.copy(currentSpool).add(SPOOL_EXIT_LOCAL)
        smoothPts[0]!.copy(exit)
      }

      lastSpool.copy(spoolPos)
      hadTarget = Boolean(stitchTarget)
      return smoothPts
    },
    resetToCalm(spoolPos, stitchTarget = null) {
      currentSpool.copy(spoolPos)
      currentTarget = stitchTarget
      lastSpool.copy(spoolPos)
      hadTarget = Boolean(stitchTarget)
      resetParticlesToCalm()
      return smoothPts
    },
    wakeUp() {
      host.wakeUp()
    },
    dispose() {
      rope = null
      spoolCollider = null
      host.dispose()
    },
  }
}
