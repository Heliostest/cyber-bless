import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createFreePlacementPointer } from '../free-placement-pointer'
import { sceneJoin } from '../scene-localization'
import { insideCanvas } from '../touch-target'
import { createPosePlacement } from '../pose-placement'
import { addKeyboardPlacementInspection, setPlacementHint } from '../placement-inspection'
import { completesDirectionalDrag, directionalAxes, updateDirectionalDragHint } from '../directional-drag'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createPomegranateModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['拿起石榴', '移到门槛上方', '向下落果']
const HINTS = ['新年的石榴已备在门槛上。拿住果实，提到门前的提示位置。','拿住石榴，把它移到门槛中央上方的提示位置。','按住石榴向下短拖后松手，让果实落向石槛。','石榴已在门槛上破开，红籽散落。把新年的祝愿留给这一家。']
const MOVING = ['石榴慢慢拿起……','石榴移向门槛上方……','果实落下，果皮破开，红籽弹落……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createGreekNewYearPomegranate(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number; arrived?: boolean } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '破榴迎新', stepsAria: '破榴迎新步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'greek-new-year-pomegranate', label: '破榴迎新' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createPomegranateModel(); scene.add(model.root)
  const placementSteps = new Set([0,1])
  const placement = createPosePlacement(canvas, camera, model, scene)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const canonicalRotations = model.roots.map(root => root.quaternion.clone())
  const restore = () => {  model.roots.forEach((root,i) => root.quaternion.copy(canonicalRotations[i]!)); pose(at, 0) ; placement.restoreCheckpoint(at); matrices() }
  const freePlacementStep = (step: number) => step === 0 || step === 1
  const placementStep = (step: number): 0 | 1 | 2 => step < 2 ? 1 : 2
  const placementHint = () => at < 2 ? sceneJoin(HINTS[0]!, HINTS[1]!) : HINTS[at]!
  const placementAction = () => ACTIONS[placementStep(at)]!
  const directions: [number, number][] = [[0,-1],[1,0],[0,1]]
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', ...(placementSteps.has(i) ? { destination: () => placement.destination(placementStep(i)), targetLabel: '当前安放位置' } : { direction: directions[i] }), label: ACTIONS[i]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at < 3 && placementStep(at) === i }))
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const axes = (dx: number, dy: number) => directionalAxes(directions[at]!, dx, dy)
  const reset = () => { placement.cancel(); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore(); updateDirectionalDragHint(ui.hintEl, false, HINTS[at]!, safe) }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const inspectRotate = (dx:number,dy:number) => { if (freePlacementStep(at)) { placement.rotate(dx*.012,dy*.012) } }
  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); const hit = nearest(x, y); return !!hit && (hit.object === model.fruit || model.fruit.getObjectById(hit.object.id) === hit.object) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; down.set(x, y); previous.copy(down); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (placementSteps.has(at)) placement.begin(placementStep(at),x,y) },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if (placementSteps.has(at)) { if (!invalid && placement.move(x,y) && pointer.finish()) { placement.capture(); advance(true) }; return }
      pathTravel += Math.hypot(x - previous.x, y - previous.y); previous.set(x, y)
      const [a, cross] = axes(x - down.x, y - down.y); along = a!; moved = true
      maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along); maxCross = Math.max(maxCross, Math.abs(cross!))
      // Held input lifts or winds back the whole fruit; fracture begins only after impact.
      pose(at, THREE.MathUtils.clamp(along / 60, 0, 1) * .20)
      updateDirectionalDragHint(ui.hintEl, !invalid && completesDirectionalDrag({ along, end: along, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel: pathTravel }), HINTS[at]!, safe)
    },
    onRelease(x, y) {
      const [end, cross] = axes(x - down.x, y - down.y), travel = pathTravel + Math.hypot(x - previous.x, y - previous.y)
      const valid = placementSteps.has(at) ? !invalid && placement.move(x,y) : !invalid && moved && completesDirectionalDrag({ along, end: end!, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel })
      if (valid) { if (placementSteps.has(at)) placement.capture(); advance(true) } else if (!invalid && insideCanvas(canvas,x,y) && freePlacementStep(at)) placement.release(); else reset()
    }, onRotate: inspectRotate,
    onRebase(x,y) { if (freePlacementStep(at)) placement.rebase(x,y); else reset() },
    onInspectEnd() { if (freePlacementStep(at)) placement.release(); else reset() },
    onCancel: reset,
  })
  const sync = () => {
    if (motion || at === 3) delete ui.hintEl.dataset.ready
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at < 2 ? 0 : at === 2 ? 1 : 2, 2); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, placementAction(), safe); setPlacementHint(ui.hintEl, motion ? MOVING[motion.step]! : placementHint(), !motion && freePlacementStep(at), safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    placement.settle(1)
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(placed = false) { if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === 3) return; motion = { step: placementStep(at), time: 0, from: amount, arrived: placed }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if (freePlacementStep(at)) { placement.capture(placementStep(at)); advance(true) } else advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); if (!motion) reset(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    if (started && !motion) { pointer.cancel(); reset() }
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0,.92,.45), direction = new THREE.Vector3(2.2,4.8,7).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target);camera.updateMatrixWorld(true)
    const inverse=camera.quaternion.clone().invert(),tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=3.4
    // Conservative envelope contains the door fragment, stone threshold and every flight/scatter pose.
    for(const x of[-1.85,1.85])for(const y of[0,2.35])for(const z of[-1.35,2.3]){const p=new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inverse);distance=Math.max(distance,p.z+Math.abs(p.x)/(tangent*aspect*.86),p.z+Math.abs(p.y)/(tangent*.86))}
    camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);matrices()
  }
  const stopInspection=addKeyboardPlacementInspection(ui.actionBtn,canvas,camera,model,placement,{isActive:()=>inputActive()&&!motion&&freePlacementStep(at)&&!pointer.isBusy(),step:()=>placementStep(at),prepare:prepareInput,reset,rotate:(yaw,pitch)=>inspectRotate(yaw/.012,pitch/.012)})
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
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.arrived ? .32 : 2))
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
