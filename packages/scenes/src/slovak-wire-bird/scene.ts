import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '铁线栖鸟', assemble: '捏住桌前小翅膀的绕线结，把它拖到鸟身肩部。',
  display: '握住鸟腹的绕线结，把整只小鸟移到右侧木栖座，让双足落稳。',
  rest: '轻点小鸟，静看铁线之间的留白。',
  moving: '铁线轻轻相接，小鸟缓缓落稳…', done: '愿日常也有一处安心停歇。',
} as const
const HOME = new THREE.Vector3(-.55, .80, 0), REST = new THREE.Vector3(.55, .96, 0)
const WING_HOME = new THREE.Vector3(-.60, .914, .72), JOIN = new THREE.Vector3(.05, 1.13, .26)
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original contemporary wire sculpture, appreciating public Drotárstvo craft. */
export function createSlovakWireBird(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let dragging = false, maxTravel = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  // Host callbacks may synchronously dispatch input or call update again.
  let notifying = false
  function notifyHost(callback: () => void) {
    const previous = notifying; notifying = true
    try { callback() } finally { notifying = previous }
  }
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '接好小翅膀' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)

  const projectedGuide = (goal: THREE.Vector3, grip: THREE.Vector3, contact: THREE.Vector3) => {
    camera.updateMatrixWorld(true)
    const g=goal.project(camera),a=grip.project(camera),b=contact.project(camera)
    g.x+=a.x-b.x;g.y+=a.y-b.y
    return g.unproject(camera)
  }
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'slovak-wire-bird', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf4eee0, ground: 0xb1b4a3, key: 0xffedcf, rim: 0xd9e8e9,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .48 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .018
  const world = new THREE.Group(); world.name = 'wire-workbench'; scene.add(world)
  const material = (color: number, roughness = .82, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const steel = material(0x536363, .47, .3), binding = material(0xab8857, .53, .35), oak = material(0xc5ad86), walnut = material(0x856f56), linen = material(0xa6bbb3)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, mat: THREE.Material = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.022, ...size.map(v => v / 3))), mat, p, parent)
  const tube = (name: string, points: XYZ[], radius: number, parent: THREE.Object3D, closed = false, mat = steel) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal')
    const mesh = add(name, new THREE.TubeGeometry(curve, 72, radius, 8, closed), mat, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  const wrap = (name: string, p: XYZ, parent: THREE.Object3D, radius = .105) => {
    // This small solid core represents closely bound wire, and is itself grasped.
    const core = add(name, new THREE.CylinderGeometry(radius, radius, .10, 32), binding, p, parent); core.rotation.x = Math.PI / 2
    core.userData.toonSurface = { outline: false }
    for (const z of [-.037, -.012, .013, .038]) {
      const ring = add(name + '-coil', new THREE.TorusGeometry(radius, .009, 8, 32), binding, [p[0], p[1], p[2] + z], parent)
      ring.userData.toonSurface = { outline: false }
    }
    return core
  }
  addCraftTable(world, { name: 'wire-table', topName: 'wire-table', width: 3.75, depth: 1.76, surfaceY: .76, thickness: .12, center: [0,.03], support: 'trestle', finish: 'chestnut' })
  const shadow = add('wire-contact-shadow', new THREE.PlaneGeometry(4.4, 2.5), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, .1]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box('wire-home-pad', [.95, .04, .55], [-.55, .78, .02], linen)
  box('wire-wing-pad', [.34, .04, .26], [-.60, .78, .72], linen)
  box('wire-perch-base', [1.04, .06, .64], [.55, .79, .02], walnut)
  for (const x of [.23, .87]) box('wire-perch-post', [.12, .09, .28], [x, .865, .02], walnut)
  const seat = box('wire-perch-seat', [.96, .05, .56], [.55, .935, .02], oak)
  const bird = new THREE.Group(); bird.name = 'wire-bird'; world.add(bird)
  // Parallel closed silhouettes and transverse ribs give a genuinely open volume.
  const profile: [number, number][] = [[-.45, .84], [-.53, 1.00], [-.30, 1.12], [-.15, 1.23], [.19, 1.25], [.32, 1.42], [.49, 1.48], [.64, 1.38], [.65, 1.23], [.51, .91], [.20, .72], [-.10, .71]]
  for (const z of [-.12, .12]) tube(z > 0 ? 'wire-body-front' : 'wire-body-back', profile.map(([x, y]) => [x, y, z]), .026, bird, true)
  for (const [x, y] of [[-.45, .84], [-.15, 1.23], [.49, 1.48], [.20, .72], [-.10, .71]]) tube('wire-body-rib', [[x, y, -.12], [x, y + .018, 0], [x, y, .12]], .019, bird)
  tube('wire-tail', [[-.45, .84, .12], [-.95, 1.09, .03], [-.82, .73, .03], [-.45, .84, -.12]], .025, bird)
  tube('wire-tail-feather', [[-.45, .84, .12], [-.88, .93, .035], [-.82, .73, .03]], .017, bird)
  tube('wire-beak', [[.64, 1.38, .12], [.89, 1.27, 0], [.65, 1.23, .12]], .024, bird)
  tube('wire-eye-bridge', [[.49, 1.48, .12], [.49, 1.34, .14], [.65, 1.23, .12]], .017, bird)
  add('wire-eye', new THREE.SphereGeometry(.040, 16, 12), steel, [.49, 1.34, .14], bird)
  const joint = wrap('wire-shoulder-joint', [.05, 1.13, .18], bird)
  tube('wire-shoulder-brace', [[-.15, 1.23, .12], [.05, 1.13, .18], [.51, .91, .12]], .024, bird)
  const grip = wrap('wire-bird-grip', [.05, .87, .25], bird, .115)
  tube('wire-belly-brace', [[-.10, .71, .12], [.05, .87, .25], [.20, .72, .12]], .026, bird)
  // Two closed feet rest on the pads. Each leg ends on its own foot loop.
  for (const [x, top, name] of [[-.10, .71, 'back'], [.20, .72, 'front']] as const) {
    tube('wire-leg-' + name, [[x, top, .12], [x - .04, .36, .12], [x, .025, .16]], .026, bird)
    tube('wire-foot-' + name, [[x, .025, .16], [x + .10, .025, .23], [x - .10, .025, .23], [x - .11, .025, -.09], [x + .06, .025, -.09]], .025, bird, true)
  }
  const wingPoints: XYZ[] = [[0, 0, 0], [-.26, .12, 0], [-.56, .30, 0], [-.64, .54, 0], [-.30, .47, 0], [-.08, .22, 0]]
  const farWing = new THREE.Group(); farWing.name = 'wire-far-wing'; bird.add(farWing); farWing.position.set(.02, 1.10, -.12); farWing.rotation.z = -.13
  tube('wire-far-wing-loop', wingPoints, .022, farWing, true)
  tube('wire-far-wing-rib', [[0, 0, 0], [-.30, .29, 0], [-.64, .54, 0]], .016, farWing)
  // Far wing is tied to the rear shoulder, rather than hovering behind the bird.
  tube('wire-far-wing-tie', [[-.15, 1.23, -.12], [.02, 1.10, -.12], [.20, .72, -.12]], .018, bird)
  const wing = new THREE.Group(); wing.name = 'wire-loose-wing'; world.add(wing)
  const wingGrip = wrap('wire-wing-grip', [0, 0, .02], wing)
  tube('wire-wing-loop', wingPoints, .024, wing, true)
  for (const p of [[-.56, .30, 0], [-.64, .54, 0], [-.30, .47, 0]] as XYZ[]) tube('wire-wing-rib', [[0, 0, 0], [p[0] * .48, p[1] * .55, 0], p], .016, wing)

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    bird.position.copy(checkpoint >= 2 ? REST : HOME); bird.rotation.set(0, 0, 0)
    if (checkpoint >= 1) { bird.add(wing); wing.position.copy(JOIN) } else { world.add(wing); wing.position.copy(WING_HOME) }
    wing.rotation.set(0, 0, 0); matrices()
  }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  addInteractionCue(wingGrip, { kind: 'drag', label: '接好小翅膀', priority: 3, enabled: enabled(0), destination: joint, targetLabel: '鸟身肩部' })
  addInteractionCue(grip, { kind: 'drag', label: '把小鸟放上栖座', priority: 3, enabled: enabled(1), destination: () => projectedGuide(seat.getWorldPosition(new THREE.Vector3()),grip.getWorldPosition(new THREE.Vector3()),bird.getWorldPosition(new THREE.Vector3())), targetLabel: '木栖座' })
  addInteractionCue(grip, { kind: 'tap', label: '轻点小鸟静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? wing : bird
  const belongsTo = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const touchTarget = createTouchTarget(canvas, camera, scene)
  const visibleHit = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => touchTarget.hit(x, y, target, { ignore: held })
  const automaticReady = (x: number, y: number) => {
    if (checkpoint >= 2 || !insideCanvas(canvas, x, y)) return false
    const contact = projectTouchPoint(canvas, camera, checkpoint === 0 ? wingGrip : bird, [0,0,0])
    return !!contact && !touchTarget.occluded(x,y,checkpoint === 0 ? joint : seat,{ignore:moving()}) && touchTarget.hit(contact.x, contact.y, checkpoint === 0 ? joint : seat, { ignore: moving() })
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (notifying || transition || checkpoint === 3) return false; matrices(); return visibleHit(x, y, checkpoint === 0 ? wing : bird) },
    onStart(x, y) {
      down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; notifyHost(() => feedback.prepare())
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position)
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point)
    },
    onMove(x, y) {
      if (notifying) return
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset)
      matrices()
    if (dragging && automaticReady(x, y) && pointer.finish()) { dragging = false; advance(true) }
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && automaticReady(x, y)
        : maxTravel < 12 && visibleHit(x, y, bird)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: () => active() && !notifying, duration: 3, motion: 'glow',
    targets: () => [bird], cancelInput: () => pointer.cancel(), complete: () => advance(),
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '接好小翅膀' : checkpoint === 1 ? '把小鸟放上栖座' : '轻点小鸟静看', safe)
    setSafeText(ui.hintEl, transition ? COPY.moving : checkpoint === 0 ? COPY.assemble : checkpoint === 1 ? COPY.display : checkpoint === 2 ? COPY.rest : COPY.done, safe)
    ending.sync(checkpoint === 2 && !transition)
  }
  function settle() {
    if (!active() || !transition) return
    checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync()
    notifyHost(() => ctx.onProgress?.(checkpoint))
    if (!active()) return
    notifyHost(() => feedback.impact({ freqs: [392, 523.25], duration: .17, gain: .012, type: 'triangle' }))
  }
  function advance(placed = false) {
    if (checkpoint === 2 && !ending.completing) return
    if (notifying || !active() || (pointer.isBusy() && !placed) || transition || checkpoint === 3) return
    if (checkpoint === 2) {
      checkpoint = 3; restore(); sync(); notifyHost(() => ctx.onProgress?.(3))
      if (!active()) return
      notifyHost(() => feedback.impact({ freqs: [392, 587.33], duration: .22, gain: .012 }))
      if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
      return
    }
    transition = { step: checkpoint, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle()
  }
  const action = () => { if (notifying || !active() || pointer.isBusy() || transition || checkpoint === 3) return; notifyHost(() => feedback.prepare()); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 8); camera.position.set(0, 3.10 + boost * .35, 6.15 + boost); camera.lookAt(0, 1.36, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
        transition.time = reduced() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        const dest = transition.step === 0 ? bird.localToWorld(JOIN.clone()) : REST
        moving().position.lerpVectors(transition.from, dest, t)
        if (!reduced()) moving().position.y += Math.sin(t * Math.PI) * .12
        if (transition.time === 1) settle()
      }
      if (!active()) return
      if (!active()) return
      ending.update(dt)
      if (!active()) return
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); style.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose(); disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world)
      Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
