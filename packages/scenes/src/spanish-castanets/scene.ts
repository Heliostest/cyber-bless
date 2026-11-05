import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { completesDirectionalDrag, updateDirectionalDragHint } from '../directional-drag'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createCastanetsModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
type Side = 0 | 1
const ACTIONS = ['左壳轻合', '右壳回应']
const HINTS = [
  '轻点左侧木壳，或向下轻压后松开，让两片凹壳相碰。',
  '轻点右侧木壳，或向下轻压后松开，听另一副响板回应。',
  '左右木壳可以分别轻点、快速交替；想收尾时点「结束仪式」。',
  '木壳轻轻张开，细绳留住两片弧面，节拍留在明亮的草地边。',
]

export function createSpanishCastanets(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let guidedClickOwner: EventTarget | null = null
  const closures: [number, number] = [0, 0], rebounds: [number, number] = [0, 0]
  let held: Side | null = null, candidate: Side | null = null
  let invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '木壳轻拍', stepsAria: '响板步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.classList.add('scene-inspection-action')
  const rightButton = document.createElement('button'); rightButton.type = 'button'; rightButton.className = 'scene-bow-tap scene-castanets-right scene-inspection-action'
  setSafeText(rightButton, ACTIONS[1]!, safe)
  const sideButtons = document.createElement('div'); sideButtons.className = 'scene-castanets-buttons'
  Object.assign(sideButtons.style, { gridArea: 'action', gridColumn: '3', justifySelf: 'end', position: 'relative', gap: '4px' })
  for (const button of [ui.actionBtn, rightButton]) {
    Object.assign(button.style, { minWidth: '44px', minHeight: '44px', position: 'static', transform: 'none', marginTop: '10px', paddingInline: '8px' })
    sideButtons.append(button)
  }
  overlay.append(sideButtons)
  const finishButton = document.createElement('button'); finishButton.type = 'button'; finishButton.className = 'scene-castanets-finish scene-bow-tap scene-continuous-finish'
  setSafeText(finishButton, '结束仪式', safe); overlay.append(finishButton)
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'spanish-castanets', label: '木壳轻拍' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createCastanetsModel(); scene.add(model.subject)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const applyPose = () => { model.poseClosures(...closures); matrices() }
  const restore = () => { closures.fill(0); rebounds.fill(0); held = candidate = null; applyPose() }
  const sideEnabled = (side: Side) => at === 2 || at === side
  const removeCues = model.upper.map((target, side) => addInteractionCue(target, { kind: 'tap', label: ACTIONS[side]!, anchor: [0,.30,.30], priority: 3, enabled: () => inputActive() && sideEnabled(side as Side) }))
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const belongs = (o: THREE.Object3D, side: Side) => o === model.pairs[side] || model.pairs[side]!.getObjectById(o.id) === o
  const pickSide = (x: number, y: number): Side | null => {
    if (at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return null
    matrices()
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    const hit = ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
    if (hit) { for (const side of [0,1] as const) if (belongs(hit, side)) return sideEnabled(side) ? side : null; return null }
    // Padding follows the whole pair, including its moving upper shell. It
    // never reaches through another opaque object, and is at least 48px wide.
    const rect = canvas.getBoundingClientRect(), point = new THREE.Vector3()
    let found: Side | null = null, nearest = Infinity
    for (const side of [0,1] as const) {
      if (!sideEnabled(side)) continue
      const box = new THREE.Box3().setFromObject(model.pairs[side]!), bounds = new THREE.Box2()
      for (const px of [box.min.x,box.max.x]) for (const py of [box.min.y,box.max.y]) for (const pz of [box.min.z,box.max.z]) {
        point.set(px,py,pz).project(camera); bounds.expandByPoint(new THREE.Vector2(rect.left+(point.x+1)*rect.width/2,rect.top+(1-point.y)*rect.height/2))
      }
      const center = bounds.getCenter(new THREE.Vector2()), size = bounds.getSize(new THREE.Vector2())
      const padX = Math.max(10,(48-size.x)/2), padY = Math.max(10,(48-size.y)/2)
      if (x < bounds.min.x-padX || x > bounds.max.x+padX || y < bounds.min.y-padY || y > bounds.max.y+padY) continue
      const distance = Math.hypot(x-center.x,y-center.y)
      if (distance < nearest) { nearest = distance; found = side }
    }
    return found
  }
  const reset = () => {
    if (held !== null) { closures[held] = 0; rebounds[held] = 0 }
    held = candidate = null; invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0
    if (!disposed) { applyPose(); updateDirectionalDragHint(ui.hintEl, false, HINTS[at]!, safe) }
  }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { candidate = pickSide(x,y); return candidate !== null },
    onStart(x, y) {
      const selected = candidate
      if (selected === null || !prepareInput()) { pointer.cancel(); return }
      held = selected; rebounds[selected] = 0; closures[selected] = 0; down.set(x,y); previous.copy(down)
      invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; applyPose()
    },
    onMove(x, y) {
      if (held === null) return
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      pathTravel += Math.hypot(x-previous.x,y-previous.y); previous.set(x,y)
      along = y-down.y; const cross = x-down.x
      maxAlong = Math.max(maxAlong,along); minAlong = Math.min(minAlong,along); backtrack = Math.max(backtrack,maxAlong-along); maxCross = Math.max(maxCross,Math.abs(cross))
      closures[held] = ctx.isReducedMotion?.() ? 0 : THREE.MathUtils.clamp(along/60,0,.95); applyPose()
      updateDirectionalDragHint(ui.hintEl, !invalid && completesDirectionalDrag({ along, end: along, maxAlong, minAlong, backtrack, maxCross, cross, travel: pathTravel }), HINTS[at]!, safe)
    },
    onRelease(x, y) {
      const side = held, end = y-down.y, cross = x-down.x, travel = pathTravel + Math.hypot(x-previous.x,y-previous.y)
      const tap = travel <= 10 && Math.hypot(cross,end) <= 8
      const squeeze = completesDirectionalDrag({ along, end, maxAlong, minAlong, backtrack, maxCross, cross, travel })
      if (side !== null && !invalid && (tap || squeeze)) { held = null; contact(side) } else reset()
    },
    onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); sideButtons.style.display = at === 3 ? 'none' : 'flex'
    ui.actionBtn.hidden = at === 3; rightButton.hidden = at !== 2
    // Reentry is guarded by handlers. Disabling a focused button for the
    // duration of a synchronous callback would discard keyboard focus.
    for (const button of [ui.actionBtn,rightButton,finishButton]) { button.disabled = !active() || at === 3; button.setAttribute('aria-disabled',String(button.disabled)) }
    finishButton.hidden = at !== 2
    ui.hitLayer.style.pointerEvents = inputActive() && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[at === 1 ? 1 : 0]!, safe); setSafeText(ui.hintEl, HINTS[at]!, safe)
    delete ui.hintEl.dataset.ready
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function contact(side: Side) {
    if (!inputActive() || pointer.isBusy() || !sideEnabled(side)) return
    closures[side] = ctx.isReducedMotion?.() ? 0 : 1; rebounds[side] = closures[side]; applyPose()
    const changed = at < 2
    if (changed) at = (at+1) as Checkpoint
    withHostCallbacks(() => {
      if (changed) ctx.onProgress?.(at)
      if (!callbackActive()) return
      feedback.impact()
      if (callbackActive()) feedback.sound('woodTap', { duration: .10, strength: side === 0 ? .48 : .58 })
    })
  }
  const finish = (event: MouseEvent) => {
    if (event.detail > 1 || !inputActive() || pointer.isBusy() || at !== 2 || !prepareInput()) return
    at = 3; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(3); if (!callbackActive()) return
      feedback.impact(); if (!callbackActive()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const buttonBeat = (side: Side, event: MouseEvent) => {
    // Native click counts identify the old button's remaining sequence even
    // after its guided-right label becomes the free-play left action. A new
    // sequence (detail 1), keyboard activation (0), or the other stable button
    // can start free play immediately, without imposing a rhythm timer.
    if ((event.detail > 1 && (at < 2 || event.currentTarget === guidedClickOwner)) || !inputActive() || pointer.isBusy() || !sideEnabled(side) || !prepareInput()) return
    guidedClickOwner = at < 2 && event.detail > 0 ? event.currentTarget : null
    contact(side)
  }
  const action = (event: MouseEvent) => buttonBeat(at === 1 ? 1 : 0,event)
  const rightAction = (event: MouseEvent) => buttonBeat(1,event)
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); restore(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0,.55,0), direction = new THREE.Vector3(1.5,4.6,6.2).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov/2)), p = new THREE.Vector3(); let distance = 3.4
    for (const left of [0,.5,1]) for (const right of [0,.5,1]) {
      model.poseClosures(left,right)
      model.subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i=0;i<vertices.count;i++) { p.fromBufferAttribute(vertices,i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance,p.z+Math.abs(p.x)/(tangent*aspect*.86),p.z+Math.abs(p.y)/(tangent*.86)) }
      })
    }
    applyPose(); camera.position.copy(target).addScaledVector(direction,distance); camera.lookAt(target); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial),0,3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click',action); rightButton.addEventListener('click',rightAction); finishButton.addEventListener('click',finish)
      window.addEventListener('blur',blur); window.addEventListener('focus',focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!suspended) { suspended = true; restore(); sync() }; feedback.update(); return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt,0,.05) : 0
      let changed = false
      for (const side of [0,1] as const) if (rebounds[side] > 0 && held !== side) {
        rebounds[side] = ctx.isReducedMotion?.() ? 0 : Math.max(0,rebounds[side]-delta/.18)
        const t = rebounds[side]; closures[side] = t*t*(3-2*t); changed = true
      }
      if (changed) applyPose()
      feedback.update(); if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove())
      ui.actionBtn.removeEventListener('click',action); rightButton.removeEventListener('click',rightAction); finishButton.removeEventListener('click',finish)
      guardedEvents.forEach(type => { window.removeEventListener(type,guardCallbackInput,true); ui.hitLayer.removeEventListener(type,guardCallbackInput,true) })
      window.removeEventListener('blur',blur); window.removeEventListener('focus',focus); style.dispose(); disposeTree(model.subject); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay','scene-overlay--stage')
    },
  }
}
