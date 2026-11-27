import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

type BranchBaseMode = 'flat' | 'dome'

type BranchSpec = {
  name: string
  points: [number, number, number][]
  radiusAt: (t: number) => number
  segments: number
  radialSegments: number
  baseMode: BranchBaseMode
  tipRoundness?: number
  rootFlare?: boolean
  barkSeed: number
}

type ClusterSpec = {
  pos: [number, number, number]
  radii: [number, number, number]
  seed: number
  /** Warmth/sunlight bias in [-1, 1]: positive = sunlit crown crest, negative = shaded underside. */
  warmth: number
  /** Cluster orientation for radiating organic foliage tufts rather than flat stacked discs. */
  rotX: number
  rotY: number
  rotZ: number
  /** Number of prominent botanical leaf-tuft lobes sculpted into the cluster silhouette. */
  lobeCount: number
}

function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return s - Math.floor(s)
}

/**
 * Generates an indexed, strictly watertight, pole-free frequency-`freq` geodesic unit
 * sphere by barycentrically subdividing each icosahedron face into `freq * freq` triangles
 * (`freq = 6` -> 362 unique vertices, 720 nearly-equilateral triangles).
 */
function buildGeodesicUnitSphere(freq: number): { verts: THREE.Vector3[]; tris: [number, number, number][] } {
  const phi = (1 + Math.sqrt(5)) / 2
  const baseRaw: [number, number, number][] = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ]
  const baseVerts = baseRaw.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize())
  const baseFaces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ]

  const verts: THREE.Vector3[] = []
  const weldMap = new Map<string, number>()
  const addVert = (v: THREE.Vector3): number => {
    const unit = v.clone().normalize()
    const key = `${Math.round(unit.x * 1e5)},${Math.round(unit.y * 1e5)},${Math.round(unit.z * 1e5)}`
    const existing = weldMap.get(key)
    if (existing !== undefined) return existing
    const idx = verts.length
    verts.push(unit)
    weldMap.set(key, idx)
    return idx
  }

  const tris: [number, number, number][] = []
  const p = new THREE.Vector3()

  for (const [ia, ib, ic] of baseFaces) {
    const va = baseVerts[ia]!
    const vb = baseVerts[ib]!
    const vc = baseVerts[ic]!
    const grid: number[][] = []

    for (let row = 0; row <= freq; row++) {
      const cols: number[] = []
      const u = row / freq
      for (let col = 0; col <= freq - row; col++) {
        const v = col / freq
        const w = 1 - u - v
        p.set(
          va.x * w + vb.x * v + vc.x * u,
          va.y * w + vb.y * v + vc.y * u,
          va.z * w + vb.z * v + vc.z * u,
        )
        cols.push(addVert(p))
      }
      grid.push(cols)
    }

    for (let row = 0; row < freq; row++) {
      const cur = grid[row]!
      const nxt = grid[row + 1]!
      const count = freq - row
      for (let col = 0; col < count; col++) {
        // Upward sub-triangle preserving original CCW outward orientation.
        tris.push([cur[col]!, cur[col + 1]!, nxt[col]!])
        if (col < count - 1) {
          // Inverted inner sub-triangle sharing exact interior edges.
          tris.push([cur[col + 1]!, nxt[col + 1]!, nxt[col]!])
        }
      }
    }
  }

  return { verts, tris }
}

const SHARED_GEODESIC = buildGeodesicUnitSphere(6)
const CANOPY_CENTER = new THREE.Vector3(-1.24, 3.72, -0.35)
const KEY_DIR = new THREE.Vector3(-3, 5, 4).normalize()

// Warm stylized Komorebi woodland greens harmonized with the garden meadow and russet backdrop trees.
// Tuned just below the botanical highlight shoulder knee so sunlit top lobes keep crisp scalloped relief.
const LEAF_SUN_TIP = new THREE.Color('#bccd5e')
const LEAF_WARM_MID = new THREE.Color('#8fb552')
const LEAF_FRESH_MID = new THREE.Color('#73a04b')
const LEAF_COOL_MID = new THREE.Color('#578447')
const LEAF_SHADE_UNDER = new THREE.Color('#426b43')

/**
 * Watertight FrontSide sculpted leaf-tuft cluster with prominent multi-lobe
 * botanical scalloping, canopy-coherent outward clump normals (reducing per-blob
 * shadow seams while strictly maintaining `faceNormal.dot(vertexNormal) > 0`),
 * and warm-tip to cool-underside Komorebi vertex colors.
 */
function createScallopedLeafClusterGeometry(spec: ClusterSpec): THREE.BufferGeometry {
  const { verts: dirs, tris } = SHARED_GEODESIC
  const [rx, ry, rz] = spec.radii
  const [cx, cy, cz] = spec.pos

  // Distribute prominent botanical leaf-tuft lobes around the cluster shell to create
  // a genuinely scalloped, leafy silhouette instead of a smooth ellipsoid.
  const lobes: { dir: THREE.Vector3; weight: number; sharp: number }[] = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let k = 0; k < spec.lobeCount; k++) {
    const t = (k + 0.5) / spec.lobeCount
    const y = THREE.MathUtils.clamp(0.84 - 1.56 * t + (hash1(spec.seed + k * 7.3) - 0.5) * 0.24, -0.78, 0.90)
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const ang = k * goldenAngle + spec.seed * 2.17 + (hash1(spec.seed + k * 13.7) - 0.5) * 0.42
    const dir = new THREE.Vector3(Math.cos(ang) * rad, y, Math.sin(ang) * rad).normalize()
    const weight = 0.23 + 0.08 * hash1(spec.seed + k * 19.1)
    const sharp = 3.6 + 1.1 * hash1(spec.seed + k * 23.9)
    lobes.push({ dir, weight, sharp })
  }

  const euler = new THREE.Euler(spec.rotX, spec.rotY, spec.rotZ, 'YXZ')
  const quat = new THREE.Quaternion().setFromEuler(euler)

  const positions: THREE.Vector3[] = []
  const lobeStrengths: number[] = []
  const phaseA = spec.seed * 1.73
  const phaseB = spec.seed * 2.91

  for (const d of dirs) {
    let puff = 0
    for (const lobe of lobes) {
      const align = d.dot(lobe.dir)
      if (align > 0) puff += lobe.weight * Math.pow(align, lobe.sharp)
    }
    // Secondary crisp scalloped leaf-margin ripple purely in 3D direction space (zero poles/seams).
    const scallop = 0.062 * Math.sin(d.x * 4.4 + d.z * 3.8 + phaseA) * Math.cos(d.y * 3.4 + phaseB)
      + 0.032 * Math.cos((d.x - d.z) * 5.2 + d.y * 4.1 - phaseA * 0.6)
    const radial = THREE.MathUtils.clamp(0.76 + puff + scallop, 0.64, 1.18)

    // Gently cushion the underside without flattening every cluster into identical discs.
    const underSquash = d.y < 0 ? 1 + d.y * 0.11 : 1
    const pt = new THREE.Vector3(
      d.x * radial * rx,
      d.y * radial * ry * underSquash,
      d.z * radial * rz,
    ).applyQuaternion(quat)

    positions.push(pt)
    lobeStrengths.push(THREE.MathUtils.clamp((radial - 0.72) / 0.40, 0, 1))
  }

  // Compute area-weighted smooth vertex normals and per-face unit normals.
  const smoothNormals = positions.map(() => new THREE.Vector3())
  const faceUnitNormals: THREE.Vector3[] = []
  const incidentFaces: number[][] = positions.map(() => [])
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const cross = new THREE.Vector3()

  for (let f = 0; f < tris.length; f++) {
    const [i0, i1, i2] = tris[f]!
    const v0 = positions[i0]!
    const v1 = positions[i1]!
    const v2 = positions[i2]!
    e1.subVectors(v1, v0)
    e2.subVectors(v2, v0)
    cross.crossVectors(e1, e2)
    smoothNormals[i0]!.add(cross)
    smoothNormals[i1]!.add(cross)
    smoothNormals[i2]!.add(cross)
    faceUnitNormals.push(cross.clone().normalize())
    incidentFaces[i0]!.push(f)
    incidentFaces[i1]!.push(f)
    incidentFaces[i2]!.push(f)
  }

  // Canopy-global normal transfer (Ghibli/Komorebi stylized foliage trick):
  // blend each vertex's normal toward the whole crown's outward dome normal so adjacent
  // clusters merge into painterly mass rather than individually dark-bellied pebbles,
  // while strictly guarding `faceNormal.dot(vertexNormal) >= 0.18` for manifold checks.
  const finalNormals: THREE.Vector3[] = []
  const canopyDome = new THREE.Vector3()
  const candidate = new THREE.Vector3()

  for (let i = 0; i < positions.length; i++) {
    const sn = smoothNormals[i]!.normalize()
    const p = positions[i]!
    canopyDome.set(
      (cx + p.x - CANOPY_CENTER.x) * 0.85,
      (cy + p.y - CANOPY_CENTER.y) + 0.34,
      (cz + p.z - CANOPY_CENTER.z) * 0.90,
    ).normalize()

    let blend = 0.38
    let accepted = sn.clone()
    while (blend >= 0.04) {
      candidate.copy(sn).lerp(canopyDome, blend).normalize()
      let ok = true
      for (const f of incidentFaces[i]!) {
        if (faceUnitNormals[f]!.dot(candidate) < 0.20) {
          ok = false
          break
        }
      }
      if (ok) {
        accepted.copy(candidate)
        break
      }
      blend *= 0.65
    }
    if (!Number.isFinite(accepted.x) || accepted.lengthSq() < 0.5) accepted.copy(sn)
    finalNormals.push(accepted)
  }

  // Bake canopy-global + scalloped-lobe Komorebi linear vertex colors:
  // warm sunlit yellow-green tips on upper/outer tufts, cool deeper woodland green
  // in lower/inner canopy pockets and scalloped valleys (avoiding harsh per-blob rings).
  const posArr = new Float32Array(positions.length * 3)
  const normArr = new Float32Array(positions.length * 3)
  const colArr = new Float32Array(positions.length * 3)
  const worldPos = new THREE.Vector3()
  const relCanopy = new THREE.Vector3()
  const c = new THREE.Color()
  const tmp = new THREE.Color()

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!
    const n = finalNormals[i]!
    posArr[i * 3] = p.x
    posArr[i * 3 + 1] = p.y
    posArr[i * 3 + 2] = p.z
    normArr[i * 3] = n.x
    normArr[i * 3 + 1] = n.y
    normArr[i * 3 + 2] = n.z

    worldPos.set(cx + p.x, cy + p.y, cz + p.z)
    relCanopy.subVectors(worldPos, CANOPY_CENTER)

    // Whole-canopy vertical and directional sunlight coordinates (unifies overlapping clusters).
    const canopyY = THREE.MathUtils.clamp((worldPos.y - 3.38) / 0.76, 0, 1)
    const canopySun = THREE.MathUtils.clamp(
      relCanopy.clone().normalize().dot(KEY_DIR) * 0.5 + 0.5,
      0,
      1,
    )
    const normalSun = THREE.MathUtils.clamp(n.dot(KEY_DIR) * 0.5 + 0.5, 0, 1)
    const radialOut = THREE.MathUtils.clamp(
      Math.hypot(relCanopy.x / 0.58, relCanopy.y / 0.36, relCanopy.z / 0.30),
      0,
      1.2,
    )
    const lobeTip = lobeStrengths[i]!

    // Warm yellow-green sunlit lift concentrates on canopy top, sunlit left-front, and raised scalloped tips.
    const sunWeight = THREE.MathUtils.clamp(
      canopyY * 0.38 + canopySun * 0.18 + normalSun * 0.16 + lobeTip * 0.28 + spec.warmth * 0.10,
      0,
      1,
    )
    // Cool deep-green shade concentrates on the lower canopy underside, inner core, and scalloped valleys.
    const shadeWeight = THREE.MathUtils.clamp(
      (1 - canopyY) * 0.48 + (1 - Math.min(1, radialOut)) * 0.22 + (1 - lobeTip) * 0.30 - spec.warmth * 0.10,
      0,
      1,
    )

    c.copy(LEAF_FRESH_MID)
    if (sunWeight > 0.42) {
      const hi = THREE.MathUtils.smoothstep(sunWeight, 0.42, 0.96)
      tmp.copy(LEAF_WARM_MID).lerp(LEAF_SUN_TIP, THREE.MathUtils.smoothstep(sunWeight, 0.66, 0.98))
      c.lerp(tmp, hi * 0.88)
    }
    if (shadeWeight > 0.30) {
      const lo = THREE.MathUtils.smoothstep(shadeWeight, 0.30, 0.95)
      tmp.copy(LEAF_COOL_MID).lerp(LEAF_SHADE_UNDER, THREE.MathUtils.smoothstep(shadeWeight, 0.58, 0.96))
      c.lerp(tmp, lo * 0.84)
    }

    // Subtle painterly brushstroke leaf-tuft dapple + subtle per-cluster warmth variation.
    const dapple = (Math.sin(worldPos.x * 20.5 + worldPos.y * 14.0 + spec.seed)
      * Math.cos(worldPos.z * 17.5 - worldPos.y * 12.2)) * 0.048
    const clusterWarm = (hash1(spec.seed * 3.7) - 0.5) * 0.065
    colArr[i * 3] = THREE.MathUtils.clamp(c.r * (1 + dapple + clusterWarm), 0.02, 1.0)
    colArr[i * 3 + 1] = THREE.MathUtils.clamp(c.g * (1 + dapple * 0.95 + clusterWarm * 0.48), 0.02, 1.0)
    colArr[i * 3 + 2] = THREE.MathUtils.clamp(c.b * (1 + dapple * 0.50 - clusterWarm * 0.68), 0.02, 1.0)
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

// Living warm storybook bark palette (anchored near original #a48560).
const BARK_LIGHT = new THREE.Color('#c39e72')
const BARK_MID = new THREE.Color('#9f7e59')
const BARK_DARK = new THREE.Color('#6b5138')
const BARK_MOSS_TINT = new THREE.Color('#6d6f4c')

/**
 * Watertight curved, tapered, closed solid branch/trunk with rotation-minimizing
 * Bishop frames, optional grounded root flare (`y = 0`), smooth rounded dome ends,
 * and living-bark vertex colors.
 */
function createTaperedBranchGeometry(spec: BranchSpec): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    spec.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
    0.5,
  )
  const segs = spec.segments
  const radSegs = spec.radialSegments
  const tipRound = spec.tipRoundness ?? 0.72

  const centers: THREE.Vector3[] = []
  const tangents: THREE.Vector3[] = []
  const us: THREE.Vector3[] = []
  const vs: THREE.Vector3[] = []
  const ts: number[] = []

  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    ts.push(t)
    centers.push(curve.getPoint(t))
    tangents.push(curve.getTangent(t).normalize())
  }

  // Right-handed rotation-minimizing frame (U, V, T) with U × V = +T.
  const t0 = tangents[0]!
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, -1)
  const u0 = new THREE.Vector3().crossVectors(ref, t0).normalize()
  const v0 = new THREE.Vector3().crossVectors(t0, u0).normalize()
  us.push(u0)
  vs.push(v0)

  const qStep = new THREE.Quaternion()
  for (let i = 1; i <= segs; i++) {
    qStep.setFromUnitVectors(tangents[i - 1]!, tangents[i]!)
    const ui = us[i - 1]!.clone().applyQuaternion(qStep)
    ui.addScaledVector(tangents[i]!, -ui.dot(tangents[i]!)).normalize()
    const vi = new THREE.Vector3().crossVectors(tangents[i]!, ui).normalize()
    us.push(ui)
    vs.push(vi)
  }

  const rings: { pts: THREE.Vector3[]; t: number; angles: number[] }[] = []

  const ringRadius = (t: number, angle: number): number => {
    let r = spec.radiusAt(t)
    if (spec.rootFlare && t < 0.24) {
      const f = 1 - t / 0.24
      const flareEnv = f * f * (3 - 2 * f)
      // Gentle 4-lobe organic root buttress flaring smoothly to ground contact.
      const buttress = 0.58 + 0.42 * Math.cos(angle * 4 + 0.55) + 0.14 * Math.sin(angle * 3 - 0.85)
      r *= 1 + flareEnv * (0.30 + 0.24 * Math.max(0, buttress))
    } else {
      r *= 1 + 0.028 * Math.sin(angle * 3 + t * 4.5 + spec.barkSeed)
    }
    return r
  }

  let basePole: THREE.Vector3 | null = null
  if (spec.baseMode === 'dome') {
    const c0 = centers[0]!
    const tn0 = tangents[0]!
    const u = us[0]!
    const v = vs[0]!
    const r0 = spec.radiusAt(0)
    const domeDepth = r0 * 0.52
    basePole = c0.clone().addScaledVector(tn0, -domeDepth)
    for (const alpha of [Math.PI * 0.36, Math.PI * 0.18]) {
      const cosA = Math.cos(alpha)
      const sinA = Math.sin(alpha)
      const pts: THREE.Vector3[] = []
      const angles: number[] = []
      for (let j = 0; j < radSegs; j++) {
        const angle = (j / radSegs) * Math.PI * 2
        const rr = ringRadius(0, angle) * cosA
        pts.push(
          c0.clone()
            .addScaledVector(tn0, -domeDepth * sinA)
            .addScaledVector(u, Math.cos(angle) * rr)
            .addScaledVector(v, Math.sin(angle) * rr),
        )
        angles.push(angle)
      }
      rings.push({ pts, t: 0, angles })
    }
  }

  for (let i = 0; i <= segs; i++) {
    const t = ts[i]!
    const c = centers[i]!
    const u = i === 0 && spec.baseMode === 'flat' ? new THREE.Vector3(1, 0, 0) : us[i]!
    const v = i === 0 && spec.baseMode === 'flat' ? new THREE.Vector3(0, 0, -1) : vs[i]!
    const pts: THREE.Vector3[] = []
    const angles: number[] = []
    for (let j = 0; j < radSegs; j++) {
      const angle = (j / radSegs) * Math.PI * 2
      const rr = ringRadius(t, angle)
      const pt = c.clone()
        .addScaledVector(u, Math.cos(angle) * rr)
        .addScaledVector(v, Math.sin(angle) * rr)
      if (i === 0 && spec.baseMode === 'flat') pt.y = 0
      pts.push(pt)
      angles.push(angle)
    }
    rings.push({ pts, t, angles })
  }

  // Smooth rounded tip dome cap at t = 1 (no flat sawed cylinder stubs).
  const cEnd = centers[segs]!
  const tEnd = tangents[segs]!
  const uEnd = us[segs]!
  const vEnd = vs[segs]!
  const rEnd = spec.radiusAt(1)
  const tipDepth = rEnd * tipRound
  for (const alpha of [Math.PI * 0.18, Math.PI * 0.36]) {
    const cosA = Math.cos(alpha)
    const sinA = Math.sin(alpha)
    const pts: THREE.Vector3[] = []
    const angles: number[] = []
    for (let j = 0; j < radSegs; j++) {
      const angle = (j / radSegs) * Math.PI * 2
      const rr = ringRadius(1, angle) * cosA
      pts.push(
        cEnd.clone()
          .addScaledVector(tEnd, tipDepth * sinA)
          .addScaledVector(uEnd, Math.cos(angle) * rr)
          .addScaledVector(vEnd, Math.sin(angle) * rr),
      )
      angles.push(angle)
    }
    rings.push({ pts, t: 1, angles })
  }
  const tipPole = cEnd.clone().addScaledVector(tEnd, tipDepth)

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
    const flatCenter = centers[0]!.clone()
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

    const furrow = 0.55 * Math.sin(meta.angle * 5 + meta.t * 3.8 + spec.barkSeed)
      + 0.45 * Math.cos(meta.angle * 9 - meta.t * 6.2 + spec.barkSeed * 1.7)
    const sunLift = THREE.MathUtils.clamp(n.dot(KEY_DIR) * 0.5 + 0.5, 0, 1)
    const canopyShade = THREE.MathUtils.smoothstep(p.y, 3.05, 3.68) * THREE.MathUtils.smoothstep(-0.72, -1.25, p.x)
    const groundAO = spec.rootFlare ? 1 - THREE.MathUtils.smoothstep(p.y, 0.0, 0.44) : 0

    c.copy(BARK_MID)
    if (furrow > 0) c.lerp(BARK_LIGHT, furrow * 0.22 + sunLift * 0.18)
    else c.lerp(BARK_DARK, (-furrow) * 0.28 + (1 - sunLift) * 0.10)

    if (canopyShade > 0) c.lerp(BARK_DARK, canopyShade * 0.26)
    if (groundAO > 0) {
      c.lerp(BARK_DARK, groundAO * 0.20)
      c.lerp(BARK_MOSS_TINT, groundAO * 0.14)
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

// 16 staggered, multi-scale scalloped leaf clusters forming an asymmetric storybook crown
// within the original framing bounds (x in ~[-1.85, -0.52], y in ~[3.40, 4.14], z in ~[-0.70, -0.10]).
const LEAF_CLUSTERS: readonly ClusterSpec[] = [
  // Deep shaded under-canopy core & back volume (3 cool woodland green cushions)
  { pos: [-1.54, 3.58, -0.46], radii: [0.20, 0.15, 0.18], seed: 11.3, warmth: -0.78, rotX: 0.12, rotY: 0.28, rotZ: 0.24, lobeCount: 7 },
  { pos: [-1.22, 3.58, -0.50], radii: [0.21, 0.16, 0.19], seed: 19.7, warmth: -0.84, rotX: -0.10, rotY: -0.35, rotZ: -0.14, lobeCount: 7 },
  { pos: [-0.86, 3.62, -0.43], radii: [0.185, 0.145, 0.165], seed: 29.1, warmth: -0.62, rotX: 0.16, rotY: 0.48, rotZ: -0.28, lobeCount: 6 },

  // Main asymmetric billowing crown body (4 varied primary tufts)
  { pos: [-1.59, 3.74, -0.29], radii: [0.20, 0.165, 0.18], seed: 37.9, warmth: 0.05, rotX: -0.14, rotY: -0.22, rotZ: 0.28, lobeCount: 8 },
  { pos: [-1.28, 3.74, -0.26], radii: [0.22, 0.175, 0.19], seed: 43.3, warmth: 0.18, rotX: 0.10, rotY: 0.20, rotZ: 0.08, lobeCount: 8 },
  { pos: [-0.95, 3.75, -0.30], radii: [0.195, 0.155, 0.175], seed: 53.7, warmth: 0.10, rotX: -0.12, rotY: -0.45, rotZ: -0.22, lobeCount: 7 },
  { pos: [-1.42, 3.82, -0.48], radii: [0.21, 0.17, 0.185], seed: 61.1, warmth: -0.16, rotX: 0.18, rotY: 0.64, rotZ: 0.18, lobeCount: 7 },

  // Upper sunlit crown crest & stepped right shoulder (4 warm tufts)
  { pos: [-1.49, 3.92, -0.34], radii: [0.185, 0.155, 0.17], seed: 71.9, warmth: 0.62, rotX: -0.10, rotY: -0.32, rotZ: 0.20, lobeCount: 7 },
  { pos: [-1.18, 3.97, -0.32], radii: [0.195, 0.16, 0.18], seed: 83.3, warmth: 0.84, rotX: 0.14, rotY: 0.36, rotZ: -0.10, lobeCount: 8 },
  { pos: [-0.84, 3.86, -0.36], radii: [0.165, 0.135, 0.155], seed: 97.7, warmth: 0.54, rotX: -0.16, rotY: -0.18, rotZ: -0.26, lobeCount: 6 },
  { pos: [-1.28, 3.92, -0.52], radii: [0.18, 0.145, 0.165], seed: 109.1, warmth: 0.28, rotX: 0.20, rotY: 0.50, rotZ: 0.12, lobeCount: 6 },

  // Crisp outer & sunlit silhouette-breaking sprigs (5 smaller lively tufts)
  { pos: [-1.72, 3.80, -0.36], radii: [0.125, 0.105, 0.115], seed: 127.3, warmth: 0.42, rotX: 0.12, rotY: 0.16, rotZ: 0.36, lobeCount: 6 },
  { pos: [-0.67, 3.74, -0.30], radii: [0.125, 0.105, 0.115], seed: 139.9, warmth: 0.45, rotX: -0.14, rotY: -0.58, rotZ: -0.34, lobeCount: 6 },
  { pos: [-1.01, 3.97, -0.25], radii: [0.13, 0.105, 0.12], seed: 151.7, warmth: 0.82, rotX: 0.10, rotY: 0.30, rotZ: -0.16, lobeCount: 6 },
  { pos: [-1.60, 3.96, -0.43], radii: [0.12, 0.10, 0.11], seed: 167.1, warmth: 0.68, rotX: -0.18, rotY: 0.42, rotZ: 0.28, lobeCount: 6 },
  { pos: [-1.34, 4.02, -0.23], radii: [0.115, 0.095, 0.11], seed: 181.5, warmth: 0.92, rotX: 0.15, rotY: -0.40, rotZ: 0.14, lobeCount: 6 },
]

/**
 * Adds the stylized supporting tree (flared trunk, seamless curved hanging bough
 * passing through the exact suspension point `(0, 3.52, -0.1)`, three short crown
 * twigs, and 16 staggered scalloped watertight leaf clusters) to `fixed`.
 * All materials keep `map === null` with vertex colors and shader-only optics.
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
      roughness: 0.88,
      metalness: 0,
      vertexColors: true,
    },
    { kind: 'leaf', strength: 0.22, fiber: false },
  )
  // Trigger shared Komorebi wrapped foliage lighting while preserving full vertex-color warmth/depth.
  leaf.userData.treeClusterNormals = true
  leaf.userData.komorebiPigment = true

  const branches: BranchSpec[] = [
    // Main trunk: smooth grounded root flare at y = 0, graceful organic bend into the crown core.
    {
      name: 'jack-tree-trunk',
      points: [
        [-1.42, 0.0, -0.35],
        [-1.38, 0.72, -0.32],
        [-1.30, 1.78, -0.29],
        [-1.31, 2.74, -0.33],
        [-1.34, 3.28, -0.35],
        [-1.38, 3.68, -0.36],
      ],
      radiusAt: (t) => {
        const baseTaper = THREE.MathUtils.lerp(0.146, 0.072, Math.pow(t, 0.92))
        const collar = 0.011 * Math.exp(-Math.pow((t - 0.84) / 0.10, 2))
        return baseTaper + collar
      },
      segments: 20,
      radialSegments: 18,
      baseMode: 'flat',
      tipRoundness: 0.65,
      rootFlare: true,
      barkSeed: 3.1,
    },
    // Hanging bough: emerges seamlessly from inside the trunk crotch with flared collar, sweeps to (0, 3.52, -0.1).
    {
      name: 'jack-tree-branch',
      points: [
        [-1.34, 3.16, -0.35],
        [-1.23, 3.31, -0.34],
        [-0.96, 3.34, -0.29],
        [-0.48, 3.38, -0.20],
        [0.0, 3.54, -0.1],
        [0.055, 3.565, -0.09],
      ],
      radiusAt: (t) => {
        const taper = THREE.MathUtils.lerp(0.088, 0.036, Math.pow(t, 0.72))
        const collar = 0.018 * Math.pow(Math.max(0, 1 - t / 0.24), 2)
        return taper + collar
      },
      segments: 16,
      radialSegments: 14,
      baseMode: 'dome',
      tipRoundness: 0.85,
      barkSeed: 9.7,
    },
    // Right crown twig: arches smoothly from the bough shoulder up into the right foliage clusters.
    {
      name: 'jack-tree-twig',
      points: [
        [-1.08, 3.33, -0.31],
        [-0.98, 3.49, -0.31],
        [-0.86, 3.70, -0.33],
      ],
      radiusAt: (t) => THREE.MathUtils.lerp(0.044, 0.021, t),
      segments: 8,
      radialSegments: 10,
      baseMode: 'dome',
      tipRoundness: 0.75,
      barkSeed: 15.3,
    },
    // Left crown twig: forks from the upper trunk just below the left underside so a subtle natural fork peeks out.
    {
      name: 'jack-tree-twig-1',
      points: [
        [-1.34, 3.24, -0.34],
        [-1.48, 3.42, -0.34],
        [-1.60, 3.62, -0.34],
      ],
      radiusAt: (t) => THREE.MathUtils.lerp(0.046, 0.021, t),
      segments: 8,
      radialSegments: 10,
      baseMode: 'dome',
      tipRoundness: 0.75,
      barkSeed: 22.9,
    },
    // Upper-back crown twig: supports the upper-back crown mass for layered 3D structure.
    {
      name: 'jack-tree-twig-2',
      points: [
        [-1.36, 3.52, -0.35],
        [-1.31, 3.70, -0.40],
        [-1.23, 3.87, -0.44],
      ],
      radiusAt: (t) => THREE.MathUtils.lerp(0.040, 0.019, t),
      segments: 8,
      radialSegments: 10,
      baseMode: 'dome',
      tipRoundness: 0.75,
      barkSeed: 31.4,
    },
  ]

  for (const spec of branches) {
    const item = new THREE.Mesh(createTaperedBranchGeometry(spec), bark)
    item.name = spec.name
    item.castShadow = item.receiveShadow = true
    fixed.add(item)
  }

  for (let i = 0; i < LEAF_CLUSTERS.length; i++) {
    const spec = LEAF_CLUSTERS[i]!
    const cluster = new THREE.Mesh(createScallopedLeafClusterGeometry(spec), leaf)
    cluster.name = `jack-leaf-${i}`
    cluster.position.set(...spec.pos)
    cluster.castShadow = cluster.receiveShadow = true
    // Disable per-blob toon-soft silhouette ink so layered clusters read as soft painterly foliage.
    cluster.userData.toonSurface = { outline: false }
    fixed.add(cluster)
  }
}
