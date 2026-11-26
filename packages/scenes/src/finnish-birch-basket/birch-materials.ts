import * as THREE from 'three'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'

export type BirchBarkTone = 0 | 1 | 2 | 3 | 'edge'

export type BirchTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type BirchPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

type BirchPalette = {
  light: readonly [number, number, number]
  mid: readonly [number, number, number]
  warm: readonly [number, number, number]
  dark: readonly [number, number, number]
  lenticel: readonly [number, number, number]
  halo: readonly [number, number, number]
  seed: number
  roughness: number
  clearcoat: number
}

/**
 * Warm stylized Finnish birch-bark (tuohi) palettes harmonized with the pale
 * birch craft table. Rich honey-amber and toasted-cinnamon chroma keeps basket
 * walls cozy under Komorebi's cool sky/grass bounce rather than drifting olive,
 * while capping peaks below Komorebi's daylight clip shoulder.
 */
export const BIRCH_BARK_PALETTES: Record<BirchBarkTone, BirchPalette> = {
  0: {
    light: [232, 178, 108],
    mid: [212, 152, 84],
    warm: [224, 166, 96],
    dark: [158, 100, 48],
    lenticel: [110, 62, 28],
    halo: [236, 190, 124],
    seed: 103,
    roughness: 0.72,
    clearcoat: 0.14,
  },
  1: {
    light: [238, 196, 128],
    mid: [224, 176, 106],
    warm: [234, 188, 118],
    dark: [172, 118, 60],
    lenticel: [120, 72, 34],
    halo: [238, 204, 140],
    seed: 227,
    roughness: 0.70,
    clearcoat: 0.16,
  },
  2: {
    light: [238, 206, 144],
    mid: [228, 189, 122],
    warm: [235, 198, 134],
    dark: [180, 132, 74],
    lenticel: [126, 78, 38],
    halo: [238, 210, 150],
    seed: 331,
    roughness: 0.71,
    clearcoat: 0.15,
  },
  3: {
    light: [220, 158, 90],
    mid: [198, 134, 68],
    warm: [210, 148, 80],
    dark: [142, 84, 38],
    lenticel: [96, 52, 22],
    halo: [228, 170, 102],
    seed: 443,
    roughness: 0.74,
    clearcoat: 0.13,
  },
  edge: {
    light: [204, 144, 82],
    mid: [178, 118, 62],
    warm: [192, 132, 72],
    dark: [124, 74, 36],
    lenticel: [88, 48, 22],
    halo: [212, 154, 92],
    seed: 557,
    roughness: 0.75,
    clearcoat: 0.12,
  },
}

const cachedBirchPixels = new Map<string, BirchPixelBuffers>()

function birchHash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicBirchNoise(x: number, y: number, px: number, py: number, seed: number): number {
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
  const a = birchHash(x0, y0, seed)
  const b = birchHash(x1, y0, seed)
  const c = birchHash(x0, y1, seed)
  const d = birchHash(x1, y1, seed)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}

function wrapDelta(a: number, b: number, period: number): number {
  let d = a - b
  if (d > period * 0.5) d -= period
  else if (d < -period * 0.5) d += period
  return d
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
 * Deterministic stylized birch-bark (tuohi) strip textures (256x256, zero DOM dependency).
 * `u` runs along the peeled birch-bark strip and `v` across its width, presenting
 * honey-warm inner-bark layers, silky longitudinal fibers, and sparse horizontal
 * lenticel flecks without photoreal peeling-bark noise.
 */
export function createBirchBarkTextures(
  tone: BirchBarkTone,
  repeat: readonly [number, number] = [1, 1],
  offset: readonly [number, number] = [0, 0],
): BirchTextureSet {
  const size = 256
  const cacheKey = `birch-bark-${tone}-v1`
  let cached = cachedBirchPixels.get(cacheKey)
  if (!cached) {
    const pal = BIRCH_BARK_PALETTES[tone]
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const phaseA = birchHash(pal.seed, 11, 5) * tau
    const phaseB = birchHash(pal.seed, 29, 9) * tau

    // Precompute sparse, well-spaced horizontal lenticel flecks on a periodic lattice.
    const cols = 4
    const rows = 7
    const flecks: { cx: number; cy: number; rx: number; ry: number; weight: number }[] = []
    for (let ryIdx = 0; ryIdx < rows; ryIdx++) {
      for (let rxIdx = 0; rxIdx < cols; rxIdx++) {
        if (birchHash(rxIdx, ryIdx, pal.seed + 71) > 0.62) continue
        const jx = 0.18 + 0.64 * birchHash(rxIdx, ryIdx, pal.seed + 97)
        const jy = 0.22 + 0.56 * birchHash(rxIdx, ryIdx, pal.seed + 131)
        const len = 0.068 + 0.064 * birchHash(rxIdx, ryIdx, pal.seed + 157)
        const thick = 0.015 + 0.011 * birchHash(rxIdx, ryIdx, pal.seed + 181)
        const weight = 0.66 + 0.32 * birchHash(rxIdx, ryIdx, pal.seed + 211)
        flecks.push({
          cx: (rxIdx + jx) / cols,
          cy: (ryIdx + jy) / rows,
          rx: len,
          ry: thick,
          weight,
        })
      }
    }

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size

        // Soft organic inner-bark layer drift along strip length `u`.
        const drift = Math.sin(u * tau + phaseA) * 0.032
          + (periodicBirchNoise(u * 2, v * 3, 2, 3, pal.seed + 17) - 0.5) * 0.048
        const vw = v + drift

        // Honey-warm layered bark ply bands across the strip width `v`.
        const plyBand = 0.5 + 0.5 * (
          0.62 * Math.sin(vw * tau * 2 + phaseB)
          + 0.38 * Math.sin(vw * tau * 4 + phaseB * 1.4 + 0.8)
        )
        const plyNoise = periodicBirchNoise(u * 2, vw * 5, 2, 5, pal.seed + 37)
        const layerMix = THREE.MathUtils.clamp(plyBand * 0.52 + plyNoise * 0.48, 0, 1)

        // Silky fine longitudinal bark grain along `u`.
        const fineGrain = (periodicBirchNoise(u * 3, vw * 14, 3, 14, pal.seed + 53) - 0.5) * 0.72
          + Math.sin(vw * tau * 8 + phaseA) * 0.24

        // Sparse elongated horizontal birch lenticel dashes + subtle warm top halo.
        let lenticelAmt = 0
        let haloAmt = 0
        for (let f = 0; f < flecks.length; f++) {
          const fl = flecks[f]!
          const du = wrapDelta(u, fl.cx, 1) / fl.rx
          const dv = wrapDelta(v, fl.cy, 1) / fl.ry
          const d2 = du * du + dv * dv
          if (d2 < 3.6) {
            const dist = Math.sqrt(d2)
            const dash = (1 - THREE.MathUtils.smoothstep(dist, 0.35, 1.05)) * fl.weight
            if (dash > lenticelAmt) lenticelAmt = dash
            const dvHalo = wrapDelta(v, fl.cy + fl.ry * 0.75, 1) / (fl.ry * 1.65)
            const hDist = Math.sqrt(du * du * 0.85 + dvHalo * dvHalo)
            const halo = (1 - THREE.MathUtils.smoothstep(hDist, 0.35, 1.2)) * fl.weight * 0.36
            if (halo > haloAmt) haloAmt = halo
          }
        }

        // Gentle strip-edge bevel shading near `v = 0` and `v = 1` keeps woven strips crisp.
        const edgeDist = Math.min(v, 1 - v)
        const edgeBevel = (1 - THREE.MathUtils.smoothstep(edgeDist, 0.0, 0.11)) * 0.26

        const baseR = THREE.MathUtils.lerp(pal.mid[0], pal.warm[0], layerMix)
        const baseG = THREE.MathUtils.lerp(pal.mid[1], pal.warm[1], layerMix)
        const baseB = THREE.MathUtils.lerp(pal.mid[2], pal.warm[2], layerMix)

        const lift = Math.max(0, fineGrain) * 0.48 + Math.max(0, layerMix - 0.55) * 0.55
        const dip = Math.max(0, -fineGrain) * 0.42 + edgeBevel

        let outR = THREE.MathUtils.lerp(baseR, pal.light[0], THREE.MathUtils.clamp(lift, 0, 0.62))
        let outG = THREE.MathUtils.lerp(baseG, pal.light[1], THREE.MathUtils.clamp(lift, 0, 0.62))
        let outB = THREE.MathUtils.lerp(baseB, pal.light[2], THREE.MathUtils.clamp(lift, 0, 0.60))

        outR = THREE.MathUtils.lerp(outR, pal.halo[0], haloAmt * (1 - lenticelAmt))
        outG = THREE.MathUtils.lerp(outG, pal.halo[1], haloAmt * (1 - lenticelAmt))
        outB = THREE.MathUtils.lerp(outB, pal.halo[2], haloAmt * (1 - lenticelAmt))

        outR = THREE.MathUtils.lerp(outR, pal.dark[0], THREE.MathUtils.clamp(dip, 0, 0.72))
        outG = THREE.MathUtils.lerp(outG, pal.dark[1], THREE.MathUtils.clamp(dip, 0, 0.74))
        outB = THREE.MathUtils.lerp(outB, pal.dark[2], THREE.MathUtils.clamp(dip, 0, 0.76))

        outR = THREE.MathUtils.lerp(outR, pal.lenticel[0], THREE.MathUtils.clamp(lenticelAmt * 0.88, 0, 0.9))
        outG = THREE.MathUtils.lerp(outG, pal.lenticel[1], THREE.MathUtils.clamp(lenticelAmt * 0.90, 0, 0.9))
        outB = THREE.MathUtils.lerp(outB, pal.lenticel[2], THREE.MathUtils.clamp(lenticelAmt * 0.92, 0, 0.92))

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(outR), 0, 238)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(outG), 0, 208)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(outB), 0, 152)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + (layerMix - 0.5) * 26 + fineGrain * 22 - lenticelAmt * 42 - edgeBevel * 32),
          38,
          216,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        // Soft satin birch-bark ply (~0.76 multiplier) vs matte lenticel dashes & grooves (~0.98).
        const rVal = THREE.MathUtils.clamp(
          Math.round(210 - (layerMix - 0.5) * 20 + lenticelAmt * 38 + edgeBevel * 24),
          178,
          252,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedBirchPixels.set(cacheKey, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, repeat, offset),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, repeat, offset),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, repeat, offset),
  }
}

function makeBirchBarkMaterial(
  tone: BirchBarkTone,
  repeat: readonly [number, number],
  offset: readonly [number, number],
  opts: { vertexColors?: boolean; side?: THREE.Side; bumpScale?: number } = {},
): THREE.MeshPhysicalMaterial {
  const pal = BIRCH_BARK_PALETTES[tone]
  const tex = createBirchBarkTextures(tone, repeat, offset)
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale: opts.bumpScale ?? 0.0056,
    roughnessMap: tex.roughness,
    roughness: pal.roughness,
    metalness: 0,
    clearcoat: pal.clearcoat,
    clearcoatRoughness: 0.46,
    specularIntensity: 0.46,
    envMapIntensity: 0.28,
    ...(opts.vertexColors ? { vertexColors: true } : {}),
    ...(opts.side !== undefined ? { side: opts.side } : {}),
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

export type BirchBasketMaterials = {
  /** Four honey-layered birch-bark strip materials with vertex recess shading. */
  barkStrip: readonly [
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
  ]
  /** Solid birch-bark materials for base, rim grip, strap loops, handle arch, and offcuts. */
  barkSolid: readonly [
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
  ]
  /** Warm toasted cinnamon birch-bark hoops binding the basket rim. */
  rimBark: THREE.MeshPhysicalMaterial
  /** Matching solid edge bark for handle feet. */
  footBark: THREE.MeshPhysicalMaterial
  /** Light Nordic carved birch wood for the wooden grain scoop (bowl & stem along X). */
  scoopWood: THREE.MeshPhysicalMaterial
}

/**
 * Stylized Finnish birch-bark & carved birch scoop material suite.
 * Leaves the already-upgraded `addCraftTable` bench untouched.
 */
export function createBirchBasketMaterials(): BirchBasketMaterials {
  const stripTones: readonly (0 | 1 | 2 | 3)[] = [0, 1, 2, 3]
  const barkStrip = stripTones.map((tone) =>
    makeBirchBarkMaterial(tone, [1, 1], [tone * 0.21, tone * 0.13], {
      vertexColors: true,
      side: THREE.DoubleSide,
      bumpScale: 0.0060,
    }),
  ) as [
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
    THREE.MeshPhysicalMaterial,
  ]

  const solidTones: readonly (0 | 1 | 2)[] = [0, 1, 2]
  const barkSolid = solidTones.map((tone) =>
    makeBirchBarkMaterial(tone, [1.4, 1], [tone * 0.27, 0.08], {
      vertexColors: false,
      bumpScale: 0.0052,
    }),
  ) as [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]

  const rimBark = makeBirchBarkMaterial('edge', [7.5, 1], [0.12, 0], {
    vertexColors: false,
    bumpScale: 0.0062,
  })
  const footBark = makeBirchBarkMaterial('edge', [1, 1], [0.42, 0.2], {
    vertexColors: false,
    bumpScale: 0.0050,
  })

  const scoopWood = applyCraftSurface(
    new THREE.MeshPhysicalMaterial({
      color: 0xd9bc8c,
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.14,
      clearcoatRoughness: 0.42,
      specularIntensity: 0.48,
      envMapIntensity: 0.42,
    }),
    { kind: 'wood', axis: 'x', scale: 1.15, strength: 0.58 },
  )

  return { barkStrip, barkSolid, rimBark, footBark, scoopWood }
}

/**
 * Writes warm toasted-caramel over/under weave recess vertex colors onto a birch-bark strip
 * vertex. Drops blue faster than red in tucked crossings so weave shadows stay cozy amber.
 */
export function writeBirchStripVertexColor(
  target: number[],
  overWave: number,
  heightNorm: number,
  isInnerFace: boolean,
  stripPhase: number,
): void {
  // overWave in [-1, 1]: +1 arches outward over crossing strip, -1 tucks into recess.
  const tuck = Math.pow((1 - THREE.MathUtils.clamp(overWave, -1, 1)) * 0.5, 1.2)
  const baseShade = (1 - THREE.MathUtils.smoothstep(heightNorm, 0.0, 0.30)) * 0.16
  const rimTuck = THREE.MathUtils.smoothstep(heightNorm, 0.88, 1.0) * 0.16
  const innerShade = isInnerFace ? 0.14 : 0.0
  const recess = THREE.MathUtils.clamp(tuck * 0.38 + baseShade + rimTuck + innerShade, 0, 0.72)
  const warmDrift = Math.sin(heightNorm * Math.PI * 2 + stripPhase) * 0.03

  const r = THREE.MathUtils.clamp(1.04 - recess * 0.18 + warmDrift, 0.78, 1.06)
  const g = THREE.MathUtils.clamp(1.015 - recess * 0.25 + warmDrift * 0.75, 0.68, 1.04)
  const b = THREE.MathUtils.clamp(0.98 - recess * 0.35 + warmDrift * 0.45, 0.54, 1.02)
  target.push(r, g, b)
}

/**
 * Remaps ExtrudeGeometry UVs on the curved birch-bark handle arch so lenticel flecks
 * and honey bark layers bend smoothly along the handle curve instead of stretching flat.
 * Leaves vertex positions, normals, indices, and bounds untouched.
 */
export function applyBirchHandleArchUvs(geometry: THREE.BufferGeometry, originY: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const uvs = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i) + originY
    const z = pos.getZ(i)
    const angle = Math.atan2(x / 0.63, Math.max(y, 0.0001) / 0.55)
    const radial = Math.hypot(x / 0.63, y / 0.55)
    const rNorm = THREE.MathUtils.clamp((radial - 0.96) / 0.08, 0, 1)
    const across = Math.abs(z) > 0.012 ? rNorm : THREE.MathUtils.clamp((z + 0.015) / 0.03, 0, 1)
    uvs[i * 2] = angle * 0.78 + 0.5
    uvs[i * 2 + 1] = 0.08 + across * 0.84
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
}
