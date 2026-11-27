import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const NX = 8, NY = 10, W = .38, H = .45, COUNT = (NX + 1) * (NY + 1), LENGTH = 2.5
const SIM_NU = 6, SIM_NV = 8 // 48 particles per flag * 5 = 240 cloth particles
const ROPE_PARTICLES = 25     // 25 particles on connecting cotton line (total 265)
const RINGS = 65, SIDES = 8

export interface PrayerFlagsModelOptions {
  isActive?: () => boolean
  isReducedMotion?: () => boolean
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

function sampleClothGrid(
  pos: Float32Array,
  nu: number,
  nv: number,
  u: number,
  v: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const fu = THREE.MathUtils.clamp(u, 0, 1) * (nu - 1)
  const fv = THREE.MathUtils.clamp(v, 0, 1) * (nv - 1)
  const i1 = Math.min(nu - 2, Math.floor(fu))
  const j1 = Math.min(nv - 2, Math.floor(fv))
  const tu = fu - i1
  const tv = fv - j1
  const i0 = Math.max(0, i1 - 1), i2 = i1 + 1, i3 = Math.min(nu - 1, i1 + 2)
  const j0 = Math.max(0, j1 - 1), j2 = j1 + 1, j3 = Math.min(nv - 1, j1 + 2)

  const sampleAxis = (axis: 0 | 1 | 2) => {
    const row = (j: number) => catmullRom(
      pos[(i0 * nv + j) * 3 + axis]!,
      pos[(i1 * nv + j) * 3 + axis]!,
      pos[(i2 * nv + j) * 3 + axis]!,
      pos[(i3 * nv + j) * 3 + axis]!,
      tu,
    )
    return catmullRom(row(j0), row(j1), row(j2), row(j3), tv)
  }

  return out.set(sampleAxis(0), sampleAxis(1), sampleAxis(2))
}

const glyphs: Record<string, string[]> = {
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
}

// Original Latin typesetting of the documented mantra; not a facsimile of a nunnery print.
function print(lines: string[]) {
  const size = 128, data = new Uint8Array(size * size * 4); data.fill(255)
  const ink = (x: number, y: number) => { const i = (y * size + x) * 4; data[i] = 35; data[i + 1] = 38; data[i + 2] = 39 }
  for (let l = 0; l < lines.length; l++) {
    const text = lines[l]!, scale = 4, x0 = Math.floor((size - (text.length * 6 - 1) * scale) / 2), y0 = Math.floor((size - lines.length * 36) / 2) + l * 36
    ;[...text].forEach((c, k) => glyphs[c]!.forEach((row, y) => [...row].forEach((bit, x) => {
      if (bit === '1') for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) ink(x0 + (k * 6 + x) * scale + a, y0 + y * scale + b)
    })))
  }
  const texture = new THREE.DataTexture(data, size, size); texture.flipY = true; texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter; texture.needsUpdate = true; return texture
}

function clothGeometry() {
  const g = new THREE.BufferGeometry(), indices: number[] = [], uv: number[] = [], sources: number[] = []
  for (let side = 0; side < 2; side++) for (let y = 0; y <= NY; y++) for (let x = 0; x <= NX; x++) uv.push(x / NX, 1 - y / NY)
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d)
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const a = y * (NX + 1) + x
    quad(a, a + NX + 1, a + NX + 2, a + 1)
    quad(a + COUNT, a + COUNT + 1, a + COUNT + NX + 2, a + COUNT + NX + 1)
  }
  const edge = (a: number, b: number, c: number, d: number) => {
    const offset = COUNT * 2 + sources.length
    for (const source of [a, b, c, d]) { sources.push(source); uv.push(uv[source * 2]!, uv[source * 2 + 1]!) }
    quad(offset, offset + 1, offset + 2, offset + 3)
  }
  for (let x = 0; x < NX; x++) { edge(x, x + 1, x + 1 + COUNT, x + COUNT); const a = NY * (NX + 1) + x; edge(a, a + COUNT, a + COUNT + 1, a + 1) }
  for (let y = 0; y < NY; y++) { const a = y * (NX + 1), b = a + NX; edge(a, a + COUNT, a + COUNT + NX + 1, a + NX + 1); edge(b, b + NX + 1, b + NX + 1 + COUNT, b + COUNT) }
  g.userData.edgeSources = sources
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((COUNT * 2 + sources.length) * 3), 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(indices)
  return g
}

/** Complete five-colour Mini Mani string. Posts, peg sequence, proportions and typography are product staging. */
export function createPrayerFlagsModel(options: PrayerFlagsModelOptions = {}) {
  const root = new THREE.Group(); root.name = 'prayer-flags-subject'
  const matte = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .94 })
  const make = <M extends THREE.Material>(name: string, g: THREE.BufferGeometry, m: M) => {
    const o = new THREE.Mesh(g, m); o.name = 'prayer-flags-' + name; o.castShadow = o.receiveShadow = true; root.add(o); return o
  }
  const postWood = matte(0xb48756), armWood = matte(0xb48756), pegWood = matte(0xa87c4d), stone = matte(0xd6c9ab), cotton = matte(0xf8efdd)
  applyCraftSurface(postWood, { kind: 'wood', strength: .4, axis: 'y' })
  applyCraftSurface(armWood, { kind: 'wood', strength: .4, axis: 'x' })
  applyCraftSurface(pegWood, { kind: 'wood', strength: .38, axis: 'z' })
  applyCraftSurface(cotton, { kind: 'cord', strength: .3 })
  applyCraftSurface(stone, { kind: 'stone', strength: .4 })

  const roundedBox = (name: string, size: [number, number, number], p: [number, number, number], m: THREE.Material, radius = .016) => {
    const r = Math.min(radius, size[0] / 3, size[1] / 3, size[2] / 3)
    const o = make(name, new RoundedBoxGeometry(size[0], size[1], size[2], 2, r), m)
    o.position.set(...p); return o
  }
  for (const x of [-1.15, 1.15]) {
    roundedBox('post-' + x, [.10, 2.05, .10], [x, 1.025, 0], postWood, .018)
    roundedBox('post-cap-' + x, [.124, .034, .124], [x, 2.055, 0], postWood, .011)
    roundedBox('foot-' + x, [.28, .12, .28], [x, .06, 0], stone, .022)
    roundedBox('foot-collar-' + x, [.19, .038, .19], [x, .128, 0], stone, .012)
  }
  const arm = roundedBox('temporary-arm', [.60, .055, .06], [.90, 1.50, 0], armWood, .016)
  const armTip = make('temporary-arm-tip', new THREE.CapsuleGeometry(.032, .022, 6, 14), armWood)
  armTip.position.set(.65, 1.50, 0)
  const pegPositions = [[-1.15, 1.50], [-1.15, 1.85], [.65, 1.50], [1.15, 1.50], [1.15, 1.85]]
  const pegs = pegPositions.map(([x, y], i) => {
    const o = make('peg-' + i, new THREE.CylinderGeometry(.033, .033, .20, 64), pegWood)
    o.rotation.x = Math.PI / 2; o.position.set(x!, y!, .06); return o
  })
  const temporarySupport = new THREE.Group(); temporarySupport.name = 'prayer-flags-temporary-support'; temporarySupport.position.set(1.15, 1.50, 0); root.add(temporarySupport)
  arm.position.sub(temporarySupport.position); armTip.position.sub(temporarySupport.position); pegs[2]!.position.sub(temporarySupport.position); temporarySupport.add(arm, armTip, pegs[2]!)
  const hingeGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0, -.066),
    new THREE.Vector2(.036, -.066),
    new THREE.Vector2(.048, -.054),
    new THREE.Vector2(.048, .054),
    new THREE.Vector2(.036, .066),
    new THREE.Vector2(0, .066),
  ], 24)
  const hinge = make('hinge', hingeGeo, pegWood); hinge.position.copy(temporarySupport.position)
  const loops = [0, 1].map(i => make('loop-' + i, new THREE.TorusGeometry(.060, .012, 8, 64), cotton))

  const ropeGeometry = new THREE.BufferGeometry(), ropeIndices: number[] = []
  ropeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((RINGS * SIDES + 2) * 3), 3))
  for (let i = 0; i < RINGS - 1; i++) for (let j = 0; j < SIDES; j++) {
    const a = i * SIDES + j, b = i * SIDES + (j + 1) % SIDES
    ropeIndices.push(a, b, b + SIDES, a, b + SIDES, a + SIDES)
  }
  for (let j = 0; j < SIDES; j++) {
    ropeIndices.push(RINGS * SIDES, (j + 1) % SIDES, j)
    const a = (RINGS - 1) * SIDES
    ropeIndices.push(RINGS * SIDES + 1, a + j, a + (j + 1) % SIDES)
  }
  ropeGeometry.setIndex(ropeIndices)
  const rope = make('rope', ropeGeometry, cotton)

  const colors = [0x5079be, 0xf6f0dd, 0xd76054, 0x659e76, 0xe9c257]
  const names = ['blue', 'white', 'red', 'green', 'yellow']
  const syllables = [['OM'], ['MA'], ['NI'], ['PAD', 'ME'], ['HUM']]
  const flags = names.map((name, i) => {
    const material = createRitualMaterial({ color: colors[i]!, roughness: .94 }, { kind: 'cloth', strength: .22, fiber: 'linen' })
    material.map = print(syllables[i]!)
    const mesh = make(name, clothGeometry(), material)
    mesh.userData.mantra = syllables[i]!.join(' ')
    return mesh
  })

  let time = 0, simClock = 0, currentCheckpoint = 0
  const left = V(), right = V(), start = V(), end = V()
  const points: THREE.Vector3[] = [], lengths: number[] = []
  const liveRopePoints: THREE.Vector3[] = Array.from({ length: RINGS }, () => V())
  const liveRopeLengths: number[] = Array.from({ length: RINGS }, () => 0)
  const ropeSamplePts: THREE.Vector3[] = Array.from({ length: ROPE_PARTICLES }, () => V())
  const gridScratch: THREE.Vector3[] = Array.from({ length: COUNT }, () => V())
  const tmpA = V(), tmpB = V(), tmpN = V(), tmpBi = V(), tmpT = V(), tmpU = V(), tmpV = V()
  const flagCenters = flags.map((_, i) => (.14 + i * .18) * LENGTH)

  let ropeBody: ReturnType<RapierSoftBodySession['createCustomRope']> | null = null
  const flagBodies: ReturnType<RapierSoftBodySession['createCloth']>[] = []
  let rapierReady = false
  let physicsStepped = false
  let disposed = false

  const curve = (t: number, sag: number) => start.clone().lerp(end, t).add(V(0, -4 * sag * t * (1 - t), 0))
  function sample(sag: number) {
    let length = 0, previous = start.y
    const dx = (end.x - start.x) / 64, dz = (end.z - start.z) / 64
    for (let i = 1; i <= 64; i++) {
      const t = i / 64, y = start.y + (end.y - start.y) * t - 4 * sag * t * (1 - t)
      length += Math.hypot(dx, y - previous, dz); previous = y
    }
    return length
  }

  // Lift inside the loop, withdraw beyond the peg tip, carry, insert and lower onto the new peg.
  const transfer = (from: THREE.Vector3, to: THREE.Vector3, t: number) => {
    const route = [from.clone().add(V(0, -.015, 0)), from, from.clone().add(V(0, 0, .10)), to.clone().add(V(0, 0, .10)), to, to.clone().add(V(0, -.015, 0))]
    const stops = [0, .12, .25, .70, .85, 1]
    let i = 0; while (i < 4 && t > stops[i + 1]!) i++
    return route[i]!.clone().lerp(route[i + 1]!, THREE.MathUtils.clamp((t - stops[i]!) / (stops[i + 1]! - stops[i]!), 0, 1))
  }

  function alongFrom(pts: readonly THREE.Vector3[], lens: readonly number[], distance: number, out: THREE.Vector3): THREE.Vector3 {
    const total = lens[lens.length - 1] || LENGTH
    const clamped = THREE.MathUtils.clamp(distance, 0, total)
    let k = 1
    while (k < lens.length - 1 && lens[k]! < clamped) k++
    const span = Math.max(lens[k]! - lens[k - 1]!, 1e-8)
    return out.lerpVectors(pts[k - 1]!, pts[k]!, THREE.MathUtils.clamp((clamped - lens[k - 1]!) / span, 0, 1))
  }

  function along(distance: number) {
    return alongFrom(points, lengths, distance, V())
  }

  function writeRopeMeshFromPoints(pts: readonly THREE.Vector3[]) {
    const p = ropeGeometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < RINGS; i++) {
      const prev = pts[Math.max(0, i - 1)]!
      const next = pts[Math.min(RINGS - 1, i + 1)]!
      tmpT.subVectors(next, prev).normalize()
      if (Math.abs(tmpT.z) < 0.92) {
        tmpN.set(-tmpT.y, tmpT.x, 0).normalize()
      } else {
        tmpN.set(0, 1, 0).addScaledVector(tmpT, -tmpT.y).normalize()
      }
      tmpBi.crossVectors(tmpT, tmpN).normalize()
      const c = pts[i]!
      for (let j = 0; j < SIDES; j++) {
        const theta = j / SIDES * Math.PI * 2, ca = Math.cos(theta), sa = Math.sin(theta)
        p.setXYZ(
          i * SIDES + j,
          c.x + .012 * (tmpN.x * ca + tmpBi.x * sa),
          c.y + .012 * (tmpN.y * ca + tmpBi.y * sa),
          c.z + .012 * (tmpN.z * ca + tmpBi.z * sa),
        )
      }
    }
    p.setXYZ(RINGS * SIDES, start.x, start.y, start.z)
    p.setXYZ(RINGS * SIDES + 1, end.x, end.y, end.z)
    p.needsUpdate = true
    ropeGeometry.computeVertexNormals()
    ropeGeometry.computeBoundingBox()
    ropeGeometry.computeBoundingSphere()
  }

  function refreshLiveRopeSamples() {
    if (!ropeBody || !ropeBody.isValid()) {
      for (let i = 0; i < RINGS; i++) {
        liveRopePoints[i]!.copy(points[i]!)
        liveRopeLengths[i] = lengths[i]!
      }
      return
    }
    const pos = ropeBody.particlePositions()
    ropeSamplePts[0]!.copy(start)
    for (let i = 1; i < ROPE_PARTICLES - 1; i++) {
      ropeSamplePts[i]!.set(
        THREE.MathUtils.clamp(pos[i * 3]!, -1.24, 1.24),
        THREE.MathUtils.clamp(pos[i * 3 + 1]!, H + 0.08, 2.02),
        THREE.MathUtils.clamp(pos[i * 3 + 2]!, -0.28, 0.42),
      )
    }
    ropeSamplePts[ROPE_PARTICLES - 1]!.copy(end)
    const ropeCurve = new THREE.CatmullRomCurve3(ropeSamplePts, false, 'centripetal')
    liveRopeLengths[0] = 0
    for (let i = 0; i < RINGS; i++) {
      ropeCurve.getPoint(i / (RINGS - 1), liveRopePoints[i]!)
      if (i === 0) liveRopePoints[i]!.copy(start)
      else if (i === RINGS - 1) liveRopePoints[i]!.copy(end)
      if (i > 0) liveRopeLengths[i] = liveRopeLengths[i - 1]! + liveRopePoints[i]!.distanceTo(liveRopePoints[i - 1]!)
    }
  }

  function resetBodiesToCurrentCatenary() {
    if (!ropeBody || !ropeBody.isValid()) return
    for (let i = 0; i < ROPE_PARTICLES; i++) {
      const d = (i / (ROPE_PARTICLES - 1)) * LENGTH
      alongFrom(points, lengths, d, tmpA)
      ropeBody.setParticlePosition(i, { x: tmpA.x, y: tmpA.y, z: tmpA.z })
      ropeBody.setParticleVelocity(i, { x: 0, y: 0, z: 0 })
    }
    refreshLiveRopeSamples()
    const totalLive = liveRopeLengths[RINGS - 1] || LENGTH
    for (let f = 0; f < flagBodies.length; f++) {
      const body = flagBodies[f]!
      if (!body.isValid()) continue
      const center = (flagCenters[f]! / LENGTH) * totalLive
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        alongFrom(liveRopePoints, liveRopeLengths, center + (u - 0.5) * W, tmpA)
        for (let j = 0; j < SIM_NV; j++) {
          const v = j / (SIM_NV - 1)
          const k = i * SIM_NV + j
          body.setParticlePosition(k, {
            x: tmpA.x + 0.025 * v * v,
            y: tmpA.y - v * H,
            z: tmpA.z - 0.05 * v * v,
          })
          body.setParticleVelocity(k, { x: 0, y: 0, z: 0 })
        }
      }
    }
  }

  const pinnedTopRow: number[] = []
  for (let i = 0; i < SIM_NU; i++) pinnedTopRow.push(i * SIM_NV)

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 6,
    internalPgsIterations: 3,
    // Prayer flags stream gently in continuous highland wind when active.
    sleepSpeedThreshold: 0,
    isActive: options.isActive,
    isReducedMotion: options.isReducedMotion,
    onReady(session) {
      if (disposed) return
      // Fixed rigid colliders for both wooden posts, fixed pegs, and ground plane.
      for (const x of [-1.15, 1.15]) {
        session.addFixedBox({ x, y: 1.025, z: 0 }, { x: 0.10, y: 2.05, z: 0.10 }, { friction: 0.65, restitution: 0.02 })
      }
      session.addFixedBox({ x: 0, y: -0.05, z: 0 }, { x: 5.0, y: 0.10, z: 4.0 }, { friction: 0.8, restitution: 0.02 })

      // Connecting cotton rope initialized with exact LENGTH = 2.5 arc-length spacing.
      const initPts: { x: number; y: number; z: number }[] = []
      for (let i = 0; i < ROPE_PARTICLES; i++) {
        alongFrom(points, lengths, (i / (ROPE_PARTICLES - 1)) * LENGTH, tmpA)
        initPts.push({ x: tmpA.x, y: tmpA.y, z: tmpA.z })
      }
      ropeBody = session.createCustomRope({
        points: initPts,
        closed: false,
        bending: true,
        wireCollision: true,
        pinnedParticles: [0, ROPE_PARTICLES - 1],
        mass: 0.24,
        particleRadius: 0.012,
        linearDamping: 3.1,
        edgeSoftness: { naturalFrequency: 36, dampingRatio: 0.88 },
        bendSoftness: { naturalFrequency: 6.5, dampingRatio: 0.82 },
        friction: 0.55,
        canSleep: false,
      })

      // Five individual tensionOnly cloth bodies pinned along their top rope seam.
      flagBodies.length = 0
      for (let f = 0; f < 5; f++) {
        const body = session.createCloth({
          origin: { x: -W / 2, y: 1.5, z: 0.12 },
          du: { x: W / (SIM_NU - 1), y: 0, z: 0 },
          dv: { x: 0, y: -H / (SIM_NV - 1), z: 0 },
          nu: SIM_NU,
          nv: SIM_NV,
          mass: 0.085,
          particleRadius: 0.012,
          gravityScale: 1.0,
          linearDamping: 2.35,
          edgeSoftness: { naturalFrequency: 22, dampingRatio: 0.84 },
          bendSoftness: { naturalFrequency: 3.2, dampingRatio: 0.78 },
          tensionOnly: false,
          pinnedParticles: pinnedTopRow,
          noSurfaceCollider: true,
          canSleep: false,
        })
        flagBodies.push(body)
      }

      rapierReady = true
      resetBodiesToCurrentCatenary()
      host.settle(54, applyPhysicsForces)
      physicsStepped = true
      writeFromRapier()
    },
  })

  function applyPhysicsForces(_session: RapierSoftBodySession, subDt: number) {
    simClock += subDt
    const t = simClock
    // Stronger, livelier highland breeze once hoisted high; gentler drape when hung lower at entry.
    const hoisted = THREE.MathUtils.clamp((Math.min(left.y, right.y) - 1.48) / 0.35, 0, 1)
    const windScale = 0.64 + 0.36 * hoisted

    if (ropeBody && ropeBody.isValid()) {
      ropeBody.resetForces(false)
      ropeBody.setParticleKinematicTarget(0, { x: start.x, y: start.y, z: start.z })
      ropeBody.setParticleKinematicTarget(ROPE_PARTICLES - 1, { x: end.x, y: end.y, z: end.z })
      const m = Math.max(ropeBody.mass() / ROPE_PARTICLES, 1e-4)
      const rPos = ropeBody.particlePositions()
      for (let i = 1; i < ROPE_PARTICLES - 1; i++) {
        const s = i / (ROPE_PARTICLES - 1)
        const bell = Math.sin(Math.PI * s)
        // Soft highland breeze pushes the cotton cord subtly backward with a traveling sway.
        const breezeZ = (-0.85 - 1.15 * Math.sin(t * 2.1 - s * 4.2)) * windScale * bell
        const breezeX = (0.45 * Math.cos(t * 1.65 - s * 3.1)) * windScale * bell
        // Gentle anchor back toward analytic z-plane keeps rope cleanly inside framing.
        const pz = rPos[i * 3 + 2]!
        const restoreZ = -7.5 * (pz - (start.z + (end.z - start.z) * s))
        ropeBody.addParticleForce(i, {
          x: m * breezeX,
          y: -m * 1.1 * bell,
          z: m * (breezeZ + restoreZ),
        }, false)
      }
    }

    refreshLiveRopeSamples()
    const totalLive = liveRopeLengths[RINGS - 1] || LENGTH

    for (let f = 0; f < flagBodies.length; f++) {
      const body = flagBodies[f]!
      if (!body.isValid()) continue
      body.resetForces(false)
      const center = (flagCenters[f]! / LENGTH) * totalLive
      const pMass = Math.max(body.mass() / (SIM_NU * SIM_NV), 1e-4)
      const vel = body.particleVelocities()

      // Pin top edge particles directly to the live Rapier cotton rope.
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        alongFrom(liveRopePoints, liveRopeLengths, center + (u - 0.5) * W, tmpA)
        body.setParticleKinematicTarget(i * SIM_NV, { x: tmpA.x, y: tmpA.y, z: tmpA.z })
      }

      // Diagonal highland breeze with staggered traveling gusts across the five flags.
      const flagPhase = f * 1.28
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        for (let j = 1; j < SIM_NV; j++) {
          const v = j / (SIM_NV - 1)
          const k = i * SIM_NV + j
          const vRamp = THREE.MathUtils.smoothstep(v, 0.06, 0.90)
          const phase = t * 2.35 - flagPhase - u * 2.3 - v * 4.4
          const harmonic = t * 3.85 - flagPhase * 1.4 - u * 3.2 - v * 6.2

          // Balanced highland breeze keeps all five flags hanging vertically readable (~15-26 deg billow)
          // without twisting the left-sloping blue/white flags edge-on, so every mantra syllable stays crisp
          // while showing clear 3D S-wave folds, billowing bottom edges, and wavy shadows across the stones.
          const windZ = (-1.15 - 3.85 * Math.sin(phase) - 1.35 * Math.sin(harmonic)) * windScale * vRamp
          const windX = (0.28 + 1.10 * Math.cos(phase * 0.85 + 0.45) + 0.45 * Math.sin(harmonic)) * windScale * vRamp
          const liftY = (0.65 * Math.max(0, -Math.sin(phase)) + 0.45 * Math.sin(t * 2.0 - flagPhase - u * 2.4)) * windScale * vRamp

          const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!
          body.addParticleForce(k, {
            x: pMass * (windX - 1.9 * vx),
            y: pMass * (liftY - 1.7 * vy),
            z: pMass * (windZ - 2.0 * vz),
          }, false)
        }
      }
    }
  }

  function writeFromRapier() {
    if (!ropeBody || !ropeBody.isValid() || flagBodies.length !== 5) return
    refreshLiveRopeSamples()
    writeRopeMeshFromPoints(liveRopePoints)

    const totalLive = liveRopeLengths[RINGS - 1] || LENGTH
    flags.forEach((mesh, f) => {
      const body = flagBodies[f]!
      if (!body.isValid()) return
      // Keep deterministic mesh.position so checkpoint matrixWorld invariants remain exact.
      const authoredCenter = flagCenters[f]!
      const origin = along(authoredCenter).add(V(0, -H / 2, 0))
      mesh.position.copy(origin)

      const liveCenter = (authoredCenter / LENGTH) * totalLive
      const simPos = body.particlePositions()

      for (let y = 0; y <= NY; y++) {
        const v = y / NY
        for (let x = 0; x <= NX; x++) {
          const u = x / NX
          const dst = gridScratch[y * (NX + 1) + x]!
          if (y === 0) {
            alongFrom(liveRopePoints, liveRopeLengths, liveCenter + (u - 0.5) * W, dst)
          } else {
            sampleClothGrid(simPos, SIM_NU, SIM_NV, u, v, dst)
            dst.x = THREE.MathUtils.clamp(dst.x, -1.16, 1.16)
            dst.y = THREE.MathUtils.clamp(dst.y, 0.06, 2.02)
            dst.z = THREE.MathUtils.clamp(dst.z, -0.42, 0.44)
          }
        }
      }

      const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let y = 0; y <= NY; y++) {
        const y0 = Math.max(0, y - 1), y1 = Math.min(NY, y + 1)
        for (let x = 0; x <= NX; x++) {
          const x0 = Math.max(0, x - 1), x1 = Math.min(NX, x + 1)
          const c = gridScratch[y * (NX + 1) + x]!
          tmpU.subVectors(gridScratch[y * (NX + 1) + x1]!, gridScratch[y * (NX + 1) + x0]!)
          tmpV.subVectors(gridScratch[y0 * (NX + 1) + x]!, gridScratch[y1 * (NX + 1) + x]!)
          tmpN.crossVectors(tmpU, tmpV)
          if (tmpN.lengthSq() < 1e-10) tmpN.set(0, 0, 1)
          else tmpN.normalize()
          if (tmpN.z < 0) tmpN.negate()

          const idx = y * (NX + 1) + x
          const lx = c.x - origin.x, ly = c.y - origin.y, lz = c.z - origin.z
          p.setXYZ(idx, lx + tmpN.x * .003, ly + tmpN.y * .003, lz + tmpN.z * .003)
          p.setXYZ(COUNT + idx, lx - tmpN.x * .003, ly - tmpN.y * .003, lz - tmpN.z * .003)
        }
      }
      ;(mesh.geometry.userData.edgeSources as number[]).forEach((source, i) => {
        p.setXYZ(COUNT * 2 + i, p.getX(source), p.getY(source), p.getZ(source))
      })
      p.needsUpdate = true
      mesh.geometry.computeVertexNormals()
      mesh.geometry.computeBoundingBox()
      mesh.geometry.computeBoundingSphere()
    })
    root.updateMatrixWorld(true)
  }

  function cloth() {
    flags.forEach((mesh, i) => {
      const center = flagCenters[i]!, origin = along(center).add(V(0, -H / 2, 0))
      mesh.position.copy(origin)
      const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let side = 0; side < 2; side++) for (let y = 0; y <= NY; y++) for (let x = 0; x <= NX; x++) {
        const u = x / NX, v = y / NY
        const q = along(center + (u - .5) * W).add(V(0, -v * H, .035 * Math.sin(Math.PI * v) * Math.sin(2 * Math.PI * v) * Math.sin(time * 1.8 + u * 3 + i)))
        q.z += (side === 0 ? 1 : -1) * .003
        q.sub(origin)
        p.setXYZ(side * COUNT + y * (NX + 1) + x, q.x, q.y, q.z)
      }
      ;(mesh.geometry.userData.edgeSources as number[]).forEach((source, idx) => p.setXYZ(COUNT * 2 + idx, p.getX(source), p.getY(source), p.getZ(source)))
      p.needsUpdate = true
      mesh.geometry.computeVertexNormals()
      mesh.geometry.computeBoundingBox()
      mesh.geometry.computeBoundingSphere()
    })
  }

  function rebuild(syncRapier = false) {
    loops[0]!.position.copy(left); loops[1]!.position.copy(right)
    start.copy(left).add(V(.060, 0, 0)); end.copy(right).add(V(-.060, 0, 0))
    let lo = 0, hi = 1.5
    for (let i = 0; i < 25; i++) {
      const middle = (lo + hi) / 2
      if (sample(middle) < LENGTH) lo = middle; else hi = middle
    }
    points.length = lengths.length = 0; lengths.push(0)
    for (let i = 0; i <= 64; i++) {
      points.push(curve(i / 64, (lo + hi) / 2))
      if (i) lengths.push(lengths[i - 1]! + points[i]!.distanceTo(points[i - 1]!))
    }
    if (syncRapier && rapierReady && physicsStepped && !options.isReducedMotion?.()) {
      resetBodiesToCurrentCatenary()
      host.settle(24, applyPhysicsForces)
      writeFromRapier()
      return
    }
    writeRopeMeshFromPoints(points)
    cloth()
    root.updateMatrixWorld(true)
  }

  function pose(checkpoint: number, amount: number, effects = true) {
    if (checkpoint < 3 && amount >= 1) { pose(checkpoint + 1, 0, effects); return }
    const t = THREE.MathUtils.clamp(Number.isFinite(amount) ? amount : 0, 0, 1)
    const prevLeft = left.clone(), prevRight = right.clone()
    const fold = checkpoint < 1 ? 0 : checkpoint > 1 ? 1 : THREE.MathUtils.clamp((t - .25) / .45, 0, 1)
    temporarySupport.rotation.y = -Math.PI / 2 * fold * fold * (3 - 2 * fold)
    left.copy(checkpoint === 0 ? transfer(V(-1.15, 1.50, .12), V(-1.15, 1.85, .12), t) : V(-1.15, 1.835, .12))
    right.copy(checkpoint === 0 ? V(.65, 1.485, .12) : checkpoint === 1 ? transfer(V(.65, 1.50, .12), V(1.15, 1.50, .12), t) : checkpoint === 2 ? transfer(V(1.15, 1.50, .12), V(1.15, 1.85, .12), t) : V(1.15, 1.835, .12))
    const jumped = prevLeft.distanceTo(left) > 0.15 || prevRight.distanceTo(right) > 0.15 || checkpoint !== currentCheckpoint
    currentCheckpoint = checkpoint
    rebuild(effects && jumped && amount === 0)
  }

  function holdEnd(index: 0 | 1, position: THREE.Vector3) {
    if (![position.x, position.y, position.z].every(Number.isFinite)) return
    const fixed = (index === 0 ? right : left).clone().add(V(index === 0 ? -.060 : .060, 0, 0))
    const offset = V(index === 0 ? .060 : -.060, 0, 0), desired = position.clone(), moving = index === 0 ? left : right
    for (let attempt = 0; attempt < 16; attempt++) {
      const delta = desired.clone().add(offset).sub(fixed)
      // The string can become taut, but cannot stretch to follow an unreachable pointer.
      if (delta.length() > LENGTH - .001) delta.setLength(LENGTH - .001)
      moving.copy(fixed).add(delta).sub(offset); rebuild(false)
      const clearance = .055 + H - Math.min(...points.map(point => point.y))
      if (clearance <= 0) break
      // Lifting the moving end preserves the established off-ground presentation;
      // a low pointer cannot lay the attached flags through the ground.
      desired.copy(moving); desired.y += clearance * 2 + .01
    }
  }

  function tick(dt: number) {
    if (disposed) return
    if (options.isReducedMotion?.()) {
      writeRopeMeshFromPoints(points)
      cloth()
      return
    }
    if (rapierReady && ropeBody && flagBodies.length === 5) {
      const stepped = host.step(dt, applyPhysicsForces)
      if (stepped || physicsStepped) {
        physicsStepped = true
        writeFromRapier()
        return
      }
    }
    time += dt
    cloth()
  }

  pose(0, 0)
  return {
    root,
    flags,
    rope,
    loops,
    pegs,
    temporarySupport,
    left,
    right,
    points,
    lengths,
    pose,
    holdEnd,
    tick,
    startPhysics() {
      if (disposed || options.isReducedMotion?.()) return Promise.resolve(null)
      return host.start()
    },
    get rapierReady() { return rapierReady },
    dispose() {
      if (disposed) return
      disposed = true
      ropeBody = null
      flagBodies.length = 0
      rapierReady = false
      physicsStepped = false
      host.dispose()
    },
    targets: [flags[0]!, flags[4]!, flags[4]!],
    roots: [flags[0]!, flags[4]!, flags[4]!],
    anchors: [V(0, 0, .004), V(0, 0, .004), V(0, 0, .004)],
  }
}
