import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas } from '../touch-target'
import { completesDirectionalDrag } from '../directional-drag'
import { addStageLights, CEL_STYLE, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createMolinilloModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['向下浸入器头', '向右搓转木柄', '向左搓转木柄']
const HINTS = [
  '握住木柄，沿杯轴移到提示标记，让有沟槽的器头轻轻浸入可可饮品。',
  '按住木柄，向右短拖，让木柄转动，杯面渐渐浮起细泡。',
  '按住木柄，向左短拖，换向搓转。松动的木环随之转动，泡沫慢慢聚起。',
  '左右搓转结束，细泡浮在可可表面。木纹、陶釉与泡沫，在阳光下各有质感。',
]
const MOVING = ['器头停在饮品表面……', '木柄向右搓转，细泡浮起……', '木柄换向搓转，泡沫聚起……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createMexicanMolinillo(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '木旋起沫', stepsAria: '搓转步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'mexican-molinillo', label: '木旋起沫' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .1, far: 15 })
  const model = createMolinilloModel(); scene.add(model.subject)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const restore = () => pose(at, 0)
  const isSpatialStep=(step:number)=>step === 0
  const limitPoints=model.targets.map((target,i)=>{model.pose(i,1);return target!.localToWorld(new THREE.Vector3(...model.anchors[i]!))})
  model.pose(0,0)
  const railStart=new THREE.Vector2(),railPath=new THREE.Vector2()
  let railRadius=0
  const screenPoint=(point:THREE.Vector3)=>{const p=point.project(camera),r=canvas.getBoundingClientRect();return new THREE.Vector2(r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2)}
  const prepareRail=(x:number,y:number)=>{const a=screenPoint(model.targets[at]!.localToWorld(new THREE.Vector3(...model.anchors[at]!))),b=screenPoint(limitPoints[at]!.clone());railStart.set(x,y);railPath.copy(b).sub(a);railRadius=Math.min(22,railPath.length()*.42)}
  const moveRail=(x:number,y:number)=>{
    if(!insideCanvas(canvas,x,y))return false
    const n=THREE.MathUtils.clamp(new THREE.Vector2(x,y).sub(railStart).dot(railPath)/Math.max(railPath.lengthSq(),1e-9),0,1)
    pose(at,n)
    const contact=screenPoint(model.targets[at]!.localToWorld(new THREE.Vector3(...model.anchors[at]!))),goal=screenPoint(limitPoints[at]!.clone())
    return n>0 && contact.distanceTo(goal)<=railRadius && !touch.occluded(x,y,model.targets[at]!,{ignore:model.subject})
  }

  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', ...(isSpatialStep(i)?{destination:()=>limitPoints[i]!.clone(),targetLabel:'器头浸入位置'}:{direction:i === 0 ? [0, 1] : [i === 1 ? 1 : -1, 0]}), label: ACTIONS[i]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at === i }))
  const touch = createTouchTarget(canvas, camera, scene), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const axes = (dx: number, dy: number) => at === 0 ? [dy, dx] : at === 1 ? [dx, dy] : [-dx, dy]
  const reset = () => { moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return touch.hit(x, y, model.targets[at]!) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; down.set(x, y); previous.copy(down); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if(isSpatialStep(at))prepareRail(x,y) },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if(isSpatialStep(at)){if(!invalid && moveRail(x,y) && pointer.finish())advance(true);return}
      pathTravel += Math.hypot(x - previous.x, y - previous.y); previous.set(x, y)
      const [a, cross] = axes(x - down.x, y - down.y); along = a!; moved = true
      maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along); maxCross = Math.max(maxCross, Math.abs(cross!))
      pose(at, THREE.MathUtils.clamp(along / 60, 0, 1))
    },
    onRelease(x, y) {
      if(isSpatialStep(at)){if(!invalid && moveRail(x,y))advance();else reset();return}
      const [end, cross] = axes(x - down.x, y - down.y), travel = pathTravel + Math.hypot(x - previous.x, y - previous.y)
      const valid = !invalid && moved && completesDirectionalDrag({ along, end: end!, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel })
      if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[Math.min(at, 2)]!, safe); setSafeText(ui.hintEl, motion ? MOVING[motion.step]! : HINTS[at]!, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [523.25], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(accepted=false) { if (!inputActive() || (pointer.isBusy() && !accepted) || motion || at === 3) return; motion = { step: at, time: 0, from: amount }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(.14, 1.53, 0), direction = new THREE.Vector3(.22, 1.25, 2.65).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const saved = amount
    for (const [step, n] of [[0, 0], [0, 1], [1, 0], [1, .5], [1, 1], [2, 0], [2, .5], [2, 1], [3, 0]]) {
      pose(step!, n!)
      model.subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      })
    }
    pose(at, saved); camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
  }
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
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) { motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .85); pose(motion.step, THREE.MathUtils.lerp(motion.from, 1, ease(motion.time))); if (motion.time === 1) settle() }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.subject); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
