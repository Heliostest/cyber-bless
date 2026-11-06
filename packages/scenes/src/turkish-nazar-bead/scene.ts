import { insideCanvas } from '../touch-target'
import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue, bindSceneAttribute } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createFreePlacementPointer } from '../free-placement-pointer'
import { createCloseInspection } from '../close-inspection'
import { createPosePlacement } from '../pose-placement'
import { addKeyboardPlacementInspection, setPlacementHint } from '../placement-inspection'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createTurkishNazarBeadModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['提起蓝珠', '移向挂架', '落环悬稳']
const HINTS = [
 '土耳其护眼珠寄托避厄护佑的心意。拿住蓝珠，从陶托提到提示的位置。',
 '拿住蓝珠，把金属挂环移到木架横轴上方的提示位置。',
 '托住蓝珠，把挂环放低到横轴上，到位会自动悬稳。',
 '蓝珠已悬好。愿你与所爱的人平安顺遂。',
]
const MOVING = ['从陶托提起备好的护眼珠……', '整体移向木架，让横轴穿过挂环……', '挂环缓缓落稳，留一份日常护佑的心意……']
const CARRY_HINT = '土耳其护眼珠寄托避厄护佑的心意。拿起蓝珠，可自由转动查看，再将挂环送到木架横轴上挂稳。'
const PLAY_HINT = '挂件已悬稳。轻拨可让它摆动，拖动可微调朝向，准备好后结束欣赏。'
const PLAY_HELP = '单指拖动微调朝向；点按「结束欣赏」收尾。'
const ease = (t: number) => t * t * (3 - 2 * t)

export function createTurkishNazarBead(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING,CARRY_HINT].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number; arrived?: boolean } | null = null
  let amount = 0, invalid = false, heldHanging = false, gestureMoved = false, handoffPending = false
  let yaw = 0, committedYaw = 0, sway = 0, speed = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '蓝珠祈安', stepsAria: '蓝珠祈安步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const flickBtn = document.createElement('button'); flickBtn.type = 'button'; flickBtn.className = 'scene-bow-tap scene-hanging-flick scene-inspection-action'
  flickBtn.style.minWidth = '44px'; flickBtn.style.minHeight = '44px'
  setSafeText(flickBtn, '轻拨挂件', safe); overlay.append(flickBtn)
  ;[PLAY_HINT, PLAY_HELP, '结束欣赏'].forEach(safe)
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'turkish-nazar-bead', label: '蓝珠祈安' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createTurkishNazarBeadModel(); scene.add(model.root)
  let closeInspection: ReturnType<typeof createCloseInspection> | undefined
  const canPlace = () => closeInspection?.canPlace() ?? false
  const placement = createPosePlacement(canvas, camera, model, scene)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  // The local contact point stays on the actual upper peg/branch surface.
  const contact = new THREE.Vector3(...[0,.7955,0]), home = new THREE.Vector3(...[.37,1.02,.42])
  const hangingPose = () => {
    const actor = model.charm
    actor.quaternion.setFromEuler(new THREE.Euler(sway, yaw, 0))
    actor.position.copy(home).add(contact).sub(contact.clone().applyQuaternion(actor.quaternion)); matrices()
  }
  const restore = () => { const step = at >= 2 ? 3 : at; pose(step, 0); placement.restoreCheckpoint(step); if (at === 2) hangingPose(); matrices() }
  const removeCues = [addInteractionCue(model.targets[2]!, { kind: 'drag', destination: () => placement.destination(2), targetLabel: '当前安放位置', label: ACTIONS[2]!, anchor: model.anchors[2], priority: 3, enabled: () => inputActive() && canPlace() && !motion && at < 2 })]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const reset = () => { placement.cancel(); invalid = false; heldHanging = false; yaw = committedYaw; sway = speed = 0; if (!motion && !disposed) restore(); if (!disposed) sync() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const turnHanging = (dx: number, dy: number) => {
    yaw = THREE.MathUtils.clamp(yaw + dx * .009, -.45, .45)
    sway = THREE.MathUtils.clamp(sway + dy * .003, -.12, .12); speed = 0; gestureMoved = true
    hangingPose()
  }
  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: () => inputActive() && canPlace() && !handoffPending,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); const hit = nearest(x, y); return !!hit && (hit === model.roots[Math.min(at,2)] || model.roots[Math.min(at,2)]!.getObjectById(hit.id) === hit) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x,y); previous.copy(down); invalid = gestureMoved = false
      if (at === 2) { heldHanging = true; speed = 0; return }
      if (!placement.begin(2,x,y)) pointer.cancel()
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if (at === 2) { turnHanging(x-previous.x,y-previous.y); previous.set(x,y); return }
      if (!invalid && placement.move(x,y) && pointer.finish()) { placement.capture(); advance(true) }
    },
    onRelease(x, y) {
      if (at === 2) {
        if (!insideCanvas(canvas,x,y)) { reset(); return }
        heldHanging = false; committedYaw = yaw
        if (!gestureMoved) flick(true)
        else if (ctx.isReducedMotion?.()) { sway = speed = 0; hangingPose() }
        return
      }
      const valid = !invalid && placement.move(x,y)
      if (valid) { placement.capture(); advance(true) }
      else if (invalid || !insideCanvas(canvas,x,y)) reset()
      else placement.release()
    },
    onCancel: reset,
    onRotate(dx,dy) { if (at === 2) turnHanging(dx,dy); else placement.rotate(dx*.012,dy*.012) },
    onRebase(x,y) { if (at === 2) previous.set(x,y); else placement.rebase(x,y) },
    onInspectEnd() { if (at === 2) { heldHanging = false; committedYaw = yaw; if (ctx.isReducedMotion?.()) { sway = speed = 0; hangingPose() } } else placement.release() },
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || handoffPending || at === 3
    ui.actionBtn.classList.toggle('scene-continuous-finish', at === 2)
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    ui.hitLayer.style.pointerEvents = inputActive() && !motion && !handoffPending && at < 3 ? 'auto' : 'none'
    flickBtn.hidden = at !== 2; flickBtn.disabled = !inputActive() || !!motion || handoffPending
    flickBtn.setAttribute('aria-disabled', String(flickBtn.disabled))
    setSafeText(ui.actionBtn, at === 2 ? '结束欣赏' : ACTIONS[2]!, safe)
    setPlacementHint(ui.hintEl, motion ? MOVING[2]! : at === 3 ? HINTS[3]! : at === 2 ? PLAY_HINT : CARRY_HINT, !motion && at < 2, safe)
    closeInspection?.decorate(at >= 2)
    if (at >= 2) { ui.renderDots(at === 3 ? 3 : 2, 3); bindSceneAttribute(ui.actionBtn, 'title', PLAY_HELP) }
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = 2; motion = null; handoffPending = true; committedYaw = yaw = sway = speed = 0; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(2); if (!callbackActive()) return
      feedback.impact({ freqs: [440], duration: .09, gain: .003, type: 'sine' })
    })
  }
  function advance(placed = false) {
    if (!inputActive() || (pointer.isBusy() && !placed) || motion || at >= 2) return
    motion = { step: 2, time: 0, from: amount, arrived: placed }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  function flick(prepared = false) {
    if (!inputActive() || at !== 2 || handoffPending || motion || (!prepared && (pointer.isBusy() || !prepareInput()))) return
    if (!ctx.isReducedMotion?.()) speed = THREE.MathUtils.clamp(speed + .65, -.95, .95)
    withHostCallbacks(() => feedback.impact({ freqs: [659.25], duration: .045, gain: .0015, type: 'sine' }))
  }
  const flickAction = () => flick()
  const action = (event: MouseEvent) => {
    if (event.detail > 1 || !inputActive() || !canPlace() || handoffPending || pointer.isBusy() || motion || at === 3 || !prepareInput()) return
    if (at === 2) {
      at = 3; heldHanging = false; yaw = committedYaw = sway = speed = 0; restore()
      withHostCallbacks(() => {
        ctx.onProgress?.(3); if (!callbackActive()) return
        feedback.impact({ freqs: [440], duration: .09, gain: .003, type: 'sine' })
        if (callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
      })
    } else { placement.capture(2); advance(true) }
  }
  const playKeyboard = (event: KeyboardEvent) => {
    if (at !== 2 || !inputActive() || handoffPending || pointer.isBusy() || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
    const turns: Record<string,[number,number]> = { ArrowLeft: [-12,0], ArrowRight: [12,0], ArrowUp: [0,-12], ArrowDown: [0,12] }
    if (event.key === 'Escape') { event.preventDefault(); committedYaw = yaw = sway = speed = 0; hangingPose(); return }
    const turn = turns[event.key]; if (!turn) return
    event.preventDefault(); if (!prepareInput()) return
    turnHanging(...turn); committedYaw = yaw
    if (ctx.isReducedMotion?.()) { sway = speed = 0; hangingPose() }
  }
  const blur = () => { focused = false; lifecycleVersion++; closeInspection?.cancel(); pointer.cancel(); if (!motion) reset(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    closeInspection?.cancel()
    heldHanging = false; yaw = committedYaw; sway = speed = 0
    if (!motion) { pointer.cancel(); placement.cancel() }
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(-.02, .94, .32), direction = new THREE.Vector3(2.2, 2.1, 8).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const saved = amount
    for (const [step, n] of [0,1,2].flatMap(step=>Array.from({length:61},(_,i)=>[step,i/60])).concat([[3,0]])) {
      pose(step!, n!)
      model.subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      })
    }
    pose(at >= 2 ? 3 : at, saved); if (at === 2) hangingPose(); camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
  }
  const stopInspection=addKeyboardPlacementInspection(ui.actionBtn,canvas,camera,model,placement,{isActive:()=>inputActive()&&canPlace()&&!motion&&at<2&&!pointer.isBusy(),step:()=>2,prepare:prepareInput,reset})
  closeInspection = createCloseInspection({ canvas, scene, camera, actor: model.charm, ui,
    isActive: () => inputActive() && !motion, isReducedMotion: () => !!ctx.isReducedMotion?.(),
    prepare: prepareInput, safe, changed: () => sync() })
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); flickBtn.addEventListener('click', flickAction); ui.actionBtn.addEventListener('keydown', playKeyboard); flickBtn.addEventListener('keydown', playKeyboard); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; closeInspection?.cancel(); pointer.cancel(); if (!motion) reset(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      if (handoffPending) { handoffPending = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.arrived ? .32 : .85))
        const eased=ease(motion.time)
        pose(motion.step, motion.from+(1-motion.from)*eased); placement.settle(eased); if (motion.time === 1) settle()
      }
      if (!active()) return
      if (at === 2 && !motion && !heldHanging) {
        if (ctx.isReducedMotion?.()) sway = speed = 0
        else { speed += (-sway * 22 - speed * 2.8) * delta; sway = THREE.MathUtils.clamp(sway + speed * delta, -.16, .16) }
        hangingPose()
      }
      feedback.update(); closeInspection.update(delta)
      if (active()) { matrices(); lights.key.shadow.normalBias = .03; style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; closeInspection?.dispose(); pointer.dispose(); stopInspection(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action); flickBtn.removeEventListener('click', flickAction); ui.actionBtn.removeEventListener('keydown', playKeyboard); flickBtn.removeEventListener('keydown', playKeyboard)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
