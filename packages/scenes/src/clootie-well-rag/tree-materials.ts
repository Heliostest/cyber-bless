import * as THREE from 'three'

type PixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

const cachedPixels = new Map<string, PixelBuffers>()

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function seededRandom(seed: number): () => number {
  let state = (seed | 0) ^ 0x9e3779b9
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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
  repeat?: readonly [number, number],
  offset?: readonly [number, number],
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), size, size)
  tex.colorSpace = colorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  if (repeat) tex.repeat.set(repeat[0], repeat[1])
  if (offset) tex.offset.set(offset[0], offset[1])
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

/** Average normals across duplicate seam/pole vertices sharing identical 3D positions. */
function weldCoincidentNormals(geometry: THREE.BufferGeometry, precision = 1e4): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute
  const accum = new Map<string, [number, number, number]>()
  const keys = new Array<string>(pos.count)

  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * precision)},${Math.round(pos.getY(i) * precision)},${Math.round(pos.getZ(i) * precision)}`
    keys[i] = key
    const entry = accum.get(key)
    const nx = norm.getX(i), ny = norm.getY(i), nz = norm.getZ(i)
    if (entry) {
      entry[0] += nx
      entry[1] += ny
      entry[2] += nz
    } else {
      accum.set(key, [nx, ny, nz])
    }
  }

  for (let i = 0; i < pos.count; i++) {
    const entry = accum.get(keys[i]!)!
    const len = Math.hypot(entry[0], entry[1], entry[2]) || 1
    norm.setXYZ(i, entry[0] / len, entry[1] / len, entry[2] / len)
  }
  norm.needsUpdate = true
}

/** Compute signed volume of an indexed closed mesh (positive means outward FrontSide winding). */
export function computeSignedVolume(geometry: THREE.BufferGeometry): number {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const idx = geometry.getIndex()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const cross = new THREE.Vector3()
  let vol = 0
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i))
      b.fromBufferAttribute(pos, idx.getX(i + 1))
      c.fromBufferAttribute(pos, idx.getX(i + 2))
      cross.crossVectors(b, c)
      vol += a.dot(cross) / 6
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i)
      b.fromBufferAttribute(pos, i + 1)
      c.fromBufferAttribute(pos, i + 2)
      cross.crossVectors(b, c)
      vol += a.dot(cross) / 6
    }
  }
  return vol
}

function buildOldBarkPixels(variant: 'bark' | 'highlight'): PixelBuffers {
  const key = `clootie-bark-${variant}-v2`
  const existing = cachedPixels.get(key)
  if (existing) return existing

  const size = 256
  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)
  const roughness = new Uint8Array(size * size * 4)
  // Living weathered woodland bark anchored to warm umber tones (restrained contrast, never striped).
  const pal = variant === 'bark'
    ? { light: [164, 132, 104], mid: [147, 114, 89], warm: [155, 122, 94], dark: [108, 82, 62], lichen: [140, 150, 118], seed: 137 }
    : { light: [190, 162, 126], mid: [178, 148, 112], warm: [184, 154, 117], dark: [132, 104, 78], lichen: [160, 164, 132], seed: 251 }

  const tau = Math.PI * 2
  for (let y = 0; y < size; y++) {
    // Tube UVs map u along curve length and v around circumference.
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      const meander = Math.sin(u * tau * 1.0 + 0.5) * 0.032 + (periodicNoise(u * 2, v * 4, 2, 4, pal.seed + 13) - 0.5) * 0.055
      const vw = v + meander

      const r1 = Math.sin(vw * tau * 7 + 0.8)
      const r2 = Math.sin(vw * tau * 15 + 1.9)
      const breath = 0.68 + 0.44 * periodicNoise(u * 3, v * 5, 3, 5, pal.seed + 29)
      const flutes = (0.58 * r1 + 0.42 * r2) * breath
      const streaks = (periodicNoise(u * 3, vw * 16, 3, 16, pal.seed + 53) - 0.5) * 0.72
      const warmDrift = periodicNoise(u * 3, v * 2, 3, 2, pal.seed + 71)
      const lichenMask = THREE.MathUtils.smoothstep(periodicNoise(u * 4, v * 4, 4, 4, pal.seed + 97), 0.77, 0.93) * 0.18

      const signal = THREE.MathUtils.clamp(flutes * 0.52 + streaks * 0.48, -1, 1)
      const crest = Math.max(0, signal)
      const fissure = Math.pow(Math.max(0, -signal), 1.25)

      let r = THREE.MathUtils.lerp(pal.mid[0], pal.warm[0], warmDrift * 0.50)
      let g = THREE.MathUtils.lerp(pal.mid[1], pal.warm[1], warmDrift * 0.50)
      let b = THREE.MathUtils.lerp(pal.mid[2], pal.warm[2], warmDrift * 0.50)

      r = THREE.MathUtils.lerp(r, pal.light[0], crest * 0.48)
      g = THREE.MathUtils.lerp(g, pal.light[1], crest * 0.48)
      b = THREE.MathUtils.lerp(b, pal.light[2], crest * 0.46)

      r = THREE.MathUtils.lerp(r, pal.dark[0], fissure * 0.62)
      g = THREE.MathUtils.lerp(g, pal.dark[1], fissure * 0.64)
      b = THREE.MathUtils.lerp(b, pal.dark[2], fissure * 0.66)

      r = THREE.MathUtils.lerp(r, pal.lichen[0], lichenMask)
      g = THREE.MathUtils.lerp(g, pal.lichen[1], lichenMask)
      b = THREE.MathUtils.lerp(b, pal.lichen[2], lichenMask)

      const idx = (y * size + x) * 4
      color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 206)
      color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 178)
      color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 144)
      color[idx + 3] = 255

      const h = THREE.MathUtils.clamp(Math.round(128 + flutes * 42 + streaks * 26), 40, 218)
      bump[idx] = bump[idx + 1] = bump[idx + 2] = h
      bump[idx + 3] = 255

      const rv = THREE.MathUtils.clamp(Math.round(236 - crest * 16 + fissure * 16), 212, 254)
      roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = rv
      roughness[idx + 3] = 255
    }
  }

  const buffers = { color, bump, roughness, size }
  cachedPixels.set(key, buffers)
  return buffers
}

export function createOldTreeBarkMaterials(): {
  bark: THREE.MeshStandardMaterial
  barkHighlight: THREE.MeshStandardMaterial
} {
  const make = (variant: 'bark' | 'highlight', repeat: readonly [number, number], bumpScale: number) => {
    const pixels = buildOldBarkPixels(variant)
    const map = makeTexture(pixels.color, pixels.size, THREE.SRGBColorSpace, repeat)
    const bump = makeTexture(pixels.bump, pixels.size, THREE.NoColorSpace, repeat)
    const rough = makeTexture(pixels.roughness, pixels.size, THREE.NoColorSpace, repeat)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap: bump,
      bumpScale,
      roughnessMap: rough,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.30,
      vertexColors: true,
    })
    bindTextureDisposal(mat, [map, bump, rough])
    return mat
  }
  return {
    bark: make('bark', [3.0, 1.35], 0.0082),
    barkHighlight: make('highlight', [1.8, 1.0], 0.0064),
  }
}

/** Strictly additive vertex shading on old-tree bark tubes (root earth contact & crown canopy shadow). */
export function applyOldTreeBarkShading(geometry: THREE.BufferGeometry): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const ny = norm ? norm.getY(i) : 0
    // Warm earth-moss deepening near ground roots (y < 0.36) and soft canopy shade near crown throat (y > 1.72).
    const rootShade = (1 - THREE.MathUtils.smoothstep(y, 0.02, 0.36)) * 0.22
    const crownShade = THREE.MathUtils.smoothstep(y, 1.76, 2.34) * 0.18
    const underBranch = Math.max(0, -ny) * 0.12
    const shade = THREE.MathUtils.clamp(rootShade + crownShade + underBranch, 0, 0.38)
    // Slight mossy green earth-bounce tint right at ground contact.
    const earthMoss = (1 - THREE.MathUtils.smoothstep(y, 0.01, 0.20)) * 0.045
    colors[i * 3] = THREE.MathUtils.clamp(1.01 - shade * 0.85 - earthMoss * 0.6, 0.68, 1.03)
    colors[i * 3 + 1] = THREE.MathUtils.clamp(1.00 - shade * 0.88 + earthMoss * 0.35, 0.68, 1.03)
    colors[i * 3 + 2] = THREE.MathUtils.clamp(0.98 - shade * 1.02 - earthMoss * 0.5, 0.60, 1.00)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

export interface TaperedBranchOptions {
  tubularSegments?: number
  radialSegments?: number
  /** Gentle organic buttress fluting near `t = 0` (0..1, useful for main trunk base). */
  rootFlute?: number
  /** Subtle organic cross-section undulation (default 0.032). */
  barkIrregularity?: number
  /** Clamp vertex Y above ground so roots/flares never dip below `y = 0`. Default 0.004. */
  minY?: number
  /** Add a smoothly rounded watertight tip cap at `t = 1`. Default true. */
  roundTip?: boolean
  /** Deterministic phase offset for cross-section variation. */
  seed?: number
}

/**
 * Watertight FrontSide tapered curved trunk/bough/twig/root geometry with continuous radius
 * profile, organic cross-section variation, optional root-flare buttressing, and rounded closed tips.
 */
export function createTaperedBranchGeometry(
  points: readonly (readonly [number, number, number])[],
  radiusAt: (t: number) => number,
  options: TaperedBranchOptions = {},
): THREE.BufferGeometry {
  const tubularSegments = options.tubularSegments ?? 24
  const radialSegments = options.radialSegments ?? 10
  const rootFlute = options.rootFlute ?? 0
  const barkIrregularity = options.barkIrregularity ?? 0.032
  const minY = options.minY ?? 0.004
  const roundTip = options.roundTip ?? true
  const seed = options.seed ?? 0

  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  )
  const frames = curve.computeFrenetFrames(tubularSegments, false)
  const cols = radialSegments + 1

  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const ringPoint = new THREE.Vector3()
  const addRing = (
    center: THREE.Vector3,
    normal: THREE.Vector3,
    binormal: THREE.Vector3,
    rBase: number,
    uCoord: number,
    fluteScale: number,
  ) => {
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments
      const angle = v * Math.PI * 2
      const flute = fluteScale > 0
        ? 1 + fluteScale * (0.12 * Math.cos(angle * 4 + 0.45 + seed) + 0.055 * Math.sin(angle * 5 - 0.7))
        : 1
      const wobble = 1 + barkIrregularity * Math.sin(angle * 3 + uCoord * 5.2 + seed)
      const r = Math.max(0.001, rBase * flute * wobble)
      const ca = Math.cos(angle)
      const sa = Math.sin(angle)
      ringPoint
        .copy(center)
        .addScaledVector(normal, ca * r)
        .addScaledVector(binormal, sa * r)
      const clampedY = Math.max(minY, ringPoint.y)
      positions.push(ringPoint.x, clampedY, ringPoint.z)
      uvs.push(uCoord, v)
    }
  }

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments
    const center = curve.getPointAt(t)
    const fluteScale = rootFlute * Math.pow(Math.max(0, 1 - t / 0.24), 1.8)
    addRing(center, frames.normals[i]!, frames.binormals[i]!, radiusAt(t), t, fluteScale)
  }

  let ringCount = tubularSegments + 1
  const tipCenter = curve.getPointAt(1)
  const tipTangent = frames.tangents[tubularSegments]!
  const tipNormal = frames.normals[tubularSegments]!
  const tipBinormal = frames.binormals[tubularSegments]!
  const tipRadius = Math.max(0.002, radiusAt(1))

  if (roundTip) {
    // One short dome shoulder ring before closing to a rounded apex pole (no flat chopped pipe end).
    const domeCenter = tipCenter.clone().addScaledVector(tipTangent, tipRadius * 0.55)
    addRing(domeCenter, tipNormal, tipBinormal, tipRadius * 0.56, 1.02, 0)
    ringCount++
  }

  // Side quads along the tube: in right-handed Frenet frame (T, N, B),
  // (∂P/∂j) × (∂P/∂i) = +radialOutward, so (a, d, b) and (b, d, c) wind outward CCW.
  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * cols + j
      const b = (i + 1) * cols + j
      const c = (i + 1) * cols + (j + 1)
      const d = i * cols + (j + 1)
      indices.push(a, d, b, b, d, c)
    }
  }

  // Start cap pole (outward normal along -T).
  const startCenter = curve.getPointAt(0)
  const startPoleIdx = positions.length / 3
  positions.push(startCenter.x, Math.max(minY, startCenter.y), startCenter.z)
  uvs.push(0, 0.5)
  for (let j = 0; j < radialSegments; j++) {
    indices.push(startPoleIdx, j + 1, j)
  }

  // End cap pole (outward normal along +T).
  const endApex = roundTip
    ? tipCenter.clone().addScaledVector(tipTangent, tipRadius * 0.92)
    : tipCenter.clone()
  const endPoleIdx = positions.length / 3
  positions.push(endApex.x, Math.max(minY, endApex.y), endApex.z)
  uvs.push(1.04, 0.5)
  const lastRingStart = (ringCount - 1) * cols
  for (let j = 0; j < radialSegments; j++) {
    indices.push(endPoleIdx, lastRingStart + j, lastRingStart + j + 1)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)

  // Guarantee outward FrontSide orientation even on degenerate/sharp curves.
  if (computeSignedVolume(geometry) < 0) {
    const idx = geometry.getIndex()!
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1)
      const c = idx.getX(i + 2)
      idx.setX(i + 1, c)
      idx.setX(i + 2, b)
    }
    idx.needsUpdate = true
  }

  geometry.computeVertexNormals()
  weldCoincidentNormals(geometry)
  applyOldTreeBarkShading(geometry)
  return geometry
}

export interface CanopyClusterOptions {
  /** Cluster center in tree-group coordinates (used to compute cohesive whole-crown normals & gradients). */
  position: readonly [number, number, number]
  /** Cluster half-extents `[rx, ry, rz]` baked into geometry so mesh scale stays `(1, 1, 1)`. */
  scale: readonly [number, number, number]
  /** Deterministic seed for unique organic scalloped leaf-mass lobes. */
  seed: number
  /** Whole-crown center in tree-group coordinates for unified Komorebi canopy lighting wrap. */
  crownCenter?: readonly [number, number, number]
  /** Whole-crown vertical `[minY, maxY]` span for warm-top to cool-underside pigment ramp. */
  crownYRange?: readonly [number, number]
  /** Optional subtle warmth shift (`-0.08..+0.08`) for sunlit top vs cool underside clusters. */
  warmth?: number
  /** Number of directional leaf-tuft scallops around the cluster (default 9). */
  lobeCount?: number
}

interface ScallopLobe {
  x: number
  y: number
  z: number
  amp: number
  spread: number
}

/**
 * Watertight FrontSide scalloped stylized leaf-mass cluster geometry.
 *
 * Uses a smooth-max of directional botanical lobes so silhouettes break up into
 * pillowy overlapping leaf tufts with crisp-yet-soft inward scallops instead of
 * smooth balloons, while strongly blending vertex normals with the whole-crown dome
 * so all 16–24 clusters merge cohesively under Komorebi wrapped lighting.
 */
export function createCanopyClusterGeometry(options?: CanopyClusterOptions): THREE.BufferGeometry {
  const posWorld = options?.position ?? [0.76, 2.30, -0.22]
  const scale = options?.scale ?? [1, 1, 1]
  const seed = options?.seed ?? 17
  const crownCenter = options?.crownCenter ?? [0.76, 2.22, -0.22]
  const crownYRange = options?.crownYRange ?? [1.92, 2.72]
  const warmth = options?.warmth ?? 0
  const lobeCount = options?.lobeCount ?? 9

  const rand = seededRandom(seed * 97 + 31)
  const lobes: ScallopLobe[] = []

  // Equatorial + outer perimeter scallops (distinct overlapping leaf-tuft breakup along silhouettes).
  const eqCount = Math.max(5, lobeCount - 3)
  const baseAngle = rand() * Math.PI * 2
  for (let k = 0; k < eqCount; k++) {
    const theta = baseAngle + (k / eqCount) * Math.PI * 2 + (rand() - 0.5) * 0.44
    const elev = -0.15 + rand() * 0.54
    const ce = Math.cos(elev)
    lobes.push({
      x: Math.cos(theta) * ce,
      y: Math.sin(elev),
      z: Math.sin(theta) * ce,
      amp: 0.30 + rand() * 0.09,
      spread: 0.20 + rand() * 0.08,
    })
  }
  // Upper crown cushion lobes.
  const topCount = Math.max(2, lobeCount - eqCount - 1)
  for (let k = 0; k < topCount; k++) {
    const theta = baseAngle + 0.55 + (k / topCount) * Math.PI * 2 + (rand() - 0.5) * 0.5
    const elev = 0.72 + rand() * 0.42
    const ce = Math.cos(elev)
    lobes.push({
      x: Math.cos(theta) * ce,
      y: Math.sin(elev),
      z: Math.sin(theta) * ce,
      amp: 0.28 + rand() * 0.07,
      spread: 0.24 + rand() * 0.08,
    })
  }
  // Soft terraced underside lobe so bough pads sit naturally over twigs.
  lobes.push({
    x: (rand() - 0.5) * 0.35,
    y: -0.92,
    z: (rand() - 0.5) * 0.35,
    amp: 0.14,
    spread: 0.42,
  })
  for (const lobe of lobes) {
    const l = Math.hypot(lobe.x, lobe.y, lobe.z) || 1
    lobe.x /= l
    lobe.y /= l
    lobe.z /= l
  }

  const geo = new THREE.SphereGeometry(1, 22, 16)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const reliefs = new Float32Array(pos.count)
  const phaseA = seed * 0.73
  const phaseB = seed * 1.19
  const beta = 15.0

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i)
    const vy = pos.getY(i)
    const vz = pos.getZ(i)
    const len = Math.hypot(vx, vy, vz) || 1
    const nx = vx / len
    const ny = vy / len
    const nz = vz / len

    // Smooth-max across directional leaf-tuft lobes (convex puffs + crisp-soft inward scallops).
    let maxVal = -Infinity
    const vals: number[] = []
    for (let k = 0; k < lobes.length; k++) {
      const lobe = lobes[k]!
      const dot = THREE.MathUtils.clamp(nx * lobe.x + ny * lobe.y + nz * lobe.z, -1, 1)
      const val = lobe.amp * Math.exp(-(1 - dot) / lobe.spread)
      vals.push(val)
      if (val > maxVal) maxVal = val
    }
    let expSum = 0
    for (let k = 0; k < vals.length; k++) {
      expSum += Math.exp(beta * (vals[k]! - maxVal))
    }
    const smax = maxVal + Math.log(expSum) / beta

    // Secondary 3D leaf-edge ruffle (purely direction-based -> zero pole pinch or UV seam crack).
    const ruffle = 0.042 * Math.sin(nx * 6.2 + nz * 5.2 + phaseA) * Math.cos(ny * 4.6 - nx * 2.5 + phaseB)
    // Gently terrace underside like horizontal woodland boughs rather than round spheres.
    const bottomFlatten = ny < -0.15
      ? 1 - 0.16 * Math.pow((-ny - 0.15) / 0.85, 1.3)
      : 1
    const r = THREE.MathUtils.clamp((0.60 + smax + ruffle) * bottomFlatten, 0.56, 0.992)
    reliefs[i] = THREE.MathUtils.clamp((r - 0.62) / 0.36, 0, 1)

    pos.setXYZ(i, nx * r * scale[0], ny * r * scale[1], nz * r * scale[2])
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  weldCoincidentNormals(geo)

  const norm = geo.getAttribute('normal') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const localN = new THREE.Vector3()
  const crownN = new THREE.Vector3()
  // Key light direction (warm top-left front: [-2.8, 4.5, 3.5]).
  const sunDir = new THREE.Vector3(-2.8, 4.5, 3.5).normalize()
  const dirFromCrown = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i)
    const ly = pos.getY(i)
    const lz = pos.getZ(i)
    const wx = posWorld[0] + lx
    const wy = posWorld[1] + ly
    const wz = posWorld[2] + lz

    // Strong whole-crown outward dome normal blend (74% crown dome + 26% local scallop) so overlapping
    // clusters merge into one sunlit painterly Komorebi canopy without dark seam halos around each ball.
    crownN.set(
      (wx - crownCenter[0]) * 0.86,
      (wy - crownCenter[1]) * 1.24 + 0.30,
      (wz - crownCenter[2]) * 1.05,
    ).normalize()
    localN.fromBufferAttribute(norm, i)
    localN.lerp(crownN, 0.74).normalize()
    norm.setXYZ(i, localN.x, localN.y, localN.z)

    // Crown-space warm-sunlit-top to cool-woodland-underside pigment ramp + soft inner-crown AO.
    const crownH = THREE.MathUtils.clamp((wy - crownYRange[0]) / Math.max(0.1, crownYRange[1] - crownYRange[0]), 0, 1)
    dirFromCrown.set(wx - crownCenter[0], wy - crownCenter[1], wz - crownCenter[2])
    const radialDist = dirFromCrown.length()
    if (radialDist > 1e-4) dirFromCrown.divideScalar(radialDist)
    const sunDot = THREE.MathUtils.clamp(dirFromCrown.dot(sunDir) * 0.5 + 0.5, 0, 1)
    const outerAir = THREE.MathUtils.smoothstep(radialDist, 0.14, 0.56)
    const relief = reliefs[i]!
    const localTop = THREE.MathUtils.clamp(ly / Math.max(0.05, scale[1]) * 0.5 + 0.5, 0, 1)

    // Drive tonal massing primarily in whole-crown space so front clusters stay luminous and unified.
    const lightFactor = THREE.MathUtils.clamp(
      crownH * 0.54 + sunDot * 0.26 + outerAir * 0.15 + localTop * 0.05 + warmth,
      0,
      1,
    )
    const pocketAO = THREE.MathUtils.lerp(0.92, 1.03, relief)
    const innerAO = THREE.MathUtils.lerp(0.84, 1.03, outerAir)
    const ao = pocketAO * innerAO

    // Warm sunlit olive-gold crest -> balanced woodland olive -> airy cool sage underside.
    const r = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.76, 1.13, Math.pow(lightFactor, 0.86)) * ao, 0.64, 1.15)
    const g = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.86, 1.10, Math.pow(lightFactor, 0.82)) * ao, 0.70, 1.13)
    const b = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.86, 0.85, Math.pow(lightFactor, 1.08)) * ao, 0.66, 0.96)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }
  norm.needsUpdate = true
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

type CanopyVariant = 'olive' | 'sage' | 'warmCrest'

function buildCanopyPixels(variant: CanopyVariant): PixelBuffers {
  const key = `clootie-canopy-${variant}-v3`
  const existing = cachedPixels.get(key)
  if (existing) return existing

  const size = 256
  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)
  const roughness = new Uint8Array(size * size * 4)

  // Warm Komorebi woodland olive / sage palette (sunlit golden-olive crests -> airy cool sage shade).
  const pal = variant === 'olive'
    ? { sun: [158, 180, 100], mid: [116, 146, 86], shade: [72, 106, 76], seed: 307 }
    : variant === 'sage'
      ? { sun: [144, 170, 106], mid: [104, 138, 92], shade: [66, 100, 82], seed: 431 }
      : { sun: [176, 192, 102], mid: [132, 160, 88], shade: [88, 118, 78], seed: 547 }

  // Soft gouache underpainting base.
  const heightField = new Float32Array(size * size)
  const toneField = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      const macro = periodicNoise(u * 4, v * 4, 4, 4, pal.seed + 11)
      const mid = periodicNoise(u * 8, v * 8, 8, 8, pal.seed + 37)
      const idx = y * size + x
      toneField[idx] = THREE.MathUtils.clamp(macro * 0.54 + mid * 0.46, 0, 1)
      heightField[idx] = 0.46 + (mid - 0.5) * 0.22
    }
  }

  // Stamp layered stylized gouache leaf-tuft strokes (crisper, cohesive brushwork, zero noisy photorealism).
  const rand = seededRandom(pal.seed * 29 + 13)
  const dabCount = 340
  for (let d = 0; d < dabCount; d++) {
    const cx = rand() * size
    const cy = rand() * size
    const rx = 5.5 + rand() * 6.5
    const ry = 3.0 + rand() * 3.8
    const angle = (rand() - 0.5) * Math.PI * 0.75
    const ca = Math.cos(angle)
    const sa = Math.sin(angle)
    const layerT = d / dabCount
    const dabTone = THREE.MathUtils.clamp(0.22 + layerT * 0.66 + (rand() - 0.5) * 0.16, 0.10, 0.94)
    const dabHeight = 0.30 + layerT * 0.50
    const maxR = Math.ceil(Math.max(rx, ry)) + 1

    for (let dy = -maxR; dy <= maxR; dy++) {
      const py = ((Math.round(cy) + dy) % size + size) % size
      for (let dx = -maxR; dx <= maxR; dx++) {
        const lx = dx * ca + dy * sa
        const ly = -dx * sa + dy * ca
        const nx = lx / rx
        const ny = ly / (ry * (1 - 0.22 * Math.min(1, Math.abs(nx))))
        const distSq = nx * nx + ny * ny
        if (distSq >= 1) continue
        const alpha = Math.pow(1 - distSq, 0.68) * 0.52
        const px = ((Math.round(cx) + dx) % size + size) % size
        const pIdx = py * size + px
        toneField[pIdx] = THREE.MathUtils.lerp(toneField[pIdx]!, dabTone, alpha)
        heightField[pIdx] = THREE.MathUtils.lerp(heightField[pIdx]!, dabHeight * (1 - distSq * 0.3), alpha * 0.68)
      }
    }
  }

  for (let i = 0; i < size * size; i++) {
    const patch = toneField[i]!
    const sunMix = THREE.MathUtils.smoothstep(patch, 0.48, 0.88)
    const shadeMix = (1 - THREE.MathUtils.smoothstep(patch, 0.16, 0.54)) * 0.72

    let r = THREE.MathUtils.lerp(pal.mid[0], pal.sun[0], sunMix)
    let g = THREE.MathUtils.lerp(pal.mid[1], pal.sun[1], sunMix)
    let b = THREE.MathUtils.lerp(pal.mid[2], pal.sun[2], sunMix)

    r = THREE.MathUtils.lerp(r, pal.shade[0], shadeMix)
    g = THREE.MathUtils.lerp(g, pal.shade[1], shadeMix)
    b = THREE.MathUtils.lerp(b, pal.shade[2], shadeMix)

    const idx = i * 4
    color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 210)
    color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 216)
    color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 156)
    color[idx + 3] = 255

    const h = THREE.MathUtils.clamp(Math.round(76 + heightField[i]! * 124), 52, 206)
    bump[idx] = bump[idx + 1] = bump[idx + 2] = h
    bump[idx + 3] = 255

    const rv = THREE.MathUtils.clamp(Math.round(234 - sunMix * 16 + shadeMix * 16), 210, 252)
    roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = rv
    roughness[idx + 3] = 255
  }

  const buffers = { color, bump, roughness, size }
  cachedPixels.set(key, buffers)
  return buffers
}

export function createCanopyMaterials(): {
  olive: THREE.MeshStandardMaterial
  sage: THREE.MeshStandardMaterial
  warmCrest: THREE.MeshStandardMaterial
} {
  const make = (variant: CanopyVariant) => {
    const pixels = buildCanopyPixels(variant)
    const map = makeTexture(pixels.color, pixels.size, THREE.SRGBColorSpace, [1.65, 1.35])
    const bump = makeTexture(pixels.bump, pixels.size, THREE.NoColorSpace, [1.65, 1.35])
    const rough = makeTexture(pixels.roughness, pixels.size, THREE.NoColorSpace, [1.65, 1.35])
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap: bump,
      bumpScale: 0.0044,
      roughnessMap: rough,
      roughness: 0.91,
      metalness: 0,
      envMapIntensity: 0.25,
      vertexColors: true,
    })
    // Trigger shared tree-foliage wrapped diffuse in toon-soft for soft Komorebi canopy light.
    mat.userData.treeClusterNormals = true
    mat.userData.komorebiPigment = true
    bindTextureDisposal(mat, [map, bump, rough])
    return mat
  }
  return {
    olive: make('olive'),
    sage: make('sage'),
    warmCrest: make('warmCrest'),
  }
}

export interface MossCushionOptions {
  /** Cushion extents `[rx, height, rz]` baked into geometry with base resting flush at `y = 0`. */
  scale?: readonly [number, number, number]
  /** Deterministic seed for irregular multi-mound moss silhouette. */
  seed?: number
}

/**
 * Watertight irregular multi-mound moss cushion grounded flush at `y = 0`
 * (replaces flattened macaron spheres at the root flare).
 */
export function createMossClusterGeometry(options?: MossCushionOptions): THREE.BufferGeometry {
  const scale = options?.scale ?? [0.11, 0.048, 0.085]
  const seed = options?.seed ?? 11
  const rand = seededRandom(seed * 53 + 19)

  // 4 overlapping irregular mound centers so plan-view footprint is clover/kidney-shaped, never circular.
  const mounds = Array.from({ length: 4 }, (_, k) => {
    const ang = (k / 4) * Math.PI * 2 + rand() * 0.9
    const dist = k === 0 ? 0.14 : 0.42 + rand() * 0.26
    return {
      x: Math.cos(ang) * dist,
      z: Math.sin(ang) * dist,
      h: k === 0 ? 0.98 : 0.62 + rand() * 0.34,
      w: 0.36 + rand() * 0.18,
    }
  })

  const geo = new THREE.SphereGeometry(1, 18, 12)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const phase = seed * 0.87

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i)
    const vy = pos.getY(i)
    const vz = pos.getZ(i)
    const len = Math.hypot(vx, vy, vz) || 1
    const nx = vx / len
    const ny = vy / len
    const nz = vz / len

    // Plan-view irregular edge contour.
    const radial = Math.hypot(nx, nz)
    const planWobble = 0.78
      + 0.14 * Math.sin(nx * 3.4 - nz * 2.8 + phase)
      + 0.08 * Math.cos(nz * 4.7 + nx * 3.1 - phase)
    const px = nx * planWobble
    const pz = nz * planWobble

    // Grounded cushion profile: bottom sits cleanly flat near y = 0; top rises into overlapping velvety hummocks.
    let yLocal: number
    if (ny <= 0) {
      yLocal = (1 + ny) * 0.045
    } else {
      let moundSum = 0
      for (const m of mounds) {
        const d2 = (px - m.x) * (px - m.x) + (pz - m.z) * (pz - m.z)
        moundSum = Math.max(moundSum, m.h * Math.exp(-d2 / m.w))
      }
      const tuft = 0.07 * Math.sin(nx * 6.2 + nz * 5.4 + phase) * (1 - radial * 0.35)
      const dome = Math.pow(ny, 0.72)
      yLocal = THREE.MathUtils.clamp(0.045 + dome * (0.42 + 0.56 * moundSum + tuft), 0.045, 1.0)
    }

    pos.setXYZ(i, px * scale[0], yLocal * scale[1], pz * scale[2])
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  weldCoincidentNormals(geo)

  const norm = geo.getAttribute('normal') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const nVec = new THREE.Vector3()
  const upBias = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < pos.count; i++) {
    const h = THREE.MathUtils.clamp(pos.getY(i) / Math.max(0.01, scale[1]), 0, 1)
    nVec.fromBufferAttribute(norm, i)
    if (h > 0.08) {
      nVec.lerp(upBias, 0.25).normalize()
      norm.setXYZ(i, nVec.x, nVec.y, nVec.z)
    }
    // Deep woodland earth shadow at root-ground seam -> warm sunlit olive-moss velvet crest.
    colors[i * 3] = THREE.MathUtils.lerp(0.66, 1.08, Math.pow(h, 0.78))
    colors[i * 3 + 1] = THREE.MathUtils.lerp(0.74, 1.08, Math.pow(h, 0.74))
    colors[i * 3 + 2] = THREE.MathUtils.lerp(0.62, 0.86, Math.pow(h, 0.95))
  }
  norm.needsUpdate = true
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

/** Velvety stylized moss pile material with soft matte wrap lighting. */
export function createMossMaterial(): THREE.MeshStandardMaterial {
  const key = 'clootie-moss-pile-v2'
  let cached = cachedPixels.get(key)
  if (!cached) {
    const size = 128
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    // Richer Komorebi woodland olive-moss tones anchored to the meadow & weathered bark.
    const sun = [154, 174, 96] as const
    const mid = [114, 142, 82] as const
    const deep = [68, 94, 58] as const

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const clump = periodicNoise(u * 6, v * 6, 6, 6, 601)
        const pile = periodicNoise(u * 18, v * 18, 18, 18, 631)
        const mixVal = THREE.MathUtils.clamp(clump * 0.58 + pile * 0.42, 0, 1)
        const hi = THREE.MathUtils.smoothstep(mixVal, 0.50, 0.88)
        const lo = (1 - THREE.MathUtils.smoothstep(mixVal, 0.16, 0.52)) * 0.82

        let r = THREE.MathUtils.lerp(mid[0], sun[0], hi)
        let g = THREE.MathUtils.lerp(mid[1], sun[1], hi)
        let b = THREE.MathUtils.lerp(mid[2], sun[2], hi)
        r = THREE.MathUtils.lerp(r, deep[0], lo)
        g = THREE.MathUtils.lerp(g, deep[1], lo)
        b = THREE.MathUtils.lerp(b, deep[2], lo)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 192)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 200)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 126)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(128 + (pile - 0.5) * 56 + (clump - 0.5) * 28), 58, 204)
        bump[idx] = bump[idx + 1] = bump[idx + 2] = h
        bump[idx + 3] = 255
        roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = 244
        roughness[idx + 3] = 255
      }
    }
    cached = { color, bump, roughness, size }
    cachedPixels.set(key, cached)
  }

  const map = makeTexture(cached.color, cached.size, THREE.SRGBColorSpace, [2, 2])
  const bump = makeTexture(cached.bump, cached.size, THREE.NoColorSpace, [2, 2])
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    bumpMap: bump,
    bumpScale: 0.0055,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.24,
    vertexColors: true,
  })
  mat.userData.treeClusterNormals = true
  mat.userData.komorebiPigment = true
  bindTextureDisposal(mat, [map, bump])
  return mat
}
