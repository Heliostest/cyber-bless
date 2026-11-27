import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import {
  SIMPLE_TREE_BRANCH_COUNT,
  SIMPLE_TREE_BRANCH_LEVELS,
  SIMPLE_TREE_BRANCH_OFFSETS,
  SIMPLE_TREE_BRANCH_RING_COUNTS,
  SIMPLE_TREE_BRANCH_RINGS,
  SIMPLE_TREE_CLUMP_CENTERS,
  SIMPLE_TREE_CLUMP_COUNT,
  SIMPLE_TREE_LEAF_CARD_COUNT,
  SIMPLE_TREE_LEAF_CARDS,
  SIMPLE_TREE_LEAF_CLUMP_IDS,
  SIMPLE_TREE_LEAF_STRIDE,
} from './simple-tree-data'

type BranchBaseMode = 'flat' | 'dome'

type BranchSpec = {
  name: string
  points: THREE.Vector3[]
  radii: number[]
  radialSegments: number
  baseMode: BranchBaseMode
  tipRoundness: number
  rootFlare?: boolean
  barkSeed: number
}

type LeafPuffInput = {
  pos: THREE.Vector3
  radius: number
  clumpNormal: THREE.Vector3
  bakedRgb: [number, number, number]
  seed: number
  toneShift: number
}

// Hero placement for the adapted Simple Tree maple (`maple-round.glb` skeleton + centroids):
// planted on the left side of the sandy clearing with yaw=300deg so the balanced rounded-ovoid
// autumn maple crown stays naturally clear of the puppet while primary limb B1's right fork (B4)
// is promoted into the grafted hanging bough reaching the locked hang point (0, 3.52, -0.1).
const HERO_BASE_X = -1.78
const HERO_BASE_Z = -0.82
const HERO_HEIGHT = 4.30
const HERO_YAW = THREE.MathUtils.degToRad(300)
const HERO_COS = Math.cos(HERO_YAW)
const HERO_SIN = Math.sin(HERO_YAW)
const WOOD_RADIUS_SCALE = 1.06
// Branch B4 in `maple-round.glb` is the mid-upper right limb promoted into `jack-tree-branch`.
const PROMOTED_RIGHT_BRANCH_INDEX = 4

const KEY_DIR = new THREE.Vector3(-3, 5, 4).normalize()

// Warm storybook bark & autumn maple palette anchored to `maple-round.glb` (`#8e7560` wood,
// `#c35c3e` / `#753b2e` / `#dba366` leaves), tuned to sit right in the backdrop maple family.
const BARK_DARK = new THREE.Color('#534034')
const BARK_MID = new THREE.Color('#7b624d')
const BARK_LIGHT = new THREE.Color('#a38669')
const BARK_MOSS_TINT = new THREE.Color('#636448')

const LEAF_BASE = new THREE.Color('#c95e41')
const LEAF_SHADOW = new THREE.Color('#8e4031')
const LEAF_SUN = new THREE.Color('#e69c5d')

// Base unit icosahedron (12 vertices, 20 strictly equilateral CCW outward faces):
// sculpted per pufflet into a compact, plump, rounded 3D maple-leaf tuft with zero thin
// edges, zero flat paper-shingle cuts, and strictly positive watertight volume.
const ICO_PHI = (1 + Math.sqrt(5)) / 2
const ICO_DIRS: readonly THREE.Vector3[] = (
  [
    [-1, ICO_PHI, 0], [1, ICO_PHI, 0], [-1, -ICO_PHI, 0], [1, -ICO_PHI, 0],
    [0, -1, ICO_PHI], [0, 1, ICO_PHI], [0, -1, -ICO_PHI], [0, 1, -ICO_PHI],
    [ICO_PHI, 0, -1], [ICO_PHI, 0, 1], [-ICO_PHI, 0, -1], [-ICO_PHI, 0, 1],
  ] as [number, number, number][]
).map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize())

const ICO_TRIS: readonly [number, number, number][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
]

const ICO_INCIDENT_FACES: readonly (readonly number[])[] = (() => {
  const list: number[][] = Array.from({ length: ICO_DIRS.length }, () => [])
  ICO_TRIS.forEach(([a, b, c], f) => {
    list[a]!.push(f)
    list[b]!.push(f)
    list[c]!.push(f)
  })
  return list
})()

function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return s - Math.floor(s)
}

function transformPoint(ux: number, uy: number, uz: number): THREE.Vector3 {
  return new THREE.Vector3(
    HERO_BASE_X + (ux * HERO_COS + uz * HERO_SIN) * HERO_HEIGHT,
    uy * HERO_HEIGHT,
    HERO_BASE_Z + (-ux * HERO_SIN + uz * HERO_COS) * HERO_HEIGHT,
  )
}

function transformDir(dx: number, dy: number, dz: number): THREE.Vector3 {
  return new THREE.Vector3(
    dx * HERO_COS + dz * HERO_SIN,
    dy,
    -dx * HERO_SIN + dz * HERO_COS,
  ).normalize()
}

/**
 * Watertight tapered closed branch solid reconstructed from a polyline of
 * `(center, radius)` stations with rotation-minimizing Bishop frames, closed
 * rounded tip dome, optional grounded flat root-flare base (`y = 0`), and
 * Simple Tree living-bark vertex colors.
 */
function createWatertightBranchGeometry(spec: BranchSpec): THREE.BufferGeometry {
  const { points, radii, radialSegments: radSegs, tipRoundness } = spec
  const count = points.length
  const tangents: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    const a = points[Math.max(0, i - 1)]!
    const b = points[Math.min(count - 1, i + 1)]!
    const t = b.clone().sub(a)
    if (t.lengthSq() < 1e-12) t.set(0, 1, 0)
    else t.normalize()
    tangents.push(t)
  }

  // Right-handed rotation-minimizing frame (U, V, T) with U x V = +T.
  const t0 = tangents[0]!
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, -1)
  const u0 = new THREE.Vector3().crossVectors(ref, t0).normalize()
  const v0 = new THREE.Vector3().crossVectors(t0, u0).normalize()
  const us: THREE.Vector3[] = [u0]
  const vs: THREE.Vector3[] = [v0]
  const qStep = new THREE.Quaternion()
  for (let i = 1; i < count; i++) {
    qStep.setFromUnitVectors(tangents[i - 1]!, tangents[i]!)
    const ui = us[i - 1]!.clone().applyQuaternion(qStep)
    ui.addScaledVector(tangents[i]!, -ui.dot(tangents[i]!)).normalize()
    const vi = new THREE.Vector3().crossVectors(tangents[i]!, ui).normalize()
    us.push(ui)
    vs.push(vi)
  }

  const rings: { pts: THREE.Vector3[]; t: number; angles: number[] }[] = []

  const ringRadius = (idx: number, t: number, angle: number): number => {
    let r = radii[idx]!
    if (spec.rootFlare && t < 0.34) {
      const f = 1 - t / 0.34
      const flareEnv = f * f * (3 - 2 * f)
      const buttress = 0.60 + 0.40 * Math.cos(angle * 4 + 0.55) + 0.14 * Math.sin(angle * 3 - 0.85)
      r *= 1 + flareEnv * (0.05 + 0.11 * Math.max(0, buttress))
    } else {
      r *= 1 + 0.025 * Math.sin(angle * 3 + t * 4.5 + spec.barkSeed)
    }
    return Math.max(0.005, r)
  }

  let basePole: THREE.Vector3 | null = null
  if (spec.baseMode === 'dome') {
    const c0 = points[0]!
    const tn0 = tangents[0]!
    const u = us[0]!
    const v = vs[0]!
    const domeDepth = Math.max(0.005, radii[0]! * 0.52)
    basePole = c0.clone().addScaledVector(tn0, -domeDepth)
    basePole.y = Math.max(0.001, basePole.y)
    for (const alpha of [Math.PI * 0.34, Math.PI * 0.17]) {
      const cosA = Math.cos(alpha)
      const sinA = Math.sin(alpha)
      const pts: THREE.Vector3[] = []
      const angles: number[] = []
      for (let j = 0; j < radSegs; j++) {
        const angle = (j / radSegs) * Math.PI * 2
        const rr = ringRadius(0, 0, angle) * cosA
        const pt = c0.clone()
          .addScaledVector(tn0, -domeDepth * sinA)
          .addScaledVector(u, Math.cos(angle) * rr)
          .addScaledVector(v, Math.sin(angle) * rr)
        pt.y = Math.max(0.001, pt.y)
        pts.push(pt)
        angles.push(angle)
      }
      rings.push({ pts, t: 0, angles })
    }
  }

  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1)
    const c = points[i]!
    const u = i === 0 && spec.baseMode === 'flat' ? new THREE.Vector3(1, 0, 0) : us[i]!
    const v = i === 0 && spec.baseMode === 'flat' ? new THREE.Vector3(0, 0, -1) : vs[i]!
    const pts: THREE.Vector3[] = []
    const angles: number[] = []
    for (let j = 0; j < radSegs; j++) {
      const angle = (j / radSegs) * Math.PI * 2
      const rr = ringRadius(i, t, angle)
      const pt = c.clone()
        .addScaledVector(u, Math.cos(angle) * rr)
        .addScaledVector(v, Math.sin(angle) * rr)
      if (i === 0 && spec.baseMode === 'flat') pt.y = 0
      else pt.y = Math.max(0.001, pt.y)
      pts.push(pt)
      angles.push(angle)
    }
    rings.push({ pts, t, angles })
  }

  // Smooth rounded tip dome cap with a single welded pole (zero degenerate triangles).
  const lastIdx = count - 1
  const cEnd = points[lastIdx]!
  const tEnd = tangents[lastIdx]!
  const uEnd = us[lastIdx]!
  const vEnd = vs[lastIdx]!
  const tipDepth = Math.max(0.005, radii[lastIdx]! * tipRoundness)
  for (const alpha of [Math.PI * 0.18, Math.PI * 0.36]) {
    const cosA = Math.cos(alpha)
    const sinA = Math.sin(alpha)
    const pts: THREE.Vector3[] = []
    const angles: number[] = []
    for (let j = 0; j < radSegs; j++) {
      const angle = (j / radSegs) * Math.PI * 2
      const rr = ringRadius(lastIdx, 1, angle) * cosA
      const pt = cEnd.clone()
        .addScaledVector(tEnd, tipDepth * sinA)
        .addScaledVector(uEnd, Math.cos(angle) * rr)
        .addScaledVector(vEnd, Math.sin(angle) * rr)
      pt.y = Math.max(0.001, pt.y)
      pts.push(pt)
      angles.push(angle)
    }
    rings.push({ pts, t: 1, angles })
  }
  const tipPole = cEnd.clone().addScaledVector(tEnd, tipDepth)
  tipPole.y = Math.max(0.001, tipPole.y)

  const vertPos: THREE.Vector3[] = []
  const vertMeta: { t: number; angle: number; isFlatCap: boolean }[] = []
  const tris: [number, number, number][] = []

  const ringStartIdx: number[] = []
  for (const ring of rings) {
    ringStartIdx.push(vertPos.length)
    for (let j = 0; j < radSegs; j++) {
      vertPos.push(ring.pts[j]!)
      vertMeta.push({ t: ring.t, angle: ring.angles[j]!, isFlatCap: false })
    }
  }

  for (let r = 0; r < rings.length - 1; r++) {
    const baseA = ringStartIdx[r]!
    const baseB = ringStartIdx[r + 1]!
    for (let j = 0; j < radSegs; j++) {
      const jNext = (j + 1) % radSegs
      const a = baseA + j
      const b = baseA + jNext
      const c = baseB + jNext
      const d = baseB + j
      tris.push([a, b, c], [a, c, d])
    }
  }

  const tipPoleIdx = vertPos.length
  vertPos.push(tipPole)
  vertMeta.push({ t: 1, angle: 0, isFlatCap: false })
  const lastRingBase = ringStartIdx[rings.length - 1]!
  for (let j = 0; j < radSegs; j++) {
    const jNext = (j + 1) % radSegs
    tris.push([lastRingBase + j, lastRingBase + jNext, tipPoleIdx])
  }

  const firstRingBase = ringStartIdx[0]!
  let flatCapStart = -1
  if (spec.baseMode === 'dome' && basePole) {
    const basePoleIdx = vertPos.length
    vertPos.push(basePole)
    vertMeta.push({ t: 0, angle: 0, isFlatCap: false })
    for (let j = 0; j < radSegs; j++) {
      const jNext = (j + 1) % radSegs
      tris.push([basePoleIdx, firstRingBase + jNext, firstRingBase + j])
    }
  } else {
    flatCapStart = vertPos.length
    const flatCenter = points[0]!.clone()
    flatCenter.y = 0
    const centerIdx = vertPos.length
    vertPos.push(flatCenter)
    vertMeta.push({ t: 0, angle: 0, isFlatCap: true })
    const capRingStart = vertPos.length
    for (let j = 0; j < radSegs; j++) {
      const pt = rings[0]!.pts[j]!.clone()
      pt.y = 0
      vertPos.push(pt)
      vertMeta.push({ t: 0, angle: rings[0]!.angles[j]!, isFlatCap: true })
    }
    for (let j = 0; j < radSegs; j++) {
      const jNext = (j + 1) % radSegs
      tris.push([centerIdx, capRingStart + jNext, capRingStart + j])
    }
  }

  const norms = vertPos.map(() => new THREE.Vector3())
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const cross = new THREE.Vector3()
  for (const [i0, i1, i2] of tris) {
    if (flatCapStart >= 0 && i0 >= flatCapStart) continue
    e1.subVectors(vertPos[i1]!, vertPos[i0]!)
    e2.subVectors(vertPos[i2]!, vertPos[i0]!)
    cross.crossVectors(e1, e2)
    norms[i0]!.add(cross)
    norms[i1]!.add(cross)
    norms[i2]!.add(cross)
  }
  for (let i = 0; i < norms.length; i++) {
    if (vertMeta[i]!.isFlatCap) norms[i]!.set(0, -1, 0)
    else if (norms[i]!.lengthSq() > 1e-18) norms[i]!.normalize()
    else norms[i]!.set(0, 1, 0)
  }

  const posArr = new Float32Array(vertPos.length * 3)
  const normArr = new Float32Array(vertPos.length * 3)
  const colArr = new Float32Array(vertPos.length * 3)
  const c = new THREE.Color()

  for (let i = 0; i < vertPos.length; i++) {
    const p = vertPos[i]!
    const n = norms[i]!
    const meta = vertMeta[i]!
    posArr[i * 3] = p.x
    posArr[i * 3 + 1] = p.y
    posArr[i * 3 + 2] = p.z
    normArr[i * 3] = n.x
    normArr[i * 3 + 1] = n.y
    normArr[i * 3 + 2] = n.z

    const furrow = 0.55 * Math.sin(meta.angle * 5 + meta.t * 4.2 + spec.barkSeed)
      + 0.45 * Math.cos(meta.angle * 8 - meta.t * 5.8 + spec.barkSeed * 1.7)
    const sunLift = THREE.MathUtils.clamp(n.dot(KEY_DIR) * 0.5 + 0.5, 0, 1)
    const crownShade = THREE.MathUtils.smoothstep(p.y, 1.35, 2.55) * THREE.MathUtils.smoothstep(-0.75, -1.65, p.x)
    const groundAO = spec.rootFlare ? 1 - THREE.MathUtils.smoothstep(p.y, 0.0, 0.34) : 0

    c.copy(BARK_MID)
    if (furrow > 0) c.lerp(BARK_LIGHT, furrow * 0.16 + sunLift * 0.14)
    else c.lerp(BARK_DARK, (-furrow) * 0.28 + (1 - sunLift) * 0.16)

    if (crownShade > 0) c.lerp(BARK_DARK, crownShade * 0.30)
    if (groundAO > 0) {
      c.lerp(BARK_DARK, groundAO * 0.46)
      c.lerp(BARK_MOSS_TINT, groundAO * 0.07)
    }

    colArr[i * 3] = THREE.MathUtils.clamp(c.r, 0.02, 1.0)
    colArr[i * 3 + 1] = THREE.MathUtils.clamp(c.g, 0.02, 1.0)
    colArr[i * 3 + 2] = THREE.MathUtils.clamp(c.b, 0.02, 1.0)
  }

  const indexArr: number[] = []
  for (const [i0, i1, i2] of tris) indexArr.push(i0, i1, i2)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3))
  geo.setIndex(indexArr)
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

/**
 * Builds one strictly watertight, closed, positive-volume clump mesh by merging
 * dozens of tiny sculpted 3D rounded maple-leaf pufflets (12 verts / 20 tris each)
 * scattered across the baked Simple Tree leaf-card centroids of that clump.
 *
 * Unlike flat polygonal leaf cards or giant spheres, ~900 tiny (~8-12px) organically
 * sculpted 3D pufflets merge smoothly via clump-outward normal transfer (`faceNormal · nv >= 0.24`)
 * into a soft, feathery, painterly Komorebi maple crown matching the backdrop trees.
 */
function createMapleClumpGeometry(
  clumpCenter: THREE.Vector3,
  puffs: readonly LeafPuffInput[],
): THREE.BufferGeometry {
  const vertsPerPuff = ICO_DIRS.length
  const trisPerPuff = ICO_TRIS.length
  const totalVerts = puffs.length * vertsPerPuff
  const totalIndices = puffs.length * trisPerPuff * 3

  const posArr = new Float32Array(totalVerts * 3)
  const normArr = new Float32Array(totalVerts * 3)
  const colArr = new Float32Array(totalVerts * 3)
  const indexArr = new Uint32Array(totalIndices)

  const usedKeys = new Set<string>()
  const posKey = (v: THREE.Vector3) =>
    `${Math.round(v.x * 1e6)},${Math.round(v.y * 1e6)},${Math.round(v.z * 1e6)}`

  const tmpU = new THREE.Vector3()
  const tmpV = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const cross = new THREE.Vector3()
  const candidate = new THREE.Vector3()
  const baseColor = new THREE.Color()
  const vertColor = new THREE.Color()
  const worldPt = new THREE.Vector3()

  let vCursor = 0
  let iCursor = 0

  for (const puff of puffs) {
    const R = puff.radius
    const clumpN = puff.clumpNormal
    const ref = Math.abs(clumpN.y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
    tmpU.crossVectors(ref, clumpN).normalize()
    tmpV.crossVectors(clumpN, tmpU).normalize()

    const spin = hash1(puff.seed * 1.91) * Math.PI * 2
    const cosS = Math.cos(spin)
    const sinS = Math.sin(spin)
    const tangent = tmpU.clone().multiplyScalar(cosS).addScaledVector(tmpV, sinS).normalize()
    const bitangent = new THREE.Vector3().crossVectors(clumpN, tangent).normalize()

    const localCenter = puff.pos.clone().sub(clumpCenter)
    // Gently cushioned along the clump normal and subtly elongated across the tangent plane.
    const rx = R * (0.94 + 0.24 * hash1(puff.seed * 2.71))
    const ry = R * (0.90 + 0.24 * hash1(puff.seed * 4.13))
    const rz = R * (0.62 + 0.16 * hash1(puff.seed * 5.87))
    const phaseA = puff.seed * 3.17
    const phaseB = puff.seed * 5.41

    const pts: THREE.Vector3[] = []
    for (let j = 0; j < vertsPerPuff; j++) {
      const d = ICO_DIRS[j]!
      // Subtle organic leaf-tuft lobe irregularity without sharp polygonal spikes.
      const lobe = 1
        + 0.15 * Math.sin(d.x * 3.2 + d.y * 2.8 + phaseA)
        + 0.09 * Math.cos(d.y * 3.6 - d.z * 2.9 + phaseB)
      const pt = localCenter.clone()
        .addScaledVector(tangent, d.x * rx * lobe)
        .addScaledVector(bitangent, d.y * ry * lobe)
        .addScaledVector(clumpN, d.z * rz * lobe)
      if (clumpCenter.y + pt.y < 0.05) pt.y = 0.05 - clumpCenter.y
      let k = posKey(pt)
      let tries = 0
      while (usedKeys.has(k) && tries < 8) {
        pt.x += 2.3e-5 * (tries + 1)
        pt.y += 1.7e-5 * (tries + 1)
        k = posKey(pt)
        tries++
      }
      usedKeys.add(k)
      pts.push(pt)
    }

    const smoothNorms = pts.map(() => new THREE.Vector3())
    const faceUnitNormals: THREE.Vector3[] = []
    for (let f = 0; f < trisPerPuff; f++) {
      const [a, b, c] = ICO_TRIS[f]!
      e1.subVectors(pts[b]!, pts[a]!)
      e2.subVectors(pts[c]!, pts[a]!)
      cross.crossVectors(e1, e2)
      smoothNorms[a]!.add(cross)
      smoothNorms[b]!.add(cross)
      smoothNorms[c]!.add(cross)
      faceUnitNormals.push(cross.clone().normalize())
    }

    // Softly blend outward-facing vertices toward Simple Tree's authored outward clump normal
    // so adjacent tiny pufflets read as cohesive velvety foliage while keeping `dot >= 0.24`.
    const finalNorms: THREE.Vector3[] = smoothNorms.map((sn, vi) => {
      sn.normalize()
      const faces = ICO_INCIDENT_FACES[vi]!
      let blend = 0.78
      while (blend >= 0.06) {
        candidate.copy(sn).lerp(clumpN, blend).normalize()
        let ok = true
        for (const fi of faces) {
          if (faceUnitNormals[fi]!.dot(candidate) < 0.24) {
            ok = false
            break
          }
        }
        if (ok) return candidate.clone()
        blend *= 0.65
      }
      return sn.clone()
    })

    // Exact Simple Tree autumn maple pigment modulated by baked GLB AO/sun/clump tint.
    const [br, bg, bb] = puff.bakedRgb
    const sr = THREE.MathUtils.lerp(1, br, 0.68)
    const sg = THREE.MathUtils.lerp(1, bg, 0.68)
    const sb = THREE.MathUtils.lerp(1, bb, 0.68)
    baseColor.setRGB(
      THREE.MathUtils.clamp(LEAF_BASE.r * sr, 0.01, 1.0),
      THREE.MathUtils.clamp(LEAF_BASE.g * sg, 0.01, 1.0),
      THREE.MathUtils.clamp(LEAF_BASE.b * sb, 0.01, 1.0),
    )

    const sunDot = clumpN.dot(KEY_DIR) * 0.5 + 0.5
    const heightFrac = THREE.MathUtils.clamp((puff.pos.y - 1.55) / 2.65, 0, 1)
    const warmLift = THREE.MathUtils.smoothstep(sunDot * 0.62 + heightFrac * 0.38 + puff.toneShift * 0.07, 0.54, 0.96)
    const shadePull = THREE.MathUtils.smoothstep((1 - sunDot) * 0.58 + (1 - heightFrac) * 0.42 - puff.toneShift * 0.07, 0.50, 0.95)

    const baseV = vCursor
    for (let j = 0; j < vertsPerPuff; j++) {
      const p = pts[j]!
      const n = finalNorms[j]!
      worldPt.copy(clumpCenter).add(p)
      vertColor.copy(baseColor)
      const localSun = THREE.MathUtils.clamp(n.dot(KEY_DIR) * 0.5 + 0.5, 0, 1)
      if (warmLift > 0) vertColor.lerp(LEAF_SUN, warmLift * (0.10 + localSun * 0.14))
      if (shadePull > 0) vertColor.lerp(LEAF_SHADOW, shadePull * (0.14 + (1 - localSun) * 0.12))
      const dapple = Math.sin(worldPt.x * 16 + worldPt.y * 13 + puff.seed) * 0.022 + puff.toneShift * 0.042
      posArr[vCursor * 3] = p.x
      posArr[vCursor * 3 + 1] = p.y
      posArr[vCursor * 3 + 2] = p.z
      normArr[vCursor * 3] = n.x
      normArr[vCursor * 3 + 1] = n.y
      normArr[vCursor * 3 + 2] = n.z
      colArr[vCursor * 3] = THREE.MathUtils.clamp(vertColor.r * (1 + dapple), 0.01, 1.0)
      colArr[vCursor * 3 + 1] = THREE.MathUtils.clamp(vertColor.g * (1 + dapple * 0.85), 0.01, 1.0)
      colArr[vCursor * 3 + 2] = THREE.MathUtils.clamp(vertColor.b * (1 + dapple * 0.55), 0.01, 1.0)
      vCursor++
    }

    for (let f = 0; f < trisPerPuff; f++) {
      const [a, b, c] = ICO_TRIS[f]!
      indexArr[iCursor++] = baseV + a
      indexArr[iCursor++] = baseV + b
      indexArr[iCursor++] = baseV + c
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3))
  geo.setIndex(new THREE.BufferAttribute(indexArr, 1))
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

/**
 * Adds the adapted Simple Tree maple (`maple-round.glb`) hero hanging tree to `fixed`:
 * - Multi-limb tapered watertight bark reconstructed synchronously from the baked
 *   Simple Tree skeleton (1 flared grounded trunk, 4 spreading primary limbs, 15 secondary
 *   crown branches) with the mid-upper right limb (B4) promoted into the organically
 *   grafted hanging bough (`jack-tree-branch`) passing through `(0, 3.52, -0.1)`.
 * - 18 crown clumps rebuilt from the 406 baked Simple Tree leaf-card centroids as fine
 *   overlapping sculpted watertight 3D maple-leaf pufflets with outward clump normals,
 *   `outline: false`, `createRitualMaterial` leaf optics, and zero texture maps (`map === null`).
 */
export function addJumpingJackTree(fixed: THREE.Group): void {
  const bark = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.94,
    metalness: 0,
    vertexColors: true,
  })
  const leaf = createRitualMaterial(
    {
      color: '#ffffff',
      roughness: 0.92,
      metalness: 0,
      vertexColors: true,
    },
    { kind: 'leaf', strength: 0.16, fiber: false },
  )
  // Match Simple Tree's wrapped foliage diffuse while preserving full linear autumn maple vertex colors.
  leaf.userData.treeClusterNormals = true
  leaf.userData.komorebiPigment = true

  // 1. Rebuild baked Simple Tree wood branches as watertight closed solids
  // (promoting right-reaching B4 into the grafted hanging bough below).
  let limbCounter = 0
  let twigCounter = 0
  for (let b = 0; b < SIMPLE_TREE_BRANCH_COUNT; b++) {
    if (b === PROMOTED_RIGHT_BRANCH_INDEX) continue
    const level = SIMPLE_TREE_BRANCH_LEVELS[b]!
    const ringOffset = SIMPLE_TREE_BRANCH_OFFSETS[b]!
    const ringCount = SIMPLE_TREE_BRANCH_RING_COUNTS[b]!
    const points: THREE.Vector3[] = []
    const radii: number[] = []
    for (let r = 0; r < ringCount; r++) {
      const idx = (ringOffset + r) * 4
      const p = transformPoint(
        SIMPLE_TREE_BRANCH_RINGS[idx]!,
        SIMPLE_TREE_BRANCH_RINGS[idx + 1]!,
        SIMPLE_TREE_BRANCH_RINGS[idx + 2]!,
      )
      if (b === 0 && r === 0) p.y = 0
      points.push(p)
      const rad = SIMPLE_TREE_BRANCH_RINGS[idx + 3]! * HERO_HEIGHT * WOOD_RADIUS_SCALE
      radii.push(Math.max(level === 2 ? 0.011 : 0.024, rad))
    }

    const name = level === 0
      ? 'jack-tree-trunk'
      : level === 1
        ? `jack-tree-limb-${limbCounter++}`
        : `jack-tree-twig-${twigCounter++}`

    const geo = createWatertightBranchGeometry({
      name,
      points,
      radii,
      radialSegments: level === 0 ? 14 : level === 1 ? 10 : 8,
      baseMode: level === 0 ? 'flat' : 'dome',
      tipRoundness: level === 0 ? 0.65 : 0.80,
      rootFlare: level === 0,
      barkSeed: 3.1 + b * 4.7,
    })
    const mesh = new THREE.Mesh(geo, bark)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.toonSurface = { outline: false, shading: 'smooth' }
    fixed.add(mesh)
  }

  // 2. Graft `jack-tree-branch` from primary limb B1's upper crotch (exact B4/B5 socket
  // around (-1.36, 2.16, -0.49)), arching organically out from the right crown shoulder
  // and passing solidly through the locked suspension point (0, 3.52, -0.1).
  const boughCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-1.37, 2.14, -0.50),
      new THREE.Vector3(-1.18, 2.66, -0.42),
      new THREE.Vector3(-0.90, 3.14, -0.32),
      new THREE.Vector3(-0.58, 3.36, -0.22),
      new THREE.Vector3(-0.26, 3.47, -0.14),
      new THREE.Vector3(0.0, 3.52, -0.1),
      new THREE.Vector3(0.11, 3.545, -0.08),
    ],
    false,
    'centripetal',
    0.5,
  )
  const boughSegs = 16
  const boughPoints: THREE.Vector3[] = []
  const boughRadii: number[] = []
  for (let i = 0; i <= boughSegs; i++) {
    const t = i / boughSegs
    boughPoints.push(boughCurve.getPoint(t))
    const taper = THREE.MathUtils.lerp(0.056, 0.022, Math.pow(t, 0.72))
    const collar = 0.013 * Math.pow(Math.max(0, 1 - t / 0.20), 2)
    boughRadii.push(taper + collar)
  }
  const branchMesh = new THREE.Mesh(
    createWatertightBranchGeometry({
      name: 'jack-tree-branch',
      points: boughPoints,
      radii: boughRadii,
      radialSegments: 12,
      baseMode: 'dome',
      tipRoundness: 0.85,
      barkSeed: 97.3,
    }),
    bark,
  )
  branchMesh.name = 'jack-tree-branch'
  branchMesh.castShadow = true
  branchMesh.receiveShadow = true
  branchMesh.userData.toonSurface = { outline: false, shading: 'smooth' }
  fixed.add(branchMesh)

  // Upward shoulder twiglet off `jack-tree-branch` carrying a small accent sprig so the
  // hanging bough integrates seamlessly with the right flank of the maple crown.
  const shoulderTwigName = `jack-tree-twig-${twigCounter++}`
  const shoulderTwig = new THREE.Mesh(
    createWatertightBranchGeometry({
      name: shoulderTwigName,
      points: [
        new THREE.Vector3(-0.98, 3.00, -0.35),
        new THREE.Vector3(-0.90, 3.24, -0.34),
        new THREE.Vector3(-0.82, 3.46, -0.34),
      ],
      radii: [0.023, 0.016, 0.011],
      radialSegments: 8,
      baseMode: 'dome',
      tipRoundness: 0.80,
      barkSeed: 141.7,
    }),
    bark,
  )
  shoulderTwig.name = shoulderTwigName
  shoulderTwig.castShadow = true
  shoulderTwig.receiveShadow = true
  shoulderTwig.userData.toonSurface = { outline: false, shading: 'smooth' }
  fixed.add(shoulderTwig)

  // 3. Rebuild all 18 Simple Tree clumps from the 406 baked leaf-card centroids as
  // clusters of fine sculpted 3D maple-leaf pufflets (2-3 small varied pufflets per card)
  // so the silhouette reads as feathery stylized maple foliage matching the backdrop trees.
  const clumpBuckets: LeafPuffInput[][] = Array.from({ length: SIMPLE_TREE_CLUMP_COUNT }, () => [])
  const helperRef = new THREE.Vector3()
  const tangentU = new THREE.Vector3()
  const tangentV = new THREE.Vector3()

  for (let k = 0; k < SIMPLE_TREE_LEAF_CARD_COUNT; k++) {
    const off = k * SIMPLE_TREE_LEAF_STRIDE
    const clumpId = SIMPLE_TREE_LEAF_CLUMP_IDS[k]!
    const pos = transformPoint(
      SIMPLE_TREE_LEAF_CARDS[off]!,
      SIMPLE_TREE_LEAF_CARDS[off + 1]!,
      SIMPLE_TREE_LEAF_CARDS[off + 2]!,
    )
    const size = SIMPLE_TREE_LEAF_CARDS[off + 3]!
    const clumpNormal = transformDir(
      SIMPLE_TREE_LEAF_CARDS[off + 4]!,
      SIMPLE_TREE_LEAF_CARDS[off + 5]!,
      SIMPLE_TREE_LEAF_CARDS[off + 6]!,
    )
    const bakedRgb: [number, number, number] = [
      SIMPLE_TREE_LEAF_CARDS[off + 10]!,
      SIMPLE_TREE_LEAF_CARDS[off + 11]!,
      SIMPLE_TREE_LEAF_CARDS[off + 12]!,
    ]

    const baseR = Math.max(0.068, size * HERO_HEIGHT * 0.145)
    // Keep maple crown naturally left of the puppet head/coat/hat and raised left-limb swing envelope.
    if (intrudesPuppetZone(pos, baseR)) continue

    helperRef.set(Math.abs(clumpNormal.y) < 0.9 ? 0 : 1, Math.abs(clumpNormal.y) < 0.9 ? 1 : 0, 0)
    tangentU.crossVectors(helperRef, clumpNormal).normalize()
    tangentV.crossVectors(clumpNormal, tangentU).normalize()

    // Spawn 2-3 fine overlapping 3D pufflets around each baked card centroid.
    const subCount = k % 3 === 0 ? 3 : 2
    const baseAngle = hash1(k * 5.71 + 1.3) * Math.PI * 2
    for (let s = 0; s < subCount; s++) {
      const ang = baseAngle + (s / subCount) * Math.PI * 2 + (hash1(k * 11.3 + s * 7.1) - 0.5) * 0.65
      const radialDist = baseR * (subCount === 3 ? 0.62 : 0.50) * (0.70 + 0.55 * hash1(k * 17.3 + s * 4.3))
      const lift = baseR * ((s === 0 ? 0.14 : -0.06) + (hash1(k * 23.1 + s * 3.7) - 0.5) * 0.20)
      const p = pos.clone()
        .addScaledVector(tangentU, Math.cos(ang) * radialDist)
        .addScaledVector(tangentV, Math.sin(ang) * radialDist)
        .addScaledVector(clumpNOrFallback(clumpNormal), lift)
      const r = baseR * (s === 0 ? 1.02 : s === 1 ? 0.86 : 0.74) * (0.86 + 0.26 * hash1(k * 13.7 + s * 9.3))
      if (intrudesPuppetZone(p, r)) continue

      clumpBuckets[clumpId]!.push({
        pos: p,
        radius: r,
        clumpNormal,
        bakedRgb,
        seed: 13.7 + k * 3.17 + s * 71.3,
        toneShift: (hash1(k * 4.21 + s * 19.7) - 0.5) * 2,
      })
    }
  }

  // Add a small airy maple accent sprig on the grafted bough shoulder twiglet (`(-0.82, 3.46, -0.34)`).
  const shoulderCenter = new THREE.Vector3(-0.84, 3.46, -0.34)
  const shoulderPuffs: LeafPuffInput[] = [
    { pos: new THREE.Vector3(-0.88, 3.50, -0.35), radius: 0.105, clumpNormal: new THREE.Vector3(-0.2, 0.85, 0.48).normalize(), bakedRgb: [0.84, 0.84, 0.86], seed: 901.1, toneShift: 0.4 },
    { pos: new THREE.Vector3(-0.78, 3.46, -0.31), radius: 0.092, clumpNormal: new THREE.Vector3(0.25, 0.80, 0.54).normalize(), bakedRgb: [0.82, 0.83, 0.84], seed: 917.3, toneShift: 0.2 },
    { pos: new THREE.Vector3(-0.84, 3.39, -0.38), radius: 0.088, clumpNormal: new THREE.Vector3(0.05, 0.55, -0.83).normalize(), bakedRgb: [0.74, 0.75, 0.76], seed: 931.7, toneShift: -0.3 },
    { pos: new THREE.Vector3(-0.74, 3.53, -0.34), radius: 0.082, clumpNormal: new THREE.Vector3(0.35, 0.88, 0.32).normalize(), bakedRgb: [0.88, 0.88, 0.90], seed: 947.9, toneShift: 0.6 },
    { pos: new THREE.Vector3(-0.92, 3.40, -0.28), radius: 0.095, clumpNormal: new THREE.Vector3(-0.35, 0.68, 0.64).normalize(), bakedRgb: [0.79, 0.80, 0.82], seed: 963.1, toneShift: -0.1 },
    { pos: new THREE.Vector3(-0.80, 3.58, -0.36), radius: 0.084, clumpNormal: new THREE.Vector3(0.05, 0.96, 0.28).normalize(), bakedRgb: [0.90, 0.89, 0.91], seed: 979.5, toneShift: 0.5 },
  ]
  // Attach shoulder sprig onto clump 0 or as its own final clump mesh.
  for (let c = 0; c < SIMPLE_TREE_CLUMP_COUNT; c++) {
    const tufts = clumpBuckets[c]!
    if (tufts.length === 0) continue
    const clumpCenter = transformPoint(
      SIMPLE_TREE_CLUMP_CENTERS[c * 3]!,
      SIMPLE_TREE_CLUMP_CENTERS[c * 3 + 1]!,
      SIMPLE_TREE_CLUMP_CENTERS[c * 3 + 2]!,
    )
    const geo = createMapleClumpGeometry(clumpCenter, tufts)
    const cluster = new THREE.Mesh(geo, leaf)
    cluster.name = `jack-leaf-${c}`
    cluster.position.copy(clumpCenter)
    cluster.castShadow = true
    // Match Simple Tree backdrop foliage (`imported-trees.ts`): avoid self-shadow acne across overlapping pufflets.
    cluster.receiveShadow = false
    cluster.userData.toonSurface = { outline: false, shading: 'smooth' }
    cluster.userData.leafTuftCount = tufts.length
    fixed.add(cluster)
  }

  const shoulderCluster = new THREE.Mesh(createMapleClumpGeometry(shoulderCenter, shoulderPuffs), leaf)
  shoulderCluster.name = `jack-leaf-${SIMPLE_TREE_CLUMP_COUNT}`
  shoulderCluster.position.copy(shoulderCenter)
  shoulderCluster.castShadow = true
  shoulderCluster.receiveShadow = false
  shoulderCluster.userData.toonSurface = { outline: false, shading: 'smooth' }
  shoulderCluster.userData.leafTuftCount = shoulderPuffs.length
  fixed.add(shoulderCluster)
}

function intrudesPuppetZone(p: THREE.Vector3, r: number): boolean {
  // Keep clear of the puppet head/hat/body column.
  if (p.x + r > -0.56 && p.y < 3.65) return true
  // Keep clear of the articulated left-arm / left-leg swing envelope during pulls.
  if (p.x + r > -1.06 && p.y > 1.50 && p.y < 2.85 && p.z + r > -0.24) return true
  return false
}

function clumpNOrFallback(n: THREE.Vector3): THREE.Vector3 {
  return n.lengthSq() > 0.5 ? n : new THREE.Vector3(0, 1, 0)
}
