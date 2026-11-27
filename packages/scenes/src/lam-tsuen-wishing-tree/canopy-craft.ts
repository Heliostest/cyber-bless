import * as THREE from 'three'

type PixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  size: number
}

const cachedPixels = new Map<string, PixelBuffers>()

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const x0 = ((xi % px) + px) % px
  const x1 = (x0 + 1) % px
  const y0 = ((yi % py) + py) % py
  const y1 = (y0 + 1) % py
  const a = hash2(x0, y0, seed)
  const b = hash2(x1, y0, seed)
  const c = hash2(x0, y1, seed)
  const d = hash2(x1, y1, seed)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}

function makeTexture(
  source: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  repeatX = 2.0,
  repeatY = 2.0,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), size, size)
  tex.colorSpace = colorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

function bindTextureDisposal(material: THREE.Material, textures: readonly THREE.Texture[]): void {
  let released = false
  const onDispose = () => {
    if (released) return
    released = true
    material.removeEventListener('dispose', onDispose)
    for (const tex of textures) tex.dispose()
  }
  material.addEventListener('dispose', onDispose)
}

function signedVolumeIndexed(positions: Float32Array | readonly number[], indices: readonly number[]): number {
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const cross = new THREE.Vector3()
  let vol = 0
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]! * 3
    const ib = indices[i + 1]! * 3
    const ic = indices[i + 2]! * 3
    a.set(positions[ia]!, positions[ia + 1]!, positions[ia + 2]!)
    b.set(positions[ib]!, positions[ib + 1]!, positions[ib + 2]!)
    c.set(positions[ic]!, positions[ic + 1]!, positions[ic + 2]!)
    cross.crossVectors(b, c)
    vol += a.dot(cross) / 6
  }
  return vol
}

const KEY_LIGHT_DIR = new THREE.Vector3(-3, 5, 4).normalize()

// ---------------------------------------------------------------------------
// Molded fiberglass/plastic replica trunk, boughs, twigs, and fork collars
// ---------------------------------------------------------------------------

export type MoldedLimbOptions = {
  points: readonly THREE.Vector3[]
  radiusAt: (t: number, angle: number) => number
  tubularSegments?: number
  radialSegments?: number
  startCap?: 'flat' | 'dome'
  endCap?: 'flat' | 'dome'
  startDomeScale?: number
  endDomeScale?: number
  /** Vertex-color shading along limb length `t ∈ [0, 1]` and vertical normal component `ny`. */
  shadeAt?: (t: number, ny: number) => readonly [number, number, number]
}

/**
 * Builds a watertight, closed, parallel-transported curved molded-replica limb
 * (trunk, arching bough, twig, or fork collar) with smooth welded seam normals
 * and rounded dome or seated flat caps — eliminating exposed flat cylinder cuts.
 */
export function createMoldedLimbGeometry(options: MoldedLimbOptions): THREE.BufferGeometry {
  const segT = Math.max(4, Math.round(options.tubularSegments ?? 12))
  const segR = Math.max(6, Math.round(options.radialSegments ?? 10))
  const startCap = options.startCap ?? 'dome'
  const endCap = options.endCap ?? 'dome'
  const startDomeScale = options.startDomeScale ?? 0.65
  const endDomeScale = options.endDomeScale ?? 0.85

  const curve = new THREE.CatmullRomCurve3(
    options.points.map((p) => p.clone()),
    false,
    'centripetal',
    0.45,
  )

  const centers: THREE.Vector3[] = []
  const tangents: THREE.Vector3[] = []
  const normalsFrame: THREE.Vector3[] = []
  const binormals: THREE.Vector3[] = []

  for (let i = 0; i <= segT; i++) {
    const t = i / segT
    centers.push(curve.getPoint(t))
    tangents.push(curve.getTangent(t).normalize())
  }
  if (startCap === 'flat' && Math.abs(tangents[0]!.y) > 0.9) {
    tangents[0]!.set(0, Math.sign(tangents[0]!.y), 0)
  }

  const refAxis = Math.abs(tangents[0]!.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const n0 = new THREE.Vector3().crossVectors(tangents[0]!, refAxis).normalize()
  const b0 = new THREE.Vector3().crossVectors(tangents[0]!, n0).normalize()
  normalsFrame.push(n0)
  binormals.push(b0)

  const rotAxis = new THREE.Vector3()
  const rotQ = new THREE.Quaternion()
  for (let i = 1; i <= segT; i++) {
    const prevT = tangents[i - 1]!
    const curT = tangents[i]!
    const nextN = normalsFrame[i - 1]!.clone()
    const dot = THREE.MathUtils.clamp(prevT.dot(curT), -1, 1)
    if (dot < 0.999999) {
      rotAxis.crossVectors(prevT, curT)
      if (rotAxis.lengthSq() > 1e-12) {
        rotAxis.normalize()
        rotQ.setFromAxisAngle(rotAxis, Math.acos(dot))
        nextN.applyQuaternion(rotQ)
      }
    }
    nextN.addScaledVector(curT, -nextN.dot(curT)).normalize()
    const nextB = new THREE.Vector3().crossVectors(curT, nextN).normalize()
    normalsFrame.push(nextN)
    binormals.push(nextB)
  }

  type RingDef = {
    center: THREE.Vector3
    n: THREE.Vector3
    b: THREE.Vector3
    t: number
    vCoord: number
    scale: number
  }
  const rings: RingDef[] = []

  const rStartSample = options.radiusAt(0, 0)
  const rEndSample = options.radiusAt(1, 0)

  if (startCap === 'dome') {
    for (const frac of [0.35, 0.72]) {
      const ang = (1 - frac) * (Math.PI * 0.5)
      rings.push({
        center: centers[0]!.clone().addScaledVector(tangents[0]!, -Math.sin(ang) * rStartSample * startDomeScale),
        n: normalsFrame[0]!,
        b: binormals[0]!,
        t: 0,
        vCoord: -0.06 * (1 - frac),
        scale: Math.cos(ang),
      })
    }
  }

  for (let i = 0; i <= segT; i++) {
    const t = i / segT
    rings.push({
      center: centers[i]!,
      n: normalsFrame[i]!,
      b: binormals[i]!,
      t,
      vCoord: t,
      scale: 1,
    })
  }

  if (endCap === 'dome') {
    for (const frac of [0.72, 0.35]) {
      const ang = (1 - frac) * (Math.PI * 0.5)
      rings.push({
        center: centers[segT]!.clone().addScaledVector(tangents[segT]!, Math.sin(ang) * rEndSample * endDomeScale),
        n: normalsFrame[segT]!,
        b: binormals[segT]!,
        t: 1,
        vCoord: 1 + 0.06 * (1 - frac),
        scale: Math.cos(ang),
      })
    }
  }

  const startPole = startCap === 'dome'
    ? centers[0]!.clone().addScaledVector(tangents[0]!, -rStartSample * startDomeScale)
    : centers[0]!.clone()
  const endPole = endCap === 'dome'
    ? centers[segT]!.clone().addScaledVector(tangents[segT]!, rEndSample * endDomeScale)
    : centers[segT]!.clone()

  const ringStride = segR + 1
  const totalVerts = 2 + rings.length * ringStride
  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const colors = new Float32Array(totalVerts * 3)
  const indices: number[] = []

  const shade = options.shadeAt ?? ((t: number, ny: number) => {
    const base = THREE.MathUtils.lerp(0.92, 1.03, Math.pow(t, 0.7))
    const sky = 1 + ny * 0.05
    return [base * sky, base * sky * 0.99, base * sky * 0.97] as const
  })

  positions[0] = startPole.x; positions[1] = startPole.y; positions[2] = startPole.z
  uvs[0] = 0.5; uvs[1] = 0
  const cStart = shade(0, -tangents[0]!.y)
  colors[0] = cStart[0]; colors[1] = cStart[1]; colors[2] = cStart[2]

  positions[3] = endPole.x; positions[4] = endPole.y; positions[5] = endPole.z
  uvs[2] = 0.5; uvs[3] = 1
  const cEnd = shade(1, tangents[segT]!.y)
  colors[3] = cEnd[0]; colors[4] = cEnd[1]; colors[5] = cEnd[2]

  const radialDir = new THREE.Vector3()
  const posTmp = new THREE.Vector3()

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r]!
    for (let j = 0; j <= segR; j++) {
      const angle = j === segR ? 0 : (j / segR) * Math.PI * 2
      const ca = Math.cos(angle)
      const sa = Math.sin(angle)
      radialDir.set(
        ring.n.x * ca + ring.b.x * sa,
        ring.n.y * ca + ring.b.y * sa,
        ring.n.z * ca + ring.b.z * sa,
      )
      const rad = Math.max(0.002, options.radiusAt(ring.t, angle) * ring.scale)
      posTmp.copy(ring.center).addScaledVector(radialDir, rad)

      const vi = 2 + r * ringStride + j
      positions[vi * 3] = posTmp.x
      positions[vi * 3 + 1] = posTmp.y
      positions[vi * 3 + 2] = posTmp.z
      uvs[vi * 2] = j / segR
      uvs[vi * 2 + 1] = ring.vCoord
      const col = shade(ring.t, radialDir.y)
      colors[vi * 3] = col[0]
      colors[vi * 3 + 1] = col[1]
      colors[vi * 3 + 2] = col[2]
    }
  }

  for (let j = 0; j < segR; j++) {
    indices.push(0, 2 + j + 1, 2 + j)
  }
  for (let r = 0; r < rings.length - 1; r++) {
    const row0 = 2 + r * ringStride
    const row1 = 2 + (r + 1) * ringStride
    for (let j = 0; j < segR; j++) {
      indices.push(row0 + j, row0 + j + 1, row1 + j)
      indices.push(row0 + j + 1, row1 + j + 1, row1 + j)
    }
  }
  const lastRow = 2 + (rings.length - 1) * ringStride
  for (let j = 0; j < segR; j++) {
    indices.push(1, lastRow + j, lastRow + j + 1)
  }

  if (signedVolumeIndexed(positions, indices) < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1]!
      indices[i + 1] = indices[i + 2]!
      indices[i + 2] = tmp
    }
  }

  const logicalNormals = new Float32Array((2 + rings.length * segR) * 3)
  const logicalOf = (vi: number) => {
    if (vi < 2) return vi
    const rel = vi - 2
    const r = Math.floor(rel / ringStride)
    const j = rel % ringStride
    return 2 + r * segR + (j === segR ? 0 : j)
  }

  const va = new THREE.Vector3()
  const vb = new THREE.Vector3()
  const vc = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const fn = new THREE.Vector3()

  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]!
    const ib = indices[i + 1]!
    const ic = indices[i + 2]!
    va.set(positions[ia * 3]!, positions[ia * 3 + 1]!, positions[ia * 3 + 2]!)
    vb.set(positions[ib * 3]!, positions[ib * 3 + 1]!, positions[ib * 3 + 2]!)
    vc.set(positions[ic * 3]!, positions[ic * 3 + 1]!, positions[ic * 3 + 2]!)
    e1.subVectors(vb, va)
    e2.subVectors(vc, va)
    fn.crossVectors(e1, e2)
    for (const vi of [ia, ib, ic]) {
      const li = logicalOf(vi)
      logicalNormals[li * 3] += fn.x
      logicalNormals[li * 3 + 1] += fn.y
      logicalNormals[li * 3 + 2] += fn.z
    }
  }

  for (let vi = 0; vi < totalVerts; vi++) {
    const li = logicalOf(vi)
    const nx = logicalNormals[li * 3]!
    const ny = logicalNormals[li * 3 + 1]!
    const nz = logicalNormals[li * 3 + 2]!
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
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Calm satin-matte cast-fiberglass replica banyan shell surface: soft isotropic
 * molded resin mottling and faint broad dimples — explicitly NOT sawn lumber
 * wood grain, NOT linear striations, and NOT photoreal flaking bark.
 */
function buildReplicaBarkPixels(): PixelBuffers {
  const key = 'lamtsuen-replica-fiberglass-shell-v3'
  const existing = cachedPixels.get(key)
  if (existing) return existing

  const size = 128
  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)

  const hi = [158, 125, 97]
  const mid = [146, 113, 86]
  const lo = [128, 97, 74]

  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      // Soft isotropic molded-fiberglass surface undulation (zero sawn wood grain).
      const swell = periodicNoise(u * 3, v * 4, 3, 4, 311)
      const dimple = periodicNoise(u * 7, v * 7, 7, 7, 419)
      const satinMicro = periodicNoise(u * 14, v * 14, 14, 14, 523)

      const h = THREE.MathUtils.clamp(swell * 0.50 + dimple * 0.34 + satinMicro * 0.16, 0, 1)
      const hiMix = THREE.MathUtils.smoothstep(h, 0.52, 0.90)
      const loMix = (1 - THREE.MathUtils.smoothstep(h, 0.12, 0.52)) * 0.72

      let r = THREE.MathUtils.lerp(mid[0]!, hi[0]!, hiMix)
      let g = THREE.MathUtils.lerp(mid[1]!, hi[1]!, hiMix)
      let b = THREE.MathUtils.lerp(mid[2]!, hi[2]!, hiMix)
      r = THREE.MathUtils.lerp(r, lo[0]!, loMix)
      g = THREE.MathUtils.lerp(g, lo[1]!, loMix)
      b = THREE.MathUtils.lerp(b, lo[2]!, loMix)

      const idx = (y * size + x) * 4
      color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 196)
      color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 165)
      color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 134)
      color[idx + 3] = 255

      const bh = THREE.MathUtils.clamp(Math.round(128 + (h - 0.5) * 34), 92, 166)
      bump[idx] = bump[idx + 1] = bump[idx + 2] = bh
      bump[idx + 3] = 255
    }
  }

  const buffers = { color, bump, size }
  cachedPixels.set(key, buffers)
  return buffers
}

export function createReplicaBarkMaterial(): THREE.MeshStandardMaterial {
  const pixels = buildReplicaBarkPixels()
  const map = makeTexture(pixels.color, pixels.size, THREE.SRGBColorSpace, 1.4, 1.8)
  const bump = makeTexture(pixels.bump, pixels.size, THREE.NoColorSpace, 1.4, 1.8)
  // Clean satin-matte molded fiberglass finish (modern conservation replica trunk, never lumber).
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    bumpMap: bump,
    bumpScale: 0.0026,
    roughness: 0.68,
    metalness: 0,
    envMapIntensity: 0.34,
    vertexColors: true,
  })
  mat.userData.komorebiPigment = true
  bindTextureDisposal(mat, [map, bump])
  return mat
}

// ---------------------------------------------------------------------------
// Multi-lobe scalloped stylized replica banyan core clusters & 5-leaf rosettes
// ---------------------------------------------------------------------------

type LobeSpec = {
  dir: readonly [number, number, number]
  weight: number
  sharp: number
}

const CLUSTER_LOBE_VARIANTS: readonly (readonly LobeSpec[])[] = [
  [
    { dir: [0.92, 0.14, 0.36], weight: 0.27, sharp: 2.8 },
    { dir: [0.34, 0.24, 0.91], weight: 0.25, sharp: 2.9 },
    { dir: [-0.54, 0.14, 0.83], weight: 0.26, sharp: 2.7 },
    { dir: [-0.95, 0.22, -0.24], weight: 0.28, sharp: 2.8 },
    { dir: [-0.26, 0.18, -0.95], weight: 0.24, sharp: 2.9 },
    { dir: [0.64, 0.22, -0.74], weight: 0.26, sharp: 2.8 },
    { dir: [0.08, 0.96, 0.26], weight: 0.24, sharp: 2.5 },
  ],
  [
    { dir: [0.86, 0.26, -0.44], weight: 0.27, sharp: 3.0 },
    { dir: [0.70, 0.08, 0.71], weight: 0.26, sharp: 2.8 },
    { dir: [-0.14, 0.26, 0.96], weight: 0.24, sharp: 2.9 },
    { dir: [-0.88, 0.16, 0.45], weight: 0.28, sharp: 2.7 },
    { dir: [-0.74, 0.28, -0.62], weight: 0.25, sharp: 2.9 },
    { dir: [0.12, 0.12, -0.99], weight: 0.23, sharp: 2.8 },
    { dir: [-0.22, 0.95, 0.22], weight: 0.26, sharp: 2.4 },
    { dir: [0.36, 0.88, -0.30], weight: 0.20, sharp: 2.8 },
  ],
  [
    { dir: [0.97, 0.10, 0.22], weight: 0.28, sharp: 2.7 },
    { dir: [0.46, 0.20, 0.87], weight: 0.24, sharp: 2.9 },
    { dir: [-0.42, 0.24, 0.88], weight: 0.26, sharp: 2.8 },
    { dir: [-0.94, 0.12, 0.32], weight: 0.26, sharp: 2.9 },
    { dir: [-0.62, 0.24, -0.75], weight: 0.27, sharp: 2.7 },
    { dir: [0.36, 0.16, -0.92], weight: 0.25, sharp: 2.8 },
    { dir: [0.22, 0.95, 0.22], weight: 0.25, sharp: 2.5 },
  ],
  [
    { dir: [0.84, 0.30, 0.45], weight: 0.27, sharp: 3.1 },
    { dir: [-0.10, 0.22, 0.97], weight: 0.26, sharp: 3.0 },
    { dir: [-0.86, 0.28, 0.42], weight: 0.27, sharp: 3.0 },
    { dir: [-0.76, 0.18, -0.63], weight: 0.26, sharp: 2.9 },
    { dir: [0.28, 0.26, -0.93], weight: 0.26, sharp: 3.0 },
    { dir: [0.88, 0.14, -0.46], weight: 0.24, sharp: 2.9 },
    { dir: [-0.12, 0.98, -0.14], weight: 0.26, sharp: 2.4 },
  ],
]

type WeldedUnitSphere = {
  positions: Float32Array
  indices: number[]
}

let cachedUnitGeodesic: WeldedUnitSphere | null = null

function getUnitGeodesicSphere(): WeldedUnitSphere {
  if (cachedUnitGeodesic) return cachedUnitGeodesic
  const raw = new THREE.IcosahedronGeometry(1, 2)
  const rawPos = raw.getAttribute('position') as THREE.BufferAttribute
  const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.17, 0.29, 0.11))

  const vertexMap = new Map<string, number>()
  const uniquePositions: number[] = []
  const indices: number[] = []
  const v = new THREE.Vector3()

  for (let i = 0; i < rawPos.count; i++) {
    v.fromBufferAttribute(rawPos, i).applyMatrix4(tilt).normalize()
    const key = `${Math.round(v.x * 1e5)},${Math.round(v.y * 1e5)},${Math.round(v.z * 1e5)}`
    let idx = vertexMap.get(key)
    if (idx === undefined) {
      idx = uniquePositions.length / 3
      vertexMap.set(key, idx)
      uniquePositions.push(v.x, v.y, v.z)
    }
    indices.push(idx)
  }
  raw.dispose()

  const positions = new Float32Array(uniquePositions)
  if (signedVolumeIndexed(positions, indices) < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1]!
      indices[i + 1] = indices[i + 2]!
      indices[i + 2] = tmp
    }
  }
  cachedUnitGeodesic = { positions, indices }
  return cachedUnitGeodesic
}

export type CrownShadingContext = {
  /** World-space position of this cluster or rosette mesh. */
  worldPos: THREE.Vector3
  /** Local scale of this cluster mesh (used to evaluate global crown position per vertex). */
  worldScale?: THREE.Vector3
  /** Local Euler rotation of this mesh (used to rotate global dome normals into local space). */
  worldRot?: THREE.Euler
  /** Overall crown center in world coordinates. */
  crownCenter: THREE.Vector3
  /** Overall crown ellipsoid radii `(rx, ry, rz)` for unified global-canopy normal transfer. */
  crownRadii: THREE.Vector3
}

export type ReplicaClusterGeometryOptions = {
  /** Selects one of four scalloped multi-lobe silhouette archetypes (`0..3`). */
  variant?: number
  /** Global crown shading context so overlapping clusters unify into one lush banyan volume. */
  crown?: CrownShadingContext
}

/**
 * Watertight, multi-lobed scalloped foliage-mass cluster for the modern replica
 * wishing tree. Uses global-crown normal transfer and canopy-space shading so
 * overlapping clusters fuse into a single rich, organic Komorebi crown volume
 * instead of reading as stacked dark-rimmed pancakes.
 */
export function createReplicaCanopyClusterGeometry(
  options: ReplicaClusterGeometryOptions = {},
): THREE.BufferGeometry {
  const base = getUnitGeodesicSphere()
  const vertCount = base.positions.length / 3
  const variant = ((Math.round(options.variant ?? 0) % CLUSTER_LOBE_VARIANTS.length) + CLUSTER_LOBE_VARIANTS.length) % CLUSTER_LOBE_VARIANTS.length
  const lobes = CLUSTER_LOBE_VARIANTS[variant]!.map((l) => ({
    dir: new THREE.Vector3(...l.dir).normalize(),
    weight: l.weight,
    sharp: l.sharp,
  }))

  const rawRadii = new Float32Array(vertCount)
  const unitDirs: THREE.Vector3[] = []
  let maxRawR = 0

  for (let i = 0; i < vertCount; i++) {
    const ux = base.positions[i * 3]!
    const uy = base.positions[i * 3 + 1]!
    const uz = base.positions[i * 3 + 2]!
    const u = new THREE.Vector3(ux, uy, uz)
    unitDirs.push(u)

    const theta = Math.atan2(uz, ux)
    const horiz = Math.hypot(ux, uz)

    let lobeSum = 0
    for (const lobe of lobes) {
      const d = Math.max(0, u.dot(lobe.dir))
      if (d > 0) lobeSum += lobe.weight * Math.pow(d, lobe.sharp)
    }

    const scallop =
      0.056 * Math.sin(theta * 5 + variant * 1.65 + uy * 1.8) * horiz
      + 0.036 * Math.cos(theta * 8 - variant * 1.25 - uy * 1.4) * horiz * horiz

    const underTuck = uy < -0.18 ? -0.08 * Math.pow((-uy - 0.18) / 0.82, 1.4) : 0
    const r = Math.max(0.54, 0.70 + lobeSum * 0.96 + scallop + underTuck)
    rawRadii[i] = r
    if (r > maxRawR) maxRawR = r
  }

  const normScale = 0.992 / Math.max(maxRawR, 1e-6)
  const positions = new Float32Array(vertCount * 3)
  const uvs = new Float32Array(vertCount * 2)
  const normRadii = new Float32Array(vertCount)

  for (let i = 0; i < vertCount; i++) {
    const u = unitDirs[i]!
    const r = rawRadii[i]! * normScale
    normRadii[i] = r
    positions[i * 3] = u.x * r
    positions[i * 3 + 1] = u.y * r
    positions[i * 3 + 2] = u.z * r

    const phi = Math.acos(THREE.MathUtils.clamp(u.y, -1, 1))
    const horiz = Math.hypot(u.x, u.z) || 1
    const rUv = (phi / Math.PI) * 0.48
    uvs[i * 2] = 0.5 + (u.x / horiz) * rUv
    uvs[i * 2 + 1] = 0.5 + (u.z / horiz) * rUv
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(base.indices.slice())
  geo.computeVertexNormals()

  const norm = geo.getAttribute('normal') as THREE.BufferAttribute
  const colors = new Float32Array(vertCount * 3)
  const nLocal = new THREE.Vector3()
  const nGlobalWorld = new THREE.Vector3()
  const nGlobalLocal = new THREE.Vector3()
  const pWorld = new THREE.Vector3()

  const crown = options.crown
  const rotQ = crown?.worldRot ? new THREE.Quaternion().setFromEuler(crown.worldRot) : new THREE.Quaternion()
  const invRotQ = rotQ.clone().invert()
  const sc = crown?.worldScale ?? new THREE.Vector3(1, 1, 1)

  for (let i = 0; i < vertCount; i++) {
    const u = unitDirs[i]!
    nLocal.fromBufferAttribute(norm, i)

    if (crown) {
      pWorld.set(positions[i * 3]! * sc.x, positions[i * 3 + 1]! * sc.y, positions[i * 3 + 2]! * sc.z)
        .applyQuaternion(rotQ)
        .add(crown.worldPos)
      const rx = (pWorld.x - crown.crownCenter.x) / Math.max(crown.crownRadii.x, 0.1)
      const ry = (pWorld.y - crown.crownCenter.y) / Math.max(crown.crownRadii.y, 0.1)
      const rz = (pWorld.z - crown.crownCenter.z) / Math.max(crown.crownRadii.z, 0.1)
      // Global outward crown dome normal unifies shading across all overlapping clusters.
      nGlobalWorld.set(rx * 0.85, ry * 1.15 + 0.48, rz * 0.85).normalize()
      nGlobalLocal.copy(nGlobalWorld).applyQuaternion(invRotQ).normalize()

      nLocal.multiplyScalar(0.32).addScaledVector(nGlobalLocal, 0.68).normalize()
      norm.setXYZ(i, nLocal.x, nLocal.y, nLocal.z)

      const hGlobal = THREE.MathUtils.clamp((pWorld.y - (crown.crownCenter.y - crown.crownRadii.y)) / (crown.crownRadii.y * 2), 0, 1)
      const sunDot = THREE.MathUtils.clamp(nGlobalWorld.dot(KEY_LIGHT_DIR) * 0.5 + 0.5, 0, 1)
      const crestAO = THREE.MathUtils.smoothstep(normRadii[i]!, 0.68, 0.96)
      const shade = THREE.MathUtils.lerp(0.76, 1.04, Math.pow(hGlobal, 0.82))
        * THREE.MathUtils.lerp(0.93, 1.04, crestAO)
        * THREE.MathUtils.lerp(0.92, 1.04, sunDot)

      colors[i * 3] = THREE.MathUtils.clamp(shade * (0.96 + 0.06 * sunDot), 0.64, 1.06)
      colors[i * 3 + 1] = THREE.MathUtils.clamp(shade * (0.99 + 0.03 * sunDot), 0.70, 1.06)
      colors[i * 3 + 2] = THREE.MathUtils.clamp(shade * (0.95 - 0.06 * sunDot), 0.64, 1.02)
    } else {
      nGlobalLocal.set(u.x, u.y + 0.35, u.z).normalize()
      nLocal.lerp(nGlobalLocal, 0.55).normalize()
      norm.setXYZ(i, nLocal.x, nLocal.y, nLocal.z)
      const h = THREE.MathUtils.clamp((u.y + 1) * 0.5, 0, 1)
      colors[i * 3] = THREE.MathUtils.lerp(0.86, 1.03, h)
      colors[i * 3 + 1] = THREE.MathUtils.lerp(0.90, 1.04, h)
      colors[i * 3 + 2] = THREE.MathUtils.lerp(0.84, 0.96, h)
    }
  }
  norm.needsUpdate = true
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

/**
 * Appends a compact, strictly watertight, closed lenticular obtuse-oval banyan leaf
 * solid (12 vertices, 20 triangles) transformed by `mat4` into the target buffers.
 */
function appendWatertightBanyanLeaf(
  length: number,
  maxWidth: number,
  arch: number,
  thickness: number,
  mat4: THREE.Matrix4,
  crown: CrownShadingContext | undefined,
  rotQ: THREE.Quaternion,
  invRotQ: THREE.Quaternion,
  outPos: number[],
  outNorm: number[],
  outUv: number[],
  outCol: number[],
  outIdx: number[],
): void {
  const hw = maxWidth * 0.5
  const ht = thickness * 0.5
  // 8 perimeter ring vertices + 2 center spine ridges (top & bottom) -> 12 verts, 20 closed outward tris.
  // Perimeter (CCW looking from +Y):
  // 0: base (0, 0, 0)
  // 1: right-low (+0.74*hw, y1, 0.28*L)
  // 2: right-high (+0.92*hw, y2, 0.62*L)
  // 3: right-tip (+0.48*hw, y3, 0.88*L)
  // 4: apex (0, y4, L)
  // 5: left-tip (-0.48*hw, y3, 0.88*L)
  // 6: left-high (-0.92*hw, y2, 0.62*L)
  // 7: left-low (-0.74*hw, y1, 0.28*L)
  // 8: upper center spine (+midrib lift)
  // 9: upper rear-mid spine
  // 10: lower center spine
  // 11: lower rear-mid spine
  const y1 = arch * 0.72 + hw * 0.08
  const y2 = arch * 0.96 + hw * 0.11
  const y3 = arch * 0.45 + hw * 0.04
  const y4 = -arch * 0.35

  const localPts: [number, number, number, number, number][] = [
    [0, 0, 0, 0.5, 0.0],
    [0.74 * hw, y1, 0.28 * length, 0.88, 0.28],
    [0.94 * hw, y2, 0.62 * length, 0.98, 0.62],
    [0.50 * hw, y3, 0.88 * length, 0.75, 0.88],
    [0, y4, length, 0.5, 1.0],
    [-0.50 * hw, y3, 0.88 * length, 0.25, 0.88],
    [-0.94 * hw, y2, 0.62 * length, 0.02, 0.62],
    [-0.74 * hw, y1, 0.28 * length, 0.12, 0.28],
    // Upper center spines (indices 8, 9)
    [0, arch * 0.62 + ht * 1.15, 0.34 * length, 0.5, 0.34],
    [0, arch * 0.82 + ht, 0.68 * length, 0.5, 0.68],
    // Lower center spines (indices 10, 11)
    [0, arch * 0.62 - ht * 1.35, 0.34 * length, 0.5, 0.34],
    [0, arch * 0.82 - ht * 1.15, 0.68 * length, 0.5, 0.68],
  ]

  // Top sheet (10 tris, CCW from +Y) and bottom sheet (10 tris, CW from +Y -> outward -Y).
  const leafTris: [number, number, number][] = [
    // Upper surface (+Y outward)
    [0, 8, 1], [1, 8, 9], [1, 9, 2], [2, 9, 3], [3, 9, 4],
    [4, 9, 5], [5, 9, 6], [6, 9, 8], [6, 8, 7], [7, 8, 0],
    // Lower surface (-Y outward)
    [0, 1, 10], [1, 11, 10], [1, 2, 11], [2, 3, 11], [3, 4, 11],
    [4, 5, 11], [5, 6, 11], [6, 10, 11], [6, 7, 10], [7, 0, 10],
  ]

  const baseIdx = outPos.length / 3
  const transformed: THREE.Vector3[] = []
  for (const [lx, ly, lz] of localPts) {
    transformed.push(new THREE.Vector3(lx, ly, lz).applyMatrix4(mat4))
  }

  // Verify outward positive volume locally before writing indices.
  const flatPts: number[] = []
  for (const p of transformed) flatPts.push(p.x, p.y, p.z)
  const flatTris: number[] = []
  for (const t of leafTris) flatTris.push(t[0], t[1], t[2])
  if (signedVolumeIndexed(flatPts, flatTris) < 0) {
    for (let i = 0; i < flatTris.length; i += 3) {
      const tmp = flatTris[i + 1]!
      flatTris[i + 1] = flatTris[i + 2]!
      flatTris[i + 2] = tmp
    }
  }

  // Compute smooth local vertex normals on this leaf.
  const accNormals = transformed.map(() => new THREE.Vector3())
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const fn = new THREE.Vector3()
  for (let i = 0; i < flatTris.length; i += 3) {
    const ia = flatTris[i]!
    const ib = flatTris[i + 1]!
    const ic = flatTris[i + 2]!
    e1.subVectors(transformed[ib]!, transformed[ia]!)
    e2.subVectors(transformed[ic]!, transformed[ia]!)
    fn.crossVectors(e1, e2)
    accNormals[ia]!.add(fn)
    accNormals[ib]!.add(fn)
    accNormals[ic]!.add(fn)
  }

  const pWorld = new THREE.Vector3()
  const nGlobalWorld = new THREE.Vector3()
  const nGlobalLocal = new THREE.Vector3()

  for (let i = 0; i < transformed.length; i++) {
    const p = transformed[i]!
    const n = accNormals[i]!
    if (n.lengthSq() > 1e-12) n.normalize()
    else n.set(0, 1, 0)

    const lu = localPts[i]![3]
    const lv = localPts[i]![4]

    if (crown) {
      pWorld.copy(p).applyQuaternion(rotQ).add(crown.worldPos)
      const rx = (pWorld.x - crown.crownCenter.x) / Math.max(crown.crownRadii.x, 0.1)
      const ry = (pWorld.y - crown.crownCenter.y) / Math.max(crown.crownRadii.y, 0.1)
      const rz = (pWorld.z - crown.crownCenter.z) / Math.max(crown.crownRadii.z, 0.1)
      nGlobalWorld.set(rx * 0.85, ry * 1.15 + 0.52, rz * 0.85).normalize()
      nGlobalLocal.copy(nGlobalWorld).applyQuaternion(invRotQ).normalize()

      // Strong global-crown dome blend so leaf rosettes read as bright, soft Komorebi foliage tufts.
      n.multiplyScalar(0.26).addScaledVector(nGlobalLocal, 0.74).normalize()

      const hGlobal = THREE.MathUtils.clamp((pWorld.y - (crown.crownCenter.y - crown.crownRadii.y)) / (crown.crownRadii.y * 2), 0, 1)
      const sunDot = THREE.MathUtils.clamp(nGlobalWorld.dot(KEY_LIGHT_DIR) * 0.5 + 0.5, 0, 1)
      const tipWarm = THREE.MathUtils.lerp(0.95, 1.07, lv)
      const shade = THREE.MathUtils.lerp(0.82, 1.05, Math.pow(hGlobal, 0.78))
        * THREE.MathUtils.lerp(0.94, 1.05, sunDot)
        * tipWarm

      outCol.push(
        THREE.MathUtils.clamp(shade * (0.97 + 0.06 * sunDot), 0.70, 1.08),
        THREE.MathUtils.clamp(shade * (1.00 + 0.03 * sunDot), 0.76, 1.08),
        THREE.MathUtils.clamp(shade * (0.94 - 0.06 * sunDot), 0.68, 1.02),
      )
    } else {
      const tipWarm = THREE.MathUtils.lerp(0.92, 1.05, lv)
      outCol.push(tipWarm * 0.99, tipWarm * 1.02, tipWarm * 0.93)
    }

    outPos.push(p.x, p.y, p.z)
    outNorm.push(n.x, n.y, n.z)
    outUv.push(lu, lv)
  }

  for (const idx of flatTris) {
    outIdx.push(baseIdx + idx)
  }
}

/**
 * Compact watertight 5-leaf molded replica banyan rosette tuft (60 vertices, 100
 * triangles). Placed around the crown silhouette and upper dome to break smooth
 * curves into lively stylized artificial banyan leaf clusters matching Komorebi's
 * tufted foliage language.
 */
export function createReplicaLeafRosetteGeometry(crown?: CrownShadingContext): THREE.BufferGeometry {
  const leafSpecs = [
    { length: 0.145, width: 0.098, arch: 0.018, yaw: 0.05, pitch: -0.18, roll: 0.02, offset: [0, 0.006, 0.012] as const },
    { length: 0.138, width: 0.092, arch: 0.016, yaw: 1.18, pitch: -0.24, roll: 0.14, offset: [0.012, 0.002, 0.005] as const },
    { length: 0.136, width: 0.092, arch: 0.016, yaw: -1.12, pitch: -0.22, roll: -0.14, offset: [-0.012, 0.002, 0.005] as const },
    { length: 0.128, width: 0.088, arch: 0.015, yaw: 2.42, pitch: -0.28, roll: 0.10, offset: [0.008, -0.004, -0.010] as const },
    { length: 0.128, width: 0.088, arch: 0.015, yaw: -2.38, pitch: -0.26, roll: -0.10, offset: [-0.008, -0.004, -0.010] as const },
  ]

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const mat4 = new THREE.Matrix4()
  const rotQ = crown?.worldRot ? new THREE.Quaternion().setFromEuler(crown.worldRot) : new THREE.Quaternion()
  const invRotQ = rotQ.clone().invert()
  const sc = crown?.worldScale ?? new THREE.Vector3(1, 1, 1)

  for (const spec of leafSpecs) {
    mat4.makeRotationFromEuler(new THREE.Euler(spec.pitch, spec.yaw, spec.roll, 'YXZ'))
    mat4.setPosition(spec.offset[0], spec.offset[1], spec.offset[2])
    // Apply per-rosette uniform scale into leaf dimensions if provided via crown.worldScale.
    const s = (sc.x + sc.y + sc.z) / 3
    appendWatertightBanyanLeaf(
      spec.length * (crown ? 1 : s),
      spec.width * (crown ? 1 : s),
      spec.arch,
      0.014,
      mat4,
      crown,
      rotQ,
      invRotQ,
      positions,
      normals,
      uvs,
      colors,
      indices,
    )
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

// ---------------------------------------------------------------------------
// Three-tier satin-matte stylized replica banyan foliage materials
// ---------------------------------------------------------------------------

type FoliageTier = 'deep' | 'mid' | 'sun'

type FoliagePalette = {
  hi: readonly [number, number, number]
  mid: readonly [number, number, number]
  lo: readonly [number, number, number]
  seed: number
}

// Close, harmonized Komorebi olive-banyan replica greens: rich sunlit warmth without harsh
// band breaks between tiers, keeping a tidy satin-matte artificial foliage finish.
const FOLIAGE_PALETTES: Record<FoliageTier, FoliagePalette> = {
  deep: { hi: [110, 146, 70], mid: [88, 124, 58], lo: [66, 98, 48], seed: 613 },
  mid: { hi: [128, 164, 78], mid: [104, 140, 66], lo: [80, 114, 54], seed: 709 },
  sun: { hi: [148, 180, 88], mid: [122, 156, 74], lo: [94, 126, 60], seed: 823 },
}

type LeafStamp = {
  cx: number
  cy: number
  rx: number
  ry: number
  cosA: number
  sinA: number
  tint: number
}

function buildLeafStamps(seed: number): LeafStamp[] {
  const stamps: LeafStamp[] = []
  const count = 48
  for (let i = 0; i < count; i++) {
    const cx = hash2(i, 1, seed)
    const cy = hash2(i, 2, seed)
    const angle = hash2(i, 3, seed) * Math.PI * 2
    const rx = 0.062 + hash2(i, 4, seed) * 0.036
    const ry = rx * (0.58 + hash2(i, 5, seed) * 0.16)
    const tint = (hash2(i, 6, seed) - 0.5) * 0.28
    stamps.push({ cx, cy, rx, ry, cosA: Math.cos(angle), sinA: Math.sin(angle), tint })
  }
  return stamps
}

function buildReplicaCanopyPixels(tier: FoliageTier): PixelBuffers {
  const key = `lamtsuen-replica-canopy-${tier}-v3`
  const existing = cachedPixels.get(key)
  if (existing) return existing

  const size = 128
  const pal = FOLIAGE_PALETTES[tier]
  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)
  const stamps = buildLeafStamps(pal.seed + 91)

  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size

      const bed = periodicNoise(u * 4, v * 4, 4, 4, pal.seed + 17)
      const grain = periodicNoise(u * 10, v * 10, 10, 10, pal.seed + 43)
      let tone = 0.34 + bed * 0.26 + grain * 0.10
      let height = 0.36 + bed * 0.20

      for (const s of stamps) {
        let dx = u - s.cx
        let dy = v - s.cy
        if (dx > 0.5) dx -= 1
        else if (dx < -0.5) dx += 1
        if (dy > 0.5) dy -= 1
        else if (dy < -0.5) dy += 1

        const lx = (dx * s.cosA + dy * s.sinA) / s.rx
        const ly = (-dx * s.sinA + dy * s.cosA) / s.ry
        const d2 = lx * lx + ly * ly
        if (d2 < 1.35) {
          if (d2 >= 0.86) {
            const halo = 1 - (d2 - 0.86) / 0.49
            tone -= halo * 0.09
            height -= halo * 0.08
          }
          if (d2 < 1.0) {
            const edge = THREE.MathUtils.smoothstep(1 - d2, 0.0, 0.36)
            const midrib = Math.exp(-ly * ly * 26) * (1 - lx * lx) * 0.14
            const tipGrad = (lx * 0.5 + 0.5) * 0.12
            const leafTone = 0.55 + s.tint + tipGrad + midrib
            const leafHeight = 0.58 + (1 - d2) * 0.24 + midrib * 0.45
            tone = THREE.MathUtils.lerp(tone, leafTone, edge * 0.72)
            height = THREE.MathUtils.lerp(height, leafHeight, edge * 0.70)
          }
        }
      }

      const t = THREE.MathUtils.clamp(tone, 0, 1)
      const hiMix = THREE.MathUtils.smoothstep(t, 0.50, 0.90)
      const loMix = (1 - THREE.MathUtils.smoothstep(t, 0.14, 0.50)) * 0.74

      let r = THREE.MathUtils.lerp(pal.mid[0], pal.hi[0], hiMix)
      let g = THREE.MathUtils.lerp(pal.mid[1], pal.hi[1], hiMix)
      let b = THREE.MathUtils.lerp(pal.mid[2], pal.hi[2], hiMix)
      r = THREE.MathUtils.lerp(r, pal.lo[0], loMix)
      g = THREE.MathUtils.lerp(g, pal.lo[1], loMix)
      b = THREE.MathUtils.lerp(b, pal.lo[2], loMix)

      const idx = (y * size + x) * 4
      color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 186)
      color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 202)
      color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 124)
      color[idx + 3] = 255

      const bh = THREE.MathUtils.clamp(Math.round(128 + (THREE.MathUtils.clamp(height, 0, 1) - 0.5) * 60), 76, 186)
      bump[idx] = bump[idx + 1] = bump[idx + 2] = bh
      bump[idx + 3] = 255
    }
  }

  const buffers = { color, bump, size }
  cachedPixels.set(key, buffers)
  return buffers
}

export function createReplicaCanopyMaterials(): {
  deepLeaf: THREE.MeshStandardMaterial
  midLeaf: THREE.MeshStandardMaterial
  sunLeaf: THREE.MeshStandardMaterial
} {
  const make = (tier: FoliageTier, roughness: number) => {
    const pixels = buildReplicaCanopyPixels(tier)
    const map = makeTexture(pixels.color, pixels.size, THREE.SRGBColorSpace, 2.4, 2.4)
    const bump = makeTexture(pixels.bump, pixels.size, THREE.NoColorSpace, 2.4, 2.4)
    // Restrained satin-matte stylized artificial conservation canopy finish.
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap: bump,
      bumpScale: 0.0042,
      roughness,
      metalness: 0,
      envMapIntensity: 0.34,
      vertexColors: true,
    })
    mat.userData.treeClusterNormals = true
    mat.userData.komorebiPigment = true
    bindTextureDisposal(mat, [map, bump])
    return mat
  }

  return {
    deepLeaf: make('deep', 0.78),
    midLeaf: make('mid', 0.74),
    sunLeaf: make('sun', 0.71),
  }
}
