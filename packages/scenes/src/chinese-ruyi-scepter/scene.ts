import { createTouchTarget, insideCanvas } from '../touch-target'
import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createFreePlacementPointer } from '../free-placement-pointer'
import { createCloseInspection } from '../close-inspection'
import { createPosePlacement } from '../pose-placement'
import { addKeyboardPlacementInspection, setPlacementHint } from '../placement-inspection'
import { completesDirectionalDrag, directionalAxes, updateDirectionalDragHint } from '../directional-drag'
import { addStageLights, CEL_STYLE, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createChineseRuyiScepterModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['轻轻抬起', '移近木座', '缓缓放稳']
const HINTS = [
 '如意寄托好愿。拿住云头，提到前方的提示位置。',
 '拿住云头，把如意移到木座上方的提示位置。',
 '托住云头，把如意移到软垫木座上，到位会自动放稳。',
 '如意已安放。愿心有所向，日子顺遂，所愿慢慢成真。',
]
const CARRY_HINT = '如意寄托好愿。托住云头，把如意移到软垫木座上，到位会自动放稳。'
const MOVING = ['如意离开准备托，慢慢抬起……', '云头越过木座，轻轻移近……', '曲柄贴近软垫，缓缓落稳……']
const ease = (t: number) => t * t * (3 - 2 * t)
// Product micro-motion (all off with reduced motion): a 5% pickup swell, a
// small inertial lean, a short settle squash, and travelling light on the jade.
const HELD_SCALE = .05, MAX_LEAN = THREE.MathUtils.degToRad(3), IDLE_EVERY = 8, IDLE_SWEEP = 1.4, LANDING = .55

export function createChineseRuyiScepter(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING, CARRY_HINT].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 2; time: number; from: number; arrived: boolean } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '如意寄愿', stepsAria: '如意寄愿步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'chinese-ruyi-scepter', label: '如意寄愿' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createChineseRuyiScepterModel(); scene.add(model.root)
  let closeInspection: ReturnType<typeof createCloseInspection> | undefined
  const canPlace = () => closeInspection?.canPlace() ?? false
  const placement = createPosePlacement(canvas, camera, model, scene)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const restore = () => { pose(at, 0);; placement.restoreCheckpoint(at); matrices() }
  const directions: [number, number][] = [[0,-1],[1,0],[0,1]]
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', destination: () => placement.destination(2), targetLabel: '当前安放位置', label: ACTIONS[2]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && canPlace() && !motion && at === i }))
  // The whole ruyi is the pickup target, with a bounded 22 CSS px margin.
  const touch = createTouchTarget(canvas, camera, scene)
  let lift = 0, lean = 0, leanVelocity = 0, lastX: number | undefined, idle = 0, landing = -1
  const sweep = model.jade.uniforms as { uSweep: THREE.IUniform<number>; uSweepGain: THREE.IUniform<number> }
  const calm = () => {
    lift = lean = leanVelocity = idle = 0; lastX = undefined; landing = -1
    model.motion.position.set(0, 0, 0); model.motion.rotation.set(0, 0, 0); model.motion.scale.setScalar(1)
    sweep.uSweep.value = -1; sweep.uSweepGain.value = 0
  }
  const axes = (dx: number, dy: number) => directionalAxes(directions[at]!, dx, dy)
  const reset = () => { calm(); placement.cancel(); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore(); updateDirectionalDragHint(ui.hintEl, false, (at === 3 ? HINTS[3]! : CARRY_HINT), safe) }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const inspectRotate = (dx:number,dy:number) => { if (!invalid) placement.rotate(dx * .012, dy * .012) }
  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: () => inputActive() && canPlace(),
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return touch.hit(x, y, model.roots[at]!) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      invalid = false
      if (!placement.begin(2, x, y)) pointer.cancel()
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if (!invalid && placement.move(x, y) && pointer.finish()) { placement.capture(); advance(true) }
    },
    onRelease(x, y) {
      if (!invalid && placement.move(x, y)) { placement.capture(); advance(true) }
      else if (invalid || !insideCanvas(canvas,x,y)) reset()
      else placement.release()
    },
    onRotate: inspectRotate,
    onRebase(x, y) { if (!invalid) placement.rebase(x, y) },
    onInspectEnd() { placement.release() },
    onCancel: reset,
  })
  const sync = () => {
    if (motion || at === 3) delete ui.hintEl.dataset.ready
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at === 3 ? 1 : 0, 1); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[2]!, safe); setPlacementHint(ui.hintEl, motion ? MOVING[motion.step]! : (at === 3 ? HINTS[3]! : CARRY_HINT), !motion && at < 3, safe)
    closeInspection?.decorate(at === 3)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    placement.settle(1); placement.cancel(); at = 3; motion = null; restore()
    // The settle squash and head-to-tail light start with the completion tone.
    if (!ctx.isReducedMotion?.()) landing = 0
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(placed = false) { if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === 3) return; motion = { step: 2, time: 0, from: 0, arrived: placed }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => {
    if (!inputActive() || !canPlace() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return
    placement.capture(2); advance(true)
  }
  const blur = () => { focused = false; lifecycleVersion++; closeInspection?.cancel(); pointer.cancel(); if (!motion) reset(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    calm(); closeInspection?.cancel()
    pointer.cancel(); if (!motion) reset()
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(-.12, .58, .08), direction = new THREE.Vector3(1.3, 3.9, 8).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const saved = amount
    for (const [step, n] of [0,1,2].flatMap(step=>Array.from({length:61},(_,i)=>[step,i/60])).concat([[3,0]])) {
      pose(step!, n!)
      model.subject.traverse(o => { const m = o as THREE.Mesh, kind = (m.material as THREE.Material | undefined)?.userData.ruyiToon
        // Outline shells share their surface's vertices; contact shadows are not subject.
        if (!m.geometry || kind === 'outline' || kind === 'contact-shadow') return; const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      })
    }
    pose(at, saved); camera.position.copy(target).addScaledVector(direction, distance * 1.04); camera.lookAt(target); matrices()
  }
  function animate(delta: number) {
    if (ctx.isReducedMotion?.()) { calm(); return }
    const holding = pointer.isBusy() && !motion && at < 3
    const target = holding ? 1 : 0
    lift = Math.abs(lift - target) < .002 ? target : THREE.MathUtils.damp(lift, target, 16, delta)
    // Lean against the sideways carry speed, then spring back upright.
    const x = model.scepter.getWorldPosition(new THREE.Vector3()).x
    const speed = holding && lastX !== undefined && delta > 0 ? (x - lastX) / delta : 0; lastX = holding ? x : undefined
    const goal = THREE.MathUtils.clamp(-speed * .03, -MAX_LEAN, MAX_LEAN)
    leanVelocity += ((goal - lean) * 140 - leanVelocity * (motion ? 30 : 15)) * delta; lean += leanVelocity * delta
    lean = THREE.MathUtils.clamp(lean, -MAX_LEAN * 1.3, MAX_LEAN * 1.3)
    if (!holding && Math.abs(lean) < 1e-4 && Math.abs(leanVelocity) < 1e-3) lean = leanVelocity = 0
    let squash = 0
    if (landing >= 0) {
      landing += delta; const t = landing
      squash = t < .2 ? -.035 * Math.sin(Math.PI * t / .2) : t < LANDING ? .012 * Math.sin(Math.PI * (t - .2) / (LANDING - .2)) : 0
      const p = Math.min(1, t / LANDING)
      sweep.uSweep.value = 1.05 - 1.1 * ease(p); sweep.uSweepGain.value = .55 * Math.sin(Math.PI * p)
      if (t >= LANDING) { landing = -1; idle = 0; sweep.uSweep.value = -1; sweep.uSweepGain.value = 0 }
    } else if (!holding && !motion) {
      idle += delta
      const p = (idle - IDLE_EVERY) / IDLE_SWEEP
      if (p >= 1) { idle = 0; sweep.uSweep.value = -1; sweep.uSweepGain.value = 0 }
      else if (p >= 0) { sweep.uSweep.value = -.05 + 1.1 * p; sweep.uSweepGain.value = .3 * Math.sin(Math.PI * p) }
    } else { idle = 0; sweep.uSweep.value = -1; sweep.uSweepGain.value = 0 }
    // Rise enough that a leaning ruyi never dips below where it was held.
    model.motion.position.set(0, .04 * ease(lift) + 1.6 * Math.abs(Math.sin(lean)), 0)
    model.motion.rotation.set(0, 0, lean)
    const swell = 1 + HELD_SCALE * ease(lift)
    model.motion.scale.set(swell, swell * (1 + squash), swell)
  }
  const stopInspection = addKeyboardPlacementInspection(ui.actionBtn,canvas,camera,model,placement,{isActive:()=>inputActive()&&canPlace()&&!motion&&at < 3&&!pointer.isBusy(),step:()=>2,prepare:prepareInput,reset,rotate:(yaw,pitch)=>inspectRotate(yaw/.012,pitch/.012)})
  closeInspection = createCloseInspection({ canvas, scene, camera, actor: model.scepter, ui,
    isActive: () => inputActive() && !motion, isReducedMotion: () => !!ctx.isReducedMotion?.(),
    prepare: prepareInput, safe, changed: () => sync() })
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; closeInspection?.cancel(); pointer.cancel(); if (!motion) reset(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .42)
        const eased=ease(motion.time)
        pose(motion.step, motion.from+(1-motion.from)*eased); placement.settle(eased); if (motion.time === 1) settle()
      }
      closeInspection.update(delta)
      animate(delta)
      if (active()) { matrices(); lights.key.shadow.normalBias = .03; style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; closeInspection?.dispose(); pointer.dispose(); stopInspection(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
