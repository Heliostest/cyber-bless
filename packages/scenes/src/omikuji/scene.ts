import { placementHit } from '../placement-hit'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

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
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.91 })
  const honey = material(0xd5af74), pale = material(0xe9c992), edge = material(0xb88c5d)
  const timber = material(0xb39170), cream = material(0xffefd2), paperEdge = material(0xe6d5b3)
  const sage = material(0x829a80), sageLight = material(0xafb9a0), ink = material(0x947a60), coral = material(0xc77e65)
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
  add(new RoundedBoxGeometry(2.16, 0.14, 1.05, 3, 0.045), timber, 'omikuji-stand-top', [0, 0.44, 0.13])
  add(new RoundedBoxGeometry(2.05, 0.055, 0.96, 3, 0.022), edge, 'omikuji-stand-apron', [0, 0.345, 0.13])
  for (const x of [-0.83, 0.83]) for (const z of [-0.22, 0.47]) {
    add(new RoundedBoxGeometry(0.14, 0.33, 0.16, 3, 0.027), timber, 'omikuji-stand-leg', [x, 0.165, z])
  }
  for (const z of [-0.24, 0.04, 0.34]) tube([[-0.98, 0.515, z], [-0.2, 0.515, z + 0.018], [0.98, 0.515, z]], 0.0028, edge, world)
  const box = new THREE.Group(); box.name = 'omikuji-box'; world.add(box)
  const body = add(hexagon(0.315, 0.8), honey, 'omikuji-box-body', [0, 0, 0], box)
  for (const y of [-0.42, 0.42]) {
    add(hexagon(0.335, 0.09), pale, 'omikuji-box-rim', [0, y, 0], box)
    add(hexagon(0.34, 0.022, 0.005), edge, 'omikuji-box-band', [0, y + (y > 0 ? -0.044 : 0.044), 0], box)
  }
  const slot = add(new RoundedBoxGeometry(0.115, 0.014, 0.075, 3, 0.015), ink, 'omikuji-box-slot', [0, 0.469, 0], box)
  slot.userData.toonSurface = { outline: false }
  const grain = new THREE.Group(); grain.name = 'omikuji-wood-grain'; box.add(grain)
  for (let face = 0; face < 6; face++) {
    for (let line = 0; line < 4; line++) {
      const x = (line - 1.5) * 0.065
      const lineMesh = tube([[x, -0.34, 0.287], [x + 0.012, -0.13, 0.287], [x - 0.006, 0.09, 0.287], [x + 0.008, 0.34, 0.287]], 0.0025, edge, grain)
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
  const stick = add(new RoundedBoxGeometry(0.076, 0.57, 0.057, 3, 0.015), pale, 'omikuji-draw-stick', [...STICK.toArray()] as [number, number, number])
  const stickMark = add(new RoundedBoxGeometry(0.046, 0.025, 0.006, 2, 0.004), coral, 'omikuji-stick-mark', [0, 0.205, 0.031], stick)
  stickMark.userData.toonSurface = { outline: false }
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
  const middle = add(new RoundedBoxGeometry(0.55, 0.34, 0.015, 3, 0.007), cream, 'omikuji-paper-middle', [0, 0, 0], paper)
  const upper = new THREE.Group(), lower = new THREE.Group()
  upper.name = 'omikuji-paper-top-fold'; lower.name = 'omikuji-paper-bottom-fold'
  upper.position.y = 0.17; lower.position.y = -0.17; paper.add(upper, lower)
  const topPanel = add(new RoundedBoxGeometry(0.55, 0.34, 0.015, 3, 0.007), cream, 'omikuji-paper-top', [0, 0.17, 0], upper)
  const bottomPanel = add(new RoundedBoxGeometry(0.55, 0.34, 0.015, 3, 0.007), cream, 'omikuji-paper-bottom', [0, -0.17, 0], lower)
  for (const panel of [topPanel, middle, bottomPanel]) {
    for (const x of [-0.245, 0.245]) tube([[x, -0.15, 0.01], [x, 0, 0.01], [x, 0.15, 0.01]], 0.003, paperEdge, panel)
    for (const [row, length] of [[-0.084, 0.29], [-0.01, 0.34], [0.063, 0.25]]) {
      tube([[-length / 2, row, 0.012], [-0.035, row + 0.004, 0.012], [length / 2, row - 0.002, 0.012]], 0.004, ink, panel)
    }
  }
  const seal = add(new RoundedBoxGeometry(0.085, 0.055, 0.003, 2, 0.009), coral, 'omikuji-paper-small-seal', [0.14, -0.115, 0.012], bottomPanel)
  seal.userData.toonSurface = { outline: false }
  for (const y of [-0.168, 0.168]) tube([[-0.255, y, 0.01], [0, y, 0.01], [0.255, y, 0.01]], 0.0022, paperEdge, paper)

  const envelope = new THREE.Group(); envelope.name = 'omikuji-envelope'; envelope.position.set(0.67, 0.74, 0.38); world.add(envelope)
  add(new RoundedBoxGeometry(0.66, 0.455, 0.022, 3, 0.018), sageLight, 'omikuji-envelope-back', [0, 0, -0.025], envelope)
  const pocket = add(new RoundedBoxGeometry(0.67, 0.43, 0.034, 3, 0.02), sage, 'omikuji-envelope-pocket', [0, -0.014, 0.035], envelope)
  const flapShape = new THREE.Shape(); flapShape.moveTo(-0.32, 0); flapShape.lineTo(0, 0.255); flapShape.lineTo(0.32, 0); flapShape.closePath()
  const flapGeometry = new THREE.ExtrudeGeometry(flapShape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.006, bevelSegments: 3 })
  add(flapGeometry, sageLight, 'omikuji-envelope-open-flap', [0, 0.21, -0.032], envelope)
  tube([[-0.306, 0.17, 0.056], [0, -0.065, 0.056], [0.306, 0.17, 0.056]], 0.004, sageLight, envelope)
  tube([[-0.31, -0.19, 0.056], [0, -0.066, 0.056], [0.31, -0.19, 0.056]], 0.003, sageLight, envelope)
  const envelopeSeal = add(new THREE.CircleGeometry(0.035, 20), cream, 'omikuji-envelope-dot', [0, -0.07, 0.058], envelope)
  envelopeSeal.userData.toonSurface = { outline: false }

  const canCue = () => active() && !motion
  addInteractionCue(body, { kind: 'drag', label: '拖签筒轻摇', enabled: () => canCue() && checkpoint === 0, destination: tiltTarget, targetLabel: '倾斜轻摇处', priority: 2 })
  addInteractionCue(stick, { kind: 'drag', label: '向上抽出签棒', enabled: () => canCue() && checkpoint === 1, destination: drawTarget, targetLabel: '向上抽出', priority: 2 })
  addInteractionCue(middle, { kind: 'drag', label: '将纸签收进信封', enabled: () => canCue() && checkpoint === 2, destination: pocket, targetLabel: '信封开口', priority: 2 })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.shake }, safe)
  const feedback = createSceneFeedback(ctx), ray = createPointerRay(canvas, camera)
  const plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3(), start = new THREE.Vector2()
  let travel = 0
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
    paper.scale.setScalar(1)
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
    canStart(x, y) { matrix(); return !motion && checkpoint < 3 && ray.hits(x, y, checkpoint === 2 ? [middle, topPanel, bottomPanel] : [source()]) },
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
    camera.position.set(0, 2.08, 5.35 + portraitBoost(aspect, 4.6)); camera.lookAt(0, 1.28, 0.1); matrix()
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
      if (motion) {
        const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0
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
      Object.values(lights).forEach(light => light.dispose())
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
