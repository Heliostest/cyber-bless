import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createPosePlacement } from '../pose-placement'
import { createTouchTarget, insideCanvas } from '../touch-target'
import { addStageLights, CEL_STYLE, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createBratBrideModel } from './model'

type Phase = 'placement' | 'settling' | 'focusing' | 'smoothing' | 'finishing' | 'done'
const COPY = {
  place: '把布放到窗台', smooth: '抹平方布',
  carry: '拿住方布，移到户外窗台上，轻轻放下。',
  settling: '方布轻落窗台，靠近后慢慢抹平……',
  smoothing: '在布面上左右抹过，把还隆起的褶皱慢慢铺平。',
  finishing: '褶皱舒展开来，方布安稳地留在窗边……',
  done: '窗边已铺好一方布，愿你与牵挂的人平安。',
}
const SILL_POS = new THREE.Vector3(0, .88, .48)
const SETTLE_DURATION = .85
const TOUCHDOWN_RATIO = .66
const ease = (t: number) => t * t * (3 - 2 * t)

export function createBratBrideCloth(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at = 0
  let lifecycle = 0, callbackVersion = 0, phase: Phase = 'placement', elapsed = 0, handoff = false
  let stopResize = () => {}
  // Interactive carry/drape state (pure product choreography; never alters canonical checkpoints).
  let carryHeld = false, carryGrabX = 0, carryGrabZ = 0, carryLift = 0, carrySwayX = 0, carrySwayZ = 0
  const lastCarryPos = new THREE.Vector3()
  const settleFrom = new THREE.Vector3()
  let settleArc = .22, settleLanded = false
  // Dirty-render tracking so settled reduced-motion views stay completely idle without redundant WebGL swaps.
  let renderDirty = true, lastReduced = false
  const lastCamPos = new THREE.Vector3(NaN, NaN, NaN), lastCamQuat = new THREE.Quaternion(NaN, NaN, NaN, NaN)
  let lastCamFov = -1
  const markDirty = () => { renderDirty = true }

  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycle
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '窗布祈护', stepsAria: '窗布祈护步骤', action: COPY.place }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'brat-bride-cloth', label: '窗布祈护', invalidate: markDirty }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xc6d3ec, ground: 0x62647b, key: 0xffdfb9, rim: 0xaac8f3, keyPosition: [-3, 5, 4], keyIntensity: 2, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 })
  const model = createBratBrideModel({ isActive: active, isReducedMotion: () => !!ctx.isReducedMotion?.() }); scene.add(model.root)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const placement = createPosePlacement(canvas, camera, model, scene), touch = createTouchTarget(canvas, camera, scene)
  const homeCamera = new THREE.Vector3(), homeRotation = new THREE.Quaternion(), closeCamera = new THREE.Vector3(), closeRotation = new THREE.Quaternion()
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.895)
  const clearCarryState = () => { carryHeld = false; carryGrabX = 0; carryGrabZ = 0; carryLift = 0; carrySwayX = 0; carrySwayZ = 0; settleLanded = false }
  const resetPlacement = () => { clearCarryState(); placement.cancel(); model.pose(at, 0); placement.restoreCheckpoint(at); lastCarryPos.copy(model.cloth.position); matrices(); markDirty() }
  const canPlace = () => inputActive() && phase === 'placement' && !handoff
  const canSmooth = () => inputActive() && phase === 'smoothing' && !handoff
  const removeCues = [
    addInteractionCue(model.cloth, { kind: 'drag', label: COPY.place, anchor: [0, .03, 0], priority: 3, destination: () => placement.destination(2), targetLabel: '当前安放位置', enabled: canPlace }),
    addInteractionCue(model.cloth, { kind: 'drag', label: COPY.smooth, anchor: [0, .05, 0], direction: [1, 0], priority: 3, enabled: canSmooth }),
  ]
  function sync() {
    markDirty()
    overlay.dataset.clothPhase = phase
    if (cueLayer) cueLayer.hidden = !active()
    const interactive = canPlace() || canSmooth()
    ui.renderDots(phase === 'done' ? 2 : phase === 'placement' || phase === 'settling' ? 0 : 1, 2)
    ui.actionBtn.hidden = phase === 'done'; ui.actionBtn.disabled = !interactive
    ui.actionBtn.setAttribute('aria-disabled', String(!interactive)); ui.hitLayer.style.pointerEvents = interactive ? 'auto' : 'none'
    setSafeText(ui.actionBtn, phase === 'placement' || phase === 'settling' ? COPY.place : COPY.smooth, safe)
    setSafeText(ui.hintEl, phase === 'placement' ? COPY.carry : phase === 'smoothing' ? COPY.smoothing : phase === 'done' ? COPY.done : phase === 'finishing' ? COPY.finishing : COPY.settling, safe)
  }
  function callbacks(work: () => void) { notifying = true; callbackVersion = lifecycle; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepare() { const version = lifecycle; callbacks(() => feedback.prepare()); return inputActive() && version === lifecycle }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guard = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guard, true); ui.hitLayer.addEventListener(type, guard, true) })

  function pickLocalGrab(x: number, y: number): [number, number] {
    if (!insideCanvas(canvas, x, y)) return [0, 0]
    matrices(); const rect = canvas.getBoundingClientRect()
    ndc.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2)
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObject(model.cloth, false)[0]
    if (!hit) return [0, 0]
    const local = model.cloth.worldToLocal(hit.point.clone())
    return [THREE.MathUtils.clamp(local.x, -.48, .48), THREE.MathUtils.clamp(local.z, -.18, .18)]
  }

  function applyLiveCarryMesh(dt = 0) {
    const pos = model.cloth.position
    const heightLift = THREE.MathUtils.clamp((pos.y - .32) / .48, 0, 1)
    const distFromBench = Math.hypot(pos.x, pos.z - 1.75)
    const targetLift = carryHeld ? Math.max(.38, heightLift, THREE.MathUtils.clamp(distFromBench / .55, 0, 1)) : heightLift
    const reduced = !!ctx.isReducedMotion?.()
    if (reduced || dt <= 0) {
      carryLift = targetLift
      if (reduced) { carrySwayX = 0; carrySwayZ = 0 }
    } else {
      carryLift = THREE.MathUtils.lerp(carryLift, targetLift, Math.min(1, dt * 12))
      const damp = Math.exp(-dt * 9)
      carrySwayX *= damp; carrySwayZ *= damp
    }
    const sillBlend = THREE.MathUtils.clamp((1.75 - pos.z) / (1.75 - .48), 0, 1)
    model.setCarryPose(carryLift, sillBlend, carryGrabX, carryGrabZ, carrySwayX, carrySwayZ)
    markDirty()
  }

  function startSettle() {
    phase = 'settling'; elapsed = 0; carryHeld = false; settleLanded = false
    settleFrom.copy(model.cloth.position)
    const remaining = settleFrom.distanceTo(SILL_POS)
    settleArc = THREE.MathUtils.clamp(remaining * .46, .16, .62)
    if (!ctx.isReducedMotion?.()) void model.smoothing.activate()
    sync()
    if (ctx.isReducedMotion?.()) enterSmoothing(false)
  }

  const carryPointer = createObjectPointer(ui.hitLayer, {
    isActive: canPlace,
    canStart(x, y) { matrices(); return touch.hit(x, y, model.cloth) },
    onStart(x, y) {
      if (!prepare() || !placement.begin(2, x, y)) { carryPointer.cancel(); return }
      const [gx, gz] = pickLocalGrab(x, y)
      carryHeld = true; carryGrabX = gx; carryGrabZ = gz; carrySwayX = 0; carrySwayZ = 0
      lastCarryPos.copy(model.cloth.position)
      if (!ctx.isReducedMotion?.()) void model.smoothing.activate()
    },
    onMove(x, y) {
      const arrived = placement.move(x, y)
      const dx = model.cloth.position.x - lastCarryPos.x
      const dz = model.cloth.position.z - lastCarryPos.z
      lastCarryPos.copy(model.cloth.position)
      if (!ctx.isReducedMotion?.()) {
        carrySwayX = THREE.MathUtils.clamp(carrySwayX * .72 - dx * 1.45, -.34, .34)
        carrySwayZ = THREE.MathUtils.clamp(carrySwayZ * .72 - dz * 1.45, -.34, .34)
      }
      applyLiveCarryMesh(0)
      if (arrived && carryPointer.finish()) { placement.capture(); startSettle() }
    },
    onRelease(x, y) {
      if (placement.move(x, y)) {
        applyLiveCarryMesh(0); placement.capture(); startSettle()
      } else if (!insideCanvas(canvas, x, y)) {
        resetPlacement()
      } else {
        carryHeld = false; placement.release(); applyLiveCarryMesh(0)
      }
    },
    onCancel() { if (phase === 'placement') resetPlacement() },
  })

  function aimClose() {
    const target = new THREE.Vector3(0, .91, .48), direction = new THREE.Vector3(0, 3.6, 2.8).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); matrices()
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    let distance = 1.3
    for (const x of [-.92, .92]) for (const y of [.88, 1.04]) for (const z of [.04, .92]) {
      const p = new THREE.Vector3(x, y, z).sub(target).applyQuaternion(inverse)
      distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * camera.aspect * .82), p.z + Math.abs(p.y) / (tangent * .78))
    }
    closeCamera.copy(target).addScaledVector(direction, distance); camera.position.copy(closeCamera); camera.lookAt(target); closeRotation.copy(camera.quaternion)
  }

  function enterSmoothing(alreadyLanded = false) {
    placement.settle(1); placement.cancel()
    if (!alreadyLanded) {
      model.pose(3, 0); model.smoothing.begin()
    }
    if (!ctx.isReducedMotion?.()) void model.smoothing.activate()
    homeCamera.copy(camera.position); homeRotation.copy(camera.quaternion); aimClose()
    phase = ctx.isReducedMotion?.() ? 'smoothing' : 'focusing'; elapsed = 0; handoff = true
    if (phase === 'focusing') { camera.position.copy(homeCamera); camera.quaternion.copy(homeRotation) }
    matrices(); sync()
  }

  function surfacePoint(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !insideCanvas(canvas, x, y)) return undefined
    matrices(); const rect = canvas.getBoundingClientRect()
    ndc.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2); ray.setFromCamera(ndc, camera)
    const world = ray.ray.intersectPlane(plane, new THREE.Vector3()); if (!world) return undefined
    const local = model.cloth.worldToLocal(world)
    return Math.abs(local.x) <= .86 && Math.abs(local.z) <= .41
      ? new THREE.Vector2(THREE.MathUtils.clamp(local.x, -.825, .825), THREE.MathUtils.clamp(local.z, -.37, .37))
      : undefined
  }
  let stroke: { saved: ReturnType<typeof model.smoothing.snapshot>; last: THREE.Vector2 | undefined } | undefined
  const cancelStroke = () => { if (stroke) { model.smoothing.restore(stroke.saved); stroke = undefined; markDirty() } }
  function sample(x: number, y: number) {
    if (!stroke) return
    const next = surfacePoint(x, y)
    if (next && stroke.last) { model.smoothing.stroke(stroke.last, next); markDirty() }
    stroke.last = next
  }
  function finishSmoothing() {
    model.smoothing.finish(); phase = 'finishing'; elapsed = 0; sync()
    if (ctx.isReducedMotion?.()) { model.smoothing.update(.05, true); complete() }
  }
  const smoothPointer = createObjectPointer(ui.hitLayer, {
    isActive: canSmooth,
    canStart(x, y) { return !!surfacePoint(x, y) && touch.hit(x, y, model.cloth) },
    onStart(x, y) { if (!prepare()) { smoothPointer.cancel(); return } stroke = { saved: model.smoothing.snapshot(), last: surfacePoint(x, y) } },
    onMove: sample,
    onRelease(x, y) { if (!surfacePoint(x, y)) { cancelStroke(); return } sample(x, y); stroke = undefined; if (model.smoothing.progress() >= .82) finishSmoothing() },
    onCancel: cancelStroke,
  })
  function complete() {
    at = 3; phase = 'done'; model.smoothing.update(.05, true); sync()
    callbacks(() => {
      ctx.onProgress?.(3); if (!callbackActive()) return
      feedback.impact({ freqs: [440], duration: .09, gain: .003, type: 'sine' })
      if (callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = (event: MouseEvent) => {
    if (event.detail > 1 || handoff || carryPointer.isBusy() || smoothPointer.isBusy() || !(canPlace() || canSmooth()) || !prepare()) return
    if (phase === 'placement') { placement.capture(2); startSettle() } else finishSmoothing()
  }
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.isComposing && inputActive()) { event.preventDefault(); carryPointer.cancel(); smoothPointer.cancel(); if (phase === 'placement') resetPlacement() } }
  function cancelInput() { carryPointer.cancel(); smoothPointer.cancel(); cancelStroke(); if (phase === 'placement') resetPlacement() }
  const blur = () => { focused = false; lifecycle++; cancelInput(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    cancelInput(); const aspect = sizeStage(canvas, renderer, style, camera)
    if (['focusing', 'smoothing', 'finishing', 'done'].includes(phase)) {
      aimClose(); if (phase === 'focusing') phase = 'smoothing'
    } else {
      const target = new THREE.Vector3(0, 1.10, .65), direction = new THREE.Vector3(.7, 3.6, 7).normalize()
      camera.position.copy(target).add(direction); camera.lookAt(target); matrices()
      const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); let distance = 3.4
      for (const x of [-1.85, 1.85]) for (const y of [0, 2.25]) for (const z of [-.90, 2.50]) { const p = new THREE.Vector3(x, y, z).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * .86), p.z + Math.abs(p.y) / (tangent * .86)) }
      camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target)
    }
    matrices(); sync()
  }
  resetPlacement(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0
      phase = at === 3 ? 'done' : 'placement'; resetPlacement(); resize()
      if (at === 3) { model.smoothing.begin(); model.smoothing.finish(); model.smoothing.update(.05, true) }
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('keydown', key); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycle++; cancelInput(); if (!suspended) { suspended = true; sync() } return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      if (handoff) { handoff = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      const reduced = !!ctx.isReducedMotion?.()
      if (reduced !== lastReduced) { lastReduced = reduced; markDirty() }
      let geometryUpdated = false
      if (phase === 'placement') {
        if (!reduced && (Math.abs(carrySwayX) > 1e-4 || Math.abs(carrySwayZ) > 1e-4)) {
          applyLiveCarryMesh(delta)
          geometryUpdated = true
        }
      } else if (phase === 'settling') {
        if (reduced) {
          enterSmoothing(false)
        } else {
          elapsed = Math.min(1, elapsed + delta / SETTLE_DURATION)
          if (elapsed < TOUCHDOWN_RATIO) {
            const u = ease(elapsed / TOUCHDOWN_RATIO)
            model.cloth.position.lerpVectors(settleFrom, SILL_POS, u)
            model.cloth.position.y += Math.sin(Math.PI * u) * settleArc
            const liftAmount = Math.sin(Math.PI * u) * .85 + (1 - u) * carryLift * .35
            const swayDecay = Math.sin(Math.PI * u) * (1 - u)
            model.setCarryPose(
              THREE.MathUtils.clamp(liftAmount, 0, 1),
              THREE.MathUtils.clamp(u, 0, 1),
              carryGrabX * (1 - u),
              carryGrabZ * (1 - u),
              carrySwayX * (1 - u),
              carrySwayZ * (1 - u) + .14 * swayDecay,
            )
            geometryUpdated = true
          } else {
            if (!settleLanded) {
              settleLanded = true
              placement.settle(1); placement.cancel()
              model.cloth.position.copy(SILL_POS)
              model.setCarryPose(0, 1, 0, 0, 0, 0)
              const cur = model.currentSurface()
              model.smoothing.beginFromSurface(cur.x, cur.y, cur.z, -.38)
              geometryUpdated = true
            }
            if (model.smoothing.update(delta, false)) geometryUpdated = true
          }
          if (elapsed === 1) enterSmoothing(settleLanded)
        }
      } else if (phase === 'focusing') {
        if (reduced) {
          camera.position.copy(closeCamera); camera.quaternion.copy(closeRotation)
          model.smoothing.update(.05, true)
          phase = 'smoothing'; sync()
        } else {
          elapsed = Math.min(1, elapsed + delta / .55)
          camera.position.lerpVectors(homeCamera, closeCamera, ease(elapsed))
          camera.quaternion.slerpQuaternions(homeRotation, closeRotation, ease(elapsed))
          if (model.smoothing.update(delta, false)) geometryUpdated = true
          if (elapsed === 1) { phase = 'smoothing'; sync() }
        }
      } else if (phase === 'smoothing' || phase === 'finishing') {
        if (model.smoothing.update(delta, reduced)) geometryUpdated = true
        if (phase === 'finishing') {
          if (reduced) { complete() }
          else { elapsed += delta; if (elapsed >= .65) complete() }
        }
      }
      if (active()) {
        const camChanged = !camera.position.equals(lastCamPos) || !camera.quaternion.equals(lastCamQuat) || camera.fov !== lastCamFov
        const envPending = !!canvas.dataset.environment && (canvas.dataset.environmentReady !== 'true' || canvas.dataset.treeStatus === 'loading')
        const needsRender = !reduced || renderDirty || geometryUpdated || camChanged || envPending || carryHeld || !!stroke || phase === 'settling' || phase === 'focusing' || phase === 'finishing'
        if (needsRender) {
          matrices(); style.render()
          renderDirty = false
          lastCamPos.copy(camera.position); lastCamQuat.copy(camera.quaternion); lastCamFov = camera.fov
        }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycle++; carryPointer.dispose(); smoothPointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove())
      guardedEvents.forEach(type => { window.removeEventListener(type, guard, true); ui.hitLayer.removeEventListener(type, guard, true) })
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('keydown', key); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); model.dispose(); disposeTree(model.root); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage'); delete overlay.dataset.clothPhase
    },
  }
}
