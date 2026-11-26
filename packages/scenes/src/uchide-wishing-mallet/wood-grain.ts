import * as THREE from 'three'

export type WoodKnot = {
  /** Longitudinal position in texture UV space (0..1 along grain). */
  along: number
  /** Transverse position in texture UV space (0..1 across grain). */
  across: number
  /** Half-length along the grain (knots elongate with fiber direction). */
  radiusAlong: number
  /** Half-width across the grain. */
  radiusAcross: number
  /** Streamline deflection amount pushing surrounding fibers around the knot. */
  deflect: number
  /** Visual intensity of the warm knot core and concentric rings (0..1). */
  strength?: number
}

export type StylizedWoodSpec = {
  key: string
  width?: number
  height?: number
  seed: number
  /** Warm sunlit earlywood sRGB hex. */
  earlywood: string
  /** Richer latewood grain vein sRGB hex. */
  latewood: string
  /** Soft warm umber knot core sRGB hex. */
  knotCore: string
  /** Subtle warm golden halo around knot compression zone sRGB hex. */
  knotHalo?: string
  /** Base annual ring count across V (0..1). */
  ringFreq: number
  /** Organic low-frequency grain flow amplitude (in V units). */
  flowAmp: number
  /** Gentle cathedral arch curvature along U. */
  archAmp?: number
  /** Subtle warm/cool painterly plank wash (0..0.15). */
  washStrength?: number
  /** Optional sparse stylized knots ("木眼"). */
  knots?: WoodKnot[]
  /** If true, renders lower band [0..0.72] as flowing side grain and upper band [0.76..1.0] as soft end-grain rings. */
  withEndGrainBand?: boolean
  /** If true, evaluates a seamless 3D solid-wood field on a turned cylinder or sphere. */
  turnedMode?: 'cylinder' | 'sphere'
  /** Roughness range [min, max] encoded into roughnessMap (0..1). */
  roughnessRange?: [number, number]
}

export type WoodTextureSet = {
  map: THREE.DataTexture
  bumpMap: THREE.DataTexture
  roughnessMap: THREE.DataTexture
  dispose(): void
}

type CachedBuffers = {
  width: number
  height: number
  albedo: Uint8Array<ArrayBuffer>
  bump: Uint8Array<ArrayBuffer>
  rough: Uint8Array<ArrayBuffer>
}

const bufferCache = new Map<string, CachedBuffers>()

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function valueNoise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const n00 = hash2(ix, iy, seed)
  const n10 = hash2(ix + 1, iy, seed)
  const n01 = hash2(ix, iy + 1, seed)
  const n11 = hash2(ix + 1, iy + 1, seed)
  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx
  return nx0 + (nx1 - nx0) * sy
}

function fbm2(x: number, y: number, seed: number): number {
  return (
    valueNoise2(x, y, seed) * 0.60 +
    valueNoise2(x * 2.07 + 5.3, y * 2.07 + 9.1, seed + 29) * 0.28 +
    valueNoise2(x * 4.21 + 11.7, y * 4.21 + 3.4, seed + 71) * 0.12
  )
}

function buildBuffers(spec: StylizedWoodSpec): CachedBuffers {
  const cached = bufferCache.get(spec.key)
  if (cached) return cached

  const width = spec.width ?? 512
  const height = spec.height ?? 512
  const early = hexToRgb(spec.earlywood)
  const late = hexToRgb(spec.latewood)
  const core = hexToRgb(spec.knotCore)
  const halo = hexToRgb(spec.knotHalo ?? spec.earlywood)
  const [rMin, rMax] = spec.roughnessRange ?? [0.84, 1.0]
  const archAmp = spec.archAmp ?? 0.28
  const washStrength = spec.washStrength ?? 0.075
  const knots = spec.knots ?? []
  const seed = spec.seed

  const albedo = new Uint8Array(width * height * 4)
  const bump = new Uint8Array(width * height * 4)
  const rough = new Uint8Array(width * height * 4)

  for (let py = 0; py < height; py++) {
    const v = (py + 0.5) / height
    for (let px = 0; px < width; px++) {
      const u = (px + 0.5) / width
      const idx = (py * width + px) * 4

      let latewood = 0
      let knotCoreMix = 0
      let knotHaloMix = 0
      let wash = 0
      let silkyStreak = 0

      if (spec.withEndGrainBand && v > 0.74) {
        // Soft stylized concentric growth rings for cut end-grain (post top).
        const eu = (u - 0.5) * 2.0
        const ev = ((v - 0.76) / 0.24 - 0.5) * 2.0
        const angle = Math.atan2(ev, eu)
        const wobble = (fbm2(Math.cos(angle) * 1.4 + 2.0, Math.sin(angle) * 1.4 + 2.0, seed + 211) - 0.5) * 0.14
        const dist = Math.hypot(eu * 0.92 + 0.08, ev * 1.04 - 0.06) + wobble
        const ringWave = 0.5 + 0.5 * Math.sin(dist * Math.PI * 2 * 4.4 + seed * 0.3)
        latewood = Math.pow(smoothstep(0.54, 0.96, ringWave), 1.38) * 0.60
        // Subtle radial medullary rays for cut end-grain warmth
        const ray = (valueNoise2(angle * 4.5 + 10, dist * 2.0, seed + 241) - 0.5) * 0.09
        wash = (fbm2(eu * 1.2 + 4, ev * 1.2 + 4, seed + 257) - 0.5) * 0.10 - smoothstep(0.0, 0.25, 0.25 - dist) * 0.05 + ray
        silkyStreak = 0
      } else if (spec.turnedMode) {
        // Seamless 3D solid-wood evaluation on turned cylinder or sphere (zero wrap seam).
        const theta = v * Math.PI * 2
        const c = Math.cos(theta)
        const s = Math.sin(theta)
        let wx: number, wy: number, wz: number
        if (spec.turnedMode === 'sphere') {
          const phi = u * Math.PI
          const sp = Math.sin(phi)
          // Tilt slightly so subtle wood figure sweeps smoothly across the turned pommel without visible pole pinching.
          const rx = sp * c
          const ry = sp * s
          const rz = Math.cos(phi)
          wx = rx * 0.85 + rz * 0.52
          wy = ry
          wz = rz * 0.85 - rx * 0.52
        } else {
          wx = c * 0.48
          wy = s * 0.48
          wz = (u - 0.5) * 2.8
        }
        // Slice obliquely through growth cylinders with organic low-frequency drift.
        const drift = (fbm2(wz * 0.75 + wx * 0.5 + 3.1, wy * 0.85 + 7.4, seed + 19) - 0.5) * spec.flowAmp * 2.4
        const spacingVar = (fbm2(wz * 0.45 + 9.2, wx * 0.7 + wy * 0.5 + 1.3, seed + 47) - 0.5) * 0.85
        let ringCoord = wx * 0.86 + wy * 0.42 + 0.16 * Math.sin(wz * 1.65 + 0.7) + drift

        // Optional sparse pin-knot on turned cylinder surface
        for (const k of knots) {
          const da = u - k.along
          // Shortest wrapped angular difference in [ -0.5, 0.5 ]
          let dc = v - k.across
          if (dc > 0.5) dc -= 1
          else if (dc < -0.5) dc += 1
          const ex = da / k.radiusAlong
          const ey = dc / k.radiusAcross
          const r2 = ex * ex + ey * ey
          if (r2 < 14) {
            const env = Math.exp(-r2 * 0.48)
            const sPush = dc / Math.sqrt(dc * dc + k.radiusAcross * k.radiusAcross * 0.35)
            ringCoord -= sPush * k.deflect * env * 1.8
            const r = Math.sqrt(r2)
            const ang = Math.atan2(ey, ex)
            const rWobble = r + (valueNoise2(Math.cos(ang) * 1.8 + 4, Math.sin(ang) * 1.8 + 4, seed + 131) - 0.5) * 0.12
            const kStr = k.strength ?? 0.82
            const haloZone = Math.exp(-Math.pow((rWobble - 0.96) / 0.45, 2)) * 0.48 * kStr
            const eyeMask = (1 - smoothstep(0.65, 1.08, rWobble)) * kStr
            const eyeRings = Math.pow(smoothstep(0.42, 0.92, 0.5 + 0.5 * Math.sin(rWobble * Math.PI * 3.8)), 1.2)
            const eyeCore = (1 - smoothstep(0.18, 0.46, rWobble)) * kStr
            knotHaloMix = Math.max(knotHaloMix, haloZone)
            knotCoreMix = Math.max(knotCoreMix, Math.max(eyeCore * 0.92, eyeMask * eyeRings * 0.72))
          }
        }

        const phase = ringCoord * spec.ringFreq + spacingVar
        const wave = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2)
        const secondaryWave = 0.5 + 0.5 * Math.sin((phase * 2.0 + 0.35) * Math.PI * 2)
        latewood = Math.pow(smoothstep(0.55, 0.96, wave), 1.38) * 0.84 + Math.pow(smoothstep(0.76, 0.98, secondaryWave), 1.7) * 0.16
        wash = (fbm2(wz * 0.42 + 4.1, wx * 0.9 + wy * 0.9 + 2.2, seed + 83) - 0.5) * 2 * washStrength
        silkyStreak = (valueNoise2(wz * 1.8 + 1.5, (wx + wy) * 12.0 + 3.2, seed + 109) - 0.5) * 0.06
      } else {
        // Planar / edge-wrapped stylized plank wood with organic domain-warped flow & knots.
        const vNorm = spec.withEndGrainBand ? v / 0.72 : v
        const along = u
        let across = vNorm

        // 1. Streamline deflection around each sparse knot ("木眼"): fibers flow smoothly around it.
        for (const k of knots) {
          const da = along - k.along
          const dc = vNorm - k.across
          const ex = da / k.radiusAlong
          const ey = dc / k.radiusAcross
          const r2 = ex * ex + ey * ey
          if (r2 < 18) {
            const env = Math.exp(-r2 * 0.42)
            const signedPush = dc / Math.sqrt(dc * dc + k.radiusAcross * k.radiusAcross * 0.32)
            across -= signedPush * k.deflect * env

            const r = Math.sqrt(r2)
            const ang = Math.atan2(ey, ex)
            const wobble = (valueNoise2(Math.cos(ang) * 1.9 + 6.0, Math.sin(ang) * 1.9 + 6.0, seed + 137) - 0.5) * 0.14
            const rw = r + wobble
            const kStr = k.strength ?? 0.88
            // Warm golden-amber compression halo around the knot
            const haloBand = Math.exp(-Math.pow((rw - 1.02) / 0.42, 2)) * 0.45 * kStr
            // 2 concentric warm oval rings + soft umber center eye
            const eyeMask = (1 - smoothstep(0.68, 1.12, rw)) * kStr
            const eyeRings = Math.pow(smoothstep(0.40, 0.90, 0.5 + 0.5 * Math.sin(rw * Math.PI * 4.2)), 1.2)
            const eyeCore = (1 - smoothstep(0.18, 0.46, rw)) * kStr
            knotHaloMix = Math.max(knotHaloMix, haloBand)
            knotCoreMix = Math.max(knotCoreMix, Math.max(eyeCore * 0.95, eyeMask * eyeRings * 0.76))
          }
        }

        // 2. Smooth low-frequency organic flow warp + cathedral arch + non-uniform growth spacing.
        const flowSlow = (fbm2(along * 1.45 + seed * 0.31, across * 1.95 + seed * 0.73, seed + 13) - 0.5) * spec.flowAmp
        const flowMed = (fbm2(along * 3.1 + 7.2, across * 3.8 + 2.9, seed + 41) - 0.5) * (spec.flowAmp * 0.34)
        const arch = archAmp * Math.sin(along * Math.PI * 1.35 + seed * 0.5) * (0.45 + 0.55 * Math.cos((across - 0.52) * Math.PI))
        const spacingMod = (fbm2(along * 0.9 + 4.4, across * 1.6 + 8.1, seed + 67) - 0.5) * 0.72

        const phase = (across + flowSlow + flowMed + arch * 0.16) * spec.ringFreq + spacingMod
        const mainWave = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2)
        const softSubWave = 0.5 + 0.5 * Math.sin((phase * 2.0 + 0.28) * Math.PI * 2)
        // Broad warm earlywood (~68%), softly tapered latewood veins (~32%)
        latewood =
          Math.pow(smoothstep(0.54, 0.96, mainWave), 1.32) * 0.84 +
          Math.pow(smoothstep(0.74, 0.98, softSubWave), 1.75) * 0.16

        // 3. Broad painterly heartwood/sapwood wash + whisper-soft anisotropic fiber sheen
        wash = (fbm2(along * 1.15 + 3.7, across * 1.85 + 6.3, seed + 97) - 0.5) * 2 * washStrength
        silkyStreak = (valueNoise2(along * 2.4 + 1.1, (across + flowSlow * 0.6) * 19.0 + 5.7, seed + 151) - 0.5) * 0.065
      }

      // Blend earlywood -> latewood -> knot halo -> knot core in warm stylized palette.
      const grainT = clamp01(latewood * 0.92 + silkyStreak * 0.5)
      let r = early[0] + (late[0] - early[0]) * grainT
      let g = early[1] + (late[1] - early[1]) * grainT
      let b = early[2] + (late[2] - early[2]) * grainT

      // Warm tonal wash (sapwood warmth drift)
      const washMul = 1 + wash + silkyStreak * 0.45
      r *= washMul
      g *= washMul * (1 + wash * 0.08)
      b *= washMul * (1 - wash * 0.06)

      // Soft warm halo around knot compression zone
      if (knotHaloMix > 0.001) {
        const h = clamp01(knotHaloMix)
        r = r + (halo[0] - r) * h * 0.48
        g = g + (halo[1] - g) * h * 0.45
        b = b + (halo[2] - b) * h * 0.40
      }

      // Warm umber knot core & rings
      if (knotCoreMix > 0.001) {
        const k = clamp01(knotCoreMix)
        r = r + (core[0] - r) * k * 0.88
        g = g + (core[1] - g) * k * 0.88
        b = b + (core[2] - b) * k * 0.88
      }

      albedo[idx] = Math.round(clamp01(r / 255) * 255)
      albedo[idx + 1] = Math.round(clamp01(g / 255) * 255)
      albedo[idx + 2] = Math.round(clamp01(b / 255) * 255)
      albedo[idx + 3] = 255

      // Gentle relief height: latewood pores & knot edges softly recessed
      const heightVal = clamp01(0.62 - latewood * 0.24 - knotCoreMix * 0.22 + silkyStreak * 0.35)
      const bByte = Math.round(heightVal * 255)
      bump[idx] = bByte
      bump[idx + 1] = bByte
      bump[idx + 2] = bByte
      bump[idx + 3] = 255

      // Subtle roughness variation: sunlit earlywood slightly smoother, latewood pores slightly more matte
      const roughNorm = clamp01(rMin + (rMax - rMin) * clamp01(0.28 + latewood * 0.56 + knotCoreMix * 0.22 - knotHaloMix * 0.16))
      const rByte = Math.round(roughNorm * 255)
      rough[idx] = rByte
      rough[idx + 1] = rByte
      rough[idx + 2] = rByte
      rough[idx + 3] = 255
    }
  }

  const result: CachedBuffers = { width, height, albedo, bump, rough }
  bufferCache.set(spec.key, result)
  return result
}

function makeTexture(
  data: Uint8Array<ArrayBuffer>,
  width: number,
  height: number,
  srgb: boolean,
  wrapS: THREE.Wrapping,
  wrapT: THREE.Wrapping,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.wrapS = wrapS
  tex.wrapT = wrapT
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

/**
 * Creates deterministic, stylized warm wood maps (albedo + subtle bump + roughness)
 * with organic flowing grain and sparse knots. Pixel buffers are cached by spec key;
 * each returned DataTexture set is independently owned and disposed once.
 */
export function createStylizedWoodTextures(spec: StylizedWoodSpec): WoodTextureSet {
  const buf = buildBuffers(spec)
  const wrapS = spec.turnedMode ? THREE.ClampToEdgeWrapping : THREE.ClampToEdgeWrapping
  const wrapT = spec.turnedMode ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  const map = makeTexture(buf.albedo, buf.width, buf.height, true, wrapS, wrapT)
  const bumpMap = makeTexture(buf.bump, buf.width, buf.height, false, wrapS, wrapT)
  const roughnessMap = makeTexture(buf.rough, buf.width, buf.height, false, wrapS, wrapT)
  let disposed = false
  return {
    map,
    bumpMap,
    roughnessMap,
    dispose() {
      if (disposed) return
      disposed = true
      map.dispose()
      bumpMap.dispose()
      roughnessMap.dispose()
    },
  }
}

/**
 * Generates edge-continuous planar wood UVs on a BoxGeometry along its grain axis:
 * - axis='x': horizontal plank; top (+Y) and front (+Z) share longitudinal X and wrap smoothly across the top-front corner.
 * - axis='y': vertical post; side faces wrap continuously around the perimeter with Y along U, while top/bottom (+Y/-Y) map to the end-grain band [0.76..1.0].
 */
export function applyBoxWoodUVs(
  geometry: THREE.BufferGeometry,
  size: [number, number, number],
  axis: 'x' | 'y',
  withEndGrainBand = false,
): void {
  const pos = geometry.getAttribute('position')
  const norm = geometry.getAttribute('normal')
  if (!pos || !norm) return
  const [sx, sy, sz] = size
  const hx = sx * 0.5
  const hy = sy * 0.5
  const hz = sz * 0.5
  const uvs = new Float32Array(pos.count * 2)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const nx = norm.getX(i)
    const ny = norm.getY(i)
    const nz = norm.getZ(i)
    const ax = Math.abs(nx)
    const ay = Math.abs(ny)
    const az = Math.abs(nz)

    let u = 0.5
    let v = 0.5

    if (axis === 'x') {
      const spanV = sz + sy * 1.15
      if (ay >= ax && ay >= az) {
        // Top / bottom plank face: U along X, V spans Z smoothly up to the front edge.
        u = clamp01((x + hx) / sx)
        v = clamp01((z + hz) / spanV)
      } else if (az >= ax && az >= ay) {
        // Front / back face: continuous wrap from the top-front corner down Y!
        u = clamp01((x + hx) / sx)
        const distFromTop = hy - y
        v = clamp01((sz + distFromTop) / spanV)
      } else {
        // Left / right end caps: oblique cross-section of plank grain.
        u = clamp01(0.15 + ((z + hz) / sz) * 0.65)
        v = clamp01(0.22 + ((y + hy) / sy) * 0.45)
      }
    } else {
      // Vertical post (axis = 'y')
      const sideMaxV = withEndGrainBand ? 0.70 : 1.0
      if (ay >= ax && ay >= az && withEndGrainBand) {
        // Top / bottom cut end-grain mapped cleanly into [0.76..0.99]
        u = clamp01((x + hx) / sx)
        v = 0.76 + clamp01((z + hz) / sz) * 0.23
      } else {
        // Side faces: U runs up Y (bottom -> top); V wraps continuously across front (+Z) -> right (+X) -> back (-Z) -> left (-X)
        u = clamp01((y + hy) / sy)
        let perim = 0
        const totalPerim = (sx + sz) * 2
        if (az >= ax && nz >= 0) perim = x + hx
        else if (ax >= az && nx >= 0) perim = sx + (hz - z)
        else if (az >= ax && nz < 0) perim = sx + sz + (hx - x)
        else perim = sx * 2 + sz + (z + hz)
        v = clamp01(perim / totalPerim) * sideMaxV
      }
    }

    uvs[i * 2] = u
    uvs[i * 2 + 1] = v
  }

  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
}

/**
 * Converts CylinderGeometry's seam-split UVs (u=circumference, v=height) into
 * shaft wood UVs (u=length along Z, v=circumference 0..1) with zero wrap seam.
 */
export function applyTurnedShaftUVs(geometry: THREE.BufferGeometry): void {
  const uv = geometry.getAttribute('uv')
  if (!uv) return
  const out = new Float32Array(uv.count * 2)
  for (let i = 0; i < uv.count; i++) {
    out[i * 2] = uv.getY(i)
    out[i * 2 + 1] = uv.getX(i)
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(out, 2))
}

/**
 * Converts SphereGeometry's seam-split UVs (u=azimuth, v=polar) into
 * turned-pommel wood UVs (u=polar, v=azimuth 0..1) with zero wrap seam.
 */
export function applyTurnedSphereUVs(geometry: THREE.BufferGeometry): void {
  const uv = geometry.getAttribute('uv')
  if (!uv) return
  const out = new Float32Array(uv.count * 2)
  for (let i = 0; i < uv.count; i++) {
    out[i * 2] = uv.getY(i)
    out[i * 2 + 1] = uv.getX(i)
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(out, 2))
}
