import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

export const RIGHT_X_MIN = 0.018
export const RIGHT_W = 1.07
export const LEFT_X_MIN = 0.028
export const LEFT_W = 1.06
export const PAGE_Z_MIN = -0.625
export const PAGE_D = 1.25
export const SEAL_WORLD_X = 0.76
export const SEAL_WORLD_Z = 0.45

const RIGHT_BASE_Y = 0.9772
const SEAL_LIFT = 0.0016

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
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
    valueNoise2(x, y, seed) * 0.58 +
    valueNoise2(x * 2.13 + 7.1, y * 2.13 + 3.7, seed + 17) * 0.29 +
    valueNoise2(x * 4.41 + 13.3, y * 4.41 + 11.9, seed + 31) * 0.13
  )
}

/**
 * Evaluates the gently arched open-book top surface of the right page in world coordinates.
 * Dips smoothly into the center spine gutter (`x -> 0.018`), arches softly across mid-page,
 * and settles cleanly beneath the resting cloth ribbon (`y_bot = 0.994`) and brass clip (`y_bot = 1.003`).
 */
export function evalRightPageTopY(x: number, z: number): number {
  const u = THREE.MathUtils.clamp((x - RIGHT_X_MIN) / RIGHT_W, 0, 1)
  const v = THREE.MathUtils.clamp((z - PAGE_Z_MIN) / PAGE_D, 0, 1)
  const gutterDip = -0.0098 * Math.exp(-Math.pow(u / 0.145, 1.55))
  const bookArch = 0.0056 * Math.sin(Math.PI * Math.pow(u, 0.78)) * (1 - 0.14 * Math.pow(2 * v - 1, 2))
  const microWave = 0.0005 * Math.sin(u * Math.PI * 2.1 + v * 1.4)
  const cornerLift = 0.0012 * Math.pow(u, 3.2) * Math.pow(v, 2.2)
  return 0.9888 + gutterDip + bookArch + microWave + cornerLift
}

/**
 * Evaluates the open-page lift of `journal-inside-cover` above the opened front cover
 * (`local y = -lift`, so `world y = 0.995 + lift` when `hinge.rotation.z = Math.PI`).
 * `s = 0` is the center spine gutter; `s = 1` is the outer left fore-edge.
 */
function evalLeftPageLift(s: number, v: number): number {
  const gutterDip = -0.0052 * Math.exp(-Math.pow(s / 0.15, 1.55))
  const bookArch = 0.0062 * Math.sin(Math.PI * Math.pow(s, 0.80)) * (1 - 0.12 * Math.pow(2 * v - 1, 2))
  const microWave = 0.0004 * Math.sin(s * Math.PI * 2.2 - v * 1.2)
  return Math.max(0.0018, 0.0068 + gutterDip + bookArch + microWave)
}

function createClosedBookSheetGeometry(opts: {
  cols: number
  rows: number
  evalTop: (u: number, v: number) => [number, number, number]
  evalBot: (u: number, v: number) => [number, number, number]
  evalShade: (u: number, v: number) => [number, number, number]
  flipWinding?: boolean
}): THREE.BufferGeometry {
  const { cols, rows, evalTop, evalBot, evalShade, flipWinding = false } = opts
  const stride = cols + 1
  const gridCount = stride * (rows + 1)

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const topPts: [number, number, number][] = new Array(gridCount)
  const botPts: [number, number, number][] = new Array(gridCount)
  const shades: [number, number, number][] = new Array(gridCount)

  for (let iv = 0; iv <= rows; iv++) {
    const v = iv / rows
    for (let iu = 0; iu <= cols; iu++) {
      const u = iu / cols
      const idx = iv * stride + iu
      topPts[idx] = evalTop(u, v)
      botPts[idx] = evalBot(u, v)
      shades[idx] = evalShade(u, v)
    }
  }

  // Visible open-top surface (0 .. gridCount - 1).
  for (let iv = 0; iv <= rows; iv++) {
    const v = iv / rows
    for (let iu = 0; iu <= cols; iu++) {
      const u = iu / cols
      const idx = iv * stride + iu
      const p = topPts[idx]!
      const c = shades[idx]!
      positions.push(p[0], p[1], p[2])
      uvs.push(u, v)
      colors.push(c[0], c[1], c[2])
    }
  }

  // Back / seated surface (gridCount .. 2 * gridCount - 1).
  for (let iv = 0; iv <= rows; iv++) {
    const v = iv / rows
    for (let iu = 0; iu <= cols; iu++) {
      const u = iu / cols
      const idx = iv * stride + iu
      const p = botPts[idx]!
      const c = shades[idx]!
      positions.push(p[0], p[1], p[2])
      uvs.push(u, v)
      colors.push(c[0] * 0.90, c[1] * 0.89, c[2] * 0.86)
    }
  }

  const quad = (a: number, b: number, c: number, d: number) => {
    if (flipWinding) indices.push(a, c, b, a, d, c)
    else indices.push(a, b, c, a, c, d)
  }

  for (let iv = 0; iv < rows; iv++) {
    for (let iu = 0; iu < cols; iu++) {
      const a = iv * stride + iu
      // u along +X, v along +Z -> (+Z) x (+X) = +Y: CCW top quad is (a, a+stride, a+stride+1, a+1).
      quad(a, a + stride, a + stride + 1, a + 1)
      quad(gridCount + a, gridCount + a + 1, gridCount + a + stride + 1, gridCount + a + stride)
    }
  }

  // Crisp cut-paper perimeter strips along all 4 edges with independent edge normals.
  const perimeter: number[] = []
  for (let iu = 0; iu <= cols; iu++) perimeter.push(iu) // back edge (v = 0): u 0 -> 1
  for (let iv = 1; iv <= rows; iv++) perimeter.push(iv * stride + cols) // right edge (u = 1): v 0 -> 1
  for (let iu = cols - 1; iu >= 0; iu--) perimeter.push(rows * stride + iu) // front edge (v = 1): u 1 -> 0
  for (let iv = rows - 1; iv >= 0; iv--) perimeter.push(iv * stride) // left edge (u = 0): v 1 -> 0

  for (let i = 0; i < perimeter.length - 1; i++) {
    const k0 = perimeter[i]!
    const k1 = perimeter[i + 1]!
    const t0 = topPts[k0]!
    const b0 = botPts[k0]!
    const t1 = topPts[k1]!
    const b1 = botPts[k1]!
    const u0 = (k0 % stride) / cols
    const v0 = Math.floor(k0 / stride) / rows
    const u1 = (k1 % stride) / cols
    const v1 = Math.floor(k1 / stride) / rows
    const c0 = shades[k0]!
    const c1 = shades[k1]!
    const base = positions.length / 3
    positions.push(
      t0[0], t0[1], t0[2],
      t1[0], t1[1], t1[2],
      b1[0], b1[1], b1[2],
      b0[0], b0[1], b0[2],
    )
    uvs.push(u0, v0, u1, v1, u1, v1, u0, v0)
    colors.push(
      c0[0] * 0.94, c0[1] * 0.91, c0[2] * 0.86,
      c1[0] * 0.94, c1[1] * 0.91, c1[2] * 0.86,
      c1[0] * 0.85, c1[1] * 0.82, c1[2] * 0.77,
      c0[0] * 0.85, c0[1] * 0.82, c0[2] * 0.77,
    )
    quad(base, base + 1, base + 2, base + 3)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Gently arched right-hand journal page seated cleanly on top of the 5-layer page stack. */
export function createRightPageGeometry(): THREE.BufferGeometry {
  return createClosedBookSheetGeometry({
    cols: 30,
    rows: 24,
    evalTop(u, v) {
      const x = RIGHT_X_MIN + u * RIGHT_W
      const z = PAGE_Z_MIN + v * PAGE_D
      return [x, evalRightPageTopY(x, z), z]
    },
    evalBot(u, v) {
      const x = RIGHT_X_MIN + u * RIGHT_W
      const z = PAGE_Z_MIN + v * PAGE_D
      return [x, RIGHT_BASE_Y, z]
    },
    evalShade(u, v) {
      // Soft warm ambient occlusion dipping into the spine gutter (`u -> 0`) and subtle outer-edge warmth.
      const gutterAO = 1 - 0.30 * Math.exp(-Math.pow(u / 0.13, 1.35))
      const edgeTint = 1 - 0.035 * Math.pow(Math.max(0, u - 0.82) / 0.18, 2) - 0.025 * Math.pow(Math.abs(2 * v - 1), 3)
      const s = gutterAO * edgeTint
      return [s, s * 0.992, s * 0.976]
    },
  })
}

/**
 * Gently arched left-hand journal page authored in `journal-hinge` local coordinates.
 * Local `x ∈ [0.028, 1.088]` flips to world `x ∈ [-1.088, -0.028]` and local `-Y` becomes world `+Y`
 * when the cover opens (`hinge.rotation.z = Math.PI`).
 * UVs map left-to-right in reader space (`u = 0` outer left edge, `u = 1` center spine gutter).
 */
export function createLeftPageGeometry(): THREE.BufferGeometry {
  return createClosedBookSheetGeometry({
    cols: 28,
    rows: 22,
    // As `u` increases from 0 -> 1, local `x` decreases (+1.088 -> +0.028), while `v` increases along +Z.
    // (+Z) x (-X) = -Y, which is the exact outward normal of the open-top face in `hinge` local space!
    evalTop(u, v) {
      const s = 1 - u // s = 0 at spine, s = 1 at outer left edge
      const localX = LEFT_X_MIN + s * LEFT_W
      const localZ = PAGE_Z_MIN + v * PAGE_D
      return [localX, -evalLeftPageLift(s, v), localZ]
    },
    evalBot(u, v) {
      const s = 1 - u
      const localX = LEFT_X_MIN + s * LEFT_W
      const localZ = PAGE_Z_MIN + v * PAGE_D
      return [localX, 0.0002, localZ]
    },
    evalShade(u, v) {
      const s = 1 - u // spine at s = 0
      const gutterAO = 1 - 0.32 * Math.exp(-Math.pow(s / 0.14, 1.35))
      const edgeTint = 1 - 0.035 * Math.pow(Math.max(0, s - 0.82) / 0.18, 2) - 0.025 * Math.pow(Math.abs(2 * v - 1), 3)
      const sVal = gutterAO * edgeTint
      return [sVal, sVal * 0.992, sVal * 0.976]
    },
  })
}

/**
 * Paper-conforming flat botanical leaf silhouette for `journal-page-seal`.
 * Lies flush on the curved right page (`+0.0016` clearance, zero thickness, zero drop shadow)
 * with its local origin `(0, 0, 0)` centered on the leaf so raycasting always hits the seal first.
 */
export function createPageSealGeometry(): { geometry: THREE.BufferGeometry; position: [number, number, number] } {
  const originY = evalRightPageTopY(SEAL_WORLD_X, SEAL_WORLD_Z) + SEAL_LIFT
  const halfLen = 0.112
  const halfWid = 0.080
  const tilt = -0.52 // gracefully tilted upward-right on the bottom-right corner of the page
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)

  const rings = 7
  const segs = 28
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const evalLeafXZ = (t: number, radial: number): [number, number] => {
    // Graceful pointed botanical leaf profile parameterized by angle t ∈ [0, 2π].
    const ca = Math.cos(t)
    const sa = Math.sin(t)
    // Taper smoothly into a distinct botanical leaf point at the tip (+localX) and rounded base (-localX).
    const tipPinch = ca >= 0 ? Math.pow(1 - ca * 0.62, 0.72) : 1 - 0.14 * (-ca)
    const lx = ca * halfLen * radial
    const lz = sa * halfWid * tipPinch * radial
    // Rotate in XZ plane around center.
    const wx = SEAL_WORLD_X + lx * ct - lz * st
    const wz = SEAL_WORLD_Z + lx * st + lz * ct
    return [wx, wz]
  }

  // Center vertex (index 0) at exact local (0, 0, 0).
  positions.push(0, 0, 0)
  uvs.push(0.5, 0.5)

  for (let ir = 1; ir <= rings; ir++) {
    const r = ir / rings
    for (let is = 0; is < segs; is++) {
      // Negative angle sweep keeps (+X -> -Z) CCW when viewed from +Y.
      const t = -(is / segs) * Math.PI * 2
      const [wx, wz] = evalLeafXZ(t, r)
      const wy = evalRightPageTopY(wx, wz) + SEAL_LIFT
      positions.push(wx - SEAL_WORLD_X, wy - originY, wz - SEAL_WORLD_Z)
      const ca = Math.cos(t)
      const sa = Math.sin(t)
      uvs.push(0.5 + ca * r * 0.48, 0.5 + sa * r * 0.48)
    }
  }

  // Inner fan around center vertex 0.
  for (let is = 0; is < segs; is++) {
    const a = 1 + is
    const b = 1 + ((is + 1) % segs)
    indices.push(0, a, b)
  }
  // Concentric rings.
  for (let ir = 1; ir < rings; ir++) {
    const row0 = 1 + (ir - 1) * segs
    const row1 = 1 + ir * segs
    for (let is = 0; is < segs; is++) {
      const next = (is + 1) % segs
      const a0 = row0 + is
      const b0 = row0 + next
      const a1 = row1 + is
      const b1 = row1 + next
      indices.push(a0, a1, b1, a0, b1, b0)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return { geometry, position: [SEAL_WORLD_X, originY, SEAL_WORLD_Z] }
}

type PolySample = { x: number; z: number; t: number }

function sampleSpline2D(points: readonly (readonly [number, number])[], samples: number): PolySample[] {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
  )
  const out: PolySample[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const p = curve.getPoint(t)
    out.push({ x: p.x, z: p.z, t })
  }
  return out
}

function closestOnPolyline(px: number, pz: number, poly: readonly PolySample[]): { dist: number; t: number; signed: number } {
  let bestD2 = Infinity
  let bestT = 0
  let bestSigned = 0
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i]!
    const b = poly[i + 1]!
    const abx = b.x - a.x
    const abz = b.z - a.z
    const len2 = Math.max(1e-9, abx * abx + abz * abz)
    const segT = THREE.MathUtils.clamp(((px - a.x) * abx + (pz - a.z) * abz) / len2, 0, 1)
    const cx = a.x + abx * segT
    const cz = a.z + abz * segT
    const dx = px - cx
    const dz = pz - cz
    const d2 = dx * dx + dz * dz
    if (d2 < bestD2) {
      bestD2 = d2
      bestT = a.t + (b.t - a.t) * segT
      const cross = abx * dz - abz * dx
      bestSigned = cross >= 0 ? Math.sqrt(d2) : -Math.sqrt(d2)
    }
  }
  return { dist: Math.sqrt(bestD2), t: bestT, signed: bestSigned }
}

function segDist2D(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax
  const abz = bz - az
  const t = THREE.MathUtils.clamp(((px - ax) * abx + (pz - az) * abz) / Math.max(1e-9, abx * abx + abz * abz), 0, 1)
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t))
}

/** Multiply-glaze watercolor blend so paper warmth and granulation stay visible through pigment. */
function glazePigment(
  r: number, g: number, b: number,
  pr: number, pg: number, pb: number,
  alpha: number,
): [number, number, number] {
  const a = THREE.MathUtils.clamp(alpha, 0, 1)
  if (a <= 0.0005) return [r, g, b]
  // Blend between translucent multiply wash and light gouache lift so hues stay crisp on warm cream paper.
  const mr = (r * pr) / 236
  const mg = (g * pg) / 224
  const mb = (b * pb) / 196
  const tr = mr * 0.65 + pr * 0.35
  const tg = mg * 0.65 + pg * 0.35
  const tb = mb * 0.65 + pb * 0.35
  return [
    r + (tr - r) * a,
    g + (tg - g) * a,
    b + (tb - b) * a,
  ]
}

let cachedRightPixels: Uint8Array<ArrayBuffer> | null = null
let cachedLeftPixels: Uint8Array<ArrayBuffer> | null = null
let cachedSealPixels: Uint8Array<ArrayBuffer> | null = null

const PAGE_TEX_W = 512
const PAGE_TEX_H = 640
const SEAL_TEX_SIZE = 256

/**
 * Deterministic 512x640 right-page hand-drawn ink & watercolor spread (`DataTexture`, WebGL + jsdom safe).
 * Paints the winding mountain trail, meandering stream, tree clusters, subtle distant hill wash,
 * hand-ruled inner margin frame, and warm spine-gutter/edge cotton paper character directly into the paper.
 */
function buildRightPagePixels(): Uint8Array<ArrayBuffer> {
  if (cachedRightPixels) return new Uint8Array(cachedRightPixels)
  const w = PAGE_TEX_W
  const h = PAGE_TEX_H
  const data = new Uint8Array(w * h * 4)

  // Original trail & stream trajectories preserved faithfully in page world coordinates (x, z).
  const pathPoly = sampleSpline2D(
    [
      [0.25, 0.51],
      [0.29, 0.47],
      [0.52, 0.29],
      [0.37, 0.05],
      [0.63, -0.22],
      [0.56, -0.48],
      [0.52, -0.53],
    ],
    44,
  )
  const streamPoly = sampleSpline2D(
    [
      [0.18, 0.49],
      [0.18, 0.45],
      [0.19, 0.14],
      [0.29, -0.14],
      [0.20, -0.49],
      [0.19, -0.53],
    ],
    36,
  )
  // Quiet upper-page distant mountain ridge contours (original minimal travel sketch).
  const ridgeBack = sampleSpline2D(
    [[0.09, -0.44], [0.24, -0.52], [0.39, -0.45], [0.56, -0.55], [0.70, -0.47]],
    26,
  )
  const ridgeFront = sampleSpline2D(
    [[0.10, -0.38], [0.31, -0.44], [0.47, -0.39], [0.68, -0.45]],
    22,
  )

  // Hand-painted watercolor & ink tree clusters ("树影") echoing the 4 original foliage positions
  // while keeping clear of the red ribbon slot & cloth resting at x ∈ [0.79, 0.93], z ∈ [-0.52, 0.02].
  type TreeCluster = {
    cx: number; cz: number; rx: number; rz: number
    tilt: number; tone: number; trunkLen: number
    sub?: readonly [number, number, number, number][]
  }
  const trees: readonly TreeCluster[] = [
    // Upper-mid left beside stream & path (near original [0.34, -0.36])
    {
      cx: 0.36, cz: -0.34, rx: 0.048, rz: 0.044, tilt: 0.22, tone: 0, trunkLen: 0.052,
      sub: [[-0.036, 0.012, 0.034, 0.030], [0.036, -0.014, 0.033, 0.029], [0.004, -0.028, 0.030, 0.026]],
    },
    // Mid-right beside path & clear of ribbon edge (near original [0.77, -0.10])
    {
      cx: 0.69, cz: -0.09, rx: 0.050, rz: 0.046, tilt: -0.18, tone: 1, trunkLen: 0.054,
      sub: [[-0.042, 0.024, 0.036, 0.032], [0.026, 0.030, 0.031, 0.026], [-0.008, -0.030, 0.032, 0.028]],
    },
    // Lower-right above interactive leaf seal (near original [0.76, 0.25])
    {
      cx: 0.72, cz: 0.21, rx: 0.054, rz: 0.048, tilt: 0.26, tone: 0, trunkLen: 0.056,
      sub: [[0.046, -0.020, 0.038, 0.034], [-0.040, 0.020, 0.033, 0.028], [0.008, -0.032, 0.034, 0.028]],
    },
    // Foreground grove beside trail start (near original [0.40, 0.45])
    {
      cx: 0.43, cz: 0.43, rx: 0.046, rz: 0.040, tilt: 0.20, tone: 2, trunkLen: 0.048,
      sub: [[0.044, 0.016, 0.034, 0.028], [-0.030, 0.018, 0.028, 0.024], [0.012, -0.024, 0.028, 0.024]],
    },
    // Quiet distant upper-left hill tuft beside stream headwaters
    {
      cx: 0.14, cz: -0.25, rx: 0.032, rz: 0.028, tilt: -0.12, tone: 2, trunkLen: 0.036,
      sub: [[0.022, -0.018, 0.025, 0.022]],
    },
  ]

  // Subtle hand-drawn slope hachure strokes tucked along bends of the mountain trail.
  const hachures: readonly [number, number, number, number][] = [
    [0.57, 0.24, 0.63, 0.22], [0.58, 0.28, 0.64, 0.27], [0.57, 0.32, 0.62, 0.31],
    [0.30, 0.02, 0.24, 0.01], [0.29, 0.06, 0.24, 0.06], [0.31, 0.10, 0.25, 0.11],
    [0.67, -0.26, 0.72, -0.28], [0.68, -0.22, 0.73, -0.23],
  ]

  for (let iy = 0; iy < h; iy++) {
    const v = iy / (h - 1)
    const z = PAGE_Z_MIN + v * PAGE_D
    for (let ix = 0; ix < w; ix++) {
      const u = ix / (w - 1)
      const x = RIGHT_X_MIN + u * RIGHT_W

      // 1. Warm handmade cotton-rag paper base with multi-scale pulp mottling & faint laid screen.
      const nMacro = fbm2(u * 5.2, v * 6.2, 11) - 0.5
      const nTooth = (hash2(ix, iy, 23) - 0.5) * 0.036
      const nWash = fbm2(u * 14.0, v * 16.0, 47) - 0.5
      const laid = Math.sin(v * 210 + nMacro * 3.5) * 0.009

      // Sunlit warm cream ivory (calibrated below clipping under Komorebi + highlightGuard).
      let r = 234 + nMacro * 17 + laid * 14
      let g = 222 + nMacro * 16 + laid * 13
      let b = 192 + nMacro * 17 + laid * 11

      // Soft warm age-tint near outer edges & subtle spine-gutter shading on left (`u -> 0`).
      const gutter = Math.exp(-Math.pow(u / 0.105, 1.45))
      const outerWarm = Math.pow(Math.max(0, u - 0.85) / 0.15, 2) + Math.pow(Math.max(0, Math.abs(v - 0.5) - 0.41) / 0.09, 2)
      r *= 1 - gutter * 0.18 - outerWarm * 0.038
      g *= 1 - gutter * 0.20 - outerWarm * 0.052
      b *= 1 - gutter * 0.23 - outerWarm * 0.072

      // 2. Hand-ruled delicate sepia inner notebook border frame.
      const bx0 = 0.065, bx1 = 1.032, bz0 = -0.570, bz1 = 0.570
      const wobble = nWash * 0.0032
      const onTopBot = x >= bx0 && x <= bx1 ? Math.min(Math.abs(z - bz0 + wobble), Math.abs(z - bz1 - wobble)) : 1
      const onLeftRight = z >= bz0 && z <= bz1 ? Math.min(Math.abs(x - bx0 + wobble), Math.abs(x - bx1 - wobble)) : 1
      const frameD = Math.min(onTopBot, onLeftRight)
      if (frameD < 0.0052) {
        const frameFade = THREE.MathUtils.smoothstep(u, 0.03, 0.11)
        const a = (1 - THREE.MathUtils.smoothstep(frameD, 0.0018, 0.0050)) * 0.30 * frameFade * (0.85 + nWash * 0.40)
        ;[r, g, b] = glazePigment(r, g, b, 118, 96, 74, a)
      }

      // 3. Distant pale watercolor mountain horizon wash & fine sepia contour line in upper area.
      if (z < -0.30 && x > 0.07 && x < 0.74) {
        const dBack = closestOnPolyline(x, z, ridgeBack)
        const dFront = closestOnPolyline(x, z, ridgeFront)
        if (dBack.signed < 0.095 && dBack.signed > -0.010 && x > 0.09 && x < 0.70) {
          const band = (1 - THREE.MathUtils.smoothstep(dBack.signed, 0.004, 0.088)) * THREE.MathUtils.smoothstep(dBack.signed, -0.008, 0.004)
          const fadeX = THREE.MathUtils.smoothstep(x, 0.09, 0.16) * (1 - THREE.MathUtils.smoothstep(x, 0.62, 0.70))
          const a = band * fadeX * (0.34 + nWash * 0.12)
          ;[r, g, b] = glazePigment(r, g, b, 138, 158, 144, a)
        }
        if (dFront.signed < 0.06 && dFront.signed > -0.008 && x > 0.10 && x < 0.68) {
          const band = (1 - THREE.MathUtils.smoothstep(dFront.signed, 0.003, 0.056)) * THREE.MathUtils.smoothstep(dFront.signed, -0.006, 0.003)
          const fadeX = THREE.MathUtils.smoothstep(x, 0.10, 0.17) * (1 - THREE.MathUtils.smoothstep(x, 0.60, 0.68))
          const a = band * fadeX * (0.24 + nWash * 0.10)
          ;[r, g, b] = glazePigment(r, g, b, 178, 152, 116, a)
        }
        const ridgeLineD = Math.min(dBack.dist, dFront.dist)
        if (ridgeLineD < 0.0064) {
          const a = (1 - THREE.MathUtils.smoothstep(ridgeLineD, 0.0020, 0.0060)) * 0.44 * (0.85 + nWash * 0.35)
          ;[r, g, b] = glazePigment(r, g, b, 102, 88, 72, a)
        }
      }

      // 4. Meandering Stream ("溪流"): soft mineral slate-teal watercolor ribbon with wet-edge pooling & organic tapered ends.
      if (x > 0.11 && x < 0.36 && z > -0.55 && z < 0.53) {
        const sHit = closestOnPolyline(x, z, streamPoly)
        const endFade = THREE.MathUtils.smoothstep(sHit.t, 0.0, 0.07) * (1 - THREE.MathUtils.smoothstep(sHit.t, 0.92, 1.0))
        const streamHalfW = THREE.MathUtils.lerp(0.025, 0.012, sHit.t) * (0.65 + 0.35 * endFade) * (1 + nWash * 0.28)
        const dEdge = sHit.dist - streamHalfW
        if (dEdge < 0.009) {
          const core = (1 - THREE.MathUtils.smoothstep(dEdge, -0.003, 0.0085)) * endFade
          const bankPool = Math.exp(-Math.pow((sHit.dist - streamHalfW * 0.80) / 0.0062, 2))
          const dryTooth = THREE.MathUtils.clamp(0.76 + nWash * 0.44, 0.46, 1.0)
          const waterAlpha = core * (0.54 + bankPool * 0.28) * dryTooth
          ;[r, g, b] = glazePigment(r, g, b, 98, 146, 148, waterAlpha)
          // Broken calligraphic ink bank on the shaded right side + whisper-fine flow ticks inside.
          const penBreak = THREE.MathUtils.smoothstep(Math.sin(sHit.t * 31 + nMacro * 6), -0.45, 0.15)
          const oneBankInk = Math.exp(-Math.pow((sHit.signed - streamHalfW * 0.92) / 0.0030, 2)) * penBreak
          const rippleWave = Math.sin(sHit.t * 58 + nMacro * 5) > 0.28 ? Math.exp(-Math.pow(sHit.signed / 0.0028, 2)) : 0
          const inkA = Math.max(oneBankInk * 0.30, rippleWave * 0.32) * core
          ;[r, g, b] = glazePigment(r, g, b, 64, 102, 108, inkA)
        }
      }

      // 5. Winding Mountain Path ("山路"): loose warm ochre-sienna watercolor wash + broken sepia pen & dashed trail marks.
      if (x > 0.19 && x < 0.72 && z > -0.55 && z < 0.55) {
        const pHit = closestOnPolyline(x, z, pathPoly)
        const endFade = THREE.MathUtils.smoothstep(pHit.t, 0.0, 0.06) * (1 - THREE.MathUtils.smoothstep(pHit.t, 0.93, 1.0))
        const pathHalfW = THREE.MathUtils.lerp(0.039, 0.022, pHit.t) * (0.72 + 0.28 * endFade) * (1 + nWash * 0.28)
        const dEdge = pHit.dist - pathHalfW
        if (dEdge < 0.011) {
          const core = (1 - THREE.MathUtils.smoothstep(dEdge, -0.003, 0.0105)) * endFade
          // Classic watercolor edge-bloom & dry-brush granulation so cream paper grain breathes through.
          const rimPool = Math.exp(-Math.pow((pHit.dist - pathHalfW * 0.80) / 0.0085, 2))
          const dryTooth = THREE.MathUtils.clamp(0.74 + nWash * 0.50, 0.42, 1.0)
          const washA = core * (0.56 + rimPool * 0.26) * dryTooth
          ;[r, g, b] = glazePigment(r, g, b, 182, 130, 78, washA)

          // Broken loose sepia sketch edge (not a hard cartoon double-border) + crisp trail dashes.
          const penBreak = THREE.MathUtils.smoothstep(Math.sin(pHit.t * 37 + (pHit.signed > 0 ? 0.5 : 2.8) + nMacro * 5), -0.35, 0.22)
          const edgeInk = Math.exp(-Math.pow((Math.abs(pHit.signed) - pathHalfW * 0.92) / 0.0032, 2)) * penBreak * (0.65 + nWash * 0.45)
          const dashMask = THREE.MathUtils.smoothstep(Math.sin(pHit.t * 88), 0.02, 0.36)
          const dashCenter = Math.exp(-Math.pow(sShift(pHit.signed, nWash * 0.0028) / 0.0038, 2)) * dashMask
          const lineA = Math.max(edgeInk * 0.30, dashCenter * 0.56) * core
          ;[r, g, b] = glazePigment(r, g, b, 92, 65, 44, lineA)
        }
      }

      // Delicate sepia terrain hachures near mountain path bends.
      for (let hi = 0; hi < hachures.length; hi++) {
        const [ax, az, bx, bz] = hachures[hi]!
        if (Math.abs(x - ax) < 0.08 && Math.abs(z - az) < 0.08) {
          const d = segDist2D(x, z, ax, az, bx, bz)
          if (d < 0.0048) {
            const a = (1 - THREE.MathUtils.smoothstep(d, 0.0016, 0.0045)) * 0.38
            ;[r, g, b] = glazePigment(r, g, b, 100, 76, 54, a)
          }
        }
      }

      // 6. Hand-painted watercolor & sepia-ink tree clusters ("树影").
      for (let ti = 0; ti < trees.length; ti++) {
        const tr = trees[ti]!
        if (Math.abs(x - tr.cx) > 0.14 || Math.abs(z - tr.cz) > 0.14) continue

        // Whisper-soft warm ground shadow wash slightly below-right of canopy.
        const shD = Math.hypot((x - (tr.cx + 0.014)) / (tr.rx * 1.2), (z - (tr.cz + 0.036)) / (tr.rz * 0.62))
        if (shD < 1.15) {
          const shA = (1 - THREE.MathUtils.smoothstep(shD, 0.40, 1.12)) * 0.19
          ;[r, g, b] = glazePigment(r, g, b, 126, 128, 108, shA)
        }

        // Fine sepia trunk & tiny forked twig inked beneath the tree crown.
        const trunkD = segDist2D(x, z, tr.cx, tr.cz - 0.002, tr.cx + 0.004, tr.cz + tr.trunkLen)
        const twigD = segDist2D(x, z, tr.cx + 0.001, tr.cz + tr.trunkLen * 0.32, tr.cx - 0.018, tr.cz + 0.004)
        const twigR = segDist2D(x, z, tr.cx + 0.002, tr.cz + tr.trunkLen * 0.42, tr.cx + 0.017, tr.cz + 0.010)
        const inkD = Math.min(trunkD, twigD, twigR)
        if (inkD < 0.0062) {
          const inkA = (1 - THREE.MathUtils.smoothstep(inkD, 0.0022, 0.0058)) * 0.72
          ;[r, g, b] = glazePigment(r, g, b, 82, 63, 46, inkA)
        }

        // Main canopy + layered irregular watercolor foliage puffs.
        let bestEll = Infinity
        let subHit = false
        const ct = Math.cos(-tr.tilt), st = Math.sin(-tr.tilt)
        const dx0 = x - tr.cx, dz0 = z - tr.cz
        const rx0 = dx0 * ct - dz0 * st
        const rz0 = dx0 * st + dz0 * ct
        const blobJitter = 1 + nWash * 0.42
        bestEll = Math.hypot(rx0 / (tr.rx * blobJitter), rz0 / (tr.rz * blobJitter))
        if (tr.sub) {
          for (const [ox, oz, srx, srz] of tr.sub) {
            const e = Math.hypot((x - (tr.cx + ox)) / (srx * blobJitter), (z - (tr.cz + oz)) / (srz * blobJitter))
            if (e < bestEll) { bestEll = e; subHit = true }
          }
        }
        if (bestEll < 1.22) {
          const core = 1 - THREE.MathUtils.smoothstep(bestEll, 0.74, 1.16)
          const edgePool = Math.exp(-Math.pow((bestEll - 0.86) / 0.16, 2))
          // Subtle upper-left sunlit olive warmth vs lower-right cool moss depth inside the watercolor crown.
          const shadeGrad = THREE.MathUtils.clamp((dx0 + dz0) * 6.5, -0.5, 0.6)
          const [pr, pg, pb] = tr.tone === 0
            ? (subHit ? [118, 152, 112] : [96 - shadeGrad * 14, 134 - shadeGrad * 12, 100 - shadeGrad * 8])
            : tr.tone === 1
              ? (subHit ? [124, 154, 116] : [90 - shadeGrad * 14, 128 - shadeGrad * 12, 98 - shadeGrad * 8])
              : [110 - shadeGrad * 12, 144 - shadeGrad * 10, 108 - shadeGrad * 8]
          const canopyA = core * (0.56 + edgePool * 0.24 + nWash * 0.18)
          ;[r, g, b] = glazePigment(r, g, b, pr, pg, pb, canopyA)
          // Delicate broken pen-and-ink botanical contour around lower-right edge of crown.
          const sketchArc = THREE.MathUtils.smoothstep(dx0 + dz0, -0.025, 0.03)
          const sketchRim = Math.exp(-Math.pow((bestEll - 0.94) / 0.09, 2)) * (0.45 + 0.55 * sketchArc) * (0.55 + nWash * 0.65)
          ;[r, g, b] = glazePigment(r, g, b, 64, 82, 62, sketchRim * 0.34)
        }
      }

      // 7. Subtle botanical stem & faint watercolor halo directly beneath `journal-page-seal` ([0.76, 0.45])
      // so the flat interactive leaf mark feels genuinely painted/stamped onto the page.
      if (Math.abs(x - SEAL_WORLD_X) < 0.20 && Math.abs(z - SEAL_WORLD_Z) < 0.18) {
        const stemD = segDist2D(x, z, SEAL_WORLD_X - 0.155, SEAL_WORLD_Z + 0.088, SEAL_WORLD_X - 0.070, SEAL_WORLD_Z + 0.038)
        if (stemD < 0.0068) {
          const a = (1 - THREE.MathUtils.smoothstep(stemD, 0.0022, 0.0064)) * 0.72
          ;[r, g, b] = glazePigment(r, g, b, 72, 92, 66, a)
        }
        const haloD = Math.hypot((x - SEAL_WORLD_X) / 0.138, (z - SEAL_WORLD_Z) / 0.105)
        if (haloD < 1.15) {
          const a = (1 - THREE.MathUtils.smoothstep(haloD, 0.70, 1.12)) * 0.16
          ;[r, g, b] = glazePigment(r, g, b, 128, 158, 126, a)
        }
      }

      const mult = 1 + nTooth
      const idx = (iy * w + ix) * 4
      data[idx] = THREE.MathUtils.clamp(Math.round(r * mult), 0, 255)
      data[idx + 1] = THREE.MathUtils.clamp(Math.round(g * mult), 0, 255)
      data[idx + 2] = THREE.MathUtils.clamp(Math.round(b * mult), 0, 255)
      data[idx + 3] = 255
    }
  }

  cachedRightPixels = new Uint8Array(data)
  return data
}

function sShift(v: number, delta: number): number {
  return v + delta
}

/**
 * Deterministic 512x640 left-page handmade cotton paper texture (`DataTexture`, WebGL + jsdom safe).
 * Quiet, understated companion leaf opposite the trail page: matching warm cream paper tone,
 * spine-gutter shadow on the right (`u -> 1`), faint sepia margin frame, quiet minimalist hill sketch
 * echoing the cover's simple curve, delicate ruled journal lines, and whisper-light illegible pen-rhythm notes.
 */
function buildLeftPagePixels(): Uint8Array<ArrayBuffer> {
  if (cachedLeftPixels) return new Uint8Array(cachedLeftPixels)
  const w = PAGE_TEX_W
  const h = PAGE_TEX_H
  const data = new Uint8Array(w * h * 4)

  // Quiet original hill silhouette vignette in the upper third (normalized u ∈ [0.16, 0.80], v ∈ [0.16, 0.34]).
  const hillBack = sampleSpline2D(
    [[0.18, 0.30], [0.32, 0.21], [0.46, 0.26], [0.62, 0.17], [0.78, 0.29]],
    26,
  )
  const hillFront = sampleSpline2D(
    [[0.22, 0.32], [0.39, 0.27], [0.54, 0.30], [0.74, 0.26]],
    22,
  )

  const ruleVs = [0.44, 0.505, 0.57, 0.635, 0.70, 0.765, 0.83] as const
  // Soft abstract ink-cadence strokes (unreadable wavy field-note rhythm, zero text/letters).
  const noteLines: readonly { vBase: number; uStart: number; uEnd: number; seed: number }[] = [
    { vBase: 0.431, uStart: 0.16, uEnd: 0.66, seed: 3 },
    { vBase: 0.496, uStart: 0.16, uEnd: 0.78, seed: 7 },
    { vBase: 0.561, uStart: 0.16, uEnd: 0.54, seed: 13 },
    { vBase: 0.691, uStart: 0.16, uEnd: 0.72, seed: 19 },
    { vBase: 0.756, uStart: 0.16, uEnd: 0.46, seed: 29 },
  ]

  for (let iy = 0; iy < h; iy++) {
    const v = iy / (h - 1)
    for (let ix = 0; ix < w; ix++) {
      const u = ix / (w - 1)

      const nMacro = fbm2(u * 5.2 + 4.3, v * 6.2 + 2.1, 61) - 0.5
      const nTooth = (hash2(ix, iy, 73) - 0.5) * 0.036
      const nWash = fbm2(u * 14.0 + 3.1, v * 16.0 + 5.7, 89) - 0.5
      const laid = Math.sin(v * 210 + nMacro * 3.5) * 0.009

      let r = 234 + nMacro * 17 + laid * 14
      let g = 222 + nMacro * 16 + laid * 13
      let b = 192 + nMacro * 17 + laid * 11

      // Spine-gutter warm shadow sits on the RIGHT edge (`u -> 1`) of the left page.
      const gutter = Math.exp(-Math.pow((1 - u) / 0.11, 1.45))
      const outerWarm = Math.pow(Math.max(0, 0.15 - u) / 0.15, 2) + Math.pow(Math.max(0, Math.abs(v - 0.5) - 0.41) / 0.09, 2)
      r *= 1 - gutter * 0.19 - outerWarm * 0.038
      g *= 1 - gutter * 0.21 - outerWarm * 0.052
      b *= 1 - gutter * 0.24 - outerWarm * 0.072

      // Subtle hand-ruled inner sepia frame matching the right page.
      const u0 = 0.058, u1 = 0.935, v0 = 0.052, v1 = 0.948
      const wobble = nWash * 0.0028
      const onTB = u >= u0 && u <= u1 ? Math.min(Math.abs(v - v0 + wobble), Math.abs(v - v1 - wobble)) : 1
      const onLR = v >= v0 && v <= v1 ? Math.min(Math.abs(u - u0 + wobble), Math.abs(u - u1 - wobble)) : 1
      const frameD = Math.min(onTB, onLR)
      if (frameD < 0.0052) {
        const frameFade = THREE.MathUtils.smoothstep(1 - u, 0.03, 0.11)
        const a = (1 - THREE.MathUtils.smoothstep(frameD, 0.0018, 0.0048)) * 0.28 * frameFade * (0.85 + nWash * 0.40)
        ;[r, g, b] = glazePigment(r, g, b, 118, 96, 74, a)
      }

      // Upper minimalist hill-line ink & pale watercolor vignette.
      if (v > 0.13 && v < 0.37 && u > 0.15 && u < 0.82) {
        const dBack = closestOnPolyline(u, v, hillBack)
        const dFront = closestOnPolyline(u, v, hillFront)
        if (dBack.signed < 0.09 && dBack.signed > -0.008 && u > 0.18 && u < 0.78) {
          const band = (1 - THREE.MathUtils.smoothstep(dBack.signed, 0.003, 0.082)) * THREE.MathUtils.smoothstep(dBack.signed, -0.007, 0.003)
          const fadeU = THREE.MathUtils.smoothstep(u, 0.18, 0.25) * (1 - THREE.MathUtils.smoothstep(u, 0.70, 0.78))
          ;[r, g, b] = glazePigment(r, g, b, 136, 158, 140, band * fadeU * (0.36 + nWash * 0.12))
        }
        if (dFront.signed < 0.058 && dFront.signed > -0.006 && u > 0.22 && u < 0.74) {
          const band = (1 - THREE.MathUtils.smoothstep(dFront.signed, 0.002, 0.052)) * THREE.MathUtils.smoothstep(dFront.signed, -0.005, 0.002)
          const fadeU = THREE.MathUtils.smoothstep(u, 0.22, 0.28) * (1 - THREE.MathUtils.smoothstep(u, 0.68, 0.74))
          ;[r, g, b] = glazePigment(r, g, b, 178, 146, 108, band * fadeU * (0.30 + nWash * 0.10))
        }
        const lineD = Math.min(dBack.dist, dFront.dist)
        if (lineD < 0.0066) {
          const a = (1 - THREE.MathUtils.smoothstep(lineD, 0.0022, 0.0062)) * 0.50 * (0.86 + nWash * 0.32)
          ;[r, g, b] = glazePigment(r, g, b, 98, 82, 64, a)
        }
      }

      // Quiet horizontal divider beneath vignette.
      if (u > 0.22 && u < 0.76 && Math.abs(v - 0.375) < 0.0044) {
        const fade = THREE.MathUtils.smoothstep(u, 0.22, 0.30) * (1 - THREE.MathUtils.smoothstep(u, 0.68, 0.76))
        const a = (1 - THREE.MathUtils.smoothstep(Math.abs(v - 0.375), 0.0014, 0.0040)) * 0.32 * fade
        ;[r, g, b] = glazePigment(r, g, b, 118, 98, 76, a)
      }

      // Faint warm-sepia ruled field-journal guide lines.
      if (u > 0.14 && u < 0.84) {
        const edgeFade = THREE.MathUtils.smoothstep(u, 0.14, 0.20) * (1 - THREE.MathUtils.smoothstep(u, 0.78, 0.84))
        for (let ri = 0; ri < ruleVs.length; ri++) {
          const dv = Math.abs(v - ruleVs[ri]! + nWash * 0.0012)
          if (dv < 0.0044) {
            const a = (1 - THREE.MathUtils.smoothstep(dv, 0.0014, 0.0040)) * 0.28 * edgeFade
            ;[r, g, b] = glazePigment(r, g, b, 130, 110, 88, a)
          }
        }
      }

      // Soft abstract pencil/ink gesture cadence lines (atmospheric journal notes, zero actual letters).
      for (let ni = 0; ni < noteLines.length; ni++) {
        const nl = noteLines[ni]!
        if (u < nl.uStart || u > nl.uEnd || Math.abs(v - nl.vBase) > 0.016) continue
        const wordGate = THREE.MathUtils.smoothstep(Math.sin(u * 29 + nl.seed * 1.7) + 0.45 * Math.cos(u * 13 + nl.seed), -0.35, 0.05)
        if (wordGate <= 0.01) continue
        const endFade = THREE.MathUtils.smoothstep(u, nl.uStart, nl.uStart + 0.025) * (1 - THREE.MathUtils.smoothstep(u, nl.uEnd - 0.03, nl.uEnd))
        const waveY = nl.vBase + 0.0042 * Math.sin(u * 82 + nl.seed) * Math.cos(u * 21 + nl.seed * 0.5) + 0.0016 * Math.sin(u * 140 + nl.seed * 2)
        const dist = Math.abs(v - waveY)
        if (dist < 0.0054) {
          const a = (1 - THREE.MathUtils.smoothstep(dist, 0.0018, 0.0050)) * 0.44 * wordGate * endFade * (0.84 + nWash * 0.36)
          ;[r, g, b] = glazePigment(r, g, b, 102, 86, 68, a)
        }
      }

      const mult = 1 + nTooth
      const idx = (iy * w + ix) * 4
      data[idx] = THREE.MathUtils.clamp(Math.round(r * mult), 0, 255)
      data[idx + 1] = THREE.MathUtils.clamp(Math.round(g * mult), 0, 255)
      data[idx + 2] = THREE.MathUtils.clamp(Math.round(b * mult), 0, 255)
      data[idx + 3] = 255
    }
  }

  cachedLeftPixels = new Uint8Array(data)
  return data
}

/**
 * Deterministic 256x256 botanical leaf watercolor-and-ink stamp texture for `journal-page-seal`.
 * Painted in matte mineral sage-green with organic watercolor edge pooling, fine central midrib,
 * and curved lateral veins so the interactive tap target reads as ink on paper, not a clay disc.
 */
function buildLeafSealPixels(): Uint8Array<ArrayBuffer> {
  if (cachedSealPixels) return new Uint8Array(cachedSealPixels)
  const size = SEAL_TEX_SIZE
  const data = new Uint8Array(size * size * 4)

  for (let iy = 0; iy < size; iy++) {
    const v = iy / (size - 1)
    const nv = (v - 0.5) / 0.48 // -1..1 across leaf width
    for (let ix = 0; ix < size; ix++) {
      const u = ix / (size - 1)
      const nu = (u - 0.5) / 0.48 // -1 (stem base) .. +1 (leaf tip)

      const radial = Math.hypot(nu, nv)
      const nMacro = fbm2(u * 6.5 + 1.2, v * 6.5 + 3.4, 107) - 0.5
      const nTooth = (hash2(ix, iy, 127) - 0.5) * 0.038

      // Base warm cotton paper peeking subtly through hand-stamped sage watercolor pigment.
      let r = 232 + nMacro * 14
      let g = 220 + nMacro * 13
      let b = 191 + nMacro * 13

      // Watercolor leaf fill with organic pigment pooling toward the stamped edge.
      const edgePool = THREE.MathUtils.smoothstep(radial, 0.56, 0.96)
      const dryVariation = THREE.MathUtils.clamp(0.82 + nMacro * 0.46, 0.58, 1.0)
      const baseAlpha = (0.72 + edgePool * 0.22) * dryVariation
      ;[r, g, b] = glazePigment(r, g, b, 98, 138, 102, baseAlpha)

      // Gentle hand-inked botanical perimeter accent right near radial = 0.86..0.99.
      const rimA = THREE.MathUtils.smoothstep(radial, 0.85, 0.99) * 0.36
      ;[r, g, b] = glazePigment(r, g, b, 62, 90, 66, rimA)

      // Fine central midrib vein (gently tapering from base nu=-0.95 to tip nu=+0.88).
      const midW = THREE.MathUtils.lerp(0.052, 0.018, THREE.MathUtils.clamp((nu + 0.95) / 1.83, 0, 1))
      const onMid = nu > -0.96 && nu < 0.88 ? Math.abs(nv - Math.sin(nu * 2.2) * 0.025) : 1
      const midLift = 1 - THREE.MathUtils.smoothstep(onMid, midW * 0.45, midW * 1.15)

      // Four pairs of curved lateral botanical leaf veins branching toward the tip.
      let latLift = 0
      const roots = [-0.54, -0.18, 0.16, 0.46] as const
      for (let i = 0; i < roots.length; i++) {
        const rootU = roots[i]!
        if (nu < rootU - 0.04 || nu > rootU + 0.52) continue
        const s = THREE.MathUtils.clamp((nu - rootU) / 0.44, 0, 1)
        const targetV = (0.12 + 0.72 * Math.pow(s, 0.78)) * (1 - 0.25 * Math.max(0, rootU))
        const dist = Math.abs(Math.abs(nv) - targetV)
        const fade = THREE.MathUtils.smoothstep(s, 0.0, 0.12) * (1 - THREE.MathUtils.smoothstep(s, 0.75, 1.0))
        const vHit = (1 - THREE.MathUtils.smoothstep(dist, 0.016, 0.040)) * fade
        if (vHit > latLift) latLift = vHit
      }

      // Pale paper-reserve vein highlight.
      const veinHighlight = Math.max(midLift * 0.78, latLift * 0.56)
      if (veinHighlight > 0.001) {
        r = THREE.MathUtils.lerp(r, 218, veinHighlight * 0.70)
        g = THREE.MathUtils.lerp(g, 218, veinHighlight * 0.66)
        b = THREE.MathUtils.lerp(b, 188, veinHighlight * 0.64)
      }

      const mult = 1 + nTooth
      const idx = (iy * size + ix) * 4
      data[idx] = THREE.MathUtils.clamp(Math.round(r * mult), 0, 255)
      data[idx + 1] = THREE.MathUtils.clamp(Math.round(g * mult), 0, 255)
      data[idx + 2] = THREE.MathUtils.clamp(Math.round(b * mult), 0, 255)
      data[idx + 3] = 255
    }
  }

  cachedSealPixels = new Uint8Array(data)
  return data
}

function makePaperDataTexture(pixels: Uint8Array<ArrayBuffer>, width: number, height: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

function bindTextureDispose(material: THREE.Material, texture: THREE.Texture) {
  const release = () => {
    material.removeEventListener('dispose', release)
    texture.dispose()
  }
  material.addEventListener('dispose', release)
}

export type JournalPaperMaterials = {
  rightPageMat: THREE.MeshStandardMaterial
  leftPageMat: THREE.MeshStandardMaterial
  sealMat: THREE.MeshStandardMaterial
  stackLightMat: THREE.MeshStandardMaterial
  stackWarmMat: THREE.MeshStandardMaterial
}

/**
 * Builds the shared ritual-optics paper materials for the journal spread, leaf stamp seal,
 * and 5-layer stacked fore-edge block. Each owned DataTexture is disposed automatically
 * once when its material is disposed via `disposeTree`.
 */
export function createJournalPaperMaterials(): JournalPaperMaterials {
  const rightMap = makePaperDataTexture(buildRightPagePixels(), PAGE_TEX_W, PAGE_TEX_H)
  const rightPageMat = createRitualMaterial({
    color: 0xffffff,
    map: rightMap,
    roughness: 0.96,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.24,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      aspect: RIGHT_W / PAGE_D,
      grainScale: 3.0,
      grain: 0.95,
      fibers: 0.30,
      edge: 0.34,
      highlightGuard: 1.0,
    },
  })
  bindTextureDispose(rightPageMat, rightMap)

  const leftMap = makePaperDataTexture(buildLeftPagePixels(), PAGE_TEX_W, PAGE_TEX_H)
  const leftPageMat = createRitualMaterial({
    color: 0xffffff,
    map: leftMap,
    roughness: 0.96,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.24,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      aspect: LEFT_W / PAGE_D,
      grainScale: 3.0,
      grain: 0.95,
      fibers: 0.30,
      edge: 0.34,
      highlightGuard: 1.0,
    },
  })
  bindTextureDispose(leftPageMat, leftMap)

  const sealMap = makePaperDataTexture(buildLeafSealPixels(), SEAL_TEX_SIZE, SEAL_TEX_SIZE)
  const sealMat = createRitualMaterial({
    color: 0xffffff,
    map: sealMap,
    roughness: 0.96,
  }, {
    kind: 'paper',
    strength: 0.22,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      aspect: 1.35,
      grainScale: 3.4,
      grain: 0.92,
      fibers: 0.26,
      edge: 0.0,
      highlightGuard: 1.0,
    },
  })
  bindTextureDispose(sealMat, sealMap)

  // Preserve the alternating 5-layer fore-edge book stack striations in paper optics without white clipping.
  const stackLightMat = createRitualMaterial({
    color: 0xe9dbc0,
    roughness: 0.96,
  }, {
    kind: 'paper',
    strength: 0.16,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      aspect: 1.0,
      grainScale: 3.6,
      grain: 0.84,
      fibers: 0.18,
      edge: 0.22,
      highlightGuard: 0.95,
    },
  })

  const stackWarmMat = createRitualMaterial({
    color: 0xcab58f,
    roughness: 0.97,
  }, {
    kind: 'paper',
    strength: 0.12,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      aspect: 1.0,
      grainScale: 3.6,
      grain: 0.84,
      fibers: 0.18,
      edge: 0.18,
      highlightGuard: 0.95,
    },
  })

  return { rightPageMat, leftPageMat, sealMat, stackLightMat, stackWarmMat }
}
