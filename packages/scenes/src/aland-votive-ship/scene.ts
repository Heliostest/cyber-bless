import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { placementHit } from '../placement-hit'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '舟模寄谢', mastAction: '立好桅杆', cradleAction: '把舟模放上船架', quietAction: '轻点舟模细看',
  mast: '握住桅杆下端的木握柄，拖到船身的金色桅座。',
  cradle: '握住甲板前侧的木把手，把舟模移到船架前端的暖色木扣。',
  quiet: '轻点舟模静看，留一份对平安归来的珍惜与感谢。',
  returning: '轻点船架上的舟模，再看这份记录航海记忆的小景。',
  masting: '桅杆缓缓落入桅座，帆与索具随之就位…', placing: '舟模缓缓移向船架，船腹落入承托…', done: '舟模已在船架上放稳，留一份对平安归来的珍惜与感谢。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const HOME = new THREE.Vector3(-.12, 1, .38), SEATED = new THREE.Vector3(.42, 1.16, -.35)
const MAST_HOME = new THREE.Vector3(-1.4, .80, .45), MAST_SEAT = new THREE.Vector3(0, .30, .19)
const ease = (t: number) => t * t * (3 - 2 * t)

const SAIL_ROWS = 18
const SAIL_COLS = 24
const SAIL_SEAM_VS = [6 / 18, 12 / 18] as const

const _pt = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _prevTan = new THREE.Vector3()
const _norm = new THREE.Vector3()
const _binorm = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _refZ = new THREE.Vector3(0, 0, 1)
const _refY = new THREE.Vector3(0, 1, 0)
const _seamN = new THREE.Vector3()

/**
 * Deterministic woven linen sailcloth texture (no DOM/Canvas2D dependency):
 * fine warp/weft canvas grain, stitched horizontal panel lap shading at v=0.33/0.66,
 * and corner reinforcement gussets while preserving the warm cream #eee2bd palette.
 */
function createSailClothTexture(): THREE.DataTexture {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1)
    const weft = Math.sin(y * Math.PI * .78)
    const weftSlub = Math.sin(y * .37 + .9) * .55 + Math.sin(y * 1.11) * .45
    // Subtle lap-seam shadow along the two horizontal sail cloth panels.
    const seamBand =
      Math.exp(-(((v - .33) / .016) ** 2)) +
      Math.exp(-(((v - .66) / .016) ** 2))
    const seamEdge =
      Math.exp(-(((v - .342) / .008) ** 2)) +
      Math.exp(-(((v - .672) / .008) ** 2))
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1)
      const warp = Math.sin(x * Math.PI * .78)
      const warpSlub = Math.sin(x * .41 + 1.7) * .55 + Math.sin(x * 1.03) * .45
      const checker = ((x + y) & 1) ? 1 : -1
      const weave = (warp + weft) * 3.1 + checker * 1.8 + (warpSlub + weftSlub) * 1.6

      // Triangular double-cloth corner reinforcement patches at tack, clew, throat and peak.
      const dTack = Math.hypot(u, v)
      const dClew = Math.hypot(1 - u, v)
      const dThroat = Math.hypot(u, 1 - v)
      const dPeak = Math.hypot(1 - u, 1 - v)
      const cornerDist = Math.min(dTack, dClew, dThroat, dPeak)
      const patch = 1 - THREE.MathUtils.smoothstep(cornerDist, .125, .148)
      const patchBorder = Math.exp(-(((cornerDist - .136) / .012) ** 2))

      // Subtle hem border fold shading along all four stitched edges.
      const edgeDist = Math.min(u, 1 - u, v, 1 - v)
      const hemShade = (1 - THREE.MathUtils.smoothstep(edgeDist, .018, .048)) * 9

      const shade = seamBand * 11 - seamEdge * 3.5 + patch * 10 + patchBorder * 8 + hemShade
      const i = (y * size + x) * 4
      data[i] = THREE.MathUtils.clamp(Math.round(239 + weave - shade * .85), 182, 250)
      data[i + 1] = THREE.MathUtils.clamp(Math.round(227 + weave * .94 - shade * 1.02), 166, 242)
      data[i + 2] = THREE.MathUtils.clamp(Math.round(191 + weave * .84 - shade * 1.25), 132, 214)
      data[i + 3] = 255
    }
  }
  const map = new THREE.DataTexture(data, size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping
  map.magFilter = map.minFilter = THREE.LinearFilter
  map.needsUpdate = true
  return map
}

/**
 * Evaluates a point on the taut cambered sail membrane in `mast` local coordinates.
 * Luff (u=0), foot (v=0), and head (v=1) remain pinned cleanly to spars/hoops/lashings
 * even during gentle harbor-breeze breathing; only belly and leech modulate slightly.
 */
function evalSailPoint(
  u: number,
  v: number,
  billowBoost: number,
  breezeAmp: number,
  breezePhase: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const width = .648 * (1 - .73 * v)
  const x = .042 + u * width
  const y = .326 + .712 * v
  const uCam = Math.sin(Math.PI * Math.pow(Math.max(0, u), .86))
  const vCam = Math.sin(Math.PI * v)
  // Slight inward tuck along stitched horizontal cloth-panel seams so seams seat naturally.
  const seamTuck =
    -.0022 * (Math.exp(-(((v - .33) / .028) ** 2)) + Math.exp(-(((v - .66) / .028) ** 2)))
  // Restrained taut-linen breeze swell + subtle leech shimmer (pinned at throat/tack/clew/peak).
  const bellyWave = breezeAmp > 0
    ? breezeAmp * .0075 * Math.sin(breezePhase * 2.1 + v * 1.5) * uCam * vCam
    : 0
  const leechRipple = breezeAmp > 0
    ? breezeAmp * .0048 * Math.sin(breezePhase * 3.2 - u * 3.0 + v * 2.4) * Math.pow(u, 1.35) * vCam
    : 0
  // Subtle linear spar-plane alignment between boom foot (z=0.024) and gaff head (z=0.025).
  const sparZ = .024 + .001 * v + .004 * u * (1 - v)
  const z = sparZ + (.062 + billowBoost) * uCam * vCam + seamTuck * uCam + bellyWave + leechRipple
  return out.set(x, y, z)
}

/**
 * Rewrites a pre-allocated TubeGeometry in-place using Bishop parallel-transport frames
 * and a subtle 2-ply twisted maritime cord profile (zero per-frame allocations).
 */
function writeTwistedCordInPlace(
  geometry: THREE.TubeGeometry,
  points: readonly THREE.Vector3[],
  options: { turns?: number; plyDepth?: number; phase?: number; capTaper?: boolean } = {},
): void {
  const { tubularSegments, radius, radialSegments } = geometry.parameters
  const turns = options.turns ?? 10
  const plyDepth = options.plyDepth ?? .13
  const phase = options.phase ?? 0
  const capTaper = options.capTaper ?? false
  const curve = geometry.parameters.path as THREE.CatmullRomCurve3
  if (curve.points.length !== points.length) {
    curve.points = points.map(p => p.clone())
  } else {
    for (let i = 0; i < points.length; i++) curve.points[i]!.copy(points[i]!)
  }
  curve.updateArcLengths()

  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute
  const ringStride = radialSegments + 1

  curve.getTangentAt(0, _prevTan).normalize()
  const ref = Math.abs(_prevTan.dot(_refZ)) < .92 ? _refZ : _refY
  _norm.crossVectors(ref, _prevTan).normalize()
  _binorm.crossVectors(_prevTan, _norm).normalize()

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    curve.getPointAt(u, _pt)
    if (i > 0) {
      curve.getTangentAt(u, _tan).normalize()
      const dot = THREE.MathUtils.clamp(_prevTan.dot(_tan), -1, 1)
      if (dot < .999999) {
        if (dot > -.999999) {
          _quat.setFromUnitVectors(_prevTan, _tan)
          _norm.applyQuaternion(_quat)
        }
        _norm.addScaledVector(_tan, -_norm.dot(_tan))
        if (_norm.lengthSq() > 1e-10) _norm.normalize()
      }
      _binorm.crossVectors(_tan, _norm).normalize()
      _prevTan.copy(_tan)
    }
    const twist = u * turns * Math.PI * 2 + phase
    let endScale = 1
    if (capTaper && (i === 0 || i === tubularSegments)) endScale = .72
    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2
      const r = radius * (1 + plyDepth * Math.cos(2 * (theta - twist))) * endScale
      const cx = -Math.cos(theta), sy = Math.sin(theta)
      const nx = _norm.x * cx + _binorm.x * sy
      const ny = _norm.y * cx + _binorm.y * sy
      const nz = _norm.z * cx + _binorm.z * sy
      posAttr.setXYZ(i * ringStride + j, _pt.x + nx * r, _pt.y + ny * r, _pt.z + nz * r)
    }
  }
  posAttr.needsUpdate = true
  geometry.computeVertexNormals()
  for (let i = 0; i <= tubularSegments; i++) {
    const a = i * ringStride, b = a + radialSegments
    _seamN.set(
      normAttr.getX(a) + normAttr.getX(b),
      normAttr.getY(a) + normAttr.getY(b),
      normAttr.getZ(a) + normAttr.getZ(b),
    )
    if (_seamN.lengthSq() > 1e-10) {
      _seamN.normalize()
      normAttr.setXYZ(a, _seamN.x, _seamN.y, _seamN.z)
      normAttr.setXYZ(b, _seamN.x, _seamN.y, _seamN.z)
    }
  }
  normAttr.needsUpdate = true
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

function woodHash(ix: number, iy: number, seed: number): number {
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
  const a = woodHash(x0, y0, seed), b = woodHash(x1, y0, seed)
  const c = woodHash(x0, y1, seed), d = woodHash(x1, y1, seed)
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy
}

function wrapPeriodicDelta(a: number, b: number): number {
  let d = a - b
  if (d > 0.5) d -= 1
  else if (d < -0.5) d += 1
  return d
}

type WoodCathedral = {
  along: number
  across: number
  widthAlong: number
  widthAcross: number
  lift: number
}

type WoodKnot = {
  along: number
  across: number
  ra: number
  rc: number
  deflect: number
  depth: number
  tilt?: number
}

type StylizedWoodSpec = {
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
  cathedrals?: readonly WoodCathedral[]
  knots?: readonly WoodKnot[]
  strakes?: number
  keelWarmth?: boolean
  repeat?: readonly [number, number]
  offset?: readonly [number, number]
  seed: number
}

const cachedShipWoodPixels = new Map<string, { color: Uint8Array; bump: Uint8Array; size: number }>()

/**
 * Deterministic stylized oiled-timber DataTexture (256x256, zero DOM/Canvas2D dependency):
 * non-uniform growth-ring spacing, flowing S-curves and cathedral arches, sparse stylized
 * wood knots ("木眼") with organic grain parting, and per-strake timber variation for the hull.
 */
function createStylizedWoodTextures(spec: StylizedWoodSpec): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 256
  let cached = cachedShipWoodPixels.get(spec.key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const knotRgb: readonly [number, number, number] = spec.knot ?? [
      Math.max(24, Math.round(spec.dark[0] * 0.72)),
      Math.max(18, Math.round(spec.dark[1] * 0.68)),
      Math.max(12, Math.round(spec.dark[2] * 0.65)),
    ]
    const phaseA = woodHash(spec.seed, 17, 3)
    const phaseB = woodHash(spec.seed, 29, 7)
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const along = spec.orientation === 'u' ? u : v
        const across = spec.orientation === 'u' ? v : u

        // Optional hull clinker/carvel plank strakes: give each plank its own flow phase and oiled timber tone.
        let strakeShade = 0
        let strakeTint = 0
        let plankAlong = along
        let plankSeedShift = 0
        if (spec.strakes) {
          const sp = across * spec.strakes
          const sIdx = Math.floor(sp)
          const sFrac = sp - sIdx
          const seam = Math.exp(-(((sFrac - 0.018) / 0.032) ** 2)) + Math.exp(-(((1 - sFrac) / 0.032) ** 2))
          const bevelGlow = Math.exp(-(((sFrac - 0.075) / 0.048) ** 2)) * 0.08
          strakeShade = Math.min(1, seam) * 0.30 - bevelGlow
          strakeTint = (woodHash(sIdx, 3, spec.seed + 91) - 0.5) * 0.42
          plankAlong = (along + woodHash(sIdx, 11, spec.seed + 97) * 0.73) % 1
          plankSeedShift = (woodHash(sIdx, 19, spec.seed + 103) - 0.5) * 0.55
        }

        // Monotonic non-uniform ring spacing breaks mechanical parallel stripes.
        const acrossVar = across
          + (spec.spread / tau) * Math.sin((across + phaseA) * tau)
          + ((spec.spread * 0.42) / tau) * Math.sin((across * 2 + phaseB) * tau)

        const wash = periodicWoodNoise(plankAlong * 2, across * 2, 2, 2, spec.seed + 11)
        const broadFlow = (periodicWoodNoise(plankAlong * 2, across * 2, 2, 2, spec.seed + 23) - 0.5) * spec.wobble
        const midFlow = (periodicWoodNoise(plankAlong * 3, across * 5, 3, 5, spec.seed + 37) - 0.5) * spec.wobble * 0.45
        const bow = Math.sin((plankAlong + phaseA) * tau) * spec.arch
          + Math.sin((plankAlong * 2 + phaseB) * tau) * spec.arch * 0.34

        let cathedralLift = 0
        if (spec.cathedrals) {
          for (const c of spec.cathedrals) {
            const da = wrapPeriodicDelta(along, c.along)
            const dc = wrapPeriodicDelta(across, c.across)
            const env = Math.exp(-((da / c.widthAlong) ** 2 + (dc / c.widthAcross) ** 2))
            cathedralLift += c.lift * env
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
              const kw = (periodicWoodNoise(along * 6, across * 6, 6, 6, spec.seed + 131 + ki * 17) - 0.5) * 0.14
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

        const ringPos = acrossVar * spec.rings + bow + broadFlow + midFlow + cathedralLift + knotDeflect + plankSeedShift
        const frac = ringPos - Math.floor(ringPos)
        // Asymmetric earlywood -> warm latewood sweep plus softer secondary harmonic band.
        const rampUp = THREE.MathUtils.smoothstep(frac, 0.07, 0.74)
        const rampDown = 1 - THREE.MathUtils.smoothstep(frac, 0.74, 0.98)
        const primaryRing = Math.pow(Math.min(rampUp, rampDown), 1.28)
        const secFrac = (ringPos * 2.0 + 0.28) - Math.floor(ringPos * 2.0 + 0.28)
        const secondaryRing = Math.pow(Math.min(THREE.MathUtils.smoothstep(secFrac, 0.12, 0.65), 1 - THREE.MathUtils.smoothstep(secFrac, 0.65, 0.96)), 1.6) * 0.22
        const softMod = 0.62 + 0.52 * periodicWoodNoise(plankAlong * 2, across * 3, 2, 3, spec.seed + 59)
        const fiber = periodicWoodNoise(plankAlong * 4, across * 28, 4, 28, spec.seed + 71) - 0.5

        // Subtle oiled-timber lower-hull depth near the keel (v ~ 0.5) and warm sheer highlight.
        const keelDepth = spec.keelWarmth ? (1 - Math.abs(across - 0.5) * 2) * 0.11 : 0

        const grainMix = THREE.MathUtils.clamp((primaryRing * 0.78 + secondaryRing) * softMod + fiber * 0.09 + strakeShade + keelDepth, 0, 1)
        const warmMix = THREE.MathUtils.clamp(wash * 0.50 + strakeTint + knotGlow, 0, 1)
        const baseR = THREE.MathUtils.lerp(spec.light[0], spec.warm[0], warmMix)
        const baseG = THREE.MathUtils.lerp(spec.light[1], spec.warm[1], warmMix)
        const baseB = THREE.MathUtils.lerp(spec.light[2], spec.warm[2], warmMix)

        const gR = THREE.MathUtils.lerp(baseR, spec.dark[0], grainMix)
        const gG = THREE.MathUtils.lerp(baseG, spec.dark[1], grainMix)
        const gB = THREE.MathUtils.lerp(baseB, spec.dark[2], grainMix)

        const i = (y * size + x) * 4
        color[i] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(gR, knotRgb[0], knotTone)), 0, 255)
        color[i + 1] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(gG, knotRgb[1], knotTone)), 0, 255)
        color[i + 2] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(gB, knotRgb[2], knotTone)), 0, 255)
        color[i + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 - primaryRing * 20 * softMod + fiber * 10 - strakeShade * 72 - knotTone * 22),
          56,
          196,
        )
        bump[i] = h; bump[i + 1] = h; bump[i + 2] = h; bump[i + 3] = 255
      }
    }
    cached = { color, bump, size }
    cachedShipWoodPixels.set(spec.key, cached)
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

/** A contemporary, original craft model; no church donation or sacrament is enacted. */
export function createAlandVotiveShip(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false
  let writer: GestureHandle | null = null, stopResize = () => {}
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  let dragging = false, travel = 0, breezeClock = 0, breezeGust = 0
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.mastAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'aland-votive-ship', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff1dd, ground: 0xb7b19a, key: 0xffe4bd, rim: 0xc8e0e5,
    keyPosition: [-3, 5, 4], keyIntensity: 1.2, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .025
  const world = new THREE.Group(); world.name = 'ship-workshop'; scene.add(world)
  const material = (color: number, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness })
  const makeWood = (
    spec: StylizedWoodSpec,
    opts: { axis: 'x' | 'y' | 'z'; roughness: number; clearcoat?: number; clearcoatRoughness?: number; bumpScale: number; scale?: number; strength?: number; side?: THREE.Side },
  ) => {
    const tex = createStylizedWoodTextures(spec)
    const mat = opts.clearcoat
      ? new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: tex.map,
        bumpMap: tex.bump,
        bumpScale: opts.bumpScale,
        roughness: opts.roughness,
        metalness: 0,
        clearcoat: opts.clearcoat,
        clearcoatRoughness: opts.clearcoatRoughness ?? .36,
        envMapIntensity: .84,
        side: opts.side ?? THREE.FrontSide,
      })
      : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex.map,
        bumpMap: tex.bump,
        bumpScale: opts.bumpScale,
        roughness: opts.roughness,
        metalness: 0,
        side: opts.side ?? THREE.FrontSide,
      })
    const release = () => {
      mat.removeEventListener('dispose', release)
      tex.map.dispose()
      tex.bump.dispose()
    }
    mat.addEventListener('dispose', release)
    return applyCraftSurface(mat, { kind: 'wood', axis: opts.axis, scale: opts.scale ?? .65, strength: opts.strength ?? .26 })
  }
  // Distinct stylized oiled/painted timber finishes with varied per-part grain scales, flowing cathedral
  // grain, and sparse stylized knots: luminous waxed amber-cedar hull planks, sunlit honey pine deck,
  // deep oiled walnut trim, distinct vertical larch mast vs horizontal spars, and rich walnut cradle.
  const hullWood = makeWood(
    {
      key: 'hull-cedar-v4',
      light: [222, 160, 98],
      dark: [146, 88, 46],
      warm: [236, 178, 116],
      knot: [106, 58, 28],
      orientation: 'u',
      rings: 11.8,
      spread: 0.40,
      arch: 0.34,
      wobble: 0.58,
      cathedrals: [
        { along: 0.48, across: 0.86, widthAlong: 0.26, widthAcross: 0.13, lift: 0.92 },
        { along: 0.22, across: 0.66, widthAlong: 0.24, widthAcross: 0.11, lift: -0.78 },
      ],
      knots: [
        // Two petite warm knots on the sunlit visible front (+Z) cedar flank above the cream stripe.
        { along: 0.29, across: 0.85, ra: 0.032, rc: 0.022, deflect: 0.72, depth: 0.76, tilt: 0.06 },
        { along: 0.73, across: 0.82, ra: 0.028, rc: 0.019, deflect: 0.64, depth: 0.72, tilt: -0.06 },
      ],
      strakes: 10,
      keelWarmth: true,
      seed: 13,
    },
    { axis: 'x', roughness: .52, clearcoat: .30, clearcoatRoughness: .32, bumpScale: .0028, scale: .44, strength: .14, side: THREE.DoubleSide },
  )
  const deckWood = makeWood(
    {
      key: 'deck-pine-v3',
      light: [224, 186, 128],
      dark: [172, 128, 76],
      warm: [235, 200, 146],
      knot: [128, 86, 46],
      orientation: 'u',
      rings: 7.4,
      spread: 0.36,
      arch: 0.42,
      wobble: 0.68,
      cathedrals: [{ along: 0.58, across: 0.46, widthAlong: 0.28, widthAcross: 0.24, lift: 1.20 }],
      knots: [{ along: 0.34, across: 0.56, ra: 0.042, rc: 0.028, deflect: 0.75, depth: 0.72, tilt: 0.05 }],
      strakes: 6,
      repeat: [.46, 1.08],
      offset: [.50, .50],
      seed: 29,
    },
    { axis: 'x', roughness: .66, bumpScale: .0018, scale: .82, strength: .14 },
  )
  const strakeWood = makeWood(
    { key: 'strake-cream-v3', light: [230, 198, 144], dark: [194, 156, 102], warm: [240, 210, 158], orientation: 'u', rings: 4.6, spread: 0.30, arch: .24, wobble: .36, seed: 41 },
    { axis: 'x', roughness: .58, bumpScale: .0014, scale: .78, strength: .14 },
  )
  const trimWood = makeWood(
    {
      key: 'trim-walnut-v3',
      light: [118, 74, 46],
      dark: [74, 42, 26],
      warm: [136, 88, 56],
      orientation: 'u',
      rings: 6.2,
      spread: 0.40,
      arch: .36,
      wobble: .54,
      seed: 53,
    },
    { axis: 'x', roughness: .50, clearcoat: .16, clearcoatRoughness: .38, bumpScale: .0022, scale: .92, strength: .16 },
  )
  const seamWood = applyCraftSurface(material(0x986d44, .72), { kind: 'wood', axis: 'z', scale: .85, strength: .16 })
  const mastWood = makeWood(
    {
      key: 'mast-larch-v3',
      light: [194, 138, 80],
      dark: [132, 82, 42],
      warm: [210, 156, 96],
      knot: [96, 56, 26],
      orientation: 'v',
      rings: 6.4,
      spread: 0.34,
      arch: .34,
      wobble: .56,
      knots: [{ along: 0.56, across: 0.44, ra: 0.055, rc: 0.032, deflect: 0.72, depth: 0.76 }],
      seed: 73,
    },
    { axis: 'y', roughness: .50, clearcoat: .30, clearcoatRoughness: .32, bumpScale: .0022, scale: 1.18, strength: .20 },
  )
  const sparWood = makeWood(
    {
      key: 'spar-larch-v3',
      light: [208, 156, 96],
      dark: [148, 98, 52],
      warm: [222, 170, 110],
      orientation: 'u',
      rings: 5.4,
      spread: 0.38,
      arch: .32,
      wobble: .52,
      seed: 83,
    },
    { axis: 'x', roughness: .54, clearcoat: .24, clearcoatRoughness: .36, bumpScale: .0020, scale: 1.02, strength: .18 },
  )
  const mastGripWood = makeWood(
    { key: 'grip-beech-v3', light: [216, 168, 110], dark: [162, 114, 66], warm: [228, 182, 124], orientation: 'v', rings: 6.0, spread: 0.36, arch: .30, wobble: .48, seed: 89 },
    { axis: 'y', roughness: .54, clearcoat: .16, clearcoatRoughness: .38, bumpScale: .0020, scale: 1.28, strength: .20 },
  )
  const cradleBaseWood = makeWood(
    {
      key: 'cradle-walnut-v4',
      light: [128, 84, 56],
      dark: [74, 44, 26],
      warm: [152, 106, 72],
      knot: [52, 28, 16],
      orientation: 'u',
      rings: 5.8,
      spread: 0.48,
      arch: .52,
      wobble: .84,
      cathedrals: [
        { along: 0.72, across: 0.36, widthAlong: 0.22, widthAcross: 0.24, lift: 1.65 },
        { along: 0.28, across: 0.68, widthAlong: 0.24, widthAcross: 0.22, lift: -1.35 },
      ],
      knots: [
        { along: 0.82, across: 0.24, ra: 0.054, rc: 0.042, deflect: 0.90, depth: 0.84, tilt: -0.08 },
        { along: 0.36, across: 0.28, ra: 0.046, rc: 0.036, deflect: 0.76, depth: 0.76, tilt: 0.06 },
      ],
      seed: 101,
    },
    { axis: 'x', roughness: .52, clearcoat: .20, clearcoatRoughness: .36, bumpScale: .0026, scale: .50, strength: .15 },
  )
  const cradlePostWood = makeWood(
    { key: 'cradle-post-oak-v3', light: [160, 112, 72], dark: [108, 68, 40], warm: [176, 128, 86], orientation: 'v', rings: 6.2, spread: 0.40, arch: .34, wobble: .58, seed: 109 },
    { axis: 'y', roughness: .58, bumpScale: .0022, scale: .96, strength: .22 },
  )
  const cradleSaddleWood = makeWood(
    { key: 'cradle-saddle-maple-v3', light: [210, 166, 112], dark: [158, 114, 68], warm: [222, 180, 126], orientation: 'u', rings: 5.6, spread: 0.34, arch: .28, wobble: .44, seed: 117 },
    { axis: 'z', roughness: .60, bumpScale: .0018, scale: .88, strength: .18 },
  )
  const cream = material(0xeee2bd), rope = material(0x5e594d, .90), teal = material(0x819d8d), brass = material(0xc6a467, .55)
  const cabinWood = applyCraftSurface(
    new THREE.MeshStandardMaterial({ color: 0x7a9a8b, roughness: .62, metalness: 0 }),
    { kind: 'wood', axis: 'x', scale: .80, strength: .24 },
  )
  // Split sail stitching, bolt-rope hem, lashing cord and felt from the ship's wood/metal paint palette.
  const sailSeam = material(0xc9a878, .88)
  const sailHem = material(0xc5a268, .86)
  const lashingCord = material(0x9a7d58, .90)
  const felt = teal.clone()
  applyCraftSurface(brass, { kind: 'metal', strength: .45 })
  applyCraftSurface(rope, { kind: 'cord', scale: 2.2, strength: .36 })
  applyCraftSurface(sailHem, { kind: 'cord', scale: 2.4, strength: .34 })
  applyCraftSurface(sailSeam, { kind: 'cord', scale: 2.6, strength: .30 })
  applyCraftSurface(lashingCord, { kind: 'cord', scale: 2.6, strength: .34 })
  applyCraftSurface(felt, { kind: 'fabric', strength: .25 })
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat: THREE.Material = hullWood, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.035, ...size.map(v => v / 3))), mat, p, parent)
  const oval = (name: string, p: [number, number, number], scale: [number, number, number], mat: THREE.Material, parent: THREE.Object3D = world) => {
    const m = add(name, new THREE.SphereGeometry(1, 24, 16), mat, p, parent); m.scale.set(...scale); return m
  }
  const line = (name: string, points: [number, number, number][], radius: number, mat: THREE.Material, parent: THREE.Object3D = world) => {
    const m = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 8, false), mat, [0, 0, 0], parent)
    m.userData.toonSurface = { outline: false }; return m
  }
  const twistedLine = (
    name: string,
    points: [number, number, number][],
    radius: number,
    mat: THREE.Material,
    parent: THREE.Object3D,
    options: { tubular?: number; radial?: number; turns?: number; plyDepth?: number; dynamic?: boolean; capTaper?: boolean } = {},
  ) => {
    const vecs = points.map(p => new THREE.Vector3(...p))
    const curve = new THREE.CatmullRomCurve3(vecs)
    const geometry = new THREE.TubeGeometry(curve, options.tubular ?? 28, radius, options.radial ?? 8, false)
    if (options.dynamic) {
      ;(geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
      ;(geometry.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
    }
    writeTwistedCordInPlace(geometry, vecs, { turns: options.turns ?? 10, plyDepth: options.plyDepth ?? .13, capTaper: options.capTaper })
    const m = add(name, geometry, mat, [0, 0, 0], parent)
    m.userData.toonSurface = { outline: false }
    return m as THREE.Mesh<THREE.TubeGeometry>
  }
  addCraftTable(world, { name: 'ship-table', topName: 'ship-table-top', width: 3.45, depth: 1.8, surfaceY: .745, thickness: .13, center: [-.1,0], support: 'trestle', finish: 'honey' })
  const shadow = add('ship-ground-shadow', new THREE.PlaneGeometry(4, 2.4), new THREE.ShadowMaterial({ opacity: .13 }), [0, getEnvironmentSurfaceY('aland-votive-ship') + .001, 0])
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false

  // Both work positions have real support: a soft keel rest and a two-post V cradle.
  box('ship-work-rest', [1.30, .035, .42], [-.12, .755, .38], felt)
  const cradle = new THREE.Group(); cradle.name = 'ship-two-post-cradle'; world.add(cradle)
  box('ship-cradle-base', [1.76, .065, .62], [.42, .777, -.35], cradleBaseWood, cradle)
  for (const x of [-.06, .90]) {
    box('ship-cradle-post', [.16, .12, .22], [x, .87, -.35], cradlePostWood, cradle)
    line('ship-cradle-saddle', [[x, 1.089, -.57], [x, .963, -.46], [x, .929, -.35], [x, .963, -.24], [x, 1.089, -.13]], .035, cradleSaddleWood, cradle)
    line('ship-cradle-felt', [[x, 1.105, -.57], [x, .979, -.46], [x, .945, -.35], [x, .979, -.24], [x, 1.105, -.13]], .019, felt, cradle)
  }
  const cradleTarget = oval('ship-cradle-target', [1.15, .836, -.09], [.115, .026, .10], brass, cradle)
  box('ship-loose-mast-rest', [.27, .055, .27], [-1.4, .773, .45], felt)

  const ship = new THREE.Group(); ship.name = 'ship-model'; world.add(ship)
  // Lofted bent hull: tapered ends, curved belly, raised sheer. This is not an elongated box.
  const vertices: number[] = [], hullUvs: number[] = [], indices: number[] = [], nx = 40, nt = 24
  for (let i = 0; i <= nx; i++) {
    const x = -1 + 2 * i / nx, width = .33 * Math.sqrt(Math.max(.0001, 1 - x * x))
    const bottom = -.24 + .39 * Math.pow(Math.abs(x), 3), top = .24 + .07 * x * x
    for (let j = 0; j <= nt; j++) {
      const angle = -Math.PI / 2 + Math.PI * j / nt
      vertices.push(x, bottom + (1 - Math.cos(angle)) * (top - bottom), Math.sin(angle) * width)
      hullUvs.push(i / nx, j / nt)
      if (i < nx && j < nt) { const n = i * (nt + 1) + j; indices.push(n, n + 1, n + nt + 1, n + 1, n + nt + 2, n + nt + 1) }
    }
  }
  const hullGeometry = new THREE.BufferGeometry()
  hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  hullGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(hullUvs, 2))
  hullGeometry.setIndex(indices); hullGeometry.computeVertexNormals()
  add('ship-curved-wooden-hull', hullGeometry, hullWood, [0, 0, 0], ship)
  const deckShape = new THREE.Shape(); deckShape.moveTo(-.99, 0); deckShape.bezierCurveTo(-.68, -.42, .69, -.42, .99, 0); deckShape.bezierCurveTo(.69, .42, -.68, .42, -.99, 0)
  const deck = add('ship-inlaid-deck', new THREE.ExtrudeGeometry(deckShape, { depth: .045, bevelEnabled: false, curveSegments: 24 }), deckWood, [0, .245, 0], ship)
  deck.rotation.x = Math.PI / 2
  for (const side of [-1, 1]) {
    line('ship-rounded-gunwale', [[-.98, .31, 0], [-.58, .275, side * .28], [0, .268, side * .32], [.58, .275, side * .28], [.98, .31, 0]], .023, trimWood, ship)
    line('ship-plank-stripe', [[-.91, .15, 0], [-.50, -.02, side * .29], [0, -.08, side * .28], [.50, -.02, side * .29], [.91, .15, 0]], .012, strakeWood, ship)
  }
  line('ship-keel', [[-.86, .05, 0], [-.47, -.21, 0], [0, -.24, 0], [.47, -.21, 0], [.86, .05, 0]], .024, trimWood, ship)
  for (const x of [-.66, -.42, -.19, .19, .42, .66]) line('ship-deck-seam', [[x, .248, -.19], [x, .248, .19]], .006, seamWood, ship)
  box('ship-cabin', [.35, .14, .28], [-.49, .325, -.055], cabinWood, ship)
  box('ship-cabin-roof', [.40, .055, .33], [-.49, .418, -.055], cream, ship)
  const socket = add('ship-mast-socket', new THREE.CylinderGeometry(.090, .090, .012, 28), cradleBaseWood, [0, .30, .19], ship)
  const collar = add('ship-mast-collar', new THREE.TorusGeometry(.110, .014, 12, 32), brass, [0, .315, .19], ship)
  collar.rotation.x = Math.PI / 2
  add('ship-mast-socket-housing', new THREE.CylinderGeometry(.110, .110, .06, 32, 1, true), brass, [0, .285, .19], ship)
  const handle = oval('ship-deck-handle', [.48, .31, .27], [.13, .065, .075], trimWood, ship)
  for (const x of [.40, .56]) box('ship-handle-foot', [.045, .06, .055], [x, .275, .25], trimWood, ship)
  line('ship-bowsprit', [[.79, .30, 0], [1.16, .40, 0]], .023, sparWood, ship)

  // Mast, boom, headyard/gaff, taut linen sail, flush stitched seams, bolt-rope hem & spar lashings.
  const mast = new THREE.Group(); mast.name = 'ship-mast-assembly'; world.add(mast)
  line('ship-mast-pole', [[0, 0, 0], [0, 1.12, 0]], .029, mastWood, mast)
  const grip = oval('ship-mast-grip', [0, .13, .09], [.095, .09, .085], mastGripWood, mast)
  line('ship-mast-grip-collar', [[-.06, .09, .04], [0, .07, .075], [.06, .09, .04]], .013, brass, mast)
  line('ship-boom', [[-.025, .30, 0], [.69, .30, .026]], .024, sparWood, mast)
  // Slim wooden head spar (gaff) seated cleanly at the sail head with brass jaws at the mast.
  line('ship-gaff', [[.018, 1.046, .014], [.225, 1.046, .026]], .015, sparWood, mast)
  const gaffJaw = add('ship-gaff-collar', new THREE.TorusGeometry(.035, .007, 8, 20), brass, [0, 1.046, 0], mast)
  gaffJaw.rotation.x = Math.PI / 2
  const boomJaw = add('ship-boom-collar', new THREE.TorusGeometry(.036, .007, 8, 20), brass, [0, .30, 0], mast)
  boomJaw.rotation.x = Math.PI / 2
  const mastHound = add('ship-mast-hound', new THREE.CylinderGeometry(.036, .036, .036, 20), brass, [0, 1.095, 0], mast)
  mastHound.userData.toonSurface = { outline: false }
  const shroudBand = add('ship-shroud-band', new THREE.CylinderGeometry(.034, .034, .024, 20), brass, [0, 1.02, 0], mast)
  shroudBand.userData.toonSurface = { outline: false }

  // Taut cambered woven-linen sailcloth with UVs and dynamic breeze-breathing buffer.
  const sailPositions = new Float32Array((SAIL_ROWS + 1) * (SAIL_COLS + 1) * 3)
  const sailUvs = new Float32Array((SAIL_ROWS + 1) * (SAIL_COLS + 1) * 2)
  const sailIndices: number[] = []
  for (let y = 0; y <= SAIL_ROWS; y++) {
    for (let x = 0; x <= SAIL_COLS; x++) {
      const idx = y * (SAIL_COLS + 1) + x
      sailUvs[idx * 2] = x / SAIL_COLS
      sailUvs[idx * 2 + 1] = y / SAIL_ROWS
      if (y < SAIL_ROWS && x < SAIL_COLS) {
        sailIndices.push(idx, idx + 1, idx + SAIL_COLS + 1, idx + 1, idx + SAIL_COLS + 2, idx + SAIL_COLS + 1)
      }
    }
  }
  const sailGeometry = new THREE.BufferGeometry()
  const sailPosAttr = new THREE.BufferAttribute(sailPositions, 3)
  sailPosAttr.setUsage(THREE.DynamicDrawUsage)
  sailGeometry.setAttribute('position', sailPosAttr)
  sailGeometry.setAttribute('uv', new THREE.BufferAttribute(sailUvs, 2))
  sailGeometry.setIndex(sailIndices)
  const sailMap = createSailClothTexture()
  const sailMaterial = createRitualMaterial(
    { color: 0xffffff, map: sailMap, roughness: .82, side: THREE.DoubleSide },
    { kind: 'cloth', strength: .22, fiber: 'linen' },
  )
  add('ship-cream-cloth-sail', sailGeometry, sailMaterial, [0, 0, 0], mast)

  // Piecewise edge-hugging 2-ply bolt-rope hem (zero Catmull-Rom corner overshoot).
  const sailHemGroup = new THREE.Group(); sailHemGroup.name = 'ship-sail-hem'; mast.add(sailHemGroup)
  const sampleEdge = (
    count: number,
    fn: (t: number, out: THREE.Vector3) => THREE.Vector3,
  ): [number, number, number][] =>
    Array.from({ length: count }, (_, i) => {
      const p = fn(i / (count - 1), new THREE.Vector3())
      return [p.x, p.y, p.z]
    })
  const luffPts = sampleEdge(12, (t, out) => evalSailPoint(0, t, 0, 0, 0, out))
  const footPts = sampleEdge(12, (t, out) => evalSailPoint(t, 0, 0, 0, 0, out))
  const headPts = sampleEdge(8, (t, out) => evalSailPoint(t, 1, 0, 0, 0, out))
  const leechVecs = Array.from({ length: 14 }, (_, i) => evalSailPoint(1, i / 13, 0, 0, 0, new THREE.Vector3()))
  twistedLine('ship-sail-hem-luff', luffPts, .0075, sailHem, sailHemGroup, { tubular: 24, turns: 11, plyDepth: .12 })
  twistedLine('ship-sail-hem-foot', footPts, .0075, sailHem, sailHemGroup, { tubular: 24, turns: 10, plyDepth: .12 })
  twistedLine('ship-sail-hem-head', headPts, .0070, sailHem, sailHemGroup, { tubular: 14, turns: 5, plyDepth: .12 })
  const leechHemMesh = twistedLine(
    'ship-sail-hem-leech',
    leechVecs.map(v => [v.x, v.y, v.z]),
    .0075,
    sailHem,
    sailHemGroup,
    { tubular: 28, turns: 13, plyDepth: .12, dynamic: true },
  )
  // Corner cringle rings cleanly joining the 4 bolt-rope edges at tack, clew, throat & peak.
  for (const [ci, [u, v]] of ([[0, 0], [1, 0], [0, 1], [1, 1]] as const).entries()) {
    const corner = evalSailPoint(u, v, 0, 0, 0, new THREE.Vector3())
    const cringle = add(`ship-sail-cringle-${ci}`, new THREE.TorusGeometry(.012, .0038, 6, 14), brass, [corner.x, corner.y, corner.z], sailHemGroup)
    cringle.userData.toonSurface = { outline: false }
  }

  // Surface-conforming horizontal stitched cloth-panel seams + knotted reef-point ties (zero clipping).
  const sailSeamGroup = new THREE.Group(); sailSeamGroup.name = 'ship-sail-seam'; mast.add(sailSeamGroup)
  const seamControlVecs = SAIL_SEAM_VS.map(() => Array.from({ length: 15 }, () => new THREE.Vector3()))
  const seamMeshes = SAIL_SEAM_VS.map((v, idx) => {
    const pts = seamControlVecs[idx]!
    for (let i = 0; i < pts.length; i++) {
      const u = .012 + .976 * (i / (pts.length - 1))
      evalSailPoint(u, v, 0, 0, 0, pts[i]!)
      pts[i]!.z += .0042
    }
    return twistedLine(
      `ship-sail-seam-${idx}`,
      pts.map(p => [p.x, p.y, p.z]),
      .0044,
      sailSeam,
      sailSeamGroup,
      { tubular: 26, radial: 7, turns: 10, plyDepth: .10, dynamic: true, capTaper: true },
    )
  })
  const reefPointUs = [.26, .52, .76] as const
  const reefPointMeshes = reefPointUs.map((u, idx) => {
    const top = evalSailPoint(u, .33, 0, 0, 0, new THREE.Vector3())
    const bot = evalSailPoint(u, .275, 0, 0, 0, new THREE.Vector3())
    top.z += .0045
    bot.z += .0065
    return twistedLine(
      `ship-sail-reef-${idx}`,
      [[top.x, top.y, top.z], [bot.x, bot.y, bot.z]],
      .0032,
      lashingCord,
      sailSeamGroup,
      { tubular: 6, radial: 6, turns: 3, plyDepth: .10, dynamic: true, capTaper: true },
    )
  })
  const reefControlVecs = reefPointUs.map(() => [new THREE.Vector3(), new THREE.Vector3()])

  // Physical spar-to-sail attachments: 6 mast hoops with luff lacings, 5 boom lashings, clew outhaul & halyards.
  const hoopYs = [.39, .50, .61, .72, .83, .95] as const
  for (const [hi, hy] of hoopYs.entries()) {
    const hoop = add(`ship-mast-hoop-${hi}`, new THREE.TorusGeometry(.038, .0058, 7, 20), lashingCord, [0, hy, .003], mast)
    hoop.rotation.x = Math.PI / 2
    hoop.rotation.y = .12
    hoop.userData.toonSurface = { outline: false }
    twistedLine(
      `ship-mast-lacing-${hi}`,
      [[.026, hy, .012], [.042, hy, .024]],
      .0042,
      lashingCord,
      mast,
      { tubular: 6, radial: 6, turns: 2, plyDepth: .10 },
    )
  }
  const boomLashUs = [.14, .34, .54, .74, .92] as const
  for (const [bi, bu] of boomLashUs.entries()) {
    const footPt = evalSailPoint(bu, 0, 0, 0, 0, new THREE.Vector3())
    const boomZ = (footPt.x / .69) * .026
    const wrap = add(`ship-boom-lashing-${bi}`, new THREE.TorusGeometry(.027, .0048, 6, 18), lashingCord, [footPt.x, .306, boomZ], mast)
    wrap.rotation.y = Math.PI / 2
    wrap.userData.toonSurface = { outline: false }
  }
  // Throat and peak halyards suspending the wooden head spar cleanly from the masthead hound band.
  twistedLine('ship-halyard-throat', [[.018, 1.095, .008], [.032, 1.046, .015]], .0042, rope, mast, { tubular: 8, radial: 6, turns: 3, plyDepth: .12 })
  twistedLine('ship-halyard-peak', [[.024, 1.098, .010], [.198, 1.048, .025]], .0044, rope, mast, { tubular: 14, radial: 6, turns: 6, plyDepth: .12 })
  oval('ship-mast-finial', [0, 1.14, 0], [.039, .045, .039], brass, mast)

  // Cleanly routed 2-ply twisted standing rigging with bowsprit, stern & gunwale chainplate fittings.
  const rigging = new THREE.Group(); rigging.name = 'ship-rigging'; ship.add(rigging)
  const stayHeadY = 1.402
  twistedLine('ship-forestay', [[0, stayHeadY, .19], [.57, .90, .095], [1.14, .40, 0]], .008, rope, rigging, { tubular: 36, turns: 18, plyDepth: .14 })
  twistedLine('ship-backstay', [[0, stayHeadY, .19], [-.42, .85, .095], [-.84, .30, 0]], .008, rope, rigging, { tubular: 36, turns: 17, plyDepth: .14 })
  for (const [si, sign] of ([-1, 1] as const).entries()) {
    twistedLine('ship-shroud', [[0, 1.32, .19], [-.105, .79, .19 * .5 + sign * .15], [-.21, .275, sign * .30]], .0065, rope, rigging, { tubular: 30, turns: 15, plyDepth: .14 })
    const chainplate = add(`ship-chainplate-${si}`, new THREE.CylinderGeometry(.016, .016, .024, 12), brass, [-.21, .275, sign * .30], rigging)
    chainplate.userData.toonSurface = { outline: false }
  }
  const bowspritCollar = add('ship-bowsprit-collar', new THREE.TorusGeometry(.027, .006, 8, 18), brass, [1.14, .40, 0], rigging)
  bowspritCollar.rotation.y = Math.PI / 2
  bowspritCollar.userData.toonSurface = { outline: false }
  const sternEye = add('ship-stern-eye', new THREE.CylinderGeometry(.016, .016, .022, 12), brass, [-.84, .30, 0], rigging)
  sternEye.userData.toonSurface = { outline: false }
  // Taut boom sheet descending cleanly from the boom end to a deck eye well behind the deck handle.
  const sheetCleat = add('ship-sheet-cleat', new THREE.CylinderGeometry(.018, .018, .018, 12), brass, [.60, .258, .02], rigging)
  sheetCleat.userData.toonSurface = { outline: false }
  twistedLine('ship-boom-sheet', [[.66, .60, .215], [.63, .42, .115], [.60, .265, .02]], .0055, lashingCord, rigging, { tubular: 18, radial: 7, turns: 9, plyDepth: .13 })

  // In-place updater for taut sail camber, flush panel seams, leech bolt-rope & reef-point ties.
  const _tmpSail = new THREE.Vector3()
  let lastBillow = -999, lastBreezeAmp = -999, lastBreezePhase = -999
  function updateSailSurface(billowBoost: number, breezeAmp: number, breezePhase: number) {
    if (
      Math.abs(billowBoost - lastBillow) < 1e-6 &&
      Math.abs(breezeAmp - lastBreezeAmp) < 1e-6 &&
      Math.abs(breezePhase - lastBreezePhase) < 1e-6
    ) return
    lastBillow = billowBoost; lastBreezeAmp = breezeAmp; lastBreezePhase = breezePhase

    for (let y = 0; y <= SAIL_ROWS; y++) {
      const v = y / SAIL_ROWS
      for (let x = 0; x <= SAIL_COLS; x++) {
        const u = x / SAIL_COLS
        evalSailPoint(u, v, billowBoost, breezeAmp, breezePhase, _tmpSail)
        sailPosAttr.setXYZ(y * (SAIL_COLS + 1) + x, _tmpSail.x, _tmpSail.y, _tmpSail.z)
      }
    }
    sailPosAttr.needsUpdate = true
    sailGeometry.computeVertexNormals()
    sailGeometry.computeBoundingBox()
    sailGeometry.computeBoundingSphere()

    for (let i = 0; i < leechVecs.length; i++) {
      evalSailPoint(1, i / (leechVecs.length - 1), billowBoost, breezeAmp, breezePhase, leechVecs[i]!)
    }
    writeTwistedCordInPlace(leechHemMesh.geometry, leechVecs, { turns: 13, plyDepth: .12 })

    for (let s = 0; s < SAIL_SEAM_VS.length; s++) {
      const v = SAIL_SEAM_VS[s]!
      const pts = seamControlVecs[s]!
      for (let i = 0; i < pts.length; i++) {
        const u = .012 + .976 * (i / (pts.length - 1))
        evalSailPoint(u, v, billowBoost, breezeAmp, breezePhase, pts[i]!)
        pts[i]!.z += .0042
      }
      writeTwistedCordInPlace(seamMeshes[s]!.geometry, pts, { turns: 10, plyDepth: .10, capTaper: true })
    }

    for (let r = 0; r < reefPointUs.length; r++) {
      const u = reefPointUs[r]!
      const pair = reefControlVecs[r]!
      evalSailPoint(u, .33, billowBoost, breezeAmp, breezePhase, pair[0]!)
      evalSailPoint(u, .275, billowBoost, breezeAmp, breezePhase, pair[1]!)
      pair[0]!.z += .0045
      pair[1]!.z += .0065
      writeTwistedCordInPlace(reefPointMeshes[r]!.geometry, pair, { turns: 3, plyDepth: .10, capTaper: true })
    }
  }
  updateSailSurface(0, 0, 0)

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const seatMast = () => mast.position.copy(ship.position).add(MAST_SEAT)
  const restore = () => {
    ship.position.copy(at >= 2 ? SEATED : HOME)
    if (at >= 1) seatMast(); else mast.position.copy(MAST_HOME)
    rigging.visible = at >= 1
    if (reduced()) { breezeGust = 0; updateSailSurface(0, 0, 0) }
    matrices()
  }
  const cueActive = (step: number) => () => active() && !motion && at === step
  addInteractionCue(grip, { kind: 'drag', label: '握住桅杆下端', priority: 3, enabled: cueActive(0), destination: socket, targetLabel: '金色桅座' })
  addInteractionCue(handle, { kind: 'drag', label: '握住甲板木把手', priority: 3, enabled: cueActive(1), destination: cradleTarget, targetLabel: '船架前端木扣' })
  addInteractionCue(handle, { kind: 'tap', label: '轻点舟模细看', priority: 3, enabled: cueActive(2) })
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3(), down = new THREE.Vector2()
  const reset = () => { dragging = false; travel = 0; if (!motion) restore() }
  const visibleHit = (x: number, y: number, targets: THREE.Object3D[], held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverse(object => {
      if (!(object as THREE.Mesh).isMesh) return
      for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible || p === held || at === 1 && held === ship && p === mast) return
      if (((object as THREE.Mesh).material as THREE.Material).transparent) return
      meshes.push(object)
    })
    return targets.includes(ray.aim(x, y).intersectObjects(meshes, false)[0]?.object)
  }
  const finishTargets: THREE.Object3D[] = []
  ship.traverse(object => { if ((object as THREE.Mesh).isMesh) finishTargets.push(object) })
  mast.traverse(object => { if ((object as THREE.Mesh).isMesh) finishTargets.push(object) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? [grip] : at === 1 ? [handle] : finishTargets) },
    onStart(x, y) {
      feedback.prepare(); down.set(x, y); travel = 0; dragging = at < 2
      const moving = at === 0 ? mast : ship
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), (at===0?grip:handle).getWorldPosition(new THREE.Vector3()))
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving.position).sub(point)
    },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      const moving = at === 0 ? mast : ship; moving.position.copy(point).add(offset)
      moving.position.x = THREE.MathUtils.clamp(moving.position.x, -1.6, 1.4); moving.position.y = THREE.MathUtils.clamp(moving.position.y, .80, 2.0)
      if (at === 1) seatMast(); matrices()
      if (at < 2 && placementHit(canvas, camera, at === 0 ? grip : handle, x, y, (px,py) => visibleHit(px,py,[at === 0 ? socket : cradleTarget],at === 0 ? mast : ship)) && pointer.finish()) { dragging = false; begin((at === 0 ? mast : ship).position.clone(),true) }
    },
    onRelease(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) {
        const moving = at === 0 ? mast : ship; moving.position.copy(point).add(offset)
        moving.position.x = THREE.MathUtils.clamp(moving.position.x, -1.6, 1.4); moving.position.y = THREE.MathUtils.clamp(moving.position.y, .80, 2.0)
        if (at === 1) seatMast(); matrices()
      }
      // Test the fixed, visible destination before the carried object can obscure it.
      const moved = (at === 0 ? mast : ship).position.clone()
      const valid = at < 2 ? dragging && placementHit(canvas, camera, at === 0 ? grip : handle, x, y, (px, py) => visibleHit(px, py, [at === 0 ? socket : cradleTarget], at === 0 ? mast : ship))
        : at === 2 && travel < 12 && visibleHit(x, y, finishTargets)
      restore()
      dragging = false
      if (valid) { if (at < 2) begin(moved); else finish() } else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: active, duration: 3, motion: 'glow',
    targets: () => [ship], cancelInput: () => pointer.cancel(), complete: () => finish() })
  const sync = () => {
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); wishSlot.hidden = returning || at !== 2
    writer?.setEnabled(active() && !returning && at === 2 && !motion)
    ui.hitLayer.style.pointerEvents = !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, at === 0 ? COPY.mastAction : at === 1 ? COPY.cradleAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.masting : COPY.placing : at === 0 ? COPY.mast : at === 1 ? COPY.cradle : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    ending.sync(at === 2 && !motion)
  }
  function settle() {
    if (!active() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; breezeGust = reduced() ? 0 : .014; restore(); sync(); ctx.onProgress?.(at)
    feedback.impact({ freqs: [392, 493.88], duration: .19, gain: .012, type: 'triangle' })
  }
  function begin(from?: THREE.Vector3, placed = false) {
    if (!active() || (pointer.isBusy() && !placed) || motion || at >= 2) return
    motion = { step: at as 0 | 1, time: 0, from: from?.clone() ?? (at === 0 ? mast : ship).position.clone() }
    sync(); if (reduced()) settle()
  }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || at !== 2) return
    if (!text.trim() && !ending.completing) return
    at = 3; restore(); sync(); if (text.trim() && !returning) ctx.saveWish?.(text.trim())
    if (disposed) return; ctx.onProgress?.(3); if (!active()) return; feedback.impact({ freqs: [392, 587.33], duration: .24, gain: .012 })
    if (!active()) return; overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || at === 3) return; feedback.prepare(); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    camera.position.set(0, 3.30, 5.75 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.27, 0); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0
      at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
        onSubmit: text => { if (!active() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; feedback.prepare(); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) {
        pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true')
        if (!inactiveRendered) { style.render(); inactiveRendered = true }; return
      }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      const quiet = reduced()
      let travelBillow = 0
      if (motion) {
        motion.time = quiet ? 1 : Math.min(1, motion.time + delta / .75)
        const t = ease(motion.time), lift = quiet ? 0 : .11 * Math.sin(Math.PI * t)
        travelBillow = quiet ? 0 : .018 * Math.sin(Math.PI * t)
        if (motion.step === 0) { mast.position.lerpVectors(motion.from, ship.position.clone().add(MAST_SEAT), t); mast.position.y += lift }
        else { ship.position.lerpVectors(motion.from, SEATED, t); ship.position.y += lift; seatMast() }
        if (motion.time === 1) settle()
      }
      if (quiet) {
        breezeGust = 0
        updateSailSurface(0, 0, 0)
      } else {
        breezeClock += delta
        breezeGust *= Math.exp(-delta * 2.8)
        updateSailSurface(travelBillow + breezeGust, at >= 1 ? 1 : .45, breezeClock)
      }
      ending.update(dt)
      if (disposed || !active()) return
      matrices(); style.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose()
      disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); sailMap.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
