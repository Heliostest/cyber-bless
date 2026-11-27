import * as THREE from 'three'

export type SakakiLeafTone = 0 | 1 | 2

export type SakakiTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type SakakiPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

type SakakiPalette = {
  /** Deep lush sakaki lamina near base and midrib recess. */
  deep: readonly [number, number, number]
  /** Primary Cleyera japonica evergreen blade body. */
  mid: readonly [number, number, number]
  /** Warm sunlit outer blade & apex tint (capped safely for Komorebi daylight). */
  sunlit: readonly [number, number, number]
  /** Pale yellow-green central midrib and delicate pinnate veins. */
  vein: readonly [number, number, number]
  /** Subtle warm olive-jade margin accent. */
  margin: readonly [number, number, number]
  seed: number
}

/**
 * Three harmonious sakaki (Cleyera japonica) tones anchored to the scene's
 * original leaf palette (0x608c49, 0x78a455, 0x4c7945). Peak sRGB values stay
 * comfortably below Komorebi daylight's linear clip shoulder.
 */
export const SAKAKI_LEAF_PALETTES: Record<SakakiLeafTone, SakakiPalette> = {
  0: {
    deep: [58, 96, 48],
    mid: [88, 134, 66],
    sunlit: [122, 162, 82],
    vein: [160, 186, 104],
    margin: [72, 114, 56],
    seed: 103,
  },
  1: {
    deep: [74, 114, 54],
    mid: [108, 152, 76],
    sunlit: [142, 178, 92],
    vein: [176, 198, 114],
    margin: [90, 132, 66],
    seed: 227,
  },
  2: {
    deep: [48, 84, 46],
    mid: [72, 116, 62],
    sunlit: [102, 146, 76],
    vein: [144, 172, 98],
    margin: [60, 98, 52],
    seed: 359,
  },
}

const cachedSakakiPixels = new Map<string, SakakiPixelBuffers>()

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function smoothNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}

function buildDataTexture(
  source: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), size, size)
  tex.colorSpace = colorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

/**
 * Deterministic stylized Cleyera japonica (sakaki) leaf textures (256x256, zero DOM).
 * UV convention: `u = 0.5` along the central midrib (`0`/`1` at left/right margins),
 * `v = 0` at the petiole base and `v = 1` at the pointed apex.
 */
export function createSakakiLeafTextures(tone: SakakiLeafTone): SakakiTextureSet {
  const size = 256
  const key = `sakaki-leaf-${tone}-v1`
  let cached = cachedSakakiPixels.get(key)
  if (!cached) {
    const pal = SAKAKI_LEAF_PALETTES[tone]
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)

    for (let iy = 0; iy < size; iy++) {
      const v = iy / (size - 1)
      for (let ix = 0; ix < size; ix++) {
        const u = ix / (size - 1)
        const across = Math.abs(u - 0.5) * 2 // 0 at midrib -> 1 at leaf margin

        // Tapered central midrib running cleanly from petiole base to apex.
        const ribWidth = THREE.MathUtils.lerp(0.085, 0.022, Math.pow(v, 0.85))
        const midrib = Math.exp(-Math.pow(across / ribWidth, 2)) * (1 - THREE.MathUtils.smoothstep(v, 0.90, 1.0) * 0.55)

        // 6 pairs of soft arcuate pinnate lateral veins curving gently forward toward the margins.
        const veinArc = v - across * 0.24 - across * across * 0.14
        const veinFreq = veinArc * 6.5
        const veinDist = Math.abs((veinFreq - Math.floor(veinFreq)) - 0.5) * 2 // 0 on vein, 1 midway
        const veinBand = Math.exp(-Math.pow(veinDist / 0.17, 2))
        const veinMask = THREE.MathUtils.smoothstep(across, 0.05, 0.18)
          * (1 - THREE.MathUtils.smoothstep(across, 0.72, 0.96))
          * THREE.MathUtils.smoothstep(v, 0.08, 0.22)
          * (1 - THREE.MathUtils.smoothstep(v, 0.82, 0.97))
        const lateralVein = veinBand * veinMask * 0.55

        // Gentle chlorophyll depth: richer near base/midrib, softly warmer sunlit jade toward outer blade & apex.
        const mottle = smoothNoise(u * 5.0, v * 6.0, pal.seed + 17) * 0.62
          + smoothNoise(u * 12.0 + 3.1, v * 14.0 + 1.9, pal.seed + 43) * 0.38
        const baseShade = (1 - THREE.MathUtils.smoothstep(v, 0.0, 0.34)) * 0.44
        const midribTrough = Math.exp(-Math.pow(across / 0.22, 2)) * (1 - midrib) * 0.22
        const sunGrad = THREE.MathUtils.clamp(
          v * 0.48 + across * 0.22 + (mottle - 0.5) * 0.34,
          0,
          1,
        )
        const marginRim = THREE.MathUtils.smoothstep(across, 0.84, 1.0) * 0.32

        let r = THREE.MathUtils.lerp(pal.mid[0], pal.sunlit[0], sunGrad)
        let g = THREE.MathUtils.lerp(pal.mid[1], pal.sunlit[1], sunGrad)
        let b = THREE.MathUtils.lerp(pal.mid[2], pal.sunlit[2], sunGrad)

        const shadeAmt = THREE.MathUtils.clamp(baseShade + midribTrough, 0, 0.68)
        r = THREE.MathUtils.lerp(r, pal.deep[0], shadeAmt)
        g = THREE.MathUtils.lerp(g, pal.deep[1], shadeAmt)
        b = THREE.MathUtils.lerp(b, pal.deep[2], shadeAmt)

        r = THREE.MathUtils.lerp(r, pal.margin[0], marginRim)
        g = THREE.MathUtils.lerp(g, pal.margin[1], marginRim)
        b = THREE.MathUtils.lerp(b, pal.margin[2], marginRim)

        const veinHighlight = THREE.MathUtils.clamp(midrib * 0.78 + lateralVein * 0.46, 0, 0.85)
        r = THREE.MathUtils.lerp(r, pal.vein[0], veinHighlight)
        g = THREE.MathUtils.lerp(g, pal.vein[1], veinHighlight)
        b = THREE.MathUtils.lerp(b, pal.vein[2], veinHighlight)

        const idx = (iy * size + ix) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 198)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 212)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 146)
        color[idx + 3] = 255

        // Soft waxy lamina quilting between lateral veins + delicate raised midrib.
        const quilt = Math.sin(veinDist * Math.PI) * veinMask * 14
        const h = THREE.MathUtils.clamp(
          Math.round(124 + midrib * 34 + lateralVein * 22 + quilt + (mottle - 0.5) * 14 - midribTrough * 18),
          48,
          214,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        // Waxy cuticle sheen on smooth lamina, gently more matte along veins and margins.
        const rVal = THREE.MathUtils.clamp(
          Math.round(196 + midrib * 24 + lateralVein * 14 + marginRim * 24 - (mottle - 0.5) * 16),
          164,
          244,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedSakakiPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace),
  }
}

/**
 * Three waxy, soft-sheen stylized sakaki leaf materials (one per tone) with
 * deterministic DataTextures and exact once-only texture disposal.
 */
export function createSakakiLeafMaterials(): [
  THREE.MeshPhysicalMaterial,
  THREE.MeshPhysicalMaterial,
  THREE.MeshPhysicalMaterial,
] {
  const tones: readonly SakakiLeafTone[] = [0, 1, 2]
  return tones.map((tone) => {
    const tex = createSakakiLeafTextures(tone)
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.map,
      bumpMap: tex.bump,
      bumpScale: 0.0044,
      roughnessMap: tex.roughness,
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.28,
      clearcoatRoughness: 0.34,
      specularIntensity: 0.56,
      sheen: 0.18,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color(0xc2d878),
      envMapIntensity: 0.36,
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
  }) as [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
}

// Pre-normalized elliptic-obovate sakaki silhouette profile (widest around v = 0.54).
function sakakiWidthFactor(v: number): number {
  if (v <= 0 || v >= 1) return 0
  const raw = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.86)), 0.74)
    * (0.86 + 0.20 * Math.sin(Math.PI * Math.pow(v, 1.32)))
  // Analytic peak is ~1.053 around v = 0.54; normalize cleanly so max <= 1.0.
  return Math.min(1, raw / 1.055)
}

export type SakakiLeafGeometryOptions = {
  /** Subtle asymmetric organic twist across the leaf (radians-equivalent offset). */
  twist?: number
  /** Longitudinal arch amplitude in meters. */
  arch?: number
  /** Midrib V-fold depth in meters. */
  fold?: number
}

/**
 * Builds a closed, strictly watertight, manifold FrontSide sakaki leaf solid
 * inside the exact `[-w, +w] x [-l, +l]` footprint (petiole base at `-l`,
 * pointed acuminate apex at `+l`). Features a natural midrib V-fold, soft
 * longitudinal arch, rounded thin margin, and living base-to-tip vertex shading.
 */
export function createSakakiLeafGeometry(
  halfWidth: number,
  halfLength: number,
  options: SakakiLeafGeometryOptions = {},
): THREE.BufferGeometry {
  const segV = 10
  const segU = 6
  const ringLen = 2 * segU + 2 // top[0..segU] + bot[segU..0]
  const twist = options.twist ?? 0
  const archAmp = options.arch ?? 0.013
  const foldAmp = options.fold ?? 0.012

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const writeColor = (u: number, v: number, isTop: boolean) => {
    const across = Math.abs(u)
    const midDip = Math.exp(-across * across * 7.5) * 0.065
    const baseDepth = (1 - THREE.MathUtils.smoothstep(v, 0, 0.30)) * 0.09
    const tipWarm = THREE.MathUtils.smoothstep(v, 0.55, 1.0) * 0.065
    const underSoft = isTop ? 1.0 : 0.92
    const r = THREE.MathUtils.clamp((0.97 - baseDepth - midDip + tipWarm) * underSoft, 0.76, 1.04)
    const g = THREE.MathUtils.clamp((0.99 - baseDepth * 0.85 - midDip * 0.75 + tipWarm * 0.8) * (isTop ? 1.0 : 0.96), 0.80, 1.04)
    const b = THREE.MathUtils.clamp((0.95 - baseDepth * 0.9 - midDip * 0.9 + tipWarm * 0.3) * (isTop ? 1.0 : 0.93), 0.72, 1.00)
    colors.push(r, g, b)
  }

  const surfaceY = (u: number, v: number): number => {
    const sinV = Math.sin(Math.PI * v)
    const across = Math.abs(u)
    // Gentle midrib V-trough softening toward the outer lamina margin.
    const vFold = foldAmp * (Math.pow(across, 1.12) - 0.24 * Math.pow(across, 3.0)) * sinV
    // Graceful longitudinal bow from petiole to subtly drooping apex.
    const bow = archAmp * Math.sin(Math.PI * Math.pow(v, 0.84)) - archAmp * 0.28
    const organicTwist = twist * u * (v - 0.45) * sinV
    return bow + vFold + organicTwist
  }

  // Vertex 0: tapered petiole base apex at z = -halfLength
  const baseY = surfaceY(0, 0)
  positions.push(0, baseY, -halfLength)
  uvs.push(0.5, 0)
  writeColor(0, 0, true)

  // Intermediate closed cross-section rings (iv = 1 .. segV - 1)
  for (let iv = 1; iv < segV; iv++) {
    const v = iv / segV
    const z = (v * 2 - 1) * halfLength
    const wHere = halfWidth * sakakiWidthFactor(v)
    const lenThick = 0.62 + 0.38 * Math.sin(Math.PI * v)

    // Top half of ring: u = -1 -> +1
    for (let iu = 0; iu <= segU; iu++) {
      const uUv = iu / segU
      const u = uUv * 2 - 1
      const x = u * wHere
      const halfT = (0.00105 + 0.00105 * (1 - u * u) + 0.00065 * Math.exp(-u * u * 18)) * lenThick
      positions.push(x, surfaceY(u, v) + halfT, z)
      uvs.push(uUv, v)
      writeColor(u, v, true)
    }

    // Bottom half of ring: u = +1 -> -1 (slightly prominent underside midrib keel)
    for (let iu = segU; iu >= 0; iu--) {
      const uUv = iu / segU
      const u = uUv * 2 - 1
      const x = u * wHere
      const halfT = (0.00105 + 0.00110 * (1 - u * u) + 0.00105 * Math.exp(-u * u * 18)) * lenThick
      positions.push(x, surfaceY(u, v) - halfT, z)
      uvs.push(uUv, v)
      writeColor(u, v, false)
    }
  }

  // Last vertex: pointed acuminate leaf apex at z = +halfLength
  const tipIndex = positions.length / 3
  const tipY = surfaceY(0, 1) - 0.003
  positions.push(0, tipY, halfLength)
  uvs.push(0.5, 1)
  writeColor(0, 1, true)

  const ringStart = (iv: number) => 1 + (iv - 1) * ringLen

  // Base cap fan (outward -Z)
  const r1 = ringStart(1)
  for (let k = 0; k < ringLen; k++) {
    const kn = (k + 1) % ringLen
    indices.push(0, r1 + k, r1 + kn)
  }

  // Side bands between consecutive rings (outward normals all around)
  for (let iv = 1; iv < segV - 1; iv++) {
    const a = ringStart(iv)
    const b = ringStart(iv + 1)
    for (let k = 0; k < ringLen; k++) {
      const kn = (k + 1) % ringLen
      indices.push(a + k, b + k, b + kn)
      indices.push(a + k, b + kn, a + kn)
    }
  }

  // Tip cap fan (outward +Z)
  const rLast = ringStart(segV - 1)
  for (let k = 0; k < ringLen; k++) {
    const kn = (k + 1) % ringLen
    indices.push(tipIndex, rLast + kn, rLast + k)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}
