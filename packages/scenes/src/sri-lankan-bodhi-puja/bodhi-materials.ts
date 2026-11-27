import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

type PixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

const cachedPixels = new Map<string, PixelBuffers>()

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

function makeTexture(
  source: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  wrapS: THREE.Wrapping,
  wrapT: THREE.Wrapping,
  repeat?: readonly [number, number],
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), size, size)
  tex.colorSpace = colorSpace
  tex.wrapS = wrapS
  tex.wrapT = wrapT
  if (repeat) tex.repeat.set(repeat[0], repeat[1])
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

function bindTextureDisposal(material: THREE.Material, textures: readonly THREE.Texture[]): void {
  let released = false
  const onDispose = () => {
    if (released) return
    released = true
    material.removeEventListener('dispose', onDispose)
    for (const tex of textures) tex.dispose()
  }
  material.addEventListener('dispose', onDispose)
}

/**
 * Watertight, gently arched, midrib-folded cordate Bodhi leaf (Ficus religiosa)
 * with a long slender drip tip and clean `[u, v]` coordinates for palmate/pinnate veins.
 *
 * Local coordinates preserve the petiole sinus `(0, 0.115, 0.0045)` and stay within
 * the original silhouette envelope (`max.y > 0.15`, `min.y < -0.44`, `|x| < 0.025` for `y < -0.3`).
 */
export function createBodhiLeafGeometry(): THREE.BufferGeometry {
  // Smooth half-width samples from cordate top rim (t=0) down to pointed drip tip (t=1).
  const widthProfile = [
    0.092, 0.124, 0.133, 0.128, 0.114, 0.095, 0.074, 0.053,
    0.036, 0.024, 0.017, 0.0125, 0.0085, 0.0048, 0.0,
  ]
  const rows = widthProfile.length - 1 // 14 intervals; rows 0..13 are full cross-sections, row 14 is tip pole
  const cols = 8 // even so col = 4 is exact central midrib
  const stride = cols + 1
  const layerCount = rows * stride

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const evalLeafPoint = (r: number, c: number) => {
    const t = r / rows
    const u = c / cols
    const s = u * 2 - 1 // -1 (left margin) .. 0 (midrib) .. +1 (right margin)
    const absS = Math.abs(s)
    const halfW = widthProfile[r]!
    // Subtle nonlinear lateral distribution keeps extra resolution near the midrib and margins.
    const x = Math.sign(s) * Math.pow(absS, 0.94) * halfW
    const yMid = 0.115 - t * 0.563
    // Cordate upper heart lobes arch smoothly above the petiole sinus (0, 0.115).
    const lobeLift = 0.056 * Math.pow(Math.sin(absS * Math.PI), 0.78) * Math.pow(1 - t, 3.2)
    const y = yMid + lobeLift

    // Gentle convex blade arch across the belly curving gracefully back into the hanging drip tip.
    const archZ = 0.0045 + 0.024 * Math.sin(Math.PI * Math.pow(t, 0.85)) - 0.021 * Math.pow(t, 2.35)
    // Soft V-fold trough along the central midrib (foldZ = 0 at s = 0, so sinus stays at z = 0.0045).
    const foldEnv = Math.sin(Math.PI * Math.min(1, t * 0.96 + 0.14)) * (1 - 0.62 * t)
    const foldZ = (0.0145 * Math.pow(absS, 1.15) - 0.0038 * Math.pow(absS, 2.4)) * foldEnv
    const marginWave = 0.0018 * Math.sin(t * Math.PI * 2.4) * absS * absS * (1 - t)
    const zCenter = archZ + foldZ + marginWave

    // Organic lenticular thickness: slightly fuller along the midrib, crisp thin living margin.
    const midribRidge = Math.exp(-Math.pow(absS / 0.24, 2))
    const halfThick = THREE.MathUtils.lerp(0.0017, 0.0010, t)
      + midribRidge * THREE.MathUtils.lerp(0.0022, 0.0005, t)

    return { x, y, zCenter, halfThick, u, v: t, absS, t }
  }

  // Layer 0: upper (adaxial) face, facing +Z.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const p = evalLeafPoint(r, c)
      positions.push(p.x, p.y, p.zCenter + p.halfThick)
      uvs.push(p.u, p.v)
      // Warm sunlit translucent glow toward the slender drip tip and along the central midrib.
      const tipWarm = THREE.MathUtils.smoothstep(p.t, 0.45, 1.0)
      const midribLift = Math.exp(-Math.pow(p.absS / 0.22, 2)) * (1 - p.t * 0.35)
      const baseDepth = (1 - THREE.MathUtils.smoothstep(p.t, 0.0, 0.34)) * (0.3 + 0.7 * p.absS)
      const cr = THREE.MathUtils.clamp(0.95 + tipWarm * 0.09 + midribLift * 0.05 - baseDepth * 0.06, 0.84, 1.05)
      const cg = THREE.MathUtils.clamp(0.98 + tipWarm * 0.07 + midribLift * 0.04 - baseDepth * 0.04, 0.88, 1.05)
      const cb = THREE.MathUtils.clamp(0.91 + tipWarm * 0.02 + midribLift * 0.02 - baseDepth * 0.05, 0.80, 0.98)
      colors.push(cr, cg, cb)
    }
  }

  // Layer 1: lower (abaxial) face, facing -Z (slightly softer pale silvery-sage underside).
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const p = evalLeafPoint(r, c)
      positions.push(p.x, p.y, p.zCenter - p.halfThick)
      uvs.push(p.u, p.v)
      const tipWarm = THREE.MathUtils.smoothstep(p.t, 0.45, 1.0)
      const cr = THREE.MathUtils.clamp(0.87 + tipWarm * 0.08, 0.80, 0.98)
      const cg = THREE.MathUtils.clamp(0.92 + tipWarm * 0.06, 0.84, 1.00)
      const cb = THREE.MathUtils.clamp(0.83 + tipWarm * 0.03, 0.76, 0.92)
      colors.push(cr, cg, cb)
    }
  }

  // Single pointed drip-tip pole shared by both faces and side margins.
  const tipIndex = positions.length / 3
  const tipZ = 0.0045 - 0.021
  positions.push(0, -0.448, tipZ)
  uvs.push(0.5, 1.0)
  colors.push(1.03, 1.04, 0.90)

  const top = (r: number, c: number) => r * stride + c
  const bot = (r: number, c: number) => layerCount + r * stride + c

  // Upper face quads (+Z outward).
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const a = top(r, c), b = top(r, c + 1), c0 = top(r + 1, c), d = top(r + 1, c + 1)
      indices.push(a, c0, d, a, d, b)
    }
  }
  // Upper drip-tip fan.
  for (let c = 0; c < cols; c++) {
    indices.push(top(rows - 1, c), tipIndex, top(rows - 1, c + 1))
  }

  // Lower face quads (-Z outward).
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const a = bot(r, c), b = bot(r, c + 1), c0 = bot(r + 1, c), d = bot(r + 1, c + 1)
      indices.push(a, b, d, a, d, c0)
    }
  }
  // Lower drip-tip fan.
  for (let c = 0; c < cols; c++) {
    indices.push(bot(rows - 1, c), bot(rows - 1, c + 1), tipIndex)
  }

  // Watertight perimeter seal along cordate top edge (r = 0, +Y outward).
  for (let c = 0; c < cols; c++) {
    const t0 = top(0, c), t1 = top(0, c + 1), b0 = bot(0, c), b1 = bot(0, c + 1)
    indices.push(t0, t1, b1, t0, b1, b0)
  }
  // Left margin seal (c = 0, -X outward).
  for (let r = 0; r < rows - 1; r++) {
    const t0 = top(r, 0), t1 = top(r + 1, 0), b0 = bot(r, 0), b1 = bot(r + 1, 0)
    indices.push(t1, t0, b0, t1, b0, b1)
  }
  indices.push(tipIndex, top(rows - 1, 0), bot(rows - 1, 0))

  // Right margin seal (c = cols, +X outward).
  for (let r = 0; r < rows - 1; r++) {
    const t0 = top(r, cols), t1 = top(r + 1, cols), b0 = bot(r, cols), b1 = bot(r + 1, cols)
    indices.push(t0, t1, b1, t0, b1, b0)
  }
  indices.push(top(rows - 1, cols), tipIndex, bot(rows - 1, cols))

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

type LeafBatchPalette = {
  deep: readonly [number, number, number]
  mid: readonly [number, number, number]
  sunlit: readonly [number, number, number]
  vein: readonly [number, number, number]
  seed: number
}

// Three lush living Ficus religiosa greens harmonized with Komorebi daylight foliage.
const BODHI_LEAF_PALETTES: readonly LeafBatchPalette[] = [
  { deep: [86, 118, 56], mid: [108, 142, 68], sunlit: [148, 174, 86], vein: [182, 198, 112], seed: 109 },
  { deep: [100, 134, 64], mid: [126, 158, 76], sunlit: [168, 192, 98], vein: [198, 210, 124], seed: 223 },
  { deep: [116, 148, 72], mid: [144, 174, 88], sunlit: [186, 206, 110], vein: [212, 220, 138], seed: 337 },
]

function buildBodhiLeafPixels(batchIndex: number): PixelBuffers {
  const key = `bodhi-leaf-${batchIndex}-v1`
  const existing = cachedPixels.get(key)
  if (existing) return existing

  const size = 256
  const pal = BODHI_LEAF_PALETTES[batchIndex]!
  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)
  const roughness = new Uint8Array(size * size * 4)

  // Origin v coordinates for 6 arching pinnate vein pairs + 1 basal palmate pair.
  const lateralOrigins = [0.05, 0.14, 0.25, 0.37, 0.50, 0.63, 0.76]

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1) // 0 = cordate base -> 1 = drip tip
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1) // 0 = left margin, 0.5 = midrib, 1 = right margin
      const absS = Math.abs(u - 0.5) * 2 // 0 at midrib -> 1 at margin

      // 1. Central midrib tapering smoothly from the cordate sinus into the drip tip.
      const midribHalfW = THREE.MathUtils.lerp(0.052, 0.016, Math.pow(v, 0.75))
      const midrib = Math.exp(-Math.pow(absS / midribHalfW, 2))

      // 2. Palmate basal pair + 6 arching pinnate lateral veins with brochidodromous margin loops.
      let lateral = 0
      for (let k = 0; k < lateralOrigins.length; k++) {
        const v0 = lateralOrigins[k]!
        const isBasalPalmate = k === 0
        // Basal palmate veins sweep outward into the upper heart lobes; pinnate veins arc downward-outward.
        const slope = isBasalPalmate ? -0.02 + 0.11 * absS * absS : 0.17 * absS + 0.06 * absS * absS
        const arch = isBasalPalmate ? -0.024 * Math.sin(absS * Math.PI) : -0.018 * Math.sin(absS * Math.PI)
        const vCurve = v0 + slope + arch
        const dist = Math.abs(v - vCurve)
        const veinWidth = THREE.MathUtils.lerp(isBasalPalmate ? 0.019 : 0.016, 0.008, absS)
        const reach = (1 - THREE.MathUtils.smoothstep(absS, 0.80, 0.98)) * (1 - THREE.MathUtils.smoothstep(v, 0.78, 0.96))
        const strength = (isBasalPalmate ? 0.84 : 0.72) * reach
        lateral = Math.max(lateral, Math.exp(-Math.pow(dist / veinWidth, 2)) * strength)
      }

      // Soft translucent reticulate glow between lateral veins and delicate chlorophyll mottling.
      const softMottle = periodicNoise(u * 4, v * 5, 4, 5, pal.seed + 19) - 0.5
      const fineCell = periodicNoise(u * 10, v * 12, 10, 12, pal.seed + 41) - 0.5
      const veinMask = THREE.MathUtils.clamp(Math.max(midrib, lateral * 0.86), 0, 1)

      // Sunlit warm-green shift toward the drip tip and thin leaf margins; deeper shade near the sinus cheeks.
      const tipGlow = THREE.MathUtils.smoothstep(v, 0.36, 0.95) * 0.62
      const marginTranslucent = THREE.MathUtils.smoothstep(absS, 0.55, 0.98) * 0.24
      const baseDepth = (1 - THREE.MathUtils.smoothstep(v, 0.0, 0.34)) * (1 - absS * 0.35) * 0.48
      const sunMix = THREE.MathUtils.clamp(0.32 + tipGlow + marginTranslucent + softMottle * 0.28 - baseDepth, 0, 1)

      let r = THREE.MathUtils.lerp(pal.deep[0], pal.mid[0], THREE.MathUtils.clamp(sunMix * 1.35, 0, 1))
      let g = THREE.MathUtils.lerp(pal.deep[1], pal.mid[1], THREE.MathUtils.clamp(sunMix * 1.35, 0, 1))
      let b = THREE.MathUtils.lerp(pal.deep[2], pal.mid[2], THREE.MathUtils.clamp(sunMix * 1.35, 0, 1))

      const hiMix = THREE.MathUtils.smoothstep(sunMix, 0.42, 0.98)
      r = THREE.MathUtils.lerp(r, pal.sunlit[0], hiMix * 0.72)
      g = THREE.MathUtils.lerp(g, pal.sunlit[1], hiMix * 0.72)
      b = THREE.MathUtils.lerp(b, pal.sunlit[2], hiMix * 0.68)

      // Warm translucent pale-chartreuse venation lines (replaces stuck-on toothpick cylinders).
      r = THREE.MathUtils.lerp(r, pal.vein[0], veinMask * 0.76) + fineCell * 7
      g = THREE.MathUtils.lerp(g, pal.vein[1], veinMask * 0.76) + fineCell * 8
      b = THREE.MathUtils.lerp(b, pal.vein[2], veinMask * 0.72) + fineCell * 5

      const idx = (y * size + x) * 4
      // Softly cap sRGB channels below Komorebi daylight clip ceiling.
      color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 218)
      color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 224)
      color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 148)
      color[idx + 3] = 255

      // Raised midrib and gentle lateral vein ridges in bump channel.
      const h = THREE.MathUtils.clamp(
        Math.round(122 + midrib * 72 + lateral * 42 + softMottle * 14 + fineCell * 8),
        48,
        228,
      )
      bump[idx] = bump[idx + 1] = bump[idx + 2] = h
      bump[idx + 3] = 255

      // Subtle living waxy leaf cuticle: smooth satin lamina, slightly more matte veins.
      const rv = THREE.MathUtils.clamp(Math.round(168 + veinMask * 34 - tipGlow * 14 + softMottle * 16), 140, 228)
      roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = rv
      roughness[idx + 3] = 255
    }
  }

  const buffers = { color, bump, roughness, size }
  cachedPixels.set(key, buffers)
  return buffers
}

/**
 * Three warm-green translucent Bodhi leaf materials using palmate/pinnate venation
 * maps, `ritual-optics` (`kind: 'leaf'`) backlighting, and cluster-normal wrap
 * lighting (`treeClusterNormals`) so the canopy harmonizes with Komorebi backdrop trees.
 */
export function createBodhiLeafMaterials(): THREE.MeshStandardMaterial[] {
  return [0, 1, 2].map((batchIndex) => {
    const pixels = buildBodhiLeafPixels(batchIndex)
    const map = makeTexture(pixels.color, pixels.size, THREE.SRGBColorSpace, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping)
    const bump = makeTexture(pixels.bump, pixels.size, THREE.NoColorSpace, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping)
    const rough = makeTexture(pixels.roughness, pixels.size, THREE.NoColorSpace, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping)

    const mat = createRitualMaterial(
      {
        color: 0xffffff,
        map,
        bumpMap: bump,
        bumpScale: 0.0058,
        roughnessMap: rough,
        roughness: 0.70,
        metalness: 0,
        envMapIntensity: 0.36,
        vertexColors: true,
      },
      { kind: 'leaf', strength: 0.24 },
    )
    // Enable soft cluster-normal wrap diffuse in toon-soft without muting calibrated vertex colors.
    mat.userData.treeClusterNormals = true
    mat.userData.komorebiPigment = true
    bindTextureDisposal(mat, [map, bump, rough])
    return mat
  })
}

/** Subtle dappled canopy lighting variation across the 144 leaf instances. */
export function bodhiLeafInstanceColor(branch: number, leaf: number, heightNorm: number, out: THREE.Color): THREE.Color {
  const jitter = Math.sin(branch * 2.71 + leaf * 1.93) * 0.036
  const sun = THREE.MathUtils.clamp(heightNorm, 0, 1)
  const r = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.91, 1.04, sun) + jitter, 0.85, 1.06)
  const g = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.94, 1.03, sun) + jitter * 0.9, 0.88, 1.05)
  const b = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.90, 0.95, sun) + jitter * 0.6, 0.82, 1.00)
  return out.setRGB(r, g, b)
}

function buildBodhiBarkPixels(variant: 'main' | 'light'): PixelBuffers {
  const key = `bodhi-bark-${variant}-v1`
  const existing = cachedPixels.get(key)
  if (existing) return existing

  const size = 256
  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)
  const roughness = new Uint8Array(size * size * 4)
  // Pale silvery-grey-beige Ficus religiosa bark anchored to original 0xaaa995 / 0xbdbba7.
  const pal = variant === 'main'
    ? { light: [194, 192, 174], mid: [170, 169, 149], dark: [116, 114, 98], warm: [164, 158, 136], seed: 419 }
    : { light: [208, 206, 188], mid: [189, 187, 167], dark: [134, 131, 114], warm: [182, 176, 154], seed: 547 }

  const pi = Math.PI
  for (let y = 0; y < size; y++) {
    const v = y / size // along trunk/root length
    for (let x = 0; x < size; x++) {
      const u = x / size // mirrored [0..1] around circumference -> cosine harmonics are C1 seam-free
      // Symmetric wrap coordinate avoids any seam on shared-vertex manifold tubes.
      const uSym = 0.5 - 0.5 * Math.cos(u * pi)
      const meander = Math.sin(v * pi * 2 + 0.6) * 0.035 + (periodicNoise(uSym * 2, v * 2, 2, 2, pal.seed + 11) - 0.5) * 0.05
      const uEff = THREE.MathUtils.clamp(u + meander, 0, 1)

      // Restrained shallow vertical bark fissures characteristic of smooth-grey sacred fig trunks.
      const f1 = Math.cos(uEff * pi * 6)
      const f2 = Math.cos(uEff * pi * 12 + 0.55)
      const fissureMask = Math.pow(Math.max(0, -(0.65 * f1 + 0.35 * f2)), 1.55)
      const verticalStretch = periodicNoise(uSym * 6, v * 2, 6, 2, pal.seed + 29) - 0.5
      const fineBark = periodicNoise(uSym * 10, v * 5, 10, 5, pal.seed + 53) - 0.5
      // Faint pale horizontal lenticel bands on smooth grey fig bark.
      const lenticel = THREE.MathUtils.smoothstep(periodicNoise(uSym * 3, v * 12, 3, 12, pal.seed + 79), 0.72, 0.90) * 0.24

      const ridge = Math.max(0, 0.55 * f1 + 0.45 * verticalStretch)
      const groove = THREE.MathUtils.clamp(fissureMask * 0.72 + Math.max(0, -verticalStretch) * 0.38, 0, 1)

      const warmMix = periodicNoise(uSym * 2, v * 3, 2, 3, pal.seed + 97) * 0.45
      let r = THREE.MathUtils.lerp(pal.mid[0], pal.warm[0], warmMix)
      let g = THREE.MathUtils.lerp(pal.mid[1], pal.warm[1], warmMix)
      let b = THREE.MathUtils.lerp(pal.mid[2], pal.warm[2], warmMix)

      r = THREE.MathUtils.lerp(r, pal.light[0], THREE.MathUtils.clamp(ridge * 0.55 + lenticel, 0, 0.68))
      g = THREE.MathUtils.lerp(g, pal.light[1], THREE.MathUtils.clamp(ridge * 0.55 + lenticel, 0, 0.68))
      b = THREE.MathUtils.lerp(b, pal.light[2], THREE.MathUtils.clamp(ridge * 0.55 + lenticel, 0, 0.66))

      r = THREE.MathUtils.lerp(r, pal.dark[0], groove * 0.64) + fineBark * 8
      g = THREE.MathUtils.lerp(g, pal.dark[1], groove * 0.65) + fineBark * 8
      b = THREE.MathUtils.lerp(b, pal.dark[2], groove * 0.68) + fineBark * 7

      const idx = (y * size + x) * 4
      color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 214)
      color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 212)
      color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 196)
      color[idx + 3] = 255

      const h = THREE.MathUtils.clamp(Math.round(132 + ridge * 38 - groove * 52 + fineBark * 16), 44, 216)
      bump[idx] = bump[idx + 1] = bump[idx + 2] = h
      bump[idx + 3] = 255

      const rv = THREE.MathUtils.clamp(Math.round(230 - ridge * 14 + groove * 18), 206, 252)
      roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = rv
      roughness[idx + 3] = 255
    }
  }

  const buffers = { color, bump, roughness, size }
  cachedPixels.set(key, buffers)
  return buffers
}

export function createBodhiBarkMaterials(): {
  bark: THREE.MeshStandardMaterial
  barkLight: THREE.MeshStandardMaterial
} {
  const make = (variant: 'main' | 'light', roughness: number) => {
    const pixels = buildBodhiBarkPixels(variant)
    const map = makeTexture(pixels.color, pixels.size, THREE.SRGBColorSpace, THREE.MirroredRepeatWrapping, THREE.RepeatWrapping, [1, 2.2])
    const bump = makeTexture(pixels.bump, pixels.size, THREE.NoColorSpace, THREE.MirroredRepeatWrapping, THREE.RepeatWrapping, [1, 2.2])
    const rough = makeTexture(pixels.roughness, pixels.size, THREE.NoColorSpace, THREE.MirroredRepeatWrapping, THREE.RepeatWrapping, [1, 2.2])
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap: bump,
      bumpScale: 0.0075,
      roughnessMap: rough,
      roughness,
      metalness: 0,
      envMapIntensity: 0.34,
      vertexColors: true,
    })
    bindTextureDisposal(mat, [map, bump, rough])
    return mat
  }
  return {
    bark: make('main', 0.94),
    barkLight: make('light', 0.93),
  }
}

/**
 * Adds gentle pale-grey bark root/crotch shading onto a closed `tube()` geometry
 * without modifying any vertex position or manifold topology.
 */
export function applyBodhiBarkShading(
  geometry: THREE.BufferGeometry,
  kind: 'trunk' | 'root' | 'branch',
): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const spanY = Math.max(maxY - minY, 1e-4)

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const t = THREE.MathUtils.clamp((y - minY) / spanY, 0, 1)
    let shade = 0
    if (kind === 'trunk') {
      // Subtle warm soil-contact deepening at the base + sunlit crown lift upward.
      shade = (1 - THREE.MathUtils.smoothstep(t, 0.0, 0.28)) * 0.16
    } else if (kind === 'root') {
      // Exposed roots deepen softly where they press into the brown bed soil.
      shade = (1 - THREE.MathUtils.smoothstep(t, 0.0, 0.55)) * 0.20
    } else {
      shade = (1 - t) * 0.10
    }
    colors[i * 3] = THREE.MathUtils.clamp(1.01 - shade * 0.85, 0.78, 1.03)
    colors[i * 3 + 1] = THREE.MathUtils.clamp(1.00 - shade * 0.92, 0.76, 1.02)
    colors[i * 3 + 2] = THREE.MathUtils.clamp(0.98 - shade * 1.05, 0.72, 1.00)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}
