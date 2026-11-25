import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createFreePlacementPointer } from '../free-placement-pointer'
import { createPosePlacement } from '../pose-placement'
import { addKeyboardPlacementInspection, setPlacementHint } from '../placement-inspection'
import { insideCanvas } from '../touch-target'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createKhataModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['双手托起', '递向来客', '交到手中']
const HINTS = [
  '握住白绢，把礼巾托到上方的提示位置。',
  '握住礼巾，挪到来客前方的提示位置，把心意递出。',
  '再向右短拖，让来客双手接稳礼巾。',
  '白绢已交到来客手中，愿彼此相逢欢喜。',
]
const MOVING = ['轻轻托起白绢……', '向来客递出礼巾……', '来客接稳了礼巾……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createTibetanKhataGreeting(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: {
    step: 0 | 1 | 2
    time: number
    from: number
    placed?: boolean
    handoff?: {
      fromPos: THREE.Vector3
      fromSpan: number
      fromGiverHands: [THREE.Vector3, THREE.Vector3]
      fromGuestHands: [THREE.Vector3, THREE.Vector3]
    }
  } | null = null
  let amount = 0, invalid = false, carryHeld = false
  let carryWeight = 0, carrySag = 0, carryBowX = 0
  const lastCarryPos = new THREE.Vector3()
  let wasReduced = false
  // Dirty-render tracking so settled reduced-motion views stay completely idle without redundant WebGL swaps.
  let renderDirty = true
  const lastCamPos = new THREE.Vector3(NaN, NaN, NaN), lastCamQuat = new THREE.Quaternion(NaN, NaN, NaN, NaN)
  let lastCamFov = -1
  const markDirty = () => { renderDirty = true }

  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '白绢迎客', stepsAria: '白绢迎客步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'tibetan-khata-greeting', label: '白绢迎客', invalidate: markDirty }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createKhataModel({ isActive: active, isReducedMotion: () => !!ctx.isReducedMotion?.() }); scene.add(model.root)
  const placement = createPosePlacement(canvas, camera, model, scene)

  const supportHeldScarf = () => {
    model.root.updateMatrixWorld(true)
    model.people[0]!.setHands([-1, 1].map(sign => model.root.worldToLocal(model.scarf.localToWorld(new THREE.Vector3(-.035, model.drape(sign * .34) - .055, sign * .34)))))
    model.root.updateMatrixWorld(true)
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step, n); matrices(); markDirty() }
  const clearCarryState = () => { carryHeld = false; carryWeight = 0; carrySag = 0; carryBowX = 0; model.resetCarryFeel() }
  const restore = () => { clearCarryState(); pose(at, 0); placement.restoreCheckpoint(at); lastCarryPos.copy(model.scarf.position); if (ctx.isReducedMotion?.()) model.calm(); matrices(); markDirty() }
  const carryStep = () => (at < 2 ? 1 : 2) as 1 | 2
  const carrying = () => at < 2
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, {
    kind: 'drag',
    destination: () => placement.destination(i < 2 ? 1 : 2),
    targetLabel: '挪到这里',
    label: ACTIONS[i]!,
    anchor: model.anchors[i],
    priority: 3,
    enabled: () => inputActive() && !motion && (at < 2 ? i === 1 : at === i),
  }))
  const ray = createPointerRay(canvas, camera)
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const reset = () => { placement.cancel(); invalid = false; clearCarryState(); if (!motion && !disposed) restore(); markDirty() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })

  function applyLiveCarryFeel(dt = 0) {
    const reduced = !!ctx.isReducedMotion?.()
    if (carrying()) {
      const distFromHome = Math.hypot(model.scarf.position.x + 0.35, model.scarf.position.y - 0.92, model.scarf.position.z)
      const targetWeight = carryHeld ? Math.max(0.42, THREE.MathUtils.clamp(distFromHome / 0.32, 0, 1)) : THREE.MathUtils.clamp(distFromHome / 0.45, 0, 0.55)
      if (reduced || dt <= 0) {
        carryWeight = targetWeight
        if (reduced) { carrySag = 0; carryBowX = 0 }
      } else {
        carryWeight = THREE.MathUtils.lerp(carryWeight, targetWeight, Math.min(1, dt * 11))
        const damp = Math.exp(-dt * 8.5)
        carrySag *= damp
        carryBowX *= damp
      }
      model.setCarryFeel({
        weight: carryWeight,
        gather: -0.020 * carryWeight,
        bridgeSag: 0.015 * carryWeight + carrySag,
        bridgeBowX: carryBowX,
      })
      supportHeldScarf()
    } else if (at === 2) {
      if (reduced) { carrySag = 0; carryBowX = 0 }
      else if (dt > 0) {
        const damp = Math.exp(-dt * 8.5)
        carrySag *= damp
        carryBowX *= damp
      }
      const p = THREE.MathUtils.clamp(model.scarf.position.x / 0.35, 0, 1)
      model.setInteractiveHandoff(p, carrySag)
    }
    matrices()
    markDirty()
  }

  const inspectRotate = (dx: number, _dy: number) => {
    if (!carrying()) return
    placement.rotate(dx * .012, 0)
    supportHeldScarf()
    matrices()
    markDirty()
  }

  const pointer = createFreePlacementPointer(ui.hitLayer, canvas, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); const hit = nearest(x, y); const target = model.roots[at]!; return !!hit && (hit.object === target || target.getObjectById(hit.object.id) === hit.object) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      invalid = false
      if (!placement.begin(carryStep(), x, y)) { pointer.cancel(); return }
      carryHeld = true
      lastCarryPos.copy(model.scarf.position)
      applyLiveCarryFeel(0)
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if (invalid) return
      const ready = placement.move(x, y)
      model.clampCarryPosition(model.scarf.position, at === 2)
      const dx = model.scarf.position.x - lastCarryPos.x
      const dy = model.scarf.position.y - lastCarryPos.y
      lastCarryPos.copy(model.scarf.position)
      if (!ctx.isReducedMotion?.()) {
        carrySag = THREE.MathUtils.clamp(carrySag * 0.72 + dy * 0.42, -0.014, 0.024)
        carryBowX = THREE.MathUtils.clamp(carryBowX * 0.72 - dx * 0.28, -0.036, 0.036)
      }
      applyLiveCarryFeel(0)
      if (ready && pointer.finish()) { placement.capture(); advance(true) }
    },
    onRelease(x, y) {
      if (!invalid && placement.move(x, y)) {
        model.clampCarryPosition(model.scarf.position, at === 2)
        applyLiveCarryFeel(0)
        placement.capture()
        advance(true)
      } else if (!invalid && insideCanvas(canvas, x, y)) {
        carryHeld = false
        placement.release()
        applyLiveCarryFeel(0)
      } else {
        reset()
      }
    },
    onRotate: inspectRotate,
    onRebase(x, y) { placement.rebase(x, y) },
    onInspectEnd() {
      carryHeld = false
      if (carrying()) { placement.release(); applyLiveCarryFeel(0) }
      else reset()
    },
    onCancel: reset,
  })

  const sync = () => {
    markDirty()
    const phase = at === 3 ? 'done' : motion ? (motion.step === 2 ? 'handoff-settle' : 'present-settle') : (at < 2 ? 'carry' : 'handoff')
    overlay.dataset.khataPhase = phase
    if (motion || at === 3) delete ui.hintEl.dataset.ready
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at < 2 ? 0 : at - 1, 2); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[at < 2 ? 1 : 2]!, safe)
    setPlacementHint(ui.hintEl, motion ? MOVING[motion.step]! : HINTS[at < 2 ? 1 : at]!, !motion && carrying(), safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    placement.settle(1); placement.cancel(); at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [[329.63, 392, 440][at - 1] ?? 329.63], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(placed = false) {
    if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === 3) return
    carryHeld = false
    const step = carryStep()
    const hands = model.getHandPositions()
    motion = {
      step,
      time: 0,
      from: amount,
      placed,
      handoff: step === 2 && placed ? {
        fromPos: model.scarf.position.clone(),
        fromSpan: model.activeSpan,
        fromGiverHands: hands.giver,
        fromGuestHands: hands.guest,
      } : undefined,
    }
    sync()
    if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => {
    if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return
    if (carrying()) { placement.capture(carryStep()); advance(true) }
    else advance(false)
  }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); if (!motion) { placement.cancel(); restore() }; sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    if (!motion) { pointer.cancel(); placement.cancel(); restore() }
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, .78, 0), direction = new THREE.Vector3(2.5, 5.6, 7).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); let distance = 3.4
    // Frame both people and the complete scarf, including its hanging fringes.
    for (const x of [-1.45, 1.45]) for (const y of [0, 1.52]) for (const z of [-1.16, 1.16]) { const p = new THREE.Vector3(x, y, z).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
    camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); matrices(); markDirty()
  }
  const stopInspection = addKeyboardPlacementInspection(ui.actionBtn, canvas, camera, model, placement, { isActive: () => inputActive() && !motion && carrying() && !pointer.isBusy(), step: () => carryStep(), prepare: prepareInput, reset, rotate: (yaw, pitch) => inspectRotate(yaw / .012, pitch / .012) })
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      wasReduced = !!ctx.isReducedMotion?.()
      restore(); resize()
      if (!wasReduced) void model.startPhysics()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!motion) { placement.cancel(); restore() }; if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const reducedNow = !!ctx.isReducedMotion?.()
      if (reducedNow !== wasReduced) {
        wasReduced = reducedNow
        if (reducedNow) model.calm()
        else void model.startPhysics()
        markDirty()
      }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      let geometryUpdated = false
      if (!motion && !reducedNow && (Math.abs(carrySag) > 1e-4 || Math.abs(carryBowX) > 1e-4)) {
        applyLiveCarryFeel(delta)
        geometryUpdated = true
      }
      if (motion) {
        const duration = motion.step === 2 ? (motion.placed ? 1.35 : 1.85) : 0.34
        motion.time = reducedNow ? 1 : Math.min(1, motion.time + delta / duration)
        const eased = ease(motion.time)
        if (motion.step === 2 && motion.handoff) {
          model.setHandoffSettle(
            motion.time,
            motion.handoff.fromPos,
            motion.handoff.fromSpan,
            motion.handoff.fromGiverHands,
            motion.handoff.fromGuestHands,
          )
        } else {
          pose(motion.step, motion.from + (1 - motion.from) * eased)
          placement.settle(eased)
          if (motion.placed && motion.step < 2) supportHeldScarf()
        }
        matrices()
        geometryUpdated = true
        if (motion.time === 1) settle()
      }
      if (active()) {
        if (!reducedNow && model.stepPhysics(delta)) geometryUpdated = true
        const camChanged = !camera.position.equals(lastCamPos) || !camera.quaternion.equals(lastCamQuat) || camera.fov !== lastCamFov
        const envPending = !!canvas.dataset.environment && (canvas.dataset.environmentReady !== 'true' || canvas.dataset.treeStatus === 'loading')
        const needsRender = !reducedNow || renderDirty || geometryUpdated || camChanged || envPending || !!motion || pointer.isBusy()
        if (needsRender) {
          matrices(); lights.key.shadow.normalBias = .03; style.render()
          renderDirty = false
          lastCamPos.copy(camera.position); lastCamQuat.copy(camera.quaternion); lastCamFov = camera.fov
        }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopInspection(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); model.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage'); delete overlay.dataset.khataPhase
    },
  }
}
