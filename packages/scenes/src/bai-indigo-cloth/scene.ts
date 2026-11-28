import { createQuietEnding } from '../quiet-ending'
import { createVesselLiquid } from '@wbr/scene-runtime/vessel-liquid'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import { placementHit } from '../placement-hit'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '蓝白晾晴', rinseAction: '将扎布送到漂洗盆', hangAction: '把蓝白布搭上晾杆', quietAction: '轻点布面静看',
  rinse: '握住凳上的扎布，送到盆中，看看蓝白留纹。',
  hang: '握住盆前可见的布边，将蓝白布搭到右侧木晾杆。',
  quiet: '轻点蓝白布静看，也可写一句心愿；点「写好了」保存。',
  returning: '轻点蓝白布，回看这份安静的心意。', moving: '将布放稳，慢慢展开…',
  done: '蓝白布已晾好，留一刻晴朗。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const BUNDLE_HOME = new THREE.Vector3(-1.03, .36, .89)
const RINSED = new THREE.Vector3(-.78, .79, .49), HUNG = new THREE.Vector3(.84, 1.90, -.06)
const BASIN_CENTER = new THREE.Vector3(-.78, .04, -.10)
const CLOTH_ANCHOR: [number, number, number] = [-.50, -.35, .085]
const CLOTH_NX = 72, CLOTH_NY = 120, CLOTH_W = 1.24, ROD_RADIUS = .073, HALF_THICK = .003
const FRONT_LEN = .67, BACK_LEN = .49, WRAP_LEN = Math.PI * ROD_RADIUS, TOTAL_LEN = FRONT_LEN + WRAP_LEN + BACK_LEN
const SIM_NU = 13, SIM_FRONT_NV = 10, SIM_BACK_NV = 8 // 130 + 104 = 234 particles
const BASIN_UNFOLD_DURATION = .90
const OVER_ROD_DURATION = .90
const ease = (t: number) => t * t * (3 - 2 * t)
const smoothstep01 = (t: number) => {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  return c * c * (3 - 2 * c)
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

function buildInterpTable(samples: number, simCount: number, paramOf: (idx: number) => number): InterpRow[] {
  const table: InterpRow[] = []
  for (let idx = 0; idx <= samples; idx++) {
    const f = THREE.MathUtils.clamp(paramOf(idx), 0, 1) * (simCount - 1)
    const i1 = Math.min(simCount - 2, Math.floor(f))
    const t = f - i1
    const [w0, w1, w2, w3] = catmullRomWeights(t)
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

const U_TABLE = buildInterpTable(CLOTH_NX, SIM_NU, (i) => i / CLOTH_NX)

function sampleGridPoint(
  pos: Float32Array,
  nv: number,
  uRow: InterpRow,
  vRow: InterpRow,
  out: THREE.Vector3,
): THREE.Vector3 {
  const sampleAxis = (axis: 0 | 1 | 2) => {
    const row = (j: number) =>
      pos[(uRow.i0 * nv + j) * 3 + axis]! * uRow.w0 +
      pos[(uRow.i1 * nv + j) * 3 + axis]! * uRow.w1 +
      pos[(uRow.i2 * nv + j) * 3 + axis]! * uRow.w2 +
      pos[(uRow.i3 * nv + j) * 3 + axis]! * uRow.w3
    return (
      row(vRow.i0) * vRow.w0 +
      row(vRow.i1) * vRow.w1 +
      row(vRow.i2) * vRow.w2 +
      row(vRow.i3) * vRow.w3
    )
  }
  return out.set(sampleAxis(0), sampleAxis(1), sampleAxis(2))
}

/** Calm, physically plausible zero-WASM resting drape over the wooden rod (reduced motion & initial pose). */
function evalRestingMidsurface(u: number, v: number, isWet: boolean, out: THREE.Vector3): THREE.Vector3 {
  const xBase = (u - .5) * CLOTH_W, s = v * TOTAL_LEN
  if (s >= FRONT_LEN && s <= FRONT_LEN + WRAP_LEN) {
    const angle = (s - FRONT_LEN) / ROD_RADIUS
    return out.set(xBase, ROD_RADIUS * Math.sin(angle), ROD_RADIUS * Math.cos(angle))
  }
  if (s < FRONT_LEN) {
    const d = (FRONT_LEN - s) / FRONT_LEN // 0 at rod tangent, 1 at front bottom hem
    const d13 = Math.pow(d, 1.3), d16 = Math.pow(d, 1.6), d2 = d * d
    const foldWave =
      .058 * Math.sin(u * Math.PI * 3.1 + .45) +
      .038 * Math.cos(u * Math.PI * 5.0 - .95) +
      .020 * Math.sin(u * Math.PI * 7.0 + 1.85)
    const breeze = isWet ? .042 : .135
    const gatherIn = -(u - .5) * (isWet ? .055 : .072) * d13
    const swayX = (isWet ? .020 : .078) * d16 * (.55 + .45 * u)
    const x = xBase + gatherIn + swayX
    const diagLift = (isWet ? .022 : .082) * d2 * Math.pow(u, 1.35)
    const foldHem = (isWet ? .022 : .034) * Math.sin(u * Math.PI * 3.1 + .45) * d2
    const y = Math.min(0, -d * FRONT_LEN + diagLift + foldHem)
    const z = ROD_RADIUS + breeze * d16 * (.58 + .56 * u) + foldWave * d13 * (isWet ? .92 : 1.08)
    return out.set(x, y, z)
  }
  const d = (s - FRONT_LEN - WRAP_LEN) / BACK_LEN // 0 at back rod tangent, 1 at back bottom hem
  const d13 = Math.pow(d, 1.3), d16 = Math.pow(d, 1.6), d2 = d * d
  const foldWave =
    .046 * Math.sin(u * Math.PI * 3.1 + 1.35) +
    .028 * Math.cos(u * Math.PI * 5.0 - .20)
  const gatherIn = -(u - .5) * (isWet ? .045 : .060) * d13
  const swayX = (isWet ? .014 : .055) * d16 * (.60 + .40 * u)
  const x = xBase + gatherIn + swayX
  const diagLift = (isWet ? .012 : .048) * d2 * Math.pow(u, 1.35)
  const y = Math.min(0, -d * BACK_LEN + diagLift + .018 * Math.sin(u * Math.PI * 3.1 + 1.35) * d2)
  const zBias = isWet ? .024 * d13 : .038 * d16 * (.45 + .65 * u) - .042 * d13 * (1 - u)
  const z = -ROD_RADIUS + zBias + foldWave * d13 * (isWet ? .70 : 1.0)
  return out.set(x, y, z)
}

/** Outer radius of the ceramic rinse basin wall at basin-local height y (0..0.53). */
function basinOuterRadius(basinY: number): number {
  if (basinY < -.04 || basinY > .55) return 0
  if (basinY <= 0) return .30
  if (basinY <= .49) return .30 + (.47 - .30) * (basinY / .49)
  return .47
}

/** Original blue-white cloth, including both faces and the fold, as one closed 2-manifold surface. */
function clothGeometry() {
  const nx = CLOTH_NX, ny = CLOTH_NY
  const layer = (nx + 1) * (ny + 1)
  const positions = new Float32Array(layer * 2 * 3)
  const colors: number[] = [], indices: number[] = []
  const indigo = new THREE.Color(0x174d82), pale = new THREE.Color(0xf6f2dc), bloom = new THREE.Color(0x6791b2)
  for (let side = 0; side < 2; side++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny
    // Invented offset oval reserves and narrow bands; no copied workshop or sacred motif.
    const cellX = ((u * 4 + (Math.floor(v * 6) % 2) * .5) % 1) - .5, cellY = (v * 6 % 1) - .5
    const ring = Math.abs(Math.hypot(cellX / .85, cellY) - .24), border = Math.min(u, 1 - u)
    const reserve = Math.max(1 - THREE.MathUtils.smoothstep(ring, .028, .08), border > .046 && border < .062 ? 1 : 0)
    const dye = indigo.clone().lerp(bloom, .12 + .08 * Math.sin(u * 31 + v * 19)).lerp(pale, reserve)
    colors.push(dye.r, dye.g, dye.b)
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1
    indices.push(a, b, d, a, d, c, a + layer, d + layer, b + layer, a + layer, c + layer, d + layer)
  }
  const rim: number[] = []
  for (let i = 0; i <= nx; i++) rim.push(i)
  for (let j = 1; j <= ny; j++) rim.push(j * (nx + 1) + nx)
  for (let i = nx - 1; i >= 0; i--) rim.push(ny * (nx + 1) + i)
  for (let j = ny - 1; j > 0; j--) rim.push(j * (nx + 1))
  for (let i = 0; i < rim.length; i++) { const a = rim[i]!, b = rim[(i + 1) % rim.length]!; indices.push(a, a + layer, b + layer, a, b + layer, b) }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  return geometry
}

export function createBaiIndigoCloth(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false
  let dragging = false, travel = 0, stopResize = () => {}, writer: GestureHandle | null = null
  let motion: {
    step: 0 | 1
    time: number
    from: THREE.Vector3
    startCarryBlend: number
    startGrabU: number
    startSwayX: number
    startSwayZ: number
    unfoldSpawned?: boolean
    rinseStage?: number
  } | null = null
  // Product choreography state: basin wet-unfold, pinched air carry, over-rod wrap & optional smoothing.
  let rodWrapBlend = 1
  let carryBlend = 0
  let carryGrabU = 0.16
  let carrySwayX = 0
  let carrySwayZ = 0
  let unfoldAmount = 1 // 0 = gathered emerging from basin, 1 = full width
  let hungSmoothness = 1 // 0.18 right after hanging onto rail -> 1.0 when smoothed/settled
  let smoothingPointer = false
  const smoothLastLocal = new THREE.Vector2()
  let hasSmoothLast = false
  const lastDragPos = new THREE.Vector3()
  // Dirty-render tracking so settled reduced-motion views stay completely idle without redundant WebGL swaps.
  let renderDirty = true
  const lastCamPos = new THREE.Vector3(NaN, NaN, NaN), lastCamQuat = new THREE.Quaternion(NaN, NaN, NaN, NaN)
  let lastCamFov = -1
  const markDirty = () => { renderDirty = true }

  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false, feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.rinseAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'bai-indigo-cloth', label: COPY.title, invalidate: markDirty }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf0efdf, ground: 0xa5ac98, key: 0xffefdc, rim: 0xc6e4ea,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'indigo-veranda-workshop'; scene.add(world)
  const material = (color: number, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness })
  const oak = material(0xbd9965), walnut = material(0x796447), ceramic = material(0x9baaa8), blue = material(0x214e7c), linen = material(0xebdfbd)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const rod = (name: string, radius: number, length: number, p: [number, number, number], mat = oak) => {
    const mesh = add(name, new THREE.CylinderGeometry(radius, radius, length, 40), mat, p); mesh.rotation.z = Math.PI / 2; return mesh
  }
  const shadow = add('indigo-contact-shadow', new THREE.PlaneGeometry(3.8, 2.35), new THREE.ShadowMaterial({ opacity: .12 }), [0, .002, .1]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box('indigo-bundle-stool-top', [.66, .06, .54], [-1.03, .19, .89])
  for (const x of [-1.27, -.79]) for (const z of [.73, 1.05]) box('indigo-stool-leg', [.07, .16, .07], [x, .08, z], walnut)
  const profile = [[0, -.04], [.30, -.04], [.30, 0], [.47, .49], [.46, .53], [.41, .52], [.26, .08], [0, .08]]
  const basin = add('indigo-rinse-basin', new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0], p[1])), 64), ceramic, [-.78, .04, -.10])
  basin.userData.toonSurface = { outline: false }
  const rinseClearTint = new THREE.Color(0x5b91a2)
  const rinseIndigoTint = new THREE.Color(0x315f82)
  const rinseWater = createVesselLiquid({
    preset: 'pigment-dye',
    radius: .378,
    radialSegments: 16,
    angularSegments: 48,
    deformMode: 'cpu',
    color: rinseClearTint,
    edgeColor: 0xb2dce6,
    deepColor: 0x1b405f,
    foamColor: 0x8ec0d6,
    foamStrength: .34,
    opacity: .80,
    roughness: .14,
    meniscusHeight: .015,
    maxAmplitude: .028,
    seed: 2107,
    name: 'indigo-rinse-water',
    receiveShadow: true,
    renderOrder: 1,
  })
  const water = rinseWater.mesh
  water.position.set(-.78, .44, -.10)
  world.add(water)
  let liquidClock = 0
  let dragWaterCooldown = 0
  const setRinseDyeMix = (mix01: number) => {
    rinseWater.material.color.copy(rinseClearTint).lerp(rinseIndigoTint, THREE.MathUtils.clamp(mix01, 0, 1))
  }
  rod('indigo-rinse-rest', .07, 1.42, [RINSED.x, RINSED.y, RINSED.z])
  for (const x of [-1.45, -.11]) {
    box('indigo-rinse-rest-foot', [.16, .07, .40], [x, .035, .49], walnut)
    box('indigo-rinse-rest-post', [.065, .75, .065], [x, .415, .49])
  }
  const rail = rod('indigo-drying-rail', .07, 1.58, [HUNG.x, HUNG.y, HUNG.z])
  for (const x of [.10, 1.58]) {
    box('indigo-drying-foot', [.26, .09, .80], [x, .045, -.06], walnut)
    box('indigo-drying-post', [.09, 1.90, .10], [x, .98, -.06])
    rod('indigo-rail-end-cap', .09, .055, [x, 1.90, -.06], walnut)
  }
  const bundle = new THREE.Group(); bundle.name = 'indigo-tied-cloth'; world.add(bundle)
  const bundleGeometry = new THREE.SphereGeometry(1, 40, 28), positions = bundleGeometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), fold = 1 + .055 * Math.cos(Math.atan2(z, x) * 10)
    positions.setXYZ(i, x * .26 * fold, y * .14, z * .23 * fold)
  }
  bundleGeometry.computeVertexNormals()
  const tiedBody = add('indigo-bundle-body', bundleGeometry, blue, [0, 0, 0], bundle)
  for (const angle of [-.34, .40]) {
    const tie = add('indigo-bundle-tie', new THREE.TorusGeometry(.15, .013, 8, 56), linen, [0, 0, 0], bundle)
    tie.scale.set(1.70, 1, 1); tie.rotation.y = angle; tie.rotation.x = .12
  }
  const knot = add('indigo-bundle-knot', new THREE.SphereGeometry(.045, 20, 14), linen, [.02, .142, .075], bundle); knot.scale.set(1.3, .65, 1)
  const cloth = new THREE.Group(); cloth.name = 'indigo-open-cloth'; world.add(cloth)
  const clothGeo = clothGeometry()
  const body = add('indigo-cloth-body', clothGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94, side: THREE.DoubleSide }), [0, 0, 0], cloth)
  body.userData.toonSurface = { outline: false }

  // ---------------------------------------------------------------------------
  // Precomputed grid tables & scratch buffers for closed 2-manifold writeback.
  // Preserves exact 72x120 closed topology & vertex colors; unlocks top crown
  // whenever rodWrapBlend < 1 (basin unfold, pinched air carry, over-rod arc).
  // ---------------------------------------------------------------------------
  const layerCount = (CLOTH_NX + 1) * (CLOTH_NY + 1)
  const midGrid = new Float32Array(layerCount * 3)
  const rowRegion = new Uint8Array(CLOTH_NY + 1) // 0 = front skirt, 1 = top fold/crown, 2 = back skirt
  const rowWrapAngle = new Float32Array(CLOTH_NY + 1)
  const rowWrapSin = new Float32Array(CLOTH_NY + 1)
  const rowWrapCos = new Float32Array(CLOTH_NY + 1)
  const frontVTable: (InterpRow | null)[] = new Array(CLOTH_NY + 1).fill(null)
  const backVTable: (InterpRow | null)[] = new Array(CLOTH_NY + 1).fill(null)
  for (let j = 0; j <= CLOTH_NY; j++) {
    const s = (j / CLOTH_NY) * TOTAL_LEN
    if (s < FRONT_LEN) {
      rowRegion[j] = 0
      const d = (FRONT_LEN - s) / FRONT_LEN
      const f = THREE.MathUtils.clamp(d, 0, 1) * (SIM_FRONT_NV - 1)
      const i1 = Math.min(SIM_FRONT_NV - 2, Math.floor(f))
      const [w0, w1, w2, w3] = catmullRomWeights(f - i1)
      frontVTable[j] = { i0: Math.max(0, i1 - 1), i1, i2: i1 + 1, i3: Math.min(SIM_FRONT_NV - 1, i1 + 2), w0, w1, w2, w3 }
    } else if (s <= FRONT_LEN + WRAP_LEN) {
      rowRegion[j] = 1
      const angle = (s - FRONT_LEN) / ROD_RADIUS
      rowWrapAngle[j] = angle
      rowWrapSin[j] = Math.sin(angle)
      rowWrapCos[j] = Math.cos(angle)
    } else {
      rowRegion[j] = 2
      const d = (s - FRONT_LEN - WRAP_LEN) / BACK_LEN
      const f = THREE.MathUtils.clamp(d, 0, 1) * (SIM_BACK_NV - 1)
      const i1 = Math.min(SIM_BACK_NV - 2, Math.floor(f))
      const [w0, w1, w2, w3] = catmullRomWeights(f - i1)
      backVTable[j] = { i0: Math.max(0, i1 - 1), i1, i2: i1 + 1, i3: Math.min(SIM_BACK_NV - 1, i1 + 2), w0, w1, w2, w3 }
    }
  }

  const tmpSample = new THREE.Vector3()
  const tmpCrown = new THREE.Vector3()
  const frontSimCopy = new Float32Array(SIM_NU * SIM_FRONT_NV * 3)
  const backSimCopy = new Float32Array(SIM_NU * SIM_BACK_NV * 3)

  /**
   * Evaluates the top-fold crown curve for column u in [0, 1] and wrap angle in [0, PI].
   * - When rodWrapBlend === 1 and carryBlend === 0: exact r = 0.073 wooden-rod wrap.
   * - When carried in midair (carryBlend > 0, rodWrapBlend < 1): pinches around carryGrabU
   *   with a collapsed soft cotton fold (r ~ 0.018..0.028) and wet gravity droop — NO hollow rod cylinder!
   * - When emerging from rinse basin (unfoldAmount < 1): compacts smoothly into a wet gathered bundle.
   */
  function evalCrownPoint(u: number, angle: number, out: THREE.Vector3): THREE.Vector3 {
    const xBase = (u - .5) * CLOTH_W
    const sAng = Math.sin(angle), cAng = Math.cos(angle)
    if (rodWrapBlend >= 0.999 && carryBlend <= 0.001 && unfoldAmount >= 0.999) {
      return out.set(xBase, ROD_RADIUS * sAng, ROD_RADIUS * cAng)
    }
    const rodX = xBase, rodY = ROD_RADIUS * sAng, rodZ = ROD_RADIUS * cAng

    // Pinched hand-carry crown around carryGrabU (collapses hollow cylinder into soft folded wet cloth).
    const grabX = (carryGrabU - .5) * CLOTH_W
    const dx = xBase - grabX
    const dNorm = Math.abs(dx) / (CLOTH_W * 0.65)
    const gatherScale = 1 - 0.34 * carryBlend
    const pinchR = THREE.MathUtils.lerp(0.028 + 0.010 * Math.min(1, dNorm), ROD_RADIUS, rodWrapBlend)
    const pinchPeak = 0.072 * Math.exp(-dNorm * dNorm * 4.8)
    const sideDroop = -0.205 * (1 - Math.exp(-dNorm * dNorm * 2.0))
    const pleatZ = (0.020 * Math.sin(u * Math.PI * 4.8 + .55) + 0.012 * Math.cos(u * Math.PI * 3.0 - .4)) * Math.min(1, dNorm * 1.4)

    const carryX = grabX + dx * gatherScale + carrySwayX * 0.055 * dNorm
    const carryY = pinchPeak + sideDroop + pinchR * sAng
    const carryZ = pinchR * cAng + pleatZ + carrySwayZ * 0.075 * dNorm

    let x = THREE.MathUtils.lerp(rodX, carryX, carryBlend)
    let y = THREE.MathUtils.lerp(rodY, carryY, carryBlend)
    let z = THREE.MathUtils.lerp(rodZ, carryZ, carryBlend)

    // When rodWrapBlend < 1 even with carryBlend == 0 (e.g. basin unfold or mid over-rod spread),
    // keep the crown radius softly folded rather than locked to a wide hollow cylinder.
    if (carryBlend < 0.999 && rodWrapBlend < 0.999) {
      const rSoft = THREE.MathUtils.lerp(0.022, ROD_RADIUS, rodWrapBlend)
      const softY = rSoft * sAng + 0.024 * (1 - rodWrapBlend) * Math.sin(Math.PI * u)
      const softZ = rSoft * cAng + 0.018 * (1 - rodWrapBlend) * Math.sin(u * Math.PI * 4.0)
      const wUnwrap = (1 - carryBlend) * (1 - rodWrapBlend)
      y = THREE.MathUtils.lerp(y, softY, wUnwrap)
      z = THREE.MathUtils.lerp(z, softZ, wUnwrap)
    }

    // Basin wet-unfold compression (unfoldAmount 0 -> 1 smoothly fans width out from rinse water).
    if (unfoldAmount < 0.999) {
      const uOpen = smoothstep01(unfoldAmount)
      const wScale = THREE.MathUtils.lerp(0.24, 1.0, uOpen)
      const wetRipple = (1 - uOpen) * 0.032 * Math.sin(u * Math.PI * 5.0 + 0.4)
      x *= wScale
      y = THREE.MathUtils.lerp(y * 0.55 - 0.04 * (1 - Math.sin(Math.PI * u)), y, uOpen)
      z = z * THREE.MathUtils.lerp(0.42, 1.0, uOpen) + wetRipple
    }
    return out.set(x, y, z)
  }

  /** Authored zero-WASM cloth evaluator for basin unfold, pinched air carry, and resting rod drape. */
  function evalAuthoredMidsurface(u: number, v: number, isWet: boolean, out: THREE.Vector3): THREE.Vector3 {
    const s = v * TOTAL_LEN
    if (rodWrapBlend >= 0.999 && carryBlend <= 0.001 && unfoldAmount >= 0.999) {
      return evalRestingMidsurface(u, v, isWet, out)
    }
    if (s >= FRONT_LEN && s <= FRONT_LEN + WRAP_LEN) {
      return evalCrownPoint(u, (s - FRONT_LEN) / ROD_RADIUS, out)
    }
    const isFront = s < FRONT_LEN
    const d = isFront ? (FRONT_LEN - s) / FRONT_LEN : (s - FRONT_LEN - WRAP_LEN) / BACK_LEN
    const len = isFront ? FRONT_LEN : BACK_LEN
    evalCrownPoint(u, isFront ? 0 : Math.PI, tmpCrown)
    const cx = tmpCrown.x, cy = tmpCrown.y, cz = tmpCrown.z

    const uOpen = smoothstep01(unfoldAmount)
    const lenScale = THREE.MathUtils.lerp(0.24, 1.0, uOpen)
    const d13 = Math.pow(d, 1.3), d16 = Math.pow(d, 1.6)
    const grabX = (carryGrabU - .5) * CLOTH_W
    const distGrab = Math.abs((u - .5) * CLOTH_W - grabX) / (CLOTH_W * 0.65)
    // Fan slightly wider near hem than pinched hand grip while keeping natural wet vertical pleats.
    const hemFan = (cx - grabX) * (0.20 * d13 * carryBlend)
    const swayDragX = carrySwayX * (0.14 + 0.24 * d16) * carryBlend
    const swayDragZ = carrySwayZ * (0.12 + 0.22 * d16) * carryBlend
    const foldWave = (
      .042 * Math.sin(u * Math.PI * 3.5 + (isFront ? .45 : 1.35)) +
      .024 * Math.cos(u * Math.PI * 5.4 - (isFront ? .85 : .25))
    ) * d13 * THREE.MathUtils.lerp(0.55, 1.05, uOpen)
    const separation = (isFront ? 1 : -1) * (0.020 + 0.024 * d13) * (1 - rodWrapBlend * 0.45)
    const x = cx + hemFan + swayDragX
    const y = cy - d * len * lenScale + 0.024 * Math.sin(u * Math.PI * 3.1) * d * d * uOpen
    const z = cz + separation + foldWave + swayDragZ + (isFront ? 0.022 : -0.012) * d16 * distGrab * carryBlend
    return out.set(x, y, z)
  }

  function flushMidGridToClothGeometry() {
    const posAttr = clothGeo.getAttribute('position') as THREE.BufferAttribute
    const clothX = cloth.position.x, clothY = cloth.position.y, clothZ = cloth.position.z
    const lockedOnRod = rodWrapBlend >= 0.999 && carryBlend <= 0.001 && unfoldAmount >= 0.999
    const nearBasin = Math.abs(clothX - BASIN_CENTER.x) < 0.85 && clothY < 1.85
    const minLocalY = Math.max(-0.675, 0.095 - clothY)

    for (let j = 0; j <= CLOTH_NY; j++) {
      const region = rowRegion[j]!
      if (lockedOnRod && region === 1) continue
      for (let i = 0; i <= CLOTH_NX; i++) {
        const idx = (j * (CLOTH_NX + 1) + i) * 3
        let lx = midGrid[idx]!, ly = midGrid[idx + 1]!, lz = midGrid[idx + 2]!
        if (ly < minLocalY) ly = minLocalY

        if (lockedOnRod) {
          // Seated on rod: keep front & back curtains strictly outside solid wooden rod cylinder (r = 0.070).
          if (ly > 0.014) ly = 0.014
          if (ly > -0.14) {
            const signZ = region === 0 ? 1 : -1
            const minZ = ROD_RADIUS + 0.002
            if (signZ * lz < minZ && ly > -0.06) lz = signZ * minZ
            const r2 = ly * ly + lz * lz
            const minR = ROD_RADIUS + 0.004
            if (r2 < minR * minR) {
              const neededZ = Math.sqrt(Math.max(0, minR * minR - ly * ly))
              lz = signZ * Math.max(Math.abs(lz), neededZ)
            }
          }
        } else {
          // Unlocked carry / unfold / over-rod: explicit world-space clearance against BOTH wooden rods!
          const wx = clothX + lx, wy = clothY + ly, wz = clothZ + lz
          for (const [rodPos, halfLen] of [[RINSED, 0.71], [HUNG, 0.79]] as const) {
            if (Math.abs(wx - rodPos.x) <= halfLen + 0.02) {
              const dy = wy - rodPos.y, dz = wz - rodPos.z
              const r = Math.hypot(dy, dz)
              const safeR = ROD_RADIUS + 0.005
              if (r < safeR) {
                if (region === 1 || dy >= -0.01) {
                  const targetDy = Math.sqrt(Math.max(0, safeR * safeR - dz * dz))
                  ly = rodPos.y + Math.max(dy, targetDy) - clothY
                } else {
                  const signZ = region === 0 ? 1 : -1
                  const targetDz = Math.sqrt(Math.max(0, safeR * safeR - dy * dy))
                  lz = rodPos.z + signZ * Math.max(Math.abs(dz), targetDz) - clothZ
                }
              }
            }
          }
        }

        // Ceramic basin exterior & rim wall clearance (protects both rinsed pose and entire basin unfold lift!).
        if (nearBasin) {
          const wx = clothX + lx, wy = clothY + ly, wz = clothZ + lz
          const bY = wy - BASIN_CENTER.y
          const outerR = basinOuterRadius(bY)
          if (outerR > 0) {
            const dx = wx - BASIN_CENTER.x, dz = wz - BASIN_CENTER.z
            const dist = Math.hypot(dx, dz)
            const safeR = outerR + 0.026
            if (unfoldAmount < 0.25 && dist < 0.34) {
              // Inside water hollow at start of rise: keep strictly above water surface and inside inner rim.
              if (wy < 0.43) ly = 0.43 - clothY
            } else if (dist < safeR) {
              if (clothY >= 0.92 && bY >= 0.32) {
                // Lifting high over the basin: clear cleanly above the 0.57m ceramic rim.
                ly = Math.max(ly, (BASIN_CENTER.y + 0.56) - clothY)
              } else {
                // Draped in front of basin: push strictly forward outside the outer ceramic wall.
                const targetDz = Math.sqrt(Math.max(0, safeR * safeR - dx * dx))
                lz = BASIN_CENTER.z + targetDz - clothZ
              }
            }
          }
        }
        midGrid[idx] = lx; midGrid[idx + 1] = ly; midGrid[idx + 2] = lz
      }
    }

    // Offset front (outer) and back (inner) layers along smooth midsurface normals.
    for (let j = 0; j <= CLOTH_NY; j++) {
      const region = rowRegion[j]!
      const jPrev = Math.max(0, j - 1), jNext = Math.min(CLOTH_NY, j + 1)
      for (let i = 0; i <= CLOTH_NX; i++) {
        const k = j * (CLOTH_NX + 1) + i
        const mx = midGrid[k * 3]!, my = midGrid[k * 3 + 1]!, mz = midGrid[k * 3 + 2]!
        let nx = 0, ny = 0, nz = 1
        if (lockedOnRod && region === 1) {
          // Exact cylindrical radial normal when seated on the wooden rod -> radii stay strictly 0.070..0.076.
          ny = rowWrapSin[j]!
          nz = rowWrapCos[j]!
        } else {
          const iPrev = Math.max(0, i - 1), iNext = Math.min(CLOTH_NX, i + 1)
          const kL = (j * (CLOTH_NX + 1) + iPrev) * 3, kR = (j * (CLOTH_NX + 1) + iNext) * 3
          const kD = (jPrev * (CLOTH_NX + 1) + i) * 3, kU = (jNext * (CLOTH_NX + 1) + i) * 3
          const ux = midGrid[kR]! - midGrid[kL]!, uy = midGrid[kR + 1]! - midGrid[kL + 1]!, uz = midGrid[kR + 2]! - midGrid[kL + 2]!
          const vx = midGrid[kU]! - midGrid[kD]!, vy = midGrid[kU + 1]! - midGrid[kD + 1]!, vz = midGrid[kU + 2]! - midGrid[kD + 2]!
          nx = uy * vz - uz * vy
          ny = uz * vx - ux * vz
          nz = ux * vy - uy * vx
          const len = Math.hypot(nx, ny, nz) || 1
          nx /= len; ny /= len; nz /= len
        }
        posAttr.setXYZ(k, mx + nx * HALF_THICK, my + ny * HALF_THICK, mz + nz * HALF_THICK)
        posAttr.setXYZ(k + layerCount, mx - nx * HALF_THICK, my - ny * HALF_THICK, mz - nz * HALF_THICK)
      }
    }
    posAttr.needsUpdate = true
    clothGeo.computeVertexNormals()
    clothGeo.computeBoundingBox()
    clothGeo.computeBoundingSphere()
  }

  let lastRestingWet: boolean | null = null
  function writeAuthoredCloth(force = false) {
    const isWet = at <= 1
    const isStandardPose = rodWrapBlend >= 0.999 && carryBlend <= 0.001 && unfoldAmount >= 0.999
    if (!force && isStandardPose && lastRestingWet === isWet && !physicsStepped) return
    for (let j = 0; j <= CLOTH_NY; j++) {
      const v = j / CLOTH_NY
      for (let i = 0; i <= CLOTH_NX; i++) {
        evalAuthoredMidsurface(i / CLOTH_NX, v, isWet, tmpSample)
        const k = (j * (CLOTH_NX + 1) + i) * 3
        midGrid[k] = tmpSample.x
        midGrid[k + 1] = tmpSample.y
        midGrid[k + 2] = tmpSample.z
      }
    }
    flushMidGridToClothGeometry()
    lastRestingWet = isStandardPose ? isWet : null
    markDirty()
  }

  // ---------------------------------------------------------------------------
  // Lazy-loaded Rapier soft-body simulation (234 particles in cloth-local space):
  // front curtain (13x10) + back curtain (13x8) pinned along dynamic crown lines,
  // with KINEMATIC real-world rod/basin/floor colliders, breeze, carry inertia,
  // over-rod landing swing, and optional smoothing impulses.
  // Never initializes WASM on construction, at entry (p=0), or in reducedMotion.
  // ---------------------------------------------------------------------------
  let frontBody: ReturnType<RapierSoftBodySession['createCloth']> | null = null
  let backBody: ReturnType<RapierSoftBodySession['createCloth']> | null = null
  let rodCollider: ReturnType<RapierSoftBodySession['addKinematicCylinder']> | null = null
  let basinCollider: ReturnType<RapierSoftBodySession['addKinematicCylinder']> | null = null
  let floorCollider: ReturnType<RapierSoftBodySession['addKinematicBox']> | null = null
  let rapierReady = false
  let physicsStepped = false
  let simClock = 0
  let wasReduced = false
  const prevClothPos = new THREE.Vector3().copy(RINSED)
  const prevClothVel = new THREE.Vector3()
  const inertialAccel = new THREE.Vector3()
  const rotZ90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  const rotZ90Like = { x: rotZ90.x, y: rotZ90.y, z: rotZ90.z, w: rotZ90.w }

  const pinnedFrontTop: number[] = []
  const pinnedBackTop: number[] = []
  for (let i = 0; i < SIM_NU; i++) {
    pinnedFrontTop.push(i * SIM_FRONT_NV)
    pinnedBackTop.push(i * SIM_BACK_NV)
  }

  function syncKinematicColliders() {
    if (rodCollider) {
      // Engage the solid wooden rod collider at cloth-local (0,0,0) only once the crown has opened
      // around the bar (rodWrapBlend >= 0.85). Parking it out of the way while pinched in midair
      // or cresting prevents the 0.14m cylinder from sweeping up through the pinched skirt and snagging
      // mid-curtain particles, while flushMidGridToClothGeometry() enforces exact world-space rod clearance.
      if (rodWrapBlend >= 0.85) {
        rodCollider.setPose({ x: 0, y: 0, z: 0 }, rotZ90Like)
      } else {
        rodCollider.setPose({ x: 0, y: -12, z: 0 }, rotZ90Like)
      }
    }
    if (basinCollider) {
      const bx = BASIN_CENTER.x - cloth.position.x
      const by = (BASIN_CENTER.y + 0.25) - cloth.position.y
      const bz = BASIN_CENTER.z - cloth.position.z
      basinCollider.setPose({ x: bx, y: by, z: bz })
    }
    if (floorCollider) {
      floorCollider.setPose({ x: 0, y: -0.05 - cloth.position.y, z: 0 })
    }
  }

  function resetSoftBodiesToCurrentAuthored() {
    const isWet = at <= 1
    if (frontBody && frontBody.isValid()) {
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        for (let j = 0; j < SIM_FRONT_NV; j++) {
          const d = j / (SIM_FRONT_NV - 1)
          const v = ((1 - d) * FRONT_LEN) / TOTAL_LEN
          evalAuthoredMidsurface(u, v, isWet, tmpSample)
          const k = i * SIM_FRONT_NV + j
          frontBody.setParticlePosition(k, { x: tmpSample.x, y: tmpSample.y, z: tmpSample.z })
          frontBody.setParticleVelocity(k, { x: 0, y: 0, z: 0 })
        }
      }
    }
    if (backBody && backBody.isValid()) {
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        for (let j = 0; j < SIM_BACK_NV; j++) {
          const d = j / (SIM_BACK_NV - 1)
          const v = (FRONT_LEN + WRAP_LEN + d * BACK_LEN) / TOTAL_LEN
          evalAuthoredMidsurface(u, v, isWet, tmpSample)
          const k = i * SIM_BACK_NV + j
          backBody.setParticlePosition(k, { x: tmpSample.x, y: tmpSample.y, z: tmpSample.z })
          backBody.setParticleVelocity(k, { x: 0, y: 0, z: 0 })
        }
      }
    }
    syncKinematicColliders()
  }

  function applyClothForces(_session: RapierSoftBodySession, subDt: number) {
    simClock += subDt
    const t = simClock
    const isWet = at <= 1 && motion?.step !== 1
    const isCarrying = carryBlend > 0.05 || rodWrapBlend < 0.95
    // Freshly hung cloth starts with fuller newly-draped folds (smoothness ~0.2) that open smoothly when stroked.
    const newlyHungBunch = at === 2 ? (1 - hungSmoothness) : 0
    const breezeScale = isCarrying ? 0.35 : isWet ? 0.38 : 1.0

    if (frontBody && frontBody.isValid()) {
      frontBody.resetForces(false)
      const pos = frontBody.particlePositions()
      const vel = frontBody.particleVelocities()
      const pMass = Math.max(frontBody.mass() / (SIM_NU * SIM_FRONT_NV), 1e-4)
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        evalCrownPoint(u, 0, tmpCrown)
        frontBody.setParticleKinematicTarget(i * SIM_FRONT_NV, { x: tmpCrown.x, y: tmpCrown.y, z: tmpCrown.z })
        for (let j = 1; j < SIM_FRONT_NV; j++) {
          const d = j / (SIM_FRONT_NV - 1)
          const dRamp = THREE.MathUtils.smoothstep(d, 0.08, 0.90)
          const pleatRamp = THREE.MathUtils.smoothstep(d, 0.18, 0.92)
          const k = i * SIM_FRONT_NV + j
          const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!
          const phase1 = t * 1.95 - u * 3.6 - d * 2.9
          const phase2 = t * 3.15 - u * 5.8 + d * 2.2
          const gustEnvelope = 0.42 + 0.85 * Math.pow(u, 1.15)
          const windZ = (3.45 + 3.25 * Math.sin(phase1) + 1.35 * Math.cos(phase2)) * breezeScale * dRamp * gustEnvelope
          const windX = (1.65 + 1.85 * Math.cos(phase1 * 0.82 + 0.35)) * breezeScale * dRamp * (0.55 + 0.55 * u)
          const windY = (0.85 + 1.15 * Math.sin(phase1 + 0.45)) * breezeScale * dRamp * Math.pow(u, 1.2)
          const pleatAmp = (isWet ? 1.15 : 0.95) * (1 + 0.65 * newlyHungBunch)
          const pleatZ = (1.95 * Math.sin(u * Math.PI * 3.1 + .45) + 1.25 * Math.cos(u * Math.PI * 5.0 - .95)) * pleatRamp * pleatAmp
          // Gentle inward gathering on carried wet cloth or newly-hung creases before smoothing (never pinching at rod tangent!).
          let gatherFx = 0
          if (carryBlend > 0.02) {
            const grabX = (carryGrabU - .5) * CLOTH_W
            const targetX = grabX + ((u - .5) * CLOTH_W - grabX) * (1 - 0.24 * carryBlend * (1 - 0.35 * d))
            gatherFx = (targetX - pos[k * 3]!) * 14 * carryBlend * dRamp
          } else if (newlyHungBunch > 0.01) {
            gatherFx = -(u - .5) * 1.45 * newlyHungBunch * pleatRamp
          }
          // Guide upper front skirt cleanly onto the +Z side of the wooden rod while opening/wrapping.
          let rodPushZ = 0
          if (rodWrapBlend > 0.15 && j <= 4 && pos[k * 3 + 2]! < ROD_RADIUS + 0.016) {
            rodPushZ = (ROD_RADIUS + 0.016 - pos[k * 3 + 2]!) * 75 * rodWrapBlend
          }
          const fx = windX + gatherFx + inertialAccel.x * dRamp - 1.25 * vx
          const fy = windY + inertialAccel.y * dRamp - 1.15 * vy
          const fz = windZ + pleatZ + rodPushZ + inertialAccel.z * dRamp - 1.25 * vz
          frontBody.addParticleForce(k, { x: pMass * fx, y: pMass * fy, z: pMass * fz }, false)
        }
      }
    }

    if (backBody && backBody.isValid()) {
      backBody.resetForces(false)
      const pos = backBody.particlePositions()
      const vel = backBody.particleVelocities()
      const pMass = Math.max(backBody.mass() / (SIM_NU * SIM_BACK_NV), 1e-4)
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        evalCrownPoint(u, Math.PI, tmpCrown)
        backBody.setParticleKinematicTarget(i * SIM_BACK_NV, { x: tmpCrown.x, y: tmpCrown.y, z: tmpCrown.z })
        for (let j = 1; j < SIM_BACK_NV; j++) {
          const d = j / (SIM_BACK_NV - 1)
          const dRamp = THREE.MathUtils.smoothstep(d, 0.06, 0.90)
          const k = i * SIM_BACK_NV + j
          const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!
          const phase1 = t * 1.95 - u * 3.6 - d * 2.6 - 1.05
          const phase2 = t * 3.05 - u * 5.1 + d * 1.8
          const windZ = (isWet ? 0.65 : (-0.75 + 2.35 * Math.sin(phase1) + 0.90 * Math.cos(phase2))) * breezeScale * dRamp
          const windX = (1.35 + 1.45 * Math.cos(phase1 * 0.85 + 0.85)) * breezeScale * dRamp
          const pleatZ = (1.15 * Math.sin(u * Math.PI * 3.1 + 1.35)) * dRamp * (isWet ? 0.75 : 0.95)
          let gatherFx = 0
          if (carryBlend > 0.02) {
            const grabX = (carryGrabU - .5) * CLOTH_W
            const targetX = grabX + ((u - .5) * CLOTH_W - grabX) * (1 - 0.24 * carryBlend * (1 - 0.35 * d))
            gatherFx = (targetX - pos[k * 3]!) * 14 * carryBlend * dRamp
          }
          // Guide upper back skirt cleanly onto the -Z side of the wooden rod while opening/wrapping.
          let rodPushZ = 0
          if (rodWrapBlend > 0.15 && j <= 4 && pos[k * 3 + 2]! > -(ROD_RADIUS + 0.016)) {
            rodPushZ = (-(ROD_RADIUS + 0.016) - pos[k * 3 + 2]!) * 75 * rodWrapBlend
          }
          const fx = windX + gatherFx + inertialAccel.x * dRamp - 1.30 * vx
          const fy = inertialAccel.y * dRamp - 1.20 * vy
          const fz = windZ + pleatZ + rodPushZ + inertialAccel.z * dRamp - 1.35 * vz
          backBody.addParticleForce(k, { x: pMass * fx, y: pMass * fy, z: pMass * fz }, false)
        }
      }
    }
  }

  /**
   * Post-substep solver invariant guard: prevents frontBody & backBody from ever crossing or
   * interlocking inside Rapier during fast carry/over-rod arcs, and keeps upper wrapped rows
   * monotonically descending so no folded pocket can form inside the soft-body state.
   */
  function enforceRapierClothInvariants() {
    if (!frontBody || !frontBody.isValid() || !backBody || !backBody.isValid()) return
    const fPos = frontBody.particlePositions()
    const fVel = frontBody.particleVelocities()
    const bPos = backBody.particlePositions()
    const bVel = backBody.particleVelocities()
    const minSep = THREE.MathUtils.lerp(0.040, 0.036, rodWrapBlend)
    const minDropF = (FRONT_LEN / (SIM_FRONT_NV - 1)) * 0.48 * rodWrapBlend
    const minDropB = (BACK_LEN / (SIM_BACK_NV - 1)) * 0.48 * rodWrapBlend

    for (let i = 0; i < SIM_NU; i++) {
      if (rodWrapBlend > 0.45) {
        let prevFY = fPos[i * SIM_FRONT_NV * 3 + 1]!
        for (let j = 1; j < SIM_FRONT_NV; j++) {
          const k = i * SIM_FRONT_NV + j
          let x = fPos[k * 3]!, y = fPos[k * 3 + 1]!, z = fPos[k * 3 + 2]!
          let vx = fVel[k * 3]!, vy = fVel[k * 3 + 1]!, vz = fVel[k * 3 + 2]!
          let changed = false
          if (y > prevFY - minDropF) {
            y = prevFY - minDropF
            if (vy > 0) vy *= 0.25
            changed = true
          }
          if (j <= 3 && y > -0.18 && z < ROD_RADIUS + 0.008) {
            z = ROD_RADIUS + 0.008
            if (vz < 0) vz = 0
            changed = true
          }
          if (changed) {
            frontBody.setParticlePosition(k, { x, y, z })
            frontBody.setParticleVelocity(k, { x: vx, y: vy, z: vz })
          }
          prevFY = y
        }
        let prevBY = bPos[i * SIM_BACK_NV * 3 + 1]!
        for (let j = 1; j < SIM_BACK_NV; j++) {
          const k = i * SIM_BACK_NV + j
          let x = bPos[k * 3]!, y = bPos[k * 3 + 1]!, z = bPos[k * 3 + 2]!
          let vx = bVel[k * 3]!, vy = bVel[k * 3 + 1]!, vz = bVel[k * 3 + 2]!
          let changed = false
          if (y > prevBY - minDropB) {
            y = prevBY - minDropB
            if (vy > 0) vy *= 0.25
            changed = true
          }
          if (j <= 3 && y > -0.18 && z > -(ROD_RADIUS + 0.008)) {
            z = -(ROD_RADIUS + 0.008)
            if (vz > 0) vz = 0
            changed = true
          }
          if (changed) {
            backBody.setParticlePosition(k, { x, y, z })
            backBody.setParticleVelocity(k, { x: vx, y: vy, z: vz })
          }
          prevBY = y
        }
      }

      // Keep backBody strictly behind frontBody inside the physics world so surface colliders never snag.
      const fPosCur = frontBody.particlePositions()
      const bPosCur = backBody.particlePositions()
      for (let j = 1; j < SIM_BACK_NV; j++) {
        const jf = Math.min(SIM_FRONT_NV - 1, Math.round((j / (SIM_BACK_NV - 1)) * (BACK_LEN / FRONT_LEN) * (SIM_FRONT_NV - 1)))
        const frontZ = fPosCur[(i * SIM_FRONT_NV + jf) * 3 + 2]!
        const kb = i * SIM_BACK_NV + j
        const bz = bPosCur[kb * 3 + 2]!
        if (bz > frontZ - minSep) {
          backBody.setParticlePosition(kb, { x: bPosCur[kb * 3]!, y: bPosCur[kb * 3 + 1]!, z: frontZ - minSep })
          const bvz = bVel[kb * 3 + 2]!
          if (bvz > 0) backBody.setParticleVelocity(kb, { x: bVel[kb * 3]!, y: bVel[kb * 3 + 1]!, z: 0 })
        }
      }
    }
  }

  function writeClothFromRapier() {
    if (!frontBody || !frontBody.isValid() || !backBody || !backBody.isValid()) return
    frontSimCopy.set(frontBody.particlePositions())
    backSimCopy.set(backBody.particlePositions())

    // Pin top rows to the live dynamic crown (pinched fold in air, exact rod tangent when seated!)
    // and enforce strict front/back Z separation so the dual curtains never self-intersect.
    const minSep = THREE.MathUtils.lerp(0.028, 0.022, rodWrapBlend)
    for (let i = 0; i < SIM_NU; i++) {
      const u = i / (SIM_NU - 1)
      evalCrownPoint(u, 0, tmpCrown)
      const kf = i * SIM_FRONT_NV * 3
      frontSimCopy[kf] = tmpCrown.x; frontSimCopy[kf + 1] = tmpCrown.y; frontSimCopy[kf + 2] = tmpCrown.z

      evalCrownPoint(u, Math.PI, tmpCrown)
      const kb = i * SIM_BACK_NV * 3
      backSimCopy[kb] = tmpCrown.x; backSimCopy[kb + 1] = tmpCrown.y; backSimCopy[kb + 2] = tmpCrown.z

      // Keep top-adjacent simulation rows strictly clear of the wooden rod and monotonically descending
      // when wrapped/seated so landing deceleration or smoothing strokes never fold rows upward over each other.
      if (rodWrapBlend > 0.5) {
        const minZ = ROD_RADIUS + 0.004
        const minDropF = (FRONT_LEN / (SIM_FRONT_NV - 1)) * 0.52 * rodWrapBlend
        const minDropB = (BACK_LEN / (SIM_BACK_NV - 1)) * 0.52 * rodWrapBlend
        for (let j = 1; j < SIM_FRONT_NV; j++) {
          const prevY = frontSimCopy[(i * SIM_FRONT_NV + (j - 1)) * 3 + 1]!
          const fyIdx = (i * SIM_FRONT_NV + j) * 3 + 1
          const fzIdx = (i * SIM_FRONT_NV + j) * 3 + 2
          if (frontSimCopy[fyIdx]! > prevY - minDropF) frontSimCopy[fyIdx] = prevY - minDropF
          if (j <= 2 && frontSimCopy[fyIdx]! > -0.14 && frontSimCopy[fzIdx]! < minZ) frontSimCopy[fzIdx] = minZ
        }
        for (let j = 1; j < SIM_BACK_NV; j++) {
          const prevY = backSimCopy[(i * SIM_BACK_NV + (j - 1)) * 3 + 1]!
          const byIdx = (i * SIM_BACK_NV + j) * 3 + 1
          const bzIdx = (i * SIM_BACK_NV + j) * 3 + 2
          if (backSimCopy[byIdx]! > prevY - minDropB) backSimCopy[byIdx] = prevY - minDropB
          if (j <= 2 && backSimCopy[byIdx]! > -0.14 && backSimCopy[bzIdx]! > -minZ) backSimCopy[bzIdx] = -minZ
        }
      }

      for (let j = 1; j < SIM_BACK_NV; j++) {
        const jf = Math.min(SIM_FRONT_NV - 1, Math.round((j / (SIM_BACK_NV - 1)) * (BACK_LEN / FRONT_LEN) * (SIM_FRONT_NV - 1)))
        const frontZ = frontSimCopy[(i * SIM_FRONT_NV + jf) * 3 + 2]!
        const bIdx = (i * SIM_BACK_NV + j) * 3 + 2
        if (backSimCopy[bIdx]! > frontZ - minSep) {
          backSimCopy[bIdx] = frontZ - minSep
        }
      }
    }

    for (let j = 0; j <= CLOTH_NY; j++) {
      const region = rowRegion[j]!
      if (region === 1) {
        const angle = rowWrapAngle[j]!
        for (let i = 0; i <= CLOTH_NX; i++) {
          evalCrownPoint(i / CLOTH_NX, angle, tmpCrown)
          const k = (j * (CLOTH_NX + 1) + i) * 3
          midGrid[k] = tmpCrown.x
          midGrid[k + 1] = tmpCrown.y
          midGrid[k + 2] = tmpCrown.z
        }
      } else if (region === 0) {
        const vRow = frontVTable[j]!
        for (let i = 0; i <= CLOTH_NX; i++) {
          sampleGridPoint(frontSimCopy, SIM_FRONT_NV, U_TABLE[i]!, vRow, tmpSample)
          const k = (j * (CLOTH_NX + 1) + i) * 3
          midGrid[k] = tmpSample.x; midGrid[k + 1] = tmpSample.y; midGrid[k + 2] = tmpSample.z
        }
      } else {
        const vRow = backVTable[j]!
        for (let i = 0; i <= CLOTH_NX; i++) {
          sampleGridPoint(backSimCopy, SIM_BACK_NV, U_TABLE[i]!, vRow, tmpSample)
          const k = (j * (CLOTH_NX + 1) + i) * 3
          midGrid[k] = tmpSample.x; midGrid[k + 1] = tmpSample.y; midGrid[k + 2] = tmpSample.z
        }
      }
    }
    flushMidGridToClothGeometry()
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 6,
    internalPgsIterations: 3,
    sleepSpeedThreshold: 0,
    isActive: active,
    isReducedMotion: reduced,
    onReady(session) {
      if (disposed) return
      // Kinematic wooden rod collider tracks actual wooden support in cloth-local space
      // (zero phantom cylinder during midair carry; real cylindrical collision over the drying rail!).
      rodCollider = session.addKinematicCylinder({ x: 0, y: 0, z: 0 }, 0.068, 1.62, {
        rotation: rotZ90Like,
        friction: 0.72,
        restitution: 0.02,
      })
      basinCollider = session.addKinematicCylinder({ x: 0, y: -0.50, z: -0.59 }, 0.48, 0.56, {
        friction: 0.65,
        restitution: 0.02,
      })
      floorCollider = session.addKinematicBox({ x: 0, y: -0.84, z: 0 }, { x: 4.0, y: 0.10, z: 3.0 }, {
        friction: 0.75,
        restitution: 0.02,
      })

      const simWidth = CLOTH_W * 1.05
      frontBody = session.createCloth({
        origin: { x: -simWidth / 2, y: 0, z: ROD_RADIUS },
        du: { x: simWidth / (SIM_NU - 1), y: 0, z: 0 },
        dv: { x: 0, y: -FRONT_LEN / (SIM_FRONT_NV - 1), z: 0 },
        nu: SIM_NU,
        nv: SIM_FRONT_NV,
        mass: 0.28,
        particleRadius: 0.016,
        gravityScale: 0.96,
        linearDamping: 1.25,
        edgeSoftness: { naturalFrequency: 22, dampingRatio: 0.84 },
        bendSoftness: { naturalFrequency: 1.85, dampingRatio: 0.74 },
        tensionOnly: true,
        pinnedParticles: pinnedFrontTop,
        friction: 0.55,
        restitution: 0.02,
        canSleep: false,
      })

      backBody = session.createCloth({
        origin: { x: -simWidth / 2, y: 0, z: -ROD_RADIUS },
        du: { x: simWidth / (SIM_NU - 1), y: 0, z: 0 },
        dv: { x: 0, y: -BACK_LEN / (SIM_BACK_NV - 1), z: 0 },
        nu: SIM_NU,
        nv: SIM_BACK_NV,
        mass: 0.22,
        particleRadius: 0.016,
        gravityScale: 0.96,
        linearDamping: 1.35,
        edgeSoftness: { naturalFrequency: 22, dampingRatio: 0.84 },
        bendSoftness: { naturalFrequency: 1.85, dampingRatio: 0.74 },
        tensionOnly: true,
        pinnedParticles: pinnedBackTop,
        friction: 0.55,
        restitution: 0.02,
        canSleep: false,
      })

      rapierReady = true
      prevClothPos.copy(cloth.position)
      prevClothVel.set(0, 0, 0)
      inertialAccel.set(0, 0, 0)
      resetSoftBodiesToCurrentAuthored()
      const clothActive = at >= 1 || (motion?.step === 0 && motion.time >= 0.30)
      if (!reduced() && clothActive) {
        if (!motion) host.settle(42, applyClothForces)
        physicsStepped = true
        writeClothFromRapier()
      }
    },
  })

  function ensureRapierStarted() {
    const clothActive = at >= 1 || (motion?.step === 0 && motion.time >= 0.30)
    if (!started || disposed || !clothActive || reduced()) return
    void host.start()
  }

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const clearHandlingState = (seatedSmoothness = 1) => {
    rodWrapBlend = 1
    carryBlend = 0
    carrySwayX = 0
    carrySwayZ = 0
    unfoldAmount = 1
    hungSmoothness = seatedSmoothness
    smoothingPointer = false
    hasSmoothLast = false
    bundle.scale.set(1, 1, 1)
  }
  const restore = (reseedPhysics = true, seatedSmoothness = 1) => {
    clearHandlingState(seatedSmoothness)
    bundle.position.copy(BUNDLE_HOME); bundle.visible = at === 0
    cloth.visible = at >= 1; cloth.position.copy(at >= 2 ? HUNG : RINSED)
    setRinseDyeMix(at >= 1 ? 1 : 0)
    if (at === 0 || reduced()) {
      liquidClock = 0
      dragWaterCooldown = 0
      rinseWater.reset()
    }
    prevClothPos.copy(cloth.position); prevClothVel.set(0, 0, 0); inertialAccel.set(0, 0, 0)
    lastDragPos.copy(cloth.position)
    if (at >= 1) {
      if (reseedPhysics && rapierReady && !reduced()) {
        resetSoftBodiesToCurrentAuthored()
        host.settle(24, applyClothForces)
        physicsStepped = true
        writeClothFromRapier()
      } else if (!physicsStepped || reduced()) {
        physicsStepped = false
        writeAuthoredCloth(true)
      }
      ensureRapierStarted()
    } else {
      writeAuthoredCloth(false)
    }
    matrices()
    markDirty()
  }

  const enabled = (step: number) => () => active() && !motion && at === step
  addInteractionCue(tiedBody, { kind: 'drag', label: '握住扎布', priority: 3, enabled: enabled(0), destination: water, targetLabel: '漂洗盆' })
  addInteractionCue(body, { kind: 'drag', label: '握住蓝白布边', priority: 3, anchor: CLOTH_ANCHOR, enabled: enabled(1), destination: rail, targetLabel: '木晾杆' })
  addInteractionCue(body, { kind: 'tap', label: '轻点布面静看', priority: 3, anchor: CLOTH_ANCHOR, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const smoothPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(HUNG.z + 0.14))
  const moving = () => at === 0 ? bundle : cloth
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const visibleHit = (x: number, y: number, targets: THREE.Object3D | THREE.Object3D[], held?: THREE.Object3D) => touch.hit(x, y, targets, { ignore: held })
  const placementReady = (x: number, y: number) => at < 2 && travel > 0
    && !touch.occluded(x, y, at === 0 ? [water, basin, scene.getObjectByName('indigo-rinse-rest')!] : rail, { ignore: moving() })
    && placementHit(canvas, camera, at === 0 ? tiedBody : body, x, y, (px, py) => visibleHit(px, py, at === 0 ? water : rail, moving()), at === 0 ? [0, 0, 0] : CLOTH_ANCHOR)

  function pickClothGrabU(x: number, y: number): number {
    matrices()
    const hit = ray.aim(x, y).intersectObject(body, false)[0]
    if (!hit) return 0.16
    const local = cloth.worldToLocal(hit.point.clone())
    return THREE.MathUtils.clamp(local.x / CLOTH_W + 0.5, 0.12, 0.88)
  }

  function applySmoothingStroke(x: number, y: number) {
    if (at !== 2 || motion || reduced()) return
    matrices()
    if (!ray.aim(x, y).ray.intersectPlane(smoothPlane, point)) return
    const lx = point.x - cloth.position.x
    const ly = point.y - cloth.position.y
    if (Math.abs(lx) > CLOTH_W * 0.62 || ly > 0.08 || ly < -FRONT_LEN - 0.12) {
      hasSmoothLast = false
      return
    }
    if (!hasSmoothLast) {
      smoothLastLocal.set(lx, ly)
      hasSmoothLast = true
      return
    }
    const dx = lx - smoothLastLocal.x
    const dy = ly - smoothLastLocal.y
    const dist = Math.hypot(dx, dy)
    if (dist < 0.008) return
    const ux = dx / dist, uy = dy / dist
    const stepGain = Math.min(dist, 0.08) / 0.08
    hungSmoothness = Math.min(1, hungSmoothness + dist * 0.90)
    if (rapierReady && frontBody && frontBody.isValid()) {
      host.wakeUp()
      const pos = frontBody.particlePositions()
      const vel = frontBody.particleVelocities()
      const pMass = Math.max(frontBody.mass() / (SIM_NU * SIM_FRONT_NV), 1e-4)
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        const restX = (u - 0.5) * CLOTH_W
        // Leave upper rod-tangent rows (j = 0, 1) untouched and spread gentle tensile smoothing
        // smoothly down toward the hem so sweeping across the cloth irons creases out cleanly
        // without creating horizontal/vertical compression buckles.
        for (let j = 2; j < SIM_FRONT_NV; j++) {
          const d = j / (SIM_FRONT_NV - 1)
          const dRamp = THREE.MathUtils.smoothstep(d, 0.16, 0.92)
          const k = i * SIM_FRONT_NV + j
          const px = pos[k * 3]!, py = pos[k * 3 + 1]!, pz = pos[k * 3 + 2]!
          const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!
          const wx = Math.exp(-(((px - lx) / 0.34) ** 2))
          const wy = py >= ly
            ? Math.exp(-(((py - ly) / 0.18) ** 2))
            : Math.exp(-(((ly - py) / 0.48) ** 2))
          const pressure = wx * wy * stepGain
          if (pressure > 0.03) {
            // Smooth tensile straightening: relax lateral bunching toward flat width + tiny follow-through,
            // monotonically increasing downward tension toward hem (never pushing upper rows into lower rows),
            // and gentle soft Z ripple settling toward the smooth front hanging plane.
            const flattenX = THREE.MathUtils.clamp((restX - px) * 1.35, -0.24, 0.24)
            const dvx = THREE.MathUtils.clamp((ux * 0.18 + flattenX) * dRamp * pressure - vx * 0.12 * pressure, -0.22, 0.22)
            const dvy = THREE.MathUtils.clamp((Math.min(0.04, uy * 0.06) - 0.10 * dRamp) * dRamp * pressure - vy * 0.12 * pressure, -0.18, 0.06)
            const targetZ = ROD_RADIUS + 0.022 + 0.018 * dRamp
            const dvz = THREE.MathUtils.clamp(((targetZ - pz) * 0.65 + 0.06 * dRamp) * pressure - vz * 0.18 * pressure, -0.14, 0.14)
            frontBody.applyParticleImpulse(
              k,
              { x: pMass * dvx, y: pMass * dvy, z: pMass * dvz },
              true,
            )
          }
        }
      }
    }
    smoothLastLocal.set(lx, ly)
    markDirty()
  }

  const reset = () => { dropFeedback.clear(); dragging = false; smoothingPointer = false; hasSmoothLast = false; travel = 0; if (!motion) restore(false) }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? bundle : body) },
    onStart(x, y) {
      dropFeedback.clear(); feedback.prepare(); down.set(x, y); travel = 0; dragging = at < 2
      smoothingPointer = at === 2; hasSmoothLast = false
      if (at === 1) {
        carryGrabU = pickClothGrabU(x, y)
        lastDragPos.copy(cloth.position)
      }
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), (at === 0 ? tiedBody : body).localToWorld(new THREE.Vector3(...(at === 0 ? [0, 0, 0] : CLOTH_ANCHOR))))
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point)
    },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (smoothingPointer && at === 2) {
        if (travel >= 12) applySmoothingStroke(x, y)
        return
      }
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .22, 2.4)
      if (at === 0 && !reduced()) {
        const dxB = bundle.position.x - BASIN_CENTER.x
        const dzB = bundle.position.z - BASIN_CENTER.z
        if (Math.hypot(dxB, dzB) < .42 && bundle.position.y < .78 && dragWaterCooldown <= 0) {
          rinseWater.triggerRipple(THREE.MathUtils.clamp(dxB * .5, -.18, .18), THREE.MathUtils.clamp(dzB * .5, -.18, .18), .42)
          rinseWater.addTiltImpulse(dxB * 1.4, dzB * 1.4)
          dragWaterCooldown = .22
        }
      }
      if (at === 1) {
        const dx = cloth.position.x - lastDragPos.x
        const dz = cloth.position.z - lastDragPos.z
        lastDragPos.copy(cloth.position)
        const liftDist = cloth.position.distanceTo(RINSED)
        const liftFactor = smoothstep01(liftDist / 0.28)
        carryBlend = Math.max(0.32, liftFactor)
        rodWrapBlend = 1 - carryBlend
        if (!reduced()) {
          carrySwayX = THREE.MathUtils.clamp(carrySwayX * 0.72 - dx * 2.2, -0.45, 0.45)
          carrySwayZ = THREE.MathUtils.clamp(carrySwayZ * 0.72 - dz * 1.8, -0.40, 0.40)
        } else {
          carrySwayX = 0; carrySwayZ = 0
        }
        if (!rapierReady || reduced()) writeAuthoredCloth(true)
        else writeClothFromRapier()
      }
      matrices()
      markDirty()
      dropFeedback.setReady(dragging && placementReady(x, y))
      if (dragging && at < 2 && placementReady(x, y) && pointer.finish()) { dragging = false; begin(true) }
    },
    onRelease(x, y) {
      matrices()
      if (at === 2) {
        const isTap = travel < 12 - 1e-6 && Math.hypot(x - down.x, y - down.y) < 12 - 1e-6 && visibleHit(x, y, body)
        const didSmooth = smoothingPointer && travel >= 12
        dropFeedback.clear(); dragging = false; smoothingPointer = false; hasSmoothLast = false
        if (isTap) finish()
        else if (!didSmooth) reset()
        return
      }
      const valid = dragging && placementReady(x, y)
      dropFeedback.clear(); dragging = false; smoothingPointer = false; hasSmoothLast = false
      if (valid) begin(); else reset()
    },
    onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: active, duration: 3, motion: 'glow',
    targets: () => [cloth], cancelInput: () => pointer.cancel(), complete: () => finish() })
  const sync = () => {
    markDirty()
    const phase = at === 3 ? 'done' : motion ? (motion.step === 0 ? 'rinsing' : 'hanging') : at === 0 ? 'bundle' : at === 1 ? (dragging ? 'carrying' : 'rinsed') : 'hung'
    overlay.dataset.indigoPhase = phase
    dropFeedback.clear()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(active() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? COPY.rinseAction : at === 1 ? COPY.hangAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : at === 0 ? COPY.rinse : at === 1 ? COPY.hang : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    ending.sync(at === 2 && !motion)
  }
  function settle() {
    if (!active() || !motion) return
    const prevStep = motion.step
    at = (prevStep + 1) as Checkpoint; motion = null
    // Preserve live swing momentum on drying rail with newly-hung folds ready for optional smoothing!
    const nextSmoothness = prevStep === 1 && !reduced() ? 0.18 : 1
    restore(prevStep === 0 || reduced(), nextSmoothness)
    sync(); ctx.onProgress?.(at); if (!active()) return
    feedback.impact({ freqs: [392, 523.25], duration: .19, gain: .012, type: 'triangle' })
  }
  function begin(arrived = false) {
    if (!active() || (pointer.isBusy() && !arrived) || motion || at >= 2) return
    const step = at as 0 | 1
    motion = {
      step,
      time: 0,
      from: moving().position.clone(),
      startCarryBlend: step === 1 ? Math.max(carryBlend, 0.72) : 0,
      startGrabU: step === 1 ? carryGrabU : 0.5,
      startSwayX: carrySwayX,
      startSwayZ: carrySwayZ,
    }
    sync()
    if (reduced()) settle()
  }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || at !== 2) return
    if (!text.trim() && !ending.completing) return
    at = 3; restore(false, 1); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
    if (text.trim() && !returning) ctx.saveWish?.(text.trim())
    if (disposed) return
    ctx.onProgress?.(3)
    if (!active()) return
    feedback.impact({ freqs: [392, 587.33], duration: .24, gain: .012 })
    if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || at === 3) return; feedback.prepare(); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.20, 6.05 + portraitBoost(aspect, 9)); camera.lookAt(0, 1.0, .08); matrices(); markDirty() }
  writeAuthoredCloth(true); restore(false); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      wasReduced = reduced()
      restore(false); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
        onSubmit: text => { if (!active() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; feedback.prepare(); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true }; return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      const isReduced = reduced()
      if (!isReduced) {
        liquidClock += delta
        if (dragWaterCooldown > 0) dragWaterCooldown = Math.max(0, dragWaterCooldown - delta)
      }
      if (isReduced !== wasReduced) {
        wasReduced = isReduced
        if (isReduced) {
          physicsStepped = false
          clearHandlingState(1)
          writeAuthoredCloth(true)
          rinseWater.update(0, 0, true)
        } else if (at >= 1) {
          ensureRapierStarted()
          if (rapierReady) {
            host.wakeUp()
            resetSoftBodiesToCurrentAuthored()
          }
        }
        markDirty()
      }
      let geometryUpdated = false
      if (motion) {
        const dur = motion.step === 0 ? BASIN_UNFOLD_DURATION : OVER_ROD_DURATION
        motion.time = isReduced ? 1 : Math.min(1, motion.time + delta / dur)
        const u = motion.time
        if (motion.step === 0) {
          // Continuous basin dip -> lift high out of water -> sweep cleanly over low rest bar (zero basin/bar clip!).
          const waterTarget = new THREE.Vector3(BASIN_CENTER.x, 0.43, BASIN_CENTER.z)
          if (u < 0.30) {
            const p = ease(u / 0.30)
            bundle.visible = true
            cloth.visible = false
            bundle.position.lerpVectors(motion.from, waterTarget, p)
            bundle.position.y += Math.sin(Math.PI * p) * 0.28
            const dip = smoothstep01((u - 0.16) / 0.14)
            bundle.scale.set(1 + 0.14 * dip, 1 - 0.26 * dip, 1 + 0.14 * dip)
            setRinseDyeMix(dip * .55)
            if (!isReduced && dip > 0.05 && (motion.rinseStage ?? 0) < 1) {
              motion.rinseStage = 1
              rinseWater.addDipDepression(0, 0, .024, .14)
              rinseWater.triggerRipple(0, 0, 1.45)
              rinseWater.addTiltImpulse(2.1, -1.4)
              rinseWater.addSwirlImpulse(3.4)
            } else if (!isReduced && u >= 0.25 && (motion.rinseStage ?? 0) < 2) {
              motion.rinseStage = 2
              rinseWater.triggerRipple(.06, -.05, 1.15)
              rinseWater.addTiltImpulse(-1.6, 1.2)
              rinseWater.addSwirlImpulse(-2.1)
            }
          } else {
            const bundleFade = 1 - smoothstep01((u - 0.30) / 0.12)
            if (bundleFade > 0.02) {
              bundle.visible = true
              bundle.position.copy(waterTarget)
              bundle.scale.setScalar(bundleFade)
            } else {
              bundle.visible = false
              bundle.scale.set(1, 1, 1)
            }
            setRinseDyeMix(.55 + .45 * smoothstep01((u - 0.30) / 0.18))
            if (!isReduced) {
              if ((motion.rinseStage ?? 0) < 3 && u >= 0.34) {
                motion.rinseStage = 3
                rinseWater.addDipDepression(0, 0, -.014, .13)
                rinseWater.triggerRipple(-.05, .06, 1.15)
                rinseWater.addTiltImpulse(-1.5, 1.1)
                rinseWater.addSwirlImpulse(2.4)
              } else if ((motion.rinseStage ?? 0) < 4 && u >= 0.48) {
                motion.rinseStage = 4
                rinseWater.triggerRipple(.09, .04, .72)
              } else if ((motion.rinseStage ?? 0) < 5 && u >= 0.62) {
                motion.rinseStage = 5
                rinseWater.triggerRipple(-.07, -.05, .52)
              }
            }

            cloth.visible = true
            if (u < 0.62) {
              // Phase 2: Lift straight UP cleanly above the ceramic basin rim (0.57m) & low bar (0.79m) while opening.
              const lift = smoothstep01((u - 0.30) / 0.32)
              unfoldAmount = THREE.MathUtils.lerp(0.0, 0.72, lift)
              carryBlend = 0.44 * smoothstep01(lift)
              carryGrabU = 0.5
              rodWrapBlend = 0
              cloth.position.set(
                BASIN_CENTER.x,
                THREE.MathUtils.lerp(0.58, 1.34, lift),
                THREE.MathUtils.lerp(BASIN_CENTER.z + 0.04, 0.22, lift),
              )
            } else {
              // Phase 3: Carry forward OVER the low wooden bar & wrap cleanly down onto RINSED.
              const place = smoothstep01((u - 0.62) / 0.38)
              const startLift = new THREE.Vector3(BASIN_CENTER.x, 1.34, 0.22)
              const apexLow = new THREE.Vector3(RINSED.x, 1.32, RINSED.z + 0.02)
              const inv = 1 - place
              cloth.position.set(
                inv * inv * startLift.x + 2 * inv * place * apexLow.x + place * place * RINSED.x,
                inv * inv * startLift.y + 2 * inv * place * apexLow.y + place * place * RINSED.y,
                inv * inv * startLift.z + 2 * inv * place * apexLow.z + place * place * RINSED.z,
              )
              unfoldAmount = THREE.MathUtils.lerp(0.72, 1.0, smoothstep01(place / 0.65))
              carryBlend = 0.44 * (1 - smoothstep01(place / 0.72))
              carryGrabU = 0.5
              rodWrapBlend = smoothstep01((place - 0.48) / 0.52)
            }
            if (!motion.unfoldSpawned) {
              motion.unfoldSpawned = true
              prevClothPos.copy(cloth.position)
              prevClothVel.set(0, 0, 0)
              ensureRapierStarted()
              if (rapierReady && !isReduced) resetSoftBodiesToCurrentAuthored()
            }
            writeAuthoredCloth(true)
            if (rapierReady && !isReduced && rodWrapBlend > 0.05) {
              resetSoftBodiesToCurrentAuthored()
            }
          }
          geometryUpdated = true
        } else {
          // Over-rod arc & wrap settle: lift gathered cloth OVER the high drying rail, open width, and wrap smoothly down.
          const arcT = ease(THREE.MathUtils.clamp(u / 0.84, 0, 1))
          const apex = new THREE.Vector3(
            THREE.MathUtils.lerp(motion.from.x, HUNG.x, 0.58),
            Math.max(motion.from.y, HUNG.y) + 0.34,
            HUNG.z + 0.08,
          )
          const inv = 1 - arcT
          cloth.position.set(
            inv * inv * motion.from.x + 2 * inv * arcT * apex.x + arcT * arcT * HUNG.x,
            inv * inv * motion.from.y + 2 * inv * arcT * apex.y + arcT * arcT * HUNG.y,
            inv * inv * motion.from.z + 2 * inv * arcT * apex.z + arcT * arcT * HUNG.z,
          )
          const spreadT = smoothstep01((u - 0.14) / 0.56)
          const wrapT = smoothstep01((u - 0.52) / 0.34)
          carryBlend = motion.startCarryBlend * (1 - spreadT)
          carryGrabU = THREE.MathUtils.lerp(motion.startGrabU, 0.5, spreadT)
          carrySwayX = motion.startSwayX * (1 - spreadT)
          carrySwayZ = motion.startSwayZ * (1 - spreadT) + 0.14 * Math.sin(Math.PI * arcT) * (1 - wrapT)
          rodWrapBlend = wrapT
          unfoldAmount = 1
          if (!rapierReady || isReduced) writeAuthoredCloth(true)
          geometryUpdated = true
        }
        if (motion.time === 1) settle()
      }
      if (!motion && !isReduced && dragging && at === 1) {
        const damp = Math.exp(-delta * 6)
        carrySwayX *= damp
        carrySwayZ *= damp
      }
      ending.update(dt)
      if (disposed || !active()) return
      rinseWater.update(delta, liquidClock, isReduced)
      const clothCanSimulate = at >= 1 || (motion?.step === 0 && motion.time >= 0.80)
      if (!isReduced && clothCanSimulate) {
        ensureRapierStarted()
        if (rapierReady && frontBody && backBody && delta > 0) {
          syncKinematicColliders()
          const vx = (cloth.position.x - prevClothPos.x) / delta
          const vy = (cloth.position.y - prevClothPos.y) / delta
          const vz = (cloth.position.z - prevClothPos.z) / delta
          const ax = THREE.MathUtils.clamp((vx - prevClothVel.x) / delta, -16, 16)
          const ay = THREE.MathUtils.clamp((vy - prevClothVel.y) / delta, -16, 16)
          const az = THREE.MathUtils.clamp((vz - prevClothVel.z) / delta, -16, 16)
          const xzLimit = motion ? 5.5 : 10.0
          inertialAccel.set(
            THREE.MathUtils.clamp(-vx * 2.0 - ax * 0.36, -xzLimit, xzLimit),
            THREE.MathUtils.clamp(-vy * 1.2 - ay * 0.22, -4.5, 1.8),
            THREE.MathUtils.clamp(-vz * 2.0 - az * 0.36, -xzLimit, xzLimit),
          )
          prevClothPos.copy(cloth.position)
          prevClothVel.set(vx, vy, vz)
          const stepped = host.step(delta, applyClothForces, enforceRapierClothInvariants)
          if (stepped) {
            physicsStepped = true
            writeClothFromRapier()
            geometryUpdated = true
          }
        }
      }
      if (active()) {
        const camChanged = !camera.position.equals(lastCamPos) || !camera.quaternion.equals(lastCamQuat) || camera.fov !== lastCamFov
        const envPending = !!canvas.dataset.environment && (canvas.dataset.environmentReady !== 'true' || canvas.dataset.treeStatus === 'loading')
        const needsRender = !isReduced || renderDirty || geometryUpdated || camChanged || envPending || !!motion || dragging || ending.running
        if (needsRender) {
          matrices(); style.render()
          renderDirty = false
          lastCamPos.copy(camera.position); lastCamQuat.copy(camera.quaternion); lastCamFov = camera.fov
        }
      }
    },
    dispose() {
      if (disposed) return
      ending.dispose(); disposed = true
      frontBody = null; backBody = null; rodCollider = null; basinCollider = null; floorCollider = null; rapierReady = false; physicsStepped = false
      host.dispose()
      pointer.dispose(); dropFeedback.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); rinseWater.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage'); delete overlay.dataset.indigoPhase
    },
  }
}
