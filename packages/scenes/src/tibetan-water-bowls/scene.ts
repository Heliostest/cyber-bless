import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createPosePlacement } from '../pose-placement'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createWaterBowlsModel } from './model'

const TOTAL_STEPS = 9
const ACTIONS = ['提起水壶', ...Array.from({ length: 7 }, (_, i) => `为第${i + 1}碗添水`), '收回水壶']
const HINTS = ['拿住水壶，提到左边第一只供碗上方的标记处。',
  ...Array.from({ length: 7 }, (_, i) => `拿住水壶，移到左起第${i + 1}只供碗上方的标记处，到位后会为这一碗添水，留出碗沿。${i < 6 ? '这一碗添好后，再继续下一碗。' : '七碗添好后，再收回水壶。'}`),
  '拿住水壶，放回供台一侧的标记处。','七碗清水齐整安放，愿这份供养承载利益众生的心意。']
const MOVING = ['提起盛着清水的水壶……', ...Array.from({ length: 7 }, (_, i) => `细水落入第${i + 1}只供碗，留出碗沿……`), '水壶回到供台一侧……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createTibetanWaterBowls(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: number; time: number; from: number; placed: boolean } | null = null
  let amount = 0, invalid = false
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '清水七供', stepsAria: '清水七供步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'tibetan-water-bowls', label: '清水七供' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createWaterBowlsModel(); scene.add(model.root)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const phase = (step: number) => step === 0 ? 0 : step < 8 ? 1 : step === 8 ? 2 : 3
  const pose = (step: number, n: number) => { amount = n; model.pose(phase(step), phase(step) === 1 ? (step - 1 + n) / 7 : n); matrices() }
  const restore = () => pose(at, 0)
  // Each pouring target is the current bowl's prepared tilt, before its water
  // starts flowing. pose(step,1) has already advanced to the following bowl.
  const placement = createPosePlacement(canvas, camera, {
    roots: ACTIONS.map(() => model.jug), targets: ACTIONS.map(() => model.jug),
    anchors: ACTIONS.map(() => model.anchors[0]!),
    pose(step, n) { pose(step, phase(step) === 1 ? .12 * n : n) },
  }, scene)
  const removeCues = ACTIONS.map((label, i) => addInteractionCue(model.jug, { kind: 'drag', destination: () => placement.destination(i), targetLabel: i > 0 && i < 8 ? `第${i}碗上方` : '水壶落位处', label, anchor: model.anchors[0], priority: 3, enabled: () => inputActive() && !motion && at === i }))
  const ray = createPointerRay(canvas, camera)
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const reset = () => { placement.cancel(); invalid = false; if (!motion && !disposed) restore() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === TOTAL_STEPS || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); const hit = nearest(x, y); const target = model.roots[phase(at)]!; return !!hit && (hit.object === target || target.getObjectById(hit.object.id) === hit.object) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; invalid = false; if (!placement.begin(at, x, y)) pointer.cancel() },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if (!invalid && placement.move(x, y) && pointer.finish()) { placement.capture(); advance(true) }
    },
    onRelease(x, y) {
      if (!invalid && placement.move(x, y)) { placement.capture(); advance(true) } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (motion || at === TOTAL_STEPS) delete ui.hintEl.dataset.ready
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, TOTAL_STEPS); ui.actionBtn.hidden = at === TOTAL_STEPS; ui.actionBtn.disabled = !inputActive() || !!motion || at === TOTAL_STEPS
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < TOTAL_STEPS ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[Math.min(at, TOTAL_STEPS - 1)]!, safe); setSafeText(ui.hintEl, motion ? MOVING[motion.step]! : HINTS[at]!, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    placement.cancel(); at = motion.step + 1; motion = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === TOTAL_STEPS && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(placed = false) { if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === TOTAL_STEPS) return; motion = { step: at, time: 0, from: amount, placed }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === TOTAL_STEPS || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0,1.2,0), direction = new THREE.Vector3(.6,4.6,7).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target);camera.updateMatrixWorld(true)
    const inverse=camera.quaternion.clone().invert(),tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=3.4
    // Frame the elevated altar, Buddha, all seven bowls and complete jug paths.
    for(const x of[-1.9,1.9])for(const y of[-.012,2.5])for(const z of[-.8,1.1]){const p=new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inverse);distance=Math.max(distance,p.z+Math.abs(p.x)/(tangent*aspect*.86),p.z+Math.abs(p.y)/(tangent*.86))}
    camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, TOTAL_STEPS) : 0
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        const pouring = phase(motion.step) === 1
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (pouring ? 1 : motion.placed ? .35 : 1.2))
        const eased = ease(motion.time)
        if (motion.placed && pouring) {
          if (motion.time <= .2) { const entering = ease(motion.time / .2); pose(motion.step, .12 * entering); placement.settle(entering) }
          else { placement.settle(1); pose(motion.step, .12 + .88 * ease((motion.time - .2) / .8)) }
        } else { pose(motion.step, motion.from + (1 - motion.from) * eased); placement.settle(eased) }
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); lights.key.shadow.normalBias = .03; style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); model.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
