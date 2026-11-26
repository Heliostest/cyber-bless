import * as THREE from 'three'

export interface WoodKnot {
  /** Normalized coordinate along the grain (0..1). */
  u: number
  /** Normalized coordinate across the grain (0..1). */
  v: number
  /** Half-width along the grain in texture u-units. */
  radius: number
  /** Elongation ratio along grain vs across grain (typically 1.9..2.5). */
  elongation?: number
  /** How strongly surrounding grain deflects around the knot (0.55..0.90). */
  deflect?: number
  /** Darkness multiplier for the warm amber knot core (0.35..1.0). */
  depth?: number
  /** Number of soft concentric rings inside the knot eye. */
  rings?: number
}

export interface WoodTextureSpec {
  id: string
  /** Physical ratio spanU / spanV so knots and arches stay naturally proportioned. */
  aspect?: number
  /** Ring density across the board width. */
  ringFreq: number
  /** Cathedral arch slope along grain (0 = gentle quarter-sawn flow, 0.35..0.65 = sweeping arches). */
  archSlope?: number
  /** Transverse offset of the log's pith center in v-units. */
  pithV?: number
  /** Longitudinal offset of the cathedral crest in u-units. */
  pithU?: number
  /** Offset from the log center plane (controls arch curvature). */
  pithDepth?: number
  /** Overall gentle organic meander amplitude. */
  flowAmp?: number
  /** Latewood darkening depth (0.08..0.24). */
  contrast: number
  /** Warm amber tint shift inside latewood & knots (0..1). */
  warmth?: number
  /** Subtle low-frequency tonal variation across the piece. */
  toneVariation?: number
  /** Subtle fine longitudinal fiber streak amplitude. */
  fiberStrength?: number
  /** Deterministic seed per hand-cut piece. */
  seed: number
  /** Sparse natural wood knots (木眼). */
  knots?: WoodKnot[]
  /** Texture resolution (power of two for clean mipmaps). */
  width?: number
  height?: number
}

export interface EndGrainSpec {
  id: string
  ringFreq: number
  contrast: number
  warmth?: number
  pithX?: number
  pithY?: number
  seed: number
  size?: number
}

export interface WoodTexturePair {
  map: THREE.DataTexture
  bumpMap: THREE.DataTexture
}

interface CachedPixels {
  color: Uint8Array<ArrayBuffer>
  bump: Uint8Array<ArrayBuffer>
  width: number
  height: number
}

const pixelCache = new Map<string, CachedPixels>()

function hash2(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  n = n ^ (n >>> 16)
  return (n >>> 0) / 4294967296
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const n00 = hash2(ix, iy, seed)
  const n10 = hash2(ix + 1, iy, seed)
  const n01 = hash2(ix, iy + 1, seed)
  const n11 = hash2(ix + 1, iy + 1, seed)
  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx
  return nx0 + (nx1 - nx0) * sy
}

function fbm2(x: number, y: number, seed: number): number {
  const a = valueNoise(x, y, seed)
  const b = valueNoise(x * 2.03 + 11.7, y * 2.01 + 5.3, seed + 31)
  const c = valueNoise(x * 4.07 + 23.1, y * 4.03 + 17.9, seed + 67)
  return a * 0.58 + b * 0.29 + c * 0.13
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function buildWoodPixels(spec: WoodTextureSpec): CachedPixels {
  const width = spec.width ?? 256
  const height = spec.height ?? 256
  const aspect = spec.aspect ?? 1.5
  const archSlope = spec.archSlope ?? 0.34
  const pithV = spec.pithV ?? 0.46
  const pithU = spec.pithU ?? 0.40
  const pithDepth = spec.pithDepth ?? 0.32
  const flowAmp = spec.flowAmp ?? 0.17
  const warmth = spec.warmth ?? 0.78
  const toneVar = spec.toneVariation ?? 0.055
  const fiberStr = spec.fiberStrength ?? 0.028
  const knots = spec.knots ?? []
  const seed = Math.round(spec.seed * 97)

  const color = new Uint8Array(width * height * 4)
  const bump = new Uint8Array(width * height * 4)

  for (let py = 0; py < height; py++) {
    const v = (py + 0.5) / height
    for (let px = 0; px < width; px++) {
      const u = (px + 0.5) / width

      // Smooth grain deflection around each sparse knot (monotonic outside knot core).
      let vFlow = v
      let knotCoreMax = 0
      let knotHaloMax = 0
      let knotRingShade = 0
      let knotBump = 0

      for (let k = 0; k < knots.length; k++) {
        const knot = knots[k]!
        const elong = knot.elongation ?? 2.2
        const rx = knot.radius
        const ry = rx * (aspect / elong)
        const du = (u - knot.u) / rx
        const dv = (v - knot.v) / ry
        const angle = Math.atan2(dv, du)
        const wobble = (valueNoise(Math.cos(angle) * 1.4 + k * 7.1, Math.sin(angle) * 1.4 + seed * 0.03, seed + 13) - 0.5) * 0.18
        const d2 = du * du + dv * dv
        const d = Math.sqrt(d2) + wobble * smoothstep(0.15, 0.9, Math.sqrt(d2))

        const deflect = THREE.MathUtils.clamp(knot.deflect ?? 0.82, 0.3, 0.92)
        const falloff = Math.exp(-d2 * 0.34)
        vFlow -= (v - knot.v) * deflect * falloff

        if (d < 1.55) {
          const depth = knot.depth ?? 0.85
          const core = smoothstep(1.04, 0.60, d) * depth
          const rim = Math.exp(-Math.pow((d - 0.86) / 0.14, 2)) * 0.28 * depth
          const halo = smoothstep(1.38, 0.82, d) * 0.18 * depth
          const ringPhase = d * (knot.rings ?? 3.1) * Math.PI * 2 + wobble * 2.4
          const innerRings = 0.5 + 0.5 * Math.cos(ringPhase)
          const heart = smoothstep(0.30, 0.05, d) * 0.46 * depth
          if (core > knotCoreMax) {
            knotCoreMax = core
            knotRingShade = (innerRings * 0.36 + heart) * core + rim
          } else {
            knotRingShade = Math.max(knotRingShade, rim)
          }
          if (halo > knotHaloMax) knotHaloMax = halo
          knotBump += (smoothstep(1.25, 0.84, d) * smoothstep(0.50, 0.92, d) * 0.30 - smoothstep(0.58, 0.10, d) * 0.38) * depth
        }
      }

      const slowFlow = fbm2(u * 1.35 + spec.seed * 1.3, vFlow * 2.1 + spec.seed * 0.7, seed + 5) - 0.5
      const medFlow = fbm2(u * 3.1 + spec.seed * 2.1, vFlow * 4.4 + spec.seed * 1.9, seed + 19) - 0.5
      const meander = (slowFlow * 0.74 + medFlow * 0.26) * flowAmp

      const dvPith = (vFlow - pithV) + meander
      const dzPith = pithDepth + archSlope * (u - pithU) + slowFlow * 0.18
      const radial = Math.sqrt(dvPith * dvPith + dzPith * dzPith)

      const ringDrift = (fbm2(u * 1.1 + spec.seed * 0.5, radial * 2.6 + spec.seed, seed + 41) - 0.5) * 0.72
      const ringCoord = radial * spec.ringFreq + ringDrift
      const frac = ((ringCoord % 1) + 1) % 1

      const latewood = Math.pow(Math.sin(Math.pow(frac, 1.65) * Math.PI), 2.75)
      const secondaryRibbon = Math.pow(Math.sin(Math.pow(((frac + 0.48) % 1), 1.40) * Math.PI), 4.0) * 0.24

      const ringMod = 0.74 + 0.50 * fbm2(u * 1.8 + spec.seed, vFlow * 2.8 + spec.seed * 1.4, seed + 53)
      const grainTone = (latewood + secondaryRibbon) * ringMod

      const boardDrift = (fbm2(u * 1.2 + spec.seed * 2.7, v * 1.4 + spec.seed * 0.4, seed + 71) - 0.5) * 2.0 * toneVar
      const fineFiber = (valueNoise(u * 7.5 + spec.seed * 3.1, vFlow * 52.0 + spec.seed, seed + 89) - 0.5) * 2.0 * fiberStr

      const grainDark = grainTone * spec.contrast
      const knotDark = (knotCoreMax * 0.22 + knotRingShade * 0.19 + knotHaloMax * 0.10) * (0.70 + spec.contrast * 2.0)
      const totalDark = Math.min(0.48, grainDark + knotDark)

      const warmShift = (grainDark * 0.65 + knotDark * 1.35) * warmth
      const base = 1.02 + boardDrift + fineFiber - totalDark
      const r = clampByte((base + warmShift * 0.085) * 255)
      const g = clampByte((base - warmShift * 0.025) * 255)
      const b = clampByte((base - warmShift * 0.145) * 255)

      const idx = (py * width + px) * 4
      color[idx] = r
      color[idx + 1] = g
      color[idx + 2] = b
      color[idx + 3] = 255

      const heightVal = 0.5 + (latewood - 0.35) * 0.28 + fineFiber * 1.6 + knotBump
      const bh = clampByte(heightVal * 255)
      bump[idx] = bh
      bump[idx + 1] = bh
      bump[idx + 2] = bh
      bump[idx + 3] = 255
    }
  }

  return { color, bump, width, height }
}

function buildEndGrainPixels(spec: EndGrainSpec): CachedPixels {
  const size = spec.size ?? 128
  const pithX = spec.pithX ?? 0.46
  const pithY = spec.pithY ?? 0.53
  const warmth = spec.warmth ?? 0.8
  const seed = Math.round(spec.seed * 101)

  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)

  for (let py = 0; py < size; py++) {
    const v = (py + 0.5) / size
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size
      const dx = u - pithX
      const dy = v - pithY
      const r = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx)
      const wobble = (fbm2(Math.cos(angle) * 1.6 + spec.seed, Math.sin(angle) * 1.6 + spec.seed * 0.6, seed + 7) - 0.5) * 0.055
      const ringCoord = (r + wobble) * spec.ringFreq
      const frac = ((ringCoord % 1) + 1) % 1
      const latewood = Math.pow(Math.sin(Math.pow(frac, 1.55) * Math.PI), 2.0)
      // Delicate medullary rays radiating softly from the pith.
      const ray = Math.pow(0.5 + 0.5 * Math.cos(angle * 19 + fbm2(u * 4, v * 4, seed + 23) * 2.2), 5.0) * 0.06
      const pithDark = smoothstep(0.08, 0.015, r) * 0.16
      const totalDark = Math.min(0.42, latewood * spec.contrast + ray + pithDark)
      const warmShift = totalDark * warmth
      const base = 1.03 - totalDark
      const idx = (py * size + px) * 4
      color[idx] = clampByte((base + warmShift * 0.08) * 255)
      color[idx + 1] = clampByte((base - warmShift * 0.025) * 255)
      color[idx + 2] = clampByte((base - warmShift * 0.13) * 255)
      color[idx + 3] = 255
      const bh = clampByte((0.5 + (latewood - 0.4) * 0.25 - pithDark * 0.6) * 255)
      bump[idx] = bh
      bump[idx + 1] = bh
      bump[idx + 2] = bh
      bump[idx + 3] = 255
    }
  }
  return { color, bump, width: size, height: size }
}

function wrapTexture(pixels: Uint8Array<ArrayBuffer>, width: number, height: number, colorSpace: THREE.ColorSpace): THREE.DataTexture {
  const tex = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.colorSpace = colorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

export function createWoodTextures(spec: WoodTextureSpec): WoodTexturePair {
  let cached = pixelCache.get(spec.id)
  if (!cached) {
    cached = buildWoodPixels(spec)
    pixelCache.set(spec.id, cached)
  }
  return {
    map: wrapTexture(cached.color, cached.width, cached.height, THREE.SRGBColorSpace),
    bumpMap: wrapTexture(cached.bump, cached.width, cached.height, THREE.NoColorSpace),
  }
}

export function createEndGrainTextures(spec: EndGrainSpec): WoodTexturePair {
  let cached = pixelCache.get(spec.id)
  if (!cached) {
    cached = buildEndGrainPixels(spec)
    pixelCache.set(spec.id, cached)
  }
  return {
    map: wrapTexture(cached.color, cached.width, cached.height, THREE.SRGBColorSpace),
    bumpMap: wrapTexture(cached.bump, cached.width, cached.height, THREE.NoColorSpace),
  }
}

/**
 * Projects continuous, seam-free 3D solid-block UVs along `axis` so wood grain
 * flows naturally across faces and beveled/turned edges without touching indices.
 */
export function projectWoodBlockUVs(
  geometry: THREE.BufferGeometry,
  axis: 'x' | 'y' | 'z',
  options: { tilt?: number; flipU?: boolean; flipV?: boolean; margin?: number } = {},
): void {
  const pos = geometry.getAttribute('position')
  if (!pos) return
  const tilt = options.tilt ?? 0.36
  const cosT = Math.cos(tilt)
  const sinT = Math.sin(tilt)
  const margin = options.margin ?? 0.03

  const us = new Float32Array(pos.count)
  const vs = new Float32Array(pos.count)
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    let u: number, v: number
    if (axis === 'x') {
      u = x
      v = z * cosT + y * sinT
    } else if (axis === 'y') {
      u = y
      v = x * cosT + z * sinT
    } else {
      u = z
      v = x * cosT + y * sinT
    }
    us[i] = u
    vs[i] = v
    if (u < minU) minU = u
    if (u > maxU) maxU = u
    if (v < minV) minV = v
    if (v > maxV) maxV = v
  }

  const spanU = Math.max(1e-5, maxU - minU)
  const spanV = Math.max(1e-5, maxV - minV)
  const uv = new Float32Array(pos.count * 2)
  const range = 1 - margin * 2
  for (let i = 0; i < pos.count; i++) {
    let nu = (us[i]! - minU) / spanU
    let nv = (vs[i]! - minV) / spanV
    if (options.flipU) nu = 1 - nu
    if (options.flipV) nv = 1 - nv
    uv[i * 2] = margin + nu * range
    uv[i * 2 + 1] = margin + nv * range
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/** Projects planar XY end-grain UVs onto Z-axis cylinders/washers facing the camera. */
export function projectEndGrainUVs(geometry: THREE.BufferGeometry, margin = 0.04): void {
  const pos = geometry.getAttribute('position')
  if (!pos) return
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const span = Math.max(1e-5, maxX - minX, maxY - minY)
  const cx = (minX + maxX) * 0.5
  const cy = (minY + maxY) * 0.5
  const uv = new Float32Array(pos.count * 2)
  const range = 1 - margin * 2
  for (let i = 0; i < pos.count; i++) {
    const nu = (pos.getX(i) - cx) / span + 0.5
    const nv = (pos.getY(i) - cy) / span + 0.5
    uv[i * 2] = margin + THREE.MathUtils.clamp(nu, 0, 1) * range
    uv[i * 2 + 1] = margin + THREE.MathUtils.clamp(nv, 0, 1) * range
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}
