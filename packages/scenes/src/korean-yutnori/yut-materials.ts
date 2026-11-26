import * as THREE from 'three'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'

export type YutMatTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type YutMatPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

const cachedYutPixels = new Map<string, YutMatPixelBuffers>()

function yutHash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicYutNoise(x: number, y: number, px: number, py: number, seed: number): number {
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
  const a = yutHash(x0, y0, seed)
  const b = yutHash(x1, y0, seed)
  const c = yutHash(x0, y1, seed)
  const d = yutHash(x1, y1, seed)
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
 * Deterministic calm rice-straw / reed woven mat textures (256x256, zero DOM dependency).
 * Renders soft horizontal reed stalks bound by quiet vertical stitch tracks so the
 * playing mat reads unmistakably woven while remaining visually calmer than the
 * four carved wooden yut sticks.
 */
export function createYutMatTextures(
  variant: 'mat' | 'hem',
  repeat: readonly [number, number],
  offset: readonly [number, number] = [0, 0],
): YutMatTextureSet {
  const size = 256
  const cacheKey = `yut-reed-${variant}-v2`
  let cached = cachedYutPixels.get(cacheKey)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const isHem = variant === 'hem'

    // Calmed warm rice-straw palette capped safely below Komorebi's 2.0-key clip knee.
    const light = isHem ? ([222, 186, 130] as const) : ([214, 176, 118] as const)
    const mid = isHem ? ([206, 168, 114] as const) : ([198, 157, 100] as const)
    const warm = isHem ? ([215, 178, 122] as const) : ([207, 166, 108] as const)
    const dark = isHem ? ([176, 138, 88] as const) : ([168, 128, 76] as const)
    const cord = isHem ? ([166, 128, 80] as const) : ([156, 118, 70] as const)

    // Fine continuous horizontal reeds bound by straight, quiet vertical warp threads
    // (classic Korean dotjari / rice-straw mat rhythm — never staggered brick masonry).
    const stalkRows = isHem ? 10 : 18
    const warpCols = isHem ? 4 : 6

    for (let y = 0; y < size; y++) {
      const v = y / size
      const rowPos = v * stalkRows
      const rowIdx = Math.floor(rowPos)
      const rowFrac = rowPos - rowIdx
      // Soft rounded horizontal reed stalk profile with delicate seam between reeds.
      const stalkArch = Math.sin(rowFrac * Math.PI)
      const stalkCrease = Math.pow(1 - stalkArch, 1.9)
      const rowTone = yutHash(rowIdx, isHem ? 19 : 7, 137)
      // Gentle alternating reed hue warmth between adjacent stalks.
      const stalkPair = 0.5 + 0.5 * Math.sin(rowIdx * 1.65 + 0.4)

      for (let x = 0; x < size; x++) {
        const u = x / size
        // Subtle organic sun-cured straw streaks running continuously along each reed.
        const alongWave = 0.5 + 0.5 * Math.sin((u * 2 + rowTone) * tau)
        const strawFiber = (periodicYutNoise(u * 4, v * stalkRows * 2, 4, stalkRows * 2, 193) - 0.5) * 0.42
        const macroWarm = periodicYutNoise(u * 2, v * 2, 2, 2, 241)

        // Straight, fine continuous vertical warp-thread tracks binding the horizontal reeds.
        const colPos = u * warpCols
        const colFrac = colPos - Math.floor(colPos)
        const distToWarp = Math.min(colFrac, 1 - colFrac)
        const warpThread = 1 - THREE.MathUtils.smoothstep(distToWarp, 0.012, 0.048)
        // Subtle over/under alternating stitch tick along each straight warp line.
        const stitchPulse = (rowIdx % 2 === 0 ? 0.65 : 0.35) * (0.35 + 0.65 * stalkArch)
        const pinch = warpThread * stitchPulse

        const warmMix = THREE.MathUtils.clamp(rowTone * 0.34 + stalkPair * 0.22 + alongWave * 0.20 + macroWarm * 0.24, 0, 1)
        const baseR = THREE.MathUtils.lerp(mid[0], warm[0], warmMix)
        const baseG = THREE.MathUtils.lerp(mid[1], warm[1], warmMix)
        const baseB = THREE.MathUtils.lerp(mid[2], warm[2], warmMix)

        // Calm contrast keeps the woven reed mat serene beneath the carved wooden yut sticks.
        const crestLift = Math.max(0, stalkArch - 0.52) * 0.52 + Math.max(0, strawFiber) * 0.30
        const dip = THREE.MathUtils.clamp(stalkCrease * 0.44 + Math.max(0, -strawFiber) * 0.22, 0, 0.62)

        let outR = THREE.MathUtils.lerp(baseR, light[0], THREE.MathUtils.clamp(crestLift * (1 - warpThread * 0.45), 0, 0.52))
        let outG = THREE.MathUtils.lerp(baseG, light[1], THREE.MathUtils.clamp(crestLift * (1 - warpThread * 0.45), 0, 0.52))
        let outB = THREE.MathUtils.lerp(baseB, light[2], THREE.MathUtils.clamp(crestLift * (1 - warpThread * 0.45), 0, 0.50))

        outR = THREE.MathUtils.lerp(outR, dark[0], dip)
        outG = THREE.MathUtils.lerp(outG, dark[1], dip * 1.02)
        outB = THREE.MathUtils.lerp(outB, dark[2], dip * 1.04)

        outR = THREE.MathUtils.lerp(outR, cord[0], pinch * 0.42)
        outG = THREE.MathUtils.lerp(outG, cord[1], pinch * 0.44)
        outB = THREE.MathUtils.lerp(outB, cord[2], pinch * 0.46)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(outR), 0, 224)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(outG), 0, 188)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(outB), 0, 132)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + (stalkArch - 0.5) * 44 + strawFiber * 16 - pinch * 30),
          56,
          202,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        // Calm matte straw roughness (~0.85 on reed crown to ~0.98 in crease/stitch).
        const rVal = THREE.MathUtils.clamp(
          Math.round(226 - Math.max(0, stalkArch - 0.55) * 18 + stalkCrease * 18 + pinch * 16),
          202,
          252,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedYutPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat, offset),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat, offset),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat, offset),
  }
}

function makeReedMaterial(
  variant: 'mat' | 'hem',
  repeat: readonly [number, number],
  bumpScale: number,
  roughness: number,
): THREE.MeshStandardMaterial {
  const tex = createYutMatTextures(variant, repeat)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale,
    roughnessMap: tex.roughness,
    roughness,
    metalness: 0,
    envMapIntensity: 0.38,
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

export type YutCraftMaterials = {
  /** Calm woven rice-straw / reed playing mat (`yut-mat`). */
  reed: THREE.MeshStandardMaterial
  /** Matching woven straw edge-hem stitches (`yut-weave-*`, `yut-near-weave-*`). */
  weave: THREE.MeshStandardMaterial
  /** Four subtly individualized longitudinal carved-wood materials (`axis: 'z'`) for the 4 yut sticks. */
  stickWoods: readonly [
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
  ]
  /** Carved/scorched warm wood mark bars on each stick's flat face. */
  mark: THREE.MeshStandardMaterial
}

const STICK_RECIPES = [
  { scale: 1.32, strength: 0.48, roughness: 0.60 },
  { scale: 1.48, strength: 0.46, roughness: 0.63 },
  { scale: 1.24, strength: 0.50, roughness: 0.61 },
  { scale: 1.42, strength: 0.47, roughness: 0.64 },
] as const

/**
 * Creates the warm carved-wood yut stick materials and calm woven reed-mat materials.
 * Every material owns its own texture wrappers and disposes them cleanly once.
 */
export function createYutCraftMaterials(): YutCraftMaterials {
  // 3.15 x 4.15 mat -> repeat [2.5, 3.2] preserves calm, aliasing-free reed & warp proportions.
  const reed = makeReedMaterial('mat', [2.5, 3.2], 0.0036, 0.88)
  const weave = makeReedMaterial('hem', [1, 1], 0.0032, 0.86)

  const stickWoods = STICK_RECIPES.map((recipe) =>
    applyCraftSurface(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: recipe.roughness,
        metalness: 0,
        clearcoat: 0.14,
        clearcoatRoughness: 0.44,
        specularIntensity: 0.48,
        envMapIntensity: 0.42,
      }),
      { kind: 'wood', axis: 'z', scale: recipe.scale, strength: recipe.strength },
    ),
  ) as [
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
  ]

  const mark = applyCraftSurface(
    new THREE.MeshStandardMaterial({ color: 0x996034, roughness: 0.78, envMapIntensity: 0.40 }),
    { kind: 'wood', axis: 'x', scale: 1.4, strength: 0.34 },
  )

  return { reed, weave, stickWoods, mark }
}

const FLAT_SAPWOOD = new THREE.Color(0xf0d298)
const FLAT_HEART = new THREE.Color(0xe6c382)
const ROUND_BACK = new THREE.Color(0xd49c58)
const ROUND_EDGE = new THREE.Color(0xc48b48)
const END_GRAIN = new THREE.Color(0xb88149)
const STICK_SCRATCH = new THREE.Color()

/**
 * Applies warm split-wood vertex colors to a half-round yut stick geometry, clearly
 * distinguishing the pale flat-sawn inner face, richer curved outer back, and toasted
 * cross-cut end-grain faces beneath the longitudinal `wood` craft-surface shader.
 */
export function applyYutStickVertexColors(geometry: THREE.BufferGeometry, stickIndex: number): void {
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(positions.count * 3)
  const toneShift = (stickIndex - 1.5) * 0.016

  for (let v = 0; v < positions.count; v++) {
    const x = positions.getX(v)
    const y = positions.getY(v)
    const z = positions.getZ(v)
    const ny = normals.getY(v)
    const nz = normals.getZ(v)

    if (Math.abs(nz) > 0.9) {
      // Cross-cut end grain: slightly deeper toward center pith.
      const rNorm = THREE.MathUtils.clamp(Math.hypot(x, y + 0.06) / 0.12, 0, 1)
      STICK_SCRATCH.copy(END_GRAIN).multiplyScalar(0.94 + rNorm * 0.08 + toneShift * 0.5)
    } else if (ny < -0.85) {
      // Flat-sawn split inner face: bright pale cream-birch sapwood with subtle edge warmth.
      const edgeMix = THREE.MathUtils.clamp(Math.abs(x) / 0.12, 0, 1)
      const drift = 0.985 + 0.02 * Math.sin(z * 4.5 + stickIndex * 1.4)
      STICK_SCRATCH.copy(FLAT_SAPWOOD).lerp(FLAT_HEART, (1 - edgeMix) * 0.24).multiplyScalar(drift + toneShift * 0.4)
    } else {
      // Curved outer back: warm honey-chestnut, subtly deeper along rounded shoulders.
      const crown = THREE.MathUtils.clamp(ny, 0, 1)
      const drift = 0.985 + 0.025 * Math.sin(z * 3.8 + stickIndex * 1.9)
      STICK_SCRATCH.copy(ROUND_EDGE).lerp(ROUND_BACK, Math.pow(crown, 0.65)).multiplyScalar(drift + toneShift)
    }

    colors[v * 3] = THREE.MathUtils.clamp(STICK_SCRATCH.r, 0, 1)
    colors[v * 3 + 1] = THREE.MathUtils.clamp(STICK_SCRATCH.g, 0, 1)
    colors[v * 3 + 2] = THREE.MathUtils.clamp(STICK_SCRATCH.b, 0, 1)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}
