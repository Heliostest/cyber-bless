import { addKeyboardPlacementInspection, setPlacementHint } from '../placement-inspection'
import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue, sceneJoin } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createFreePlacementPointer } from '../free-placement-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createFirstFootingModel } from './model'
import { insideCanvas } from '../touch-target'
import { createFirstFootingCarry } from './carry'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['拿起煤礼', '携过门槛', '送进炉火']
const HINTS = ['新年午夜后，做第一位来客：拿住煤块，提到门前提示的位置。','拿住煤礼，移到敞开门内的提示位置，把暖意带给主人家。','拿住煤块，移到主人家炉膛内的提示位置。','煤礼送进炉火，愿这一家新年温暖安康。']
const MOVING = ['带来的煤礼慢慢拿起……','煤礼经过敞开的门槛……','把温暖的新年祝愿送给主人家……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createScottishFirstFooting(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { time: number; arrived: boolean } | null = null
  let invalid = false
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '煤火迎年', stepsAria: '煤火迎年步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'scottish-first-footing', label: '煤火迎年' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xdce8e2, ground: 0x89998a, key: 0xffe7bd, rim: 0xc5def1, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createFirstFootingModel(); scene.add(model.root)
  const placement = createFirstFootingCarry(canvas,camera,model,scene)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { model.pose(at,0); placement.reset(at); matrices() }
  const carryHint = sceneJoin(HINTS[0]!,HINTS[2]!)
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', label: ACTIONS[2]!, anchor: model.anchors[i], destination: () => placement.destination(i), targetLabel: '当前安放位置', priority: 3, enabled: () => i === 2 && inputActive() && !motion && at < 3 }))
  const ray = createPointerRay(canvas, camera)
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const reset = () => { placement.cancel(); invalid = false; if (!motion && !disposed) { restore(); setPlacementHint(ui.hintEl,at === 3 ? HINTS[3]! : carryHint,!motion&&at<3,safe) } }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const inspectRotate=(dx:number,dy:number)=>{ placement.rotate(dx*.012,dy*.012) }
  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); const hit = nearest(x, y); const target = model.roots[at]!; return !!hit && (hit.object === target || target.getObjectById(hit.object.id) === hit.object) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; invalid = false; if (!placement.begin(at,x,y)) pointer.cancel() },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if (!invalid && placement.move(x,y) && pointer.finish()) { placement.capture(); advance(true) }
    },
    onRelease(x, y) {
      const valid = !invalid && placement.move(x,y)
      if (valid) { placement.capture(); advance(true) } else if (!invalid && insideCanvas(canvas,x,y)) placement.release(); else reset()
    }, onCancel: reset,
    onRotate: inspectRotate,
    onRebase(x,y) { placement.rebase(x,y) },
    onInspectEnd() { placement.release() },
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at === 3 ? 1 : 0, 1); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[2]!, safe); setPlacementHint(ui.hintEl,motion ? MOVING[2]! : at === 3 ? HINTS[3]! : carryHint,!motion&&at<3,safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    if (motion.arrived) placement.settle(1); else placement.animateAssisted(1)
    at = 3; motion = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(placed = false) { if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === 3) return; motion = { time: 0, arrived: placed }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if (placement.assist()) advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); if (!motion) reset(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0,.9,.15), direction = new THREE.Vector3(.40,3.0,6.8).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target);camera.updateMatrixWorld(true)
    const inverse=camera.quaternion.clone().invert(),tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=3.4
    // Frame the entire cutaway doorway, cold step, hearth and coal transfer route.
    for(const x of[-1.55,1.55])for(const y of[-.12,2.15])for(const z of[-1.16,1.66]){const p=new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inverse);distance=Math.max(distance,p.z+Math.abs(p.x)/(tangent*aspect*.86),p.z+Math.abs(p.y)/(tangent*.86))}
    camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);matrices()
  }
  const stopInspection=addKeyboardPlacementInspection(ui.actionBtn,canvas,camera,model,placement,{isActive:()=>inputActive()&&!motion&&at<3&&!pointer.isBusy(),step:()=>at,prepare:prepareInput,reset,rotate:(yaw,pitch)=>inspectRotate(yaw/.012,pitch/.012)})
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) { pointer.cancel(); if (!motion) reset(); resize() } })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!motion) reset(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.arrived ? .32 : 1.6))
        const eased=ease(motion.time)
        if (motion.arrived) placement.settle(eased); else placement.animateAssisted(eased)
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); lights.key.shadow.normalBias = .008; style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopInspection(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); model.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
