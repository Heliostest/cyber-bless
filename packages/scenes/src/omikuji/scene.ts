import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { placementHit } from '../placement-hit'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'
import { createWoodGrainTexture, projectHexPrismWoodUVs, projectWoodUVs, type WoodGrainOptions } from './wood-grain'

const COPY = {
  title: '签纸慢读', steps: '步骤', shake: '轻摇签筒', draw: '抽出并展开', keep: '将纸签收好',
  ready: '从御神签的抽签问意说起，留片刻自省。按住木签筒，拖到浅色倾斜位置，轻轻摇一摇。',
  stick: '一根签棒露出来了。按住签棒向上抽，展开纸签，读一句原创的日常提醒。',
  reflection: '把今天能照顾的一件小事，慢慢做好。',
  read: '这句原创提醒留给自己：把今天能照顾的一件小事，慢慢做好。读过后，将纸签拖进信封。',
  done: '纸签已收好。把这句自省提醒，留给今天的一件小事。',
  shaking: '木筒轻轻摇动，留一点从容…', drawing: '慢慢抽出，展开一张纸签…', keeping: '把读过的纸签轻轻收好…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type Motion = { step: 0 | 1 | 2; time: number; from: THREE.Vector3; rotation: THREE.Euler }
const READY = new THREE.Vector3(-0.52, 0.975, 0.08)
const TILT = new THREE.Vector3(0.37, 1.28, 0.08)
const STICK = new THREE.Vector3(-0.52, 1.655, 0.08)
const DRAW = new THREE.Vector3(-0.52, 2.28, 0.08)
const READ = new THREE.Vector3(-0.09, 1.5, 0.5)
const KEEP = new THREE.Vector3(0.67, 0.77, 0.385)
/** A held object swells slightly, like an app item lifted under the finger. */
const HELD_SCALE = 0.055
const smooth = (t: number) => { const p = THREE.MathUtils.clamp(t, 0, 1); return p * p * (3 - 2 * p) }

/** Beveled six-sided timber body, with the extrusion axis turned vertically. */
function hexagon(radius: number, height: number, bevel = 0.012) {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, x = Math.cos(a) * radius, y = Math.sin(a) * radius
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
  }
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height - bevel * 2, bevelEnabled: true,
    bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 1, steps: 1 })
  geometry.translate(0, 0, -(height - bevel * 2) / 2); geometry.rotateX(-Math.PI / 2)
  return geometry
}

/** Three quiet object gestures, with an original reflection instead of a fortune grade. */
export function createOmikuji(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let checkpoint: Checkpoint = 0, started = false, disposed = false, completed = false, dragging = false, focused = true
  let motion: Motion | null = null, stopResize = () => {}
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const { renderer, scene } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'omikuji', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff1db, ground: 0xbebc9c, key: 0xffe4bc,
    rim: 0xd4e5d1, keyPosition: [-2.5, 4.3, 3.3], keyIntensity: 1.2, rimIntensity: 0.45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 0.1, far: 12 })
  lights.key.shadow.bias = -0.0008; lights.key.shadow.normalBias = 0.02
  const world = new THREE.Group(); world.name = 'omikuji-courtyard-work'; scene.add(world)
  const material = (color: number, roughness = 0.91) => new THREE.MeshStandardMaterial({ color, roughness })
  const woodTextures: THREE.DataTexture[] = []
  const woodMat = (
    color: number,
    roughness: number,
    axis: 'x' | 'y' | 'z',
    scale: number,
    strength: number,
    grainOpts: WoodGrainOptions,
    offsetU = 0,
    offsetV = 0,
  ) => {
    const map = createWoodGrainTexture(grainOpts, offsetU, offsetV)
    woodTextures.push(map)
    return applyCraftSurface(new THREE.MeshStandardMaterial({ color, roughness, map }), { kind: 'wood', strength, scale, axis })
  }
  const honey = woodMat(0xd9ad6e, 0.78, 'y', 0.78, 0.2, {
    seed: 11, rings: 5.8, drift: 0.088, arch: 0.068, contrast: 0.165, wash: 0.048,
    knots: [
      { u: 0.24, v: 0.30, rx: 0.068, ry: 0.036, pull: 0.76, depth: 0.84 },
      { u: 0.75, v: 0.74, rx: 0.056, ry: 0.032, pull: 0.72, depth: 0.78 },
    ],
  })
  const rimWoodTop = woodMat(0xdeb579, 0.81, 'x', 0.66, 0.18, {
    seed: 19, rings: 5.2, drift: 0.075, arch: 0.055, contrast: 0.135, wash: 0.038,
    knots: [{ u: 0.74, v: 0.28, rx: 0.062, ry: 0.034, pull: 0.70, depth: 0.68 }],
  })
  const rimWoodBottom = woodMat(0xd2a66a, 0.82, 'x', 0.82, 0.2, {
    seed: 23, rings: 6.2, drift: 0.082, arch: 0.052, contrast: 0.15, wash: 0.042,
  }, 0.24, 0.41)
  const stickWood = woodMat(0xe2b778, 0.79, 'y', 0.9, 0.2, {
    seed: 31, rings: 5.6, drift: 0.065, arch: 0.042, contrast: 0.125, wash: 0.032,
  })
  const edge = woodMat(0xb27e49, 0.82, 'y', 0.86, 0.22, {
    seed: 37, rings: 6.8, drift: 0.078, arch: 0.048, contrast: 0.155, wash: 0.04,
  })
  const grainAccent = material(0xc0905b, 0.86)
  const standTop = woodMat(0xbe9265, 0.78, 'x', 0.62, 0.2, {
    seed: 43, rings: 5.8, drift: 0.092, arch: 0.076, contrast: 0.175, wash: 0.052,
    knots: [
      { u: 0.48, v: 0.78, rx: 0.056, ry: 0.036, pull: 0.78, depth: 0.92 },
      { u: 0.21, v: 0.50, rx: 0.052, ry: 0.026, pull: 0.74, depth: 0.84 },
      { u: 0.79, v: 0.25, rx: 0.058, ry: 0.034, pull: 0.72, depth: 0.8 },
    ],
  })
  const standApron = woodMat(0xaa7b4f, 0.82, 'x', 0.84, 0.22, {
    seed: 53, rings: 6.6, drift: 0.08, arch: 0.058, contrast: 0.16, wash: 0.044,
    knots: [{ u: 0.64, v: 0.48, rx: 0.054, ry: 0.028, pull: 0.72, depth: 0.78 }],
  })
  const standLegA = woodMat(0xb88b5f, 0.81, 'y', 0.72, 0.2, {
    seed: 61, rings: 5.6, drift: 0.088, arch: 0.06, contrast: 0.165, wash: 0.048,
    knots: [{ u: 0.46, v: 0.54, rx: 0.072, ry: 0.042, pull: 0.76, depth: 0.84 }],
  })
  const standLegB = woodMat(0xac7f55, 0.83, 'y', 0.88, 0.22, {
    seed: 71, rings: 6.4, drift: 0.084, arch: 0.055, contrast: 0.17, wash: 0.046,
    knots: [{ u: 0.68, v: 0.44, rx: 0.066, ry: 0.038, pull: 0.72, depth: 0.8 }],
  })
  const cream = material(0xffefd2), paperEdge = material(0xe6d5b3)
  const sage = material(0x829a80), sageLight = material(0xafb9a0), ink = material(0x947a60), coral = material(0xc77e65)
  // Paper-only optics: the slip and envelope keep a soft fibrous body, while the
  // badge, seal and decorative marks stay flat pigment.
  const slipPaper = createRitualMaterial({ color: 0xfff1d6, roughness: .9 }, { kind: 'paper', strength: .2, fiber: 'paper' })
  const envelopePaper = createRitualMaterial({ color: 0x90a98d, roughness: .9 }, { kind: 'paper', strength: .14, fiber: 'paper' })
  const envelopeLining = material(0x5f7a63), hole = material(0x4a3a2c)
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, name: string, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p)
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const tube = (points: [number, number, number][], radius: number, mat: THREE.Material, parent: THREE.Object3D) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)))
    const mesh = add(new THREE.TubeGeometry(curve, Math.max(10, points.length * 4), radius, 6, false), mat, '', [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  // A low stand keeps the box and the open envelope grounded in the courtyard.
  add(projectWoodUVs(new RoundedBoxGeometry(2.16, 0.14, 1.05, 3, 0.045), 'x', 0.46, 0.88, 0.5, 0.5), standTop, 'omikuji-stand-top', [0, 0.44, 0.13])
  add(projectWoodUVs(new RoundedBoxGeometry(2.05, 0.055, 0.96, 3, 0.022), 'x', 0.5, 1.2, 0.38, 0.5), standApron, 'omikuji-stand-apron', [0, 0.345, 0.13])
  const legSpecs: [number, number, THREE.Material, number, number][] = [
    [-0.83, -0.22, standLegB, 0.28, 0.62],
    [-0.83, 0.47, standLegA, 0.5, 0.5],
    [0.83, -0.22, standLegA, 0.16, 0.32],
    [0.83, 0.47, standLegB, 0.44, 0.48],
  ]
  for (const [x, z, legMat, offU, offV] of legSpecs) {
    add(projectWoodUVs(new RoundedBoxGeometry(0.14, 0.33, 0.16, 3, 0.027), 'y', 2.2, 2.6, offU, offV), legMat, 'omikuji-stand-leg', [x, 0.165, z])
  }
  for (const [z, bend] of [[-0.24, 0.022], [0.04, -0.016], [0.34, 0.019]] as const) {
    tube([[-0.98, 0.514, z], [-0.24, 0.514, z + bend], [0.32, 0.514, z - bend * 0.6], [0.98, 0.514, z]], 0.0021, grainAccent, world)
  }
  const box = new THREE.Group(); box.name = 'omikuji-box'; world.add(box)
  const body = add(projectHexPrismWoodUVs(hexagon(0.315, 0.8), 1.15, 1.75, 0.5, 0.5), honey, 'omikuji-box-body', [0, 0, 0], box)
  for (const y of [-0.42, 0.42]) {
    const rimMat = y > 0 ? rimWoodTop : rimWoodBottom
    const rimGeo = projectWoodUVs(hexagon(0.335, 0.09), 'x', 1.1, 1.2, y > 0 ? 0.5 : 0.18, y > 0 ? 0.5 : 0.64)
    add(rimGeo, rimMat, 'omikuji-box-rim', [0, y, 0], box)
    add(projectWoodUVs(hexagon(0.34, 0.022, 0.005), 'x', 1.2, 1.4, y > 0 ? 0.32 : 0.71, 0.5), edge, 'omikuji-box-band', [0, y + (y > 0 ? -0.044 : 0.044), 0], box)
  }
  // A small round opening in the lid: the stick visibly rises out of a real hole.
  const slot = add(new THREE.CylinderGeometry(0.056, 0.05, 0.012, 28), hole, 'omikuji-box-slot', [0, 0.466, 0], box)
  slot.userData.toonSurface = { outline: false }
  const slotRim = add(new THREE.TorusGeometry(0.064, 0.012, 8, 32), edge, 'omikuji-box-slot-rim', [0, 0.47, 0], box)
  slotRim.rotation.x = Math.PI / 2
  const grain = new THREE.Group(); grain.name = 'omikuji-wood-grain'; box.add(grain)
  for (let face = 0; face < 6; face++) {
    for (let line = 0; line < 4; line++) {
      const shift = Math.sin(face * 2.1 + line * 1.3) * 0.014
      const x = (line - 1.5) * 0.064 + shift
      const w1 = Math.sin(face * 1.7 + line * 2.3) * 0.016
      const w2 = Math.cos(face * 1.3 - line * 1.9) * 0.014
      const lineMesh = tube([[x, -0.34, 0.286], [x + w1, -0.11, 0.286], [x + w2, 0.11, 0.286], [x - w1 * 0.45, 0.34, 0.286]], 0.0017, grainAccent, grain)
      lineMesh.rotation.y = face * Math.PI / 3
    }
  }
  const badge = add(new RoundedBoxGeometry(0.195, 0.36, 0.015, 3, 0.021), cream, 'omikuji-box-badge', [0, 0, 0.293], box)
  badge.userData.toonSurface = { outline: false }
  tube([[0, -0.115, 0.307], [-0.017, -0.035, 0.307], [0.025, 0.075, 0.307]], 0.006, sage, box)
  for (const [x, y, angle] of [[-0.025, -0.07, -0.6], [0.021, 0.005, 0.55], [0.012, 0.075, -0.5]]) {
    const leaf = add(new THREE.SphereGeometry(1, 12, 8), sage, 'omikuji-badge-leaf', [x, y, 0.307], box)
    leaf.scale.set(0.032, 0.015, 0.004); leaf.rotation.z = angle; leaf.userData.toonSurface = { outline: false }
  }
  // A readable stick: rounded body, painted coral tip band and three abstract
  // engraved dots for its number, never a real shrine numeral or verse.
  const stick = add(projectWoodUVs(new RoundedBoxGeometry(0.088, 0.6, 0.062, 4, 0.024), 'y', 1.4, 2.4, 0.5, 0.5), stickWood, 'omikuji-draw-stick', [...STICK.toArray()] as [number, number, number])
  const stickMark = add(new RoundedBoxGeometry(0.094, 0.072, 0.068, 3, 0.022), coral, 'omikuji-stick-mark', [0, 0.248, 0], stick)
  stickMark.userData.toonSurface = { outline: false }
  for (const y of [0.15, 0.1, 0.05]) {
    const dot = add(new THREE.CircleGeometry(0.011, 14), ink, 'omikuji-stick-number-dot', [0, y, 0.0315], stick)
    dot.userData.toonSurface = { outline: false }
  }
  const guideMaterial = new THREE.MeshBasicMaterial({ color: 0x91ae8a, transparent: true, opacity: 0.2, depthWrite: false })
  const tiltTarget = add(hexagon(0.32, 0.8), guideMaterial, 'omikuji-tilt-target', [...TILT.toArray()] as [number, number, number])
  tiltTarget.rotation.z = -0.42; tiltTarget.castShadow = tiltTarget.receiveShadow = false
  tiltTarget.userData.toonSurface = { outline: false }
  const guideRimMaterial = new THREE.MeshBasicMaterial({ color: 0x8fa889, transparent: true, opacity: 0.6, depthWrite: false })
  for (const y of [-0.4, 0.4]) {
    const points: [number, number, number][] = Array.from({ length: 7 }, (_, i) => [Math.cos(i * Math.PI / 3) * 0.33, y, Math.sin(i * Math.PI / 3) * 0.33])
    const rim = tube(points, 0.006, guideRimMaterial, tiltTarget)
    rim.castShadow = rim.receiveShadow = false
  }
  const drawTarget = add(new RoundedBoxGeometry(0.15, 0.25, 0.075, 3, 0.022), guideMaterial, 'omikuji-draw-target', [...DRAW.toArray()] as [number, number, number])
  drawTarget.castShadow = drawTarget.receiveShadow = false; drawTarget.userData.toonSurface = { outline: false }

  // Three hinged sections unfold into one cream paper with original decorative brush marks.
  const paper = new THREE.Group(); paper.name = 'omikuji-paper'; world.add(paper)
  const middle = add(new RoundedBoxGeometry(0.55, 0.34, 0.015, 3, 0.007), slipPaper, 'omikuji-paper-middle', [0, 0, 0], paper)
  const upper = new THREE.Group(), lower = new THREE.Group()
  upper.name = 'omikuji-paper-top-fold'; lower.name = 'omikuji-paper-bottom-fold'
  upper.position.y = 0.17; lower.position.y = -0.17; paper.add(upper, lower)
  const topPanel = add(new RoundedBoxGeometry(0.55, 0.34, 0.015, 3, 0.007), slipPaper, 'omikuji-paper-top', [0, 0.17, 0], upper)
  const bottomPanel = add(new RoundedBoxGeometry(0.55, 0.34, 0.015, 3, 0.007), slipPaper, 'omikuji-paper-bottom', [0, -0.17, 0], lower)
  for (const panel of [topPanel, middle, bottomPanel]) {
    for (const x of [-0.245, 0.245]) tube([[x, -0.15, 0.01], [x, 0, 0.01], [x, 0.15, 0.01]], 0.003, paperEdge, panel)
    for (const [row, length] of [[-0.084, 0.29], [-0.01, 0.34], [0.063, 0.25]]) {
      tube([[-length / 2, row, 0.012], [-0.035, row + 0.004, 0.012], [length / 2, row - 0.002, 0.012]], 0.004, ink, panel)
    }
  }
  const seal = add(new RoundedBoxGeometry(0.085, 0.055, 0.003, 2, 0.009), coral, 'omikuji-paper-small-seal', [0.14, -0.115, 0.012], bottomPanel)
  seal.userData.toonSurface = { outline: false }
  for (const y of [-0.168, 0.168]) tube([[-0.255, y, 0.01], [0, y, 0.01], [0.255, y, 0.01]], 0.0022, paperEdge, paper)

  // A slim paper envelope: the open flap leans back from a darker lining, so the
  // pocket reads as an opening rather than a solid little house.
  const envelope = new THREE.Group(); envelope.name = 'omikuji-envelope'; envelope.position.set(0.67, 0.74, 0.38); world.add(envelope)
  add(new RoundedBoxGeometry(0.66, 0.455, 0.016, 3, 0.008), sageLight, 'omikuji-envelope-back', [0, 0, -0.022], envelope)
  const lining = add(new RoundedBoxGeometry(0.62, 0.1, 0.006, 2, 0.003), envelopeLining, 'omikuji-envelope-lining', [0, 0.175, -0.01], envelope)
  lining.userData.toonSurface = { outline: false }
  const pocket = add(new RoundedBoxGeometry(0.67, 0.43, 0.026, 3, 0.012), envelopePaper, 'omikuji-envelope-pocket', [0, -0.014, 0.039], envelope)
  const flapShape = new THREE.Shape(); flapShape.moveTo(-0.32, 0); flapShape.quadraticCurveTo(-0.04, 0.2, 0, 0.245); flapShape.quadraticCurveTo(0.04, 0.2, 0.32, 0); flapShape.closePath()
  const flapGeometry = new THREE.ExtrudeGeometry(flapShape, { depth: 0.008, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 10 })
  const flap = add(flapGeometry, sageLight, 'omikuji-envelope-open-flap', [0, 0.222, -0.03], envelope)
  flap.rotation.x = -0.42
  tube([[-0.306, 0.17, 0.056], [0, -0.065, 0.056], [0.306, 0.17, 0.056]], 0.0045, sageLight, envelope)
  tube([[-0.31, -0.19, 0.056], [0, -0.066, 0.056], [0.31, -0.19, 0.056]], 0.0032, sageLight, envelope)
  const envelopeSeal = add(new THREE.CircleGeometry(0.038, 24), cream, 'omikuji-envelope-dot', [0, -0.07, 0.058], envelope)
  envelopeSeal.userData.toonSurface = { outline: false }
  // An original leaf pair beside the seal echoes the box badge; no shrine mark.
  for (const [x, angle] of [[-0.058, 0.7], [0.058, -0.7]] as const) {
    const sprig = add(new THREE.SphereGeometry(1, 12, 8), cream, 'omikuji-envelope-leaf', [x, -0.064, 0.058], envelope)
    sprig.scale.set(0.03, 0.013, 0.003); sprig.rotation.z = angle; sprig.userData.toonSurface = { outline: false }
  }

  const canCue = () => active() && !motion
  addInteractionCue(body, { kind: 'drag', label: '拖签筒轻摇', enabled: () => canCue() && checkpoint === 0, destination: tiltTarget, targetLabel: '倾斜轻摇处', priority: 2 })
  addInteractionCue(stick, { kind: 'drag', label: '向上抽出签棒', enabled: () => canCue() && checkpoint === 1, destination: drawTarget, targetLabel: '向上抽出', priority: 2 })
  addInteractionCue(middle, { kind: 'drag', label: '将纸签收进信封', enabled: () => canCue() && checkpoint === 2, destination: pocket, targetLabel: '信封开口', priority: 2 })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.shake }, safe)
  const feedback = createSceneFeedback(ctx), ray = createPointerRay(canvas, camera), touch = createTouchTarget(canvas, camera, scene)
  const plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3(), start = new THREE.Vector2()
  let travel = 0, held = 0
  const carried = () => checkpoint === 0 ? box : checkpoint === 1 ? stick : paper
  const source = () => checkpoint === 0 ? body : checkpoint === 1 ? stick : middle
  const destination = () => checkpoint === 0 ? tiltTarget : checkpoint === 1 ? drawTarget : pocket
  const placementReady = (x: number, y: number) => travel > 0
    && placementHit(canvas, camera, source(), x, y, (px, py) => ray.hits(px, py, [destination()]))
  const matrix = () => { world.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!motion || checkpoint === 3
    setSafeText(ui.actionBtn, [COPY.shake, COPY.draw, COPY.keep, COPY.keep][checkpoint], safe)
    setSafeText(ui.hintEl, motion ? [COPY.shaking, COPY.drawing, COPY.keeping][motion.step] : [COPY.ready, COPY.stick, COPY.read, COPY.done][checkpoint], safe)
  }
  const restore = () => {
    box.position.copy(READY); box.rotation.set(0, 0, 0)
    stick.position.copy(STICK); stick.rotation.set(0, 0, 0); stick.visible = checkpoint === 1
    paper.visible = checkpoint >= 2; paper.position.copy(checkpoint === 3 ? KEEP : READ)
    paper.rotation.set(0, 0, checkpoint === 3 ? 0 : -0.035)
    held = 0; box.scale.setScalar(1); stick.scale.setScalar(1); paper.scale.setScalar(1)
    upper.rotation.x = checkpoint === 3 ? Math.PI : 0; lower.rotation.x = checkpoint === 3 ? -Math.PI : 0
    upper.position.z = checkpoint === 3 ? 0.018 : 0; lower.position.z = checkpoint === 3 ? 0.036 : 0
    tiltTarget.visible = checkpoint === 0; drawTarget.visible = checkpoint === 1
    matrix()
  }
  const finish = () => {
    if (!motion) return
    checkpoint = (motion.step + 1) as Checkpoint; motion = null; restore(); sync()
    ctx.onProgress?.(checkpoint)
    feedback.impact({ freqs: checkpoint === 3 ? [330, 495] : [294, 441], duration: 0.24, gain: 0.02 })
    if (checkpoint === 3 && !completed) {
      completed = true; overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    }
  }
  const begin = (_arrived = false) => {
    if (!active() || motion || checkpoint === 3) return
    motion = { step: checkpoint, time: 0, from: carried().position.clone(), rotation: carried().rotation.clone() }
    dragging = false; tiltTarget.visible = drawTarget.visible = false
    if (reduced()) finish(); else sync()
  }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    // A fingertip-sized margin around the whole held object (badge, grain, stick
    // marks and slip folds included): thin parts stay easy to take without
    // accepting empty courtyard space.
    canStart(x, y) { matrix(); return !motion && checkpoint < 3 && touch.hit(x, y, carried()) },
    onStart(x, y) {
      dragging = true; travel = 0; start.set(x, y); feedback.prepare()
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), carried().position)
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(carried().position).sub(point)
    },
    onMove(x, y) {
      if (!dragging) return
      travel = Math.max(travel, Math.hypot(x - start.x, y - start.y))
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) {
        carried().position.copy(point).add(offset)
        if (checkpoint === 1) { stick.position.x = STICK.x; stick.position.z = STICK.z; stick.position.y = THREE.MathUtils.clamp(stick.position.y, STICK.y, DRAW.y + 0.16) }
        else {
          carried().position.x = THREE.MathUtils.clamp(carried().position.x, -1, 1)
          carried().position.y = THREE.MathUtils.clamp(carried().position.y, 0.72, 2)
          if (checkpoint === 0) box.rotation.z = -0.42 * THREE.MathUtils.clamp((box.position.x - READY.x) / (TILT.x - READY.x), 0, 1)
        }
        matrix()
      }
      if (dragging && placementReady(x, y) && pointer.finish()) { dragging = false; begin(true) }
    },
    onRelease(x, y) {
      travel = Math.max(travel, Math.hypot(x - start.x, y - start.y)); matrix()
      const valid = dragging && active() && !motion && placementReady(x, y)
      dragging = false
      if (valid) begin(); else restore()
    },
    onCancel() { dragging = false; if (!motion) restore() },
  })
  const action = () => {
    if (!active() || motion || pointer.isBusy() || checkpoint === 3) return
    feedback.prepare(); begin()
  }
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    camera.position.set(0, 2.02, 4.62 + portraitBoost(aspect, 4.6)); camera.lookAt(0, 1.3, 0.1); matrix()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      completed = checkpoint === 3; restore(); sync(); resize()
      stopResize = observeCanvasResize(canvas, resize); ui.actionBtn.addEventListener('click', action)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; style.render(); return }
      ui.actionBtn.disabled = !!motion || checkpoint === 3
      const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0
      const lifted = dragging && !reduced() ? 1 : 0
      held = Math.abs(held - lifted) < 0.002 ? lifted : THREE.MathUtils.damp(held, lifted, 16, Math.min(delta, 0.05))
      if (checkpoint < 3) carried().scale.setScalar(1 + HELD_SCALE * smooth(held))
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / (motion.step === 0 ? 1.25 : 1))
        const t = motion.time, p = smooth(t)
        if (motion.step === 0) {
          if (t < 0.3) box.position.lerpVectors(motion.from, TILT, smooth(t / 0.3))
          else if (t > 0.72) box.position.lerpVectors(TILT, READY, smooth((t - 0.72) / 0.28))
          else box.position.copy(TILT)
          const shake = t > 0.3 && t < 0.72 ? Math.sin((t - 0.3) / 0.42 * Math.PI * 4) * 0.07 : 0
          box.rotation.z = t < 0.3 ? THREE.MathUtils.lerp(motion.rotation.z, -0.42, smooth(t / 0.3)) : t > 0.72 ? -0.42 * (1 - smooth((t - 0.72) / 0.28)) : -0.42 + shake
        } else if (motion.step === 1) {
          stick.visible = t < 0.45; stick.position.lerpVectors(motion.from, DRAW, smooth(t / 0.45))
          paper.visible = t >= 0.38
          const unfold = smooth((t - 0.38) / 0.62)
          paper.position.lerpVectors(new THREE.Vector3(-0.34, 1.82, 0.4), READ, unfold)
          upper.rotation.x = Math.PI * 0.94 * (1 - unfold); lower.rotation.x = -Math.PI * 0.94 * (1 - unfold)
        } else {
          paper.position.lerpVectors(motion.from, KEEP, p)
          const fold = smooth(t / 0.72)
          upper.rotation.x = Math.PI * fold; lower.rotation.x = -Math.PI * fold
          upper.position.z = 0.018 * fold; lower.position.z = 0.036 * fold
          paper.rotation.z = motion.rotation.z * (1 - p)
        }
        matrix(); if (t === 1) finish()
      }
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); ui.actionBtn.removeEventListener('click', action)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      feedback.dispose(); style.dispose(); disposeTree(scene)
      woodTextures.forEach(tex => tex.dispose()); woodTextures.length = 0
      Object.values(lights).forEach(light => light.dispose())
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
