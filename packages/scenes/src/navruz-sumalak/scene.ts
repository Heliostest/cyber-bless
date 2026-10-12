import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '春锅共煮', steps: '步骤',
  stir: '沿锅边依次经过浅色圆点，再松手。诺鲁孜邻里共食致敬，非真实烹饪或礼拜。',
  serve: '把木勺拖到空陶碗里，盛出一点麦芽甜食。',
  share: '把盛好的陶碗拖到共食垫上，留给围坐的人。',
  done: '一碗甜食，留给邻里。诺鲁孜节共煮与分享的致敬练习结束。',
  stirAction: '沿锅边缓搅', serveAction: '盛入陶碗', shareAction: '放到共食垫',
  moving: '慢慢落稳这一刻…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type Motion = { step: 0 | 1 | 2; time: number; from: THREE.Vector3; guided: boolean }
const POT_X = -.45, POT_Z = -.14, ARC_RADIUS = .62, ARC_Y = 1.09
const BOWL = new THREE.Vector3(.85, .0045, .59)
const SHARED = new THREE.Vector3(.79, .061, -.62)
const PARKED = new THREE.Vector3(-1.07, 1.09, -.14)
const arcPoint = (t: number) => new THREE.Vector3(POT_X + Math.cos(Math.PI * (1 - t)) * ARC_RADIUS, ARC_Y, POT_Z + Math.sin(Math.PI * (1 - t)) * ARC_RADIUS)
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Original cauldron, spoon and glazed bowls; a public seasonal sharing homage. */
export function createNavruzSumalak(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  Object.values(COPY).forEach(shared.assertSafeCopy)
  let started = false, disposed = false, focused = true, completed = false, checkpoint: Checkpoint = 0
  let motion: Motion | null = null, dragging = false, arcInvalid = false, nextBead = 1, stopResize = () => {}
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.stirAction }, shared.assertSafeCopy)
  const { renderer, scene } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'navruz-sumalak', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xffefdb, ground: 0xb9b298, key: 0xffe7ca, rim: 0xd6e5dc,
    keyPosition: [-3, 5, 3], keyIntensity: 1.2, rimIntensity: .45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0008; lights.key.shadow.normalBias = .025
  const world = new THREE.Group(); world.name = 'navruz-courtyard-hearth'; scene.add(world)
  const mat = (color: number, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness })
  const clay = mat(0xba8a66), clayLight = mat(0xcfaa83), soot = mat(0x504740), iron = mat(0x6d7973), ironRim = mat(0x85948b)
  const caramel = mat(0xa76231, .68), swirlMat = mat(0xc48b48, .75), wood = mat(0xc19057), woodLight = mat(0xd6ab70)
  const glaze = mat(0x78a9a7, .28), cream = mat(0xf1dec2, .4), weave = mat(0xd2ab78), terracotta = mat(0xb27355)
  function add(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], parent: THREE.Object3D = world, name = '') {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.name = name
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  function tube(points: THREE.Vector3[], radius: number, material: THREE.Material, parent: THREE.Object3D, name = '', closed = false) {
    return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), Math.max(20, points.length * 3), radius, 7, closed), material, [0, 0, 0], parent, name)
  }
  const ground = add(new THREE.CylinderGeometry(1.67, 1.7, .045, 64), mat(0xdcc5a5), [0, -.018, 0], world, 'navruz-courtyard-plinth')
  ground.scale.z = .84
  // A low clay hearth supports the broad round kazan. No ceremonial fire.
  add(new THREE.CylinderGeometry(.69, .76, .42, 40), clay, [POT_X, .23, POT_Z], world, 'navruz-clay-hearth')
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2
    const brick = add(new RoundedBoxGeometry(.3, .12, .18, 2, .025), i % 2 ? clayLight : clay, [POT_X + Math.cos(a) * .65, .44, POT_Z + Math.sin(a) * .65])
    brick.rotation.y = -a + Math.PI / 2
  }
  add(new RoundedBoxGeometry(.34, .20, .06, 3, .07), soot, [POT_X, .18, POT_Z + .7], world, 'navruz-hearth-opening')
  for (const x of [-.08, .07]) {
    const log = add(new THREE.CylinderGeometry(.04, .045, .27, 9), wood, [POT_X + x, .105, POT_Z + .69]); log.rotation.x = Math.PI / 2
  }
  const kazan = new THREE.Group(); kazan.name = 'navruz-kazan'; kazan.position.set(POT_X, 0, POT_Z); world.add(kazan)
  const profile = [[0, .39], [.25, .405], [.46, .50], [.60, .69], [.69, .94], [.685, 1.02], [.644, 1.02], [.62, .87], [.5, .7], [.28, .59], [0, .59]].map(([x, y]) => new THREE.Vector2(x, y))
  add(new THREE.LatheGeometry(profile, 56), iron, [0, 0, 0], kazan, 'navruz-round-cauldron-body')
  const rim = add(new THREE.TorusGeometry(.671, .035, 9, 64), ironRim, [0, 1.014, 0], kazan, 'navruz-cauldron-rim'); rim.rotation.x = Math.PI / 2
  for (const side of [-1, 1]) {
    tube([new THREE.Vector3(side * .62, .89, -.14), new THREE.Vector3(side * .86, .94, -.15), new THREE.Vector3(side * .9, 1.02, 0), new THREE.Vector3(side * .86, .94, .15), new THREE.Vector3(side * .62, .89, .14)], .04, ironRim, kazan, `navruz-kazan-handle-${side < 0 ? 'left' : 'right'}`)
  }
  add(new THREE.CylinderGeometry(.632, .622, .025, 56), caramel, [0, .975, 0], kazan, 'navruz-cauldron-food')
  const swirls = new THREE.Group(); swirls.name = 'navruz-caramel-swirls'; swirls.position.y = .995; kazan.add(swirls)
  for (let i = 0; i < 3; i++) {
    const points = Array.from({ length: 38 }, (_, j) => {
      const a = j / 37 * Math.PI * 1.42 + i * 2.05, r = .09 + j / 37 * .45
      return new THREE.Vector3(Math.cos(a) * r, .004, Math.sin(a) * r)
    })
    tube(points, .012, swirlMat, swirls, `navruz-food-swirl-${i}`).userData.toonSurface = { outline: false }
  }
  const sharingMat = add(new RoundedBoxGeometry(.86, .043, .9, 3, .06), weave, [.79, .035, -.62], world, 'navruz-sharing-mat')
  sharingMat.userData.toonSurface = { outline: false }
  for (let i = 0; i < 13; i++) {
    const stripe = add(new THREE.BoxGeometry(.76, .005, .013), i % 3 ? cream : terracotta, [.79, .059, -.98 + i * .06])
    stripe.userData.toonSurface = { outline: false }
  }
  for (const x of [.46, 1.12]) add(new THREE.BoxGeometry(.025, .006, .75), terracotta, [x, .06, -.62]).userData.toonSurface = { outline: false }
  function makeBowl(name: string, position: THREE.Vector3, scale = 1) {
    const bowl = new THREE.Group(); bowl.name = name; bowl.position.copy(position); bowl.scale.setScalar(scale); world.add(bowl)
    const profile = [[0, 0], [.12, 0], [.15, .04], [.23, .09], [.285, .20], [.278, .224], [.25, .215], [.2, .115], [.1, .065], [0, .065]].map(([x, y]) => new THREE.Vector2(x, y))
    add(new THREE.LatheGeometry(profile, 40), glaze, [0, 0, 0], bowl)
    const edge = add(new THREE.TorusGeometry(.272, .013, 6, 40), cream, [0, .215, 0], bowl); edge.rotation.x = Math.PI / 2
    const basin = add(new THREE.CylinderGeometry(.18, .11, .015, 32), cream, [0, .09, 0], bowl, `${name}-basin`)
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2
      const dot = add(new THREE.SphereGeometry(.018, 7, 5), cream, [Math.cos(a) * .253, .16, Math.sin(a) * .253], bowl)
      dot.scale.y = 1.6; dot.userData.toonSurface = { outline: false }
    }
    return { bowl, basin }
  }
  const { bowl, basin } = makeBowl('navruz-serving-bowl', BOWL); basin.name = 'navruz-empty-bowl-basin'
  const food = add(new THREE.CylinderGeometry(.247, .21, .022, 36), caramel, [0, .18, 0], bowl, 'navruz-serving-food')
  const bowlSwirl = tube(Array.from({ length: 25 }, (_, i) => {
    const a = i / 24 * Math.PI * 2, r = .025 + i / 24 * .15
    return new THREE.Vector3(Math.cos(a) * r, .194, Math.sin(a) * r)
  }), .008, swirlMat, bowl, 'navruz-serving-swirl')
  makeBowl('navruz-neighbor-bowl', new THREE.Vector3(.24, .0045, -.93), .64)
  const spoon = new THREE.Group(); spoon.name = 'navruz-wooden-spoon'; world.add(spoon)
  const head = add(new THREE.SphereGeometry(1, 24, 12), wood, [0, 0, 0], spoon, 'navruz-wooden-spoon-bowl'); head.scale.set(.15, .055, .205)
  const hollow = add(new THREE.SphereGeometry(1, 20, 10), woodLight, [0, .04, -.005], spoon); hollow.scale.set(.12, .012, .165)
  const handle = tube([new THREE.Vector3(0, .015, -.13), new THREE.Vector3(-.04, .25, -.2), new THREE.Vector3(-.1, .55, -.27), new THREE.Vector3(-.14, .82, -.31)], .031, wood, spoon, 'navruz-long-wooden-handle')
  tube([new THREE.Vector3(-.012, .13, -.172), new THREE.Vector3(-.071, .43, -.242), new THREE.Vector3(-.13, .75, -.288)], .005, woodLight, spoon).userData.toonSurface = { outline: false }
  const spoonFood = add(new THREE.SphereGeometry(1, 20, 10), caramel, [0, .051, 0], spoon, 'navruz-spoon-food'); spoonFood.scale.set(.12, .018, .163)
  const guides = new THREE.Group(); guides.name = 'navruz-stir-arc'; world.add(guides)
  tube(Array.from({ length: 41 }, (_, i) => arcPoint(i / 40)), .01, cream, guides, 'navruz-curved-stir-path').userData.toonSurface = { outline: false }
  const beads = Array.from({ length: 8 }, (_, i) => {
    const p = arcPoint((i + 1) / 8)
    return add(new THREE.SphereGeometry(.072, 12, 8), cream, [p.x, p.y, p.z], guides, `navruz-stir-bead-${i + 1}`)
  })
  const canCue = () => active() && !motion
  addInteractionCue(head, { kind: 'drag', label: '沿圆点缓搅', enabled: () => canCue() && checkpoint === 0,
    destination: () => beads[Math.min(nextBead - 1, 7)].getWorldPosition(new THREE.Vector3()), targetLabel: '沿弧线到这里' })
  addInteractionCue(head, { kind: 'drag', label: '拖木勺盛入陶碗', enabled: () => canCue() && checkpoint === 1, destination: basin, targetLabel: '空陶碗' })
  addInteractionCue(food, { kind: 'drag', label: '把陶碗留给邻里', enabled: () => canCue() && checkpoint === 2, destination: sharingMat, targetLabel: '共食垫' })
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(), dragPoint = new THREE.Vector3(), offset = new THREE.Vector3()
  const carried = () => checkpoint === 2 ? bowl : spoon
  function pose() {
    spoon.position.copy(checkpoint === 0 ? arcPoint(0) : checkpoint === 1 ? arcPoint(1) : PARKED)
    spoon.rotation.set(0, 0, checkpoint >= 2 ? -.2 : 0)
    spoonFood.visible = checkpoint === 1
    bowl.position.copy(checkpoint === 3 ? SHARED : BOWL)
    food.visible = bowlSwirl.visible = checkpoint >= 2
    guides.visible = checkpoint === 0
    swirls.rotation.y = checkpoint >= 1 ? .3 : 0
    world.updateMatrixWorld(true)
  }
  function sync() {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!motion || checkpoint === 3
    setSafeText(ui.actionBtn, [COPY.stirAction, COPY.serveAction, COPY.shareAction, COPY.shareAction][checkpoint], shared.assertSafeCopy)
    setSafeText(ui.hintEl, motion ? COPY.moving : [COPY.stir, COPY.serve, COPY.share, COPY.done][checkpoint], shared.assertSafeCopy)
  }
  function finish() {
    if (!motion) return
    checkpoint = (motion.step + 1) as Checkpoint; motion = null; nextBead = 1; pose(); sync()
    ctx.onProgress?.(checkpoint); feedback.impact({ freqs: [264, 396], duration: .22, gain: .025 })
    if (checkpoint === 3 && !completed) { completed = true; overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })) }
  }
  function begin(guided = false) {
    if (!active() || motion || checkpoint === 3) return
    motion = { step: checkpoint, time: 0, from: carried().position.clone(), guided }; dragging = false
    if (reduced()) finish(); else sync()
  }
  function moveOnArc(x: number, y: number) {
    if (arcInvalid || !ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) { arcInvalid = true; return }
    const radius = Math.hypot(dragPoint.x - POT_X, dragPoint.z - POT_Z)
    if (Math.abs(radius - ARC_RADIUS) > .15 || dragPoint.z < POT_Z - .11) { arcInvalid = true; return }
    spoon.position.copy(dragPoint)
    // Every bead must be touched in order; the final endpoint alone cannot skip the arc.
    if (nextBead <= 8 && ray.hits(x, y, [beads[nextBead - 1]])) nextBead++
    world.updateMatrixWorld(true)
  }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart: (x, y) => !motion && checkpoint < 3 && ray.hits(x, y, checkpoint === 2 ? [food] : checkpoint === 0 ? [head] : [head, hollow, handle]),
    onStart(x, y) {
      dragging = true; arcInvalid = false; nextBead = 1; feedback.prepare()
      if (checkpoint === 0) plane.set(new THREE.Vector3(0, 1, 0), -ARC_Y)
      else {
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), carried().position)
        if (ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) offset.copy(carried().position).sub(dragPoint)
      }
    },
    onMove(x, y) {
      if (!dragging) return
      if (checkpoint === 0) moveOnArc(x, y)
      else if (ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) {
        carried().position.copy(dragPoint).add(offset)
        carried().position.x = THREE.MathUtils.clamp(carried().position.x, -1.4, 1.4)
        carried().position.y = THREE.MathUtils.clamp(carried().position.y, .0045, 1.65)
        world.updateMatrixWorld(true)
      }
    },
    onRelease(x, y) {
      const valid = dragging && active() && !motion && (checkpoint === 0
        ? !arcInvalid && nextBead === 9 && ray.hits(x, y, [beads[7]])
        : ray.hits(x, y, [checkpoint === 1 ? basin : sharingMat]))
      dragging = false
      if (valid) begin(true); else { nextBead = 1; pose() }
    },
    onCancel() { dragging = false; nextBead = 1; arcInvalid = false; if (!motion) pose() },
  })
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const action = () => { if (!active() || pointer.isBusy() || motion || checkpoint === 3) return; feedback.prepare(); begin() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    camera.position.set(0, 3.55, 5.15 + portraitBoost(aspect, 4.7)); camera.lookAt(0, .65, 0); camera.updateMatrixWorld(true)
  }
  pose(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      completed = checkpoint === 3; pose(); sync(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus)
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); style.render(); return }
      if (motion) {
        const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / (motion.step === 0 && !motion.guided ? 1.15 : .75))
        const t = motion.time, p = smooth(t)
        if (motion.step === 0) {
          if (motion.guided) spoon.position.lerpVectors(motion.from, arcPoint(1), p)
          else spoon.position.copy(arcPoint(p))
          swirls.rotation.y = p * .3
        } else if (motion.step === 1) {
          const serve = BOWL.clone().add(new THREE.Vector3(0, .23, 0))
          if (t < .5) spoon.position.lerpVectors(motion.from, serve, smooth(t * 2))
          else spoon.position.lerpVectors(serve, PARKED, smooth((t - .5) * 2))
          spoon.rotation.z = -.2 * p; food.visible = bowlSwirl.visible = t >= .5; spoonFood.visible = t < .5
        } else { bowl.position.lerpVectors(motion.from, SHARED, p); bowl.position.y += Math.sin(t * Math.PI) * .12 }
        world.updateMatrixWorld(true); if (t === 1) finish()
      }
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); ui.actionBtn.removeEventListener('click', action); feedback.dispose()
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(scene); Object.values(lights).forEach(light => light.dispose())
      renderer.dispose(); renderer.forceContextLoss(); scene.clear(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
