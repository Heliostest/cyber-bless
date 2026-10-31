import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '草穗悬园', assemble: '把桌前的小菱形接到中央连接珠，接好草编花园的下部。',
  suspend: '轻托顶部木珠，把草编花园移到右侧工坊木架的挂点。',
  rest: '轻点木珠，静赏这种寄托家庭和睦祝愿的草编悬饰。',
  returning: '轻点木珠，再看木架上草编花园的透光结构与家庭祝愿。',
  assembling: '小菱形缓缓接向中央，棉线连起草秆…', suspending: '草编花园缓缓移向木架，挂线轻轻落稳…', done: '草编花园已在工坊木架上挂稳，静赏草秆与棉线的结构。',
} as const
const HOME = new THREE.Vector3(-.66, 1.88, 0), REST = new THREE.Vector3(.72, 2.12, 0)
const PENDANT_HOME = new THREE.Vector3(-1.05, 1.02, .60), JOIN = new THREE.Vector3(0, -.84, 0)
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original straw lattice; a contemporary craft pause, not a household rite. */
export function createLithuanianStrawGarden(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let dragging = false, maxTravel = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '接好小菱形' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'lithuanian-straw-garden', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xffefd8, ground: 0xb3b7a2, key: 0xffe7c0, rim: 0xd8e7d8, keyPosition: [-3, 5, 3], keyIntensity: 1.2, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 4, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .022
  const world = new THREE.Group(); world.name = 'straw-garden-workbench'; scene.add(world)
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .85 })
  const straw = material(0xdabb78), pale = material(0xefdfac), oak = material(0xb9976a), walnut = material(0x8d7356), thread = material(0xf2e6c8), sage = material(0x829b84)
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(.035, h / 3, d / 3)), mat, xyz, name, parent)
  const bead = (r: number, xyz: [number, number, number], name: string, parent: THREE.Object3D, mat = walnut) => add(new THREE.SphereGeometry(r, 20, 14), mat, xyz, name, parent)
  const stem = (a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material, parent: THREE.Object3D, name = '') => {
    const mesh = add(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8, 1, true), mat, [0, 0, 0], name, parent)
    mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return mesh
  }
  addCraftTable(world, { name: 'straw-table', topName: 'straw-table', width: 3.3, depth: 1.75, surfaceY: .72, thickness: .12, center: [0,0], support: 'joined', finish: 'birch' })
  const shadow = add(new THREE.PlaneGeometry(3.8, 2.5), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  // A low temporary jig supports the unfinished garden, and a taller stand receives it.
  box(.55, .07, .50, walnut, [-1.36, .755, -.32])
  box(.075, 1.80, .075, walnut, [-1.43, 1.62, -.10])
  box(.81, .075, .075, walnut, [-1.06, 2.51, -.10])
  stem(new THREE.Vector3(-.66, 2.51, -.1), new THREE.Vector3(-.66, 2.51, .12), .012, thread, world)
  box(.62, .08, .60, walnut, [1.22, .76, -.3])
  box(.095, 2.15, .095, oak, [1.42, 1.835, -.14])
  box(.87, .095, .095, oak, [1.04, 2.90, -.14])
  stem(new THREE.Vector3(.72, 2.89, -.14), new THREE.Vector3(.72, 2.89, .12), .04, walnut, world)
  const peg = bead(.085, [.72, 2.89, .12], 'straw-display-peg', world, sage)
  const mobile = new THREE.Group(); mobile.name = 'straw-mobile'; world.add(mobile)
  const diamond = (parent: THREE.Object3D, radius: number, height: number, xyz: [number, number, number], name: string) => {
    const group = new THREE.Group(); group.name = name; group.position.set(...xyz); parent.add(group)
    const ring = [new THREE.Vector3(radius, 0, 0), new THREE.Vector3(0, 0, radius), new THREE.Vector3(-radius, 0, 0), new THREE.Vector3(0, 0, -radius)]
    for (let i = 0; i < 4; i++) {
      for (const y of [-height, height]) stem(new THREE.Vector3(0, y, 0), ring[i], .021, i % 2 ? straw : pale, group, `${name}-stalk`)
      stem(ring[i], ring[(i + 1) % 4], .018, straw, group, `${name}-rim`)
      bead(.03, [ring[i].x, 0, ring[i].z], '', group, pale)
    }
    return group
  }
  diamond(mobile, .48, .56, [0, 0, 0], 'straw-central-diamond')
  for (const x of [-.48, .48]) {
    stem(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, -.11, 0), .008, thread, mobile)
    diamond(mobile, .15, .20, [x, -.31, 0], 'straw-side-diamond')
  }
  // The cream suspension loop and its wooden clasp remain actual visible geometry.
  stem(new THREE.Vector3(0, .56, 0), new THREE.Vector3(0, .77, .12), .009, thread, mobile)
  const lift = bead(.105, [0, .67, .12], 'straw-lift-bead', mobile, walnut)
  const join = bead(.085, [0, -.56, .055], 'straw-join-bead', mobile, sage)
  const pendant = diamond(world, .20, .28, [0, 0, 0], 'straw-pendant')
  const grip = bead(.085, [0, 0, .20], 'straw-pendant-grip', pendant, sage)
  const link = stem(new THREE.Vector3(0, -.56, 0), new THREE.Vector3(0, -.56, .055), .009, thread, mobile)
  const cloth = box(.70, .012, .58, sage, [-1.05, .733, .55])
  for (let i = 0; i < 5; i++) stem(new THREE.Vector3(.20 + i * .055, .74, .45), new THREE.Vector3(.45 + i * .055, .74, .63), .014, straw, world)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    mobile.position.copy(checkpoint >= 2 ? REST : HOME); mobile.rotation.set(0, 0, 0)
    if (checkpoint >= 1) { mobile.add(pendant); pendant.position.copy(JOIN) } else { world.add(pendant); pendant.position.copy(PENDANT_HOME) }
    link.visible = checkpoint >= 1; cloth.visible = true; matrices()
  }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  addInteractionCue(grip, { kind: 'drag', label: '接好小菱形', priority: 3, enabled: enabled(0), destination: join, targetLabel: '中央连接珠' })
  addInteractionCue(lift, { kind: 'drag', label: '挂上工坊木架', priority: 3, enabled: enabled(1), destination: peg, targetLabel: '工坊木架挂点' })
  addInteractionCue(lift, { kind: 'tap', label: '轻点木珠细看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? pendant : mobile
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const acceptsDrop = (x: number, y: number) => {
    if (!insideCanvas(canvas, x, y)) return false
    const target = checkpoint === 0 ? join : peg, ignore = moving()
    if (touch.hit(x, y, target, { ignore })) return true
    if (touch.occluded(x, y, target, { ignore })) return false
    const contact = projectTouchPoint(canvas, camera, checkpoint === 0 ? grip : lift)
    return !!contact && touch.hit(contact.x, contact.y, target, { ignore })
  }
  const automaticReady = (x: number, y: number) => {
    if (checkpoint >= 2 || !insideCanvas(canvas, x, y)) return false
    const contact = projectTouchPoint(canvas, camera, checkpoint === 0 ? grip : lift, [0,0,0])
    return !!contact && !touch.occluded(x,y,checkpoint === 0 ? join : peg,{ignore:moving()}) && touch.hit(contact.x, contact.y, checkpoint === 0 ? join : peg, { ignore: moving() })
  }
  const reset = () => { dragging = false; maxTravel = 0; dropFeedback.clear(); if (!transition) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); return touch.hit(x, y, checkpoint === 0 ? pendant : lift) },
    onStart(x, y) { down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare(); const object = moving(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), object.position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(object.position).sub(point) },
    onMove(x, y) { maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset); matrices(); dropFeedback.setReady(dragging && automaticReady(x, y)); if (dragging && automaticReady(x, y) && pointer.finish()) { dragging = false; dropFeedback.clear(); advance(true) }
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && automaticReady(x, y) : maxTravel < 12 && touch.hit(x, y, lift)
      dragging = false; dropFeedback.clear(); if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: () => active(), duration: 3, motion: 'sway',
    targets: () => [mobile], cancelInput: () => pointer.cancel(), complete: () => advance(),
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '接好小菱形' : checkpoint === 1 ? '挂上工坊木架' : '轻点木珠细看', safe)
    setSafeText(ui.hintEl, transition ? transition.step === 0 ? COPY.assembling : COPY.suspending : checkpoint === 0 ? COPY.assemble : checkpoint === 1 ? COPY.suspend : checkpoint === 2 ? ctx.returning ? COPY.returning : COPY.rest : COPY.done, safe)
    ending.sync(checkpoint === 2 && !transition)
  }
  function settle() { if (!active() || !transition) return; checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync(); ctx.onProgress?.(checkpoint); feedback.impact({ freqs: [392, 523.25], duration: .17, gain: .013 }) }
  function advance(placed = false) {
    if (checkpoint === 2 && !ending.completing) return
    if (!active() || (pointer.isBusy() && !placed) || transition || checkpoint === 3) return
    if (checkpoint === 2) { checkpoint = 3; restore(); sync(); ctx.onProgress?.(3); if (!active()) return; feedback.impact({ freqs: [392, 587.33], duration: .22, gain: .013 }); if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })); return }
    transition = { step: checkpoint, time: 0, from: moving().position.clone() }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!active() || pointer.isBusy() || transition || checkpoint === 3) return; feedback.prepare(); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 8); camera.position.set(0, 3.4 + boost * .4, 5.6 + boost); camera.lookAt(0, 1.5, 0); matrices() }
  restore(); sync()
  return {
    start() { if (started || disposed) return; started = true; const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint; restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() }); ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync() },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; transition.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        const dest = transition.step === 0 ? mobile.localToWorld(JOIN.clone()) : REST
        moving().position.lerpVectors(transition.from, dest, t)
        if (!ctx.isReducedMotion?.()) moving().position.y += Math.sin(t * Math.PI) * .15
        if (transition.time === 1) settle()
      }
      if (!active()) return
      ending.update(dt)
      if (!active()) return
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); style.render()
    },
    dispose() { if (disposed) return; ending.dispose(); disposed = true; pointer.dispose(); dropFeedback.dispose(); stopResize(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
