import * as THREE from 'three'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'

export const RING_CENTER = new THREE.Vector3(.3, 1.15, .31)
export const RING_RADIUS = .64
export const SOCKET_POS = new THREE.Vector3(.3, .51, .39)
export const CLASP_HOME_POS = new THREE.Vector3(.91, .54, .36)
export const SPOOL_POS = new THREE.Vector3(-.96, .199, .08)
export const SPOOL_EXIT = new THREE.Vector3(-.735, .42, .195)
export const WORKBOARD_TOP_Y = .17
export const SPOOL_PAD_TOP_Y = .1975
export const FEED_PARTICLES = 18
export const TAIL_PARTICLES = 20
export const FEED_RADIUS = .029
export const TAIL_RADIUS = .0285
export const BRACELET_OUTER_RADIUS = .037

export const arcPoint = (t: number) =>
  new THREE.Vector3(
    RING_CENTER.x + Math.sin(t * Math.PI * 2) * RING_RADIUS,
    RING_CENTER.y - Math.cos(t * Math.PI * 2) * RING_RADIUS,
    RING_CENTER.z,
  )

// Rigid obstacle bounds matching scene.ts geometry:
// - workboard top: y = 0.17, x in [-1.425, 1.425], z in [-0.66, 0.66]
// - spool pad top: y = 0.1975, x in [-1.34, -0.58], z in [-0.255, 0.415]
// - holder foot: x in [-0.115, 0.715], y in [0.17, 0.31], z in [-0.37, 0.34]
export function clampCordClearOfFixtures(p: THREE.Vector3, radius: number, clearance = .005): boolean {
  let clamped = false
  const overPad = p.x >= -1.35 && p.x <= -.57 && p.z >= -.26 && p.z <= .42
  const floorY = (overPad ? SPOOL_PAD_TOP_Y : WORKBOARD_TOP_Y) + radius + clearance
  if (p.y < floorY) {
    p.y = floorY
    clamped = true
  }
  const footMargin = radius + clearance
  const footMinX = -.115 - footMargin
  const footMaxX = .715 + footMargin
  const footMaxY = .31 + footMargin
  const footMinZ = -.37 - footMargin
  const footMaxZ = .34 + footMargin
  if (p.x > footMinX && p.x < footMaxX && p.y < footMaxY && p.z > footMinZ && p.z < footMaxZ) {
    // Push gracefully toward the nearer exterior face (+Z front or +Y top of holder foot).
    const dzFront = footMaxZ - p.z
    const dyTop = footMaxY - p.y
    if (dzFront <= dyTop * 1.15) {
      p.z = footMaxZ
    } else {
      p.y = footMaxY
    }
    clamped = true
  }
  return clamped
}

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
 * and a clean 2-ply twisted silk/cotton cord profile.
 * Preserves exact radial ring average at `u = 1` (symmetrical cos(2θ) averages to zero),
 * keeping `red-string-clasp-tail` terminal-ring attachment exact to < 1e-6.
 */
export function writePliedCordTube(
  geometry: THREE.TubeGeometry,
  controlPoints: readonly THREE.Vector3[],
  options: { turns?: number; plyDepth?: number; phase?: number; strandOffset?: number; taperEndsOffset?: boolean } = {},
): void {
  const { tubularSegments, radius, radialSegments } = geometry.parameters
  const turns = options.turns ?? 8
  const plyDepth = options.plyDepth ?? .082
  const phase = options.phase ?? 0
  const strandOffset = options.strandOffset ?? 0
  const taperEndsOffset = options.taperEndsOffset ?? true
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
    let cxOff = 0, cyOff = 0, czOff = 0
    if (strandOffset > 0) {
      const env = taperEndsOffset ? Math.sin(Math.min(1, u * 7) * Math.PI * .5) * Math.sin(Math.min(1, (1 - u) * 7) * Math.PI * .5) : 1
      const o = strandOffset * env
      const c = Math.cos(twistAngle), s = Math.sin(twistAngle)
      cxOff = (_norm.x * c + _binorm.x * s) * o
      cyOff = (_norm.y * c + _binorm.y * s) * o
      czOff = (_norm.z * c + _binorm.z * s) * o
    }

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2
      const r = radius * (1 + plyDepth * Math.cos(2 * (theta - twistAngle)))
      const cx = -Math.cos(theta)
      const sy = Math.sin(theta)
      const nx = _norm.x * cx + _binorm.x * sy
      const ny = _norm.y * cx + _binorm.y * sy
      const nz = _norm.z * cx + _binorm.z * sy
      posAttr.setXYZ(
        i * ringStride + j,
        _pt.x + cxOff + nx * r,
        _pt.y + cyOff + ny * r,
        _pt.z + czOff + nz * r,
      )
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
 * Builds one strand (`strandIndex` 0 or 1) of a 1/12th arc of the continuous 2-strand
 * twisted crimson bracelet in local coordinates relative to `arcPoint((arcIndex + 0.5) / totalArcs)`.
 * Uses analytical global circular frames and integer total turns so adjacent arcs share
 * bit-identical boundary rings and outward normals (zero segment seams!), and phase `+π/2`
 * places strand 0 proud in +Z at arc midpoints so `red-string-quiet-strand` is always first hit.
 */
export function createBraidedBraceletStrandGeometry(
  arcIndex: number,
  strandIndex: 0 | 1,
  totalArcs = 12,
  segPerArc = 22,
  radialSegments = 10,
  totalTurns = 24,
): THREE.BufferGeometry {
  const origin = arcPoint((arcIndex + .5) / totalArcs)
  const plyRadius = strandIndex === 0 ? .0235 : .0228
  const plyOffset = .0138 // outer envelope ≈ 0.0373 (matches original 0.037); overlap ≈ 0.0187 (zero gap!)
  const ringStride = radialSegments + 1
  const vertCount = (segPerArc + 1) * ringStride
  const positions = new Float32Array(vertCount * 3)
  const normals = new Float32Array(vertCount * 3)
  const uvs = new Float32Array(vertCount * 2)
  const indexCount = segPerArc * radialSegments * 6
  const indices = new Uint32Array(indexCount)
  const phase = strandIndex === 0 ? Math.PI * .5 : -Math.PI * .5

  for (let i = 0; i <= segPerArc; i++) {
    const u = (arcIndex + i / segPerArc) / totalArcs
    const ang = u * Math.PI * 2
    const sinA = Math.sin(ang)
    const cosA = Math.cos(ang)
    const cx = RING_CENTER.x + sinA * RING_RADIUS - origin.x
    const cy = RING_CENTER.y - cosA * RING_RADIUS - origin.y
    const cz = RING_CENTER.z - origin.z
    // Analytical circular frame: T=(cosA,sinA,0), N=(sinA,-cosA,0), B=(0,0,1).
    // Note T x N = -B and T x B = +N.
    const nx = sinA, ny = -cosA
    const twist = u * totalTurns * Math.PI * 2 + phase
    const cosT = Math.cos(twist), sinT = Math.sin(twist)
    const px = cx + nx * (plyOffset * cosT)
    const py = cy + ny * (plyOffset * cosT)
    const pz = cz + plyOffset * sinT

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2
      const c = Math.cos(theta), s = Math.sin(theta)
      const rx = nx * c
      const ry = ny * c
      const rz = s
      const vIdx = i * ringStride + j
      positions[vIdx * 3] = px + rx * plyRadius
      positions[vIdx * 3 + 1] = py + ry * plyRadius
      positions[vIdx * 3 + 2] = pz + rz * plyRadius
      normals[vIdx * 3] = rx
      normals[vIdx * 3 + 1] = ry
      normals[vIdx * 3 + 2] = rz
      uvs[vIdx * 2] = u * totalTurns
      uvs[vIdx * 2 + 1] = j / radialSegments
    }
  }

  let cursor = 0
  for (let i = 0; i < segPerArc; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j
      const b = a + ringStride
      const c = b + 1
      const d = a + 1
      // Outward CCW winding: (b - a) x (d - a) = T x (-N sinθ + B cosθ) = N cosθ + B sinθ = +R.
      indices[cursor++] = a
      indices[cursor++] = b
      indices[cursor++] = d
      indices[cursor++] = b
      indices[cursor++] = c
      indices[cursor++] = d
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.userData.indexCount = indexCount
  geometry.userData.segPerArc = segPerArc
  geometry.userData.radialSegments = radialSegments
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Smoothly reveals one strand of a bracelet arc along its tubular segments. */
export function setBraceletArcReveal(geometry: THREE.BufferGeometry, fraction: number): void {
  const f = THREE.MathUtils.clamp(fraction, 0, 1)
  const indexCount = (geometry.userData.indexCount as number) ?? 0
  const segPerArc = (geometry.userData.segPerArc as number) ?? 1
  const radialSegments = (geometry.userData.radialSegments as number) ?? 1
  if (indexCount <= 0) return
  const shownSegs = Math.round(f * segPerArc)
  const count = Math.min(indexCount, shownSegs * radialSegments * 6)
  geometry.setDrawRange(0, count)
}

/** Builds a continuous helical cross-wound crimson cord layer around the wooden spool barrel. */
export function createHelicalSpoolLayerGeometry(
  layerIndex: 0 | 1,
  turns = 15,
  tubularSegments = 220,
  radialSegments = 7,
): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = []
  const samples = turns * 10
  const baseR = layerIndex === 0 ? .236 : .246
  const yStart = .092
  const yEnd = .508
  for (let i = 0; i <= samples; i++) {
    const u = i / samples
    const dir = layerIndex === 0 ? u : 1 - u
    const a = u * turns * Math.PI * 2 + layerIndex * 1.7
    const r = baseR + Math.sin(dir * Math.PI) * .005
    pts.push(new THREE.Vector3(Math.cos(a) * r, THREE.MathUtils.lerp(yStart, yEnd, dir), Math.sin(a) * r))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, .0165, radialSegments, false)
  writePliedCordTube(geometry, pts, { turns: 32, plyDepth: .065, phase: layerIndex * 1.2, strandOffset: 0 })
  return geometry
}

function buildAnalyticalFeedPoints(windProgress: number, out: THREE.Vector3[]): void {
  const tension = THREE.MathUtils.clamp(windProgress, 0, 1)
  const entry = arcPoint(0)
  const waypoints = [
    SPOOL_EXIT.clone(),
    new THREE.Vector3(-.66, THREE.MathUtils.lerp(.255, .285, tension), .37),
    new THREE.Vector3(-.36, THREE.MathUtils.lerp(.206, .248, tension), .45),
    new THREE.Vector3(-.02, THREE.MathUtils.lerp(.265, .315, tension), .41),
    new THREE.Vector3(.18, THREE.MathUtils.lerp(.40, .43, tension), .35),
    entry,
  ]
  for (let i = 1; i < waypoints.length - 1; i++) {
    clampCordClearOfFixtures(waypoints[i]!, FEED_RADIUS, .006)
  }
  const curve = new THREE.CatmullRomCurve3(waypoints)
  for (let i = 0; i < FEED_PARTICLES; i++) {
    curve.getPointAt(i / (FEED_PARTICLES - 1), out[i]!)
    if (i > 0 && i < FEED_PARTICLES - 1) clampCordClearOfFixtures(out[i]!, FEED_RADIUS, .006)
  }
}

export function tailSocketExit(): THREE.Vector3 {
  return new THREE.Vector3(.37, .51, .355)
}

function buildAnalyticalTailPoints(claspPos: THREE.Vector3, out: THREE.Vector3[]): void {
  const start = tailSocketExit()
  const end = claspPos.clone()
  const dist = start.distanceTo(end)
  const slack = THREE.MathUtils.clamp((.70 - dist) / .52, 0, 1)
  const sag = .095 + slack * .065
  const forwardZ = Math.max(start.z, end.z) + .042 + slack * .025
  const mid1 = start.clone().lerp(end, .33)
  mid1.y -= sag * .95
  mid1.z = Math.max(mid1.z, forwardZ)
  const mid2 = start.clone().lerp(end, .68)
  mid2.y -= sag * .88
  mid2.z = Math.max(mid2.z, forwardZ - .01)
  const waypoints = [start, mid1, mid2, end]
  for (let i = 1; i < waypoints.length - 1; i++) {
    clampCordClearOfFixtures(waypoints[i]!, TAIL_RADIUS, .006)
  }
  const curve = new THREE.CatmullRomCurve3(waypoints)
  for (let i = 0; i < TAIL_PARTICLES; i++) {
    curve.getPointAt(i / (TAIL_PARTICLES - 1), out[i]!)
    if (i > 0 && i < TAIL_PARTICLES - 1) clampCordClearOfFixtures(out[i]!, TAIL_RADIUS, .006)
  }
}

export interface RedStringCordSimOptions {
  isActive: () => boolean
  isReducedMotion: () => boolean
}

export interface RedStringCordSim {
  readonly feedGroup: THREE.Group
  readonly feedMesh: THREE.Mesh<THREE.TubeGeometry>
  readonly tailGroup: THREE.Group
  readonly tailMesh: THREE.Mesh<THREE.TubeGeometry>
  readonly rapierReady: boolean
  readonly rapierSleeping: boolean
  /** Lazy Rapier start ONLY when active & non-reduced. Never called in constructor. */
  start(checkpoint: number, claspPos: THREE.Vector3): void
  /** Immediate deterministic snap (used on restore, drag cancel, reduced toggle). */
  snap(checkpoint: number, claspPos: THREE.Vector3, windProgress?: number): void
  /** Step Rapier soft-body simulation (or keep deterministic analytical pose in reduced motion). */
  update(
    dt: number,
    state: {
      checkpoint: number
      claspPos: THREE.Vector3
      windProgress: number
      windingActive: boolean
      claspMoving: boolean
    },
  ): void
  sampleFeedPoints(): readonly THREE.Vector3[]
  sampleTailPoints(): readonly THREE.Vector3[]
  dispose(): void
}

/**
 * Interactive Rapier soft-body cord controller for `hongsheng-red-string`.
 * - Active non-reduced mode uses `@wbr/scene-runtime/rapier-soft-body` with two pinned
 *   custom ropes (`feedBody` at p0, `tailBody` at p1) colliding against rigid box colliders
 *   for the workboard plinth, spool pad, and upright holder foot.
 * - Reduced motion never loads WASM and renders calm deterministic analytical catenaries.
 */
export function createRedStringCordSim(
  redMat: THREE.MeshStandardMaterial,
  redTwistMat: THREE.MeshStandardMaterial,
  options: RedStringCordSimOptions,
): RedStringCordSim {
  const feedPts = Array.from({ length: FEED_PARTICLES }, () => new THREE.Vector3())
  const feedSmooth = Array.from({ length: FEED_PARTICLES }, () => new THREE.Vector3())
  const tailPts = Array.from({ length: TAIL_PARTICLES }, () => new THREE.Vector3())
  const tailSmooth = Array.from({ length: TAIL_PARTICLES }, () => new THREE.Vector3())
  buildAnalyticalFeedPoints(0, feedPts)
  buildAnalyticalTailPoints(CLASP_HOME_POS, tailPts)

  // Feed cord: dual intertwined crimson strands sharing the same simulated spine.
  const feedGroup = new THREE.Group()
  feedGroup.name = 'red-string-feed-assembly'
  const feedGeoA = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(feedPts.map(p => p.clone())), 48, .0195, 8, false)
  const feedGeoB = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(feedPts.map(p => p.clone())), 48, .0195, 8, false)
  for (const g of [feedGeoA, feedGeoB]) {
    ;(g.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
    ;(g.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
  }
  const feedMesh = new THREE.Mesh(feedGeoA, redMat)
  feedMesh.name = 'red-string-feed'
  feedMesh.castShadow = feedMesh.receiveShadow = true
  const feedPlyB = new THREE.Mesh(feedGeoB, redTwistMat)
  feedPlyB.name = 'red-string-feed-ply'
  feedPlyB.castShadow = feedPlyB.receiveShadow = true
  feedGroup.add(feedMesh, feedPlyB)

  // Clasp tail: primary `red-string-clasp-tail` keeps radialSegments = 8 and exact terminal-ring
  // centering at `claspHead.position` (matching existing contract tests), paired with companion ply.
  const tailGroup = new THREE.Group()
  tailGroup.name = 'red-string-loose-tail'
  const tailGeoA = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts.map(p => p.clone())), 36, .0205, 8, false)
  const tailGeoB = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts.map(p => p.clone())), 36, .0195, 8, false)
  for (const g of [tailGeoA, tailGeoB]) {
    ;(g.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
    ;(g.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
  }
  const tailMesh = new THREE.Mesh(tailGeoA, redMat)
  tailMesh.name = 'red-string-clasp-tail'
  tailMesh.castShadow = tailMesh.receiveShadow = true
  const tailPlyB = new THREE.Mesh(tailGeoB, redTwistMat)
  tailPlyB.name = 'red-string-clasp-tail-ply'
  tailPlyB.castShadow = tailPlyB.receiveShadow = true
  tailGroup.add(tailMesh, tailPlyB)

  const writeFeedMeshes = (pts: readonly THREE.Vector3[]) => {
    writePliedCordTube(feedGeoA, pts, { turns: 11, plyDepth: .06, phase: 0, strandOffset: .0115, taperEndsOffset: true })
    writePliedCordTube(feedGeoB, pts, { turns: 11, plyDepth: .06, phase: Math.PI, strandOffset: .0115, taperEndsOffset: true })
  }
  const writeTailMeshes = (pts: readonly THREE.Vector3[]) => {
    // Primary mesh tapers strandOffset smoothly to 0 at u=1 so last-ring centroid == claspPos (< 1e-6).
    writePliedCordTube(tailGeoA, pts, { turns: 8, plyDepth: .06, phase: 0, strandOffset: .011, taperEndsOffset: true })
    writePliedCordTube(tailGeoB, pts, { turns: 8, plyDepth: .06, phase: Math.PI, strandOffset: .011, taperEndsOffset: true })
  }
  writeFeedMeshes(feedPts)
  writeTailMeshes(tailPts)

  let started = false
  let disposed = false
  let rapierReady = false
  let lastReduced = false
  let curCheckpoint = 0
  let curWindProgress = 0
  const curClaspPos = CLASP_HOME_POS.clone()
  let feedBody: ReturnType<RapierSoftBodySession['createCustomRope']> | null = null
  let tailBody: ReturnType<RapierSoftBodySession['createCustomRope']> | null = null
  const tmpPt = new THREE.Vector3()
  const tmpExit = tailSocketExit()
  const tmpEntry = arcPoint(0)

  function syncRopeParticles(
    body: ReturnType<RapierSoftBodySession['createCustomRope']> | null,
    pts: readonly THREE.Vector3[],
  ) {
    if (!body || !body.isValid()) return
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!
      body.setParticlePosition(i, { x: p.x, y: p.y, z: p.z })
      body.setParticleVelocity(i, { x: 0, y: 0, z: 0 })
    }
    body.setParticlePinned(0, true)
    body.setParticlePinned(pts.length - 1, true)
  }

  function readAndWriteRope(
    body: ReturnType<RapierSoftBodySession['createCustomRope']> | null,
    outPts: THREE.Vector3[],
    smoothPts: THREE.Vector3[],
    radius: number,
    writer: (pts: readonly THREE.Vector3[]) => void,
  ) {
    if (!body || !body.isValid()) return
    const raw = body.particlePositions()
    const n = outPts.length
    for (let i = 0; i < n; i++) {
      tmpPt.set(raw[i * 3]!, raw[i * 3 + 1]!, raw[i * 3 + 2]!)
      if (i > 0 && i < n - 1) {
        if (clampCordClearOfFixtures(tmpPt, radius, .005)) {
          body.setParticlePosition(i, { x: tmpPt.x, y: tmpPt.y, z: tmpPt.z })
          const v = body.particleVelocity(i)
          body.setParticleVelocity(i, { x: v.x * .55, y: Math.max(0, v.y * .10), z: v.z * .55 })
        }
      }
      outPts[i]!.copy(tmpPt)
    }
    smoothPts[0]!.copy(outPts[0]!)
    smoothPts[n - 1]!.copy(outPts[n - 1]!)
    for (let i = 1; i < n - 1; i++) {
      smoothPts[i]!.copy(outPts[i]!).multiplyScalar(.74)
        .addScaledVector(outPts[i - 1]!, .13)
        .addScaledVector(outPts[i + 1]!, .13)
      clampCordClearOfFixtures(smoothPts[i]!, radius, .005)
    }
    writer(smoothPts)
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 8,
    internalPgsIterations: 2,
    sleepSpeedThreshold: .01,
    sleepTimeRequired: .45,
    isActive: options.isActive,
    isReducedMotion: options.isReducedMotion,
    onReady(session) {
      if (disposed) return
      // Rigid colliders matching scene.ts workboard, spool pad, and holder foot.
      session.addFixedBox({ x: 0, y: .085, z: 0 }, { x: 2.85, y: .17, z: 1.32 }, { friction: .85, restitution: .02 })
      session.addFixedBox({ x: -.96, y: .185, z: .08 }, { x: .76, y: .025, z: .67 }, { friction: .85, restitution: .02 })
      session.addFixedBox({ x: .3, y: .24, z: -.015 }, { x: .83, y: .14, z: .71 }, { friction: .78, restitution: .02 })

      const feedInit = Array.from({ length: FEED_PARTICLES }, () => new THREE.Vector3())
      buildAnalyticalFeedPoints(curWindProgress, feedInit)
      feedBody = session.createCustomRope({
        points: feedInit.map(p => ({ x: p.x, y: p.y, z: p.z })),
        closed: false,
        bending: true,
        wireCollision: true,
        particleMass: .018,
        particleRadius: FEED_RADIUS,
        linearDamping: 3.6,
        gravityScale: 1.0,
        edgeSoftness: { naturalFrequency: 24, dampingRatio: .96 },
        bendSoftness: { naturalFrequency: 18, dampingRatio: .95 },
        pinnedParticles: [0, FEED_PARTICLES - 1],
        canSleep: true,
        friction: .85,
        restitution: .02,
        additionalSolverIterations: 6,
      })

      const tailInit = Array.from({ length: TAIL_PARTICLES }, () => new THREE.Vector3())
      buildAnalyticalTailPoints(curClaspPos, tailInit)
      tailBody = session.createCustomRope({
        points: tailInit.map(p => ({ x: p.x, y: p.y, z: p.z })),
        closed: false,
        bending: true,
        wireCollision: true,
        particleMass: .016,
        particleRadius: TAIL_RADIUS,
        linearDamping: 3.8,
        gravityScale: 1.0,
        edgeSoftness: { naturalFrequency: 24, dampingRatio: .96 },
        bendSoftness: { naturalFrequency: 19, dampingRatio: .95 },
        pinnedParticles: [0, TAIL_PARTICLES - 1],
        canSleep: true,
        friction: .84,
        restitution: .02,
        additionalSolverIterations: 6,
      })

      rapierReady = true
      host.settle(32, () => {
        if (feedBody && feedBody.isValid()) {
          feedBody.setParticlePosition(0, { x: SPOOL_EXIT.x, y: SPOOL_EXIT.y, z: SPOOL_EXIT.z })
          feedBody.setParticlePosition(FEED_PARTICLES - 1, { x: tmpEntry.x, y: tmpEntry.y, z: tmpEntry.z })
        }
        if (tailBody && tailBody.isValid()) {
          tailBody.setParticlePosition(0, { x: tmpExit.x, y: tmpExit.y, z: tmpExit.z })
          tailBody.setParticlePosition(TAIL_PARTICLES - 1, { x: curClaspPos.x, y: curClaspPos.y, z: curClaspPos.z })
        }
      })
      readAndWriteRope(feedBody, feedPts, feedSmooth, FEED_RADIUS, writeFeedMeshes)
      readAndWriteRope(tailBody, tailPts, tailSmooth, TAIL_RADIUS, writeTailMeshes)
    },
  })

  function ensureStartedIfEligible() {
    if (disposed || !started) return
    if (options.isActive() && !options.isReducedMotion() && !host.ready) {
      void host.start()
    }
  }

  function renderAnalytical(windProgress: number, claspPos: THREE.Vector3) {
    buildAnalyticalFeedPoints(windProgress, feedPts)
    writeFeedMeshes(feedPts)
    buildAnalyticalTailPoints(claspPos, tailPts)
    writeTailMeshes(tailPts)
  }

  return {
    feedGroup,
    feedMesh,
    tailGroup,
    tailMesh,
    get rapierReady() { return rapierReady },
    get rapierSleeping() { return host.sleeping },
    start(checkpoint, claspPos) {
      if (disposed) return
      started = true
      curCheckpoint = checkpoint
      curClaspPos.copy(claspPos)
      lastReduced = options.isReducedMotion()
      renderAnalytical(curWindProgress, curClaspPos)
      ensureStartedIfEligible()
    },
    snap(checkpoint, claspPos, windProgress = 0) {
      if (disposed) return
      curCheckpoint = checkpoint
      curWindProgress = windProgress
      curClaspPos.copy(claspPos)
      renderAnalytical(curWindProgress, curClaspPos)
      if (rapierReady) {
        syncRopeParticles(feedBody, feedPts)
        syncRopeParticles(tailBody, tailPts)
        host.wakeUp()
      }
    },
    update(dt, state) {
      if (disposed) return
      const reduced = options.isReducedMotion()
      const claspMoved = curClaspPos.distanceToSquared(state.claspPos) > 1e-8
      const windChanged = Math.abs(curWindProgress - state.windProgress) > 1e-5
      const cpChanged = curCheckpoint !== state.checkpoint
      curCheckpoint = state.checkpoint
      curWindProgress = state.windProgress
      curClaspPos.copy(state.claspPos)

      if (reduced) {
        if (!lastReduced || claspMoved || windChanged || cpChanged) {
          renderAnalytical(curWindProgress, curClaspPos)
        }
        lastReduced = true
        return
      }

      if (lastReduced) {
        lastReduced = false
        ensureStartedIfEligible()
        if (rapierReady) {
          syncRopeParticles(feedBody, feedPts)
          syncRopeParticles(tailBody, tailPts)
          host.wakeUp()
        }
      } else {
        ensureStartedIfEligible()
      }

      if (!rapierReady || !feedBody || !tailBody) {
        if (claspMoved || windChanged || cpChanged) {
          renderAnalytical(curWindProgress, curClaspPos)
        }
        return
      }

      if (claspMoved || windChanged || cpChanged || state.windingActive || state.claspMoving) {
        host.wakeUp()
      }

      const stepped = host.step(
        dt,
        () => {
          if (feedBody && feedBody.isValid()) {
            // Subtle spool payout motion at particle 0 while keeping feed grounded on the workboard.
            const payY = SPOOL_EXIT.y + (state.windingActive ? Math.sin(curWindProgress * Math.PI * 4) * .018 : 0)
            feedBody.setParticlePosition(0, { x: SPOOL_EXIT.x, y: payY, z: SPOOL_EXIT.z })
            feedBody.setParticlePosition(FEED_PARTICLES - 1, { x: tmpEntry.x, y: tmpEntry.y, z: tmpEntry.z })
            // Gentle draw tension (~15% of gravity, never levitating!) pulls the tabletop feed tauter.
            if (state.windingActive && curWindProgress > .01) {
              const tension = .026 * Math.sin(Math.min(1, curWindProgress) * Math.PI)
              for (let i = 3; i < FEED_PARTICLES - 2; i++) {
                const w = Math.sin((i / (FEED_PARTICLES - 1)) * Math.PI)
                feedBody.addParticleForce(i, { x: .018 * w, y: tension * w, z: -.012 * w }, false)
              }
            }
          }
          if (tailBody && tailBody.isValid()) {
            tailBody.setParticlePosition(0, { x: tmpExit.x, y: tmpExit.y, z: tmpExit.z })
            tailBody.setParticlePosition(TAIL_PARTICLES - 1, { x: curClaspPos.x, y: curClaspPos.y, z: curClaspPos.z })
            // Gentle forward bias keeps the hanging clasp loop naturally in front of the wooden holder foot.
            for (let i = 2; i < TAIL_PARTICLES - 2; i++) {
              const p = tailBody.particlePosition(i)
              if (p.z < .385) {
                tailBody.addParticleForce(i, { x: 0, y: 0, z: (.385 - p.z) * 1.4 }, false)
              }
            }
          }
        },
        () => {
          if (curCheckpoint === 0) {
            readAndWriteRope(feedBody, feedPts, feedSmooth, FEED_RADIUS, writeFeedMeshes)
          }
          if (curCheckpoint === 1) {
            readAndWriteRope(tailBody, tailPts, tailSmooth, TAIL_RADIUS, writeTailMeshes)
          }
        },
      )

      // Immediate zero-dt responsiveness during pointer drags (preserves exact terminal ring test).
      if (!stepped && claspMoved && curCheckpoint === 1) {
        buildAnalyticalTailPoints(curClaspPos, tailPts)
        writeTailMeshes(tailPts)
        syncRopeParticles(tailBody, tailPts)
      }
      if (!stepped && windChanged && curCheckpoint === 0) {
        buildAnalyticalFeedPoints(curWindProgress, feedPts)
        writeFeedMeshes(feedPts)
        syncRopeParticles(feedBody, feedPts)
      }
    },
    sampleFeedPoints() { return feedPts },
    sampleTailPoints() { return tailPts },
    dispose() {
      if (disposed) return
      disposed = true
      feedBody = null
      tailBody = null
      rapierReady = false
      host.dispose()
    },
  }
}
