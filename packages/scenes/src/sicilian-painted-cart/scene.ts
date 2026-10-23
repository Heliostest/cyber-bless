import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '彩车迎晴', assemble: '拿住桌前木轮，拖到小车露出的车轴上。',
  display: '握住车厢前侧的木扶手，把整辆小车移到右侧展垫。',
  rest: '轻点小车扶手，静看轮辐与色彩。',
  moving: '木轮与小车缓缓就位…', done: '留一刻欣赏轮雕与彩绘的耐心。',
} as const
const HOME = new THREE.Vector3(-.65, .72, -.08), REST = new THREE.Vector3(.95, .88, -.08)
const WHEEL_HOME = new THREE.Vector3(-1.76, 1.24, .85), JOIN = new THREE.Vector3(0, .5, .66)
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original everyday carretto craft miniature; not a religious triumphal float. */
export function createSicilianPaintedCart(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let dragging = false, maxTravel = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  // Host callbacks may synchronously dispatch input or call update again.
  let notifying = false
  function notifyHost(callback: () => void) {
    const previous = notifying; notifying = true
    try { callback() } finally { notifying = previous }
  }
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '装上彩绘木轮' }, safe)
  Object.assign(ui.actionBtn.style, { minWidth: '44px', minHeight: '44px' })
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'sicilian-painted-cart', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff0dc, ground: 0xb8b8a0, key: 0xffe7c7, rim: 0xdce7da, keyPosition: [-3, 5, 3], keyIntensity: 1.2, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .022
  const world = new THREE.Group(); world.name = 'cart-workbench'; scene.add(world)
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .86 })
  const cream = material(0xeee1be), mustard = material(0xcfa245), teal = material(0x3f7b79), coral = material(0xb9644f), ink = material(0x514437), oak = material(0xc4a47a), walnut = material(0x866747), iron = material(0x675d50)
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, xyz: [number, number, number], name: string, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, xyz: [number, number, number], name: string, parent: THREE.Object3D = world, radius = .012) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, h / 3, d / 3)), mat, xyz, name, parent)
  const axle = (r: number, length: number, mat: THREE.Material, xyz: [number, number, number], name: string, parent: THREE.Object3D) => {
    const mesh = add(new THREE.CylinderGeometry(r, r, length, 32), mat, xyz, name, parent); mesh.rotation.x = Math.PI / 2; return mesh
  }
  addCraftTable(world, { name: 'cart-table', topName: 'cart-table', width: 4.7, depth: 2.05, surfaceY: .72, thickness: .12, center: [0,0], support: 'trestle', finish: 'honey' })
  const shadow = add(new THREE.PlaneGeometry(5.1, 2.7), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0], 'cart-contact-shadow'); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box(2.18, .14, 1.66, walnut, [1.05, .79, -.08], 'cart-display-plinth')
  const mat = box(2.12, .02, 1.60, cream, [1.05, .87, -.08], 'cart-display-mat')
  box(1.08, .02, .31, cream, [-1.76, .73, .85], 'cart-wheel-pad')
  const cart = new THREE.Group(); cart.name = 'cart-miniature'; world.add(cart)
  // A broad travelling miniature stand supports the cart before both wheels are fitted.
  box(.92, .045, .9, walnut, [0, .0225, 0], 'cart-stand-foot', cart)
  for (const z of [-.3, .3]) box(.11, .555, .1, oak, [0, .3225, z], 'cart-stand-upright', cart)
  box(.52, .11, .92, teal, [0, .605, 0], 'cart-axle-cradle', cart)
  axle(.062, 1.40, iron, [0, .5, 0], 'cart-through-axle', cart)
  const axleEnd = axle(.105, .19, mustard, [0, .5, .66], 'cart-axle-end', cart)
  for (const z of [-.29, .29]) box(1.45, .12, .11, walnut, [.04, .705, z], 'cart-chassis-rail', cart)
  box(1.46, .10, .95, mustard, [.015, .815, 0], 'cart-floor', cart)
  // Open cargo bed: thick side walls and battens, with original rectangular painted fields.
  for (const side of [-1, 1]) {
    box(1.43, .34, .075, coral, [.015, 1.025, side * .438], 'cart-side-wall', cart)
    box(1.48, .07, .105, mustard, [.015, 1.225, side * .438], 'cart-top-rail', cart)
    for (const x of [-.67, -.225, .225, .70]) box(.046, .43, .10, mustard, [x, 1.02, side * .45], 'cart-side-batten', cart)
    for (const x of [-.4475, 0, .4625]) {
      box(.355, .235, .012, ink, [x, 1.025, side * .48], 'cart-panel-border', cart, .001)
      box(.315, .194, .012, teal, [x, 1.025, side * .492], 'cart-teal-panel', cart, .001)
      box(.24, .055, .012, mustard, [x, 1.065, side * .504], 'cart-panel-gold-band', cart, .001)
      box(.19, .034, .012, cream, [x, .995, side * .504], 'cart-panel-cream-band', cart, .001)
    }
  }
  for (const x of [-.70, .73]) {
    box(.07, .34, .84, teal, [x, 1.025, 0], 'cart-end-wall', cart)
    box(.10, .07, .96, mustard, [x, 1.225, 0], 'cart-end-rail', cart)
  }
  // Real carrying rail above the near wall; no enlarged picking proxy.
  for (const x of [-.20, .20]) box(.05, .16, .06, walnut, [x, 1.33, .44], 'cart-grip-post', cart)
  const grip = box(.46, .085, .105, walnut, [0, 1.43, .44], 'cart-rail-grip', cart)
  // Two draw shafts connect into the chassis, with joined crosspiece.
  for (const z of [-.30, .30]) {
    box(.64, .075, .075, mustard, [1.005, .71, z], 'cart-draw-shaft', cart)
    box(.15, .075, .08, coral, [1.235, .71, z], 'cart-shaft-tip', cart)
  }
  box(.085, .075, .67, teal, [1.24, .71, 0], 'cart-shaft-crosspiece', cart)
  const wheel = (name: string, parent: THREE.Object3D) => {
    const group = new THREE.Group(); group.name = name; parent.add(group)
    const ring = (outer: number, inner: number, depth: number, z: number, mat: THREE.Material, suffix: string) => {
      const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false)
      const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(hole)
      return add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 }), mat, [0, 0, z], name + suffix, group)
    }
    ring(.50, .403, .09, -.045, ink, '-rim')
    ring(.482, .422, .012, .045, mustard, '-rim-paint')
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6
      const spoke = box(.054, .37, .078, i % 2 ? coral : teal, [Math.sin(a) * .265, Math.cos(a) * .265, 0], name + '-spoke-' + i, group, .006)
      spoke.rotation.z = -a
      const band = box(.056, .052, .008, cream, [Math.sin(a) * .34, Math.cos(a) * .34, .043], name + '-spoke-band-' + i, group, .001); band.rotation.z = -a
    }
    axle(.135, .15, mustard, [0, 0, 0], name + '-hub-body', group)
    const hub = axle(.112, .092, coral, [0, 0, .085], name === 'cart-detached-wheel' ? 'cart-wheel-hub' : name + '-hub-cap', group)
    return { group, hub }
  }
  const farWheel = wheel('cart-far-wheel', cart); farWheel.group.position.set(0, .5, -.66)
  const { group: looseWheel, hub } = wheel('cart-detached-wheel', world)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    cart.position.copy(checkpoint >= 2 ? REST : HOME); cart.rotation.set(0, 0, 0)
    if (checkpoint >= 1) { cart.add(looseWheel); looseWheel.position.copy(JOIN) } else { world.add(looseWheel); looseWheel.position.copy(WHEEL_HOME) }
    looseWheel.rotation.set(0, 0, 0); matrices()
  }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  addInteractionCue(hub, { kind: 'drag', label: '装上彩绘木轮', priority: 3, enabled: enabled(0), destination: axleEnd, targetLabel: '露出的车轴' })
  addInteractionCue(grip, { kind: 'drag', label: '小车移到展垫', priority: 3, enabled: enabled(1), destination: mat, targetLabel: '小车展垫' })
  addInteractionCue(grip, { kind: 'tap', label: '轻点扶手静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? looseWheel : cart
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const acceptsDrop = (x: number, y: number) => {
    if (!insideCanvas(canvas, x, y)) return false
    const target = checkpoint === 0 ? axleEnd : mat, ignore = moving()
    if (touch.hit(x, y, target, { ignore })) return true
    if (touch.occluded(x, y, target, { ignore })) return false
    const contact = projectTouchPoint(canvas, camera, checkpoint === 0 ? hub : grip)
    return !!contact && touch.hit(contact.x, contact.y, target, { ignore })
  }
  const reset = () => { dragging = false; maxTravel = 0; dropFeedback.clear(); if (!transition) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (notifying || transition || checkpoint === 3) return false; matrices(); return touch.hit(x, y, checkpoint === 0 ? looseWheel : grip) },
    onStart(x, y) { down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; notifyHost(() => feedback.prepare()); const object = moving(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), object.position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(object.position).sub(point) },
    onMove(x, y) {
      if (notifying) return
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset); matrices(); dropFeedback.setReady(dragging && maxTravel >= 8 && acceptsDrop(x, y)) },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && maxTravel >= 8 && acceptsDrop(x, y) : maxTravel < 12 && touch.hit(x, y, grip)
      dragging = false; dropFeedback.clear(); if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '装上彩绘木轮' : checkpoint === 1 ? '小车移到展垫' : '轻点扶手静看', safe)
    setSafeText(ui.hintEl, transition ? COPY.moving : checkpoint === 0 ? COPY.assemble : checkpoint === 1 ? COPY.display : checkpoint === 2 ? COPY.rest : COPY.done, safe)
  }
  function settle() {
    if (!active() || !transition) return
    checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync()
    notifyHost(() => ctx.onProgress?.(checkpoint)); if (disposed || !active()) return
    notifyHost(() => feedback.impact({ freqs: [392, 523.25], duration: .17, gain: .013 }))
  }
  function advance() {
    if (notifying || !active() || pointer.isBusy() || transition || checkpoint === 3) return
    if (checkpoint === 2) {
      checkpoint = 3; restore(); sync(); notifyHost(() => ctx.onProgress?.(3))
      if (!active()) return
      notifyHost(() => feedback.impact({ freqs: [392, 587.33], duration: .22, gain: .013 }))
      if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })); return
    }
    transition = { step: checkpoint, time: 0, from: moving().position.clone() }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (notifying || !active() || pointer.isBusy() || transition || checkpoint === 3) return; notifyHost(() => feedback.prepare()); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), distance = Math.max(1, 1 / aspect)
    // Preserve the whole loose wheel and completed draw shafts inside narrow host canvases.
    camera.position.set(0, 1.18 + 2.12 * distance, 7.5 * distance); camera.lookAt(0, 1.18, 0); matrices()
  }
  restore(); sync()
  return {
    start() { if (started || disposed) return; started = true; const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint; restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() }); ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync() },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; transition.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        const dest = transition.step === 0 ? cart.localToWorld(JOIN.clone()) : REST
        moving().position.lerpVectors(transition.from, dest, t)
        if (!ctx.isReducedMotion?.()) moving().position.y += Math.sin(t * Math.PI) * .12
        if (transition.time === 1) settle()
      }
      if (active()) style.render()
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); dropFeedback.dispose(); stopResize(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
