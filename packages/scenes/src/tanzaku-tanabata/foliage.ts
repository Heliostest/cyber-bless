import * as THREE from 'three'
import { createBladeLeafGeometry } from '@wbr/scene-runtime/botanical-kit'
import { applyBotanicalSurface } from '@wbr/scene-runtime/botanical-surfaces'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

type Vec3Tuple = readonly [number, number, number]

interface SasaLeafSpec {
  /** Attachment parameter along the branchlet curve (0..1). */
  t: number
  /** World-space (bamboo-local) pointing direction of the leaf blade (+Z in canonical blade frame). */
  dir: Vec3Tuple
  /** Roll around the blade midrib axis (radians) so sunlit upper cheeks tilt cleanly toward the viewer. */
  roll: number
  /** Blade geometry variant. */
  size: 'long' | 'mid' | 'short'
  /** Shade index into the warm Komorebi bamboo-leaf material palette. */
  shade: 0 | 1 | 2
}

interface SasaSpraySpec {
  name: string
  /** Control points in bamboo group local coordinates. */
  points: readonly Vec3Tuple[]
  rBase: number
  rTip: number
  /** Subtle bamboo-twig node swells along the branchlet (t in 0..1). */
  nodes: readonly number[]
  leaves: readonly SasaLeafSpec[]
}

/**
 * Builds a strictly closed, outward-oriented tapered sasa branchlet with subtle
 * bamboo twig nodes and a smoothly rounded closed tip cap. Uses parallel-transport
 * frames so gently arching twigs never twist.
 */
export function createSasaBranchletGeometry(
  points: readonly Vec3Tuple[],
  rBase: number,
  rTip: number,
  nodeTs: readonly number[] = [0.48],
  tubularSegments = 12,
  radialSegments = 8,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
  const domeSteps = 2
  const ringCount = tubularSegments + 1 + domeSteps
  const ringStride = radialSegments + 1
  const totalVerts = 2 + ringCount * ringStride

  const centers: THREE.Vector3[] = []
  const tangents: THREE.Vector3[] = []
  const radii: number[] = []
  const vs: number[] = []

  const endPt = curve.getPoint(1)
  const endTan = curve.getTangent(1).normalize()

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments
    centers.push(curve.getPoint(t))
    tangents.push(curve.getTangent(t).normalize())
    let r = THREE.MathUtils.lerp(rBase, rTip, Math.pow(t, 0.86))
    r *= 1 + 0.16 * Math.exp(-Math.pow(t / 0.10, 2))
    for (const nt of nodeTs) {
      r *= 1 + 0.14 * Math.exp(-Math.pow((t - nt) / 0.055, 2))
    }
    radii.push(Math.max(0.0018, r))
    vs.push(t)
  }

  for (let d = 1; d <= domeSteps; d++) {
    const phi = (d / (domeSteps + 1)) * (Math.PI * 0.5)
    centers.push(endPt.clone().addScaledVector(endTan, rTip * Math.sin(phi)))
    tangents.push(endTan.clone())
    radii.push(Math.max(0.0009, rTip * Math.cos(phi)))
    vs.push(1 + 0.02 * d)
  }

  // Parallel-transport (Bishop) frames along the curve to keep normals twist-free.
  const normalsFrame: THREE.Vector3[] = []
  const binormalsFrame: THREE.Vector3[] = []
  const t0 = tangents[0]!
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
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
      const alt = Math.abs(curT.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
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

  const startPole = centers[0]!.clone().addScaledVector(t0, -rBase * 0.25)
  const endPole = endPt.clone().addScaledVector(endTan, rTip)
  positions[0] = startPole.x; positions[1] = startPole.y; positions[2] = startPole.z
  uvs[0] = 0.5; uvs[1] = 0
  positions[3] = endPole.x; positions[4] = endPole.y; positions[5] = endPole.z
  uvs[2] = 0.5; uvs[3] = 1

  for (let r = 0; r < ringCount; r++) {
    const c = centers[r]!
    const N = normalsFrame[r]!
    const B = binormalsFrame[r]!
    const rad = radii[r]!
    const vCoord = vs[r]!
    for (let j = 0; j <= radialSegments; j++) {
      const angle = j === radialSegments ? 0 : (j / radialSegments) * Math.PI * 2
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
      normals[vi * 3 + 1] = 1
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

function orientBladeQuaternion(dirTuple: Vec3Tuple, roll: number): THREE.Quaternion {
  const zAxis = new THREE.Vector3(dirTuple[0], dirTuple[1], dirTuple[2]).normalize()
  const worldUp = new THREE.Vector3(0, 1, 0)
  const xAxis = new THREE.Vector3().crossVectors(worldUp, zAxis)
  if (xAxis.lengthSq() < 1e-6) xAxis.set(1, 0, 0)
  else xAxis.normalize()
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()
  const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
  const q = new THREE.Quaternion().setFromRotationMatrix(basis)
  if (roll !== 0) {
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll))
  }
  return q
}

function createBambooLeafMaterial(
  color: number,
  veinColor: number,
  baseColor: number,
  roughness: number,
  seed: number,
): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    {
      color,
      roughness,
      metalness: 0,
      envMapIntensity: 0.44,
      side: THREE.FrontSide,
    },
    { kind: 'leaf', strength: 0.24, fiber: false },
  )
  return applyBotanicalSurface(mat, {
    kind: 'leaf',
    venation: 'parallel',
    strength: 0.62,
    scale: 1.0,
    foldRidge: 0.62,
    veinColor,
    baseColor,
    seed,
  })
}

/**
 * Authored sasa branchlet & leaf sprays emerging from upper bamboo culm nodes.
 * - The 3 preset hanging-cord tie loops (`(-0.50, 1.98, -0.20)`, `(-0.21, 2.48, -0.19)`,
 *   `(0.25, 2.03, 0.04)`) thread cleanly around their host sasa branchlets.
 * - Each blade rolls ~46-58 deg toward the viewer so the tapered lanceolate silhouette,
 *   midrib V-fold, and parallel bamboo venation read clearly at 346x332 without blocking
 *   the front face of any of the 4 paper tanzaku strips.
 */
const SASA_SPRAYS: readonly SasaSpraySpec[] = [
  // Stalk 0 (x=-0.35, z=-0.20), node y=1.50 — lower right-back sprig (below coral strip)
  {
    name: 'tanzaku-sasa-s0-n2',
    points: [
      [-0.33, 1.485, -0.20],
      [-0.22, 1.540, -0.25],
      [-0.12, 1.575, -0.31],
    ],
    rBase: 0.009,
    rTip: 0.0042,
    nodes: [0.52],
    leaves: [
      { t: 0.62, dir: [0.80, 0.34, -0.50], roll: 0.88, size: 'mid', shade: 2 },
      { t: 0.94, dir: [0.92, -0.02, -0.39], roll: 0.94, size: 'long', shade: 1 },
      { t: 0.98, dir: [0.76, -0.38, -0.52], roll: 0.78, size: 'short', shade: 2 },
    ],
  },
  // Stalk 0 (x=-0.35, z=-0.20), node y=2.00 — left branchlet holding marigold cord tie (-0.50, 1.98, -0.20)
  {
    name: 'tanzaku-sasa-s0-n3',
    points: [
      [-0.37, 1.988, -0.20],
      [-0.50, 1.980, -0.20],
      [-0.63, 2.018, -0.24],
    ],
    rBase: 0.0098,
    rTip: 0.0044,
    nodes: [0.36, 0.74],
    leaves: [
      { t: 0.70, dir: [-0.70, 0.62, -0.36], roll: -0.92, size: 'mid', shade: 0 },
      { t: 0.94, dir: [-0.94, 0.14, -0.30], roll: -0.96, size: 'long', shade: 1 },
      { t: 0.97, dir: [-0.82, -0.30, -0.49], roll: -0.82, size: 'mid', shade: 2 },
    ],
  },
  // Stalk 0 (x=-0.35, z=-0.20), node y=2.50 — right branchlet holding coral cord tie (-0.21, 2.48, -0.19)
  {
    name: 'tanzaku-sasa-s0-n4',
    points: [
      [-0.33, 2.488, -0.20],
      [-0.21, 2.480, -0.19],
      [-0.08, 2.538, -0.24],
    ],
    rBase: 0.0098,
    rTip: 0.0042,
    nodes: [0.38, 0.76],
    leaves: [
      { t: 0.72, dir: [0.64, 0.68, -0.36], roll: 0.94, size: 'mid', shade: 0 },
      { t: 0.94, dir: [0.92, 0.22, -0.32], roll: 0.98, size: 'long', shade: 0 },
      { t: 0.98, dir: [0.78, -0.20, -0.59], roll: 0.86, size: 'short', shade: 1 },
    ],
  },
  // Stalk 0 (x=-0.35, z=-0.20), node y=2.50 — balanced left-up crown spray against the sky
  {
    name: 'tanzaku-sasa-s0-n4-crown',
    points: [
      [-0.36, 2.490, -0.21],
      [-0.48, 2.555, -0.24],
      [-0.58, 2.605, -0.28],
    ],
    rBase: 0.0086,
    rTip: 0.0038,
    nodes: [0.55],
    leaves: [
      { t: 0.64, dir: [-0.62, 0.72, -0.32], roll: -0.92, size: 'short', shade: 0 },
      { t: 0.93, dir: [-0.94, 0.20, -0.28], roll: -0.98, size: 'long', shade: 0 },
      { t: 0.97, dir: [-0.84, -0.26, -0.47], roll: -0.84, size: 'mid', shade: 1 },
    ],
  },
  // Stalk 1 (x=0.05, z=-0.08), node y=1.50 — lower right-back sprig (strictly behind mint strip)
  {
    name: 'tanzaku-sasa-s1-n2',
    points: [
      [0.07, 1.485, -0.09],
      [0.18, 1.535, -0.16],
      [0.29, 1.560, -0.24],
    ],
    rBase: 0.009,
    rTip: 0.0040,
    nodes: [0.50],
    leaves: [
      { t: 0.64, dir: [0.78, 0.36, -0.51], roll: 0.86, size: 'mid', shade: 2 },
      { t: 0.96, dir: [0.90, -0.12, -0.42], roll: 0.92, size: 'mid', shade: 1 },
    ],
  },
  // Stalk 1 (x=0.05, z=-0.08), node y=2.00 — mid left-back spray (well behind coral strip)
  {
    name: 'tanzaku-sasa-s1-n3',
    points: [
      [0.03, 1.988, -0.10],
      [-0.08, 2.055, -0.19],
      [-0.19, 2.105, -0.29],
    ],
    rBase: 0.0092,
    rTip: 0.0040,
    nodes: [0.54],
    leaves: [
      { t: 0.66, dir: [-0.68, 0.52, -0.52], roll: -0.88, size: 'short', shade: 2 },
      { t: 0.95, dir: [-0.88, 0.14, -0.46], roll: -0.92, size: 'mid', shade: 1 },
    ],
  },
  // Stalk 1 (x=0.05, z=-0.08), node y=2.50 — airy upper crown spray in the open sky gap
  {
    name: 'tanzaku-sasa-s1-n4',
    points: [
      [0.07, 2.488, -0.09],
      [0.19, 2.565, -0.15],
      [0.31, 2.630, -0.21],
    ],
    rBase: 0.0095,
    rTip: 0.0040,
    nodes: [0.46],
    leaves: [
      { t: 0.60, dir: [0.60, 0.72, -0.35], roll: 0.94, size: 'short', shade: 0 },
      { t: 0.92, dir: [0.90, 0.24, -0.36], roll: 0.98, size: 'long', shade: 0 },
      { t: 0.97, dir: [0.80, -0.22, -0.56], roll: 0.86, size: 'mid', shade: 1 },
    ],
  },
  // Stalk 1 (x=0.05, z=-0.08), node y=3.00 — tall apex spray gently arching down-left
  {
    name: 'tanzaku-sasa-s1-n5',
    points: [
      [0.03, 2.975, -0.09],
      [-0.10, 2.950, -0.14],
      [-0.24, 2.900, -0.20],
    ],
    rBase: 0.0090,
    rTip: 0.0038,
    nodes: [0.50],
    leaves: [
      { t: 0.66, dir: [-0.82, 0.18, -0.54], roll: -0.90, size: 'mid', shade: 0 },
      { t: 0.95, dir: [-0.90, -0.32, -0.30], roll: -0.96, size: 'long', shade: 1 },
    ],
  },
  // Stalk 2 (x=0.40, z=0.04), node y=1.50 — lower right-back spray (behind future hung pink strip z=0.12)
  {
    name: 'tanzaku-sasa-s2-n2',
    points: [
      [0.42, 1.488, 0.02],
      [0.54, 1.545, -0.06],
      [0.66, 1.580, -0.15],
    ],
    rBase: 0.0092,
    rTip: 0.0042,
    nodes: [0.48],
    leaves: [
      { t: 0.62, dir: [0.78, 0.48, -0.40], roll: 0.90, size: 'mid', shade: 0 },
      { t: 0.93, dir: [0.92, 0.04, -0.39], roll: 0.96, size: 'long', shade: 1 },
      { t: 0.98, dir: [0.78, -0.34, -0.52], roll: 0.82, size: 'short', shade: 2 },
    ],
  },
  // Stalk 2 (x=0.40, z=0.04), node y=2.00 — left branchlet holding mint cord tie (0.25, 2.03, 0.04)
  {
    name: 'tanzaku-sasa-s2-n3',
    points: [
      [0.38, 1.995, 0.04],
      [0.25, 2.030, 0.04],
      [0.14, 2.095, -0.04],
    ],
    rBase: 0.0096,
    rTip: 0.0042,
    nodes: [0.36, 0.74],
    leaves: [
      { t: 0.74, dir: [-0.66, 0.68, -0.32], roll: -0.92, size: 'short', shade: 0 },
      { t: 0.96, dir: [-0.88, 0.24, -0.41], roll: -0.96, size: 'mid', shade: 1 },
    ],
  },
  // Stalk 2 (x=0.40, z=0.04), node y=2.50 — prominent right upper crown spray against the sky
  {
    name: 'tanzaku-sasa-s2-n4',
    points: [
      [0.42, 2.488, 0.03],
      [0.56, 2.555, -0.02],
      [0.69, 2.610, -0.08],
    ],
    rBase: 0.0096,
    rTip: 0.0042,
    nodes: [0.44, 0.78],
    leaves: [
      { t: 0.60, dir: [0.62, 0.72, -0.32], roll: 0.94, size: 'short', shade: 0 },
      { t: 0.92, dir: [0.94, 0.16, -0.30], roll: 1.00, size: 'long', shade: 0 },
      { t: 0.97, dir: [0.84, -0.28, -0.46], roll: 0.86, size: 'mid', shade: 1 },
    ],
  },
]

/**
 * Adds slim tapered sasa branchlets with midrib-folded, arched, parallel-veined
 * bamboo leaf sprays to the bamboo group while leaving poles, nodes, cords, and
 * paper strips completely untouched.
 */
export function addSasaBambooFoliage(bamboo: THREE.Group): THREE.Group {
  const foliage = new THREE.Group()
  foliage.name = 'tanzaku-sasa-foliage'

  const twigMat = applyCraftSurface(
    new THREE.MeshPhysicalMaterial({
      color: 0x6b9b48,
      roughness: 0.64,
      clearcoat: 0.16,
      clearcoatRoughness: 0.44,
      specularIntensity: 0.38,
    }),
    { kind: 'bamboo', strength: 0.34, scale: 1.3, axis: 'y' },
  )

  const leafMats: readonly [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] = [
    createBambooLeafMaterial(0x69a446, 0xa8cf72, 0x487a32, 0.56, 1.3),
    createBambooLeafMaterial(0x57923d, 0x92be62, 0x3d6b2a, 0.60, 3.7),
    createBambooLeafMaterial(0x498034, 0x80ab55, 0x335a24, 0.64, 6.1),
  ]

  const bladeGeos: Record<'long' | 'mid' | 'short', THREE.BufferGeometry> = {
    long: createBladeLeafGeometry({
      length: 0.265,
      maxWidth: 0.062,
      widthStation: 0.30,
      tip: 'acuminate',
      midribFold: 15,
      arch: 0.032,
      tipDroop: 0.036,
      thickness: 0.0028,
      widthSegments: 4,
      lengthSegments: 6,
    }),
    mid: createBladeLeafGeometry({
      length: 0.220,
      maxWidth: 0.054,
      widthStation: 0.32,
      tip: 'acuminate',
      midribFold: 16,
      arch: 0.026,
      tipDroop: 0.026,
      thickness: 0.0026,
      widthSegments: 4,
      lengthSegments: 6,
    }),
    short: createBladeLeafGeometry({
      length: 0.175,
      maxWidth: 0.046,
      widthStation: 0.34,
      tip: 'acuminate',
      midribFold: 16,
      arch: 0.020,
      tipDroop: 0.018,
      thickness: 0.0025,
      widthSegments: 4,
      lengthSegments: 5,
    }),
  }

  for (const spray of SASA_SPRAYS) {
    const sprayGroup = new THREE.Group()
    sprayGroup.name = spray.name

    const twigGeo = createSasaBranchletGeometry(spray.points, spray.rBase, spray.rTip, spray.nodes)
    const twigMesh = new THREE.Mesh(twigGeo, twigMat)
    twigMesh.name = `${spray.name}-twig`
    twigMesh.castShadow = true
    twigMesh.receiveShadow = true
    twigMesh.userData.toonSurface = { outline: false }
    sprayGroup.add(twigMesh)

    const curve = new THREE.CatmullRomCurve3(spray.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
    spray.leaves.forEach((leaf, idx) => {
      const anchor = curve.getPoint(leaf.t)
      const blade = new THREE.Mesh(bladeGeos[leaf.size], leafMats[leaf.shade])
      blade.name = `${spray.name}-leaf-${idx}`
      // Tuck petiole 3 mm into the branchlet so no gap shows from any angle.
      const dirVec = new THREE.Vector3(...leaf.dir).normalize()
      blade.position.copy(anchor).addScaledVector(dirVec, -0.003)
      blade.quaternion.copy(orientBladeQuaternion(leaf.dir, leaf.roll))
      blade.castShadow = true
      blade.receiveShadow = true
      blade.userData.toonSurface = { outline: false }
      sprayGroup.add(blade)
    })

    foliage.add(sprayGroup)
  }

  bamboo.add(foliage)
  return foliage
}
