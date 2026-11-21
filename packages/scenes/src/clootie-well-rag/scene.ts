import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createQuietEnding } from '../quiet-ending'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'
import { placementHit } from '../placement-hit'
import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback,
  createStepOverlay, createWarmStage, disposeTree, observeCanvasResize,
  portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '井边放下', stepsAria: '步骤',
  dip: '把这片纯棉布轻轻拖入井水。',
  tie: '布片已浸湿。把它拖到低枝的浅金圈。',
  release: '布片已系在低枝上。轻触布片再松手。',
  done: '布片留在枝头，静看这一刻。',
  dipping: '纯棉布轻轻展开，浸入清水…',
  tying: '把湿布绕过低枝，轻轻系好…',
  settling: '松开手，布片轻轻垂下…',
  dipAction: '浸一下布', tieAction: '系到枝上', releaseAction: '松手静看',
} as const

type Checkpoint = 0 | 1 | 2 | 3
type Motion = { step: 0 | 1 | 2; time: number; from: THREE.Vector3 }
const DRY = new THREE.Vector3(0.53, 0.76, 0.66)
const DIPPED = new THREE.Vector3(-0.62, 0.83, 0.06)
const WET = new THREE.Vector3(-0.45, 1.19, 0.28)
const TIED = new THREE.Vector3(0.12, 1.46, 0.15)
const COLS = 16, ROWS = 30
const SIM_NU = 9, SIM_NV = 15 // 135 particles
const CLOTH_W = 0.48, CLOTH_H = 0.74
const smooth = (t: number) => { const p = THREE.MathUtils.clamp(t, 0, 1); return p * p * (3 - 2 * p) }

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

function sampleClothGrid(
  pos: Float32Array,
  nu: number,
  nv: number,
  u: number,
  v: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const fu = THREE.MathUtils.clamp(u, 0, 1) * (nu - 1)
  const fv = THREE.MathUtils.clamp(v, 0, 1) * (nv - 1)
  const i1 = Math.min(nu - 2, Math.floor(fu))
  const j1 = Math.min(nv - 2, Math.floor(fv))
  const tu = fu - i1
  const tv = fv - j1
  const i0 = Math.max(0, i1 - 1), i2 = i1 + 1, i3 = Math.min(nu - 1, i1 + 2)
  const j0 = Math.max(0, j1 - 1), j2 = j1 + 1, j3 = Math.min(nv - 1, j1 + 2)

  const sampleAxis = (axis: 0 | 1 | 2) => {
    const row = (j: number) => catmullRom(
      pos[(i0 * nv + j) * 3 + axis]!,
      pos[(i1 * nv + j) * 3 + axis]!,
      pos[(i2 * nv + j) * 3 + axis]!,
      pos[(i3 * nv + j) * 3 + axis]!,
      tu,
    )
    return catmullRom(row(j0), row(j1), row(j2), row(j3), tv)
  }

  return out.set(sampleAxis(0), sampleAxis(1), sampleAxis(2))
}

function addSegmentCapsule(
  session: RapierSoftBodySession,
  a: [number, number, number],
  b: [number, number, number],
  radius: number,
) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b)
  const mid = va.clone().add(vb).multiplyScalar(0.5)
  const diff = vb.clone().sub(va)
  const len = diff.length()
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize())
  return session.addFixedCapsule(
    { x: mid.x, y: mid.y, z: mid.z },
    radius,
    Math.max(0.01, len * 0.5),
    { rotation: { x: quat.x, y: quat.y, z: quat.z, w: quat.w }, friction: 0.72, restitution: 0.02 },
  )
}

/** Original cotton weave, with alternating warp/weft and a muted edge band. */
function cottonTexture() {
  const size = 128, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const warp = x % 4 < 2, weft = y % 4 < 2
    const thread = warp === weft ? 7 : -9
    const irregularity = ((x * 17 + y * 29) % 11) - 5
    const edge = x < 6 || x > size - 7 || y < 6 || y > size - 7
    const i = (y * size + x) * 4
    data[i] = 238 + thread + irregularity - (edge ? 20 : 0)
    data[i + 1] = 231 + thread + irregularity - (edge ? 14 : 0)
    data[i + 2] = 207 + thread + irregularity - (edge ? 1 : 0)
    data[i + 3] = 255
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function softShadowTexture() {
  const size = 64, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + 0.5 - size / 2) / (size / 2), (y + 0.5 - size / 2) / (size / 2))
    const i = (y * size + x) * 4
    data[i] = data[i + 1] = data[i + 2] = 255
    data[i + 3] = Math.round(Math.max(0, 1 - r) ** 2 * 255)
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.magFilter = texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

function tube(points: number[][], radius: number, material: THREE.Material, segments = 30) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal')
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 9, false), material)
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

/** Source-informed cloth practice: dip, tie, release; the cotton stays visible. */
export function createClootieWellRag(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  const { assertSafeCopy } = shared
  Object.values(COPY).forEach(assertSafeCopy)
  let started = false, disposed = false, completed = false
  let checkpoint: Checkpoint = 0, clock = 0, simClock = 0, unfold = 0, tied = 0, dragBend = 0
  let motion: Motion | null = null, dragging = false
  let stopResize = () => {}
  const active = () => started && !disposed && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.dipAction }, assertSafeCopy)
  const { hitLayer, actionBtn, hintEl } = ui
  const { renderer, scene } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const lookAt = new THREE.Vector3(0.12, 1.15, 0.05)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'clootie-well-rag', label: COPY.title })
  styleRenderer.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, {
    sky: 0xfff5e4, ground: 0xb9c9a5, key: 0xffe5c9, rim: 0xd5eddf,
    keyIntensity: 1.2, keyPosition: [-2.8, 4.5, 3.5], rimIntensity: 0.45,
  })
  lights.key.castShadow = true
  lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3.2, bottom: -1, near: 0.1, far: 12 })
  lights.key.shadow.bias = -0.0008
  lights.key.shadow.normalBias = 0.025

  const world = new THREE.Group()
  world.name = 'clootie-well-and-tree'
  scene.add(world)
  const bark = new THREE.MeshStandardMaterial({ color: 0x937259, roughness: 1 })
  const barkHighlight = new THREE.MeshStandardMaterial({ color: 0xb69771, roughness: 1 })
  const mint = new THREE.MeshStandardMaterial({ color: 0x9cbfa3, roughness: 1 })
  const sage = new THREE.MeshStandardMaterial({ color: 0xb5c7a4, roughness: 1 })
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x9aaf7e, roughness: 1 })
  const stoneColors = [0xc8bfaa, 0xd9cdb6, 0xbabba6, 0xc6c4b2].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }))

  stoneColors.forEach(material => applyCraftSurface(material, { kind: 'stone', strength: .45 }))

  // A low, open stone well. Separate beveled wedges preserve the dark opening
  // and the visible water surface instead of closing it with a cylinder cap.
  const well = new THREE.Group()
  well.name = 'clootie-stone-well'
  well.position.set(-0.62, 0, 0.06)
  world.add(well)
  for (let row = 0; row < 2; row++) for (let i = 0; i < 10; i++) {
    const angle = (i + row * 0.5) * Math.PI * 2 / 10
    const half = Math.PI / 10 - 0.018, shape = new THREE.Shape()
    const inner = 0.36, outer = 0.53 + Math.sin(i * 7 + row) * 0.013
    shape.moveTo(Math.cos(angle - half) * inner, Math.sin(angle - half) * inner)
    shape.lineTo(Math.cos(angle - half) * outer, Math.sin(angle - half) * outer)
    shape.absarc(0, 0, outer, angle - half, angle + half, false)
    shape.lineTo(Math.cos(angle + half) * inner, Math.sin(angle + half) * inner)
    shape.absarc(0, 0, inner, angle + half, angle - half, true)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.165, bevelEnabled: true, bevelThickness: 0.021, bevelSize: 0.02, bevelSegments: 3, curveSegments: 8, steps: 1 })
    const stone = new THREE.Mesh(geo, stoneColors[(i + row) % stoneColors.length])
    stone.rotation.x = -Math.PI / 2
    stone.position.y = 0.032 + row * 0.19
    stone.castShadow = stone.receiveShadow = true
    well.add(stone)
  }
  const waterMat = createRitualMaterial({ color: 0x88beb4, roughness: .23, metalness: 0, transparent: true, opacity: .84 }, { kind: 'water', strength: .25 })
  const waterSurface = new THREE.Mesh(new THREE.CircleGeometry(0.354, 48), waterMat)
  waterSurface.name = 'clootie-well-water'
  waterSurface.rotation.x = -Math.PI / 2
  waterSurface.position.y = 0.335
  well.add(waterSurface)
  // A small volume within the well makes a drop at the water's exact centre
  // reliable even when the ray lies on the shared edges of its triangles.
  const water = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
  water.name = 'clootie-water-target'
  water.position.y = 0.335
  well.add(water)
  const wellDark = new THREE.Mesh(new THREE.CylinderGeometry(0.348, 0.348, 0.09, 40), new THREE.MeshStandardMaterial({ color: 0x526e64, roughness: 1 }))
  wellDark.position.y = 0.245
  well.add(wellDark)
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xdaeee1, transparent: true, opacity: 0.55 })
  const ripples = [0.13, 0.24].map((radius) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0045, 5, 40), rippleMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(0, 0.338, 0)
    well.add(ring)
    return ring
  })
  for (let i = 0; i < 5; i++) {
    const pebble = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), stoneColors[i % 4])
    pebble.scale.set(0.08 + (i % 2) * 0.025, 0.028, 0.055)
    pebble.position.set(-1.02 + i * 0.21, 0.031, 0.65 + Math.sin(i) * 0.06)
    pebble.castShadow = pebble.receiveShadow = true
    world.add(pebble)
  }

  const tree = new THREE.Group()
  tree.name = 'clootie-old-tree'
  world.add(tree)
  tree.add(tube([[0.81, 0.13, -0.08], [0.73, 0.48, -0.1], [0.88, 0.92, -0.09], [0.77, 1.42, -0.12], [0.89, 1.97, -0.16], [0.67, 2.3, -0.19]], 0.125, bark))
  for (const side of [-1, 1]) {
    tree.add(tube([[0.79, 0.2, -0.09], [0.79 + side * 0.16, 0.095, 0.01], [0.79 + side * 0.34, 0.054, 0.2]], 0.045, bark, 16))
  }
  const branchPts: [number, number, number][] = [[0.77, 1.31, -0.1], [0.52, 1.4, -0.015], [0.24, 1.465, 0.03], [0.04, 1.455, 0.065]]
  tree.add(tube(branchPts, 0.046, bark))
  tree.add(tube([[0.81, 1.76, -0.13], [1.02, 1.96, -0.1], [1.12, 2.24, -0.09]], 0.045, bark))
  tree.add(tube([[0.86, 1.9, -0.15], [0.53, 2.13, -0.22], [0.26, 2.28, -0.21]], 0.043, bark))
  // Sparse bark ridges and a rounded knot mark the tree's age gently.
  tree.add(tube([[0.83, 0.42, 0.035], [0.89, 0.8, 0.035], [0.85, 1.1, 0.012]], 0.008, barkHighlight))
  const treeKnot = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.012, 7, 20), barkHighlight)
  treeKnot.position.set(0.83, 0.89, 0.042)
  treeKnot.scale.set(0.75, 1.28, 1)
  tree.add(treeKnot)
  const crownGeo = new THREE.IcosahedronGeometry(1, 2)
  for (const [i, [x, y, z, scale]] of [
    [0.43, 2.3, -0.23, 0.39], [0.82, 2.42, -0.27, 0.42],
    [1.13, 2.27, -0.19, 0.34], [0.91, 2.08, -0.3, 0.29],
  ].entries()) {
    const crown = new THREE.Mesh(crownGeo, i % 2 ? mint : sage)
    crown.position.set(x, y, z)
    crown.scale.set(scale, scale * 0.77, scale * 0.8)
    crown.castShadow = crown.receiveShadow = true
    tree.add(crown)
  }
  for (let i = 0; i < 4; i++) {
    const moss = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mossMat)
    moss.position.set(0.77 + Math.cos(i * 1.7) * 0.23, 0.032, -0.02 + Math.sin(i * 1.7) * 0.17)
    moss.scale.set(0.12, 0.03, 0.085)
    world.add(moss)
  }

  const guideMat = new THREE.MeshBasicMaterial({ color: 0xe5c985, transparent: true, opacity: 0.84 })
  const branchGuide = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.007, 6, 32), guideMat)
  branchGuide.position.copy(TIED)
  branchGuide.name = 'clootie-low-branch-guide'
  world.add(branchGuide)
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  const branchTarget = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), hitMat)
  branchTarget.name = 'clootie-branch-target'
  branchTarget.position.copy(TIED)
  world.add(branchTarget)

  const cottonMap = cottonTexture()
  const cotton = new THREE.MeshStandardMaterial({ color: 0xf6e8c9, map: cottonMap, roughness: 1, side: THREE.DoubleSide })
  // Preserve the original cotton map and its animated wet color.
  applyCraftSurface(cotton, { kind: 'fabric', strength: .2 })
  const rag = new THREE.Group()
  rag.name = 'clootie-rag'
  rag.position.copy(DRY)
  world.add(rag)
  const clothGeo = new THREE.PlaneGeometry(CLOTH_W, CLOTH_H, COLS, ROWS)
  const cloth = new THREE.Mesh(clothGeo, cotton)
  cloth.name = 'clootie-cotton-rag'
  cloth.castShadow = cloth.receiveShadow = true
  // Woven cotton and its folds stay readable without a black outline for
  // every tiny wrinkle in the soft village render style.
  cloth.userData.toonSurface = { outline: false }
  rag.add(cloth)
  const ragHandle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), hitMat)
  ragHandle.name = 'clootie-rag-handle'
  rag.add(ragHandle)
  addInteractionCue(ragHandle, {
    kind: 'drag', label: '拖棉布入井水', priority: 2,
    enabled: () => active() && !motion && checkpoint === 0,
    destination: water, targetLabel: '井水',
  })
  addInteractionCue(ragHandle, {
    kind: 'drag', label: '拖湿布到低枝', priority: 2,
    enabled: () => active() && !motion && checkpoint === 1,
    destination: branchTarget, targetLabel: '低枝挂点',
  })
  addInteractionCue(ragHandle, {
    kind: 'tap', label: '轻触布片再松手', priority: 2,
    enabled: () => active() && !motion && checkpoint === 2,
  })
  const knot = new THREE.Group()
  knot.name = 'clootie-cotton-knot'
  const knotGeo = new THREE.TorusGeometry(0.043, 0.015, 7, 24)
  for (const side of [-1, 1]) {
    const loop = new THREE.Mesh(knotGeo, cotton)
    loop.position.set(side * 0.027, -0.025, 0.008)
    loop.rotation.y = side * 0.46
    loop.scale.set(0.72, 0.5, 1)
    knot.add(loop)
  }
  rag.add(knot)

  const shadowMap = softShadowTexture()
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowMap, color: 0x536349, transparent: true, opacity: 0.27, depthWrite: false })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 1.55), shadowMat)
  shadow.name = 'clootie-contact-shadow'
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0.04, 0.005, 0.14)
  world.add(shadow)

  // Lazy-loaded Rapier cloth host (135 particles, tensionOnly, real branch/trunk/well/ground colliders).
  let ragBody: ReturnType<RapierSoftBodySession['createCloth']> | null = null
  let rapierRequested = false
  let rapierReady = false
  let physicsStepped = false
  let lastReduced = false
  const tmpSample = new THREE.Vector3()
  const pinnedTopRow: number[] = []
  for (let i = 0; i < SIM_NU; i++) pinnedTopRow.push(i * SIM_NV)

  function topAnchorWorld(u: number, out: THREE.Vector3): THREE.Vector3 {
    // When untied (entry / wet over well), keep full woven cotton width; when tied on the branch,
    // cinch smoothly under the knot with 3-flute Z-pleats so weft stiffness naturally fans out
    // into lush, volumetric vertical drapery folds instead of collapsing into a narrow strip.
    const topWidth = THREE.MathUtils.lerp(0.42, 0.145, tied)
    const archDrop = Math.pow(Math.abs(u - 0.5) * 2, 1.8) * THREE.MathUtils.lerp(0.024, 0.028, tied)
    const zPleat = tied * (0.028 * Math.cos((u - 0.5) * Math.PI * 5) - 0.006) + (1 - tied) * 0.016 * Math.sin((u - 0.5) * Math.PI * 3)
    return out.set(
      rag.position.x + (u - 0.5) * topWidth,
      rag.position.y - archDrop,
      rag.position.z + zPleat,
    )
  }

  function resetRagBodyToCurrentPose() {
    if (!ragBody || !ragBody.isValid()) return
    for (let i = 0; i < SIM_NU; i++) {
      const u = i / (SIM_NU - 1)
      topAnchorWorld(u, tmpSample)
      const flareW = THREE.MathUtils.lerp(0.44, 0.36, tied)
      for (let j = 0; j < SIM_NV; j++) {
        const v = j / (SIM_NV - 1)
        const k = i * SIM_NV + j
        const spread = THREE.MathUtils.lerp(tmpSample.x - rag.position.x, (u - 0.5) * flareW, Math.pow(v, 0.62))
        const pleatZ = (0.034 * tied + 0.022 * (1 - tied)) * Math.cos((u - 0.5) * Math.PI * 5 + v * 1.1) * Math.sin(v * Math.PI * 0.85)
        ragBody.setParticlePosition(k, {
          x: rag.position.x + spread,
          y: Math.max(0.04, tmpSample.y - v * CLOTH_H),
          z: tmpSample.z + pleatZ + 0.022 * v * v,
        })
        ragBody.setParticleVelocity(k, { x: 0, y: 0, z: 0 })
      }
    }
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
      // Real Rapier rigid colliders for the low overhanging branch, trunk, stone well rim, and meadow ground.
      for (let i = 0; i < branchPts.length - 1; i++) {
        addSegmentCapsule(session, branchPts[i]!, branchPts[i + 1]!, 0.052)
      }
      addSegmentCapsule(session, [0.80, 0.14, -0.10], [0.79, 2.05, -0.15], 0.135)
      session.addFixedCylinder({ x: -0.62, y: 0.22, z: 0.06 }, 0.54, 0.44, { friction: 0.7, restitution: 0.02 })
      session.addFixedBox({ x: 0, y: -0.05, z: 0 }, { x: 5.0, y: 0.10, z: 5.0 }, { friction: 0.8, restitution: 0.02 })

      // Keep weft compression resistance (`tensionOnly: false`) with soft bending so the gathered
      // top knot naturally buckles into 3 deep, volumetric woven-cotton drapery flutes below the knot.
      ragBody = session.createCloth({
        origin: { x: DRY.x - CLOTH_W / 2, y: DRY.y, z: DRY.z },
        du: { x: CLOTH_W / (SIM_NU - 1), y: 0, z: 0 },
        dv: { x: 0, y: -CLOTH_H / (SIM_NV - 1), z: 0 },
        nu: SIM_NU,
        nv: SIM_NV,
        mass: 0.28,
        particleRadius: 0.015,
        gravityScale: 1.0,
        linearDamping: 2.4,
        edgeSoftness: { naturalFrequency: 18, dampingRatio: 0.86 },
        bendSoftness: { naturalFrequency: 3.2, dampingRatio: 0.80 },
        tensionOnly: false,
        pinnedParticles: pinnedTopRow,
        friction: 0.65,
        restitution: 0.02,
        canSleep: false,
      })
      rapierReady = true
      if (!reduced()) {
        resetRagBodyToCurrentPose()
        host.settle(54, applyRagForces)
        physicsStepped = true
        writeFromRapier()
      } else {
        poseCloth()
      }
    },
  })

  function applyRagForces(_session: RapierSoftBodySession, subDt: number) {
    if (!ragBody || !ragBody.isValid()) return
    simClock += subDt
    const t = simClock
    ragBody.resetForces(false)
    const pMass = Math.max(ragBody.mass() / (SIM_NU * SIM_NV), 1e-4)
    const vel = ragBody.particleVelocities()

    for (let i = 0; i < SIM_NU; i++) {
      const u = i / (SIM_NU - 1)
      topAnchorWorld(u, tmpSample)
      ragBody.setParticleKinematicTarget(i * SIM_NV, { x: tmpSample.x, y: tmpSample.y, z: tmpSample.z })
    }

    // Serene lakeside breeze: gently billows heavy wet cotton into organic asymmetric drapery
    // while keeping woven cloth width full and readable on both official stage and close-up.
    const breezeScale = checkpoint === 3 ? 0.82 : checkpoint === 0 ? 0.42 : 1.0
    for (let i = 0; i < SIM_NU; i++) {
      const u = i / (SIM_NU - 1)
      for (let j = 1; j < SIM_NV; j++) {
        const v = j / (SIM_NV - 1)
        const k = i * SIM_NV + j
        const vWeight = THREE.MathUtils.smoothstep(v, 0.06, 0.92)
        const gustPhase = t * 1.55 - v * 2.5 + u * 2.2

        const windX = (1.35 + 1.35 * Math.sin(gustPhase) + 0.5 * Math.sin(t * 2.7 - v * 4.0)) * breezeScale * vWeight
        const windZ = (0.95 + 1.05 * Math.cos(gustPhase * 0.85) + 1.15 * Math.cos((u - 0.5) * Math.PI * 5) * tied) * breezeScale * vWeight

        const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!
        ragBody.addParticleForce(k, {
          x: pMass * (windX - 1.8 * vx),
          y: pMass * (-1.4 * vy),
          z: pMass * (windZ - 1.8 * vz),
        }, false)
      }
    }
  }

  function writeFromRapier() {
    if (!ragBody || !ragBody.isValid()) return
    const simPos = ragBody.particlePositions()
    const attr = clothGeo.getAttribute('position') as THREE.BufferAttribute
    const heightScale = THREE.MathUtils.lerp(0.48, 1.0, unfold)
    const originX = rag.position.x, originY = rag.position.y, originZ = rag.position.z

    for (let row = 0; row <= ROWS; row++) {
      const v = row / ROWS
      for (let col = 0; col <= COLS; col++) {
        const u = col / COLS
        sampleClothGrid(simPos, SIM_NU, SIM_NV, u, v, tmpSample)
        let lx = tmpSample.x - originX
        let ly = tmpSample.y - originY
        let lz = tmpSample.z - originZ

        if (unfold < 0.999) {
          // Soft double-drape dry cloth fold at entry (no rigid zig-zag accordion):
          // smooth vertical gathering + gentle organic lap fold in Z.
          const foldFactor = 1 - unfold
          ly *= heightScale
          lz += foldFactor * (0.042 * Math.sin(v * Math.PI * 2.0) + 0.018 * Math.sin((u - 0.5) * Math.PI * 3) * v)
        }

        // Keep unfolding cotton safely above the host floor (y >= 0.02) and readable in frame.
        const minLocalY = 0.02 - originY
        if (ly < minLocalY) ly = minLocalY
        attr.setXYZ(row * (COLS + 1) + col, lx, ly, lz)
      }
    }
    attr.needsUpdate = true
    clothGeo.computeVertexNormals()
    clothGeo.computeBoundingBox()
    clothGeo.computeBoundingSphere()
    ragHandle.position.set(0, -THREE.MathUtils.lerp(0.15, 0.28, unfold), 0.025)
    knot.visible = tied > 0.6
    knot.scale.setScalar(Math.max(0.01, tied))
    cotton.color.setHex(checkpoint === 0 && !motion ? 0xf6e8c9 : 0xd8dfc8)
    world.updateMatrixWorld(true)
  }

  const ray = createPointerRay(canvas, camera)
  const dragPlane = new THREE.Plane(), dragPoint = new THREE.Vector3(), dragOffset = new THREE.Vector3(), dragOrigin = new THREE.Vector3()
  const home = () => checkpoint === 0 ? DRY : checkpoint === 1 ? WET : TIED
  const ending = createQuietEnding(ctx, { ui: ui, isActive: () => started && !disposed && active(),
    duration: 3, motion: 'sway', targets: () => [rag], cancelInput: () => { pointer.cancel() }, complete: () => begin(),
  })
  const syncUI = () => {
    ui.renderDots(checkpoint, 3)
    actionBtn.hidden = checkpoint === 3
    actionBtn.disabled = motion !== null || checkpoint === 3
    setSafeText(actionBtn, checkpoint === 0 ? COPY.dipAction : checkpoint === 1 ? COPY.tieAction : COPY.releaseAction, assertSafeCopy)
    setSafeText(hintEl, motion ? [COPY.dipping, COPY.tying, COPY.settling][motion.step] : [COPY.dip, COPY.tie, COPY.release, COPY.done][checkpoint], assertSafeCopy)
    branchGuide.visible = checkpoint === 1 && !motion
    ending.sync(checkpoint === 2 && !motion)
  }
  const poseCloth = () => {
    if (rapierReady && physicsStepped && !reduced()) {
      writeFromRapier()
      return
    }
    const attr = clothGeo.getAttribute('position') as THREE.BufferAttribute
    const breeze = reduced() || checkpoint === 3 ? 0 : Math.sin(clock * 1.55) * 0.013
    const foldFactor = 1 - unfold
    const heightScale = THREE.MathUtils.lerp(0.48, 1.0, unfold)
    const minLocalY = 0.02 - rag.position.y
    for (let row = 0; row <= ROWS; row++) for (let col = 0; col <= COLS; col++) {
      const u = col / COLS, v = row / ROWS
      const uCentered = u - 0.5
      // Top cinch matches `topAnchorWorld` under the branch knot (`0.145m` tied, `0.42m` untied);
      // heavy wet cotton expands along a smooth gravity flare with 3 deep vertical pleats
      // instead of bulging into a smooth rounded dome.
      const topWidth = THREE.MathUtils.lerp(0.42, 0.145, tied)
      const hemWidth = THREE.MathUtils.lerp(0.46, 0.415, tied)
      const flareV = Math.pow(v, THREE.MathUtils.lerp(0.70, 0.78, tied))
      const softBell = 1 + tied * 0.055 * Math.sin(v * Math.PI)
      const width = THREE.MathUtils.lerp(topWidth, hemWidth, flareV) * softBell
      const archDrop = Math.pow(Math.abs(uCentered) * 2, 1.8) * THREE.MathUtils.lerp(0.022, 0.028, tied)

      const tiedFlute = Math.cos(uCentered * Math.PI * 5)
      const tiedAmp = 0.028 + 0.024 * Math.sin(v * Math.PI * 0.78)
      const tiedZ = (tiedFlute * tiedAmp - 0.006 * (1 - v))
        + 0.008 * Math.sin(uCentered * Math.PI * 3 + 0.35) * Math.pow(v, 1.1)
        + 0.024 * Math.pow(v, 1.35)

      const untiedZ = 0.016 * Math.sin(uCentered * Math.PI * 3) * (1 - 0.15 * v)
        + 0.012 * Math.cos(uCentered * Math.PI * 5) * Math.sin(v * Math.PI * 0.8)
        + 0.016 * v * v

      let z = THREE.MathUtils.lerp(untiedZ, tiedZ, tied) + breeze * v * v
      const pleatPinchX = -tied * 0.0035 * Math.sin(uCentered * Math.PI * 10) * Math.sin(v * Math.PI * 0.85) * v
      const x = uCentered * width + pleatPinchX + (breeze + dragBend * 0.13) * v * v

      const hemGatherLift = tied * (0.024 * Math.pow(Math.abs(uCentered) * 2, 1.6) + 0.010 * tiedFlute) * v
      const untiedHemSoft = (1 - tied) * 0.008 * Math.sin(u * Math.PI * 2) * v
      let y = -archDrop - v * CLOTH_H + hemGatherLift + untiedHemSoft

      if (foldFactor > 0.001) {
        // Soft double-drape dry cotton fold at entry (no rigid zig-zag accordion).
        y *= heightScale
        z += foldFactor * (0.042 * Math.sin(v * Math.PI * 2.0) + 0.016 * Math.sin(uCentered * Math.PI * 3) * v)
      }
      if (y < minLocalY) y = minLocalY
      attr.setXYZ(row * (COLS + 1) + col, x, y, z)
    }
    attr.needsUpdate = true
    clothGeo.computeVertexNormals()
    clothGeo.computeBoundingBox()
    clothGeo.computeBoundingSphere()
    ragHandle.position.set(0, -THREE.MathUtils.lerp(0.15, 0.28, unfold), 0.025)
    knot.visible = tied > 0.6
    knot.scale.setScalar(Math.max(0.01, tied))
    cotton.color.setHex(checkpoint === 0 && !motion ? 0xf6e8c9 : 0xd8dfc8)
    world.updateMatrixWorld(true)
  }
  const restorePose = (reseedPhysics = true) => {
    rag.position.copy(home())
    unfold = checkpoint === 0 ? 0 : 1
    tied = checkpoint >= 2 ? 1 : 0
    dragBend = 0
    if (reseedPhysics && rapierReady && !reduced()) {
      resetRagBodyToCurrentPose()
      host.settle(24, applyRagForces)
    }
    poseCloth()
  }
  const finish = () => {
    if (!motion) return
    const finishedStep = motion.step
    checkpoint = (motion.step + 1) as Checkpoint
    motion = null
    // Preserve live Rapier swinging momentum when settling from tying or releasing!
    restorePose(finishedStep === 0 && reduced())
    syncUI()
    ctx.onProgress?.(checkpoint)
    if (disposed || !active()) return
    feedback.impact({ freqs: checkpoint === 1 ? [285, 428] : [342, 513], duration: 0.3, gain: 0.04 })
    if (disposed || !active()) return
    if (checkpoint === 3 && !completed) {
      completed = true
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    }
  }
  const begin = (_arrived = false) => {
    if (checkpoint === 2 && !ending.completing) return
    if (!active() || motion || checkpoint === 3) return
    motion = { step: checkpoint, time: 0, from: rag.position.clone() }
    dragging = false
    if (reduced()) finish()
    else syncUI()
  }
  const dragStart = new THREE.Vector2()
  const placementReady = (x: number, y: number) => checkpoint < 2 && Math.hypot(x - dragStart.x, y - dragStart.y) > 0
    && placementHit(canvas, camera, ragHandle, x, y, (px, py) => ray.hits(px, py, [checkpoint === 0 ? water : branchTarget]))
  const pointer = createObjectPointer(hitLayer, {
    isActive: active,
    canStart(x, y) { return !motion && checkpoint < 3 && ray.hits(x, y, [ragHandle, cloth]) },
    onStart(x, y) {
      dragging = true
      dragStart.set(x, y)
      feedback.prepare()
      dragOrigin.copy(ragHandle.getWorldPosition(new THREE.Vector3()))
      dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), rag.position)
      if (ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) dragOffset.copy(rag.position).sub(dragPoint)
    },
    onMove(x, y) {
      if (!dragging || checkpoint === 2) return
      if (ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) {
        rag.position.copy(dragPoint).add(dragOffset)
        rag.position.x = THREE.MathUtils.clamp(rag.position.x, -1.12, 1.15)
        rag.position.y = THREE.MathUtils.clamp(rag.position.y, checkpoint === 0 ? 0.31 : 0.79, 2)
        dragBend = THREE.MathUtils.clamp(rag.position.x - dragOrigin.x, -0.8, 0.8)
        poseCloth()
      }
      if (dragging && placementReady(x, y) && pointer.finish()) { dragging = false; begin(true) }
    },
    onRelease(x, y) {
      const valid = dragging && active() && !motion && (checkpoint === 2 || placementReady(x, y))
      dragging = false
      if (valid) begin()
      else restorePose()
    },
    onCancel() { dragging = false; if (!motion) restorePose() },
  })
  const onAction = () => {
    if (!active() || motion || pointer.isBusy() || checkpoint === 3) return
    feedback.prepare()
    begin()
  }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    camera.position.set(0.12, 1.86, 5.1 + portraitBoost(aspect, 4))
    camera.lookAt(lookAt)
    camera.updateMatrixWorld(true)
  }

  poseCloth()
  syncUI()
  return {
    start() {
      if (disposed || started) return
      started = true
      lastReduced = reduced()
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      completed = checkpoint === 3
      restorePose()
      syncUI()
      resize()
      if (!lastReduced) {
        rapierRequested = true
        void host.start()
      }
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      actionBtn.addEventListener('click', onAction)
    },
    update(dt) {
      if (disposed || !started) return
      if (!active()) {
        pointer.cancel()
        styleRenderer.render()
        return
      }
      const isReduced = reduced()
      if (isReduced !== lastReduced) {
        lastReduced = isReduced
        if (isReduced) {
          poseCloth()
        } else if (!rapierRequested) {
          rapierRequested = true
          void host.start()
        } else if (rapierReady && ragBody && ragBody.isValid()) {
          resetRagBodyToCurrentPose()
          host.wakeUp()
          host.settle(30, applyRagForces)
          physicsStepped = true
          writeFromRapier()
        }
      }
      const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0
      clock += delta
      if (motion) {
        const duration = motion.step === 0 ? 1.15 : motion.step === 1 ? 0.95 : 0.65
        motion.time = isReduced ? 1 : Math.min(1, motion.time + delta / duration)
        const p = smooth(motion.time)
        if (motion.step === 0) {
          if (motion.time < 0.56) rag.position.lerpVectors(motion.from, DIPPED, smooth(motion.time / 0.56))
          else rag.position.lerpVectors(DIPPED, WET, smooth((motion.time - 0.56) / 0.44))
          unfold = smooth(Math.min(1, motion.time / 0.42))
          const ripple = Math.sin(Math.min(1, motion.time / 0.8) * Math.PI)
          ripples.forEach((ring, i) => ring.scale.setScalar(1 + ripple * (0.2 + i * 0.1)))
        } else if (motion.step === 1) {
          rag.position.lerpVectors(motion.from, TIED, p)
          tied = p
        } else {
          dragBend = Math.sin(p * Math.PI) * 0.14 * (1 - p)
          if (!isReduced && rapierReady && ragBody && ragBody.isValid() && motion.time < 0.15) {
            // Soft release sway impulse as the hand lets go of the wet cotton.
            const m = Math.max(ragBody.mass() / (SIM_NU * SIM_NV), 1e-4)
            for (let i = 0; i < SIM_NU; i++) {
              for (let j = 6; j < SIM_NV; j++) {
                ragBody.applyParticleImpulse(i * SIM_NV + j, { x: m * 0.45 * delta * 25, y: 0, z: m * 0.35 * delta * 25 }, true)
              }
            }
          }
        }
        if (motion.time === 1) finish()
        if (disposed || !active()) return
      }
      if (!isReduced && rapierReady && ragBody) {
        const stepped = host.step(delta, applyRagForces)
        if (stepped || physicsStepped) {
          physicsStepped = true
          writeFromRapier()
        } else {
          poseCloth()
        }
      } else {
        poseCloth()
      }
      guideMat.opacity = isReduced ? 0.84 : 0.73 + Math.sin(clock * 2) * 0.11
      ending.update(dt)
      if (disposed || !(active())) return
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose()
      disposed = true
      ragBody = null
      rapierRequested = false
      rapierReady = false
      physicsStepped = false
      host.dispose()
      pointer.dispose()
      stopResize()
      actionBtn.removeEventListener('click', onAction)
      feedback.dispose()
      styleRenderer.dispose()
      disposeTree(scene)
      cottonMap.dispose()
      shadowMap.dispose()
      Object.values(lights).forEach((light) => light.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      scene.clear()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
