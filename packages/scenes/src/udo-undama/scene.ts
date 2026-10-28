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
import { createUndamaModel } from './model'
import { createStylizedWater } from '@wbr/scene-runtime/stylized-water'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['取起陶玉', '对准岩凹', '投向岩凹']
const HINTS = [
 '按住陶玉向上短拖，把它从石边取起。',
 '按住陶玉向右短拖，朝向岩上的方形凹处。',
 '按住陶玉向上短拖后松手，向岩凹投出。',
 '陶玉落在岩上的凹处，海面映着明亮的日光。',
]
const CARRY_HINT = '拿起陶玉，可自由转动查看，再移到投掷提示位置。'
const MOVING = ['陶玉离开石边……', '陶玉朝向岩上的方凹……', '陶玉划过海面，落向岩凹……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createUdoUndama(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING, CARRY_HINT].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number; arrived?: boolean } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '龟岩投愿', stepsAria: '海边投愿步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'udo-undama', label: '龟岩投愿' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createUndamaModel(); scene.add(model.root)
  const water=createStylizedWater({geometry:new THREE.PlaneGeometry(60,60).rotateX(-Math.PI/2),normal:'y',depth:.24,color:0x69b6c6,bedColor:0x9ab8ad,opacity:.55,causticScale:2.4,waveScale:.8});water.surface.position.set(0,-.04,-12);scene.add(water.surface)
  const placement = createPosePlacement(canvas,camera,model,scene)
  const freePlacementStep = () => at < 2
  const placementStep = (): 1 | 2 => at < 2 ? 1 : 2
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const restore = () => { pose(at,0); placement.restoreCheckpoint(at); matrices() }
  const directions: [number, number][] = [[0,-1],[1,0],[0,-1]]
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', ...(i<2?{destination:()=>placement.destination(1),targetLabel:'当前安放位置'}:{direction:directions[i]}), label: ACTIONS[i]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at < 3 && placementStep() === i }))
  const touch = createTouchTarget(canvas, camera, scene), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const axes = (dx: number, dy: number) => directionalAxes(directions[at]!, dx, dy)
  const reset = () => { placement.cancel(); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore(); delete ui.hintEl.dataset.ready;sync() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return touch.hit(x, y, model.roots[at]!) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; down.set(x, y); previous.copy(down); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if(freePlacementStep()) placement.begin(1,x,y) },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if(freePlacementStep()){previous.set(x,y);if(!invalid&&placement.move(x,y)&&pointer.finish()){placement.capture();advance(true)};return}
      pathTravel += Math.hypot(x - previous.x, y - previous.y); previous.set(x, y)
      const [a, cross] = axes(x - down.x, y - down.y); along = a!; moved = true
      maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along); maxCross = Math.max(maxCross, Math.abs(cross!))
      // Held input only winds the ball back; flight begins after an accepted release.
      pose(at, THREE.MathUtils.clamp(along / 60, 0, 1) * (at === 2 ? .25 : .6))
      updateDirectionalDragHint(ui.hintEl, !invalid && completesDirectionalDrag({ along, end: along, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel: pathTravel }), HINTS[at]!, safe)
    },
    onRelease(x, y) {
      if(freePlacementStep()){if(!invalid&&insideCanvas(canvas,x,y)&&placement.move(x,y)){placement.capture();advance(true)}else if(!invalid&&insideCanvas(canvas,x,y))placement.release();else reset();return}
      const [end, cross] = axes(x - down.x, y - down.y), travel = pathTravel + Math.hypot(x - previous.x, y - previous.y)
      const valid = !invalid && moved && completesDirectionalDrag({ along, end: end!, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel })
      if (valid) advance(); else reset()
    }, onRotate(dx,dy) { previous.x+=dx;previous.y+=dy;if(freePlacementStep())placement.rotate(dx*.012,dy*.012) },
    onRebase(x,y) { previous.set(x,y);if(freePlacementStep())placement.rebase(x,y);else reset() },
    onInspectEnd() { if(freePlacementStep()&&insideCanvas(canvas,previous.x,previous.y))placement.release();else reset() },
    onCancel: reset,
  })
  const sync = () => {
    if (motion || at === 3) delete ui.hintEl.dataset.ready
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at<2?0:at===2?1:2,2); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[placementStep()]!, safe); setPlacementHint(ui.hintEl,motion?MOVING[motion.step]!:freePlacementStep()?CARRY_HINT:HINTS[at]!,!motion&&freePlacementStep(),safe)
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
  function advance(arrived=false) { if (!inputActive() || (pointer.isBusy()&&!arrived) || motion || at === 3) return; motion = { step: placementStep(), time: 0, from: amount, arrived }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if(freePlacementStep()){placement.capture(1);advance(true)}else advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); if(!motion)reset(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    if(started&&!motion){pointer.cancel();reset()}
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(.05, .80, .25), direction = new THREE.Vector3(2.1, 7.5, 7).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const saved = amount, savedPosition=model.ball.position.clone(),savedRotation=model.ball.quaternion.clone()
    for (const [step, n] of [0,1,2].flatMap(step=>Array.from({length:61},(_,i)=>[step,i/60])).concat([[3,0]])) {
      pose(step!, n!)
      model.subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      })
    }
    amount=saved;model.ball.position.copy(savedPosition);model.ball.quaternion.copy(savedRotation); camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
  }
  const stopInspection=addKeyboardPlacementInspection(ui.actionBtn,canvas,camera,model,placement,{isActive:()=>inputActive()&&!motion&&freePlacementStep()&&!pointer.isBusy(),step:()=>1,prepare:prepareInput,reset})
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
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.arrived?.32:.85))
        const eased=ease(motion.time)
        pose(motion.step, motion.from+(1-motion.from)*eased); placement.settle(eased); if (motion.time === 1) settle()
      }
      if (active()) { water.update(delta,ctx.isReducedMotion?.()??false); matrices(); lights.key.shadow.normalBias = .03; style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopInspection(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); water.dispose(); model.stamp.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
