import * as THREE from 'three'

export type BaciMatTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type PixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  width: number
  height: number
}

const cachedMatPixels = new Map<string, PixelBuffers>()

function matHash(ix: number, iy: number, seed: number): number {
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
  const a = matHash(x0, y0, seed)
  const b = matHash(x1, y0, seed)
  const c = matHash(x0, y1, seed)
  const d = matHash(x1, y1, seed)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}

function buildDataTexture(
  source: Uint8Array,
  width: number,
  height: number,
  colorSpace: THREE.ColorSpace,
  repeat?: readonly [number, number],
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), width, height)
  tex.colorSpace = colorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  if (repeat) tex.repeat.set(repeat[0], repeat[1])
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

// Quiet warm hand-woven reed palette centered around original #c7ae79 so the
// luminous white spun-cotton thread (#fff9e9) keeps crisp contrast above the mat.
const REED = {
  light: [222, 199, 147] as const,
  mid: [201, 176, 124] as const,
  warm: [213, 187, 132] as const,
  toasted: [186, 158, 108] as const,
  crease: [158, 132, 86] as const,
  twine: [174, 146, 98] as const,
}

/**
 * 512x512 hand-woven oval sedge/reed mat top texture mapped onto CylinderGeometry's
 * top cap (in Three.js r170, CylinderGeometry top cap maps `u` along world +Z and
 * `v` along world +X, spanning the unit disk `r <= 1` centered at (0.5, 0.5)).
 *
 * Reed stalks therefore run along `v` (world X, parallel to `baci-mat-weft-*`) and
 * stack across `u` (world Z), bound by quiet vertical warp twine columns and framed
 * by a calm bound-reed oval border.
 */
export function createBaciMatTopTextures(): BaciMatTextureSet {
  const size = 512
  const key = 'baci-mat-top-v1'
  let cached = cachedMatPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const reedCount = 46
    const warpCols = 14

    for (let y = 0; y < size; y++) {
      const v = y / size // along world X
      const dv = (v - 0.5) * 2
      for (let x = 0; x < size; x++) {
        const u = x / size // along world Z
        const du = (u - 0.5) * 2
        const r = Math.hypot(du, dv)
        const theta = Math.atan2(dv, du)

        // Stacked reed stalks across `u` (world Z), running along `v` (world X).
        const reedPos = u * reedCount
        const reedIdx = Math.floor(reedPos)
        const reedFrac = reedPos - reedIdx
        const reedCrown = Math.sin(reedFrac * Math.PI) // 0 in reed seam, 1 on stalk crown
        const reedSeam = Math.pow(1 - reedCrown, 2.0)

        // Spaced warp twine bindings along `v` (world X) alternating phase every reed.
        const warpPos = v * warpCols + (reedIdx & 1) * 0.5
        const warpIdx = Math.floor(warpPos)
        const warpFrac = warpPos - warpIdx
        const warpDist = Math.abs(warpFrac - 0.5) * 2
        // Soft over/under reed undulation between warp ties.
        const weaveWave = Math.sin(warpFrac * Math.PI)
        const twinePinch = Math.exp(-Math.pow((1 - warpDist) / 0.14, 2))
        const twineCrest = Math.exp(-Math.pow((1 - warpDist) / 0.055, 2))

        // Gentle per-stalk warm/buff/toasted reed variation + elongated stalk grain along `v`.
        const stalkRand = matHash(reedIdx, 13, 191)
        const stalkShift = matHash(reedIdx, 29, 257)
        const cellVar = matHash(reedIdx, warpIdx, 311)
        const grain = (periodicNoise(u * 24, v * 4, 24, 4, 373) - 0.5) * 0.45
          + Math.sin((reedFrac * 3 + stalkShift) * tau) * 0.14
        const broadWarm = periodicNoise(u * 3, v * 3, 3, 3, 409)

        // Blend calm reed body tone (keeping contrast soft so white cotton stays hero).
        const warmMix = THREE.MathUtils.clamp(stalkRand * 0.55 + broadWarm * 0.30 + cellVar * 0.15, 0, 1)
        const midR = THREE.MathUtils.lerp(REED.toasted[0], REED.warm[0], warmMix)
        const midG = THREE.MathUtils.lerp(REED.toasted[1], REED.warm[1], warmMix)
        const midB = THREE.MathUtils.lerp(REED.toasted[2], REED.warm[2], warmMix)

        const crestLift = THREE.MathUtils.clamp(
          (reedCrown - 0.45) * 0.36 + (weaveWave - 0.4) * 0.18 + Math.max(0, grain) * 0.22,
          0,
          0.45,
        )
        const litR = THREE.MathUtils.lerp(midR, REED.light[0], crestLift)
        const litG = THREE.MathUtils.lerp(midG, REED.light[1], crestLift)
        const litB = THREE.MathUtils.lerp(midB, REED.light[2], crestLift)

        // Subtle warm crease between reeds and where warp twine binds down (quiet behind white thread).
        const seamShade = THREE.MathUtils.clamp(
          reedSeam * 0.28 + twinePinch * 0.18 + Math.max(0, -grain) * 0.11,
          0,
          0.44,
        )
        let fR = THREE.MathUtils.lerp(litR, REED.crease[0], seamShade)
        let fG = THREE.MathUtils.lerp(litG, REED.crease[1], seamShade)
        let fB = THREE.MathUtils.lerp(litB, REED.crease[2], seamShade)

        // Delicate binding twine highlight across the pinch seam.
        fR = THREE.MathUtils.lerp(fR, REED.twine[0], twineCrest * 0.42)
        fG = THREE.MathUtils.lerp(fG, REED.twine[1], twineCrest * 0.42)
        fB = THREE.MathUtils.lerp(fB, REED.twine[2], twineCrest * 0.42)

        // Hand-bound oval reed edge trim (`r` in 0.91..1.0) frames the mat cleanly.
        const borderMask = THREE.MathUtils.smoothstep(r, 0.905, 0.945)
        const borderCrease = Math.exp(-Math.pow((r - 0.915) / 0.016, 2))
        const lashWave = 0.5 + 0.5 * Math.sin(theta * 54 + r * 18)
        const borderR = THREE.MathUtils.lerp(REED.toasted[0], REED.warm[0], lashWave * 0.55)
        const borderG = THREE.MathUtils.lerp(REED.toasted[1], REED.warm[1], lashWave * 0.55)
        const borderB = THREE.MathUtils.lerp(REED.toasted[2], REED.warm[2], lashWave * 0.55)

        fR = THREE.MathUtils.lerp(fR, borderR, borderMask * 0.78)
        fG = THREE.MathUtils.lerp(fG, borderG, borderMask * 0.78)
        fB = THREE.MathUtils.lerp(fB, borderB, borderMask * 0.78)

        fR = THREE.MathUtils.lerp(fR, REED.crease[0], borderCrease * 0.42)
        fG = THREE.MathUtils.lerp(fG, REED.crease[1], borderCrease * 0.42)
        fB = THREE.MathUtils.lerp(fB, REED.crease[2], borderCrease * 0.42)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(fR), 0, 226)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(fG), 0, 206)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(fB), 0, 156)
        color[idx + 3] = 255

        const fieldH = 128 + (reedCrown - 0.5) * 38 + (weaveWave - 0.5) * 18 + grain * 14 - twinePinch * 20 + twineCrest * 18
        const rimH = 132 + (lashWave - 0.5) * 28
        const h = THREE.MathUtils.clamp(
          Math.round(THREE.MathUtils.lerp(fieldH, rimH, borderMask) - borderCrease * 28),
          48,
          212,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(228 - crestLift * 18 + seamShade * 22), 204, 252)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, width: size, height: size }
    cachedMatPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, cached.width, cached.height, THREE.SRGBColorSpace),
    bump: buildDataTexture(cached.bump, cached.width, cached.height, THREE.NoColorSpace),
    roughness: buildDataTexture(cached.roughness, cached.width, cached.height, THREE.NoColorSpace),
  }
}

/**
 * Braided-reed outer edge texture for the cylinder rim wall of `baci-woven-mat`.
 */
export function createBaciMatRimTextures(): BaciMatTextureSet {
  const width = 256
  const height = 64
  const key = 'baci-mat-rim-v1'
  let cached = cachedMatPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(width * height * 4)
    const bump = new Uint8Array(width * height * 4)
    const roughness = new Uint8Array(width * height * 4)
    const tau = Math.PI * 2

    for (let y = 0; y < height; y++) {
      const v = y / height
      for (let x = 0; x < width; x++) {
        const u = x / width
        const layer = Math.sin(v * tau * 3) * 0.5 + 0.5
        const lash = Math.sin((u * 36 + v * 1.4) * tau) * 0.5 + 0.5
        const drift = periodicNoise(u * 8, v * 2, 8, 2, 503)
        const t = THREE.MathUtils.clamp(layer * 0.45 + lash * 0.35 + drift * 0.20, 0, 1)
        const baseR = THREE.MathUtils.lerp(REED.crease[0], REED.warm[0], t)
        const baseG = THREE.MathUtils.lerp(REED.crease[1], REED.warm[1], t)
        const baseB = THREE.MathUtils.lerp(REED.crease[2], REED.warm[2], t)

        const idx = (y * width + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(baseR), 0, 220)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(baseG), 0, 198)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(baseB), 0, 148)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(128 + (layer - 0.5) * 32 + (lash - 0.5) * 28), 54, 206)
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(234 - t * 18), 210, 252)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, width, height }
    cachedMatPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, cached.width, cached.height, THREE.SRGBColorSpace, [3, 1]),
    bump: buildDataTexture(cached.bump, cached.width, cached.height, THREE.NoColorSpace, [3, 1]),
    roughness: buildDataTexture(cached.roughness, cached.width, cached.height, THREE.NoColorSpace, [3, 1]),
  }
}

/**
 * Longitudinal reed-strand texture for the 21 thin `baci-mat-weft-*` cylinders
 * (CylinderGeometry maps `v` along the cylinder length and `u` around circumference).
 */
export function createBaciWeftTextures(tone: 'warm' | 'pale'): BaciMatTextureSet {
  const size = 128
  const key = `baci-weft-${tone}-v1`
  let cached = cachedMatPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const seed = tone === 'warm' ? 607 : 673
    const lo = tone === 'warm' ? REED.crease : REED.toasted
    const mid = tone === 'warm' ? REED.toasted : REED.mid
    const hi = tone === 'warm' ? REED.warm : REED.light

    for (let y = 0; y < size; y++) {
      const v = y / size // along reed length
      for (let x = 0; x < size; x++) {
        const u = x / size // around circumference
        const flutes = Math.sin(u * tau * 4 + Math.sin(v * tau * 2) * 0.25) * 0.5 + 0.5
        const alongDrift = periodicNoise(u * 2, v * 5, 2, 5, seed)
        const warpNotch = Math.pow(Math.max(0, Math.cos(v * tau * 7)), 6) * 0.36

        const baseR = THREE.MathUtils.lerp(mid[0], hi[0], THREE.MathUtils.clamp(flutes * 0.55 + alongDrift * 0.45, 0, 1))
        const baseG = THREE.MathUtils.lerp(mid[1], hi[1], THREE.MathUtils.clamp(flutes * 0.55 + alongDrift * 0.45, 0, 1))
        const baseB = THREE.MathUtils.lerp(mid[2], hi[2], THREE.MathUtils.clamp(flutes * 0.55 + alongDrift * 0.45, 0, 1))

        const shade = THREE.MathUtils.clamp((1 - flutes) * 0.25 + warpNotch, 0, 0.58)
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseR, lo[0], shade)), 0, 224)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseG, lo[1], shade)), 0, 204)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseB, lo[2], shade)), 0, 154)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(128 + (flutes - 0.5) * 32 - warpNotch * 28), 58, 204)
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(230 - flutes * 14 + shade * 18), 208, 252)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, width: size, height: size }
    cachedMatPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, cached.width, cached.height, THREE.SRGBColorSpace, [1, 2]),
    bump: buildDataTexture(cached.bump, cached.width, cached.height, THREE.NoColorSpace, [1, 2]),
    roughness: buildDataTexture(cached.roughness, cached.width, cached.height, THREE.NoColorSpace, [1, 2]),
  }
}

export type BaciMatMaterials = {
  /** Material array `[side, top, bottom]` matching CylinderGeometry's 3 material groups. */
  matMaterials: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]
  weftWarm: THREE.MeshStandardMaterial
  weftPale: THREE.MeshStandardMaterial
  dispose(): void
}

function makeMatStandard(tex: BaciMatTextureSet, roughness: number, bumpScale: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale,
    roughnessMap: tex.roughness,
    roughness,
    metalness: 0,
    envMapIntensity: 0.34,
  })
}

export function createBaciMatMaterials(): BaciMatMaterials {
  const topTex = createBaciMatTopTextures()
  const rimTex = createBaciMatRimTextures()
  const weftWarmTex = createBaciWeftTextures('warm')
  const weftPaleTex = createBaciWeftTextures('pale')

  const ownedTextures: THREE.DataTexture[] = [
    topTex.map, topTex.bump, topTex.roughness,
    rimTex.map, rimTex.bump, rimTex.roughness,
    weftWarmTex.map, weftWarmTex.bump, weftWarmTex.roughness,
    weftPaleTex.map, weftPaleTex.bump, weftPaleTex.roughness,
  ]

  const topMat = makeMatStandard(topTex, 0.90, 0.0038)
  const rimMat = makeMatStandard(rimTex, 0.91, 0.0036)
  const weftWarm = makeMatStandard(weftWarmTex, 0.89, 0.0028)
  const weftPale = makeMatStandard(weftPaleTex, 0.89, 0.0028)

  let disposed = false
  return {
    matMaterials: [rimMat, topMat, topMat],
    weftWarm,
    weftPale,
    dispose() {
      if (disposed) return
      disposed = true
      for (const tex of ownedTextures) tex.dispose()
    },
  }
}
