import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import { placementHit } from '../placement-hit'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '一篮春食', breadAction: '放入圆面包', eggAction: '安放彩蛋', quietAction: '静看备好的篮子',
  bread: '为波兰圣周六的复活节食物篮做准备，把圆面包拖到篮内衬布上。',
  egg: '把花点彩蛋拖进篮里的小蛋窝，和春枝放在一起，继续备好食物篮。',
  quiet: '食物篮已备好。轻点篮子静看，感谢食粮与准备这一餐的人。',
  returning: '轻点备好的复活节食物篮，感谢日用食粮与准备这一餐的人。',
  placingBread: '圆面包轻轻落在衬布上…', placingEgg: '彩蛋在小窝里安稳落定…',
  done: '复活节食物篮的准备在此告一段落，留一份对食粮与家人的感谢。',
} as const
const BREAD_HOME = new THREE.Vector3(-0.91, 1.035, 0.45)
const BREAD_REST = new THREE.Vector3(0.12, 1.395, 0.05)
const EGG_HOME = new THREE.Vector3(-1.01, 1.035, -0.43)
const EGG_REST = new THREE.Vector3(0.85, 1.45, 0.13)
type Checkpoint = 0 | 1 | 2 | 3
type Placement = { step: 0 | 1; time: number; from: THREE.Vector3 }
const smooth = (t: number) => t * t * (3 - 2 * t)

// Rim-draped linen cloth & Rapier 2D soft-body grid constants (basket-local coordinates).
// Basket double upper rim sits on ellipse (rx=0.77, rz=0.51), tube radius 0.027, top at y=0.460.
// Tabletop top surface is at world y=0.760 -> basket-local y=-0.030.
const CLOTH_A_LEFT = 2.38
const CLOTH_A_RIGHT = 1.54
const FLAP_NX = 48
const FLAP_NY = 28
const FLAP_WRAP_ROWS = 8 // rows 0..8 smoothly wrap from basket interior over the top wicker rim
const FLAP_SKIRT_ROWS = FLAP_NY - FLAP_WRAP_ROWS // rows 8..28 hang down outside the basket wall
const SIM_NU = 11
const SIM_NV = 8 // 88 cloth particles for the free hanging linen skirt carrier
const FLAP_DROP = 0.365
const RIM_CX = 0.77
const RIM_CZ = 0.51
const RIM_CY = 0.426
const RIM_WRAP_RXZ = 0.043
const RIM_WRAP_RY = 0.046
const EMBROIDERY_US = [0.145, 0.225] as const
const EMBROIDERY_SEGS = 44
const EMBROIDERY_RADIAL = 8
const EMBROIDERY_RADIUS = 0.0052
const EMBROIDERY_OFFSET = 0.0030
const LINING_RINGS = 16
const LINING_COLS = 64

// Authored asymmetric vertical linen pleat valleys: [uCenter, halfWidth, depth, gravitySplay].
// Produces four softly sculpted, hand-draped vertical folds across the front apron without
// regular machine-corrugated symmetry or flat panel collapse.
const LINEN_PLEAT_VALLEYS: readonly (readonly [number, number, number, number])[] = [
  [0.065, 0.056, 0.011, -0.020],
  [0.320, 0.068, 0.026, -0.014],
  [0.575, 0.072, 0.029, 0.010],
  [0.820, 0.064, 0.024, 0.024],
] as const

// Complementary soft convex linen ridges between valleys: [uCenter, halfWidth, swell, gravitySplay].
const LINEN_PLEAT_RIDGES: readonly (readonly [number, number, number, number])[] = [
  [0.185, 0.095, 0.013, -0.018],
  [0.448, 0.088, 0.017, -0.003],
  [0.700, 0.088, 0.018, 0.016],
  [0.925, 0.072, 0.012, 0.026],
] as const

function linenHash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return x - Math.floor(x)
}

let cachedFlapLinenPixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null
let cachedLiningLinenPixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null
let cachedEmbroideryPixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null

/**
 * Deterministic woven plain-linen texture for the front flap (512x512).
 * Replaces coarse object-space waffle dots with fine 1/1 linen yarn interlacing,
 * subtle per-thread flax slub irregularity, a neat folded bottom hem with faint
 * running-stitch detail, and tidy hemmed side selvedges.
 */
function createFlapLinenTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 512
  if (!cachedFlapLinenPixels) {
    const colorData = new Uint8Array(size * size * 4)
    const bumpData = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const threads = 128
    const warpTone = new Float32Array(threads)
    const weftTone = new Float32Array(threads)
    for (let t = 0; t < threads; t++) {
      warpTone[t] = (linenHash(t * 3 + 5) - 0.5) * 4.2 + (linenHash(t * 11 + 17) > 0.88 ? 2.6 : 0)
      weftTone[t] = (linenHash(t * 7 + 29) - 0.5) * 4.2 + (linenHash(t * 13 + 43) > 0.88 ? 2.8 : 0)
    }
    for (let y = 0; y < size; y++) {
      // Flap UVs map v = 0 at the bottom hem, v = 1 at the basket-interior tuck.
      const v = y / (size - 1)
      const weftPos = (y / size) * threads
      const weftIdx = Math.floor(weftPos) % threads
      const weftProfile = Math.sin((weftPos % 1) * tau)
      const weftSlub = weftTone[weftIdx]!

      // Folded bottom hem band (v in [0, 0.055]) with crisp topstitched seam line at v = 0.058.
      const hemShadow = Math.exp(-(((v - 0.058) / 0.0085) ** 2))
      const hemEdgeRoll = Math.exp(-(((v - 0.006) / 0.012) ** 2))
      const hemBandTint = (1 - THREE.MathUtils.smoothstep(v, 0.048, 0.064)) * 3.5

      for (let x = 0; x < size; x++) {
        const u = x / (size - 1)
        const warpPos = (x / size) * threads
        const warpIdx = Math.floor(warpPos) % threads
        const warpProfile = Math.sin((warpPos % 1) * tau)
        const warpSlub = warpTone[warpIdx]!

        const overWarp = ((warpIdx + weftIdx) & 1) === 0
        const yarnHeight = overWarp
          ? warpProfile * 0.65 + weftProfile * 0.18 + warpSlub * 0.12
          : weftProfile * 0.65 + warpProfile * 0.18 + weftSlub * 0.12
        const weave = yarnHeight * 4.0 + (warpSlub + weftSlub) * 0.45

        // Delicate pale running-stitch line along the folded bottom hem and tidy side hems.
        const hemDash = THREE.MathUtils.smoothstep(Math.sin(u * tau * 34), 0.20, 0.62)
        const bottomStitch = Math.exp(-(((v - 0.058) / 0.0024) ** 2)) * hemDash
        const leftSelvedge = Math.exp(-(((u - 0.028) / 0.0075) ** 2))
        const rightSelvedge = Math.exp(-(((u - 0.972) / 0.0075) ** 2))
        const sideDash = THREE.MathUtils.smoothstep(Math.sin(v * tau * 32), 0.25, 0.65)
        const sideStitch = (Math.exp(-(((u - 0.028) / 0.0022) ** 2)) + Math.exp(-(((u - 0.972) / 0.0022) ** 2))) * sideDash * 0.7
        const stitchMask = Math.min(1, bottomStitch + sideStitch)

        const seamDip = hemShadow * 11.5 + hemEdgeRoll * 8.0 + (leftSelvedge + rightSelvedge) * 7.5 + hemBandTint
        const baseR = THREE.MathUtils.clamp(249 + weave - seamDip * 0.90, 212, 255)
        const baseG = THREE.MathUtils.clamp(246 + weave * 0.95 - seamDip * 0.95, 206, 255)
        const baseB = THREE.MathUtils.clamp(237 + weave * 0.88 - seamDip * 1.05, 194, 252)

        const r = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseR, 255, stitchMask * 0.72)), 210, 255)
        const g = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseG, 252, stitchMask * 0.72)), 204, 255)
        const b = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseB, 240, stitchMask * 0.68)), 192, 252)

        const idx = (y * size + x) * 4
        colorData[idx] = r; colorData[idx + 1] = g; colorData[idx + 2] = b; colorData[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + yarnHeight * 32 + (warpSlub + weftSlub) * 1.8 - hemShadow * 28 - (leftSelvedge + rightSelvedge) * 18 + stitchMask * 34),
          32,
          232,
        )
        bumpData[idx] = h; bumpData[idx + 1] = h; bumpData[idx + 2] = h; bumpData[idx + 3] = 255
      }
    }
    cachedFlapLinenPixels = { color: colorData, bump: bumpData, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedFlapLinenPixels.color), size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedFlapLinenPixels.bump), size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = bump.wrapT = THREE.ClampToEdgeWrapping
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/** Tileable plain-linen weave texture for the inner basket lining (no hem band). */
function createLiningLinenTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 256
  if (!cachedLiningLinenPixels) {
    const colorData = new Uint8Array(size * size * 4)
    const bumpData = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const threads = 64
    const warpTone = new Float32Array(threads)
    const weftTone = new Float32Array(threads)
    for (let t = 0; t < threads; t++) {
      warpTone[t] = (linenHash(t * 5 + 3) - 0.5) * 4.0
      weftTone[t] = (linenHash(t * 9 + 21) - 0.5) * 4.0
    }
    for (let y = 0; y < size; y++) {
      const weftPos = (y / size) * threads
      const weftIdx = Math.floor(weftPos) % threads
      const weftProfile = Math.sin((weftPos % 1) * tau)
      const weftSlub = weftTone[weftIdx]!
      for (let x = 0; x < size; x++) {
        const warpPos = (x / size) * threads
        const warpIdx = Math.floor(warpPos) % threads
        const warpProfile = Math.sin((warpPos % 1) * tau)
        const warpSlub = warpTone[warpIdx]!
        const overWarp = ((warpIdx + weftIdx) & 1) === 0
        const yarnHeight = overWarp
          ? warpProfile * 0.65 + weftProfile * 0.18 + warpSlub * 0.12
          : weftProfile * 0.65 + warpProfile * 0.18 + weftSlub * 0.12
        const weave = yarnHeight * 4.0 + (warpSlub + weftSlub) * 0.45
        const idx = (y * size + x) * 4
        colorData[idx] = THREE.MathUtils.clamp(Math.round(248 + weave), 220, 255)
        colorData[idx + 1] = THREE.MathUtils.clamp(Math.round(245 + weave * 0.95), 216, 255)
        colorData[idx + 2] = THREE.MathUtils.clamp(Math.round(236 + weave * 0.88), 208, 252)
        colorData[idx + 3] = 255
        const h = THREE.MathUtils.clamp(Math.round(128 + yarnHeight * 30), 48, 212)
        bumpData[idx] = h; bumpData[idx + 1] = h; bumpData[idx + 2] = h; bumpData[idx + 3] = 255
      }
    }
    cachedLiningLinenPixels = { color: colorData, bump: bumpData, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedLiningLinenPixels.color), size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(2, 2)
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedLiningLinenPixels.bump), size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.repeat.set(2, 2)
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/** Deterministic twisted embroidery thread texture for the two coral-red linen stripes. */
function createEmbroideryThreadTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  if (!cachedEmbroideryPixels) {
    const colorData = new Uint8Array(size * size * 4)
    const bumpData = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const twist = Math.sin((u * 18 + v * 2) * tau)
        const subPly = Math.sin((u * 36 + v * 4) * tau) * 0.25
        const shade = (twist * 0.75 + subPly) * 16
        const idx = (y * size + x) * 4
        colorData[idx] = THREE.MathUtils.clamp(Math.round(244 + shade * 0.85), 196, 255)
        colorData[idx + 1] = THREE.MathUtils.clamp(Math.round(238 + shade * 0.95), 186, 252)
        colorData[idx + 2] = THREE.MathUtils.clamp(Math.round(236 + shade * 0.95), 184, 250)
        colorData[idx + 3] = 255
        const h = THREE.MathUtils.clamp(Math.round(128 + (twist * 0.78 + subPly) * 56), 28, 234)
        bumpData[idx] = h; bumpData[idx + 1] = h; bumpData[idx + 2] = h; bumpData[idx + 3] = 255
      }
    }
    cachedEmbroideryPixels = { color: colorData, bump: bumpData, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedEmbroideryPixels.color), size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(3, 1)
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedEmbroideryPixels.bump), size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.repeat.set(3, 1)
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/**
 * Evaluates the authored vertical linen pleat relief at cloth coordinates (u in [0,1], d in [0,1]).
 * Returns outward normal offset, tangential gather offset, hem Y undulation, and normalized
 * valley crease intensity [0,1] for restrained anime-cel fold-valley warmth.
 */
function evalPleatRelief(u: number, d: number) {
  const dRamp = 0.30 + 0.70 * Math.pow(d, 0.82)
  const troughRamp = THREE.MathUtils.smoothstep(d, 0.02, 0.24)
  const hemRamp = Math.pow(d, 1.35)

  let valleyDip = 0
  let ridgeSwell = 0
  let gatherTan = 0
  for (const [uc, hw, depth, splay] of LINEN_PLEAT_VALLEYS) {
    const du = u - (uc + splay * d)
    const norm = du / hw
    const g = Math.exp(-norm * norm)
    // Sharper pinched linen fold trough with gentle tangential fabric gather toward each crease.
    valleyDip += depth * Math.pow(g, 1.35)
    gatherTan += -du * 0.095 * g * dRamp
  }
  for (const [uc, hw, swell, splay] of LINEN_PLEAT_RIDGES) {
    const du = u - (uc + splay * d)
    const norm = du / hw
    const g = Math.exp(-norm * norm)
    ridgeSwell += swell * g
  }

  // Soft inward curl at the far-left and far-right linen edges so borders feel naturally draped.
  const leftTurn = Math.exp(-((u / 0.055) ** 2)) * 0.0085 * dRamp
  const rightTurn = Math.exp(-(((1 - u) / 0.055) ** 2)) * 0.0085 * dRamp

  // Near the wicker rim crest (small d), ridges bow gently outward while troughs stay clear of the rim;
  // below the rim lip, as the oval basket wall tapers inward, valleys carve full shadowed depth.
  const normalOffset = ridgeSwell * dRamp - valleyDip * (0.16 + 0.84 * troughRamp) - (leftTurn + rightTurn) * troughRamp
  const hemWaveY = (ridgeSwell * 0.58 - valleyDip * 0.42) * hemRamp
  const valleyShade = THREE.MathUtils.clamp((valleyDip / 0.029) * (0.34 + 0.66 * troughRamp), 0, 1)
  return { normalOffset, gatherTan, hemWaveY, valleyShade }
}

function catmullRomWeights(t: number): [number, number, number, number] {
  const t2 = t * t, t3 = t2 * t
  return [
    0.5 * (-t + 2 * t2 - t3),
    0.5 * (2 - 5 * t2 + 3 * t3),
    0.5 * (t + 4 * t2 - 3 * t3),
    0.5 * (-t2 + t3),
  ]
}

interface InterpRow {
  i0: number; i1: number; i2: number; i3: number
  w0: number; w1: number; w2: number; w3: number
}

function buildInterpTable(samples: number, simCount: number): InterpRow[] {
  const table: InterpRow[] = []
  for (let idx = 0; idx <= samples; idx++) {
    const f = THREE.MathUtils.clamp(idx / samples, 0, 1) * (simCount - 1)
    const i1 = Math.min(simCount - 2, Math.floor(f))
    const [w0, w1, w2, w3] = catmullRomWeights(f - i1)
    table.push({
      i0: Math.max(0, i1 - 1),
      i1,
      i2: i1 + 1,
      i3: Math.min(simCount - 1, i1 + 2),
      w0, w1, w2, w3,
    })
  }
  return table
}

const FLAP_U_TABLE = buildInterpTable(FLAP_NX, SIM_NU)
const FLAP_V_TABLE = buildInterpTable(FLAP_SKIRT_ROWS, SIM_NV)

function sampleSimCloth(
  pos: Float32Array,
  uRow: InterpRow,
  vRow: InterpRow,
  out: THREE.Vector3,
): THREE.Vector3 {
  const sampleAxis = (axis: 0 | 1 | 2) => {
    const row = (j: number) =>
      pos[(uRow.i0 * SIM_NV + j) * 3 + axis]! * uRow.w0 +
      pos[(uRow.i1 * SIM_NV + j) * 3 + axis]! * uRow.w1 +
      pos[(uRow.i2 * SIM_NV + j) * 3 + axis]! * uRow.w2 +
      pos[(uRow.i3 * SIM_NV + j) * 3 + axis]! * uRow.w3
    return (
      row(vRow.i0) * vRow.w0 +
      row(vRow.i1) * vRow.w1 +
      row(vRow.i2) * vRow.w2 +
      row(vRow.i3) * vRow.w3
    )
  }
  return out.set(sampleAxis(0), sampleAxis(1), sampleAxis(2))
}

/** Evaluates basket-local rim center (cx, cy, cz) and outward XZ unit normal (nx, nz) at cloth parameter u in [0,1]. */
function rimFrame(u: number) {
  const a = THREE.MathUtils.lerp(CLOTH_A_LEFT, CLOTH_A_RIGHT, u)
  const ca = Math.cos(a), sa = Math.sin(a)
  const cx = RIM_CX * ca
  const cz = RIM_CZ * sa
  const rawNx = ca / RIM_CX
  const rawNz = sa / RIM_CZ
  const invLen = 1 / Math.hypot(rawNx, rawNz)
  return { a, cx, cz, nx: rawNx * invLen, nz: rawNz * invLen }
}

/** Smooth analytical wrap over the double wicker rim for wrapFrac in [0, 1] (0=inside rim, 0.5=crest, 1=outer tangent). */
function evalRimWrapPoint(u: number, wrapFrac: number, out: THREE.Vector3): THREE.Vector3 {
  const { cx, cz, nx, nz } = rimFrame(u)
  const tx = nz, tz = -nx
  const theta = wrapFrac * Math.PI
  const pleatAtRim = evalPleatRelief(u, 0)
  // Smoothly blend in the rim-top gathering so the vertical folds begin organically over the wicker crest.
  const rimBlend = Math.pow(THREE.MathUtils.smoothstep(wrapFrac, 0.28, 1.0), 1.15)
  const radial = -Math.cos(theta) * (RIM_WRAP_RXZ + Math.max(0, pleatAtRim.normalOffset) * 0.85 * rimBlend)
    + pleatAtRim.normalOffset * Math.pow(wrapFrac, 3.0)
  // Slightly tuck the inner start (theta=0) downward toward the lining so there is no gap inside the basket.
  const innerTuck = Math.pow(Math.max(0, 1 - wrapFrac * 2.5), 2) * 0.022
  const y = RIM_CY + Math.sin(theta) * (RIM_WRAP_RY + Math.max(0, pleatAtRim.normalOffset) * 0.45 * rimBlend) - innerTuck
  const tanShift = pleatAtRim.gatherTan * rimBlend
  return out.set(cx + nx * radial + tx * tanShift, y, cz + nz * radial + tz * tanShift)
}

/** Smooth carrier rim anchor (without fine pleat offsets) for the 11x8 Rapier soft-body top row. */
function evalCarrierRimAnchor(u: number, out: THREE.Vector3): THREE.Vector3 {
  const { cx, cz, nx, nz } = rimFrame(u)
  return out.set(cx + nx * RIM_WRAP_RXZ, RIM_CY, cz + nz * RIM_WRAP_RXZ)
}

/** Keeps any basket-local cloth point safely outside the tapered oval wicker basket wall and above the tabletop. */
function clampOutsideBasketWall(p: THREE.Vector3): void {
  if (p.y < -0.006) p.y = -0.006
  if (p.y < 0.455) {
    const h = THREE.MathUtils.clamp((p.y - 0.035) / 0.38, 0, 1)
    const rimBoost = THREE.MathUtils.smoothstep(p.y, 0.355, 0.425) * 0.015
    const rx = 0.58 + h * 0.18 + 0.034 + rimBoost
    const rz = 0.33 + h * 0.17 + 0.034 + rimBoost
    const e = Math.hypot(p.x / rx, p.z / rz)
    if (e < 1 && e > 1e-5) {
      const inv = 1 / e
      p.x *= inv
      p.z *= inv
    }
  }
}

/**
 * Smooth macro hanging linen carrier (u in [0,1], d in [0,1]) used as the equilibrium target for
 * the 11x8 Rapier cloth so planar spring rest lengths drive live gravity/impact/breeze motion
 * without ironing out the vertical pleats layered onto its surface frame.
 */
function evalCarrierSkirtPoint(u: number, d: number, out: THREE.Vector3): THREE.Vector3 {
  const { cx, cz, nx, nz } = rimFrame(u)
  const tx = nz, tz = -nx
  const d11 = Math.pow(d, 1.12)
  const d17 = Math.pow(d, 1.7)
  const edgeSoft = Math.sin(u * Math.PI)
  const dropLen = FLAP_DROP * (0.945 + 0.055 * Math.pow(edgeSoft, 0.45))
  // Gentle natural linen drape: hangs cleanly just clear of the tapered oval basket wall so
  // vertical pleat troughs carve shadowed depth without getting squashed against the wicker.
  const wallEase = 0.014 * THREE.MathUtils.smoothstep(d, 0.05, 0.32)
  const taperIn = -0.022 * d11
  const naturalHangOut = 0.008 * d17 * (0.7 + 0.3 * u)
  const gatherTan = -(u - 0.5) * 0.024 * d11
  const radial = RIM_WRAP_RXZ + wallEase + taperIn + naturalHangOut
  out.set(
    cx + nx * radial + tx * gatherTan,
    RIM_CY - d * dropLen,
    cz + nz * radial + tz * gatherTan,
  )
  clampOutsideBasketWall(out)
  return out
}

/** Calm zero-WASM equilibrium drape combining the macro hanging carrier + sculpted vertical linen pleats. */
function evalCalmSkirtPoint(u: number, d: number, out: THREE.Vector3): THREE.Vector3 {
  const { nx, nz } = rimFrame(u)
  const tx = nz, tz = -nx
  evalCarrierSkirtPoint(u, d, out)
  const pleat = evalPleatRelief(u, d)
  out.x += nx * pleat.normalOffset + tx * pleat.gatherTan
  out.y += pleat.hemWaveY
  out.z += nz * pleat.normalOffset + tz * pleat.gatherTan
  clampOutsideBasketWall(out)
  if (out.x > 0.08) out.x = 0.08
  return out
}

/** Pre-allocated closed-cap dynamic tube updated in-place for surface-bound coral-red linen embroidery stripes. */
function createDynamicStripeTube(
  segments: number,
  radial: number,
  radius: number,
  material: THREE.Material,
  name: string,
  parent: THREE.Object3D,
) {
  const ringVerts = radial + 1
  const bodyVerts = (segments + 1) * ringVerts
  const vertCount = bodyVerts + 2
  const positions = new Float32Array(vertCount * 3)
  const uvs = new Float32Array(vertCount * 2)
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j <= radial; j++) {
      const k = i * ringVerts + j
      uvs[k * 2] = i / segments
      uvs[k * 2 + 1] = j / radial
      if (i < segments && j < radial) {
        const a = i * ringVerts + j
        const b = a + 1
        const c = (i + 1) * ringVerts + j
        const d = c + 1
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  const startCap = bodyVerts, endCap = bodyVerts + 1, endBase = segments * ringVerts
  for (let j = 0; j < radial; j++) {
    indices.push(startCap, j + 1, j)
    indices.push(endCap, endBase + j, endBase + j + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = mesh.receiveShadow = true
  mesh.userData.toonSurface = { outline: false }
  parent.add(mesh)

  const cosT = new Float32Array(ringVerts)
  const sinT = new Float32Array(ringVerts)
  for (let j = 0; j <= radial; j++) {
    const a = (j / radial) * Math.PI * 2
    cosT[j] = Math.cos(a)
    sinT[j] = Math.sin(a)
  }
  const tan = new THREE.Vector3(), prevTan = new THREE.Vector3()
  const norm = new THREE.Vector3(), binorm = new THREE.Vector3()
  const rotAxis = new THREE.Vector3(), rotQuat = new THREE.Quaternion()
  const refX = new THREE.Vector3(1, 0, 0), refZ = new THREE.Vector3(0, 0, 1)

  function update(pts: readonly THREE.Vector3[]) {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const nPts = pts.length
    for (let i = 0; i < nPts; i++) {
      const prev = pts[Math.max(0, i - 1)]!
      const next = pts[Math.min(nPts - 1, i + 1)]!
      tan.subVectors(next, prev)
      if (tan.lengthSq() < 1e-12) tan.set(0, -1, 0)
      else tan.normalize()
      if (i === 0) {
        const ref = Math.abs(tan.dot(refX)) < 0.85 ? refX : refZ
        norm.crossVectors(tan, ref).normalize()
        binorm.crossVectors(tan, norm).normalize()
        prevTan.copy(tan)
      } else {
        rotAxis.crossVectors(prevTan, tan)
        const sinA = rotAxis.length()
        if (sinA > 1e-6) {
          rotAxis.divideScalar(sinA)
          const cosA = THREE.MathUtils.clamp(prevTan.dot(tan), -1, 1)
          rotQuat.setFromAxisAngle(rotAxis, Math.atan2(sinA, cosA))
          norm.applyQuaternion(rotQuat)
        }
        norm.addScaledVector(tan, -norm.dot(tan)).normalize()
        binorm.crossVectors(tan, norm).normalize()
        prevTan.copy(tan)
      }
      const c = pts[i]!
      const row = i * ringVerts
      // Gently taper thread ends into the cloth weave at both ends.
      const endTaper = i === 0 || i === nPts - 1 ? 0.55 : 1.0
      const r = radius * endTaper
      for (let j = 0; j <= radial; j++) {
        const ca = cosT[j]!, sa = sinT[j]!
        posAttr.setXYZ(
          row + j,
          c.x + r * (norm.x * ca + binorm.x * sa),
          c.y + r * (norm.y * ca + binorm.y * sa),
          c.z + r * (norm.z * ca + binorm.z * sa),
        )
      }
    }
    const p0 = pts[0]!, pEnd = pts[nPts - 1]!
    posAttr.setXYZ(startCap, p0.x, p0.y, p0.z)
    posAttr.setXYZ(endCap, pEnd.x, pEnd.y, pEnd.z)
    posAttr.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }

  return { mesh, update }
}

function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material, closed = false) {
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), Math.max(20, points.length * 2), radius, 6, closed)
  const mesh = new THREE.Mesh(geometry, mat)
  mesh.castShadow = mesh.receiveShadow = true; mesh.userData.toonSurface = { outline: false }
  return mesh
}

/** An original domestic still life; no priest, blessing action or sacramental imitation. */
export function createPolishBlessingBasket(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0
  let placement: Placement | null = null, dragging = false, maxTravel = 0, inactiveRendered = false
  let writer: GestureHandle | null = null, stopResize = () => {}
  const returning = ctx.returning === true
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.breadAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'polish-blessing-basket', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff3de, ground: 0xbfb59b, key: 0xffe6c6, rim: 0xd8e9d7,
    keyPosition: [-3, 5, 3], keyIntensity: 1.25, rimIntensity: 0.45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 0.1, far: 12 })
  lights.key.shadow.bias = -0.0007; lights.key.shadow.normalBias = 0.025
  const world = new THREE.Group(); world.name = 'polish-basket-world'; scene.add(world)
  const material = (color: number, side: THREE.Side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ color, roughness: 0.93, side })
  const oak = material(0xc7a57e), oakEdge = material(0xa98761), boardMat = material(0xe3c59b)
  const wicker = [0xc79561, 0xd8b27c, 0xe2c293].map(color => material(color))
  const cream = material(0xf4edd7, THREE.DoubleSide), stitch = material(0xc48174)
  const flapLinenTex = createFlapLinenTextures()
  const liningLinenTex = createLiningLinenTextures()
  const embroideryTex = createEmbroideryThreadTextures()
  const clothMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8f3e4,
    roughness: 0.92,
    side: THREE.DoubleSide,
    map: flapLinenTex.map,
    bumpMap: flapLinenTex.bump,
    bumpScale: 0.0022,
    vertexColors: true,
  })
  const liningMaterial = new THREE.MeshStandardMaterial({
    color: 0xf6f0de,
    roughness: 0.93,
    side: THREE.DoubleSide,
    map: liningLinenTex.map,
    bumpMap: liningLinenTex.bump,
    bumpScale: 0.0018,
  })
  const embroidery = new THREE.MeshStandardMaterial({
    color: 0xc48174,
    roughness: 0.90,
    map: embroideryTex.map,
    bumpMap: embroideryTex.bump,
    bumpScale: 0.0026,
  })
  for(const timber of[oak,oakEdge,boardMat])applyCraftSurface(timber,{kind:'wood',strength:.4})
  const crust = material(0xc79558), breadCut = material(0xf2d49b), sage = material(0x849f72), darkLeaf = material(0x627f59)
  const eggRose = material(0xc98173), eggCream = material(0xfaedce), eggBlue = material(0x91aeb7)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const sphere = new THREE.SphereGeometry(1, 24, 16)
  const pebble = (p: [number, number, number], scale: [number, number, number], mat: THREE.Material, parent: THREE.Object3D) => {
    const mesh = add(sphere, mat, p, parent); mesh.scale.set(...scale); return mesh
  }
  const table = new THREE.Group(); table.name = 'basket-table'; world.add(table)
  for (let i = 0; i < 5; i++) add(new RoundedBoxGeometry(3.05, 0.13, 0.31, 3, 0.035), i % 2 ? oak : boardMat, [0, 0.695, (i - 2) * 0.302], table)
  for (const x of [-1.16, 1.16]) for (const z of [-0.5, 0.5]) {
    add(new RoundedBoxGeometry(0.15, 0.63, 0.15, 2, 0.025), oakEdge, [x, 0.315, z], table)
  }
  for (const z of [-0.52, 0.52]) add(new RoundedBoxGeometry(2.5, 0.19, 0.10, 2, 0.018), oakEdge, [0, 0.57, z], table)
  const shadow = add(new THREE.PlaneGeometry(3.8, 2.25), new THREE.ShadowMaterial({ opacity: 0.13 }), [0, 0.005, 0])
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false

  const board = add(new RoundedBoxGeometry(0.94, 0.045, 0.74, 4, 0.09), oak, [-0.91, 0.79, 0.43]); board.name = 'basket-bread-board'
  add(new RoundedBoxGeometry(0.24, 0.035, 0.20, 3, 0.05), oak, [-1.41, 0.79, 0.43])
  const saucer = add(new THREE.CylinderGeometry(0.255, 0.24, 0.035, 32), cream, [-1.01, 0.795, -0.43]); saucer.name = 'basket-egg-saucer'

  const basket = new THREE.Group(); basket.name = 'basket-woven'; basket.position.set(0.45, 0.79, -0.02); world.add(basket)
  const weave = new THREE.Group(); weave.name = 'basket-weave'; basket.add(weave)
  // Alternating willow strands follow an oval, slightly flared basket wall.
  for (let row = 0; row < 12; row++) {
    const h = row / 11, rx = 0.58 + h * 0.18, rz = 0.33 + h * 0.17
    const points = Array.from({ length: 80 }, (_, i) => {
      const a = i / 80 * Math.PI * 2, over = Math.cos(a * 32 + row * Math.PI) * 0.007
      return new THREE.Vector3(Math.cos(a) * (rx + over), 0.035 + h * 0.38, Math.sin(a) * (rz + over))
    })
    weave.add(tube(points, 0.017, wicker[row % 3], true))
  }
  for (let col = 0; col < 32; col++) {
    const a = col / 32 * Math.PI * 2
    const points = Array.from({ length: 17 }, (_, i) => {
      const h = i / 16, over = Math.cos(h * 11 * Math.PI + col * Math.PI) * 0.009
      return new THREE.Vector3(Math.cos(a) * (0.58 + h * 0.18 + over), 0.025 + h * 0.40, Math.sin(a) * (0.33 + h * 0.17 + over))
    })
    weave.add(tube(points, 0.016, wicker[(col + 1) % 3]))
  }
  const bottom = add(new THREE.CylinderGeometry(0.58, 0.56, 0.045, 48), wicker[0], [0, 0.025, 0], basket); bottom.scale.z = 0.58
  for (const y of [0.405, 0.433]) {
    const points = Array.from({ length: 80 }, (_, i) => { const a = i / 80 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 0.77, y, Math.sin(a) * 0.51) })
    basket.add(tube(points, 0.027, wicker[1], true))
  }
  const handle = new THREE.Group(); handle.name = 'basket-handle'; basket.add(handle)
  for (const offset of [-0.023, 0.023]) {
    const points = Array.from({ length: 41 }, (_, i) => {
      const a = i / 40 * Math.PI
      return new THREE.Vector3(Math.cos(a) * (0.74 + offset), 0.30 + Math.sin(a) * 1.18, -0.15 + offset)
    })
    handle.add(tube(points, 0.028, wicker[offset < 0 ? 0 : 2]))
  }
  for (const sign of [-1, 1]) for (let i = 0; i < 5; i++) {
    const tie = add(new THREE.TorusGeometry(0.05, 0.008, 6, 16), wicker[0], [sign * 0.72, 0.35 + i * 0.022, -0.15], handle)
    tie.rotation.x = Math.PI / 2
  }

  const cloth = new THREE.Group(); cloth.name = 'basket-cloth'; basket.add(cloth)

  // 1. Responsive inner linen lining with proper UVs and subtle weight yield under placed bread & egg.
  const liningVertCount = (LINING_RINGS + 1) * (LINING_COLS + 1)
  const liningPositions = new Float32Array(liningVertCount * 3)
  const liningUvs = new Float32Array(liningVertCount * 2)
  const liningIndices: number[] = []
  for (let row = 0; row <= LINING_RINGS; row++) {
    const r = row / LINING_RINGS
    for (let col = 0; col <= LINING_COLS; col++) {
      const a = (col / LINING_COLS) * Math.PI * 2
      const idx = row * (LINING_COLS + 1) + col
      liningUvs[idx * 2] = 0.5 + 0.5 * r * Math.cos(a)
      liningUvs[idx * 2 + 1] = 0.5 + 0.5 * r * Math.sin(a)
      if (row < LINING_RINGS && col < LINING_COLS) {
        liningIndices.push(idx, idx + LINING_COLS + 1, idx + 1, idx + 1, idx + LINING_COLS + 1, idx + LINING_COLS + 2)
      }
    }
  }
  const clothGeo = new THREE.BufferGeometry()
  clothGeo.setAttribute('position', new THREE.Float32BufferAttribute(liningPositions, 3))
  clothGeo.setAttribute('uv', new THREE.Float32BufferAttribute(liningUvs, 2))
  clothGeo.setIndex(liningIndices)
  const clothLiningMesh = add(clothGeo, liningMaterial, [0, 0, 0], cloth)
  clothLiningMesh.name = 'basket-cloth-lining'

  let breadWeight = 0
  let eggWeight = 0
  let liningImpactTime = 0
  let liningImpactStrength = 0
  function updateInnerLining() {
    const posAttr = clothGeo.getAttribute('position') as THREE.BufferAttribute
    const impactWave = liningImpactStrength > 1e-4
      ? liningImpactStrength * Math.exp(-liningImpactTime * 4.5) * Math.sin(liningImpactTime * 19)
      : 0
    for (let row = 0; row <= LINING_RINGS; row++) {
      const r = row / LINING_RINGS
      for (let col = 0; col <= LINING_COLS; col++) {
        const a = (col / LINING_COLS) * Math.PI * 2
        const x = Math.cos(a) * 0.728 * r
        const z = Math.sin(a) * 0.473 * r
        // Soft natural radial linen gathers radiating up the basket wall; strictly below breadRest (0.375) and eggNest (0.405).
        const gathers = (Math.sin(a * 9 + 0.4) * 0.013 + Math.cos(a * 15 - 0.8) * 0.0055) * r * (0.45 + 0.55 * r)
        // Localized soft depression directly under the round bread (-0.33, 0.07) and egg nest (0.40, 0.15).
        const dBreadSq = (x + 0.33) * (x + 0.33) / 0.14 + (z - 0.07) * (z - 0.07) / 0.12
        const dEggSq = (x - 0.40) * (x - 0.40) / 0.09 + (z - 0.15) * (z - 0.15) / 0.08
        const breadDip = -0.020 * breadWeight * Math.exp(-dBreadSq) * (1 - r * r * 0.65)
        const eggDip = -0.012 * eggWeight * Math.exp(-dEggSq) * (1 - r * r * 0.65)
        const ripple = impactWave * Math.sin(r * 6.5 - liningImpactTime * 11) * (1 - r) * 0.008
        const y = 0.285 + 0.152 * r * r * r + gathers + breadDip + eggDip + ripple
        posAttr.setXYZ(row * (LINING_COLS + 1) + col, x, y, z)
      }
    }
    posAttr.needsUpdate = true
    clothGeo.computeVertexNormals()
    clothGeo.computeBoundingBox()
    clothGeo.computeBoundingSphere()
  }

  // 2. Continuous rim-wrapping linen overhang cloth (wrap over curved wicker rim + Rapier 2D hanging carrier + sculpted pleats).
  const flapCols = FLAP_NX + 1
  const flapRows = FLAP_NY + 1
  const flapPositions = new Float32Array(flapCols * flapRows * 3)
  const flapColors = new Float32Array(flapCols * flapRows * 3)
  const flapUvs = new Float32Array(flapCols * flapRows * 2)
  const flapIndices: number[] = []
  for (let j = 0; j <= FLAP_NY; j++) {
    const v = j / FLAP_NY
    const isWrap = j <= FLAP_WRAP_ROWS
    const wrapFrac = isWrap ? j / FLAP_WRAP_ROWS : 1
    const d = isWrap ? 0 : (j - FLAP_WRAP_ROWS) / FLAP_SKIRT_ROWS
    for (let i = 0; i <= FLAP_NX; i++) {
      const u = i / FLAP_NX
      const idx = j * flapCols + i
      flapUvs[idx * 2] = u
      flapUvs[idx * 2 + 1] = 1 - v
      const pleat = evalPleatRelief(u, d)
      const valley = isWrap ? pleat.valleyShade * Math.pow(wrapFrac, 1.6) : pleat.valleyShade
      const innerTuckShade = isWrap ? Math.pow(1 - wrapFrac, 1.8) * 0.045 : 0
      // Restrained warm-linen crevice shading inside deepest vertical fold troughs; crests stay clean crisp cream-white.
      flapColors[idx * 3] = 1 - valley * 0.078 - innerTuckShade * 0.85
      flapColors[idx * 3 + 1] = 1 - valley * 0.098 - innerTuckShade * 0.95
      flapColors[idx * 3 + 2] = 1 - valley * 0.132 - innerTuckShade * 1.05
      if (i < FLAP_NX && j < FLAP_NY) {
        const a = idx
        const b = a + 1
        const c = a + flapCols
        const dIdx = c + 1
        // Outward winding: (+v downward) x (+u rightward) = +Z outward / +Y upward over rim crest.
        flapIndices.push(a, c, b, b, c, dIdx)
      }
    }
  }
  const flapGeo = new THREE.BufferGeometry()
  flapGeo.setAttribute('position', new THREE.Float32BufferAttribute(flapPositions, 3))
  flapGeo.setAttribute('color', new THREE.Float32BufferAttribute(flapColors, 3))
  flapGeo.setAttribute('uv', new THREE.Float32BufferAttribute(flapUvs, 2))
  flapGeo.setIndex(flapIndices)
  const flap = add(flapGeo, clothMaterial, [0, 0, 0], cloth)
  flap.name = 'basket-cloth-flap'

  // 3. Surface-bound coral-red embroidery stripes evaluated directly on the live cloth surface + outward normal.
  const stripeMeshes = EMBROIDERY_US.map((_, idx) =>
    createDynamicStripeTube(EMBROIDERY_SEGS, EMBROIDERY_RADIAL, EMBROIDERY_RADIUS, embroidery, `basket-cloth-embroidery-${idx}`, cloth),
  )
  const stripeSamplePts = EMBROIDERY_US.map(() => Array.from({ length: EMBROIDERY_SEGS + 1 }, () => new THREE.Vector3()))
  const tmpClothP = new THREE.Vector3()
  const tmpWrapP = new THREE.Vector3()
  const tmpU0 = new THREE.Vector3(), tmpU1 = new THREE.Vector3(), tmpV0 = new THREE.Vector3(), tmpV1 = new THREE.Vector3()
  const tmpN = new THREE.Vector3()
  const tmpTu = new THREE.Vector3(), tmpTv = new THREE.Vector3()
  const simGridCopy = new Float32Array(SIM_NU * SIM_NV * 3)
  const carrierGrid = new Float32Array(flapCols * (FLAP_SKIRT_ROWS + 1) * 3)

  function readFlapGridPoint(i: number, j: number, out: THREE.Vector3): THREE.Vector3 {
    const posAttr = flapGeo.getAttribute('position') as THREE.BufferAttribute
    const idx = j * flapCols + i
    return out.set(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx))
  }

  /** Evaluates the two coral-red embroidery threads directly on the deformed cloth surface + outward normal. */
  function syncEmbroideryToFlap() {
    const posAttr = flapGeo.getAttribute('position') as THREE.BufferAttribute
    const vStart = 0.14 // begins cleanly over the top rim crest
    const vEnd = 0.935  // ends neatly above the bottom hem
    for (let s = 0; s < EMBROIDERY_US.length; s++) {
      const u = EMBROIDERY_US[s]!
      const fu = u * FLAP_NX
      const i0 = Math.min(FLAP_NX - 1, Math.floor(fu))
      const i1 = i0 + 1
      const tu = fu - i0
      const pts = stripeSamplePts[s]!
      for (let k = 0; k <= EMBROIDERY_SEGS; k++) {
        const v = THREE.MathUtils.lerp(vStart, vEnd, k / EMBROIDERY_SEGS)
        const fv = v * FLAP_NY
        const j0 = Math.min(FLAP_NY - 1, Math.floor(fv))
        const j1 = j0 + 1
        const tv = fv - j0

        // Bilinear sample on the high-res 32x26 cloth mesh.
        const aIdx = j0 * flapCols + i0, bIdx = j0 * flapCols + i1
        const cIdx = j1 * flapCols + i0, dIdx = j1 * flapCols + i1
        const w00 = (1 - tu) * (1 - tv), w10 = tu * (1 - tv), w01 = (1 - tu) * tv, w11 = tu * tv
        const px = posAttr.getX(aIdx) * w00 + posAttr.getX(bIdx) * w10 + posAttr.getX(cIdx) * w01 + posAttr.getX(dIdx) * w11
        const py = posAttr.getY(aIdx) * w00 + posAttr.getY(bIdx) * w10 + posAttr.getY(cIdx) * w01 + posAttr.getY(dIdx) * w11
        const pz = posAttr.getZ(aIdx) * w00 + posAttr.getZ(bIdx) * w10 + posAttr.getZ(cIdx) * w01 + posAttr.getZ(dIdx) * w11

        // Outward normal: (+v) x (+u) points +Y over rim crest and +Z on front hanging skirt.
        const iL = Math.max(0, i0), iR = Math.min(FLAP_NX, i1)
        const jU = Math.max(0, j0), jD = Math.min(FLAP_NY, j1)
        readFlapGridPoint(iL, j0, tmpU0)
        readFlapGridPoint(iR, j0, tmpU1)
        readFlapGridPoint(i0, jU, tmpV0)
        readFlapGridPoint(i0, jD, tmpV1)
        tmpU1.sub(tmpU0)
        tmpV1.sub(tmpV0)
        tmpN.crossVectors(tmpV1, tmpU1)
        if (tmpN.lengthSq() < 1e-12) tmpN.set(0, 0, 1)
        else tmpN.normalize()

        pts[k]!.set(px + tmpN.x * EMBROIDERY_OFFSET, py + tmpN.y * EMBROIDERY_OFFSET, pz + tmpN.z * EMBROIDERY_OFFSET)
      }
      stripeMeshes[s]!.update(pts)
    }
  }

  /** Writes the calm zero-WASM equilibrium drape into flapGeo & embroidery stripes. */
  function writeCalmFlapDrape() {
    const posAttr = flapGeo.getAttribute('position') as THREE.BufferAttribute
    for (let j = 0; j <= FLAP_NY; j++) {
      for (let i = 0; i <= FLAP_NX; i++) {
        const u = i / FLAP_NX
        if (j <= FLAP_WRAP_ROWS) {
          evalRimWrapPoint(u, j / FLAP_WRAP_ROWS, tmpClothP)
        } else {
          const d = (j - FLAP_WRAP_ROWS) / FLAP_SKIRT_ROWS
          evalCalmSkirtPoint(u, d, tmpClothP)
          if (j === FLAP_NY) {
            const { nx, nz } = rimFrame(u)
            tmpClothP.x -= nx * 0.0026
            tmpClothP.z -= nz * 0.0026
            clampOutsideBasketWall(tmpClothP)
          }
        }
        posAttr.setXYZ(j * flapCols + i, tmpClothP.x, tmpClothP.y, tmpClothP.z)
      }
    }
    posAttr.needsUpdate = true
    flapGeo.computeVertexNormals()
    flapGeo.computeBoundingBox()
    flapGeo.computeBoundingSphere()
    syncEmbroideryToFlap()
  }

  // Rapier 2D soft-body cloth for the hanging linen skirt carrier (lazy-loaded ONLY when active & non-reduced).
  let flapBody: ReturnType<RapierSoftBodySession['createCloth']> | null = null
  let clothRapierReady = false
  let clothSimClock = 0
  let flapImpulseTimer = 0
  let flapImpulseAmp = 0
  let flapImpulseSide = 0.25 // u center of food-placement tug (0.25=bread side, 0.75=egg side)
  let wasReducedCloth = false

  function resetFlapBodyToCalm() {
    if (!flapBody || !flapBody.isValid()) return
    for (let i = 0; i < SIM_NU; i++) {
      const u = i / (SIM_NU - 1)
      for (let j = 0; j < SIM_NV; j++) {
        const d = j / (SIM_NV - 1)
        const k = i * SIM_NV + j
        if (j === 0) evalCarrierRimAnchor(u, tmpWrapP)
        else evalCarrierSkirtPoint(u, d, tmpWrapP)
        flapBody.setParticlePosition(k, { x: tmpWrapP.x, y: tmpWrapP.y, z: tmpWrapP.z })
        flapBody.setParticleVelocity(k, { x: 0, y: 0, z: 0 })
      }
    }
  }

  function applyFlapForces(_session: RapierSoftBodySession, subDt: number) {
    if (!flapBody || !flapBody.isValid()) return
    clothSimClock += subDt
    if (flapImpulseTimer > 0) flapImpulseTimer = Math.max(0, flapImpulseTimer - subDt)

    flapBody.resetForces(false)
    const pos = flapBody.particlePositions()
    const vel = flapBody.particleVelocities()
    const pMass = Math.max(flapBody.mass() / (SIM_NU * SIM_NV), 1e-4)
    const t = clothSimClock

    // Keep top row (j === 0) pinned strictly on the smooth outer wicker rim curve.
    for (let i = 0; i < SIM_NU; i++) {
      const u = i / (SIM_NU - 1)
      evalCarrierRimAnchor(u, tmpWrapP)
      flapBody.setParticleKinematicTarget(i * SIM_NV, { x: tmpWrapP.x, y: tmpWrapP.y, z: tmpWrapP.z })
    }

    const impPhase = 1.0 - flapImpulseTimer
    const impDecay = flapImpulseTimer > 0 ? Math.exp(-impPhase * 3.1) : 0

    for (let i = 0; i < SIM_NU; i++) {
      const u = i / (SIM_NU - 1)
      const { nx, nz } = rimFrame(u)
      const tx = nz, tz = -nx
      const sideBias = Math.exp(-Math.pow((u - flapImpulseSide) / 0.42, 2))
      for (let j = 1; j < SIM_NV; j++) {
        const d = j / (SIM_NV - 1)
        const k = i * SIM_NV + j
        const px = pos[k * 3]!, py = pos[k * 3 + 1]!, pz = pos[k * 3 + 2]!
        const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!
        const dRamp = THREE.MathUtils.smoothstep(d, 0.08, 0.95)

        // Subtle veranda air movement without blowing the cloth forward into a stiff flat panel.
        const gustA = Math.sin(t * 1.45 - u * 2.6 - d * 2.1)
        const gustB = Math.cos(t * 2.35 + u * 3.8 - d * 3.0)
        const breezeOut = (0.14 + 0.34 * gustA + 0.16 * gustB) * dRamp
        const breezeTan = (0.08 + 0.22 * Math.sin(t * 1.15 + d * 1.8)) * dRamp

        // Lively rim-tug and skirt ripple when bread or egg settles into the basket.
        const foodWave = impDecay > 1e-4
          ? flapImpulseAmp * impDecay * Math.sin(impPhase * 15 - d * 4.2) * (0.45 + 0.55 * sideBias) * dRamp
          : 0
        const foodTugY = impDecay > 1e-4
          ? flapImpulseAmp * 0.45 * impDecay * Math.cos(impPhase * 11 - d * 2.4) * (1 - d * 0.5) * sideBias
          : 0

        // Guide the 11x8 carrier gently around its natural hanging equilibrium; fine vertical pleats
        // ride on top of the live Rapier surface frame so planar springs never iron out the folds.
        evalCarrierSkirtPoint(u, d, tmpClothP)
        const fx = (breezeOut + foodWave) * nx + breezeTan * tx + 7.8 * (tmpClothP.x - px) - 1.85 * vx
        const fy = foodTugY + 3.8 * (tmpClothP.y - py) - 1.65 * vy
        const fz = (breezeOut + foodWave) * nz + breezeTan * tz + 7.8 * (tmpClothP.z - pz) - 1.85 * vz

        flapBody.addParticleForce(k, { x: pMass * fx, y: pMass * fy, z: pMass * fz }, false)
      }
    }
  }

  function writeFlapFromRapier() {
    if (!flapBody || !flapBody.isValid()) return
    const pos = flapBody.particlePositions()
    simGridCopy.set(pos)

    // Enforce exact rim-pin boundary & safe basket-wall / tabletop clearance on the simulated carrier grid.
    for (let i = 0; i < SIM_NU; i++) {
      const u = i / (SIM_NU - 1)
      evalCarrierRimAnchor(u, tmpWrapP)
      simGridCopy[i * SIM_NV * 3] = tmpWrapP.x
      simGridCopy[i * SIM_NV * 3 + 1] = tmpWrapP.y
      simGridCopy[i * SIM_NV * 3 + 2] = tmpWrapP.z
      for (let j = 1; j < SIM_NV; j++) {
        const k = (i * SIM_NV + j) * 3
        let x = simGridCopy[k]!, y = simGridCopy[k + 1]!, z = simGridCopy[k + 2]!
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          evalCarrierSkirtPoint(u, j / (SIM_NV - 1), tmpClothP)
          x = tmpClothP.x; y = tmpClothP.y; z = tmpClothP.z
        } else {
          tmpClothP.set(x, y, z)
          clampOutsideBasketWall(tmpClothP)
          if (tmpClothP.x > 0.08) tmpClothP.x = 0.08
          x = tmpClothP.x; y = tmpClothP.y; z = tmpClothP.z
        }
        simGridCopy[k] = x; simGridCopy[k + 1] = y; simGridCopy[k + 2] = z
      }
    }

    const posAttr = flapGeo.getAttribute('position') as THREE.BufferAttribute
    // Rows 0..FLAP_WRAP_ROWS smoothly wrap over the wicker rim from inside to the pleated rim crest.
    for (let j = 0; j <= FLAP_WRAP_ROWS; j++) {
      const wrapFrac = j / FLAP_WRAP_ROWS
      for (let i = 0; i <= FLAP_NX; i++) {
        evalRimWrapPoint(i / FLAP_NX, wrapFrac, tmpClothP)
        posAttr.setXYZ(j * flapCols + i, tmpClothP.x, tmpClothP.y, tmpClothP.z)
      }
    }

    // Sample the smooth live Rapier carrier surface into a pre-allocated grid so local frames are smooth.
    for (let i = 0; i <= FLAP_NX; i++) {
      const u = i / FLAP_NX
      evalCarrierRimAnchor(u, tmpClothP)
      const cIdx = i * 3
      carrierGrid[cIdx] = tmpClothP.x
      carrierGrid[cIdx + 1] = tmpClothP.y
      carrierGrid[cIdx + 2] = tmpClothP.z
    }
    for (let s = 1; s <= FLAP_SKIRT_ROWS; s++) {
      const vRow = FLAP_V_TABLE[s]!
      const d = s / FLAP_SKIRT_ROWS
      for (let i = 0; i <= FLAP_NX; i++) {
        const u = i / FLAP_NX
        const uRow = FLAP_U_TABLE[i]!
        sampleSimCloth(simGridCopy, uRow, vRow, tmpClothP)
        const edgeSoft = Math.sin(u * Math.PI)
        tmpClothP.y += (1 - Math.pow(edgeSoft, 0.45)) * 0.016 * d * d
        const cIdx = (s * flapCols + i) * 3
        carrierGrid[cIdx] = tmpClothP.x
        carrierGrid[cIdx + 1] = tmpClothP.y
        carrierGrid[cIdx + 2] = tmpClothP.z
      }
    }

    // Layer authored asymmetric vertical linen pleats onto the live Rapier carrier tangent frame.
    const livePleatBreath = 1 - 0.08 * THREE.MathUtils.clamp(flapImpulseTimer, 0, 1)
    for (let s = 1; s <= FLAP_SKIRT_ROWS; s++) {
      const j = FLAP_WRAP_ROWS + s
      const d = s / FLAP_SKIRT_ROWS
      const sPrev = Math.max(0, s - 1)
      const sNext = Math.min(FLAP_SKIRT_ROWS, s + 1)
      for (let i = 0; i <= FLAP_NX; i++) {
        const u = i / FLAP_NX
        const iPrev = Math.max(0, i - 1)
        const iNext = Math.min(FLAP_NX, i + 1)
        const cIdx = (s * flapCols + i) * 3
        tmpClothP.set(carrierGrid[cIdx]!, carrierGrid[cIdx + 1]!, carrierGrid[cIdx + 2]!)

        const iL = (s * flapCols + iPrev) * 3
        const iR = (s * flapCols + iNext) * 3
        tmpTu.set(carrierGrid[iR]! - carrierGrid[iL]!, carrierGrid[iR + 1]! - carrierGrid[iL + 1]!, carrierGrid[iR + 2]! - carrierGrid[iL + 2]!)
        if (tmpTu.lengthSq() < 1e-10) {
          const { nx, nz } = rimFrame(u)
          tmpTu.set(nz, 0, -nx)
        } else {
          tmpTu.normalize()
        }

        const jU = (sPrev * flapCols + i) * 3
        const jD = (sNext * flapCols + i) * 3
        tmpTv.set(carrierGrid[jD]! - carrierGrid[jU]!, carrierGrid[jD + 1]! - carrierGrid[jU + 1]!, carrierGrid[jD + 2]! - carrierGrid[jU + 2]!)
        if (tmpTv.lengthSq() < 1e-10) tmpTv.set(0, -1, 0)
        else tmpTv.normalize()

        tmpN.crossVectors(tmpTv, tmpTu)
        if (tmpN.lengthSq() < 1e-10) {
          const { nx, nz } = rimFrame(u)
          tmpN.set(nx, 0, nz)
        } else {
          tmpN.normalize()
        }

        const pleat = evalPleatRelief(u, d)
        tmpClothP.addScaledVector(tmpN, pleat.normalOffset * livePleatBreath)
        tmpClothP.addScaledVector(tmpTu, pleat.gatherTan * livePleatBreath)
        tmpClothP.y += pleat.hemWaveY * livePleatBreath
        if (s === FLAP_SKIRT_ROWS) {
          tmpClothP.addScaledVector(tmpN, -0.0026)
        }
        clampOutsideBasketWall(tmpClothP)
        if (tmpClothP.x > 0.08) tmpClothP.x = 0.08
        posAttr.setXYZ(j * flapCols + i, tmpClothP.x, tmpClothP.y, tmpClothP.z)
      }
    }
    posAttr.needsUpdate = true
    flapGeo.computeVertexNormals()
    flapGeo.computeBoundingBox()
    flapGeo.computeBoundingSphere()
    syncEmbroideryToFlap()
  }

  function triggerClothImpulse(step: 0 | 1) {
    liningImpactTime = 0
    liningImpactStrength = step === 0 ? 1.0 : 0.6
    if (reduced() || disposed) return
    flapImpulseTimer = 1.0
    flapImpulseAmp = step === 0 ? 6.8 : 3.6
    flapImpulseSide = step === 0 ? 0.30 : 0.85
    if (flapBody && flapBody.isValid()) {
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        const { nx, nz } = rimFrame(u)
        const sideBias = Math.exp(-Math.pow((u - flapImpulseSide) / 0.45, 2))
        for (let j = 1; j < SIM_NV; j++) {
          const d = j / (SIM_NV - 1)
          const kick = (step === 0 ? 0.42 : 0.24) * (0.4 + 0.6 * sideBias) * Math.sin(d * Math.PI * 0.85)
          flapBody.setParticleVelocity(i * SIM_NV + j, { x: nx * kick, y: 0.14 * sideBias * (1 - d * 0.5), z: nz * kick })
        }
      }
      clothHost.wakeUp()
    }
  }

  const clothHost = createRapierSoftBodyHost({
    gravity: { x: 0, y: -6.8, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 6,
    internalPgsIterations: 3,
    sleepSpeedThreshold: 0,
    isActive: active,
    isReducedMotion: reduced,
    onReady(session) {
      if (disposed) return
      // Fixed oval-approximated basket core collider + oak tabletop collider prevent cloth penetration in solver space.
      session.addFixedCylinder({ x: 0, y: 0.22, z: 0 }, 0.46, 0.42, { friction: 0.55, restitution: 0.02 })
      session.addFixedBox({ x: 0, y: -0.055, z: 0.35 }, { x: 2.2, y: 0.05, z: 1.4 }, { friction: 0.65, restitution: 0.02 })

      const pinnedTop: number[] = []
      for (let i = 0; i < SIM_NU; i++) pinnedTop.push(i * SIM_NV)

      // Arc width along front-left rim (~0.65) and drop length (0.365).
      flapBody = session.createCloth({
        origin: { x: -0.58, y: RIM_CY, z: 0.42 },
        du: { x: 0.65 / (SIM_NU - 1), y: 0, z: 0 },
        dv: { x: 0, y: -FLAP_DROP / (SIM_NV - 1), z: 0 },
        nu: SIM_NU,
        nv: SIM_NV,
        mass: 0.22,
        particleRadius: 0.012,
        gravityScale: 0.9,
        linearDamping: 2.1,
        edgeSoftness: { naturalFrequency: 24, dampingRatio: 0.78 },
        bendSoftness: { naturalFrequency: 5.5, dampingRatio: 0.72 },
        tensionOnly: false,
        pinnedParticles: pinnedTop,
        noSurfaceCollider: true,
        canSleep: false,
      })
      clothRapierReady = true
      resetFlapBodyToCalm()
      clothHost.settle(32, applyFlapForces)
      if (!reduced()) writeFlapFromRapier()
    },
  })

  updateInnerLining()
  writeCalmFlapDrape()
  const breadRest = pebble([0.12, 1.165, 0.05], [0.33, 0.035, 0.30], cream, world); breadRest.name = 'basket-bread-rest'
  const nest = pebble([0.85, 1.195, 0.13], [0.23, 0.038, 0.21], cream, world); nest.name = 'basket-egg-nest'
  for (let i = 0; i < 3; i++) {
    const ring = add(new THREE.TorusGeometry(0.18 + i * 0.012, 0.014, 7, 40), cream, [0.85, 1.20 + i * 0.012, 0.13])
    ring.rotation.x = -Math.PI / 2; ring.scale.y = 0.9
  }
  const medallion = pebble([0.23, 0.23, 0.481], [0.115, 0.103, 0.027], wicker[2], basket); medallion.name = 'basket-quiet-medallion'
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2
    const petal = pebble([0.23 + Math.cos(a) * 0.033, 0.23 + Math.sin(a) * 0.033, 0.51], [0.023, 0.016, 0.006], cream, basket)
    petal.rotation.z = a
  }
  pebble([0.23, 0.23, 0.518], [0.016, 0.016, 0.005], stitch, basket)

  const bread = new THREE.Group(); bread.name = 'basket-bread'; world.add(bread)
  const breadBody = pebble([0, 0, 0], [0.37, 0.22, 0.33], crust, bread); breadBody.name = 'basket-bread-body'
  const scores = new THREE.Group(); scores.name = 'basket-bread-scores'; bread.add(scores)
  for (const row of [-1, 0, 1]) {
    const points = Array.from({ length: 23 }, (_, i) => {
      const x = (i / 22 - 0.5) * 0.49, z = row * 0.13 + x * 0.20
      return new THREE.Vector3(x, Math.sqrt(Math.max(0, 1 - (x / 0.37) ** 2 - (z / 0.33) ** 2)) * 0.22 + 0.004, z)
    })
    scores.add(tube(points, 0.017, breadCut))
  }
  for (let i = 0; i < 14; i++) {
    const a = i * 2.399, r = 0.1 + (i % 4) * 0.038, x = Math.cos(a) * r, z = Math.sin(a) * r
    const y = Math.sqrt(1 - (x / 0.37) ** 2 - (z / 0.33) ** 2) * 0.22 + 0.003
    const fleck = pebble([x, y, z], [0.008, 0.003, 0.013], breadCut, bread); fleck.userData.toonSurface = { outline: false }
  }
  const eggGeo = new THREE.SphereGeometry(1, 28, 20), eggVertices = eggGeo.attributes.position
  for (let i = 0; i < eggVertices.count; i++) {
    const y = eggVertices.getY(i), taper = 1 - y * 0.16
    eggVertices.setXYZ(i, eggVertices.getX(i) * taper, y, eggVertices.getZ(i) * taper)
  }
  eggGeo.computeVertexNormals()
  const makeEgg = (mat: THREE.Material, name: string) => {
    const root = new THREE.Group(); root.name = name
    const body = add(eggGeo, mat, [0, 0, 0], root); body.scale.set(0.17, 0.245, 0.17)
    const pattern = new THREE.Group(); pattern.name = `${name}-pattern`; root.add(pattern)
    for (const latitude of [-0.55, 0.48]) {
      const radius = Math.sqrt(1 - latitude ** 2) * 0.17 * (1 - latitude * 0.16)
      pattern.add(tube(Array.from({ length: 48 }, (_, i) => {
        const a = i / 48 * Math.PI * 2
        return new THREE.Vector3(Math.cos(a) * radius, latitude * 0.245 + Math.sin(a * 8) * 0.006, Math.sin(a) * radius)
      }), 0.008, eggCream, true))
    }
    // Five-petal, hand-spaced flowers are original marks, not a copied pisanki pattern.
    for (let flower = 0; flower < 4; flower++) {
      const theta = flower / 4 * Math.PI * 2
      for (let p = 0; p < 6; p++) {
        const a = p / 6 * Math.PI * 2, y = Math.sin(a) * 0.036, t = theta + Math.cos(a) * 0.20
        const radius = Math.sqrt(1 - (y / 0.245) ** 2) * 0.17 * (1 - y / 0.245 * 0.16) + 0.003
        const dot = pebble([Math.sin(t) * radius, y, Math.cos(t) * radius], [0.012, 0.012, 0.012], eggCream, pattern)
        dot.userData.toonSurface = { outline: false }
      }
      const dot = pebble([Math.sin(theta) * 0.175, 0, Math.cos(theta) * 0.175], [0.01, 0.01, 0.01], sage, pattern)
      dot.userData.toonSurface = { outline: false }
    }
    return { root, body }
  }
  const { root: egg, body: eggBody } = makeEgg(eggRose, 'basket-egg'); eggBody.name = 'basket-egg-body'; world.add(egg)
  const companion = makeEgg(eggBlue, 'basket-blue-egg').root
  companion.position.set(0.54, 1.385, -0.29); companion.rotation.z = -0.21; companion.scale.setScalar(0.8); world.add(companion)
  const herbs = new THREE.Group(); herbs.name = 'basket-spring-herbs'; basket.add(herbs)
  for (let sprig = 0; sprig < 3; sprig++) {
    const x = 0.3 + sprig * 0.09, lean = sprig * 0.10 - 0.08
    herbs.add(tube([new THREE.Vector3(x, 0.23, -0.25), new THREE.Vector3(x + lean * 0.6, 0.62, -0.32), new THREE.Vector3(x + lean, 0.99 - sprig * 0.07, -0.34)], 0.008, darkLeaf))
    for (let i = 0; i < 6; i++) {
      const y = 0.44 + i * 0.076, side = i % 2 ? -1 : 1
      const leaf = pebble([x + lean * (y - 0.2) + side * 0.045, y, -0.30], [0.034, 0.081, 0.013], i % 2 ? sage : darkLeaf, herbs)
      leaf.rotation.z = side * -0.77; leaf.rotation.y = side * 0.4; leaf.userData.toonSurface = { outline: false }
    }
  }

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restorePose = () => {
    bread.position.copy(checkpoint >= 1 ? BREAD_REST : BREAD_HOME); bread.rotation.set(0, checkpoint >= 1 ? -0.10 : 0.10, 0)
    egg.position.copy(checkpoint >= 2 ? EGG_REST : EGG_HOME); egg.rotation.set(0, 0, checkpoint >= 2 ? -0.07 : 0.04)
    breadWeight = checkpoint >= 1 ? 1 : 0
    eggWeight = checkpoint >= 2 ? 1 : 0
    updateInnerLining()
    matrices()
  }
  const source = () => checkpoint === 0 ? breadBody : checkpoint === 1 ? eggBody : medallion
  const movingFood = () => checkpoint === 0 ? bread : egg
  const finishPickables: THREE.Object3D[] = [breadBody, eggBody]
  basket.traverse(object => { if ((object as THREE.Mesh).isMesh) finishPickables.push(object) })
  const cueActive = (at: number) => () => active() && !placement && checkpoint === at
  addInteractionCue(breadBody, { kind: 'drag', label: '拖面包入篮', priority: 3, enabled: cueActive(0), destination: breadRest, targetLabel: '篮内衬布' })
  addInteractionCue(eggBody, { kind: 'drag', label: '拖彩蛋入窝', priority: 3, enabled: cueActive(1), destination: nest, targetLabel: '彩蛋蛋窝' })
  addInteractionCue(medallion, { kind: 'tap', label: '静看备好的食物篮', priority: 3, enabled: cueActive(2) })
  const ray = createPointerRay(canvas, camera), dragPlane = new THREE.Plane(), dragPoint = new THREE.Vector3(), dragOffset = new THREE.Vector3()
  const down = new THREE.Vector2()
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const placementReady = (x: number, y: number) => checkpoint < 2
    && !touch.occluded(x, y, checkpoint === 0 ? breadRest : nest, { ignore: movingFood() })
    && placementHit(canvas, camera, source(), x, y, (px, py) => touch.hit(px, py, checkpoint === 0 ? breadRest : nest, { ignore: movingFood() }))
  const resetDrag = () => { dropFeedback.clear(); dragging = false; maxTravel = 0; if (!placement) restorePose() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) {
      if (placement || checkpoint === 3) return false
      matrices(); return checkpoint === 2 ? touch.hit(x, y, finishPickables) : ray.hits(x, y, [source()])
    },
    onStart(x, y) {
      down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare()
      if (dragging) {
        dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), movingFood().position)
        if (ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) dragOffset.copy(movingFood().position).sub(dragPoint)
      }
    },
    onMove(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || checkpoint >= 2) return
      if (ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) {
        movingFood().position.copy(dragPoint).add(dragOffset)
        movingFood().position.x = THREE.MathUtils.clamp(movingFood().position.x, -1.22, 1.18)
        movingFood().position.y = THREE.MathUtils.clamp(movingFood().position.y, 0.86, 1.95)
        matrices(); dropFeedback.setReady(placementReady(x, y))
      }
      if (checkpoint < 2 && placementReady(x,y) && pointer.finish()) { dragging = false; dropFeedback.clear(); beginPlacement(true) }
    },
    onRelease(x, y) {
      if (dragging && checkpoint < 2 && ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) {
        movingFood().position.copy(dragPoint).add(dragOffset)
        movingFood().position.x = THREE.MathUtils.clamp(movingFood().position.x, -1.22, 1.18)
        movingFood().position.y = THREE.MathUtils.clamp(movingFood().position.y, .86, 1.95)
      }
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && placementReady(x, y)
        : checkpoint === 2 && maxTravel < 12 && touch.hit(x, y, finishPickables)
      dropFeedback.clear(); dragging = false
      if (valid) { if (checkpoint < 2) beginPlacement(); else finish() } else resetDrag()
    },
    onCancel: resetDrag,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: () => active(), duration: 3, motion: 'glow',
    targets: () => [basket], cancelInput: () => pointer.cancel(), complete: () => finish(),
  })
  const sync = () => {
    dropFeedback.clear()
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3
    ui.actionBtn.disabled = !active() || !!placement || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    wishSlot.hidden = returning || checkpoint !== 2
    writer?.setEnabled(active() && !returning && checkpoint === 2 && !placement)
    ui.hitLayer.style.pointerEvents = checkpoint < 3 && !placement ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? COPY.breadAction : checkpoint === 1 ? COPY.eggAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, placement ? placement.step === 0 ? COPY.placingBread : COPY.placingEgg
      : checkpoint === 0 ? COPY.bread : checkpoint === 1 ? COPY.egg : checkpoint === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    ending.sync(checkpoint === 2 && !placement)
  }
  function placed() {
    if (!active() || !placement) return
    const placedStep = placement.step
    checkpoint = (placedStep + 1) as Checkpoint; placement = null; restorePose(); triggerClothImpulse(placedStep); sync()
    ctx.onProgress?.(checkpoint)
    feedback.impact({ freqs: checkpoint === 1 ? [392, 493.88] : [440, 659.25], duration: 0.2, gain: 0.017, type: 'triangle' })
  }
  function beginPlacement(arrived = false) {
    if (!active() || (pointer.isBusy() && !arrived) || placement || checkpoint >= 2) return
    placement = { step: checkpoint as 0 | 1, time: 0, from: movingFood().position.clone() }; dragging = false; sync()
    if (reduced()) placed()
  }
  function finish(text = '') {
    if (!text.trim() && !ending.completing) return
    if (!active() || pointer.isBusy() || placement || checkpoint !== 2) return
    const line = text.trim()
    // Terminal state precedes host callbacks, so a reentrant submission cannot save twice.
    checkpoint = 3; restorePose(); sync()
    if (line && !returning) ctx.saveWish?.(line)
    if (disposed) return
    ctx.onProgress?.(3); if (!active()) return; feedback.impact({ freqs: [392, 587.33], duration: 0.26, gain: 0.017 })
    if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const onAction = () => {
    if (!active() || pointer.isBusy() || placement || checkpoint === 3) return
    feedback.prepare(); if (checkpoint < 2) beginPlacement(); else finish()
  }
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 10)
    camera.position.set(0, 3.25 + boost * 0.34, 5.6 + boost); camera.lookAt(0, 1.10, 0); matrices()
  }
  restorePose(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restorePose(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!reduced() && active()) void clothHost.start()
      if (!returning) {
        writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
          onSubmit: text => { if (!active() || pointer.isBusy() || placement || checkpoint !== 2 || !text.trim()) return; feedback.prepare(); finish(text) } })
        writer.mount(wishSlot, {})
      }
      ui.actionBtn.addEventListener('click', onAction); window.addEventListener('blur', blur); window.addEventListener('focus', focus)
      sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) {
        pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true')
        if (!inactiveRendered) { style.render(); inactiveRendered = true }
        return
      }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(checkpoint === 2 && !returning && !placement); writer?.update(dt)
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, 0.05) : 0
      if (placement) {
        placement.time = reduced() ? 1 : Math.min(1, placement.time + delta / 0.65)
        const t = placement.time, food = placement.step === 0 ? bread : egg, destination = placement.step === 0 ? BREAD_REST : EGG_REST
        food.position.lerpVectors(placement.from, destination, smooth(t))
        if (!reduced()) food.position.y += Math.sin(t * Math.PI) * 0.13
        if (!reduced() && t > 0.72) {
          const load = smooth((t - 0.72) / 0.28)
          if (placement.step === 0) breadWeight = load
          else eggWeight = load
          updateInnerLining()
        }
        if (t === 1) placed()
      }
      if (!active()) return
      if (reduced()) {
        if (!wasReducedCloth) {
          wasReducedCloth = true
          liningImpactStrength = 0
          flapImpulseTimer = 0
          updateInnerLining()
          writeCalmFlapDrape()
        }
      } else {
        if (wasReducedCloth) {
          wasReducedCloth = false
          resetFlapBodyToCalm()
          clothHost.wakeUp()
        }
        if (liningImpactStrength > 1e-4) {
          liningImpactTime += delta
          if (liningImpactTime > 1.3) liningImpactStrength = 0
          updateInnerLining()
        }
        if (!clothRapierReady) {
          void clothHost.start()
        } else {
          clothHost.step(delta, applyFlapForces, writeFlapFromRapier)
        }
      }
      ending.update(dt)
      if (!active()) return
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); style.render()
    },
    dispose() {
      if (disposed) return
      clothHost.dispose()
      clothRapierReady = false
      flapBody = null
      ending.dispose(); disposed = true; dropFeedback.dispose(); pointer.dispose(); stopResize(); writer?.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', onAction); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      flapLinenTex.map.dispose(); flapLinenTex.bump.dispose()
      liningLinenTex.map.dispose(); liningLinenTex.bump.dispose()
      embroideryTex.map.dispose(); embroideryTex.bump.dispose()
      style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose())
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
