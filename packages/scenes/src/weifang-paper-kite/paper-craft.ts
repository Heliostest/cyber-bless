import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

export type XYZ = [number, number, number]
type XY = [number, number]

// Thin pasted mulberry kite paper Z planes (0.0038 thick, zero overlap between wings and body).
export const WING_PAPER_Z_FRONT = 0.0112
export const WING_PAPER_Z_BACK = 0.0074
export const BODY_PAPER_Z_FRONT = 0.0156
export const BODY_PAPER_Z_BACK = 0.0118

// Shared bamboo spar centerlines seated flush against the front paper face (zero floating air gap).
export const WING_LEAD_Z = 0.0305
export const WING_DIAG_Z = 0.0280
export const WING_LOWER_Z = 0.0245
export const SPINE_Z = 0.0338
export const TAIL_Z = 0.0308
export const WING_BACK_RIB_Z = 0.0012
export const BODY_BACK_RIB_Z = 0.0055

export const wingLeadPoints = (sign: -1 | 1): XYZ[] => [
  [0, 0.43, WING_LEAD_Z],
  [sign * 0.57, 0.70, WING_LEAD_Z],
  [sign * 1.8, 0.64, WING_LEAD_Z],
]

export const wingDiagPoints = (sign: -1 | 1): XYZ[] => [
  [0, -0.25, WING_DIAG_Z],
  [sign * 0.8, 0.13, WING_DIAG_Z],
  [sign * 1.8, 0.64, WING_DIAG_Z],
]

export const wingLowerPoints = (sign: -1 | 1): XYZ[] => [
  [sign * 0.13, -0.12, WING_LOWER_Z],
  [sign * 0.32, -0.28, WING_LOWER_Z],
  [sign * 1.05, -0.15, WING_LOWER_Z],
  [sign * 1.4, 0.18, WING_LOWER_Z],
  [sign * 1.8, 0.64, WING_LOWER_Z],
]

export const spinePoints = (): XYZ[] => [
  [0, 0.96, SPINE_Z],
  [0, 0.25, SPINE_Z],
  [0, -0.73, SPINE_Z],
]

export const tailPoints = (sign: -1 | 1): XYZ[] => [
  [0, -0.20, TAIL_Z],
  [sign * 0.24, -0.50, TAIL_Z],
  [sign * 0.58, -1.10, TAIL_Z],
]

// Dense 2D polyline sampler built from the exact CatmullRomCurve3 used by the bamboo tubes.
function sampleCurve2D(points: XYZ[], samples = 96): XY[] {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)))
  const out: XY[] = new Array(samples + 1)
  const v = new THREE.Vector3()
  for (let i = 0; i <= samples; i++) {
    curve.getPoint(i / samples, v)
    out[i] = [v.x, v.y]
  }
  return out
}

function evalYAtX(poly: XY[], x: number): number {
  if (x <= poly[0]![0]) return poly[0]![1]
  const last = poly[poly.length - 1]!
  if (x >= last[0]) return last[1]
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i]!, b = poly[i + 1]!
    if (x >= a[0] && x <= b[0]) {
      const span = b[0] - a[0]
      const t = span > 1e-8 ? (x - a[0]) / span : 0
      return a[1] + (b[1] - a[1]) * t
    }
  }
  return last[1]
}

const RIGHT_LEAD_2D = sampleCurve2D(wingLeadPoints(1), 64)
const RIGHT_DIAG_2D = sampleCurve2D(wingDiagPoints(1), 48)
const RIGHT_LOWER_2D = sampleCurve2D(wingLowerPoints(1), 64)
const RIGHT_TAIL_2D = sampleCurve2D(tailPoints(1), 24)

// Coarse polylines (exact within <0.002 units) for fast distance queries.
const RIGHT_LEAD_FAST = sampleCurve2D(wingLeadPoints(1), 14)
const RIGHT_DIAG_FAST = sampleCurve2D(wingDiagPoints(1), 10)
const RIGHT_LOWER_FAST = sampleCurve2D(wingLowerPoints(1), 16)
const RIGHT_TAIL_FAST = sampleCurve2D(tailPoints(1), 10)

export const wingYTop = (xAbs: number) => evalYAtX(RIGHT_LEAD_2D, xAbs)
export const wingYBot = (xAbs: number) => evalYAtX(RIGHT_LOWER_2D, xAbs)

// Slender split-bamboo backing ribs tucked strictly behind the wing & body paper.
export function wingBackRibPoints(sign: -1 | 1): XYZ[][] {
  const rib1: XYZ[] = [
    [sign * 0.72, wingYTop(0.72) - 0.004, WING_BACK_RIB_Z],
    [sign * 0.79, 0.21, WING_BACK_RIB_Z],
    [sign * 0.75, wingYBot(0.75) + 0.004, WING_BACK_RIB_Z],
  ]
  const rib2: XYZ[] = [
    [sign * 1.24, wingYTop(1.24) - 0.004, WING_BACK_RIB_Z],
    [sign * 1.27, 0.34, WING_BACK_RIB_Z],
    [sign * 1.20, wingYBot(1.20) + 0.004, WING_BACK_RIB_Z],
  ]
  return [rib1, rib2]
}

export function bodyBackRibPoints(): XYZ[][] {
  return [
    [[-0.155, 0.43, BODY_BACK_RIB_Z], [0, 0.43, BODY_BACK_RIB_Z], [0.155, 0.43, BODY_BACK_RIB_Z]],
    [[-0.22, -0.05, BODY_BACK_RIB_Z], [0, -0.05, BODY_BACK_RIB_Z], [0.22, -0.05, BODY_BACK_RIB_Z]],
  ]
}

const RIGHT_BACK_RIBS_2D = wingBackRibPoints(1).map(pts => sampleCurve2D(pts, 10))
const BODY_BACK_RIBS_2D = bodyBackRibPoints().map(pts => sampleCurve2D(pts, 4))

// Deterministic hash & value-noise FBM (jsdom + WebGL safe).
function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, ux), THREE.MathUtils.lerp(c, d, ux), uy)
}

function fbm(x: number, y: number, seed: number): number {
  return valueNoise(x, y, seed) * 0.56
    + valueNoise(x * 2.09 + 3.1, y * 2.03 + 1.7, seed + 19) * 0.29
    + valueNoise(x * 4.21 + 7.4, y * 4.13 + 5.2, seed + 41) * 0.15
}

function segDist2D(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax, aby = by - ay
  const denom = abx * abx + aby * aby
  const t = denom > 1e-10 ? THREE.MathUtils.clamp(((px - ax) * abx + (py - ay) * aby) / denom, 0, 1) : 0
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t))
}

function polyDist2D(px: number, py: number, poly: XY[]): number {
  let best = Infinity
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i]!, b = poly[i + 1]!
    const d = segDist2D(px, py, a[0], a[1], b[0], b[1])
    if (d < best) best = d
  }
  return best
}

// Signed distance to a closed 2D polygon: negative inside, positive outside.
function polygonSignedDist(px: number, py: number, poly: readonly XY[]): number {
  let minD = Infinity
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j]![0], ay = poly[j]![1]
    const bx = poly[i]![0], by = poly[i]![1]
    const d = segDist2D(px, py, ax, ay, bx, by)
    if (d < minD) minD = d
    if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) {
      inside = !inside
    }
  }
  return inside ? -minD : minD
}

// Sparse deterministic mulberry / kozo fiber field for backlit paper translucency.
function createFiberMask(width: number, height: number, count: number, seed: number): Float32Array {
  const mask = new Float32Array(width * height)
  for (let i = 0; i < count; i++) {
    const x0 = hash2(i, 1, seed)
    const y0 = hash2(i, 2, seed)
    const angle = (hash2(i, 3, seed) - 0.5) * Math.PI * 1.4
    const len = 0.016 + hash2(i, 4, seed) * 0.036
    const dx = Math.cos(angle) * len
    const dy = Math.sin(angle) * len * (width / height) * 0.7
    const curve = (hash2(i, 5, seed) - 0.5) * 0.013
    const rad = Math.max(1, Math.ceil((0.0014 + hash2(i, 6, seed) * 0.0014) * Math.min(width, height)))
    const dark = 0.065 + hash2(i, 7, seed) * 0.085
    const steps = 14
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const bend = Math.sin(Math.PI * t) * curve
      const cx = Math.round((x0 + dx * t - dy * bend * 10) * (width - 1))
      const cy = Math.round((y0 + dy * t + dx * bend * 10) * (height - 1))
      for (let oy = -rad; oy <= rad; oy++) {
        const yy = cy + oy
        if (yy < 0 || yy >= height) continue
        for (let ox = -rad; ox <= rad; ox++) {
          const xx = cx + ox
          if (xx < 0 || xx >= width) continue
          const d = Math.hypot(ox, oy) / (rad + 0.5)
          if (d < 1) {
            const idx = yy * width + xx
            mask[idx] = Math.min(0.24, mask[idx]! + (1 - d) * dark * Math.sin(Math.PI * t))
          }
        }
      }
    }
  }
  return mask
}

// Calibrated four-color Weifang swallow pigments matching approved icon-style sRGB palette.
const PIGMENT = {
  teal: [64, 142, 142] as const,
  red: [208, 99, 74] as const,
  ochre: [237, 188, 91] as const,
  cream: [244, 225, 174] as const,
  ink: [50, 88, 84] as const,
}

// Warm backlit sky-transmitted glow colors per pigment (cooler/darker pigments transmit less).
const BACKLIT = {
  teal: [82, 186, 176] as const,
  red: [238, 108, 66] as const,
  ochre: [252, 198, 84] as const,
  cream: [255, 232, 168] as const,
  ink: [30, 50, 48] as const,
}

// Original wing colour-block polygons in right-wing kite local space (exact original geometry).
const WING_CREAM_STRIPE: readonly XY[] = [[0.48, 0.57], [1.63, 0.59], [1.43, 0.43], [0.59, 0.40]]
const WING_RED_FEATHER: readonly XY[] = [[0.38, 0.25], [1.29, 0.23], [1.05, -0.08], [0.40, -0.20]]
const WING_OCHRE_TIP: readonly XY[] = [[1.49, 0.57], [1.73, 0.60], [1.43, 0.26], [1.28, 0.24]]
const WING_FEATHER_MARKS: readonly (readonly XY[])[] = [0, 1, 2].map(i => {
  const x = 0.52 + i * 0.19
  return [[x, 0.18], [x + 0.055, 0.18], [x + 0.12, -0.01], [x + 0.07, -0.04]] as const
})

// Original body colour-block polygons.
const BODY_RED_CROWN: readonly XY[] = [[0, 0.98], [0.19, 0.78], [0.17, 0.52], [0, 0.61], [-0.17, 0.52], [-0.19, 0.78]]
const BODY_TEAL_TAIL: readonly XY[] = [[0, -0.16], [0.22, -0.22], [0.48, -0.97], [0, -0.65], [-0.48, -0.97], [-0.22, -0.22]]

// Wing orthogonal UV box covering x in [0.11, 1.83], y in [-0.31, 0.76].
const WING_UV_X0 = 0.11, WING_UV_W = 1.72
const WING_UV_Y0 = -0.31, WING_UV_H = 1.07
const wingToUv = (xAbs: number, y: number): XY => [
  THREE.MathUtils.clamp((xAbs - WING_UV_X0) / WING_UV_W, 0.005, 0.995),
  THREE.MathUtils.clamp((y - WING_UV_Y0) / WING_UV_H, 0.005, 0.995),
]

// Body orthogonal UV box covering x in [-0.62, 0.62], y in [-1.14, 1.02].
const BODY_UV_X0 = -0.62, BODY_UV_W = 1.24
const BODY_UV_Y0 = -1.14, BODY_UV_H = 2.16
const bodyToUv = (x: number, y: number): XY => [
  THREE.MathUtils.clamp((x - BODY_UV_X0) / BODY_UV_W, 0.005, 0.995),
  THREE.MathUtils.clamp((y - BODY_UV_Y0) / BODY_UV_H, 0.005, 0.995),
]

function makeDataTex(data: Uint8Array<ArrayBuffer>, width: number, height: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

export type WingTextureSet = {
  mountedAlbedo: THREE.DataTexture
  unmountedAlbedo: THREE.DataTexture
  mountedBacklight: THREE.DataTexture
  unmountedBacklight: THREE.DataTexture
}

type WingRawPixels = {
  width: number; height: number
  mAlb: Uint8Array<ArrayBuffer>; uAlb: Uint8Array<ArrayBuffer>
  mBak: Uint8Array<ArrayBuffer>; uBak: Uint8Array<ArrayBuffer>
}
let cachedWingPixels: WingRawPixels | null = null

/**
 * Generates deterministic painted-on-paper albedo & backlit sky-translucency textures
 * for the swallow wing. Pixel buffers are deterministic and cached once per session,
 * while each scene mount receives its own independent THREE.DataTexture instances.
 */
export function createWingPaperTextures(width = 384, height = 256): WingTextureSet {
  if (!cachedWingPixels || cachedWingPixels.width !== width || cachedWingPixels.height !== height) {
    const mAlb = new Uint8Array(width * height * 4)
    const uAlb = new Uint8Array(width * height * 4)
    const mBak = new Uint8Array(width * height * 4)
    const uBak = new Uint8Array(width * height * 4)
    const fiberMask = createFiberMask(width, height, 150, 73)

    const aa = 0.0065
    const blend = (dst: [number, number, number], src: readonly [number, number, number], alpha: number) => {
      dst[0] += (src[0] - dst[0]) * alpha
      dst[1] += (src[1] - dst[1]) * alpha
      dst[2] += (src[2] - dst[2]) * alpha
    }

    for (let iy = 0; iy < height; iy++) {
      const v = iy / (height - 1)
      const y = WING_UV_Y0 + v * WING_UV_H
      const laid = Math.sin(v * Math.PI * 2 * 56) * 0.022
      const skyGrad = THREE.MathUtils.lerp(0.86, 1.06, Math.pow(v, 0.8))
      for (let ix = 0; ix < width; ix++) {
        const u = ix / (width - 1)
        const x = WING_UV_X0 + u * WING_UV_W

        // 1. Hand-painted four-color blocks on thin kite paper.
        const col: [number, number, number] = [PIGMENT.teal[0], PIGMENT.teal[1], PIGMENT.teal[2]]
        const bak: [number, number, number] = [BACKLIT.teal[0], BACKLIT.teal[1], BACKLIT.teal[2]]
        let edgePool = 0

        if (x > 0.45 && x < 1.66 && y > 0.37 && y < 0.62) {
          const dCream = polygonSignedDist(x, y, WING_CREAM_STRIPE)
          const aCream = 1 - THREE.MathUtils.smoothstep(dCream, -aa, aa)
          if (aCream > 0.001) {
            blend(col, PIGMENT.cream, aCream)
            blend(bak, BACKLIT.cream, aCream)
            edgePool = Math.max(edgePool, Math.exp(-Math.pow(dCream / 0.009, 2)) * 0.045)
          }
        }

        if (x > 0.35 && x < 1.32 && y > -0.23 && y < 0.28) {
          const dRed = polygonSignedDist(x, y, WING_RED_FEATHER)
          const aRed = 1 - THREE.MathUtils.smoothstep(dRed, -aa, aa)
          if (aRed > 0.001) {
            blend(col, PIGMENT.red, aRed)
            blend(bak, BACKLIT.red, aRed)
            edgePool = Math.max(edgePool, Math.exp(-Math.pow(dRed / 0.009, 2)) * 0.055)
          }
          if (x > 0.49 && x < 1.06 && y > -0.07 && y < 0.21) {
            for (const mark of WING_FEATHER_MARKS) {
              const dMark = polygonSignedDist(x, y, mark)
              const aMark = 1 - THREE.MathUtils.smoothstep(dMark, -aa * 0.85, aa * 0.85)
              if (aMark > 0.001) {
                blend(col, PIGMENT.cream, aMark)
                blend(bak, BACKLIT.cream, aMark)
              }
            }
          }
        }

        if (x > 1.25 && x < 1.76 && y > 0.21 && y < 0.63) {
          const dOchre = polygonSignedDist(x, y, WING_OCHRE_TIP)
          const aOchre = 1 - THREE.MathUtils.smoothstep(dOchre, -aa, aa)
          if (aOchre > 0.001) {
            blend(col, PIGMENT.ochre, aOchre)
            blend(bak, BACKLIT.ochre, aOchre)
            edgePool = Math.max(edgePool, Math.exp(-Math.pow(dOchre / 0.009, 2)) * 0.045)
          }
        }

        // 2. Fine organic mulberry pulp clouding & delicate brushed pigment variation.
        const pulp = (fbm(u * 10.5, v * 7.2, 29) - 0.5) * 0.11
        const fine = (hash2(ix, iy, 61) - 0.5) * 0.028
        const kozo = fiberMask[iy * width + ix]! * 0.55

        // Perimeter distance along real curved leading/trailing/root paper outline (for paste hem).
        const dLead = polyDist2D(x, y, RIGHT_LEAD_FAST)
        const dLower = polyDist2D(x, y, RIGHT_LOWER_FAST)
        const dDiag = polyDist2D(x, y, RIGHT_DIAG_FAST)
        const dRoot = Math.abs(x - 0.13)
        const dPerim = Math.min(dLead, dLower, dRoot)

        // Subtle warm folded paste-margin rim & inner glue-flap border on all sheets.
        const hemBand = 1 - THREE.MathUtils.smoothstep(dPerim, 0.004, 0.020)
        const cutRim = 1 - THREE.MathUtils.smoothstep(dPerim, 0.0, 0.008)
        const rootTab = 1 - THREE.MathUtils.smoothstep(dRoot, 0.008, 0.024)
        const hemShade = 1 - hemBand * 0.04
        const unmountedMult = (1 + pulp * 0.22 + fine - edgePool - kozo * 0.14) * hemShade

        // Unmounted albedo: pure painted mulberry paper with delicate pale cut-paper rim & glue tab.
        const rimBlend = Math.max(cutRim * 0.24, rootTab * 0.18)
        const uR = THREE.MathUtils.lerp(col[0] * unmountedMult, 242, rimBlend)
        const uG = THREE.MathUtils.lerp(col[1] * unmountedMult, 226, rimBlend)
        const uB = THREE.MathUtils.lerp(col[2] * unmountedMult, 184, rimBlend)

        // Unmounted backlight: warm translucent thin paper glow attenuated subtly at folded hem.
        const uTrans = THREE.MathUtils.clamp((0.90 - hemBand * 0.18) * skyGrad + pulp * 0.65 + laid * 0.7 - kozo * 0.65, 0.34, 1.06)

        // 3. Mounted bamboo-frame & slender back cross-rib translucency shadows (逆光透骨).
        const dBackRib = Math.min(
          x > 0.68 && x < 0.85 ? polyDist2D(x, y, RIGHT_BACK_RIBS_2D[0]!) : 1,
          x > 1.16 && x < 1.32 ? polyDist2D(x, y, RIGHT_BACK_RIBS_2D[1]!) : 1,
        )
        // Tight wheat-starch paste margin around stout front bamboo spars.
        const frontSparClear = Math.min(
          THREE.MathUtils.smoothstep(dLead, 0.010, 0.036),
          THREE.MathUtils.smoothstep(dDiag, 0.009, 0.032),
          THREE.MathUtils.smoothstep(dLower, 0.008, 0.030),
          THREE.MathUtils.smoothstep(dRoot, 0.006, 0.026),
        )
        // Slender, warm, feathered through-paper silhouette of the split-bamboo backing cross-ribs.
        const backRibClear = THREE.MathUtils.smoothstep(dBackRib, 0.004, 0.017)

        const backRibDiffuse = 1 - (1 - backRibClear) * 0.078
        const frontPasteDiffuse = 1 - (1 - frontSparClear) * 0.068
        const mDiffuse = backRibDiffuse * frontPasteDiffuse
        // Slight warm amber shift inside bamboo rib shadows (never grey/charcoal).
        const ribShadowAmt = 1 - Math.min(frontSparClear, backRibClear)
        const mR = uR * mDiffuse * (1 + ribShadowAmt * 0.025)
        const mG = uG * mDiffuse * (1 + ribShadowAmt * 0.005)
        const mB = uB * mDiffuse * (1 - ribShadowAmt * 0.045)

        // Open bays glow brightly in sunlit sky transmission; ribs attenuate smoothly to warm amber shade.
        const frontTrans = 0.34 + 0.66 * frontSparClear
        const backTrans = 0.44 + 0.56 * backRibClear
        const bayGlow = Math.min(frontTrans, backTrans)
        const mTrans = THREE.MathUtils.clamp(bayGlow * skyGrad + pulp * 0.68 + laid * 0.7 - kozo * 0.68, 0.22, 1.08)

        const p = (iy * width + ix) * 4
        uAlb[p] = THREE.MathUtils.clamp(Math.round(uR), 0, 255)
        uAlb[p + 1] = THREE.MathUtils.clamp(Math.round(uG), 0, 255)
        uAlb[p + 2] = THREE.MathUtils.clamp(Math.round(uB), 0, 255)
        uAlb[p + 3] = 255

        mAlb[p] = THREE.MathUtils.clamp(Math.round(mR), 0, 255)
        mAlb[p + 1] = THREE.MathUtils.clamp(Math.round(mG), 0, 255)
        mAlb[p + 2] = THREE.MathUtils.clamp(Math.round(mB), 0, 255)
        mAlb[p + 3] = 255

        uBak[p] = THREE.MathUtils.clamp(Math.round(bak[0] * uTrans), 0, 255)
        uBak[p + 1] = THREE.MathUtils.clamp(Math.round(bak[1] * uTrans), 0, 255)
        uBak[p + 2] = THREE.MathUtils.clamp(Math.round(bak[2] * uTrans), 0, 255)
        uBak[p + 3] = 255

        mBak[p] = THREE.MathUtils.clamp(Math.round(bak[0] * mTrans), 0, 255)
        mBak[p + 1] = THREE.MathUtils.clamp(Math.round(bak[1] * mTrans), 0, 255)
        mBak[p + 2] = THREE.MathUtils.clamp(Math.round(bak[2] * mTrans), 0, 255)
        mBak[p + 3] = 255
      }
    }
    cachedWingPixels = { width, height, mAlb, uAlb, mBak, uBak }
  }

  return {
    mountedAlbedo: makeDataTex(cachedWingPixels.mAlb, width, height),
    unmountedAlbedo: makeDataTex(cachedWingPixels.uAlb, width, height),
    mountedBacklight: makeDataTex(cachedWingPixels.mBak, width, height),
    unmountedBacklight: makeDataTex(cachedWingPixels.uBak, width, height),
  }
}

export type BodyTextureSet = {
  albedo: THREE.DataTexture
  backlight: THREE.DataTexture
}

// Piecewise outer half-width of the swallow body silhouette for y in [-1.10, 0.98].
export function bodyOuterHalfWidth(y: number): number {
  if (y >= 0.78) return THREE.MathUtils.lerp(0.19, 0.0, THREE.MathUtils.clamp((y - 0.78) / 0.20, 0, 1))
  if (y >= 0.30) return THREE.MathUtils.lerp(0.17, 0.19, (y - 0.30) / 0.48)
  if (y >= -0.14) return THREE.MathUtils.lerp(0.29, 0.17, (y + 0.14) / 0.44)
  return THREE.MathUtils.lerp(0.58, 0.29, THREE.MathUtils.clamp((y + 1.10) / 0.96, 0, 1))
}

// Inner open fork half-width for y in [-1.10, -0.73].
export function bodyInnerForkHalfWidth(y: number): number {
  if (y >= -0.73) return 0
  return THREE.MathUtils.lerp(0.58, 0.0, THREE.MathUtils.clamp((y + 1.10) / 0.37, 0, 1))
}

const BODY_OUTLINE_2D: readonly XY[] = [
  [0, 0.98], [0.19, 0.78], [0.17, 0.30], [0.29, -0.14], [0.58, -1.10],
  [0, -0.73], [-0.58, -1.10], [-0.29, -0.14], [-0.17, 0.30], [-0.19, 0.78],
]

type BodyRawPixels = {
  width: number; height: number
  alb: Uint8Array<ArrayBuffer>; bak: Uint8Array<ArrayBuffer>
}
let cachedBodyPixels: BodyRawPixels | null = null

/**
 * Deterministic painted albedo & backlit sky-translucency textures for the swallow body
 * (cream chest, red crown with hand-brushed ink eyes, teal forked tail, spine paste strip,
 * tail bamboo borders, and soft backlit horizontal chest cross-ribs).
 */
export function createBodyPaperTextures(width = 256, height = 384): BodyTextureSet {
  if (!cachedBodyPixels || cachedBodyPixels.width !== width || cachedBodyPixels.height !== height) {
    const alb = new Uint8Array(width * height * 4)
    const bak = new Uint8Array(width * height * 4)
    const fiberMask = createFiberMask(width, height, 140, 107)
    const aa = 0.0065
    const blend = (dst: [number, number, number], src: readonly [number, number, number], alpha: number) => {
      dst[0] += (src[0] - dst[0]) * alpha
      dst[1] += (src[1] - dst[1]) * alpha
      dst[2] += (src[2] - dst[2]) * alpha
    }

    for (let iy = 0; iy < height; iy++) {
      const v = iy / (height - 1)
      const y = BODY_UV_Y0 + v * BODY_UV_H
      const laid = Math.sin(v * Math.PI * 2 * 76) * 0.022
      const skyGrad = THREE.MathUtils.lerp(0.84, 1.06, Math.pow(v, 0.85))
      for (let ix = 0; ix < width; ix++) {
        const u = ix / (width - 1)
        const x = BODY_UV_X0 + u * BODY_UV_W
        const xAbs = Math.abs(x)

        const col: [number, number, number] = [PIGMENT.cream[0], PIGMENT.cream[1], PIGMENT.cream[2]]
        const glow: [number, number, number] = [BACKLIT.cream[0], BACKLIT.cream[1], BACKLIT.cream[2]]
        let edgePool = 0

        if (y > 0.49 && y < 1.01 && xAbs < 0.22) {
          const dCrown = polygonSignedDist(x, y, BODY_RED_CROWN)
          const aCrown = 1 - THREE.MathUtils.smoothstep(dCrown, -aa, aa)
          if (aCrown > 0.001) {
            blend(col, PIGMENT.red, aCrown)
            blend(glow, BACKLIT.red, aCrown)
            edgePool = Math.max(edgePool, Math.exp(-Math.pow(dCrown / 0.009, 2)) * 0.05)
          }
        }

        if (y < -0.13 && y > -1.02 && xAbs < 0.52) {
          const dTail = polygonSignedDist(x, y, BODY_TEAL_TAIL)
          const aTail = 1 - THREE.MathUtils.smoothstep(dTail, -aa, aa)
          if (aTail > 0.001) {
            blend(col, PIGMENT.teal, aTail)
            blend(glow, BACKLIT.teal, aTail)
            edgePool = Math.max(edgePool, Math.exp(-Math.pow(dTail / 0.009, 2)) * 0.05)
          }
        }

        if (y > 0.72 && y < 0.80 && xAbs > 0.05 && xAbs < 0.13) {
          const dEye = Math.hypot(xAbs - 0.09, y - 0.76)
          const aEye = 1 - THREE.MathUtils.smoothstep(dEye, 0.023, 0.030)
          if (aEye > 0.001) {
            blend(col, PIGMENT.ink, aEye)
            blend(glow, BACKLIT.ink, aEye)
          }
        }

        const pulp = (fbm(u * 7.8, v * 13.0, 37) - 0.5) * 0.11
        const fine = (hash2(ix, iy, 83) - 0.5) * 0.026
        const kozo = fiberMask[iy * width + ix]! * 0.55

        const dPerim = Math.abs(polygonSignedDist(x, y, BODY_OUTLINE_2D))
        const dSpine = y >= -0.74 && y <= 0.97 ? xAbs : Math.hypot(xAbs, y < -0.74 ? y + 0.74 : y - 0.97)
        const dTailSpar = y < -0.15 ? polyDist2D(xAbs, y, RIGHT_TAIL_FAST) : 1
        const dBackRib = Math.min(
          Math.abs(y - 0.43) < 0.035 && xAbs < 0.18 ? polyDist2D(x, y, BODY_BACK_RIBS_2D[0]!) : 1,
          Math.abs(y + 0.05) < 0.035 && xAbs < 0.24 ? polyDist2D(x, y, BODY_BACK_RIBS_2D[1]!) : 1,
        )

        const frontSparClear = Math.min(
          THREE.MathUtils.smoothstep(dSpine, 0.010, 0.034),
          THREE.MathUtils.smoothstep(dTailSpar, 0.009, 0.030),
        )
        const backRibClear = THREE.MathUtils.smoothstep(dBackRib, 0.004, 0.015)
        const hemBand = 1 - THREE.MathUtils.smoothstep(dPerim, 0.004, 0.018)

        const diffuseMult = (1 + pulp * 0.22 + fine - edgePool - kozo * 0.14)
          * (1 - hemBand * 0.035)
          * (1 - (1 - backRibClear) * 0.075)
          * (1 - (1 - frontSparClear) * 0.065)

        const frontTrans = 0.36 + 0.64 * frontSparClear
        const backTrans = 0.46 + 0.54 * backRibClear
        const bayGlow = Math.min(frontTrans, backTrans) * (1 - hemBand * 0.14)
        const trans = THREE.MathUtils.clamp(bayGlow * skyGrad + pulp * 0.68 + laid * 0.7 - kozo * 0.68, 0.22, 1.06)

        const p = (iy * width + ix) * 4
        alb[p] = THREE.MathUtils.clamp(Math.round(col[0] * diffuseMult), 0, 255)
        alb[p + 1] = THREE.MathUtils.clamp(Math.round(col[1] * diffuseMult), 0, 255)
        alb[p + 2] = THREE.MathUtils.clamp(Math.round(col[2] * diffuseMult), 0, 255)
        alb[p + 3] = 255

        bak[p] = THREE.MathUtils.clamp(Math.round(glow[0] * trans), 0, 255)
        bak[p + 1] = THREE.MathUtils.clamp(Math.round(glow[1] * trans), 0, 255)
        bak[p + 2] = THREE.MathUtils.clamp(Math.round(glow[2] * trans), 0, 255)
        bak[p + 3] = 255
      }
    }
    cachedBodyPixels = { width, height, alb, bak }
  }

  return {
    albedo: makeDataTex(cachedBodyPixels.alb, width, height),
    backlight: makeDataTex(cachedBodyPixels.bak, width, height),
  }
}

export type DynamicPaperSheet = {
  geometry: THREE.BufferGeometry
  /** Deform in place (zero GPU allocations) for p0 sheet curl and in-flight bay billowing. */
  deform(opts: { fit: number; lift: number; wind: number }): void
}

/**
 * Watertight thin (0.0038) 2-manifold subdivided swallow wing paper fitted tightly along
 * the curved leading and trailing bamboo spars, with precomputed per-vertex bay billowing
 * weights anchored strictly at 0 along every front spar and slender backing cross-rib.
 */
export function createWingPaperSheet(sign: -1 | 1): DynamicPaperSheet {
  const cols = 28, rows = 12
  const stride = cols + 1
  const gridVerts = (cols + 1) * (rows + 1)

  const xs = new Float32Array(gridVerts)
  const ys = new Float32Array(gridVerts)
  const us = new Float32Array(gridVerts)
  const vs = new Float32Array(gridVerts)
  const uNorm = new Float32Array(gridVerts)
  const vNorm = new Float32Array(gridVerts)
  const bayW = new Float32Array(gridVerts)
  const curlZ = new Float32Array(gridVerts)
  const ao = new Float32Array(gridVerts)

  for (let iu = 0; iu <= cols; iu++) {
    const u = iu / cols
    // Slight ease toward the tip keeps triangles balanced where the chord narrows.
    const xAbs = THREE.MathUtils.lerp(0.13, 1.80, u)
    const yT = wingYTop(xAbs)
    const yB = wingYBot(xAbs)
    const midY = (yT + yB) * 0.5
    const halfSpan = Math.max(0.003, (yT - yB) * 0.5)

    for (let iv = 0; iv <= rows; iv++) {
      const v = iv / rows
      const y = midY + (v * 2 - 1) * halfSpan
      const idx = iv * stride + iu
      xs[idx] = sign * xAbs
      ys[idx] = y
      const [tu, tv] = wingToUv(xAbs, y)
      us[idx] = tu
      vs[idx] = tv
      uNorm[idx] = u
      vNorm[idx] = v

      // Anchor to 0 along every supporting spar and slender back cross-rib so billowing never clips bamboo.
      const dLead = polyDist2D(xAbs, y, RIGHT_LEAD_FAST)
      const dLower = polyDist2D(xAbs, y, RIGHT_LOWER_FAST)
      const dDiag = polyDist2D(xAbs, y, RIGHT_DIAG_FAST)
      const dRoot = Math.abs(xAbs - 0.13)
      const dRib = Math.min(
        polyDist2D(xAbs, y, RIGHT_BACK_RIBS_2D[0]!),
        polyDist2D(xAbs, y, RIGHT_BACK_RIBS_2D[1]!),
      )
      const minSupport = Math.min(dLead, dLower, dDiag, dRoot)
      const sparAnchor = THREE.MathUtils.smoothstep(minSupport, 0.014, 0.135)
      const ribAnchor = THREE.MathUtils.smoothstep(dRib, 0.008, 0.095)
      // Taper gently near the very tip where chord is narrow; strictly 0 along every spar & back rib.
      const tipFade = 1 - THREE.MathUtils.smoothstep(u, 0.84, 0.99)
      bayW[idx] = sparAnchor * ribAnchor * tipFade

      // Gentle detached paper-sheet curl for p0 (zero near grip anchor [1.05, 0.34]).
      const dGrip = Math.hypot(xAbs - 1.05, y - 0.34)
      const curlAway = THREE.MathUtils.smoothstep(dGrip, 0.16, 0.85)
      curlZ[idx] = curlAway * (
        0.028 * Math.pow(Math.max(0, u - 0.55) / 0.45, 1.5)
        - 0.018 * Math.pow(1 - u, 1.6) * (0.4 + 0.6 * (1 - v))
        + 0.010 * Math.sin(u * Math.PI * 1.4 - v * 0.9)
      )

      ao[idx] = 0.94 + 0.06 * THREE.MathUtils.smoothstep(minSupport, 0.0, 0.07)
    }
  }

  // Perimeter ring indices in grid space: bottom (left->right), right tip (bot->top), top (right->left), inner root (top->bot).
  const ring: number[] = []
  for (let iu = 0; iu < cols; iu++) ring.push(iu)
  for (let iv = 0; iv < rows; iv++) ring.push(iv * stride + cols)
  for (let iu = cols; iu > 0; iu--) ring.push(rows * stride + iu)
  for (let iv = rows; iv > 0; iv--) ring.push(iv * stride)

  const totalVerts = gridVerts * 2 + ring.length * 4
  const positions = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const colors = new Float32Array(totalVerts * 3)
  const indices: number[] = []

  // Front face (0 .. gridVerts - 1).
  for (let i = 0; i < gridVerts; i++) {
    positions[i * 3] = xs[i]!
    positions[i * 3 + 1] = ys[i]!
    positions[i * 3 + 2] = WING_PAPER_Z_FRONT
    uvs[i * 2] = us[i]!
    uvs[i * 2 + 1] = vs[i]!
    const s = ao[i]!
    colors[i * 3] = s; colors[i * 3 + 1] = s; colors[i * 3 + 2] = s
  }
  for (let iv = 0; iv < rows; iv++) {
    for (let iu = 0; iu < cols; iu++) {
      const a = iv * stride + iu, b = a + 1, c = a + stride + 1, d = a + stride
      if (sign > 0) indices.push(a, b, c, a, c, d)
      else indices.push(a, c, b, a, d, c)
    }
  }

  // Back face (gridVerts .. 2 * gridVerts - 1).
  const backBase = gridVerts
  for (let i = 0; i < gridVerts; i++) {
    const v = backBase + i
    positions[v * 3] = xs[i]!
    positions[v * 3 + 1] = ys[i]!
    positions[v * 3 + 2] = WING_PAPER_Z_BACK
    uvs[v * 2] = us[i]!
    uvs[v * 2 + 1] = vs[i]!
    const s = ao[i]! * 0.96
    colors[v * 3] = s; colors[v * 3 + 1] = s; colors[v * 3 + 2] = s
  }
  for (let iv = 0; iv < rows; iv++) {
    for (let iu = 0; iu < cols; iu++) {
      const a = backBase + iv * stride + iu, b = a + 1, c = a + stride + 1, d = a + stride
      if (sign > 0) indices.push(a, c, b, a, d, c)
      else indices.push(a, b, c, a, c, d)
    }
  }

  // Thin cut-paper perimeter closure strips.
  const rimBase = gridVerts * 2
  for (let k = 0; k < ring.length; k++) {
    const i0 = ring[k]!, i1 = ring[(k + 1) % ring.length]!
    const base = rimBase + k * 4
    const pts = [
      [xs[i0]!, ys[i0]!, WING_PAPER_Z_FRONT, us[i0]!, vs[i0]!],
      [xs[i0]!, ys[i0]!, WING_PAPER_Z_BACK, us[i0]!, vs[i0]!],
      [xs[i1]!, ys[i1]!, WING_PAPER_Z_BACK, us[i1]!, vs[i1]!],
      [xs[i1]!, ys[i1]!, WING_PAPER_Z_FRONT, us[i1]!, vs[i1]!],
    ] as const
    for (let j = 0; j < 4; j++) {
      const vi = base + j
      positions[vi * 3] = pts[j]![0]
      positions[vi * 3 + 1] = pts[j]![1]
      positions[vi * 3 + 2] = pts[j]![2]
      uvs[vi * 2] = pts[j]![3]
      uvs[vi * 2 + 1] = pts[j]![4]
      // Slightly warmer pale edge tone reads as clean cut paper edge.
      colors[vi * 3] = 0.97; colors[vi * 3 + 1] = 0.95; colors[vi * 3 + 2] = 0.89
    }
    if (sign > 0) indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3)
    else indices.push(base, base + 3, base + 1, base + 1, base + 3, base + 2)
  }

  const geometry = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(positions, 3)
  posAttr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', posAttr)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute
  normAttr.setUsage(THREE.DynamicDrawUsage)

  let lastKey = ''
  const dzGrid = new Float32Array(gridVerts)

  const deform = ({ fit, lift, wind }: { fit: number; lift: number; wind: number }) => {
    const detach = 1 - fit
    const key = `${detach.toFixed(4)}|${lift.toFixed(4)}|${wind.toFixed(4)}`
    if (key === lastKey) return
    lastKey = key

    const steadyBillow = lift * 0.028
    const gust = wind === 0 ? 0 : (0.55 + 0.45 * Math.sin(wind * 1.9 + sign * 0.45)) * 0.012 * lift
    const hasWave = wind !== 0 && lift > 0.01

    for (let i = 0; i < gridVerts; i++) {
      let dz = detach > 0.0001 ? curlZ[i]! * detach : 0
      const w = bayW[i]!
      if (w > 0.0001 && lift > 0.0001) {
        const wave = hasWave
          ? (Math.sin(wind * 3.8 - uNorm[i]! * 4.4 + vNorm[i]! * 1.5 + sign * 0.35) * 0.010
            + Math.sin(wind * 6.3 - uNorm[i]! * 7.2) * 0.0038) * lift
          : 0
        // Wind pushes front-facing paper bays gently backward (-Z), never intersecting front bamboo spars.
        dz -= (steadyBillow + gust + wave) * w
      }
      dzGrid[i] = dz
      positions[i * 3 + 2] = WING_PAPER_Z_FRONT + dz
      positions[(backBase + i) * 3 + 2] = WING_PAPER_Z_BACK + dz
    }

    for (let k = 0; k < ring.length; k++) {
      const i0 = ring[k]!, i1 = ring[(k + 1) % ring.length]!
      const dz0 = dzGrid[i0]!, dz1 = dzGrid[i1]!
      const base = rimBase + k * 4
      positions[base * 3 + 2] = WING_PAPER_Z_FRONT + dz0
      positions[(base + 1) * 3 + 2] = WING_PAPER_Z_BACK + dz0
      positions[(base + 2) * 3 + 2] = WING_PAPER_Z_BACK + dz1
      positions[(base + 3) * 3 + 2] = WING_PAPER_Z_FRONT + dz1
    }

    posAttr.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
  }

  return { geometry, deform }
}

/**
 * Watertight thin (0.0038) 2-manifold subdivided swallow body paper with a genuinely open
 * forked swallow tail (empty at x = 0, y = -1) and subtle wind billowing between spine and tail spars.
 */
export function createBodyPaperSheet(): DynamicPaperSheet {
  const halfCols = 6
  const torsoCols = halfCols * 2
  const torsoRows = 20
  const tailRows = 8

  type Pt = { x: number; y: number; u: number; v: number; bay: number; ao: number }
  const pts: Pt[] = []
  const makePt = (x: number, y: number): Pt => {
    const xAbs = Math.abs(x)
    const [u, v] = bodyToUv(x, y)
    const dSpine = y >= -0.74 && y <= 0.97 ? xAbs : Math.hypot(xAbs, y < -0.74 ? y + 0.74 : y - 0.97)
    const dTail = polyDist2D(xAbs, y, RIGHT_TAIL_FAST)
    const dBackRib = Math.min(
      polyDist2D(x, y, BODY_BACK_RIBS_2D[0]!),
      polyDist2D(x, y, BODY_BACK_RIBS_2D[1]!),
    )
    const dPerim = Math.abs(polygonSignedDist(x, y, BODY_OUTLINE_2D))
    const minSupport = Math.min(dSpine, dTail, dBackRib, dPerim)
    // Keep torso glued taut over the tucked wing roots (y > -0.25) so body never dips behind wing z = 0.0112.
    const freeTailZone = THREE.MathUtils.smoothstep(-y, 0.20, 0.34)
    const bay = THREE.MathUtils.smoothstep(minSupport, 0.012, 0.095) * freeTailZone
    const ao = 0.94 + 0.06 * THREE.MathUtils.smoothstep(Math.min(dSpine, dTail), 0.0, 0.06)
    return { x, y, u, v, bay, ao }
  }

  // 1. Torso grid: iy in [0..torsoRows] from y = -0.73 to y = +0.98, ix in [0..torsoCols].
  const torsoIdx = (iy: number, ix: number) => iy * (torsoCols + 1) + ix
  for (let iy = 0; iy <= torsoRows; iy++) {
    const t = iy / torsoRows
    const y = THREE.MathUtils.lerp(-0.73, 0.98, t)
    const hw = Math.max(0.004, bodyOuterHalfWidth(y))
    for (let ix = 0; ix <= torsoCols; ix++) {
      const s = (ix / torsoCols) * 2 - 1 // -1 .. +1
      pts.push(makePt(s * hw, y))
    }
  }

  // 2. Left & right forked tail prong grids: iy in [1..tailRows] from y = -0.73 down to y = -1.10.
  // Row 0 reuses the bottom row of the torso grid seamlessly!
  const leftTailStart = pts.length
  for (let iy = 1; iy <= tailRows; iy++) {
    const t = iy / tailRows
    const y = THREE.MathUtils.lerp(-0.73, -1.10, t)
    const xOuter = bodyOuterHalfWidth(y)
    const xInner = Math.min(xOuter - 0.005, bodyInnerForkHalfWidth(y))
    for (let ix = 0; ix <= halfCols; ix++) {
      const f = ix / halfCols // 0 = outer (-xOuter), 1 = inner fork (-xInner)
      pts.push(makePt(-THREE.MathUtils.lerp(xOuter, xInner, f), y))
    }
  }
  const leftTailIdx = (iy: number, ix: number) =>
    iy === 0 ? torsoIdx(0, ix) : leftTailStart + (iy - 1) * (halfCols + 1) + ix

  const rightTailStart = pts.length
  for (let iy = 1; iy <= tailRows; iy++) {
    const t = iy / tailRows
    const y = THREE.MathUtils.lerp(-0.73, -1.10, t)
    const xOuter = bodyOuterHalfWidth(y)
    const xInner = Math.min(xOuter - 0.005, bodyInnerForkHalfWidth(y))
    for (let ix = 0; ix <= halfCols; ix++) {
      const f = ix / halfCols // 0 = inner fork (+xInner), 1 = outer (+xOuter)
      pts.push(makePt(THREE.MathUtils.lerp(xInner, xOuter, f), y))
    }
  }
  const rightTailIdx = (iy: number, ix: number) =>
    iy === 0 ? torsoIdx(0, halfCols + ix) : rightTailStart + (iy - 1) * (halfCols + 1) + ix

  // CCW outer perimeter loop (viewed from +Z) tracing head, left edge, left fork tip, inner V-notch, right fork tip, right edge.
  const ring: number[] = []
  // Right outer edge going up: torso right side (iy = 0 -> torsoRows)
  for (let iy = 0; iy < torsoRows; iy++) ring.push(torsoIdx(iy, torsoCols))
  // Top crown peak right -> left
  for (let ix = torsoCols; ix > 0; ix--) ring.push(torsoIdx(torsoRows, ix))
  // Left outer edge going down torso
  for (let iy = torsoRows; iy > 0; iy--) ring.push(torsoIdx(iy, 0))
  // Left outer tail prong going down to tip
  for (let iy = 0; iy < tailRows; iy++) ring.push(leftTailIdx(iy, 0))
  // Left tail tip outer -> inner
  for (let ix = 0; ix < halfCols; ix++) ring.push(leftTailIdx(tailRows, ix))
  // Left inner fork going up to V-notch at (0, -0.73)
  for (let iy = tailRows; iy > 0; iy--) ring.push(leftTailIdx(iy, halfCols))
  // Right inner fork going down from V-notch to right tail tip
  for (let iy = 0; iy < tailRows; iy++) ring.push(rightTailIdx(iy, 0))
  // Right tail tip inner -> outer
  for (let ix = 0; ix < halfCols; ix++) ring.push(rightTailIdx(tailRows, ix))
  // Right outer tail prong going up to torso seam
  for (let iy = tailRows; iy > 0; iy--) ring.push(rightTailIdx(iy, halfCols))

  const frontCount = pts.length
  const backBase = frontCount
  const rimBase = frontCount * 2
  const totalVerts = frontCount * 2 + ring.length * 4
  const positions = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const colors = new Float32Array(totalVerts * 3)
  const indices: number[] = []

  // Front & back vertices.
  for (let i = 0; i < frontCount; i++) {
    const pt = pts[i]!
    positions[i * 3] = pt.x; positions[i * 3 + 1] = pt.y; positions[i * 3 + 2] = BODY_PAPER_Z_FRONT
    uvs[i * 2] = pt.u; uvs[i * 2 + 1] = pt.v
    colors[i * 3] = pt.ao; colors[i * 3 + 1] = pt.ao; colors[i * 3 + 2] = pt.ao

    const bi = backBase + i
    positions[bi * 3] = pt.x; positions[bi * 3 + 1] = pt.y; positions[bi * 3 + 2] = BODY_PAPER_Z_BACK
    uvs[bi * 2] = pt.u; uvs[bi * 2 + 1] = pt.v
    const sb = pt.ao * 0.96
    colors[bi * 3] = sb; colors[bi * 3 + 1] = sb; colors[bi * 3 + 2] = sb
  }

  const pushQuad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d)
    indices.push(backBase + a, backBase + c, backBase + b, backBase + a, backBase + d, backBase + c)
  }

  // Torso quads.
  for (let iy = 0; iy < torsoRows; iy++) {
    for (let ix = 0; ix < torsoCols; ix++) {
      pushQuad(torsoIdx(iy, ix), torsoIdx(iy, ix + 1), torsoIdx(iy + 1, ix + 1), torsoIdx(iy + 1, ix))
    }
  }
  // Left & right forked tail quads (note iy increases downward, so a=down-left, b=down-right, c=up-right, d=up-left is CCW).
  for (let iy = 0; iy < tailRows; iy++) {
    for (let ix = 0; ix < halfCols; ix++) {
      pushQuad(leftTailIdx(iy + 1, ix), leftTailIdx(iy + 1, ix + 1), leftTailIdx(iy, ix + 1), leftTailIdx(iy, ix))
      pushQuad(rightTailIdx(iy + 1, ix), rightTailIdx(iy + 1, ix + 1), rightTailIdx(iy, ix + 1), rightTailIdx(iy, ix))
    }
  }

  // Closed thin cut-paper perimeter rim.
  for (let k = 0; k < ring.length; k++) {
    const i0 = ring[k]!, i1 = ring[(k + 1) % ring.length]!
    const p0 = pts[i0]!, p1 = pts[i1]!
    const base = rimBase + k * 4
    const quad = [
      [p0.x, p0.y, BODY_PAPER_Z_FRONT, p0.u, p0.v],
      [p0.x, p0.y, BODY_PAPER_Z_BACK, p0.u, p0.v],
      [p1.x, p1.y, BODY_PAPER_Z_BACK, p1.u, p1.v],
      [p1.x, p1.y, BODY_PAPER_Z_FRONT, p1.u, p1.v],
    ] as const
    for (let j = 0; j < 4; j++) {
      const vi = base + j
      positions[vi * 3] = quad[j]![0]
      positions[vi * 3 + 1] = quad[j]![1]
      positions[vi * 3 + 2] = quad[j]![2]
      uvs[vi * 2] = quad[j]![3]
      uvs[vi * 2 + 1] = quad[j]![4]
      colors[vi * 3] = 0.97; colors[vi * 3 + 1] = 0.95; colors[vi * 3 + 2] = 0.89
    }
    indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3)
  }

  const geometry = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(positions, 3)
  posAttr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', posAttr)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute
  normAttr.setUsage(THREE.DynamicDrawUsage)

  let lastKey = ''
  const dzArr = new Float32Array(frontCount)

  const deform = ({ lift, wind }: { fit: number; lift: number; wind: number }) => {
    const key = `${lift.toFixed(4)}|${wind.toFixed(4)}`
    if (key === lastKey) return
    lastKey = key

    const steady = lift * 0.008
    const hasWave = wind !== 0 && lift > 0.01

    for (let i = 0; i < frontCount; i++) {
      const pt = pts[i]!
      let dz = 0
      if (pt.bay > 0.0001 && lift > 0.0001) {
        const wave = hasWave ? Math.sin(wind * 3.5 + pt.y * 4.5) * 0.0035 * lift : 0
        dz = -(steady + wave) * pt.bay
      }
      dzArr[i] = dz
      positions[i * 3 + 2] = BODY_PAPER_Z_FRONT + dz
      positions[(backBase + i) * 3 + 2] = BODY_PAPER_Z_BACK + dz
    }

    for (let k = 0; k < ring.length; k++) {
      const dz0 = dzArr[ring[k]!]!, dz1 = dzArr[ring[(k + 1) % ring.length]!]!
      const base = rimBase + k * 4
      positions[base * 3 + 2] = BODY_PAPER_Z_FRONT + dz0
      positions[(base + 1) * 3 + 2] = BODY_PAPER_Z_BACK + dz0
      positions[(base + 2) * 3 + 2] = BODY_PAPER_Z_BACK + dz1
      positions[(base + 3) * 3 + 2] = BODY_PAPER_Z_FRONT + dz1
    }

    posAttr.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
  }

  return { geometry, deform }
}

/** Shared sheet-paper ritual-optics material for the thin kite paper panels. */
export function createKitePaperMaterial(
  map: THREE.DataTexture,
  emissiveMap: THREE.DataTexture,
  aspect: number,
  emissiveIntensity = 0.38,
): THREE.MeshStandardMaterial {
  return createRitualMaterial({
    color: 0xffffff,
    map,
    emissive: 0xfff0d0,
    emissiveMap,
    emissiveIntensity,
    roughness: 0.95,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.36,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      aspect,
      grainScale: 6.8,
      grain: 0.46,
      fibers: 0.10,
      edge: 0,
      highlightGuard: 0.78,
    },
  })
}
