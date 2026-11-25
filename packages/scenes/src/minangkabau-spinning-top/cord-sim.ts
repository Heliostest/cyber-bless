import * as THREE from 'three'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'

export const TOP_AXLE = new THREE.Vector3(-.42, .21, -.09)
export const BOARD_TOP_Y = .21
export const CORD_RADIUS = .021
export const CORD_PARTICLES = 25
export const COIL_TURNS = 6
export const COIL_BASE_Y = .858
export const COIL_PITCH = .0315
export const COIL_RADIUS = .102
export const UNWIND_RELEASE_T = .56

// Exact wooden spinning-top lathe profile from scene.ts ([radius, localY]).
const TOP_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [.025, 0], [.055, .035], [.13, .13], [.29, .27],
  [.45, .40], [.52, .53], [.53, .62], [.49, .71], [.38, .80],
  [.24, .845], [.12, .85], [0, .85],
]

/** Exact outer radius of the wooden spinning top at world Y (body + spindle + cap). */
export function topOuterRadiusAtWorldY(worldY: number, includeCoils = false): number {
  const dy = worldY - TOP_AXLE.y
  if (dy <= 0) return .03
  if (dy <= .85) {
    for (let i = 1; i < TOP_PROFILE.length; i++) {
      const [r0, y0] = TOP_PROFILE[i - 1]!
      const [r1, y1] = TOP_PROFILE[i]!
      if (dy <= y1) {
        const span = Math.max(y1 - y0, 1e-6)
        return THREE.MathUtils.lerp(r0, r1, (dy - y0) / span)
      }
    }
    return .12
  }
  if (dy <= 1.055) return includeCoils ? .123 : .092
  if (dy <= 1.245) {
    const t = THREE.MathUtils.clamp((dy - 1.14) / .095, -1, 1)
    return .17 * Math.sqrt(Math.max(0, 1 - t * t))
  }
  return 0
}

/** Projects a cord centerline point clear of the wooden top lathe profile and wooden tabletop. */
export function clampPointClearOfTopAndBoard(
  p: THREE.Vector3,
  options: {
    includeCoils?: boolean
    clampToBoard?: boolean
    clearance?: number
    beadCenter?: THREE.Vector3
  } = {},
): boolean {
  let clamped = false
  const clearance = options.clearance ?? .007
  const minY = BOARD_TOP_Y + CORD_RADIUS
  const overBoard = Math.abs(p.x) <= 1.44 && Math.abs(p.z) <= .80
  if (overBoard && p.y < minY) {
    p.y = minY
    clamped = true
  }
  const dy = p.y - TOP_AXLE.y
  if (dy > -.02 && dy < 1.26) {
    const bodyR = topOuterRadiusAtWorldY(p.y, options.includeCoils ?? false)
    if (bodyR > 0) {
      const minR = bodyR + CORD_RADIUS + clearance
      const dx = p.x - TOP_AXLE.x
      const dz = p.z - TOP_AXLE.z
      const dist = Math.hypot(dx, dz)
      if (dist < minR) {
        const nx = dist > 1e-5 ? dx / dist : .76
        const nz = dist > 1e-5 ? dz / dist : .65
        // Near the upper shoulder bevel (dy in [0.76, 0.88]), lift gently up and out
        // so the cord rides cleanly over the shoulder rather than snapping sideways.
        if (dy >= .75 && dy <= .88) {
          p.y = Math.max(p.y, TOP_AXLE.y + .85 + CORD_RADIUS + clearance - Math.max(0, dist - .12) * .22)
        }
        const refreshedR = topOuterRadiusAtWorldY(p.y, options.includeCoils ?? false) + CORD_RADIUS + clearance
        if (dist < refreshedR) {
          p.x = TOP_AXLE.x + nx * refreshedR
          p.z = TOP_AXLE.z + nz * refreshedR
        }
        clamped = true
      }
    }
  }
  if (options.beadCenter) {
    const bc = options.beadCenter
    const dx = p.x - bc.x
    const dyb = p.y - bc.y
    const dz = p.z - bc.z
    const dist = Math.hypot(dx, dyb, dz)
    const minBeadR = .13 + CORD_RADIUS + .006
    if (dist < minBeadR) {
      const inv = dist > 1e-5 ? 1 / dist : 1
      const nx = dist > 1e-5 ? dx * inv : -1
      const ny = dist > 1e-5 ? dyb * inv : 0
      const nz = dist > 1e-5 ? dz * inv : 0
      p.x = bc.x + nx * minBeadR
      p.y = Math.max(minY, bc.y + ny * minBeadR)
      p.z = bc.z + nz * minBeadR
      clamped = true
    }
  }
  if (options.clampToBoard) {
    const cx = THREE.MathUtils.clamp(p.x, -1.36, 1.36)
    const cz = THREE.MathUtils.clamp(p.z, -.73, .73)
    if (cx !== p.x || cz !== p.z) {
      p.x = cx
      p.z = cz
      clamped = true
    }
  }
  return clamped
}

const _pt = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _prevTan = new THREE.Vector3()
const _norm = new THREE.Vector3()
const _binorm = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _refY = new THREE.Vector3(0, 1, 0)
const _refZ = new THREE.Vector3(0, 0, 1)
const _seamN = new THREE.Vector3()

/**
 * Rewrites a pre-allocated TubeGeometry in-place using Bishop parallel-transport frames
 * and a subtle 2-ply twisted cotton cord profile (preserving exact `radius`).
 */
export function writeCottonCordTube(
  geometry: THREE.TubeGeometry,
  controlPoints: readonly THREE.Vector3[],
  options: { turns?: number; plyDepth?: number; taperStart?: boolean } = {},
): void {
  const { tubularSegments, radius, radialSegments } = geometry.parameters
  const turns = options.turns ?? 10
  const plyDepth = options.plyDepth ?? .115
  const taperStart = options.taperStart ?? false
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
  const ref = Math.abs(_prevTan.dot(_refY)) < .92 ? _refY : _refZ
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

    const twistAngle = u * turns * Math.PI * 2
    // Softly tapered/whipped free inner tip when unwound so there is no flat pipe cut.
    let endScale = 1
    if (taperStart && i === 0) endScale = .35
    else if (taperStart && i === 1) endScale = .82

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2
      const r = radius * (1 + plyDepth * Math.cos(2 * (theta - twistAngle))) * endScale
      const cx = -Math.cos(theta)
      const sy = Math.sin(theta)
      const nx = _norm.x * cx + _binorm.x * sy
      const ny = _norm.y * cx + _binorm.y * sy
      const nz = _norm.z * cx + _binorm.z * sy
      const idx = i * ringStride + j
      posAttr.setXYZ(idx, _pt.x + nx * r, _pt.y + ny * r, _pt.z + nz * r)
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

/** Builds a single 360° helical cotton turn (`turnIndex` in 0..5) around the spindle. */
export function createHelicalCoilGeometry(turnIndex: number, tubularSegments = 52, radialSegments = 10): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = []
  const y0 = COIL_BASE_Y + turnIndex * COIL_PITCH
  // Place the turn join on the rear side of the spindle (away from camera) with a tiny overlap
  // so the front-facing helical cotton stack reads as one seamless continuous winding.
  const startAngle = -Math.PI * .78
  const overlap = .06
  const samples = 28
  for (let s = 0; s <= samples; s++) {
    const u = s / samples
    const a = startAngle + u * (Math.PI * 2 + overlap)
    pts.push(new THREE.Vector3(Math.cos(a) * COIL_RADIUS, y0 + u * COIL_PITCH, Math.sin(a) * COIL_RADIUS))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, .0208, radialSegments, false)
  writeCottonCordTube(geometry, pts, { turns: 5.0, plyDepth: .105 })
  return geometry
}

export type CordMode = 'wound' | 'unwinding' | 'released'

export interface TopCordSimOptions {
  isActive: () => boolean
  isReducedMotion: () => boolean
}

export interface TopCordSim {
  readonly mesh: THREE.Mesh<THREE.TubeGeometry>
  readonly coilsGroup: THREE.Group
  readonly beadKnot: THREE.Mesh
  readonly rapierReady: boolean
  readonly rapierSleeping: boolean
  /** Start lazy Rapier loading ONLY when active & non-reduced. */
  start(mode: CordMode, beadPos: THREE.Vector3): void
  /** Synchronize pose & step simulation (or deterministic analytical pose in reduced motion). */
  update(
    dt: number,
    state: {
      mode: CordMode
      beadPos: THREE.Vector3
      unwindProgress: number
      rotorAngleY: number
    },
  ): void
  /** Snap immediately to deterministic analytical pose (used on restore, cancel, reduced toggle). */
  snap(mode: CordMode, beadPos: THREE.Vector3, unwindProgress?: number): void
  /** Current centerline sample points (read-only view for tests). */
  samplePoints(): readonly THREE.Vector3[]
  dispose(): void
}

function beadAttachPoint(beadPos: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  // Attach neatly on the left side of the 0.13-radius walnut pull bead, never occluding bead center.
  return out.set(beadPos.x - .118, beadPos.y - .010, beadPos.z)
}

/** Computes the live tangent exit point off the unwinding coil / shoulder in world space. */
function coilExitPoint(unwindProgress: number, out: THREE.Vector3): THREE.Vector3 {
  const u = THREE.MathUtils.clamp(unwindProgress, 0, 1)
  const remaining = Math.max(0, COIL_TURNS * (1 - u))
  const exitLocalY = COIL_BASE_Y + Math.max(0, Math.min(COIL_TURNS - .25, remaining)) * COIL_PITCH * .18
  // Keep exit anchored on the spindle coil while turns remain, gliding gently out onto the
  // inner shoulder only during the final peel so the taut cord never bunches into slack kinks.
  const slip = THREE.MathUtils.smoothstep(u, .62, 1)
  const angle = .72
  const baseX = TOP_AXLE.x + Math.cos(angle) * (COIL_RADIUS + .004)
  const baseY = TOP_AXLE.y + exitLocalY
  const baseZ = TOP_AXLE.z + Math.sin(angle) * (COIL_RADIUS + .004)
  return out.set(
    THREE.MathUtils.lerp(baseX, -.16, slip),
    THREE.MathUtils.lerp(baseY, TOP_AXLE.y + .84, slip),
    THREE.MathUtils.lerp(baseZ, .14, slip),
  )
}

/** Builds a clean shoulder-clearing analytical curve from the spindle coil to the pull bead. */
function buildWoundAnalyticalCurve(
  beadPos: THREE.Vector3,
  unwindProgress: number,
  out: THREE.Vector3[],
): void {
  const exit = coilExitPoint(unwindProgress, new THREE.Vector3())
  const attach = beadAttachPoint(beadPos, new THREE.Vector3())
  const dx = attach.x - TOP_AXLE.x
  const dz = attach.z - TOP_AXLE.z
  const distXZ = Math.max(Math.hypot(dx, dz), .2)
  const ux = dx / distXZ
  const uz = dz / distXZ
  const tension = THREE.MathUtils.clamp((distXZ - .86) / .70, 0, 1)

  // Key waypoints gliding cleanly over the wooden top's upper shoulder and outer waist.
  const pShoulderTop = new THREE.Vector3(
    TOP_AXLE.x + ux * .33,
    TOP_AXLE.y + .865,
    TOP_AXLE.z + uz * .33,
  )
  const pShoulderRim = new THREE.Vector3(
    TOP_AXLE.x + ux * .572,
    TOP_AXLE.y + .695,
    TOP_AXLE.z + uz * .572,
  )
  const pMidDrop = new THREE.Vector3(
    THREE.MathUtils.lerp(pShoulderRim.x, attach.x, .42),
    THREE.MathUtils.lerp(.46, .54, tension),
    THREE.MathUtils.lerp(pShoulderRim.z, attach.z, .45) + (1 - tension) * .045,
  )
  const pBoardDip = new THREE.Vector3(
    THREE.MathUtils.lerp(pShoulderRim.x, attach.x, .74),
    THREE.MathUtils.lerp(BOARD_TOP_Y + CORD_RADIUS + .018, .36, tension),
    THREE.MathUtils.lerp(pShoulderRim.z, attach.z, .80) + (1 - tension) * .05,
  )
  const pPreBead = new THREE.Vector3(
    attach.x - .11,
    THREE.MathUtils.lerp(BOARD_TOP_Y + CORD_RADIUS + .035, attach.y - .015, tension),
    attach.z + (1 - tension) * .018,
  )

  const waypoints = [exit, pShoulderTop, pShoulderRim, pMidDrop, pBoardDip, pPreBead, attach]
  for (const w of waypoints) clampPointClearOfTopAndBoard(w, { includeCoils: false, clearance: .010 })
  const curve = new THREE.CatmullRomCurve3(waypoints)
  for (let i = 0; i < CORD_PARTICLES; i++) {
    curve.getPointAt(i / (CORD_PARTICLES - 1), out[i]!)
    if (i > 0 && i < CORD_PARTICLES - 1) {
      clampPointClearOfTopAndBoard(out[i]!, { includeCoils: false, clearance: .009 })
    }
  }
}

/** Builds a calm, natural coiled cotton cord resting on the wooden board beside the top. */
function buildSettledAnalyticalCurve(beadPos: THREE.Vector3, out: THREE.Vector3[]): void {
  const attach = beadAttachPoint(beadPos, new THREE.Vector3())
  const y = BOARD_TOP_Y + CORD_RADIUS
  const waypoints = [
    new THREE.Vector3(-.10, y, .42),
    new THREE.Vector3(.08, y, .62),
    new THREE.Vector3(.30, y, .64),
    new THREE.Vector3(.50, y, .43),
    new THREE.Vector3(.70, y, .40),
    new THREE.Vector3(attach.x - .14, y + .012, attach.z - .02),
    attach,
  ]
  const curve = new THREE.CatmullRomCurve3(waypoints)
  for (let i = 0; i < CORD_PARTICLES; i++) {
    curve.getPointAt(i / (CORD_PARTICLES - 1), out[i]!)
    if (i < CORD_PARTICLES - 2) out[i]!.y = Math.max(y, out[i]!.y)
    clampPointClearOfTopAndBoard(out[i]!, { clampToBoard: true, clearance: .012 })
  }
}

/**
 * Interactive cotton cord & helical spindle winding controller for `minangkabau-spinning-top`.
 * - Active non-reduced mode uses `@wbr/scene-runtime/rapier-soft-body` (25-particle custom rope)
 *   for genuine shoulder-drape tension during pull and unpinned whip/recoil/board-settle after release.
 * - Reduced motion never loads WASM and renders calm deterministic shoulder-clearing / board-resting curves.
 */
export function createTopCordSim(
  cottonMaterial: THREE.MeshStandardMaterial,
  options: TopCordSimOptions,
): TopCordSim {
  // Continuous 6-turn helical cotton coil stack around the spindle.
  const coilsGroup = new THREE.Group()
  coilsGroup.name = 'top-wound-cotton'
  coilsGroup.position.copy(TOP_AXLE)
  const coilMeshes: THREE.Mesh<THREE.TubeGeometry>[] = []
  const coilFullCounts: number[] = []
  for (let i = 0; i < COIL_TURNS; i++) {
    const geo = createHelicalCoilGeometry(i)
    const count = geo.index ? geo.index.count : geo.getAttribute('position').count
    coilFullCounts.push(count)
    const mesh = new THREE.Mesh(geo, cottonMaterial)
    mesh.name = `top-cotton-coil-${i}`
    mesh.userData.toonSurface = { outline: false }
    mesh.castShadow = mesh.receiveShadow = true
    coilsGroup.add(mesh)
    coilMeshes.push(mesh)
  }

  // Tied cotton collar where the cord anchors into the wooden pull bead.
  const beadKnot = new THREE.Mesh(new THREE.TorusGeometry(.024, .011, 8, 20), cottonMaterial)
  beadKnot.name = 'top-bead-knot'
  beadKnot.rotation.y = Math.PI / 2
  beadKnot.position.set(-.124, -.008, 0)
  beadKnot.castShadow = beadKnot.receiveShadow = true

  const activePts = Array.from({ length: CORD_PARTICLES }, () => new THREE.Vector3())
  const analyticalPts = Array.from({ length: CORD_PARTICLES }, () => new THREE.Vector3())
  const initBead = new THREE.Vector3(.38, .34, .52)
  buildWoundAnalyticalCurve(initBead, 0, activePts)

  const initialCurve = new THREE.CatmullRomCurve3(activePts.map(p => p.clone()))
  const cordGeo = new THREE.TubeGeometry(initialCurve, 84, CORD_RADIUS, 10, false)
  ;(cordGeo.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
  ;(cordGeo.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
  writeCottonCordTube(cordGeo, activePts, { turns: 13, plyDepth: .102, taperStart: false })

  const mesh = new THREE.Mesh(cordGeo, cottonMaterial)
  mesh.name = 'top-loose-cord'
  mesh.castShadow = mesh.receiveShadow = true

  let started = false
  let disposed = false
  let curMode: CordMode = 'wound'
  let curUnwind = 0
  let curBeadPos = initBead.clone()
  let lastReduced = false
  let rapierReady = false
  let innerPinned = true
  let ropeBody: ReturnType<RapierSoftBodySession['createCustomRope']> | null = null

  const tmpExit = new THREE.Vector3()
  const tmpAttach = new THREE.Vector3()
  const tmpPt = new THREE.Vector3()
  const tmpPrev = new THREE.Vector3()
  const smoothPts = Array.from({ length: CORD_PARTICLES }, () => new THREE.Vector3())

  function updateCoilsDisplay(mode: CordMode, unwind: number, rotorAngleY: number) {
    if (mode === 'released') {
      coilsGroup.visible = false
      return
    }
    coilsGroup.visible = true
    const remaining = mode === 'wound' ? COIL_TURNS : COIL_TURNS * (1 - THREE.MathUtils.clamp(unwind, 0, 1))
    // Keep coil turns rotating smoothly with the unwinding spindle while active.
    coilsGroup.rotation.y = mode === 'unwinding' ? rotorAngleY * .55 : 0
    for (let i = 0; i < COIL_TURNS; i++) {
      const m = coilMeshes[i]!
      const fullCount = coilFullCounts[i]!
      const frac = THREE.MathUtils.clamp(remaining - i, 0, 1)
      if (frac <= .02) {
        m.visible = false
      } else {
        m.visible = true
        // Round drawRange to multiples of 3 (whole triangles).
        const triCount = Math.floor((fullCount * frac) / 3) * 3
        m.geometry.setDrawRange(0, Math.max(3, Math.min(fullCount, triCount)))
      }
    }
  }

  function writeParticlesToRope(pts: readonly THREE.Vector3[], pinInner: boolean) {
    if (!ropeBody || !ropeBody.isValid()) return
    for (let i = 0; i < CORD_PARTICLES; i++) {
      const p = pts[i]!
      ropeBody.setParticlePosition(i, { x: p.x, y: p.y, z: p.z })
      ropeBody.setParticleVelocity(i, { x: 0, y: 0, z: 0 })
    }
    ropeBody.setParticlePinned(0, pinInner)
    ropeBody.setParticlePinned(CORD_PARTICLES - 1, true)
    innerPinned = pinInner
  }

  function applyClearanceAndRead(clampToBoard: boolean) {
    if (!ropeBody || !ropeBody.isValid()) return
    const raw = ropeBody.particlePositions()
    for (let i = 0; i < CORD_PARTICLES; i++) {
      tmpPt.set(raw[i * 3]!, raw[i * 3 + 1]!, raw[i * 3 + 2]!)
      if (i < CORD_PARTICLES - 1 && !(i === 0 && innerPinned)) {
        const clamped = clampPointClearOfTopAndBoard(tmpPt, {
          includeCoils: false,
          clampToBoard,
          clearance: .008,
          beadCenter: i < CORD_PARTICLES - 2 ? curBeadPos : undefined,
        })
        if (clamped) {
          ropeBody.setParticlePosition(i, { x: tmpPt.x, y: tmpPt.y, z: tmpPt.z })
          // Cotton tabletop friction: dampen sliding/bounce strongly on board contact so
          // the released cord settles smoothly where it lands instead of bunching up.
          const v = ropeBody.particleVelocity(i)
          const onBoard = tmpPt.y <= BOARD_TOP_Y + CORD_RADIUS + .004
          const dampXZ = onBoard ? .45 : .82
          ropeBody.setParticleVelocity(i, { x: v.x * dampXZ, y: Math.max(0, v.y * .06), z: v.z * dampXZ })
        }
      }
      activePts[i]!.copy(tmpPt)
    }

    // Light Laplacian display smoothing (interior only) to prevent sharp facet kinks on curves.
    smoothPts[0]!.copy(activePts[0]!)
    smoothPts[CORD_PARTICLES - 1]!.copy(activePts[CORD_PARTICLES - 1]!)
    for (let i = 1; i < CORD_PARTICLES - 1; i++) {
      smoothPts[i]!.copy(activePts[i]!).multiplyScalar(.72)
        .addScaledVector(activePts[i - 1]!, .14)
        .addScaledVector(activePts[i + 1]!, .14)
      clampPointClearOfTopAndBoard(smoothPts[i]!, {
        clampToBoard,
        clearance: .007,
        beadCenter: i < CORD_PARTICLES - 2 ? curBeadPos : undefined,
      })
    }
    writeCottonCordTube(cordGeo, smoothPts, {
      turns: 13,
      plyDepth: .102,
      taperStart: !innerPinned,
    })
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 8,
    internalPgsIterations: 2,
    sleepSpeedThreshold: .012,
    sleepTimeRequired: .55,
    isActive: options.isActive,
    isReducedMotion: options.isReducedMotion,
    onReady(session) {
      if (disposed) return
      // Rigid colliders: wooden tabletop + spinning-top body waist + spindle.
      session.addFixedBox(
        { x: 0, y: .14, z: 0 },
        { x: 2.9, y: .14, z: 1.62 },
        { friction: .88, restitution: .03 },
      )
      session.addFixedCylinder(
        { x: TOP_AXLE.x, y: TOP_AXLE.y + .58, z: TOP_AXLE.z },
        .538,
        .28,
        { friction: .32, restitution: .04 },
      )
      session.addFixedCylinder(
        { x: TOP_AXLE.x, y: TOP_AXLE.y + .95, z: TOP_AXLE.z },
        .115,
        .30,
        { friction: .32, restitution: .04 },
      )

      // Build uniform-length rest rope (~1.38 units total -> matches the physical unwound
      // shoulder-to-bead span at release so cotton twine drops under gravity without
      // elastic slingshot recoil and lays out cleanly across the wooden board).
      const restPts: { x: number; y: number; z: number }[] = []
      const restLen = 1.38
      for (let i = 0; i < CORD_PARTICLES; i++) {
        const u = i / (CORD_PARTICLES - 1)
        restPts.push({ x: u * restLen, y: .6, z: .4 })
      }
      ropeBody = session.createCustomRope({
        points: restPts,
        closed: false,
        bending: true,
        wireCollision: true,
        particleMass: .018,
        particleRadius: CORD_RADIUS,
        linearDamping: 3.4,
        gravityScale: 1.0,
        edgeSoftness: { naturalFrequency: 24, dampingRatio: .98 },
        bendSoftness: { naturalFrequency: 20, dampingRatio: .96 },
        pinnedParticles: [0, CORD_PARTICLES - 1],
        canSleep: true,
        friction: .92,
        restitution: .02,
        additionalSolverIterations: 6,
      })

      rapierReady = true
      const isReleased = curMode === 'released'
      if (isReleased) {
        buildSettledAnalyticalCurve(curBeadPos, analyticalPts)
        writeParticlesToRope(analyticalPts, false)
        host.settle(32, () => {
          if (!ropeBody || !ropeBody.isValid()) return
          beadAttachPoint(curBeadPos, tmpAttach)
          ropeBody.setParticlePosition(CORD_PARTICLES - 1, { x: tmpAttach.x, y: tmpAttach.y, z: tmpAttach.z })
        })
      } else {
        buildWoundAnalyticalCurve(curBeadPos, curUnwind, analyticalPts)
        writeParticlesToRope(analyticalPts, true)
        host.settle(36, () => {
          if (!ropeBody || !ropeBody.isValid()) return
          coilExitPoint(curUnwind, tmpExit)
          beadAttachPoint(curBeadPos, tmpAttach)
          ropeBody.setParticlePosition(0, { x: tmpExit.x, y: tmpExit.y, z: tmpExit.z })
          ropeBody.setParticlePosition(CORD_PARTICLES - 1, { x: tmpAttach.x, y: tmpAttach.y, z: tmpAttach.z })
        })
      }
      applyClearanceAndRead(isReleased)
    },
  })

  function ensureStartedIfEligible() {
    if (disposed || !started) return
    if (options.isActive() && !options.isReducedMotion() && !host.ready) {
      void host.start()
    }
  }

  function renderAnalytical(mode: CordMode, beadPos: THREE.Vector3, unwind: number) {
    if (mode === 'released') {
      buildSettledAnalyticalCurve(beadPos, analyticalPts)
      for (let i = 0; i < CORD_PARTICLES; i++) activePts[i]!.copy(analyticalPts[i]!)
      writeCottonCordTube(cordGeo, activePts, { turns: 13, plyDepth: .102, taperStart: true })
    } else {
      buildWoundAnalyticalCurve(beadPos, unwind, analyticalPts)
      for (let i = 0; i < CORD_PARTICLES; i++) activePts[i]!.copy(analyticalPts[i]!)
      writeCottonCordTube(cordGeo, activePts, { turns: 13, plyDepth: .102, taperStart: false })
    }
  }

  function triggerWhipRelease() {
    if (!ropeBody || !ropeBody.isValid()) return
    ropeBody.setParticlePinned(0, false)
    innerPinned = false
    // With restLen matched to the release span (zero elastic slingshot), give the free
    // cotton tail a calm outward-forward spin-off flick so it arcs cleanly off the wooden
    // shoulder and settles laid out across the center-right tabletop.
    for (let i = 0; i < CORD_PARTICLES - 1; i++) {
      const u = i / (CORD_PARTICLES - 1)
      const tailWeight = 1 - u
      const vx = -.28 * tailWeight * tailWeight
      const vy = .24 * tailWeight - .38 * (1 - tailWeight) * tailWeight
      const vz = .58 * tailWeight
      ropeBody.setParticleVelocity(i, { x: vx, y: vy, z: vz })
    }
    host.wakeUp()
  }

  return {
    mesh,
    coilsGroup,
    beadKnot,
    get rapierReady() { return rapierReady },
    get rapierSleeping() { return host.sleeping },
    start(mode, beadPos) {
      if (disposed) return
      started = true
      curMode = mode
      curBeadPos.copy(beadPos)
      curUnwind = mode === 'released' ? 1 : 0
      lastReduced = options.isReducedMotion()
      updateCoilsDisplay(mode, curUnwind, 0)
      renderAnalytical(mode, beadPos, curUnwind)
      ensureStartedIfEligible()
    },
    snap(mode, beadPos, unwind = mode === 'released' ? 1 : 0) {
      if (disposed) return
      curMode = mode
      curBeadPos.copy(beadPos)
      curUnwind = unwind
      updateCoilsDisplay(mode, unwind, 0)
      renderAnalytical(mode, beadPos, unwind)
      if (rapierReady && ropeBody && ropeBody.isValid()) {
        writeParticlesToRope(activePts, mode !== 'released')
        host.wakeUp()
      }
    },
    update(dt, state) {
      if (disposed) return
      const reduced = options.isReducedMotion()
      const prevMode = curMode
      const beadMoved = curBeadPos.distanceToSquared(state.beadPos) > 1e-8
      curMode = state.mode
      curUnwind = state.unwindProgress
      curBeadPos.copy(state.beadPos)
      updateCoilsDisplay(curMode, curUnwind, state.rotorAngleY)

      if (reduced) {
        if (!lastReduced || prevMode !== curMode || beadMoved) {
          renderAnalytical(curMode, curBeadPos, curUnwind)
        }
        lastReduced = true
        return
      }

      if (lastReduced) {
        // Transitioned runtime reduced -> normal: lazily load or re-sync Rapier.
        lastReduced = false
        ensureStartedIfEligible()
        if (rapierReady && ropeBody && ropeBody.isValid()) {
          writeParticlesToRope(activePts, curMode !== 'released')
          host.wakeUp()
        }
      } else {
        ensureStartedIfEligible()
      }

      if (!rapierReady || !ropeBody || !ropeBody.isValid()) {
        renderAnalytical(curMode, curBeadPos, curUnwind)
        return
      }

      // Handle mode transitions cleanly.
      if (prevMode !== 'released' && curMode === 'released') {
        triggerWhipRelease()
      } else if (prevMode === 'released' && curMode !== 'released') {
        buildWoundAnalyticalCurve(curBeadPos, curUnwind, analyticalPts)
        writeParticlesToRope(analyticalPts, true)
        host.wakeUp()
      } else if (beadMoved || curMode === 'unwinding') {
        host.wakeUp()
      }

      const clampToBoard = curMode === 'released'
      const stepped = host.step(
        dt,
        () => {
          if (!ropeBody || !ropeBody.isValid()) return
          beadAttachPoint(curBeadPos, tmpAttach)
          ropeBody.setParticlePosition(CORD_PARTICLES - 1, { x: tmpAttach.x, y: tmpAttach.y, z: tmpAttach.z })
          if (innerPinned) {
            coilExitPoint(curUnwind, tmpExit)
            ropeBody.setParticlePosition(0, { x: tmpExit.x, y: tmpExit.y, z: tmpExit.z })
          }
          // Gentle drag-out / shoulder guide during active unwinding so the taut cord
          // never catches on the back side of the spindle while peeling rapidly.
          if (curMode === 'unwinding' && innerPinned) {
            tmpPrev.copy(tmpExit).lerp(tmpAttach, .28)
            clampPointClearOfTopAndBoard(tmpPrev, { includeCoils: false, clearance: .015 })
            for (let i = 1; i <= 5; i++) {
              const p = ropeBody.particlePosition(i)
              const t = i / 6
              const gx = THREE.MathUtils.lerp(tmpExit.x, tmpPrev.x, t)
              const gy = THREE.MathUtils.lerp(tmpExit.y, tmpPrev.y, t)
              const gz = THREE.MathUtils.lerp(tmpExit.z, tmpPrev.z, t)
              ropeBody.addParticleForce(i, { x: (gx - p.x) * 2.2, y: (gy - p.y) * 2.2, z: (gz - p.z) * 2.2 }, false)
            }
          }
        },
        () => {
          applyClearanceAndRead(clampToBoard)
        },
      )

      if (!stepped && beadMoved) {
        // Keep geometry immediately responsive even on zero-dt / sub-fixedDt drag frames.
        if (!innerPinned) {
          beadAttachPoint(curBeadPos, tmpAttach)
          activePts[CORD_PARTICLES - 1]!.copy(tmpAttach)
          writeCottonCordTube(cordGeo, activePts, { turns: 13, plyDepth: .102, taperStart: true })
        } else {
          renderAnalytical(curMode, curBeadPos, curUnwind)
          writeParticlesToRope(activePts, true)
        }
      }
    },
    samplePoints() {
      return activePts
    },
    dispose() {
      if (disposed) return
      disposed = true
      ropeBody = null
      rapierReady = false
      host.dispose()
    },
  }
}
