import * as THREE from 'three'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'

type RattanPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

type RattanTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

const cachedRattanPixels = new Map<string, RattanPixelBuffers>()

function rattanHash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicRattanNoise(x: number, y: number, px: number, py: number, seed: number): number {
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
  const a = rattanHash(x0, y0, seed)
  const b = rattanHash(x1, y0, seed)
  const c = rattanHash(x0, y1, seed)
  const d = rattanHash(x1, y1, seed)
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
 * Deterministic stylized wrapping-rattan cane textures (256x256, zero DOM dependency).
 * Three.js TubeGeometry and TorusGeometry map `u` along the lashing strand and `v`
 * around the strip cross-section, giving split rattan lashings longitudinal cane
 * fibers and subtle diagonal wrapping micro-relief.
 */
export function createRattanTextures(
  repeat: readonly [number, number] = [5, 1],
  offset: readonly [number, number] = [0, 0],
): RattanTextureSet {
  const size = 256
  const cacheKey = 'angklung-rattan-v1'
  let cached = cachedRattanPixels.get(cacheKey)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const light = [206, 156, 98] as const
    const mid = [152, 105, 60] as const
    const warm = [176, 124, 72] as const
    const dark = [90, 56, 30] as const

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const meander = Math.sin(u * tau + 0.7) * 0.04
          + (periodicRattanNoise(u * 2, v * 3, 2, 3, 41) - 0.5) * 0.05
        const vw = v + meander

        // Clean longitudinal split-cane ribs + gentle diagonal wrapping micro-relief.
        const caneFlute = 0.62 * Math.sin(vw * tau * 3 + 0.4) + 0.38 * Math.sin(vw * tau * 6 + 1.3)
        const wrapRipple = Math.sin((u * 4 + v * 1.0) * tau) * 0.28
        const streak = (periodicRattanNoise(u * 3, vw * 10, 3, 10, 83) - 0.5) * 0.65
        const warmDrift = THREE.MathUtils.clamp(
          0.5 + 0.32 * Math.sin(u * tau + 1.1) + (periodicRattanNoise(u * 2, v * 2, 2, 2, 127) - 0.5) * 0.42,
          0,
          1,
        )

        const signal = THREE.MathUtils.clamp(caneFlute * 0.54 + wrapRipple * 0.32 + streak * 0.34, -1, 1)
        const ridge = Math.max(0, signal)
        const groove = Math.max(0, -signal)

        const baseR = THREE.MathUtils.lerp(mid[0], warm[0], warmDrift)
        const baseG = THREE.MathUtils.lerp(mid[1], warm[1], warmDrift)
        const baseB = THREE.MathUtils.lerp(mid[2], warm[2], warmDrift)

        const litR = THREE.MathUtils.lerp(baseR, light[0], ridge * 0.68)
        const litG = THREE.MathUtils.lerp(baseG, light[1], ridge * 0.68)
        const litB = THREE.MathUtils.lerp(baseB, light[2], ridge * 0.64)

        const outR = THREE.MathUtils.lerp(litR, dark[0], groove * 0.82)
        const outG = THREE.MathUtils.lerp(litG, dark[1], groove * 0.84)
        const outB = THREE.MathUtils.lerp(litB, dark[2], groove * 0.86)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(outR), 0, 224)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(outG), 0, 184)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(outB), 0, 132)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + caneFlute * 38 + wrapRipple * 32 + streak * 18),
          40,
          216,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        // Waxy outer cane ridges (~0.74 multiplier) vs matte recessed bindings (~0.98).
        const rVal = THREE.MathUtils.clamp(Math.round(216 - ridge * 34 + groove * 32), 178, 252)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }
    cached = { color, bump, roughness, size }
    cachedRattanPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat, offset),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat, offset),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat, offset),
  }
}

function makeRattanMaterial(
  repeat: readonly [number, number],
  offset: readonly [number, number],
  bumpScale: number,
): THREE.MeshPhysicalMaterial {
  const tex = createRattanTextures(repeat, offset)
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale,
    roughnessMap: tex.roughness,
    roughness: 0.74,
    metalness: 0,
    clearcoat: 0.14,
    clearcoatRoughness: 0.44,
    specularIntensity: 0.48,
    envMapIntensity: 0.36,
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

function makeBambooSkin(
  color: number,
  axis: 'x' | 'y' | 'z',
  opts: {
    roughness?: number
    clearcoat?: number
    clearcoatRoughness?: number
    scale?: number
    strength?: number
    vertexColors?: boolean
    side?: THREE.Side
  } = {},
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: opts.roughness ?? 0.54,
    metalness: 0,
    clearcoat: opts.clearcoat ?? 0.24,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.36,
    specularIntensity: 0.56,
    envMapIntensity: 0.36,
    ...(opts.vertexColors ? { vertexColors: true } : {}),
    ...(opts.side !== undefined ? { side: opts.side } : {}),
  })
  return applyCraftSurface(mat, {
    kind: 'bamboo',
    axis,
    scale: opts.scale ?? 0.88,
    strength: opts.strength ?? 0.50,
  })
}

export type AngklungMaterials = {
  /** Seasoned golden-amber bamboo frame uprights, back rail & suspension rails (rod local Y). */
  bamboo: THREE.MeshPhysicalMaterial
  /** Sunlit warm honey bamboo top/front rails & foot necks (rod local Y). */
  fresh: THREE.MeshPhysicalMaterial
  /** Horizontal top frame grip (RoundedBoxGeometry length along local X). */
  gripBamboo: THREE.MeshPhysicalMaterial
  /** Darker toasted bamboo node rings (TorusGeometry ring plane XY -> axis X). */
  node: THREE.MeshPhysicalMaterial
  /** Mid-tube raised bamboo node rings. */
  tubeNode: THREE.MeshPhysicalMaterial
  /** Horizontal bamboo socket floor blocks (axis X). */
  socketBamboo: THREE.MeshStandardMaterial
  /** Matte cut-end basal bamboo foot (axis Y). */
  footBamboo: THREE.MeshStandardMaterial
  /** Matte inner culm diaphragm floor (axis X). */
  inside: THREE.MeshStandardMaterial
  /** Subtle longitudinal bamboo fiber accents on resonator tubes. */
  grain: THREE.MeshStandardMaterial
  /** Hero slotted resonator tubes: waxy bamboo skin + vertex-tinted inner pith & fresh cut walls. */
  shellMaterial: THREE.MeshPhysicalMaterial
  /** Wrapped rattan cane lashings (long tubes & helical bindings). */
  rattan: THREE.MeshPhysicalMaterial
  /** Compact rattan tie & rail-wrap rings. */
  rattanRing: THREE.MeshPhysicalMaterial
}

/**
 * Stylized Komorebi bamboo & wrapping-rattan material suite for the Indonesian angklung.
 * Aligns bamboo craft-surface axes to each geometry's local culm direction and separates
 * outer waxy skin from matte cut-end surfaces.
 */
export function createAngklungMaterials(): AngklungMaterials {
  const bamboo = makeBambooSkin(0xd4a858, 'y', { roughness: 0.54, clearcoat: 0.25, scale: 0.58, strength: 0.68 })
  const fresh = makeBambooSkin(0xe0bc72, 'y', { roughness: 0.56, clearcoat: 0.22, clearcoatRoughness: 0.38, scale: 0.62, strength: 0.64 })
  const gripBamboo = makeBambooSkin(0xdeb66a, 'x', { roughness: 0.54, clearcoat: 0.24, scale: 0.64, strength: 0.66 })
  const node = makeBambooSkin(0x9b763a, 'x', { roughness: 0.60, clearcoat: 0.18, clearcoatRoughness: 0.40, scale: 0.90, strength: 0.52 })
  const tubeNode = makeBambooSkin(0xcda354, 'x', { roughness: 0.58, clearcoat: 0.20, clearcoatRoughness: 0.38, scale: 0.88, strength: 0.52 })

  const socketBamboo = applyCraftSurface(
    new THREE.MeshStandardMaterial({ color: 0xa07b3e, roughness: 0.78, envMapIntensity: 0.36 }),
    { kind: 'bamboo', axis: 'x', scale: 0.80, strength: 0.48 },
  )
  const footBamboo = applyCraftSurface(
    new THREE.MeshStandardMaterial({ color: 0xe0b86c, roughness: 0.82, envMapIntensity: 0.36 }),
    { kind: 'bamboo', axis: 'y', scale: 0.92, strength: 0.44 },
  )
  const inside = applyCraftSurface(
    new THREE.MeshStandardMaterial({ color: 0x8a6434, roughness: 0.94, envMapIntensity: 0.34 }),
    { kind: 'bamboo', axis: 'x', scale: 1.0, strength: 0.38 },
  )
  const grain = applyCraftSurface(
    new THREE.MeshStandardMaterial({ color: 0xb68a44, roughness: 0.86, envMapIntensity: 0.36 }),
    { kind: 'bamboo', axis: 'y', scale: 0.85, strength: 0.42 },
  )

  // Keep source roughness > 0.7 for existing geometry/material contract tests; toon-soft
  // caps live bamboo roughness to 0.50 while clearcoat adds warm waxy Komorebi sheen.
  const shellMaterial = makeBambooSkin(0xffffff, 'y', {
    roughness: 0.74,
    clearcoat: 0.26,
    clearcoatRoughness: 0.34,
    scale: 0.68,
    strength: 0.68,
    vertexColors: true,
    side: THREE.DoubleSide,
  })

  const rattan = makeRattanMaterial([5.5, 1], [0, 0], 0.0085)
  const rattanRing = makeRattanMaterial([2.2, 1], [0.25, 0.15], 0.0072)

  return {
    bamboo,
    fresh,
    gripBamboo,
    node,
    tubeNode,
    socketBamboo,
    footBamboo,
    inside,
    grain,
    shellMaterial,
    rattan,
    rattanRing,
  }
}

export type ResonatorFaceRole = 'outer' | 'inner' | 'rim' | 'cutEdge'

const OUTER_SKIN = new THREE.Color(0xe8be66)
const OUTER_WARM = new THREE.Color(0xf4d584)
const OUTER_NODE = new THREE.Color(0xc19344)
const OUTER_BLOOM = new THREE.Color(0xf7e3a8)
const INNER_TONGUE = new THREE.Color(0xdcb364)
const INNER_CHAMBER = new THREE.Color(0xb68842)
const CUT_PITH = new THREE.Color(0xf8e3a6)
const SCRATCH_COLOR = new THREE.Color()

/**
 * Computes warm stylized bamboo vertex colors for a resonator vertex so outer waxed
 * culm skin, warm hollow interior pith, and fresh pale cut-wall edges read distinctly
 * beneath the procedural `bamboo` craft-surface shader.
 */
export function writeResonatorVertexColor(
  target: number[],
  x: number,
  y: number,
  z: number,
  height: number,
  role: ResonatorFaceRole,
): void {
  const slot = height * 0.57
  const nodeY = height * 0.48
  if (role === 'rim' || role === 'cutEdge') {
    const endShade = role === 'rim' ? 0.96 : 1.0
    const tone = endShade * (0.97 + 0.03 * Math.sin(y * 7.0 + x * 11.0))
    SCRATCH_COLOR.copy(CUT_PITH).multiplyScalar(tone)
  } else if (role === 'inner') {
    const depthMix = THREE.MathUtils.smoothstep(y, 0.14, slot + 0.18)
    const angle = Math.atan2(x, z)
    const striation = 0.97 + 0.03 * Math.sin(angle * 7.0 + 0.5)
    SCRATCH_COLOR.copy(INNER_CHAMBER).lerp(INNER_TONGUE, depthMix).multiplyScalar(striation)
  } else {
    const angle = Math.atan2(x, z)
    const h = THREE.MathUtils.clamp((y - 0.12) / Math.max(height - 0.12, 0.1), 0, 1)
    const striation = 0.5 + 0.5 * (0.62 * Math.sin(angle * 8.0 + 0.4) + 0.38 * Math.cos(angle * 15.0 - 0.8))
    SCRATCH_COLOR.copy(OUTER_SKIN).lerp(OUTER_WARM, striation * 0.36 + h * 0.12)

    // Soft toasted darkening right beside basal & mid nodes plus a pale waxy internode bloom.
    const distMid = y - nodeY
    const midShade = Math.exp(-((distMid / 0.045) ** 2))
    const basalShade = Math.exp(-(((y - 0.16) / 0.055) ** 2))
    const bloomAmt = Math.exp(-(((distMid + 0.055) / 0.055) ** 2)) * 0.24
    SCRATCH_COLOR.lerp(OUTER_NODE, Math.min(0.42, midShade * 0.28 + basalShade * 0.32))
    SCRATCH_COLOR.lerp(OUTER_BLOOM, bloomAmt)
  }
  target.push(
    THREE.MathUtils.clamp(SCRATCH_COLOR.r, 0, 1),
    THREE.MathUtils.clamp(SCRATCH_COLOR.g, 0, 1),
    THREE.MathUtils.clamp(SCRATCH_COLOR.b, 0, 1),
  )
}
