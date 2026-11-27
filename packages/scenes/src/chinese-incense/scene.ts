import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { bakeCreviceAO } from '@wbr/scene-runtime/prop-geometry'
import { createSoftPlume } from '@wbr/scene-runtime/soft-plume'
import { createQuietEnding } from '../quiet-ending'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { addContactShadow } from '../cozy-furniture'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import { placementHit } from '../placement-hit'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '炉前一炷', lidAction: '移开炉盖', incenseAction: '安放一炷香', quietAction: '轻点茶托看烟',
  lid: '捏住圆盖钮，拖到右侧盖托，露出炉内的香孔。',
  incense: '握住暖色纸套，把一炷细香拖进炉内的小香孔。',
  quiet: '轻点茶托或炉身，静看轻烟，体会妈祖信俗中敬香祈安的心意。',
  returning: '轻点茶托或炉身，再看炉前轻烟，回想敬香祈安的心意。',
  movingLid: '炉盖轻轻落在陶托上…', movingIncense: '细香安稳落入香孔，纸套留在桌边…',
  done: '细香已安放，留一刻静赏，向敬香祈安的传统致意。',
} as const
const LID_HOME = new THREE.Vector3(.12, 1.44, -.22)
const LID_REST = new THREE.Vector3(1.035, .61, .36)
const STICK_HOME = new THREE.Vector3(-1.00, .595, .22)
const STICK_REST = new THREE.Vector3(.12, 1.385, -.22)
type Checkpoint = 0 | 1 | 2 | 3
type Placement = { step: 0 | 1; time: number; from: THREE.Vector3; paperFrom: THREE.Vector3 }
const smooth = (t: number) => t * t * (3 - 2 * t)

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicWoodNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const fx = x - xi, fy = y - yi
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px
  const y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed)
  const c = hash2(x0, y1, seed), d = hash2(x1, y1, seed)
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy
}

function wrapPeriodicDelta(a: number, b: number): number {
  let d = a - b
  if (d > 0.5) d -= 1
  else if (d < -0.5) d += 1
  return d
}

type IncenseWoodCathedral = {
  along: number
  across: number
  widthAlong: number
  widthAcross: number
  lift: number
}

type IncenseWoodKnot = {
  along: number
  across: number
  ra: number
  rc: number
  deflect: number
  depth: number
  tilt?: number
}

type IncenseWoodSpec = {
  key: string
  light: readonly [number, number, number]
  dark: readonly [number, number, number]
  warm: readonly [number, number, number]
  knot?: readonly [number, number, number]
  orientation: 'u' | 'v'
  rings: number
  spread: number
  arch: number
  wobble: number
  cathedrals?: readonly IncenseWoodCathedral[]
  knots?: readonly IncenseWoodKnot[]
  repeat?: readonly [number, number]
  offset?: readonly [number, number]
  seed: number
}

const cachedIncenseWoodPixels = new Map<string, { color: Uint8Array; bump: Uint8Array; size: number }>()

/**
 * Deterministic calm stylized elm/walnut DataTexture (256x256, zero DOM/Canvas2D dependency):
 * non-uniform growth-ring spacing, flowing elm cathedral sweeps, and sparse stylized knots ("木眼")
 * with organic grain parting for the low table, vertical legs and walnut incense tray.
 */
function createIncenseWoodTextures(spec: IncenseWoodSpec): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 256
  let cached = cachedIncenseWoodPixels.get(spec.key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const knotRgb: readonly [number, number, number] = spec.knot ?? [
      Math.max(26, Math.round(spec.dark[0] * 0.72)),
      Math.max(18, Math.round(spec.dark[1] * 0.68)),
      Math.max(12, Math.round(spec.dark[2] * 0.64)),
    ]
    const phaseA = hash2(spec.seed, 19, 5)
    const phaseB = hash2(spec.seed, 37, 13)
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const along = spec.orientation === 'u' ? u : v
        const across = spec.orientation === 'u' ? v : u

        const acrossVar = across
          + (spec.spread / tau) * Math.sin((across + phaseA) * tau)
          + ((spec.spread * 0.44) / tau) * Math.sin((across * 2 + phaseB) * tau)

        const wash = periodicWoodNoise(along * 2, across * 2, 2, 2, spec.seed + 13)
        const broadFlow = (periodicWoodNoise(along * 2, across * 2, 2, 2, spec.seed + 29) - 0.5) * spec.wobble
        const midFlow = (periodicWoodNoise(along * 3, across * 5, 3, 5, spec.seed + 43) - 0.5) * spec.wobble * 0.44
        const bow = Math.sin((along + phaseA) * tau) * spec.arch
          + Math.sin((along * 2 + phaseB) * tau) * spec.arch * 0.36

        let cathedralLift = 0
        if (spec.cathedrals) {
          for (const c of spec.cathedrals) {
            const da = wrapPeriodicDelta(along, c.along)
            const dc = wrapPeriodicDelta(across, c.across)
            cathedralLift += c.lift * Math.exp(-((da / c.widthAlong) ** 2 + (dc / c.widthAcross) ** 2))
          }
        }

        let knotDeflect = 0
        let knotTone = 0
        let knotGlow = 0
        if (spec.knots) {
          for (let ki = 0; ki < spec.knots.length; ki++) {
            const k = spec.knots[ki]!
            const da0 = wrapPeriodicDelta(along, k.along)
            const dc0 = wrapPeriodicDelta(across, k.across)
            const tilt = k.tilt ?? 0
            const cosT = Math.cos(tilt), sinT = Math.sin(tilt)
            const da = da0 * cosT + dc0 * sinT
            const dc = -da0 * sinT + dc0 * cosT
            const wakeA = da / (k.ra * 2.8)
            const wakeC = dc / (k.rc * 2.2)
            const wake = Math.exp(-(wakeA * wakeA + wakeC * wakeC))
            knotDeflect -= k.deflect * Math.tanh(dc / Math.max(k.rc * 0.85, 0.005)) * wake

            const ell = Math.hypot(da / k.ra, dc / k.rc)
            if (ell < 1.75) {
              const kw = (periodicWoodNoise(along * 6, across * 6, 6, 6, spec.seed + 137 + ki * 19) - 0.5) * 0.14
              const ed = Math.max(0, ell + kw * THREE.MathUtils.smoothstep(ell, 0.15, 0.92))
              const collar = Math.exp(-(((ed - 0.96) / 0.25) ** 2)) * 0.36 * k.depth
              const inside = 1 - THREE.MathUtils.smoothstep(ed, 0.78, 1.08)
              const swirl = 0.5 + 0.5 * Math.sin(ed * 15.0 + (da / Math.max(k.ra, 0.01)) * 0.55)
              const core = 1 - THREE.MathUtils.smoothstep(ed, 0.14, 0.56)
              knotTone = Math.max(knotTone, Math.min(1, inside * (0.44 + 0.30 * swirl + 0.44 * core) * k.depth + collar))
              knotGlow = Math.max(knotGlow, Math.exp(-(((ed - 1.24) / 0.28) ** 2)) * 0.18 * k.depth)
            }
          }
        }

        const ringPos = acrossVar * spec.rings + bow + broadFlow + midFlow + cathedralLift + knotDeflect
        const frac = ringPos - Math.floor(ringPos)
        const rampUp = THREE.MathUtils.smoothstep(frac, 0.07, 0.74)
        const rampDown = 1 - THREE.MathUtils.smoothstep(frac, 0.74, 0.98)
        const primaryRing = Math.pow(Math.min(rampUp, rampDown), 1.32)
        const secFrac = (ringPos * 2.0 + 0.27) - Math.floor(ringPos * 2.0 + 0.27)
        const secondaryRing = Math.pow(Math.min(THREE.MathUtils.smoothstep(secFrac, 0.12, 0.65), 1 - THREE.MathUtils.smoothstep(secFrac, 0.65, 0.96)), 1.6) * 0.20
        const softMod = 0.62 + 0.52 * periodicWoodNoise(along * 2, across * 3, 2, 3, spec.seed + 59)
        const fiber = periodicWoodNoise(along * 4, across * 28, 4, 28, spec.seed + 71) - 0.5

        const grainMix = THREE.MathUtils.clamp((primaryRing * 0.74 + secondaryRing) * softMod + fiber * 0.09, 0, 1)
        const warmMix = THREE.MathUtils.clamp(wash * 0.46 + knotGlow, 0, 1)
        const baseR = THREE.MathUtils.lerp(spec.light[0], spec.warm[0], warmMix)
        const baseG = THREE.MathUtils.lerp(spec.light[1], spec.warm[1], warmMix)
        const baseB = THREE.MathUtils.lerp(spec.light[2], spec.warm[2], warmMix)

        const gR = THREE.MathUtils.lerp(baseR, spec.dark[0], grainMix)
        const gG = THREE.MathUtils.lerp(baseG, spec.dark[1], grainMix)
        const gB = THREE.MathUtils.lerp(baseB, spec.dark[2], grainMix)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(gR, knotRgb[0], knotTone)), 0, 255)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(gG, knotRgb[1], knotTone)), 0, 255)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(gB, knotRgb[2], knotTone)), 0, 255)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(128 - primaryRing * 19 * softMod + fiber * 10 - knotTone * 22), 62, 192)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cached = { color, bump, size }
    cachedIncenseWoodPixels.set(spec.key, cached)
  }

  const map = new THREE.DataTexture(new Uint8Array(cached.color), size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  if (spec.repeat) map.repeat.set(spec.repeat[0], spec.repeat[1])
  if (spec.offset) map.offset.set(spec.offset[0], spec.offset[1])
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.anisotropy = 4
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cached.bump), size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  if (spec.repeat) bump.repeat.set(spec.repeat[0], spec.repeat[1])
  if (spec.offset) bump.offset.set(spec.offset[0], spec.offset[1])
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.anisotropy = 4
  bump.needsUpdate = true

  return { map, bump }
}

/**
 * Deterministic 512x256 DataTexture (WebGL + jsdom safe) for the hollow folded paper incense sleeve:
 * - u in [0.00, 0.50]: outer front terracotta paper with sand-cream top folded cuff, subtle left lap seam,
 *   and matte cream-printed botanical sprig (preserving the original non-prescribed sprig motif).
 * - u in [0.50, 0.85]: outer back & folded side edges (terracotta + sand-cream top cuff).
 * - u in [0.85, 1.00]: pale unbleached parchment inner pocket lining & paper rim edge.
 */
function createIncenseSleevePrintMap(width = 512, height = 256): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4)
  // Original terracotta paper (0xc98468), sand-cream cuff/seam (0xe6b995), cream sprig ink (0xf2e4c7), inner lining.
  const terraR = 204, terraG = 132, terraB = 104
  const cuffR = 232, cuffG = 188, cuffB = 152
  const inkR = 244, inkG = 232, inkB = 204
  const innerR = 236, innerG = 218, innerB = 186

  // Evaluate distance from a point to a 2D line segment for crisp matte ink strokes.
  const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const abx = bx - ax, aby = by - ay
    const t = THREE.MathUtils.clamp(((px - ax) * abx + (py - ay) * aby) / Math.max(1e-8, abx * abx + aby * aby), 0, 1)
    return Math.hypot(px - (ax + abx * t), py - (ay + aby * t))
  }

  for (let iy = 0; iy < height; iy++) {
    const v = iy / (height - 1) // 0 = bottom, 1 = top
    const yWorld = 0.01 + v * 0.61
    for (let ix = 0; ix < width; ix++) {
      const u = ix / (width - 1)
      const grain = (hash2(ix, iy, 53) - 0.5) * 0.055
      let r = terraR, g = terraG, b = terraB

      if (u >= 0.85) {
        // Inner lining & thin cut rim.
        r = innerR; g = innerG; b = innerB
      } else {
        // Sand-cream folded top cuff band (v in [0.905, 1.0]) with soft fold shadow line beneath it.
        const cuffAlpha = THREE.MathUtils.smoothstep(v, 0.900, 0.916)
        if (cuffAlpha > 0.001) {
          r = THREE.MathUtils.lerp(r, cuffR, cuffAlpha)
          g = THREE.MathUtils.lerp(g, cuffR ? cuffG : g, cuffAlpha)
          b = THREE.MathUtils.lerp(b, cuffB, cuffAlpha)
        }
        const cuffLine = 1 - 0.14 * Math.exp(-Math.pow((v - 0.896) / 0.010, 2))
        r *= cuffLine; g *= cuffLine; b *= cuffLine

        if (u < 0.50) {
          // Front panel coordinates: x in [-0.295, +0.295].
          const uf = u / 0.50
          const xWorld = (uf - 0.5) * 0.59

          // Left vertical folded-paper lap seam stripe (echoing original paperSeam at x = -0.23).
          const seamAlpha = (1 - THREE.MathUtils.smoothstep(Math.abs(xWorld - (-0.225)), 0.011, 0.016))
            * THREE.MathUtils.smoothstep(v, 0.02, 0.05) * (1 - THREE.MathUtils.smoothstep(v, 0.89, 0.91))
          if (seamAlpha > 0.001) {
            r = THREE.MathUtils.lerp(r, cuffR, seamAlpha * 0.88)
            g = THREE.MathUtils.lerp(g, cuffG, seamAlpha * 0.88)
            b = THREE.MathUtils.lerp(b, cuffB, seamAlpha * 0.88)
          }
          // Fine crease shadow right beside the paper lap edge.
          const lapShadow = 1 - 0.16 * Math.exp(-Math.pow((xWorld - (-0.205)) / 0.008, 2)) * (1 - cuffAlpha)
          r *= lapShadow; g *= lapShadow; b *= lapShadow

          // Original minimalist botanical sprig printed directly onto the paper (stem + 3 small tilted leaves).
          const dStem1 = segDist(xWorld, yWorld, 0.045, 0.125, 0.026, 0.23)
          const dStem2 = segDist(xWorld, yWorld, 0.026, 0.23, 0.047, 0.34)
          let inkAlpha = 1 - THREE.MathUtils.smoothstep(Math.min(dStem1, dStem2), 0.0042, 0.0072)
          const leaves: readonly [number, number, number][] = [
            [0.004, 0.19, -0.65],
            [0.055, 0.255, 0.65],
            [0.020, 0.30, -0.60],
          ]
          for (const [lx, ly, tilt] of leaves) {
            const dx = xWorld - lx, dy = yWorld - ly
            const c = Math.cos(-tilt), s = Math.sin(-tilt)
            const rx = dx * c - dy * s
            const ry = dx * s + dy * c
            // Pointed leaf silhouette matching the original sprig's proportion.
            const pinch = 1 + 0.35 * Math.pow(Math.abs(ry) / 0.036, 1.5)
            const ell = Math.hypot((rx * pinch) / 0.013, ry / 0.035)
            const a = 1 - THREE.MathUtils.smoothstep(ell, 0.88, 1.06)
            if (a > inkAlpha) inkAlpha = a
          }
          if (inkAlpha > 0.001) {
            const a = THREE.MathUtils.clamp(inkAlpha * (0.94 + grain), 0, 1)
            r = THREE.MathUtils.lerp(r, inkR, a)
            g = THREE.MathUtils.lerp(g, inkG, a)
            b = THREE.MathUtils.lerp(b, inkB, a)
          }
        }
      }

      const mult = 1 + grain * 0.45
      const idx = (iy * width + ix) * 4
      data[idx] = THREE.MathUtils.clamp(Math.round(r * mult), 0, 255)
      data[idx + 1] = THREE.MathUtils.clamp(Math.round(g * mult), 0, 255)
      data[idx + 2] = THREE.MathUtils.clamp(Math.round(b * mult), 0, 255)
      data[idx + 3] = 255
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/**
 * Watertight hollow folded paper incense sleeve geometry (origin at [0, 0.315, 0.035] inside `paper`).
 * Uses a flattened-pillow folded envelope cross-section with creased left/right paper edges,
 * thin 0.0085 walls, a subtle stepped vertical lap ridge on the front-left, a closed folded bottom,
 * and an open hollow top mouth whose back lip rises slightly taller than the front lip so the incense
 * stick sits cleanly inside the hollow paper pocket with zero intersection.
 */
function createIncenseSleeveGeometry(): THREE.BufferGeometry {
  const segS = 48 // CCW perimeter loop: 0..24 front (-X -> +X), 24..48 back (+X -> -X)
  const segV = 18
  const stride = segS + 1
  const gridVerts = (segS + 1) * (segV + 1)

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const halfW = 0.295
  const yBot = -0.305
  const zCenter = -0.020 // In paper-space: +0.035 - 0.020 = +0.015 (stick at z_paper = 0 -> z_local = -0.035).
  const wallT = 0.0082

  const outerPts: [number, number, number][] = new Array(gridVerts)
  const innerPts: [number, number, number][] = new Array(gridVerts)
  const outShades: number[] = new Array(gridVerts)
  const inShades: number[] = new Array(gridVerts)
  const outU: number[] = new Array(segS + 1)

  for (let is = 0; is <= segS; is++) {
    const s = is / segS // 0..0.5 front (-X -> +X), 0.5..1 back (+X -> -X)
    const isFront = s <= 0.5
    const f = isFront ? s * 2 : (s - 0.5) * 2 // 0..1 along half-side
    // Map UV: front [0..0.50], back [0.50..0.84].
    outU[is] = isFront ? f * 0.495 : 0.505 + f * 0.335
  }

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV
    const taper = THREE.MathUtils.lerp(1.005, 0.992, v)
    // Open slightly more at the middle/top mouth while pressing flatter along the folded bottom seam.
    const mouthOpen = THREE.MathUtils.lerp(0.68, 1.0, Math.pow(v, 0.55))
    const cuffExtra = THREE.MathUtils.smoothstep(v, 0.89, 0.92) * 0.0020

    for (let is = 0; is <= segS; is++) {
      const s = is / segS
      const isFront = s <= 0.5
      const f = isFront ? s * 2 : (s - 0.5) * 2
      // x goes -halfW -> +halfW on front, +halfW -> -halfW on back (CCW viewed from +Y).
      const xNorm = isFront ? f * 2 - 1 : 1 - f * 2
      const x = xNorm * halfW * taper

      // Flattened-pillow cross-section: crisp thin folded side creases at |xNorm|=1, gently open pocket around center.
      const arch = Math.pow(Math.max(0, 1 - xNorm * xNorm), 0.62)
      const halfD = (0.011 + 0.046 * arch) * mouthOpen
      // Subtle real stepped vertical paper lap ridge on the front left (around x = -0.21).
      const lapBump = isFront ? 0.0024 * THREE.MathUtils.smoothstep(-0.206 - x, 0, 0.014) : 0
      const zSign = isFront ? 1 : -1
      const zOut = zCenter + zSign * (halfD + lapBump)
      const zIn = zCenter + zSign * Math.max(0.0035, halfD - wallT - cuffExtra)

      // Back lip rises 1.4cm taller than the subtly dipped front mouth so the hollow opening reads immediately.
      const frontMouthDip = isFront ? -0.012 - 0.007 * Math.pow(Math.max(0, 1 - xNorm * xNorm), 1.4) : 0.004
      const yTop = 0.305 + frontMouthDip
      const y = THREE.MathUtils.lerp(yBot, yTop, v)

      const xIn = x * (1 - (wallT / halfW) * (1 - 0.55 * arch))
      const edgeCreaseAO = 1 - 0.10 * Math.pow(Math.abs(xNorm), 6)
      const botFoldAO = 1 - 0.09 * Math.pow(1 - v, 7)
      const inDepthShade = THREE.MathUtils.lerp(0.34, 0.94, Math.pow(v, 1.35))

      const idx = iv * stride + is
      outerPts[idx] = [x, y, zOut]
      innerPts[idx] = [xIn, Math.max(yBot + 0.010, y), zIn]
      outShades[idx] = edgeCreaseAO * botFoldAO
      inShades[idx] = inDepthShade
    }
  }

  // 1. Outer sleeve surface (0 .. gridVerts - 1).
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV
    for (let is = 0; is <= segS; is++) {
      const idx = iv * stride + is
      const p = outerPts[idx]!
      const sh = outShades[idx]!
      positions.push(p[0], p[1], p[2])
      uvs.push(outU[is]!, v)
      colors.push(sh, sh, sh)
    }
  }
  for (let iv = 0; iv < segV; iv++) {
    for (let is = 0; is < segS; is++) {
      const a = iv * stride + is
      const b = a + 1
      const c = a + stride + 1
      const d = a + stride
      indices.push(a, b, c, a, c, d)
    }
  }

  // 2. Inner hollow pocket lining (gridVerts .. 2 * gridVerts - 1).
  const inBase = gridVerts
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV
    for (let is = 0; is <= segS; is++) {
      const idx = iv * stride + is
      const p = innerPts[idx]!
      const sh = inShades[idx]!
      positions.push(p[0], p[1], p[2])
      uvs.push(0.87 + (is / segS) * 0.11, v)
      colors.push(sh, sh, sh)
    }
  }
  for (let iv = 0; iv < segV; iv++) {
    for (let is = 0; is < segS; is++) {
      const a = inBase + iv * stride + is
      const b = a + 1
      const c = a + stride + 1
      const d = a + stride
      indices.push(a, c, b, a, d, c)
    }
  }

  // 3. Crisp thin folded top open mouth rim connecting outer top ring to inner top ring (+Y normal).
  for (let is = 0; is < segS; is++) {
    const i0 = segV * stride + is
    const i1 = i0 + 1
    const o0 = outerPts[i0]!, o1 = outerPts[i1]!, n1 = innerPts[i1]!, n0 = innerPts[i0]!
    const base = positions.length / 3
    positions.push(
      o0[0], o0[1], o0[2],
      o1[0], o1[1], o1[2],
      n1[0], n1[1], n1[2],
      n0[0], n0[1], n0[2],
    )
    uvs.push(0.90, 0.98, 0.94, 0.98, 0.94, 0.96, 0.90, 0.96)
    colors.push(0.98, 0.98, 0.98, 0.98, 0.98, 0.98, 0.92, 0.92, 0.92, 0.92, 0.92, 0.92)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  // 4. Closed outer bottom fold (-Y normal) & inner pocket floor (+Y normal).
  const botCenterIdx = positions.length / 3
  positions.push(0, yBot, zCenter)
  uvs.push(0.65, 0.02)
  colors.push(0.86, 0.86, 0.86)
  for (let is = 0; is <= segS; is++) {
    const p = outerPts[is]!
    positions.push(p[0], p[1], p[2])
    uvs.push(outU[is]!, 0.01)
    colors.push(0.86, 0.86, 0.86)
  }
  for (let is = 0; is < segS; is++) {
    indices.push(botCenterIdx, botCenterIdx + 1 + is + 1, botCenterIdx + 1 + is)
  }

  const floorCenterIdx = positions.length / 3
  positions.push(0, yBot + 0.010, zCenter)
  uvs.push(0.92, 0.05)
  colors.push(0.30, 0.30, 0.30)
  for (let is = 0; is <= segS; is++) {
    const p = innerPts[is]!
    positions.push(p[0], p[1], p[2])
    uvs.push(0.92, 0.05)
    colors.push(0.32, 0.32, 0.32)
  }
  for (let is = 0; is < segS; is++) {
    indices.push(floorCenterIdx, floorCenterIdx + 1 + is, floorCenterIdx + 1 + is + 1)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Original ceramic still life: a cultural tribute, without an altar, deity or ancestral rite. */
export function createChineseIncense(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0
  let dragging = false, maxTravel = 0, placement: Placement | null = null, inactiveRendered = false, elapsed = 0
  let stopResize = () => {}
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.lidAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'chinese-incense', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff2dd, ground: 0xb1bbac, key: 0xffe4c5, rim: 0xd8e9df,
    keyPosition: [-3, 5, 3], keyIntensity: 1.25, rimIntensity: .45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .025
  const world = new THREE.Group(); world.name = 'incense-world'; scene.add(world)
  const material = (color: number, roughness = .86) => new THREE.MeshStandardMaterial({ color, roughness })
  const jade = material(0x9db9a8, .66), jadeLight = material(0xc0d2bd, .71), jadeDark = material(0x718d7c)
  const clay = material(0xba9676), cream = material(0xf0e2c3)
  const makeIncenseWood = (
    spec: IncenseWoodSpec,
    opts: { axis: 'x' | 'y' | 'z'; roughness: number; clearcoat?: number; clearcoatRoughness?: number; bumpScale: number; scale?: number; strength?: number },
  ) => {
    const tex = createIncenseWoodTextures(spec)
    const mat = opts.clearcoat
      ? new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: tex.map,
        bumpMap: tex.bump,
        bumpScale: opts.bumpScale,
        roughness: opts.roughness,
        metalness: 0,
        clearcoat: opts.clearcoat,
        clearcoatRoughness: opts.clearcoatRoughness ?? .38,
        envMapIntensity: .74,
      })
      : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex.map,
        bumpMap: tex.bump,
        bumpScale: opts.bumpScale,
        roughness: opts.roughness,
        metalness: 0,
      })
    const release = () => {
      mat.removeEventListener('dispose', release)
      tex.map.dispose()
      tex.bump.dispose()
    }
    mat.addEventListener('dispose', release)
    return applyCraftSurface(mat, { kind: 'wood', axis: opts.axis, scale: opts.scale ?? .62, strength: opts.strength ?? .14 })
  }
  // Distinct warm elm/walnut differentiation: flowing single-slab honey-elm tabletop with sparse visible knots,
  // deeper smoked-elm apron, two subtly varied walnut-elm vertical legs, and rich oiled dark-walnut incense tray.
  const woodLight = makeIncenseWood(
    {
      key: 'incense-table-top-v4',
      light: [198, 154, 106],
      dark: [152, 108, 66],
      warm: [212, 170, 120],
      knot: [108, 70, 38],
      orientation: 'u',
      rings: 6.8,
      spread: 0.50,
      arch: .60,
      wobble: .96,
      cathedrals: [
        { along: 0.28, across: 0.22, widthAlong: 0.24, widthAcross: 0.22, lift: 1.95 },
        { along: 0.78, across: 0.72, widthAlong: 0.24, widthAcross: 0.22, lift: -1.55 },
      ],
      knots: [
        // Unobstructed front-left & front-center-left elm tabletop zones (v near 0.08..0.20 is front edge +Z).
        { along: 0.16, across: 0.13, ra: 0.042, rc: 0.030, deflect: 0.98, depth: 0.82, tilt: 0.08 },
        { along: 0.36, across: 0.18, ra: 0.034, rc: 0.024, deflect: 0.82, depth: 0.74, tilt: -0.07 },
        { along: 0.86, across: 0.80, ra: 0.038, rc: 0.028, deflect: 0.80, depth: 0.76, tilt: 0.05 },
      ],
      repeat: [.96, .94],
      offset: [.02, .02],
      seed: 23,
    },
    { axis: 'x', roughness: .68, bumpScale: .0024, scale: .42, strength: .11 },
  )
  const wood = makeIncenseWood(
    {
      key: 'incense-table-apron-v3',
      light: [152, 110, 74],
      dark: [108, 72, 42],
      warm: [166, 124, 86],
      orientation: 'u',
      rings: 5.2,
      spread: 0.42,
      arch: .36,
      wobble: .58,
      repeat: [1.0, .45],
      seed: 37,
    },
    { axis: 'x', roughness: .72, bumpScale: .0022, scale: .68, strength: .16 },
  )
  const woodLegA = makeIncenseWood(
    {
      key: 'incense-table-leg-a-v3',
      light: [142, 100, 66],
      dark: [96, 62, 36],
      warm: [156, 114, 78],
      knot: [70, 42, 22],
      orientation: 'v',
      rings: 5.8,
      spread: 0.40,
      arch: .32,
      wobble: .56,
      knots: [{ along: 0.48, across: 0.48, ra: 0.055, rc: 0.045, deflect: 0.76, depth: 0.78 }],
      repeat: [.68, 1.0],
      seed: 53,
    },
    { axis: 'y', roughness: .72, bumpScale: .0022, scale: 1.08, strength: .22 },
  )
  const woodLegB = makeIncenseWood(
    {
      key: 'incense-table-leg-b-v3',
      light: [152, 108, 72],
      dark: [104, 68, 40],
      warm: [166, 122, 84],
      knot: [76, 46, 24],
      orientation: 'v',
      rings: 6.4,
      spread: 0.44,
      arch: .36,
      wobble: .62,
      knots: [{ along: 0.62, across: 0.42, ra: 0.048, rc: 0.040, deflect: 0.72, depth: 0.76 }],
      repeat: [.74, .96],
      offset: [.26, .18],
      seed: 59,
    },
    { axis: 'y', roughness: .72, bumpScale: .0022, scale: 1.24, strength: .22 },
  )
  const woodGrainInlay = applyCraftSurface(material(0x9e744c, .74), { kind: 'wood', axis: 'x', scale: .78, strength: .14 })
  const woodTray = makeIncenseWood(
    {
      key: 'incense-wood-tray-v3',
      light: [132, 88, 56],
      dark: [84, 50, 30],
      warm: [148, 102, 66],
      knot: [58, 32, 18],
      orientation: 'u',
      rings: 7.2,
      spread: 0.46,
      arch: .52,
      wobble: .84,
      cathedrals: [{ along: 0.42, across: 0.24, widthAlong: 0.26, widthAcross: 0.24, lift: 1.55 }],
      knots: [{ along: 0.76, across: 0.16, ra: 0.058, rc: 0.038, deflect: 0.92, depth: 0.88, tilt: -0.06 }],
      repeat: [.94, .88],
      offset: [.02, .02],
      seed: 67,
    },
    { axis: 'x', roughness: .56, clearcoat: .18, clearcoatRoughness: .38, bumpScale: .0024, scale: .94, strength: .15 },
  )
  const sleevePrintMap = createIncenseSleevePrintMap(512, 256)
  const paperMat = createRitualMaterial({
    color: 0xffffff,
    map: sleevePrintMap,
    roughness: 0.96,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.26,
    fiber: 'paper',
    paper: { layout: 'sheet', aspect: 1.9, grainScale: 2.6, grain: 0.98, fibers: 0.16, edge: 0.34, highlightGuard: 0.86 },
  })
  const releaseSleeveMap = () => {
    paperMat.removeEventListener('dispose', releaseSleeveMap)
    sleevePrintMap.dispose()
  }
  paperMat.addEventListener('dispose', releaseSleeveMap)
  const stickMat = material(0x88624c), bamboo = material(0xcbab73)
  const ash = material(0xd4c9b3), dark = material(0x625f50), teaMat = createRitualMaterial({ color: 0x8f713e, roughness: .3, transmission: .18, attenuationColor: 0x8f713e, attenuationDistance: .15 }, { kind: 'tea', thickness: .012, strength: .22 })
  const emberMat = new THREE.MeshStandardMaterial({ color: 0xd96b38, emissive: 0xff5a1f, emissiveIntensity: 1.35, roughness: .9 })
  // Cream/clay also appear in ash, paper printing and the woven pad.
  const matFabric = applyCraftSurface(cream.clone(), { kind: 'fabric', strength: .25 })
  const matThread = applyCraftSurface(clay.clone(), { kind: 'fabric', strength: .25 })
  const creamCeramic = applyCraftSurface(cream.clone(), { kind: 'ceramic', strength: .45 })
  const jadeCenserBody = applyCraftSurface(material(0x9db9a8, .66), { kind: 'ceramic', strength: .45 })
  jadeCenserBody.vertexColors = true
  const creamCupBody = applyCraftSurface(cream.clone(), { kind: 'ceramic', strength: .45 })
  creamCupBody.vertexColors = true
  ;[jade, jadeLight, jadeDark, clay, dark].forEach(mat => applyCraftSurface(mat, { kind: 'ceramic', strength: .45 }))
  applyCraftSurface(bamboo, { kind: 'bamboo', strength: .35, axis: 'y' })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world, name = '') => {
    const mesh = new THREE.Mesh(geo, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const sphere = new THREE.SphereGeometry(1, 28, 18)
  const pebble = (p: [number, number, number], scale: [number, number, number], mat: THREE.Material, parent: THREE.Object3D, name = '') => {
    const mesh = add(sphere, mat, p, parent, name); mesh.scale.set(...scale); return mesh
  }
  const lathe = (points: number[][], mat: THREE.Material, parent: THREE.Object3D, name: string) =>
    add(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 64), mat, [0, 0, 0], parent, name)
  const ring = (radius: number, thickness: number, p: [number, number, number], mat: THREE.Material, parent: THREE.Object3D = world) => {
    const mesh = add(new THREE.TorusGeometry(radius, thickness, 8, 56), mat, p, parent); mesh.rotation.x = Math.PI / 2; return mesh
  }
  const tube = (points: THREE.Vector3[], thickness: number, mat: THREE.Material, parent: THREE.Object3D, name = '') => {
    const mesh = add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, thickness, 7, false), mat, [0, 0, 0], parent, name)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }

  const floorY = getEnvironmentSurfaceY('chinese-incense')
  const table = new THREE.Group(); table.name = 'incense-table'; world.add(table)
  add(new RoundedBoxGeometry(3.25, .14, 1.8, 4, .085), woodLight, [0, .48, 0], table)
  const legH = .44 - floorY
  for (const x of [-1.22, 1.22]) for (const z of [-.58, .58]) {
    const foot = add(new RoundedBoxGeometry(.18, legH, .18, 3, .045), (x < 0) === (z > 0) ? woodLegA : woodLegB, [x, floorY + legH / 2, z], table)
    foot.rotation.z = x > 0 ? -.025 : .025
  }
  for (const z of [-.64, .64]) add(new RoundedBoxGeometry(2.64, .16, .08, 3, .025), wood, [0, .38, z], table)
  for (const z of [-.45, -.06, .33]) {
    tube([new THREE.Vector3(-1.40, .553, z), new THREE.Vector3(-.6, .553, z + .023), new THREE.Vector3(.25, .553, z - .012), new THREE.Vector3(1.40, .553, z + .008)], .004, woodGrainInlay, table)
  }
  const shadow = add(new THREE.PlaneGeometry(3.9, 2.5), new THREE.ShadowMaterial({ opacity: .12 }), [0, floorY + .001, 0])
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  const mat = add(new RoundedBoxGeometry(1.51, .025, 1.34, 4, .13), matFabric, [.12, .565, -.22], world, 'incense-woven-mat')
  mat.userData.toonSurface = { outline: false }
  for (let i = 0; i < 15; i++) {
    const thread = add(new THREE.BoxGeometry(.006, .003, 1.12), matThread, [-.51 + i * .09, .580, -.22]); thread.userData.toonSurface = { outline: false }
  }

  const censer = new THREE.Group(); censer.name = 'incense-censer'; censer.position.set(.12, .78, -.22); world.add(censer)
  const feet = new THREE.Group(); feet.name = 'incense-three-feet'; censer.add(feet)
  // Three rounded lobes belong to the vessel itself, grounded at the tabletop.
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI / 2 + i * Math.PI * 2 / 3
    const foot = pebble([Math.cos(angle) * .35, -.09, Math.sin(angle) * .35], [.13, .14, .13], jadeDark, feet, `incense-foot-${i + 1}`)
    foot.rotation.y = -angle
  }
  const body = lathe([[0, .015], [.20, .015], [.36, .045], [.47, .13], [.56, .29], [.574, .40], [.55, .48], [.49, .55],
    [.495, .60], [.52, .62], [.52, .65], [.47, .655], [.448, .62], [.45, .55], [.494, .45], [.51, .36], [.46, .20], [.33, .115], [0, .10]], jadeCenserBody, censer, 'incense-censer-body')
  bakeCreviceAO(body.geometry, { groundY: .015, groundRange: .16, cavityCenter: [0, 0], cavityRadius: .51, cavityTopY: .655, strength: .36 })
  ring(.505, .025, [0, .635, 0], jadeLight, censer)
  ring(.352, .012, [0, .085, 0], clay, censer)
  // Two restrained scroll ears are ceramic handles, not an inherited pot silhouette.
  for (const side of [-1, 1]) {
    tube([new THREE.Vector3(side * .51, .36, -.01), new THREE.Vector3(side * .67, .38, -.015), new THREE.Vector3(side * .71, .52, -.018), new THREE.Vector3(side * .64, .57, -.02), new THREE.Vector3(side * .56, .50, -.02)], .044, jadeLight, censer, `incense-scroll-ear-${side}`)
  }
  const sand = add(new THREE.CylinderGeometry(.44, .42, .035, 56), ash, [0, .572, 0], censer, 'incense-ash-bed')
  sand.userData.toonSurface = { outline: false }
  for (let i = 0; i < 5; i++) ring(.18 + i * .041, .003, [0, .592, 0], cream, censer).userData.toonSurface = { outline: false }
  // A recessed, broad ceramic socket is visibly dark and physically hittable through its opening.
  const socket = add(new THREE.CylinderGeometry(.165, .165, .018, 40), dark, [0, .605, 0], censer, 'incense-socket')
  ring(.182, .025, [0, .608, 0], jadeLight, censer)

  const lid = new THREE.Group(); lid.name = 'incense-lid'; world.add(lid)
  lathe([[0, .165], [.12, .155], [.29, .125], [.43, .065], [.52, .027], [.53, .006], [.51, 0], [.42, .035], [.28, .083], [.12, .119], [0, .125]], jade, lid, 'incense-lid-dome')
  ring(.512, .014, [0, .016, 0], jadeLight, lid)
  const knob = pebble([0, .30, 0], [.22, .215, .22], jadeLight, lid, 'incense-lid-knob')
  ring(.12, .017, [0, .147, 0], clay, lid)
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2, dot = pebble([Math.cos(angle) * .342, .105, Math.sin(angle) * .342], [.018, .008, .026], jadeDark, lid)
    dot.rotation.y = -angle; dot.userData.toonSurface = { outline: false }
  }
  const rest = add(new THREE.CylinderGeometry(.58, .54, .06, 56), creamCeramic, [1.035, .58, .36], world, 'incense-lid-rest')
  ring(.566, .012, [1.035, .605, .36], clay)

  const paper = new THREE.Group(); paper.name = 'incense-paper-holder'; world.add(paper)
  // Hollow folded paper sleeve cradling the fine incense stick; front lap seam, cream top cuff,
  // and minimalist sprig are printed directly into handmade terracotta paper fiber tooth.
  const grip = add(createIncenseSleeveGeometry(), paperMat, [0, .315, .035], paper, 'incense-paper-grip')
  grip.userData.toonSurface = { shading: 'smooth' }
  const tray = add(new RoundedBoxGeometry(.70, .045, .56, 4, .10), woodTray, [-1, .5725, .22], world, 'incense-stick-tray')
  tray.userData.toonSurface = { outline: false }
  const stick = new THREE.Group(); stick.name = 'incense-stick'; world.add(stick)
  add(new THREE.CylinderGeometry(.018, .018, .25, 12), bamboo, [0, .125, 0], stick, 'incense-stick-base')
  const foot = new THREE.Object3D(); foot.name = 'incense-stick-foot'; stick.add(foot)
  add(new THREE.CylinderGeometry(.022, .022, .80, 14), stickMat, [0, .65, 0], stick, 'incense-fine-stick')
  const ember = pebble([0, 1.055, 0], [.023, .026, .023], emberMat, stick, 'incense-ember')
  const smoke = new THREE.Group(); smoke.name = 'incense-smoke'; smoke.position.set(.12, 2.465, -.22); world.add(smoke)
  const incensePlume = createSoftPlume({ kind: 'incense', height: .72, width: .085, opacity: .46, strands: 2, wisps: 4, seed: 17 })
  smoke.add(incensePlume.root)

  const tea = new THREE.Group(); tea.name = 'incense-tea'; tea.position.set(-.04, .55, .64); world.add(tea)
  const saucer = add(new THREE.CylinderGeometry(.29, .26, .038, 48), jadeLight, [0, .022, 0], tea, 'incense-tea-saucer')
  ring(.276, .012, [0, .043, 0], creamCeramic, tea)
  const cup = new THREE.Group(); cup.name = 'incense-teacup'; cup.position.set(0, .04, -.075); tea.add(cup)
  const cupBody = lathe([[0, 0], [.11, 0], [.14, .03], [.184, .13], [.191, .20], [.177, .21], [.167, .18], [.14, .065], [.09, .035], [0, .035]], creamCupBody, cup, 'incense-teacup-body')
  bakeCreviceAO(cupBody.geometry, { groundY: 0, groundRange: .06, cavityCenter: [0, 0], cavityRadius: .172, cavityTopY: .21, strength: .36 })
  ring(.181, .009, [0, .202, 0], clay, cup)
  add(new THREE.CylinderGeometry(.164, .151, .012, 40), teaMat, [0, .174, 0], cup, 'incense-tea-surface')
  const teaPlume = createSoftPlume({ kind: 'steam', height: .22, width: .09, opacity: .22, strands: 2, wisps: 5, seed: 31 })
  teaPlume.root.position.set(-.04, .775, .565); world.add(teaPlume.root)

  addContactShadow(world, { prefix: 'incense-table', width: 3.15, depth: 1.72, y: floorY + .002, shape: 'rounded-rect', opacity: .22 })
  addContactShadow(world, { prefix: 'incense-censer', width: 1.02, depth: 1.02, y: .582, center: [.12, -.22], shape: 'ellipse', opacity: .24 })
  addContactShadow(world, { prefix: 'incense-lid-rest', width: 1.24, depth: 1.24, y: .552, center: [1.035, .36], shape: 'ellipse', opacity: .22 })
  addContactShadow(world, { prefix: 'incense-tea-saucer', width: .66, depth: .66, y: .552, center: [-.04, .64], shape: 'ellipse', opacity: .22 })
  addContactShadow(world, { prefix: 'incense-stick-tray', width: .78, depth: .64, y: .552, center: [-1, .22], shape: 'rounded-rect', opacity: .22 })

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  function pose() {
    lid.position.copy(checkpoint >= 1 ? LID_REST : LID_HOME)
    stick.position.copy(checkpoint >= 2 ? STICK_REST : STICK_HOME)
    paper.position.copy(STICK_HOME); paper.rotation.set(0, 0, checkpoint >= 2 ? -.15 : 0)
    ember.visible = smoke.visible = checkpoint >= 2
    incensePlume.setIntensity(checkpoint >= 2 ? 1 : 0)
    emberMat.emissiveIntensity = checkpoint >= 2 ? 1.35 : 0
    matrices()
  }
  const source = () => checkpoint === 0 ? knob : checkpoint === 1 ? grip : saucer
  const carried = () => checkpoint === 0 ? lid : stick
  const cueAt = (n: Checkpoint) => () => active() && !placement && checkpoint === n
  addInteractionCue(knob, { kind: 'drag', label: '拖圆钮移开炉盖', priority: 3, enabled: cueAt(0), destination: rest, targetLabel: '右侧盖托' })
  addInteractionCue(grip, { kind: 'drag', label: '握纸套安放细香', priority: 3, enabled: cueAt(1), destination: socket, targetLabel: '炉内香孔' })
  // The saucer's forward lip remains exposed below its teacup.
  addInteractionCue(saucer, { kind: 'tap', label: '轻点茶托看烟', anchor: [0, .019, .20], priority: 3, enabled: cueAt(2) })
  const quietObjects: THREE.Object3D[] = [saucer, body]
  cup.traverse(object => { if ((object as THREE.Mesh).isMesh) quietObjects.push(object) })
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(), dragPoint = new THREE.Vector3(), offset = new THREE.Vector3(), down = new THREE.Vector2()
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const placementReady = (x: number, y: number) => checkpoint < 2
    && !touch.occluded(x, y, checkpoint === 0 ? rest : socket, { ignore: checkpoint === 0 ? lid : [stick, paper] })
    && placementHit(canvas, camera, source(), x, y, (px, py) => touch.hit(px, py, checkpoint === 0 ? rest : socket, { ignore: checkpoint === 0 ? lid : [stick, paper] }))
  const resetDrag = () => { dropFeedback.clear(); dragging = false; maxTravel = 0; if (!placement) pose() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { matrices(); return !placement && checkpoint < 3 && touch.hit(x, y, checkpoint === 2 ? quietObjects : [source()]) },
    onStart(x, y) {
      down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare()
      if (dragging) {
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), source().getWorldPosition(new THREE.Vector3()))
        if (ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) offset.copy(carried().position).sub(dragPoint)
      }
    },
    onMove(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || checkpoint >= 2) return
      if (ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) {
        carried().position.copy(dragPoint).add(offset)
        carried().position.x = THREE.MathUtils.clamp(carried().position.x, -1.25, 1.25)
        carried().position.y = THREE.MathUtils.clamp(carried().position.y, .595, 1.65)
        if (checkpoint === 1) paper.position.copy(stick.position)
        matrices(); dropFeedback.setReady(placementReady(x, y))
      }
      if (checkpoint < 2 && placementReady(x,y) && pointer.finish()) { dragging = false; dropFeedback.clear(); beginPlacement(true) }
    },
    onRelease(x, y) {
      if (dragging && checkpoint < 2 && ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) {
        carried().position.copy(dragPoint).add(offset)
        carried().position.x = THREE.MathUtils.clamp(carried().position.x, -1.25, 1.25)
        carried().position.y = THREE.MathUtils.clamp(carried().position.y, .595, 1.65)
        if (checkpoint === 1) paper.position.copy(stick.position)
      }
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && placementReady(x, y)
        : checkpoint === 2 && maxTravel < 12 && touch.hit(x, y, quietObjects)
      dropFeedback.clear(); dragging = false
      if (valid) { if (checkpoint < 2) beginPlacement(); else finish() } else resetDrag()
    },
    onCancel: resetDrag,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: active, duration: 3, motion: 'glow',
    targets: () => [censer], cancelInput: () => pointer.cancel(), complete: () => finish() })
  function sync() {
    dropFeedback.clear()
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3
    ui.actionBtn.disabled = !active() || !!placement || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    ui.hitLayer.style.pointerEvents = checkpoint < 3 && !placement ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? COPY.lidAction : checkpoint === 1 ? COPY.incenseAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, placement ? placement.step === 0 ? COPY.movingLid : COPY.movingIncense
      : checkpoint === 0 ? COPY.lid : checkpoint === 1 ? COPY.incense : checkpoint === 2 ? ctx.returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    ending.sync(checkpoint === 2 && !placement)
  }
  function placed() {
    if (!active() || !placement) return
    checkpoint = (placement.step + 1) as Checkpoint; placement = null; pose(); sync(); ctx.onProgress?.(checkpoint)
    feedback.impact({
      freqs: checkpoint === 1 ? [330, 495] : [392, 587.33],
      duration: .20,
      gain: .014,
      type: 'triangle',
      cue: checkpoint === 1 ? 'ceramic' : 'woodTap',
      cueStrength: checkpoint === 1 ? .64 : .56,
    })
  }
  function beginPlacement(arrived = false) {
    if (!active() || (pointer.isBusy() && !arrived) || placement || checkpoint >= 2) return
    placement = { step: checkpoint as 0 | 1, time: 0, from: carried().position.clone(), paperFrom: paper.position.clone() }
    dragging = false; sync()
    if (placement.step === 1 && !reduced()) feedback.sound('paper', { duration: .22, strength: .36 })
    if (reduced()) placed()
  }
  function finish() {
    if (!active() || pointer.isBusy() || placement || checkpoint !== 2) return
    if (!ending.completing) return
    checkpoint = 3; pose(); sync(); if (disposed) return; ctx.onProgress?.(3)
    feedback.impact({ freqs: [330, 495], duration: .28, gain: .012, cue: 'ceramic', cueStrength: .50 })
    if (!active()) return; overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || placement || checkpoint === 3) return; feedback.prepare(); if (checkpoint < 2) beginPlacement(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 9)
    camera.position.set(0, 3.40 + boost * .34, 6.15 + boost); camera.lookAt(0, 1.18, 0); matrices()
  }
  pose(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      pose(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) {
        pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true')
        if (!inactiveRendered) { style.render(); inactiveRendered = true }
        return
      }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      feedback.update()
      if (placement) {
        placement.time = reduced() ? 1 : Math.min(1, placement.time + delta / .75)
        const t = placement.time, ease = smooth(t)
        const object = placement.step === 0 ? lid : stick, destination = placement.step === 0 ? LID_REST : STICK_REST
        object.position.lerpVectors(placement.from, destination, ease)
        if (!reduced()) object.position.y += Math.sin(t * Math.PI) * (placement.step === 0 ? .22 : .14)
        if (placement.step === 1) { paper.position.lerpVectors(placement.paperFrom, STICK_HOME, ease); paper.rotation.z = -.15 * ease }
        if (t === 1) placed()
      }
      if (!reduced()) elapsed += delta
      if (checkpoint >= 2) {
        emberMat.emissiveIntensity = reduced() ? 1.35 : 1.35 + .25 * Math.sin(elapsed * 2.8)
        incensePlume.setIntensity(1)
        incensePlume.update(delta, camera, { reducedMotion: reduced(), scene })
      } else {
        incensePlume.setIntensity(0)
      }
      teaPlume.update(delta, camera, { reducedMotion: reduced(), scene })
      ending.update(dt)
      if (disposed || !active()) return
      style.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose()
      disposed = true; dropFeedback.dispose(); pointer.dispose(); stopResize(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); incensePlume.dispose(); teaPlume.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose())
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
