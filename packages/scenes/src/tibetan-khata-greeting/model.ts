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

const RINGS = 56
const SIM_N = 25 // symmetric spine: index 12 is center (s = 0), 0..11 & 13..24 are the two halves
const HALF_LEN = 0.78 // constant total folded scarf arc length = 1.56
const GIVER_SPAN = 0.34
const GUEST_SPAN = 0.20
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

/** Ordinary welcoming gift, with a pre-folded khata. The transfer is a product
 * sequence, not a prescribed three-part rite or a teacher's blessing. */
export function createKhataModel(options: KhataModelOptions = {}) {
  const root = new THREE.Group(); root.name = 'khata-root'
  const subject = new THREE.Group(); subject.name = 'khata-subject'; root.add(subject)
  const material = (color: number, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness })
  const stone = material(0xd3cbb3)
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff4db, roughness: .48, vertexColors: true })
  const edgeCream = createRitualMaterial({ color: 0xfff4db, roughness: .48 }, { kind: 'cloth', strength: .10, fiber: false })
  const hem = createRitualMaterial({ color: 0xe1dbc4, roughness: .6 }, { kind: 'cloth', strength: .14, fiber: false })
  const skin = material(0xd7a17e), hair = material(0x584f43), shoe = material(0x555852)
  applyCraftSurface(cream, { kind: 'fabric', strength: .18 })
  applyCraftSurface(stone, { kind: 'stone', strength: .4 })

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
  const ground = mesh('khata-ground', new THREE.CylinderGeometry(1.37, 1.42, .08, 64), stone)
  ground.scale.z = .8; ground.position.y = -.04

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

  // Build strip-split closed cloth geometry: vertices are shared along the ribbon length (smooth drape
  // normals!) while split cleanly across the 11 thin folded edges (sharp, never-inverted crease normals!).
  // Only the two free +x section edges (j === 1 and j === 6) use materialIndex 1 (edgeCream).
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
      // Organic strand-to-strand silk length & subtle natural splay (never uniform toothpicks).
      const length = .066 + .011 * (.5 + .5 * Math.sin(i * 1.9 + sign * .8))
      const plyBias = i % 2 === 0 ? 1 : -1
      const splayX = (i - 4) * .0016 + .0038 * Math.sin(i * 1.45 + sign * .7)
      fringes.push({ sign, index: i, xBase, length, plyBias, splayX, tube: t })
    }
  }

  // Constant arc-length resting spine integrator: natural center catenary sag between palms,
  // smooth wrap cleanly over both supporting wrists (zero palm clipping), and steep weighted silk hang.
  function evalRestingSpine(span: number, outPts: THREE.Vector3[]) {
    const sPeak = span + .026
    const spanRatio = THREE.MathUtils.clamp((span - GUEST_SPAN) / (GIVER_SPAN - GUEST_SPAN), 0, 1)
    const thetaSag = THREE.MathUtils.lerp(.13, .225, spanRatio)
    const palmY = THREE.MathUtils.lerp(.029, .033, spanRatio)
    const bendLen = THREE.MathUtils.lerp(.118, .126, spanRatio)
    const thetaHang = THREE.MathUtils.lerp(1.45, 1.40, spanRatio) // ~80..83 deg steep silk gravity hang
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
        // Smooth monotonic drape from palm wrap to clean vertical hem (no bottom hockey-stick flare).
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
      const sign = s < 0 ? -1 : 1
      const f = (Math.abs(s) / HALF_LEN) * stepsHalf
      const k0 = Math.min(stepsHalf - 1, Math.floor(f))
      const frac = f - k0
      const z = sign * THREE.MathUtils.lerp(halfZ[k0]!, halfZ[k0 + 1]!, frac)
      const y = THREE.MathUtils.lerp(halfY[k0]!, halfY[k0 + 1]!, frac)
      outPts[i]!.set(0, y, z)
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
  const ringCenter: THREE.Vector3[] = Array.from({ length: RINGS + 1 }, () => new THREE.Vector3())
  const ringTangent: THREE.Vector3[] = Array.from({ length: RINGS + 1 }, () => new THREE.Vector3())
  const ringNormal: THREE.Vector3[] = Array.from({ length: RINGS + 1 }, () => new THREE.Vector3())
  const ringGrid = new Float32Array((RINGS + 1) * N * 3)
  const ringShade = new Float32Array((RINGS + 1) * N)
  const fringeCurvePts: THREE.Vector3[] = Array.from({ length: FRINGE_SEGS + 1 }, () => new THREE.Vector3())
  const tailTipVel = [new THREE.Vector3(), new THREE.Vector3()] // [negZ end, posZ end]

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
      // Keep ribbon width strictly aligned with local X so the +x free edges stay parallel to X at rest.
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

        // Gentle double-layer silk breath along the hanging tails: tight at -x crease, softly parted at +x open edges.
        const layerPart = .0082 * Math.pow(tailFrac, 1.25) * (.70 + .30 * Math.sin(tailFrac * Math.PI * 1.35))
        const plyOffset = ply > 0 ? layerPart * openWeight : ply < 0 ? -layerPart * openWeight * .72 : 0

        // Broad, clean anime silk drape folds along the hanging tails (normal direction only -> preserves x = 0.095).
        const foldWave = Math.pow(tailFrac, 1.25) * (
          .0095 * Math.sin(tailFrac * 4.1 + uX * 2.15 + sign * .65 + phaseClock * .45) +
          .0045 * Math.cos(tailFrac * 6.8 - uX * 2.6 + sign * .3)
        )
        const camber = -.0048 * (1 - (2 * uX - 1) ** 2) * Math.pow(tailFrac, 1.1)
        const normalDisp = sp.y + plyOffset + foldWave + camber

        // Only apply dynamic Rapier lateral X swing strictly on free tails when active; resting X is exact sp.x.
        const x = sp.x + (allowDynamicX ? c.x * Math.pow(tailFrac, 1.15) : 0)
        const y = c.y + n.y * normalDisp
        const z = c.z + n.z * normalDisp

        const idx = (i * N + j) * 3
        ringGrid[idx] = x
        ringGrid[idx + 1] = y
        ringGrid[idx + 2] = z

        // Subtle luminous ivory fold shading: soft warm hollow in catenary & tail folds, clean inner C-crease shadow.
        const waveShade = 1 + THREE.MathUtils.clamp(foldWave * 2.8, -.032, .028)
        const sagShade = 1 - .028 * centerDipMask * (ply > 0 ? 1 : .4)
        ringShade[i * N + j] = THREE.MathUtils.clamp(sectionShade[j]! * waveShade * sagShade, .76, 1.0)
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
      // Outward tangent pointing away from the scarf body along the hanging tail.
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
        // Smooth transition from cloth-end tangent into vertical gravity hang + inertial trail.
        const blendGrav = smoothstep(u * 1.15)
        const dirX = THREE.MathUtils.lerp(tx, 0, blendGrav) + f.splayX * 2.8 * u
        const dirY = THREE.MathUtils.lerp(ty, -1, blendGrav)
        const dirZ = THREE.MathUtils.lerp(tz, f.sign * .06, blendGrav)
        const dLen = Math.hypot(dirX, dirY, dirZ) || 1
        const trailX = allowDynamicX ? THREE.MathUtils.clamp(-vel.x * .038, -.035, .035) * u2 : 0
        const trailZ = allowDynamicX ? THREE.MathUtils.clamp(-vel.z * .028, -.026, .026) * u2 : 0
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
  // Lazy-loaded Rapier soft-body simulation for the folded silk hanging tails
  // (25-particle custom rope in scarf-local space with hand support constraints,
  // D'Alembert carry/handover inertia, and gentle sunlit courtyard breeze).
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
    writeClothAndFringes(simRestPts, activeSpan, 0, false)
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
        pinnedParticles: [12], // center bridge particle stays kinematically anchored at z=0
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
    const sPeak = activeSpan + .026

    spineBody.resetForces(false)
    // Center anchor tracks the exact catenary sag midpoint.
    const cRest = simRestPts[12]!
    spineBody.setParticleKinematicTarget(12, { x: cRest.x, y: cRest.y, z: cRest.z })

    for (let i = 0; i < SIM_N; i++) {
      if (i === 12) continue
      const s = ((i / (SIM_N - 1)) * 2 - 1) * HALF_LEN
      const absS = Math.abs(s)
      const sign = s < 0 ? -1 : 1
      const r = simRestPts[i]!
      const px = pos[i * 3]!, py = pos[i * 3 + 1]!, pz = pos[i * 3 + 2]!
      const vx = vel[i * 3]!, vy = vel[i * 3 + 1]!, vz = vel[i * 3 + 2]!

      // Soft support contact over & between the two active palms, fading cleanly onto the free hanging tails.
      const supportMask = 1 - smoothstep((absS - sPeak) / .085)
      const tailMask = smoothstep((absS - sPeak) / Math.max(.18, HALF_LEN - sPeak))

      // Keep vertical drape inextensible & hand-wrap clear while allowing soft lateral/forward silk motion.
      const kXZ = 520 * supportMask + 26 * (1 - supportMask)
      const kY = 520 * supportMask + 68 * (1 - supportMask)
      const kDamp = 30 * supportMask + 4.2 * (1 - supportMask)
      let ax = (r.x - px) * kXZ - vx * kDamp
      let ay = (r.y - py) * kY - vy * kDamp
      let az = (r.z - pz) * kXZ - vz * kDamp

      // Keep the silk smoothly resting ON TOP of the supporting hands (never sinking through palms).
      if (absS <= sPeak + .04 && py < r.y - .002) {
        ay += (r.y - py) * 900
      }

      // Free hanging tails feel real D'Alembert carry/handover inertia + gentle sunlit courtyard silk breath.
      if (tailMask > 0) {
        const inertiaGain = 0.95 * Math.pow(tailMask, 1.1)
        ax -= THREE.MathUtils.clamp(scarfAccel.x, -12, 12) * inertiaGain
        ay -= THREE.MathUtils.clamp(scarfAccel.y, -10, 10) * inertiaGain * .45
        az -= THREE.MathUtils.clamp(scarfAccel.z, -12, 12) * inertiaGain

        // Serene sunlit courtyard silk breath (gentle, dignified sway ~1.5-2.5 cm at hem, softly clear of hands).
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
    const sPeak = activeSpan + .026
    // Safety floor well below natural silk hem (never creases the bottom hem in normal poses).
    const minLocalY = Math.max(-.66, .40 - scarf.position.y)
    const palmCenterY = drape(activeSpan) - .055

    for (let i = 0; i < SIM_N; i++) {
      const s = ((i / (SIM_N - 1)) * 2 - 1) * HALF_LEN
      const absS = Math.abs(s)
      const sign = s < 0 ? -1 : 1
      const tailMask = smoothstep((absS - sPeak) / Math.max(.18, HALF_LEN - sPeak))
      const r = simRestPts[i]!
      let x = THREE.MathUtils.clamp(pos[i * 3]!, -.06, .06) * tailMask
      let y = pos[i * 3 + 1]!
      let z = pos[i * 3 + 2]!
      // Blend palm-contact region smoothly onto exact resting palm wrap so hands never clip cloth.
      const lock = 1 - smoothstep((absS - (sPeak + .01)) / .075)
      x = THREE.MathUtils.lerp(x, r.x, lock)
      y = THREE.MathUtils.lerp(y, r.y, lock * .92)
      z = THREE.MathUtils.lerp(z, r.z, lock * .92)

      // Explicit palm ellipsoid clearance on hanging tails so silk always drapes cleanly outside the wrists/hands.
      if (absS > activeSpan * .85) {
        const dz = Math.abs(z) - activeSpan
        const dy = y - palmCenterY
        const rx = .070, ry = .062
        const ell = (dz / rx) ** 2 + (dy / ry) ** 2
        if (ell < 1 && dy < .045) {
          const pushZ = activeSpan + rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2))
          if (Math.abs(z) < pushZ) z = sign * pushZ
        }
      }

      if (y < minLocalY) y = minLocalY
      simCurrPts[i]!.set(x, y, z)
    }
    tailTipVel[0]!.set(vel[0]!, vel[1]!, vel[2]!)
    const last = (SIM_N - 1) * 3
    tailTipVel[1]!.set(vel[last]!, vel[last + 1]!, vel[last + 2]!)
    writeClothAndFringes(simCurrPts, activeSpan, simClock, true)
  }

  const people = [
    { name: 'giver', x: -.83, dir: 1, color: 0xc18b56 },
    { name: 'guest', x: .83, dir: -1, color: 0x6b9a91 },
  ].map(({ name, x, dir, color }) => {
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
      upper.set(v(x, .58, sign * .12), v(x, .31, sign * .12))
      lower.set(v(x, .31, sign * .12), v(x, .075, sign * .12))
      return ball('khata-' + name + '-shoe-' + i, v(x + dir * .035, .055, sign * .12), [.13, .055, .085], shoe)
    })
    const setHands = (points: THREE.Vector3[]) => arms.forEach((arm, i) => {
      const end = points[i]!
      const elbow = arm.shoulder.clone().lerp(end, .48)
      elbow.y -= .12
      elbow.z += (i ? 1 : -1) * .07
      arm.upper.set(arm.shoulder, elbow)
      arm.lower.set(elbow, end)
      arm.hand.position.copy(end)
    })
    return { name, x, dir, body, head, hair: hairMesh, nose, arms, feet, setHands }
  })

  const pose = (step: number, amount: number) => {
    const n = Number.isFinite(step) ? THREE.MathUtils.clamp(Math.floor(step), 0, 3) : 0
    const t = Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, 0, 1) : 0
    const lift = n === 0 ? t : 1, extend = n === 1 ? t : n > 1 ? 1 : 0, receive = n === 2 ? t : n > 2 ? 1 : 0
    const move = .12 * receive + .88 * THREE.MathUtils.clamp((receive - .22) / .78, 0, 1)
    const scarfX = -.35 + .35 * extend + .35 * move, scarfY = .92 + .24 * lift
    scarf.position.set(scarfX, scarfY, 0)

    // As the guest receives at ±0.20 and the giver withdraws from ±0.34, the constant-length silk
    // smoothly shifts its support span and cascades deeper over the guest's wrists.
    const handoverBlend = smoothstep((receive - .28) / .56)
    const targetSpan = THREE.MathUtils.lerp(GIVER_SPAN, GUEST_SPAN, handoverBlend)
    syncRestSpine(targetSpan)
    if (!physicsActive) {
      writeRestingGeometry()
    }

    const support = (x: number, z: number) => v(x, scarfY + drape(z) - .055, z)
    const giverX = receive <= .30 ? scarfX - .035 : THREE.MathUtils.lerp(scarfX - .035, -.39, (receive - .30) / .70)
    const giver = people[0]!, guest = people[1]!
    giver.setHands([-1, 1].map((sign) => {
      const p = support(giverX, sign * GIVER_SPAN)
      if (receive > .30) p.y = THREE.MathUtils.lerp(p.y, .84, (receive - .30) / .70)
      return p
    }))
    const meet = THREE.MathUtils.clamp(receive / .22, 0, 1)
    guest.setHands([-1, 1].map((sign) => v(.46, .82, sign * GUEST_SPAN).lerp(support(scarfX + .035, sign * GUEST_SPAN), meet)))
    root.updateMatrixWorld(true)
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
      // Smooth acceleration slightly to avoid single-frame jump spikes.
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
    startPhysics,
    stepPhysics,
    calm,
    get rapierReady() { return rapierReady },
    dispose,
  }
}
