import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createPosePlacement } from '../pose-placement'
import { createTouchTarget } from '../touch-target'
import { completesDirectionalDrag, directionalAxes, updateDirectionalDragHint } from '../directional-drag'
import { addStageLights, CEL_STYLE, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createSteelyardModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['移砣找平', '轻提秤杆', '缓放停稳']
const HINTS = [
 '沿木杆移动完整秤砣，对准提示标记，让木杆慢慢找平。',
 '握住上方提环，将整秤提到提示标记处。',
 '握住上方提环，将整秤放回提示标记处，靠近后会停稳。',
 '秤杆平稳，柑橘安放在浅盘中，细绳与金属留下柔和的影子。',
]
const MOVING = ['秤砣沿木杆移动，两端慢慢找平……', '提环升起，木杆与悬盘轻轻上移……', '木杆与浅盘缓缓下移，回到平稳的位置……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createChineseSteelyard(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number; placed?: boolean; heldPosition?: THREE.Vector3; heldQuaternion?: THREE.Quaternion } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '移砣平衡', stepsAria: '杆秤步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'chinese-steelyard', label: '移砣平衡' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createSteelyardModel(); scene.add(model.root)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const restore = () => pose(at, 0)
  const placementRoots=[model.weight,model.root,model.root],placementAnchors=model.anchors
  const isPlacementStep=(step:number)=>step>0
  const placement=createPosePlacement(canvas,camera,{pose:model.pose,roots:placementRoots,targets:model.targets,anchors:placementAnchors},scene)
  const railFrom=new THREE.Vector2(),railPath=new THREE.Vector2()
  let railRadius=0
  const screenPoint=(value:THREE.Vector3)=>{const p=value.project(camera),r=canvas.getBoundingClientRect();return new THREE.Vector2(r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2)}
  const prepareRail=(x:number,y:number)=>{const a=screenPoint(model.targets[0]!.localToWorld(new THREE.Vector3(...placementAnchors[0]!))),b=screenPoint(placement.destination(0));railFrom.set(x,y);railPath.copy(b).sub(a);railRadius=Math.min(22,railPath.length()*.42)}
  const moveRail=(x:number,y:number)=>{const n=THREE.MathUtils.clamp(new THREE.Vector2(x,y).sub(railFrom).dot(railPath)/Math.max(railPath.lengthSq(),1e-9),0,1);pose(0,n);const a=screenPoint(model.targets[0]!.localToWorld(new THREE.Vector3(...placementAnchors[0]!))),b=screenPoint(placement.destination(0));return n>0 && a.distanceTo(b)<=railRadius}
  const directions: [number, number][] = [[1,0],[0,-1],[0,1]]
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', ...(isPlacementStep(i) || i===0 ? {destination:()=>placement.destination(i),targetLabel:'靠近后停稳'} : {direction:directions[i]}), label: ACTIONS[i]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at === i }))
  const touch = createTouchTarget(canvas, camera, scene), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const axes = (dx: number, dy: number) => directionalAxes(directions[at]!, dx, dy)
  const reset = () => { placement.cancel(); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore(); updateDirectionalDragHint(ui.hintEl, false, HINTS[at]!, safe) }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return touch.hit(x, y, model.roots[at]!) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; down.set(x, y); previous.copy(down); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0 ; if(isPlacementStep(at) && !placement.begin(at,x,y))pointer.cancel(); if(at===0)prepareRail(x,y); },
    onMove(x, y) {if(!Number.isFinite(x)||!Number.isFinite(y)){invalid=true;return}if(at===0){if(!invalid&&moveRail(x,y)&&pointer.finish())advance(true)}else if(!invalid&&placement.move(x,y)&&pointer.finish()){placement.capture();advance(true)}},
    onRelease(x, y) {if(at===0){if(!invalid&&moveRail(x,y))advance();else reset()}else if(!invalid&&placement.move(x,y)){placement.capture();advance()}else reset()}, onCancel: reset,
  })
  const sync = () => {
    if (motion || at === 3) delete ui.hintEl.dataset.ready
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[Math.min(at, 2)]!, safe); setSafeText(ui.hintEl, motion ? MOVING[motion.step]! : HINTS[at]!, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    if (motion.placed && isPlacementStep(motion.step)) placement.settle(1)
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(placed=false) { if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === 3) return; motion = { step: at, time: 0, from: amount,placed,heldPosition:placed?placementRoots[at]!.position.clone():undefined,heldQuaternion:placed?placementRoots[at]!.quaternion.clone():undefined }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(.4, 1.45, 0), direction = new THREE.Vector3(3.2, 3.6, 7.4).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const saved = amount
    for (const [step, n] of [0,1,2].flatMap(step=>Array.from({length:61},(_,i)=>[step,i/60])).concat([[3,0]])) {
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
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.placed?.32:.85))
        const eased=ease(motion.time)
        pose(motion.step, motion.from+(1-motion.from)*eased); if(motion.placed && isPlacementStep(motion.step))placement.settle(eased); if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
