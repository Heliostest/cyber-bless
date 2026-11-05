import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createPosePlacement } from '../pose-placement'
import { createTouchTarget, insideCanvas } from '../touch-target'
import { addStageLights, CEL_STYLE, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createPinwheelModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['托起风车', '转动纸翼', '放回风车']
const HINTS = ['握住木柄，把风车托到上方的提示位置。', '拨动纸翼，快慢随手；也可以握住木柄放回原处。', '纸翼可以反复拨动；想结束时，把木柄放回原处。', '风车已放回原处，纸翼慢慢停住。']
const MOVING = ['风车缓缓提起……', '风车轻轻放回原处……']
const REPEAT = '再转一会儿'
const ease = (t: number) => t * t * (3 - 2 * t)

export function createPaperPinwheel(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING, REPEAT].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}, elapsed = 0
  let motion: { step: 0 | 2; time: number; placed: boolean; angle: number } | null = null
  let mode: 'pickup' | 'play' | 'return' | 'undecided' = 'undecided', invalid = false, travel = 0, lastSample = 0
  let angle = 0, velocity = 0, heldAngle = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '纸翼转风', stepsAria: '纸风车步骤', action: ACTIONS[0]! }, safe)
  const repeat = document.createElement('button'); repeat.type = 'button'; repeat.className = 'scene-bow-tap scene-toy-repeat'
  ui.actionBtn.after(repeat)
  for (const button of [ui.actionBtn, repeat]) { button.style.minWidth = '44px'; button.style.minHeight = '44px' }
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'paper-pinwheel', label: '纸翼转风' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createPinwheelModel(); scene.add(model.root)
  const placement = createPosePlacement(canvas, camera, model, scene)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const applyPlay = () => { model.rotor.rotation.z = angle; matrices() }
  const restore = () => { model.pose(at, 0); angle = velocity = 0; matrices() }
  const touch = createTouchTarget(canvas, camera, scene), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const removeCues = [
    addInteractionCue(model.targets[0]!, { kind: 'drag', destination: () => placement.destination(0), targetLabel: '风车托起位置', label: ACTIONS[0]!, anchor: model.anchors[0], priority: 3, enabled: () => inputActive() && !motion && at === 0 }),
    addInteractionCue(model.targets[1]!, { kind: 'drag', direction: [1,0], label: ACTIONS[1]!, anchor: model.anchors[1], priority: 3, enabled: () => inputActive() && !motion && (at === 1 || at === 2) }),
    addInteractionCue(model.targets[2]!, { kind: 'drag', destination: () => placement.destination(2), targetLabel: '风车放回位置', label: ACTIONS[2]!, anchor: model.anchors[2], priority: 2, enabled: () => inputActive() && !motion && (at === 1 || at === 2) }),
  ]
  const reset = () => {
    placement.cancel(); invalid = false; travel = 0
    if (!motion && !disposed) { angle = heldAngle; velocity = 0; if (at === 0 || at === 3) restore(); else { model.pose(at, 0); applyPlay() } }
    mode = 'undecided'
  }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) {
      if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false
      matrices(); return touch.hit(x, y, model.handle) || (at > 0 && touch.hit(x, y, model.rotor))
    },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); previous.copy(down); lastSample = elapsed; invalid = false; travel = 0
      heldAngle = angle; velocity = 0
      mode = at === 0 ? 'pickup' : touch.hit(x, y, model.handle) ? 'return' : 'play'
      if (mode !== 'play' && !placement.begin(at === 0 ? 0 : 2, x, y)) pointer.cancel()
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !insideCanvas(canvas, x, y)) { invalid = true; return }
      if (invalid) return

      if (mode === 'pickup' || mode === 'return') {
        if (placement.move(x, y) && pointer.finish()) { placement.capture(); beginPlacement(mode === 'pickup' ? 0 : 2, true) }
        return
      }
      const dx = x - previous.x
      travel += Math.abs(dx)
      angle += dx * .025
      velocity = THREE.MathUtils.clamp(dx * .025 / Math.max(1 / 240, elapsed - lastSample), -18, 18)
      previous.set(x, y); lastSample = elapsed; applyPlay()
    },
    onRelease() {
      if (invalid || mode !== 'play' || travel < 8) { reset(); return }
      placement.release(); mode = 'undecided'
      // A finger held still before release has no fresh flick momentum.
      velocity *= ctx.isReducedMotion?.() ? 0 : Math.max(0, 1 - (elapsed - lastSample) / .15)
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
    velocity = 0; motion = { step, time: 0, placed, angle: THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI }; sync()
    if (ctx.isReducedMotion?.()) settle()
  }
  function playButton(event: MouseEvent) {
    if (event.detail > 1 || !inputActive() || pointer.isBusy() || motion || (at !== 1 && at !== 2) || !prepareInput()) return
    angle += .45; velocity = ctx.isReducedMotion?.() ? 0 : 8; applyPlay()
    recordPlayed()
  }
  const action = (event: MouseEvent) => {
    if (event.detail > 1 || !inputActive() || pointer.isBusy() || motion || at === 3) return
    if (at === 1) { playButton(event); return }
    if (!prepareInput()) return
    beginPlacement(at === 0 ? 0 : 2)
  }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); velocity = 0; sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, 1.55, .1), direction = new THREE.Vector3(2.3, 2.9, 7.5).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const savedY = model.root.position.y, savedAngle = model.rotor.rotation.z
    // Frame the entire rotating silhouette at both ends of the pickup path.
    for (const lift of [0,.18]) for (let i = 0; i < 32; i++) {
      model.root.position.y = lift; model.rotor.rotation.z = i * Math.PI / 16; matrices()
      model.root.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let j = 0; j < vertices.count; j++) { p.fromBufferAttribute(vertices, j).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      })
    }
    model.root.position.y = savedY; model.rotor.rotation.z = savedAngle
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
      if (!active()) { lifecycleVersion++; pointer.cancel(); velocity = 0; if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      elapsed += delta
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.placed ? .28 : .55))
        const n = ease(motion.time)
        model.pose(motion.step, n); model.rotor.rotation.z = motion.angle * (1 - n)
        placement.settle(n); matrices(); if (motion.time === 1) settle()
      } else if (at === 1 || at === 2) {
        if (!pointer.isBusy()) {
          if (ctx.isReducedMotion?.()) velocity = 0
          angle += velocity * delta; velocity *= Math.exp(-2.4 * delta); applyPlay()
        }
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action); repeat.removeEventListener('click', playButton)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose();  disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
