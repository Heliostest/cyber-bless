import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas } from '../touch-target'
import { completesDirectionalDrag, directionalAxes, updateDirectionalDragHint } from '../directional-drag'
import { addStageLights, CEL_STYLE, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createPrayerFlagsModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['抬起蓝旗一端', '展开完整旗串', '挂稳黄旗一端']
const HINTS = [
 '托住蓝旗一端，将绳环移到左侧高处的提示标记，靠近后挂稳。',
 '托住黄旗一端，将绳环移到右侧支点的提示标记，舒展完整的五色旗串。',
 '托住黄旗一端，将绳环移到右侧高处的提示标记，把另一端也挂稳。',
 '五色经幡在风中轻扬。愿一切众生安康。',
]

const MOVING = ['抬起蓝旗一端……', '展开完整旗串……', '挂稳黄旗一端……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createPrayerFlags(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 2; time: number; from: THREE.Vector3; to: THREE.Vector3; support: number } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '经幡迎风', stepsAria: '经幡迎风步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'tibetan-prayer-flags', label: '经幡迎风' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [4, 5, -3], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createPrayerFlagsModel(); scene.add(model.root)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const restore = () => { withdrawn=false;pose(at, 0) }
  const loopFor=(step:number)=>model.loops[step===0?0:1]!
  const bodyGoals:THREE.Vector3[]=[]
  const loopGoals=model.targets.map((_,i)=>{model.pose(i,1);bodyGoals.push(model.targets[i]!.localToWorld(model.anchors[i]!.clone()));return loopFor(i).getWorldPosition(new THREE.Vector3())});model.pose(0,0)
  const project=(point:THREE.Vector3)=>{const p=point.project(camera),r=canvas.getBoundingClientRect();return new THREE.Vector2(r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2)}
  const guide=(step:number)=>bodyGoals[step]!.clone()
  const carryStep=()=>at===0?0:2
  const plane=new THREE.Plane(),ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),point=new THREE.Vector3(),offset=new THREE.Vector3()
  let held:{step:0|2;index:0|1;x:number;y:number;radius:number;moved:boolean}|null=null
  let withdrawn=false
  const aim=(x:number,y:number)=>{const r=canvas.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2);camera.updateWorldMatrix(true,false);ray.setFromCamera(ndc,camera)}
  const prepareEnd=(x:number,y:number)=>{
    const step=carryStep() as 0|2,index=step===0?0:1,loop=loopFor(step),from=project(loop.getWorldPosition(new THREE.Vector3())),goal=project(loopGoals[step]!.clone())
    // Withdraw from the checkpoint's peg once; a parked end is already free.
    if(!withdrawn){const lifted=loop.position.clone();lifted.z+=.10;model.holdEnd(index,lifted);withdrawn=true;matrices()}
    const grip=model.targets[step]!.localToWorld(model.anchors[step]!.clone())
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),grip);aim(x,y)
    if(!ray.ray.intersectPlane(plane,point))return
    offset.subVectors(grip,point);held={step,index,x,y,radius:Math.min(22,from.distanceTo(goal)*.42),moved:false}
  }
  const moveEnd=(x:number,y:number)=>{
    if(!held||!Number.isFinite(x)||!Number.isFinite(y)||!insideCanvas(canvas,x,y))return false
    aim(x,y);if(!ray.ray.intersectPlane(plane,point))return false
    const desired=point.clone().add(offset),target=model.targets[held.step]!
    // Recompute the live string and cloth from its real end. Iteration keeps the
    // picked cloth point under the finger without constraining it to a rail.
    for(let i=0;i<6;i++){
      const grip=target.localToWorld(model.anchors[held.step]!.clone()),error=desired.clone().sub(grip)
      const end=loopFor(held.step).getWorldPosition(new THREE.Vector3()).add(error)
      model.holdEnd(held.index,model.root.worldToLocal(end));matrices()
    }
    held.moved ||= x!==held.x||y!==held.y
    const contact=project(loopFor(held.step).getWorldPosition(new THREE.Vector3())),goal=project(loopGoals[held.step]!.clone())
    return held.moved&&contact.distanceTo(goal)<=held.radius&&!touch.occluded(x,y,target,{ignore:model.root})
  }

  const directions: [number, number][] = [[0,-1],[1,0],[0,-1]]
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', destination:()=>guide(i),targetLabel:'绳环挂点', label: ACTIONS[i]!, anchor: model.anchors[i]!.toArray(), priority: 3, enabled: () => inputActive() && !motion && at<3 && i===carryStep() }))
  const touch = createTouchTarget(canvas, camera, scene), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const axes = (dx: number, dy: number) => directionalAxes(directions[at]!, dx, dy)
  const reset = () => { held=null; moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore(); updateDirectionalDragHint(ui.hintEl, false, HINTS[at===3?3:carryStep()]!, safe) }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return touch.hit(x, y, model.roots[at]!) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; down.set(x, y); previous.copy(down); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0;prepareEnd(x,y) },
    onMove(x,y){if(!Number.isFinite(x)||!Number.isFinite(y)){invalid=true;return}if(!invalid&&moveEnd(x,y)&&pointer.finish())advance(true)},
    onRelease(x,y){if(!invalid&&moveEnd(x,y))advance();else if(invalid||!insideCanvas(canvas,x,y))reset();else held=null }, onCancel: reset,
  })
  const sync = () => {
    if (motion || at === 3) delete ui.hintEl.dataset.ready
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at===0?0:at===3?2:1, 2); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[carryStep()]!, safe); setSafeText(ui.hintEl, motion ? MOVING[motion.step]! : HINTS[at===3?3:carryStep()]!, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore(); resize()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(accepted=false) { if (!inputActive() || (pointer.isBusy() && !accepted) || motion || at === 3) return; const step=carryStep() as 0|2; motion = { step, time: 0, from: loopFor(step).position.clone(), to: model.root.worldToLocal(loopGoals[step]!.clone()), support:model.temporarySupport.rotation.y }; held=null; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); if(!motion)reset(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    if(!motion){pointer.cancel();reset()}
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0,1.05,0), direction = new THREE.Vector3(.4,2.1,7).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 1.3
    const saved = amount, framed = [model.root]
    for (const [step,n] of [0,1,2].flatMap(step=>Array.from({length:41},(_,i)=>[step,i/40]))) {
      model.pose(step!,n!,false); matrices()
      framed.forEach(subject=>subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i=0;i<vertices.count;i++) { p.fromBufferAttribute(vertices,i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance=Math.max(distance,p.z+Math.abs(p.x)/(tangent*aspect*.84),p.z+Math.abs(p.y)/(tangent*.84)) }
      }))
    }
    pose(at,saved);camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);matrices()
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
      if (!active()) { lifecycleVersion++; pointer.cancel(); if(!motion)reset(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .32)
        const eased=ease(motion.time)
        const carrying=motion;pose(carrying.step,eased)
        model.holdEnd(carrying.step===0?0:1,carrying.from.clone().lerp(carrying.to,eased))
        if(carrying.step===2)model.temporarySupport.rotation.y=THREE.MathUtils.lerp(carrying.support,-Math.PI/2,eased)
        if (motion.time === 1) settle()
      }
      if (active()) { if (!ctx.isReducedMotion?.()) model.tick(delta); matrices(); lights.key.shadow.normalBias = .03; style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); model.flags.forEach(flag => flag.material.map?.dispose()); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
