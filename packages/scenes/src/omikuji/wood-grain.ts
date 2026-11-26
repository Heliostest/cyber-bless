import * as THREE from 'three'

export type WoodKnot = {
  /** Center along the grain axis in [0, 1). */
  u: number
  /** Center across the grain axis in [0, 1). */
  v: number
  /** Semi-axis along the grain (elongated almond length). */
  rx: number
  /** Semi-axis across the grain (eye height). */
  ry: number
  /** Streamline deflection strength in [0.45, 0.84] (strictly < 1 for smooth flow). */
  pull?: number
  /** Tonal depth of the knot core/rings in [0, 1]. */
  depth?: number
}

export type WoodGrainOptions = {
  seed: number
  width?: number
  height?: number
  /** Ring count across one V tile. */
  rings?: number
  /** Slow organic drift amplitude across the grain. */
  drift?: number
  /** Cathedral arch amplitude along the plank. */
  arch?: number
  /** Cathedral arch frequency along U (integer for seamless wrap). */
  archFreq?: number
  /** Warm latewood line contrast in [0, 1]. */
  contrast?: number
  /** Broad painterly earlywood/heartwood warmth variation. */
  wash?: number
  /** Sparse stylized wood eyes (木眼) that deflect surrounding streamlines. */
  knots?: readonly WoodKnot[]
  /** Optional subtle lacquer sheen softens grain & knots when painted over wood. */
  lacquer?: boolean
}

const pixelCache = new Map<string, Uint8Array<ArrayBuffer>>()

function hash2(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)
  n = (n ^ (n >>> 13)) | 0
  n = Math.imul(n, 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

/** Seamless periodic 2D value noise with cubic Hermite interpolation. */
function periodicNoise(u: number, v: number, pu: number, pv: number, seed: number): number {
  const x = ((u % 1) + 1) % 1 * pu
  const y = ((v % 1) + 1) % 1 * pv
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const x0 = ((ix % pu) + pu) % pu
  const x1 = (x0 + 1) % pu
  const y0 = ((iy % pv) + pv) % pv
  const y1 = (y0 + 1) % pv
  const a = hash2(x0, y0, seed)
  const b = hash2(x1, y0, seed)
  const c = hash2(x0, y1, seed)
  const d = hash2(x1, y1, seed)
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
}

function periodicFbm(u: number, v: number, pu: number, pv: number, seed: number): number {
  return (
    periodicNoise(u, v, pu, pv, seed) * 0.66 +
    periodicNoise(u, v, pu * 2, pv * 2, seed + 37) * 0.34
  )
}

function wrapDelta(a: number, b: number): number {
  let d = a - b
  if (d > 0.5) d -= 1
  else if (d < -0.5) d += 1
  return d
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function buildWoodPixels(opts: WoodGrainOptions): { data: Uint8Array<ArrayBuffer>; width: number; height: number } {
  const width = opts.width ?? 256
  const height = opts.height ?? 256
  const key = JSON.stringify(opts)
  const cached = pixelCache.get(key)
  if (cached) return { data: cached, width, height }

  const rings = opts.rings ?? 6.5
  const drift = opts.drift ?? 0.085
  const arch = opts.arch ?? 0.065
  const archFreq = Math.max(1, Math.round(opts.archFreq ?? 1))
  const contrast = opts.contrast ?? 0.16
  const wash = opts.wash ?? 0.045
  const knots = opts.knots ?? []
  const seed = Math.round(opts.seed * 997)
  const archPhase = (hash2(seed, 11, 7) - 0.5) * Math.PI * 2
  const archCenterV = 0.28 + hash2(seed, 29, 13) * 0.44

  const data = new Uint8Array(width * height * 4)
  for (let py = 0; py < height; py++) {
    const v = (py + 0.5) / height
    for (let px = 0; px < width; px++) {
      const u = (px + 0.5) / width

      // Smooth streamline deflection around sparse knots so grain visibly flows around each eye.
      let deflectV = 0
      let knotRing = 0
      let knotCore = 0
      let knotHalo = 0
      for (let k = 0; k < knots.length; k++) {
        const knot = knots[k]!
        const du = wrapDelta(u, knot.u)
        const dv = wrapDelta(v, knot.v)
        const wx = knot.rx * 2.25
        const wy = knot.ry * 2.35
        const gauss = Math.exp(-(du * du) / (2 * wx * wx) - (dv * dv) / (2 * wy * wy))
        const pull = THREE.MathUtils.clamp(knot.pull ?? 0.72, 0.35, 0.86)
        deflectV += dv * gauss * pull

        const wobble = (periodicNoise(u, v, 6, 6, seed + k * 71 + 19) - 0.5) * 0.14
        const d = Math.hypot(du / knot.rx, dv / knot.ry) + wobble
        const depth = knot.depth ?? 1
        if (d < 1.9) {
          const halo = Math.exp(-Math.pow((d - 1.02) / 0.44, 2)) * 0.34 * depth
          const core = (1 - smoothstep(0.16, 0.74, d)) * 0.92 * depth
          const ringWave = 0.5 + 0.5 * Math.sin(d * Math.PI * 3.1 + 0.4)
          const ring = Math.pow(ringWave, 2.2) * (1 - smoothstep(0.55, 1.38, d)) * 0.65 * depth
          knotHalo = Math.max(knotHalo, halo)
          knotCore = Math.max(knotCore, core)
          knotRing = Math.max(knotRing, ring)
        }
      }

      // Broad flowing cathedral wave + soft organic drift (low octave count keeps it stylized & warm).
      const slowDrift = (periodicFbm(u, v, 2, 3, seed + 3) - 0.5) * 2 * drift
      const midFlow = (periodicNoise(u, v, 4, 5, seed + 17) - 0.5) * 2 * (drift * 0.32)
      const dvArch = wrapDelta(v, archCenterV)
      const cathedral = Math.sin(u * Math.PI * 2 * archFreq + archPhase) * arch * Math.exp(-(dvArch * dvArch) / 0.095)

      const yFlow = v - deflectV + slowDrift + midFlow + cathedral
      const spacingMod = (periodicFbm(u, v, 3, 2, seed + 53) - 0.5) * 0.65
      const ringPhase = (yFlow * rings + spacingMod) * Math.PI * 2
      const baseWave = 0.5 + 0.5 * Math.sin(ringPhase)
      // Asymmetric latewood lines leave wide calm warm earlywood between flowing curves.
      const primaryLine = Math.pow(baseWave, 2.45)
      const secondaryWave = 0.5 + 0.5 * Math.sin(ringPhase * 2.0 + 1.15)
      const secondaryLine = Math.pow(secondaryWave, 3.6) * 0.32

      // Softly breathe line contrast across the board so areas stay calm and painterly.
      const breath = 0.62 + 0.38 * periodicNoise(u, v, 2, 2, seed + 91)
      const lineShade = (primaryLine + secondaryLine) * breath * contrast

      // Gentle warm heartwood tonal wash across the plank.
      const broadWash = (periodicFbm(u, v, 2, 2, seed + 131) - 0.5) * 2 * wash
      const knotFactor = opts.lacquer ? 0.45 : 1.0
      const knotDark = (knotCore * 0.29 + knotRing * 0.14 + knotHalo * 0.08) * knotFactor

      // Warm-shifted multiplicative tint around bright neutral white (~0.98) so darker rings & knots stay rich caramel, never gray.
      const r = THREE.MathUtils.clamp(0.995 + broadWash * 0.65 - lineShade * 0.72 - knotDark * 0.76, 0.52, 1.0)
      const g = THREE.MathUtils.clamp(0.985 + broadWash * 0.35 - lineShade * 0.96 - knotDark * 1.04, 0.42, 1.0)
      const b = THREE.MathUtils.clamp(0.972 - broadWash * 0.12 - lineShade * 1.16 - knotDark * 1.24, 0.32, 1.0)

      const idx = (py * width + px) * 4
      data[idx] = Math.round(r * 255)
      data[idx + 1] = Math.round(g * 255)
      data[idx + 2] = Math.round(b * 255)
      data[idx + 3] = 255
    }
  }
  pixelCache.set(key, data)
  return { data, width, height }
}

/** Deterministic stylized warm wood-grain & sparse-knot DataTexture; caller owns disposal. */
export function createWoodGrainTexture(
  opts: WoodGrainOptions,
  offsetU = 0,
  offsetV = 0,
  repeatU = 1,
  repeatV = 1,
): THREE.DataTexture {
  const { data, width, height } = buildWoodPixels(opts)
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.offset.set(offsetU, offsetV)
  texture.repeat.set(repeatU, repeatV)
  texture.needsUpdate = true
  return texture
}

/**
 * Projects distortion-free, world-proportioned wood UVs onto non-indexed or face-separated
 * geometries (RoundedBoxGeometry, ExtrudeGeometry, BoxGeometry) with U along the grain axis.
 */
export function projectWoodUVs(
  geometry: THREE.BufferGeometry,
  axis: 'x' | 'y' | 'z',
  scaleU = 0.55,
  scaleV = 0.75,
  offsetU = 0,
  offsetV = 0,
): THREE.BufferGeometry {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const uv = new Float32Array(pos.count * 2)

  const assign = (i: number, nx: number, ny: number, nz: number) => {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz)
    let u = 0, v = 0
    if (axis === 'x') {
      if (ax >= ay && ax >= az) { u = z * scaleU; v = y * scaleV }
      else if (ay >= az) { u = x * scaleU; v = z * scaleV }
      else { u = x * scaleU; v = y * scaleV }
    } else if (axis === 'y') {
      if (ay >= ax && ay >= az) { u = x * scaleU; v = z * scaleV }
      else if (ax >= az) { u = y * scaleU; v = z * scaleV }
      else { u = y * scaleU; v = x * scaleV }
    } else {
      if (az >= ax && az >= ay) { u = x * scaleU; v = y * scaleV }
      else if (ay >= ax) { u = z * scaleU; v = x * scaleV }
      else { u = z * scaleU; v = y * scaleV }
    }
    uv[i * 2] = u + offsetU
    uv[i * 2 + 1] = v + offsetV
  }

  if (!geometry.index) {
    for (let i = 0; i < pos.count; i += 3) {
      const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i)
      const bx = pos.getX(i + 1) - ax, by = pos.getY(i + 1) - ay, bz = pos.getZ(i + 1) - az
      const cx = pos.getX(i + 2) - ax, cy = pos.getY(i + 2) - ay, cz = pos.getZ(i + 2) - az
      const nx = by * cz - bz * cy
      const ny = bz * cx - bx * cz
      const nz = bx * cy - by * cx
      assign(i, nx, ny, nz)
      assign(i + 1, nx, ny, nz)
      assign(i + 2, nx, ny, nz)
    }
  } else if (norm) {
    for (let i = 0; i < pos.count; i++) {
      assign(i, norm.getX(i), norm.getY(i), norm.getZ(i))
    }
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geometry
}

/**
 * Projects distinct per-facet vertical wood UVs onto a non-indexed upright hexagonal prism
 * so each side facet reads as its own cut of warm cedar without bevel seams.
 */
export function projectHexPrismWoodUVs(
  geometry: THREE.BufferGeometry,
  scaleU = 0.72,
  scaleV = 0.92,
  offsetU = 0,
  offsetV = 0,
): THREE.BufferGeometry {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i += 3) {
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i)
    const bx = pos.getX(i + 1) - ax, by = pos.getY(i + 1) - ay, bz = pos.getZ(i + 1) - az
    const cx = pos.getX(i + 2) - ax, cy = pos.getY(i + 2) - ay, cz = pos.getZ(i + 2) - az
    const nx = by * cz - bz * cy
    const ny = bz * cx - bx * cz
    const nz = bx * cy - by * cx
    const len = Math.hypot(nx, ny, nz) || 1
    const uny = Math.abs(ny / len)
    if (uny > 0.68) {
      for (let k = 0; k < 3; k++) {
        uv[(i + k) * 2] = pos.getX(i + k) * scaleU + offsetU
        uv[(i + k) * 2 + 1] = pos.getZ(i + k) * scaleV + offsetV
      }
    } else {
      const hLen = Math.hypot(nx, nz) || 1
      const hnx = nx / hLen
      const hnz = nz / hLen
      const faceIdx = Math.round(((Math.atan2(hnz, hnx) + Math.PI) / (Math.PI * 2)) * 6) % 6
      const faceOffU = offsetU + faceIdx * 0.29
      const faceOffV = offsetV + faceIdx * 0.41
      for (let k = 0; k < 3; k++) {
        const vx = pos.getX(i + k), vy = pos.getY(i + k), vz = pos.getZ(i + k)
        const s = -vx * hnz + vz * hnx
        uv[(i + k) * 2] = vy * scaleU + faceOffU
        uv[(i + k) * 2 + 1] = s * scaleV + faceOffV
      }
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geometry
}
