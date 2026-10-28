import { insideCanvas } from '../touch-target'
import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createFreePlacementPointer } from '../free-placement-pointer'
import { createPosePlacement } from '../pose-placement'
import { addKeyboardPlacementInspection, setPlacementHint } from '../placement-inspection'
import { completesDirectionalDrag, directionalAxes, updateDirectionalDragHint } from '../directional-drag'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createNagashibinaModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['托起草托', '移向缓流', '放入水中']
const HINTS = ["握住圆形草托，把一对纸雏提到上方提示位置。","握住草托，挪到缓流上方的提示范围。","握住草托，挪到水面的提示范围，轻轻放流。","纸雏随缓流远去，寄托无病息灾与平安成长的祈愿。"]
const MOVING = ['托起纸雏与花枝……','移向清浅的缓流……','圆形草托轻轻漂开……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createMochigaseNagashibina(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 2; time: number; from: number; arrived: boolean } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '纸雏祈安', stepsAria: '纸雏祈安步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'mochigase-nagashibina', label: '纸雏祈安' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createNagashibinaModel(); scene.add(model.root)
  const placement = createPosePlacement(canvas, camera, model, scene, { destination: (step, goal) => step === 2 ? goal.add(new THREE.Vector3(-.57, 0, .40)) : goal }), spatialSteps = new Set([0,1,2])
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const restore = () => { pose(at, 0);; placement.restoreCheckpoint(at); matrices() }
  const directions: [number, number][] = [[0,-1],[1,0],[0,1]]
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', destination: () => placement.destination(2), targetLabel: '当前安放位置', label: ACTIONS[2]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at === i }))
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const axes = (dx: number, dy: number) => directionalAxes(directions[at]!, dx, dy)
  const reset = () => { placement.cancel(); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore(); updateDirectionalDragHint(ui.hintEl, false, HINTS[at === 3 ? 3 : 2]!, safe) }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const inspectionBounds = new THREE.Box3()
  const inspectRotate = (dx:number,dy:number) => {
      if (invalid || !placement.rotate(dx * .012, dy * .012)) return
      // Lift the rotated tray clear of its .06-high shore support, so the
      // inspected paper figures never become buried and remain regrabbable.
      inspectionBounds.setFromObject(model.tray, true)
      model.tray.position.y += Math.max(0, .09 - inspectionBounds.min.y)
      matrices()
    }
  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); const hit = nearest(x, y); const target = model.roots[at]!; return !!hit && (hit.object === target || target.getObjectById(hit.object.id) === hit.object) },
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
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0,.32,0), direction = new THREE.Vector3(2.5,5.6,7).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target);camera.updateMatrixWorld(true)
    const inverse=camera.quaternion.clone().invert(),tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=3.4
    // Frame the round tray, paper figures and whole shore-to-water path.
    for(const x of[-1.56,1.72])for(const y of[-.02,1.12])for(const z of[-1.08,.80]){const p=new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inverse);distance=Math.max(distance,p.z+Math.abs(p.x)/(tangent*aspect*.86),p.z+Math.abs(p.y)/(tangent*.86))}
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
        pose(motion.step, motion.from+(1-motion.from)*eased)
        if (eased < .6) {
          // Seat at the actual water entry before the authored downstream drift.
          const landing = eased / .6
          placement.settle(landing)
          model.tray.position.addScaledVector(new THREE.Vector3(-.57, 0, .40), landing)
          matrices()
        }
        if (motion.time === 1) settle()
      }
      if (active()) { model.update(delta, ctx.isReducedMotion?.() ?? false); matrices(); lights.key.shadow.normalBias = .03; style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopInspection(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); model.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
