import * as THREE from 'three'

export type SieveTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type SievePixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

export type BambooSieveMaterials = {
  wall: THREE.MeshPhysicalMaterial
  rim: THREE.MeshPhysicalMaterial
  floor: THREE.MeshPhysicalMaterial
  all: readonly [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
}

const cachedSievePixels = new Map<string, SievePixelBuffers>()

/**
 * Warm Komorebi bamboo-splint palette for the zeniarai washing sieve (zaru):
 * - rice: sun-cured warm rice-bamboo primary splints (bright yet capped below Komorebi clip)
 * - cane: subtle pale green-cane alternating splints (gentle fresh-cured bamboo tint, never garish)
 * - rim: slightly darker roasted-caramel split-bamboo rim hoop & rattan lashing
 * - groove: warm toasted-amber weave recess (never cool grey/olive)
 */
const BAMBOO_PALETTE = {
  riceLight: [228, 204, 146] as const,
  riceMid: [211, 182, 118] as const,
  riceWarm: [219, 191, 128] as const,

  caneLight: [220, 206, 144] as const,
  caneMid: [200, 184, 118] as const,
  caneWarm: [212, 192, 124] as const,

  grooveDark: [136, 96, 48] as const,
  underWeave: [184, 150, 92] as const,

  rimLight: [198, 156, 98] as const,
  rimMid: [172, 128, 72] as const,
  rimWarm: [184, 140, 82] as const,
  rimDark: [112, 74, 36] as const,
  lashMid: [122, 82, 42] as const,
  lashLight: [148, 104, 56] as const,
}

function sieveHash(ix: number, iy: number, seed: number): number {
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
  const a = sieveHash(x0, y0, seed)
  const b = sieveHash(x1, y0, seed)
  const c = sieveHash(x0, y1, seed)
  const d = sieveHash(x1, y1, seed)
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

function mixRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  const k = THREE.MathUtils.clamp(t, 0, 1)
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ]
}

/**
 * Evaluates a single bamboo splint surface color, height and roughness contribution.
 * `along` runs along the splint length; `across` runs across the splint width [0..1];
 * `arch` [0..1] is the over/under crown elevation (1 at crossing crest, 0 tucked under).
 */
function sampleBambooSplint(
  along: number,
  across: number,
  arch: number,
  isGreenCane: boolean,
  seed: number,
): { rgb: [number, number, number]; height: number; rough: number } {
  const tau = Math.PI * 2
  // Rounded cross-section bevel on each flat split-bamboo strip with crisp edge recess.
  const edgeDist = Math.min(across, 1 - across)
  const stripBevel = THREE.MathUtils.smoothstep(edgeDist, 0.03, 0.20)
  const stripGap = 1 - stripBevel

  // Subtle longitudinal bamboo vascular striations running strictly along the splint.
  const fiberWave = Math.sin(across * tau * 3.0 + Math.sin(along * tau) * 0.25 + seed) * 0.52
    + (periodicNoise(along * 2, across * 8, 2, 8, seed + 19) - 0.5) * 0.85
  const bakeDrift = periodicNoise(along * 2, across * 2, 2, 2, seed + 41)

  const mid = isGreenCane ? BAMBOO_PALETTE.caneMid : BAMBOO_PALETTE.riceMid
  const warm = isGreenCane ? BAMBOO_PALETTE.caneWarm : BAMBOO_PALETTE.riceWarm
  const light = isGreenCane ? BAMBOO_PALETTE.caneLight : BAMBOO_PALETTE.riceLight

  let rgb = mixRgb(mid, warm, bakeDrift * 0.65)
  const crestLift = Math.max(0, arch - 0.45) * 0.92 + Math.max(0, fiberWave) * 0.28
  rgb = mixRgb(rgb, light, crestLift * stripBevel * 0.72)

  // Warm caramel-amber tuck where a splint dips beneath a crossing splint or meets a gap.
  const underTuck = Math.pow(1 - THREE.MathUtils.clamp(arch, 0, 1), 1.35) * 0.66
  const fiberFurrow = Math.max(0, -fiberWave) * 0.20
  const shade = THREE.MathUtils.clamp(underTuck + stripGap * 0.72 + fiberFurrow * stripBevel, 0, 0.88)
  rgb = mixRgb(rgb, BAMBOO_PALETTE.grooveDark, shade)

  const height = THREE.MathUtils.clamp(
    0.16 + stripBevel * (0.28 + arch * 0.50 + fiberWave * 0.08),
    0.06,
    0.96,
  )
  // Smooth waxy bamboo outer rind on raised crowns vs matte recessed crevices.
  const rough = THREE.MathUtils.clamp(
    0.86 - stripBevel * arch * 0.20 + stripGap * 0.14 + underTuck * 0.12,
    0.62,
    0.98,
  )
  return { rgb, height, rough }
}

/**
 * Stylized bamboo-splint basket weave for the curved outer and inner walls of
 * `wash-sieve` (`v = 0` at floor base, `v = 1` at the top rim).
 *
 * - Lower 78% (`v ∈ [0, 0.78]`): 3 crisp horizontal weft bamboo courses weaving
 *   over/under 4 radial ribs per tile (24 ribs around the bowl at `repeat.x = 6`),
 *   alternating warm rice-bamboo with a subtle green-cane bamboo-rind tint.
 * - Top 22% (`v ∈ [0.78, 1.0]`): slightly darker toasted split-bamboo rim hoop
 *   collar with a recessed underside clamping groove and periodic rattan lashing.
 */
export function createSieveWallTextures(
  repeat: readonly [number, number] = [6, 1],
): SieveTextureSet {
  const size = 256
  const cacheKey = 'zeniarai-sieve-wall-v1'
  let cached = cachedSievePixels.get(cacheKey)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const rimStart = 0.78

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        let rgb: [number, number, number]
        let height: number
        let rough: number

        if (v >= rimStart) {
          // Slightly darker toasted-bamboo rim hoop collar clamping the top weave edge.
          const rv = (v - rimStart) / (1 - rimStart) // 0 at underside seam, 1 at top edge
          const seamDip = (1 - THREE.MathUtils.smoothstep(rv, 0.0, 0.22)) * 0.85
          const crownArch = Math.sin(THREE.MathUtils.clamp(rv, 0, 1) * Math.PI)
          const grain = Math.sin(rv * tau * 2.5 + Math.sin(u * tau) * 0.2) * 0.35
            + (periodicNoise(u * 2, rv * 6, 2, 6, 307) - 0.5) * 0.65
          const bake = periodicNoise(u * 2, rv * 2, 2, 2, 313)

          rgb = mixRgb(BAMBOO_PALETTE.rimMid, BAMBOO_PALETTE.rimWarm, bake * 0.6)
          rgb = mixRgb(rgb, BAMBOO_PALETTE.rimLight, (crownArch * 0.55 + Math.max(0, grain) * 0.25) * (1 - seamDip))
          rgb = mixRgb(rgb, BAMBOO_PALETTE.rimDark, THREE.MathUtils.clamp(seamDip + Math.max(0, -grain) * 0.25, 0, 0.9))

          // Periodic dark-caramel rattan lashing binding (1 crisp wrap per tile = 6 around bowl).
          const lashDelta = Math.abs(((u + 0.5) % 1) - 0.5)
          const lashMask = 1 - THREE.MathUtils.smoothstep(lashDelta, 0.032, 0.068)
          if (lashMask > 0.001) {
            const lashRidge = 0.5 + 0.5 * Math.cos(lashDelta / 0.068 * Math.PI)
            const lashCol = mixRgb(BAMBOO_PALETTE.lashMid, BAMBOO_PALETTE.lashLight, lashRidge * crownArch * 0.7)
            rgb = mixRgb(rgb, lashCol, lashMask * 0.88)
          }

          height = THREE.MathUtils.clamp(0.46 + crownArch * 0.36 - seamDip * 0.42 + grain * 0.06 + lashMask * 0.12, 0.08, 0.96)
          rough = THREE.MathUtils.clamp(0.76 - crownArch * 0.14 + seamDip * 0.20 + lashMask * 0.08, 0.58, 0.98)
        } else {
          // 4 vertical ribs x 3 horizontal courses per tile (at repeat.x = 6 -> 24 radial ribs x 3 courses).
          const cols = 4
          const rows = 3
          const wv = v / rimStart
          const gx = u * cols
          const gy = wv * rows
          const ix = Math.floor(gx)
          const iy = Math.floor(gy)
          const fx = gx - ix
          const fy = gy - iy

          // Classic alternating over/under plain weave (pick-and-press).
          const weftOver = ((ix + iy) & 1) === 0
          const weftArch = weftOver
            ? 0.54 + 0.46 * Math.sin(fx * Math.PI)
            : 0.12 + 0.32 * Math.sin(fx * Math.PI)
          const warpArch = weftOver
            ? 0.12 + 0.32 * Math.sin(fy * Math.PI)
            : 0.54 + 0.46 * Math.sin(fy * Math.PI)

          // Alternate subtle green-cane tint on selected courses/ribs for natural hand-selected bamboo variety.
          const weftIsGreen = iy === 1
          const warpIsGreen = (ix & 1) === 1
          const weft = sampleBambooSplint(u, fy, weftArch, weftIsGreen, 101 + iy * 37)
          const warp = sampleBambooSplint(wv, fx, warpArch, warpIsGreen, 211 + ix * 43)

          // Soft smooth blend inside narrow inter-splint margins so transitions stay mip-clean.
          const weftEdge = THREE.MathUtils.smoothstep(Math.min(fy, 1 - fy), 0.03, 0.13)
          const warpEdge = THREE.MathUtils.smoothstep(Math.min(fx, 1 - fx), 0.03, 0.13)
          const useWeft = weftOver
            ? THREE.MathUtils.clamp(weftEdge + (1 - warpEdge) * 0.5, 0, 1)
            : THREE.MathUtils.clamp(1 - warpEdge, 0, 1)

          rgb = mixRgb(warp.rgb, weft.rgb, useWeft)
          height = THREE.MathUtils.lerp(warp.height, weft.height, useWeft)
          rough = THREE.MathUtils.lerp(warp.rough, weft.rough, useWeft)

          // Subtle rim overhang shadow directly below the bamboo hoop collar (`v` approaching `rimStart`).
          const underRimShade = THREE.MathUtils.smoothstep(wv, 0.88, 1.0) * 0.42
          rgb = mixRgb(rgb, BAMBOO_PALETTE.grooveDark, underRimShade)
          height = Math.max(0.08, height - underRimShade * 0.18)
          rough = Math.min(0.98, rough + underRimShade * 0.14)
        }

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(rgb[0]), 0, 232)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(rgb[1]), 0, 212)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(rgb[2]), 0, 160)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(height * 255), 18, 245)
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(rough * 255), 148, 252)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedSievePixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat),
  }
}

/**
 * Slightly darker toasted split-bamboo rim hoop texture for the flat top lip
 * of `wash-sieve`, aligned in circumferential `u` phase with the wall rim collar.
 */
export function createSieveRimTextures(
  repeat: readonly [number, number] = [6, 1],
): SieveTextureSet {
  const size = 256
  const cacheKey = 'zeniarai-sieve-rim-v1'
  let cached = cachedSievePixels.get(cacheKey)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2

    for (let y = 0; y < size; y++) {
      const v = y / size // 0 outer rim edge -> 1 inner rim edge
      const crown = Math.sin(v * Math.PI)
      const edgeBevel = Math.pow(1 - crown, 1.5)
      for (let x = 0; x < size; x++) {
        const u = x / size
        const grain = Math.sin(v * tau * 3.0 + Math.sin(u * tau) * 0.25) * 0.40
          + (periodicNoise(u * 2, v * 8, 2, 8, 409) - 0.5) * 0.62
        const bake = periodicNoise(u * 2, v * 2, 2, 2, 421)

        let rgb = mixRgb(BAMBOO_PALETTE.rimMid, BAMBOO_PALETTE.rimWarm, bake * 0.6)
        rgb = mixRgb(rgb, BAMBOO_PALETTE.rimLight, (crown * 0.62 + Math.max(0, grain) * 0.24) * (1 - edgeBevel * 0.6))
        rgb = mixRgb(rgb, BAMBOO_PALETTE.rimDark, THREE.MathUtils.clamp(edgeBevel * 0.58 + Math.max(0, -grain) * 0.26, 0, 0.88))

        // Matching periodic dark-caramel rattan lashing wrap aligned to wall collar (`u = 0`).
        const lashDelta = Math.abs(((u + 0.5) % 1) - 0.5)
        const lashMask = 1 - THREE.MathUtils.smoothstep(lashDelta, 0.032, 0.068)
        if (lashMask > 0.001) {
          const lashRidge = 0.5 + 0.5 * Math.cos(lashDelta / 0.068 * Math.PI)
          const lashCol = mixRgb(BAMBOO_PALETTE.lashMid, BAMBOO_PALETTE.lashLight, lashRidge * crown * 0.72)
          rgb = mixRgb(rgb, lashCol, lashMask * 0.88)
        }

        const height = THREE.MathUtils.clamp(0.40 + crown * 0.44 + grain * 0.06 + lashMask * 0.14, 0.12, 0.96)
        const rough = THREE.MathUtils.clamp(0.74 - crown * 0.15 + edgeBevel * 0.18 + lashMask * 0.08, 0.56, 0.98)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(rgb[0]), 0, 212)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(rgb[1]), 0, 174)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(rgb[2]), 0, 118)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(height * 255), 24, 245)
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(rough * 255), 144, 250)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedSievePixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat),
  }
}

/**
 * Hole-aligned orthogonal bamboo-splint weave (yotsume-ami) for the perforated
 * floor of `wash-sieve`.
 *
 * Mapped with `u = (x + 0.045) / 0.36`, `v = (z + 0.045) / 0.36` so the tile's
 * 4x4 grid of 0.09-unit bands matches the exact 3x3 square holes (`x,z in {-0.18,0,0.18}`):
 * - Odd `u` bands (`[0.25,0.50)`, `[0.75,1.00)`): Z-running bamboo splints
 * - Odd `v` bands (`[0.25,0.50)`, `[0.75,1.00)`): X-running bamboo splints
 * - (Odd, Odd) intersections: alternating over/under bamboo-splint crossings
 * - (Even, Even) cells: real open holes in the interior, and warm recessed
 *   bamboo under-weave in the tiny slivers near the outer circular rim.
 */
export function createSieveFloorTextures(): SieveTextureSet {
  const size = 256
  const cacheKey = 'zeniarai-sieve-floor-v1'
  let cached = cachedSievePixels.get(cacheKey)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)

    for (let y = 0; y < size; y++) {
      const v = y / size
      const gy = v * 4
      const iy = Math.floor(gy) // 0,2 = hole row; 1,3 = X-splint row
      const fy = gy - iy
      for (let x = 0; x < size; x++) {
        const u = x / size
        const gx = u * 4
        const ix = Math.floor(gx) // 0,2 = hole col; 1,3 = Z-splint col
        const fx = gx - ix

        const inZSplint = (ix & 1) === 1
        const inXSplint = (iy & 1) === 1
        let rgb: [number, number, number]
        let height: number
        let rough: number

        if (inZSplint && inXSplint) {
          // Crossing intersection between an X-splint and a Z-splint.
          const zOver = (((ix + iy) >> 1) & 1) === 1
          const zArch = zOver ? 0.62 + 0.38 * Math.sin(fy * Math.PI) : 0.14 + 0.28 * Math.sin(fy * Math.PI)
          const xArch = zOver ? 0.14 + 0.28 * Math.sin(fx * Math.PI) : 0.62 + 0.38 * Math.sin(fx * Math.PI)
          const zSample = sampleBambooSplint(v, fx, zArch, ix === 3, 503 + ix * 29)
          const xSample = sampleBambooSplint(u, fy, xArch, iy === 1, 607 + iy * 31)

          const zEdge = THREE.MathUtils.smoothstep(Math.min(fx, 1 - fx), 0.02, 0.10)
          const xEdge = THREE.MathUtils.smoothstep(Math.min(fy, 1 - fy), 0.02, 0.10)
          const useZ = zOver
            ? THREE.MathUtils.clamp(zEdge + (1 - xEdge) * 0.4, 0, 1)
            : THREE.MathUtils.clamp(1 - xEdge, 0, 1)

          rgb = mixRgb(xSample.rgb, zSample.rgb, useZ)
          height = THREE.MathUtils.lerp(xSample.height, zSample.height, useZ)
          rough = THREE.MathUtils.lerp(xSample.rough, zSample.rough, useZ)
        } else if (inZSplint) {
          // Pure Z-running splint bridging between two holes.
          // Arch gently dips toward the crossing seams where it passes under.
          const nextCrossingZOver = (((ix + ((iy + 1) & 3)) >> 1) & 1) === 1
          const prevCrossingZOver = (((ix + ((iy + 3) & 3)) >> 1) & 1) === 1
          const endLow = fy < 0.5
            ? (prevCrossingZOver ? 0.64 : 0.30)
            : (nextCrossingZOver ? 0.64 : 0.30)
          const midFactor = Math.sin(fy * Math.PI)
          const arch = THREE.MathUtils.lerp(endLow, 0.72, midFactor)
          const sample = sampleBambooSplint(v, fx, arch, ix === 3, 503 + ix * 29)
          rgb = sample.rgb
          height = sample.height
          rough = sample.rough
        } else if (inXSplint) {
          // Pure X-running splint bridging between two holes.
          const nextCrossingXOver = (((((ix + 1) & 3) + iy) >> 1) & 1) === 0
          const prevCrossingXOver = (((((ix + 3) & 3) + iy) >> 1) & 1) === 0
          const endLow = fx < 0.5
            ? (prevCrossingXOver ? 0.64 : 0.30)
            : (nextCrossingXOver ? 0.64 : 0.30)
          const midFactor = Math.sin(fx * Math.PI)
          const arch = THREE.MathUtils.lerp(endLow, 0.72, midFactor)
          const sample = sampleBambooSplint(u, fy, arch, iy === 1, 607 + iy * 31)
          rgb = sample.rgb
          height = sample.height
          rough = sample.rough
        } else {
          // (Even, Even) cells: real open holes in the interior; warm recessed bamboo
          // under-layer in the tiny crescent slivers right next to the outer bowl wall.
          const n = periodicNoise(u * 6, v * 6, 6, 6, 709)
          rgb = mixRgb(BAMBOO_PALETTE.grooveDark, BAMBOO_PALETTE.underWeave, 0.42 + n * 0.34)
          height = 0.24 + n * 0.14
          rough = 0.92
        }

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(rgb[0]), 0, 230)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(rgb[1]), 0, 210)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(rgb[2]), 0, 158)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(height * 255), 18, 245)
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(rough * 255), 152, 252)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedSievePixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace),
  }
}

function makeBambooMaterial(
  tex: SieveTextureSet,
  opts: { roughness: number; bumpScale: number; clearcoat: number; clearcoatRoughness: number },
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
    specularIntensity: 0.46,
    // Restrained envMapIntensity keeps sunlit rice-bamboo creamy and shadows caramel-warm.
    envMapIntensity: 0.35,
    vertexColors: true,
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

/**
 * Builds the three harmonized bamboo-splint materials for `wash-sieve`:
 * `[0] wall` (crossed basket weave + darker top rim collar),
 * `[1] rim` (toasted split-bamboo rim hoop with rattan lashing),
 * `[2] floor` (hole-aligned orthogonal yotsume bamboo weave).
 */
export function createBambooSieveMaterials(): BambooSieveMaterials {
  const wall = makeBambooMaterial(createSieveWallTextures([6, 1]), {
    roughness: 0.72,
    bumpScale: 0.0082,
    clearcoat: 0.14,
    clearcoatRoughness: 0.46,
  })
  const rim = makeBambooMaterial(createSieveRimTextures([6, 1]), {
    roughness: 0.66,
    bumpScale: 0.0072,
    clearcoat: 0.18,
    clearcoatRoughness: 0.42,
  })
  const floor = makeBambooMaterial(createSieveFloorTextures(), {
    roughness: 0.74,
    bumpScale: 0.0078,
    clearcoat: 0.13,
    clearcoatRoughness: 0.48,
  })
  return { wall, rim, floor, all: [wall, rim, floor] as const }
}

/**
 * Converts a normalized recess depth [0..1] into a warm toasted-caramel vertex tint
 * so bowl corners, outer underside, and inner hole edges stay warm instead of grey.
 */
export function warmBambooTint(recess: number, warmDrift = 0): [number, number, number] {
  const s = THREE.MathUtils.clamp(recess, 0, 1)
  return [
    THREE.MathUtils.clamp(1.00 - s * 0.24 + warmDrift * 0.032, 0.66, 1.03),
    THREE.MathUtils.clamp(0.99 - s * 0.30 + warmDrift * 0.024, 0.56, 1.02),
    THREE.MathUtils.clamp(0.97 - s * 0.38 + warmDrift * 0.014, 0.44, 1.00),
  ]
}
