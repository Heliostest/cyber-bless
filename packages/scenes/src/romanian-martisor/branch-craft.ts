import * as THREE from 'three'

export type Vec3Tuple = readonly [number, number, number]

export interface TaperedBranchOptions {
  points: readonly Vec3Tuple[]
  radiusAt: (t: number, angle: number) => number
  tubularSegments?: number
  radialSegments?: number
  capStart?: 'flat' | 'dome'
  capEnd?: 'flat' | 'dome'
  uvLengthScale?: number
}

/**
 * Builds a strictly closed, outward-oriented curved tapered branch solid with
 * parallel-transport (Bishop) frames, seamless circumferential UVs matching
 * `createLivingBarkMaterial()` (`u` around circumference, `v` along branch length),
 * and rounded dome tips that eliminate flat sawn pipe caps.
 */
export function createTaperedBranchGeometry(options: TaperedBranchOptions): THREE.BufferGeometry {
  const {
    points,
    radiusAt,
    tubularSegments = 16,
    radialSegments = 14,
    capStart = 'dome',
    capEnd = 'dome',
    uvLengthScale = 1,
  } = options

  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
  const startDomeSteps = capStart === 'dome' ? 2 : 0
  const endDomeSteps = capEnd === 'dome' ? 3 : 0

  const startPt = curve.getPoint(0)
  const startTan = curve.getTangent(0).normalize()
  const endPt = curve.getPoint(1)
  const endTan = curve.getTangent(1).normalize()

  const centers: THREE.Vector3[] = []
  const tangents: THREE.Vector3[] = []
  const ringT: number[] = []
  const ringRadialScale: number[] = []
  const ringV: number[] = []

  const rStartMean = radiusAt(0, 0)
  const rEndMean = radiusAt(1, 0)

  for (let d = startDomeSteps; d >= 1; d--) {
    const phi = (d / (startDomeSteps + 1)) * (Math.PI * 0.5)
    centers.push(startPt.clone().addScaledVector(startTan, -rStartMean * 0.65 * Math.sin(phi)))
    tangents.push(startTan.clone())
    ringT.push(0)
    ringRadialScale.push(Math.max(0.18, Math.cos(phi)))
    ringV.push(-0.02 * d * uvLengthScale)
  }

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments
    centers.push(curve.getPoint(t))
    tangents.push(curve.getTangent(t).normalize())
    ringT.push(t)
    ringRadialScale.push(1)
    ringV.push(t * uvLengthScale)
  }

  for (let d = 1; d <= endDomeSteps; d++) {
    const phi = (d / (endDomeSteps + 1)) * (Math.PI * 0.5)
    centers.push(endPt.clone().addScaledVector(endTan, rEndMean * 0.72 * Math.sin(phi)))
    tangents.push(endTan.clone())
    ringT.push(1)
    ringRadialScale.push(Math.max(0.16, Math.cos(phi)))
    ringV.push((1 + 0.02 * d) * uvLengthScale)
  }

  const ringCount = centers.length
  const ringStride = radialSegments + 1
  const totalVerts = 2 + ringCount * ringStride

  // Twist-free parallel-transport frames.
  const normalsFrame: THREE.Vector3[] = []
  const binormalsFrame: THREE.Vector3[] = []
  const t0 = tangents[0]!
  const ref = Math.abs(t0.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
  let nCur = new THREE.Vector3().crossVectors(ref, t0).normalize()
  let bCur = new THREE.Vector3().crossVectors(t0, nCur).normalize()
  if (new THREE.Vector3().crossVectors(nCur, bCur).dot(t0) < 0) bCur.negate()
  normalsFrame.push(nCur.clone())
  binormalsFrame.push(bCur.clone())

  const rotQ = new THREE.Quaternion()
  for (let i = 1; i < ringCount; i++) {
    const prevT = tangents[i - 1]!
    const curT = tangents[i]!
    rotQ.setFromUnitVectors(prevT, curT)
    nCur = nCur.clone().applyQuaternion(rotQ)
    nCur.addScaledVector(curT, -nCur.dot(curT))
    if (nCur.lengthSq() < 1e-10) {
      const alt = Math.abs(curT.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
      nCur.crossVectors(alt, curT)
    }
    nCur.normalize()
    bCur = new THREE.Vector3().crossVectors(curT, nCur).normalize()
    if (new THREE.Vector3().crossVectors(nCur, bCur).dot(curT) < 0) bCur.negate()
    normalsFrame.push(nCur.clone())
    binormalsFrame.push(bCur.clone())
  }

  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const indices: number[] = []

  // Vertex 0: start pole; Vertex 1: end pole.
  const startPole = capStart === 'dome'
    ? startPt.clone().addScaledVector(startTan, -rStartMean * 0.65)
    : startPt.clone()
  const endPole = capEnd === 'dome'
    ? endPt.clone().addScaledVector(endTan, rEndMean * 0.72)
    : endPt.clone()

  positions[0] = startPole.x; positions[1] = startPole.y; positions[2] = startPole.z
  uvs[0] = 0.5; uvs[1] = 0
  positions[3] = endPole.x; positions[4] = endPole.y; positions[5] = endPole.z
  uvs[2] = 0.5; uvs[3] = uvLengthScale

  for (let r = 0; r < ringCount; r++) {
    const c = centers[r]!
    const N = normalsFrame[r]!
    const B = binormalsFrame[r]!
    const t = ringT[r]!
    const scale = ringRadialScale[r]!
    const vCoord = ringV[r]!
    for (let j = 0; j <= radialSegments; j++) {
      const angle = j === radialSegments ? 0 : (j / radialSegments) * Math.PI * 2
      const rad = Math.max(0.0012, radiusAt(t, angle) * scale)
      const ca = Math.cos(angle), sa = Math.sin(angle)
      const vi = 2 + r * ringStride + j
      positions[vi * 3] = c.x + rad * (N.x * ca + B.x * sa)
      positions[vi * 3 + 1] = c.y + rad * (N.y * ca + B.y * sa)
      positions[vi * 3 + 2] = c.z + rad * (N.z * ca + B.z * sa)
      uvs[vi * 2] = j / radialSegments
      uvs[vi * 2 + 1] = vCoord
    }
  }

  for (let j = 0; j < radialSegments; j++) {
    indices.push(0, 2 + j + 1, 2 + j)
  }
  for (let r = 0; r < ringCount - 1; r++) {
    const row0 = 2 + r * ringStride
    const row1 = 2 + (r + 1) * ringStride
    for (let j = 0; j < radialSegments; j++) {
      indices.push(row0 + j, row0 + j + 1, row1 + j)
      indices.push(row0 + j + 1, row1 + j + 1, row1 + j)
    }
  }
  const lastRow = 2 + (ringCount - 1) * ringStride
  for (let j = 0; j < radialSegments; j++) {
    indices.push(1, lastRow + j, lastRow + j + 1)
  }

  // Smooth area-weighted normals welded across the UV seam.
  const logicalNormal = new Float32Array((2 + ringCount * radialSegments) * 3)
  const logicalOf = (vi: number) => {
    if (vi < 2) return vi
    const rel = vi - 2
    const r = Math.floor(rel / ringStride)
    const j = rel % ringStride
    return 2 + r * radialSegments + (j === radialSegments ? 0 : j)
  }
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3()
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3()
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]!, ib = indices[i + 1]!, ic = indices[i + 2]!
    va.set(positions[ia * 3]!, positions[ia * 3 + 1]!, positions[ia * 3 + 2]!)
    vb.set(positions[ib * 3]!, positions[ib * 3 + 1]!, positions[ib * 3 + 2]!)
    vc.set(positions[ic * 3]!, positions[ic * 3 + 1]!, positions[ic * 3 + 2]!)
    e1.subVectors(vb, va)
    e2.subVectors(vc, va)
    fn.crossVectors(e1, e2)
    for (const vi of [ia, ib, ic]) {
      const li = logicalOf(vi)
      logicalNormal[li * 3] += fn.x
      logicalNormal[li * 3 + 1] += fn.y
      logicalNormal[li * 3 + 2] += fn.z
    }
  }
  for (let vi = 0; vi < totalVerts; vi++) {
    const li = logicalOf(vi)
    const nx = logicalNormal[li * 3]!, ny = logicalNormal[li * 3 + 1]!, nz = logicalNormal[li * 3 + 2]!
    const len = Math.hypot(nx, ny, nz)
    if (len > 1e-12) {
      normals[vi * 3] = nx / len
      normals[vi * 3 + 1] = ny / len
      normals[vi * 3 + 2] = nz / len
    } else {
      normals[vi * 3 + 1] = vi === 0 ? -1 : 1
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Watertight FrontSide spring blossom bud solid (index-level manifold, strictly
 * positive signed volume) with smooth olive-green calyx base warming into
 * blush-rose folded petals. Designed to share `createSpringBlossomMaterial()`.
 */
export function createSpringBudGeometry(length = 0.068, radius = 0.021): THREE.BufferGeometry {
  const radialSegments = 12
  const heightSegments = 6
  const ringCount = heightSegments - 1
  // No UV seam vertex duplication: mirrored U keeps strict index-level manifold edges.
  const totalVerts = 2 + ringCount * radialSegments
  const positions = new Float32Array(totalVerts * 3)
  const colors = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const indices: number[] = []

  const cCalyx = new THREE.Color(0x5c8244)
  const cSepal = new THREE.Color(0xb84a68)
  const cPetal = new THREE.Color(0xf0a6b8)
  const cTip = new THREE.Color(0xf9d8df)
  const tmp = new THREE.Color()

  const setColor = (vi: number, v: number) => {
    if (v < 0.26) tmp.copy(cCalyx).lerp(cSepal, THREE.MathUtils.smoothstep(v, 0.06, 0.26))
    else if (v < 0.64) tmp.copy(cSepal).lerp(cPetal, THREE.MathUtils.smoothstep(v, 0.26, 0.64))
    else tmp.copy(cPetal).lerp(cTip, THREE.MathUtils.smoothstep(v, 0.64, 1.0))
    colors[vi * 3] = tmp.r
    colors[vi * 3 + 1] = tmp.g
    colors[vi * 3 + 2] = tmp.b
  }

  // Vertex 0: calyx base at y = 0; Vertex 1: pointed bud apex at y = length.
  positions[0] = 0; positions[1] = 0; positions[2] = 0
  uvs[0] = 0.5; uvs[1] = 0
  setColor(0, 0)

  positions[3] = 0; positions[4] = length; positions[5] = 0
  uvs[2] = 0.5; uvs[3] = 1
  setColor(1, 1)

  for (let r = 0; r < ringCount; r++) {
    const v = (r + 1) / heightSegments
    const y = v * length
    const belly = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.72)), 0.66)
    const tipTaper = v > 0.44 ? Math.pow(1 - (v - 0.44) / 0.56, 0.36) : 1
    for (let j = 0; j < radialSegments; j++) {
      const uFrac = j / radialSegments
      const angle = uFrac * Math.PI * 2
      const flute = 1 + 0.075 * Math.cos(angle * 3 + v * 1.2) * Math.sin(Math.PI * v)
      const rad = Math.max(0.0014, radius * belly * tipTaper * flute)
      const vi = 2 + r * radialSegments + j
      positions[vi * 3] = Math.cos(angle) * rad
      positions[vi * 3 + 1] = y
      positions[vi * 3 + 2] = Math.sin(angle) * rad
      uvs[vi * 2] = 1 - Math.abs(uFrac * 2 - 1)
      uvs[vi * 2 + 1] = v
      setColor(vi, v)
    }
  }

  // Bottom cap (outward -Y)
  for (let j = 0; j < radialSegments; j++) {
    const next = (j + 1) % radialSegments
    indices.push(0, 2 + j, 2 + next)
  }
  // Body rings (outward radial; note: X=cos, Z=sin means +angle is -Y right-hand, so (a, c, b) points outward)
  for (let r = 0; r < ringCount - 1; r++) {
    const row0 = 2 + r * radialSegments
    const row1 = 2 + (r + 1) * radialSegments
    for (let j = 0; j < radialSegments; j++) {
      const next = (j + 1) % radialSegments
      indices.push(row0 + j, row1 + j, row0 + next)
      indices.push(row0 + next, row1 + j, row1 + next)
    }
  }
  // Top cap (outward +Y)
  const lastRow = 2 + (ringCount - 1) * radialSegments
  for (let j = 0; j < radialSegments; j++) {
    const next = (j + 1) % radialSegments
    indices.push(1, lastRow + next, lastRow + j)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Builds the living fruit-tree trunk (`martisor-trunk`), 4 tapered slightly curved
 * flowering twigs, and 3 delicate tip-softening spring buds on short woody spurs.
 *
 * Strictly preserves:
 * - `martisor-support-branch` at `(0.55, 1.5, z in [-0.65, 0.40], r = 0.055)` (built in `model.ts`)
 * - Ground anchoring of `martisor-trunk` (`min.y = -0.01`, strictly inside ground slab)
 * - Exact blossom & leaf seating coordinates and exact auto-fit camera envelope
 */
export function buildMartisorTreeBranches(
  subject: THREE.Group,
  bark: THREE.Material,
  blossomMat: THREE.Material,
  addMesh: (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, name?: string) => THREE.Mesh,
) {
  // Organic living trunk: gentle root flare anchored at y = -0.01, subtle natural S-bend,
  // smooth branch-collar swell around the support-branch junction (y = 1.50), and a closed
  // rounded shoulder that flows seamlessly into the V-fork (no flat sawn stump above it).
  const trunkGeo = createTaperedBranchGeometry({
    points: [
      [0.550, -0.01, -0.650],
      [0.566, 0.36, -0.654],
      [0.540, 0.86, -0.660],
      [0.548, 1.33, -0.653],
      [0.550, 1.495, -0.650],
      [0.556, 1.522, -0.651],
    ],
    radiusAt: (t, angle) => {
      // Root buttress flare anchored into the ground disc.
      const rootFlare = 0.028 * Math.pow(Math.max(0, 1 - t / 0.24), 2.1)
      const rootFlute = 1 + 0.065 * Math.cos(angle * 4 + 0.45) * Math.pow(Math.max(0, 1 - t / 0.28), 1.6)
      // Gentle natural taper upward with a slight organic collar around the fork/support joint.
      const body = THREE.MathUtils.lerp(0.071, 0.056, Math.pow(t, 0.72))
      const forkCollar = 0.008 * Math.exp(-Math.pow((t - 0.92) / 0.09, 2))
      // Smooth inward taper near the top shoulder so the closed dome sits flush into the V-fork.
      const crownPinch = t > 0.94 ? THREE.MathUtils.lerp(1, 0.78, (t - 0.94) / 0.06) : 1
      return (body + rootFlare + forkCollar) * rootFlute * crownPinch
    },
    tubularSegments: 22,
    radialSegments: 16,
    capStart: 'flat',
    capEnd: 'dome',
    uvLengthScale: 1.35,
  })
  addMesh(trunkGeo, bark, subject, 'martisor-trunk')

  // 4 tapered, slightly curved flowering twigs passing through every blossom and leaf seat.
  const twigs: readonly {
    name: string
    points: readonly Vec3Tuple[]
    rStart: number
    rEnd: number
    segs: number
    uvScale: number
  }[] = [
    {
      name: 'martisor-branch-left',
      points: [
        [0.544, 1.380, -0.652],
        [0.325, 1.565, -0.666],
        [0.080, 1.725, -0.682],
        [-0.160, 1.880, -0.700],
        [-0.380, 2.050, -0.720],
      ],
      rStart: 0.043,
      rEnd: 0.013,
      segs: 16,
      uvScale: 1.05,
    },
    {
      name: 'martisor-branch-right',
      points: [
        [0.550, 1.482, -0.650],
        [0.675, 1.665, -0.674],
        [0.790, 1.795, -0.688],
        [0.880, 1.900, -0.680],
        [0.985, 2.040, -0.685],
        [1.120, 2.180, -0.700],
      ],
      rStart: 0.044,
      rEnd: 0.012,
      segs: 16,
      uvScale: 1.0,
    },
    {
      name: 'martisor-twig-left',
      points: [
        [-0.160, 1.880, -0.700],
        [-0.300, 2.035, -0.686],
        [-0.435, 2.152, -0.669],
        [-0.550, 2.270, -0.650],
      ],
      rStart: 0.022,
      rEnd: 0.010,
      segs: 12,
      uvScale: 0.75,
    },
    {
      name: 'martisor-twig-right',
      points: [
        [0.880, 1.900, -0.680],
        [1.060, 1.978, -0.704],
        [1.245, 2.018, -0.728],
        [1.420, 2.020, -0.750],
      ],
      rStart: 0.023,
      rEnd: 0.010,
      segs: 12,
      uvScale: 0.75,
    },
  ]

  for (const twig of twigs) {
    const geo = createTaperedBranchGeometry({
      points: twig.points,
      radiusAt: (t, angle) => {
        const taper = THREE.MathUtils.lerp(twig.rStart, twig.rEnd, Math.pow(t, 0.84))
        const collar = 1 + 0.14 * Math.exp(-Math.pow(t / 0.11, 2))
        const subtleOval = 1 + 0.03 * Math.cos(angle * 2 + t * 2.5)
        return taper * collar * subtleOval
      },
      tubularSegments: twig.segs,
      radialSegments: 12,
      capStart: 'dome',
      capEnd: 'dome',
      uvLengthScale: twig.uvScale,
    })
    addMesh(geo, bark, subject, twig.name)
  }

  // 3 tiny spring blossom buds on delicate woody spurs well inside the existing
  // blossom bounding envelope to soften twig silhouettes.
  const budGeo = createSpringBudGeometry(0.068, 0.021)
  const budSpecs: readonly {
    base: Vec3Tuple
    mid: Vec3Tuple
    tip: Vec3Tuple
    scale: number
  }[] = [
    // Spur softening left main twig in the open span between Blossom 2 and Blossom 0
    { base: [-0.04, 1.805, -0.692], mid: [-0.075, 1.855, -0.678], tip: [-0.105, 1.895, -0.664], scale: 0.98 },
    // Spur softening right main twig between Leaf 2 and Blossom 3
    { base: [0.99, 2.045, -0.686], mid: [0.955, 2.095, -0.674], tip: [0.925, 2.132, -0.662], scale: 1.0 },
    // Spur adding spring rhythm mid-way along right side twig before Leaf 1
    { base: [1.08, 1.982, -0.706], mid: [1.115, 2.022, -0.696], tip: [1.148, 2.055, -0.684], scale: 0.94 },
  ]

  const upY = new THREE.Vector3(0, 1, 0)
  budSpecs.forEach((spec, idx) => {
    const spurGeo = createTaperedBranchGeometry({
      points: [spec.base, spec.mid, spec.tip],
      radiusAt: (t) => THREE.MathUtils.lerp(0.0085, 0.0046, t),
      tubularSegments: 6,
      radialSegments: 8,
      capStart: 'dome',
      capEnd: 'dome',
      uvLengthScale: 0.25,
    })
    const spur = addMesh(spurGeo, bark, subject, `martisor-bud-spur-${idx}`)
    spur.userData.toonSurface = { outline: false }

    const dir = new THREE.Vector3(
      spec.tip[0] - spec.mid[0],
      spec.tip[1] - spec.mid[1],
      spec.tip[2] - spec.mid[2],
    ).normalize()
    const bud = addMesh(budGeo, blossomMat, subject, `martisor-bud-${idx}`)
    bud.position.set(spec.tip[0], spec.tip[1], spec.tip[2]).addScaledVector(dir, -0.004)
    bud.quaternion.setFromUnitVectors(upY, dir)
    bud.scale.setScalar(spec.scale)
    bud.userData.toonSurface = { outline: false }
  })
}
