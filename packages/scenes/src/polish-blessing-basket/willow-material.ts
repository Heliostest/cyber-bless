import * as THREE from 'three'

export type WillowTone = 0 | 1 | 2

export type WillowTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type WillowPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

type WillowPalette = {
  /** Sunlit raised cane epidermis ridge (capped softly for Komorebi daylight). */
  light: readonly [number, number, number]
  /** Main steamed-willow body tone. */
  mid: readonly [number, number, number]
  /** Warm honey-amber wash along the rod. */
  warm: readonly [number, number, number]
  /** Warm toasted-caramel longitudinal fiber groove (never cool olive/grey). */
  dark: readonly [number, number, number]
  /** Subtle warm pith / bud-node amber accent. */
  pith: readonly [number, number, number]
  seed: number
  /** Base roughness multiplied by the linear roughnessMap (~0.70..0.98). */
  roughness: number
  /** Soft waxy steamed-willow satin sheen (restrained for Komorebi daylight). */
  clearcoat: number
  clearcoatRoughness: number
}

/**
 * Three warm baked/steamed Polish willow tones (wiklina) harmonized with the
 * honey-oak tabletop and crisp cream linen. Richer golden-amber chroma keeps
 * the shaded basket wall cozy and caramel-warm under Komorebi's cool sky/rim
 * bounce rather than drifting olive-taupe, while capping sunlit peaks below
 * Komorebi's linear clip shoulder.
 */
export const WILLOW_PALETTES: Record<WillowTone, WillowPalette> = {
  0: {
    light: [216, 162, 98],
    mid: [192, 134, 74],
    warm: [208, 149, 85],
    dark: [134, 82, 40],
    pith: [152, 96, 48],
    seed: 109,
    roughness: 0.68,
    clearcoat: 0.16,
    clearcoatRoughness: 0.44,
  },
  1: {
    light: [232, 188, 120],
    mid: [213, 166, 98],
    warm: [225, 178, 108],
    dark: [156, 108, 56],
    pith: [173, 121, 64],
    seed: 211,
    roughness: 0.65,
    clearcoat: 0.20,
    clearcoatRoughness: 0.40,
  },
  2: {
    light: [238, 203, 144],
    mid: [224, 186, 124],
    warm: [233, 196, 133],
    dark: [170, 127, 74],
    pith: [186, 140, 82],
    seed: 317,
    roughness: 0.67,
    clearcoat: 0.17,
    clearcoatRoughness: 0.43,
  },
}

const cachedWillowPixels = new Map<string, WillowPixelBuffers>()

function willowHash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicWillowNoise(x: number, y: number, px: number, py: number, seed: number): number {
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
  const a = willowHash(x0, y0, seed)
  const b = willowHash(x1, y0, seed)
  const c = willowHash(x0, y1, seed)
  const d = willowHash(x1, y1, seed)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}

function wrapUnitDelta(a: number, b: number): number {
  let d = a - b
  if (d > 0.5) d -= 1
  else if (d < -0.5) d += 1
  return d
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
 * Deterministic stylized steamed-willow cane textures (256x256, zero DOM dependency).
 * Three.js TubeGeometry & TorusGeometry map `u` along the strand length and `v`
 * around the strand cross-section, so longitudinal vascular ridges and tonal wash
 * naturally follow every curved oval weft, vertical warp, rim hoop, handle arch
 * and tie ring without Cartesian projection distortion.
 *
 * Uses clean, well-spaced stylized cane flutes (~4 primary vascular ribs around
 * the circumference so ~2 clear, soft ribbons remain crisp and mip-stable across
 * 5-10px mobile strands) paired with elongated cortex streaks and baked-willow
 * tonal drift along the rod.
 */
export function createWillowCaneTextures(
  tone: WillowTone,
  repeat?: readonly [number, number],
  offset?: readonly [number, number],
): WillowTextureSet {
  const size = 256
  const cacheKey = `cane-${tone}-v2`
  let cached = cachedWillowPixels.get(cacheKey)
  if (!cached) {
    const pal = WILLOW_PALETTES[tone]
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const phaseA = willowHash(pal.seed, 17, 3) * tau
    const phaseB = willowHash(pal.seed, 31, 7) * tau

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size

        // Gentle natural willow fiber meander along the bent rod length `u`.
        const meander = Math.sin(u * tau + phaseA) * 0.048
          + (periodicWillowNoise(u * 2, v * 3, 2, 3, pal.seed + 13) - 0.5) * 0.068
        const vw = v + meander

        // Clean stylized cane flutes (4 broad rounded ribs + 8 secondary vascular grooves
        // around circumference) stay crisp & legible on handle/rim/weave at mobile card scale.
        const primaryFlute = Math.sin(vw * tau * 4 + phaseB)
        const secondaryFlute = Math.sin(vw * tau * 8 + phaseB * 1.55 + 0.65)
        const fluteWave = 0.66 * primaryFlute + 0.34 * secondaryFlute
        const fluteBreath = 0.74 + 0.42 * periodicWillowNoise(u * 2, v * 4, 2, 4, pal.seed + 29)
        const flutes = fluteWave * fluteBreath

        // Elongated longitudinal willow cortex streaks (1:6 aspect along `u` vs around `v`).
        const streakField = periodicWillowNoise(u * 2, vw * 12, 2, 12, pal.seed + 47) - 0.5
        const fineWave = Math.sin(vw * tau * 12 + periodicWillowNoise(u * 2, v * 4, 2, 4, pal.seed + 61) * 1.2)
        const fineFibers = streakField * 0.96 + fineWave * 0.24

        // Broad warm baked-willow tonal variation along the rod length `u`.
        const bakeWave = 0.5 + 0.5 * Math.sin(u * tau + phaseA * 1.25)
        const bakeNoise = periodicWillowNoise(u * 2, v * 2, 2, 2, pal.seed + 79)
        const warmMix = THREE.MathUtils.clamp(bakeWave * 0.56 + bakeNoise * 0.44, 0, 1)

        // Subtle botanical willow bud-scar / toasted pith warmth (elongated along `u`).
        const pithField = periodicWillowNoise(u * 3, v * 4, 3, 4, pal.seed + 101)
        const pithMask = THREE.MathUtils.smoothstep(pithField, 0.66, 0.89) * 0.34

        // Signed longitudinal ridge/furrow signal with clear stylized dark fiber grooves.
        const fiberSignal = THREE.MathUtils.clamp(flutes * 0.62 + fineFibers * 0.48, -1, 1)
        const ridge = Math.max(0, fiberSignal)
        const furrow = Math.max(0, -fiberSignal)

        const baseR = THREE.MathUtils.lerp(pal.mid[0], pal.warm[0], warmMix)
        const baseG = THREE.MathUtils.lerp(pal.mid[1], pal.warm[1], warmMix)
        const baseB = THREE.MathUtils.lerp(pal.mid[2], pal.warm[2], warmMix)

        // Raised epidermis catches creamy honey warmth; fiber furrows tuck into toasted caramel.
        const liftedR = THREE.MathUtils.lerp(baseR, pal.light[0], ridge * 0.72)
        const liftedG = THREE.MathUtils.lerp(baseG, pal.light[1], ridge * 0.72)
        const liftedB = THREE.MathUtils.lerp(baseB, pal.light[2], ridge * 0.70)

        const groovePow = Math.pow(furrow, 0.96)
        const shadedR = THREE.MathUtils.lerp(liftedR, pal.dark[0], groovePow * 0.86)
        const shadedG = THREE.MathUtils.lerp(liftedG, pal.dark[1], groovePow * 0.88)
        const shadedB = THREE.MathUtils.lerp(liftedB, pal.dark[2], groovePow * 0.90)

        const finalR = THREE.MathUtils.lerp(shadedR, pal.pith[0], pithMask)
        const finalG = THREE.MathUtils.lerp(shadedG, pal.pith[1], pithMask)
        const finalB = THREE.MathUtils.lerp(shadedB, pal.pith[2], pithMask)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(finalR), 0, 238)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(finalG), 0, 208)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(finalB), 0, 154)
        color[idx + 3] = 255

        // Sculpted smooth cane flutes + fine vascular furrows for soft grazing light relief.
        const h = THREE.MathUtils.clamp(
          Math.round(128 + flutes * 46 + fineFibers * 24 - pithMask * 18),
          36,
          220,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        // Smooth waxy raised willow epidermis (~0.70 multiplier) vs matte fiber grooves (~0.98).
        const rVal = THREE.MathUtils.clamp(
          Math.round(214 - ridge * 36 + furrow * 34 + pithMask * 20),
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
    cachedWillowPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat, offset),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat, offset),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat, offset),
  }
}

/**
 * Coiled hand-plaited willow medallion texture mapped onto SphereGeometry's `+Z`
 * front face `(u = 0.25, v = 0.50)`. Leaves the shared SphereGeometry untouched
 * while turning the quiet medallion from a smooth pebble into a warm coiled willow rosette.
 */
export function createWillowMedallionTextures(): WillowTextureSet {
  const size = 256
  const cacheKey = 'medallion-coiled-v2'
  let cached = cachedWillowPixels.get(cacheKey)
  if (!cached) {
    const pal = WILLOW_PALETTES[2]
    const warmPal = WILLOW_PALETTES[1]
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2

    for (let y = 0; y < size; y++) {
      const v = y / size
      const dv = (v - 0.5) * 2.0
      for (let x = 0; x < size; x++) {
        const u = x / size
        const du = wrapUnitDelta(u, 0.25) * 4.0
        const r = Math.hypot(du, dv)
        const theta = Math.atan2(dv, du)
        const frontMask = 1 - THREE.MathUtils.smoothstep(r, 0.94, 1.18)

        // Spiral coiled willow rounds (4.5 visible coils from center to rim).
        const spiralPhase = r * 4.5 + (theta / tau) * 1.0
        const coilFrac = spiralPhase - Math.floor(spiralPhase)
        const coilArch = Math.sin(coilFrac * Math.PI) // 0 in coil crease, 1 on coil crown
        const coilCrease = Math.pow(1 - coilArch, 1.55)

        // Subtle longitudinal cane grain following each coil + gentle radial lashing stitches.
        const tangFiber = Math.sin((coilFrac * 3.0 + Math.sin(theta * 2.0) * 0.14) * tau) * 0.24
          + (periodicWillowNoise(u * 4, v * 12, 4, 12, 419) - 0.5) * 0.42
        const stitchWave = Math.pow(Math.max(0, Math.cos(theta * 14 + Math.floor(spiralPhase) * 0.9)), 6.0)
        const radialLash = stitchWave * THREE.MathUtils.smoothstep(r, 0.26, 0.42) * 0.28

        // Soft toasted rim bezel & alternating warm-buff coil tint.
        const coilAlt = 0.5 + 0.5 * Math.sin(Math.floor(spiralPhase) * 2.1 + 0.4)
        const rimShade = THREE.MathUtils.smoothstep(r, 0.72, 1.02) * 0.30
        const bake = periodicWillowNoise(u * 3, v * 3, 3, 3, 433)

        const baseR = THREE.MathUtils.lerp(pal.mid[0], warmPal.warm[0], coilAlt * 0.45 + bake * 0.25)
        const baseG = THREE.MathUtils.lerp(pal.mid[1], warmPal.warm[1], coilAlt * 0.45 + bake * 0.25)
        const baseB = THREE.MathUtils.lerp(pal.mid[2], warmPal.warm[2], coilAlt * 0.45 + bake * 0.25)

        const crestBoost = Math.max(0, coilArch - 0.55) * 0.95 + Math.max(0, tangFiber) * 0.35 + radialLash * 0.40
        const dip = (coilCrease * 0.76 + Math.max(0, -tangFiber) * 0.28 + rimShade) * frontMask

        const lR = THREE.MathUtils.lerp(baseR, pal.light[0], THREE.MathUtils.clamp(crestBoost * frontMask, 0, 0.65))
        const lG = THREE.MathUtils.lerp(baseG, pal.light[1], THREE.MathUtils.clamp(crestBoost * frontMask, 0, 0.65))
        const lB = THREE.MathUtils.lerp(baseB, pal.light[2], THREE.MathUtils.clamp(crestBoost * frontMask, 0, 0.65))

        const fR = THREE.MathUtils.lerp(lR, warmPal.dark[0], THREE.MathUtils.clamp(dip, 0, 0.86))
        const fG = THREE.MathUtils.lerp(lG, warmPal.dark[1], THREE.MathUtils.clamp(dip, 0, 0.86))
        const fB = THREE.MathUtils.lerp(lB, warmPal.dark[2], THREE.MathUtils.clamp(dip, 0, 0.86))

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(fR), 0, 238)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(fG), 0, 206)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(fB), 0, 150)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + ((coilArch - 0.5) * 68 + tangFiber * 20 + radialLash * 26) * frontMask),
          42,
          214,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(
          Math.round(212 + (coilCrease * 34 - Math.max(0, coilArch - 0.6) * 34) * frontMask),
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
    cachedWillowPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace),
  }
}

function makeWillowMaterial(
  tone: WillowTone,
  tex: WillowTextureSet,
  opts: { vertexColors: boolean; bumpScale: number; clearcoatScale?: number },
): THREE.MeshPhysicalMaterial {
  const pal = WILLOW_PALETTES[tone]
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale: opts.bumpScale,
    roughnessMap: tex.roughness,
    roughness: pal.roughness,
    metalness: 0,
    clearcoat: pal.clearcoat * (opts.clearcoatScale ?? 1),
    clearcoatRoughness: pal.clearcoatRoughness,
    specularIntensity: 0.52,
    // Restrained envMapIntensity keeps warm honey willow shadows from picking up cool sky/grass tint.
    envMapIntensity: 0.36,
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

export type BasketWillowMaterials = {
  weft: readonly [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
  warp: readonly [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
  bottom: THREE.MeshPhysicalMaterial
  rim: readonly [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
  handle: readonly [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
  tie: THREE.MeshPhysicalMaterial
  medallion: THREE.MeshPhysicalMaterial
}

/**
 * Creates the full stylized willow material suite with UV-repeat proportions matched
 * to each structural component's real tube/torus aspect ratio, ensuring consistent
 * cane fiber scale and waxy satin sheen across wall weave, rim hoops, twin handle,
 * tie rings, bottom, and coiled medallion.
 */
export function createBasketWillowMaterials(): BasketWillowMaterials {
  const tones: readonly WillowTone[] = [0, 1, 2]
  const weft = tones.map((tone) =>
    makeWillowMaterial(tone, createWillowCaneTextures(tone, [5, 1], [tone * 0.19, 0]), {
      vertexColors: true,
      bumpScale: 0.0072,
    }),
  ) as [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]

  const warp = tones.map((tone) =>
    makeWillowMaterial(tone, createWillowCaneTextures(tone, [1, 1], [tone * 0.31, 0.12]), {
      vertexColors: true,
      bumpScale: 0.0072,
    }),
  ) as [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]

  const bottom = makeWillowMaterial(0, createWillowCaneTextures(0, [5, 1]), {
    vertexColors: false,
    bumpScale: 0.0052,
    clearcoatScale: 0.7,
  })

  // `repeatV = 1.0` keeps 2 broad, crisp cane ribbons across the visible front of each rim & handle rod.
  const rim = [
    makeWillowMaterial(1, createWillowCaneTextures(1, [6, 1.0], [0.06, 0.08]), {
      vertexColors: true,
      bumpScale: 0.0082,
    }),
    makeWillowMaterial(1, createWillowCaneTextures(1, [6, 1.0], [0.43, 0.52]), {
      vertexColors: true,
      bumpScale: 0.0082,
    }),
  ] as const

  const handle = [
    makeWillowMaterial(0, createWillowCaneTextures(0, [4.5, 1.0], [0.11, 0.0]), {
      vertexColors: true,
      bumpScale: 0.0088,
    }),
    makeWillowMaterial(2, createWillowCaneTextures(2, [4.5, 1.0], [0.37, 0.35]), {
      vertexColors: true,
      bumpScale: 0.0088,
    }),
  ] as const

  const tie = makeWillowMaterial(0, createWillowCaneTextures(0, [1.2, 0.85], [0.22, 0]), {
    vertexColors: true,
    bumpScale: 0.0062,
    clearcoatScale: 0.85,
  })

  const medallion = makeWillowMaterial(2, createWillowMedallionTextures(), {
    vertexColors: false,
    bumpScale: 0.0074,
    clearcoatScale: 0.9,
  })

  return { weft, warp, bottom, rim, handle, tie, medallion }
}

/**
 * Converts a normalized recess depth [0..1] into a warm toasted-caramel vertex tint.
 * Shadows drop blue significantly faster than red so woven willow recesses glow
 * warm honey-umber under Komorebi daylight instead of muddy grey/olive.
 */
function writeWarmRecessColor(
  colors: Float32Array,
  vertexIndex: number,
  recess: number,
  warmDrift = 0,
): void {
  const s = THREE.MathUtils.clamp(recess, 0, 1)
  const r = THREE.MathUtils.clamp(1.02 - s * 0.24 + warmDrift * 0.036, 0.68, 1.05)
  const g = THREE.MathUtils.clamp(1.005 - s * 0.31 + warmDrift * 0.028, 0.58, 1.04)
  const b = THREE.MathUtils.clamp(0.985 - s * 0.40 + warmDrift * 0.018, 0.46, 1.02)
  colors[vertexIndex * 3] = r
  colors[vertexIndex * 3 + 1] = g
  colors[vertexIndex * 3 + 2] = b
}

/**
 * Adds subtle warm weave-recess ambient darkening along a horizontal weft tube
 * (strictly additive `color` attribute; geometry positions, normals, UVs and
 * topology remain untouched).
 */
export function applyWeftRecessShading(
  geometry: THREE.BufferGeometry,
  row: number,
  totalRows: number,
  rx: number,
  rz: number,
): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)
  const h = row / Math.max(totalRows - 1, 1)
  // Gentle vertical grounding: lower basket wall tucked in tabletop bounce, upper rows warm.
  const baseShade = (1 - THREE.MathUtils.smoothstep(h, 0.0, 0.42)) * 0.24
  const rimLipShade = THREE.MathUtils.smoothstep(h, 0.86, 1.0) * 0.18

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const a = Math.atan2(z / rz, x / rx)
    // Match exact geometric over/under wave: +1 arches outward over stakes, -1 tucks into recess.
    const over = Math.cos(a * 32 + row * Math.PI)
    const tuck = Math.pow((1 - over) * 0.5, 1.2)
    const ny = norm ? norm.getY(i) : 0
    const interRowGroove = Math.max(0, -ny) * 0.18 + Math.max(0, ny) * 0.06
    const recess = tuck * 0.78 + baseShade + rimLipShade + interRowGroove
    const warmDrift = Math.sin(a * 2 + row * 1.73) * 0.55 + Math.cos(a * 5 - row * 0.91) * 0.45
    writeWarmRecessColor(colors, i, recess, warmDrift)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/** Adds subtle warm weave-recess darkening along a vertical warp stake tube. */
export function applyWarpRecessShading(geometry: THREE.BufferGeometry, col: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const h = THREE.MathUtils.clamp((y - 0.025) / 0.40, 0, 1)
    const over = Math.cos(h * 11 * Math.PI + col * Math.PI)
    const tuck = Math.pow((1 - over) * 0.5, 1.2)
    const baseShade = (1 - THREE.MathUtils.smoothstep(h, 0.0, 0.35)) * 0.26
    const rimTuck = THREE.MathUtils.smoothstep(h, 0.84, 1.0) * 0.32
    const recess = tuck * 0.76 + baseShade + rimTuck
    const warmDrift = Math.sin(h * Math.PI * 2 + col * 1.37) * 0.65
    writeWarmRecessColor(colors, i, recess, warmDrift)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/** Adds subtle horizontal meeting-groove shading between the double rim hoops. */
export function applyRimGrooveShading(geometry: THREE.BufferGeometry, isUpper: boolean): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const a = Math.atan2(z / 0.51, x / 0.77)
    const ny = norm ? norm.getY(i) : 0
    // Upper hoop meets lower hoop underneath (`ny < 0`); lower hoop meets upper hoop above (`ny > 0`) & wall below.
    const meetingGroove = isUpper
      ? Math.max(0, -ny) * 0.52
      : Math.max(0, ny) * 0.42 + Math.max(0, -ny) * 0.26 + 0.08
    const warmDrift = Math.sin(a * 3 + (isUpper ? 0.4 : 2.1)) * 0.65
    writeWarmRecessColor(colors, i, meetingGroove, warmDrift)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/** Adds subtle inner-seam and root-lashing warmth along the twin arched handle rods. */
export function applyHandleShading(geometry: THREE.BufferGeometry, isOuter: boolean): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const archH = THREE.MathUtils.clamp((y - 0.30) / 1.18, 0, 1)
    const rootTuck = (1 - THREE.MathUtils.smoothstep(archH, 0.0, 0.26)) * 0.38
    const nz = norm ? norm.getZ(i) : 0
    const seamGroove = (isOuter ? Math.max(0, -nz) : Math.max(0, nz)) * 0.42
    const underArch = norm ? Math.max(0, -norm.getY(i)) * 0.16 : 0
    const warmDrift = Math.sin(x * 3.2 + (isOuter ? 1.1 : 2.8)) * 0.60
    writeWarmRecessColor(colors, i, rootTuck + seamGroove + underArch, warmDrift)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/** Adds subtle turn-to-turn crevice darkening across the five stacked handle tie rings. */
export function applyTieRingShading(geometry: THREE.BufferGeometry, ringIndex: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)
  // Note: tie ring is rotated `rotation.x = Math.PI / 2`, so local `z` becomes vertical world `-y`.
  const ringTone = ((ringIndex % 2) === 0 ? 0.07 : -0.05)

  for (let i = 0; i < pos.count; i++) {
    const nz = norm ? norm.getZ(i) : 0
    const turnCrevice = Math.abs(nz) * 0.48
    const recess = turnCrevice + 0.18
    writeWarmRecessColor(colors, i, recess, ringTone * 4)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}
