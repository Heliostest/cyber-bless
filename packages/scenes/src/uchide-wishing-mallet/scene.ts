import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createPosePlacement } from '../pose-placement'
import { createTouchTarget, insideCanvas } from '../touch-target'
import { addStageLights, CEL_STYLE, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createWishingMalletModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['托起小槌', '轻摇寄愿', '放回小槌']
const HINTS = ['握住槌柄，把小槌托到上方的提示位置。', '握住槌柄来回轻摇；想结束时，向下挪回木托。', '小槌可以反复轻摇；想结束时，向下挪回木托。', '小槌已放稳，愿心中所盼有新的进展。']
const MOVING = ['小槌缓缓离开木托……', '槌头与柄端轻轻落回木托……']
const REPEAT = '再摇一会儿'
const ease = (t: number) => t * t * (3 - 2 * t)

export function createWishingMallet(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING, REPEAT].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 2; time: number; placed: boolean } | null = null
  let mode: 'pickup' | 'play' | 'return' | 'undecided' = 'undecided', invalid = false, travel = 0
  let angle = 0, heldAngle = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '振槌寄愿', stepsAria: '振槌寄愿步骤', action: ACTIONS[0]! }, safe)
  const repeat = document.createElement('button'); repeat.type = 'button'; repeat.className = 'scene-bow-tap scene-toy-repeat'
  ui.actionBtn.after(repeat)
  for (const button of [ui.actionBtn, repeat]) { button.style.minWidth = '44px'; button.style.minHeight = '44px' }
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'uchide-wishing-mallet', label: '振槌寄愿' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf2ead5, ground: 0x837457, key: 0xffdfb9, rim: 0xaac8f3, keyPosition: [-3, 5, 4], keyIntensity: 2.4, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .03
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createWishingMalletModel(); scene.add(model.root)
  const placement = createPosePlacement(canvas, camera, model, scene)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const grip = new THREE.Vector3(0,.36,-.2), rotatedGrip = new THREE.Vector3()
  const applyPlay = () => { // Keep the grasped shaft point fixed while the head follows either direction.
    model.actor.rotation.set(0, angle, 0)
    model.actor.position.set(-.55,.85,.70).add(grip).sub(rotatedGrip.copy(grip).applyEuler(model.actor.rotation)); matrices() }
  const restore = () => { model.pose(at, 0); angle = 0; matrices() }
  const touch = createTouchTarget(canvas, camera, scene), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const removeCues = [
    addInteractionCue(model.targets[0]!, { kind: 'drag', destination: () => placement.destination(0), targetLabel: '挪到这里', label: ACTIONS[0]!, anchor: model.anchors[0], priority: 3, enabled: () => inputActive() && !motion && at === 0 }),
    addInteractionCue(model.targets[1]!, { kind: 'drag', direction: [1,0], label: ACTIONS[1]!, anchor: model.anchors[1], priority: 3, enabled: () => inputActive() && !motion && (at === 1 || at === 2) }),
    addInteractionCue(model.targets[2]!, { kind: 'drag', destination: () => placement.destination(2), targetLabel: '挪到这里', label: ACTIONS[2]!, anchor: model.anchors[2], priority: 2, enabled: () => inputActive() && !motion && (at === 1 || at === 2) }),
  ]
  const reset = () => {
    placement.cancel(); invalid = false; travel = 0
    if (!motion && !disposed) { angle = heldAngle; if (at === 0 || at === 3) restore(); else { model.pose(at, 0); applyPlay() } }
    mode = 'undecided'
  }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) {
      if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false
      matrices(); return touch.hit(x, y, model.actor)
    },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); previous.copy(down); invalid = false; travel = 0
      heldAngle = angle
      mode = at === 0 ? 'pickup' : 'undecided'
      if (!placement.begin(at === 0 ? 0 : 2, x, y)) pointer.cancel()
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !insideCanvas(canvas, x, y)) { invalid = true; return }
      if (invalid) return
      if (mode === 'undecided') {
        const dx = x - down.x, dy = y - down.y
        if (Math.hypot(dx, dy) < 6) return
        if (dy > Math.abs(dx) * 1.2) {
          // Fine downward samples must stay undecided until the return
          // threshold, rather than being permanently classified as shaking.
          if (dy <= 8) return
          mode = 'return'
        } else mode = 'play'
      }
      if (mode === 'pickup' || mode === 'return') {
        if (placement.move(x, y) && pointer.finish()) { placement.capture(); beginPlacement(mode === 'pickup' ? 0 : 2, true) }
        return
      }
      const dx = x - previous.x
      travel += Math.abs(dx)
      angle = THREE.MathUtils.clamp(heldAngle - (x - down.x) * .009, -.45, .45)
      previous.set(x, y); applyPlay()
    },
    onRelease() {
      if (invalid || mode !== 'play' || travel < 8) { reset(); return }
      placement.release(); mode = 'undecided'
      recordPlayed()
    }, onCancel: reset,
  })
  const sync = () => {
    if (disposed) return
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3)
    // Callback reentry is guarded by inputActive; leave keyboard focus intact.
    ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.classList.toggle('scene-continuous-finish', at === 2)
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    repeat.hidden = at !== 2; repeat.disabled = !active() || !!motion || at !== 2
    repeat.setAttribute('aria-disabled', String(repeat.disabled))
    ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[Math.min(at, 2)]!, safe); setSafeText(repeat, REPEAT, safe)
    setSafeText(ui.hintEl, motion ? MOVING[motion.step === 0 ? 0 : 1]! : HINTS[at]!, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function notifyProgress() {
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function recordPlayed() {
    if (!inputActive()) return
    if (at === 1) { at = 2; notifyProgress() }
    else withHostCallbacks(() => feedback.impact({ freqs: [392], duration: .06, gain: .002, type: 'sine' }))
  }
  function settle() {
    if (!inputActive() || !motion) return
    placement.settle(1); placement.cancel(); at = motion.step === 0 ? 1 : 3; motion = null; restore(); notifyProgress()
  }
  function beginPlacement(step: 0 | 2, placed = false) {
    if (!inputActive() || motion || at === 3 || (pointer.isBusy() && !placed)) return
    if (!placed) placement.capture(step)
    motion = { step, time: 0, placed }; sync()
    if (ctx.isReducedMotion?.()) settle()
  }
  function playButton(event: MouseEvent) {
    if (event.detail > 1 || !inputActive() || pointer.isBusy() || motion || (at !== 1 && at !== 2) || !prepareInput()) return
    angle = ctx.isReducedMotion?.() ? 0 : (angle > 0 ? -.24 : .24); applyPlay()
    recordPlayed()
  }
  const action = (event: MouseEvent) => {
    if (event.detail > 1 || !inputActive() || pointer.isBusy() || motion || at === 3) return
    if (at === 1) { playButton(event); return }
    if (!prepareInput()) return
    beginPlacement(at === 0 ? 0 : 2)
  }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), direction = new THREE.Vector3(2.4,3.8,7).normalize()
    const savedPosition = model.actor.position.clone(), savedRotation = model.actor.quaternion.clone(), savedAngle = angle
    const points: THREE.Vector3[] = []
    const sample = () => {
      matrices()
      model.root.traverse(object => {
        const mesh = object as THREE.Mesh; if (!mesh.geometry) return
        const vertices = mesh.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld))
      })
    }
    // Fit the actual support, tassel and complete carry/shake envelope rather
    // than the old loose box centered beside the toy.
    for (const n of [0,.5,1]) { model.pose(0,n); sample() }
    for (const sway of [-.45,-.225,0,.225,.45]) { angle = sway; applyPlay(); sample() }
    angle = savedAngle; model.actor.position.copy(savedPosition); model.actor.quaternion.copy(savedRotation)
    const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3())
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); let distance = 1.5
    for (const point of points) {
      const p = point.sub(target).applyQuaternion(inverse)
      distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86))
    }
    camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target)
    matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); repeat.addEventListener('click', playButton); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.placed ? .28 : .55))
        const n = ease(motion.time)
        model.pose(motion.step, n);
        placement.settle(n); matrices(); if (motion.time === 1) settle()
      } else if (at === 1 || at === 2) {
        if (!pointer.isBusy()) { angle *= ctx.isReducedMotion?.() ? 0 : Math.exp(-10 * delta); applyPlay() }
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action); repeat.removeEventListener('click', playButton)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); model.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
