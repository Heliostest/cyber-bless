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
import { createVasilopitaModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['托起家人这一份', '送到家人盘里', '取出糕中的硬币']
const HINTS = ["握住糕铲柄，把家人这一份托到上方提示位置。","握住糕铲柄，挪到家人盘中的提示范围，让新年糕轻轻落盘。","握住切面里的硬币，挪到盘边的提示范围，轻轻收好。","这一份里藏着硬币。愿家人在新年里健康安好。"]
const MOVING = ['托起切好的新年糕……', '把这一份送到家人盘里……', '从切面取出硬币，放在盘边……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createVasilopita(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number; placed?: boolean } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '新岁分糕', stepsAria: '新岁分糕步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'greek-vasilopita', label: '新岁分糕' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [4, 5, -3], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createVasilopitaModel(); scene.add(model.root)
  const placement = createPosePlacement(canvas, camera, { ...model, roots: [model.server, model.server, model.coin], anchors: model.anchors.map(a => a.toArray() as [number,number,number]) }, scene, { destination: (step, goal) => step === 1 ? goal.sub(new THREE.Vector3(0, -.020, .86)) : goal }), spatialSteps = new Set([0,1,2])
  const heldSlice = new THREE.Vector3(), heldSliceRotation = new THREE.Quaternion(), sliceIdentity = new THREE.Quaternion()
  const transportSlice = (before: THREE.Matrix4) => {
    if (at >= 2) return
    model.server.updateWorldMatrix(true,false); model.slice.updateWorldMatrix(true,false)
    const next = model.server.matrixWorld.clone().multiply(before.invert()).multiply(model.slice.matrixWorld)
    if (model.slice.parent) next.premultiply(model.slice.parent.matrixWorld.clone().invert())
    next.decompose(model.slice.position,model.slice.quaternion,model.slice.scale); model.slice.updateWorldMatrix(true,true)
  }
  const movePlacement = (x: number, y: number) => {
    const previous = model.server.matrixWorld.clone(), ready = placement.move(x, y)
    transportSlice(previous)
    model.root.updateMatrixWorld(true)
    return ready
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const canonicalRotations = model.roots.map(root => root.quaternion.clone())
  const restore = () => {  model.roots.forEach((root,i) => root.quaternion.copy(canonicalRotations[i]!)); model.slice.quaternion.identity(); pose(at, 0) ; placement.restoreCheckpoint(at); matrices() }
  const freePlacementStep = (step: number) => step === 0 || step === 1
  const placementStep = (step: number): 0 | 1 | 2 => step < 2 ? 1 : 2
  const placementHint = () => HINTS[at === 3 ? 3 : placementStep(at)]!
  const placementAction = () => ACTIONS[placementStep(at)]!
  const directions: [number, number][] = [[0,-1],[1,0],[0,1]]
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', ...(spatialSteps.has(i) ? { destination: () => placement.destination(placementStep(i)), targetLabel: '挪到这里' } : { direction: directions[i] }), label: ACTIONS[i]!, anchor: model.anchors[i]!.toArray(), priority: 3, enabled: () => inputActive() && !motion && at < 3 && placementStep(at) === i }))
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const axes = (dx: number, dy: number) => directionalAxes(directions[at]!, dx, dy)
  const reset = () => { placement.cancel(); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore(); updateDirectionalDragHint(ui.hintEl, false, HINTS[at]!, safe) }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const inspectRotate = (dx:number,dy:number) => { if (freePlacementStep(at)) { const before = model.server.matrixWorld.clone(); placement.rotate(dx*.012,dy*.012); transportSlice(before) } }
  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); const hit = nearest(x, y); return !!hit && (hit === model.roots[at] || model.roots[at]!.getObjectById(hit.id) === hit) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; down.set(x, y); previous.copy(down); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (spatialSteps.has(at) && !placement.begin(placementStep(at), x, y)) pointer.cancel() },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if (spatialSteps.has(at)) { if (!invalid && movePlacement(x, y) && pointer.finish()) { heldSlice.copy(model.slice.position); heldSliceRotation.copy(model.slice.quaternion); placement.capture(); advance(true) }; return }
      pathTravel += Math.hypot(x - previous.x, y - previous.y); previous.set(x, y)
      const [a, cross] = axes(x - down.x, y - down.y); along = a!; moved = true
      maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along); maxCross = Math.max(maxCross, Math.abs(cross!))
      // Held input previews the current motion; valid release completes the placement.
      pose(at, THREE.MathUtils.clamp(along / 60, 0, 1) * .20)
      updateDirectionalDragHint(ui.hintEl, !invalid && completesDirectionalDrag({ along, end: along, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel: pathTravel }), HINTS[at]!, safe)
    },
    onRelease(x, y) {
      if (spatialSteps.has(at)) { if (!invalid && movePlacement(x, y)) { heldSlice.copy(model.slice.position); heldSliceRotation.copy(model.slice.quaternion); placement.capture(); advance(true) } else if (!invalid && insideCanvas(canvas,x,y) && freePlacementStep(at)) placement.release(); else reset(); return }
      const [end, cross] = axes(x - down.x, y - down.y), travel = pathTravel + Math.hypot(x - previous.x, y - previous.y)
      const valid = !invalid && moved && completesDirectionalDrag({ along, end: end!, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel })
      if (valid) advance(); else reset()
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
    placement.settle(1); placement.cancel(); at = (motion.step + 1) as Checkpoint; motion = null; restore(); resize()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][at-1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(placed = false) { if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === 3) return; motion = { step: placementStep(at), time: 0, from: amount, placed }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if (at < 3) { heldSlice.copy(model.slice.position); heldSliceRotation.copy(model.slice.quaternion); placement.capture(placementStep(at)); advance(true) } else advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); if (!motion) reset(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    if (started && !motion) { pointer.cancel(); reset() }
    const close = at >= 2
    const aspect = sizeStage(canvas, renderer, style, camera), target = close ? new THREE.Vector3(.80,.65,.23) : new THREE.Vector3(.02,.71,.26), direction = (close ? new THREE.Vector3(6,3.5,-3.46) : new THREE.Vector3(6,5,5)).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = close ? .8 : 1.5
    const saved = amount
    const framed = close ? [model.slice] : [model.cake,model.slice,model.server,model.platter,model.familyPlate]
    for (const [step, n] of (close ? [2] : [0,1]).flatMap(step=>Array.from({length:61},(_,i)=>[step,i/60]))) {
      pose(step!, n!)
      framed.forEach(subject=>subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      }))
    }
    pose(at, saved); camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
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
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.placed ? .28 : .85))
        const eased=ease(motion.time)
        pose(motion.step, motion.from+(1-motion.from)*eased); placement.settle(eased)
        if (motion.placed && motion.step < 2) {
          const serve = THREE.MathUtils.clamp(eased/.65,0,1)
          model.slice.position.lerpVectors(heldSlice,model.served.clone().add(new THREE.Vector3(0,.008,0)),serve)
          if(eased>.65)model.slice.position.y=THREE.MathUtils.lerp(model.served.y+.008,model.served.y,(eased-.65)/.35)
          model.slice.quaternion.slerpQuaternions(heldSliceRotation,sliceIdentity,serve)
          // First carry the supported portion to the plate, then withdraw the
          // server along its existing authored path instead of through the cake.
          const bladeEnd=model.served.clone().add(new THREE.Vector3(0,-.020,.86)),withdraw=THREE.MathUtils.clamp((eased-.65)/.35,0,1)
          if(eased<=.65)model.server.position.copy(model.slice.position)
          else model.server.position.lerpVectors(model.served.clone().add(new THREE.Vector3(0,.008,0)),bladeEnd,withdraw)
        }
        matrices(); if (motion.time === 1) settle()
      }
      if (active()) { matrices(); lights.key.shadow.normalBias = .03; style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopInspection(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
