import * as THREE from 'three'

export type RushTone = 0 | 1 | 2

export type RushTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type RushPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

type RushPalette = {
  /** Sunlit yellow-green upper rush epidermis ridge (softly capped for Komorebi). */
  light: readonly [number, number, number]
  /** Primary fresh meadow-rush stem body tone. */
  mid: readonly [number, number, number]
  /** Warm sun-kissed yellow-green / pale-straw variation along the stalk. */
  warm: readonly [number, number, number]
  /** Soft olive-sage longitudinal vascular groove. */
  dark: readonly [number, number, number]
  /** Pale warm basal-sheath / joint tint along natural rush transitions. */
  sheath: readonly [number, number, number]
  seed: number
  roughness: number
}

/**
 * Three fresh-to-slightly-cured green Irish rush palettes anchored to the scene's
 * original meadow-rush hues (0x819568, 0xa4b07b, 0x91a36c). Keeps them clearly
 * green rushes (not yellow cereal straw) with soft warm-yellow sunlit ridges and
 * natural dry-grass matte shading under Komorebi daylight.
 */
export const RUSH_PALETTES: Record<RushTone, RushPalette> = {
  0: {
    light: [182, 194, 126],
    mid: [134, 154, 100],
    warm: [164, 174, 108],
    dark: [78, 96, 58],
    sheath: [192, 182, 120],
    seed: 131,
    roughness: 0.90,
  },
  1: {
    light: [208, 212, 144],
    mid: [170, 182, 120],
    warm: [196, 194, 126],
    dark: [106, 120, 74],
    sheath: [208, 194, 130],
    seed: 239,
    roughness: 0.88,
  },
  2: {
    light: [194, 203, 134],
    mid: [152, 168, 108],
    warm: [180, 184, 116],
    dark: [92, 108, 66],
    sheath: [198, 186, 124],
    seed: 353,
    roughness: 0.89,
  },
}

const cachedRushPixels = new Map<string, RushPixelBuffers>()

function rushHash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicRushNoise(x: number, y: number, px: number, py: number, seed: number): number {
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
  const a = rushHash(x0, y0, seed)
  const b = rushHash(x1, y0, seed)
  const c = rushHash(x0, y1, seed)
  const d = rushHash(x1, y1, seed)
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
 * Deterministic stylized green rush/reed stem textures (256x256, zero DOM).
 * TubeGeometry maps `u` along the stalk length and `v` around the circumference,
 * so longitudinal stem flutes, subtle vascular grooves, and soft yellow-green
 * joint/sheath transitions follow every woven corner and arm bundle naturally.
 */
export function createRushStalkTextures(
  tone: RushTone,
  repeat?: readonly [number, number],
  offset?: readonly [number, number],
): RushTextureSet {
  const size = 256
  const cacheKey = `rush-${tone}-v1`
  let cached = cachedRushPixels.get(cacheKey)
  if (!cached) {
    const pal = RUSH_PALETTES[tone]
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const phaseA = rushHash(pal.seed, 19, 5) * tau
    const phaseB = rushHash(pal.seed, 37, 11) * tau

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size

        // Gentle organic meander along the stalk length `u`.
        const meander = Math.sin(u * tau + phaseA) * 0.032
          + (periodicRushNoise(u * 2, v * 3, 2, 3, pal.seed + 17) - 0.5) * 0.05
        const vw = v + meander

        // Clean stylized longitudinal stem flutes (4 primary + 8 secondary vascular ribs)
        // stay crisp and mip-stable across thin 0.014-0.018 rush stalks.
        const primaryFlute = Math.sin(vw * tau * 4 + phaseB)
        const secondaryFlute = Math.sin(vw * tau * 8 + phaseB * 1.4 + 0.55)
        const fluteBreath = 0.78 + 0.36 * periodicRushNoise(u * 2, v * 4, 2, 4, pal.seed + 31)
        const flutes = (0.64 * primaryFlute + 0.36 * secondaryFlute) * fluteBreath

        // Elongated longitudinal rush cortex striations (1:7 aspect along `u` vs `v`).
        const streak = periodicRushNoise(u * 2, vw * 14, 2, 14, pal.seed + 53) - 0.5
        const fineFibers = streak * 0.90 + Math.sin(vw * tau * 12 + phaseA) * 0.22

        // Warm yellow-green sunlit drift + soft rush-joint / dry-sheath transitions along `u`.
        const sunWave = 0.5 + 0.5 * Math.sin(u * tau * 2 + phaseA * 1.3)
        const sunNoise = periodicRushNoise(u * 3, v * 2, 3, 2, pal.seed + 71)
        const warmMix = THREE.MathUtils.clamp(sunWave * 0.52 + sunNoise * 0.48, 0, 1)

        // Asymmetric natural rush-joint / pale-sheath transitions along `u` (organic, not mechanical).
        const jointPhaseA = (u + 0.23 + tone * 0.29) % 1
        const jointDistA = Math.abs(jointPhaseA - 0.5) * 2
        const jointPhaseB = (u + 0.67 + tone * 0.19) % 1
        const jointDistB = Math.abs(jointPhaseB - 0.5) * 2
        const jointHalo = Math.exp(-Math.pow((1 - jointDistA) / 0.22, 2))
          + Math.exp(-Math.pow((1 - jointDistB) / 0.18, 2)) * 0.65
        const jointRing = Math.exp(-Math.pow((1 - jointDistA) / 0.048, 2)) * 0.34
          + Math.exp(-Math.pow((1 - jointDistB) / 0.044, 2)) * 0.20
        const sheathMask = THREE.MathUtils.clamp(jointHalo * 0.44, 0, 0.54)
        const jointCrease = THREE.MathUtils.clamp(jointRing, 0, 0.38)

        const fiberSignal = THREE.MathUtils.clamp(flutes * 0.62 + fineFibers * 0.48, -1, 1)
        const ridge = Math.max(0, fiberSignal)
        const furrow = Math.max(0, -fiberSignal)

        const baseR = THREE.MathUtils.lerp(pal.mid[0], pal.warm[0], warmMix)
        const baseG = THREE.MathUtils.lerp(pal.mid[1], pal.warm[1], warmMix)
        const baseB = THREE.MathUtils.lerp(pal.mid[2], pal.warm[2], warmMix)

        const sheathR = THREE.MathUtils.lerp(baseR, pal.sheath[0], sheathMask)
        const sheathG = THREE.MathUtils.lerp(baseG, pal.sheath[1], sheathMask)
        const sheathB = THREE.MathUtils.lerp(baseB, pal.sheath[2], sheathMask)

        const liftedR = THREE.MathUtils.lerp(sheathR, pal.light[0], ridge * 0.72)
        const liftedG = THREE.MathUtils.lerp(sheathG, pal.light[1], ridge * 0.72)
        const liftedB = THREE.MathUtils.lerp(sheathB, pal.light[2], ridge * 0.66)

        const shadeAmt = THREE.MathUtils.clamp(Math.pow(furrow, 0.94) * 0.84 + jointCrease, 0, 0.90)
        const finalR = THREE.MathUtils.lerp(liftedR, pal.dark[0], shadeAmt)
        const finalG = THREE.MathUtils.lerp(liftedG, pal.dark[1], shadeAmt)
        const finalB = THREE.MathUtils.lerp(liftedB, pal.dark[2], shadeAmt)

        const idx = (y * size + x) * 4
        // Soft Komorebi daylight highlight ceiling: stays creamy-matte green, never neon.
        color[idx] = THREE.MathUtils.clamp(Math.round(finalR), 0, 214)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(finalG), 0, 218)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(finalB), 0, 158)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + flutes * 42 + fineFibers * 22 + jointHalo * 12 - jointCrease * 34),
          40,
          216,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        // Soft dry-grass matte finish (roughness multiplier ~0.84..0.99).
        const rVal = THREE.MathUtils.clamp(
          Math.round(234 - ridge * 18 + furrow * 18 + jointCrease * 16),
          212,
          253,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedRushPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat, offset),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat, offset),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat, offset),
  }
}

export type BrigidRushMaterials = {
  rushes: readonly [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]
  dispose(): void
}

/**
 * Creates the three stylized green rush materials with soft dry-grass matte shading,
 * longitudinal stem fibers, bump relief, and deterministic one-shot texture disposal.
 */
export function createBrigidRushMaterials(): BrigidRushMaterials {
  const tones: readonly RushTone[] = [0, 1, 2]
  const ownedTextures: THREE.DataTexture[] = []
  const rushes = tones.map((tone) => {
    const pal = RUSH_PALETTES[tone]
    const tex = createRushStalkTextures(tone, [2.4, 1], [tone * 0.27, tone * 0.19])
    ownedTextures.push(tex.map, tex.bump, tex.roughness)
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex.map,
      bumpMap: tex.bump,
      bumpScale: 0.0076,
      roughnessMap: tex.roughness,
      roughness: pal.roughness,
      metalness: 0,
      envMapIntensity: 0.34,
      vertexColors: true,
    })
  }) as [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]

  let disposed = false
  return {
    rushes,
    dispose() {
      if (disposed) return
      disposed = true
      for (const tex of ownedTextures) tex.dispose()
    },
  }
}

function writeWarmRushShade(colors: Float32Array, index: number, recess: number, warmDrift = 0): void {
  const s = THREE.MathUtils.clamp(recess, 0, 1)
  // Warm olive-earth shadow tint (drops blue faster than red/green) keeps tucked rushes cozy.
  colors[index * 3] = THREE.MathUtils.clamp(1.01 - s * 0.20 + warmDrift * 0.028, 0.72, 1.04)
  colors[index * 3 + 1] = THREE.MathUtils.clamp(1.01 - s * 0.22 + warmDrift * 0.024, 0.70, 1.04)
  colors[index * 3 + 2] = THREE.MathUtils.clamp(0.99 - s * 0.30 + warmDrift * 0.014, 0.60, 1.02)
}

/** Strictly additive vertex shading for the six interlocking center squares. */
export function applyCenterInterlockShading(geometry: THREE.BufferGeometry, ringIndex: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)
  const depthTint = (ringIndex % 2 === 0 ? 0.16 : 0.04) + (1 - ringIndex / 5) * 0.12

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const nz = norm ? norm.getZ(i) : 0
    // Gentle darkening near the 4 corner folds where woven rushes bend over each other.
    const cornerFocus = THREE.MathUtils.smoothstep(Math.abs(Math.abs(x) - Math.abs(y)), 0.08, 0.0)
    const backEdge = Math.max(0, -nz) * 0.28
    const recess = depthTint + cornerFocus * 0.18 + backEdge
    const warmDrift = Math.sin((x + y) * 14 + ringIndex * 1.3) * 0.55
    writeWarmRushShade(colors, i, recess, warmDrift)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/** Strictly additive vertex shading for arm rush stalks (root tuck + cord-binding shadows). */
export function applyArmRushShading(geometry: THREE.BufferGeometry, stalkIndex: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)
  const depthLayer = stalkIndex % 2 === 0 ? 0.12 : 0.02

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const nz = norm ? norm.getZ(i) : 0
    // Soft tuck where each arm emerges from the woven central square (x ~ 0.13..0.24).
    const rootTuck = (1 - THREE.MathUtils.smoothstep(x, 0.13, 0.27)) * 0.34
    // Gentle pinch shadow around the two cord bindings at x = 0.66 and x = 0.70.
    const tiePinch = Math.exp(-Math.pow((x - 0.68) / 0.048, 2)) * 0.32
    // Sunlit tip warmth toward the cut rush ends (x > 0.76).
    const tipWarm = THREE.MathUtils.smoothstep(x, 0.72, 0.88) * 0.55
    const backEdge = Math.max(0, -nz) * 0.24
    const recess = depthLayer + rootTuck + tiePinch + backEdge
    writeWarmRushShade(colors, i, recess, tipWarm + Math.sin(x * 7 + stalkIndex * 1.7) * 0.35)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/** Strictly additive vertex shading for the five waiting loose rushes on the worktable. */
export function applyLooseRushShading(geometry: THREE.BufferGeometry, stalkIndex: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)
  const rowShade = (4 - stalkIndex) * 0.055

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const ny = norm ? norm.getY(i) : 0
    const underShadow = Math.max(0, -ny) * 0.28
    const recess = rowShade + underShadow
    const warmDrift = Math.sin(x * 6.5 + stalkIndex * 1.9) * 0.50
    writeWarmRushShade(colors, i, recess, warmDrift)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}
