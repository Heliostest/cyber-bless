import * as THREE from 'three'

export type HollyTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type HollyPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

const cachedHollyPixels = new Map<string, HollyPixelBuffers>()

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

// Deep leathery Japanese hiiragi (Osmanthus heterophyllus) evergreen palette anchored to 0x426e42.
const HOLLY_PALETTE = {
  deep: [38, 72, 42] as const,
  mid: [58, 102, 58] as const,
  lit: [82, 128, 72] as const,
  midrib: [134, 162, 94] as const,
  margin: [108, 138, 78] as const,
}

/**
 * Deterministic dark leathery hiiragi (Osmanthus heterophyllus) leaf textures
 * (256x256, zero DOM). UV convention: `u = 0.5` along the central midrib
 * (`0`/`1` along lower/upper spiny margins), `v = 0` at petiole base -> `1` at apex.
 */
export function createHollyLeafTextures(): HollyTextureSet {
  const size = 256
  const key = 'hiiragi-holly-leaf-v1'
  let cached = cachedHollyPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)

    // Lateral veins feeding the two opposite pairs of sharp marginal spines.
    const spineVeins = [0.22, 0.44, 0.67, 0.85] as const

    for (let iy = 0; iy < size; iy++) {
      const v = iy / (size - 1)
      for (let ix = 0; ix < size; ix++) {
        const u = ix / (size - 1)
        const across = Math.abs(u - 0.5) * 2 // 0 at midrib -> 1 at spiny margin

        // Implied luminous olive-green midrib (replaces the old stuck-on cylinder toothpick).
        const ribW = THREE.MathUtils.lerp(0.095, 0.024, Math.pow(v, 0.82))
        const midrib = Math.exp(-Math.pow(across / ribW, 2)) * (1 - THREE.MathUtils.smoothstep(v, 0.91, 1.0) * 0.45)

        // Pinnate lateral veins radiating outward toward the holly spines.
        let lateral = 0
        for (const sv of spineVeins) {
          const dv = Math.abs((v - across * 0.14) - sv)
          lateral = Math.max(lateral, Math.exp(-Math.pow(dv / 0.024, 2)))
        }
        const latMask = THREE.MathUtils.smoothstep(across, 0.05, 0.18)
          * (1 - THREE.MathUtils.smoothstep(across, 0.82, 0.99))
        const lateralVein = lateral * latMask * 0.62

        // Crisp subtle pale-olive cartilaginous margin along the thorny rim.
        const rimBorder = THREE.MathUtils.smoothstep(across, 0.86, 0.98) * 0.48

        const mottle = smoothNoise(u * 5.0, v * 6.0, 419) * 0.6 + smoothNoise(u * 13.0, v * 15.0, 503) * 0.4
        const troughShade = Math.exp(-Math.pow(across / 0.24, 2)) * (1 - midrib) * 0.34
        const baseShade = (1 - THREE.MathUtils.smoothstep(v, 0.0, 0.28)) * 0.34
        const sunMix = THREE.MathUtils.clamp(v * 0.35 + across * 0.28 + (mottle - 0.5) * 0.30, 0, 1)

        let r = THREE.MathUtils.lerp(HOLLY_PALETTE.mid[0], HOLLY_PALETTE.lit[0], sunMix)
        let g = THREE.MathUtils.lerp(HOLLY_PALETTE.mid[1], HOLLY_PALETTE.lit[1], sunMix)
        let b = THREE.MathUtils.lerp(HOLLY_PALETTE.mid[2], HOLLY_PALETTE.lit[2], sunMix)

        const darkAmt = THREE.MathUtils.clamp(troughShade + baseShade, 0, 0.70)
        r = THREE.MathUtils.lerp(r, HOLLY_PALETTE.deep[0], darkAmt)
        g = THREE.MathUtils.lerp(g, HOLLY_PALETTE.deep[1], darkAmt)
        b = THREE.MathUtils.lerp(b, HOLLY_PALETTE.deep[2], darkAmt)

        r = THREE.MathUtils.lerp(r, HOLLY_PALETTE.margin[0], rimBorder)
        g = THREE.MathUtils.lerp(g, HOLLY_PALETTE.margin[1], rimBorder)
        b = THREE.MathUtils.lerp(b, HOLLY_PALETTE.margin[2], rimBorder)

        const veinAmt = THREE.MathUtils.clamp(midrib * 0.82 + lateralVein * 0.48, 0, 0.88)
        r = THREE.MathUtils.lerp(r, HOLLY_PALETTE.midrib[0], veinAmt)
        g = THREE.MathUtils.lerp(g, HOLLY_PALETTE.midrib[1], veinAmt)
        b = THREE.MathUtils.lerp(b, HOLLY_PALETTE.midrib[2], veinAmt)

        const idx = (iy * size + ix) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 184)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 198)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 134)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(126 + midrib * 36 + lateralVein * 24 + rimBorder * 16 + (mottle - 0.5) * 14 - troughShade * 20),
          46,
          216,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        // Glossy leathery cuticle on the dark evergreen lamina, slightly softer along midrib and spine edge.
        const rVal = THREE.MathUtils.clamp(
          Math.round(176 + midrib * 28 + lateralVein * 18 + rimBorder * 20 - (mottle - 0.5) * 14),
          144,
          236,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedHollyPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace),
  }
}

/**
 * Dark leathery waxy-sheen hiiragi holly leaf material with deterministic
 * procedural midrib/vein maps and exact once-only texture disposal.
 */
export function createHollyLeafMaterial(): THREE.MeshPhysicalMaterial {
  const tex = createHollyLeafTextures()
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale: 0.0046,
    roughnessMap: tex.roughness,
    roughness: 0.46,
    metalness: 0,
    clearcoat: 0.42,
    clearcoatRoughness: 0.28,
    specularIntensity: 0.66,
    sheen: 0.14,
    sheenRoughness: 0.68,
    sheenColor: new THREE.Color(0x9ec47c),
    envMapIntensity: 0.38,
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

type HollyStation = {
  v: number
  mid: readonly [number, number]
  bot: readonly [number, number]
  top: readonly [number, number]
  liftBot: number
  liftTop: number
}

// Structured spiny hiiragi contour stations (matched to original [0.035..0.38] x [-0.11..+0.16] envelope).
// Alternating spine lifts give real 3D Osmanthus heterophyllus undulation while staying inside |z| <= 0.013.
const HOLLY_STATIONS: readonly HollyStation[] = [
  { v: 0.09, mid: [0.068, 0.003], bot: [0.072, -0.024], top: [0.068, 0.048], liftBot: -0.0015, liftTop: 0.0020 },
  { v: 0.20, mid: [0.105, 0.006], bot: [0.118, -0.036], top: [0.106, 0.082], liftBot: -0.0020, liftTop: 0.0032 },
  { v: 0.30, mid: [0.140, 0.008], bot: [0.156, -0.074], top: [0.146, 0.102], liftBot: -0.0052, liftTop: 0.0026 },
  { v: 0.39, mid: [0.168, 0.010], bot: [0.184, -0.112], top: [0.175, 0.132], liftBot: -0.0086, liftTop: 0.0058 },
  { v: 0.48, mid: [0.196, 0.012], bot: [0.204, -0.070], top: [0.202, 0.160], liftBot: -0.0026, liftTop: 0.0088 },
  { v: 0.58, mid: [0.228, 0.014], bot: [0.242, -0.074], top: [0.232, 0.098], liftBot: 0.0030, liftTop: 0.0022 },
  { v: 0.68, mid: [0.262, 0.016], bot: [0.296, -0.086], top: [0.268, 0.094], liftBot: 0.0080, liftTop: -0.0036 },
  { v: 0.77, mid: [0.288, 0.017], bot: [0.286, -0.032], top: [0.316, 0.108], liftBot: 0.0024, liftTop: -0.0080 },
  { v: 0.85, mid: [0.318, 0.018], bot: [0.320, -0.020], top: [0.308, 0.056], liftBot: 0.0020, liftTop: -0.0025 },
  { v: 0.93, mid: [0.348, 0.019], bot: [0.348, -0.006], top: [0.346, 0.036], liftBot: 0.0032, liftTop: 0.0020 },
]

/**
 * Builds a thin (~3.5 mm), closed, strictly watertight FrontSide spiny holly leaf
 * solid with alternating spine-tip lift, subtle implied midrib V-fold, smooth
 * pre-computed vertex normals, and matching UVs + vertex colors.
 * Pass `mirrorSign = -1` on the opposite leaf (`rotation.y = Math.PI`) so both
 * opposite leaves present harmonized 3D spine undulation on either face.
 */
export function createSpinyHollyLeafGeometry(mirrorSign: 1 | -1 = 1): THREE.BufferGeometry {
  const segU = 6 // u = -1 -> 0 -> +1 (exact vertex chain along u = 0 midrib!)
  const ringLen = 2 * segU + 2

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const writeColor = (u: number, v: number, lift: number) => {
    const across = Math.abs(u)
    const midShadow = Math.exp(-across * across * 9.0) * 0.06
    const tipBoost = THREE.MathUtils.smoothstep(across, 0.65, 1.0) * 0.05 + Math.abs(lift) * 3.5
    const baseShade = (1 - THREE.MathUtils.smoothstep(v, 0.0, 0.25)) * 0.08
    const r = THREE.MathUtils.clamp(0.96 - baseShade - midShadow + tipBoost, 0.78, 1.05)
    const g = THREE.MathUtils.clamp(0.99 - baseShade * 0.85 - midShadow * 0.7 + tipBoost * 0.9, 0.82, 1.06)
    const b = THREE.MathUtils.clamp(0.96 - baseShade * 0.9 - midShadow * 0.85 + tipBoost * 0.4, 0.76, 1.02)
    colors.push(r, g, b)
  }

  const evalPoint = (st: HollyStation, u: number): [number, number, number, number] => {
    const across = Math.abs(u)
    const edge = u >= 0 ? st.top : st.bot
    const x = THREE.MathUtils.lerp(st.mid[0], edge[0], across)
    const y = THREE.MathUtils.lerp(st.mid[1], edge[1], across)
    const rawLift = u >= 0 ? st.liftTop : st.liftBot
    // Gentle midrib V-fold + alternating spine lift concentrated smoothly toward each thorny tip.
    const fold = mirrorSign * (0.0038 * (Math.pow(across, 1.15) - 0.18 * Math.pow(across, 3.0)) - 0.0022) * Math.sin(Math.PI * st.v)
    const undulation = mirrorSign * rawLift * Math.pow(across, 1.30)
    const z = fold + undulation
    return [x, y, z, rawLift]
  }

  // Vertex 0: tapered petiole base
  positions.push(0.035, 0.000, 0.000)
  uvs.push(0.5, 0)
  writeColor(0, 0, 0)

  // Structured closed cross-section rings from base to apex
  for (const st of HOLLY_STATIONS) {
    const lenThick = 0.68 + 0.32 * Math.sin(Math.PI * st.v)
    // +Z face: u = -1 (bot) -> +1 (top)
    for (let iu = 0; iu <= segU; iu++) {
      const uUv = iu / segU
      const u = uUv * 2 - 1
      const [x, y, z, rawLift] = evalPoint(st, u)
      const halfT = (0.00095 + 0.00072 * (1 - u * u) + 0.00048 * Math.exp(-u * u * 20)) * lenThick
      positions.push(x, y, z + halfT)
      uvs.push(uUv, st.v)
      writeColor(u, st.v, rawLift)
    }
    // -Z face: u = +1 (top) -> -1 (bot)
    for (let iu = segU; iu >= 0; iu--) {
      const uUv = iu / segU
      const u = uUv * 2 - 1
      const [x, y, z, rawLift] = evalPoint(st, u)
      const halfT = (0.00095 + 0.00072 * (1 - u * u) + 0.00054 * Math.exp(-u * u * 20)) * lenThick
      positions.push(x, y, z - halfT)
      uvs.push(uUv, st.v)
      writeColor(u, st.v, rawLift)
    }
  }

  // Final vertex: pointed apical spine
  const tipIndex = positions.length / 3
  positions.push(0.380, 0.020, mirrorSign * 0.0055)
  uvs.push(0.5, 1)
  writeColor(0, 1, 0.0055)

  const ringStart = (ri: number) => 1 + ri * ringLen
  const numRings = HOLLY_STATIONS.length

  // Base cap fan (outward -X)
  const r0 = ringStart(0)
  for (let k = 0; k < ringLen; k++) {
    const kn = (k + 1) % ringLen
    indices.push(0, r0 + kn, r0 + k)
  }

  // Band quads between consecutive stations
  for (let ri = 0; ri < numRings - 1; ri++) {
    const a = ringStart(ri)
    const b = ringStart(ri + 1)
    for (let k = 0; k < ringLen; k++) {
      const kn = (k + 1) % ringLen
      indices.push(a + k, a + kn, b + kn)
      indices.push(a + k, b + kn, b + k)
    }
  }

  // Apex cap fan (outward +X)
  const rLast = ringStart(numRings - 1)
  for (let k = 0; k < ringLen; k++) {
    const kn = (k + 1) % ringLen
    indices.push(tipIndex, rLast + k, rLast + kn)
  }

  // Verify outward winding via signed volume and flip if needed before normal computation.
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), cross = new THREE.Vector3()
  let volume = 0
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]! * 3, ib = indices[i + 1]! * 3, ic = indices[i + 2]! * 3
    va.set(positions[ia]!, positions[ia + 1]!, positions[ia + 2]!)
    vb.set(positions[ib]!, positions[ib + 1]!, positions[ib + 2]!)
    vc.set(positions[ic]!, positions[ic + 1]!, positions[ic + 2]!)
    volume += va.dot(cross.crossVectors(vb, vc)) / 6
  }
  if (volume < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1]!
      indices[i + 1] = indices[i + 2]!
      indices[i + 2] = tmp
    }
  }

  const indexed = new THREE.BufferGeometry()
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  indexed.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  indexed.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  indexed.setIndex(indices)
  // Compute smooth outward vertex normals BEFORE expanding to non-indexed so the leathery blade catches clean glossy highlights.
  indexed.computeVertexNormals()
  const nonIndexed = indexed.toNonIndexed()
  indexed.dispose()
  nonIndexed.computeBoundingBox()
  nonIndexed.computeBoundingSphere()
  return nonIndexed
}
