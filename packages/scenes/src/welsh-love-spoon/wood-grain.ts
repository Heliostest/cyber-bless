import * as THREE from 'three'

export type SpoonWoodKnot = {
  /** Coordinate along the wood grain (0..1). */
  along: number
  /** Coordinate across the wood grain (0..1). */
  across: number
  /** Half-length along grain. */
  radiusAlong: number
  /** Half-width across grain. */
  radiusAcross: number
  /** Outward streamline deflection pushing surrounding fibers smoothly around the knot. */
  deflect: number
  /** Visual warmth/depth strength of the knot rings & core (0..1). */
  strength?: number
}

export type SpoonWoodSpec = {
  key: string
  width?: number
  height?: number
  seed: number
  /** Warm sunlit earlywood sRGB hex. */
  earlywood: string
  /** Richer latewood grain vein sRGB hex. */
  latewood: string
  /** Soft warm umber knot core sRGB hex. */
  knotCore: string
  /** Subtle warm golden compression halo sRGB hex. */
  knotHalo?: string
  /** Base annual ring frequency across the board. */
  ringFreq: number
  /** Organic low-frequency grain flow warp amplitude. */
  flowAmp: number
  /** Gentle cathedral arch curvature. */
  archAmp?: number
  /** Subtle warm heartwood/sapwood wash (0..0.15). */
  washStrength?: number
  /** Grain direction in texture space: 'v' (vertical along V, for carved spoon) or 'u' (horizontal along U, for boxes). */
  grainAxis: 'u' | 'v'
  /** Optional sparse stylized wood knots ("木眼"). */
  knots?: SpoonWoodKnot[]
  /** If true (for grainAxis='u' vertical pegs), reserves V in [0.76..1.0] for soft concentric end-grain rings. */
  withEndGrainBand?: boolean
  /** Roughness range [min, max] encoded into roughnessMap (0..1). */
  roughnessRange?: [number, number]
}

export type SpoonWoodTextures = {
  map: THREE.DataTexture
  bumpMap: THREE.DataTexture
  roughnessMap: THREE.DataTexture
  dispose(): void
}

type CachedBuffers = {
  width: number
  height: number
  albedo: Uint8Array<ArrayBuffer>
  bump: Uint8Array<ArrayBuffer>
  rough: Uint8Array<ArrayBuffer>
}

const bufferCache = new Map<string, CachedBuffers>()

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function valueNoise2(x: number, y: number, seed: number): number {
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
  return (
    valueNoise2(x, y, seed) * 0.60 +
    valueNoise2(x * 2.07 + 5.3, y * 2.07 + 9.1, seed + 29) * 0.28 +
    valueNoise2(x * 4.21 + 11.7, y * 4.21 + 3.4, seed + 71) * 0.12
  )
}

function buildBuffers(spec: SpoonWoodSpec): CachedBuffers {
  const cached = bufferCache.get(spec.key)
  if (cached) return cached

  const width = spec.width ?? 512
  const height = spec.height ?? 512
  const early = hexToRgb(spec.earlywood)
  const late = hexToRgb(spec.latewood)
  const core = hexToRgb(spec.knotCore)
  const halo = hexToRgb(spec.knotHalo ?? spec.earlywood)
  const [rMin, rMax] = spec.roughnessRange ?? [0.84, 1.0]
  const archAmp = spec.archAmp ?? 0.30
  const washStrength = spec.washStrength ?? 0.08
  const knots = spec.knots ?? []
  const seed = spec.seed

  const albedo = new Uint8Array(width * height * 4)
  const bump = new Uint8Array(width * height * 4)
  const rough = new Uint8Array(width * height * 4)

  for (let py = 0; py < height; py++) {
    const v = (py + 0.5) / height
    for (let px = 0; px < width; px++) {
      const u = (px + 0.5) / width
      const idx = (py * width + px) * 4

      let latewood = 0
      let knotCoreMix = 0
      let knotHaloMix = 0
      let wash = 0
      let silkyStreak = 0

      if (spec.withEndGrainBand && v > 0.74) {
        // Stylized soft end-grain rings on top of vertical wooden pegs.
        const eu = (u - 0.5) * 2.0
        const ev = ((v - 0.76) / 0.24 - 0.5) * 2.0
        const angle = Math.atan2(ev, eu)
        const wobble = (fbm2(Math.cos(angle) * 1.4 + 2.5, Math.sin(angle) * 1.4 + 2.5, seed + 211) - 0.5) * 0.14
        const dist = Math.hypot(eu * 0.94 + 0.06, ev * 1.05 - 0.05) + wobble
        const ringWave = 0.5 + 0.5 * Math.sin(dist * Math.PI * 2 * 4.8 + seed * 0.4)
        latewood = Math.pow(smoothstep(0.52, 0.96, ringWave), 1.35) * 0.84
        wash = (fbm2(eu * 1.3 + 4, ev * 1.3 + 4, seed + 257) - 0.5) * 0.12
        silkyStreak = 0
      } else {
        const along = spec.grainAxis === 'v' ? v : u
        const acrossRaw = spec.grainAxis === 'v' ? u : (spec.withEndGrainBand ? v / 0.72 : v)
        let across = acrossRaw

        // 1. Streamline deflection around sparse knots ("木眼"): fibers bend smoothly around each knot.
        for (const k of knots) {
          const da = along - k.along
          const dc = acrossRaw - k.across
          const ex = da / k.radiusAlong
          const ey = dc / k.radiusAcross
          const r2 = ex * ex + ey * ey
          if (r2 < 18) {
            const env = Math.exp(-r2 * 0.40)
            const signedPush = dc / Math.sqrt(dc * dc + k.radiusAcross * k.radiusAcross * 0.30)
            across -= signedPush * k.deflect * env

            const r = Math.sqrt(r2)
            const ang = Math.atan2(ey, ex)
            const wobble = (valueNoise2(Math.cos(ang) * 1.85 + 6.0, Math.sin(ang) * 1.85 + 6.0, seed + 137) - 0.5) * 0.13
            const rw = r + wobble
            const kStr = k.strength ?? 0.80
            const haloBand = Math.exp(-Math.pow((rw - 1.04) / 0.48, 2)) * 0.44 * kStr
            const eyeMask = (1 - smoothstep(0.62, 1.12, rw)) * kStr
            const eyeRings = Math.pow(smoothstep(0.42, 0.92, 0.5 + 0.5 * Math.sin(rw * Math.PI * 3.8)), 1.25)
            const eyeCore = (1 - smoothstep(0.16, 0.44, rw)) * kStr
            knotHaloMix = Math.max(knotHaloMix, haloBand)
            knotCoreMix = Math.max(knotCoreMix, Math.max(eyeCore * 0.84, eyeMask * eyeRings * 0.64))
          }
        }

        // 2. Graceful domain-warped grain flow + subtle cathedral arch + non-uniform ring spacing.
        const flowSlow = (fbm2(along * 1.55 + seed * 0.29, across * 1.85 + seed * 0.71, seed + 17) - 0.5) * spec.flowAmp
        const flowMed = (fbm2(along * 3.25 + 7.4, across * 3.6 + 2.3, seed + 43) - 0.5) * (spec.flowAmp * 0.34)
        // Graceful S-curve cathedral drift so fibers never look like parallel pinstripes
        const arch =
          archAmp *
          Math.sin(along * Math.PI * 1.55 + 0.4 + seed * 0.25) *
          (0.45 + 0.55 * Math.cos((across - 0.48) * Math.PI))
        const spacingMod = (fbm2(along * 1.05 + 4.7, across * 1.7 + 8.3, seed + 67) - 0.5) * 0.78

        const phase = (across + flowSlow + flowMed + arch * 0.18) * spec.ringFreq + spacingMod
        const mainWave = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2)
        const softSubWave = 0.5 + 0.5 * Math.sin((phase * 2.0 + 0.26) * Math.PI * 2)
        // Broad sunlit earlywood (~68%) with softly tapered latewood veins (~32%)
        latewood =
          Math.pow(smoothstep(0.54, 0.96, mainWave), 1.32) * 0.84 +
          Math.pow(smoothstep(0.75, 0.98, softSubWave), 1.75) * 0.16

        // 3. Broad warm heartwood/sapwood drift + faint silky longitudinal fibers
        wash = (fbm2(along * 1.2 + 3.1, across * 1.9 + 6.5, seed + 97) - 0.5) * 2 * washStrength
        silkyStreak = (valueNoise2(along * 2.6 + 1.3, (across + flowSlow * 0.6) * 20.0 + 5.1, seed + 151) - 0.5) * 0.065
      }

      const grainT = clamp01(latewood * 0.92 + silkyStreak * 0.5)
      let r = early[0] + (late[0] - early[0]) * grainT
      let g = early[1] + (late[1] - early[1]) * grainT
      let b = early[2] + (late[2] - early[2]) * grainT

      const washMul = 1 + wash + silkyStreak * 0.45
      r *= washMul
      g *= washMul * (1 + wash * 0.08)
      b *= washMul * (1 - wash * 0.06)

      if (knotHaloMix > 0.001) {
        const h = clamp01(knotHaloMix)
        r = r + (halo[0] - r) * h * 0.50
        g = g + (halo[1] - g) * h * 0.46
        b = b + (halo[2] - b) * h * 0.40
      }

      if (knotCoreMix > 0.001) {
        const k = clamp01(knotCoreMix)
        r = r + (core[0] - r) * k * 0.88
        g = g + (core[1] - g) * k * 0.88
        b = b + (core[2] - b) * k * 0.88
      }

      albedo[idx] = Math.round(clamp01(r / 255) * 255)
      albedo[idx + 1] = Math.round(clamp01(g / 255) * 255)
      albedo[idx + 2] = Math.round(clamp01(b / 255) * 255)
      albedo[idx + 3] = 255

      const heightVal = clamp01(0.62 - latewood * 0.24 - knotCoreMix * 0.22 + silkyStreak * 0.35)
      const bByte = Math.round(heightVal * 255)
      bump[idx] = bByte
      bump[idx + 1] = bByte
      bump[idx + 2] = bByte
      bump[idx + 3] = 255

      const roughNorm = clamp01(rMin + (rMax - rMin) * clamp01(0.26 + latewood * 0.58 + knotCoreMix * 0.22 - knotHaloMix * 0.16))
      const rByte = Math.round(roughNorm * 255)
      rough[idx] = rByte
      rough[idx + 1] = rByte
      rough[idx + 2] = rByte
      rough[idx + 3] = 255
    }
  }

  const result: CachedBuffers = { width, height, albedo, bump, rough }
  bufferCache.set(spec.key, result)
  return result
}

function makeTexture(data: Uint8Array<ArrayBuffer>, width: number, height: number, srgb: boolean): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

export function createSpoonWoodTextures(spec: SpoonWoodSpec): SpoonWoodTextures {
  const buf = buildBuffers(spec)
  const map = makeTexture(buf.albedo, buf.width, buf.height, true)
  const bumpMap = makeTexture(buf.bump, buf.width, buf.height, false)
  const roughnessMap = makeTexture(buf.rough, buf.width, buf.height, false)
  let disposed = false
  return {
    map,
    bumpMap,
    roughnessMap,
    dispose() {
      if (disposed) return
      disposed = true
      map.dispose()
      bumpMap.dispose()
      roughnessMap.dispose()
    },
  }
}

/**
 * Maps both the concave spoon bowl (offset y=0.477) and carved heart handle (offset y=0)
 * into ONE continuous single-block wood UV space. Gently coupling Z depth into U recreates
 * how carving a concave hollow slices through stacked annual growth rings.
 */
export function applyCarvedSpoonUVs(geometry: THREE.BufferGeometry, yOffset: number): void {
  const pos = geometry.getAttribute('position')
  if (!pos) return
  const uvs = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i)
    const sy = pos.getY(i) + yOffset
    const sz = pos.getZ(i)
    // Gentle Z-tilt creates natural carved-bowl contour bends & seamless bevel grain
    const u = clamp01(0.5 + (sx + (sz - 0.05) * 0.46) / 0.92)
    const v = clamp01((sy + 0.04) / 2.22)
    uvs[i * 2] = u
    uvs[i * 2 + 1] = v
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
}

/**
 * Generates C-infinity smooth, bevel-continuous wood UVs for RoundedBoxGeometry pieces
 * with zero discontinuities across rounded fillets.
 */
export function applyStandBoxWoodUVs(
  geometry: THREE.BufferGeometry,
  size: [number, number, number],
  axis: 'x' | 'y',
  options?: { flipX?: boolean; uShift?: number },
): void {
  const pos = geometry.getAttribute('position')
  if (!pos) return
  const [sx, sy, sz] = size
  const hx = sx * 0.5
  const hy = sy * 0.5
  const hz = sz * 0.5
  const flipX = options?.flipX ? -1 : 1
  const uShift = options?.uShift ?? 0
  const uvs = new Float32Array(pos.count * 2)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * flipX
    const y = pos.getY(i)
    const z = pos.getZ(i)

    let u = 0.5
    let v = 0.5

    if (axis === 'x') {
      // Smooth wrap from top plank face over the front rounded edge down the front face.
      const spanV = sz + sy * 1.1
      u = clamp01((x + hx) / sx + uShift)
      v = clamp01((z + hz + (hy - y) * 0.9) / spanV)
    } else {
      // Vertical peg: U runs smoothly bottom->top along Y; V slices continuously through X and Z across rounded corners.
      u = clamp01((y + hy) / sy + uShift)
      v = clamp01(0.5 + (x + z * 0.55) / (sx + sz * 0.7))
    }

    uvs[i * 2] = u
    uvs[i * 2 + 1] = v
  }

  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
}
