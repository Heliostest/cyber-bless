import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue, type InteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '陶轮慢成', turn: '在木轮前缘向右横拖，让轮上的刻记慢慢转动。',
  pull: '从湿泥外壁向上轻拉，慢慢提起碗壁，留住敞开的碗口。', quiet: '轻点泥碗静看。它仍是湿润、未上釉、未经烧制的泥坯。',
  moving: '轮盘缓转，湿泥渐成…', done: '留一刻从容。泥坯尚未烧制。',
  turnAction: '向右转动木轮', pullAction: '向上提起碗壁', quietAction: '轻点泥碗静看',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const FINAL_TURN = .9, SEGMENTS = 64, WALL_STEPS = 48
const ease = (t: number) => t * t * (3 - 2 * t)
const heightAt = (formed: number) => THREE.MathUtils.lerp(.58, 1.15, formed)
const outerRadius = (t: number, formed: number) => THREE.MathUtils.lerp(.39 + .18 * Math.sin(t * Math.PI / 2), .37 + .42 * Math.pow(t, .75), formed)
  + .0055 * Math.sin(t * Math.PI * 24) * Math.sin(t * Math.PI)

// The closed cross section runs under the foot, up the outside, over a rounded
// lip, down the inside and across a thick floor. Its center is open from above.
function clayProfile(formed: number) {
  const points = [new THREE.Vector2(0, 0), new THREE.Vector2(outerRadius(0, formed), 0)]
  const height = heightAt(formed), lip = .045
  for (let i = 1; i <= WALL_STEPS; i++) {
    const t = i / WALL_STEPS
    points.push(new THREE.Vector2(outerRadius(t, formed), (height - lip) * t))
  }
  const rim = outerRadius(1, formed) - lip
  for (let i = 1; i <= 8; i++) {
    const a = i / 8 * Math.PI
    points.push(new THREE.Vector2(rim + lip * Math.cos(a), height - lip + lip * Math.sin(a)))
  }
  for (let i = WALL_STEPS - 1; i >= 0; i--) {
    const t = i / WALL_STEPS
    // A curved interior meets a 0.13-unit floor and a 0.09-unit upper wall.
    const y = .13 + (height - lip - .13) * t
    const exteriorT = y / (height - lip)
    points.push(new THREE.Vector2(outerRadius(exteriorT, formed) - (.09 + .018 * (1 - t)), y))
  }
  points.push(new THREE.Vector2(0, .13), new THREE.Vector2(0, 0))
  return points
}

/** An original, simplified wheel-thrown shape; this stops at unfired green clay. */
export function createUzbekClayBowl(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, checkpoint: Checkpoint = 0
  let dragging = false, moved = false, maxTravel = 0, crossTravel = 0, formed = 0, lifecycleVersion = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; turn: number; formed: number } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying, reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.turnAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'uzbek-clay-bowl', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf2ecdb, ground: 0xc9bba1, key: 0xfff2d9, rim: 0xe7e8d9,
    keyPosition: [-3, 5, 4], keyIntensity: 2.3, rimIntensity: .7, ambientIntensity: .42, hemiIntensity: .9 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0006; lights.key.shadow.normalBias = .018
  const world = new THREE.Group(); world.name = 'clay-workbench'; scene.add(world)
  const wheel = new THREE.Group(); wheel.name = 'clay-wheel'; wheel.position.y = .82; world.add(wheel)
  const clayMaterial = new THREE.MeshStandardMaterial({ color: 0xad785a, roughness: .62, metalness: 0 })
  const wood = new THREE.MeshStandardMaterial({ color: 0x937452, roughness: .83 })
  const woodSide = new THREE.MeshStandardMaterial({ color: 0x806349, roughness: .89 })
  const woodLight = new THREE.MeshStandardMaterial({ color: 0xc9ac7e, roughness: .82 })
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x69533c, roughness: .9 })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  add('clay-wood-base', new RoundedBoxGeometry(1.80, .18, 1.28, 3, .045), woodSide, [0, .16, 0])
  const footGeometry = new RoundedBoxGeometry(1.60, .07, .17, 3, .018)
  add('clay-wood-foot-front', footGeometry, woodDark, [0, .035, .48])
  add('clay-wood-foot-back', footGeometry, woodDark, [0, .035, -.48])
  add('clay-spindle', new THREE.CylinderGeometry(.18, .25, .49, 24), woodDark, [0, .495, 0])
  // Two braces visibly carry the axle from the base to the turning head.
  for (const x of [-.47, .47]) {
    const brace = add('clay-wheel-brace', new RoundedBoxGeometry(.17, .45, .22, 2, .022), wood, [x, .405, 0])
    brace.rotation.z = x > 0 ? .52 : -.52
  }
  const rim = add('clay-wheel-rim', new THREE.CylinderGeometry(1.08, 1.08, .16, 64), wood, [0, 0, 0], wheel)
  const ringGeometry = new THREE.TorusGeometry(1.052, .012, 6, 64)
  const band = add('clay-wheel-edge', ringGeometry, woodLight, [0, .068, 0], wheel); band.rotation.x = Math.PI / 2
  // Turned growth rings and a contrasting inset make the motion perceptible.
  for (const r of [.68, .79, .91]) {
    const grain = add('clay-wheel-grain', new THREE.TorusGeometry(r, .004, 4, 64), woodDark, [0, .081, 0], wheel)
    grain.rotation.x = Math.PI / 2; grain.userData.toonSurface = { outline: false }
  }
  const mark = add('clay-wheel-mark', new RoundedBoxGeometry(.09, .008, .32, 2, .01), woodLight, [.70, .083, .62], wheel)
  mark.rotation.y = .85
  const markEnd = add('clay-wheel-mark-edge', new THREE.BoxGeometry(.065, .12, .012), woodLight, [.80, 0, .721], wheel)
  markEnd.rotation.y = .84
  const clay = add('clay-body', new THREE.LatheGeometry(clayProfile(0), SEGMENTS), clayMaterial, [0, .90, 0])
  clay.userData.toonSurface = { outline: false, roughness: .62, metalness: 0 }
  const pullCue: InteractionCue = { kind: 'drag', direction: [0, -1], label: COPY.pullAction, priority: 3, enabled: () => inputActive() && !transition && checkpoint === 1, anchor: [0, 0, 0] }
  const quietCue: InteractionCue = { kind: 'tap', label: COPY.quietAction, priority: 3, enabled: () => inputActive() && !transition && checkpoint === 2, anchor: [0, 0, 0] }
  const removeCues = [
    addInteractionCue(rim, { kind: 'rotate', label: COPY.turnAction, priority: 3, enabled: () => inputActive() && !transition && checkpoint === 0, anchor: [0, -.025, 1.079] }),
    addInteractionCue(clay, pullCue), addInteractionCue(clay, quietCue),
  ]
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const shape = (value: number) => {
    formed = value
    const profile = clayProfile(value), positions = clay.geometry.getAttribute('position')
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = i / SEGMENTS * Math.PI * 2, sin = Math.sin(a), cos = Math.cos(a)
      for (let j = 0; j < profile.length; j++) { const p = profile[j]!; positions.setXYZ(i * profile.length + j, p.x * sin, p.y, p.x * cos) }
    }
    positions.needsUpdate = true; clay.geometry.computeVertexNormals(); clay.geometry.computeBoundingSphere(); clay.geometry.computeBoundingBox()
    // The cue lies exactly on a front exterior profile vertex, never over the cavity.
    const anchor: [number, number, number] = [0, (heightAt(value) - .045) * .5, outerRadius(.5, value)]
    pullCue.anchor = anchor; quietCue.anchor = anchor
  }
  const restore = () => { wheel.rotation.y = checkpoint >= 1 ? FINAL_TURN : 0; shape(checkpoint >= 2 ? 1 : 0); matrices() }
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2()
  const visibleHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const reset = () => { dragging = moved = false; maxTravel = crossTravel = 0; if (transition || disposed) return; restore(); sync() }
  // prepareFeedback can synchronously dispatch input while the original down
  // owns capture. Stop it before createObjectPointer's inactive-cancel branch.
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => {
    ui.hitLayer.addEventListener(type, guardCallbackInput, true)
    window.addEventListener(type, guardCallbackInput, true)
  })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) {
      if (transition || checkpoint === 3) return false
      matrices(); const hit = visibleHit(x, y)
      if (!hit || hit.object !== (checkpoint === 0 ? rim : clay)) return false
      if (checkpoint === 0) { const p = rim.worldToLocal(hit.point.clone()); return Math.hypot(p.x, p.z) >= 1.0 }
      if (checkpoint === 1) {
        const p = clay.worldToLocal(hit.point.clone()), n = hit.face?.normal
        return !!n && p.y > .04 && p.y < heightAt(formed) - .06 && n.x * p.x + n.z * p.z > .2
      }
      return true
    },
    onStart(x, y) {
      const version = lifecycleVersion
      withHostCallbacks(() => feedback.prepare()); if (!active() || lifecycleVersion !== version) { pointer.cancel(); return }
      down.set(x, y); dragging = checkpoint < 2; moved = false; maxTravel = crossTravel = 0
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const dx = x - down.x, dy = y - down.y
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); crossTravel = Math.max(crossTravel, Math.abs(checkpoint === 0 ? dy : dx)); moved ||= maxTravel > 0
      if (!dragging) return
      if (checkpoint === 0) wheel.rotation.y = THREE.MathUtils.clamp(dx * .011, -.95, .95)
      else if (checkpoint === 1) shape(THREE.MathUtils.clamp(-dy / 90, 0, 1))
      matrices()
    },
    onRelease(x, y) {
      const dx = x - down.x, dy = y - down.y
      const valid = checkpoint === 0 ? dragging && moved && dx >= 45 && Math.abs(dy) <= Math.max(18, dx * .4) && (wheel.rotation.y >= .95 || crossTravel <= Math.max(22, dx * .5)) && wheel.rotation.y >= .45
        : checkpoint === 1 ? dragging && moved && -dy >= 45 && Math.abs(dx) <= Math.max(18, -dy * .4) && (formed >= 1 || crossTravel <= Math.max(22, -dy * .5)) && formed >= .5
          : checkpoint === 2 && maxTravel < 12 && Math.hypot(dx, dy) < 12 && visibleHit(x, y)?.object === clay
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: () => inputActive(), duration: 3, motion: 'glow',
    targets: () => [clay], cancelInput: () => pointer.cancel(), complete: () => advance(),
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !inputActive() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !transition && checkpoint < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? COPY.turnAction : checkpoint === 1 ? COPY.pullAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, transition ? COPY.moving : checkpoint === 0 ? COPY.turn : checkpoint === 1 ? COPY.pull : checkpoint === 2 ? COPY.quiet : COPY.done, safe)
    ending.sync(checkpoint === 2 && !transition)
  }
  function withHostCallbacks(work: () => void) {
    notifying = true; sync()
    try { work() } finally { notifying = false; if (!disposed) sync() }
  }
  function settle() {
    if (!inputActive() || !transition) return
    checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(checkpoint); if (active()) feedback.impact({ freqs: [196, 293.66], duration: .12, gain: .008, type: 'sine' }) })
  }
  function advance() {
    if (checkpoint === 2 && !ending.completing) return
    if (!inputActive() || pointer.isBusy() || transition || checkpoint === 3) return
    if (checkpoint === 2) {
      checkpoint = 3; restore()
      withHostCallbacks(() => {
        ctx.onProgress?.(3); if (!active()) return
        feedback.impact({ freqs: [196, 246.94], duration: .2, gain: .006 })
        if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
      }); return
    }
    transition = { step: checkpoint, time: 0, turn: wheel.rotation.y, formed }; sync(); if (reduced()) settle()
  }
  const action = () => {
    if (!inputActive() || pointer.isBusy() || transition || checkpoint === 3) return
    const version = lifecycleVersion
    withHostCallbacks(() => feedback.prepare()); if (version === lifecycleVersion) advance()
  }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 4.0)
    camera.position.set(0, 3.6 + boost * .28, 5.0 + boost); camera.lookAt(0, 1.0, 0); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      // Host inactivity is observable even from inside a callback. A pause and
      // immediate resume must not resurrect the gesture that was being prepared.
      if (!active()) {
        lifecycleVersion++; pointer.cancel()
        // Coalesce UI work only. Every observed inactive boundary invalidates
        // preparation, including repeated pauses before the next active frame.
        if (!suspended) { sync(); suspended = true }
        return
      }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
        transition.time = reduced() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        if (transition.step === 0) wheel.rotation.y = THREE.MathUtils.lerp(transition.turn, FINAL_TURN, t)
        else shape(THREE.MathUtils.lerp(transition.formed, 1, t))
        if (transition.time === 1) settle()
      }
      if (!active()) return
      if (!active()) return
      ending.update(dt)
      if (!active()) return
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); style.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose(); disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => {
        ui.hitLayer.removeEventListener(type, guardCallbackInput, true)
        window.removeEventListener(type, guardCallbackInput, true)
      })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world)
      Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
