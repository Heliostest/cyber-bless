import * as THREE from 'three'

type XYZ = [number, number, number]

interface CachedTexturePixels {
  color: Uint8Array
  bump: Uint8Array
  size: number
}

let cachedCottonSliverPixels: CachedTexturePixels | null = null
let cachedCopPixels: CachedTexturePixels | null = null
let cachedYarnPixels: CachedTexturePixels | null = null
let cachedBeltPixels: CachedTexturePixels | null = null

function hash2Periodic(ix: number, iy: number, period: number): number {
  const x = ((ix % period) + period) % period
  const y = ((iy % period) + period) % period
  const h = Math.sin(x * 127.1 + y * 311.7 + period * 19.19) * 43758.5453123
  return h - Math.floor(h)
}

function valueNoisePeriodic(u: number, v: number, period: number): number {
  const fx = u * period
  const fy = v * period
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = fx - ix
  const ty = fy - iy
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const n00 = hash2Periodic(ix, iy, period)
  const n10 = hash2Periodic(ix + 1, iy, period)
  const n01 = hash2Periodic(ix, iy + 1, period)
  const n11 = hash2Periodic(ix + 1, iy + 1, period)
  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx
  return nx0 + (nx1 - nx0) * sy
}

function configureTexture(
  data: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  repeatX: number,
  repeatY: number,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(data), size, size, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.colorSpace = colorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/** Ensures `disposeTree(subject)` frees every owned procedural map/bumpMap exactly once. */
function bindMaterialTextures(
  material: THREE.MeshStandardMaterial,
  map: THREE.DataTexture,
  bumpMap: THREE.DataTexture,
  bumpScale: number,
): THREE.MeshStandardMaterial {
  material.map = map
  material.bumpMap = bumpMap
  material.bumpScale = bumpScale
  let freed = false
  material.addEventListener('dispose', () => {
    if (freed) return
    freed = true
    map.dispose()
    bumpMap.dispose()
  })
  return material
}

/** 256x256 seamless mipmapped combed raw-cotton sliver (puni) fiber texture + bump. */
function createCottonSliverTextures(repeatX: number, repeatY: number) {
  const size = 256
  if (!cachedCottonSliverPixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const warp = valueNoisePeriodic(u, v, 8) - 0.5
        const tuft = valueNoisePeriodic(u + 0.23, v + 0.41, 18) - 0.5
        const fine = valueNoisePeriodic(u + 0.61, v + 0.17, 44) - 0.5
        // Flowing combed longitudinal raw-cotton fiber locks with gentle soft loft.
        const combA = Math.sin((v * 14 + u * 2 + warp * 1.1) * tau)
        const combB = Math.sin((v * 26 - u * 3 + tuft * 1.3) * tau) * 0.55
        const wisp = (combA * 0.62 + combB * 0.38) * (0.72 + 0.28 * (0.5 + tuft))
        const shade = warp * 10.5 + tuft * 8.5 + fine * 4.2 + wisp * 8.2
        const lum = 236 + shade
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(lum + 6.5), 206, 254)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(lum + 1.0), 196, 249)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(lum - 12.5), 178, 234)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(132 + wisp * 46 + tuft * 34 + fine * 20), 22, 242)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedCottonSliverPixels = { color, bump, size }
  }
  return {
    map: configureTexture(cachedCottonSliverPixels.color, size, THREE.SRGBColorSpace, repeatX, repeatY),
    bump: configureTexture(cachedCottonSliverPixels.bump, size, THREE.NoColorSpace, repeatX, repeatY),
  }
}

/**
 * 256x256 seamless mipmapped cross-wound spun-cotton spindle cop texture + bump.
 * Shows dense overlapping diagonal `/` and `\` khadi cotton thread courses and soft shoulder shading.
 */
function createCrossWoundCopTextures(repeatX: number, repeatY: number) {
  const size = 256
  if (!cachedCopPixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const drift = (valueNoisePeriodic(u, v, 10) - 0.5) * 0.08
        const grain = valueNoisePeriodic(u + 0.31, v + 0.19, 36) - 0.5
        // Fine circumferential & gently cross-angled spun cotton courses.
        const courseA = Math.cos((v * 26 + u * 3 + drift * 2.2) * tau)
        const courseB = Math.cos((v * 24 - u * 4 - drift * 2.0) * tau)
        const crossBlend = 0.5 + 0.5 * Math.sin((u * 2 + v * 3) * tau)
        const ridge = Math.max(courseA * (0.78 + 0.22 * crossBlend), courseB * (0.72 + 0.28 * (1 - crossBlend)))
        // Fine spun-ply micro-twist along each cotton course.
        const ply = Math.sin((u * 42 + v * 12) * tau) * 0.24
        const groove = ridge * 0.80 + ply * 0.20
        // Soft natural depth toward rear stop and tapered nose.
        const belly = Math.sin(THREE.MathUtils.clamp(v, 0, 1) * Math.PI)
        const shoulderShade = -10 * (1 - belly) * (1 - belly)
        const lum = 235 + groove * 13.5 + grain * 5.2 + shoulderShade
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(lum + 5.0), 190, 253)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(lum - 0.5), 182, 246)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(lum - 13.0), 165, 232)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(134 + groove * 56 + grain * 22), 20, 244)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedCopPixels = { color, bump, size }
  }
  return {
    map: configureTexture(cachedCopPixels.color, size, THREE.SRGBColorSpace, repeatX, repeatY),
    bump: configureTexture(cachedCopPixels.bump, size, THREE.NoColorSpace, repeatX, repeatY),
  }
}

/** 128x128 seamless mipmapped hand-spun cotton yarn twist texture + bump aligned to tube UVs. */
function createSpunYarnTextures(repeatX: number, repeatY: number) {
  const size = 128
  if (!cachedYarnPixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const slub = (valueNoisePeriodic(u, v, 12) - 0.5) * 6.5
        const fine = (valueNoisePeriodic(u + 0.37, v + 0.13, 32) - 0.5) * 4.2
        // Z-twist spun micro-fibrils running diagonally around the ply tube.
        const micro = Math.sin((u * 10 - v * 3) * tau)
        const strand = Math.cos((u * 4 - v * 2) * tau)
        const shade = strand * 7.5 + micro * 4.5 + slub + fine
        const lum = 238 + shade
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(lum + 3.5), 198, 255)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(lum + 0.5), 190, 250)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(lum - 8.5), 174, 238)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(132 + strand * 40 + micro * 26 + fine * 3.5), 24, 240)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedYarnPixels = { color, bump, size }
  }
  return {
    map: configureTexture(cachedYarnPixels.color, size, THREE.SRGBColorSpace, repeatX, repeatY),
    bump: configureTexture(cachedYarnPixels.bump, size, THREE.NoColorSpace, repeatX, repeatY),
  }
}

/** 128x128 seamless mipmapped 2-ply twisted hemp/cotton drive-belt cord texture + bump. */
function createDriveBeltTextures(repeatX: number, repeatY: number) {
  const size = 128
  if (!cachedBeltPixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const ply = Math.cos((u * 4 - v * 2) * tau)
        const micro = Math.sin((u * 14 - v * 5) * tau)
        const fiber = (valueNoisePeriodic(u, v, 24) - 0.5) * 10
        const shade = ply * 16 + micro * 5 + fiber
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(145 + shade), 96, 186)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(119 + shade * 0.84), 76, 156)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(86 + shade * 0.68), 52, 118)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(128 + ply * 56 + micro * 18 + fiber * 2.2), 18, 244)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedBeltPixels = { color, bump, size }
  }
  return {
    map: configureTexture(cachedBeltPixels.color, size, THREE.SRGBColorSpace, repeatX, repeatY),
    bump: configureTexture(cachedBeltPixels.bump, size, THREE.NoColorSpace, repeatX, repeatY),
  }
}

/**
 * Builds an organically combed raw-cotton sliver (puni) bundle strictly bounded by the baseline
 * sphere envelope so floor contact at p0 (min.y = -1) and auto-fit camera distance stay bit-exact.
 */
function createCardedCottonSliverGeometry(): THREE.BufferGeometry {
  // Match baseline 32x20 equator peak vertex (-1.038529, 0, 0.206576) while doubling surface resolution (64x32).
  const geo = new THREE.SphereGeometry(1, 64, 32)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const peakDir = new THREE.Vector3(-0.98078528, 0, 0.19509032).normalize()
  const peakK = 1 + 0.06 * Math.sin(peakDir.x * 13 + peakDir.z * 8)

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i)
    const uy = pos.getY(i)
    const uz = pos.getZ(i)
    const rYZ = Math.hypot(uy, uz)
    const phi = Math.atan2(uz, uy)
    const eq = 1 - uy * uy
    // Combed longitudinal raw-cotton fiber locks & soft pillowed puni ripples.
    const combFlutes =
      0.044 * Math.cos(phi * 7 + ux * 3.8) +
      0.024 * Math.sin(phi * 11 - ux * 5.2) +
      0.018 * Math.cos(phi * 4 + ux * 2.1)
    const loft = 0.022 * Math.sin(ux * 6.5 + uz * 4.5)
    // Stay strictly inside baseline radial envelope (0.962 + flutes <= 1.0) except smoothly meeting exact
    // baseline peak vertex at peakDir so auto-fit camera distance matches frozen f06e937f bit-for-bit.
    const dotPeak = Math.max(0, ux * peakDir.x + uy * peakDir.y + uz * peakDir.z)
    const peakBlend = Math.pow(dotPeak, 96)
    const baseR = 0.962 + (combFlutes * rYZ + loft) * eq
    const k = THREE.MathUtils.lerp(Math.min(0.994, baseR), peakK, peakBlend)
    const ky = uy < 0 && eq < 0.01 ? 1.0 : Math.min(1.0, 0.965 + 0.035 * (1 - eq) + combFlutes * 0.35 * eq)
    pos.setXYZ(i, Math.max(-1.038529, ux * k), uy * ky, uz * k)
  }
  // Pin exact south-pole grounding (minY = -1.0) and exact baseline peak vertex for zero camera drift.
  let bestPeakIdx = 0
  let bestPeakDot = -Infinity
  let minYIdx = 0
  let minYVal = Infinity
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    if (y < minYVal) { minYVal = y; minYIdx = i }
    const len = Math.hypot(x, y, z)
    if (len > 1e-6) {
      const d = (x * peakDir.x + y * peakDir.y + z * peakDir.z) / len
      if (d > bestPeakDot) { bestPeakDot = d; bestPeakIdx = i }
    }
  }
  pos.setXYZ(bestPeakIdx, peakDir.x * peakK, 0, peakDir.z * peakK)
  pos.setY(minYIdx, -1.0)
  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

/**
 * Allocates a closed, outward-facing, UV-mapped tube geometry with single-ring seam duplication
 * so textures wrap cleanly and in-place updates never reallocate GPU buffers.
 */
function allocateCappedTubeGeometry(
  tubularSegs: number,
  radialSegs: number,
  uvRepeatU: number,
  dynamic = false,
): THREE.BufferGeometry {
  const ringStride = radialSegs + 1
  const sideVerts = (tubularSegs + 1) * ringStride
  const startPole = sideVerts
  const endPole = sideVerts + 1
  const totalVerts = sideVerts + 2

  const positions = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const indices: number[] = []

  for (let i = 0; i <= tubularSegs; i++) {
    const u = (i / tubularSegs) * uvRepeatU
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs
      const idx = (i * ringStride + j) * 2
      uvs[idx] = u
      uvs[idx + 1] = v
    }
  }
  uvs[startPole * 2] = 0; uvs[startPole * 2 + 1] = 0.5
  uvs[endPole * 2] = uvRepeatU; uvs[endPole * 2 + 1] = 0.5

  // Side quads: outward normal (∂P/∂j) × (∂P/∂i) => (a, b, c), (b, d, c).
  for (let i = 0; i < tubularSegs; i++) {
    const rowA = i * ringStride
    const rowB = (i + 1) * ringStride
    for (let j = 0; j < radialSegs; j++) {
      const a = rowA + j
      const b = rowA + j + 1
      const c = rowB + j
      const d = rowB + j + 1
      indices.push(a, b, c, b, d, c)
    }
  }
  // Start cap (normal along -tangent) & end cap (normal along +tangent).
  for (let j = 0; j < radialSegs; j++) {
    indices.push(startPole, j + 1, j)
  }
  const lastRow = tubularSegs * ringStride
  for (let j = 0; j < radialSegs; j++) {
    indices.push(endPole, lastRow + j, lastRow + j + 1)
  }

  const geometry = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(positions, 3)
  if (dynamic) posAttr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', posAttr)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

/**
 * Allocates a closed seamless periodic 2-ply twisted drive belt geometry around a closed curve.
 * Preserves max outer radius <= 0.014 to guarantee exact pulley contact & auto-fit camera parity.
 */
function createTwistedDriveBeltGeometry(
  curve: THREE.CurvePath<THREE.Vector3>,
  tubularSegs: number,
  radialSegs: number,
  baseRadius: number,
  plyDepth: number,
  turns: number,
): THREE.BufferGeometry {
  const ringStride = radialSegs + 1
  const positions = new Float32Array((tubularSegs + 1) * ringStride * 3)
  const uvs = new Float32Array((tubularSegs + 1) * ringStride * 2)
  const indices: number[] = []

  const centers: THREE.Vector3[] = []
  const tangents: THREE.Vector3[] = []
  for (let i = 0; i <= tubularSegs; i++) {
    const u = i === tubularSegs ? 0 : i / tubularSegs
    centers.push(curve.getPointAt(u))
    tangents.push(curve.getTangentAt(u).normalize())
  }

  // Parallel-transport Bishop frame along the planar XY loop (normal stays aligned with +Z!).
  const normals: THREE.Vector3[] = []
  const binormals: THREE.Vector3[] = []
  const refZ = new THREE.Vector3(0, 0, 1)
  for (let i = 0; i <= tubularSegs; i++) {
    const t = tangents[i]!
    const n = refZ.clone()
    const b = new THREE.Vector3().crossVectors(t, n).normalize()
    n.crossVectors(b, t).normalize()
    normals.push(n)
    binormals.push(b)
  }

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs
    const c = centers[i]!
    const n = normals[i]!
    const b = binormals[i]!
    const twist = u * turns * Math.PI * 2
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs
      const theta = v * Math.PI * 2
      const r = baseRadius * (1 + plyDepth * Math.cos(2 * (theta - twist)))
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)
      const vx = c.x + (n.x * cosT + b.x * sinT) * r
      const vy = c.y + (n.y * cosT + b.y * sinT) * r
      const vz = c.z + (n.z * cosT + b.z * sinT) * r
      const pIdx = (i * ringStride + j) * 3
      positions[pIdx] = vx
      positions[pIdx + 1] = vy
      positions[pIdx + 2] = vz
      const uvIdx = (i * ringStride + j) * 2
      uvs[uvIdx] = u * 36
      uvs[uvIdx + 1] = v
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    const rowA = i * ringStride
    const rowB = (i + 1) * ringStride
    for (let j = 0; j < radialSegs; j++) {
      const a = rowA + j
      const b = rowA + j + 1
      const c = rowB + j
      const d = rowB + j + 1
      indices.push(a, b, c, b, d, c)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Tapered whipped-cotton cord splice sleeve aligned along +Y before tangent orientation. */
function createWhippedSpliceGeometry(): THREE.BufferGeometry {
  const profile: THREE.Vector2[] = []
  const steps = 16
  const halfLen = 0.036
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    const y = (u - 0.5) * 2 * halfLen
    const belly = Math.sin(u * Math.PI)
    const whip = 0.0009 * Math.sin(u * Math.PI * 10) * belly
    // Smooth taper from drive cord radius (0.0138) to neat whipped collar (0.0188 <= 0.022 baseline).
    const r = i === 0 || i === steps ? 0.008 : 0.0138 + 0.0046 * Math.pow(belly, 0.72) + whip
    profile.push(new THREE.Vector2(r, y))
  }
  const geo = new THREE.LatheGeometry(profile, 20)
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

// Reusable scratch vectors for zero-allocation in-place `pose()` updates.
const _pts: THREE.Vector3[] = []
const _prevTan = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _norm = new THREE.Vector3()
const _binorm = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _refY = new THREE.Vector3(0, 1, 0)
const _refX = new THREE.Vector3(1, 0, 0)
const _dir = new THREE.Vector3()
const _sideA = new THREE.Vector3()
const _sideB = new THREE.Vector3()
const _from = new THREE.Vector3()
const _to = new THREE.Vector3()
const _beltTan = new THREE.Vector3()

function ensureScratchPoints(count: number): void {
  while (_pts.length < count) _pts.push(new THREE.Vector3())
}

/**
 * Rewrites a pre-allocated capped tube in-place using a smooth twist-free parallel-transport
 * Bishop frame (zero sudden Y-up normal flips and zero per-frame GPU buffer reallocations).
 */
function writeBishopCappedTube(
  geometry: THREE.BufferGeometry,
  tubularSegs: number,
  radialSegs: number,
  sampleCenter: (t: number, out: THREE.Vector3) => void,
  sampleRadius: (t: number, theta: number) => number,
): void {
  ensureScratchPoints(tubularSegs + 1)
  for (let i = 0; i <= tubularSegs; i++) {
    sampleCenter(i / tubularSegs, _pts[i]!)
  }

  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  const ringStride = radialSegs + 1

  // Initial tangent and orthonormal Bishop basis.
  _prevTan.subVectors(_pts[1]!, _pts[0]!)
  if (_prevTan.lengthSq() < 1e-12) _prevTan.set(0, 0, 1)
  else _prevTan.normalize()

  const ref = Math.abs(_prevTan.dot(_refY)) < 0.92 ? _refY : _refX
  _norm.crossVectors(ref, _prevTan).normalize()
  _binorm.crossVectors(_prevTan, _norm).normalize()

  // Start cap pole slightly inset along -tangent for non-degenerate convex cap.
  const rStart = sampleRadius(0, 0)
  const p0 = _pts[0]!
  const startPole = (tubularSegs + 1) * ringStride
  posAttr.setXYZ(
    startPole,
    p0.x - _prevTan.x * rStart * 0.35,
    p0.y - _prevTan.y * rStart * 0.35,
    p0.z - _prevTan.z * rStart * 0.35,
  )

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs
    const c = _pts[i]!
    if (i > 0) {
      if (i < tubularSegs) _tan.subVectors(_pts[i + 1]!, _pts[i - 1]!)
      else _tan.subVectors(_pts[i]!, _pts[i - 1]!)
      if (_tan.lengthSq() > 1e-12) {
        _tan.normalize()
        const dot = THREE.MathUtils.clamp(_prevTan.dot(_tan), -1, 1)
        if (dot < 0.999999 && dot > -0.999999) {
          _quat.setFromUnitVectors(_prevTan, _tan)
          _norm.applyQuaternion(_quat)
        }
        _norm.addScaledVector(_tan, -_norm.dot(_tan))
        if (_norm.lengthSq() > 1e-10) _norm.normalize()
        _binorm.crossVectors(_tan, _norm).normalize()
        _prevTan.copy(_tan)
      }
    }
    const rowOffset = i * ringStride
    for (let j = 0; j <= radialSegs; j++) {
      const theta = (j === radialSegs ? 0 : j / radialSegs) * Math.PI * 2
      const r = sampleRadius(t, theta)
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)
      const nx = _norm.x * cosT + _binorm.x * sinT
      const ny = _norm.y * cosT + _binorm.y * sinT
      const nz = _norm.z * cosT + _binorm.z * sinT
      posAttr.setXYZ(rowOffset + j, c.x + nx * r, c.y + ny * r, c.z + nz * r)
    }
  }

  const rEnd = sampleRadius(1, 0)
  const pEnd = _pts[tubularSegs]!
  const endPole = startPole + 1
  posAttr.setXYZ(
    endPole,
    pEnd.x + _prevTan.x * rEnd * 0.35,
    pEnd.y + _prevTan.y * rEnd * 0.35,
    pEnd.z + _prevTan.z * rEnd * 0.35,
  )

  posAttr.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

/** Original open-frame charkha illustration. Fiber paths and winding are deliberately slowed. */
export function createCharkhaModel() {
  const subject = new THREE.Group(); subject.name = 'charkha-subject'
  const wood = new THREE.MeshStandardMaterial({ color: 0xc48c50, roughness: .82 })
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x89552f, roughness: .85 })
  const iron = new THREE.MeshStandardMaterial({ color: 0x727d80, roughness: .36, metalness: .65 })
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xa7bbaf, roughness: .97 })
  const hemMat = new THREE.MeshStandardMaterial({ color: 0xe4d6b4, roughness: .95 })

  const cottonTex = createCottonSliverTextures(2, 2)
  const cottonMat = bindMaterialTextures(
    new THREE.MeshStandardMaterial({ color: 0xfaf3e6, roughness: .97 }),
    cottonTex.map,
    cottonTex.bump,
    .016,
  )

  const draftingTex = createCottonSliverTextures(1.5, 1.5)
  const draftingMat = bindMaterialTextures(
    new THREE.MeshStandardMaterial({ color: 0xf7eedc, roughness: .97 }),
    draftingTex.map,
    draftingTex.bump,
    .012,
  )

  const copTex = createCrossWoundCopTextures(3, 1.35)
  const copMat = bindMaterialTextures(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .96 }),
    copTex.map,
    copTex.bump,
    .013,
  )

  const yarnLightTex = createSpunYarnTextures(1, 1)
  const yarnLightMat = bindMaterialTextures(
    new THREE.MeshStandardMaterial({ color: 0xfcf5e6, roughness: .95 }),
    yarnLightTex.map,
    yarnLightTex.bump,
    .009,
  )

  const yarnMidTex = createSpunYarnTextures(1, 1)
  const yarnMidMat = bindMaterialTextures(
    new THREE.MeshStandardMaterial({ color: 0xeee0c2, roughness: .95 }),
    yarnMidTex.map,
    yarnMidTex.bump,
    .009,
  )

  const windingTex = createSpunYarnTextures(1, 1)
  const windingMat = bindMaterialTextures(
    new THREE.MeshStandardMaterial({ color: 0xf3e7cd, roughness: .95 }),
    windingTex.map,
    windingTex.bump,
    .008,
  )

  const beltTex = createDriveBeltTextures(1, 1)
  const cordMat = bindMaterialTextures(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .96 }),
    beltTex.map,
    beltTex.bump,
    .012,
  )

  const spliceTex = createSpunYarnTextures(2, 1)
  const spliceMat = bindMaterialTextures(
    new THREE.MeshStandardMaterial({ color: 0xf6ebd4, roughness: .95 }),
    spliceTex.map,
    spliceTex.bump,
    .008,
  )

  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = subject) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.position.set(...p); m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }

  // Wooden open frame, 8-spoke wheel, crank, and iron spindle hardware (strictly unchanged).
  add('charkha-base', new THREE.BoxGeometry(2.62, .17, .56), wood, [0, .055, 0])
  for (const side of [-1, 1]) add('charkha-foot-' + side, new THREE.BoxGeometry(.19, .17, 1.10), wood, [side * 1.12, .055, .23])
  for (const side of [-1, 1]) {
    add('charkha-wheel-post-' + side, new THREE.BoxGeometry(.13, 1.05, .12), darkWood, [.60, .665, side * .20])
    add('charkha-spindle-post-' + side, new THREE.BoxGeometry(.15, .55, .12), wood, [-.90, .415, side * .19])
  }
  const axle = add('charkha-wheel-axle', new THREE.CylinderGeometry(.035, .035, .70, 16), iron, [.60, 1.12, 0]); axle.rotation.x = Math.PI / 2
  const wheel = new THREE.Group(); wheel.name = 'charkha-wheel'; wheel.position.set(.60, 1.12, 0); subject.add(wheel)
  const hub = add('charkha-hub', new THREE.CylinderGeometry(.12, .12, .27, 24), darkWood, [0, 0, 0], wheel); hub.rotation.x = Math.PI / 2
  for (const side of [-1, 1]) add('charkha-rim-' + side, new THREE.TorusGeometry(.72, .045, 10, 64), wood, [0, 0, side * .065], wheel)
  add('charkha-rim-core', new THREE.TorusGeometry(.72, .033, 10, 64), darkWood, [0, 0, 0], wheel)
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, spoke = add('charkha-spoke-' + i, new THREE.BoxGeometry(.65, .052, .11), wood, [Math.cos(angle) * .385, Math.sin(angle) * .385, 0], wheel); spoke.rotation.z = angle
  }
  add('charkha-crank-arm', new THREE.BoxGeometry(.50, .07, .07), iron, [.25, 0, .30], wheel)
  const crank = add('charkha-crank', new THREE.CylinderGeometry(.078, .09, .28, 24).rotateX(Math.PI / 2), darkWood, [.46, 0, .465], wheel)

  const spindle = new THREE.Group(); spindle.name = 'charkha-spindle'; spindle.position.set(-.90, .65, 0); subject.add(spindle)
  add('charkha-shaft', new THREE.CylinderGeometry(.013, .028, 1.34, 20).rotateX(Math.PI / 2), iron, [0, 0, .39], spindle)
  add('charkha-whorl', new THREE.CylinderGeometry(.12, .12, .065, 32).rotateX(Math.PI / 2), darkWood, [0, 0, 0], spindle)
  add('charkha-whorl-inlay', new THREE.BoxGeometry(.028, .14, .006), wood, [.055, 0, .036], spindle)
  add('charkha-cop-stop', new THREE.CylinderGeometry(.16, .16, .018, 32).rotateX(Math.PI / 2), iron, [0, 0, .29], spindle)

  // Baseline outer cop envelope preserved strictly; subdivided with subtle inward wound-course ribbing.
  const copProfile: [number, number][] = [[0, .30], [.14, .30], [.14, .38], [.10, .59], [.035, .81], [0, .83]]
  const copRadius = (z: number) => {
    const hi = copProfile.findIndex(([, height]) => height >= z)
    if (hi <= 0) return copProfile[0]![0]
    const [r0, z0] = copProfile[hi - 1]!
    const [r1, z1] = copProfile[hi]!
    return THREE.MathUtils.lerp(r0, r1, (z - z0) / (z1 - z0))
  }
  const copLathePoints: THREE.Vector2[] = [new THREE.Vector2(0, .30), new THREE.Vector2(.14, .30)]
  const copRings = 44
  for (let i = 1; i <= copRings; i++) {
    const u = i / copRings
    const z = THREE.MathUtils.lerp(.30, .81, u)
    const baseR = copRadius(z)
    // Strictly inward micro-course indentation so exterior winding always clears actual cop vertices.
    const rib = 0.0014 * (0.5 - 0.5 * Math.cos(u * Math.PI * 34)) * Math.sin(u * Math.PI)
    copLathePoints.push(new THREE.Vector2(Math.max(.004, baseR - rib), z))
  }
  copLathePoints.push(new THREE.Vector2(0, .83))
  const cop = add('charkha-cop', new THREE.LatheGeometry(copLathePoints, 48).rotateX(Math.PI / 2), copMat, [0, 0, 0], spindle)

  // Open belt: common outer tangents and two pulley contact arcs, upgraded to seamless 2-ply twisted cord.
  const large = new THREE.Vector2(.60, 1.12), small = new THREE.Vector2(-.90, .65), R = .76, r = .76 / 6
  const d = large.distanceTo(small), phi = Math.atan2(small.y - large.y, small.x - large.x), alpha = Math.acos((R - r) / d)
  const a = phi + alpha, b = phi - alpha
  const beltPoints: THREE.Vector3[] = []
  for (let i = 0; i <= 64; i++) {
    const t = a + (b + Math.PI * 2 - a) * i / 64
    beltPoints.push(new THREE.Vector3(large.x + R * Math.cos(t), large.y + R * Math.sin(t), 0))
  }
  for (let i = 0; i <= 32; i++) {
    const t = b + (a - b) * i / 32
    beltPoints.push(new THREE.Vector3(small.x + r * Math.cos(t), small.y + r * Math.sin(t), 0))
  }
  const beltCurve = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < beltPoints.length; i++) {
    beltCurve.add(new THREE.LineCurve3(beltPoints[i]!, beltPoints[(i + 1) % beltPoints.length]!))
  }
  const beltGeo = createTwistedDriveBeltGeometry(beltCurve, 288, 10, .0128, .09, 48)
  const belt = add('charkha-drive-belt', beltGeo, cordMat, [0, 0, 0])
  belt.userData.toonSurface = { outline: false }
  const splice = add('charkha-belt-splice', createWhippedSpliceGeometry(), spliceMat, [0, 0, 0])
  splice.userData.toonSurface = { outline: false }

  // Cloth rest pad strictly untouched (per "No display mats").
  add('charkha-cloth', new THREE.BoxGeometry(.78, .035, .62), clothMat, [-1.50, -.0125, .78])
  for (let i = 0; i < 3; i++) add('charkha-cloth-hem-' + i, new THREE.BoxGeometry(.012, .002, .55), hemMat, [-1.80 + i * .025, .006, .78])

  // Carded cotton sliver (puni) with exact baseline outer AABB and combed fiber texture.
  const cotton = add('charkha-cotton', createCardedCottonSliverGeometry(), cottonMat, [-1.50, .125, .78])
  cotton.scale.set(.23, .12, .16)

  // Pre-allocated dynamic fiber/yarn meshes (all updated in-place in pose(), zero GPU reallocations).
  const DRAFT_SEGS = 24
  const DRAFT_RADIAL = 12
  const draftConeGeo = allocateCappedTubeGeometry(DRAFT_SEGS, DRAFT_RADIAL, 1.5, true)
  const draftCone = add('charkha-drafting-cone', draftConeGeo, draftingMat, [0, 0, 0])
  draftCone.userData.toonSurface = { outline: false }

  const YARN_SEGS = 220
  const YARN_RADIAL = 10
  const yarnGeos = [0, 1].map((i) => {
    const g = allocateCappedTubeGeometry(YARN_SEGS, YARN_RADIAL, 18, true)
    const mesh = add('charkha-drawn-yarn-' + i, g, i ? yarnLightMat : yarnMidMat, [0, 0, 0])
    mesh.userData.toonSurface = { outline: false }
    return g
  })

  const WIND_SEGS = 480
  const WIND_RADIAL = 8
  const windingGeo = allocateCappedTubeGeometry(WIND_SEGS, WIND_RADIAL, 42, true)
  const windingMesh = add('charkha-winding', windingGeo, windingMat, [0, 0, 0], spindle)
  windingMesh.userData.toonSurface = { outline: false }

  const TIP_SEGS = 84
  const TIP_RADIAL = 7
  const tipWrapGeo = allocateCappedTubeGeometry(TIP_SEGS, TIP_RADIAL, 8, true)
  const tipWrapMesh = add('charkha-tip-wrap', tipWrapGeo, yarnLightMat, [0, 0, 0], spindle)
  tipWrapMesh.userData.toonSurface = { outline: false }

  const start = new THREE.Vector3(-1.50, .125, .78)
  const drawn = new THREE.Vector3(-1.96, .53, 1.14)
  const returned = new THREE.Vector3(-1.46, .39, .54)

  const shaftRadiusAt = (z: number) => {
    const u = THREE.MathUtils.clamp((z - (-0.28)) / 1.34, 0, 1)
    return THREE.MathUtils.lerp(.028, .013, u)
  }

  function pose(step: number, amount: number) {
    const n = THREE.MathUtils.clamp(amount, 0, 1)
    const draw = step > 0 ? 1 : n
    const twist = step > 1 ? 1 : step === 1 ? n : 0
    const guide = step > 2 ? 1 : step === 2 ? Math.min(1, n / .3) : 0
    const wind = step > 2 ? 1 : step === 2 ? Math.max(0, (n - .3) / .7) : 0

    wheel.rotation.z = draw * Math.PI * .4 + twist * Math.PI * 2 + wind * Math.PI * 1.4
    spindle.rotation.z = wheel.rotation.z * 6
    cotton.position.lerpVectors(start, drawn, draw).lerp(returned, guide)
    const cottonScale = 1 - wind * .18
    cotton.scale.set(.23 * cottonScale, .12 * cottonScale, .16 * cottonScale)
    cop.scale.set(.2 + .8 * wind, .2 + .8 * wind, 1)

    // Move and tangent-orient the whipped drive-belt splice cleanly along the closed belt path.
    const beltU = (((wheel.rotation.z * R / beltCurve.getLength()) % 1) + 1) % 1
    beltCurve.getPointAt(beltU, splice.position)
    beltCurve.getTangentAt(beltU, _beltTan).normalize()
    splice.quaternion.setFromUnitVectors(_refY, _beltTan)

    // Spindle-side yarn feed anchor: starts right on the iron spindle tip during drafting/twisting,
    // then backs down cleanly onto the outer tangent of the growing cop belly during winding.
    const fromZ = THREE.MathUtils.lerp(1.052, .62, guide)
    const copOuterAtFrom = copRadius(.62) * cop.scale.x + .011
    const fromX = -.90 - copOuterAtFrom * guide
    _from.set(fromX, .65, fromZ)

    // Cotton-side drafting root seated inside the front-right edge of the carded cotton sliver.
    _to.copy(cotton.position).add(new THREE.Vector3(.15 * cottonScale, .022 * cottonScale, -.008 * cottonScale))
    _dir.subVectors(_to, _from).normalize()
    _sideA.crossVectors(_dir, _refY).normalize()
    _sideB.crossVectors(_dir, _sideA).normalize()

    const sag = THREE.MathUtils.lerp(.046, .026, twist) * (1 - 0.35 * guide)
    const strandBaseR = THREE.MathUtils.lerp(.0090, .0076, twist)
    // Cohesive 2-ply Z-twist: helix center offset = 0.68 * strandBaseR so the two plies interlock tightly with zero daylight gap.
    const turns = 4.0 + twist * 7.5
    const spinPhase = -spindle.rotation.z * 0.25

    for (let plyIdx = 0; plyIdx < 2; plyIdx++) {
      writeBishopCappedTube(
        yarnGeos[plyIdx]!,
        YARN_SEGS,
        YARN_RADIAL,
        (t, out) => {
          out.lerpVectors(_from, _to, t)
          out.y -= sag * Math.sin(Math.PI * t)
          // Slight fiber swell where yarn merges into the cotton drafting cone near t -> 1.
          const draftEase = THREE.MathUtils.smoothstep(t, .78, 1)
          const rStrand = strandBaseR * (1 + .16 * draftEase)
          const helixOffset = rStrand * .68 * (1 - .25 * draftEase)
          const phase = t * turns * Math.PI * 2 + spinPhase + plyIdx * Math.PI
          out.addScaledVector(_sideA, helixOffset * Math.cos(phase))
          out.addScaledVector(_sideB, helixOffset * Math.sin(phase))
        },
        (t, theta) => {
          const draftEase = THREE.MathUtils.smoothstep(t, .78, 1)
          const slub = 1 + .05 * Math.sin(t * 27 + plyIdx * 2.1 + theta)
          return strandBaseR * (1 + .16 * draftEase) * slub
        },
      )
    }

    // Tapered fluted cotton drafting cone bridging the carded sliver flush into the 2-ply spun yarn.
    const coneLen = 0.16 * cottonScale
    const spanLen = Math.max(.18, _from.distanceTo(_to))
    const tConeStart = Math.max(.52, 1 - coneLen / spanLen)
    writeBishopCappedTube(
      draftConeGeo,
      DRAFT_SEGS,
      DRAFT_RADIAL,
      (u, out) => {
        const t = THREE.MathUtils.lerp(tConeStart, 1, u)
        out.lerpVectors(_from, _to, t)
        out.y -= sag * Math.sin(Math.PI * t)
      },
      (u, theta) => {
        const baseR = THREE.MathUtils.lerp(strandBaseR * 1.05, .048 * cottonScale, Math.pow(u, 1.65))
        const flute = 1 + .14 * Math.cos(theta * 6 - u * 5.2) * Math.sin(u * Math.PI)
        return baseR * flute
      },
    )

    // Snug 2-pass cross-wound exterior thread on the cop (every vertex strictly outside cop surface).
    const windR = .0055
    const windMargin = windR + .0034
    const copScaleX = cop.scale.x
    writeBishopCappedTube(
      windingGeo,
      WIND_SEGS,
      WIND_RADIAL,
      (t, out) => {
        let z: number
        let angle: number
        let passLift = 0
        if (t <= .78) {
          const u = t / .78
          z = THREE.MathUtils.lerp(.318, .798, u)
          angle = u * Math.PI * 2 * 17.5
        } else {
          const u = (t - .78) / .22
          z = THREE.MathUtils.lerp(.798, .565, u)
          angle = Math.PI * 2 * 17.5 + u * Math.PI * 2 * 4.0
          passLift = .0024 * THREE.MathUtils.smoothstep(u, 0, .25)
        }
        const rad = copRadius(z) * copScaleX + windMargin + passLift
        out.set(rad * Math.cos(angle), rad * Math.sin(angle), z)
      },
      (t, theta) => {
        const ply = 1 + .11 * Math.cos(2 * (theta - t * Math.PI * 2 * 26))
        return windR * ply
      },
    )

    // Authentic spindle-tip backing spiral climbing from cop nose to the spinning tip during drafting/twisting,
    // then uncoiling cleanly down into a snug collar on the cop nose as guide -> 1 (zero protruding stub).
    const tipZ0 = THREE.MathUtils.lerp(.790, .766, guide)
    const tipZ1 = THREE.MathUtils.lerp(1.046, .794, guide)
    const tipTurns = THREE.MathUtils.lerp(3.2, 1.15, guide)
    const tipR = THREE.MathUtils.lerp(.0052, .0042, guide)
    writeBishopCappedTube(
      tipWrapGeo,
      TIP_SEGS,
      TIP_RADIAL,
      (u, out) => {
        const z = THREE.MathUtils.lerp(tipZ0, tipZ1, u)
        const angle = u * tipTurns * Math.PI * 2
        const noseBlend = Math.exp(-u * 6.5)
        const copSurfR = copRadius(Math.min(.82, z)) * copScaleX + tipR + .0022
        const shaftSurfR = shaftRadiusAt(z) + tipR + .0016
        const rad = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(shaftSurfR, copSurfR, guide),
          Math.max(shaftSurfR, copSurfR),
          noseBlend,
        )
        out.set(rad * Math.cos(angle), rad * Math.sin(angle), z)
      },
      (u, theta) => tipR * (1 + .10 * Math.cos(2 * (theta - u * 18))),
    )
  }

  pose(0, 0)
  return { subject, pose, targets: [cotton, crank, cotton], anchors: [[0, .5, .4], [0, 0, .13], [0, .5, .4]] as XYZ[] }
}
