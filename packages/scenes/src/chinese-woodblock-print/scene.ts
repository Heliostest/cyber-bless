import { sceneTemplate } from '../scene-localization'
import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '木版留春', rub: '拿起左侧棕擦，在纸背左右刷过，让枝叶的墨色转印到纸上。',
  peel: '捏住右下纸角，向上慢慢揭起，看看纸上留下的枝叶。',
  quiet: '轻点印纸静看，或写一句心意后点「写好了」。',
  returning: '轻点印纸，回看这一份春意。', done: '留一枝春意在日常。',
  moving: '棕擦刷过纸背，枝叶的墨色慢慢留下…', lifting: '纸角轻轻扬起，印出的枝叶显露出来…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const PAD_HOME = new THREE.Vector3(-1.34, .865, .60)
const ease = (t: number) => t * t * (3 - 2 * t)
const PAPER_W = 1.82
const PAPER_H = 1.6
const BACK_LOCAL_Y = -.005
const FACE_LOCAL_Y = -.014
const PRINT_TEX_W = 768
const PRINT_TEX_H = 672

// One original branching drawing is pressed into the matrix and transferred to the reverse of the paper.
const BRANCHES: readonly XYZ[][] = [
  [[-.54, 0, .20], [-.40, 0, .51], [-.22, 0, .82], [-.07, 0, 1.13], [.16, 0, 1.43]],
  [[-.37, 0, .54], [-.61, 0, .74], [-.66, 0, 1.04]],
  [[-.25, 0, .76], [.11, 0, .83], [.47, 0, 1.09]],
  [[-.09, 0, 1.09], [-.32, 0, 1.27], [-.41, 0, 1.46]],
  [[.03, 0, 1.27], [.31, 0, 1.36], [.54, 0, 1.47]],
]
const LEAF_POSITIONS: readonly [number, number, number, number][] = [
  [-.5, .41, -.9, .17], [-.31, .61, .85, .17], [-.59, .78, -.75, .17], [-.66, 1.01, .1, .16],
  [-.44, .94, 1.0, .17], [-.05, .84, .85, .17], [.21, .94, 1.1, .18], [.44, 1.09, .35, .18],
  [-.22, 1.20, -.9, .15], [-.4, 1.43, -.3, .15], [.13, 1.43, .3, .15], [.30, 1.36, 1.1, .16],
  [.53, 1.47, .7, .14],
]

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function fbm2(x: number, y: number, seed: number): number {
  return (
    vnoise(x, y, seed) * .56
    + vnoise(x * 2.03 + 17.3, y * 2.01 - 9.7, seed + 13) * .30
    + vnoise(x * 4.07 - 5.1, y * 4.11 + 21.4, seed + 29) * .14
  )
}

type WoodblockPaperBuffers = {
  face: Uint8Array<ArrayBuffer>
  cleanBack: Uint8Array<ArrayBuffer>
  rubbedBack: Uint8Array<ArrayBuffer>
}

let cachedPaperBuffers: WoodblockPaperBuffers | null = null

/**
 * Deterministic 768x672 pixel buffers (WebGL + jsdom safe, cached once) for the xuan paper sheet:
 * - `face`: warm cream xuan paper with the exact original branches & leaves transferred as flat,
 *   matte pine-soot indigo ink absorbed into paper fibers (micro-capillary wick + subtle baren tooth).
 * - `cleanBack`: unprinted warm raw xuan paper back before rubbing (tames sunlit blowout).
 * - `rubbedBack`: the same paper back after palm-pad rubbing with a faint damp ink bleed-through.
 */
function getWoodblockPaperBuffers(): WoodblockPaperBuffers {
  if (cachedPaperBuffers) return cachedPaperBuffers

  const W = PRINT_TEX_W, H = PRINT_TEX_H
  const face = new Uint8Array(W * H * 4)
  const cleanBack = new Uint8Array(W * H * 4)
  const rubbedBack = new Uint8Array(W * H * 4)

  // Sample exact CatmullRom curves used by the carved woodblock relief so the transferred print
  // mirrors the carved matrix 1-to-1 with natural hand-cut taper.
  type Seg = { x0: number; z0: number; x1: number; z1: number; dx: number; dz: number; lenSq: number; r0: number; r1: number }
  type BranchGroup = { minX: number; maxX: number; minZ: number; maxZ: number; segs: Seg[] }
  const PAD = .034
  const branchGroups: BranchGroup[] = BRANCHES.map((pts, bi) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)))
    const steps = 40
    const samples = curve.getPoints(steps)
    const segs: Seg[] = []
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    const baseR0 = bi === 0 ? .0156 : .0128
    const baseR1 = bi === 0 ? .0096 : .0084
    for (let i = 0; i < steps; i++) {
      const a = samples[i]!, b = samples[i + 1]!
      const t0 = i / steps, t1 = (i + 1) / steps
      const wobble0 = 1 + .075 * Math.sin(t0 * 21 + bi * 3.7)
      const wobble1 = 1 + .075 * Math.sin(t1 * 21 + bi * 3.7)
      const startPinch0 = bi === 0 ? THREE.MathUtils.lerp(.76, 1, THREE.MathUtils.smoothstep(t0, 0, .07)) : 1
      const startPinch1 = bi === 0 ? THREE.MathUtils.lerp(.76, 1, THREE.MathUtils.smoothstep(t1, 0, .07)) : 1
      const r0 = THREE.MathUtils.lerp(baseR0, baseR1, Math.pow(t0, .82)) * wobble0 * startPinch0
      const r1 = THREE.MathUtils.lerp(baseR0, baseR1, Math.pow(t1, .82)) * wobble1 * startPinch1
      const dx = b.x - a.x, dz = b.z - a.z
      segs.push({ x0: a.x, z0: a.z, x1: b.x, z1: b.z, dx, dz, lenSq: Math.max(1e-8, dx * dx + dz * dz), r0, r1 })
      const rMax = Math.max(r0, r1) + PAD
      minX = Math.min(minX, a.x - rMax, b.x - rMax)
      maxX = Math.max(maxX, a.x + rMax, b.x + rMax)
      minZ = Math.min(minZ, a.z - rMax, b.z - rMax)
      maxZ = Math.max(maxZ, a.z + rMax, b.z + rMax)
    }
    return { minX, maxX, minZ, maxZ, segs }
  })

  // Sample exact cubic Bezier leaf silhouette (normalized length = 1) matching woodblock-relief-leaf.
  const unitLeafShape = new THREE.Shape()
  unitLeafShape.moveTo(0, 0)
  unitLeafShape.bezierCurveTo(-.49, .38, -.34, .84, 0, 1)
  unitLeafShape.bezierCurveTo(.36, .72, .48, .32, 0, 0)
  const leafPoly = unitLeafShape.getPoints(14)
  const leafVertCount = leafPoly.length - 1 // closed loop where last == first

  type LeafData = { lx: number; lz: number; cosA: number; sinA: number; len: number; minX: number; maxX: number; minZ: number; maxZ: number }
  const leaves: LeafData[] = LEAF_POSITIONS.map(([lx, lz, angle, len]) => {
    const cosA = Math.cos(angle), sinA = Math.sin(angle)
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (let i = 0; i < leafVertCount; i++) {
      const sx = leafPoly[i]!.x * len, sy = leafPoly[i]!.y * len
      const wx = lx + sx * cosA + sy * sinA
      const wz = lz - sx * sinA + sy * cosA
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx
      if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz
    }
    return { lx, lz, cosA, sinA, len, minX: minX - PAD, maxX: maxX + PAD, minZ: minZ - PAD, maxZ: maxZ + PAD }
  })

  const leafSignedDistNorm = (nx: number, ny: number): number => {
    let minSq = Infinity
    let inside = false
    for (let i = 0, j = leafVertCount - 1; i < leafVertCount; j = i++) {
      const ax = leafPoly[j]!.x, ay = leafPoly[j]!.y
      const bx = leafPoly[i]!.x, by = leafPoly[i]!.y
      if ((ay > ny) !== (by > ny) && nx < ((bx - ax) * (ny - ay)) / (by - ay) + ax) inside = !inside
      const ex = bx - ax, ey = by - ay
      const t = THREE.MathUtils.clamp(((nx - ax) * ex + (ny - ay) * ey) / Math.max(1e-8, ex * ex + ey * ey), 0, 1)
      const dx = nx - (ax + ex * t), dy = ny - (ay + ey * t)
      const dSq = dx * dx + dy * dy
      if (dSq < minSq) minSq = dSq
    }
    const dist = Math.sqrt(minSq)
    return inside ? -dist : dist
  }

  // Warm handmade xuan paper tones & matte indigo-slate pine-soot ink matching the carved woodblock.
  const faceBaseR = 240, faceBaseG = 232, faceBaseB = 208
  const backBaseR = 237, backBaseG = 228, backBaseB = 203
  const inkCoreR = 45, inkCoreG = 68, inkCoreB = 83
  const inkWickR = 84, inkWickG = 104, inkWickB = 117
  const ghostInkR = 106, ghostInkG = 120, ghostInkB = 126

  for (let iy = 0; iy < H; iy++) {
    const vFace = iy / (H - 1)
    const z = vFace * PAPER_H
    const iyBack = H - 1 - iy
    const clampShade = 1 - .042 * (1 - THREE.MathUtils.smoothstep(z, 0, .055))
    const edgeZ = Math.min(vFace, 1 - vFace)

    for (let ix = 0; ix < W; ix++) {
      const u = ix / (W - 1)
      const x = (u - .5) * PAPER_W

      // Organic xuan paper pulp clouding, horizontal laid bamboo-screen lines, and fine vertical chain lines.
      const pulp = (fbm2(u * 7.2, vFace * 6.4, 11) - .5) * .048
      const tooth = (fbm2(u * 40, vFace * 36, 29) - .5) * .026
      const laid = Math.sin(vFace * 212 + pulp * 16) * .010
      const chainFrac = Math.abs(((u * 10.5 + .5) % 1) - .5)
      const chain = -Math.exp(-(chainFrac * chainFrac) / .00045) * .009
      const edgeDist = Math.min(Math.min(u, 1 - u), edgeZ)
      const deckleWarm = 1 - THREE.MathUtils.smoothstep(edgeDist, 0, .036)
      const paperTone = (1 + pulp + tooth + laid + chain) * clampShade

      // Evaluate exact signed distance to the original branch curves and Bezier leaves.
      let sd = 1.0
      let isLeaf = false
      let hitNx = 0, hitNy = 0

      for (let bi = 0; bi < branchGroups.length; bi++) {
        const bg = branchGroups[bi]!
        if (x < bg.minX || x > bg.maxX || z < bg.minZ || z > bg.maxZ) continue
        const segs = bg.segs
        for (let si = 0; si < segs.length; si++) {
          const s = segs[si]!
          const t = THREE.MathUtils.clamp(((x - s.x0) * s.dx + (z - s.z0) * s.dz) / s.lenSq, 0, 1)
          const px = s.x0 + s.dx * t, pz = s.z0 + s.dz * t
          const d = Math.hypot(x - px, z - pz) - (s.r0 + (s.r1 - s.r0) * t)
          if (d < sd) sd = d
        }
      }

      for (let li = 0; li < leaves.length; li++) {
        const lf = leaves[li]!
        if (x < lf.minX || x > lf.maxX || z < lf.minZ || z > lf.maxZ) continue
        const dx = x - lf.lx, dz = z - lf.lz
        const nx = (dx * lf.cosA - dz * lf.sinA) / lf.len
        const ny = (dx * lf.sinA + dz * lf.cosA) / lf.len
        if (nx < -.56 || nx > .56 || ny < -.18 || ny > 1.18) continue
        const d = leafSignedDistNorm(nx, ny) * lf.len
        if (d < sd) {
          sd = d; isLeaf = true; hitNx = nx; hitNy = ny
        }
      }

      // 1) Printed front face (woodblock-print-face): matte absorbed ink sitting in xuan paper fibers.
      let fr = faceBaseR * paperTone * (1 - deckleWarm * .018)
      let fg = faceBaseG * paperTone * (1 - deckleWarm * .026)
      let fb = faceBaseB * paperTone * (1 - deckleWarm * .040)

      // 2) Clean unprinted back (p0) & rubbed back with faint damp bleed-through (p1).
      const brClean = backBaseR * paperTone * (1 - deckleWarm * .016)
      const bgClean = backBaseG * paperTone * (1 - deckleWarm * .022)
      const bbClean = backBaseB * paperTone * (1 - deckleWarm * .034)
      let brRub = brClean, bgRub = bgClean, bbRub = bbClean

      // Very gentle horizontal palm-baren rubbing burnish across the working center at p1.
      const rubZone = (1 - THREE.MathUtils.smoothstep(Math.abs(x), .62, .84))
        * THREE.MathUtils.smoothstep(z, .10, .26) * (1 - THREE.MathUtils.smoothstep(z, 1.38, 1.54))
      if (rubZone > .001) {
        const rubStroke = .986 + .012 * Math.sin(z * 48 + fbm2(u * 6, vFace * 14, 151) * 4)
        const rubMul = THREE.MathUtils.lerp(1, rubStroke, rubZone * .65)
        brRub *= rubMul; bgRub *= rubMul; bbRub *= rubMul
      }

      if (sd < .028) {
        // Anisotropic horizontal-fiber capillary wicking (渗墨) at ink borders.
        const fiberWick = (fbm2(x * 36, z * 88, 53) - .5) * .0046 + (fbm2(x * 112, z * 160, 71) - .5) * .0022
        const sdWick = sd + fiberWick
        const inkMask = 1 - THREE.MathUtils.smoothstep(sdWick, -.0022, .0034)
        const bleedHalo = (1 - THREE.MathUtils.smoothstep(sd + fiberWick * 1.65, -.001, .0115))
          * (.10 + .06 * fbm2(x * 54, z * 54, 83))

        if (bleedHalo > .001) {
          fr = THREE.MathUtils.lerp(fr, inkWickR * (.92 + tooth * 1.4), bleedHalo)
          fg = THREE.MathUtils.lerp(fg, inkWickG * (.92 + tooth * 1.4), bleedHalo)
          fb = THREE.MathUtils.lerp(fb, inkWickB * (.92 + tooth * 1.4), bleedHalo)
        }

        if (inkMask > .001) {
          // Subtle baren rub-pressure variation, relief-edge ink pooling, and xuan fiber tooth breathing through ink.
          const baren = .85 + .11 * fbm2(x * 4.4, z * 10.2, 97)
          const toothBreak = (fbm2(x * 86, z * 86, 109) - .5) * .15 + (fbm2(x * 190, z * 190, 127) - .5) * .11
          const edgePool = 1 + .09 * Math.exp(-Math.pow((sd + .0045) / .0055, 2))
          const leafMidrib = isLeaf
            ? Math.exp(-Math.pow(hitNx / .058, 2)) * THREE.MathUtils.smoothstep(hitNy, .10, .26) * (1 - THREE.MathUtils.smoothstep(hitNy, .66, .92)) * .11
            : 0
          const coreAlpha = THREE.MathUtils.clamp(inkMask * (baren * edgePool - leafMidrib + toothBreak), 0, .92)
          // Multiplicative paper-grain soak so pulp and laid lines pass continuously through the matte ink.
          const paperGrain = .94 + (pulp + tooth + laid * 1.4) * 1.55
          fr = THREE.MathUtils.lerp(fr, inkCoreR * paperGrain, coreAlpha)
          fg = THREE.MathUtils.lerp(fg, inkCoreG * paperGrain, coreAlpha)
          fb = THREE.MathUtils.lerp(fb, inkCoreB * paperGrain, coreAlpha)
        }

        // Faint soft damp bleed-through (透墨) on the back of thin xuan paper after rubbing (p1).
        const ghostAlpha = (1 - THREE.MathUtils.smoothstep(sd + fiberWick * 1.5, -.006, .022))
          * (.185 + .055 * fbm2(x * 16, z * 18, 149))
        if (ghostAlpha > .001) {
          brRub = THREE.MathUtils.lerp(brRub, ghostInkR, ghostAlpha)
          bgRub = THREE.MathUtils.lerp(bgRub, ghostInkG, ghostAlpha)
          bbRub = THREE.MathUtils.lerp(bbRub, ghostInkB, ghostAlpha)
        }
      }

      const fIdx = (iy * W + ix) * 4
      face[fIdx] = THREE.MathUtils.clamp(Math.round(fr), 0, 255)
      face[fIdx + 1] = THREE.MathUtils.clamp(Math.round(fg), 0, 255)
      face[fIdx + 2] = THREE.MathUtils.clamp(Math.round(fb), 0, 255)
      face[fIdx + 3] = 255

      const bIdx = (iyBack * W + ix) * 4
      cleanBack[bIdx] = THREE.MathUtils.clamp(Math.round(brClean), 0, 255)
      cleanBack[bIdx + 1] = THREE.MathUtils.clamp(Math.round(bgClean), 0, 255)
      cleanBack[bIdx + 2] = THREE.MathUtils.clamp(Math.round(bbClean), 0, 255)
      cleanBack[bIdx + 3] = 255

      rubbedBack[bIdx] = THREE.MathUtils.clamp(Math.round(brRub), 0, 255)
      rubbedBack[bIdx + 1] = THREE.MathUtils.clamp(Math.round(bgRub), 0, 255)
      rubbedBack[bIdx + 2] = THREE.MathUtils.clamp(Math.round(bbRub), 0, 255)
      rubbedBack[bIdx + 3] = 255
    }
  }

  cachedPaperBuffers = { face, cleanBack, rubbedBack }
  return cachedPaperBuffers
}

function makePaperDataTexture(pixels: Uint8Array<ArrayBuffer>): THREE.DataTexture {
  const tex = new THREE.DataTexture(pixels, PRINT_TEX_W, PRINT_TEX_H, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/** A secular original branch print: the materials and transfer, not a ritual reproduction. */
export function createChineseWoodblockPrint(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, locked = false, suspended = false, at: Checkpoint = 0
  let stopResize = () => {}, writer: GestureHandle | null = null
  let motion: { step: 0 | 1; time: number; from: number } | null = null
  let dragging = false, travel = 0, rubTravel = 0, minRubX = Infinity, maxRubX = -Infinity, upward = 0, lastContact: THREE.Vector3 | null = null
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !locked, reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '用棕擦刷印纸背' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'chinese-woodblock-print', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf2eedf, ground: 0xa8afa1, key: 0xfff0d8, rim: 0xdce9e2, keyPosition: [-3, 5, 3], keyIntensity: 1.2, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512); lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .015
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 12 })
  const world = new THREE.Group(); world.name = 'woodblock-workbench'; scene.add(world)
  const mat = (color: number, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness })
  const satinWood = (
    color: number,
    axis: 'x' | 'y' | 'z',
    {
      roughness = .68,
      clearcoat = .14,
      clearcoatRoughness = .5,
      scale = .9,
      strength = .5,
    }: { roughness?: number; clearcoat?: number; clearcoatRoughness?: number; scale?: number; strength?: number } = {},
  ) =>
    applyCraftSurface(
      new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat, clearcoatRoughness }),
      { kind: 'wood', axis, scale, strength },
    )
  const blockWood = satinWood(0x825e42, 'x', { roughness: .68, clearcoat: .16, clearcoatRoughness: .48, scale: .76, strength: .58 })
  const cutWood = satinWood(0xa0784e, 'x', { roughness: .72, clearcoat: .09, clearcoatRoughness: .58, scale: .56, strength: .46 })
  const gougeWood = applyCraftSurface(mat(0xab8459, .78), { kind: 'wood', axis: 'x', scale: .56, strength: .32 })
  const clampWood = satinWood(0xb89365, 'x', { roughness: .7, clearcoat: .12, clearcoatRoughness: .52, scale: .9, strength: .46 })
  const barenCapWood = satinWood(0x79573d, 'x', { roughness: .64, clearcoat: .18, clearcoatRoughness: .44, scale: 1.05, strength: .52 })
  const gripWood = satinWood(0xb99362, 'x', { roughness: .64, clearcoat: .16, clearcoatRoughness: .46, scale: 1.15, strength: .48 })
  const paperBuffers = getWoodblockPaperBuffers()
  const printFaceMap = makePaperDataTexture(paperBuffers.face)
  const cleanBackMap = makePaperDataTexture(paperBuffers.cleanBack)
  const rubbedBackMap = makePaperDataTexture(paperBuffers.rubbedBack)
  const sheetAspect = PAPER_W / PAPER_H
  // Sheet-layout handmade xuan paper optics: back tames overhead Komorebi daylight glare with
  // strong highlight roll-off, while the lifted print face preserves warm xuan luminosity & fibers
  // with matte ink absorbed straight into the paper tooth.
  const backPaperMat = createRitualMaterial({
    color: 0xffffff,
    map: cleanBackMap,
    roughness: .96,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: .22,
    fiber: 'paper',
    paper: { layout: 'sheet', aspect: sheetAspect, grainScale: 2.8, grain: .74, fibers: .42, edge: .32, highlightGuard: .74 },
  })
  const releaseBackMaps = () => {
    backPaperMat.removeEventListener('dispose', releaseBackMaps)
    cleanBackMap.dispose()
    rubbedBackMap.dispose()
  }
  backPaperMat.addEventListener('dispose', releaseBackMaps)
  const facePaperMat = createRitualMaterial({
    color: 0xffffff,
    map: printFaceMap,
    roughness: .95,
  }, {
    kind: 'paper',
    strength: .24,
    fiber: 'paper',
    paper: { layout: 'sheet', aspect: sheetAspect, grainScale: 2.8, grain: .72, fibers: .42, edge: .32, highlightGuard: .56 },
  })
  const releaseFaceMap = () => {
    facePaperMat.removeEventListener('dispose', releaseFaceMap)
    printFaceMap.dispose()
  }
  facePaperMat.addEventListener('dispose', releaseFaceMap)
  const paperEdge = createRitualMaterial({ color: 0xd9cbb0, roughness: .95 }, { kind: 'paper', strength: .14, fiber: 'paper' })
  const ink = applyCraftSurface(mat(0x334c5b, .68), { kind: 'wood', axis: 'x', scale: 1.05, strength: .24 })
  const sage = mat(0x91a89a), bristle = mat(0x8f754d), palmFibre = mat(0xa98a5d, .88)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, material: THREE.Material, parent = world as THREE.Object3D) => add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), material, p, parent)
  const tube = (name: string, points: XYZ[], radius: number, material: THREE.Material, parent = world as THREE.Object3D) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(8, points.length * 8), radius, 5, false), material, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  addCraftTable(world, { name: 'woodblock-table', topName: 'woodblock-table', width: 3.55, depth: 2.45, surfaceY: .745, thickness: .13, center: [0,.08], support: 'trestle', finish: 'chestnut' })
  const shadow = add('woodblock-contact-shadow', new THREE.PlaneGeometry(3.8, 2.75), new THREE.ShadowMaterial({ opacity: .13 }), [0, .003, .1]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box('woodblock-carved-block', [2.12, .14, 1.94], [.1, .824, .08], blockWood)
  box('woodblock-cut-field', [1.99, .035, 1.81], [.1, .906, .08], cutWood)
  for (const x of [-.91, 1.11]) box('woodblock-inked-border', [.028, .038, 1.82], [x, .93, .08], ink)
  for (const z of [-.82, .98]) box('woodblock-inked-border', [2.02, .038, .028], [.1, .93, z], ink)
  // Paired narrow cuts in the exposed wood field make the matrix readable as a carved block.
  for (let i = 0; i < 17; i++) {
    const x = -.8 + i * .11
    const gouge = tube('woodblock-carving-gouge', [[x, .9242, -.70], [x + .016, .9242, -.30], [x - .011, .9242, .2], [x + .01, .9242, .82]], .0042, gougeWood)
    gouge.castShadow = false
  }
  const paper = new THREE.Group(); paper.name = 'woodblock-paper'; paper.position.set(.1, .994, -.72); world.add(paper)
  const backGeometry = new THREE.PlaneGeometry(PAPER_W, PAPER_H, 36, 32); backGeometry.rotateX(-Math.PI / 2)
  {
    // Subtle paper drape wave in the resting center and a soft ambient crease shadow tucked
    // directly beneath the gently curled front-right graspable corner.
    const pos = backGeometry.getAttribute('position') as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const xPaper = pos.getX(i)
      const zPaper = pos.getZ(i) + .8
      const edgeMask = Math.sin(THREE.MathUtils.clamp((xPaper + .91) / PAPER_W, 0, 1) * Math.PI)
        * Math.sin(THREE.MathUtils.clamp(zPaper / PAPER_H, 0, 1) * Math.PI)
      const cornerClear = 1 - THREE.MathUtils.smoothstep(xPaper, .54, .66) * THREE.MathUtils.smoothstep(zPaper, 1.26, 1.38)
      const drape = .0016 * Math.sin(xPaper * 3.4 + .4) * Math.cos(zPaper * 3.1 - .2) * edgeMask * cornerClear
      pos.setY(i, pos.getY(i) + drape)
      const csx = THREE.MathUtils.clamp((xPaper - .625) / .28, 0, 1)
      const csz = THREE.MathUtils.clamp((zPaper - 1.35) / .25, 0, 1)
      const cdiag = THREE.MathUtils.clamp((csx + csz - .45) / 1.55, 0, 1)
      const underCorner = (csx > 0 && csz > 0) ? Math.pow(cdiag, 1.15) : 0
      const shade = 1 - underCorner * .19
      colors[i * 3] = shade; colors[i * 3 + 1] = shade * .992; colors[i * 3 + 2] = shade * .980
    }
    pos.needsUpdate = true
    backGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    backGeometry.computeVertexNormals()
  }
  const back = add('woodblock-paper-back', backGeometry, backPaperMat, [0, BACK_LOCAL_Y, .8], paper)
  back.userData.toonSurface = { outline: false }
  const faceGeometry = new THREE.PlaneGeometry(PAPER_W, PAPER_H, 36, 32); faceGeometry.rotateX(Math.PI / 2)
  const face = add('woodblock-print-face', faceGeometry, facePaperMat, [0, FACE_LOCAL_Y, .8], paper)
  face.userData.toonSurface = { outline: false }
  // Raised paper lip is part of the sheet and is the actual graspable corner, sharing back UV space
  // seamlessly while curving gently upward toward the outer front-right tip.
  const cornerGeometry = new THREE.PlaneGeometry(.28, .25, 10, 10); cornerGeometry.rotateX(-Math.PI / 2)
  const cornerBaseY = BACK_LOCAL_Y + .0096
  {
    const pos = cornerGeometry.getAttribute('position') as THREE.BufferAttribute
    const uv = cornerGeometry.getAttribute('uv') as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), lz = pos.getZ(i)
      const xPaper = lx + .765, zPaper = lz + 1.475
      uv.setXY(i, THREE.MathUtils.clamp((xPaper + .91) / PAPER_W, 0, 1), THREE.MathUtils.clamp(1 - zPaper / PAPER_H, 0, 1))
      const sx = THREE.MathUtils.clamp((lx + .14) / .28, 0, 1)
      const sz = THREE.MathUtils.clamp((lz + .125) / .25, 0, 1)
      const taper = THREE.MathUtils.smoothstep(sx, 0, .20) * THREE.MathUtils.smoothstep(sz, 0, .20)
      const diag = THREE.MathUtils.clamp((sx + sz - .50) / 1.50, 0, 1)
      const paperY = BACK_LOCAL_Y + .0008 + taper * (.0030 + .035 * Math.pow(diag, 1.55))
      pos.setY(i, paperY - cornerBaseY)
      const foldTint = THREE.MathUtils.lerp(.955, 1.025, diag)
      colors[i * 3] = foldTint; colors[i * 3 + 1] = foldTint; colors[i * 3 + 2] = foldTint
    }
    pos.needsUpdate = true; uv.needsUpdate = true
    cornerGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    cornerGeometry.computeVertexNormals()
  }
  const corner = add('woodblock-paper-corner', cornerGeometry, backPaperMat, [.765, cornerBaseY, 1.475], paper)
  corner.userData.toonSurface = { outline: false }
  const edgeY = (BACK_LOCAL_Y + FACE_LOCAL_Y) * .5
  const edges = [
    tube('woodblock-paper-edge', [[-.91, edgeY, 0], [-.91, edgeY, .8], [-.91, edgeY, 1.6]], .0045, paperEdge, paper),
    tube('woodblock-paper-edge', [[.91, edgeY, 0], [.91, edgeY, .8], [.91, edgeY, 1.6]], .0045, paperEdge, paper),
    tube('woodblock-paper-edge', [[-.91, edgeY, 1.6], [0, edgeY, 1.6], [.91, edgeY, 1.6]], .0045, paperEdge, paper),
  ]
  // Raised carved woodblock relief remains 3D on the matrix; the transferred print on `face` is flat
  // matte ink absorbed directly into the xuan paper fibers via `printFaceMap`.
  const carving = new THREE.Group(); carving.name = 'woodblock-carved-branches'; world.add(carving); carving.position.set(.1, .947, -.72)
  for (const points of BRANCHES) tube('woodblock-relief-stem', points.map(([x, , z]) => [x, .006, z]), .021, ink, carving)
  for (const [x, z, angle, length] of LEAF_POSITIONS) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(-length * .49, length * .38, -length * .34, length * .84, 0, length); shape.bezierCurveTo(length * .36, length * .72, length * .48, length * .32, 0, 0)
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .015, bevelEnabled: false, curveSegments: 8 })
    geometry.rotateX(Math.PI / 2); geometry.rotateY(angle)
    const leaf = add('woodblock-relief-leaf', geometry, ink, [x, .009, z], carving); leaf.userData.toonSurface = { outline: false }
  }
  box('woodblock-paper-hinge-clamp', [1.45, .045, .11], [.1, 1.0, -.77], clampWood)
  box('woodblock-pad-rest', [.52, .025, .58], [-1.34, .761, .60], sage)
  const pad = new THREE.Group(); pad.name = 'woodblock-rubbing-pad'; world.add(pad)
  add('woodblock-rubbing-bristles', new THREE.CylinderGeometry(.205, .222, .11, 40), bristle, [0, -.043, 0], pad)
  add('woodblock-rubbing-cap', new THREE.CylinderGeometry(.178, .201, .075, 40), barenCapWood, [0, .049, 0], pad)
  // Concentric bindings and individual bristle ridges are attached to the tool.
  for (let i = 0; i < 36; i++) {
    const a = i * Math.PI * 2 / 36
    tube('woodblock-palm-fibre', [[Math.cos(a) * .20, -.09, Math.sin(a) * .20], [Math.cos(a) * .211, -.035, Math.sin(a) * .211]], .006, palmFibre, pad)
  }
  const grip = box('woodblock-rubbing-grip', [.27, .08, .09], [0, .12, 0], gripWood, pad)
  const paperMeshes = [back, face, corner, ...edges]
  const originals = new Map<THREE.BufferGeometry, Float32Array>()
  for (const m of paperMeshes) originals.set(m.geometry, Float32Array.from(m.geometry.getAttribute('position').array))
  const bend = (amount: number) => {
    paper.rotation.x = amount === 0 ? 0 : -1.82 * amount
    for (const m of paperMeshes) {
      const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute, original = originals.get(m.geometry)!
      for (let i = 0; i < pos.count; i++) {
        const z = original[i * 3 + 2] + m.position.z
        const curl = amount * .055 * Math.sin(z / 1.6 * Math.PI) + Math.pow(Math.max(0, z / 1.6), 8) * .010
        pos.setY(i, original[i * 3 + 1] + curl)
      }
      pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere()
    }
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { pad.position.copy(PAD_HOME); pad.rotation.set(0, 0, 0); face.visible = at > 0; backPaperMat.map = at > 0 ? rubbedBackMap : cleanBackMap; bend(at >= 2 ? 1 : 0); matrices() }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', label: '拿棕擦，左右刷纸', priority: 3, enabled: enabled(0), destination: back, targetLabel: '纸背左右刷过' }),
    addInteractionCue(corner, { kind: 'drag', direction: [0, -1], label: '捏纸角，向上揭开', priority: 3, enabled: enabled(1) }),
    addInteractionCue(face, { kind: 'tap', label: '轻点印纸静看', anchor: [.60, .04252, -.35], priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0), point = new THREE.Vector3()
  const belongsTo = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const visibleHit = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh; if (!mesh.isMesh || held && belongsTo(object, held)) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(object)
    })
    return belongsTo(ray.aim(x, y).intersectObjects(meshes, false)[0]?.object, target)
  }
  let acceptedRub = 0, acceptedMinX = Infinity, acceptedMaxX = -Infinity
  const rubComplete = () => rubTravel + 1e-6 >= .75 && maxRubX - minRubX + 1e-6 >= .45
  const reset = () => {
    dragging = false; travel = upward = 0; lastContact = null
    rubTravel = acceptedRub; minRubX = acceptedMinX; maxRubX = acceptedMaxX
    if (!motion) restore()
    if (started && !disposed) sync()
  }
  // Ignore synchronous pointer input from host callbacks before it can reach
  // the controller's inactive-cancel path and discard the original pointer.
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (locked) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => ui.hitLayer.addEventListener(type, guardCallbackInput, true))
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? pad : at === 1 ? corner : paper) },
    onStart(x, y) { callbackBoundary(() => feedback.prepare()); if (!inputActive()) { pointer.cancel(); return }; down.set(x, y); dragging = at < 2; travel = upward = 0; lastContact = null },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (at === 0 && dragging) {
        const contact = visibleHit(x, y, paper, pad)
        if (ray.aim(x, y).ray.intersectPlane(plane, point)) {
          pad.position.copy(point); pad.position.y += .095
          if (contact) { if (lastContact) rubTravel += lastContact.distanceTo(point); lastContact = point.clone(); minRubX = Math.min(minRubX, point.x); maxRubX = Math.max(maxRubX, point.x) } else lastContact = null
        }
      } else if (at === 1 && dragging) { upward = Math.max(0, down.y - y); bend(THREE.MathUtils.clamp(upward / 64, 0, 1)) }
      matrices()
      if (at === 0) sync()
    },
    onRelease(x, y) {
      matrices()
      const valid = at === 0 ? dragging && travel >= 8 && rubComplete() && visibleHit(x, y, paper, pad)
        : at === 1 ? dragging && upward >= 42 && down.y - y >= 42 && Math.abs(x - down.x) < Math.max(70, upward * .8)
          : travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, paper)
      // A released contact stroke stays on the paper. Cancellation or a drop
      // away from it discards this stroke, preserving earlier accepted work.
      if (at === 0 && dragging && travel >= 8 && visibleHit(x, y, paper, pad)) {
        acceptedRub = rubTravel; acceptedMinX = minRubX; acceptedMaxX = maxRubX
      }
      dragging = false; if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: inputActive, duration: 3, motion: 'glow', targets: () => [face], cancelInput: () => pointer.cancel(), complete: () => finish() })
  const sync = () => {
    delete ui.hintEl.dataset.progress
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? '用棕擦刷印纸背' : at === 1 ? '揭开印纸' : '轻点印纸静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.moving : COPY.lifting : at === 0 ? COPY.rub : at === 1 ? COPY.peel : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    if (at === 0 && !motion && rubTravel > 0) {
      ui.hintEl.dataset.progress = 'true'
      const coverage = Math.min(99, Math.floor(100 * Math.min(1, rubTravel / .75, Math.max(0, maxRubX - minRubX) / .45)))
      setSafeText(ui.hintEl, rubComplete()
        ? lastContact ? '刷印已到位，可以松手揭纸。' : '刷印已覆盖，请把棕擦移回纸面。'
        : sceneTemplate("刷印 {p0}%，抬手后也可以接着擦。", { p0: coverage }), safe)
    }
    ending.sync(at === 2 && !motion)
  }
  function callbackBoundary(work: () => void) { locked = true; sync(); try { work() } finally { locked = false; if (!disposed) sync() } }
  function settle() {
    if (!inputActive() || !motion) return
    const next = (motion.step + 1) as Checkpoint
    callbackBoundary(() => { at = next; motion = null; restore(); sync(); ctx.onProgress?.(at); if (active()) feedback.impact({ freqs: [392, 523.25], duration: .14, gain: .009, type: 'triangle' }) })
  }
  function begin() { if (!inputActive() || pointer.isBusy() || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: -paper.rotation.x / 1.82 }; sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2) return
    if (!text.trim() && !ending.completing) return
    callbackBoundary(() => {
      at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
      if (text.trim() && !returning) ctx.saveWish?.(text.trim())
      if (disposed) return
      ctx.onProgress?.(3); if (!active()) return
      feedback.impact({ freqs: [392, 587.33], duration: .21, gain: .01 }); if (!active()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3) return; callbackBoundary(() => feedback.prepare()); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 4.8, 6.4 + portraitBoost(aspect, 8)); camera.lookAt(0, 1.05, .04); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined, onSubmit: text => { if (!inputActive() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; callbackBoundary(() => feedback.prepare()); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed || locked) return
      if (!active()) { pointer.cancel(); writer?.setEnabled(false); if (!suspended) { suspended = true; sync() }; return }
      if (suspended) { suspended = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      if (motion) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .72); const t = ease(motion.time)
        if (motion.step === 0) { pad.position.set(.1 + Math.sin(t * Math.PI * 4) * .57, 1.09, .1 + Math.cos(t * Math.PI * 2) * .22); if (t > .88) pad.position.lerp(PAD_HOME, (t - .88) / .12) }
        else bend(THREE.MathUtils.lerp(motion.from, 1, t))
        if (motion.time === 1) settle()
      }
      ending.update(dt)
      if (!disposed && active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      ending.dispose(); disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => ui.hitLayer.removeEventListener(type, guardCallbackInput, true))
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
