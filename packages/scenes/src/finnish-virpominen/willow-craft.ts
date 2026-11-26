import * as THREE from 'three'

export type VirpominenWillowTone = 0 | 1 | 2
export type GrainOrientation = 'u' | 'v'

export type CraftTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type CraftPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

type WillowTonePalette = {
  light: readonly [number, number, number]
  mid: readonly [number, number, number]
  warm: readonly [number, number, number]
  dark: readonly [number, number, number]
  pith: readonly [number, number, number]
  seed: number
  roughness: number
  clearcoat: number
  clearcoatRoughness: number
}

/**
 * Three warm steamed-willow tones harmonized with the Polish blessing-basket
 * willow craft standard while sitting comfortably against the sunlit courtyard
 * grass, cool stone doorstep, and blue Finnish doorway. Peak sRGB channels stay
 * softly capped below Komorebi's linear clip shoulder.
 */
export const VIRPOMINEN_WILLOW_PALETTES: Record<VirpominenWillowTone, WillowTonePalette> = {
  0: {
    light: [216, 166, 102],
    mid: [192, 138, 78],
    warm: [208, 154, 90],
    dark: [132, 84, 42],
    pith: [152, 98, 50],
    seed: 131,
    roughness: 0.68,
    clearcoat: 0.16,
    clearcoatRoughness: 0.44,
  },
  1: {
    light: [230, 188, 122],
    mid: [210, 166, 100],
    warm: [222, 178, 110],
    dark: [152, 108, 58],
    pith: [170, 122, 66],
    seed: 229,
    roughness: 0.66,
    clearcoat: 0.19,
    clearcoatRoughness: 0.41,
  },
  2: {
    light: [236, 202, 142],
    mid: [222, 186, 124],
    warm: [231, 195, 132],
    dark: [168, 126, 74],
    pith: [184, 140, 82],
    seed: 347,
    roughness: 0.68,
    clearcoat: 0.17,
    clearcoatRoughness: 0.43,
  },
}

/**
 * Warm chestnut-umber young willow twig bark palette (Salix caprea) with subtle
 * pale-ochre lenticels so the creamy white pussy-willow buds stand out cleanly.
 */
export const WILLOW_BARK_PALETTE = {
  light: [172, 126, 82] as const,
  mid: [124, 84, 50] as const,
  warm: [146, 98, 58] as const,
  dark: [66, 40, 22] as const,
  lenticel: [188, 152, 108] as const,
}

const cachedPixels = new Map<string, CraftPixelBuffers>()

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

function buildDataTexture(
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

/**
 * Deterministic stylized willow cane textures (256x256, zero DOM dependency).
 * Supports both `orientation = 'u'` (along TorusGeometry ring circumference) and
 * `orientation = 'v'` (along CylinderGeometry upright height).
 */
export function createVirpominenWillowCaneTextures(
  tone: VirpominenWillowTone,
  orientation: GrainOrientation,
  repeat?: readonly [number, number],
  offset?: readonly [number, number],
): CraftTextureSet {
  const size = 256
  const cacheKey = `virpominen-cane-${tone}-${orientation}-v1`
  let cached = cachedPixels.get(cacheKey)
  if (!cached) {
    const pal = VIRPOMINEN_WILLOW_PALETTES[tone]
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const phaseA = hash2(pal.seed, 17, 3) * tau
    const phaseB = hash2(pal.seed, 31, 7) * tau

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const along = orientation === 'u' ? u : v
        const across = orientation === 'u' ? v : u

        const meander = Math.sin(along * tau + phaseA) * 0.045
          + (periodicNoise(along * 2, across * 3, 2, 3, pal.seed + 13) - 0.5) * 0.064
        const aw = across + meander

        // 4 clean stylized vascular ribs around the rod stay crisp & mip-stable at mobile card scale.
        const primaryFlute = Math.sin(aw * tau * 4 + phaseB)
        const secondaryFlute = Math.sin(aw * tau * 8 + phaseB * 1.5 + 0.6)
        const fluteWave = 0.68 * primaryFlute + 0.32 * secondaryFlute
        const fluteBreath = 0.74 + 0.42 * periodicNoise(along * 2, across * 4, 2, 4, pal.seed + 29)
        const flutes = fluteWave * fluteBreath

        const streakField = periodicNoise(along * 2, aw * 12, 2, 12, pal.seed + 47) - 0.5
        const fineWave = Math.sin(aw * tau * 12 + periodicNoise(along * 2, across * 4, 2, 4, pal.seed + 61) * 1.15)
        const fineFibers = streakField * 0.94 + fineWave * 0.22

        const bakeWave = 0.5 + 0.5 * Math.sin(along * tau + phaseA * 1.2)
        const bakeNoise = periodicNoise(along * 2, across * 2, 2, 2, pal.seed + 79)
        const warmMix = THREE.MathUtils.clamp(bakeWave * 0.56 + bakeNoise * 0.44, 0, 1)

        const pithField = periodicNoise(along * 3, across * 4, 3, 4, pal.seed + 101)
        const pithMask = THREE.MathUtils.smoothstep(pithField, 0.67, 0.89) * 0.32

        const fiberSignal = THREE.MathUtils.clamp(flutes * 0.64 + fineFibers * 0.46, -1, 1)
        const ridge = Math.max(0, fiberSignal)
        const furrow = Math.max(0, -fiberSignal)

        const baseR = THREE.MathUtils.lerp(pal.mid[0], pal.warm[0], warmMix)
        const baseG = THREE.MathUtils.lerp(pal.mid[1], pal.warm[1], warmMix)
        const baseB = THREE.MathUtils.lerp(pal.mid[2], pal.warm[2], warmMix)

        const liftedR = THREE.MathUtils.lerp(baseR, pal.light[0], ridge * 0.70)
        const liftedG = THREE.MathUtils.lerp(baseG, pal.light[1], ridge * 0.70)
        const liftedB = THREE.MathUtils.lerp(baseB, pal.light[2], ridge * 0.68)

        const groovePow = Math.pow(furrow, 0.96)
        const shadedR = THREE.MathUtils.lerp(liftedR, pal.dark[0], groovePow * 0.86)
        const shadedG = THREE.MathUtils.lerp(liftedG, pal.dark[1], groovePow * 0.88)
        const shadedB = THREE.MathUtils.lerp(liftedB, pal.dark[2], groovePow * 0.90)

        const finalR = THREE.MathUtils.lerp(shadedR, pal.pith[0], pithMask)
        const finalG = THREE.MathUtils.lerp(shadedG, pal.pith[1], pithMask)
        const finalB = THREE.MathUtils.lerp(shadedB, pal.pith[2], pithMask)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(finalR), 0, 236)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(finalG), 0, 206)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(finalB), 0, 152)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + flutes * 46 + fineFibers * 24 - pithMask * 18),
          36,
          220,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(
          Math.round(214 - ridge * 36 + furrow * 34 + pithMask * 18),
          174,
          252,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat, offset),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat, offset),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat, offset),
  }
}

/**
 * Hand-woven concentric coiled willow floor texture mapped onto CylinderGeometry's
 * cap UV disk (`center = (0.5, 0.5)`, `radius = 0.5`). Turns the wide visible
 * floor of `basket-solid-base` from a flat oval disc into warm coiled willow.
 */
export function createVirpominenBasketFloorTextures(): CraftTextureSet {
  const size = 256
  const cacheKey = 'virpominen-basket-floor-v1'
  let cached = cachedPixels.get(cacheKey)
  if (!cached) {
    const pal0 = VIRPOMINEN_WILLOW_PALETTES[0]
    const pal1 = VIRPOMINEN_WILLOW_PALETTES[1]
    const pal2 = VIRPOMINEN_WILLOW_PALETTES[2]
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2

    for (let y = 0; y < size; y++) {
      const v = y / size
      const dv = (v - 0.5) * 2
      for (let x = 0; x < size; x++) {
        const u = x / size
        const du = (u - 0.5) * 2
        const r = Math.hypot(du, dv)
        const theta = Math.atan2(dv, du)

        // 6.5 warm hand-woven willow coils interwoven over/under 16 radial bottom stakes.
        const spiralPhase = r * 6.5 + (theta / tau) * 1.0
        const coilIndex = Math.floor(spiralPhase)
        const coilFrac = spiralPhase - coilIndex
        const coilArch = Math.sin(coilFrac * Math.PI)
        const coilCrease = Math.pow(1 - coilArch, 1.55)

        // Alternating warm willow cane tint per coil + subtle tangential fiber grain.
        const toneBlend = 0.5 + 0.5 * Math.sin(coilIndex * 2.15 + 0.5)
        const bake = periodicNoise(u * 3, v * 3, 3, 3, 521)
        const tangFiber = Math.sin((coilFrac * 2.5 + Math.sin(theta * 3.0) * 0.16) * tau) * 0.22
          + (periodicNoise(u * 6, v * 6, 6, 6, 541) - 0.5) * 0.36

        // Interwoven radial willow spokes breaking pure concentric rings into organic hand-woven basketry.
        const spokeCos = Math.cos(theta * 16 + coilIndex * Math.PI)
        const spokeMask = THREE.MathUtils.smoothstep(r, 0.16, 0.32)
        const spokeOver = Math.max(0, spokeCos) * spokeMask
        const spokeUnder = Math.max(0, -spokeCos) * spokeMask * 0.48
        const radialWeave = Math.pow(spokeOver, 2.2) * 0.52

        // Warm toasted wall-meet shadow around the outer floor rim (`r -> 1.0`).
        const perimeterShade = THREE.MathUtils.smoothstep(r, 0.74, 1.02) * 0.42

        const baseR = THREE.MathUtils.lerp(pal0.warm[0], pal1.warm[0], toneBlend * 0.58 + bake * 0.28)
        const baseG = THREE.MathUtils.lerp(pal0.warm[1], pal1.warm[1], toneBlend * 0.58 + bake * 0.28)
        const baseB = THREE.MathUtils.lerp(pal0.warm[2], pal1.warm[2], toneBlend * 0.58 + bake * 0.28)

        const crest = Math.max(0, coilArch - 0.46) * 0.82 + Math.max(0, tangFiber) * 0.28 + radialWeave * 0.44
        const dip = THREE.MathUtils.clamp(
          coilCrease * 0.56 + spokeUnder * 0.34 + Math.max(0, -tangFiber) * 0.22 + perimeterShade,
          0,
          0.86,
        )

        const lR = THREE.MathUtils.lerp(baseR, pal2.light[0], THREE.MathUtils.clamp(crest, 0, 0.56))
        const lG = THREE.MathUtils.lerp(baseG, pal2.light[1], THREE.MathUtils.clamp(crest, 0, 0.56))
        const lB = THREE.MathUtils.lerp(baseB, pal2.light[2], THREE.MathUtils.clamp(crest, 0, 0.54))

        const fR = THREE.MathUtils.lerp(lR, pal0.dark[0], dip)
        const fG = THREE.MathUtils.lerp(lG, pal0.dark[1], dip)
        const fB = THREE.MathUtils.lerp(lB, pal0.dark[2], dip)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(fR), 0, 228)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(fG), 0, 194)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(fB), 0, 138)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + (coilArch - 0.5) * 66 + (spokeOver - spokeUnder) * 28 + tangFiber * 16 - perimeterShade * 24),
          36,
          220,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(
          Math.round(216 + coilCrease * 34 - Math.max(0, coilArch - 0.55) * 32 + perimeterShade * 20),
          174,
          252,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace),
  }
}

/**
 * Tightly plaited two-course horizontal willow foot-band texture for the
 * cylindrical side skirt of `basket-solid-base`, with warm grounded base shadow.
 */
export function createVirpominenBasketFootTextures(
  repeat: readonly [number, number] = [6, 1],
): CraftTextureSet {
  const size = 256
  const cacheKey = 'virpominen-basket-foot-v1'
  let cached = cachedPixels.get(cacheKey)
  if (!cached) {
    const pal0 = VIRPOMINEN_WILLOW_PALETTES[0]
    const pal1 = VIRPOMINEN_WILLOW_PALETTES[1]
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2

    for (let y = 0; y < size; y++) {
      const v = y / size // 0 bottom edge -> 1 top edge of base skirt
      const rowPhase = v * 2.0
      const rowIdx = Math.floor(rowPhase)
      const rowFrac = rowPhase - rowIdx
      const rowArch = Math.sin(rowFrac * Math.PI)
      const rowCrease = Math.pow(1 - rowArch, 1.45)
      const groundShade = (1 - THREE.MathUtils.smoothstep(v, 0.0, 0.36)) * 0.36

      for (let x = 0; x < size; x++) {
        const u = x / size
        // Diagonal plait cadence wrapping around the foot band (4 braided humps per tile).
        const plait = 0.5 + 0.5 * Math.sin((u * 4.0 + rowIdx * 0.5) * tau)
        const grain = Math.sin(rowFrac * tau * 3.0 + Math.sin(u * tau) * 0.3) * 0.30
          + (periodicNoise(u * 2, v * 8, 2, 8, 613) - 0.5) * 0.52
        const bake = periodicNoise(u * 2, v * 2, 2, 2, 619)

        const pal = rowIdx === 0 ? pal0 : pal1
        const baseR = THREE.MathUtils.lerp(pal.mid[0], pal.warm[0], bake * 0.55 + plait * 0.25)
        const baseG = THREE.MathUtils.lerp(pal.mid[1], pal.warm[1], bake * 0.55 + plait * 0.25)
        const baseB = THREE.MathUtils.lerp(pal.mid[2], pal.warm[2], bake * 0.55 + plait * 0.25)

        const lift = Math.max(0, rowArch - 0.45) * (0.55 + plait * 0.45) + Math.max(0, grain) * 0.24
        const dip = THREE.MathUtils.clamp(rowCrease * 0.72 + (1 - plait) * 0.24 + groundShade, 0, 0.90)

        const lR = THREE.MathUtils.lerp(baseR, pal.light[0], THREE.MathUtils.clamp(lift, 0, 0.62))
        const lG = THREE.MathUtils.lerp(baseG, pal.light[1], THREE.MathUtils.clamp(lift, 0, 0.62))
        const lB = THREE.MathUtils.lerp(baseB, pal.light[2], THREE.MathUtils.clamp(lift, 0, 0.60))

        const fR = THREE.MathUtils.lerp(lR, pal0.dark[0], dip)
        const fG = THREE.MathUtils.lerp(lG, pal0.dark[1], dip)
        const fB = THREE.MathUtils.lerp(lB, pal0.dark[2], dip)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(fR), 0, 226)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(fG), 0, 188)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(fB), 0, 128)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + (rowArch - 0.5) * 66 + (plait - 0.5) * 34 + grain * 18),
          36,
          220,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(
          Math.round(218 + rowCrease * 30 - lift * 28 + groundShade * 18),
          176,
          252,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat),
  }
}

/**
 * Fine vertical pussy-willow twig bark texture (256x256, zero DOM dependency).
 * Supports `orientation = 'v'` for CylinderGeometry `willow-stem` and `'u'` for
 * TubeGeometry `willow-fork-*` so bark grain flows continuously into every fork.
 */
export function createWillowBarkTextures(
  orientation: GrainOrientation,
  repeat?: readonly [number, number],
  offset?: readonly [number, number],
): CraftTextureSet {
  const size = 256
  const cacheKey = `virpominen-bark-${orientation}-v1`
  let cached = cachedPixels.get(cacheKey)
  if (!cached) {
    const pal = WILLOW_BARK_PALETTE
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const along = orientation === 'u' ? u : v
        const across = orientation === 'u' ? v : u

        // Gentle organic bark twist & longitudinal fissures running strictly along the twig.
        const twist = Math.sin(along * tau * 1.0 + 0.7) * 0.045
          + (periodicNoise(along * 2, across * 3, 2, 3, 733) - 0.5) * 0.070
        const aw = across + twist

        // Broad mip-stable vertical bark ridges (2 primary + 5 secondary around circumference)
        // stay crisp and legible on slender 3-5px willow twigs without sub-pixel mush.
        const primaryRidge = Math.sin(aw * tau * 2 + 0.9)
        const secondaryRidge = Math.sin(aw * tau * 5 + 2.1)
        const ridgeBreath = 0.74 + 0.44 * periodicNoise(along * 2, across * 3, 2, 3, 751)
        const barkFlutes = (0.68 * primaryRidge + 0.32 * secondaryRidge) * ridgeBreath

        const fineBark = (periodicNoise(along * 2, aw * 10, 2, 10, 769) - 0.5) * 0.76
        const warmWash = periodicNoise(along * 2, across * 2, 2, 2, 787)

        // Subtle sparse pale-ochre willow lenticels (tiny warm transverse flecks on young bark).
        const lenticelField = periodicNoise(along * 9, across * 3, 9, 3, 809)
        const lenticelMask = THREE.MathUtils.smoothstep(lenticelField, 0.76, 0.92) * 0.42

        const signal = THREE.MathUtils.clamp(barkFlutes * 0.70 + fineBark * 0.42, -1, 1)
        const crest = Math.max(0, signal)
        const fissure = Math.max(0, -signal)

        const baseR = THREE.MathUtils.lerp(pal.mid[0], pal.warm[0], warmWash * 0.72)
        const baseG = THREE.MathUtils.lerp(pal.mid[1], pal.warm[1], warmWash * 0.72)
        const baseB = THREE.MathUtils.lerp(pal.mid[2], pal.warm[2], warmWash * 0.72)

        const litR = THREE.MathUtils.lerp(baseR, pal.light[0], crest * 0.74)
        const litG = THREE.MathUtils.lerp(baseG, pal.light[1], crest * 0.74)
        const litB = THREE.MathUtils.lerp(baseB, pal.light[2], crest * 0.72)

        const darkR = THREE.MathUtils.lerp(litR, pal.dark[0], Math.pow(fissure, 0.92) * 0.88)
        const darkG = THREE.MathUtils.lerp(litG, pal.dark[1], Math.pow(fissure, 0.92) * 0.90)
        const darkB = THREE.MathUtils.lerp(litB, pal.dark[2], Math.pow(fissure, 0.92) * 0.92)

        const finalR = THREE.MathUtils.lerp(darkR, pal.lenticel[0], lenticelMask)
        const finalG = THREE.MathUtils.lerp(darkG, pal.lenticel[1], lenticelMask)
        const finalB = THREE.MathUtils.lerp(darkB, pal.lenticel[2], lenticelMask)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(finalR), 0, 196)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(finalG), 0, 158)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(finalB), 0, 114)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + barkFlutes * 48 + fineBark * 26 + lenticelMask * 16),
          32,
          224,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        // Gentle waxy living-bark sheen on raised epidermis vs matte bark fissures.
        const rVal = THREE.MathUtils.clamp(
          Math.round(218 - crest * 34 + fissure * 32 + lenticelMask * 14),
          176,
          252,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat, offset),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat, offset),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat, offset),
  }
}

function makePhysicalCraftMaterial(
  tex: CraftTextureSet,
  opts: {
    roughness: number
    bumpScale: number
    clearcoat: number
    clearcoatRoughness: number
    vertexColors: boolean
    specularIntensity?: number
    envMapIntensity?: number
  },
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale: opts.bumpScale,
    roughnessMap: tex.roughness,
    roughness: opts.roughness,
    metalness: 0,
    clearcoat: opts.clearcoat,
    clearcoatRoughness: opts.clearcoatRoughness,
    specularIntensity: opts.specularIntensity ?? 0.50,
    envMapIntensity: opts.envMapIntensity ?? 0.36,
    vertexColors: opts.vertexColors,
  })
  const release = () => {
    mat.removeEventListener('dispose', release)
    tex.map.dispose()
    tex.bump.dispose()
    tex.roughness.dispose()
  }
  mat.addEventListener('dispose', release)
  return mat
}

export type VirpominenWillowMaterials = {
  uprights: readonly [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
  rings: readonly [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
  baseSide: THREE.MeshPhysicalMaterial
  baseFloor: THREE.MeshPhysicalMaterial
  barkStem: THREE.MeshPhysicalMaterial
  barkFork: THREE.MeshPhysicalMaterial
}

/**
 * Full stylized willow-basket & pussy-willow-twig material suite for `finnish-virpominen`.
 * Every material owns its deterministic DataTextures and disposes them cleanly once.
 */
export function createVirpominenWillowMaterials(): VirpominenWillowMaterials {
  const tones: readonly VirpominenWillowTone[] = [0, 1, 2]
  const uprights = tones.map((tone) => {
    const pal = VIRPOMINEN_WILLOW_PALETTES[tone]
    return makePhysicalCraftMaterial(
      createVirpominenWillowCaneTextures(tone, 'v', [1, 1.35], [tone * 0.27, tone * 0.19]),
      {
        roughness: pal.roughness,
        bumpScale: 0.0072,
        clearcoat: pal.clearcoat,
        clearcoatRoughness: pal.clearcoatRoughness,
        vertexColors: true,
      },
    )
  }) as [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]

  // Four horizontal basket rings: alternating warm buff/toasted willow with a slightly richer top rim hoop.
  const ringSpecs: readonly { tone: VirpominenWillowTone; offset: readonly [number, number]; bumpScale: number }[] = [
    { tone: 0, offset: [0.05, 0.00], bumpScale: 0.0076 },
    { tone: 1, offset: [0.31, 0.18], bumpScale: 0.0076 },
    { tone: 2, offset: [0.57, 0.36], bumpScale: 0.0076 },
    { tone: 0, offset: [0.19, 0.52], bumpScale: 0.0084 },
  ]
  const rings = ringSpecs.map(({ tone, offset, bumpScale }) => {
    const pal = VIRPOMINEN_WILLOW_PALETTES[tone]
    return makePhysicalCraftMaterial(
      createVirpominenWillowCaneTextures(tone, 'u', [5, 1], offset),
      {
        roughness: pal.roughness,
        bumpScale,
        clearcoat: pal.clearcoat,
        clearcoatRoughness: pal.clearcoatRoughness,
        vertexColors: true,
      },
    )
  }) as [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]

  const baseSide = makePhysicalCraftMaterial(createVirpominenBasketFootTextures([6, 1]), {
    roughness: 0.70,
    bumpScale: 0.0078,
    clearcoat: 0.14,
    clearcoatRoughness: 0.45,
    vertexColors: true,
  })

  const baseFloor = makePhysicalCraftMaterial(createVirpominenBasketFloorTextures(), {
    roughness: 0.72,
    bumpScale: 0.0082,
    clearcoat: 0.13,
    clearcoatRoughness: 0.46,
    vertexColors: true,
  })

  const barkStem = makePhysicalCraftMaterial(createWillowBarkTextures('v', [1, 2.4], [0.08, 0.0]), {
    roughness: 0.72,
    bumpScale: 0.0082,
    clearcoat: 0.14,
    clearcoatRoughness: 0.46,
    specularIntensity: 0.44,
    envMapIntensity: 0.34,
    vertexColors: true,
  })

  const barkFork = makePhysicalCraftMaterial(createWillowBarkTextures('u', [1.8, 1], [0.23, 0.12]), {
    roughness: 0.72,
    bumpScale: 0.0072,
    clearcoat: 0.14,
    clearcoatRoughness: 0.46,
    specularIntensity: 0.44,
    envMapIntensity: 0.34,
    vertexColors: true,
  })

  return { uprights, rings, baseSide, baseFloor, barkStem, barkFork }
}

function writeWarmRecessColor(
  colors: Float32Array,
  vertexIndex: number,
  recess: number,
  warmDrift = 0,
): void {
  const s = THREE.MathUtils.clamp(recess, 0, 1)
  colors[vertexIndex * 3] = THREE.MathUtils.clamp(1.02 - s * 0.24 + warmDrift * 0.036, 0.66, 1.05)
  colors[vertexIndex * 3 + 1] = THREE.MathUtils.clamp(1.00 - s * 0.31 + warmDrift * 0.026, 0.56, 1.04)
  colors[vertexIndex * 3 + 2] = THREE.MathUtils.clamp(0.98 - s * 0.40 + warmDrift * 0.016, 0.44, 1.02)
}

const RING_LOCAL_Y = [-0.07, -0.015, 0.04, 0.095] as const

/**
 * Adds warm weave-recess darkening along a vertical basket upright (`height = 0.20`,
 * centered at world `y = 0.20`, crossed by the 4 woven rings at local `y = -0.07, -0.015, 0.04, 0.095`).
 * Strictly additive `color` attribute; geometry positions, normals and UVs stay untouched.
 */
export function applyBasketUprightShading(geometry: THREE.BufferGeometry, uprightIndex: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const parity = (uprightIndex & 1) === 0 ? 1 : -1

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) // [-0.10, +0.10]
    const h = THREE.MathUtils.clamp((y + 0.10) / 0.20, 0, 1)
    let ringTuck = 0
    for (let r = 0; r < RING_LOCAL_Y.length; r++) {
      const d = Math.abs(y - RING_LOCAL_Y[r]!)
      const proximity = Math.exp(-(d * d) / 0.00055)
      // Alternate over/under warmth across rings & adjacent uprights.
      const under = (((r + uprightIndex) & 1) === 0) ? 0.68 : 0.24
      ringTuck = Math.max(ringTuck, proximity * under)
    }
    const baseShade = (1 - THREE.MathUtils.smoothstep(h, 0.0, 0.34)) * 0.30
    const rimShadow = THREE.MathUtils.smoothstep(h, 0.84, 1.0) * 0.22
    const warmDrift = Math.sin(h * Math.PI * 2 + uprightIndex * 1.13) * 0.55 + parity * 0.22
    writeWarmRecessColor(colors, i, ringTuck + baseShade + rimShadow, warmDrift)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/**
 * Adds periodic over/under weave-recess shading synced to the 32 vertical uprights
 * around a horizontal basket ring (`TorusGeometry` in XY plane before `rotation.x = Math.PI / 2`).
 */
export function applyBasketRingShading(geometry: THREE.BufferGeometry, ringIndex: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)
  const isTopRim = ringIndex === 3
  const heightBias = (1 - ringIndex / 3) * 0.20

  for (let i = 0; i < pos.count; i++) {
    // TorusGeometry lies in local XY; after rotation.x = +PI/2, local +Z maps to world -Y (underside).
    const x = pos.getX(i)
    const y = pos.getY(i)
    const a = Math.atan2(y, x)
    // 32 uprights -> 16 full over/under weave periods around the ring, phase-shifted per row.
    const over = Math.cos(a * 16 + ringIndex * Math.PI)
    const tuck = Math.pow((1 - over) * 0.5, 1.15) * (isTopRim ? 0.42 : 0.72)
    const nz = norm ? norm.getZ(i) : 0
    const underRing = Math.max(0, nz) * 0.28
    const warmDrift = Math.sin(a * 3 + ringIndex * 1.47) * 0.55 + (isTopRim ? 0.16 : 0)
    writeWarmRecessColor(colors, i, tuck + heightBias + underRing, warmDrift)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/**
 * Partitions non-indexed `basket-solid-base` into `[0] side skirt` and `[1] top/bottom caps`
 * material groups and adds warm perimeter recess shading without changing any vertex position.
 */
export function applyBasketBaseGroupsAndShading(geometry: THREE.BufferGeometry): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)

  geometry.clearGroups()
  let runStart = 0
  let runMat = -1

  for (let i = 0; i < pos.count; i += 3) {
    const ny = (norm.getY(i) + norm.getY(i + 1) + norm.getY(i + 2)) / 3
    const matIdx = Math.abs(ny) < 0.5 ? 0 : 1
    if (runMat !== matIdx) {
      if (runMat >= 0) geometry.addGroup(runStart, i - runStart, runMat)
      runStart = i
      runMat = matIdx
    }

    for (let k = 0; k < 3; k++) {
      const vi = i + k
      const x = pos.getX(vi)
      const y = pos.getY(vi)
      const z = pos.getZ(vi)
      const r = Math.hypot(x, z) // CylinderGeometry radius = 1
      if (matIdx === 0) {
        const h = THREE.MathUtils.clamp((y + 0.04) / 0.08, 0, 1)
        const baseShade = (1 - h) * 0.34
        const drift = Math.sin(Math.atan2(z, x) * 3 + 0.5) * 0.45
        writeWarmRecessColor(colors, vi, baseShade, drift)
      } else {
        const edgeShade = THREE.MathUtils.smoothstep(r, 0.72, 1.0) * 0.30
        const underCap = y < 0 ? 0.35 : 0
        const drift = Math.sin(x * 3.1 + z * 2.7) * 0.35
        writeWarmRecessColor(colors, vi, edgeShade + underCap, drift)
      }
    }
  }
  if (runMat >= 0 && runStart < pos.count) {
    geometry.addGroup(runStart, pos.count - runStart, runMat)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/**
 * Adds gentle botanical bark tonal shading along the willow stem or curved forks:
 * slightly deeper weathered chestnut near the lower base/fork crotch, warming gently
 * toward the slender upper twig tips to set off the creamy white pussy-willow buds.
 */
export function applyWillowTwigShading(geometry: THREE.BufferGeometry, kind: 'stem' | 'fork', index = 0): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i++) {
    const along = uv
      ? (kind === 'stem' ? uv.getY(i) : uv.getX(i))
      : THREE.MathUtils.clamp((pos.getY(i) + 0.55) / 1.1, 0, 1)
    const rootShade = (1 - THREE.MathUtils.smoothstep(along, 0.0, 0.32)) * (kind === 'stem' ? 0.28 : 0.32)
    const drift = Math.sin(along * Math.PI * 3 + index * 1.7) * 0.45 + (along - 0.5) * 0.30
    writeWarmRecessColor(colors, i, rootShade, drift)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}
