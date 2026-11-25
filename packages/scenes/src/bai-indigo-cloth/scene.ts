import { createQuietEnding } from '../quiet-ending'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
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
const ease = (t: number) => t * t * (3 - 2 * t)

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
    // Broad, clean anime vertical/diagonal drape folds (3-4 asymmetric soft lobes, not a uniform ripple).
    const foldWave =
      .058 * Math.sin(u * Math.PI * 3.1 + .45) +
      .038 * Math.cos(u * Math.PI * 5.0 - .95) +
      .020 * Math.sin(u * Math.PI * 7.0 + 1.85)
    const breeze = isWet ? .042 : .135
    // Gentle inward fabric softening along sides + subtle sunlit rightward drift.
    const gatherIn = -(u - .5) * (isWet ? .055 : .072) * d13
    const swayX = (isWet ? .020 : .078) * d16 * (.55 + .45 * u)
    const x = xBase + gatherIn + swayX
    // Graceful diagonal hem sweep: left-center hangs fuller/lower while sunlit right edge lifts softly.
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
  // On low rinse rest, stay well clear of ceramic basin behind; high on drying rail, lag visibly behind front layer.
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
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false, feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.rinseAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'bai-indigo-cloth', label: COPY.title }); style.setStyle(CEL_STYLE)
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
  const water = add('indigo-rinse-water', new THREE.CylinderGeometry(.384, .384, .012, 56), createRitualMaterial({ color: 0x749da3, roughness: .24, transparent: true, opacity: .72, depthWrite: false }, { kind: 'water', strength: .3 }), [-.78, .44, -.10]); water.castShadow = false
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
  // Preserves exact 72x120 closed topology, vertex colors, and exact rod-wrap radius.
  // ---------------------------------------------------------------------------
  const layerCount = (CLOTH_NX + 1) * (CLOTH_NY + 1)
  const midGrid = new Float32Array(layerCount * 3)
  const rowRegion = new Uint8Array(CLOTH_NY + 1) // 0 = front skirt, 1 = rod wrap, 2 = back skirt
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
  const frontSimCopy = new Float32Array(SIM_NU * SIM_FRONT_NV * 3)
  const backSimCopy = new Float32Array(SIM_NU * SIM_BACK_NV * 3)

  function flushMidGridToClothGeometry() {
    const posAttr = clothGeo.getAttribute('position') as THREE.BufferAttribute
    const clothX = cloth.position.x, clothY = cloth.position.y, clothZ = cloth.position.z
    const nearBasin = Math.abs(clothX - RINSED.x) < 0.75 && clothY < 1.35

    // Safety clearance against the ceramic basin exterior wall & floor for hanging curtains only
    // (rod wrap region 1 stays strictly untouched on radius 0.073).
    const minLocalY = Math.max(-0.675, 0.095 - clothY)
    for (let j = 0; j <= CLOTH_NY; j++) {
      const region = rowRegion[j]!
      if (region === 1) continue
      for (let i = 0; i <= CLOTH_NX; i++) {
        const idx = (j * (CLOTH_NX + 1) + i) * 3
        let lx = midGrid[idx]!, ly = midGrid[idx + 1]!, lz = midGrid[idx + 2]!
        if (ly < minLocalY) ly = minLocalY
        // Keep hanging curtains safely outside the solid wooden rod cylinder (r = 0.070).
        if (ly > -0.10 && ly < 0.024) {
          const r2 = ly * ly + lz * lz
          const minR = ROD_RADIUS + 0.001
          if (r2 < minR * minR) {
            const signZ = region === 0 ? 1 : -1
            const neededZ = Math.sqrt(Math.max(0, minR * minR - ly * ly))
            lz = signZ * Math.max(Math.abs(lz), neededZ)
          }
        }
        // Keep below the top-fold support radius test band (p.y > center.y + 0.025).
        if (ly > 0.018) ly = 0.018
        if (nearBasin) {
          const wx = clothX + lx, wy = clothY + ly, wz = clothZ + lz
          const bY = wy - BASIN_CENTER.y
          const outerR = basinOuterRadius(bY)
          if (outerR > 0) {
            const dx = wx - BASIN_CENTER.x, dz = wz - BASIN_CENTER.z
            const dist = Math.hypot(dx, dz)
            const safeR = outerR + 0.022
            if (dist < safeR) {
              const targetDz = Math.sqrt(Math.max(0, safeR * safeR - dx * dx))
              lz = BASIN_CENTER.z + targetDz - clothZ
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
        if (region === 1) {
          // Exact cylindrical radial normal on the wooden rod wrap -> radii stay exactly 0.070..0.076.
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
  function writeRestingCloth(force = false) {
    const isWet = at <= 1
    if (!force && lastRestingWet === isWet && !physicsStepped) return
    for (let j = 0; j <= CLOTH_NY; j++) {
      const v = j / CLOTH_NY
      for (let i = 0; i <= CLOTH_NX; i++) {
        evalRestingMidsurface(i / CLOTH_NX, v, isWet, tmpSample)
        const k = (j * (CLOTH_NX + 1) + i) * 3
        midGrid[k] = tmpSample.x
        midGrid[k + 1] = tmpSample.y
        midGrid[k + 2] = tmpSample.z
      }
    }
    flushMidGridToClothGeometry()
    lastRestingWet = isWet
  }

  // ---------------------------------------------------------------------------
  // Lazy-loaded Rapier soft-body simulation (234 particles in cloth-local space):
  // front curtain (13x10) + back curtain (13x8) pinned along rod tangent lines,
  // with rod/post/basin/floor rigid colliders, sunny verandah breeze & carry inertia.
  // Never initializes WASM on construction, at entry (p=0), or in reducedMotion.
  // ---------------------------------------------------------------------------
  let frontBody: ReturnType<RapierSoftBodySession['createCloth']> | null = null
  let backBody: ReturnType<RapierSoftBodySession['createCloth']> | null = null
  let basinCollider: ReturnType<RapierSoftBodySession['addKinematicCylinder']> | null = null
  let floorCollider: ReturnType<RapierSoftBodySession['addKinematicBox']> | null = null
  let rapierReady = false
  let physicsStepped = false
  let simClock = 0
  let wasReduced = false
  const prevClothPos = new THREE.Vector3().copy(RINSED)
  const prevClothVel = new THREE.Vector3()
  const inertialAccel = new THREE.Vector3()

  const pinnedFrontTop: number[] = []
  const pinnedBackTop: number[] = []
  for (let i = 0; i < SIM_NU; i++) {
    pinnedFrontTop.push(i * SIM_FRONT_NV)
    pinnedBackTop.push(i * SIM_BACK_NV)
  }

  function syncKinematicColliders() {
    if (basinCollider) {
      // Position basin collider in cloth-local space (active near RINSED, parked far away when hung).
      const bx = BASIN_CENTER.x - cloth.position.x
      const by = (BASIN_CENTER.y + 0.25) - cloth.position.y
      const bz = BASIN_CENTER.z - cloth.position.z
      basinCollider.setPose({ x: bx, y: by, z: bz })
    }
    if (floorCollider) {
      floorCollider.setPose({ x: 0, y: -0.05 - cloth.position.y, z: 0 })
    }
  }

  function resetSoftBodiesToRestingPose() {
    const isWet = at <= 1
    if (frontBody && frontBody.isValid()) {
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        for (let j = 0; j < SIM_FRONT_NV; j++) {
          const d = j / (SIM_FRONT_NV - 1)
          const v = ((1 - d) * FRONT_LEN) / TOTAL_LEN
          evalRestingMidsurface(u, v, isWet, tmpSample)
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
          evalRestingMidsurface(u, v, isWet, tmpSample)
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
    const isWet = at <= 1 && !motion
    // Sun-drying cotton high on the verandah rail catches a warm diagonal courtyard breeze;
    // freshly rinsed cotton on the low rest is heavier and drapes with deeper calm gravity pleats.
    const breezeScale = isWet ? 0.38 : 1.0

    if (frontBody && frontBody.isValid()) {
      frontBody.resetForces(false)
      const vel = frontBody.particleVelocities()
      const pMass = Math.max(frontBody.mass() / (SIM_NU * SIM_FRONT_NV), 1e-4)
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        const xPin = (u - .5) * CLOTH_W
        frontBody.setParticleKinematicTarget(i * SIM_FRONT_NV, { x: xPin, y: 0, z: ROD_RADIUS })
        for (let j = 1; j < SIM_FRONT_NV; j++) {
          const d = j / (SIM_FRONT_NV - 1)
          const dRamp = THREE.MathUtils.smoothstep(d, 0.05, 0.90)
          const k = i * SIM_FRONT_NV + j
          const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!
          const phase1 = t * 1.95 - u * 3.6 - d * 2.9
          const phase2 = t * 3.15 - u * 5.8 + d * 2.2
          // Diagonal courtyard gust: catches the middle-right & corner more strongly while left drapes fuller.
          const gustEnvelope = 0.42 + 0.85 * Math.pow(u, 1.15)
          const windZ = (3.45 + 3.25 * Math.sin(phase1) + 1.35 * Math.cos(phase2)) * breezeScale * dRamp * gustEnvelope
          const windX = (1.65 + 1.85 * Math.cos(phase1 * 0.82 + 0.35)) * breezeScale * dRamp * (0.55 + 0.55 * u)
          const windY = (0.85 + 1.15 * Math.sin(phase1 + 0.45)) * breezeScale * dRamp * Math.pow(u, 1.2)
          // Sculptural broad vertical cloth pleats so clean anime cel-shading bands read clearly from official view.
          const pleatZ = (1.95 * Math.sin(u * Math.PI * 3.1 + .45) + 1.25 * Math.cos(u * Math.PI * 5.0 - .95)) * dRamp * (isWet ? 1.15 : 0.95)
          const fx = windX + inertialAccel.x * dRamp - 1.15 * vx
          const fy = windY + inertialAccel.y * dRamp - 1.05 * vy
          const fz = windZ + pleatZ + inertialAccel.z * dRamp - 1.20 * vz
          frontBody.addParticleForce(k, { x: pMass * fx, y: pMass * fy, z: pMass * fz }, false)
        }
      }
    }

    if (backBody && backBody.isValid()) {
      backBody.resetForces(false)
      const vel = backBody.particleVelocities()
      const pMass = Math.max(backBody.mass() / (SIM_NU * SIM_BACK_NV), 1e-4)
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        const xPin = (u - .5) * CLOTH_W
        backBody.setParticleKinematicTarget(i * SIM_BACK_NV, { x: xPin, y: 0, z: -ROD_RADIUS })
        for (let j = 1; j < SIM_BACK_NV; j++) {
          const d = j / (SIM_BACK_NV - 1)
          const dRamp = THREE.MathUtils.smoothstep(d, 0.06, 0.90)
          const k = i * SIM_BACK_NV + j
          const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!
          const phase1 = t * 1.95 - u * 3.6 - d * 2.6 - 1.05
          const phase2 = t * 3.05 - u * 5.1 + d * 1.8
          // Sheltered behind the front layer: lags out of phase & billows slightly behind/right so two cloth layers read cleanly!
          const windZ = (isWet ? 0.65 : (-0.75 + 2.35 * Math.sin(phase1) + 0.90 * Math.cos(phase2))) * breezeScale * dRamp
          const windX = (1.35 + 1.45 * Math.cos(phase1 * 0.85 + 0.85)) * breezeScale * dRamp
          const pleatZ = (1.15 * Math.sin(u * Math.PI * 3.1 + 1.35)) * dRamp * (isWet ? 0.75 : 0.95)
          const fx = windX + inertialAccel.x * dRamp - 1.25 * vx
          const fy = inertialAccel.y * dRamp - 1.15 * vy
          const fz = windZ + pleatZ + inertialAccel.z * dRamp - 1.30 * vz
          backBody.addParticleForce(k, { x: pMass * fx, y: pMass * fy, z: pMass * fz }, false)
        }
      }
    }
  }

  function writeClothFromRapier() {
    if (!frontBody || !frontBody.isValid() || !backBody || !backBody.isValid()) return
    frontSimCopy.set(frontBody.particlePositions())
    backSimCopy.set(backBody.particlePositions())

    // Pin exact rod-tangent top rows & keep front/back curtains cleanly separated by at least 2*HALF_THICK.
    for (let i = 0; i < SIM_NU; i++) {
      const xPin = (i / (SIM_NU - 1) - .5) * CLOTH_W
      const kf = i * SIM_FRONT_NV * 3
      frontSimCopy[kf] = xPin; frontSimCopy[kf + 1] = 0; frontSimCopy[kf + 2] = ROD_RADIUS
      const kb = i * SIM_BACK_NV * 3
      backSimCopy[kb] = xPin; backSimCopy[kb + 1] = 0; backSimCopy[kb + 2] = -ROD_RADIUS

      // Prevent front & back sheets from ever interpenetrating mid-swing.
      for (let j = 1; j < SIM_BACK_NV; j++) {
        const jf = Math.min(SIM_FRONT_NV - 1, Math.round((j / (SIM_BACK_NV - 1)) * (BACK_LEN / FRONT_LEN) * (SIM_FRONT_NV - 1)))
        const frontZ = frontSimCopy[(i * SIM_FRONT_NV + jf) * 3 + 2]!
        const bIdx = (i * SIM_BACK_NV + j) * 3 + 2
        if (backSimCopy[bIdx]! > frontZ - 0.022) {
          backSimCopy[bIdx] = frontZ - 0.022
        }
      }
    }

    for (let j = 0; j <= CLOTH_NY; j++) {
      const region = rowRegion[j]!
      if (region === 1) {
        const ry = ROD_RADIUS * rowWrapSin[j]!, rz = ROD_RADIUS * rowWrapCos[j]!
        for (let i = 0; i <= CLOTH_NX; i++) {
          const k = (j * (CLOTH_NX + 1) + i) * 3
          midGrid[k] = (i / CLOTH_NX - .5) * CLOTH_W
          midGrid[k + 1] = ry
          midGrid[k + 2] = rz
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
      // Fixed cylindrical wooden rod collider along X axis in cloth-local space.
      const rotZ90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
      session.addFixedCylinder({ x: 0, y: 0, z: 0 }, 0.068, 1.62, {
        rotation: { x: rotZ90.x, y: rotZ90.y, z: rotZ90.z, w: rotZ90.w },
        friction: 0.72,
        restitution: 0.02,
      })
      // Kinematic rinse-basin & verandah floor colliders updated as cloth moves between rests.
      basinCollider = session.addKinematicCylinder({ x: 0, y: -0.50, z: -0.59 }, 0.48, 0.56, {
        friction: 0.65,
        restitution: 0.02,
      })
      floorCollider = session.addKinematicBox({ x: 0, y: -0.84, z: 0 }, { x: 4.0, y: 0.10, z: 3.0 }, {
        friction: 0.75,
        restitution: 0.02,
      })

      // Give the cloth ~5% horizontal fabric fullness in rest edges while pinning top row across CLOTH_W,
      // and use tensionOnly:true so the broad pinned cotton forms graceful vertical/diagonal folds without stiffness.
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
      resetSoftBodiesToRestingPose()
      if (!reduced() && at >= 1) {
        host.settle(42, applyClothForces)
        physicsStepped = true
        writeClothFromRapier()
      }
    },
  })

  function ensureRapierStarted() {
    if (!started || disposed || at < 1 || reduced()) return
    void host.start()
  }

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = (reseedPhysics = true) => {
    bundle.position.copy(BUNDLE_HOME); bundle.visible = at === 0
    cloth.visible = at >= 1; cloth.position.copy(at >= 2 ? HUNG : RINSED)
    prevClothPos.copy(cloth.position); prevClothVel.set(0, 0, 0); inertialAccel.set(0, 0, 0)
    if (at >= 1) {
      if (reseedPhysics && rapierReady && !reduced()) {
        resetSoftBodiesToRestingPose()
        host.settle(24, applyClothForces)
        physicsStepped = true
        writeClothFromRapier()
      } else if (!physicsStepped || reduced()) {
        physicsStepped = false
        writeRestingCloth(true)
      }
      ensureRapierStarted()
    } else {
      writeRestingCloth(false)
    }
    matrices()
  }
  const enabled = (step: number) => () => active() && !motion && at === step
  addInteractionCue(tiedBody, { kind: 'drag', label: '握住扎布', priority: 3, enabled: enabled(0), destination: water, targetLabel: '漂洗盆' })
  addInteractionCue(body, { kind: 'drag', label: '握住蓝白布边', priority: 3, anchor: CLOTH_ANCHOR, enabled: enabled(1), destination: rail, targetLabel: '木晾杆' })
  addInteractionCue(body, { kind: 'tap', label: '轻点布面静看', priority: 3, anchor: CLOTH_ANCHOR, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? bundle : cloth
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const visibleHit = (x: number, y: number, targets: THREE.Object3D | THREE.Object3D[], held?: THREE.Object3D) => touch.hit(x, y, targets, { ignore: held })
  const placementReady = (x: number, y: number) => at < 2 && travel > 0
    // A higher grab on the tied knot can overlap the basin or its rest while
    // the cloth's contact anchor reaches the water. They are one destination
    // assembly; unrelated foreground objects still block the carried cloth.
    && !touch.occluded(x, y, at === 0 ? [water, basin, scene.getObjectByName('indigo-rinse-rest')!] : rail, { ignore: moving() })
    && placementHit(canvas, camera, at === 0 ? tiedBody : body, x, y, (px, py) => visibleHit(px, py, at === 0 ? water : rail, moving()), at === 0 ? [0, 0, 0] : CLOTH_ANCHOR)
  const reset = () => { dropFeedback.clear(); dragging = false; travel = 0; if (!motion) restore(false) }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? bundle : body) },
    onStart(x, y) { dropFeedback.clear(); feedback.prepare(); down.set(x, y); travel = 0; dragging = at < 2; plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), (at === 0 ? tiedBody : body).localToWorld(new THREE.Vector3(...(at === 0 ? [0,0,0] : CLOTH_ANCHOR)))); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point) },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .22, 2.4); matrices()
      dropFeedback.setReady(dragging && placementReady(x, y))
          if (dragging && at < 2 && placementReady(x, y) && pointer.finish()) { dragging = false; begin(true) }
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && placementReady(x, y)
        : at === 2 && travel < 12 - 1e-6 && Math.hypot(x - down.x, y - down.y) < 12 - 1e-6 && visibleHit(x, y, body)
      dropFeedback.clear(); dragging = false
      if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: active, duration: 3, motion: 'glow',
    targets: () => [cloth], cancelInput: () => pointer.cancel(), complete: () => finish() })
  const sync = () => {
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
    // Preserve live swing momentum when landing from rinse rest onto the drying rail!
    restore(prevStep === 0 || reduced())
    sync(); ctx.onProgress?.(at); if (!active()) return
    feedback.impact({ freqs: [392, 523.25], duration: .19, gain: .012, type: 'triangle' })
  }
  function begin(arrived = false) { if (!active() || (pointer.isBusy() && !arrived) || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || at !== 2) return
    if (!text.trim() && !ending.completing) return
    at = 3; restore(false); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
    if (text.trim() && !returning) ctx.saveWish?.(text.trim())
    // An accepted save and its checkpoint stay atomic across pause, but not disposal.
    if (disposed) return
    ctx.onProgress?.(3)
    if (!active()) return
    feedback.impact({ freqs: [392, 587.33], duration: .24, gain: .012 })
    if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || at === 3) return; feedback.prepare(); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.20, 6.05 + portraitBoost(aspect, 9)); camera.lookAt(0, 1.0, .08); matrices() }
  writeRestingCloth(true); restore(false); sync()
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
      if (isReduced !== wasReduced) {
        wasReduced = isReduced
        if (isReduced) {
          physicsStepped = false
          writeRestingCloth(true)
        } else if (at >= 1) {
          ensureRapierStarted()
          if (rapierReady) {
            host.wakeUp()
            resetSoftBodiesToRestingPose()
          }
        }
      }
      if (motion) {
        motion.time = isReduced ? 1 : Math.min(1, motion.time + delta / .8); const t = ease(motion.time)
        if (motion.step === 0) bundle.position.lerpVectors(motion.from, water.position.clone().add(new THREE.Vector3(0, .10, 0)), t)
        else { cloth.position.lerpVectors(motion.from, HUNG, t); if (!isReduced) cloth.position.y += .10 * Math.sin(Math.PI * t) }
        if (motion.time === 1) settle()
      }
      ending.update(dt)
      if (disposed || !active()) return
      if (!isReduced && at >= 1) {
        ensureRapierStarted()
        if (rapierReady && frontBody && backBody && delta > 0) {
          syncKinematicColliders()
          const vx = (cloth.position.x - prevClothPos.x) / delta
          const vy = (cloth.position.y - prevClothPos.y) / delta
          const vz = (cloth.position.z - prevClothPos.z) / delta
          const ax = THREE.MathUtils.clamp((vx - prevClothVel.x) / delta, -16, 16)
          const ay = THREE.MathUtils.clamp((vy - prevClothVel.y) / delta, -16, 16)
          const az = THREE.MathUtils.clamp((vz - prevClothVel.z) / delta, -16, 16)
          // Combine aerodynamic air drag (-v) and D'Alembert carry inertia (-a) so carried cloth streams gracefully.
          inertialAccel.set(
            THREE.MathUtils.clamp(-vx * 2.4 - ax * 0.48, -14, 14),
            THREE.MathUtils.clamp(-vy * 1.6 - ay * 0.35, -10, 10),
            THREE.MathUtils.clamp(-vz * 2.4 - az * 0.48, -14, 14),
          )
          prevClothPos.copy(cloth.position)
          prevClothVel.set(vx, vy, vz)
          const stepped = host.step(delta, applyClothForces)
          if (stepped) {
            physicsStepped = true
            writeClothFromRapier()
          }
        }
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      ending.dispose(); disposed = true
      frontBody = null; backBody = null; basinCollider = null; floorCollider = null; rapierReady = false; physicsStepped = false
      host.dispose()
      pointer.dispose(); dropFeedback.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
