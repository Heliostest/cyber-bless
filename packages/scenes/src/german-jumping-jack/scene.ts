import { sceneJoin } from '../scene-localization'
import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { completesDirectionalDrag, directionalAxes, updateDirectionalDragHint } from '../directional-drag'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createJumpingJackModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['轻牵木珠', '舒展木肢', '轻牵收稳']
const HINTS = [
  '按住木珠向下短拖，两臂与双腿随细绳轻轻抬起，松手让它们垂回。',
  '再向下牵动木珠，看木肢舒展得更开，让木片围着小轴转动。',
  '轻牵木珠向下短拖，松手后等木偶慢慢收稳，让木珠安静地垂着。',
  '三次轻牵过后，木肢安静地垂回，树影与彩木留住一小段轻快。',
]
const MOVING = ['细绳带着木肢慢慢垂回……', '两臂与双腿沿着小轴收回……', '木偶轻轻收稳，木珠又安静地垂着……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createGermanJumpingJack(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let phase = 0, readyToFinish = false, controlsBusy = false
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number } | null = null
  let amount = 0, moved = false, invalid = false, pathTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '牵绳木偶', stepsAria: '牵绳步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const finishBtn = document.createElement('button'); finishBtn.type = 'button'; finishBtn.className = 'scene-bow-tap scene-continuous-finish'
  setSafeText(finishBtn, '结束仪式', safe); overlay.append(finishBtn)
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'german-jumping-jack', label: '牵绳木偶' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createJumpingJackModel(); scene.add(model.subject)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step,n); matrices() }
  const restore = () => pose(at === 3 ? 3 : phase, 0)
  const directions: [number, number][] = [[0,1],[0,1],[0,1]]
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', direction: directions[i], label: ACTIONS[i]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at < 3 && phase === i }))
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), previous = new THREE.Vector2()
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const axes = (dx: number, dy: number) => directionalAxes(directions[phase]!, dx, dy)
  const reset = () => { moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore(); updateDirectionalDragHint(ui.hintEl, false, HINTS[phase]!, safe); if (!disposed) sync() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); const hit = nearest(x, y); return !!hit && (hit === model.roots[phase] || model.roots[phase]!.getObjectById(hit.id) === hit) },
    onStart(x, y) { if (!prepareInput()) { pointer.cancel(); return }; down.set(x, y); previous.copy(down); moved = invalid = false; pathTravel = maxCross = maxAlong = minAlong = backtrack = along = 0 },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      pathTravel += Math.hypot(x - previous.x, y - previous.y); previous.set(x, y)
      const [a, cross] = axes(x - down.x, y - down.y); along = a!; moved = true
      maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along); maxCross = Math.max(maxCross, Math.abs(cross!))
      // A held pull rotates four rigid limbs through length-conserving cords; release returns gently to rest.
      pose(phase, THREE.MathUtils.clamp(along / 60, 0, 1) * .6)
      updateDirectionalDragHint(ui.hintEl, !invalid && completesDirectionalDrag({ along, end: along, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel: pathTravel }), HINTS[at]!, safe)
    },
    onRelease(x, y) {
      const [end, cross] = axes(x - down.x, y - down.y), travel = pathTravel + Math.hypot(x - previous.x, y - previous.y)
      const valid = !invalid && moved && completesDirectionalDrag({ along, end: end!, maxAlong, minAlong, backtrack, maxCross, cross: cross!, travel })
      if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    controlsBusy = pointer.isBusy()
    if (motion || at === 3) delete ui.hintEl.dataset.ready
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[phase]!, safe); setSafeText(ui.hintEl, motion ? MOVING[motion.step]! : at === 3 ? HINTS[3]! : readyToFinish ? sceneJoin(HINTS[phase]!, ' 可以继续操作，想收尾时点「结束仪式」。') : HINTS[phase]!, safe)
    finishBtn.hidden = !readyToFinish || at === 3; finishBtn.disabled = !inputActive() || !!motion || controlsBusy || at === 3; finishBtn.setAttribute('aria-disabled', String(finishBtn.disabled))
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    const settledStep = motion.step, previousProgress = at
    readyToFinish ||= settledStep === 2; phase = (settledStep + 1) % 3
    at = Math.max(at, Math.min(2, settledStep + 1)) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => {
      if (at !== previousProgress) ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63,392,440][settledStep] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
    })
  }
  function advance() { if (!inputActive() || pointer.isBusy() || motion || at === 3) return; motion = { step: phase as 0 | 1 | 2, time: 0, from: amount }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const finish = () => {
    if (!inputActive() || !readyToFinish || pointer.isBusy() || motion || at === 3 || !prepareInput()) return
    at = 3; restore()
    withHostCallbacks(() => { ctx.onProgress?.(3); if (!callbackActive()) return; ctx.haptic?.('medium'); if (callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })) })
  }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, 1.85, 0), direction = new THREE.Vector3(1.7, 1.9, 6.6).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const saved = amount
    for (const [step, n] of [0,1,2].flatMap(step=>Array.from({length:21},(_,i)=>[step,i/20])).concat([[3,0]])) {
      pose(step!, n!)
      model.subject.traverse(o => { const m = o as THREE.Mesh; if (!m.geometry) return; const vertices = m.geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      })
    }
    pose(at === 3 ? 3 : phase, saved); camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      phase = Math.min(at, 2); readyToFinish = false
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); finishBtn.addEventListener('click', finish); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (controlsBusy !== pointer.isBusy()) sync()
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .85)
        const eased=ease(motion.time)
        // Match the held reach on the return branch, including valid40/50px pulls.
        // The bead rises immediately on release instead of pulling itself farther down.
        const next=motion.from>0?1-.4*Math.sqrt(motion.from/.6)*(1-eased):eased
        pose(motion.step,next); if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action); finishBtn.removeEventListener('click', finish)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.subject); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
