import * as THREE from 'three'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'

export type PandanusTone = 'warp' | 'weft' | 'reed' | 'core' | 'sienna'

export type PandanusTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type PandanusPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

type PandanusPalette = {
  light: readonly [number, number, number]
  mid: readonly [number, number, number]
  warm: readonly [number, number, number]
  dark: readonly [number, number, number]
  seed: number
  roughness: number
  clearcoat: number
  isDiagonalCore?: boolean
}

/**
 * Warm sun-dried Fijian pandanus (voivoi) & reed palettes with clear warp vs. weft
 * tonal separation so diagonal woven blades glow softly under Komorebi daylight
 * without turning glossy or muddy.
 */
export const PANDANUS_PALETTES: Record<PandanusTone, PandanusPalette> = {
  warp: {
    light: [240, 222, 174],
    mid: [224, 200, 146],
    warm: [233, 211, 158],
    dark: [182, 152, 98],
    seed: 107,
    roughness: 0.72,
    clearcoat: 0.14,
  },
  weft: {
    light: [228, 198, 138],
    mid: [206, 171, 110],
    warm: [218, 184, 122],
    dark: [160, 124, 70],
    seed: 229,
    roughness: 0.78,
    clearcoat: 0.09,
  },
  reed: {
    light: [202, 162, 104],
    mid: [174, 134, 80],
    warm: [188, 148, 92],
    dark: [126, 90, 48],
    seed: 337,
    roughness: 0.76,
    clearcoat: 0.12,
  },
  core: {
    light: [206, 174, 118],
    mid: [186, 152, 96],
    warm: [196, 162, 106],
    dark: [144, 110, 62],
    seed: 449,
    roughness: 0.86,
    clearcoat: 0.05,
    isDiagonalCore: true,
  },
  sienna: {
    light: [194, 124, 88],
    mid: [166, 98, 66],
    warm: [180, 110, 76],
    dark: [122, 66, 42],
    seed: 563,
    roughness: 0.78,
    clearcoat: 0.10,
  },
}

const cachedPandanusPixels = new Map<string, PandanusPixelBuffers>()

function pandanusHash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicPandanusNoise(x: number, y: number, px: number, py: number, seed: number): number {
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
  const a = pandanusHash(x0, y0, seed)
  const b = pandanusHash(x1, y0, seed)
  const c = pandanusHash(x0, y1, seed)
  const d = pandanusHash(x1, y1, seed)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}

function buildDataTexture(
  source: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  repeat: readonly [number, number],
  offset: readonly [number, number],
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), size, size)
  tex.colorSpace = colorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.offset.set(offset[0], offset[1])
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

/**
 * Deterministic stylized sun-dried pandanus-leaf fiber textures (256x256, zero DOM dependency).
 * Renders crisp parallel leaf veins along `u` with soft sun-cured tonal warmth and subtle
 * strip-edge definition, staying smooth and mip-stable at mobile card scale.
 */
export function createPandanusTextures(
  tone: PandanusTone,
  repeat: readonly [number, number] = [1, 1],
  offset: readonly [number, number] = [0, 0],
): PandanusTextureSet {
  const size = 256
  const cacheKey = `pandanus-leaf-${tone}-v1`
  let cached = cachedPandanusPixels.get(cacheKey)
  if (!cached) {
    const pal = PANDANUS_PALETTES[tone]
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const phaseA = pandanusHash(pal.seed, 13, 5) * tau
    const phaseB = pandanusHash(pal.seed, 29, 7) * tau

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        let signal: number
        let edgeShade = 0
        let warmMix: number

        if (pal.isDiagonalCore) {
          // Subtle woven diagonal backing grain so tiny gaps between raised strips read warm.
          const d1 = u + v
          const d2 = u - v
          const diagA = Math.sin(d1 * tau * 4 + phaseA)
          const diagB = Math.sin(d2 * tau * 4 + phaseB)
          const grain = (periodicPandanusNoise(u * 4, v * 4, 4, 4, pal.seed + 31) - 0.5) * 0.55
          signal = THREE.MathUtils.clamp((diagA + diagB) * 0.24 + diagA * diagB * 0.22 + grain * 0.35, -1, 1)
          warmMix = THREE.MathUtils.clamp(0.5 + grain * 0.5, 0, 1)
        } else {
          // Parallel sun-dried palm/pandanus leaf fibers running along strip length `u`.
          const sway = Math.sin(u * tau + phaseA) * 0.018
            + (periodicPandanusNoise(u * 2, v * 3, 2, 3, pal.seed + 19) - 0.5) * 0.025
          const vw = v + sway
          const primaryVein = Math.sin(vw * tau * 4 + phaseB)
          const secondaryVein = Math.sin(vw * tau * 9 + phaseB * 1.3 + 0.5)
          const streak = (periodicPandanusNoise(u * 2, vw * 14, 2, 14, pal.seed + 43) - 0.5) * 0.85
          const breath = 0.78 + 0.36 * periodicPandanusNoise(u * 2, v * 4, 2, 4, pal.seed + 67)
          signal = THREE.MathUtils.clamp((0.55 * primaryVein + 0.30 * secondaryVein) * breath * 0.56 + streak * 0.44, -1, 1)

          const cureWave = 0.5 + 0.5 * Math.sin(u * tau + phaseA * 1.15)
          const cureNoise = periodicPandanusNoise(u * 2, v * 2, 2, 2, pal.seed + 89)
          warmMix = THREE.MathUtils.clamp(cureWave * 0.52 + cureNoise * 0.48, 0, 1)

          const edgeDist = Math.min(v, 1 - v)
          edgeShade = (1 - THREE.MathUtils.smoothstep(edgeDist, 0.0, 0.10)) * 0.26
        }

        const ridge = Math.max(0, signal)
        const furrow = Math.max(0, -signal)

        const baseR = THREE.MathUtils.lerp(pal.mid[0], pal.warm[0], warmMix)
        const baseG = THREE.MathUtils.lerp(pal.mid[1], pal.warm[1], warmMix)
        const baseB = THREE.MathUtils.lerp(pal.mid[2], pal.warm[2], warmMix)

        const litR = THREE.MathUtils.lerp(baseR, pal.light[0], ridge * 0.62)
        const litG = THREE.MathUtils.lerp(baseG, pal.light[1], ridge * 0.62)
        const litB = THREE.MathUtils.lerp(baseB, pal.light[2], ridge * 0.58)

        const dip = THREE.MathUtils.clamp(furrow * 0.72 + edgeShade, 0, 0.86)
        const outR = THREE.MathUtils.lerp(litR, pal.dark[0], dip)
        const outG = THREE.MathUtils.lerp(litG, pal.dark[1], dip * 1.02)
        const outB = THREE.MathUtils.lerp(litB, pal.dark[2], dip * 1.04)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(outR), 0, 240)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(outG), 0, 222)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(outB), 0, 174)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + signal * 42 - edgeShade * 34),
          42,
          214,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(
          Math.round(216 - ridge * 28 + furrow * 28 + edgeShade * 20),
          180,
          252,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedPandanusPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat, offset),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat, offset),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat, offset),
  }
}

function makePandanusMaterial(
  tone: PandanusTone,
  repeat: readonly [number, number],
  offset: readonly [number, number],
  opts: { vertexColors?: boolean; bumpScale?: number } = {},
): THREE.MeshPhysicalMaterial {
  const pal = PANDANUS_PALETTES[tone]
  const tex = createPandanusTextures(tone, repeat, offset)
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale: opts.bumpScale ?? 0.0052,
    roughnessMap: tex.roughness,
    roughness: pal.roughness,
    metalness: 0,
    clearcoat: pal.clearcoat,
    clearcoatRoughness: 0.48,
    specularIntensity: 0.44,
    envMapIntensity: 0.36,
    ...(opts.vertexColors ? { vertexColors: true } : {}),
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

export type FijianFanMaterials = {
  /** Sunlit pale warp diagonal pandanus strips (direction > 0, with weave vertex shading). */
  warpStrip: THREE.MeshPhysicalMaterial
  /** Warmer golden-wheat weft diagonal pandanus strips (direction < 0, with weave vertex shading). */
  weftStrip: THREE.MeshPhysicalMaterial
  /** Toasted reed accent strips woven every 5th row (with weave vertex shading). */
  reedStrip: THREE.MeshPhysicalMaterial
  /** Warm diagonal-textured backing leaf core behind the woven strips. */
  bladeCore: THREE.MeshPhysicalMaterial
  /** Bound perimeter reed frame and back support ribs. */
  reedFrame: THREE.MeshPhysicalMaterial
  /** Neck collar & binding strands. */
  reedCollar: THREE.MeshPhysicalMaterial
  /** Fine wrapped pandanus edge lashing ties. */
  edgeTie: THREE.MeshPhysicalMaterial
  /** Warm honey pandanus collar back & sides. */
  bindingLeaf: THREE.MeshPhysicalMaterial
  /** Terracotta-sienna dyed woven pandanus grip on the loose collar. */
  siennaLeaf: THREE.MeshPhysicalMaterial
  /** Carved split hardwood fan handle (vertical grain, axis Y). */
  handleWood: THREE.MeshPhysicalMaterial
  /** Horizontal walnut display stand base & plinth (axis X). */
  walnutHorizontal: THREE.MeshPhysicalMaterial
  /** Vertical walnut stand backrests (axis Y). */
  walnutVertical: THREE.MeshPhysicalMaterial
}

/**
 * Stylized sun-dried pandanus leaf & carved wood material suite for the Fijian woven fan.
 * Leaves the already-upgraded `addCraftTable` bench untouched.
 */
export function createFijianFanMaterials(): FijianFanMaterials {
  const warpStrip = makePandanusMaterial('warp', [1, 1], [0.07, 0], { vertexColors: true, bumpScale: 0.0056 })
  const weftStrip = makePandanusMaterial('weft', [1, 1], [0.31, 0.14], { vertexColors: true, bumpScale: 0.0056 })
  const reedStrip = makePandanusMaterial('reed', [1, 1], [0.19, 0.08], { vertexColors: true, bumpScale: 0.0058 })

  const bladeCore = makePandanusMaterial('core', [3.2, 3.2], [0, 0], { vertexColors: false, bumpScale: 0.0038 })
  const reedFrame = makePandanusMaterial('reed', [9.0, 1], [0.05, 0], { vertexColors: false, bumpScale: 0.0060 })
  const reedCollar = makePandanusMaterial('reed', [1.8, 1], [0.22, 0.1], { vertexColors: false, bumpScale: 0.0050 })
  const edgeTie = makePandanusMaterial('weft', [2.2, 1], [0.15, 0], { vertexColors: false, bumpScale: 0.0048 })
  const bindingLeaf = makePandanusMaterial('weft', [1.4, 1], [0.11, 0.05], { vertexColors: false, bumpScale: 0.0048 })
  const siennaLeaf = makePandanusMaterial('sienna', [1.5, 1.2], [0.08, 0.04], { vertexColors: false, bumpScale: 0.0054 })

  const handleWood = applyCraftSurface(
    new THREE.MeshPhysicalMaterial({
      color: 0xac7f4c,
      roughness: 0.64,
      metalness: 0,
      clearcoat: 0.16,
      clearcoatRoughness: 0.42,
      specularIntensity: 0.50,
      envMapIntensity: 0.44,
    }),
    { kind: 'wood', axis: 'y', scale: 1.25, strength: 0.48 },
  )
  const walnutHorizontal = applyCraftSurface(
    new THREE.MeshPhysicalMaterial({
      color: 0x8f7050,
      roughness: 0.70,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.44,
      specularIntensity: 0.46,
      envMapIntensity: 0.40,
    }),
    { kind: 'wood', axis: 'x', scale: 0.86, strength: 0.56 },
  )
  const walnutVertical = applyCraftSurface(
    new THREE.MeshPhysicalMaterial({
      color: 0x8c6d4d,
      roughness: 0.70,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.44,
      specularIntensity: 0.46,
      envMapIntensity: 0.40,
    }),
    { kind: 'wood', axis: 'y', scale: 0.94, strength: 0.56 },
  )

  return {
    warpStrip,
    weftStrip,
    reedStrip,
    bladeCore,
    reedFrame,
    reedCollar,
    edgeTie,
    bindingLeaf,
    siennaLeaf,
    handleWood,
    walnutHorizontal,
    walnutVertical,
  }
}

/**
 * Writes warm woven over/under crossing shading onto a pandanus strip vertex so
 * forward-arched crossings catch warm daylight while tucked crossings settle into
 * toasted honey recesses without greying.
 */
export function writePandanusStripVertexColor(
  target: number[],
  weaveSin: number,
  isBackDepth: boolean,
  rowPhase: number,
): void {
  const tuck = Math.pow((1 - THREE.MathUtils.clamp(weaveSin, -1, 1)) * 0.5, 1.15)
  const backShade = isBackDepth ? 0.16 : 0.0
  const recess = THREE.MathUtils.clamp(tuck * 0.44 + backShade, 0, 0.72)
  const drift = Math.sin(rowPhase) * 0.025

  const r = THREE.MathUtils.clamp(1.03 - recess * 0.20 + drift, 0.76, 1.05)
  const g = THREE.MathUtils.clamp(1.015 - recess * 0.26 + drift * 0.8, 0.68, 1.04)
  const b = THREE.MathUtils.clamp(0.99 - recess * 0.34 + drift * 0.5, 0.56, 1.02)
  target.push(r, g, b)
}
