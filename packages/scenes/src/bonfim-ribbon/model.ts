import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'
import * as THREE from 'three'

const centers = [1.55, 1.10, .65], start = .27, end = 2 * Math.PI - .27
const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const SIM_PARTICLES = 48

export interface BonfimModelOptions {
  isActive?: () => boolean
  isReducedMotion?: () => boolean
}

function path(levels: number[]) {
  const points: THREE.Vector3[] = [], ranges: number[][] = []
  const add = (v: THREE.Vector3) => { if (!points.length || points.at(-1)!.distanceToSquared(v) > 1e-14) points.push(v) }
  const line = (a: THREE.Vector3, b: THREE.Vector3, n = 24) => { for (let i = 0; i <= n; i++) add(a.clone().lerp(b, i / n)) }
  const bezier = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, n = 32) => {
    const curve = new THREE.CubicBezierCurve3(a, b, c, d)
    for (let i = 0; i <= n; i++) add(curve.getPoint(i / n))
  }
  line(point(.5, .18, .8), point(.5, 2, .8))
  const arcStart = point(.15 * Math.cos(.75 * Math.PI), 2.05, .15 * Math.sin(.75 * Math.PI))
  const arcTangent = (a: number) => point(-Math.sin(a), 0, Math.cos(a))
  bezier(points.at(-1)!, point(.5, 2.3, .8), arcStart.clone().addScaledVector(arcTangent(.75 * Math.PI), -.16), arcStart)
  const wrapBegin = points.length - 1
  for (let i = 1; i <= 64; i++) {
    const a = (.75 + 1.5 * i / 64) * Math.PI
    add(point(.15 * Math.cos(a), 2.05, .15 * Math.sin(a)))
  }
  const wrapEnd = points.length - 1
  const knot = (i: number, t: number) => {
    const n = levels[i]!, r = .17 - .124 * n, h = .12 - .075 * n, y = centers[i]! + (.25 + .32 * i) * n
    return point(.5 + r * (2 + Math.cos(3 * t)) * Math.cos(2 * t), y + h * Math.sin(3 * t), .8 + r * (2 + Math.cos(3 * t)) * Math.sin(2 * t))
  }
  const knotTangent = (i: number, t: number) => {
    const n = levels[i]!, r = .17 - .124 * n, h = .12 - .075 * n, R = r * (2 + Math.cos(3 * t)), d = -3 * r * Math.sin(3 * t)
    return point(d * Math.cos(2 * t) - 2 * R * Math.sin(2 * t), 3 * h * Math.cos(3 * t), d * Math.sin(2 * t) + 2 * R * Math.cos(2 * t)).normalize()
  }
  for (let i = 0; i < 3; i++) {
    const to = knot(i, start), from = points.at(-1)!
    if (i === 0) {
      const gateway = point(1.18, 2.2, 1.35), direction = point(0, -1, 0)
      bezier(from, from.clone().addScaledVector(arcTangent(2.25 * Math.PI), .30), gateway.clone().addScaledVector(direction, -.40), gateway)
      bezier(gateway, gateway.clone().addScaledVector(direction, .24), to.clone().addScaledVector(knotTangent(i, start), -.20), to)
    } else {
      const length = .12 + .08 * (1 - Math.min(levels[i - 1]!, levels[i]!))
      bezier(from, from.clone().addScaledVector(knotTangent(i - 1, end), length), to.clone().addScaledVector(knotTangent(i, start), -length), to)
    }
    const begin = points.length - 1
    for (let j = 1; j <= 144; j++) add(knot(i, start + (end - start) * j / 144))
    ranges.push([begin, points.length - 1])
  }
  const tailBegin = points.length - 1
  const tail = point(1.1 + .08 * levels.reduce((a, b) => a + b, 0), .15, 1.07)
  bezier(points.at(-1)!, points.at(-1)!.clone().addScaledVector(knotTangent(2, end), .18), point(.92, .18, .97), tail)
  return { points, ranges, wrapRange: [wrapBegin, wrapEnd] as [number, number], tailBegin }
}

function clothTexture() {
  const width = 256, height = 32, pixels = new Uint8Array(width * height * 4)
  // Original woven surface and a simple original Latin label, not copied sacred art.
  const letters = ['110101110101110', '111101101101111', '101111111111101', '111100110100100', '111010010010111', '101111111101101']
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4, fiber = (x % 3 === 0 ? 4 : 0) + (y % 3 === 0 ? -3 : 0)
    const row = Math.floor((y - 8) / 3), col = Math.floor(x / 3) % 24, letter = letters[Math.floor(col / 4)]!
    const ink = row >= 0 && row < 5 && col % 4 < 3 && letter[row * 3 + col % 4] === '1'
    pixels[at] = ink ? 139 : 242 + fiber; pixels[at + 1] = ink ? 101 : 205 + fiber; pixels[at + 2] = ink ? 49 : 111 + fiber; pixels[at + 3] = 255
  }
  const map = new THREE.DataTexture(pixels, width, height); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.needsUpdate = true; return map
}

/** Original continuous thick cloth, already wound and loosely knotted before entry,
 * with Rapier soft-body drape & rigid metal fence contact when active. */
export function createBonfimModel(options: BonfimModelOptions = {}) {
  const root = new THREE.Group(); root.name = 'bonfim-subject'
  const metal = new THREE.MeshStandardMaterial({ color: 0x477f7a, metalness: .48, roughness: .65 }), texture = clothTexture(), cloth = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texture, roughness: .93 })
  applyCraftSurface(metal, { kind: 'metal', strength: .45 })
  const make = (name: string, g: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = m.receiveShadow = true; root.add(m); return m
  }
  const bars = [-1.35, 0, 1.35].map((x, i) => { const m = make('bonfim-bar-' + i, new THREE.CylinderGeometry(.055, .055, 2.8, 16), metal); m.position.set(x, 1.4, 0); return m })
  const rails = [.15, 2.65].map((y, i) => { const m = make('bonfim-rail-' + i, new THREE.BoxGeometry(2.8, .085, .085), metal); m.position.y = y; return m })
  const initial = path([0, 0, 0]), count = initial.points.length, position = new Float32Array(count * 12), uv = new Float32Array(count * 8), indices: number[] = []
  for (let i = 0; i < count; i++) for (let j = 0; j < 4; j++) { uv[i * 8 + j * 2] = i / count * 12; uv[i * 8 + j * 2 + 1] = j === 0 || j === 3 ? 1 : 0 }
  for (let i = 0; i < count - 1; i++) for (let j = 0; j < 4; j++) { const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c = (i + 1) * 4 + (j + 1) % 4, d = (i + 1) * 4 + j; indices.push(a, b, c, a, c, d) }
  indices.push(0, 2, 1, 0, 3, 2); const last = (count - 1) * 4; indices.push(last, last + 1, last + 2, last, last + 2, last + 3)
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(position, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometry.setIndex(indices)
  const ribbon = make('bonfim-ribbon', geometry, cloth), knotLevels = [0, 0, 0], width = .04, thickness = .006

  const write = (points: THREE.Vector3[]) => {
    let normal = point(1, 0, 0)
    for (let i = 0; i < count; i++) {
      const tangent = points[Math.min(count - 1, i + 1)]!.clone().sub(points[Math.max(0, i - 1)]!).normalize()
      normal.addScaledVector(tangent, -normal.dot(tangent)); if (normal.lengthSq() < 1e-12) normal = point(0, 0, 1).addScaledVector(tangent, -tangent.z); normal.normalize()
      const binormal = tangent.clone().cross(normal).normalize()
      for (const [j, a, b] of [[0, 1, 1], [1, -1, 1], [2, -1, -1], [3, 1, -1]]) {
        const v = points[i]!.clone().addScaledVector(normal, a! * width / 2).addScaledVector(binormal, b! * thickness / 2), at = (i * 4 + j!) * 3
        position[at] = v.x; position[at + 1] = v.y; position[at + 2] = v.z
      }
    }
    geometry.attributes.position!.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  }

  // Build evenly spaced sample indices linking the 48 Rapier particles to the full centerline.
  const simIndices = Array.from({ length: SIM_PARTICLES }, (_, i) => Math.round((i / (SIM_PARTICLES - 1)) * (count - 1)))
  const basePoints = initial.points.map((p) => p.clone())
  const simTargets = Array.from({ length: SIM_PARTICLES }, (_, i) => initial.points[simIndices[i]!]!.clone())
  const simDeltas = Array.from({ length: SIM_PARTICLES }, () => new THREE.Vector3())
  const deformedPoints = initial.points.map((p) => p.clone())
  const prevLevels = [0, 0, 0]

  let ribbonBody: ReturnType<RapierSoftBodySession['createCustomRope']> | null = null
  let rapierReady = false
  let simClock = 0
  let disposed = false

  function particleZone(pointIndex: number): { kind: 'standing' | 'wrap' | 'gateway' | 'knot' | 'tail'; knotIdx: number; tailFrac: number } {
    const [wStart, wEnd] = initial.wrapRange
    if (pointIndex < 25) return { kind: 'standing', knotIdx: -1, tailFrac: 0 }
    if (pointIndex >= wStart && pointIndex <= wEnd) return { kind: 'wrap', knotIdx: -1, tailFrac: 0 }
    if (pointIndex < initial.ranges[0]![0]!) return { kind: 'gateway', knotIdx: -1, tailFrac: 0 }
    for (let k = 0; k < 3; k++) {
      const [b, e] = initial.ranges[k]!
      if (pointIndex >= b! && pointIndex <= e!) return { kind: 'knot', knotIdx: k, tailFrac: 0 }
    }
    if (pointIndex >= initial.tailBegin) {
      const frac = THREE.MathUtils.clamp((pointIndex - initial.tailBegin) / Math.max(1, count - 1 - initial.tailBegin), 0, 1)
      return { kind: 'tail', knotIdx: -1, tailFrac: frac }
    }
    return { kind: 'gateway', knotIdx: -1, tailFrac: 0 }
  }
  const simZones = simIndices.map(particleZone)

  function refreshAuthoredTargets() {
    const current = path(knotLevels)
    for (let i = 0; i < count; i++) basePoints[i]!.copy(current.points[i]!)
    for (let i = 0; i < SIM_PARTICLES; i++) simTargets[i]!.copy(current.points[simIndices[i]!]!)
  }

  function resetParticlesToTargets() {
    if (!ribbonBody || !ribbonBody.isValid()) return
    for (let i = 0; i < SIM_PARTICLES; i++) {
      const t = simTargets[i]!
      ribbonBody.setParticlePosition(i, { x: t.x, y: t.y, z: t.z })
      ribbonBody.setParticleVelocity(i, { x: 0, y: 0, z: 0 })
    }
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 6,
    internalPgsIterations: 2,
    sleepSpeedThreshold: 0.008,
    sleepTimeRequired: 0.55,
    isActive: options.isActive,
    isReducedMotion: options.isReducedMotion,
    onReady(session) {
      if (disposed) return
      // Real Rapier rigid-body colliders for the three vertical metal bars, two horizontal rails, and stone path.
      for (const x of [-1.35, 0, 1.35]) {
        session.addFixedCylinder({ x, y: 1.4, z: 0 }, 0.055, 2.8, { friction: 0.65, restitution: 0.04 })
      }
      for (const y of [0.15, 2.65]) {
        session.addFixedBox({ x: 0, y, z: 0 }, { x: 2.8, y: 0.085, z: 0.085 }, { friction: 0.65, restitution: 0.04 })
      }
      session.addFixedBox({ x: 0, y: -0.04, z: 0.6 }, { x: 4.0, y: 0.08, z: 3.0 }, { friction: 0.75, restitution: 0.02 })

      refreshAuthoredTargets()
      ribbonBody = session.createCustomRope({
        points: simTargets.map((v) => ({ x: v.x, y: v.y, z: v.z })),
        closed: false,
        bending: true,
        wireCollision: true,
        mass: 0.28,
        particleRadius: 0.015,
        linearDamping: 3.6,
        edgeSoftness: { naturalFrequency: 28, dampingRatio: 0.85 },
        bendSoftness: { naturalFrequency: 10, dampingRatio: 0.8 },
        friction: 0.65,
        restitution: 0.03,
        canSleep: true,
      })
      rapierReady = true
      host.settle(16, applyRibbonForces)
      writeFromRapier()
    },
  })

  function applyRibbonForces(_session: RapierSoftBodySession, subDt: number) {
    if (!ribbonBody || !ribbonBody.isValid()) return
    simClock += subDt
    ribbonBody.resetForces(false)
    const pos = ribbonBody.particlePositions()
    const vel = ribbonBody.particleVelocities()
    const m = Math.max(ribbonBody.mass() / SIM_PARTICLES, 1e-4)

    for (let i = 0; i < SIM_PARTICLES; i++) {
      const z = simZones[i]!
      const target = simTargets[i]!
      const px = pos[i * 3]!, py = pos[i * 3 + 1]!, pz = pos[i * 3 + 2]!
      const vx = vel[i * 3]!, vy = vel[i * 3 + 1]!, vz = vel[i * 3 + 2]!

      if (z.kind === 'wrap') {
        // Pull wrapped segment snugly inward onto the center metal bar collider (0, 2.05, 0)
        // so the ribbon physically rests against the Rapier cylinder collider without floating.
        const dist = Math.hypot(px, pz) || 1
        const targetR = 0.066
        const tx = (px / dist) * targetR
        const tz = (pz / dist) * targetR
        const kBar = 185, cBar = 20
        ribbonBody.addParticleForce(i, {
          x: m * (kBar * (tx - px) - cBar * vx),
          y: m * (9.81 + 140 * (target.y - py) - cBar * vy),
          z: m * (kBar * (tz - pz) - cBar * vz),
        }, false)
        continue
      }

      if (z.kind === 'tail') {
        // Free hanging tail below knot 2: real gravity drape + subtle outdoor breeze + rail/ground contact.
        const freeWeight = THREE.MathUtils.smoothstep(z.tailFrac, 0.0, 0.25)
        const kTail = THREE.MathUtils.lerp(160, 4.5, freeWeight)
        const cTail = THREE.MathUtils.lerp(16, 3.2, freeWeight)
        const gravCancel = 9.81 * (1 - freeWeight * 0.92)
        const breezeX = freeWeight * 1.15 * Math.sin(simClock * 2.0 + i * 0.45)
        const breezeZ = freeWeight * 0.85 * Math.cos(simClock * 1.6 + i * 0.35)
        ribbonBody.addParticleForce(i, {
          x: m * (kTail * (target.x - px) - cTail * vx + breezeX),
          y: m * (gravCancel + kTail * (target.y - py) - cTail * vy),
          z: m * (kTail * (target.z - pz) - cTail * vz + breezeZ),
        }, false)
        continue
      }

      if (z.kind === 'knot') {
        const level = knotLevels[z.knotIdx] ?? 0
        // Loose knots hang heavily downward under gravity; tightened knots cinch firmly onto the standing ribbon.
        const kKnot = THREE.MathUtils.lerp(24, 280, level)
        const cKnot = THREE.MathUtils.lerp(6.5, 24, level)
        const sagGravity = (1 - level) * 6.8
        const gentleSway = (1 - level) * 0.65 * Math.sin(simClock * 1.8 + z.knotIdx * 1.5)
        ribbonBody.addParticleForce(i, {
          x: m * (kKnot * (target.x - px) - cKnot * vx + gentleSway),
          y: m * (9.81 - sagGravity + kKnot * (target.y - py) - cKnot * vy),
          z: m * (kKnot * (target.z - pz) - cKnot * vz),
        }, false)
        continue
      }

      // Standing leg & gateway span: soft weighted cloth droop (gateway arch sags visibly under gravity).
      const isStandingBottom = z.kind === 'standing' && i === 0
      const kSpan = isStandingBottom ? 24 : z.kind === 'gateway' ? 19 : 95
      const cSpan = isStandingBottom ? 6 : z.kind === 'gateway' ? 6.5 : 13
      const gravDrop = z.kind === 'gateway' ? 7.6 : isStandingBottom ? 4.2 : 1.5
      ribbonBody.addParticleForce(i, {
        x: m * (kSpan * (target.x - px) - cSpan * vx),
        y: m * (9.81 - gravDrop + kSpan * (target.y - py) - cSpan * vy),
        z: m * (kSpan * (target.z - pz) - cSpan * vz),
      }, false)
    }
  }

  function writeFromRapier() {
    if (!ribbonBody || !ribbonBody.isValid()) return
    const pos = ribbonBody.particlePositions()
    for (let i = 0; i < SIM_PARTICLES; i++) {
      const target = simTargets[i]!
      const px = THREE.MathUtils.clamp(pos[i * 3]!, -1.32, 1.38)
      const py = THREE.MathUtils.clamp(pos[i * 3 + 1]!, 0.06, 2.74)
      const pz = THREE.MathUtils.clamp(pos[i * 3 + 2]!, -0.16, 1.52)
      const z = simZones[i]!
      // Keep tightened knots cleanly clear of the standing ribbon and compact while letting loose spans & tail drape.
      const maxDelta = z.kind === 'knot'
        ? THREE.MathUtils.lerp(0.24, 0.015, knotLevels[z.knotIdx] ?? 0)
        : z.kind === 'tail'
          ? 0.55
          : z.kind === 'gateway'
            ? 0.36
            : 0.22
      let dx = px - target.x, dy = py - target.y, dz = pz - target.z
      const len = Math.hypot(dx, dy, dz)
      if (len > maxDelta && len > 1e-6) {
        const s = maxDelta / len
        dx *= s; dy *= s; dz *= s
      }
      simDeltas[i]!.set(dx, dy, dz)
    }

    for (let k = 0; k < count; k++) {
      const f = (k / (count - 1)) * (SIM_PARTICLES - 1)
      const i0 = Math.floor(f), i1 = Math.min(SIM_PARTICLES - 1, i0 + 1), alpha = f - i0
      const d0 = simDeltas[i0]!, d1 = simDeltas[i1]!
      const bp = basePoints[k]!
      deformedPoints[k]!.set(
        bp.x + d0.x + (d1.x - d0.x) * alpha,
        Math.max(0.06, bp.y + d0.y + (d1.y - d0.y) * alpha),
        bp.z + d0.z + (d1.z - d0.z) * alpha,
      )
    }
    write(deformedPoints)
    root.updateMatrixWorld(true)
  }

  function pose(step: number, amount: number) {
    const t = Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, 0, 1) : 0
    for (let i = 0; i < 3; i++) knotLevels[i] = i < step ? 1 : i === step ? t : 0
    let deltaLevel = 0
    let changedKnot = -1
    for (let i = 0; i < 3; i++) {
      const d = knotLevels[i]! - prevLevels[i]!
      if (Math.abs(d) > 1e-5) { deltaLevel += d; changedKnot = i }
      prevLevels[i] = knotLevels[i]!
    }
    refreshAuthoredTargets()
    if (rapierReady && ribbonBody && ribbonBody.isValid() && !options.isReducedMotion?.() && Math.abs(deltaLevel) > 1e-5) {
      host.wakeUp()
      // Give the ribbon and free tail a subtle physical tug impulse as a knot cinches.
      const m = Math.max(ribbonBody.mass() / SIM_PARTICLES, 1e-4)
      const dir = changedKnot === 1 ? -1 : 1
      for (let i = 0; i < SIM_PARTICLES; i++) {
        const z = simZones[i]!
        if (z.kind === 'tail' || (z.kind === 'knot' && z.knotIdx === changedKnot)) {
          const weight = z.kind === 'tail' ? 0.5 + 0.5 * z.tailFrac : 0.45
          ribbonBody.applyParticleImpulse(i, { x: dir * m * 1.4 * deltaLevel * weight, y: m * 0.7 * deltaLevel * weight, z: m * 0.4 * deltaLevel * weight }, true)
        }
      }
    }
    write(basePoints)
    root.updateMatrixWorld(true)
  }

  function stepPhysics(dt: number) {
    if (disposed || options.isReducedMotion?.()) return false
    if (!rapierReady || !ribbonBody || !ribbonBody.isValid()) return false
    const stepped = host.step(dt, applyRibbonForces)
    if (stepped) writeFromRapier()
    return stepped
  }

  function resetPhysics() {
    refreshAuthoredTargets()
    if (rapierReady) resetParticlesToTargets()
    write(basePoints)
    root.updateMatrixWorld(true)
  }

  pose(0, 0)
  const dispose = () => {
    if (disposed) return
    disposed = true
    ribbonBody = null
    rapierReady = false
    host.dispose()
    texture.dispose()
  }
  const isKnotFace = (step: number, face: number | undefined) => {
    const range = initial.ranges[step]
    return !!range && face !== undefined && face >= range[0]! * 8 && face < range[1]! * 8
  }
  return {
    root,
    subject: root,
    ribbon,
    bars,
    rails,
    knotLevels,
    knotRanges: initial.ranges,
    bandWidth: width,
    bandThickness: thickness,
    pose,
    stepPhysics,
    resetPhysics,
    startPhysics() {
      if (disposed || options.isReducedMotion?.()) return Promise.resolve(null)
      return host.start()
    },
    get rapierReady() { return rapierReady },
    dispose,
    isKnotFace,
    targets: [ribbon, ribbon, ribbon],
    roots: [ribbon, ribbon, ribbon],
    anchors: [[.648121563476, 1.669623803414, 1.091023272286], [.648121563476, 1.219623803414, 1.091023272286], [.648121563476, .769623803414, 1.091023272286]] as [number, number, number][],
  }
}
