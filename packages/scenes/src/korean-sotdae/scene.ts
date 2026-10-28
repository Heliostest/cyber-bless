import { insideCanvas } from '../touch-target'
import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createFreePlacementPointer } from '../free-placement-pointer'
import { createPosePlacement } from '../pose-placement'
import { addKeyboardPlacementInspection, setPlacementHint } from '../placement-inspection'
import { createTouchTarget } from '../touch-target'
import { completesDirectionalDrag, directionalAxes, updateDirectionalDragHint } from '../directional-drag'
import { addStageLights, CEL_STYLE, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createKoreanSotdaeModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['提起鸟竿', '扶竿立正', '落竿寄愿']
const HINTS = ['按住木竿向上拖，轻轻提起鸟竿。','按住木竿向上拖，将鸟竿缓缓扶正。','按住木竿向下拖，让竿脚稳稳落地。','鸟竿已立稳，愿你与牵挂的人平安。']
const MOVING = ['木鸟与长竿缓缓提起……','长竿慢慢扶正，木鸟迎向天空……','竿脚轻落承孔，稳稳安放……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createKoreanSotdae(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 2; time: number; from: number; arrived: boolean } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '鸟竿祈安', stepsAria: '鸟竿祈安步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'korean-sotdae', label: '鸟竿祈安' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf2ead5, ground: 0x837457, key: 0xffdfb9, rim: 0xaac8f3, keyPosition: [-3, 5, 4], keyIntensity: 2.4, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createKoreanSotdaeModel(); scene.add(model.root)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const restore = () => { pose(at, 0);; placement.restoreCheckpoint(at); matrices() }
  const placementRoots=[model.actor,model.actor,model.actor],placementAnchors=model.anchors
  const isPlacementStep=(step:number)=>step!==1
  const placement=createPosePlacement(canvas,camera,{pose:model.pose,roots:placementRoots,targets:model.targets,anchors:placementAnchors},scene)
  const directions: [number, number][] = [[0,-1],[0,-1],[0,1]]
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', destination: () => placement.destination(2), targetLabel: '当前安放位置', label: ACTIONS[2]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at === i }))
  const touch = createTouchTarget(canvas, camera, scene), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const axes = (dx: number, dy: number) => directionalAxes(directions[at]!, dx, dy)
  const reset = () => { placement.cancel(); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore(); updateDirectionalDragHint(ui.hintEl, false, HINTS[at === 3 ? 3 : 2]!, safe) }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const inspectRotate = (dx:number,dy:number) => { if (!invalid) placement.rotate(dx * .012, dy * .012) }
  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return touch.hit(x,y,model.roots[at]!) },
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
    setSafeText(ui.actionBtn, ACTIONS[2]!, safe); setPlacementHint(ui.hintEl, motion ? MOVING[motion.step]! : HINTS[at === 3 ? 3 : 2]!, !motion && at < 3, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    placement.settle(1); placement.cancel(); at = 3; motion = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(placed = false) { if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === 3) return; motion = { step: 2, time: 0, from: 0, arrived: placed }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => {
    if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return
    placement.capture(2); advance(true)
  }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); if (!motion) reset(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    pointer.cancel(); if (!motion) reset()
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0,1.45,.05), direction = new THREE.Vector3(3.8,4.4,7).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target);camera.updateMatrixWorld(true)
    const inverse=camera.quaternion.clone().invert(),tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=3.4
    // Frame the full wooden bird and long pole through all three paths.
    for(const x of[-1.45,1.45])for(const y of[0,3.20])for(const z of[-1.4,1.4]){const p=new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inverse);distance=Math.max(distance,p.z+Math.abs(p.x)/(tangent*aspect*.86),p.z+Math.abs(p.y)/(tangent*.86))}
    camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);matrices()
  }
  const stopInspection = addKeyboardPlacementInspection(ui.actionBtn,canvas,camera,model,placement,{isActive:()=>inputActive()&&!motion&&at < 3&&!pointer.isBusy(),step:()=>2,prepare:prepareInput,reset,rotate:(yaw,pitch)=>inspectRotate(yaw/.012,pitch/.012)})
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
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!motion) reset(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .42)
        const eased=ease(motion.time)
        pose(motion.step, motion.from+(1-motion.from)*eased); placement.settle(eased); if (motion.time === 1) settle()
      }
      if (active()) { matrices(); lights.key.shadow.normalBias = .03; style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopInspection(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); model.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
