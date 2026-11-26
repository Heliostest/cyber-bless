import * as THREE from 'three'

export type BojagiMatTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type PixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

const cachedBojagiPixels = new Map<string, PixelBuffers>()

function bojagiHash(ix: number, iy: number, seed: number): number {
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
  const a = bojagiHash(x0, y0, seed)
  const b = bojagiHash(x1, y0, seed)
  const c = bojagiHash(x0, y1, seed)
  const d = bojagiHash(x1, y1, seed)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}

function buildDataTexture(
  source: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  repeat?: readonly [number, number],
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), size, size)
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

// Quiet honey-straw sedge mat palette anchored near original #b58e55 / #b99b69:
// warmer & slightly richer than the pale oak veranda planks below, yet restrained
// so the patchwork silk/linen bojagi cloth stays the clear visual hero.
const MAT_REED = {
  light: [206, 173, 118] as const,
  mid: [187, 152, 98] as const,
  warm: [198, 163, 108] as const,
  toasted: [173, 138, 86] as const,
  crease: [148, 115, 70] as const,
  border: [165, 130, 80] as const,
}

/**
 * 512x512 stylized woven reed mat texture for `bojagi-woven-mat`
 * (RoundedBoxGeometry 2.05 x 0.055 x 2.35; top `+Y` maps `u` along X, `v` along Z).
 * Quiet hand-woven rush stalks running along X bound by vertical warp columns and
 * finished with a calm woven selvedge border around the rectangular perimeter.
 */
export function createBojagiMatBaseTextures(): BojagiMatTextureSet {
  const size = 512
  const key = 'bojagi-mat-base-v1'
  let cached = cachedBojagiPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const reedRows = 54
    const warpCols = 18

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size

        // Woven reed stalks running horizontally along `u` (X), stacked across `v` (Z).
        // Continuous long sedge reeds bound by aligned quiet vertical warp lines
        // (traditional dotjari sedge-mat rhythm, avoiding busy brick-wall staggering).
        const reedPos = v * reedRows
        const reedIdx = Math.floor(reedPos)
        const reedFrac = reedPos - reedIdx
        const reedCrown = Math.sin(reedFrac * Math.PI)
        const reedSeam = Math.pow(1 - reedCrown, 2.2)

        // Quiet aligned vertical warp bindings across `u`.
        const warpPos = u * warpCols
        const warpIdx = Math.floor(warpPos)
        const warpFrac = warpPos - warpIdx
        const warpDist = Math.abs(warpFrac - 0.5) * 2
        const weaveArch = Math.sin(warpFrac * Math.PI)
        const warpPinch = Math.exp(-Math.pow((1 - warpDist) / 0.11, 2))

        // Gentle straw-to-straw color variation + fine lengthwise stalk grain along `u`.
        const stalkTone = bojagiHash(reedIdx, 11, 163)
        const stalkPhase = bojagiHash(reedIdx, 23, 227)
        const cellTone = bojagiHash(warpIdx, reedIdx, 283)
        const grain = (periodicNoise(u * 4, v * 26, 4, 26, 347) - 0.5) * 0.36
          + Math.sin((reedFrac * 3 + stalkPhase) * tau) * 0.12
        const broadDrift = periodicNoise(u * 3, v * 3, 3, 3, 401)

        const warmMix = THREE.MathUtils.clamp(stalkTone * 0.56 + broadDrift * 0.34 + cellTone * 0.10, 0, 1)
        const baseR = THREE.MathUtils.lerp(MAT_REED.toasted[0], MAT_REED.warm[0], warmMix)
        const baseG = THREE.MathUtils.lerp(MAT_REED.toasted[1], MAT_REED.warm[1], warmMix)
        const baseB = THREE.MathUtils.lerp(MAT_REED.toasted[2], MAT_REED.warm[2], warmMix)

        const crestLift = THREE.MathUtils.clamp(
          (reedCrown - 0.45) * 0.28 + (weaveArch - 0.45) * 0.12 + Math.max(0, grain) * 0.18,
          0,
          0.36,
        )
        const litR = THREE.MathUtils.lerp(baseR, MAT_REED.light[0], crestLift)
        const litG = THREE.MathUtils.lerp(baseG, MAT_REED.light[1], crestLift)
        const litB = THREE.MathUtils.lerp(baseB, MAT_REED.light[2], crestLift)

        const shade = THREE.MathUtils.clamp(
          reedSeam * 0.26 + warpPinch * 0.15 + Math.max(0, -grain) * 0.10,
          0,
          0.42,
        )
        let fR = THREE.MathUtils.lerp(litR, MAT_REED.crease[0], shade)
        let fG = THREE.MathUtils.lerp(litG, MAT_REED.crease[1], shade)
        let fB = THREE.MathUtils.lerp(litB, MAT_REED.crease[2], shade)

        // Quiet bound woven selvedge edge framing the rectangular mat.
        const edgeDist = Math.min(u, 1 - u, v, 1 - v)
        const borderMask = 1 - THREE.MathUtils.smoothstep(edgeDist, 0.032, 0.052)
        const borderGroove = Math.exp(-Math.pow((edgeDist - 0.044) / 0.008, 2))
        const borderTick = 0.5 + 0.5 * Math.sin((u + v) * tau * 42)
        const bR = THREE.MathUtils.lerp(MAT_REED.border[0], MAT_REED.warm[0], borderTick * 0.38)
        const bG = THREE.MathUtils.lerp(MAT_REED.border[1], MAT_REED.warm[1], borderTick * 0.38)
        const bB = THREE.MathUtils.lerp(MAT_REED.border[2], MAT_REED.warm[2], borderTick * 0.38)

        fR = THREE.MathUtils.lerp(fR, bR, borderMask * 0.72)
        fG = THREE.MathUtils.lerp(fG, bG, borderMask * 0.72)
        fB = THREE.MathUtils.lerp(fB, bB, borderMask * 0.72)

        fR = THREE.MathUtils.lerp(fR, MAT_REED.crease[0], borderGroove * 0.38)
        fG = THREE.MathUtils.lerp(fG, MAT_REED.crease[1], borderGroove * 0.38)
        fB = THREE.MathUtils.lerp(fB, MAT_REED.crease[2], borderGroove * 0.38)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(fR), 0, 214)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(fG), 0, 182)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(fB), 0, 128)
        color[idx + 3] = 255

        const fieldH = 128 + (reedCrown - 0.5) * 34 + (weaveArch - 0.5) * 16 + grain * 14 - warpPinch * 18
        const rimH = 132 + (borderTick - 0.5) * 20
        const h = THREE.MathUtils.clamp(
          Math.round(THREE.MathUtils.lerp(fieldH, rimH, borderMask) - borderGroove * 24),
          54,
          208,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(230 - crestLift * 14 + shade * 20), 210, 252)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedBojagiPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace),
  }
}

/**
 * Oriented reed-strand texture for the thin raised `bojagi-weft-*` (runs along X = `u`
 * on RoundedBoxGeometry `+Y` face) and `bojagi-warp-*` (runs along Z = `v` on `+Y` face).
 */
export function createBojagiStrandTextures(direction: 'weft' | 'warp'): BojagiMatTextureSet {
  const size = 128
  const key = `bojagi-strand-${direction}-v1`
  let cached = cachedBojagiPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const seed = direction === 'weft' ? 521 : 587
    const hi = direction === 'weft' ? MAT_REED.light : MAT_REED.warm
    const mid = direction === 'weft' ? MAT_REED.warm : MAT_REED.mid

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const along = direction === 'weft' ? u : v
        const across = direction === 'weft' ? v : u

        const flutes = Math.sin(across * tau * 3 + Math.sin(along * tau * 2) * 0.2) * 0.5 + 0.5
        const drift = periodicNoise(along * 6, across * 2, 6, 2, seed)
        const crossing = Math.pow(Math.max(0, Math.cos(along * tau * 9)), 6) * 0.30

        const t = THREE.MathUtils.clamp(flutes * 0.52 + drift * 0.48, 0, 1)
        const baseR = THREE.MathUtils.lerp(mid[0], hi[0], t)
        const baseG = THREE.MathUtils.lerp(mid[1], hi[1], t)
        const baseB = THREE.MathUtils.lerp(mid[2], hi[2], t)

        const shade = THREE.MathUtils.clamp((1 - flutes) * 0.20 + crossing, 0, 0.50)
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseR, MAT_REED.crease[0], shade)), 0, 212)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseG, MAT_REED.crease[1], shade)), 0, 180)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseB, MAT_REED.crease[2], shade)), 0, 126)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(128 + (flutes - 0.5) * 28 - crossing * 24), 66, 200)
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(234 - flutes * 12 + shade * 16), 214, 252)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedBojagiPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, direction === 'weft' ? [2, 1] : [1, 2]),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, direction === 'weft' ? [2, 1] : [1, 2]),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, direction === 'weft' ? [2, 1] : [1, 2]),
  }
}

export type BojagiMatMaterials = {
  base: THREE.MeshStandardMaterial
  weft: THREE.MeshStandardMaterial
  warp: THREE.MeshStandardMaterial
  dispose(): void
}

function makeReedMaterial(tex: BojagiMatTextureSet, roughness: number, bumpScale: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale,
    roughnessMap: tex.roughness,
    roughness,
    metalness: 0,
    envMapIntensity: 0.32,
  })
}

export function createBojagiMatMaterials(): BojagiMatMaterials {
  const baseTex = createBojagiMatBaseTextures()
  const weftTex = createBojagiStrandTextures('weft')
  const warpTex = createBojagiStrandTextures('warp')

  const ownedTextures: THREE.DataTexture[] = [
    baseTex.map, baseTex.bump, baseTex.roughness,
    weftTex.map, weftTex.bump, weftTex.roughness,
    warpTex.map, warpTex.bump, warpTex.roughness,
  ]

  const base = makeReedMaterial(baseTex, 0.91, 0.0028)
  const weft = makeReedMaterial(weftTex, 0.92, 0.0020)
  const warp = makeReedMaterial(warpTex, 0.92, 0.0020)

  let disposed = false
  return {
    base,
    weft,
    warp,
    dispose() {
      if (disposed) return
      disposed = true
      for (const tex of ownedTextures) tex.dispose()
    },
  }
}
