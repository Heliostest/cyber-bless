import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'
import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

export interface KhataModelOptions {
  isActive?: () => boolean
  isReducedMotion?: () => boolean
}

export interface KhataCarryFeel {
  /** 0 at canonical rest checkpoints, 0..1 when actively lifted/carried. */
  weight: number
  /** Gentle inward palm-cradle gather (-0.026..0 m) while actively presenting. */
  gather: number
  /** Subtle vertical inertia sag (-0.014..+0.028 m) on the center palm bridge. */
  bridgeSag: number
  /** Forward-present motion response (-0.04..0.04 m) on the center bridge. */
  bridgeBowX: number
}

const RINGS = 56
const SIM_N = 25 // symmetric spine: index 12 is center (s = 0), 0..11 & 13..24 are the two halves
const HALF_LEN = 0.78 // constant total folded scarf arc length = 1.56
const GIVER_SPAN = 0.34
const GUEST_SPAN = 0.20
const MAX_ARM_LEN = 0.92 // physical reach limit so cylindrical arms never over-elongate
const FRINGE_COUNT = 9
const FRINGE_SEGS = 6
const FRINGE_RADIAL = 6

const smoothstep = (t: number) => {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  return c * c * (3 - 2 * c)
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

/** Pre-allocated closed tapered silk fringe strand updated in-place along a 3D curve. */
function createFringeTube(segments: number, radial: number, material: THREE.Material, name: string, parent: THREE.Object3D) {
  const ringVerts = radial + 1
  const bodyCount = (segments + 1) * ringVerts
  const vertCount = bodyCount + 2 // + start cap center + tip cap center
  const positions = new Float32Array(vertCount * 3)
  const indices: number[] = []
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ringVerts + j
      const b = a + 1
      const c = (i + 1) * ringVerts + j
      const d = c + 1
      // Outward winding for right-handed (tan, norm, binorm) frame: (b - a) x (c - a) points +radial.
      indices.push(a, b, c, b, d, c)
    }
  }
  const startCap = bodyCount
  const endCap = bodyCount + 1
  const endBase = segments * ringVerts
  for (let j = 0; j < radial; j++) {
    indices.push(startCap, j + 1, j)
    indices.push(endCap, endBase + j, endBase + j + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)

  const cosT = new Float32Array(ringVerts)
  const sinT = new Float32Array(ringVerts)
  for (let j = 0; j <= radial; j++) {
    const a = (j / radial) * Math.PI * 2
    cosT[j] = Math.cos(a)
    sinT[j] = Math.sin(a)
  }

  const tan = new THREE.Vector3()
  const norm = new THREE.Vector3()
  const binorm = new THREE.Vector3()
  const refX = new THREE.Vector3(1, 0, 0)
  const refZ = new THREE.Vector3(0, 0, 1)

  function update(pts: readonly THREE.Vector3[], baseRadius: number, tipRadius: number) {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const nPts = pts.length
    for (let i = 0; i < nPts; i++) {
      const p = pts[i]!
      const prev = pts[Math.max(0, i - 1)]!
      const next = pts[Math.min(nPts - 1, i + 1)]!
      tan.subVectors(next, prev)
      if (tan.lengthSq() < 1e-12) tan.set(0, -1, 0)
      else tan.normalize()
      const ref = Math.abs(tan.dot(refX)) < 0.85 ? refX : refZ
      norm.crossVectors(tan, ref).normalize()
      binorm.crossVectors(tan, norm).normalize()
      const u = i / (nPts - 1)
      const r = THREE.MathUtils.lerp(baseRadius, tipRadius, Math.pow(u, 1.35))
      const rowBase = i * ringVerts
      for (let j = 0; j <= radial; j++) {
        const ca = cosT[j]!, sa = sinT[j]!
        posAttr.setXYZ(
          rowBase + j,
          p.x + r * (norm.x * ca + binorm.x * sa),
          p.y + r * (norm.y * ca + binorm.y * sa),
          p.z + r * (norm.z * ca + binorm.z * sa),
        )
      }
    }
    const p0 = pts[0]!, pLast = pts[nPts - 1]!
    posAttr.setXYZ(startCap, p0.x, p0.y, p0.z)
    posAttr.setXYZ(endCap, pLast.x, pLast.y, pLast.z)
    posAttr.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }

  return { mesh, update }
}

/** Ordinary welcoming gift, with a pre-folded khata. The carry feel, palm
 * transfer and giver withdrawal are product choreography, not a prescribed rite. */
export function createKhataModel(options: KhataModelOptions = {}) {
  const root = new THREE.Group(); root.name = 'khata-root'
  const subject = new THREE.Group(); subject.name = 'khata-subject'; root.add(subject)
  const material = (color: number, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness })
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff4db, roughness: .48, vertexColors: true })
  const edgeCream = createRitualMaterial({ color: 0xfff4db, roughness: .48 }, { kind: 'cloth', strength: .10, fiber: false })
  const hem = createRitualMaterial({ color: 0xe1dbc4, roughness: .6 }, { kind: 'cloth', strength: .14, fiber: false })
  const skin = material(0xd7a17e), hair = material(0x584f43), shoe = material(0x555852)
  applyCraftSurface(cream, { kind: 'fabric', strength: .18 })

  const mesh = (name: string, g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], parent: THREE.Object3D = subject) => {
    const o = new THREE.Mesh(g, m); o.name = name; o.castShadow = true; o.receiveShadow = true; parent.add(o); return o
  }
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const ball = (name: string, p: THREE.Vector3, s: [number, number, number], m: THREE.Material) => {
    const o = mesh(name, new THREE.SphereGeometry(1, 20, 12), m); o.position.copy(p); o.scale.set(...s); return o
  }
  const rod = (name: string, r: number, m: THREE.Material, parent: THREE.Object3D = subject) => {
    const o = mesh(name, new THREE.CylinderGeometry(r, r, 1, 12), m, parent)
    const set = (a: THREE.Vector3, b: THREE.Vector3) => {
      const d = b.clone().sub(a)
      o.position.copy(a).add(b).multiplyScalar(.5)
      o.scale.y = d.length()
      o.quaternion.setFromUnitVectors(v(0, 1, 0), d.normalize())
    }
    return { o, set }
  }
  const GROUND_Y = -.072

  // The folded cross-section is a continuous thin C: crease at -x, two open
  // edges at +x facing the arriving guest. End caps make one closed cloth solid.
  const section = [
    [-.085, -.009], [.095, -.009], [.095, -.004], [-.081, -.004], [-.086, 0],
    [-.081, .004], [.095, .004], [.095, .009], [-.085, .009], [-.095, .004], [-.095, -.004],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const N = section.length
  // Classify each section vertex: lower ply (-1), folded crease (0), upper ply (+1).
  const sectionPly = [-1, -1, -1, -1, 0, 1, 1, 1, 1, 0, 0]
  // Soft warm-ivory cel fold shading per cross-section vertex so inner fold & underside read cleanly.
  const sectionShade = [.942, .948, .925, .825, .795, .835, .958, 1.0, .992, .955, .935]

  const vertRing: number[] = []
  const vertSec: number[] = []
  const solidIndices: number[] = []
  const edgeIndices: number[] = []

  for (let j = 0; j < N; j++) {
    const jNext = (j + 1) % N
    const base = vertRing.length
    for (let i = 0; i <= RINGS; i++) {
      vertRing.push(i, i)
      vertSec.push(j, jNext)
    }
    const target = j === 1 || j === 6 ? edgeIndices : solidIndices
    for (let i = 0; i < RINGS; i++) {
      const a = base + i * 2
      const b = a + 1
      const c = base + (i + 1) * 2
      const d = c + 1
      target.push(a, b, c, b, d, c)
    }
  }
  const capTris = THREE.ShapeUtils.triangulateShape(section, [])
  const capStartBase = vertRing.length
  for (let j = 0; j < N; j++) { vertRing.push(0); vertSec.push(j) }
  for (const [a, b, c] of capTris) solidIndices.push(capStartBase + c!, capStartBase + b!, capStartBase + a!)
  const capEndBase = vertRing.length
  for (let j = 0; j < N; j++) { vertRing.push(RINGS); vertSec.push(j) }
  for (const [a, b, c] of capTris) solidIndices.push(capEndBase + a!, capEndBase + b!, capEndBase + c!)

  const clothVertCount = vertRing.length
  const clothPositions = new Float32Array(clothVertCount * 3)
  const clothColors = new Float32Array(clothVertCount * 3)
  const clothGeometry = new THREE.BufferGeometry()
  clothGeometry.setAttribute('position', new THREE.Float32BufferAttribute(clothPositions, 3))
  clothGeometry.setAttribute('color', new THREE.Float32BufferAttribute(clothColors, 3))
  clothGeometry.setIndex([...solidIndices, ...edgeIndices])
  clothGeometry.addGroup(0, solidIndices.length, 0)
  clothGeometry.addGroup(solidIndices.length, edgeIndices.length, 1)

  const scarf = new THREE.Group(); scarf.name = 'khata-scarf'; subject.add(scarf)
  const cloth = mesh('khata-cloth', clothGeometry, [cream, edgeCream], scarf)

  // Multi-segment curved soft silk fringes meet both cloth ends cleanly; no invented sacred symbols.
  const fringes: {
    sign: -1 | 1
    index: number
    xBase: number
    length: number
    plyBias: number
    splayX: number
    tube: ReturnType<typeof createFringeTube>
  }[] = []
  for (const sign of [-1, 1] as const) {
    for (let i = 0; i < FRINGE_COUNT; i++) {
      const xBase = -.08 + i * .02
      const t = createFringeTube(FRINGE_SEGS, FRINGE_RADIAL, hem, `khata-fringe-${sign}-${i}`, scarf)
      const length = .066 + .011 * (.5 + .5 * Math.sin(i * 1.9 + sign * .8))
      const plyBias = i % 2 === 0 ? 1 : -1
      const splayX = (i - 4) * .0016 + .0038 * Math.sin(i * 1.45 + sign * .7)
      fringes.push({ sign, index: i, xBase, length, plyBias, splayX, tube: t })
    }
  }

  // Carry feel (0 at canonical rest checkpoints; live during present carry & palm handoff).
  const carryFeel: KhataCarryFeel = { weight: 0, gather: 0, bridgeSag: 0, bridgeBowX: 0 }
  function resetCarryFeel() {
    carryFeel.weight = 0
    carryFeel.gather = 0
    carryFeel.bridgeSag = 0
    carryFeel.bridgeBowX = 0
  }

  // Constant arc-length resting spine integrator: natural center catenary sag between palms,
  // smooth wrap cleanly over both supporting wrists, and steep weighted silk hang.
  // Responds cleanly to carryFeel (slight weight sag & gentle cradle gather when actively lifted).
  function evalRestingSpine(span: number, outPts: THREE.Vector3[]) {
    const effSpan = THREE.MathUtils.clamp(span + carryFeel.gather, GUEST_SPAN * 0.94, GIVER_SPAN)
    const sPeak = effSpan + .026
    const spanRatio = THREE.MathUtils.clamp((effSpan - GUEST_SPAN) / (GIVER_SPAN - GUEST_SPAN), 0, 1)
    const extraSag = THREE.MathUtils.clamp(carryFeel.bridgeSag, -.016, .036)
    const thetaSag = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(.13, .225, spanRatio) + extraSag * 6.4 + carryFeel.weight * .145,
      .10,
      .60,
    )
    const palmY = THREE.MathUtils.lerp(.031, .035, spanRatio)
    const bendLen = THREE.MathUtils.lerp(.116, .126, spanRatio)
    const thetaHang = THREE.MathUtils.lerp(1.46, 1.40, spanRatio) // deeper vertical hang over guest's narrower span
    const tailTotal = Math.max(.22, HALF_LEN - sPeak)

    const stepsHalf = 96
    const ds = HALF_LEN / stepsHalf
    const halfZ = new Float32Array(stepsHalf + 1)
    const halfY = new Float32Array(stepsHalf + 1)
    let peakY = 0
    for (let k = 1; k <= stepsHalf; k++) {
      const sMid = (k - .5) * ds
      let theta: number
      if (sMid <= sPeak) {
        theta = thetaSag * Math.sin((Math.PI * sMid) / sPeak)
      } else {
        const d = sMid - sPeak
        const uTail = Math.min(1, d / tailTotal)
        const belly = .045 * Math.sin(uTail * Math.PI)
        theta = -thetaHang * (1 - Math.exp(-d / bendLen)) + belly
      }
      halfZ[k] = halfZ[k - 1]! + ds * Math.cos(theta)
      halfY[k] = halfY[k - 1]! + ds * Math.sin(theta)
      if (k * ds >= sPeak && (k - 1) * ds <= sPeak) peakY = halfY[k]!
    }
    const yShift = palmY - peakY
    for (let k = 0; k <= stepsHalf; k++) halfY[k] = halfY[k]! + yShift

    const n = outPts.length
    for (let i = 0; i < n; i++) {
      const s = ((i / (n - 1)) * 2 - 1) * HALF_LEN
      const absS = Math.abs(s)
      const sign = s < 0 ? -1 : 1
      const f = (absS / HALF_LEN) * stepsHalf
      const k0 = Math.min(stepsHalf - 1, Math.floor(f))
      const frac = f - k0
      const z = sign * THREE.MathUtils.lerp(halfZ[k0]!, halfZ[k0 + 1]!, frac)
      const y = THREE.MathUtils.lerp(halfY[k0]!, halfY[k0 + 1]!, frac)
      const bridgeMask = Math.max(0, 1 - (absS / Math.max(.10, sPeak)) ** 2)
      const x = carryFeel.bridgeBowX * bridgeMask
      outPts[i]!.set(x, y, z)
    }
  }

  // Hand underside contact height for supportHeldScarf & pose alignment.
  let activeSpan = GIVER_SPAN
  const drape = (z: number) => {
    const absZ = Math.abs(z)
    if (absZ >= .29) return .032
    if (absZ >= .16) return .028
    return -.012
  }

  // Scratch buffers for zero-allocation in-place cloth & fringe updates.
  const simRestPts: THREE.Vector3[] = Array.from({ length: SIM_N }, () => new THREE.Vector3())
  const simCurrPts: THREE.Vector3[] = Array.from({ length: SIM_N }, () => new THREE.Vector3())
  const restGuardedPts: THREE.Vector3[] = Array.from({ length: SIM_N }, () => new THREE.Vector3())
  const ringCenter: THREE.Vector3[] = Array.from({ length: RINGS + 1 }, () => new THREE.Vector3())
  const ringTangent: THREE.Vector3[] = Array.from({ length: RINGS + 1 }, () => new THREE.Vector3())
  const ringNormal: THREE.Vector3[] = Array.from({ length: RINGS + 1 }, () => new THREE.Vector3())
  const ringGrid = new Float32Array((RINGS + 1) * N * 3)
  const ringShade = new Float32Array((RINGS + 1) * N)
  const fringeCurvePts: THREE.Vector3[] = Array.from({ length: FRINGE_SEGS + 1 }, () => new THREE.Vector3())
  const tailTipVel = [new THREE.Vector3(), new THREE.Vector3()] // [negZ end, posZ end]

  // Four-palm tracking in root-local coordinates for explicit ellipsoidal penetration guards.
  const trackedHandRootPos = [
    new THREE.Vector3(), // giver hand 0 (-z)
    new THREE.Vector3(), // giver hand 1 (+z)
    new THREE.Vector3(), // guest hand 0 (-z)
    new THREE.Vector3(), // guest hand 1 (+z)
  ]
  const localPalms: THREE.Vector3[] = Array.from({ length: 4 }, () => new THREE.Vector3())
  const localPalmActive = [false, false, false, false]
  const tmpHandWorld = new THREE.Vector3()
  const tmpHandInv = new THREE.Matrix4()

  function refreshScarfLocalPalms() {
    root.updateMatrixWorld(true)
    tmpHandInv.copy(scarf.matrixWorld).invert()
    for (let h = 0; h < 4; h++) {
      tmpHandWorld.copy(trackedHandRootPos[h]!).applyMatrix4(root.matrixWorld)
      localPalms[h]!.copy(tmpHandWorld).applyMatrix4(tmpHandInv)
      // Cloth section X spans [-0.095, +0.095], hand X radius is 0.069 -> active if |hx| < 0.172.
      localPalmActive[h] = Math.abs(localPalms[h]!.x) < 0.172
    }
  }

  /**
   * Explicit four-palm ellipsoidal clearance guard (giver L/R + guest L/R).
   * Ensures the folded silk (half-thickness 0.009) rests cleanly ON TOP of supporting palms
   * and drapes strictly outside all four hands/wrists with zero penetration even during overlap.
   */
  function enforceFourPalmClearance(pts: THREE.Vector3[]) {
    refreshScarfLocalPalms()
    const minLocalY = Math.max(-.66, .42 - scarf.position.y)
    for (let i = 0; i < SIM_N; i++) {
      const p = pts[i]!
      const s = ((i / (SIM_N - 1)) * 2 - 1) * HALF_LEN
      for (let h = 0; h < 4; h++) {
        if (!localPalmActive[h]) continue
        const hp = localPalms[h]!
        const hx = hp.x, hy = hp.y, hz = hp.z
        const xOver = Math.max(0, Math.abs(hx) - 0.095)
        const xFactor = Math.sqrt(Math.max(0, 1 - (xOver / 0.077) ** 2))
        if (xFactor <= 0.02) continue
        // Real hand semi-axes are [0.069, 0.047, 0.055]; add cloth half-thickness 0.009 + clearance margin.
        const ry = 0.047 * xFactor + 0.014
        const rz = 0.055 * xFactor + 0.016
        const dy = p.y - hy
        const dz = p.z - hz
        const u = dy / ry
        const vNorm = dz / rz
        if (u * u + vNorm * vNorm < 1) {
          const outSign = hz !== 0 ? (hz > 0 ? 1 : -1) : (s >= 0 ? 1 : -1)
          // Above palm equator or inside span: lift smoothly onto palm top; beside wrist: push cleanly outward in Z.
          if (dy >= -0.014 && Math.abs(p.z) <= Math.abs(hz) + rz * 0.72) {
            const liftY = hy + ry * Math.sqrt(Math.max(0, 1 - vNorm * vNorm))
            if (p.y < liftY) p.y = liftY
          } else {
            const pushZ = hz + outSign * rz * Math.sqrt(Math.max(0, 1 - u * u))
            if (outSign * p.z < outSign * pushZ) p.z = pushZ
          }
        }
      }
      if (p.y < minLocalY) p.y = minLocalY
    }
  }

  function writeClothAndFringes(
    spinePts: readonly THREE.Vector3[],
    span: number,
    phaseClock: number,
    allowDynamicX: boolean,
  ) {
    // 1. Sample smooth 57-ring centerline via Catmull-Rom through the 25 spine nodes.
    for (let i = 0; i <= RINGS; i++) {
      const f = (i / RINGS) * (SIM_N - 1)
      const i1 = Math.min(SIM_N - 2, Math.floor(f))
      const t = f - i1
      const i0 = Math.max(0, i1 - 1)
      const i2 = i1 + 1
      const i3 = Math.min(SIM_N - 1, i1 + 2)
      const p0 = spinePts[i0]!, p1 = spinePts[i1]!, p2 = spinePts[i2]!, p3 = spinePts[i3]!
      ringCenter[i]!.set(
        allowDynamicX ? catmullRom(p0.x, p1.x, p2.x, p3.x, t) : 0,
        catmullRom(p0.y, p1.y, p2.y, p3.y, t),
        catmullRom(p0.z, p1.z, p2.z, p3.z, t),
      )
    }

    // 2. Compute smooth 2D/3D frame (tangent along ribbon, outward surface normal perpendicular to +X).
    for (let i = 0; i <= RINGS; i++) {
      const prev = ringCenter[Math.max(0, i - 1)]!
      const next = ringCenter[Math.min(RINGS, i + 1)]!
      const tan = ringTangent[i]!.subVectors(next, prev)
      if (tan.lengthSq() < 1e-12) tan.set(0, 0, 1)
      else tan.normalize()
      const n = ringNormal[i]!.set(0, tan.z, -tan.y)
      if (n.lengthSq() < 1e-12) n.set(0, 1, 0)
      else n.normalize()
    }

    // 3. Evaluate all (RINGS + 1) * N cross-section vertices with organic folded silk layer separation & drape.
    const sPeak = span + .008
    for (let i = 0; i <= RINGS; i++) {
      const s = ((i / RINGS) * 2 - 1) * HALF_LEN
      const absS = Math.abs(s)
      const sign = s < 0 ? -1 : 1
      const tailFrac = smoothstep((absS - sPeak) / Math.max(.18, HALF_LEN - sPeak))
      const centerDipMask = Math.max(0, 1 - (absS / Math.max(.12, sPeak)) ** 2)
      const c = ringCenter[i]!
      const n = ringNormal[i]!

      for (let j = 0; j < N; j++) {
        const sp = section[j]!
        const ply = sectionPly[j]!
        const openWeight = THREE.MathUtils.clamp((sp.x + .086) / (.095 + .086), 0, 1)
        const uX = (sp.x + .095) / .190

        const layerPart = .0082 * Math.pow(tailFrac, 1.25) * (.70 + .30 * Math.sin(tailFrac * Math.PI * 1.35))
        const plyOffset = ply > 0 ? layerPart * openWeight : ply < 0 ? -layerPart * openWeight * .72 : 0

        const foldWave = Math.pow(tailFrac, 1.25) * (
          .0095 * Math.sin(tailFrac * 4.1 + uX * 2.15 + sign * .65 + phaseClock * .45) +
          .0045 * Math.cos(tailFrac * 6.8 - uX * 2.6 + sign * .3)
        )
        const camber = -.0048 * (1 - (2 * uX - 1) ** 2) * Math.pow(tailFrac, 1.1)
        // Subtle silk trough shading & softness across the suspended bridge when feeling weight.
        const bridgeSoftness = -.0035 * centerDipMask * (1 - (2 * uX - 1) ** 2) * carryFeel.weight
        const normalDisp = sp.y + plyOffset + foldWave + camber + bridgeSoftness

        // Only apply dynamic lateral X swing on active physics or carried bridge; resting X stays exact sp.x (0.095).
        const dynamicXMask = allowDynamicX ? Math.max(Math.pow(tailFrac, 1.15), centerDipMask * 0.45 * carryFeel.weight) : 0
        const x = sp.x + c.x * dynamicXMask
        const y = c.y + n.y * normalDisp
        const z = c.z + n.z * normalDisp

        const idx = (i * N + j) * 3
        ringGrid[idx] = x
        ringGrid[idx + 1] = y
        ringGrid[idx + 2] = z

        const waveShade = 1 + THREE.MathUtils.clamp(foldWave * 2.8, -.032, .028)
        const sagShade = 1 - (.028 + .022 * carryFeel.weight) * centerDipMask * (ply > 0 ? 1 : .4)
        ringShade[i * N + j] = THREE.MathUtils.clamp(sectionShade[j]! * waveShade * sagShade, .75, 1.0)
      }
    }

    // 4. Write into the strip-split cloth geometry in-place.
    const posAttr = clothGeometry.getAttribute('position') as THREE.BufferAttribute
    const colAttr = clothGeometry.getAttribute('color') as THREE.BufferAttribute
    for (let k = 0; k < clothVertCount; k++) {
      const rIdx = vertRing[k]!
      const sIdx = vertSec[k]!
      const src = (rIdx * N + sIdx) * 3
      posAttr.setXYZ(k, ringGrid[src]!, ringGrid[src + 1]!, ringGrid[src + 2]!)
      const sh = ringShade[rIdx * N + sIdx]!
      colAttr.setXYZ(k, sh, sh, sh)
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    clothGeometry.computeVertexNormals()
    clothGeometry.computeBoundingBox()
    clothGeometry.computeBoundingSphere()

    // 5. Update all 18 multi-segment curved soft silk fringes anchored cleanly to both cloth ends.
    for (const f of fringes) {
      const ringIdx = f.sign < 0 ? 0 : RINGS
      const endC = ringCenter[ringIdx]!
      const endN = ringNormal[ringIdx]!
      const endT = ringTangent[ringIdx]!
      const tx = f.sign < 0 ? -endT.x : endT.x
      const ty = f.sign < 0 ? -endT.y : endT.y
      const tz = f.sign < 0 ? -endT.z : endT.z
      const vel = f.sign < 0 ? tailTipVel[0]! : tailTipVel[1]!
      const openWeight = THREE.MathUtils.clamp((f.xBase + .086) / (.095 + .086), 0, 1)
      const rootOffsetN = f.plyBias * (.0042 + .0045 * openWeight)
      const rootX = f.xBase + (allowDynamicX ? endC.x : 0)
      const rootY = endC.y + endN.y * rootOffsetN
      const rootZ = endC.z + endN.z * rootOffsetN

      for (let s = 0; s <= FRINGE_SEGS; s++) {
        const u = s / FRINGE_SEGS
        const u2 = u * u
        const blendGrav = smoothstep(u * 1.15)
        const dirX = THREE.MathUtils.lerp(tx, 0, blendGrav) + f.splayX * 2.8 * u
        const dirY = THREE.MathUtils.lerp(ty, -1, blendGrav)
        const dirZ = THREE.MathUtils.lerp(tz, f.sign * .06, blendGrav)
        const dLen = Math.hypot(dirX, dirY, dirZ) || 1
        const trailX = allowDynamicX ? THREE.MathUtils.clamp(-vel.x * .042, -.038, .038) * u2 : 0
        const trailZ = allowDynamicX ? THREE.MathUtils.clamp(-vel.z * .030, -.028, .028) * u2 : 0
        const flutter = allowDynamicX
          ? .0055 * Math.sin(phaseClock * 2.4 + f.index * .72 + f.sign * 1.2) * u2
          : .0028 * Math.sin(f.index * 1.35 + f.sign) * u2
        const px = rootX + (dirX / dLen) * f.length * u + trailX + flutter * .65
        const py = rootY + (dirY / dLen) * f.length * u
        const pz = rootZ + (dirZ / dLen) * f.length * u + trailZ + flutter
        fringeCurvePts[s]!.set(px, py, pz)
      }
      f.tube.update(fringeCurvePts, .0034, .0020)
    }
  }

  // ---------------------------------------------------------------------------
  // Lazy-loaded Rapier soft-body simulation for the folded silk spine
  // (25-particle custom rope in scarf-local space with four-palm support forces,
  // unlocked center bridge weight sag, D'Alembert carry/handover inertia, and breeze).
  // Constructor NEVER loads WASM; reducedMotion NEVER loads WASM.
  // ---------------------------------------------------------------------------
  let spineBody: ReturnType<RapierSoftBodySession['createCustomRope']> | null = null
  let rapierReady = false
  let physicsActive = false
  let simClock = 0
  let disposed = false
  const prevScarfWorld = new THREE.Vector3()
  const prevScarfVel = new THREE.Vector3()
  const currScarfWorld = new THREE.Vector3()
  const currScarfVel = new THREE.Vector3()
  const scarfAccel = new THREE.Vector3()
  let hasPrevWorld = false

  function syncRestSpine(span: number) {
    activeSpan = span
    evalRestingSpine(span, simRestPts)
  }

  function resetPhysicsParticlesToRest() {
    if (!spineBody || !spineBody.isValid()) return
    for (let i = 0; i < SIM_N; i++) {
      const r = simRestPts[i]!
      spineBody.setParticlePosition(i, { x: r.x, y: r.y, z: r.z })
      spineBody.setParticleVelocity(i, { x: 0, y: 0, z: 0 })
    }
    tailTipVel[0]!.set(0, 0, 0)
    tailTipVel[1]!.set(0, 0, 0)
    hasPrevWorld = false
    scarfAccel.set(0, 0, 0)
    prevScarfVel.set(0, 0, 0)
  }

  function writeRestingGeometry() {
    tailTipVel[0]!.set(0, 0, 0)
    tailTipVel[1]!.set(0, 0, 0)
    for (let i = 0; i < SIM_N; i++) restGuardedPts[i]!.copy(simRestPts[i]!)
    enforceFourPalmClearance(restGuardedPts)
    writeClothAndFringes(restGuardedPts, activeSpan, 0, false)
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 8,
    internalPgsIterations: 2,
    sleepSpeedThreshold: 0,
    sleepTimeRequired: 1,
    isActive: () => !disposed && (options.isActive ? options.isActive() : true),
    isReducedMotion: () => (options.isReducedMotion ? options.isReducedMotion() : false),
    onReady(session) {
      if (disposed) return
      syncRestSpine(activeSpan)
      spineBody = session.createCustomRope({
        points: simRestPts.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        closed: false,
        bending: true,
        wireCollision: false,
        particleMass: 0.028,
        particleRadius: 0.015,
        linearDamping: 2.7,
        gravityScale: 0.45,
        edgeSoftness: { naturalFrequency: 56, dampingRatio: 0.92 },
        bendSoftness: { naturalFrequency: 7.5, dampingRatio: 0.68 },
        pinnedParticles: [12],
        canSleep: false,
        noSurfaceCollider: true,
      })
      rapierReady = true
      resetPhysicsParticlesToRest()
      host.settle(16, applySpineForces)
      if (!options.isReducedMotion?.()) {
        physicsActive = true
        syncFromRapier()
      }
    },
  })

  function applySpineForces(_session: RapierSoftBodySession, subDt: number) {
    if (!spineBody || !spineBody.isValid()) return
    simClock += subDt
    const t = simClock
    const pos = spineBody.particlePositions()
    const vel = spineBody.particleVelocities()
    const pMass = Math.max(spineBody.mass() / SIM_N, 1e-4)
    const effSpan = THREE.MathUtils.clamp(activeSpan + carryFeel.gather, GUEST_SPAN * 0.94, GIVER_SPAN)
    const sPeak = effSpan + .026

    refreshScarfLocalPalms()
    spineBody.resetForces(false)
    // Center bridge anchor tracks the catenary midpoint (including live carry weight sag).
    const cRest = simRestPts[12]!
    const centerInertiaY = THREE.MathUtils.clamp(-scarfAccel.y * 0.0028, -0.018, 0.014) * carryFeel.weight
    spineBody.setParticleKinematicTarget(12, { x: cRest.x, y: cRest.y + centerInertiaY, z: cRest.z })

    for (let i = 0; i < SIM_N; i++) {
      if (i === 12) continue
      const s = ((i / (SIM_N - 1)) * 2 - 1) * HALF_LEN
      const absS = Math.abs(s)
      const sign = s < 0 ? -1 : 1
      const r = simRestPts[i]!
      const px = pos[i * 3]!, py = pos[i * 3 + 1]!, pz = pos[i * 3 + 2]!
      const vx = vel[i * 3]!, vy = vel[i * 3 + 1]!, vz = vel[i * 3 + 2]!

      // Palm-localized support stiffness: firm directly over the supporting palms, softer across
      // the suspended silk bridge between palms so carrying & weight transfer feel alive.
      const palmDist = Math.abs(absS - effSpan)
      const palmSeat = Math.exp(-(palmDist * palmDist) / (2 * 0.055 * 0.055))
      const bridgeInterior = absS < effSpan ? Math.max(0, 1 - palmSeat) : 0
      const supportMask = Math.max(palmSeat, (1 - smoothstep((absS - sPeak) / .085)) * (1 - 0.55 * bridgeInterior))
      const tailMask = smoothstep((absS - sPeak) / Math.max(.18, HALF_LEN - sPeak))

      const kXZ = 520 * supportMask + 26 * (1 - supportMask)
      const kY = 520 * supportMask + 68 * (1 - supportMask)
      const kDamp = 30 * supportMask + 4.2 * (1 - supportMask)
      let ax = (r.x - px) * kXZ - vx * kDamp
      let ay = (r.y - py) * kY - vy * kDamp
      let az = (r.z - pz) * kXZ - vz * kDamp

      // Keep the silk smoothly resting ON TOP of all four active palms during carry & overlap.
      for (let h = 0; h < 4; h++) {
        if (!localPalmActive[h]) continue
        const hp = localPalms[h]!
        const dz = pz - hp.z
        if (Math.abs(dz) < 0.085) {
          const topY = hp.y + 0.062 * Math.sqrt(Math.max(0, 1 - (dz / 0.085) ** 2))
          if (py < topY) ay += (topY - py) * 950
        }
      }

      // Suspended bridge between palms responds to upward/forward carry acceleration (felt weight!).
      if (bridgeInterior > 0.05 && carryFeel.weight > 0.01) {
        const w = bridgeInterior * carryFeel.weight
        ay -= THREE.MathUtils.clamp(scarfAccel.y, -10, 10) * 0.55 * w
        ax -= THREE.MathUtils.clamp(scarfAccel.x, -10, 10) * 0.35 * w
      }

      // Free hanging tails feel real D'Alembert carry/handover inertia + gentle sunlit courtyard silk breath.
      if (tailMask > 0) {
        const inertiaGain = 1.05 * Math.pow(tailMask, 1.08)
        ax -= THREE.MathUtils.clamp(scarfAccel.x, -12, 12) * inertiaGain
        ay -= THREE.MathUtils.clamp(scarfAccel.y, -10, 10) * inertiaGain * .48
        az -= THREE.MathUtils.clamp(scarfAccel.z, -12, 12) * inertiaGain

        const wave = Math.sin(t * 1.55 - tailMask * 2.1 + sign * .85)
        const gust = Math.cos(t * 2.45 + tailMask * 1.6 - sign * .55)
        ax += (.85 + 1.05 * wave + .38 * gust) * Math.pow(tailMask, 1.2)
        az += (.42 * Math.sin(t * 1.25 + tailMask * 1.9 + sign * .4) + .45 * sign) * Math.pow(tailMask, 1.25)
      }

      spineBody.addParticleForce(i, { x: ax * pMass, y: ay * pMass, z: az * pMass }, false)
    }
  }

  function syncFromRapier() {
    if (!spineBody || !spineBody.isValid()) return
    const pos = spineBody.particlePositions()
    const vel = spineBody.particleVelocities()
    const effSpan = THREE.MathUtils.clamp(activeSpan + carryFeel.gather, GUEST_SPAN * 0.94, GIVER_SPAN)
    const sPeak = effSpan + .026

    for (let i = 0; i < SIM_N; i++) {
      const s = ((i / (SIM_N - 1)) * 2 - 1) * HALF_LEN
      const absS = Math.abs(s)
      const tailMask = smoothstep((absS - sPeak) / Math.max(.18, HALF_LEN - sPeak))
      const r = simRestPts[i]!
      const palmDist = Math.abs(absS - effSpan)
      const palmSeat = Math.exp(-(palmDist * palmDist) / (2 * 0.052 * 0.052))
      const bridgeInterior = absS < effSpan ? Math.max(0, 1 - palmSeat) : 0

      // Unlock the suspended bridge between palms while keeping palm contact patches crisp.
      const baseLock = 1 - smoothstep((absS - (sPeak + .01)) / .075)
      const yzLock = Math.max(palmSeat * 0.90, baseLock * (1 - bridgeInterior * (0.48 + 0.34 * carryFeel.weight)))
      const xMask = Math.max(tailMask, bridgeInterior * 0.40 * carryFeel.weight)

      let x = THREE.MathUtils.clamp(pos[i * 3]!, -.068, .068) * xMask
      let y = pos[i * 3 + 1]!
      let z = pos[i * 3 + 2]!
      x = THREE.MathUtils.lerp(x, r.x, palmSeat * 0.92)
      y = THREE.MathUtils.lerp(y, r.y, yzLock)
      z = THREE.MathUtils.lerp(z, r.z, yzLock)
      simCurrPts[i]!.set(x, y, z)
    }

    // Explicit four-palm ellipsoidal clearance + floor guard across all 4 hands.
    enforceFourPalmClearance(simCurrPts)

    tailTipVel[0]!.set(vel[0]!, vel[1]!, vel[2]!)
    const last = (SIM_N - 1) * 3
    tailTipVel[1]!.set(vel[last]!, vel[last + 1]!, vel[last + 2]!)
    writeClothAndFringes(simCurrPts, effSpan, simClock, true)
  }

  const people = [
    { name: 'giver', x: -.83, dir: 1, color: 0xc18b56 },
    { name: 'guest', x: .83, dir: -1, color: 0x6b9a91 },
  ].map(({ name, x, dir, color }, personIdx) => {
    const coat = material(color), pants = material(name === 'giver' ? 0x667c85 : 0x828371)
    applyCraftSurface(coat, { kind: 'fabric', strength: .26 })
    applyCraftSurface(pants, { kind: 'fabric', strength: .26 })

    const body = ball('khata-' + name + '-jacket', v(x, .84, 0), [.17, .30, .22], coat)
    const neck = rod('khata-' + name + '-neck', .068, skin); neck.set(v(x, 1.04, 0), v(x, 1.19, 0))
    const head = ball('khata-' + name + '-head', v(x, 1.31, 0), [.13, .17, .14], skin)
    const hairMesh = ball('khata-' + name + '-hair', v(x - dir * .025, 1.37, 0), [.13, .12, .143], hair)
    const nose = ball('khata-' + name + '-nose', v(x + dir * .13, 1.30, 0), [.04, .035, .035], skin)
    const arms = [-1, 1].map((sign, i) => ({
      shoulder: v(x, 1.02, sign * .20),
      upper: rod('khata-' + name + '-upper-' + i, .061, coat),
      lower: rod('khata-' + name + '-lower-' + i, .035, coat),
      hand: ball('khata-' + name + '-hand-' + i, v(0, 0, 0), [.069, .047, .055], skin),
    }))
    const feet = [-1, 1].map((sign, i) => {
      const upper = rod('khata-' + name + '-thigh-' + i, .075, pants)
      const lower = rod('khata-' + name + '-shin-' + i, .063, pants)
      upper.set(v(x, .58, sign * .12), v(x, .275, sign * .12))
      lower.set(v(x, .275, sign * .12), v(x, GROUND_Y + .075, sign * .12))
      return ball('khata-' + name + '-shoe-' + i, v(x + dir * .035, GROUND_Y + .055, sign * .12), [.13, .055, .085], shoe)
    })
    const setHands = (points: THREE.Vector3[]) => arms.forEach((arm, i) => {
      const end = points[i]!.clone()
      // Cap physical reach so large drags never elongate the cylindrical arms unrealistically.
      const toEnd = end.clone().sub(arm.shoulder)
      const reach = toEnd.length()
      if (reach > MAX_ARM_LEN) {
        toEnd.multiplyScalar(MAX_ARM_LEN / reach)
        end.copy(arm.shoulder).add(toEnd)
      }
      const ext = THREE.MathUtils.clamp(toEnd.length() / MAX_ARM_LEN, 0, 1)
      const elbow = arm.shoulder.clone().lerp(end, .48)
      elbow.y -= THREE.MathUtils.lerp(.12, .055, ext * ext)
      elbow.z += (i ? 1 : -1) * THREE.MathUtils.lerp(.07, .042, ext * ext)
      arm.upper.set(arm.shoulder, elbow)
      arm.lower.set(elbow, end)
      arm.hand.position.copy(end)
      trackedHandRootPos[personIdx * 2 + i]!.copy(end)
    })
    return { name, x, dir, body, head, hair: hairMesh, nose, arms, feet, setHands }
  })

  const support = (x: number, y: number, z: number) => v(x, y + drape(z) - .055, z)

  /**
   * Clamps a dragged scarf world/root position into natural giver reach while preserving
   * exact 1:1 tracking for normal presentation moves and preventing ground contact or neck drape.
   */
  function clampCarryPosition(pos: THREE.Vector3, isHandoff: boolean) {
    if (isHandoff) {
      pos.x = THREE.MathUtils.clamp(pos.x, -0.08, 0.37)
      pos.y = THREE.MathUtils.clamp(pos.y, 0.96, 1.30)
      pos.z = THREE.MathUtils.clamp(pos.z, -0.22, 0.22)
      return
    }
    pos.x = THREE.MathUtils.clamp(pos.x, -0.68, 0.14)
    pos.y = THREE.MathUtils.clamp(pos.y, 0.84, 1.32)
    pos.z = THREE.MathUtils.clamp(pos.z, -0.34, 0.34)
    // Ensure both giver hands stay cleanly within MAX_ARM_LEN (0.90m safe carry envelope) of shoulders.
    const giverShoulderX = -0.83, giverShoulderY = 1.02
    const handX = pos.x - 0.035
    const handY = pos.y + drape(GIVER_SPAN) - 0.055
    const maxHandZ = Math.abs(pos.z) + GIVER_SPAN
    const dz = Math.max(0, maxHandZ - 0.20)
    const dist = Math.hypot(handX - giverShoulderX, handY - giverShoulderY, dz)
    const maxCarryReach = 0.895
    if (dist > maxCarryReach) {
      const scale = maxCarryReach / dist
      pos.x = giverShoulderX + (handX - giverShoulderX) * scale + 0.035
      pos.y = Math.max(0.84, giverShoulderY + (handY - giverShoulderY) * scale - (drape(GIVER_SPAN) - 0.055))
      pos.z *= scale
    }
  }

  /** Sets live carry weight feel during active presentation carry (`at < 2`). */
  function setCarryFeel(feel: Partial<KhataCarryFeel>) {
    if (feel.weight !== undefined) carryFeel.weight = THREE.MathUtils.clamp(feel.weight, 0, 1)
    if (feel.gather !== undefined) carryFeel.gather = THREE.MathUtils.clamp(feel.gather, -.030, .005)
    if (feel.bridgeSag !== undefined) carryFeel.bridgeSag = THREE.MathUtils.clamp(feel.bridgeSag, -.016, .036)
    if (feel.bridgeBowX !== undefined) carryFeel.bridgeBowX = THREE.MathUtils.clamp(feel.bridgeBowX, -.045, .045)
    syncRestSpine(activeSpan)
    if (!physicsActive) writeRestingGeometry()
  }

  /**
   * Drives live interactive palm handoff (`at === 2`) as the player guides the white silk
   * from the presentation hold into the guest's rising open palms (product choreography).
   */
  function setInteractiveHandoff(pRaw: number, carrySag = 0) {
    const p = THREE.MathUtils.clamp(pRaw, 0, 1)
    const scarfX = scarf.position.x, scarfY = scarf.position.y, scarfZ = scarf.position.z
    const giver = people[0]!, guest = people[1]!

    // Guest palms rise smoothly from rest to meet directly beneath the approaching silk at ±GUEST_SPAN.
    const guestMeet = smoothstep(p / 0.62)
    guest.setHands([-1, 1].map((sign) =>
      v(.46, .82, sign * GUEST_SPAN).lerp(
        v(scarfX + .035, scarfY + drape(GUEST_SPAN) - .055, scarfZ + sign * GUEST_SPAN),
        guestMeet,
      ),
    ))

    // Giver palms accompany within natural reach and gently soften downward once guest palms are underneath.
    const giverYield = smoothstep((p - 0.56) / 0.44)
    const giverX = Math.min(scarfX - .035, 0.05) - 0.03 * giverYield
    giver.setHands([-1, 1].map((sign) =>
      v(
        giverX,
        scarfY + drape(GIVER_SPAN) - .055 - 0.042 * giverYield,
        scarfZ + sign * GIVER_SPAN,
      ),
    ))

    // Weight transfer begins naturally as silk settles onto guest's inner palms.
    const liveSpanBlend = smoothstep((p - 0.36) / 0.64) * 0.45
    const targetSpan = THREE.MathUtils.lerp(GIVER_SPAN, GUEST_SPAN, liveSpanBlend)
    carryFeel.weight = 0.55 * (1 - 0.4 * giverYield)
    carryFeel.gather = -0.012 * Math.sin(Math.PI * p)
    carryFeel.bridgeSag = THREE.MathUtils.clamp(0.012 * Math.sin(Math.PI * p) + carrySag, -.014, .032)
    carryFeel.bridgeBowX = 0.014 * Math.sin(Math.PI * p)
    syncRestSpine(targetSpan)
    root.updateMatrixWorld(true)
    if (!physicsActive) writeRestingGeometry()
  }

  /**
   * Smooth palm-settle & giver-withdrawal choreography after the scarf reaches the guest's hands.
   * Starts seamlessly from the held scarf position and span, dips giver palms cleanly out from under
   * the silk, and lets the constant-length silk cascade deeper over the guest's wrists.
   */
  function setHandoffSettle(
    tRaw: number,
    fromPos: THREE.Vector3,
    fromSpan: number,
    fromGiverHands: readonly THREE.Vector3[],
    fromGuestHands: readonly THREE.Vector3[],
  ) {
    const t = THREE.MathUtils.clamp(tRaw, 0, 1)
    const destPos = v(.35, 1.16, 0)
    const seatT = smoothstep(t / 0.32)
    scarf.position.lerpVectors(fromPos, destPos, seatT)
    scarf.quaternion.slerp(new THREE.Quaternion(), seatT)
    const scarfX = scarf.position.x, scarfY = scarf.position.y

    const giver = people[0]!, guest = people[1]!
    // Guest hands firmly settle at ±GUEST_SPAN beneath the scarf.
    guest.setHands([-1, 1].map((sign, idx) =>
      fromGuestHands[idx]!.clone().lerp(support(scarfX + .035, scarfY, sign * GUEST_SPAN), smoothstep(t / 0.28)),
    ))

    // Giver hands steady during overlap (0..0.28), then dip cleanly down and withdraw back to (-0.39, 0.84).
    const withdrawT = smoothstep((t - 0.24) / 0.76)
    const dipArc = -0.062 * Math.sin(Math.PI * withdrawT)
    giver.setHands([-1, 1].map((sign, idx) => {
      const startH = fromGiverHands[idx]!
      const endH = v(-.39, .84, sign * GIVER_SPAN)
      const p = startH.clone().lerp(endH, withdrawT)
      p.y += dipArc
      return p
    }))

    // Support span transitions smoothly to GUEST_SPAN as giver palms release, cascading tails deeper.
    const spanT = smoothstep((t - 0.20) / 0.64)
    const targetSpan = THREE.MathUtils.lerp(fromSpan, GUEST_SPAN, spanT)
    const fadeFeel = 1 - smoothstep((t - 0.65) / 0.35)
    carryFeel.weight = 0.45 * fadeFeel
    carryFeel.gather = 0
    carryFeel.bridgeSag = 0.014 * Math.sin(Math.PI * spanT) * fadeFeel
    carryFeel.bridgeBowX = 0
    syncRestSpine(targetSpan)
    root.updateMatrixWorld(true)
    if (!physicsActive) writeRestingGeometry()
  }

  const pose = (step: number, amount: number) => {
    const n = Number.isFinite(step) ? THREE.MathUtils.clamp(Math.floor(step), 0, 3) : 0
    const t = Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, 0, 1) : 0
    const lift = n === 0 ? t : 1, extend = n === 1 ? t : n > 1 ? 1 : 0, receive = n === 2 ? t : n > 2 ? 1 : 0
    const move = .12 * receive + .88 * THREE.MathUtils.clamp((receive - .22) / .78, 0, 1)
    const scarfX = -.35 + .35 * extend + .35 * move, scarfY = .92 + .24 * lift
    scarf.position.set(scarfX, scarfY, 0)
    scarf.quaternion.identity()

    // Reset carry feel cleanly at canonical pose boundaries (t === 0 or t === 1), while adding
    // subtle silk sag during scripted transitions (e.g. auxiliary button playback).
    const midMotion = Math.sin(Math.PI * t)
    if (n === 0 || n === 1) {
      carryFeel.weight = 0.65 * midMotion
      carryFeel.gather = -0.016 * midMotion
      carryFeel.bridgeSag = 0.016 * midMotion
      carryFeel.bridgeBowX = n === 1 ? 0.014 * midMotion : 0
    } else if (n === 2) {
      carryFeel.weight = 0.45 * midMotion
      carryFeel.gather = -0.010 * midMotion
      carryFeel.bridgeSag = 0.014 * midMotion
      carryFeel.bridgeBowX = 0
    } else {
      resetCarryFeel()
    }

    const handoverBlend = smoothstep((receive - .26) / .56)
    const targetSpan = THREE.MathUtils.lerp(GIVER_SPAN, GUEST_SPAN, handoverBlend)

    const giver = people[0]!, guest = people[1]!
    const withdrawT = receive <= .30 ? 0 : (receive - .30) / .70
    const holdX = Math.min(scarfX - .035, 0.05)
    const giverX = receive <= .30 ? holdX : THREE.MathUtils.lerp(holdX, -.39, withdrawT)
    const dipArc = -0.055 * Math.sin(Math.PI * withdrawT)
    giver.setHands([-1, 1].map((sign) => {
      const p = support(giverX, scarfY, sign * GIVER_SPAN)
      if (receive > .30) p.y = THREE.MathUtils.lerp(p.y, .84, withdrawT) + dipArc
      return p
    }))
    const meet = THREE.MathUtils.clamp(receive / .24, 0, 1)
    guest.setHands([-1, 1].map((sign) => v(.46, .82, sign * GUEST_SPAN).lerp(support(scarfX + .035, scarfY, sign * GUEST_SPAN), meet)))

    syncRestSpine(targetSpan)
    root.updateMatrixWorld(true)
    if (!physicsActive) {
      writeRestingGeometry()
    }
  }

  function startPhysics() {
    if (disposed || options.isReducedMotion?.()) return Promise.resolve(null)
    return host.start()
  }

  function stepPhysics(dt: number) {
    if (disposed || !rapierReady) return false
    if (options.isReducedMotion?.()) {
      if (physicsActive) calm()
      return false
    }
    const clamped = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
    if (clamped <= 0) return false
    scarf.updateWorldMatrix(true, false)
    scarf.getWorldPosition(currScarfWorld)
    if (hasPrevWorld) {
      currScarfVel.subVectors(currScarfWorld, prevScarfWorld).divideScalar(clamped)
      scarfAccel.subVectors(currScarfVel, prevScarfVel).divideScalar(clamped)
      scarfAccel.clampLength(0, 14)
      prevScarfVel.copy(currScarfVel)
    } else {
      hasPrevWorld = true
      prevScarfVel.set(0, 0, 0)
      scarfAccel.set(0, 0, 0)
    }
    prevScarfWorld.copy(currScarfWorld)

    if (!physicsActive) {
      physicsActive = true
      resetPhysicsParticlesToRest()
      host.wakeUp()
    }
    const stepped = host.step(clamped, applySpineForces, () => syncFromRapier())
    return stepped
  }

  function calm() {
    physicsActive = false
    resetCarryFeel()
    syncRestSpine(activeSpan)
    resetPhysicsParticlesToRest()
    writeRestingGeometry()
  }

  function dispose() {
    if (disposed) return
    disposed = true
    physicsActive = false
    rapierReady = false
    spineBody = null
    host.dispose()
  }

  pose(0, 0)
  return {
    root,
    subject,
    scarf,
    cloth,
    people,
    drape,
    targets: [scarf, scarf, scarf],
    roots: [scarf, scarf, scarf],
    anchors: [[0, .025, 0], [0, .025, 0], [0, .025, 0]] as [number, number, number][],
    pose,
    clampCarryPosition,
    setCarryFeel,
    resetCarryFeel,
    setInteractiveHandoff,
    setHandoffSettle,
    get activeSpan() { return activeSpan },
    getHandPositions() {
      return {
        giver: [trackedHandRootPos[0]!.clone(), trackedHandRootPos[1]!.clone()] as [THREE.Vector3, THREE.Vector3],
        guest: [trackedHandRootPos[2]!.clone(), trackedHandRootPos[3]!.clone()] as [THREE.Vector3, THREE.Vector3],
      }
    },
    startPhysics,
    stepPhysics,
    calm,
    get rapierReady() { return rapierReady },
    dispose,
  }
}
