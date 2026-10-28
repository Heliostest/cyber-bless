import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createFreePlacementPointer } from '../free-placement-pointer'
import { createPosePlacement } from '../pose-placement'
import { addKeyboardPlacementInspection, setPlacementHint } from '../placement-inspection'
import { createTouchTarget, insideCanvas } from '../touch-target'
import { completesDirectionalDrag, directionalAxes, updateDirectionalDragHint } from '../directional-drag'
import { addStageLights, CEL_STYLE, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createSongkranModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['捧起清水碗', '移到长辈手边', '缓缓浇水']
const HINTS = [
 '捧起小碗，移到上方提示标记处，带起备好的清水。',
 '捧住小碗，移到长辈双手上方的提示标记处。',
 '按住小碗向下短拖，轻轻倾水，再将碗放回。',
 '清水轻落在长辈手上。愿长辈安康，新岁顺遂。',
]
const MOVING = ['捧起清水碗……', '移到长辈手边……', '缓缓浇水，向长辈致敬……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createSongkran(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number; placed?: boolean; heldPosition?: THREE.Vector3; heldQuaternion?: THREE.Quaternion; sounded?: boolean; flowing?: boolean } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '浇水敬老', stepsAria: '浇水敬老步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'thai-songkran-elders', label: '浇水敬老' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [4, 5, -3], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createSongkranModel(); scene.add(model.root)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const restore = () => { pose(at, 0);; placement.restoreCheckpoint(at); matrices() }
  const carryStep = () => (at < 2 ? 1 : 2) as 1 | 2
  const carrying = () => at < 2
  const placementRoots=model.roots,placementAnchors=model.anchors.map(a=>a.toArray() as [number,number,number])
  const isPlacementStep=(step:number)=>step<2
  const placement=createPosePlacement(canvas,camera,{pose:model.pose,roots:placementRoots,targets:model.targets,anchors:placementAnchors},scene)
  const directions: [number, number][] = [[0,-1],[1,0],[0,1]]
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', ...(isPlacementStep(i) ? {destination:()=>placement.destination(carryStep()),targetLabel:'水碗准备位置'} : {direction:directions[i]}), label: ACTIONS[i]!, anchor: model.anchors[i]!.toArray(), priority: 3, enabled: () => inputActive() && !motion && (at < 2 ? i === 1 : at === i) }))
  const touch = createTouchTarget(canvas, camera, scene), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const axes = (dx: number, dy: number) => directionalAxes(directions[at]!, dx, dy)
  const reset = () => { placement.cancel(); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore(); updateDirectionalDragHint(ui.hintEl, false, HINTS[at]!, safe) }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const inspectRotate = (dx:number,dy:number) => { if (!carrying()) return; placement.rotate(dx*.012,0); model.refreshHeldWater(); matrices() }
  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return touch.hit(x, y, model.roots[at]!) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; down.set(x, y); previous.copy(down); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0 ; if(isPlacementStep(at) && !placement.begin(carryStep(),x,y))pointer.cancel(); },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if(isPlacementStep(at)){const ready=placement.move(x,y);model.refreshHeldWater();if(!invalid && ready && pointer.finish()){placement.capture();advance(true)};return}
      pathTravel += Math.hypot(x - previous.x, y - previous.y); previous.set(x, y)
      const [a, cross] = axes(x - down.x, y - down.y); along = a!; moved = true
      maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along); maxCross = Math.max(maxCross, Math.abs(cross!))
      // Held input previews the current motion; valid release completes the placement.
      pose(at, THREE.MathUtils.clamp(along / 60, 0, 1) * .20)
      updateDirectionalDragHint(ui.hintEl, !invalid && completesDirectionalDrag({ along, end: along, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel: pathTravel }), HINTS[at]!, safe)
    },
    onRelease(x, y) {
      if(isPlacementStep(at)){if(!invalid && placement.move(x,y)){placement.capture();advance()}else if(!invalid && insideCanvas(canvas,x,y))placement.release();else reset();return}
      const [end, cross] = axes(x - down.x, y - down.y), travel = pathTravel + Math.hypot(x - previous.x, y - previous.y)
      const valid = !invalid && moved && completesDirectionalDrag({ along, end: end!, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel })
      if (valid) advance(); else reset()
    }, onRotate: inspectRotate,
    onRebase(x,y) { if (carrying()) placement.rebase(x,y) },
    onInspectEnd() { if (carrying()) { placement.release(); model.refreshHeldWater(); } else reset() }, onCancel: reset,
  })
  const sync = () => {
    if (motion || at === 3) delete ui.hintEl.dataset.ready
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at < 2 ? 0 : at - 1, 2); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[at < 2 ? 1 : 2]!, safe); setPlacementHint(ui.hintEl, motion ? MOVING[motion.step]! : HINTS[at < 2 ? 1 : at]!, !motion && carrying(), safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function soundWater(short = false) {
    if (!motion || motion.step !== 2) return
    if ((short || model.stream.visible) && !motion.sounded) {
      motion.sounded = true
      withHostCallbacks(() => feedback.sound('water', { duration: short ? .12 : .8, strength: .5 }))
    }
    if (!model.stream.visible && motion.flowing) feedback.stop()
    motion.flowing = model.stream.visible
  }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore(); resize()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(placed=false) { if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === 3) return; motion = { step: carryStep(), time: 0, from: amount,placed,heldPosition:placed?placementRoots[at]!.position.clone():undefined,heldQuaternion:placed?placementRoots[at]!.quaternion.clone():undefined }; sync(); if (ctx.isReducedMotion?.()) { soundWater(true); settle() } }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if (carrying()) { placement.capture(carryStep()); advance(true) } else advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); if (!motion) { placement.cancel(); restore() }; sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    if (!motion) { pointer.cancel(); placement.cancel(); restore() }
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(-.08,.86,.10), direction = new THREE.Vector3(.8,4.2,6).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 1.3
    const saved = amount, framed = [model.cup,model.elder,model.bench,model.basin,model.pad]
    for (const [step,n] of [0,1,2].flatMap(step=>Array.from({length:41},(_,i)=>[step,i/40]))) {
      model.pose(step!,n!,false); matrices()
      framed.forEach(subject=>subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i=0;i<vertices.count;i++) { p.fromBufferAttribute(vertices,i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance=Math.max(distance,p.z+Math.abs(p.x)/(tangent*aspect*.84),p.z+Math.abs(p.y)/(tangent*.84)) }
      }))
    }
    pose(at,saved);camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);matrices()
  }
  const stopInspection = addKeyboardPlacementInspection(ui.actionBtn,canvas,camera,model,placement,{isActive:()=>inputActive()&&!motion&&carrying()&&!pointer.isBusy(),step:()=>carryStep(),prepare:prepareInput,reset,rotate:(yaw,pitch)=>inspectRotate(yaw/.012,pitch/.012)})
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
      feedback.update()
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!motion) { placement.cancel(); restore() }; if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.placed?.32:.85))
        const eased=ease(motion.time)
        pose(motion.step, motion.from+(1-motion.from)*eased); if(motion.placed && isPlacementStep(motion.step)){placement.settle(eased);model.refreshHeldWater()} soundWater(); if (motion.time === 1) settle()
      }
      if (active()) { if (!ctx.isReducedMotion?.()) model.tick(delta); matrices(); lights.key.shadow.normalBias = .03; style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopInspection(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
