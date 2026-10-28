import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createFreePlacementPointer } from '../free-placement-pointer'
import { setPlacementInspectionHelp } from '../placement-inspection'
import { createTouchTarget, insideCanvas } from '../touch-target'
import { addStageLights, CEL_STYLE, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createWagasaModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['推环展伞', '轻旋伞柄', '收伞留影']
const HINTS = [
 '沿伞轴把木环推到上方提示标记，撑杆带竹骨展开，纸面舒成一圈暖色。',
 '按住伞柄自由转动查看；也可直接沿伞轴把木环移到下方提示标记，收拢纸伞。',
 '沿伞轴把木环移到下方提示标记，竹骨缓缓收拢，纸面沿折痕合在一起。',
 '纸伞收拢，竹骨与纸褶相依，浅色的一面留住阳光里的轻影。',
]
const MOVING = ['木环升起，竹骨与纸面一起舒展……', '伞柄轻转，暖色纸面在阳光里换一个方向……', '木环降下，纸面沿着竹骨慢慢收拢……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createJapaneseWagasa(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number } | null = null
  let amount = 0, invalid = false, heldRail = false
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '纸伞舒晴', stepsAria: '纸伞步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'japanese-wagasa', label: '纸伞舒晴' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createWagasaModel(); scene.add(model.subject)
  const facing = new THREE.Vector3()
  const matrices = () => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    // The runner stays on the shaft. Keep its projected grab/limit marker on
    // the visible outer wall after inspection turns to the other side.
    model.spin.worldToLocal(camera.getWorldPosition(facing))
    const length=Math.hypot(facing.x,facing.z)
    if(length>.1)for(const i of[0,2]){const anchor=model.anchors[i]!;anchor[0]=facing.x/length*.085;anchor[2]=facing.z/length*.085}
  }
  const pose = (step: number, n: number) => { amount = n; model.pose(step===1?2:step,n); matrices() }
  const restore = (turn=0) => { model.spin.rotation.set(0,turn,0);pose(at,0) }
  const mechanismStep = (): 0 | 2 => at===0?0:2
  const limitPoints=model.targets.map((target,i)=>{model.pose(i,1);return model.spin.worldToLocal(target!.getWorldPosition(new THREE.Vector3()))})
  model.pose(0,0)
  const railGoal=(step:number)=>model.spin.localToWorld(limitPoints[step]!.clone().add(new THREE.Vector3(...model.anchors[step]!)))
  const railStart=new THREE.Vector2(),railPath=new THREE.Vector2()
  let railRadius=0
  const screenPoint=(point:THREE.Vector3)=>{const p=point.project(camera),r=canvas.getBoundingClientRect();return new THREE.Vector2(r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2)}
  const prepareRail=(x:number,y:number)=>{const a=screenPoint(model.targets[mechanismStep()]!.localToWorld(new THREE.Vector3(...model.anchors[mechanismStep()]!))),b=screenPoint(railGoal(mechanismStep()));railStart.set(x,y);railPath.copy(b).sub(a);railRadius=Math.min(22,railPath.length()*.42)}
  const moveRail=(x:number,y:number)=>{
    if(!insideCanvas(canvas,x,y))return false
    const n=THREE.MathUtils.clamp(new THREE.Vector2(x,y).sub(railStart).dot(railPath)/Math.max(railPath.lengthSq(),1e-9),0,1)
    pose(mechanismStep(),n)
    const contact=screenPoint(model.targets[mechanismStep()]!.localToWorld(new THREE.Vector3(...model.anchors[mechanismStep()]!))),goal=screenPoint(railGoal(mechanismStep()))
    return n>0 && contact.distanceTo(goal)<=railRadius && !touch.occluded(x,y,model.targets[mechanismStep()]!,{ignore:model.subject})
  }

  const removeCues = model.targets.map((target,i)=>addInteractionCue(target!,{kind:i===1?'rotate':'drag',...(i===1?{}:{destination:()=>railGoal(i),targetLabel:'伞环限位'}),label:i===1?HINTS[1]!:ACTIONS[i]!,anchor:model.anchors[i],priority:3,enabled:()=>inputActive()&&!motion&&at<3&&(i===0?at===0:at>0)}))
  const touch=createTouchTarget(canvas,camera,scene), previous=new THREE.Vector2()
  const reset=()=>{invalid=false;heldRail=false;if(!motion&&!disposed)restore();sync()}
  const turn=(dx:number)=>{if(at>0&&at<3&&Number.isFinite(dx)){model.spin.rotation.y+=dx*.012;matrices()}}
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer=createFreePlacementPointer(ui.hitLayer,canvas,{
    isActive:inputActive,
    canStart(x,y){if(motion||at===3||!Number.isFinite(x)||!Number.isFinite(y))return false;matrices();return touch.hit(x,y,at===0?model.runner:model.spin)},
    onStart(x,y){if(!prepareInput()){pointer.cancel();return};previous.set(x,y);invalid=false;heldRail=at===0||touch.hit(x,y,model.runner);if(heldRail)prepareRail(x,y)},
    onMove(x,y){
      if(!Number.isFinite(x)||!Number.isFinite(y)){invalid=true;return}
      if(heldRail){if(!invalid&&moveRail(x,y)&&pointer.finish())advance(true)}else turn(x-previous.x)
      previous.set(x,y)
    },
    onRelease(x,y){if(!insideCanvas(canvas,x,y)||invalid){reset();return}if(heldRail){if(moveRail(x,y))advance();else reset()}},
    onRotate(dx,dy){if(at>0){turn(dx);previous.x+=dx;previous.y+=dy}},
    onRebase(x,y){previous.set(x,y);if(heldRail)prepareRail(x,y)},
    onInspectEnd(){if(at===0||!insideCanvas(canvas,previous.x,previous.y))reset();else{heldRail=false;matrices()}},
    onCancel:reset,
  })
  const sync = () => {
    if (motion || at === 3) delete ui.hintEl.dataset.ready
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at===0?0:at<3?1:2,2); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[mechanismStep()]!, safe); setSafeText(ui.hintEl, motion ? MOVING[motion.step]! : (at>0&&at<3?HINTS[1]!:HINTS[at]!), safe)
    setPlacementInspectionHelp(ui.hintEl,!motion&&at>0&&at<3)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    const turn=model.spin.rotation.y;at=motion.step===0?2:3;motion=null;restore(turn)
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(accepted=false) { if (!inputActive() || (pointer.isBusy() && !accepted) || motion || at === 3) return; motion = { step: mechanismStep(), time: 0, from: amount }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); if(!motion)reset(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    if(started&&!motion){pointer.cancel();reset()}
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, 1.45, 0), direction = new THREE.Vector3(2.6, 1.75, 6.4).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const saved = amount, savedTurn=model.spin.rotation.y
    for (const [step, n] of [0,1,2].flatMap(step=>Array.from({length:21},(_,i)=>[step,i/20])).concat([[3,0]])) {
      pose(step!, n!)
      model.subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      })
    }
    pose(motion?.step??at,saved);model.spin.rotation.y=savedTurn; camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
  }
  const inspectKey=(event:KeyboardEvent)=>{
    if(!inputActive()||motion||pointer.isBusy()||at===0||at===3||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return
    if(event.key==='Escape'){event.preventDefault();reset();return}
    if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return
    event.preventDefault();if(prepareInput())turn(event.key==='ArrowLeft'?-20:20)
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); ui.actionBtn.addEventListener('keydown',inspectKey); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if(!motion)reset(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .85)
        const eased=ease(motion.time)
        pose(motion.step, motion.from+(1-motion.from)*eased); if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action); ui.actionBtn.removeEventListener('keydown',inspectKey)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.subject); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
