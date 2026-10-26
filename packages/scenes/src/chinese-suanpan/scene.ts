import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createSuanpanModel } from './model'

type Checkpoint = 0 | 1 | 2 | 3
const ACTIONS = ['向上拨三颗下珠', '向下拨一颗上珠', '向上拨十位下珠']
const HINTS = [
  '当前 0。拿住最右档从横梁向下数的第三颗下珠，沿竹杆移到横梁旁，三颗下珠会一起靠梁。',
  '当前 3。拿住最右档靠近横梁的上珠，沿竹杆移到横梁旁。每颗上珠记五，五加三就是八。',
  '当前 8。拿住右起第二档最靠近横梁的下珠，移到横梁旁，在十位加一。',
  '当前 18：十位一颗下珠，个位一颗上珠和三颗下珠靠梁。十八已拨好。',
]
const MOVING = ['三颗下珠沿竹杆靠近横梁……', '一颗上珠向横梁滑来……', '十位的一颗下珠靠梁……']
const ease = (t: number) => t * t * (3 - 2 * t)

export function createChineseSuanpan(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  ;[...ACTIONS, ...HINTS, ...MOVING].forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, callbackVersion = 0, stopResize = () => {}
  let motion: { step: 0 | 1 | 2; time: number; from: number; placed: boolean } | null = null
  let amount = 0, moved = false, invalid = false
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const callbackActive = () => active() && callbackVersion === lifecycleVersion
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => callbackActive() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: '拨珠见数', stepsAria: '拨珠步骤', action: ACTIONS[0]! }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas), camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'chinese-suanpan', label: '拨珠见数' }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeaf4ed, ground: 0xa39c74, key: 0xffedca, rim: 0xd6f3ff, keyPosition: [-3, 5, 4], keyIntensity: 2.0, rimIntensity: .8 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0004; lights.key.shadow.normalBias = .008
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .1, far: 15 })
  const model = createSuanpanModel(); scene.add(model.subject)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (step: number, n: number) => { amount = n; model.pose(step > 0 ? 1 : n, step > 1 ? 1 : step === 1 ? n : 0, step === 2 ? n : step > 2 ? 1 : 0); matrices() }
  const restore = () => pose(at, 0)
  const goals = model.targets.map((target, i) => { pose(i, 1); return target.localToWorld(new THREE.Vector3(...model.anchors[i]!)) }); restore()
  const removeCues = model.targets.map((target, i) => addInteractionCue(target!, { kind: 'drag', destination: () => goals[i]!.clone(), targetLabel: '沿杆靠梁', label: ACTIONS[i]!, anchor: model.anchors[i], priority: 3, enabled: () => inputActive() && !motion && at === i }))
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), rail = new THREE.Vector2()
  const screen = (point: THREE.Vector3) => { const p = point.clone().project(camera), r = canvas.getBoundingClientRect(); return new THREE.Vector2(r.left + (p.x + 1) * r.width / 2, r.top + (1 - p.y) * r.height / 2) }
  const nearest = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const materials = Array.isArray(m.material) ? m.material : [m.material]; if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o) })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const reset = () => { moved = invalid = false; if (!motion && !disposed) restore() }
  const slide = (x: number, y: number) => {
    if (invalid || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false
    const r = canvas.getBoundingClientRect()
    if (x < r.left || x > r.left + r.width || y < r.top || y > r.top + r.height) return false
    moved ||= x !== down.x || y !== down.y
    const n = new THREE.Vector2(x - down.x, y - down.y).dot(rail) / rail.lengthSq()
    pose(at, THREE.MathUtils.clamp(n, 0, 1))
    // The bead remains attached to its rod; acceptance reads its real beam-side
    // position, rather than the length or direction history of the finger path.
    const contact = model.targets[at]!.localToWorld(new THREE.Vector3(...model.anchors[at]!))
    return moved && contact.distanceTo(goals[at]!) <= .03
  }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false; matrices(); return nearest(x, y) === model.targets[at] },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); moved = invalid = false
      const source = model.targets[at]!.localToWorld(new THREE.Vector3(...model.anchors[at]!))
      rail.copy(screen(goals[at]!)).sub(screen(source))
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { invalid = true; return }
      if (slide(x, y) && pointer.finish()) advance(true)
    },
    onRelease(x, y) {
      if (slide(x, y)) advance(true); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, ACTIONS[Math.min(at, 2)]!, safe); setSafeText(ui.hintEl, motion ? MOVING[motion.step]! : HINTS[at]!, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; callbackVersion = lifecycleVersion; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => {
      ctx.onProgress?.(at); if (!callbackActive()) return
      feedback.impact({ freqs: [523.25], duration: .09, gain: .003, type: 'sine' })
      if (at === 3 && callbackActive()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  function advance(placed = false) { if (!inputActive() || (pointer.isBusy() && !placed) || motion || at === 3) return; motion = { step: at, time: 0, from: amount, placed }; sync(); if (ctx.isReducedMotion?.()) settle() }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), target = new THREE.Vector3(0, .12, .10), direction = new THREE.Vector3(.08, 1.8, 1.3).normalize()
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true)
    const inverse = camera.quaternion.clone().invert(), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), p = new THREE.Vector3(); let distance = 3.4
    const saved = amount
    for (const [step, n] of [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0]]) {
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
      if (motion) { motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / (motion.placed ? .2 : .85)); pose(motion.step, THREE.MathUtils.lerp(motion.from, 1, ease(motion.time))); if (motion.time === 1) settle() }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(model.subject); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
